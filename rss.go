package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"regexp"
	"time"

	"github.com/mmcdole/gofeed"
	_ "modernc.org/sqlite"
)

// Feed represents an RSS feed configuration
type Feed struct {
	ID            int       `json:"id"`
	Name          string    `json:"name"`
	URL           string    `json:"url"`
	Pattern       string    `json:"pattern"` // regex pattern to match
	Enabled       bool      `json:"enabled"`
	CheckInterval int       `json:"checkInterval"` // minutes
	LastChecked   time.Time `json:"lastChecked"`
	LastError     string    `json:"lastError"`
	MatchCount    int       `json:"matchCount"` // total matches found
}

// DownloadedItem tracks items that have been downloaded
type DownloadedItem struct {
	ID           int       `json:"id"`
	FeedID       int       `json:"feedId"`
	ItemGUID     string    `json:"itemGuid"`
	ItemTitle    string    `json:"itemTitle"`
	ItemLink     string    `json:"itemLink"`
	DownloadedAt time.Time `json:"downloadedAt"`
}

// FeedManager handles RSS feed polling and management
type FeedManager struct {
	db            *sql.DB
	client        *TransmissionClient
	parser        *gofeed.Parser
	stopCh        chan struct{}
	checkInterval time.Duration
}

// NewFeedManager creates a new feed manager
func NewFeedManager(dbPath string, client *TransmissionClient) (*FeedManager, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Create tables
	if err := createTables(db); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	fm := &FeedManager{
		db:            db,
		client:        client,
		parser:        gofeed.NewParser(),
		stopCh:        make(chan struct{}),
		checkInterval: 15 * time.Minute, // default check interval
	}

	return fm, nil
}

func createTables(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS feeds (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			url TEXT NOT NULL UNIQUE,
			pattern TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			check_interval INTEGER NOT NULL DEFAULT 15,
			last_checked DATETIME,
			last_error TEXT,
			match_count INTEGER NOT NULL DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS downloaded_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			feed_id INTEGER NOT NULL,
			item_guid TEXT NOT NULL,
			item_title TEXT NOT NULL,
			item_link TEXT NOT NULL,
			downloaded_at DATETIME NOT NULL,
			FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
			UNIQUE(feed_id, item_guid)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_downloaded_guid ON downloaded_items(item_guid)`,
		`CREATE INDEX IF NOT EXISTS idx_feeds_enabled ON feeds(enabled)`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return err
		}
	}

	return nil
}

// Start begins background polling of RSS feeds
func (fm *FeedManager) Start() {
	go fm.pollLoop()
	log.Println("RSS feed manager started")
}

// Stop stops the background polling
func (fm *FeedManager) Stop() {
	close(fm.stopCh)
}

func (fm *FeedManager) pollLoop() {
	ticker := time.NewTicker(fm.checkInterval)
	defer ticker.Stop()

	// Initial check on startup
	fm.checkAllFeeds()

	for {
		select {
		case <-ticker.C:
			fm.checkAllFeeds()
		case <-fm.stopCh:
			return
		}
	}
}

func (fm *FeedManager) checkAllFeeds() {
	feeds, err := fm.GetFeeds()
	if err != nil {
		log.Printf("Failed to get feeds: %v", err)
		return
	}

	for _, feed := range feeds {
		if !feed.Enabled {
			continue
		}

		// Check if it's time to check this feed
		if time.Since(feed.LastChecked) < time.Duration(feed.CheckInterval)*time.Minute {
			continue
		}

		if err := fm.CheckFeed(feed.ID); err != nil {
			log.Printf("Error checking feed %s: %v", feed.Name, err)
		}
	}
}

// CheckFeed checks a single feed for new items
func (fm *FeedManager) CheckFeed(feedID int) error {
	feed, err := fm.GetFeed(feedID)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Parse the RSS feed
	parsedFeed, err := fm.parser.ParseURLWithContext(feed.URL, ctx)
	if err != nil {
		fm.updateFeedError(feedID, err.Error())
		return fmt.Errorf("failed to parse feed: %w", err)
	}

	// Compile regex pattern
	pattern, err := regexp.Compile(feed.Pattern)
	if err != nil {
		fm.updateFeedError(feedID, fmt.Sprintf("invalid pattern: %v", err))
		return fmt.Errorf("invalid regex pattern: %w", err)
	}

	log.Printf("Checking RSS feed '%s' with pattern: %s", feed.Name, feed.Pattern)
	log.Printf("Found %d items in feed", len(parsedFeed.Items))

	matchCount := 0
	for _, item := range parsedFeed.Items {
		// Check if item matches pattern
		matched := pattern.MatchString(item.Title)
		if !matched {
			log.Printf("  ❌ No match: %s", item.Title)
			continue
		}
		log.Printf("  ✓ Matched: %s", item.Title)

		// Check if we've already downloaded this item
		if fm.isDownloaded(feedID, item.GUID) {
			log.Printf("  ⏭ Already downloaded: %s", item.Title)
			continue
		}

		// Try to find a torrent link
		torrentLink := fm.findTorrentLink(item)
		if torrentLink == "" {
			log.Printf("No torrent link found for: %s", item.Title)
			continue
		}

		// Add torrent to Transmission
		if err := fm.client.AddTorrent(torrentLink, nil); err != nil {
			log.Printf("Failed to add torrent %s: %v", item.Title, err)
			continue
		}

		// Mark as downloaded
		if err := fm.markDownloaded(feedID, item); err != nil {
			log.Printf("Failed to mark item as downloaded: %v", err)
			continue
		}

		matchCount++
		log.Printf("Added torrent from RSS feed %s: %s", feed.Name, item.Title)
	}

	// Update feed status
	fm.updateFeedChecked(feedID, matchCount, "")
	return nil
}

func (fm *FeedManager) findTorrentLink(item *gofeed.Item) string {
	// Try the link field first
	if item.Link != "" && (isMagnetLink(item.Link) || isTorrentFile(item.Link)) {
		return item.Link
	}

	// Check enclosures for torrent files
	for _, enclosure := range item.Enclosures {
		if enclosure.URL != "" && (isMagnetLink(enclosure.URL) || isTorrentFile(enclosure.URL)) {
			return enclosure.URL
		}
	}

	// Check custom fields (some feeds use custom namespaces)
	if item.Custom != nil {
		if link, exists := item.Custom["link"]; exists && link != "" {
			if isMagnetLink(link) || isTorrentFile(link) {
				return link
			}
		}
	}

	return ""
}

func isMagnetLink(url string) bool {
	return len(url) > 8 && url[:8] == "magnet:?"
}

func isTorrentFile(url string) bool {
	return len(url) > 8 && url[len(url)-8:] == ".torrent"
}

func (fm *FeedManager) isDownloaded(feedID int, guid string) bool {
	var count int
	err := fm.db.QueryRow(
		"SELECT COUNT(*) FROM downloaded_items WHERE feed_id = ? AND item_guid = ?",
		feedID, guid,
	).Scan(&count)
	return err == nil && count > 0
}

func (fm *FeedManager) markDownloaded(feedID int, item *gofeed.Item) error {
	_, err := fm.db.Exec(
		`INSERT INTO downloaded_items (feed_id, item_guid, item_title, item_link, downloaded_at)
		 VALUES (?, ?, ?, ?, ?)`,
		feedID, item.GUID, item.Title, item.Link, time.Now(),
	)
	return err
}

func (fm *FeedManager) updateFeedChecked(feedID int, matchCount int, errorMsg string) {
	_, err := fm.db.Exec(
		`UPDATE feeds SET last_checked = ?, last_error = ?, match_count = match_count + ?
		 WHERE id = ?`,
		time.Now(), errorMsg, matchCount, feedID,
	)
	if err != nil {
		log.Printf("Failed to update feed status: %v", err)
	}
}

func (fm *FeedManager) updateFeedError(feedID int, errorMsg string) {
	_, err := fm.db.Exec(
		"UPDATE feeds SET last_checked = ?, last_error = ? WHERE id = ?",
		time.Now(), errorMsg, feedID,
	)
	if err != nil {
		log.Printf("Failed to update feed error: %v", err)
	}
}

// GetFeeds returns all feeds
func (fm *FeedManager) GetFeeds() ([]Feed, error) {
	rows, err := fm.db.Query(`
		SELECT id, name, url, pattern, enabled, check_interval, 
		       COALESCE(last_checked, ''), COALESCE(last_error, ''), match_count
		FROM feeds ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feeds []Feed
	for rows.Next() {
		var feed Feed
		var lastChecked string
		err := rows.Scan(
			&feed.ID, &feed.Name, &feed.URL, &feed.Pattern, &feed.Enabled,
			&feed.CheckInterval, &lastChecked, &feed.LastError, &feed.MatchCount,
		)
		if err != nil {
			return nil, err
		}
		if lastChecked != "" {
			feed.LastChecked, _ = time.Parse(time.RFC3339, lastChecked)
		}
		feeds = append(feeds, feed)
	}

	return feeds, rows.Err()
}

// GetFeed returns a single feed by ID
func (fm *FeedManager) GetFeed(id int) (*Feed, error) {
	var feed Feed
	var lastChecked string
	err := fm.db.QueryRow(`
		SELECT id, name, url, pattern, enabled, check_interval,
		       COALESCE(last_checked, ''), COALESCE(last_error, ''), match_count
		FROM feeds WHERE id = ?
	`, id).Scan(
		&feed.ID, &feed.Name, &feed.URL, &feed.Pattern, &feed.Enabled,
		&feed.CheckInterval, &lastChecked, &feed.LastError, &feed.MatchCount,
	)
	if err != nil {
		return nil, err
	}
	if lastChecked != "" {
		feed.LastChecked, _ = time.Parse(time.RFC3339, lastChecked)
	}
	return &feed, nil
}

// AddFeed adds a new feed
func (fm *FeedManager) AddFeed(feed *Feed) error {
	// Validate regex pattern
	if _, err := regexp.Compile(feed.Pattern); err != nil {
		return fmt.Errorf("invalid regex pattern: %w", err)
	}

	if feed.CheckInterval <= 0 {
		feed.CheckInterval = 15 // default to 15 minutes
	}

	result, err := fm.db.Exec(
		`INSERT INTO feeds (name, url, pattern, enabled, check_interval)
		 VALUES (?, ?, ?, ?, ?)`,
		feed.Name, feed.URL, feed.Pattern, feed.Enabled, feed.CheckInterval,
	)
	if err != nil {
		return err
	}

	id, _ := result.LastInsertId()
	feed.ID = int(id)
	return nil
}

// UpdateFeed updates an existing feed
func (fm *FeedManager) UpdateFeed(feed *Feed) error {
	// Validate regex pattern
	if _, err := regexp.Compile(feed.Pattern); err != nil {
		return fmt.Errorf("invalid regex pattern: %w", err)
	}

	_, err := fm.db.Exec(
		`UPDATE feeds SET name = ?, url = ?, pattern = ?, enabled = ?, check_interval = ?
		 WHERE id = ?`,
		feed.Name, feed.URL, feed.Pattern, feed.Enabled, feed.CheckInterval, feed.ID,
	)
	return err
}

// DeleteFeed deletes a feed
func (fm *FeedManager) DeleteFeed(id int) error {
	_, err := fm.db.Exec("DELETE FROM feeds WHERE id = ?", id)
	return err
}

// GetDownloadedItems returns downloaded items for a feed
func (fm *FeedManager) GetDownloadedItems(feedID int, limit int) ([]DownloadedItem, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := fm.db.Query(`
		SELECT id, feed_id, item_guid, item_title, item_link, downloaded_at
		FROM downloaded_items
		WHERE feed_id = ?
		ORDER BY downloaded_at DESC
		LIMIT ?
	`, feedID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []DownloadedItem
	for rows.Next() {
		var item DownloadedItem
		err := rows.Scan(
			&item.ID, &item.FeedID, &item.ItemGUID, &item.ItemTitle,
			&item.ItemLink, &item.DownloadedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

// Close closes the database connection
func (fm *FeedManager) Close() error {
	fm.Stop()
	return fm.db.Close()
}
