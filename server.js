'use strict';
// Kazino su žaidimo pinigais (ne tikrais) – vienas bendras kelių žaidėjų serveris.
// Visa žaidimų logika ir atsitiktinumas vyksta serveryje, klientas tik rodo būseną.
// Paskyros, balansai ir statistika saugomi DB (SQLite failas arba PostgreSQL).
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { Db } = require('./src/db');
const { Casino } = require('./src/casino');
const A = require('./src/auth');
const { rollDice, spinSlot, slotRtp, SL_SYMS, SL_PAY3, SL_TWO_CHERRY } = require('./src/solo');
const { LT, LT_SEQ, LT_TOPM, LT_COIN, LT_PL, LT_HUNT, LT_BIG, LT_ROWS, rtp, bonusEv } = require('./src/wheel');
const { WHEEL_ORDER, RED } = require('./src/roulette');
const { TOPUP_MAX, START_BALANCE, isCents } = require('./src/money');
const skinsMod = require('./src/skins');
const progress = require('./src/progress');

const PORT = Number(process.env.PORT) || 3000;
const SESSION_DAYS = 30;
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || !!process.env.RENDER;
const ADMIN_NICK = (process.env.ADMIN_NICK || '').toLowerCase();
const LOGIN_MAX = Number(process.env.KAZINO_LOGIN_LIMIT) || 5; // nesėkmingi bandymai / 10 min. vienam slapyvardžiui
const REG_MAX = Number(process.env.KAZINO_REG_LIMIT) || 60; // registracijos / val. iš vieno IP (draugai dažnai dalijasi Wi-Fi)

async function createServer(opts = {}) {
  const db = await Db.open(opts.db || {});
  const app = express();
  app.disable('x-powered-by');
  if (TRUST_PROXY) app.set('trust proxy', 1);
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  const server = http.createServer(app);
  const io = new Server(server, {
    maxHttpBufferSize: 1e5,
    // Pirma polling (veikia per griežtus tinklus ir senesnį Safari), tada websocket.
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    cors: { origin: true, methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });
  const sessionsOf = new Map(); // socket.id -> vartotojas

  const casino = new Casino(db, (c) => {
    const common = c.commonState();
    const bjStates = new Map(c.bj.map((t) => [t.num, t.state()]));
    for (const u of c.users.values()) {
      if (!u.socketId) continue;
      const s = io.sockets.sockets.get(u.socketId);
      if (s) s.emit('state', { ...common, bj: bjStates.get(u.bj) || null, me: c.meState(u) });
    }
  });
  await casino.init();
  const skins = skinsMod.createApi(casino);

  app.get('/health', (_req, res) => res.json({ ok: true, online: casino.onlineCount(), db: db.kind }));
  app.get('/config.json', (_req, res) =>
    res.json({
      startBalance: START_BALANCE,
      topupMax: TOPUP_MAX,
      avatars: A.AVATARS,
      wheel: { LT: LT.map((x) => ({ ...x, rtp: rtp(x.key), ev: x.key[0] === 'n' ? null : bonusEv(x.key) })), LT_SEQ, LT_TOPM, LT_COIN, LT_PL, LT_HUNT, LT_BIG, LT_ROWS },
      roulette: { order: WHEEL_ORDER, red: [...RED] },
      slot: { syms: SL_SYMS, pay3: SL_PAY3, twoCherry: SL_TWO_CHERRY, rtp: slotRtp() },
      skins: skinsMod.publicConfig(),
      progress: progress.publicProgress(),
    })
  );

  const loginFails = new A.Limiter(LOGIN_MAX, 10 * 60 * 1000);
  const ipFails = new A.Limiter(Math.max(LOGIN_MAX * 6, 80), 10 * 60 * 1000);
  const regs = new A.Limiter(REG_MAX, 60 * 60 * 1000);
  const sweeper = setInterval(() => {
    loginFails.sweep();
    ipFails.sweep();
    regs.sweep();
    db.tx([['DELETE FROM sessions WHERE last_seen < ?', [Date.now() - SESSION_DAYS * 864e5]]]).catch(() => {});
  }, 10 * 60 * 1000);
  sweeper.unref();

  const ipOf = (socket) => {
    const xf = socket.handshake.headers['x-forwarded-for'];
    return TRUST_PROXY && xf ? String(xf).split(',')[0].trim() : socket.handshake.address;
  };

  const userRow = (where, p) => db.get('SELECT * FROM users WHERE ' + where, p);

  // Prijungia socket'ą prie vartotojo; senas ryšys (jei yra) atjungiamas.
  function attach(socket, row) {
    const u = casino.attachRow(row);
    if (u.socketId && u.socketId !== socket.id) {
      const old = io.sockets.sockets.get(u.socketId);
      sessionsOf.delete(u.socketId);
      if (old) {
        old.emit('kicked', 'Prisijungei kitame lange ar įrenginyje – čia atjungta');
        old.disconnect(true);
      }
      u.socketId = null;
    }
    sessionsOf.set(socket.id, u);
    casino.connect(u, socket.id);
    casino.changed();
    return u;
  }

  async function newSession(u) {
    const token = A.newToken();
    const now = Date.now();
    await db.tx([['INSERT INTO sessions (token_hash, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)', [A.tokenHash(token), u.id, now, now]]]);
    return token;
  }

  const pub = (u) => ({ name: u.name, avatar: u.avatar, admin: !!ADMIN_NICK && u.name.toLowerCase() === ADMIN_NICK });

  io.on('connection', (socket) => {
    let lastChat = 0;
    let busy = false; // vienu metu – viena autentifikacijos užklausa
    const me = () => sessionsOf.get(socket.id) || null;
    const ok = (cb, extra) => typeof cb === 'function' && cb({ ok: true, ...(extra || {}) });
    const fail = (cb, error) => typeof cb === 'function' && cb({ ok: false, error });
    const need = (cb) => {
      const u = me();
      if (!u) fail(cb, 'Pirmiausia prisijunk');
      return u;
    };
    // Pinigų veiksmo atsakymas siunčiamas tik kai DB įrašas baigtas.
    const okAfterDb = async (cb, extra) => {
      await db.flush();
      ok(cb, extra);
    };
    const on = (ev, fn) =>
      socket.on(ev, (...args) => {
        let cb = args[args.length - 1];
        if (typeof cb !== 'function') cb = null;
        const data = args.length > 1 || !cb ? args[0] : undefined;
        Promise.resolve()
          .then(() => fn(data, cb))
          .catch((e) => {
            console.error('Klaida', ev, e);
            fail(cb, 'Serverio klaida');
          });
      });

    // Sesijos atkūrimas pagal žetoną iš prisijungimo (handshake).
    const hsToken = socket.handshake.auth && socket.handshake.auth.token;
    let resuming = null;
    if (typeof hsToken === 'string' && hsToken.length > 0 && hsToken.length < 200) {
      resuming = (async () => {
        const row = await db.get('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.last_seen > ?', [A.tokenHash(hsToken), Date.now() - SESSION_DAYS * 864e5]);
        if (!socket.connected) return;
        if (!row) return socket.emit('auth', { ok: false, error: 'Sesija baigėsi – prisijunk iš naujo' });
        db.tx([['UPDATE sessions SET last_seen = ? WHERE token_hash = ?', [Date.now(), A.tokenHash(hsToken)]]]);
        const u = attach(socket, row);
        socket.emit('auth', { ok: true, user: pub(u), resumed: true });
      })()
        .catch((e) => console.error('Sesijos klaida', e))
        .finally(() => (resuming = null));
    }

    on('register', async (d, cb) => {
      d = d || {};
      if (resuming) await resuming; // pirmiausia baigiamas automatinis sesijos atkūrimas
      if (me()) return fail(cb, 'Jau prisijungęs');
      if (busy) return fail(cb, 'Palauk');
      const nick = A.normNick(d.nick);
      if (!nick) return fail(cb, 'Slapyvardis: 3–16 raidžių, skaičių arba _');
      if (!A.validPassword(d.password)) return fail(cb, 'Slaptažodis turi būti 6–100 simbolių');
      const ip = ipOf(socket);
      if (regs.blocked(ip)) return fail(cb, 'Per daug naujų paskyrų iš šio interneto adreso per valandą. Draugai tame pačiame Wi-Fi dalijasi vienu adresu – palauk ir bandyk vėliau.');
      busy = true;
      try {
        const lc = A.nickKey(nick);
        if (await userRow('nick_lc = ?', [lc])) return fail(cb, 'Toks slapyvardis jau užimtas');
        const hash = await A.hashPassword(d.password);
        const avatar = A.AVATARS.includes(d.avatar) ? d.avatar : A.AVATARS[0];
        const now = Date.now();
        try {
          await db.tx([['INSERT INTO users (nick, nick_lc, pass_hash, avatar, balance, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)', [nick, lc, hash, avatar, START_BALANCE, now, now]]]);
        } catch (e) {
          return fail(cb, 'Toks slapyvardis jau užimtas');
        }
        regs.hit(ip);
        const row = await userRow('nick_lc = ?', [lc]);
        const token = await newSession(row);
        if (!socket.connected) return;
        const u = attach(socket, row);
        casino.scheduleLeaders();
        ok(cb, { token, user: pub(u) });
      } finally {
        busy = false;
      }
    });

    on('login', async (d, cb) => {
      d = d || {};
      if (resuming) await resuming; // pirmiausia baigiamas automatinis sesijos atkūrimas
      if (me()) return fail(cb, 'Jau prisijungęs');
      if (busy) return fail(cb, 'Palauk');
      const nick = typeof d.nick === 'string' ? d.nick.normalize('NFC').trim().slice(0, 32) : '';
      const pw = typeof d.password === 'string' ? d.password.slice(0, 200) : '';
      if (!nick || !pw) return fail(cb, 'Įvesk slapyvardį ir slaptažodį');
      const ip = ipOf(socket);
      const lk = ip + '|' + A.nickKey(nick);
      if (loginFails.blocked(lk) || ipFails.blocked(ip)) {
        const s = Math.ceil(Math.max(loginFails.retryIn(lk), ipFails.retryIn(ip)) / 60000);
        return fail(cb, 'Per daug nesėkmingų bandymų. Pabandyk po ' + s + ' min.');
      }
      busy = true;
      try {
        const row = await userRow('nick_lc = ?', [A.nickKey(nick)]);
        const good = await A.verifyPassword(pw, row ? row.pass_hash : A.DUMMY);
        if (!row || !good) {
          loginFails.hit(lk);
          ipFails.hit(ip);
          return fail(cb, 'Neteisingas slapyvardis arba slaptažodis');
        }
        loginFails.reset(lk);
        const token = await newSession(row);
        if (!socket.connected) return;
        const u = attach(socket, row);
        ok(cb, { token, user: pub(u) });
      } finally {
        busy = false;
      }
    });

    on('logout', async (d, cb) => {
      const u = need(cb);
      if (!u) return;
      if (d && typeof d.token === 'string') await db.tx([['DELETE FROM sessions WHERE token_hash = ?', [A.tokenHash(d.token)]]]);
      sessionsOf.delete(socket.id);
      casino.disconnect(socket.id);
      ok(cb);
    });

    on('profile:avatar', async (a, cb) => {
      const u = need(cb);
      if (!u) return;
      if (!A.AVATARS.includes(a)) return fail(cb, 'Neteisingas avataras');
      u.avatar = a;
      await db.tx([['UPDATE users SET avatar = ? WHERE id = ?', [a, u.id]]]);
      casino.scheduleLeaders();
      casino.changed();
      ok(cb);
    });

    on('profile:get', async (nick, cb) => {
      if (!need(cb)) return;
      if (typeof nick !== 'string') return fail(cb, 'Nerasta');
      const live = casino.get(nick);
      const row = await userRow('nick_lc = ?', [A.nickKey(nick)]);
      if (!row) return fail(cb, 'Žaidėjas nerastas');
      ok(cb, {
        profile: {
          name: row.nick,
          avatar: live ? live.avatar : row.avatar,
          balance: live ? live.balance : row.balance,
          games: live ? live.stats.games : row.games_played,
          biggestWin: live ? live.stats.biggestWin : row.biggest_win,
          wagered: live ? live.stats.wagered : row.total_wagered,
          since: row.created_at,
          online: !!(live && live.socketId),
        },
      });
    });

    on('chat', (text, cb) => {
      const u = need(cb);
      if (!u) return;
      if (typeof text !== 'string') return fail(cb, 'Tuščia žinutė');
      text = text.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
      if (!text) return fail(cb, 'Tuščia žinutė');
      const now = Date.now();
      if (now - lastChat < 700) return fail(cb, 'Per greitai');
      lastChat = now;
      casino.addChat(u.name, text, u.avatar);
      ok(cb);
    });

    on('bonus:claim', async (_d, cb) => {
      const u = need(cb);
      if (!u) return;
      const today = progress.utcDay();
      const row = await db.get('SELECT last_daily FROM users WHERE id = ?', [u.id]);
      const prev = row ? Number(row.last_daily) || 0 : 0;
      if (prev === today) return fail(cb, 'Šiandienos dovaną jau paėmei. Kita bus rytoj (pasaulio laiku, UTC).');
      const amount = casino.capped(u, progress.DAILY_BONUS);
      if (amount <= 0) return fail(cb, 'Balansas jau per didelis šiai dovanai.');
      u.balance += amount;
      try {
        const changes = await db.tx([['UPDATE users SET balance = balance + ?, last_daily = ? WHERE id = ? AND last_daily = ?', [amount, today, u.id, prev]]]);
        if (!changes || changes[0] !== 1) {
          u.balance -= amount;
          return fail(cb, 'Šiandienos dovaną jau paėmei. Kita bus rytoj (pasaulio laiku, UTC).');
        }
      } catch (e) {
        u.balance -= amount;
        casino.changed();
        return fail(cb, 'Dovanos įrašyti nepavyko. Bandyk dar kartą.');
      }
      casino.scheduleLeaders();
      casino.changed();
      ok(cb, { amount: amount, balance: u.balance, day: today });
    });

    on('topup', async (amount, cb) => {
      const u = need(cb);
      if (!u) return;
      if (!isCents(amount) || amount > TOPUP_MAX) return fail(cb, 'Suma turi būti nuo 0,01 iki 1 000 000,00 €');
      casino.topup(u, amount);
      await okAfterDb(cb, { balance: u.balance });
    });

    on('resetBalance', async (_d, cb) => {
      const u = need(cb);
      if (!u) return;
      if (casino.hasActiveBets(u.name)) return fail(cb, 'Palauk, kol baigsis raundas su tavo statymais');
      casino.resetBalance(u);
      await okAfterDb(cb, { balance: u.balance });
    });

    on('admin:reset', async (nick, cb) => {
      const u = need(cb);
      if (!u) return;
      if (!ADMIN_NICK || u.name.toLowerCase() !== ADMIN_NICK) return fail(cb, 'Tik administratoriui');
      if (typeof nick !== 'string') return fail(cb, 'Nurodyk slapyvardį');
      const t = casino.get(nick);
      if (t) {
        if (casino.hasActiveBets(t.name)) return fail(cb, 'Žaidėjas turi aktyvių statymų');
        casino.resetBalance(t);
      } else {
        const row = await userRow('nick_lc = ?', [A.nickKey(nick)]);
        if (!row) return fail(cb, 'Žaidėjas nerastas');
        await db.tx([['UPDATE users SET balance = ? WHERE id = ?', [START_BALANCE, row.id]]]);
        casino.scheduleLeaders();
      }
      casino.log('Administratorius atstatė ' + nick + ' balansą');
      await okAfterDb(cb);
    });

    const table = (u, g) => (g === 'rl' ? casino.rl : g === 'lt' ? casino.lt : g === 'bj' ? casino.bjOf(u) : null);

    on('bj:sit', (num, cb) => {
      const u = need(cb);
      if (!u) return;
      if (num !== 'new' && !Number.isInteger(num)) return fail(cb, 'Neteisingas stalas');
      const e = casino.sit(u, num);
      e ? fail(cb, e) : ok(cb, { table: u.bj });
    });

    on('bet', async (d, cb) => {
      const u = need(cb);
      if (!u) return;
      d = d || {};
      const t = table(u, d.game);
      if (!t) return fail(cb, 'Nežinomas žaidimas');
      const e = t.placeBet(u.name, d.key, d.amount);
      e ? fail(cb, e) : await okAfterDb(cb);
    });

    for (const [ev, fn] of [
      ['clear', 'clearBets'],
      ['rebet', 'rebet'],
      ['ready', 'setReady'],
    ]) {
      on(ev, async (d, cb) => {
        const u = need(cb);
        if (!u) return;
        const t = table(u, d && d.game);
        if (!t) return fail(cb, 'Nežinomas žaidimas');
        const e = t[fn](u.name);
        e ? fail(cb, e) : await okAfterDb(cb);
      });
    }

    on('bj:act', async (action, cb) => {
      const u = need(cb);
      if (!u) return;
      const t = casino.bjOf(u);
      if (!t) return fail(cb, 'Nesi prie stalo');
      const e = t.act(u.name, action);
      e ? fail(cb, e) : await okAfterDb(cb);
    });

    on('lt:pick', (i, cb) => {
      const u = need(cb);
      if (!u) return;
      const e = casino.lt.pick(u.name, i);
      e ? fail(cb, e) : ok(cb);
    });

    on('dice:roll', async (d, cb) => {
      const u = need(cb);
      if (!u) return;
      const r = rollDice(casino, u.name, d || {});
      r.error ? fail(cb, r.error) : await okAfterDb(cb, r);
    });

    on('slot:spin', async (d, cb) => {
      const u = need(cb);
      if (!u) return;
      const r = spinSlot(casino, u.name, d || {});
      r.error ? fail(cb, r.error) : await okAfterDb(cb, r);
    });

    const skinOp = async (u, cb, run) => {
      await skins.ensureItems(u);
      const r = run();
      if (r.error) return fail(cb, r.error);
      const done = await r.done;
      if (!done.ok) return fail(cb, done.error || 'Nepavyko');
      ok(cb, done);
    };

    on('skins:get', async (_d, cb) => {
      const u = need(cb);
      if (!u) return;
      await skins.ensureItems(u);
      ok(cb, { items: skins.dump(u), history: await skins.history(u) });
    });

    on('case:open', async (id, cb) => {
      const u = need(cb);
      if (!u) return;
      if (typeof id !== 'string') return fail(cb, 'Nežinoma dėžė');
      await skinOp(u, cb, () => skins.openCase(u, id));
    });

    on('shop:buy', async (id, cb) => {
      const u = need(cb);
      if (!u) return;
      if (typeof id !== 'string') return fail(cb, 'Nežinomas skinas');
      await skinOp(u, cb, () => skins.buy(u, id));
    });

    on('skin:sell', async (ids, cb) => {
      const u = need(cb);
      if (!u) return;
      await skinOp(u, cb, () => skins.sell(u, ids));
    });

    on('upgrade:roll', async (body, cb) => {
      const u = need(cb);
      if (!u) return;
      await skinOp(u, cb, () => skins.upgrade(u, body));
    });

    socket.on('disconnect', () => {
      if (sessionsOf.has(socket.id)) {
        sessionsOf.delete(socket.id);
        casino.disconnect(socket.id);
      }
    });
  });

  async function close() {
    clearInterval(sweeper);
    casino.destroy();
    io.close();
    await new Promise((r) => server.close(() => r()));
    await db.close();
  }

  return { app, server, io, db, casino, close };
}

if (require.main === module) {
  createServer()
    .then(({ server, db }) => {
      server.listen(PORT, () => console.log('Kazino (žaidimo pinigai) veikia: http://localhost:' + PORT + ' · DB: ' + (db.kind === 'pg' ? 'PostgreSQL' : 'SQLite ' + db.file)));
      const stop = async (sig) => {
        console.log(sig + ': išsaugoma ir stabdoma…');
        // Neužbaigti statymai lieka open_bets ir bus grąžinti kitą kartą paleidus.
        await db.flush();
        process.exit(0);
      };
      process.on('SIGTERM', () => stop('SIGTERM'));
      process.on('SIGINT', () => stop('SIGINT'));
    })
    .catch((e) => {
      console.error('Nepavyko paleisti serverio:', e.message);
      process.exit(1);
    });
}

module.exports = { createServer };
