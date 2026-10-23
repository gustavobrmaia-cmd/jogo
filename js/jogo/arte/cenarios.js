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
  // DOJÔ — ringue flutuando sobre um mar de nuvens, monte nevado, pagodes (entardecer | noite de lanternas | manhã)
  // =====================================================================================
  function pagode(g, x, y, s, c, cs, luz) {
    g.save(); g.translate(x, y); g.scale(s, s);
    for (let k = 0; k < 3; k++) {
      const yy = -k * 30, w = 46 - k * 10;
      g.fillStyle = cs; g.fillRect(-w * .6, yy - 22, w * 1.2, 22); g.strokeStyle = TINTA; g.lineWidth = 2.5; g.strokeRect(-w * .6, yy - 22, w * 1.2, 22);
      if (luz) { g.fillStyle = luz; g.fillRect(-5, yy - 17, 10, 10); }
      poli(g, [-w - 8, yy - 20, w + 8, yy - 20, w * .55, yy - 32, -w * .55, yy - 32]); g.fillStyle = c; g.fill(); tracar(g, TINTA, 2.5);
    }
    g.beginPath(); g.moveTo(0, -122); g.lineTo(0, -140); tracar(g, TINTA, 3);
    g.restore();
  }
  function lanterna(g, x, y, s, cor, acesa) {
    g.beginPath(); g.moveTo(x, y - s * 1.4); g.lineTo(x, y - s * .8); tracar(g, TINTA, 2);
    if (acesa) halo(g, x, y, s * 3, "#ffb040", .35, 4);
    g.fillStyle = cor; g.beginPath(); g.ellipse(x, y, s * .8, s, 0, 0, TAU); g.fill(); tracar(g, TINTA, 2.5);
    g.fillStyle = acesa ? "#ffe9a0" : clar(cor, .3); g.beginPath(); g.ellipse(x - s * .2, y - s * .1, s * .3, s * .6, 0, 0, TAU); g.fill();
    g.fillStyle = TINTA; g.fillRect(x - s * .5, y - s - 2, s, 4); g.fillRect(x - s * .5, y + s - 2, s, 4);
  }
  CEN.dojo = {
    vars: {
      entardecer: { ceu: ["#3a1a6a", "#6a2a8a", "#b0408e", "#e86a7a", "#ff9a72", "#ffc48a"], nv: ["#ffd6c0", "#f09aa8", "#b05a98"], k: .25, tint: "#c04a7a", astro: "sol" },
      noite:      { ceu: ["#0a0a2e", "#111648", "#1a2262", "#232e7a", "#2e3c8e", "#3c4ea0"], nv: ["#9aa8e8", "#6a74c4", "#454c96"], k: .5, tint: "#1e2a7a", astro: "lua", lanternas: 1 },
      manha:      { ceu: ["#4a9cff", "#68b0ff", "#88c4ff", "#a8d8ff", "#c8e8ff", "#f0f8ff"], nv: ["#ffffff", "#dce8ff", "#a8bce8"], k: 0, tint: "#ffffff", astro: "sol" }
    },
    acima: V => V.ceu[0], abaixo: V => [V.nv[1], V.nv[2], mix(V.nv[2], TINTA, .3)],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 560, V.ceu);
      if (V.astro === "lua") { estrelas(g, 140, 31, S.top, 380, "#ffffff"); luaCrescente(g, 960, 130, 46, "#fff4d8"); }
      else astro(g, 960, V.k ? 380 : 130, 60, V.k ? "#ffd27a" : "#fff1a8", V.k ? "#fff0c0" : "#fffbe0", V.k ? "#e86a3a" : "#f5b524", "#fff0c0", .35);
      // monte nevado com cume branco
      poli(g, [380, 600, 640, 230, 900, 600]); g.fillStyle = T("#8a7ac8"); g.fill();
      poli(g, [640, 230, 900, 600, 700, 600]); g.fillStyle = T("#6a5aa8"); g.fill();
      poli(g, [640, 230, 590, 300, 612, 296, 630, 318, 652, 292, 676, 312, 690, 300]); g.fillStyle = T("#ffffff", .4); g.fill();
      poli(g, [380, 600, 640, 230, 900, 600]); tracar(g, TINTA, 3);
      // ilhas distantes com pagodes
      [[160, 330, .8], [1140, 290, .7]].forEach(q => {
        rocha(g, q[0] - 90 * q[2], q[1] - 6, 180 * q[2], 70 * q[2], { base: T("#7a6aa8"), sombra: T("#5a4a88") }, q[0], { lw: 2.5 });
        g.fillStyle = T("#7ac46a"); rr(g, q[0] - 86 * q[2], q[1] - 8, 172 * q[2], 12, 6); g.fill(); tracar(g, TINTA, 2.5);
        pagode(g, q[0], q[1] - 4, q[2], T("#c43a4a"), T("#f4e0c0"), V.lanternas ? "#ffd070" : null);
      });
      // mar de nuvens em camadas (bolotas com contorno)
      const r = rnd(12);
      [[520, V.nv[2], 3], [570, V.nv[1], 3], [630, V.nv[0], 3]].forEach((q, k) => {
        const b = []; for (let x = -PAD - 40; x < L + PAD + 60; x += 60 + r() * 50) b.push([x, q[0] + r() * 20, 40 + r() * 34]);
        blobs(g, b, T(q[1], .4), q[2]); g.fillStyle = T(q[1], .4); g.fillRect(-PAD, q[0] + 10, L + PAD * 2, S.bot - q[0]);
        g.fillStyle = ca("#ffffff", .35); b.forEach(c => { g.beginPath(); g.ellipse(c[0] - c[2] * .25, c[1] - c[2] * .45, c[2] * .4, c[2] * .14, -.3, 0, TAU); g.fill(); });
      });
    },
    pad: p => p.h > 30 ? [16, 16, 16, 110] : [8, 30, 8, 16],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .4 : k) * V.k), w = p.w, h = p.h;
      if (h > 30) {   // ringue: base de rocha flutuando, laterais de madeira vermelha e topo de argila com a corda de palha
        rocha(g, 30, h - 10, w - 60, 110, { base: T("#8a7a9a"), sombra: T("#5a4a70"), luz: "rgba(255,255,255,.3)" }, 77, { jag: .14 });
        poli(g, [60, h + 40, w - 60, h + 40, w / 2, h + 104]); g.fillStyle = T("#5a4a70"); g.fill(); tracar(g, TINTA, 3.5);
        bloco(g, -8, 0, w + 16, h, { topo: T("#e8c890"), base: T("#c43a4a"), sombra: T("#8a2236"), luz: "rgba(255,255,255,.5)" }, { raio: 8, topoH: 14, lw: 4, extra: function(g) {
          g.fillStyle = T("#ffd23f"); g.fillRect(-8, 22, w + 16, 4);
          for (let x = 20; x < w; x += 80) rebite(g, x, 31, 3, T("#ffd23f"));
        } });
        g.strokeStyle = T("#d4b070"); g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(14, 6); g.lineTo(w - 14, 6); g.stroke();
        g.strokeStyle = TINTA; g.lineWidth = 2; for (let x = 20; x < w - 14; x += 16) { g.beginPath(); g.moveTo(x, 3.5); g.lineTo(x + 4, 8.5); g.stroke(); }
        g.fillStyle = "#ffffff"; g.fillRect(w / 2 - 70, 9, 24, 3); g.fillRect(w / 2 + 46, 9, 24, 3);
        return;
      }
      // viga de madeira laqueada com tampas douradas e lanterna pendurada
      bloco(g, 0, 0, w, h, { topo: T("#ff8a7a"), base: T("#d8404e"), sombra: T("#9a2a3e"), luz: "rgba(255,255,255,.5)" }, { raio: 6, topoH: 6, lw: 3.5, extra: function(g) {
        g.fillStyle = T("#ffd23f"); g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h); g.fillStyle = TINTA; g.fillRect(14, 0, 2.5, h); g.fillRect(w - 16.5, 0, 2.5, h);
      } });
      lanterna(g, w / 2, h + 1 + 10, 8, T("#ff5a5a"), V.lanternas);
    },
    fundo: function(g, est, t, V) {
      const n = [spr("dn0", 300, 110, c => nuvem(c, 150, 60, 250, ca(V.nv[0], .9), ca(V.nv[1], .9), V.nv[2], 2.5)), spr("dn1", 220, 90, c => nuvem(c, 110, 50, 180, ca(V.nv[0], .9), ca(V.nv[1], .9), V.nv[2], 2.5))];
      [[0, 90, 90, 5, 0], [1, 400, 50, 4, 500], [0, 700, 170, 6, 100], [1, 980, 110, 3, 700]].forEach(q => g.drawImage(n[q[0]], Math.round(mod(q[1] + q[4] + t * q[3], L + 400) - 320), q[2]));
      const pe = [spr("pt0", 10, 8, c => { c.fillStyle = "#ffc2d8"; c.beginPath(); c.ellipse(5, 4, 4, 2.6, .5, 0, TAU); c.fill(); c.strokeStyle = "#c05a8a"; c.lineWidth = 1.2; c.stroke(); }), spr("pt1", 12, 10, c => { c.fillStyle = "#ffe0ec"; c.beginPath(); c.ellipse(6, 5, 4.6, 3, -.5, 0, TAU); c.fill(); c.strokeStyle = "#c05a8a"; c.lineWidth = 1.2; c.stroke(); })];
      const np = leve() ? 16 : 32;
      for (let k = 0; k < np; k++) { const v = 22 + (k % 4) * 9, x = mod(k * 79 + t * (14 + (k % 3) * 6) + Math.sin(t * .9 + k) * 30, L + 20) - 10, y = mod(k * 53 + t * v, est.altura + 20) - 10 - est.deslocY; g.drawImage(pe[k % 2], Math.round(x), Math.round(y)); }
      const a0 = spr("g0", 26, 14, c => { c.beginPath(); c.moveTo(1, 3); c.quadraticCurveTo(7, 11, 13, 8); c.quadraticCurveTo(19, 11, 25, 3); tracar(c, TINTA, 2.6); }), a1 = spr("g1", 26, 14, c => { c.beginPath(); c.moveTo(1, 11); c.quadraticCurveTo(7, 3, 13, 8); c.quadraticCurveTo(19, 3, 25, 11); tracar(c, TINTA, 2.6); });
      for (let k = 0; k < 3; k++) g.drawImage(Math.floor(t * 2.5 + k) % 2 ? a0 : a1, Math.round(mod(t * 26 + k * 70 - 60, L + 120) - 40 - k * 20), Math.round(200 + k * 24 + Math.sin(t + k) * 8));
      if (V.lanternas) { const pl = S.plats || S.cen.plataformas; for (let i = 0; i < pl.length; i++) { const p = pl[i]; if (p.h > 30) continue; glow(g, "#ffb040", p.x + p.w / 2, p.y + p.h + 11, 56, .4 + .15 * Math.sin(t * 3 + i)); } }
    }
  };

  // =====================================================================================
  // CIDADE — telhados com o vão no meio, prédios e placas neon (noite neon | pôr do sol | chuva)
  // =====================================================================================
  function predio(g, x, base, w, h, cor, corS, jan, r, apagadas) {
    g.fillStyle = cor; g.fillRect(x, base - h, w, h + 400);
    g.fillStyle = corS; g.fillRect(x + w * .7, base - h, w * .3, h + 400);
    g.strokeStyle = TINTA; g.lineWidth = 3; g.strokeRect(x, base - h, w, h + 400);
    g.fillStyle = mix(cor, "#ffffff", .2); g.fillRect(x - 3, base - h - 6, w + 6, 8); g.strokeRect(x - 3, base - h - 6, w + 6, 8);
    for (let yy = base - h + 16; yy < base + 60; yy += 22) for (let xx = x + 8; xx < x + w - 12; xx += 16) { g.fillStyle = r() < apagadas ? ca(TINTA, .45) : jan[Math.floor(r() * jan.length)]; g.fillRect(xx, yy, 8, 11); }
  }
  function placaNeon(g, x, y, tipo, cor) {
    g.save(); g.translate(x, y);
    g.fillStyle = "#1a1040"; rr(g, -40, -30, 80, 60, 10); g.fill(); tracar(g, TINTA, 3);
    halo(g, 0, 0, 50, cor, .3, 4);
    g.beginPath();
    if (tipo === 0) { g.moveTo(0, 16); g.bezierCurveTo(-30, -4, -14, -26, 0, -10); g.bezierCurveTo(14, -26, 30, -4, 0, 16); }
    else if (tipo === 1) { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr2 = k % 2 ? 9 : 20; g[k ? "lineTo" : "moveTo"](Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); }
    else { g.moveTo(6, -20); g.lineTo(-10, 4); g.lineTo(2, 4); g.lineTo(-6, 20); g.lineTo(12, -4); g.lineTo(0, -4); g.closePath(); }
    g.lineWidth = 6; g.strokeStyle = cor; g.lineJoin = "round"; g.stroke(); g.lineWidth = 2; g.strokeStyle = "#ffffff"; g.stroke();
    g.restore();
  }
  CEN.cidade = {
    vars: {
      noite: { ceu: ["#0c0628", "#160a3c", "#22104e", "#321660", "#441c70", "#5a2280"], k: .15, tint: "#3a1a7a", jan: ["#ffd070", "#6fe8ff", "#ff6fc8", "#ffe9b0"], apag: .35, neon: 1, astro: "lua" },
      tarde: { ceu: ["#3a1a6a", "#6a2a8a", "#b0408e", "#e86a7a", "#ff9a6a", "#ffc87a"], k: .2, tint: "#b0406a", jan: ["#ffd070", "#ffe9b0"], apag: .6, neon: .6, astro: "sol" },
      chuva: { ceu: ["#10142c", "#161c3a", "#1e2648", "#283256", "#323e64", "#3c4a70"], k: .3, tint: "#1e2a5a", jan: ["#ffd070", "#6fe8ff", "#ff6fc8"], apag: .45, neon: 1, chuva: 1 }
    },
    acima: V => V.ceu[0], abaixo: () => ["#1a1040", "#140c34", "#0e0828"],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 520, V.ceu);
      if (V.astro === "lua") { estrelas(g, 90, 51, S.top, 300, "#ffffff"); luaCrescente(g, 1080, 120, 40, "#fff0f8"); }
      else if (V.astro === "sol") astro(g, 640, 420, 80, "#ffd27a", "#fff0c0", "#e86a3a", "#ffe0a0", .4);
      if (V.chuva) [[200, 80, 300], [700, 60, 360], [1100, 110, 280], [450, 170, 240]].forEach(q => nuvem(g, q[0], q[1], q[2], "#3a4468", "#2a3256", "#1a2040", 2.5));
      const r = rnd(70);
      // skyline distante (silhueta com janelinhas)
      for (let x = -PAD; x < L + PAD; x += 50 + r() * 40) { const w = 46 + r() * 50, h = 120 + r() * 180; g.fillStyle = T("#2a1a5a"); g.fillRect(x, 520 - h, w, h + 200); g.fillStyle = ca(V.jan[0], .5); for (let yy = 530 - h; yy < 640; yy += 14) for (let xx = x + 5; xx < x + w - 6; xx += 10) if (r() < .25) g.fillRect(xx, yy, 4, 6); }
      bruma(g, 380, 560, V.ceu[5], .35);
      // prédios do meio (com contorno) e placas neon
      [[-20, 140, 330], [170, 120, 250], [940, 130, 290], [1120, 180, 360]].forEach((q, k) => predio(g, q[0], 640, q[1], q[2], T(["#4a3a8a", "#5a3c96", "#463a86", "#523896"][k]), T("#2c2060"), V.jan, r, V.apag));
      // o vão: rua lá embaixo com faróis
      g.fillStyle = T("#1a1040"); g.fillRect(400, 560, 480, S.bot - 560);
      predio(g, 470, 700, 110, 180, T("#3a2a72"), T("#241850"), V.jan, r, V.apag); predio(g, 700, 700, 120, 150, T("#3a2a72"), T("#241850"), V.jan, r, V.apag);
      bruma(g, 200, 700, V.ceu[0], .3, 3);
      if (V.neon) { placaNeon(g, 120, 330, 0, "#ff4fd8"); placaNeon(g, 1180, 300, 1, "#33e0ff"); placaNeon(g, 1000, 420, 2, "#ffd23f"); }
      // caixa d'água e ar-condicionado em cima dos telhados
      g.fillStyle = T("#8a5a3a"); rr(g, 60, 560, 70, 60, 8); g.fill(); tracar(g, TINTA, 3); g.fillStyle = T("#6a4028"); g.fillRect(60, 576, 70, 6); g.fillRect(60, 596, 70, 6);
      [[70, 620], [120, 620]].forEach(q => { g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0], 642); tracar(g, TINTA, 4); });
      g.fillStyle = T("#9aa0c8"); rr(g, 1150, 606, 70, 36, 5); g.fill(); tracar(g, TINTA, 3); C(g, 1185, 624, 12); g.fillStyle = T("#5a6090"); g.fill(); tracar(g, TINTA, 2);
      g.beginPath(); g.moveTo(300, 642); g.lineTo(300, 560); tracar(g, TINTA, 4); g.beginPath(); g.moveTo(290, 580); g.lineTo(310, 580); g.moveTo(286, 600); g.lineTo(314, 600); tracar(g, TINTA, 3);
    },
    pad: p => p.h > 40 ? [0, 12, 0, 0] : p.move ? [12, 10, 12, 40] : [10, 10, 10, 20],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .4 : k) * V.k), w = p.w, h = p.h, r = rnd(i + 7);
      if (h > 40) {   // telhado: parapeito claro, parede roxa com janelas e friso neon
        g.fillStyle = T("#3c2a7a"); g.fillRect(0, 0, w, h + 20);
        for (let x = 14; x < w - 14; x += 24) for (let y = 30; y < h; y += 26) { g.fillStyle = r() < .4 ? ca(TINTA, .5) : V.jan[Math.floor(r() * V.jan.length)]; g.fillRect(x, y, 10, 14); }
        g.fillStyle = T("#b8a8f0"); g.fillRect(0, 0, w, 12); g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(0, 2, w, 3);
        g.fillStyle = TINTA; g.fillRect(0, 12, w, 3); g.fillRect(0, 0, w, 2.5);
        g.fillStyle = "#33e0ff"; g.fillRect(0, 18, w, 4); g.fillStyle = "#e6fcff"; g.fillRect(0, 19, w, 1.5);
        const x0 = p.x < 100 ? w - 3 : 0; g.fillStyle = TINTA; g.fillRect(x0, 0, 3, h + 20);
        return;
      }
      if (p.move) {   // plataforma antigravidade: casco escuro, faixa neon e propulsores
        [26, w - 26].forEach(x => { poli(g, [x - 11, h - 2, x + 11, h - 2, x + 7, h + 9, x - 7, h + 9]); g.fillStyle = "#2a1c68"; g.fill(); tracar(g, TINTA, 2.5); });
        bloco(g, 0, 0, w, h, { topo: "#d8f6ff", base: "#4ab0e8", sombra: "#2a70b8", luz: "rgba(255,255,255,.7)" }, { raio: 9, topoH: 6, lw: 3.5, extra: g => { g.fillStyle = "#33e0ff"; rr(g, 14, h - 8, w - 28, 3, 1.5); g.fill(); } });
        return;
      }
      g.beginPath(); g.moveTo(14, h); g.lineTo(26, h + 12); g.moveTo(w - 14, h); g.lineTo(w - 26, h + 12); tracar(g, TINTA, 3);
      bloco(g, 0, 2, w, h - 2, { topo: "#ffd0f4", base: "#c06ae8", sombra: "#7a3ab8", luz: "rgba(255,255,255,.7)" }, { raio: 5, topoH: 5, lw: 3, extra: g => { g.fillStyle = ca(TINTA, .55); for (let x = 10; x < w - 8; x += 12) g.fillRect(x, 9, 4, h - 10); } });
    },
    anim: function(g, p, i, est, t) { if (p.move) { const a = .5 + .3 * Math.sin(t * 20 + i); [26, p.w - 26].forEach(x => glow(g, "#33e0ff", p.x + x, p.y + p.h + 20, 28, a)); } },
    fundo: function(g, est, t, V) {
      const carro = (k, cor) => spr("carro" + k, 44, 18, c => { c.fillStyle = cor; rr(c, 6, 4, 32, 11, 5); c.fill(); tracar(c, TINTA, 2.5); c.fillStyle = "#bfefff"; rr(c, 18, 6, 10, 4, 2); c.fill(); c.fillStyle = "#fff6b0"; c.fillRect(36, 8, 5, 3); c.fillStyle = "#ff4d6a"; c.fillRect(3, 8, 4, 3); });
      const cs = [carro(0, "#ffd23f"), carro(1, "#ff6fc8"), carro(2, "#33e0ff")];
      [[0, 200, 60, 1], [1, 270, 90, -1], [2, 330, 45, 1], [0, 440, 110, -1], [1, 150, 80, 1]].forEach(function(q, k) {
        const x = mod(q[2] * t * q[3] + k * 230, L + 160) - 80; if (q[3] < 0) { g.save(); g.translate(Math.round(x), q[1]); g.scale(-1, 1); g.drawImage(cs[q[0]], -22, -9); g.restore(); } else g.drawImage(cs[q[0]], Math.round(x - 22), q[1] - 9);
      });
      const zp = spr("zepelim", 150, 64, c => { c.fillStyle = "#6a54b8"; c.beginPath(); c.ellipse(78, 26, 64, 20, 0, 0, TAU); c.fill(); tracar(c, TINTA, 3); c.fillStyle = "#8a74d8"; c.beginPath(); c.ellipse(70, 19, 46, 8, 0, 0, TAU); c.fill(); poli(c, [16, 24, 4, 8, 26, 18]); c.fillStyle = "#4a3a96"; c.fill(); tracar(c, TINTA, 2.5); c.fillStyle = "#2a1c68"; rr(c, 62, 44, 26, 11, 3); c.fill(); tracar(c, TINTA, 2.5); c.fillStyle = "#ff4fd8"; c.fillRect(50, 22, 54, 5); });
      g.drawImage(zp, Math.round(mod(t * 10 + 200, L + 300) - 200), 96);
      if (V.neon) [[120, 330], [1180, 300], [1000, 420]].forEach((q, k) => { if (Math.sin(t * 2.3 + k * 2) > -.6) glow(g, ["#ff4fd8", "#33e0ff", "#ffd23f"][k], q[0], q[1], 110, .35); });
    },
    frente: function(g, est, t, V) {
      if (!V.chuva) return;
      const gota = spr("chuva", 10, 30, c => { c.beginPath(); c.moveTo(8, 1); c.lineTo(2, 29); tracar(c, "rgba(190,210,255,.55)", 2); });
      const n = leve() ? 30 : 60;
      for (let k = 0; k < n; k++) { const x = mod(k * 157 - t * 120, L + 40) - 20, y = mod(k * 97 + t * 900, est.altura + 60) - 30 - est.deslocY; g.drawImage(gota, Math.round(x), Math.round(y)); }
    }
  };

  // =====================================================================================
  // FLIPERAMA — dentro da mesa de pinball: raios, anéis neon, trilhos e bumpers (rosa | verde | dourado)
  // =====================================================================================
  function bumperSpr(r, cor, aceso) {
    const s = Math.ceil(r * 2 + 24);
    return spr("bump" + r + cor + (aceso ? 1 : 0), s, s, function(g) {
      const c = s / 2; g.translate(c, c);
      g.fillStyle = ca(TINTA, .35); C(g, 4, 6, r + 3); g.fill();
      C(g, 0, 0, r + 3); g.fillStyle = "#c8cce8"; g.fill(); g.save(); C(g, 0, 0, r + 3); g.clip(); g.fillStyle = "#8088b8"; C(g, 6, 8, r + 3); g.fill(); g.restore(); C(g, 0, 0, r + 3); tracar(g, TINTA, 3.5);
      C(g, 0, 0, r - 5); g.fillStyle = aceso ? clar(cor, .5) : cor; g.fill(); g.save(); C(g, 0, 0, r - 5); g.clip(); g.fillStyle = aceso ? cor : mix(cor, TINTA, .3); C(g, r * .2, r * .25, r - 5); g.fill(); g.restore(); C(g, 0, 0, r - 5); tracar(g, TINTA, 3);
      brilho4(g, 0, 1, r * .36, aceso ? "#ffffff" : clar(cor, .6));
      g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.ellipse(-r * .3, -r * .34, r * .2, r * .09, -.7, 0, TAU); g.fill();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; C(g, Math.cos(a) * (r - 1), Math.sin(a) * (r - 1), 2.4); g.fillStyle = aceso ? "#ffffff" : cor; g.fill(); }
    });
  }
  CEN.fliperama = {
    vars: {
      rosa:    { fundo: ["#1a0a3a", "#24104e"], raios: "#3a1a6a", n: ["#ff3d8b", "#33d6ff", "#ffd23f", "#7cff5b"] },
      verde:   { fundo: ["#04201e", "#0a2e2a"], raios: "#0e4038", n: ["#7cff5b", "#ff9a2e", "#33d6ff", "#ff3d8b"] },
      dourado: { fundo: ["#22082e", "#30103e"], raios: "#4a1a4a", n: ["#ffd23f", "#c06bff", "#ff6a3a", "#33d6ff"] }
    },
    fixo: true,
    acima: V => V.fundo[0], abaixo: V => ["#2a2f52", "#1e2240"],
    pre: function(g, V) {
      g.fillStyle = V.fundo[0]; g.fillRect(-PAD, S.top, L + PAD * 2, S.bot - S.top);
      // explosão de raios chapados atrás
      g.fillStyle = V.fundo[1]; for (let k = 0; k < 24; k += 2) { const a0 = k / 24 * TAU, a1 = (k + 1) / 24 * TAU; poli(g, [640, 330, 640 + Math.cos(a0) * 1400, 330 + Math.sin(a0) * 1400, 640 + Math.cos(a1) * 1400, 330 + Math.sin(a1) * 1400]); g.fill(); }
      reticula(g, 0, 660, V.raios, .5, 22);
      // anéis neon ao redor dos bumpers
      [[640, 300, 110], [330, 450, 86], [950, 450, 86], [640, 560, 70]].forEach((q, k) => { C(g, q[0], q[1], q[2]); tracar(g, TINTA, 10); C(g, q[0], q[1], q[2]); tracar(g, V.n[k], 5); C(g, q[0], q[1], q[2]); tracar(g, "rgba(255,255,255,.6)", 1.5); });
      // trilhos cromados nos cantos de cima
      [[0, 1], [L, -1]].forEach(q => { g.beginPath(); g.moveTo(q[0], 250); g.quadraticCurveTo(q[0], 60, q[0] + q[1] * 260, 60); tracar(g, TINTA, 18); g.beginPath(); g.moveTo(q[0], 250); g.quadraticCurveTo(q[0], 60, q[0] + q[1] * 260, 60); tracar(g, "#c8cce8", 11); g.beginPath(); g.moveTo(q[0] + q[1] * 3, 250); g.quadraticCurveTo(q[0] + q[1] * 3, 57, q[0] + q[1] * 260, 57); tracar(g, "#ffffff", 3); });
      // estrelas de rollover e setas
      [[160, 380], [1120, 380], [640, 120], [220, 200], [1060, 200]].forEach((q, k) => { g.save(); g.translate(q[0], q[1]); g.beginPath(); for (let m = 0; m < 10; m++) { const a = -Math.PI / 2 + m * Math.PI / 5, rr2 = m % 2 ? 7 : 16; g[m ? "lineTo" : "moveTo"](Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); g.fillStyle = mix(V.n[k % 4], TINTA, .5); g.fill(); tracar(g, TINTA, 3); g.restore(); });
      [[420, 620], [860, 620]].forEach((q, k) => { poli(g, [q[0] - 16, q[1] + 10, q[0], q[1] - 10, q[0] + 16, q[1] + 10, q[0], q[1] + 2]); g.fillStyle = V.n[k + 1]; g.fill(); tracar(g, TINTA, 3); });
      // moldura de cima com lâmpadas
      g.fillStyle = "#2a2f52"; g.fillRect(-PAD, S.top, L + PAD * 2, 44 - S.top); g.fillStyle = TINTA; g.fillRect(-PAD, 42, L + PAD * 2, 4);
      for (let x = 20; x < L; x += 40) { C(g, x, 22, 8); g.fillStyle = "#5a4a3a"; g.fill(); tracar(g, TINTA, 2.5); }
    },
    pad: p => p.h > 40 ? [0, 10, 0, 0] : [8, 8, 8, 14],
    plat: function(g, p, i, V) {
      const w = p.w, h = p.h;
      if (h > 40) {   // fundo da mesa: chapa escura com listras e lâmpadas
        g.fillStyle = "#2a2f52"; g.fillRect(0, 0, w, h + 20); listrasAlerta(g, 0, 12, w, 14, V.n[0], mix(V.n[0], TINTA, .55), 18);
        g.fillStyle = "#c8cce8"; g.fillRect(0, 0, w, 10); g.fillStyle = "#ffffff"; g.fillRect(0, 2, w, 2); g.fillStyle = TINTA; g.fillRect(0, 10, w, 3); g.fillRect(0, 26, w, 3);
        return;
      }
      const cor = V.n[i % 4];
      [18, w - 18].forEach(x => { poli(g, [x - 6, h - 2, x + 6, h - 2, x + 3, h + 10, x - 3, h + 10]); g.fillStyle = "#5a6298"; g.fill(); tracar(g, TINTA, 2.5); });
      bloco(g, 0, 0, w, h, { topo: "#e8ecff", base: "#9aa2d0", sombra: "#5a6298", luz: "#ffffff" }, { raio: h / 2, topoH: 5, lw: 3.5, extra: g => { g.fillStyle = cor; rr(g, 10, h * .45, w - 20, 5, 2.5); g.fill(); } });
    },
    extra: function(g, est, t, V) { // bumpers (acendem quando batem)
      const bs = est.bumpers; if (!bs) return;
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i], cor = V.n[i % 4], f = b.flash || 0, base = bumperSpr(b.r, cor, false), s = base.width, x = Math.round(b.x - s / 2), y = Math.round(b.y - s / 2);
        if (f > .02) glow(g, cor, b.x, b.y, b.r * 4.4, Math.min(1, f * .9));
        g.drawImage(base, x, y);
        if (f > .02) { g.globalAlpha = Math.min(1, f * 1.3); g.drawImage(bumperSpr(b.r, cor, true), x, y); g.globalAlpha = 1; g.strokeStyle = "rgba(255,255,255," + (f * .8).toFixed(2) + ")"; g.lineWidth = 3 * f + .5; g.beginPath(); g.arc(b.x, b.y, b.r + 6 + (1 - f) * f * 24, 0, TAU); g.stroke(); }
      }
    },
    fundo: function(g, est, t, V) {
      const lamp = spr("lampF" + V.n[2], 16, 16, c => { C(c, 8, 8, 6); c.fillStyle = V.n[2]; c.fill(); C(c, 7, 7, 3); c.fillStyle = "#ffffff"; c.fill(); });
      for (let x = 20, k = 0; x < L; x += 40, k++) if (((k + Math.floor(t * 8)) % 4) === 0) { g.drawImage(lamp, x - 8, 14); glow(g, V.n[2], x, 22, 40, .6); }
      [[160, 380], [1120, 380], [640, 120], [220, 200], [1060, 200]].forEach((q, k) => { const a = Math.max(0, Math.sin(t * 3 + k * 1.3)); if (a > .1) glow(g, V.n[k % 4], q[0], q[1], 64, a * .8); });
    }
  };

  // =====================================================================================
  // FLORESTA — noite encantada: troncos, cogumelos que brilham, vagalumes, escuro com luz nas bolinhas
  // (lua azul | mágica roxa | névoa verde)
  // =====================================================================================
  function cogu(g, x, y, s, cor) {
    g.fillStyle = "#f4ecd8"; rr(g, x - s * .18, y - s * .6, s * .36, s * .62, s * .12); g.fill(); tracar(g, TINTA, 2);
    g.beginPath(); g.moveTo(x - s * .6, y - s * .5); g.quadraticCurveTo(x - s * .55, y - s * 1.15, x, y - s * 1.15); g.quadraticCurveTo(x + s * .55, y - s * 1.15, x + s * .6, y - s * .5); g.closePath(); g.fillStyle = cor; g.fill(); tracar(g, TINTA, 2.5);
    g.fillStyle = "rgba(255,255,255,.85)"; C(g, x - s * .2, y - s * .85, s * .1); g.fill(); C(g, x + s * .22, y - s * .75, s * .08); g.fill();
  }
  function tronco(g, x, y0, y1, w, c, cs) {
    g.fillStyle = c; g.fillRect(x - w / 2, y0, w, y1 - y0); g.fillStyle = cs; g.fillRect(x + w * .15, y0, w * .35, y1 - y0);
    g.beginPath(); g.moveTo(x - w / 2, y0); g.lineTo(x - w / 2, y1); g.moveTo(x + w / 2, y0); g.lineTo(x + w / 2, y1); tracar(g, TINTA, 3);
    poli(g, [x - w / 2, y1, x - w, y1 + 20, x + w, y1 + 20, x + w / 2, y1]); g.fillStyle = c; g.fill(); tracar(g, TINTA, 3);
  }
  CEN.floresta = {
    vars: {
      lua:    { ceu: ["#06102a", "#0a1838", "#0e2046", "#122a54", "#183462", "#1e3e6e"], k: .4, tint: "#1a3a7a", cog: ["#4dd0e8", "#ff7ad0"], astro: 1 },
      magica: { ceu: ["#12062a", "#1c0a3a", "#280e4a", "#34125a", "#42186a", "#501e78"], k: .45, tint: "#4a1a8a", cog: ["#ff7ad0", "#ffd23f"] },
      nevoa:  { ceu: ["#041a1a", "#062424", "#0a2e2c", "#0e3834", "#14423c", "#1a4c44"], k: .4, tint: "#0e4a3a", cog: ["#9cff5a", "#4dd0e8"], bruma: 1 }
    },
    acima: V => V.ceu[0], abaixo: V => [mix("#2a4a2a", V.tint, V.k), mix("#1e3820", V.tint, V.k), mix("#142818", V.tint, V.k)],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 560, V.ceu);
      estrelas(g, 80, 61, S.top, 260, "#e8f0ff");
      if (V.astro) luaCrescente(g, 900, 110, 40, "#f4f8ff");
      const r = rnd(33);
      // troncos em 3 camadas (os de trás mais claros e azulados)
      [[T("#3a5a7a"), T("#2c4866"), 30, 40], [T("#3a3a4a"), T("#2a2a38"), 44, 70], [T("#4a3428"), T("#33231c"), 60, 110]].forEach((q, k) => {
        for (let x = -20 + k * 60; x < L + 40; x += 180 + r() * 120) { if (k === 2 && x > 380 && x < 900) continue; tronco(g, x, S.top, 620 + k * 10, q[2] + r() * 20, q[0], q[1]); }
        if (V.bruma) bruma(g, 300, 640, "#7ae0b0", .18);
      });
      // copa escura cobrindo o alto (com contorno)
      { const b = []; for (let x = -PAD - 40; x < L + PAD + 60; x += 60 + r() * 40) b.push([x, 20 + r() * 40, 50 + r() * 30]); blobs(g, b, T("#1e4a3a"), 3); g.fillStyle = T("#1e4a3a"); g.fillRect(-PAD, S.top, L + PAD * 2, 30 - S.top); g.fillStyle = T("#2e6a4a"); b.forEach(c => { g.beginPath(); g.ellipse(c[0] - c[2] * .2, c[1] + c[2] * .3, c[2] * .5, c[2] * .2, 0, 0, TAU); g.fill(); }); }
      // chão do fundo com samambaias e cogumelos
      const h1 = camada(g, { seed: 44, y: 610, amp: 16, esc: 160, cor: T("#2e5a3a"), sombra: T("#21452c"), luz: T("#6ad08a", .6), bot: 740, cont: TINTA, contW: 3 });
      for (let k = 0; k < 16; k++) { const x = r() * L, y = h1(x) + 8; const b = [[x - 10, y - 6, 9], [x + 6, y - 10, 11], [x + 18, y - 4, 8]]; blobs(g, b, T("#3a7a4a"), 2.5); }
      [[130, 1], [380, .8], [860, 1.1], [1100, .9], [700, .6], [40, .7]].forEach((q, k) => cogu(g, q[0], h1(q[0]) + 14, 30 * q[1], V.cog[k % 2]));
      if (V.bruma) bruma(g, 540, 700, "#9af0c0", .22);
    },
    pad: p => p.h > 40 ? [0, 14, 0, 0] : [14, 16, 14, 28],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .3 : k) * V.k), w = p.w, h = p.h, r = rnd(140 + i);
      if (h > 40) {
        g.fillStyle = T("#4a3428"); g.fillRect(0, 0, w, h + 40); g.fillStyle = T("#3a281e"); g.fillRect(0, 26, w, h + 20);
        g.strokeStyle = T("#2a1a14"); g.lineWidth = 3; g.lineCap = "round"; for (let k = 0; k < 14; k++) { const x = r() * w; g.beginPath(); g.moveTo(x, 16); g.quadraticCurveTo(x + 14, 30, x + 4 - r() * 20, 50 + r() * 20); g.stroke(); }
        grama(g, 0, 4, w, T("#5ad07a"), T("#2e8a4a"), 14, 10); g.fillStyle = TINTA; g.fillRect(0, 14, w, 3);
        return;
      }
      // galho/tronco deitado com musgo em cima e cogumelinhos
      g.strokeStyle = TINTA; g.lineWidth = 3; g.lineCap = "round"; for (let k = 0; k < Math.round(w / 70); k++) { const x = 16 + r() * (w - 32); g.beginPath(); g.moveTo(x, h - 2); g.quadraticCurveTo(x + 8, h + 10, x + 2, h + 18 + r() * 8); g.stroke(); }
      bloco(g, 0, 0, w, h, { topo: T("#5ad07a"), base: T("#7a5238"), sombra: T("#55382a"), luz: "rgba(255,255,255,.35)" }, { raio: h / 2, topoH: 7, lw: 3.5, extra: g => { g.strokeStyle = ca(TINTA, .4); g.lineWidth = 2; for (let x = 20; x < w - 10; x += 34) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x + 14, 10); g.stroke(); } } });
      grama(g, 4, 2, w - 8, T("#7af09a"), T("#3a9a5a"), 50 + i, 7);
      cogu(g, w - 22, 2, 16, V.cog[i % 2]);
    },
    fundo: function(g, est, t, V) {
      const f = spr("vaga", 22, 22, c => { c.fillStyle = rad(c, 11, 11, 11, [[0, "rgba(255,255,200,1)"], [.2, "rgba(220,255,120,.8)"], [1, "rgba(160,255,80,0)"]]); c.fillRect(0, 0, 22, 22); });
      const n = leve() ? 14 : 26;
      for (let k = 0; k < n; k++) {
        const x = 40 + ((k * 211) % 1200) + Math.sin(t * .7 + k * 1.7) * 40, y = 160 + ((k * 97) % 480) + Math.sin(t * .9 + k * 2.3) * 24;
        g.globalAlpha = .35 + .65 * Math.max(0, Math.sin(t * 1.8 + k * 2.9)); g.drawImage(f, Math.round(x - 11), Math.round(y - 11));
      }
      g.globalAlpha = 1;
      [[130, 600], [380, 604], [860, 600], [1100, 598]].forEach((q, k) => glow(g, V.cog[k % 2], q[0], q[1] - 10, 80, .6 + .3 * Math.sin(t * 1.5)));
    },
    frente: function(g, est, t) {
      // Escuridão com buracos de luz, sem escala e sem gradiente grande:
      //  - fora das luzes: retângulos chapados;  - luz isolada: sprite "escuro com buraco" (1 cópia);
      //  - luzes que se sobrepõem: máscara em tamanho real, furada com sprites (destination-out), só na área delas.
      const H = est.altura, dy = est.deslocY, DK = "rgba(4,12,26,.68)", ls = est.luzes || [], n = Math.min(ls.length, 20), bx = [];
      for (let i = 0; i < n; i++) { const l = ls[i], d = Math.round(l.r * 2 / 4) * 4; bx.push({ x0: Math.round(l.x - d / 2), y0: Math.round(l.y - d / 2), x1: Math.round(l.x + d / 2), y1: Math.round(l.y + d / 2), d: d, c: -1 }); }
      let nc = 0; for (let i = 0; i < n; i++) { if (bx[i].c < 0) { bx[i].c = nc++; } for (let k = i + 1; k < n; k++) if (bx[i].x0 < bx[k].x1 && bx[k].x0 < bx[i].x1 && bx[i].y0 < bx[k].y1 && bx[k].y0 < bx[i].y1) { const o = bx[k].c, c = bx[i].c; if (o < 0) bx[k].c = c; else if (o !== c) for (let m = 0; m < n; m++) if (bx[m].c === o) bx[m].c = c; } }
      const top = -dy, bot = H - dy;
      function faixas(lista) {
        const ys = [top, bot]; lista.forEach(b => { if (b.y0 > top && b.y0 < bot) ys.push(b.y0); if (b.y1 > top && b.y1 < bot) ys.push(b.y1); }); ys.sort((a, b) => a - b);
        const cov = [], gap = [];
        for (let k = 0; k < ys.length - 1; k++) {
          const y0 = ys[k], y1 = ys[k + 1]; if (y1 - y0 < .5) continue; const mid = (y0 + y1) / 2, iv = [];
          lista.forEach(b => { if (b.y0 <= mid && b.y1 >= mid) iv.push([Math.max(0, b.x0), Math.min(L, b.x1)]); }); iv.sort((a, b) => a[0] - b[0]);
          let x = 0; const mg = []; iv.forEach(v => { if (v[1] <= v[0]) return; const l = mg[mg.length - 1]; if (l && v[0] <= l[1]) l[1] = Math.max(l[1], v[1]); else mg.push([v[0], v[1]]); });
          mg.forEach(v => { if (v[0] > x) gap.push([x, y0, v[0] - x, y1 - y0]); cov.push([v[0], y0, v[1] - v[0], y1 - y0]); x = v[1]; });
          if (x < L) gap.push([x, y0, L - x, y1 - y0]);
        }
        return { cov: cov, gap: gap };
      }
      const mk = d => spr("luzNeg" + d, d, d, c => { c.fillStyle = rad(c, d / 2, d / 2, d / 2, [[0, "rgba(4,12,26,0)"], [.55, "rgba(4,12,26,.04)"], [.82, "rgba(4,12,26,.38)"], [1, "rgba(4,12,26,.68)"]]); c.fillRect(0, 0, d, d); });
      const mk2 = d => spr("luzFuro" + d, d, d, c => { c.fillStyle = rad(c, d / 2, d / 2, d / 2, [[0, "rgba(0,0,0,1)"], [.55, "rgba(0,0,0,.94)"], [.82, "rgba(0,0,0,.44)"], [1, "rgba(0,0,0,0)"]]); c.fillRect(0, 0, d, d); });
      g.fillStyle = DK; faixas(bx).gap.forEach(r => g.fillRect(r[0], r[1], r[2], r[3]));
      for (let c = 0; c < nc; c++) {
        const grp = bx.filter(b => b.c === c); if (!grp.length) continue;
        if (grp.length === 1) { g.drawImage(mk(grp[0].d), grp[0].x0, grp[0].y0); continue; }
        let m = S.sp.masc; if (!m || m.height !== H) m = S.sp.masc = nova(L, H);
        const mc = m.getContext("2d"), cov = faixas(grp).cov; mc.globalCompositeOperation = "source-over"; mc.fillStyle = DK;
        cov.forEach(r => { mc.clearRect(r[0], r[1] + dy, r[2], r[3]); mc.fillRect(r[0], r[1] + dy, r[2], r[3]); });
        mc.globalCompositeOperation = "destination-out"; grp.forEach(b => mc.drawImage(mk2(b.d), b.x0, b.y0 + dy)); mc.globalCompositeOperation = "source-over";
        cov.forEach(r => g.drawImage(m, r[0], r[1] + dy, r[2], r[3], r[0], r[1], r[2], r[3]));
      }
      for (let i = 0; i < Math.min(n, 2); i++) { const d = Math.round(ls[i].r * 1.3 / 4) * 4, q = spr("calor" + d, d, d, c => { c.globalAlpha = .12; c.drawImage(glowSpr("#ffe39a", d), 0, 0); }); g.drawImage(q, Math.round(ls[i].x - d / 2), Math.round(ls[i].y - d / 2)); }
      // musgo luminoso na borda de cima de cada plataforma (por cima do escuro): o caminho fica legível no mapa todo
      const pl = S.plats || S.cen.plataformas, ms = w => spr("musgoLuz" + w, w, 16, c => {
        const gy = c.createLinearGradient(0, 0, 0, 16); gy.addColorStop(0, "rgba(110,255,190,0)"); gy.addColorStop(.42, "rgba(150,255,210,.55)"); gy.addColorStop(.5, "rgba(225,255,240,1)"); gy.addColorStop(.62, "rgba(110,255,190,.4)"); gy.addColorStop(1, "rgba(110,255,190,0)");
        c.fillStyle = gy; c.fillRect(0, 0, w, 16); c.globalCompositeOperation = "destination-in";
        const gx = c.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, "rgba(0,0,0,0)"); gx.addColorStop(10 / w, "rgba(0,0,0,1)"); gx.addColorStop(1 - 10 / w, "rgba(0,0,0,1)"); gx.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = gx; c.fillRect(0, 0, w, 16);
      });
      g.globalAlpha = .72 + .12 * Math.sin(t * 1.7);
      for (let i = 0; i < pl.length; i++) { const p = pl[i]; if (p.h > 40) continue; g.drawImage(ms(Math.round(p.w + 12)), Math.round(p.x - 6), Math.round(p.y - 8)); }
      g.globalAlpha = .4; g.drawImage(ms(L + 80), -40, 652); g.globalAlpha = 1;
    }
  };

  // =====================================================================================
  // DESERTO — dunas, pirâmides, mesas de arenito, cactos e vento de areia (dia | pôr do sol | noite)
  // =====================================================================================
  function cacto(g, x, y, s, c, cs) {
    g.save(); g.translate(x, y); g.scale(s, s);
    const f = () => { g.beginPath(); rr(g, -8, -62, 16, 62, 8, true); rr(g, -26, -42, 10, 24, 5, true); rr(g, -26, -24, 22, 9, 4.5, true); rr(g, 16, -52, 10, 26, 5, true); rr(g, 4, -30, 22, 9, 4.5, true); };
    f(); tracar(g, TINTA, 6); f(); g.fillStyle = c; g.fill();
    g.fillStyle = cs; g.fillRect(2, -58, 5, 56); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(-5, -56, 3, 40);
    g.restore();
  }
  CEN.deserto = {
    vars: {
      dia:   { ceu: ["#3a9cff", "#58aeff", "#7ac2ff", "#9cd4ff", "#c2e6ff", "#fff0d0"], k: 0, tint: "#ffffff", astro: "sol", solY: 120 },
      tarde: { ceu: ["#3a1a6a", "#7a2a86", "#c8407e", "#f2686a", "#ff9a5a", "#ffd07a"], k: .3, tint: "#c0406a", astro: "sol", solY: 430 },
      noite: { ceu: ["#080a2a", "#0e1240", "#161c56", "#1e286a", "#28367c", "#34448c"], k: .55, tint: "#1e2a7a", astro: "lua" }
    },
    acima: V => V.ceu[0], abaixo: V => [mix("#d89a52", V.tint, V.k * .6), mix("#c0843e", V.tint, V.k * .6), mix("#a06c30", V.tint, V.k * .6)],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 520, V.ceu);
      if (V.astro === "lua") { estrelas(g, 180, 81, S.top, 420, "#ffffff"); luaCrescente(g, 300, 120, 38, "#fff6e0"); }
      else astro(g, 1000, V.solY, 58, "#ffe45c", "#fff6b0", "#f08a24", "#fff0a0", .4);
      // mesas de arenito ao longe
      // v19.3: base em 580 (atrás das dunas); antes acabava em 460–470 e aparecia céu embaixo (pareciam flutuar)
      [[90, 580, 200, 230], [1050, 580, 240, 250]].forEach((q, k) => {
        poli(g, [q[0], q[1], q[0] + 20, q[1] - q[3], q[0] + q[2] - 20, q[1] - q[3], q[0] + q[2], q[1]]); g.fillStyle = T("#d4805a"); g.fill();
        poli(g, [q[0] + q[2] * .6, q[1] - q[3], q[0] + q[2] - 20, q[1] - q[3], q[0] + q[2], q[1], q[0] + q[2] * .6, q[1]]); g.fillStyle = T("#b0604a"); g.fill();
        g.fillStyle = T("#e8a070"); g.fillRect(q[0] + 14, q[1] - q[3], q[2] - 28, 10); for (let y = q[1] - q[3] + 34; y < q[1]; y += 26) { g.fillStyle = ca(TINTA, .2); g.fillRect(q[0] + 14, y, q[2] - 28, 4); }
        poli(g, [q[0], q[1], q[0] + 20, q[1] - q[3], q[0] + q[2] - 20, q[1] - q[3], q[0] + q[2], q[1]]); tracar(g, TINTA, 3);
      });
      // pirâmides
      // v19.3: mesma ponta de antes, base descida até 580 (largura cresce junto para manter a inclinação)
      [[640, 580, 409, 300], [420, 580, 247, 170], [860, 580, 263, 190]].forEach(q => {
        poli(g, [q[0] - q[2] / 2, q[1], q[0], q[1] - q[3], q[0] + q[2] / 2, q[1]]); g.fillStyle = T("#f2c878"); g.fill();
        poli(g, [q[0], q[1] - q[3], q[0] + q[2] / 2, q[1], q[0] + q[2] * .08, q[1]]); g.fillStyle = T("#c8904a"); g.fill();
        g.strokeStyle = ca(TINTA, .25); g.lineWidth = 2; for (let k = 1; k < 7; k++) { const yy = q[1] - q[3] * k / 7, hw = q[2] / 2 * (1 - k / 7); g.beginPath(); g.moveTo(q[0] - hw, yy); g.lineTo(q[0] + hw, yy); g.stroke(); }
        poli(g, [q[0] - q[2] / 2, q[1], q[0], q[1] - q[3], q[0] + q[2] / 2, q[1]]); tracar(g, TINTA, 3);
      });
      // dunas em camadas (face clara e face de sombra) com cactos
      camada(g, { seed: 91, y: 540, amp: 26, esc: 220, cor: T("#f4c27a"), sombra: T("#dca262"), luz: T("#fff0c0", .5), bot: 700, cont: TINTA, contW: 3, faixa: 26 });
      const h2 = camada(g, { seed: 97, y: 600, amp: 22, esc: 170, cor: T("#ffd48a"), sombra: T("#e8b06a"), luz: T("#fff4d0", .5), bot: 740, cont: TINTA, contW: 3, faixa: 22 });
      [[90, 1], [330, .8], [1000, 1.1], [1210, .85]].forEach(q => cacto(g, q[0], h2(q[0]) + 14, q[1], T("#5ac46a"), T("#3a9a52")));
      const r = rnd(4); g.fillStyle = T("#e8b06a"); for (let k = 0; k < 30; k++) { const x = r() * L, y = h2(x) + 20 + r() * 30; g.fillRect(Math.round(x), Math.round(y), 10 + r() * 14, 2.5); }
    },
    pad: p => p.w > 1000 ? [0, 12, 0, 0] : p.w < 100 ? [10, 26, 10, 0] : [10, 10, 10, 26],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .4 : k) * V.k), w = p.w, h = p.h, r = rnd(200 + i);
      if (w > 1000) {
        g.fillStyle = T("#f2c27a"); g.fillRect(0, 0, w, h + 40); g.fillStyle = T("#dca262"); g.fillRect(0, 26, w, h + 20);
        g.strokeStyle = T("#c8904a"); g.lineWidth = 3; g.lineCap = "round"; for (let k = 0; k < 26; k++) { const x = r() * w, y = 18 + r() * (h - 14); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 5, x + 28, y); g.stroke(); }
        g.fillStyle = T("#ffe4a8"); g.fillRect(0, 0, w, 9); g.fillStyle = TINTA; g.fillRect(0, 9, w, 3); g.fillRect(0, 0, w, 2);
        return;
      }
      if (w < 100) {   // obelisco no meio (bloco sólido)
        poli(g, [w / 2, -24, w - 8, -4, 8, -4]); g.fillStyle = T("#ffd23f"); g.fill(); tracar(g, TINTA, 3);
        bloco(g, 0, 0, w, h, { topo: T("#ffe0a0"), base: T("#e0a860"), sombra: T("#b07a40"), luz: "rgba(255,255,255,.5)" }, { raio: 4, topoH: 8, lw: 3.5, extra: g => { g.strokeStyle = ca(TINTA, .45); g.lineWidth = 2.5; for (let y = 22; y < h - 10; y += 22) { g.beginPath(); g.moveTo(w / 2 - 8, y); g.lineTo(w / 2 + 8, y); g.moveTo(w / 2, y - 6); g.lineTo(w / 2, y + 6); g.stroke(); } } });
        return;
      }
      sombraPlat(g, w, h + 18, .25);
      bloco(g, 0, 0, w, h, { topo: T("#ffe0a0"), base: T("#e89a5a"), sombra: T("#b86a3e"), luz: "rgba(255,255,255,.5)" }, { raio: 7, topoH: 7, lw: 3.5, extra: g => { g.fillStyle = T("#d07a48"); g.fillRect(0, h * .55, w, 3); for (let x = 30; x < w; x += 60) { g.fillStyle = ca(TINTA, .3); g.fillRect(x, h * .62, 2.5, h); } } });
    },
    fundo: function(g, est, t, V) {
      const nu = spr("dnv0", 240, 90, c => nuvem(c, 120, 50, 190, mix("#ffffff", V.tint, V.k * .6), mix("#ffe6c0", V.tint, V.k * .6), mix("#e8b880", V.tint, V.k * .6), 2.5));
      [[60, 110, 6], [500, 70, 4], [820, 200, 5]].forEach(q => g.drawImage(nu, Math.round(mod(q[0] + t * q[2], L + 300) - 240), q[1]));
      const ab = [spr("ab0", 36, 14, c => { c.beginPath(); c.moveTo(1, 4); c.quadraticCurveTo(10, 12, 18, 7); c.quadraticCurveTo(26, 12, 35, 4); tracar(c, TINTA, 3); }), spr("ab1", 36, 14, c => { c.beginPath(); c.moveTo(1, 9); c.quadraticCurveTo(10, 2, 18, 6); c.quadraticCurveTo(26, 2, 35, 9); tracar(c, TINTA, 3); })];
      for (let k = 0; k < 3; k++) { const a = t * .3 + k * 2.1; g.drawImage(ab[Math.floor(t * 1.2 + k) % 2], Math.round(520 + Math.cos(a) * 160 + k * 90), Math.round(140 + Math.sin(a * 1.3) * 30 + k * 28)); }
    },
    frente: function(g, est, t) { // linhas de areia correndo no sentido do vento + poeira rasteira
      const v = est.vento || 0, av = Math.abs(v); if (av < .02) return;
      const fs = [48, 80, 112].map(w => spr("faixaAreia" + w, w, 5, c => { rr(c, 1, 1, w - 2, 3, 1.5); c.fillStyle = "rgba(255,236,190,.85)"; c.fill(); }));
      // v19.3: a areia anda pela força do vento acumulada quadro a quadro (antes x = t * força: a força muda durante
      // a rodada e as linhas davam saltos enormes, parecendo um vento rápido demais e bugado); também mais devagar
      const dt = S.ventoT == null || t < S.ventoT ? 0 : Math.min(0.1, t - S.ventoT);
      S.ventoT = t; S.ventoFase = (S.ventoFase || 0) + v * dt;
      const nn = 10 + Math.round(av * 22);
      for (let k = 0; k < nn; k++) { const sp = 240 + (k % 5) * 50, x = mod(k * 173 + S.ventoFase * sp, L + 160) - 80, y = ((k * 89) % 560) + 60 + Math.sin(t * 2 + k) * 6; g.drawImage(fs[k % 3], Math.round(x), Math.round(y)); }
      const pa = spr("poeira", L, 150, c => { c.fillStyle = vg(c, 0, 150, "rgba(235,190,120,0)", "rgba(235,190,120,.22)"); c.fillRect(0, 0, L, 150); });
      g.globalAlpha = Math.min(1, av * 1.6); g.drawImage(pa, 0, Math.round(est.altura - est.deslocY - 150)); g.globalAlpha = 1;
    }
  };

  // =====================================================================================
  // FÁBRICA — sala de máquinas: engrenagens, janelão com chaminés, canos com vapor, esteiras (dia | pôr do sol | noite)
  // =====================================================================================
  // engrenagem com dentes, miolo e 6 furos (simetria de 60°: 1/6 de volta pré-renderizado se repete)
  function engrenagem(g, x, y, R, dentes, cor, ang) {
    g.save(); g.translate(x, y); g.rotate(ang || 0);
    const forma = () => { g.beginPath(); for (let i = 0; i < dentes; i++) { const a = i / dentes * TAU, w = TAU / dentes * .3; [[a - w * 1.1, R * .82], [a - w * .7, R], [a + w * .7, R], [a + w * 1.1, R * .82]].forEach((q, k) => g[i + k ? "lineTo" : "moveTo"](Math.cos(q[0]) * q[1], Math.sin(q[0]) * q[1])); } g.closePath(); };
    forma(); g.fillStyle = mix(cor, TINTA, .3); g.fill();
    g.save(); forma(); g.clip(); g.fillStyle = cor; C(g, -R * .06, -R * .08, R * .98); g.fill(); g.restore();
    forma(); tracar(g, TINTA, 3);
    C(g, 0, 0, R * .6); g.fillStyle = mix(cor, TINTA, .25); g.fill(); tracar(g, TINTA, 2.5);
    g.fillStyle = mix(cor, TINTA, .6); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; C(g, Math.cos(a) * R * .36, Math.sin(a) * R * .36, R * .1); g.fill(); }
    C(g, 0, 0, R * .17); g.fillStyle = clar(cor, .3); g.fill(); tracar(g, TINTA, 2.5);
    g.restore();
  }
  function engQuadros(k, R, dentes, cor) {
    return S.sp["eq" + k] || (S.sp["eq" + k] = (function() {
      const s = Math.ceil(R * 2 + 8), q = [];
      for (let f = 0; f < 14; f++) { const c = nova(s, s); engrenagem(c.getContext("2d"), s / 2, s / 2, R, dentes, cor, f / 14 * TAU / 6); q.push(c); }
      return q;
    })());
  }
  CEN.fabrica = {
    vars: {
      dia:   { janela: ["#5ab0ff", "#8ccfff", "#c8ecff"], k: 0, tint: "#ffffff", luz: "#ffb02e", astro: "sol" },
      tarde: { janela: ["#7a2a86", "#e8607a", "#ffb070"], k: .2, tint: "#c0506a", luz: "#ffb02e", astro: "sol" },
      noite: { janela: ["#0c1040", "#1a2266", "#2e3a8a"], k: .4, tint: "#2a2a7a", luz: "#ffd23f", astro: "lua" }
    },
    fixo: true,
    acima: V => mix("#3a3f5e", V.tint, V.k * .5), abaixo: () => ["#262c37", "#1e2230"],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      g.fillStyle = T("#4a5070"); g.fillRect(-PAD, S.top, L + PAD * 2, S.bot - S.top);
      // parede de chapas com rebites
      for (let x = -40; x < L + 40; x += 120) for (let y = Math.floor(S.top / 100) * 100 - 60; y < 700; y += 100) { g.fillStyle = T(((x / 120 + y / 100) & 1) ? "#565c80" : "#50567a"); g.fillRect(x + 3, y + 3, 114, 94); g.strokeStyle = ca(TINTA, .5); g.lineWidth = 2.5; g.strokeRect(x + 3, y + 3, 114, 94); rebite(g, x + 12, y + 12, 3, T("#9aa0c0")); rebite(g, x + 108, y + 12, 3, T("#9aa0c0")); }
      // janelão com a cidade industrial lá fora
      const jx = 400, jy = 90, jw = 480, jh = 250;
      g.fillStyle = TINTA; rr(g, jx - 16, jy - 16, jw + 32, jh + 32, 14); g.fill();
      g.save(); g.beginPath(); g.rect(jx, jy, jw, jh); g.clip();
      const n = V.janela.length; for (let i = 0; i < n; i++) { g.fillStyle = V.janela[i]; g.fillRect(jx, jy + i * jh / n, jw, jh / n + 1); }
      if (V.astro === "sol") astro(g, jx + 360, jy + (V.k ? 200 : 70), 34, "#ffe45c", "#fff6b0", "#f08a24", "#fff0a0", .4);
      else { estrelas(g, 40, 3, jy, jy + 160, "#ffffff"); luaCrescente(g, jx + 380, jy + 60, 24, "#f4f4ff"); }
      [[jx + 40, 150], [jx + 120, 200], [jx + 230, 130], [jx + 300, 180], [jx + 400, 150]].forEach((q, k) => {
        g.fillStyle = T("#3a3058"); g.fillRect(q[0], jy + jh - q[1] * .6, 70, q[1]); g.fillStyle = T("#5a4a6a"); g.fillRect(q[0] + 20, jy + jh - q[1], 18, q[1] * .5); g.fillStyle = "#ff5a5a"; g.fillRect(q[0] + 20, jy + jh - q[1], 18, 8);
        g.strokeStyle = TINTA; g.lineWidth = 2.5; g.strokeRect(q[0], jy + jh - q[1] * .6, 70, q[1]); g.strokeRect(q[0] + 20, jy + jh - q[1], 18, q[1] * .5);
        if (V.astro === "lua") { g.fillStyle = "#ffd070"; for (let m = 0; m < 4; m++) g.fillRect(q[0] + 8 + m * 15, jy + jh - q[1] * .5 + 10, 7, 9); }
      });
      g.restore();
      g.strokeStyle = T("#8a90b0"); g.lineWidth = 10; g.strokeRect(jx, jy, jw, jh); g.beginPath(); g.moveTo(jx + jw / 2, jy); g.lineTo(jx + jw / 2, jy + jh); g.moveTo(jx, jy + jh / 2); g.lineTo(jx + jw, jy + jh / 2); g.stroke();
      g.strokeStyle = TINTA; g.lineWidth = 3; g.strokeRect(jx - 5, jy - 5, jw + 10, jh + 10);
      g.fillStyle = "rgba(255,255,255,.18)"; poli(g, [jx + 20, jy, jx + 80, jy, jx + 10, jy + jh, jx - 50 + 20, jy + jh]); g.fill();
      // canos grossos
      [[60, "#c86a4a"], [1220, "#4a9ac8"]].forEach(q => { g.fillStyle = TINTA; g.fillRect(q[0] - 19, S.top, 38, 700 - S.top); g.fillStyle = T(q[1]); g.fillRect(q[0] - 15, S.top, 30, 700 - S.top); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(q[0] - 10, S.top, 6, 700 - S.top); for (let y = 120; y < 660; y += 140) { g.fillStyle = T("#8a90b0"); rr(g, q[0] - 22, y, 44, 16, 4); g.fill(); tracar(g, TINTA, 2.5); } });
      // medidor com ponteiro
      [[1100, 400], [180, 470]].forEach(q => { C(g, q[0], q[1], 30); g.fillStyle = "#f4ecd8"; g.fill(); tracar(g, TINTA, 4); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + 16, q[1] - 14); tracar(g, "#e03a3a", 4); C(g, q[0], q[1], 4); g.fillStyle = TINTA; g.fill(); });
      listrasAlerta(g, -PAD, 640, L + PAD * 2, 20, "#ffd23f", TINTA, 14);
    },
    pad: p => p.h > 40 ? [0, 8, 0, 0] : p.move ? [10, 10, 10, 50] : [10, 10, 10, 16],
    plat: function(g, p, i, V) {
      const w = p.w, h = p.h;
      if (p.esteira) {   // esteira: armação de metal com roletes e a correia (animada em anim)
        if (h <= 40) sombraPlat(g, w, h + 12, .3);
        bloco(g, 0, 0, w, h > 40 ? h + 20 : h, { topo: "#262c37", base: "#7a8098", sombra: "#4a5068", luz: null }, { raio: h > 40 ? 0 : h / 2, topoH: 13, lw: 3.5, extra: g => { for (let x = 16; x < w; x += 32) { C(g, x, h > 40 ? 30 : h * .7, 5); g.fillStyle = "#c8cce0"; g.fill(); tracar(g, TINTA, 2); } if (h > 40) listrasAlerta(g, 0, 44, w, 12, "#ffd23f", TINTA, 12); } });
        return;
      }
      if (p.move) {   // elevador: plataforma com cabos para cima e lâmpada
        g.beginPath(); g.moveTo(16, 0); g.lineTo(16, -10); g.moveTo(w - 16, 0); g.lineTo(w - 16, -10); tracar(g, TINTA, 3);
        bloco(g, 0, 0, w, h, { topo: "#c8fff4", base: "#3ac0a8", sombra: "#1e8a7a", luz: "rgba(255,255,255,.6)" }, { raio: 5, topoH: 6, lw: 3.5, extra: g => listrasAlerta(g, 0, h - 7, w, 7, "#ffd23f", TINTA, 8) });
        poli(g, [w / 2 - 20, h, w / 2 + 20, h, w / 2 + 8, h + 30, w / 2 - 8, h + 30]); g.fillStyle = "#4a5068"; g.fill(); tracar(g, TINTA, 3);
        return;
      }
      sombraPlat(g, w, h + 12, .3);
      bloco(g, 0, 0, w, h, { topo: "#ffe08a", base: "#e8a03a", sombra: "#b06a1e", luz: "rgba(255,255,255,.6)" }, { raio: 4, topoH: 6, lw: 3.5, extra: g => { g.strokeStyle = ca(TINTA, .4); g.lineWidth = 2; g.beginPath(); for (let x = 0; x < w + h; x += 14) { g.moveTo(x, 8); g.lineTo(x - h, h + 8); } g.stroke(); } });
    },
    anim: function(g, p, i, est, t) {
      if (!p.esteira) return;
      const w = p.w, P = 48, k = "belt" + w + (p.esteira > 0 ? 1 : 0);
      const s = spr(k, w + P, 10, function(c) {
        c.fillStyle = "#262c37"; c.fillRect(0, 0, w + P, 10);
        for (let x = 0; x < w + P; x += 12) { c.fillStyle = "rgba(0,0,0,.4)"; c.fillRect(x, 0, 2, 10); }
        for (let x = 0; x < w + P; x += P) { c.fillStyle = "#ffd23f"; c.beginPath(); if (p.esteira > 0) { c.moveTo(x + 10, 1); c.lineTo(x + 22, 5); c.lineTo(x + 10, 9); c.lineTo(x + 15, 5); } else { c.moveTo(x + 22, 1); c.lineTo(x + 10, 5); c.lineTo(x + 22, 9); c.lineTo(x + 17, 5); } c.closePath(); c.fill(); }
      });
      const off = mod(t * p.esteira * 60, P), sx = p.esteira > 0 ? P - off : off;
      g.drawImage(s, sx, 0, w - 12, 10, Math.round(p.x + 6), Math.round(p.y + 2), w - 12, 10);
    },
    aquecer: function() { CEN.fabrica.gears.forEach((q, k) => engQuadros(k, q[2], q[3], q[4])); },
    gears: [[170, 250, 100, 18, "#e8a03a", .5], [262, 352, 62, 12, "#c8cce0", -.75], [1090, 570, 76, 18, "#e8a03a", -.4]],   // x, y, R, dentes, cor, vel (rad/s)
    fundo: function(g, est, t, V) {
      CEN.fabrica.gears.forEach(function(q, k) {
        const fr = engQuadros(k, q[2], q[3], q[4]), u = mod(t * q[5] / (TAU / 6), 1), s = fr[0].width;
        g.drawImage(fr[Math.floor(u * 14)], Math.round(q[0] - s / 2), Math.round(q[1] - s / 2));
      });
      const pf = [18, 30, 44].map(d => spr("vapor" + d, d + 4, d + 4, c => blobs(c, [[d / 2 + 2, d / 2 + 2, d / 2 - 2]], "#eef2fa", 1.5)));
      [[60, 640], [1220, 640]].forEach(function(q, kk) { for (let m = 0; m < 5; m++) { const u = mod(t * .45 + m / 5 + kk * .3, 1), sp = pf[u < .33 ? 0 : u < .66 ? 1 : 2]; g.globalAlpha = 1 - u; g.drawImage(sp, Math.round(q[0] - sp.width / 2 + Math.sin(u * 6 + m) * 8), Math.round(q[1] - 120 - u * 170 - sp.height / 2)); } });
      g.globalAlpha = 1;
      const on = (Math.floor(t * 3) % 2) === 0; g.fillStyle = on ? V.luz : "#6a4a1c"; rr(g, 626, 36, 28, 16, 6); g.fill(); tracar(g, TINTA, 2.5); if (on) glow(g, V.luz, 640, 44, 110, .6);
    }
  };

  // =====================================================================================
  // OCEANO — fundo do mar: raios de luz, recife de coral, naufrágio, algas, cardumes e bolhas (raso | abismo | coral ao pôr do sol)
  // =====================================================================================
  function ramoCoral(g, x, y, len, ang, w, cor, prof, r) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.lineWidth = w; g.strokeStyle = cor; g.lineCap = "round"; g.stroke();
    if (prof > 0) { ramoCoral(g, x2, y2, len * .72, ang - .5 + r() * .2, w * .75, cor, prof - 1, r); ramoCoral(g, x2, y2, len * .72, ang + .45 + r() * .2, w * .75, cor, prof - 1, r); }
  }
  function coral(g, x, y, s, cor, seed) {
    const r = rnd(seed), r2 = rnd(seed);
    g.save(); g.translate(x, y); g.scale(s, s);
    ramoCoral(g, 0, 0, 34, -Math.PI / 2, 14, TINTA, 3, r);           // contorno (mesmo galho mais grosso por baixo)
    ramoCoral(g, 0, 0, 34, -Math.PI / 2, 8, cor, 3, r2);
    g.restore();
  }
  function peixe(k, cor, cor2, vira) { return spr("peixe" + k, 30, 18, function(g) { if (vira) { g.translate(30, 0); g.scale(-1, 1); } poli(g, [2, 3, 10, 9, 2, 15]); g.fillStyle = cor2; g.fill(); tracar(g, TINTA, 1.8); g.beginPath(); g.ellipse(18, 9, 10, 6, 0, 0, TAU); g.fillStyle = cor; g.fill(); tracar(g, TINTA, 2); g.fillStyle = cor2; g.fillRect(14, 4, 3, 10); g.fillStyle = "#fff"; C(g, 23, 8, 2.4); g.fill(); g.fillStyle = TINTA; C(g, 23.6, 8, 1.2); g.fill(); }); }
  CEN.oceano = {
    vars: {
      raso:   { agua: ["#1a8ad8", "#1a7ac8", "#186ab8", "#165aa6", "#144c94", "#123f82"], k: 0, tint: "#ffffff", raios: .35, areia: "#f2d08a" },
      abismo: { agua: ["#0a2a5a", "#08224e", "#071c44", "#06163a", "#051230", "#040e28"], k: .45, tint: "#0a1a5a", raios: .12, areia: "#8a7aa8", bio: 1 },
      coral:  { agua: ["#3a6ac8", "#4a5ab8", "#5a4aa8", "#6a4098", "#703a88", "#6a3478"], k: .25, tint: "#8a3a8a", raios: .3, areia: "#f2b88a" }
    },
    acima: V => V.agua[0], abaixo: V => [mix(V.areia, TINTA, .2), mix(V.areia, TINTA, .35), mix(V.areia, TINTA, .5)],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 640, V.agua);
      // raios de luz vindo da superfície (pré-renderizado)
      for (let k = 0; k < 7; k++) { const x = 80 + k * 190, w = 40 + (k % 3) * 30; g.fillStyle = lin(g, 0, S.top, 0, 600, [[0, ca("#e0ffff", V.raios)], [1, ca("#e0ffff", 0)]]); poli(g, [x, S.top, x + w, S.top, x + w + 160, 600, x + 120, 600]); g.fill(); }
      // superfície ondulada lá em cima
      g.fillStyle = ca("#ffffff", .25); for (let x = -PAD; x < L + PAD; x += 40) { g.beginPath(); g.ellipse(x + 20, 4, 22, 5, 0, 0, TAU); g.fill(); }
      const r = rnd(26);
      // rochas do fundo distante
      camada(g, { seed: 61, y: 520, amp: 40, esc: 180, cor: T(mix(V.agua[3], TINTA, .25)), sombra: T(mix(V.agua[4], TINTA, .35)), bot: 700, cont: mix(V.agua[5], TINTA, .5), contW: 2.5 });
      // naufrágio
      g.save(); g.translate(1010, 560); g.rotate(-.12);
      poli(g, [-150, -50, 150, -50, 120, 20, -120, 20]); g.fillStyle = T("#6a4a3a"); g.fill(); tracar(g, TINTA, 3.5);
      g.fillStyle = T("#4a3228"); g.fillRect(-140, -30, 280, 8); for (let k = -3; k <= 3; k++) { C(g, k * 34, -14, 7); g.fillStyle = "#1a1030"; g.fill(); tracar(g, TINTA, 2); }
      g.beginPath(); g.moveTo(-20, -50); g.lineTo(-30, -200); tracar(g, TINTA, 9); g.beginPath(); g.moveTo(-20, -50); g.lineTo(-30, -200); tracar(g, T("#6a4a3a"), 5);
      poli(g, [-28, -190, 40, -150, -24, -120]); g.fillStyle = ca("#e8e0d0", .7); g.fill(); tracar(g, TINTA, 2.5);
      g.restore();
      // areia com conchas, corais e pedras
      const h2 = camada(g, { seed: 66, y: 610, amp: 16, esc: 160, cor: T(V.areia), sombra: T(mix(V.areia, "#a06a50", .35)), luz: "#fff4d0", bot: 740, cont: TINTA, contW: 3 });
      [[110, 1.1, "#ff6a8a"], [300, .8, "#ffb03a"], [480, 1, "#c06bff"], [760, .9, "#ff6a8a"], [1180, 1.2, "#4de0c0"], [880, .7, "#ffb03a"]].forEach((q, k) => coral(g, q[0], h2(q[0]) + 10, q[1], T(q[2], .5), 300 + k));
      for (let k = 0; k < 10; k++) { const x = r() * L, y = h2(x) + 16 + r() * 20; g.fillStyle = T(["#ffffff", "#ffb0c0", "#ffe0a0"][k % 3]); g.beginPath(); g.moveTo(x - 7, y); g.quadraticCurveTo(x, y - 12, x + 7, y); g.closePath(); g.fill(); tracar(g, TINTA, 1.8); }
      [[650, 30, 22], [40, 40, 28], [1240, 34, 24]].forEach(q => rocha(g, q[0] - q[1], h2(q[0]) - q[2] + 10, q[1] * 2, q[2] * 1.6, { base: T("#7a7ab0"), sombra: T("#5a5a8a"), luz: "rgba(255,255,255,.3)" }, q[0], { lw: 3 }));
    },
    pad: p => p.h > 40 ? [0, 22, 0, 0] : [10, 24, 10, 30],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .4 : k) * V.k), w = p.w, h = p.h, r = rnd(400 + i);
      if (h > 40) {
        g.fillStyle = T(V.areia); g.fillRect(0, 0, w, h + 40); g.fillStyle = T(mix(V.areia, "#a06a50", .3)); g.fillRect(0, 26, w, h + 20);
        g.strokeStyle = ca(TINTA, .25); g.lineWidth = 2.5; g.lineCap = "round"; for (let k = 0; k < 24; k++) { const x = r() * w, y = 20 + r() * 40; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 4, x + 20, y); g.stroke(); }
        g.fillStyle = "#fff4d0"; g.fillRect(0, 0, w, 7); g.fillStyle = TINTA; g.fillRect(0, 7, w, 3); g.fillRect(0, 0, w, 2);
        for (let k = 0; k < 8; k++) { const x = 40 + r() * (w - 80); g.save(); g.translate(x, 0); g.beginPath(); g.ellipse(0, -4, 12, 7, 0, Math.PI, TAU); g.closePath(); g.fillStyle = T("#3aa86a"); g.fill(); tracar(g, TINTA, 2); g.restore(); }
        return;
      }
      // laje de rocha coberta de coral, com anêmonas em cima
      bloco(g, 0, 0, w, h, { topo: T("#ff8aa8"), base: T("#8a7ab8"), sombra: T("#5a4a8a"), luz: "rgba(255,255,255,.45)" }, { raio: 10, topoH: 8, lw: 3.5, extra: g => { for (let k = 0; k < w / 22; k++) { C(g, 8 + r() * (w - 16), h * .45 + r() * h * .45, 2 + r() * 3); g.fillStyle = ca(TINTA, .3); g.fill(); } } });
      for (let k = 0; k < Math.round(w / 50); k++) { const x = 18 + r() * (w - 36), c = ["#ffd23f", "#4de0c0", "#ff6a8a"][k % 3]; for (let m = -2; m <= 2; m++) { g.beginPath(); g.moveTo(x + m * 3, 2); g.quadraticCurveTo(x + m * 6, -8, x + m * 7, -14); tracar(g, TINTA, 5); g.beginPath(); g.moveTo(x + m * 3, 2); g.quadraticCurveTo(x + m * 6, -8, x + m * 7, -14); tracar(g, T(c, .3), 2.5); } }
      g.strokeStyle = T("#3aa86a"); g.lineWidth = 3; g.lineCap = "round"; for (let k = 0; k < w / 60; k++) { const x = 14 + r() * (w - 28); g.beginPath(); g.moveTo(x, h - 2); g.bezierCurveTo(x + 8, h + 8, x - 8, h + 14, x + 2, h + 24); g.stroke(); }
    },
    aquecer: function() { const g = nova(4, 4).getContext("2d"), est = { altura: S.H, deslocY: S.dy }; for (let k = 0; k < 40; k++) CEN.oceano.fundo(g, est, k * .37, S.V); },
    fundo: function(g, est, t, V) {
      for (let k = 0; k < 7; k++) {   // algas ondulando (5 quadros prontos por alga)
        const x = [40, 300, 560, 700, 990, 1230, 1120][k], h = 150 + (k % 3) * 40, f = Math.max(0, Math.min(4, Math.round((Math.sin(t * .9 + k * 1.3) + 1) * 2)));
        const sp = spr("alga" + k + "_" + f, 90, h + 20, function(c) { c.translate(45, h + 14); c.rotate((f - 2) * .045); c.translate(-45, -(h + 14)); for (let m = 0; m < 2; m++) { const bx = 38 + m * 14, cam = () => { c.beginPath(); c.moveTo(bx, h + 12); c.bezierCurveTo(bx + 14, h * .7, bx - 14, h * .4, bx + 3, 8 + m * 16); }; cam(); tracar(c, TINTA, 11 - m * 2); cam(); tracar(c, m ? "#5ad07a" : "#2fa85a", 6 - m * 1.5); } });
        g.drawImage(sp, x - 45, 706 - h - 14);
      }
      const cores = [["#ffb84a", "#ff7a3a"], ["#7ae0ff", "#2a9ad8"], ["#ff8ab0", "#d84a7a"]];
      [[0, 240, 70, 1, 6], [1, 410, 54, -1, 5], [2, 520, 86, 1, 5], [0, 150, 40, -1, 4]].forEach(function(q, k) {
        const fs = peixe(q[0] * 2 + (q[3] < 0 ? 1 : 0), cores[q[0]][0], cores[q[0]][1], q[3] < 0);
        for (let m = 0; m < q[4]; m++) { const x = mod(q[2] * t * q[3] + k * 330 + m * 30 + Math.sin(t * 2 + m) * 6, L + 120) - 60, y = q[1] + Math.sin(t * 1.1 + m * .9 + k) * 22 + (m % 3) * 14; g.drawImage(fs, Math.round(x - 15), Math.round(y - 9)); }
      });
      [[610, 200, 0], [60, 140, 2]].forEach(q => { const f = Math.floor(mod(t * 2.4 + q[2], TAU) / TAU * 3), sp = spr("jelly" + f, 48, 60, function(c) { const sx = 1 + .1 * (f - 1); c.translate(24, 6); c.scale(1 / sx, sx); c.translate(-20, 0); c.strokeStyle = TINTA; c.lineWidth = 2; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(10 + i * 7, 20); c.quadraticCurveTo(8 + i * 8 + (f - 1) * 3, 34, 12 + i * 7, 48); c.stroke(); } c.beginPath(); c.ellipse(20, 16, 17, 14, 0, Math.PI, TAU); c.quadraticCurveTo(37, 24, 20, 22); c.quadraticCurveTo(3, 24, 3, 16); c.fillStyle = V.bio ? "#7af0ff" : "#ff9ae0"; c.fill(); tracar(c, TINTA, 2.5); c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.ellipse(13, 9, 5, 2.5, -.4, 0, TAU); c.fill(); });
        if (V.bio) glow(g, "#7af0ff", q[0] + Math.sin(t * .4 + q[2]) * 30, q[1] + Math.sin(t * .8 + q[2]) * 24, 90, .4);
        g.drawImage(sp, Math.round(q[0] + Math.sin(t * .4 + q[2]) * 30 - 24), Math.round(q[1] + Math.sin(t * .8 + q[2]) * 24 - 30)); });
      const bo = [6, 9, 12, 15].map(d => spr("bolha" + d, d + 4, d + 4, function(c) { C(c, d / 2 + 2, d / 2 + 2, d / 2 - .5); c.fillStyle = "rgba(220,250,255,.25)"; c.fill(); tracar(c, "rgba(255,255,255,.9)", 1.6); c.fillStyle = "#ffffff"; C(c, d * .34 + 2, d * .34 + 2, Math.max(1, d * .1)); c.fill(); }));
      const nb = leve() ? 12 : 24;
      for (let k = 0; k < nb; k++) { const u = mod(t * (.06 + (k % 4) * .018) + k * .137, 1), x = ((k * 197) % 1240) + 20 + Math.sin(t * 1.4 + k * 2) * 8; g.drawImage(bo[k % 4], Math.round(x), Math.round(est.altura - u * (est.altura + 40) - est.deslocY)); }
    },
    frente: function(g, est, t) {
      g.fillStyle = "rgba(40,150,225,.07)"; g.fillRect(0, -est.deslocY, L, est.altura);
      const ca2 = spr("caustica", 256, 96, function(c) { const r3 = rnd(3); c.strokeStyle = "rgba(220,255,255,.3)"; c.lineWidth = 2.5; c.lineCap = "round"; for (let i = 0; i < 14; i++) { const x = r3() * 256, y = r3() * 96; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 24, y - 14, x + 40, y + 12, x + 62, y - 4); c.stroke(); } });
      for (let k = 0; k < 6; k++) g.drawImage(ca2, Math.round(mod(k * 256 + t * 22, L + 256) - 256), Math.round(6 + (k % 2) * 40));
    }
  };

  // =====================================================================================
  // TEMPLO — ruínas na selva: pirâmide de degraus, colunas, cipós e portais mágicos (pôr do sol | noite | dia)
  // =====================================================================================
  function portalQuadros(cor, cor2) {
    const k = "portal" + cor; if (S.sp[k]) return S.sp[k];
    const NA = 12, NS = 28, anel = [], esp = [];
    for (let f = 0; f < NA; f++) { const c = nova(100, 100), g = c.getContext("2d"); g.translate(50, 50); C(g, 0, 0, 40); tracar(g, TINTA, 10); C(g, 0, 0, 40); tracar(g, cor, 6); C(g, 0, 0, 40); tracar(g, "#ffffff", 1.6); g.rotate(f / NA * TAU / 12); for (let i = 0; i < 12; i++) { g.save(); g.rotate(i / 12 * TAU); g.fillStyle = i % 2 ? "#ffffff" : cor2; g.fillRect(-2.5, -48, 5, 9); g.strokeStyle = TINTA; g.lineWidth = 1.5; g.strokeRect(-2.5, -48, 5, 9); g.restore(); } anel.push(c); }
    for (let f = 0; f < NS; f++) { const c = nova(100, 100), g = c.getContext("2d"); g.translate(50, 50); C(g, 0, 0, 37); g.fillStyle = ca(mix(cor, TINTA, .6), .7); g.fill(); g.rotate(f / NS * Math.PI / 2); g.lineCap = "round"; for (let q = 0; q < 4; q++) { g.save(); g.rotate(q * Math.PI / 2); g.beginPath(); for (let a2 = 0; a2 < 4.2; a2 += .2) { const r3 = 4 + a2 * 8; g[a2 ? "lineTo" : "moveTo"](Math.cos(a2 + .4) * r3, Math.sin(a2 + .4) * r3); } g.lineWidth = 6; g.strokeStyle = cor; g.stroke(); g.lineWidth = 2; g.strokeStyle = "rgba(255,255,255,.9)"; g.stroke(); g.restore(); } esp.push(c); }
    return S.sp[k] = { anel: anel, esp: esp };
  }
  CEN.templo = {
    vars: {
      tarde: { ceu: ["#3a1a6a", "#6a2a86", "#b8407e", "#f06a6a", "#ff9a5a", "#ffc87a"], k: .25, tint: "#b0405a", astro: "sol" },
      noite: { ceu: ["#06102a", "#0a1a3a", "#0e244a", "#122e5a", "#183a6a", "#1e4678"], k: .45, tint: "#1a3a7a", astro: "lua" },
      dia:   { ceu: ["#3aa0ff", "#58b4ff", "#7ac8ff", "#9cdaff", "#c0eaff", "#e8f8ff"], k: 0, tint: "#ffffff", astro: "sol" }
    },
    acima: V => V.ceu[0], abaixo: V => [mix("#5a6a60", V.tint, V.k * .5), mix("#46564e", V.tint, V.k * .5), mix("#34423c", V.tint, V.k * .5)],
    aquecer: function() { portalQuadros("#4de0c0", "#c8fff0"); portalQuadros("#b58bff", "#e0d0ff"); },
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 520, V.ceu);
      if (V.astro === "lua") { estrelas(g, 140, 91, S.top, 360, "#ffffff"); luaCrescente(g, 1040, 110, 40, "#f4f8ff"); }
      else astro(g, V.k ? 640 : 1010, V.k ? 330 : 120, 64, "#ffe45c", "#fff6b0", "#f08a24", "#fff0a0", .4);
      // morros da selva
      camada(g, { seed: 71, y: 470, amp: 40, esc: 200, cor: T("#3a8a6a"), sombra: T("#2a6a54"), bot: 700, cont: T("#1e4a3e"), contW: 2.5 });
      // pirâmide de degraus no meio com porta escura (onde fica o portal de baixo)
      const cx = 640;
      for (let k = 0; k < 6; k++) { const y = 610 - k * 52, w = 700 - k * 100; g.fillStyle = T(k % 2 ? "#a8a088" : "#9a927a"); g.fillRect(cx - w / 2, y - 52, w, 52); g.fillStyle = T("#7a725e"); g.fillRect(cx + w * .2, y - 52, w * .3, 52); g.fillStyle = T("#d8d0b0"); g.fillRect(cx - w / 2, y - 52, w, 7); g.strokeStyle = TINTA; g.lineWidth = 3; g.strokeRect(cx - w / 2, y - 52, w, 52); }
      g.fillStyle = T("#6a8a5a"); for (let k = 0; k < 40; k++) { const y = 300 + (k * 37) % 300, x = cx + ((k * 97) % 600) - 300; if (Math.abs(x - cx) < 350 - (610 - y) * .9) { g.beginPath(); g.ellipse(x, y, 12, 5, 0, 0, TAU); g.fill(); } }
      // glifos
      g.strokeStyle = ca(TINTA, .45); g.lineWidth = 2.5; [[520, 470], [760, 470], [600, 360], [680, 360]].forEach(q => { g.strokeRect(q[0] - 10, q[1] - 10, 20, 20); g.beginPath(); g.moveTo(q[0] - 5, q[1]); g.lineTo(q[0] + 5, q[1]); g.moveTo(q[0], q[1] - 5); g.lineTo(q[0], q[1] + 5); g.stroke(); });
      // colunas quebradas e cipós nos lados
      [[150, 220], [1130, 260], [300, 120], [980, 140]].forEach((q, k) => {
        g.fillStyle = T("#c8c0a0"); g.fillRect(q[0] - 26, 660 - q[1], 52, q[1]); g.fillStyle = T("#9a927a"); g.fillRect(q[0] + 6, 660 - q[1], 20, q[1]);
        g.strokeStyle = ca(TINTA, .3); g.lineWidth = 2; for (let x = -16; x <= 16; x += 11) { g.beginPath(); g.moveTo(q[0] + x, 670 - q[1]); g.lineTo(q[0] + x, 660); g.stroke(); }
        g.strokeStyle = TINTA; g.lineWidth = 3; g.strokeRect(q[0] - 26, 660 - q[1], 52, q[1]);
        poli(g, [q[0] - 32, 660 - q[1], q[0] + 32, 660 - q[1], q[0] + 20, 660 - q[1] - 14 - k * 3, q[0] - 6, 660 - q[1] - 6, q[0] - 24, 660 - q[1] - 12]); g.fillStyle = T("#d8d0b0"); g.fill(); tracar(g, TINTA, 3);
      });
      const r = rnd(5);
      for (let k = 0; k < 9; k++) { const x = r() * L, fim = 120 + r() * 200; g.beginPath(); g.moveTo(x, -20); for (let y = -20; y < fim; y += 20) g.lineTo(x + Math.sin(y / 30 + k) * 10, y); tracar(g, TINTA, 6); g.beginPath(); g.moveTo(x, -20); for (let y = -20; y < fim; y += 20) g.lineTo(x + Math.sin(y / 30 + k) * 10, y); tracar(g, T("#4ab06a"), 3); }
      { const b = []; for (let x = -PAD - 30; x < L + PAD + 40; x += 50 + r() * 40) b.push([x, -26 + r() * 14, 26 + r() * 18]); blobs(g, b, T("#2e8a4a"), 3); g.fillStyle = T("#5ac46a"); b.forEach(c => { g.beginPath(); g.ellipse(c[0] - c[2] * .2, c[1] + c[2] * .25, c[2] * .45, c[2] * .18, 0, 0, TAU); g.fill(); }); }   // copa da selva
      // folhagem da frente
      const b = []; for (let x = -PAD; x < L + PAD; x += 70 + r() * 60) if (x < 420 || x > 860) b.push([x, 650 + r() * 10, 26 + r() * 20]);
      blobs(g, b, T("#3aa05a"), 3); g.fillStyle = T("#6ad07a"); b.forEach(c => { g.beginPath(); g.ellipse(c[0] - c[2] * .2, c[1] - c[2] * .4, c[2] * .45, c[2] * .2, -.3, 0, TAU); g.fill(); });
    },
    pad: p => p.w > 1000 ? [0, 12, 0, 0] : [10, 12, 10, 28],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .4 : k) * V.k), w = p.w, h = p.h, r = rnd(180 + i);
      if (w > 1000) {
        g.fillStyle = T("#8a9a88"); g.fillRect(0, 0, w, h + 40);
        for (let y = 12, row = 0; y < h + 40; y += 28, row++) for (let x = -(row % 2) * 64; x < w; x += 128) { g.fillStyle = T(((x / 128 + row) & 1) ? "#7a8a78" : "#6e7e6c"); g.fillRect(x + 2, y + 2, 124, 24); g.strokeStyle = ca(TINTA, .5); g.lineWidth = 2.5; g.strokeRect(x + 2, y + 2, 124, 24); }
        g.fillStyle = T("#d8d0b0"); g.fillRect(0, 0, w, 10); g.fillStyle = TINTA; g.fillRect(0, 10, w, 3); g.fillRect(0, 0, w, 2);
        grama(g, 0, 2, w, T("#7af09a"), T("#3a9a5a"), 9, 7);
        return;
      }
      // laje de arenito dourado com runas e musgo
      bloco(g, 0, 0, w, h, { topo: T("#ffe0a0"), base: T("#e0a860"), sombra: T("#b07a40"), luz: "rgba(255,255,255,.55)" }, { raio: 5, topoH: 6, lw: 3.5, extra: g => {
        for (let k = 0; k < 3; k++) { const x = w * (.22 + k * .28); g.fillStyle = "#4de0c0"; g.fillRect(x - 4, h / 2 - 2, 8, 8); g.strokeStyle = TINTA; g.lineWidth = 2; g.strokeRect(x - 4, h / 2 - 2, 8, 8); }
      } });
      grama(g, 3, 1, w - 6, T("#7af09a"), T("#3a9a5a"), 30 + i, 6);
      g.strokeStyle = TINTA; g.lineWidth = 4.5; g.lineCap = "round"; const cips = []; for (let k = 0; k < Math.round(w / 90); k++) cips.push([14 + r() * (w - 28), 12 + r() * 14]);
      cips.forEach(c => { g.beginPath(); g.moveTo(c[0], h - 2); g.bezierCurveTo(c[0] + 6, h + 6, c[0] - 6, h + 10, c[0] + 2, h + c[1]); g.stroke(); });
      g.strokeStyle = T("#4ab06a"); g.lineWidth = 2.2; cips.forEach(c => { g.beginPath(); g.moveTo(c[0], h - 2); g.bezierCurveTo(c[0] + 6, h + 6, c[0] - 6, h + 10, c[0] + 2, h + c[1]); g.stroke(); });
    },
    extra: function(g, est, t) { // portais: anel e espiral girando em sentidos contrários + brilho pulsante
      const ps = est.portais; if (!ps) return;
      for (let i = 0; i < ps.length; i++) for (let e = 0; e < 2; e++) {
        const p = ps[i][e], cor = e ? "#b58bff" : "#4de0c0", cor2 = e ? "#e0d0ff" : "#c8fff0", sp = portalQuadros(cor, cor2);
        glow(g, cor, p.x, p.y, 180, .5 + .25 * Math.sin(t * 3 + e));
        g.drawImage(sp.esp[Math.floor(mod(-t * 1.6 / (Math.PI / 2), 1) * sp.esp.length)], Math.round(p.x - 50), Math.round(p.y - 50));
        g.drawImage(sp.anel[Math.floor(mod(t * .5 / (TAU / 12), 1) * sp.anel.length)], Math.round(p.x - 50), Math.round(p.y - 50));
      }
    },
    fundo: function(g, est, t) {
      const cr = spr("cristal", 28, 44, c => { c.translate(2, 2); poli(c, [12, 1, 22, 20, 12, 39, 2, 20]); c.fillStyle = "#4de0c0"; c.fill(); poli(c, [12, 1, 2, 20, 12, 20]); c.fillStyle = "#c8fff0"; c.fill(); poli(c, [12, 20, 22, 20, 12, 39]); c.fillStyle = "#1f9a8a"; c.fill(); poli(c, [12, 1, 22, 20, 12, 39, 2, 20]); tracar(c, TINTA, 2.5); });
      [[190, 150], [1090, 190], [420, 100], [860, 120]].forEach(function(q, k) { const y = q[1] + Math.sin(t * 1.2 + k * 1.7) * 10; glow(g, "#4de0c0", q[0], y, 60, .5); g.drawImage(cr, q[0] - 14, Math.round(y - 22)); });
      const pt = spr("runaPt", 10, 10, c => { c.fillStyle = "#c8fff0"; c.fillRect(3, 3, 4, 4); c.strokeStyle = TINTA; c.lineWidth = 1.5; c.strokeRect(3, 3, 4, 4); });
      for (let k = 0; k < 12; k++) { const u = mod(t * .18 + k / 12, 1); g.globalAlpha = Math.sin(u * 3.14); g.drawImage(pt, k % 2 ? L - 18 : 8, Math.round(640 - u * 520)); } g.globalAlpha = 1;
    }
  };

  // =====================================================================================
  // CASTELO — fortaleza na rocha, tochas, meteoros e relâmpagos (tempestade | lua de sangue | amanhecer)
  // =====================================================================================
  function torre(g, x, base, w, h, c, cs, teto, luz, seed) {
    g.fillStyle = c; g.fillRect(x, base - h, w, h); g.fillStyle = cs; g.fillRect(x + w * .62, base - h, w * .38, h);
    g.strokeStyle = TINTA; g.lineWidth = 3; g.strokeRect(x, base - h, w, h);
    if (teto) { poli(g, [x - 6, base - h, x + w + 6, base - h, x + w / 2, base - h - w * 1.2]); g.fillStyle = teto; g.fill(); tracar(g, TINTA, 3); g.beginPath(); g.moveTo(x + w / 2, base - h - w * 1.2); g.lineTo(x + w / 2, base - h - w * 1.2 - 16); tracar(g, TINTA, 2.5); poli(g, [x + w / 2, base - h - w * 1.2 - 16, x + w / 2 + 14, base - h - w * 1.2 - 12, x + w / 2, base - h - w * 1.2 - 8]); g.fillStyle = "#e03a4a"; g.fill(); tracar(g, TINTA, 2); }
    else { const n = Math.max(2, Math.round(w / 14)), mw = w / (n * 2 - 1); for (let i = 0; i < n; i++) { g.fillStyle = c; g.fillRect(x + i * mw * 2, base - h - 10, mw, 11); g.strokeRect(x + i * mw * 2, base - h - 10, mw, 11); } }
    const r = rnd(seed); for (let k = 0; k < Math.floor(h / 46); k++) { const wx = x + w * (.3 + r() * .2), wy = base - h + 18 + k * 46; g.fillStyle = luz; rr(g, wx, wy, 8, 13, 4); g.fill(); g.strokeStyle = TINTA; g.lineWidth = 2; g.stroke(); }
  }
  function tijolos(g, x, y, w, h, c, seed, bw, bh) {
    const r = rnd(seed); bw = bw || 28; bh = bh || 14;
    for (let yy = y, row = 0; yy < y + h; yy += bh, row++) for (let xx = x - (row % 2) * bw / 2; xx < x + w; xx += bw) { g.fillStyle = mix(c, r() < .5 ? "#ffffff" : "#1a1840", r() * .12); g.fillRect(xx + 1.5, yy + 1.5, bw - 3, bh - 3); }
  }
  CEN.castelo = {
    vars: {
      tempestade: { ceu: ["#080b1e", "#10163a", "#1a2250", "#262e66", "#343a78", "#4a4686"], nv: ["#3a4272", "#262c56", "#14183a"], k: .1, tint: "#1a2050", lua: "#dfe4ff", raios: 1 },
      sangue:     { ceu: ["#12040e", "#220818", "#360c22", "#4a102a", "#5e1630", "#741e36"], nv: ["#4a1a30", "#2e0e20", "#180610"], k: .3, tint: "#5a0a20", lua: "#ff5a4a", raios: 1 },
      amanhecer:  { ceu: ["#2a2a6a", "#4a3a8a", "#7a4a9a", "#c0609a", "#f08a8a", "#ffc08a"], nv: ["#8a7ab8", "#6a5a98", "#4a3a78"], k: .15, tint: "#8a4a8a", lua: null, raios: 0 }
    },
    acima: V => V.ceu[0], abaixo: V => [mix("#3a3a64", V.tint, V.k), mix("#2c2c52", V.tint, V.k), mix("#1e1e40", V.tint, V.k)],
    pre: function(g, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? 1 : k) * V.k);
      ceu(g, 0, 560, V.ceu);
      if (V.lua) { estrelas(g, 60, 101, S.top, 260, "#e0e4ff"); halo(g, 980, 120, 110, V.lua, .3, 5); C(g, 980, 120, 40); g.fillStyle = V.lua; g.fill(); tracar(g, TINTA, 3); g.fillStyle = ca(TINTA, .15); C(g, 970, 110, 9); g.fill(); C(g, 992, 132, 6); g.fill(); }
      else astro(g, 300, 470, 60, "#ffe07a", "#fff4c0", "#f08a4a", "#ffe0a0", .4);
      const r = rnd(191);
      for (let k = 0; k < 2; k++) for (let i = 0; i < 6; i++) nuvem(g, r() * L, 40 + k * 100 + r() * 70, 260 + r() * 200, V.nv[0], V.nv[1], V.nv[2], 2.5);
      montanhas(g, { y: 560, alt: 190, passo: 160, seed: 31, cor: T("#4a4a7a"), sombra: T("#34345e"), bot: 680, cont: TINTA, contW: 2.5 });
      // penhasco com a fortaleza
      poli(g, [520, 640, 560, 500, 640, 470, 760, 450, 1000, 460, 1100, 500, 1160, 640]); g.fillStyle = T("#3a3a62"); g.fill(); tracar(g, TINTA, 3);
      const c0 = T("#6a6a9e"), c1 = T("#4c4c80"), teto = T("#3a4aa8"), luz = V.lua ? "#ffd070" : "#ffe9b0";
      g.fillStyle = c0; g.fillRect(620, 410, 480, 70); g.strokeStyle = TINTA; g.lineWidth = 3; g.strokeRect(620, 410, 480, 70); tijolos(g, 622, 412, 476, 66, c0, 4, 28, 14);
      torre(g, 640, 420, 56, 160, c0, c1, teto, luz, 3); torre(g, 730, 430, 74, 240, c0, c1, null, luz, 4); torre(g, 830, 420, 54, 200, c0, c1, teto, luz, 6); torre(g, 910, 430, 84, 170, c0, c1, null, luz, 8); torre(g, 1030, 430, 52, 140, c0, c1, teto, luz, 9);
      g.fillStyle = "#1a1030"; g.beginPath(); g.moveTo(884, 480); g.lineTo(884, 450); g.arc(906, 450, 22, Math.PI, 0); g.lineTo(928, 480); g.fill(); tracar(g, TINTA, 3);
      // muralha da esquerda
      g.fillStyle = T("#5a5a8a"); g.fillRect(40, 480, 360, 100); g.strokeRect(40, 480, 360, 100); tijolos(g, 42, 482, 356, 96, T("#5a5a8a"), 7, 28, 14);
      for (let i = 0; i < 13; i++) { g.fillStyle = T("#5a5a8a"); g.fillRect(44 + i * 28, 468, 16, 13); g.strokeRect(44 + i * 28, 468, 16, 13); }
      torre(g, 80, 480, 48, 120, T("#5a5a8a"), T("#44446e"), teto, luz, 21); torre(g, 310, 480, 54, 140, T("#5a5a8a"), T("#44446e"), teto, luz, 22);
      bruma(g, 60, 600, V.ceu[1], .35, 3);
      camada(g, { seed: 3, y: 630, amp: 12, esc: 140, cor: T("#3a3a64"), sombra: T("#2c2c52"), luz: T("#8a8ac8", .5), bot: 740, cont: TINTA, contW: 3 });
      // pilares com tocha (esquerda e direita)
      [60, 1220].forEach(x => { g.fillStyle = T("#4c4c80"); g.fillRect(x - 22, 560, 44, 110); g.strokeStyle = TINTA; g.lineWidth = 3; g.strokeRect(x - 22, 560, 44, 110); tijolos(g, x - 21, 561, 42, 100, T("#4c4c80"), x, 21, 12); g.fillStyle = T("#7a7aac"); g.fillRect(x - 28, 550, 56, 12); g.strokeRect(x - 28, 550, 56, 12); g.fillStyle = "#8a5a3a"; g.fillRect(x - 4, 588, 8, 26); g.strokeRect(x - 4, 588, 8, 26); g.fillStyle = "#ffd23f"; g.fillRect(x - 8, 584, 16, 7); g.strokeRect(x - 8, 584, 16, 7); });
    },
    pad: p => p.w > 1000 ? [0, 14, 0, 0] : [10, 18, 10, 20],
    plat: function(g, p, i, V) {
      const T = (c, k) => mix(c, V.tint, (k == null ? .4 : k) * V.k), w = p.w, h = p.h;
      if (w > 1000) {
        g.fillStyle = T("#3a3a64"); g.fillRect(0, 0, w, h + 40); tijolos(g, 0, 14, w, h + 30, T("#5a5a90"), 3, 34, 16);
        g.fillStyle = T("#a8aad8"); g.fillRect(0, 0, w, 12); g.fillStyle = "rgba(255,255,255,.45)"; g.fillRect(0, 2, w, 3); g.fillStyle = TINTA; g.fillRect(0, 12, w, 3); g.fillRect(0, 0, w, 2);
        for (let x = 40; x < w; x += 180) { g.fillStyle = "#12122a"; rr(g, x, 26, 9, 22, 4.5); g.fill(); }
        return;
      }
      // ponte de pedra com ameias em cima
      const n = Math.max(3, Math.round(w / 34)), mw = w / (n * 2 - 1);
      for (let k = 0; k < n; k++) { g.fillStyle = T("#e8b878"); g.fillRect(k * mw * 2, -12, mw, 14); g.strokeStyle = TINTA; g.lineWidth = 3; g.strokeRect(k * mw * 2, -12, mw, 14); }
      bloco(g, 0, 0, w, h, { topo: T("#ffe0a0"), base: T("#c88a5a"), sombra: T("#8a5a3a"), luz: "rgba(255,255,255,.55)" }, { raio: 4, topoH: 8, lw: 3.5, extra: g => tijolos(g, 0, 12, w, h, T("#c88a5a"), 40 + i, 26, 12) });
      g.fillStyle = "#ffd23f"; [8, w - 8].forEach(x => { C(g, x, h / 2 + 3, 3); g.fill(); tracar(g, TINTA, 1.5); });
    },
    fundo: function(g, est, t, V) {
      const ch = [0, 1, 2].map(k => spr("chama" + k, 28, 38, c => { c.translate(2, 2); c.beginPath(); c.moveTo(12, 33); c.bezierCurveTo(-2 + k * 2, 22, 6, 12, 12 + (k - 1) * 3, 1); c.bezierCurveTo(18, 12, 26 - k * 2, 22, 12, 33); c.fillStyle = "#ff8a30"; c.fill(); tracar(c, TINTA, 2.5); c.fillStyle = "#ffd04a"; c.beginPath(); c.moveTo(12, 31); c.bezierCurveTo(6, 25, 8, 18, 12 + (k - 1) * 2, 10); c.bezierCurveTo(16, 18, 18, 25, 12, 31); c.fill(); }));
      [60, 1220].forEach((x, k) => { glow(g, "#ff9a40", x, 575, 100, .5 + .2 * Math.sin(t * 9 + k)); g.drawImage(ch[Math.floor(t * 9 + k * 2) % 3], x - 14, 550); });
      const me = spr("meteoroCast", 120, 30, c => { c.fillStyle = lin(c, 0, 0, 104, 0, [[0, "rgba(255,120,40,0)"], [1, "rgba(255,170,60,.8)"]]); poli(c, [0, 15, 104, 9, 104, 21]); c.fill(); C(c, 106, 15, 9); c.fillStyle = "#ffd070"; c.fill(); tracar(c, TINTA, 2.5); C(c, 104, 13, 3.5); c.fillStyle = "#fff6d0"; c.fill(); });
      [[0, 7.3], [2.6, 9.1], [5.1, 11.2]].forEach((q, k) => { const u = mod(t + q[0], q[1]) / 1.6; if (u > 1) return; const x = 150 + k * 370 + u * 360, y = 40 + k * 20 + u * 240; g.save(); g.translate(x, y); g.rotate(.62); g.globalAlpha = Math.sin(u * 3.14); g.drawImage(me, -120, -15); g.restore(); }); g.globalAlpha = 1;
      if (!V.raios) return;
      const per = 7.4, u = mod(t, per), ev = Math.floor(t / per);
      const f = u < .07 ? 1 : u < .13 ? .15 : u < .22 ? .85 : u < .55 ? (.55 - u) / .33 * .45 : 0;
      if (f > .01) {
        g.fillStyle = "rgba(190,200,255," + (.3 * f).toFixed(3) + ")"; g.fillRect(0, -est.deslocY, L, 480 + est.deslocY);
        if (u < .3) { const r3 = rnd(ev * 7 + 3), x0 = 80 + r3() * 1100; g.beginPath(); let x = x0, y = -est.deslocY; g.moveTo(x, y); while (y < 380) { x += (r3() - .5) * 60; y += 30 + r3() * 30; g.lineTo(x, y); } g.globalAlpha = f; tracar(g, TINTA, 9); tracar(g, "#ffffff", 4); g.globalAlpha = 1; }
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
      const m = Math.max(40, Math.min(dy, Math.ceil(-topoMundo)));   // o céu visível acima da arena (antes ia a tela toda)
      if (-topoMundo > m) ceuAcima(ctx, d, f, dy - m, x0, x1, topoMundo, -m + 2);
      ctx.drawImage(f, 0, dy - m, L + PAD * 2, A + m, bx - PAD, -m, L + PAD * 2, A + m);
      const ab = d.abaixo ? d.abaixo(S.V) : ["#1f0f44"], hh = baseMundo - A;
      if (hh > 0) for (let i = 0; i < ab.length; i++) { ctx.fillStyle = ab[i]; const y = A + Math.round(hh * i / ab.length); ctx.fillRect(x0, y - (i ? 0 : 1), x1 - x0, Math.ceil(hh / ab.length) + 2); }
      S.px = bx;
    } else {
      ctx.drawImage(f, bx - PAD, -dy);
      S.px = bx;
    }
  }
  // v19.1: em pé, acima da arena aparecia uma faixa lisa (no fliperama até de outra cor). Agora o céu continua: a cor
  // é a da 1ª linha do fundo pronto (lida 1 vez por fundo), em 6 faixas que escurecem de leve para cima, e estrelas
  // quando o céu é escuro. Por quadro: 6 retângulos e, no escuro, 1 lote de pontos.
  function ceuAcima(ctx, d, f, yFundo, x0, x1, y0, y1) {
    if (S.ceuDe !== f) {
      let cor = d.acima ? d.acima(S.V) : "#2a1458";
      try {
        const px = f.getContext("2d").getImageData(Math.floor(f.width / 2), Math.max(0, Math.floor(yFundo) + 1), 1, 1).data;
        cor = "#" + [px[0], px[1], px[2]].map(function(v) { return (v < 16 ? "0" : "") + v.toString(16); }).join("");
      } catch (e) { /* sem leitura: fica a cor do mapa */ }
      const v = hex(cor), lum = (v[0] * .3 + v[1] * .59 + v[2] * .11) / 255;
      S.ceuDe = f;
      S.ceuCores = [0, 1, 2, 3, 4, 5].map(function(i) { return mix(cor, "#1a0d33", i * (lum > .5 ? .035 : .06)); });
      S.ceuEstrelas = null;
      if (lum < .32) { const r = rnd(1234), e = []; for (let i = 0; i < 70; i++) e.push(r(), r(), r() < .15 ? 3 : 2); S.ceuEstrelas = e; }
    }
    const h = y1 - y0, n = S.ceuCores.length, faixa = Math.min(140, h / n);
    // de baixo (junto do fundo) para cima: a última faixa vai até o topo
    for (let i = 0; i < n; i++) {
      const yb = y1 - faixa * i, yt = i === n - 1 ? y0 : yb - faixa;
      ctx.fillStyle = S.ceuCores[i]; ctx.fillRect(x0, yt, x1 - x0, yb - yt + 1);
    }
    if (S.ceuEstrelas) {
      const e = S.ceuEstrelas; ctx.fillStyle = "rgba(255,255,255,.75)";
      for (let i = 0; i < e.length; i += 3) ctx.fillRect(Math.round(x0 + e[i] * (x1 - x0)), Math.round(y0 + e[i + 1] * (h - 30)), e[i + 2], e[i + 2]);
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
