# Import de modèles : ISO et agent IA

La navigation **Import models** ouvre `/import`. Les deux parcours partagent un aperçu et une confirmation avant toute écriture en base. Aucun modèle existant n'est remplacé : les définitions importées reçoivent de nouveaux UUID. Une définition réutilisée dans plusieurs composants reste une seule définition, avec plusieurs occurrences.

## Utilisation

1. Démarrer avec `task back:dev` et `task front:dev`. La task génère le jeton privé de l'importeur si nécessaire.
2. Choisir **Standard ISO package** ou **Explore with AI**.
3. Sélectionner un fichier, une archive ZIP ou un dossier. Limites : 500 fichiers et 12 Mio après décompression.
4. L'agent utilise la configuration de génération de **Settings** (URL, clé, modèle). Il faut une API compatible Chat Completions avec appels d'outils. Aucun abonnement particulier ou fournisseur imposé. Les fichiers examinés sont transmis au fournisseur choisi et les appels peuvent être facturés par celui-ci.
5. Discuter du rapport dans la conversation, vérifier le brouillon, ou choisir une cible puis **Adapt and verify**. Les fichiers n'ont pas à être renvoyés après un rechargement.
6. Examiner le code, les changements et les essais. **Keep this version** ouvre le choix de bibliothèque et la confirmation de revue.

En revenant sur `/import`, **Resume an import** affiche les sessions non enregistrées du compte, les plus récentes en premier. **Resume** retrouve les fichiers, le brouillon, la conversation et l'historique des vérifications sans nouvel upload, notamment après avoir quitté la page pour créer une bibliothèque. Les imports déjà enregistrés, supprimés ou expirés ne figurent pas dans cette liste. Le choix de destination et la confirmation de revue restent à renseigner à la reprise.

## Conversation et vérification

L'écran utilise les composants shadcn existants : conversation à gauche, brouillon et essais à droite, disposition verticale sur mobile. Les actions déterministes restent explicites : lire un ISO, vérifier le brouillon, restaurer sa première version, enregistrer. **Explain the report** et les messages libres appellent le LLM, sans lui autoriser à modifier un brouillon existant. **Adapt and verify** autorise une adaptation vers une intégration précise et jusqu'à trois essais pendant ce tour.

L'agent dispose de `respond` pour répondre ou poser une question puis rendre la main, et de `test_import` pour demander une compilation/simulation réelle. Il peut corriger le code après les diagnostics et réessayer. Les identifiants, racines, ports, paramètres existants et compositions sont conservés pendant l'adaptation. La documentation peut évoluer et des paramètres explicitement retrouvés dans le code peuvent enrichir les métadonnées ; ces ajouts restent soumis à la revue. Une transformation structurelle qui ne peut respecter ce contrat doit être discutée plutôt que masquée par la suppression de modèles. Une indisponibilité réseau ne prouve pas que le code est erroné.

Le service Python appelle `/internal/imports/verify` avec le jeton interne. Le backend applique les contrôles de framework et réutilise `lib.ModelToManifest`, avec les overrides par occurrence, sans créer de modèles ni de simulations dans PostgreSQL. Le coordinateur exécute son binaire et les runners habituels dans un groupe de processus séparé, avec un répertoire temporaire dédié et une échéance de 90 secondes. Les descendants sont arrêtés à la sortie. Les secrets de l'importeur/backend ne sont pas transmis aux processus. Le résultat contient le statut, la racine, l'horizon, la durée et les derniers 16 000 octets de diagnostics. Le délai de réponse HTTP est adapté aux compilations Java.

Ces essais utilisent le conteneur du simulateur existant, **pas un nouveau conteneur isolé par import**. Ce n'est pas une nouvelle frontière de sécurité pour exécuter du code hostile. Limites : deux vérifications simultanées, 100 atomiques développés par essai, trois essais par tour d'adaptation, trente par session. Un horizon réussi concerne seulement la racine et les paramètres testés, et ne démontre pas l'équivalence comportementale. Les erreurs et expirations restent visibles. L'annulation jette la session et empêche les étapes suivantes ; un appel fournisseur ou un essai déjà en cours peut se terminer jusqu'à son échéance.

Les sessions sont enregistrées atomiquement par utilisateur dans `import-data/sessions` (`importer/sessions.py`), conservées sept jours après leur dernière activité. Fichiers d'origine, premier brouillon, dernier candidat testé, échanges et résultats survivent à un redémarrage. Un traitement interrompu redevient reprenable ; aucun thread ni budget LLM n'est consommé pendant l'attente de l'utilisateur. Les clés et les historiques techniques du fournisseur ne sont pas persistés. Huit sessions peuvent être retenues simultanément ; les sessions scellées pour enregistrement sont libérables lorsque cette limite est atteinte.

La sauvegarde scelle la révision revue côté worker afin d'empêcher une modification concurrente pendant la transaction. Les échanges, changements et vérifications sont conservés dans la provenance de la première racine enregistrée. Après enregistrement, une nouvelle adaptation nécessite un nouvel import. L'import d'un framework inconnu reste possible pour l'édition. Pour MS4 Me, une ancienne API `AtomicModelImpl`/`MessageBagImpl` ou un helper `PhaseAtomic` absent bloque également l'exécution des modèles déjà enregistrés.

Un framework inconnu peut être conservé pour consultation/édition. L'interface désactive Simulation, Validate/EF et Deploy, avec une explication au survol. Les routes directes et le backend appliquent également le contrôle, y compris si un composant profondément imbriqué est indisponible. La création manuelle habituelle reste limitée au catalogue installé.

Pour les modèles indisponibles, l'aperçu propose de **renoncer**, **conserver le code importé**, ou **demander une conversion IA vers une intégration installée**. La cible identifie explicitement framework, version et langage ; une conversion peut donc conserver le langage ou le changer. Le contexte inclut le vrai template et les sources de bibliothèque de cette intégration. La génération de code n'est pas une preuve d'équivalence comportementale : une revue reste obligatoire. Une conversion n'installe pas de dépendances et ne télécharge pas de runner externe.

## Architecture et fichiers

Le diagramme complet est disponible en [source Mermaid](model-import-architecture.mmd) et en [SVG](model-import-architecture.svg).

Les résultats des essais et leurs limites sont consignés dans [le rapport de validation](model-import-validation.md).

```text
Écran ImportModels.tsx
        ↓ routes authentifiées /imports
back/handler/import.go             Configuration IA et contrôle d'accès
        ↓ réseau privé, jeton + identité utilisateur
importer/server.py                 Traitements asynchrones et annulation
    ├── adapters/iso21175_v07.py    Lecture déterministe du draft ISO
    └── agent.py                   Boucle LLM / outils / retour des erreurs
            ↓
importer/schema.py                 Validation du cœur d'échange version 1
        ↓ aperçu
back/exchange/package.go           Contrat Go et seconde validation
        ↓ confirmation explicite
Transaction PostgreSQL             Copies, références et provenance
```

- `importer/formats.py` : lecteurs bornés de texte, ZIP, JSON, XML et CSV ; inspection SQLite en lecture seule et désassemblage pickle sans chargement d'objets ; interpréteur des adaptateurs déclaratifs.

Les fichiers Python sont décodés selon leur déclaration d'encodage (PEP 263), notamment Latin-1 pour les anciens exemples DEVSimPy. Les octets d'origine non UTF-8 sont conservés. La copie de code importée reçoit une déclaration UTF-8 cohérente avec le stockage Unicode et l'écriture des fichiers par les runners ; les caractères des littéraux restent ainsi identiques. Un encodage invalide produit une erreur explicite, sans décodage avec remplacement des caractères.
- `importer/agent.py` : exploration, réponse conversationnelle, adaptation et outils de vérification. Au maximum 24 étapes et 480 secondes entre étapes par tour (une requête fournisseur en cours peut durer jusqu'à 180 secondes). Aucun shell ou `eval` dans le worker ; seule la vérification explicitement demandée exécute du code dans le simulateur.
- `importer/prompts/import.md` : instructions de conversion, politique sur les informations manquantes et distinction entre import et traduction de code ; séparées de la boucle d'outils.
- `back/handler/import.go` : démarrage, progression, annulation, rapprochement avec les intégrations et confirmation idempotente. Les identifiants du fichier n'autorisent aucun accès à des modèles existants. L'import ne peut écrire que dans une bibliothèque appartenant à l'utilisateur.
- `back/services/capabilities.go` : contrôle d'exécution commun, indépendant de l'interface.
- `back/json/import.go`, `back/model/model.go`, migration `000012` : sources et provenance des imports. Un atomique sans intégration est autorisé seulement s'il possède une provenance d'import ; la clé étrangère vers le catalogue reste active pour les intégrations connues.
- `front/src/pages/import/ImportConversation.tsx` et `ImportPreview.tsx` : conversation, actions, brouillon, changements et historique de vérification. L'identifiant reste dans l'URL pour reprendre la session.
- `front/src/components/nav/nav-actions.tsx` et `useModelCapabilities.ts` : indisponibilité des actions d'exécution. L'éditeur source reste utilisable sans lancer de LSP pour un framework inconnu.

Le cœur conserve plusieurs racines, définitions, occurrences, ports, paramètres/valeurs par défaut, overrides par occurrence, connexions, code, langage, framework/version, fichiers auxiliaires, dépendances, origine et informations manquantes. Les pièces originales (texte ou binaire encodé) sont conservées avec la première racine importée. Les positions ne sont pas importées : une grille initiale et ELK réorganisent le modèle ouvert ; sauvegarder pour conserver cette disposition.

## Adaptateur réutilisable ou conversion ponctuelle

L'agent peut tester une recette de lecture **déclarative**, sans générer de code exécutable. Une recette décrit le codec (`json`, `xml`, `csv`), des critères de reconnaissance et une transformation vers le cœur. Les expressions permises sont `$path` (lecture d'un chemin), `$const` (constante), `$each` et `template` (projection d'une collection).

Une recette valide sur le fichier courant est stockée par empreinte, dans un répertoire propre à l'utilisateur, sur le volume `import-data`. Elle reste expérimentale : chaque réutilisation doit reconnaître sa signature et repasser toute la validation. Réussir sur un exemple ne prouve pas la compatibilité avec toute une famille de formats. Les recettes ne sont pas partagées entre utilisateurs. Le code source doit être extrait du fichier et ne peut pas être remplacé par du code généré constant dans une recette. Les conversions de framework ne sont jamais mises en cache comme parseurs.

Si aucune recette n'est proposée, l'agent peut soumettre directement les modèles un par un ou en ensemble. L'aperçu précise alors qu'il s'agit d'une conversion ponctuelle. Il n'y a pas de promesse d'import universel : une structure absente, un binaire opaque ou des dépendances manquantes doivent être signalés. Pour `.dsp` et autres formats spécifiques, leur extension seule ne suffit pas à garantir la récupération complète du projet. Un pickle est uniquement désassemblé, jamais exécuté.

## ISO et évolutions du format

La cible déterministe est `21175-3-draft-0.7` du PDF fourni, **avec l'acceptation provisoire de `payload: {}` demandée pendant la conception**. Le draft ne prévoit pas encore de profil vide finalisé : ceci n'est donc pas une revendication générale de conformité ISO. Aucun type de message n'est inventé. Les autres payloads suivent le profil de champs primitifs du draft et sont préservés dans le document d'origine.

Une feuille est un `ModelSpecification`. Un `ModelPackage` doit avoir une racine composite, toutes ses définitions référencées, et conserver la hiérarchie. Les contrôles portent notamment sur les versions, doublons, références, ports/directions, overrides et cycles de composition. Les boucles de connexion restent autorisées. L'expansion est bornée à 10 000 occurrences et la profondeur à 64 niveaux.

Pour une source ISO, `execution.local.runnerId = "<integrationId>@<version>"` est une correspondance explicite reconnue par DEVSForge, par exemple `devsimpy-python@1.0.0`. Il s'agit d'une convention de cette plateforme, pas d'un identifiant universel imposé par ISO. La référence OCI est préservée mais ne provoque aucun téléchargement. Le langage seul n'est jamais utilisé pour deviner le framework. Une déclaration distante seule reste consultable sans exécution distante.

Pour une nouvelle édition, ajouter un adaptateur dans `importer/adapters/` et son routage, sans changer la base ni le cœur. Une évolution réelle du cœur nécessite une nouvelle version du contrat Python/Go et des tests de compatibilité. L'export et l'API d'échange interplateformes restent des chantiers distincts.

## Exploitation et tests

`task importer:setup` génère `IMPORT_INTERNAL_TOKEN` dans `.env`. Backend, worker et coordinateur utilisent ce jeton ; `IMPORT_ADDR` vaut `http://importer:8091`. Le worker n'expose aucun port hôte, ne monte ni base ni socket Docker, utilise un utilisateur non privilégié et une racine en lecture seule. Le volume `/data` contient les adaptateurs et sessions persistantes. Seules les clés LLM et l'exécution des tours restent en mémoire. Deux tours peuvent s'exécuter simultanément, un par utilisateur. `IMPORT_BACKEND_ADDR` permet de remplacer l'adresse privée de rappel, par défaut `http://backend:3000`.

```sh
task importer:test
task back:test
task front:typecheck
task front:build
```

Pour un VPS existant, reprendre le service `importer`, le volume `import-data` et l'environnement du simulateur depuis `docker-compose.yml`, puis renseigner le même `IMPORT_INTERNAL_TOKEN` pour les trois services. Les routes privées worker/backend/simulateur doivent être accessibles entre ces services. Recréer les services avec les images publiées après fusion. Le workflow ne synchronise pas automatiquement le fichier Compose ni le `.env` d'un VPS déjà configuré.

Le contrôle navigateur reproductible est `task front:import:test`, après `task front:dev -- --port 5189`. Toutes ses requêtes API sont interceptées ; il ne crée aucun compte ni modèle. On peut choisir un navigateur installé avec `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome`.

Les tests couvrent les lecteurs/archives, structures invalides, références réutilisées, inspection binaire sans exécution, boucle d'outils avec correction, fournisseur HTTP simulé, isolation des utilisateurs, confirmations répétées, conservation du code et blocage des simulations/EF. Aucun appel à un fournisseur payant n'est nécessaire pour ces tests.

`python scripts/check-import-verification.py` utilise la pile Docker locale et les vrais runners : succès PyPDEVS, erreur d'exécution volontaire et blocage de l'ancienne API MS4 Me. Il ne modifie aucune bibliothèque et ne fait aucun appel LLM. Les tests de conversation vérifient séparément la pause/reprise, l'absence de mutations pendant la discussion, les corrections après erreur, la limite d'essais et la conservation des brouillons après une erreur du fournisseur.

Le choix d'une boucle simple avec outils et critères de validation suit les principes de [Building effective agents, Anthropic](https://www.anthropic.com/research/building-effective-agents) et du [function calling](https://developers.openai.com/api/docs/guides/function-calling). Ces références décrivent les mécanismes, pas une garantie de conversion de modèles DEVS.


Un essai réel facultatif est disponible avec `python scripts/check-import-live.py <dossier> --model gpt-5.4 --output tmp/live-import.json`, lorsque le backend et le worker locaux tournent. La clé est demandée sans affichage et n'est jamais écrite dans les fichiers. Ce contrôle appelle le fournisseur payant, conserve seulement le résultat dans le dossier ignoré `tmp/`, puis supprime son aperçu de test. Il contrôle l'analyse réelle ; les tests backend et navigateur couvrent séparément la confirmation et l'édition. Il n'exécute pas les modèles importés. L'option `--expect-traffic-system` vérifie les trois définitions, les ports et la connexion du jeu d'exemple ; `--include` permet de sélectionner des fichiers précis.


Le contrat JSON de soumission est fourni explicitement au LLM (`importer/contract.py`) en plus de la validation sémantique. L'outil `select_source` copie localement le texte original ; pour Python, il peut isoler une classe et ses définitions auxiliaires par analyse syntaxique, sans exécution. Une référence temporaire `codeRef` est résolue avant validation et ne fait pas partie du cœur stocké. Les initialisations dynamiques de module empêchent cette extraction partielle : le fichier complet reste disponible et toute limite d'exécution doit être signalée. Les contrats natifs des intégrations installées accompagnent aussi l'analyse, pour distinguer leur nom affiché des API réellement acceptées, sans déduire un framework du seul langage.

Le catalogue peut déclarer `frameworkAliases` (familles natives acceptées) et `providedLibraries` (bibliothèques déjà fournies). Pour `devsimpy-python`, l'alias explicite est `PyPDEVS` et la bibliothèque fournie est `pypdevs`. Le rapprochement reste conditionné au framework et au langage ; une dépendance précisant une autre version n'est pas supprimée automatiquement. Ces informations ne changent pas l'empreinte du runtime. Les tests backend peuvent aussi relire les résultats réels via `TEST_LIVE_IMPORT_PACKAGE` et `TEST_LIVE_IMPORT_LEGACY` pour vérifier leur enregistrement et leurs capacités dans une base isolée.

En développement, `simulator/dev-runner.py` vérifie l'empreinte des sources Go du runner et du module partagé avant de démarrer chaque processus de modèle. Si elles ont changé, il reconstruit le binaire avec le cache Go, sous verrou, puis le remplace atomiquement. Plusieurs atomiques peuvent démarrer simultanément sans utiliser un ancien lecteur du catalogue. Le coordinateur surveille également les modifications de `shared/` via Air. Les images compilées, notamment LSP et production, doivent être reconstruites lors d'une évolution du schéma du catalogue. Le test `python3 -m unittest discover -s simulator/tests -v` vérifie avec de vrais builds Go la recompilation après modification du module partagé, les démarrages simultanés, la réutilisation du binaire et le passage des arguments.
