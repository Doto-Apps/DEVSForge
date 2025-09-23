package internal

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"os"
	"sync"

	"github.com/fsnotify/fsnotify"
)

func WatchAndStreamFile(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}

	offset, err := file.Seek(0, io.SeekEnd)
	if err != nil {
		return fmt.Errorf("seek: %w", err)
	}
	reader := bufio.NewReader(file)

	var mu sync.Mutex

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("watcher: %w", err)
	}

	if err := watcher.Add(path); err != nil {
		return fmt.Errorf("watcher add: %w", err)
	}

	go func() {
		defer watcher.Close()
		for {
			select {
			case event := <-watcher.Events:
				if event.Op&fsnotify.Write == fsnotify.Write {
					mu.Lock()
					file.Seek(offset, io.SeekCurrent)
					reader.Reset(file)

					for {
						line, err := reader.ReadString('\n')
						if err != nil {
							break
						}
						offset += int64(len(line))
						log.Printf("Got new line : %s\n", line)
						HandleMessage(line)
					}
					mu.Unlock()
				}

				if event.Op&fsnotify.Remove == fsnotify.Remove || event.Op&fsnotify.Rename == fsnotify.Rename {
					file.Close()
					newFile, err := os.Open(path)
					if err == nil {
						file = newFile
						reader = bufio.NewReader(file)
						offset = 0
						watcher.Add(path)
					}
				}
			case err := <-watcher.Errors:
				log.Println("Watcher error:", err)
			}
		}
	}()

	return nil
}
