# MS4 Me Java dans DEVSForge

Cette intégration exécute des **atomiques Java MS4 Me**, à partir de la bibliothèque fournie `com.ms4systems:Closure-DEVS:1.0.0`. Elle est indépendante de `xdevs-java` : les deux utilisent Java 21, mais leurs classes et leurs méthodes de modélisation sont différentes.

## Création et simulation

1. Créer un modèle atomique et choisir **MS4 Me Java**. L'API fournit le template de cette intégration.
2. Dans les propriétés, déclarer les mêmes noms et directions de ports que dans le code. Le template déclare un port de sortie `out` ; ajouter ce port aux propriétés pour le connecter.
3. Ajouter les paramètres souhaités aux propriétés, avec les noms des champs ou setters du modèle. Le template accepte par exemple `period`.
4. Sauvegarder puis utiliser cet atomique dans les modèles couplés habituels de DEVSForge.

Les modèles couplés restent des assemblages DEVSForge, sans intégration attachée au parent. Ils peuvent mélanger des atomiques MS4 Me, xDEVS Java, Go et Python. Le backend aplatit l'assemblage ; le coordinateur pilote les atomiques, chacun derrière son wrapper. Aucun algorithme du coordinateur ni protocole Kafka/gRPC n'est changé.

`Closure-DEVS` est le nom de la dépendance, pas une obligation d'employer la fermeture par couplage. La bibliothèque conserve ses classes `Atomic` et `Coupled`, mais cette préparation lance uniquement les atomiques. L'exécution d'un couplé Java comme bloc opaque via `ClosureToAtomic`, et l'import automatique d'une hiérarchie Java MS4 Me, ne font pas partie de cette intégration.

## Où se trouve chaque partie ?

| Chemin | Rôle |
| --- | --- |
| `integration.json` | Identité `ms4me-java@1.0.0`, langage `java`, ressources et configuration JDT LS. Le backend synchronise sa projection en base au démarrage. |
| `prepare.go` | Écrit le code utilisateur, le compile contre le runtime et démarre le serveur gRPC. |
| `source_name.go` | Retrouve le package et le type public sans exécuter le code ; le nom affiché peut contenir des espaces. |
| `analysis.go` | Prépare le projet Maven pour JDT LS, en utilisant la vraie bibliothèque fournie. |
| `templates/atomic.tmpl` | Code initial servi par l'API lors de la création. |
| `ai/model.md`, `ai/api.md` | Instructions et référence d'API pour la génération comportementale. Les sources du chargeur et du codec complètent ce contexte. Aucun appel IA n'est nécessaire à l'ouverture. |
| `wrapper/src/main/java/com/devsforge/ms4me/` | Serveur gRPC, chargement du modèle, paramètres et conversion JSON. |
| `wrapper/src/main/generated/` | Contrat gRPC Java généré depuis le `.proto` commun. |
| `wrapper/dependencies/maven/` | Dépendance binaire Closure-DEVS et son POM, disponibles sans installation de l'IDE MS4 Me. |
| `wrapper/src/test/java/` | Tests de trajectoire, paramètres, ports, erreurs et JSON. |

Le registre compilé est `../registry.go`. Les utilitaires Java partagés sont dans `../../internal/generators/java.go` ; ils ne dépendent d'aucune API de modélisation. Les formulaires et générateurs utilisent déjà le catalogue : aucune enum frontend supplémentaire n'est ajoutée.

## Projet temporaire d'un modèle

```text
projet privé/
  pom.xml                     # identité Maven unique pour le LSP
  src/model/java/package/.../MonModele.java
  src/main/java/com/devsforge/ms4me/  # adaptateur runtime
  src/main/generated/          # messages gRPC
  dependencies/maven/          # vraie bibliothèque (lien en analyse)
  classes/                    # résultat javac, simulation uniquement
  wrapper.log                 # traces et erreurs de lancement
```

Le code doit fournir une classe publique dérivant d'`Atomic`, avec un constructeur sans argument. Le package déclaré est conservé dans son chemin et son nom de classe complet. Des classes utilitaires non publiques peuvent être définies dans le même fichier. Le stockage multi-fichiers et l'import de projets IDE complets ne sont pas ajoutés ici.

Le runtime injecte les paramètres **avant** `initialize()` via `setNom(...)` ou le champ `nom`, y compris hérité. `initialize()` doit réinitialiser l'état dynamique sans écraser ces paramètres ; plusieurs appels sont possibles. Chaque port déclaré dans les propriétés doit exister dans le code avec la même direction. Les entrées sont accumulées dans un `MessageBag` puis livrées à la transition externe ou confluente.

Les messages passent en JSON : `Serializable`/`Object` donnent des Map/List/Number ; une classe concrète est décodée par Jackson. Les sorties non sérialisables échouent explicitement, plutôt que d'être remplacées par `toString()` et de perdre leur structure.

## Docker, développement et LSP

`simulator/Dockerfile` prépare les dépendances Maven et construit le runtime **une fois par image**, dans `/opt/devsforge/runtimes/ms4me-java/ms4me-runtime.jar`. Chaque simulation compile seulement son fichier utilisateur avec `javac --release 21`. `MS4ME_RUNTIME_JAR` est défini dans l'image et n'a pas à être ajouté au `.env` du VPS.

Les commandes habituelles restent `task back:dev` et `task front:dev`. Reconstruire les images backend/simulateur/LSP ensemble pour installer les ressources ; les trois parcours Compose utilisent déjà ces images ou ces ressources. Aucun déploiement n'est exécuté par l'intégration.

En exécution native, sans `MS4ME_RUNTIME_JAR`, la préparation construit le runtime dans le projet privé avec Maven et Java 21. Pour réutiliser un runtime construit manuellement, définir cette variable sur son chemin absolu. Les résultats Maven restent sous `target/`, exclus de Git et de l'empreinte du catalogue.

Le LSP utilise JDT LS déjà installé. Son projet Maven référence le même JAR Closure-DEVS que la simulation. L'ouverture de l'éditeur n'exécute ni constructeur ni modèle. Le partage d'un serveur reste limité au compte, à la fenêtre, à l'intégration et à sa version ; MS4 Me et xDEVS Java gardent donc des environnements distincts. L'aide sur les méthodes du JAR fonctionne sans disposer de ses sources ; leur consultation complète nécessiterait un JAR de sources fourni par l'éditeur.

## Vérifications et maintenance

```sh
task simulator:ms4me:test
task simulator:lsp:test
task simulator:runner:test -- -run 'TestRealWrapper' -v
```

La CI vérifie aussi une chaîne **xDEVS Go → xDEVS Python → xDEVS Java → MS4 Me Java**, avec valeurs attendues 5 → 15 → 30 → 90 et un paramètre appliqué à l'instance MS4 Me. Les tests LSP vérifient les méthodes héritées et Math, plusieurs documents, fermeture et réouverture.

Le protocole reste `simulator/proto/devs.proto`. Si ce contrat change, régénérer les bindings concernés avec les versions de protoc et du plugin documentées dans `docs/generate-proto-files.md` :

```sh
task simulator:proto -- ms4me-java
```

Ajouter un nouveau framework Java demande sa définition, sa préparation, ses ressources et ses tests ; aucun autre langage n'a besoin d'être régénéré si le protocole reste identique. Les changements incompatibles de bibliothèque exigent une nouvelle version d'intégration.

## Provenance de la dépendance

Le JAR a été repris du dossier `ms4me` fourni pour cette intégration. SHA-256 de `Closure-DEVS-1.0.0.jar` :

```text
3ff1dc26d774235983d4f5ccd9eb94700e82481168c5db1d99cefc15ef046f9f
```

Cette empreinte est épinglée dans `dependencies.sha256`, vérifiée avant le téléchargement Maven dans Docker et par les tests Go. Les fichiers `.jar` sont déclarés binaires dans `.gitattributes` : une conversion CRLF/LF peut corrompre leurs données et les offsets ZIP. Après ajout d'une dépendance binaire, vérifier aussi la copie extraite depuis Git ; une copie locale valide ne garantit pas que le commit contient les mêmes octets.

Aucun fichier de licence ni sources n'accompagnait cette dépendance. Son inclusion ne lui attribue pas la licence du projet DEVSForge ; les droits de redistribution restent à confirmer auprès de son fournisseur avant publication d'images contenant ce binaire.
