"use strict";

// =========================
// SOM (Web Audio, sem arquivos). Som.som("botao") toca um efeito. Liga só depois da 1ª interação (regra dos
// navegadores), fica mudo durante anúncios e respeita save.mudo. O mesmo som não repete em menos de 45 ms
// (o time apertando junto não vira uma parede de barulho).
// =========================
const Som = (function() {
  let a = null, mestre = null, ruido = null, pausado = false;
  const ultimo = {};
  function ligar() {
    if (a) { if (a.state === "suspended" && !pausado) a.resume(); return; }
    try {
      a = new (window.AudioContext || window.webkitAudioContext)();
      mestre = a.createGain(); mestre.gain.value = 0.5;
      const comp = a.createDynamicsCompressor(); mestre.connect(comp).connect(a.destination);
      ruido = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
      const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { a = null; }
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function(ev) { window.addEventListener(ev, ligar, { capture: true, passive: true }); });
  Poki.aoAnuncio(function(aberto) {
    pausado = aberto; if (!a) return;
    if (aberto && a.state === "running") a.suspend(); else if (!aberto && a.state === "suspended") a.resume();
  });
  let af = 1;
  function tom(tipo, f1, f2, dur, vol, atraso) {
    const t0 = a.currentTime + (atraso || 0), o = a.createOscillator(), g = a.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f1 * af, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2 * af), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(mestre); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function chiado(freq, dur, vol, atraso) {
    const t0 = a.currentTime + (atraso || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = ruido; f.type = "lowpass"; f.frequency.setValueAtTime(freq, t0); f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.2), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(mestre); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  // ["tom", onda, f1, f2, dur, vol, atraso] ou ["ruido", freq, dur, vol, atraso]
  const EF = {
    botao: [["tom", "square", 180, 90, 0.09, 0.12], ["ruido", 1800, 0.05, 0.12]],
    time: [["tom", "triangle", 520, 420, 0.04, 0.035]],
    clique: [["tom", "square", 700, 700, 0.03, 0.04]],
    encaixe: [["tom", "square", 330, 250, 0.05, 0.06]],
    criar: [["tom", "square", 400, 800, 0.08, 0.07], ["tom", "square", 800, 800, 0.05, 0.05, 0.06]],
    juntar: [["tom", "triangle", 523, 523, 0.07, 0.09], ["tom", "triangle", 784, 784, 0.07, 0.09, 0.06], ["tom", "triangle", 1046, 1046, 0.14, 0.09, 0.12]],
    descobrir: [["tom", "square", 523, 523, 0.1, 0.07], ["tom", "square", 659, 659, 0.1, 0.07, 0.1], ["tom", "square", 784, 784, 0.1, 0.07, 0.2], ["tom", "square", 1046, 1046, 0.3, 0.07, 0.3]],
    compra: [["tom", "square", 1318, 1318, 0.05, 0.05], ["tom", "square", 1975, 1975, 0.12, 0.05, 0.05]],
    erro: [["tom", "sawtooth", 140, 110, 0.12, 0.06]],
    lutar: [["tom", "sawtooth", 220, 440, 0.2, 0.06], ["ruido", 2000, 0.15, 0.06]],
    vitoria: [["tom", "square", 523, 523, 0.12, 0.07], ["tom", "square", 659, 659, 0.12, 0.07, 0.12], ["tom", "square", 784, 784, 0.12, 0.07, 0.24], ["tom", "square", 1046, 1046, 0.4, 0.07, 0.36]],
    derrota: [["tom", "triangle", 392, 392, 0.2, 0.08], ["tom", "triangle", 311, 311, 0.2, 0.08, 0.2], ["tom", "triangle", 233, 200, 0.5, 0.08, 0.4]],
    abrir: [["tom", "square", 300, 900, 0.07, 0.06], ["ruido", 2500, 0.08, 0.06]],
    hab_missil: [["tom", "sawtooth", 600, 200, 0.35, 0.06], ["ruido", 1200, 0.5, 0.3, 0.35]],
    hab_choque: [["tom", "square", 90, 70, 0.3, 0.08], ["ruido", 6000, 0.25, 0.1]],
    hab_conserto: [["tom", "triangle", 523, 1046, 0.3, 0.07], ["tom", "triangle", 784, 1568, 0.3, 0.06, 0.12]],
    hab_sobrecarga: [["tom", "sawtooth", 200, 1200, 0.5, 0.06]],
    renascer: [["tom", "sine", 200, 1600, 0.8, 0.08], ["tom", "triangle", 400, 3200, 0.8, 0.05, 0.1], ["ruido", 3000, 0.6, 0.05, 0.2]]
  };
  function som(nome, tomMult) {
    if (save.mudo || pausado || !a || a.state !== "running") return;
    const agora = a.currentTime;
    if (ultimo[nome] && agora - ultimo[nome] < 0.045) return;
    ultimo[nome] = agora; af = tomMult || 1;
    (EF[nome] || []).forEach(function(e) { if (e[0] === "tom") tom(e[1], e[2], e[3], e[4], e[5], e[6]); else chiado(e[1], e[2], e[3], e[4]); });
    af = 1;
  }
  return { som: som };
})();
