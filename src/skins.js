'use strict';
// Originalūs išgalvoti ginklų skinai (ne Counter-Strike / Valve pavadinimai).
// Vertės – centais. Dėžių kaina parenkama taip, kad teorinis grąžinimas būtų ~90 %.
// Upgraderis: tikimybė = įnašas / tikslas × 93 %, apvalinta žemyn, ribos 1–80 %.
const { fmt, BALANCE_CAP } = require('./money');
const rng = require('./rng');

const ROLL_DEN = 10000;
const KEEP_BP = 9300; // 93,00 % – namų dalis 7 %
const MIN_BP = 100; // 1,00 %
const MAX_BP = 8000; // 80,00 %
const SELL_NUM = 90;
const SELL_DEN = 100;
const MAX_ITEMS = 200;
const MAX_BATCH = 12;
const TARGET_RTP = 0.9;

const RARITIES = [
  { id: 'gatve', name: 'Gatvės', color: '#b0c3d9', rank: 0 },
  { id: 'dirbtuves', name: 'Dirbtuvės', color: '#5e98d9', rank: 1 },
  { id: 'lauko', name: 'Lauko', color: '#4b69ff', rank: 2 },
  { id: 'ribotas', name: 'Ribotas', color: '#8847ff', rank: 3 },
  { id: 'slaptas', name: 'Slaptas', color: '#d32ce6', rank: 4 },
  { id: 'mitinis', name: 'Mitinis', color: '#eb4b4b', rank: 5 },
  { id: 'legendinis', name: 'Legendinis', color: '#e4ae39', rank: 6 },
];

const WEARS = [
  { id: 'gamyklinis', name: 'Gamyklinis' },
  { id: 'beveik', name: 'Beveik naujas' },
  { id: 'isbandytas', name: 'Išbandytas' },
  { id: 'nusidevejes', name: 'Nusidėvėjęs' },
  { id: 'musio', name: 'Mūšio randai' },
];

const WEAPONS = [
  { id: 'ak', name: 'AK-X' },
  { id: 'varnis', name: 'Varnis-9' },
  { id: 'pulsas', name: 'Pulsas' },
  { id: 'medziotojas', name: 'Medžiotojas' },
  { id: 'sratas', name: 'Šratas-12' },
  { id: 'kibirkstis', name: 'Kibirkštis' },
  { id: 'asmenys', name: 'Ašmenys' },
  { id: 'lokys', name: 'Lokys' },
];

const SKINS = [
  { id: 'vx-dulkes', weapon: 'varnis', name: 'Varnis-9 | Pilkos dulkės', rarity: 'gatve', wear: 'musio', value: 200 },
  { id: 'sr-smelis', weapon: 'sratas', name: 'Šratas-12 | Smėlio pūga', rarity: 'gatve', wear: 'nusidevejes', value: 350 },
  { id: 'ps-juosta', weapon: 'pulsas', name: 'Pulsas | Ruda juosta', rarity: 'gatve', wear: 'isbandytas', value: 500 },
  { id: 'ak-samanos', weapon: 'ak', name: 'AK-X | Samanų dryžiai', rarity: 'gatve', wear: 'beveik', value: 800 },
  { id: 'kb-viela', weapon: 'kibirkstis', name: 'Kibirkštis | Mėlyna viela', rarity: 'dirbtuves', wear: 'isbandytas', value: 1500 },
  { id: 'md-rasa', weapon: 'medziotojas', name: 'Medžiotojas | Ryto rasa', rarity: 'dirbtuves', wear: 'nusidevejes', value: 2200 },
  { id: 'vx-ledas', weapon: 'varnis', name: 'Varnis-9 | Ledo brūkšnys', rarity: 'dirbtuves', wear: 'beveik', value: 3200 },
  { id: 'sr-rukas', weapon: 'sratas', name: 'Šratas-12 | Uosto rūkas', rarity: 'dirbtuves', wear: 'gamyklinis', value: 4500 },
  { id: 'ak-baltija', weapon: 'ak', name: 'AK-X | Baltijos rūkas', rarity: 'lauko', wear: 'isbandytas', value: 8000 },
  { id: 'ps-samanos', weapon: 'pulsas', name: 'Pulsas | Nakties samanos', rarity: 'lauko', wear: 'beveik', value: 12000 },
  { id: 'as-vilkas', weapon: 'asmenys', name: 'Ašmenys | Sidabro vilkas', rarity: 'lauko', wear: 'gamyklinis', value: 18000 },
  { id: 'lk-ziedas', weapon: 'lokys', name: 'Lokys | Geležies žiedas', rarity: 'lauko', wear: 'musio', value: 25000 },
  { id: 'ak-gintaras', weapon: 'ak', name: 'AK-X | Gintarinis žaibas', rarity: 'ribotas', wear: 'beveik', value: 40000 },
  { id: 'md-dumas', weapon: 'medziotojas', name: 'Medžiotojas | Purpurinis dūmas', rarity: 'ribotas', wear: 'isbandytas', value: 65000 },
  { id: 'kb-vainikas', weapon: 'kibirkstis', name: 'Kibirkštis | Ugnies vainikas', rarity: 'ribotas', wear: 'gamyklinis', value: 90000 },
  { id: 'as-menulis', weapon: 'asmenys', name: 'Ašmenys | Mėnulio pjūvis', rarity: 'ribotas', wear: 'beveik', value: 130000 },
  { id: 'ak-aurora', weapon: 'ak', name: 'AK-X | Auroros gija', rarity: 'slaptas', wear: 'isbandytas', value: 250000 },
  { id: 'md-erelis', weapon: 'medziotojas', name: 'Medžiotojas | Auksinis erelis', rarity: 'slaptas', wear: 'beveik', value: 400000 },
  { id: 'as-gintaras', weapon: 'asmenys', name: 'Ašmenys | Kruvinas gintaras', rarity: 'slaptas', wear: 'gamyklinis', value: 600000 },
  { id: 'lk-audra', weapon: 'lokys', name: 'Lokys | Audros širdis', rarity: 'slaptas', wear: 'musio', value: 900000 },
  { id: 'ak-saule', weapon: 'ak', name: 'AK-X | Saulėlydžio mitas', rarity: 'mitinis', wear: 'beveik', value: 1500000 },
  { id: 'as-feniksas', weapon: 'asmenys', name: 'Ašmenys | Fenikso plunksna', rarity: 'mitinis', wear: 'gamyklinis', value: 2500000 },
  { id: 'md-zvaigzde', weapon: 'medziotojas', name: 'Medžiotojas | Žvaigždžių lankas', rarity: 'mitinis', wear: 'isbandytas', value: 4000000 },
  { id: 'ps-neon', weapon: 'pulsas', name: 'Pulsas | Neono upė', rarity: 'mitinis', wear: 'gamyklinis', value: 6000000 },
  { id: 'as-karuna', weapon: 'asmenys', name: 'Ašmenys | Karūnos ašara', rarity: 'legendinis', wear: 'gamyklinis', value: 12000000 },
  { id: 'ak-kalve', weapon: 'ak', name: 'AK-X | Dievų kalvė', rarity: 'legendinis', wear: 'beveik', value: 25000000 },
  { id: 'lk-amzinybe', weapon: 'lokys', name: 'Lokys | Amžinybės būgnas', rarity: 'legendinis', wear: 'gamyklinis', value: 50000000 },
];

const SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));
const RARITY_BY_ID = new Map(RARITIES.map((r) => [r.id, r]));

function byId(id) {
  return SKIN_BY_ID.get(id) || null;
}

function chanceBp(input, target) {
  if (!Number.isSafeInteger(input) || !Number.isSafeInteger(target) || input <= 0 || target <= 0) return null;
  const raw = Math.floor((input * KEEP_BP) / target);
  if (raw < MIN_BP) return null;
  return Math.min(raw, MAX_BP);
}

function rawChanceBp(input, target) {
  if (!Number.isSafeInteger(input) || !Number.isSafeInteger(target) || input <= 0 || target <= 0) return null;
  return Math.floor((input * KEEP_BP) / target);
}

function minInputFor(target) {
  if (!Number.isSafeInteger(target) || target <= 0) return null;
  return Math.ceil((MIN_BP * target) / KEEP_BP);
}

function upgradeWins(roll, bp, side) {
  if (!Number.isSafeInteger(roll) || roll < 0 || roll >= ROLL_DEN) return false;
  if (!Number.isSafeInteger(bp) || bp < MIN_BP || bp > MAX_BP) return false;
  if (side === 'over') return roll >= ROLL_DEN - bp;
  if (side === 'under') return roll < bp;
  return false;
}

function sellPayout(value) {
  if (!Number.isSafeInteger(value) || value <= 0) return 0;
  return Math.floor((value * SELL_NUM) / SELL_DEN);
}

function caseMath(drops) {
  const weight = drops.reduce((s, d) => s + d.w, 0);
  const ev = drops.reduce((s, d) => s + d.w * byId(d.id).value, 0) / weight;
  const price = Math.max(1, Math.round(ev / TARGET_RTP));
  return {
    weight,
    ev: Math.round(ev),
    price,
    rtp: ev / price,
    drops: drops.map((d) => ({ id: d.id, w: d.w, p: d.w / weight })),
  };
}

const CASE_DEFS = [
  {
    id: 'smelis',
    name: 'Smėlio dėžė',
    blurb: 'Dažniausiai Gatvės ir Dirbtuvės. Retas šuolis iki Lauko.',
    drops: [
      { id: 'vx-dulkes', w: 420 },
      { id: 'sr-smelis', w: 280 },
      { id: 'ps-juosta', w: 170 },
      { id: 'ak-samanos', w: 80 },
      { id: 'kb-viela', w: 35 },
      { id: 'md-rasa', w: 12 },
      { id: 'vx-ledas', w: 3 },
    ],
  },
  {
    id: 'naktis',
    name: 'Nakties dėžė',
    blurb: 'Dirbtuvės ir Lauko, su maža Riboto tikimybe.',
    drops: [
      { id: 'ak-samanos', w: 120 },
      { id: 'kb-viela', w: 220 },
      { id: 'md-rasa', w: 200 },
      { id: 'vx-ledas', w: 160 },
      { id: 'sr-rukas', w: 130 },
      { id: 'ak-baltija', w: 90 },
      { id: 'ps-samanos', w: 50 },
      { id: 'as-vilkas', w: 20 },
      { id: 'lk-ziedas', w: 8 },
      { id: 'ak-gintaras', w: 2 },
    ],
  },
  {
    id: 'perkun',
    name: 'Perkūno dėžė',
    blurb: 'Lauko ir Ribotas pagrindas, retas Slaptas.',
    drops: [
      { id: 'ak-baltija', w: 180 },
      { id: 'ps-samanos', w: 180 },
      { id: 'as-vilkas', w: 160 },
      { id: 'lk-ziedas', w: 150 },
      { id: 'ak-gintaras', w: 140 },
      { id: 'md-dumas', w: 90 },
      { id: 'kb-vainikas', w: 55 },
      { id: 'as-menulis', w: 30 },
      { id: 'ak-aurora', w: 12 },
      { id: 'md-erelis', w: 3 },
    ],
  },
  {
    id: 'karuna',
    name: 'Karūnos dėžė',
    blurb: 'Aukštesnės pakopos. Legendinis – labai retas, ne garantija.',
    drops: [
      { id: 'ak-gintaras', w: 160 },
      { id: 'md-dumas', w: 150 },
      { id: 'kb-vainikas', w: 140 },
      { id: 'as-menulis', w: 130 },
      { id: 'ak-aurora', w: 150 },
      { id: 'md-erelis', w: 110 },
      { id: 'as-gintaras', w: 70 },
      { id: 'lk-audra', w: 45 },
      { id: 'ak-saule', w: 25 },
      { id: 'as-feniksas', w: 12 },
      { id: 'md-zvaigzde', w: 5 },
      { id: 'ps-neon', w: 2 },
      { id: 'as-karuna', w: 1 },
    ],
  },
];

const CASES = CASE_DEFS.map((c) => {
  const m = caseMath(c.drops);
  return { id: c.id, name: c.name, blurb: c.blurb, ...m };
});
const CASE_BY_ID = new Map(CASES.map((c) => [c.id, c]));

function rollDrop(kase) {
  const id = rng.weighted(kase.drops.map((d) => [d.id, d.w]));
  return byId(id);
}

function parseIdList(xs, max) {
  if (!Array.isArray(xs) || xs.length > max) return null;
  const ids = xs.map((n) => Number(n));
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  if (new Set(ids).size !== ids.length) return null;
  return ids;
}

function parseCash(n) {
  if (n == null || n === 0) return 0;
  if (!Number.isSafeInteger(n) || n < 0) return null;
  return n;
}

function mapEvent(row) {
  let payload = {};
  try {
    payload = JSON.parse(row.payload);
  } catch (_) {}
  return { id: Number(row.id), nick: row.nick, kind: row.kind, payload, createdAt: Number(row.created_at) };
}

async function loadFeed(db) {
  const rows = await db.all("SELECT id, nick, kind, payload, created_at FROM skin_events WHERE kind IN ('case', 'upgrade') ORDER BY id DESC LIMIT 30");
  return rows.map(mapEvent);
}

function publicConfig() {
  return {
    rarities: RARITIES,
    wears: WEARS,
    weapons: WEAPONS,
    items: SKINS,
    cases: CASES.map((c) => ({
      id: c.id,
      name: c.name,
      blurb: c.blurb,
      price: c.price,
      ev: c.ev,
      rtp: c.rtp,
      drops: c.drops.map((d) => ({ id: d.id, p: d.p })),
    })),
    upgrade: { keepBp: KEEP_BP, rollDen: ROLL_DEN, minBp: MIN_BP, maxBp: MAX_BP, edge: 1 - KEEP_BP / ROLL_DEN },
    sell: { num: SELL_NUM, den: SELL_DEN },
    maxItems: MAX_ITEMS,
  };
}

function createApi(casino) {
  const db = casino.db;
  const loading = new Map();

  function pushFeed(ev) {
    if (ev.kind !== 'case' && ev.kind !== 'upgrade') return;
    casino.skinFeed.unshift(ev);
    if (casino.skinFeed.length > 30) casino.skinFeed.length = 30;
    casino.changed();
  }

  function dump(u) {
    return [...u.items.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([id, v]) => ({ id, skinId: v.skinId, createdAt: v.createdAt }));
  }

  function ensureItems(u) {
    if (u.items) return Promise.resolve();
    let p = loading.get(u.id);
    if (!p) {
      p = db
        .all('SELECT id, skin_id AS skinId, created_at AS createdAt FROM inventory WHERE user_id = ? ORDER BY id', [u.id])
        .then((rows) => {
          if (!u.items) u.items = new Map(rows.map((r) => [Number(r.id), { skinId: r.skinId, createdAt: Number(r.createdAt) }]));
        })
        .finally(() => loading.delete(u.id));
      loading.set(u.id, p);
    }
    return p;
  }

  function fail(msg) {
    return { error: msg };
  }

  async function history(u) {
    const rows = await db.all('SELECT id, nick, kind, payload, created_at FROM skin_events WHERE user_id = ? ORDER BY id DESC LIMIT 40', [u.id]);
    return rows.map(mapEvent);
  }

  function openCase(u, caseId) {
    const kase = CASE_BY_ID.get(caseId);
    if (!kase) return fail('Nežinoma dėžė');
    if (!u.items) return fail('Inventorius dar kraunasi');
    if (u.items.size >= MAX_ITEMS) return fail('Inventorius pilnas (' + MAX_ITEMS + ')');
    if (u.balance < kase.price) return fail('Nepakanka balanso');
    const skin = rollDrop(kase);
    const now = Date.now();
    u.balance -= kase.price;
    casino.scheduleLeaders();
    casino.changed();
    const payload = { caseId: kase.id, skinId: skin.id, value: skin.value };
    const done = db
      .transaction(async (tx) => {
        const upd = await tx.run('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?', [kase.price, u.id, kase.price]);
        if (upd.changes !== 1) throw new Error('BALANCE');
        const ins = await tx.run('INSERT INTO inventory (user_id, skin_id, created_at) VALUES (?, ?, ?)', [u.id, skin.id, now]);
        const ev = await tx.run('INSERT INTO skin_events (user_id, nick, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, 'case', JSON.stringify(payload), now]);
        return { item: { id: ins.lastId, skinId: skin.id, createdAt: now }, eventId: ev.lastId };
      })
      .then(({ item, eventId }) => {
        u.items.set(item.id, { skinId: item.skinId, createdAt: item.createdAt });
        pushFeed({ id: eventId, nick: u.name, kind: 'case', payload, createdAt: now });
        return { ok: true, item, skinId: skin.id, balance: u.balance, caseId: kase.id, items: dump(u) };
      })
      .catch(() => {
        u.balance += kase.price;
        casino.changed();
        return { ok: false, error: 'Dėžės atidarymas nutrauktas – balansas grąžintas' };
      });
    return { done };
  }

  function buy(u, skinId) {
    const skin = byId(skinId);
    if (!skin) return fail('Nežinomas skinas');
    if (!u.items) return fail('Inventorius dar kraunasi');
    if (u.items.size >= MAX_ITEMS) return fail('Inventorius pilnas (' + MAX_ITEMS + ')');
    if (u.balance < skin.value) return fail('Nepakanka balanso');
    const now = Date.now();
    u.balance -= skin.value;
    casino.scheduleLeaders();
    casino.changed();
    const payload = { skinId: skin.id, value: skin.value };
    const done = db
      .transaction(async (tx) => {
        const upd = await tx.run('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?', [skin.value, u.id, skin.value]);
        if (upd.changes !== 1) throw new Error('BALANCE');
        const ins = await tx.run('INSERT INTO inventory (user_id, skin_id, created_at) VALUES (?, ?, ?)', [u.id, skin.id, now]);
        await tx.run('INSERT INTO skin_events (user_id, nick, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, 'buy', JSON.stringify(payload), now]);
        return { id: ins.lastId, skinId: skin.id, createdAt: now };
      })
      .then((item) => {
        u.items.set(item.id, { skinId: item.skinId, createdAt: item.createdAt });
        casino.changed();
        return { ok: true, item, skinId: skin.id, balance: u.balance, items: dump(u) };
      })
      .catch(() => {
        u.balance += skin.value;
        casino.changed();
        return { ok: false, error: 'Pirkimas nutrauktas – balansas grąžintas' };
      });
    return { done };
  }

  function sell(u, rawIds) {
    const ids = parseIdList(Array.isArray(rawIds) ? rawIds : [rawIds], 50);
    if (!ids || !ids.length) return fail('Pasirink daiktą');
    if (!u.items) return fail('Inventorius dar kraunasi');
    let payout = 0;
    const removed = [];
    for (const id of ids) {
      const it = u.items.get(id);
      if (!it) return fail('Tokio daikto neturi');
      const skin = byId(it.skinId);
      if (!skin) return fail('Nežinomas daiktas');
      payout += sellPayout(skin.value);
      removed.push([id, it, skin]);
    }
    if (u.balance > BALANCE_CAP - payout) return fail('Balansas viršytų leistiną ribą');
    for (const [id] of removed) u.items.delete(id);
    u.balance += payout;
    const now = Date.now();
    casino.scheduleLeaders();
    casino.changed();
    const payload = { ids, payout, skins: removed.map(([, , s]) => s.id) };
    const ph = ids.map(() => '?').join(',');
    const done = db
      .transaction(async (tx) => {
        const del = await tx.run('DELETE FROM inventory WHERE user_id = ? AND id IN (' + ph + ')', [u.id, ...ids]);
        if (del.changes !== ids.length) throw new Error('ITEMS');
        await tx.run('UPDATE users SET balance = balance + ? WHERE id = ?', [payout, u.id]);
        await tx.run('INSERT INTO skin_events (user_id, nick, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, 'sell', JSON.stringify(payload), now]);
      })
      .then(() => ({ ok: true, payout, removedIds: ids, balance: u.balance, items: dump(u) }))
      .catch(() => {
        u.balance -= payout;
        for (const [id, it] of removed) u.items.set(id, it);
        casino.changed();
        return { ok: false, error: 'Pardavimas nutrauktas – daiktai grąžinti' };
      });
    return { done };
  }

  function upgrade(u, body) {
    body = body || {};
    const ids = parseIdList(body.items || [], MAX_BATCH);
    if (!ids) return fail('Neteisingi daiktai');
    const cash = parseCash(body.cash);
    if (cash == null) return fail('Neteisinga suma');
    const target = byId(body.target);
    if (!target) return fail('Neteisingas tikslas');
    const side = body.side == null || body.side === 'under' ? 'under' : body.side === 'over' ? 'over' : null;
    if (!side) return fail('Pasirink „žemiau“ arba „virš“');
    if (!u.items) return fail('Inventorius dar kraunasi');
    if (cash > u.balance) return fail('Nepakanka balanso');
    if (!ids.length && !cash) return fail('Įdėk skiną arba žaidimo pinigų');
    if (!ids.length && u.items.size >= MAX_ITEMS) return fail('Inventorius pilnas (' + MAX_ITEMS + ')');
    let skinVal = 0;
    const removed = [];
    for (const id of ids) {
      const it = u.items.get(id);
      if (!it) return fail('Tokio daikto neturi');
      const skin = byId(it.skinId);
      if (!skin) return fail('Nežinomas daiktas');
      skinVal += skin.value;
      removed.push([id, it]);
    }
    const input = skinVal + cash;
    const bp = chanceBp(input, target.value);
    if (bp == null) {
      const need = minInputFor(target.value);
      return fail('Per maža tikimybė (mažiau nei 1 %). Šiam tikslui reikia bent ' + fmt(need) + '.');
    }
    const capped = rawChanceBp(input, target.value) > MAX_BP;
    if (cash) u.balance -= cash;
    for (const [id] of removed) u.items.delete(id);
    const roll = rng.int(ROLL_DEN);
    const won = upgradeWins(roll, bp, side);
    const now = Date.now();
    casino.scheduleLeaders();
    casino.changed();
    const payload = { won, chanceBp: bp, side, targetId: target.id, input, targetValue: target.value, roll, capped };
    const ph = ids.length ? ids.map(() => '?').join(',') : '';
    const done = db
      .transaction(async (tx) => {
        if (cash) {
          const upd = await tx.run('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?', [cash, u.id, cash]);
          if (upd.changes !== 1) throw new Error('BALANCE');
        }
        if (ids.length) {
          const del = await tx.run('DELETE FROM inventory WHERE user_id = ? AND id IN (' + ph + ')', [u.id, ...ids]);
          if (del.changes !== ids.length) throw new Error('ITEMS');
        }
        let item = null;
        if (won) {
          const ins = await tx.run('INSERT INTO inventory (user_id, skin_id, created_at) VALUES (?, ?, ?)', [u.id, target.id, now]);
          item = { id: ins.lastId, skinId: target.id, createdAt: now };
        }
        const ev = await tx.run('INSERT INTO skin_events (user_id, nick, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, 'upgrade', JSON.stringify(payload), now]);
        return { item, eventId: ev.lastId };
      })
      .then(({ item, eventId }) => {
        if (item) u.items.set(item.id, { skinId: item.skinId, createdAt: item.createdAt });
        pushFeed({ id: eventId, nick: u.name, kind: 'upgrade', payload, createdAt: now });
        return {
          ok: true,
          won,
          roll,
          chanceBp: bp,
          side,
          capped,
          targetId: target.id,
          input,
          item,
          removedIds: ids,
          balance: u.balance,
          items: dump(u),
        };
      })
      .catch(() => {
        if (cash) u.balance += cash;
        for (const [id, it] of removed) u.items.set(id, it);
        casino.changed();
        return { ok: false, error: 'Upgraderis nutrauktas – daiktai ir balansas grąžinti' };
      });
    return { done };
  }

  return { ensureItems, openCase, buy, sell, upgrade, history, dump };
}

module.exports = {
  RARITIES,
  WEARS,
  WEAPONS,
  SKINS,
  CASES,
  ROLL_DEN,
  KEEP_BP,
  MIN_BP,
  MAX_BP,
  SELL_NUM,
  SELL_DEN,
  MAX_ITEMS,
  byId,
  chanceBp,
  rawChanceBp,
  minInputFor,
  upgradeWins,
  sellPayout,
  caseMath,
  publicConfig,
  loadFeed,
  createApi,
};
