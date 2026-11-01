'use strict';
// Individualūs žaidimai: Kauliukai (be statymo viršutinės ribos) ir Klasikinis automatas.
const rng = require('./rng');
const { isCents } = require('./money');

// Kauliukai: skaičius 0,00–99,99; riba 2–98; daugiklis 99 / tikimybė (pranašumas 1 %).
function rollDice(room, name, { bet, target, mode }) {
  const bal = room.balanceOf(name);
  const b = bet === 'max' ? bal : bet;
  if (!isCents(b)) return { error: 'Neteisinga suma' };
  if (b > bal) return { error: 'Nepakanka balanso' };
  target = Number(target);
  if (!Number.isInteger(target) || target < 2 || target > 98) return { error: 'Riba turi būti 2–98' };
  if (mode !== 'under' && mode !== 'over') return { error: 'Neteisinga kryptis' };
  const r = rng.int(10000);
  const chance = mode === 'under' ? target : 100 - target;
  const win = mode === 'under' ? r < target * 100 : r >= target * 100;
  const pay = win ? Math.floor((b * 99) / chance) : 0;
  room.soloResult(name, b, pay);
  return { r, win, pay, bet: b, balance: room.balanceOf(name) };
}

// Klasikinis automatas: 3 būgnai, viena linija. Tikslus grąžinimas 95,15 % (žr. slotRtp()).
const SL_SYMS = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '7️⃣'];
const SL_W = [6, 6, 5, 4, 3, 2, 1];
const SL_PAY3 = [10, 15, 22, 45, 90, 250, 1000];
const SL_TWO_CHERRY = 3;

function slotX(a, b, c) {
  if (a === b && b === c) return SL_PAY3[a];
  if (a === 0 && b === 0) return SL_TWO_CHERRY;
  return 0;
}

function slotRtp() {
  const T = SL_W.reduce((s, x) => s + x, 0);
  let r = 0;
  for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) for (let c = 0; c < 7; c++) r += ((SL_W[a] * SL_W[b] * SL_W[c]) / T ** 3) * slotX(a, b, c);
  return r;
}

function spinSlot(room, name, { bet }) {
  const bal = room.balanceOf(name);
  if (!isCents(bet)) return { error: 'Neteisinga suma' };
  if (bet > bal) return { error: 'Nepakanka balanso' };
  const pairs = SL_W.map((w, i) => [i, w]);
  const reels = [rng.weighted(pairs), rng.weighted(pairs), rng.weighted(pairs)];
  const x = slotX(reels[0], reels[1], reels[2]);
  const pay = bet * x;
  room.soloResult(name, bet, pay);
  return { reels, x, pay, bet, balance: room.balanceOf(name) };
}

module.exports = { rollDice, spinSlot, slotRtp, slotX, SL_SYMS, SL_W, SL_PAY3, SL_TWO_CHERRY };
