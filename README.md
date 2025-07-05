# AgroScan App

AgroScan est une application mobile React visant à fournir aux agriculteurs une analyse intelligente des cultures et un accès facile aux intrants nécessaires. L'application combine reconnaissance d'images par CNN (EfficientNet-B4 + YOLOv8) et gestion d'achats d'intrants agricoles.

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

## Démarrage rapide (version actuelle)

L'application n'inclut pas encore de configuration de build. Pour tester le composant actuel, créez un environnement React (ex. `create-react-app` ou `vite`) puis importez `agroscan-app.tsx`.

```
# Exemple rapide avec Vite
npm create vite@latest agroscan-demo -- --template react-ts
cd agroscan-demo
npm install
# Copier agroscan-app.tsx dans src/
# Remplacer App.tsx par l'import du composant
npm run dev
```

Des tests automatisés ne sont pas fournis. Vous pouvez ajouter votre propre configuration Jest ou Vitest pour garantir la non-régression lors du futur refactoring.
