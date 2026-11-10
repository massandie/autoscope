# Autoscope : Plateforme d'Analyse de l'État de Santé des Véhicules et des Comportements de Conduite Basée sur l'IA pour les Marchés Émergents

## Résumé Exécutif

Autoscope est une plateforme mobile de télématique et de diagnostic automobile conçue spécifiquement pour les marchés émergents. Elle combine les données des capteurs des smartphones et des dongles OBD-II à bas coût pour fournir de la maintenance prédictive, la détection en temps réel de pannes et l'analyse comportementale des conducteurs à destination des particuliers, des gestionnaires de flotte et des assureurs.

Les marchés émergents rencontrent souvent des défis critiques liés à la maintenance des véhicules, la sécurité routière et l'accessibilité à l'assurance. Autoscope répond à ces défis par une solution abordable, scalable et fonctionnant hors ligne, sans dépendre des systèmes propriétaires des constructeurs automobiles.

## Problématique

| Problème | Solution proposée par Autoscope |
|---|---|
| Maintenance rare et réactive | Alertes prédictives et diagnostics en temps réel |
| Accès limité à des outils abordables | Dongles OBD-II à faible coût et capteurs de smartphone |
| Mauvaise infrastructure routière | Analyse des habitudes de conduite via les capteurs |
| Évaluation des risques d'assurance floue | Scoring télématique et rapports automatisés |
| Faible expertise technique | Application intuitive avec détection automatique des pannes |

## Vue d'ensemble du produit

### 1. Application Mobile (React Native)
- Connexion Bluetooth aux dongles OBD-II compatibles ELM327
- Utilisation des capteurs intégrés (accéléromètre, GPS, gyroscope)
- Collecte de données en temps réel sur le véhicule et le conducteur
- Fonctionne hors ligne avec synchronisation en arrière-plan
- Affiche les alertes, codes de défaut et performances de conduite

### 2. Portail Mécanicien
- Permet un support à distance par des mécaniciens certifiés
- Accès aux données client (avec autorisation)
- Recommandations de pièces et d'entretien à partir des DTC et de l'utilisation
- Sert de canal d'acquisition client pour les garages locaux

### 3. API pour Assurance et Gestion de Flotte
- Accès anonymisé ou autorisé aux données des véhicules
- Permet une assurance basée sur l'usage et un scoring prédictif
- Intégration dans les systèmes des assureurs via API REST

## Stack Technique

| Couche | Technologie |
|---|---|
| Application mobile | React Native (multi-plateforme) |
| Intégration capteurs | react-native-sensors, geolocation-service |
| Communication OBD-II | react-native-bluetooth-serial-next |
| API backend | FastAPI (Python) ou Node.js |
| Base de données | PostgreSQL |
| Analyse/IA | Scikit-learn ou TensorFlow Lite (mobile ML) |
| Stockage cloud | AWS S3 ou Firebase |

## Structure des données (exemple de payload)

```json
{
  "vehicle_id": "GH-123-ABC",
  "timestamp": "2025-05-22T16:15:00Z",
  "location": { "lat": 5.56, "lon": -0.21, "speed": 48 },
  "driving_score": 72,
  "events": [ "freinage_brusque", "virage_gauche" ],
  "obd": {
    "rpm": 1710,
    "dtc": [ "P0301" ],
    "coolant_temp": 98,
    "battery_voltage": 11.7
  },
  "predicted_issue": "Raté d'allumage imminent dans un cylindre"
}
```

## Algorithme et Moteur d'Analyse

Autoscope repose sur une architecture hybride combinant des règles logiques et des modèles d'apprentissage automatique pour interpréter les données télématiques et fournir des recommandations.

### A. Collecte des données
Les données des smartphones et des dongles OBD-II sont agrégées dans un payload unifié comprenant localisation, accélération, régime moteur, codes de défauts, etc.

### B. Moteur basé sur des règles
Utilisation de la base des DTC (Diagnostic Trouble Codes) et de seuils pour détecter les pannes immédiates :
- Si le code P0301 est détecté → recommander l'inspection du cylindre concerné.
- Si la température du liquide de refroidissement dépasse 105°C → alerte de surchauffe.

### C. Analyse du comportement de conduite
Grâce aux capteurs du smartphone, le système détecte :
- Freinages brusques (décélération > -5 m/s²)
- Virages serrés (données gyroscopiques)
- Excès de vitesse (GPS vs. limitations locales)
- Risque de fatigue (temps de conduite prolongé)

### D. Maintenance prédictive (Machine Learning)
À l'aide de modèles supervisés formés sur des données historiques :
- Entrées : tendance du régime moteur, fréquence des DTC, tension batterie, score de conduite, données de trajet
- Sortie : panne prédite (ex. : alternateur défaillant dans 3 semaines), niveau de confiance, action recommandée

### E. Génération d'Insights
Les insights sont catégorisés comme :
- Alertes diagnostiques (ex. : « Efficacité catalyseur insuffisante »)
- Feedback comportemental (ex. : « Freinages brusques fréquents »)
- Avertissements prédictifs (ex. : « Batterie susceptible de tomber en panne »)
- Rappels d'entretien (ex. : « Vidange recommandée »)

Chaque insight inclut un niveau de gravité, d'urgence et une action recommandée.

## Modèle Économique

### Segments de clientèle
- Conducteurs individuels (voitures, motos, véhicules utilitaires)
- Gestionnaires de flotte (logistique, VTC, transport)
- Compagnies d'assurance
- Réseaux et garages automobiles

### Sources de revenus

| Source de revenu | Description |
|---|---|
| Abonnement freemium | Diagnostic de base gratuit, fonctionnalités premium payantes |
| Référencement de garages | Monétisation des clients redirigés vers des garages partenaires |
| API télématique pour assureurs | Vente de données sous licence pour l'assurance basée sur l'usage |
| Vente de matériel | Dongles OBD-II Bluetooth de marque |
| Maintenance prédictive | Abonnement mensuel pour alertes anticipées |
| Assistance routière | Intégration à la demande avec les réseaux locaux |

## Analyse Concurrentielle

| Entreprise | Domaine principal | Différenciation d'Autoscope |
|---|---|---|
| BlueDriver / OBDLink | Diagnostic grand public | Support matériel OBD-II ouvert et abordable |
| Geotab / Zubie | Télématique de flotte | Ciblage des petites flottes informelles |
| Autochek | Réparations et crédits auto | Ajout du diagnostic en temps réel et du feedback |
| RideSafe (Kenya) | Alertes d'urgence moto | Couverture multi-types + alertes prédictives |

L'avantage compétitif d'Autoscope réside dans son diagnostic hybride (OBD + mobile), sa conception offline-first, son moteur IA et sa localisation adaptée aux besoins des marchés émergents.

## Stratégie de Déploiement

1. Lancement pilote dans les grandes agglomérations (ex. : Lagos, Nairobi)
2. Partenariats avec garages locaux et vendeurs de pièces détachées
3. Collaboration avec des assureurs pour développer l'assurance à l'usage
4. Expansion via les services de flotte, les ateliers de mécanique et les plateformes VTC

## Conclusion

Autoscope intègre des capteurs abordables, la télémétrie mobile et l'intelligence artificielle pour fournir des diagnostics en temps réel, de la maintenance prédictive et une analyse du comportement des conducteurs. Conçue pour les marchés émergents, la plateforme comble les lacunes en matière de sécurité routière, de maintenance et d'assurance. Grâce à des partenariats stratégiques et une intelligence localisée, Autoscope est bien positionnée pour devenir la référence en matière de télématique et de santé automobile dans les régions sous-desservies.
