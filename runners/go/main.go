package main

import (
	"devsforge/runners/go/cmd"
	"fmt"
	"os"
)

func main() {
	if err := cmd.LaunchRunner(os.Args[1:]); err != nil {
		fmt.Println("❌", err)
		os.Exit(1)
	}
}
