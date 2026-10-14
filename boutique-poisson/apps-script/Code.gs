/**
 * Boutique de poissons : serveur Google Apps Script.
 * Les données sont stockées dans le Google Sheet auquel ce script est rattaché.
 * Voir docs/INSTALLATION.md pour la mise en ligne.
 */

var NAV_SHEETS = ['LISEZ-MOI', 'Produits', 'Achats', 'Ventes', 'Depenses', 'Pertes', 'Ajustements', 'Stock', 'A_acheter', 'Journalier', 'Mensuel'];

function ensureSetup_() {
  var ss = getSpreadsheet_();
  var missing = NAV_SHEETS.filter(function (n) { return n !== 'LISEZ-MOI' && !ss.getSheetByName(n); });
  if (missing.length) setup();
}

function doGet() {
  ensureSetup_();
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Ma Poissonnerie')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Boutique')
    .addItem('Initialiser / réparer le classeur', 'setup')
    .addItem('Afficher le lien de l\'application', 'showAppUrl')
    .addToUi();
}

function showAppUrl() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(url ? 'Lien de l\'application :\n\n' + url : 'Déployez d\'abord l\'application (Déployer > Nouveau déploiement > Application Web).');
}

/** Appelée par l'interface : un seul point d'entrée. */
function api(action, args) {
  var store = new SheetStore_();
  return JSON.parse(JSON.stringify(dispatch_(store, action, withToday_(args))));
}

function withToday_(args) {
  args = args || {};
  args.today = args.today || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return args;
}

/* ---------- Stockage dans Google Sheets ---------- */

// Classeur « Poissonnerie - Gestion de la boutique » (utilisé si le script n'est pas rattaché au classeur).
var DEFAULT_SHEET_ID = '1pyZTzs2aCzv4LkVHCGS3xTABj1fuLWiPjR0QG7LU_co';

function getSpreadsheet_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
  return SpreadsheetApp.openById(id);
}

function colLetter_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }

function SheetStore_() {
  this.ss = getSpreadsheet_();
  this.tz = this.ss.getSpreadsheetTimeZone();
  this.cache = {};
}
SheetStore_.prototype.sheet_ = function (table) {
  var sh = this.ss.getSheetByName(table);
  if (!sh) { setup(); sh = this.ss.getSheetByName(table); }
  if (!sh) throw new Error('Feuille introuvable : ' + table);
  if (!this.checked) this.checked = {};
  if (!this.checked[table]) { this.checked[table] = true; ensureColumns_(sh, SCHEMA[table]); }
  return sh;
};

/** Mise à niveau : ajoute les colonnes (et en-têtes) introduites par les nouvelles versions. */
function ensureColumns_(sh, cols) {
  var need = cols.length;
  if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
  var hdr = sh.getRange(1, 1, 1, need).getValues()[0];
  cols.forEach(function (c, i) {
    if (hdr[i] === '' || hdr[i] == null) {
      sh.getRange(1, i + 1).setValue(c.label).setBackground(HEAD_BG).setFontColor(HEAD_FG).setFontWeight('bold').setWrap(true);
    }
  });
}
SheetStore_.prototype.all = function (table) {
  if (this.cache[table]) return this.cache[table].map(function (o) { return Object.assign({}, o); });
  var sh = this.sheet_(table), cols = SCHEMA[table], tz = this.tz, rows = [];
  var n = sh.getLastRow() - 1;
  if (n > 0) {
    sh.getRange(2, 1, n, cols.length).getValues().forEach(function (r) {
      if (r[0] === '' || r[0] == null) return;
      var o = {};
      cols.forEach(function (c, i) {
        var v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
        o[c.key] = v;
      });
      rows.push(o);
    });
  }
  this.cache[table] = rows;
  return rows.map(function (o) { return Object.assign({}, o); });
};
SheetStore_.prototype.append = function (table, obj) {
  var sh = this.sheet_(table), cols = SCHEMA[table], row = sh.getLastRow() + 1;
  var vals = [cols.map(function (c) {
    if (c.formula) {
      return c.formula.replace(/\[(\w+)\]/g, function (m, k) {
        var idx = cols.map(function (x) { return x.key; }).indexOf(k);
        return colLetter_(idx + 1) + row;
      });
    }
    return obj[c.key] == null ? '' : obj[c.key];
  })];
  sh.getRange(row, 1, 1, cols.length).setValues(vals);
  this.cache = {};
};
SheetStore_.prototype.findRow_ = function (table, id) {
  var sh = this.sheet_(table), n = sh.getLastRow() - 1;
  if (n < 1) throw new Error('Enregistrement introuvable : ' + id);
  var ids = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  throw new Error('Enregistrement introuvable : ' + id);
};
SheetStore_.prototype.remove = function (table, id) {
  this.sheet_(table).deleteRow(this.findRow_(table, id));
  this.cache = {};
};
SheetStore_.prototype.update = function (table, id, patch) {
  var sh = this.sheet_(table), cols = SCHEMA[table], row = this.findRow_(table, id);
  cols.forEach(function (c, i) {
    if (!c.formula && c.key !== 'id' && Object.prototype.hasOwnProperty.call(patch, c.key)) {
      sh.getRange(row, i + 1).setValue(patch[c.key]);
    }
  });
  this.cache = {};
};
SheetStore_.prototype.getSettings = function () {
  var raw = PropertiesService.getScriptProperties().getProperty('SETTINGS');
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
};
SheetStore_.prototype.saveSettings = function (s) { PropertiesService.getScriptProperties().setProperty('SETTINGS', JSON.stringify(s)); };
SheetStore_.prototype.lock = function (fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
};

/* ---------- Initialisation du classeur ---------- */

var HEAD_BG = '#0b4f6c', HEAD_FG = '#ffffff';

function setup() {
  var ss = getSpreadsheet_(), created = [];
  if (ss.getSpreadsheetTimeZone() !== 'Africa/Lagos') ss.setSpreadsheetTimeZone('Africa/Lagos');
  ['Produits', 'Achats', 'Ventes', 'Depenses', 'Pertes', 'Ajustements'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); created.push(name); }
    var cols = SCHEMA[name];
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c.label; })])
      .setBackground(HEAD_BG).setFontColor(HEAD_FG).setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) { if (c.text) sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@'); });
    if (sh.getRange('A1').getNote() !== 'Ne pas déplacer ni renommer les colonnes : l\'application les lit par position.') {
      sh.getRange('A1').setNote('Ne pas déplacer ni renommer les colonnes : l\'application les lit par position.');
    }
  });
  var prod = ss.getSheetByName('Produits');
  if (prod.getLastRow() < 2) {
    var rows = CATALOGUE.map(function (r, i) { return ['P' + ('000' + (i + 1)).slice(-4), r[0], r[1], r[2], r[3] || '', r[4] || '', '', 'OUI', r[5] || '']; });
    prod.getRange(2, 1, rows.length, 9).setValues(rows);
  }
  ['Stock', 'A_acheter', 'Journalier', 'Mensuel'].forEach(function (n) { if (!ss.getSheetByName(n)) { ss.insertSheet(n); created.push(n); } });
  if (created.indexOf('Stock') >= 0) buildStockSheet_(ss.getSheetByName('Stock'));
  if (created.indexOf('A_acheter') >= 0) buildToBuySheet_(ss.getSheetByName('A_acheter'));
  if (created.indexOf('Journalier') >= 0) buildPeriodSheet_(ss.getSheetByName('Journalier'), 'Date', false);
  if (created.indexOf('Mensuel') >= 0) buildPeriodSheet_(ss.getSheetByName('Mensuel'), 'Mois', true);
  return created;
}

function buildStockSheet_(sh) {
  var head = ['ID', 'Produit', 'Catégorie', 'Unité', 'Entrées (achats + stock initial)', 'Sorties (ventes)', 'Pertes', 'Stock actuel',
    'Coût moyen d\'achat (FCFA)', 'Valeur du stock (FCFA)', 'Seuil d\'alerte', 'Statut'];
  sh.getRange(1, 1, 1, head.length).setValues([head]).setBackground(HEAD_BG).setFontColor(HEAD_FG).setFontWeight('bold').setWrap(true);
  sh.setFrozenRows(1);
  var N = 600, f = [];
  for (var r = 2; r <= N + 1; r++) {
    f.push([
      '=IF(Produits!A' + r + '="","",Produits!A' + r + ')', '=IF($A' + r + '="","",Produits!C' + r + ')',
      '=IF($A' + r + '="","",Produits!B' + r + ')', '=IF($A' + r + '="","",Produits!D' + r + ')',
      '=IF($A' + r + '="","",SUMIF(Achats!$C:$C,$A' + r + ',Achats!$E:$E)+SUMIF(Ajustements!$C:$C,$A' + r + ',Ajustements!$E:$E))',
      '=IF($A' + r + '="","",SUMIF(Ventes!$C:$C,$A' + r + ',Ventes!$F:$F))',
      '=IF($A' + r + '="","",SUMIF(Pertes!$C:$C,$A' + r + ',Pertes!$E:$E))',
      '=IF($A' + r + '="","",E' + r + '-F' + r + '-G' + r + ')',
      '=IF($A' + r + '="","",IFERROR((SUMIF(Achats!$C:$C,$A' + r + ',Achats!$G:$G)+SUMIF(Ajustements!$C:$C,$A' + r + ',Ajustements!$H:$H))/(SUMIF(Achats!$C:$C,$A' + r + ',Achats!$E:$E)+SUMIFS(Ajustements!$E:$E,Ajustements!$C:$C,$A' + r + ',Ajustements!$G:$G,">0")),N(Produits!E' + r + ')))',
      '=IF($A' + r + '="","",MAX(H' + r + ',0)*I' + r + ')',
      '=IF($A' + r + '="","",N(Produits!G' + r + '))',
      '=IF($A' + r + '="","",IF(AND(E' + r + '=0,F' + r + '=0,G' + r + '=0),"-",IF(H' + r + '<=0,"Rupture",IF(AND(K' + r + '>0,H' + r + '<=K' + r + '),"Stock bas","OK"))))'
    ]);
  }
  sh.getRange(2, 1, N, 12).setFormulas(f);
  sh.getRange(2, 9, N, 2).setNumberFormat('#,##0');
  var rules = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Rupture').setBackground('#f8c9c4').setRanges([sh.getRange('L2:L' + (N + 1))]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Stock bas').setBackground('#fde6b3').setRanges([sh.getRange('L2:L' + (N + 1))]).build()
  ];
  sh.setConditionalFormatRules(rules);
  sh.getRange('N1').setValue('Feuille calculée automatiquement : ne rien saisir ici.').setFontStyle('italic');
}

/** Liste simple (basée sur les seuils d'alerte) ; les prévisions complètes sont dans l'application. */
function buildToBuySheet_(sh) {
  var head = ['Produit', 'Catégorie', 'Unité', 'Stock actuel', "Seuil d'alerte", 'Statut'];
  sh.getRange(1, 1, 1, head.length).setValues([head]).setBackground(HEAD_BG).setFontColor(HEAD_FG).setFontWeight('bold').setWrap(true);
  sh.setFrozenRows(1);
  sh.getRange('A2').setFormula('=IFERROR(FILTER({Stock!B2:B,Stock!C2:C,Stock!D2:D,Stock!H2:H,Stock!K2:K,Stock!L2:L},(Stock!L2:L="Rupture")+(Stock!L2:L="Stock bas")),"Rien à acheter pour l\'instant")');
  sh.getRange('H1').setValue('Liste calculée automatiquement à partir des seuils. Les prévisions fondées sur vos ventes sont dans l\'application (Stock > À acheter).').setFontStyle('italic');
}

function buildPeriodSheet_(sh, firstLabel, monthly) {
  var head = [firstLabel, 'Chiffre d\'affaires (FCFA)', 'Bénéfice brut (FCFA)', 'Dépenses (FCFA)', 'Pertes (FCFA)', 'Bénéfice net (FCFA)', 'Achats (FCFA)', 'Lignes vendues'];
  sh.getRange(1, 1, 1, head.length).setValues([head]).setBackground(HEAD_BG).setFontColor(HEAD_FG).setFontWeight('bold').setWrap(true);
  sh.setFrozenRows(1);
  var all = '{Ventes!B2:B;Depenses!B2:B;Pertes!B2:B;Achats!B2:B}';
  var key = monthly ? 'ARRAYFORMULA(LEFT(FILTER(' + all + ',' + all + '<>""),7))' : 'FILTER(' + all + ',' + all + '<>"")';
  sh.getRange('A2').setFormula('=IFERROR(SORT(UNIQUE(' + key + '),1,FALSE),"")');
  var N = monthly ? 120 : 800, f = [];
  var m = monthly ? '&"*"' : '';
  for (var r = 2; r <= N + 1; r++) {
    f.push([
      '=IF($A' + r + '="","",SUMIF(Ventes!$B:$B,$A' + r + m + ',Ventes!$H:$H))',
      '=IF($A' + r + '="","",SUMIF(Ventes!$B:$B,$A' + r + m + ',Ventes!$J:$J))',
      '=IF($A' + r + '="","",SUMIF(Depenses!$B:$B,$A' + r + m + ',Depenses!$E:$E))',
      '=IF($A' + r + '="","",SUMIF(Pertes!$B:$B,$A' + r + m + ',Pertes!$H:$H))',
      '=IF($A' + r + '="","",C' + r + '-D' + r + '-E' + r + ')',
      '=IF($A' + r + '="","",SUMIF(Achats!$B:$B,$A' + r + m + ',Achats!$G:$G))',
      '=IF($A' + r + '="","",COUNTIF(Ventes!$B:$B,$A' + r + m + '))'
    ]);
  }
  sh.getRange(2, 2, N, 7).setFormulas(f);
  sh.getRange(2, 2, N, 6).setNumberFormat('#,##0');
  sh.getRange('J1').setValue('Feuille calculée automatiquement : ne rien saisir ici.').setFontStyle('italic');
}
