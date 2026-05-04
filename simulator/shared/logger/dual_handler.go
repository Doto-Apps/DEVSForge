package logger

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sync"
)

// DualHandler writes log records to two handlers simultaneously
type DualHandler struct {
	handler1 slog.Handler
	handler2 slog.Handler
	attrs    []slog.Attr
	group    []string
	mu       sync.Mutex
}

// NewDualHandler creates a handler that writes to both handlers
func NewDualHandler(h1, h2 slog.Handler) *DualHandler {
	return &DualHandler{
		handler1: h1,
		handler2: h2,
	}
}

type ColorWriter struct {
	writer      io.Writer
	colorCode   string
	processType string
}

func NewColorWriter(w io.Writer, colorCode string, processType string) *ColorWriter {
	return &ColorWriter{
		writer:      w,
		colorCode:   colorCode,
		processType: processType,
	}
}

func (w *ColorWriter) Write(p []byte) (n int, err error) {
	colored := fmt.Sprintf("\033[%sm | %s | %s\033[0m", w.colorCode, w.processType, string(p))
	return w.writer.Write([]byte(colored))
}

func (h *DualHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.handler1.Enabled(ctx, level) || h.handler2.Enabled(ctx, level)
}

func (h *DualHandler) Handle(ctx context.Context, r slog.Record) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	r1 := r.Clone()
	r2 := r.Clone()

	err1 := h.handler1.Handle(ctx, r1)

	// Handle to second handler
	err2 := h.handler2.Handle(ctx, r2)

	// Return first error if any
	if err1 != nil {
		return err1
	}
	return err2
}

// WithAttrs returns a new handler with the given attributes added
func (h *DualHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	h.mu.Lock()
	defer h.mu.Unlock()

	newAttrs := make([]slog.Attr, len(h.attrs)+len(attrs))
	copy(newAttrs, h.attrs)
	copy(newAttrs[len(h.attrs):], attrs)

	return &DualHandler{
		handler1: h.handler1.WithAttrs(attrs),
		handler2: h.handler2.WithAttrs(attrs),
		attrs:    newAttrs,
		group:    h.group,
	}
}

// WithGroup returns a new handler with the given group name added
func (h *DualHandler) WithGroup(name string) slog.Handler {
	h.mu.Lock()
	defer h.mu.Unlock()

	return &DualHandler{
		handler1: h.handler1.WithGroup(name),
		handler2: h.handler2.WithGroup(name),
		attrs:    h.attrs,
		group:    append(h.group, name),
	}
}
