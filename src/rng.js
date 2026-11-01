'use strict';
// Serverio atsitiktiniai skaičiai: tik crypto.randomInt (kriptografiškai saugus).
const crypto = require('crypto');

function int(n) {
  return crypto.randomInt(n);
}

// Pasirenka elementą pagal sveikųjų skaičių svorius: [[reikšmė, svoris], ...]
function weighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = int(total);
  for (const p of pairs) {
    if (r < p[1]) return p[0];
    r -= p[1];
  }
  return pairs[pairs.length - 1][0];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function token() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { int, weighted, shuffle, token };
