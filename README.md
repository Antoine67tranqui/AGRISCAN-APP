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

Le composant principal se trouve dans `src/App.tsx`. Pour générer une version de
production utilisez `npm run build`.

Des tests automatisés ne sont pas fournis. Vous pouvez ajouter votre propre
configuration Jest ou Vitest pour garantir la non-régression lors de futurs
refactorings.
