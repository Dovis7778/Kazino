/* Kazino su draugais – kliento dalis (be jokio kūrimo žingsnio, paprastas JavaScript).
   Klientas tik rodo serverio būseną ir siunčia veiksmus; visi rezultatai skaičiuojami serveryje. */
'use strict';

if (!String.prototype.padStart) {
  String.prototype.padStart = function (len, ch) {
    var s = String(this);
    ch = ch == null ? ' ' : String(ch);
    while (s.length < len) s = ch + s;
    return s;
  };
}

const $ = (id) => document.getElementById(id);
const qsa = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
const TOKEN_KEY = 'kazino:token';
const memStore = {};
let storeMemoryOnly = false;
function storeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    storeMemoryOnly = true;
    return memStore[key] == null ? null : memStore[key];
  }
}
function storeSet(key, value) {
  memStore[key] = String(value);
  try {
    window.localStorage.setItem(key, String(value));
  } catch (e) {
    storeMemoryOnly = true;
  }
}
function storeDel(key) {
  delete memStore[key];
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    storeMemoryOnly = true;
  }
}
function setBoot(text) {
  const el = $('bootMsg');
  if (el && text) el.textContent = text;
}
function hideBoot() {
  const el = $('boot');
  if (el) el.classList.add('hidden');
}
function showNet(title, text) {
  const bar = $('netBanner');
  if (!bar) return;
  bar.classList.remove('hidden');
  if ($('netTitle')) $('netTitle').textContent = title || 'Ryšys';
  if ($('netText')) $('netText').textContent = text || '';
}
function hideNet() {
  const bar = $('netBanner');
  if (bar) bar.classList.add('hidden');
}

// Žetonas siunčiamas prisijungimo (handshake) metu. Pirma polling, paskui websocket.
const socket = (typeof io === 'function')
  ? io({
      autoConnect: false,
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 25000,
      auth: function (cb) { cb({ token: storeGet(TOKEN_KEY) || '' }); },
    })
  : {
      connected: false,
      on: function () {},
      connect: function () {},
      disconnect: function () {},
      timeout: function () { return { emit: function (_e, _d, cb) { if (cb) cb(new Error('offline')); } }; },
    };
if (typeof io !== 'function') setBoot('Nepavyko įkelti ryšio bibliotekos. Patikrink tinklą ir perkrauk puslapį.');

let CFG = null; // statinės lentelės iš /config.json
let S = null; // paskutinė serverio būsena
const me = { name: '', avatar: '', admin: false, in: false };
const deadlines = { bj: 0, rl: 0, lt: 0 };
let tab = 'home';
let myBal = 0;

/* ---------- pagalbinės ---------- */
function fmt(c) {
  const neg = c < 0;
  c = Math.abs(Math.round(c));
  const eur = Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return (neg ? '−' : '') + eur + ',' + String(c % 100).padStart(2, '0') + '\u00a0€';
}
function short(c) {
  const e = c / 100;
  if (e >= 1000000) return e / 1000000 + 'M';
  if (e >= 1000) return e / 1000 + 'k';
  if (e < 1) return '0,' + String(c).padStart(2, '0');
  return String(e).replace('.', ',');
}
function chipColor(c) {
  if (c >= 500000) return '#111';
  if (c >= 100000) return '#d4a41c';
  if (c >= 50000) return '#8a3fd1';
  if (c >= 10000) return '#161616';
  if (c >= 2500) return '#1f8a55';
  if (c >= 500) return '#c8102e';
  if (c >= 100) return '#2f6fd6';
  return '#6b7280';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
function parseEur(s) {
  s = String(s).replace(/[\s\u00a0€]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const v = Math.round(parseFloat(s) * 100);
  return v >= 1 ? v : null;
}
function mini(c) {
  return '<span class="mini" style="background:' + chipColor(c) + '">' + short(c) + '</span>';
}
function mod(a, m) {
  return ((a % m) + m) % m;
}
function sumBets(b) {
  return b ? Object.values(b).reduce((s, x) => s + x, 0) : 0;
}
let toastT = 0;
function toast(text, good) {
  const t = $('toast');
  t.textContent = text;
  t.className = 'toast' + (good ? ' good' : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hidden'), 2600);
}
function send(ev, data, quiet) {
  return new Promise((res) => {
    socket.timeout(10000).emit(ev, data, (err, r) => {
      if (err) r = { ok: false, error: 'Serveris neatsako. Jei ką tik atidarei puslapį, palauk – nemokamas serveris bunda (kartais iki minutės) – ir bandyk dar kartą.' };
      if (!r.ok && r.error && !quiet) toast(r.error);
      res(r);
    });
  });
}
function wedge(cx, cy, r0, r1, a0, a1) {
  const pt = (r, a) => (cx + r * Math.sin((a * Math.PI) / 180)).toFixed(2) + ' ' + (cy - r * Math.cos((a * Math.PI) / 180)).toFixed(2);
  return 'M' + pt(r0, a0) + ' L' + pt(r1, a0) + ' A' + r1 + ' ' + r1 + ' 0 0 1 ' + pt(r1, a1) + ' L' + pt(r0, a1) + ' A' + r0 + ' ' + r0 + ' 0 0 0 ' + pt(r0, a0) + ' Z';
}

/* ---------- paskyra: prisijungimas / registracija ---------- */
let authMode = 'login';
let regAvatar = '🙂';
function nickOk(n) {
  try {
    return new RegExp('^[\\p{L}\\p{N}_]{3,16}$', 'u').test(n);
  } catch (e) {
    return /^[0-9A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž_]{3,16}$/.test(n);
  }
}
function showAuth(msg, canResume) {
  me.in = false;
  $('app').classList.add('hidden');
  $('join').classList.remove('hidden');
  $('authWait').classList.add('hidden');
  $('authForm').classList.remove('hidden');
  $('authErr').textContent = msg || '';
  $('resumeBtn').classList.toggle('hidden', !canResume);
  hideBoot();
  const note = $('storeNote');
  if (storeMemoryOnly && note) note.classList.remove('hidden');
}
function setAuthMode(m) {
  authMode = m;
  qsa('[data-auth]').forEach((b) => b.classList.toggle('active', b.dataset.auth === m));
  $('regExtra').classList.toggle('hidden', m !== 'register');
  $('authBtn').textContent = m === 'register' ? 'Sukurti paskyrą' : 'Prisijungti';
  $('passIn').autocomplete = m === 'register' ? 'new-password' : 'current-password';
  $('authErr').textContent = '';
}
qsa('[data-auth]').forEach((b) => (b.onclick = () => setAuthMode(b.dataset.auth)));
function avatarPicker(box, cur, onPick) {
  box.innerHTML = CFG.avatars.map((a) => '<button type="button" class="av' + (a === cur ? ' sel' : '') + '" data-av="' + a + '">' + a + '</button>').join('');
  box.onclick = (e) => {
    const b = e.target.closest('[data-av]');
    if (!b) return;
    box.querySelectorAll('.av').forEach((x) => x.classList.toggle('sel', x === b));
    onPick(b.dataset.av);
  };
}
function enterApp(user, resumed) {
  me.name = user.name;
  me.avatar = user.avatar;
  me.admin = !!user.admin;
  me.in = true;
  storeSet('kazino:nick', user.name);
  hideBoot();
  hideNet();
  $('join').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('meNick').textContent = user.name;
  $('meAvatar').textContent = user.avatar;
  $('meName').textContent = 'Tu: ' + user.name;
  $('adminBox').classList.toggle('hidden', !me.admin);
  if (resumed) toast('Sveikas sugrįžęs, ' + user.name + '!', true);
  loadSkins();
}
async function doAuth() {
  const nick = $('nickIn').value.trim();
  const password = $('passIn').value;
  if (!nick || !password) return ($('authErr').textContent = 'Įvesk slapyvardį ir slaptažodį');
  if (authMode === 'register') {
    if (!nickOk(nick)) return ($('authErr').textContent = 'Slapyvardis: 3–16 raidžių, skaičių arba _');
    if (password.length < 6) return ($('authErr').textContent = 'Slaptažodis turi būti bent 6 simbolių');
    if (password !== $('pass2In').value) return ($('authErr').textContent = 'Slaptažodžiai nesutampa');
  }
  if (!socket.connected) socket.connect();
  $('authBtn').disabled = true;
  const r = await send(authMode, { nick, password, avatar: regAvatar }, true);
  $('authBtn').disabled = false;
  if (!r.ok) return ($('authErr').textContent = r.error || 'Nepavyko');
  storeSet(TOKEN_KEY, r.token);
  $('passIn').value = '';
  $('pass2In').value = '';
  enterApp(r.user, false);
  if (authMode === 'register') toast('Paskyra sukurta! Gavai 10 000,00 € žaidimo pinigų.', true);
}
$('authBtn').onclick = doAuth;
['nickIn', 'passIn', 'pass2In'].forEach((id) => $(id).addEventListener('keydown', (e) => e.key === 'Enter' && doAuth()));
$('resumeBtn').onclick = () => {
  $('resumeBtn').classList.add('hidden');
  $('authWait').classList.remove('hidden');
  socket.connect();
};

socket.on('auth', (r) => {
  $('authWait').classList.add('hidden');
  if (r.ok) enterApp(r.user, r.resumed && !me.in);
  else {
    storeDel(TOKEN_KEY);
    showAuth(r.error || 'Prisijungti nepavyko. Patikrink slapyvardį ir slaptažodį.');
  }
});
socket.on('connect', () => {
  if ($('conn')) {
    $('conn').textContent = '● prisijungta';
    $('conn').className = 'conn on';
  }
  hideNet();
  if (!me.in && !$('authForm').classList.contains('hidden')) hideBoot();
});
socket.on('connect_error', () => {
  setBoot('Serveris bunda… Ryšys dar neatsirado, bandome dar kartą.');
  showNet('Serveris neatsako', 'Nemokamas serveris po pauzės bunda iki minutės. Jungiamasi iš naujo automatiškai.');
  if ($('conn')) {
    $('conn').textContent = '● nepavyksta prisijungti, bandome dar kartą…';
    $('conn').className = 'conn off';
  }
});
socket.on('disconnect', (reason) => {
  if ($('conn')) {
    $('conn').textContent = '● ryšys nutrūko, jungiamasi…';
    $('conn').className = 'conn off';
  }
  showNet('Ryšys nutrūko', 'Bandom iš naujo. Jei tai pirmas apsilankymas po pauzės, palauk iki minutės.');
  pollHealth();
  if (reason === 'io server disconnect' && me.in) showAuth('Atjungta šiame lange. Gali tęsti iš naujo.', !!storeGet(TOKEN_KEY));
});
socket.on('kicked', (m) => {
  me.in = false;
  showAuth(m, true);
});

/* ---------- profilis ---------- */
$('profBtn').onclick = () => {
  $('profPanel').classList.toggle('hidden');
  $('topPanel').classList.add('hidden');
  renderProfile();
};
function progressNow() {
  const rules = (CFG && CFG.progress) || { game: 25, wagerDiv: 100, item: 40, daily: 100000 };
  const st = S && S.me ? S.me.stats : { games: 0, wagered: 0, biggestWin: 0 };
  const xp = (st.games || 0) * rules.game + Math.floor((st.wagered || 0) / rules.wagerDiv) + INV.length * rules.item;
  let level = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need && level < 99) {
    rest -= need;
    level += 1;
    need = Math.floor(need * 1.15 + 20);
  }
  return { xp: xp, level: level, into: rest, next: need, daily: rules.daily, st: st };
}
function achievementList() {
  const st = S && S.me ? S.me.stats : { games: 0, biggestWin: 0, wagered: 0 };
  const bal = S && S.me ? S.me.balance : 0;
  const items = INV.length;
  return [
    ['Pirmas žingsnis', true],
    ['Prie stalo', st.games >= 1],
    ['Dešimtukas', st.games >= 10],
    ['Šimtukas', st.games >= 100],
    ['Stambus laimėjimas', st.biggestWin >= 100000],
    ['Drąsus statymas', st.wagered >= 1000000],
    ['Kolekcija', items >= 5],
    ['Turčius', bal >= 2000000],
  ];
}
function renderProfile() {
  if (!S || !S.me || !$('profPanel') || $('profPanel').classList.contains('hidden')) return;
  const st = S.me.stats;
  const pr = progressNow();
  $('profStats').innerHTML =
    '<div>Balansas<b>' + fmt(S.me.balance) + '</b></div><div>Sužaista raundų<b>' + st.games.toLocaleString('lt-LT') + '</b></div><div>Didžiausias laimėjimas<b>' + fmt(st.biggestWin) + '</b></div><div>Iš viso pastatyta<b>' + fmt(st.wagered) + '</b></div><div>Lygis<b>' + pr.level + '</b></div><div>Patirtis<b>' + pr.xp.toLocaleString('lt-LT') + '</b></div>';
  if ($('levelBox')) {
    const pct = Math.max(0, Math.min(100, Math.round((pr.into / pr.next) * 100)));
    $('levelBox').innerHTML = '<div class="lvl-top"><b>Lygis ' + pr.level + '</b><span>' + pr.into + ' / ' + pr.next + '</span></div><div class="lvl-bar"><div style="width:' + pct + '%"></div></div>';
  }
  if ($('achBox')) {
    $('achBox').innerHTML = achievementList().map((a) => '<span class="ach' + (a[1] ? ' on' : '') + '">' + esc(a[0]) + '</span>').join('');
  }
  if (!$('profAvatars').childElementCount || $('profAvatars').dataset.cur !== S.me.avatar) {
    $('profAvatars').dataset.cur = S.me.avatar;
    avatarPicker($('profAvatars'), S.me.avatar, (a) => send('profile:avatar', a));
  }
}
$('logoutBtn').onclick = async () => {
  await send('logout', { token: storeGet(TOKEN_KEY) });
  storeDel(TOKEN_KEY);
  $('profPanel').classList.add('hidden');
  showAuth('Atsijungei. Iki!');
};
$('adminReset').onclick = async () => {
  const n = $('adminNick').value.trim();
  if (!n) return;
  const r = await send('admin:reset', n);
  if (r.ok) toast('Balansas atstatytas: ' + n, true);
};
async function openProfile(nick) {
  const r = await send('profile:get', nick);
  if (!r.ok) return;
  const p = r.profile;
  $('profModalBody').innerHTML =
    '<div class="big-av">' + esc(p.avatar) + '</div><div class="panel-h" style="text-align:center">' + esc(p.name) + (p.online ? ' <span class="conn on">● žaidžia</span>' : '') + '</div>' +
    '<div class="prof-stats"><div>Balansas<b>' + fmt(p.balance) + '</b></div><div>Sužaista raundų<b>' + p.games.toLocaleString('lt-LT') + '</b></div><div>Didžiausias laimėjimas<b>' + fmt(p.biggestWin) + '</b></div><div>Iš viso pastatyta<b>' + fmt(p.wagered) + '</b></div></div>' +
    '<div class="small">Žaidžia nuo ' + new Date(p.since).toLocaleDateString('lt-LT') + '</div><button class="btn" type="button" id="profClose">Uždaryti</button>';
  $('profModal').classList.remove('hidden');
  $('profClose').onclick = () => $('profModal').classList.add('hidden');
}
$('profModal').onclick = (e) => e.target.id === 'profModal' && $('profModal').classList.add('hidden');

/* ---------- balansas ir papildymas ---------- */
$('topBtn').onclick = () => {
  $('topPanel').classList.toggle('hidden');
  $('profPanel').classList.add('hidden');
};
qsa('[data-top]').forEach((b) => {
  b.onclick = async () => {
    const r = await send('topup', Number(b.dataset.top));
    if (r.ok) $('topMsg').textContent = 'Pridėta ' + fmt(Number(b.dataset.top)) + ' žaidimo pinigų.';
  };
});
$('topCustom').onclick = async () => {
  const v = parseEur($('topIn').value);
  if (!v || v > CFG.topupMax) {
    $('topMsg').textContent = 'Įvesk sumą nuo 0,01 iki 1 000 000 €';
    return;
  }
  const r = await send('topup', v);
  if (r.ok) {
    $('topMsg').textContent = 'Pridėta ' + fmt(v) + ' žaidimo pinigų.';
    $('topIn').value = '';
  }
};
$('resetBal').onclick = async () => {
  const r = await send('resetBalance');
  if (r.ok) $('topMsg').textContent = 'Balansas atstatytas iki 10 000,00 €.';
};

/* ---------- skirtukai ---------- */
function setGameTab(name) {
  tab = name;
  qsa('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  qsa('.game').forEach((g) => g.classList.toggle('hidden', g.id !== 'g-' + name));
  qsa('#bottomNav [data-bnav]').forEach((b) => b.classList.toggle('on', (name === 'home' && b.dataset.bnav === 'home') || (name !== 'home' && b.dataset.bnav === 'games' && section === 'casino')));
}
qsa('.tab').forEach((t) => {
  t.onclick = () => setGameTab(t.dataset.tab);
});

/* ---------- žetonai ---------- */
const CHIPS = { bj: [100, 500, 2500, 10000, 50000, 100000, 500000], rl: [100, 500, 2500, 10000, 50000, 100000, 500000], lt: [100, 500, 2500, 10000, 50000, 100000, 500000], dc: [10, 50, 100, 500, 1000, 5000, 10000, 100000], sl: [10, 20, 50, 100, 200, 500, 1000, 5000, 10000] };
const chipSel = { bj: 500, rl: 500, lt: 500, dc: 100, sl: 100 };
function renderChips() {
  qsa('[data-chips]').forEach((box) => {
    const g = box.dataset.chips;
    if (!box.childElementCount) {
      box.innerHTML = CHIPS[g].map((v) => '<button type="button" class="chip" data-v="' + v + '" style="background:' + chipColor(v) + '" aria-label="Žetonas ' + fmt(v) + '">' + short(v) + '</button>').join('');
      box.onclick = (e) => {
        const b = e.target.closest('.chip');
        if (!b || b.disabled) return;
        chipSel[g] = Number(b.dataset.v);
        if (g === 'dc') {
          dc.max = false;
          $('dcMax').checked = false;
          $('dcBetIn').value = '';
          dc.bet = chipSel.dc;
          renderDice();
        }
        renderChips();
      };
    }
    [...box.children].forEach((b) => {
      const v = Number(b.dataset.v);
      b.disabled = v > myBal;
      b.classList.toggle('sel', v === chipSel[g] && !(g === 'dc' && (dc.max || dc.bet !== v)));
    });
  });
}

/* ---------- laikmačiai ---------- */
setInterval(() => {
  for (const g of ['bj', 'rl', 'lt']) {
    const el = $(g + 'Timer');
    const left = deadlines[g] - Date.now();
    el.textContent = deadlines[g] && left > 0 ? Math.ceil(left / 1000) + ' s' : '';
  }
}, 200);

/* ---------- būsenos gavimas ---------- */
socket.on('state', (st) => {
  if (!CFG) return;
  S = st;
  for (const g of ['bj', 'rl', 'lt']) deadlines[g] = st[g] && st[g].remainingMs ? Date.now() + st[g].remainingMs : 0;
  const p = st.me;
  if (p) {
    $('meAvatar').textContent = p.avatar;
    const el = $('myBal');
    if (p.balance !== myBal) {
      el.classList.remove('flash-up', 'flash-down');
      void el.offsetWidth;
      el.classList.add(p.balance > myBal ? 'flash-up' : 'flash-down');
    }
    myBal = p.balance;
    el.textContent = fmt(myBal);
  }
  renderPlayers();
  renderProfile();
  renderChat();
  renderChips();
  renderBJ();
  renderRL();
  renderLT();
  renderDice();
  renderSlotBtn();
  renderFeed();
});

let leadMode = 'bal';
function renderPlayers() {
  if (!S) return;
  $('onlineCount').textContent = '(' + S.online.length + ')';
  $('players').innerHTML = S.online
    .slice(0, 50)
    .map((p) => '<li class="' + (p.name === me.name ? 'me' : '') + '"><span class="nm" data-prof="' + esc(p.name) + '">' + esc(p.avatar) + ' ' + esc(p.name) + (p.bj ? '<span class="tag">· stalas ' + p.bj + '</span>' : '') + '</span><b>' + fmt(p.balance) + '</b></li>')
    .join('');
  const list = leadMode === 'win' ? S.leadersWin || [] : leadMode === 'inv' ? S.leadersInv || [] : S.leaders || [];
  $('leaders').innerHTML = list
    .map((p, i) => {
      const shown = leadMode === 'win' ? fmt(p.biggestWin || 0) : leadMode === 'inv' ? fmt(p.value || 0) : fmt(p.balance);
      return '<li class="' + (p.name === me.name ? 'me ' : '') + (p.online ? '' : 'off') + '"><span class="nm" data-prof="' + esc(p.name) + '">' + (i === 0 ? '👑' : i + 1 + '.') + ' ' + esc(p.avatar) + ' ' + esc(p.name) + '</span><b>' + shown + '</b></li>';
    })
    .join('');
}
if ($('leadSeg')) {
  $('leadSeg').onclick = (e) => {
    const b = e.target.closest('[data-lead]');
    if (!b) return;
    leadMode = b.dataset.lead;
    qsa('#leadSeg .segb').forEach((x) => x.classList.toggle('active', x === b));
    renderPlayers();
  };
}
['players', 'leaders'].forEach((id) => ($(id).onclick = (e) => {
  const n = e.target.closest('[data-prof]');
  if (n) openProfile(n.dataset.prof);
}));

let chatSig = '';
function renderChat() {
  const sig = S.chat.length + ':' + (S.chat.length ? S.chat[S.chat.length - 1].t : 0);
  if (sig === chatSig) return;
  chatSig = sig;
  const box = $('chat');
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = S.chat
    .map((m) => {
      const time = new Date(m.t).toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
      return m.from ? '<div class="m"><span class="av-s">' + esc(m.avatar || '') + '</span><b>' + esc(m.from) + ':</b> ' + esc(m.text) + ' <span class="small">' + time + '</span></div>' : '<div class="sys">' + time + ' · ' + esc(m.text) + '</div>';
    })
    .join('');
  if (atBottom) box.scrollTop = box.scrollHeight;
}
async function sendChat() {
  const t = $('chatIn').value.trim();
  if (!t) return;
  const r = await send('chat', t);
  if (r.ok) $('chatIn').value = '';
}
$('chatSend').onclick = sendChat;
$('chatIn').addEventListener('keydown', (e) => e.key === 'Enter' && sendChat());

/* ---------- bendri stalų mygtukai ---------- */
qsa('[data-clear]').forEach((b) => (b.onclick = () => send('clear', { game: b.dataset.clear })));
qsa('[data-rebet]').forEach((b) => (b.onclick = () => send('rebet', { game: b.dataset.rebet })));
qsa('[data-ready]').forEach((b) => (b.onclick = () => send('ready', { game: b.dataset.ready })));
function tableButtons(g) {
  const t = S[g];
  const betting = t.phase === 'betting';
  const mine = t.bets[me.name];
  qsa('[data-clear="' + g + '"]').forEach((b) => (b.disabled = !betting || !mine));
  qsa('[data-rebet="' + g + '"]').forEach((b) => (b.disabled = !betting || !!mine));
  qsa('[data-ready="' + g + '"]').forEach((b) => {
    b.disabled = !betting || !mine || t.ready.includes(me.name);
    b.textContent = t.ready.includes(me.name) ? 'Laukiama kitų…' : 'Pasiruošęs';
  });
}
function payoutText(t) {
  const p = t.payouts && t.payouts[me.name];
  if (!p) return '';
  return p.ret > 0 ? 'Tu laimėjai ' + fmt(p.ret) + ' (statyta ' + fmt(p.staked) + ')' : 'Šįkart nelaimėjai (statyta ' + fmt(p.staked) + ')';
}
function bettorsLine(t) {
  const names = Object.keys(t.bets);
  if (!names.length) return '';
  return 'Stato: ' + names.map((n) => esc(n) + (t.ready.includes(n) ? ' ✓' : '')).join(', ');
}

/* ---------- BLACKJACK ---------- */
let bjSeen = new Set();
let bjRound = -1;
function cardHtml(c, key) {
  if (!c) return '<div class="card back"></div>';
  const isNew = key && !bjSeen.has(key);
  if (key) bjSeen.add(key);
  const red = c.s === '♥' || c.s === '♦';
  return '<div class="card' + (red ? ' red' : '') + (isNew ? ' deal' : '') + '"><span>' + c.r + '</span><span>' + c.s + '</span></div>';
}
qsa('[data-bjspot]').forEach((b) => (b.onclick = () => send('bet', { game: 'bj', key: b.dataset.bjspot, amount: chipSel.bj })));
qsa('[data-act]').forEach((b) => (b.onclick = () => send('bj:act', b.dataset.act)));

function renderBJTables() {
  const cur = S.me && S.me.bj;
  const locked = S.bj && (S.bj.bets[me.name] || (S.bj.seats || []).some((x) => x.name === me.name));
  $('bjTables').innerHTML =
    S.bjTables.map((t) => '<button type="button" data-sit="' + t.num + '" class="' + (t.num === cur ? 'cur' : '') + '"' + ((t.num !== cur && (locked || t.seated.length >= t.max)) ? ' disabled' : '') + '>' + esc(t.title) + ' · ' + t.seated.length + '/' + t.max + '</button>').join('') +
    '<button type="button" data-sit="new"' + (locked ? ' disabled' : '') + '>＋ Naujas stalas</button>';
}
$('bjTables').onclick = (e) => {
  const b = e.target.closest('[data-sit]');
  if (!b || b.disabled) return;
  send('bj:sit', b.dataset.sit === 'new' ? 'new' : Number(b.dataset.sit));
};
function renderBJ() {
  renderBJTables();
  const t = S.bj;
  if (!t) return;
  if (t.round !== bjRound) {
    bjRound = t.round;
    bjSeen = new Set();
  }
  const myTurn = t.phase === 'turn' && t.turn && t.turn.name === me.name;
  const status = {
    betting: Object.keys(t.bets).length ? 'Statymai priimami' : 'Laukiama statymų – padėk žetoną',
    dealing: 'Dalijamos kortos…',
    turn: myTurn ? 'Tavo eilė!' : 'Eilė: ' + (t.turn ? t.turn.name : ''),
    dealer: 'Dalintojo eilė',
    result: 'Raundo rezultatai',
  }[t.phase];
  $('bjStatus').textContent = status || '';
  $('bjDealer').innerHTML = t.dealer.map((c, i) => cardHtml(c, 'd' + i + (c ? 'u' : 'h'))).join('');
  $('bjDealerVal').textContent = t.dealerValue ? (t.dealerValue.soft && t.dealerValue.total < 21 ? 'minkšti ' : '') + t.dealerValue.total : '';
  if (t.phase === 'betting') {
    $('bjSeats').innerHTML = Object.entries(t.bets)
      .map(([n, b]) => '<div class="seat' + (n === me.name ? ' me' : '') + '"><div class="who">' + esc(n) + (t.ready.includes(n) ? ' ✓' : '') + '</div><div class="small">Statymas ' + fmt(b.main || 0) + (b.pp ? ' · PP ' + fmt(b.pp) : '') + (b.t3 ? ' · 21+3 ' + fmt(b.t3) : '') + '</div></div>')
      .join('');
  } else {
    $('bjSeats').innerHTML = t.seats
      .map((s) => {
        const turnHere = t.turn && t.turn.name === s.name;
        const hands = s.hands
          .map((h, hi) => {
            const active = turnHere && t.turn.hand === hi;
            const res = h.result ? '<div class="res ' + (h.ret > h.bet || (h.ret > 0 && h.result !== 'Lygiosios') ? 'win' : h.ret === h.bet ? '' : 'lose') + '">' + esc(h.result) + (h.ret ? ' · ' + fmt(h.ret) : '') + '</div>' : '';
            return '<div class="hand' + (active ? ' active' : '') + '"><div class="cards">' + h.cards.map((c, ci) => cardHtml(c, s.name + '-' + hi + '-' + ci)).join('') + '</div><div class="small">' + h.value.total + (h.value.soft && h.value.total < 21 ? ' (minkšti)' : '') + ' · ' + fmt(h.bet) + (h.doubled ? ' ×2' : '') + '</div>' + res + '</div>';
          })
          .join('');
        const side = s.side.map((x) => '<div class="side-res">' + x.type + ': ' + esc(x.label) + (x.ret ? ' +' + fmt(x.ret) : '') + '</div>').join('');
        return '<div class="seat' + (s.name === me.name ? ' me' : '') + (turnHere ? ' turn' : '') + '"><div class="who">' + esc(s.name) + '</div>' + hands + side + '</div>';
      })
      .join('');
  }
  let msg = t.message || '';
  if (t.phase === 'result') msg = payoutText(t) || 'Raundas baigtas';
  else if (t.phase === 'betting' && t.bets[me.name]) msg = 'Tavo statymai: ' + fmt(sumBets(t.bets[me.name]));
  else if (t.phase === 'betting' && Object.keys(t.payouts || {}).length === 0) msg = msg || '';
  $('bjMsg').textContent = msg;
  // valdymas
  $('bjBetBox').classList.toggle('hidden', t.phase !== 'betting');
  $('bjActBox').classList.toggle('hidden', !myTurn);
  const mine = t.bets[me.name] || {};
  qsa('[data-bjamt]').forEach((el) => (el.innerHTML = mine[el.dataset.bjamt] ? mini(mine[el.dataset.bjamt]) : ''));
  qsa('[data-bjspot]').forEach((b) => (b.disabled = t.phase !== 'betting' || chipSel.bj > myBal || (b.dataset.bjspot !== 'main' && !mine.main)));
  if (myTurn) {
    const seat = t.seats.find((s) => s.name === me.name);
    const h = seat.hands[t.turn.hand];
    const two = h.cards.length === 2;
    const v = (c) => (c.r === 'A' ? 1 : ['J', 'Q', 'K'].includes(c.r) ? 10 : Number(c.r));
    $('bjActBox').querySelector('[data-act="double"]').disabled = !two || myBal < h.bet;
    $('bjActBox').querySelector('[data-act="split"]').disabled = !two || seat.hands.length !== 1 || v(h.cards[0]) !== v(h.cards[1]) || myBal < h.bet;
  }
  tableButtons('bj');
  $('bjHist').innerHTML = t.history.map((h) => '<span class="hchip" style="background:#0b4a2b">' + esc(h.dealer) + '</span>').join('');
}

/* ---------- RULETĖ ---------- */
let rlRot = 0;
let rlAnimRound = -1;
function buildRoulette() {
  const order = CFG.roulette.order;
  const red = new Set(CFG.roulette.red);
  const step = 360 / 37;
  let svg = '<circle r="108" fill="#5a3a1c" stroke="#c9a227" stroke-width="4"/>';
  order.forEach((n, i) => {
    const col = n === 0 ? '#1f8a55' : red.has(n) ? '#b3122a' : '#141414';
    svg += '<path d="' + wedge(0, 0, 62, 100, i * step - step / 2, i * step + step / 2) + '" fill="' + col + '" stroke="#c9a227" stroke-width="0.6"/>';
    svg += '<text x="0" y="-86" text-anchor="middle" font-size="9" font-weight="800" fill="#fff" transform="rotate(' + i * step + ')">' + n + '</text>';
  });
  svg += '<circle r="62" fill="#1f6b3f" stroke="#c9a227" stroke-width="2"/><path d="M0 -40 L8 0 L0 40 L-8 0 Z M-40 0 L0 -8 L40 0 L0 8 Z" fill="#e3c766"/><circle r="9" fill="#c9a227"/>';
  const w = $('rlWheel');
  w.innerHTML = svg;
  w.style.transition = 'transform 6.5s cubic-bezier(0.12, 0.6, 0.08, 1)';
  // stalas
  const cells = [];
  const color = (n) => (n === 0 ? 'green' : red.has(n) ? 'red' : 'black');
  cells.push('<button type="button" class="rc green zero" data-k="n0" style="grid-column:1;grid-row:1 / span 3">0</button>');
  for (let col = 0; col < 12; col++)
    for (let row = 0; row < 3; row++) {
      const n = col * 3 + (3 - row);
      cells.push('<button type="button" class="rc ' + color(n) + '" data-k="n' + n + '" style="grid-column:' + (col + 2) + ';grid-row:' + (row + 1) + '">' + n + '</button>');
    }
  ['c3', 'c2', 'c1'].forEach((k, row) => cells.push('<button type="button" class="rc outside" data-k="' + k + '" style="grid-column:14;grid-row:' + (row + 1) + '">2:1</button>'));
  ['1–12', '13–24', '25–36'].forEach((l, i) => cells.push('<button type="button" class="rc outside" data-k="d' + (i + 1) + '" style="grid-column:' + (2 + i * 4) + ' / span 4;grid-row:4">' + l + '</button>'));
  [['low', '1–18'], ['even', 'Lyginis'], ['red', '◆ Raudona'], ['black', '◆ Juoda'], ['odd', 'Nelyginis'], ['high', '19–36']].forEach(([k, l], i) =>
    cells.push('<button type="button" class="rc outside' + (k === 'red' ? ' red' : k === 'black' ? ' black' : '') + '" data-k="' + k + '" style="grid-column:' + (2 + i * 2) + ' / span 2;grid-row:5">' + l + '</button>')
  );
  const b = $('rlBoard');
  b.style.gridTemplateColumns = 'minmax(22px, 34px) repeat(12, minmax(0, 1fr)) minmax(24px, 34px)';
  b.innerHTML = cells.join('');
  b.onclick = (e) => {
    const c = e.target.closest('.rc');
    if (c && !c.disabled) send('bet', { game: 'rl', key: c.dataset.k, amount: chipSel.rl });
  };
  qsa('#rlBoard .rc').forEach((c) => (c.dataset.label = c.innerHTML));
}
function rlWins(k, n) {
  const red = new Set(CFG.roulette.red);
  if (/^n\d+$/.test(k)) return Number(k.slice(1)) === n;
  if (n === 0) return false;
  return { red: red.has(n), black: !red.has(n), odd: n % 2 === 1, even: n % 2 === 0, low: n <= 18, high: n >= 19, d1: n <= 12, d2: n >= 13 && n <= 24, d3: n >= 25, c1: n % 3 === 1, c2: n % 3 === 2, c3: n % 3 === 0 }[k];
}
function renderRL() {
  const t = S.rl;
  const status = { betting: Object.keys(t.bets).length ? 'Statymai priimami' : 'Laukiama statymų – padėk žetoną', spinning: 'Ratas sukasi…', result: 'Iškrito ' + t.result }[t.phase];
  $('rlStatus').textContent = status || '';
  if (t.phase === 'spinning' && t.spinTo !== null && rlAnimRound !== t.round) {
    rlAnimRound = t.round;
    const i = CFG.roulette.order.indexOf(t.spinTo);
    const step = 360 / 37;
    rlRot = rlRot + 360 * 5 + mod(-i * step - rlRot, 360);
    $('rlWheel').style.transform = 'rotate(' + rlRot + 'deg)';
    $('rlNum').textContent = '…';
    $('rlNum').style.color = '';
  }
  const red = new Set(CFG.roulette.red);
  if (t.phase === 'result' || (t.phase === 'betting' && t.result !== null)) {
    const n = t.result;
    const el = $('rlNum');
    if (el.textContent !== String(n)) {
      el.textContent = n;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
    el.style.color = n === 0 ? '#5fd38d' : red.has(n) ? '#ff5a6e' : '#fff';
  }
  $('rlMsg').textContent = t.phase === 'result' ? payoutText(t) : t.phase === 'betting' ? '' : '';
  const mine = t.bets[me.name] || {};
  const others = {};
  for (const [n, b] of Object.entries(t.bets)) if (n !== me.name) for (const k in b) others[k] = (others[k] || 0) + b[k];
  const showHit = t.phase === 'result' && t.result !== null;
  qsa('#rlBoard .rc').forEach((c) => {
    const k = c.dataset.k;
    c.innerHTML = c.dataset.label + (mine[k] ? mini(mine[k]) : '') + (others[k] ? '<span class="others">' + short(others[k]) + '</span>' : '');
    c.disabled = t.phase !== 'betting' || chipSel.rl > myBal;
    c.classList.toggle('hit', showHit && rlWins(k, t.result));
  });
  tableButtons('rl');
  $('rlMine').innerHTML = (mine && sumBets(mine) ? 'Tavo statymai: ' + fmt(sumBets(mine)) + ' · ' : '') + bettorsLine(t);
  $('rlHist').innerHTML = t.history.map((h) => '<span class="hchip" style="background:' + (h.color === 'red' ? '#b3122a' : h.color === 'green' ? '#1f8a55' : '#141414') + '">' + h.n + '</span>').join('');
}

/* ---------- LAIMĖS RATAS ---------- */
let ltRot = 0;
let ltAnimRound = -1;
let ltFlick = 0;
let ltBonusKey = '';
const ltInfo = (k) => CFG.wheel.LT.find((x) => x.key === k);
function buildWheel() {
  const W = CFG.wheel;
  const step = 360 / 54;
  let svg = '<circle cx="160" cy="160" r="158" fill="#2b1a08" stroke="#c9a227" stroke-width="4"/>';
  W.LT_SEQ.forEach((k, i) => {
    const inf = ltInfo(k);
    svg += '<path d="' + wedge(160, 160, 40, 150, i * step - step / 2, i * step + step / 2) + '" fill="' + inf.color + '" stroke="#1a0f05" stroke-width="0.8"/>';
    svg += '<text x="160" y="26" text-anchor="middle" font-size="' + (k[0] === 'n' ? 12 : 11) + '" font-weight="900" fill="#fff" transform="rotate(' + i * step + ' 160 160)">' + inf.label + '</text>';
  });
  svg += '<circle cx="160" cy="160" r="40" fill="#160b22" stroke="#ffd84d" stroke-width="3"/><text x="160" y="165" text-anchor="middle" font-size="13" font-weight="900" fill="#ffd84d">LAIMĖ</text>';
  const w = $('ltWheel');
  w.innerHTML = svg;
  w.style.transition = 'transform 4.9s cubic-bezier(0.12, 0.6, 0.08, 1)';
  const b = $('ltBoard');
  b.innerHTML = W.LT.map((x) => '<button type="button" class="ltb" data-k="' + x.key + '" style="background:' + x.color + '"><b>' + x.label + '</b><span>' + (x.key[0] === 'n' ? x.name + ':1' : esc(x.name)) + '</span><i class="slot"></i></button>').join('');
  b.onclick = (e) => {
    const c = e.target.closest('.ltb');
    if (c && !c.disabled) send('bet', { game: 'lt', key: c.dataset.k, amount: chipSel.lt });
  };
  // taisyklės
  const pct = (x) => (x * 100).toFixed(2).replace('.', ',') + ' %';
  $('ltRules').innerHTML =
    '<table><tr><th>Segmentas</th><th>Kiek ratu</th><th>Moka</th><th>Grąžinimas</th></tr>' +
    W.LT.map((x) => '<tr><td>' + x.label + ' ' + (x.key[0] === 'n' ? 'Skaičius ' + x.name : esc(x.name)) + '</td><td>' + x.count + ' / 54</td><td>' + (x.ev === null ? x.name + ':1' : 'vid. ×' + x.ev.toFixed(1).replace('.', ',')) + '</td><td>' + pct(x.rtp) + '</td></tr>').join('') +
    '</table><p>Statyk ant vieno ar kelių segmentų. Skaičius moka tiek kartų, kiek parašyta, ir grąžinamas statymas. Bonuso segmentas atidaro mini raundą. Prieš kiekvieną sukimą daugiklio langelis maždaug 3 iš 4 kartų pažymi vieną segmentą ir daugiklį ×2–×50.</p>' +
    '<p>🪙 Monetos metimas: raudona ir mėlyna pusė gauna po ×2–×16. 🔻 Kamuoliuko kritimas: 12 kaiščių eilių, 13 langelių ×11–×500. 🎯 Lobių paieška: 20 skrynių ×5–×50 – kiekvienas statęs renkasi savo skrynią (15 s, kitaip atsitiktinai). 🎡 Didysis ratas: 24 segmentai ×10–×100, „×2“ padvigubina reikšmes ir sukama dar kartą.</p>' +
    '<p>Grąžinimas apskaičiuotas tiksliai ir patikrintas modeliavimu: kiekvienam statymui apie 95 %.</p>';
}
function renderLT() {
  const t = S.lt;
  const W = CFG.wheel;
  const status = { betting: Object.keys(t.bets).length ? 'Statymai priimami' : 'Laukiama statymų – padėk žetoną', top: 'Sukasi daugiklio langelis…', 'top-done': 'Daugiklis nustatytas', spinning: 'Ratas sukasi…', 'hunt-pick': 'Lobių paieška: rinkis skrynią', bonus: 'Bonuso raundas', result: 'Rezultatai' }[t.phase];
  $('ltStatus').textContent = status || '';
  // daugiklio langelis
  const ts = $('ltTop');
  if (t.phase === 'top') {
    if (!ltFlick)
      ltFlick = setInterval(() => {
        const x = W.LT[Math.floor(Math.random() * W.LT.length)];
        ts.textContent = x.label + ' ×' + W.LT_TOPM[Math.floor(Math.random() * W.LT_TOPM.length)][0];
        ts.style.background = x.color;
      }, 80);
  } else {
    if (ltFlick) clearInterval(ltFlick);
    ltFlick = 0;
    if (t.phase === 'betting') {
      ts.textContent = '–';
      ts.style.background = '';
    } else if (t.top) {
      ts.textContent = ltInfo(t.top.key).label + ' ×' + t.top.m;
      ts.style.background = ltInfo(t.top.key).color;
    } else {
      ts.textContent = 'Be daugiklio';
      ts.style.background = '';
    }
  }
  // ratas
  if (t.phase === 'spinning' && t.idx !== null && ltAnimRound !== t.round) {
    ltAnimRound = t.round;
    const step = 360 / 54;
    ltRot = ltRot + 360 * 6 + mod(-t.idx * step - ltRot, 360) + (Math.random() - 0.5) * step * 0.6;
    $('ltWheel').style.transform = 'rotate(' + ltRot + 'deg)';
  }
  const m = t.top && t.result && t.top.key === t.result ? t.top.m : 1;
  let msg = '';
  if (t.phase === 'result') msg = ltInfo(t.result).name + (m > 1 ? ' ×' + m : '') + ' · ' + payoutText(t);
  else if (t.phase === 'bonus' || t.phase === 'hunt-pick') msg = ltInfo(t.result).label + ' ' + ltInfo(t.result).name + (m > 1 ? ' · daugiklis ×' + m : '');
  else if (t.phase === 'betting') msg = bettorsLine(t) ? '' : '';
  $('ltMsg').innerHTML = msg || (t.phase === 'betting' ? bettorsLine(t) : '');
  renderBonus(t);
  // stalas
  const mine = t.bets[me.name] || {};
  const others = {};
  for (const [n, b] of Object.entries(t.bets)) if (n !== me.name) for (const k in b) others[k] = (others[k] || 0) + b[k];
  qsa('#ltBoard .ltb').forEach((c) => {
    const k = c.dataset.k;
    const boosted = t.top && t.top.key === k && t.phase !== 'betting' && t.phase !== 'top';
    c.querySelector('.slot').innerHTML = (boosted ? '<span class="badge">×' + t.top.m + '</span>' : '') + (mine[k] ? mini(mine[k]) : '') + (others[k] ? '<span class="others">kiti ' + short(others[k]) + '</span>' : '');
    c.classList.toggle('boost', !!boosted);
    c.classList.toggle('won', t.phase === 'result' && t.result === k);
    c.disabled = t.phase !== 'betting' || chipSel.lt > myBal;
  });
  tableButtons('lt');
  $('ltHist').innerHTML = t.history.map((h) => '<span class="hchip" style="background:' + ltInfo(h.key).color + '">' + ltInfo(h.key).label + (h.key[0] === 'n' && h.x === Number(ltInfo(h.key).name) ? '' : ' ×' + h.x) + '</span>').join('');
}

function renderBonus(t) {
  const box = $('ltBonus');
  if (t.phase === 'betting' || !t.bonus) {
    box.classList.add('hidden');
    ltBonusKey = '';
    return;
  }
  box.classList.remove('hidden');
  const b = t.bonus;
  const m = t.top && t.top.key === t.result ? t.top.m : 1;
  const W = CFG.wheel;
  const head = '<h3>' + ltInfo(t.result).label + ' ' + esc(ltInfo(t.result).name) + (m > 1 ? ' · ×' + m : '') + '</h3>';
  if (b.kind === 'hunt') {
    const revealed = !!b.tiles;
    const iBet = !!(t.bets[me.name] && t.bets[me.name].hunt);
    const myPick = t.picks[me.name];
    const pickers = {};
    for (const [n, i] of Object.entries(t.picks)) (pickers[i] = pickers[i] || []).push(n);
    const key = 'hunt' + t.round + (revealed ? 'r' : '') + JSON.stringify(t.picks);
    if (key === ltBonusKey) return;
    ltBonusKey = key;
    let hint = revealed ? (myPick !== undefined ? 'Tavo skrynia: ×' + b.tiles[myPick] * m : 'Atsitiktinė skrynia: ×' + b.tiles[b.defaultPick] * m) : iBet ? (myPick !== undefined ? 'Pasirinkta! Laukiama kitų…' : 'Pasirink vieną skrynią') : 'Statę ant šio bonuso renkasi skrynias…';
    box.innerHTML =
      head +
      '<div class="small">' + hint + '</div><div class="hunt">' +
      Array.from({ length: 20 }, (_, i) => {
        const mineC = myPick === i;
        const who = pickers[i] ? '<span class="who">' + esc(pickers[i].join(', ')) + '</span>' : '';
        return '<button type="button" class="chest' + (revealed ? ' open' : '') + (mineC ? ' mine' : '') + '" data-i="' + i + '"' + (revealed || !iBet || myPick !== undefined ? ' disabled' : '') + '>' + (revealed ? '×' + b.tiles[i] : '🧰') + who + '</button>';
      }).join('') +
      '</div>';
    box.querySelectorAll('.chest').forEach((c) => (c.onclick = () => send('lt:pick', Number(c.dataset.i))));
    return;
  }
  const key = b.kind + t.round;
  if (key === ltBonusKey) return;
  ltBonusKey = key;
  if (b.kind === 'coin') {
    const x = b.side === 0 ? b.a : b.b;
    box.innerHTML = head + '<div class="tags"><span class="tag" id="tgA" style="background:#a8182e">Raudona ×' + b.a + '</span><span class="tag" id="tgB" style="background:#1d4fa8">Mėlyna ×' + b.b + '</span></div><div class="coin3d"><div class="coin-in" id="coinIn"><div class="face redf">×' + b.a + '</div><div class="face bluef">×' + b.b + '</div></div></div><div class="msg" id="coinMsg">Moneta metama…</div>';
    setTimeout(() => ($('coinIn').style.transform = 'rotateY(' + (1800 + b.side * 180) + 'deg)'), 600);
    setTimeout(() => {
      if (!$('coinMsg')) return;
      $('coinMsg').textContent = 'Laimi ' + (b.side === 0 ? 'raudona' : 'mėlyna') + ': ×' + x * m;
      $(b.side === 0 ? 'tgA' : 'tgB').classList.add('win');
    }, 3100);
  } else if (b.kind === 'plinko') {
    const dx = 20, dy = 17, R = W.LT_ROWS;
    let svg = '';
    for (let r = 0; r < R; r++) for (let j = 0; j <= r; j++) svg += '<circle cx="' + (130 + (j - r / 2) * dx) + '" cy="' + (14 + (r + 0.5) * dy) + '" r="2.6" fill="#e3c766" opacity=".75"/>';
    const slot = b.path.reduce((s, x) => s + x, 0);
    W.LT_PL.forEach((v, i) => {
      svg += '<rect id="pl' + i + '" x="' + (130 + (i - R / 2) * dx - 9.5) + '" y="226" width="19" height="30" rx="4" fill="' + (v >= 100 ? '#d23a7a' : v >= 25 ? '#8a3fd1' : '#2f6fd6') + '"/><text x="' + (130 + (i - R / 2) * dx) + '" y="245" text-anchor="middle" font-size="' + (v >= 100 ? 7.5 : 9) + '" font-weight="800" fill="#fff">' + v + '</text>';
    });
    svg += '<circle id="plBall" r="7" fill="#fff" stroke="#ffd84d" stroke-width="2" style="transform:translate(130px,14px);transition:transform .22s ease-in"/>';
    box.innerHTML = head + '<div class="plinko"><svg viewBox="0 0 260 262">' + svg + '</svg></div><div class="msg" id="plMsg">Kamuoliukas krenta…</div>';
    for (let s = 1; s <= R + 1; s++)
      setTimeout(() => {
        const ball = $('plBall');
        if (!ball) return;
        const st = Math.min(s, R);
        const rights = b.path.slice(0, st).reduce((a, x) => a + x, 0);
        ball.style.transform = 'translate(' + (130 + (rights - st / 2) * dx) + 'px,' + (s > R ? 216 : 14 + st * dy) + 'px)';
        if (s > R) {
          $('pl' + slot).setAttribute('fill', '#ffd84d');
          $('plMsg').textContent = 'Įkrito į ×' + W.LT_PL[slot] + (m > 1 ? ' · su daugikliu ×' + W.LT_PL[slot] * m : '');
        }
      }, 600 + s * 230);
  } else if (b.kind === 'big') {
    const B = W.LT_BIG;
    const draw = (dbl) =>
      B.map((v, i) => '<path d="' + wedge(120, 120, 22, 110, i * 15 - 7.5, i * 15 + 7.5) + '" fill="' + (v === 0 ? '#ffd84d' : i % 2 ? '#5a1a6e' : '#2a0f40') + '" stroke="#c9a227" stroke-width=".8"/><text x="120" y="32" text-anchor="middle" font-size="11" font-weight="800" fill="' + (v === 0 ? '#2b1d00' : '#fff') + '" transform="rotate(' + i * 15 + ' 120 120)">' + (v === 0 ? '×2' : v * dbl) + '</text>').join('') + '<circle cx="120" cy="120" r="22" fill="#1a0a12" stroke="#ffd84d" stroke-width="2"/>';
    box.innerHTML = head + '<div class="bigw"><div class="pointer"></div><svg id="bigSvg" viewBox="0 0 240 240" style="transition:transform 3.6s cubic-bezier(.15,.6,.1,1)">' + draw(1) + '</svg></div><div class="msg" id="bigMsg">Ratas sukasi…</div>';
    let r = 0;
    b.spins.forEach((idx, k) => {
      setTimeout(() => {
        const svgEl = $('bigSvg');
        if (!svgEl) return;
        if (k > 0) svgEl.innerHTML = draw(Math.pow(2, k));
        r = r + 360 * 4 + mod(-idx * 15 - r, 360);
        svgEl.style.transform = 'rotate(' + r + 'deg)';
        $('bigMsg').textContent = 'Ratas sukasi…';
      }, 500 + k * 4300);
      setTimeout(() => {
        if (!$('bigMsg')) return;
        const last = k === b.spins.length - 1;
        $('bigMsg').textContent = !last || B[idx] === 0 ? '×2! Reikšmės dvigubinamos, sukama dar kartą' : 'Laimėta ×' + B[idx] * Math.pow(2, k) * m;
      }, 500 + k * 4300 + 3700);
    });
  }
}

/* ---------- KAULIUKAI (individualiai) ---------- */
const dc = { target: 50, mode: 'under', bet: 100, max: false, busy: false, auto: 0, hist: [], last: null };
function dcWager() {
  return dc.max ? myBal : dc.bet;
}
function rollText(r) {
  return (r / 100).toFixed(2).replace('.', ',');
}
function renderDice() {
  const chance = dc.mode === 'under' ? dc.target : 100 - dc.target;
  const w = dcWager();
  const payout = Math.floor((w * 99) / chance);
  $('dcRange').value = dc.target;
  $('dcWin').style.left = (dc.mode === 'under' ? 0 : dc.target) + '%';
  $('dcWin').style.width = chance + '%';
  $('dcStats').innerHTML = [
    ['Riba', (dc.mode === 'under' ? '< ' : '≥ ') + dc.target + ',00'],
    ['Tikimybė', chance + ' %'],
    ['Daugiklis', '×' + (99 / chance).toFixed(4).replace('.', ',')],
    ['Išmoka laimėjus', fmt(payout)],
  ].map((x) => '<div class="stat"><div>' + x[0] + '</div><div>' + x[1] + '</div></div>').join('');
  qsa('[data-dcmode]').forEach((b) => b.classList.toggle('active', b.dataset.dcmode === dc.mode));
  const bad = w < 1 || w > myBal;
  $('dcRoll').textContent = 'Mesti · ' + fmt(w);
  $('dcRoll').disabled = dc.busy || bad;
  $('dcAuto10').disabled = $('dcAuto25').disabled = dc.busy || bad;
  $('dcStop').classList.toggle('hidden', dc.auto <= 0);
  $('dcHalf').disabled = dc.busy || w <= 1;
  $('dcDouble').disabled = dc.busy || w * 2 > myBal;
  $('dcBetIn').disabled = $('dcMax').disabled = $('dcRange').disabled = dc.busy;
  const rtp = w > 0 ? (payout * chance) / 100 / w : 0.99;
  $('dcInfo').textContent = 'Statymas ' + fmt(w) + (dc.max ? ' (visas balansas)' : '') + ' · grąžinimas šiam statymui ' + (rtp * 100).toFixed(1).replace('.', ',') + ' %' + (w > myBal && myBal > 0 ? ' · statymas didesnis už balansą' : '');
  $('dcHist').innerHTML = dc.hist.map((h) => '<span class="hchip" style="background:' + (h.win ? '#157a45' : '#7a1424') + '">' + rollText(h.r) + '</span>').join('');
}
const setTarget = (v) => {
  if (dc.busy) return;
  dc.target = Math.max(2, Math.min(98, Math.round(v)));
  renderDice();
};
$('dcRange').oninput = (e) => setTarget(Number(e.target.value));
$('dcMinus').onclick = () => setTarget(dc.target - 1);
$('dcPlus').onclick = () => setTarget(dc.target + 1);
qsa('[data-dcmode]').forEach((b) => (b.onclick = () => { if (!dc.busy) { dc.mode = b.dataset.dcmode; renderDice(); } }));
$('dcBetIn').oninput = (e) => {
  const v = parseEur(e.target.value);
  e.target.style.borderColor = e.target.value && !v ? '#ff7d8d' : '';
  if (v) {
    dc.bet = v;
    dc.max = false;
    $('dcMax').checked = false;
    renderChips();
    renderDice();
  }
};
const pickBet = (v) => {
  dc.bet = Math.max(1, Math.round(v));
  dc.max = false;
  $('dcMax').checked = false;
  $('dcBetIn').value = '';
  renderChips();
  renderDice();
};
$('dcHalf').onclick = () => pickBet(Math.floor(dcWager() / 2));
$('dcDouble').onclick = () => pickBet(Math.min(myBal, dcWager() * 2));
$('dcMax').onchange = (e) => {
  dc.max = e.target.checked;
  $('dcBetIn').value = '';
  renderChips();
  renderDice();
};
async function dcRoll() {
  const w = dcWager();
  if (w < 1 || w > myBal) {
    dc.auto = 0;
    dc.busy = false;
    renderDice();
    return;
  }
  dc.busy = true;
  renderDice();
  const spin = setInterval(() => ($('dcNum').textContent = rollText(Math.floor(Math.random() * 10000))), 45);
  const [r] = await Promise.all([send('dice:roll', { bet: dc.max ? 'max' : dc.bet, target: dc.target, mode: dc.mode }), new Promise((res) => setTimeout(res, 550))]);
  clearInterval(spin);
  if (!r.ok) {
    dc.busy = false;
    dc.auto = 0;
    renderDice();
    return;
  }
  const n = $('dcNum');
  n.textContent = rollText(r.r);
  n.style.color = r.win ? '#ffd84d' : '#ff6b7d';
  n.classList.remove('pop');
  void n.offsetWidth;
  n.classList.add('pop');
  $('dcMark').style.left = r.r / 100 + '%';
  $('dcMsg').textContent = r.win ? 'Laimėjai ' + fmt(r.pay) : 'Šįkart nelaimėjai (' + fmt(r.bet) + ')';
  dc.hist.unshift({ r: r.r, win: r.win });
  dc.hist.length = Math.min(dc.hist.length, 14);
  myBal = r.balance;
  if (dc.auto > 0) {
    dc.auto -= 1;
    $('dcMsg').textContent += dc.auto > 0 ? ' · liko ' + dc.auto : '';
    if (dc.auto > 0) {
      setTimeout(dcRoll, 450);
      renderDice();
      return;
    }
  }
  dc.busy = false;
  renderDice();
}
$('dcRoll').onclick = () => dcRoll();
$('dcAuto10').onclick = () => { dc.auto = 10; dcRoll(); };
$('dcAuto25').onclick = () => { dc.auto = 25; dcRoll(); };
$('dcStop').onclick = () => { dc.auto = 0; renderDice(); };

/* ---------- AUTOMATAS (individualiai) ---------- */
let slBusy = false;
function renderSlotBtn() {
  $('slSpin').textContent = 'Sukti · ' + fmt(chipSel.sl);
  $('slSpin').disabled = slBusy || chipSel.sl > myBal;
}
$('slSpin').onclick = async () => {
  if (slBusy) return;
  slBusy = true;
  renderSlotBtn();
  const syms = CFG.slot.syms;
  const reels = [0, 1, 2].map((i) => $('r' + i));
  reels.forEach((r) => r.classList.add('spin'));
  const flick = setInterval(() => reels.forEach((r) => r.classList.contains('spin') && (r.textContent = syms[Math.floor(Math.random() * syms.length)])), 70);
  const res = await send('slot:spin', { bet: chipSel.sl });
  if (!res.ok) {
    clearInterval(flick);
    reels.forEach((r) => r.classList.remove('spin'));
    slBusy = false;
    renderSlotBtn();
    return;
  }
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 700 : 350));
    reels[i].classList.remove('spin');
    reels[i].textContent = syms[res.reels[i]];
  }
  clearInterval(flick);
  $('slMsg').textContent = res.pay > 0 ? 'Laimėjai ' + fmt(res.pay) + ' (×' + res.x + ')' : 'Šįkart nelaimėjai';
  slBusy = false;
  renderSlotBtn();
};
function buildSlotRules() {
  const s = CFG.slot;
  $('slRules').innerHTML =
    '<table><tr><th>Derinys</th><th>Išmoka (×statymas)</th></tr>' +
    s.syms.map((x, i) => '<tr><td>' + x + x + x + '</td><td>×' + s.pay3[i] + '</td></tr>').reverse().join('') +
    '<tr><td>🍒🍒 pirmuose dviejuose būgnuose</td><td>×' + s.twoCherry + '</td></tr></table><p>Vienas laimėjimo linijos būgnų rinkinys. Išmoka apima statymą. Tikslus teorinis grąžinimas ' + (s.rtp * 100).toFixed(2).replace('.', ',') + ' %. Žaidžiama individualiai.</p>';
}

/* ---------- skyriai ir Upgrader ---------- */
let section = 'casino';
let upTab = 'upgrade';
let ugTab = 'mine';
let mineSrc = 'inv';
let INV = [];
let HIST = [];
let picked = new Set();
let upTarget = null;
let upSide = 'under';
let upCash = 0;
let upLock = false;
let shopR = 'all';
let builtUp = false;
let feedKey = '';

function shadeHex(hex, amt) {
  const n = parseInt(String(hex).slice(1), 16);
  const ch = (shift) => Math.max(0, Math.min(255, ((n >> shift) & 255) + amt));
  return '#' + [ch(16), ch(8), ch(0)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function weaponSvg(weapon, color) {
  const dark = shadeHex(color, -48);
  const light = shadeHex(color, 48);
  const body = {
    ak: '<path d="M18 58h70l8-10h78l10 6h28v8H108l-6 8H28l-8 6H18z" fill="' + color + '"/><path d="M40 70h18v16h-10l-8-16z" fill="' + dark + '"/><circle cx="200" cy="58" r="6" fill="' + light + '"/>',
    varnis: '<path d="M30 48h70v16H78l-8 14H54l6-14H30z" fill="' + color + '"/><rect x="100" y="52" width="36" height="8" rx="2" fill="' + dark + '"/>',
    pulsas: '<path d="M24 50h90l12-8h40v10H120l-8 12H36l-8 8H24z" fill="' + color + '"/><rect x="48" y="62" width="14" height="18" fill="' + dark + '"/>',
    medziotojas: '<path d="M12 54h150l8-6h50v8H168l-6 8H20z" fill="' + color + '"/><circle cx="214" cy="54" r="7" fill="' + light + '"/><rect x="70" y="62" width="10" height="20" fill="' + dark + '"/>',
    sratas: '<path d="M28 46h60l20 8h40v12H100l-16 10H40l-8 8H28z" fill="' + color + '"/><rect x="48" y="66" width="16" height="16" fill="' + dark + '"/>',
    kibirkstis: '<path d="M48 46h54v14H78l-6 16H58l5-16H48z" fill="' + color + '"/><rect x="102" y="50" width="28" height="7" fill="' + dark + '"/>',
    asmenys: '<path d="M36 78 150 28l14 10L58 86z" fill="' + color + '"/><path d="M150 28l28-8 6 16-20 6z" fill="' + light + '"/><path d="M36 78l-8 10 22 4z" fill="' + dark + '"/>',
    lokys: '<path d="M16 48h80l10-12h70v14H110l-8 14H28z" fill="' + color + '"/><rect x="36" y="62" width="46" height="12" fill="' + dark + '"/><circle cx="190" cy="46" r="8" fill="' + light + '"/>',
  }[weapon] || '<rect x="30" y="40" width="180" height="28" rx="8" fill="' + color + '"/>';
  return '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + '</svg>';
}
function skinById(id) {
  return CFG && CFG.skins ? CFG.skins.items.find((s) => s.id === id) : null;
}
function rarityOf(id) {
  return CFG.skins.rarities.find((r) => r.id === id);
}
function wearOf(id) {
  return CFG.skins.wears.find((w) => w.id === id);
}
function pctNum(x) {
  return (x * 100).toFixed(2).replace('.', ',') + ' %';
}
function pctBp(bp) {
  return (bp / 100).toFixed(2).replace('.', ',') + ' %';
}
function clientChance(input, target) {
  const u = CFG.skins.upgrade;
  if (!Number.isSafeInteger(input) || !Number.isSafeInteger(target) || input <= 0 || target <= 0) return null;
  const raw = Math.floor((input * u.keepBp) / target);
  if (raw < u.minBp) return null;
  return { bp: Math.min(raw, u.maxBp), raw };
}
function skinCardHtml(skin, opts) {
  opts = opts || {};
  const r = rarityOf(skin.rarity);
  const w = wearOf(skin.wear);
  return '<button type="button" class="skin-card' + (opts.selected ? ' sel' : '') + '" style="--r:' + r.color + '" ' + (opts.attrs || '') + '><span class="rstrip" style="background:' + r.color + '"></span><div class="art">' + weaponSvg(skin.weapon, r.color) + '</div><div class="rname">' + esc(r.name) + '</div><div class="sname">' + esc(skin.name) + '</div><div class="wear">' + esc(w.name) + '</div><div class="price">' + fmt(opts.price != null ? opts.price : skin.value) + '</div></button>';
}
function arcPath(cx, cy, r, a0, a1) {
  const span = a1 - a0;
  if (span <= 0.0001) return '';
  const ang = (f) => f * 2 * Math.PI - Math.PI / 2;
  const p0 = ang(a0);
  const p1 = ang(a1);
  const x0 = cx + r * Math.cos(p0);
  const y0 = cy + r * Math.sin(p0);
  const x1 = cx + r * Math.cos(p1);
  const y1 = cy + r * Math.sin(p1);
  return 'M ' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A ' + r + ' ' + r + ' 0 ' + (span > 0.5 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
}
function setSection(name) {
  section = name;
  qsa('[data-section]').forEach((b) => b.classList.toggle('active', b.dataset.section === name));
  $('sec-casino').classList.toggle('hidden', name !== 'casino');
  $('sec-up').classList.toggle('hidden', name !== 'up');
  $('gameNav').classList.toggle('hidden', name !== 'casino');
  $('upNav').classList.toggle('hidden', name !== 'up');
  if (name === 'up') refreshUp();
}
qsa('[data-section]').forEach((b) => (b.onclick = () => setSection(b.dataset.section)));
function setUp(name) {
  upTab = name;
  qsa('[data-up]').forEach((b) => b.classList.toggle('active', b.dataset.up === name));
  ['cases', 'shop', 'upgrade', 'inv', 'hist'].forEach((id) => $('up-' + id).classList.toggle('hidden', id !== name));
  refreshUp();
}
qsa('[data-up]').forEach((b) => (b.onclick = () => setUp(b.dataset.up)));

function renderFeed() {
  if (!S) return;
  const list = S.skinFeed || [];
  const key = list.map((e) => e.id).join(',');
  const el = $('feed');
  if (!el || key === feedKey) return;
  feedKey = key;
  if (!list.length) {
    el.innerHTML = '<div class="small">Dar nėra dėžių ar upgraderio.</div>';
    return;
  }
  el.innerHTML = list
    .map((e) => {
      const p = e.payload || {};
      const skin = skinById(p.skinId || p.targetId);
      let what = e.kind;
      if (e.kind === 'case' && skin) what = 'dėžė · ' + skin.name;
      else if (e.kind === 'upgrade' && skin) what = (p.won ? 'laimėjo' : 'nepasisekė') + ' · ' + skin.name;
      const cls = e.kind === 'upgrade' ? (p.won ? 'win' : 'lose') : '';
      return '<div class="ev"><span>' + esc(e.nick) + '</span><span class="' + cls + '">' + esc(what) + '</span></div>';
    })
    .join('');
}

function buildUpgrader() {
  if (builtUp || !CFG || !CFG.skins) return;
  builtUp = true;
  const edge = pctNum(CFG.skins.upgrade.edge);
  $('up-cases').innerHTML = '<div id="caseReel" class="reel-window hidden"></div><div id="caseMsg" class="up-result"></div><div id="caseGrid" class="case-grid"></div>';
  $('up-shop').innerHTML = '<p class="small">Kaina lygi katalogo vertei. Pardavus atgauni ' + CFG.skins.sell.num + ' % (centai apvalinami žemyn).</p><div id="shopFilters" class="filters"></div><div id="shopGrid" class="skin-grid"></div>';
  $('up-upgrade').innerHTML =
    '<div class="gauge"><svg viewBox="0 0 320 200" aria-hidden="true"><defs><linearGradient id="ugGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffe27a"/><stop offset="55%" stop-color="#ff9a3c"/><stop offset="100%" stop-color="#ff3b3b"/></linearGradient></defs><path id="ugTrack" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="16"/><path id="upArc" fill="none" stroke="url(#ugGrad)" stroke-width="16"/><g id="ugTicks"></g><g id="upPointer"><polygon points="160,46 152,170 168,170" fill="#f7f1dc"/><circle cx="160" cy="170" r="9" fill="#ffd84d" stroke="#2b1d00" stroke-width="2"/></g></svg><div class="gauge-read"><b id="upChance">—</b><span id="upTier">pasirink įnašą</span></div></div>' +
    '<div class="ug-pair"><button type="button" class="ug-slot" id="slotIn"><span class="ug-slot-h">Pasirink savo skinus (ir/arba balansą)</span><div id="slotInBody"></div></button><button type="button" class="ug-slot" id="slotOut"><span class="ug-slot-h">Pasirink norimą skiną</span><div id="slotOutBody"></div></button></div>' +
    '<button class="btn primary wide ug-go" id="upGo" type="button">Upgrade</button><div id="upMsg" class="up-result"></div>' +
    '<div class="ug-bal"><div class="ug-bal-top"><span>Balanso suma</span><b id="upCashLabel">0,00 €</b></div><input id="upRange" type="range" min="0" max="0" value="0" aria-label="Balanso suma"/><div class="ug-bal-top"><span>0</span><span id="upCashMax">max 0,00 €</span></div></div>' +
    '<div class="ug-quick" id="ugQuick"><button type="button" data-mult="2">x2</button><button type="button" data-mult="4">x4</button><button type="button" data-mult="8">x8</button><button type="button" data-chance="500">5%</button><button type="button" data-chance="5500">55%</button><button type="button" data-chance="7500">75%</button><button type="button" id="ugGear" aria-label="Nustatymai">⚙</button></div>' +
    '<div id="ugSettings" class="ug-settings hidden"><div class="seg"><button class="segb active" id="sideUnder" type="button">Žemiau</button><button class="segb" id="sideOver" type="button">Virš</button></div><button class="btn" id="ugSound" type="button">Garsas</button><p class="small">Tikimybė = įnašas / tikslas × ' + (100 - edgeNum()) + ' %. Mažiausia 1 %, didžiausia 80 %. Virš 80 % nukerpama. Namų dalis ' + edge + '. Metimą renka serveris. Pralaimėjus įnašas prarandamas. Žaidimo pinigai, ne tikri.</p></div>' +
    '<div class="ug-tabs" id="ugTabs"><button type="button" class="active" data-ugtab="mine">Mano skinai</button><button type="button" data-ugtab="want">Norimi skinai</button></div>' +
    '<div id="ugMineTools" class="ug-tools"><div class="seg" id="ugSrc"><button type="button" class="segb active" data-src="inv">Mano skinai</button><button type="button" class="segb" data-src="shop">Parduotuvė</button></div><button class="btn small" id="invSell" type="button">Parduoti pažymėtus (90 %)</button></div>' +
    '<div id="ugGrid" class="skin-grid"></div>';
  $('up-inv').innerHTML = '<div class="row wrap"><button class="btn primary" id="invSell" type="button">Parduoti pažymėtus</button><button class="btn" id="invToUp" type="button">Į Upgraderį</button></div><div id="invGrid" class="skin-grid"></div>';
  $('up-hist').innerHTML = '<div id="histList" class="hist-list"></div>';
  $('caseGrid').innerHTML = CFG.skins.cases
    .map((c) => {
      const rows = c.drops
        .map((d) => {
          const s = skinById(d.id);
          return '<tr><td>' + esc(s.name) + '</td><td>' + pctNum(d.p) + '</td></tr>';
        })
        .join('');
      return '<article class="case-card"><h3>' + esc(c.name) + '</h3><p class="small">' + esc(c.blurb) + '</p><b>' + fmt(c.price) + '</b><p class="small">Teorinis grąžinimas ' + pctNum(c.rtp) + ' · vidutinė iškrito vertė ' + fmt(c.ev) + '.</p><table class="odds">' + rows + '</table><button class="btn primary" type="button" data-case="' + c.id + '">Atidaryti</button></article>';
    })
    .join('');
  $('caseGrid').onclick = (e) => {
    const b = e.target.closest('[data-case]');
    if (b) openCase(b.dataset.case);
  };
  const filters = [{ id: 'all', name: 'Visi' }].concat(CFG.skins.rarities);
  $('shopFilters').innerHTML = filters.map((f) => '<button type="button" class="btn small' + (f.id === 'all' ? ' primary' : '') + '" data-rar="' + f.id + '">' + esc(f.name) + '</button>').join('');
  $('shopFilters').onclick = (e) => {
    const b = e.target.closest('[data-rar]');
    if (!b) return;
    shopR = b.dataset.rar;
    [...$('shopFilters').children].forEach((x) => x.classList.toggle('primary', x.dataset.rar === shopR));
    renderShop();
  };
  drawGaugeStatic();
  $('sideUnder').onclick = () => {
    upSide = 'under';
    $('sideUnder').classList.add('active');
    $('sideOver').classList.remove('active');
    refreshUp();
  };
  $('sideOver').onclick = () => {
    upSide = 'over';
    $('sideOver').classList.add('active');
    $('sideUnder').classList.remove('active');
    refreshUp();
  };
  $('upRange').oninput = () => {
    upCash = Number($('upRange').value) || 0;
    refreshUp();
  };
  $('upGo').onclick = doUpgrade;
  $('invSell').onclick = () => sellIds([...picked]);
  $('ugGear').onclick = () => $('ugSettings').classList.toggle('hidden');
  $('ugSound').onclick = () => {
    audioOn = !audioOn;
    storeSet('kazino:sound', audioOn ? '1' : '0');
    paintSound();
    if (audioOn) blip(740, 0.1, 'sine');
  };
  $('ugQuick').onclick = (e) => {
    const b = e.target.closest('[data-mult],[data-chance]');
    if (!b) return;
    if (b.dataset.mult) pickTargetMult(Number(b.dataset.mult));
    else pickTargetChance(Number(b.dataset.chance));
  };
  $('slotIn').onclick = () => {
    ugTab = 'mine';
    refreshUp();
    const g = $('ugGrid');
    if (g && g.scrollIntoView) g.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  $('slotOut').onclick = () => {
    ugTab = 'want';
    refreshUp();
  };
  $('ugTabs').onclick = (e) => {
    const b = e.target.closest('[data-ugtab]');
    if (!b) return;
    ugTab = b.dataset.ugtab;
    refreshUp();
  };
  $('ugSrc').onclick = (e) => {
    const b = e.target.closest('[data-src]');
    if (!b) return;
    mineSrc = b.dataset.src;
    refreshUp();
  };
  $('ugGrid').onclick = (e) => {
    if (e.target.closest('[data-item]')) return togglePick(e);
    const buy = e.target.closest('[data-buy]');
    if (buy) return buySkin(buy.dataset.buy);
    const t = e.target.closest('[data-target]');
    if (!t) return;
    upTarget = t.dataset.target;
    refreshUp();
  };
  $('shopGrid').onclick = (e) => {
    const b = e.target.closest('[data-buy]');
    if (b) buySkin(b.dataset.buy);
  };
  renderShop();
  refreshUp();
}
function renderShop() {
  if (!builtUp) return;
  const items = CFG.skins.items.filter((s) => shopR === 'all' || s.rarity === shopR);
  $('shopGrid').innerHTML = items.map((s) => skinCardHtml(s, { attrs: 'data-buy="' + s.id + '"' })).join('');
}
function edgeNum() {
  const edge = CFG && CFG.skins ? CFG.skins.upgrade.edge : 0.07;
  return String(Math.round(100 - edge * 100));
}
const GAUGE_CX = 160;
const GAUGE_CY = 170;
function gaugeXY(t, r) {
  const a = Math.PI * (1 - t);
  return [GAUGE_CX + r * Math.cos(a), GAUGE_CY - r * Math.sin(a)];
}
function semiPath(t0, t1, r) {
  if (t1 - t0 <= 0.001) return '';
  const p0 = gaugeXY(t0, r);
  const p1 = gaugeXY(t1, r);
  const large = t1 - t0 > 0.5 ? 1 : 0;
  return 'M ' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
}
function drawGaugeStatic() {
  const ticks = $('ugTicks');
  const track = $('ugTrack');
  if (!ticks || !track || ticks.childNodes.length) return;
  track.setAttribute('d', semiPath(0, 1, 128));
  let html = '';
  for (let i = 0; i <= 10; i++) {
    const a = gaugeXY(i / 10, 116);
    const b = gaugeXY(i / 10, 142);
    html += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="rgba(255,255,255,.55)" stroke-width="2"/>';
  }
  ticks.innerHTML = html;
}
function emptySlot(dir) {
  const chev = dir === 'down' ? 'M5 8l7 7 7-7' : 'M5 15l7-7 7 7';
  return '<div class="ug-ph"><div class="art">' + weaponSvg('ak', '#6a6258') + '</div><svg class="chev" viewBox="0 0 24 24" width="28" height="22" aria-hidden="true"><path d="' + chev + '" fill="none" stroke="#cbbfa6" stroke-width="2" stroke-linecap="round"/></svg></div>';
}
function pickedSkins() {
  const out = [];
  picked.forEach((id) => {
    const it = INV.find((x) => x.id === id);
    const s = it && skinById(it.skinId);
    if (s) out.push(s);
  });
  return out;
}
function fillSlots() {
  const inn = $('slotInBody');
  const out = $('slotOutBody');
  if (!inn || !out) return;
  const skins = pickedSkins();
  if (!skins.length && !upCash) inn.innerHTML = emptySlot('down');
  else {
    const s0 = skins[0];
    const art = s0 ? weaponSvg(s0.weapon, rarityOf(s0.rarity).color) : weaponSvg('ak', '#ffd84d');
    const bits = [];
    if (skins.length) bits.push(skins.length + (skins.length === 1 ? ' skinas' : ' skinai'));
    if (upCash) bits.push('balansas');
    inn.innerHTML = '<div class="ug-picked"><div class="art">' + art + '</div><b>' + fmt(selectedSkinValue() + upCash) + '</b><span>' + esc(bits.join(' + ')) + '</span></div>';
  }
  const target = upTarget ? skinById(upTarget) : null;
  if (!target) out.innerHTML = emptySlot('up');
  else out.innerHTML = '<div class="ug-picked"><div class="art">' + weaponSvg(target.weapon, rarityOf(target.rarity).color) + '</div><b>' + esc(target.name) + '</b><span>' + fmt(target.value) + '</span></div>';
}
function chanceTier(bp) {
  if (!bp) return 'pasirink įnašą';
  if (bp < 2500) return 'mažas šansas';
  if (bp < 6000) return 'vidutinis šansas';
  return 'didelis šansas';
}
function closestSkin(ideal, onlyAbove) {
  let best = null;
  let bestDiff = Infinity;
  CFG.skins.items.forEach((s) => {
    if (onlyAbove && s.value <= onlyAbove) return;
    const d = Math.abs(s.value - ideal);
    if (d < bestDiff) {
      bestDiff = d;
      best = s;
    }
  });
  return best;
}
function pickTargetMult(mult) {
  const input = selectedSkinValue() + upCash;
  if (input <= 0) return toast('Pirmiausia pasirink skiną arba balanso sumą');
  const skin = closestSkin(input * mult, 0) || closestSkin(input * mult, null);
  if (!skin) return;
  upTarget = skin.id;
  ugTab = 'want';
  refreshUp();
}
function pickTargetChance(bp) {
  const input = selectedSkinValue() + upCash;
  if (input <= 0) return toast('Pirmiausia pasirink skiną arba balanso sumą');
  const keep = CFG.skins.upgrade.keepBp;
  const ideal = Math.max(1, Math.round((input * keep) / bp));
  const skin = closestSkin(ideal, input) || closestSkin(ideal, null);
  if (!skin) return;
  upTarget = skin.id;
  ugTab = 'want';
  refreshUp();
}
function renderUgGrid() {
  const grid = $('ugGrid');
  if (!grid) return;
  if ($('ugMineTools')) $('ugMineTools').classList.toggle('hidden', ugTab !== 'mine');
  qsa('#ugTabs [data-ugtab]').forEach((b) => b.classList.toggle('active', b.dataset.ugtab === ugTab));
  qsa('#ugSrc [data-src]').forEach((b) => b.classList.toggle('active', b.dataset.src === mineSrc));
  if (ugTab === 'want') {
    grid.innerHTML = CFG.skins.items.map((s) => skinCardHtml(s, { selected: s.id === upTarget, attrs: 'data-target="' + s.id + '"' })).join('');
    return;
  }
  if (mineSrc === 'shop') {
    const items = CFG.skins.items.filter((s) => shopR === 'all' || s.rarity === shopR);
    grid.innerHTML = items.map((s) => skinCardHtml(s, { attrs: 'data-buy="' + s.id + '"' })).join('') || '<p class="small">Parduotuvė tuščia.</p>';
    return;
  }
  grid.innerHTML = INV.length ? itemCards() : '<p class="small">Inventorius tuščias. Atidaryk dėžę arba perjunk į parduotuvę.</p>';
}
function itemCards() {
  if (!INV.length) return '<p class="small">Inventorius tuščias. Atidaryk dėžę arba nusipirk skiną.</p>';
  return INV.map((it) => {
    const s = skinById(it.skinId);
    if (!s) return '';
    return skinCardHtml(s, { selected: picked.has(it.id), attrs: 'data-item="' + it.id + '"' });
  }).join('');
}
function togglePick(e) {
  const b = e.target.closest('[data-item]');
  if (!b || upLock) return;
  const id = Number(b.dataset.item);
  if (picked.has(id)) picked.delete(id);
  else picked.add(id);
  refreshUp();
}
function selectedSkinValue() {
  let v = 0;
  for (const id of picked) {
    const it = INV.find((x) => x.id === id);
    const s = it && skinById(it.skinId);
    if (s) v += s.value;
  }
  return v;
}
function refreshUp() {
  if (!builtUp) return;
  for (const id of [...picked]) if (!INV.some((x) => x.id === id)) picked.delete(id);
  if (upCash > myBal) upCash = myBal;
  const input = selectedSkinValue() + upCash;
  const target = upTarget ? skinById(upTarget) : null;
  const ch = target ? clientChance(input, target.value) : null;
  if ($('upChance')) $('upChance').textContent = ch ? pctBp(ch.bp) : '—';
  if ($('upTier')) $('upTier').textContent = ch ? chanceTier(ch.bp) : 'pasirink įnašą';
  drawDial(ch ? ch.bp : 0, upSide);
  fillSlots();
  const range = $('upRange');
  if (range) {
    range.max = String(Math.max(0, myBal));
    if (document.activeElement !== range) range.value = String(upCash);
    if ($('upCashLabel')) $('upCashLabel').textContent = fmt(upCash);
    if ($('upCashMax')) $('upCashMax').textContent = 'max ' + fmt(myBal);
  }
  if ($('upGo')) $('upGo').disabled = upLock || !ch;
  renderUgGrid();
  if (!$('histList')) return;
  $('histList').innerHTML = HIST.length
    ? HIST.map((h) => {
        const p = h.payload || {};
        const s = skinById(p.skinId || p.targetId);
        let t = h.kind;
        if (h.kind === 'case' && s) t = 'Dėžė: ' + s.name + ' (' + fmt(p.value) + ')';
        if (h.kind === 'buy' && s) t = 'Pirkai: ' + s.name;
        if (h.kind === 'sell') t = 'Pardavei už ' + fmt(p.payout || 0);
        if (h.kind === 'upgrade' && s) t = (p.won ? 'Upgraderis laimėtas: ' : 'Upgraderis pralaimėtas: ') + s.name + ' · ' + pctBp(p.chanceBp || 0);
        return '<div class="ev"><span>' + esc(t) + '</span><span class="small">' + new Date(h.createdAt).toLocaleString('lt-LT') + '</span></div>';
      }).join('')
    : '<p class="small">Istorija tuščia.</p>';
}
function drawDial(bp, side) {
  const arc = $('upArc');
  if (!arc) return;
  const p = Math.max(0, Math.min(1, (bp || 0) / 10000));
  const start = side === 'over' ? 1 - p : 0;
  const end = side === 'over' ? 1 : p;
  arc.setAttribute('d', p ? semiPath(start, end, 128) : '');
}
function animateCase(caseId, skinId) {
  return new Promise((resolve) => {
    const kase = CFG.skins.cases.find((c) => c.id === caseId);
    const win = skinById(skinId);
    const pool = kase.drops.map((d) => skinById(d.id));
    const cards = [];
    for (let i = 0; i < 46; i++) cards.push(pool[Math.floor(Math.random() * pool.length)]);
    cards[40] = win;
    const strip = document.createElement('div');
    strip.className = 'reel-strip';
    strip.innerHTML = cards.map((s) => skinCardHtml(s, {})).join('');
    const box = $('caseReel');
    box.classList.remove('hidden');
    box.innerHTML = '<div class="reel-mark"></div>';
    box.appendChild(strip);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : 4600;
    const cardW = 140;
    const center = box.clientWidth / 2 - 66;
    const jitter = reduce ? 0 : (Math.random() - 0.5) * 30;
    strip.style.transform = 'translateX(0px)';
    requestAnimationFrame(() => {
      strip.style.transition = 'transform ' + dur + 'ms cubic-bezier(.12,.7,.08,1)';
      strip.style.transform = 'translateX(' + -(40 * cardW - center + jitter) + 'px)';
    });
    setTimeout(() => {
      const landed = strip.children[40];
      if (landed) landed.classList.add('landed');
      const rar = win && rarityOf(win.rarity);
      if (rar && rar.rank >= 3) celebrate();
      else blip(660, 0.12, 'sine');
      resolve();
    }, dur + 80);
  });
}
function spinDial(roll) {
  return new Promise((resolve) => {
    const el = $('upPointer');
    if (!el) return resolve();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : 4600;
    const landing = -90 + (roll / 10000) * 180;
    const start = reduce ? landing : landing - 720;
    const t0 = Date.now();
    function frame() {
      const t = dur === 0 ? 1 : Math.min(1, (Date.now() - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const ang = start + (landing - start) * e;
      el.setAttribute('transform', 'rotate(' + ang.toFixed(2) + ' 160 170)');
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}
async function loadSkins() {
  if (!me.in) return;
  const r = await send('skins:get', {}, true);
  if (!r.ok) return;
  INV = r.items || [];
  HIST = r.history || [];
  refreshUp();
}
async function openCase(id) {
  if (upLock) return;
  upLock = true;
  const res = await send('case:open', id);
  if (!res.ok) {
    upLock = false;
    return;
  }
  INV = res.items || INV;
  $('caseMsg').textContent = 'Sukama…';
  await animateCase(id, res.skinId);
  const s = skinById(res.skinId);
  $('caseMsg').textContent = 'Iškrito ' + (s ? s.name : '') + ' · ' + fmt(s ? s.value : 0);
  upLock = false;
  refreshUp();
  loadSkins();
}
async function buySkin(id) {
  if (upLock) return;
  upLock = true;
  const r = await send('shop:buy', id);
  upLock = false;
  if (!r.ok) return;
  INV = r.items || INV;
  toast('Skinas inventoriaus', true);
  refreshUp();
  loadSkins();
}
async function sellIds(ids) {
  if (upLock || !ids.length) return toast('Pažymėk skiną');
  upLock = true;
  const r = await send('skin:sell', ids);
  upLock = false;
  if (!r.ok) return;
  INV = r.items || INV;
  ids.forEach((id) => picked.delete(Number(id)));
  toast('Parduota už ' + fmt(r.payout), true);
  refreshUp();
  loadSkins();
}
async function doUpgrade() {
  if (upLock || !upTarget) return;
  const items = [...picked].filter((id) => INV.some((x) => x.id === id));
  upLock = true;
  $('upGo').disabled = true;
  const r = await send('upgrade:roll', { items, cash: upCash, target: upTarget, side: upSide });
  if (!r.ok) {
    upLock = false;
    refreshUp();
    return;
  }
  drawDial(r.chanceBp, r.side);
  await spinDial(r.roll);
  INV = r.items || INV;
  picked.clear();
  upCash = 0;
  if ($('upRange')) $('upRange').value = '0';
  const wonName = (skinById(r.targetId) || {}).name || 'skiną';
  $('upMsg').textContent = r.won ? 'Laimėjai ' + wonName : 'Nepasisekė – įnašas prarastas';
  $('upMsg').className = 'up-result ' + (r.won ? 'win' : 'lose');
  if (r.won) celebrate();
  else blip(180, 0.18, 'sawtooth');
  upLock = false;
  refreshUp();
  loadSkins();
}

/* ---------- garsas, šventė, tinklas ---------- */
let audioOn = storeGet('kazino:sound') === '1';
let actx = null;
function blip(freq, dur, type) {
  if (!audioOn) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!actx) actx = new AC();
    if (actx.state === 'suspended' && actx.resume) actx.resume();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const t0 = actx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start();
    o.stop(t0 + dur + 0.02);
  } catch (e) {}
}
function buzz(ms) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms || 12);
  } catch (e) {}
}
function paintSound() {
  const on = audioOn ? 'Garsas įj.' : 'Garsas išj.';
  if ($('soundBtn')) {
    $('soundBtn').textContent = on;
    $('soundBtn').setAttribute('aria-pressed', audioOn ? 'true' : 'false');
  }
  if ($('ugSound')) $('ugSound').textContent = audioOn ? 'Garsas įjungtas' : 'Garsas išjungtas';
}
function celebrate() {
  blip(523, 0.12, 'triangle');
  setTimeout(() => blip(784, 0.16, 'triangle'), 90);
  buzz(20);
  const canvas = $('fx');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  const colors = ['#ffd84d', '#7dffb0', '#d32ce6', '#5e98d9', '#fff', '#eb4b4b'];
  const bits = [];
  for (let i = 0; i < 70; i++) {
    bits.push({ x: w / 2, y: h * 0.35, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -12 - 2, g: 0.28, c: colors[i % colors.length], s: 4 + Math.random() * 5 });
  }
  let frame = 0;
  function tick() {
    frame++;
    ctx.clearRect(0, 0, w, h);
    let alive = false;
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i];
      b.vy += b.g;
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < h + 20) alive = true;
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, b.y, b.s, b.s * 0.6);
    }
    if (alive && frame < 90) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, w, h);
  }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  requestAnimationFrame(tick);
}
function pollHealth() {
  fetch('/health', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j) => {
      if ($('healthNote')) $('healthNote').textContent = j && j.ok ? ' /health: serveris veikia' + (j.db ? ' (' + j.db + ')' : '') + '.' : '';
      if (j && j.ok && cfgReady && socket && !socket.connected && socket.connect) socket.connect();
    })
    .catch(() => {
      if ($('healthNote')) $('healthNote').textContent = ' /health neatsako – serveris tikriausiai bunda.';
      if (!socket.connected) showNet('Serveris bunda…', 'Nemokamas serveris po pauzės atsikelia apie minutę. Bandome automatiškai.');
    });
}
let cfgReady = false;
function bootConfig(attempt) {
  fetch('/config.json', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('bad');
      return r.json();
    })
    .then((c) => {
      cfgReady = true;
      CFG = c;
      buildRoulette();
      buildWheel();
      buildSlotRules();
      renderChips();
      renderDice();
      renderSlotBtn();
      buildUpgrader();
      wireShell();
      avatarPicker($('regAvatars'), regAvatar, (a) => (regAvatar = a));
      $('nickIn').value = storeGet('kazino:nick') || '';
      if (storeMemoryOnly && $('storeNote')) $('storeNote').classList.remove('hidden');
      const saved = storeGet(TOKEN_KEY);
      if (saved) {
        $('authWait').classList.remove('hidden');
        $('authForm').classList.add('hidden');
        setBoot('Atkuriama sesija…');
      } else hideBoot();
      if (socket.connect) socket.connect();
    })
    .catch(() => {
      setBoot('Serveris bunda… Nepavyko gauti nustatymų. Bandome dar kartą (' + (attempt + 1) + ').');
      showNet('Serveris bunda…', 'Jei puslapis tuščias ilgai, palauk iki minutės ir neperkrauk be reikalo.');
      setTimeout(() => bootConfig(attempt + 1), Math.min(3000 + attempt * 700, 8000));
    });
}
function wireShell() {
  paintSound();
  if ($('soundBtn')) {
    $('soundBtn').onclick = () => {
      audioOn = !audioOn;
      storeSet('kazino:sound', audioOn ? '1' : '0');
      paintSound();
      if (audioOn) blip(740, 0.1, 'sine');
    };
  }
  if ($('dailyBtn')) {
    const pr = (CFG && CFG.progress) || { daily: 100000 };
    $('dailyBtn').textContent = 'Dienos dovana ' + fmt(pr.daily);
    $('dailyBtn').onclick = async () => {
      const r = await send('bonus:claim');
      if (!r.ok) {
        if ($('dailyMsg')) $('dailyMsg').textContent = r.error || '';
        return;
      }
      if ($('dailyMsg')) $('dailyMsg').textContent = 'Gavai ' + fmt(r.amount) + ' žaidimo pinigų.';
      celebrate();
    };
  }
  const emos = ['😀', '😂', '🔥', '🍀', '👑', '💰', '🎯', '👏', '😎', '🃏', '💎', '❤️'];
  if ($('emojiBar') && !$('emojiBar').childElementCount) {
    $('emojiBar').innerHTML = emos.map((e) => '<button type="button" class="emo" data-emo="' + e + '">' + e + '</button>').join('');
    $('emojiBar').onclick = (ev) => {
      const b = ev.target.closest('[data-emo]');
      if (!b) return;
      const input = $('chatIn');
      input.value = (input.value + ' ' + b.getAttribute('data-emo')).trim();
      input.focus();
    };
  }
  const lobby = $('lobby');
  if (lobby && !lobby.dataset.wired) {
    lobby.dataset.wired = '1';
    lobby.onclick = (ev) => {
      const b = ev.target.closest('[data-goto],[data-goto-sec]');
      if (!b) return;
      buzz(12);
      if (b.dataset.gotoSec) setSection(b.dataset.gotoSec);
      else setGameTab(b.dataset.goto);
    };
  }
  const nav = $('bottomNav');
  if (nav && !nav.dataset.wired) {
    nav.dataset.wired = '1';
    nav.onclick = (ev) => {
      const b = ev.target.closest('[data-bnav]');
      if (!b) return;
      buzz(10);
      const k = b.dataset.bnav;
      if (k === 'up') setSection('up');
      else if (k === 'chat') {
        setSection('casino');
        const box = document.querySelector('.chatbox');
        if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (k === 'profile') {
        $('profPanel').classList.remove('hidden');
        $('topPanel').classList.add('hidden');
        renderProfile();
        $('profPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (k === 'games') {
        setSection('casino');
        if (tab === 'home') setGameTab('bj');
        else setGameTab(tab);
      } else {
        setSection('casino');
        setGameTab('home');
      }
      qsa('#bottomNav [data-bnav]').forEach((x) => x.classList.toggle('on', x === b));
    };
  }
}
document.body.addEventListener('click', (ev) => {
  const b = ev.target.closest && ev.target.closest('button');
  if (!b) return;
  buzz(8);
  blip(480, 0.04, 'triangle');
});
setTimeout(() => {
  if (!socket.connected) setBoot('Serveris bunda… Nemokamas serveris po pauzės dažnai atsikelia tik po 30–60 s. Nieko nespausk – bandysime patys.');
}, 2500);
setInterval(pollHealth, 5000);
setTimeout(pollHealth, 1200);

/* ---------- paleidimas ---------- */
bootConfig(0);
