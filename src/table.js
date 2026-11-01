'use strict';
// Bendras kelių žaidėjų stalo pagrindas: statymų fazė su laikmačiu, „pasiruošęs“,
// statymo kartojimas, raundo eiga. Konkretūs žaidimai paveldi ir aprašo play().
const { isCents } = require('./money');
const rng = require('./rng');
// Testams galima pagreitinti laiką: KAZINO_TIME_SCALE=0.05
const SCALE = Number(process.env.KAZINO_TIME_SCALE) || 1;

class RoundTable {
  constructor(room, id, betMs) {
    this.room = room;
    this.id = id;
    this.betMs = betMs;
    this.phase = 'betting';
    this.bets = new Map(); // vardas -> { raktas: centai }
    this.lastBets = new Map();
    this.ready = new Set();
    this.deadline = 0;
    this.timer = null;
    this.history = [];
    this.round = 0;
    this.dead = false;
    this.escrow = new Map(); // vardas -> šiam raundui nurašyta suma (DB: open_bets)
    this.roundKey = this.newRoundKey();
  }

  newRoundKey() {
    return this.id + ':' + Date.now().toString(36) + ':' + rng.token().slice(0, 10);
  }

  // Perrašoma: grąžina klaidos tekstą arba null.
  checkBet(_name, _key, _amount, _cur) {
    return null;
  }

  total(b) {
    return b ? Object.values(b).reduce((s, x) => s + x, 0) : 0;
  }

  placeBet(name, key, amount) {
    if (this.phase !== 'betting') return 'Statymai šiuo metu uždaryti';
    if (typeof key !== 'string' || !this.validKey(key)) return 'Neteisingas statymas';
    if (!isCents(amount)) return 'Neteisinga suma';
    const cur = this.bets.get(name) || {};
    const err = this.checkBet(name, key, amount, cur);
    if (err) return err;
    if (!this.room.debit(name, { [key]: amount }, this)) return 'Nepakanka balanso';
    cur[key] = (cur[key] || 0) + amount;
    this.bets.set(name, cur);
    this.ready.delete(name);
    this.arm();
    this.room.changed();
    return null;
  }

  clearBets(name) {
    if (this.phase !== 'betting') return 'Statymai šiuo metu uždaryti';
    const b = this.bets.get(name);
    if (!b) return null;
    this.room.refundBets(name, this);
    this.bets.delete(name);
    this.ready.delete(name);
    if (this.bets.size === 0) this.disarm();
    else this.checkAllReady();
    this.room.changed();
    return null;
  }

  rebet(name) {
    if (this.phase !== 'betting') return 'Statymai šiuo metu uždaryti';
    if (this.bets.has(name)) return 'Pirmiausia išvalyk dabartinius statymus';
    const lb = this.lastBets.get(name);
    if (!lb) return 'Ankstesnio statymo nėra';
    if (!this.room.debit(name, lb, this)) return 'Nepakanka balanso';
    this.bets.set(name, { ...lb });
    this.arm();
    this.room.changed();
    return null;
  }

  setReady(name) {
    if (this.phase !== 'betting') return 'Statymai šiuo metu uždaryti';
    if (!this.bets.has(name)) return 'Pirmiausia padėk statymą';
    this.ready.add(name);
    this.room.changed();
    this.checkAllReady();
    return null;
  }

  checkAllReady() {
    if (this.bets.size === 0) return;
    for (const n of this.bets.keys()) if (!this.ready.has(n) && this.room.isConnected(n)) return;
    this.begin();
  }

  arm() {
    if (this.timer) return;
    const ms = Math.round(this.betMs * SCALE);
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(() => this.begin(), ms);
  }

  disarm() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = 0;
  }

  begin() {
    if (this.phase !== 'betting' || this.dead) return;
    this.disarm();
    if (this.bets.size === 0) return;
    this.ready.clear();
    for (const [n, b] of this.bets) this.lastBets.set(n, { ...b });
    this.round += 1;
    Promise.resolve(this.play()).catch((e) => {
      console.error('Raundo klaida', this.id, e);
      this.refundAll();
      this.finish();
    });
  }

  refundAll() {
    this.room.refundRound(this);
  }

  sleep(ms, phase) {
    ms = Math.round(ms * SCALE);
    if (phase) this.phase = phase;
    this.deadline = Date.now() + ms;
    this.room.changed();
    return new Promise((res) => {
      this.timer = setTimeout(() => {
        this.timer = null;
        res();
      }, ms);
    });
  }

  addHistory(item) {
    this.history.unshift(item);
    if (this.history.length > 20) this.history.length = 20;
  }

  finish() {
    const names = [...this.bets.keys()];
    this.roundKey = this.newRoundKey();
    this.escrow.clear();
    this.bets.clear();
    this.ready.clear();
    this.phase = 'betting';
    this.deadline = 0;
    this.timer = null;
    this.room.changed();
    this.room.afterRound(this, names);
  }

  baseState() {
    const bets = {};
    for (const [n, b] of this.bets) bets[n] = b;
    return {
      phase: this.phase,
      remainingMs: this.deadline ? Math.max(0, this.deadline - Date.now()) : 0,
      bets,
      ready: [...this.ready],
      history: this.history,
      round: this.round,
    };
  }

  destroy() {
    this.dead = true;
    this.disarm();
  }
}

module.exports = { RoundTable };
