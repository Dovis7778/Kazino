'use strict';
// Kelių žaidėjų blackjack: 6 kaladžių batas, dalintojas stovi ant minkštų 17 (S17),
// blackjack moka 3:2, dvigubinimas ant pirmų dviejų kortų, vienas skaidymas,
// šalutiniai statymai Perfect Pairs ir 21+3.
const { RoundTable } = require('./table');
const rng = require('./rng');

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const TURN_MS = 25000;

function newShoe() {
  const cards = [];
  for (let d = 0; d < 6; d++) for (const s of SUITS) for (const r of RANKS) cards.push({ r, s });
  return rng.shuffle(cards);
}

function cardVal(c) {
  if (c.r === 'A') return 1;
  if (c.r === 'J' || c.r === 'Q' || c.r === 'K') return 10;
  return Number(c.r);
}

function handValue(cards) {
  let t = 0;
  let ace = false;
  for (const c of cards) {
    t += cardVal(c);
    if (c.r === 'A') ace = true;
  }
  const soft = ace && t + 10 <= 21;
  return { total: soft ? t + 10 : t, soft };
}

const red = (s) => s === '♥' || s === '♦';

function ppEval(a, b) {
  if (a.r !== b.r) return ['Poros nėra', 0];
  if (a.s === b.s) return ['Tobula pora', 25];
  if (red(a.s) === red(b.s)) return ['Spalvota pora', 12];
  return ['Mišri pora', 5];
}

function t3Eval(cs) {
  const r = cs.map((c) => RANKS.indexOf(c.r)).sort((x, y) => x - y);
  const fl = cs[0].s === cs[1].s && cs[1].s === cs[2].s;
  const trips = r[0] === r[2];
  const st = (r[1] === r[0] + 1 && r[2] === r[1] + 1) || (r[0] === 0 && r[1] === 11 && r[2] === 12);
  if (trips && fl) return ['Trys vienodi vienos masties', 100];
  if (st && fl) return ['Vienos masties eilė', 40];
  if (trips) return ['Trys vienodi', 30];
  if (st) return ['Eilė', 10];
  if (fl) return ['Ta pati masti', 5];
  return ['Derinio nėra', 0];
}

class BlackjackTable extends RoundTable {
  constructor(room, num) {
    super(room, 'bj' + num, 20000);
    this.num = num;
    this.title = 'Stalas ' + num;
    this.seated = new Set();
    this.shoe = newShoe();
    this.seats = [];
    this.dealer = [];
    this.holeHidden = true;
    this.turn = null;
    this.turnResolve = null;
    this.message = '';
  }

  validKey(k) {
    return k === 'main' || k === 'pp' || k === 't3';
  }

  checkBet(name, key, _amount, cur) {
    if (!this.seated.has(name)) return 'Pirmiausia atsisėsk prie šio stalo';
    if (key !== 'main' && !cur.main) return 'Šalutinis statymas galimas tik su pagrindiniu statymu';
    return null;
  }

  draw() {
    if (this.shoe.length === 0) this.shoe = newShoe();
    return this.shoe.pop();
  }

  async play() {
    if (this.shoe.length < 78) {
      this.shoe = newShoe();
      this.message = 'Batas sumaišytas iš naujo';
    } else this.message = '';
    this.payouts = {};
    this.dealer = [];
    this.holeHidden = true;
    this.seats = [...this.bets].map(([name, b]) => ({
      name,
      main: b.main,
      pp: b.pp || 0,
      t3: b.t3 || 0,
      hands: [{ cards: [], bet: b.main, done: false, doubled: false, split: false, result: null, ret: 0 }],
      side: [],
      ret: 0,
    }));
    // Dalijimas: po kortą kiekvienam, dalintojui, vėl kiekvienam, dalintojui (paslėpta).
    for (let round = 0; round < 2; round++) {
      for (const s of this.seats) {
        s.hands[0].cards.push(this.draw());
        await this.sleep(350, 'dealing');
      }
      this.dealer.push(this.draw());
      await this.sleep(350, 'dealing');
    }
    // Šalutiniai statymai.
    for (const s of this.seats) {
      const [c1, c2] = s.hands[0].cards;
      if (s.pp) {
        const e = ppEval(c1, c2);
        const ret = e[1] ? s.pp * (e[1] + 1) : 0;
        s.side.push({ type: 'Perfect Pairs', bet: s.pp, label: e[0], mult: e[1], ret });
        s.ret += ret;
      }
      if (s.t3) {
        const e = t3Eval([c1, c2, this.dealer[0]]);
        const ret = e[1] ? s.t3 * (e[1] + 1) : 0;
        s.side.push({ type: '21+3', bet: s.t3, label: e[0], mult: e[1], ret });
        s.ret += ret;
      }
      // Šalutiniai statymai išmokami iškart (atskira transakcija).
      if (s.pp || s.t3) this.room.creditSide(s.name, this, s.ret, s.pp + s.t3);
    }
    const up = cardVal(this.dealer[0]);
    const dealerBJ = handValue(this.dealer).total === 21;
    if ((up === 1 || up === 10) && dealerBJ) {
      this.holeHidden = false;
      this.message = 'Dalintojas turi blackjack';
      await this.sleep(1200, 'dealer');
    } else {
      for (const s of this.seats) {
        for (let h = 0; h < s.hands.length; h++) {
          const hand = s.hands[h];
          if (handValue(hand.cards).total === 21) {
            hand.done = true;
            continue;
          }
          while (!hand.done) {
            this.turn = { name: s.name, hand: h };
            const connected = this.room.isConnected(s.name);
            const act = await new Promise((res) => {
              this.turnResolve = res;
              this.sleep(connected ? TURN_MS : 1500, 'turn').then(() => res('timeout'));
            });
            if (this.timer) clearTimeout(this.timer);
            this.timer = null;
            this.turnResolve = null;
            if (act === 'timeout') hand.done = true;
            this.room.changed();
          }
        }
      }
      this.turn = null;
      this.holeHidden = false;
      await this.sleep(700, 'dealer');
      const live = this.seats.some((s) => s.hands.some((h) => handValue(h.cards).total <= 21 && !(this.isNatural(s, h))));
      if (live) {
        while (handValue(this.dealer).total < 17) {
          this.dealer.push(this.draw());
          await this.sleep(650, 'dealer');
        }
      }
    }
    this.settle(dealerBJ);
    const dv = handValue(this.dealer).total;
    this.addHistory({ dealer: dealerBJ && this.dealer.length === 2 ? 'BJ' : dv > 21 ? 'Perteklius' : String(dv) });
    this.room.log('Blackjack: dalintojas ' + (dealerBJ ? 'blackjack' : dv > 21 ? 'viršijo 21' : 'turi ' + dv));
    await this.sleep(6000, 'result');
    this.seats = [];
    this.dealer = [];
    this.turn = null;
    this.finish();
  }

  isNatural(seat, hand) {
    return seat.hands.length === 1 && hand.cards.length === 2 && handValue(hand.cards).total === 21;
  }

  // Žaidėjo veiksmas jo eilėje: hit / stand / double / split.
  act(name, action) {
    if (this.phase !== 'turn' || !this.turn || this.turn.name !== name || !this.turnResolve) return 'Ne tavo eilė';
    const seat = this.seats.find((s) => s.name === name);
    const hand = seat.hands[this.turn.hand];
    if (action === 'hit') {
      hand.cards.push(this.draw());
      const nv = handValue(hand.cards).total;
      if (nv >= 21) hand.done = true;
    } else if (action === 'stand') {
      hand.done = true;
    } else if (action === 'double') {
      if (hand.cards.length !== 2) return 'Dvigubinti galima tik su dviem kortomis';
      if (!this.room.debit(name, { main: hand.bet }, this)) return 'Nepakanka balanso dvigubinti';
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(this.draw());
      hand.done = true;
    } else if (action === 'split') {
      if (seat.hands.length !== 1 || hand.cards.length !== 2 || cardVal(hand.cards[0]) !== cardVal(hand.cards[1])) return 'Skaidyti negalima';
      if (!this.room.debit(name, { main: hand.bet }, this)) return 'Nepakanka balanso skaidyti';
      const aces = hand.cards[0].r === 'A';
      const second = { cards: [hand.cards.pop(), this.draw()], bet: hand.bet, done: aces, doubled: false, split: true, result: null, ret: 0 };
      hand.cards.push(this.draw());
      hand.split = true;
      if (aces) hand.done = true;
      seat.hands.push(second);
    } else return 'Nežinomas veiksmas';
    const res = this.turnResolve;
    res(action);
    return null;
  }

  settle(dealerBJ) {
    const dv = handValue(this.dealer).total;
    const dealerNatural = dealerBJ && this.dealer.length === 2;
    for (const s of this.seats) {
      for (const h of s.hands) {
        const pv = handValue(h.cards).total;
        const nat = this.isNatural(s, h);
        let ret = 0;
        let result;
        if (dealerNatural) {
          if (nat) { ret = h.bet; result = 'Lygiosios'; } else result = 'Pralaimėta';
        } else if (pv > 21) result = 'Perteklius';
        else if (nat) { ret = h.bet + Math.floor((h.bet * 3) / 2); result = 'Blackjack 3:2'; }
        else if (dv > 21 || pv > dv) { ret = h.bet * 2; result = 'Laimėta'; }
        else if (pv === dv) { ret = h.bet; result = 'Lygiosios'; }
        else result = 'Pralaimėta';
        h.result = result;
        h.ret = ret;
        s.ret += ret;
      }
    }
    this.payouts = {};
    for (const s of this.seats) this.payouts[s.name] = { staked: s.pp + s.t3 + s.hands.reduce((a, h) => a + h.bet, 0), ret: s.ret, credit: s.hands.reduce((a, h) => a + h.ret, 0) };
    this.room.settleRound(this, this.payouts);
    this.room.changed();
  }

  state() {
    const dealer = this.dealer.map((c, i) => (i === 1 && this.holeHidden ? null : c));
    const shown = dealer.filter(Boolean);
    return {
      ...this.baseState(),
      seats: this.seats.map((s) => ({
        name: s.name,
        main: s.main,
        pp: s.pp,
        t3: s.t3,
        side: s.side,
        ret: s.ret,
        hands: s.hands.map((h) => ({ ...h, value: handValue(h.cards) })),
      })),
      dealer,
      dealerValue: shown.length ? handValue(shown) : null,
      turn: this.turn,
      shoeLeft: this.shoe.length,
      message: this.message,
      payouts: this.payouts || {},
    };
  }
}

module.exports = { BlackjackTable, handValue, ppEval, t3Eval, cardVal, newShoe };
