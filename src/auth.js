'use strict';
// Paskyros: slapyvardžio tikrinimas, slaptažodžių maišos (scrypt), sesijų žetonai, bandymų ribojimas.
const crypto = require('crypto');

const NICK_RE = /^[\p{L}\p{N}_]{3,16}$/u;
const AVATARS = ['🙂', '😎', '🤠', '🦊', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🐲', '👽', '🤖', '👑', '🎩', '🍀', '🔥', '⚡', '🌙', '⭐', '💎', '🎲', '🃏', '🎯'];

function normNick(n) {
  if (typeof n !== 'string') return null;
  n = n.normalize('NFC').trim();
  return NICK_RE.test(n) ? n : null;
}
const nickKey = (n) => n.normalize('NFC').toLowerCase();

function validPassword(p) {
  return typeof p === 'string' && p.length >= 6 && p.length <= 100;
}

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return new Promise((res, rej) =>
    crypto.scrypt(pw, salt, 32, SCRYPT, (e, key) => (e ? rej(e) : res('scrypt$' + SCRYPT.N + '$' + salt.toString('base64') + '$' + key.toString('base64'))))
  );
}

function verifyPassword(pw, stored) {
  const [alg, n, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return Promise.resolve(false);
  const expected = Buffer.from(hash, 'base64');
  return new Promise((res) =>
    crypto.scrypt(pw, Buffer.from(salt, 'base64'), expected.length, { ...SCRYPT, N: Number(n) }, (e, key) => res(!e && crypto.timingSafeEqual(key, expected)))
  );
}

// Lėtinam atsakymą, kai vartotojo nėra – kad nebūtų galima atspėti pagal laiką.
const DUMMY = 'scrypt$16384$' + Buffer.alloc(16).toString('base64') + '$' + Buffer.alloc(32).toString('base64');

const newToken = () => crypto.randomBytes(32).toString('base64url');
const tokenHash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

// Paprastas slankiojo lango ribotuvas atmintyje.
class Limiter {
  constructor(max, windowMs) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
  }
  list(key) {
    const now = Date.now();
    const arr = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, arr);
    return arr;
  }
  blocked(key) {
    return this.list(key).length >= this.max;
  }
  // Kiek ms liko iki atsiblokavimo.
  retryIn(key) {
    const arr = this.list(key);
    return arr.length >= this.max ? this.windowMs - (Date.now() - arr[0]) : 0;
  }
  hit(key) {
    this.list(key).push(Date.now());
  }
  reset(key) {
    this.hits.delete(key);
  }
  sweep() {
    for (const k of [...this.hits.keys()]) if (!this.list(k).length) this.hits.delete(k);
  }
}

module.exports = { normNick, nickKey, validPassword, hashPassword, verifyPassword, DUMMY, newToken, tokenHash, Limiter, AVATARS };
