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


TODO: faire test unitaire pour le runner + wrapper + modele go avec un envoi factice dans le kafka pour l'init sim 
TODO: faire test unitaire pour le runner + wrapper + modele python avec un envoi factice dans le kafka pour l'init sim 

TODO: faire test unitaire pour le coordinator + runners(go) + runner(python) avec simulation compléte 

TODO: Faire les read me correctement et modifier la docs pour expliquer comment on lance les test et comment focntionne le système 