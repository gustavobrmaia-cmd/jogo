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
      musicaBus = a.createGain(); musicaBus.gain.value = save.semMusica ? 0 : 0.26; musicaBus.connect(mestre);
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

  // ---------- música ----------
  // acordes por compasso (graus em MIDI) e padrões de 16 passos; "jogo" calmo, "batalha" mais rápida e tensa
  const TRILHAS = {
    jogo: { bpm: 112, acordes: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 56, 59]],
      bumbo: "x...x...x...x...", caixa: "....x.......x...", chimbal: "..x...x...x...x.", baixo: "x.x.x.x.x.x.x.xx",
      melodia: [76, 0, 79, 0, 81, 0, 79, 76, 74, 0, 72, 0, 74, 0, 76, 0] },
    batalha: { bpm: 138, acordes: [[57, 60, 64], [57, 60, 64], [58, 62, 65], [56, 59, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62], [56, 59, 64]],
      bumbo: "x..x..x.x..x..x.", caixa: "....x.......x..x", chimbal: "xxxxxxxxxxxxxxxx", baixo: "xxxxxxxxxxxxxxxx",
      melodia: [81, 0, 81, 84, 0, 81, 0, 79, 81, 0, 76, 0, 77, 0, 76, 74] }
  };
  let trilha = "jogo", proximo = 0, passo = 0, timerMusica = 0;
  function iniciarMusica() {
    if (timerMusica) return;
    proximo = a.currentTime + 0.1; passo = 0;
    timerMusica = setInterval(agendar, 30);
  }
  function agendar() {
    if (!a || a.state !== "running") return;
    const T = TRILHAS[trilha], dur16 = 60 / T.bpm / 4;
    while (proximo < a.currentTime + 0.12) {
      tocarPasso(T, passo, proximo - a.currentTime, dur16);
      proximo += dur16; passo = (passo + 1) % (16 * T.acordes.length);
    }
  }
  function tocarPasso(T, p, at, d) {
    if (save.semMusica) return;
    const s = p % 16, compasso = Math.floor(p / 16), ac = T.acordes[compasso], m = musicaBus;
    if (T.bumbo[s] === "x") { osc("sine", 150, 42, 0.16, 0.55, at, 0.002, 0, m); }
    if (T.caixa[s] === "x") { chiado(2200, 700, 0.12, 0.22, at, "bandpass", 0.8, m); osc("triangle", 220, 160, 0.06, 0.08, at, 0.002, 0, m); }
    if (T.chimbal[s] === "x") chiado(9000, 7000, 0.035, 0.07, at, "highpass", 1, m);
    if (T.baixo[s] === "x") { const n = ac[0] - 24 + (s % 8 === 6 ? 12 : 0); osc("square", nota(n), nota(n), d * 0.9, 0.11, at, 0.004, 0, m); }
    // arpejo do acorde em semicolcheias
    const an = ac[s % 3] + 12 * (Math.floor(s / 3) % 2); osc("triangle", nota(an), nota(an), d * 0.8, 0.05, at, 0.003, 0, m);
    // melodia só na 2ª metade da volta (respira)
    if (compasso >= T.acordes.length / 2 && T.melodia[s]) { const n = T.melodia[s] - (compasso % 2 ? 0 : 2); osc("square", nota(n), nota(n), d * 1.7, 0.05, at, 0.006, 9, m); }
  }
  function musica(qual) { if (TRILHAS[qual] && qual !== trilha) { trilha = qual; passo = 0; } }
  function atualizarMusica() { if (musicaBus) musicaBus.gain.setTargetAtTime(save.semMusica ? 0 : 0.26, a.currentTime, 0.1); }

  return { som: som, musica: musica, atualizarMusica: atualizarMusica };
})();
