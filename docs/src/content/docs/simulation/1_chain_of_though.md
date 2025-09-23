---
title: Simulateur - Concept et Fonctionnement
description: Decris comment on va concevoir le simulateur DEVS
---

# Simulateur DEVS – Concept et Fonctionnement

## Introduction

Ce document décrit le fonctionnement du simulateur et des runners associés.  
L’objectif est de créer un environnement distribué où chaque modèle s’exécute de manière autonome, communique via un bus d’événements (Kafka, fichiers, IPC, etc.), et participe à la gestion du temps global de la simulation.

---

## Manifeste

Le simulateur prend en entrée un **manifeste**, défini dans le dossier `shared` (Go).  
Ce manifeste est un objet JSON décrivant les modèles à exécuter.  

Exemple simplifié :  

```json
{
  "models": [
    {
      "id": "m1",
      "type": "atomic",
      "language": "python"
    },
    {
      "id": "m2",
      "type": "coupled",
      "language": "go"
    }
  ]
}
```

Le manifeste peut être fourni soit :  

- comme fichier (`--file chemin/vers/manifest.json`)  
- comme chaîne JSON brute (`--json '{"models":[...]}'`)  

---

## Simulateur

1. Le **simulateur** parse le manifeste (fichier ou JSON).  
2. Il identifie la liste des modèles à exécuter.  
3. Pour chaque langage, il démarre un **runner** correspondant.  
4. Les runners communiquent entre eux via Kafka, des fichiers ou un autre système IPC.  
5. Chaque modèle s’auto-gère, sans coordinateur central.  

### Gestion du temps

- À chaque instant **T**, tous les modèles effectuent leurs actions.  
- Une fois terminé, les modèles proposent le prochain temps d’exécution.  
- Le **nouveau T** est choisi comme le minimum strictement supérieur à l’actuel.  
- Si le prochain T == T actuel → la simulation s’arrête.  

---

## Runners

- Un **runner** est une instance spécifique à un langage (Go, Python, Rust, etc.).  
- Il est lancé avec les **mêmes options que le simulateur** :  
  - `--file chemin/vers/manifest.json`  
  - ou `--json '{"models":[...]}'`  

### Validation du manifeste côté runner

- Le runner parse également le manifeste.  
- Il vérifie qu’il contient **exactement un modèle** (pour le moment).  
- À l’avenir, il pourra supporter **plusieurs modèles dans un même runner**.  
- Une fois le modèle validé, le runner lance son wrapper autour du code du modèle et gère sa communication avec les autres via le bus d’événements.  

---

## Exemple de cycle d’exécution

1. Le simulateur reçoit un manifeste avec 3 modèles (Python, Go, Rust).  
2. Il lance 3 runners, un par langage.  
3. Chaque runner valide et charge son modèle.  
4. Les modèles s’exécutent et échangent des événements.  
5. Après chaque pas de temps, ils déterminent collectivement le prochain **T**.  
6. La simulation s’arrête quand aucun modèle ne peut proposer un temps supérieur.  
