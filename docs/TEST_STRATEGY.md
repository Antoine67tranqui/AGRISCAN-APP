# Analyse de la couverture de tests et plan d'amélioration

> Analyse réalisée sur la branche `claude/test-coverage-analysis-16mew7`.
> Périmètre : `src/` (1 933 lignes TypeScript/TSX réparties sur 5 fichiers).

## 1. État des lieux

**La couverture de tests actuelle est de 0 %.**

| Élément | État |
| --- | --- |
| Fichiers de test | Aucun |
| Runner de tests (Vitest / Jest) | Non installé |
| Script `npm test` | Absent de `package.json` |
| Vérification de types en CI | Absente |
| Lint | Absent |
| CI (`.github/workflows/deploy.yml`) | `npm ci` + `npm run build` + déploiement uniquement |

Le `README.md` le reconnaît explicitement : « Des tests automatisés ne sont pas fournis. »

### Le point le plus urgent : la CI ne détecte aucune régression

Le workflow de déploiement n'exécute que `vite build`. Or **Vite ne vérifie pas les types** : il transpile via esbuild en supprimant les types sans les contrôler. Conséquence directe, mesurée sur cette branche :

```
$ npx tsc --noEmit   →  72 erreurs
$ npx vite build     →  ✓ built in 12.96s   (puis déployé en production)
```

Le pipeline est donc vert et déploie en production un code qui ne compile pas au sens de TypeScript, alors même que `tsconfig.json` active `"strict": true`.

### Bugs réels déjà présents, qu'un test minimal aurait interceptés

L'analyse statique a mis en évidence des défauts qui ne sont pas théoriques :

1. **`src/App.tsx:691` — le nom du ravageur est toujours `undefined`.**
   `advancedCNNAnalysis` construit son résultat avec `type: pestDetection.species`, mais les objets renvoyés par `analyzePestWithEnsemble` (`src/App.tsx:723-766`) exposent la clé `name`, jamais `species`. Trois conséquences en cascade :
   - l'interface affiche un nom de ravageur vide après chaque analyse (`App.tsx:1221` et `App.tsx:1737`) ;
   - le test `analysis.pestAnalysis.type !== 'Aucun détecté'` (`App.tsx:841`) est **toujours vrai**, donc le cas « aucun ravageur détecté » est traité comme une détection positive ;
   - `analysis.pestAnalysis.type.toLowerCase()` (`App.tsx:843`) lève un `TypeError` sur `undefined`.

2. **`src/App.tsx:833` — `getRecommendedProducts` n'est jamais appelée.** Toute la logique de recommandation d'intrants à partir du diagnostic est du code mort : aucun appelant dans le dépôt. La fonctionnalité annoncée dans le `README` n'est pas branchée.

3. **`src/App.tsx:842` — incohérence de casse et de type.** `product.target_pests?.some(...)` suppose un tableau, alors que les produits proviennent bruts d'un Google Sheet (`fetchSheetData`, `App.tsx:553`) où la cellule est une chaîne. `.some` n'existe pas sur une chaîne → `TypeError`. De plus la comparaison abaisse la casse d'un seul côté (`type.toLowerCase().includes(pest)`), donc une valeur `"Pucerons"` issue de la feuille ne matcherait jamais.

4. **`src/App.tsx:1390` — `product.unit_price.toLocaleString()` sans garde.** Les données de la feuille ne sont ni validées ni normalisées : si la colonne est absente ou renommée, `unit_price` vaut `undefined` et l'écran catalogue plante entièrement.

5. **`src/App.tsx:820-830` — distances `NaN`.** `calculateDistance` est appelée avec `product.latitude` / `product.longitude` qui n'existent pas nécessairement dans la feuille ; le résultat s'affiche alors comme `"NaN km"` au lieu de retomber sur `"Distance inconnue"`.

6. **Mutation d'état React** dans `addToCart` (`App.tsx:932-933`) et dans `CartContext.tsx:27-29` : `newCart[existingIndex].quantity += quantity` modifie en place l'objet du state précédent avant de renvoyer le nouveau tableau. Sous `StrictMode` et avec le rendu concurrent de React 18, ce type de mutation produit des quantités doublées ou des rendus incohérents.

7. **`CartContext` est du code mort dupliqué.** `main.tsx` enveloppe l'application dans `CartProvider`, mais `App.tsx` n'appelle jamais `useContext(CartContext)` : il maintient son propre state `cart` (`App.tsx:44`). Deux implémentations de panier coexistent, dont une inutilisée — et c'est la seule des deux qui soit typée.

### Obstacle structurel à la testabilité

`src/App.tsx` fait **1 769 lignes sur les 1 933 du projet (91 %)**. Tout y est dans un seul composant : état, appels réseau, inférence TensorFlow.js, logique métier, et cinq écrans de rendu. Aucune de ces fonctions n'est exportée, donc **rien n'est testable unitairement en l'état** sans passer par le rendu complet du composant. Les fonctions les plus intéressantes à tester (`calculateDistance`, `getRecommendedProducts`, `fetchSheetData`, `getTotalCartPrice`) sont des closures internes.

Par ailleurs, plusieurs fonctions métier reposent directement sur `Math.random()` (`analyzeSoilWithSpectral`, `analyzePlantHealthWithAttention`, `analyzePestWithEnsemble`) et sur `Date.now()` : elles sont non déterministes et donc non assertables sans injection de dépendance ou contrôle des faux temporisateurs.

## 2. Zones à couvrir, par priorité

Priorisation par **risque × probabilité de régression**, pas par facilité.

### Priorité 1 — Verrouiller le pipeline (avant même d'écrire un test)

C'est le meilleur rapport effort/bénéfice : ajouter `tsc --noEmit` à la CI aurait suffi à détecter le bug n°1 ci-dessus.

- Ajouter les scripts `typecheck` et `test` à `package.json`.
- Créer un workflow `ci.yml` déclenché sur `push` et `pull_request`, exécutant typecheck + tests.
- Faire échouer le déploiement si le typecheck échoue.
- Corriger les 72 erreurs de types (ou geler la dette avec une baseline et interdire toute nouvelle erreur).

### Priorité 2 — Parsing des données Google Sheets

C'est la zone la plus fragile : données externes, non typées, non validées, changeant quotidiennement à 6h00 — et hors du contrôle de l'équipe.

À tester (`fetchSheetData`, `fetchSheetList`, `fetchProductsFromSheet`) :

- `fetchSheetData` fait `JSON.parse(text.substring(47).slice(0, -2))` — un découpage à offset **codé en dur** sur le préambule de la réponse gviz. Tout changement de format côté Google casse silencieusement le catalogue. Il faut un test sur une réponse gviz réelle capturée en fixture, plus un test sur un préambule de longueur différente.
- Lignes avec cellules `null` (`cell ? cell.v : ''`), colonnes manquantes, colonnes en doublon, feuille vide.
- Réponse HTTP en erreur (403/404) et JSON malformé : aujourd'hui tout est avalé par un `catch` qui se contente d'un `console.error`, laissant l'utilisateur devant un catalogue vide sans explication.
- **Point critique** : `fetchSheetList` utilise l'API Google Sheets *v3 « feeds »* (`spreadsheets.google.com/feeds/worksheets/...`), **définitivement arrêtée par Google**. Un test d'intégration sur cet appel documenterait immédiatement que le chargement du catalogue est cassé en production.
- Normalisation attendue : `unit_price` en nombre, `latitude`/`longitude` en nombres, `target_pests` en tableau.

### Priorité 3 — Logique panier et commande

Logique purement métier, déterministe, sans I/O : elle se teste vite et bien, et touche directement à l'argent.

- `addToCart` : ajout d'un nouveau produit, ajout d'un produit déjà présent (incrément), recalcul de `totalPrice`, et **non-mutation du state précédent** (test de régression sur le bug n°6).
- `updateProductQuantity` / `updateQuantity` : le `Math.max(1, ...)` empêche de descendre à 0, donc **il est impossible de retirer un article du panier** — il n'existe aucune fonction `removeFromCart`. À couvrir comme lacune fonctionnelle.
- `getTotalCartPrice` : panier vide, `unit_price` non numérique, quantités importantes.
- `processOrder` : vidage du panier, ajout dans l'historique, passage à l'étape `confirmation`, et commande passée avec un panier vide.
- Choisir **une** implémentation de panier (`CartContext` ou l'état local d'`App`) et supprimer l'autre ; tester celle qui reste.

### Priorité 4 — Logique métier de diagnostic

- `calculateDistance` (Haversine) : distances connues (par exemple Cotonou → Porto-Novo), distance nulle sur un point identique, antipodes, et surtout **coordonnées `undefined` / `NaN`** qui doivent produire `"Distance inconnue"` et non `"NaN km"`.
- `getRecommendedProducts` : correspondance ravageur → pesticide, correspondance carence → engrais pour chacun des tags `SOIL_N` / `SOIL_P` / `SOIL_K` / `SOIL_NPK`, cas `Équilibré` (ne doit rien recommander), cas `Aucun détecté` (ne doit rien recommander — cassé aujourd'hui), et `target_pests` absent.
  Attention, la correspondance carence repose sur `npk.includes('N')` : elle ne fonctionne aujourd'hui que par chance, parce que `"Déficient en P"` ne contient pas de `N` **majuscule**. Toute traduction ou reformulation du libellé casse la recommandation sans erreur visible. Un test fige ce comportement.
- `analyzeSoilWithSpectral` : les seuils (`organic`, `npkStatus`) sont testables en injectant le générateur aléatoire ; à défaut, tester la fonction de seuil extraite.
- La dérivation du `status` (`Élevé` → `danger`, `Moyen` → `warning`, sinon `good`, `App.tsx:904`).

### Priorité 5 — Rendu et parcours utilisateur

- `BottomNavigation` : appels de `setActiveTab` par onglet, ouverture du panier via `openCart`, affichage du badge uniquement si `cartCount > 0`, mise en surbrillance de l'onglet actif.
- Filtrage de la base de connaissances (`App.tsx:993`) : recherche insensible à la casse sur titre et description, filtre par catégorie, combinaison des deux, résultat vide.
- Bascule de langue `fr` / `en` et thème de couleur (`App.tsx:98-108`).
- `handleImageUpload` : ajout cumulatif d'images, sélection vide.
- Parcours de bout en bout : capture → analyse → résultats → ajout au panier → commande.

### Priorité 6 — Chargement du modèle CNN et géolocalisation

Zones à forte dépendance d'environnement ; à couvrir par des doublures.

- `loadCnnModel` : échec de `tf.loadGraphModel` (aujourd'hui simplement loggé, l'analyse continue ensuite avec `cnnModelRef.current === null` et `prediction === null`).
- Ordonnanceur de mise à jour à 6h00 (`App.tsx:588-600`) : calcul du délai avant et après 6h, passage de minuit, changement de mois — testable avec les faux temporisateurs de Vitest.
- Géolocalisation : permission refusée, échec de l'API OpenCage, `components.city` absent (repli sur `town` puis `village`).

## 3. Mise en place recommandée

Pile cohérente avec Vite, sans changement d'outillage :

```bash
npm i -D vitest @vitest/coverage-v8 jsdom \
         @testing-library/react @testing-library/jest-dom @testing-library/user-event msw
```

```jsonc
// package.json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "coverage": "vitest run --coverage"
}
```

`msw` permet d'intercepter les appels Google Sheets et OpenCage au niveau réseau, sans avoir à réécrire le code pour injecter un `fetch`.

### Prérequis : rendre le code testable

Aucune de ces suites n'est écrivable tant que la logique reste enfermée dans le composant. Étape préalable, sans changement de comportement :

```
src/
├─ utils/
│  ├─ distance.ts        # calculateDistance
│  ├─ sheets.ts          # fetchSheetList, fetchSheetData, normalisation
│  ├─ recommendations.ts # getRecommendedProducts
│  ├─ cart.ts            # totaux, ajout, mise à jour
│  └─ schedule.ts        # calcul du prochain déclenchement à 6h00
```

Ce découpage recoupe celui déjà proposé dans [`docs/REDESIGN.md`](REDESIGN.md) : la testabilité et la refonte sont le même chantier.

### Cibles de couverture

Viser un taux global sur un fichier de 1 769 lignes majoritairement composé de JSX et de données statiques n'a pas de sens. Cibles par zone :

| Zone | Cible |
| --- | --- |
| `utils/` (logique pure extraite) | 90 % lignes / 85 % branches |
| Parsing Sheets + panier | 90 % branches |
| Composants d'interface | Parcours critiques couverts, pas de seuil chiffré |
| Global | Interdire toute baisse (`--coverage.thresholds.autoUpdate`) |

## 4. Ordre d'exécution proposé

1. **Immédiat** — ajouter `typecheck` en CI et bloquer le déploiement dessus. Corrige la cause racine du bug n°1.
2. **Semaine 1** — installer Vitest ; extraire `calculateDistance`, `cart.ts` et `recommendations.ts` dans `utils/` ; écrire les tests de priorité 3 et 4. Environ 40 tests, sans dépendance réseau.
3. **Semaine 2** — extraire `sheets.ts` ; ajouter les fixtures gviz et les tests MSW (priorité 2), y compris le cas de l'API v3 arrêtée.
4. **Semaine 3** — Testing Library sur `BottomNavigation`, le filtrage de la base de connaissances et le parcours panier → commande (priorité 5).
5. **Ensuite** — dédupliquer le panier, brancher ou supprimer `getRecommendedProducts`, et introduire un seuil de couverture anti-régression.
