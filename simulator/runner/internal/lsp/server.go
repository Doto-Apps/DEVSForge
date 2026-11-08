// Package lsp hosts isolated, short-lived language-server workspaces. It never runs model code.
package lsp

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	adapters "devsforge-runner/integrations"

	"devsforge-shared/integrations"
	"github.com/gorilla/websocket"
)

type Request struct {
	WorkbenchID        string `json:"workbenchId,omitempty"`
	DocumentID         string `json:"documentId,omitempty"`
	UserID             string `json:"userId"`
	ModelID            string `json:"modelId,omitempty"`
	ModelName          string `json:"modelName"`
	Code               string `json:"code"`
	IntegrationID      string `json:"integrationId"`
	IntegrationVersion string `json:"integrationVersion"`
}
type Connection struct {
	ID              string   `json:"id"`
	Ticket          string   `json:"ticket"`
	AllowedCommands []string `json:"allowedCommands,omitempty"`
}
type Response struct {
	DocumentID   string       `json:"documentId"`
	Status       string       `json:"status"`
	ID           string       `json:"id"`
	DocumentURI  string       `json:"documentUri"`
	WorkspaceURI string       `json:"workspaceUri"`
	Language     string       `json:"language"`
	Servers      []Connection `json:"servers"`
}
type ticket struct {
	Value   string
	Expires time.Time
	Used    bool
}
type session struct {
	mu                        sync.Mutex
	id, user, dir, file, root string
	definition                integrations.Definition
	last                      time.Time
	created                   time.Time
	key, state                string
	admitted                  bool
	documents                 map[string]*document
	senders                   map[string]func([]byte) error
	initialized               map[string]bool
	retired                   map[string]bool
	tickets                   map[string]*ticket
	clients                   map[string]*websocket.Conn
	cancel                    context.CancelFunc
	ctx                       context.Context
}
type Manager struct {
	mu           sync.Mutex
	preparing    sync.Mutex
	javaStarting chan struct{}
	sessions     map[string]*session
	starting     chan struct{}
	max, javaMax int
	idle         time.Duration
	token        string
}

func number(name string, fallback int) int {
	n, _ := strconv.Atoi(os.Getenv(name))
	if n > 0 {
		return n
	}
	return fallback
}
func NewManager() (*Manager, error) {
	token := os.Getenv("LSP_INTERNAL_TOKEN")
	if len(token) < 24 {
		return nil, fmt.Errorf("LSP_INTERNAL_TOKEN must contain at least 24 characters")
	}
	m := &Manager{sessions: map[string]*session{}, starting: make(chan struct{}, number("LSP_MAX_INITIALIZATIONS", 2)), javaStarting: make(chan struct{}, 1), max: number("LSP_MAX_SESSIONS", 6), javaMax: number("LSP_MAX_JAVA_SESSIONS", 2), idle: time.Duration(number("LSP_IDLE_SECONDS", 900)) * time.Second, token: token}
	return m, nil
}
func randomID() string {
	var b [24]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b[:])
}
func fileURI(path string) string {
	return (&url.URL{Scheme: "file", Path: filepath.ToSlash(path)}).String()
}
func (m *Manager) Close(id string) {
	m.mu.Lock()
	s := m.sessions[id]
	delete(m.sessions, id)
	m.mu.Unlock()
	if s != nil {
		s.cancel()
		s.mu.Lock()
		for _, c := range s.clients {
			_ = c.Close()
		}
		s.mu.Unlock()
		_ = os.RemoveAll(s.root)
		slog.Info("LSP session closed", "session", s.id)
	}
}
func (m *Manager) sweep(ctx context.Context) {
	t := time.NewTicker(10 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			m.mu.Lock()
			ids := []string{}
			for id := range m.sessions {
				ids = append(ids, id)
			}
			m.mu.Unlock()
			for _, id := range ids {
				m.Close(id)
			}
			return
		case <-t.C:
			m.mu.Lock()
			ids := []string{}
			for id, s := range m.sessions {
				s.mu.Lock()
				expired := time.Since(s.last) > m.idle
				s.mu.Unlock()
				if expired {
					ids = append(ids, id)
				}
			}
			m.mu.Unlock()
			for _, id := range ids {
				m.Close(id)
			}
		}
	}
}
func (m *Manager) Create(req Request) (Response, error) {
	if req.UserID == "" || len(req.Code) > 1024*1024 || len(req.WorkbenchID) > 128 {
		return Response{}, fmt.Errorf("invalid session request")
	}
	d, err := integrations.Resolve(req.IntegrationID, req.IntegrationVersion, "")
	if err != nil {
		return Response{}, err
	}
	if !d.Capabilities.LSP {
		return Response{}, fmt.Errorf("LSP unavailable")
	}
	m.preparing.Lock()
	defer m.preparing.Unlock()
	key := ""
	if req.WorkbenchID != "" {
		key = req.UserID + "/" + req.WorkbenchID + "/" + d.ID + "/" + d.Version
	}
	m.mu.Lock()
	var existing *session
	for _, candidate := range m.sessions {
		if key != "" && candidate.key == key {
			existing = candidate
			break
		}
	}
	m.mu.Unlock()
	if existing != nil {
		doc, err := existing.attach(req)
		if err != nil {
			return Response{}, err
		}
		existing.mu.Lock()
		defer existing.mu.Unlock()
		existing.last = time.Now()
		return existing.response(doc), nil
	}
	m.mu.Lock()
	queued := len(m.sessions)
	m.mu.Unlock()
	if queued >= m.max+32 {
		return Response{}, fmt.Errorf("capacity: language service queue full")
	}
	root, err := os.MkdirTemp("", "devsforge-lsp-")
	if err != nil {
		return Response{}, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	s := &session{id: randomID(), key: key, user: req.UserID, root: root, definition: d, last: time.Now(), created: time.Now(), state: "queued", documents: map[string]*document{}, senders: map[string]func([]byte) error{}, initialized: map[string]bool{}, retired: map[string]bool{}, tickets: map[string]*ticket{}, clients: map[string]*websocket.Conn{}, ctx: ctx, cancel: cancel}
	doc, err := s.attach(req)
	if err != nil {
		cancel()
		_ = os.RemoveAll(root)
		return Response{}, err
	}
	for _, engine := range d.Servers {
		s.tickets[engine.ID] = &ticket{Value: randomID(), Expires: time.Now().Add(30 * time.Second)}
	}
	m.mu.Lock()
	m.sessions[s.id] = s
	m.mu.Unlock()
	admitted := m.acquire(s)
	if !admitted && req.WorkbenchID == "" {
		m.Close(s.id)
		return Response{}, fmt.Errorf("capacity: language service busy")
	}

	s.mu.Lock()
	result := s.response(doc)
	s.mu.Unlock()
	slog.Info("LSP workspace prepared", "session", s.id, "integration", d.ID, "duration", time.Since(s.created))
	return result, nil
}

// Under pressure, release only an idle workspace that frees the limiting resource.
func (m *Manager) acquire(s *session) bool {
	if m.admit(s) {
		return true
	}
	var victim string
	var oldest time.Time
	m.mu.Lock()
	active, java := 0, 0
	for _, other := range m.sessions {
		if other.admitted {
			active++
			if other.definition.Language == "java" {
				java++
			}
		}
	}
	javaFull := s.definition.Language == "java" && java >= m.javaMax
	if active >= m.max || javaFull {
		for id, other := range m.sessions {
			if id == s.id || !other.admitted || (javaFull && other.definition.Language != "java") {
				continue
			}
			other.mu.Lock()
			idle := len(other.documents) == 0 || time.Since(other.last) > time.Minute
			last := other.last
			other.mu.Unlock()
			if idle && (victim == "" || last.Before(oldest)) {
				victim = id
				oldest = last
			}
		}
	}
	m.mu.Unlock()
	if victim != "" {
		m.Close(victim)
	}
	return m.admit(s)
}

// Admission is atomic and FIFO; prepared documents do not consume process capacity.
func (m *Manager) admit(s *session) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sessions[s.id] != s {
		return false
	}
	if s.admitted {
		return true
	}
	active, java := 0, 0
	for _, other := range m.sessions {
		if other.admitted {
			active++
			if other.definition.Language == "java" {
				java++
			}
		}
	}
	if active >= m.max || (s.definition.Language == "java" && java >= m.javaMax) {
		return false
	}
	for _, other := range m.sessions {
		if !other.admitted && other.created.Before(s.created) && (other.definition.Language != "java" || java < m.javaMax) {
			return false
		}
	}
	s.admitted = true
	s.mu.Lock()
	s.state = "prepared"
	s.mu.Unlock()
	return true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func (m *Manager) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+m.token)) != 1 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if r.URL.Path == "/health" {
		m.mu.Lock()
		active := len(m.sessions)
		m.mu.Unlock()
		writeJSON(w, 200, map[string]any{"ready": true, "sessions": active, "maxSessions": m.max, "maxJavaSessions": m.javaMax})
		return
	}
	if r.URL.Path == "/sessions" && r.Method == http.MethodPost {
		var req Request
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2*1024*1024)).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		res, err := m.Create(req)
		if err != nil {
			status := 400
			if strings.HasPrefix(err.Error(), "capacity:") {
				status = 429
			}
			http.Error(w, err.Error(), status)
			return
		}
		writeJSON(w, 201, res)
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 2 || parts[0] != "sessions" {
		http.NotFound(w, r)
		return
	}
	m.mu.Lock()
	s := m.sessions[parts[1]]
	m.mu.Unlock()
	if s == nil || s.user != r.Header.Get("X-LSP-User") {
		http.NotFound(w, r)
		return
	}
	if len(parts) == 2 && r.Method == http.MethodGet {
		m.acquire(s)
		s.mu.Lock()
		writeJSON(w, 200, map[string]any{"id": s.id, "status": s.state, "documents": len(s.documents)})
		s.mu.Unlock()
		return
	}
	if len(parts) == 3 && parts[2] == "tickets" && r.Method == http.MethodPost {
		s.mu.Lock()
		for _, engine := range s.definition.Servers {
			if s.clients[engine.ID] == nil {
				s.tickets[engine.ID] = &ticket{Value: randomID(), Expires: time.Now().Add(30 * time.Second)}
			}
		}
		if len(s.documents) == 0 {
			s.mu.Unlock()
			http.Error(w, "workspace has no attached document", http.StatusConflict)
			return
		}
		for _, doc := range s.documents {
			writeJSON(w, 200, s.response(doc))
			break
		}
		s.mu.Unlock()
		return
	}
	if len(parts) == 4 && parts[2] == "documents" && r.Method == http.MethodDelete {
		if err := s.detach(parts[3]); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(204)
		return
	}
	if len(parts) == 2 && r.Method == http.MethodDelete {
		m.Close(s.id)
		w.WriteHeader(204)
		return
	}
	if len(parts) == 3 && parts[2] == "file" && r.Method == http.MethodGet {
		path, err := s.readablePath(r.URL.Query().Get("uri"))
		if err != nil {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		f, err := os.Open(path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer func() { _ = f.Close() }()
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = io.Copy(w, io.LimitReader(f, 2*1024*1024))
		return
	}
	if len(parts) == 4 && parts[2] == "ws" {
		m.connect(w, r, s, parts[3])
		return
	}
	http.NotFound(w, r)
}
func within(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
func (s *session) readablePath(uri string) (string, error) {
	u, err := url.Parse(uri)
	if err != nil || u.Scheme != "file" || u.Host != "" {
		return "", fmt.Errorf("invalid URI")
	}
	p, err := filepath.EvalSymlinks(u.Path)
	if err != nil {
		return "", err
	}
	library, _ := s.definition.Resource(s.definition.Wrapper)
	roots := []string{filepath.Join(s.root, "projects"), library, "/usr/local/go/src", "/opt/go-cache/mod", "/opt/lsp/pyright", "/opt/maven-cache"}
	for _, root := range roots {
		if within(root, p) {
			st, e := os.Stat(p)
			if e == nil && st.Mode().IsRegular() {
				return p, nil
			}
		}
	}
	return "", fmt.Errorf("outside workspace")
}
func (m *Manager) connect(w http.ResponseWriter, r *http.Request, s *session, engine string) {
	s.mu.Lock()
	t := s.tickets[engine]
	if t == nil || t.Used || time.Now().After(t.Expires) || subtle.ConstantTimeCompare([]byte(t.Value), []byte(r.URL.Query().Get("ticket"))) != 1 {
		s.mu.Unlock()
		http.Error(w, "expired ticket", http.StatusUnauthorized)
		return
	}
	t.Used = true
	s.mu.Unlock()
	conn, err := (&websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}).Upgrade(w, r, nil)
	if err != nil {
		return
	}
	s.mu.Lock()
	s.clients[engine] = conn
	s.mu.Unlock()
	defer m.Close(s.id)
	for !m.acquire(s) {
		select {
		case <-s.ctx.Done():
			return
		case <-time.After(200 * time.Millisecond):
		}
	}
	if s.definition.Language == "java" {
		select {
		case m.javaStarting <- struct{}{}:
		case <-s.ctx.Done():
			return
		}
	}
	var javaGate sync.Once
	releaseJava := func() {
		if s.definition.Language == "java" {
			javaGate.Do(func() { <-m.javaStarting })
		}
	}
	defer releaseJava()
	select {
	case m.starting <- struct{}{}:
	case <-s.ctx.Done():
		return
	}
	var initialization sync.Once
	releaseInitialization := func() { initialization.Do(func() { <-m.starting; releaseJava() }) }
	defer releaseInitialization()
	timer := time.AfterFunc(120*time.Second, func() { releaseInitialization(); m.Close(s.id) })
	defer timer.Stop()
	s.mu.Lock()
	s.state = "starting"
	s.mu.Unlock()
	var spec integrations.Server
	for _, e := range s.definition.Servers {
		if e.ID == engine {
			spec = e
		}
	}
	if spec.Command == "" {
		http.NotFound(w, r)
		return
	}
	conn.SetReadLimit(2 * 1024 * 1024)
	command := spec.Command
	args := append([]string{}, spec.Args...)
	for i := range args {
		args[i] = strings.ReplaceAll(strings.ReplaceAll(args[i], "{workspace}", s.dir), "{session}", s.root)
	}
	cmd := exec.CommandContext(s.ctx, command, args...)
	configureProcess(cmd)
	cmd.Dir = s.root
	cmd.Env = append(os.Environ(), "GOWORK=off", "GOTOOLCHAIN=local", "GOMEMLIMIT=256MiB", "NODE_OPTIONS=--max-old-space-size=256", "PYTHONPATH="+filepath.Join(s.root, "projects"))
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return
	}
	cmd.Stderr = os.Stderr
	if err = cmd.Start(); err != nil {
		slog.Warn("LSP launch failed", "engine", engine, "error", err)
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1011, "Language server unavailable"), time.Now().Add(time.Second))
		return
	}
	defer func() {
		_ = stdin.Close()
		if cmd.Process != nil {
			_ = terminateProcess(cmd)
		}
		_ = cmd.Wait()
	}()
	var pendingEdits sync.Map
	var outputMu sync.Mutex
	writeClient := func(data []byte) error {
		outputMu.Lock()
		defer outputMu.Unlock()
		return conn.WriteMessage(websocket.TextMessage, data)
	}
	var inputMu sync.Mutex
	send := func(data []byte) error {
		inputMu.Lock()
		defer inputMu.Unlock()
		_, err := fmt.Fprintf(stdin, "Content-Length: %d\r\n\r\n", len(data))
		if err == nil {
			_, err = stdin.Write(data)
		}
		return err
	}
	s.mu.Lock()
	s.senders[engine] = send
	s.mu.Unlock()
	done := make(chan error, 1)
	go func() {
		reader := bufio.NewReader(stdout)
		for {
			body, err := readFrame(reader)
			if err != nil {
				done <- err
				_ = conn.Close()
				return
			}
			var msg map[string]json.RawMessage
			if json.Unmarshal(body, &msg) == nil {
				if id, ok := msg["id"]; ok {
					if method, found := pendingEdits.LoadAndDelete(string(id)); found && len(msg["result"]) > 0 {
						msg["result"] = s.restrictResultEdits(method.(string), msg["result"])
						body, _ = json.Marshal(msg)
					}
				}
				var method string
				_ = json.Unmarshal(msg["method"], &method)
				if method == "workspace/configuration" {
					var params struct {
						Items []struct {
							Section string `json:"section"`
						} `json:"items"`
					}
					_ = json.Unmarshal(msg["params"], &params)
					values := make([]any, len(params.Items))
					for i, item := range params.Items {
						var value any = spec.Settings
						if item.Section != "" {
							for _, part := range strings.Split(item.Section, ".") {
								if object, ok := value.(map[string]any); ok {
									value = object[part]
								} else {
									value = nil
								}
							}
						}
						if value == nil {
							value = map[string]any{}
						}
						values[i] = value
					}
					reply, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": msg["id"], "result": values})
					if err = send(reply); err != nil {
						done <- err
						return
					}
					continue
				}
				if method == "workspace/applyEdit" && !s.writableEdit(msg["params"]) {
					reply, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": msg["id"], "result": map[string]any{"applied": false, "failureReason": "Only explicit editor actions may change the model"}})
					_ = send(reply)
					continue
				}
			}
			body = namespaceCommands(body, commandPrefix(s.id, engine))
			if err = writeClient(body); err != nil {
				done <- err
				return
			}
		}
	}()
	initialFolders := map[string]map[string]string{}
	for {
		_, body, err := conn.ReadMessage()
		if err != nil {
			return
		}
		var msg map[string]json.RawMessage
		if err = json.Unmarshal(body, &msg); err != nil {
			return
		}
		var method string
		_ = json.Unmarshal(msg["method"], &method)
		if !allowedClientMethod(method) {
			if id, ok := msg["id"]; ok {
				reply, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": id, "error": map[string]any{"code": -32601, "message": "Method unavailable in this editor"}})
				if err := writeClient(reply); err != nil {
					return
				}
			}
			continue
		}
		if method == "java/classFileContents" {
			var p struct {
				URI string `json:"uri"`
			}
			if json.Unmarshal(msg["params"], &p) != nil || !strings.HasPrefix(p.URI, "jdt:") {
				return
			}
		}
		if userInteraction(method) {
			s.mu.Lock()
			s.last = time.Now()
			s.mu.Unlock()
		}
		if method == "devsforge/userActivity" {
			continue
		}
		if method == "initialized" {
			s.mu.Lock()
			s.initialized[engine] = true
			added, removed := []map[string]string{}, []map[string]string{}
			for _, folder := range s.folders() {
				if initialFolders[folder["uri"]] == nil {
					added = append(added, folder)
				}
				delete(initialFolders, folder["uri"])
			}
			for _, folder := range initialFolders {
				removed = append(removed, folder)
			}
			all := true
			for _, spec := range s.definition.Servers {
				if !s.initialized[spec.ID] {
					all = false
				}
			}
			if all {
				s.state = "ready"
			}
			if err = send(body); err != nil {
				s.mu.Unlock()
				return
			}
			if len(added)+len(removed) > 0 {
				event, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "method": "workspace/didChangeWorkspaceFolders", "params": map[string]any{"event": map[string]any{"added": added, "removed": removed}}})
				if err = send(event); err != nil {
					s.mu.Unlock()
					return
				}
			}
			s.mu.Unlock()
			releaseInitialization()
			timer.Stop()
			slog.Info("LSP engine initialized", "session", s.id, "engine", engine, "pid", cmd.Process.Pid, "elapsed", time.Since(s.created))
			continue
		}
		if method == "initialize" {
			var p map[string]any
			_ = json.Unmarshal(msg["params"], &p)
			if p == nil {
				return
			}
			p["rootUri"] = fileURI(filepath.Join(s.root, "projects"))
			p["rootPath"] = filepath.Join(s.root, "projects")
			s.mu.Lock()
			folders := s.folders()
			p["workspaceFolders"] = folders
			folderURIs := []string{}
			for _, folder := range folders {
				initialFolders[folder["uri"]] = folder
				folderURIs = append(folderURIs, folder["uri"])
			}
			s.mu.Unlock()
			settings := spec.Settings
			if settings == nil {
				settings = map[string]any{}
			}
			p["initializationOptions"] = map[string]any{"settings": settings, "workspaceFolders": folderURIs, "extendedClientCapabilities": map[string]any{"classFileContentsSupport": true}}
			msg["params"], _ = json.Marshal(p)
			body, _ = json.Marshal(msg)
		}
		var execution struct {
			Command string `json:"command"`
		}
		if method == "workspace/executeCommand" {
			_ = json.Unmarshal(msg["params"], &execution)
			execution.Command = strings.TrimPrefix(execution.Command, commandPrefix(s.id, engine))
			var params map[string]json.RawMessage
			if json.Unmarshal(msg["params"], &params) != nil {
				return
			}
			params["command"], _ = json.Marshal(execution.Command)
			msg["params"], _ = json.Marshal(params)
			body, _ = json.Marshal(msg)
		}
		if method == "workspace/didChangeConfiguration" || (method == "workspace/executeCommand" && (!slices.Contains(spec.AllowedCommands, execution.Command) || !s.commandTargetsDocuments(msg["params"]))) || method == "workspace/didChangeWorkspaceFolders" || method == "workspace/didChangeWatchedFiles" {
			if id, ok := msg["id"]; ok {
				reply, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": id, "error": map[string]any{"code": -32601, "message": "Command unavailable in this editor"}})
				if err := writeClient(reply); err != nil {
					return
				}
			}
			continue
		}
		if strings.HasPrefix(method, "textDocument/") {
			var p struct {
				TextDocument struct {
					URI string `json:"uri"`
				} `json:"textDocument"`
			}
			_ = json.Unmarshal(msg["params"], &p)
			s.mu.Lock()
			editable := s.writable(p.TextDocument.URI)
			retired := s.retired[p.TextDocument.URI]
			s.mu.Unlock()
			if retired && !editable {
				if method == "textDocument/didClose" {
					if err = send(body); err != nil {
						return
					}
				} else if id, ok := msg["id"]; ok {
					reply, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": id, "error": map[string]any{"code": -32602, "message": "Document has been closed"}})
					if err = writeClient(reply); err != nil {
						return
					}
				}
				continue
			}
			if p.TextDocument.URI != "" && !editable {
				if strings.HasPrefix(method, "textDocument/did") || strings.Contains(method, "format") || method == "textDocument/rename" {
					return
				}
				if _, err := s.readablePath(p.TextDocument.URI); err != nil {
					return
				}
			}
		}
		if method == "textDocument/didOpen" || method == "textDocument/didChange" {
			if err = s.persistDocument(method, msg["params"]); err != nil {
				return
			}
		}
		if method == "textDocument/rename" || method == "textDocument/codeAction" || method == "codeAction/resolve" {
			if id, ok := msg["id"]; ok {
				pendingEdits.Store(string(id), method)
			}
		}
		if err = send(body); err != nil {
			return
		}
		select {
		case <-done:
			return
		default:
		}
	}
}

func readFrame(r *bufio.Reader) ([]byte, error) {
	length := -1
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimSpace(line)
		if line == "" {
			break
		}
		if strings.HasPrefix(strings.ToLower(line), "content-length:") {
			length, err = strconv.Atoi(strings.TrimSpace(strings.SplitN(line, ":", 2)[1]))
			if err != nil {
				return nil, err
			}
		}
	}
	if length < 0 || length > 4*1024*1024 {
		return nil, fmt.Errorf("invalid LSP frame")
	}
	b := make([]byte, length)
	_, err := io.ReadFull(r, b)
	return b, err
}
func Run(ctx context.Context) error {
	if err := adapters.Validate(); err != nil {
		return err
	}
	defs, err := integrations.List()
	if err != nil {
		return err
	}
	for _, d := range defs {
		for _, engine := range d.Servers {
			if _, err := exec.LookPath(engine.Command); err != nil {
				return fmt.Errorf("%s: missing language server %s: %w", d.ID, engine.ID, err)
			}
		}
	}
	m, err := NewManager()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	swept := make(chan struct{})
	go func() { defer close(swept); m.sweep(ctx) }()
	server := &http.Server{Addr: ":8090", Handler: m, ReadHeaderTimeout: 10 * time.Second}
	go func() { <-ctx.Done(); _ = server.Close() }()
	err = server.ListenAndServe()
	cancel()
	<-swept
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

// writableEdit accepts only edits to the current model and rejects file operations.
func writableEdit(raw json.RawMessage, uris ...string) bool {
	allowed := map[string]bool{}
	for _, uri := range uris {
		allowed[uri] = true
	}
	var params struct {
		Edit struct {
			Changes         map[string]json.RawMessage `json:"changes"`
			DocumentChanges []struct {
				Kind         string `json:"kind"`
				TextDocument struct {
					URI string `json:"uri"`
				} `json:"textDocument"`
			} `json:"documentChanges"`
		} `json:"edit"`
	}
	if json.Unmarshal(raw, &params) != nil {
		return false
	}
	for target := range params.Edit.Changes {
		if !allowed[target] {
			return false
		}
	}
	for _, change := range params.Edit.DocumentChanges {
		if change.Kind != "" || !allowed[change.TextDocument.URI] {
			return false
		}
	}
	return true
}

func commandTargetsModel(raw json.RawMessage, uris ...string) bool {
	allowed := map[string]bool{}
	for _, uri := range uris {
		allowed[uri] = true
	}
	var value any
	if json.Unmarshal(raw, &value) != nil {
		return false
	}
	var valid func(any) bool
	valid = func(value any) bool {
		switch v := value.(type) {
		case string:
			return !strings.HasPrefix(v, "file:") || allowed[v]
		case []any:
			for _, entry := range v {
				if !valid(entry) {
					return false
				}
			}
		case map[string]any:
			for _, entry := range v {
				if !valid(entry) {
					return false
				}
			}
		}
		return true
	}
	return valid(value)
}

// Background diagnostic polls must not keep an unattended editor alive.
func userInteraction(method string) bool {
	switch method {
	case "devsforge/userActivity", "initialize", "initialized", "textDocument/didOpen", "textDocument/didChange", "textDocument/didSave",
		"textDocument/completion", "completionItem/resolve", "textDocument/hover", "textDocument/signatureHelp",
		"textDocument/definition", "textDocument/typeDefinition", "textDocument/implementation", "textDocument/references",
		"textDocument/prepareRename", "textDocument/rename", "textDocument/formatting",
		"textDocument/rangeFormatting", "textDocument/onTypeFormatting", "codeAction/resolve", "workspace/executeCommand":
		return true
	}
	return false
}

// Filter protocol edits before conversion to the browser's WorkspaceEdit type,
// whose public entries() API omits create/rename/delete file operations.
func restrictResultEdits(method string, result json.RawMessage, uris ...string) json.RawMessage {
	valid := func(edit json.RawMessage) bool {
		wrapped, _ := json.Marshal(map[string]json.RawMessage{"edit": edit})
		return writableEdit(wrapped, uris...)
	}
	if method == "textDocument/rename" {
		if valid(result) {
			return result
		}
		return json.RawMessage("null")
	}
	type action map[string]json.RawMessage
	allowed := func(a action) bool { edit, exists := a["edit"]; return !exists || valid(edit) }
	if method == "codeAction/resolve" {
		var a action
		if json.Unmarshal(result, &a) == nil && allowed(a) {
			return result
		}
		return json.RawMessage("null")
	}
	var actions []action
	if json.Unmarshal(result, &actions) != nil {
		return json.RawMessage("null")
	}
	filtered := make([]action, 0, len(actions))
	for _, a := range actions {
		if allowed(a) {
			filtered = append(filtered, a)
		}
	}
	encoded, _ := json.Marshal(filtered)
	return encoded
}

func commandPrefix(sessionID, engineID string) string {
	return "devsforge.lsp." + sessionID + "." + engineID + "."
}

// Monaco's command registry is global. Namespace server commands so multiple
// editors can attach the same language server without registering duplicate IDs.
func namespaceCommands(raw []byte, prefix string) []byte {
	if !bytes.Contains(raw, []byte(`"command`)) {
		return raw
	}
	var value any
	if json.Unmarshal(raw, &value) != nil {
		return raw
	}
	var rewrite func(any)
	rewrite = func(value any) {
		switch v := value.(type) {
		case map[string]any:
			for key, child := range v {
				if key == "command" {
					if command, ok := child.(string); ok {
						v[key] = prefix + command
						continue
					}
				}
				if key == "commands" {
					if commands, ok := child.([]any); ok {
						for i, command := range commands {
							if name, ok := command.(string); ok {
								commands[i] = prefix + name
							}
						}
						continue
					}
				}
				rewrite(child)
			}
		case []any:
			for _, child := range v {
				rewrite(child)
			}
		}
	}
	rewrite(value)
	result, err := json.Marshal(value)
	if err != nil {
		return raw
	}
	return result
}

// Expose editor protocol features, not language-server maintenance/debug RPCs.
func allowedClientMethod(method string) bool {
	if strings.HasPrefix(method, "textDocument/") {
		return true
	}
	switch method {
	case "", "initialize", "initialized", "shutdown", "exit", "$/cancelRequest", "$/setTrace", "devsforge/userActivity",
		"completionItem/resolve", "codeAction/resolve", "codeLens/resolve", "documentLink/resolve", "inlayHint/resolve",
		"callHierarchy/incomingCalls", "callHierarchy/outgoingCalls", "typeHierarchy/supertypes", "typeHierarchy/subtypes",
		"workspace/symbol", "workspaceSymbol/resolve", "workspace/diagnostic", "workspace/executeCommand", "java/classFileContents":
		return true
	}
	return false
}
