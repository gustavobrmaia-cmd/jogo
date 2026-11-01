"use strict";

// =========================
// SOM v2 (Web Audio, sem arquivos: tudo sintetizado)
// - EFEITOS: cada som é uma pequena receita (osciladores levemente desafinados, envelope de ataque/soltura, filtros,
//   ruído filtrado) mandada para o barramento de efeitos, que tem um eco curto (dá corpo). Som.som("nome", tom).
// - MÚSICA chiptune gerada na hora: baixo, arpejo, melodia e bateria num loop de 8 compassos (clima de fábrica,
//   lá menor, 112 bpm); na batalha troca para uma trilha mais rápida e tensa (Som.musica("batalha"|"jogo")).
// O áudio só liga depois da 1ª interação (regra dos navegadores), fica mudo no anúncio e com a aba escondida,
// e respeita save.mudo (efeitos) e save.semMusica (música). O mesmo efeito não repete em menos de 40 ms.
// =========================
const Som = (function() {
  let a = null, mestre, efeitos, musicaBus, ruido = null, pausado = false;
  const ultimo = {};

  function ligar() {
    if (a) { if (a.state === "suspended" && !pausado && !document.hidden) a.resume(); return; }
    try {
      a = new (window.AudioContext || window.webkitAudioContext)();
      mestre = a.createGain(); mestre.gain.value = 0.6;
      const comp = a.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      mestre.connect(comp).connect(a.destination);
      efeitos = a.createGain(); efeitos.gain.value = 1; efeitos.connect(mestre);
      // eco curto nos efeitos (mandada separada)
      const eco = a.createDelay(); eco.delayTime.value = 0.11;
      const volta = a.createGain(); volta.gain.value = 0.22;
      const molhado = a.createGain(); molhado.gain.value = 0.16;
      const corta = a.createBiquadFilter(); corta.type = "lowpass"; corta.frequency.value = 3200;
      efeitos.connect(molhado).connect(eco); eco.connect(corta).connect(volta).connect(eco); corta.connect(mestre);
      musicaBus = a.createGain(); musicaBus.gain.value = save.semMusica ? 0 : 0.9; musicaBus.connect(mestre);
      ruido = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      iniciarMusica();
    } catch (e) { a = null; }
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function(ev) { window.addEventListener(ev, ligar, { capture: true, passive: true }); });
  Poki.aoAnuncio(function(aberto) { pausado = aberto; aplicarPausa(); });
  document.addEventListener("visibilitychange", aplicarPausa);
  function aplicarPausa() {
    if (!a) return;
    const parar = pausado || document.hidden;
    if (parar && a.state === "running") a.suspend(); else if (!parar && a.state === "suspended") a.resume();
  }

  // ---------- peças dos sons ----------
  // osc: onda, freq inicial e final, duração, volume, atraso, ataque, desafinação (cents) e destino
  function osc(tipo, f1, f2, dur, vol, atraso, ataque, desaf, destino) {
    const t0 = a.currentTime + (atraso || 0), at = ataque || 0.004;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + at); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(destino || efeitos);
    [0, desaf || 0].forEach(function(dc, k) {
      if (k && !desaf) return;
      const o = a.createOscillator(); o.type = tipo; o.detune.value = k ? dc : 0;
      o.frequency.setValueAtTime(f1, t0); if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
      o.connect(g); o.start(t0); o.stop(t0 + dur + 0.03);
    });
  }
  // ruído filtrado: freq do filtro inicial e final, tipo de filtro
  function chiado(f1, f2, dur, vol, atraso, tipo, q, destino) {
    const t0 = a.currentTime + (atraso || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = ruido; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    f.type = tipo || "lowpass"; f.Q.value = q || 1; f.frequency.setValueAtTime(f1, t0); f.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(destino || efeitos); s.start(t0); s.stop(t0 + dur + 0.03);
  }
  const nota = function(n) { return 440 * Math.pow(2, (n - 69) / 12); };   // MIDI -> Hz

  // ---------- receitas ----------
  const EF = {
    botao: function(k) {   // "clunk" grave do botão grande
      osc("sine", 170 * k, 52, 0.16, 0.5, 0, 0.002);
      osc("square", 1300 * k, 900, 0.025, 0.08);
      chiado(1400, 300, 0.07, 0.28, 0, "lowpass");
    },
    time: function(k) { osc("triangle", 900 * k, 760 * k, 0.05, 0.06); },
    clique: function() { osc("square", 1100, 1000, 0.03, 0.05); chiado(5000, 3000, 0.02, 0.05, 0, "highpass"); },
    encaixe: function() { chiado(2400, 900, 0.05, 0.25, 0, "bandpass", 2); osc("sine", 320, 210, 0.07, 0.25); },
    criar: function() { osc("sawtooth", 180, 620, 0.16, 0.06, 0, 0.01, 8); osc("triangle", 1318, 1318, 0.3, 0.13, 0.13, 0.002, 6); osc("triangle", 1975, 1975, 0.25, 0.06, 0.16); },
    abrir: function() { osc("sine", 380, 950, 0.09, 0.28); chiado(3000, 1200, 0.08, 0.15, 0, "bandpass", 1.5); [1568, 2093, 2637].forEach(function(f, i) { osc("triangle", f, f, 0.12, 0.08, 0.06 + i * 0.045); }); },
    juntar: function(k) {   // arpejo maior que sobe com o nível do robô (k = 1 + nível·0,03)
      const base = 60 + Math.round((k - 1) / 0.03) % 12;
      [0, 4, 7, 12].forEach(function(s, i) { osc("square", nota(base + s), nota(base + s), 0.13, 0.07, i * 0.055, 0.003, 7); osc("triangle", nota(base + s + 12), nota(base + s + 12), 0.16, 0.05, i * 0.055); });
      chiado(7000, 4000, 0.25, 0.05, 0.18, "highpass");
    },
    descobrir: function() {
      [[72, 0], [76, 0.1], [79, 0.2], [84, 0.32]].forEach(function(n) { osc("square", nota(n[0]), nota(n[0]), n[1] > 0.3 ? 0.45 : 0.12, 0.08, n[1], 0.003, 8); osc("triangle", nota(n[0] - 12), nota(n[0] - 12), 0.18, 0.08, n[1]); });
      chiado(9000, 5000, 0.5, 0.06, 0.32, "highpass");
    },
    compra: function() { osc("square", 1318, 1318, 0.06, 0.07); osc("square", 1975, 1975, 0.18, 0.07, 0.06); chiado(8000, 6000, 0.12, 0.06, 0.06, "highpass"); },
    erro: function() { osc("sawtooth", 150, 120, 0.09, 0.08); osc("sawtooth", 150, 110, 0.12, 0.08, 0.11); },
    lutar: function() { osc("sawtooth", 220, 440, 0.25, 0.07, 0, 0.02, 10); osc("sine", 120, 40, 0.3, 0.4, 0); chiado(2000, 400, 0.25, 0.15, 0); },
    vitoria: function() { [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.5], [84, 0.62]].forEach(function(n, i) { osc("square", nota(n[0]), nota(n[0]), i === 5 ? 0.6 : 0.13, 0.08, n[1], 0.003, 8); }); },
    derrota: function() { [[67, 0], [63, 0.2], [60, 0.4], [55, 0.6]].forEach(function(n, i) { osc("triangle", nota(n[0]), nota(n[0]) * (i === 3 ? 0.9 : 1), i === 3 ? 0.7 : 0.2, 0.1, n[1]); }); },
    renascer: function() {
      osc("sine", 110, 1760, 1.2, 0.12, 0, 0.1); osc("sawtooth", 220, 3520, 1.2, 0.04, 0.05, 0.1, 15);
      [60, 64, 67, 72].forEach(function(n) { osc("triangle", nota(n), nota(n), 1.4, 0.08, 1.1, 0.02, 6); });
      chiado(9000, 2000, 1.6, 0.06, 0.2, "highpass");
    },
    // ---- curto-circuito do renascer (curto.js) ----
    faisca: function() { chiado(9000, 3500, 0.035, 0.14, 0, "highpass"); osc("square", 1800 + Math.random() * 2600, 600, 0.025, 0.035); },
    zumbido: function(k) {   // k = duração em segundos: zumbido elétrico que sobe
      osc("sawtooth", 55, 95, k, 0.07, 0, 0.3, 14); osc("square", 110, 190, k, 0.025, 0, 0.3);
      chiado(1200, 4000, k, 0.05, 0, "bandpass", 4);
    },
    alarme: function() { osc("square", 880, 880, 0.16, 0.05); osc("square", 660, 660, 0.16, 0.05, 0.17); },
    carga: function() { osc("sine", 180, 2600, 0.45, 0.12, 0, 0.05); osc("sawtooth", 90, 1300, 0.45, 0.04, 0, 0.05, 20); chiado(400, 9000, 0.45, 0.08, 0, "bandpass", 5); },
    explosao: function() {
      osc("sine", 90, 24, 1.3, 0.8, 0, 0.002); osc("square", 70, 28, 0.5, 0.18, 0, 0.002);
      chiado(3500, 60, 1.6, 0.7, 0, "lowpass"); chiado(9000, 700, 0.45, 0.3, 0, "bandpass", 0.8);
      for (let i = 0; i < 5; i++) chiado(5000, 1500, 0.06, 0.12, 0.25 + i * 0.13 + Math.random() * 0.06, "highpass");   // estalinhos depois do estouro
    },
    // ---- v4: missão, robô novo, robô dourado ----
    missao: function() {   // caixa registradora + acorde maior subindo
      chiado(6000, 2500, 0.06, 0.18, 0, "bandpass", 2); osc("square", 2637, 2637, 0.05, 0.06, 0.02);
      [[67, 0.08], [72, 0.16], [76, 0.24], [79, 0.32]].forEach(function(n, i) { osc("square", nota(n[0]), nota(n[0]), i === 3 ? 0.4 : 0.12, 0.07, n[1], 0.003, 8); osc("triangle", nota(n[0] - 12), nota(n[0] - 12), 0.15, 0.08, n[1]); });
      chiado(9000, 6000, 0.4, 0.05, 0.32, "highpass");
    },
    revela: function() {   // fanfarra: subida + acorde longo com brilho
      osc("sawtooth", 200, 900, 0.28, 0.05, 0, 0.02, 12); chiado(500, 6000, 0.3, 0.06, 0, "bandpass", 2);
      [[60, 0.28], [64, 0.36], [67, 0.44], [72, 0.52]].forEach(function(n) { osc("square", nota(n[0]), nota(n[0]), 0.12, 0.07, n[1], 0.003, 8); });
      [72, 76, 79, 84].forEach(function(n) { osc("triangle", nota(n), nota(n), 0.9, 0.07, 0.62, 0.01, 6); osc("square", nota(n - 12), nota(n - 12), 0.7, 0.025, 0.62, 0.01); });
      osc("sine", 110, 55, 0.5, 0.35, 0.6); chiado(10000, 7000, 0.9, 0.06, 0.62, "highpass");
    },
    ouro_aparece: function() { [88, 91, 96, 100].forEach(function(n, i) { osc("triangle", nota(n), nota(n), 0.1, 0.05, i * 0.05); }); },
    ouro: function() {
      [[84, 0], [88, 0.06], [91, 0.12], [96, 0.18], [100, 0.24]].forEach(function(n) { osc("square", nota(n[0]), nota(n[0]), 0.1, 0.05, n[1], 0.003, 6); osc("triangle", nota(n[0] + 12), nota(n[0] + 12), 0.2, 0.04, n[1] + 0.02); });
      chiado(10000, 6000, 0.5, 0.07, 0.1, "highpass");
    },
    tiro: function(k) { osc("square", 1400 * k, 320, 0.07, 0.035); },
    acerto: function() { chiado(1800, 400, 0.06, 0.08, 0, "bandpass", 1.2); },
    hab_missil: function() { chiado(800, 4000, 0.4, 0.12, 0, "bandpass", 1); osc("sine", 90, 28, 0.6, 0.5, 0.38); chiado(1500, 80, 0.7, 0.35, 0.38); },
    hab_choque: function() { osc("sawtooth", 2400, 90, 0.25, 0.08, 0, 0.002, 30); for (let i = 0; i < 6; i++) chiado(6000, 3000, 0.03, 0.12, i * 0.04, "highpass"); },
    hab_conserto: function() { [72, 76, 79, 84, 88].forEach(function(n, i) { osc("triangle", nota(n), nota(n), 0.25, 0.07, i * 0.07); }); chiado(9000, 6000, 0.6, 0.04, 0.1, "highpass"); },
    hab_sobrecarga: function() { osc("sawtooth", 90, 1700, 0.6, 0.07, 0, 0.02, 20); osc("square", 180, 3400, 0.6, 0.03, 0.05); chiado(300, 5000, 0.6, 0.08, 0, "bandpass", 3); }
  };
  function som(nome, k) {
    if (save.mudo || pausado || !a || a.state !== "running" || !EF[nome]) return;
    const agora = a.currentTime;
    if (ultimo[nome] && agora - ultimo[nome] < 0.04) return;
    ultimo[nome] = agora;
    try { EF[nome](k || 1); } catch (e) { /* som nunca trava o jogo */ }
  }

  // ---------- música (v7): várias músicas, compostas na hora a partir de uma "partitura" curta ----------
  // Cada música: tom, escala, andamento, progressões da parte A e B (algarismos romanos), padrões de bateria e baixo,
  // timbre da melodia. A melodia é escrita por um gerador com semente fixa (sempre igual para a mesma música): motivo
  // de 2 compassos repetido e variado, notas do acorde nos tempos fortes, passos da escala no meio, termina na tônica.
  // Forma: intro (2) + A (8) + B (8) + A' com contramelodia (8) + final (2) = 28 compassos (~1 min); depois troca de
  // música (sorteia outra da lista, sem repetir a mesma). Na batalha, a lista de batalha.
  const ESCALAS = { maior: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10], dorica: [0, 2, 3, 5, 7, 9, 10], harmonica: [0, 2, 3, 5, 7, 8, 11], mixo: [0, 2, 4, 5, 7, 9, 10] };
  const MUSICAS = {
    jogo: [
      { nome: "fabrica", tom: 57, esc: "menor", bpm: 112, A: "i VI III VII", B: "iv i VII V", lead: "square", sem: 11,
        bumbo: "x...x...x...x...", caixa: "....x.......x...", chimbal: "..x...x...x...x.", aberto: "..............x.", baixo: "R.R.R.8.R.R.5.R." },
      { nome: "engrenagens", tom: 60, esc: "maior", bpm: 122, A: "I V vi IV", B: "IV I ii V", lead: "square", sem: 23, swing: 0.12,
        bumbo: "x.....x.x.......", caixa: "....x.......x...", chimbal: "x.x.x.x.x.x.x.x.", aberto: "......x.......x.", baixo: "R..R..5.R..R..8." },
      { nome: "turno da noite", tom: 62, esc: "dorica", bpm: 92, A: "i IV i VII", B: "III VII iv V", lead: "triangle", sem: 37, calmo: true,
        bumbo: "x.......x..x....", caixa: "....x.......x...", chimbal: "..x...x...x...x.", aberto: "................", baixo: "R.......5...R.8." },
      { nome: "linha de montagem", tom: 64, esc: "menor", bpm: 130, A: "i VII VI VII", B: "iv v i i", lead: "sawtooth", sem: 51,
        bumbo: "x...x...x...x...", caixa: "....x..x....x...", chimbal: "xxxxxxxxxxxxxxxx", aberto: "..x...x...x...x.", baixo: "RRR8RRR8RRR5RRR8" },
      { nome: "hora do lucro", tom: 65, esc: "maior", bpm: 116, A: "I iii IV V", B: "vi IV I V", lead: "square", sem: 67, swing: 0.08,
        bumbo: "x..x..x.x..x....", caixa: "....x.......x...", chimbal: "..x.x.x...x.x.x.", aberto: "......x.......x.", baixo: "R.8.R.5.R.8.5.8." }
    ],
    batalha: [
      { nome: "horda", tom: 57, esc: "harmonica", bpm: 140, A: "i VI iv V", B: "i iv VI V", lead: "sawtooth", sem: 79,
        bumbo: "x..x..x.x..x..x.", caixa: "....x.......x..x", chimbal: "xxxxxxxxxxxxxxxx", aberto: "..............x.", baixo: "RRRRRRRRRRRR8888" },
      { nome: "chefao", tom: 62, esc: "harmonica", bpm: 150, A: "i i VI VII", B: "iv V i V", lead: "square", sem: 97,
        bumbo: "x.x.x.x.x.x.x.x.", caixa: "....x.......x.x.", chimbal: "x.xxx.xxx.xxx.xx", aberto: "..x...x...x...x.", baixo: "R8R8R8R8R8R8R858" },
      { nome: "ataque final", tom: 64, esc: "menor", bpm: 146, A: "i VI VII i", B: "iv VII III V", lead: "sawtooth", sem: 113,
        bumbo: "x..x..x...x..x..", caixa: "....x.......x...", chimbal: "xxxxxxxxxxxxxxxx", aberto: "......x.......x.", baixo: "RR.RR.R.RR.RR.58" }
    ]
  };
  const ROM = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };
  // acorde: [fundamental, terça, quinta] em MIDI (minúsculo = menor, maiúsculo = maior; graus pela escala da música)
  function acorde(m, r) {
    const sc = ESCALAS[m.esc === "harmonica" ? "menor" : m.esc], g = ROM[r.toLowerCase()], raiz = m.tom + sc[g] - 12;
    const maior = r !== r.toLowerCase();
    return [raiz, raiz + (maior ? 4 : 3), raiz + 7];
  }
  // compõe a música inteira em eventos por semicolcheia: {passo: [eventos]}
  const cachePartitura = {};
  function compor(m) {
    if (cachePartitura[m.nome]) return cachePartitura[m.nome];
    const rnd = semente(m.sem), sc = ESCALAS[m.esc], ev = [], N = 28 * 16;
    for (let i = 0; i < N; i++) ev.push([]);
    const secoes = [["intro", 2, m.A], ["A", 8, m.A], ["B", 8, m.B], ["A2", 8, m.A], ["fim", 2, m.A]];
    // notas da escala em várias oitavas (para andar na melodia)
    const escala = []; for (let o = -1; o <= 2; o++) sc.forEach(function(x) { escala.push(m.tom + 12 * o + x); });
    const perto = function(alvo) { let b = 0; for (let k = 1; k < escala.length; k++) if (Math.abs(escala[k] - alvo) < Math.abs(escala[b] - alvo)) b = k; return b; };
    // ritmos da melodia (16 passos; "x" começa nota) — o motivo usa 2 e varia
    const RITMOS = ["x.x.x...x.x.x...", "x...x.x.x...x...", "x.xx..x.x...x.x.", "x..x..x.x.x.....", "x.x.x.x.x...x...", "x...x...x.xxx...", "..x.x.x.x...x..."];
    function frase(prog, compassos, varia) {
      const out = []; let pos = perto(m.tom + 12 + (m.calmo ? 0 : 4));
      const r1 = RITMOS[Math.floor(rnd() * RITMOS.length)], r2 = RITMOS[Math.floor(rnd() * RITMOS.length)];
      const contorno = []; for (let k = 0; k < 8; k++) contorno.push(Math.floor(rnd() * 5) - 2);
      for (let c = 0; c < compassos; c++) {
        const ac = acorde(m, prog[c % prog.length]), ritmo = (c % 4 === 3) ? "x.......x.......".replace(/x/g, function(x, i) { return i === 8 && rnd() < 0.5 ? "." : x; }) : (c % 2 ? r2 : r1);
        let k = 0;
        for (let s = 0; s < 16; s++) {
          if (ritmo[s] !== "x") continue;
          let alvoNota;
          if (s % 8 === 0) {   // tempo forte: nota do acorde mais perto
            const tons = []; ac.forEach(function(n) { for (let o = 1; o <= 2; o++) tons.push(n + 12 * o); });
            const atual = escala[pos]; alvoNota = tons.reduce(function(a, b) { return Math.abs(b - atual) < Math.abs(a - atual) ? b : a; });
            if (c % 4 === 3 && s === 0) alvoNota = ac[0] + 24;   // fim da frase: tônica do acorde
            pos = perto(alvoNota);
          } else { pos = Math.max(7, Math.min(escala.length - 2, pos + contorno[(k + c * 3 + (varia ? 1 : 0)) % 8])); }
          let dur = 1; while (s + dur < 16 && ritmo[s + dur] !== "x" && dur < 6) dur++;
          out.push({ p: c * 16 + s, n: escala[pos], d: dur });
          k++;
        }
      }
      return out;
    }
    const melA = frase(m.A.split(" "), 8, false), melB = frase(m.B.split(" "), 8, true);
    let base = 0;
    secoes.forEach(function(sec) {
      const nome = sec[0], nc = sec[1], prog = sec[2].split(" ");
      for (let c = 0; c < nc; c++) {
        const ac = acorde(m, prog[c % prog.length]), b0 = base + c * 16, ultimo = c === nc - 1 && nome !== "intro";
        // bateria (a última batida da seção vira uma virada)
        for (let s = 0; s < 16; s++) {
          const e = ev[b0 + s];
          if (nome === "fim" && c === 1 && s > 0) break;
          if (ultimo && s >= 12) { e.push({ t: "caixa", v: 0.6 + (s - 12) * 0.1 }); if (s % 2 === 0) e.push({ t: "tom", n: 52 - (s - 12) * 2 }); continue; }
          if (m.bumbo[s] === "x") e.push({ t: "bumbo" });
          if (m.caixa[s] === "x" && !(nome === "intro" && c === 0)) e.push({ t: "caixa", v: 1 });
          if (m.chimbal[s] === "x" && nome !== "intro") e.push({ t: "chimbal" });
          if (m.aberto[s] === "x" && nome !== "intro") e.push({ t: "aberto" });
          if (s === 0 && c === 0 && nome !== "intro") e.push({ t: "prato" });
        }
        // baixo
        for (let s = 0; s < 16; s++) {
          const q = m.baixo[s]; if (q === ".") continue;
          const n = ac[0] - 12 + (q === "8" ? 12 : q === "5" ? 7 : 0);
          let d = 1; while (s + d < 16 && m.baixo[s + d] === "." && d < 4) d++;
          ev[b0 + s].push({ t: "baixo", n: n, d: d });
        }
        // acorde de fundo (pad) e arpejo
        ev[b0].push({ t: "pad", ac: ac, d: 16 });
        if (nome !== "intro") for (let s = 0; s < 16; s += (m.calmo ? 2 : 1)) { const n = ac[[0, 1, 2, 1][s % 4]] + 12 + (s >= 8 ? 12 : 0); ev[b0 + s].push({ t: "arpejo", n: n }); }
      }
      // melodia
      if (nome === "A" || nome === "A2" || nome === "B") {
        const mel = nome === "B" ? melB : melA;
        mel.forEach(function(x) { ev[base + x.p].push({ t: "lead", n: x.n + (nome === "A2" && x.p >= 64 ? 12 : 0), d: x.d }); });
        if (nome === "A2") melA.forEach(function(x) { if (x.p % 8 === 0) ev[base + x.p].push({ t: "contra", n: x.n - 5, d: Math.max(2, x.d) }); });   // contramelodia
      }
      base += nc * 16;
    });
    return (cachePartitura[m.nome] = ev);
  }
  // timbres
  function lead(tipo, f, dur, vol, at, m) {
    const t0 = a.currentTime + at, g = a.createGain(), o = a.createOscillator(), filtro = a.createBiquadFilter();
    o.type = tipo; o.frequency.setValueAtTime(f, t0);
    filtro.type = "lowpass"; filtro.frequency.value = tipo === "sawtooth" ? 2400 : 5000;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.012); g.gain.setValueAtTime(vol * 0.8, t0 + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    if (dur > 0.25) {   // vibrato depois de um tempinho nas notas longas
      const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(f * 0.012, t0 + 0.25);
      lfo.connect(lg).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.1);
    }
    o.connect(filtro).connect(g).connect(m); o.start(t0); o.stop(t0 + dur + 0.1);
  }
  function pad(ac, dur, at, m) {
    const t0 = a.currentTime + at, g = a.createGain(), filtro = a.createBiquadFilter();
    filtro.type = "lowpass"; filtro.frequency.setValueAtTime(700, t0); filtro.frequency.linearRampToValueAtTime(1300, t0 + dur * 0.5); filtro.frequency.linearRampToValueAtTime(800, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.028, t0 + 0.25); g.gain.setValueAtTime(0.028, t0 + dur - 0.2); g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.1);
    filtro.connect(g).connect(m);
    ac.forEach(function(n) { [-7, 7].forEach(function(det) { const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.value = nota(n + 12); o.detune.value = det; o.connect(filtro); o.start(t0); o.stop(t0 + dur + 0.15); }); });
  }

  let lista = "jogo", atual = null, ultimaNome = "", proximo = 0, passo = 0, timerMusica = 0;
  function escolher() {
    const l = MUSICAS[lista].filter(function(m) { return m.nome !== ultimaNome; });
    atual = l[Math.floor(Math.random() * l.length)]; ultimaNome = atual.nome; passo = 0;
  }
  function iniciarMusica() {
    if (timerMusica) return;
    escolher();
    proximo = a.currentTime + 0.1;
    timerMusica = setInterval(agendar, 30);
  }
  function agendar() {
    if (!a || a.state !== "running") return;
    while (proximo < a.currentTime + 0.12) {
      const ev = compor(atual), dur16 = 60 / atual.bpm / 4;
      const swing = (passo % 2 === 1 && atual.swing) ? dur16 * atual.swing : 0;
      if (!save.semMusica) ev[passo].forEach(function(e) { tocarEvento(e, proximo - a.currentTime + swing, dur16); });
      proximo += dur16; passo++;
      if (passo >= ev.length) escolher();   // acabou: próxima música
    }
  }
  function tocarEvento(e, at, d) {
    const m = musicaBus;
    if (at < 0) return;
    switch (e.t) {
      case "bumbo": osc("sine", 160, 40, 0.18, 0.55, at, 0.002, 0, m); chiado(1200, 200, 0.03, 0.12, at, "lowpass", 1, m); break;
      case "caixa": chiado(2400, 800, 0.13, 0.2 * e.v, at, "bandpass", 0.8, m); osc("triangle", 230, 170, 0.06, 0.07 * e.v, at, 0.002, 0, m); break;
      case "chimbal": chiado(9500, 7500, 0.03, 0.05, at, "highpass", 1, m); break;
      case "aberto": chiado(8500, 6000, 0.16, 0.045, at, "highpass", 1, m); break;
      case "prato": chiado(9000, 4000, 0.9, 0.06, at, "highpass", 0.7, m); break;
      case "tom": osc("sine", nota(e.n), nota(e.n - 5), 0.18, 0.22, at, 0.002, 0, m); break;
      case "baixo": osc(atual.calmo ? "triangle" : "square", nota(e.n), nota(e.n), d * e.d * 0.92, atual.calmo ? 0.16 : 0.09, at, 0.004, 0, m); break;
      case "arpejo": osc("triangle", nota(e.n), nota(e.n), d * 0.8, atual.calmo ? 0.045 : 0.032, at, 0.003, 0, m); break;
      case "pad": pad(e.ac, d * e.d, at, m); break;
      case "lead": lead(atual.lead, nota(e.n), d * e.d * 0.95, atual.lead === "sawtooth" ? 0.04 : atual.lead === "triangle" ? 0.09 : 0.05, at, m); break;
      case "contra": lead("triangle", nota(e.n), d * e.d * 0.95, 0.045, at, m); break;
    }
  }
  function musica(qual) { if (MUSICAS[qual] && qual !== lista) { lista = qual; if (a) { escolher(); proximo = a.currentTime + 0.05; } } }
  let abafada = false;
  function atualizarMusica() { if (musicaBus) musicaBus.gain.setTargetAtTime(save.semMusica ? 0 : (abafada ? 0.08 : 0.9), a.currentTime, abafada ? 0.25 : 0.1); }
  function abafar(sim) { abafada = !!sim; atualizarMusica(); }   // música quase some durante o curto-circuito

  return { som: som, musica: musica, atualizarMusica: atualizarMusica, abafar: abafar };
})();
