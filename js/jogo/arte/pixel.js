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

  // ---------- ícones 16x16 ----------
  const cacheIcone = {};
  function icone(nome) {
    if (cacheIcone[nome]) return cacheIcone[nome];
    const f = new Folha(16, 16);
    const M = function(m, b) { return f.peca(m, b); };
    switch (nome) {
      case "moeda": f.circ(8, 8, 7, M(OURO, true)); f.dR(7, 4, 2, 8, "#b87a10"); f.dR(6, 5, 1, 6, "#b87a10"); break;
      case "ph": f.poli([[8, 0], [10, 6], [16, 6], [11, 10], [13, 16], [8, 12], [3, 16], [5, 10], [0, 6], [6, 6]], M(mat(188, 90, 66), true)); break;
      case "upgrades": f.poli([[8, 1], [15, 8], [11, 8], [11, 15], [5, 15], [5, 8], [1, 8]], M(mat(140, 62, 52))); break;
      case "batalha": { const l = M(METAL); f.poli([[13, 1], [15, 3], [6, 12], [4, 10]], l); f.rect(2, 10, 5, 2, M(OURO)); f.rect(3, 12, 2, 3, M(mat(18, 52, 40))); break; }
      case "compendio": f.rr(2, 1, 12, 14, 1, M(mat(12, 55, 42))); f.rect(5, 3, 8, 10, M(mat(40, 60, 86))); f.dR(6, 5, 6, 1, "#9b6b3d"); f.dR(6, 7, 5, 1, "#9b6b3d"); f.dR(6, 9, 6, 1, "#9b6b3d"); break;
      case "config": { const m = M(METAL); f.circ(8, 8, 6, m); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; f.rect(Math.round(7 + Math.cos(a) * 6.3), Math.round(7 + Math.sin(a) * 6.3), 2, 2, m); } f.dC(8, 8, 2.2, null); break; }
      case "renascer": { const m = M(mat(270, 70, 64)); for (let i = 0; i < 26; i++) { const a = 0.5 + i / 26 * Math.PI * 1.65; f.rect(Math.round(7 + Math.cos(a) * 5.5), Math.round(7 + Math.sin(a) * 5.5), 2, 2, m); } f.poli([[10, 0], [15, 2], [11, 6]], m); break; }
      case "dedo": { const m = M(mat(28, 70, 78)); f.rr(6, 1, 4, 9, 2, m); f.rr(3, 8, 10, 7, 2, m); f.dR(7, 2, 2, 2, "#ffffff"); break; }
      case "motor": { const m = M(METAL_E); f.circ(8, 8, 5.5, m); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; f.rect(Math.round(7 + Math.cos(a) * 6), Math.round(7 + Math.sin(a) * 6), 2, 2, m); } f.circ(8, 8, 2.5, M(mat(16, 85, 58), true)); break; }
      case "fabrica": { const m = M(METAL); f.rect(1, 7, 14, 8, m); f.poli([[1, 7], [5, 3], [5, 7]], m); f.poli([[6, 7], [10, 3], [10, 7]], m); f.rect(12, 1, 3, 7, M(METAL_E)); f.dR(3, 10, 2, 2, "#ffe36b"); f.dR(7, 10, 2, 2, "#ffe36b"); f.dR(11, 10, 2, 2, "#ffe36b"); break; }
      case "esteira": f.rr(0, 9, 16, 5, 2, M(BORRACHA)); f.rr(4, 2, 8, 7, 1, M(mat(30, 55, 52))); f.dR(2, 11, 1, 1, "#9aa3c0"); f.dR(7, 11, 1, 1, "#9aa3c0"); f.dR(12, 11, 1, 1, "#9aa3c0"); break;
      case "linha": { const m = M(METAL); f.poli([[2, 13], [4, 15], [12, 7], [10, 5]], m); f.circ(12, 4, 3.5, m); f.dR(12, 2, 2, 2, null); f.dR(13, 1, 2, 1, null); break; }
      case "escudo": f.poli([[2, 2], [14, 2], [14, 8], [8, 15], [2, 8]], M(mat(205, 80, 60), true)); f.dR(7, 4, 2, 8, "#ffffff"); break;
      case "cofre": f.rr(1, 2, 14, 13, 2, M(METAL_E)); f.circ(8, 8, 3.5, M(METAL)); f.dR(8, 5, 1, 3, "#3a3f58"); break;
      case "raio": f.poli([[9, 0], [3, 9], [7, 9], [5, 16], [13, 6], [9, 6], [11, 0]], M(OURO, true)); break;
      case "reator": f.circ(8, 8, 7, M(METAL_E)); f.circ(8, 8, 4.5, M(mat(188, 90, 66), true)); f.dC(8, 8, 2, "#ffffff"); break;
      case "canhao": f.rr(1, 6, 11, 6, 2, M(METAL_E)); f.rect(11, 7, 4, 4, M(METAL)); f.circ(5, 12, 3, M(mat(18, 52, 40))); break;
      case "prensa": f.rect(2, 1, 12, 4, M(METAL_E)); f.rect(7, 5, 2, 5, M(METAL)); f.rect(3, 10, 10, 3, M(METAL)); f.rect(1, 13, 14, 3, M(BORRACHA)); break;
      case "video": f.rect(1, 5, 14, 10, M(BORRACHA)); f.rect(1, 2, 14, 3, M(METAL)); f.dR(4, 2, 1, 3, "#3a3f58"); f.dR(8, 2, 1, 3, "#3a3f58"); f.dR(12, 2, 1, 3, "#3a3f58"); f.dR(6, 7, 1, 6, "#ffffff"); f.dR(7, 8, 1, 4, "#ffffff"); f.dR(8, 9, 1, 2, "#ffffff"); break;
      case "cadeado": f.rect(4, 2, 2, 5, M(METAL)); f.rect(10, 2, 2, 5, M(METAL)); f.rect(4, 1, 8, 2, M(METAL)); f.rr(2, 7, 12, 8, 1, M(OURO)); f.dR(7, 9, 2, 3, "#5d4a10"); break;
      case "missil": f.poli([[1, 13], [3, 15], [12, 6], [10, 4]], M(METAL)); f.poli([[10, 4], [15, 1], [12, 6]], M(mat(356, 78, 56), true)); f.dR(1, 11, 2, 2, "#ffa53d"); break;
      case "choque": f.poli([[9, 0], [3, 9], [7, 9], [5, 16], [13, 6], [9, 6], [11, 0]], M(mat(188, 90, 66), true)); break;
      case "conserto": { const m = M(mat(140, 62, 52)); f.rr(6, 1, 4, 14, 1, m); f.rr(1, 6, 14, 4, 1, m); break; }
      case "sobrecarga": f.circ(8, 9, 6, M(mat(356, 78, 56), true)); f.dR(7, 5, 2, 5, "#ffffff"); f.dR(7, 11, 2, 2, "#ffffff"); break;
      case "trofeu": { const o = M(OURO, true); f.rr(4, 1, 8, 7, 2, o); f.rect(1, 2, 3, 3, o); f.rect(12, 2, 3, 3, o); f.rect(7, 8, 2, 3, o); f.rr(4, 11, 8, 4, 1, M(mat(18, 52, 40))); break; }
      case "engrenagem": { const m = M(mat(40, 70, 52)); f.circ(8, 8, 5.5, m); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; f.rect(Math.round(7 + Math.cos(a) * 6), Math.round(7 + Math.sin(a) * 6), 2, 2, m); } f.dC(8, 8, 2, "#3a2a10"); break; }
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
