# Proposition de refonte

Cette application React contient actuellement un seul composant principal de plus de mille lignes. Pour garantir une maintenance et une évolutivité optimales sans altérer les fonctionnalités existantes, voici un plan de refonte.

## Objectifs

- **Lisibilité** : simplifier la navigation dans le code grâce à un découpage clair.
- **Réutilisabilité** : isoler les éléments d'interface pour faciliter les évolutions futures.
- **Robustesse** : introduire des types et préparer l'ajout de tests.

## Arborescence suggérée

```
src/
├─ components/
│  ├─ BottomNavigation.tsx
│  ├─ ProductCard.tsx
│  └─ ...
├─ pages/
│  ├─ Home.tsx
│  ├─ Dashboard.tsx
│  ├─ OrderIntrants.tsx
│  ├─ Knowledge.tsx
│  └─ Profile.tsx
├─ hooks/
│  └─ useLocation.ts
├─ App.tsx (point d'entrée)
└─ index.tsx
```

Chaque page importe les composants nécessaires. Les états globaux (panier, historique, localisation) peuvent être gérés via le Context API ou un store léger (Zustand, Redux Toolkit).

## Étapes de migration

1. **Créer la structure `src/`** et déplacer `agroscan-app.tsx` en `src/App.tsx`.
2. **Extraire les composants** du fichier principal : barre de navigation, cartes produit, liste d'historique d'analyse, etc.
3. **Définir les types** (`Analysis`, `Product`, `Order`, etc.) dans un dossier `types` ou directement dans les fichiers concernés.
4. **Ajouter un gestionnaire de routes** (par exemple `react-router`) pour basculer entre les pages plutôt que de gérer manuellement `currentScreen`.
5. **Mettre en place des tests unitaires** pour les fonctions utilitaires (calcul du total panier, filtrage de la base de connaissances...).

## Design et présentation

- Utiliser Tailwind CSS de manière cohérente : créer un fichier `tailwind.config.js` avec les couleurs de la marque.
- Prévoir un mode sombre/clair pour améliorer l'ergonomie.
- Ajouter des animations légères lors des changements d'onglet ou du chargement des analyses.

Ce plan conserve l'intégralité des fonctionnalités actuelles tout en posant les bases d'une application plus claire et plus professionnelle.
