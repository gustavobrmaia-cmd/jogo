"use strict";

// =========================
// ARTE DAS BOLINHAS (v3, v18)
// Mascote: esfera "bala de goma": base com degradê suave, meio-tom + sombra azulada, luz rebatida embaixo,
// brilho especular grande, contorno escuro da própria cor; rosto com bochechas, olhos com 2 brilhos e bocas abertas.
// Corpo, gelo, escudo, aura, chama e bochecha ficam em sprites de cache (um por cor + tamanho + resolução);
// por quadro só vão drawImage + olhos e boca (poucas formas simples). Nada de gradiente/blur no quadro.
// Resolução: com a câmera em pé (zoom 1,15–1,8) os sprites saem em 2x, senão ficavam borrados ao ampliar.
// Campos extras opcionais no descritor (usados pela queda de braço):
//   skin (id do corpo, padrão "classico") e acessorio (id, padrão "nenhum"): ver arte/skins.js (ArteSkins).
//   faixa (hex) = faixa esportiva na cabeça, faixaLado (-1 nó à esquerda, 1 à direita), faixaInc (inclinação),
//   faixaListra (cor da listra), vira (-1..1) = vira o rosto para o lado (3/4); expressao extra "smirk" (confiante).
// =========================

const ArteBolinha = (function() {
  var PI = Math.PI, PI2 = Math.PI * 2;
  var ESCURO = [26, 13, 51], AZUL = [48, 28, 120], BRANCO = [255, 255, 255], GELO = [170, 225, 255];
  var TINTA = "#1b1030";      // pupilas e linhas do rosto
  var LINGUA = "#ff7b9c", ROSA = [255, 100, 145], ROSA_ESC = [214, 28, 84];

  // ---------- cores ----------
  function hexRgb(h) {
    if (h.charAt(0) === "#") h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, q) {
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * q) + "," + Math.round(a[1] + (b[1] - a[1]) * q) + "," +
      Math.round(a[2] + (b[2] - a[2]) * q) + ")";
  }

  // paleta cel-shading de uma cor: base, sombra (puxada para azul/roxo), luz, luz de borda e contorno escuro da própria cor
  var paletas = {};
  function paleta(cor) {
    var p = paletas[cor];
    if (p) return p;
    var rgb = hexRgb(cor || "#4dabf7");
    // bochecha: rosa mais forte que o corpo (num corpo rosa/vermelho, rosa escuro para aparecer)
    var mx0 = Math.max(rgb[0], rgb[1], rgb[2]), rosado = rgb[0] === mx0 && rgb[0] - Math.min(rgb[1], rgb[2]) > 90 && rgb[2] < rgb[0] * 0.75;
    p = paletas[cor] = {
      rgb: rgb, base: "rgb(" + rgb.join(",") + ")",
      sombra: mix(rgb, AZUL, 0.40), luz: mix(rgb, BRANCO, 0.50), brilho: mix(rgb, BRANCO, 0.82),
      lid: mix(rgb, BRANCO, 0.16), rim: mix(rgb, GELO, 0.55), contorno: mix(rgb, ESCURO, 0.70), fundo: mix(rgb, ESCURO, 0.45),
      meio: mix(rgb, AZUL, 0.2), luzSuave: mix(rgb, BRANCO, 0.34), iris: "#5040a8",
      bochecha: rosado ? mix(rgb, ROSA_ESC, 0.62) : mix(rgb, ROSA, 0.86)
    };
    return p;
  }

  function criarCanvas(w, h) { var c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function espessura(r) { return Math.max(1.6, Math.min(2.8, r * 0.075)); }  // mesma espessura de traço em tudo
  function espQ(R, q) { return espessura(R / q) * q; }                          // idem num sprite em resolução q
  // resolução dos sprites: 1x na tela normal; 2x quando o contexto está ampliado (câmera em pé)
  function resolucao(ctx) {
    if (!ctx.getTransform) return 1;
    var m = ctx.getTransform(), k = Math.sqrt(m.a * m.a + m.b * m.b);
    return k > 1.14 ? 2 : 1;
  }

  // ---------- sprites em cache ----------
  var corpos = {}, brancos = {}, geloS = {}, escudoS = {}, auraS = {};

  // corpo: esfera com degradê suave, meio-tom + sombra em meia-lua, luz rebatida, brilho especular e contorno
  function criarCorpo(cor, R, q) {
    var p = paleta(cor), pad = Math.ceil(4 * q), S = (R + pad) * 2;
    var c = criarCanvas(S, S), g = c.getContext("2d");
    g.translate(S / 2, S / 2);
    var lw = espQ(R, q);
    g.beginPath(); g.arc(0, 0, R, 0, PI2); g.fillStyle = p.sombra; g.fill();
    g.save(); g.clip();
    g.beginPath(); g.arc(-R * 0.07, -R * 0.09, R * 0.97, 0, PI2); g.fillStyle = p.meio; g.fill();        // meio-tom (terminador macio)
    var gr = g.createRadialGradient(-R * 0.34, -R * 0.4, R * 0.04, -R * 0.12, -R * 0.15, R * 0.92);    // parte iluminada
    gr.addColorStop(0, p.luzSuave); gr.addColorStop(0.5, p.base); gr.addColorStop(1, p.base);
    g.beginPath(); g.arc(-R * 0.12, -R * 0.15, R * 0.91, 0, PI2); g.fillStyle = gr; g.fill();
    var gb = g.createLinearGradient(0, R * 0.64, 0, R * 1.02);                                                // luz rebatida do chão
    gb.addColorStop(0, "rgba(255,255,255,0)"); gb.addColorStop(1, p.rim);
    g.globalAlpha = 0.55; g.beginPath(); g.ellipse(R * 0.1, R * 0.98, R * 0.78, R * 0.34, 0, 0, PI2); g.fillStyle = gb; g.fill(); g.globalAlpha = 1;
    g.restore();
    // luz de borda (lado oposto)
    g.lineCap = "round";
    g.beginPath(); g.arc(0, 0, R - lw - R * 0.04, PI * 0.08, PI * 0.46);
    g.strokeStyle = p.rim; g.lineWidth = Math.max(1.2 * q, R * 0.06); g.globalAlpha = 0.95; g.stroke();
    g.beginPath(); g.arc(0, 0, R - lw - R * 0.04, PI * 0.5, PI * 0.62); g.lineWidth = Math.max(1 * q, R * 0.04); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
    brilhoEsfera(g, R, 1);
    // contorno
    g.beginPath(); g.arc(0, 0, R - lw / 2, 0, PI2); g.strokeStyle = p.contorno; g.lineWidth = lw; g.stroke();
    return { c: c, m: S / 2 };
  }
  // brilho especular: halo macio + pílula inclinada + pontinho (o mesmo em todas as skins)
  function brilhoEsfera(g, R, f) {
    g.save(); g.translate(-R * 0.4, -R * 0.47); g.rotate(-0.72);
    var hg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.42);
    hg.addColorStop(0, "rgba(255,255,255,0.55)"); hg.addColorStop(1, "rgba(255,255,255,0)");
    g.globalAlpha = f; g.scale(1, 0.62); g.beginPath(); g.arc(0, 0, R * 0.42, 0, PI2); g.fillStyle = hg; g.fill();
    g.restore();
    g.save(); g.translate(-R * 0.42, -R * 0.5); g.rotate(-0.72);
    g.beginPath(); g.ellipse(0, 0, R * 0.27, R * 0.11, 0, 0, PI2); g.fillStyle = "#fff"; g.globalAlpha = 0.95 * f; g.fill(); g.restore();
    g.beginPath(); g.arc(-R * 0.7, -R * 0.19, R * 0.068, 0, PI2); g.fillStyle = "#fff"; g.globalAlpha = 0.9 * f; g.fill(); g.globalAlpha = 1;
  }
  function corpo(cor, R, q) {
    q = q || 1;
    var k = cor + "|" + R + "|" + q;
    return corpos[k] || (corpos[k] = criarCorpo(cor, R, q));
  }
  // corpo da skin (ArteSkins, carregada antes); sem ArteSkins ou "classico" = corpo acima
  function corpoSk(cor, R, sk, q) {
    return sk && sk !== "classico" && typeof ArteSkins !== "undefined" && typeof ArteSkins.corpo === "function" ? (ArteSkins.corpo(sk, cor, R, q) || corpo(cor, R, q)) : corpo(cor, R, q);
  }
  function branco(cor, R, sk, q) { // silhueta branca para o flash de dano
    var k = (sk || "") + "|" + cor + "|" + R + "|" + q, s = brancos[k];
    if (s) return s;
    var b = corpoSk(cor, R, sk, q), c = criarCanvas(b.c.width, b.c.height), g = c.getContext("2d");
    g.drawImage(b.c, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    return (brancos[k] = { c: c, m: b.m });
  }

  // cubo de gelo translúcido (casca em volta da bolinha)
  function criarGelo(R, q) {
    var h = R * 1.22, pad = 5 * q, S = (h + pad) * 2;
    var c = criarCanvas(S, S), g = c.getContext("2d");
    g.translate(S / 2, S / 2);
    var rc = h * 0.34, lw = espQ(R, q);
    function caminho() {
      g.beginPath();
      g.moveTo(-h + rc, -h); g.arcTo(h, -h, h, h, rc); g.arcTo(h, h, -h, h, rc); g.arcTo(-h, h, -h, -h, rc); g.arcTo(-h, -h, h, -h, rc); g.closePath();
    }
    caminho(); g.fillStyle = "rgba(125,196,240,0.50)"; g.fill();
    g.save(); caminho(); g.clip();
    g.translate(-h * 0.07, -h * 0.09); caminho(); g.fillStyle = "rgba(190,234,255,0.46)"; g.fill();   // face iluminada
    g.restore();
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.beginPath(); g.moveTo(-h * 0.78, -h * 0.5); g.lineTo(-h * 0.5, -h * 0.78); g.lineTo(-h * 0.38, -h * 0.66); g.lineTo(-h * 0.66, -h * 0.38); g.closePath(); g.fill();
    g.beginPath(); g.arc(-h * 0.8, -h * 0.12, h * 0.05, 0, PI2); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = lw * 0.8; g.lineCap = "round";
    g.beginPath(); g.moveTo(h * 0.45, h * 0.78); g.lineTo(h * 0.74, h * 0.5); g.stroke();
    caminho(); g.strokeStyle = "#3f6fa8"; g.lineWidth = lw; g.stroke();
    return { c: c, m: S / 2 };
  }
  function gelo(R, q) { var k = R + "|" + q; return geloS[k] || (geloS[k] = criarGelo(R, q)); }

  // bolha do escudo
  function criarEscudo(R, q) {
    var h = R * 1.45, S = (h + 4 * q) * 2;
    var c = criarCanvas(S, S), g = c.getContext("2d");
    g.translate(S / 2, S / 2);
    var lw = espQ(R, q);
    g.beginPath(); g.arc(0, 0, h, 0, PI2); g.fillStyle = "rgba(110,190,255,0.16)"; g.fill();
    g.beginPath(); g.arc(0, 0, h, 0, PI2); g.strokeStyle = "rgba(190,232,255,0.95)"; g.lineWidth = lw; g.stroke();
    g.beginPath(); g.arc(0, 0, h - lw * 2.6, PI * 0.1, PI * 0.45); g.strokeStyle = "rgba(120,190,255,0.55)"; g.lineWidth = lw; g.lineCap = "round"; g.stroke();
    g.beginPath(); g.arc(0, 0, h - lw * 2.4, PI * 1.08, PI * 1.38); g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = lw * 1.5; g.stroke();
    g.beginPath(); g.arc(0, 0, h - lw * 2.4, PI * 1.45, PI * 1.5); g.stroke();
    return { c: c, m: S / 2 };
  }
  function escudo(R, q) { var k = R + "|" + q; return escudoS[k] || (escudoS[k] = criarEscudo(R, q)); }

  // aura de fúria: coroa de línguas de fogo vermelhas
  function criarAura(R, q) {
    var h = R * 1.6, S = (h + 4 * q) * 2, n = 11;
    var c = criarCanvas(S, S), g = c.getContext("2d");
    g.translate(S / 2, S / 2);
    var lw = espQ(R, q);
    function lingua(a, rin, rout, larg) {
      g.beginPath();
      g.moveTo(Math.cos(a - larg) * rin, Math.sin(a - larg) * rin);
      g.quadraticCurveTo(Math.cos(a - larg * 0.5) * (rin + rout) * 0.55, Math.sin(a - larg * 0.5) * (rin + rout) * 0.55, Math.cos(a + 0.12) * rout, Math.sin(a + 0.12) * rout);
      g.quadraticCurveTo(Math.cos(a + larg * 0.9) * (rin + rout) * 0.52, Math.sin(a + larg * 0.9) * (rin + rout) * 0.52, Math.cos(a + larg) * rin, Math.sin(a + larg) * rin);
      g.closePath();
    }
    for (var i = 0; i < n; i++) {
      var a = i / n * PI2, rr = h * (i % 2 ? 0.86 : 1);
      lingua(a, R * 0.85, rr, 0.22);
      g.fillStyle = "#e5312f"; g.fill(); g.strokeStyle = "#7a1626"; g.lineWidth = lw; g.lineJoin = "round"; g.stroke();
      lingua(a, R * 0.9, R * 0.9 + (rr - R * 0.9) * 0.62, 0.12); g.fillStyle = "#ff8a3d"; g.fill();
    }
    return { c: c, m: S / 2 };
  }
  function aura(R, q) { var k = R + "|" + q; return auraS[k] || (auraS[k] = criarAura(R, q)); }

  // chama pequena (fogo em cima da cabeça): três camadas chapadas
  var chamaS = null;
  function chama() {
    if (chamaS) return chamaS;
    var W = 40, H = 64, c = criarCanvas(W * 2, H * 2), g = c.getContext("2d");
    g.scale(2, 2);
    function gota(cx, base, w, h) {
      g.beginPath(); g.moveTo(cx - w, base);
      g.bezierCurveTo(cx - w * 1.1, base - h * 0.45, cx - w * 0.2, base - h * 0.55, cx + w * 0.05, base - h);
      g.bezierCurveTo(cx + w * 0.3, base - h * 0.55, cx + w * 1.1, base - h * 0.45, cx + w, base);
      g.arc(cx, base, w, 0, PI, false); g.closePath();
    }
    gota(20, 56, 15, 54); g.fillStyle = "#ff6a1f"; g.fill(); g.strokeStyle = "#8e2418"; g.lineWidth = 2; g.lineJoin = "round"; g.stroke();
    gota(21, 55, 9, 34); g.fillStyle = "#ffc22e"; g.fill();
    gota(21, 54, 4.5, 16); g.fillStyle = "#fff3a6"; g.fill();
    return (chamaS = c);
  }

  // estrelinha do "tonto"
  var estrelaS = null;
  function estrela() {
    if (estrelaS) return estrelaS;
    var c = criarCanvas(48, 48), g = c.getContext("2d");
    g.scale(2, 2); g.translate(12, 12);
    g.beginPath();
    for (var i = 0; i < 10; i++) { var a = -PI / 2 + i * PI / 5, rr = i % 2 ? 4.2 : 10; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = "#ffd43b"; g.fill(); g.strokeStyle = "#9a6a12"; g.lineWidth = 1.6; g.lineJoin = "round"; g.stroke();
    return (estrelaS = c);
  }

  // ---------- sombra no chão ----------
  var sombraS = null;
  function sombraSpr() {
    if (sombraS) return sombraS;
    var c = criarCanvas(128, 32), g = c.getContext("2d");
    g.translate(64, 16); g.scale(1, 0.24);
    var gr = g.createRadialGradient(0, 0, 0, 0, 0, 63);
    gr.addColorStop(0, "rgba(24,12,60,0.42)"); gr.addColorStop(0.55, "rgba(24,12,60,0.30)"); gr.addColorStop(1, "rgba(24,12,60,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 63, 0, PI2); g.fill();
    return (sombraS = c);
  }
  function sombra(ctx, x, chaoY, r, altura) {
    var h = altura > 0 ? altura : 0;
    if (h > 520) return;
    var k = 1 / (1 + h / 140), w = r * 2.5 * k;
    ctx.globalAlpha = 0.35 + 0.65 * k;
    ctx.drawImage(sombraSpr(), x - w / 2, chaoY - w * 0.06, w, w * 0.25);
    ctx.globalAlpha = 1;
  }

  // ---------- expressões ----------
  // tampa = quanto a pálpebra de cima cobre (0..1); incl = inclinação (+ = bravo); baixo = pálpebra de baixo;
  // pup = tamanho da pupila; olho = tamanho do olho; boca = tipo de boca; xis = olhos apertados "> <"
  var EXP = {
    normal:  { tampa: 0,    incl: 0,     baixo: 0,    pup: 1,    olho: 1,    boca: 0 },
    bravo:   { tampa: 0.38, incl: 0.7,   baixo: 0.06, pup: 0.95, olho: 1,    boca: 1 },
    dor:     { tampa: 0.5,  incl: -0.25, baixo: 0.3,  pup: 0.7,  olho: 1,    boca: 2, xis: 1 },
    feliz:   { tampa: 0,    incl: 0,     baixo: 0,    pup: 1,    olho: 1,    boca: 3 },
    tonto:   { tampa: 0.14, incl: 0,     baixo: 0,    pup: 0.8,  olho: 1.05, boca: 4 },
    esforco: { tampa: 0.4,  incl: 0.4,   baixo: 0.16, pup: 0.8,  olho: 1,    boca: 5 },
    medo:    { tampa: 0.12, incl: -0.6,  baixo: 0,    pup: 0.58, olho: 1.12, boca: 6 },
    smirk:   { tampa: 0.3,  incl: 0.22,  baixo: 0.1,  pup: 1,    olho: 1,    boca: 7 }   // confiante (queda de braço)
  };

  // bochecha: oval rosado de borda macia (sprite por cor; desenhado 2x por quadro)
  var bochechas = {};
  function bochecha(cor) {
    var s = bochechas[cor];
    if (s) return s;
    var c = criarCanvas(48, 30), g = c.getContext("2d");
    g.translate(24, 15); g.scale(1, 0.6);
    var gr = g.createRadialGradient(0, 0, 0, 0, 0, 23);
    gr.addColorStop(0, cor); gr.addColorStop(0.55, cor); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.globalAlpha = 0.72; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 23, 0, PI2); g.fill();
    return (bochechas[cor] = c);
  }

  // um olho em (cx,cy); s = -1 (esquerdo) ou 1 (direito)
  function olho(g, cx, cy, rx, ry, s, ex, tampa, p, gx, gy, lw) {
    g.save();
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, PI2); g.clip();
    g.fillStyle = "#d8d1f0"; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);                 // sombra da pálpebra no topo
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(cx, cy + ry * 0.12, rx, ry, 0, 0, PI2); g.fill();
    var pr = rx * 0.8 * ex.pup, pry = pr * 1.14;                                            // íris oval + 2 brilhos
    var px = cx + gx * (rx - pr) * 0.9, py = cy + ry * 0.05 + gy * (ry - pry) * 0.8;
    g.fillStyle = TINTA; g.beginPath(); g.ellipse(px, py, pr, pry, 0, 0, PI2); g.fill();
    if (p.iris) { g.fillStyle = p.iris; g.beginPath(); g.ellipse(px, py, pr * 0.74, pry * 0.8, 0, PI * 0.16, PI * 0.84); g.fill(); }  // reflexo colorido embaixo
    g.fillStyle = "#fff"; g.beginPath(); g.arc(px - pr * 0.3, py - pry * 0.36, pr * 0.38, 0, PI2);                    // 2 brilhos num caminho só
    g.moveTo(px + pr * 0.53, py + pry * 0.34); g.arc(px + pr * 0.38, py + pry * 0.34, pr * 0.15, 0, PI2); g.fill();
    g.strokeStyle = p.anel || p.contorno; g.lineWidth = lw * 1.4; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, PI2); g.stroke();   // contorno do olho (só a metade de dentro aparece)
    // pálpebra de cima: corte reto/inclinado com linha grossa (vira sobrancelha no bravo/medo)
    if (tampa > 0.01 || ex.incl) {
      var y0 = cy - ry + 2 * ry * tampa, k = ex.incl * ry * -s;                   // bravo: lado de dentro mais baixo
      var xa = cx - rx - 2, xb = cx + rx + 2, ya = y0 + k * (xa - cx) / rx, yb = y0 + k * (xb - cx) / rx;
      g.fillStyle = p.lid; g.beginPath(); g.moveTo(xa, cy - ry - 3); g.lineTo(xb, cy - ry - 3); g.lineTo(xb, yb); g.lineTo(xa, ya); g.closePath(); g.fill();
      g.strokeStyle = p.contorno; g.lineWidth = lw * 1.5; g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb, yb); g.stroke();
    }
    if (ex.baixo > 0.01) {                                                                  // pálpebra de baixo (bochecha sobe)
      var yb2 = cy + ry - 2 * ry * ex.baixo;
      g.fillStyle = p.lid; g.fillRect(cx - rx - 2, yb2, rx * 2 + 4, ry * ex.baixo * 2 + 3);
      g.strokeStyle = p.contorno; g.lineWidth = lw; g.beginPath(); g.moveTo(cx - rx - 2, yb2); g.lineTo(cx + rx + 2, yb2); g.stroke();
    }
    g.restore();
  }

  // rosto completo (bochechas + olhos + boca) no espaço local do corpo; boch = sprite da bochecha (ou null)
  function rosto(g, r, p, b, boch) {
    var exp = EXP[b.expressao] || EXP.normal, tin = p.tinta || TINTA;     // skins escuras: boca/arcos claros
    var ox = b.olharX || 0, oy = b.olharY || 0, vira = b.vira || 0;
    var fx = (ox * 0.07 + vira * 0.17) * r, fy = oy * 0.04 * r;                       // o rosto acompanha o olhar (3/4)
    var rx = r * 0.215 * exp.olho, ry = r * 0.295 * exp.olho, ey = -r * 0.05 + fy, ex0 = r * 0.315;
    var lw = Math.max(1, r * 0.05);
    var pisc = b.piscar > 0 ? (b.piscar > 1 ? 1 : b.piscar) : 0;
    var feliz = b.expressao === "feliz";
    var gx = ox, gy = oy;
    if (b.expressao === "tonto") { var tt = (b.t || 0) * 7; gx = Math.cos(tt) * 0.8; gy = Math.sin(tt) * 0.8; }
    var s, cx, rxx, bw = r * 0.4, bh = r * 0.25;
    if (boch) for (var j = 0; j < 2; j++) {                    // bochechas (embaixo dos olhos, para fora)
      s = j ? 1 : -1;
      g.drawImage(boch, s * r * 0.53 * (1 - 0.12 * vira * s) + fx * 0.85 - bw / 2, r * 0.27 + fy - bh / 2, bw, bh);
    }
    g.lineCap = "round"; g.lineJoin = "round";
    for (var i = 0; i < 2; i++) {
      s = i ? 1 : -1;
      rxx = rx * (1 - 0.16 * vira * s);                      // o olho de trás fica mais estreito (perspectiva)
      cx = s * ex0 * (1 - 0.1 * vira * s) + fx;
      if (exp.xis && pisc < 0.5) {                            // dor: olhos apertados "> <"
        var w = rxx * 1.05, h = ry * 0.62;
        g.strokeStyle = tin; g.lineWidth = Math.max(1.8, r * 0.095);
        g.beginPath(); g.moveTo(cx + s * w * 0.75, ey - h); g.lineTo(cx - s * w * 0.85, ey + h * 0.05); g.lineTo(cx + s * w * 0.75, ey + h); g.stroke();
      } else if (feliz || pisc > 0.7) {                       // olho fechado: arco
        g.strokeStyle = tin; g.lineWidth = Math.max(1.8, r * 0.095);
        g.beginPath();
        if (feliz) g.arc(cx, ey + ry * 0.38, rxx * 1.0, PI * 1.12, PI * 1.88);
        else g.arc(cx, ey - ry * 0.3, rxx * 1.0, PI * 0.12, PI * 0.88);
        g.stroke();
      } else {
        olho(g, cx, ey, rxx, ry, s, exp, exp.tampa + (1 - exp.tampa) * pisc * 0.9, p, gx, gy, lw);
      }
    }
    // boca
    var my = r * 0.37 + fy, mx = fx * 0.9, mw, mh;
    g.strokeStyle = tin; g.fillStyle = tin; g.lineWidth = Math.max(1.6, r * 0.072);
    g.beginPath();
    switch (exp.boca) {
      case 0: g.arc(mx, my - r * 0.12, r * 0.15, PI * 0.2, PI * 0.8); g.stroke(); break;                      // normal: sorrisinho
      case 1: g.moveTo(mx - r * 0.14, my + r * 0.04); g.quadraticCurveTo(mx, my - r * 0.06, mx + r * 0.14, my + r * 0.04); g.stroke(); break; // bravo
      case 2:                                                                                                    // dor: boca aberta tremida
        mw = r * 0.13; mh = r * 0.12;
        g.moveTo(mx - mw, my); g.quadraticCurveTo(mx - mw * 0.5, my - mh * 1.15, mx, my - mh * 0.7); g.quadraticCurveTo(mx + mw * 0.5, my - mh * 1.15, mx + mw, my);
        g.quadraticCurveTo(mx + mw * 0.75, my + mh * 1.25, mx, my + mh); g.quadraticCurveTo(mx - mw * 0.75, my + mh * 1.25, mx - mw, my); g.fill();
        g.fillStyle = LINGUA; g.beginPath(); g.ellipse(mx, my + mh * 0.5, mw * 0.48, mh * 0.36, 0, 0, PI2); g.fill();
        break;
      case 3:                                                                                                    // feliz: boca aberta (D) com língua
        mw = r * 0.2; mh = r * 0.19;
        g.moveTo(mx - mw, my - mh * 0.4); g.quadraticCurveTo(mx, my - mh * 0.12, mx + mw, my - mh * 0.4);
        g.quadraticCurveTo(mx + mw * 0.92, my + mh, mx, my + mh); g.quadraticCurveTo(mx - mw * 0.92, my + mh, mx - mw, my - mh * 0.4); g.fill();
        g.fillStyle = LINGUA; g.beginPath(); g.ellipse(mx, my + mh * 0.62, mw * 0.5, mh * 0.32, 0, 0, PI2); g.fill();
        break;
      case 4: g.moveTo(mx - r * 0.18, my); g.quadraticCurveTo(mx - r * 0.09, my - r * 0.1, mx, my); g.quadraticCurveTo(mx + r * 0.09, my + r * 0.1, mx + r * 0.18, my); g.stroke(); break; // tonto
      case 5: g.moveTo(mx - r * 0.17, my - r * 0.02); g.quadraticCurveTo(mx, my + r * 0.07, mx + r * 0.17, my - r * 0.02); g.stroke(); break;   // esforço
      case 7: var sg = vira < 0 ? -1 : 1; g.moveTo(mx - sg * r * 0.2, my - r * 0.03); g.quadraticCurveTo(mx + sg * r * 0.02, my + r * 0.1, mx + sg * r * 0.22, my - r * 0.12); g.stroke(); break; // confiante: sorriso de lado
      case 6: g.moveTo(mx - r * 0.13, my + r * 0.03); g.quadraticCurveTo(mx - r * 0.065, my - r * 0.06, mx, my + r * 0.03); g.quadraticCurveTo(mx + r * 0.065, my + r * 0.12, mx + r * 0.13, my + r * 0.03); g.stroke(); break; // medo
    }
  }

  // faixa esportiva na cabeça: parte do corpo (tira recortada na esfera + nó) e pontas que balançam
  function faixaCorpo(g, r, b) {
    var pf = paleta(b.faixa), lado = b.faixaLado || 1;
    var lw = espessura(r);
    var yc = -r * 0.56, esp = r * 0.26, sag = r * 0.07;     // centro da faixa, espessura, curvatura (sorriso suave)
    g.save();
    g.rotate(b.faixaInc || 0);
    g.save();
    g.beginPath(); g.arc(0, 0, r - lw * 0.5, 0, PI2); g.clip();
    function tira(y1, y2) {
      g.beginPath();
      g.moveTo(-r * 1.1, y1 - sag * 0.2); g.quadraticCurveTo(0, y1 + sag * 2, r * 1.1, y1 - sag * 0.2);
      g.lineTo(r * 1.1, y2 - sag * 0.2); g.quadraticCurveTo(0, y2 + sag * 2, -r * 1.1, y2 - sag * 0.2); g.closePath();
    }
    tira(yc - esp / 2, yc + esp / 2); g.fillStyle = pf.base; g.fill();
    tira(yc + esp * 0.16, yc + esp / 2); g.fillStyle = pf.sombra; g.fill();                    // sombra embaixo
    tira(yc - esp / 2, yc - esp * 0.3); g.fillStyle = pf.luz; g.globalAlpha = 0.7; g.fill(); g.globalAlpha = 1; // luz em cima
    tira(yc - esp * 0.1, yc + esp * 0.06); g.fillStyle = b.faixaListra || "#fff"; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1; // listra
    g.strokeStyle = pf.contorno; g.lineWidth = lw * 0.9; g.lineJoin = "round";
    g.beginPath(); g.moveTo(-r * 1.1, yc - esp / 2 - sag * 0.2); g.quadraticCurveTo(0, yc - esp / 2 + sag * 2, r * 1.1, yc - esp / 2 - sag * 0.2); g.stroke();
    g.beginPath(); g.moveTo(-r * 1.1, yc + esp / 2 - sag * 0.2); g.quadraticCurveTo(0, yc + esp / 2 + sag * 2, r * 1.1, yc + esp / 2 - sag * 0.2); g.stroke();
    g.restore();
    var nx = lado * r * 0.95, ny = yc + sag * 0.5;
    g.beginPath(); g.ellipse(nx - lado * r * 0.02, ny, r * 0.15, r * 0.17, 0, 0, PI2);       // nó
    g.fillStyle = pf.base; g.fill(); g.strokeStyle = pf.contorno; g.lineWidth = lw * 0.9; g.stroke();
    g.beginPath(); g.ellipse(nx - lado * r * 0.05, ny - r * 0.05, r * 0.06, r * 0.045, -0.5, 0, PI2); g.fillStyle = pf.brilho; g.fill();
    g.restore();
  }
  // pontas do nó (para trás da cabeça), balançando; desenhadas ANTES do corpo
  function faixaPontas(g, r, b) {
    var pf = paleta(b.faixa), lado = b.faixaLado || 1, t = b.t || 0, lw = espessura(r);
    var yc = -r * 0.56, sag = r * 0.07;
    g.save();
    g.rotate(b.faixaInc || 0);
    var nx = lado * r * 0.95, ny = yc + sag * 0.5;
    for (var i = 0; i < 2; i++) {
      var bal = Math.sin(t * 9 + i * 1.9 + (b.faixaFase || 0)) * 0.22 + Math.sin(t * 5.3 + i) * 0.1;
      var ang = (lado > 0 ? 0 : PI) - lado * ((i ? -0.6 : 0.42) + bal);     // abre para trás e para cima/baixo
      var L = r * (i ? 0.62 : 0.78), w = r * 0.15, ca = Math.cos(ang), sa = Math.sin(ang);
      var sw = Math.sin(t * 7 + i * 2) * w * 0.9;
      var tx = nx + ca * L, ty = ny + sa * L, mx = nx + ca * L * 0.5 - sa * sw, my = ny + sa * L * 0.5 + ca * sw;
      g.beginPath();
      g.moveTo(nx - sa * w, ny + ca * w);
      g.quadraticCurveTo(mx - sa * w * 0.9, my + ca * w * 0.9, tx, ty);
      g.quadraticCurveTo(mx + sa * w * 0.9, my - ca * w * 0.9, nx + sa * w, ny - ca * w);
      g.closePath();
      g.fillStyle = i ? pf.sombra : pf.base; g.fill(); g.strokeStyle = pf.contorno; g.lineWidth = lw * 0.9; g.lineJoin = "round"; g.stroke();
    }
    g.restore();
  }

  // corpo + faixa + rosto prontos num sprite só (quando a expressão não anima): 1 drawImage por bolinha.
  // Ligue com b.cache = true. Chave: cor, tamanho, expressão, piscada, faixa, olhar e vira.
  var compostos = {}, tmpB = { t: 0 };
  function composto(b, cor, R, sk, pr, q, boch) {
    // atalho: se nada mudou desde o quadro anterior deste descritor, reaproveita o sprite (sem montar a chave)
    var u = b.__cu;
    if (u && u.cor === cor && u.R === R && u.q === q && u.sk === sk && u.ex === b.expressao && u.pi === (b.piscar > 0.5 ? 1 : 0) && u.fx === b.faixa && u.ox === b.olharX && u.oy === b.olharY &&
        u.vi === b.vira && u.li === b.faixaListra && u.la === b.faixaLado && u.inc === b.faixaInc) return u.s;
    var k = sk + "|" + cor + "|" + R + "|" + q + "|" + b.expressao + "|" + (b.piscar > 0.5 ? 1 : 0) + "|" + (b.faixa || "") + "|" + (b.faixaListra || "") + "|" + (b.faixaLado || 0) + "|" +
      (b.vira || 0).toFixed(1) + "|" + (b.olharX || 0).toFixed(1) + "|" + (b.olharY || 0).toFixed(1) + "|" + (b.faixaInc || 0).toFixed(2);
    var s = compostos[k];
    if (!s) {
      var r = R / q, pad = Math.ceil(R * 0.34) + 4 * q, S = (R + pad) * 2;
      var c = criarCanvas(S, S), g = c.getContext("2d");
      g.translate(S / 2, S / 2);
      var cb = corpoSk(cor, R, sk, q);
      g.drawImage(cb.c, -cb.m, -cb.m);
      g.scale(q, q);                                          // faixa e rosto em unidades da tela (raio r)
      tmpB.faixa = b.faixa; tmpB.faixaListra = b.faixaListra; tmpB.faixaLado = b.faixaLado; tmpB.faixaInc = b.faixaInc;
      if (b.faixa) faixaCorpo(g, r, tmpB);
      tmpB.expressao = b.expressao; tmpB.olharX = b.olharX; tmpB.olharY = b.olharY; tmpB.vira = b.vira; tmpB.piscar = b.piscar > 0.5 ? 1 : 0;
      rosto(g, r, pr, tmpB, boch);
      s = compostos[k] = { c: c, m: S / 2, S: S };
    }
    if (!u) u = b.__cu = {};
    u.cor = cor; u.R = R; u.q = q; u.sk = sk; u.ex = b.expressao; u.pi = b.piscar > 0.5 ? 1 : 0; u.fx = b.faixa; u.ox = b.olharX; u.oy = b.olharY; u.vi = b.vira; u.li = b.faixaListra; u.la = b.faixaLado; u.inc = b.faixaInc; u.s = s;
    return s;
  }

  // ---------- desenho principal ----------
  function desenhar(ctx, b) {
    var r = b.r || 28, cor = b.cor || "#4dabf7";
    var q = resolucao(ctx), R = Math.max(8, Math.round(r * q)), sc = r / R;
    var fan = b.fantasma > 0 ? (b.fantasma > 1 ? 1 : b.fantasma) : 0;
    var t = b.t || 0;
    var sx = b.escalaX === undefined ? 1 : b.escalaX, sy = b.escalaY === undefined ? 1 : b.escalaY;
    var p = paleta(cor);
    var sk = b.skin || "classico", ac = b.acessorio || "nenhum";
    var pr = sk !== "classico" && typeof ArteSkins !== "undefined" && typeof ArteSkins.rosto === "function" ? (ArteSkins.rosto(sk, cor) || p) : p;   // paleta do rosto (pálpebra/anel/tinta da skin)
    var bc = pr.bochecha === undefined ? p.bochecha : pr.bochecha, boch = bc ? bochecha(bc) : null;
    ctx.save();
    ctx.translate(Math.round(b.x || 0), Math.round(b.y || 0));

    // rapidez: imagens fantasma atrás + traços de velocidade
    if (b.rapidez) {
      var vx = b.vx || 0, vy = b.vy || 0, vel = Math.sqrt(vx * vx + vy * vy);
      var dx = vel > 0.6 ? vx : (b.olharX >= 0 ? 3 : -3), dy = vel > 0.6 ? vy : 0;
      var cs = corpoSk(cor, R, sk, q), m = cs.m * sc;
      for (var k = 3; k >= 1; k--) {
        ctx.globalAlpha = 0.2 - k * 0.045;
        ctx.drawImage(cs.c, -dx * k * 2.6 - m, -dy * k * 2.6 - m, m * 2, m * 2);
      }
      ctx.globalAlpha = 0.85; ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.lineCap = "round";
      var dl = Math.sqrt(dx * dx + dy * dy) || 1, ux = -dx / dl, uy = -dy / dl, off = ((t * 5) % 1);
      ctx.beginPath();
      for (var l = 0; l < 3; l++) {
        var oo = (l - 1) * r * 0.55, qq = ((off + l * 0.34) % 1);
        var sx0 = ux * (r * 1.15 + qq * r * 0.8) - uy * oo, sy0 = uy * (r * 1.15 + qq * r * 0.8) + ux * oo;
        ctx.moveTo(sx0, sy0); ctx.lineTo(sx0 + ux * r * 0.9, sy0 + uy * r * 0.9);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    // aura de fúria (atrás do corpo)
    if (b.furia) {
      var au = aura(R, q), am = au.m * sc * (1 + Math.sin(t * 14) * 0.04);
      ctx.save(); ctx.rotate(t * 1.4); ctx.drawImage(au.c, -am, -am, am * 2, am * 2); ctx.restore();
    }

    ctx.scale(sx, sy);
    var alfa = fan > 0.05 ? Math.max(0.1, 1 - fan * 0.85) : 1;
    ctx.globalAlpha = alfa;
    var cb = corpoSk(cor, R, sk, q), mb = cb.m * sc;
    if (b.cache && !(b.flash > 0.02) && fan <= 0.05 && b.expressao !== "tonto") {
      if (b.faixa) faixaPontas(ctx, r, b);                  // pontas atrás da cabeça
      var cp = composto(b, cor, R, sk, pr, q, boch), mc = cp.m * sc;
      ctx.drawImage(cp.c, -mc, -mc, mc * 2, mc * 2);
    } else {
      if (b.faixa) faixaPontas(ctx, r, b);
      ctx.drawImage(cb.c, -mb, -mb, mb * 2, mb * 2);
      if (b.flash > 0.02) {                                 // dano: silhueta branca por cima
        ctx.globalAlpha = alfa * (b.flash > 1 ? 1 : b.flash);
        var wb = branco(cor, R, sk, q);
        ctx.drawImage(wb.c, -mb, -mb, mb * 2, mb * 2);
        ctx.globalAlpha = alfa;
      }
      if (b.faixa) faixaCorpo(ctx, r, b);
      if (!(b.flash > 0.85)) rosto(ctx, r, pr, b, boch);
    }
    if (ac !== "nenhum" && typeof ArteSkins !== "undefined" && typeof ArteSkins.acessorio === "function")      // acessório por cima do rosto (já no espaço escalado/amassado)
      ArteSkins.acessorio(ctx, ac, 0, 0, r, (b.olharX || 0) + (b.vira || 0) * 2.4, sx, sy, t, q);
    ctx.globalAlpha = 1;

    if (fan > 0.05) {                                       // fantasma: contorno tremido
      var n = 18, rr0 = r - 1;
      ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var a = i / n * PI2, rr = rr0 + Math.sin(a * 3 + t * 9) * r * 0.045 + Math.sin(a * 5 - t * 13) * r * 0.03;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(235,240,255,0.9)"; ctx.lineWidth = espessura(r); ctx.lineJoin = "round"; ctx.stroke();
    }
    if (b.congelado) {
      var gl = gelo(R, q), mg = gl.m * sc;
      ctx.drawImage(gl.c, -mg, -mg, mg * 2, mg * 2);
    }
    if (b.escudo) {
      var es = escudo(R, q), me = es.m * sc * (1 + Math.sin(t * 5) * 0.025);
      ctx.globalAlpha = 0.9 + Math.sin(t * 11) * 0.1;
      ctx.drawImage(es.c, -me, -me, me * 2, me * 2);
      ctx.globalAlpha = 1;
    }
    if (b.fogo) {                                           // 3 chamas na cabeça
      var cf = chama();
      for (var f = 0; f < 3; f++) {
        var ph = t * 9 + f * 2.1, hh = r * (f === 1 ? 1.15 : 0.82) * (1 + Math.sin(ph) * 0.14), ww = hh * 0.62;
        ctx.save(); ctx.translate((f - 1) * r * 0.55 + Math.sin(ph * 0.7) * r * 0.06, -r * 0.82 + (f === 1 ? -r * 0.04 : r * 0.1));
        ctx.rotate((f - 1) * 0.28 + Math.sin(ph * 0.8) * 0.1);
        ctx.drawImage(cf, -ww / 2, -hh * 0.94, ww, hh); ctx.restore();
      }
    }
    if (b.expressao === "tonto") {                          // estrelinhas girando em cima da cabeça
      var es2 = estrela(), ss = r * 0.34;
      for (var s2 = 0; s2 < 3; s2++) {
        var aa = t * 3.2 + s2 * PI2 / 3;
        ctx.save(); ctx.translate(Math.cos(aa) * r * 0.62, -r * 1.08 + Math.sin(aa) * r * 0.16); ctx.rotate(aa);
        ctx.drawImage(es2, -ss / 2, -ss / 2, ss, ss); ctx.restore();
      }
    }
    ctx.restore();
  }

  // ArteBolinha.paleta é extra (usada pela queda de braço)
  // corpoBase(cor, R, q): corpo clássico em cache (usado pelo ArteSkins para a skin "classico"); brilhoEsfera e espQ: idem
  return { desenhar: desenhar, sombra: sombra, paleta: paleta, corpoBase: corpo, brilhoEsfera: brilhoEsfera, espQ: espQ };
})();
