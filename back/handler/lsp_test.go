package handler

import (
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gorilla/websocket"
)

func TestLSPGatewayPropagatesServerClosure(t *testing.T) {
	closeServer := make(chan struct{})
	opened := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer func() { _ = conn.Close() }()
		close(opened)
		<-closeServer
	}))
	defer upstream.Close()
	t.Setenv("LSP_ADDR", upstream.URL)
	t.Setenv("LSP_INTERNAL_TOKEN", "isolated-test-token-for-websocket")
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	SetupLSPRoutes(app)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = app.Listener(listener) }()
	defer func() { _ = app.Shutdown() }()
	lspTickets.Lock()
	lspTickets.values["closure-test"] = proxyTicket{User: "user", Session: "session", Engine: "pyright", Expires: time.Now().Add(30 * time.Second)}
	lspTickets.Unlock()
	conn, _, err := websocket.DefaultDialer.Dial("ws://"+listener.Addr().String()+"/lsp/sessions/session/ws/pyright?ticket=closure-test", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close() }()
	<-opened
	close(closeServer)
	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, _, err = conn.ReadMessage()
	if err == nil || strings.Contains(err.Error(), "timeout") {
		t.Fatalf("server closure was not forwarded: %v", err)
	}
}
