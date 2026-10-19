/* MEDDIC: domande del form, punteggio e prossima mossa. Usato da index.html (form) e qualifica.html (area commerciale). */
window.MEDDIC = (() => {
  const PROD = {
    imp: [['m1', 'Impianto mangime 1 Ton/h'], ['m3', 'Impianto mangime 3 Ton/h'], ['m5', 'Impianto mangime 5 Ton/h'], ['pf', 'Impianto Pet Food'], ['silo', 'Silos'], ['mol', 'Molino a martelli'], ['mis', 'Miscelatori'], ['bil', 'Bilance di dosaggio'], ['raf', 'Raffreddatori'], ['pre', 'Prepulitore vibrante e vagli'], ['bb', 'Svuotamento big bag']],
    tra: [['tub', 'Trasportatore tubolare a catena'], ['taz', 'Elevatore a tazze'], ['tazb', 'Elevatore a tazze basculanti'], ['red', 'Trasportatore Redler'], ['pal', 'Trasportatore a palette'], ['cot', 'Coclea tubolare'], ['coa', 'Coclea a cassa aperta'], ['spi', 'Spirale flessibile'], ['pne', 'Trasportatore pneumatico'], ['ban', 'Bandebord'], ['est', 'Estrattore a coclea']],
    conf: [['ins', 'Insaccatrice a bocca aperta'], ['vff', 'Confezionatrice verticale VFFS'], ['ffs', 'Formatrice tubolare FFS'], ['pall', 'Pallettizzatore'], ['avv', 'Avvolgitore pallet'], ['car', 'Cartonatrice'], ['imc', 'Impianto completo di confezionamento']],
    ass: [['ric', 'Ricambi'], ['man', 'Manutenzione programmata'], ['rev', 'Revisione o ammodernamento'], ['urg', 'Assistenza urgente']],
  };
  const Q = [
    { k: 'scope', t: 'Cosa ti serve?', type: 'one', o: [['imp', 'Impianto completo', 'Mangimificio o pet food, dal silo al pallet'], ['tra', 'Trasporto di prodotti sfusi', 'Catene tubolari, elevatori, coclee'], ['conf', 'Fine linea e confezionamento', 'Insacco, pallet, fasciatura'], ['ass', 'Assistenza e ricambi', 'Su impianti esistenti']] },
    { k: 'mat', t: 'Che prodotto lavori?', sub: 'Anche più di uno', type: 'multi', max: 3, o: [['mang', 'Mangimi per animali'], ['pet', 'Pet food'], ['cer', 'Cereali e farine'], ['riso', 'Riso'], ['sem', 'Semi'], ['zuc', 'Zucchero'], ['fer', 'Fertilizzanti'], ['chim', 'Chimico e alimentare']] },
    { k: 'prod', t: 'Quali macchine ti interessano?', sub: 'Scegline fino a 4', type: 'multi', max: 4, by: 'scope', map: PROD },
    { k: 'num', t: 'I tuoi numeri', sub: 'Regola i valori: ci servono per dimensionare bene', type: 'nums' },
    { k: 'pains', t: 'Cosa non funziona oggi?', sub: 'Scegline fino a 3', type: 'multi', max: 3, o: [['old', 'Impianto datato'], ['bott', 'Colli di bottiglia'], ['stop', 'Troppi fermi'], ['man', 'Troppa manodopera'], ['qual', 'Qualità e contaminazioni'], ['new', 'Parto da zero']] },
    { t: 'Com’è nata l’idea?', sub: 'Due domande per capire il momento', type: 'group', f: [{ k: 'trigger', l: 'Cosa ti ha fatto muovere adesso?', o: [['old', 'Impianto da sostituire'], ['grow', 'Più volumi da gestire'], ['new', 'Nuova attività o stabilimento'], ['norm', 'Normativa o richiesta di un cliente'], ['alt', 'Altro']] }, { k: 'bought', l: 'Hai già acquistato un impianto simile?', o: [['si', 'Sì, e mi sono trovato bene'], ['sino', 'Sì, ma con qualche problema'], ['no', 'No, è la prima volta']] }] },
    { t: 'Chi sei nel progetto?', type: 'group', f: [{ k: 'role', l: 'Il tuo ruolo', o: [['dir', 'Titolare o direzione'], ['tec', 'Produzione o tecnico'], ['acq', 'Acquisti'], ['con', 'Consulente']] }, { k: 'decide', l: 'Chi decide?', o: [['io', 'Io'], ['con', 'Io con altri'], ['prop', 'Devo proporlo']] }, { k: 'opp', l: 'Qualcuno in azienda è contrario o dubbioso?', o: [['no', 'No, siamo d’accordo'], ['forse', 'Forse, non so'], ['si', 'Sì']] }] },
    { k: 'criteria', t: 'Cosa conta di più nella scelta?', sub: 'Scegline fino a 2', type: 'multi', max: 2, o: [['prez', 'Prezzo'], ['temp', 'Tempi di consegna'], ['aff', 'Affidabilità e assistenza'], ['en', 'Efficienza energetica'], ['ig', 'Igiene e qualità'], ['fle', 'Modularità']] },
    { t: 'Quando si parte?', type: 'group', f: [{ k: 'timeline', l: 'Tempi', o: [['<3', 'Entro 3 mesi'], ['3-6', '3–6 mesi'], ['6-12', '6–12 mesi'], ['val', 'Sto valutando']] }, { k: 'budget', l: 'Budget', o: [['si', 'Approvato'], ['def', 'In definizione'], ['no', 'Non ancora']] }, { k: 'brange', l: 'Fascia di budget', o: [['<100', 'Sotto 100 mila €'], ['100-300', '100–300 mila €'], ['300-1000', '300 mila – 1 milione €'], ['>1000', 'Oltre 1 milione €'], ['nd', 'Preferisco non dirlo']] }] },
    { t: 'Ultimo passo: come ti raggiungiamo?', type: 'contact' },
  ];
  const label = { prod: Object.fromEntries(Object.values(PROD).flat()) }; Q.forEach(q => (q.o ? [q] : q.f || []).forEach(x => x.o && x.o.forEach(o => (label[x.k || q.k] ||= {})[o[0]] = o[1])));
  const txt = (k, v) => Array.isArray(v) ? v.map(x => label[k][x]).join(', ') : (label[k] && label[k][v]) || v;
  const L = [['M', 'Metrics', 'Obiettivo misurabile'], ['E', 'Economic buyer', 'Chi decide'], ['D1', 'Decision criteria', 'Criteri di scelta'], ['D2', 'Decision process', 'Tempi e budget'], ['I', 'Identify pain', 'Problema da risolvere'], ['C', 'Champion', 'Sponsor interno']];
  const TL = { '<3': 100, '3-6': 75, '6-12': 45, val: 15 }, BG = { si: 100, def: 60, no: 20 }, DEC = { io: 100, con: 65, prop: 30 }, ROLE = { dir: 100, tec: 85, acq: 60, con: 50 };
  const BOUGHT = { si: 100, sino: 80, no: 40 }, OPP = { no: 100, forse: 65, si: 30 };
  const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  /* Cliente ideale: cinque segnali; i dati mancanti (lead vecchi) non penalizzano. anti = niente tempi e niente budget. */
  function icp(l) {
    const cap = derive(l).cap, c = [
      ['Lavora un prodotto del nostro settore', (l.mat || []).length > 0],
      ['Ha un motivo concreto per muoversi ora', l.trigger ? l.trigger !== 'alt' : null],
      ['Volumi adatti (da 3 t/h; da 2 t/h per il fine linea)', l.scope === 'ass' ? true : cap ? cap >= (l.scope === 'conf' ? 2 : 3) : null],
      ['Tempi entro 12 mesi', l.timeline ? l.timeline !== 'val' : null],
      ['Budget approvato o in definizione', l.budget ? l.budget !== 'no' : null],
    ].map(([t, ok]) => ({ t, ok })), known = c.filter(x => x.ok !== null);
    return { c, n: c.filter(x => x.ok).length, of: known.length, anti: l.budget === 'no' && l.timeline === 'val' };
  }
  /* Vendita a grande organizzazione: pesano di più decisore, processo e sponsor. */
  const big = l => (l.scope === 'imp' && derive(l).cap >= 10) || derive(l).cap >= 20;
  function score(l) {
    const cap = derive(l).cap, s = { M: cap ? (cap >= 10 ? 100 : cap >= 3 ? 70 : 40) : l.num ? 60 : 0, E: avg([DEC[l.decide] ?? 0, ...(l.opp ? [OPP[l.opp]] : [])]), D1: Math.min(100, (l.criteria || []).length * 50), D2: avg([TL[l.timeline] ?? 0, BG[l.budget] ?? 0, ...(l.brange ? [l.brange === 'nd' ? 40 : 100] : []), ...(l.bought ? [BOUGHT[l.bought]] : [])]), I: (l.pains || []).length ? Math.min(100, 50 + l.pains.length * 25 + (l.trigger && l.trigger !== 'alt' ? 10 : 0)) : 0, C: ROLE[l.role] ?? 30 };
    const w = big(l) ? { E: 1.5, D2: 1.5, C: 1.5 } : {}, tot = Math.round(Object.entries(s).reduce((a, [k, v]) => a + v * (w[k] || 1), 0) / Object.keys(s).reduce((a, k) => a + (w[k] || 1), 0));
    return { s, tot, big: big(l), grade: icp(l).anti ? 'Freddo' : tot >= 85 ? 'Caldo' : tot >= 70 ? 'Tiepido' : 'Freddo' };
  }
  const NEXT = { M: 'Quantifica l’obiettivo: chiedi produzione oraria, prodotto e margini attuali.', E: 'Individua chi firma: proponi una call con la direzione.', D1: 'Chiarisci i criteri di scelta e come verranno confrontate le offerte.', D2: 'Definisci tempi e budget: proponi un sopralluogo con una data.', I: 'Fai emergere il problema: chiedi il costo di fermi e colli di bottiglia.', C: 'Rafforza il referente: dagli materiale per convincere i colleghi.' };
  const next = l => NEXT[Object.entries(score(l).s).sort((a, b) => a[1] - b[1])[0][0]];
  const said = l => ({ M: l.num ? nsum(l.num) : (l.cap ? `${l.cur ? `da ${l.cur} a ` : 'da zero a '}${l.cap} t/h` : '—'), E: (txt('decide', l.decide) || '—') + (l.opp ? ' · contrari: ' + txt('opp', l.opp).toLowerCase() : ''), D1: (l.criteria || []).length ? txt('criteria', l.criteria) : '—', D2: `${txt('timeline', l.timeline) || '—'} · budget ${(txt('budget', l.budget) || '—').toLowerCase()}${l.brange ? ' (' + txt('brange', l.brange) + ')' : ''}${l.bought ? ' · acquisto simile: ' + txt('bought', l.bought).toLowerCase() : ''}`, I: ((l.pains || []).length ? txt('pains', l.pains) : '—') + (l.trigger ? ' · motivo: ' + txt('trigger', l.trigger).toLowerCase() : ''), C: txt('role', l.role) || '—' });

  /* ---- suggerimenti per il commerciale ---- */
  /* Domande dal workshop di Riccardo Osti (smart questions), adattate a impianti e macchine. */
  const ASK = { M: ['Come misuri oggi il successo della soluzione attuale? Ci sono metriche che vuoi migliorare?', 'Quante t/h produci e quante te ne servono? Qual è il costo per tonnellata?'], E: ['Come avviene di solito la decisione e chi sono gli stakeholder chiave?', 'Chi altro dovrebbe essere coinvolto in questa conversazione?'], D1: ['Cosa ti piace e cosa non ti piace della soluzione attuale?', 'Cosa non fa oggi che, se lo facessimo bene, ti farebbe considerare di cambiare?', 'Sui fornitori precedenti: cosa non ha funzionato?'], D2: ['Qual è il processo interno per acquistare? Ci sono fattori esterni che influenzano i tempi?', 'Il budget è già stanziato? Com’è l’iter di approvazione?'], I: ['Puoi guidarmi nel tuo flusso di lavoro e mostrarmi i punti critici?', 'Da quanto esiste il problema? Cosa succede se non lo risolvi e quanto costa un’ora di fermo?', 'Perché hai accettato di fare questo incontro?'], C: ['Saresti il mio punto di contatto principale?', 'Se lavoriamo insieme, cosa deve succedere perché tu abbia successo nel tuo ruolo?', 'Mi racconti una collaborazione riuscita con un fornitore e cosa l’ha resa efficace?'] };
  const OK = { M: 'Obiettivo quantificato: parti dalla produzione dichiarata.', E: 'Decide lui o quasi: puoi spingere su una proposta.', D1: 'Criteri chiari: costruisci l’offerta attorno ad essi.', D2: 'Tempi e budget definiti: proponi una data per il sopralluogo.', I: 'Problema reale: usalo come filo della proposta.', C: 'Buon referente: dagli materiale da girare internamente.' };
  const PAIN = { old: 'Impianto datato: proponi un ammodernamento per fasi partendo dal punto più critico.', bott: 'Colli di bottiglia: individua con lui il tratto limitante e mostragli la simulazione 3D corrispondente.', stop: 'Fermi: fatti dire il costo di un’ora di fermo, è la base del ritorno dell’investimento.', man: 'Manodopera: il fine linea automatico (pallettizzatore, avvolgitore) riduce le persone dedicate.', qual: 'Qualità e contaminazioni: parla di costruzione in acciaio inox, pulizia dei trasportatori e ATEX dove serve.', new: 'Parte da zero: proponi un sopralluogo e un layout, coinvolgi subito un tecnico.' };
  const CRIT = { prez: 'Sensibile al prezzo: sposta il discorso sul costo totale (consumi, assistenza, fermi).', temp: 'Conta il tempo: verifica la data richiesta e gli slot di produzione prima di promettere.', aff: 'Vuole affidabilità: porta referenze clienti e parla dell’assistenza.', en: 'Efficienza energetica: usa il calcolo dei kW del simulatore di trasporto.', ig: 'Igiene e qualità: porta schede materiali e soluzioni di pulizia.', fle: 'Modularità: mostra come l’impianto può crescere per fasi.' };
  const ROLEH = { dir: 'Titolare/direzione: parla di ritorno, tempi e rischio.', tec: 'Tecnico: dagli schede e simulazioni, sarà lui a difendere la scelta.', acq: 'Acquisti: prepara un’offerta confrontabile e condizioni chiare; chiedi chi decide la parte tecnica.', con: 'Consulente: chiedi chi è il cliente finale e se è già coinvolto.' };
  function offer(l) {
    const c = derive(l).cap || 0, sc = l.scope, p = l.prod || [], t = ['m1', 'm3', 'm5'].find(x => p.includes(x));
    if (sc === 'imp') return { brand: 'MIAL', t: p.includes('pf') ? 'Impianto di produzione Pet Food' : c <= 1 ? 'Impianto Produzione Mangime 1 Ton/h' : c <= 3 ? 'Impianto Produzione Mangime 3 Ton/h' : c <= 5 ? 'Impianto Produzione Mangime 5 Ton/h' : 'Impianto su misura (MIAL arriva fino a 60 t/h)', n: `${derive(l).cur ? derive(l).cur + ' → ' : ''}${c} t/h dichiarate${t && ((t === 'm1' && c > 1) || (t === 'm3' && c > 3) || (t === 'm5' && c > 5)) ? ' · attenzione: la taglia scelta è inferiore alla produzione indicata' : ''}. Mostra la vista in sezione dell’impianto.` };
    if (sc === 'tra') return { brand: 'MIAL', t: 'Trasportatore tubolare a catena + elevatore', n: `Dimensiona sui ${c} t/h con il simulatore di trasporto (prodotto, altezza, lunghezza) e mostra il consumo stimato.` };
    if (sc === 'conf') return { brand: 'MF TECNO', t: 'Insaccatrice a bocca aperta + pallettizzatore + avvolgitore', n: `≈ ${Math.round(c * 1000 / 25 / 60)} sacchi da 25 kg al minuto per ${c} t/h: verifica se serve una linea doppia. Usa il simulatore di fine linea.` };
    return { brand: 'MIAL / MF TECNO', t: 'Assistenza e ricambi', n: 'Chiedi modello e anno dell’impianto esistente e se è fermo.' };
  }
  function hints(l) {
    const { s, tot, grade } = score(l), sd = said(l), weak = Object.entries(s).filter(([, v]) => v < 70).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    const of = offer(l), risks = [];
    if (l.budget === 'no' && l.timeline === '<3') risks.push('Vuole partire presto ma non ha budget: tempi poco realistici.');
    if (l.decide === 'prop') risks.push('Non decide lui: senza il decisore la trattativa può fermarsi.');
    if (l.timeline === 'val') risks.push('Solo valutazione: probabile confronto tra più fornitori.');
    if (l.bought === 'no') risks.push('Prima volta che acquista un impianto: non conosce i passaggi (budget, procurement, legale) e i tempi si allungano. Aiutalo a elencarli e a tornare con una tempistica realistica.');
    if (l.opp && l.opp !== 'no') risks.push(l.opp === 'si' ? 'Ha dichiarato dei contrari: incontrali prima che sia tardi e rispondi sul loro metro.' : 'Non sa se ci sono contrari: chiedi chi ha qualcosa da perdere dal cambiamento.');
    if (icp(l).anti) risks.push('Fuori profilo: nessun budget e nessuna data. Non inseguirlo, inseriscilo in nurturing.');
    if ((l.criteria || []).includes('prez') && l.budget !== 'si') risks.push('Prezzo come criterio e budget non approvato: rischio di sconto o stallo.');
    if (l.brange === '<100' && derive(l).cap >= 10 && l.scope === 'imp') risks.push('Budget sotto 100 mila € per un impianto da 10 t/h o più: aspettative probabilmente non allineate.');
    if (derive(l).cap > 20 && l.scope === 'imp') risks.push('Progetto grande: servono sopralluogo e tecnico commerciale fin da subito.');
    const next = grade === 'Caldo' ? ['Chiama entro 24 ore', 'Proponi sopralluogo o call tecnica entro 7 giorni', 'Invia la scheda prodotto e il link alla simulazione 3D'] : grade === 'Tiepido' ? ['Scrivi entro 2 giorni', 'Call di scoperta di 20 minuti sulle lettere deboli', 'Poi proponi una call con tecnico'] : ['Risposta cortese con materiali', 'Inserisci in nurturing', 'Ricontatta tra 60 giorni'];
    return { dim: dim(l), tot, grade, offer: of, weak, risks, next, sla: grade === 'Caldo' ? 'Entro 24 h' : grade === 'Tiepido' ? 'Entro 2 giorni' : 'Entro 60 giorni',
      brief: `${l.name}${l.role ? ' (' + (txt('role', l.role) || '').toLowerCase() + ')' : ''} di ${l.company} cerca ${(txt('scope', l.scope) || '').toLowerCase()}${(l.prod || []).length ? ': ' + txt('prod', l.prod) : ''}. Lavora ${(txt('mat', l.mat || []) || 'prodotto non indicato').toLowerCase()}, ${l.num ? nsum(l.num) : 'produzione ' + (l.cap || '?') + ' t/h'}. Problema: ${((l.pains || []).length ? txt('pains', l.pains) : 'non indicato').toLowerCase()}. Decisione: ${(txt('decide', l.decide) || '—').toLowerCase()}; partenza ${(txt('timeline', l.timeline) || '—').toLowerCase()}; budget ${(txt('budget', l.budget) || '—').toLowerCase()}.`,
      rows: Object.fromEntries(L.map(([k]) => [k, { ask: [...(s[k] < 70 ? ASK[k] : []), ...(k === 'D2' && l.bought === 'no' ? ['Guida il cliente a studiare tutti i passaggi d’acquisto e a tornare con una tempistica realistica.'] : []), ...(k === 'E' && l.opp && l.opp !== 'no' ? ['Chi potrebbe opporsi e cosa perderebbe dal cambiamento? Incontralo prima che sia tardi.'] : [])], ok: s[k] >= 70 ? OK[k] : '' }])),
      icp: icp(l), big: big(l), people: people(l), call: call(l),
      angles: [...(l.pains || []).map(x => PAIN[x]), ...(l.criteria || []).map(x => CRIT[x]), ROLEH[l.role]].filter(Boolean) };
  }
  const F = {
    cur: { l: 'Oggi produco', u: 't/h', min: 0, max: 60, def: 0 }, cap: { l: 'Voglio arrivare a', u: 't/h', min: 1, max: 60, def: 10 },
    sil: { l: 'Numero di silos', u: '', min: 1, max: 20, def: 4 }, vol: { l: 'Volume di ogni silo', u: 'm³', min: 10, max: 500, step: 10, def: 100 },
    mix: { l: 'Volume del miscelatore', u: 'litri', min: 500, max: 12000, step: 500, def: 3000 }, bth: { l: 'Batch all’ora', u: '', min: 1, max: 20, def: 6 }, cmp: { l: 'Componenti da dosare', u: '', min: 1, max: 30, def: 8 },
    flow: { l: 'Portata richiesta', u: 't/h', min: 1, max: 100, def: 20 }, hgt: { l: 'Dislivello', u: 'm', min: 1, max: 40, def: 12 }, len: { l: 'Lunghezza del percorso', u: 'm', min: 2, max: 150, def: 30 },
    bpm: { l: 'Sacchi al minuto', u: '', min: 1, max: 40, def: 12 }, kg: { l: 'Peso del sacco', u: 'kg', min: 1, max: 50, def: 25 }, pph: { l: 'Pallet all’ora', u: '', min: 1, max: 60, def: 20 }, cpm: { l: 'Cartoni al minuto', u: '', min: 1, max: 60, def: 15 },
    age: { l: 'Età dell’impianto', u: 'anni', min: 0, max: 40, def: 10 },
  };
  const CONV = ['flow', 'hgt', 'len'], BAG = ['bpm', 'kg'], PLANT = ['cur', 'cap'];
  const BYPROD = { m1: PLANT, m3: PLANT, m5: PLANT, pf: PLANT, silo: ['sil', 'vol'], mol: ['cap'], mis: ['mix', 'bth'], bil: ['cmp'], raf: ['cap'], pre: ['cap'], tub: CONV, taz: CONV, tazb: CONV, red: CONV, pal: CONV, cot: CONV, coa: CONV, spi: CONV, pne: CONV, ban: CONV, est: CONV, ins: BAG, vff: BAG, ffs: BAG, pall: ['pph'], avv: ['pph'], car: ['cpm'], imc: [...BAG, 'pph'], ric: ['age'], man: ['age'], rev: ['age'], urg: ['age'] };
  const numFields = a => { const ks = []; (a.prod || []).forEach(p => (BYPROD[p] || []).forEach(k => ks.includes(k) || ks.push(k))); if (!ks.length) ks.push('cur', 'cap'); return ks.slice(0, 7); };
  const derive = l => { const n = l.num || {}; return { cap: n.cap ?? n.flow ?? (n.bpm && n.kg ? Math.round(n.bpm * n.kg * .6) / 10 : l.cap), cur: n.cur ?? l.cur }; };
  const nsum = n => { const o = []; if (n.sil && n.vol) o.push(`${n.sil} silos × ${n.vol} m³ = ${n.sil * n.vol} m³`); if (n.bpm && n.kg) o.push(`≈ ${(n.bpm * n.kg * .06).toFixed(1)} t/h di fine linea`); if (n.cap) o.push(n.cur ? `da ${n.cur} a ${n.cap} t/h (${n.cap >= n.cur ? '+' : ''}${Math.round((n.cap / n.cur - 1) * 100)}%)` : `${n.cap} t/h da zero`); if (n.mix && n.bth) o.push(`≈ ${(n.mix * .55 * n.bth / 1000).toFixed(1)} t/h di miscela`); return o.join(' · ') || 'Regola i valori'; };
  function dim(l) {
    const n = l.num || {}, { cap, cur } = derive(l), tiles = [], notes = [];
    Object.keys(n).forEach(k => F[k] && tiles.push([F[k].l, `${n[k]}${F[k].u ? ' ' + F[k].u : ''}`]));
    if (n.sil && n.vol) { const tot = n.sil * n.vol; tiles.push(['Volume totale silos', `${tot} m³ (≈ ${Math.round(tot * .65)} t)`]); if (cap) { const h = tot * .65 / cap; notes.push(`Autonomia dei silos ≈ ${Math.round(h)} h a ${cap} t/h${h < 24 ? ': bassa, valuta più volume o più silos.' : ': adeguata.'}`); } else notes.push('Chiedi la produzione oraria per calcolare l’autonomia dei silos.'); }
    if (n.mix && n.bth) { const th = n.mix * .55 * n.bth / 1000; tiles.push(['Resa miscelatore', `≈ ${th.toFixed(1)} t/h`]); if (cap && th < cap) notes.push(`Il miscelatore rende ≈ ${th.toFixed(1)} t/h, meno dei ${cap} t/h richiesti: serve più volume o più batch all’ora.`); }
    if (n.flow && n.hgt && n.len) { const kw = ((n.flow * 1000 / 3600 * 9.81 * n.hgt / .6 + 100 + 25 * (n.len + 2 * n.hgt)) / .85 / 1000); tiles.push(['Motore indicativo', `≈ ${kw.toFixed(1)} kW`]); notes.push(`Dislivello ${n.hgt} m su ${n.len} m: valuta elevatore più tubolare; usa il simulatore di trasporto per il consumo.`); }
    if (n.bpm && n.kg) { tiles.push(['Fine linea', `≈ ${(n.bpm * n.kg * .06).toFixed(1)} t/h`]); if (n.bpm > 25) notes.push('Oltre ≈ 25 sacchi/min un pallettizzatore singolo non basta: valuta due linee o un robot.'); }
    if (n.pph && n.bpm) { const need = n.bpm * 60 / (n.kg >= 20 ? 20 : 45); if (n.pph < need) notes.push(`Alla cadenza indicata servono ≈ ${Math.round(need)} pallet/h, ne hai indicati ${n.pph}: il fine linea è il collo di bottiglia.`); }
    if (n.cmp) notes.push(`${n.cmp} componenti da dosare: ${n.cmp > 10 ? 'valuta più bilance e ' : ''}chiedi quante ricette e il livello di tracciabilità.`);
    if (n.age >= 15) notes.push(`Impianto di ${n.age} anni: proponi revisione o ammodernamento e chiedi quali ricambi sono introvabili.`);
    if (cur > 0 && cap) tiles.push(['Crescita', `${cap >= cur ? '+' : ''}${Math.round((cap / cur - 1) * 100)}%`]);
    return { tiles, notes };
  }
  /* ---- funnel (valori dal workshop) ---- */
  const STG = [['Nuovo', 'MQL', 'Discovery', 5, 10, 'Capire se il problema esiste e se la persona corrisponde al cliente ideale.'], ['Contattato', 'MQL', 'Discovery', 5, 10, 'Primo contatto fatto: trova il punto in comune, poi fissa il passo successivo.'], ['Qualificato', 'SQL', 'Discovery', 20, 25, 'Confermare interesse reale, budget e tempi.'], ['Discodemo', 'Demo', 'Discovery', 40, 50, 'Mostrare la soluzione applicata ai problemi emersi, non un tour del prodotto.'], ['Proposta', 'Proposal', 'Chiusura', 75, 75, 'Arrivare senza sorprese, con l’impegno a firmare già chiesto.'], ['Trattativa', 'Negotiation', 'Chiusura', 90, 100, 'Superare i vincoli di acquisti e legali fino alla firma.'], ['Vinto', '', 'Chiusura', 100, 100, 'Passa a consegna e avvio.'], ['Perso', '', '', 0, 0, 'Annota il motivo: serve per capire cosa migliorare.']].map(([n, f, ph, a, b, g]) => ({ n, f, ph, a, b, g, p: (a + b) / 200, r: a === b ? a + '%' : a + '–' + b + '%' }));
  const VAL = { '<100': 60, '100-300': 200, '300-1000': 600, '>1000': 1200 }; // k€, centro della fascia; 'nd' non entra nel valore
  const money = k => k >= 1000 ? (k / 1000).toFixed(1).replace('.', ',') + ' M€' : Math.round(k) + ' k€';

  /* ---- persone nel deal ---- */
  function people(l) {
    const d = l.decide, r = l.role, you = (r === 'dir' && d === 'io') ? 'Il contatto è anche chi firma: tratta metriche e sponsor insieme.' : r === 'acq' ? 'Chi hai davanti gestisce gli acquisti: potrebbe non essere né sponsor né chi firma.' : r === 'con' ? 'Consulente: chiedi chi è il cliente finale e se è già coinvolto.' : 'Verifica che faccia davvero il tifo: ti dà accesso a chi firma?';
    return [
      { t: 'Champion', who: you, want: 'Un successo personale: un progetto che lo faccia brillare.', do: 'Costruisci un rapporto vero. Chiedigli cosa deve succedere perché abbia successo nel suo ruolo.' },
      { t: 'Chi firma', who: d === 'io' ? 'Decide il contatto.' : d === 'con' ? 'Decide con altre persone: scopri chi.' : 'Non è stato ancora incontrato.', want: 'Risultati misurabili e rischio sotto controllo.', do: d === 'io' ? 'Parla di numeri e tempi di ritorno.' : 'Chiedi una call a tre e parla di metriche e impatto.' },
      { t: 'Contrari', who: l.opp === 'si' ? 'Ci sono, dichiarati dal cliente.' : l.opp === 'forse' ? 'Possibili: il cliente non lo sa.' : 'Nessuno dichiarato, ma verifica.', want: 'Evitare lavoro extra, perdere ruolo o ammettere un errore passato.', do: 'Incontrali presto, ascolta le obiezioni e rispondi sul loro metro.' },
    ];
  }

  /* ---- script del primo contatto (Greet, Hook, Qualify, Lock) ---- */
  const PTXT = { old: 'l’impianto è datato e costoso da mantenere', bott: 'ci sono colli di bottiglia che frenano la produzione', stop: 'i fermi impianto costano troppo', man: 'serve troppa manodopera', qual: 'è difficile garantire qualità senza contaminazioni', new: 'si parte da zero e non è facile evitare errori di layout' };
  function call(l) {
    const mat = ((l.mat || []).length ? txt('mat', l.mat).toLowerCase() : 'il vostro prodotto'), pain = PTXT[(l.pains || [])[0]], of = offer(l), w = Object.entries(score(l).s).filter(([, v]) => v < 70).map(x => x[0]);
    const q = [w.includes('M') && 'quante tonnellate all’ora producete e quante ne servono', w.includes('E') && 'chi decide su questo tema', w.includes('D2') && 'entro quando vorreste partire', w.includes('D1') && 'cosa conta di più nella scelta'].filter(Boolean).slice(0, 3);
    return [
      { n: 'Greet', t: 'Una cosa in comune', say: `«Lavorate ${mat}: da quanto? Come vi trovate con la campagna di quest’anno?»`, why: 'Abbassa le difese e apre il canale umano: nei primi secondi decidi se sei un venditore o una persona.' },
      { n: 'Hook', t: 'Perché ti cerco', say: pain ? `«Molti clienti nel tuo ruolo mi dicono che ${pain}. Capita anche a voi? Con altri clienti l’abbiamo risolto così: ${of.t}.»` : `«Cosa vi ha fatto chiedere un’offerta proprio ora? Con altri clienti che avevano la stessa esigenza abbiamo lavorato su ${of.t}.»`, why: 'Prima l’ipotesi sul problema, poi la prova sociale. Evita «immagina»: sii diretto e concreto.' },
      { n: 'Qualify', t: 'È il cliente ideale?', say: q.length ? `«Mi dite ${q.join(', ')}?»` : '«Ho tutto quello che serve: ti propongo il prossimo passo.»', why: 'Poche domande rapide su volumi, decisore e tempi. Se non è cliente ideale, meglio saperlo subito.' },
      { n: 'Lock', t: 'Il prossimo passo', say: '«Perfetto, ti scrivo io entro domani. Cosa vuoi che ci sia dentro perché sia utile per te?»', why: 'Chiedere cosa scrivere fa definire al cliente il contenuto: la mail diventa un impegno co-scritto.' },
    ];
  }
  const CHECK = [['Prima della call', ['Verificato che sia in linea con il cliente ideale', 'Trovato un punto in comune (Greet)', 'Ricordato come essere per il cliente: fiducia, ascolto, presenza', 'Preparato il gancio con un caso reale', 'Riletto cosa so di MEDDIC e cosa manca']], ['Durante', ['Chiesto chi è il punto di contatto principale', 'Fatte almeno tre domande smart', 'Capito il problema: da quanto, cosa succede se non lo risolve', 'Capiti criteri di scelta e processo d’acquisto', 'Individuati chi firma e possibili contrari', 'Concordato un passo successivo (Lock)']], ['Dopo', ['Inviata la mail concordata', 'Aggiornata la mappa MEDDIC', 'Deciso: avanzare o scartare, con il motivo']]];
  const QUOTE = ['Chiama prima di inviare: il preventivo non arriva mai da solo, lo annunci e fissi un momento per parlarne.', 'Leggetelo insieme, punto per punto, senza saltare nulla.', 'Chiedi il commitment: «Se i punti sono questi, siamo d’accordo di firmare?»', 'Gestisci ora le obiezioni: meglio sapere adesso perché non arriva il sì.'];
  const DISCO = 'Incontro di 30 minuti dal cliente dopo la fase SQL: 25 di conversazione, 5 sulla proposta. Videocall in piedi per dare ritmo; prima dei 5 minuti riassumi cosa hai capito; usa testimonianze di altri clienti; chiudi con un passo concreto.';
  const opts = (q, a) => q.by ? q.map[a[q.by]] || [] : q.o;
  return { Q, L, STG, VAL, money, CHECK, QUOTE, DISCO, icp, big, opts, hints, F, numFields, derive, nsum, dim, score, next, said, txt };
})();
