'use strict';
// Lygiai, patirtis ir pasiekimai skaičiuojami iš jau saugomos statistikos.
// Dienos dovana – atskiras žaidimo pinigų papildymas, vieną kartą per UTC dieną.
const DAILY_BONUS = 100000; // 1 000,00 €

function xpOf(stats, items) {
  const games = Number(stats && (stats.games != null ? stats.games : stats.games_played)) || 0;
  const wagered = Number(stats && (stats.wagered != null ? stats.wagered : stats.total_wagered)) || 0;
  return games * 25 + Math.floor(wagered / 100) + (Number(items) || 0) * 40;
}

function levelOf(xp) {
  let level = 1;
  let need = 100;
  let rest = Math.max(0, Math.floor(xp) || 0);
  while (rest >= need && level < 99) {
    rest -= need;
    level += 1;
    need = Math.floor(need * 1.15 + 20);
  }
  return { level: level, into: rest, next: need };
}

function achievements(p) {
  p = p || {};
  const games = Number(p.games) || 0;
  const best = Number(p.biggestWin) || 0;
  const wagered = Number(p.wagered) || 0;
  const items = Number(p.items) || 0;
  const balance = Number(p.balance) || 0;
  return [
    { id: 'join', name: 'Pirmas žingsnis', text: 'Susikūrei paskyrą', ok: true },
    { id: 'play', name: 'Prie stalo', text: 'Sužaisk bent vieną raundą', ok: games >= 1 },
    { id: 'ten', name: 'Dešimtukas', text: '10 raundų', ok: games >= 10 },
    { id: 'hundred', name: 'Šimtukas', text: '100 raundų', ok: games >= 100 },
    { id: 'win', name: 'Stambus laimėjimas', text: 'Didžiausias laimėjimas nuo 1 000 €', ok: best >= 100000 },
    { id: 'wager', name: 'Drąsus statymas', text: 'Iš viso pastatyta nuo 10 000 €', ok: wagered >= 1000000 },
    { id: 'skins', name: 'Kolekcija', text: '5 skinai inventoriuje', ok: items >= 5 },
    { id: 'rich', name: 'Turčius', text: 'Balansas nuo 20 000 €', ok: balance >= 2000000 },
  ];
}

function utcDay(now) {
  const d = new Date(now == null ? Date.now() : now);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function publicProgress() {
  return { daily: DAILY_BONUS, game: 25, wagerDiv: 100, item: 40 };
}

module.exports = { DAILY_BONUS, xpOf, levelOf, achievements, utcDay, publicProgress };
