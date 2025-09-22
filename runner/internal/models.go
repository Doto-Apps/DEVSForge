package internal

type Message struct {
	From string
	To   string
	Data MessageData
}

type MessageData struct {
	Type    string // Make an enum like init, event, state_update
	Content string
}

type InitMessageContent struct {
	InitialTime float32
}
