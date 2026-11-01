'use strict';
// Visos sumos – sveiki centai. 10 000,00 € = 1 000 000 centų.
const START_BALANCE = 1000000;
const TOPUP_MAX = 100000000; // vienu kartu iki 1 000 000,00 €
const BALANCE_CAP = 100000000000; // 1 000 000 000,00 € – apsauga nuo per didelių skaičių

function fmt(c) {
  const neg = c < 0;
  c = Math.abs(Math.round(c));
  const eur = Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return (neg ? '-' : '') + eur + ',' + String(c % 100).padStart(2, '0') + '\u00a0€';
}

function isCents(x) {
  return Number.isSafeInteger(x) && x > 0;
}

module.exports = { START_BALANCE, TOPUP_MAX, BALANCE_CAP, fmt, isCents };
