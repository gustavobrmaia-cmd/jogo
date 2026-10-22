"use strict";

// =========================
// ARTE DOS 15 CENÁRIOS (v19: cartoon arcade)
// Cada mapa: céu em faixas chapadas (cel), camadas de paisagem com cor dura e luz de borda, contorno nos planos de
// perto, plataformas grossas com contorno escuro, textura e luz em cima; detalhes vivos e baratos por quadro.
// VARIAÇÕES: cada mapa tem 2–3 climas/horários (dia, pôr do sol, noite, tempestade...) sorteados a cada rodada.
//  prerender(cen, largura, altura, manter) -> fundo fixo (refeito na rodada nova; "manter" = mesma variação)
//  desenharFundo(ctx, cen, est, cam)        -> o fundo com paralaxe leve; com a câmera em pé só a faixa da arena é
//                                              ampliada (em cima e embaixo vão retângulos chapados: bem mais barato)
//  desenharFundoAnimado / desenharPlataformas / desenharFrente / corDestaque (como antes)
// Desempenho: tudo que é caro fica pronto (prerender, sprites das plataformas e dos enfeites). Por quadro: drawImage
// de sprites, poucas formas simples. Nada de gradiente/blur/"lighter" por quadro. CONFIG.leve: menos enfeites.
// =========================
const ArteCenarios = (function() {
  const L = 1280, A = 720, TAU = Math.PI * 2, PAD = 24;   // PAD: folga dos lados do fundo (paralaxe)
  const TINTA = "#1a0d33";
  let S = null;                 // estado do cenário atual: { id, H, dy, top, bot, sp, pl, cen, V, px }
  const CEN = {};               // definição de cada cenário (preenchida abaixo)
  const DEST = {                // cor de destaque (título da rodada no HUD)
    campo: "#7be04a", gelo: "#8fe3ff", lua: "#c9d3ff", vulcao: "#ff7a2f", espaco: "#c08bff",
    laboratorio: "#4de3d0", dojo: "#ff8f66", cidade: "#ff4fd8", fliperama: "#ffd23f",
    floresta: "#6fe0a0", deserto: "#ffc15a", fabrica: "#ffb02e", oceano: "#4fc3f7",
    templo: "#4de0c0", castelo: "#b8a4ff"
  };
  let forcar = null;            // (teste) nome da variação a usar sempre

  // ---------- ajudantes gerais ----------
  function nova(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function rnd(s) { s = s >>> 0; return function() { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const _hx = {};
  function hex(h) { let v = _hx[h]; if (!v) { const n = parseInt(h.slice(1), 16); v = _hx[h] = [n >> 16, (n >> 8) & 255, n & 255]; } return v; }
  function mix(a, b, t) { const p = hex(a), q = hex(b); return "#" + [0, 1, 2].map(i => { const v = Math.max(0, Math.min(255, Math.round(p[i] + (q[i] - p[i]) * t))); return (v < 16 ? "0" : "") + v.toString(16); }).join(""); }
  function ca(h, a) { const v = hex(h); return "rgba(" + v[0] + "," + v[1] + "," + v[2] + "," + a + ")"; }
  function clar(h, t) { return mix(h, "#fff6e0", t); }        // luz quente
  function somb(h, t) { return mix(h, "#2a1458", t); }        // sombra puxada para roxo
  function lin(g, x0, y0, x1, y1, p) { const q = g.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < p.length; i++) q.addColorStop(p[i][0], p[i][1]); return q; }
  function rad(g, x, y, r, p, x2, y2, r2) { const q = g.createRadialGradient(x2 == null ? x : x2, y2 == null ? y : y2, r2 || 0, x, y, r); for (let i = 0; i < p.length; i++) q.addColorStop(p[i][0], p[i][1]); return q; }
  function rr(g, x, y, w, h, r, cont) { r = Math.max(0, Math.min(r, w / 2, h / 2)); if (!cont) g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function C(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
  function Cc(g, x, y, r) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
  function poli(g, p, cont) { if (!cont) g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); }
  function mod(a, b) { return ((a % b) + b) % b; }
  function spr(k, w, h, fn) { let c = S.sp[k]; if (!c) { c = nova(w, h); fn(c.getContext("2d"), w, h); S.sp[k] = c; } return c; }
  function ruido(seed) { const r = rnd(seed), v = []; for (let i = 0; i < 256; i++) v.push(r()); return function(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return v[i & 255] * (1 - u) + v[(i + 1) & 255] * u; }; }
  function fbm(n, x) { return n(x) * .55 + n(x * 2.1 + 7) * .3 + n(x * 4.3 + 3) * .15; }
  function leve() { return typeof CONFIG !== "undefined" && CONFIG.leve; }
  function tracar(g, cor, w) { g.lineWidth = w; g.strokeStyle = cor; g.lineJoin = "round"; g.lineCap = "round"; g.stroke(); }
  // brilho em tamanho fixo (cache por cor+diâmetro): por quadro só se desenha sem escala
  const _gl = {};
  function glowSpr(cor, d) { d = Math.max(4, Math.round(d / 4) * 4); const k = cor + d; let c = _gl[k]; if (!c) { c = nova(d, d); const g = c.getContext("2d"), r = d / 2; g.fillStyle = rad(g, r, r, r, [[0, ca(cor, 1)], [.25, ca(cor, .5)], [.6, ca(cor, .12)], [1, ca(cor, 0)]]); g.fillRect(0, 0, d, d); _gl[k] = c; } return c; }
  function glow(g, cor, x, y, d, a) { const c = glowSpr(cor, d); if (a != null && a < .99) g.globalAlpha = a; g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2)); g.globalAlpha = 1; }
  // halo em anéis chapados (sol, lua, luzes): círculos concêntricos com alfa caindo (estilo cel, sem degradê)
  function halo(g, x, y, r, cor, a, n) { n = n || 5; for (let i = n; i >= 1; i--) { g.fillStyle = ca(cor, a * (n - i + 1) / n * .45); C(g, x, y, r * i / n); g.fill(); } }

  // ---------- céu: faixas chapadas (cel), de cima (y0) até o horizonte (y1); acima de y0 fica a 1ª cor ----------
  function ceu(g, y0, y1, cores) {
    const n = cores.length, T = S.top, B = S.bot, h = (y1 - y0) / n;
    g.fillStyle = cores[0]; g.fillRect(-PAD, T - 2, L + PAD * 2, y0 - T + 3);
    for (let i = 0; i < n; i++) { g.fillStyle = cores[i]; g.fillRect(-PAD, Math.floor(y0 + i * h), L + PAD * 2, Math.ceil(h) + 1); }
    g.fillStyle = cores[n - 1]; g.fillRect(-PAD, Math.floor(y1), L + PAD * 2, B - y1 + 2);
  }
  // pontilhado de HQ (retícula) numa faixa: bolinhas que crescem para baixo
  function reticula(g, y0, y1, cor, a, passo) {
    passo = passo || 14; g.fillStyle = ca(cor, a);
    for (let y = y0, k = 0; y < y1; y += passo, k++) { const r = 0.6 + (y - y0) / (y1 - y0) * passo * .28; g.beginPath(); for (let x = -PAD + (k % 2) * passo / 2; x < L + PAD; x += passo) Cc(g, x, y, r); g.fill(); }
  }
  function estrelas(g, n, seed, y0, y1, cor, max) {
    const r = rnd(seed); g.fillStyle = cor || "#fff";
    for (let i = 0; i < n; i++) { g.globalAlpha = .35 + r() * .65; const s = (r() < .12 ? 2.6 : r() < .5 ? 1.8 : 1.2) * (max || 1); g.fillRect(Math.round(-PAD + r() * (L + PAD * 2)), Math.round(y0 + r() * (y1 - y0)), s, s); }
    g.globalAlpha = 1;
  }
  function brilho4(g, x, y, r, cor) { g.fillStyle = cor; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); }
  // sol / lua cartoon: disco com contorno, halo em anéis e meia-lua de luz
  function astro(g, x, y, r, base, luz, cont, haloCor, haloA) {
    if (haloCor) halo(g, x, y, r * 3.2, haloCor, haloA || .35, 6);
    C(g, x, y, r); g.fillStyle = base; g.fill();
    g.save(); C(g, x, y, r); g.clip(); C(g, x - r * .16, y - r * .18, r * .92); g.fillStyle = luz; g.fill(); g.restore();
    C(g, x, y, r); if (cont) tracar(g, cont, Math.max(2, r * .07));
    g.save(); g.beginPath(); g.arc(x, y, r * .7, Math.PI * 1.1, Math.PI * 1.42); tracar(g, "rgba(255,255,255,.75)", r * .14); g.restore();
  }
  function luaCrescente(g, x, y, r, cor, fundoCor) {
    halo(g, x, y, r * 3, cor, .22, 5);
    C(g, x, y, r); g.fillStyle = cor; g.fill();
    g.fillStyle = mix(cor, "#9aa0d8", .35); [[-.3, -.1, .2], [.25, .3, .14], [.1, -.4, .1]].forEach(q => { C(g, x + q[0] * r, y + q[1] * r, q[2] * r); g.fill(); });
    C(g, x, y, r); tracar(g, mix(cor, TINTA, .5), Math.max(2, r * .06));
    g.save(); g.beginPath(); g.arc(x, y, r * .72, Math.PI * 1.1, Math.PI * 1.4); tracar(g, "rgba(255,255,255,.8)", r * .12); g.restore();
  }
  // nuvem cartoon: bolas unidas, sombra dura embaixo (a forma deslocada) e contorno
  function nuvem(g, x, y, w, base, sombra, cont, lw) {
    const h = w * .32, bolas = [[-.32, .06, .22], [-.12, -.1, .3], [.13, -.15, .32], [.35, .02, .24], [0, .1, .28]];
    function forma(dx, dy) { g.beginPath(); bolas.forEach(b => Cc(g, x + dx + b[0] * w, y + dy + b[1] * h * 1.4, b[2] * h * 1.5)); rr(g, x + dx - .48 * w, y + dy, w * .96, h * .5, h * .25, true); }
    if (cont) { forma(0, 0); tracar(g, cont, (lw || 3) * 2); }
    forma(0, 0); g.fillStyle = sombra; g.fill();
    g.save(); forma(0, 0); g.clip(); forma(-w * .03, -h * .22); g.fillStyle = base; g.fill(); g.restore();
  }
  // linha de silhueta por ruído (colinas, dunas, cumes): devolve h(x)
  function perfil(seed, y, amp, esc) { const n = ruido(seed); return x => y - (fbm(n, x / esc) - .5) * 2 * amp; }
  // camada de terreno: preenche abaixo do perfil com base, faixa de luz no topo e contorno opcional
  function camada(g, o) {
    const h = o.h || perfil(o.seed, o.y, o.amp, o.esc), passo = o.passo || 10, bot = o.bot || S.bot;
    function cam() { g.beginPath(); g.moveTo(-PAD - 10, bot); for (let x = -PAD - 10; x <= L + PAD + 10; x += passo) g.lineTo(x, h(x)); g.lineTo(L + PAD + 10, bot); g.closePath(); }
    cam(); g.fillStyle = o.cor; g.fill();
    if (o.sombra) { g.save(); cam(); g.clip(); g.beginPath(); g.moveTo(-PAD - 10, bot); for (let x = -PAD - 10; x <= L + PAD + 10; x += passo) g.lineTo(x, h(x) + (o.faixa || 18)); g.lineTo(L + PAD + 10, bot); g.closePath(); g.fillStyle = o.sombra; g.fill(); g.restore(); }
    if (o.luz) { g.beginPath(); for (let x = -PAD - 10; x <= L + PAD + 10; x += passo) g[x === -PAD - 10 ? "moveTo" : "lineTo"](x, h(x) + 2.5); tracar(g, o.luz, o.luzW || 4); }
    if (o.cont) { g.beginPath(); for (let x = -PAD - 10; x <= L + PAD + 10; x += passo) g[x === -PAD - 10 ? "moveTo" : "lineTo"](x, h(x)); tracar(g, o.cont, o.contW || 3); }
    return h;
  }
  // cordilheira de picos com faces de luz e sombra (+ neve)
  function montanhas(g, o) {
    const r = rnd(o.seed), p = [], passo = o.passo;
    for (let x = -PAD - passo; x <= L + PAD + passo * 1.5; x += passo) { p.push([x + (r() - .5) * passo * .3, o.y - o.alt * (.55 + .45 * r())]); p.push([x + passo * (.45 + r() * .1), o.y - o.alt * (.1 + .25 * r())]); }
    function forma() { g.beginPath(); g.moveTo(-PAD - passo, o.bot); p.forEach(q => g.lineTo(q[0], q[1])); g.lineTo(L + PAD + passo * 1.5, o.bot); g.closePath(); }
    forma(); g.fillStyle = o.cor; g.fill();
    g.save(); forma(); g.clip();
    for (let i = 0; i < p.length - 1; i += 2) {
      const a = p[i], v = p[i + 1];
      g.fillStyle = o.sombra; poli(g, [a[0], a[1], v[0] + 2, v[1], v[0] + 2, o.bot, a[0] + (v[0] - a[0]) * .1, o.bot]); g.fill();
      if (o.neve) {
        const dx = v[0] - a[0], dy = v[1] - a[1], u = p[i - 1] || [a[0] - passo / 2, a[1] + 60], ux = a[0] - u[0], uy = u[1] - a[1], k = .28;
        g.fillStyle = o.neve; poli(g, [a[0], a[1] - 1, a[0] + dx * k, a[1] + dy * k, a[0] + dx * k * .5, a[1] + dy * k * .5 + 10, a[0], a[1] + 22, a[0] - ux * k * .5, a[1] + uy * k * .5 + 10, a[0] - ux * k, a[1] + uy * k]); g.fill();
        g.fillStyle = o.neveS || ca("#9ab0e0", .5); poli(g, [a[0], a[1] - 1, a[0] + dx * k, a[1] + dy * k, a[0] + dx * k * .5, a[1] + dy * k * .5 + 10, a[0], a[1] + 22]); g.fill();
      }
    }
    g.restore();
    if (o.cont) { forma(); tracar(g, o.cont, o.contW || 2.5); }
    return p;
  }
  // árvore redonda (pirulito) e pinheiro, com contorno
  function arvore(g, x, y, s, folha, folhaS, tronco, cont) {
    g.fillStyle = tronco; rr(g, x - s * .1, y - s * .9, s * .2, s * .92, s * .06); g.fill(); if (cont) tracar(g, cont, Math.max(1.5, s * .05));
    const bolas = [[0, -1.25, .55], [-.35, -1.0, .38], [.36, -1.02, .4]];
    function f(dx, dy) { g.beginPath(); bolas.forEach(b => Cc(g, x + b[0] * s + dx, y + b[1] * s + dy, b[2] * s)); }
    if (cont) { f(0, 0); tracar(g, cont, Math.max(2, s * .08)); }
    f(0, 0); g.fillStyle = folhaS; g.fill();
    g.save(); f(0, 0); g.clip(); f(-s * .08, -s * .1); g.fillStyle = folha; g.fill(); g.restore();
  }
  function pinheiro(g, x, y, s, folha, folhaS, cont, neve) {
    g.fillStyle = mix(folhaS, "#3a2030", .5); g.fillRect(x - s * .06, y - s * .2, s * .12, s * .2);
    for (let i = 0; i < 3; i++) {
      const yy = y - s * .15 - i * s * .3, w = s * (.42 - i * .1), top = yy - s * .45;
      poli(g, [x, top, x + w, yy, x - w, yy]); g.fillStyle = folhaS; g.fill();
      poli(g, [x, top, x - w, yy, x - w * .05, yy]); g.fillStyle = folha; g.fill();
      if (neve) { poli(g, [x, top, x + w * .35, top + (yy - top) * .4, x + w * .1, top + (yy - top) * .34, x - w * .12, top + (yy - top) * .45, x - w * .33, top + (yy - top) * .38]); g.fillStyle = neve; g.fill(); }
      if (cont) { poli(g, [x, top, x + w, yy, x - w, yy]); tracar(g, cont, Math.max(1.5, s * .035)); }
    }
  }

  // ---------- plataformas: blocos grossos com contorno, topo claro e base escura ----------
  // pal = { topo, base, sombra, luz, cont }; o.raio, o.topoH, o.extra(g) (dentro do recorte)
  function bloco(g, x, y, w, h, pal, o) {
    o = o || {};
    const rad2 = o.raio == null ? Math.min(12, h * .4) : o.raio, th = o.topoH == null ? Math.min(12, Math.max(5, h * .32)) : o.topoH, lw = o.lw || 4;
    rr(g, x, y, w, h, rad2); g.fillStyle = pal.base; g.fill();
    g.save(); rr(g, x, y, w, h, rad2); g.clip();
    g.fillStyle = pal.sombra; g.fillRect(x, y + h - Math.max(4, h * .26), w, h);
    if (o.extra) o.extra(g);
    g.fillStyle = pal.topo; g.fillRect(x, y, w, th);
    g.fillStyle = ca(TINTA, .28); g.fillRect(x, y + th, w, 2.5);
    if (pal.luz) { g.fillStyle = pal.luz; rr(g, x + 8, y + 2.5, Math.min(w * .3, 90), Math.max(2.5, th * .32), 2); g.fill(); }
    g.restore();
    rr(g, x + lw / 2, y + lw / 2, w - lw, h - lw, Math.max(0, rad2 - lw / 2)); tracar(g, pal.cont || TINTA, lw);
  }
  // prancha fina (dá para subir por baixo e o tiro passa): mais clara, com frestas e sombra pequena
  function prancha(g, w, h, pal, o) {
    o = o || {};
    bloco(g, 0, 0, w, h, pal, { raio: Math.min(9, h * .45), topoH: Math.min(8, h * .4), lw: o.lw || 3.5, extra: function(g) {
      g.fillStyle = ca(TINTA, .3);
      const n = Math.max(2, Math.round(w / (o.tabua || 46)));
      for (let k = 1; k < n; k++) { const xx = Math.round(k * w / n); g.fillRect(xx - 1, 0, 2.5, h); }
      if (o.extra) o.extra(g);
    } });
  }
  function sombraPlat(g, w, y, a) { g.fillStyle = ca(TINTA, a == null ? .22 : a); g.beginPath(); g.ellipse(w / 2, y, w * .44, 5, 0, 0, TAU); g.fill(); }
  // tufos de grama com contorno na borda de cima
  function grama(g, x, y, w, cor, corS, seed, alt) {
    const r = rnd(seed); alt = alt || 10;
    g.beginPath(); g.moveTo(x - 2, y + 4);
    for (let i = 0; i <= w; i += 9) { const hh = alt * (.5 + r() * .7); g.lineTo(x + i + 2, y - hh); g.lineTo(x + i + 5, y + 2); }
    g.lineTo(x + w + 2, y + 4); g.lineTo(x + w + 2, y + alt * .8); g.lineTo(x - 2, y + alt * .8); g.closePath();
    g.fillStyle = corS; g.fill();
    g.save(); g.clip(); g.fillStyle = cor; g.fillRect(x - 4, y - alt * 2, w + 8, alt * 2 + 3); g.restore();
    g.beginPath(); g.moveTo(x - 2, y + alt * .8); const r2 = rnd(seed);
    for (let i = 0; i <= w; i += 9) { const hh = alt * (.5 + r2() * .7); g.lineTo(x + i + 2, y - hh); g.lineTo(x + i + 5, y + 2); }
    g.lineTo(x + w + 2, y + alt * .8); tracar(g, TINTA, 2.5);
  }
  function rebite(g, x, y, r, c) { C(g, x, y, r); g.fillStyle = c; g.fill(); tracar(g, TINTA, 1.5); g.fillStyle = "rgba(255,255,255,.7)"; C(g, x - r * .3, y - r * .3, r * .35); g.fill(); }
  function listrasAlerta(g, x, y, w, h, c0, c1, larg) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = c0; g.fillRect(x, y, w, h); g.fillStyle = c1;
    for (let i = -h; i < w + h; i += larg * 2) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + larg, y + h); g.lineTo(x + i + larg + h, y); g.lineTo(x + i + h, y); g.fill(); }
    g.restore();
  }

  // =====================================================================================
  // CAMPO — colinas, moinho, fazenda (dia | pôr do sol | noite)
  // =====================================================================================
  CEN.campo = {
    vars: {
      dia:   { ceu: ["#3d8bff", "#55a2ff", "#6fb9ff", "#8ccfff", "#acdfff", "#d4f0ff"], astro: "sol", k: 0, tint: "#ffffff", estrelas: 0, janela: 0, haloA: .3 },
      tarde: { ceu: ["#4a2f8f", "#7b3f9c", "#c2508f", "#f2747a", "#ffa070", "#ffd08a"], astro: "sol", k: .3, tint: "#ff7a6a", estrelas: 20, janela: .5, haloA: .45, solY: 470 },
      noite: { ceu: ["#0b0b2e", "#121647", "#1b2260", "#242e78", "#2e3c8c", "#3b4c9c"], astro: "lua", k: .55, tint: "#1b2a7a", estrelas: 160, janela: 1, haloA: .25 }
    },
    acima: V => V.ceu[0],
    abaixo: () => ["#7a4a2e", "#5e3722", "#46281a"],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 520, V.ceu);
      if (V.estrelas) estrelas(g, V.estrelas, 7, S.top, 380, "#ffffff", 1);
      reticula(g, 400, 520, V.ceu[V.ceu.length - 1], .25, 16);
      if (V.astro === "sol") astro(g, 250, V.solY || 150, 48, "#ffe45c", "#fff6b0", T("#f5a524"), "#fff0a0", V.haloA);
      else luaCrescente(g, 250, 140, 40, "#f2f0ff");
      // nuvens grandes de fundo
      [[820, 120, 230], [1080, 220, 170], [470, 250, 140], [100, 340, 160]].forEach(q => nuvem(g, q[0], q[1], q[2], T("#ffffff", .8), T("#d7e6ff", .8), T("#b4c8f0", .8), 2.5));
      // cordilheira azulada
      montanhas(g, { y: 470, alt: 150, passo: 200, seed: 8, cor: T("#8fb2e8"), sombra: T("#7092d0"), neve: T("#f4f8ff", .6), bot: 620, cont: T("#5a74b8"), contW: 2 });
      // colinas distantes com moinho
      const h1 = camada(g, { seed: 21, y: 516, amp: 30, esc: 230, cor: T("#8fdc7a"), sombra: T("#74c46a"), luz: T("#d9ff9a", .7), bot: 680, cont: T("#4f9a52"), contW: 2.5 });
      const mx = 1190, my = h1(mx) + 4;
      g.fillStyle = T("#fff0dc"); poli(g, [mx - 16, my, mx + 16, my, mx + 10, my - 66, mx - 10, my - 66]); g.fill(); tracar(g, TINTA, 2.5);
      g.fillStyle = T("#ff5a5a"); poli(g, [mx - 15, my - 64, mx + 15, my - 64, mx, my - 88]); g.fill(); tracar(g, TINTA, 2.5);
      g.fillStyle = T("#8a5a3a"); rr(g, mx - 5, my - 18, 10, 18, 3); g.fill(); tracar(g, TINTA, 2);
      S.moinho = { x: mx, y: my - 62 };
      // colina média com árvores e celeiro
      const h2 = camada(g, { seed: 33, y: 566, amp: 28, esc: 170, cor: T("#6fd05a"), sombra: T("#55b64c"), luz: T("#e0ff8a", .7), bot: 700, cont: TINTA, contW: 3 });
      [[90, 20], [150, 14], [330, 18], [430, 13], [820, 15], [905, 21], [1110, 16], [1240, 14]].forEach(q => arvore(g, q[0], h2(q[0]) + 8, q[1] * 2.2, T("#8fe85a"), T("#4caf44"), T("#9a6038"), TINTA));
      const bx = 660, by = h2(bx) + 6;
      g.fillStyle = T("#e8484a"); g.fillRect(bx - 32, by - 36, 64, 36); g.fillStyle = T("#c43436"); g.fillRect(bx + 8, by - 36, 24, 36);
      g.strokeStyle = TINTA; g.lineWidth = 2.5; g.strokeRect(bx - 32, by - 36, 64, 36);
      g.fillStyle = T("#8b2a36"); poli(g, [bx - 40, by - 34, bx, by - 62, bx + 40, by - 34]); g.fill(); tracar(g, TINTA, 2.5);
      g.fillStyle = T("#fff4e4"); g.fillRect(bx - 9, by - 22, 18, 22); g.strokeRect(bx - 9, by - 22, 18, 22);
      g.beginPath(); g.moveTo(bx - 9, by - 22); g.lineTo(bx + 9, by); g.moveTo(bx + 9, by - 22); g.lineTo(bx - 9, by); tracar(g, T("#c43436"), 2);
      if (V.janela) { g.fillStyle = "#ffe066"; rr(g, bx - 26, by - 30, 10, 10, 2); g.fill(); rr(g, bx + 16, by - 30, 10, 10, 2); g.fill(); halo(g, bx - 21, by - 25, 22, "#ffe066", .25 * V.janela, 3); }
      // cerca
      g.fillStyle = T("#e8c890"); for (let x = 510; x < 620; x += 14) { const y = h2(x) + 6; rr(g, x - 2.5, y - 20, 5, 20, 2); g.fill(); tracar(g, TINTA, 1.5); }
      g.fillStyle = T("#f2d8a8"); g.fillRect(510, h2(510) - 14, 110, 3.5); g.fillRect(510, h2(510) - 7, 110, 3.5);
      // colina da frente com flores e arbustos
      const h3 = camada(g, { seed: 47, y: 630, amp: 16, esc: 130, cor: T("#52b84a"), sombra: T("#3f9e40"), luz: T("#c8ff7a", .7), bot: 740, cont: TINTA, contW: 3 });
      const r = rnd(77);
      for (let i = 0; i < 60; i++) { const x = r() * L, y = h3(x) + 10 + r() * 24, cor = ["#ff6f91", "#ffffff", "#ffd54a", "#ff9a5a"][i % 4]; g.fillStyle = T(cor, .6); C(g, x, y, 2.6 + r() * 1.6); g.fill(); }
      [[40, 22], [280, 18], [1000, 20], [1240, 24]].forEach(q => { const y = h3(q[0]) + 14; arvore(g, q[0], y + q[1] * .9, q[1] * 1.3, T("#7fe05a"), T("#3f9e40"), T("#7a4a2e"), TINTA); });
    },
    pad: p => p.h > 40 ? [0, 16, 0, 0] : [6, 14, 6, 26],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .6 : k) * V.k), w = p.w, h = p.h;
      if (h > 40) {   // chão: terra em camadas com grama
        g.fillStyle = T("#9a6038"); g.fillRect(0, 0, w, h + 40);
        g.fillStyle = T("#7a4a2e"); for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(0, 30 + k * 16); for (let x = 0; x <= w; x += 20) g.lineTo(x, 30 + k * 16 + Math.sin(x / 70 + k * 2) * 4); g.lineTo(w, h + 40); g.lineTo(0, h + 40); g.closePath(); g.fill(); g.fillStyle = T(["#6a3f26", "#5e3722", "#4e2c1c"][k]); }
        const r = rnd(9); for (let k = 0; k < 40; k++) { const x = r() * w, y = 22 + r() * (h - 14), s = 3 + r() * 5; g.fillStyle = T("#c08a5a"); g.beginPath(); g.ellipse(x, y, s, s * .6, 0, 0, TAU); g.fill(); tracar(g, ca(TINTA, .5), 1.2); }
        g.fillStyle = T("#5ed04a"); g.fillRect(0, 0, w, 12); g.fillStyle = T("#3fa63c"); g.fillRect(0, 10, w, 5);
        grama(g, 0, 2, w, T("#8ff060"), T("#4cb444"), 4, 11);
        g.fillStyle = TINTA; g.fillRect(0, 14, w, 3);
        return;
      }
      sombraPlat(g, w, h + 18);
      // canteiro flutuante: terra com grama em cima e raízes embaixo
      const pal = { topo: T("#6ad84e"), base: T("#a8693e"), sombra: T("#7e4a2c"), luz: "rgba(255,255,255,.4)" };
      prancha(g, w, h, pal, { tabua: 54, extra: function(g) { const r = rnd(60 + i); for (let k = 0; k < w / 26; k++) { g.fillStyle = T("#c88a5a"); C(g, r() * w, h * .55 + r() * h * .3, 2 + r() * 2); g.fill(); } } });
      grama(g, 3, 3, w - 6, T("#8ff060"), T("#4cb444"), 50 + i, 8);
      g.strokeStyle = T("#7e4a2c"); g.lineWidth = 2.5; g.lineCap = "round"; const r = rnd(80 + i);
      for (let k = 0; k < w / 50; k++) { const x = 14 + r() * (w - 28); g.beginPath(); g.moveTo(x, h - 2); g.quadraticCurveTo(x + 6, h + 8, x + 2 - r() * 6, h + 14 + r() * 8); g.stroke(); }
    },
    fundo: function(g, est, t, V) {
      // pás do moinho girando (6 quadros prontos), nuvens à deriva, pássaros (dia/tarde) ou vagalumes (noite)
      const m = S.moinho;
      if (m) {
        const fr = [0, 1, 2, 3, 4, 5].map(k => spr("pas" + k, 96, 96, function(c) { c.translate(48, 48); c.rotate(k / 6 * Math.PI / 2); for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2); c.fillStyle = mix("#fff0dc", V.tint, V.k * .6); c.beginPath(); c.rect(-4, -44, 8, 40); c.fill(); tracar(c, TINTA, 2); c.fillStyle = mix("#ffd8a0", V.tint, V.k * .6); c.beginPath(); c.rect(-1, -44, 12, 30); c.fill(); tracar(c, TINTA, 2); c.restore(); } C(c, 0, 0, 6); c.fillStyle = "#8a5a3a"; c.fill(); tracar(c, TINTA, 2); }));
        g.drawImage(fr[Math.floor(mod(t * 7, 6))], m.x - 48, m.y - 48);
      }
      const nv = spr("nvC", 220, 90, c => nuvem(c, 110, 50, 180, mix("#ffffff", V.tint, V.k * .8), mix("#dce8ff", V.tint, V.k * .8), mix("#b4c8f0", V.tint, V.k * .8), 2.5));
      const px = S.px || 0;
      [[0, 60, 7], [600, 170, 5], [300, 290, 9]].forEach(q => g.drawImage(nv, Math.round(mod(q[0] + t * q[2], L + 260) - 230 + px * .5), q[1]));
      if (V.astro === "lua") {
        const vg = spr("vagaC", 16, 16, c => { C(c, 8, 8, 7); c.fillStyle = "rgba(255,240,120,.35)"; c.fill(); C(c, 8, 8, 3); c.fillStyle = "#fff6a0"; c.fill(); });
        const n = leve() ? 10 : 22;
        for (let k = 0; k < n; k++) { const x = (k * 233) % 1240 + 20 + Math.sin(t * .7 + k * 1.7) * 30, y = 420 + (k * 97) % 220 + Math.sin(t * .9 + k * 2.3) * 16; g.globalAlpha = .3 + .7 * Math.max(0, Math.sin(t * 2 + k * 2.9)); g.drawImage(vg, Math.round(x - 8), Math.round(y - 8)); }
        g.globalAlpha = 1;
      } else {
        const ab = [0, 1].map(k => spr("passC" + k, 28, 16, c => { c.beginPath(); if (k) { c.moveTo(2, 4); c.quadraticCurveTo(8, 13, 14, 9); c.quadraticCurveTo(20, 13, 26, 4); } else { c.moveTo(2, 12); c.quadraticCurveTo(8, 3, 14, 9); c.quadraticCurveTo(20, 3, 26, 12); } tracar(c, TINTA, 3); }));
        for (let k = 0; k < 3; k++) g.drawImage(ab[Math.floor(t * 3 + k) % 2], Math.round(mod(t * 40 + k * 60, L + 200) - 100 - k * 30), Math.round(140 + k * 26 + Math.sin(t * 1.3 + k) * 10));
      }
    }
  };

  // =====================================================================================
  // genérico (enquanto um mapa não tem arte própria): céu, colinas e blocos simples
  // =====================================================================================
  const GENERICO = {
    vars: { padrao: { ceu: ["#2a1458", "#3a1d78", "#4b2a92", "#5f3aa8"], k: 0, tint: "#ffffff" } },
    acima: V => V.ceu[0], abaixo: () => ["#2a1458", "#1f0f44"],
    pre: function(g, V) { ceu(g, 0, 560, V.ceu); camada(g, { seed: 3, y: 600, amp: 30, esc: 200, cor: "#5a3aa0", sombra: "#4a2c8a", cont: TINTA, contW: 3, bot: 760 }); },
    pad: () => [6, 6, 6, 18],
    plat: function(g, p) { sombraPlat(g, p.w, p.h + 10); bloco(g, 0, 0, p.w, p.h, { topo: "#b8a8ff", base: "#7a64d8", sombra: "#5a46b8", luz: "rgba(255,255,255,.5)" }); }
  };

  // =========================
  // API pública
  // =========================
  function defDe(cen) { return CEN[cen.id] || GENERICO; }
  function iniciar(cen, H) {
    if (!S || S.id !== cen.id || S.H !== H) {
      const dy = (H - A) / 2;
      S = { id: cen.id, H: H, dy: dy, top: -dy, bot: A + dy, sp: {}, pl: {}, cen: cen, V: S && S.id === cen.id ? S.V : null, vn: S && S.id === cen.id ? S.vn : null, px: 0 };
    }
    if (!S.V) {
      const d = defDe(cen), nomes = Object.keys(d.vars);
      const n = forcar && d.vars[forcar] ? forcar : nomes[Math.floor(Math.random() * nomes.length)];
      S.vn = n; S.V = d.vars[n];
    }
    return S;
  }
  // sprite de uma plataforma (com folga para detalhes que passam da caixa)
  function spritePlat(p, i, d) {
    const k = i + "_" + p.w + "_" + p.h; let e = S.pl[k];
    if (!e) {
      const pad = d.pad ? d.pad(p) : [14, 14, 14, 14], c = nova(p.w + pad[0] + pad[2], p.h + pad[1] + pad[3]), g = c.getContext("2d");
      g.translate(pad[0], pad[1]); d.plat(g, p, i, S.V); e = S.pl[k] = { c: c, l: pad[0], t: pad[1] };
    }
    return e;
  }
  // "aquece" os sprites animados (cria os quadros pré-renderizados) num canvas minúsculo, para o 1º quadro não engasgar
  function aquecer(cen, d, altura) {
    const g = nova(8, 8).getContext("2d");
    const est = { t: 0, largura: L, altura: altura, deslocY: S.dy, lavaY: 650, gravidade: 1, avisoInversao: 1, vento: .6, portais: cen.portais, luzes: [{ x: 300, y: 400, r: 175 }, { x: 900, y: 400, r: 175 }],
      bumpers: (cen.bumpers || []).map(function(b) { return { x: b.x, y: b.y, r: b.r, flash: 1 }; }) };
    for (let k = 0; k < 2; k++) {
      const t = k * .73;
      if (d.fundo) d.fundo(g, est, t, S.V);
      if (d.anim) cen.plataformas.forEach(function(p, i) { d.anim(g, p, i, est, t, S.V); });
      if (d.extra) d.extra(g, est, t, S.V);
      if (d.frente) d.frente(g, est, t, S.V);
    }
  }
  function prerender(cen, largura, altura, manter) {
    if (!manter || !S || S.id !== cen.id) S = null;
    iniciar(cen, altura);
    S.sp = {}; S.pl = {};
    const c = nova(L + PAD * 2, altura), g = c.getContext("2d"), d = defDe(cen);
    g.translate(PAD, S.dy);
    d.pre(g, S.V, cen);
    cen.plataformas.forEach(function(p, i) { spritePlat(p, i, d); });
    aquecer(cen, d, altura);
    if (d.aquecer) d.aquecer(cen, S.V);
    S.fundo = c;
    return c;
  }
  // fundo com paralaxe leve. cam = { z, x, oy, cam (true com a câmera em pé), lento } (desenho.js)
  // Contexto já está no espaço do mundo (câmera aplicada); o fundo é desenhado no mundo, um pouco "atrasado".
  function desenharFundo(ctx, cen, est, cam, fundo) {
    iniciar(cen, est.altura);
    const d = defDe(cen), dy = S.dy, f = fundo || S.fundo;
    if (!f) return;
    let bx;
    if (cam && cam.cam) bx = d.fixo ? 0 : cam.x * .25;                       // em pé: o fundo anda 75% do mundo
    else {                                                                    // deitado: segue a luta de leve
      const alvo = d.fixo || !cam || cam.mx == null ? 0 : Math.max(-PAD + 2, Math.min(PAD - 2, -(cam.mx - L / 2) * .03));
      S.px += (alvo - S.px) * .04; bx = Math.round(S.px);
    }
    if (cam && cam.cam) {
      // em pé com câmera: só a faixa da arena (mundo 0..720) é ampliada; em cima e embaixo vão retângulos chapados
      const z = cam.z, x0 = cam.x - 4, x1 = cam.x + L / z + 4, topoMundo = -cam.oy / z - 8, baseMundo = (est.altura - cam.oy) / z + 8;
      ctx.fillStyle = d.acima ? d.acima(S.V) : "#2a1458"; ctx.fillRect(x0, topoMundo, x1 - x0, -topoMundo + 2);
      const m = 40;   // um pouco de céu acima de 0
      ctx.drawImage(f, 0, dy - m, L + PAD * 2, A + m, bx - PAD, -m, L + PAD * 2, A + m);
      const ab = d.abaixo ? d.abaixo(S.V) : ["#1f0f44"], hh = baseMundo - A;
      if (hh > 0) for (let i = 0; i < ab.length; i++) { ctx.fillStyle = ab[i]; const y = A + Math.round(hh * i / ab.length); ctx.fillRect(x0, y - (i ? 0 : 1), x1 - x0, Math.ceil(hh / ab.length) + 2); }
      S.px = bx;
    } else {
      ctx.drawImage(f, bx - PAD, -dy);
      S.px = bx;
    }
  }
  function desenharFundoAnimado(ctx, cen, est, t) { iniciar(cen, est.altura); const d = defDe(cen); if (d.fundo) d.fundo(ctx, est, t, S.V); }
  function desenharPlataformas(ctx, cen, plataformas, est, t) {
    iniciar(cen, est.altura); const d = defDe(cen); S.plats = plataformas;
    for (let i = 0; i < plataformas.length; i++) {
      const p = plataformas[i], e = spritePlat(p, i, d);
      ctx.drawImage(e.c, Math.round(p.x - e.l), Math.round(p.y - e.t));
      if (d.anim) d.anim(ctx, p, i, est, t, S.V);
    }
    if (d.extra) d.extra(ctx, est, t, S.V);
  }
  function desenharFrente(ctx, cen, est, t) { iniciar(cen, est.altura); const d = defDe(cen); if (d.frente) d.frente(ctx, est, t, S.V); }
  function corDestaque(id) { return DEST[id] || "#ffd43b"; }
  function variacao() { return S ? S.vn : null; }
  function forcarVariacao(n) { forcar = n || null; }

  return { prerender: prerender, desenharFundo: desenharFundo, desenharFundoAnimado: desenharFundoAnimado, desenharPlataformas: desenharPlataformas,
    desenharFrente: desenharFrente, corDestaque: corDestaque, variacao: variacao, forcarVariacao: forcarVariacao };
})();
