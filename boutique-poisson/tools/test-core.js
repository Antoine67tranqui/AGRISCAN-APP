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
