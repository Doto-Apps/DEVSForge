---
title: 1-Processus de Création et Gestion de Modèles dans l'application DEVS (EasyDEVS)
description: How to add a model 
---

## 1. Introduction Générale
L'application EasyDEVS a pour objectif de permettre la création, la gestion et l’édition de modèles DEVS (Discrete Event System Specification), qu'ils soient atomiques ou couplés, à travers une interface intuitive supportée par l’intelligence artificielle.

Deux types de modèles sont pris en charge :
- **Modèles Atomiques** : entités de base, définissant un comportement élémentaire selon des états, des transitions et des événements.
- **Modèles Couplés** : structures composites organisant et connectant plusieurs modèles atomiques et/ou couplés pour former un système plus complexe.

## 2. Architecture de l'Application
L’interface se structure autour de plusieurs sections clés :
- **Navbar Principale** : 
  - Accueil
  - AI Diagram Maker (génération assistée par IA)
  - Devs Editor (édition manuelle de modèles)
  - Librairies (exemples : Smart Parking, Light Systems)
  - Mes Diagrammes (accès aux modèles créés et sauvegardés)
  
- **Sidebar** : 
  - Affichage des librairies et des modèles disponibles.
  - Actions rapides : clic droit pour ajouter un modèle, dupliquer, supprimer, etc.

## 3. Démarche de Création d’un Modèle

### 3.1 Démarrage du Processus
- L'utilisateur initie la création via le bouton **"Créer un Modèle"**, accessible :
  - Depuis la section **"Mes Diagrammes"**.
  - Ou via un menu contextuel (clic droit) sur une librairie existante.

### 3.2 Choix du Type de Modèle
Dès le lancement, l'utilisateur est invité à sélectionner le type de modèle à créer :
- **Modèle Atomique**.
- **Modèle Couplé**.

### 3.3 Association à une Librairie
Avant de poursuivre, l’utilisateur doit :
- Sélectionner une librairie existante pour héberger le modèle.
- Ou créer une nouvelle librairie s’il souhaite organiser ses modèles différemment.

Cette étape est essentielle pour assurer une gestion structurée et modulaire des modèles.

---

## 4. Création d’un Modèle Atomique

### 4.1 Informations Initiales
- Nom du modèle.
- Description rapide (facultative).
- Définition des ports d'entrée et de sortie.
- Choix éventuel d'un modèle de base ou d’un template.

### 4.2 Développement du Comportement
- Déclaration des états.
- Paramétrage des transitions internes et externes.
- Spécification des délais et des événements générés.
- Interaction optionnelle avec l’IA pour générer ou compléter automatiquement le comportement via des prompts.

### 4.3 Finalisation
- Sauvegarde dans la librairie choisie.
- Ajout automatique aux outils d'édition et de simulation.

---

## 5. Création d’un Modèle Couplé

### 5.1 Informations Initiales
- Nom du modèle.
- Description.
- Définition des ports externes pour l'entrée et la sortie du système.

### 5.2 Construction du Modèle
- Sélection ou création de sous-modèles :
  - Ajout de modèles atomiques ou couplés existants.
  - Création de nouveaux modèles directement dans l'éditeur du modèle couplé.

- Configuration des liens internes :
  - Connexion des ports internes entre les sous-modèles.
  - Mapping des ports externes du modèle couplé avec les ports internes des composants.

### 5.3 Assistance IA
L'utilisateur peut demander à l’IA :
- De proposer une organisation optimale des sous-modèles.
- De générer automatiquement les connexions en fonction des spécifications données.

### 5.4 Validation
- Vérification de la cohérence du modèle.
- Simulation test (optionnelle).
- Sauvegarde et publication dans la librairie sélectionnée.

---

## 6. Gestion et Organisation
- Chaque modèle est stocké dans une librairie spécifique, permettant :
  - La réutilisation dans différents diagrammes.
  - Une organisation thématique ou projet par projet.
  
- Les librairies sont visibles et modifiables via la sidebar, avec des actions rapides pour :
  - Ajouter des modèles.
  - Importer/exporter des modèles.
  - Supprimer ou dupliquer des éléments.

---

