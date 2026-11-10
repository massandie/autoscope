# Autoscope — Site vitrine

Page de présentation publique d'Autoscope : problème/solution, les trois surfaces du produit
(app mobile, portail mécanicien, API partenaires), un aperçu technique, et les coordonnées de
contact. Fichiers séparés, aucune dépendance de build.

## Structure

- `index.html` — page unique
- `css/style.css` — styles (thème clair/sombre automatique selon le système)
- `js/script.js` — menu mobile, animations au défilement, copie des coordonnées

## Aperçu local

```bash
cd website
python -m http.server 8099
```

Puis ouvrir `http://localhost:8099`.

## Déploiement

Fichiers 100% statiques : déployables tels quels sur Render (Static Site), GitHub Pages, Netlify
ou Vercel, sans configuration de build. Les liens vers le portail mécanicien, la documentation API
et le dépôt GitHub pointent vers les URLs déjà en ligne du projet.
