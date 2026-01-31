package main

import (
	"embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

//go:embed templates/*
var templatesFS embed.FS

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
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	Status         int     `json:"status"`
	PercentDone    float64 `json:"percentDone"`
	RateDownload   int64   `json:"rateDownload"`
	RateUpload     int64   `json:"rateUpload"`
	UploadRatio    float64 `json:"uploadRatio"`
	TotalSize      int64   `json:"totalSize"`
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
	ActiveTorrentCount int   `json:"activeTorrentCount"`
	PausedTorrentCount int   `json:"pausedTorrentCount"`
	TorrentCount       int   `json:"torrentCount"`
	DownloadSpeed      int64 `json:"downloadSpeed"`
	UploadSpeed        int64 `json:"uploadSpeed"`
	CumulativeStats    struct {
		UploadedBytes   int64 `json:"uploadedBytes"`
		DownloadedBytes int64 `json:"downloadedBytes"`
	} `json:"cumulative-stats"`
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
	c.mu.RLock()
	sessionID := c.sessionID
	c.mu.RUnlock()

	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequest("POST", c.url, strings.NewReader(string(body)))
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
	defer resp.Body.Close()

	// Handle 409 - need to get new session ID
	if resp.StatusCode == 409 {
		newSessionID := resp.Header.Get("X-Transmission-Session-Id")
		c.mu.Lock()
		c.sessionID = newSessionID
		c.mu.Unlock()
		return c.doRequest(req) // Retry with new session ID
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}

	var rpcResp RPCResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, err
	}

	if rpcResp.Result != "success" {
		return nil, fmt.Errorf("RPC error: %s", rpcResp.Result)
	}

	return &rpcResp, nil
}

func (c *TransmissionClient) GetTorrents() ([]Torrent, error) {
	req := &RPCRequest{
		Method: "torrent-get",
		Arguments: map[string]interface{}{
			"fields": []string{
				"id", "name", "status", "percentDone", "rateDownload", "rateUpload",
				"uploadRatio", "totalSize", "downloadedEver", "uploadedEver",
				"peersConnected", "eta", "error", "errorString", "addedDate",
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

func (c *TransmissionClient) AddTorrent(magnetOrURL string, torrentData []byte) error {
	args := make(map[string]interface{})

	if len(torrentData) > 0 {
		args["metainfo"] = base64.StdEncoding.EncodeToString(torrentData)
	} else if magnetOrURL != "" {
		args["filename"] = magnetOrURL
	} else {
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

// Template helper functions
var funcMap = template.FuncMap{
	"formatBytes": func(bytes int64) string {
		const unit = 1024
		if bytes < unit {
			return fmt.Sprintf("%d B", bytes)
		}
		div, exp := int64(unit), 0
		for n := bytes / unit; n >= unit; n /= unit {
			div *= unit
			exp++
		}
		return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
	},
	"formatSpeed": func(bytesPerSec int64) string {
		const unit = 1024
		if bytesPerSec < unit {
			return fmt.Sprintf("%d B/s", bytesPerSec)
		}
		div, exp := int64(unit), 0
		for n := bytesPerSec / unit; n >= unit; n /= unit {
			div *= unit
			exp++
		}
		return fmt.Sprintf("%.1f %cB/s", float64(bytesPerSec)/float64(div), "KMGTPE"[exp])
	},
	"formatPercent": func(pct float64) string {
		return fmt.Sprintf("%.1f%%", pct*100)
	},
	"formatRatio": func(ratio float64) string {
		if ratio < 0 {
			return "N/A"
		}
		return fmt.Sprintf("%.2f", ratio)
	},
	"formatETA": func(seconds int) string {
		if seconds < 0 {
			return "Unknown"
		}
		if seconds == 0 {
			return "Done"
		}
		hours := seconds / 3600
		minutes := (seconds % 3600) / 60
		secs := seconds % 60
		if hours > 0 {
			return fmt.Sprintf("%dh %dm", hours, minutes)
		}
		if minutes > 0 {
			return fmt.Sprintf("%dm %ds", minutes, secs)
		}
		return fmt.Sprintf("%ds", secs)
	},
	"statusText": func(status int) string {
		switch status {
		case 0:
			return "Stopped"
		case 1:
			return "Queued (check)"
		case 2:
			return "Checking"
		case 3:
			return "Queued (dl)"
		case 4:
			return "Downloading"
		case 5:
			return "Queued (seed)"
		case 6:
			return "Seeding"
		default:
			return "Unknown"
		}
	},
	"statusClass": func(status int) string {
		switch status {
		case 0:
			return "stopped"
		case 1, 2, 3, 5:
			return "queued"
		case 4:
			return "downloading"
		case 6:
			return "seeding"
		default:
			return ""
		}
	},
	"mul": func(a, b float64) float64 {
		return a * b
	},
	"divf": func(a, b float64) float64 {
		if b == 0 {
			return 0
		}
		return a / b
	},
	"float64": func(i int64) float64 {
		return float64(i)
	},
	"sub": func(a, b int64) int64 {
		return a - b
	},
	"ltBytes": func(a, b int64) bool {
		return a < b
	},
}

// Server holds the application state
type Server struct {
	client *TransmissionClient
	tmpl   *template.Template
}

func NewServer(client *TransmissionClient) (*Server, error) {
	tmpl, err := template.New("").Funcs(funcMap).ParseFS(templatesFS, "templates/*.html")
	if err != nil {
		return nil, err
	}

	return &Server{
		client: client,
		tmpl:   tmpl,
	}, nil
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	torrents, err := s.client.GetTorrents()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	stats, err := s.client.GetSessionStats()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	portOpen, _ := s.client.TestPort()
	freeSpace, _ := s.client.GetFreeSpace("/data/transmission")

	data := map[string]interface{}{
		"Torrents":  torrents,
		"Stats":     stats,
		"PortOpen":  portOpen,
		"FreeSpace": freeSpace,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.tmpl.ExecuteTemplate(w, "index.html", data); err != nil {
		log.Printf("Template error: %v", err)
	}
}

func (s *Server) handleAPI(w http.ResponseWriter, r *http.Request) {
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

func (s *Server) handleAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check for file upload
	file, _, err := r.FormFile("torrent-file")
	if err == nil {
		defer file.Close()
		data, err := io.ReadAll(file)
		if err != nil {
			http.Error(w, "Failed to read file", http.StatusBadRequest)
			return
		}
		if err := s.client.AddTorrent("", data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
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
		Action     string `json:"action"`
		ID         int    `json:"id"`
		DeleteData bool   `json:"deleteData"`
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

func main() {
	config := Config{
		TransmissionURL:  getEnv("TRANSMISSION_URL", "http://192.168.86.61:9091/transmission/rpc"),
		TransmissionUser: getEnv("TRANSMISSION_USER", "transmission"),
		TransmissionPass: getEnv("TRANSMISSION_PASS", ""),
		ListenAddr:       getEnv("LISTEN_ADDR", ":8080"),
	}

	client := NewTransmissionClient(config.TransmissionURL, config.TransmissionUser, config.TransmissionPass)

	server, err := NewServer(client)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	http.HandleFunc("/", server.handleIndex)
	http.HandleFunc("/api/torrents", server.handleAPI)
	http.HandleFunc("/api/peers", server.handlePeers)
	http.HandleFunc("/api/add", server.handleAdd)
	http.HandleFunc("/api/action", server.handleAction)

	log.Printf("Starting server on %s", config.ListenAddr)
	log.Printf("Connecting to Transmission at %s", config.TransmissionURL)

	// Create HTTP server with timeouts for security
	srv := &http.Server{
		Addr:              config.ListenAddr,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}

	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
