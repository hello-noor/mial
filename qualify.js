/* Form guidato a passi (MEDDIC): una domanda alla volta, nessun dato lascia il browser tranne l'email che l'utente sceglie di inviare. */
(() => {
  const { Q, score, said, opts } = window.MEDDIC, el = document.getElementById('wz'), a = {}; let i = 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bar = () => `<div class="wz-top"><button class="wz-back" type="button" aria-label="Indietro" ${i ? '' : 'hidden'}>‹</button><div class="wz-prog" role="progressbar" aria-valuemin="1" aria-valuemax="${Q.length}" aria-valuenow="${i + 1}">${Q.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div><span>${i + 1}/${Q.length}</span></div>`;
  const chips = (k, o, sel, multi) => `<div class="wz-opts ${o.length > 4 || o[0].length < 3 ? 'sm' : ''}">${o.map(x => `<button type="button" class="wz-o ${[].concat(sel || []).includes(x[0]) ? 'on' : ''}" data-k="${k}" data-v="${esc(x[0])}" aria-pressed="${[].concat(sel || []).includes(x[0])}"><b>${esc(x[1])}</b>${x[2] ? `<small>${esc(x[2])}</small>` : ''}</button>`).join('')}</div>`;
  const ready = q => q.type === 'multi' ? (a[q.k] || []).length > 0 : q.type === 'group' ? q.f.every(f => a[f.k]) : true;
  function draw(dir = 1) {
    const q = Q[i]; let b = '';
    if (q.type === 'one') b = chips(q.k, q.o, a[q.k]);
    else if (q.type === 'multi') { const o = opts(q, a); if (q.by) a[q.k] = (a[q.k] || []).filter(v => o.some(x => x[0] === v)); b = chips(q.k, o, a[q.k], 1) + `<button class="btn wz-next" type="button" ${ready(q) ? '' : 'disabled'}>Avanti</button>`; }
    else if (q.type === 'ranges') { const c = a.cur ?? q.cur, t = a.cap ?? q.def; b = `<div class="wz-range"><p class="wz-l">Oggi produco</p><output id="wzc">${c}<small> ${q.unit}</small></output><input data-r="cur" type="range" min="0" max="${q.max}" value="${c}" aria-label="Produzione attuale"><p class="wz-l">Voglio arrivare a</p><output id="wzv">${t}<small> ${q.unit}</small></output><input data-r="cap" type="range" min="${q.min}" max="${q.max}" value="${t}" aria-label="Produzione desiderata"><p id="wzs" class="cap">${rs(c, t)}</p></div><button class="btn wz-next" type="button">Avanti</button>`; }
    else if (q.type === 'group') b = q.f.map(f => `<p class="wz-l">${f.l}</p>${chips(f.k, f.o, a[f.k])}`).join('') + `<button class="btn wz-next" type="button" ${ready(q) ? '' : 'disabled'}>Avanti</button>`;
    else b = `<form class="wz-form"><label>Nome e cognome<input name="name" required maxlength="80" autocomplete="name" value="${esc(a.name || '')}"></label><label>Azienda<input name="company" required maxlength="80" autocomplete="organization" value="${esc(a.company || '')}"></label><label>Email<input name="email" type="email" required maxlength="120" autocomplete="email" value="${esc(a.email || '')}"></label><label>Telefono <small>(facoltativo)</small><input name="phone" type="tel" maxlength="30" autocomplete="tel" value="${esc(a.phone || '')}"></label><label>Note <small>(facoltative)</small><textarea name="notes" rows="3" maxlength="800" placeholder="Prodotto, esigenze particolari, tempistiche, domande…">${esc(a.notes || '')}</textarea></label><button class="btn wz-send" type="submit">Invia modulo</button></form>`;
    el.innerHTML = `${bar()}<div class="wz-step" style="--d:${dir}"><h3>${q.t}</h3>${q.sub ? `<p class="cap">${q.sub}</p>` : ''}${b}</div>`;
    const first = el.querySelector('.wz-o,input'); if (first && dir) first.focus({ preventScroll: true });
  }
  const rs = (c, t) => `${c ? `Da ${c} a ${t} t/h: ${t >= c ? '+' : ''}${Math.round((t / c - 1) * 100)}%` : `Parti da zero: ${t} t/h`} · ≈ ${t * 16} t al giorno su 16 ore`;
  const go = d => { i = Math.max(0, Math.min(Q.length - 1, i + d)); draw(d); };
  el.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.classList.contains('wz-back')) return go(-1);
    if (t.classList.contains('wz-next')) { if (Q[i].type === 'ranges') { a.cur ??= Q[i].cur; a.cap ??= Q[i].def; } return go(1); }
    if (t.classList.contains('wz-o')) {
      const q = Q[i], k = t.dataset.k, v = t.dataset.v, f = q.f && q.f.find(x => x.k === k), m = q.type === 'multi';
      if (m) { const cur = a[k] || []; a[k] = cur.includes(v) ? cur.filter(x => x !== v) : cur.length < q.max ? [...cur, v] : [...cur.slice(1), v]; }
      else a[k] = v;
      if (q.type === 'one') return setTimeout(() => go(1), 220);
      draw(0); const n = el.querySelector(`[data-k="${k}"][data-v="${v}"]`); n && n.focus({ preventScroll: true });
    }
  });
  el.addEventListener('input', e => {
    const r = e.target.dataset.r; if (!r) return; a[r] = +e.target.value;
    const c = a.cur ?? 0, t = a.cap ?? 10; el.querySelector('#wzc').innerHTML = `${c}<small> t/h</small>`; el.querySelector('#wzv').innerHTML = `${t}<small> t/h</small>`; el.querySelector('#wzs').textContent = rs(c, t);
  });
  el.addEventListener('submit', e => {
    e.preventDefault(); new FormData(e.target).forEach((v, k) => a[k] = String(v).trim()); a.cap ??= Q.find(x => x.k === 'cap').def; a.cur ??= 0; a.ts = Date.now();
    try { const L = JSON.parse(localStorage.getItem('massini_leads') || '[]'); L.push(a); localStorage.setItem('massini_leads', JSON.stringify(L.slice(-30))); } catch (_) {}
    done();
  });
  function done() {
    const r = score(a), s = said(a), T = window.MEDDIC.txt;
    const body = `Nome: ${a.name}\nAzienda: ${a.company}\nEmail: ${a.email}\nTelefono: ${a.phone || '-'}\n\nInteresse: ${T('scope', a.scope)}\nMacchine: ${T('prod', a.prod || [])}\nProdotto lavorato: ${T('mat', a.mat || [])}\nProduzione (attuale → desiderata): ${s.M}\nProblema: ${s.I}\nRuolo: ${s.C}\nDecisione: ${s.E}\nCriteri: ${s.D1}\nTempi e budget: ${s.D2}\n\nNote: ${a.notes || '-'}`;
    const url = `mailto:info@massiniindustries.com?subject=${encodeURIComponent('Richiesta impianto · ' + a.company)}&body=${encodeURIComponent(body)}`;
    el.innerHTML = `<div class="wz-done"><svg viewBox="0 0 52 52" width="64" height="64" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none" stroke="#2997ff" stroke-width="3"/><path d="M15 27l8 8 14-16" fill="none" stroke="#2997ff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg><h3>Richiesta pronta, grazie ${esc(a.name.split(' ')[0])}</h3><p class="cap">Si è aperto il tuo programma di posta con il riepilogo: premi Invia e ti ricontatteremo all’indirizzo ${esc(a.email)}.</p><a class="btn" href="${url}">Apri di nuovo l’email</a><p class="cap">Questa pagina non invia dati da sola.</p><button class="wz-again" type="button">Nuova richiesta</button></div>`;
    el.querySelector('.wz-again').onclick = () => { Object.keys(a).forEach(k => delete a[k]); i = 0; draw(0); };
    location.href = url;
  }
  draw(0);
})();
