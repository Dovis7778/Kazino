'use strict';
window.KZGames = window.KZGames || {};
window.KZGames.kovos = function (K) {
  const el = K.$('g-kovos');
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  const cfg = K.getCfg();
  const cases = (cfg && cfg.skins && cfg.skins.cases) || [];
  el.innerHTML = '<div class="felt dc-felt"><div class="status"><span>Dėžių kovos</span></div><p class="small">1v1, 1v1v1 arba 2v2. Dėžės sukasi vienu metu. Didžiausia vertė pasiima visus skinus. Žaidimo pinigai, ne tikri.</p><div class="row wrap" id="btModes"><button class="btn on" data-mode="1v1" type="button">1v1</button><button class="btn" data-mode="1v1v1" type="button">1v1v1</button><button class="btn" data-mode="2v2" type="button">2v2</button></div><div id="btCases" class="mini-skins"></div><div class="row wrap"><label class="small">Raundai <input id="btRounds" type="range" min="1" max="10" value="1" /></label><b id="btRoundN">1</b></div><p class="small" id="btCost">Kaina —</p><button class="btn primary" id="btGo" type="button">Kurti kovą</button><div id="btStage" class="bt-stage"></div><div id="btList" class="meta-list"></div></div>';
  let mode = '1v1';
  const picked = {};
  if (cases[0]) picked[cases[0].id] = true;
  function chosen() { return Object.keys(picked).filter((id) => picked[id]); }
  function cost() {
    const rounds = Number(K.$('btRounds').value) || 1;
    const sum = chosen().reduce((s, id) => s + ((cases.find((c) => c.id === id) || {}).price || 0), 0);
    return sum * rounds;
  }
  function paint() {
    K.$('btCases').innerHTML = cases.map((c) => '<button type="button" class="mini' + (picked[c.id] ? ' on' : '') + '" data-case="' + c.id + '">' + K.esc(c.name) + '<b>' + K.fmt(c.price) + '</b></button>').join('');
    K.$('btRoundN').textContent = K.$('btRounds').value;
    K.$('btCost').textContent = 'Viso ' + K.fmt(cost()) + ' žaidimo pinigų';
  }
  paint();
  K.$('btCases').onclick = (e) => {
    const b = e.target.closest('[data-case]');
    if (!b) return;
    picked[b.dataset.case] = !picked[b.dataset.case];
    paint();
  };
  K.$('btRounds').oninput = paint;
  el.querySelector('#btModes').onclick = (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    mode = b.dataset.mode;
    K.qsa('#btModes .btn').forEach((x) => x.classList.toggle('on', x === b));
  };
  K.$('btGo').onclick = () => {
    const rounds = Number(K.$('btRounds').value) || 1;
    const list = chosen();
    if (!list.length) return K.toast('Pasirink bent vieną dėžę');
    K.send('battle:create', { mode, cases: list, rounds }).then((r) => { if (r.ok) K.toast('Kova sukurta. Palauk draugo arba pradėk.', true); });
  };
  const played = {};
  function card(drop) {
    const s = K.skinById(drop.skinId);
    const color = s && K.rarityOf(s.rarity) ? K.rarityOf(s.rarity).color : '#f0c14b';
    return '<div class="reel-card" style="--r:' + color + '">' + (s ? K.weaponSvg(s.weapon, color, s.id) : '') + '<b>' + K.esc(s ? s.name : drop.skinId) + '</b><span>' + K.fmt(drop.value) + '</span></div>';
  }
  function play(b) {
    if (!b.opens || played[b.id]) return;
    played[b.id] = 1;
    const stage = K.$('btStage');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let step = 0;
    const seats = {};
    b.seats.forEach((s) => { seats[s.name] = 0; });
    function frame() {
      if (step >= b.opens.length) {
        stage.innerHTML = '<div class="bt-win">Laimėjo ' + K.esc(b.winner || '') + '</div>' + b.seats.map((s) => '<div class="ev"><b>' + K.esc(s.name) + '</b><span>' + K.fmt(s.total) + '</span></div>').join('');
        if (K.celebrate) K.celebrate();
        return;
      }
      const open = b.opens[step];
      open.results.forEach((r) => { seats[r.name] = (seats[r.name] || 0) + r.value; });
      stage.innerHTML = '<div class="small">Raundas ' + open.round + ' · ' + K.esc(open.caseId) + '</div>' + open.results.map((r) => {
        const strip = [card(r), card(r), card(r)];
        return '<div class="seat-col"><b>' + K.esc(r.name) + '</b><div class="reel-window"><div class="reel-strip' + (reduce ? '' : ' spin') + '">' + strip.join('') + '</div></div><span>' + K.fmt(seats[r.name]) + '</span></div>';
      }).join('');
      step += 1;
      if (!reduce) setTimeout(frame, 700);
      else frame();
    }
    frame();
  }
  K.socket.on('state', (st) => {
    if (!st || !st.arcade || !K.$('btList')) return;
    const battles = st.arcade.battles || [];
    battles.forEach((b) => { if (b.status !== 'open' && b.opens && b.opens.length) play(b); });
    K.$('btList').innerHTML = battles.map((b) => '<div class="ev"><div><b>' + K.esc(b.mode) + ' · ' + K.esc(b.status === 'open' ? 'laukia' : 'baigta') + '</b><span class="small">' + (b.seats || []).map((s) => K.esc(s.name) + ' ' + K.fmt(s.total || 0)).join(', ') + (b.winner ? ' · ' + K.esc(b.winner) : '') + '</span></div>' + (b.status === 'open' ? '<span class="row"><button type="button" class="btn small" data-bjoin="' + b.id + '">Jungtis</button><button type="button" class="btn small" data-bstart="' + b.id + '">Pradėti</button></span>' : '') + '</div>').join('');
  });
  K.$('btList').onclick = (e) => {
    const join = e.target.closest('[data-bjoin]');
    if (join) K.send('battle:join', Number(join.dataset.bjoin));
    const start = e.target.closest('[data-bstart]');
    if (start) K.send('battle:start', Number(start.dataset.bstart)).then((r) => { if (r.ok) { play(r.battle); K.toast('Kova baigta: ' + r.battle.winner, true); } });
  };
};
