package main

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// fakeTransmission is a stand-in Transmission RPC endpoint. It enforces the
// session-id handshake, records each RPC call, and answers with the arguments
// registered for that method (or a canned "success" with no arguments).
type fakeTransmission struct {
	t         *testing.T
	sessionID string
	result    string // overrides "success" when set
	replies   map[string]any

	mu    sync.Mutex
	calls []RPCRequest
	auth  string
}

func newFakeTransmission(t *testing.T) (*fakeTransmission, *TransmissionClient) {
	t.Helper()
	f := &fakeTransmission{t: t, sessionID: "sid-1", replies: map[string]any{}}
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	return f, NewTransmissionClient(srv.URL, "user", "pass")
}

func (f *fakeTransmission) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("X-Transmission-Session-Id") != f.sessionID {
		w.Header().Set("X-Transmission-Session-Id", f.sessionID)
		w.WriteHeader(http.StatusConflict)
		return
	}

	var req struct {
		Method    string         `json:"method"`
		Arguments map[string]any `json:"arguments"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		f.t.Errorf("fake transmission: bad request body: %v", err)
		return
	}

	f.mu.Lock()
	f.calls = append(f.calls, RPCRequest{Method: req.Method, Arguments: req.Arguments})
	f.auth = r.Header.Get("Authorization")
	f.mu.Unlock()

	result := "success"
	if f.result != "" {
		result = f.result
	}
	args, err := json.Marshal(f.replies[req.Method])
	if err != nil {
		f.t.Errorf("fake transmission: marshal reply: %v", err)
	}
	if err := json.NewEncoder(w).Encode(map[string]any{"result": result, "arguments": json.RawMessage(args)}); err != nil {
		f.t.Errorf("fake transmission: encode reply: %v", err)
	}
}

func (f *fakeTransmission) lastCall(t *testing.T) RPCRequest {
	t.Helper()
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.calls) == 0 {
		t.Fatal("expected an RPC call, got none")
	}
	return f.calls[len(f.calls)-1]
}

func (f *fakeTransmission) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}

func TestDoRequestNegotiatesSessionID(t *testing.T) {
	f, client := newFakeTransmission(t)

	if err := client.StartTorrent(1); err != nil {
		t.Fatalf("StartTorrent: %v", err)
	}
	if got := f.callCount(); got != 1 {
		t.Fatalf("calls after handshake = %d, want 1", got)
	}
	wantAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte("user:pass"))
	if f.auth != wantAuth {
		t.Errorf("Authorization = %q, want %q", f.auth, wantAuth)
	}

	// Transmission rotates the session id; the client should pick up the new one.
	f.sessionID = "sid-2"
	if err := client.StopTorrent(1); err != nil {
		t.Fatalf("StopTorrent after rotation: %v", err)
	}
	if got := f.lastCall(t).Method; got != "torrent-stop" {
		t.Errorf("method = %q, want torrent-stop", got)
	}
}

func TestDoRequestReportsRPCError(t *testing.T) {
	f, client := newFakeTransmission(t)
	f.result = "invalid or corrupt torrent file"

	err := client.AddTorrent("magnet:?xt=urn:btih:abc", nil)
	if err == nil || !strings.Contains(err.Error(), "invalid or corrupt torrent file") {
		t.Fatalf("err = %v, want RPC error containing the result string", err)
	}
}

func TestDoRequestGivesUpOnRepeatedConflict(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusConflict) // never hands out a session id
	}))
	t.Cleanup(srv.Close)

	err := NewTransmissionClient(srv.URL, "", "").StartTorrent(1)
	if err == nil || !strings.Contains(err.Error(), "session ID negotiation failed") {
		t.Fatalf("err = %v, want session negotiation failure", err)
	}
}

func TestGetFilesZipsWantedFlags(t *testing.T) {
	f, client := newFakeTransmission(t)
	f.replies["torrent-get"] = map[string]any{"torrents": []any{map[string]any{
		"files": []any{
			map[string]any{"name": "a.mkv", "length": 100, "bytesCompleted": 50},
			map[string]any{"name": "b.srt", "length": 10, "bytesCompleted": 0},
			map[string]any{"name": "c.nfo", "length": 1, "bytesCompleted": 1},
		},
		// Shorter than files: missing entries default to wanted.
		"fileStats": []any{map[string]any{"wanted": true}, map[string]any{"wanted": false}},
	}}}

	files, err := client.GetFiles(7)
	if err != nil {
		t.Fatalf("GetFiles: %v", err)
	}
	want := []File{
		{Index: 0, Name: "a.mkv", Length: 100, BytesCompleted: 50, Wanted: true},
		{Index: 1, Name: "b.srt", Length: 10, BytesCompleted: 0, Wanted: false},
		{Index: 2, Name: "c.nfo", Length: 1, BytesCompleted: 1, Wanted: true},
	}
	if !reflect.DeepEqual(files, want) {
		t.Errorf("files = %+v, want %+v", files, want)
	}
}

func TestHandleActionMapsToRPC(t *testing.T) {
	tests := []struct {
		body       string
		wantMethod string
		wantArgs   map[string]any
	}{
		{`{"action":"start","id":3}`, "torrent-start", map[string]any{"ids": []any{3.0}}},
		{`{"action":"stop","id":3}`, "torrent-stop", map[string]any{"ids": []any{3.0}}},
		{`{"action":"reannounce","id":3}`, "torrent-reannounce", map[string]any{"ids": []any{3.0}}},
		{`{"action":"reannounce-all"}`, "torrent-reannounce", nil},
		{
			`{"action":"remove","id":3,"deleteData":true}`, "torrent-remove",
			map[string]any{"ids": []any{3.0}, "delete-local-data": true},
		},
		{
			`{"action":"set-ratio","id":3,"ratio":1.5,"ratioMode":1}`, "torrent-set",
			map[string]any{"ids": []any{3.0}, "seedRatioLimit": 1.5, "seedRatioMode": 1.0},
		},
		{
			`{"action":"set-global-ratio","ratio":2,"enabled":true}`, "session-set",
			map[string]any{"seedRatioLimit": 2.0, "seedRatioLimited": true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.body, func(t *testing.T) {
			f, client := newFakeTransmission(t)
			rec := httptest.NewRecorder()
			NewServer(client).handleAction(rec, httptest.NewRequest(http.MethodPost, "/api/action", strings.NewReader(tt.body)))

			if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"status":"ok"`) {
				t.Fatalf("response = %d %s, want 200 status ok", rec.Code, rec.Body.String())
			}
			call := f.lastCall(t)
			if call.Method != tt.wantMethod {
				t.Errorf("method = %q, want %q", call.Method, tt.wantMethod)
			}
			gotArgs, _ := call.Arguments.(map[string]any)
			if tt.wantArgs == nil && gotArgs == nil {
				return
			}
			if !reflect.DeepEqual(gotArgs, tt.wantArgs) {
				t.Errorf("args = %v, want %v", gotArgs, tt.wantArgs)
			}
		})
	}
}

func TestHandleActionRejectsBadRequests(t *testing.T) {
	tests := []struct {
		name   string
		method string
		body   string
		want   int
	}{
		{"wrong method", http.MethodGet, "", http.StatusMethodNotAllowed},
		{"invalid json", http.MethodPost, "{", http.StatusBadRequest},
		{"unknown action", http.MethodPost, `{"action":"explode"}`, http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f, client := newFakeTransmission(t)
			rec := httptest.NewRecorder()
			NewServer(client).handleAction(rec, httptest.NewRequest(tt.method, "/api/action", strings.NewReader(tt.body)))
			if rec.Code != tt.want {
				t.Errorf("status = %d, want %d", rec.Code, tt.want)
			}
			if n := f.callCount(); n != 0 {
				t.Errorf("RPC calls = %d, want 0", n)
			}
		})
	}
}

func TestHandleActionReportsRPCFailure(t *testing.T) {
	f, client := newFakeTransmission(t)
	f.result = "torrent not found"

	rec := httptest.NewRecorder()
	NewServer(client).handleAction(rec, httptest.NewRequest(http.MethodPost, "/api/action", strings.NewReader(`{"action":"start","id":9}`)))

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !strings.Contains(body["error"], "torrent not found") {
		t.Errorf("error = %q, want it to mention the RPC result", body["error"])
	}
}

func multipartBody(t *testing.T, fields map[string]string, files map[string][]byte) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for k, v := range fields {
		if err := mw.WriteField(k, v); err != nil {
			t.Fatal(err)
		}
	}
	for name, data := range files {
		fw, err := mw.CreateFormFile("torrent-file", name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := fw.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	return &buf, mw.FormDataContentType()
}

func TestHandleAddMagnet(t *testing.T) {
	f, client := newFakeTransmission(t)
	body, ctype := multipartBody(t, map[string]string{"magnet": "magnet:?xt=urn:btih:abc"}, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/add", body)
	req.Header.Set("Content-Type", ctype)

	rec := httptest.NewRecorder()
	NewServer(client).handleAdd(rec, req)

	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, want 303", rec.Code)
	}
	call := f.lastCall(t)
	args, _ := call.Arguments.(map[string]any)
	if call.Method != "torrent-add" || args["filename"] != "magnet:?xt=urn:btih:abc" {
		t.Errorf("call = %+v, want torrent-add with the magnet as filename", call)
	}
}

func TestHandleAddTorrentFiles(t *testing.T) {
	f, client := newFakeTransmission(t)
	files := map[string][]byte{"a.torrent": []byte("d4:infoe"), "b.torrent": []byte("d4:infoi1ee")}
	body, ctype := multipartBody(t, nil, files)
	req := httptest.NewRequest(http.MethodPost, "/api/add", body)
	req.Header.Set("Content-Type", ctype)

	rec := httptest.NewRecorder()
	NewServer(client).handleAdd(rec, req)

	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, want 303", rec.Code)
	}
	got := map[string]bool{}
	for _, c := range f.calls {
		args, _ := c.Arguments.(map[string]any)
		meta, _ := args["metainfo"].(string)
		got[meta] = true
	}
	for _, data := range files {
		if enc := base64.StdEncoding.EncodeToString(data); !got[enc] {
			t.Errorf("no torrent-add with metainfo %q; calls: %+v", enc, f.calls)
		}
	}
}

func TestHandleAddRejectsEmptyAndFailedUploads(t *testing.T) {
	t.Run("nothing provided", func(t *testing.T) {
		_, client := newFakeTransmission(t)
		body, ctype := multipartBody(t, nil, nil)
		req := httptest.NewRequest(http.MethodPost, "/api/add", body)
		req.Header.Set("Content-Type", ctype)
		rec := httptest.NewRecorder()
		NewServer(client).handleAdd(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", rec.Code)
		}
	})

	t.Run("every file rejected", func(t *testing.T) {
		f, client := newFakeTransmission(t)
		f.result = "invalid or corrupt torrent file"
		body, ctype := multipartBody(t, nil, map[string][]byte{"bad.torrent": []byte("x")})
		req := httptest.NewRequest(http.MethodPost, "/api/add", body)
		req.Header.Set("Content-Type", ctype)
		rec := httptest.NewRecorder()
		NewServer(client).handleAdd(rec, req)
		if rec.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want 500", rec.Code)
		}
	})
}

func TestHandleSetFiles(t *testing.T) {
	f, client := newFakeTransmission(t)
	rec := httptest.NewRecorder()
	NewServer(client).handleSetFiles(rec, httptest.NewRequest(http.MethodPost, "/api/files/set",
		strings.NewReader(`{"id":4,"indices":[0,2],"wanted":false}`)))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	call := f.lastCall(t)
	want := map[string]any{"ids": []any{4.0}, "files-unwanted": []any{0.0, 2.0}}
	if call.Method != "torrent-set" || !reflect.DeepEqual(call.Arguments, want) {
		t.Errorf("call = %s %v, want torrent-set %v", call.Method, call.Arguments, want)
	}

	rec = httptest.NewRecorder()
	NewServer(client).handleSetFiles(rec, httptest.NewRequest(http.MethodPost, "/api/files/set",
		strings.NewReader(`{"id":4,"indices":[],"wanted":true}`)))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("empty indices: status = %d, want 400", rec.Code)
	}
}

func TestDetailHandlersValidateID(t *testing.T) {
	_, client := newFakeTransmission(t)
	s := NewServer(client)
	handlers := map[string]http.HandlerFunc{"peers": s.handlePeers, "trackers": s.handleTrackers, "files": s.handleFiles}

	for name, h := range handlers {
		for query, wantErr := range map[string]string{"": "missing id parameter", "?id=abc": "invalid id"} {
			rec := httptest.NewRecorder()
			h(rec, httptest.NewRequest(http.MethodGet, "/api/"+name+query, nil))
			if !strings.Contains(rec.Body.String(), wantErr) {
				t.Errorf("%s%s: body = %s, want error %q", name, query, rec.Body.String(), wantErr)
			}
		}
	}
}

func TestFrontendHandlerFallsBackToIndex(t *testing.T) {
	h, err := newFrontendHandler()
	if err != nil {
		t.Fatalf("newFrontendHandler: %v (build the frontend first)", err)
	}

	for _, path := range []string{"/", "/some/client/route"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "<div id=\"root\">") {
			t.Errorf("%s: status %d, want index.html", path, rec.Code)
		}
	}

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/favicon.svg", nil))
	if !strings.Contains(rec.Header().Get("Content-Type"), "svg") {
		t.Errorf("favicon Content-Type = %q, want an svg type", rec.Header().Get("Content-Type"))
	}
}

func TestFrontendHandlerCachesHashedAssets(t *testing.T) {
	h, err := newFrontendHandler()
	if err != nil {
		t.Fatalf("newFrontendHandler: %v (build the frontend first)", err)
	}
	assets, err := fs.ReadDir(frontendFS, "frontend/dist/assets")
	if err != nil || len(assets) == 0 {
		t.Fatalf("no built assets to test against: %v", err)
	}

	cacheControl := func(path string) string {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec.Header().Get("Cache-Control")
	}

	if got := cacheControl("/assets/" + assets[0].Name()); !strings.Contains(got, "immutable") {
		t.Errorf("hashed asset Cache-Control = %q, want immutable", got)
	}
	// index.html and SPA fallbacks must stay revalidated so new releases load.
	for _, path := range []string{"/", "/some/client/route", "/assets/missing.js"} {
		if got := cacheControl(path); got != "" {
			t.Errorf("%s Cache-Control = %q, want none", path, got)
		}
	}
}

func TestGzipHandler(t *testing.T) {
	const payload = `{"hello":"world"}`
	h := gzipHandler(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, payload)
	}))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept-Encoding", "gzip, deflate")
	h.ServeHTTP(rec, req)

	if rec.Header().Get("Content-Encoding") != "gzip" {
		t.Fatalf("Content-Encoding = %q, want gzip", rec.Header().Get("Content-Encoding"))
	}
	zr, err := gzip.NewReader(rec.Body)
	if err != nil {
		t.Fatalf("gzip reader: %v", err)
	}
	got, _ := io.ReadAll(zr)
	if string(got) != payload {
		t.Errorf("decompressed = %q, want %q", got, payload)
	}

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Header().Get("Content-Encoding") != "" || rec.Body.String() != payload {
		t.Errorf("without Accept-Encoding: encoding %q body %q, want plain payload", rec.Header().Get("Content-Encoding"), rec.Body.String())
	}
}

func recvEvent(t *testing.T, ch <-chan []byte) string {
	t.Helper()
	select {
	case event := <-ch:
		return string(event)
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for a stream event")
		return ""
	}
}

func TestStreamHubSharesOnePollAcrossSubscribers(t *testing.T) {
	release := make(chan struct{})
	var polls atomic.Int32
	hub := newStreamHub(func() []byte {
		<-release
		return []byte(fmt.Sprintf("event %d", polls.Add(1)))
	}, 0)

	a, unsubA := hub.subscribe()
	b, unsubB := hub.subscribe()
	for i := 1; i <= 3; i++ {
		release <- struct{}{}
		want := fmt.Sprintf("event %d", i)
		if got := recvEvent(t, a); got != want {
			t.Errorf("subscriber a got %q, want %q", got, want)
		}
		if got := recvEvent(t, b); got != want {
			t.Errorf("subscriber b got %q, want %q", got, want)
		}
	}
	if got := polls.Load(); got != 3 {
		t.Errorf("polls = %d for two subscribers over 3 events, want 3", got)
	}

	// A late subscriber is greeted with the latest event, without a new poll.
	c, unsubC := hub.subscribe()
	if got := recvEvent(t, c); got != "event 3" {
		t.Errorf("late subscriber got %q, want event 3", got)
	}

	// With nobody subscribed the hub stops after its in-flight poll.
	unsubA()
	unsubB()
	unsubC()
	release <- struct{}{}
	deadline := time.Now().Add(2 * time.Second)
	for {
		hub.mu.Lock()
		running, latest := hub.running, hub.latest
		hub.mu.Unlock()
		if !running {
			if latest != nil {
				t.Errorf("stopped hub kept latest = %q, want nil", latest)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("hub still running with no subscribers")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

type streamTestPayload struct {
	Torrents []Torrent `json:"torrents"`
	Error    string    `json:"error"`
}

// firstStreamData opens /api/stream and returns the JSON of its first event.
func firstStreamData(t *testing.T, s *Server) string {
	t.Helper()
	s.stream.interval = 10 * time.Millisecond
	srv := httptest.NewServer(http.HandlerFunc(s.handleStream))
	t.Cleanup(srv.Close)

	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, srv.URL, nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET stream: %v", err)
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Errorf("Content-Type = %q, want text/event-stream", ct)
	}
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(nil, 1<<20)
	for sc.Scan() {
		if data, ok := strings.CutPrefix(sc.Text(), "data: "); ok {
			return data
		}
	}
	t.Fatalf("stream ended without a data line: %v", sc.Err())
	return ""
}

func TestHandleStreamSendsTorrents(t *testing.T) {
	f, client := newFakeTransmission(t)
	f.replies["torrent-get"] = map[string]any{"torrents": []map[string]any{{"id": 7, "name": "ubuntu.iso"}}}

	var got streamTestPayload
	if err := json.Unmarshal([]byte(firstStreamData(t, NewServer(client))), &got); err != nil {
		t.Fatalf("decode event: %v", err)
	}
	if len(got.Torrents) != 1 || got.Torrents[0].Name != "ubuntu.iso" || got.Error != "" {
		t.Errorf("event = %+v, want one torrent named ubuntu.iso and no error", got)
	}
}

func TestHandleStreamReportsTransmissionErrors(t *testing.T) {
	f, client := newFakeTransmission(t)
	f.result = "daemon on fire"

	var got streamTestPayload
	if err := json.Unmarshal([]byte(firstStreamData(t, NewServer(client))), &got); err != nil {
		t.Fatalf("decode event: %v", err)
	}
	if !strings.Contains(got.Error, "daemon on fire") {
		t.Errorf("error = %q, want the RPC failure", got.Error)
	}
}
