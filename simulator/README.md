# Simulator

## How to test

`go test -v`: `-v` is needed to have outputs

- Les events sont mis dans `/tmp/devs-sim-events.log` pour le moment, il faudrait rendre le chemin dynamique
- Faudra aussi rajouter des providers comme kafka
- Actuellement la superposition d'ecriture ne pose pas de probleme si la taille totale du message est <4kb selon la doc
- Si la superposition de log devient problematique on devra integrer une premiere commande pour creer un fichier FIFO