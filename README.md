# AgroScan App

AgroScan est une application mobile React visant à fournir aux agriculteurs une analyse intelligente des cultures et un accès facile aux intrants nécessaires. L'application utilise un modèle CNN TensorFlow.js et récupère automatiquement les intrants depuis un Google Sheet mis à jour chaque jour à 6h00.

## Fonctionnalités principales

- **Analyse de cultures** : capture d'images, détection d'insectes et analyse de la qualité du sol.
- **Historique & Tableau de bord** : suivi des analyses précédentes avec indicateurs de tendance.
- **Catalogue d'intrants** : ajout au panier et finalisation des commandes.
- **Base de connaissances** : articles filtrables par recherche et par catégorie.
- **Profil utilisateur** : localisation et préférences stockées en local.

## Améliorations proposées

Ce dépôt contient un composant unique volumineux (`agroscan-app.tsx`). Pour améliorer la maintenabilité tout en conservant la logique actuelle :

1. **Découpage en composants** : séparer l'application en pages (`Home`, `Dashboard`, `OrderIntrants`, etc.) et composants réutilisables (`BottomNavigation`, `ProductCard`, `AnalysisHistoryItem`...).
2. **Organisation du code** : placer les fichiers dans un dossier `src` avec des sous-dossiers `components`, `pages`, `hooks` et `utils`.
3. **Typage renforcé** : définir des interfaces TypeScript pour les données d'analyse, les produits et l'historique des commandes.
4. **Styles centralisés** : extraire les classes Tailwind communes dans des composants ou utiliser un fichier de configuration pour la palette de couleurs.
5. **Documentation complète** : décrire l'architecture, le processus d'installation et les commandes utiles.

Une proposition plus détaillée est disponible dans [`docs/REDESIGN.md`](docs/REDESIGN.md).

## Démarrage rapide

Cette version du dépôt inclut désormais une configuration Vite et Tailwind CSS.
Après installation des dépendances vous pouvez lancer l'application en mode
développement :

```
npm install
npm run dev
```

Avant de démarrer l'application, copiez le fichier `.env.example` vers `.env` et
renseignez vos propres identifiants :

```bash
cp .env.example .env
# éditer les valeurs VITE_GOOGLE_SHEET_ID et VITE_OPENCAGE_API_KEY
```

Pour charger la base de données fournie à l'adresse Google Sheets suivante :
[https://docs.google.com/spreadsheets/d/1yhiNXxU9azc78Z5rvUnJ6EKLEVZMZk5HeWugrqBn6_g](https://docs.google.com/spreadsheets/d/1yhiNXxU9azc78Z5rvUnJ6EKLEVZMZk5HeWugrqBn6_g),
indiquez simplement l'identifiant dans votre fichier `.env` :

```bash
VITE_GOOGLE_SHEET_ID=1yhiNXxU9azc78Z5rvUnJ6EKLEVZMZk5HeWugrqBn6_g
```

L'application récupérera toutes les feuilles du classeur et mettra à jour le catalogue d'intrants automatiquement chaque jour à **06h00**.

Le composant principal se trouve dans `src/App.tsx`. Pour générer une version de
production utilisez `npm run build`.

## Déploiement

L'application est déployée automatiquement sur **GitHub Pages** via le workflow
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) : à chaque push
sur `main` (ou manuellement depuis l'onglet *Actions*), le build est publié sur
la branche `gh-pages`, servie par GitHub Pages.

URL de production : <https://antoine67tranqui.github.io/AGRISCAN-APP/>

### Secrets optionnels

Dans **Settings → Secrets and variables → Actions**, vous pouvez définir :

- `VITE_GOOGLE_SHEET_ID` — identifiant du classeur Google Sheets du catalogue
  d'intrants (par défaut, le classeur public documenté ci-dessus est utilisé) ;
- `VITE_OPENCAGE_API_KEY` — clé OpenCage pour le géocodage inverse de la
  localisation (sans elle, la détection automatique de la ville est désactivée).

> ⚠️ Les variables `VITE_*` sont intégrées au bundle JavaScript et donc
> visibles publiquement. N'utilisez que des clés prévues pour un usage côté
> client (clé OpenCage restreinte, Google Sheet publié en lecture seule).

Des tests automatisés ne sont pas fournis. Vous pouvez ajouter votre propre
configuration Jest ou Vitest pour garantir la non-régression lors de futurs
refactorings.
