"use strict";

// =========================
// QUEDA DE BRAÇO (v3)
// Pose clássica em 3/4: mesa de queda de braço na frente; as duas bolinhas (com faixa na cabeça) debruçadas no
// fundo da mesa, cara a cara; cotovelos juntos no centro, antebraços subindo em "V invertido" e mãos entrelaçadas
// no alto, entre os rostos (dedos de uma envolvendo o dorso da outra, polegares cruzados). O braço livre de cada um
// segura o pino da mesa; o vencedor crava a mão do outro na almofada e levanta o punho.
//
// Desempenho (raster por software): girar/escalar sprite por quadro é caro (~18 ns/pixel); copiar sprite 1:1 é
// baratíssimo. Então TUDO que é grande vira sprite desenhado 1:1 (sem girar nem escalar no quadro):
//   - arena + mesa: 1 canvas opaco por tamanho de tela + cores;
//   - "conjunto" antebraços + mãos entrelaçadas (com as sombras projetadas embutidas): 1 sprite por passo de
//     0,06 rad do giro (43 passos), desenhado na posição contínua das mãos;
//   - braço (bíceps/tríceps): 1 sprite por passo de 0,04 rad do ângulo cotovelo->ombro, ancorado no cotovelo (a
//     ponta do ombro some sob o deltoide);
//   - deltoides, punhos no pino, braço livre, braço erguido, coroa, estrelinha, dígitos e textos: sprites 1:1.
// Os braços são desenhados com caminhos vetoriais + cel-shading sem clip (sombra, luz e base estreitadas para o
// lado da luz) só no pré-render. preparar() gera tudo e força o raster (fora dos quadros).
// API: ArteQueda.desenhar(ctx, q, largura, altura), ArteQueda.preparar(cor1, cor2, largura, altura).
// Depende de ArteBolinha (bolinhas.js carregado antes).
// =========================

const ArteQueda = (function() {
  var PI = Math.PI, PI2 = PI * 2;
  var ESC = [26, 13, 51], AZ = [48, 28, 120], BR = [255, 255, 255], TINTA = "#1a0d33";   // v19: contorno escuro e grosso do jogo

  // ---------- geometria (mundo 1280x720; b2 é o espelho de b1 em x = 640) ----------
  var RB = 90;                    // raio das bolinhas
  var BX = 486, BY = 330;         // centro de b1
  var PVX = 640, PVY = 590;       // pivô do giro das mãos (entre os cotovelos, sobre as almofadas)
  var ED = 70;                    // meia distância entre os cotovelos
  var HS = 1.4;                   // escala das mãos
  var WX = 36 * HS, WY = 40 * HS; // centro das mãos -> punho (referencial girado das mãos)
  var CR = 205;                   // pivô -> centro das mãos
  var TH_JOGO = 0.9, TH_FIM = 1.2;      // giro das mãos em jogo e na batida final
  // ângulos pré-renderizados do conjunto antebraços+mãos: passo 0,07 rad na disputa e só 3 passos por lado na
  // batida final (movimento rápido): 33 sprites
  var DTH = 0.07, NIN = 13, ANG = [];
  (function() { var ext = [1.02, 1.12, 1.2], i; for (i = 2; i >= 0; i--) ANG.push(-ext[i]); for (i = -NIN; i <= NIN; i++) ANG.push(i * DTH); for (i = 0; i < 3; i++) ANG.push(ext[i]); })();
  function indiceAng(th) {
    if (th >= -(NIN + 0.5) * DTH && th <= (NIN + 0.5) * DTH) return 3 + NIN + Math.round(th / DTH);
    var m = 0, md = 9;
    for (var i = 0; i < ANG.length; i++) { var d = Math.abs(ANG[i] - th); if (d < md) { md = d; m = i; } }
    return m;
  }
  var MESA_Y0 = 418, MESA_Y1 = 626, MESA_Y2 = 676;
  var PINO_X = 334, PINO_Y = 506; // pino de pegada de b1 (base)
  var PUNHO_X = 340, PUNHO_Y = 470;
  var OMB_DX = -0.38 * RB, OMB_DY = 0.74 * RB;   // ombro do braço de luta (relativo ao centro da bolinha)
  var BATIDA = 226;               // almofadas de batida em PVX +- BATIDA

  var novos = [], gravando = false;   // sprites criados dentro do preparar (para forçar o raster deles lá, fora dos quadros)
  function cv(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); if (gravando) novos.push(c); return c; }
  var rasc = null;
  function descarrega() {
    if (!rasc) { rasc = document.createElement("canvas"); rasc.width = rasc.height = 2; }
    var g = rasc.getContext("2d");
    for (var i = 0; i < novos.length; i++) g.drawImage(novos[i], 0, 0, 1, 1);
    novos.length = 0;
    try { g.getImageData(0, 0, 1, 1); } catch (e) {}
  }
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hexRgb(h) {
    if (!h || typeof h !== "string") return [128, 128, 128];
    if (h.charAt(0) === "#") h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return [128, 128, 128];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixA(a, b, q) { return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q]; }
  function css(a, al) { return al === undefined ? "rgb(" + Math.round(a[0]) + "," + Math.round(a[1]) + "," + Math.round(a[2]) + ")" : "rgba(" + Math.round(a[0]) + "," + Math.round(a[1]) + "," + Math.round(a[2]) + "," + al + ")"; }
  function mix(a, b, q, al) { return css(mixA(a, b, q), al); }
  function lumin(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  function semente(s) { return function() { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, PI2); }

  // pele dos braços: base um tico mais clara que a bolinha, sombra azulada, luz, borda e contorno da própria cor
  var peles = {};
  function pele(cor) {
    var p = peles[cor];
    if (p) return p;
    var c = hexRgb(cor), l = lumin(c), base = mixA(c, BR, 0.05);
    p = peles[cor] = {
      rgb: c, base: css(base), sombra: mix(c, AZ, l > 0.7 ? 0.46 : 0.4), luz: mix(c, BR, 0.42), luzS: css(mixA(base, BR, 0.26)),
      musc: css(mixA(base, BR, 0.12)), brilho: mix(c, BR, 0.8), rim: mix(c, [175, 230, 255], 0.55),
      contorno: TINTA, unha: mix(c, BR, 0.62)
    };
    return p;
  }

  // ---------- pintura cel-shading para sprites (pré-render; usa clip) ----------
  // trace(g) desenha o caminho no referencial M = [a,b,c,d,e,f]; deslocamentos da luz no MUNDO (cima-esquerda).
  var LX = -0.55, LY = -0.83;
  function cel(g, M, trace, p, k, lw, semContorno, luzA) {
    var d1 = k, d2 = k * 1.15;
    g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
    trace(g); g.fillStyle = p.sombra; g.fill();
    g.save(); g.clip();
    g.setTransform(M[0], M[1], M[2], M[3], M[4] + LX * d1, M[5] + LY * d1);   // base: tudo menos a faixa de sombra (baixo-direita)
    trace(g); g.fillStyle = p.base; g.fill();
    if (luzA > 0) {
      g.save(); g.clip();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = luzA; g.fillStyle = p.luz; g.fillRect(-4000, -4000, 8000, 8000); g.globalAlpha = 1;
      g.setTransform(M[0], M[1], M[2], M[3], M[4] - LX * d2, M[5] - LY * d2);  // miolo volta à base: sobra a faixa de luz (cima-esquerda)
      trace(g); g.fillStyle = p.base; g.fill();
      g.restore();
    }
    g.restore();
    if (!semContorno) {
      g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      trace(g); g.setTransform(1, 0, 0, 1, 0, 0);
      g.strokeStyle = p.contorno; g.lineWidth = lw; g.lineJoin = "round"; g.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  function linhaM(g, M, trace, cor, lw, a) {
    g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); trace(g); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = a; g.strokeStyle = cor; g.lineWidth = lw; g.lineCap = "round"; g.lineJoin = "round"; g.stroke(); g.globalAlpha = 1;
  }
  function brilhoM(g, M, x, y, rx, ry, rot, cor, a) {
    g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); ell(g, x, y, rx, ry, rot); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = a; g.fillStyle = cor; g.fill(); g.globalAlpha = 1;
  }
  function silhueta(c, cor) {
    var o = cv(c.width, c.height), g = o.getContext("2d");
    g.drawImage(c, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = cor || "#1a0f46"; g.fillRect(0, 0, o.width, o.height);
    return o;
  }
  // reduz um desenho feito em 2x para 1x
  function reduz(c, w, h) { var o = cv(w, h), g = o.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(c, 0, 0, w, h); return o; }

  // ---------- sprites estáticos dos braços ----------
  // deltoide (ombro redondo por cima da bolinha), iluminado de cima-esquerda; contorno aberto do lado do braço
  var deltS = {};
  function deltoide(cor, lado) {
    var k = cor + "|" + lado;
    if (deltS[k]) return deltS[k];
    var p = pele(cor), S = 2, R = 44, w = 2 * R + 16, c = cv(w * S, w * S), g = c.getContext("2d"), M = [S, 0, 0, S, w / 2 * S, w / 2 * S];
    cel(g, M, function(g) { ell(g, 0, 0, R, R * 0.96, 0); }, p, 9 * S, 0, true, 0.6);
    var a0 = lado > 0 ? 0.1 : PI - 0.1;           // abre o contorno virado para o cotovelo (baixo-dentro)
    linhaM(g, M, function(g) { g.beginPath(); if (lado > 0) g.ellipse(0, 0, R - 1, R * 0.96 - 1, 0, 1.55, 1.55 + PI * 1.45); else g.ellipse(0, 0, R - 1, R * 0.96 - 1, 0, PI - 1.55 - PI * 1.45, PI - 1.55); }, p.contorno, 2.4 * S, 1);
    brilhoM(g, M, -R * 0.42, -R * 0.42, R * 0.3, R * 0.12, -0.75, "#fff", 0.7);
    linhaM(g, M, function(g) { g.beginPath(); g.ellipse(0, 0, R - 5, R * 0.96 - 5, 0, 0.35, 1.25); }, p.rim, 2.6 * S, 0.9);
    return (deltS[k] = { c: reduz(c, w, w), m: w / 2 });
  }

  // forma de dedo dobrado (gomo com nó, ponta arredondada)
  function dedoForma(x0, y0, L, h, ang) {
    return function(g) {
      g.save(); g.translate(x0, y0); g.rotate(ang || 0);
      g.beginPath();
      g.moveTo(0, -h);
      g.bezierCurveTo(L * 0.45, -h * 1.12, L - h * 0.9, -h * 1.02, L - h * 0.55, -h * 0.82);
      g.bezierCurveTo(L + h * 0.25, -h * 0.4, L + h * 0.2, h * 0.75, L - h * 0.6, h * 0.92);
      g.bezierCurveTo(L * 0.5, h * 1.08, h * 0.4, h * 1.1, 0, h);
      g.bezierCurveTo(-h * 1.15, h * 0.9, -h * 1.15, -h * 0.95, 0, -h);
      g.closePath();
      g.restore();
    };
  }

  // punho fechado (em pé, nós para fora): usado no pino e no braço erguido. Referencial: centro do punho.
  function desenhaPunho(g, M, p, S) {
    var lw = 3.2 * S;
    function dorso(g) { g.beginPath(); g.moveTo(-30, -26); g.bezierCurveTo(-42, -24, -44, 20, -32, 28); g.bezierCurveTo(-18, 36, 10, 34, 24, 26); g.lineTo(26, -24); g.bezierCurveTo(10, -34, -16, -32, -30, -26); g.closePath(); }
    cel(g, M, dorso, p, 8 * S, lw, false, 0.5);
    var ys = [-16, -4, 8, 19], hs = [7, 7, 6.6, 5.8], ls = [30, 32, 30, 26];
    for (var i = 0; i < 4; i++) {
      cel(g, M, dedoForma(-26, ys[i], ls[i], hs[i], 0.04 * (i - 1)), p, 4 * S, lw, false, 0.55);
      (function(i) {
        brilhoM(g, M, -24, ys[i] - hs[i] * 0.45, 4, 2, 0, "#fff", 0.6);
        linhaM(g, M, function(g) { g.beginPath(); g.moveTo(-8 + i, ys[i] - hs[i] + 2); g.quadraticCurveTo(-6 + i, ys[i], -8 + i, ys[i] + hs[i] - 2); }, p.contorno, 1.3 * S, 0.5);
      })(i);
    }
    var pol = function(g) { g.beginPath(); g.moveTo(-30, -26); g.bezierCurveTo(-26, -38, 0, -36, 16, -28); g.bezierCurveTo(26, -24, 24, -14, 14, -15); g.bezierCurveTo(0, -18, -14, -16, -24, -12); g.closePath(); };
    cel(g, M, pol, p, 5 * S, lw, false, 0.55);
    cel(g, M, function(g) { ell(g, 14, -22, 5.5, 4.5, 0.3); }, { sombra: p.luz, base: p.unha, luz: p.brilho, contorno: p.contorno }, 1.5 * S, 1.2 * S, false, 0.5);
    brilhoM(g, M, -10, -30, 9, 2.4, -0.1, "#fff", 0.7);
  }
  // membro simples (braço livre) entre dois pontos do sprite, desenhado com cel (pré-render)
  function desenhaMembro(g, ax, ay, bx, by, p, S, lado, gross) {
    var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy), ux = dx / L, uy = dy / L;
    var nx = lado > 0 ? uy : -uy, ny = lado > 0 ? -ux : ux;
    var M = [ux * S, uy * S, nx * S, ny * S, ax * S, ay * S], lw = 3.3 * S, G = gross || 1;
    function sil(g) {
      g.beginPath();
      g.moveTo(-6, -32 * G);
      g.bezierCurveTo(L * 0.3, -44 * G, L * 0.62, -36 * G, L + 2, -19 * G);
      g.lineTo(L + 2, 19 * G);
      g.bezierCurveTo(L * 0.6, 30 * G, L * 0.3, 36 * G, -6, 30 * G);
      g.bezierCurveTo(-30 * G, 24 * G, -30 * G, -26 * G, -6, -32 * G);
      g.closePath();
    }
    cel(g, M, sil, p, 8 * S, lw, false, 0.45);
    g.save(); g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); sil(g); g.setTransform(1, 0, 0, 1, 0, 0); g.clip();
    cel(g, M, function(g) { ell(g, L * 0.4, -14 * G, L * 0.3, 21 * G, 0); }, p, 7 * S, lw, true, 0.6);
    linhaM(g, M, function(g) { g.beginPath(); g.moveTo(L * 0.14, 6 * G); g.bezierCurveTo(L * 0.32, 12 * G, L * 0.52, 10 * G, L * 0.7, 0); }, p.contorno, 2 * S, 0.65);
    g.restore();
  }
  // braço livre segurando o pino: sprite ancorado no punho; o ombro fica escondido atrás da bolinha
  var livreS = {};
  function livre(cor, lado) {
    var k = cor + "|" + lado;
    if (livreS[k]) return livreS[k];
    var p = pele(cor), S = 2, w = 190, h = 210, ox = 50, oy = 160;     // ox,oy = punho dentro do sprite (para b1)
    var c = cv(w * S, h * S), g = c.getContext("2d");
    var fx = lado > 0 ? ox : w - ox;
    var sx = (BX - 26 - PUNHO_X) * lado, sy = BY - 4 - PUNHO_Y;   // até perto do centro da bolinha
    desenhaMembro(g, fx + sx, oy + sy, fx + 10 * lado, oy - 6, p, S, -lado, 0.95);
    desenhaPunho(g, [S * lado, 0, 0, S, fx * S, oy * S], p, S);
    return (livreS[k] = { c: reduz(c, w, h), ox: fx, oy: oy });
  }
  // braço erguido do vencedor (punho para cima): sprite relativo ao centro da bolinha
  var ergS = {};
  function erguido(cor, lado) {
    var k = cor + "|" + lado;
    if (ergS[k]) return ergS[k];
    var p = pele(cor), S = 2, w = 220, h = 230, ox = 175, oy = 150;    // ox,oy = centro da bolinha dentro do sprite (b1)
    var c = cv(w * S, h * S), g = c.getContext("2d");
    var bx = lado > 0 ? ox : w - ox, fxp = bx - 128 * lado, fyp = oy - 104;
    desenhaMembro(g, bx - 20 * lado, oy - 10, fxp + 14 * lado, fyp + 22, p, S, lado, 1);
    var a = -0.5 * lado, ca = Math.cos(a), sa = Math.sin(a);
    desenhaPunho(g, [S * ca * lado, S * sa * lado, -S * sa, S * ca, fxp * S, fyp * S], p, S);
    return (ergS[k] = { c: reduz(c, w, h), ox: bx, oy: oy });
  }

  // estrelinha de 4 pontas (toque): branca com borda da cor do jogador
  var brilhoS = {};
  function brilhoT(cor) {
    if (brilhoS[cor]) return brilhoS[cor];
    var w = 64, c = cv(w, w), g = c.getContext("2d"), P = pele(cor);
    g.translate(w / 2, w / 2);
    g.beginPath();
    for (var i = 0; i < 8; i++) { var a = -PI / 2 + i * PI / 4, r = i % 2 ? 7 : 26; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fillStyle = "#ffffff"; g.fill(); g.strokeStyle = P.base; g.lineWidth = 3; g.lineJoin = "round"; g.stroke();
    return (brilhoS[cor] = { c: c, m: w / 2 });
  }

  // ---------- mãos entrelaçadas (molde em 2x; sprites girados 1x com a sombra embutida) ----------
  // A = b1 (esquerda), B = b2 (direita). Os 4 dedos de A envolvem o dorso de B; as pontas dos dedos de B
  // aparecem dando a volta no dorso de A; polegares cruzados por cima (o de A por cima do de B).
  var MS = 2, MW = 240, MH = 240, MOX = 120, MOY = 118, molde = {};
  function maos(c1, c2) {
    var k = c1 + "|" + c2;
    if (molde[k]) return molde[k];
    molde = {}; bracoS = {};                 // nova dupla de cores: solta os caches grandes da dupla anterior
    var pa = pele(c1), pb = pele(c2), S = MS;
    var c = cv(MW * S, MH * S), g = c.getContext("2d");
    var K = S * HS, MA = [K, 0, 0, K, MOX * S, MOY * S], MB = [-K, 0, 0, K, MOX * S, MOY * S], lw = 3.2 * S;
    function corpo(g) {                    // dorso/palma (lado esquerdo; espelhado para B)
      g.beginPath();
      g.moveTo(-52, 46);
      g.bezierCurveTo(-62, 26, -64, 0, -58, -20);
      g.bezierCurveTo(-52, -42, -28, -48, -10, -40);
      g.bezierCurveTo(0, -30, 4, 16, 0, 34);
      g.bezierCurveTo(-4, 44, -12, 50, -22, 50);
      g.closePath();
    }
    function sombraEm(Mc, traceClip, M, trace, dx, dy, a) {
      g.save(); g.setTransform(Mc[0], Mc[1], Mc[2], Mc[3], Mc[4], Mc[5]); traceClip(g); g.clip();
      g.setTransform(M[0], M[1], M[2], M[3], M[4] + dx * S, M[5] + dy * S); trace(g);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "rgba(26,12,70," + a + ")"; g.fill(); g.restore();
    }
    var unhaA = { sombra: pa.luz, base: pa.unha, luz: pa.brilho, contorno: pa.contorno }, unhaB = { sombra: pb.luz, base: pb.unha, luz: pb.brilho, contorno: pb.contorno };
    // 1) mão B (atrás) e 2) mão A
    cel(g, MB, corpo, pb, 10 * S, lw, false, 0.5);
    brilhoM(g, MB, -50, -6, 4, 14, 0.1, "#fff", 0.5);
    sombraEm(MB, corpo, MA, corpo, 4, 3, 0.32);
    cel(g, MA, corpo, pa, 10 * S, lw, false, 0.5);
    linhaM(g, MA, function(g) { g.beginPath(); g.moveTo(-48, 34); g.quadraticCurveTo(-53, 10, -47, -12); }, pa.contorno, 1.5 * S, 0.3);
    brilhoM(g, MA, -50, -6, 4.5, 15, 0.1, "#fff", 0.6);
    // 3) pontas dos dedos de B dando a volta no dorso de A (4, em arco)
    var tb = [[-47, -23, 7.2, 0.3], [-54, -8, 8.2, 0.1], [-56, 8, 8, -0.05], [-52, 23, 7, -0.22]];
    for (var i = 0; i < 4; i++) {
      (function(t) {
        var f = function(g) {
          g.save(); g.translate(t[0], t[1]); g.rotate(t[3]);
          g.beginPath(); g.moveTo(16, -t[2]); g.lineTo(0, -t[2]);
          g.bezierCurveTo(-t[2] * 1.5, -t[2], -t[2] * 1.6, t[2], 0, t[2]); g.lineTo(16, t[2]);
          g.restore();
        };
        sombraEm(MA, corpo, MA, f, 2, 3, 0.3);
        cel(g, MA, function(g) { f(g); g.closePath(); }, pb, 4 * S, lw, true, 0.6);
        g.setTransform(MA[0], MA[1], MA[2], MA[3], MA[4], MA[5]); f(g); g.setTransform(1, 0, 0, 1, 0, 0);
        g.strokeStyle = pb.contorno; g.lineWidth = lw; g.lineJoin = "round"; g.lineCap = "round"; g.stroke();
        cel(g, MA, function(g) { g.save(); g.translate(t[0], t[1]); g.rotate(t[3]); ell(g, -t[2] * 0.72, -t[2] * 0.08, t[2] * 0.36, t[2] * 0.56, 0.05); g.restore(); }, unhaB, 1.5 * S, 1.1 * S, false, 0.5);
        g.setTransform(MA[0], MA[1], MA[2], MA[3], MA[4], MA[5]); g.translate(t[0], t[1]); g.rotate(t[3]);
        g.beginPath(); g.moveTo(t[2] * 0.55, -t[2] + 2); g.quadraticCurveTo(t[2] * 0.8, 0, t[2] * 0.55, t[2] - 2);
        g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = pb.contorno; g.globalAlpha = 0.6; g.lineWidth = 1.3 * S; g.lineCap = "round"; g.stroke(); g.globalAlpha = 1;
      })(tb[i]);
    }
    // 4) dedos de A envolvendo o dorso de B (nó na base, dobras, ponta que dá a volta)
    var da = [[-9, -25, 50, 9.5, -0.05], [-7, -8, 54, 10, 0.0], [-6, 9, 51, 9.5, 0.05], [-4, 25, 43, 8.5, 0.12]];
    for (i = 3; i >= 0; i--) {
      (function(d) {
        var f = dedoForma(d[0], d[1], d[2], d[3], d[4]), L = d[2], hh = d[3];
        sombraEm(MB, corpo, MA, f, 3, 4, 0.34);
        cel(g, MA, f, pa, 5 * S, lw, false, 0.6);
        function loc() { g.setTransform(MA[0], MA[1], MA[2], MA[3], MA[4], MA[5]); g.translate(d[0], d[1]); g.rotate(d[4]); }
        loc(); g.beginPath(); g.moveTo(L * 0.5, -hh + 2.5); g.quadraticCurveTo(L * 0.5 + 3, 0, L * 0.5, hh - 2);
        g.moveTo(L * 0.8, -hh + 3.5); g.quadraticCurveTo(L * 0.8 + 2, 0, L * 0.8, hh - 3);
        g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = pa.contorno; g.globalAlpha = 0.55; g.lineWidth = 1.4 * S; g.lineCap = "round"; g.stroke(); g.globalAlpha = 1;
        loc(); ell(g, -1, -hh * 0.42, hh * 0.6, hh * 0.32, 0); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#fff"; g.globalAlpha = 0.6; g.fill();
        loc(); ell(g, L * 0.28, -hh * 0.55, L * 0.14, 2, 0); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1;
      })(da[i]);
    }
    // 5) polegares cruzados por cima: o de B (mais baixo, ponta saindo à esquerda) e o de A por cima
    function polegarB(g) {
      g.beginPath();
      g.moveTo(-30, -26);
      g.bezierCurveTo(-24, -52, 16, -60, 40, -50);
      g.bezierCurveTo(54, -44, 52, -30, 40, -31);
      g.bezierCurveTo(16, -35, -6, -30, -12, -22);
      g.closePath();
    }
    function unhaPB(g) { ell(g, 42, -42, 7, 5.6, 0.5); }
    function polegar(g) {
      g.beginPath();
      g.moveTo(-34, -30);
      g.bezierCurveTo(-30, -58, 2, -70, 24, -58);
      g.bezierCurveTo(36, -52, 34, -38, 22, -38);
      g.bezierCurveTo(6, -42, -8, -36, -14, -26);
      g.closePath();
    }
    function unha(g) { ell(g, 23, -50, 8, 6.5, 0.55); }
    cel(g, MB, polegarB, pb, 6 * S, lw, false, 0.6);
    cel(g, MB, unhaPB, unhaB, 2 * S, 1.3 * S, false, 0.5);
    sombraEm(MB, polegarB, MA, polegar, 3, 4, 0.34);
    cel(g, MA, polegar, pa, 6 * S, lw, false, 0.6);
    cel(g, MA, unha, unhaA, 2 * S, 1.3 * S, false, 0.5);
    linhaM(g, MA, function(g) { g.beginPath(); g.moveTo(-8, -60); g.quadraticCurveTo(-3, -52, -5, -42); }, pa.contorno, 1.5 * S, 0.55);
    brilhoM(g, MA, -14, -54, 10, 3.2, -0.5, "#fff", 0.7);
    var c1x = reduz(c, MW, MH);                                           // molde 1x (só para a sombra)
    return (molde[k] = { c: c, sh: silhueta(c1x), rot: [] });
  }
  // ---------- braços vetoriais (usados no pré-render dos sprites) ----------
  // Referencial local de um osso: u ao longo (de A para B), w perpendicular (w > 0 = "lado de dentro" de b1;
  // em b2 o referencial é espelhado). O cel-shading sem clip: sombra = forma toda; luz = forma estreitada (escala
  // em w) e deslocada para o lado da luz; base = a mesma, deslocada de volta um pouco (sobra a faixa de luz).
  var BM = [1, 0, 0, 1, 0, 0], FR = [1, 0, 0, 1, 0, 0], SOMBRA_PROJ = "rgba(26,12,70,0.26)";
  function quadro(ax, ay, bx, by, lado) {
    var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L;
    FR[0] = ux; FR[1] = uy; FR[2] = lado > 0 ? uy : -uy; FR[3] = lado > 0 ? -ux : ux; FR[4] = ax; FR[5] = ay;
    return L;
  }
  // aplica BM * FR * [u, dw + sw*w]
  function poe(ctx, dw, sw, ex, ey) {
    var a = FR[0], b = FR[1], c = FR[2] * sw, d = FR[3] * sw, e = FR[4] + FR[2] * dw + (ex || 0), f = FR[5] + FR[3] * dw + (ey || 0);
    ctx.setTransform(BM[0] * a + BM[2] * b, BM[1] * a + BM[3] * b, BM[0] * c + BM[2] * d, BM[1] * c + BM[3] * d,
      BM[0] * e + BM[2] * f + BM[4], BM[1] * e + BM[3] * f + BM[5]);
  }
  function poeBase(ctx) { ctx.setTransform(BM[0], BM[1], BM[2], BM[3], BM[4], BM[5]); }
  // sinal do lado iluminado em w (+1: o lado w > 0 está virado para a luz)
  function ladoLuz() { return FR[2] * LX + FR[3] * LY >= 0 ? 1 : -1; }
  function cel3(ctx, forma, L, p, s, d, dl, inch) {
    var sl = ladoLuz();
    poe(ctx, 0, inch, 0, 0); forma(ctx, L); ctx.fillStyle = p.sombra; ctx.fill();
    poe(ctx, sl * d, s * inch, 0, 0); forma(ctx, L); ctx.fillStyle = p.luzS; ctx.fill();
    poe(ctx, sl * (d - dl), s * inch, 0, 0); forma(ctx, L); ctx.fillStyle = p.base; ctx.fill();
  }
  function contorno(ctx, forma, L, p, inch) {
    poe(ctx, 0, inch, 0, 0); forma(ctx, L); poeBase(ctx);
    ctx.strokeStyle = p.contorno; ctx.lineWidth = 3.4; ctx.lineJoin = "round"; ctx.stroke();
  }
  function sombraProj(ctx, forma, L, inch, dx, dy) {
    poe(ctx, 0, inch, dx, dy); forma(ctx, L); ctx.fill();
  }

  // braço (ombro -> cotovelo): tríceps por fora (w < 0), bíceps enorme e redondo do lado de dentro (w > 0, virado
  // para o antebraço), ponta do cotovelo. Usado só no pré-render (bracoRot), então pode ter mais camadas.
  function formaBraco(g, L) {
    g.beginPath();
    g.moveTo(-4, -46);
    g.bezierCurveTo(L * 0.22, -62, L * 0.5, -60, L * 0.74, -42);              // tríceps
    g.bezierCurveTo(L * 0.86, -32, L + 2, -26, L + 8, -8);                     // ponta do cotovelo
    g.bezierCurveTo(L + 12, 8, L + 2, 22, L * 0.88, 26);
    g.bezierCurveTo(L * 0.78, 58, L * 0.62, 80, L * 0.46, 76);                // pico do bíceps
    g.bezierCurveTo(L * 0.32, 72, L * 0.22, 52, L * 0.1, 46);
    g.bezierCurveTo(-8, 46, -30, 30, -30, 0);
    g.bezierCurveTo(-30, -30, -18, -46, -4, -46);
    g.closePath();
  }
  function formaBiceps(g, L) {
    g.beginPath();
    g.moveTo(L * 0.16, 32);
    g.bezierCurveTo(L * 0.3, 4, L * 0.68, 2, L * 0.84, 26);
    g.bezierCurveTo(L * 0.76, 56, L * 0.62, 74, L * 0.46, 72);
    g.bezierCurveTo(L * 0.32, 68, L * 0.22, 50, L * 0.16, 32);
    g.closePath();
  }
  function desenhaBraco(ctx, ax, ay, bx, by, lado, p, inch) {
    var L = quadro(ax, ay, bx, by, lado), sl = ladoLuz();
    cel3(ctx, formaBraco, L, p, 0.86, 8, 6, inch);
    // tríceps: leve volume
    poe(ctx, sl * 2, inch, 0, 0); ell(ctx, L * 0.42, -34, L * 0.26, 16, 0.02); ctx.fillStyle = p.musc; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
    // bíceps: massa própria com 3 tons e contorno (separação nítida do tríceps)
    poe(ctx, 0, inch, 0, 0); formaBiceps(ctx, L); ctx.fillStyle = p.sombra; ctx.fill();
    poe(ctx, sl * 4, 0.84 * inch, 0, 0); ctx.translate(0, 36); ctx.scale(1, 1); ctx.translate(0, -36); formaBiceps(ctx, L); ctx.fillStyle = p.luzS; ctx.fill();
    poe(ctx, sl * 1, 0.84 * inch, 0, 0); formaBiceps(ctx, L); ctx.fillStyle = p.musc; ctx.fill();
    poe(ctx, 0, inch, 0, 0); ctx.beginPath(); ctx.moveTo(L * 0.16, 32); ctx.bezierCurveTo(L * 0.3, 4, L * 0.68, 2, L * 0.84, 26);
    poeBase(ctx); ctx.strokeStyle = p.contorno; ctx.lineWidth = 3.4; ctx.lineCap = "round"; ctx.stroke();
    poe(ctx, 0, inch, 0, 0); ctx.beginPath(); ctx.moveTo(L * 0.14, -24); ctx.bezierCurveTo(L * 0.3, -18, L * 0.48, -18, L * 0.62, -26);
    poeBase(ctx); ctx.globalAlpha = 0.45; ctx.lineWidth = 1.8; ctx.stroke(); ctx.globalAlpha = 1;
    // brilho no pico do bíceps e luz de borda do lado da sombra
    poe(ctx, 0, inch, 0, 0); ell(ctx, L * 0.46, sl > 0 ? 60 : 42, 22, 6.5, -0.04); ctx.fillStyle = "#ffffff"; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
    poe(ctx, 0, inch, 0, 0); ctx.beginPath();
    if (sl > 0) { ctx.moveTo(L * 0.2, -54); ctx.bezierCurveTo(L * 0.42, -58, L * 0.6, -52, L * 0.74, -38); }
    else { ctx.moveTo(L * 0.34, 66); ctx.bezierCurveTo(L * 0.52, 72, L * 0.7, 60, L * 0.8, 44); }
    poeBase(ctx); ctx.strokeStyle = p.rim; ctx.lineWidth = 2.6; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
    contorno(ctx, formaBraco, L, p, inch);
    return L;
  }

  // braço pré-renderizado em ângulos (passo DPHI), ancorado no cotovelo, com a sombra projetada embutida.
  // O comprimento é fixo (LB): a ponta do ombro fica escondida sob o deltoide, então a diferença não aparece.
  var DPHI = 0.07, LB = 238, bracoS = {};
  function bracoRot(cor, lado, k) {
    var key = cor + "|" + lado, arr = bracoS[key] || (bracoS[key] = {});
    if (arr[k]) return arr[k];
    var phi = k * DPHI, ca = Math.cos(phi), sa = Math.sin(phi);          // direção cotovelo -> ombro (referencial de b1)
    var ox = ca * LB * lado, oy = sa * LB;                                 // ombro relativo ao cotovelo
    // caixa: extremos da forma (u em [-32, LB+12], w em [-62, 66]) no mundo + sombra
    var ux = -ox / LB, uy = -oy / LB, nx = lado > 0 ? uy : -uy, ny = lado > 0 ? -ux : ux;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, us = [-34, LB + 14], ws = [-64, 80];
    for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) {
      var px = ox + ux * us[a] + nx * ws[b], py = oy + uy * us[a] + ny * ws[b];
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    x0 = Math.floor(x0) - 3; y0 = Math.floor(y0) - 3; x1 = Math.ceil(x1) + 12; y1 = Math.ceil(y1) + 12;
    var c = cv(x1 - x0, y1 - y0), g = c.getContext("2d"), p = pele(cor);
    var bm = BM.slice(); BM[0] = 1; BM[1] = 0; BM[2] = 0; BM[3] = 1; BM[4] = -x0; BM[5] = -y0;
    g.fillStyle = SOMBRA_PROJ; quadro(ox, oy, 0, 0, lado); sombraProj(g, formaBraco, LB, 1, 8, 7);
    desenhaBraco(g, ox, oy, 0, 0, lado, p, 1);
    for (var i = 0; i < 6; i++) BM[i] = bm[i];
    return (arr[k] = { c: c, ox: -x0, oy: -y0 });
  }
  function poeBraco(ctx, cor, lado, ox, oy, ex, ey) {
    var phi = Math.atan2(oy - ey, (ox - ex) * lado), k = Math.round(phi / DPHI), s = bracoRot(cor, lado, k);
    ctx.drawImage(s.c, Math.round(ex - s.ox), Math.round(ey - s.oy));
  }

  // antebraço (cotovelo -> punho): ventre largo perto do cotovelo (w > 0 = fora), afina até o punho; munhequeira
  function formaAnte(g, L) {
    g.beginPath();
    g.moveTo(-4, 16);
    g.bezierCurveTo(L * 0.05, 36, L * 0.18, 52, L * 0.36, 50);                 // ventre externo (braquiorradial)
    g.bezierCurveTo(L * 0.56, 48, L * 0.72, 24, L * 0.86, 17);
    g.lineTo(L + 6, 16);
    g.lineTo(L + 6, -16);
    g.bezierCurveTo(L * 0.82, -17, L * 0.62, -28, L * 0.42, -37);              // flexores
    g.bezierCurveTo(L * 0.24, -45, L * 0.06, -34, -2, -20);
    g.bezierCurveTo(-14, -12, -18, 8, -4, 16);                                  // cotovelo
    g.closePath();
  }
  function formaBraqui(g, L) { ell(g, L * 0.36, 26, L * 0.27, 19, -0.1); }
  function formaBanda(g, L, junto) {          // junto: acrescenta ao caminho atual (sem beginPath)
    var x = L - 24, y = -24, w = 32, h = 48, r = 8;
    if (!junto) g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function desenhaAnte(ctx, ax, ay, bx, by, lado, p, pf, listra, inch) {
    var L = quadro(ax, ay, bx, by, lado), sl = ladoLuz();
    cel3(ctx, formaAnte, L, p, 0.84, 7, 6, inch);
    poe(ctx, sl * 3, inch, 0, 0); formaBraqui(ctx, L); ctx.fillStyle = p.musc; ctx.fill();
    poe(ctx, 0, inch, 0, 0); ctx.beginPath(); ctx.moveTo(L * 0.06, 6); ctx.bezierCurveTo(L * 0.24, 0, L * 0.5, 4, L * 0.72, 15);
    poeBase(ctx); ctx.strokeStyle = p.contorno; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
    poe(ctx, 0, inch, 0, 0); ctx.beginPath();
    if (sl > 0) { ctx.moveTo(L * 0.16, -37); ctx.bezierCurveTo(L * 0.32, -42, L * 0.5, -32, L * 0.68, -23); }
    else { ctx.moveTo(L * 0.16, 42); ctx.bezierCurveTo(L * 0.34, 48, L * 0.52, 40, L * 0.68, 24); }
    poeBase(ctx); ctx.strokeStyle = p.rim; ctx.lineWidth = 2.4; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
    // munhequeira (2 tons + listra); depois o contorno do antebraço e da munhequeira num traço só
    poe(ctx, 0, 1, 0, 0); formaBanda(ctx, L); ctx.fillStyle = pf.sombra; ctx.fill();
    poe(ctx, sl * 4, 0.8, 0, 0); formaBanda(ctx, L); ctx.rect(L - 10, -23, 6, 46); ctx.fillStyle = pf.base; ctx.fill("evenodd");
    poe(ctx, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(L - 10, -23, 6, 46); ctx.fillStyle = listra; ctx.fill();
    poe(ctx, 0, inch, 0, 0); formaAnte(ctx, L); poe(ctx, 0, 1, 0, 0); formaBanda(ctx, L, true); poeBase(ctx);
    ctx.strokeStyle = p.contorno; ctx.lineWidth = 3.4; ctx.lineJoin = "round"; ctx.stroke();
    return L;
  }

  // ---------- geometria do braço de luta para um ângulo th das mãos ----------
  function geo(th, o) {
    var c = Math.cos(th), s = Math.sin(th), ef = 0.5 + 0.5 * c;
    o.cx = PVX + CR * s; o.cy = PVY - CR * c;
    o.w1x = o.cx - WX * c - WY * s; o.w1y = o.cy - WX * s + WY * c;
    o.w2x = o.cx + WX * c - WY * s; o.w2y = o.cy + WX * s + WY * c;
    o.e1x = PVX - ED * ef + (s > 0 ? 44 : -26) * s; o.e2x = PVX + ED * ef + (s < 0 ? 44 : -26) * s; o.ey = PVY;
    return o;
  }
  // "conjunto" pré-renderizado por passo de ângulo: sombra dos antebraços + mãos entrelaçadas (com sombra) +
  // os dois antebraços com munhequeira (quem está perdendo fica por baixo). 1 drawImage 1:1 por quadro.
  var GQ = {};
  function conjunto(c1, c2, i) {
    var m = maos(c1, c2), s = m.rot[i];
    if (s) return s;
    var th = ANG[i], ca = Math.cos(th), sa = Math.sin(th), G = geo(th, GQ), cx = G.cx, cy = G.cy;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    function inc(x, y, r) { if (x - r < x0) x0 = x - r; if (x + r > x1) x1 = x + r; if (y - r < y0) y0 = y - r; if (y + r > y1) y1 = y + r; }
    var hx = [-100, 100], hy = [-106, 82];
    for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) inc(cx + hx[a] * ca - hy[b] * sa, cy + hx[a] * sa + hy[b] * ca, 0);
    inc(G.e1x, G.ey, 54); inc(G.w1x, G.w1y, 30); inc(G.e2x, G.ey, 54); inc(G.w2x, G.w2y, 30);
    var mx1 = (G.e1x + G.w1x) / 2, my1 = (G.ey + G.w1y) / 2, mx2 = (G.e2x + G.w2x) / 2, my2 = (G.ey + G.w2y) / 2;
    inc(mx1, my1, 56); inc(mx2, my2, 56);                    // ventre do antebraço
    x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2; x1 = Math.ceil(x1) + 12; y1 = Math.ceil(y1) + 12;
    var c = cv(x1 - x0, y1 - y0), g = c.getContext("2d");
    var bm = BM.slice(); BM[0] = 1; BM[1] = 0; BM[2] = 0; BM[3] = 1; BM[4] = -x0; BM[5] = -y0;
    var f1 = escolherFaixa(c1), f2 = escolherFaixa(c2), p1 = pele(c1), p2 = pele(c2);
    // sombra projetada dos antebraços (cai no bíceps e nas bolinhas, que são desenhados antes)
    g.fillStyle = SOMBRA_PROJ;
    quadro(G.e1x, G.ey, G.w1x, G.w1y, 1); sombraProj(g, formaAnte, Math.hypot(G.w1x - G.e1x, G.w1y - G.ey), 1, 9, 5);
    quadro(G.e2x, G.ey, G.w2x, G.w2y, -1); sombraProj(g, formaAnte, Math.hypot(G.w2x - G.e2x, G.w2y - G.ey), 1, 9, 5);
    // mãos (sombra deslocada no mundo + molde 2x girado)
    g.setTransform(ca, sa, -sa, ca, cx - x0 + 7, cy - y0 + 8);
    g.globalAlpha = 0.3; g.drawImage(m.sh, -MOX, -MOY); g.globalAlpha = 1;
    g.imageSmoothingQuality = "low";
    g.setTransform(ca / MS, sa / MS, -sa / MS, ca / MS, cx - x0, cy - y0);
    g.drawImage(m.c, -MOX * MS, -MOY * MS);
    // antebraços
    var A1 = function() { desenhaAnte(g, G.e1x, G.ey, G.w1x, G.w1y, 1, p1, pele(f1), listraDe(f1, c1), 1); };
    var A2 = function() { desenhaAnte(g, G.e2x, G.ey, G.w2x, G.w2y, -1, p2, pele(f2), listraDe(f2, c2), 1); };
    if (th > 0) { A2(); A1(); } else { A1(); A2(); }
    for (var k = 0; k < 6; k++) BM[k] = bm[k];
    g.setTransform(1, 0, 0, 1, 0, 0);
    return (m.rot[i] = { c: c, ox: cx - x0, oy: cy - y0, e1x: G.e1x - cx, e2x: G.e2x - cx, ey: G.ey - cy });
  }

  // ---------- coroa do vencedor ----------
  // coroa dourada do vencedor (pré-inclinada para cada lado: 1 drawImage 1:1)
  var coroaS = {};
  function coroa(lado) {
    if (coroaS[lado]) return coroaS[lado];
    var S = 2, w = 124, c = cv(w * S, w * S), g = c.getContext("2d");
    var a = 0.13 * lado, ca = Math.cos(a) * S, sa = Math.sin(a) * S, M = [ca, sa, -sa, ca, w / 2 * S, w / 2 * S];
    var p = { sombra: "#d9861a", base: "#ffcf3a", luz: "#fff3b0", contorno: "#7a4a0c" };
    function f(g) {
      g.beginPath(); g.moveTo(-38, 22); g.lineTo(-44, -18); g.quadraticCurveTo(-30, -2, -20, -4); g.lineTo(0, -34);
      g.lineTo(20, -4); g.quadraticCurveTo(30, -2, 44, -18); g.lineTo(38, 22); g.closePath();
    }
    function aro(g) { rr(g, -40, 12, 80, 16, 6); }
    cel(g, M, f, p, 6 * S, 2.4 * S, false, 0.6);
    cel(g, M, aro, p, 4 * S, 2.4 * S, false, 0.6);
    var gem = [[-44, -18, "#ff5d73"], [0, -34, "#4dabf7"], [44, -18, "#ff5d73"]];
    for (var i = 0; i < 3; i++) (function(q) {
      cel(g, M, function(g) { ell(g, q[0], q[1], 6.5, 6.5, 0); }, { sombra: mix(hexRgb(q[2]), AZ, 0.4), base: q[2], luz: "#ffffff", contorno: "#7a4a0c" }, 2.5 * S, 2 * S, false, 0.6);
    })(gem[i]);
    cel(g, M, function(g) { ell(g, 0, 20, 7, 5.5, 0); }, { sombra: "#2f7fc0", base: "#4dabf7", luz: "#e7f5ff", contorno: "#7a4a0c" }, 2 * S, 2 * S, false, 0.6);
    brilhoM(g, M, -22, 6, 8, 2.4, -0.5, "#fff", 0.75);
    return (coroaS[lado] = { c: reduz(c, w, w), m: w / 2 });
  }

  // ---------- arena + mesa (pré-renderizada por tamanho + cores) ----------
  var fundoC = {};
  function criarFundo(W, H, c1, c2) {
    var dx = Math.round((W - 1280) / 2), dy = Math.max(0, Math.round((H - 720) / 2));
    var C = document.createElement("canvas"); C.width = W; C.height = H;
    var g = C.getContext("2d", { alpha: false });
    var k1 = hexRgb(c1), k2 = hexRgb(c2), P1 = pele(c1), P2 = pele(c2), i, r;
    var NOITE = [16, 13, 40], PAREDE = [40, 34, 92];
    // parede com degradê
    var gr = g.createLinearGradient(0, 0, 0, dy + 470);
    gr.addColorStop(0, css(NOITE)); gr.addColorStop(1, css(PAREDE));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.translate(dx, dy);
    var TOP = -dy, BOT = H - dy;
    // painel de LED atrás da plateia (cores dos times, dessaturadas e escuras: perspectiva atmosférica)
    var yA = Math.max(TOP, -260);
    var pl = mixA(mixA(k1, [60, 56, 120], 0.55), NOITE, 0.38), pr = mixA(mixA(k2, [60, 56, 120], 0.55), NOITE, 0.38);
    g.save();
    g.beginPath(); g.rect(-dx, yA, W, 360 - yA); g.clip();
    g.beginPath(); g.moveTo(-dx - 10, yA); g.lineTo(700 + (yA - TOP) * 0, yA); g.lineTo(580, 360); g.lineTo(-dx - 10, 360); g.closePath();
    g.fillStyle = css(pl); g.fill();
    g.beginPath(); g.moveTo(700, yA); g.lineTo(W - dx + 10, yA); g.lineTo(W - dx + 10, 360); g.lineTo(580, 360); g.closePath();
    g.fillStyle = css(pr); g.fill();
    g.fillStyle = "rgba(255,255,255,0.03)";
    for (i = -30; i < 40; i++) { var xx = i * 64; g.beginPath(); g.moveTo(xx, yA); g.lineTo(xx + 26, yA); g.lineTo(xx + 26 - (360 - yA) * 0.33, 360); g.lineTo(xx - (360 - yA) * 0.33, 360); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(696, yA); g.lineTo(704, yA); g.lineTo(584, 360); g.lineTo(576, 360); g.closePath(); g.fillStyle = "rgba(255,255,255,0.2)"; g.fill();
    g.restore();
    var gv = g.createLinearGradient(0, yA, 0, 360);
    gv.addColorStop(0, "rgba(10,8,28,0.8)"); gv.addColorStop(0.55, "rgba(10,8,28,0.3)"); gv.addColorStop(1, "rgba(10,8,28,0)");
    g.fillStyle = gv; g.fillRect(-dx, yA, W, 360 - yA);
    g.fillStyle = "rgba(255,255,255,0.05)";                 // v19: retícula de HQ no painel
    for (var ry = yA + 8, rk = 0; ry < 360; ry += 14, rk++) { g.beginPath(); for (var rx2 = -dx + (rk % 2) * 7; rx2 < W - dx; rx2 += 14) { g.moveTo(rx2 + 2.2, ry); g.arc(rx2, ry, 2.2, 0, PI2); } g.fill(); }
    if (yA > TOP) {                                    // tela alta: teto escuro com treliça e brilho difuso
      var gt0 = g.createLinearGradient(0, TOP, 0, yA);
      gt0.addColorStop(0, "#0a0920"); gt0.addColorStop(1, "#141233");
      g.fillStyle = gt0; g.fillRect(-dx, TOP, W, yA - TOP);
      g.fillStyle = "#07061a"; g.fillRect(-dx, yA - 12, W, 12);
      g.strokeStyle = "#07061a"; g.lineWidth = 3; g.beginPath();
      for (i = -dx; i < W - dx; i += 30) { g.moveTo(i, yA - 12); g.lineTo(i + 15, yA - 34); g.lineTo(i + 30, yA - 12); }
      g.moveTo(-dx, yA - 34); g.lineTo(W - dx, yA - 34); g.stroke();
    }
    // bandeirões dos times pendurados nas laterais
    function bandeira(x, P, k) {
      var y0 = Math.max(yA, -40), y1 = 250, w = 84;
      if (y0 > yA) {                                   // tela alta: bandeirão num varão preso por cabos na treliça
        g.strokeStyle = "#0b0920"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w / 2 + 6, y0); g.lineTo(x - 10, yA - 12); g.moveTo(x + w / 2 - 6, y0); g.lineTo(x + 10, yA - 12); g.stroke();
        rr(g, x - w / 2 - 8, y0 - 6, w + 16, 8, 4); g.fillStyle = "#2a2758"; g.fill(); g.strokeStyle = "#0b0920"; g.stroke();
      }
      g.beginPath(); g.moveTo(x - w / 2, y0); g.lineTo(x + w / 2, y0); g.lineTo(x + w / 2, y1); g.lineTo(x, y1 - 26); g.lineTo(x - w / 2, y1); g.closePath();
      g.fillStyle = css(mixA(k, NOITE, 0.5)); g.fill();
      g.save(); g.clip();
      g.fillStyle = css(mixA(k, NOITE, 0.68)); g.fillRect(x + w * 0.16, y0, w, y1 - y0);
      g.fillStyle = css(mixA(k, BR, 0.1), 0.8); g.fillRect(x - w / 2, 70, w, 9); g.fillRect(x - w / 2, 86, w, 4);
      g.restore();
      g.strokeStyle = "#0b0920"; g.lineWidth = 2.5; g.lineJoin = "round"; g.stroke();
      g.beginPath(); for (var j = 0; j < 10; j++) { var an = -PI / 2 + j * PI / 5, rs = j % 2 ? 8 : 19; g.lineTo(x + Math.cos(an) * rs, 160 + Math.sin(an) * rs); } g.closePath();
      g.fillStyle = css(mixA(k, BR, 0.35)); g.fill(); g.strokeStyle = "#0b0920"; g.lineWidth = 2; g.stroke();
    }
    bandeira(74, P1, k1); bandeira(1206, P2, k2);
    // treliça de luz e refletores
    var ty = Math.max(TOP + 6, 78);
    g.fillStyle = "#0b0920"; g.fillRect(-dx, ty, W, 10);
    g.strokeStyle = "#0b0920"; g.lineWidth = 3;
    g.beginPath(); for (i = -dx; i < W - dx; i += 26) { g.moveTo(i, ty); g.lineTo(i + 13, ty + 10); g.lineTo(i + 26, ty); } g.stroke();
    var lamps = [300, 470, 640, 810, 980];
    for (i = 0; i < lamps.length; i++) {
      var lx = lamps[i], alvo = 640 + (lx - 640) * 0.35;
      var gc = g.createLinearGradient(0, ty, 0, 600);
      gc.addColorStop(0, "rgba(255,244,214,0.15)"); gc.addColorStop(1, "rgba(255,244,214,0)");
      g.fillStyle = gc;
      g.beginPath(); g.moveTo(lx - 10, ty + 18); g.lineTo(lx + 10, ty + 18); g.lineTo(alvo + 120, 600); g.lineTo(alvo - 120, 600); g.closePath(); g.fill();
    }
    for (i = 0; i < lamps.length; i++) {
      rr(g, lamps[i] - 15, ty + 4, 30, 18, 6); g.fillStyle = "#1c1846"; g.fill(); g.strokeStyle = "#07061a"; g.lineWidth = 2; g.stroke();
      ell(g, lamps[i], ty + 22, 11, 4); g.fillStyle = "#fff4cf"; g.fill();
    }
    // plateia em silhueta: 3 fileiras com perspectiva atmosférica (a de trás mais clara e azulada, a da frente
    // mais escura e com luz de borda do palco)
    function fileira(y, rad, passo, cor, seed, bracos, borda) {
      var rn = semente(seed), x = -dx - 20 + rn() * 10;
      while (x < W - dx + 20) {
        var hy = y + (rn() - 0.5) * 7, hr = rad * (0.88 + rn() * 0.24), time = x < 640 ? k1 : k2;
        g.fillStyle = cor;
        ell(g, x, hy + hr * 2.2, hr * 1.55, hr * 1.4); g.fill();
        g.beginPath(); g.arc(x, hy, hr, 0, PI2); g.fill();
        if (bracos && rn() < 0.1) {
          var ld = rn() < 0.5 ? -1 : 1, ax = x + ld * hr * 1.1, ay = hy + hr * 1.6, bx = ax + ld * hr * 0.45, by = hy - hr * 1.9;
          g.strokeStyle = cor; g.lineWidth = hr * 0.75; g.lineCap = "round"; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
          g.beginPath(); g.moveTo(bx, by - hr * 0.2); g.lineTo(bx + ld * hr * 2.4, by + hr * 0.35); g.lineTo(bx, by + hr * 1.1); g.closePath();
          g.fillStyle = css(mixA(time, NOITE, 0.45)); g.fill();
        }
        if (borda) { g.strokeStyle = borda; g.lineWidth = 2; g.beginPath(); g.arc(x, hy, hr - 1, PI * 1.08, PI * 1.62); g.stroke(); }
        if (rn() < 0.06) { g.fillStyle = "rgba(255,250,220,0.8)"; g.fillRect(x + hr * 0.3, hy + hr * 0.8, 2.5, 3.5); }
        x += passo * (0.82 + rn() * 0.36);
      }
    }
    fileira(316, 10, 23, "#3e3b80", 3, true, null);
    fileira(346, 13, 30, "#2c2868", 7, true, "rgba(120,114,200,0.35)");
    fileira(384, 17, 38, "#1c1949", 13, true, "rgba(255,236,200,0.28)");
    // mureta com fita de LED dos dois times
    g.fillStyle = "#17143c"; g.fillRect(-dx, 410, W, 64);
    g.fillStyle = "#0e0c28"; g.fillRect(-dx, 470, W, 6);
    g.fillStyle = P1.base; g.fillRect(-dx, 418, 640 + dx, 6); g.fillStyle = P2.base; g.fillRect(640, 418, W - dx - 640, 6);
    g.fillStyle = "rgba(255,255,255,0.45)"; g.fillRect(-dx, 418, W, 2);
    // chão
    var gf = g.createLinearGradient(0, 476, 0, Math.max(720, BOT));
    gf.addColorStop(0, "#2f2a6c"); gf.addColorStop(1, "#16133a");
    g.fillStyle = gf; g.fillRect(-dx, 476, W, BOT - 476);
    // palco redondo sob a mesa (borda com LED dos times) e poça de luz do holofote
    var PCY = 712, PRX = 610, PRY = 112, PH = 26;
    g.beginPath(); g.ellipse(640, PCY + PH, PRX, PRY, 0, 0, PI); g.lineTo(640 - PRX, PCY); g.ellipse(640, PCY, PRX, PRY, 0, PI, 0, true); g.closePath();
    g.fillStyle = "#15123a"; g.fill();
    g.save(); g.beginPath(); g.ellipse(640, PCY + PH * 0.45, PRX + 1, PRY + 1, 0, 0, PI); g.lineWidth = 5;
    g.restore();
    g.lineWidth = 5; g.lineCap = "butt";
    g.beginPath(); g.ellipse(640, PCY + 8, PRX - 1, PRY - 1, 0, PI * 0.5, PI); g.strokeStyle = P1.base; g.stroke();
    g.beginPath(); g.ellipse(640, PCY + 8, PRX - 1, PRY - 1, 0, 0, PI * 0.5); g.strokeStyle = P2.base; g.stroke();
    ell(g, 640, PCY, PRX, PRY); g.fillStyle = "#332e74"; g.fill();
    ell(g, 640, PCY - 4, PRX - 40, PRY - 14); g.strokeStyle = "rgba(255,255,255,0.07)"; g.lineWidth = 3; g.stroke();
    ell(g, 640, PCY, PRX, PRY); g.strokeStyle = TINTA; g.lineWidth = 3.6; g.stroke();
    g.fillStyle = "rgba(255,240,210,0.07)"; ell(g, 640, 700, 520, 76); g.fill();
    g.fillStyle = "rgba(255,240,210,0.06)"; ell(g, 640, 700, 340, 48); g.fill();
    // ---- mesa ----
    var TAMPO = [56, 52, 120], LADO = [34, 31, 82];
    // pé central + base
    g.fillStyle = "rgba(8,5,26,0.5)"; ell(g, 640, 716, 300, 22); g.fill();
    rr(g, 560, MESA_Y2 - 6, 160, 48, 8); g.fillStyle = "#1d1a4a"; g.fill(); g.strokeStyle = TINTA; g.lineWidth = 3.6; g.stroke();
    g.fillStyle = "#2a2664"; g.fillRect(566, MESA_Y2 - 2, 26, 38);
    rr(g, 480, 706, 320, 18, 9); g.fillStyle = "#1d1a4a"; g.fill(); g.stroke();
    // frente
    g.beginPath(); g.moveTo(150, MESA_Y1); g.lineTo(1130, MESA_Y1); g.lineTo(1116, MESA_Y2); g.lineTo(164, MESA_Y2); g.closePath();
    g.fillStyle = css(LADO); g.fill(); g.strokeStyle = TINTA; g.lineWidth = 3.6; g.lineJoin = "round"; g.stroke();
    g.fillStyle = "rgba(10,6,30,0.35)"; g.fillRect(166, MESA_Y2 - 12, 948, 10);
    // tampo
    function tampo() { g.beginPath(); g.moveTo(262, MESA_Y0); g.lineTo(1018, MESA_Y0); g.lineTo(1130, MESA_Y1); g.lineTo(150, MESA_Y1); g.closePath(); }
    tampo(); g.fillStyle = css(TAMPO); g.fill();
    g.save(); tampo(); g.clip();
    var gt = g.createLinearGradient(0, MESA_Y0, 0, MESA_Y1);
    gt.addColorStop(0, "rgba(14,10,40,0.45)"); gt.addColorStop(0.35, "rgba(14,10,40,0)"); gt.addColorStop(1, "rgba(255,255,255,0.05)");
    g.fillStyle = gt; g.fillRect(100, MESA_Y0, 1100, MESA_Y1 - MESA_Y0);
    // feltro interno + linha central
    g.beginPath(); g.moveTo(292, MESA_Y0 + 10); g.lineTo(988, MESA_Y0 + 10); g.lineTo(1088, MESA_Y1 - 12); g.lineTo(192, MESA_Y1 - 12); g.closePath();
    g.strokeStyle = "rgba(255,255,255,0.10)"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "rgba(255,255,255,0.13)"; g.beginPath(); g.moveTo(638, MESA_Y0 + 10); g.lineTo(642, MESA_Y0 + 10); g.lineTo(643, MESA_Y1 - 12); g.lineTo(637, MESA_Y1 - 12); g.closePath(); g.fill();
    // sombra das bolinhas apoiadas no fundo da mesa
    g.fillStyle = "rgba(12,8,36,0.38)"; ell(g, BX + 8, MESA_Y0 + 20, RB * 0.95, 16); g.fill(); ell(g, 1280 - BX - 8, MESA_Y0 + 20, RB * 0.95, 16); g.fill();
    g.restore();
    // borda frontal do tampo (bisel claro)
    g.strokeStyle = TINTA; g.lineWidth = 3.6; tampo(); g.stroke();
    g.fillStyle = "rgba(190,186,255,0.5)"; g.fillRect(152, MESA_Y1 - 3, 976, 3);
    // almofadas dos cotovelos (cor de cada time)
    function almofada(x, P) {
      g.fillStyle = "rgba(10,6,30,0.4)"; ell(g, x + 3, PVY + 14, 62, 18); g.fill();
      ell(g, x, PVY + 8, 60, 18); g.fillStyle = "#1c1a45"; g.fill();
      g.save(); g.clip(); ell(g, x - 3, PVY + 3, 58, 15); g.fillStyle = "#2f2c6c"; g.fill(); g.restore();
      ell(g, x, PVY + 8, 60, 18); g.strokeStyle = TINTA; g.lineWidth = 3.6; g.stroke();
      ell(g, x - 2, PVY + 4, 46, 11); g.strokeStyle = P.base; g.globalAlpha = 0.85; g.lineWidth = 3; g.stroke(); g.globalAlpha = 1;
    }
    almofada(PVX - ED, P1); almofada(PVX + ED, P2);
    // almofadas de batida (onde a mão do perdedor cai)
    function batida(x) {
      g.fillStyle = "rgba(10,6,30,0.4)"; ell(g, x + 3, 596, 50, 16); g.fill();
      ell(g, x, 590, 48, 15); g.fillStyle = "#24214f"; g.fill();
      g.save(); g.clip(); ell(g, x - 3, 586, 46, 12); g.fillStyle = "#3b3880"; g.fill(); g.restore();
      ell(g, x, 590, 48, 15); g.strokeStyle = TINTA; g.lineWidth = 3.6; g.stroke();
      ell(g, x, 587, 30, 7); g.strokeStyle = "rgba(255,255,255,0.14)"; g.lineWidth = 2; g.stroke();
    }
    batida(PVX - BATIDA); batida(PVX + BATIDA);
    // pinos de pegada
    function pino(x) {
      g.fillStyle = "rgba(10,6,30,0.4)"; ell(g, x + 4, PINO_Y + 4, 22, 7); g.fill();
      ell(g, x, PINO_Y, 18, 6); g.fillStyle = "#1a1840"; g.fill();
      rr(g, x - 9, PINO_Y - 92, 18, 92, 8); g.fillStyle = "#9aa0c8"; g.fill();
      g.fillStyle = "#6c71a3"; g.fillRect(x + 2, PINO_Y - 88, 7, 86);
      g.fillStyle = "#e3e6ff"; g.fillRect(x - 6, PINO_Y - 86, 3, 82);
      rr(g, x - 9, PINO_Y - 92, 18, 92, 8); g.strokeStyle = TINTA; g.lineWidth = 3; g.stroke();
      ell(g, x, PINO_Y - 92, 11, 5); g.fillStyle = "#c9cdf2"; g.fill(); g.stroke();
    }
    pino(PINO_X); pino(1280 - PINO_X);
    // tela alta: plateia da frente em silhueta escura emoldurando a parte de baixo
    if (BOT > 800) {
      var rn2 = semente(21), yb = BOT - 24;
      for (var xq = -dx - 30; xq < W - dx + 40; xq += 70 + rn2() * 30) {
        var hr2 = 34 + rn2() * 14, hy2 = yb - rn2() * 26;
        g.fillStyle = "#0b0a22";
        ell(g, xq, hy2 + hr2 * 2.1, hr2 * 1.6, hr2 * 1.4); g.fill();
        g.beginPath(); g.arc(xq, hy2, hr2, 0, PI2); g.fill();
        g.strokeStyle = "rgba(120,112,210,0.35)"; g.lineWidth = 3; g.beginPath(); g.arc(xq, hy2, hr2 - 1.5, PI * 1.1, PI * 1.6); g.stroke();
      }
    }
    // vinheta nas bordas (foco no centro)
    g.setTransform(1, 0, 0, 1, 0, 0);
    var gvn = g.createRadialGradient(W / 2, dy + 420, 260, W / 2, dy + 420, Math.max(W, H) * 0.75);
    gvn.addColorStop(0, "rgba(8,6,24,0)"); gvn.addColorStop(1, "rgba(8,6,24,0.55)");
    g.fillStyle = gvn; g.fillRect(0, 0, W, H);
    return C;
  }
  function fundo(W, H, c1, c2) {
    var k = W + "|" + H + "|" + c1 + "|" + c2;
    if (fundoC.k !== k) { fundoC.k = k; fundoC.c = criarFundo(W, H, c1, c2); }
    return fundoC.c;
  }

  // ---------- textos em cache ----------
  var textosC = {}, nTextos = 0;
  function texto(txt, fill, borda, px) {
    var k = txt + "|" + fill + "|" + borda + "|" + px, s = textosC[k];
    if (s) return s;
    if (nTextos > 160) { textosC = {}; nTextos = 0; }
    var pad = 6, fonte = "800 " + px + "px Nunito, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
    var m = cv(4, 4).getContext("2d"); m.font = fonte;
    var w = Math.ceil(m.measureText(txt).width) + pad * 2, h = px + pad * 2 + 4;
    var c = cv(w, h), g = c.getContext("2d");
    g.font = fonte; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = Math.max(4, px * 0.16); g.strokeStyle = borda; g.strokeText(txt, w / 2, h / 2 + 1);
    g.fillStyle = fill; g.fillText(txt, w / 2, h / 2 + 1);
    nTextos++;
    return (textosC[k] = { c: c, w: w, h: h });
  }
  function poeTexto(ctx, s, x, y, esc) {
    if (!esc || esc === 1) ctx.drawImage(s.c, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
    else ctx.drawImage(s.c, x - s.w * esc / 2, y - s.h * esc / 2, s.w * esc, s.h * esc);
  }
  // contadores: dígitos pré-renderizados (o número muda a cada toque; criar canvas por toque engasga)
  var digS = {};
  function numero(ctx, n, x, y, borda, grande) {
    var k = borda + (grande ? "|g" : ""), d = digS[k], px = grande ? 52 : 40;
    if (!d) { d = digS[k] = []; for (var i = 0; i < 10; i++) d.push(texto(String(i), grande ? "#fff7d6" : "#ffffff", borda, px)); }
    var str = String(n), wt = 0, j, o = grande ? 15 : 12;
    for (j = 0; j < str.length; j++) wt += d[str.charCodeAt(j) - 48].w - o;
    wt += o;
    var xx = Math.round(x - wt / 2);
    for (j = 0; j < str.length; j++) {
      var s = d[str.charCodeAt(j) - 48];
      ctx.drawImage(s.c, xx, Math.round(y - s.h / 2));
      xx += s.w - o;
    }
  }
  var pilulas = {};
  function dica(ctx, txt, x, y, cor, pul) {
    if (!txt) return;
    var k = txt + "|" + cor, sp = pilulas[k];
    if (!sp) {
      var P = pele(cor), s = texto(txt, "#ffffff", "#120e34", 20), w = Math.ceil(s.w + 26), h = 40;
      var c = cv(w, h), g = c.getContext("2d");
      rr(g, 2, 2, w - 4, h - 4, 18); g.fillStyle = "rgba(14,10,44,0.9)"; g.fill(); g.strokeStyle = P.base; g.lineWidth = 2.5; g.stroke();
      g.drawImage(s.c, (w - s.w) / 2, (h - s.h) / 2 - 0.5);
      sp = pilulas[k] = { c: c, w: w, h: h };
    }
    poeTexto(ctx, sp, x, y - Math.round(3 * pul));
  }

  // ---------- barra de força ----------
  var BW = 600, BH = 30, BX0 = 340, barras = {}, divS = null;
  function barraSpr(cor) {
    if (barras[cor]) return barras[cor];
    var P = pele(cor), c = cv(BW + 10, BH + 10), g = c.getContext("2d");
    g.translate(5, 5);
    rr(g, -5, -5, BW + 10, BH + 10, (BH + 10) / 2); g.fillStyle = TINTA; g.fill();
    g.save(); rr(g, 0, 0, BW, BH, BH / 2); g.clip();
    g.fillStyle = P.base; g.fillRect(0, 0, BW, BH);
    g.fillStyle = P.sombra; g.fillRect(0, BH * 0.64, BW, BH);
    g.fillStyle = P.luz; g.globalAlpha = 0.75; g.fillRect(0, 4, BW, 4); g.globalAlpha = 1;
    g.restore();
    return (barras[cor] = c);
  }
  function divisor() {
    if (divS) return divS;
    var c = cv(22, 52), g = c.getContext("2d");
    rr(g, 5, 3, 12, 46, 6); g.fillStyle = "#ffffff"; g.fill(); g.strokeStyle = TINTA; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = "#d9d6f5"; g.fillRect(12, 6, 3, 40);
    return (divS = c);
  }
  var MINI1 = {}, MINI2 = {};
  function barra(ctx, q, c1, c2, f1, pul1, pul2, y0, t, ex1, ex2) {
    var L = barraSpr(c1), R = barraSpr(c2), xr = cl(Math.round(BW * f1) + 5, 5, BW + 5), yy = Math.round(y0) - 5;
    ctx.drawImage(L, 0, 0, xr, BH + 10, BX0 - 5, yy, xr, BH + 10);
    ctx.drawImage(R, xr, 0, BW + 10 - xr, BH + 10, BX0 - 5 + xr, yy, BW + 10 - xr, BH + 10);
    ctx.drawImage(divisor(), BX0 - 5 + xr - 11, yy - 6);
    var t1 = texto(q.nome1 || "", "#fff", "#120e34", 18), t2 = texto(q.nome2 || "", "#fff", "#120e34", 18);
    poeTexto(ctx, t1, BX0 + 14 + t1.w / 2, y0 + BH / 2 + 1);
    poeTexto(ctx, t2, BX0 + BW - 14 - t2.w / 2, y0 + BH / 2 + 1);
    var s1 = MINI1, s2 = MINI2;
    s1.cor = c1; s2.cor = c2; s1.r = s2.r = 24; s1.cache = s2.cache = true;
    s1.skin = q.b1.skin; s1.acessorio = "nenhum"; s2.skin = q.b2.skin; s2.acessorio = "nenhum";
    s1.x = BX0 - 36; s2.x = BX0 + BW + 36; s1.y = Math.round(y0 + BH / 2 - 5 * pul1); s2.y = Math.round(y0 + BH / 2 - 5 * pul2);
    s1.olharX = 0.7; s2.olharX = -0.7; s1.olharY = s2.olharY = 0; s1.vira = 0.4; s2.vira = -0.4;
    s1.escalaX = s1.escalaY = 1; s2.escalaX = s2.escalaY = 1;
    s1.t = s2.t = t; s1.piscar = s2.piscar = 0; s1.expressao = ex1; s2.expressao = ex2;
    ArteBolinha.desenhar(ctx, s1); ArteBolinha.desenhar(ctx, s2);
  }

  // ---------- faixa da cabeça: cor com contraste ----------
  var FAIXAS = ["#f03e3e", "#ffffff", "#2b2a6e"];
  function escolherFaixa(cor) {
    var c = hexRgb(cor), melhor = FAIXAS[0], mv = -1;
    for (var i = 0; i < FAIXAS.length; i++) {
      var f = hexRgb(FAIXAS[i]), d = Math.abs(f[0] - c[0]) * 0.8 + Math.abs(f[1] - c[1]) * 1.2 + Math.abs(f[2] - c[2]) * 0.7 + (i === 0 ? 90 : 0);
      if (d > mv) { mv = d; melhor = FAIXAS[i]; }
    }
    return melhor;
  }
  function listraDe(f, cor) { return f === "#ffffff" ? "#f03e3e" : "#ffffff"; }

  // ---------- estado de animação ----------
  var ult1 = -1, ult2 = -1, tp1 = -9, tp2 = -9, thVis = null, vencAnt = 0, thVenc = 0;
  function agora() { return (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000; }
  var D1 = {}, D2 = {};
  var CONF = []; (function() { var r = semente(99); for (var i = 0; i < 44; i++) CONF.push([r(), r(), r(), r()]); })();

  // ---------- desenhar ----------
  function desenhar(ctx, q, largura, altura) {
    var W = largura || 1280, H = altura || 720;
    var dx = Math.round((W - 1280) / 2), dy = Math.max(0, Math.round((H - 720) / 2));
    var b1 = q.b1 || {}, b2 = q.b2 || {};
    var c1 = b1.cor || "#ff5d73", c2 = b2.cor || "#4dabf7";
    var t = q.t || 0, venc = q.vencedor | 0, pos = cl(q.pos || 0, -1, 1);
    var tr = agora();
    // pulsos de toque (relógio próprio: o t do motor reinicia na vitória)
    if (q.toques1 < ult1 || q.toques2 < ult2) { ult1 = -1; ult2 = -1; }
    if (q.toques1 !== ult1) { if (ult1 >= 0) tp1 = tr; ult1 = q.toques1; }
    if (q.toques2 !== ult2) { if (ult2 >= 0) tp2 = tr; ult2 = q.toques2; }
    var pul1 = cl(1 - (tr - tp1) / 0.24, 0, 1), pul2 = cl(1 - (tr - tp2) / 0.24, 0, 1);
    pul1 *= pul1; pul2 *= pul2;
    if (venc) pul1 = pul2 = 0;

    // ----- giro das mãos (positivo = mãos para o lado de b2 = b1 ganhando) -----
    var alvo = -pos * TH_JOGO, th, impacto = -1, fx = 0, fy = 0;
    if (thVis === null || Math.abs(alvo - thVis) > 0.6) thVis = alvo;
    thVis += (alvo - thVis) * 0.3;
    if (venc && !vencAnt) thVenc = thVis;
    vencAnt = venc;
    if (venc) {
      var thF = venc === 1 ? TH_FIM : -TH_FIM, s = cl(t / 0.16, 0, 1);
      th = thVenc + (thF - thVenc) * s * s;                       // acelera até bater
      if (t > 0.16) {
        impacto = t - 0.16;
        th = thF - (venc === 1 ? 1 : -1) * 0.05 * Math.sin(impacto * 26) * Math.exp(-impacto * 9);
        var sh = 9 * Math.exp(-impacto * 11);
        fx = Math.round(Math.sin(impacto * 71) * sh); fy = Math.round(Math.cos(impacto * 57) * sh * 0.8);
      }
      thVis = th;
    } else {
      th = thVis + (pul1 - pul2) * 0.05;
    }
    var ten = venc ? 0 : 1 - Math.abs(pos);                         // tensão: treme mais quando está equilibrado
    var tw = venc ? 0 : t;
    var mjx = Math.sin(tw * 61) * (0.6 + 1.6 * ten), mjy = Math.cos(tw * 53) * (0.4 + 1.0 * ten);   // tremor das mãos
    var cth = Math.cos(th), sth = Math.sin(th);

    ctx.save();
    ctx.drawImage(fundo(W, H, c1, c2), 0, 0);
    ctx.translate(dx + fx, dy + fy);
    var m0 = ctx.getTransform(); BM[0] = m0.a; BM[1] = m0.b; BM[2] = m0.c; BM[3] = m0.d; BM[4] = m0.e; BM[5] = m0.f;

    // ----- poses das bolinhas -----
    var adv1 = venc ? (venc === 1 ? 1 : -1) : -pos, adv2 = -adv1;
    var lose1 = adv1 < 0 ? -adv1 : 0, lose2 = adv2 < 0 ? -adv2 : 0, win1 = adv1 > 0 ? adv1 : 0, win2 = adv2 > 0 ? adv2 : 0;
    var tr1 = venc ? 0 : 0.8 + 1.3 * ten + 2.2 * lose1, tr2 = venc ? 0 : 0.8 + 1.3 * ten + 2.2 * lose2;
    var x1 = BX - 72 * lose1 + 14 * win1 + Math.sin(tw * 53) * tr1 + 5 * pul1;
    var y1 = BY + 4 * lose1 - 6 * win1 + Math.cos(tw * 47) * tr1 * 0.5 - 3 * pul1;
    var x2 = 1280 - BX + 72 * lose2 - 14 * win2 + Math.sin(tw * 59 + 1.3) * tr2 - 5 * pul2;
    var y2 = BY + 4 * lose2 - 6 * win2 + Math.cos(tw * 51 + 0.7) * tr2 * 0.5 - 3 * pul2;
    var sq1 = 0, sq2 = 0, kr = 0;
    if (venc) {                                   // vencedor se debruça sobre a mesa para cravar a mão do outro
      var kv = cl(t / 0.18, 0, 1); kv = kv * kv * (3 - 2 * kv);
      if (venc === 1) { x1 = BX + 14 + 48 * kv; y1 = BY - 6 + 14 * kv; x2 = 1280 - BX + 72 + 4 * kv; y2 = BY + 4 + 8 * kv; }
      else { x2 = 1280 - BX - 14 - 48 * kv; y2 = BY - 6 + 14 * kv; x1 = BX - 72 - 4 * kv; y1 = BY + 4 + 8 * kv; }
      if (impacto >= 0) {
        var sq = Math.exp(-impacto * 10) * Math.cos(impacto * 30);
        if (venc === 1) sq2 = sq; else sq1 = sq;
        kr = cl((impacto - 0.1) / 0.16, 0, 1); kr = 1 - (1 - kr) * (1 - kr);          // braço livre do vencedor sobe
        var hop = impacto > 0.26 ? Math.abs(Math.sin((impacto - 0.26) * 8)) * 7 * Math.exp(-(impacto - 0.26) * 1.5) : 0;
        if (venc === 1) y1 -= hop; else y2 -= hop;
      }
    }

    // ----- pontos do braço de luta -----
    // mãos na posição contínua; antebraços+mãos vêm do sprite do passo de ângulo mais próximo (cotovelos deslizam
    // poucos pixels na almofada entre um passo e outro)
    var cx = PVX + CR * sth + mjx, cy = PVY - CR * cth + mjy;
    var cj = conjunto(c1, c2, indiceAng(th));
    var e1x = cx + cj.e1x, e2x = cx + cj.e2x, ey = cy + cj.ey;
    var o1x = x1 + OMB_DX, o1y = y1 + OMB_DY, o2x = x2 - OMB_DX, o2y = y2 + OMB_DY;

    // ----- braços livres (atrás das bolinhas): segurando o pino, ou erguido pelo vencedor -----
    function bracoLivre(cor, lado, bx, by, tremor, vence) {
      if (vence && kr > 0) {
        var e = erguido(cor, lado), pop = (1 - kr) * 50;
        ctx.drawImage(e.c, Math.round(bx - e.ox), Math.round(by - e.oy + pop + Math.sin(t * 9) * 2.5 * kr));
      } else {
        var l = livre(cor, lado), px = lado > 0 ? PUNHO_X : 1280 - PUNHO_X;
        ctx.drawImage(l.c, Math.round(px - l.ox + tremor), Math.round(PUNHO_Y - l.oy));
      }
    }
    bracoLivre(c1, 1, x1, y1, Math.sin(tw * 53) * tr1 * 0.3, venc === 1);
    bracoLivre(c2, -1, x2, y2, Math.sin(tw * 59 + 1.3) * tr2 * 0.3, venc === 2);

    // ----- bolinhas (faixa na cabeça, cara a cara) -----
    var f1 = escolherFaixa(c1), f2 = escolherFaixa(c2);
    var ex1, ex2;
    if (venc) {
      ex1 = venc === 1 ? (impacto >= 0.08 ? "feliz" : "smirk") : "dor";
      ex2 = venc === 2 ? (impacto >= 0.08 ? "feliz" : "smirk") : "dor";
    } else {
      ex1 = adv1 > 0.3 ? "smirk" : adv1 < -0.5 ? "dor" : adv1 < -0.14 ? "esforco" : "bravo";
      ex2 = adv2 > 0.3 ? "smirk" : adv2 < -0.5 ? "dor" : adv2 < -0.14 ? "esforco" : "bravo";
    }
    function bola(d, src, x, y, cor, f, lado, ex, sq, fase) {
      d.cache = true; d.x = x; d.y = y; d.r = RB; d.cor = cor; d.expressao = ex;
      d.skin = src.skin; d.acessorio = src.acessorio;
      d.olharX = lado; d.olharY = ex === "dor" ? 0.2 : 0.08; d.vira = lado * (ex === "dor" ? 0.5 : 0.75);
      d.faixa = f; d.faixaLado = -lado; d.faixaListra = listraDe(f, cor); d.faixaFase = fase; d.faixaInc = 0.06 * lado;
      d.escalaX = 1 - 0.08 * sq; d.escalaY = 1 + 0.1 * sq;
      d.t = t * (ex === "dor" ? 2 : 1.4); d.flash = 0; d.fantasma = 0;
      d.piscar = (!venc && ((t * 0.31 + fase * 0.37) % 1) > 0.985) ? 1 : 0;
      ArteBolinha.desenhar(ctx, d);
    }
    bola(D1, b1, x1, y1, c1, f1, 1, ex1, sq1, 0);
    bola(D2, b2, x2, y2, c2, f2, -1, ex2, sq2, 1.7);

    // ----- braços (bíceps na frente das bolinhas), com sombra projetada no corpo; deltoide por cima -----
    var p1 = pele(c1), p2 = pele(c2);
    poeBraco(ctx, c1, 1, o1x, o1y, e1x, ey);
    poeBraco(ctx, c2, -1, o2x, o2y, e2x, ey);
    var dl1 = deltoide(c1, 1), dl2 = deltoide(c2, -1);
    ctx.drawImage(dl1.c, Math.round(o1x - dl1.m), Math.round(o1y - dl1.m));
    ctx.drawImage(dl2.c, Math.round(o2x - dl2.m), Math.round(o2y - dl2.m));

    // ----- impacto da vitória: anel no tampo, faíscas e clarão (por baixo das mãos) -----
    if (impacto >= 0 && impacto < 0.6) {
      var bs = venc === 1 ? 84 : -84, ix = cx + bs * cth, iy = Math.min(PVY + 6, cy + bs * sth + 4), k = impacto / 0.6, ke = 1 - (1 - k) * (1 - k) * (1 - k);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 9 * (1 - k) + 1;
      ell(ctx, ix, iy, 30 + 150 * ke, 9 + 40 * ke); ctx.stroke();
      ctx.fillStyle = "#fff6c8";
      ctx.beginPath();
      for (var j = 0; j < 9; j++) {
        var an = PI + (j / 8) * PI, rr0 = 40 + 110 * ke, rr1 = rr0 + 34 * (1 - k), wv = 5 * (1 - k);
        var ca = Math.cos(an), sa = Math.sin(an) * 0.75;
        ctx.moveTo(ix + ca * rr0 - sa * wv, iy + sa * rr0 + ca * wv); ctx.lineTo(ix + ca * rr1, iy + sa * rr1); ctx.lineTo(ix + ca * rr0 + sa * wv, iy + sa * rr0 - ca * wv);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      if (impacto < 0.1) { ctx.globalAlpha = 1 - impacto / 0.1; ctx.fillStyle = "#ffffff"; ell(ctx, ix, iy - 4, 46 + 300 * impacto, 14 + 90 * impacto); ctx.fill(); ctx.globalAlpha = 1; }
    }

    // ----- antebraços + mãos entrelaçadas (sprite do passo de ângulo, com as sombras embutidas) -----
    ctx.drawImage(cj.c, Math.round(cx - cj.ox), Math.round(cy - cj.oy));

    // ----- toque: traços de força saindo das mãos, do lado de quem empurrou -----
    var pm = Math.max(pul1, pul2);
    if (pm > 0.12) {
      var lp = pul1 >= pul2 ? 1 : 2, dir = lp === 1 ? -1 : 1, kk = 1 - pm, ke2 = 1 - kk * kk;
      ctx.globalAlpha = pm; ctx.fillStyle = "#ffffff";
      ctx.beginPath();                                   // traços afiados que afinam, do lado de quem empurrou
      var ox3 = cx + dir * 6, oy3 = cy - 20;               // raios saindo por cima das mãos, no vão entre as cabeças
      for (var i = 0; i < 3; i++) {
        var aa = -PI / 2 + dir * (0.05 + i * 0.3), r0 = 96 + 16 * ke2, r1 = r0 + 26 * pm + 8, wd = 4.5 * pm;
        var ca3 = Math.cos(aa), sa3 = Math.sin(aa), bx3 = ox3 + ca3 * r0, by3 = oy3 + sa3 * r0;
        ctx.moveTo(bx3 - sa3 * wd, by3 + ca3 * wd); ctx.lineTo(ox3 + ca3 * r1, oy3 + sa3 * r1); ctx.lineTo(bx3 + sa3 * wd, by3 - ca3 * wd); ctx.closePath();
      }
      ctx.fill();
      var bri = brilhoT(lp === 1 ? c1 : c2), es = 0.5 + 0.55 * ke2;
      ctx.drawImage(bri.c, cx + dir * 34 - bri.m * es, cy - 92 - bri.m * es, bri.c.width * es, bri.c.height * es);
      ctx.globalAlpha = 1;
    }

    // ----- vencedor: coroa e confete -----
    if (venc && impacto >= 0.2) {
      var k2 = cl((impacto - 0.2) / 0.25, 0, 1), cs = k2 < 1 ? 1.25 * Math.sin(k2 * PI * 0.62) / Math.sin(PI * 0.62) : 1;
      var vx = venc === 1 ? x1 : x2, vy = (venc === 1 ? y1 : y2) - RB - 30 + Math.sin(t * 5) * 3;
      var cr = coroa(venc === 1 ? -1 : 1);
      if (k2 < 1) ctx.drawImage(cr.c, vx - cr.m * cs, vy - cr.m * cs, cr.c.width * cs, cr.c.height * cs);
      else ctx.drawImage(cr.c, Math.round(vx - cr.m), Math.round(vy - cr.m));
      var Pv = pele(venc === 1 ? c1 : c2), cores = [Pv.base, "#ffd43b", "#ffffff", Pv.luz], tc = impacto - 0.2;
      for (var ci = 0; ci < 4; ci++) {
        ctx.fillStyle = cores[ci]; ctx.beginPath();
        for (var n = ci; n < CONF.length; n += 4) {
          var cf = CONF[n], vel = 160 + cf[1] * 220;
          var px = -dx + cf[0] * W + Math.sin(tc * 2.2 + n) * 26, py = -dy - 30 + ((tc * vel + cf[2] * 260) % (H + 60));
          var rt = tc * (4 + cf[3] * 4) + n, ca2 = Math.cos(rt) * 7, sa2 = Math.sin(rt) * 7, fl = Math.abs(Math.cos(tc * 6 + n)) * 0.8 + 0.2;
          ctx.moveTo(px - ca2, py - sa2 * fl); ctx.lineTo(px + ca2, py + sa2 * fl); ctx.lineTo(px + ca2 + 2.5, py + sa2 * fl + 5); ctx.lineTo(px - ca2 + 2.5, py - sa2 * fl + 5); ctx.closePath();
        }
        ctx.fill();
      }
    }

    // ----- contadores na frente da mesa e dicas -----
    numero(ctx, Math.max(0, q.toques1 | 0), 330, 650 - Math.round(4 * pul1), p1.contorno, pul1 > 0.3);
    numero(ctx, Math.max(0, q.toques2 | 0), 950, 650 - Math.round(4 * pul2), p2.contorno, pul2 > 0.3);
    dica(ctx, q.dica1, 330, 700, c1, pul1);
    dica(ctx, q.dica2, 950, 700, c2, pul2);

    // ----- barra de força (no topo da TELA) -----
    var mex1 = venc ? (venc === 1 ? "feliz" : "dor") : (adv1 > 0.3 ? "smirk" : adv1 < -0.3 ? "medo" : "bravo");
    var mex2 = venc ? (venc === 2 ? "feliz" : "dor") : (adv2 > 0.3 ? "smirk" : adv2 < -0.3 ? "medo" : "bravo");
    barra(ctx, q, c1, c2, venc ? (venc === 1 ? 1 : 0) : (1 - pos) / 2, pul1, pul2, 24 - dy - fy, t, mex1, mex2);
    ctx.restore();
  }

  // pré-aquece os caches: chame com as cores antes da cena para não engasgar no 1º quadro
  function preparar(c1, c2, largura, altura) {
    gravando = true;
    fundo(largura || 1280, altura || 720, c1, c2);
    deltoide(c1, 1); deltoide(c2, -1); livre(c1, 1); livre(c2, -1); erguido(c1, 1); erguido(c2, -1);
    coroa(-1); coroa(1); divisor(); barraSpr(c1); barraSpr(c2); brilhoT(c1); brilhoT(c2);
    numero(null, "", 0, 0, pele(c1).contorno, false); numero(null, "", 0, 0, pele(c1).contorno, true);
    numero(null, "", 0, 0, pele(c2).contorno, false); numero(null, "", 0, 0, pele(c2).contorno, true);
    for (var i = 0; i < ANG.length; i++) conjunto(c1, c2, i);   // todos os ângulos de antebraços+mãos (o raster sai do quadro)
    for (i = -36; i <= -28; i++) { bracoRot(c1, 1, i); bracoRot(c2, -1, i); }   // ângulos possíveis do braço (cotovelo -> ombro)
    var cv0 = cv(4, 4).getContext("2d"), ex = ["bravo", "esforco", "dor", "smirk", "feliz"], dd = { cache: true, x: -999, y: -999, r: RB, olharY: 0.08, t: 0 };
    for (var e = 0; e < ex.length; e++) for (var ld = -1; ld <= 1; ld += 2) for (var pi = 0; pi < 2; pi++) {   // rostos (fora da tela) para não engasgar no 1º uso
      var cor = ld > 0 ? c1 : c2, f = escolherFaixa(cor);
      dd.cor = cor; dd.expressao = ex[e]; dd.olharX = ld; dd.olharY = ex[e] === "dor" ? 0.2 : 0.08; dd.vira = ld * (ex[e] === "dor" ? 0.5 : 0.75); dd.piscar = pi;
      dd.faixa = f; dd.faixaLado = -ld; dd.faixaListra = listraDe(f, cor); dd.faixaInc = 0.06 * ld;
      ArteBolinha.desenhar(cv0, dd);
    }
    gravando = false;
    descarrega();
  }

  return { desenhar: desenhar, preparar: preparar };
})();
