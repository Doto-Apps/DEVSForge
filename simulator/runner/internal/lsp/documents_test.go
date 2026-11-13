package lsp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestModelsShareWorkspaceWithoutSharingBuffers(t *testing.T) {
	m := testManager(t)
	req := Request{UserID: "alice", WorkbenchID: "window-one", DocumentID: "light", ModelName: "light ", Code: "# light buffer", IntegrationID: "xdevs-python", IntegrationVersion: "1.0.0"}
	a, err := m.Create(req)
	if err != nil {
		t.Fatal(err)
	}
	req.DocumentID = "switch"
	req.ModelName = "switch"
	req.Code = "# switch buffer"
	b, err := m.Create(req)
	if err != nil {
		t.Fatal(err)
	}
	if a.ID != b.ID || a.DocumentURI == b.DocumentURI {
		t.Fatal("workspace was not reused or buffers collided")
	}
	s := m.sessions[a.ID]
	if len(s.documents) != 2 {
		t.Fatal("missing document")
	}
	if err = s.detach(a.DocumentID); err != nil {
		t.Fatal(err)
	}
	if len(s.documents) != 1 || m.sessions[b.ID] == nil {
		t.Fatal("closing a document closed its workspace")
	}
	for _, doc := range s.documents {
		data, _ := os.ReadFile(doc.File)
		if string(data) != "# switch buffer" {
			t.Fatal("other model content changed")
		}
	}
	req.UserID = "bob"
	c, err := m.Create(req)
	if err != nil || c.ID == a.ID {
		t.Fatal("users share workspace")
	}
	req.UserID = "alice"
	req.WorkbenchID = "window-two"
	c, err = m.Create(req)
	if err != nil || c.ID == a.ID {
		t.Fatal("windows share workspace")
	}
}
func TestIncrementalUTF16AndCompanionVersionDeduplication(t *testing.T) {
	m := testManager(t)
	r, err := m.Create(Request{UserID: "a", WorkbenchID: "w", DocumentID: "d", ModelName: "model", Code: "😀alpha\n", IntegrationID: "xdevs-python", IntegrationVersion: "1.0.0"})
	if err != nil {
		t.Fatal(err)
	}
	s := m.sessions[r.ID]
	raw := json.RawMessage(`{"textDocument":{"uri":"` + r.DocumentURI + `","version":2},"contentChanges":[{"range":{"start":{"line":0,"character":2},"end":{"line":0,"character":7}},"text":"beta"}]}`)
	if err = s.persistDocument("textDocument/didChange", raw); err != nil {
		t.Fatal(err)
	}
	duplicate := json.RawMessage(`{"textDocument":{"uri":"` + r.DocumentURI + `","version":2},"contentChanges":[{"text":"wrong duplicate"}]}`)
	if err = s.persistDocument("textDocument/didChange", duplicate); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(s.file)
	if string(data) != "😀beta\n" {
		t.Fatalf("incorrect overlay: %q", data)
	}
	if _, err = utf16Offset("😀", 0, 1); err == nil {
		t.Fatal("accepted split surrogate")
	}
}

func TestClosedProjectsAreReusedWithFreshBuffersAndCleanedWithWorkspace(t *testing.T) {
	for _, tt := range []struct{ profile, initial, updated string }{
		{"xdevs-python", "class Example:\n    pass\n", "class Renamed:\n    pass\n"},
		{"xdevs-go", "package main\nfunc initial() {}\n", "package main\nfunc updated() {}\n"},
		{"xdevs-java", "public class Example {}", "public class Renamed {}"},
		{"ms4me-java", "package first.project; public class Example {}", "package second.project; public class Renamed {}"},
	} {
		t.Run(tt.profile, func(t *testing.T) {
			m := testManager(t)
			req := Request{UserID: "alice", WorkbenchID: "window", DocumentID: "first", ModelName: "Example", Code: tt.initial, IntegrationID: tt.profile, IntegrationVersion: "1.0.0"}
			first, err := m.Create(req)
			if err != nil {
				t.Fatal(err)
			}
			s := m.sessions[first.ID]
			initial := s.documents[first.DocumentID]
			root := s.root
			raw, err := json.Marshal(map[string]any{"textDocument": map[string]any{"uri": first.DocumentURI, "version": 8, "text": req.Code}})
			if err != nil {
				t.Fatal(err)
			}
			if err = s.persistDocument("textDocument/didOpen", raw); err != nil {
				t.Fatal(err)
			}
			// Project metadata and library links must survive closing an editor.
			marker := filepath.Join(initial.Dir, "analysis-cache-marker")
			if err = os.WriteFile(marker, []byte("keep"), 0600); err != nil {
				t.Fatal(err)
			}
			if err = s.detach(first.DocumentID); err != nil {
				t.Fatal(err)
			}
			if s.writable(first.DocumentURI) || len(s.folders()) != 1 {
				t.Fatal("closed document must be read-only while its project remains registered")
			}
			req.Code = tt.updated
			reopened, err := m.Create(req)
			if err != nil || reopened.ID != first.ID {
				t.Fatalf("reopen failed: %+v %v", reopened, err)
			}
			doc := s.documents[reopened.DocumentID]
			if _, err = os.Stat(marker); err != nil {
				t.Fatal("prepared project was rebuilt on reopening", err)
			}
			if doc.File != initial.File {
				if _, err = os.Stat(initial.File); !os.IsNotExist(err) {
					t.Fatal("old Java source remained after renaming its public type")
				}
			}
			raw, err = json.Marshal(map[string]any{"textDocument": map[string]any{"uri": reopened.DocumentURI, "version": 1, "text": req.Code}})
			if err != nil {
				t.Fatal(err)
			}
			if err = s.persistDocument("textDocument/didOpen", raw); err != nil {
				t.Fatal(err)
			}
			code, err := os.ReadFile(doc.File)
			if err != nil || string(code) != req.Code || doc.Version != 1 || !s.writable(reopened.DocumentURI) || len(s.projects) != 1 {
				t.Fatalf("reopened buffer has stale content/version or a duplicate project: %q %v", code, err)
			}
			m.Close(first.ID)
			if _, err = os.Stat(root); !os.IsNotExist(err) {
				t.Fatal("cached projects survived workspace cleanup")
			}
		})
	}
}

func TestCapacityQueuesAndReleasesWorkbench(t *testing.T) {
	m := testManager(t)
	m.max = 1
	req := Request{UserID: "a", WorkbenchID: "a", DocumentID: "a", ModelName: "model", IntegrationID: "xdevs-python", IntegrationVersion: "1.0.0"}
	a, err := m.Create(req)
	if err != nil {
		t.Fatal(err)
	}
	req.WorkbenchID = "b"
	b, err := m.Create(req)
	if err != nil || b.Status != "queued" {
		t.Fatalf("expected queued workspace: %+v %v", b, err)
	}
	m.Close(a.ID)
	if !m.admit(m.sessions[b.ID]) {
		t.Fatal("capacity not released")
	}
}
func TestGoAnalysisProjectsHaveDistinctModuleNames(t *testing.T) {
	m := testManager(t)
	req := Request{UserID: "a", WorkbenchID: "a", DocumentID: "one", ModelName: "same", IntegrationID: "xdevs-go", IntegrationVersion: "1.0.0"}
	a, err := m.Create(req)
	if err != nil {
		t.Fatal(err)
	}
	req.DocumentID = "two"
	b, err := m.Create(req)
	if err != nil {
		t.Fatal(err)
	}
	s := m.sessions[a.ID]
	one, _ := os.ReadFile(filepath.Join(s.documents[a.DocumentID].Dir, "go.mod"))
	two, _ := os.ReadFile(filepath.Join(s.documents[b.DocumentID].Dir, "go.mod"))
	if string(one) == string(two) || !strings.Contains(string(one), "module devsforge-analysis/") {
		t.Fatal("Go modules collide")
	}
}

func TestUTF16LineEndOffsets(t *testing.T) {
	for _, tt := range []struct {
		text               string
		line, column, want int
	}{{"ab\ncd\n", 0, 2, 2}, {"ab\n😀\n", 1, 2, 7}, {"ab\r\ncd", 0, 2, 2}, {"ab\n", 1, 0, 3}} {
		got, err := utf16Offset(tt.text, tt.line, tt.column)
		if err != nil || got != tt.want {
			t.Fatalf("offset %q %d:%d: %d %v", tt.text, tt.line, tt.column, got, err)
		}
	}
	if _, err := utf16Offset("ab\nnext line", 0, 3); err == nil {
		t.Fatal("accepted position past line end")
	}
}

func TestWaitingWorkspaceEvictsLeastRecentlyUsedIdleSpace(t *testing.T) {
	m := testManager(t)
	m.max = 2
	req := Request{UserID: "a", WorkbenchID: "one", DocumentID: "d", ModelName: "model", IntegrationID: "xdevs-python", IntegrationVersion: "1.0.0"}
	a, _ := m.Create(req)
	req.WorkbenchID = "two"
	b, _ := m.Create(req)
	req.WorkbenchID = "waiting"
	pending, err := m.Create(req)
	if err != nil || pending.Status != "queued" {
		t.Fatalf("expected queue: %+v %v", pending, err)
	}
	m.sessions[a.ID].last = time.Now().Add(-2 * time.Minute)
	if !m.acquire(m.sessions[pending.ID]) {
		t.Fatal("idle capacity was not reclaimed")
	}
	if m.sessions[a.ID] != nil || m.sessions[b.ID] == nil {
		t.Fatal("evicted active or wrong workspace")
	}
}
