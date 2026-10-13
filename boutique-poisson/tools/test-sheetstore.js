// Vérifie SheetStore_ (Code.gs) avec un faux SpreadsheetApp en mémoire.
const assert = require('assert');
function FakeSheet(name) {
  this.name = name; this.rows = []; this.frozen = 0;
  const self = this;
  this.getLastRow = () => { let n = self.rows.length; while (n > 0 && self.rows[n-1].every(v => v === '' || v == null)) n--; return n; };
  this.getMaxRows = () => 1000;
  this.getMaxColumns = () => 40; this.insertColumnsAfter = () => {};
  this.setFrozenRows = () => {};
  this.getRange = (r, c, nr = 1, nc = 1) => {
    if (typeof r === 'string') { const rg = self.getRange(1, 1); rg.getNote = () => ''; rg.setNote = () => rg; return rg; }
    const rg = {
      getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (self.rows[r-1+i]||[])[c-1+j]; row.push(v === undefined ? '' : (typeof v === 'object' && v && v.f ? v.v : v)); } o.push(row); } return o; },
      setValues: (vals) => { vals.forEach((rv, i) => { self.rows[r-1+i] = self.rows[r-1+i] || []; rv.forEach((v, j) => { self.rows[r-1+i][c-1+j] = v; }); }); return rg; },
      setValue: (v) => { self.rows[r-1] = self.rows[r-1] || []; self.rows[r-1][c-1] = v; return rg; },
      setFormulas: () => rg, setNumberFormat: () => rg, setBackground: () => rg, setFontColor: () => rg, setFontWeight: () => rg, setWrap: () => rg, setVerticalAlignment: () => rg, setFontStyle: () => rg, setFormula: () => rg, getNote: () => '', setNote: () => rg
    };
    return rg;
  };
  this.deleteRow = (r) => { self.rows.splice(r-1, 1); };
  this.setConditionalFormatRules = () => {};
}
const sheets = {};
const ss = {
  getSheetByName: n => sheets[n] || null,
  insertSheet: n => (sheets[n] = new FakeSheet(n)),
  getSpreadsheetTimeZone: () => 'Africa/Lagos', setSpreadsheetTimeZone: () => {}
};
const rule = { whenTextEqualTo() { return this; }, setBackground() { return this; }, setRanges() { return this; }, build() { return {}; } };
const ctx = require('./load-gas')({
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, newConditionalFormatRule: () => Object.create(rule), getUi: () => ({}) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
  Session: { getScriptTimeZone: () => 'Africa/Lagos' },
  PropertiesService: {}, HtmlService: {}
});
const vm = require('vm'), run = c => vm.runInContext(c, ctx);
run('var created = setup();');
assert.strictEqual(run('JSON.stringify(created.sort())'), JSON.stringify(['Achats','Depenses','Journalier','Mensuel','Pertes','Produits','Stock','Ventes']), 'feuilles créées');
assert.strictEqual(sheets.Produits.getLastRow(), 262, 'produits amorcés (1 en-tête + 261)');
assert.strictEqual(sheets.Ventes.rows[0][9], 'Bénéfice brut (FCFA)', 'en-tête Ventes');
// Parcours complet via api()
const til = run('api("bootstrap").produits[0].id');
run(`api("saveProduct",{id:"${til}",nom:"Tilapia frais (Oreochromis niloticus)",categorie:"Poissons frais et élevage",unite:"kg",prixAchat:1000,prixVente:1500,seuil:10,actif:true})`);
run(`api("addPurchase",{date:"2026-10-01",produitId:"${til}",nbSacs:2,kgSac:25,pu:1000,fournisseur:"Ferme X"})`);
assert.strictEqual(sheets.Achats.rows[1][4], 50, 'qte = 2 sacs x 25 kg'); assert.strictEqual(sheets.Achats.rows[1][9], 2); assert.strictEqual(sheets.Achats.rows[1][10], 25);
assert.strictEqual(sheets.Produits.rows[1][8], 25, 'kg/sac mémorisé dans la feuille Produits');
const sale = run(`api("addSale",{date:"2026-10-02",paiement:"Espèces",lines:[{produitId:"${til}",qte:12.5,pu:1500}]})`);
assert.strictEqual(sale.total, 18750); assert.strictEqual(sale.marge, 6250);
// La ligne écrite contient bien les formules aux bonnes colonnes (F=qte, G=pu, I=cout)
const v = sheets.Ventes.rows[1];
assert.strictEqual(v[7], '=F2*G2', 'formule CA'); assert.strictEqual(v[9], '=F2*(G2-I2)', 'formule marge');
assert.strictEqual(sheets.Achats.rows[1][6], '=E2*F2', 'formule total achat');
// Le faux Sheet ne calcule pas les formules : on les évalue ici pour relire comme Sheets le ferait
sheets.Ventes.rows[1][7] = { f: 1, v: 18750 }; sheets.Ventes.rows[1][9] = { f: 1, v: 6250 };
sheets.Achats.rows[1][6] = { f: 1, v: 50000 };
const rep = run('api("report",{from:"2026-10-01",to:"2026-10-31"})');
assert.strictEqual(rep.totaux.ca, 18750); assert.strictEqual(rep.totaux.marge, 6250);
const stock = run(`api("stock").filter(function(s){return s.id==="${til}"})[0]`);
assert.strictEqual(stock.stock, 37.5);
// Mise à jour du prix de référence après achat + suppression
assert.strictEqual(sheets.Produits.rows[1][4], 1000);
run(`api("remove",{table:"Ventes",id:"${sale.id}-1"})`);
assert.strictEqual(sheets.Ventes.getLastRow(), 1, 'ligne supprimée');
assert.throws(() => run('api("remove",{table:"Ventes",id:"NOPE"})'), /introuvable/);
console.log('OK : SheetStore_ (lecture, écriture, formules, suppression, mise à jour)');
