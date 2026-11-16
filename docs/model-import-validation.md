# Validation du parcours conversationnel

Essais locaux du 15 novembre 2026 sur `feat/model-import-agent`.

## Projet MS4 Me réel

- Entrée : `UserLLMTrustSimple.zip`, SHA-256 `693427ae6dd4ed1ddffb4a8bde3841af116735a14a4d6fdfa8f075d6f3297208`.
- Fournisseur réel : OpenAI, modèle configuré `gpt-5.4` ; clé lue en mémoire, absente des artefacts et des sessions persistées.
- Analyse : `QCScenario`, `QCUser`, `QCLLM`, et le couplé `QCUserLLM` ; neuf ports atomiques, trois occurrences et quatre connexions.
- Discussion : explication de l'API MS4 Me incompatible et du helper local `PhaseAtomic`. Le couplé reconstruit et les utilitaires graphiques inutilisés ne nécessitent pas l'exécution du lanceur Eclipse.
- Adaptation : code Java adapté à l'intégration installée, helper intégré aux atomiques, sept paramètres de `QCUser` avec les mêmes valeurs par défaut.
- Vérification finale : compilation et simulation réelles de `qcuserllm`, horizon **400**, statut **completed**, environ 23 secondes, un essai dans le dernier tour d'adaptation. Aucun modèle existant n'a été remplacé.
- Revue : avertissements explicites sur les adaptations et l'absence de preuve d'équivalence sémantique. Les sources d'origine sont conservées.

Les essais intermédiaires ont permis de corriger le délai HTTP de 30 secondes qui masquait les résultats Java et un contrôle trop strict des métadonnées de paramètres. Le contrôle protège les noms/types/défauts déjà récupérés, mais permet leur documentation et l'ajout de paramètres retrouvés dans les sources.

## Contrôles reproductibles sans fournisseur payant

- `cd importer; python -m unittest discover -s tests -v` : conversation sans mutation, reprise après redémarrage, erreurs fournisseur, boucle correction/vérification, budgets, archives, encodages, ISO, isolation utilisateur et verrouillage de révision.
- `go test ./back/handler -run 'TestImport|TestResolve|TestDraftManifest'` : validation, persistance dans PostgreSQL isolé, contrôles de capacité, routes privées, occurrence et paramètres de simulation.
- `python scripts/check-import-verification.py --timeout` : vrai runner PyPDEVS, succès, erreur volontaire, MS4 Me incompatible bloqué, puis modèle lent arrêté après 90 secondes avec un rapport de délai dépassé.
- `pnpm --dir front exec vitest run src` : 31 tests du code source passent.
- `task front:import:test` avec Vite sur 5189 : upload, discussion, échec de vérification, adaptation, reprise sans nouvel upload, revue, enregistrement, gardes d'exécution et disposition mobile. Ces tests navigateur interceptent les réponses API ; les exécutions ci-dessus utilisent séparément les vrais services.
- TypeScript, build de production, lint Go backend/coordinateur et Biome sur les composants modifiés.

Les essais de compilation/simulation testent l'exécution sur l'intégration installée, pas l'équivalence scientifique de la conversion. L'exécution réutilise le conteneur du simulateur ; elle ne crée pas de sandbox indépendante par import.
