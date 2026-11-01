'use strict';
window.KZGames = window.KZGames || {};
window.KZGames.crash = function (K) {
  const el = K.$('g-crash');
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = '<div class="felt dc-felt"><div class="status"><span id="crPhase">Statymai</span><b id="crMult">1,00×</b></div><div class="crash-count" id="crCount"><div id="crCountBar"></div></div><canvas id="crCanvas" class="crash-canvas" width="720" height="420"></canvas><p class="small">Bendra kreivė visiems. Grąža apie 96,5 %. Žaidimo pinigai, ne tikri.</p><div id="crBets" class="meta-list"></div><div class="betrow"><button type="button" id="crMinus">−</button><input id="crBet" inputmode="decimal" placeholder="Statymas, €" /><button type="button" id="crPlus">+</button><button type="button" id="crHalf">½</button><button type="button" id="crDouble">×2</button><button type="button" id="crMax">Max</button></div><div class="row wrap"><input id="crAuto" inputmode="decimal" placeholder="Auto ×" /><button class="btn primary" id="crGo" type="button">Statyti</button><button class="btn" id="crOut" type="button">Išeiti</button></div><div id="crHist" class="hist chips"></div></div>';
  const canvas = K.$('crCanvas');
  const ctx = canvas.getContext('2d');
  let view = null;
  let clock = 0;
  let boom = [];
  let prevPhase = '';
  function eur(id) {
    const v = String(K.$(id).value || '').replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
    return Math.round(parseFloat(v) * 100);
  }
  function setBet(cents) {
    const max = K.getBal();
    const v = Math.max(100, Math.min(max || cents, cents));
    K.$('crBet').value = (v / 100).toFixed(2).replace('.', ',');
    K.storeSet('kazino:bet:crash', String(v));
  }
  const saved = Number(K.storeGet('kazino:bet:crash'));
  if (saved) setBet(saved);
  K.$('crMinus').onclick = () => setBet((eur('crBet') || 100) - 100);
  K.$('crPlus').onclick = () => setBet((eur('crBet') || 100) + 100);
  K.$('crHalf').onclick = () => setBet(Math.floor((eur('crBet') || 100) / 2));
  K.$('crDouble').onclick = () => setBet((eur('crBet') || 100) * 2);
  K.$('crMax').onclick = () => setBet(K.getBal());
  K.$('crGo').onclick = () => {
    const amount = eur('crBet');
    const autoE = eur('crAuto');
    K.send('crash:bet', { amount, auto: autoE || 0 }).then((r) => { if (r.ok) { K.toast('Crash statymas priimtas', true); K.blip(440, 0.08, 'square'); } });
  };
  K.$('crOut').onclick = () => K.send('crash:cashout', {}).then((r) => { if (r.ok) { K.toast('Išėjai @ ' + (r.at / 100).toFixed(2).replace('.', ',') + '×', true); K.celebrate(); } });
  function multTxt(c) { return (Number(c) / 100).toFixed(2).replace('.', ',') + '×'; }
  function chipColor(c) { const x = c / 100; return x < 1.5 ? '#8d97a3' : x < 2 ? '#5e98d9' : x < 10 ? '#f0c14b' : '#d32ce6'; }
  function draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 220;
    if (canvas.width !== Math.floor(w * dpr)) { canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#120e12';
    ctx.fillRect(0, 0, w, h);
    const c = view;
    const now = Date.now() + clock;
    const growth = (c && c.growth) || Math.log(1.055) / 90;
    const elapsed = c && c.phase === 'running' ? Math.max(0, now - c.started) : c && c.phase === 'crashed' ? Math.log((c.crashAt || 100) / 100) / growth : 0;
    const live = c && c.phase === 'running' ? Math.max(100, Math.floor(100 * Math.exp(growth * elapsed))) : c ? (c.phase === 'crashed' ? c.crashAt : 100) : 100;
    const maxM = Math.max(200, live * 1.25);
    const maxT = Math.log(maxM / 100) / growth;
    function xy(mult) {
      const t = Math.log(Math.max(100, mult) / 100) / growth;
      return { x: 28 + (t / maxT) * (w - 46), y: h - 22 - (Math.log(mult / 100) / Math.log(maxM / 100)) * (h - 46) };
    }
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(28, 12); ctx.lineTo(28, h - 22); ctx.lineTo(w - 12, h - 22); ctx.stroke();
    ctx.fillStyle = '#8d8070';
    ctx.font = '11px sans-serif';
    ctx.fillText('1×', 4, h - 16);
    ctx.fillText((maxM / 100).toFixed(1) + '×', 2, 18);
    if (c && (c.phase === 'running' || c.phase === 'crashed')) {
      ctx.beginPath();
      ctx.strokeStyle = c.phase === 'crashed' ? '#ff5d6c' : '#f0c14b';
      ctx.lineWidth = 3;
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const m = 100 * Math.pow(Math.min(live, maxM) / 100, i / steps);
        const p = xy(Math.min(m, live));
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      const tip = xy(Math.min(live, maxM));
      ctx.save();
      ctx.translate(tip.x, tip.y);
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(7, 6); ctx.lineTo(-7, 6); ctx.closePath();
      ctx.fill();
      ctx.restore();
      (c.bets || []).forEach((b) => {
        if (!b.cashed) return;
        const p = xy(b.at);
        ctx.fillStyle = '#3ddc84';
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        ctx.fillText(b.name, p.x + 6, p.y);
      });
    }
    boom.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.02;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 4);
      ctx.globalAlpha = 1;
    });
    boom = boom.filter((p) => p.life > 0);
    if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  K.socket.on('state', (st) => {
    const c = st && st.arcade && st.arcade.crash;
    if (!c) return;
    if (c.serverNow) clock = c.serverNow - Date.now();
    if (prevPhase !== 'crashed' && c.phase === 'crashed') {
      K.blip(90, 0.25, 'sawtooth');
      canvas.classList.add('flash');
      setTimeout(() => canvas.classList.remove('flash'), 400);
      for (let i = 0; i < 18; i++) boom.push({ x: canvas.clientWidth * 0.7, y: 40, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.2) * 6, life: 1, color: i % 2 ? '#ff5d6c' : '#ffe27a' });
    }
    prevPhase = c.phase;
    view = c;
    const shown = c.phase === 'crashed' && c.crashAt ? c.crashAt : c.phase === 'running' ? Math.max(c.mult, 100) : 100;
    K.$('crPhase').textContent = c.phase === 'running' ? 'Kyla' : c.phase === 'crashed' ? 'Nukrito' : 'Statymai';
    K.$('crMult').textContent = multTxt(c.phase === 'running' ? shown : (c.phase === 'crashed' ? c.crashAt : 100));
    const left = c.phase === 'betting' ? Math.max(0, c.betEnds - (Date.now() + clock)) : 0;
    const span = Math.max(1, (c.betEnds || 0) - ((c.betEnds || 0) - 7000));
    K.$('crCountBar').style.width = c.phase === 'betting' ? Math.max(4, Math.min(100, (left / 7000) * 100)) + '%' : '0%';
    K.$('crBets').innerHTML = (c.bets || []).map((b) => '<div class="ev"><span>' + K.esc(b.name) + ' · ' + K.fmt(b.amount) + '</span><span>' + (b.cashed ? 'Išėjo @ ' + multTxt(b.at) : 'žaidi') + '</span></div>').join('') || '<div class="small">Šiame raunde dar niekas nestatė.</div>';
    K.$('crHist').innerHTML = (c.history || []).map((n) => '<span class="hchip" style="background:' + chipColor(n) + '">' + multTxt(n) + '</span>').join('');
  });
};
