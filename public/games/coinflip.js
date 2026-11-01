'use strict';
window.KZGames = window.KZGames || {};
window.KZGames.coinflip = function (K) {
  const el = K.$('g-coinflip');
  if (!el || el.dataset.ready) return;
  el.dataset.ready = '1';
  el.innerHTML = '<div class="felt dc-felt"><div class="status"><span>Moneta</span></div><div class="coin" id="cfCoin"><div class="coin-face">K</div></div><p class="small">Laimėtojas gauna 96,5 % bendros vertės. Skinai arba balansas, varžovas ±5 %. Po 30 s stoja botas. Žaidimo pinigai, ne tikri.</p><div class="betrow"><button type="button" id="cfMinus">−</button><input id="cfBet" inputmode="decimal" placeholder="Balansas, €" /><button type="button" id="cfPlus">+</button><button type="button" id="cfHalf">½</button><button type="button" id="cfDouble">×2</button><button type="button" id="cfMax">Max</button></div><div id="cfSkins" class="mini-skins"></div><div class="row wrap"><button class="btn primary" id="cfGo" type="button">Sukurti</button><button class="btn" id="cfBot" type="button">Prieš botą</button></div><div id="cfList" class="meta-list"></div></div>';
  const picked = {};
  function eur() {
    const v = String(K.$('cfBet').value || '').replace(/\s/g, '').replace(',', '.');
    if (!v) return 0;
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
    return Math.round(parseFloat(v) * 100);
  }
  function setBet(cents) {
    const v = Math.max(0, Math.min(K.getBal() || cents, cents));
    K.$('cfBet').value = v ? (v / 100).toFixed(2).replace('.', ',') : '';
  }
  K.$('cfMinus').onclick = () => setBet((eur() || 0) - 100);
  K.$('cfPlus').onclick = () => setBet((eur() || 0) + 100);
  K.$('cfHalf').onclick = () => setBet(Math.floor((eur() || 0) / 2));
  K.$('cfDouble').onclick = () => setBet((eur() || 0) * 2);
  K.$('cfMax').onclick = () => setBet(K.getBal());
  function paintSkins() {
    const inv = K.getInv() || [];
    K.$('cfSkins').innerHTML = inv.slice(0, 12).map((it) => {
      const s = K.skinById(it.skinId);
      return '<button type="button" class="mini' + (picked[it.id] ? ' on' : '') + '" data-skin="' + it.id + '">' + K.esc(s ? s.name : it.skinId) + '<b>' + K.fmt(it.value || (s ? s.value : 0)) + '</b></button>';
    }).join('') || '<p class="small">Skinų inventoriuje nėra – gali statyti tik balansą.</p>';
  }
  paintSkins();
  K.$('cfSkins').onclick = (e) => {
    const b = e.target.closest('[data-skin]');
    if (!b) return;
    const id = Number(b.dataset.skin);
    picked[id] = !picked[id];
    paintSkins();
  };
  function ids() { return Object.keys(picked).filter((k) => picked[k]).map(Number); }
  function make(bot) {
    const amount = eur();
    if (amount == null) return;
    K.send('coinflip:create', { amount, items: ids(), bot }).then((r) => {
      if (!r.ok) return;
      K.$('cfCoin').classList.add('flip');
      setTimeout(() => K.$('cfCoin').classList.remove('flip'), 900);
      K.toast(bot ? 'Metama prieš botą' : 'Laukiama varžovo', true);
      Object.keys(picked).forEach((k) => delete picked[k]);
      paintSkins();
    });
  }
  K.$('cfGo').onclick = () => make(false);
  K.$('cfBot').onclick = () => make(true);
  K.socket.on('state', (st) => {
    paintSkins();
    if (!st || !st.arcade || !K.$('cfList')) return;
    K.$('cfList').innerHTML = (st.arcade.flips || []).map((f) => '<div class="ev"><div><b>' + K.esc(f.name) + '</b><span class="small">' + K.fmt(f.amount) + (f.items && f.items.length ? ' · ' + f.items.map((i) => K.esc((K.skinById(i.skinId) || {}).name || i.skinId)).join(', ') : '') + '</span></div><span>' + K.esc(f.status === 'open' ? 'laukia' : f.winner || '') + '</span>' + (f.status === 'open' ? '<button type="button" class="btn small" data-join="' + f.id + '">Prisijungti</button>' : '') + '</div>').join('');
  });
  K.$('cfList').onclick = (e) => {
    const b = e.target.closest('[data-join]');
    if (!b) return;
    const amount = eur() || 0;
    K.send('coinflip:join', { id: Number(b.dataset.join), amount, items: ids() }).then((r) => {
      if (!r.ok) return;
      K.$('cfCoin').classList.add('flip');
      if (r.flip && r.flip.winner) K.toast('Laimėjo ' + r.flip.winner, r.flip.winner !== 'Botas');
    });
  };
};
