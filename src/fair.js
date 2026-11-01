'use strict';
// Sąžiningi metimai: HMAC-SHA256(serverio sėkla, klientas:nonce:cursor).
// Crash taškas iš tos pačios sėklos, paskelbiant tik maišą iki raundo pabaigos.
const crypto = require('crypto');

const GROWTH = Math.log(1.055) / 90;

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function newSeed() {
  return crypto.randomBytes(32).toString('hex');
}

function hmacBuf(serverSeed, clientSeed, nonce, cursor) {
  return crypto.createHmac('sha256', String(serverSeed)).update(String(clientSeed) + ':' + nonce + ':' + (cursor || 0)).digest();
}

function fairInt(serverSeed, clientSeed, nonce, n, cursor) {
  const mod = Number(n);
  if (!Number.isInteger(mod) || mod <= 0) throw new Error('n');
  return hmacBuf(serverSeed, clientSeed, nonce, cursor).readUInt32BE(0) % mod;
}

function crashFromSeed(serverSeed) {
  const x = hmacBuf(serverSeed, 'crash', 0, 0).readUInt32BE(0) / 4294967296;
  const edge = 0.035;
  const rtp = 0.965;
  if (x < edge) return 100;
  return Math.max(100, Math.min(100000, Math.floor((rtp / (1 - x)) * 100)));
}

function multAt(elapsedMs) {
  const t = Math.max(0, Number(elapsedMs) || 0);
  return Math.max(100, Math.min(100000, Math.floor(100 * Math.exp(GROWTH * t))));
}

function createFair(db) {
  const cache = new Map();

  async function load(u) {
    let st = cache.get(u.id);
    if (st) return st;
    let row = await db.get('SELECT server_seed, client_seed, nonce FROM fair_users WHERE user_id = ?', [u.id]);
    if (!row) {
      const serverSeed = newSeed();
      const clientSeed = newSeed().slice(0, 16);
      await db.tx([['INSERT INTO fair_users (user_id, server_seed, client_seed, nonce) VALUES (?, ?, ?, 0)', [u.id, serverSeed, clientSeed]]]);
      row = { server_seed: serverSeed, client_seed: clientSeed, nonce: 0 };
    }
    st = { serverSeed: row.server_seed, clientSeed: row.client_seed, nonce: Number(row.nonce) || 0 };
    cache.set(u.id, st);
    return st;
  }

  async function drawMany(u, kind, ns) {
    const st = await load(u);
    const nonce = st.nonce;
    const rolls = ns.map((n, i) => fairInt(st.serverSeed, st.clientSeed, nonce, n, i));
    st.nonce += 1;
    await db.tx([
      ['UPDATE fair_users SET nonce = ? WHERE user_id = ?', [st.nonce, u.id]],
      ['INSERT INTO fair_rolls (user_id, nonce, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, nonce, kind, JSON.stringify({ n: ns, rolls }), Date.now()]],
    ]);
    return { rolls, nonce, serverHash: sha256(st.serverSeed), clientSeed: st.clientSeed };
  }

  async function view(u) {
    const st = await load(u);
    const recent = await db.all('SELECT nonce, kind, detail, created_at FROM fair_rolls WHERE user_id = ? ORDER BY id DESC LIMIT 12', [u.id]);
    return {
      serverHash: sha256(st.serverSeed),
      clientSeed: st.clientSeed,
      nonce: st.nonce,
      recent: recent.map((r) => ({ nonce: Number(r.nonce), kind: r.kind, at: Number(r.created_at) })),
    };
  }

  async function setClient(u, seed) {
    const next = String(seed || '').trim();
    if (next.length < 3 || next.length > 32) return { error: 'Kliento sėkla: 3–32 simboliai' };
    const st = await load(u);
    st.clientSeed = next;
    await db.tx([['UPDATE fair_users SET client_seed = ? WHERE user_id = ?', [next, u.id]]]);
    return view(u);
  }

  async function rotate(u) {
    const st = await load(u);
    const revealed = st.serverSeed;
    const serverSeed = newSeed();
    st.serverSeed = serverSeed;
    st.nonce = 0;
    await db.tx([
      ['INSERT INTO fair_revealed (user_id, server_seed, client_seed, nonce, created_at) VALUES (?, ?, ?, ?, ?)', [u.id, revealed, st.clientSeed, st.nonce, Date.now()]],
      ['UPDATE fair_users SET server_seed = ?, nonce = 0 WHERE user_id = ?', [serverSeed, u.id]],
    ]);
    const pub = await view(u);
    pub.revealed = revealed;
    return pub;
  }

  return { load, drawMany, view, setClient, rotate };
}

module.exports = { sha256, newSeed, fairInt, crashFromSeed, multAt, GROWTH, createFair, hmacBuf };
