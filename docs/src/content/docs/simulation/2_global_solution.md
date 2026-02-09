# Architecture du simulateur DEVS distribué, multilangage, avec Kafka + gRPC

Ce document résume la solution que tu as conçue pour exécuter des modèles DEVS (atomic/coupled) de manière **distribuée** et **multilangage**, en combinant :

- des modèles stockés en base (JSON),
- un front qui construit des simulations,
- un **coordinateur**,
- des **runners** par langage,
- des **wrappers gRPC** qui encapsulent les modèles,
- et un bus **Kafka** pour synchroniser tout ce petit monde.

---

## 1. Objectifs du système

- Permettre à un utilisateur de composer une simulation à partir de modèles DEVS stockés en base (générateur, modèles métier, collecteur, etc.).
- Supporter plusieurs **langages d’implémentation** des modèles (Go, Python, plus tard C++, Rust, etc.).
- Garder une **architecture unifiée** : même protocole, même flux d’événements, même logique de simulation, quel que soit le langage du modèle.
- Pouvoir **observer finement l’état** des modèles :
  - logs,
  - événements,
  - snapshots complets d’état à chaque transition interne/externe.
- Rester extensible : l’ajout d’un langage doit être une “brique en plus”, pas une refonte.

---

## 2. Vue d’ensemble

### 2.1. Chaîne globale

1. Les modèles sont stockés en base de données (description + code) sous forme de **JSON**.
2. Le **front** permet à l’utilisateur de :
   - choisir des modèles existants,
   - les connecter (générateur → modèle → collecteur),
   - configurer les paramètres de simulation,
   - cliquer sur `Simuler`.

3. Le front construit un **manifeste de simulation** (runnable manifest) contenant :
   - les modèles utilisés,
   - leurs langages,
   - leurs connexions,
   - les paramètres (durée, options de logs, etc.),
   - les références au code.

4. Le manifeste est envoyé au **coordinateur**.

5. Le coordinateur :
   - lit le manifeste,
   - décide quels **runners** il faut lancer (Go, Python, …),
   - prépare les dossiers temporaires nécessaires,
   - démarre les runners correspondants.

6. Chaque runner :
   - lance ou contacte un **wrapper gRPC** qui encapsule un modèle (ou un groupe de modèles),
   - écoute un **topic Kafka**,
   - traduit les messages Kafka en appels gRPC (init, delta, lambda, etc.),
   - récupère les résultats (outputs, états),
   - renvoie les résultats dans Kafka.

7. Un service de visualisation / supervision peut consommer :
   - les **logs**,
   - les **snapshots d’état**,
   - les **événements de simulation**,
   pour afficher des graphiques, timelines, etc.

---

## 3. Composants principaux

### 3.1. Base de données & Front

- La base stocke :
  - des **modèles** (atomic/coupled) décrits en JSON,
  - les informations de langage (`"go"`, `"python"`, …),
  - éventuellement le code associé ou des références (path, repo, etc.).

- Le front :
  - récupère ces modèles,
  - permet à l’utilisateur de **composer un diagramme** (connecter les ports),
  - crée un **manifeste de simulation** avec :
    - liste des modèles,
    - langage de chaque modèle,
    - connexions (qui envoie à qui),
    - options de simulation (par ex. durée, modes de logs).

### 3.2. Coordinateur

Le coordinateur est le **chef d’orchestre global**.

Rôles :

- Recevoir le manifeste de simulation.
- Vérifier quels langages sont nécessaires.
- Préparer un **dossier de simulation** (par ex. `simulations/<id-simu>/`) qui contient :
  - les fichiers temporaires nécessaires pour chaque langage,
  - les scripts ou exécutables des runners,
  - les éventuels fichiers générés à partir de la base (code, config).
- Démarrer les **runners** pour chaque modèle / groupe de modèles :
  - par exemple en lançant un exécutable `runner-go` ou `runner-python` avec des arguments (ID de simulation, chemin du manifeste, etc.).
- Fournir les informations de connexion à **Kafka** (brokers, topics).
- Surveiller globalement la simulation si besoin (time-out, arrêt, etc.).

### 3.3. Pattern Factory pour les runners

Tu utilises un **pattern factory** pour éviter de saupoudrer partout des `if language == ...`.

Idée :

- Côté coordinateur (ou dans un module partagé), tu as une fonction conceptuelle du style :

  - `CreateRunner(language)` → retourne une structure/objet qui sait lancer le bon runner (Go, Python, etc.).

- La factory :
  - lit le champ `"language"` dans le manifeste,
  - choisit l’implémentation de runner adaptée,
  - masque les détails au reste du code (pour le coordinateur, c’est juste “un runner” avec une interface commune : `Start`, `Stop`, etc.).

Ainsi :
- Ce qui est **spécifique au langage** est concentré dans chaque implémentation de runner.
- La logique globale de simulation reste **indépendante** du langage.

### 3.4. Runner (boucle interne / internal loop)

Le **runner** est le “cerveau local” de la simulation pour un groupe de modèles (par langage).

Rôles principaux :

- Se connecter à **Kafka**.
- S’abonner au(x) **topic(s)** qui le concernent (par ex. un topic par simulation).
- Tourner dans une **boucle interne** :

  - lire un message Kafka,
  - vérifier si le message est pour lui (ID de modèle, ID de runner, etc.),
  - s’il est concerné, déclencher l’action correspondante via **gRPC**.

Exemples de messages interprétés par le runner :
- `INIT` → appeler `Init()` sur le modèle via gRPC.
- `IN_PORT` → appeler une méthode type `AddInput(port, value)` côté modèle.
- `INTERNAL_TRANSITION` → appeler la fonction DEVS interne (`delta_int`).
- `EXTERNAL_TRANSITION` → appeler `delta_ext`.
- `OUTPUT` → appeler `lambda`, puis renvoyer les sorties dans Kafka.
- `SNAPSHOT_REQUEST` → demander l’état complet et le publier dans un topic dédié.

Le runner :
- **ne contient pas** la logique métier du modèle,
- **ne fait que** :
  - traduire les messages Kafka en appels gRPC,
  - renvoyer les réponses/out via Kafka.

### 3.5. Wrapper gRPC + modèle

Pour chaque langage, tu as un **wrapper** dont le rôle est :

- Instancier le **modèle utilisateur** (Atomic DEVS, Coupled, etc.).
- Lancer un **serveur gRPC** qui expose des méthodes comme :
  - `Init()`
  - `AddInput(port, value)`
  - `DeltaInt()`
  - `DeltaExt()`
  - `Lambda()`
  - `GetState()` (pour les snapshots)
- Appliquer ces méthodes sur le modèle.

Important :  
Le wrapper gRPC est volontairement **“idiot”** :

- Il ne gère pas Kafka.
- Il ne décide pas de la logique de simulation globale.
- Il répond juste aux ordres qu’on lui envoie, en appliquant les fonctions sur le modèle.

Pour un langage donné :

- Tu as un fichier du type `main.go`, `main.py`, etc. qui :
  - charge ou génère le modèle à partir de la description JSON,
  - instancie le modèle `Atomic` ou `Coupled`,
  - démarre le serveur gRPC.

---

## 4. Kafka : bus d’événements de simulation

Kafka est au cœur de la communication entre les processus.

Typiquement, tu peux avoir au moins trois familles de topics :

1. **Control / Events**  
   - Messages de coordination de la simulation :
     - `INIT_MODEL`
     - `STEP`
     - `STOP`
     - `MODEL_OUTPUT`
     - `DONE`
   - Ce topic est consommé par les **runners**.

2. **Data / Snapshots**  
   - À chaque transition (interne ou externe), le runner demande un **snapshot** de l’état du modèle au wrapper gRPC.
   - L’état est sérialisé (JSON, par ex.) et publié dans un topic `SimulationData`.
   - Cela permet :
     - de tracer toute l’évolution du modèle,
     - de construire des courbes, timelines,
     - de faire de l’analyse a posteriori.

3. **Logs**  
   - Messages de logs textuels ou structurés.
   - Permettent debug et supervision.

---

## 5. Représentation des états (snapshots)

À chaque transition **interne** ou **externe**, c’est le bon moment pour capturer l’état du modèle (ce sont les seuls moments où l’état change).

### 5.1. Objectif

- Avoir une vision complète (ou au moins cohérente) de l’état du modèle au cours du temps.
- Pouvoir :
  - filtrer,
  - agréger,
  - construire des graphiques détaillés,
  - rejouer (“time travel debugging”).

### 5.2. Stratégies possibles

1. **Snapshot complet** :
   - À chaque transition, le wrapper gRPC renvoie *toutes* les variables d’état, y compris la structure des ports.
   - Avantage : simple, toujours cohérent.
   - Inconvénient : plus verbeux.

2. **Snapshot delta** :
   - Le wrapper renvoie uniquement les variables qui ont changé depuis la transition précédente.
   - Avantage : moins de volume.
   - Inconvénient : nécessite de recomposer l’état complet côté consommateur.

### 5.3. Gestion de la structure interne

Dans ton cas, un modèle `Atomic` en Go peut contenir une structure `Component`, qui elle-même contient des `Ports` (`In`, `Out`, etc.).

Pour les snapshots, tu peux :

- Parcourir `Atomic → Component → Ports`.
- Transformer ça en une **structure JSON aplatie**, par exemple :

  - un champ `variables` (état interne),
  - un champ `ports.in`,
  - un champ `ports.out`.

L’idée :  
Peu importe la structure interne réelle du modèle ou du langage, le **format d’état** envoyé sur Kafka doit être **unifié**.

---

## 6. Ajout d’un nouveau langage

L’ajout d’un langage suit toujours la même logique :

1. **Wrapper gRPC pour ce langage** :
   - Implémenter le serveur gRPC qui expose les mêmes méthodes que les autres (Init, DeltaInt, DeltaExt, Lambda, GetState, etc.).
   - Ce serveur encapsule un modèle écrit dans le nouveau langage.

2. **Runner spécifique** (ou extension d’un runner existant) :
   - Implémenter la boucle Kafka pour ce langage.
   - Traduire les messages Kafka en appels gRPC vers le wrapper de ce langage.
   - Publier les résultats sur les bons topics Kafka.

3. **Factory** :
   - Étendre le **pattern factory** pour ce langage :
     - par exemple : si `language == "python"`, créer un `PythonRunner`.
     - si `language == "go"`, créer un `GoRunner`, etc.

4. **Manifeste** :
   - Dans la description de simulation, indiquer pour chaque modèle le `language` correspondant.
   - Le coordinateur utilisera cette information pour choisir les bons runners via la factory.

5. **Protobuf** :
   - Recompiler le fichier `.proto` pour ce langage.
   - Veiller à ce que les signatures gRPC soient cohérentes avec celles des autres langages.

Ainsi, l’ajout d’un langage consiste surtout à :

- écrire un **wrapper gRPC**,
- écrire (ou adapter) un **runner**,
- brancher le tout dans la **factory**.

---

## 7. Pourquoi Kafka + gRPC (et pas seulement gRPC)

Tu peux résumer ainsi :

### 7.1. Rôle de gRPC

- Fournir un **contrat fort** entre le runner et le modèle.
- Assurer :
  - types bien définis,
  - compatibilité multilangage,
  - communication rapide et structurée.
- Le gRPC ne gère que :
  - les **appels de fonctions** (Init, Delta, Lambda, GetState, etc.),
  - dans une relation “runner ↔ modèle”.

### 7.2. Rôle de Kafka

- Servir de **bus de messages** entre tous les composants de la simulation.
- Avantages :
  - asynchronisme,
  - tolérance aux pannes,
  - plusieurs consommateurs possibles (logs, monitoring, UI…),
  - possibilité de relecture (replay) si besoin.

### 7.3. Combinaison des deux

- Kafka gère le **“quoi”** et le **“quand”** (événements de simulation, universalité des messages).
- gRPC gère le **“comment”** (exécution concrète de la logique du modèle dans un langage donné).

Tu peux dire que :

> Kafka amène la **scalabilité** et le **découplage**,  
> gRPC amène la **structure** et le **multilangage propre**.

---

## 8. Points forts de ta solution

- **Multilangage réel** :
  - chaque modèle peut être dans un langage différent,
  - ajout de nouveaux langages sans casser l’existant.

- **Découplage fort** :
  - les runners et les modèles sont séparés,
  - les modèles ne “connaissent” pas Kafka,
  - le gRPC server reste simple (“idiot”).

- **Architecture modulaire** :
  - coordinateur,
  - runners,
  - wrappers,
  - bus Kafka,
  chacun a un rôle clair.

- **Pattern factory** :
  - un point unique pour décider quel runner créer,
  - code plus propre,
  - plus facile à maintenir et à faire évoluer.

- **Traçabilité** :
  - snapshots d’état à chaque transition DEVS,
  - logs centralisés dans Kafka,
  - idéal pour debug, analyse, V&V, visualisation.

- **Extensibilité** :
  - on peut brancher des services de monitoring, d’analytics, de visualisation, sans toucher à la logique des modèles.

---

## 9. Limites et points faibles

- **Complexité globale** :
  - plusieurs niveaux de processus (coordinateur, runners, wrappers, Kafka),
  - plus difficile à déployer et superviser qu’un monolithe simple.

- **Overhead** :
  - appels gRPC + messages Kafka → overhead réseau et sérialisation,
  - surtout si les modèles sont très nombreux ou les transitions très fréquentes.

- **Gestion multilangage** :
  - chaque langage impose :
    - un wrapper gRPC,
    - une gestion spécifique des dépendances (runtime, libs, etc.),
  - plus il y a de langages, plus il y a de points de maintenance.

- **Besoin d’une infra Kafka** :
  - demande une stack un peu lourde (cluster Kafka, monitoring Kafka, etc.),
  - pas trivial pour des petites installations locales (mais très puissant en prod).

---

## 10. Pistes d’évolution

Tu peux encore améliorer / étendre ton système en :

- Intégrant un **système de configuration centralisée** (pour les topics, les timeouts, etc.).
- Ajoutant un **service de visualisation temps réel** des snapshots :
  - timeline,
  - état des ports,
  - graphe de la topologie du modèle.
- Enrichissant les **outils de replay** :
  - rejouer une simulation à partir des topics Kafka,
  - avancer / reculer dans le temps,
  - comparer deux runs.
- Containerisant chaque runner / wrapper pour simplifier le déploiement (Docker, Kubernetes, etc.).

---

## 11. Résumé en une phrase

Ta solution, c’est :

> Un simulateur DEVS distribué, basé sur un coordinateur, des runners multilangages choisis via un pattern factory, des wrappers gRPC “idiots” autour des modèles, et Kafka comme colonne vertébrale de la communication, avec en bonus un traçage fin de tous les états à chaque transition.

