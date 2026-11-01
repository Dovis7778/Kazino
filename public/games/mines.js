'use strict';
window.KZGames = window.KZGames || {};
window.KZGames.mines = function (K) {
  const el = K.$('g-mines');
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = '<div class="felt dc-felt"><div class="status"><span>Mines</span><b id="mnMult">1,00×</b></div><p class="small">5×5. Daugiklis 96,5 % / tikimybė. Žaidimo pinigai, ne tikri.</p><div class="betrow"><button type="button" id="mnMinus">−</button><input id="mnBet" inputmode="decimal" placeholder="Statymas, €" /><button type="button" id="mnPlus">+</button><button type="button" id="mnHalf">½</button><button type="button" id="mnDouble">×2</button><button type="button" id="mnMax">Max</button></div><div class="row wrap"><input id="mnCount" inputmode="numeric" value="3" aria-label="Minos" /><button class="btn primary" id="mnGo" type="button">Pradėti</button><button class="btn" id="mnOut" type="button">Pasiimti</button></div><div id="mnGrid" class="mine-grid"></div></div>';
  function eur(id) {
    const v = String(K.$(id).value || '').replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
    return Math.round(parseFloat(v) * 100);
  }
  function setBet(cents) {
    const v = Math.max(100, Math.min(K.getBal() || cents, cents));
    K.$('mnBet').value = (v / 100).toFixed(2).replace('.', ',');
    K.storeSet('kazino:bet:mines', String(v));
  }
  const saved = Number(K.storeGet('kazino:bet:mines'));
  if (saved) setBet(saved);
  K.$('mnMinus').onclick = () => setBet((eur('mnBet') || 100) - 100);
  K.$('mnPlus').onclick = () => setBet((eur('mnBet') || 100) + 100);
  K.$('mnHalf').onclick = () => setBet(Math.floor((eur('mnBet') || 100) / 2));
  K.$('mnDouble').onclick = () => setBet((eur('mnBet') || 100) * 2);
  K.$('mnMax').onclick = () => setBet(K.getBal());
  function draw(open, spots) {
    const g = K.$('mnGrid');
    let html = '';
    for (let i = 0; i < 25; i++) {
      const on = open && open.indexOf(i) !== -1;
      const mine = spots && spots.indexOf(i) !== -1;
      html += '<button type="button" class="mine' + (on ? ' open' : '') + (mine ? ' boom' : '') + '" data-cell="' + i + '">' + (mine ? '×' : on ? '•' : '') + '</button>';
    }
    g.innerHTML = html;
  }
  draw([], null);
  K.$('mnGo').onclick = () => {
    K.send('mines:start', { bet: eur('mnBet'), mines: Number(K.$('mnCount').value) }).then((r) => {
      if (!r.ok) return;
      K.$('mnMult').textContent = '1,00×';
      draw(r.open || [], null);
      K.blip(520, 0.06, 'square');
    });
  };
  K.$('mnOut').onclick = () => K.send('mines:cashout', {}).then((r) => {
    if (!r.ok) return;
    K.toast('Pasiėmei ' + K.fmt(r.pay), true);
    K.celebrate();
    draw([], r.spots || null);
  });
  K.$('mnGrid').onclick = (e) => {
    const b = e.target.closest('[data-cell]');
    if (!b || b.classList.contains('open')) return;
    K.send('mines:click', Number(b.dataset.cell)).then((r) => {
      if (!r.ok) return;
      if (r.boom) { draw([], r.spots); K.toast('Mina'); K.blip(110, 0.2, 'sawtooth'); }
      else { K.$('mnMult').textContent = String(r.mult).replace('.', ',') + '×'; draw(r.open, null); K.blip(680, 0.05, 'triangle'); }
    });
  };
};
