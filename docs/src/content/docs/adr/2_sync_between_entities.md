---
title: 2-Synchronisation in between models
description: How the models are sychronised in the back
---

# How entities are synced

## Models Syncing

Models presents in libraries are sync between workspaces

**Disable Sync**: To counter this synchronisation users are invited to:
- Duplicate the model: It will remove the link between the model and the library. The duplicate model can therefore be updated and added to the current diagram without affecting other diagram behaviour.

## Diagrams syncing

### When sync

Diagrams are sync through models that comes from libraries. Indeed Diagram ar using a REF ID, if one or multiple diagram use the same model with the same ID, the code modification of one of the model will be applied on the model it self. So, all the diagrams using this model will receive the updated model.

#### How to sync diagrams to reuse them between workspaces

Transform a diagrams into a coupled model that you add in a library, then this coupled model contains all models present in the diagrams, it result in two different entries in database but through modelId they will be synced

### When not sync

Diagrams are not sync when duplicating them between worskpaces. Models presents in the duplicated diagrams are synced even if they come from a library or not.

### Next steps

- During duplicating diagrams : if they not comes from a library a duplicata will be created that will not be synced between diagrams.