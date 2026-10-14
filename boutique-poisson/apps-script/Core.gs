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
    { key: 'kgSac', label: "Contenu d'un sac / carton (kg ou unités)" },
    { key: 'cible', label: 'Stock cible (quantité à reconstituer)' }
  ],
  Achats: [
    { key: 'id', label: 'ID' }, { key: 'date', label: 'Date', text: true },
    { key: 'produitId', label: 'ID produit' }, { key: 'produit', label: 'Produit' },
    { key: 'qte', label: 'Quantité' }, { key: 'pu', label: "Prix d'achat unitaire (FCFA)" },
    { key: 'total', label: "Montant de l'achat (FCFA)", formula: '=[qte]*[pu]' },
    { key: 'fournisseur', label: 'Fournisseur' }, { key: 'note', label: 'Note' },
    { key: 'nbSacs', label: 'Nombre de sacs / cartons' }, { key: 'kgSac', label: 'Contenu par sac / carton' }
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
    { key: 'nbSacs', label: 'Nombre de sacs / cartons vendus' }, { key: 'kgSac', label: 'Contenu par sac / carton' }
  ],
  Depenses: [
    { key: 'id', label: 'ID' }, { key: 'date', label: 'Date', text: true },
    { key: 'categorie', label: 'Catégorie' }, { key: 'libelle', label: 'Libellé' },
    { key: 'montant', label: 'Montant (FCFA)' }
  ],
  Ajustements: [
    { key: 'id', label: 'ID' }, { key: 'date', label: 'Date', text: true },
    { key: 'produitId', label: 'ID produit' }, { key: 'produit', label: 'Produit' },
    { key: 'qte', label: 'Quantité ajoutée au stock' }, { key: 'motif', label: 'Motif' },
    { key: 'cout', label: "Coût d'achat unitaire (FCFA)" },
    { key: 'valeur', label: 'Valeur du stock ajouté (FCFA)', formula: '=[qte]*[cout]' }
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
var EDITABLE_TABLES = ['Achats', 'Ventes', 'Depenses', 'Pertes', 'Ajustements'];
/** Réglages des prévisions d'achat : jours de ventes à couvrir, délai d'alerte (jours), fenêtre de calcul (jours). */
var DEFAULT_SETTINGS = { joursCible: 7, delai: 3, fenetre: 30 };

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
function daysBetween_(a, b) {
  var p = String(a).split('-').map(Number), q = String(b).split('-').map(Number);
  return Math.round((Date.UTC(q[0], q[1] - 1, q[2]) - Date.UTC(p[0], p[1] - 1, p[2])) / 864e5);
}

function getSettings_(store) {
  var s = {};
  try { s = (store.getSettings && store.getSettings()) || {}; } catch (e) { s = {}; }
  return {
    joursCible: num_(s.joursCible) > 0 ? num_(s.joursCible) : DEFAULT_SETTINGS.joursCible,
    delai: num_(s.delai) > 0 ? num_(s.delai) : DEFAULT_SETTINGS.delai,
    fenetre: num_(s.fenetre) > 0 ? Math.min(num_(s.fenetre), 90) : DEFAULT_SETTINGS.fenetre
  };
}
function saveSettings_(store, d) {
  var cur = getSettings_(store), n = {
    joursCible: d.joursCible === undefined ? cur.joursCible : num_(d.joursCible),
    delai: d.delai === undefined ? cur.delai : num_(d.delai),
    fenetre: d.fenetre === undefined ? cur.fenetre : num_(d.fenetre)
  };
  if (!(n.joursCible >= 1 && n.joursCible <= 60)) throw new Error('Jours à couvrir : entre 1 et 60.');
  if (!(n.delai >= 1 && n.delai <= 30)) throw new Error('Délai d\'alerte : entre 1 et 30 jours.');
  if (!(n.fenetre >= 7 && n.fenetre <= 90)) throw new Error('Période de calcul des ventes : entre 7 et 90 jours.');
  return store.lock(function () { store.saveSettings(n); return n; });
}

/* ---------- Produits ---------- */

function listProducts_(store) {
  return store.all('Produits').map(function (p) {
    return {
      id: String(p.id), categorie: p.categorie, nom: p.nom, unite: p.unite,
      prixAchat: num_(p.prixAchat), prixVente: num_(p.prixVente), seuil: num_(p.seuil),
      actif: String(p.actif).toUpperCase() !== 'NON', kgSac: num_(p.kgSac), cible: num_(p.cible)
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
    kgSac: num_(p.kgSac) > 0 ? num_(p.kgSac) : '', cible: num_(p.cible) > 0 ? num_(p.cible) : ''
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

/** Achats + stock initial / surplus d'inventaire valorisés : base du coût moyen pondéré. */
function costEvents_(store) {
  var ev = store.all('Achats').map(function (a) { return { produitId: a.produitId, date: a.date, qte: a.qte, pu: a.pu }; });
  store.all('Ajustements').forEach(function (a) {
    if (num_(a.cout) > 0 && num_(a.qte) > 0) ev.push({ produitId: a.produitId, date: a.date, qte: a.qte, pu: a.cout });
  });
  return ev;
}

function unitCost_(events, product, upToDate) {
  var q = 0, t = 0;
  events.forEach(function (a) {
    if (String(a.produitId) === product.id && (!upToDate || String(a.date) <= upToDate)) {
      q += num_(a.qte); t += num_(a.qte) * num_(a.pu);
    }
  });
  return q > 0 ? t / q : product.prixAchat;
}

/**
 * Prévision d'achat d'un produit.
 *  - seuil d'alerte : seuil saisi, sinon vitesse de vente x délai d'alerte ;
 *  - stock cible : cible saisie, sinon vitesse de vente x jours à couvrir (au moins 2 x seuil) ;
 *  - niveau : urgent (rupture, stock négatif, moins d'1 jour de vente), bientot (sous le seuil), ok.
 * La quantité à acheter est arrondie au carton / sac entier quand le contenu est connu.
 */
function reorder_(p, stock, v, cout, S) {
  var seuil = p.seuil, cibleP = p.cible;
  if (!(v > 0 || seuil > 0 || cibleP > 0)) return null;
  var threshold = seuil > 0 ? seuil : v * S.delai;
  var target = cibleP > 0 ? cibleP : Math.max(v * S.joursCible, seuil > 0 ? seuil * 2 : 0);
  if (target <= threshold) target = threshold > 0 ? threshold * 2 : Math.max(target, 1);
  var couv = v > 0 ? stock / v : null, niveau = 'ok', raison = '';
  if (stock < 0) { niveau = 'urgent'; raison = 'Stock négatif : inventaire à faire'; }
  else if (stock === 0) { niveau = 'urgent'; raison = 'Rupture de stock'; }
  else if (couv !== null && couv <= 1) { niveau = 'urgent'; raison = 'Moins d\'un jour de vente en stock'; }
  else if (threshold > 0 && stock <= threshold) { niveau = 'bientot'; raison = seuil > 0 ? 'Sous le seuil d\'alerte' : 'Environ ' + round_(couv, 1) + ' jour(s) de vente en stock'; }
  var need = niveau === 'ok' ? 0 : Math.max(0, target - Math.max(stock, 0)), cartons = 0, arr = 0;
  if (need > 0) {
    if (p.kgSac > 0) { cartons = Math.ceil(need / p.kgSac - 1e-9); arr = round_(cartons * p.kgSac, 3); }
    else if (p.unite === 'kg') arr = Math.ceil(need * 10 - 1e-9) / 10;
    else arr = Math.ceil(need - 1e-9);
  }
  var cu = cout > 0 ? cout : p.prixAchat;
  return {
    niveau: niveau, raison: raison, cible: round_(target, 2), seuilEff: round_(threshold, 2),
    couverture: couv === null ? null : round_(couv, 1), aAcheter: round_(need, 3), cartons: cartons, qteArrondie: arr,
    coutUnitaire: round_(cu, 2), coutEstime: round_(arr * cu, 0), verifier: stock < 0
  };
}

/**
 * Tableau de stock complet. Sans `today`, ni vitesse de vente ni prévision (utilisé pour les contrôles de vente).
 * Retourne { rows, startAll } ; startAll = date de la première vente enregistrée.
 */
function stockModel_(store, today, settings) {
  settings = settings || DEFAULT_SETTINGS;
  var products = listProducts_(store), M = {}, startAll = '';
  products.forEach(function (p) { M[p.id] = { in: 0, adj: 0, out: 0, lost: 0, cq: 0, ct: 0, sold: 0, first: '', firstSale: '', lastBuy: null }; });
  var winStart = today ? addDays_(today, -(settings.fenetre - 1)) : '';
  store.all('Achats').forEach(function (a) {
    var m = M[String(a.produitId)]; if (!m) return;
    var q = num_(a.qte), d = String(a.date);
    m.in += q; m.cq += q; m.ct += q * num_(a.pu);
    if (!m.first || d < m.first) m.first = d;
    if (!m.lastBuy || d >= m.lastBuy.date) m.lastBuy = { date: d, pu: num_(a.pu), fournisseur: String(a.fournisseur || '') };
  });
  store.all('Ajustements').forEach(function (a) {
    var m = M[String(a.produitId)]; if (!m) return;
    var q = num_(a.qte), d = String(a.date);
    m.adj += q;
    if (num_(a.cout) > 0) { m.cq += q; m.ct += q * num_(a.cout); }
    if (!m.first || d < m.first) m.first = d;
  });
  store.all('Ventes').forEach(function (v) {
    var d = String(v.date), q = num_(v.qte), m = M[String(v.produitId)];
    if (!startAll || d < startAll) startAll = d;
    if (!m) return;
    m.out += q;
    if (!m.firstSale || d < m.firstSale) m.firstSale = d;
    if (winStart && d >= winStart && d <= today) m.sold += q;
  });
  store.all('Pertes').forEach(function (v) { var m = M[String(v.produitId)]; if (m) m.lost += num_(v.qte); });
  var rows = products.map(function (p) {
    var m = M[p.id], qte = round_(m.in + m.adj - m.out - m.lost, 3), cout = m.cq > 0 ? m.ct / m.cq : p.prixAchat;
    var moved = m.in || m.adj || m.out || m.lost, v = 0, jours = 0;
    if (today && startAll && m.sold > 0) {
      var born = m.first && m.firstSale ? (m.first < m.firstSale ? m.first : m.firstSale) : (m.first || m.firstSale);
      var from = [startAll, born, winStart].filter(Boolean).sort().pop();
      jours = Math.min(Math.max(daysBetween_(from, today) + 1, 1), settings.fenetre);
      v = m.sold / jours;
    }
    var re = today ? reorder_(p, qte, v, cout, settings) : null;
    var status = !moved ? 'neutre' : (qte < 0 ? 'negatif' : (qte === 0 ? 'rupture' : (re ? (re.niveau !== 'ok' ? 'bas' : 'ok') : (p.seuil > 0 && qte <= p.seuil ? 'bas' : 'ok'))));
    return {
      id: p.id, categorie: p.categorie, nom: p.nom, unite: p.unite, actif: p.actif,
      prixVente: p.prixVente, prixAchat: p.prixAchat, seuil: p.seuil, cible: p.cible, kgSac: p.kgSac,
      sacs: p.kgSac > 0 ? round_(qte / p.kgSac, 2) : null,
      entrees: round_(m.in, 3), ajouts: round_(m.adj, 3), sorties: round_(m.out, 3), pertes: round_(m.lost, 3),
      stock: qte, coutMoyen: round_(cout, 2), valeur: round_(Math.max(qte, 0) * cout, 0), statut: status,
      coutManquant: qte > 0 && !(cout > 0),
      venteJour: round_(v, 3), jours: jours, couverture: v > 0 ? round_(qte / v, 1) : null, reappro: re,
      dernierAchat: m.lastBuy ? { date: m.lastBuy.date, pu: round_(m.lastBuy.pu, 2) } : null,
      dernierFournisseur: m.lastBuy ? m.lastBuy.fournisseur : ''
    };
  });
  return { rows: rows, startAll: startAll };
}

function stockTable_(store, today, settings) { return stockModel_(store, today, settings).rows; }

/** Liste d'achats suggérée : produits à racheter (urgent puis bientôt), avec quantités arrondies et coût estimé. */
function summarizeReorder_(rows, today, startAll) {
  var items = rows.filter(function (r) { return r.actif && r.reappro && r.reappro.niveau !== 'ok'; })
    .sort(function (a, b) {
      var u = (a.reappro.niveau === 'urgent' ? 0 : 1) - (b.reappro.niveau === 'urgent' ? 0 : 1);
      if (u) return u;
      var ca = a.couverture === null ? 1e9 : a.couverture, cb = b.couverture === null ? 1e9 : b.couverture;
      return ca - cb || a.nom.localeCompare(b.nom);
    });
  return {
    items: items,
    urgent: items.filter(function (r) { return r.reappro.niveau === 'urgent'; }).length,
    bientot: items.filter(function (r) { return r.reappro.niveau === 'bientot'; }).length,
    budget: items.reduce(function (t, r) { return t + r.reappro.coutEstime; }, 0),
    joursObserves: startAll ? Math.max(daysBetween_(startAll, today) + 1, 1) : 0
  };
}

function reorderList_(store, today) {
  today = validDate_(today);
  var S = getSettings_(store), m = stockModel_(store, today, S), r = summarizeReorder_(m.rows, today, m.startAll);
  r.settings = S;
  return r;
}

/**
 * Fiche de stock d'un produit : tous les mouvements avec le solde après chaque mouvement.
 * À une même date, les entrées passent avant les sorties.
 */
function stockCard_(store, id) {
  var p = findProduct_(store, id), ev = [];
  store.all('Achats').forEach(function (a) {
    if (String(a.produitId) !== p.id) return;
    ev.push({ date: String(a.date), ord: 0, id: String(a.id), type: 'Achat', qte: num_(a.qte), pu: num_(a.pu),
      detail: [a.nbSacs ? num_(a.nbSacs) + ' × ' + num_(a.kgSac) : '', a.fournisseur].filter(Boolean).join(' · ') });
  });
  store.all('Ajustements').forEach(function (a) {
    if (String(a.produitId) === p.id) ev.push({ date: String(a.date), ord: 0, id: String(a.id), type: String(a.motif || 'Ajustement'), qte: num_(a.qte), pu: num_(a.cout), detail: '' });
  });
  store.all('Ventes').forEach(function (v) {
    if (String(v.produitId) === p.id) ev.push({ date: String(v.date), ord: 1, id: String(v.id), type: 'Vente', qte: -num_(v.qte), pu: num_(v.pu),
      detail: [v.nbSacs ? num_(v.nbSacs) + ' × ' + num_(v.kgSac) : '', v.paiement === 'Crédit' ? 'Crédit' : '', v.note].filter(Boolean).join(' · ') });
  });
  store.all('Pertes').forEach(function (v) {
    if (String(v.produitId) === p.id) ev.push({ date: String(v.date), ord: 1, id: String(v.id), type: 'Perte', qte: -num_(v.qte), pu: num_(v.cout), detail: String(v.motif || '') });
  });
  ev.sort(function (a, b) { return a.date.localeCompare(b.date) || a.ord - b.ord || a.id.localeCompare(b.id); });
  var bal = 0, ent = 0, sor = 0;
  ev.forEach(function (e) { bal = round_(bal + e.qte, 3); e.solde = bal; if (e.qte > 0) ent += e.qte; else sor -= e.qte; });
  var truncated = ev.length > 400, avant = 0;
  if (truncated) { avant = ev[ev.length - 401].solde; ev = ev.slice(-400); }
  return { produit: p, mouvements: ev, soldeAvant: avant, tronque: truncated, entrees: round_(ent, 3), sorties: round_(sor, 3), solde: bal };
}

/**
 * Inventaire : pour chaque produit compté, l'écart avec le stock calculé est enregistré.
 *  - écart positif : ligne « Stock initial » (produit sans mouvement) ou « Inventaire (surplus) », valorisée au coût saisi,
 *    sinon au coût moyen, sinon au prix d'achat de référence ;
 *  - écart négatif : perte « Écart d'inventaire », valorisée au coût moyen.
 * d = { date, lines: [ { produitId, compte, cout? } ] } ; une ligne sans `compte` est ignorée.
 */
function inventory_(store, d) {
  var date = validDate_(d.date), lines = d.lines || [];
  if (!lines.length) throw new Error('Aucune ligne d\'inventaire.');
  return store.lock(function () {
    var byId = {}, res = { ajouts: 0, pertes: 0, inchanges: 0, valeurAjoutee: 0, valeurPerdue: 0 }, plan = [], refs = {};
    stockModel_(store, date, getSettings_(store)).rows.forEach(function (r) { byId[r.id] = r; });
    lines.forEach(function (l, i) {
      if (l.compte === '' || l.compte == null) return;
      var r = byId[String(l.produitId)];
      if (!r) throw new Error('Produit introuvable : ' + l.produitId);
      var compte = num_(l.compte);
      if (compte < 0) throw new Error('Quantité comptée négative pour ' + r.nom + '.');
      var ecart = round_(compte - r.stock, 3);
      if (ecart === 0) { res.inchanges++; return; }
      if (ecart > 0) {
        var moved = r.entrees || r.ajouts || r.sorties || r.pertes;
        var cout = num_(l.cout) > 0 ? num_(l.cout) : (r.coutMoyen > 0 ? r.coutMoyen : r.prixAchat);
        if (num_(l.cout) > 0 && !(r.prixAchat > 0)) refs[r.id] = num_(l.cout);
        plan.push({ table: 'Ajustements', rec: { id: uid_('J') + '-' + (i + 1), date: date, produitId: r.id, produit: r.nom, qte: ecart,
          motif: moved ? 'Inventaire (surplus)' : 'Stock initial', cout: round_(cout, 4), valeur: round_(ecart * cout, 0) } });
        res.ajouts++; res.valeurAjoutee += ecart * cout;
      } else {
        var cm = r.coutMoyen > 0 ? r.coutMoyen : r.prixAchat, q = -ecart;
        plan.push({ table: 'Pertes', rec: { id: uid_('L') + '-' + (i + 1), date: date, produitId: r.id, produit: r.nom, qte: q,
          motif: 'Écart d\'inventaire', cout: round_(cm, 2), valeur: round_(q * cm, 0) } });
        res.pertes++; res.valeurPerdue += q * cm;
      }
    });
    plan.forEach(function (x) { store.append(x.table, x.rec); });
    Object.keys(refs).forEach(function (id) { store.update('Produits', id, { prixAchat: refs[id] }); });
    res.valeurAjoutee = round_(res.valeurAjoutee, 0); res.valeurPerdue = round_(res.valeurPerdue, 0);
    return res;
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
    var products = listProducts_(store), achats = costEvents_(store), stock = {}, warnings = [], total = 0, margin = 0;
    stockTable_(store).forEach(function (s) { stock[s.id] = s.stock; });
    var batch = uid_('V'), kgUpdates = {};
    lines.forEach(function (l, i) {
      var p = products.filter(function (x) { return x.id === String(l.produitId); })[0];
      if (!p) throw new Error('Produit introuvable : ' + l.produitId);
      var qte, pu, nbSacs = num_(l.nbSacs), kgSac = 0;
      if (nbSacs > 0) {
        kgSac = num_(l.kgSac) > 0 ? num_(l.kgSac) : p.kgSac;
        if (!(kgSac > 0)) throw new Error('Indiquez le contenu d\'un sac ou carton (kg ou unités) pour ' + p.nom + '.');
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
 *  - au poids / à l'unité : qte + (pu | montant)
 *  - par sacs / cartons : nbSacs + kgSac (+ pu = prix par kg ou par unité | prixSac | montant).
 * kgSac est le contenu d'un sac ou carton, exprimé dans l'unité du produit
 * (kg pour un produit au kilo, nombre d'unités pour un produit vendu à la pièce).
 * La quantité enregistrée est toujours dans l'unité du produit. nbSacs peut être
 * fractionnaire (0,5 carton), comme sur les reçus des grossistes.
 */
function preparePurchase_(products, d) {
  var date = validDate_(d.date), p = products.filter(function (x) { return x.id === String(d.produitId); })[0];
  if (!p) throw new Error('Produit introuvable : ' + d.produitId);
  var nbSacs = num_(d.nbSacs), kgSac = num_(d.kgSac), qte, montant = num_(d.montant), pu = num_(d.pu);
  if (nbSacs > 0) {
    if (!(kgSac > 0)) throw new Error('Indiquez le contenu d\'un sac ou carton (kg ou unités).');
    qte = round_(nbSacs * kgSac, 3);
    if (num_(d.prixSac) > 0) pu = num_(d.prixSac) / kgSac;
  } else { nbSacs = 0; kgSac = 0; qte = num_(d.qte); }
  if (qte <= 0) throw new Error('Quantité invalide.');
  if (montant > 0) pu = montant / qte;
  pu = round_(pu, 4);
  if (!(pu > 0)) throw new Error("Indiquez le prix d'achat.");
  var rec = {
    id: uid_('A'), date: date, produitId: p.id, produit: p.nom, qte: qte, pu: pu, total: round_(qte * pu, 0),
    fournisseur: String(d.fournisseur || ''), note: String(d.note || ''),
    nbSacs: nbSacs || '', kgSac: kgSac || ''
  };
  var patch = { prixAchat: pu };
  if (kgSac > 0) patch.kgSac = kgSac;
  if (num_(d.prixVente) > 0) patch.prixVente = num_(d.prixVente);
  return { rec: rec, patch: patch, produitId: p.id };
}

function addPurchase_(store, d) {
  return store.lock(function () {
    var x = preparePurchase_(listProducts_(store), d);
    store.append('Achats', x.rec);
    store.update('Produits', x.produitId, x.patch);
    return x.rec;
  });
}

/**
 * Bon d'achat : plusieurs lignes enregistrées ensemble (tout ou rien).
 * d = { date, fournisseur, lines: [ { produitId, nbSacs, kgSac, prixSac | pu | montant } ] }
 */
function addPurchases_(store, d) {
  var lines = d.lines || [];
  if (!lines.length) throw new Error('Le bon d\'achat est vide.');
  return store.lock(function () {
    var products = listProducts_(store), prepared = [];
    lines.forEach(function (l, i) {
      var name = '';
      try {
        var x = preparePurchase_(products, { date: d.date, fournisseur: d.fournisseur, note: d.note, produitId: l.produitId,
          nbSacs: l.nbSacs, kgSac: l.kgSac, qte: l.qte, pu: l.pu, prixSac: l.prixSac, montant: l.montant, prixVente: l.prixVente });
        x.rec.id = x.rec.id + '-' + (i + 1);
        prepared.push(x);
      } catch (e) {
        products.forEach(function (p) { if (p.id === String(l.produitId)) name = ' (' + p.nom + ')'; });
        throw new Error('Ligne ' + (i + 1) + name + ' : ' + e.message);
      }
    });
    var total = 0, patches = {};
    prepared.forEach(function (x) { store.append('Achats', x.rec); total += x.rec.total; patches[x.produitId] = x.patch; });
    Object.keys(patches).forEach(function (id) { store.update('Produits', id, patches[id]); });
    return { lignes: prepared.length, total: round_(total, 0) };
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
    var cout = round_(unitCost_(costEvents_(store), p, date), 2);
    var rec = { id: uid_('L'), date: date, produitId: p.id, produit: p.nom, qte: qte, motif: String(d.motif || 'Autre'), cout: cout, valeur: round_(qte * cout, 0) };
    store.append('Pertes', rec);
    return rec;
  });
}

function removeRecord_(store, table, id) {
  if (EDITABLE_TABLES.indexOf(table) < 0) throw new Error('Table non autorisée.');
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

function dashboard_(store, today, model) {
  today = validDate_(today);
  var monthStart = today.slice(0, 8) + '01';
  model = model || stockModel_(store, today, getSettings_(store));
  var stock = model.rows, re = summarizeReorder_(stock, today, model.startAll);
  return {
    today: today,
    jour: report_(store, today, today),
    hier: report_(store, addDays_(today, -1), addDays_(today, -1)).totaux,
    semaine: report_(store, addDays_(today, -6), today),
    mois: report_(store, monthStart, today).totaux,
    reappro: { urgent: re.urgent, bientot: re.bientot, budget: re.budget, joursObserves: re.joursObserves, top: re.items.slice(0, 8) },
    valeurStock: stock.reduce(function (t, s) { return t + s.valeur; }, 0),
    nbProduits: stock.filter(function (s) { return s.actif; }).length,
    negatifs: stock.filter(function (s) { return s.actif && s.statut === 'negatif'; }).length,
    coutsManquants: stock.filter(function (s) { return s.actif && s.coutManquant; }).length,
    sansMouvement: stock.filter(function (s) { return s.actif && s.statut === 'neutre'; }).length
  };
}

function history_(store, table, from, to) {
  if (EDITABLE_TABLES.indexOf(table) < 0) throw new Error('Table non autorisée.');
  return store.all(table).filter(function (r) { return inRange_(String(r.date), from, to); })
    .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)); })
    .slice(0, 500);
}

function bootstrap_(store, today) {
  var S = getSettings_(store), model = stockModel_(store, validDate_(today), S);
  return {
    produits: listProducts_(store), categories: CATEGORIES, depenseCategories: EXPENSE_CATEGORIES,
    motifsPertes: LOSS_REASONS, paiements: PAYMENT_MODES, settings: S, stock: model.rows, dashboard: dashboard_(store, today, model)
  };
}

/** Point d'entrée unique appelé par l'interface. */
function dispatch_(store, action, a) {
  a = a || {};
  switch (action) {
    case 'bootstrap': return bootstrap_(store, a.today);
    case 'dashboard': return dashboard_(store, a.today);
    case 'stock': return stockTable_(store, validDate_(a.today), getSettings_(store));
    case 'reorder': return reorderList_(store, a.today);
    case 'stockCard': return stockCard_(store, a.produitId);
    case 'inventory': return inventory_(store, a);
    case 'settings': return getSettings_(store);
    case 'saveSettings': return saveSettings_(store, a);
    case 'report': return report_(store, a.from, a.to);
    case 'history': return history_(store, a.table, a.from, a.to);
    case 'saveProduct': return saveProduct_(store, a);
    case 'addSale': return addSale_(store, a);
    case 'addPurchase': return addPurchase_(store, a);
    case 'addPurchases': return addPurchases_(store, a);
    case 'addExpense': return addExpense_(store, a);
    case 'addLoss': return addLoss_(store, a);
    case 'remove': return removeRecord_(store, a.table, a.id);
    case 'settleCredit': return settleCredit_(store, a.id);
    default: throw new Error('Action inconnue : ' + action);
  }
}
