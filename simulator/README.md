# Simulator

## How to test

`go test -v`: `-v` is needed to have outputs

## How it works

### Coordinator 

The coordinator receive a runnable mannifest either from the back when a user start a simulation ( not implemented ) or by hand like we do with the test. 
The role of the coordinator are the folowing :
- Split the main manifest by model and start runner with sending the corresponding single runnable manifest 
- Coordinate runner with kafka

### Runner 
    TODO: a faire

### Wrapper
    TODO: a faire


Genrator hi
collabarotar get hi and hello 
observer get 