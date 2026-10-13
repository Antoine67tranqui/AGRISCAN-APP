/** Store en mémoire (tests Node et mode démo navigateur). Même interface que SheetStore_. */
function MemoryStore_(initial, onChange) {
  this.db = initial || {};
  this.onChange = onChange || function () {};
  Object.keys(SCHEMA).forEach(function (t) { if (!this.db[t]) this.db[t] = []; }, this);
}
MemoryStore_.prototype.all = function (t) { return this.db[t].map(function (o) { return Object.assign({}, o); }); };
MemoryStore_.prototype.append = function (t, o) { this.db[t].push(Object.assign({}, o)); this.onChange(this.db); };
MemoryStore_.prototype.find_ = function (t, id) {
  for (var i = 0; i < this.db[t].length; i++) if (String(this.db[t][i].id) === String(id)) return i;
  throw new Error('Enregistrement introuvable : ' + id);
};
MemoryStore_.prototype.remove = function (t, id) { this.db[t].splice(this.find_(t, id), 1); this.onChange(this.db); };
MemoryStore_.prototype.update = function (t, id, patch) {
  var o = this.db[t][this.find_(t, id)];
  SCHEMA[t].forEach(function (c) { if (!c.formula && c.key !== 'id' && Object.prototype.hasOwnProperty.call(patch, c.key)) o[c.key] = patch[c.key]; });
  this.onChange(this.db);
};
MemoryStore_.prototype.lock = function (fn) { return fn(); };
function seedProducts_() {
  return CATALOGUE.map(function (r, i) { return { id: 'P' + ('000' + (i + 1)).slice(-4), categorie: r[0], nom: r[1], unite: r[2], prixAchat: '', prixVente: '', seuil: '', actif: 'OUI' }; });
}
if (typeof module !== 'undefined') module.exports = { MemoryStore_: MemoryStore_, seedProducts_: seedProducts_ };
