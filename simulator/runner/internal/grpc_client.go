package internal

import devspb "devsforge/simulator/proto/go"

var modelClient devspb.AtomicModelServiceClient

func SetModelClient(c devspb.AtomicModelServiceClient) {
	modelClient = c
}

func GetModelClient() devspb.AtomicModelServiceClient {
	return modelClient
}
