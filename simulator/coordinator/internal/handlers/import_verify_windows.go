//go:build windows

package handlers

import "net/http"

func handleVerifyImport(w http.ResponseWriter, r *http.Request) error {
	http.Error(w, "Import verification requires the Linux simulator container", http.StatusNotImplemented)
	return nil
}
