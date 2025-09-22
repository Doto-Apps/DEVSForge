---
title: 3-Synchronisation in between models in the front
description: How the models are sychronised in the front
---


# How to sync model in front during development

## 1. Async saves

- Ctrl+S or Click on Save button
- Refresh button to update model and childs

## 2. Next steps

- Implements Websocket or similar behavior to notify in real time the user that something change
- Handle conflict between models updates

## Chain of though code structure

- /model/:id: Call Get /api/models/:id/recursive
  - -> CodeEditor : code of selected model, modelId of selected model
    - Save -> Call onSaveSuccess
  - -> ViewEditor : viewJson of selected models, modelId of selected model
    - Save -> Call onSaveSuccess