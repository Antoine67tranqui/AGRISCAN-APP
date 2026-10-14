// Génère demo/index.html : même interface, données stockées dans le navigateur (localStorage).
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..', 'apps-script');
const read = f => fs.readFileSync(f, 'utf8');
const memory = read(path.join(__dirname, 'memory-store.js')).replace(/if \(typeof module[\s\S]*$/, '');
const shim = `
var KEY = 'poissonnerie-demo-v1', store;
function loadDb_() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
function demoSeed_(st) {
  // Données d'exemple INVENTÉES, uniquement pour essayer l'interface en mode démo.
  var P = { 'Tilapia frais (Oreochromis niloticus)': [1100, 1600, 15], 'Chinchard congelé (détail)': [900, 1300, 20], 'Silure / Clarias frais (Clarias gariepinus)': [1500, 2100, 10],
    'Poulet entier congelé': [2300, 3000, 10], 'Gésiers de poulet': [1800, 2400, 8], 'Riz local en kilo': [550, 700, 50], 'Huile végétale 1 L': [1100, 1400, 12],
    'Spaghetti (paquet)': [300, 400, 20], 'Tomate en boîte 400 g': [450, 600, 24], 'Mosquito spray (insecticide aérosol)': [900, 1200, 6], 'Glace (sachet)': [50, 100, 30], 'Bouquet normal (crevettes)': [3500, 4800, 5] };
  var ids = {};
  st.all('Produits').forEach(function (p) { if (P[p.nom]) { ids[p.nom] = p.id; st.update('Produits', p.id, { prixAchat: P[p.nom][0], prixVente: P[p.nom][1], seuil: P[p.nom][2] }); } });
  var t = new Date(); function d(n) { var x = new Date(t); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
  inventory_(st, { date: d(13), lines: Object.keys(ids).map(function (n) { return { produitId: ids[n], compte: 120 }; }) });
  Object.keys(ids).forEach(function (n) { addPurchase_(st, { date: d(6), produitId: ids[n], qte: 60, pu: P[n][0], fournisseur: 'Fournisseur B' }); });
  for (var i = 12; i >= 0; i--) {
    var lines = Object.keys(ids).filter(function (n, k) { return (i + k) % 3 !== 0; }).map(function (n, k) { return { produitId: ids[n], qte: 2 + ((i * 7 + k * 3) % 9), pu: P[n][1] }; });
    addSale_(st, { date: d(i), paiement: i % 5 === 0 ? 'Mobile Money' : 'Espèces', lines: lines });
  }
  addSale_(st, { date: d(1), paiement: 'Crédit', note: 'Client (démo)', lines: [{ produitId: ids['Poulet entier congelé'], qte: 3, pu: 3000 }] });
  addExpense_(st, { date: d(2), categorie: 'Glace', libelle: 'Glace (démo)', montant: 6000 });
  addExpense_(st, { date: d(0), categorie: 'Électricité', libelle: 'Électricité (démo)', montant: 15000 });
  addLoss_(st, { date: d(3), produitId: ids['Tilapia frais (Oreochromis niloticus)'], qte: 3, motif: 'Poisson avarié' });
}
(function () {
  var db = loadDb_(), fresh = !db;
  store = new MemoryStore_(db || { Produits: seedProducts_() }, function (d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} });
  if (fresh && /[?&]seed/.test(location.search)) demoSeed_(store);
})();
window.DEMO_API = function (action, args) {
  return new Promise(function (res, rej) {
    setTimeout(function () { try { res(JSON.parse(JSON.stringify(dispatch_(store, action, args)))); } catch (e) { rej(e); } }, 60);
  });
};
document.addEventListener('DOMContentLoaded', function () {
  var b = document.createElement('div'); b.className = 'banner'; b.style.cssText = 'margin:0;border-radius:0;text-align:center;position:sticky;top:0;z-index:80';
  b.innerHTML = 'MODE DÉMO : données stockées uniquement dans ce navigateur. <a href="#" id="rz" style="color:inherit">Réinitialiser</a>';
  document.body.prepend(b); document.getElementById('rz').onclick = function (e) { e.preventDefault(); if (confirm('Effacer les données de démo ?')) { localStorage.removeItem(KEY); location.href = location.pathname; } };
});
`;
const catalog = read(path.join(A, 'Catalog.gs')), core = read(path.join(A, 'Core.gs'));
let html = read(path.join(A, 'Index.html'));
html = html.replace('<script>', '<script>\n' + catalog + '\n' + core + '\n' + memory + '\n' + shim + '\n</script>\n<script>');
fs.mkdirSync(path.join(__dirname, '..', 'demo'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'demo', 'index.html'), html);
console.log('demo/index.html généré (' + Math.round(html.length / 1024) + ' Ko)');
