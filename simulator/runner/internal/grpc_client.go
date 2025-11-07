package internal

import devspb "devsforge/simulator/proto/go"

var modelClient devspb.DevsModelClient

func SetModelClient(c devspb.DevsModelClient) {
	modelClient = c
}

func GetModelClient() devspb.DevsModelClient {
	return modelClient
}
