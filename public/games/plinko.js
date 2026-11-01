'use strict';
window.KZGames = window.KZGames || {};
window.KZGames.plinko = function (K) {
  const el = K.$('g-plinko');
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = '<div class="felt dc-felt"><div class="status"><span>Plinko</span><b id="pkMsg">—</b></div><p class="small">8–16 eilučių. Grąža apie 96,5 %. Žaidimo pinigai, ne tikri.</p><div id="pkBoard" class="pk-board"></div><div id="pkBins" class="pk-bins"></div><div class="betrow"><button type="button" id="pkMinus">−</button><input id="pkBet" inputmode="decimal" placeholder="Statymas, €" /><button type="button" id="pkPlus">+</button><button type="button" id="pkHalf">½</button><button type="button" id="pkDouble">×2</button><button type="button" id="pkMax">Max</button></div><div class="row wrap"><input id="pkRows" inputmode="numeric" value="12" aria-label="Eilutės" /><button class="btn" id="pkRisk" type="button">Rizika: vidutinė</button><button class="btn primary" id="pkGo" type="button">Mesti</button></div></div>';
  let risk = 'med';
  function eur(id) {
    const v = String(K.$(id).value || '').replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
    return Math.round(parseFloat(v) * 100);
  }
  function setBet(cents) {
    const v = Math.max(100, Math.min(K.getBal() || cents, cents));
    K.$('pkBet').value = (v / 100).toFixed(2).replace('.', ',');
    K.storeSet('kazino:bet:plinko', String(v));
  }
  const saved = Number(K.storeGet('kazino:bet:plinko'));
  if (saved) setBet(saved);
  K.$('pkMinus').onclick = () => setBet((eur('pkBet') || 100) - 100);
  K.$('pkPlus').onclick = () => setBet((eur('pkBet') || 100) + 100);
  K.$('pkHalf').onclick = () => setBet(Math.floor((eur('pkBet') || 100) / 2));
  K.$('pkDouble').onclick = () => setBet((eur('pkBet') || 100) * 2);
  K.$('pkMax').onclick = () => setBet(K.getBal());
  K.$('pkRisk').onclick = () => {
    risk = risk === 'low' ? 'med' : risk === 'med' ? 'high' : 'low';
    K.$('pkRisk').textContent = 'Rizika: ' + (risk === 'low' ? 'maža' : risk === 'high' ? 'didelė' : 'vidutinė');
  };
  K.$('pkGo').onclick = () => {
    const bet = eur('pkBet');
    K.send('plinko:drop', { bet, rows: Number(K.$('pkRows').value), risk }).then((r) => {
      if (!r.ok) return;
      K.$('pkMsg').textContent = '×' + String(r.mult).replace('.', ',') + ' · ' + K.fmt(r.pay);
      K.$('pkBins').innerHTML = (r.mults || []).map((m, i) => '<span class="' + (i === r.bin ? 'on' : '') + '">×' + String(m).replace('.', ',') + '</span>').join('');
      const rows = r.path.length;
      let dots = '';
      for (let i = 0; i < rows; i++) dots += '<i class="' + (r.path[i] === 'R' ? 'right' : '') + '"></i>';
      K.$('pkBoard').innerHTML = dots;
      if (r.pay > bet) { K.toast('Plinko ' + K.fmt(r.pay), true); K.celebrate(); }
      else K.blip(220, 0.08, 'sine');
    });
  };
};
