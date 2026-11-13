# Comprendre l’architecture de DEVSForge : intégrations, éditeur, LSP et IA

Ce guide explique les modifications réalisées et le rôle de chaque partie du code. Il commence par le fonctionnement général, puis détaille les fichiers à consulter.

## 1. La vue d’ensemble

L’application comporte trois grands parcours : **éditer un modèle**, **le simuler** et **demander une génération à l’IA**.

```text
Navigateur
  ├── Onglets et brouillons : WorkbenchProvider
  ├── Éditeur de code : Monaco
  └── Diagrammes et conversation IA
          │
          ▼
Backend : authentification, propriété des modèles, API
  ├── PostgreSQL : modèles sauvegardés et références d’intégration
  ├── Service LSP : aide pendant l’écriture du code
  ├── Simulateur : exécution des modèles
  └── Fournisseur IA : génération demandée par l’utilisateur
```

**Ouvrir un éditeur lance l’analyse du code, pas une simulation.** Cela ne déclenche pas non plus une génération IA.

Le catalogue des intégrations fournit les ressources communes à ces parcours : langage, bibliothèque de modélisation, template, instructions IA et configuration des outils.

## 2. Les mots à bien distinguer

| Terme | Ce qu’il représente ici |
| --- | --- |
| Modèle DEVS | Ton modèle atomique ou couplé, avec son identifiant, ses ports, son code ou ses composants. |
| Bibliothèque dans l’interface | Un regroupement de modèles appartenant à un utilisateur. |
| Bibliothèque de modélisation | Les classes et fonctions utilisées par le code, par exemple `Atomic` dans les fichiers `modeling`. |
| Intégration | L’association d’un langage, d’un framework, d’une version et de ses ressources. |
| Document Monaco | Le texte ouvert dans l’éditeur, avec une URI et un historique d’annulation en mémoire. |
| Espace LSP | L’environnement temporaire côté serveur qui analyse plusieurs documents d’une même intégration. Les routes API l’appellent aussi « session ». |
| Wrapper | Le programme qui adapte un modèle au protocole d’exécution de DEVSForge. |
| Préparation | Le code Go qui prépare le projet d’un modèle et, pour une simulation, construit puis lance son wrapper. |

Un modèle enregistré, un document Monaco et un projet temporaire LSP ont donc des responsabilités différentes. Modifier le document ne sauvegarde pas immédiatement le modèle en base.

## 3. Pourquoi une intégration plutôt qu’un simple langage ?

Le mot « Java » ne suffit pas à déterminer comment préparer un modèle. Deux frameworks Java peuvent avoir des classes, des dépendances et des conventions différentes.

Les références actuelles sont :

| Identifiant | Version | Libellé | Langage de l’éditeur |
| --- | --- | --- | --- |
| `xdevs-python` | `1.0.0` | xDEVS Python | `python` |
| `xdevs-go` | `1.0.0` | xDEVS Go | `go` |
| `xdevs-java` | `1.0.0` | xDEVS Java | `java` |
| `ms4me-java` | `1.0.0` | MS4 Me Java | `java` |

Une future intégration utilisant un autre framework Java pourrait avoir son propre identifiant, tout en gardant `java` pour la coloration du code.

Les intégrations actuelles conservent les adaptateurs de modélisation de DEVSForge inspirés de xDEVS. Leur nom ne garantit pas qu’un modèle provenant d’un projet xDEVS externe fonctionne directement sans adaptation.

### Où est la définition ?

Chaque intégration se trouve dans [simulator/runner/integrations](../simulator/runner/integrations/).

```text
simulator/runner/integrations/
├── registry.go
├── xdevs-python/
│   ├── integration.json
│   ├── prepare.go
│   ├── analysis.go
│   ├── wrapper/
│   ├── templates/atomic.tmpl
│   ├── ai/model.md
│   ├── generate-proto.sh
│   └── README.md
├── xdevs-go/
└── xdevs-java/
```

| Élément | Rôle |
| --- | --- |
| `integration.json` | Déclare l’identité, la version, les chemins, la préparation et les moteurs LSP. |
| `wrapper/` | Contient les vraies sources de modélisation, l’adaptation RPC et les fichiers de dépendances. |
| `prepare.go` | Prépare les sources et contient le parcours de construction/lancement du wrapper. |
| `analysis.go` | Adapte ce projet pour l’analyse LSP : liens vers les bibliothèques, identités de projets, etc. |
| `templates/atomic.tmpl` | Fournit le code initial d’un modèle. |
| `ai/model.md` | Contient les instructions spécifiques de génération de code. |
| `generate-proto.sh` | Génère les fichiers de communication nécessaires à cette intégration. |

Le [chargeur du catalogue](../simulator/shared/integrations/catalog.go) lit les définitions depuis `INTEGRATIONS_DIR`, vérifie les ressources et expose leurs capacités. Le frontend récupère ce catalogue avec `GET /integrations`.

### Qu’est devenue la liste des langages en base ?

Un modèle atomique référence maintenant `integrationId` et `integrationVersion`. La base conserve une projection du catalogue pour vérifier ces références avec une clé étrangère. Les définitions versionnées dans le dépôt restent la source de configuration.

La [migration du catalogue](../back/database/migrations/000010_integration_catalog.up.sql) remplace les anciennes valeurs `python`, `go` et `java` par les trois intégrations initiales. Elle supprime la colonne historique et le type SQL `model_language`.

Le champ `language` peut toujours apparaître dans les réponses API : il est déduit de l’intégration. Les anciennes entrées et routes de langues restent des adaptateurs de compatibilité.

**Un modèle couplé ne porte pas d’intégration.** Ses composants atomiques peuvent utiliser des intégrations différentes.

Les enums qui concernent les types de modèles ou les directions des ports restent utiles et sont conservés.

## 4. Monaco et LSP : qui fait quoi ?

**Monaco est le composant d’édition dans le navigateur.** Il affiche le texte, la coloration, le curseur, les suggestions et les erreurs.

**Les moteurs de langage analysent le projet.** Le protocole LSP permet au navigateur de leur transmettre des demandes et de recevoir leurs résultats.

Par exemple, pour compléter `self.` en Python :

1. Le code importe `Atomic` depuis `modeling`.
2. Pyright dispose des véritables sources de cette bibliothèque dans le projet d’analyse.
3. Il analyse l’héritage et les méthodes accessibles.
4. Monaco lui demande les suggestions à la position du curseur.
5. Pyright renvoie notamment `get_phase`, et Monaco affiche les propositions.

Le même principe permet d’aider sur les imports et les bibliothèques standard. L’analyse reste dépendante des informations disponibles : un code Python très dynamique peut donner des résultats moins précis qu’un code bien typé.

### Les moteurs installés

| Intégration | Moteurs | Utilisation principale |
| --- | --- | --- |
| Python | Pyright et Ruff | Analyse, complétion et navigation ; diagnostics et formatage complémentaires. |
| Go | gopls | Analyse, complétion, navigation et formatage. |
| Java | Eclipse JDT LS | Analyse du projet Java, complétion, navigation et formatage. |

Pour Java, les modèles restent prévus pour **Java 21**. Le moteur JDT LS installé utilise séparément **Java 25** pour fonctionner.

Les fonctionnalités branchées comprennent la complétion, le survol, les signatures, les diagnostics, les définitions, les références, le formatage, le renommage et les corrections prises en charge par les moteurs. Le résultat dépend aussi des capacités du moteur et du projet analysé.

## 5. Le trajet exact entre l’éditeur et le LSP

```text
Monaco dans le navigateur
        │
        │ HTTP : acquérir l’espace et attacher le document
        ▼
Backend : vérifie l’utilisateur et la propriété du modèle
        │
        │ HTTP interne
        ▼
Service lsp : prépare le projet et lance les moteurs

Puis, pendant l’édition :

Client LSP du navigateur
        ⇄ WebSocket ⇄ Backend ⇄ Service lsp ⇄ entrée/sortie standard du moteur
```

Le service `lsp` utilise le binaire du runner avec l’option `--lsp-daemon`. Dans ce mode, il gère l’analyse sans initialiser Kafka.

### Ce qui se passe à l’ouverture d’un modèle

1. Le frontend retrouve ou ouvre son onglet.
2. Il initialise Monaco et retrouve le document déjà en mémoire, s’il existe.
3. Il demande un espace LSP en transmettant le code actuellement affiché, y compris les changements non sauvegardés.
4. Pour un modèle existant, le backend vérifie son propriétaire et résout son intégration depuis le modèle enregistré.
5. Le service LSP retrouve un espace compatible ou en prépare un nouveau.
6. Il attache un petit projet propre au document et renvoie les URI et les connexions nécessaires.
7. Le frontend établit les connexions aux moteurs ou réutilise celles déjà ouvertes.
8. Les demandes et diagnostics circulent ensuite pendant l’édition.

Le frontend ne possède donc pas une seconde implémentation de `modeling`. L’environnement d’analyse utilise les ressources de l’intégration côté serveur.

### Que signifie une URI ?

Une URI identifie le document auquel se rapportent une modification, une erreur ou une définition. Exemple simplifié :

```text
file:///tmp/devsforge-lsp-xxxx/projects/document-a/model.py
```

C’est un fichier du projet temporaire dans le conteneur LSP. Ce chemin ne désigne pas un fichier créé sur le disque de ton ordinateur par le navigateur.

## 6. Pourquoi plusieurs modèles peuvent partager un serveur

La clé de partage est :

```text
utilisateur + fenêtre de travail + intégration + version
```

Exemple : tu ouvres `light `, `switch` et un modèle Java dans une même fenêtre.

```text
Fenêtre de travail
├── Espace xdevs-python@1.0.0
│   ├── Pyright
│   ├── Ruff
│   ├── Projet du document light
│   └── Projet du document switch
└── Espace xdevs-java@1.0.0
    ├── JDT LS
    └── Projet du document Java
```

Cela représente **deux espaces et trois moteurs**, même si trois modèles sont ouverts. Ajouter un autre modèle Python dans cette fenêtre réutilise les moteurs Python.

Les bibliothèques métier dans lesquelles sont rangés les modèles ne font pas partie de cette clé. Deux modèles Python de deux bibliothèques peuvent donc partager l’analyse.

Chaque document garde néanmoins son propre projet : deux fonctions Go ou deux classes Java de même nom doivent pouvoir être analysées sans être confondues. Les modules Go et les projets Java reçoivent des identités distinctes.

Deux comptes ou deux fenêtres indépendantes ne partagent pas leurs espaces ni leurs brouillons. Fermer un onglet retire son document ; cela ne ferme pas automatiquement les moteurs utilisés par les autres onglets.

Le projet d’analyse préparé reste en cache dans cet espace, même après fermeture de son onglet. Cela évite de décharger des ressources Java encore utilisées par l’analyse d’un autre modèle. À la réouverture, on réutilise les bibliothèques et les métadonnées, puis on remet le code courant avec une nouvelle version de document. Tous ces projets temporaires sont supprimés avec l’espace LSP, notamment après quinze minutes d’inactivité ou lors de sa libération sous pression.

### Les projets temporaires

L’organisation ressemble à ceci ; les détails varient selon le langage :

```text
/tmp/devsforge-lsp-xxxx/
├── projects/
│   ├── document-a/
│   │   ├── fichier du modèle
│   │   ├── configuration du projet
│   │   └── accès aux bibliothèques de l’intégration
│   └── document-b/
└── données privées des moteurs, notamment l’index Java
```

La préparation réutilise celle des sources de simulation, puis applique les adaptations d’analyse. Des liens permettent de consulter les sources de bibliothèque communes. Les écritures autorisées par la passerelle restent limitées aux documents utilisateur attachés.

## 7. Les modifications de texte, les noms et les erreurs

### Pendant la frappe

Le client envoie des messages LSP tels que :

- `textDocument/didOpen` : le document est ouvert ;
- `textDocument/didChange` : son contenu a changé ;
- `textDocument/completion` : une complétion est demandée ;
- `textDocument/didClose` : le document est fermé.

Les changements peuvent décrire uniquement une portion modifiée. Le service les applique avec les positions UTF-16 utilisées par LSP, ce qui compte notamment pour certains caractères et les emojis.

Pyright et Ruff suivent le même document. La version du document permet de ne persister qu’une fois une modification reçue par les deux connexions.

Écrire dans ce fichier temporaire sert à l’analyse. **Cela ne sauvegarde pas le modèle dans PostgreSQL.**

### Le cas de `light `

Le nom affiché comportait un espace final. Il était traité comme s’il devait obligatoirement servir d’identifiant de source.

La distinction est maintenant la suivante :

| Information | Exemple |
| --- | --- |
| Nom affiché du modèle | `light ` |
| Identifiant métier | L’identifiant du modèle en base. |
| Identité du document | L’identité technique utilisée pour son projet d’analyse. |
| Fichier Python | `model.py` |
| Fichier Go | `model.go` |
| Fichier Java | Déduit du type public déclaré dans le code. |

Un modèle Java affiché « Mon compteur » et déclarant `public class Counter` est ainsi analysé dans un fichier `Counter.java`.

Cette correction ne renomme pas les modèles existants et ne réécrit pas leur code. Les validations de sauvegarde ne bloquent plus un nom existant simplement parce qu’il n’est pas un identifiant de programmation.

### Si l’assistance est indisponible

Le code reste éditable. Les documents de secours conservent le contenu et leur historique en mémoire pendant la navigation. Une reconnexion utilise le contenu courant.

Le message doit permettre de distinguer une demande invalide, une capacité saturée ou un problème de démarrage. Un diagnostic de syntaxe produit par le moteur est, lui, un résultat de l’analyse du code.

Une notification de fermeture arrivée après le retrait d’un document est prise en compte sans arrêter les moteurs des autres documents.

## 8. Les onglets et la récupération des fichiers

Les onglets représentent les modèles ouverts depuis la navigation ou un lien direct. Un modèle déjà ouvert est activé au lieu d’être ajouté une seconde fois. Les modèles couplés disposent également d’onglets, avec leur diagramme.

Le header ShadCN de 48 px conserve le chemin et les actions. Les onglets occupent une seconde barre de 34 px. Les couleurs restent celles du thème de l’application. Les actions affichent leur texte à partir de 1280 px ; sur tablette, leurs icônes et leurs infobulles restent disponibles.

Les onglets se déplacent à gauche ou à droite par glisser-déposer, à la souris ou au toucher. Au clavier, `Alt` + flèche gauche/droite déplace l’onglet qui a le focus ; les flèches seules changent de modèle. L’ordre est conservé avec les brouillons locaux. Réordonner les onglets ne sauvegarde pas les modèles et ne redémarre pas le LSP.

Le [WorkbenchProvider](../front/src/providers/WorkbenchProvider.tsx) est placé au-dessus des pages authentifiées. Il garde l’état commun lorsque l’on change de route : onglets, contenu, propriétés et brouillons des générateurs.

| Emplacement | Ce qui y est conservé |
| --- | --- |
| Mémoire du navigateur | Documents Monaco, historique d’annulation pendant la navigation, état courant de l’interface. |
| IndexedDB | Copies locales des onglets, brouillons, diagrammes et conversations. |
| sessionStorage | Pointeur de récupération propre au compte et à la fenêtre, avec une copie de secours lors de la sortie de page. |
| PostgreSQL | Modèles effectivement sauvegardés par l’API. |
| Disque temporaire du service LSP | Sources et fichiers nécessaires à l’analyse. |

Un changement d’onglet ne fait pas de sauvegarde serveur. Les actions existantes de sauvegarde, simulation et validation concernent le modèle de l’onglet actif.

Fermer un onglet modifié propose **Enregistrer**, **Abandonner** ou **Annuler**.

Après rechargement, les brouillons sont restaurés et l’analyse est reconnectée en arrière-plan. L’historique d’annulation Monaco est conservé pendant la navigation, mais il n’est pas sérialisé pour le rechargement.

Une nouvelle instance de page utilise une nouvelle identité de travail. Lorsqu’une fenêtre récupère une copie d’un état précédent, ses modifications deviennent ensuite indépendantes. Le stockage navigateur est séparé par compte ; le backend contrôle pour sa part l’identité authentifiée de l’utilisateur.

Les copies locales ne constituent pas une sauvegarde distante : supprimer les données du navigateur peut les supprimer. Les erreurs de récupération locale sont signalées dans l’interface.

## 9. La simulation, le runner, le wrapper et gRPC

Le circuit d’exécution reste distinct du circuit LSP :

```text
Demande de simulation
        ▼
Backend → Coordinateur
              │
              │ Kafka : messages de simulation
              ▼
            Runner
              │
              │ gRPC : appels au modèle
              ▼
            Wrapper du langage
              ▼
            Modèle + bibliothèque de modélisation
```

Le coordinateur organise la simulation. Le runner prépare et pilote l’exécution d’un modèle. Le wrapper expose les opérations attendues par le runner et appelle le modèle dans son langage.

### Pourquoi les fichiers de préparation restent spécifiques

Construire un projet Go, préparer Python et construire un projet Maven Java demandent des opérations différentes. Ces préparations restent écrites en Go et enregistrées explicitement dans le [registre des préparations](../simulator/runner/integrations/registry.go).

Le registre distingue :

| Opération | Utilisation |
| --- | --- |
| `Sources` | Prépare les fichiers du projet. C’est la partie commune réutilisée pour l’analyse. |
| `Analysis` | Adapte le projet au LSP et à l’isolation de ses documents. |
| `Launch` | Construit si nécessaire et lance le wrapper pour la simulation. |
| `SourceName` | Permet notamment à Java de déterminer le nom du fichier depuis le code. |

Le LSP utilise la préparation des sources et l’adaptation d’analyse. Il n’appelle pas le lancement de simulation.

### Où est maintenant le protocole ?

Le contrat commun est [simulator/proto/devs.proto](../simulator/proto/devs.proto). Les fichiers Go générés sont regroupés dans [simulator/shared/proto](../simulator/shared/proto/), car ils servent à la communication commune plutôt qu’à une seule bibliothèque de modélisation.

Chaque wrapper conserve son adaptation serveur RPC dans son langage. Déplacer les fichiers Go communs ne supprime donc pas les serveurs Python ou Java.

Si le contrat ne change pas, ajouter une intégration ne nécessite pas de régénérer tous les langages déjà présents. Un nouveau langage peut nécessiter la génération de ses propres bindings. Un autre framework utilisant un langage déjà pris en charge peut réutiliser des bindings compatibles.

Le LSP échange aussi des messages structurés, mais ce ne sont pas les appels gRPC du protocole de simulation DEVS.

## 10. Ce qui a changé pour les générateurs IA

### Génération de code et intégrations

Le catalogue fournit les intégrations disponibles pour la génération. Les instructions sont construites à partir du template, du prompt spécifique et des sources de modélisation sélectionnées par la définition.

Cela évite de maintenir manuellement une copie de la bibliothèque dans le frontend. Les candidats de réutilisation sont filtrés par intégration, version et propriétaire. Les références d’intégration suivent le modèle jusqu’à sa sauvegarde.

### Hiérarchie des modèles couplés

L’aperçu développe maintenant les occurrences récursivement :

```text
Système
└── Sous-système
    └── Sous-sous-système
        └── Modèle atomique
```

Chaque occurrence possède son vrai parent et une position relative à ce parent. Les modifications du diagramme sont répercutées dans la structure utilisée pour générer et sauvegarder les modèles.

Une connexion indique son modèle couplé propriétaire avec `owner`. Ce propriétaire détermine le niveau auquel la connexion est valide : entre ses enfants directs, depuis une de ses entrées vers un enfant, ou depuis un enfant vers une de ses sorties.

Une connexion ne peut pas traverser arbitrairement plusieurs niveaux. Pour une ancienne structure sans `owner`, celui-ci est déduit uniquement si le niveau est sans ambiguïté.

Deux cycles sont à distinguer :

- **Cycle d’imbrication** : A contient B, qui contient A. Cette structure est refusée.
- **Boucle de couplage DEVS** : des sorties reviennent vers des entrées dans une structure valide. Ce retour reste autorisé.

Les sauvegardes créent les enfants avant leurs parents. Les positions des composants sont transmises dans les métadonnées existantes.

### Discussion et propositions

Le panneau commun aux générateurs DEVS et EF conserve le prompt initial et l’historique. Pour une correction, il envoie la structure courante avec la demande ; le code des modèles est joint uniquement si l’utilisateur le sélectionne.

```text
Structure actuelle
      + demande de correction
              ▼
         Proposition IA
          ├── Refuser → la structure reste inchangée
          └── Accepter → application après validation
```

Une proposition invalide expose ses problèmes et ne peut pas être acceptée. Si la structure courante a changé depuis la demande, il faut obtenir une proposition actualisée.

L’acceptation conserve le code déjà écrit et ses références d’intégration. Un changement d’interface marque les modèles concernés « à revalider » : il faut vérifier leur code avant de poursuivre la sauvegarde.

L’historique envoyé est borné aux six derniers messages en plus de la demande initiale et du contexte courant. Un contenu trop volumineux produit une erreur explicite. Restaurer un brouillon ou accepter une proposition ne déclenche pas automatiquement une génération payante.

### Particularité des cadres expérimentaux, ou EF

Le modèle sous test reste une référence vers le modèle existant. S’il est couplé, sa structure interne et son code sont conservés en base. L’IA construit le cadre autour de cette référence.

L’interface protège cette référence contre la suppression et l’ajout de composants dans ses internes depuis l’aperçu du générateur.

## 11. Performances et mémoire : ce qui est partagé et ce qui coûte

Le démarrage comporte plusieurs étapes : chargement de Monaco, acquisition du projet, attente éventuelle, lancement du moteur, puis indexation suffisante pour produire une réponse utile.

**Un moteur initialisé n’a pas forcément terminé l’indexation de son projet.** C’est particulièrement visible en Java.

Les optimisations réalisées comprennent le préchargement de Monaco après authentification pendant une période disponible du navigateur, la préparation des dépendances dans les images, la réutilisation des moteurs et la conservation de leurs index privés pendant leur vie.

Le serveur n’est pas reconstruit à chaque frappe ou à chaque changement d’onglet.

| Réglage | Valeur initiale |
| --- | --- |
| Limite mémoire du conteneur LSP | 4 Gio |
| Espaces actifs au total | 6 |
| Espaces Java actifs | 2 maximum |
| Initialisations de moteurs simultanées | 2, dont une Java maximum |
| Expiration sans interaction utilisateur | 15 minutes |
| Tas maximal du moteur Java | 768 Mio par processus Java ; sa mémoire totale peut être supérieure. |

Ces limites concernent le service entier, tous utilisateurs confondus. Les demandes supplémentaires attendent dans une file bornée. Sous pression, un espace sans document ou inactif depuis au moins une minute peut être libéré, en privilégiant le moins récemment utilisé et en respectant la limite Java.

Variables correspondantes : `LSP_MEMORY_LIMIT`, `LSP_MAX_SESSIONS`, `LSP_MAX_JAVA_SESSIONS`, `LSP_MAX_INITIALIZATIONS` et `LSP_IDLE_SECONDS`.

Lors des essais locaux, dix clients ont produit six espaces actifs et quatre en attente, pour environ **2,18 Gio dans le service LSP**, puis environ 65 Mio après fermeture. Ces mesures ne représentent pas la consommation de toute la plateforme ni une garantie pour le VPS. Les détails et les temps observés sont dans [le guide technique](integrations.md#local-verification-results).

## 12. Ajouter une intégration plus tard

Le parcours prévu est le suivant :

1. Créer son dossier et sa définition `integration.json`.
2. Fournir le wrapper, la bibliothèque de modélisation et les dépendances du framework.
3. Fournir le template et les instructions IA si la génération est prise en charge.
4. Implémenter les opérations de préparation nécessaires et les enregistrer dans `registry.go` ; réutiliser une préparation existante seulement si elle est compatible.
5. Déclarer les moteurs LSP et installer les outils nécessaires dans les images Docker.
6. Générer les bindings nécessaires si le langage ou le contrat l’exige.
7. Tester la création, l’analyse et les simulations, y compris les simulations mixtes, puis reconstruire les composants concernés.

Le catalogue évite de rajouter une enum de langage dans plusieurs couches. Il reste du travail spécifique lorsque les conventions de compilation ou d’exécution changent. Une syntaxe entièrement nouvelle peut également demander une grammaire Monaco.

Les intégrations ne sont pas des plugins Go installables à chaud : une nouvelle préparation compilée impose une reconstruction du runner. Aucun sous-module Git n’a été ajouté.

Les anciennes versions référencées doivent être conservées. Une évolution incompatible de la bibliothèque doit recevoir une nouvelle version ; les modèles existants ne sont pas automatiquement mis à niveau.

## 13. Les fichiers à lire, dans un ordre utile

| Question | Fichier |
| --- | --- |
| Comment les onglets et les brouillons sont-ils conservés ? | [WorkbenchProvider.tsx](../front/src/providers/WorkbenchProvider.tsx) |
| Comment les onglets s’affichent et se ferment-ils ? | [model-tabs.tsx](../front/src/components/nav/model-tabs.tsx) |
| Comment la page utilise-t-elle le brouillon actif ? | [EditModel.tsx](../front/src/pages/model/EditModel.tsx) |
| Comment Monaco est-il affiché et reconnecté ? | [ModelCodeEditor.tsx](../front/src/components/custom/ModelCodeEditor.tsx) |
| Où sont les connexions et les documents LSP réutilisés ? | [lib/lsp/client.ts](../front/src/lib/lsp/client.ts) |
| Où le backend contrôle-t-il l’accès au LSP ? | [back/handler/lsp.go](../back/handler/lsp.go) |
| Où sont lancés et arrêtés les moteurs ? | [internal/lsp/server.go](../simulator/runner/internal/lsp/server.go) |
| Où sont attachés les documents et appliqués les changements ? | [internal/lsp/documents.go](../simulator/runner/internal/lsp/documents.go) |
| Où est défini xDEVS Python ? | [integration.json](../simulator/runner/integrations/xdevs-python/integration.json) |
| Où est chargé le catalogue commun ? | [catalog.go](../simulator/shared/integrations/catalog.go) |
| Où est choisie la préparation spécifique ? | [registry.go](../simulator/runner/integrations/registry.go) |
| Comment est déterminé le fichier Java ? | [source_name.go](../simulator/runner/integrations/xdevs-java/source_name.go) |
| Où sont gérés les propositions IA et leur historique ? | [StructureConversation.tsx](../front/src/components/custom/generate/StructureConversation.tsx) |
| Où sont converties et synchronisées les hiérarchies ? | [llmToReactFlow.ts](../front/src/lib/llmToReactFlow.ts) |
| Où sont validés les niveaux et les couplages côté backend ? | [diagram_validation.go](../back/handler/diagram_validation.go) |
| Où est sauvegardé le cadre expérimental autour du modèle existant ? | [experimental_frame.go](../back/handler/experimental_frame.go) |
| Où sont installés les moteurs et les dépendances ? | [simulator/Dockerfile](../simulator/Dockerfile) |

## 14. Les commandes habituelles et les vérifications

Les points d’entrée de développement restent :

```sh
task back:dev
task front:dev
```

Pour observer le service d’analyse :

```sh
task back:logs -- lsp
```

Les vérifications disponibles comprennent :

```sh
task front:test
task front:build
task back:test
task simulator:lsp:test
```

Le test navigateur `task front:workbench:test` nécessite une plateforme de test isolée, les URL correspondantes et un navigateur installé. Sa configuration est décrite dans [le guide technique](integrations.md#workbench-regression-checks).

Les essais ont notamment vérifié les moteurs réels Python, Go et Java, les onglets, la récupération locale, les propositions IA avec des réponses simulées, les EF imbriqués et une simulation mixte conservant ses 25 messages de référence et ses sorties 5, 15 et 30.

La suite Go globale contient aussi des échecs existants et des tests nécessitant un environnement de simulation adapté. Ils sont détaillés dans le guide technique ; le passage des tests ciblés ne signifie pas que cette suite entière est verte.

Les images et les trois parcours Compose ont été adaptés. Le backend, le simulateur, le LSP et le frontend doivent être déployés dans des versions cohérentes. Aucun déploiement sur le VPS n’a été effectué dans ce chantier.
