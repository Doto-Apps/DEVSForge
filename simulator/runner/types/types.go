// Package types: runner types
package types

type AbstractModelState struct {
	InitialTime int
}

// AbstractRunnableModelInterface Interface that need to be implmented for all golang runnable models
type AbstractRunnableModelInterface struct {
	State *AbstractModelState
}

type AbstractRunnableModelInterfaceParams struct {
	InitialTime int
}

type Message struct {
	PortID string
	Data   string
}
type ExternalTransitionParams struct {
	Messages []Message
}
type InternalTransitionParams struct {
	Messages []Message
}

// Init accept parameters in entry and return a modelState
func (m AbstractRunnableModelInterface) Init(params AbstractRunnableModelInterfaceParams) {
	m.State.InitialTime = params.InitialTime
}

func (m AbstractRunnableModelInterface) ExternalTransition(params ExternalTransitionParams) {
	panic("ExternalTransition must be implemented")
}

func (m AbstractRunnableModelInterface) InternalTransition(state AbstractModelState) {
	panic("InternalTransition must be implemented")
}

func (m AbstractRunnableModelInterface) OutputFunction(params InternalTransitionParams) {
	panic("OutputFunction must be implemented")
}

func (m AbstractRunnableModelInterface) GetState() {
	panic("GetState must be implemented")
}

func (m AbstractRunnableModelInterface) GetNextTime() int {
	panic("GetNextTime must be implemented")
}
