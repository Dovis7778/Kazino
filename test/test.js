'use strict';
// Automatinis testas: paleidžia tikrą serverį (atskiru procesu), prijungia kelis
// „žaidėjus“ per Socket.IO ir tikrina paskyras, bendrą salę, visus žaidimus,
// balansus DB bei pinigų išsaugojimą po serverio „nukritimo“ (kill -9).
// Paleidimas: npm test           (SQLite laikinas failas)
//             DATABASE_URL=postgres://... npm test   (PostgreSQL; lentelės išvalomos!)
const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { io: ioc } = require('socket.io-client');
const { Db } = require('../src/db');
const { wins, mult } = require('../src/roulette');
const { handValue } = require('../src/blackjack');
const W = require('../src/wheel');
const solo = require('../src/solo');
const skins = require('../src/skins');
const progress = require('../src/progress');
const arcade = require('../src/arcade');

const PG = process.env.DATABASE_URL || '';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kazino-test-'));
const DBFILE = path.join(TMP, 'kazino.db');
const PORT = 3700 + Math.floor(Math.random() * 200);
const URL = 'http://localhost:' + PORT;
const SCALE = '0.04';
let passed = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  passed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let proc = null;
function startServer() {
  return new Promise((res, rej) => {
    const env = { ...process.env, PORT: String(PORT), KAZINO_TIME_SCALE: SCALE, KAZINO_REG_LIMIT: '1000', KAZINO_LOGIN_LIMIT: '5', ADMIN_NICK: 'Dovis', KAZINO_DB: DBFILE, DATABASE_URL: PG };
    proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const t = setTimeout(() => rej(new Error('serveris nepasileido: ' + out)), 15000);
    proc.stdout.on('data', (d) => {
      out += d;
      if (/veikia/.test(out)) {
        clearTimeout(t);
        res(out);
      }
    });
    proc.stderr.on('data', (d) => {
      out += d;
      if (!/ExperimentalWarning|--trace-warnings/.test(String(d))) process.stderr.write('[serveris] ' + d);
    });
    proc.on('exit', (code, sig) => {
      if (code && code !== 0) console.error('serveris išėjo', code, sig);
    });
  });
}
function killServer(sig = 'SIGKILL') {
  return new Promise((res) => {
    proc.once('exit', () => res());
    proc.kill(sig);
  });
}

function client(token) {
  const s = ioc(URL, { transports: ['websocket'], forceNew: true, reconnection: false, auth: { token: token || '' } });
  const c = { s, st: null, waiters: [], kicked: null, authEv: null, name: null };
  s.on('state', (st) => {
    c.st = st;
    c.waiters = c.waiters.filter((w) => !(w.pred(st) && (w.res(st), true)));
  });
  s.on('kicked', (m) => (c.kicked = m));
  s.on('auth', (a) => (c.authEv = a));
  c.emit = (ev, data) => new Promise((res) => s.timeout(8000).emit(ev, data, (err, r) => res(err ? { ok: false, error: 'timeout' } : r)));
  c.wait = (pred, ms = 20000) =>
    new Promise((res, rej) => {
      if (c.st && pred(c.st)) return res(c.st);
      const w = { pred, res };
      c.waiters.push(w);
      setTimeout(() => rej(new Error((c.name || '?') + ': laukimo laikas baigėsi [conn=' + s.connected + ' st=' + (c.st ? JSON.stringify({me: c.st.me && c.st.me.bj, t: c.st.bjTables}) : 'null') + '] ' + pred.toString().slice(0, 120))), ms);
    });
  c.bal = () => c.st.me.balance;
  c.close = () => s.disconnect();
  return new Promise((res, rej) => {
    s.on('connect', () => res(c));
    s.on('connect_error', rej);
  });
}
async function register(nick, password = 'slaptas1', avatar) {
  const c = await client();
  const r = await c.emit('register', { nick, password, avatar });
  assert.ok(r.ok, 'registracija ' + nick + ': ' + r.error);
  c.name = r.user.name;
  c.token = r.token;
  await c.wait((s) => !!s.me);
  return c;
}

async function openDb() {
  return Db.open(PG ? { url: PG } : { url: '', file: DBFILE });
}

async function main() {
  const t0 = Date.now();

  ok(progress.xpOf({ games: 0, wagered: 0 }, 0) === 0 && progress.levelOf(0).level === 1, 'lygis 1 be patirties');
  ok(progress.levelOf(100).level === 2 && progress.levelOf(progress.xpOf({ games: 4, wagered: 0 }, 0)).level >= 1, 'patirtis kyla');
  ok(progress.utcDay(Date.UTC(2026, 0, 2)) === 20260102, 'UTC diena');
  ok(progress.achievements({ games: 10, biggestWin: 0, wagered: 0, items: 0, balance: 0 }).filter((a) => a.ok).length >= 3, 'pasiekimai');
  ok(progress.DAILY_BONUS === 100000, 'dienos dovana 1 000 €');
  ok(skins.migrateByValue(40000) === 'ak-gintaras', 'migracija pagal vertę');
  ok(skins.priceOf(200, 'fn', false) === 200, 'Factory New kaina lygi bazei');
  ok(skins.priceOf(200, 'bs', false) < skins.priceOf(200, 'fn', false), 'Battle-Scarred pigesnė');
  ok(skins.priceOf(200, 'fn', true) === 300, 'Skaitiklis ×1,5');
  const fairMod = require('../src/fair');
  ok(fairMod.crashFromSeed('abc') === fairMod.crashFromSeed('abc') && fairMod.crashFromSeed('abc') >= 100, 'crash sėkla');
  ok(fairMod.fairInt('srv', 'cli', 3, 10000, 0) === fairMod.fairInt('srv', 'cli', 3, 10000, 0), 'HMAC metimas stabilus');
  ok(fairMod.multAt(0) === 100 && fairMod.multAt(2500) > fairMod.multAt(200), 'crash kreivė kyla');
  ok(arcade.coinflipPayout(1000) === 1930, 'moneta 96,5 %');
  ok(Math.abs(arcade.plinkoRtp(8, 'low') - 0.965) < 0.03, 'plinko RTP');
  ok(arcade.minesMult(3, 1) > 1, 'mines daugiklis');
  const cp = arcade.crashPoint();
  ok(cp >= 100 && cp <= 100000, 'crash taškas');
  ok(progress.tierFromWager(0).tier.id === 'bronza', 'VIP bronza');
  ok(progress.vilniusDay(Date.UTC(2026, 5, 1, 22)).length === 10, 'Vilniaus diena');

  // Tikimybių matematika (be serverio).
  const V = skins.byId('ak-gintaras').value;
  ok(skins.chanceBp(skins.minInputFor(V) - 1, V) === null, 'žemiau 1 % atmetama');
  ok(skins.chanceBp(skins.minInputFor(V), V) >= skins.MIN_BP, 'mažiausia leistina įnašo riba');
  ok(skins.chanceBp(V, V) === skins.MAX_BP, '80 % lubos, kai įnašas = tikslas');
  ok(skins.chanceBp(0, V) === null && skins.chanceBp(10, 0) === null, 'tuščias įnašas');
  ok(skins.sellPayout(350) === 315 && skins.sellPayout(1) === 0, 'pardavimas 90 %, žemyn');
  ok(skins.upgradeWins(0, 100, 'under') && skins.upgradeWins(99, 100, 'under') && !skins.upgradeWins(100, 100, 'under'), 'žemiau: [0, tikimybė)');
  ok(skins.upgradeWins(9900, 100, 'over') && !skins.upgradeWins(9899, 100, 'over'), 'virš: [10000−tikimybė, 10000)');
  for (const c of skins.CASES) {
    const weight = c.drops.reduce((s, d) => s + d.w, 0);
    const ev = c.drops.reduce((s, d) => s + d.w * skins.dropExpected(skins.byId(d.id).value), 0) / weight;
    ok(Math.abs(c.drops.reduce((s, d) => s + d.p, 0) - 1) < 1e-9, c.id + ' tikimybių suma');
    ok(c.price === Math.max(1, Math.round(ev / 0.9)), c.id + ' kaina iš 90 % RTP');
    ok(c.rtp > 0.88 && c.rtp < 0.92, c.id + ' RTP ' + c.rtp.toFixed(4));
    ok(c.drops.every((d) => skins.byId(d.id)), c.id + ' skinai egzistuoja');
  }

  // Sena DB be naujų lentelių: vartotojas ir balansas išlieka.
  {
    const file = path.join(TMP, 'old.db');
    const { DatabaseSync } = require('node:sqlite');
    const s = new DatabaseSync(file);
    s.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, nick TEXT NOT NULL, nick_lc TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT '🙂', balance INTEGER NOT NULL, games_played INTEGER NOT NULL DEFAULT 0, biggest_win INTEGER NOT NULL DEFAULT 0, total_wagered INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL); INSERT INTO users (nick, nick_lc, pass_hash, avatar, balance, created_at, last_seen) VALUES ('Senas', 'senas', 'x', '🙂', 123456, 1, 1);");
    s.close();
    const d0 = await Db.open({ url: '', file });
    const old = await d0.get('SELECT balance FROM users WHERE nick_lc = ?', ['senas']);
    ok(old && old.balance === 123456, 'migracija išsaugo seną balansą');
    const dailyCol = await d0.get('SELECT last_daily FROM users WHERE nick_lc = ?', ['senas']);
    ok(dailyCol && Number(dailyCol.last_daily) === 0, 'migracija prideda last_daily');
    const tables = await d0.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('inventory', 'skin_events')");
    ok(tables.length === 2, 'inventory ir skin_events sukuriamos šalia senų lentelių');
    await d0.close();
  }
  if (PG) {
    const d = await openDb();
    for (const sql of ['DROP TABLE IF EXISTS unopened_cases', 'DROP TABLE IF EXISTS fair_rolls', 'DROP TABLE IF EXISTS fair_revealed', 'DROP TABLE IF EXISTS fair_users', 'DROP TABLE IF EXISTS tournament_paid', 'DROP TABLE IF EXISTS tournament_scores', 'DROP TABLE IF EXISTS mission_progress', 'DROP TABLE IF EXISTS holds', 'DROP TABLE IF EXISTS skin_events', 'DROP TABLE IF EXISTS inventory', 'DROP TABLE IF EXISTS open_bets', 'DROP TABLE IF EXISTS sessions', 'DROP TABLE IF EXISTS users']) {
      await d.tx([[sql]]);
    }
    await d.close();
  }
  await startServer();
  console.log('DB: ' + (PG ? 'PostgreSQL' : 'SQLite ' + DBFILE));

  // ---------- paskyros ----------
  const A = await register('Dovis', 'slaptas1', '😎');
  ok(A.st.me.balance === 1000000 && A.st.me.avatar === '😎', 'nauja paskyra: 10 000,00 € ir avataras');
  const B = await register('Tomas');
  const C = await register('Ieva_7');
  const X = await client();
  ok(!(await X.emit('register', { nick: 'dOvIs', password: 'kitas123' })).ok, 'dublikatas (kitos raidės) atmetamas');
  ok(!(await X.emit('register', { nick: 'ab', password: 'kitas123' })).ok, 'per trumpas slapyvardis');
  ok(!(await X.emit('register', { nick: 'a b c', password: 'kitas123' })).ok, 'tarpai slapyvardyje atmetami');
  ok(!(await X.emit('register', { nick: '<script>', password: 'kitas123' })).ok, 'specialūs simboliai atmetami');
  ok(!(await X.emit('register', { nick: 'x'.repeat(17), password: 'kitas123' })).ok, 'per ilgas slapyvardis');
  ok(!(await X.emit('register', { nick: 'Naujas', password: '123' })).ok, 'per trumpas slaptažodis');
  ok((await X.emit('register', { nick: 'Žygis_ąčę', password: 'kitas123' })).ok, 'lietuviškos raidės leidžiamos');
  X.close();
  const N = await client();
  ok(!(await N.emit('bet', { game: 'rl', key: 'red', amount: 100 })).ok, 'neprisijungęs negali statyti');
  ok(!(await N.emit('login', { nick: 'Tomas', password: 'neteisingas' })).ok, 'neteisingas slaptažodis');
  ok(!(await N.emit('login', { nick: 'NiekasToks', password: 'slaptas1' })).ok, 'neegzistuojantis vartotojas');
  // ribojimas: 5 nesėkmingi bandymai -> blokuojama net su teisingu slaptažodžiu
  for (let i = 0; i < 4; i++) await N.emit('login', { nick: 'Tomas', password: 'blogas' + i });
  const rl = await N.emit('login', { nick: 'Tomas', password: 'slaptas1' });
  ok(!rl.ok && /Per daug/.test(rl.error), 'bandymų ribojimas: ' + rl.error);
  N.close();

  // prisijungimas iš naujo su slaptažodžiu – senas ryšys išmetamas
  const C2 = await client();
  const lr = await C2.emit('login', { nick: 'ieva_7', password: 'slaptas1' });
  ok(lr.ok && lr.user.name === 'Ieva_7', 'prisijungimas (slapyvardis neskiria raidžių dydžio)');
  await sleep(150);
  ok(C.kicked && !C.s.connected, 'senas ryšys atjungtas, kai prisijungta kitur');
  C2.name = 'Ieva_7';
  C2.token = lr.token;
  // sesijos atkūrimas pagal žetoną (handshake)
  const A2 = await client(A.token);
  await A2.wait((s) => !!s.me);
  ok(A2.authEv && A2.authEv.ok && A2.authEv.resumed && A2.st.me.name === 'Dovis', 'sesija atkurta pagal žetoną');
  await sleep(100);
  ok(A.kicked && !A.s.connected, 'senas langas išmestas (vienas ryšys vienam vartotojui)');
  A2.name = 'Dovis';
  A2.token = A.token;
  const bad = await client('netikras-zetonas');
  await sleep(300);
  ok(bad.authEv && !bad.authEv.ok, 'netikras žetonas atmetamas');
  bad.close();
  const P = { A: A2, B, C: C2 };
  const all = [A2, B, C2];

  // ---------- bendra salė ----------
  await A2.wait((s) => ['Dovis', 'Tomas', 'Ieva_7'].every((n) => s.online.some((o) => o.name === n)));
  ok(A2.st.online.length === 3, 'bendras prisijungusių sąrašas');
  await A2.wait((s) => s.leaders.some((l) => l.name === 'Žygis_ąčę' && !l.online), 5000);
  ok(true, 'lyderiuose ir atsijungę (iš DB)');
  ok((await B.emit('chat', 'Labas visiems!')).ok, 'bendras pokalbis');
  await C2.wait((s) => s.chat.some((m) => m.from === 'Tomas' && m.text === 'Labas visiems!'));
  ok((await A2.emit('profile:avatar', '🦊')).ok, 'avataro keitimas');
  await A2.wait((s) => s.me.avatar === '🦊');
  ok(!(await A2.emit('profile:avatar', 'X')).ok, 'neleistinas avataras');
  ok(!(await C2.emit('topup', 100000001)).ok, 'per didelis papildymas');
  ok((await C2.emit('topup', 100000)).ok, 'papildymas +1000 €');
  await C2.wait((s) => s.me.balance === 1100000);
  ok((await C2.emit('resetBalance')).ok, 'balanso atstatymas');
  await C2.wait((s) => s.me.balance === 1000000);
  ok(!(await A2.emit('bet', { game: 'rl', key: 'n37', amount: 100 })).ok, 'n37 atmetamas');
  ok(!(await A2.emit('bet', { game: 'rl', key: 'red', amount: 1.5 })).ok, 'trupmeniniai centai');
  ok(!(await A2.emit('bet', { game: 'rl', key: 'red', amount: 99999999999 })).ok, 'daugiau nei balansas');
  ok(!(await A2.emit('bet', { game: 'bj', key: 'pp', amount: 100 })).ok, 'šalutinis be pagrindinio');
  ok(!(await A2.emit('bj:act', 'hit')).ok, 'ne savo eilė');

  // ---------- ruletė ----------
  for (let round = 0; round < 3; round++) {
    const before = { A: A2.bal(), B: B.bal(), C: C2.bal() };
    const bets = { A: { red: 1000, n17: 200 }, B: { n0: 500, d2: 700 }, C: { odd: 200, c1: 300, high: 100 } };
    for (const w of 'ABC') for (const [k, v] of Object.entries(bets[w])) ok((await P[w].emit('bet', { game: 'rl', key: k, amount: v })).ok, 'ruletės statymas');
    const rnd = A2.st.rl.round;
    for (const cl of all) await cl.emit('ready', { game: 'rl' });
    for (const w of 'ABC') {
      const st = await P[w].wait((s) => s.rl.phase === 'result' && s.rl.round === rnd + 1);
      let ret = 0, staked = 0;
      for (const [k, v] of Object.entries(bets[w])) {
        staked += v;
        if (wins(k, st.rl.result)) ret += v * (mult(k) + 1);
      }
      ok(st.rl.payouts[P[w].name].ret === ret, 'ruletės išmoka ' + w);
      ok(st.me.balance === before[w] - staked + ret, 'ruletės balansas ' + w);
    }
    await A2.wait((s) => s.rl.phase === 'betting');
  }
  const rb = A2.bal();
  ok((await A2.emit('rebet', { game: 'rl' })).ok, 'kartoti statymą');
  await A2.wait((s) => s.me.balance === rb - 1200);
  ok((await A2.emit('clear', { game: 'rl' })).ok, 'išvalyti statymus');
  await A2.wait((s) => s.me.balance === rb);
  console.log('Ruletė OK');

  // ---------- Laimės ratas ----------
  const seen = new Set();
  let ltRounds = 0;
  while (ltRounds < 60 && (ltRounds < 20 || seen.size < 8)) {
    const before = { A: A2.bal(), B: B.bal(), C: C2.bal() };
    const bets = { A: {}, B: { hunt: 300, n2: 100 }, C: { coin: 200, big: 200, plinko: 200 } };
    for (const x of W.LT) bets.A[x.key] = 100;
    for (const w of 'ABC') for (const [k, v] of Object.entries(bets[w])) await P[w].emit('bet', { game: 'lt', key: k, amount: v });
    const rnd = A2.st.lt.round;
    for (const cl of all) await cl.emit('ready', { game: 'lt' });
    const hp = await B.wait((s) => s.lt.round === rnd + 1 && (s.lt.phase === 'hunt-pick' || s.lt.phase === 'result'), 30000);
    let bPick;
    if (hp.lt.phase === 'hunt-pick') {
      ok(!hp.lt.bonus.tiles, 'lobių vertės paslėptos');
      bPick = 7;
      ok((await B.emit('lt:pick', bPick)).ok, 'B renkasi skrynią');
      ok(!(await B.emit('lt:pick', 8)).ok, 'antras pasirinkimas atmetamas');
    }
    for (const w of 'ABC') {
      const st = await P[w].wait((s) => s.lt.phase === 'result' && s.lt.round === rnd + 1, 40000);
      const L = st.lt;
      seen.add(L.result);
      const m = L.top && L.top.key === L.result ? L.top.m : 1;
      const amt = bets[w][L.result] || 0;
      const x = L.result[0] === 'n' ? Number(L.result.slice(1)) : L.result === 'hunt' ? L.bonus.tiles[L.picks[P[w].name] ?? 0] : W.bonusX(L.bonus);
      const ret = amt ? amt * (x * m + 1) : 0;
      const staked = Object.values(bets[w]).reduce((a, b) => a + b, 0);
      ok(L.payouts[P[w].name].ret === ret, 'rato išmoka ' + w);
      ok(st.me.balance === before[w] - staked + ret, 'rato balansas ' + w);
      if (w === 'B' && L.result === 'hunt' && bPick !== undefined) ok(L.picks.Tomas === bPick, 'pasirinkimas išsaugotas');
    }
    await A2.wait((s) => s.lt.phase === 'betting');
    ltRounds++;
  }
  console.log('Laimės ratas OK: ' + ltRounds + ' raundų, iškrito: ' + [...seen].join(', '));

  // ---------- Blackjack (keli stalai) ----------
  ok(all.every((c) => c.st.me.bj === 1), 'visi automatiškai prie „Stalas 1“');
  const extra = [];
  for (let i = 0; i < 5; i++) extra.push(await register('Svecias' + i));
  const last = extra[4];
  await last.wait((s) => s.bjTables.length === 2);
  ok(last.st.me.bj === 2 && last.st.bjTables[0].seated.length === 7, '8-as žaidėjas – automatiškai „Stalas 2“ (7 vietos)');
  ok(!(await last.emit('bj:sit', 1)).ok, 'pilnas stalas atmetamas');
  const actor = (cl) => {
    cl.s.on('state', async (st) => {
      const t = st.bj;
      if (!t || t.phase !== 'turn' || !t.turn || t.turn.name !== cl.name) return;
      const sig = t.round + ':' + t.turn.hand + ':' + JSON.stringify(t.seats.find((s) => s.name === cl.name).hands);
      if (cl.acting === sig) return;
      cl.acting = sig;
      const seat = t.seats.find((s) => s.name === cl.name);
      const h = seat.hands[t.turn.hand];
      const v = (c) => (c.r === 'A' ? 1 : ['J', 'Q', 'K'].includes(c.r) ? 10 : Number(c.r));
      let a = h.value.total < 17 ? 'hit' : 'stand';
      if (h.cards.length === 2 && seat.hands.length === 1 && v(h.cards[0]) === v(h.cards[1])) a = 'split';
      else if (h.cards.length === 2 && (h.value.total === 10 || h.value.total === 11)) a = 'double';
      const r = await cl.emit('bj:act', a);
      if (!r.ok) await cl.emit('bj:act', 'stand');
    });
  };
  [...all, last].forEach(actor);
  const acts = { split: 0, double: 0, bj: 0, side: 0 };
  const checkBj = (st, name, bets, before) => {
    const T = st.bj;
    const dv = handValue(T.dealer).total;
    const dealerNat = T.dealer.length === 2 && dv === 21;
    const seat = T.seats.find((s) => s.name === name);
    let ret = 0;
    let staked = (bets.pp || 0) + (bets.t3 || 0);
    for (const x of seat.side) ret += x.ret;
    if (seat.side.some((x) => x.ret > 0)) acts.side++;
    if (seat.hands.length === 2) acts.split++;
    for (const h of seat.hands) {
      staked += h.bet;
      if (h.doubled) acts.double++;
      const pv = handValue(h.cards).total;
      const nat = seat.hands.length === 1 && h.cards.length === 2 && pv === 21;
      if (nat) acts.bj++;
      let exp;
      if (dealerNat) exp = nat ? h.bet : 0;
      else if (pv > 21) exp = 0;
      else if (nat) exp = h.bet + Math.floor((h.bet * 3) / 2);
      else if (dv > 21 || pv > dv) exp = h.bet * 2;
      else if (pv === dv) exp = h.bet;
      else exp = 0;
      ok(h.ret === exp, 'bj rankos išmoka');
      ret += exp;
    }
    ok(T.payouts[name].ret === ret, 'bj išmoka');
    ok(st.me.balance === before - staked + ret, 'bj balansas ' + name);
  };
  for (let round = 0; round < 15; round++) {
    const players = [['A', A2, { main: 1000, pp: 100, t3: 100 }], ['B', B, { main: 555 }], ['C', C2, { main: 2001, t3: 50 }], ['L', last, { main: 700, pp: 50 }]];
    const before = new Map(players.map(([, c]) => [c, c.bal()]));
    for (const [, c, b] of players) for (const [k, v] of Object.entries(b)) ok((await c.emit('bet', { game: 'bj', key: k, amount: v })).ok, 'bj statymas');
    const rounds = new Map(players.map(([, c]) => [c, c.st.bj.round]));
    // laukimai registruojami prieš „ready“, kad nepraleistume trumpos „result“ fazės
    const results = players.map(([, c]) => c.wait((s) => s.bj.phase === 'result' && s.bj.round === rounds.get(c) + 1, 30000));
    for (const [, c] of players) await c.emit('ready', { game: 'bj' });
    const sts = await Promise.all(results);
    players.forEach(([, c, b], i) => checkBj(sts[i], c.name, b, before.get(c)));
    for (const [, c] of players) await c.wait((s) => s.bj.phase === 'betting');
  }
  console.log('Blackjack OK: 15 raundų prie 2 stalų vienu metu, skaidymų ' + acts.split + ', dvigubinimų ' + acts.double + ', blackjack ' + acts.bj + ', laimėtų šalutinių ' + acts.side);
  ok((await last.emit('bj:sit', 'new')).ok && last.st, 'persėsti prie kito stalo');
  await last.wait((s) => s.me.bj !== 1);
  // atsijungimas per eilę – raundas nesustoja
  await B.emit('bet', { game: 'bj', key: 'main', amount: 100 });
  await A2.emit('bet', { game: 'bj', key: 'main', amount: 100 });
  const rr = A2.st.bj.round;
  await A2.emit('ready', { game: 'bj' });
  await B.emit('ready', { game: 'bj' });
  B.close();
  await A2.wait((s) => s.bj.phase === 'result' && s.bj.round === rr + 1, 30000);
  await A2.wait((s) => s.bj.phase === 'betting');
  ok(true, 'raundas baigiasi, kai žaidėjas atsijungia');
  const B2 = await client();
  const bl = await B2.emit('login', { nick: 'TOMAS', password: 'slaptas1' });
  ok(!bl.ok, 'Tomas vis dar užblokuotas (bandymų riba galioja)');
  const B3 = await register('Tomas2');
  P.B = B3;
  B2.close();

  // ---------- kauliukai ir automatas ----------
  let bal = C2.bal();
  for (let i = 0; i < 200; i++) {
    const bet = 1 + (i % 7) * 37;
    const target = 2 + (i % 97);
    const mode = i % 2 ? 'over' : 'under';
    const d = await C2.emit('dice:roll', { bet, target, mode });
    const chance = mode === 'under' ? target : 100 - target;
    const win = mode === 'under' ? d.r < target * 100 : d.r >= target * 100;
    ok(d.ok && d.win === win && d.pay === (win ? Math.floor((bet * 99) / chance) : 0), 'kauliukų išmoka');
    bal = bal - bet + d.pay;
    ok(d.balance === bal, 'kauliukų balansas');
  }
  ok(!(await C2.emit('dice:roll', { bet: bal + 1, target: 50, mode: 'under' })).ok, 'virš balanso');
  const big = await C2.emit('dice:roll', { bet: bal, target: 50, mode: 'under' });
  ok(big.ok && big.bet === bal, 'statymas = visas balansas');
  await C2.emit('topup', 5000000);
  const mx = await C2.emit('dice:roll', { bet: 'max', target: 98, mode: 'under' });
  ok(mx.ok && mx.bet === big.balance + 5000000, 'Max – visas balansas');
  let sb = mx.balance;
  if (sb < 20000) {
    await C2.emit('topup', 100000);
    sb += 100000;
  }
  for (let i = 0; i < 150; i++) {
    const s = await C2.emit('slot:spin', { bet: 100 });
    ok(s.ok && s.pay === 100 * solo.slotX(...s.reels), 'automato išmoka');
    sb = sb - 100 + s.pay;
    ok(s.balance === sb, 'automato balansas');
  }
  console.log('Kauliukai ir automatas OK');

  // ---------- DB atitinka atmintį ----------
  let db = await openDb();
  await sleep(200);
  for (const c of [A2, C2, last]) {
    const row = await db.get('SELECT balance, games_played, total_wagered, biggest_win FROM users WHERE nick = ?', [c.name]);
    ok(row.balance === c.st.me.balance, 'DB balansas = žaidimo balansas ' + c.name);
    ok(row.games_played === c.st.me.stats.games && row.total_wagered === c.st.me.stats.wagered, 'DB statistika ' + c.name);
  }
  ok((await db.get('SELECT COUNT(*) AS n FROM open_bets')).n === 0, 'nėra pakibusių statymų');
  const pr = await A2.emit('profile:get', 'ieva_7');
  ok(pr.ok && pr.profile.games > 200 && pr.profile.wagered > 0, 'profilio statistika');
  // admin
  ok(!(await C2.emit('admin:reset', 'Dovis')).ok, 'ne administratorius negali');
  ok((await A2.emit('admin:reset', 'Svecias0')).ok, 'administratorius atstato balansą');
  ok((await db.get('SELECT balance FROM users WHERE nick = ?', ['Svecias0'])).balance === 1000000, 'admin atstatymas DB');
  await db.close();

  // ---------- dėžės, parduotuvė, pardavimas, upgraderis ----------
  let odaSnap = null;
  {
    const oda = await register('Oda');
    ok(oda.st.me.balance === 1000000, 'Oda pradinis balansas');
    const guest = await client();
    ok(!(await guest.emit('case:open', 'smelis')).ok, 'neprisijungęs negali atidaryti dėžės');
    guest.close();
    ok(!(await oda.emit('case:open', 'nėra')).ok, 'nežinoma dėžė');
    ok(!(await oda.emit('shop:buy', 'lk-amzinybe')).ok, 'per brangus skinas neatimamas');
    ok(!(await oda.emit('upgrade:roll', { items: [], cash: 1, target: 'lk-amzinybe', side: 'under' })).ok, 'per maža upgraderio tikimybė');
    await oda.wait((s) => s.me.balance === 1000000);

    const kase = skins.CASES.find((c) => c.id === 'smelis');
    const opened = await oda.emit('case:open', 'smelis');
    ok(opened.ok && opened.balance === 1000000 - kase.price, 'dėžės kaina nurašyta');
    ok(kase.drops.some((d) => d.id === opened.skinId) && opened.item && opened.item.skinId === opened.skinId, 'iškritęs skinas yra dėžės lentelėje');
    ok(opened.items.length === 1, 'po dėžės vienas daiktas');
    await oda.wait((s) => (s.skinFeed || []).some((e) => e.kind === 'case' && e.nick === 'Oda' && e.payload.skinId === opened.skinId));
    ok(true, 'bendroje juostoje matyti dėžės iškritimas');

    const bought = await oda.emit('shop:buy', 'sr-smelis');
    ok(bought.ok && bought.price === bought.item.value && bought.balance === opened.balance - bought.price && bought.item.skinId === 'sr-smelis', 'parduotuvė nurašo būklės kainą');
    const sold = await oda.emit('skin:sell', bought.item.id);
    ok(sold.ok && sold.payout === skins.sellPayout(bought.price) && sold.balance === bought.balance + skins.sellPayout(bought.price), 'pardavimas grąžina 90 % būklės kainos');
    ok(!(await oda.emit('skin:sell', bought.item.id)).ok, 'antras pardavimas to paties daikto atmetamas');
    ok(sold.items.length === 1 && sold.items[0].skinId === opened.skinId, 'pardavus lieka tik dėžės skinas');

    const dupBuy = await oda.emit('shop:buy', 'vx-dulkes');
    const dupId = dupBuy.item.id;
    const [a, b] = await Promise.all([
      oda.emit('upgrade:roll', { items: [dupId], cash: 0, target: 'ak-samanos', side: 'under' }),
      oda.emit('upgrade:roll', { items: [dupId], cash: 0, target: 'ak-samanos', side: 'over' }),
    ]);
    const dupOk = [a, b].filter((x) => x.ok);
    ok(dupOk.length === 1 && [a, b].some((x) => !x.ok), 'tas pats daiktas sunaudojamas tik vieną kartą');
    const winTry = dupOk[0];
    ok(winTry.chanceBp === skins.chanceBp(winTry.input, winTry.targetValue) && winTry.won === skins.upgradeWins(winTry.roll, winTry.chanceBp, winTry.side), 'dvigubas bandymas: tikimybė ir metimas sutampa');
    ok(!winTry.items.some((i) => i.id === dupId), 'panaudoto daikto nebėra');

    const cash = Math.ceil((5000 * V) / skins.KEEP_BP);
    const expectBp = skins.chanceBp(cash, V);
    ok(expectBp >= 4900 && expectBp <= 5100, 'testinė tikimybė apie 50 %');
    let bal = winTry.balance;
    let items = winTry.items;
    let sawWin = false;
    let sawLose = false;
    for (let i = 0; i < 24 && (!sawWin || !sawLose); i++) {
      const side = i % 2 === 0 ? 'under' : 'over';
      const r = await oda.emit('upgrade:roll', { items: [], cash, target: 'ak-gintaras', side });
      ok(r.ok, 'upgraderio metimas ' + i);
      ok(r.chanceBp === skins.chanceBp(cash, r.targetValue) && r.side === side, 'serverio tikimybė = formulė');
      ok(r.won === skins.upgradeWins(r.roll, r.chanceBp, side), 'laimėjimas atitinka metimą ir pusę');
      ok(r.balance === bal - cash, 'balansas sumažėja įnašu');
      if (r.won) {
        sawWin = true;
        ok(r.item && r.item.skinId === 'ak-gintaras' && r.items.length === items.length + 1, 'laimėjus gaunamas tikslas');
      } else {
        sawLose = true;
        ok(!r.item && r.items.length === items.length, 'pralaimėjus inventorius neauga');
      }
      bal = r.balance;
      items = r.items;
    }
    ok(sawWin && sawLose, 'matyti ir laimėjimas, ir pralaimėjimas');

    const capped = await oda.emit('upgrade:roll', { items: [], cash: V, target: 'ak-gintaras', side: 'under' });
    ok(capped.ok && capped.chanceBp === skins.chanceBp(V, capped.targetValue) && capped.balance === bal - V, 'upgraderio kaina pagal būklę');
    ok(capped.capped === skins.rawChanceBp(V, capped.targetValue) > skins.MAX_BP, '80 % lubos pagal būklės kainą');
    bal = capped.balance;
    items = capped.items;

    const keep = await oda.emit('shop:buy', 'ps-juosta');
    ok(keep.ok && keep.balance === bal - keep.price, 'prieš perkrovimą nupirktas skinas');
    bal = keep.balance;
    const got = await oda.emit('skins:get', {});
    ok(got.ok && got.history.some((h) => h.kind === 'case') && got.history.some((h) => h.kind === 'upgrade') && got.history.some((h) => h.kind === 'sell'), 'asmeninė istorija');
    const dbNow = await openDb();
    const row = await dbNow.get('SELECT balance, games_played FROM users WHERE nick = ?', ['Oda']);
    const dbItems = await dbNow.all('SELECT i.id, i.skin_id FROM inventory i JOIN users u ON u.id = i.user_id WHERE u.nick = ? ORDER BY i.id', ['Oda']);
    ok(row.balance === bal && row.games_played === 0, 'DB balansas sutampa, žaidimų skaitiklis nejudinamas');
    ok(dbItems.length === got.items.length && dbItems.every((d, i) => got.items.slice().sort((a, b) => a.id - b.id)[i].id === d.id), 'DB inventorius = atmintis');
    await dbNow.close();
    odaSnap = { balance: bal, items: got.items.map((i) => i.id + ':' + i.skinId).sort(), token: oda.token };
    console.log('Upgraderis OK');
  }

  // ---------- serverio nukritimas su atvirais raundais ----------
  const pre = { A: A2.bal(), B: B3.bal(), C: C2.bal() };
  ok((await B3.emit('bet', { game: 'rl', key: 'black', amount: 5000 })).ok, 'atviras ruletės statymas');
  ok((await A2.emit('bet', { game: 'rl', key: 'n7', amount: 1234 })).ok, 'atviras ruletės statymas 2');
  ok((await A2.emit('bet', { game: 'lt', key: 'n10', amount: 777 })).ok, 'rato statymas');
  await C2.wait((s) => s.me.bj === 1 && s.bj.phase === 'betting');
  ok((await C2.emit('bet', { game: 'bj', key: 'main', amount: 3000 })).ok, 'bj statymas prieš nukritimą');
  await A2.emit('ready', { game: 'lt' });
  await A2.wait((s) => ['top', 'top-done', 'spinning'].includes(s.lt.phase), 5000);
  C2.s.removeAllListeners('state'); // C nebeatlieka veiksmų – raundas lieka atviras
  C2.s.on('state', (st) => {
    C2.st = st;
    C2.waiters = C2.waiters.filter((w) => !(w.pred(st) && (w.res(st), true)));
  });
  await C2.emit('ready', { game: 'bj' });
  await C2.wait((s) => ['turn', 'dealer', 'result'].includes(s.bj.phase) && s.bj.seats.some((x) => x.name === 'Ieva_7'), 5000);
  await sleep(100);
  ok(A2.bal() === pre.A - 1234 - 777 && B3.bal() === pre.B - 5000, 'statymai nurašyti prieš nukritimą');
  await killServer('SIGKILL');
  db = await openDb();
  const open = await db.all('SELECT u.nick, SUM(o.amount) AS s FROM open_bets o JOIN users u ON u.id = o.user_id GROUP BY u.nick');
  const openBy = Object.fromEntries(open.map((r) => [r.nick, r.s]));
  ok(openBy.Dovis === 1234 + 777 && openBy.Tomas2 === 5000, 'atviri statymai įrašyti į DB: ' + JSON.stringify(openBy));
  const total1 = await db.get('SELECT (SELECT COALESCE(SUM(balance),0) FROM users) + (SELECT COALESCE(SUM(amount),0) FROM open_bets) AS t');
  const cRow = await db.get("SELECT balance FROM users WHERE nick = 'Ieva_7'");
  const cExpect = cRow.balance + (openBy.Ieva_7 || 0);
  await db.close();
  console.log('Serveris nužudytas (kill -9) su atvirais raundais; perkraunama…');
  await startServer();
  db = await openDb();
  ok((await db.get('SELECT COUNT(*) AS n FROM open_bets')).n === 0, 'po perkrovimo atviri statymai grąžinti');
  const total2 = await db.get('SELECT COALESCE(SUM(balance),0) AS t FROM users');
  ok(total1.t === total2.t, 'bendra pinigų suma nepasikeitė (niekas neprarasta ir nepadvigubinta)');
  ok((await db.get("SELECT balance FROM users WHERE nick = 'Dovis'")).balance === pre.A, 'Dovis gavo grąžinimą');
  ok((await db.get("SELECT balance FROM users WHERE nick = 'Tomas2'")).balance === pre.B, 'Tomas2 gavo grąžinimą');
  ok((await db.get("SELECT balance FROM users WHERE nick = 'Ieva_7'")).balance === cExpect, 'Ieva_7 bj statymas grąžintas');
  const odaRow = await db.get("SELECT balance FROM users WHERE nick = 'Oda'");
  const odaItems = await db.all("SELECT i.id || ':' || i.skin_id AS k FROM inventory i JOIN users u ON u.id = i.user_id WHERE u.nick = 'Oda'");
  ok(odaSnap && odaRow.balance === odaSnap.balance, 'po perkrovimo Odos balansas nepakitęs');
  ok(odaItems.map((r) => r.k).sort().join('|') === odaSnap.items.join('|'), 'po perkrovimo inventorius išliko');
  await db.close();
  // sesija galioja po perkrovimo, balansas ir avataras išsaugoti
  const A3 = await client(A2.token);
  await A3.wait((s) => !!s.me);
  ok(A3.st.me.balance === pre.A && A3.st.me.avatar === '🦊', 'po perkrovimo: sesija, balansas ir avataras išliko');
  await A3.wait((s) => s.leaders.some((l) => l.name === 'Ieva_7' && !l.online), 5000);
  ok(true, 'lyderiai iš DB (atsijungę)');
  ok(A3.st.chat.length >= 0 && A3.st.online.length === 1, 'bendra salė po perkrovimo');
  // atsijungimas ištrina sesiją
  ok((await A3.emit('logout', { token: A2.token })).ok, 'atsijungimas');
  const A4 = await client(A2.token);
  await sleep(300);
  ok(A4.authEv && !A4.authEv.ok, 'po atsijungimo žetonas nebegalioja');
  const lg = await A4.emit('login', { nick: 'Dovis', password: 'slaptas1' });
  ok(lg.ok, 'prisijungimas slaptažodžiu po perkrovimo');
  await A4.wait((s) => !!s.me);
  ok(A4.st.me.balance === pre.A, 'balansas tas pats');
  ok(Array.isArray(A4.st.leadersWin) && Array.isArray(A4.st.leadersInv), 'lyderių lentelės: laimėjimas ir skinų vertė');

  const dov = await register('Dovana');
  const dovBefore = dov.st.me.balance;
  const gift = await dov.emit('bonus:claim', {});
  ok(gift.ok && gift.amount === progress.DAILY_BONUS && gift.balance === dovBefore + progress.DAILY_BONUS, 'dienos dovana');
  await dov.wait((s) => s.me.balance === dovBefore + progress.DAILY_BONUS);
  const gift2 = await dov.emit('bonus:claim', {});
  ok(!gift2.ok && /jau paėmei/.test(gift2.error), 'antra dovana tą pačią UTC dieną atmesta');
  await dov.wait((s) => s.me.balance === dovBefore + progress.DAILY_BONUS);

  const oda2 = await client(odaSnap.token);
  await oda2.wait((s) => !!s.me);
  ok(oda2.st.me.balance === odaSnap.balance, 'Odos sesija ir balansas po perkrovimo');
  const again = await oda2.emit('skins:get', {});
  ok(again.ok && again.items.map((i) => i.id + ':' + i.skinId).sort().join('|') === odaSnap.items.join('|'), 'inventorius po prisijungimo');
  const keepItem = again.items.find((i) => i.skinId === 'ps-juosta');
  ok(!!keepItem, 'nupirktas skinas išliko');
  const sold2 = await oda2.emit('skin:sell', keepItem.id);
  ok(sold2.ok && sold2.payout === skins.sellPayout(keepItem.value) && sold2.balance === odaSnap.balance + skins.sellPayout(keepItem.value), 'po perkrovimo pardavimas 90 %');
  ok(!sold2.items.some((i) => i.id === keepItem.id), 'parduotas daiktas dingsta');

  // ---------- nauji žaidimai, kovos, misijos, VIP ----------
  {
    const G = await register('Zaidejas');
    let placed = false;
    let round = 0;
    let before = 0;
    for (let i = 0; i < 6 && !placed; i++) {
      await G.wait((s) => s.arcade && s.arcade.crash && s.arcade.crash.phase === 'betting', 8000);
      before = G.bal();
      round = G.st.arcade.crash.round;
      placed = (await G.emit('crash:bet', { amount: 500, auto: 0 })).ok;
    }
    ok(placed, 'crash statymas');
    await G.wait((s) => s.arcade.crash.round > round, 20000);
    await G.wait((s) => s.me.balance === before - 500, 5000);
    ok(true, 'crash be išėjimo nurašo statymą');
    const mines = await G.emit('mines:start', { bet: 1000, mines: 1 });
    ok(mines.ok && mines.mines === 1, 'mines pradžia');
    let guard = 0;
    let boom = false;
    while (guard < 24) {
      const hit = await G.emit('mines:click', guard);
      ok(hit.ok, 'mines langelis');
      if (hit.boom) { boom = true; break; }
      guard++;
    }
    if (!boom) {
      const out = await G.emit('mines:cashout', {});
      ok(out.ok && out.pay >= 1000, 'mines išėmimas');
    } else ok(true, 'mines mina');
    const pk = await G.emit('plinko:drop', { bet: 1000, rows: 8, risk: 'low' });
    ok(pk.ok && pk.pay === Math.floor(1000 * pk.mult) && pk.path.length === 8, 'plinko išmoka');
    const flip = await G.emit('coinflip:create', { amount: 1000, bot: true });
    ok(flip.ok, 'moneta prieš botą');
    await G.wait((s) => (s.arcade.flips || []).some((f) => f.id === flip.flip.id && f.status === 'done'), 5000);
    ok(true, 'moneta baigta');
    const battle = await G.emit('battle:create', { mode: '1v1', cases: ['smelis'], rounds: 1 });
    ok(battle.ok, 'kova sukurta');
    const started = await G.emit('battle:start', battle.battle.id);
    ok(started.ok && started.battle.winner, 'kova su botu baigta');
    let plinkoM = null;
    for (let i = 0; i < 15 && !(plinkoM && plinkoM.progress >= 1); i++) {
      const ms = await G.emit('mission:list', {});
      plinkoM = ms.ok ? ms.missions.find((m) => m.id === 'd-plinko') : null;
      if (!(plinkoM && plinkoM.progress >= 1)) await sleep(100);
    }
    ok(plinkoM && plinkoM.progress >= 1, 'plinko misija');
    const claim = await G.emit('mission:claim', 'd-plinko');
    ok(claim.ok && claim.reward === 5000, 'misijos atlygis');
    ok(!(await G.emit('mission:claim', 'd-plinko')).ok, 'misija neatsiimama dukart');
    const vip = await G.emit('vip:get', {});
    ok(vip.ok && vip.tier === 'bronza', 'VIP bronza naujai paskyrai');
    const tours = await G.emit('tour:list', {});
    ok(tours.ok && tours.tournaments.length >= 3, 'turnyrų sąrašas');
    console.log('Arcade OK');
  }

  // ---------- grakštus sustabdymas ----------
  await killServer('SIGTERM');
  console.log('\nVISI TESTAI PRAĖJO (' + (PG ? 'PostgreSQL' : 'SQLite') + '): ' + passed + ' patikrinimų per ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
}

main().catch(async (e) => {
  console.error('TESTAS NEPAVYKO:', e);
  if (proc && proc.exitCode === null) proc.kill('SIGKILL');
  process.exit(1);
});
