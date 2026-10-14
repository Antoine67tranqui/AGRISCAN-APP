# Mise en ligne de l'application « Ma Poissonnerie »

L'application tourne sur Google Apps Script : elle est hébergée gratuitement par Google, accessible par un lien web (ordinateur et téléphone), et ses données sont écrites directement dans votre Google Sheet.

**Classeur déjà créé dans votre Drive** : « Poissonnerie - Gestion de la boutique »
https://docs.google.com/spreadsheets/d/1pyZTzs2aCzv4LkVHCGS3xTABj1fuLWiPjR0QG7LU_co/edit

Il contient 9 feuilles : `LISEZ-MOI`, `Produits` (256 produits), `Achats`, `Ventes`, `Depenses`, `Pertes`, et trois feuilles calculées automatiquement (`Stock`, `Journalier`, `Mensuel`).

## Étape unique à faire (environ 5 minutes)

Google n'autorise pas la publication d'une application web sans votre propre validation : cette étape doit être faite avec votre compte.

1. Ouvrez le classeur (lien ci-dessus), puis le menu **Extensions > Apps Script**.
2. Dans l'éditeur, supprimez le contenu du fichier `Code.gs` existant, puis créez les fichiers suivants (bouton **+** à côté de « Fichiers ») en collant le contenu des fichiers du dossier `boutique-poisson/apps-script/` :

   | Fichier à créer dans Apps Script | Type | Contenu à coller |
   |---|---|---|
   | `Code` | Script | `Code.gs` |
   | `Core` | Script | `Core.gs` |
   | `Catalog` | Script | `Catalog.gs` |
   | `Index` | HTML | `Index.html` |

3. Dans **Paramètres du projet** (roue dentée), cochez **Afficher le fichier manifeste « appsscript.json » dans l'éditeur**, ouvrez-le et remplacez son contenu par celui de `appsscript.json`.
4. Cliquez sur **Déployer > Nouveau déploiement**, type **Application Web** :
   - *Exécuter en tant que* : **Moi**
   - *Qui a accès* : **Moi uniquement** (recommandé : vos chiffres restent privés)
5. Cliquez sur **Déployer** et **autorisez** l'accès à votre Google Sheet. Google affiche « Application non vérifiée » car c'est votre propre script : choisissez **Paramètres avancés > Accéder au projet (non sécurisé)**.
6. Copiez l'URL de l'application web (elle se termine par `/exec`). C'est le lien à ouvrir sur ordinateur et téléphone.

### Sur le téléphone
Ouvrez le lien dans Chrome (Android) ou Safari (iPhone), connectez-vous avec le même compte Google, puis **Ajouter à l'écran d'accueil** pour l'utiliser comme une application.

### Alternative en ligne de commande (facultatif)
Avec [clasp](https://github.com/google/clasp) : `npm i -g @google/clasp`, `clasp login`, puis dans `boutique-poisson/apps-script/` créez un fichier `.clasp.json` contenant `{"scriptId":"<ID du script>","rootDir":"."}` et lancez `clasp push`.

## Gérer le stock : démarrer, suivre, racheter

**1. Inventaire de départ (une seule fois, indispensable).** Stock > Inventaire : comptez ce que vous avez en boutique et saisissez-le (cartons + unités en vrac pour les produits en cartons). Le premier comptage devient du **stock initial**, valorisé au prix d'achat de référence (ou au prix saisi). Datez-le du jour où vous commencez à suivre les ventes dans l'application : des ventes saisies avec une date antérieure au stock initial produiraient un stock négatif dans l'historique. Le stock initial n'est **pas** une dépense : il n'entre pas dans les achats de la période.

**2. Au quotidien.** Chaque vente retire du stock, chaque achat (bon d'achat ou achat simple) en ajoute. Après un achat, un récapitulatif montre le **cumul** : stock avant, entrée, stock maintenant, couverture en jours de vente. Le panier de vente signale un stock insuffisant avant l'enregistrement.

**3. Savoir ce qui reste.** Stock > Disponible : quantité en stock (avec l'équivalent en cartons), vente par jour, couverture en jours, état (OK, À racheter, Urgent, Rupture, Négatif). Le bouton **Fiche** montre, pour un produit, tous les mouvements avec le solde après chacun et la courbe du niveau de stock dans le temps.

**4. Savoir quoi acheter.** Stock > À acheter : liste des produits à racheter, du plus urgent au moins urgent, avec la quantité proposée (arrondie au carton ou au sac), le coût estimé et le dernier fournisseur. Vous pouvez modifier les quantités, copier la liste, l'envoyer par WhatsApp ou **préparer un bon d'achat** prérempli.

Comment la prévision est calculée :
- *Vente par jour* = quantités vendues sur la période (30 jours par défaut) divisées par le nombre de jours observés depuis la première vente et la première entrée du produit.
- *Seuil d'alerte* = le seuil saisi sur la fiche produit, sinon vente par jour × délai d'alerte (3 jours par défaut).
- *Stock cible* = le stock cible saisi sur la fiche produit, sinon vente par jour × jours à couvrir (7 par défaut), et au moins 2 × le seuil.
- *Urgent* = rupture, stock négatif ou moins d'un jour de vente ; *Bientôt* = sous le seuil d'alerte.
- Quantité proposée = stock cible − stock actuel, arrondie au carton ou au sac entier quand son contenu est renseigné.
Les réglages (jours à couvrir, délai d'alerte, période de calcul) se changent dans Stock > À acheter > Réglages et sont partagés entre vos appareils.

Limites à connaître : avec moins de deux semaines de ventes enregistrées, la prévision est peu fiable : renseignez un seuil d'alerte ou un stock cible sur vos produits clés. Elle ne tient pas compte des saisons, des fêtes, des délais de livraison ni des remises des fournisseurs. Les produits vendus en deux lignes (par exemple « carton » et « détail ») ont deux stocks séparés : préférez une seule ligne avec le contenu du carton.

**5. Contrôler.** Refaites un inventaire de temps en temps (Stock > Inventaire). Un comptage inférieur au stock calculé est enregistré comme **perte** (motif « Écart d'inventaire », valorisée au coût moyen, déduite du bénéfice net) ; un comptage supérieur devient un **surplus** (feuille Ajustements). Un comptage identique n'écrit rien.

## Mise à jour de l'application déjà déployée
Les modifications de code se déploient sans changer le lien :
1. Copiez la version à jour de `Code.gs`, `Core.gs` et `Index.html` dans l'éditeur Apps Script (remplacez tout le contenu de chaque fichier). `Catalog.gs` et `appsscript.json` ne changent pas.
2. **Déployer > Gérer les déploiements**, cliquez sur le **crayon**, **Version : Nouvelle version**, **Déployer**.
3. Rechargez l'application. La première ouverture ajoute automatiquement les feuilles ou colonnes manquantes du classeur.

## Mise à jour de l'application (rappel)
Après toute modification du code (recopier les fichiers modifiés dans l'éditeur, en particulier `Core.gs`, `Code.gs`, `Catalog.gs` et `Index.html`) : **Déployer > Gérer les déploiements > Modifier (crayon) > Version : Nouvelle version > Déployer**. L'URL ne change pas.

## Utilisation au quotidien
1. **Produits** : renseignez une fois le prix d'achat de référence et le prix de vente de vos articles (aucun prix n'est prérempli, car ils dépendent de vos fournisseurs et de votre marché).
2. **Achats** : deux onglets.
   - **Bon d'achat** (par défaut) : recopiez le reçu du grossiste ligne par ligne, comme il est écrit : produit, **quantité** (fractionnaire possible : 0,5 carton), **contenu d'un carton** (nombre d'unités ou kg, prérempli depuis la fiche produit) et **prix** (par carton, par unité ou total de la ligne). L'application calcule le coût unitaire, le montant de chaque ligne, le total du bon (à comparer au « net à payer » du reçu) et le **bénéfice prévu** au prix de vente actuel. Le bon s'enregistre en une fois, tout ou rien.
   - **Achat simple** : un seul article, avec les deux modes de saisie ci-dessous.
   - **Par sacs / cartons** (pour les produits au kilo ou en cartons d'unités : tilapia, sylvi petit / moyen / gros, cuisse normale, cuisse rapide, aile de poulet, pointe, saumon, hareng, etc.) : indiquez le **nombre de sacs** et le **poids d'un sac en kg**, puis le prix soit **au kilo**, soit **du sac**, soit le **total payé**. L'application calcule le poids total (ex : 10 sacs × 25 kg = 250 kg), le prix au kilo et le montant. Le stock est tenu en kg. Le poids du sac et le prix au kilo sont mémorisés sur la fiche produit et préremplis à l'achat suivant (le poids reste modifiable si le sac change).
   - **Au poids / à l'unité** : quantité et prix unitaire ou total payé.
   Le stock et le coût moyen se mettent à jour. La feuille `Achats` conserve le nombre de sacs et les kg par sac.
3. **Vendre** : touchez les produits vendus, ajustez quantité et prix si besoin, choisissez le paiement (espèces, Mobile Money, crédit), puis enregistrez.
   - **Vente au sac** : pour un produit au kilo, choisissez **Au sac** sur la ligne du panier, puis indiquez le nombre de sacs, le **poids du sac (kg)** et le **prix du sac**. L'application déduit du stock nombre de sacs × poids (ex : 2 sacs de 25 kg = 50 kg) et calcule le bénéfice avec le coût au kilo.
   - Pour un produit vendu à l'unité (tomate, spaghetti, lait en sachet...), le bouton devient **Au carton** et le contenu du carton est un nombre d'unités (ex : 0,5 carton de 48 boîtes = 24 boîtes). Le contenu n'est jamais supposé : vous le saisissez vous-même, produit par produit (fiche Produits, à l'achat ou directement à la vente). Il est mémorisé pour les opérations suivantes et reste modifiable. Sans poids de sac, la vente au sac est refusée.
4. **Accueil / Rapports** : chiffre d'affaires, bénéfice brut et bénéfice net du jour, de la semaine, du mois ou d'une période choisie.
5. **Dépenses** et **Stock > Perte** : électricité, glace, transport, poisson avarié, etc. Ils réduisent le bénéfice net.

## Méthode de calcul
- **Chiffre d'affaires** = somme des quantités vendues multipliées par le prix de vente.
- **Coût unitaire** = moyenne pondérée des achats du produit enregistrés jusqu'à la date de la vente (somme des montants / somme des quantités). Sans achat enregistré, le prix d'achat de référence de la fiche produit est utilisé. Ce coût est figé dans la ligne de vente.
- **Bénéfice brut** = chiffre d'affaires − coût des produits vendus.
- **Bénéfice net** = bénéfice brut − dépenses − valeur des pertes.
- **Stock** = achats − ventes − pertes (en kg pour les produits au kilo). L'équivalent en sacs affiché dans Stock est une estimation basée sur le dernier poids de sac utilisé.

Limites à connaître : le coût moyen est une moyenne sur tous les achats (pas un suivi par lot de type « premier entré, premier sorti »). Si vous vendez un produit sans avoir enregistré son achat, le stock devient négatif et l'application vous prévient. Les crédits clients sont suivis (liste des crédits non réglés dans Historique) mais il n'y a pas de gestion de comptes clients.

## Essayer sans rien installer
`boutique-poisson/demo/index.html` : même interface, avec des données stockées uniquement dans le navigateur (ajouter `?seed=1` à l'adresse pour charger des données d'exemple inventées, à effacer avec « Réinitialiser »). Ce mode ne touche pas votre Google Sheet.

## Tests
```
node boutique-poisson/tools/test-core.js          # logique métier
node boutique-poisson/tools/test-sheetstore.js    # couche Google Sheets (simulée)
node boutique-poisson/tools/build-demo.js         # régénère demo/index.html
```
