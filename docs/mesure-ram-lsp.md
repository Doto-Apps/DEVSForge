# Consommation mémoire du LSP — mesure du 13 novembre 2026

Mesure locale sur la branche `feat/ms4me-integration`, avec le runner recompilé depuis les sources courantes et les quatre intégrations du workspace. Les vrais moteurs LSP sont démarrés ; une complétion propre au framework est vérifiée pour chaque document. Aucun modèle n’est exécuté et aucun appel IA n’est effectué.

## Résultats

Les valeurs suivantes sont la consommation **totale du conteneur LSP**, avec un seul framework actif, relevée environ vingt secondes après la disponibilité des complétions. Elles incluent le service et les caches encore comptabilisés par Docker. Les scénarios ont été exécutés successivement dans le même conteneur, avec fermeture des espaces entre frameworks ; le niveau de cache peut donc varier.

| Framework | Un modèle | Trois modèles dans le même espace | PSS des processus, un / trois modèles |
| --- | ---: | ---: | ---: |
| xDEVS Python — Pyright + Ruff | 276 Mio | 364 Mio | 257 / 339 Mio |
| xDEVS Go — gopls | 720 Mio | 786 Mio | 487 / 539 Mio |
| xDEVS Java — JDT LS | 1200 Mio | 1235 Mio | 1071 / 1104 Mio |
| MS4 Me Java — JDT LS | 1150 Mio | 1209 Mio | 1019 / 1078 Mio |

La PSS est la mémoire résidente des processus, avec répartition des pages partagées. Elle complète la mesure Docker et évite de confondre le coût des moteurs avec celui des caches et du noyau. Les chiffres ne sont pas des tailles de tas Java ni des réservations de mémoire virtuelle.

Les PID restent identiques entre un et trois documents pour chaque moteur : Pyright/Ruff `31/38`, gopls et son auxiliaire `124/134`, JDT LS xDEVS `488`, JDT LS MS4 Me `638`. Les onglets réutilisent donc bien les processus existants.

## Plusieurs espaces actifs

| Scénario | RAM Docker après ouverture | Pic Docker observé pendant la phase |
| --- | ---: | ---: |
| Quatre espaces, quatre modèles : un par framework | 2.40 Gio | 2.41 Gio |
| Quatre espaces, douze modèles : trois par framework | 2.58 Gio | 2.59 Gio |
| Six espaces, dix-huit modèles : deux Python, deux Go, deux Java | 3.12 Gio | 3.12 Gio |

Le compteur noyau `memory.peak`, qui inclut notamment les caches exclus de l’affichage Docker, a atteint **3.36 Gio** pour une limite de **4 Gio**. Les compteurs `oom`, `oom_kill` et `max` sont restés à zéro ; aucune utilisation de swap n’a été relevée.

Un espace correspond à **un compte + une fenêtre + une intégration + sa version**, et non à un onglet. Le dernier scénario utilise deux comptes synthétiques. Un utilisateur ouvrant plusieurs frameworks peut occuper plusieurs espaces ; dix utilisateurs connectés ne correspondent donc pas automatiquement à dix serveurs de langage.

## Fermeture et mémoire restante

Au démarrage sans espace : **24 Mio** affichés par Docker. Après fermeture explicite des six espaces et dix secondes d’attente : **311 Mio** affichés, mais seulement **24 Mio de PSS** pour les processus restants. Il reste uniquement le runner et l’init du conteneur ; tous les moteurs de langage sont arrêtés.

La comptabilité finale du noyau indique environ 254 Mio de pages de fichiers actives et 42 Mio de slab. Le reliquat Docker ne correspond donc pas à des serveurs Java/Go/Python encore en fonctionnement. Sur Linux, Docker retire les pages de fichiers inactives de son affichage, mais cet affichage n’est pas la somme des PSS : voir la [documentation Docker stats](https://docs.docker.com/reference/cli/docker/container/stats/).

## Conditions et limites

- Docker Desktop sous macOS, conteneur Linux x86-64 ; VM avec douze CPU et environ 15,6 Gio de RAM.
- Service limité à 4 Gio, swap interdit ; six espaces maximum, deux Java maximum, deux initialisations simultanées dont une Java.
- JDT LS 1.63.0 sur JDK 25 ; tas Java configuré à 768 Mio, qui ne limite pas toute la mémoire du processus. Modèles Java ciblant Java 21.
- Pyright 1.1.414, Ruff 0.17.3, gopls 0.23.0, Go 1.26.2.
- Modèles issus des templates actuels, avec une méthode de complétion ajoutée ; bibliothèques réelles et dépendances disponibles dans les projets.
- Dépendances Maven préparées avant mesure. Caches et projets temporaires montés sur le disque du Mac, car le disque virtuel Docker est presque plein. Cela peut influencer les temps et la comptabilité des caches.
- Échantillonnage Docker continu, approximativement toutes les secondes ; les pics très courts peuvent échapper à cet échantillonnage. Le compteur noyau fournit en complément le maximum global.
- Backend, PostgreSQL, Kafka et simulations ne sont pas compris. Aucun essai sur le VPS ni test prolongé avec de grandes bibliothèques utilisateur n’est inclus.

## Lecture pour le VPS

Le partage entre modèles fonctionne : dans cet essai, le passage d’un à trois documents ajoute environ 87 Mio pour Python, 66 Mio pour Go, 35 Mio pour xDEVS Java et 59 Mio pour MS4 Me Java, sans création de nouveaux moteurs. Java reste le coût principal par espace.

Le plafond de 4 Gio a suffi pour les six espaces testés, avec environ 650 Mio de marge sur le pic noyau. Cette observation ne garantit pas le même résultat avec davantage de fichiers, des dépendances plus volumineuses ou une utilisation prolongée. Sur un VPS de 8 Go, il faut ajouter les besoins du backend, de PostgreSQL, de Kafka et des simulations avant de relever les limites.

Un auxiliaire `gopls ** telemetry **` représente environ 117 Mio de PSS dans le scénario Go isolé. C’est une piste de mesure supplémentaire, sans changement appliqué à la configuration. La commande officielle pour désactiver cette collecte est `go telemetry off` ; son effet sur la consommation devrait être comparé séparément : [documentation Go](https://go.dev/doc/telemetry).

## Vérification sur le serveur

```sh
docker stats --no-stream
free -h
```

Pendant une ouverture réelle, utiliser `docker stats` sans `--no-stream` pour suivre les variations. Comparer la RAM globale avant/après et tenir compte des autres services. Les paramètres de production n’ont pas été modifiés pendant cette mesure.
