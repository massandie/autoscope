# Autoscope — Application Mobile

App React Native (Expo) : tableau de bord conducteur avec connexion OBD-II, analyse comportementale
par capteurs (accéléromètre, gyroscope, GPS) et synchronisation hors-ligne vers le backend.

## Démarrage

```bash
npm install
npx expo start
```

Scanner le QR code avec l'app **Expo Go**, ou lancer sur émulateur (`a` pour Android, `i` pour iOS).

Pointer l'app vers le backend local en définissant l'URL de l'API avant de lancer :

```bash
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000 npx expo start
```

(utiliser l'IP locale de la machine qui héberge le backend, pas `localhost`, si vous testez sur un
téléphone physique.)

## Analyse comportementale

En plus du freinage brusque, des virages serrés et de l'excès de vitesse, `src/services/driving.ts`
détecte aussi :

- **Risque de fatigue** : alerte après 2h de conduite continue, répétée toutes les 30min tant que
  la conduite se poursuit (`DrivingMonitor`, testé unitairement avec une horloge injectable).
- **Excès de vitesse basé sur la limitation réelle de la route**, pas une valeur fixe partout :
  `src/services/speedLimit.ts` interroge l'API publique Overpass (OpenStreetMap) pour lire la
  limitation réelle (`maxspeed`) de la route la plus proche, avec un cache par cellule de ~100m
  pour éviter de la solliciter à chaque trame GPS. **Limite honnête** : ça nécessite une connexion
  réseau, l'API publique Overpass n'est pas prévue pour un usage de production intensif, et le tag
  `maxspeed` est peu renseigné dans beaucoup de zones (y compris certains marchés émergents visés
  par le produit) — d'où un repli systématique sur une limite par défaut configurable (50 km/h)
  quand la donnée réelle est indisponible. En production, remplacer par une API payante (HERE,
  TomTom, Mapbox) ou une base de données routières dédiée.

## État du connecteur OBD-II

Deux implémentations de l'interface `OBDConnector` (`src/services/obd.ts`) :

- **`MockOBDConnector`** (`src/services/obd.ts`) — simule un dongle ELM327 (RPM, température,
  tension, codes DTC aléatoires). **C'est celle utilisée par `DashboardScreen.tsx` actuellement**,
  et celle testée de bout en bout sur téléphone via Expo Go.
- **`BleOBDConnector`** (`src/services/bleObd.ts`) — vraie implémentation Bluetooth LE avec
  `react-native-ble-plx` : scan du dongle, envoi des commandes AT d'initialisation, requêtes PID
  (`010C` RPM, `0105` température, `ATRV` tension, mode `03` codes défaut) et parsing des réponses
  hexadécimales ELM327/SAE J1979. Le parsing protocolaire est testé unitairement et correct
  (`src/services/__tests__/elm327.test.ts`, 8 tests), **mais la couche BLE elle-même n'a pas pu être
  testée ici** : ça demande un dongle OBD-II réel et un build natif (Expo Go ne charge pas de module
  BLE natif). Pour l'essayer :
  1. `npx expo prebuild` puis un *dev client* (`npx expo run:android` / `run:ios`), ou un build EAS.
  2. Vérifier les UUID du service Bluetooth dans `bleObd.ts` contre le datasheet du dongle acheté
     (ceux par défaut correspondent au Nordic UART Service, utilisé par la plupart des clones ELM327
     à bas coût, mais varient d'un fabricant à l'autre).
  3. Remplacer `new MockOBDConnector()` par `new BleOBDConnector()` dans `DashboardScreen.tsx`.

## Synchronisation en arrière-plan

`src/services/backgroundSync.ts` enregistre une tâche OS (`expo-background-task` +
`expo-task-manager`) qui vide la file hors-ligne même quand l'app est fermée/arrière-plan, en plus
de la synchronisation en premier plan déjà active pendant qu'on conduit.

- La fonction exécutée par la tâche (`runBackgroundSync`) est testée unitairement et fonctionne
  (`src/services/__tests__/backgroundSync.test.ts`).
- **L'enregistrement OS réel n'est pas utilisable dans Expo Go** (message d'avertissement silencieux
  en console, l'app continue de fonctionner normalement) — comme le BLE, ça nécessite un dev client
  natif. La cadence réelle en production est ensuite décidée par l'OS (Android/iOS), pas par l'app.

## Tests

```bash
npm test
```

33 tests sur 6 suites : scoring de conduite, détection de fatigue (horloge injectable), résolution
de limitation de vitesse réelle (parsing + cache, Overpass mocké), connecteur OBD mock, parsing du
protocole ELM327 (RPM/température/tension/DTC), tâche de synchronisation en arrière-plan, et un test
d'intégration réel qui démarre le backend (`uvicorn app.main:app --port 8010`) et vérifie que la
file hors-ligne envoie bien les données et reçoit les alertes générées par le moteur de règles.
Lancer le backend sur le port 8010 avant `npm test`, sinon ce dernier test est sauté silencieusement.

Un test de rendu complet de `DashboardScreen` (presser le bouton, voir l'UI réagir en mémoire) n'a
pas pu être mis en place dans cet environnement : `@testing-library/react-native` 14.x attend le
nouveau package `test-renderer`, qui ne s'est pas branché correctement avec React 19.3.0 / Expo
SDK 58 ici. Le rendu réel a en revanche été confirmé à la main sur un téléphone Android via Expo Go.

## Structure

- `src/types` — types partagés, alignés sur les schémas Pydantic du backend
- `src/theme.ts` — couleurs, rayons, espacements partagés
- `src/components/AlertCard.tsx` — carte d'alerte (icône par catégorie/sévérité)
- `src/services/obd.ts` — interface `OBDConnector` + mock actif
- `src/services/bleObd.ts` — connecteur BLE réel (non testé matériellement, cf. ci-dessus)
- `src/services/elm327.ts` — parsing protocole ELM327/SAE J1979 (pur, testé)
- `src/services/driving.ts` — détection des événements de conduite (freinage, virages, vitesse)
- `src/services/offlineQueue.ts` — file d'attente locale + synchronisation réseau (premier plan)
- `src/services/backgroundSync.ts` — synchronisation OS en arrière-plan
- `src/services/api.ts` — client HTTP vers le backend
- `src/screens/DashboardScreen.tsx` — écran principal
