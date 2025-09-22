# Projet EasyDEVS

Ce projet utilise Docker, Node.js, React et TailwindCSS pour créer un environnement de développement complet pour des systèmes DEVS.

## Prérequis

Avant de commencer, assurez-vous d'avoir les éléments suivants installés sur votre machine :

- Docker et Docker Compose ou Docker Desktop (qui inclut Docker et Docker Compose)
- Node.js version > 20

## Installation

1. Clonez le projet :

   ```bash
   git clone <URL_DE_VOTRE_PROJET>
   cd <NOM_DU_REPERTOIRE_CLONÉ>
   ```

2. Copiez les fichiers `.env.back.dist` et `.env.front.dist` :

   ```bash
   cp .env.back.dist .env.back
   cp .env.front.dist .env.front
   ```

3. Supprimez le suffixe `.dist` des fichiers `.env` :

   ```bash
   mv .env.front.dist .env.front
   mv .env.back.dist .env.back
   ```

4. Ouvrez les fichiers `.env` et remplissez-les avec les valeurs demandées.

## Fonctionnement de l'API

L'API fonctionne avec tout modèle LLM (Large Language Model) utilisant le OpenAI SDK.

## Lancer le projet

Le projet est configuré pour se lancer en mode développement par défaut.

### Pour démarrer le projet :

```bash
docker compose up --build
```

### Si le projet a déjà été build :

```bash
docker compose up
```

### Pour arrêter le projet :

```bash
docker compose down
```

## Conclusion

Une fois le projet démarré, vous pouvez commencer à interagir avec l'API et les composants React du frontend.


## Installer extension Biome si bous servez de VScode


## Expert mode

**Use 2 seperated terminal to run both commands**

- Start front using : `npm run start:front` it will run the project locally using your OS
- Start back using : `npm run start:back` it will run a docker-compose.yml located in `back/docker-compose.yml`


## How to commit

The project use lefthook and commitlint with conventional commit : https://www.conventionalcommits.org/en/v1.0.0/ 

### Forcer le commit en cas d'erreur pre-commit

- `git commit -m "fix: toto" --no-verify`