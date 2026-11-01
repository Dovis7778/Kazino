'use strict';
(function () {
  function boot() {
    const K = window.KZ;
    if (!K || !K.socket) return setTimeout(boot, 50);
    const { $, send, fmt, toast, esc, setGameTab, openProfile } = K;
    const qsa = K.qsa;
    const panels = {
      crash: '<div class="felt dc-felt"><div class="status"><span id="crPhase">Statymai</span><b id="crMult">1,00×</b></div><div class="crash-stage" aria-hidden="true"><div class="crash-track"><div id="crFill" class="crash-fill"></div></div><div id="crRocket" class="crash-rocket">▲</div></div><p class="small">Bendras raundas visiems. Grąža apie 96,5 %. Išeik, kol daugiklis kyla. Žaidimo pinigai, ne tikri.</p><div id="crBets" class="meta-list"></div><div class="row wrap"><input id="crBet" inputmode="decimal" placeholder="Statymas, €" /><input id="crAuto" inputmode="decimal" placeholder="Auto ×" /><button class="btn primary" id="crGo" type="button">Statyti</button><button class="btn" id="crOut" type="button">Išeiti</button></div><div id="crHist" class="hist"></div></div>',
      mines: '<div class="felt dc-felt"><div class="status"><span>Mines</span><b id="mnMult">1,00×</b></div><p class="small">5×5. Daugiklis iš tikimybės × 96,5 %. Pasiimk kada nori. Žaidimo pinigai, ne tikri.</p><div class="row wrap"><input id="mnBet" inputmode="decimal" placeholder="Statymas, €" /><input id="mnCount" inputmode="numeric" value="3" aria-label="Minų skaičius" /><button class="btn primary" id="mnGo" type="button">Pradėti</button><button class="btn" id="mnOut" type="button">Pasiimti</button></div><div id="mnGrid" class="mine-grid"></div></div>',
      plinko: '<div class="felt dc-felt"><div class="status"><span>Plinko</span><b id="pkMsg">—</b></div><p class="small">8–16 eilučių, rizika maža / vidutinė / didelė. Grąža apie 96,5 %. Žaidimo pinigai, ne tikri.</p><div id="pkBoard" class="pk-board" aria-hidden="true"></div><div id="pkBins" class="pk-bins"></div><div class="row wrap"><input id="pkBet" inputmode="decimal" placeholder="Statymas, €" /><input id="pkRows" inputmode="numeric" value="12" aria-label="Eilutės" /><button class="btn" id="pkRisk" type="button" data-risk="med">Rizika: vidutinė</button><button class="btn primary" id="pkGo" type="button">Mesti</button></div></div>',
      coinflip: '<div class="felt dc-felt"><div class="status"><span>Moneta</span></div><p class="small">Laimėtojas gauna 1,93× statymą (96,5 %). Jei niekas neprisijungia per 30 s, žaidžia botas. Žaidimo pinigai, ne tikri.</p><div class="row wrap"><input id="cfBet" inputmode="decimal" placeholder="Statymas, €" /><button class="btn primary" id="cfGo" type="button">Sukurti</button><button class="btn" id="cfBot" type="button">Prieš botą</button></div><div id="cfList" class="meta-list"></div></div>',
      kovos: '<div class="felt dc-felt"><div class="status"><span>Dėžių kovos</span></div><p class="small">1v1, 1v1v1 arba 2v2. Dėžės atsidaro vienu metu, didžiausia vertė pasiima visus skinus. Tuščias vietas užpildo botai, kai pradedi. Žaidimo pinigai, ne tikri.</p><div class="row wrap" id="btModes"><button class="btn on" data-mode="1v1" type="button">1v1</button><button class="btn" data-mode="1v1v1" type="button">1v1v1</button><button class="btn" data-mode="2v2" type="button">2v2</button></div><button class="btn primary" id="btGo" type="button">Kurti Smėlio kovą</button><div id="btList" class="meta-list"></div></div>',
    };
    function fill(id, html) {
      const el = $(id);
      if (el && !el.dataset.ready) {
        el.innerHTML = html;
        el.dataset.ready = '1';
      }
    }
    fill('g-crash', panels.crash);
    fill('g-mines', panels.mines);
    fill('g-plinko', panels.plinko);
    fill('g-coinflip', panels.coinflip);
    fill('g-kovos', panels.kovos);
    const home = $('lobbyHome');
    if (home && !home.dataset.ready) {
      home.dataset.ready = '1';
      home.innerHTML = '<div class="lobby"><button class="lobby-card" type="button" data-goto="home"><b>Žaidimai</b><span>Blackjack, Crash, Mines, Plinko</span></button><button class="lobby-card" type="button" data-goto="kovos"><b>Kovos</b><span>Dėžės prieš draugus</span></button><button class="lobby-card" type="button" id="openMissions"><b>Misijos</b><span>Dienos ir savaitės, VIP</span></button><button class="lobby-card" type="button" data-goto-sec="up"><b>Upgrader</b><span>Dėžės ir skinų ratas</span></button></div><div class="panel" id="lobbyToursWrap"><div class="panel-h">Turnyrai</div><p class="small">Žaidimo pinigų fondas iš namų. Laimėtojai gauna dalį automatiškai.</p><div id="lobbyTours" class="meta-list"><div class="small">Kraunama…</div></div></div>';
      home.onclick = (e) => {
        const go = e.target.closest('[data-goto]');
        if (go) setGameTab(go.dataset.goto);
        const sec = e.target.closest('[data-goto-sec]');
        if (sec && K.setSection) K.setSection(sec.dataset.gotoSec);
        if (e.target.closest('#openMissions') && openProfile) openProfile();
      };
    }
    function eur(id) {
      const v = String($(id).value || '').replace(/\s/g, '').replace(',', '.');
      if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
      return Math.round(parseFloat(v) * 100);
    }
    function multTxt(cents) {
      return (Number(cents) / 100).toFixed(2).replace('.', ',') + '×';
    }
    if ($('crGo')) $('crGo').onclick = () => {
      const amount = eur('crBet');
      const autoE = eur('crAuto');
      send('crash:bet', { amount, auto: autoE ? autoE : 0 }).then((r) => {
        if (r.ok) toast('Crash statymas priimtas', true);
      });
    };
    if ($('crOut')) $('crOut').onclick = () => send('crash:cashout', {}).then((r) => {
      if (r.ok) toast('Išėjai ' + multTxt(r.at || 0), true);
    });
    function drawMines(open, boom, spots) {
      const g = $('mnGrid');
      if (!g) return;
      open = open || [];
      let html = '';
      for (let i = 0; i < 25; i++) {
        const on = open.indexOf(i) !== -1;
        const mine = spots && spots.indexOf(i) !== -1;
        html += '<button type="button" class="mine' + (on ? ' open' : '') + (mine ? ' boom' : '') + '" data-cell="' + i + '" aria-label="Langelis ' + (i + 1) + '">' + (mine ? '×' : on ? '•' : '') + '</button>';
      }
      g.innerHTML = html;
    }
    drawMines([], false, null);
    if ($('mnGo')) $('mnGo').onclick = () => {
      const bet = eur('mnBet');
      const mines = Number($('mnCount').value);
      send('mines:start', { bet, mines }).then((r) => {
        if (!r.ok) return;
        if ($('mnMult')) $('mnMult').textContent = '1,00×';
        drawMines(r.open || [], false, null);
      });
    };
    if ($('mnOut')) $('mnOut').onclick = () => {
      send('mines:cashout', {}).then((r) => {
        if (r.ok) {
          toast('Pasiėmei ' + fmt(r.pay), true);
          drawMines([], false, r.spots || null);
        }
      });
    };
    if ($('mnGrid')) $('mnGrid').onclick = (e) => {
      const b = e.target.closest('[data-cell]');
      if (!b || b.classList.contains('open')) return;
      send('mines:click', Number(b.dataset.cell)).then((r) => {
        if (!r.ok) return;
        if (r.boom) {
          drawMines([], true, r.spots);
          toast('Mina');
        } else {
          if ($('mnMult')) $('mnMult').textContent = String(r.mult).replace('.', ',') + '×';
          drawMines(r.open, false, null);
        }
      });
    };
    let risk = 'med';
    if ($('pkRisk')) $('pkRisk').onclick = () => {
      risk = risk === 'low' ? 'med' : risk === 'med' ? 'high' : 'low';
      $('pkRisk').textContent = 'Rizika: ' + (risk === 'low' ? 'maža' : risk === 'high' ? 'didelė' : 'vidutinė');
    };
    function paintPlinko(mults, bin) {
      const bins = $('pkBins');
      const board = $('pkBoard');
      if (board) {
        const rows = Math.max(8, (mults && mults.length ? mults.length - 1 : 12));
        let dots = '';
        for (let r = 0; r < Math.min(rows, 10); r++) {
          for (let c = 0; c <= r + 2; c++) dots += '<i style="grid-column:' + (c + 1) + '"></i>';
        }
        board.innerHTML = dots;
      }
      if (!bins || !mults) return;
      bins.innerHTML = mults.map((m, i) => '<span class="' + (i === bin ? 'on' : '') + '">×' + String(m).replace('.', ',') + '</span>').join('');
    }
    paintPlinko(null, -1);
    if ($('pkGo')) $('pkGo').onclick = () => {
      const bet = eur('pkBet');
      const rows = Number($('pkRows').value);
      send('plinko:drop', { bet, rows, risk }).then((r) => {
        if (!r.ok) return;
        $('pkMsg').textContent = '×' + String(r.mult).replace('.', ',') + ' · ' + fmt(r.pay);
        paintPlinko(r.mults, r.bin);
        if (r.pay > bet) toast('Plinko ' + fmt(r.pay), true);
      });
    };
    function makeFlip(bot) {
      const amount = eur('cfBet');
      send('coinflip:create', { amount, bot: bot }).then((r) => {
        if (r.ok) toast(bot ? 'Metama prieš botą' : 'Laukiama varžovo', true);
      });
    }
    if ($('cfGo')) $('cfGo').onclick = () => makeFlip(false);
    if ($('cfBot')) $('cfBot').onclick = () => makeFlip(true);
    let mode = '1v1';
    if ($('g-kovos')) $('g-kovos').onclick = (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      mode = b.dataset.mode;
      qsa('#btModes .btn').forEach((x) => x.classList.toggle('on', x === b));
    };
    if ($('btGo')) $('btGo').onclick = () => {
      send('battle:create', { mode, cases: ['smelis'], rounds: 1 }).then((r) => {
        if (r.ok) toast('Kova sukurta. Palauk draugo arba pradėk su botais.', true);
      });
    };
    function tourScore(t, score) {
      if (t.id === 'crash' || t.id === 'crash-w') return (Number(score) / 100).toFixed(2).replace('.', ',') + '×';
      if (t.id === 'wager') return fmt(score);
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
      return (list || []).map((x) => {
        const top = (x.top || []).slice(0, 3).map((p, i) => (i + 1) + '. ' + esc(p.name) + ' ' + tourScore(x, p.score)).join(' · ');
        return '<div class="ev"><div><b>' + esc(x.name) + '</b><span class="small">liko ' + leftTxt(x.endsAt) + (top ? ' · ' + top : '') + '</span></div><span>fondas ' + fmt(x.pool) + '</span></div>';
      }).join('');
    }
    function renderArcade(st) {
      const c = st && st.arcade && st.arcade.crash;
      if (c && $('crMult')) {
        $('crPhase').textContent = c.phase === 'running' ? 'Kyla' : c.phase === 'crashed' ? 'Nukrito' : 'Statymai';
        const shown = c.phase === 'crashed' && c.crashAt ? c.crashAt : c.mult;
        $('crMult').textContent = multTxt(shown);
        const h = Math.max(8, Math.min(100, Math.log(Math.max(100, shown) / 100) * 42 + 12));
        if ($('crFill')) $('crFill').style.height = h + '%';
        if ($('crRocket')) $('crRocket').style.transform = 'translateY(' + (100 - h) + '%)';
        $('crHist').textContent = (c.history || []).map((n) => multTxt(n)).join('  ');
        if ($('crBets')) {
          $('crBets').innerHTML = (c.bets || []).map((b) => '<div class="ev"><span>' + esc(b.name) + '</span><span>' + (b.cashed ? 'išejo ' + multTxt(b.at) : fmt(b.amount)) + '</span></div>').join('');
        }
      }
      if (st && st.arcade && $('cfList')) {
        $('cfList').innerHTML = (st.arcade.flips || []).map((f) => '<div class="ev"><span>' + esc(f.name) + ' · ' + fmt(f.amount) + '</span><span>' + esc(f.status === 'open' ? 'laukia' : f.winner || '') + '</span>' + (f.status === 'open' ? '<button type="button" class="btn small" data-join="' + f.id + '">Prisijungti</button>' : '') + '</div>').join('');
      }
      if (st && st.arcade && $('btList')) {
        $('btList').innerHTML = (st.arcade.battles || []).map((b) => {
          const seats = (b.seats || []).map((s) => esc(s.name) + (s.total ? ' ' + fmt(s.total) : '')).join(', ');
          const skinName = (id) => { const s = K.skinById && K.skinById(id); return esc(s ? s.name : id); };
          const skins = (b.seats || []).map((s) => (s.skins || []).map(skinName).join(', ')).filter(Boolean).join(' · ');
          return '<div class="ev battle' + (b.status === 'done' ? ' done' : '') + '"><div><b>' + esc(b.mode) + ' · ' + esc(b.status === 'open' ? 'laukia' : 'baigta') + '</b><span class="small">' + seats + (b.winner ? ' · laimėjo ' + esc(b.winner) : '') + (skins ? '<br>' + skins : '') + '</span></div>' + (b.status === 'open' ? '<span class="row"><button type="button" class="btn small" data-bjoin="' + b.id + '">Jungtis</button><button type="button" class="btn small" data-bstart="' + b.id + '">Pradėti</button></span>' : '') + '</div>';
        }).join('');
      }
    }
    if ($('cfList')) $('cfList').onclick = (e) => {
      const b = e.target.closest('[data-join]');
      if (b) send('coinflip:join', Number(b.dataset.join));
    };
    if ($('btList')) $('btList').onclick = (e) => {
      const join = e.target.closest('[data-bjoin]');
      if (join) send('battle:join', Number(join.dataset.bjoin));
      const start = e.target.closest('[data-bstart]');
      if (start) send('battle:start', Number(start.dataset.bstart)).then((r) => {
        if (r.ok) toast('Kova baigta: ' + r.battle.winner, true);
      });
    };
    K.socket.on('state', (st) => renderArcade(st));
    function missionRow(x) {
      const pct = x.goal ? Math.min(100, Math.round((x.progress / x.goal) * 100)) : 0;
      const label = x.kind === 'wager' || x.id === 'w-wager' ? fmt(Math.min(x.progress, x.goal)) + ' / ' + fmt(x.goal) : x.progress + ' / ' + x.goal;
      return '<div class="mission"><div class="ev"><span>' + esc(x.title) + '</span><span>' + label + '</span></div><div class="lvl-bar"><div style="width:' + pct + '%"></div></div>' + (x.progress >= x.goal && !x.claimed ? '<button type="button" class="btn small" data-claim="' + x.id + '">Atsiimti ' + fmt(x.reward) + '</button>' : x.claimed ? '<span class="small">Atsiimta</span>' : '') + '</div>';
    }
    async function refreshMeta() {
      const m = await send('mission:list', {}, true);
      const box = $('missionBox');
      if (m.ok && box) {
        box.innerHTML = '<div class="panel-h">Misijos</div><p class="small">Atsinaujina vidurnaktį Europe/Vilnius. Atlygis – žaidimo pinigai.</p>' + m.missions.map(missionRow).join('');
        box.onclick = (e) => {
          const b = e.target.closest('[data-claim]');
          if (b) send('mission:claim', b.dataset.claim).then((r) => {
            if (r.ok) {
              toast('Misija: ' + fmt(r.reward), true);
              refreshMeta();
            }
          });
        };
      }
      const v = await send('vip:get', {}, true);
      const vip = $('vipBox');
      if (v.ok && vip) {
        const pct = v.need ? Math.min(100, Math.round((v.into / v.need) * 100)) : 100;
        vip.innerHTML = '<div class="panel-h">VIP · ' + esc(v.name) + '</div><p class="small">' + esc(v.perks) + (v.next ? ' · iki ' + esc(v.next) + '' : '') + '</p><div class="lvl-bar"><div style="width:' + pct + '%"></div></div><div class="row wrap"><button class="btn" id="vipRake" type="button">Grąža ' + fmt(v.rake) + '</button><button class="btn" id="vipCase" type="button">VIP dėžė</button></div>';
        const rake = $('vipRake');
        const cse = $('vipCase');
        if (rake) rake.onclick = () => send('vip:rake', {}).then((r) => r.ok && toast('Grąža ' + fmt(r.amount), true));
        if (cse) cse.onclick = () => send('vip:case', {}).then((r) => {
          if (!r.ok) return;
          const skin = K.skinById ? K.skinById(r.skinId) : null;
          toast('VIP dėžė: ' + (skin ? skin.name : r.caseId), true);
        });
      }
      const t = await send('tour:list', {}, true);
      tourCache = t.ok ? t.tournaments : [];
      const html = tourHtml(tourCache);
      const tour = $('tourBox');
      const lobbyT = $('lobbyTours');
      if (tour) tour.innerHTML = '<div class="panel-h">Turnyrai</div><div class="meta-list">' + html + '</div>';
      if (lobbyT) lobbyT.innerHTML = html || '<div class="small">Turnyrų nėra</div>';
    }
    setInterval(() => {
      if (!tourCache.length) return;
      const html = tourHtml(tourCache);
      const tour = $('tourBox');
      const lobbyT = $('lobbyTours');
      if (lobbyT) lobbyT.innerHTML = html;
      if (tour && tour.querySelector('.panel-h')) tour.innerHTML = '<div class="panel-h">Turnyrai</div><div class="meta-list">' + html + '</div>';
    }, 30000);
    K.socket.on('connect', refreshMeta);
    if (typeof renderProfile === 'function') {
      const orig = renderProfile;
      renderProfile = function () {
        orig();
        refreshMeta();
      };
    }
    setInterval(refreshMeta, 15000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
