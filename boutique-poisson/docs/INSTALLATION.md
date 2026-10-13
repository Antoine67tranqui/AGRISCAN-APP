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

## Mise à jour de l'application
Après toute modification du code : **Déployer > Gérer les déploiements > Modifier (crayon) > Version : Nouvelle version > Déployer**. L'URL ne change pas.

## Utilisation au quotidien
1. **Produits** : renseignez une fois le prix d'achat de référence et le prix de vente de vos articles (aucun prix n'est prérempli, car ils dépendent de vos fournisseurs et de votre marché).
2. **Achats** : à chaque approvisionnement, saisissez produit, quantité, prix d'achat (unitaire ou total payé) et fournisseur. Le stock et le coût moyen se mettent à jour.
3. **Vendre** : touchez les produits vendus, ajustez quantité et prix si besoin, choisissez le paiement (espèces, Mobile Money, crédit), puis enregistrez.
4. **Accueil / Rapports** : chiffre d'affaires, bénéfice brut et bénéfice net du jour, de la semaine, du mois ou d'une période choisie.
5. **Dépenses** et **Stock > Perte** : électricité, glace, transport, poisson avarié, etc. Ils réduisent le bénéfice net.

## Méthode de calcul
- **Chiffre d'affaires** = somme des quantités vendues multipliées par le prix de vente.
- **Coût unitaire** = moyenne pondérée des achats du produit enregistrés jusqu'à la date de la vente (somme des montants / somme des quantités). Sans achat enregistré, le prix d'achat de référence de la fiche produit est utilisé. Ce coût est figé dans la ligne de vente.
- **Bénéfice brut** = chiffre d'affaires − coût des produits vendus.
- **Bénéfice net** = bénéfice brut − dépenses − valeur des pertes.
- **Stock** = achats − ventes − pertes.

Limites à connaître : le coût moyen est une moyenne sur tous les achats (pas un suivi par lot de type « premier entré, premier sorti »). Si vous vendez un produit sans avoir enregistré son achat, le stock devient négatif et l'application vous prévient. Les crédits clients sont suivis (liste des crédits non réglés dans Historique) mais il n'y a pas de gestion de comptes clients.

## Essayer sans rien installer
`boutique-poisson/demo/index.html` : même interface, avec des données stockées uniquement dans le navigateur (ajouter `?seed=1` à l'adresse pour charger des données d'exemple inventées, à effacer avec « Réinitialiser »). Ce mode ne touche pas votre Google Sheet.

## Tests
```
node boutique-poisson/tools/test-core.js          # logique métier
node boutique-poisson/tools/test-sheetstore.js    # couche Google Sheets (simulée)
node boutique-poisson/tools/build-demo.js         # régénère demo/index.html
```
