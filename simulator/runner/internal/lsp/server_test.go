package lsp

import (
	"bufio"
	"encoding/json"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestFrameParsing(t *testing.T) {
	body, err := readFrame(bufio.NewReader(strings.NewReader("Content-Length: 2\r\n\r\n{}")))
	if err != nil || string(body) != "{}" {
		t.Fatalf("frame: %q %v", body, err)
	}
	for _, input := range []string{"Content-Length: -1\r\n\r\n", "Content-Length: 9000000\r\n\r\n", "Content-Length: NaN\r\n\r\n"} {
		if _, err := readFrame(bufio.NewReader(strings.NewReader(input))); err == nil {
			t.Fatal("accepted malformed frame")
		}
	}
}
func testManager(t *testing.T) *Manager {
	t.Helper()
	t.Setenv("LSP_INTERNAL_TOKEN", strings.Repeat("a", 32))
	m, err := NewManager()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		m.mu.Lock()
		ids := []string{}
		for id := range m.sessions {
			ids = append(ids, id)
		}
		m.mu.Unlock()
		for _, id := range ids {
			m.Close(id)
		}
	})
	return m
}
func TestWorkspaceIsolationCapacityAndOwnership(t *testing.T) {
	m := testManager(t)
	m.max = 2
	req := Request{UserID: "alice", ModelName: "Example", Code: "raise Exception('must never execute')", IntegrationID: "xdevs-python", IntegrationVersion: "1.0.0"}
	a, err := m.Create(req)
	if err != nil {
		t.Fatal(err)
	}
	req.UserID = "bob"
	req.Code = "different buffer"
	b, err := m.Create(req)
	if err != nil {
		t.Fatal(err)
	}
	if a.DocumentURI == b.DocumentURI {
		t.Fatal("shared workspace")
	}
	if _, err = m.Create(req); err == nil {
		t.Fatal("capacity was not enforced")
	}
	s := m.sessions[a.ID]
	body, err := os.ReadFile(s.file)
	if err != nil || string(body) != "raise Exception('must never execute')" {
		t.Fatal("buffer lost")
	}
	r := httptest.NewRequest("GET", "/sessions/"+a.ID+"/file?uri="+a.DocumentURI, nil)
	r.Header.Set("Authorization", "Bearer "+m.token)
	r.Header.Set("X-LSP-User", "bob")
	w := httptest.NewRecorder()
	m.ServeHTTP(w, r)
	if w.Code != 404 {
		t.Fatalf("other user read source: %d", w.Code)
	}
	if _, err = s.readablePath("file:///etc/passwd"); err == nil {
		t.Fatal("outside file allowed")
	}
	if _, err = s.readablePath(b.DocumentURI); err == nil {
		t.Fatal("other session file allowed")
	}
	dir := s.dir
	m.Close(a.ID)
	if _, err = os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("workspace was not removed")
	}
}
func TestRejectExpiredTicket(t *testing.T) {
	m := testManager(t)
	res, err := m.Create(Request{UserID: "alice", ModelName: "Example", IntegrationID: "xdevs-python", IntegrationVersion: "1.0.0"})
	if err != nil {
		t.Fatal(err)
	}
	s := m.sessions[res.ID]
	s.tickets["pyright"].Expires = time.Now().Add(-time.Second)
	r := httptest.NewRequest("GET", "/sessions/"+res.ID+"/ws/pyright?ticket="+res.Servers[0].Ticket, nil)
	r.Header.Set("Authorization", "Bearer "+m.token)
	r.Header.Set("X-LSP-User", "alice")
	w := httptest.NewRecorder()
	m.ServeHTTP(w, r)
	if w.Code != 401 {
		t.Fatalf("expired ticket accepted: %d", w.Code)
	}
}
func TestConfigurationIsJSON(t *testing.T) {
	m := testManager(t)
	res, err := m.Create(Request{UserID: "alice", ModelName: "Example", Code: "", IntegrationID: "xdevs-python", IntegrationVersion: "1.0.0"})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(m.sessions[res.ID].dir + "/pyrightconfig.json")
	if err != nil || !json.Valid(data) {
		t.Fatalf("analysis configuration missing: %v", err)
	}
}

func TestWorkspaceEditsStayInUserDocument(t *testing.T) {
	uri := "file:///tmp/project/model.py"
	for _, raw := range []string{`{"edit":{"changes":{"file:///etc/passwd":[]}}}`, `{"edit":{"documentChanges":[{"kind":"delete","uri":"file:///tmp/project/model.py"}]}}`} {
		if writableEdit(json.RawMessage(raw), uri) {
			t.Fatalf("unsafe edit accepted: %s", raw)
		}
	}
	if !writableEdit(json.RawMessage(`{"edit":{"changes":{"file:///tmp/project/model.py":[]}}}`), uri) {
		t.Fatal("model edit rejected")
	}
	if commandTargetsModel(json.RawMessage(`{"arguments":[{"URI":"file:///other-user/model.py"}]}`), uri) {
		t.Fatal("command can target another user's document")
	}
}

func TestBackgroundTrafficDoesNotExtendIdleSession(t *testing.T) {
	for _, method := range []string{"textDocument/diagnostic", "workspace/diagnostic", "$/cancelRequest", "textDocument/documentSymbol", "textDocument/codeAction", "textDocument/documentHighlight", ""} {
		if userInteraction(method) {
			t.Fatalf("background method %q resets idle timeout", method)
		}
	}
	if !userInteraction("textDocument/didChange") || !userInteraction("textDocument/completion") {
		t.Fatal("editor interaction ignored")
	}
}

func TestActionAndRenameResultsRejectLibraryAndFileOperations(t *testing.T) {
	uri := "file:///tmp/model.py"
	unsafe := json.RawMessage(`{"documentChanges":[{"kind":"rename","oldUri":"file:///tmp/model.py","newUri":"file:///tmp/library.py"}]}`)
	if string(restrictResultEdits("textDocument/rename", unsafe, uri)) != "null" {
		t.Fatal("resource operation accepted")
	}
	actions := json.RawMessage(`[{"title":"unsafe","edit":{"changes":{"file:///etc/passwd":[]}}},{"title":"safe","edit":{"changes":{"file:///tmp/model.py":[]}}}]`)
	var kept []map[string]any
	if err := json.Unmarshal(restrictResultEdits("textDocument/codeAction", actions, uri), &kept); err != nil || len(kept) != 1 || kept[0]["title"] != "safe" {
		t.Fatal("unsafe action was not filtered")
	}
}

func TestCommandsArePrivateToEachEditor(t *testing.T) {
	raw := []byte(`{"result":{"capabilities":{"executeCommandProvider":{"commands":["ruff.applyFormat"]}},"action":{"command":{"command":"ruff.applyFormat","arguments":["file:///tmp/model.py"]}}}}`)
	first := string(namespaceCommands(raw, commandPrefix("one", "ruff")))
	second := string(namespaceCommands(raw, commandPrefix("two", "ruff")))
	if first == second || !strings.Contains(first, `"command":"devsforge.lsp.one.ruff.ruff.applyFormat"`) || !strings.Contains(first, `"commands":["devsforge.lsp.one.ruff.ruff.applyFormat"]`) || !strings.Contains(first, "file:///tmp/model.py") {
		t.Fatalf("command isolation failed: %s", first)
	}
}

func TestEditorProtocolDoesNotExposeServerMaintenanceRPCs(t *testing.T) {
	for _, method := range []string{"gopls/run_tests", "java/projectConfigurationUpdate", "workspace/didChangeConfiguration", "workspace/didChangeWorkspaceFolders"} {
		if allowedClientMethod(method) {
			t.Fatalf("maintenance method exposed: %s", method)
		}
	}
	for _, method := range []string{"textDocument/completion", "completionItem/resolve", "workspace/executeCommand", "java/classFileContents"} {
		if !allowedClientMethod(method) {
			t.Fatalf("editor method blocked: %s", method)
		}
	}
}
