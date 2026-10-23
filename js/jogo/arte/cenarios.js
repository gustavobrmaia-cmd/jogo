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

  // ---------- mais ajudantes (mapas do lote 2 em diante) ----------
  function vg(g, y0, y1, c0, c1) { return lin(g, 0, y0, 0, y1, [[0, c0], [1, c1]]); }
  // névoa em faixas chapadas (alfa subindo de y0 para y1)
  function bruma(g, y0, y1, cor, a, n) { n = n || 4; const h = (y1 - y0) / n; for (let i = 0; i < n; i++) { g.fillStyle = ca(cor, a * (i + 1) / n); g.fillRect(-PAD, Math.round(y0 + i * h), L + PAD * 2, Math.ceil(h) + 1); } }
  // rocha arredondada e irregular (superelipse com cantos moles)
  function formaRocha(g, x, y, w, h, seed, jag) {
    const r = rnd(seed), n = 16, cx = x + w / 2, cy = y + h / 2, p = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + .2, c = Math.cos(a), s = Math.sin(a), k = 1 - (jag == null ? .1 : jag) * r(); p.push(cx + Math.sign(c) * Math.pow(Math.abs(c), .55) * w / 2 * k, cy + Math.sign(s) * Math.pow(Math.abs(s), .55) * h / 2 * k); }
    const m = i => { const a = i % n, b = (i + 1) % n; return [(p[a * 2] + p[b * 2]) / 2, (p[a * 2 + 1] + p[b * 2 + 1]) / 2]; };
    g.beginPath(); const s0 = m(n - 1); g.moveTo(s0[0], s0[1]);
    for (let i = 0; i < n; i++) { const q = m(i); g.quadraticCurveTo(p[i * 2], p[i * 2 + 1], q[0], q[1]); }
    g.closePath();
  }
  // rocha cartoon: sombra dura embaixo-direita, corpo, luz em meia-lua em cima-esquerda e contorno grosso
  function rocha(g, x, y, w, h, pal, seed, o) {
    o = o || {};
    formaRocha(g, x, y, w, h, seed, o.jag); g.fillStyle = pal.sombra; g.fill();
    g.save(); formaRocha(g, x, y, w, h, seed, o.jag); g.clip();
    formaRocha(g, x - w * .07, y - h * .12, w, h, seed, o.jag); g.fillStyle = pal.base; g.fill();
    if (pal.luz) { g.fillStyle = pal.luz; g.beginPath(); g.ellipse(x + w * .3, y + h * .2, w * .26, h * .12, -.25, 0, TAU); g.fill(); }
    if (o.extra) o.extra(g);
    g.restore();
    formaRocha(g, x, y, w, h, seed, o.jag); tracar(g, pal.cont || TINTA, o.lw || 3.5);
  }
  // cratera: borda clara embaixo, fundo escuro e contorno fino
  function cratera(g, x, y, rx, ry, base, escura) {
    g.fillStyle = clar(base, .35); g.beginPath(); g.ellipse(x, y + ry * .25, rx, ry, 0, 0, TAU); g.fill();
    g.fillStyle = escura; g.beginPath(); g.ellipse(x, y, rx * .9, ry * .82, 0, 0, TAU); g.fill();
    g.fillStyle = base; g.beginPath(); g.ellipse(x + rx * .12, y + ry * .2, rx * .7, ry * .55, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(x, y + ry * .1, rx, ry * 1.05, 0, 0, TAU); tracar(g, ca(TINTA, .55), 1.6);
  }
  // contorno "por baixo": traça todas as formas com o dobro da largura e depois pinta por cima (só sobra a borda de fora)
  function blobs(g, lista, cor, lw) {
    g.beginPath(); lista.forEach(b => Cc(g, b[0], b[1], b[2])); tracar(g, TINTA, lw * 2);
    g.beginPath(); lista.forEach(b => Cc(g, b[0], b[1], b[2])); g.fillStyle = cor; g.fill();
  }
  // neve fofa por cima de uma plataforma (bolotas com contorno por fora)
  function neveTopo(g, x, y, w, cor, corS, seed) {
    const r = rnd(seed), b = [];
    for (let i = 4; i < w - 2; i += 13 + r() * 9) b.push([x + i, y + 3 - r() * 2, 6 + r() * 4]);
    g.save(); g.beginPath(); g.rect(x - 8, y - 20, w + 16, 30); g.clip();
    g.beginPath(); b.forEach(q => Cc(g, q[0], q[1], q[2])); rr(g, x + 1, y - 1, w - 2, 9, 4, true); tracar(g, TINTA, 5);
    g.beginPath(); b.forEach(q => Cc(g, q[0], q[1], q[2])); rr(g, x + 1, y - 1, w - 2, 9, 4, true); g.fillStyle = corS; g.fill();
    g.beginPath(); b.forEach(q => Cc(g, q[0] - 1.5, q[1] - 2, q[2] * .8)); g.fillStyle = cor; g.fill();
    g.restore();
  }
  function flocoSpr(k, r, a) { return spr(k, r * 2 + 2, r * 2 + 2, function(g) { g.fillStyle = rad(g, r + 1, r + 1, r, [[0, "rgba(255,255,255," + a + ")"], [.55, "rgba(255,255,255," + a * .8 + ")"], [1, "rgba(255,255,255,0)"]]); g.fillRect(0, 0, r * 2 + 2, r * 2 + 2); }); }
  function cristal(g, x, y, s, c0, c1, c2) {
    g.save(); g.translate(x, y); g.scale(s, s);
    [[-10, 0, -4, -34, 2, 0, c1], [0, 0, 8, -22, 14, 0, c0], [-16, 0, -15, -18, -6, 0, c2]].forEach(q => { poli(g, q.slice(0, 6)); g.fillStyle = q[6]; g.fill(); tracar(g, TINTA, 2.5 / s); });
    g.fillStyle = "rgba(255,255,255,.8)"; poli(g, [-8, -4, -4, -30, -3, -4]); g.fill();
    g.restore();
  }
  function igloo(g, x, y, s, aceso) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (aceso) halo(g, 0, -8, 70, "#ffcf70", .3, 4);
    g.beginPath(); g.moveTo(-46, 0); g.arc(0, 0, 46, Math.PI, 0); g.closePath(); g.fillStyle = "#cfe4fa"; g.fill();
    g.save(); g.clip(); g.fillStyle = "#ffffff"; C(g, -8, -8, 44); g.fill();
    g.strokeStyle = "rgba(90,120,190,.45)"; g.lineWidth = 2;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(0, 0, k * 12, Math.PI, 0); g.stroke(); }
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 11, -42); g.lineTo(k * 14 + 4, 0); g.stroke(); }
    g.restore();
    g.beginPath(); g.moveTo(-46, 0); g.arc(0, 0, 46, Math.PI, 0); g.closePath(); tracar(g, TINTA, 3.5);
    g.beginPath(); g.moveTo(-13, 0); g.lineTo(-13, -10); g.arc(0, -10, 13, Math.PI, 0); g.lineTo(13, 0); g.closePath(); g.fillStyle = aceso ? "#ffc761" : "#3a4a8a"; g.fill(); tracar(g, TINTA, 3);
    if (aceso) { g.fillStyle = "#fff0b8"; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-6, -10); g.arc(0, -10, 6, Math.PI, 0); g.lineTo(6, 0); g.fill(); }
    g.restore();
  }

  // =====================================================================================
  // GELO — serra nevada, geleira, pinheiros e iglu (aurora | dia claro | nevasca)
  // =====================================================================================
  CEN.gelo = {
    vars: {
      aurora:  { ceu: ["#0b1040", "#121a58", "#1a2a74", "#24408e", "#3460a8", "#5a88c4"], k: .35, tint: "#26388e", estrelas: 150, aurora: 1, astro: "lua", neve: 50 },
      dia:     { ceu: ["#3c9cff", "#56acff", "#72bdff", "#90ceff", "#b2e0ff", "#daf2ff"], k: 0, tint: "#ffffff", estrelas: 0, astro: "sol", neve: 26 },
      nevasca: { ceu: ["#454a80", "#555c92", "#666ea4", "#7a82b4", "#8e96c2", "#a6aed2"], k: .32, tint: "#6c74ac", estrelas: 0, astro: null, neve: 100, bruma: .45, vento: 1 }
    },
    acima: V => V.ceu[0],
    abaixo: V => [mix("#5aa6e6", V.tint, V.k * .5), mix("#3f84d0", V.tint, V.k * .5), mix("#2f64b0", V.tint, V.k * .5)],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 520, V.ceu);
      if (V.estrelas) estrelas(g, V.estrelas, 4, S.top, 330, "#e8f1ff");
      if (V.aurora) [[170, "#2dffb0", .45, 1.1, 0], [240, "#4de0ff", .32, .8, 2.4], [130, "#ff7ad9", .26, 1.4, 4.1]].forEach(q => {
        for (let x = -PAD; x < L + PAD; x += 8) {
          const yy = q[0] + Math.sin(x / 190 * q[3] + q[4]) * 46 + Math.sin(x / 71 + q[4]) * 10, hh = 140 + Math.sin(x / 130 + q[4] * 2) * 50;
          g.fillStyle = lin(g, 0, yy - hh, 0, yy + 20, [[0, ca(q[1], 0)], [.78, ca(q[1], q[2])], [.92, ca("#ffffff", q[2] * .7)], [1, ca(q[1], 0)]]); g.fillRect(x, yy - hh, 8, hh + 20);
        }
      });
      if (V.astro === "sol") astro(g, 1010, 130, 44, "#fff1a8", "#fffbe0", "#f5b524", "#fff6c0", .35);
      else if (V.astro === "lua") luaCrescente(g, 300, 130, 32, "#f2f4ff");
      if (V.astro !== "lua") [[260, 110, 200], [700, 190, 160], [1180, 250, 150]].forEach(q => nuvem(g, q[0], q[1], q[2], T("#ffffff", .7), T("#dbe8ff", .7), T("#a8bce8", .7), 2.5));
      montanhas(g, { y: 470, alt: 200, passo: 230, seed: 3, cor: T("#a4b8f2"), sombra: T("#7488d4"), neve: T("#ffffff", .4), neveS: ca("#8aa0e0", .6), bot: 620, cont: T("#5464b0"), contW: 2.5 });
      if (V.bruma) bruma(g, 330, 520, "#c8d0f0", V.bruma);
      montanhas(g, { y: 548, alt: 120, passo: 150, seed: 14, cor: T("#a8e4ff"), sombra: T("#6cb8ec"), neve: "#ffffff", neveS: ca("#9ad0f0", .6), bot: 680, cont: T("#3a78c0"), contW: 3 });
      const r = rnd(9);
      const h2 = camada(g, { seed: 12, y: 600, amp: 14, esc: 150, cor: T("#e4f4ff"), sombra: T("#b8dcf6"), luz: "#ffffff", bot: 720, cont: TINTA, contW: 3 });
      for (let x = -10; x < L + 20; x += 46 + r() * 60) { const s = 54 + r() * 40; pinheiro(g, x, h2(x) + 6, s, T("#4aa8bc"), T("#2c6a90"), TINTA, "#ffffff"); }
      if (V.bruma) bruma(g, 480, 640, "#d8e0f8", V.bruma * .6);
      const h3 = camada(g, { seed: 6, y: 640, amp: 12, esc: 160, cor: T("#f6fcff", .5), sombra: T("#c4e2f8", .5), luz: "#ffffff", bot: 740, cont: TINTA, contW: 3 });
      igloo(g, 1180, h3(1180) + 6, .9, V.k > .2);
      [[560, 1], [700, .8], [70, 1.1]].forEach(q => cristal(g, q[0], h3(q[0]) + 12, q[1], T("#d8f4ff"), T("#8fd8ff"), T("#5ab0e8")));
    },
    pad: p => p.h > 40 ? [0, 16, 0, 0] : [8, 16, 8, 36],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .5 : k) * V.k), w = p.w, h = p.h, r = rnd(30 + i);
      if (h > 40) {   // chão: gelo azul em camadas, com rachaduras e neve fofa em cima
        g.fillStyle = T("#7ccdf6"); g.fillRect(0, 0, w, h + 40);
        g.fillStyle = T("#55a8e6"); g.fillRect(0, 30, w, h + 10);
        g.fillStyle = "rgba(255,255,255,.35)"; for (let x = 20; x < w; x += 70 + r() * 60) poli(g, [x, 10, x + 16, 10, x - 20, h + 40, x - 36, h + 40]), g.fill();
        g.strokeStyle = ca("#ffffff", .6); g.lineWidth = 2; for (let k = 0; k < 12; k++) { const x = r() * w, y = 20 + r() * 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 + r() * 10, y + 6 + r() * 8); g.lineTo(x + 16 + r() * 16, y + 4); g.stroke(); }
        g.fillStyle = TINTA; g.fillRect(0, 10, w, 3);
        neveTopo(g, -10, 4, w + 20, T("#ffffff", .3), T("#d4e8fa", .3), 5 + i);
        return;
      }
      for (let k = 0; k < Math.round(w / 34); k++) { // pingentes de gelo
        const px = 12 + r() * (w - 24), len = 10 + r() * 20, wd = 4 + r() * 4;
        poli(g, [px - wd, h - 3, px + wd, h - 3, px + 1, h + len]); g.fillStyle = T("#bfeaff"); g.fill(); tracar(g, TINTA, 2.2);
      }
      bloco(g, 0, 0, w, h, { topo: T("#e8f8ff"), base: T("#8fdcff"), sombra: T("#52a8ea"), luz: null }, { raio: 8, topoH: 6, lw: 3.5, extra: function(g) {
        g.fillStyle = "rgba(255,255,255,.45)"; for (let x = 14; x < w; x += 46 + r() * 20) { poli(g, [x, 0, x + 10, 0, x - h * .6 + 10, h, x - h * .6, h]); g.fill(); }
      } });
      neveTopo(g, 2, 1, w - 4, T("#ffffff", .3), T("#d4e8fa", .3), 70 + i);
    },
    anim: function(g, p, i, est, t) { // brilhos nos cristais
      const s = spr("brilhoGelo", 20, 20, c => { brilho4(c, 10, 10, 9, "#ffffff"); });
      for (let k = 0; k < 2; k++) {
        const ph = t * .9 + i * 1.7 + k * 3.1, a = Math.pow(Math.max(0, Math.sin(ph)), 3);
        if (a < .02) continue; g.globalAlpha = a; g.drawImage(s, Math.round(p.x + p.w * (.15 + .7 * mod(Math.floor(ph / 3.14159) * .37 + i * .21 + k * .4, 1)) - 10), Math.round(p.y - 6));
      }
      g.globalAlpha = 1;
    },
    fundo: function(g, est, t, V) {
      const f = [flocoSpr("f0", 2, .55), flocoSpr("f1", 3, .75), flocoSpr("f2", 5, .9)], n = leve() ? V.neve >> 1 : V.neve, vx = V.vento ? 70 : 0;
      for (let k = 0; k < n; k++) {
        const z = k % 3, v = 16 + z * 20 + (V.vento ? 30 : 0), x = mod(k * 97.3 + Math.sin(t * .6 + k) * (14 + z * 8) + t * (6 + z * 4 + vx), L + 20) - 10, y = mod(k * 61.7 + t * v, est.altura + 20) - 10 - est.deslocY;
        g.drawImage(f[z], Math.round(x), Math.round(y));
      }
    },
    frente: function(g, est, t, V) {
      const f = flocoSpr("f2", 5, .9), n = V.vento ? 22 : 10;
      for (let k = 0; k < n; k++) { const x = mod(k * 131 + Math.sin(t * .5 + k * 2) * 30 + t * (14 + (V.vento ? 110 : 0)), L + 40) - 20, y = mod(k * 83 + t * 52, est.altura + 40) - 20 - est.deslocY; g.drawImage(f, Math.round(x), Math.round(y)); }
    }
  };

  // =====================================================================================
  // LUA — chão de crateras, módulo lunar, Terra no céu (Terra | eclipse | nebulosa)
  // =====================================================================================
  function terra(g, x, y, r, eclipse) {
    if (eclipse) {
      halo(g, x, y, r * 2.6, "#ffb060", .5, 7);
      C(g, x, y, r + 5); g.fillStyle = "#ffe0a0"; g.fill();
      C(g, x, y, r); g.fillStyle = "#1a0f30"; g.fill(); tracar(g, "#ff9a50", 3);
      g.fillStyle = "#2a1a48"; C(g, x - r * .3, y - r * .2, r * .25); g.fill();
      return;
    }
    halo(g, x, y, r * 1.8, "#5ab8ff", .3, 5);
    C(g, x, y, r); g.fillStyle = "#2f7ae0"; g.fill();
    g.save(); C(g, x, y, r); g.clip();
    g.fillStyle = "#4aa0ff"; C(g, x - r * .15, y - r * .18, r * .95); g.fill();
    g.fillStyle = "#4ec46a"; [[-.35, -.2, .32, .22], [.25, .25, .3, .2], [.4, -.45, .18, .12], [-.1, .5, .22, .12]].forEach(q => { g.beginPath(); g.ellipse(x + q[0] * r, y + q[1] * r, q[2] * r, q[3] * r, .4, 0, TAU); g.fill(); });
    g.fillStyle = "rgba(255,255,255,.85)"; [[-.2, -.55, .4, .07], [.1, .05, .5, .06], [-.4, .3, .3, .05]].forEach(q => { g.beginPath(); g.ellipse(x + q[0] * r, y + q[1] * r, q[2] * r, q[3] * r, -.2, 0, TAU); g.fill(); });
    g.fillStyle = "rgba(20,10,60,.4)"; C(g, x + r * .35, y + r * .3, r * .95); g.fill();
    g.restore();
    C(g, x, y, r); tracar(g, TINTA, 3.5);
    g.save(); g.beginPath(); g.arc(x, y, r * .72, Math.PI * 1.1, Math.PI * 1.42); tracar(g, "rgba(255,255,255,.75)", r * .1); g.restore();
  }
  function moduloLunar(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.lineWidth = 3; g.strokeStyle = TINTA; g.lineCap = "round";
    [[-22, -18, -34, 0], [22, -18, 34, 0]].forEach(q => { g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[2], q[3]); g.stroke(); g.fillStyle = "#cfd6ee"; rr(g, q[2] - 7, -3, 14, 4, 2); g.fill(); g.stroke(); });
    g.fillStyle = "#e8b440"; poli(g, [-26, -14, 26, -14, 22, -34, -22, -34]); g.fill(); tracar(g, TINTA, 3);
    g.fillStyle = "#c48a28"; poli(g, [8, -14, 26, -14, 22, -34, 8, -34]); g.fill();
    g.fillStyle = "#dfe4f4"; poli(g, [-16, -34, 16, -34, 20, -54, 0, -64, -20, -54]); g.fill(); tracar(g, TINTA, 3);
    g.fillStyle = "#3a4a8a"; C(g, 0, -48, 7); g.fill(); tracar(g, TINTA, 2.5); g.fillStyle = "#8ad8ff"; C(g, -2, -50, 3); g.fill();
    g.beginPath(); g.moveTo(14, -60); g.lineTo(22, -76); tracar(g, TINTA, 2.5);
    g.restore();
  }
  CEN.lua = {
    vars: {
      terra:    { ceu: ["#05051a", "#080824", "#0c0e2e", "#111438", "#171b44", "#1e2350"], k: 0, tint: "#ffffff", terra: 1, neb: null },
      eclipse:  { ceu: ["#10051f", "#180830", "#240c42", "#321152", "#421762", "#521e70"], k: .25, tint: "#7a2a90", terra: 2, neb: null },
      nebulosa: { ceu: ["#040a20", "#08122c", "#0c1a3a", "#112248", "#172c56", "#1e3664"], k: .12, tint: "#3a6ab0", terra: 0, neb: ["#ff4fb0", "#4fb8ff", "#9a6aff"] }
    },
    acima: V => V.ceu[0],
    abaixo: V => [mix("#8a88a8", V.tint, V.k * .5), mix("#706e90", V.tint, V.k * .5), mix("#5a587a", V.tint, V.k * .5)],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 560, V.ceu);
      if (V.neb) { const r = rnd(41); for (let i = 0; i < 9; i++) { const x = r() * L, y = 60 + r() * 330, rr2 = 120 + r() * 160, c = V.neb[i % 3]; g.fillStyle = rad(g, x, y, rr2, [[0, ca(c, .35)], [.5, ca(c, .14)], [1, ca(c, 0)]]); g.fillRect(x - rr2, y - rr2, rr2 * 2, rr2 * 2); } }
      estrelas(g, 230, 11, S.top, 520, "#ffffff", 1);
      if (V.terra) terra(g, 980, 150, 66, V.terra === 2);
      else { C(g, 980, 150, 38); g.fillStyle = "#c8a0ff"; g.fill(); g.fillStyle = "#a070e0"; C(g, 990, 160, 34); g.fill(); C(g, 980, 150, 38); tracar(g, TINTA, 3); g.beginPath(); g.ellipse(980, 150, 70, 14, -.3, 0, TAU); tracar(g, "#ffd0f0", 4); }
      montanhas(g, { y: 520, alt: 130, passo: 190, seed: 22, cor: T("#7a78a0"), sombra: T("#5a5880"), bot: 640, cont: TINTA, contW: 2.5 });
      const h1 = camada(g, { seed: 28, y: 570, amp: 18, esc: 200, cor: T("#a8a6c4"), sombra: T("#8886a8"), luz: T("#e0e0f4"), bot: 700, cont: TINTA, contW: 3 });
      const r = rnd(5);
      for (let i = 0; i < 9; i++) { const x = r() * L, y = h1(x) + 24 + r() * 30; cratera(g, x, y, 24 + r() * 26, 7 + r() * 5, T("#a8a6c4"), T("#6a6890")); }
      moduloLunar(g, 1120, h1(1120) + 12, 1);
      g.beginPath(); g.moveTo(180, h1(180) + 10); g.lineTo(180, h1(180) - 48); tracar(g, TINTA, 3);
      g.fillStyle = "#ff5a6a"; poli(g, [181, h1(180) - 48, 214, h1(180) - 42, 181, h1(180) - 30]); g.fill(); tracar(g, TINTA, 2.5);
      const h2 = camada(g, { seed: 47, y: 632, amp: 10, esc: 140, cor: T("#c4c2dc"), sombra: T("#a4a2c2"), luz: "#f4f4ff", bot: 740, cont: TINTA, contW: 3 });
      for (let i = 0; i < 7; i++) { const x = r() * L, y = h2(x) + 14 + r() * 10; cratera(g, x, y, 16 + r() * 16, 4 + r() * 3, T("#c4c2dc"), T("#8a88aa")); }
    },
    pad: p => p.h > 40 ? [0, 8, 0, 0] : [8, 8, 8, 30],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .5 : k) * V.k), w = p.w, h = p.h, r = rnd(50 + i);
      if (h > 40) {
        g.fillStyle = T("#b4b2cc"); g.fillRect(0, 0, w, h + 40); g.fillStyle = T("#9896b8"); g.fillRect(0, 26, w, h + 20);
        for (let k = 0; k < 22; k++) cratera(g, r() * w, 18 + r() * (h - 10), 8 + r() * 18, 3 + r() * 3, T("#b4b2cc"), T("#77759a"));
        g.fillStyle = T("#e2e2f2"); g.fillRect(0, 0, w, 8); g.fillStyle = TINTA; g.fillRect(0, 8, w, 3); g.fillRect(0, 0, w, 2);
        return;
      }
      sombraPlat(g, w, h + 20, .3);
      rocha(g, 0, -2, w, h + 14, { base: T("#bab8d4"), sombra: T("#8886aa"), luz: "rgba(255,255,255,.55)" }, 60 + i, { jag: .06, extra: function(g) {
        for (let k = 0; k < Math.round(w / 40); k++) cratera(g, 14 + r() * (w - 28), h * .5 + r() * h * .5, 6 + r() * 8, 2 + r() * 2, T("#bab8d4"), T("#7a789e"));
      } });
      g.fillStyle = ca("#ffffff", .5); rr(g, 10, 1, w - 20, 3, 1.5); g.fill();
    },
    fundo: function(g, est, t) {
      const e = spr("estLua", 12, 12, c => brilho4(c, 6, 6, 5.5, "#ffffff"));
      for (let k = 0; k < 26; k++) { const a = .35 + .65 * Math.max(0, Math.sin(t * (1 + (k % 5) * .35) + k * 2.1)); g.globalAlpha = a; g.drawImage(e, Math.round((k * 487) % 1260 + 6), Math.round((k * 211) % 480 + 10)); }
      g.globalAlpha = 1;
      const sat = spr("satLua", 40, 20, c => { c.fillStyle = "#4a86ff"; rr(c, 2, 6, 12, 8, 1); c.fill(); tracar(c, TINTA, 2); rr(c, 26, 6, 12, 8, 1); c.fill(); tracar(c, TINTA, 2); c.fillStyle = "#dfe4f4"; rr(c, 14, 4, 12, 12, 3); c.fill(); tracar(c, TINTA, 2); });
      const sx = mod(t * 14, L + 80) - 40, sy = 110 + Math.sin(t * .3) * 20; g.drawImage(sat, Math.round(sx - 20), Math.round(sy - 10)); if (Math.sin(t * 5) > 0) { g.fillStyle = "#ff6b6b"; g.fillRect(Math.round(sx - 2), Math.round(sy - 13), 4, 4); }
      const c = mod(t, 11); if (c < .9) { const k = c / .9, x = 200 + k * 520, y = 50 + k * 200; g.strokeStyle = "rgba(255,255,255," + (1 - k) + ")"; g.lineWidth = 3; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 70 * (1 - k * .5), y - 28 * (1 - k * .5)); g.stroke(); }
    }
  };

  // =====================================================================================
  // VULCÃO — vulcão com rios de lava, basalto com brasa nas fendas (noite | cinzas | erupção)
  // =====================================================================================
  function brasa() { return spr("brasa", 12, 12, function(g) { g.fillStyle = rad(g, 6, 6, 6, [[0, "#fff6b0"], [.35, "#ffb040"], [1, "rgba(255,90,20,0)"]]); g.fillRect(0, 0, 12, 12); }); }
  CEN.vulcao = {
    vars: {
      noite:   { ceu: ["#12051e", "#22082a", "#3a0c30", "#5a1430", "#7e1e2c", "#a83020"], k: .2, tint: "#4a0a40", fumaca: "#3a1838" },
      cinzas:  { ceu: ["#4a3a4a", "#5e4652", "#76525a", "#905e5a", "#aa6e58", "#c88458"], k: .15, tint: "#6a5060", fumaca: "#5a4652" },
      erupcao: { ceu: ["#3a0418", "#5c081c", "#86101c", "#b0201a", "#d8401a", "#f86a1e"], k: .1, tint: "#8a1010", fumaca: "#4a1020", erupcao: 1 }
    },
    fixo: false,
    acima: V => V.ceu[0],
    abaixo: () => ["#c82a0e", "#a8200c", "#86180a"],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 520, V.ceu);
      if (V.k > .15) estrelas(g, 40, 14, S.top, 200, "#ffd0b0");
      const r = rnd(17);
      // nuvens de fumaça carregadas (borda de baixo iluminada de laranja)
      for (let i = 0; i < 7; i++) nuvem(g, r() * L, 40 + r() * 160, 220 + r() * 160, V.fumaca, mix(V.fumaca, "#000000", .3), mix(V.fumaca, "#ff6a30", .45), 2.5);
      // o vulcão: cone com faces de luz e sombra, cratera brilhando e rios de lava
      const vx = 640, vy = 200;
      halo(g, vx, vy, 260, "#ff8a30", V.erupcao ? .55 : .35, 6);
      if (V.erupcao) { g.fillStyle = "#ffcf5a"; for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * .16, l = 90 + r() * 70; poli(g, [vx - 6, vy, vx + 6, vy, vx + Math.cos(a) * l, vy + Math.sin(a) * l]); g.fill(); } }
      poli(g, [vx - 70, vy, vx + 70, vy, vx + 470, 600, vx - 470, 600]); g.fillStyle = T("#5a2a4a"); g.fill();
      poli(g, [vx + 10, vy, vx + 70, vy, vx + 470, 600, vx + 120, 600]); g.fillStyle = T("#3e1a3a"); g.fill();
      poli(g, [vx - 70, vy, vx + 70, vy, vx + 470, 600, vx - 470, 600]); tracar(g, TINTA, 3);
      g.fillStyle = "#ffb03a"; g.beginPath(); g.ellipse(vx, vy, 70, 12, 0, 0, TAU); g.fill(); tracar(g, TINTA, 3); g.fillStyle = "#fff0a0"; g.beginPath(); g.ellipse(vx, vy - 2, 44, 5, 0, 0, TAU); g.fill();
      [[-30, 1], [24, -1], [-8, .5]].forEach(q => { g.beginPath(); g.moveTo(vx + q[0], vy + 6); for (let y = vy + 6; y < 600; y += 20) g.lineTo(vx + q[0] + q[1] * (y - vy) * .5 + Math.sin(y / 30) * 10, y); tracar(g, "#ff7a22", 9); g.beginPath(); g.moveTo(vx + q[0], vy + 6); for (let y = vy + 6; y < 600; y += 20) g.lineTo(vx + q[0] + q[1] * (y - vy) * .5 + Math.sin(y / 30) * 10, y); tracar(g, "#ffd060", 3); });
      // serras de basalto
      montanhas(g, { y: 520, alt: 110, passo: 170, seed: 9, cor: T("#4a2040"), sombra: T("#331530"), bot: 680, cont: TINTA, contW: 3 });
      const h2 = camada(g, { seed: 19, y: 590, amp: 22, esc: 120, cor: T("#3a1a34"), sombra: T("#28102a"), luz: T("#ff7a3a", .3), luzW: 3, bot: 760, cont: TINTA, contW: 3 });
      g.strokeStyle = "#ff8a30"; g.lineWidth = 2.5; for (let k = 0; k < 14; k++) { const x = r() * L, y = h2(x) + 20 + r() * 50; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12, y + 8); g.lineTo(x + 6, y + 18); g.stroke(); }
    },
    pad: () => [10, 10, 10, 30],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .4 : k) * V.k), w = p.w, h = p.h, r = rnd(90 + i);
      sombraPlat(g, w, h + 18, .35);
      // pedras de lava que pingam embaixo
      for (let k = 0; k < Math.round(w / 60); k++) { const x = 16 + r() * (w - 32), l = 6 + r() * 12; poli(g, [x - 6, h - 3, x + 6, h - 3, x, h + l]); g.fillStyle = "#ff7a22"; g.fill(); tracar(g, TINTA, 2); }
      bloco(g, 0, 0, w, h, { topo: T("#7a4a6a"), base: T("#4a2448"), sombra: T("#331834"), luz: "rgba(255,190,150,.35)" }, { raio: 8, lw: 3.5, extra: function(g) {
        g.strokeStyle = "#ff8a30"; g.lineWidth = 2.5; g.lineJoin = "round";
        for (let k = 0; k < Math.round(w / 55); k++) { const x = 14 + r() * (w - 28); g.beginPath(); g.moveTo(x, h * .3); g.lineTo(x + 3, h * .55); g.lineTo(x - 3, h * .75); g.lineTo(x + 1, h); g.moveTo(x + 3, h * .55); g.lineTo(x + 10, h * .7); g.stroke(); }
        g.strokeStyle = "#ffe08a"; g.lineWidth = 1; g.stroke();
      } });
    },
    fundo: function(g, est, t) {
      const b = brasa(), n = leve() ? 22 : 46;
      for (let k = 0; k < n; k++) { const v = 22 + (k % 5) * 12, x = mod(k * 137 + Math.sin(t * .8 + k * 1.3) * 26, L), y = est.altura - mod(k * 71 + t * v, est.altura + 40) - est.deslocY + 20; g.globalAlpha = .55 + .45 * Math.sin(t * 3 + k); g.drawImage(b, Math.round(x), Math.round(y)); }
      g.globalAlpha = 1;
      glow(g, "#ff9a30", 640, 200, 300, .14 + .09 * Math.sin(t * 2.2));
    },
    frente: function(g, est, t) {
      const y0 = Math.round(est.lavaY), bot = est.altura - est.deslocY + 4;
      const tile = (k, seed, c0, c1) => spr("lavaTile" + k, 320, 120, function(c) {
        const r = rnd(seed); c.fillStyle = c1; c.fillRect(0, 0, 320, 120); c.fillStyle = c0; c.fillRect(0, 0, 320, 30);
        for (let i = 0; i < 7; i++) { const x = 20 + r() * 280, y = 40 + r() * 64, rx = 14 + r() * 20; c.fillStyle = "#ffe07a"; c.beginPath(); c.ellipse(x, y + 2, rx + 3, 6.5, 0, 0, TAU); c.fill(); c.fillStyle = "#3d1226"; c.beginPath(); c.ellipse(x, y, rx, 5, 0, 0, TAU); c.fill(); tracar(c, TINTA, 2); c.fillStyle = "#6a2a40"; c.beginPath(); c.ellipse(x - rx * .2, y - 1.4, rx * .6, 2, 0, 0, TAU); c.fill(); }
        c.strokeStyle = "#ffe08a"; c.lineWidth = 3; c.lineCap = "round"; for (let i = 0; i < 6; i++) { c.beginPath(); const x = r() * 320, y = 36 + r() * 70; c.moveTo(x, y); c.quadraticCurveTo(x + 12, y + 8 * (r() - .5), x + 26, y + 2); c.stroke(); }
        const onda = x => 12 + Math.sin(x / 320 * TAU * 2) * 5 + Math.sin(x / 320 * TAU * 5) * 2;
        c.globalCompositeOperation = "destination-out"; c.fillStyle = "#000"; c.beginPath(); c.moveTo(0, 0); c.lineTo(320, 0); for (let x = 320; x >= 0; x -= 8) c.lineTo(x, onda(x)); c.closePath(); c.fill();
        c.globalCompositeOperation = "source-over"; c.beginPath(); for (let x = 0; x <= 320; x += 8) c[x ? "lineTo" : "moveTo"](x, onda(x) + 1.5); tracar(c, TINTA, 3.5);
        c.beginPath(); for (let x = 0; x <= 320; x += 8) c[x ? "lineTo" : "moveTo"](x, onda(x) + 5); tracar(c, "#fff4b0", 3);
      });
      const brilhoL = spr("lavaGlow", L, 150, c => { c.fillStyle = vg(c, 0, 150, "rgba(255,120,40,0)", "rgba(255,120,40,.45)"); c.fillRect(0, 0, L, 150); });
      g.drawImage(brilhoL, 0, y0 - 140);
      g.fillStyle = "#c82a0e"; g.fillRect(0, y0 + 108, L, Math.max(0, bot - y0 - 108));
      const off = mod(t * 14, 320), off2 = mod(-t * 9 + 120, 320);
      const t1 = tile(0, 3, "#ffb14a", "#e8401a"), t2 = tile(1, 9, "#ff9a3a", "#c82a0e");
      for (let x = -320 + off2; x < L; x += 320) g.drawImage(t2, Math.round(x), y0 - 8);
      for (let x = -320 + off; x < L; x += 320) g.drawImage(t1, Math.round(x), y0);
    }
  };

  // =====================================================================================
  // ESPAÇO — nebulosa, planeta com anéis, asteroides de rocha (nebulosa roxa | aurora verde | gigante vermelha)
  // =====================================================================================
  function planeta(g, x, y, r, c0, c1, anel) {
    halo(g, x, y, r * 1.7, c0, .22, 5);
    if (anel) { g.beginPath(); g.ellipse(x, y, r * 2, r * .42, -.35, Math.PI, TAU); tracar(g, TINTA, 9); g.beginPath(); g.ellipse(x, y, r * 2, r * .42, -.35, Math.PI, TAU); tracar(g, anel, 5); }
    C(g, x, y, r); g.fillStyle = c1; g.fill();
    g.save(); C(g, x, y, r); g.clip(); C(g, x - r * .18, y - r * .2, r * .95); g.fillStyle = c0; g.fill();
    g.fillStyle = ca("#ffffff", .2); for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(x, y + k * r * .32, r * 1.1, r * .07, -.35, 0, TAU); g.fill(); }
    g.restore();
    C(g, x, y, r); tracar(g, TINTA, 3.5);
    if (anel) { g.beginPath(); g.ellipse(x, y, r * 2, r * .42, -.35, 0, Math.PI); tracar(g, TINTA, 9); g.beginPath(); g.ellipse(x, y, r * 2, r * .42, -.35, 0, Math.PI); tracar(g, anel, 5); }
    g.save(); g.beginPath(); g.arc(x, y, r * .72, Math.PI * 1.1, Math.PI * 1.42); tracar(g, "rgba(255,255,255,.7)", r * .1); g.restore();
  }
  CEN.espaco = {
    vars: {
      roxa:     { ceu: ["#07031a", "#0d0626", "#140a34", "#1c0e42", "#24124e", "#2c165a"], neb: ["#b84dff", "#ff4fb0", "#5a6aff"], pl: ["#ffb86a", "#e0704a", "#ffe0a0"], k: 0 },
      aurora:   { ceu: ["#020c18", "#041424", "#061c30", "#08243c", "#0a2c48", "#0c3454"], neb: ["#2dffb0", "#4de0ff", "#3a8aff"], pl: ["#c08bff", "#7a4ae0", "#e8d0ff"], k: 0 },
      vermelha: { ceu: ["#14030c", "#200614", "#2e0a1c", "#3c0e22", "#4a1228", "#58182e"], neb: ["#ff6a3a", "#ffb040", "#ff3a6a"], pl: ["#6ad0ff", "#2a80d0", "#d0f4ff"], k: 0, sol: 1 }
    },
    acima: V => V.ceu[0], abaixo: V => [V.ceu[5], V.ceu[4], V.ceu[3]],
    pre: function(g, V) {
      ceu(g, 0, 720, V.ceu);
      const r = rnd(64);
      for (let i = 0; i < 12; i++) { const x = r() * L, y = S.top + r() * (S.bot - S.top), rr2 = 140 + r() * 200, c = V.neb[i % 3]; g.fillStyle = rad(g, x, y, rr2, [[0, ca(c, .32)], [.5, ca(c, .12)], [1, ca(c, 0)]]); g.fillRect(x - rr2, y - rr2, rr2 * 2, rr2 * 2); }
      reticula(g, 0, 720, V.neb[0], .06, 18);
      estrelas(g, 260, 21, S.top, S.bot, "#ffffff", 1);
      for (let i = 0; i < 14; i++) brilho4(g, r() * L, S.top + r() * (S.bot - S.top), 4 + r() * 5, "#ffffff");
      if (V.sol) { halo(g, 1180, 620, 300, "#ff7a3a", .45, 7); C(g, 1180, 620, 140); g.fillStyle = "#ff6a3a"; g.fill(); g.fillStyle = "#ffa050"; C(g, 1160, 600, 120); g.fill(); C(g, 1180, 620, 140); tracar(g, TINTA, 4); }
      planeta(g, 790, 130, 58, V.pl[0], V.pl[1], V.pl[2]);
      planeta(g, 470, 80, 24, V.neb[2], mix(V.neb[2], TINTA, .4), null);
      planeta(g, 760, 600, 18, V.neb[1], mix(V.neb[1], TINTA, .4), null);
    },
    pad: () => [14, 14, 14, 22],
    plat: function(g, p, i, V) {
      const w = p.w, h = p.h, r = rnd(110 + i);
      rocha(g, 0, 0, w, h, { base: "#8a78b8", sombra: "#5a4a8a", luz: "rgba(255,255,255,.45)" }, 120 + i * 7, { jag: .14, lw: 4, extra: function(g) {
        for (let k = 0; k < 4; k++) cratera(g, 14 + r() * (w - 28), 18 + r() * (h - 30), 7 + r() * 9, 4 + r() * 4, "#8a78b8", "#4a3a78");
        g.strokeStyle = V.neb[0]; g.lineWidth = 3; g.lineCap = "round"; g.beginPath(); const x = w * (.3 + r() * .4); g.moveTo(x, h * .3); g.lineTo(x + 10, h * .55); g.lineTo(x + 2, h * .8); g.stroke();
      } });
      // topo de pouso claro (onde se pisa)
      g.fillStyle = "rgba(255,255,255,.35)"; rr(g, w * .2, 4, w * .6, 4, 2); g.fill();
    },
    fundo: function(g, est, t, V) {
      const e = spr("estEsp", 14, 14, c => brilho4(c, 7, 7, 6.5, "#ffffff"));
      for (let k = 0; k < 24; k++) { g.globalAlpha = .25 + .75 * Math.max(0, Math.sin(t * (.8 + (k % 4) * .4) + k * 1.9)); g.drawImage(e, Math.round((k * 541) % 1260 + 4), Math.round((k * 233) % 700)); }
      g.globalAlpha = 1;
      for (let k = 0; k < 4; k++) {   // pedrinhas distantes à deriva (escuras e pequenas: não parecem plataformas)
        const s = 20 + (k % 2) * 10, sp = spr("ast" + k, s + 8, s + 8, c => { c.globalAlpha = .55; rocha(c, 4, 4, s, s * .8, { base: "#3e3668", sombra: "#2a2450" }, 60 + k, { lw: 2.5 }); });
        const x = mod(k * 313 + t * (6 + k * 2.5), L + 140) - 70, y = mod(k * 191 + 90 + Math.sin(t * .25 + k) * 30, 640);
        g.drawImage(sp, Math.round(x - (s + 8) / 2), Math.round(y - (s + 8) / 2));
      }
      const c = mod(t + 3, 9); if (c < .8) { const k = c / .8, x = 900 - k * 560, y = 60 + k * 190; g.strokeStyle = "rgba(255,255,255," + (1 - k) + ")"; g.lineWidth = 3; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 90, y - 34); g.stroke(); }
    }
  };

  // =====================================================================================
  // LABORATÓRIO — sala de contenção: painéis, porta-cofre, tubos, monitores (normal | alerta vermelho | tóxico)
  // =====================================================================================
  function tuboLab(g, x, y, w, h, cor, nivel) {
    g.fillStyle = "#2a2f52"; rr(g, x - 4, y - 14, w + 8, 16, 4); g.fill(); tracar(g, TINTA, 3); rr(g, x - 4, y + h - 2, w + 8, 16, 4); g.fill(); tracar(g, TINTA, 3);
    g.fillStyle = ca("#c8f4ff", .25); g.fillRect(x, y, w, h);
    g.fillStyle = cor; g.fillRect(x, y + h * (1 - nivel), w, h * nivel);
    g.fillStyle = clar(cor, .5); g.fillRect(x, y + h * (1 - nivel), w, 5);
    g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(x + 6, y + 6, 6, h - 12);
    g.strokeStyle = TINTA; g.lineWidth = 3; g.strokeRect(x, y, w, h);
  }
  CEN.laboratorio = {
    vars: {
      normal: { luz: "#4de3d0", parede: "#3a4478", painel: "#4a5690", k: 0, tint: "#ffffff", liq: ["#4de3d0", "#7cff5b"] },
      alerta: { luz: "#ff4d5a", parede: "#4a2a4e", painel: "#5c3462", k: .3, tint: "#8a1830", liq: ["#ff6a7a", "#ffb03a"], alerta: 1 },
      toxico: { luz: "#9cff3a", parede: "#2a4440", painel: "#36584e", k: .2, tint: "#2a6a20", liq: ["#9cff3a", "#e0ff5a"] }
    },
    fixo: true,
    acima: V => mix("#2a2f52", V.tint, V.k * .3), abaixo: V => [mix("#2a2f52", V.tint, V.k * .3), "#1e2240"],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      g.fillStyle = V.parede; g.fillRect(-PAD, S.top, L + PAD * 2, S.bot - S.top);
      // painéis da parede (borda dupla e rebites)
      for (let x = -40; x < L + 40; x += 160) for (let y = 60; y < 660; y += 150) {
        g.fillStyle = V.painel; rr(g, x + 8, y + 8, 144, 134, 10); g.fill(); tracar(g, mix(V.parede, TINTA, .5), 3);
        g.fillStyle = clar(V.painel, .15); rr(g, x + 14, y + 14, 132, 8, 4); g.fill();
        [[16, 130], [144, 130], [16, 20], [144, 20]].forEach(q => rebite(g, x + q[0], y + q[1], 3, T("#9aa4d0")));
      }
      // porta-cofre no meio
      const cx = 640, cy = 360;
      halo(g, cx, cy, 230, V.luz, .2, 5);
      C(g, cx, cy, 160); g.fillStyle = "#5a6494"; g.fill(); tracar(g, TINTA, 5);
      C(g, cx, cy, 130); g.fillStyle = "#7a84b8"; g.fill(); tracar(g, TINTA, 4);
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; rebite(g, cx + Math.cos(a) * 145, cy + Math.sin(a) * 145, 5, "#aab4e0"); }
      C(g, cx, cy, 60); g.fillStyle = "#3a4478"; g.fill(); tracar(g, TINTA, 4);
      for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + .3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92); tracar(g, TINTA, 14); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92); tracar(g, "#c8d0f0", 8); }
      C(g, cx, cy, 20); g.fillStyle = V.luz; g.fill(); tracar(g, TINTA, 3.5);
      g.fillStyle = "#ffd23f"; g.font = "900 22px Nunito, system-ui"; g.textAlign = "center";
      // tubos de líquido (bolhas animadas em fundo())
      tuboLab(g, 70, 150, 76, 420, V.liq[0], .8); tuboLab(g, 1134, 150, 76, 420, V.liq[0], .7);
      tuboLab(g, 220, 210, 40, 300, V.liq[1], .6); tuboLab(g, 1020, 210, 40, 300, V.liq[1], .75);
      // monitores (o gráfico corre em fundo())
      [[326, 156], [886, 156]].forEach(q => { g.fillStyle = "#1a1e3a"; rr(g, q[0] - 8, q[1] - 8, 164, 100, 10); g.fill(); tracar(g, TINTA, 4); g.fillStyle = "#0c2a30"; rr(g, q[0], q[1], 148, 84, 6); g.fill(); g.strokeStyle = ca(V.luz, .25); g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(q[0], q[1] + k * 21); g.lineTo(q[0] + 148, q[1] + k * 21); g.stroke(); } });
      // canos no alto
      [[90], [600]].forEach(() => {});
      g.fillStyle = "#5a6494"; g.fillRect(-PAD, 70, L + PAD * 2, 18); g.strokeStyle = TINTA; g.lineWidth = 3; g.strokeRect(-PAD, 70, L + PAD * 2, 18);
      for (let x = 40; x < L; x += 200) { g.fillStyle = "#8a94c8"; rr(g, x, 66, 18, 26, 4); g.fill(); tracar(g, TINTA, 2.5); }
      // listras de alerta perto do chão e do teto
      listrasAlerta(g, -PAD, 628, L + PAD * 2, 14, "#ffd23f", TINTA, 14); g.fillStyle = TINTA; g.fillRect(-PAD, 626, L + PAD * 2, 3);
      listrasAlerta(g, -PAD, 78, L + PAD * 2, 0, "#ffd23f", TINTA, 14);
      if (V.alerta) { g.fillStyle = "rgba(255,40,60,.12)"; g.fillRect(-PAD, S.top, L + PAD * 2, S.bot - S.top); }
    },
    pad: p => p.w > 1200 ? [0, 0, 0, 0] : [6, 6, 6, 14],
    plat: function(g, p, i, V) {
      const w = p.w, h = p.h;
      if (w > 1200) {   // chão e teto: chapas de metal com rebites e borda clara do lado de dentro
        const emCima = p.y < 100;
        g.fillStyle = "#4a5488"; g.fillRect(0, 0, w, h); g.fillStyle = "#3a4274"; g.fillRect(0, emCima ? 0 : 20, w, h - 20);
        for (let x = 0; x < w; x += 128) { g.strokeStyle = ca(TINTA, .6); g.lineWidth = 2.5; g.strokeRect(x + 2, 2, 124, h - 4); rebite(g, x + 12, emCima ? h - 12 : 12, 3, "#aab4e0"); rebite(g, x + 116, emCima ? h - 12 : 12, 3, "#aab4e0"); }
        g.fillStyle = "#aab4e0"; g.fillRect(0, emCima ? h - 8 : 0, w, 8);
        g.fillStyle = TINTA; g.fillRect(0, emCima ? h - 11 : 8, w, 3); g.fillRect(0, emCima ? h - 2 : 0, w, 2);
        return;
      }
      sombraPlat(g, w, h + 8, .25);
      bloco(g, 0, 0, w, h, { topo: "#c8d0f0", base: "#6a74b0", sombra: "#4a5288", luz: "rgba(255,255,255,.6)" }, { raio: 6, topoH: 7, lw: 3.5, extra: function(g) {
        g.fillStyle = V.luz; rr(g, 14, h - 9, w - 28, 4, 2); g.fill();
        for (let x = 24; x < w - 20; x += 60) rebite(g, x, h * .55, 2.5, "#aab4e0");
      } });
    },
    anim: function(g, p, i, est, t, V) { // o lado "chão" (onde a gravidade puxa) acende na cor da sala
      if (p.w < 1200) return;
      const embaixo = p.y > 100, ativo = embaixo === (est.gravidade >= 0); if (!ativo) return;
      const s = spr("faixaLab" + (embaixo ? 0 : 1), L, 30, c => { c.fillStyle = embaixo ? vg(c, 0, 30, ca(V.luz, 0), ca(V.luz, .55)) : vg(c, 0, 30, ca(V.luz, .55), ca(V.luz, 0)); c.fillRect(0, 0, L, 30); });
      g.globalAlpha = .7 + .3 * Math.sin(t * 3); g.drawImage(s, 0, embaixo ? p.y - 30 : p.y + p.h); g.globalAlpha = 1;
    },
    fundo: function(g, est, t, V) {
      const b = spr("bolhaLab", 10, 10, c => { C(c, 5, 5, 3.4); c.fillStyle = "rgba(255,255,255,.85)"; c.fill(); tracar(c, ca(TINTA, .5), 1.2); });
      [[70, 76, 150, 420, .8], [1134, 76, 150, 420, .7], [220, 40, 210, 300, .6], [1020, 40, 210, 300, .75]].forEach(function(q, k) {
        const topo = q[2] + q[3] * (1 - q[4]);
        for (let m = 0; m < 4; m++) { const y = q[2] + q[3] - 14 - mod(t * (24 + m * 6) + m * 97 + k * 31, q[3] * q[4] - 10); if (y < topo) continue; g.drawImage(b, Math.round(q[0] + 8 + ((m * 29 + k * 11) % (q[1] - 22)) + Math.sin(t * 2 + m) * 3), Math.round(y)); }
      });
      g.strokeStyle = V.luz; g.lineWidth = 2.5; g.lineJoin = "round";
      [[326, 156], [886, 156]].forEach(function(q, k) { g.beginPath(); for (let x = 0; x <= 148; x += 6) { const y = q[1] + 42 + Math.sin((x + t * 60) / (14 + k * 6)) * 14 * Math.sin(t + x / 40) + Math.sin((x - t * 40) / 7) * 5; g[x ? "lineTo" : "moveTo"](q[0] + x, y); } g.stroke(); });
      glow(g, V.luz, 640, 360, 300, .12 + .08 * Math.sin(t * 2));
      const al = V.alerta ? 4 : 1.5;
      [[300, 96], [980, 96], [300, 616], [980, 616]].forEach(function(q, k) { const on = Math.floor(t * al + k * .5) % 2 === 0; g.fillStyle = on ? "#ff4d5a" : "#5a2a34"; C(g, q[0], q[1], 6); g.fill(); tracar(g, TINTA, 2); if (on) glow(g, "#ff4d5a", q[0], q[1], 40, .5); });
    },
    frente: function(g, est, t) {
      const a = est.avisoInversao; if (!(a > .02)) return;
      const pul = .55 + .45 * Math.sin(t * 12);
      const fx = [0, 1].map(k => spr("faixaAviso" + k, L, 140, c => { c.fillStyle = k ? vg(c, 0, 140, "rgba(255,40,60,0)", "rgba(255,40,60,.6)") : vg(c, 0, 140, "rgba(255,40,60,.6)", "rgba(255,40,60,0)"); c.fillRect(0, 0, L, 140); }));
      g.globalAlpha = a * pul; g.drawImage(fx[0], 0, -est.deslocY); g.drawImage(fx[1], 0, est.altura - est.deslocY - 140);
      const dir = est.gravidade >= 0 ? -1 : 1;
      const sa = [0, 1].map(k => spr("setaAviso" + k, 84, 74, c => { c.translate(42, 37); c.scale(1, k ? -1 : 1); c.translate(-42, -37); poli(c, [42, 6, 78, 46, 54, 46, 54, 68, 30, 68, 30, 46, 6, 46]); c.fillStyle = "#ff3d52"; c.fill(); tracar(c, TINTA, 4); c.fillStyle = "rgba(255,255,255,.5)"; poli(c, [42, 14, 62, 38, 42, 38]); c.fill(); }));
      g.globalAlpha = a * pul * .9;
      for (let k = 0; k < 3; k++) { const x = 100 + k * 500; for (let m = 0; m < 3; m++) g.drawImage(sa[dir < 0 ? 0 : 1], x, Math.round(mod(360 + dir * (t * 160 + m * 240), 720) - 60)); }
      g.globalAlpha = 1;
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
    if (S.bot > A + 40 && d.abaixo) { const ab = d.abaixo(S.V), hh = S.bot - (A + 40); for (let i = 0; i < ab.length; i++) { g.fillStyle = ab[i]; g.fillRect(-PAD, Math.round(A + 40 + hh * i / ab.length), L + PAD * 2, Math.ceil(hh / ab.length) + 2); } }
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
