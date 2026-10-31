"use strict";

// =========================
// PIXEL ART (tudo desenhado por código, sem arquivos de imagem)
// Cada sprite é montado numa "folha" pequena (32x32 os robôs e monstros, 64x64 o botão, 16x16 os ícones), com
// peças e cores escolhidas pelo número (o robô 7 é sempre o mesmo). Depois de montar, duas passadas dão o acabamento:
//   - sombreado: pixel com vazio em cima fica mais claro, com vazio embaixo mais escuro (luz de cima);
//   - contorno: todo vazio encostado no desenho vira contorno escuro (#1a1030).
// Cores "acesas" (olhos, luzes, fogo) não recebem sombra. Na tela o sprite é ampliado sem borrar
// (image-rendering: pixelated), então fica nítido em qualquer resolução.
// API: Pixel.robo(n), Pixel.monstro(id), Pixel.botao(apertado), Pixel.icone(nome) -> canvas;
//      Pixel.url(canvas) -> dataURL guardado; Pixel.sombra(canvas) -> silhueta (compêndio).
// =========================

const Pixel = (function() {
  const TINTA = "#1a1030";
  const acesas = new Set();

  // ---------- cores ----------
  function hsl(h, s, l) { return "hsl(" + Math.round((h % 360 + 360) % 360) + "," + s + "%," + l + "%)"; }
  const cacheRgb = {};
  function rgb(c) {
    if (cacheRgb[c]) return cacheRgb[c];
    const k = document.createElement("canvas").getContext("2d");
    k.fillStyle = c; const h = k.fillStyle;   // normaliza para #rrggbb
    const v = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    return (cacheRgb[c] = v);
  }
  function ajustar(c, f) {   // f > 0 clareia, f < 0 escurece
    const v = rgb(c);
    return "rgb(" + v.map(function(x) { return Math.round(f > 0 ? x + (255 - x) * f : x * (1 + f)); }).join(",") + ")";
  }
  function acesa(c) { acesas.add(c); return c; }

  // ---------- folha ----------
  function Folha(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
  Folha.prototype.set = function(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; };
  Folha.prototype.get = function(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.p[y * this.w + x] : null; };
  Folha.prototype.rect = function(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); };
  Folha.prototype.elip = function(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.set(x, y, c);
    }
  };
  Folha.prototype.circ = function(cx, cy, r, c) { this.elip(cx, cy, r, r, c); };
  // espelhado no meio (para robôs simétricos): desenha em x e no lado oposto
  Folha.prototype.sim = function(x, y, w, h, c) { this.rect(x, y, w, h, c); this.rect(this.w - x - w, y, w, h, c); };
  Folha.prototype.simPx = function(x, y, c) { this.set(x, y, c); this.set(this.w - 1 - x, y, c); };
  Folha.prototype.linha = function(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
  };

  // sombreado + contorno e vira canvas
  function finalizar(f, semContorno) {
    const sombra = f.p.slice();
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const c = f.p[y * f.w + x];
      if (!c || acesas.has(c)) continue;
      const cima = f.get(x, y - 1), baixo = f.get(x, y + 1), esq = f.get(x - 1, y);
      if (!cima) sombra[y * f.w + x] = ajustar(c, 0.28);
      else if (!baixo) sombra[y * f.w + x] = ajustar(c, -0.3);
      else if (!esq) sombra[y * f.w + x] = ajustar(c, 0.1);
    }
    const out = sombra.slice();
    if (!semContorno) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      if (sombra[y * f.w + x]) continue;
      const viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function(d) { const xx = x + d[0], yy = y + d[1]; return xx >= 0 && yy >= 0 && xx < f.w && yy < f.h && sombra[yy * f.w + xx]; });
      if (viz) out[y * f.w + x] = TINTA;
    }
    const cv = document.createElement("canvas");
    cv.width = f.w; cv.height = f.h;
    const g = cv.getContext("2d");
    for (let i = 0; i < out.length; i++) if (out[i]) { g.fillStyle = out[i]; g.fillRect(i % f.w, Math.floor(i / f.w), 1, 1); }
    return cv;
  }

  // ---------- robôs ----------
  function paleta(n) {
    const h = n * 47 + 200, s = n >= 20 ? 70 : 58;
    return {
      base: hsl(h, s, 56), escuro: hsl(h, s - 6, 38), claro: hsl(h, s + 10, 74),
      metal: "#b9c1d9", metalE: "#7b84a6", ouro: "#ffcc33",
      luz: acesa(hsl(h + 150, 90, 62)), luz2: acesa(hsl(h + 150, 100, 82)), branco: acesa("#ffffff"), pupila: acesa("#141a2e")
    };
  }
  const cacheRobo = {};
  function robo(n) {
    if (cacheRobo[n]) return cacheRobo[n];
    const f = new Folha(32, 32), P = paleta(n);
    const pernas = (n - 1) % 5, cabeca = Math.floor((n - 1) / 5) % 5, olhos = (n * 2) % 5;
    const corpo = (n - 1 + Math.floor((n - 1) / 5)) % 4, bracos = (n * 3 + Math.floor(n / 7)) % 5, antena = (n * 7 + 2) % 5;
    // asas (nível 20+), atrás de tudo
    if (n >= 20) for (let k = 0; k < 6; k++) { f.rect(3 + k, 10 + k, 1, 9 - k, P.claro); f.rect(28 - k, 10 + k, 1, 9 - k, P.claro); }
    // pernas
    if (pernas === 0) { f.rect(10, 25, 12, 2, P.metalE); f.circ(11.5, 27.5, 2.6, "#3a3f58"); f.circ(20.5, 27.5, 2.6, "#3a3f58"); f.set(11, 27, P.metal); f.set(20, 27, P.metal); }
    else if (pernas === 1) { f.sim(11, 24, 3, 5, P.metal); f.sim(10, 29, 5, 2, P.escuro); }
    else if (pernas === 2) { f.rect(9, 25, 14, 5, "#3a3f58"); for (let x = 10; x < 22; x += 2) f.rect(x, 26, 1, 3, "#5d6380"); }
    else if (pernas === 3) { f.rect(12, 24, 8, 3, P.metalE); f.rect(13, 27, 6, 2, acesa("#ffa53d")); f.rect(14, 29, 4, 1, acesa("#ffe36b")); }
    else { for (let y = 24; y < 29; y++) f.set(y % 2 ? 15 : 16, y, P.metal); f.rect(11, 29, 10, 2, P.escuro); }
    // braços
    if (bracos === 0) { f.sim(7, 17, 3, 5, P.metal); f.sim(6, 22, 4, 2, P.escuro); }
    else if (bracos === 1) { f.sim(7, 17, 3, 4, P.metal); f.sim(5, 21, 2, 3, P.escuro); f.sim(8, 21, 2, 3, P.escuro); }
    else if (bracos === 2) { f.sim(5, 18, 5, 3, P.metalE); f.sim(4, 18, 1, 3, P.escuro); }
    else if (bracos === 3) { f.sim(8, 17, 2, 3, P.metal); f.circ(6.5, 22.5, 2.4, P.escuro); f.circ(25.5, 22.5, 2.4, P.escuro); }
    else { for (let y = 16; y < 22; y++) f.simPx(y % 2 ? 7 : 8, y, P.metal); f.sim(6, 22, 3, 2, P.escuro); }
    // corpo
    if (corpo === 0) f.rect(10, 15, 12, 10, P.base);
    else if (corpo === 1) { f.elip(16, 20, 7.5, 5.8, P.base); }
    else if (corpo === 2) for (let y = 15; y < 25; y++) { const w = 14 - Math.floor((y - 15) * 0.5); f.rect(16 - w / 2, y, w, 1, P.base); }
    else { f.rect(11, 15, 10, 10, P.base); f.rect(10, 17, 12, 6, P.base); }
    // detalhe no peito
    const peito = n % 4;
    if (peito === 0) { f.circ(16, 19.5, 1.8, P.luz); f.set(15, 18, P.luz2); }
    else if (peito === 1) { f.rect(13, 17, 6, 4, "#16233a"); f.set(14, 18, P.luz); f.set(16, 18, P.luz); f.rect(14, 19, 3, 1, P.luz); f.set(15, 20, P.luz); }
    else if (peito === 2) { f.set(11, 16, P.metal); f.set(20, 16, P.metal); f.set(11, 23, P.metal); f.set(20, 23, P.metal); f.rect(14, 18, 4, 3, P.escuro); }
    else { f.rect(11, 19, 10, 2, P.escuro); f.rect(15, 19, 2, 2, P.luz); }
    if (n >= 10) f.rect(11, 24, 10, 1, P.ouro);                       // friso dourado
    if (n >= 15) { f.sim(8, 14, 4, 3, P.escuro); f.sim(8, 14, 4, 1, P.ouro); }   // ombreiras
    // pescoço e cabeça
    f.rect(14, 13, 4, 2, P.metalE);
    if (cabeca === 0) f.rect(10, 5, 12, 9, P.base);
    else if (cabeca === 1) { f.elip(16, 10, 7, 6, P.base); f.rect(9, 10, 14, 4, P.base); }
    else if (cabeca === 2) { f.rect(9, 5, 14, 9, P.metal); f.rect(11, 7, 10, 5, "#16233a"); }
    else if (cabeca === 3) f.circ(16, 9.5, 6, P.base);
    else { f.rect(10, 4, 12, 10, P.base); f.rect(12, 12, 8, 2, P.escuro); }
    // olhos
    if (olhos === 0) { f.rect(12, 8, 3, 3, P.branco); f.rect(17, 8, 3, 3, P.branco); f.set(13, 9, P.pupila); f.set(18, 9, P.pupila); }
    else if (olhos === 1) { f.rect(11, 8, 10, 2, P.luz); f.set(12, 8, P.luz2); }
    else if (olhos === 2) { f.circ(16, 9, 2.7, P.branco); f.circ(16, 9, 1.4, P.luz); f.set(16, 8, P.luz2); }
    else if (olhos === 3) { f.rect(12, 8, 3, 2, P.branco); f.rect(17, 8, 3, 2, P.branco); f.set(12, 7, P.escuro); f.set(13, 7, P.escuro); f.set(18, 7, P.escuro); f.set(19, 7, P.escuro); f.set(14, 9, P.pupila); f.set(17, 9, P.pupila); }
    else { f.rect(12, 8, 2, 2, P.luz); f.rect(18, 8, 2, 2, P.luz); }
    // antena ou coroa (25+)
    if (n >= 25) { f.rect(11, 2, 10, 2, P.ouro); f.set(11, 1, P.ouro); f.set(16, 0, P.ouro); f.set(15, 1, P.ouro); f.set(16, 1, P.ouro); f.set(20, 1, P.ouro); f.set(16, 2, P.luz); }
    else if (antena === 1) { f.rect(16, 2, 1, 3, P.metal); f.circ(16.5, 1.5, 1.4, P.luz); }
    else if (antena === 2) { f.linha(12, 4, 11, 1, P.metal); f.linha(19, 4, 20, 1, P.metal); f.set(11, 0, P.luz); f.set(20, 0, P.luz); }
    else if (antena === 3) { const r = acesa("#ffe14d"); f.set(17, 0, r); f.set(16, 1, r); f.set(15, 2, r); f.set(16, 2, r); f.set(16, 3, r); f.set(15, 4, r); }
    else if (antena === 4) { f.rect(11, 1, 10, 1, P.metal); f.rect(15, 2, 2, 3, P.metalE); }
    return (cacheRobo[n] = finalizar(f));
  }

  // ---------- monstros ----------
  const cacheMonstro = {};
  function monstro(id) {
    if (cacheMonstro[id]) return cacheMonstro[id];
    const z = Math.floor(id / 3), k = id % 3, forma = FORMAS_MONSTRO[id % 9];
    const h = z * 41 + 95 + k * 28;
    const C = { base: hsl(h, 55, 52), escuro: hsl(h, 50, 33), claro: hsl(h, 65, 72), olho: acesa(z >= 6 ? "#ff3b3b" : "#ffffff"),
      pupila: acesa("#141a2e"), osso: "#efe7d6", luz: acesa(hsl(h + 180, 95, 62)) };
    const f = new Folha(32, 32);
    if (forma === "gosma") {
      f.elip(16, 21, 12, 9, C.base); f.rect(4, 22, 24, 7, C.base); f.rect(6, 29, 4, 1, C.base); f.rect(20, 29, 5, 1, C.base);
      f.rect(10, 18, 4, 4, C.olho); f.rect(18, 18, 4, 4, C.olho); f.rect(11, 19, 2, 2, C.pupila); f.rect(19, 19, 2, 2, C.pupila);
      f.rect(13, 25, 6, 1, C.escuro); f.rect(9, 14, 3, 2, C.claro);
    } else if (forma === "morcego") {
      for (let i = 0; i < 9; i++) { f.rect(2 + i, 10 + Math.floor(i / 2), 1, 10 - Math.floor(i / 1.5), C.escuro); f.rect(29 - i, 10 + Math.floor(i / 2), 1, 10 - Math.floor(i / 1.5), C.escuro); }
      f.circ(16, 16, 6.5, C.base); f.rect(11, 8, 2, 4, C.base); f.rect(19, 8, 2, 4, C.base);
      f.rect(13, 14, 2, 2, acesa("#ff4d4d")); f.rect(17, 14, 2, 2, acesa("#ff4d4d")); f.set(14, 19, C.osso); f.set(17, 19, C.osso);
    } else if (forma === "olho") {
      f.circ(16, 14, 10, "#f2ece0"); f.circ(16, 14, 5.5, C.base); f.circ(16, 14, 2.8, C.pupila); f.set(14, 12, acesa("#ffffff"));
      f.set(7, 12, "#e05555"); f.set(8, 13, "#e05555"); f.set(24, 16, "#e05555"); f.set(25, 15, "#e05555");
      for (let i = 0; i < 4; i++) f.rect(10 + i * 4, 24, 2, 5 + (i % 2) * 2, C.escuro);
    } else if (forma === "cogumelo") {
      f.rect(11, 16, 10, 12, "#efe2c4"); f.elip(16, 13, 13, 8, C.base); f.rect(3, 13, 26, 3, C.base);
      f.circ(10, 10, 2, "#ffffff"); f.circ(20, 8, 1.6, "#ffffff"); f.circ(24, 13, 1.5, "#ffffff");
      f.rect(13, 20, 2, 2, C.pupila); f.rect(17, 20, 2, 2, C.pupila); f.rect(14, 24, 4, 1, C.escuro);
    } else if (forma === "fantasma") {
      f.circ(16, 13, 9.5, C.claro); f.rect(7, 13, 19, 13, C.claro);
      for (let x = 7; x < 26; x += 4) f.rect(x, 26, 2, 2, C.claro);
      f.elip(12.5, 13, 2, 3, C.pupila); f.elip(19.5, 13, 2, 3, C.pupila); f.elip(16, 20, 2, 1.5, C.pupila);
    } else if (forma === "caranguejo") {
      for (let i = 0; i < 3; i++) { f.linha(9 - i, 22 + i * 2, 5 - i, 27, C.escuro); f.linha(22 + i, 22 + i * 2, 26 + i, 27, C.escuro); }
      f.elip(16, 20, 10, 6.5, C.base); f.circ(5, 13, 3.6, C.base); f.circ(27, 13, 3.6, C.base); f.rect(4, 11, 2, 2, null); f.rect(26, 11, 2, 2, null);
      f.rect(12, 10, 1, 5, C.escuro); f.rect(19, 10, 1, 5, C.escuro); f.rect(11, 8, 3, 3, C.olho); f.rect(18, 8, 3, 3, C.olho); f.set(12, 9, C.pupila); f.set(19, 9, C.pupila);
    } else if (forma === "caveira") {
      f.circ(16, 13, 9.5, C.osso); f.rect(10, 19, 12, 6, C.osso);
      f.elip(12, 13, 2.6, 3, C.pupila); f.elip(20, 13, 2.6, 3, C.pupila); f.set(12, 13, acesa("#ff4d4d")); f.set(20, 13, acesa("#ff4d4d"));
      f.rect(15, 17, 2, 2, C.pupila); for (let x = 11; x < 21; x += 2) f.rect(x, 22, 1, 3, "#bdb3a0");
      f.rect(14, 26, 4, 3, C.base);
    } else if (forma === "golem") {
      f.rect(7, 11, 18, 15, C.base); f.rect(3, 13, 4, 10, C.escuro); f.rect(25, 13, 4, 10, C.escuro);
      f.rect(11, 4, 10, 8, C.base); f.rect(13, 7, 2, 2, C.luz); f.rect(17, 7, 2, 2, C.luz);
      f.linha(10, 14, 14, 20, C.escuro); f.linha(20, 13, 18, 18, C.escuro); f.rect(9, 26, 5, 3, C.escuro); f.rect(18, 26, 5, 3, C.escuro);
    } else {   // dragão: cabeça de perfil olhando para a esquerda, com asa e chifres
      for (let i = 0; i < 8; i++) f.rect(20 + i, 6 + i, 1, 14 - i, C.escuro);
      f.circ(18, 15, 8, C.base); f.rect(4, 14, 12, 7, C.base); f.rect(4, 21, 10, 2, C.claro);
      f.linha(19, 8, 23, 2, C.osso); f.linha(15, 8, 16, 2, C.osso); f.rect(14, 12, 3, 3, acesa("#ffd23f")); f.set(15, 13, C.pupila);
      f.set(6, 15, C.pupila); f.rect(6, 20, 2, 1, C.osso); f.rect(10, 20, 2, 1, C.osso);
      f.rect(10, 24, 12, 5, C.base);
    }
    // chifres (horda 4+) e coroa (7+) presos no topo do desenho (cada forma tem uma altura)
    const topo = function(x) { for (let y = 0; y < 32; y++) if (f.get(x, y)) return y; return 16; };
    if (z >= 3 && forma !== "dragao") [[11, -1], [20, 1]].forEach(function(c) { const y = topo(c[0]) + 1; f.linha(c[0], y, c[0] + c[1] * 2, y - 5, C.osso); f.set(c[0] + c[1], y - 2, C.osso); });
    if (z >= 6 && forma !== "dragao") { const y = Math.max(2, topo(16) - 2); f.rect(12, y, 8, 2, "#ffcc33"); f.set(12, y - 1, "#ffcc33"); f.set(16, y - 1, "#ffcc33"); f.set(19, y - 1, "#ffcc33"); }
    return (cacheMonstro[id] = finalizar(f));
  }

  // ---------- botão vermelho ----------
  const cacheBotao = {};
  function botao(apertado) {
    const kc = apertado ? 1 : 0;
    if (cacheBotao[kc]) return cacheBotao[kc];
    const f = new Folha(64, 64), d = apertado ? 5 : 0;
    // base de metal
    f.rect(6, 34, 52, 24, "#454b66"); f.rect(8, 32, 48, 28, "#454b66"); f.rect(8, 56, 48, 3, "#2c3048");
    [[10, 36], [52, 36], [10, 54], [52, 54]].forEach(function(p) { f.rect(p[0], p[1], 2, 2, "#9aa3c0"); });
    // anel
    f.elip(32, 40, 24, 13, "#c9d0e3"); f.elip(32, 40, 21, 11, "#7b84a6");
    // cilindro e domo
    f.rect(13, 27 + d, 38, 13 - d, "#a8131d");
    f.elip(32, 40, 19, 8, "#a8131d");
    f.elip(32, 27 + d, 19, 10, apertado ? "#d1232f" : "#ee2a37");
    f.elip(28, 24 + d, 11, 5, apertado ? "#e2414b" : "#ff5a63");
    f.rect(21, 21 + d, 6, 2, acesa("#ffd3d6")); f.rect(19, 23 + d, 3, 1, acesa("#ffd3d6"));
    return (cacheBotao[kc] = finalizar(f));
  }

  // ---------- ícones 16x16 ----------
  const cacheIcone = {};
  function icone(nome) {
    if (cacheIcone[nome]) return cacheIcone[nome];
    const f = new Folha(16, 16);
    const ouro = "#ffcc33", ouroE = "#d9901c";
    switch (nome) {
      case "moeda": f.circ(8, 8, 6.5, ouro); f.circ(8, 8, 4.5, ouroE); f.rect(7, 5, 2, 6, ouro); f.set(6, 4, acesa("#fff6c8")); break;
      case "ph": for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; f.linha(8, 8, 8 + Math.cos(a) * 6.5, 8 + Math.sin(a) * 6.5, "#7cf0ff"); } f.circ(8, 8, 3.5, "#7cf0ff"); f.set(7, 6, acesa("#ffffff")); break;
      case "upgrades": f.rect(6, 7, 4, 8, "#5dd36b"); for (let i = 0; i < 6; i++) f.rect(2 + i, 7 - i, 12 - i * 2, 1, "#5dd36b"); break;
      case "batalha": f.linha(3, 13, 12, 3, "#d6dcf0"); f.linha(4, 13, 13, 3, "#d6dcf0"); f.linha(3, 9, 7, 13, ouroE); f.rect(2, 13, 2, 2, ouroE); break;
      case "compendio": f.rect(3, 2, 11, 13, "#c0563c"); f.rect(4, 3, 9, 11, "#e07a52"); f.rect(3, 2, 2, 13, "#7a2f22"); f.rect(7, 6, 5, 1, "#ffe9c4"); f.rect(7, 8, 4, 1, "#ffe9c4"); break;
      case "config": f.circ(8, 8, 5.5, "#b9c1d9"); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; f.rect(7.5 + Math.cos(a) * 6 - 1, 7.5 + Math.sin(a) * 6 - 1, 2, 2, "#b9c1d9"); } f.circ(8, 8, 2.2, null); break;
      case "renascer": for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 1.6 + 0.6; f.rect(7.5 + Math.cos(a) * 5, 7.5 + Math.sin(a) * 5, 2, 2, "#c084fc"); } f.rect(11, 2, 3, 3, "#c084fc"); f.rect(10, 4, 2, 2, "#c084fc"); break;
      case "dedo": f.rect(7, 2, 3, 8, "#ffd2a8"); f.rect(4, 8, 9, 6, "#ffd2a8"); f.rect(7, 2, 3, 2, "#ffffff"); break;
      case "motor": f.circ(8, 8, 5, "#9aa3c0"); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; f.rect(7.5 + Math.cos(a) * 5.5 - 1, 7.5 + Math.sin(a) * 5.5 - 1, 2, 2, "#9aa3c0"); } f.circ(8, 8, 2, "#ff7a45"); break;
      case "fabrica": f.rect(2, 7, 12, 7, "#a7b0cc"); f.rect(2, 4, 3, 4, "#a7b0cc"); f.rect(6, 5, 4, 2, "#a7b0cc"); f.rect(4, 10, 2, 2, acesa("#ffe36b")); f.rect(8, 10, 2, 2, acesa("#ffe36b")); f.rect(12, 10, 1, 2, acesa("#ffe36b")); f.rect(3, 2, 1, 2, "#dfe3ee"); break;
      case "esteira": f.rect(1, 9, 14, 4, "#5d6380"); for (let x = 2; x < 15; x += 3) f.rect(x, 10, 1, 2, "#9aa3c0"); f.rect(5, 4, 6, 5, "#f2a541"); break;
      case "linha": f.linha(3, 13, 10, 6, "#b9c1d9"); f.linha(4, 13, 11, 6, "#b9c1d9"); f.circ(11, 5, 3, "#b9c1d9"); f.rect(11, 3, 2, 2, null); break;
      case "escudo": f.rect(3, 2, 10, 7, "#4dabf7"); for (let i = 0; i < 5; i++) f.rect(3 + i, 9 + i, 10 - i * 2, 1, "#4dabf7"); f.rect(7, 4, 2, 7, "#ffffff"); break;
      case "video": f.rect(2, 5, 12, 9, "#3a3f58"); f.rect(2, 2, 12, 3, "#ffffff"); for (let x = 3; x < 14; x += 3) f.rect(x, 2, 1, 3, "#3a3f58"); f.rect(6, 7, 1, 5, acesa("#ffffff")); f.rect(7, 8, 1, 3, acesa("#ffffff")); f.set(8, 9, acesa("#ffffff")); break;
      case "cadeado": f.rect(3, 7, 10, 8, "#ffcc33"); f.rect(5, 3, 1, 4, "#b9c1d9"); f.rect(10, 3, 1, 4, "#b9c1d9"); f.rect(5, 2, 6, 1, "#b9c1d9"); f.rect(7, 9, 2, 3, "#5d4a10"); break;
      case "trofeu": f.rect(4, 2, 8, 6, ouro); f.rect(2, 3, 2, 3, ouro); f.rect(12, 3, 2, 3, ouro); f.rect(7, 8, 2, 3, ouroE); f.rect(4, 11, 8, 3, ouroE); f.set(5, 3, acesa("#fff6c8")); break;
    }
    return (cacheIcone[nome] = finalizar(f));
  }

  // silhueta (compêndio: o que ainda não foi descoberto)
  const cacheSombra = new Map();
  function sombra(cv) {
    if (cacheSombra.has(cv)) return cacheSombra.get(cv);
    const s = document.createElement("canvas"); s.width = cv.width; s.height = cv.height;
    const g = s.getContext("2d"); g.drawImage(cv, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "#2a2246"; g.fillRect(0, 0, s.width, s.height);
    cacheSombra.set(cv, s); return s;
  }
  const cacheUrl = new Map();
  function url(cv) { if (!cacheUrl.has(cv)) cacheUrl.set(cv, cv.toDataURL()); return cacheUrl.get(cv); }
  // <img> nítido de um sprite (usado na interface)
  function img(cv, classe) {
    const i = document.createElement("img"); i.src = url(cv); i.className = "px" + (classe ? " " + classe : ""); i.draggable = false; i.alt = "";
    return i;
  }

  return { robo: robo, monstro: monstro, botao: botao, icone: icone, sombra: sombra, url: url, img: img };
})();
