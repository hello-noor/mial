/* MEDDIC: domande del form, punteggio e prossima mossa. Usato da index.html (form) e qualifica.html (area commerciale). */
window.MEDDIC = (() => {
  const Q = [
    { k: 'scope', t: 'Cosa ti serve?', type: 'one', o: [['imp', 'Impianto completo', 'Mangimificio o pet food, dal silo al pallet'], ['tra', 'Trasporto di prodotti sfusi', 'Catene tubolari, elevatori, coclee'], ['conf', 'Fine linea e confezionamento', 'Insacco, pallet, fasciatura'], ['ass', 'Assistenza e ricambi', 'Su impianti esistenti']] },
    { k: 'pains', t: 'Cosa non funziona oggi?', sub: 'Scegline fino a 3', type: 'multi', max: 3, o: [['old', 'Impianto datato'], ['bott', 'Colli di bottiglia'], ['stop', 'Troppi fermi'], ['man', 'Troppa manodopera'], ['qual', 'Qualità e contaminazioni'], ['new', 'Parto da zero']] },
    { k: 'cap', t: 'Quanto vuoi produrre?', sub: 'Muovi il cursore', type: 'range', min: 1, max: 60, def: 10, unit: 't/h' },
    { t: 'Chi sei nel progetto?', type: 'group', f: [{ k: 'role', l: 'Il tuo ruolo', o: [['dir', 'Titolare o direzione'], ['tec', 'Produzione o tecnico'], ['acq', 'Acquisti'], ['con', 'Consulente']] }, { k: 'decide', l: 'Chi decide?', o: [['io', 'Io'], ['con', 'Io con altri'], ['prop', 'Devo proporlo']] }] },
    { k: 'criteria', t: 'Cosa conta di più nella scelta?', sub: 'Scegline fino a 2', type: 'multi', max: 2, o: [['prez', 'Prezzo'], ['temp', 'Tempi di consegna'], ['aff', 'Affidabilità e assistenza'], ['en', 'Efficienza energetica'], ['ig', 'Igiene e qualità'], ['fle', 'Modularità']] },
    { t: 'Quando si parte?', type: 'group', f: [{ k: 'timeline', l: 'Tempi', o: [['<3', 'Entro 3 mesi'], ['3-6', '3–6 mesi'], ['6-12', '6–12 mesi'], ['val', 'Sto valutando']] }, { k: 'budget', l: 'Budget', o: [['si', 'Approvato'], ['def', 'In definizione'], ['no', 'Non ancora']] }] },
    { t: 'Ultimo passo: come ti raggiungiamo?', type: 'contact' },
  ];
  const label = {}; Q.forEach(q => (q.o ? [q] : q.f || []).forEach(x => x.o && x.o.forEach(o => (label[x.k || q.k] ||= {})[o[0]] = o[1])));
  const txt = (k, v) => Array.isArray(v) ? v.map(x => label[k][x]).join(', ') : (label[k] && label[k][v]) || v;
  const L = [['M', 'Metrics', 'Obiettivo misurabile'], ['E', 'Economic buyer', 'Chi decide'], ['D1', 'Decision criteria', 'Criteri di scelta'], ['D2', 'Decision process', 'Tempi e budget'], ['I', 'Identify pain', 'Problema da risolvere'], ['C', 'Champion', 'Sponsor interno']];
  const TL = { '<3': 100, '3-6': 75, '6-12': 45, val: 15 }, BG = { si: 100, def: 60, no: 20 }, DEC = { io: 100, con: 65, prop: 30 }, ROLE = { dir: 100, tec: 85, acq: 60, con: 50 };
  function score(l) {
    const s = { M: l.cap ? (l.cap >= 10 ? 100 : l.cap >= 3 ? 70 : 40) : 0, E: DEC[l.decide] ?? 0, D1: Math.min(100, (l.criteria || []).length * 50), D2: Math.round(((TL[l.timeline] ?? 0) + (BG[l.budget] ?? 0)) / 2), I: (l.pains || []).length ? Math.min(100, 50 + l.pains.length * 25) : 0, C: ROLE[l.role] ?? 30 };
    const tot = Math.round(Object.values(s).reduce((a, b) => a + b, 0) / 6);
    return { s, tot, grade: tot >= 70 ? 'Caldo' : tot >= 45 ? 'Tiepido' : 'Freddo' };
  }
  const NEXT = { M: 'Quantifica l’obiettivo: chiedi produzione oraria, prodotto e margini attuali.', E: 'Individua chi firma: proponi una call con la direzione.', D1: 'Chiarisci i criteri di scelta e come verranno confrontate le offerte.', D2: 'Definisci tempi e budget: proponi un sopralluogo con una data.', I: 'Fai emergere il problema: chiedi il costo di fermi e colli di bottiglia.', C: 'Rafforza il referente: dagli materiale per convincere i colleghi.' };
  const next = l => NEXT[Object.entries(score(l).s).sort((a, b) => a[1] - b[1])[0][0]];
  const said = l => ({ M: l.cap ? `${l.cap} t/h (${l.cap * 16} t al giorno)` : '—', E: txt('decide', l.decide) || '—', D1: (l.criteria || []).length ? txt('criteria', l.criteria) : '—', D2: `${txt('timeline', l.timeline) || '—'} · budget ${(txt('budget', l.budget) || '—').toLowerCase()}`, I: (l.pains || []).length ? txt('pains', l.pains) : '—', C: txt('role', l.role) || '—' });
  return { Q, L, score, next, said, txt };
})();
