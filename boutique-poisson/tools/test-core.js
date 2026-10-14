const assert = require('assert');
const ctx = require('./load-gas')();
const run = (code) => require('vm').runInContext(code, ctx);
ctx.__t = {};
run(`
var store = new MemoryStore_({ Produits: seedProducts_() });
function id(name){ return store.all('Produits').filter(function(p){return p.nom.indexOf(name)===0})[0].id; }
`);
const T = (c) => run(c);
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m + ` (obtenu ${a}, attendu ${b})`); pass++; };

// Catalogue
eq(T('store.all("Produits").length'), 311, 'catalogue amorcé');
const til = T('id("Tilapia frais (Oreochromis")');
T(`saveProduct_(store, {id:"${til}", nom:"Tilapia frais (Oreochromis niloticus)", categorie:"Poissons frais et élevage", unite:"kg", prixAchat:1000, prixVente:1500, seuil:20, actif:true})`);
// Achats : 100 @1000 puis 100 @1200 => coût moyen 1100
T(`addPurchase_(store,{date:"2026-10-01",produitId:"${til}",qte:100,pu:1000})`);
T(`addPurchase_(store,{date:"2026-10-05",produitId:"${til}",qte:100,pu:1200})`);
// Vente le 02/10 : seul le 1er achat compte -> coût 1000
let r = T(`addSale_(store,{date:"2026-10-02",paiement:"Espèces",lines:[{produitId:"${til}",qte:10,pu:1500}]})`);
eq(r.total, 15000, 'CA vente 1'); eq(r.marge, 5000, 'marge vente 1 (coût 1000)');
// Vente le 06/10 : coût moyen 1100
r = T(`addSale_(store,{date:"2026-10-06",paiement:"Crédit",note:"Mme A",lines:[{produitId:"${til}",qte:30,pu:1500}]})`);
eq(r.total, 45000, 'CA vente 2'); eq(r.marge, 12000, 'marge vente 2 (coût 1100)');
// Stock = 200 - 40 = 160
let st = T('stockTable_(store)').filter(s => s.id === til)[0];
eq(st.stock, 160, 'stock après ventes'); eq(st.coutMoyen, 1100, 'coût moyen'); eq(st.valeur, 176000, 'valeur stock'); eq(st.statut, 'ok', 'statut ok');
// Perte 5 kg => valeur 5500
T(`addLoss_(store,{date:"2026-10-06",produitId:"${til}",qte:5,motif:"Poisson avarié"})`);
eq(T('stockTable_(store)').filter(s => s.id === til)[0].stock, 155, 'stock après perte');
// Dépense
T('addExpense_(store,{date:"2026-10-06",categorie:"Glace",libelle:"Glace",montant:2000})');
// Rapport 06/10
let rep = T('report_(store,"2026-10-06","2026-10-06")');
eq(rep.totaux.ca, 45000, 'CA jour'); eq(rep.totaux.marge, 12000, 'marge jour'); eq(rep.totaux.depenses, 2000, 'dépenses');
eq(rep.totaux.pertes, 5500, 'pertes'); eq(rep.totaux.net, 12000 - 2000 - 5500, 'net'); eq(rep.totaux.credit, 45000, 'crédit');
rep = T('report_(store,"2026-10-01","2026-10-31")');
eq(rep.totaux.ca, 60000, 'CA période'); eq(rep.jours.length, 2, 'jours avec activité'); eq(rep.totaux.tickets, 2, 'tickets');
eq(rep.produits[0].qte, 40, 'qté produit');
// Stock insuffisant => avertissement, vente autorisée
r = T(`addSale_(store,{date:"2026-10-07",lines:[{produitId:"${til}",qte:500,pu:1500}]})`);
ok(r.warnings.length === 1, 'avertissement stock');
// Suppression d'une ligne de vente => stock restitué
const lineId = T('store.all("Ventes")').filter(v => v.qte === 500)[0].id;
T(`removeRecord_(store,"Ventes","${lineId}")`);
eq(T('stockTable_(store)').filter(s => s.id === til)[0].stock, 155, 'stock restitué après suppression');
// Crédit réglé
const cid = T('store.all("Ventes")').filter(v => v.paiement === 'Crédit')[0].id;
T(`settleCredit_(store,"${cid}")`);
eq(T('report_(store,"2026-10-01","2026-10-31")').totaux.credit, 0, 'crédit réglé');
// Vente sans achat : coût = prix d'achat de référence
const riz = T('id("Riz local")');
T(`saveProduct_(store,{id:"${riz}",nom:"Riz local en kilo",categorie:"Céréales, féculents et farines",unite:"kg",prixAchat:600,prixVente:800,seuil:0,actif:true})`);
r = T(`addSale_(store,{date:"2026-10-08",lines:[{produitId:"${riz}",qte:10,pu:800}]})`);
eq(r.marge, 2000, 'marge avec coût de référence');
// Validations
assert.throws(() => T('addSale_(store,{date:"2026-13-40",lines:[{produitId:"P0001",qte:1,pu:1}]})'), /Date invalide/); pass++;
assert.throws(() => T('addSale_(store,{date:"2026-10-08",lines:[]})'), /panier/); pass++;
assert.throws(() => T('addSale_(store,{date:"2026-10-08",lines:[{produitId:"ZZZ",qte:1,pu:1}]})'), /introuvable/); pass++;
assert.throws(() => T('removeRecord_(store,"Produits","P0001")'), /non autorisée/); pass++;
assert.throws(() => T('addExpense_(store,{date:"2026-10-08",montant:0})'), /Montant/); pass++;
// Tableau de bord
const dash = T('dashboard_(store,"2026-10-08")');
eq(dash.jour.totaux.ca, 8000, 'dashboard CA du jour'); ok(dash.valeurStock > 0, 'valeur stock');
// Nouveau produit
const np = T('saveProduct_(store,{nom:"Poisson test",categorie:"Test",unite:"kg",prixAchat:1,prixVente:2})');
eq(np.id, 'P0312', 'ID auto-incrémenté');
console.log(`OK : ${pass} vérifications réussies (Core.gs)`);
const neutre = T('stockTable_(store)').filter(s => s.id !== til && s.entrees === 0 && s.sorties === 0 && s.pertes === 0)[0];
assert.strictEqual(neutre.statut, 'neutre'); console.log('OK : produit sans mouvement = neutre');

// Achat par sacs : 10 sacs de 25 kg à 1 100 FCFA/kg => 250 kg, 275 000 FCFA
const sy = T('id("Poisson sylvi moyen")');
let a = T(`addPurchase_(store,{date:"2026-10-09",produitId:"${sy}",nbSacs:10,kgSac:25,pu:1100})`);
eq(a.qte, 250, 'kg = sacs x kg/sac'); eq(a.total, 275000, 'total achat par kg'); eq(a.nbSacs, 10, 'nb sacs conservé'); eq(a.kgSac, 25, 'kg/sac conservé');
let prod = T(`listProducts_(store).filter(function(p){return p.id==="${sy}"})[0]`);
eq(prod.kgSac, 25, 'poids du sac mémorisé sur la fiche'); eq(prod.prixAchat, 1100, 'prix au kg mémorisé');
let sst = T(`stockTable_(store).filter(function(p){return p.id==="${sy}"})[0]`);
eq(sst.stock, 250, 'stock en kg'); eq(sst.sacs, 10, 'équivalent sacs');
// Prix du sac : 5 sacs de 20 kg à 30 000 FCFA le sac => 1 500 FCFA/kg
a = T(`addPurchase_(store,{date:"2026-10-09",produitId:"${sy}",nbSacs:5,kgSac:20,prixSac:30000})`);
eq(a.pu, 1500, 'prix au kg déduit du prix du sac'); eq(a.qte, 100, 'qte 5x20'); eq(a.total, 150000, 'total prix du sac');
// Montant total payé : 3 sacs de 25 kg pour 83 000 FCFA
a = T(`addPurchase_(store,{date:"2026-10-09",produitId:"${sy}",nbSacs:3,kgSac:25,montant:83000})`);
eq(a.qte, 75, 'qte 3x25'); eq(Math.round(a.pu * a.qte), 83000, 'total payé conservé');
// Coût moyen pondéré : (275000+150000+83000)/(250+100+75)
sst = T(`stockTable_(store).filter(function(p){return p.id==="${sy}"})[0]`);
eq(sst.coutMoyen, Math.round((508000/425)*100)/100, 'coût moyen pondéré');
assert.throws(() => T(`addPurchase_(store,{date:"2026-10-09",produitId:"${sy}",nbSacs:2,pu:1000})`), /contenu/); pass++;
assert.throws(() => T(`addPurchase_(store,{date:"2026-10-09",produitId:"${sy}",nbSacs:2,kgSac:25})`), /prix/); pass++;
// Saisie au poids inchangée
a = T(`addPurchase_(store,{date:"2026-10-09",produitId:"${sy}",qte:12.5,pu:1000})`);
eq(a.qte, 12.5, 'saisie au poids'); eq(a.nbSacs, '', 'pas de sacs');
console.log('OK : achats par sacs / cartons');
// Vente au sac : 2 sacs de 25 kg à 30 000 FCFA le sac (prix au kg 1 200) sur le sylvi moyen (coût moyen ~1 196,97)
const st0 = T(`stockTable_(store).filter(function(p){return p.id==="${sy}"})[0]`);
r = T(`addSale_(store,{date:"2026-10-10",lines:[{produitId:"${sy}",nbSacs:2,kgSac:25,prixSac:30000}]})`);
eq(r.total, 60000, 'CA vente au sac');
const vl = T('store.all("Ventes")').filter(v => v.produitId === sy)[0];
eq(vl.qte, 50, 'qte vendue = 2 x 25 kg'); eq(vl.pu, 1200, 'prix au kg déduit'); eq(vl.nbSacs, 2, 'sacs vendus'); eq(vl.kgSac, 25, 'kg/sac vendu');
const st1 = T(`stockTable_(store).filter(function(p){return p.id==="${sy}"})[0]`);
eq(Math.round((st0.stock - st1.stock) * 1000) / 1000, 50, 'stock diminue de 50 kg');
eq(T(`listProducts_(store).filter(function(p){return p.id==="${sy}"})[0]`).kgSac, 25, 'poids du sac mémorisé');
// Poids de sac saisi à la vente sur un produit sans poids : mémorisé
const ai = T('id("Cuisse de poulet rapide")');
T(`addPurchase_(store,{date:"2026-10-09",produitId:"${ai}",qte:100,pu:1500})`);
T(`addSale_(store,{date:"2026-10-10",lines:[{produitId:"${ai}",nbSacs:1,kgSac:10,prixSac:20000}]})`);
eq(T(`listProducts_(store).filter(function(p){return p.id==="${ai}"})[0]`).kgSac, 10, 'poids saisi à la vente mémorisé');
assert.throws(() => T(`addSale_(store,{date:"2026-10-10",lines:[{produitId:"${T('id("Pointe")')}",nbSacs:1,prixSac:20000}]})`), /contenu/); pass++;
console.log('OK : vente au sac');

// Bon d'achat multi-lignes, comme un reçu de grossiste (quantité en cartons fractionnaires, prix du carton)
const tg = T('id("Tomate en boîte 210")'), sp = T('id("Spaghetti (paquet)")');
let b = T(`addPurchases_(store,{date:"2026-10-11",fournisseur:"Grossiste",lines:[
  {produitId:"${tg}",nbSacs:0.5,kgSac:48,prixSac:8900},
  {produitId:"${sp}",nbSacs:1,kgSac:20,prixSac:6400},
  {produitId:"${sy}",nbSacs:2,kgSac:25,montant:60000}]})`);
eq(b.lignes, 3, 'bon : 3 lignes'); eq(b.total, 4450 + 6400 + 60000, 'bon : total = 0,5x8900 + 6400 + 60000');
let tgs = T(`stockTable_(store).filter(function(p){return p.id==="${tg}"})[0]`);
eq(tgs.stock, 24, '0,5 carton de 48 = 24 unités'); eq(tgs.coutMoyen, Math.round(8900 / 48 * 100) / 100, 'coût unitaire = prix carton / contenu');
// Tout ou rien : une ligne invalide annule le bon
const nAchats = T('store.all("Achats").length');
assert.throws(() => T(`addPurchases_(store,{date:"2026-10-11",lines:[{produitId:"${tg}",nbSacs:1,kgSac:48,prixSac:8900},{produitId:"${sp}",nbSacs:1,prixSac:6400}]})`), /Ligne 2.*contenu/); pass++;
eq(T('store.all("Achats").length'), nAchats, 'bon invalide : rien enregistré');
assert.throws(() => T('addPurchases_(store,{date:"2026-10-11",lines:[]})'), /vide/); pass++;
// Vente d'un carton d'un produit à l'unité : 1 carton de 48 boîtes à 12 500
r = T(`addSale_(store,{date:"2026-10-12",lines:[{produitId:"${tg}",nbSacs:0.5,kgSac:48,prixSac:12500}]})`);
eq(r.total, 6250, 'vente d\'un demi-carton'); 
console.log('OK : bon d\'achat multi-lignes et cartons en unités');

/* ===== Inventaire, stock initial, prévisions d'achat, fiche de stock ===== */
run(`var s2 = new MemoryStore_({ Produits: seedProducts_() });
function id2(n){ return s2.all('Produits').filter(function(p){return p.nom.indexOf(n)===0})[0].id; }`);
const T2 = (c) => run(c);
const X = T2('id2("Tomate Royale 210")');                 // boîte, 48 par carton, coût réf 185,42, vente 250
// 1) Stock initial : 100 boîtes comptées, valorisées au prix d'achat de référence
let inv = T2(`inventory_(s2,{date:"2026-10-01",lines:[{produitId:"${X}",compte:100},{produitId:"${T2('id2("Spaghetti Doga")')}",compte:""}]})`);
eq(inv.ajouts, 1, 'inventaire : 1 ajout'); eq(inv.pertes, 0, 'inventaire : aucune perte');
let aj = T2('s2.all("Ajustements")')[0];
eq(aj.motif, 'Stock initial', 'motif stock initial'); eq(aj.qte, 100, 'qte stock initial'); eq(aj.cout, 185.42, 'valorisé au prix de référence');
let row = T2(`stockTable_(s2,"2026-10-01").filter(function(p){return p.id==="${X}"})[0]`);
eq(row.stock, 100, 'stock = stock initial'); eq(row.ajouts, 100, 'ajouts'); eq(row.coutMoyen, 185.42, 'coût moyen = coût du stock initial');
// 2) Le stock initial n'est pas une dépense : aucun achat dans le rapport
eq(T2('report_(s2,"2026-10-01","2026-10-31")').totaux.achats, 0, 'stock initial hors achats');
// 3) Coût moyen pondéré : stock initial (100 à 185,42) + achat (100 à 200)
T2(`addPurchase_(s2,{date:"2026-10-02",produitId:"${X}",qte:100,pu:200})`);
eq(T2(`stockTable_(s2,"2026-10-02").filter(function(p){return p.id==="${X}"})[0]`).coutMoyen, 192.71, 'coût moyen pondéré avec stock initial');
// 4) Ventes régulières : 10 / jour du 03 au 07/10
for (let d = 3; d <= 7; d++) T2(`addSale_(s2,{date:"2026-10-0${d}",lines:[{produitId:"${X}",qte:10,pu:250}]})`);
row = T2(`stockTable_(s2,"2026-10-07").filter(function(p){return p.id==="${X}"})[0]`);
eq(row.stock, 150, 'stock après 5 jours de ventes'); eq(row.venteJour, 10, 'vitesse de vente = 10 / jour'); eq(row.couverture, 15, 'couverture = 15 jours');
eq(row.reappro.niveau, 'ok', '15 jours de stock : rien à acheter'); eq(row.statut, 'ok', 'statut ok');
// 5) Le stock baisse : 8 jours de ventes de plus à 20 / jour => bientôt, puis urgent
for (let d = 8; d <= 13; d++) T2(`addSale_(s2,{date:"2026-10-${d < 10 ? '0' + d : d}",lines:[{produitId:"${X}",qte:20,pu:250}]})`);
row = T2(`stockTable_(s2,"2026-10-13").filter(function(p){return p.id==="${X}"})[0]`);
eq(row.stock, 30, 'stock 150 - 6 x 20'); ok(row.venteJour > 10 && row.venteJour < 20, 'vitesse de vente recalculée');
ok(row.reappro.niveau === 'urgent' || row.reappro.niveau === 'bientot', 'à racheter');
const rl = T2('reorderList_(s2,"2026-10-13")');
ok(rl.items.length >= 1 && rl.items[0].id === X, 'le produit figure dans la liste à acheter');
const it = rl.items[0].reappro;
eq(it.cartons, Math.ceil(it.aAcheter / 48), 'quantité arrondie au carton'); eq(it.qteArrondie, it.cartons * 48, 'qte arrondie = cartons x contenu');
eq(it.coutEstime, Math.round(it.qteArrondie * it.coutUnitaire), 'coût estimé');
ok(it.qteArrondie >= it.aAcheter, 'on ne sous-achète pas');
eq(rl.joursObserves, 11, 'jours observés depuis la première vente');
// 6) Fiche de stock : solde cumulé cohérent avec le stock calculé
const card = T2(`stockCard_(s2,"${X}")`);
eq(card.solde, 30, 'solde final de la fiche = stock'); eq(card.entrees, 200, 'entrées cumulées (stock initial + achat)'); eq(card.sorties, 170, 'sorties cumulées');
eq(card.mouvements[0].type, 'Stock initial', '1er mouvement = stock initial'); eq(card.mouvements[0].solde, 100, 'solde après stock initial');
eq(card.mouvements[1].solde, 200, 'solde après achat (cumul avec l\'existant)');
ok(card.mouvements.every((m, i, a) => i === 0 || m.date >= a[i - 1].date), 'mouvements triés par date');
// 7) Inventaire de contrôle : 25 comptés pour 30 attendus => perte de 5 valorisée au coût moyen
inv = T2(`inventory_(s2,{date:"2026-10-13",lines:[{produitId:"${X}",compte:25}]})`);
eq(inv.pertes, 1, 'écart négatif = perte'); eq(inv.valeurPerdue, Math.round(5 * 192.71), 'valeur de la perte');
eq(T2(`stockTable_(s2,"2026-10-13").filter(function(p){return p.id==="${X}"})[0]`).stock, 25, 'stock recalé sur le comptage');
eq(T2('s2.all("Pertes")')[0].motif, 'Écart d\'inventaire', 'motif écart d\'inventaire');
// 8) Comptage identique : rien n'est écrit ; surplus : ajustement valorisé au coût saisi
inv = T2(`inventory_(s2,{date:"2026-10-13",lines:[{produitId:"${X}",compte:25}]})`); eq(inv.inchanges, 1, 'comptage identique ignoré');
inv = T2(`inventory_(s2,{date:"2026-10-14",lines:[{produitId:"${X}",compte:30,cout:190}]})`);
eq(T2('s2.all("Ajustements")').slice(-1)[0].motif, 'Inventaire (surplus)', 'surplus après mouvements');
// 9) Stock négatif : vente sans stock enregistré => statut négatif, signalé, corrigé par l'inventaire
const Y = T2('id2("Spaghetti Doga")');
T2(`addSale_(s2,{date:"2026-10-14",lines:[{produitId:"${Y}",qte:4,pu:375}]})`);
row = T2(`stockTable_(s2,"2026-10-14").filter(function(p){return p.id==="${Y}"})[0]`);
eq(row.statut, 'negatif', 'stock négatif signalé'); eq(row.reappro.verifier, true, 'à vérifier par inventaire');
T2(`inventory_(s2,{date:"2026-10-14",lines:[{produitId:"${Y}",compte:12}]})`);
eq(T2(`stockTable_(s2,"2026-10-14").filter(function(p){return p.id==="${Y}"})[0]`).stock, 12, 'inventaire corrige le stock négatif');
eq(T2('dashboard_(s2,"2026-10-14")').negatifs, 0, 'plus de produit en stock négatif');
// 10) Seuil explicite et stock cible explicite
const Z = T2('id2("Couscous Ginny")');
T2(`inventory_(s2,{date:"2026-10-14",lines:[{produitId:"${Z}",compte:8}]})`);
T2(`saveProduct_(s2,{id:"${Z}",nom:"Couscous Ginny 500 g",categorie:"Pâtes et couscous",unite:"paquet",prixAchat:450,prixVente:500,seuil:10,cible:60,kgSac:20,actif:true})`);
row = T2(`stockTable_(s2,"2026-10-14").filter(function(p){return p.id==="${Z}"})[0]`);
eq(row.reappro.niveau, 'bientot', 'sous le seuil saisi'); eq(row.reappro.cible, 60, 'stock cible saisi'); eq(row.reappro.cartons, 3, '(60 - 8) / 20 => 3 cartons'); eq(row.reappro.qteArrondie, 60, '3 cartons de 20');
// 11) Réglages partagés
eq(T2('getSettings_(s2).joursCible'), 7, 'réglage par défaut');
T2('saveSettings_(s2,{joursCible:14,delai:5})'); eq(T2('getSettings_(s2).joursCible'), 14, 'réglage enregistré'); eq(T2('getSettings_(s2).fenetre'), 30, 'fenêtre inchangée');
assert.throws(() => T2('saveSettings_(s2,{joursCible:0})'), /Jours/); pass++;
// 12) Suppression d'un ajustement : le stock suit
const ajId = T2('s2.all("Ajustements")').filter(a => a.produitId === '' + X + '' && a.motif === 'Inventaire (surplus)')[0].id;
T2(`removeRecord_(s2,"Ajustements","${ajId}")`);
eq(T2(`stockTable_(s2,"2026-10-14").filter(function(p){return p.id==="${X}"})[0]`).stock, 25, 'suppression du surplus');
assert.throws(() => T2(`inventory_(s2,{date:"2026-10-14",lines:[{produitId:"${X}",compte:-1}]})`), /négative/); pass++;
console.log("OK : inventaire, stock initial, prévisions d'achat, fiche de stock");
