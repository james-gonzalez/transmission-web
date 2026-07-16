package main

import (
	"compress/gzip"
	"context"
	"embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

//go:embed frontend/dist
var frontendFS embed.FS

// Version is set during build time via ldflags
var Version = "dev"

// Config holds application configuration
type Config struct {
	TransmissionURL  string
	TransmissionUser string
	TransmissionPass string
	ListenAddr       string
}

// TransmissionClient handles communication with Transmission RPC
type TransmissionClient struct {
	url       string
	user      string
	pass      string
	sessionID string
	mu        sync.RWMutex
	client    *http.Client
}

// RPC request/response structures
type RPCRequest struct {
	Method    string      `json:"method"`
	Arguments interface{} `json:"arguments,omitempty"`
}

type RPCResponse struct {
	Result    string          `json:"result"`
	Arguments json.RawMessage `json:"arguments"`
}

type Torrent struct {
	SeedRatioLimit float64 `json:"seedRatioLimit"`
	SeedRatioMode  int     `json:"seedRatioMode"`
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	Status         int     `json:"status"`
	PercentDone    float64 `json:"percentDone"`
	RateDownload   int64   `json:"rateDownload"`
	RateUpload     int64   `json:"rateUpload"`
	UploadRatio    float64 `json:"uploadRatio"`
	SizeWhenDone   int64   `json:"sizeWhenDone"`
	DownloadedEver int64   `json:"downloadedEver"`
	UploadedEver   int64   `json:"uploadedEver"`
	PeersConnected int     `json:"peersConnected"`
	ETA            int     `json:"eta"`
	Error          int     `json:"error"`
	ErrorString    string  `json:"errorString"`
	AddedDate      int64   `json:"addedDate"`
}

type TorrentList struct {
	Torrents []Torrent `json:"torrents"`
}

type SessionStats struct {
	ActiveTorrentCount int         `json:"activeTorrentCount"`
	PausedTorrentCount int         `json:"pausedTorrentCount"`
	TorrentCount       int         `json:"torrentCount"`
	DownloadSpeed      int64       `json:"downloadSpeed"`
	UploadSpeed        int64       `json:"uploadSpeed"`
	CurrentStats       StatsDetail `json:"current-stats"`
	CumulativeStats    StatsDetail `json:"cumulative-stats"`
}

type StatsDetail struct {
	UploadedBytes   int64 `json:"uploadedBytes"`
	DownloadedBytes int64 `json:"downloadedBytes"`
	FilesAdded      int   `json:"filesAdded"`
	SessionCount    int   `json:"sessionCount"`
	SecondsActive   int   `json:"secondsActive"`
}

type SessionInfo struct {
	Version          string  `json:"version"`
	RPCVersion       int     `json:"rpc-version"`
	DownloadDir      string  `json:"download-dir"`
	PeerPort         int     `json:"peer-port"`
	SeedRatioLimit   float64 `json:"seedRatioLimit"`
	SeedRatioLimited bool    `json:"seedRatioLimited"`
}

type PortTest struct {
	PortIsOpen bool `json:"port-is-open"`
}

type Peer struct {
	Address            string  `json:"address"`
	ClientName         string  `json:"clientName"`
	ClientIsChoked     bool    `json:"clientIsChoked"`
	ClientIsInterested bool    `json:"clientIsInterested"`
	FlagStr            string  `json:"flagStr"`
	IsDownloadingFrom  bool    `json:"isDownloadingFrom"`
	IsEncrypted        bool    `json:"isEncrypted"`
	IsIncoming         bool    `json:"isIncoming"`
	IsUploadingTo      bool    `json:"isUploadingTo"`
	IsUTP              bool    `json:"isUTP"`
	PeerIsChoked       bool    `json:"peerIsChoked"`
	PeerIsInterested   bool    `json:"peerIsInterested"`
	Port               int     `json:"port"`
	Progress           float64 `json:"progress"`
	RateToClient       int64   `json:"rateToClient"`
	RateToPeer         int64   `json:"rateToPeer"`
}

type TorrentPeers struct {
	Torrents []struct {
		ID    int    `json:"id"`
		Peers []Peer `json:"peers"`
	} `json:"torrents"`
}

type TrackerStats struct {
	Announce              string `json:"announce"`
	AnnounceState         int    `json:"announceState"`
	DownloadCount         int    `json:"downloadCount"`
	HasAnnounced          bool   `json:"hasAnnounced"`
	HasScraped            bool   `json:"hasScraped"`
	Host                  string `json:"host"`
	ID                    int    `json:"id"`
	IsBackup              bool   `json:"isBackup"`
	LastAnnouncePeerCount int    `json:"lastAnnouncePeerCount"`
	LastAnnounceResult    string `json:"lastAnnounceResult"`
	LastAnnounceStartTime int64  `json:"lastAnnounceStartTime"`
	LastAnnounceSucceeded bool   `json:"lastAnnounceSucceeded"`
	LastAnnounceTime      int64  `json:"lastAnnounceTime"`
	LastScrapeResult      string `json:"lastScrapeResult"`
	LastScrapeStartTime   int64  `json:"lastScrapeStartTime"`
	LastScrapeSucceeded   bool   `json:"lastScrapeSucceeded"`
	LastScrapeTime        int64  `json:"lastScrapeTime"`
	LeecherCount          int    `json:"leecherCount"`
	NextAnnounceTime      int64  `json:"nextAnnounceTime"`
	NextScrapeTime        int64  `json:"nextScrapeTime"`
	Scrape                string `json:"scrape"`
	ScrapeState           int    `json:"scrapeState"`
	SeederCount           int    `json:"seederCount"`
	Tier                  int    `json:"tier"`
}

type TorrentTrackers struct {
	Torrents []struct {
		ID           int            `json:"id"`
		TrackerStats []TrackerStats `json:"trackerStats"`
	} `json:"torrents"`
}

type File struct {
	Index          int    `json:"index"`
	Name           string `json:"name"`
	Length         int64  `json:"length"`
	BytesCompleted int64  `json:"bytesCompleted"`
	Wanted         bool   `json:"wanted"`
}

type FreeSpace struct {
	Path      string `json:"path"`
	SizeBytes int64  `json:"size-bytes"`
	TotalSize int64  `json:"total_size"`
}

func NewTransmissionClient(url, user, pass string) *TransmissionClient {
	return &TransmissionClient{
		url:    url,
		user:   user,
		pass:   pass,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *TransmissionClient) doRequest(req *RPCRequest) (*RPCResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	for attempt := 0; attempt < 2; attempt++ {
		c.mu.RLock()
		sessionID := c.sessionID
		c.mu.RUnlock()

		httpReq, err := http.NewRequestWithContext(context.Background(), "POST", c.url, strings.NewReader(string(body)))
		if err != nil {
			return nil, err
		}

		httpReq.Header.Set("Content-Type", "application/json")
		if c.user != "" {
			auth := base64.StdEncoding.EncodeToString([]byte(c.user + ":" + c.pass))
			httpReq.Header.Set("Authorization", "Basic "+auth)
		}
		if sessionID != "" {
			httpReq.Header.Set("X-Transmission-Session-Id", sessionID)
		}

		resp, err := c.client.Do(httpReq)
		if err != nil {
			return nil, err
		}

		// Handle 409 - need to get new session ID
		if resp.StatusCode == 409 {
			newSessionID := resp.Header.Get("X-Transmission-Session-Id")
			c.mu.Lock()
			c.sessionID = newSessionID
			c.mu.Unlock()
			resp.Body.Close()
			continue // Retry with new session ID
		}

		if resp.StatusCode != 200 {
			resp.Body.Close()
			return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
		}

		var rpcResp RPCResponse
		decodeErr := json.NewDecoder(resp.Body).Decode(&rpcResp)
		resp.Body.Close()
		if decodeErr != nil {
			return nil, decodeErr
		}

		if rpcResp.Result != "success" {
			return nil, fmt.Errorf("RPC error: %s", rpcResp.Result)
		}

		return &rpcResp, nil
	}

	return nil, fmt.Errorf("session ID negotiation failed after retries")
}

func (c *TransmissionClient) GetTorrents() ([]Torrent, error) {
	req := &RPCRequest{
		Method: "torrent-get",
		Arguments: map[string]interface{}{
			"fields": []string{
				"id", "name", "status", "percentDone", "rateDownload", "rateUpload",
				"uploadRatio", "sizeWhenDone", "downloadedEver", "uploadedEver",
				"peersConnected", "eta", "error", "errorString", "addedDate",
				"seedRatioLimit", "seedRatioMode",
			},
		},
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}

	var list TorrentList
	if err := json.Unmarshal(resp.Arguments, &list); err != nil {
		return nil, err
	}

	return list.Torrents, nil
}

func (c *TransmissionClient) GetSessionStats() (*SessionStats, error) {
	req := &RPCRequest{Method: "session-stats"}
	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}

	var stats SessionStats
	if err := json.Unmarshal(resp.Arguments, &stats); err != nil {
		return nil, err
	}

	return &stats, nil
}

// GetSessionInfo returns daemon-level info (version, RPC version, download dir,
// peer port) from session-get for the stats panel.
func (c *TransmissionClient) GetSessionInfo() (*SessionInfo, error) {
	req := &RPCRequest{
		Method: "session-get",
		Arguments: map[string]interface{}{
			"fields": []string{"version", "rpc-version", "download-dir", "peer-port", "seedRatioLimit", "seedRatioLimited"},
		},
	}
	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}

	var info SessionInfo
	if err := json.Unmarshal(resp.Arguments, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

func (c *TransmissionClient) TestPort() (bool, error) {
	req := &RPCRequest{Method: "port-test"}
	resp, err := c.doRequest(req)
	if err != nil {
		return false, err
	}

	var pt PortTest
	if err := json.Unmarshal(resp.Arguments, &pt); err != nil {
		return false, err
	}

	return pt.PortIsOpen, nil
}

func (c *TransmissionClient) GetFreeSpace(path string) (*FreeSpace, error) {
	req := &RPCRequest{
		Method: "free-space",
		Arguments: map[string]interface{}{
			"path": path,
		},
	}
	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}

	var fs FreeSpace
	if err := json.Unmarshal(resp.Arguments, &fs); err != nil {
		return nil, err
	}

	return &fs, nil
}

// GetDownloadDir asks the daemon for its configured download directory, so we
// report free space for wherever Transmission actually downloads rather than a
// hardcoded path (which drifts when the container's mounts change).
func (c *TransmissionClient) GetDownloadDir() (string, error) {
	req := &RPCRequest{
		Method: "session-get",
		Arguments: map[string]interface{}{
			"fields": []string{"download-dir"},
		},
	}
	resp, err := c.doRequest(req)
	if err != nil {
		return "", err
	}

	var session struct {
		DownloadDir string `json:"download-dir"`
	}
	if err := json.Unmarshal(resp.Arguments, &session); err != nil {
		return "", err
	}

	return session.DownloadDir, nil
}

func (c *TransmissionClient) AddTorrent(magnetOrURL string, torrentData []byte) error {
	args := make(map[string]interface{})

	switch {
	case len(torrentData) > 0:
		args["metainfo"] = base64.StdEncoding.EncodeToString(torrentData)
	case magnetOrURL != "":
		args["filename"] = magnetOrURL
	default:
		return fmt.Errorf("no torrent data provided")
	}

	req := &RPCRequest{
		Method:    "torrent-add",
		Arguments: args,
	}

	_, err := c.doRequest(req)
	return err
}

func (c *TransmissionClient) StartTorrent(id int) error {
	req := &RPCRequest{
		Method:    "torrent-start",
		Arguments: map[string]interface{}{"ids": []int{id}},
	}
	_, err := c.doRequest(req)
	return err
}

func (c *TransmissionClient) StopTorrent(id int) error {
	req := &RPCRequest{
		Method:    "torrent-stop",
		Arguments: map[string]interface{}{"ids": []int{id}},
	}
	_, err := c.doRequest(req)
	return err
}

func (c *TransmissionClient) ReannounceTorrent(id int) error {
	req := &RPCRequest{
		Method:    "torrent-reannounce",
		Arguments: map[string]interface{}{"ids": []int{id}},
	}
	_, err := c.doRequest(req)
	return err
}

func (c *TransmissionClient) ReannounceAll() error {
	req := &RPCRequest{
		Method: "torrent-reannounce",
	}
	_, err := c.doRequest(req)
	return err
}

func (c *TransmissionClient) RemoveTorrent(id int, deleteData bool) error {
	req := &RPCRequest{
		Method: "torrent-remove",
		Arguments: map[string]interface{}{
			"ids":               []int{id},
			"delete-local-data": deleteData,
		},
	}
	_, err := c.doRequest(req)
	return err
}

func (c *TransmissionClient) GetPeers(id int) ([]Peer, error) {
	req := &RPCRequest{
		Method: "torrent-get",
		Arguments: map[string]interface{}{
			"ids":    []int{id},
			"fields": []string{"id", "peers"},
		},
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}

	var result TorrentPeers
	if err := json.Unmarshal(resp.Arguments, &result); err != nil {
		return nil, err
	}

	if len(result.Torrents) > 0 {
		return result.Torrents[0].Peers, nil
	}
	return []Peer{}, nil
}

func (c *TransmissionClient) GetTrackers(id int) ([]TrackerStats, error) {
	req := &RPCRequest{
		Method: "torrent-get",
		Arguments: map[string]interface{}{
			"ids":    []int{id},
			"fields": []string{"id", "trackerStats"},
		},
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}

	var result TorrentTrackers
	if err := json.Unmarshal(resp.Arguments, &result); err != nil {
		return nil, err
	}

	if len(result.Torrents) > 0 {
		return result.Torrents[0].TrackerStats, nil
	}
	return []TrackerStats{}, nil
}

func (c *TransmissionClient) GetFiles(id int) ([]File, error) {
	req := &RPCRequest{
		Method: "torrent-get",
		Arguments: map[string]interface{}{
			"ids":    []int{id},
			"fields": []string{"id", "files", "fileStats"},
		},
	}

	resp, err := c.doRequest(req)
	if err != nil {
		return nil, err
	}

	// files carries name/size/progress; fileStats (same order) carries the
	// wanted flag — zip them by index so the UI knows what's set to download.
	var result struct {
		Torrents []struct {
			Files []struct {
				Name           string `json:"name"`
				Length         int64  `json:"length"`
				BytesCompleted int64  `json:"bytesCompleted"`
			} `json:"files"`
			FileStats []struct {
				Wanted bool `json:"wanted"`
			} `json:"fileStats"`
		} `json:"torrents"`
	}
	if err := json.Unmarshal(resp.Arguments, &result); err != nil {
		return nil, err
	}

	if len(result.Torrents) == 0 {
		return []File{}, nil
	}

	t := result.Torrents[0]
	files := make([]File, len(t.Files))
	for i, f := range t.Files {
		wanted := true
		if i < len(t.FileStats) {
			wanted = t.FileStats[i].Wanted
		}
		files[i] = File{
			Index:          i,
			Name:           f.Name,
			Length:         f.Length,
			BytesCompleted: f.BytesCompleted,
			Wanted:         wanted,
		}
	}
	return files, nil
}

// SetFilesWanted marks the given file indices as wanted (download) or unwanted
// (skip) on a torrent via torrent-set.

// SetSeedRatio sets the per-torrent seed ratio limit.
// mode: 0=global, 1=stop at ratio, 2=seed forever
func (c *TransmissionClient) SetSeedRatio(id int, ratio float64, mode int) error {
	req := &RPCRequest{
		Method: "torrent-set",
		Arguments: map[string]interface{}{
			"ids":            []int{id},
			"seedRatioLimit": ratio,
			"seedRatioMode":  mode,
		},
	}
	_, err := c.doRequest(req)
	return err
}

// SetGlobalSeedRatio sets the daemon-wide default seed ratio via session-set.
// enabled toggles whether the limit is enforced; torrents using "global" mode
// (seedRatioMode 0) inherit this value.
func (c *TransmissionClient) SetGlobalSeedRatio(ratio float64, enabled bool) error {
	req := &RPCRequest{
		Method: "session-set",
		Arguments: map[string]interface{}{
			"seedRatioLimit":   ratio,
			"seedRatioLimited": enabled,
		},
	}
	_, err := c.doRequest(req)
	return err
}

func (c *TransmissionClient) SetFilesWanted(id int, indices []int, wanted bool) error {
	field := "files-wanted"
	if !wanted {
		field = "files-unwanted"
	}
	req := &RPCRequest{
		Method: "torrent-set",
		Arguments: map[string]interface{}{
			"ids": []int{id},
			field: indices,
		},
	}
	_, err := c.doRequest(req)
	return err
}

// Server holds the application state
type Server struct {
	client      *TransmissionClient
	feedManager *FeedManager

	cacheMu      sync.RWMutex
	cachedPort   bool
	cachedPortAt time.Time
	cachedFS     *FreeSpace
	cachedFSAt   time.Time
	cachedDir    string
}

// cachedPortOpen returns TestPort result, refreshing at most once every 60s.
func (s *Server) cachedPortOpen() bool {
	s.cacheMu.RLock()
	if time.Since(s.cachedPortAt) < 60*time.Second {
		v := s.cachedPort
		s.cacheMu.RUnlock()
		return v
	}
	s.cacheMu.RUnlock()

	open, _ := s.client.TestPort()
	s.cacheMu.Lock()
	s.cachedPort = open
	s.cachedPortAt = time.Now()
	s.cacheMu.Unlock()
	return open
}

// cachedFreeSpace returns FreeSpace, refreshing at most once every 60s.
func (s *Server) cachedFreeSpace() *FreeSpace {
	s.cacheMu.RLock()
	if time.Since(s.cachedFSAt) < 60*time.Second {
		fs := s.cachedFS
		s.cacheMu.RUnlock()
		return fs
	}
	s.cacheMu.RUnlock()

	dir := s.cachedDir
	if dir == "" {
		var err error
		dir, err = s.client.GetDownloadDir()
		if err != nil {
			log.Printf("⚠️  Could not determine download dir: %v", err)
			return nil
		}
		s.cacheMu.Lock()
		s.cachedDir = dir
		s.cacheMu.Unlock()
	}

	fs, err := s.client.GetFreeSpace(dir)
	if err != nil {
		log.Printf("⚠️  Could not get free space for %s: %v", dir, err)
		return nil
	}
	s.cacheMu.Lock()
	s.cachedFS = fs
	s.cachedFSAt = time.Now()
	s.cacheMu.Unlock()
	return fs
}

func NewServer(client *TransmissionClient, feedManager *FeedManager) *Server {
	return &Server{
		client:      client,
		feedManager: feedManager,
	}
}

// newFrontendHandler serves the embedded, pre-built frontend/dist SPA. Since
// the app is a single page with no client-side routing, any unrecognized
// non-file path falls back to index.html instead of 404ing.
func newFrontendHandler() (http.Handler, error) {
	dist, err := fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		return nil, err
	}
	fileServer := http.FileServer(http.FS(dist))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := fs.Stat(dist, strings.TrimPrefix(r.URL.Path, "/")); err != nil {
			r = r.Clone(r.Context())
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	}), nil
}

func (s *Server) handleAPI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	torrents, err := s.client.GetTorrents()
	if err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	stats, err := s.client.GetSessionStats()
	if err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"torrents": torrents,
		"stats":    stats,
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

// handleStream pushes torrent + session state to the client over Server-Sent
// Events, once a second, so the UI updates live instead of polling.
func (s *Server) handleStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // don't let a proxy buffer the stream

	// The server sets a 15s WriteTimeout for normal handlers; clear the write
	// deadline on this connection so the long-lived stream isn't cut off.
	if err := http.NewResponseController(w).SetWriteDeadline(time.Time{}); err != nil {
		log.Printf("stream: could not clear write deadline: %v", err)
	}

	ctx := r.Context()
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		torrents, err := s.client.GetTorrents()
		if err != nil {
			log.Printf("stream: get torrents: %v", err)
		} else if stats, statsErr := s.client.GetSessionStats(); statsErr != nil {
			log.Printf("stream: get session stats: %v", statsErr)
		} else if payload, mErr := json.Marshal(map[string]interface{}{
			"torrents": torrents,
			"stats":    stats,
		}); mErr != nil {
			log.Printf("stream: marshal payload: %v", mErr)
		} else if _, wErr := fmt.Fprintf(w, "data: %s\n\n", payload); wErr != nil {
			return // client disconnected
		} else {
			flusher.Flush()
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Server) handleAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the form so we can read every uploaded .torrent file (the picker
	// allows selecting more than one); up to 32 MiB is buffered in memory.
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Check for one or more uploaded .torrent files.
	if r.MultipartForm != nil && len(r.MultipartForm.File["torrent-file"]) > 0 {
		var added, failed int
		for _, fh := range r.MultipartForm.File["torrent-file"] {
			data, err := func() ([]byte, error) {
				f, err := fh.Open()
				if err != nil {
					return nil, err
				}
				defer f.Close()
				return io.ReadAll(f)
			}()
			if err != nil {
				log.Printf("add: read %q: %v", fh.Filename, err)
				failed++
				continue
			}
			if err := s.client.AddTorrent("", data); err != nil {
				log.Printf("add: %q: %v", fh.Filename, err)
				failed++
				continue
			}
			added++
		}
		if added == 0 {
			http.Error(w, "Failed to add any torrent files", http.StatusInternalServerError)
			return
		}
		log.Printf("add: %d torrent file(s) added, %d failed", added, failed)
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}

	// Check for magnet link
	magnet := r.FormValue("magnet")
	if magnet != "" {
		if err := s.client.AddTorrent(magnet, nil); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}

	http.Error(w, "No torrent provided", http.StatusBadRequest)
}

func (s *Server) handleAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Action     string  `json:"action"`
		ID         int     `json:"id"`
		DeleteData bool    `json:"deleteData"`
		Ratio      float64 `json:"ratio"`
		RatioMode  int     `json:"ratioMode"`
		Enabled    bool    `json:"enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var err error
	switch req.Action {
	case "start":
		err = s.client.StartTorrent(req.ID)
	case "stop":
		err = s.client.StopTorrent(req.ID)
	case "remove":
		err = s.client.RemoveTorrent(req.ID, req.DeleteData)
	case "reannounce":
		err = s.client.ReannounceTorrent(req.ID)
	case "reannounce-all":
		err = s.client.ReannounceAll()
	case "set-ratio":
		err = s.client.SetSeedRatio(req.ID, req.Ratio, req.RatioMode)
	case "set-global-ratio":
		err = s.client.SetGlobalSeedRatio(req.Ratio, req.Enabled)
	default:
		http.Error(w, "Unknown action", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}
	if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handlePeers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		if err := json.NewEncoder(w).Encode(map[string]string{"error": "missing id parameter"}); err != nil {
			log.Printf("Failed to encode error response: %v", err)
		}
		return
	}

	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": "invalid id"}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	peers, err := s.client.GetPeers(id)
	if err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"peers": peers,
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handleTrackers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		if err := json.NewEncoder(w).Encode(map[string]string{"error": "missing id parameter"}); err != nil {
			log.Printf("Failed to encode error response: %v", err)
		}
		return
	}

	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": "invalid id"}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	trackers, err := s.client.GetTrackers(id)
	if err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"trackers": trackers,
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handleFiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		if err := json.NewEncoder(w).Encode(map[string]string{"error": "missing id parameter"}); err != nil {
			log.Printf("Failed to encode error response: %v", err)
		}
		return
	}

	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": "invalid id"}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	files, err := s.client.GetFiles(id)
	if err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"files": files,
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handleSetFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID      int   `json:"id"`
		Indices []int `json:"indices"`
		Wanted  bool  `json:"wanted"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(req.Indices) == 0 {
		http.Error(w, "no files selected", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := s.client.SetFilesWanted(req.ID, req.Indices, req.Wanted); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}
	if err := json.NewEncoder(w).Encode(map[string]bool{"ok": true}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

// handleStats returns a full daemon-wide statistics breakdown (session-stats +
// session-get) for the stats panel.
func (s *Server) handleStats(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	stats, err := s.client.GetSessionStats()
	if err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	info, err := s.client.GetSessionInfo()
	if err != nil {
		log.Printf("stats: session info: %v", err) // non-fatal — still return transfer stats
	}

	// portOpen and freeSpace are cached (60s TTL) — fetch them off the hot path.
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"stats":     stats,
		"info":      info,
		"version":   Version,
		"freeSpace": s.cachedFreeSpace(),
		"portOpen":  s.cachedPortOpen(),
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handleGetFeeds(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	feeds, err := s.feedManager.GetFeeds()
	if err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"feeds": feeds,
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handleAddFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var feed Feed
	if err := json.NewDecoder(r.Body).Decode(&feed); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := s.feedManager.AddFeed(&feed); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := json.NewEncoder(w).Encode(feed); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handleUpdateFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var feed Feed
	if err := json.NewDecoder(r.Body).Decode(&feed); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := s.feedManager.UpdateFeed(&feed); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handleDeleteFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		if err := json.NewEncoder(w).Encode(map[string]string{"error": "missing id parameter"}); err != nil {
			log.Printf("Failed to encode error response: %v", err)
		}
		return
	}

	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": "invalid id"}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := s.feedManager.DeleteFeed(id); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handleCheckFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		if err := json.NewEncoder(w).Encode(map[string]string{"error": "missing id parameter"}); err != nil {
			log.Printf("Failed to encode error response: %v", err)
		}
		return
	}

	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": "invalid id"}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	// Check feed in a goroutine to not block the HTTP response
	go func() {
		if err := s.feedManager.CheckFeed(id); err != nil {
			log.Printf("Error checking feed: %v", err)
		}
	}()

	if err := json.NewEncoder(w).Encode(map[string]string{"status": "checking"}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handleFeedHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		if err := json.NewEncoder(w).Encode(map[string]string{"error": "missing id parameter"}); err != nil {
			log.Printf("Failed to encode error response: %v", err)
		}
		return
	}

	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": "invalid id"}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	items, err := s.feedManager.GetDownloadedItems(id, 100)
	if err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"items": items,
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func (s *Server) handleFeedCheckLogs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		if err := json.NewEncoder(w).Encode(map[string]string{"error": "missing id parameter"}); err != nil {
			log.Printf("Failed to encode error response: %v", err)
		}
		return
	}

	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": "invalid id"}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	logs, err := s.feedManager.GetFeedCheckLogs(id, 20)
	if err != nil {
		if encErr := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); encErr != nil {
			log.Printf("Failed to encode error response: %v", encErr)
		}
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"logs": logs,
	}); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func main() {
	config := Config{
		TransmissionURL:  getEnv("TRANSMISSION_URL", "http://192.168.86.61:9091/transmission/rpc"),
		TransmissionUser: getEnv("TRANSMISSION_USER", "transmission"),
		TransmissionPass: getEnv("TRANSMISSION_PASS", ""),
		ListenAddr:       getEnv("LISTEN_ADDR", ":8080"),
	}

	client := NewTransmissionClient(config.TransmissionURL, config.TransmissionUser, config.TransmissionPass)

	// Initialize RSS feed manager
	dbPath := getEnv("DB_PATH", "./feeds.db")
	feedManager, err := NewFeedManager(dbPath, client)
	if err != nil {
		log.Fatalf("Failed to create feed manager: %v", err)
	}

	server := NewServer(client, feedManager)

	frontend, err := newFrontendHandler()
	if err != nil {
		if closeErr := feedManager.Close(); closeErr != nil {
			log.Printf("Failed to close feed manager: %v", closeErr)
		}
		log.Fatalf("Failed to load embedded frontend: %v", err)
	}

	gz := gzipHandler

	http.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	http.Handle("/", gz(frontend))
	http.Handle("/api/torrents", gz(http.HandlerFunc(server.handleAPI)))
	http.Handle("/api/peers", gz(http.HandlerFunc(server.handlePeers)))
	http.Handle("/api/trackers", gz(http.HandlerFunc(server.handleTrackers)))
	http.Handle("/api/files", gz(http.HandlerFunc(server.handleFiles)))
	http.Handle("/api/files/set", gz(http.HandlerFunc(server.handleSetFiles)))
	http.Handle("/api/stats", gz(http.HandlerFunc(server.handleStats)))
	http.HandleFunc("/api/stream", server.handleStream) // SSE — no gzip
	http.Handle("/api/add", gz(http.HandlerFunc(server.handleAdd)))
	http.Handle("/api/action", gz(http.HandlerFunc(server.handleAction)))

	// RSS feed endpoints
	http.Handle("/api/feeds", gz(http.HandlerFunc(server.handleGetFeeds)))
	http.Handle("/api/feeds/add", gz(http.HandlerFunc(server.handleAddFeed)))
	http.Handle("/api/feeds/update", gz(http.HandlerFunc(server.handleUpdateFeed)))
	http.Handle("/api/feeds/delete", gz(http.HandlerFunc(server.handleDeleteFeed)))
	http.Handle("/api/feeds/check", gz(http.HandlerFunc(server.handleCheckFeed)))
	http.Handle("/api/feeds/history", gz(http.HandlerFunc(server.handleFeedHistory)))
	http.Handle("/api/feeds/logs", gz(http.HandlerFunc(server.handleFeedCheckLogs)))

	log.Printf("Starting server on %s", config.ListenAddr)
	log.Printf("Connecting to Transmission at %s", config.TransmissionURL)
	log.Printf("RSS feed database: %s", dbPath)

	// Create HTTP server with timeouts for security
	srv := &http.Server{
		Addr:              config.ListenAddr,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Start RSS feed polling after server is configured and ready to serve
	feedManager.Start()

	if err := srv.ListenAndServe(); err != nil {
		if closeErr := feedManager.Close(); closeErr != nil {
			log.Printf("Failed to close feed manager: %v", closeErr)
		}
		log.Fatalf("Server failed: %v", err)
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// isClientDisconnectError checks if an error is due to client disconnecting
type gzipWriter struct {
	http.ResponseWriter
	w *gzip.Writer
}

func (g *gzipWriter) Write(b []byte) (int, error) { return g.w.Write(b) }

// gzipHandler compresses responses for clients that accept gzip.
// Skips SSE streams (text/event-stream) which must not be buffered.
func gzipHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		gz, err := gzip.NewWriterLevel(w, gzip.BestSpeed)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}
		defer gz.Close()
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Del("Content-Length")
		next.ServeHTTP(&gzipWriter{ResponseWriter: w, w: gz}, r)
	})
}
