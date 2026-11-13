package lsp

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// Run in the LSP image: LSP_REAL_SERVERS=1 go test ./simulator/runner/internal/lsp -run TestRealLanguageServers -v.
func TestRealLanguageServers(t *testing.T) {
	if os.Getenv("LSP_REAL_SERVERS") != "1" {
		t.Skip("real language servers are tested in the LSP image")
	}
	tests := []struct {
		profile, engine, code string
		line, column          int
		want                  string
	}{
		{"xdevs-python", "pyright", "from modeling import Atomic\nimport math\nclass Example(Atomic):\n    def test(self):\n        self.\n        math.\n", 4, 13, "get_phase"},
		{"xdevs-python", "pyright", "import math\nmath.\n", 1, 5, "sqrt"},
		{"xdevs-go", "gopls", "package main\nimport \"devsforge-wrapper/modeling\"\nimport \"math\"\nfunc test(m modeling.Atomic) {\n m.\n math.\n}\nfunc NewModel(c modeling.RunnableModel) modeling.Atomic { return modeling.NewAtomic(c) }\n", 4, 3, "HoldIn"},
		{"xdevs-go", "gopls", "package main\nimport \"math\"\nfunc test() {\n math.\n}\n", 3, 6, "Sqrt"},
		{"xdevs-java", "jdtls", "package com.devsforge.runner;\nimport com.devsforge.runner.modeling.*;\npublic class Example extends Atomic {\n public Example(RunnableModel c) { super(c); }\n public void test() { this.\n }\n}\n", 4, 27, "getPhase"},
		{"xdevs-java", "jdtls", "package com.devsforge.runner;\npublic class Example {\n public void test() { Math.sq\n }\n}\n", 2, 29, "sqrt"},
		{"ms4me-java", "jdtls", "package demo;\nimport com.ms4systems.devs.core.model.impl.Atomic;\npublic class Example extends Atomic {\n public void test() { this.\n }\n}\n", 3, 27, "addInputPort"},
		{"ms4me-java", "jdtls", "package demo;\npublic class Example {\n public void test() { Math.sq\n }\n}\n", 2, 29, "sqrt"},
	}
	for _, tt := range tests {
		t.Run(tt.profile+"-"+tt.want, func(t *testing.T) {
			m := testManager(t)
			result, err := m.Create(Request{UserID: "tester", WorkbenchID: "real-engines", DocumentID: "first", ModelName: "light ", Code: tt.code, IntegrationID: tt.profile, IntegrationVersion: "1.0.0"})
			if err != nil {
				t.Fatal(err)
			}
			server := httptest.NewServer(m)
			defer server.Close()
			var ticket string
			for _, s := range result.Servers {
				if s.ID == tt.engine {
					ticket = s.Ticket
				}
			}
			headers := http.Header{"Authorization": []string{"Bearer " + m.token}, "X-LSP-User": []string{"tester"}}
			socket, _, err := websocket.DefaultDialer.Dial(strings.Replace(server.URL, "http", "ws", 1)+"/sessions/"+result.ID+"/ws/"+tt.engine+"?ticket="+ticket, headers)
			if err != nil {
				t.Fatal(err)
			}
			defer func() { _ = socket.Close() }()
			_ = socket.SetReadDeadline(time.Now().Add(180 * time.Second))
			send := func(id any, method string, params any) {
				msg := map[string]any{"jsonrpc": "2.0", "method": method, "params": params}
				if id != nil {
					msg["id"] = id
				}
				if err := socket.WriteJSON(msg); err != nil {
					t.Fatal(err)
				}
			}
			receive := func(id int) json.RawMessage {
				for {
					var msg struct {
						ID     json.RawMessage `json:"id"`
						Method string          `json:"method"`
						Result json.RawMessage `json:"result"`
						Error  json.RawMessage `json:"error"`
						Params json.RawMessage `json:"params"`
					}
					if err := socket.ReadJSON(&msg); err != nil {
						t.Fatal(err)
					}
					if msg.Method != "" && len(msg.ID) > 0 {
						if err := socket.WriteJSON(map[string]any{"jsonrpc": "2.0", "id": msg.ID, "result": nil}); err != nil {
							t.Fatal(err)
						}
						continue
					}
					if string(msg.ID) == fmt.Sprint(id) {
						if len(msg.Error) > 0 && string(msg.Error) != "null" {
							t.Logf("server response: %s", msg.Error)
						}
						return msg.Result
					}
				}
			}
			send(1, "initialize", map[string]any{"processId": nil, "rootUri": result.WorkspaceURI, "capabilities": map[string]any{"workspace": map[string]any{"workspaceFolders": true}, "textDocument": map[string]any{"completion": map[string]any{"completionItem": map[string]any{"snippetSupport": true}}}}})
			if len(receive(1)) == 0 {
				t.Fatal("initialize failed")
			}
			send(nil, "initialized", map[string]any{})
			send(nil, "textDocument/didOpen", map[string]any{"textDocument": map[string]any{"uri": result.DocumentURI, "languageId": result.Language, "version": 1, "text": tt.code}})
			found := false
			for attempt := 0; attempt < 120; attempt++ {
				send(10+attempt, "textDocument/completion", map[string]any{"textDocument": map[string]any{"uri": result.DocumentURI}, "position": map[string]int{"line": tt.line, "character": tt.column}, "context": map[string]any{"triggerKind": 1}})
				items := receive(10 + attempt)
				if tt.engine == "jdtls" && (attempt == 0 || attempt == 119) {
					sample := string(items)
					if len(sample) > 2000 {
						sample = sample[:2000]
					}
					t.Logf("completion sample: %s", sample)
				}
				if strings.Contains(string(items), tt.want) {
					found = true
					break
				}
				time.Sleep(500 * time.Millisecond)
			}
			if !found {
				if tt.engine == "jdtls" {
					data, _ := os.ReadFile(m.sessions[result.ID].root + "/jdtls/.metadata/.log")
					if len(data) > 14000 {
						data = append(data[:10000], data[len(data)-4000:]...)
					}
					t.Logf("Java log: %s", data)
				}
				t.Fatalf("completion %q missing", tt.want)
			}
			t.Logf("completion %s available", tt.want)
			// The second project intentionally reuses the same type/function names.
			second, err := m.Create(Request{UserID: "tester", WorkbenchID: "real-engines", DocumentID: "second", ModelName: "same display name ", Code: tt.code, IntegrationID: tt.profile, IntegrationVersion: "1.0.0"})
			if err != nil || second.ID != result.ID || second.DocumentURI == result.DocumentURI {
				t.Fatalf("workspace reuse failed: %+v %v", second, err)
			}
			send(nil, "textDocument/didOpen", map[string]any{"textDocument": map[string]any{"uri": second.DocumentURI, "languageId": second.Language, "version": 1, "text": tt.code}})
			for attempt := 0; attempt < 120; attempt++ {
				send(200+attempt, "textDocument/completion", map[string]any{"textDocument": map[string]any{"uri": second.DocumentURI}, "position": map[string]int{"line": tt.line, "character": tt.column}, "context": map[string]any{"triggerKind": 1}})
				items := receive(200 + attempt)
				if strings.Contains(string(items), tt.want) {
					found = true
					break
				}
				found = false
				time.Sleep(500 * time.Millisecond)
			}
			if !found {
				t.Fatalf("second document completion %s unavailable", tt.want)
			}
			if err = m.sessions[result.ID].detach(result.DocumentID); err != nil {
				t.Fatal(err)
			}
			send(nil, "textDocument/didClose", map[string]any{"textDocument": map[string]any{"uri": result.DocumentURI}})
			found = false
			var lastCompletion json.RawMessage
			for attempt := 0; attempt < 30; attempt++ {
				send(400+attempt, "textDocument/completion", map[string]any{"textDocument": map[string]any{"uri": second.DocumentURI}, "position": map[string]int{"line": tt.line, "character": tt.column}})
				lastCompletion = receive(400 + attempt)
				if strings.Contains(string(lastCompletion), tt.want) {
					found = true
					break
				}
				time.Sleep(300 * time.Millisecond)
			}
			if !found {
				if tt.engine == "jdtls" {
					data, _ := os.ReadFile(m.sessions[result.ID].root + "/jdtls/.metadata/.log")
					if len(data) > 14000 {
						data = append(data[:10000], data[len(data)-4000:]...)
					}
					t.Logf("Java log: %s", data)
				}
				t.Logf("last completion after detach: %s", lastCompletion)
				t.Fatal("detaching first document disrupted shared engine")
			}

			t.Logf("same engine socket completed both isolated projects and survived detach")
			reopenedCode, reopenedURI := tt.code, result.DocumentURI
			if result.Language == "java" {
				reopenedCode = strings.ReplaceAll(tt.code, "Example", "Reopened")
				reopenedURI = strings.ReplaceAll(result.DocumentURI, "Example.java", "Reopened.java")
			}
			reopened, err := m.Create(Request{UserID: "tester", WorkbenchID: "real-engines", DocumentID: "first", ModelName: "light ", Code: reopenedCode, IntegrationID: tt.profile, IntegrationVersion: "1.0.0"})
			if err != nil || reopened.ID != result.ID || reopened.DocumentURI != reopenedURI {
				t.Fatalf("reopening cached project failed: %+v %v", reopened, err)
			}
			send(nil, "textDocument/didOpen", map[string]any{"textDocument": map[string]any{"uri": reopened.DocumentURI, "languageId": reopened.Language, "version": 1, "text": reopenedCode}})
			for _, uri := range []string{reopened.DocumentURI, second.DocumentURI} {
				found = false
				for attempt := 0; attempt < 30; attempt++ {
					send(600+attempt, "textDocument/completion", map[string]any{"textDocument": map[string]any{"uri": uri}, "position": map[string]int{"line": tt.line, "character": tt.column}, "context": map[string]any{"triggerKind": 1}})
					if strings.Contains(string(receive(600+attempt)), tt.want) {
						found = true
						break
					}
					time.Sleep(300 * time.Millisecond)
				}
				if !found {
					t.Fatalf("document lost completion after reopening: %s", uri)
				}
			}
		})
	}
}
