# Autoscope — Backend API

API FastAPI implémentant :
- Ingestion des payloads véhicule (`/ingest`) avec moteur de règles DTC/seuils, modèle ML prédictif,
  suivi kilométrique et rappels d'entretien programmés
- Consultation véhicule pour l'app mobile (`/vehicles/{id}/readings`, `/vehicles/{id}/alerts`)
- Portail mécanicien (`/mechanic/...`), **protégé par authentification JWT** : vue d'ensemble des
  véhicules, alertes, notes, clôture d'entretien — API + mini-interface web (`/portal/mechanic/`)
- API partenaires assurance/flotte (`/partners/...`), protégée par clé API, avec scoring UBI
  anonymisé qui intègre à la fois le comportement de conduite et le risque de panne prédit par le ML

## Démarrage

```bash
python -m venv .venv
.venv/Scripts/activate   # Windows
pip install -r requirements.txt
alembic upgrade head               # crée le schéma (voir section Migrations)
uvicorn app.main:app --reload --port 8000
```

Base de données : SQLite par défaut (`autoscope.db`), configurable via la variable d'environnement
`AUTOSCOPE_DATABASE_URL` (ex. `postgresql://user:pass@host/dbname` en production — non testé ici
faute d'instance Postgres disponible, mais le dialecte est géré nativement par SQLAlchemy/Alembic).

Clés API partenaires : variable d'environnement `AUTOSCOPE_PARTNER_API_KEYS` (séparées par des virgules).
Par défaut : `demo-insurer-key`.

## Authentification mécanicien

Un compte mécanicien par défaut est créé automatiquement au premier démarrage :
- Identifiant : `AUTOSCOPE_DEFAULT_MECHANIC_USERNAME` (défaut `mecanicien`)
- Mot de passe : `AUTOSCOPE_DEFAULT_MECHANIC_PASSWORD` (défaut `autoscope-demo-2026` — **à changer
  en production**, via la variable d'environnement avant le tout premier démarrage)

`AUTOSCOPE_JWT_SECRET` doit être défini explicitement en production (valeur par défaut non sécurisée
sinon). Les jetons expirent après 12h.

Il n'y a pas encore d'interface de création/gestion de plusieurs comptes mécaniciens — un seul
compte partagé pour l'instant. À étendre si plusieurs garages doivent être cloisonnés.

## Migrations (Alembic)

Le schéma est versionné avec Alembic plutôt que de dépendre de `create_all` en production :

```bash
alembic upgrade head                      # applique les migrations
alembic revision --autogenerate -m "..."  # génère une nouvelle migration après un changement de modèle
```

Pour le développement local rapide (SQLite), `create_all` reste actif par défaut au démarrage de
l'app pour éviter une étape manuelle. Pour un déploiement Postgres, définir
`AUTOSCOPE_SKIP_AUTO_CREATE=1` et gérer le schéma exclusivement via `alembic upgrade head`.

## Entraîner le modèle prédictif

Un modèle par défaut (données synthétiques) est généré automatiquement au premier appel.
Pour le régénérer explicitement :

```bash
python -m app.ml.train
```

## Rappels d'entretien

Le kilométrage est estimé à partir de la vitesse et du temps écoulé entre deux relevés (pas
d'odomètre réel, l'OBD ne le fournit pas via les PID de base utilisés ici). Un rappel de vidange
(catégorie `maintenance`) se déclenche au-delà de 5000 km depuis le dernier entretien, ou après 180
jours — sans se répéter tant qu'un mécanicien n'a pas marqué l'entretien comme effectué
(`POST /mechanic/vehicles/{id}/service-complete`).

## Tests

```bash
pytest
```

20 tests : moteur de règles DTC/seuils (y compris le risque de fatigue remonté par l'app mobile),
authentification mécanicien (accès refusé sans jeton, jeton invalide rejeté), rappels d'entretien
(déclenchement, non-répétition, remise à zéro), et scoring assureur (clé API requise, anonymisation,
intégration du risque ML). Chaque test tourne sur une base SQLite en mémoire isolée — aucun état
partagé entre tests.

## Exemple d'appel

```bash
curl -X POST http://localhost:8000/ingest -H "Content-Type: application/json" -d '{
  "vehicle_id": "GH-123-ABC",
  "timestamp": "2025-05-22T16:15:00Z",
  "location": { "lat": 5.56, "lon": -0.21, "speed": 48 },
  "driving_score": 72,
  "events": ["freinage_brusque"],
  "obd": { "rpm": 1710, "dtc": ["P0301"], "coolant_temp": 98, "battery_voltage": 11.7 }
}'
```

Documentation interactive : `http://localhost:8000/docs`
