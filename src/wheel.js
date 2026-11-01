'use strict';
// Laimės ratas: 54 segmentai, daugiklio langelis ir 4 bonusų raundai.
// Lentelės perkeltos iš kanvos versijos ir suderintos ~95 % grąžinimui kiekvienam statymui.
const { RoundTable } = require('./table');
const rng = require('./rng');

const LT = [
  { key: 'n1', label: '1', name: '1', color: '#2f6fd6', count: 21, q: 102 },
  { key: 'n2', label: '2', name: '2', color: '#d9a514', count: 13, q: 110 },
  { key: 'n5', label: '5', name: '5', color: '#d9343f', count: 7, q: 62 },
  { key: 'n10', label: '10', name: '10', color: '#8a3fd1', count: 4, q: 42 },
  { key: 'coin', label: '🪙', name: 'Monetos metimas', color: '#1f9a57', count: 4, q: 110 },
  { key: 'plinko', label: '🔻', name: 'Kamuoliuko kritimas', color: '#e07a1f', count: 2, q: 110 },
  { key: 'hunt', label: '🎯', name: 'Lobių paieška', color: '#1a9fc9', count: 2, q: 110 },
  { key: 'big', label: '🎡', name: 'Didysis ratas', color: '#d23a7a', count: 1, q: 110 },
];
const LT_NONE_Q = 244; // iš 1000: daugiklio langelis nieko nepažymi
const LT_SEQ = ['big', 'n2', 'n1', 'coin', 'n1', 'n5', 'n2', 'hunt', 'n1', 'n2', 'n10', 'n1', 'n1', 'n5', 'n2', 'n1', 'coin', 'n1', 'n2', 'n1', 'plinko', 'n5', 'n2', 'n1', 'n10', 'n1', 'n2', 'n1', 'n5', 'n1', 'coin', 'n2', 'n1', 'n1', 'hunt', 'n2', 'n5', 'n10', 'n2', 'n1', 'n1', 'n1', 'n1', 'n2', 'coin', 'n5', 'n1', 'plinko', 'n2', 'n1', 'n10', 'n5', 'n2', 'n1'];
const LT_TOPM = [[2, 40], [3, 25], [5, 17], [10, 12], [25, 5], [50, 1]];
const LT_COIN = [2, 3, 4, 5, 5, 6, 8, 10, 10, 12, 15, 16];
const LT_ROWS = 12;
const LT_PL = [500, 100, 50, 25, 20, 11, 11, 11, 20, 25, 50, 100, 500];
const LT_HUNT = [5, 5, 5, 7, 7, 7, 10, 10, 10, 10, 15, 15, 15, 20, 20, 25, 25, 30, 42, 50];
const LT_BIG = [10, 25, 15, 40, 20, 10, 30, 0, 15, 50, 20, 25, 10, 60, 15, 40, 20, 75, 25, 30, 40, 100, 50, 25]; // 0 = „×2 ir sukama dar kartą“
const KEYS = LT.map((x) => x.key);
const NUM = { n1: 1, n2: 2, n5: 5, n10: 10 };

function info(k) {
  return LT.find((x) => x.key === k);
}

function genTop() {
  const pairs = LT.map((x) => [x.key, x.q]).concat([[null, LT_NONE_Q]]);
  const key = rng.weighted(pairs);
  if (!key) return null;
  return { key, m: rng.weighted(LT_TOPM) };
}

function genBigSpins() {
  const s = [];
  for (let k = 0; k < 30; k++) {
    const i = rng.int(24);
    s.push(i);
    if (LT_BIG[i] !== 0) break;
  }
  return s;
}

function bigValue(spins) {
  const last = LT_BIG[spins[spins.length - 1]];
  return (last === 0 ? 10 : last) * Math.pow(2, spins.length - 1);
}

function genBonus(k) {
  if (k === 'coin') return { kind: 'coin', a: LT_COIN[rng.int(12)], b: LT_COIN[rng.int(12)], side: rng.int(2) };
  if (k === 'plinko') return { kind: 'plinko', path: Array.from({ length: LT_ROWS }, () => rng.int(2)) };
  if (k === 'hunt') return { kind: 'hunt', tiles: rng.shuffle(LT_HUNT) };
  if (k === 'big') return { kind: 'big', spins: genBigSpins() };
  return null;
}

function bonusX(b, pick) {
  if (b.kind === 'coin') return b.side === 0 ? b.a : b.b;
  if (b.kind === 'plinko') return LT_PL[b.path.reduce((s, x) => s + x, 0)];
  if (b.kind === 'hunt') return b.tiles[pick];
  return bigValue(b.spins);
}

function bonusEv(k) {
  if (k === 'coin') return LT_COIN.reduce((s, x) => s + x, 0) / 12;
  if (k === 'plinko') {
    let s = 0;
    let c = 1;
    for (let i = 0; i <= LT_ROWS; i++) {
      s += c * LT_PL[i];
      c = (c * (LT_ROWS - i)) / (i + 1);
    }
    return s / Math.pow(2, LT_ROWS);
  }
  if (k === 'hunt') return LT_HUNT.reduce((s, x) => s + x, 0) / LT_HUNT.length;
  return LT_BIG.reduce((s, x) => s + x, 0) / 22;
}

// Tikslus teorinis grąžinimas (išmoka su statymu).
function rtp(k) {
  const inf = info(k);
  const p = inf.count / 54;
  const q = inf.q / 1000;
  const tw = LT_TOPM.reduce((s, x) => s + x[1], 0);
  const d = LT_TOPM.reduce((s, x) => s + x[0] * x[1], 0) / tw - 1;
  const x = NUM[k] || bonusEv(k);
  return p * (x + 1) + p * q * x * d;
}

function bonusMs(b) {
  if (b.kind === 'coin') return 5500;
  if (b.kind === 'plinko') return 600 + (LT_ROWS + 1) * 230 + 2200;
  if (b.kind === 'big') return 500 + b.spins.length * 4300 + 1500;
  return 0;
}

class WheelTable extends RoundTable {
  constructor(room) {
    super(room, 'lt', 20000);
    this.reset();
  }

  reset() {
    this.top = null;
    this.idx = null;
    this.result = null;
    this.bonus = null;
    this.picks = {};
    this.revealed = false;
    this.payouts = {};
    this.pickWaiters = null;
  }

  validKey(k) {
    return KEYS.includes(k);
  }

  pick(name, i) {
    if (this.phase !== 'hunt-pick' || !this.bonus || this.bonus.kind !== 'hunt') return 'Dabar rinktis negalima';
    const b = this.bets.get(name);
    if (!b || !b.hunt) return 'Renkasi tik statę ant „Lobių paieškos“';
    if (!Number.isInteger(i) || i < 0 || i >= 20) return 'Neteisinga skrynia';
    if (this.picks[name] !== undefined) return 'Jau pasirinkai';
    this.picks[name] = i;
    this.room.changed();
    const need = [...this.bets].filter(([n, x]) => x.hunt && this.room.isConnected(n)).map(([n]) => n);
    if (need.every((n) => this.picks[n] !== undefined) && this.pickWaiters) this.pickWaiters();
    return null;
  }

  async play() {
    this.reset();
    const top = genTop();
    await this.sleep(1600, 'top');
    this.top = top;
    await this.sleep(900, 'top-done');
    const idx = rng.int(54);
    const key = LT_SEQ[idx];
    this.idx = idx;
    await this.sleep(5200, 'spinning');
    this.result = key;
    let common = NUM[key] || 0;
    if (!NUM[key]) {
      const b = genBonus(key);
      if (b.kind === 'hunt') {
        this.bonus = { kind: 'hunt' };
        const hasBettor = [...this.bets.values()].some((x) => x.hunt);
        await new Promise((res) => {
          this.pickWaiters = res;
          this.sleep(hasBettor ? 15000 : 2500, 'hunt-pick').then(res);
        });
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.pickWaiters = null;
        this.hunt = b.tiles;
        for (const [n, x] of this.bets) if (x.hunt && this.picks[n] === undefined) this.picks[n] = rng.int(20);
        this.bonus = { kind: 'hunt', tiles: b.tiles, defaultPick: rng.int(20) };
        this.revealed = true;
        common = b.tiles[this.bonus.defaultPick];
        this.settle(key, (name) => b.tiles[this.picks[name]]);
        await this.sleep(5000, 'bonus');
      } else {
        this.bonus = b;
        common = bonusX(b);
        await this.sleep(bonusMs(b), 'bonus');
        this.settle(key, () => common);
      }
    } else {
      this.settle(key, () => common);
    }
    const m = this.top && this.top.key === key ? this.top.m : 1;
    this.addHistory({ key, x: common * m });
    this.room.log('Laimės ratas: ' + info(key).name + (m > 1 ? ' ×' + m : ''));
    await this.sleep(5000, 'result');
    this.finish();
  }

  settle(key, xFor) {
    const m = this.top && this.top.key === key ? this.top.m : 1;
    for (const [name, b] of this.bets) {
      const amt = b[key] || 0;
      const ret = amt > 0 ? amt * (xFor(name) * m + 1) : 0;
      this.payouts[name] = { staked: this.total(b), ret };
    }
    this.room.settleRound(this, this.payouts);
    this.room.changed();
  }

  state() {
    return {
      ...this.baseState(),
      top: this.top,
      idx: this.idx,
      result: this.result,
      bonus: this.bonus,
      picks: this.picks,
      payouts: this.payouts,
    };
  }
}

module.exports = { WheelTable, LT, LT_SEQ, LT_TOPM, LT_COIN, LT_PL, LT_HUNT, LT_BIG, LT_ROWS, genTop, genBonus, bonusX, rtp, bonusEv, info };
