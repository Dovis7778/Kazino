'use strict';
// Vienas bendras kazino: visi žaidėjai, bendri stalai, pokalbis, lyderiai.
// Balansai laikomi atmintyje (greičiui) ir KIEKVIENAS pakeitimas iškart rašomas į DB
// transakcija. Statymai, kol raundas neišspręstas, saugomi lentelėje open_bets –
// jei serveris nukrenta, kitą kartą paleidus jie grąžinami žaidėjams.
const { START_BALANCE, BALANCE_CAP } = require('./money');
const { loadFeed, byId } = require('./skins');
const { BlackjackTable } = require('./blackjack');
const { RouletteTable } = require('./roulette');
const { WheelTable } = require('./wheel');

const BJ_SEATS = 7;
const CHAT_KEEP = 100;

class Casino {
  constructor(db, emit) {
    this.db = db;
    this.emit = emit; // (casino) => void
    this.users = new Map(); // nick_lc -> vartotojas atmintyje
    this.chat = [];
    this.leaders = [];
    this.leadersWin = [];
    this.leadersInv = [];
    this.skinFeed = [];
    this.pending = null;
    this.leadersTimer = null;
    this.rl = new RouletteTable(this);
    this.lt = new WheelTable(this);
    this.bj = [new BlackjackTable(this, 1)];
  }

  // Paleidžiant: grąžinami visi neužbaigtų raundų statymai.
  async init() {
    const open = await this.db.get('SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS s FROM open_bets');
    if (open && Number(open.n) > 0) {
      await this.db.tx([
        ['UPDATE users SET balance = balance + COALESCE((SELECT SUM(o.amount) FROM open_bets o WHERE o.user_id = users.id), 0) WHERE id IN (SELECT user_id FROM open_bets)'],
        ['DELETE FROM open_bets'],
      ]);
      console.log('Grąžinti neužbaigti statymai: ' + open.n + ' vnt., ' + (Number(open.s) / 100).toFixed(2) + ' €');
    }
    this.refunded = open ? { count: Number(open.n), sum: Number(open.s) } : { count: 0, sum: 0 };
    this.skinFeed = await loadFeed(this.db);
    await this.refreshLeaders();
  }

  /* ---------- vartotojai atmintyje ---------- */

  key(name) {
    return name.toLowerCase();
  }
  get(name) {
    return this.users.get(this.key(name));
  }
  // Įkelia (arba grąžina jau įkeltą) vartotoją pagal DB eilutę.
  attachRow(row) {
    let u = this.users.get(row.nick_lc);
    if (!u) {
      u = {
        id: row.id,
        name: row.nick,
        balance: row.balance,
        avatar: row.avatar,
        stats: { games: row.games_played, biggestWin: row.biggest_win, wagered: row.total_wagered },
        socketId: null,
        lastSeen: Date.now(),
        bj: null,
      };
      this.users.set(row.nick_lc, u);
    }
    return u;
  }
  isConnected(name) {
    const u = this.get(name);
    return !!(u && u.socketId);
  }
  balanceOf(name) {
    const u = this.get(name);
    return u ? u.balance : 0;
  }
  hasActiveBets(name) {
    return this.allTables().some((t) => t.bets.has(name) || t.escrow.has(name));
  }
  allTables() {
    return [this.rl, this.lt, ...this.bj];
  }
  onlineCount() {
    let n = 0;
    for (const u of this.users.values()) if (u.socketId) n++;
    return n;
  }

  connect(u, socketId) {
    u.socketId = socketId;
    u.lastSeen = Date.now();
    this.autoSeat(u);
    this.log(u.name + ' prisijungė');
  }

  disconnect(socketId) {
    for (const u of this.users.values()) {
      if (u.socketId !== socketId) continue;
      u.socketId = null;
      u.lastSeen = Date.now();
      this.log(u.name + ' atsijungė');
      for (const t of this.bj) if (t.turn && t.turn.name === u.name && t.turnResolve) t.turnResolve('timeout');
      for (const t of this.allTables()) if (t.phase === 'betting') t.checkAllReady();
      this.maybeEvict(u);
      this.db.tx([['UPDATE users SET last_seen = ? WHERE id = ?', [Date.now(), u.id]]]);
      this.changed();
      return u;
    }
    return null;
  }

  // Atsijungęs vartotojas be aktyvių statymų pašalinamas iš atminties (lieka DB).
  maybeEvict(u) {
    if (u.socketId || this.hasActiveBets(u.name)) return;
    const t = this.bjOf(u);
    if (t && !t.seats.some((s) => s.name === u.name)) {
      t.seated.delete(u.name);
      u.bj = null;
    }
    if (!u.bj) this.users.delete(this.key(u.name));
    this.cleanupTables();
  }

  /* ---------- Blackjack stalai ---------- */

  bjOf(u) {
    return u && u.bj ? this.bj.find((t) => t.num === u.bj) || null : null;
  }
  autoSeat(u) {
    if (this.bjOf(u)) return this.bjOf(u);
    const t = this.bj.find((x) => x.seated.size < BJ_SEATS) || this.newBjTable();
    t.seated.add(u.name);
    u.bj = t.num;
    return t;
  }
  newBjTable() {
    let n = 1;
    while (this.bj.some((t) => t.num === n)) n++;
    const t = new BlackjackTable(this, n);
    this.bj.push(t);
    this.bj.sort((a, b) => a.num - b.num);
    return t;
  }
  sit(u, num) {
    const cur = this.bjOf(u);
    if (cur && cur.num === num) return null;
    if (cur && (cur.bets.has(u.name) || cur.seats.some((s) => s.name === u.name))) return 'Pirmiausia užbaik raundą prie dabartinio stalo';
    let t;
    if (num === 'new') {
      if (cur) {
        cur.seated.delete(u.name);
        this.cleanupTables(); // tuščias senas stalas atlaisvina numerį
      }
      t = this.bj.find((x) => x.seated.size === 0 && x !== cur) || this.newBjTable();
    } else {
      t = this.bj.find((x) => x.num === num);
      if (!t) return 'Tokio stalo nėra';
      if (t.seated.size >= BJ_SEATS) return 'Stalas pilnas (' + BJ_SEATS + ' vietos)';
    }
    if (cur) cur.seated.delete(u.name);
    t.seated.add(u.name);
    u.bj = t.num;
    this.cleanupTables();
    this.changed();
    return null;
  }
  // Tušti papildomi stalai (ne „Stalas 1“) panaikinami.
  cleanupTables() {
    for (const t of [...this.bj]) {
      if (t.num !== 1 && t.seated.size === 0 && t.phase === 'betting' && t.bets.size === 0 && t.escrow.size === 0) {
        t.destroy();
        this.bj.splice(this.bj.indexOf(t), 1);
      }
    }
  }

  /* ---------- pinigai (visada atmintis + DB transakcija) ---------- */

  // Nurašo statymus (objektas raktas -> centai) ir įrašo juos į open_bets.
  debit(name, map, table) {
    const u = this.get(name);
    if (!u) return false;
    const total = Object.values(map).reduce((s, x) => s + x, 0);
    if (!Number.isSafeInteger(total) || total <= 0 || u.balance < total) return false;
    u.balance -= total;
    table.escrow.set(name, (table.escrow.get(name) || 0) + total);
    const now = Date.now();
    const st = [['UPDATE users SET balance = balance - ? WHERE id = ?', [total, u.id]]];
    for (const [k, v] of Object.entries(map)) st.push(['INSERT INTO open_bets (user_id, round_key, bet_key, amount, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, table.roundKey, k, v, now]]);
    this.write(st, [u]);
    this.changed();
    return true;
  }

  // Grąžina visus žaidėjo šio raundo statymus (statymų fazėje „Išvalyti“).
  refundBets(name, table) {
    const u = this.get(name);
    const amt = table.escrow.get(name) || 0;
    table.escrow.delete(name);
    if (!u || !amt) return;
    const c = this.capped(u, amt);
    u.balance += c;
    this.write([['UPDATE users SET balance = balance + ? WHERE id = ?', [c, u.id]], ['DELETE FROM open_bets WHERE round_key = ? AND user_id = ?', [table.roundKey, u.id]]], [u]);
  }

  // Blackjack šalutiniai statymai išsprendžiami iškart po dalijimo.
  creditSide(name, table, ret, sideStake) {
    const u = this.get(name);
    if (!u) return;
    table.escrow.set(name, (table.escrow.get(name) || 0) - sideStake);
    const c = this.capped(u, ret);
    u.balance += c;
    this.write([['UPDATE users SET balance = balance + ? WHERE id = ?', [c, u.id]], ["DELETE FROM open_bets WHERE round_key = ? AND user_id = ? AND bet_key IN ('pp', 't3')", [table.roundKey, u.id]]], [u]);
    this.changed();
  }

  // Raundo išsprendimas viena transakcija: išmokos, statistika, open_bets išvalymas.
  // payouts: { vardas: { staked, ret, credit? } } – credit (jei nurodyta) yra ką dar reikia įskaityti.
  settleRound(table, payouts) {
    const st = [];
    const touched = [];
    const now = Date.now();
    for (const [name, p] of Object.entries(payouts)) {
      const u = this.get(name);
      if (!u) continue;
      const c = this.capped(u, p.credit !== undefined ? p.credit : p.ret);
      u.balance += c;
      const net = p.ret - p.staked;
      u.stats.games++;
      u.stats.wagered += p.staked;
      if (net > u.stats.biggestWin) u.stats.biggestWin = net;
      st.push([
        'UPDATE users SET balance = balance + ?, games_played = games_played + 1, total_wagered = total_wagered + ?, biggest_win = CASE WHEN ? > biggest_win THEN ? ELSE biggest_win END, last_seen = ? WHERE id = ?',
        [c, p.staked, net, net, now, u.id],
      ]);
      touched.push(u);
    }
    st.push(['DELETE FROM open_bets WHERE round_key = ?', [table.roundKey]]);
    table.escrow.clear();
    this.write(st, touched);
    this.scheduleLeaders();
    this.changed();
  }

  // Klaidos atveju: grąžinama viskas, kas šiam raundui nurašyta.
  refundRound(table) {
    const st = [];
    const touched = [];
    for (const [name, amt] of table.escrow) {
      const u = this.get(name);
      if (!u || amt <= 0) continue;
      const c = this.capped(u, amt);
      u.balance += c;
      st.push(['UPDATE users SET balance = balance + ? WHERE id = ?', [c, u.id]]);
      touched.push(u);
    }
    st.push(['DELETE FROM open_bets WHERE round_key = ?', [table.roundKey]]);
    table.escrow.clear();
    this.write(st, touched);
  }

  // Kauliukai / automatas: statymas ir išmoka viena transakcija.
  soloResult(name, bet, pay) {
    const u = this.get(name);
    if (!u) return;
    u.balance -= bet;
    const c = this.capped(u, pay);
    u.balance += c;
    const net = pay - bet;
    u.stats.games++;
    u.stats.wagered += bet;
    if (net > u.stats.biggestWin) u.stats.biggestWin = net;
    this.write(
      [['UPDATE users SET balance = balance + ?, games_played = games_played + 1, total_wagered = total_wagered + ?, biggest_win = CASE WHEN ? > biggest_win THEN ? ELSE biggest_win END WHERE id = ?', [c - bet, bet, net, net, u.id]]],
      [u]
    );
    this.scheduleLeaders();
    this.changed();
  }

  topup(u, amount) {
    const c = this.capped(u, amount);
    u.balance += c;
    this.write([['UPDATE users SET balance = balance + ? WHERE id = ?', [c, u.id]]], [u]);
    this.scheduleLeaders();
    this.changed();
  }

  resetBalance(u) {
    u.balance = START_BALANCE;
    this.write([['UPDATE users SET balance = ? WHERE id = ?', [START_BALANCE, u.id]]], [u]);
    this.scheduleLeaders();
    this.changed();
  }

  capped(u, amt) {
    return Math.max(0, Math.min(amt, BALANCE_CAP - u.balance));
  }

  // DB rašymas; nepavykus – balansai perskaitomi iš DB, kad atmintis nenukryptų.
  write(statements, users) {
    return this.db.tx(statements).catch(async () => {
      for (const u of users) {
        const row = await this.db.get('SELECT balance FROM users WHERE id = ?', [u.id]).catch(() => null);
        if (row) u.balance = row.balance;
      }
      this.changed();
    });
  }

  afterRound(table, names) {
    for (const n of names) {
      const u = this.get(n);
      if (u) this.maybeEvict(u);
    }
    if (table.seated) {
      for (const n of [...table.seated]) if (!this.get(n)) table.seated.delete(n);
    }
    this.cleanupTables();
  }

  /* ---------- lyderiai, pokalbis, būsena ---------- */

  scheduleLeaders() {
    if (this.leadersTimer) return;
    this.leadersTimer = setTimeout(() => {
      this.leadersTimer = null;
      this.refreshLeaders().catch((e) => console.error('Lyderių klaida:', e.message));
    }, 1500);
  }
  async refreshLeaders() {
    const rows = await this.db.all('SELECT nick, avatar, balance, games_played, biggest_win FROM users ORDER BY balance DESC, id ASC LIMIT 10');
    this.leaders = rows.map((r) => ({ name: r.nick, avatar: r.avatar, balance: r.balance, games: r.games_played, biggestWin: r.biggest_win }));
    const wins = await this.db.all('SELECT nick, avatar, balance, biggest_win, games_played FROM users ORDER BY biggest_win DESC, balance DESC, id ASC LIMIT 10');
    this.leadersWin = wins.map((r) => ({ name: r.nick, avatar: r.avatar, balance: r.balance, biggestWin: r.biggest_win, games: r.games_played }));
    const skins = await this.db.all('SELECT u.nick AS nick, u.avatar AS avatar, u.balance AS balance, i.skin_id AS skin_id, COUNT(*) AS n FROM inventory i JOIN users u ON u.id = i.user_id GROUP BY u.id, u.nick, u.avatar, u.balance, i.skin_id');
    const bag = new Map();
    for (const r of skins) {
      const skin = byId(r.skin_id);
      let cur = bag.get(r.nick);
      if (!cur) {
        cur = { name: r.nick, avatar: r.avatar, balance: Number(r.balance), value: 0 };
        bag.set(r.nick, cur);
      }
      if (skin) cur.value += skin.value * Number(r.n);
    }
    this.leadersInv = [...bag.values()].sort((a, b) => b.value - a.value || String(a.name).localeCompare(b.name)).slice(0, 10);
    this.changed();
  }

  log(text) {
    this.addChat(null, text);
  }
  addChat(from, text, avatar) {
    this.chat.push({ from, text, avatar, t: Date.now() });
    if (this.chat.length > CHAT_KEEP) this.chat.splice(0, this.chat.length - CHAT_KEEP);
    this.changed();
  }

  // Sujungia daug pakeitimų į vieną išsiuntimą (ne dažniau nei kas 60 ms).
  changed() {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      this.emit(this);
    }, 60);
  }

  commonState() {
    const online = [...this.users.values()]
      .filter((u) => u.socketId)
      .map((u) => ({ name: u.name, avatar: u.avatar, balance: u.balance, bj: u.bj }))
      .sort((a, b) => b.balance - a.balance);
    // Lyderių balansai atnaujinami iš atminties (jie šviežesni).
    const leaders = this.leaders.map((l) => {
      const u = this.get(l.name);
      return u ? { ...l, balance: u.balance, avatar: u.avatar, online: !!u.socketId } : { ...l, online: false };
    });
    leaders.sort((a, b) => b.balance - a.balance);
    const mark = (list) =>
      list.map((l) => {
        const u = this.get(l.name);
        return u ? { ...l, balance: u.balance, avatar: u.avatar, online: !!u.socketId } : { ...l, online: false };
      });
    return {
      online,
      leaders,
      leadersWin: mark(this.leadersWin),
      leadersInv: mark(this.leadersInv),
      chat: this.chat.slice(-60),
      rl: this.rl.state(),
      lt: this.lt.state(),
      bjTables: this.bj.map((t) => ({ num: t.num, title: t.title, seated: [...t.seated], max: BJ_SEATS, phase: t.phase })),
      skinFeed: this.skinFeed,
    };
  }

  meState(u) {
    return { name: u.name, avatar: u.avatar, balance: u.balance, stats: { ...u.stats }, bj: u.bj };
  }

  destroy() {
    for (const t of this.allTables()) t.destroy();
    clearTimeout(this.pending);
    clearTimeout(this.leadersTimer);
  }
}

module.exports = { Casino, BJ_SEATS };
