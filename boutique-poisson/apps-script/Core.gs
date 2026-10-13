/**
 * Cœur métier de la boutique (aucune dépendance à Google : testable sous Node).
 * Les données arrivent via un « store » exposant :
 *   all(table) -> [objets]   append(table, obj)   remove(table, id)
 *   update(table, id, patch) lock(fn)
 *
 * Méthode de coût : coût unitaire = moyenne pondérée des achats du produit
 * enregistrés jusqu'à la date de la vente (somme des montants / somme des
 * quantités). À défaut d'achat, on utilise le prix d'achat de référence de la
 * fiche produit. Ce coût est figé dans la ligne de vente (la marge d'une
 * vente passée ne change donc plus).
 */

var SCHEMA = {
  Produits: [
    { key: 'id', label: 'ID' }, { key: 'categorie', label: 'Catégorie' },
    { key: 'nom', label: 'Produit' }, { key: 'unite', label: 'Unité' },
    { key: 'prixAchat', label: "Prix d'achat de référence (FCFA)" },
    { key: 'prixVente', label: 'Prix de vente (FCFA)' },
    { key: 'seuil', label: "Seuil d'alerte stock" }, { key: 'actif', label: 'Actif (OUI/NON)' },
    { key: 'kgSac', label: "Poids habituel d'un sac / carton (kg)" }
  ],
  Achats: [
    { key: 'id', label: 'ID' }, { key: 'date', label: 'Date', text: true },
    { key: 'produitId', label: 'ID produit' }, { key: 'produit', label: 'Produit' },
    { key: 'qte', label: 'Quantité' }, { key: 'pu', label: "Prix d'achat unitaire (FCFA)" },
    { key: 'total', label: "Montant de l'achat (FCFA)", formula: '=[qte]*[pu]' },
    { key: 'fournisseur', label: 'Fournisseur' }, { key: 'note', label: 'Note' },
    { key: 'nbSacs', label: 'Nombre de sacs / cartons' }, { key: 'kgSac', label: 'Kg par sac / carton' }
  ],
  Ventes: [
    { key: 'id', label: 'ID' }, { key: 'date', label: 'Date', text: true },
    { key: 'produitId', label: 'ID produit' }, { key: 'produit', label: 'Produit' },
    { key: 'categorie', label: 'Catégorie' }, { key: 'qte', label: 'Quantité' },
    { key: 'pu', label: 'Prix de vente unitaire (FCFA)' },
    { key: 'ca', label: "Chiffre d'affaires (FCFA)", formula: '=[qte]*[pu]' },
    { key: 'cout', label: "Coût d'achat unitaire (FCFA)" },
    { key: 'marge', label: 'Bénéfice brut (FCFA)', formula: '=[qte]*([pu]-[cout])' },
    { key: 'paiement', label: 'Paiement' }, { key: 'note', label: 'Client / Note' },
    { key: 'nbSacs', label: 'Nombre de sacs / cartons vendus' }, { key: 'kgSac', label: 'Kg par sac / carton' }
  ],
  Depenses: [
    { key: 'id', label: 'ID' }, { key: 'date', label: 'Date', text: true },
    { key: 'categorie', label: 'Catégorie' }, { key: 'libelle', label: 'Libellé' },
    { key: 'montant', label: 'Montant (FCFA)' }
  ],
  Pertes: [
    { key: 'id', label: 'ID' }, { key: 'date', label: 'Date', text: true },
    { key: 'produitId', label: 'ID produit' }, { key: 'produit', label: 'Produit' },
    { key: 'qte', label: 'Quantité' }, { key: 'motif', label: 'Motif' },
    { key: 'cout', label: "Coût d'achat unitaire (FCFA)" },
    { key: 'valeur', label: 'Valeur perdue (FCFA)', formula: '=[qte]*[cout]' }
  ]
};

var EXPENSE_CATEGORIES = ['Électricité', 'Glace', 'Transport', 'Loyer', 'Salaires', 'Emballages',
  'Eau', 'Carburant / Gaz', 'Entretien / Réparations', 'Frais de téléphone', 'Taxes / Patente', 'Autres'];
var LOSS_REASONS = ['Poisson avarié', 'Décongélation', 'Casse', 'Péremption', 'Vol', 'Don / Consommation perso', 'Correction d\'inventaire'];
var PAYMENT_MODES = ['Espèces', 'Mobile Money', 'Crédit'];

function num_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}
function round_(v, d) { var f = Math.pow(10, d === undefined ? 2 : d); return Math.round((v + 1e-12) * f) / f; }
function uid_(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
}
function validDate_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) throw new Error('Date invalide : ' + s);
  var p = String(s).split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  if (d.getUTCMonth() !== p[1] - 1) throw new Error('Date invalide : ' + s);
  return String(s);
}
function addDays_(s, n) {
  var p = s.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}
function inRange_(d, from, to) { return d >= from && d <= to; }

/* ---------- Produits ---------- */

function listProducts_(store) {
  return store.all('Produits').map(function (p) {
    return {
      id: String(p.id), categorie: p.categorie, nom: p.nom, unite: p.unite,
      prixAchat: num_(p.prixAchat), prixVente: num_(p.prixVente), seuil: num_(p.seuil),
      actif: String(p.actif).toUpperCase() !== 'NON', kgSac: num_(p.kgSac)
    };
  });
}

function saveProduct_(store, p) {
  var nom = String(p.nom || '').trim();
  if (!nom) throw new Error('Le nom du produit est obligatoire.');
  var rec = {
    categorie: String(p.categorie || 'Autres').trim(), nom: nom, unite: String(p.unite || 'pièce').trim(),
    prixAchat: num_(p.prixAchat), prixVente: num_(p.prixVente), seuil: num_(p.seuil),
    actif: p.actif === false || String(p.actif).toUpperCase() === 'NON' ? 'NON' : 'OUI',
    kgSac: num_(p.kgSac) > 0 ? num_(p.kgSac) : ''
  };
  return store.lock(function () {
    if (p.id) { store.update('Produits', p.id, rec); rec.id = p.id; }
    else {
      var all = store.all('Produits');
      var max = all.reduce(function (m, x) { var n = parseInt(String(x.id).replace(/\D/g, ''), 10); return n > m ? n : m; }, 0);
      rec.id = 'P' + ('000' + (max + 1)).slice(-4);
      store.append('Produits', rec);
    }
    return rec;
  });
}

function findProduct_(store, id) {
  var list = listProducts_(store);
  for (var i = 0; i < list.length; i++) if (list[i].id === String(id)) return list[i];
  throw new Error('Produit introuvable : ' + id);
}

/* ---------- Coût moyen et stock ---------- */

function unitCost_(achats, product, upToDate) {
  var q = 0, t = 0;
  achats.forEach(function (a) {
    if (String(a.produitId) === product.id && (!upToDate || String(a.date) <= upToDate)) {
      q += num_(a.qte); t += num_(a.qte) * num_(a.pu);
    }
  });
  return q > 0 ? t / q : product.prixAchat;
}

function stockTable_(store) {
  var products = listProducts_(store), map = {}, achats = store.all('Achats');
  products.forEach(function (p) { map[p.id] = { p: p, in: 0, out: 0, lost: 0, cost: 0 }; });
  achats.forEach(function (a) { var m = map[String(a.produitId)]; if (m) m.in += num_(a.qte); });
  store.all('Ventes').forEach(function (v) { var m = map[String(v.produitId)]; if (m) m.out += num_(v.qte); });
  store.all('Pertes').forEach(function (v) { var m = map[String(v.produitId)]; if (m) m.lost += num_(v.qte); });
  return products.map(function (p) {
    var m = map[p.id], qte = round_(m.in - m.out - m.lost, 3), cout = unitCost_(achats, p);
    var status = (!m.in && !m.out && !m.lost) ? 'neutre' : (qte <= 0 ? 'rupture' : (p.seuil > 0 && qte <= p.seuil ? 'bas' : 'ok'));
    return {
      id: p.id, categorie: p.categorie, nom: p.nom, unite: p.unite, actif: p.actif,
      prixVente: p.prixVente, prixAchat: p.prixAchat, seuil: p.seuil, kgSac: p.kgSac,
      sacs: p.kgSac > 0 ? round_(qte / p.kgSac, 2) : null,
      entrees: round_(m.in, 3), sorties: round_(m.out, 3), pertes: round_(m.lost, 3),
      stock: qte, coutMoyen: round_(cout, 2), valeur: round_(Math.max(qte, 0) * cout, 0), statut: status
    };
  });
}

/* ---------- Écritures ---------- */

/**
 * Vente. Chaque ligne est soit au poids / à l'unité {produitId, qte, pu},
 * soit au sac {produitId, nbSacs, kgSac, prixSac} : la quantité enregistrée est
 * alors nbSacs x kgSac (dans l'unité du produit) et le prix unitaire prixSac / kgSac.
 * Le poids du sac saisi est mémorisé sur la fiche produit.
 */
function addSale_(store, d) {
  var date = validDate_(d.date), lines = d.lines || [];
  if (!lines.length) throw new Error('Le panier est vide.');
  var payment = PAYMENT_MODES.indexOf(d.paiement) >= 0 ? d.paiement : 'Espèces';
  return store.lock(function () {
    var products = listProducts_(store), achats = store.all('Achats'), stock = {}, warnings = [], total = 0, margin = 0;
    stockTable_(store).forEach(function (s) { stock[s.id] = s.stock; });
    var batch = uid_('V'), kgUpdates = {};
    lines.forEach(function (l, i) {
      var p = products.filter(function (x) { return x.id === String(l.produitId); })[0];
      if (!p) throw new Error('Produit introuvable : ' + l.produitId);
      var qte, pu, nbSacs = num_(l.nbSacs), kgSac = 0;
      if (nbSacs > 0) {
        kgSac = num_(l.kgSac) > 0 ? num_(l.kgSac) : p.kgSac;
        if (!(kgSac > 0)) throw new Error('Indiquez le poids (kg) d\'un sac pour ' + p.nom + '.');
        qte = round_(nbSacs * kgSac, 3);
        pu = round_(num_(l.prixSac) / kgSac, 4);
        if (kgSac !== p.kgSac) kgUpdates[p.id] = kgSac;
      } else { nbSacs = 0; qte = num_(l.qte); pu = num_(l.pu); }
      if (qte <= 0) throw new Error('Quantité invalide pour ' + p.nom);
      if (pu < 0) throw new Error('Prix invalide pour ' + p.nom);
      var cout = round_(unitCost_(achats, p, date), 2);
      if (stock[p.id] - qte < 0) warnings.push(p.nom + ' : stock insuffisant (' + stock[p.id] + ' ' + p.unite + ' enregistré).');
      stock[p.id] -= qte;
      store.append('Ventes', {
        id: batch + '-' + (i + 1), date: date, produitId: p.id, produit: p.nom, categorie: p.categorie,
        qte: qte, pu: pu, ca: round_(qte * pu, 0), cout: cout, marge: round_(qte * (pu - cout), 0),
        paiement: payment, note: String(d.note || ''), nbSacs: nbSacs || '', kgSac: kgSac || ''
      });
      total += qte * pu; margin += qte * (pu - cout);
    });
    Object.keys(kgUpdates).forEach(function (id) { store.update('Produits', id, { kgSac: kgUpdates[id] }); });
    return { id: batch, total: round_(total, 0), marge: round_(margin, 0), warnings: warnings };
  });
}

/**
 * Achat. Deux saisies possibles :
 *  - au poids : qte + (pu | montant)
 *  - par sacs / cartons : nbSacs + kgSac (+ prixKg via pu, | prixSac | montant).
 * La quantité enregistrée est toujours dans l'unité du produit (kg pour les produits au kilo).
 */
function addPurchase_(store, d) {
  var date = validDate_(d.date), p = findProduct_(store, d.produitId);
  var nbSacs = num_(d.nbSacs), kgSac = num_(d.kgSac), qte, montant = num_(d.montant), pu = num_(d.pu);
  if (nbSacs > 0) {
    if (!(kgSac > 0)) throw new Error('Indiquez le poids (kg) d\'un sac ou carton.');
    qte = round_(nbSacs * kgSac, 3);
    if (num_(d.prixSac) > 0) pu = num_(d.prixSac) / kgSac;
  } else { nbSacs = 0; kgSac = 0; qte = num_(d.qte); }
  if (qte <= 0) throw new Error('Quantité invalide.');
  if (montant > 0) pu = montant / qte;
  pu = round_(pu, 4);
  if (!(pu > 0)) throw new Error("Indiquez le prix d'achat.");
  return store.lock(function () {
    var rec = {
      id: uid_('A'), date: date, produitId: p.id, produit: p.nom, qte: qte, pu: pu, total: round_(qte * pu, 0),
      fournisseur: String(d.fournisseur || ''), note: String(d.note || ''),
      nbSacs: nbSacs || '', kgSac: kgSac || ''
    };
    store.append('Achats', rec);
    var patch = { prixAchat: pu };
    if (kgSac > 0) patch.kgSac = kgSac;
    if (num_(d.prixVente) > 0) patch.prixVente = num_(d.prixVente);
    store.update('Produits', p.id, patch);
    return rec;
  });
}

function addExpense_(store, d) {
  var date = validDate_(d.date), montant = num_(d.montant);
  if (montant <= 0) throw new Error('Montant invalide.');
  return store.lock(function () {
    var rec = { id: uid_('D'), date: date, categorie: String(d.categorie || 'Autres'), libelle: String(d.libelle || ''), montant: montant };
    store.append('Depenses', rec);
    return rec;
  });
}

function addLoss_(store, d) {
  var date = validDate_(d.date), p = findProduct_(store, d.produitId), qte = num_(d.qte);
  if (qte <= 0) throw new Error('Quantité invalide.');
  return store.lock(function () {
    var cout = round_(unitCost_(store.all('Achats'), p, date), 2);
    var rec = { id: uid_('L'), date: date, produitId: p.id, produit: p.nom, qte: qte, motif: String(d.motif || 'Autre'), cout: cout, valeur: round_(qte * cout, 0) };
    store.append('Pertes', rec);
    return rec;
  });
}

function removeRecord_(store, table, id) {
  if (['Achats', 'Ventes', 'Depenses', 'Pertes'].indexOf(table) < 0) throw new Error('Table non autorisée.');
  return store.lock(function () { store.remove(table, id); return true; });
}

function settleCredit_(store, id) {
  return store.lock(function () { store.update('Ventes', id, { paiement: 'Crédit réglé' }); return true; });
}

/* ---------- Rapports ---------- */

function report_(store, from, to) {
  from = validDate_(from); to = validDate_(to);
  var ventes = store.all('Ventes').filter(function (v) { return inRange_(String(v.date), from, to); });
  var depenses = store.all('Depenses').filter(function (v) { return inRange_(String(v.date), from, to); });
  var pertes = store.all('Pertes').filter(function (v) { return inRange_(String(v.date), from, to); });
  var achats = store.all('Achats').filter(function (v) { return inRange_(String(v.date), from, to); });
  var days = {}, prod = {}, cat = {}, pay = {}, exp = {};
  var T = { ca: 0, marge: 0, depenses: 0, pertes: 0, achats: 0, credit: 0, nbLignes: 0, tickets: 0 };
  var tickets = {};
  function day(d) { return days[d] || (days[d] = { date: d, ca: 0, marge: 0, depenses: 0, pertes: 0 }); }
  ventes.forEach(function (v) {
    var ca = num_(v.qte) * num_(v.pu), mg = num_(v.qte) * (num_(v.pu) - num_(v.cout)), d = day(String(v.date));
    d.ca += ca; d.marge += mg; T.ca += ca; T.marge += mg; T.nbLignes++;
    tickets[String(v.id).replace(/-\d+$/, '')] = 1;
    var p = prod[v.produitId] || (prod[v.produitId] = { produitId: v.produitId, produit: v.produit, categorie: v.categorie, qte: 0, ca: 0, marge: 0 });
    p.qte += num_(v.qte); p.ca += ca; p.marge += mg;
    var c = cat[v.categorie] || (cat[v.categorie] = { categorie: v.categorie, ca: 0, marge: 0 }); c.ca += ca; c.marge += mg;
    pay[v.paiement] = (pay[v.paiement] || 0) + ca;
    if (v.paiement === 'Crédit') T.credit += ca;
  });
  depenses.forEach(function (x) { var m = num_(x.montant); day(String(x.date)).depenses += m; T.depenses += m; exp[x.categorie] = (exp[x.categorie] || 0) + m; });
  pertes.forEach(function (x) { var m = num_(x.qte) * num_(x.cout); day(String(x.date)).pertes += m; T.pertes += m; });
  achats.forEach(function (x) { T.achats += num_(x.qte) * num_(x.pu); });
  T.tickets = Object.keys(tickets).length;
  function fin(o) { Object.keys(o).forEach(function (k) { if (typeof o[k] === 'number') o[k] = round_(o[k], k === 'qte' ? 3 : 0); }); return o; }
  var dayList = Object.keys(days).sort().map(function (k) { var d = fin(days[k]); d.net = d.marge - d.depenses - d.pertes; return d; });
  T.net = T.marge - T.depenses - T.pertes;
  T.tauxMarge = T.ca > 0 ? round_(T.marge / T.ca * 100, 1) : 0;
  T.panierMoyen = T.tickets > 0 ? T.ca / T.tickets : 0;
  fin(T);
  return {
    from: from, to: to, totaux: T, jours: dayList,
    produits: Object.keys(prod).map(function (k) { return fin(prod[k]); }).sort(function (a, b) { return b.ca - a.ca; }),
    categories: Object.keys(cat).map(function (k) { return fin(cat[k]); }).sort(function (a, b) { return b.ca - a.ca; }),
    paiements: Object.keys(pay).map(function (k) { return { mode: k, ca: round_(pay[k], 0) }; }),
    depensesParCategorie: Object.keys(exp).map(function (k) { return { categorie: k, montant: round_(exp[k], 0) }; }).sort(function (a, b) { return b.montant - a.montant; })
  };
}

function dashboard_(store, today) {
  today = validDate_(today);
  var monthStart = today.slice(0, 8) + '01';
  var stock = stockTable_(store);
  return {
    today: today,
    jour: report_(store, today, today),
    hier: report_(store, addDays_(today, -1), addDays_(today, -1)).totaux,
    semaine: report_(store, addDays_(today, -6), today),
    mois: report_(store, monthStart, today).totaux,
    alertes: stock.filter(function (s) { return s.actif && (s.statut !== 'ok') && (s.entrees > 0 || s.sorties > 0); })
      .sort(function (a, b) { return a.stock - b.stock; }).slice(0, 12),
    valeurStock: stock.reduce(function (t, s) { return t + s.valeur; }, 0),
    nbProduits: stock.filter(function (s) { return s.actif; }).length
  };
}

function history_(store, table, from, to) {
  if (['Achats', 'Ventes', 'Depenses', 'Pertes'].indexOf(table) < 0) throw new Error('Table non autorisée.');
  return store.all(table).filter(function (r) { return inRange_(String(r.date), from, to); })
    .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)); })
    .slice(0, 500);
}

function bootstrap_(store, today) {
  return {
    produits: listProducts_(store), categories: CATEGORIES, depenseCategories: EXPENSE_CATEGORIES,
    motifsPertes: LOSS_REASONS, paiements: PAYMENT_MODES, stock: stockTable_(store), dashboard: dashboard_(store, today)
  };
}

/** Point d'entrée unique appelé par l'interface. */
function dispatch_(store, action, a) {
  a = a || {};
  switch (action) {
    case 'bootstrap': return bootstrap_(store, a.today);
    case 'dashboard': return dashboard_(store, a.today);
    case 'stock': return stockTable_(store);
    case 'report': return report_(store, a.from, a.to);
    case 'history': return history_(store, a.table, a.from, a.to);
    case 'saveProduct': return saveProduct_(store, a);
    case 'addSale': return addSale_(store, a);
    case 'addPurchase': return addPurchase_(store, a);
    case 'addExpense': return addExpense_(store, a);
    case 'addLoss': return addLoss_(store, a);
    case 'remove': return removeRecord_(store, a.table, a.id);
    case 'settleCredit': return settleCredit_(store, a.id);
    default: throw new Error('Action inconnue : ' + action);
  }
}
