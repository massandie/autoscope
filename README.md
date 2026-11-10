# Autoscope

Implémentation du MVP décrit dans [SPEC.md](SPEC.md).

## Structure

- [`backend/`](backend/) — API FastAPI : ingestion télématique, moteur de règles DTC/seuils,
  modèle ML prédictif, rappels d'entretien programmés, portail mécanicien authentifié (JWT, API +
  mini-UI web), API assurance/flotte (clé API, scoring UBI anonymisé unifié avec le risque ML).
- [`mobile/`](mobile/) — App React Native (Expo) : dashboard conducteur avec design professionnel
  (en-tête dégradé, cartes d'alertes), connecteur OBD-II (mock actif + implémentation BLE réelle non
  testée matériellement), analyse comportementale par capteurs, file hors-ligne + synchronisation
  en arrière-plan OS.

## Lancer le tout en local

```bash
# Terminal 1 — backend
cd backend
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Terminal 2 — mobile
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://<ip-locale>:8000 npx expo start
```

Portail mécanicien : `http://localhost:8000/portal/mechanic/` (identifiants par défaut :
`mecanicien` / `autoscope-demo-2026`, voir [backend/README.md](backend/README.md#authentification-mécanicien))
Documentation API : `http://localhost:8000/docs`

## Tests automatisés

```bash
cd backend && pytest        # 20 tests
cd mobile && npm test       # 33 tests
```

## Ce qui est fait et vérifié

- [x] Backend : ingestion, moteur de règles, ML prédictif (synthétique), migrations Alembic,
      19 tests automatisés — testé de bout en bout (curl + pytest)
- [x] Portail mécanicien : authentification JWT, API + interface web (véhicules, alertes, notes,
      clôture d'entretien) — testé de bout en bout
- [x] Rappels d'entretien programmés (kilométrage estimé + délai), sans répétition intempestive —
      testé de bout en bout
- [x] API partenaires (assurance/flotte) : clé API, scoring UBI anonymisé intégrant le risque ML —
      testé de bout en bout
- [x] App mobile : dashboard (design professionnel), capteurs de conduite (accéléro/gyro/GPS), file
      hors-ligne + sync — **confirmé fonctionnel sur téléphone Android réel via Expo Go**
- [x] Détection du risque de fatigue (conduite continue > 2h) et excès de vitesse basé sur la
      limitation réelle de la route (OpenStreetMap/Overpass, avec repli sur une valeur par défaut)
- [x] Parsing du protocole ELM327/SAE J1979 (RPM, température, tension, codes DTC) — testé
      unitairement (pur, sans matériel)

## Ce qui est écrit mais non vérifiable dans cet environnement

Ces points nécessitent du matériel ou un environnement indisponible ici (pas d'émulateur Android,
pas de Docker/Postgres, pas de dongle OBD-II physique) :

- Connecteur OBD-II BLE réel (`mobile/src/services/bleObd.ts`) — code complet et protocole testé,
  mais jamais connecté à un vrai dongle ; nécessite un dev client Expo (`expo prebuild`)
- Synchronisation en arrière-plan au niveau OS (`expo-background-task`) — la fonction exécutée est
  testée, mais l'ordonnancement réel par Android/iOS n'est utilisable qu'en dev client, pas Expo Go
- PostgreSQL en production — le code est écrit pour (SQLAlchemy + Alembic), mais jamais exécuté
  contre une vraie instance Postgres faute de Docker disponible ici

## Ce qui reste (hors scope)

- Entraînement du modèle ML sur données réelles (actuellement données synthétiques)
- Gestion de plusieurs comptes mécaniciens / rôles multiples (un seul compte partagé actuellement)
- Déploiement cloud (Postgres managé, S3/Firebase pour le stockage de fichiers)
- Facturation/abonnement (freemium, API payante)
