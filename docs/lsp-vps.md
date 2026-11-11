# Démarrer le LSP sur le VPS

L’image publiée est `ghcr.io/doto-apps/devsforge-lsp:preview`. Le workflow de publication du commit `4fdadc6` a réussi ; l’échec du workflow de tests concerne la complétion Java après fermeture d’un document.

## 1. Variables du `.env`

Dans `~/apps/devsforge/.env`, conserver le jeton déjà généré et ajouter les variables manquantes :

```dotenv
LSP_INTERNAL_TOKEN=REMPLACER_PAR_LE_JETON_EXISTANT
LSP_ADDR=http://lsp:8090
LSP_ALLOWED_ORIGINS=https://devsforge.doto.ovh
LSP_MAX_SESSIONS=6
LSP_MAX_JAVA_SESSIONS=2
LSP_IDLE_SECONDS=900
LSP_MAX_INITIALIZATIONS=2
LSP_MEMORY_LIMIT=4g
```

Si aucun jeton n’existe encore, le générer avec `openssl rand -hex 32` et copier le résultat dans `LSP_INTERNAL_TOKEN`. Le backend et le service LSP doivent recevoir la même valeur. Ne pas utiliser littéralement la valeur d’exemple ci-dessus.

## 2. Ajouter le service dans le Compose existant

Ajouter ce bloc **dans `services:`, au même niveau que `kafka:`**, avant le bloc `networks:` final. Conserver les services existants et notamment le montage de la base `./db_data`.

```yaml
  lsp:
    image: ghcr.io/doto-apps/devsforge-lsp:${DEVSFORGE_IMAGE_TAG:-preview}
    restart: unless-stopped
    init: true
    environment:
      LSP_INTERNAL_TOKEN: ${LSP_INTERNAL_TOKEN:?LSP_INTERNAL_TOKEN manquant dans .env}
      LSP_MAX_SESSIONS: ${LSP_MAX_SESSIONS:-6}
      LSP_MAX_JAVA_SESSIONS: ${LSP_MAX_JAVA_SESSIONS:-2}
      LSP_IDLE_SECONDS: ${LSP_IDLE_SECONDS:-900}
      LSP_MAX_INITIALIZATIONS: ${LSP_MAX_INITIALIZATIONS:-2}
    mem_limit: ${LSP_MEMORY_LIMIT:-4g}
    networks:
      - default
    labels:
      - "traefik.enable=false"
```

Le backend doit être relié au réseau `default`, comme la base et Kafka, et charger le `.env` via `env_file`. Il conserve son éventuelle connexion au réseau du proxy.

Le navigateur contacte le backend, qui transmet les requêtes au LSP sur `http://lsp:8090`. Aucun domaine, port public ou routage Traefik n’est nécessaire pour le LSP.

## 3. Démarrer et vérifier

Sur le VPS, dans `~/apps/devsforge` :

```bash
docker compose config --quiet
docker compose pull lsp
docker compose up -d lsp backend
docker compose ps lsp
docker compose logs --tail=50 lsp
```

Le contrôle de santé de l’image vérifie automatiquement le service. Les moteurs Python, Go et Java sont lancés à la demande lorsque l’éditeur ouvre un modèle.

Si un problème persiste :

- Service `lsp` absent de `docker compose config --services` : vérifier son placement sous `services:`.
- Backend incapable de joindre `lsp:8090` : vérifier que les deux services partagent `default`.
- Réponse `401` entre backend et LSP : vérifier leur jeton commun, puis recréer les deux conteneurs avec `docker compose up -d lsp backend`.
- WebSocket de l’éditeur refusé avec `403` : vérifier `LSP_ALLOWED_ORIGINS`, avec l’URL exacte du frontend et sans barre finale.

Les limites mémoire et le nombre de sessions ont des valeurs par défaut ; le jeton est obligatoire.
