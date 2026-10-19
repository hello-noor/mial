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
    { k: 'pains', t: 'Cosa non funziona oggi?', sub: 'Scegline fino a 3', type: 'multi', max: 3, o: [['old', 'Impianto datato'], ['bott', 'Colli di bottiglia'], ['stop', 'Troppi fermi'], ['man', 'Troppa manodopera'], ['qual', 'Qualità e contaminazioni'], ['new', 'Parto da zero']] },
    { k: 'cap', t: 'Quanto produci e quanto vuoi produrre?', sub: 'Muovi i due cursori (0 = parto da zero)', type: 'ranges', min: 1, max: 60, def: 10, cur: 0, unit: 't/h' },
    { t: 'Chi sei nel progetto?', type: 'group', f: [{ k: 'role', l: 'Il tuo ruolo', o: [['dir', 'Titolare o direzione'], ['tec', 'Produzione o tecnico'], ['acq', 'Acquisti'], ['con', 'Consulente']] }, { k: 'decide', l: 'Chi decide?', o: [['io', 'Io'], ['con', 'Io con altri'], ['prop', 'Devo proporlo']] }] },
    { k: 'criteria', t: 'Cosa conta di più nella scelta?', sub: 'Scegline fino a 2', type: 'multi', max: 2, o: [['prez', 'Prezzo'], ['temp', 'Tempi di consegna'], ['aff', 'Affidabilità e assistenza'], ['en', 'Efficienza energetica'], ['ig', 'Igiene e qualità'], ['fle', 'Modularità']] },
    { t: 'Quando si parte?', type: 'group', f: [{ k: 'timeline', l: 'Tempi', o: [['<3', 'Entro 3 mesi'], ['3-6', '3–6 mesi'], ['6-12', '6–12 mesi'], ['val', 'Sto valutando']] }, { k: 'budget', l: 'Budget', o: [['si', 'Approvato'], ['def', 'In definizione'], ['no', 'Non ancora']] }] },
    { t: 'Ultimo passo: come ti raggiungiamo?', type: 'contact' },
  ];
  const label = { prod: Object.fromEntries(Object.values(PROD).flat()) }; Q.forEach(q => (q.o ? [q] : q.f || []).forEach(x => x.o && x.o.forEach(o => (label[x.k || q.k] ||= {})[o[0]] = o[1])));
  const txt = (k, v) => Array.isArray(v) ? v.map(x => label[k][x]).join(', ') : (label[k] && label[k][v]) || v;
  const L = [['M', 'Metrics', 'Obiettivo misurabile'], ['E', 'Economic buyer', 'Chi decide'], ['D1', 'Decision criteria', 'Criteri di scelta'], ['D2', 'Decision process', 'Tempi e budget'], ['I', 'Identify pain', 'Problema da risolvere'], ['C', 'Champion', 'Sponsor interno']];
  const TL = { '<3': 100, '3-6': 75, '6-12': 45, val: 15 }, BG = { si: 100, def: 60, no: 20 }, DEC = { io: 100, con: 65, prop: 30 }, ROLE = { dir: 100, tec: 85, acq: 60, con: 50 };
  function score(l) {
    const s = { M: l.cap ? (l.cap >= 10 ? 100 : l.cap >= 3 ? 70 : 40) : 0, E: DEC[l.decide] ?? 0, D1: Math.min(100, (l.criteria || []).length * 50), D2: Math.round(((TL[l.timeline] ?? 0) + (BG[l.budget] ?? 0)) / 2), I: (l.pains || []).length ? Math.min(100, 50 + l.pains.length * 25) : 0, C: ROLE[l.role] ?? 30 };
    const tot = Math.round(Object.values(s).reduce((a, b) => a + b, 0) / 6);
    return { s, tot, grade: tot >= 85 ? 'Caldo' : tot >= 70 ? 'Tiepido' : 'Freddo' };
  }
  const NEXT = { M: 'Quantifica l’obiettivo: chiedi produzione oraria, prodotto e margini attuali.', E: 'Individua chi firma: proponi una call con la direzione.', D1: 'Chiarisci i criteri di scelta e come verranno confrontate le offerte.', D2: 'Definisci tempi e budget: proponi un sopralluogo con una data.', I: 'Fai emergere il problema: chiedi il costo di fermi e colli di bottiglia.', C: 'Rafforza il referente: dagli materiale per convincere i colleghi.' };
  const next = l => NEXT[Object.entries(score(l).s).sort((a, b) => a[1] - b[1])[0][0]];
  const said = l => ({ M: l.cap ? `${l.cur ? `da ${l.cur} a ` : 'da zero a '}${l.cap} t/h (${l.cap * 16} t al giorno${l.cur ? ', +' + Math.round((l.cap / l.cur - 1) * 100) + '%' : ''})` : '—', E: txt('decide', l.decide) || '—', D1: (l.criteria || []).length ? txt('criteria', l.criteria) : '—', D2: `${txt('timeline', l.timeline) || '—'} · budget ${(txt('budget', l.budget) || '—').toLowerCase()}`, I: (l.pains || []).length ? txt('pains', l.pains) : '—', C: txt('role', l.role) || '—' });

  /* ---- suggerimenti per il commerciale ---- */
  const ASK = { M: ['Quante t/h produci oggi e quante te ne servono? Con che prodotto?', 'Qual è il margine o il costo per tonnellata oggi?'], E: ['Chi firma l’ordine e chi influenza la scelta?', 'Posso coinvolgere chi decide in una call tecnica o in una demo?'], D1: ['Come confronterai le offerte? Quali requisiti sono vincolanti (norme, ATEX, spazi, consumi)?'], D2: ['Entro quando l’impianto deve produrre?', 'Il budget è già stanziato? Com’è l’iter di approvazione?'], I: ['Cosa succede se non cambi nulla? Quanto costa un’ora di fermo?', 'Dove si ferma il prodotto oggi: trasporto, dosaggio o fine linea?'], C: ['Chi in azienda sostiene il progetto e cosa ci guadagna?', 'Di cosa ha bisogno per convincere i colleghi?'] };
  const OK = { M: 'Obiettivo quantificato: parti dalla produzione dichiarata.', E: 'Decide lui o quasi: puoi spingere su una proposta.', D1: 'Criteri chiari: costruisci l’offerta attorno ad essi.', D2: 'Tempi e budget definiti: proponi una data per il sopralluogo.', I: 'Problema reale: usalo come filo della proposta.', C: 'Buon referente: dagli materiale da girare internamente.' };
  const PAIN = { old: 'Impianto datato: proponi un ammodernamento per fasi partendo dal punto più critico.', bott: 'Colli di bottiglia: individua con lui il tratto limitante e mostragli la simulazione 3D corrispondente.', stop: 'Fermi: fatti dire il costo di un’ora di fermo, è la base del ritorno dell’investimento.', man: 'Manodopera: il fine linea automatico (pallettizzatore, avvolgitore) riduce le persone dedicate.', qual: 'Qualità e contaminazioni: parla di costruzione in acciaio inox, pulizia dei trasportatori e ATEX dove serve.', new: 'Parte da zero: proponi un sopralluogo e un layout, coinvolgi subito un tecnico.' };
  const CRIT = { prez: 'Sensibile al prezzo: sposta il discorso sul costo totale (consumi, assistenza, fermi).', temp: 'Conta il tempo: verifica la data richiesta e gli slot di produzione prima di promettere.', aff: 'Vuole affidabilità: porta referenze clienti e parla dell’assistenza.', en: 'Efficienza energetica: usa il calcolo dei kW del simulatore di trasporto.', ig: 'Igiene e qualità: porta schede materiali e soluzioni di pulizia.', fle: 'Modularità: mostra come l’impianto può crescere per fasi.' };
  const ROLEH = { dir: 'Titolare/direzione: parla di ritorno, tempi e rischio.', tec: 'Tecnico: dagli schede e simulazioni, sarà lui a difendere la scelta.', acq: 'Acquisti: prepara un’offerta confrontabile e condizioni chiare; chiedi chi decide la parte tecnica.', con: 'Consulente: chiedi chi è il cliente finale e se è già coinvolto.' };
  function offer(l) {
    const c = l.cap || 0, sc = l.scope, p = l.prod || [], t = ['m1', 'm3', 'm5'].find(x => p.includes(x));
    if (sc === 'imp') return { brand: 'MIAL', t: p.includes('pf') ? 'Impianto di produzione Pet Food' : c <= 1 ? 'Impianto Produzione Mangime 1 Ton/h' : c <= 3 ? 'Impianto Produzione Mangime 3 Ton/h' : c <= 5 ? 'Impianto Produzione Mangime 5 Ton/h' : 'Impianto su misura (MIAL arriva fino a 60 t/h)', n: `${l.cur ? l.cur + ' → ' : ''}${c} t/h dichiarate${t && ((t === 'm1' && c > 1) || (t === 'm3' && c > 3) || (t === 'm5' && c > 5)) ? ' · attenzione: la taglia scelta è inferiore alla produzione indicata' : ''}. Mostra la vista in sezione dell’impianto.` };
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
    if ((l.criteria || []).includes('prez') && l.budget !== 'si') risks.push('Prezzo come criterio e budget non approvato: rischio di sconto o stallo.');
    if (l.cap > 20 && l.scope === 'imp') risks.push('Progetto grande: servono sopralluogo e tecnico commerciale fin da subito.');
    const next = grade === 'Caldo' ? ['Chiama entro 24 ore', 'Proponi sopralluogo o call tecnica entro 7 giorni', 'Invia la scheda prodotto e il link alla simulazione 3D'] : grade === 'Tiepido' ? ['Scrivi entro 2 giorni', 'Call di scoperta di 20 minuti sulle lettere deboli', 'Poi proponi una call con tecnico'] : ['Risposta cortese con materiali', 'Inserisci in nurturing', 'Ricontatta tra 60 giorni'];
    return { tot, grade, offer: of, weak, risks, next, sla: grade === 'Caldo' ? 'Entro 24 h' : grade === 'Tiepido' ? 'Entro 2 giorni' : 'Entro 60 giorni',
      brief: `${l.name}${l.role ? ' (' + (txt('role', l.role) || '').toLowerCase() + ')' : ''} di ${l.company} cerca ${(txt('scope', l.scope) || '').toLowerCase()}${(l.prod || []).length ? ': ' + txt('prod', l.prod) : ''}. Lavora ${(txt('mat', l.mat || []) || 'prodotto non indicato').toLowerCase()}, produzione ${l.cur ? 'da ' + l.cur + ' a ' : 'da zero a '}${l.cap || '?'} t/h. Problema: ${((l.pains || []).length ? txt('pains', l.pains) : 'non indicato').toLowerCase()}. Decisione: ${(txt('decide', l.decide) || '—').toLowerCase()}; partenza ${(txt('timeline', l.timeline) || '—').toLowerCase()}; budget ${(txt('budget', l.budget) || '—').toLowerCase()}.`,
      rows: Object.fromEntries(L.map(([k]) => [k, { ask: s[k] < 70 ? ASK[k] : [], ok: s[k] >= 70 ? OK[k] : '' }])),
      angles: [...(l.pains || []).map(x => PAIN[x]), ...(l.criteria || []).map(x => CRIT[x]), ROLEH[l.role]].filter(Boolean) };
  }
  const opts = (q, a) => q.by ? q.map[a[q.by]] || [] : q.o;
  return { Q, L, opts, hints, score, next, said, txt };
})();
