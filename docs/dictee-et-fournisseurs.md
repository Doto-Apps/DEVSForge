# Dictée et choix des fournisseurs IA

La page **Settings → AI providers** configure deux connexions indépendantes :

- **Model generation** : URL, clé et modèle pour les structures, comportements et corrections.
- **Voice dictation** : URL, clé et modèle pour transformer un enregistrement en texte.

Ces connexions peuvent utiliser le même fournisseur ou deux fournisseurs différents.
L’application continue d’utiliser un protocole compatible pour la génération et
ajoute les routes de découverte et de transcription compatibles. Elle n’installe
aucun moteur vocal sur le VPS.

## Configurer une connexion

1. Saisir l’URL de base de l’API, avec son préfixe de version éventuel.
   Exemple Groq : `https://api.groq.com/openai/v1` ; Mistral :
   `https://api.mistral.ai/v1`. Ne pas inclure `/models` ou
   `/audio/transcriptions` à la fin.
2. Saisir la clé du fournisseur si celui-ci en demande une.
3. Cliquer sur **Load models**. Ce bouton utilise les champs actuels, même avant
   sauvegarde, et appelle la route `/models` depuis le backend.
4. Choisir un modèle dans la liste, ou saisir son identifiant exact dans **Model ID**.
5. Cliquer sur **Save settings** avant d’utiliser la dictée.

La découverte affiche les identifiants exposés par l’API avec cette clé. Elle ne
prouve pas que chaque modèle prend en charge la transcription ou les réponses
JSON structurées. Certaines API ne proposent pas de liste : la saisie manuelle
reste possible. Une API native avec un autre protocole nécessitera un adaptateur.

Une URL locale ou privée doit être accessible **depuis le backend**, et non seulement
depuis le navigateur. Les clés restent côté backend après sauvegarde ; les réponses
à l’interface ne contiennent qu’un indicateur et une valeur masquée. Un champ clé
vide conserve la clé sauvegardée. **Remove stored key** demande sa suppression
explicite. Changer d’URL avec une clé masquée impose de saisir la clé de la nouvelle
connexion ou de supprimer explicitement l’ancienne : elle n’est pas envoyée à un
nouveau destinataire à l’insu de l’utilisateur.

## Dicter une description

Les boutons sont présents dans :

- la description structurelle du DEVS Generator ;
- la description du comportement de chaque modèle atomique ;
- la discussion de correction d’une structure ;
- la description et les composants communs du parcours de cadres expérimentaux.

1. Cliquer sur **Dictate** et autoriser le microphone.
2. Dicter, puis **Stop recording** : la transcription démarre automatiquement.
   L’arrêt automatique après deux minutes déclenche également la transcription.
   L’enregistrement est limité à 3 Mio ; cet appel au fournisseur peut être facturé.
3. Relire le texte ajouté à la fin du champ et le corriger avant de générer.

Le bouton **Discard recording** abandonne l’enregistrement sans l’envoyer. En cas
d’échec ou d’annulation de la requête, l’audio reste disponible pour écoute et le
bouton **Retry transcription** permet de réessayer explicitement. Il n’y a aucune
nouvelle tentative automatique.

La dictée ne soumet jamais le formulaire et ne lance pas automatiquement la
création d’un modèle ou une correction IA. Elle conserve aussi les modifications
saisies pendant l’attente de transcription. Quitter la page ou changer de modèle
ferme son enregistrement et empêche l’insertion d’un résultat dans un autre champ.
Annuler une requête arrête l’attente côté navigateur ; le fournisseur peut avoir
commencé son traitement.

Le microphone demande HTTPS, sauf sur localhost. MediaRecorder choisit un format
pris en charge par le navigateur, généralement WebM/Opus ou MP4. Il n’y a pas de
conversion audio lourde sur le VPS. Si le fournisseur refuse ce format, choisir un
service compatible avec l’enregistrement du navigateur.

## Backend et base de données

La migration `000011_add_transcription_settings` ajoute à `user_ai_settings` :

- `transcription_api_url` ;
- `transcription_api_key` ;
- `transcription_api_model`.

Les colonnes et les configurations de génération existantes sont conservées. Les
migrations s’appliquent au démarrage habituel du backend. La migration descendante
supprime les trois nouvelles colonnes : sauvegarder les paramètres avant rollback.
Comme pour la clé de génération existante, les clés sont stockées dans la base ;
ce changement n’ajoute pas de chiffrement au repos.

Routes authentifiées :

- `GET/PATCH /user/settings/ai` : paramètres du compte connecté ;
- `POST /user/settings/ai/models` : découverte avec `purpose` égal à `generation`
  ou `transcription`, et URL/clé facultatives pour des champs non sauvegardés ;
- `POST /user/settings/ai/transcriptions` : multipart `file` et éventuellement
  `language`, traité avec la configuration vocale sauvegardée du compte connecté.

La transcription est limitée à deux appels fournisseurs simultanés dans un
processus backend, avec un délai de 90 secondes. Un dépassement renvoie une erreur
réessayable ; aucun nouveau processus IA n’est créé. L’audio n’est pas enregistré
en base. Les appels fournisseurs ne suivent pas les redirections HTTP, leurs
réponses sont bornées, et leurs erreurs d’authentification ne déconnectent pas
l’utilisateur de DEVSForge.

## Vérifications et références

Les tests backend utilisent PostgreSQL isolé et un fournisseur HTTP simulé pour
vérifier migration, conservation des clés, isolation des comptes, découverte,
transfert multipart, masquage des erreurs, limites et suppression d’une clé.
Les vérifications navigateur utilisent MediaRecorder avec un microphone simulé.
Aucun test par défaut ne consomme une API vocale payante.

- [MediaRecorder — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Modèles — Groq](https://console.groq.com/docs/api-reference#models)
- [Transcription — Groq](https://console.groq.com/docs/speech-to-text)
- [Modèles — Mistral](https://docs.mistral.ai/api/endpoint/models)
- [Transcription — Mistral](https://docs.mistral.ai/api/endpoint/audio/transcriptions)
