'use strict';
// Crash, Minos, Plinko, monetos dvikova, dėžių kovos, turnyrai, misijos, VIP.
// Grąža ~96,5 % (Crash/Minos/Plinko/moneta). Dėžės lieka ~90 %.
const progress = require('./progress');
const skins = require('./skins');
const rng = require('./rng');

const EDGE = 0.035;
const RTP = 1 - EDGE;

function crashPoint() {
  const roll = rng.int(1_000_000_000);
  const x = roll / 1_000_000_000;
  if (x < EDGE) return 100;
  const mult = RTP / (1 - x);
  return Math.max(100, Math.min(100000, Math.floor(mult * 100)));
}

function minesMult(mines, picks) {
  const cells = 25;
  let p = 1;
  for (let i = 0; i < picks; i++) p *= (cells - mines - i) / (cells - i);
  if (p <= 0) return 0;
  return Math.floor((RTP / p) * 100) / 100;
}

function binom(n, k) {
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c;
}

function plinkoMults(rows, risk) {
  const n = rows;
  const weights = [];
  for (let k = 0; k <= n; k++) weights.push(binom(n, k));
  const total = weights.reduce((s, w) => s + w, 0);
  const raw = [];
  for (let k = 0; k <= n; k++) {
    const dist = Math.abs(k - n / 2) / (n / 2 || 1);
    let v = 0.5;
    if (risk === 'low') v = 0.5 + dist * 1.1;
    else if (risk === 'high') v = 0.15 + Math.pow(dist, 2.2) * 28;
    else v = 0.25 + Math.pow(dist, 1.5) * 9;
    raw.push(v);
  }
  const ev = raw.reduce((s, v, i) => s + v * weights[i], 0) / total;
  return raw.map((v) => Math.max(0, Math.floor((v * (RTP / ev)) * 100) / 100));
}

function plinkoRtp(rows, risk) {
  const mults = plinkoMults(rows, risk);
  const n = rows;
  let ev = 0;
  let total = 0;
  for (let k = 0; k <= n; k++) {
    const w = binom(n, k);
    ev += w * mults[k];
    total += w;
  }
  return ev / total;
}

function coinflipPayout(stake) {
  return Math.floor((2 * stake * 965) / 1000);
}

const TOURS = [
  { id: 'crash', name: 'Crash daugiklis', period: 'day', pool: 100000 },
  { id: 'wager', name: 'Daugiausiai pastatyta', period: 'day', pool: 100000 },
  { id: 'upgrade', name: 'Geriausias upgrade', period: 'day', pool: 80000 },
  { id: 'crash-w', name: 'Savaitės Crash', period: 'week', pool: 400000 },
];

function nextVilniusBoundary(now, period) {
  const start = now == null ? Date.now() : now;
  const curDay = progress.vilniusDay(start);
  const curWeek = progress.weekKey(curDay);
  let lo = start;
  let hi = start + 36 * 3600000;
  const done = (t) => {
    const day = progress.vilniusDay(t);
    return period === 'week' ? progress.weekKey(day) !== curWeek : day !== curDay;
  };
  while (!done(hi)) hi += 24 * 3600000;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (done(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

function tourList(now) {
  const day = progress.vilniusDay(now);
  const week = progress.weekKey(day);
  return TOURS.map((t) => {
    const key = t.id + ':' + (t.period === 'week' ? week : day);
    return { key, name: t.name, period: t.period, pool: t.pool, id: t.id, endsAt: nextVilniusBoundary(now == null ? Date.now() : now, t.period) };
  });
}

function createArcade(casino, db) {
  const scale = Number(process.env.KAZINO_TIME_SCALE) || 1;
  const betMs = Math.max(1500, Math.round(7000 * scale));
  const tickMs = Math.max(50, Math.round(90 * scale));
  const botMs = Number(process.env.KAZINO_BOT_MS) || 30000;
  const crash = {
    phase: 'betting',
    round: 1,
    mult: 100,
    crashAt: 100,
    started: 0,
    bets: new Map(),
    history: [],
    timer: null,
  };
  const flips = new Map();
  const battles = new Map();
  let flipSeq = 1;
  let battleSeq = 1;
  let stopped = false;

  function user(name) {
    return casino.get(name);
  }

  async function hold(u, kind, ref, amount) {
    await db.transaction(async (tx) => {
      const r = await tx.run('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?', [amount, u.id, amount]);
      if (r.changes !== 1) throw new Error('BALANCE');
      await tx.run('INSERT INTO holds (user_id, kind, ref, amount, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, kind, ref, amount, Date.now()]);
    });
    u.balance -= amount;
  }

  async function release(u, ref, credit) {
    const c = casino.capped(u, credit);
    u.balance += c;
    await db.tx([
      ['DELETE FROM holds WHERE user_id = ? AND ref = ?', [u.id, ref]],
      ['UPDATE users SET balance = balance + ? WHERE id = ?', [c, u.id]],
    ]);
    return c;
  }

  async function dropHold(u, ref) {
    await db.tx([['DELETE FROM holds WHERE user_id = ? AND ref = ?', [u.id, ref]]]);
  }

  function note(name, amount, kind) {
    const u = user(name);
    if (!u || !(amount > 0)) return;
    const day = progress.vilniusDay();
    const week = progress.weekKey(day);
    const tier = progress.tierFromWager(u.stats.wagered).tier;
    const rake = Math.floor(amount * tier.rake);
    if (rake > 0) {
      db.tx([['UPDATE users SET rake_pending = COALESCE(rake_pending, 0) + ? WHERE id = ?', [rake, u.id]]]).catch(() => {});
    }
    for (const m of progress.MISSIONS) {
      if (m.kind !== kind) continue;
      const add = m.kind === 'wager' ? amount : 1;
      const key = progress.periodKey(m.period);
      db.tx([['INSERT INTO mission_progress (user_id, mission_id, period_key, progress, claimed) VALUES (?, ?, ?, ?, 0) ON CONFLICT (user_id, mission_id, period_key) DO UPDATE SET progress = mission_progress.progress + excluded.progress', [u.id, m.id, key, add]]]).catch(() => {});
    }
    if (kind !== 'upgrade') {
      const addW = amount;
      const key = progress.periodKey('week');
      db.tx([['INSERT INTO mission_progress (user_id, mission_id, period_key, progress, claimed) VALUES (?, ?, ?, ?, 0) ON CONFLICT (user_id, mission_id, period_key) DO UPDATE SET progress = mission_progress.progress + excluded.progress', [u.id, 'w-wager', key, addW]]]).catch(() => {});
    }
    const tours = tourList(Date.now());
    for (const t of tours) {
      let score = 0;
      if (t.id === 'wager') score = kind === 'upgrade' ? 0 : amount;
      if ((t.id === 'crash' || t.id === 'crash-w') && kind === 'crash') score = amount;
      if (t.id === 'upgrade' && kind === 'upgrade') score = amount;
      if (!score) continue;
      const merge = t.id === 'wager'
        ? 'tournament_scores.score + excluded.score'
        : 'CASE WHEN excluded.score > tournament_scores.score THEN excluded.score ELSE tournament_scores.score END';
      db.tx([['INSERT INTO tournament_scores (t_key, user_id, nick, score) VALUES (?, ?, ?, ?) ON CONFLICT (t_key, user_id) DO UPDATE SET score = ' + merge + ', nick = excluded.nick', [t.key, u.id, u.name, score]]]).catch(() => {});
    }
  }

  // SQLite upsert isn't uniform. Try insert then update on failure via the catch above.
  // Postgres INSERT without ON CONFLICT throws on duplicate. Good.

  function crashPublic() {
    return {
      phase: crash.phase,
      round: crash.round,
      mult: crash.mult,
      crashAt: crash.phase === 'crashed' ? crash.crashAt : null,
      history: crash.history.slice(0, 12),
      bets: [...crash.bets.values()].map((b) => ({ name: b.name, amount: b.amount, auto: b.auto, cashed: b.cashed, at: b.at || 0 })),
    };
  }

  function publicState() {
    return {
      crash: crashPublic(),
      flips: [...flips.values()].filter((f) => f.status === 'open' || f.status === 'done').slice(-12),
      battles: [...battles.values()].slice(-8).map(battleView),
      rtp: { crash: RTP, mines: RTP, plinko: RTP, coinflip: 0.965 },
    };
  }

  function battleView(b) {
    return {
      id: b.id,
      mode: b.mode,
      cases: b.cases,
      rounds: b.rounds,
      status: b.status,
      seats: b.seats.map((s) => ({ name: s.name, bot: !!s.bot, total: s.total, skins: s.skins })),
      winner: b.winner || null,
    };
  }

  async function cashCrash(bet, at) {
    if (bet.cashed || bet.lost) return;
    bet.cashed = true;
    bet.at = at;
    const pay = Math.floor((bet.amount * at) / 100);
    const u = user(bet.name);
    if (!u) return;
    await release(u, 'crash:' + crash.round + ':' + bet.name, pay);
    const net = pay - bet.amount;
    if (net > u.stats.biggestWin) u.stats.biggestWin = net;
    note(bet.name, at, 'crash');
    casino.scheduleLeaders();
  }

  async function crashLose(bet) {
    if (bet.cashed || bet.lost) return;
    bet.lost = true;
    const u = user(bet.name);
    if (u) await dropHold(u, 'crash:' + crash.round + ':' + bet.name);
  }

  function endCrashRound() {
    crash.phase = 'crashed';
    crash.history.unshift(crash.crashAt);
    if (crash.history.length > 16) crash.history.pop();
    const jobs = [];
    for (const bet of crash.bets.values()) {
      if (!bet.cashed) jobs.push(crashLose(bet));
    }
    Promise.all(jobs).finally(() => {
      casino.changed();
      setTimeout(() => {
        if (stopped) return;
        crash.round += 1;
        crash.bets = new Map();
        crash.mult = 100;
        crash.phase = 'betting';
        crash.crashAt = crashPoint();
        casino.changed();
        crash.timer = setTimeout(runCrash, betMs);
      }, Math.max(400, Math.round(1500 * scale)));
    });
  }

  function runCrash() {
    if (stopped) return;
    crash.phase = 'running';
    crash.started = Date.now();
    crash.mult = 100;
    casino.changed();
    const step = () => {
      if (stopped || crash.phase !== 'running') return;
      crash.mult = Math.max(crash.mult + 1, Math.floor(crash.mult * 1.055));
      for (const bet of crash.bets.values()) {
        if (!bet.cashed && bet.auto && crash.mult >= bet.auto && crash.mult < crash.crashAt) cashCrash(bet, bet.auto);
      }
      if (crash.mult >= crash.crashAt) {
        endCrashRound();
        return;
      }
      casino.changed();
      crash.timer = setTimeout(step, tickMs);
    };
    crash.timer = setTimeout(step, tickMs);
  }

  async function refundHolds() {
    const rows = await db.all('SELECT user_id, COALESCE(SUM(amount), 0) AS s FROM holds GROUP BY user_id');
    if (!rows.length) return;
    const stmts = rows.filter((r) => Number(r.s) > 0).map((r) => ['UPDATE users SET balance = balance + ? WHERE id = ?', [Number(r.s), r.user_id]]);
    stmts.push(['DELETE FROM holds']);
    if (stmts.length) await db.tx(stmts);
  }

  async function settleTours() {
    const now = Date.now();
    for (const t of tourList(now)) {
      const done = await db.get('SELECT t_key FROM tournament_paid WHERE t_key = ?', [t.key]);
      if (done) continue;
      const rows = await db.all('SELECT user_id, nick, score FROM tournament_scores WHERE t_key = ? ORDER BY score DESC, user_id ASC LIMIT 3', [t.key]);
      if (!rows.length) continue;
      const shares = [0.5, 0.3, 0.2];
      const stmts = [['INSERT INTO tournament_paid (t_key, paid_at) VALUES (?, ?)', [t.key, now]]];
      rows.forEach((r, i) => {
        const prize = Math.floor(t.pool * shares[i]);
        if (prize > 0) stmts.push(['UPDATE users SET balance = balance + ? WHERE id = ?', [prize, r.user_id]]);
      });
      try {
        await db.tx(stmts);
        rows.forEach((r, i) => {
          const u = casino.get(r.nick);
          const prize = Math.floor(t.pool * shares[i]);
          if (u && prize > 0) u.balance += prize;
        });
      } catch (e) {}
    }
  }

  function start() {
    refundHolds()
      .catch(() => {})
      .finally(() => {
        crash.crashAt = crashPoint();
        crash.phase = 'betting';
        casino.changed();
        crash.timer = setTimeout(runCrash, betMs);
      });
    const iv = setInterval(() => settleTours().catch(() => {}), 60 * 1000);
    if (iv.unref) iv.unref();
    crash.sweep = iv;
  }

  function stop() {
    stopped = true;
    clearTimeout(crash.timer);
    clearInterval(crash.sweep);
  }

  function bind(socket, ctx) {
    const { me, need, fail, ok } = ctx;
    const on = (ev, fn) =>
      socket.on(ev, (...args) => {
        let cb = args[args.length - 1];
        if (typeof cb !== 'function') cb = null;
        const data = args.length > 1 || !cb ? args[0] : undefined;
        Promise.resolve()
          .then(() => fn(data, cb))
          .catch((e) => {
            console.error('Arcade', ev, e.message);
            fail(cb, 'Serverio klaida');
          });
      });

    on('crash:bet', async (d, cb) => {
      const u = need(cb);
      if (!u) return;
      d = d || {};
      const amount = d.amount;
      if (!Number.isSafeInteger(amount) || amount < 100) return fail(cb, 'Mažiausias statymas 1,00 €');
      if (crash.phase !== 'betting') return fail(cb, 'Palauk kito Crash raundo');
      if (crash.bets.has(u.name)) return fail(cb, 'Jau statai šiame raunde');
      if (u.balance < amount) return fail(cb, 'Nepakanka balanso');
      const auto = Number.isSafeInteger(d.auto) && d.auto >= 101 ? d.auto : 0;
      try {
        await hold(u, 'crash', 'crash:' + crash.round + ':' + u.name, amount);
      } catch (e) {
        u.balance += amount;
        return fail(cb, 'Nepakanka balanso');
      }
      crash.bets.set(u.name, { name: u.name, amount, auto, cashed: false });
      note(u.name, amount, 'wager');
      casino.changed();
      ok(cb, { balance: u.balance });
    });

    on('crash:cashout', async (_d, cb) => {
      const u = need(cb);
      if (!u) return;
      const bet = crash.bets.get(u.name);
      if (!bet) return fail(cb, 'Neturi statymo');
      if (crash.phase !== 'running') return fail(cb, 'Dabar negalima išeiti');
      if (crash.mult >= crash.crashAt) return fail(cb, 'Jau nukrito');
      await cashCrash(bet, crash.mult);
      casino.changed();
      ok(cb, { at: bet.at, balance: u.balance });
    });

    on('mines:start', async (d, cb) => {
      const u = need(cb);
      if (!u) return;
      d = d || {};
      const mines = d.mines;
      const bet = d.bet;
      if (!Number.isInteger(mines) || mines < 1 || mines > 24) return fail(cb, 'Minų skaičius 1–24');
      if (!Number.isSafeInteger(bet) || bet < 100) return fail(cb, 'Mažiausias statymas 1,00 €');
      if (u.mines) return fail(cb, 'Jau žaidi Mines');
      if (u.balance < bet) return fail(cb, 'Nepakanka balanso');
      const spots = new Set();
      while (spots.size < mines) spots.add(rng.int(25));
      u.balance -= bet;
      await db.tx([['UPDATE users SET balance = balance - ?, total_wagered = total_wagered + ? WHERE id = ?', [bet, bet, u.id]]]);
      u.stats.wagered += bet;
      note(u.name, bet, 'wager');
      u.mines = { bet, mines, spots, open: [], dead: false };
      casino.changed();
      ok(cb, { bet, mines, open: [], mult: 1, balance: u.balance });
    });

    on('mines:click', async (cell, cb) => {
      const u = need(cb);
      if (!u || !u.mines || u.mines.dead) return fail(cb, 'Pradėk Mines');
      cell = Number(cell);
      if (!Number.isInteger(cell) || cell < 0 || cell > 24) return fail(cb, 'Netinkamas langelis');
      if (u.mines.open.includes(cell)) return fail(cb, 'Jau atidaryta');
      if (u.mines.spots.has(cell)) {
        u.mines.dead = true;
        const spots = [...u.mines.spots];
        u.mines = null;
        casino.changed();
        return ok(cb, { boom: true, cell, spots, balance: u.balance });
      }
      u.mines.open.push(cell);
      const mult = minesMult(u.mines.mines, u.mines.open.length);
      ok(cb, { boom: false, cell, open: u.mines.open.slice(), mult, balance: u.balance });
    });

    on('mines:cashout', async (_d, cb) => {
      const u = need(cb);
      if (!u || !u.mines || !u.mines.open.length) return fail(cb, 'Pirmiausia atidaryk langelį');
      const mult = minesMult(u.mines.mines, u.mines.open.length);
      const pay = Math.floor(u.mines.bet * mult);
      const c = casino.capped(u, pay);
      u.balance += c;
      const net = c - u.mines.bet;
      if (net > u.stats.biggestWin) u.stats.biggestWin = net;
      await db.tx([['UPDATE users SET balance = balance + ?, biggest_win = CASE WHEN ? > biggest_win THEN ? ELSE biggest_win END WHERE id = ?', [c, net, net, u.id]]]);
      const spots = [...u.mines.spots];
      u.mines = null;
      casino.scheduleLeaders();
      casino.changed();
      ok(cb, { pay: c, mult, spots, balance: u.balance });
    });

    on('plinko:drop', async (d, cb) => {
      const u = need(cb);
      if (!u) return;
      d = d || {};
      const rows = d.rows;
      const risk = d.risk;
      const bet = d.bet;
      if (!Number.isInteger(rows) || rows < 8 || rows > 16) return fail(cb, 'Eilutės 8–16');
      if (!['low', 'med', 'high'].includes(risk)) return fail(cb, 'Rizika: low, med arba high');
      if (!Number.isSafeInteger(bet) || bet < 100) return fail(cb, 'Mažiausias statymas 1,00 €');
      if (u.balance < bet) return fail(cb, 'Nepakanka balanso');
      const mults = plinkoMults(rows, risk);
      let rights = 0;
      const path = [];
      for (let i = 0; i < rows; i++) {
        const right = rng.int(2) === 1;
        if (right) rights++;
        path.push(right ? 'R' : 'L');
      }
      const mult = mults[rights];
      const pay = Math.floor(bet * mult);
      u.balance -= bet;
      const c = casino.capped(u, pay);
      u.balance += c;
      const net = c - bet;
      u.stats.wagered += bet;
      u.stats.games++;
      if (net > u.stats.biggestWin) u.stats.biggestWin = net;
      await db.tx([
        ['UPDATE users SET balance = balance + ?, games_played = games_played + 1, total_wagered = total_wagered + ?, biggest_win = CASE WHEN ? > biggest_win THEN ? ELSE biggest_win END WHERE id = ?', [c - bet, bet, net, net, u.id]],
      ]);
      note(u.name, bet, 'plinko');
      casino.scheduleLeaders();
      casino.changed();
      ok(cb, { path, bin: rights, mult, pay: c, mults, balance: u.balance });
    });

    function flipView(f) {
      return { id: f.id, name: f.name, amount: f.amount, skinId: f.skinId || null, status: f.status, opponent: f.opponent || null, winner: f.winner || null, bot: !!f.bot };
    }

    async function finishFlip(f, winnerName) {
      f.status = 'done';
      f.winner = winnerName;
      const pot = coinflipPayout(f.amount);
      const w = user(winnerName);
      if (w) {
        const c = casino.capped(w, pot);
        w.balance += c;
        await db.tx([['UPDATE users SET balance = balance + ? WHERE id = ?', [c, w.id]]]);
        if (f.skinId && winnerName === f.name) {
          /* savas skinas lieka, priešininkas neturėjo skino */
        }
        if (f.oppSkin && w.items) w.items.set(f.oppSkin.itemId, f.oppSkin.meta);
      }
      if (f.skinId && winnerName !== f.name) {
        const owner = user(f.name);
        if (owner && owner.items) owner.items.delete(f.skinItem);
        await db.tx([['UPDATE inventory SET user_id = ? WHERE id = ?', [w ? w.id : f.userId, f.skinItem]]]);
      }
      casino.scheduleLeaders();
      casino.changed();
    }

    on('coinflip:create', async (d, cb) => {
      const u = need(cb);
      if (!u) return;
      d = d || {};
      const amount = d.amount;
      if (!Number.isSafeInteger(amount) || amount < 100) return fail(cb, 'Mažiausias statymas 1,00 €');
      if (u.balance < amount) return fail(cb, 'Nepakanka balanso');
      u.balance -= amount;
      await db.tx([['UPDATE users SET balance = balance - ? WHERE id = ?', [amount, u.id]]]);
      note(u.name, amount, 'wager');
      const id = flipSeq++;
      const f = { id, name: u.name, userId: u.id, amount, status: 'open', created: Date.now() };
      flips.set(id, f);
      const wait = d.bot ? 0 : botMs;
      f.timer = setTimeout(async () => {
        if (f.status !== 'open') return;
        f.status = 'playing';
        f.opponent = 'Botas';
        f.bot = true;
        const win = rng.int(2) === 0;
        const winner = win ? f.name : 'Botas';
        if (winner === f.name) await finishFlip(f, f.name);
        else {
          f.status = 'done';
          f.winner = 'Botas';
          casino.changed();
        }
      }, wait);
      casino.changed();
      ok(cb, { flip: flipView(f), balance: u.balance });
    });

    on('coinflip:join', async (id, cb) => {
      const u = need(cb);
      if (!u) return;
      const f = flips.get(Number(id));
      if (!f || f.status !== 'open') return fail(cb, 'Dvikovos nėra');
      if (f.name === u.name) return fail(cb, 'Negali žaisti prieš save');
      if (u.balance < f.amount) return fail(cb, 'Nepakanka balanso');
      clearTimeout(f.timer);
      u.balance -= f.amount;
      await db.tx([['UPDATE users SET balance = balance - ? WHERE id = ?', [f.amount, u.id]]]);
      note(u.name, f.amount, 'wager');
      f.status = 'playing';
      f.opponent = u.name;
      const winner = rng.int(2) === 0 ? f.name : u.name;
      await finishFlip(f, winner);
      ok(cb, { flip: flipView(f), balance: u.balance });
    });

    function seatsFor(mode) {
      if (mode === '1v1v1') return 3;
      if (mode === '2v2') return 4;
      return 2;
    }

    on('battle:create', async (d, cb) => {
      const u = need(cb);
      if (!u) return;
      d = d || {};
      const mode = ['1v1', '1v1v1', '2v2'].includes(d.mode) ? d.mode : '1v1';
      const rounds = Number.isInteger(d.rounds) ? Math.min(5, Math.max(1, d.rounds)) : 1;
      const cases = Array.isArray(d.cases) ? d.cases.filter((id) => skins.CASES.some((c) => c.id === id)).slice(0, 4) : [];
      if (!cases.length) return fail(cb, 'Pasirink dėžę');
      const price = cases.reduce((s, id) => s + skins.CASES.find((c) => c.id === id).price, 0) * rounds;
      if (u.balance < price) return fail(cb, 'Nepakanka balanso dėžėms');
      u.balance -= price;
      await db.tx([['UPDATE users SET balance = balance - ? WHERE id = ?', [price, u.id]]]);
      const id = battleSeq++;
      const b = {
        id,
        mode,
        cases,
        rounds,
        price,
        status: 'open',
        seats: [{ name: u.name, userId: u.id, bot: false, total: 0, skins: [] }],
        max: seatsFor(mode),
      };
      battles.set(id, b);
      casino.changed();
      ok(cb, { battle: battleView(b), balance: u.balance });
    });

    on('battle:join', async (id, cb) => {
      const u = need(cb);
      if (!u) return;
      const b = battles.get(Number(id));
      if (!b || b.status !== 'open') return fail(cb, 'Kovos nėra');
      if (b.seats.some((s) => s.name === u.name)) return fail(cb, 'Jau prisijungei');
      if (b.seats.length >= b.max) return fail(cb, 'Kova pilna');
      if (u.balance < b.price) return fail(cb, 'Nepakanka balanso');
      u.balance -= b.price;
      await db.tx([['UPDATE users SET balance = balance - ? WHERE id = ?', [b.price, u.id]]]);
      b.seats.push({ name: u.name, userId: u.id, bot: false, total: 0, skins: [] });
      casino.changed();
      ok(cb, { battle: battleView(b), balance: u.balance });
    });

    on('battle:start', async (id, cb) => {
      const u = need(cb);
      if (!u) return;
      const b = battles.get(Number(id));
      if (!b || b.status !== 'open') return fail(cb, 'Kovos nėra');
      if (b.seats[0].name !== u.name) return fail(cb, 'Tik kūrėjas pradeda');
      while (b.seats.length < b.max) b.seats.push({ name: 'Botas ' + (b.seats.length + 1), bot: true, total: 0, skins: [] });
      b.status = 'done';
      for (let r = 0; r < b.rounds; r++) {
        for (const cid of b.cases) {
          const kase = skins.CASES.find((c) => c.id === cid);
          for (const seat of b.seats) {
            const dropId = require('./rng').weighted(kase.drops.map((d) => [d.id, d.w]));
            const skin = skins.byId(dropId);
            seat.total += skin.value;
            seat.skins.push(skin.id);
            if (!seat.bot && user(seat.name)) note(seat.name, 1, 'case');
          }
        }
      }
      let best = b.seats[0];
      const tied = [best];
      for (const s of b.seats.slice(1)) {
        if (s.total > best.total) {
          best = s;
          tied.length = 0;
          tied.push(s);
        } else if (s.total === best.total) tied.push(s);
      }
      const winner = tied[rng.int(tied.length)];
      b.winner = winner.name;
      if (!winner.bot) {
        const w = user(winner.name);
        if (w) {
          for (const sid of b.seats.flatMap((s) => s.skins)) {
            const now = Date.now();
            const ins = await db.transaction(async (tx) => tx.run('INSERT INTO inventory (user_id, skin_id, created_at) VALUES (?, ?, ?)', [w.id, sid, now]));
            if (w.items) w.items.set(ins.lastId, { skinId: sid, createdAt: now });
          }
        }
      }
      casino.changed();
      ok(cb, { battle: battleView(b), balance: u.balance });
    });

    on('mission:list', async (_d, cb) => {
      const u = need(cb);
      if (!u) return;
      const rows = await db.all('SELECT mission_id, period_key, progress, claimed FROM mission_progress WHERE user_id = ?', [u.id]);
      const list = progress.MISSIONS.map((m) => {
        const key = progress.periodKey(m.period);
        const row = rows.find((r) => r.mission_id === m.id && r.period_key === key);
        return { id: m.id, title: m.title, goal: m.goal, reward: m.reward, progress: row ? Number(row.progress) : 0, claimed: row ? !!Number(row.claimed) : false, period: m.period };
      });
      ok(cb, { missions: list, day: progress.vilniusDay() });
    });

    on('mission:claim', async (id, cb) => {
      const u = need(cb);
      if (!u) return;
      const m = progress.MISSIONS.find((x) => x.id === id);
      if (!m) return fail(cb, 'Nėra tokios misijos');
      const key = progress.periodKey(m.period);
      const row = await db.get('SELECT progress, claimed FROM mission_progress WHERE user_id = ? AND mission_id = ? AND period_key = ?', [u.id, m.id, key]);
      if (!row || Number(row.progress) < m.goal) return fail(cb, 'Misija dar nebaigta');
      if (Number(row.claimed)) return fail(cb, 'Jau atsiėmei');
      const changes = await db.tx([
        ['UPDATE mission_progress SET claimed = 1 WHERE user_id = ? AND mission_id = ? AND period_key = ? AND claimed = 0', [u.id, m.id, key]],
        ['UPDATE users SET balance = balance + ? WHERE id = ?', [m.reward, u.id]],
      ]);
      if (!changes || changes[0] !== 1) return fail(cb, 'Jau atsiėmei');
      u.balance += m.reward;
      casino.changed();
      ok(cb, { reward: m.reward, balance: u.balance });
    });

    on('vip:get', async (_d, cb) => {
      const u = need(cb);
      if (!u) return;
      const info = progress.tierFromWager(u.stats.wagered);
      const rakeRow = await db.get('SELECT rake_pending, last_vip_case FROM users WHERE id = ?', [u.id]);
      ok(cb, {
        tier: info.tier.id,
        name: info.tier.name,
        xp: info.xp,
        into: info.into,
        need: info.need,
        next: info.next ? info.next.name : null,
        rake: rakeRow ? Number(rakeRow.rake_pending) || 0 : 0,
        dailyMul: info.tier.daily,
        caseId: info.tier.caseId,
        perks: 'Grąža ' + (info.tier.rake * 100).toFixed(1) + ' % nuo statymų, dienos dovana ×' + info.tier.daily,
      });
    });

    on('vip:rake', async (_d, cb) => {
      const u = need(cb);
      if (!u) return;
      const row = await db.get('SELECT rake_pending FROM users WHERE id = ?', [u.id]);
      const amt = row ? Number(row.rake_pending) || 0 : 0;
      if (amt < 1) return fail(cb, 'Dar nėra sukauptos grąžos');
      const c = casino.capped(u, amt);
      const changes = await db.tx([
        ['UPDATE users SET rake_pending = 0, balance = balance + ? WHERE id = ? AND rake_pending >= ?', [c, u.id, amt]],
      ]);
      if (!changes || changes[0] !== 1) return fail(cb, 'Nepavyko');
      u.balance += c;
      casino.changed();
      ok(cb, { amount: c, balance: u.balance });
    });

    on('vip:case', async (_d, cb) => {
      const u = need(cb);
      if (!u) return;
      const info = progress.tierFromWager(u.stats.wagered);
      if (!info.tier.caseId) return fail(cb, 'Bronza dar neturi VIP dėžės');
      const today = Number(progress.vilniusDay().replace(/-/g, ''));
      const row = await db.get('SELECT last_vip_case FROM users WHERE id = ?', [u.id]);
      if (row && Number(row.last_vip_case) === today) return fail(cb, 'Šiandienos VIP dėžę jau atidarei');
      const api = casino.skinsApi;
      if (!api) return fail(cb, 'Dėžės nepasiekiamos');
      await api.ensureItems(u);
      const marked = await db.tx([['UPDATE users SET last_vip_case = ? WHERE id = ? AND last_vip_case <> ?', [today, u.id, today]]]);
      if (!marked || marked[0] !== 1) return fail(cb, 'Šiandienos VIP dėžę jau atidarei');
      const opened = api.grantCase(u, info.tier.caseId);
      const res = opened && opened.done ? await opened.done : opened;
      if (!res || !res.ok) {
        await db.tx([['UPDATE users SET last_vip_case = ? WHERE id = ?', [row ? Number(row.last_vip_case) || 0 : 0, u.id]]]);
        return fail(cb, (res && res.error) || 'VIP dėžės atidarymas nepavyko');
      }
      ok(cb, { caseId: info.tier.caseId, skinId: res.skinId, balance: u.balance });
    });

    on('tour:list', async (_d, cb) => {
      const u = need(cb);
      if (!u) return;
      await settleTours();
      const list = [];
      for (const t of tourList(Date.now())) {
        const rows = await db.all('SELECT nick, score FROM tournament_scores WHERE t_key = ? ORDER BY score DESC, user_id ASC LIMIT 10', [t.key]);
        const meRow = await db.get('SELECT score FROM tournament_scores WHERE t_key = ? AND user_id = ?', [t.key, u.id]);
        list.push({ id: t.id, name: t.name, period: t.period, pool: t.pool, endsAt: t.endsAt, top: rows.map((r) => ({ name: r.nick, score: Number(r.score) })), me: meRow ? Number(meRow.score) : 0 });
      }
      ok(cb, { tournaments: list });
    });
  }

  return { bind, start, stop, publicState, note, crashPoint, minesMult, plinkoMults, plinkoRtp, coinflipPayout, publicConfig: () => ({ rtp: RTP, plinko: { low: plinkoRtp(8, 'low'), med: plinkoRtp(12, 'med'), high: plinkoRtp(16, 'high') } }) };
}

module.exports = { createArcade, crashPoint, minesMult, plinkoMults, plinkoRtp, coinflipPayout, RTP };
