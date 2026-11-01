'use strict';
// Originalūs skinų pavadinimai. Ginklo modelis gali būti tikras, apdaila – mūsų.
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
  { id: 'vartojimo', name: 'Plataus vartojimo', color: '#b0c3d9', rank: 0 },
  { id: 'pramoninis', name: 'Pramoninis', color: '#5e98d9', rank: 1 },
  { id: 'kariuomene', name: 'Kariuomenės', color: '#4b69ff', rank: 2 },
  { id: 'riboto', name: 'Riboto naudojimo', color: '#8847ff', rank: 3 },
  { id: 'slaptas', name: 'Slaptas', color: '#d32ce6', rank: 4 },
  { id: 'klasifikuotas', name: 'Klasifikuotas', color: '#eb4b4b', rank: 5 },
  { id: 'itinretas', name: 'Itin retas ★', color: '#e4ae39', rank: 6 },
];

const WEARS = [
  { id: 'fn', name: 'Factory New', mult: 1, bp: 1000, floatMin: 0, floatMax: 70000 },
  { id: 'mw', name: 'Minimal Wear', mult: 0.85, bp: 850, floatMin: 70000, floatMax: 150000 },
  { id: 'ft', name: 'Field-Tested', mult: 0.7, bp: 700, floatMin: 150000, floatMax: 380000 },
  { id: 'ww', name: 'Well-Worn', mult: 0.62, bp: 620, floatMin: 380000, floatMax: 450000 },
  { id: 'bs', name: 'Battle-Scarred', mult: 0.55, bp: 550, floatMin: 450000, floatMax: 1000000 },
];
const ST_BP = 1500;
const ST_CHANCE_DEN = 10;

const WEAPONS = [
  { id: 'ak47', name: 'AK-47' },
  { id: 'm4a4', name: 'M4A4' },
  { id: 'm4a1s', name: 'M4A1-S' },
  { id: 'awp', name: 'AWP' },
  { id: 'deagle', name: 'Desert Eagle' },
  { id: 'usp', name: 'USP-S' },
  { id: 'glock', name: 'Glock-18' },
  { id: 'p250', name: 'P250' },
  { id: 'mp9', name: 'MP9' },
  { id: 'karambitas', name: 'Karambitas' },
  { id: 'drugelis', name: 'Drugelis' },
  { id: 'durklas', name: 'Durklas' },
  { id: 'pirstines', name: 'Pirštinės' },
];

const SKINS = [
  { id: 'vx-dulkes', weapon: 'glock', name: 'Glock-18 | Pilkos dulkės', rarity: 'vartojimo', wear: 'bs', wearName: 'Battle-Scarred', float: 0.71, skaitiklis: false, value: 200 },
  { id: 'sr-smelis', weapon: 'p250', name: 'P250 | Smėlio pūga', rarity: 'vartojimo', wear: 'ww', wearName: 'Well-Worn', float: 0.42, skaitiklis: false, value: 350 },
  { id: 'ps-juosta', weapon: 'mp9', name: 'MP9 | Ruda juosta', rarity: 'vartojimo', wear: 'ft', wearName: 'Field-Tested', float: 0.27, skaitiklis: false, value: 500 },
  { id: 'ak-samanos', weapon: 'ak47', name: 'AK-47 | Samanų dryžiai', rarity: 'vartojimo', wear: 'mw', wearName: 'Minimal Wear', float: 0.12, skaitiklis: false, value: 800 },
  { id: 'kb-viela', weapon: 'usp', name: 'USP-S | Mėlyna viela', rarity: 'pramoninis', wear: 'ft', wearName: 'Field-Tested', float: 0.22, skaitiklis: false, value: 1500 },
  { id: 'md-rasa', weapon: 'awp', name: 'AWP | Ryto rasa', rarity: 'pramoninis', wear: 'ww', wearName: 'Well-Worn', float: 0.4, skaitiklis: false, value: 2200 },
  { id: 'vx-ledas', weapon: 'deagle', name: 'Desert Eagle | Ledo brūkšnys', rarity: 'pramoninis', wear: 'mw', wearName: 'Minimal Wear', float: 0.1, skaitiklis: false, value: 3200 },
  { id: 'sr-rukas', weapon: 'm4a1s', name: 'M4A1-S | Uosto rūkas', rarity: 'pramoninis', wear: 'fn', wearName: 'Factory New', float: 0.02, skaitiklis: false, value: 4500 },
  { id: 'ak-baltija', weapon: 'ak47', name: 'AK-47 | Baltijos rūkas', rarity: 'kariuomene', wear: 'ft', wearName: 'Field-Tested', float: 0.24, skaitiklis: false, value: 8000 },
  { id: 'ps-samanos', weapon: 'mp9', name: 'MP9 | Nakties samanos', rarity: 'kariuomene', wear: 'mw', wearName: 'Minimal Wear', float: 0.09, skaitiklis: false, value: 12000 },
  { id: 'as-vilkas', weapon: 'm4a4', name: 'M4A4 | Sidabro vilkas', rarity: 'kariuomene', wear: 'fn', wearName: 'Factory New', float: 0.01, skaitiklis: false, value: 18000 },
  { id: 'lk-ziedas', weapon: 'pirstines', name: 'Pirštinės | Geležies žiedas', rarity: 'kariuomene', wear: 'bs', wearName: 'Battle-Scarred', float: 0.66, skaitiklis: false, value: 25000 },
  { id: 'ak-gintaras', weapon: 'ak47', name: 'AK-47 | Žaibo audra', rarity: 'riboto', wear: 'mw', wearName: 'Minimal Wear', float: 0.11, skaitiklis: false, value: 40000 },
  { id: 'ak-gintaras-st', weapon: 'ak47', name: 'AK-47 | Žaibo audra', rarity: 'riboto', wear: 'mw', wearName: 'Minimal Wear', float: 0.1, skaitiklis: true, value: 64000 },
  { id: 'md-dumas', weapon: 'awp', name: 'AWP | Purpurinis dūmas', rarity: 'riboto', wear: 'ft', wearName: 'Field-Tested', float: 0.28, skaitiklis: false, value: 65000 },
  { id: 'kb-vainikas', weapon: 'deagle', name: 'Desert Eagle | Ugnies vainikas', rarity: 'riboto', wear: 'fn', wearName: 'Factory New', float: 0.03, skaitiklis: false, value: 90000 },
  { id: 'as-menulis', weapon: 'durklas', name: 'Durklas | Mėnulio pjūvis', rarity: 'riboto', wear: 'mw', wearName: 'Minimal Wear', float: 0.13, skaitiklis: false, value: 130000 },
  { id: 'ak-aurora', weapon: 'm4a4', name: 'M4A4 | Auroros gija', rarity: 'slaptas', wear: 'ft', wearName: 'Field-Tested', float: 0.31, skaitiklis: false, value: 250000 },
  { id: 'md-erelis', weapon: 'awp', name: 'AWP | Auksinis erelis', rarity: 'slaptas', wear: 'mw', wearName: 'Minimal Wear', float: 0.08, skaitiklis: false, value: 400000 },
  { id: 'as-gintaras', weapon: 'karambitas', name: 'Karambitas | Kruvinas gintaras', rarity: 'slaptas', wear: 'fn', wearName: 'Factory New', float: 0.02, skaitiklis: false, value: 600000 },
  { id: 'lk-audra', weapon: 'drugelis', name: 'Drugelis | Audros širdis', rarity: 'klasifikuotas', wear: 'bs', wearName: 'Battle-Scarred', float: 0.58, skaitiklis: false, value: 900000 },
  { id: 'ak-saule', weapon: 'ak47', name: 'AK-47 | Saulėlydžio mitas', rarity: 'klasifikuotas', wear: 'mw', wearName: 'Minimal Wear', float: 0.14, skaitiklis: false, value: 1500000 },
  { id: 'as-feniksas', weapon: 'karambitas', name: 'Karambitas | Fenikso plunksna', rarity: 'klasifikuotas', wear: 'fn', wearName: 'Factory New', float: 0.01, skaitiklis: true, value: 2500000 },
  { id: 'md-zvaigzde', weapon: 'awp', name: 'AWP | Žvaigždžių lankas', rarity: 'klasifikuotas', wear: 'ft', wearName: 'Field-Tested', float: 0.19, skaitiklis: false, value: 4000000 },
  { id: 'ps-neon', weapon: 'm4a1s', name: 'M4A1-S | Neono upė', rarity: 'klasifikuotas', wear: 'fn', wearName: 'Factory New', float: 0.04, skaitiklis: false, value: 6000000 },
  { id: 'as-karuna', weapon: 'pirstines', name: 'Pirštinės | Karūnos ašara', rarity: 'itinretas', wear: 'fn', wearName: 'Factory New', float: 0.01, skaitiklis: false, value: 12000000 },
  { id: 'ak-kalve', weapon: 'ak47', name: 'AK-47 | Dievų kalvė', rarity: 'itinretas', wear: 'mw', wearName: 'Minimal Wear', float: 0.07, skaitiklis: false, value: 25000000 },
  { id: 'lk-amzinybe', weapon: 'karambitas', name: 'Karambitas | Amžinybės auksas', rarity: 'itinretas', wear: 'fn', wearName: 'Factory New', float: 0.01, skaitiklis: true, value: 50000000 },
];

const SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));
const RARITY_BY_ID = new Map(RARITIES.map((r) => [r.id, r]));

function byId(id) {
  return SKIN_BY_ID.get(id) || null;
}

function migrateByValue(value) {
  let best = SKINS[0];
  let diff = Infinity;
  for (const s of SKINS) {
    const d = Math.abs(s.value - Number(value));
    if (d < diff) {
      diff = d;
      best = s;
    }
  }
  return best.id;
}

async function migrateInventory(db) {
  const rows = await db.all('SELECT id, skin_id, value_cents FROM inventory');
  const stmts = [];
  for (const r of rows) {
    if (!byId(r.skin_id)) {
      const n = Number(r.skin_id);
      const next = migrateByValue(Number.isFinite(n) && n > 0 ? n : 0);
      stmts.push(['UPDATE inventory SET skin_id = ? WHERE id = ? AND skin_id = ?', [next, r.id, r.skin_id]]);
    }
    if (!Number(r.value_cents)) {
      const skin = byId(r.skin_id) || byId(migrateByValue(0));
      stmts.push(["UPDATE inventory SET wear = 'fn', skaitiklis = 0, float_bp = 3000, value_cents = ? WHERE id = ? AND value_cents = 0", [skin.value, r.id]]);
    }
  }
  if (stmts.length) await db.tx(stmts);
}

function wearById(id) {
  return WEARS.find((w) => w.id === id) || WEARS[0];
}

function priceOf(base, wearId, st) {
  const w = wearById(wearId);
  const m = w.bp * (st ? ST_BP : 1000);
  return Math.max(1, Math.floor(Number(base) * m / 1000000));
}

function dropExpected(base) {
  let sum = 0;
  for (const w of WEARS) {
    sum += priceOf(base, w.id, false) * (ST_CHANCE_DEN - 1);
    sum += priceOf(base, w.id, true);
  }
  return sum / (WEARS.length * ST_CHANCE_DEN);
}

function instanceFromRolls(base, rolls) {
  const w = WEARS[rolls[0] % WEARS.length];
  const st = rolls[1] % ST_CHANCE_DEN === 0;
  const floatBp = w.floatMin + (rolls[2] % Math.max(1, w.floatMax - w.floatMin));
  return { wear: w.id, skaitiklis: st, floatBp, value: priceOf(base, w.id, st) };
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
  const ev = drops.reduce((s, d) => s + d.w * dropExpected(byId(d.id).value), 0) / weight;
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
    blurb: 'Dažniausiai plataus vartojimo. Retas šuolis iki pramoninio.',
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
    blurb: 'Pramoninis ir kariuomenės, su maža riboto naudojimo tikimybe.',
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
    blurb: 'Kariuomenės ir riboto naudojimo pagrindas, retas slaptas.',
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
    blurb: 'Aukštesnės pakopos. Itin retas – labai retas, ne garantija.',
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
      .map(([id, v]) => ({
        id,
        skinId: v.skinId,
        createdAt: v.createdAt,
        value: v.value,
        wear: v.wear,
        float: v.floatBp != null ? v.floatBp / 1000000 : v.float,
        skaitiklis: !!v.skaitiklis,
      }));
  }

  function memItem(id, skinId, now, inst) {
    return { id, skinId, createdAt: now, value: inst.value, wear: inst.wear, floatBp: inst.floatBp, skaitiklis: inst.skaitiklis ? 1 : 0 };
  }

  function ensureItems(u) {
    if (u.items) return Promise.resolve();
    let p = loading.get(u.id);
    if (!p) {
      p = db
        .all('SELECT id, skin_id AS skinId, created_at AS createdAt, wear, float_bp AS floatBp, skaitiklis, value_cents AS value FROM inventory WHERE user_id = ? ORDER BY id', [u.id])
        .then((rows) => {
          if (!u.items) {
            u.items = new Map(rows.map((r) => [Number(r.id), {
              skinId: r.skinId,
              createdAt: Number(r.createdAt),
              value: Number(r.value) || (byId(r.skinId) ? byId(r.skinId).value : 0),
              wear: r.wear || 'fn',
              floatBp: Number(r.floatBp) || 3000,
              skaitiklis: Number(r.skaitiklis) ? 1 : 0,
            }]));
          }
        })
        .finally(() => loading.delete(u.id));
      loading.set(u.id, p);
    }
    return p;
  }

  async function takeRolls(u, kind, ns) {
    if (casino.fair) return casino.fair.drawMany(u, kind, ns);
    return { rolls: ns.map((n) => rng.int(n)), nonce: null, serverHash: null, clientSeed: null };
  }

  function fail(msg) {
    return { error: msg };
  }

  async function history(u) {
    const rows = await db.all('SELECT id, nick, kind, payload, created_at FROM skin_events WHERE user_id = ? ORDER BY id DESC LIMIT 40', [u.id]);
    return rows.map(mapEvent);
  }

  async function openCase(u, caseId) {
    const kase = CASE_BY_ID.get(caseId);
    if (!kase) return fail('Nežinoma dėžė');
    if (!u.items) return fail('Inventorius dar kraunasi');
    if (u.items.size >= MAX_ITEMS) return fail('Inventorius pilnas (' + MAX_ITEMS + ')');
    if (u.balance < kase.price) return fail('Nepakanka balanso');
    const weight = kase.drops.reduce((s, d) => s + d.w, 0);
    const fair = await takeRolls(u, 'case', [weight, WEARS.length, ST_CHANCE_DEN, 1000000]);
    const skin = byId(rngPick(kase.drops, fair.rolls[0]));
    const inst = instanceFromRolls(skin.value, fair.rolls.slice(1));
    const now = Date.now();
    u.balance -= kase.price;
    casino.scheduleLeaders();
    casino.changed();
    const payload = { caseId: kase.id, skinId: skin.id, value: inst.value, wear: inst.wear, skaitiklis: !!inst.skaitiklis, nonce: fair.nonce, serverHash: fair.serverHash };
    const done = db
      .transaction(async (tx) => {
        const upd = await tx.run('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?', [kase.price, u.id, kase.price]);
        if (upd.changes !== 1) throw new Error('BALANCE');
        const ins = await tx.run('INSERT INTO inventory (user_id, skin_id, created_at, wear, float_bp, skaitiklis, value_cents) VALUES (?, ?, ?, ?, ?, ?, ?)', [u.id, skin.id, now, inst.wear, inst.floatBp, inst.skaitiklis ? 1 : 0, inst.value]);
        const ev = await tx.run('INSERT INTO skin_events (user_id, nick, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, 'case', JSON.stringify(payload), now]);
        return { item: memItem(ins.lastId, skin.id, now, inst), eventId: ev.lastId };
      })
      .then(({ item, eventId }) => {
        u.items.set(item.id, item);
        pushFeed({ id: eventId, nick: u.name, kind: 'case', payload, createdAt: now });
        if (casino.noteWager) casino.noteWager(u.name, 1, 'case');
        return { ok: true, item, skinId: skin.id, balance: u.balance, caseId: kase.id, items: dump(u), fair: payload };
      })
      .catch(() => {
        u.balance += kase.price;
        casino.changed();
        return { ok: false, error: 'Dėžės atidarymas nutrauktas – balansas grąžintas' };
      });
    return { done };
  }

  function rngPick(drops, roll) {
    let r = roll;
    for (const d of drops) {
      if (r < d.w) return d.id;
      r -= d.w;
    }
    return drops[drops.length - 1].id;
  }

  async function buy(u, skinId) {
    const skin = byId(skinId);
    if (!skin) return fail('Nežinomas skinas');
    if (!u.items) return fail('Inventorius dar kraunasi');
    if (u.items.size >= MAX_ITEMS) return fail('Inventorius pilnas (' + MAX_ITEMS + ')');
    const fair = await takeRolls(u, 'shop', [WEARS.length, ST_CHANCE_DEN, 1000000]);
    const inst = instanceFromRolls(skin.value, fair.rolls);
    if (u.balance < inst.value) return fail('Nepakanka balanso');
    const now = Date.now();
    u.balance -= inst.value;
    casino.scheduleLeaders();
    casino.changed();
    const payload = { skinId: skin.id, value: inst.value, wear: inst.wear, skaitiklis: !!inst.skaitiklis, nonce: fair.nonce, serverHash: fair.serverHash };
    const done = db
      .transaction(async (tx) => {
        const upd = await tx.run('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?', [inst.value, u.id, inst.value]);
        if (upd.changes !== 1) throw new Error('BALANCE');
        const ins = await tx.run('INSERT INTO inventory (user_id, skin_id, created_at, wear, float_bp, skaitiklis, value_cents) VALUES (?, ?, ?, ?, ?, ?, ?)', [u.id, skin.id, now, inst.wear, inst.floatBp, inst.skaitiklis ? 1 : 0, inst.value]);
        await tx.run('INSERT INTO skin_events (user_id, nick, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, 'buy', JSON.stringify(payload), now]);
        return memItem(ins.lastId, skin.id, now, inst);
      })
      .then((item) => {
        u.items.set(item.id, item);
        casino.changed();
        return { ok: true, item, price: inst.value, skinId: skin.id, balance: u.balance, items: dump(u) };
      })
      .catch(() => {
        u.balance += inst.value;
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
      const worth = Number(it.value) || skin.value;
      payout += sellPayout(worth);
      removed.push([id, it, skin, worth]);
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

  async function upgrade(u, body) {
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
      skinVal += Number(it.value) || skin.value;
      removed.push([id, it]);
    }
    const input = skinVal + cash;
    const fair = await takeRolls(u, 'upgrade', [WEARS.length, ST_CHANCE_DEN, 1000000, ROLL_DEN]);
    const inst = instanceFromRolls(target.value, fair.rolls);
    const targetValue = inst.value;
    const bp = chanceBp(input, targetValue);
    if (bp == null) {
      const need = minInputFor(targetValue);
      return fail('Per maža tikimybė (mažiau nei 1 %). Šiam tikslui reikia bent ' + fmt(need) + '.');
    }
    const capped = rawChanceBp(input, targetValue) > MAX_BP;
    if (cash) u.balance -= cash;
    for (const [id] of removed) u.items.delete(id);
    const roll = fair.rolls[3];
    const won = upgradeWins(roll, bp, side);
    const now = Date.now();
    casino.scheduleLeaders();
    casino.changed();
    const payload = { won, chanceBp: bp, side, targetId: target.id, input, targetValue, roll, capped, wear: inst.wear, skaitiklis: !!inst.skaitiklis, nonce: fair.nonce, serverHash: fair.serverHash };
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
          const ins = await tx.run('INSERT INTO inventory (user_id, skin_id, created_at, wear, float_bp, skaitiklis, value_cents) VALUES (?, ?, ?, ?, ?, ?, ?)', [u.id, target.id, now, inst.wear, inst.floatBp, inst.skaitiklis ? 1 : 0, inst.value]);
          item = memItem(ins.lastId, target.id, now, inst);
        }
        const ev = await tx.run('INSERT INTO skin_events (user_id, nick, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, 'upgrade', JSON.stringify(payload), now]);
        return { item, eventId: ev.lastId };
      })
      .then(({ item, eventId }) => {
        if (item) u.items.set(item.id, item);
        pushFeed({ id: eventId, nick: u.name, kind: 'upgrade', payload, createdAt: now });
        if (casino.noteWager) casino.noteWager(u.name, won ? input : 0, 'upgrade');
        return {
          ok: true,
          won,
          roll,
          chanceBp: bp,
          side,
          capped,
          targetId: target.id,
          targetValue,
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

  async function grantCase(u, caseId) {
    const kase = CASE_BY_ID.get(caseId);
    if (!kase) return fail('Nežinoma dėžė');
    if (!u.items) return fail('Inventorius dar kraunasi');
    if (u.items.size >= MAX_ITEMS) return fail('Inventorius pilnas (' + MAX_ITEMS + ')');
    const weight = kase.drops.reduce((s, d) => s + d.w, 0);
    const fair = await takeRolls(u, 'case', [weight, WEARS.length, ST_CHANCE_DEN, 1000000]);
    const skin = byId(rngPick(kase.drops, fair.rolls[0]));
    const inst = instanceFromRolls(skin.value, fair.rolls.slice(1));
    const now = Date.now();
    const payload = { caseId: kase.id, skinId: skin.id, value: inst.value, wear: inst.wear, skaitiklis: !!inst.skaitiklis, free: true, nonce: fair.nonce, serverHash: fair.serverHash };
    const done = db
      .transaction(async (tx) => {
        const ins = await tx.run('INSERT INTO inventory (user_id, skin_id, created_at, wear, float_bp, skaitiklis, value_cents) VALUES (?, ?, ?, ?, ?, ?, ?)', [u.id, skin.id, now, inst.wear, inst.floatBp, inst.skaitiklis ? 1 : 0, inst.value]);
        const ev = await tx.run('INSERT INTO skin_events (user_id, nick, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, 'case', JSON.stringify(payload), now]);
        return { item: memItem(ins.lastId, skin.id, now, inst), eventId: ev.lastId };
      })
      .then(({ item, eventId }) => {
        u.items.set(item.id, item);
        pushFeed({ id: eventId, nick: u.name, kind: 'case', payload, createdAt: now });
        if (casino.noteWager) casino.noteWager(u.name, 1, 'case');
        casino.changed();
        return { ok: true, item, skinId: skin.id, balance: u.balance, caseId: kase.id, items: dump(u) };
      })
      .catch(() => ({ ok: false, error: 'VIP dėžės atidarymas nepavyko' }));
    return { done };
  }

  async function giveUnopened(u, caseId) {
    if (!CASE_BY_ID.get(caseId)) return { error: 'Nežinoma dėžė' };
    const now = Date.now();
    const ins = await db.transaction(async (tx) => tx.run('INSERT INTO unopened_cases (user_id, case_id, created_at) VALUES (?, ?, ?)', [u.id, caseId, now]));
    return { ok: true, id: ins.lastId, caseId };
  }

  async function listUnopened(u) {
    const rows = await db.all('SELECT id, case_id AS caseId, created_at AS createdAt FROM unopened_cases WHERE user_id = ? ORDER BY id', [u.id]);
    return rows.map((r) => ({ id: Number(r.id), caseId: r.caseId, createdAt: Number(r.createdAt) }));
  }

  async function openUnopened(u, id) {
    const row = await db.get('SELECT id, case_id FROM unopened_cases WHERE id = ? AND user_id = ?', [id, u.id]);
    if (!row) return fail('Tokios dėžės neturi');
    const del = await db.tx([['DELETE FROM unopened_cases WHERE id = ? AND user_id = ?', [id, u.id]]]);
    if (!del || del[0] !== 1) return fail('Tokios dėžės neturi');
    const opened = await grantCase(u, row.case_id);
    if (opened.error) {
      await db.tx([['INSERT INTO unopened_cases (user_id, case_id, created_at) VALUES (?, ?, ?)', [u.id, row.case_id, Date.now()]]]);
      return opened;
    }
    const done = await opened.done;
    if (!done.ok) await db.tx([['INSERT INTO unopened_cases (user_id, case_id, created_at) VALUES (?, ?, ?)', [u.id, row.case_id, Date.now()]]]);
    return { done: Promise.resolve(done) };
  }

  return { ensureItems, openCase, buy, sell, upgrade, history, dump, grantCase, giveUnopened, listUnopened, openUnopened };
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
  priceOf,
  dropExpected,
  migrateByValue,
  migrateInventory,
  caseMath,
  publicConfig,
  loadFeed,
  createApi,
};
