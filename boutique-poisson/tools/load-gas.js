/** Charge les fichiers .gs dans un contexte vm (équivalent minimal de Apps Script). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'apps-script');
module.exports = function load(extra) {
  const ctx = vm.createContext(Object.assign({ console, Date, Math, JSON, Object, Array, Number, String, Error, RegExp, Intl, parseInt, parseFloat, isFinite }, extra || {}));
  ['Catalog.gs', 'Core.gs', 'Code.gs'].forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'memory-store.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, ''), ctx, { filename: 'memory-store.js' });
  return ctx;
};
