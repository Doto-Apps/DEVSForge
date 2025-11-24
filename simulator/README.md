# Simulator

PROJECT UNDER HEAVY DEVELOPMENT IT MAY NOT WORK FOR ALL USE CASE PLEASE SEND AN ISSUE.


## Next steps 

- [ ] Log all in a file
- [x] Temporary directory with config
- [ ] Make an helper to Marshal incoming data in ports
- [ ] Implement/Remove portType with primitive typing ?
- [x] Unit test using a single go model and send kafka message in the test
  - [x] Ensure we handle correctly SendInit, SendNextTime, SendOuput, ExecuteTransition, SimulationDone, DeltaExt, DeltaInt
  - [x] Ensure we handle correctly Confluent
- [ ] Unit test using a go model and a python model
- [ ] Add java language
- [ ] Add C++ language
- [ ] Improve READMEs and code documentation in golang and python
- [ ] Add a Realworld unit test using all methods
- [ ] Deploy modeling libraries to make them available for all developers
- [ ] Handle Create and delete temporary directories in the coordinator

## Implementation State

| Language  | Implemented | Information |
| :--------------- |:--------------- | :-----|
| Golang  |   Yes |  Implementation complete |
| Python  | Yes |   Implementation complete |
| Java  | No | |
| C++  | No | |

## How to test

For testing the simulation in this project you will need : 
- Docker or Docker Desktop for windows users.
- GO in any recent version 

### Test the runner alone

There is two main test in the folowing project, the first one is to test a runner alone to verify thats he run smoothly. The test included the start of the docker and any needed dependency.
From the root of the project : 

`go test -v /simulaltor/runner`: `-v` is needed to have outputs

### Test the entire simulation ( runners + coord )

This test include the runnable manifest conatining differents model, automatic start of the kafka, and the execution of the all simulation in general.
From the root of the project : 

`go test -v /simulaltor`: `-v` is needed to have outputs

## How it works

## Coordinator 

The coordinator receive a runnable mannifest either from the back when a user start a simulation ( not implemented ) or by hand like we do with the test. 
The role of the coordinator are the folowing :
- Split the main manifest by model and start runner with sending the corresponding single runnable manifest 
- Coordinate runner with kafka

The coordinator will use DEVS-SF message format to tlak via kafka, ensuring that we are compatible with the standard. The only exception is we only use one kafka Topic per simulation to ensure scalability (Needed for an online platform). The ID of the topic is random and correspond to the ID of the ongoing simulation.

### Coordinator Start

The coordinator will configure him self including kafka connection, parsing runnable manisfest, and creating an Array of 'RunnerState' findable in 'simulator/internal/types.go' and use to keep track of Model 'NextTime' and ports values. Once it is configure, it will start all the differents Runner conresponding to the number of atomic model in the runnable manifest. The coordinator will only end his process when all ths subprocess attach to him have ended. 

### Coordination of runner for simulation 

After all the model are started, the coordinator will send 'DEVSinit' type Message to all the model and will wait fot the response of all the models. The rest of the simulation follow DEVS-SF exectuion and don't need to be further explained.


## Runner 

The Runner, represent the gateway between the real modeling DEVS model and the coordinator. Its role is to initialise the model its self is in own language (Currently supported : Python and go). 
THe role of the runner are the following : 
- Create a wrapper for the user model 
- receveive commands frrom the coordinator via kafka 
- Retransmit the orders received via kafka to the model in any language using GRPC ( Protobuf )

### intialisation of the runner 



## Wrapper
    TODO: a faire

