# DEVSimPy Python — API native PyPDEVS / Parallel DEVS

L'intégration `devsimpy-python@1.0.0` utilise les **vraies classes PyPDEVS 2.4.1 référencées par DEVSimPy**. Les modèles héritent de `pypdevs.DEVS.AtomicDEVS`. Les entrées et les sorties utilisent des bags : un dictionnaire **objet port → liste de messages**.

Ce profil remplace le prototype Classic PyDEVS de cette branche, qui n'a pas été publié. Il n'embarque plus `DomainInterface`, `DomainBehavior`, `Message`, `peek` ou `poke`. Un ancien code utilisant ces méthodes doit être adapté explicitement ; aucune traduction automatique n'est appliquée. Une version déjà publiée ne doit jamais être remplacée de cette manière : créer une nouvelle version d'intégration si des modèles déployés la référencent.

## Utilisation

1. Créer un atomique et choisir **DEVSimPy Python**.
2. Déclarer dans les propriétés les mêmes ports et directions que dans le constructeur. Le template utilise un port de sortie `out`.
3. Les paramètres des propriétés sont transmis comme arguments nommés au constructeur. L'état initial est donc calculé avec les bonnes valeurs.
4. Utiliser ces atomiques dans les couplés DEVSForge habituels. Le backend les aplatit ; le coordinateur pilote les atomiques, y compris dans une simulation mixte.

Un modèle minimal :

```python
from pypdevs.DEVS import AtomicDEVS
from pypdevs.infinity import INFINITY

class Relay(AtomicDEVS):
    def __init__(self):
        super().__init__("Relay")
        self.in_port = self.addInPort("in")
        self.out = self.addOutPort("out")
        self.state = {"sigma": INFINITY, "values": []}

    def extTransition(self, inputs):
        return {"sigma": 0, "values": list(inputs.get(self.in_port, []))}

    def outputFnc(self):
        return {self.out: self.state["values"]}

    def intTransition(self):
        return {"sigma": INFINITY, "values": []}

    def timeAdvance(self):
        return self.state["sigma"]
```

Plusieurs `AddInput` sur un même port sont accumulés, puis livrés **ensemble dans un seul appel** à `extTransition(inputs)` ou `confTransition(inputs)`. Les doublons sont conservés. Les sorties d'un bag sont transmises séparément dans le champ gRPC `values_json`, qui était déjà répété : aucun changement du protocole commun n'est nécessaire.

Il faut distinguer le bag et une valeur qui est elle-même une liste :

```python
return {self.out: [1, 2]}       # deux messages
return {self.out: [[1, 2]]}     # un message contenant la liste [1, 2]
return {self.out: []}           # aucun message
return {}                     # aucune sortie
```

Les messages sont des valeurs JSON ordinaires : dictionnaires, listes, nombres, chaînes, booléens ou null. Aucun objet `Message(value, time)` n'est ajouté. Le temps est géré par le coordinateur ; une date métier éventuelle doit être portée explicitement par le payload du modèle.

## Transitions et confluence

- `intTransition()`, `extTransition(inputs)` et `confTransition(inputs)` **retournent le nouvel état**. Le pont l'affecte à `self.state`, y compris si l'état retourné est `None`, comme le noyau natif. Une mutation en place doit être suivie de `return self.state`.
- `self.elapsed` représente le temps écoulé pour une transition externe. Le décalage `elapsed` initial est pris en compte.
- La confluence appelle `confTransition(inputs)` **une seule fois**, avec le bag complet et `elapsed=0`, comme PyPDEVS. L'implémentation héritée d'`AtomicDEVS` applique interne puis externe. Une surcharge peut choisir une autre politique.
- `timeAdvance()` retourne une durée positive ou nulle, ou `INFINITY`. Les durées négatives et NaN sont refusées.
- Les attributs natifs `time_last` et `time_next` restent des tuples `(temps, âge)`. L'âge local permet les transitions successives de durée nulle ; le protocole du coordinateur DEVSForge reste fondé sur son temps scalaire existant. Le simulateur distribué et l'ordonnancement propre à PyPDEVS ne sont pas lancés.
- Chaque initialisation crée une instance neuve. Un hook DEVSForge optionnel `finish()` sans argument peut libérer des ressources avant remplacement et à la fermeture. Il est distinct de la méthode native `finalize(...)`, qui prépare les identités du modèle avant la simulation.

## Ports et validation

Le constructeur peut conserver les objets renvoyés par `addInPort("in")` et `addOutPort("out")`. Le pont associe ces objets aux ports des propriétés **par nom et direction**, sans remplacer leurs références. Contrairement à l'ancienne API PyDEVS, ces méthodes natives respectent leur argument `name`.

Les propriétés peuvent aussi fournir des ports omis du constructeur ; ils sont alors créés après celui-ci et accessibles via `IPorts`/`OPorts`. Les ports anonymes `portN` sont associés par ordre. Un port explicitement nommé qui ne correspond pas, un port supplémentaire ou une sortie vers un port inconnu provoque une erreur exploitable.

`outputFnc()` doit renvoyer un dictionnaire de listes, même pour une seule sortie. Les tuples ou valeurs scalaires à la place d'un bag sont refusés, ainsi que les payloads non sérialisables et les valeurs non finies. Une transition interne avec des entrées en attente est également refusée ; le runner doit choisir externe ou confluente.

## Architecture des fichiers

```text
devsimpy-python/
  integration.json             identité, ressources, Pyright/Ruff
  prepare.go                   model.py, lien de bibliothèque, lancement Python
  templates/atomic.tmpl        template natif AtomicDEVS
  ai/model.md                  contrat de génération Parallel DEVS à bags
  wrapper/
    pypdevs/                   vraies sources de modélisation PyPDEVS
      DEVS.py                  AtomicDEVS, CoupledDEVS, Port (non modifié)
      infinity.py              INFINITY (non modifié)
      logger.py, util.py       dépendances de la bibliothèque
      middleware.py, MPIRedirect.py
      LICENSE, NOTICE          licence Apache-2.0 et attributions
    bridge.py                  buffers de bags, transitions et sérialisation RPC
    main.py                    démarrage du serveur gRPC de l'atomique
    proto/                     bindings du contrat commun
    requirements.txt           dépendances du transport
  upstream.json                références Git et empreintes originales/installées
  vendor-upstream.py           copie reproductible depuis les deux clones
  generate-proto.sh            génération gRPC Python
  tests/                       tests RPC et exemple Parallel DEVS amont
```

`../registry.go` enregistre la préparation compilée. Le lancement et les diagnostics de processus sont partagés avec xDEVS Python et MS4 Me dans `../../internal/generators/process.go`.

Le backend, les handlers et les formulaires utilisent le catalogue générique : pas de nouvelle route ni de migration. Les modèles atomiques continuent à référencer leur intégration et sa version. Les badges lisent son libellé via le cache existant de `useIntegrations`.

En analyse, le dossier `pypdevs` du projet privé pointe vers les sources réelles, partagées en lecture seule. Pyright/Ruff disposent des mêmes classes que le runtime. Ouvrir l'éditeur n'importe ni n'exécute le code utilisateur. Le contexte IA contient le template, les instructions et les sources natives de `DEVS.py` et `infinity.py`.

En simulation, le wrapper est copié dans un projet privé, avec son `model.py`. Le constructeur, l'affectation des ports et la préparation native des identités sont exécutés, puis le serveur gRPC démarre. **Aucun `Simulator`, Kafka supplémentaire ou MPI n'est lancé par PyPDEVS.** Les fichiers de middleware sont des dépendances d'import de sa bibliothèque ; leur fonction de démarrage n'est pas appelée.

## Provenance et licences

DEVSimPy : [commit 7f8b9d57fa11ac9c4643175c0a7bd0daf89ad9e7](https://github.com/capocchi/DEVSimPy/tree/7f8b9d57fa11ac9c4643175c0a7bd0daf89ad9e7). Son gitlink `devsimpy/DEVSKernel/PyPDEVS/pypdevs241/pypdevs` référence précisément [PyPDEVS 979d708a184d342313cc7c2b6bd24225e475af3b](https://github.com/kdheepak/pypdevs/tree/979d708a184d342313cc7c2b6bd24225e475af3b).

Les sources PyPDEVS reprises sont sous **Apache-2.0**, avec `LICENSE`, `NOTICE` et en-têtes conservés. Le code du pont écrit pour DEVSForge suit la licence MIT du projet. L'ancienne façade GPL `DomainInterface` n'est plus embarquée dans ce profil.

`DEVS.py`, `infinity.py`, `logger.py`, `middleware.py` et `__init__.py` restent inchangés. Deux corrections Python 3 sont consignées dans `upstream.json` : `MPIRedirect` importe `builtins` au lieu du module Python 2 `exceptions`, et l'affichage de `DEVSException` utilise `Exception.args`. Les règles de transitions, ports et bags de la bibliothèque ne sont pas réécrites.

Pour reproduire la copie, positionner les clones sur les commits ci-dessus, puis :

```sh
python3 simulator/runner/integrations/devsimpy-python/vendor-upstream.py /chemin/DEVSimPy /chemin/PythonPDEVS
```

Le script vérifie que le clone PyPDEVS correspond au gitlink de DEVSimPy. Aucun sous-module n'est ajouté à DEVSForge. `tests/fixtures/trafficlight_parallel.py` conserve l'exemple Parallel DEVS amont sans modification ; le test ajoute uniquement une factory pour sélectionner son atomique TrafficLight parmi les classes du fichier.

## Tests et construction

```sh
task simulator:devsimpy:test
task simulator:lsp:test
task simulator:runner:test -- -run TestRealWrapper -v
task simulator:test -- -run 'TestMixedFrameworksIncludingDEVSimPy|TestMixedFrameworksWithPyPDEVSBags' -v
```

Les tests RPC vérifient plusieurs messages sur un même port, plusieurs ports, doublons, payloads listes imbriqués, états retournés, confluence native/héritée, décalage temporel initial, paramètres, erreurs et nettoyage. L'exemple TrafficLight amont vérifie aussi une véritable classe PyPDEVS.

La chaîne **Go → Python → Java → MS4 Me → PyPDEVS** conserve ses résultats 5 → 15 → 30 → 90 → 180. Un autre test fait converger une source Go et une source PyPDEVS vers le même port : quatre messages, dont un doublon et une liste comme payload, doivent arriver dans **un seul appel externe**. Les tests LSP vérifient notamment `addInPort`, `confTransition` et `math.sqrt` dans plusieurs documents du même serveur.

Observation de validation : un premier essai mixte a attribué le même port gRPC aux runners Go et MS4 Me. Le sélecteur existant `runner/internal/config/config.go:pickFreePort` ferme sa réservation avant le démarrage du wrapper ; le port peut donc être réattribué pendant la compilation. Les essais relancés ont réussi, dont celui des bags. Ce risque de transport préexistant reste à corriger séparément ; il ne faut pas interpréter une réponse `Initialize` comme une preuve d'identité du serveur qui a répondu. L'allocation des ports et le contrat gRPC ne sont pas modifiés par cette conversion vers PyPDEVS.

Les dépendances sont installées une fois dans `simulator/Dockerfile`. Les trois parcours Compose partagent déjà le catalogue : reconstruire backend, simulateur et LSP ensemble avec les commandes habituelles `task back:dev` et `task front:dev`. Aucune nouvelle variable `.env` n'est ajoutée. Aucun déploiement VPS n'est effectué ici.

Le contrat reste `simulator/proto/devs.proto`. Sa génération Python reproductible reste disponible avec `task simulator:proto -- devsimpy-python`. Voir aussi [la génération gRPC](../../../../docs/generate-proto-files.md).

## Limites de périmètre

Cette intégration couvre les atomiques **Parallel DEVS natifs**. Elle n'assure pas la compatibilité automatique des anciens modèles Classic utilisant `peek`/`poke`, ni l'import des projets GUI `.dsp`/`.amd`. Les fichiers auxiliaires utilisateur, la simulation distribuée PyPDEVS, les structures dynamiques et les couplés Python opaques ne sont pas ajoutés. Les couplés restent construits et aplatis par DEVSForge, conformément à son fonctionnement actuel.
