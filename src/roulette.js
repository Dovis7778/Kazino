'use strict';
// Europietiška ruletė (vienas nulis). Grąžinimas 36/37 = 97,3 % visiems statymams.
const { RoundTable } = require('./table');
const rng = require('./rng');

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const OUTSIDE = ['red', 'black', 'odd', 'even', 'low', 'high', 'd1', 'd2', 'd3', 'c1', 'c2', 'c3'];

function validKey(k) {
  if (OUTSIDE.includes(k)) return true;
  const m = /^n(\d{1,2})$/.exec(k);
  return !!m && Number(m[1]) <= 36 && String(Number(m[1])) === m[1];
}

function wins(k, n) {
  if (k[0] === 'n' && k.length <= 3 && /^n\d+$/.test(k)) return Number(k.slice(1)) === n;
  if (n === 0) return false;
  switch (k) {
    case 'red': return RED.has(n);
    case 'black': return !RED.has(n);
    case 'odd': return n % 2 === 1;
    case 'even': return n % 2 === 0;
    case 'low': return n <= 18;
    case 'high': return n >= 19;
    case 'd1': return n <= 12;
    case 'd2': return n >= 13 && n <= 24;
    case 'd3': return n >= 25;
    case 'c1': return n % 3 === 1;
    case 'c2': return n % 3 === 2;
    case 'c3': return n % 3 === 0;
  }
  return false;
}

function mult(k) {
  if (/^n\d+$/.test(k)) return 35;
  if (k[0] === 'd' || k[0] === 'c') return 2;
  return 1;
}

class RouletteTable extends RoundTable {
  constructor(room) {
    super(room, 'rl', 20000);
    this.result = null;
    this.payouts = {};
  }

  validKey(k) {
    return validKey(k);
  }

  async play() {
    const n = rng.int(37);
    this.result = null;
    this.payouts = {};
    this.spinTo = n;
    await this.sleep(7000, 'spinning');
    this.result = n;
    for (const [name, b] of this.bets) {
      let ret = 0;
      for (const k of Object.keys(b)) if (wins(k, n)) ret += b[k] * (mult(k) + 1);
      this.payouts[name] = { staked: this.total(b), ret };
    }
    this.room.settleRound(this, this.payouts);
    this.addHistory({ n, color: n === 0 ? 'green' : RED.has(n) ? 'red' : 'black' });
    this.room.log('Ruletė: iškrito ' + n);
    await this.sleep(5000, 'result');
    this.spinTo = null;
    this.finish();
  }

  state() {
    return { ...this.baseState(), spinTo: this.spinTo ?? null, result: this.result, payouts: this.payouts };
  }
}

module.exports = { RouletteTable, RED, WHEEL_ORDER, wins, mult, validKey };
