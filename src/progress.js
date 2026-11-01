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
  return { daily: DAILY_BONUS, game: 25, wagerDiv: 100, item: 40, tiers: TIERS, missions: MISSIONS };
}

const TIERS = [
  { id: 'bronza', name: 'Bronza', xp: 0, rake: 0.002, daily: 1, caseId: null },
  { id: 'sidabras', name: 'Sidabras', xp: 5000, rake: 0.004, daily: 1.25, caseId: 'smelis' },
  { id: 'auksas', name: 'Auksas', xp: 25000, rake: 0.006, daily: 1.5, caseId: 'naktis' },
  { id: 'platina', name: 'Platina', xp: 100000, rake: 0.008, daily: 2, caseId: 'perkun' },
  { id: 'deimantas', name: 'Deimantas', xp: 400000, rake: 0.01, daily: 3, caseId: 'karuna' },
];

function tierFromWager(wagered) {
  const xp = Math.floor((Number(wagered) || 0) / 100);
  let cur = TIERS[0];
  for (const t of TIERS) if (xp >= t.xp) cur = t;
  const idx = TIERS.indexOf(cur);
  const next = TIERS[idx + 1] || null;
  return { xp, tier: cur, next, into: xp - cur.xp, need: next ? next.xp - cur.xp : 0 };
}

const MISSIONS = [
  { id: 'd-cases', period: 'day', kind: 'case', goal: 5, reward: 25000, title: 'Atidaryk 5 dėžes' },
  { id: 'd-upgrade', period: 'day', kind: 'upgrade', goal: 3, reward: 30000, title: 'Laimėk 3 upgrade’us' },
  { id: 'd-bj', period: 'day', kind: 'bj', goal: 10, reward: 20000, title: 'Sužaisk 10 blackjack rankų' },
  { id: 'd-plinko', period: 'day', kind: 'plinko', goal: 1, reward: 5000, title: 'Numesk 1 Plinko' },
  { id: 'w-wager', period: 'week', kind: 'weekwager', goal: 100000, reward: 50000, title: 'Pastatyk 1 000 € per savaitę' },
  { id: 'w-crash', period: 'week', kind: 'crash', goal: 3, reward: 40000, title: '3 sėkmingi Crash išėmimai' },
  { id: 'w-case', period: 'week', kind: 'plinko', goal: 3, reward: 0, caseId: 'smelis', title: '3 Plinko – nemokama dėžė' },
];

function vilniusDay(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vilnius', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now == null ? Date.now() : now));
}

function weekKey(day) {
  const parts = String(day).split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const start = new Date(Date.UTC(parts[0], 0, 1));
  const week = Math.max(1, Math.ceil(((dt - start) / 86400000 + start.getUTCDay() + 1) / 7));
  return parts[0] + '-W' + week;
}

function periodKey(period, now) {
  const day = vilniusDay(now);
  return period === 'week' ? weekKey(day) : day;
}

module.exports = { DAILY_BONUS, xpOf, levelOf, achievements, utcDay, publicProgress, TIERS, MISSIONS, tierFromWager, vilniusDay, weekKey, periodKey };
