package lsp

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"strings"
	"unicode/utf16"

	adapters "devsforge-runner/integrations"

	"devsforge-runner/internal/config"
	"devsforge-runner/internal/generators"
	"devsforge-runner/util"
	shared "devsforge-shared"
)

type document struct {
	ID, File, Dir, Code string
	Version             int
}

func documentKey(req Request) string {
	key := req.DocumentID
	if key == "" {
		key = req.ModelID
	}
	if key == "" {
		key = randomID()
	}
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:12])
}
func (s *session) folders() []map[string]string {
	result := []map[string]string{}
	for _, doc := range s.documents {
		result = append(result, map[string]string{"uri": fileURI(doc.Dir), "name": doc.ID})
	}
	return result
}
func (s *session) response(doc *document) Response {
	result := Response{ID: s.id, DocumentID: doc.ID, DocumentURI: fileURI(doc.File), WorkspaceURI: fileURI(filepath.Join(s.root, "projects")), Language: s.definition.Language, Status: s.state, Servers: []Connection{}}
	for _, engine := range s.definition.Servers {
		t := s.tickets[engine.ID]
		if t == nil || t.Used {
			continue
		}
		allowed := []string{}
		for _, c := range engine.AllowedCommands {
			allowed = append(allowed, commandPrefix(s.id, engine.ID)+c)
		}
		result.Servers = append(result.Servers, Connection{ID: engine.ID, Ticket: t.Value, AllowedCommands: allowed})
	}
	return result
}
func (s *session) attach(req Request) (*document, error) {
	id := documentKey(req)
	s.mu.Lock()
	if doc := s.documents[id]; doc != nil {
		s.mu.Unlock()
		return doc, nil
	}
	s.mu.Unlock()
	dir := filepath.Join(s.root, "projects", id)
	source, err := s.definition.Resource(s.definition.Wrapper)
	if err != nil {
		return nil, err
	}
	if err = util.CopyDir(source, dir); err != nil {
		return nil, err
	}
	preparation, err := adapters.Get(s.definition.Preparation)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.ModelName)
	if preparation.SourceName != nil {
		name = preparation.SourceName(req.Code, name)
	}
	model := &shared.RunnableModel{ID: id, Name: name, Code: req.Code, Language: shared.CodeLanguage(s.definition.Language), IntegrationID: s.definition.ID, IntegrationVersion: s.definition.Version}
	wrapper := &generators.WrapperInfo{ModelDir: dir, RootDir: dir, Cfg: &config.RunnerConfig{Model: model}}
	if err = preparation.Sources(wrapper, shared.RunnableManifest{Models: []*shared.RunnableModel{model}}); err != nil {
		return nil, err
	}
	if preparation.Analysis != nil {
		if err = preparation.Analysis(wrapper, source); err != nil {
			return nil, err
		}
	}

	file := filepath.Join(dir, strings.ReplaceAll(s.definition.ModelPath, "{name}", name))
	doc := &document{ID: id, File: file, Dir: dir, Code: req.Code, Version: -1}
	s.mu.Lock()
	s.documents[id] = doc
	delete(s.retired, fileURI(file))
	if s.file == "" {
		s.file = file
		s.dir = dir
	}
	senders := s.readySenders()
	s.mu.Unlock()
	event, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "method": "workspace/didChangeWorkspaceFolders", "params": map[string]any{"event": map[string]any{"added": []map[string]string{{"uri": fileURI(dir), "name": id}}, "removed": []any{}}}})
	for _, send := range senders {
		_ = send(event)
	}
	return doc, nil
}
func (s *session) readySenders() []func([]byte) error {
	out := []func([]byte) error{}
	for id, send := range s.senders {
		if s.initialized[id] {
			out = append(out, send)
		}
	}
	return out
}
func (s *session) writable(uri string) bool {
	for _, doc := range s.documents {
		if fileURI(doc.File) == uri {
			return true
		}
	}
	return false
}
func (s *session) detach(id string) error {
	s.mu.Lock()
	doc := s.documents[id]
	if doc == nil {
		s.mu.Unlock()
		return nil
	}
	delete(s.documents, id)
	if s.retired == nil {
		s.retired = map[string]bool{}
	}
	s.retired[fileURI(doc.File)] = true
	senders := s.readySenders()
	s.mu.Unlock()
	event, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "method": "workspace/didChangeWorkspaceFolders", "params": map[string]any{"event": map[string]any{"added": []any{}, "removed": []map[string]string{{"uri": fileURI(doc.Dir), "name": id}}}}})
	for _, send := range senders {
		_ = send(event)
	}
	return os.RemoveAll(doc.Dir)
}
func (s *session) persistDocument(method string, raw json.RawMessage) error {
	var p struct {
		TextDocument struct {
			URI, Text string
			Version   int
		}
		ContentChanges []struct {
			Text  string
			Range *struct{ Start, End struct{ Line, Character int } }
		}
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	var doc *document
	for _, d := range s.documents {
		if fileURI(d.File) == p.TextDocument.URI {
			doc = d
			break
		}
	}
	if doc == nil {
		return fmt.Errorf("document is not attached")
	}
	// Both Python engines observe the same version. Persist it exactly once.
	if p.TextDocument.Version <= doc.Version {
		return nil
	}
	code := doc.Code
	if method == "textDocument/didOpen" {
		code = p.TextDocument.Text
	} else {
		for _, change := range p.ContentChanges {
			if change.Range == nil {
				code = change.Text
				continue
			}
			start, e := utf16Offset(code, change.Range.Start.Line, change.Range.Start.Character)
			if e != nil {
				return e
			}
			end, e := utf16Offset(code, change.Range.End.Line, change.Range.End.Character)
			if e != nil || end < start {
				return fmt.Errorf("invalid incremental range")
			}
			code = code[:start] + change.Text + code[end:]
		}
	}
	if len(code) > 1024*1024 {
		return fmt.Errorf("document exceeds 1 MiB")
	}
	if err := os.WriteFile(doc.File, []byte(code), 0600); err != nil {
		return err
	}
	doc.Code = code
	doc.Version = p.TextDocument.Version
	return nil
}
func utf16Offset(text string, line, column int) (int, error) {
	if line < 0 || column < 0 {
		return 0, fmt.Errorf("invalid position")
	}
	start := 0
	for n := 0; n < line; n++ {
		i := strings.IndexByte(text[start:], '\n')
		if i < 0 {
			return 0, fmt.Errorf("line outside document")
		}
		start += i + 1
	}
	units := 0
	for i, r := range text[start:] {
		if units == column {
			return start + i, nil
		}
		if r == '\n' || r == '\r' {
			return 0, fmt.Errorf("column outside document line")
		}
		units += utf16.RuneLen(r)
		if units > column {
			return 0, fmt.Errorf("position splits UTF-16 character")
		}
	}
	if units == column {
		return len(text), nil
	}
	return 0, fmt.Errorf("column outside document")
}

func (s *session) uris() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	uris := []string{}
	for _, doc := range s.documents {
		uris = append(uris, fileURI(doc.File))
	}
	return uris
}
func (s *session) writableEdit(raw json.RawMessage) bool { return writableEdit(raw, s.uris()...) }
func (s *session) commandTargetsDocuments(raw json.RawMessage) bool {
	return commandTargetsModel(raw, s.uris()...)
}
func (s *session) restrictResultEdits(method string, raw json.RawMessage) json.RawMessage {
	return restrictResultEdits(method, raw, s.uris()...)
}
