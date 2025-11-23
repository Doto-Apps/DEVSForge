package main

import (
	"devsforge/simulator/coordinator/internal"
	"fmt"
	"os"
)

func main() {
	if err := internal.RunSimulation(os.Args[1:]); err != nil {
		fmt.Println("❌", err)
		os.Exit(1)
	}
}
