package lsp

import (
	"os"
	"os/exec"
)

func configureProcess(cmd *exec.Cmd) {}
func terminateProcess(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return os.ErrProcessDone
	}
	return cmd.Process.Kill()
}
