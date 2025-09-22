---
title: Runner DEVS in Golang
description: How we should make the go runner
---

Last Update : 12/06/25

# Introduction

This document will describe how we should implement a runner in golang. We choose to implement two ways of running a model :
- **Standalone**: Launch a container / a go program that have one endpoint to provide models information and configuration
- **Distributed**: Launch multiples containers that communicate between them with one coordinator

# IO of the runner

## Whats the input

options, JSON model containing : code 

## Models

- JSON from API (responses.ModelResponse[]). Validation using schema/golang parser

## Whats the output

Result are quite rought to visualize on other DEVS simulation tool, some are based on atomic model that get information via their ports from other model where others has to define in the code visuable data. 

In our solution we don't want to impact neither the structure of the model or the behaviour of the model. Therefore, we will use a different aprroach than the two past solution.

In most DEVS sim tool, simualtino is handled with objects, and our solution will not escape that structure. Object have access to a certain numbers of variable allowing the model to run properly. 

Our idea is to submit all the data contained in an object, at a specific time from the point of view of the coordinator.

All that data once send to the front will allow the user to mix any data, temporal or not into more detailed and free visual reports.

# IO behaviour

## Inter-process format
- JSON/YML

## Inter-process communication
- Event/Socket/Http/

## Intra-process communication

We will use built-in `goroutines` to make threads communicate between them


## Coordinator spec

He will act as a service registry, task dispatcher and a result aggregator

1. Runners can register in its registry for future run
2. An API can receive a runnable information and send them to a runner
3. Runner communicate each tick their model value

## Execution

1. 

## Runner spec

## Execution

1. Fixe l'etat initial, temps jusqu'au prochain event (TA), temps global set a 0
2. Transition interne: Transition a un instant TA (Preciser dans ses propres informations): 
  - Update internal state based on a function/logic
    - He can set his output
3. Transition externe: QQ1 a envoye un message
  - Un code s'execute, peut update le state interne, peut modif le TA
4. Tansition de conflit: Externe au mm moment que interne
  - Gerer par l'utilisateur 
5. Propagation de sortie:
  - Route les sorties vers les destinataires
  - Les destinataires recoivent un event qui faire le temps du dst a celui de levent et va declencher une transition externe/conflit
6. Chaque modele recalcul son TA apres chaque transition
7. On met a jour tous les TGlobal de tous les runners


# Definition of done

## Standalone runner

1. Start a runner
2. API call to runner with runnable info
3. Models send result to client incrementally

## Multi runner + Coordinator

1. Start a coordinator
2. Start a runner with coordinator endpoint to register itself
3. API call to coordinator with runnable info
4. Coordinator choose 1-n runner in his registry to run the model
5. Models communicate between them
6. Models send result to coordinator incrementally
7. Coordinator send result incrementally to the client