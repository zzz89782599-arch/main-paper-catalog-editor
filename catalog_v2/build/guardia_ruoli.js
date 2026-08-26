/* guardia_ruoli.js — «ha fatto piu' di quanto gli spetta?» (CLOUD_PLAN §12F, fase 4).
 *
 * ⚠️ COSA NON E'. Con UNA chiave condivisa (§7, scelta di Isaac il 24/08) non esiste
 * autenticazione: chi ha la chiave puo' firmarsi con qualunque nome. Questo controllo
 * NON impedisce a un malintenzionato di fare danni — impedisce che un ERRORE ONESTO
 * passi inosservato: il collega che tocca l'impaginazione mentre doveva solo proporre
 * un'idea. §12B lo dice gia': «il non ripudio non regge». Scriverlo qui perche' un
 * cancello di cui si crede piu' di quello che fa e' peggio di nessun cancello.
 *
 * Come si capisce CHI ha fatto il commit: dalle righe NUOVE di `stato/tracce.jsonl`.
 * L'app le scrive nello stesso commit della correzione (fase 3), quindi ci sono. Se
 * non ce ne sono, l'autore e' ignoto: il commit non si giudica (e lo si dice).
 *
 * ⚠️ Il livello si legge dal ruoli.json del commit PRECEDENTE, non da quello nuovo:
 * altrimenti basterebbe promuoversi nello stesso commit in cui si sfora.
 *
 * Uso (dentro l'Action o a mano):
 *   node build/guardia_ruoli.js <sha_base> <sha_nuovo>
 * In prova, senza git: si passano gli oggetti a `giudica()`.
 */
'use strict';

// chi puo' toccare cosa. Ogni voce e' una funzione sul percorso nel repo.
const P = 'catalog_v2/dist/stato/';
const SOLO_IDEE = (f) => f === P + 'tracce.jsonl';
const DATI = (f) => SOLO_IDEE(f) || f === P + 'prese.json'
  || /^catalog_v2\/dist\/stato\/[A-Z_]+\.csv$/.test(f);
// L3 puo' tutto tranne cambiare i ruoli senza essere L3 (che e' gia' vero per costruzione)
const REGOLE = {
  1: { puo: SOLO_IDEE, dice: 'L1 (sola lettura) puo\' toccare solo le idee' },
  2: { puo: DATI, dice: 'L2 (testi e dati) non puo\' toccare impaginazione, cromatura o ruoli' },
  3: { puo: () => true, dice: '' },
};

function autoreDa(tracceBase, tracceNuovo) {
  const righe = (t) => String(t || '').split('\n').filter((l) => l.trim());
  const vecchie = new Set(righe(tracceBase));
  const nuove = righe(tracceNuovo).filter((l) => !vecchie.has(l));
  const chi = [];
  nuove.forEach((l) => {
    let v = null;
    try { v = JSON.parse(l); } catch (e) { return; }
    if (v && v.chi && chi.indexOf(v.chi) < 0) chi.push(v.chi);
  });
  return chi;
}

function livelloDi(ruoliBase, chi) {
  let r = null;
  try { r = JSON.parse(String(ruoliBase || '{}')); } catch (e) { r = null; }
  const u = r && r.utenti && r.utenti[chi];
  if (!u || u.attivo === false) return null;         // ignoto o disattivato
  return Number(u.lv) || 1;
}

/* Torna { verdetto, chi, lv, fuori:[...] , perche } senza toccare git.
 *   verdetto: 'ok' | 'oltre' | 'ignoto'
 *   fuori:    i file che quel livello non poteva toccare */
function giudica({ files, tracceBase, tracceNuovo, ruoliBase }) {
  const chi = autoreDa(tracceBase, tracceNuovo);
  if (chi.length !== 1) {
    return { verdetto: 'ignoto', chi: chi, lv: null, fuori: [],
             perche: chi.length ? 'piu\' autori nello stesso commit: ' + chi.join(', ')
                                : 'nessuna firma nel commit: non so di chi sia' };
  }
  const lv = livelloDi(ruoliBase, chi[0]);
  if (lv === null) {
    return { verdetto: 'ignoto', chi: chi, lv: null, fuori: [],
             perche: '«' + chi[0] + '» non e\' nell\'elenco (o e\' disattivato)' };
  }
  const regola = REGOLE[lv] || REGOLE[1];
  const fuori = (files || []).filter((f) => !regola.puo(f));
  return { verdetto: fuori.length ? 'oltre' : 'ok', chi: chi[0], lv: lv, fuori: fuori,
           perche: fuori.length ? regola.dice : '' };
}

module.exports = { giudica, autoreDa, livelloDi, REGOLE, P };

if (require.main === module) {
  const { execFileSync } = require('child_process');
  const [base, nuovo] = process.argv.slice(2);
  if (!base || !nuovo) { console.error('uso: guardia_ruoli.js <base> <nuovo>'); process.exit(2); }
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const mostra = (sha, f) => { try { return git('show', sha + ':' + f); } catch (e) { return ''; } };
  const files = git('diff', '--name-only', base, nuovo).split('\n').filter(Boolean);
  const r = giudica({ files,
                      tracceBase: mostra(base, P + 'tracce.jsonl'),
                      tracceNuovo: mostra(nuovo, P + 'tracce.jsonl'),
                      ruoliBase: mostra(base, P + 'ruoli.json') });
  console.log(JSON.stringify(r, null, 1));
  process.exit(r.verdetto === 'oltre' ? 1 : 0);
}
