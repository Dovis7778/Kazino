'use strict';
(function () {
  const games = { crash: 'crash', mines: 'mines', plinko: 'plinko', coinflip: 'coinflip', kovos: 'battles' };
  const loading = {};
  function loadGame(name) {
    const file = games[name];
    if (!file) return Promise.resolve();
    if (window.KZGames && window.KZGames[name]) return Promise.resolve();
    if (loading[name]) return loading[name];
    const src = (window.ASSET && window.ASSET[name]) || ('games/' + file + '.js');
    loading[name] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error(name));
      document.body.appendChild(s);
    });
    return loading[name];
  }
  function boot() {
    const K = window.KZ;
    if (!K || !K.socket) return setTimeout(boot, 50);
    const { $, send, fmt, toast, esc, setGameTab, openProfile } = K;
    window.onGameTab = function (name) {
      if (!games[name]) return;
      loadGame(name).then(() => { if (window.KZGames && window.KZGames[name]) window.KZGames[name](K); }).catch(() => toast('Žaidimo nepavyko įkelti'));
    };
    const orig = setGameTab;
    K.setGameTab = function (name) { orig(name); };
    const home = $('lobbyHome');
    if (home && !home.dataset.ready) {
      home.dataset.ready = '1';
      home.innerHTML = '<div class="lobby"><button class="lobby-card" type="button" data-goto="home"><b>Žaidimai</b><span>Blackjack, Crash, Mines, Plinko</span></button><button class="lobby-card" type="button" data-goto="kovos"><b>Kovos</b><span>Dėžės prieš draugus</span></button><button class="lobby-card" type="button" id="openMissions"><b>Misijos</b><span>Dienos, savaitės, VIP</span></button><button class="lobby-card" type="button" data-goto-sec="up"><b>Upgrader</b><span>Dėžės ir skinų ratas</span></button></div><div class="panel"><div class="panel-h">Kas laimi dabar</div><div id="lobbyFeed" class="meta-list"><div class="skel"></div></div></div><div class="panel" id="lobbyToursWrap"><div class="panel-h">Turnyrai</div><p class="small">Žaidimo pinigų fondas iš namų.</p><div id="lobbyTours" class="meta-list"><div class="skel"></div></div><p class="small" id="lobbyOnline"></p></div>';
      home.onclick = (e) => {
        const go = e.target.closest('[data-goto]');
        if (go) K.setGameTab(go.dataset.goto);
        const sec = e.target.closest('[data-goto-sec]');
        if (sec && K.setSection) K.setSection(sec.dataset.gotoSec);
        if (e.target.closest('#openMissions') && openProfile) openProfile();
      };
    }
    function tourScore(t, score) {
      if (t.id === 'crash' || t.id === 'crash-w') return (Number(score) / 100).toFixed(2).replace('.', ',') + '×';
      return fmt(score);
    }
    function leftTxt(endsAt) {
      const ms = Number(endsAt) - Date.now();
      if (!endsAt || ms <= 0) return 'baigiasi';
      const s = Math.floor(ms / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (h > 48) return Math.floor(h / 24) + ' d.';
      return h + ' val. ' + m + ' min.';
    }
    let tourCache = [];
    function tourHtml(list) {
      return (list || []).map((x) => '<div class="ev"><div><b>' + esc(x.name) + '</b><span class="small">liko ' + leftTxt(x.endsAt) + '</span></div><span>fondas ' + fmt(x.pool) + '</span></div>').join('');
    }
    function missionRow(x) {
      const pct = x.goal ? Math.min(100, Math.round((x.progress / x.goal) * 100)) : 0;
      const label = x.id === 'w-wager' ? fmt(Math.min(x.progress, x.goal)) + ' / ' + fmt(x.goal) : x.progress + ' / ' + x.goal;
      const prize = x.caseId ? 'Nemokama dėžė' : fmt(x.reward);
      return '<div class="mission"><div class="ev"><span>' + esc(x.title) + '</span><span>' + label + '</span></div><div class="lvl-bar"><div style="width:' + pct + '%"></div></div>' + (x.progress >= x.goal && !x.claimed ? '<button type="button" class="btn small" data-claim="' + x.id + '">Atsiimti ' + prize + '</button>' : x.claimed ? '<span class="small">Atsiimta</span>' : '') + '</div>';
    }
    async function refreshMeta() {
      const m = await send('mission:list', {}, true);
      const box = $('missionBox');
      if (m.ok && box) {
        box.innerHTML = '<div class="panel-h">Misijos</div><p class="small">Atsinaujina vidurnaktį Europe/Vilnius. Atlygis – žaidimo pinigai arba dėžė.</p>' + m.missions.map(missionRow).join('');
        box.onclick = (e) => {
          const b = e.target.closest('[data-claim]');
          if (!b) return;
          send('mission:claim', b.dataset.claim).then((r) => {
            if (!r.ok) return;
            toast(r.caseId ? 'Gavai nemokamą dėžę' : 'Misija: ' + fmt(r.reward), true);
            refreshMeta();
          });
        };
      }
      const v = await send('vip:get', {}, true);
      const vip = $('vipBox');
      if (v.ok && vip) {
        const pct = v.need ? Math.min(100, Math.round((v.into / v.need) * 100)) : 100;
        vip.innerHTML = '<div class="panel-h">VIP · ' + esc(v.name) + '</div><p class="small">' + esc(v.perks) + (v.next ? ' · iki ' + esc(v.next) : '') + '</p><div class="lvl-bar"><div style="width:' + pct + '%"></div></div><div class="row wrap"><button class="btn" id="vipRake" type="button">Grąža ' + fmt(v.rake) + '</button><button class="btn" id="vipCase" type="button">VIP dėžė</button></div>';
        if ($('vipRake')) $('vipRake').onclick = () => send('vip:rake', {}).then((r) => r.ok && toast('Grąža ' + fmt(r.amount), true));
        if ($('vipCase')) $('vipCase').onclick = () => send('vip:case', {}).then((r) => {
          if (!r.ok) return;
          const skin = K.skinById(r.skinId);
          toast('VIP dėžė: ' + (skin ? skin.name : r.caseId), true);
        });
      }
      const t = await send('tour:list', {}, true);
      tourCache = t.ok ? t.tournaments : [];
      const html = tourHtml(tourCache) || '<div class="small">Turnyrų nėra</div>';
      if ($('tourBox')) $('tourBox').innerHTML = '<div class="panel-h">Turnyrai</div><div class="meta-list">' + html + '</div>';
      if ($('lobbyTours')) $('lobbyTours').innerHTML = html;
      const fair = await send('fair:get', {}, true);
      const fairBox = $('fairBox');
      if (fair.ok && fairBox && !fairBox.dataset.ready) {
        fairBox.dataset.ready = '1';
        fairBox.innerHTML = '<div class="panel-h">Sąžiningumas</div><p class="small">Metimas = HMAC-SHA256(serverio sėkla, „klientas:nonce:cursor“) modulis. Crash taškas iš tos pačios sėklos, maišas rodomas prieš raundą. Žaidimo pinigai, ne tikri.</p><p class="small">Maišas</p><p class="mono">' + esc(fair.serverHash) + '</p><div class="row wrap"><input id="fairClient" maxlength="32" value="' + esc(fair.clientSeed) + '" /><button class="btn" id="fairSave" type="button">Išsaugoti</button><button class="btn" id="fairRot" type="button">Atverti sėklą</button></div><p class="small">Nonce ' + fair.nonce + '</p><div class="row wrap"><input id="fairSeed" placeholder="Serverio sėkla" /><input id="fairNonce" inputmode="numeric" placeholder="Nonce" /><input id="fairN" inputmode="numeric" placeholder="Modulis" value="10000" /><button class="btn" id="fairCheck" type="button">Tikrinti</button></div><p id="fairOut" class="small"></p>';
        $('fairSave').onclick = () => send('fair:client', $('fairClient').value).then((r) => r.ok && toast('Kliento sėkla išsaugota', true));
        $('fairRot').onclick = () => send('fair:rotate', {}).then((r) => { if (r.ok) { toast('Sena sėkla atverta', true); $('fairOut').textContent = r.revealed || ''; refreshMeta(); } });
        $('fairCheck').onclick = () => send('fair:check', { serverSeed: $('fairSeed').value, clientSeed: $('fairClient').value, nonce: Number($('fairNonce').value), n: Number($('fairN').value) }).then((r) => { if (r.ok) $('fairOut').textContent = 'Metimas: ' + r.roll; });
      }
    }
    let sawMe = false;
    K.socket.on('state', (st) => {
      const feed = $('lobbyFeed');
      if (feed && st && st.skinFeed) {
        feed.innerHTML = st.skinFeed.slice(0, 6).map((e) => '<div class="ev"><span>' + esc(e.nick) + ' · ' + esc(e.kind) + '</span><b>' + fmt((e.payload && e.payload.value) || 0) + '</b></div>').join('') || '<div class="small">Dar nėra laimėjimų.</div>';
      }
      if ($('lobbyOnline') && st) $('lobbyOnline').textContent = 'Prisijungę: ' + ((st.online && st.online.length) || 0);
      if (st && st.me && !sawMe) { sawMe = true; refreshMeta(); }
    });
    K.socket.on('connect', () => { if (sawMe) refreshMeta(); });
    if (typeof window.renderProfile === 'function') {
      const prev = window.renderProfile;
      window.renderProfile = function () { prev(); refreshMeta(); };
    }
    setInterval(refreshMeta, 15000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
