# Spécification étendue — Simulateur Parallèle DEVS basé sur Kafka

Ce document rassemble les décisions de conception, protocoles et pseudo-algorithmes pour un simulateur **Parallel DEVS (PDEVS)** où chaque modèle est exécuté dans un **runner** indépendant et la communication se fait via **Apache Kafka**.

> **Objectif** : fournir une spécification pratique (KISS) qui réponde aux points en suspens : élection du temps, gestion des priorités, événements simultanés, persistance/reprise, tolérance aux pannes.

---

## Rappel du contexte

* **Architecture** : 1 runner = 1 modèle DEVS.
* **Middleware** : Kafka.
* Informations Disponible a ce jour pour chaque runner: Chaque runner connaît `N`, le nombre total de modèles (via config ou découverte).
* Cycle général : initialisation → proposition `t_next` → élection du prochain temps `T` (min strictement > t\_current) → exécution (δint / δconf / δext) → diffusion des événements -> execution δext (ou pas) -> proposition `t_next` -> ....

---

## Options d'architecture pour l'élection du temps

### Option A — Décentralisée (sans coordinateur)

**Principe**

* Chaque runner publie sa proposition `time_proposal` dans Kafka.
* Chaque runner collecte `N` propositions (ou attend un timeout) et calcule localement `T = min(propositions > t_current)`.
* Tous doivent aboutir au même `T` si la transmission est fiable et déterministe.

**Avantages**

* Pas de point central de décision (pas de SPOF).

**Inconvénients**

* Overhead réseau & CPU : tous les runners doivent lire toutes les propositions.
* Robustesse faible si certains runners sont lents ou perdent des messages (il faut gérer timeouts et heuristiques).
* Déterminisme fragile si l'ordre de réception diffère.

**Messages (exemple)**

```json
{ "type": "time\_proposal", "round": 17, "runner\_id": "R1", "t\_next": 42, "priority": 10 }
```

**Notes**

* Nécessite un `round`/`epoch` pour regrouper les propositions du même tour.
* Politique de timeout : si N propositions non reçues, considérer les manquantes comme +∞ ou appliquer une règle locale pour la priorite d'execution.

---

### Option B — Coordonnateur léger (KISS)

@maliszewskid: Selon moi la meilleure solution en terme de performance et stabilite avec un service distinct. Par contre moins novatrice.

**Principe**

* Un **Coordinator** (processus léger) collecte les `time_proposal`, calcule `T` et publie `time_selected` avec l'ordre d'execution.
* Le coordinator est un service distinct ou un model elu pour devenir le coordinateur.

**Avantages**

* Simplicité du protocole côté runners (proposer + attendre l'annonce).
* Moins de charge réseau (une réduction centralisée).
* Facile à debug et à maintenir.

**Inconvénients**

* Introduit une entité de coordination (mais non nécessairement SPOF si on prévoit un failover).

**Protocole (exemple)**

```json
// proposal envoyer par un runner
{ "type":"time\_proposal", "round": 17, "runner\_id":"R1", "t\_next": 42, "priority": 10 }

// selected envoyer par un coordinateur ids est un tableau pour garder la possiblite du run en parallèle de plusieurs modeles
{ "type":"time\_selected", "round": 17, "T": 42, "order": \[{ids: "R1"}, {"ids": "R2"}] }
```

#### Failover du coordinateur

**Role runner/coordinateur: Double casquette**

* Élection simple via topic : le premier qui se manifeste devient coordinateur.
* Si le coordinateur meurt ou ne repond plus, un nouveau candidat sera elu (Apres X secondes sans ordre). L'ancien redevient runner uniquement
* Tous les runners possede la fonctionnalite de coordinateur mais un seul s'en sert de son vivant.

**Service coordinateur distinct**

* Plusieurs services peuvent etre lance en parallèle, un chef de coordination est alors elu via un echange de message Kafka.

```json
{ type:coordinator_representant, id: C1}
{ type:coordinator_representant, id: C2}
{ type:coordinator_representant, id: C3}
{ type:coordinator_elected, id: C1, failover: [C2, C3]}
```

* Si un coordinateur ne repond au bout de X seconds son suppleant prend le relais et devient le chef des coordinateurs. L'ancien coordinateur devient suppleant.

```json
// Apres X seconds definit dans la configuration. Le message est envoye par son premier suppleant
{ type:coordinator_missing, id: C1, message: No order after X seconds}
{ type:coordinator_elected, id: C2, failover: [C3, C1]}
```

* SI un message est recu pendant la reelection alors le nouveau chef renvoit le message de l'ancien chef pour eviter un conflit de decision

---

## Gestion des priorités & Confluent

### Objectif

* Quand plusieurs runners ont `t_next == T`, il faut définir un ordre d'exécution déterministe et gérer la fonction confluente pour les non-premiers.

### Règle proposée

1. Chaque proposition inclut `priority` (int). Plus petit = plus prioritaire.
2. En cas d'égalité, tie-breaker = index du runner dans le tableau des models lexicographique.
3. L'ordre est `sort(priority, runner_idx)` ascendant.

**Comportement**

* Le runner en position 0 (premier) exécute **δint** puis publie ses événements.
* Les autres (t\_next == T) attendent l'ordre et exécutent **δconfluent** (combine δint et δext en tenant compte des événements produits par les précédents).

**Message `time_selected` enrichi**

```json
{
"type": "time\_selected",
"round": 17,
"T": 42,
"proposals": \[
{"runner\_id":"R2", "t\_next":42, "priority":2},
{"runner\_id":"R1", "t\_next":42, "priority":1}
],
"order": \["R1","R2"]
}
```

**Confluent function (implémentation suggérée)**

1. Les non-premiers lisent les événements publiés par les précédents dans l'ordre de priorite (via le topic Kafka, idéalement clé/offset par `round`).
2. Ils exécutent `δconf`.
3. Ils publient ensuite leurs sorties (si il y en a).

**Optimisations**

* Utiliser un topic single-partition (ou keyed by `round`) pour garantir l'ordre strict de simulation pour un temps T.
* Autoriser exécution parallèle pour les modèles indépendants.

---

## Événements simultanés & déterminisme

### Règle générale

* L'ordre de traitement pour `t == T` doit être **globally deterministic**.
* Deux façons :

  * l'ordre explicite fourni par le coordinator
  * ou application d'une règle déterministe locale (priority + index) si mode décentralisé.

### Partitioning Kafka

* Pour la coordination, utiliser un topic **single-partition** ou une clé `round` garantissant que toutes les propositions d’un round sont ordonnées.

---

## Échecs et tolérance

* **Coordonnateur down** : prévoir élection via topic.
* **Runner down** : autres runners traitent les propositions manquantes selon une politique (wait / treat as +∞ / reconfiguration).
* **Partition Kafka** : topics sensibles (`time-proposals`, `time-selected`) sur 1 partition pour ordre.
* **Réseau lent** : timeouts & règles de progression (ex: proceed after timeout).

---

## Exemples JSON de messages

```json
// init\_done
{ "type": "init\_done", "runner\_id":"R1" }

// time\_proposal
{ "type":"time\_proposal", "round": 17, "runner\_id":"R1", "t\_next": 42, "priority": 10 }

// time\_selected
{ "type":"time\_selected", "round":17, "T":42, "order":\["R1","R2"] }

// event
{ "type":"event", "from":"R1", "round":17, "payload": { /* Payload de levent avec les ports de sortie et les valeurs si il y en a */ } }
```

---

## Information importantes,pratiques,futures

* **Partitioning** : garder le topic single-partition sur kafka pour garantir un ordre global.
* **Monitoring** : exposer les métriques (latence d'élection, nb de proposals, health checks) par exemple dans une stack ELK, EFK.
* **Tests** : fournir un mode test où le coordinator est embarqué (in-process) pour unit tests. (AOT: Ca s'est presque bon on a deja un test unitaire dans simulator qui lance un kafka pour le test)

---

## FUTURE: Persistance / Reprise (checkpoint & replay)

### Objectifs

* Permettre arrêt/reprise reproductible.
* Pouvoir rejouer la simulation depuis un snapshot.

### Stratégie recommandée

1. **Events as source-of-truth** : tous les événements & commandes publiés sur Kafka.
2. **Snapshots périodiques** : chaque runner prend un snapshot de son état et des offsets Kafka (ex : tous les X rounds).
3. **Reprise** : charger snapshot → repositionner offsets → rejouer events jusqu'au point courant.

**Exemple de snapshot**

```json
{
"runner\_id":"R1",
"last\_offset": 12345, // offset du topic kafka
"state": { /\* state serialisé \*/ },
"timestamp": 1670000000 // tps de simulation
}
```

**Transactions**

* Pour la plupart des simulations, **at-least-once + idempotence** au niveau modèle est parfait.
* `at-leat-once` : Cela veut dire que si que kafka s'assure que le message sera livrer au moins une fois au runner.
* `idempotence`: CEla veut dire que si un message est lu deux fois par un runner le resultat sera le meme.

Ainsi on assure que tous les runners recoivent le message et le possiblite qu'un doublon arrive ne pose aucun souci

