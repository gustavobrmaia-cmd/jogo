"use strict";

// =========================
// EFEITOS (canvas por cima de tudo, sem pegar clique): números subindo, moedas pulando e faíscas quadradas.
// Coordenadas em pixels da tela. Limite de partículas para não pesar no celular fraco.
// =========================
const Fx = (function() {
  const cv = el("fx"), g = cv.getContext("2d");
  let dpr = 1, larg = 0, alt = 0;
  const numeros = [], parts = [];
  function redimensionar() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    larg = window.innerWidth; alt = window.innerHeight;
    cv.width = Math.round(larg * dpr); cv.height = Math.round(alt * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
  }
  window.addEventListener("resize", redimensionar);
  redimensionar();

  function numero(x, y, texto, cor, tam) {
    if (numeros.length > 40) numeros.shift();
    numeros.push({ x: x + (Math.random() - 0.5) * 20, y: y, t: 0, texto: texto, cor: cor || "#ffcc33", tam: tam || 26 });
  }
  function moedas(x, y, n) {
    for (let i = 0; i < n && parts.length < 120; i++) parts.push({ tipo: "moeda", x: x, y: y, vx: (Math.random() - 0.5) * 340, vy: -200 - Math.random() * 260, t: 0, vida: 0.9 });
  }
  function faiscas(x, y, cor, n) {
    for (let i = 0; i < n && parts.length < 160; i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
      parts.push({ tipo: "q", x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.5 + Math.random() * 0.3, cor: cor, tam: 4 + Math.floor(Math.random() * 4) });
    }
  }
  function passo(dt) {
    g.clearRect(0, 0, larg, alt);
    // na batalha (tela cheia) os números do botão não aparecem (a cena tem os dela)
    if (typeof CenaBatalha !== "undefined" && CenaBatalha.aberta) { numeros.length = 0; parts.length = 0; return; }
    const moeda = Pixel.icone("moeda");
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt; if (p.t >= p.vida) { parts.splice(i, 1); continue; }
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = Math.min(1, (p.vida - p.t) * 4);
      if (p.tipo === "moeda") g.drawImage(moeda, Math.round(p.x - 10), Math.round(p.y - 10), 20, 20);
      else { g.fillStyle = p.cor; g.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam); }
    }
    g.textAlign = "center"; g.lineJoin = "round";
    for (let i = numeros.length - 1; i >= 0; i--) {
      const n = numeros[i];
      n.t += dt; if (n.t >= 1) { numeros.splice(i, 1); continue; }
      const y = n.y - n.t * 70, k = n.t < 0.12 ? 0.6 + n.t / 0.12 * 0.5 : 1.1 - Math.min(0.1, (n.t - 0.12));
      g.globalAlpha = n.t > 0.7 ? (1 - n.t) / 0.3 : 1;
      g.font = Math.round(n.tam * k) + "px Pixelify, sans-serif";
      g.lineWidth = 6; g.strokeStyle = "#1a1030"; g.strokeText(n.texto, Math.round(n.x), Math.round(y));
      g.fillStyle = n.cor; g.fillText(n.texto, Math.round(n.x), Math.round(y));
    }
    g.globalAlpha = 1;
  }
  return { numero: numero, moedas: moedas, faiscas: faiscas, passo: passo };
})();
