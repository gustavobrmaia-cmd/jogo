"use strict";

// =========================
// ARTE DAS ARMAS (v19) — armas na mão, ícones, projéteis, feixes, avisos, caixas, clarão da boca do cano,
// cápsulas/pedaços que voam e o estado das bolinhas (bolha, gosma, inflado, tonto, bomba grudada).
// Estilo cartoon arcade (direção de arte v19): contorno escuro e grosso (#1a0d33), cel-shading em 3 tons duros
// (base, sombra, sombra funda), meia-lua de luz no alto de cada peça, cores saturadas.
// Raridade: comum sem brilho, rara com contorno de luz azul-violeta, lendária dourada com brilho correndo.
// Tudo é desenhado UMA vez em sprites (canvas fora da tela) e depois só drawImage (sem gradiente por quadro).
// Convenção das armas: sprite aponta para +x, o eixo do cano é y = 0, (0,0) é onde a arma fica ao lado
// da bolinha (a mão fica em "h").
// =========================
const ArteArmas = (function() {
  const TAU = Math.PI * 2, E = 1.4;         // E = pixels por unidade dos sprites (a arma na mão é desenhada em escala 1,3: quase 1:1, barato)
  const DIST = 1.0, ESC = 1.3;                        // distância da arma ao centro da bolinha (em raios)
  const agora = function() { return performance.now() / 1000; };

  // ---------- cor ----------
  const cc = {};
  function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return "#" + [0, 1, 2].map(function(i) { return ("0" + Math.round(A[i] + (B[i] - A[i]) * t).toString(16)).slice(-2); }).join("");
  }
  // b = base, s = sombra, s2 = sombra funda, l = luz (meia-lua), o = contorno (o mesmo escuro em tudo)
  const OUT = "#1a0d33";
  function pal(c) { return cc[c] || (cc[c] = { b: c, s: mix(c, "#2b1a6e", 0.36), s2: mix(c, "#1a0d33", 0.62), l: mix(c, "#ffffff", 0.58), o: OUT }); }
  // v19: paleta mais saturada (metal azulado/roxo para casar com os fundos profundos)
  const K = {
    ac: "#b7c4ea", ac2: "#8492c9", fe: "#5d5f9e", pr: "#3d3474", mad: "#e3924a", mad2: "#a95f2e", ou: "#ffc93c",
    ve: "#ff5a5f", az: "#45a8ff", ci: "#35e0f0", vd: "#5bd96a", rx: "#a66bff", rs: "#ff7ab8", lj: "#ff8a2e",
    br: "#f6f7ff", am: "#ffdd4a", ol: "#78a64f", ol2: "#4f7a37", ge: "#8fe9ff", gs: "#7bd94f"
  };
  let LW = 1.7;                              // espessura do contorno das peças (projéteis usam um pouco menos)

  // ---------- canvas / sprites ----------
  function cv(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  let G = null;                              // contexto atual dos desenhos de sprite
  // sprite com caixa (x0,y0)-(x1,y1) em unidades de mundo; fn desenha com (0,0) na origem
  // e = pixels do canvas por unidade do mundo; d = tamanho de exibição por unidade (d = e deixa o sprite 1:1, bem mais barato de desenhar)
  function spr(x0, y0, x1, y1, fn, e, d) {
    e = e || E; d = d || 1;
    const c = cv((x1 - x0) * e, (y1 - y0) * e), g = c.getContext("2d");
    g.scale(e, e); g.translate(-x0, -y0);
    const ant = G; G = g; fn(g); G = ant;
    return { c: c, x: x0 * d, y: y0 * d, w: (x1 - x0) * d, h: (y1 - y0) * d };
  }
  const cache = {};
  function sp(chave, x0, y0, x1, y1, fn, e, d) { return cache[chave] || (cache[chave] = spr(x0, y0, x1, y1, fn, e, d)); }
  let KK = 1;                                // escala visual do projétil atual (sprites já nascem nesse tamanho)
  function ps(chave, x0, y0, x1, y1, fn) {
    if (cache[chave]) return cache[chave];
    const lw0 = LW; LW = 1.25;                        // contorno um pouco mais fino nos projéteis (são pequenos)
    const s = spr(x0, y0, x1, y1, fn, KK, KK);
    LW = lw0;
    const w = s.c.width, h = s.c.height;
    // lê os pixels num canvas próprio para leitura (sem o aviso de "readback" do navegador)
    if (!ps.lei || ps.lei.width < w || ps.lei.height < h) { ps.lei = cv(Math.max(w, 256), Math.max(h, 256)); ps.lg = ps.lei.getContext("2d", { willReadFrequently: true }); }
    ps.lg.clearRect(0, 0, w, h); ps.lg.drawImage(s.c, 0, 0);
    const d = ps.lg.getImageData(0, 0, w, h).data;
    let ax = w, ay = h, bx = 0, by = 0;                  // recorta o transparente: menos pixels por desenho
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < ax) ax = x; if (x > bx) bx = x; if (y < ay) ay = y; if (y > by) by = y; }
    if (bx < ax) return (cache[chave] = s);
    ax = Math.max(0, ax - 1); ay = Math.max(0, ay - 1); bx = Math.min(w - 1, bx + 1); by = Math.min(h - 1, by + 1);
    const c = cv(bx - ax + 1, by - ay + 1); c.getContext("2d").drawImage(s.c, -ax, -ay);
    return (cache[chave] = { c: c, x: s.x + ax, y: s.y + ay, w: bx - ax + 1, h: by - ay + 1 });
  }
  function blit(ctx, s, x, y, a, e, al) {
    ctx.save(); ctx.translate(x, y);
    if (a) ctx.rotate(a);
    if (e && e !== 1) ctx.scale(e, e);
    if (al !== undefined) ctx.globalAlpha = al;
    ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
    ctx.restore();
  }
  // brilho suave (disco com gradiente, feito uma vez por cor)
  function brilho(cor) {
    return cache["gl" + cor] || (cache["gl" + cor] = (function() {
      const c = cv(64, 64), g = c.getContext("2d"), r = rgb(cor), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(" + r + ",0.95)"); gr.addColorStop(0.4, "rgba(" + r + ",0.4)"); gr.addColorStop(1, "rgba(" + r + ",0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return c;
    })());
  }
  function aura(ctx, cor, x, y, r, al) { ctx.globalAlpha = al; ctx.drawImage(brilho(cor), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }

  // ---------- caminhos (devolvem função que monta o caminho em g) ----------
  function pR(x, y, w, h, r) {
    return function(g) {
      const q = Math.min(r, w / 2, h / 2);
      g.beginPath(); g.moveTo(x + q, y); g.arcTo(x + w, y, x + w, y + h, q); g.arcTo(x + w, y + h, x, y + h, q);
      g.arcTo(x, y + h, x, y, q); g.arcTo(x, y, x + w, y, q); g.closePath();
    };
  }
  function pC(x, y, r) { return function(g) { g.beginPath(); g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); g.closePath(); }; }
  function pE(x, y, rx, ry, rot) {
    return function(g) { const c = Math.cos(rot || 0), s = Math.sin(rot || 0); g.beginPath(); g.moveTo(x + rx * c, y + rx * s); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); g.closePath(); };
  }
  // monta o caminho sem começar um novo (para juntar duas cópias e pintar a diferença com "evenodd")
  function semBegin(g, path) { const bp = g.beginPath; g.beginPath = function() {}; try { path(g); } finally { g.beginPath = bp; } }
  function pP(a) {
    return function(g) { g.beginPath(); g.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) g.lineTo(a[i], a[i + 1]); g.closePath(); };
  }
  function pT(x1, y1, x2, y2, w) {          // cápsula entre dois pontos
    return function(g) {
      const L = Math.hypot(x2 - x1, y2 - y1);
      g.save(); g.translate(x1, y1); g.rotate(Math.atan2(y2 - y1, x2 - x1)); pR(-w / 2, -w / 2, L + w, w, w / 2)(g); g.restore();
    };
  }
  function estrela(cx, cy, Ro, Ri, n, rot) {
    const a = [];
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? Ri : Ro, t = rot + i * Math.PI / n; a.push(cx + Math.cos(t) * r, cy + Math.sin(t) * r); }
    return a;
  }

  // ---------- peça com cel-shading (v19): 3 tons duros (sombra funda, sombra, base), meia-lua de luz no alto
  // e contorno escuro grosso. k = tamanho da sombra (0 = peça chapada só com contorno) ----------
  function cel(path, col, k, inner) {
    const g = G, p = pal(col); k = k == null ? 2 : k;
    g.save(); path(g); g.fillStyle = k > 0.2 ? p.s2 : p.b; g.fill(); g.clip();
    if (k > 0.2) {
      g.save(); g.translate(-k * 0.3, -k * 0.45); path(g); g.fillStyle = p.s; g.fill(); g.restore();
      g.save(); g.translate(-k * 0.75, -k * 1.05); path(g); g.fillStyle = p.b; g.fill(); g.restore();
      // meia-lua de luz: a parte da peça que some quando ela desce um pouco (borda de cima)
      g.beginPath(); semBegin(g, path); g.save(); g.translate(k * 0.35, k * 0.7 + 0.7); semBegin(g, path); g.restore();
      g.fillStyle = p.l; g.globalAlpha = 0.92; g.fill("evenodd"); g.globalAlpha = 1;
    }
    if (inner) inner(g);
    g.restore();
    path(g); g.lineWidth = LW; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke();
  }
  const R = function(x, y, w, h, r, c, k, i) { cel(pR(x, y, w, h, r), c, k, i); };
  const C = function(x, y, r, c, k, i) { cel(pC(x, y, r), c, k, i); };
  const El = function(x, y, rx, ry, rot, c, k, i) { cel(pE(x, y, rx, ry, rot), c, k, i); };
  const P = function(a, c, k, i) { cel(pP(a), c, k, i); };
  const T = function(x1, y1, x2, y2, w, c, k, i) { cel(pT(x1, y1, x2, y2, w), c, k === undefined ? 1 : k, i); };
  function fl(path, col, al) { const g = G; path(g); g.globalAlpha = al === undefined ? 1 : al; g.fillStyle = col; g.fill(); g.globalAlpha = 1; }
  function ln(x1, y1, x2, y2, w, col, al) {
    const g = G; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineCap = "round"; g.lineWidth = w; g.strokeStyle = col;
    g.globalAlpha = al === undefined ? 1 : al; g.stroke(); g.globalAlpha = 1;
  }
  function trc(path, w, col, al) { const g = G; path(g); g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = w; g.strokeStyle = col; g.globalAlpha = al === undefined ? 1 : al; g.stroke(); g.globalAlpha = 1; }
  // tubo curvo com volume (arco, boomerangue...): contorno, sombra, base e luz
  function tb(path, w, col) {
    const g = G, p = pal(col);
    trc(path, w + LW * 2, OUT); trc(path, w, p.s2);
    g.save(); g.translate(-w * 0.06, -w * 0.1); trc(path, w * 0.8, p.s); g.restore();
    g.save(); g.translate(-w * 0.12, -w * 0.2); trc(path, w * 0.6, p.b); g.restore();
    g.save(); g.translate(-w * 0.2, -w * 0.3); trc(path, w * 0.2, p.l, 0.95); g.restore();
  }
  function curva(g, a) { // moveTo + curvas quadráticas de um vetor [x,y, cx,cy,x,y, ...]
    g.beginPath(); g.moveTo(a[0], a[1]);
    for (let i = 2; i < a.length; i += 4) g.quadraticCurveTo(a[i], a[i + 1], a[i + 2], a[i + 3]);
  }
  // clarão de faísca (estrela de 4 pontas)
  function faisca(x, y, s, col) { fl(pP(estrela(x, y, s, s * 0.22, 4, 0)), col); }
  // chama (gota com duas caudas) com 2 camadas
  function chama(x, y, s, c1, c2) {
    const f = function(k) {
      return function(g) {
        g.beginPath(); g.moveTo(x + 14 * s * k, y);
        g.bezierCurveTo(x + 14 * s * k, y - 8 * s * k, x + 6 * s * k, y - 11 * s * k, x, y - 10 * s * k);
        g.bezierCurveTo(x - 4 * s * k, y - 9 * s * k, x - 9 * s * k, y - 13 * s * k, x - 15 * s * k, y - 11 * s * k);
        g.bezierCurveTo(x - 9 * s * k, y - 6 * s * k, x - 9 * s * k, y - 2 * s * k, x - 13 * s * k, y);
        g.bezierCurveTo(x - 9 * s * k, y + 2 * s * k, x - 9 * s * k, y + 6 * s * k, x - 15 * s * k, y + 11 * s * k);
        g.bezierCurveTo(x - 9 * s * k, y + 13 * s * k, x - 4 * s * k, y + 9 * s * k, x, y + 10 * s * k);
        g.bezierCurveTo(x + 6 * s * k, y + 11 * s * k, x + 14 * s * k, y + 8 * s * k, x + 14 * s * k, y);
        g.closePath();
      };
    };
    cel(f(1), c1, 2); fl(f(0.55), c2);
  }
  function bolinhas(x, y, n, dx, col) { for (let i = 0; i < n; i++) C(x + i * dx, y, 2.2, col, 0.6); }

  // =========================================================
  // AS 60 ARMAS NA MÃO. d = desenho; m = boca do cano; h/h2 = mãos; n = brilho pulsante [x,y,r,cor];
  // mel = tipo de golpe; ir = rotação do ícone; sh = sem mão separada
  // =========================================================
  const W = {
    estilingue: { m: [22, 0], h: [-4, 3], d: function() {
      tb(function(g) { g.beginPath(); g.moveTo(-13, 0); g.lineTo(5, 0); }, 8, K.mad2);
      tb(function(g) { curva(g, [4, 0, 13, -1, 21, -14]); }, 7, K.mad); tb(function(g) { curva(g, [4, 0, 13, 1, 21, 14]); }, 7, K.mad);
      trc(function(g) { g.beginPath(); g.moveTo(21, -14); g.lineTo(8, 0); g.lineTo(21, 14); }, 3.4, "#8e2338"); trc(function(g) { g.beginPath(); g.moveTo(21, -14); g.lineTo(8, 0); g.lineTo(21, 14); }, 2.2, "#e4506b");
      El(8, 0, 4.4, 3.8, 0, "#b98a62", 0.8); C(9, 0, 3.4, "#a6adc2", 0.7);
    } },
    pistola: { m: [30, -1], h: [0, 10], d: function() {
      P([-5, 3, 7, 3, 5, 18, -8, 18], K.pr); trc(function(g) { g.beginPath(); g.moveTo(7, 4); g.quadraticCurveTo(15, 5, 12, 10); }, 2, K.fe);
      R(-8, -7, 38, 11, 3, K.ac); R(-8, -7, 9, 11, 3, K.ac2); R(27, -6, 4, 9, 1.5, K.fe);
      R(-6, -10, 4, 3, 1, K.fe, 0.5); R(24, -10, 3, 3, 1, K.fe, 0.5); ln(5, -4, 22, -4, 1.2, K.ac2);
    } },
    revolver: { m: [37, -2], h: [-1, 11], d: function() {
      P([-8, 3, 5, 3, 9, 17, -2, 21, -10, 13], K.mad2); R(-7, -9, 18, 15, 4, K.ac2); R(10, -7, 27, 9, 2, K.ac);
      R(12, -9, 25, 3, 1.5, K.fe, 0.5); R(1, -10, 12, 16, 3, K.ac, 1.5, function(g) { ln(4, -8, 4, 4, 1, K.fe); ln(10, -8, 10, 4, 1, K.fe); });
      P([-8, -9, -4, -13, -1, -8], K.fe, 0.5); C(-2, 6, 1.6, K.ou, 0.4); R(34, -8, 4, 11, 1.5, K.ou, 0.8);
    } },
    submetralhadora: { m: [40, 0], h: [-6, 12], h2: [20, 6], d: function() {
      ln(-12, -1, -24, -2, 2, K.fe); ln(-24, -2, -24, 5, 2, K.fe);
      R(-12, -7, 37, 13, 3, K.pr); R(-8, -10, 20, 3, 1, K.fe, 0.5); R(24, -5, 14, 10, 2, K.ac2, 1.5, function(g) { for (let i = 0; i < 3; i++) ln(27 + i * 4, -3, 27 + i * 4, 3, 1.2, K.pr); });
      R(36, -4, 5, 8, 1.5, K.fe, 0.8); P([4, 5, 14, 5, 13, 26, 4, 26], K.ac2); R(4, 22, 9, 4, 1, K.ou, 0.6); P([-10, 5, -2, 5, -4, 18, -12, 18], K.fe);
    } },
    minigun: { m: [49, 0], h: [3, 17], d: function() {
      R(-15, 6, 22, 15, 3, K.ol2, 1.5, function() { for (let i = 0; i < 4; i++) ln(-11 + i * 5, 7, -11 + i * 5, 20, 1.1, K.ol); });
      R(-16, -10, 26, 20, 6, K.fe); R(-14, -10, 7, 20, 3, K.ou, 1); R(10, -9, 36, 5.5, 2, K.ac); R(10, -2.7, 36, 5.5, 2, K.ac2); R(10, 3.5, 36, 5.5, 2, K.ac);
      R(26, -11, 5, 22, 2, K.fe, 0.8); R(44, -11, 5, 22, 2, K.fe, 0.8); R(10, -11, 4, 22, 2, K.ac2, 0.8); P([-1, 9, 7, 9, 6, 21, -2, 21], K.pr);
    } },
    escopeta: { m: [47, -3], h: [-2, 9], h2: [22, 7], d: function() {
      P([-31, -2, -8, -5, -8, 6, -25, 12, -32, 5], K.mad); R(-9, -6, 19, 12, 3, K.ac2); R(8, -6, 39, 5.5, 2, K.ac); R(8, 0, 31, 4.5, 2, K.ac2);
      R(17, 0, 13, 8, 3, K.mad2, 1, function(g) { for (let i = 0; i < 3; i++) ln(21 + i * 3.5, 1, 21 + i * 3.5, 8, 1, K.pr); });
      R(44, -7, 4, 7, 1.5, K.ou, 0.6); trc(function(g) { g.beginPath(); g.moveTo(1, 5); g.quadraticCurveTo(9, 6, 6, 11); }, 2, K.fe);
    } },
    escopeta_dupla: { m: [47, -3], h: [-2, 9], h2: [22, 7], d: function() {
      P([-31, -2, -8, -5, -8, 6, -25, 12, -32, 5], K.mad2); R(-9, -8, 19, 14, 3, K.ac2, 2, function() { ln(-6, -4, 6, -4, 1.4, K.ou); ln(-6, 1, 6, 1, 1.4, K.ou); });
      R(8, -8, 39, 6, 2.5, K.ac); R(8, -2, 39, 6, 2.5, K.ac); R(14, -9, 4, 13, 1.5, K.ou, 0.8); R(30, -9, 4, 13, 1.5, K.ou, 0.8);
      R(17, 3, 14, 7, 3, K.mad, 1); R(45, -9, 3, 7, 1, K.fe, 0.5); R(45, -3, 3, 7, 1, K.fe, 0.5);
    } },
    rifle: { m: [55, -1], h: [-3, 12], h2: [28, 6], d: function() {
      // coronha de madeira com soleira de borracha e faixa laranja
      P([-29, -5, -8, -6.5, -8, 6, -21, 11, -30, 6], K.mad, 2, function() { ln(-26, -1, -11, -2, 1.3, K.mad2, 0.7); ln(-24, 4, -12, 3, 1.1, K.mad2, 0.5); });
      P([-34, -5.5, -29, -5, -30, 6, -35, 7], K.pr, 0.8);
      // carregador curvo (banana) com faixa amarela
      cel(function(g) { g.beginPath(); g.moveTo(8, 4); g.lineTo(17, 4); g.quadraticCurveTo(18, 14, 21, 22); g.lineTo(12, 25); g.quadraticCurveTo(9, 15, 8, 4); g.closePath(); }, "#4c5577", 1.6, function() { ln(10.5, 15, 19, 13, 2, K.am, 0.95); });
      // corpo com janela de ejeção e ferrolho
      R(-9, -7, 26, 12, 3, "#6a7499", 2, function() { fl(pR(2, -4.5, 9, 3.4, 1.2), K.pr, 0.9); ln(-6, 2.5, 14, 2.5, 1.2, "#4c5577", 0.8); });
      C(-4, -1.5, 1.8, K.ou, 0.5);
      // guarda-mão de madeira com furos de ventilação
      R(15, -6, 22, 10, 3, K.mad, 1.8, function() { for (let i = 0; i < 3; i++) fl(pR(19 + i * 5.6, -3, 3, 4, 1.4), "#7a4a2a", 0.95); });
      // cano + freio de boca com fendas
      R(36, -3.5, 16, 5, 1.5, K.ac); R(40, -8, 3, 4.5, 1, K.fe, 0.4);
      R(50, -5.2, 6, 8.4, 1.8, K.fe, 0.8, function() { ln(52, -3.5, 52, 1.5, 1, K.pr, 0.9); ln(54, -3.5, 54, 1.5, 1, K.pr, 0.9); });
      // trilho e mira de ponto vermelho (lente brilhando)
      R(-4, -11, 20, 4.5, 1.5, K.ac2, 0.6); R(1, -17.5, 12, 7.5, 2.6, K.pr, 1);
      fl(pC(10.5, -13.8, 2.4), "#ff4a5a"); fl(pC(10, -14.4, 0.9), "#ffd0d6");
      // punho
      P([-9, 5, -2, 5, -4, 18, -11, 18], K.pr, 1.4, function() { ln(-8.5, 9, -3.5, 9, 1, K.fe, 0.8); ln(-9, 13, -4, 13, 1, K.fe, 0.8); });
      trc(function(g) { g.beginPath(); g.moveTo(-1, 5); g.quadraticCurveTo(6, 6, 4, 11); }, 1.8, K.fe);
    } },
    sniper: { m: [67, -1], h: [-3, 11], h2: [30, 7], d: function() {
      P([-33, -4, -10, -6, -10, 5, -26, 11, -34, 4], K.ol2); R(-10, -7, 28, 12, 3, K.fe); R(16, -4.5, 51, 5, 1.8, K.ac); R(48, -6.5, 18, 9, 2.5, K.pr);
      R(0, -9, 4, 4, 1, K.ac2, 0.5); R(20, -9, 4, 4, 1, K.ac2, 0.5);
      R(-4, -17, 33, 9, 4, K.pr); R(26, -18, 6, 11, 2.5, K.ci, 1); R(-7, -18, 5, 11, 2.5, K.ci, 1); ln(1, -15, 24, -15, 1.4, K.ac2, 0.7);
      T(2, -3, -1, -8, 2.5, K.ac2); C(-1, -8, 2.2, K.ac2, 0.5); ln(34, 2, 28, 18, 2.4, K.fe); ln(38, 2, 45, 18, 2.4, K.fe);
      P([-10, 5, -2, 5, -4, 17, -12, 17], K.pr);
    } },
    plasma: { m: [31, -1], h: [0, 10], n: [12, -1, 14, "#3de8c0"], d: function() {
      P([-4, 4, 7, 4, 6, 17, -6, 17], K.rx); R(-9, -9, 30, 14, 6.5, K.br); R(-9, 0, 30, 5, 2.5, K.ac2, 0.8);
      El(12, -2, 7.5, 3.8, 0, "#3de8c0", 1); fl(pE(10.5, -3, 3.2, 1.3, 0), "#e8fff9"); R(22, -8, 6, 14, 2.5, K.rx, 1); R(27, -6, 4, 10, 2, K.fe, 0.8); R(-9, -12, 10, 4, 2, K.rx, 0.8);
    } },
    pula_pula: { m: [43, -1], h: [0, 11], d: function() {
      P([-4, 5, 6, 5, 5, 18, -5, 18], K.az); R(-8, -8, 20, 15, 6, K.rs);
      for (let i = 0; i < 5; i++) { const x = 15 + i * 4.4, f = function(g) { g.beginPath(); g.ellipse(x, -1, 2.6, 8.5, 0, 0, TAU); }; trc(f, 4.4, "#8a5a00"); trc(f, 2.4, K.ou); }
      C(41, -1, 8.5, "#8be04b", 2, function(g) { trc(function(g) { g.beginPath(); g.arc(41, -1, 6, 0.7, 2.4); }, 2.2, "#fff"); });
    } },
    confete: { m: [30, 0], h: [0, 2], d: function() {
      P([-7, -2.5, 27, -14, 27, 14, -7, 2.5], K.br, 2, function(g) {
        const cs = [K.rs, K.am, K.az, K.rs, K.am, K.az];
        for (let i = 0; i < 6; i++) { g.fillStyle = cs[i]; g.fillRect(-7 + i * 6, -20, 3.2, 40); }
      });
      El(27, 0, 3.6, 14, 0, K.pr, 1); const cs = [K.rs, K.am, K.az, K.vd];
      for (let i = 0; i < 7; i++) { G.save(); G.translate(33 + (i % 3) * 5, -9 + i * 3); G.rotate(i * 1.3); fl(pR(-2, -1, 4, 2.2, 0.4), cs[i % 4]); G.restore(); }
    } },
    arma_agua: { m: [37, -1], h: [0, 11], d: function() {
      P([-4, 5, 7, 5, 6, 18, -6, 18], K.lj); R(-9, -7, 33, 13, 6, K.am); R(2, -19, 19, 13, 5, K.ci, 1.5, function(g) { g.fillStyle = "#2fa8d8"; g.fillRect(0, -11, 30, 20); ln(5, -16, 17, -16, 1.6, "#fff", 0.85); });
      R(23, -5, 10, 9, 3, K.rs); R(31, -4, 6, 7, 2.5, K.br, 1); R(7, 5, 12, 5, 2.5, K.az, 0.8);
    } },
    zarabatana: { m: [51, 0], h: [10, 4], d: function() {
      R(-14, -3.4, 64, 6.8, 3.4, "#b9d174", 1.4, function(g) { for (const x of [4, 24, 42]) { g.fillStyle = "#7f9a45"; g.fillRect(x, -5, 2.4, 10); } });
      R(-19, -4.6, 7, 9.2, 3.5, K.pr, 1); R(46, -2.6, 6, 5.2, 2, K.ou, 0.6);
    } },
    onda_sonora: { m: [31, 0], h: [3, 11], d: function() {
      P([-4, -6, 25, -15, 25, 15, -4, 6], K.ve); R(-10, -7, 7, 14, 3.5, K.fe, 1); El(25, 0, 4.4, 15.4, 0, K.br, 1.4); El(26.3, 0, 2.8, 11.5, 0, K.pr, 0.5);
      R(2, 5, 7, 13, 2.5, K.pr, 1);
      for (let i = 0; i < 3; i++) trc(function(g) { g.beginPath(); g.arc(30, 0, 9 + i * 8, -0.6, 0.6); }, 2.6 - i * 0.4, K.ge, 0.95 - i * 0.22);
    } },
    shuriken: { m: [27, 0], h: [1, 3], d: function() {
      P(estrela(15, 0, 14, 4.5, 4, 0.4), "#c6d0e6", 2.5); C(15, 0, 3.4, K.pr, 0.5); ln(18, -6, 20, -9, 1.6, "#fff", 0.8);
    } },
    bumerangue: { m: [26, 0], h: [3, 3], d: function() {
      tb(function(g) { curva(g, [6, -22, 22, -13, 25, 0]); g.quadraticCurveTo(22, 13, 6, 22); }, 9, K.lj);
      trc(function(g) { curva(g, [9.5, -19.5, 17, -16, 20, -9.5]); }, 2.4, K.am, 0.9); trc(function(g) { curva(g, [9.5, 19.5, 17, 16, 20, 9.5]); }, 2.4, K.am, 0.9);
    } },
    arco: { m: [43, 0], h: [13, 1], d: function() {
      flecha(2, 0, 0, K.br);
      tb(function(g) { g.beginPath(); g.moveTo(2, -27); g.bezierCurveTo(19, -15, 19, 15, 2, 27); }, 5, K.mad); ln(2, -27, 2, 27, 1.2, "#efe8cc"); R(11, -6, 5, 12, 2, K.mad2, 0.8);
    } },
    arco_triplo: { m: [43, 0], h: [13, 1], d: function() {
      flecha(2, 0, -0.3, K.ou); flecha(2, 0, 0.3, K.ou); flecha(2, 0, 0, K.br);
      tb(function(g) { g.beginPath(); g.moveTo(2, -28); g.bezierCurveTo(20, -15, 20, 15, 2, 28); }, 5.5, K.ou); ln(2, -28, 2, 28, 1.2, "#efe8cc"); R(12, -6, 5, 12, 2, K.rx, 0.8);
    } },
    besta: { m: [45, -1], h: [-4, 10], h2: [18, 5], d: function() {
      R(-20, -4, 46, 8, 3, K.mad); R(-22, -3, 12, 9, 3, K.mad2); ln(5, -5.5, 40, -5.5, 2.4, K.ac2);
      tb(function(g) { g.beginPath(); g.moveTo(28, -26); g.quadraticCurveTo(18, -9, 19, 0); g.quadraticCurveTo(18, 9, 28, 26); }, 4.6, K.pr);
      ln(28, -26, 3, 0, 1.2, "#efe8cc"); ln(28, 26, 3, 0, 1.2, "#efe8cc");
      ln(4, -5, 39, -5, 2.2, K.pr); P([38, -9, 47, -5, 38, -1], K.ac); P([-6, 3, 2, 3, 0, 15, -8, 15], K.mad2);
    } },
    serra: { m: [40, 0], h: [-2, 0], d: function() {
      R(-9, -3.4, 24, 6.8, 3.4, K.lj); R(8, -8, 5, 16, 2, K.fe, 0.8);
      P(estrela(25, 0, 17, 13.5, 14, 0.1), K.ac, 1.5); C(25, 0, 10, K.ac2, 1.2); C(25, 0, 3.8, K.ou, 0.8); C(25, 0, 1.4, K.pr, 0);
    } },
    bola_neve: { m: [27, 0], h: [4, 4], d: function() {
      C(16, 0, 12.5, "#f1f7ff", 2.6); C(23, -8, 3.6, "#f1f7ff", 0.8); C(8, 7, 3.4, "#f1f7ff", 0.8); ln(13, -7, 18, -8, 1.8, "#fff", 0.8);
    } },
    gancho: { m: [43, 0], h: [-1, 11], d: function() {
      P([-4, 4, 6, 4, 5, 17, -5, 17], K.pr); R(-9, -7, 26, 12, 4.5, K.fe); C(-2, -10, 8, K.lj, 1.5, function(g) { trc(pC(-2, -10, 4.4), 1.8, "#7a3e12"); });
      R(15, -4.5, 12, 8, 2, K.ac2);
      T(26, 0, 38, 0, 4, K.ac); tb(function(g) { g.beginPath(); g.moveTo(36, 0); g.quadraticCurveTo(43, -3, 40, -15); }, 3.4, K.ac); tb(function(g) { g.beginPath(); g.moveTo(36, 0); g.quadraticCurveTo(43, 3, 40, 15); }, 3.4, K.ac);
    } },
    bazuca: { m: [57, 0], h: [3, 15], h2: [26, 9], d: function() {
      P([43, -6.5, 57, -1, 57, 1, 43, 6.5], K.ve); R(-26, -8, 70, 17, 6.5, K.ol, 2, function(g) { g.fillStyle = K.am; g.fillRect(-4, -12, 4, 30); g.fillRect(16, -12, 4, 30); });
      R(-31, -11, 8, 23, 3.5, K.ol2); R(40, -11, 6, 23, 3.5, K.ol2); R(6, -14, 12, 5, 2, K.fe, 0.8); P([0, 8, 9, 8, 8, 20, -1, 20], K.pr);
    } },
    lanca_granadas: { m: [47, -1], h: [-4, 12], h2: [24, 6], d: function() {
      P([-26, -2, -6, -5, -6, 5, -20, 9, -27, 3], K.mad); R(5, -7, 38, 10, 3.5, K.fe);
      R(-4, -12, 20, 19, 5, K.ol, 2, function(g) { for (let i = 0; i < 4; i++) ln(i * 5, -11, i * 5, 6, 1.2, K.ol2); });
      R(41, -9, 7, 14, 2.5, K.ac2, 1); R(6, -13, 3, 5, 1, K.fe, 0.4); P([-4, 7, 4, 7, 3, 19, -5, 19], K.pr);
    } },
    granada: { m: [27, 0], h: [4, 5], d: function() {
      El(16, 2, 11.5, 13.5, 0, K.ol, 2.4, function(g) { for (let i = -2; i <= 2; i++) ln(5, 2 + i * 5, 28, 2 + i * 5, 1.2, K.ol2); ln(16, -12, 16, 15, 1.2, K.ol2); });
      R(11, -17, 10, 6, 2, K.fe, 0.8); tb(function(g) { g.beginPath(); g.moveTo(20, -15); g.quadraticCurveTo(29, -12, 27, 2); }, 2.8, K.ac);
      trc(pC(12, -21, 3.6), 1.8, K.ou);
    } },
    dinamite: { m: [38, -8], h: [2, 7], d: function() {
      R(-6, -12, 35, 8, 3, K.ve); R(-9, -5, 35, 8, 3, K.ve); R(-5, 2, 35, 8, 3, K.ve);
      R(5, -13, 4, 25, 1.5, K.pr, 0.8); R(17, -13, 4, 25, 1.5, K.pr, 0.8);
      tb(function(g) { g.beginPath(); g.moveTo(28, -8); g.quadraticCurveTo(36, -9, 36, -17); }, 2.2, "#e0c9a0"); faisca(36, -19, 6, K.am); faisca(36, -19, 3, "#fff");
    } },
    fragmentacao: { m: [27, 0], h: [4, 5], d: function() {
      El(16, 2, 12, 13.5, 0, "#4a526f", 2.4, function(g) { for (let i = -3; i <= 3; i++) { ln(4 + i * 6, -12, 22 + i * 6, 16, 1.2, K.lj, 0.9); ln(28 + i * 6, -12, 10 + i * 6, 16, 1.2, K.lj, 0.9); } });
      R(11, -17, 10, 6, 2, K.fe, 0.8); tb(function(g) { g.beginPath(); g.moveTo(20, -15); g.quadraticCurveTo(29, -12, 27, 2); }, 2.8, K.ac);
      trc(pC(12, -21, 3.6), 1.8, K.ve);
    } },
    canhao: { m: [41, 0], h: [6, 12], d: function() {
      C(-12, 0, 5.5, K.pr, 1); tb(function(g) { g.beginPath(); g.moveTo(-14, -4); g.quadraticCurveTo(-18, -11, -12, -14); }, 2.2, "#e0c9a0"); faisca(-12, -16, 5, K.am);
      P([-8, -9, 36, -7, 36, 7, -8, 10], "#454c6b", 2.2, function(g) { g.fillStyle = K.ou; g.fillRect(0, -12, 3.5, 24); g.fillRect(12, -12, 3.5, 24); });
      R(34, -10, 7, 20, 3, K.fe, 1.2); R(-6, 8, 28, 7, 3, K.mad); C(8, 16, 7, K.mad2, 1.2); C(8, 16, 2.2, K.ou, 0.3);
    } },
    mini_misseis: { m: [35, 0], h: [-2, 14], d: function() {
      R(-11, -13, 37, 26, 5, K.fe, 2, function(g) { g.fillStyle = K.am; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-9 + i * 7, 14); g.lineTo(-5 + i * 7, 14); g.lineTo(1 + i * 7, 8); g.lineTo(-3 + i * 7, 8); g.fill(); } });
      for (let i = -1; i <= 1; i++) { R(22, i * 8 - 3.6, 7, 7.2, 1.8, K.br, 0.8); P([28, i * 8 - 3.6, 36, i * 8, 28, i * 8 + 3.6], K.ve, 0.6); }
      P([-3, 12, 5, 12, 4, 22, -4, 22], K.pr);
    } },
    missil: { m: [54, 0], h: [3, 14], h2: [28, 8], d: function() {
      P([-18, -7, -26, -15, -10, -7], K.fe, 0.8); P([-18, 7, -26, 15, -10, 7], K.fe, 0.8);
      R(-18, -7.5, 50, 15, 6, "#dfe5f2", 2, function(g) { g.fillStyle = K.ve; g.fillRect(0, -12, 6, 24); g.fillRect(12, -12, 3, 24); });
      P([30, -7, 53, 0, 30, 7], K.am, 1.5); R(-6, -13, 14, 6, 2.5, K.fe, 0.8); C(2, -16, 3.4, K.ci, 0.6); P([0, 8, 9, 8, 8, 20, -1, 20], K.pr);
    } },
    abelhas: { m: [30, -2], h: [3, 7], d: function() {
      const cs = [K.ou, "#f2b330", K.ou, "#f2b330", K.ou];
      for (let i = 0; i < 4; i++) El(15, 9 - i * 6.3, 13 - i * 2.2, 5, 0, cs[i], 1.2);
      C(15, -16, 3.2, "#f2b330", 0.8); El(15, 9, 4.4, 3.4, 0, K.pr, 0.5);
      for (const b of [[31, -9], [27, 9]]) { El(b[0] - 1, b[1] - 4, 3, 2, -0.5, K.br, 0.3); El(b[0] + 2, b[1] - 4, 3, 2, 0.5, K.br, 0.3); El(b[0], b[1], 4.4, 3, 0, K.am, 0.8, function() { ln(b[0] - 1, b[1] - 3, b[0] - 1, b[1] + 3, 1.4, K.pr); ln(b[0] + 2, b[1] - 3, b[0] + 2, b[1] + 3, 1.4, K.pr); }); }
    } },
    bola_fogo: { m: [27, 0], h: [4, 5], n: [14, 0, 24, "#ff8a2a"], d: function() { chama(12, 0, 1.15, "#f2552c", "#ffd24a"); C(14, 0, 8, K.lj, 1.5); C(14.5, 0.5, 4.6, K.am, 0.8); } },
    granada_gelo: { m: [27, 0], h: [4, 5], d: function() {
      El(16, 2, 11.5, 13.5, 0, "#bfe9ff", 2.4, function(g) { for (let i = 0; i < 3; i++) { g.save(); g.translate(16, 3); g.rotate(i * Math.PI / 3); ln(-8, 0, 8, 0, 1.8, "#4aa8e8"); g.restore(); } });
      R(11, -17, 10, 6, 2, K.fe, 0.8); tb(function(g) { g.beginPath(); g.moveTo(20, -15); g.quadraticCurveTo(29, -12, 27, 2); }, 2.8, K.ac); trc(pC(12, -21, 3.6), 1.8, K.ci);
    } },
    mina: { m: [30, 0], n: [16, 0, 14, "#ff4a4a"], h: [-2, 3], d: function() {
      El(16, 6, 17, 7.5, 0, K.pr, 1.4); El(16, 1, 17, 8, 0, K.fe, 1.4, function() { trc(pE(16, 1, 11, 4.8, 0), 1.8, K.am); });
      C(16, 0, 3.4, K.ve, 0.8); for (const x of [6, 26]) R(x - 1.5, -9, 3, 5, 1, K.ac2, 0.4);
    } },
    laser: { m: [35, -1], h: [0, 10], n: [34, -1, 12, "#ff4a5a"], d: function() {
      P([-4, 4, 7, 4, 6, 17, -6, 17], K.pr); R(-9, -9, 31, 14, 6.5, K.br, 2, function(g) { g.fillStyle = K.ve; g.fillRect(-10, 0, 50, 3); });
      R(20, -6, 13, 10, 3.5, K.fe); El(33, -1, 2.6, 4.8, 0, K.ve, 0.6); fl(pE(33, -1.4, 1, 2, 0), "#fff"); R(-6, -12, 13, 3.5, 1.7, K.ve, 0.6);
    } },
    railgun: { m: [59, -1], h: [-2, 11], h2: [24, 8], n: [32, -1, 16, "#3edbe8"], d: function() {
      R(-22, -8, 11, 15, 3.5, K.fe); R(-14, -6, 54, 12, 3.5, K.pr, 2, function(g) { ln(-8, -0.5, 54, -0.5, 2, K.ci); }); R(-14, -6, 8, 12, 3, K.ou, 1);
      R(4, -10.5, 52, 4, 2, K.ci, 1); R(4, 4.5, 52, 4, 2, K.ci, 1); for (let i = 0; i < 4; i++) R(10 + i * 10, -11, 4, 20, 1.8, K.ac, 0.8);
      R(52, -9, 8, 18, 3, K.ac2, 1.2); P([-6, 6, 4, 6, 3, 19, -7, 19], K.fe);
    } },
    arco_iris: { m: [57, 0], h: [-2, 11], n: [57, 0, 14, "#ffffff"], d: function() {
      const cs = ["#ff5a5a", "#ff9a3c", "#ffd94e", "#5fcf74", "#4ea8f6", "#6b6ae8", "#b46bf0"];
      P([-4, 6, 7, 6, 6, 19, -6, 19], K.rs); R(-10, -9, 28, 16, 7, K.br);
      R(16, -9, 25, 18, 5, K.br, 1, function(g) { for (let i = 0; i < 7; i++) { g.fillStyle = cs[i]; g.fillRect(14, -9 + i * 2.58, 30, 2.7); } g.fillStyle = "rgba(40,20,110,.22)"; g.fillRect(14, 3, 30, 8); });
      R(14, -10, 4, 20, 2, K.ou, 0.8); P([41, -10, 58, 0, 41, 10], "#d9efff", 1.5, function(g) { ln(42, -6, 54, 0, 1.4, "#fff", 0.9); });
    } },
    feixe: { m: [41, 0], h: [-2, 12], n: [33, 0, 17, "#ff7ad0"], d: function() {
      P([-12, -9, -20, -17, -6, -9], K.rs, 0.8); P([-12, 9, -20, 17, -6, 9], K.rs, 0.8);
      R(-14, -10, 32, 20, 7, K.rx, 2, function(g) { ln(-10, 2, 14, 2, 1.6, K.pr, 0.5); ln(-10, 6, 14, 6, 1.6, K.pr, 0.5); });
      P([18, -8, 30, -13, 41, 0, 30, 13, 18, 8], "#ff9ad8", 2, function(g) { ln(21, 0, 38, 0, 1.2, "#fff", 0.7); ln(30, -12, 30, 12, 1.2, "#fff", 0.5); }); P([-6, 9, 4, 9, 3, 21, -7, 21], K.pr);
    } },
    tesla: { m: [43, 0], h: [-2, 11], n: [41, 0, 14, "#7ee8ff"], d: function() {
      const zz = function(g) { g.beginPath(); g.moveTo(41, -9); g.lineTo(37, -4); g.lineTo(43, -1); g.lineTo(38, 4); g.lineTo(41, 9); };
      R(-10, -6, 32, 13, 4.5, K.fe, 2, function() { ln(-6, 3, 14, 3, 1.4, K.ou, 0.9); });
      P([2, -6, 14, -6, 12, -14, 4, -14], "#d98a4e", 1.5, function() { for (let i = 0; i < 3; i++) ln(2, -8 - i * 2.7, 14, -8 - i * 2.7, 1.1, "#7c4422"); });
      El(8, -17, 8.5, 3.6, 0, "#e9a368", 1); C(8, -23, 3.6, K.ci, 0.8);
      T(21, -3, 41, -10, 3.6, K.ac); T(21, 3, 41, 10, 3.6, K.ac); trc(zz, 2, "#9ff0ff"); trc(zz, 0.9, "#fff");
      P([-6, 6, 4, 6, 3, 19, -7, 19], K.pr);
    } },
    raio_gelo: { m: [49, 0], h: [-2, 11], n: [34, 0, 16, "#7fe6ff"], d: function() {
      P([-4, 4, 7, 4, 6, 17, -6, 17], "#4a76c4"); P([2, -8, 6, -16, 10, -8], "#a8e8ff", 0.8); P([10, -8, 15, -14, 18, -8], "#a8e8ff", 0.8);
      R(-9, -9, 31, 15, 7, "#d5eefd", 2, function() { ln(-6, 2, 24, 2, 2, "#8fc9ee", 0.7); });
      P([22, -9, 48, 0, 22, 9], "#6fd9f7", 2, function() { ln(24, 0, 44, 0, 1.2, "#fff", 0.8); }); P([22, -11, 38, -15, 32, -6], "#b6efff", 1); P([22, 11, 38, 15, 32, 6], "#b6efff", 1);
    } },
    bolhas: { m: [39, 0], h: [3, 3], d: function() {
      R(-10, -2.8, 26, 5.6, 2.8, K.rs, 1);
      fl(pC(27, 0, 9.5), "#bfeaff", 0.35); tb(function(g) { g.beginPath(); g.arc(27, 0, 11, 0, TAU); }, 3, K.rs);
      trc(function(g) { g.beginPath(); g.arc(27, 0, 6.5, 3.6, 4.7); }, 1.6, "#fff", 0.9);
      for (const b of [[46, -7, 5], [43, 10, 3.3]]) { fl(pC(b[0], b[1], b[2]), "#bfeaff", 0.3); trc(pC(b[0], b[1], b[2]), 1.5, "#8fdcff"); trc(function(g) { g.beginPath(); g.arc(b[0], b[1], b[2] * 0.62, 3.6, 4.7); }, 1.1, "#fff", 0.9); }
    } },
    buraco_negro: { m: [31, 0], h: [3, 5], n: [18, 0, 24, "#a95cff"], d: function() {
      const anel = function(a0, a1) { return function(g) { g.beginPath(); g.ellipse(18, 0, 22, 6.6, -0.3, a0, a1); }; };
      trc(anel(Math.PI, TAU), 4, "#e079ff"); trc(anel(Math.PI, TAU), 1.6, "#ffd6ff");
      C(18, 0, 12.5, "#1b1038", 2); trc(pC(18, 0, 11.4), 1.2, "#b98bff", 0.8);
      trc(anel(0, Math.PI), 4, "#e079ff"); trc(anel(0, Math.PI), 1.6, "#ffd6ff");
    } },
    lanca_chamas: { m: [51, -1], h: [5, 11], h2: [-18, 10], n: [51, -1, 10, "#ffb03a"], d: function() {
      tb(function(g) { g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(-2, 14, 5, 5); }, 3, K.fe);
      R(-33, -13, 24, 24, 9, K.ve, 2, function(g) { g.fillStyle = K.am; g.fillRect(-36, -4, 30, 4); }); R(-26, -17, 10, 5, 2, K.ac2, 0.8);
      R(-2, -7, 22, 12, 3.5, K.fe); R(18, -4.6, 29, 9, 3, K.ac2); R(45, -6, 5, 11, 2, K.fe, 0.8); P([2, 5, 10, 5, 9, 17, 1, 17], K.pr);
      chama(53, -3, 0.45, K.lj, K.am);
    } },
    soprador: { m: [47, 0], h: [3, 12], d: function() {
      El(8, 0, 14, 13, 0, K.lj, 2, function() { for (let i = 0; i < 4; i++) ln(-3, -6 + i * 4, 6, -6 + i * 4, 1.2, "#a9500d"); });
      P([16, -9, 44, -15, 44, 15, 16, 9], K.vd, 2); R(42, -16, 6, 32, 3, K.pr, 1.2); R(-2, -20, 17, 6, 3, K.pr, 1); P([-2, 9, 8, 9, 7, 20, -3, 20], K.pr);
      for (let i = 0; i < 3; i++) trc(function(g) { g.beginPath(); g.arc(50 + i * 2, (i - 1) * 11, 8 - i, -0.9, 0.9); }, 2, K.br, 0.8 - i * 0.2);
    } },
    martelo: { m: [50, 0], mel: "mar", h: [4, 0], ir: -0.9, d: function() {
      T(-6, 0, 40, 0, 6, K.mad, 1.2); R(-8, -4, 17, 8, 4, "#8b4a3a", 1, function() { for (let i = 0; i < 3; i++) ln(-4 + i * 5, -5, -2 + i * 5, 5, 1.2, "#5e2c25"); });
      R(33, -17, 26, 34, 6, "#9aa7c2", 2.2, function(g) { g.fillStyle = "#6d7a99"; g.fillRect(31, -19, 6, 40); g.fillRect(54, -19, 6, 40); ln(40, -12, 40, 12, 1.5, "#fff", 0.55); });
    } },
    espada: { m: [72, 0], mel: "esp", h: [-3, 0], ir: -0.8, d: function() {
      R(-14, -3.6, 20, 7.2, 3.6, "#3e63d6", 1.2, function() { for (let i = 0; i < 3; i++) ln(-10 + i * 5, -5, -8 + i * 5, 5, 1.2, "#27409b"); });
      C(-16, 0, 5, K.ou, 1); C(-16, 0, 2, K.rs, 0.3);
      P([8, -5.4, 60, -4.6, 73, 0, 60, 4.6, 8, 5.4], "#e3e9f6", 2, function() { ln(10, 0, 62, 0, 1.6, "#9aa7c2", 0.9); });
      R(4, -15, 7, 30, 3.5, K.ou, 1.5);
    } },
    luva_boxe: { m: [32, 0], mel: "luva", sh: true, d: function() {
      R(-9, -10, 13, 20, 4.5, K.br, 1.5, function(g) { g.fillStyle = K.ou; g.fillRect(-4, -12, 3, 24); });
      El(15, 0, 17, 14, 0, K.ve, 2.6); El(8, 11, 7, 5.4, -0.3, K.ve, 1.4); fl(pE(12, -6, 8, 3, -0.2), "#ff9d9d", 0.9);
      ln(2, -7, 2, 7, 1.4, "#a02e3a", 0.8);
    } },
    meteoro: { m: [28, 0], h: [3, 9], n: [17, 0, 24, "#ff7a2a"], d: function() {
      P([8, -9, -22, -15, -8, -3, -24, 3, -8, 6, -20, 15, 8, 9], K.lj, 1.5); P([6, -5, -12, -8, -4, -1, -14, 2, -3, 4, 6, 5], K.am, 0.5);
      P([6, -9, 14, -14, 24, -10, 29, 0, 23, 11, 12, 14, 4, 7, 2, -2], "#6e5c80", 2.4, function() {
        trc(function(g) { g.beginPath(); g.moveTo(10, -6); g.lineTo(16, 0); g.lineTo(12, 8); }, 1.6, K.lj); trc(function(g) { g.beginPath(); g.moveTo(22, -6); g.lineTo(18, 2); g.lineTo(24, 6); }, 1.4, K.lj);
      });
    } },
    relampago: { m: [24, 8], h: [4, 6], n: [22, 16, 18, "#ffe14d"], d: function() {
      P([22, 1, 12, 17, 19, 17, 14, 32, 31, 11, 23, 11, 30, 1], K.am, 1.5);
      R(2, -9, 38, 11, 5.5, "#9fabce", 1.8); C(10, -9, 8, "#c0cae6", 1.6); C(21, -13, 10, "#c0cae6", 1.6); C(32, -8, 7.5, "#c0cae6", 1.6);
    } },

    // ---- v19: as 10 novas ----
    disco: { m: [39, -1], h: [0, 11], d: function() {
      P([-5, 4, 7, 4, 6, 18, -7, 18], K.pr, 1.2);
      R(-12, -9, 32, 15, 7, K.ci, 2.2, function() { ln(-8, 2, 14, 2, 1.6, "#1d8fa0", 0.8); });
      R(16, -7, 12, 12, 3, K.fe, 1.4);
      El(30, -1, 9, 4, 0, K.lj, 1.2, function() { trc(pE(30, -1.5, 5.5, 2, 0), 1.4, K.am); });
      C(-4, -12, 3.2, K.ve, 0.6);
    } },
    gosma: { m: [41, 1], h: [-1, 11], d: function() {
      P([-5, 5, 6, 5, 5, 18, -6, 18], K.pr, 1.2);
      R(-13, -6, 34, 13, 5, K.rx, 2);
      C(1, -14, 9.5, K.gs, 2.2, function() { fl(pC(-2, -12, 2.2), "#d4ffb8", 0.9); fl(pC(4, -17, 1.4), "#d4ffb8", 0.9); });
      R(-4, -26, 10, 5, 2, K.fe, 0.8);
      T(20, 1, 34, 1, 8, K.vd, 1.4);
      El(38, 1, 4, 7, 0, K.gs, 1);
      fl(pE(37, 10, 2, 3.4, 0), K.gs); fl(pE(33, 9, 1.4, 2.6, 0), K.gs);
    } },
    boliche: { m: [30, 0], h: [3, 9], d: function() {
      C(15, 0, 14, "#4b3bd1", 2.6, function() { fl(pE(9, -7, 5, 2.4, -0.6), "#ffffff", 0.35); });
      for (const b of [[19, -5], [23, 1], [17, 3]]) { fl(pC(b[0], b[1], 2.2), OUT); fl(pC(b[0] - 0.4, b[1] - 0.5, 1), "#7d72ff"); }
    } },
    banana: { m: [27, -6], h: [2, 5], d: function() {
      tb(function(g) { curva(g, [4, 4, 17, 5, 26, -8]); }, 9, "#fff1a6");
      fl(pC(26.5, -8.5, 2.6), "#8a5a1c");
      cel(function(g) { g.beginPath(); g.moveTo(6, 2); g.quadraticCurveTo(-1, -5, -3, -13); g.quadraticCurveTo(7, -12, 14, 1); g.closePath(); }, K.am, 1.2);
      cel(function(g) { g.beginPath(); g.moveTo(6, 6); g.quadraticCurveTo(1, 12, -1, 19); g.quadraticCurveTo(11, 18, 15, 7); g.closePath(); }, K.am, 1.2);
      cel(function(g) { g.beginPath(); g.moveTo(12, 3); g.quadraticCurveTo(19, 7, 25, 14); g.quadraticCurveTo(13, 16, 8, 8); g.closePath(); }, "#f2c23a", 1);
      R(-3, 1, 9, 7, 2.5, "#c78b2a", 1);
    } },
    ima: { m: [30, 0], h: [-1, 3], d: function() {
      tb(function(g) { g.beginPath(); g.moveTo(22, -11); g.lineTo(8, -11); g.arc(8, 0, 11, -Math.PI / 2, Math.PI / 2, true); g.lineTo(22, 11); }, 9, K.ve);
      R(20, -16, 9, 10, 2, K.ac, 1.2); R(20, 6, 9, 10, 2, K.ac, 1.2);
      for (let i = 0; i < 2; i++) trc(function(g) { g.beginPath(); g.arc(30, 0, 6 + i * 5, -0.9, 0.9); }, 1.6, K.ge, 0.85 - i * 0.3);
    } },
    bomba_grude: { m: [28, -6], h: [3, 6], d: function() {
      C(15, 2, 12.5, "#3f4a6e", 2.4);
      cel(function(g) { g.beginPath(); g.moveTo(5, -4); g.quadraticCurveTo(15, -12, 26, -3); g.quadraticCurveTo(27, 4, 23, 5); g.quadraticCurveTo(21, 0, 18, 3); g.quadraticCurveTo(14, 8, 11, 2); g.quadraticCurveTo(7, 3, 5, -4); g.closePath(); }, K.gs, 1.2);
      R(11, -14, 8, 5, 1.5, K.fe, 0.6);
      tb(function(g) { g.beginPath(); g.moveTo(15, -14); g.quadraticCurveTo(19, -21, 26, -19); }, 2.2, "#e0c9a0");
      faisca(27, -19, 5, K.am); faisca(27, -19, 2.4, "#fff");
      fl(pC(15, 4, 2.6), K.ve); fl(pC(14.4, 3.4, 1), "#ffd0d6");
    } },
    inflador: { m: [42, 0], h: [-2, 11], d: function() {
      R(-20, -9, 5, 18, 2, K.fe, 0.8); ln(-17, 0, -10, 0, 3, K.fe);
      P([-6, 5, 5, 5, 4, 18, -7, 18], K.pr, 1.2);
      R(-11, -7, 36, 14, 7, K.rs, 2.2, function() { for (let i = 0; i < 3; i++) ln(-4 + i * 8, -6, -4 + i * 8, 6, 1.4, "#c94d8a", 0.7); });
      C(8, -12, 5.5, K.br, 1, function() { ln(8, -12, 10.5, -14.5, 1.4, K.ve); });
      P([24, -5, 38, -2.5, 38, 2.5, 24, 5], K.ou, 1.2); R(37, -3, 5, 6, 1.5, K.fe, 0.6);
    } },
    vampiro: { m: [37, -1], h: [0, 11], d: function() {
      P([-4, 4, 7, 4, 6, 18, -6, 18], K.pr, 1.2);
      P([2, -6, -6, -20, -1, -16, 3, -21, 8, -15, 12, -20, 12, -6], "#5a2a8a", 1.2);
      R(-11, -8, 34, 14, 6, "#7b3fc4", 2.2, function() { ln(-7, 2, 18, 2, 1.4, "#4a1f7a", 0.8); });
      P([22, -7, 36, -4, 36, 2, 22, 5], "#3d2066", 1.2);
      fl(pC(4, -2, 3), "#ff3b52"); fl(pC(3.3, -2.7, 1.1), "#ffd0d6");
      P([30, -4, 32, 0, 34, -4], K.br, 0); P([30, 2, 32, -1, 34, 2], K.br, 0);
    } },
    tornado: { m: [40, 0], h: [-2, 11], d: function() {
      P([-6, 5, 5, 5, 4, 18, -7, 18], K.pr, 1.2);
      R(-13, -8, 30, 15, 6, "#5aa0a8", 2, function() { ln(-9, 2, 12, 2, 1.4, "#3c7179", 0.8); });
      El(26, 0, 6, 15, 0, "#cfe7ec", 1.6, function() { for (let i = -1; i <= 1; i++) ln(22, i * 8, 30, i * 6 + 2, 1.6, "#7fb3bd", 0.9); });
      fl(pC(26, 0, 3), K.fe);
      for (let i = 0; i < 3; i++) trc(function(g) { g.beginPath(); g.ellipse(38 + i * 3, 0, 3 + i, 9 - i * 2, 0, -1.2, 1.2); }, 1.8, K.br, 0.85 - i * 0.2);
    } },
    torreta: { m: [32, -5], h: [-1, 10], d: function() {
      R(-8, -2, 26, 12, 3, K.ol2, 1.6, function() { ln(-4, 4, 14, 4, 1.4, K.am, 0.9); });
      ln(-2, 10, -8, 18, 2.6, K.fe); ln(12, 10, 18, 18, 2.6, K.fe);
      R(-4, -14, 20, 13, 5, K.ol, 2, function() { fl(pC(3, -8, 2.2), "#ff3b52"); });
      R(15, -9, 16, 6, 2, K.fe, 1); R(29, -10, 4, 8, 1.5, K.ac, 0.6);
    } }
  };
  // flecha: haste, ponta e penas (na mão)
  function flecha(x, y, a, pena) {
    G.save(); G.translate(x, y); G.rotate(a);
    ln(-4, 0, 38, 0, 2.6, "#7a5230"); ln(-4, 0, 38, 0, 1.6, "#d9b27c"); P([37, -4.4, 47, 0, 37, 4.4], K.ac, 0.8);
    P([-6, 0, 2, -5, 5, -5, 1, 0], pena, 0.5); P([-6, 0, 2, 5, 5, 5, 1, 0], pena, 0.5);
    G.restore();
  }

  // ---------- sprites das armas (caixa justa medida em pixels) ----------
  const bruto = cv(320 * E, 240 * E), bg = bruto.getContext("2d", { willReadFrequently: true });
  const RCOR = { 2: "#7d7bff", 3: "#ffc83a" };                     // brilho de raridade (rara azul-violeta, lendária dourada)
  function rarid(id) { return typeof ARMA !== "undefined" && ARMA[id] ? ARMA[id].raridade : 1; }
  // silhueta de a dilatada em n direções com raio o, pintada de cor, no contexto gb
  function silhueta(gb, a, o, n, cor) {
    gb.globalCompositeOperation = "source-over"; gb.clearRect(0, 0, a.width, a.height);
    for (let i = 0; i < n; i++) { const t = i * TAU / n; gb.drawImage(a, Math.cos(t) * o, Math.sin(t) * o); }
    gb.globalCompositeOperation = "source-in"; gb.fillStyle = cor; gb.fillRect(0, 0, a.width, a.height); gb.globalCompositeOperation = "source-over";
  }
  // acabamento (uma vez por arma, só na caixa recortada): brilho da raridade, contorno escuro em volta
  // (silhueta clara em qualquer fundo) e luz fina na borda de cima (cara de brinquedo envernizado)
  function acabamento(c, r) {
    const w = c.width, h = c.height, g = c.getContext("2d"), a = cv(w, h), b = cv(w, h), gb = b.getContext("2d");
    a.getContext("2d").drawImage(c, 0, 0); g.clearRect(0, 0, w, h);
    if (r >= 2) {
      // v19: raridade bem clara — rara com aro de luz, lendária com aro duplo dourado mais largo
      if (r === 3) { silhueta(gb, a, 6.2 * E, 20, RCOR[r]); g.globalAlpha = 0.3; g.drawImage(b, 0, 0); }
      silhueta(gb, a, 4.4 * E, 16, RCOR[r]); g.globalAlpha = r === 3 ? 0.55 : 0.4; g.drawImage(b, 0, 0);
      silhueta(gb, a, 3.1 * E, 16, r === 3 ? "#fff1a8" : "#c9c4ff"); g.globalAlpha = r === 3 ? 0.95 : 0.8; g.drawImage(b, 0, 0); g.globalAlpha = 1;
    }
    silhueta(gb, a, 2.1 * E, 16, OUT); g.drawImage(b, 0, 0);
    g.drawImage(a, 0, 0);
    // luz de borda: o que é arma mas não é arma 2 px abaixo = borda de cima
    gb.clearRect(0, 0, w, h); gb.drawImage(a, 0, 0); gb.globalCompositeOperation = "destination-out"; gb.drawImage(a, 0, 2.2 * E);
    gb.globalCompositeOperation = "source-in"; gb.fillStyle = "#ffffff"; gb.fillRect(0, 0, w, h); gb.globalCompositeOperation = "source-over";
    g.globalAlpha = 0.32; g.drawImage(b, 0, 1.1 * E); g.globalAlpha = 1;
  }
  function spriteArma(id) {
    if (cache["w" + id]) return cache["w" + id];
    bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, bruto.width, bruto.height);
    bg.setTransform(E, 0, 0, E, 100 * E, 120 * E);
    const ant = G; G = bg; W[id].d(); G = ant;
    const w = bruto.width, h = bruto.height, d = bg.getImageData(0, 0, w, h).data, r = rarid(id), mg = Math.ceil((r === 3 ? 6.6 : r === 2 ? 5 : 2.4) * E) + 2;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    x0 = Math.max(0, x0 - mg); y0 = Math.max(0, y0 - mg); x1 = Math.min(w - 1, x1 + mg); y1 = Math.min(h - 1, y1 + mg);
    const c = cv(x1 - x0 + 1, y1 - y0 + 1); c.getContext("2d").drawImage(bruto, -x0, -y0);
    acabamento(c, r);
    return (cache["w" + id] = { c: c, x: x0 / E - 100, y: y0 / E - 120, w: (x1 - x0 + 1) / E, h: (y1 - y0 + 1) / E });
  }
  function brSpr() { return sp("br", -6, -6, 6, 6, function() { faisca(0, 0, 5.6, "#ffffff"); }); }
  // mãozinha: luva branca redonda
  const HR = 7.6;
  function maoSpr() {
    return sp("mao", -HR, -HR, HR, HR, function() {
      R(-5.4, -5.2, 10.8, 10.4, 4.6, "#f7f8ff", 1.6, function() { for (let i = 0; i < 3; i++) ln(0.8, -2.6 + i * 2.6, 6, -2.6 + i * 2.6, 0.9, "#9aa2c8", 0.9); });
      El(-2.2, -4.4, 3.2, 2, -0.3, "#f7f8ff", 0.6);
    });
  }

  // ---------- golpes corpo a corpo ----------
  function suave(x) { return x * x * (3 - 2 * x); }
  function curvaAng(g, rep, ven, bat) {
    if (g < 0.18) return rep + (ven - rep) * suave(g / 0.18);
    if (g < 0.5) { const u = (g - 0.18) / 0.32; return ven + (bat - ven) * (1 - (1 - u) * (1 - u)); }
    return bat + (rep - bat) * suave((g - 0.5) / 0.5);
  }
  const MEL = { mar: [-0.5, -1.5, 1.15, 62], esp: [-0.35, -1.25, 1.0, 76] };
  function golpeMelee(ctx, tipo, g) {
    if (tipo === "luva") { const e = g < 0.35 ? Math.sin(g / 0.35 * 1.57) : Math.cos((g - 0.35) / 0.65 * 1.57); ctx.translate(-3 + 28 * e, 0); return; }
    const M = MEL[tipo], a = curvaAng(g, M[0], M[1], M[2]), ap = curvaAng(Math.max(0, g - 0.1), M[0], M[1], M[2]);
    if (g > 0.15 && g < 0.75 && Math.abs(a - ap) > 0.05) {          // rastro do golpe (duas faixas chapadas)
      for (let i = 0; i < 2; i++) {
        ctx.beginPath(); ctx.arc(0, 0, M[3] - i * 8, ap, a); ctx.arc(0, 0, M[3] - 14 - i * 6, a, ap, true); ctx.closePath();
        ctx.globalAlpha = i ? 0.55 : 0.25; ctx.fillStyle = "#ffffff"; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.rotate(a);
  }

  function desenharNaMao(ctx, id, x, y, ang, r, recuo, golpe) {
    const w = W[id]; if (!w) return;
    const s = spriteArma(id), ca = Math.cos(ang), esc = r / 28 * ESC, d = r * DIST;
    ctx.save();
    ctx.translate(x + ca * d, y + Math.sin(ang) * d); ctx.rotate(ang);
    if (ca < 0) ctx.scale(1, -1);
    ctx.scale(esc, esc);
    if (recuo > 0) { ctx.translate(-recuo * 9, 0); ctx.rotate(-recuo * 0.1); }
    if (w.mel) { if (golpe > 0) golpeMelee(ctx, w.mel, golpe); else if (w.mel !== "luva") ctx.rotate(MEL[w.mel][0]); }
    ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
    if (rarid(id) === 3) {                          // lendária: brilho que corre pela arma de tempos em tempos
      const k = (agora() * 0.85 + x * 0.003) % 1.5;
      if (k < 1) blit(ctx, brSpr(), s.x + s.w * (0.18 + 0.64 * k), s.y + s.h * 0.32, k * 2, 0.3 + Math.sin(k * Math.PI) * 0.75);
    }
    if (w.n) { const p = 0.5 + 0.5 * Math.sin(agora() * 9); aura(ctx, w.n[3], w.n[0], w.n[1], w.n[2] * (0.85 + 0.2 * p + recuo * 0.3), Math.min(1, 0.45 + 0.3 * p + recuo * 0.25)); }
    if (!w.sh) {
      const m = maoSpr(); ctx.drawImage(m.c, w.h[0] - HR, w.h[1] - HR, HR * 2, HR * 2);
      if (w.h2) ctx.drawImage(m.c, w.h2[0] - HR, w.h2[1] - HR, HR * 2, HR * 2);
    }
    ctx.restore();
  }

  // ícone: arma inteira (sem mão), girada para caber melhor; um canvas pequeno por id+tamanho, desenhado 1:1
  function iconeSpr(id, tam) {
    const T = Math.max(8, Math.round(tam)), chave = "i" + id + "_" + T;
    if (cache[chave]) return cache[chave];
    const w = W[id], s = spriteArma(id), a = w.ir !== undefined ? w.ir : (s.w / s.h > 1.9 ? -0.5 : 0), co = Math.abs(Math.cos(a)), si = Math.abs(Math.sin(a));
    const bw = s.w * co + s.h * si, bh = s.w * si + s.h * co, e = T * 0.94 / Math.max(bw, bh), c = cv(T, T), g = c.getContext("2d");
    g.imageSmoothingQuality = "high"; g.translate(T / 2, T / 2); g.rotate(a); g.scale(e, e); g.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
    return (cache[chave] = { c: c, T: T });
  }
  function icone(ctx, id, x, y, tam) {
    if (!W[id]) return;
    const s = iconeSpr(id, tam);
    ctx.drawImage(s.c, Math.round(x - s.T / 2), Math.round(y - s.T / 2));
  }

  function pontaDoCano(id, x, y, ang, r) {
    const w = W[id], ca = Math.cos(ang), sa = Math.sin(ang);
    if (!w) return { x: x + ca * r * 2, y: y + sa * r * 2 };
    const esc = r / 28 * ESC, fl = ca < 0 ? -1 : 1, ox = x + ca * r * DIST, oy = y + sa * r * DIST, lx = w.m[0] * esc, ly = w.m[1] * esc * fl;
    return { x: ox + lx * ca - ly * sa, y: oy + lx * sa + ly * ca };
  }

  

  // =========================================================
  // PROJÉTEIS: um sprite por visual+tamanho (cache), apontando para +x e centrado na origem.
  // Por quadro só drawImage (girando/ piscando). Rápidos têm rastro afilado dentro do próprio sprite.
  // =========================================================
  // gira o sprite em 32 passos (feito uma vez, sob demanda): depois é só um drawImage sem rotação (bem mais barato)
  const NR = 32;
  function girar(s, a) {
    const ca = Math.cos(a), sa = Math.sin(a), xs = [s.x, s.x + s.w], ys = [s.y, s.y + s.h];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const px = xs[i] * ca - ys[j] * sa, py = xs[i] * sa + ys[j] * ca; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1;
    const c = cv(Math.ceil(x1 - x0) + 1, Math.ceil(y1 - y0) + 1), g = c.getContext("2d");
    g.translate(-x0, -y0); g.rotate(a); g.drawImage(s.c, s.x, s.y, s.w, s.h);
    return { c: c, x: x0, y: y0 };
  }
  function blitR(ctx, s, x, y, a) {
    let i = Math.round(a * NR / TAU) % NR; if (i < 0) i += NR;
    const f = (s.f || (s.f = []))[i] || (s.f[i] = girar(s, i * TAU / NR));
    ctx.drawImage(f.c, Math.round(x + f.x), Math.round(y + f.y));
  }
  let RX = 0, RY = 0;
  function rotp(a, lx, ly) { const ca = Math.cos(a), sa = Math.sin(a); RX = lx * ca - ly * sa; RY = lx * sa + ly * ca; }

  function rastro(len, h, col, al) { fl(pP([0, -h / 2, -len, 0, 0, h / 2]), col, al); }
  function hex6(c) { return /^#[0-9a-f]{6}$/i.test(c || "") ? c : "#ffffff"; }
  // rastro em degradê (forte junto do projétil, some na cauda); x0 = onde começa, len = comprimento
  function rastroG(x0, len, h, col, al) {
    const g = G, q = rgb(hex6(col)), gr = g.createLinearGradient(x0 - len, 0, x0, 0);
    gr.addColorStop(0, "rgba(" + q + ",0)"); gr.addColorStop(0.6, "rgba(" + q + "," + al * 0.55 + ")"); gr.addColorStop(1, "rgba(" + q + "," + al + ")");
    g.fillStyle = gr; pP([x0, -h / 2, x0 - len, 0, x0, h / 2])(g); g.fill();
  }
  // bala: brilho na ponta, rastro de traçante na cor de quem atirou e reflexo (o corpo continua do tamanho da colisão)
  function bala(key, L, h, corpo, cor, tl) {
    return ps(key, -L / 2 - tl, -h * 1.4, L / 2 + h * 0.8, h * 1.4, function() {
      G.globalAlpha = 0.5; G.drawImage(brilho(corpo), L / 2 - h * 2.2, -h * 1.35, h * 2.7, h * 2.7); G.globalAlpha = 1;
      rastroG(-L / 2 + 2, tl + 2, h * 1.05, cor, 0.85); rastroG(-L / 2 + 2, tl * 0.75, h * 0.45, "#ffffff", 0.95);
      P([-L / 2, -h / 2, L / 2 - h * 0.8, -h / 2, L / 2, 0, L / 2 - h * 0.8, h / 2, -L / 2, h / 2], corpo, Math.max(0.8, h / 4));
      ln(-L / 2 + 2, h * 0.28, L / 2 - h, h * 0.28, 0.9, pal(corpo).s, 0.7);
      fl(pE(L / 2 - h * 1.1, -h * 0.17, h * 0.55, h * 0.12, 0), "#ffffff", 0.85);
    });
  }
  function missilSpr(key, L, h, corpo, nariz, faixa) {
    return ps(key, -L / 2 - 2, -h * 1.1, L / 2 + 2, h * 1.1, function() {
      P([-L / 2, -h / 2, -L / 2 - 3, -h * 1.05, -L / 2 + 6, -h / 2], K.fe, 0.6); P([-L / 2, h / 2, -L / 2 - 3, h * 1.05, -L / 2 + 6, h / 2], K.fe, 0.6);
      R(-L / 2, -h / 2, L * 0.7, h, h / 2.4, corpo, Math.max(0.8, h / 4), function(g) { g.fillStyle = faixa; g.fillRect(-L * 0.1, -h, L * 0.08, h * 2); });
      P([L * 0.2, -h / 2, L / 2, 0, L * 0.2, h / 2], nariz, Math.max(0.8, h / 4));
    });
  }
  function chamaSpr(key, L, h, f) {      // chama de foguete (2 quadros)
    return ps(key, -L - 2, -h, 2, h, function() {
      fl(pP([0, -h * 0.5, -L * (0.8 + f * 0.2), 0, 0, h * 0.5]), K.lj); fl(pP([0, -h * 0.3, -L * (0.5 + f * 0.2), 0, 0, h * 0.3]), K.am);
    });
  }
  function granadaSpr(key, R0, corpo, linha, anel) {
    return ps(key, -R0 * 1.6, -R0 * 2, R0 * 1.6, R0 * 1.6, function() {
      El(0, 0, R0 * 0.9, R0, 0, corpo, 1.8, function() { for (let i = -1; i <= 1; i++) ln(-R0, i * R0 * 0.5, R0, i * R0 * 0.5, 1, linha, 0.9); });
      R(-R0 * 0.35, -R0 * 1.5, R0 * 0.7, R0 * 0.6, 1, K.fe); trc(pC(-R0 * 0.55, -R0 * 1.8, R0 * 0.38), 1.2, anel);
      tb(function(g) { g.beginPath(); g.moveTo(R0 * 0.3, -R0 * 1.3); g.quadraticCurveTo(R0 * 1.2, -R0, R0 * 1, R0 * 0.2); }, R0 * 0.3, K.ac);
    });
  }
  // luz piscando (vermelha) ou apagada
  function luz(ctx, x, y, r, on, cor) {
    ctx.fillStyle = on ? cor : "#4a2630"; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (on) { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  }
  const CONF = [K.rs, K.am, K.az, K.vd, K.lj, K.rx];
  const ang = function(p) { return Math.atan2(p.vy, p.vx); };

  const PR = {
    pedra: function(c, p) {
      const r = p.raio, s = ps("pedra" + r, -r * 1.4, -r * 1.4, r * 1.4, r * 1.4, function() {
        P([r * 1.1, -r * 0.2, r * 0.5, -r * 1.05, -r * 0.6, -r * 0.95, -r * 1.15, 0.1 * r, -r * 0.5, r * 1.0, r * 0.6, r * 0.95], "#a8aec2", 1.4);
        ln(-r * 0.4, -r * 0.3, r * 0.3, -r * 0.35, 1, "#fff", 0.6);
      });
      blitR(c, s, p.x, p.y, p.t * 6);
    },
    bala: function(c, p) { const r = p.raio; blitR(c, bala("bala" + r + p.cor, r * 3.2 + 4, r * 1.6, "#ffe27a", p.cor, 16), p.x, p.y, ang(p)); },
    bala_grande: function(c, p) { const r = p.raio; blitR(c, bala("bg" + r + p.cor, r * 3.4 + 6, r * 1.8, "#ff9f43", p.cor, 18), p.x, p.y, ang(p)); },
    bala_rastro: function(c, p) { const r = p.raio; blitR(c, bala("br" + r, r * 4 + 6, r * 1.4, "#f4fbff", K.ci, 38), p.x, p.y, ang(p)); },
    chumbo: function(c, p) {
      const r = p.raio, s = ps("ch" + r, -r * 3.4, -r * 1.9, r * 1.9, r * 1.9, function() {
        G.globalAlpha = 0.45; G.drawImage(brilho("#ffb03a"), -r * 1.9, -r * 1.9, r * 3.8, r * 3.8); G.globalAlpha = 1;
        rastroG(0, r * 3.2, r * 1.5, "#ffd36b", 0.8); C(0, 0, r * 0.95 + 0.4, "#ffd36b", 0.8); fl(pC(-r * 0.25, -r * 0.3, r * 0.32), "#fff8d8", 0.95);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    plasma: function(c, p) {
      const r = p.raio, s = ps("pl" + r, -r * 3, -r * 1.6, r * 1.6, r * 1.6, function() {
        G.globalAlpha = 0.4; G.drawImage(brilho("#3de8c0"), -r * 1.6, -r * 1.6, r * 3.2, r * 3.2); G.globalAlpha = 1;
        rastro(r * 2.8, r * 1.4, "#3de8c0", 0.45); C(0, 0, r * 0.9, "#3de8c0", 2.2); fl(pC(-r * 0.1, -r * 0.1, r * 0.42), "#e9fff9");
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    bola_pula: function(c, p) {
      const r = p.raio, s = ps("bp" + r, -r * 1.1, -r * 1.1, r * 1.1, r * 1.1, function() {
        C(0, 0, r, "#8be04b", 2.2); trc(function(g) { g.beginPath(); g.arc(0, 0, r * 0.62, 0.9, 2.3); }, 1.8, "#fff", 0.95); trc(function(g) { g.beginPath(); g.arc(0, 0, r * 0.62, 4.0, 5.4); }, 1.8, "#fff", 0.95);
      });
      blitR(c, s, p.x, p.y, p.t * 9 * (p.vx < 0 ? -1 : 1));
    },
    confete: function(c, p) {
      const h = Math.abs((p.vx * 131 + p.vy * 71) | 0), i = h % 6, s = ps("cf" + i, -3, -2, 3, 2, function() { R(-2.6, -1.5, 5.2, 3, 0.7, CONF[i], 0.6); });
      blitR(c, s, p.x, p.y, p.t * 13 + h);
    },
    agua: function(c, p) {
      const r = p.raio, s = ps("ag" + r, -r * 3.2, -r * 1.2, r * 1.4, r * 1.2, function() {
        rastro(r * 2.6, r * 1.1, "#8fd4ff", 0.55); El(0, 0, r * 1.3, r * 0.95, 0, "#4fb8ff", 1.2); fl(pE(-r * 0.2, -r * 0.35, r * 0.5, r * 0.2, 0), "#fff", 0.85);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    dardo: function(c, p) {
      const s = ps("da" + p.cor, -18, -5, 10, 5, function() {
        rastro(11, 2.4, "#ffffff", 0.5); ln(-5, 0, 6, 0, 1.8, K.ac2); P([5, -1.8, 10, 0, 5, 1.8], K.ac, 0.4);
        P([-8, -4, -3, -0.9, -3, 0.9, -8, 4], p.cor, 0.6);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    onda: function(c, p) {
      const r = p.raio, s = ps("on" + r, -2, -r * 1.05, r * 1.1, r * 1.05, function() {
        for (let i = 0; i < 3; i++) trc(function(g) { g.beginPath(); g.arc(-r * 0.2, 0, r * (0.5 + i * 0.28), -1, 1); }, 4.2 - i * 0.8, i ? K.ge : "#ffffff", 0.95 - i * 0.2);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    shuriken: function(c, p) {
      const r = p.raio, s = ps("sh" + r, -r * 1.6, -r * 1.6, r * 1.6, r * 1.6, function() { P(estrela(0, 0, r * 1.5, r * 0.5, 4, 0.4), "#c6d0e6", 1.6); C(0, 0, r * 0.28, K.pr, 0.3); });
      blitR(c, s, p.x, p.y, p.t * 22);
    },
    bumerangue: function(c, p) {
      const r = p.raio, k = r / 10, s = ps("bu" + r, -r * 1.5, -r * 1.7, r * 1.5, r * 1.7, function() {
        tb(function(g) { curva(g, [-8 * k, -14 * k, 6 * k, -9 * k, 8 * k, 0]); g.quadraticCurveTo(6 * k, 9 * k, -8 * k, 14 * k); }, 7 * k, K.lj);
        trc(function(g) { curva(g, [-5 * k, -11 * k, 2 * k, -9 * k, 4 * k, -5 * k]); }, 2 * k, K.am);
      });
      blitR(c, s, p.x, p.y, p.t * 15);
    },
    flecha: function(c, p) {
      const s = ps("fl" + p.cor, -20, -6, 16, 6, function() {
        rastro(8, 2, "#ffffff", 0.35); ln(-17, 0, 10, 0, 2.6, "#7a5230"); ln(-17, 0, 10, 0, 1.5, "#d9b27c"); P([9, -3.6, 17, 0, 9, 3.6], K.ac, 0.6);
        P([-19, 0, -12, -4.5, -9, -4.5, -13, 0], K.br, 0.4); P([-19, 0, -12, 4.5, -9, 4.5, -13, 0], K.br, 0.4);
        ln(-14, -2, -14, 2, 1.2, p.cor);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    virote: function(c, p) {
      const s = ps("vi", -14, -6, 14, 6, function() {
        ln(-10, 0, 7, 0, 3, K.pr); P([6, -4.4, 15, 0, 6, 4.4], K.ac, 0.6); P([-12, 0, -7, -5, -4, -5, -6, 0], K.lj, 0.4); P([-12, 0, -7, 5, -4, 5, -6, 0], K.lj, 0.4);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    serra: function(c, p) {
      const r = p.raio, s = ps("se" + r, -r * 1.1, -r * 1.1, r * 1.1, r * 1.1, function() {
        P(estrela(0, 0, r * 1.05, r * 0.82, 14, 0.1), K.ac, 1.4); C(0, 0, r * 0.62, K.ac2, 1.2); C(0, 0, r * 0.25, K.ou, 0.6); C(0, 0, r * 0.1, K.pr, 0);
      });
      blitR(c, s, p.x, p.y, p.t * 26);
    },
    bola_neve: function(c, p) {
      const r = p.raio, s = ps("bn" + r, -r * 1.1, -r * 1.1, r * 1.1, r * 1.1, function() {
        C(0, 0, r, "#f1f7ff", 2); C(r * 0.4, -r * 0.35, r * 0.2, "#b6c9ec", 0.3); C(-r * 0.3, r * 0.4, r * 0.16, "#b6c9ec", 0.3);
      });
      blitR(c, s, p.x, p.y, p.t * 6);
    },
    gancho: function(c, p) {
      if (p.donoX !== undefined) {
        c.beginPath(); c.moveTo(p.donoX, p.donoY); c.lineTo(p.x, p.y); c.lineCap = "round";
        c.lineWidth = 3.4; c.strokeStyle = "#aeb8d2"; c.stroke();
      }
      const s = ps("ga", -12, -12, 12, 12, function() {
        T(-8, 0, 3, 0, 3.6, K.ac); P([2, -2.6, 11, 0, 2, 2.6], K.ac, 0.4);
        tb(function(g) { g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(-2, -8, -9, -10); }, 2.6, K.ac); tb(function(g) { g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(-2, 8, -9, 10); }, 2.6, K.ac);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    foguete: function(c, p) { foguete(c, p, "fg", 18, 11, 30, K.br, K.ve, K.ve, 13); },
    mini_missil: function(c, p) { foguete(c, p, "mf", 10, 6, 17, K.br, K.ve, K.am, 8); },
    missil: function(c, p) { foguete(c, p, "ml", 22, 11, 32, "#dfe5f2", K.am, K.az, 14); },
    granada: function(c, p) { granada(c, p, "gr", K.ol, K.ol2, K.ou, "#ff4a4a"); },
    granada_frag: function(c, p) { granada(c, p, "gf", "#4a526f", K.lj, K.ve, "#ff9a3c"); },
    granada_gelo: function(c, p) { granada(c, p, "gg", "#bfe9ff", "#4aa8e8", K.ci, "#3edbe8"); },
    dinamite: function(c, p) {
      const r = p.raio, s = ps("di" + r, -r * 1.7, -r * 1.6, r * 1.7, r * 1.6, function() {
        for (let i = -1; i <= 1; i++) R(-r * 1.5, i * r * 0.62 - r * 0.32, r * 3, r * 0.64, 1.4, K.ve, 0.8);
        R(-r * 0.2, -r * 1.1, r * 0.5, r * 2.2, 0.8, K.pr, 0.4);
      }), a = p.t * 5 * (p.vx < 0 ? -1 : 1), t1 = p.timer01 || 0, fl2 = ((1 - t1) * r * 1.2 + 2) * KK, rr = r * 1.5 * KK;
      blitR(c, s, p.x, p.y, a);
      rotp(a, rr, 0); const x1 = p.x + RX, y1 = p.y + RY; rotp(a, rr + fl2, -fl2 * 0.5); const x2 = p.x + RX, y2 = p.y + RY;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = 2 * KK; c.strokeStyle = "#e0c9a0"; c.stroke();
      const sk = ps("sk", -6, -6, 6, 6, function() { faisca(0, 0, 5.5, K.am); faisca(0, 0, 2.6, "#fff"); });
      blitR(c, sk, x2, y2, p.t * 14);
    },
    bala_canhao: function(c, p) {
      const r = p.raio, s = ps("bc" + r, -r * 3, -r * 1.2, r * 1.2, r * 1.2, function() {
        rastro(r * 1.9, r * 1.6, K.lj, 0.4); C(0, 0, r, "#454c6b", 2.6); fl(pE(-r * 0.35, -r * 0.4, r * 0.3, r * 0.16, -0.6), "#fff", 0.7);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    abelha: function(c, p) {
      const f = Math.floor(p.t * 40) % 2, r = p.raio, a = ang(p), fx = Math.cos(a) < 0, s = ps("ab" + f + r + (fx ? "f" : ""), -r * 1.9, -r * 1.7, r * 1.9, r * 1.2, function() {
        if (fx) G.scale(1, -1);
        El(-r * 0.2, -r * 0.7, r * 0.9, r * (f ? 0.45 : 0.9), f ? 0.3 : -0.9, K.br, 0.3); El(r * 0.3, -r * 0.7, r * 0.9, r * (f ? 0.9 : 0.45), f ? -0.9 : 0.3, K.br, 0.3);
        El(0, 0, r * 1.3, r * 0.85, 0, K.am, 1, function() { ln(-r * 0.3, -r, -r * 0.3, r, r * 0.45, K.pr); ln(r * 0.45, -r, r * 0.45, r, r * 0.45, K.pr); });
        C(r * 1.25, 0, r * 0.5, K.pr, 0.3); P([-r * 1.3, 0, -r * 1.9, -r * 0.2, -r * 1.9, r * 0.2], K.pr, 0.2);
      });
      blitR(c, s, p.x, p.y, a);
    },
    bola_fogo: function(c, p) {
      const r = p.raio, f = Math.floor(p.t * 16) % 3, s = ps("bf" + r + f, -r * 3.2, -r * 1.6, r * 1.3, r * 1.6, function() {
        const k = [1, 0.8, 1.15][f];
        fl(pP([0, -r * 0.9, -r * 2.2 * k, -r * 1.3, -r * 1.2, -r * 0.2, -r * 3 * k, 0, -r * 1.2, r * 0.2, -r * 2.2 * k, r * 1.3, 0, r * 0.9]), "#f2552c");
        fl(pP([0, -r * 0.5, -r * 1.5 * k, -r * 0.6, -r * 0.8, 0, -r * 1.5 * k, r * 0.6, 0, r * 0.5]), K.lj);
        C(0, 0, r * 0.95, K.lj, 1.8); C(r * 0.1, 0, r * 0.55, K.am, 0.8);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    mina: function(c, p) {
      const r = p.raio, s = ps("mi" + r, -r * 1.9, -r * 1.2, r * 1.9, r * 1.1, function() {
        El(0, r * 0.35, r * 1.6, r * 0.75, 0, K.pr, 1.4); El(0, -r * 0.1, r * 1.6, r * 0.8, 0, K.fe, 1.4, function() { trc(pE(0, -r * 0.1, r * 1.05, r * 0.48, 0), 1.8, K.am); });
        for (const x of [-1, 1]) R(x * r * 1.05 - 1.5, -r * 1, 3, r * 0.5, 1, K.ac2, 0.4);
      }), per = p.armada ? 0.22 : 0.8, on = (p.t % per) < per * 0.5;
      c.drawImage(s.c, Math.round(p.x + s.x), Math.round(p.y + s.y));
      luz(c, p.x, p.y - r * 0.15 * KK, r * 0.3 * KK, on, p.armada ? "#ff3b3b" : "#ffd94e");
    },
    gelo: function(c, p) {
      const r = p.raio, s = ps("ge" + r, -r * 2.6, -r * 1.3, r * 2.4, r * 1.3, function() {
        rastro(r * 1.8, r * 1.1, "#bff3ff", 0.5); P([-r * 1.2, 0, -r * 0.2, -r * 0.9, r * 2.2, 0, -r * 0.2, r * 0.9], "#7fe3ff", 1.6, function() { ln(-r * 0.4, 0, r * 1.7, 0, 1, "#fff", 0.8); });
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    bolha: function(c, p) {
      const r = p.raio, s = ps("bo" + r, -r * 1.1, -r * 1.1, r * 1.1, r * 1.1, function() {
        fl(pC(0, 0, r), "#9be8ff", 0.14); trc(pC(0, 0, r - 0.8), 2, "#d9f7ff", 0.95); trc(pC(0, 0, r - 3.5), 0.9, "#9be8ff", 0.5);
        trc(function(g) { g.beginPath(); g.arc(0, 0, r * 0.68, 3.5, 4.8); }, 2.6, "#ffffff", 0.95); fl(pC(r * 0.45, r * 0.38, r * 0.1), "#fff", 0.9);
      });
      c.drawImage(s.c, Math.round(p.x + s.x + Math.sin(p.t * 8)), Math.round(p.y + s.y + Math.cos(p.t * 7)));
    },
    buraco_negro: function(c, p) {
      const r = p.raio, R3 = r * 2.1;
      const base = ps("bnh" + r, -R3, -R3, R3, R3, function() {
        G.globalAlpha = 0.5; G.drawImage(brilho("#4b1f8f"), -R3, -R3, R3 * 2, R3 * 2); G.globalAlpha = 1;
        fl(pC(0, 0, r * 1.02), "#07030f"); trc(pC(0, 0, r * 1.02), 2.2, "#d9b8ff", 0.95);
      });
      const espiral = ps("bne" + r, -r * 2.1, -r * 2.1, r * 2.1, r * 2.1, function() {
        for (let k = 0; k < 3; k++) { G.save(); G.rotate(k * TAU / 3); trc(function(g) { g.beginPath(); for (let i = 0; i <= 14; i++) { const t = i / 14, a = t * 2.4, rr = r * (1 + t * 0.95); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }, 3.2, k % 2 ? "#e079ff" : "#8b5cff", 0.9); G.restore(); }
      });
      c.drawImage(base.c, Math.round(p.x + base.x), Math.round(p.y + base.y)); blitR(c, espiral, p.x, p.y, p.t * 4);
    },
    chama: function(c, p) {
      const r = p.raio, i = Math.min(3, Math.floor(p.t / 0.1)), cs = ["#fff1a8", K.am, K.lj, "#d8483a"], tm = Math.min(1, p.t / 0.45), z = 0.65 + i * 0.3;
      const s = ps("cm" + i + r, -r * 1.2 * z, -r * 1.2 * z, r * 1.2 * z, r * 1.2 * z, function() {
        G.scale(z, z);
        fl(pP([r, 0, r * 0.2, -r * 0.9, -r * 1.1, -r * 0.55, -r * 0.6, 0, -r * 1.1, r * 0.55, r * 0.2, r * 0.9]), cs[i]); fl(pP([r * 0.7, 0, r * 0.1, -r * 0.5, -r * 0.6, 0, r * 0.1, r * 0.5]), cs[Math.max(0, i - 1)], 0.8);
      });
      c.globalAlpha = Math.max(0, 1 - tm * tm * 0.85); blitR(c, s, p.x, p.y, ang(p)); c.globalAlpha = 1;
    },
    vento: function(c, p) {
      const r = p.raio, tm = Math.min(1, p.t / 0.5), i = Math.min(2, (tm * 3) | 0), z = 0.7 + i * 0.4;
      const s = ps("ve" + i + r, -r * 1.2 * z, -r * 1.2 * z, r * 1.2 * z, r * 1.2 * z, function() {
        G.scale(z, z);
        trc(function(g) { g.beginPath(); g.arc(0, 0, r * 0.9, 0.2, 3.9); }, 3, "#ffffff", 0.9); trc(function(g) { g.beginPath(); g.arc(0, 0, r * 0.55, 3.3, 6.2); }, 2.4, "#ffffff", 0.8);
      });
      c.globalAlpha = 0.55 * (1 - tm); blitR(c, s, p.x, p.y, p.t * 7); c.globalAlpha = 1;
    },
    fragmento: function(c, p) {
      const r = p.raio, s = ps("fr" + r, -r * 1.6, -r * 1.6, r * 1.6, r * 1.6, function() { P([r * 1.5, 0, -r * 0.4, -r, -r * 1.1, 0.1 * r, -r * 0.4, r * 0.9], K.am, 0.8); });
      blitR(c, s, p.x, p.y, p.t * 18);
    },

    // ---- v19: projéteis das armas novas ----
    disco: function(c, p) {
      const r = p.raio, s = ps("dc" + r, -r * 1.2, -r * 1.2, r * 1.2, r * 1.2, function() {
        C(0, 0, r, K.lj, 1.6, function() { trc(pC(0, 0, r * 0.66), r * 0.22, K.am, 0.95); });
        C(0, 0, r * 0.3, K.pr, 0.4); fl(pE(-r * 0.35, -r * 0.5, r * 0.32, r * 0.14, -0.5), "#ffffff", 0.8);
      });
      if (p.mult > 1.05) aura(c, "#ffb03a", p.x, p.y, r * (1.8 + p.mult * 0.5), Math.min(0.75, 0.25 + (p.mult - 1) * 0.35));
      blitR(c, s, p.x, p.y, p.t * 18);
    },
    gosma: function(c, p) {
      const r = p.raio, s = ps("gm" + r, -r * 2.4, -r * 1.1, r * 1.4, r * 1.1, function() {
        C(-r * 1.6, r * 0.3, r * 0.32, K.gs, 0.4); C(-r * 1.1, -r * 0.35, r * 0.42, K.gs, 0.5);
        El(0, 0, r * 1.25, r * 0.88, 0, K.gs, 1.8); fl(pE(r * 0.2, -r * 0.35, r * 0.42, r * 0.18, -0.2), "#e6ffd6", 0.95);
        fl(pC(-r * 0.3, r * 0.2, r * 0.16), "#3f8f2a", 0.8);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    boliche: function(c, p) {
      const r = p.raio, s = ps("bl" + r, -r * 1.1, -r * 1.1, r * 1.1, r * 1.1, function() {
        C(0, 0, r, "#4b3bd1", 2.4);
        for (const b of [[0.3, -0.35], [0.6, 0.05], [0.25, 0.25]]) { fl(pC(b[0] * r, b[1] * r, r * 0.15), OUT); }
        fl(pE(-r * 0.4, -r * 0.45, r * 0.3, r * 0.14, -0.6), "#ffffff", 0.45);
      });
      blitR(c, s, p.x, p.y, p.x / r);
    },
    banana: function(c, p) {
      const s = ps("bnn", -14, -9, 14, 7, function() {
        cel(function(g) { g.beginPath(); g.moveTo(-2, 2); g.quadraticCurveTo(-9, -1, -13, 4); g.quadraticCurveTo(-7, 6, -1, 5); g.closePath(); }, K.am, 1);
        cel(function(g) { g.beginPath(); g.moveTo(2, 2); g.quadraticCurveTo(9, -1, 13, 4); g.quadraticCurveTo(7, 6, 1, 5); g.closePath(); }, K.am, 1);
        cel(function(g) { g.beginPath(); g.moveTo(-3, 3); g.quadraticCurveTo(-2, -7, 1, -8); g.quadraticCurveTo(4, -2, 3, 3); g.closePath(); }, "#f2c23a", 1);
        R(-3, 1, 6, 4.4, 1.6, "#c78b2a", 0.6);
      });
      if (p.parado) c.drawImage(s.c, Math.round(p.x + s.x), Math.round(p.y + p.raio - 5 + s.y));
      else blitR(c, s, p.x, p.y, p.t * 12);
    },
    ima: function(c, p) {
      const r = p.raio, s = ps("im" + r, -r * 1.3, -r * 1.3, r * 1.3, r * 1.3, function() {
        tb(function(g) { g.beginPath(); g.moveTo(r * 0.9, -r * 0.62); g.lineTo(0, -r * 0.62); g.arc(0, 0, r * 0.62, -Math.PI / 2, Math.PI / 2, true); g.lineTo(r * 0.9, r * 0.62); }, r * 0.62, K.ve);
        R(r * 0.7, -r * 0.98, r * 0.5, r * 0.62, 1.2, K.ac, 0.6); R(r * 0.7, r * 0.36, r * 0.5, r * 0.62, 1.2, K.ac, 0.6);
      });
      aura(c, "#8fe9ff", p.x, p.y, r * 2.6 + Math.sin(p.t * 9) * 3, 0.28);
      blitR(c, s, p.x, p.y, ang(p) + Math.sin(p.t * 4) * 0.4);
    },
    bomba_grude: function(c, p) {
      if (p.preso) return;                              // grudada numa bolinha: desenhada junto dela (desenharEstado)
      const r = p.raio, s = bombaGrudeSpr(r);
      if (p.parado) { const sp2 = ps("gsp", -14, -14, 14, 14, function() { fl(pP(estrela(0, 0, 13, 8, 7, 0.3)), K.gs, 0.95); }); c.drawImage(sp2.c, Math.round(p.x + sp2.x), Math.round(p.y + sp2.y)); }
      const a = p.parado ? 0 : p.t * 6 * (p.vx < 0 ? -1 : 1), t1 = p.timer01 || 0, per = 0.5 - 0.42 * t1;
      blitR(c, s, p.x, p.y, a);
      luz(c, p.x, p.y, r * 0.3 * KK, (p.t % per) < per * 0.5, "#ff3b52");
    },
    dardo_ar: function(c, p) {
      const s = ps("dar", -20, -6, 11, 6, function() {
        rastro(13, 3.6, "#d9f3ff", 0.6); ln(-6, 0, 6, 0, 2.2, K.ac2); P([5, -2.2, 11, 0, 5, 2.2], K.az, 0.4);
        P([-9, -4.5, -3, -1, -3, 1, -9, 4.5], K.rs, 0.6);
      });
      blitR(c, s, p.x, p.y, ang(p));
    },
    morcego: function(c, p) {
      const f = Math.floor(p.t * 22) % 2, r = p.raio, fx = p.vx < 0, s = ps("mc" + f + r + (fx ? "f" : ""), -r * 2.2, -r * 1.6, r * 2.2, r * 1.3, function() {
        if (fx) G.scale(-1, 1);
        const w = f ? -1 : 0.6;
        P([-r * 0.5, 0, -r * 2.1, -r * 1.2 * w - r * 0.2, -r * 1.6, r * 0.2, -r * 1.1, -r * 0.1, -r * 0.7, r * 0.4], "#5a2a8a", 0.6);
        P([r * 0.5, 0, r * 2.1, -r * 1.2 * w - r * 0.2, r * 1.6, r * 0.2, r * 1.1, -r * 0.1, r * 0.7, r * 0.4], "#5a2a8a", 0.6);
        El(0, 0, r * 0.75, r * 0.85, 0, "#3d2066", 1.2);
        P([-r * 0.55, -r * 0.6, -r * 0.45, -r * 1.25, -r * 0.1, -r * 0.7], "#3d2066", 0.3); P([r * 0.55, -r * 0.6, r * 0.45, -r * 1.25, r * 0.1, -r * 0.7], "#3d2066", 0.3);
        fl(pC(r * 0.3, -r * 0.15, r * 0.18), "#ff3b52"); fl(pC(-r * 0.05, -r * 0.15, r * 0.18), "#ff3b52");
      });
      c.drawImage(s.c, Math.round(p.x + s.x), Math.round(p.y + s.y));
    },
    tornado: function(c, p) {
      const r = p.raio, f = Math.floor(p.t * 14) % 3, s = ps("tn" + r + f, -r * 1.4, -r * 1.6, r * 1.4, r * 1.3, function() {
        for (let i = 0; i < 5; i++) {
          const y = r * 1.05 - i * r * 0.6, w = r * (0.32 + i * 0.24), dx = Math.sin(i * 1.3 + f * 2.1) * r * 0.12;
          El(dx, y, w, r * 0.24, 0, i % 2 ? "#cfe7ec" : "#a9d3db", 0.8, function() { trc(function(g) { g.beginPath(); g.ellipse(dx, y, w * 0.7, r * 0.12, 0, 0.2 + f, 2 + f); }, 1.3, "#ffffff", 0.9); });
        }
      });
      c.globalAlpha = 0.92; c.drawImage(s.c, Math.round(p.x + s.x), Math.round(p.y + s.y)); c.globalAlpha = 1;
    },
    torreta: function(c, p) {
      const r = p.raio, base = ps("tb" + r, -r * 1.3, -r * 0.5, r * 1.3, r * 1.1, function() {
        ln(-r * 0.2, r * 0.3, -r * 1.1, r * 1.0, 2.6, K.fe); ln(r * 0.2, r * 0.3, r * 1.1, r * 1.0, 2.6, K.fe); ln(0, r * 0.3, 0, r * 1.0, 2.6, K.fe);
        R(-r * 0.75, -r * 0.4, r * 1.5, r * 0.8, 2.5, K.ol2, 1.2, function() { ln(-r * 0.6, 0, r * 0.6, 0, 1.4, K.am, 0.9); });
      });
      const fx = Math.cos(p.mira || 0) < 0, cab = ps("tc" + r + (fx ? "f" : ""), -r * 0.8, -r * 0.8, r * 1.9, r * 0.8, function() {
        if (fx) G.scale(1, -1);
        R(r * 0.2, -r * 0.24, r * 1.6, r * 0.42, 1.5, K.fe, 0.8); R(r * 1.6, -r * 0.32, r * 0.3, r * 0.6, 1, K.ac, 0.4);
        C(0, 0, r * 0.7, K.ol, 1.6, function() { fl(pC(r * 0.12, -r * 0.18, r * 0.2), "#ff3b52"); });
      });
      c.drawImage(base.c, Math.round(p.x + base.x), Math.round(p.y + base.y));
      const hx = p.x - Math.cos(p.mira || 0) * (p.recuo || 0) * 4, hy = p.y - r * 0.9 - Math.sin(p.mira || 0) * (p.recuo || 0) * 4;
      blitR(c, cab, hx, hy, p.mira || 0);
      if (p.parado && p.tiros !== undefined) for (let i = 0; i < p.tiros; i++) { c.fillStyle = "#ffdd4a"; c.fillRect(Math.round(p.x - r * 0.7 + i * 3.4), Math.round(p.y + r * 0.45), 2, 3); }
    }
  };
  function bombaGrudeSpr(r) {
    return ps("bgr" + r, -r * 1.5, -r * 1.7, r * 1.5, r * 1.3, function() {
      C(0, 0, r, "#3f4a6e", 1.8);
      cel(function(g) { g.beginPath(); g.moveTo(-r, -r * 0.2); g.quadraticCurveTo(0, -r * 1.2, r, -r * 0.2); g.quadraticCurveTo(r * 0.7, r * 0.4, r * 0.3, r * 0.1); g.quadraticCurveTo(0, r * 0.6, -r * 0.4, r * 0.1); g.quadraticCurveTo(-r * 0.8, r * 0.3, -r, -r * 0.2); g.closePath(); }, K.gs, 1);
      R(-r * 0.3, -r * 1.35, r * 0.6, r * 0.45, 1, K.fe, 0.4);
    });
  }
  function foguete(c, p, k, fl0, fh, L, corpo, nariz, faixa, off) {
    const a = ang(p), f = Math.floor(p.t * 24) % 2;
    blitR(c, chamaSpr(k + f, fl0, fh, f), p.x - Math.cos(a) * off * KK, p.y - Math.sin(a) * off * KK, a);
    blitR(c, missilSpr(k + "c", L, fh, corpo, nariz, faixa), p.x, p.y, a);
  }
  function granada(c, p, k, corpo, linha, anel, lampada) {
    const r = p.raio, s = granadaSpr(k + r, r, corpo, linha, anel), a = p.t * 7 * (p.vx < 0 ? -1 : 1), t1 = p.timer01 || 0, per = 0.5 - 0.42 * t1;
    blitR(c, s, p.x, p.y, a);
    rotp(a, 0, -r * 0.3 * KK); luz(c, p.x + RX, p.y + RY, r * 0.3 * KK, (p.t % per) < per * 0.5, lampada);
  }
  // projéteis pequenos são desenhados um pouco maiores que a caixa de colisão (leitura)
  const PK = { pedra: 1.4, bala: 1.35, bala_grande: 1.3, bala_rastro: 1.25, chumbo: 1.5, dardo: 1.3, shuriken: 1.3, flecha: 1.25, virote: 1.25, agua: 1.4, confete: 1.4, gelo: 1.3, mini_missil: 1.25, foguete: 1.1, missil: 1.1,
    granada: 1.35, granada_frag: 1.35, granada_gelo: 1.35, dinamite: 1.25, abelha: 1.4, fragmento: 1.5, bola_neve: 1.15, bola_pula: 1.15, mina: 1.2, plasma: 1.1 };
  function desenharProjetil(ctx, p) {
    if (p.preso) return;                                   // bomba grudada: vai junto da bolinha (desenharEstado)
    const f = PR[p.visual];
    if (f) { KK = PK[p.visual] || 1; f(ctx, p); }
    else { ctx.fillStyle = p.cor; ctx.beginPath(); ctx.arc(p.x, p.y, p.raio, 0, TAU); ctx.fill(); }
  }

  // =========================================================
  // FEIXES: camadas de traços nítidos (brilho largo translúcido, cor, núcleo branco). Sem blur.
  // =========================================================
  const BX = new Float32Array(2048), BY = new Float32Array(2048);
  function tracar(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); }
  function camadas(ctx, tr, L) {
    ctx.lineCap = "butt";
    for (let i = 0; i < L.length; i++) { ctx.lineWidth = L[i][0]; ctx.strokeStyle = L[i][1]; ctx.globalAlpha = L[i][2]; tr(); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // amostra o caminho a cada "passo" px com deslocamento perpendicular off(i, dist) -> BX/BY; devolve quantidade
  function amostrar(pts, passo, off) {
    let n = 0, d = 0;
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s], b = pts[s + 1], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, k = Math.max(1, Math.round(L / passo));
      for (let i = (s ? 1 : 0); i <= k && n < 2040; i++) {
        const u = i / k, o = (i === 0 || i === k) ? off(n, d + L * u, true) : off(n, d + L * u, false);
        BX[n] = a.x + dx * u + nx * o; BY[n] = a.y + dy * u + ny * o; n++;
      }
      d += L;
    }
    return n;
  }
  function tracarBuf(ctx, n) { ctx.beginPath(); ctx.moveTo(BX[0], BY[0]); for (let i = 1; i < n; i++) ctx.lineTo(BX[i], BY[i]); }
  function clarao(ctx, x, y, s, cor, rot) {
    const e = sp("cl" + cor, -12, -12, 12, 12, function() { fl(pP(estrela(0, 0, 11, 2.4, 4, 0)), cor); fl(pP(estrela(0, 0, 6, 1.6, 4, Math.PI / 4)), "#ffffff"); fl(pC(0, 0, 3), "#ffffff"); }, 2, 1);
    blit(ctx, e, x, y, rot, s / 11);
  }
  const ARCO = ["#ff5a5a", "#ff9a3c", "#ffd94e", "#5fcf74", "#4ea8f6", "#6b6ae8", "#b46bf0"];
  function desenharFeixe(ctx, pts, visual, v, cor) {
    if (!pts || pts.length < 2) return;
    const t = agora(), z = pts[pts.length - 1], tr = function() { tracar(ctx, pts); };
    ctx.save(); ctx.lineJoin = "bevel";
    if (visual === "laser") {
      camadas(ctx, tr, [[24 * v + 5, "#ff3b52", 0.2], [9 * v + 2.6, "#ff3b52", 1], [2.8 * v + 0.9, "#ffffff", 1]]);
      clarao(ctx, z.x, z.y, 16 * v + 6, "#ff4a5a", t * 3);
    } else if (visual === "railgun") {
      camadas(ctx, tr, [[30 * v + 6, "#2fcbe2", 0.2], [12 * v + 3, "#2fcbe2", 1], [3.6 * v + 1, "#ffffff", 1]]);
      ctx.lineCap = "butt"; ctx.setLineDash([4, 60]); ctx.lineDashOffset = -t * 300; ctx.lineWidth = 20 * v + 3; ctx.strokeStyle = "#e8fdff"; ctx.globalAlpha = 0.85; tr(); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      clarao(ctx, z.x, z.y, 26 * v + 8, "#3edbe8", t * 2); clarao(ctx, pts[0].x, pts[0].y, 16 * v + 4, "#3edbe8", 0);
    } else if (visual === "arco_iris") {
      camadas(ctx, tr, [[30 * v + 6, "#ffffff", 0.2]]);
      ctx.lineCap = "butt";
      for (let k = 0; k < 7; k++) {
        const o = (k - 3) * 4.2 * v;
        ctx.beginPath();
        for (let s = 0; s < pts.length - 1; s++) {
          const p0 = pts[s], p1 = pts[s + 1], dx = p1.x - p0.x, dy = p1.y - p0.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * o, ny = dx / L * o;
          ctx.moveTo(p0.x + nx, p0.y + ny); ctx.lineTo(p1.x + nx, p1.y + ny);
        }
        ctx.lineWidth = 4.6 * v + 0.6; ctx.strokeStyle = ARCO[k]; ctx.stroke();
      }
      clarao(ctx, z.x, z.y, 18 * v + 6, "#ffffff", t * 2);
    } else if (visual === "feixe") {
      const n = amostrar(pts, 18, function(i, d, ponta) { return ponta ? 0 : Math.sin(d * 0.16 - t * 22) * 5; });
      camadas(ctx, function() { tracarBuf(ctx, n); }, [[20, "#c86bff", 0.18], [9, "#a24dff", 0.6], [3.4, "#f6d9ff", 1]]);
      clarao(ctx, z.x, z.y, 14, "#ff7ad0", t * 5);
    } else if (visual === "relampago") {
      const n = amostrar(pts, 30, function(j, d, ponta) { return ponta ? 0 : (Math.random() - 0.5) * 36; });
      camadas(ctx, function() { tracarBuf(ctx, n); }, [[12 * v + 3, "#ffd23a", 0.45], [4.4 * v + 1.2, "#fff6b0", 1], [1.8 * v + 0.6, "#ffffff", 1]]);
      clarao(ctx, z.x, z.y, 34 * v + 8, "#ffe14d", 0);
    } else { // raio (tesla) e padrão
      const n = amostrar(pts, 40, function(j, d, ponta) { return ponta ? 0 : (Math.random() - 0.5) * 30; });
      camadas(ctx, function() { tracarBuf(ctx, n); }, [[18 * v + 4, "#7ee8ff", 0.16], [8 * v + 2, "#3fa7e6", 0.5], [3 * v + 1, "#e4f9ff", 1]]);
      clarao(ctx, z.x, z.y, 14 * v + 4, "#7ee8ff", t * 7);
    }
    ctx.restore();
  }

  // =========================================================
  // AVISOS DO CÉU, METEORO
  // =========================================================
  function desenharAviso(ctx, x, y, raio, prog, visual) {
    const t = agora(), el = visual === "relampago", cor = el ? "#ffe14d" : "#ff5a3c", fim = prog > 0.7 && Math.floor(t * 14) % 2 === 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = cor; ctx.globalAlpha = 0.1 + 0.16 * prog; ctx.beginPath(); ctx.arc(0, 0, raio, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.22 + 0.3 * prog; ctx.beginPath(); ctx.arc(0, 0, raio * prog, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.95; ctx.lineWidth = 3; ctx.strokeStyle = fim ? "#ffffff" : cor; ctx.setLineDash([11, 8]); ctx.lineDashOffset = -t * 36;
    ctx.beginPath(); ctx.arc(0, 0, raio, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2.4; ctx.beginPath();
    ctx.moveTo(-raio * 0.28, 0); ctx.lineTo(raio * 0.28, 0); ctx.moveTo(0, -raio * 0.28); ctx.lineTo(0, raio * 0.28); ctx.stroke();
    ctx.fillStyle = fim ? "#ffffff" : cor; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(14, 10); ctx.lineTo(-14, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#2a1020"; ctx.fillRect(-1.5, -6, 3, 9); ctx.fillRect(-1.5, 5, 3, 3);
    ctx.restore();
  }
  function desenharMeteoro(ctx, x, y, prog, a) {
    if (a === undefined) a = Math.PI / 2;
    const f = Math.floor(agora() * 20) % 2;
    const cauda = sp("mt" + f, -120, -26, 2, 26, function() {
      fl(pP([0, -20, -60 - f * 12, -16, -118, 0, -60 - f * 12, 16, 0, 20]), "#f2552c", 0.9); fl(pP([0, -13, -44 - f * 10, -9, -86, 0, -44 - f * 10, 9, 0, 13]), K.lj); fl(pP([0, -7, -26, -4, -52, 0, -26, 4, 0, 7]), K.am);
    });
    const rocha = sp("mr", -26, -26, 26, 26, function() {
      P([22, -2, 15, -17, 0, -23, -16, -17, -24, 2, -13, 19, 6, 23, 19, 13], "#6e5c80", 3, function() {
        trc(function(g) { g.beginPath(); g.moveTo(-10, -12); g.lineTo(-2, -2); g.lineTo(-8, 10); }, 2.4, K.lj); trc(function(g) { g.beginPath(); g.moveTo(8, -12); g.lineTo(4, 0); g.lineTo(14, 8); }, 2, K.lj);
        fl(pC(-9, -12, 3), K.am, 0.8);
      });
    });
    const e = 0.7 + 0.3 * prog;
    blit(ctx, cauda, x, y, a, e); blit(ctx, rocha, x, y, a * 0 + prog * 3, e);
  }

  // =========================================================
  // CAIXAS DE ARMA por raridade (1 comum azul, 2 rara roxa, 3 lendária dourada com raios)
  // =========================================================
  const RAR = { 1: ["#5aa7f0", "#e3efff"], 2: ["#9a63f0", "#e6d8ff"], 3: ["#f5b83a", "#fff2c2"] };
  const CE = 1.5;                         // resolução dos sprites estáticos de caixa/carta
  function caixaSpr(r, sombra) {
    return sp("cx" + r + (sombra ? "s" : ""), -46, -50, 46, 40, function() {
      const cor = RAR[r][0], luz2 = RAR[r][1];
      G.globalAlpha = 0.3 + r * 0.08; G.drawImage(brilho(cor), -40, -40, 80, 80); G.globalAlpha = 1;
      if (sombra) { G.globalAlpha = 0.28; G.fillStyle = "#0a0a1e"; G.beginPath(); G.ellipse(0, 22, 22, 5, 0, 0, TAU); G.fill(); G.globalAlpha = 1; }
      if (r === 3) {
        P([-21, -12, -29, -20, -27, -6], K.ou, 0.8); P([21, -12, 29, -20, 27, -6], K.ou, 0.8);
        P([-14, -20, -10, -30, -4, -22, 0, -33, 4, -22, 10, -30, 14, -20], K.ou, 1.2);
      }
      // corpo com faixa de baixo mais escura e cantoneiras de metal
      R(-20, -15, 40, 34, 6, cor, 2.6, function(g) { g.fillStyle = pal(cor).s; g.globalAlpha = 0.55; g.fillRect(-22, 12, 44, 10); g.globalAlpha = 1; });
      for (const sx of [-1, 1]) P([sx * 20, 11, sx * 20, 19, sx * 12, 19], r === 3 ? "#fff1b8" : "#e9eefb", 0.6);
      // tampa com alça e listra clara
      R(-22, -21, 44, 12, 5, mix(cor, "#ffffff", 0.3), 2, function(g) { g.fillStyle = luz2; g.globalAlpha = 0.95; g.fillRect(-4.5, -24, 9, 16); g.globalAlpha = 1; ln(-19, -11.5, 19, -11.5, 1.2, pal(cor).s, 0.8); });
      for (const sx of [-1, 1]) C(sx * 16.5, -15, 2.2, r === 3 ? "#fff6c9" : "#eef3ff", 0.6);
      // visor iluminado na cor da raridade (a arma aparece bem em cima dele)
      const vis = pR(-15.5, -6.5, 31, 22.5, 4.6);
      vis(G); G.fillStyle = mix(cor, "#14102e", 0.55); G.fill();
      G.save(); vis(G); G.clip();
      const gr = G.createRadialGradient(0, 4, 1, 0, 4, 19); gr.addColorStop(0, mix(cor, "#ffffff", 0.75)); gr.addColorStop(0.55, mix(cor, "#ffffff", 0.2)); gr.addColorStop(1, mix(cor, "#14102e", 0.35));
      G.fillStyle = gr; G.fillRect(-16, -7, 32, 24);
      fl(pP([-16, -7, -4, -7, -14, 16, -16, 16]), "#ffffff", 0.16);           // reflexo do vidro
      G.restore();
      trc(vis, 2, mix(cor, "#14102e", 0.6)); trc(pR(-14.2, -5.2, 28.4, 19.9, 3.6), 1, "#ffffff", 0.45);
      if (r === 2) P([0, -30, 6, -25, 0, -19, -6, -25], "#e6d8ff", 1);
    }, CE, 1);
  }
  // reflexo diagonal que passa pela caixa (quadros guardados, recortados no formato dela)
  function caixaBrilho(i) {
    return sp("cxb" + i, -24, -24, 24, 22, function() {
      G.save(); pR(-22, -21, 44, 40, 6)(G); G.clip(); G.translate(-34 + i * 12, 0); G.rotate(0.45);
      fl(pR(0, -40, 8, 80, 0), "#ffffff", 0.45); fl(pR(11, -40, 3, 80, 0), "#ffffff", 0.3); G.restore();
    }, CE, 1);
  }
  function paraSpr(r) {
    return sp("pq" + r, -34, -66, 34, 0, function() {
      const cor = RAR[r][0];
      for (const sx of [-12, 12]) ln(sx * 2.4, -42, sx * 1.2, -2, 1.1, "#c8d0e8", 0.9);
      ln(-24, -42, -12, 0, 1.1, "#c8d0e8"); ln(24, -42, 12, 0, 1.1, "#c8d0e8");
      P([-32, -42, -30, -52, -20, -61, 0, -65, 20, -61, 30, -52, 32, -42, 21, -46, 11, -42, 0, -46, -11, -42, -21, -46], "#ffffff", 2.4, function(g) {
        g.fillStyle = cor; for (let i = 0; i < 4; i += 2) { g.beginPath(); g.moveTo(0, -70); g.lineTo(-32 + i * 16, -40); g.lineTo(-32 + (i + 1) * 16, -40); g.closePath(); g.fill(); }
        g.fillStyle = "rgba(30,20,80,.2)"; g.fillRect(-34, -50, 68, 12);              // sombra da borda do pano
        fl(pE(-13, -58, 10, 2.6, -0.3), "#ffffff", 0.6);                               // reflexo no alto
      });
    }, CE, 1);
  }

  function desenharCaixa(ctx, c) {
    const r = c.raridade || 1, t = c.t || 0, bob = Math.sin(t * 3.2);
    ctx.save(); ctx.translate(Math.round(c.x), Math.round(c.y));
    if (r === 3) {
      const q = Math.floor(t * 5) % 2, rios = sp("rios" + q, -40, -40, 40, 40, function() { for (let i = 0; i < 10; i++) { G.save(); G.rotate(i * TAU / 10 + q * TAU / 20); fl(pP([0, 0, 40, -4, 40, 4]), "#ffd84d", 0.5); G.restore(); } }, 1, 1);
      ctx.drawImage(rios.c, -40, -40);
    }
    if (c.paraquedas) { ctx.save(); ctx.translate(Math.sin(t * 2) * 2, -17); const p = paraSpr(r); ctx.drawImage(p.c, p.x, p.y, p.w, p.h); ctx.restore(); }
    if (r > 1) aura(ctx, RAR[r][0], 0, 0, 40 + bob * 3, 0.32);          // rara/lendária: brilho pulsando
    const s = caixaSpr(r, !c.paraquedas); ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
    icone(ctx, c.idArma, 0, Math.round(4.5 + bob * 1.2), 29);
    const ph = (t * 0.55 + (r - 1) * 0.3) % 1.6;                       // reflexo passando a cada ~3 s
    if (ph < 0.6) { const f = caixaBrilho(Math.min(5, (ph / 0.6 * 6) | 0)); ctx.drawImage(f.c, f.x, f.y, f.w, f.h); }
    if (r > 1) {
      const e = brSpr(), k = Math.abs(Math.sin(t * 4));
      blit(ctx, e, -17, -18, 0, 0.4 + k * 0.9); blit(ctx, e, 18, 12, 0, 0.4 + Math.abs(Math.sin(t * 4 + 2)) * 0.9);
    }
    ctx.restore();
  }


  // =========================================================
  // v19: SENSAÇÃO DO TIRO E PEDAÇOS QUE VOAM (pool fixo, sprites guardados; só drawImage por quadro)
  //   disparo(a, x, y, ang, dir, mudo): clarão na boca do cano (pólvora, energia ou gosma) e cápsula saindo
  //   soltar(tipo, x, y, n): gosma, faísca, banana, bolha, pingo
  //   desenharSoltos(ctx, M): anda e desenha (o relógio é o da rodada: pausa e câmera lenta valem)
  //   desenharEstado(ctx, b, t): bolha em volta, gosma no pé, nó de balão (inflado), estrelinhas (escorregou), bomba grudada
  // =========================================================
  const NS = 160;
  const SX = new Float32Array(NS), SY = new Float32Array(NS), SVX = new Float32Array(NS), SVY = new Float32Array(NS);
  const SV = new Float32Array(NS), SVM = new Float32Array(NS), SA = new Float32Array(NS), SVA = new Float32Array(NS), SG = new Float32Array(NS);
  const SQ = new Uint8Array(NS), ST = [];
  let ns = 0, mSoltos = null, tSoltos = 0;
  function novoSolto(tipo, x, y, vx, vy, vida, a, va, grav) {
    const lim = typeof CONFIG !== "undefined" && CONFIG.leve ? 70 : NS;
    if (ns >= lim) return;
    const i = ns++;
    ST[i] = tipo; SX[i] = x; SY[i] = y; SVX[i] = vx; SVY[i] = vy; SV[i] = vida; SVM[i] = vida; SA[i] = a || 0; SVA[i] = va || 0; SG[i] = grav || 0; SQ[i] = 0;
  }
  function tipoClarao(a) {
    if (a.tipo === "melee" || a.tipo === "mina" || a.tipo === "ceu" || a.tipo === "torreta" || a.tipo === "feixe") return null;
    if (a.capsula === "energia" || a.tipo === "laser" || a.tipo === "raio") return "energia";
    if (a.gruda || a.visual === "gosma") return "gosma";
    if (a.capsula || (a.fumaca || 0) >= 1 || a.visual === "bala") return "polvora";
    return null;
  }
  function disparo(a, x, y, ang, dir, mudo) {
    if (!a) return;
    const cl = tipoClarao(a);
    if (cl) {
      const tam = cl === "polvora" ? 0.75 + Math.min(1.1, (a.tremor || 1) * 0.13) : 0.9;
      novoSolto("cl_" + cl, x, y, 0, 0, cl === "polvora" ? 0.07 : 0.1, ang, tam, 0);
      if (cl === "gosma") for (let i = 0; i < 3; i++) novoSolto("gosma", x, y, Math.cos(ang + (Math.random() - 0.5)) * 90, Math.sin(ang + (Math.random() - 0.5)) * 90 - 40, 0.35, 0, 0, 700);
    }
    if (a.capsula && !(typeof CONFIG !== "undefined" && CONFIG.leve && a.cadencia < 0.1 && Math.random() < 0.5)) {
      const bx = x - Math.cos(ang) * 26, by = y - Math.sin(ang) * 26 - 4;
      novoSolto("cap_" + a.capsula, bx, by, -dir * (60 + Math.random() * 90), -(150 + Math.random() * 120), 1.1, Math.random() * 6, (Math.random() - 0.5) * 30, 1100);
    }
  }
  function soltar(tipo, x, y, n) {
    n = n || 1;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = 40 + Math.random() * 140;
      if (tipo === "gosma") novoSolto("gosma", x, y, Math.cos(a) * v, Math.sin(a) * v - 80, 0.5 + Math.random() * 0.3, 0, 0, 800);
      else if (tipo === "faisca") novoSolto("faisca", x, y, Math.cos(a) * v * 1.5, Math.sin(a) * v * 1.5, 0.22, a, 0, 300);
      else if (tipo === "banana") novoSolto("banana", x, y, (Math.random() - 0.5) * 120, -260, 0.8, 0, 14, 900);
      else if (tipo === "bolha") novoSolto("bolha", x + Math.cos(a) * 20, y + Math.sin(a) * 20, Math.cos(a) * v, Math.sin(a) * v, 0.3, 0, 0, 0);
      else if (tipo === "pingo") novoSolto("pingo", x, y, 0, 20, 0.5, 0, 0, 600);
    }
  }
  // sprites dos pedaços (todos pequenos, desenhados 1:1 a partir de 16 rotações)
  function spSolto(tipo) {
    switch (tipo) {
      case "cl_polvora": return sp("scp", -4, -14, 30, 14, function() {
        fl(pP([-2, -6, 10, -12, 13, -4, 30, 0, 13, 4, 10, 12, -2, 6]), K.lj); fl(pP([0, -4, 9, -7, 11, -2, 22, 0, 11, 2, 9, 7, 0, 4]), K.am); fl(pE(5, 0, 6, 3, 0), "#ffffff"); }, 2, 1);
      case "cl_energia": return sp("sce", -14, -14, 14, 14, function() { trc(pC(0, 0, 10), 3, K.ci); fl(pP(estrela(0, 0, 13, 3, 4, 0)), "#e8fdff"); fl(pC(0, 0, 4), "#ffffff"); }, 2, 1);
      case "cl_gosma": return sp("scg", -12, -12, 12, 12, function() { fl(pP(estrela(0, 0, 11, 6, 6, 0.3)), K.gs); fl(pC(-2, -2, 3), "#e6ffd6"); }, 2, 1);
      case "cap_bala": return sp("sk1", -4, -2.5, 4, 2.5, function() { R(-3, -1.6, 6, 3.2, 1.2, K.ou, 0.6); }, 2, 1);
      case "cap_cartucho": return sp("sk2", -5, -3, 5, 3, function() { R(-4.4, -2.2, 6.2, 4.4, 1.2, K.ve, 0.6); R(1.6, -2.2, 2.6, 4.4, 0.8, K.ou, 0.3); }, 2, 1);
      case "cap_grande": return sp("sk3", -6, -3, 6, 3, function() { R(-5, -2.2, 10, 4.4, 1.6, K.ou, 0.8); }, 2, 1);
      case "cap_energia": return sp("sk4", -5, -3, 5, 3, function() { R(-4.2, -2.2, 8.4, 4.4, 1.6, K.ci, 0.6); fl(pR(-1.5, -1, 3, 2, 0.8), "#ffffff"); }, 2, 1);
      case "gosma": return sp("sgm", -5, -5, 5, 5, function() { C(0, 0, 3.6, K.gs, 0.8); }, 2, 1);
      case "pingo": return sp("spg", -4, -5, 4, 5, function() { cel(function(g) { g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(3.4, 1, 0, 3.6); g.quadraticCurveTo(-3.4, 1, 0, -4); g.closePath(); }, K.gs, 0.6); }, 2, 1);
      case "faisca": return sp("sfa", -6, -6, 6, 6, function() { faisca(0, 0, 5, K.am); faisca(0, 0, 2.4, "#ffffff"); }, 2, 1);
      case "banana": return sp("sbn", -9, -6, 9, 6, function() {
        cel(function(g) { g.beginPath(); g.moveTo(-1, 1); g.quadraticCurveTo(-6, -2, -8, 3); g.quadraticCurveTo(-4, 4, 0, 4); g.closePath(); }, K.am, 0.8);
        cel(function(g) { g.beginPath(); g.moveTo(1, 1); g.quadraticCurveTo(6, -2, 8, 3); g.quadraticCurveTo(4, 4, 0, 4); g.closePath(); }, K.am, 0.8);
        R(-2, 1, 4, 3.4, 1.2, "#c78b2a", 0.4); }, 2, 1);
      case "bolha": return sp("sbo", -5, -5, 5, 5, function() { trc(pC(0, 0, 3.4), 1.4, "#d9f7ff"); }, 2, 1);
    }
    return null;
  }
  function desenharSoltos(ctx, M) {
    if (M !== mSoltos) { mSoltos = M; ns = 0; tSoltos = M ? M.t : 0; }
    if (!ns) { if (M) tSoltos = M.t; return; }
    let dt = M.t - tSoltos; tSoltos = M.t;
    if (dt < 0 || dt > 0.1) dt = dt < 0 ? 0 : 0.1;
    const plats = M.plats || [];
    for (let i = 0; i < ns; i++) {
      SV[i] -= dt;
      if (SV[i] <= 0) {                                  // remove trocando pelo último
        ns--; ST[i] = ST[ns]; SX[i] = SX[ns]; SY[i] = SY[ns]; SVX[i] = SVX[ns]; SVY[i] = SVY[ns]; SV[i] = SV[ns]; SVM[i] = SVM[ns]; SA[i] = SA[ns]; SVA[i] = SVA[ns]; SG[i] = SG[ns]; SQ[i] = SQ[ns];
        i--; continue;
      }
      const ya = SY[i];
      SVY[i] += SG[i] * dt; SX[i] += SVX[i] * dt; SY[i] += SVY[i] * dt;
      const tipo = ST[i];
      if (tipo.charAt(0) !== "c" || tipo.charAt(1) === "a") SA[i] += SVA[i] * dt;
      // cápsulas e cascas quicam no chão (e fazem "tlim")
      if ((tipo.charAt(1) === "a" || tipo === "banana") && SVY[i] > 0 && SQ[i] < 3) {
        for (let k = 0; k < plats.length; k++) {
          const p = plats[k];
          if (SX[i] < p.x || SX[i] > p.x + p.w || ya > p.y || SY[i] < p.y) continue;
          SY[i] = p.y - 1; SVY[i] *= -0.38; SVX[i] *= 0.55; SVA[i] *= 0.5; SQ[i]++;
          if (SQ[i] >= 3) { SVY[i] = 0; SVX[i] = 0; SG[i] = 0; SVA[i] = 0; }
          break;
        }
      }
      const spr = spSolto(tipo);
      if (!spr) continue;
      const u = SV[i] / SVM[i];
      ctx.globalAlpha = tipo.charAt(1) === "l" ? 1 : Math.min(1, u * 3);
      if (tipo === "cl_polvora" || tipo === "cl_energia" || tipo === "cl_gosma") blit(ctx, spr, SX[i], SY[i], SA[i], SVA[i] * (0.7 + 0.5 * u));
      else blitR(ctx, spr, SX[i], SY[i], SA[i]);
    }
    ctx.globalAlpha = 1;
  }
  // estado em cima da bolinha
  function desenharEstado(ctx, b, t) {
    const ef = b.efeitos;
    if (!ef) return;
    if (ef.grudado > 0) {
      const s = sp("egr", -40, -10, 40, 10, function() {
        cel(function(g) { g.beginPath(); g.moveTo(-34, 6); g.quadraticCurveTo(-30, -6, -16, -4); g.quadraticCurveTo(-6, -9, 4, -5); g.quadraticCurveTo(18, -9, 30, -3); g.quadraticCurveTo(38, 2, 32, 6); g.closePath(); }, K.gs, 1.2);
        fl(pE(-10, -3, 5, 1.4, 0), "#e6ffd6", 0.9);
      }, 1.5, 1);
      const k = b.r / 28;
      ctx.save(); ctx.translate(b.x, b.y + b.r * 0.85); ctx.scale(k, k); ctx.globalAlpha = Math.min(1, ef.grudado * 3);
      ctx.drawImage(s.c, s.x, s.y, s.w, s.h); ctx.restore();
    }
    if (ef.inflado > 0) {
      const s = sp("ein", -7, 0, 7, 22, function() {
        trc(function(g) { g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(5, 12, 0, 16); g.quadraticCurveTo(-5, 19, 0, 22); }, 1.6, "#f6f7ff");
        P([-5, 7, 0, 0, 5, 7], K.rs, 0.6);
      }, 1.5, 1);
      ctx.drawImage(s.c, Math.round(b.x + s.x), Math.round(b.y + b.r - 3 + s.y), s.w, s.h);
    }
    if (ef.escorrega > 0) {
      const s = sp("ees", -7, -7, 7, 7, function() { P(estrela(0, 0, 6, 2.6, 5, -Math.PI / 2), K.am, 0.8); }, 2, 1);
      for (let i = 0; i < 3; i++) {
        const a = t * 7 + i * TAU / 3;
        ctx.drawImage(s.c, Math.round(b.x + Math.cos(a) * b.r * 0.8 + s.x), Math.round(b.y - b.r - 10 + Math.sin(a) * 6 + s.y), s.w, s.h);
      }
    }
    if (b.bombaGrudada && b.bombaGrudada.vivo) {
      const p = b.bombaGrudada, r = p.raio, s = bombaGrudeSpr(r);
      KK = 1.1;
      blitR(ctx, s, p.x, p.y, Math.sin(t * 9) * 0.3);
      const t1 = p.timer01 || 0, per = 0.4 - 0.32 * t1;
      luz(ctx, p.x, p.y, r * 0.32, (t % per) < per * 0.5, "#ff3b52");
    }
    if (ef.bolha > 0) {
      const R0 = b.r * 1.5, s = sp("ebo", -50, -50, 50, 50, function() {
        fl(pC(0, 0, 46), "#9be8ff", 0.18); trc(pC(0, 0, 45), 3, "#d9f7ff", 0.95); trc(pC(0, 0, 40), 1.2, "#9be8ff", 0.6);
        trc(function(g) { g.beginPath(); g.arc(0, 0, 32, 3.5, 4.7); }, 4, "#ffffff", 0.95); fl(pC(20, 22, 3.4), "#ffffff", 0.9);
      }, 1.2, 1);
      const w = 1 + Math.sin(t * 9) * 0.05, h = 1 - Math.sin(t * 9) * 0.05, k = R0 / 46;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k * w, k * h); ctx.globalAlpha = ef.bolha < 0.25 && Math.floor(t * 20) % 2 ? 0.4 : 1;
      ctx.drawImage(s.c, s.x, s.y, s.w, s.h); ctx.restore();
    }
  }

  function aquecer() {
    Object.keys(W).forEach(spriteArma); maoSpr(); brSpr(); [1, 2, 3].forEach(function(r) { caixaSpr(r); caixaSpr(r, true); paraSpr(r); });
    for (let i = 0; i < 6; i++) caixaBrilho(i);
    ["cl_polvora", "cl_energia", "cl_gosma", "cap_bala", "cap_cartucho", "cap_grande", "cap_energia", "gosma", "pingo", "faisca", "banana", "bolha"].forEach(spSolto);
    if (typeof ARMAS !== "undefined") ARMAS.forEach(function(a) { if (PR[a.visual]) PR[a.visual](ctxAq(), { x: -999, y: -999, vx: 1, vy: 0, raio: a.raio || 4, t: 0, cor: "#ff5d73", timer01: 0 }); });
  }
  let _aq = null;
  function ctxAq() { return _aq || (_aq = cv(4, 4).getContext("2d")); }

  return {
    desenharNaMao: desenharNaMao, desenharProjetil: desenharProjetil, desenharFeixe: desenharFeixe, desenharAviso: desenharAviso,
    desenharMeteoro: desenharMeteoro, icone: icone, desenharCaixa: desenharCaixa, pontaDoCano: pontaDoCano, aquecer: aquecer,
    // v19
    disparo: disparo, soltar: soltar, desenharSoltos: desenharSoltos, desenharEstado: desenharEstado
  };
})();
