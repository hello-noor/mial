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
    else if (q.type === 'range') { const v = a.cap ?? q.def; b = `<div class="wz-range"><output id="wzv">${v}<small> ${q.unit}</small></output><input type="range" min="${q.min}" max="${q.max}" value="${v}" aria-label="Produzione oraria"><p id="wzs" class="cap">≈ ${v * 16} t al giorno su 16 ore</p></div><button class="btn wz-next" type="button">Avanti</button>`; }
    else if (q.type === 'group') b = q.f.map(f => `<p class="wz-l">${f.l}</p>${chips(f.k, f.o, a[f.k])}`).join('') + `<button class="btn wz-next" type="button" ${ready(q) ? '' : 'disabled'}>Avanti</button>`;
    else b = `<form class="wz-form"><label>Nome e cognome<input name="name" required maxlength="80" autocomplete="name" value="${esc(a.name || '')}"></label><label>Azienda<input name="company" required maxlength="80" autocomplete="organization" value="${esc(a.company || '')}"></label><label>Email<input name="email" type="email" required maxlength="120" autocomplete="email" value="${esc(a.email || '')}"></label><label>Telefono <small>(facoltativo)</small><input name="phone" type="tel" maxlength="30" autocomplete="tel" value="${esc(a.phone || '')}"></label><button class="btn" type="submit">Vedi il risultato</button></form>`;
    el.innerHTML = `${bar()}<div class="wz-step" style="--d:${dir}"><h3>${q.t}</h3>${q.sub ? `<p class="cap">${q.sub}</p>` : ''}${b}</div>`;
    const first = el.querySelector('.wz-o,input'); if (first && dir) first.focus({ preventScroll: true });
  }
  const go = d => { i = Math.max(0, Math.min(Q.length - 1, i + d)); draw(d); };
  el.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.classList.contains('wz-back')) return go(-1);
    if (t.classList.contains('wz-next')) return go(1);
    if (t.classList.contains('wz-o')) {
      const q = Q[i], k = t.dataset.k, v = t.dataset.v, f = q.f && q.f.find(x => x.k === k), m = q.type === 'multi';
      if (m) { const cur = a[k] || []; a[k] = cur.includes(v) ? cur.filter(x => x !== v) : cur.length < q.max ? [...cur, v] : [...cur.slice(1), v]; }
      else a[k] = v;
      if (q.type === 'one') return setTimeout(() => go(1), 220);
      draw(0); const n = el.querySelector(`[data-k="${k}"][data-v="${v}"]`); n && n.focus({ preventScroll: true });
    }
  });
  el.addEventListener('input', e => { if (e.target.type === 'range') { const v = a.cap = +e.target.value; el.querySelector('#wzv').innerHTML = `${v}<small> t/h</small>`; el.querySelector('#wzs').textContent = `≈ ${v * 16} t al giorno su 16 ore`; } });
  el.addEventListener('submit', e => {
    e.preventDefault(); new FormData(e.target).forEach((v, k) => a[k] = String(v).trim()); a.cap ??= Q.find(x => x.k === 'cap').def; a.ts = Date.now();
    try { const L = JSON.parse(localStorage.getItem('massini_leads') || '[]'); L.push(a); localStorage.setItem('massini_leads', JSON.stringify(L.slice(-30))); } catch (_) {}
    done();
  });
  function done() {
    const r = score(a), s = said(a), body = `Nome: ${a.name}\nAzienda: ${a.company}\nEmail: ${a.email}\nTelefono: ${a.phone || '-'}\n\nProfilo (MEDDIC, ${r.tot}/100 · ${r.grade})\n- Obiettivo: ${s.M}\n- Chi decide: ${s.E}\n- Criteri: ${s.D1}\n- Tempi e budget: ${s.D2}\n- Problema: ${s.I}\n- Ruolo: ${s.C}\n- Interesse: ${window.MEDDIC.txt('scope', a.scope)}\n- Macchine: ${window.MEDDIC.txt('prod', a.prod || [])}\n- Prodotto lavorato: ${window.MEDDIC.txt('mat', a.mat || [])}`;
    const C = 2 * Math.PI * 52;
    el.innerHTML = `<div class="wz-done"><svg viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="Maturità del progetto ${r.tot} su 100"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="9"/><circle id="wzr" cx="60" cy="60" r="52" fill="none" stroke="#2997ff" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)"/><text x="60" y="68" text-anchor="middle" fill="#fff" font-size="30" font-weight="600">${r.tot}</text></svg><h3>Il tuo progetto è pronto al ${r.tot}%</h3><p class="cap">${r.tot >= 70 ? 'Hai le idee chiare: possiamo passare subito a una proposta.' : r.tot >= 45 ? 'Buona base: in una call definiamo gli ultimi dettagli.' : 'Si parte: ti aiutiamo a mettere a fuoco obiettivi e tempi.'}</p><a class="btn" href="mailto:info@massiniindustries.com?subject=${encodeURIComponent('Richiesta impianto · ' + a.company)}&body=${encodeURIComponent(body)}">Invia la richiesta per email</a><p class="cap">Si apre il tuo programma di posta con il riepilogo già scritto: nessun dato viene inviato da questa pagina.</p><button class="wz-again" type="button">Ricomincia</button></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => { const c = document.getElementById('wzr'); c && (c.style.strokeDashoffset = C * (1 - r.tot / 100)); }));
    el.querySelector('.wz-again').onclick = () => { Object.keys(a).forEach(k => delete a[k]); i = 0; draw(0); };
  }
  draw(0);
})();
