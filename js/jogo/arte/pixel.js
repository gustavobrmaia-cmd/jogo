"use strict";

// =========================
// PIXEL ART (tudo desenhado por código, sem arquivos de imagem)
// v2: robôs e monstros em 48x48 com sombreado de verdade. Cada sprite é montado em PEÇAS (cabeça, corpo, braço...);
// cada peça tem um material com 5 tons (realce, luz, base, sombra, sombra funda; a luz puxa para o quente e a
// sombra para o frio, como em pixel art feita à mão). Depois de montar:
//   - bisel: borda de cima/esquerda de cada peça clareia, de baixo/direita escurece, e a parte de baixo ganha
//     sombra em xadrez (dithering);
//   - contorno interno: onde uma peça encosta numa que está na frente, a de trás escurece (separa as peças);
//   - contorno de fora escuro (#1a1030) e brilho especular nas peças redondas.
// Detalhes (olhos, luzes, rebites, linhas de painel) são pintados por cima, sem sombreado.
// API: Pixel.robo(n), Pixel.monstro(id), Pixel.botao(apertado), Pixel.icone(nome), Pixel.caixa(aberta),
//      Pixel.textura(nome), Pixel.sombra(cv), Pixel.url(cv), Pixel.img(cv, classe)
// =========================

const Pixel = (function() {
  const TINTA = "#1a1030";

  // ---------- cores ----------
  function hsl(h, s, l) { return "hsl(" + Math.round(((h % 360) + 360) % 360) + "," + limitar(s, 0, 100) + "%," + limitar(l, 0, 100) + "%)"; }
  // material: 5 tons a partir de matiz, saturação e luz
  function mat(h, s, l) { return { tons: [hsl(h - 10, s - 8, l + 24), hsl(h - 5, s - 2, l + 12), hsl(h, s, l), hsl(h + 12, s + 2, l - 14), hsl(h + 22, s + 4, l - 27)] }; }
  const METAL = mat(228, 18, 66), METAL_E = mat(232, 16, 44), BORRACHA = mat(240, 14, 26), OURO = mat(44, 92, 56), OSSO = mat(40, 32, 84);

  // ---------- folha com peças ----------
  function Folha(w, h) { this.w = w; this.h = h; this.parte = new Int16Array(w * h).fill(-1); this.det = new Array(w * h).fill(null); this.mats = []; this.brilho = []; }
  Folha.prototype.peca = function(m, brilho) { this.mats.push(m); this.brilho.push(!!brilho); return this.mats.length - 1; };
  Folha.prototype.px = function(x, y, p) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) { this.parte[y * this.w + x] = p; this.det[y * this.w + x] = null; } };
  Folha.prototype.rect = function(x, y, w, h, p) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, p); };
  Folha.prototype.elip = function(cx, cy, rx, ry, p) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.px(x, y, p);
    }
  };
  Folha.prototype.circ = function(cx, cy, r, p) { this.elip(cx, cy, r, r, p); };
  // retângulo de cantos redondos
  Folha.prototype.rr = function(x, y, w, h, r, p) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const cx = i < r ? r - i - 0.5 : i >= w - r ? i - (w - r) + 0.5 : 0, cy = j < r ? r - j - 0.5 : j >= h - r ? j - (h - r) + 0.5 : 0;
      if (cx * cx + cy * cy <= r * r + 0.5) this.px(x + i, y + j, p);
    }
  };
  // polígono (lista de pontos; preenchimento par-ímpar)
  Folha.prototype.poli = function(pts, p) {
    let y0 = 1e9, y1 = -1e9; pts.forEach(function(q) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    for (let y = Math.floor(y0); y <= y1; y++) {
      const xs = [], yy = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function(a, b) { return a - b; });
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, p);
    }
  };
  // espelho no meio da folha (robôs são simétricos)
  Folha.prototype.simR = function(x, y, w, h, p) { this.rect(x, y, w, h, p); this.rect(this.w - x - w, y, w, h, p); };
  Folha.prototype.simRR = function(x, y, w, h, r, p) { this.rr(x, y, w, h, r, p); this.rr(this.w - x - w, y, w, h, r, p); };
  Folha.prototype.simC = function(cx, cy, r, p) { this.circ(cx, cy, r, p); this.circ(this.w - cx, cy, r, p); };
  Folha.prototype.simP = function(pts, p) { const w = this.w; this.poli(pts, p); this.poli(pts.map(function(q) { return [w - q[0], q[1]]; }), p); };
  // detalhes por cima (sem sombreado). cor null apaga o pixel
  Folha.prototype.d = function(x, y, cor) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) { if (cor === null) { this.parte[y * this.w + x] = -1; this.det[y * this.w + x] = null; } else this.det[y * this.w + x] = cor; } };
  Folha.prototype.dR = function(x, y, w, h, cor) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.d(x + i, y + j, cor); };
  Folha.prototype.dSim = function(x, y, cor) { this.d(x, y, cor); this.d(this.w - 1 - x, y, cor); };
  Folha.prototype.dRSim = function(x, y, w, h, cor) { this.dR(x, y, w, h, cor); this.dR(this.w - x - w, y, w, h, cor); };
  Folha.prototype.dC = function(cx, cy, r, cor) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r * r) this.d(x, y, cor); } };
  Folha.prototype.tem = function(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && (this.parte[y * this.w + x] >= 0 || !!this.det[y * this.w + x]); };

  // sombreado (bisel + dithering + contorno interno), contorno de fora e vira canvas
  function finalizar(f) {
    const w = f.w, h = f.h, out = new Array(w * h).fill(null);
    const cx0 = [], cy0 = [], cx1 = [], cy1 = [];
    for (let i = 0; i < w * h; i++) { const p = f.parte[i]; if (p < 0) continue; const x = i % w, y = (i / w) | 0;
      cx0[p] = Math.min(cx0[p] === undefined ? 1e9 : cx0[p], x); cy0[p] = Math.min(cy0[p] === undefined ? 1e9 : cy0[p], y);
      cx1[p] = Math.max(cx1[p] === undefined ? -1 : cx1[p], x); cy1[p] = Math.max(cy1[p] === undefined ? -1 : cy1[p], y); }
    const P = function(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? -1 : f.parte[y * w + x]; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, p = f.parte[i];
      if (f.det[i]) { out[i] = f.det[i]; continue; }
      if (p < 0) continue;
      const tons = f.mats[p].tons;
      const cima = P(x, y - 1) !== p, esq = P(x - 1, y) !== p, baixo = P(x, y + 1) !== p, dir = P(x + 1, y) !== p, baixo2 = P(x, y + 2) !== p;
      const frente = [P(x, y - 1), P(x - 1, y), P(x, y + 1), P(x + 1, y)].some(function(q) { return q > p; });
      let t = 2;
      if (frente) t = 4;
      else if (cima && esq) t = 0;
      else if (cima) t = 1;
      else if (baixo || dir) t = baixo && dir ? 4 : 3;
      else if (esq) t = 1;
      else if (baixo2) t = 3;
      else {
        const ry = (y - cy0[p]) / Math.max(1, cy1[p] - cy0[p]);
        if (ry > 0.86 || (ry > 0.72 && (x + y) % 2)) t = 3;
      }
      out[i] = tons[t];
    }
    f.brilho.forEach(function(b, p) {
      if (!b || cx0[p] === undefined) return;
      const bx = Math.round(cx0[p] + (cx1[p] - cx0[p]) * 0.28), by = Math.round(cy0[p] + (cy1[p] - cy0[p]) * 0.24);
      [[0, 0], [1, 0], [0, 1]].forEach(function(o) { const i = (by + o[1]) * w + bx + o[0]; if (f.parte[i] === p && !f.det[i]) out[i] = "#ffffff"; });
    });
    const fim = out.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (out[i]) continue;
      for (let k = 0; k < 4; k++) { const xx = x + [1, -1, 0, 0][k], yy = y + [0, 0, 1, -1][k]; if (xx >= 0 && yy >= 0 && xx < w && yy < h && out[yy * w + xx]) { fim[i] = TINTA; break; } }
    }
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d");
    for (let i = 0; i < fim.length; i++) if (fim[i]) { g.fillStyle = fim[i]; g.fillRect(i % w, (i / w) | 0, 1, 1); }
    return cv;
  }

  // ---------- ROBÔS (48x48, 30 níveis) ----------
  // peças escolhidas pelo nível (sempre o mesmo robô); quanto maior o nível, mais enfeites (friso dourado,
  // ombreiras, asas, coroa, núcleo brilhante)
  const cacheRobo = {};
  function robo(n) {
    if (cacheRobo[n]) return cacheRobo[n];
    const f = new Folha(48, 48);
    const h = (n * 47 + 205) % 360, sat = n >= 20 ? 66 : 56;
    const COR = mat(h, sat, 54), COR2 = mat(h + 165, 62, 56);
    const luz = hsl(h + 165, 95, 66), luz2 = hsl(h + 165, 100, 86), vidro = "#0f1a2e";
    const iPerna = (n - 1) % 5, iCab = Math.floor((n - 1) / 5) % 6, iOlho = (n * 2 + Math.floor(n / 6)) % 5;
    const iCorpo = (n - 1 + Math.floor((n - 1) / 5)) % 4, iBraco = (n * 3 + Math.floor(n / 7)) % 5, iAnt = (n * 7 + 2) % 5;
    // asas (20+) atrás de tudo
    if (n >= 20) { const asa = f.peca(mat(h + 165, 70, 70)); f.simP([[18, 18], [3, 9], [6, 30], [18, 30]], asa); f.simP([[6, 14], [2, 18], [4, 26]], asa); }
    const metal = f.peca(METAL), metalE = f.peca(METAL_E), borr = f.peca(BORRACHA), acc = f.peca(COR2, true);
    // pernas
    if (iPerna === 0) { f.rect(14, 36, 20, 4, metalE); f.simC(16.5, 41, 5, borr); }
    else if (iPerna === 1) { f.simR(16, 35, 5, 7, metal); f.simRR(14, 41, 9, 5, 2, borr); }
    else if (iPerna === 2) { f.rr(11, 37, 26, 9, 4, borr); }
    else if (iPerna === 3) { f.rr(16, 35, 16, 5, 2, metalE); f.poli([[17, 40], [31, 40], [27, 46], [21, 46]], acc); }
    else { f.rect(22, 35, 4, 7, metal); f.rr(15, 41, 18, 5, 2, borr); }
    // braços
    const corpoM = f.peca(COR);
    if (iBraco === 0) { f.simRR(8, 22, 5, 11, 2, metal); f.simRR(7, 32, 7, 5, 2, borr); }
    else if (iBraco === 1) { f.simRR(8, 22, 5, 9, 2, metal); f.simP([[6, 30], [10, 30], [9, 37], [6, 36]], metalE); f.simP([[11, 30], [14, 30], [13, 36], [11, 37]], metalE); }
    else if (iBraco === 2) { f.simRR(4, 24, 10, 6, 2, metalE); f.simR(2, 25, 3, 4, borr); }
    else if (iBraco === 3) { f.simR(10, 22, 3, 6, metal); f.simC(9, 31, 4.5, corpoM); }
    else { f.simRR(8, 22, 5, 7, 2, metal); f.simP([[7, 29], [14, 29], [10.5, 38]], metalE); }
    // corpo (peça nova: fica na frente dos braços)
    const corpo = f.peca(COR);
    if (iCorpo === 0) f.rr(13, 20, 22, 16, 3, corpo);
    else if (iCorpo === 1) f.elip(24, 28, 11.5, 9, corpo);
    else if (iCorpo === 2) f.poli([[12, 20], [36, 20], [32, 36], [16, 36]], corpo);
    else f.rr(14, 20, 20, 16, 6, corpo);
    // detalhes das pernas por cima (rodas e cubos)
    if (iPerna === 0) { f.dC(16.5, 41, 2.2, "#9aa3c0"); f.dC(31.5, 41, 2.2, "#9aa3c0"); f.d(16, 40, "#e8ecf8"); f.d(31, 40, "#e8ecf8"); }
    if (iPerna === 2) for (let x = 13; x < 36; x += 4) f.dR(x, 41, 2, 2, "#5d6380");
    if (iPerna === 3) { f.dR(20, 42, 8, 2, "#ffe36b"); f.dR(22, 44, 4, 1, "#fff6c8"); }
    // pescoço e cabeça
    const pesc = f.peca(METAL_E); f.rect(21, 17, 6, 4, pesc);
    const cab = f.peca(COR, iCab === 3 || iCab === 5);
    const cy = 11;
    if (iCab === 0) f.rr(13, 3, 22, 16, 4, cab);
    else if (iCab === 1) { f.elip(24, 12, 11, 10, cab); f.rect(13, 12, 22, 7, cab); }
    else if (iCab === 2) { const moldura = f.peca(METAL); f.rr(11, 3, 26, 16, 2, moldura); }
    else if (iCab === 3) f.circ(24, 11, 9.5, cab);
    else if (iCab === 4) { f.poli([[13, 4], [35, 4], [33, 19], [15, 19]], cab); }
    else f.rr(14, 2, 20, 17, 8, cab);
    // peito: luz / tela / rebites / faixa
    const iPeito = n % 4;
    if (iPeito === 0) { f.dC(24, 27, 3.2, luz); f.dC(24, 27, 1.6, luz2); }
    else if (iPeito === 1) { f.dR(18, 24, 12, 7, vidro); f.dR(20, 26, 2, 2, luz); f.dR(26, 26, 2, 2, luz); f.dR(21, 28, 6, 1, luz); }
    else if (iPeito === 2) { [[16, 23], [31, 23], [16, 32], [31, 32]].forEach(function(q) { f.d(q[0], q[1], "#e8ecf8"); f.d(q[0] + 1, q[1] + 1, "#5d6380"); }); f.dR(20, 25, 8, 5, COR2.tons[3]); f.dR(21, 26, 6, 3, luz); }
    else { f.dR(14, 27, 20, 3, COR.tons[4]); f.dR(22, 27, 4, 3, luz); }
    f.dR(24, 33, 1, 2, COR.tons[4]);
    if (n >= 10) f.dR(15, 35, 18, 1, OURO.tons[1]);
    if (n >= 15) { const omb = f.peca(OURO, true); f.simRR(9, 18, 8, 6, 3, omb); }
    // rosto
    if (iCab === 2) f.dR(14, 6, 20, 10, vidro);
    if (iCab === 4) f.dR(17, 15, 14, 3, "#5d6380");
    if (iOlho === 0) { f.dRSim(17, cy - 2, 5, 5, "#ffffff"); f.dRSim(19, cy, 2, 2, "#141a2e"); f.dSim(18, cy - 1, "#ffffff"); }
    else if (iOlho === 1) { f.dR(16, cy - 1, 16, 4, vidro); f.dR(17, cy, 14, 2, luz); f.dR(18, cy, 3, 1, luz2); }
    else if (iOlho === 2) { f.dC(24, cy + 1, 4.6, "#ffffff"); f.dC(24, cy + 1, 2.8, luz); f.dC(24, cy + 1, 1.3, "#141a2e"); f.d(22, cy - 1, "#ffffff"); }
    else if (iOlho === 3) { f.dRSim(17, cy - 1, 5, 4, "#ffffff"); f.dRSim(19, cy, 2, 3, "#141a2e"); f.dRSim(16, cy - 3, 4, 1, COR.tons[4]); f.dRSim(18, cy - 2, 3, 1, COR.tons[4]); }
    else { f.dRSim(17, cy - 1, 4, 4, luz); f.dRSim(18, cy, 2, 2, luz2); }
    if (iCab !== 4) {
      if (n % 3 === 0) f.dR(20, cy + 5, 8, 1, "#141a2e");
      else if (n % 3 === 1) { f.dR(20, cy + 5, 8, 2, "#141a2e"); for (let x = 21; x < 28; x += 2) f.d(x, cy + 5, luz); }
    }
    // antena ou coroa (25+)
    if (n >= 25) { const coroa = f.peca(OURO, true); f.poli([[15, 4], [33, 4], [33, -1], [29, 2], [24, -2], [19, 2], [15, -1]], coroa); f.dC(24, 1.5, 1.4, luz2); }
    else if (iAnt === 1) { const a = f.peca(METAL); f.rect(23, 0, 2, 4, a); f.dC(24, 0.5, 2, luz); }
    else if (iAnt === 2) { const a = f.peca(METAL); f.poli([[17, 4], [19, 4], [15, -1], [13, -1]], a); f.poli([[29, 4], [31, 4], [35, -1], [33, -1]], a); f.d(13, 0, luz); f.d(34, 0, luz); }
    else if (iAnt === 3) { [[25, 0], [24, 1], [23, 2], [24, 2], [25, 2], [24, 3]].forEach(function(q) { f.d(q[0], q[1], "#ffe14d"); }); }
    else if (iAnt === 4) { const a = f.peca(METAL_E); f.rr(16, 0, 16, 3, 1, a); f.rect(23, 2, 2, 2, a); }
    if (n >= 28) { f.dC(24, 27, 4, luz2); f.dC(24, 27, 2, "#ffffff"); }
    return (cacheRobo[n] = finalizar(f));
  }

  // ---------- MONSTROS (48x48, 9 formas x 3 cores) ----------
  const cacheMonstro = {};
  function monstro(id) {
    if (cacheMonstro[id]) return cacheMonstro[id];
    const z = Math.floor(id / 3), forma = FORMAS_MONSTRO[id % 9], k = id % 3;
    const h = z * 41 + 95 + k * 28, f = new Folha(48, 48);
    const C2 = f.peca(mat(h + 30, 50, 34)), C = f.peca(mat(h, 58, 50), true), OS = f.peca(OSSO), CL = f.peca(mat(h - 20, 55, 72), true);
    const olho = z >= 6 ? "#ff4b4b" : "#ffffff", pup = "#141a2e", rosa = "#ff6b8b";
    const olhos = function(x1, x2, y, r) { [x1, x2].forEach(function(x) { f.dC(x, y, r, olho); f.dC(x + r * 0.2, y + r * 0.15, r * 0.55, pup); f.d(x - r * 0.35, y - r * 0.4, "#ffffff"); }); };
    if (forma === "gosma") {
      f.elip(24, 31, 18, 13, C); f.rect(6, 31, 36, 11, C); f.elip(13, 43, 4, 2.5, C); f.elip(33, 43, 5, 2.5, C);
      olhos(18, 30, 30, 3.6); f.dR(21, 38, 6, 1, pup); f.d(20, 37, pup); f.d(27, 37, pup); f.dR(10, 34, 3, 1, rosa); f.dR(35, 34, 3, 1, rosa);
    } else if (forma === "morcego") {
      f.poli([[18, 20], [2, 12], [5, 20], [1, 28], [8, 26], [10, 33], [18, 30]], C2); f.poli([[30, 20], [46, 12], [43, 20], [47, 28], [40, 26], [38, 33], [30, 30]], C2);
      f.circ(24, 25, 10, C); f.poli([[16, 18], [18, 8], [22, 17]], C); f.poli([[32, 18], [30, 8], [26, 17]], C);
      olhos(20, 28, 23, 2.6); f.dR(21, 30, 6, 1, pup); f.d(21, 31, "#ffffff"); f.d(26, 31, "#ffffff");
    } else if (forma === "olho") {
      for (let i = 0; i < 5; i++) f.rr(12 + i * 5, 34, 3, 9 + (i % 2) * 3, 1, C2);
      f.circ(24, 22, 15, OS); f.dC(24, 22, 8.5, mat(h, 58, 50).tons[2]); f.dC(24, 22, 6.5, mat(h, 58, 50).tons[1]); f.dC(24, 22, 4.3, pup); f.dC(21, 19, 1.6, "#ffffff");
      [[11, 18], [12, 19], [36, 25], [35, 26], [14, 30], [34, 14], [13, 17]].forEach(function(q) { f.d(q[0], q[1], "#e05555"); });
    } else if (forma === "cogumelo") {
      f.rr(16, 24, 16, 20, 4, OS); f.elip(24, 20, 20, 13, C); f.rect(4, 20, 40, 5, C);
      f.dC(15, 14, 3, "#ffffff"); f.dC(29, 11, 2.4, "#ffffff"); f.dC(36, 19, 2, "#ffffff"); f.dC(22, 20, 1.8, "#ffffff");
      olhos(20, 28, 32, 2.4); f.dR(22, 38, 4, 1, pup);
    } else if (forma === "fantasma") {
      f.circ(24, 20, 14, CL); f.rect(10, 20, 28, 20, CL);
      for (let x = 10; x < 38; x += 7) f.elip(x + 3.5, 41, 3.5, 3, CL);
      f.dC(19, 21, 3, pup); f.dC(29, 21, 3, pup); f.d(18, 20, "#ffffff"); f.d(28, 20, "#ffffff"); f.dC(24, 30, 2.4, pup); f.dR(14, 26, 3, 1, rosa); f.dR(31, 26, 3, 1, rosa);
    } else if (forma === "caranguejo") {
      for (let i = 0; i < 3; i++) { f.poli([[14 - i, 32 + i * 3], [16 - i, 32 + i * 3], [9 - i * 2, 42], [7 - i * 2, 42]], C2); f.poli([[32 + i, 32 + i * 3], [34 + i, 32 + i * 3], [41 + i * 2, 42], [39 + i * 2, 42]], C2); }
      f.simR(17, 14, 2, 9, C2);
      f.elip(24, 31, 16, 10, C); f.simC(7, 18, 6, C); f.dR(4, 13, 3, 3, null); f.dR(41, 13, 3, 3, null);
      olhos(18, 30, 13, 3);
    } else if (forma === "caveira") {
      f.rr(19, 40, 10, 5, 2, C);
      f.rr(15, 30, 18, 10, 2, OS); f.circ(24, 20, 14, OS);
      f.dC(18, 21, 4, pup); f.dC(30, 21, 4, pup); f.dC(18, 21, 1.4, "#ff4b4b"); f.dC(30, 21, 1.4, "#ff4b4b");
      f.dR(23, 27, 2, 3, pup); for (let x = 17; x < 32; x += 3) f.dR(x, 33, 2, 5, "#bdb3a0");
    } else if (forma === "golem") {
      f.simRR(3, 18, 9, 18, 3, C2); f.simRR(13, 39, 9, 7, 2, C2);
      const corpo = f.peca(mat(h, 58, 50), true); f.rr(10, 15, 28, 25, 4, corpo); f.rr(17, 4, 14, 13, 3, corpo);
      f.dR(20, 9, 3, 3, hsl(h + 180, 95, 64)); f.dR(26, 9, 3, 3, hsl(h + 180, 95, 64));
      [[15, 20, 21, 28], [31, 19, 28, 26], [22, 31, 26, 37]].forEach(function(l) { for (let i = 0; i <= 6; i++) f.d(Math.round(l[0] + (l[2] - l[0]) * i / 6), Math.round(l[1] + (l[3] - l[1]) * i / 6), mat(h, 58, 50).tons[4]); });
    } else {   // dragão: cabeça de perfil para a esquerda
      f.poli([[28, 10], [44, 4], [42, 18], [46, 24], [34, 30]], C2);
      f.rr(16, 33, 22, 11, 4, C);
      const cab = f.peca(mat(h, 58, 50), true); f.circ(27, 22, 12, cab); f.rr(5, 19, 20, 11, 3, cab); f.rr(6, 28, 16, 4, 2, CL);
      const ch = f.peca(OSSO); f.poli([[28, 11], [34, 1], [32, 12]], ch); f.poli([[21, 11], [22, 2], [25, 11]], ch);
      f.dC(23, 18, 2.6, "#ffd23f"); f.dR(23, 17, 1, 3, pup); f.d(8, 21, pup); f.dR(9, 28, 2, 2, "#ffffff"); f.dR(15, 28, 2, 2, "#ffffff");
    }
    // chifres (horda 4+) e coroa (7+), presos no topo
    const topo = function(x) { for (let y = 0; y < 48; y++) if (f.tem(x, y)) return y; return 20; };
    if (z >= 3 && forma !== "dragao") { const ch = f.peca(OSSO); [[16, -1], [31, 1]].forEach(function(c) { const y = topo(c[0]) + 2; f.poli([[c[0] - 2, y], [c[0] + 2, y], [c[0] + c[1] * 4, y - 9]], ch); }); }
    if (z >= 6 && forma !== "dragao") { const y = Math.max(5, topo(24) - 1), cor = f.peca(OURO, true); f.poli([[16, y + 1], [32, y + 1], [32, y - 4], [28, y - 1], [24, y - 5], [20, y - 1], [16, y - 4]], cor); }
    return (cacheMonstro[id] = finalizar(f));
  }

  // ---------- botão vermelho (64x64) ----------
  const cacheBotao = {};
  function botao(apertado) {
    const kc = apertado ? 1 : 0;
    if (cacheBotao[kc]) return cacheBotao[kc];
    const f = new Folha(64, 64), d = apertado ? 5 : 0;
    const base = f.peca(mat(232, 18, 34)), anel = f.peca(METAL), fundo = f.peca(mat(232, 18, 40)), cil = f.peca(mat(356, 78, 34)), domo = f.peca(mat(356, 82, apertado ? 48 : 54), true);
    f.rr(5, 32, 54, 27, 4, base);
    f.elip(32, 40, 25, 13.5, anel); f.elip(32, 40, 21, 11, fundo);
    f.rr(13, 26 + d, 38, 15 - d, 2, cil); f.elip(32, 40, 19, 7.5, cil);
    f.elip(32, 27 + d, 19, 10, domo);
    [[9, 36], [53, 36], [9, 54], [53, 54]].forEach(function(q) { f.dR(q[0], q[1], 2, 2, "#cfd5e6"); f.d(q[0] + 1, q[1] + 1, "#5d6380"); });
    f.dR(20, 21 + d, 7, 2, "#ffe3e6"); f.dR(18, 23 + d, 3, 1, "#ffc4ca");
    return (cacheBotao[kc] = finalizar(f));
  }

  // ---------- caixinha onde o robô nasce (24x24) ----------
  const cacheCaixa = {};
  function caixa(abrindo) {
    const kc = abrindo ? 1 : 0;
    if (cacheCaixa[kc]) return cacheCaixa[kc];
    const f = new Folha(24, 24), mad = f.peca(mat(30, 55, 52)), aro = f.peca(METAL_E);
    if (!abrindo) { f.rr(2, 5, 20, 17, 2, mad); f.rect(2, 5, 20, 3, aro); f.rect(2, 19, 20, 3, aro); f.dR(10, 11, 4, 4, "#ffe14d"); f.dR(11, 10, 2, 6, "#ffe14d"); f.d(4, 6, "#e8ecf8"); f.d(19, 6, "#e8ecf8"); f.d(4, 20, "#e8ecf8"); f.d(19, 20, "#e8ecf8"); }
    else { f.rr(2, 11, 20, 11, 2, mad); f.rect(2, 19, 20, 3, aro); const t1 = f.peca(mat(30, 55, 52)); f.poli([[1, 10], [9, 3], [11, 5], [3, 12]], t1); f.poli([[23, 10], [15, 3], [13, 5], [21, 12]], t1); f.dR(8, 9, 8, 3, "#fff3a6"); }
    return (cacheCaixa[kc] = finalizar(f));
  }

  // ---------- engrenagem (fundo da máquina e da fábrica) ----------
  // quadro "q" de "qs" dentro do período de um dente (girar = trocar de quadro, sempre nítido)
  const cacheEngr = {};
  function engrenagem(r, dentes, q, qs, tom) {
    const k = r + "|" + dentes + "|" + q + "|" + tom;
    if (cacheEngr[k]) return cacheEngr[k];
    const S = Math.ceil(r * 2 + 8), c = S / 2, f = new Folha(S, S);
    const m = tom === "ouro" ? f.peca(mat(40, 62, 46)) : tom === "escuro" ? f.peca(mat(250, 20, 30)) : f.peca(mat(235, 16, 40));
    const fase = (q / qs) * (Math.PI * 2 / dentes), larg = Math.PI / dentes * 0.55;
    f.circ(c, c, r - 2, m);
    for (let i = 0; i < dentes; i++) {
      const a = fase + i * Math.PI * 2 / dentes, r0 = r - 3, r1 = r + 3;
      f.poli([[c + Math.cos(a - larg) * r0, c + Math.sin(a - larg) * r0], [c + Math.cos(a - larg * 0.7) * r1, c + Math.sin(a - larg * 0.7) * r1],
        [c + Math.cos(a + larg * 0.7) * r1, c + Math.sin(a + larg * 0.7) * r1], [c + Math.cos(a + larg) * r0, c + Math.sin(a + larg) * r0]], m);
    }
    const mi = f.peca(tom === "ouro" ? mat(40, 50, 36) : mat(235, 14, 30));
    f.circ(c, c, r * 0.62, mi);
    // raios (furos entre eles) e eixo
    const furos = Math.max(4, Math.round(dentes / 3));
    for (let i = 0; i < furos; i++) { const a = fase * 0.5 + i * Math.PI * 2 / furos + Math.PI / furos; f.dC(c + Math.cos(a) * r * 0.38, c + Math.sin(a) * r * 0.38, Math.max(1.2, r * 0.13), null); }
    f.dC(c, c, Math.max(2, r * 0.16), "#c9d0e3"); f.dC(c, c, Math.max(1, r * 0.08), "#3a3f58");
    return (cacheEngr[k] = finalizar(f));
  }

  // ---------- ícones 24x24 (v3: maiores e com o mesmo sombreado dos robôs) ----------
  const cacheIcone = {};
  // traço grosso (lâminas, cabos): quadrilátero entre dois pontos
  Folha.prototype.traco = function(x0, y0, x1, y1, w, p) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
    this.poli([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], p);
  };
  function icone(nome) {
    if (cacheIcone[nome]) return cacheIcone[nome];
    const f = new Folha(24, 24);
    const M = function(m, b) { return f.peca(m, b); };
    const OURO2 = mat(36, 80, 44), CIANO = mat(188, 85, 62), VERDE = mat(140, 60, 50), VERMELHO = mat(356, 76, 54), ROXO = mat(270, 68, 62), PELE = mat(26, 68, 74), MADEIRA = mat(22, 50, 42), AZUL = mat(212, 76, 56);
    switch (nome) {
      case "moeda":
        f.circ(12, 12, 10.5, M(OURO, true)); f.circ(12, 12, 7.5, M(OURO2));
        [[12, 6], [13, 9], [16, 9], [14, 11], [15, 15], [12, 13], [9, 15], [10, 11], [8, 9], [11, 9]].forEach(function(q, n, l) { const r = l[(n + 1) % l.length]; for (let k2 = 0; k2 <= 4; k2++) f.d(q[0] + (r[0] - q[0]) * k2 / 4, q[1] + (r[1] - q[1]) * k2 / 4, "#fff1a6"); });
        f.dR(11, 9, 3, 4, "#ffe066"); f.d(5, 6, "#ffffff"); break;
      case "ph":
        f.poli([[12, 1], [3, 9], [12, 23]], M(mat(188, 80, 72))); f.poli([[12, 1], [21, 9], [12, 23]], M(mat(192, 80, 52)));
        f.poli([[7, 5], [17, 5], [21, 9], [3, 9]], M(mat(184, 90, 80)));
        f.dR(8, 6, 3, 1, "#ffffff"); f.d(6, 8, "#ffffff"); f.d(19, 3, "#ffffff"); f.d(20, 2, "#e6fdff"); f.d(18, 2, "#e6fdff"); break;
      case "upgrades":
        f.poli([[12, 1], [23, 12], [16, 12], [16, 23], [8, 23], [8, 12], [1, 12]], M(VERDE, true));
        f.dR(10, 13, 2, 8, "#9dffbc"); break;
      case "batalha": {
        const l = M(METAL, true);
        f.traco(5, 19, 19, 4, 3.4, l); f.traco(19, 19, 5, 4, 3.4, l);
        const o = M(OURO); f.traco(3, 15, 9, 21, 2.4, o); f.traco(21, 15, 15, 21, 2.4, o);
        const c = M(MADEIRA); f.traco(3, 21, 5, 19, 2.6, c); f.traco(21, 21, 19, 19, 2.6, c); break;
      }
      case "compendio":
        f.rr(3, 1, 19, 22, 2, M(mat(10, 58, 42))); f.rect(3, 1, 4, 22, M(mat(10, 58, 30)));
        f.rr(9, 7, 9, 8, 1, M(METAL)); f.dR(11, 9, 2, 2, "#7cf0ff"); f.dR(15, 9, 2, 2, "#7cf0ff"); f.dR(11, 13, 5, 1, "#3a3f58"); f.dR(13, 5, 1, 2, "#b9c1d9");
        [[20, 2], [20, 20], [8, 2], [8, 20]].forEach(function(q) { f.dR(q[0], q[1], 2, 2, "#ffcc33"); });
        f.dR(22, 3, 1, 18, "#f2e6c8"); break;
      case "config": {
        const m = M(METAL, true); f.circ(12, 12, 8, m);
        for (let n = 0; n < 8; n++) { const an = n * Math.PI / 4; f.traco(12 + Math.cos(an) * 7, 12 + Math.sin(an) * 7, 12 + Math.cos(an) * 11, 12 + Math.sin(an) * 11, 4, m); }
        f.dC(12, 12, 3.6, "#3a3f58"); f.dC(12, 12, 2.2, null); break;
      }
      case "renascer": {
        const m = M(ROXO, true);
        for (let n = 0; n < 34; n++) { const an = n / 34 * Math.PI * 2; if (n % 17 > 13) continue; f.rect(Math.round(12 + Math.cos(an) * 8 - 1.5), Math.round(12 + Math.sin(an) * 8 - 1.5), 3, 3, m); }
        f.poli([[19, 1], [23, 8], [15, 7]], m); f.poli([[5, 23], [1, 16], [9, 17]], m);
        f.dC(12, 12, 2, "#e5d4ff"); break;
      }
      case "dedo": {   // dedo apertando um botão vermelho (de cima para baixo, com risquinhos do toque)
        f.elip(12, 20, 10, 3.5, M(METAL_E)); f.elip(12, 17.5, 7, 3.5, M(VERMELHO, true)); f.rect(5, 17, 14, 3, M(mat(356, 76, 40)));
        const p = M(PELE, true); f.rr(6, -3, 12, 7, 3, p); f.rr(10, 2, 5, 12, 2, p);
        f.dR(11, 11, 3, 2, "#f7c9a8"); f.d(5, 10, "#ffffff"); f.d(4, 9, "#ffffff"); f.d(19, 10, "#ffffff"); f.d(20, 9, "#ffffff"); f.d(7, 13, "#ffffff"); f.d(17, 13, "#ffffff"); break;
      }
      case "motor": {
        f.rect(7, 2, 4, 6, M(METAL, true)); f.rect(14, 3, 4, 5, M(METAL, true));
        f.rr(2, 8, 20, 12, 2, M(METAL_E)); f.rect(4, 20, 4, 3, M(BORRACHA)); f.rect(16, 20, 4, 3, M(BORRACHA));
        for (let x = 5; x < 20; x += 3) f.dR(x, 11, 1, 6, "#3a3f58"); f.dC(19, 11, 1.6, "#ff4d5e"); break;
      }
      case "fabrica": {
        const p = M(mat(8, 45, 46)); f.rect(1, 11, 22, 12, p);
        f.poli([[1, 11], [6, 6], [6, 11]], p); f.poli([[7, 11], [12, 6], [12, 11]], p);
        f.rect(16, 2, 4, 10, M(METAL_E));
        [[3, 14], [8, 14], [13, 14], [3, 18], [8, 18], [13, 18]].forEach(function(q) { f.dR(q[0], q[1], 3, 2, "#ffe36b"); });
        f.dR(18, 16, 3, 7, "#3a2a20"); f.dC(19, 1, 1.4, "#c9c3e6"); f.dC(21, 0, 1, "#c9c3e6"); break;
      }
      case "esteira":
        f.rr(5, 3, 13, 11, 1, M(mat(32, 55, 54))); f.dR(11, 3, 2, 11, "#e6c48a");
        f.rr(1, 15, 22, 7, 3, M(BORRACHA)); [4, 9, 14, 19].forEach(function(x) { f.dC(x, 18.5, 1.6, "#9aa3c0"); }); break;
      case "linha": {
        const m = M(METAL, true); f.traco(4, 20, 16, 8, 3.4, m); f.circ(17, 7, 5, m); f.dR(17, 2, 3, 4, null); f.dR(19, 4, 3, 2, null);
        const v = M(VERMELHO); f.traco(17, 20, 11, 14, 4, v); f.traco(11, 14, 5, 8, 1.6, M(METAL)); break;
      }
      case "escudo":
        f.poli([[2, 2], [22, 2], [22, 11], [12, 23], [2, 11]], M(METAL, true)); f.poli([[5, 5], [19, 5], [19, 11], [12, 19], [5, 11]], M(AZUL));
        [[12, 6], [13, 9], [16, 9], [14, 11], [15, 15], [12, 13], [9, 15], [10, 11], [8, 9], [11, 9]].forEach(function(q) { f.d(q[0], q[1], "#ffcc33"); }); f.dR(11, 9, 3, 4, "#ffcc33"); break;
      case "cofre":
        f.rr(2, 2, 20, 18, 2, M(METAL_E)); f.rr(4, 4, 16, 14, 1, M(METAL)); f.rect(4, 20, 4, 3, M(BORRACHA)); f.rect(16, 20, 4, 3, M(BORRACHA));
        f.circ(11, 11, 4.5, M(METAL_E, true)); f.dR(11, 7, 1, 2, "#e8ecf8"); f.dR(14, 11, 2, 1, "#e8ecf8"); f.dR(17, 9, 2, 5, "#ffcc33"); break;
      case "raio": f.poli([[14, 1], [4, 13], [11, 13], [8, 23], [20, 9], [13, 9], [17, 1]], M(OURO, true)); f.dR(13, 3, 2, 2, "#fff6c8"); break;
      case "reator":
        f.circ(12, 12, 11, M(METAL_E)); f.circ(12, 12, 7.5, M(CIANO, true));
        f.dC(12, 12, 3, "#ffffff"); for (let n = 0; n < 3; n++) { const an = n * Math.PI * 2 / 3 - Math.PI / 2; f.dC(12 + Math.cos(an) * 9.3, 12 + Math.sin(an) * 9.3, 1.3, "#7cf0ff"); } break;
      case "canhao":
        f.traco(4, 14, 21, 6, 7, M(METAL_E, true)); f.circ(21, 6, 3.6, M(BORRACHA)); f.dC(21.5, 5.5, 1.6, "#120b26");
        f.circ(9, 17, 5.5, M(MADEIRA)); f.dC(9, 17, 1.6, "#ffcc33"); [[9, 12.5], [9, 21], [4.5, 17], [13.5, 17]].forEach(function(q) { f.d(q[0], q[1], "#3a2a20"); }); break;
      case "prensa":
        f.rect(2, 1, 20, 5, M(METAL_E)); f.rect(10, 6, 4, 6, M(METAL, true)); f.rect(5, 11, 14, 3, M(METAL));
        f.rect(6, 14, 12, 3, M(mat(26, 80, 56))); f.rect(2, 18, 20, 5, M(BORRACHA)); f.dR(3, 2, 2, 2, "#ffcc33"); f.dR(19, 2, 2, 2, "#ffcc33"); break;
      case "video": {
        f.rr(2, 9, 20, 14, 1, M(BORRACHA)); const tp = M(mat(240, 10, 86)); f.poli([[2, 4], [21, 1], [22, 6], [3, 9]], tp);
        for (let n = 0; n < 4; n++) f.traco(5 + n * 5, 7.6 - n * 0.7, 7 + n * 5, 2.8 - n * 0.7, 2, M(BORRACHA));
        f.poli([[10, 12], [17, 16], [10, 20]], M(mat(0, 0, 92))); break;
      }
      case "cadeado": {
        const m = M(METAL, true); f.circ(12, 9, 7, m); f.dC(12, 9, 4, null); f.dR(5, 9, 14, 2, null);
        f.rect(5, 8, 3, 4, m); f.rect(16, 8, 3, 4, m); f.rr(3, 11, 18, 12, 2, M(OURO, true)); f.dC(12, 16, 2, "#4a3510"); f.dR(11, 17, 2, 3, "#4a3510"); break;
      }
      case "missil":
        f.traco(5, 19, 17, 7, 6, M(METAL, true)); f.poli([[15, 5], [23, 1], [19, 9]], M(VERMELHO, true));
        f.poli([[4, 13], [9, 14], [5, 18]], M(VERMELHO)); f.poli([[11, 20], [10, 15], [6, 19]], M(VERMELHO));
        f.dR(1, 20, 3, 3, "#ffa53d"); f.d(0, 23, "#ffe36b"); f.d(3, 23, "#ffe36b"); f.dR(10, 13, 3, 1, "#3a3f58"); break;
      case "choque":
        f.poli([[14, 1], [4, 13], [11, 13], [8, 23], [20, 9], [13, 9], [17, 1]], M(CIANO, true));
        [[3, 4], [20, 16], [2, 19], [21, 3]].forEach(function(q) { f.d(q[0], q[1], "#e6fdff"); f.d(q[0] + 1, q[1], "#7cf0ff"); }); break;
      case "conserto": {
        const g2 = M(VERDE, true); f.rr(8, 2, 8, 20, 2, g2); f.rr(2, 8, 20, 8, 2, g2);
        f.dR(10, 4, 2, 6, "#b8ffcf"); f.dR(4, 10, 6, 2, "#b8ffcf"); break;
      }
      case "sobrecarga":
        f.rr(2, 6, 18, 13, 2, M(VERMELHO, true)); f.rect(20, 9, 3, 7, M(METAL_E));
        f.poli([[12, 7], [6, 13], [10, 13], [8, 18], [15, 11], [11, 11], [13, 7]], M(OURO, true));
        f.dR(3, 3, 1, 2, "#ffa53d"); f.dR(18, 2, 1, 2, "#ffa53d"); break;
      case "trofeu": {
        const o = M(OURO, true); f.poli([[5, 2], [19, 2], [17, 11], [12, 14], [7, 11]], o);
        f.circ(4, 6, 3, M(OURO)); f.dC(4, 6, 1.4, null); f.circ(20, 6, 3, M(OURO)); f.dC(20, 6, 1.4, null);
        f.rect(10, 14, 4, 4, M(OURO2)); f.rr(5, 18, 14, 5, 1, M(MADEIRA)); f.dR(8, 4, 2, 4, "#fff6c8"); break;
      }
      case "engrenagem": {
        const m = M(mat(40, 70, 52), true); f.circ(12, 12, 7.5, m);
        for (let n = 0; n < 8; n++) { const an = n * Math.PI / 4 + 0.2; f.traco(12 + Math.cos(an) * 6, 12 + Math.sin(an) * 6, 12 + Math.cos(an) * 11, 12 + Math.sin(an) * 11, 4, m); }
        f.dC(12, 12, 3, "#5a3d10"); f.dC(12, 12, 1.6, null); break;
      }
    }
    return (cacheIcone[nome] = finalizar(f));
  }

  // ---------- texturas da interface (repetidas no CSS, ampliadas sem borrar) ----------
  const cacheTex = {};
  function textura(nome) {
    if (cacheTex[nome]) return cacheTex[nome];
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    const px = function(x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    const rt = function(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); };
    if (/^placa/.test(nome)) {
      // chapa de metal 32x32: tom base, granulado, bordas de bisel e rebites nos cantos
      const b = { placa: [64, 54, 108], placaEscura: [40, 32, 74], placaClara: [88, 76, 148], placaAco: [78, 86, 112] }[nome];
      cv.width = cv.height = 32;
      const cor = function(k) { return "rgb(" + b.map(function(v) { return Math.round(limitar(v + k, 0, 255)); }).join(",") + ")"; };
      rt(0, 0, 32, 32, cor(0));
      const r = semente(nome.length * 7 + 3);
      for (let i = 0; i < 46; i++) px(Math.floor(r() * 32), Math.floor(r() * 32), cor(r() < 0.5 ? -7 : 7));
      rt(0, 0, 32, 1, cor(18)); rt(0, 0, 1, 32, cor(12)); rt(0, 31, 32, 1, cor(-20)); rt(31, 0, 1, 32, cor(-14));
      [[3, 3], [27, 3], [3, 27], [27, 27]].forEach(function(q) { rt(q[0], q[1], 2, 2, cor(38)); px(q[0] + 1, q[1] + 1, cor(-18)); px(q[0] + 2, q[1] + 2, cor(-34)); px(q[0] + 2, q[1] + 1, cor(-34)); });
    } else if (nome === "perigo") {
      cv.width = 16; cv.height = 8;
      for (let x = 0; x < 16; x++) for (let y = 0; y < 8; y++) px(x, y, ((x + y) % 16) < 8 ? "#ffcc33" : "#241a10");
      rt(0, 0, 16, 1, "rgba(255,255,255,.25)"); rt(0, 7, 16, 1, "rgba(0,0,0,.35)");
    } else if (nome === "vaga") {
      cv.width = cv.height = 16;
      rt(0, 0, 16, 16, "#2c2256"); rt(1, 1, 14, 14, "#181133"); rt(1, 1, 14, 2, "#100a24"); rt(1, 1, 2, 14, "#140e2c");
      rt(0, 15, 16, 1, "#463a86"); rt(15, 0, 1, 16, "#3d327a");
      [[0, 0], [14, 0], [0, 14], [14, 14]].forEach(function(q) { rt(q[0], q[1], 2, 2, "#6656b8"); });
      for (let i = 3; i < 13; i += 3) px(i, 13, "#221a46");
    } else if (nome === "grade") {
      // grade de piso metálico (fundo das áreas)
      cv.width = cv.height = 8;
      rt(0, 0, 8, 8, "#1c1440"); rt(0, 0, 8, 1, "#251b52"); rt(0, 0, 1, 8, "#251b52"); px(4, 4, "#2b2060");
    }
    return (cacheTex[nome] = cv);
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
  function img(cv, classe) {
    const i = document.createElement("img"); i.src = url(cv); i.className = "px" + (classe ? " " + classe : ""); i.draggable = false; i.alt = "";
    return i;
  }

  return { robo: robo, monstro: monstro, botao: botao, caixa: caixa, engrenagem: engrenagem, icone: icone, textura: textura, sombra: sombra, url: url, img: img, mat: mat, hsl: hsl };
})();
