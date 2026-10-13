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
eq(T('store.all("Produits").length'), 256, 'catalogue amorcé');
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
eq(np.id, 'P0257', 'ID auto-incrémenté');
console.log(`OK : ${pass} vérifications réussies (Core.gs)`);
const neutre = T('stockTable_(store)').filter(s => s.id !== til && s.entrees === 0 && s.sorties === 0 && s.pertes === 0)[0];
assert.strictEqual(neutre.statut, 'neutre'); console.log('OK : produit sans mouvement = neutre');
