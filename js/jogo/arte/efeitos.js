"use strict";

// =========================
// EFEITOS (v2): partículas com pool fixo (sem alocar no quadro).
// Estilo "flat premium": formas sólidas nítidas em 2 tons, sem borrão.
// Desempenho (raster por software): o que custa é a CHAMADA, não o pixel. Por isso:
//  - explosão = 9 quadros pré-renderizados por tamanho (clarão, bola de fogo em 4 tons, anel), desenhados 1:1 (sem escala/rotação)
//  - fumaça, estrelas e chamas = sprites em níveis de tamanho fixos, desenhados 1:1 em pixel inteiro
//  - faíscas (triângulos), cacos, confete e bolinhas = LOTES: 1 path e 1 fill por cor
//  - textos = sprite em cache por (texto, cor), 1:1
// Nenhum gradiente, blur ou "lighter" por quadro.
// =========================

const Efeitos = (function() {
  var MAX = 800;
  var PI = Math.PI, PI2 = Math.PI * 2;

  // tipos de partícula
  var T_FUMACA = 0, T_FAISCA = 1, T_CACO = 2, T_CONFETE = 3, T_BIT = 4, T_ESTRELA = 5, T_FLASH = 6, T_CHAMA = 7, T_ANEL = 8, T_CRISTAL = 9;

  // ---------- pool em arrays (struct of arrays) ----------
  var X = new Float32Array(MAX), Y = new Float32Array(MAX), VX = new Float32Array(MAX), VY = new Float32Array(MAX);
  var VIDA = new Float32Array(MAX), VMAX = new Float32Array(MAX), TAM = new Float32Array(MAX), TAMF = new Float32Array(MAX);
  var PICO = new Float32Array(MAX), ROT = new Float32Array(MAX), VROT = new Float32Array(MAX);
  var GRAV = new Float32Array(MAX), ARR = new Float32Array(MAX), ALFA = new Float32Array(MAX);
  var TIPO = new Uint8Array(MAX), CID = new Uint16Array(MAX), ESTILO = new Uint8Array(MAX);
  var n = 0;
  var COPIAR = [X, Y, VX, VY, VIDA, VMAX, TAM, TAMF, PICO, ROT, VROT, GRAV, ARR, ALFA, TIPO, CID, ESTILO];

  // ---------- cores ----------
  var ESC = [26, 13, 51], BRA = [255, 255, 255], AZU = [48, 28, 120];
  function hexRgb(h) {
    if (h.charAt(0) === "#") h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var v = parseInt(h, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function mix(a, b, q) {
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * q) + "," + Math.round(a[1] + (b[1] - a[1]) * q) + "," + Math.round(a[2] + (b[2] - a[2]) * q) + ")";
  }
  function claro(cor) {   // versão clara (hex) de uma cor
    var r = hexRgb(cor), q = 0.45, h = "#";
    for (var i = 0; i < 3; i++) { var v = Math.round(r[i] + (255 - r[i]) * q); h += (v < 16 ? "0" : "") + v.toString(16); }
    return h;
  }
  // cada cor vira um id numérico com paleta (base, luz, sombra azulada, contorno escuro da própria cor)
  var idsCor = {}, nCores = 0, PB = [], PL = [], PS = [], PC = [];
  function cid(cor) {
    var i = idsCor[cor];
    if (i !== undefined) return i;
    var rgb = hexRgb(cor);
    i = nCores++; idsCor[cor] = i;
    PB.push("rgb(" + rgb.join(",") + ")"); PL.push(mix(rgb, BRA, 0.5)); PS.push(mix(rgb, AZU, 0.28)); PC.push(mix(rgb, ESC, 0.7));
    return i;
  }
  var C_BRANCO = cid("#ffffff"), C_AMARELO = cid("#ffd23f"), C_LARANJA = cid("#ff8a2b"), C_CREME = cid("#fff3b0");
  var C_MADEIRA = cid("#6d5a7c"), C_CINZA = cid("#4a3f63"), C_GELO = cid("#bfe9ff");

  function criarCanvas(w, h) { var c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  var rnd = Math.random;
  function entre(a, b) { return a + (b - a) * rnd(); }
  function suave(u) { return 1 - (1 - u) * (1 - u); }          // easing: rápido no começo, devagar no fim

  // índice do nível mais próximo (>= v) numa lista crescente
  function nivel(lista, v) {
    var i = 0, m = lista.length - 1;
    while (i < m && lista[i] < v) i++;
    return i;
  }

  // ---------- sprites em níveis de tamanho (desenhados 1:1) ----------
  // puff de fumaça: círculo 2 tons (base + sombra azulada), brilho e contorno fino
  var ESTILOS = [
    ["#cdc8e6", "#8f89bd", "#5f5a92"],   // 0 fumaça clara
    ["#7d77a3", "#524d7a", "#322d58"],   // 1 fumaça escura
    ["#ecdcc2", "#c3ab89", "#97805f"],   // 2 poeira
    ["#ffffff", "#d3d6f0", "#9ea3d0"],   // 3 branco
    ["#ff9a3d", "#e0472b", "#8a2121"]    // 4 fumaça de fogo
  ];
  var NIV_PUFF = [3, 4, 5, 6, 7, 9, 11, 13, 16, 19, 23, 28, 34, 41, 50, 60];
  var puffS = {};
  function puff(est, lv) {
    var k = est * 32 + lv, s = puffS[k];
    if (s) return s;
    var r = NIV_PUFF[lv], S = 2 * (r + 3), e = ESTILOS[est], c = criarCanvas(S, S), g = c.getContext("2d");
    var lw = r < 7 ? 1.2 : 2;
    g.translate(S / 2, S / 2);
    g.beginPath(); g.arc(0, 0, r - lw / 2, 0, PI2); g.fillStyle = e[1]; g.fill();
    g.save(); g.clip();
    g.beginPath(); g.arc(-r * 0.14, -r * 0.17, r * 0.86, 0, PI2); g.fillStyle = e[0]; g.fill();
    g.restore();
    if (r >= 7) { g.beginPath(); g.ellipse(-r * 0.38, -r * 0.48, r * 0.27, r * 0.15, -0.7, 0, PI2); g.fillStyle = "rgba(255,255,255,0.22)"; g.fill(); }
    g.beginPath(); g.arc(0, 0, r - lw / 2, 0, PI2); g.strokeStyle = e[2]; g.lineWidth = lw; g.stroke();
    return (puffS[k] = { c: c, m: S / 2 });
  }

  // estrela de 4 pontas côncava (2 tons), por cor e nível
  var NIV_EST = [5, 7, 9, 12, 16, 22, 30, 42, 58, 80];
  var estrelaS = {};
  function estrela(id, lv, v) {
    var k = (id * 16 + lv) * 2 + v, s = estrelaS[k];
    if (s) return s;
    var R = NIV_EST[lv], S = 2 * R + 6, c = criarCanvas(S, S), g = c.getContext("2d");
    g.translate(S / 2, S / 2); g.rotate(v ? 0.4 : 0);
    function forma(q) {
      g.beginPath();
      for (var i = 0; i < 8; i++) { var a = -PI / 2 + i * PI / 4, r = (i % 2 ? 0.26 : 1) * R * q; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath();
    }
    forma(1); g.fillStyle = PB[id]; g.fill();
    g.save(); forma(1); g.clip(); g.fillStyle = PS[id]; g.beginPath(); g.moveTo(-R * 2, R * 2); g.lineTo(R * 2, -R * 2); g.lineTo(R * 2, R * 2); g.closePath(); g.fill(); g.restore();
    forma(0.5); g.fillStyle = PL[id]; g.fill();
    forma(1); g.strokeStyle = PC[id]; g.lineWidth = R < 10 ? 1.2 : 2; g.lineJoin = "round"; g.stroke();
    return (estrelaS[k] = { c: c, m: S / 2 });
  }

  // chama (gota de fogo, 3 camadas) por altura
  var NIV_CHAMA = [7, 9, 12, 15, 19, 24];
  var chamaS = {};
  function chama(lv) {
    var s = chamaS[lv];
    if (s) return s;
    var H = NIV_CHAMA[lv], W = Math.ceil(H * 0.72), c = criarCanvas(W + 6, H + 6), g = c.getContext("2d");
    g.translate(3, 3);
    function gota(cx, base, w, h) {
      g.beginPath(); g.moveTo(cx - w, base);
      g.bezierCurveTo(cx - w * 1.1, base - h * 0.45, cx - w * 0.2, base - h * 0.55, cx + w * 0.05, base - h);
      g.bezierCurveTo(cx + w * 0.3, base - h * 0.55, cx + w * 1.1, base - h * 0.45, cx + w, base);
      g.arc(cx, base, w, 0, PI, false); g.closePath();
    }
    var cx = W / 2, w = W * 0.42, b = H - w * 0.3;
    gota(cx, b, w, b * 0.98); g.fillStyle = "#ff6a1f"; g.fill(); g.strokeStyle = "#8e2418"; g.lineWidth = H < 12 ? 1.2 : 2; g.lineJoin = "round"; g.stroke();
    gota(cx + 0.5, b - 1, w * 0.62, b * 0.64); g.fillStyle = "#ffc22e"; g.fill();
    if (H >= 12) { gota(cx + 0.5, b - 1.5, w * 0.3, b * 0.3); g.fillStyle = "#fff3a6"; g.fill(); }
    return (chamaS[lv] = { c: c, w: W + 6, h: H + 6, cx: 3 + cx, base: 3 + b });
  }

  // clarão da boca da arma: apontando para +x, origem em (18,40)
  var flashS = null;
  function flashSpr() {
    if (flashS) return flashS;
    var c = criarCanvas(128, 80), g = c.getContext("2d");
    g.translate(18, 40);
    function espinho(ang, L, w) {
      g.save(); g.rotate(ang);
      g.beginPath(); g.moveTo(0, -w); g.quadraticCurveTo(L * 0.5, -w * 0.7, L, 0); g.quadraticCurveTo(L * 0.5, w * 0.7, 0, w); g.closePath(); g.restore();
    }
    var lista = [[0, 108, 15], [-0.62, 62, 10], [0.62, 62, 10], [-1.25, 40, 7], [1.25, 40, 7]];
    g.lineJoin = "round";
    for (var i = lista.length - 1; i >= 0; i--) {
      espinho(lista[i][0], lista[i][1], lista[i][2]); g.fillStyle = "#ffb62e"; g.fill(); g.strokeStyle = "#c2481f"; g.lineWidth = 3; g.stroke();
    }
    for (i = 0; i < 3; i++) { espinho(lista[i][0], lista[i][1] * 0.72, lista[i][2] * 0.62); g.fillStyle = "#fff0a0"; g.fill(); }
    g.beginPath(); g.arc(2, 0, 13, 0, PI2); g.fillStyle = "#fff"; g.fill();
    return (flashS = c);
  }

  // ---------- quadros da explosão (pré-renderizados por tamanho, 1:1) ----------
  var NQ = 9, NIV_EXP = [26, 36, 48, 62, 80, 102, 130];
  var explS = {};
  function explosaoFrames(lv, variante) {
    var k = lv * 2 + variante, fr = explS[k];
    if (fr) return fr;
    var R = NIV_EXP[lv], S = 2 * Math.ceil(R * 1.25), sem = variante ? 91 : 7, q, i;
    function pr() { sem = (sem * 1103515245 + 12345) % 2147483648; return sem / 2147483648; }
    var lobos = [];
    for (i = 0; i < 9; i++) lobos.push({ a: i / 9 * PI2 + (pr() - 0.5) * 0.5, d: 0.40 + pr() * 0.22, r: 0.27 + pr() * 0.13 });
    fr = { s: S, m: S / 2, q: [] };
    var lw = Math.max(1.6, R * 0.025);
    for (q = 0; q < NQ; q++) {
      var u = q / (NQ - 1), c = criarCanvas(S, S), g = c.getContext("2d");
      g.translate(S / 2, S / 2);
      var cr = u < 0.4 ? suave(u / 0.4) : 1 - 0.3 * ((u - 0.4) / 0.6);         // cresce rápido, depois encolhe
      var frio = Math.max(0, Math.min(1, (u - 0.3) / 0.7)), calor = 1 - frio;
      var alfa = u > 0.78 ? 1 - (u - 0.78) / 0.22 * 0.9 : 1;
      // anel de choque (traço que afina)
      g.globalAlpha = Math.pow(1 - u, 0.7);
      g.beginPath(); g.arc(0, 0, R * (0.5 + 0.7 * suave(u)), 0, PI2); g.strokeStyle = "#fff6d6"; g.lineWidth = Math.max(1.2, R * 0.12 * (1 - u)); g.stroke();
      g.globalAlpha = alfa;
      // bola de fogo: 4 camadas chapadas
      var lobosEsc = function(kk, dx, dy) {
        g.beginPath();
        for (var j = 0; j < lobos.length; j++) {
          var L = lobos[j], a = L.a + u * 0.35, d = L.d * R * cr, rr = L.r * R * cr * kk;
          var cx = Math.cos(a) * d * (0.8 + 0.2 * kk) + dx * R, cy = Math.sin(a) * d * (0.8 + 0.2 * kk) + dy * R;
          g.moveTo(cx + rr, cy); g.arc(cx, cy, rr, 0, PI2);
        }
        g.moveTo(0.5 * R * cr * kk + dx * R, dy * R); g.arc(dx * R, dy * R, 0.5 * R * cr * kk, 0, PI2);
      };
      lobosEsc(1, 0, 0); g.fillStyle = mix([226, 58, 38], [79, 58, 99], frio * 0.8); g.fill();
      g.strokeStyle = mix([110, 26, 34], [48, 36, 70], frio); g.lineWidth = lw; g.lineJoin = "round"; g.stroke();
      lobosEsc(0.84, -0.04, -0.05); g.fillStyle = mix([255, 122, 31], [122, 74, 99], frio * 0.9); g.fill();
      if (calor > 0.15) { lobosEsc(0.78 * calor + 0.1, -0.07, -0.09); g.fillStyle = "#ffc233"; g.fill(); }
      if (calor > 0.4) { lobosEsc(0.5 * calor, -0.1, -0.12); g.fillStyle = "#fff4b0"; g.fill(); }
      // clarão inicial: estrela sólida
      if (q < 4) {
        var rf = R * [0.55, 0.95, 0.75, 0.42][q];
        g.globalAlpha = [1, 1, 0.85, 0.5][q];
        g.beginPath();
        for (i = 0; i < 16; i++) { var aa = i * PI / 8 + 0.2, rr2 = i % 2 ? rf * 0.5 : rf; g.lineTo(Math.cos(aa) * rr2, Math.sin(aa) * rr2); }
        g.closePath(); g.fillStyle = "#fffbe6"; g.fill(); g.strokeStyle = "#ffb62e"; g.lineWidth = lw; g.stroke();
      }
      fr.q.push(c);
    }
    return (explS[k] = fr);
  }

  // ---------- criação de partículas ----------
  function nova(tipo, x, y, vx, vy, vida, tam, tamf, c, grav, arr, alfa, rot, vrot, estilo, pico) {
    var i;
    var lim = (typeof CONFIG !== "undefined" && CONFIG.leve) ? 300 : MAX;   // modo leve: bem menos partículas
    if (n < lim) i = n++; else i = (rnd() * lim) | 0;        // pool cheio: sobrescreve uma qualquer
    X[i] = x; Y[i] = y; VX[i] = vx; VY[i] = vy; VIDA[i] = VMAX[i] = vida; TAM[i] = tam; TAMF[i] = tamf;
    PICO[i] = pico === undefined ? -1 : pico; ROT[i] = rot || 0; VROT[i] = vrot || 0; GRAV[i] = grav || 0; ARR[i] = arr || 0;
    ALFA[i] = alfa === undefined ? 1 : alfa; TIPO[i] = tipo; CID[i] = c || 0; ESTILO[i] = estilo || 0;
    return i;
  }
  function faisca(x, y, ang, vel, vida, tam, c, grav) { nova(T_FAISCA, x, y, Math.cos(ang) * vel, Math.sin(ang) * vel, vida, tam, 0, c, grav === undefined ? 380 : grav, 2.2); }
  function fumacaP(x, y, vx, vy, vida, t0, pico, tf, est, alfa, grav, arr) { nova(T_FUMACA, x, y, vx, vy, vida, t0, tf, 0, grav || 0, arr === undefined ? 1.6 : arr, alfa, 0, 0, est, pico); }
  function estrelaP(x, y, tam, c, vida, rot, vx, vy) { nova(T_ESTRELA, x, y, vx || 0, vy || 0, vida, tam, 0, c, 0, 3, 1, rot || 0, 0); }
  function anelP(x, y, r0, r1, larg, c, vida) { nova(T_ANEL, x, y, 0, 0, vida, r0, r1, c, 0, 0, larg); }
  function cacoP(x, y, ang, vel, vida, tam, c, grav) { nova(T_CACO, x, y, Math.cos(ang) * vel, Math.sin(ang) * vel, vida, tam, 0, c, grav, 1.2, 1, rnd() * PI2, entre(-9, 9)); }
  function bitP(x, y, ang, vel, vida, tam, c, grav) { nova(T_BIT, x, y, Math.cos(ang) * vel, Math.sin(ang) * vel, vida, tam, 0, c, grav, 1.6); }

  // ---------- explosões (pool próprio) ----------
  var NE = 14, EX = new Float32Array(NE), EY = new Float32Array(NE), EI = new Float32Array(NE), ED = new Float32Array(NE);
  var ENIV = new Uint8Array(NE), EVAR = new Uint8Array(NE), EVIVA = new Uint8Array(NE);
  var proxE = 0;

  // ---------- tremor de câmera ----------
  var tremorA = 0, desloc = { x: 0, y: 0 };
  function tremer(forca) { forca = Math.min(26, forca || 0); if (forca > tremorA) tremorA = forca; }
  function deslocamento() { return desloc; }

  // ---------- textos (sprite em cache por texto+cor, 1:1) ----------
  // v17.5: números de dano ("-12") têm letra mais grossa, "espessura" embaixo e degradê, e saltam num arco para o
  // lado (o tamanho cresce com o dano); no jogador (contra o bot) ficam vermelhos para ver na hora quem apanhou
  var NT = 24, textos = [], proxT = 0, cacheTxt = {}, nCacheTxt = 0, EH_NUM = /^[-+]\d+$/;
  for (var ti = 0; ti < NT; ti++) textos.push({ vivo: false, s: null, x: 0, y: 0, vida: 0, vy: 0, vx: 0, esc: 1, idade: 0, num: false });
  function spriteTexto(txt, cor, num) {
    var k = txt + "|" + cor + (num ? "|n" : ""), s = cacheTxt[k];
    if (s) return s;
    if (nCacheTxt > 160) { cacheTxt = {}; nCacheTxt = 0; }
    var F = num ? 30 : 24, pad = num ? 8 : 6, rgb = hexRgb(cor);
    var fonte = "900 " + F + "px Nunito, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
    var m = criarCanvas(4, 4).getContext("2d"); m.font = fonte;
    var w = Math.ceil(m.measureText(txt).width) + pad * 2, h = F + pad * 2 + (num ? 7 : 4);
    var c = criarCanvas(w, h), g = c.getContext("2d");
    g.font = fonte; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    if (num) {
      var yb = h / 2 - 1;
      g.lineWidth = 7; g.strokeStyle = mix(rgb, ESC, 0.86);
      g.strokeText(txt, w / 2, yb + 3); g.strokeText(txt, w / 2, yb);
      g.fillStyle = mix(rgb, ESC, 0.5); g.fillText(txt, w / 2, yb + 3);
      var gr = g.createLinearGradient(0, yb - F * 0.42, 0, yb + F * 0.36);
      gr.addColorStop(0, mix(rgb, BRA, 0.62)); gr.addColorStop(0.55, "rgb(" + rgb.join(",") + ")"); gr.addColorStop(1, mix(rgb, ESC, 0.15));
      g.fillStyle = gr; g.fillText(txt, w / 2, yb);
    } else {
      // nome da arma, "SALVO!"...: contorno escuro com um pouco de "espessura" embaixo (lê melhor em qualquer mapa)
      g.lineWidth = 5.5; g.strokeStyle = mix(rgb, ESC, 0.85);
      g.strokeText(txt, w / 2, h / 2 + 2); g.strokeText(txt, w / 2, h / 2);
      g.fillStyle = "rgb(" + rgb.join(",") + ")"; g.fillText(txt, w / 2, h / 2);
    }
    s = cacheTxt[k] = { c: c, w: w, h: h };
    nCacheTxt++;
    return s;
  }
  // o número caiu em quem joga contra o bot? (o motor põe o texto logo acima da bolinha)
  function corDoAlvo(x, y, cor) {
    if (typeof jogo === "undefined" || !jogo || !jogo.M || !jogo.M.contraBot) return cor;
    var bs = jogo.M.bolinhas;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b.humano && Math.abs(b.x - x) < 3 && Math.abs(b.y - b.r - 8 - y) < 3) return "#ff6b6b";
    }
    return cor;
  }
  function texto(x, y, txt, cor, escala) {
    var tx = null, k;
    for (k = 0; k < NT; k++) if (!textos[k].vivo) { tx = textos[k]; break; }
    if (!tx) { tx = textos[proxT]; proxT = (proxT + 1) % NT; }
    txt = String(txt);
    var num = EH_NUM.test(txt);
    if (num && txt.charAt(0) === "-") cor = corDoAlvo(x, y, cor || "#ffffff");
    tx.vivo = true; tx.s = spriteTexto(txt, cor || "#ffffff", num); tx.num = num;
    tx.x = x; tx.y = y; tx.idade = 0;
    if (num) {
      var v = Math.abs(parseInt(txt, 10)) || 0;
      tx.vida = 0.9; tx.vy = entre(250, 310); tx.vx = entre(-80, 80); tx.esc = Math.min(1.55, 0.82 + v / 40);
    } else { tx.vida = 1.05; tx.vy = 110; tx.vx = 0; tx.esc = escala || 1; }
  }

  // ---------- efeitos prontos ----------
  function explosao(x, y, raio) {
    var R = Math.max(18, raio || 60), i, a;
    var e = proxE; proxE = (proxE + 1) % NE;
    var lv = nivel(NIV_EXP, R * 0.94);
    EX[e] = x; EY[e] = y; EI[e] = 0; ED[e] = 0.5 + R * 0.0019; ENIV[e] = lv; EVAR[e] = rnd() < 0.5 ? 0 : 1; EVIVA[e] = 1;
    var k = R / 100;
    // fumaça (atrás da bola de fogo): puffs 2 tons que crescem e encolhem
    var nf = 5 + Math.round(R / 30);
    for (i = 0; i < nf; i++) {
      a = rnd() * PI2; var d = entre(0.25, 0.6) * R;
      fumacaP(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * entre(20, 90) * k, Math.sin(a) * entre(20, 90) * k - 28, entre(0.8, 1.3), R * 0.14, R * entre(0.34, 0.5), R * 0.06, i % 3 ? 1 : 0, 1, -30 * k, 1.8);
    }
    // faíscas afiadas
    var ns = 10 + Math.round(R / 10);
    for (i = 0; i < ns; i++) faisca(x, y, rnd() * PI2, entre(220, 620) * k, entre(0.35, 0.8), entre(2.4, 4) * Math.min(1.5, k + 0.3), i % 3 === 0 ? C_BRANCO : (i % 3 === 1 ? C_AMARELO : C_LARANJA));
    // pedaços escuros
    var nc = 4 + Math.round(R / 30);
    for (i = 0; i < nc; i++) cacoP(x, y, rnd() * PI2, entre(160, 420) * k, entre(0.5, 0.95), entre(4, 8) * Math.min(1.5, k + 0.2), i % 2 ? C_MADEIRA : C_CINZA, 650);
    for (i = 0; i < 4; i++) bitP(x, y, rnd() * PI2, entre(80, 300) * k, entre(0.4, 0.8), entre(2, 3.4), i % 2 ? C_AMARELO : C_LARANJA, 220);
    tremer(Math.min(16, R * 0.13));
  }
  function impacto(x, y, ang, cor) {
    var c = cid(cor || "#ffd23f"), back = ang + PI, i;
    for (i = 0; i < 7; i++) faisca(x, y, back + (rnd() - 0.5) * 1.9, entre(130, 400), entre(0.22, 0.45), entre(2, 3.2), i % 3 === 0 ? C_BRANCO : (i % 3 === 1 ? c : C_AMARELO));
    estrelaP(x, y, 14, C_BRANCO, 0.16, rnd());
    fumacaP(x, y, Math.cos(back) * 20, Math.sin(back) * 20, 0.35, 3, 6, 1, 2, 0.9, 0, 3);
  }
  function acerto(x, y, cor) {
    var c = cid(cor || "#ffffff"), i, a;
    estrelaP(x, y, 28, C_BRANCO, 0.22, 0.3);
    anelP(x, y, 6, 36, 6, C_BRANCO, 0.26);
    for (i = 0; i < 5; i++) { a = rnd() * PI2; estrelaP(x + Math.cos(a) * 6, y + Math.sin(a) * 6, entre(10, 16), i % 2 ? c : C_BRANCO, entre(0.35, 0.5), rnd(), Math.cos(a) * entre(70, 190), Math.sin(a) * entre(70, 190)); }
    for (i = 0; i < 8; i++) faisca(x, y, rnd() * PI2, entre(120, 380), entre(0.25, 0.5), entre(2, 3.3), i % 2 ? c : C_BRANCO, 200);
  }
  function estouro(x, y, cor) {
    var c = cid(cor || "#4dabf7"), i, a;
    var cl = cid(claro(cor || "#4dabf7"));
    estrelaP(x, y, 78, C_BRANCO, 0.22, 0.4);
    estrelaP(x, y, 54, c, 0.3, 0.8);
    anelP(x, y, 14, 96, 10, c, 0.45);
    anelP(x, y, 8, 62, 5, C_BRANCO, 0.34);
    for (i = 0; i < 10; i++) cacoP(x, y, rnd() * PI2, entre(120, 440), entre(0.6, 1.1), entre(6, 11), c, 520);
    for (i = 0; i < 24; i++) {                                 // confete da cor da bolinha + brancos
      a = rnd() * PI2;
      nova(T_CONFETE, x, y, Math.cos(a) * entre(80, 420), Math.sin(a) * entre(80, 420) - 90, entre(0.8, 1.5), entre(3.4, 5.6), 0, i % 3 === 0 ? C_BRANCO : (i % 3 === 1 ? c : cl), 360, 1.1, 1, rnd() * PI2, entre(-10, 10));
    }
    for (i = 0; i < 8; i++) bitP(x, y, rnd() * PI2, entre(80, 300), entre(0.5, 0.9), entre(3, 5), i % 2 ? c : C_BRANCO, 300);
    tremer(2);
  }
  function fumaca(x, y) {
    fumacaP(x + entre(-4, 4), y, entre(-10, 10), entre(-50, -28), entre(0.7, 1.1), 5, 11, 3, rnd() < 0.5 ? 0 : 1, 0.9, -12, 1.2);
  }
  function poeira(x, y) {
    for (var i = 0; i < 5; i++) {
      var s = i < 2 ? -1 : 1, v = entre(30, 110) * (i === 4 ? 0.3 : s);
      fumacaP(x + entre(-8, 8), y + entre(-3, 0), v, entre(-22, -6), entre(0.3, 0.5), 3, entre(6, 10), 1.5, 2, 0.95, 0, 3);
    }
  }
  function fagulhas(x, y, cor, qtd) {
    var c = cid(cor || "#ffd23f"), q = qtd || 6;
    for (var i = 0; i < q; i++) faisca(x, y, rnd() * PI2, entre(80, 300), entre(0.25, 0.55), entre(2, 3.2), i % 3 === 0 ? C_BRANCO : c);
  }
  function disparo(x, y, ang, tamanho) {
    var m = tamanho === undefined ? 1 : (tamanho > 4 ? tamanho / 20 : tamanho);
    nova(T_FLASH, x, y, 0, 0, 0.085, m, 0, 0, 0, 0, 1, ang);
    for (var i = 0; i < 3; i++) faisca(x, y, ang + (rnd() - 0.5) * 0.7, entre(260, 520) * Math.min(1.6, m), entre(0.12, 0.22), 2.4, i ? C_AMARELO : C_BRANCO, 0);
    fumacaP(x + Math.cos(ang) * 6, y + Math.sin(ang) * 6, Math.cos(ang) * 40, Math.sin(ang) * 40 - 16, 0.4, 2.5, 5 * Math.min(1.6, m), 1.5, 0, 0.85, 0, 3);
  }
  function anel(x, y, cor, raio) {
    var c = cid(cor || "#ffffff"), R = raio || 40, i, a;
    anelP(x, y, R * 0.25, R, 6, c, 0.4);
    anelP(x, y, R * 0.15, R * 0.62, 3, C_BRANCO, 0.3);
    for (i = 0; i < 6; i++) { a = i / 6 * PI2 + 0.3; estrelaP(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5, 9 + (i % 2) * 4, i % 2 ? c : C_BRANCO, 0.4, rnd(), Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9); }
  }
  function congelar(x, y) {
    var i, a;
    anelP(x, y, 10, 58, 6, C_GELO, 0.4);
    estrelaP(x, y, 42, C_BRANCO, 0.25, 0.4);
    for (i = 0; i < 10; i++) { a = rnd() * PI2; nova(T_CRISTAL, x, y, Math.cos(a) * entre(80, 280), Math.sin(a) * entre(80, 280) - 50, entre(0.6, 1), entre(5, 9), 0, 0, 340, 1.4, rnd() * PI2, entre(-6, 6)); }
    for (i = 0; i < 5; i++) bitP(x, y, rnd() * PI2, entre(40, 150), entre(0.5, 0.9), entre(2, 3.2), C_BRANCO, 60);
  }
  function fogo(x, y) {
    nova(T_CHAMA, x + entre(-4, 4), y, entre(-12, 12), entre(-90, -50), entre(0.35, 0.55), entre(10, 16), entre(3, 6), 0, -30, 0.5, 1, 0, 0, 0);
    if (rnd() < 0.25) bitP(x + entre(-5, 5), y, -PI / 2 + entre(-0.6, 0.6), entre(40, 100), entre(0.4, 0.7), 2, rnd() < 0.5 ? C_AMARELO : C_LARANJA, -40);
  }
  function teleporte(x, y, cor) {
    var c = cid(cor || "#b197fc"), i, a;
    anelP(x, y, 8, 54, 7, c, 0.42);
    anelP(x, y, 4, 34, 4, C_BRANCO, 0.3);
    estrelaP(x, y, 48, C_BRANCO, 0.22, 0.5);
    for (i = 0; i < 9; i++) { a = i / 9 * PI2 + rnd() * 0.4; faisca(x, y, a, entre(120, 300), entre(0.3, 0.5), entre(2, 3.2), i % 2 ? c : C_BRANCO, 0); }
    for (i = 0; i < 4; i++) bitP(x, y, -PI / 2 + entre(-0.5, 0.5), entre(80, 220), entre(0.4, 0.8), entre(2, 3.4), i % 2 ? c : C_BRANCO, 0);
  }

  // ---------- atualizar ----------
  function atualizar(dtMs) {
    var dt = (dtMs === undefined ? 16.667 : dtMs) / 1000;
    if (dt > 0.1) dt = 0.1;
    var i = 0, k, j;
    while (i < n) {
      var v = VIDA[i] - dt;
      if (v <= 0) {
        var u = --n;                                         // remove trocando com a última (sem alocar)
        if (i !== u) for (j = 0; j < COPIAR.length; j++) COPIAR[j][i] = COPIAR[j][u];
        continue;
      }
      VIDA[i] = v;
      var ar = 1 - ARR[i] * dt;
      if (ar < 0) ar = 0;
      VX[i] *= ar; VY[i] = VY[i] * ar + GRAV[i] * dt;
      X[i] += VX[i] * dt; Y[i] += VY[i] * dt;
      ROT[i] += VROT[i] * dt;
      i++;
    }
    for (k = 0; k < NE; k++) if (EVIVA[k]) { EI[k] += dt; if (EI[k] >= ED[k]) EVIVA[k] = 0; }
    for (k = 0; k < NT; k++) {
      var tx = textos[k];
      if (!tx.vivo) continue;
      tx.idade += dt;
      if (tx.idade >= tx.vida) { tx.vivo = false; continue; }
      if (tx.num) { tx.x += tx.vx * dt; tx.vx *= Math.max(0, 1 - 1.4 * dt); tx.y -= tx.vy * dt; tx.vy -= 600 * dt; }   // arco
      else { tx.y -= tx.vy * dt; tx.vy *= Math.max(0, 1 - 2.6 * dt); }
    }
    if (tremorA > 0) {
      tremorA *= Math.pow(0.86, dt * 60);
      if (tremorA < 0.12) tremorA = 0;
    }
    if (tremorA > 0) { desloc.x = (rnd() * 2 - 1) * tremorA; desloc.y = (rnd() * 2 - 1) * tremorA; }
    else { desloc.x = 0; desloc.y = 0; }
  }

  // ---------- desenhar ----------
  var marca = new Uint8Array(256), lista = new Uint16Array(256);
  function coresDo(tipo) {        // lista (sem repetir) das cores usadas por um tipo
    var nc = 0, i;
    for (i = 0; i < n; i++) {
      if (TIPO[i] !== tipo) continue;
      var c = CID[i] & 255;
      if (!marca[c]) { marca[c] = 1; lista[nc++] = CID[i]; }
    }
    for (i = 0; i < nc; i++) marca[lista[i] & 255] = 0;
    return nc;
  }
  var LUT_PUFF = null;
  function lutPuff() {
    LUT_PUFF = new Uint8Array(64);
    for (var v = 0; v < 64; v++) LUT_PUFF[v] = nivel(NIV_PUFF, v);
    return LUT_PUFF;
  }

  function desenhar(ctx) {
    var i, c, k, nc, u;
    if (n === 0 && !textosAtivos() && !explosoesAtivas()) return;
    ctx.save();
    var lut = LUT_PUFF || lutPuff();
    // 1. fumaça (atrás de tudo): sprites 1:1, só muda o nível e o alfa
    for (i = 0; i < n; i++) {
      if (TIPO[i] !== T_FUMACA) continue;
      u = 1 - VIDA[i] / VMAX[i];
      var s, pk = PICO[i];
      if (u < 0.22) s = TAM[i] + (pk - TAM[i]) * suave(u / 0.22); else s = pk + (TAMF[i] - pk) * ((u - 0.22) / 0.78);
      var al = ALFA[i] * (u > 0.6 ? (1 - u) / 0.4 : 1);
      if (s < 2.5 || al <= 0.04) continue;
      var sp = puff(ESTILO[i], lut[s > 62 ? 63 : (s + 0.5) | 0]);
      ctx.globalAlpha = al;
      ctx.drawImage(sp.c, (X[i] - sp.m + 0.5) | 0, (Y[i] - sp.m + 0.5) | 0);
    }
    ctx.globalAlpha = 1;
    // 2. bolas de fogo (quadros pré-renderizados, 1:1)
    for (k = 0; k < NE; k++) {
      if (!EVIVA[k]) continue;
      u = EI[k] / ED[k];
      var fr = explosaoFrames(ENIV[k], EVAR[k]), qi = Math.min(NQ - 1, (suave(u * 0.9 + 0.02) * NQ) | 0);
      ctx.drawImage(fr.q[qi], (EX[k] - fr.m + 0.5) | 0, (EY[k] - fr.m + 0.5) | 0);
    }
    // 3. lotes: confete, bits, cristais, cacos, faíscas (1 fill por cor)
    if ((nc = coresDo(T_CONFETE)) > 0) {
      for (k = 0; k < nc; k++) {
        c = lista[k]; ctx.fillStyle = PB[c]; ctx.beginPath();
        for (i = 0; i < n; i++) {
          if (TIPO[i] !== T_CONFETE || CID[i] !== c) continue;
          u = VIDA[i] / VMAX[i]; var w = TAM[i] * (u < 0.25 ? u * 4 : 1), hh = w * 0.55, fl = Math.abs(Math.cos(ROT[i] * 1.3)) + 0.15, ca = Math.cos(ROT[i]), sa = Math.sin(ROT[i]);
          var ax = ca * w, ay = sa * w, bx = -sa * hh * fl, by = ca * hh * fl;
          ctx.moveTo(X[i] - ax - bx, Y[i] - ay - by); ctx.lineTo(X[i] + ax - bx, Y[i] + ay - by); ctx.lineTo(X[i] + ax + bx, Y[i] + ay + by); ctx.lineTo(X[i] - ax + bx, Y[i] - ay + by); ctx.closePath();
        }
        ctx.fill();
      }
    }
    if ((nc = coresDo(T_BIT)) > 0) {
      for (k = 0; k < nc; k++) {
        c = lista[k]; ctx.fillStyle = PB[c]; ctx.beginPath();
        for (i = 0; i < n; i++) {
          if (TIPO[i] !== T_BIT || CID[i] !== c) continue;
          u = VIDA[i] / VMAX[i]; var rb = TAM[i] * (u < 0.3 ? u / 0.3 : 1);
          ctx.moveTo(X[i] + rb, Y[i]); ctx.arc(X[i], Y[i], rb, 0, PI2);
        }
        ctx.fill();
      }
    }
    var temCristal = false;
    for (i = 0; i < n; i++) if (TIPO[i] === T_CRISTAL) { temCristal = true; break; }
    if (temCristal) {
      for (var pass = 0; pass < 3; pass++) {
        ctx.beginPath();
        for (i = 0; i < n; i++) {
          if (TIPO[i] !== T_CRISTAL) continue;
          u = VIDA[i] / VMAX[i]; var sc = TAM[i] * (u < 0.3 ? u / 0.3 : 1), cx = Math.cos(ROT[i]), sy = Math.sin(ROT[i]);
          // losango alongado; passo 1 = metade de sombra
          var px = cx * sc * 0.55, py = sy * sc * 0.55, qx = -sy * sc * 1.1, qy = cx * sc * 1.1;
          ctx.moveTo(X[i] + qx, Y[i] + qy); ctx.lineTo(X[i] + px, Y[i] + py); ctx.lineTo(X[i] - qx, Y[i] - qy);
          if (pass !== 1) ctx.lineTo(X[i] - px, Y[i] - py);
          ctx.closePath();
        }
        if (pass === 0) { ctx.fillStyle = "#c9edff"; ctx.fill(); }
        else if (pass === 1) { ctx.fillStyle = "#7fc4f0"; ctx.fill(); }
        else { ctx.strokeStyle = "#3f6fa8"; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.stroke(); }
      }
    }
    if ((nc = coresDo(T_CACO)) > 0) {
      for (k = 0; k < nc; k++) {
        c = lista[k];
        for (var ps = 0; ps < 3; ps++) {
          ctx.beginPath();
          for (i = 0; i < n; i++) {
            if (TIPO[i] !== T_CACO || CID[i] !== c) continue;
            u = VIDA[i] / VMAX[i]; var rt = TAM[i] * (u < 0.3 ? u / 0.3 : 1), a0 = ROT[i];
            var x0 = X[i] + Math.cos(a0) * rt, y0 = Y[i] + Math.sin(a0) * rt;
            var x1 = X[i] + Math.cos(a0 + 2.45) * rt * 0.8, y1 = Y[i] + Math.sin(a0 + 2.45) * rt * 0.8;
            var x2 = X[i] + Math.cos(a0 + 4.0) * rt * 0.9, y2 = Y[i] + Math.sin(a0 + 4.0) * rt * 0.9;
            if (ps === 1) { ctx.moveTo(x0, y0); ctx.lineTo((x0 + x1) / 2, (y0 + y1) / 2); ctx.lineTo((x0 + x2) / 2, (y0 + y2) / 2); ctx.closePath(); }
            else { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); }
          }
          if (ps === 0) { ctx.fillStyle = PS[c]; ctx.fill(); } else if (ps === 1) { ctx.fillStyle = PL[c]; ctx.fill(); }
          else { ctx.strokeStyle = PC[c]; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.stroke(); }
        }
      }
    }
    if ((nc = coresDo(T_FAISCA)) > 0) {
      for (k = 0; k < nc; k++) {
        c = lista[k]; ctx.fillStyle = PB[c]; ctx.beginPath();
        for (i = 0; i < n; i++) {
          if (TIPO[i] !== T_FAISCA || CID[i] !== c) continue;
          var vx = VX[i], vy = VY[i], spd = Math.sqrt(vx * vx + vy * vy);
          if (spd < 4) continue;
          u = VIDA[i] / VMAX[i];
          var dx = vx / spd, dy = vy / spd, len = TAM[i] * (2.4 + spd * 0.032) * (0.25 + 0.75 * (u > 0.5 ? 1 : u * 2)), wd = TAM[i] * (0.35 + 0.65 * u);
          var hx = X[i] + dx * wd * 0.5, hy = Y[i] + dy * wd * 0.5;     // cabeça (ponta da frente) e cauda afinando: triângulo
          ctx.moveTo(hx - dx * len, hy - dy * len); ctx.lineTo(hx - dy * wd * 0.5, hy + dx * wd * 0.5); ctx.lineTo(hx + dy * wd * 0.5, hy - dx * wd * 0.5); ctx.closePath();
        }
        ctx.fill();
      }
    }
    // 4. sprites: chamas, estrelas, clarão de tiro
    for (i = 0; i < n; i++) {
      var tp = TIPO[i];
      if (tp === T_CHAMA) {
        u = 1 - VIDA[i] / VMAX[i]; var sh = TAM[i] + (TAMF[i] - TAM[i]) * u;
        var cs = chama(nivel(NIV_CHAMA, sh));
        ctx.globalAlpha = u > 0.65 ? (1 - u) / 0.35 : 1;
        ctx.drawImage(cs.c, (X[i] - cs.cx + 0.5) | 0, (Y[i] - cs.base + 0.5) | 0);
      } else if (tp === T_ESTRELA) {
        u = 1 - VIDA[i] / VMAX[i];
        var ss = TAM[i] * (u < 0.3 ? 0.45 + suave(u / 0.3) * 0.55 : 1 - (u - 0.3) / 0.7);
        if (ss < 4) continue;
        var es = estrela(CID[i], nivel(NIV_EST, ss), ROT[i] > 0.5 ? 1 : 0);
        ctx.globalAlpha = 1;
        ctx.drawImage(es.c, (X[i] - es.m + 0.5) | 0, (Y[i] - es.m + 0.5) | 0);
      } else if (tp === T_FLASH) {
        u = 1 - VIDA[i] / VMAX[i]; var fs = TAM[i] * (1 - u * 0.5) * 0.42;
        ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(X[i], Y[i]); ctx.rotate(ROT[i]); ctx.scale(fs, fs * (u > 0.5 ? 0.7 : 1)); ctx.drawImage(flashSpr(), -18, -40); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    // 5. anéis (traço que afina)
    for (i = 0; i < n; i++) {
      if (TIPO[i] !== T_ANEL) continue;
      u = 1 - VIDA[i] / VMAX[i];
      var lw = ALFA[i] * Math.pow(1 - u, 1.2);
      if (lw < 0.4) continue;
      ctx.beginPath(); ctx.arc(X[i], Y[i], TAM[i] + (TAMF[i] - TAM[i]) * suave(u), 0, PI2);
      ctx.strokeStyle = PB[CID[i]]; ctx.lineWidth = lw; ctx.stroke();
    }
    // 6. textos (1:1; escala só no "pop" do começo)
    for (k = 0; k < NT; k++) {
      var tx = textos[k];
      if (!tx.vivo) continue;
      var id = tx.idade, pop = tx.num ? (id < 0.08 ? 0.4 + id / 0.08 * 1.15 : (id < 0.2 ? 1.55 - (id - 0.08) / 0.12 * 0.55 : 1)) :
        (id < 0.1 ? 0.6 + id / 0.1 * 0.7 : (id < 0.2 ? 1.3 - (id - 0.1) / 0.1 * 0.3 : 1));
      var fade = tx.vida - id < 0.3 ? (tx.vida - id) / 0.3 : 1;
      ctx.globalAlpha = fade;
      if (pop === 1 && tx.esc === 1) ctx.drawImage(tx.s.c, (tx.x - tx.s.w / 2 + 0.5) | 0, (tx.y - tx.s.h / 2 + 0.5) | 0);
      else { var sw = tx.s.w * pop * tx.esc, sh2 = tx.s.h * pop * tx.esc; ctx.drawImage(tx.s.c, tx.x - sw / 2, tx.y - sh2 / 2, sw, sh2); }
    }
    ctx.restore();
  }

  function textosAtivos() {
    for (var k = 0; k < NT; k++) if (textos[k].vivo) return true;
    return false;
  }
  function explosoesAtivas() {
    for (var k = 0; k < NE; k++) if (EVIVA[k]) return true;
    return false;
  }

  function limpar() {
    n = 0;
    for (var k = 0; k < NT; k++) textos[k].vivo = false;
    for (k = 0; k < NE; k++) EVIVA[k] = 0;
    tremorA = 0; desloc.x = 0; desloc.y = 0;
  }

  // Pré-aquece os sprites (opcional; chame no carregamento para não ter engasgo no 1º uso)
  function preparar() {
    var i;
    for (i = 0; i < NIV_EXP.length; i++) { explosaoFrames(i, 0); explosaoFrames(i, 1); }
    for (var e = 0; e < ESTILOS.length; e++) for (i = 0; i < NIV_PUFF.length; i++) puff(e, i);
    for (i = 0; i < NIV_CHAMA.length; i++) chama(i);
    for (i = 0; i < NIV_EST.length; i++) { estrela(C_BRANCO, i, 0); estrela(C_BRANCO, i, 1); estrela(C_AMARELO, i, 0); }
    flashSpr();
  }

  return {
    explosao: explosao, impacto: impacto, acerto: acerto, estouro: estouro,
    fumaca: fumaca, poeira: poeira, fagulhas: fagulhas, disparo: disparo, anel: anel,
    texto: texto, congelar: congelar, fogo: fogo, teleporte: teleporte,
    tremer: tremer, deslocamento: deslocamento,
    atualizar: atualizar, desenhar: desenhar, limpar: limpar,
    preparar: preparar, contar: function() { return n; }
  };
})();
