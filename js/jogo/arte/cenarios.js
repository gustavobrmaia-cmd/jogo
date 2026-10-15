"use strict";

// =========================
// ARTE DOS 15 CENÁRIOS (v2) — ilustração em camadas com perspectiva atmosférica
//  prerender              -> fundo fixo rico (céu, 4–6 camadas de paisagem, luz, detalhes), feito uma vez por rodada
//  desenharFundoAnimado   -> poucos sprites animados (nuvens, estrelas, neve, bolhas, engrenagens...)
//  desenharPlataformas    -> sprite pré-renderizado por plataforma (pedra, gelo, metal, madeira, neon...) + animações baratas
//  desenharFrente         -> lava, água, escuridão, vento, aviso de inversão (por cima de tudo)
// Todo o peso fica no prerender; por quadro só drawImage de sprites e poucas formas simples.
// =========================
const ArteCenarios = (function() {
  const L = 1280, A = 720, TAU = Math.PI * 2;
  let S = null;                 // estado do cenário atual: { id, H, dy, sp (sprites), pl (plataformas) }
  const CEN = {};               // definição de cada cenário (preenchida abaixo)
  const DEST = {                // cor de destaque (título da rodada no HUD)
    campo: "#7bd34a", gelo: "#8fe3ff", lua: "#c9d3ff", vulcao: "#ff7a2f", espaco: "#b58bff",
    laboratorio: "#4de3d0", dojo: "#ff8f66", cidade: "#ff4fd8", fliperama: "#ffd23f",
    floresta: "#6fe0a0", deserto: "#ffc15a", fabrica: "#ffb02e", oceano: "#4fc3f7",
    templo: "#4de0c0", castelo: "#b8a4ff"
  };

  // ---------- ajudantes gerais ----------
  function nova(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function rnd(s) { s = s >>> 0; return function() { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const _hx = {};
  function hex(h) { let v = _hx[h]; if (!v) { const n = parseInt(h.slice(1), 16); v = _hx[h] = [n >> 16, (n >> 8) & 255, n & 255]; } return v; }
  function mix(a, b, t) { const p = hex(a), q = hex(b); return "#" + [0, 1, 2].map(i => { const v = Math.round(p[i] + (q[i] - p[i]) * t); return (v < 16 ? "0" : "") + v.toString(16); }).join(""); }
  function ca(h, a) { const v = hex(h); return "rgba(" + v[0] + "," + v[1] + "," + v[2] + "," + a + ")"; }
  function clar(h, t) { return mix(h, "#fff5dc", t); }        // luz quente
  function somb(h, t) { return mix(h, "#2a1f58", t); }        // sombra puxada para azul/roxo
  function lin(g, x0, y0, x1, y1, p) { const q = g.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < p.length; i++) q.addColorStop(p[i][0], p[i][1]); return q; }
  function rad(g, x, y, r, p, x2, y2, r2) { const q = g.createRadialGradient(x2 == null ? x : x2, y2 == null ? y : y2, r2 || 0, x, y, r); for (let i = 0; i < p.length; i++) q.addColorStop(p[i][0], p[i][1]); return q; }
  // céu/fundo em faixas chapadas de 3 px (gradiente grande é caro no raster por software; faixas custam ~10x menos)
  function ceu(g, gy0, gy1, p, T, B) {
    const st = p.map(q => [q[0], hex(q[1])]);
    for (let y = Math.floor(T); y < B; y += 3) {
      const u = Math.max(0, Math.min(1, (y + 1.5 - gy0) / (gy1 - gy0))); let i = 0; while (i < st.length - 2 && u > st[i + 1][0]) i++;
      const a = st[i], b = st[i + 1], k = b[0] === a[0] ? 0 : Math.max(0, Math.min(1, (u - a[0]) / (b[0] - a[0])));
      g.fillStyle = "rgb(" + Math.round(a[1][0] + (b[1][0] - a[1][0]) * k) + "," + Math.round(a[1][1] + (b[1][1] - a[1][1]) * k) + "," + Math.round(a[1][2] + (b[1][2] - a[1][2]) * k) + ")"; g.fillRect(0, y, L, 3);
    }
  }
  function vg(g, y0, y1, c0, c1) { return lin(g, 0, y0, 0, y1, [[0, c0], [1, c1]]); }
  function rr(g, x, y, w, h, r, cont) { r = Math.max(0, Math.min(r, w / 2, h / 2)); if (!cont) g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function C(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
  function poli(g, p) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); }
  function mod(a, b) { return ((a % b) + b) % b; }
  function spr(k, w, h, fn) { let c = S.sp[k]; if (!c) { c = nova(w, h); fn(c.getContext("2d"), w, h); S.sp[k] = c; } return c; }
  // ruído de valor 1D suave (para colinas, dunas, cumes)
  function ruido(seed) { const r = rnd(seed), v = []; for (let i = 0; i < 256; i++) v.push(r()); return function(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return v[i & 255] * (1 - u) + v[(i + 1) & 255] * u; }; }
  function fbm(n, x) { return n(x) * .55 + n(x * 2.1 + 7) * .3 + n(x * 4.3 + 3) * .15; }
  // brilho suave (gradiente radial só no quadrado do brilho); usado só no prerender
  function halo(g, x, y, r, cor, a, aditivo) {
    const go = g.globalCompositeOperation; if (aditivo) g.globalCompositeOperation = "lighter";
    g.fillStyle = rad(g, x, y, r, [[0, ca(cor, a)], [.25, ca(cor, a * .5)], [.6, ca(cor, a * .12)], [1, ca(cor, 0)]]);
    g.fillRect(x - r, y - r, r * 2, r * 2); g.globalCompositeOperation = go;
  }
  // brilho em tamanho FIXO (cache por cor+diâmetro): por quadro só se desenha sem escala (escalar sprite grande é caro)
  const _gl = {};
  function glowSpr(cor, d) { d = Math.max(4, Math.round(d / 4) * 4); const k = cor + d; let c = _gl[k]; if (!c) { c = nova(d, d); const g = c.getContext("2d"), r = d / 2; g.fillStyle = rad(g, r, r, r, [[0, ca(cor, 1)], [.25, ca(cor, .5)], [.6, ca(cor, .12)], [1, ca(cor, 0)]]); g.fillRect(0, 0, d, d); _gl[k] = c; } return c; }
  function glow(g, cor, x, y, d, a) { const c = glowSpr(cor, d); if (a != null && a < .99) g.globalAlpha = a; g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2)); g.globalAlpha = 1; }
  // feixes de luz (cunhas translúcidas que somem com a distância)
  function raios(g, x, y, ang0, ang1, n, len, cor, a, seed) {
    const r = rnd(seed || 5);
    for (let i = 0; i < n; i++) {
      const a0 = ang0 + (ang1 - ang0) * (i + r() * .4) / n, w = (ang1 - ang0) / n * (.18 + r() * .3);
      g.fillStyle = rad(g, x, y, len * (.7 + r() * .3), [[0, ca(cor, a)], [1, ca(cor, 0)]]);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a0 - w) * len, y + Math.sin(a0 - w) * len); g.lineTo(x + Math.cos(a0 + w) * len, y + Math.sin(a0 + w) * len); g.fill();
    }
  }
  function estrelas(g, n, seed, y0, y1, cor, max) {
    const r = rnd(seed); g.fillStyle = cor || "#fff";
    for (let i = 0; i < n; i++) { g.globalAlpha = .2 + r() * .7; const s = r() < .1 ? 2.4 : (r() < .5 ? 1.6 : 1.1) * (max || 1); g.fillRect(Math.round(r() * L), Math.round(y0 + r() * (y1 - y0)), s, s); }
    g.globalAlpha = 1;
  }
  function faisca(g, x, y, r, cor) { g.fillStyle = cor; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); }
  // contorno fino numa versão escura da cor
  function contorno(g, cor, w) { g.lineWidth = w || 2; g.strokeStyle = somb(cor, .62); g.lineJoin = "round"; g.stroke(); }

  // cume (silhueta de terreno): devolve a função da altura; preenche até 'bot'
  function cume(g, o) {
    const n = ruido(o.seed), h = x => o.y - (fbm(n, x / o.esc) - .5) * 2 * o.amp;
    g.beginPath(); g.moveTo(-10, o.bot);
    for (let x = -10; x <= L + 10; x += o.passo || 12) g.lineTo(x, h(x));
    g.lineTo(L + 10, o.bot); g.closePath();
    g.fillStyle = o.fill || mix(o.c0, o.c1, .4); g.fill();
    if (o.rim) { g.beginPath(); for (let x = -10; x <= L + 10; x += o.passo || 12) g[x < 0 ? "moveTo" : "lineTo"](x, h(x) + 1); g.lineWidth = 2; g.strokeStyle = o.rim; g.stroke(); }
    return h;
  }
  // cordilheira de picos com faces: luz à esquerda, sombra à direita (estilo flat premium)
  function montanhas(g, o) {
    const r = rnd(o.seed), p = [], passo = o.passo;
    for (let x = -passo; x <= L + passo * 1.5; x += passo) { p.push([x + (r() - .5) * passo * .3, o.y - o.alt * (.5 + .5 * r())]); p.push([x + passo * (.45 + r() * .1), o.y - o.alt * (.08 + .25 * r())]); }
    g.beginPath(); g.moveTo(-passo, o.bot); p.forEach(q => g.lineTo(q[0], q[1])); g.lineTo(L + passo * 1.5, o.bot); g.closePath();
    g.fillStyle = mix(o.c0, o.c1, .4); g.fill();
    for (let i = 0; i < p.length - 1; i += 2) {
      const a = p[i], v = p[i + 1], u = p[i - 1] || [a[0] - passo / 2, a[1] + 40];
      // face sombreada (lado direito do pico)
      g.fillStyle = ca(o.sh, o.shA); poli(g, [a[0], a[1], v[0], v[1], v[0], o.y + 40, a[0] - passo * .08, o.y + 40, a[0] - passo * .02, a[1] + (o.y - a[1]) * .5]); g.fill();
      if (o.luz) { g.fillStyle = ca(o.luz, o.luzA || .35); poli(g, [a[0], a[1], a[0] - passo * .08, a[1] + (o.y - a[1]) * .5, u[0] + (a[0] - u[0]) * .35, u[1] - (u[1] - a[1]) * .1 + 8]); g.fill(); }
      if (o.neve) {
        const k = 1 - ((a[1] - (o.y - o.alt)) / o.alt) * .5, dx = v[0] - a[0], dy2 = v[1] - a[1], ux = a[0] - u[0], uy = u[1] - a[1];
        g.fillStyle = o.neve; poli(g, [a[0], a[1], a[0] + dx * .32 * k, a[1] + dy2 * .32 * k, a[0] + dx * .18 * k, a[1] + 14 + dy2 * .2, a[0], a[1] + 28 * k, a[0] - ux * .2, a[1] + 12 + uy * .2, a[0] - ux * .32 * k, a[1] + uy * .32 * k]); g.fill();
      }
    }
    return p;
  }
  // névoa de perspectiva em faixas chapadas: some para cima e continua sólida para baixo (as camadas da frente cobrem o resto)
  function bruma(g, y0, y1, cor, a) {
    const n = Math.max(6, Math.min(48, Math.round((y1 - y0) / 4))), h = (y1 - y0) / n;
    for (let i = 0; i < n; i++) { g.fillStyle = ca(cor, a * (i + .5) / n); g.fillRect(-20, y0 + i * h, L + 40, h + .6); }
    g.fillStyle = ca(cor, a); g.fillRect(-20, y1, L + 40, 420);
  }
  // nuvem fofa de 3 tons (sombra c2 embaixo, corpo c1, luz c0 em cima, centro (x,y), largura ~ w) — 3 silhuetas deslocadas, sem clip nem gradiente
  function nuvem(g, x, y, w, c0, c1, c2) {
    const h = w * .3, bolas = [[-.32, .05, .2], [-.12, -.12, .28], [.14, -.16, .3], [.36, .02, .22], [0, .08, .28]];
    function forma(dx, dy, e) { g.beginPath(); bolas.forEach(b => { g.moveTo(x + dx + b[0] * w * e + b[2] * h * 1.5 * e, y + dy + b[1] * h * e); g.arc(x + dx + b[0] * w * e, y + dy + b[1] * h * e, b[2] * h * 1.5 * e, 0, TAU); }); rr(g, x + dx - .5 * w * e, y + dy, w * e, h * .5 * e, h * .25 * e, true); g.fill(); }
    g.fillStyle = c2; forma(0, h * .1, 1); g.fillStyle = c1; forma(0, 0, 1); g.fillStyle = c0; forma(-w * .02, -h * .1, .86);
  }
  // ---------- árvores ----------
  function pinheiro(g, x, y, h, c0, c1, neve) {
    const w0 = h * .34; g.fillStyle = somb(c1, .3); g.fillRect(x - h * .035, y - h * .14, h * .07, h * .14);
    for (let i = 0; i < 4; i++) {
      const yy = y - h * .1 - i * h * .22, w = w0 * (1 - i * .2), top = yy - h * .36;
      g.fillStyle = c1; poli(g, [x, top, x + w, yy, x - w, yy]); g.fill();
      g.fillStyle = c0; poli(g, [x, top, x - w, yy, x - w * .1, yy]); g.fill();
      if (neve) { g.fillStyle = neve; poli(g, [x, top, x + w * .4, top + (yy - top) * .46, x + w * .12, top + (yy - top) * .4, x - w * .1, top + (yy - top) * .52, x - w * .38, top + (yy - top) * .44]); g.fill(); }
    }
  }
  function copa(g, x, y, r, c0, c1, c2) { // copa redonda com luz em cima-esquerda e sombra embaixo-direita
    g.fillStyle = c2; C(g, x + r * .05, y + r * .08, r); g.fill();
    g.fillStyle = c1; C(g, x - r * .06, y - r * .05, r * .92); g.fill();
    g.fillStyle = c0; C(g, x - r * .25, y - r * .28, r * .55); g.fill();
  }

  // ---------- pedra / rocha premium ----------
  // forma de pedra com cantos lascados e base irregular (devolve o caminho no contexto)
  function formaPedra(g, x, y, w, h, R, seed, jag, topoReto) {
    const r = rnd(seed); g.beginPath(); R = Math.min(R, w / 2, h / 2);
    g.moveTo(x + R, y);
    g.lineTo(x + w - R, y); g.lineTo(x + w - R * .2 + (topoReto ? 0 : r() * 2), y + R * .8);
    const pontos = Math.max(2, Math.round(h / 14));
    for (let i = 1; i <= pontos; i++) g.lineTo(x + w - (i === pontos ? R * .9 : r() * jag * .5), y + R + (h - R * 2) * i / pontos);
    const nb = Math.max(3, Math.round(w / 34));
    for (let i = nb - 1; i >= 1; i--) g.lineTo(x + R + (w - R * 2) * i / nb + (r() - .5) * 8, y + h - r() * jag);
    g.lineTo(x + R, y + h);
    for (let i = pontos - 1; i >= 1; i--) g.lineTo(x + r() * jag * .5, y + R + (h - R * 2) * i / pontos);
    g.lineTo(x + R * .2, y + R * .8); g.closePath();
  }
  // rachaduras (linha escura + realce deslocado) dentro de um retângulo
  function rachaduras(g, x, y, w, h, n, seed, cor, a) {
    const r = rnd(seed);
    for (let i = 0; i < n; i++) {
      let px = x + r() * w, py = y + h * (.15 + r() * .7); const pts = [[px, py]];
      for (let k = 0; k < 3; k++) { px += (r() - .3) * 22; py += (r() - .3) * 16; pts.push([px, py]); }
      g.beginPath(); pts.forEach((q, k) => g[k ? "lineTo" : "moveTo"](q[0], q[1])); g.lineWidth = 1.2; g.strokeStyle = ca(cor, a); g.stroke();
      g.beginPath(); pts.forEach((q, k) => g[k ? "lineTo" : "moveTo"](q[0] + 1, q[1] + 1.2)); g.lineWidth = 1; g.strokeStyle = "rgba(255,245,220,.12)"; g.stroke();
    }
  }
  // bloco de pedra com faces, bisel de luz, rachaduras e contorno fino
  function pedra(g, x, y, w, h, o) {
    const c = o.c, r = rnd(o.seed || 1);
    formaPedra(g, x, y, w, h, o.raio == null ? 7 : o.raio, o.seed || 1, o.jag == null ? 4 : o.jag, o.reto);
    g.save(); g.clip();
    g.fillStyle = lin(g, x, y, x + w * .25, y + h, [[0, clar(c, .16)], [.5, c], [1, somb(c, .38)]]); g.fillRect(x, y, w, h);
    // facetas: polígonos claros e escuros
    const nf = o.facetas == null ? Math.round(w * h / 1500) + 3 : o.facetas;
    for (let i = 0; i < nf; i++) {
      const px = x + r() * w, py = y + r() * h, s = 14 + r() * 36, a = r() * TAU;
      g.fillStyle = r() < .5 ? "rgba(255,246,225," + (.05 + r() * .09) + ")" : ca(somb(c, .5), .1 + r() * .14);
      poli(g, [px, py, px + Math.cos(a) * s, py + Math.sin(a) * s * .7, px + Math.cos(a + 1.5) * s * .8, py + Math.sin(a + 1.5) * s * .6]); g.fill();
    }
    // brilho difuso do canto superior esquerdo e sombra no inferior direito
    g.fillStyle = rad(g, x + w * .15, y, Math.max(w, h) * .7, [[0, "rgba(255,246,225,.2)"], [1, "rgba(255,246,225,0)"]]); g.fillRect(x, y, w, h);
    if (o.rach !== 0) rachaduras(g, x + 4, y + 4, w - 8, h - 8, o.rach == null ? Math.round(w / 90) + 1 : o.rach, (o.seed || 1) + 9, somb(c, .75), .55);
    // bisel superior iluminado
    const tp = o.topo == null ? Math.min(7, h * .3) : o.topo;
    if (tp > 0) {
      g.fillStyle = lin(g, 0, y, 0, y + tp, [[0, clar(c, o.luzTopo == null ? .55 : o.luzTopo)], [1, clar(c, .2)]]); g.fillRect(x, y, w, tp);
      g.fillStyle = ca(somb(c, .6), .45); g.fillRect(x, y + tp, w, 1.5);
    }
    g.fillStyle = "rgba(255,246,225,.22)"; g.fillRect(x, y + tp, 2.5, h);          // luz de borda esquerda
    g.fillStyle = ca(somb(c, .6), .25); g.fillRect(x + w - 3, y, 3, h);              // sombra de borda direita
    g.fillStyle = lin(g, 0, y + h * .5, 0, y + h, [[0, ca(somb(c, .8), 0)], [1, ca(somb(c, .8), .32)]]); g.fillRect(x, y + h * .5, w, h * .5);
    if (o.extra) o.extra(g);
    g.restore();
    formaPedra(g, x, y, w, h, o.raio == null ? 7 : o.raio, o.seed || 1, o.jag == null ? 4 : o.jag, o.reto); contorno(g, c, 2);
  }
  // ilha flutuante: laje com fundo afunilado e irregular (d = profundidade da ponta); devolve nada, só desenha
  function ilha(g, x, y, w, h, d, o) {
    const c = o.c, r = rnd(o.seed || 1), n = Math.max(4, Math.round(w / 26)), pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n, f = Math.pow(Math.abs(2 * u - 1), o.pot || 1.5); pts.push([x + w * u, y + h + d * (1 - f) * (.7 + r() * .45) - (i === 0 || i === n ? d * .0 : 0)]); }
    function caminho() {
      g.beginPath(); g.moveTo(x + 5, y); g.lineTo(x + w - 5, y); g.quadraticCurveTo(x + w, y, x + w, y + 6); g.lineTo(x + w, pts[n][1]);
      for (let i = n; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1]); g.lineTo(x, y + 6); g.quadraticCurveTo(x, y, x + 5, y); g.closePath();
    }
    caminho(); g.save(); g.clip();
    g.fillStyle = lin(g, x, y, x + w * .3, y + h + d, [[0, clar(c, .14)], [.45, c], [1, somb(c, .34)]]); g.fillRect(x - 2, y, w + 4, h + d + 2);
    for (let i = 0; i < Math.round(w / 22); i++) { // facetas verticais (rocha fraturada)
      const px = x + r() * w, py = y + h * .5 + r() * (h + d) * .6, s = 10 + r() * 22;
      g.fillStyle = r() < .5 ? "rgba(255,246,225," + (.06 + r() * .08) + ")" : ca(somb(c, .45), .1 + r() * .1);
      poli(g, [px, py - s, px + s * .6, py + s * .5, px - s * .5, py + s * .7]); g.fill();
    }
    if (o.rach !== 0) rachaduras(g, x + 4, y + 4, w - 8, h + d * .6, Math.round(w / 80) + 1, (o.seed || 1) + 4, somb(c, .8), .5);
    g.fillStyle = "rgba(255,246,225,.2)"; g.fillRect(x, y, 2.5, h + d);
    g.fillStyle = lin(g, 0, y + h * .6, 0, y + h + d, [[0, ca(somb(c, .6), 0)], [1, ca(somb(c, .6), .3)]]); g.fillRect(x, y + h * .6, w, h + d);
    if (o.extra) o.extra(g);
    g.restore(); caminho(); contorno(g, c, 2);
  }
  // topo de grama com tufos (tom claro, médio e sombra), largura w a partir de (x,y)
  function grama(g, x, y, w, c0, c1, c2, seed, prof) {
    const r = rnd(seed); prof = prof || 12;
    g.beginPath(); g.moveTo(x, y - 1); for (let i = 0; i <= w; i += 6) g.lineTo(x + i, y - 2 - r() * 5 + (i % 12 ? 0 : 2));
    g.lineTo(x + w, y + prof * .6);
    for (let i = w; i >= 0; i -= 9) g.lineTo(x + i, y + prof * (.6 + r() * .55));
    g.lineTo(x, y + prof * .6); g.closePath();
    g.fillStyle = lin(g, 0, y - 6, 0, y + prof, [[0, c0], [.45, c1], [1, c2]]); g.fill();
    g.fillStyle = "rgba(255,255,220,.22)"; g.fillRect(x, y - 1, w, 2);
  }
  // listras de alerta (amarelo/preto) numa faixa
  function alerta(g, x, y, w, h, c0, c1, larg) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = c0; g.fillRect(x, y, w, h); g.fillStyle = c1;
    for (let i = -h; i < w + h; i += larg * 2) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + larg, y + h); g.lineTo(x + i + larg + h, y); g.lineTo(x + i + h, y); g.fill(); }
    g.restore();
  }
  function rebite(g, x, y, r, c) { g.fillStyle = somb(c, .5); C(g, x + .6, y + .8, r); g.fill(); g.fillStyle = clar(c, .3); C(g, x, y, r); g.fill(); g.fillStyle = "rgba(255,255,255,.7)"; C(g, x - r * .3, y - r * .3, r * .35); g.fill(); }

  // =========================
  // 1. CAMPO — dia ensolarado, colinas em camadas, moinho, fazenda
  // =========================
  function seixos(g, x, y, w, h, n, seed, c) { // pedrinhas e manchas de terra
    const r = rnd(seed);
    for (let i = 0; i < n; i++) {
      const px = x + r() * w, py = y + r() * h, rx = 3 + r() * 6;
      g.fillStyle = ca(somb(c, .45), .5); g.beginPath(); g.ellipse(px + 1, py + 1.5, rx, rx * .65, 0, 0, TAU); g.fill();
      g.fillStyle = clar(c, .18 + r() * .2); g.beginPath(); g.ellipse(px, py, rx, rx * .65, 0, 0, TAU); g.fill();
      g.fillStyle = "rgba(255,246,225,.35)"; g.beginPath(); g.ellipse(px - rx * .3, py - rx * .25, rx * .4, rx * .2, 0, 0, TAU); g.fill();
    }
  }
  function flor(g, x, y, s, cor) { // florzinha: caule + 5 pétalas redondas
    g.strokeStyle = "#3f9a3a"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s * 2.2); g.stroke();
    g.fillStyle = cor; for (let i = 0; i < 5; i++) { C(g, x + Math.cos(i * 1.2566) * s * .8, y - s * 2.2 + Math.sin(i * 1.2566) * s * .8, s * .62); g.fill(); }
    g.fillStyle = "#ffe066"; C(g, x, y - s * 2.2, s * .5); g.fill();
  }
  CEN.campo = {
    pre: function(g) {
      const T = S.top, B = S.bot;
      ceu(g, T, 640, [[0, "#3a8fe6"], [.4, "#6fc0f8"], [.78, "#bfe8fb"], [1, "#fff1cf"]], T, B);
      // sol: brilho quente + raios suaves
      halo(g, 250, 150, 560, "#ffe7a0", .85); raios(g, 250, 150, .05, 1.6, 9, 1100, "#fff3c0", .1, 12);
      g.fillStyle = "#fff7d0"; C(g, 250, 150, 44); g.fill(); g.fillStyle = "#fffdf0"; C(g, 250, 150, 33); g.fill();
      // nuvens distantes e finas
      const nv = [[780, 120, 200], [1040, 210, 150], [470, 250, 120], [120, 330, 140]];
      nv.forEach(function(q, i) { g.globalAlpha = .55; nuvem(g, q[0], q[1], q[2], "#ffffff", "#eaf6ff", "#bcd8f2"); }); g.globalAlpha = 1;
      // cordilheira distante (azulada, baixo contraste)
      montanhas(g, { y: 478, alt: 170, passo: 210, seed: 8, c0: "#a5c0e8", c1: "#cfe3f6", sh: "#7f9fd0", shA: .3, luz: "#ffffff", luzA: .25, neve: "#f6fbff", bot: 600 });
      bruma(g, 360, 500, "#dff1ff", .55);
      // colinas distantes com moinho
      const h1 = cume(g, { y: 520, amp: 34, esc: 220, seed: 21, c0: "#9fd7a0", c1: "#7fc08e", bot: 640, rim: "rgba(235,255,200,.8)" });
      // moinho
      const mx = 1196, my = h1(mx) + 6;
      g.fillStyle = "#e8e2d6"; poli(g, [mx - 15, my, mx + 15, my, mx + 9, my - 62, mx - 9, my - 62]); g.fill();
      g.fillStyle = "rgba(60,50,110,.22)"; poli(g, [mx + 2, my, mx + 15, my, mx + 9, my - 62, mx + 2, my - 62]); g.fill();
      g.fillStyle = "#d4524a"; poli(g, [mx - 13, my - 60, mx + 13, my - 60, mx, my - 82]); g.fill();
      g.fillStyle = "#b53e3c"; poli(g, [mx, my - 60, mx + 13, my - 60, mx, my - 82]); g.fill();
      g.fillStyle = "#8b6a4a"; rr(g, mx - 4, my - 16, 8, 16, 3); g.fill();
      bruma(g, 470, 560, "#e6f6ff", .35);
      // colina média com árvores, celeiro e cerca
      const h2 = cume(g, { y: 566, amp: 30, esc: 170, seed: 33, c0: "#7ccb68", c1: "#4fa65a", bot: 660, rim: "rgba(225,255,160,.9)" });
      [[90, 20], [150, 14], [330, 17], [420, 12], [820, 14], [900, 20], [1180, 16], [1235, 12]].forEach(function(q) { const y = h2(q[0]) + 6; g.fillStyle = "#6a4a3a"; g.fillRect(q[0] - 2, y - q[1] * .8, 4, q[1] * .9); copa(g, q[0], y - q[1] * 1.5, q[1], "#9be26a", "#5fba4a", "#3d9446"); });
      // celeiro
      const bx = 660, by = h2(bx) + 4;
      g.fillStyle = "#c9473f"; g.fillRect(bx - 30, by - 34, 60, 34); g.fillStyle = "#a63532"; g.fillRect(bx + 8, by - 34, 22, 34);
      g.fillStyle = "#e9e4d6"; poli(g, [bx - 36, by - 32, bx, by - 58, bx + 36, by - 32, bx + 30, by - 32, bx, by - 53, bx - 30, by - 32]); g.fill();
      g.fillStyle = "#8b3a36"; poli(g, [bx - 38, by - 32, bx, by - 60, bx + 38, by - 32, bx + 33, by - 32, bx, by - 54, bx - 33, by - 32]); g.fill();
      g.fillStyle = "#f2ece0"; g.fillRect(bx - 8, by - 20, 16, 20); g.strokeStyle = "#8b3a36"; g.lineWidth = 1.5; g.strokeRect(bx - 8, by - 20, 16, 20); g.beginPath(); g.moveTo(bx - 8, by - 20); g.lineTo(bx + 8, by); g.moveTo(bx + 8, by - 20); g.lineTo(bx - 8, by); g.stroke();
      // cerca de madeira
      g.fillStyle = "#c7a272"; for (let x = 520; x < 620; x += 14) { const y = h2(x) + 5; rr(g, x - 2, y - 18, 4, 18, 1.5); g.fill(); }
      g.fillStyle = "#d8b684"; g.fillRect(520, h2(520) - 13, 100, 3); g.fillRect(520, h2(520) - 7, 100, 3);
      bruma(g, 540, 640, "#d7f3d0", .3);
      // colina da frente + flores
      const h3 = cume(g, { y: 628, amp: 20, esc: 130, seed: 47, c0: "#58b94e", c1: "#2f8a42", bot: 700, rim: "rgba(210,255,140,.9)" });
      const r = rnd(77);
      for (let i = 0; i < 70; i++) { const x = r() * L, y = h3(x) + 8 + r() * 26; flor(g, x, y, 2.2 + r() * 1.4, ["#ff6f91", "#ffffff", "#ffd54a", "#ff9a5a"][i % 4]); }
      // arbustos
      [[40, 22], [280, 18], [1000, 20], [1240, 24]].forEach(function(q) { const y = h3(q[0]) + 14; copa(g, q[0], y - q[1] * .7, q[1], "#8fe46a", "#4cb04a", "#2b8040"); copa(g, q[0] + q[1] * .9, y - q[1] * .45, q[1] * .75, "#8fe46a", "#4cb04a", "#2b8040"); });
      // base da terra (celular em pé) — continua o chão
      if (B > A) { g.fillStyle = vg(g, A, B, "#5e3d2e", "#46291f"); g.fillRect(0, A - 1, L, B - A + 1); seixos(g, 0, A + 6, L, B - A, Math.round((B - A) / 8), 5, "#6c4631"); }
    },
    pad: function(p) { return p.h > 40 ? [0, 14, 0, 0] : [10, 14, 10, 40]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h;
      if (h > 40) { // chão: terra em camadas com grama
        g.fillStyle = lin(g, 0, 0, 0, h + 20, [[0, "#b07a4c"], [.35, "#8c5b3b"], [.75, "#6c4631"], [1, "#5e3d2e"]]); g.fillRect(-30, 0, w + 60, h + 20);
        g.strokeStyle = "rgba(60,30,40,.18)"; g.lineWidth = 2; for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = -30; x <= w + 30; x += 20) g.lineTo(x, 28 + k * 14 + Math.sin(x / 70 + k * 2) * 4); g.stroke(); }
        seixos(g, 0, 20, w, h - 10, 46, 9, "#8c5b3b");
        grama(g, -30, 0, w + 60, "#a6ea5c", "#62c240", "#3a9438", 4, 20);
        g.fillStyle = lin(g, 0, 18, 0, 34, [[0, "rgba(40,20,60,.28)"], [1, "rgba(40,20,60,0)"]]); g.fillRect(-30, 18, w + 60, 16);
        return;
      }
      const r = rnd(60 + i);
      g.fillStyle = "rgba(30,60,50,.16)"; g.beginPath(); g.ellipse(w / 2, h + 34, w * .46, 7, 0, 0, TAU); g.fill();   // sombra solta
      ilha(g, 0, 0, w, h, 26, { c: "#9a6a43", seed: 31 + i, rach: 0 });
      seixos(g, 8, 8, w - 16, h + 6, Math.round(w / 45), 3 + i, "#9a6a43");
      grama(g, -3, 0, w + 6, "#a6ea5c", "#62c240", "#3a9438", 40 + i, 13);
      g.strokeStyle = "#5e3d2e"; g.lineWidth = 2.2; g.lineCap = "round";
      for (let k = 0; k < Math.round(w / 60); k++) { const x = 20 + r() * (w - 40); g.beginPath(); g.moveTo(x, h + 8); g.quadraticCurveTo(x + (r() - .5) * 14, h + 16, x + (r() - .5) * 18, h + 22 + r() * 10); g.stroke(); }
      for (let k = 0; k < 3; k++) flor(g, 20 + r() * (w - 40), 3, 2.4, ["#ff6f91", "#ffffff", "#ffd54a"][k]);
    },
    fundo: function(g, est, t) {
      // nuvens grandes à deriva (3 sprites) + moinho girando + pássaros
      const n = [spr("n0", 300, 120, (c) => { c.globalAlpha = .92; nuvem(c, 150, 62, 260, "#ffffff", "#f1f8ff", "#c3dcf5"); }), spr("n1", 220, 90, (c) => { c.globalAlpha = .92; nuvem(c, 110, 48, 190, "#ffffff", "#f1f8ff", "#c3dcf5"); })];
      [[0, 60, 150, 9, 0], [1, 330, 90, 6, 300], [0, 660, 215, 7, 90], [1, 960, 150, 5, 500], [1, 20, 270, 4, 420]].forEach(function(q) {
        g.drawImage(n[q[0]], Math.round(mod(q[1] + q[4] + t * q[3], L + 400) - 300), q[2] - 40);
      });
      // pás do moinho: desenhadas como formas simples girando (nada de sprite girando)
      g.save(); g.translate(1196, 456); g.rotate(t * .5);
      for (let k = 0; k < 4; k++) { g.save(); g.rotate(k * Math.PI / 2); g.fillStyle = "#b9a888"; g.fillRect(-1, -35, 2, 35); g.fillStyle = "#f4efe4"; g.fillRect(1, -34, 8, 17); g.fillStyle = "rgba(60,50,110,.2)"; g.fillRect(1, -25, 8, 8); g.restore(); }
      g.fillStyle = "#8b3a36"; C(g, 0, 0, 3); g.fill(); g.restore();
      const ave = [spr("a0", 20, 12, (c) => { c.strokeStyle = "#2e3a6e"; c.lineWidth = 1.8; c.lineCap = "round"; c.beginPath(); c.moveTo(1, 2); c.quadraticCurveTo(5, 8, 10, 7); c.quadraticCurveTo(15, 8, 19, 2); c.stroke(); }),
        spr("a1", 20, 12, (c) => { c.strokeStyle = "#2e3a6e"; c.lineWidth = 1.8; c.lineCap = "round"; c.beginPath(); c.moveTo(1, 8); c.quadraticCurveTo(5, 4, 10, 8); c.quadraticCurveTo(15, 4, 19, 8); c.stroke(); })];
      for (let k = 0; k < 4; k++) { const x = mod(t * 34 + k * 140 + 100, L + 80) - 40, y = 140 + k * 34 + Math.sin(t * 1.4 + k) * 9; g.drawImage(ave[Math.floor(t * 4 + k) % 2], Math.round(x), Math.round(y)); }
    }
  };

  // =========================
  // 2. GELO — crepúsculo polar com aurora, geleiras, pinheiros nevados, plataformas de gelo translúcido
  // =========================
  function flocoSpr(k, r, a) { return spr(k, r * 2 + 2, r * 2 + 2, function(g) { g.fillStyle = rad(g, r + 1, r + 1, r, [[0, "rgba(255,255,255," + a + ")"], [.55, "rgba(255,255,255," + a * .8 + ")"], [1, "rgba(255,255,255,0)"]]); g.fillRect(0, 0, r * 2 + 2, r * 2 + 2); }); }
  // bloco de gelo: corpo translúcido com refração, bolhas, rachaduras brancas, neve no topo e estalactites
  function gelo(g, x, y, w, h, seed, ice) {
    const r = rnd(seed), cc = ice || ["#f2fdff", "#a6e8ff", "#4fb0ee", "#2a62c0"];
    // estalactites (atrás do corpo)
    for (let i = 0; i < Math.round(w / 36); i++) {
      const px = x + 14 + r() * (w - 28), len = 10 + r() * 22, wd = 4 + r() * 5;
      g.fillStyle = lin(g, 0, y + h - 2, 0, y + h + len, [[0, "rgba(150,215,245,.95)"], [1, "rgba(190,235,255,.55)"]]); poli(g, [px - wd, y + h - 3, px + wd, y + h - 3, px + 1, y + h + len]); g.fill();
      g.fillStyle = "rgba(255,255,255,.55)"; poli(g, [px - wd, y + h - 3, px - wd * .2, y + h - 3, px, y + h + len * .7]); g.fill();
    }
    formaPedra(g, x, y, w, h, 8, seed, 3);
    g.save(); g.clip();
    g.fillStyle = lin(g, 0, y, 0, y + h, [[0, cc[0]], [.2, cc[1]], [.65, cc[2]], [1, cc[3]]]); g.fillRect(x, y, w, h);
    // faixas diagonais de refração
    for (let k = 0; k < Math.round(w / 55) + 1; k++) { const px = x + k * 55 + r() * 30, wd = 6 + r() * 16; g.fillStyle = "rgba(255,255,255," + (.1 + r() * .14) + ")"; poli(g, [px, y, px + wd, y, px + wd - h * .6, y + h, px - h * .6, y + h]); g.fill(); }
    // bolhas congeladas e rachaduras internas
    for (let k = 0; k < Math.round(w / 28); k++) { g.fillStyle = "rgba(255,255,255," + (.25 + r() * .3) + ")"; C(g, x + r() * w, y + h * (.35 + r() * .55), .8 + r() * 1.7); g.fill(); }
    rachaduras(g, x + 6, y + 6, w - 12, h - 10, Math.round(w / 75) + 1, seed + 5, "#ffffff", .5);
    g.fillStyle = lin(g, 0, y + h * .55, 0, y + h, [[0, "rgba(40,60,150,0)"], [1, "rgba(40,60,150,.28)"]]); g.fillRect(x, y, w, h);
    // neve no topo
    g.fillStyle = lin(g, 0, y, 0, y + 9, [[0, "#ffffff"], [1, "#e4f4ff"]]);
    g.beginPath(); g.moveTo(x - 2, y - 2); g.lineTo(x + w + 2, y - 2); for (let i = w; i >= 0; i -= 10) g.lineTo(x + i, y + 5 + r() * 4); g.closePath(); g.fill();
    g.fillStyle = "rgba(60,110,190,.16)"; g.fillRect(x, y + 9, w, 3);
    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x, y, 2.5, h);
    g.restore();
    formaPedra(g, x, y, w, h, 8, seed, 3); contorno(g, "#3b78c4", 2.2);
  }
  function igloo(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    halo(g, 0, -8, 90, "#ffcf70", .35);
    g.beginPath(); g.moveTo(-44, 0); g.arc(0, 0, 44, Math.PI, 0); g.closePath();
    g.fillStyle = lin(g, -44, -44, 44, 0, [[0, "#ffffff"], [.6, "#e0f0ff"], [1, "#9cb6e6"]]); g.fill();
    g.save(); g.clip(); g.strokeStyle = "rgba(90,120,190,.35)"; g.lineWidth = 1.4;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(0, 0, k * 11, Math.PI, 0); g.stroke(); }
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 11, -40); g.lineTo(k * 14 + 4, 0); g.stroke(); }
    g.restore();
    g.fillStyle = "#ffc761"; g.beginPath(); g.moveTo(-10, 0); g.lineTo(-10, -9); g.arc(0, -9, 10, Math.PI, 0); g.lineTo(10, 0); g.fill();
    g.fillStyle = "#fff0b8"; g.beginPath(); g.moveTo(-5, 0); g.lineTo(-5, -9); g.arc(0, -9, 5, Math.PI, 0); g.lineTo(5, 0); g.fill();
    g.restore();
  }
  CEN.gelo = {
    pre: function(g) {
      const T = S.top, B = S.bot;
      ceu(g, T, 600, [[0, "#141f55"], [.3, "#2e4a97"], [.62, "#6f9fd8"], [.88, "#c4def2"], [1, "#f1dff0"]], T, B);
      estrelas(g, 160, 4, T, 330, "#e8f1ff");
      // aurora: cortinas verticais verde-água com borda magenta
      g.save(); g.globalCompositeOperation = "lighter";
      [[150, "#2dffb0", .26, 1.1, 0], [230, "#4de0ff", .2, .8, 2.4], [110, "#b66bff", .16, 1.4, 4.1]].forEach(function(q) {
        for (let x = -10; x < L + 10; x += 7) {
          const yy = q[0] + Math.sin(x / 190 * q[3] + q[4]) * 46 + Math.sin(x / 71 + q[4]) * 10, hh = 120 + Math.sin(x / 130 + q[4] * 2) * 50 + 40;
          g.fillStyle = lin(g, 0, yy - hh, 0, yy + 30, [[0, ca(q[1], 0)], [.7, ca(q[1], q[2])], [.92, ca("#ff7ad9", q[2] * .9)], [1, ca(q[1], 0)]]); g.fillRect(x, yy - hh, 7, hh + 30);
        }
      });
      g.restore();
      // lua pálida baixa e brilho
      halo(g, 300, 150, 300, "#cfe3ff", .55); g.fillStyle = "#f4f8ff"; C(g, 300, 150, 30); g.fill(); g.fillStyle = "rgba(160,180,230,.4)"; C(g, 291, 143, 8); g.fill(); C(g, 311, 158, 5); g.fill();
      montanhas(g, { y: 470, alt: 190, passo: 230, seed: 3, c0: "#7a8dd0", c1: "#b6c6ec", sh: "#4a56a0", shA: .32, luz: "#ffffff", luzA: .2, neve: "#eef4ff", bot: 600 });
      bruma(g, 360, 500, "#dfe9fb", .5);
      // geleira de gelo (camada média)
      montanhas(g, { y: 548, alt: 118, passo: 150, seed: 14, c0: "#8cc8ea", c1: "#c2e8f8", sh: "#4a8ec8", shA: .34, luz: "#ffffff", luzA: .3, neve: "#ffffff", bot: 640 });
      bruma(g, 470, 580, "#d9f1ff", .4);
      // pinheiros nevados (azulados e distantes)
      const r = rnd(9);
      for (let x = -10; x < L + 20; x += 24 + r() * 26) { const h = 40 + r() * 54, y = 612 + r() * 10; pinheiro(g, x, y, h, "#3f7fa3", "#2c5f86", "#e6f4ff"); }
      bruma(g, 560, 640, "#cfe8ff", .3);
      // colinas de neve da frente
      const h3 = cume(g, { y: 640, amp: 18, esc: 160, seed: 6, c0: "#f4fbff", c1: "#bcd9f3", bot: 700, rim: "#ffffff" });
      igloo(g, 1190, h3(1190) + 8, .8);
      for (let x = 40; x < L; x += 150 + r() * 120) { if (x > 1100) continue; const y = h3(x) + 8; pinheiro(g, x, y, 56 + r() * 30, "#4a8aa8", "#2f6288", "#ffffff"); }
      // cristais de gelo decorativos
      [[560, 1], [700, .8], [60, 1.1]].forEach(function(q) { const y = h3(q[0]) + 14; g.save(); g.translate(q[0], y); g.scale(q[1], q[1]); g.fillStyle = "#9fdcff"; poli(g, [-10, 0, -4, -34, 2, 0]); g.fill(); g.fillStyle = "#d8f4ff"; poli(g, [0, 0, 8, -22, 14, 0]); g.fill(); g.fillStyle = "#6ab8e8"; poli(g, [-4, 0, -4, -34, 2, 0]); g.fill(); g.restore(); });
      if (B > A) { g.fillStyle = vg(g, A, B, "#3f86cf", "#2a4f9a"); g.fillRect(0, A - 1, L, B - A + 1); }
    },
    pad: function(p) { return p.h > 40 ? [0, 10, 0, 0] : [10, 10, 10, 34]; },
    plat: function(g, p, i) {
      if (p.h > 40) { // chão: banquisa grossa
        g.fillStyle = lin(g, 0, 0, 0, p.h + 20, [[0, "#cdf1ff"], [.25, "#8ed3f4"], [.7, "#4e97dc"], [1, "#3b6fc0"]]); g.fillRect(-30, 0, p.w + 60, p.h + 20);
        const r = rnd(5); for (let k = 0; k < 16; k++) { g.fillStyle = "rgba(255,255,255," + (.07 + r() * .1) + ")"; const px = r() * p.w, wd = 10 + r() * 24; poli(g, [px, 0, px + wd, 0, px + wd - 50, p.h + 20, px - 50, p.h + 20]); g.fill(); }
        rachaduras(g, 0, 18, p.w, p.h - 20, 22, 8, "#ffffff", .4);
        g.fillStyle = lin(g, 0, 0, 0, 14, [[0, "#ffffff"], [1, "#e0f2ff"]]); g.beginPath(); g.moveTo(-30, -3); g.lineTo(p.w + 30, -3); for (let x = p.w + 30; x >= -30; x -= 12) g.lineTo(x, 8 + r() * 5); g.closePath(); g.fill();
        g.fillStyle = "rgba(90,150,215,.25)"; g.fillRect(-30, 14, p.w + 60, 3);
        return;
      }
      g.fillStyle = "rgba(30,60,130,.14)"; g.beginPath(); g.ellipse(p.w / 2, p.h + 36, p.w * .45, 6, 0, 0, TAU); g.fill();
      gelo(g, 0, 0, p.w, p.h, 11 + i * 7);
    },
    anim: function(g, p, i, est, t) { // brilhos nos cristais
      const s = spr("brilhoGelo", 20, 20, function(c) { faisca(c, 10, 10, 9, "#ffffff"); c.fillStyle = "rgba(255,255,255,.5)"; C(c, 10, 10, 2.4); c.fill(); });
      for (let k = 0; k < 2; k++) {
        const ph = t * .9 + i * 1.7 + k * 3.1, a = Math.max(0, Math.sin(ph)) ** 3;
        if (a < .02) continue; g.globalAlpha = a; g.drawImage(s, Math.round(p.x + p.w * (.15 + .7 * mod(Math.floor(ph / 3.14159) * .37 + i * .21 + k * .4, 1)) - 10), Math.round(p.y + 2));
      }
      g.globalAlpha = 1;
    },
    fundo: function(g, est, t) {
      // neve em 3 profundidades (sprites circulares suaves)
      const f = [flocoSpr("f0", 2, .55), flocoSpr("f1", 3, .75), flocoSpr("f2", 5, .9)];
      for (let k = 0; k < 70; k++) {
        const z = k % 3, v = 16 + z * 20, x = mod(k * 97.3 + Math.sin(t * .6 + k) * (14 + z * 8) + t * (6 + z * 4), L + 20) - 10, y = mod(k * 61.7 + t * v, est.altura + 20) - 10 - est.deslocY;
        g.drawImage(f[z], Math.round(x), Math.round(y));
      }
    },
    frente: function(g, est, t) {
      const f = flocoSpr("f2", 5, .9);
      for (let k = 0; k < 10; k++) { const x = mod(k * 131 + Math.sin(t * .5 + k * 2) * 30 + t * 14, L + 40) - 20, y = mod(k * 83 + t * 52, est.altura + 40) - 20 - est.deslocY; g.drawImage(f, Math.round(x), Math.round(y)); }
    }
  };

  // =========================
  // 3. LUA — regolito, Terra no céu negro, módulo lunar, crateras
  // =========================
  function cratera(g, x, y, rx, ry, c) { // cratera com borda iluminada à esquerda e interior sombreado
    g.fillStyle = ca(somb(c, .6), .55); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
    g.fillStyle = ca(somb(c, .3), .6); g.beginPath(); g.ellipse(x + rx * .08, y + ry * .12, rx * .88, ry * .8, 0, 0, TAU); g.fill();
    g.strokeStyle = ca(clar(c, .5), .65); g.lineWidth = 1.6; g.beginPath(); g.ellipse(x, y, rx, ry, 0, Math.PI * .75, Math.PI * 1.6); g.stroke();
    g.strokeStyle = ca(somb(c, .6), .5); g.beginPath(); g.ellipse(x, y, rx, ry, 0, -.4, Math.PI * .5); g.stroke();
  }
  function terra(g, x, y, r) {
    g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    g.fillStyle = rad(g, x, y, r, [[0, "#5fc4ff"], [.7, "#2a7de0"], [1, "#1a4fb0"]], x - r * .35, y - r * .35, r * .1); g.fillRect(x - r, y - r, r * 2, r * 2);
    const rr2 = rnd(4);
    // continentes (manchas verdes e ocre)
    [[-.35, -.1, .38], [.25, -.35, .26], [.3, .35, .32], [-.1, .45, .2], [-.55, .35, .18]].forEach(function(q) {
      g.fillStyle = "#5bbf5f"; g.beginPath(); for (let a = 0; a < 7; a++) { const an = a / 7 * TAU, rr3 = q[2] * r * (.7 + rr2() * .5); g[a ? "lineTo" : "moveTo"](x + q[0] * r + Math.cos(an) * rr3, y + q[1] * r + Math.sin(an) * rr3 * .8); } g.closePath(); g.fill();
      g.fillStyle = "rgba(210,180,100,.5)"; C(g, x + q[0] * r + 4, y + q[1] * r + 2, q[2] * r * .35); g.fill();
    });
    g.fillStyle = "rgba(255,255,255,.75)"; // faixas de nuvens
    for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(x + (rr2() - .5) * r * 1.5, y + (rr2() - .5) * r * 1.6, r * (.16 + rr2() * .24), r * .05, rr2() - .5, 0, TAU); g.fill(); }
    g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(x - r, y - r, r * 2, r * .13); g.fillRect(x - r, y + r * .9, r * 2, r * .13);
    g.fillStyle = rad(g, x, y, r * 1.1, [[0, "rgba(10,10,50,0)"], [.55, "rgba(10,10,50,0)"], [1, "rgba(10,10,50,.85)"]], x - r * .5, y - r * .5, r * .2); g.fillRect(x - r, y - r, r * 2, r * 2);   // terminador (luz de cima-esquerda)
    g.restore();
    g.strokeStyle = "rgba(140,210,255,.7)"; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r + 1, Math.PI * .8, Math.PI * 1.75); g.stroke();   // aro de atmosfera
  }
  function modulo(g, x, y, s) { // módulo lunar de pouso (silhueta simples com folha dourada)
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = "#6a7090"; g.lineWidth = 2.5; g.lineCap = "round";
    [[-34, 0, -16, -22], [34, 0, 16, -22], [-12, 0, -8, -22], [12, 0, 8, -22]].forEach(q => { g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[2], q[3]); g.stroke(); });
    g.fillStyle = "#8a90ab"; [[-38, 0], [38, 0]].forEach(q => { g.beginPath(); g.ellipse(q[0], q[1], 8, 2.6, 0, 0, TAU); g.fill(); });
    g.fillStyle = "#c9a45a"; poli(g, [-22, -22, 22, -22, 24, -34, -24, -34]); g.fill(); g.fillStyle = "#e3c880"; poli(g, [-22, -22, 0, -22, 0, -34, -24, -34]); g.fill();
    g.fillStyle = "#d4d8e8"; rr(g, -16, -58, 32, 25, 9); g.fill(); g.fillStyle = "#aab0cc"; rr(g, 2, -58, 14, 25, 7); g.fill();
    g.fillStyle = "#3a4468"; rr(g, -9, -50, 11, 9, 4); g.fill(); g.fillStyle = "#8fb4ff"; rr(g, -8, -49, 4, 3, 1.5); g.fill();
    g.strokeStyle = "#8a90ab"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -58); g.lineTo(0, -70); g.stroke();
    g.restore();
  }
  CEN.lua = {
    vin: .4,
    pre: function(g) {
      const T = S.top, B = S.bot;
      ceu(g, T, 640, [[0, "#04061a"], [.55, "#0d1033"], [1, "#1e2352"]], T, B);
      estrelas(g, 420, 11, T, 600, "#ffffff", 1); estrelas(g, 50, 12, T, 500, "#bfd4ff", 1.4); estrelas(g, 30, 13, T, 500, "#ffe3b0", 1.3);
      // via láctea tênue
      g.save(); g.globalCompositeOperation = "lighter"; g.translate(500, 250); g.rotate(-.5); g.fillStyle = rad(g, 0, 0, 520, [[0, "rgba(150,140,255,.14)"], [.5, "rgba(120,110,230,.06)"], [1, "rgba(100,100,220,0)"]]); g.scale(1, .22); g.fillRect(-520, -520, 1040, 1040); g.restore();
      // Terra grande no céu
      halo(g, 1000, 190, 230, "#6fb4ff", .3); terra(g, 1000, 190, 92);
      // cordilheiras lunares (face iluminada à esquerda)
      montanhas(g, { y: 520, alt: 130, passo: 220, seed: 19, c0: "#4b5380", c1: "#7f89b4", sh: "#232850", shA: .45, luz: "#d6dcff", luzA: .22, bot: 620 });
      bruma(g, 430, 540, "#8c96c4", .35);
      const h2 = cume(g, { y: 580, amp: 24, esc: 200, seed: 8, c0: "#8a90b0", c1: "#5d6288", bot: 680, rim: "rgba(235,240,255,.28)" });
      modulo(g, 210, h2(210) + 12, 1);
      // bandeira
      const fx = 1120, fy = h2(fx) + 10; g.strokeStyle = "#d8dcef"; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 52); g.stroke(); g.fillStyle = "#2fc4a8"; g.fillRect(fx + 1, fy - 52, 28, 18); g.fillStyle = "#1c8e8a"; g.fillRect(fx + 15, fy - 52, 14, 18); faisca(g, fx + 11, fy - 43, 6, "#fff6c8");
      bruma(g, 560, 640, "#9aa2c8", .22);
      // planície da frente com crateras e rochas
      const h3 = cume(g, { y: 636, amp: 10, esc: 150, seed: 3, c0: "#9aa0bd", c1: "#6c7194", bot: 700, rim: "rgba(240,244,255,.3)" });
      const r = rnd(7);
      [[80, 640, 46, 9], [400, 650, 60, 11], [620, 645, 34, 7], [900, 642, 52, 10], [1180, 648, 40, 8]].forEach(q => cratera(g, q[0], q[1], q[2], q[3], "#8c92b2"));
      for (let i = 0; i < 16; i++) { const x = r() * L, y = 644 + r() * 14, s = 3 + r() * 7; g.fillStyle = "#5d6288"; g.beginPath(); g.ellipse(x + 2, y + 2, s, s * .55, 0, 0, TAU); g.fill(); g.fillStyle = "#a9afcb"; poli(g, [x - s, y + 1, x - s * .5, y - s * .7, x + s * .4, y - s * .8, x + s, y + 1]); g.fill(); g.fillStyle = "#6f7599"; poli(g, [x + s * .1, y - s * .8, x + s * .4, y - s * .8, x + s, y + 1, x + s * .1, y + 1]); g.fill(); }
      if (B > A) { g.fillStyle = vg(g, A, B, "#5d6288", "#3a3f66"); g.fillRect(0, A - 1, L, B - A + 1); const rr4 = rnd(6); for (let i = 0; i < (B - A) / 30; i++) cratera(g, rr4() * L, A + 10 + rr4() * (B - A - 10), 20 + rr4() * 40, 5 + rr4() * 8, "#6c7194"); }
    },
    pad: function(p) { return p.h > 40 ? [0, 8, 0, 0] : [10, 10, 10, 38]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h;
      if (h > 40) {
        g.fillStyle = lin(g, 0, 0, 0, h + 20, [[0, "#b4b9d2"], [.3, "#8e94b6"], [1, "#6a6f96"]]); g.fillRect(-30, 0, w + 60, h + 20);
        const r = rnd(2); for (let k = 0; k < 40; k++) { g.fillStyle = r() < .5 ? "rgba(255,255,255,.08)" : "rgba(40,40,90,.1)"; g.beginPath(); g.ellipse(r() * w, 6 + r() * (h - 4), 6 + r() * 20, 1.5 + r() * 3, 0, 0, TAU); g.fill(); }
        cratera(g, 180, 36, 40, 8, "#8e94b6"); cratera(g, 760, 40, 54, 9, "#8e94b6"); cratera(g, 1100, 34, 30, 6, "#8e94b6");
        g.fillStyle = lin(g, 0, 0, 0, 10, [[0, "#eef0fb"], [1, "#c4c9e0"]]); g.fillRect(-30, 0, w + 60, 7); g.fillStyle = "rgba(60,60,110,.3)"; g.fillRect(-30, 7, w + 60, 2);
        return;
      }
      g.fillStyle = "rgba(10,10,40,.2)"; g.beginPath(); g.ellipse(w / 2, h + 36, w * .46, 6, 0, 0, TAU); g.fill();
      ilha(g, 0, 0, w, h, 28, { c: "#868cae", seed: 21 + i, pot: 1.2 });
      g.fillStyle = lin(g, 0, 0, 0, 9, [[0, "#f1f3fc"], [1, "#c9cee4"]]); g.beginPath(); g.moveTo(1, 8); g.lineTo(1, 4); g.quadraticCurveTo(1, 0, 6, 0); g.lineTo(w - 6, 0); g.quadraticCurveTo(w - 1, 0, w - 1, 4); g.lineTo(w - 1, 8); g.closePath(); g.fill();
      cratera(g, w * .3, 12, 12, 3, "#9fa5c4"); cratera(g, w * .72, 11, 9, 2.5, "#9fa5c4");
    },
    fundo: function(g, est, t) {
      // estrelas que piscam + um satélite com luz piscante + estrela cadente ocasional
      const e = spr("estLua", 12, 12, c => faisca(c, 6, 6, 5.5, "#ffffff"));
      for (let k = 0; k < 26; k++) { const a = .35 + .65 * Math.max(0, Math.sin(t * (1 + (k % 5) * .35) + k * 2.1)); g.globalAlpha = a; g.drawImage(e, Math.round((k * 487) % 1260 + 6), Math.round((k * 211) % 520 + 10)); }
      g.globalAlpha = 1;
      const sx = mod(t * 14, L + 80) - 40, sy = 120 + Math.sin(t * .3) * 20; g.fillStyle = "#cfd6ee"; g.fillRect(sx - 4, sy - 1.5, 8, 3); g.fillStyle = "#4a86ff"; g.fillRect(sx - 9, sy - 2, 4, 4); g.fillRect(sx + 5, sy - 2, 4, 4); if (Math.sin(t * 5) > 0) { g.fillStyle = "#ff6b6b"; g.fillRect(sx - 1, sy - 4, 2, 2); }
      const c = mod(t, 11); if (c < .9) { const k = c / .9, x = 200 + k * 520, y = 50 + k * 200; g.strokeStyle = "rgba(255,255,255," + (1 - k) + ")"; g.lineWidth = 2; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 70 * (1 - k * .5), y - 28 * (1 - k * .5)); g.stroke(); }
    }
  };

  // =========================
  // 4. VULCÃO — céu em brasa, vulcão com rios de lava, basalto com rachaduras incandescentes
  // =========================
  function brasa(k) { return spr("brasa" + k, 12, 12, function(g) { g.fillStyle = rad(g, 6, 6, 6, [[0, "#fff6b0"], [.35, "#ffb040"], [1, "rgba(255,90,20,0)"]]); g.fillRect(0, 0, 12, 12); }); }
  CEN.vulcao = {
    vin: .45,
    pre: function(g) {
      const T = S.top, B = S.bot;
      ceu(g, T, 640, [[0, "#1d0a22"], [.3, "#4d1328"], [.62, "#a5301f"], [.85, "#f06a22"], [1, "#ffb347"]], T, B);
      halo(g, 640, 330, 700, "#ff8a30", .5);
      // fumaça espessa no céu (blocos escuros iluminados por baixo)
      const r = rnd(31);
      for (let i = 0; i < 16; i++) { const x = r() * L, y = T + 20 + r() * (300 - T * .0), w = 240 + r() * 300; g.globalAlpha = .55; nuvem(g, x, y, w, "#52203a", "#3a1530", "#220c24"); }
      g.globalAlpha = 1;
      for (let i = 0; i < 7; i++) { const x = 200 + r() * 880, y = 110 + r() * 160, w = 160 + r() * 220; g.globalAlpha = .3; nuvem(g, x, y + 10, w, "#ff8a40", "#c4452a", "#6a1e30"); } g.globalAlpha = 1;
      // cordilheira distante em tons de vinho
      montanhas(g, { y: 500, alt: 150, passo: 170, seed: 5, c0: "#5c1e33", c1: "#a23b2c", sh: "#2c0e24", shA: .4, luz: "#ff9a50", luzA: .2, bot: 620 });
      // vulcão central: cone com crateras e rios de lava
      const vx = 640, vy = 250;
      g.fillStyle = lin(g, 0, vy, 0, 560, [[0, "#3a1a30"], [1, "#6a2630"]]);
      g.beginPath(); g.moveTo(vx - 36, vy); g.quadraticCurveTo(vx - 150, 420, vx - 460, 560); g.lineTo(vx + 460, 560); g.quadraticCurveTo(vx + 150, 420, vx + 36, vy); g.quadraticCurveTo(vx, vy + 14, vx - 36, vy); g.fill();
      g.fillStyle = "rgba(20,5,25,.35)"; g.beginPath(); g.moveTo(vx + 36, vy); g.quadraticCurveTo(vx + 150, 420, vx + 460, 560); g.lineTo(vx + 80, 560); g.quadraticCurveTo(vx + 40, 400, vx + 36, vy); g.fill();
      g.fillStyle = "rgba(255,150,80,.1)"; g.beginPath(); g.moveTo(vx - 36, vy); g.quadraticCurveTo(vx - 150, 420, vx - 460, 560); g.lineTo(vx - 380, 560); g.quadraticCurveTo(vx - 120, 420, vx - 34, vy + 6); g.fill();
      halo(g, vx, vy + 4, 130, "#ff9a30", .9); g.fillStyle = "#ffd070"; g.beginPath(); g.ellipse(vx, vy + 3, 30, 6, 0, 0, TAU); g.fill();
      g.lineCap = "round";
      [[-22, -150, 380, -240, 560], [10, 20, 400, 80, 560], [26, 140, 330, 230, 540], [-8, -60, 430, -80, 560]].forEach(function(q) {
        const x0 = vx + q[0]; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x0, vy + 6); g.bezierCurveTo(x0 + q[1] * .2, 330, vx + q[1] * 1.3, q[2], vx + q[3], q[4]); g.lineWidth = k ? 3 : 8; g.strokeStyle = k ? "#ffe08a" : "rgba(255,110,30,.55)"; g.stroke(); }
      });
      bruma(g, 400, 580, "#d5502a", .38);
      // crista de rochas escuras
      const h2 = cume(g, { y: 590, amp: 26, esc: 140, seed: 6, c0: "#3a1a30", c1: "#1d0c24", bot: 700, rim: "rgba(255,130,50,.7)" });
      // lagos de lava ao fundo
      g.save(); g.globalCompositeOperation = "lighter"; for (let i = 0; i < 6; i++) { const x = 80 + i * 210 + r() * 60; g.fillStyle = rad(g, x, 612, 60, [[0, "rgba(255,120,30,.55)"], [1, "rgba(255,120,30,0)"]]); g.save(); g.translate(x, 612); g.scale(1, .18); g.translate(-x, -612); g.fillRect(x - 60, 552, 120, 120); g.restore(); } g.restore();
      // rochas pontiagudas à esquerda e direita (primeiro plano distante)
      [[-10, 190, 90], [1190, 220, 100], [100, 120, 60], [1100, 150, 70]].forEach(function(q, i) { const x = q[0], h = q[1], w = q[2]; g.fillStyle = "#26111f"; poli(g, [x - w, 720, x - w * .4, 720 - h * .8, x, 720 - h, x + w * .3, 720 - h * .6, x + w, 720]); g.fill(); g.fillStyle = "rgba(255,120,50,.25)"; poli(g, [x - w, 720, x - w * .4, 720 - h * .8, x - w * .3, 720]); g.fill(); });
      if (B > A) { g.fillStyle = vg(g, A, B, "#26111f", "#14060f"); g.fillRect(0, A - 1, L, B - A + 1); }
    },
    pad: function(p) { return [10, 10, 10, 34]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h;
      g.fillStyle = "rgba(10,0,10,.22)"; g.beginPath(); g.ellipse(w / 2, h + 34, w * .46, 6, 0, 0, TAU); g.fill();
      const r = rnd(70 + i);
      ilha(g, 0, 0, w, h, 26, { c: "#4a3648", seed: 17 + i, rach: 0, extra: function(g) {
        g.strokeStyle = "rgba(15,5,25,.35)"; g.lineWidth = 1.5; for (let x = 18; x < w - 8; x += 22) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 2, h + 8); g.stroke(); }   // colunas de basalto
        g.lineCap = "round"; g.lineJoin = "round";
        for (let k = 0; k < Math.round(w / 55); k++) { let x = 14 + r() * (w - 28), y = h * .35; const pts = [[x, y]]; for (let m = 0; m < 4; m++) { x += (r() - .5) * 20; y += 6 + r() * 7; pts.push([x, y]); }
          for (let q = 0; q < 2; q++) { g.beginPath(); pts.forEach((v, m) => g[m ? "lineTo" : "moveTo"](v[0], v[1])); g.lineWidth = q ? 1.4 : 4; g.strokeStyle = q ? "#ffd070" : "rgba(255,90,20,.5)"; g.stroke(); } }
        g.fillStyle = lin(g, 0, h * .4, 0, h + 26, [[0, "rgba(255,110,40,0)"], [1, "rgba(255,110,40,.45)"]]); g.fillRect(0, h * .4, w, h + 30);   // luz da lava vinda de baixo
        g.fillStyle = lin(g, 0, 0, 0, 8, [[0, "rgba(255,230,200,.5)"], [1, "rgba(255,230,200,0)"]]); g.fillRect(4, 1, w - 8, 8);
      } });
    },
    fundo: function(g, est, t) {
      // brasas subindo (sprites minúsculos) + pulso de brilho da cratera
      const a = [brasa(0)];
      for (let k = 0; k < 46; k++) { const v = 22 + (k % 5) * 12, x = mod(k * 137 + Math.sin(t * .8 + k * 1.3) * 26, L), y = est.altura - mod(k * 71 + t * v, est.altura + 40) - est.deslocY + 20, s = 5 + (k % 4) * 2; g.globalAlpha = .55 + .45 * Math.sin(t * 3 + k); g.drawImage(a[0], Math.round(x), Math.round(y), s, s); }
      glow(g, "#ff9a30", 640, 260, 360, .14 + .09 * Math.sin(t * 2.2));
    },
    frente: function(g, est, t) {
      const y0 = Math.round(est.lavaY), bot = est.altura - est.deslocY + 4;
      const mkTile = (k, seed, c0, c1) => spr("lavaTile" + k, 320, 120, function(c) { // superfície: faixa ondulada + crostas escuras e veios incandescentes
        const r = rnd(seed); c.fillStyle = vg(c, 0, 120, c0, c1); c.fillRect(0, 0, 320, 120);
        c.fillStyle = vg(c, 0, 120, "#ff7a22", "#b82810"); for (let i = 0; i < 10; i++) { c.beginPath(); c.ellipse(r() * 320, 20 + r() * 90, 24 + r() * 30, 5 + r() * 6, 0, 0, TAU); c.fill(); }
        for (let i = 0; i < 7; i++) { const x = 20 + r() * 280, y = 34 + r() * 70, rx = 12 + r() * 20; c.fillStyle = "rgba(255,230,120,.7)"; c.beginPath(); c.ellipse(x, y + 1.5, rx + 2, 5.5, 0, 0, TAU); c.fill(); c.fillStyle = "#3d1226"; c.beginPath(); c.ellipse(x, y, rx, 4.6, 0, 0, TAU); c.fill(); c.fillStyle = "#6a2430"; c.beginPath(); c.ellipse(x - rx * .15, y - 1.2, rx * .7, 2.4, 0, 0, TAU); c.fill(); }
        c.strokeStyle = "#ffe08a"; c.lineWidth = 2; c.lineCap = "round"; for (let i = 0; i < 6; i++) { c.beginPath(); const x = r() * 320, y = 30 + r() * 80; c.moveTo(x, y); c.quadraticCurveTo(x + 12, y + 8 * (r() - .5), x + 26, y + 2); c.stroke(); }
        c.globalCompositeOperation = "destination-out"; c.fillStyle = "#000"; c.beginPath(); c.moveTo(0, 0); c.lineTo(320, 0); c.lineTo(320, 12); for (let x = 320; x >= 0; x -= 8) c.lineTo(x, 12 + Math.sin(x / 320 * TAU * 2) * 5 + Math.sin(x / 320 * TAU * 5) * 2); c.closePath(); c.fill();
      });
      const brilhoL = spr("lavaGlow", L, 150, function(c) { c.fillStyle = vg(c, 0, 150, "rgba(255,120,40,0)", "rgba(255,120,40,.45)"); c.fillRect(0, 0, L, 150); });
      g.drawImage(brilhoL, 0, y0 - 140);
      g.fillStyle = "#c82a0e"; g.fillRect(0, y0 + 108, L, Math.max(0, bot - y0 - 108));
      const off = mod(t * 14, 320), off2 = mod(-t * 9 + 120, 320);
      const tile = mkTile(0, 3, "#ffb14a", "#e03a12"), tile2 = mkTile(1, 9, "#ff9a3a", "#c82a0e");
      for (let x = -320 + off2; x < L; x += 320) g.drawImage(tile2, Math.round(x), y0 - 6);
      for (let x = -320 + off; x < L; x += 320) g.drawImage(tile, Math.round(x), y0);
    }
  };

  // =========================
  // 5. ESPAÇO — nebulosa, planeta com anéis, asteroides low-poly com veios minerais
  // =========================
  // asteroide "low-poly" que preenche o retângulo (superelipse): faces sombreadas por luz de cima-esquerda
  function asteroide(g, x, y, w, h, seed, o) {
    o = o || {}; const r = rnd(seed), N = o.mini ? 10 : 16, cx = x + w / 2, cy = y + h / 2, pts = [], pin = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, cs = Math.cos(a), sn = Math.sin(a), k = (o.mini ? .94 : .9) + r() * .1, ex = 2 / 3.6;
      pts.push([cx + Math.sign(cs) * Math.pow(Math.abs(cs), ex) * w / 2 * k, cy + Math.sign(sn) * Math.pow(Math.abs(sn), ex) * h / 2 * k]);
      const b = a + (r() - .5) * .3; pin.push([cx - w * .06 + Math.cos(b) * w * .27 * (.8 + r() * .4), cy - h * .06 + Math.sin(b) * h * .27 * (.8 + r() * .4)]);
    }
    const base = o.c || "#6c6296", lz = Math.atan2(-1, -.8);
    g.beginPath(); pts.forEach((q, i) => g[i ? "lineTo" : "moveTo"](q[0], q[1])); g.closePath();
    g.fillStyle = somb(base, .5); g.fill();
    g.save(); g.clip();
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, a = (i + .5) / N * TAU, l = (Math.cos(a - lz) + 1) / 2, v = l * .85 + (r() - .5) * .22;
      g.fillStyle = mix(somb(base, .55), clar(base, .45), Math.max(0, Math.min(1, v))); poli(g, [pts[i][0], pts[i][1], pts[j][0], pts[j][1], pin[j][0], pin[j][1], pin[i][0], pin[i][1]]); g.fill();
      const v2 = Math.max(0, Math.min(1, l * .9 + .08 + (r() - .5) * .2)); g.fillStyle = mix(somb(base, .35), clar(base, .6), v2); poli(g, [pin[i][0], pin[i][1], pin[j][0], pin[j][1], cx - w * .04, cy - h * .04]); g.fill();
    }
    if (!o.mini) {
      for (let i = 0; i < 3; i++) { const px = cx + (r() - .5) * w * .5, py = cy + (r() - .3) * h * .45, rx = 6 + r() * 9; g.fillStyle = "rgba(25,15,60,.4)"; g.beginPath(); g.ellipse(px, py, rx, rx * .6, 0, 0, TAU); g.fill(); g.strokeStyle = "rgba(255,240,255,.4)"; g.lineWidth = 1.2; g.beginPath(); g.ellipse(px, py, rx, rx * .6, 0, Math.PI * .8, Math.PI * 1.6); g.stroke(); }
      g.strokeStyle = "#6fe6ff"; g.lineWidth = 1.6; g.lineCap = "round"; g.lineJoin = "round"; // veio mineral brilhante
      g.beginPath(); let vx = x + w * (.15 + r() * .3), vy = y + h * (.5 + r() * .3); g.moveTo(vx, vy); for (let k = 0; k < 4; k++) { vx += 8 + r() * 10; vy += (r() - .6) * 12; g.lineTo(vx, vy); } g.stroke();
    }
    g.fillStyle = rad(g, cx, cy, Math.max(w, h) * .8, [[0, "rgba(130,210,255,0)"], [.7, "rgba(130,210,255,0)"], [1, "rgba(130,210,255,.4)"]], cx + w * .35, cy + h * .35, 0); g.fillRect(x - 4, y - 4, w + 8, h + 8);   // luz de borda do lado oposto
    g.restore();
    g.beginPath(); pts.forEach((q, i) => g[i ? "lineTo" : "moveTo"](q[0], q[1])); g.closePath(); contorno(g, base, 2);
  }
  CEN.espaco = {
    vin: .42,
    pre: function(g) {
      const T = S.top, B = S.bot, r = rnd(14);
      ceu(g, T, B, [[0, "#070620"], [.5, "#120b34"], [1, "#0a0824"]], T, B);
      // nebulosa ao longo de uma diagonal (nuvens suaves em 3 cores)
      // nebulosa: nuvens suaves desenhadas num canvas de 1/4 do tamanho (gradientes baratos) e ampliadas uma vez
      const E = 4, nb = nova(L / E, (B - T) / E), q = nb.getContext("2d");
      function blob(x, y, rr3, c, a) { x /= E; y = (y - T) / E; rr3 /= E; q.fillStyle = rad(q, x, y, rr3, [[0, ca(c, a)], [.5, ca(c, a * .45)], [1, ca(c, 0)]]); q.fillRect(x - rr3, y - rr3, rr3 * 2, rr3 * 2); }
      for (let i = 0; i < 30; i++) { const u = r(), x = 100 + u * 1100 + (r() - .5) * 360, y = 560 - u * 420 + (r() - .5) * 280; blob(x, y, 110 + r() * 200, ["#b2399a", "#2d9fc4", "#6a3fd8", "#d85a8a"][i % 4], .24); }
      q.globalCompositeOperation = "lighter"; for (let i = 0; i < 10; i++) { const u = r(), x = 200 + u * 900 + (r() - .5) * 200, y = 520 - u * 380 + (r() - .5) * 150; blob(x, y, 50 + r() * 70, "#ff96dc", .14); }
      g.drawImage(nb, 0, T, L, B - T);
      estrelas(g, 380, 21, T, B, "#ffffff"); estrelas(g, 60, 22, T, B, "#a8c8ff", 1.5); estrelas(g, 40, 23, T, B, "#ffc8a0", 1.4);
      [[180, 90], [900, 610], [1130, 70], [430, 650]].forEach(q => { halo(g, q[0], q[1], 22, "#ffffff", .7); g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(q[0] - 14, q[1] - .6, 28, 1.2); g.fillRect(q[0] - .6, q[1] - 14, 1.2, 28); });
      // lua pequena
      g.fillStyle = rad(g, 270, 130, 26, [[0, "#f0e8ff"], [.6, "#a79ccc"], [1, "#4a3f78"]], 260, 120, 4); C(g, 270, 130, 26); g.fill(); g.fillStyle = "rgba(60,40,110,.4)"; C(g, 282, 138, 6); g.fill(); C(g, 262, 124, 4); g.fill();
      // planeta com anéis (parte de trás do anel, planeta, parte da frente)
      const px = 1080, py = 590, pr = 135;
      function aneis(frente) { g.save(); g.translate(px, py); g.rotate(-.35); [[1.55, 6, "rgba(220,190,255,.35)"], [1.75, 12, "rgba(190,160,240,.5)"], [1.95, 5, "rgba(200,180,255,.3)"]].forEach(q => { g.lineWidth = q[1]; g.strokeStyle = q[2]; g.beginPath(); g.ellipse(0, 0, pr * q[0], pr * q[0] * .26, 0, frente ? 0 : Math.PI, frente ? Math.PI : TAU); g.stroke(); }); g.restore(); }
      aneis(false);
      g.save(); C(g, px, py, pr); g.clip();
      g.fillStyle = lin(g, px - pr, py - pr, px + pr, py + pr, [[0, "#d9a0d8"], [.35, "#9b62c8"], [1, "#3a2a7a"]]); g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      for (let k = 0; k < 8; k++) { g.fillStyle = "rgba(" + (k % 2 ? "255,200,240" : "70,40,120") + ",.16)"; g.beginPath(); g.ellipse(px, py - pr + k * pr * .27 + 14, pr * 1.2, pr * .06, -.2, 0, TAU); g.fill(); }
      g.fillStyle = rad(g, px, py, pr * 1.15, [[0, "rgba(10,5,40,0)"], [.55, "rgba(10,5,40,0)"], [1, "rgba(10,5,40,.88)"]], px - pr * .5, py - pr * .5, pr * .2); g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      g.restore(); aneis(true);
      g.strokeStyle = "rgba(255,200,255,.35)"; g.lineWidth = 2; g.beginPath(); g.arc(px, py, pr, Math.PI * .95, Math.PI * 1.55); g.stroke();
      // campo de asteroides distantes (silhuetas pequenas, baixo contraste)
      for (let i = 0; i < 14; i++) { const s = 8 + r() * 24, x = r() * L, y = T + r() * (B - T); g.save(); g.globalAlpha = .55; g.translate(x, y); g.rotate(r() * 6); asteroide(g, -s / 2, -s * .4, s, s * .8, i + 5, { mini: true, c: "#463d70" }); g.restore(); }
    },
    pad: function(p) { return [10, 10, 10, 10]; },
    plat: function(g, p, i) { asteroide(g, 0, 0, p.w, p.h, 9 + i * 13); },
    fundo: function(g, est, t) {
      // estrelas pulsando + asteroides à deriva (sprites girando devagar) + estrela cadente
      const e = spr("estEsp", 14, 14, c => faisca(c, 7, 7, 6.5, "#ffffff"));
      for (let k = 0; k < 24; k++) { g.globalAlpha = .25 + .75 * Math.max(0, Math.sin(t * (.8 + (k % 4) * .4) + k * 1.9)); g.drawImage(e, Math.round((k * 541) % 1260 + 4), Math.round((k * 233) % 700 - est.deslocY * 0)); }
      g.globalAlpha = 1;
      for (let k = 0; k < 4; k++) {   // asteroides distantes à deriva: escuros e pequenos (não confundir com plataformas)
        const s = 22 + (k % 2) * 12, sp = spr("ast" + k, s + 8, s + 8, c => { c.globalAlpha = .6; asteroide(c, 4, 4 + s * .1, s, s * .8, 60 + k, { mini: true, c: "#3e3668" }); });
        const x = mod(k * 313 + t * (6 + k * 2.5), L + 140) - 70, y = mod(k * 191 + 90 + Math.sin(t * .25 + k) * 30, 640);
        g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(t * (.12 + k * .03) * (k % 2 ? 1 : -1)); g.drawImage(sp, -(s + 8) / 2, -(s + 8) / 2); g.restore();
      }
      const c = mod(t + 3, 9); if (c < .8) { const k = c / .8, x = 900 - k * 560, y = 60 + k * 190; g.strokeStyle = "rgba(255,255,255," + (1 - k) + ")"; g.lineWidth = 2.2; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 90, y - 34); g.stroke(); }
    }
  };

  // =========================
  // 6. LABORATÓRIO — sala de contenção: painéis, porta-cofre, tubos de líquido, teto e chão espelhados
  // =========================
  function tubo(g, x, y, w, h, cor, nivel) { // tubo de vidro com líquido brilhante
    g.fillStyle = "#1a2a38"; rr(g, x - 6, y - 10, w + 12, 16, 5); g.fill(); rr(g, x - 6, y + h - 6, w + 12, 18, 5); g.fill();
    g.fillStyle = "#33495c"; rr(g, x - 6, y - 10, w + 12, 5, 3); g.fill(); rr(g, x - 6, y + h + 7, w + 12, 5, 3); g.fill();
    g.save(); rr(g, x, y, w, h, w * .4); g.clip();
    g.fillStyle = "rgba(160,220,240,.12)"; g.fillRect(x, y, w, h);
    const ny = y + h * (1 - nivel); g.fillStyle = lin(g, x, 0, x + w, 0, [[0, ca(cor, .9)], [.5, ca(clar(cor, .4), .95)], [1, ca(somb(cor, .5), .95)]]); g.fillRect(x, ny, w, h);
    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x, ny, w, 3);
    g.fillStyle = "rgba(255,255,255,.4)"; rr(g, x + w * .14, y + 8, w * .12, h - 16, 3); g.fill();
    g.restore(); g.lineWidth = 2; g.strokeStyle = "rgba(190,230,245,.7)"; rr(g, x, y, w, h, w * .4); g.stroke();
  }
  function painelLab(g, x, y, w, h, c, a) { // painel de parede com chanfro
    g.fillStyle = lin(g, x, y, x + w, y + h, [[0, clar(c, .08)], [1, somb(c, .15)]]); g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h); g.fillStyle = "rgba(5,15,30,.35)"; g.fillRect(x, y + h - 2, w, 2); g.fillRect(x + w - 2, y, 2, h);
  }
  CEN.laboratorio = {
    vin: .35,
    pre: function(g) {
      const T = S.top, B = S.bot;
      ceu(g, T, B, [[0, "#1b3040"], [1, "#142330"]], T, B);
      for (let y = T - (T % 120) - 120; y < B; y += 120) for (let x = 0; x < L; x += 160) painelLab(g, x, y + 60, 160, 120, "#264559");
      // luzes de teto/chão (cones suaves)
      for (let x = 160; x < L; x += 320) { g.fillStyle = lin(g, 0, 60, 0, 300, [[0, "rgba(190,240,255,.2)"], [1, "rgba(190,240,255,0)"]]); poli(g, [x - 30, 60, x + 30, 60, x + 120, 300, x - 120, 300]); g.fill(); g.fillStyle = lin(g, 0, 660, 0, 420, [[0, "rgba(190,240,255,.16)"], [1, "rgba(190,240,255,0)"]]); poli(g, [x - 30, 660, x + 30, 660, x + 120, 420, x - 120, 420]); g.fill(); }
      // canos horizontais com braçadeiras
      [[100, 9], [620, 9]].forEach(function(q) { g.fillStyle = vg(g, q[0] - q[1], q[0] + q[1], "#6f8ca0", "#27424f"); g.fillRect(0, q[0] - q[1], L, q[1] * 2); g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(0, q[0] - q[1] + 2, L, 2); for (let x = 60; x < L; x += 180) { g.fillStyle = "#3a566a"; g.fillRect(x, q[0] - q[1] - 3, 14, q[1] * 2 + 6); g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(x, q[0] - q[1] - 3, 3, q[1] * 2 + 6); } });
      // porta-cofre central
      const cx = 640, cy = 360, R = 170;
      halo(g, cx, cy, 330, "#4de3d0", .22);
      g.fillStyle = "#14222e"; C(g, cx, cy, R + 14); g.fill();
      g.fillStyle = lin(g, cx - R, cy - R, cx + R, cy + R, [[0, "#8aa4b6"], [.5, "#506a7e"], [1, "#2a3e50"]]); C(g, cx, cy, R); g.fill();
      g.save(); C(g, cx, cy, R); C(g, cx, cy, R - 24); g.clip("evenodd"); alerta(g, cx - R, cy - R, R * 2, R * 2, "#f2b628", "#26323e", 16); g.restore();
      g.fillStyle = lin(g, cx - R, cy - R, cx + R, cy + R, [[0, "#6f8a9d"], [1, "#2c4254"]]); C(g, cx, cy, R - 24); g.fill();
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; rebite(g, cx + Math.cos(a) * (R - 38), cy + Math.sin(a) * (R - 38), 5, "#8aa4b6"); }
      for (let k = 0; k < 6; k++) { g.save(); g.translate(cx, cy); g.rotate(k * Math.PI / 3 + .2); g.fillStyle = "#3b5366"; rr(g, 30, -9, R - 80, 18, 5); g.fill(); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(34, -7, R - 88, 3); g.restore(); }
      g.fillStyle = "#13222f"; C(g, cx, cy, 44); g.fill(); g.fillStyle = rad(g, cx, cy, 36, [[0, "#d6fff8"], [.4, "#4de3d0"], [1, "#0f7a80"]]); C(g, cx, cy, 36); g.fill();
      g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 36, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
      // tubos laterais
      tubo(g, 70, 150, 76, 420, "#42e6a8", .72); tubo(g, 1134, 150, 76, 420, "#7a8cff", .6); tubo(g, 220, 210, 40, 300, "#ff9a4d", .5); tubo(g, 1020, 210, 40, 300, "#42d0ff", .8);
      // monitores
      [[320, 150], [880, 150]].forEach(function(q, k) { g.fillStyle = "#101c26"; rr(g, q[0], q[1], 160, 96, 8); g.fill(); g.fillStyle = "#06141a"; rr(g, q[0] + 6, q[1] + 6, 148, 84, 5); g.fill(); g.strokeStyle = "rgba(77,227,208,.18)"; g.lineWidth = 1; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(q[0] + 6, q[1] + 6 + i * 17); g.lineTo(q[0] + 154, q[1] + 6 + i * 17); g.stroke(); } g.fillStyle = "#3a566a"; g.fillRect(q[0] + 70, q[1] + 96, 20, 10); });
      // chevrons de alerta nas faixas perto do teto e do chão
      [[78, 1], [642, -1]].forEach(function(q) { g.fillStyle = "rgba(255,176,46,.5)"; for (let x = 40; x < L; x += 90) { g.beginPath(); g.moveTo(x, q[0] - 8 * q[1]); g.lineTo(x + 14, q[0]); g.lineTo(x, q[0] + 8 * q[1]); g.lineTo(x + 6, q[0]); g.closePath(); g.fill(); } });
      // teto e base extra (celular em pé)
      if (T < 0) { g.fillStyle = "#2a3f52"; g.fillRect(0, T, L, -T + 1); g.fillStyle = "#e4eef6"; g.fillRect(0, -2, L, 2); }
      if (B > A) { g.fillStyle = "#2a3f52"; g.fillRect(0, A - 1, L, B - A + 1); g.fillStyle = "#e4eef6"; g.fillRect(0, A, L, 2); }
    },
    pad: function(p) { return p.w > 1200 ? [0, 0, 0, 0] : [10, 10, 10, 10]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h;
      if (w > 1200) { // chão e teto: placa de aço com faixa de alerta e fenda de luz (o teto é espelhado)
        g.save(); if (p.y < 100) { g.translate(0, h); g.scale(1, -1); }
        g.fillStyle = lin(g, 0, 0, 0, h, [[0, "#d7e3ec"], [.12, "#9fb4c4"], [.5, "#56707f"], [1, "#2c4151"]]); g.fillRect(-4, 0, w + 8, h + 80);
        for (let x = 0; x < w; x += 160) { g.fillStyle = "rgba(10,25,40,.35)"; g.fillRect(x, 8, 2, h); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(x + 2, 8, 1.5, h); for (let k = 0; k < 2; k++) { rebite(g, x + 14, 22 + k * 22, 3.2, "#8aa4b6"); rebite(g, x + 146, 22 + k * 22, 3.2, "#8aa4b6"); } }
        alerta(g, 0, 8, w, 8, "#f2b628", "#26323e", 14);
        g.fillStyle = "#0e1d28"; g.fillRect(0, 17, w, 2.5); g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(0, 0, w, 2);
        g.restore(); return;
      }
      g.fillStyle = "rgba(10,20,40,.25)"; g.beginPath(); g.ellipse(w / 2, h + 7, w * .45, 4, 0, 0, TAU); g.fill();
      rr(g, 0, 0, w, h, 6); g.save(); g.clip();
      g.fillStyle = lin(g, 0, 0, 0, h, [[0, "#f1f7fb"], [.18, "#c6d6e2"], [.5, "#8da5b6"], [.82, "#c6d6e2"], [1, "#e8f1f7"]]); g.fillRect(0, 0, w, h);
      g.fillStyle = "#12222e"; g.fillRect(24, h / 2 - 3, w - 48, 6); g.fillStyle = "#4de3d0"; for (let x = 28; x < w - 30; x += 14) g.fillRect(x, h / 2 - 1.5, 9, 3);   // fenda com LEDs
      alerta(g, 0, 0, 16, h, "#f2b628", "#26323e", 8); alerta(g, w - 16, 0, 16, h, "#f2b628", "#26323e", 8);
      g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(0, 1, w, 1.5); g.fillRect(0, h - 3, w, 1.5);
      for (let k = 0; k < 2; k++) { rebite(g, 28, 5 + k * (h - 10), 2.3, "#a8bccb"); rebite(g, w - 28, 5 + k * (h - 10), 2.3, "#a8bccb"); }
      g.restore(); rr(g, 0, 0, w, h, 6); contorno(g, "#7f98aa", 2);
    },
    anim: function(g, p, i, est, t) { // o lado "chão" (onde a gravidade puxa) brilha em ciano
      if (p.w < 1200) return;
      const ativo = (p.y > 100) === (est.gravidade >= 0); if (!ativo) return;
      const s = spr("faixaLab" + (p.y > 100 ? 0 : 1), L, 30, c => { c.fillStyle = p.y > 100 ? vg(c, 0, 30, "rgba(77,227,208,0)", "rgba(77,227,208,.5)") : vg(c, 0, 30, "rgba(77,227,208,.5)", "rgba(77,227,208,0)"); c.fillRect(0, 0, L, 30); });
      g.globalAlpha = .7 + .3 * Math.sin(t * 3); g.drawImage(s, 0, p.y > 100 ? p.y - 30 : p.y + p.h); g.globalAlpha = 1;
    },
    fundo: function(g, est, t) {
      // bolhas nos tubos, pulso da porta, gráfico nos monitores, luzes de alerta piscando
      const b = spr("bolhaLab", 8, 8, c => { c.fillStyle = "rgba(230,255,250,.8)"; C(c, 4, 4, 3); c.fill(); });
      [[70, 76, 150, 420], [1134, 76, 150, 420], [220, 40, 210, 300], [1020, 40, 210, 300]].forEach(function(q, k) {
        for (let m = 0; m < 5; m++) { const y = q[2] + q[3] - 14 - mod(t * (24 + m * 6) + m * 97 + k * 31, q[3] * (.55 + k * .05)); g.globalAlpha = .8; g.drawImage(b, Math.round(q[0] + 10 + ((m * 29 + k * 11) % (q[1] - 20)) + Math.sin(t * 2 + m) * 3), Math.round(y)); }
      }); g.globalAlpha = 1;
      g.strokeStyle = "#4de3d0"; g.lineWidth = 1.8; g.lineJoin = "round";
      [[326, 156], [886, 156]].forEach(function(q, k) { g.beginPath(); for (let x = 0; x <= 148; x += 6) { const y = q[1] + 42 + Math.sin((x + t * 60) / (14 + k * 6)) * 14 * Math.sin(t + x / 40) + Math.sin((x - t * 40) / 7) * 5; g[x ? "lineTo" : "moveTo"](q[0] + x, y); } g.stroke(); });
      glow(g, "#4de3d0", 640, 360, 400, .14 + .1 * Math.sin(t * 2));
      [[300, 96], [980, 96], [300, 626], [980, 626]].forEach(function(q, k) { const on = Math.floor(t * 1.5 + k * .5) % 2 === 0; g.fillStyle = on ? "#ff4d5a" : "#5a2a34"; C(g, q[0], q[1], 5); g.fill(); if (on) glow(g, "#ff4d5a", q[0], q[1], 36, .5); });
    },
    frente: function(g, est, t) {
      const a = est.avisoInversao; if (!(a > .02)) return;
      const pul = .55 + .45 * Math.sin(t * 12);
      const fx = [0, 1].map(k => spr("faixaAviso" + k, L, 140, c => { c.fillStyle = k ? vg(c, 0, 140, "rgba(255,40,60,0)", "rgba(255,40,60,.6)") : vg(c, 0, 140, "rgba(255,40,60,.6)", "rgba(255,40,60,0)"); c.fillRect(0, 0, L, 140); }));
      g.globalAlpha = a * pul; g.drawImage(fx[0], 0, -est.deslocY); g.drawImage(fx[1], 0, est.altura - est.deslocY - 140);
      // setas grandes indicando para onde a gravidade vai virar (gravidade normal = para baixo -> vai virar para cima)
      const dir = est.gravidade >= 0 ? -1 : 1;
      const sa = [0, 1].map(k => spr("setaAviso" + k, 80, 70, c => { c.translate(40, 35); c.scale(1, k ? -1 : 1); c.translate(-40, -35); c.fillStyle = "#ff3d52"; poli(c, [40, 6, 74, 44, 52, 44, 52, 66, 28, 66, 28, 44, 6, 44]); c.fill(); c.strokeStyle = "#ffd0d6"; c.lineWidth = 3; c.lineJoin = "round"; c.stroke(); }));
      g.globalAlpha = a * pul * .9;
      for (let k = 0; k < 3; k++) { const x = 100 + k * 500; for (let m = 0; m < 3; m++) g.drawImage(sa[dir < 0 ? 0 : 1], x, Math.round(mod(360 + dir * (t * 160 + m * 240), 720) - 60)); }
      g.globalAlpha = 1;
    }
  };

  // =========================
  // 7. DOJO — ringue de sumô flutuando sobre um mar de nuvens ao entardecer, torii, pagodes distantes
  // =========================
  function pagode(g, x, y, s, c, luzJ) { // pagode de 3 andares em silhueta (com janelas acesas)
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = c;
    for (let i = 0; i < 3; i++) { const w = 46 - i * 10, yy = -i * 30; g.fillRect(-w / 2 + 4, yy - 24, w - 8, 24); poli(g, [-w / 2 - 12, yy - 24, w / 2 + 12, yy - 24, w / 2 + 2, yy - 32, -w / 2 - 2, yy - 32]); g.fill(); poli(g, [-w / 2 - 12, yy - 24, -w / 2 - 17, yy - 29, -w / 2 - 6, yy - 25]); g.fill(); poli(g, [w / 2 + 12, yy - 24, w / 2 + 17, yy - 29, w / 2 + 6, yy - 25]); g.fill(); }
    g.fillRect(-1.5, -112, 3, 22); if (luzJ) { g.fillStyle = luzJ; for (let i = 0; i < 3; i++) g.fillRect(-3, -i * 30 - 17, 6, 8); }
    g.restore();
  }
  function ilhaDistante(g, x, y, w, c, seed) { // rocha flutuante distante com pagode
    const r = rnd(seed); g.fillStyle = c; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.quadraticCurveTo(x + w * .4, y + w * .3, x + w * .1, y + w * .75); g.lineTo(x + w * .02, y + w * .9 + r() * 10); g.lineTo(x - w * .12, y + w * .6); g.quadraticCurveTo(x - w * .4, y + w * .3, x - w / 2, y); g.fill();
  }
  CEN.dojo = {
    vin: .38,
    pre: function(g) {
      const T = S.top, B = S.bot, r = rnd(61);
      ceu(g, T, 600, [[0, "#1d1450"], [.28, "#52286e"], [.52, "#c8416f"], [.76, "#ff8a5a"], [1, "#ffcf86"]], T, B);
      estrelas(g, 70, 3, T, 220, "#ffe9f4");
      // sol baixo + brilho e raios
      halo(g, 640, 440, 700, "#ffb060", .6); raios(g, 640, 440, Math.PI * 1.04, Math.PI * 1.96, 16, 1000, "#ffe0a0", .1, 3);
      g.fillStyle = lin(g, 0, 330, 0, 550, [[0, "#fff1c0"], [1, "#ffb25a"]]); C(g, 640, 440, 125); g.fill();
      // nuvens altas listradas
      for (let i = 0; i < 6; i++) { g.globalAlpha = .5; nuvem(g, 80 + i * 230 + r() * 60, 150 + r() * 130, 300 + r() * 160, "#ffb0a0", "#e0689a", "#8a3a86"); } g.globalAlpha = 1;
      // montanha estilo Fuji ao fundo e cordilheira
      g.fillStyle = vg(g, 280, 560, "#8a4a96", "#d07a9e"); g.beginPath(); g.moveTo(-40, 600); g.lineTo(130, 330); g.quadraticCurveTo(220, 270, 310, 270); g.quadraticCurveTo(400, 270, 480, 340); g.lineTo(640, 600); g.fill();
      g.fillStyle = "#ffe4ef"; poli(g, [196, 292, 224, 275, 262, 272, 300, 274, 330, 290, 308, 308, 290, 296, 266, 314, 244, 300, 222, 318]); g.fill();
      g.fillStyle = "rgba(60,20,90,.25)"; poli(g, [310, 270, 480, 340, 640, 600, 330, 600]); g.fill();
      montanhas(g, { y: 560, alt: 120, passo: 190, seed: 9, c0: "#7b3a8e", c1: "#c85a8e", sh: "#4a2072", shA: .3, luz: "#ffc0b0", luzA: .2, bot: 640 });
      // ilhas flutuantes distantes com pagodes
      [[1010, 290, 120], [190, 420, 90], [1180, 470, 70]].forEach(function(q, i) { ilhaDistante(g, q[0], q[1], q[2], "#76388e", i + 1); pagode(g, q[0] + 4, q[1], q[2] / 150, "#6a2f86", "rgba(255,200,120,.8)"); });
      bruma(g, 330, 560, "#ffb1a0", .3);
      // torii vermelho grande atrás do ringue, enquadrando o sol
      const tc = "#8a2c4a", td = "#5c1c42";
      g.fillStyle = tc; g.fillRect(468, 300, 22, 230); g.fillRect(790, 300, 22, 230); g.fillStyle = td; g.fillRect(480, 300, 10, 230); g.fillRect(802, 300, 10, 230);
      g.fillStyle = tc; g.beginPath(); g.moveTo(430, 300); g.quadraticCurveTo(640, 320, 850, 300); g.lineTo(870, 276); g.quadraticCurveTo(640, 296, 410, 276); g.closePath(); g.fill();
      g.fillStyle = "#b24260"; g.fillRect(450, 340, 380, 14); g.fillStyle = td; g.fillRect(450, 352, 380, 3); g.fillStyle = "#3b1238"; g.fillRect(632, 300, 16, 40); g.fillStyle = "rgba(255,200,160,.35)"; g.fillRect(468, 300, 4, 230);
      // mar de nuvens em 4 camadas (mais escuras e mais roxas perto)
      [[560, "#ffb59a", "#e86a90", 12], [600, "#f0809a", "#b04a90", 14], [650, "#b85a9a", "#7a3a8e", 16], [700, "#7c4090", "#4a2a78", 18]].forEach(function(q, k) {
        cume(g, { y: q[0], amp: q[3], esc: 90 - k * 8, seed: 40 + k, c0: q[1], c1: q[2], bot: B + 20, rim: k < 3 ? "rgba(255,230,190," + (.7 - k * .15) + ")" : null });
        for (let i = 0; i < 8; i++) { g.globalAlpha = .9; nuvem(g, r() * L, q[0] - 6 + r() * 14, 220 + r() * 160, mix(q[1], "#ffffff", .25), q[1], q[2]); } g.globalAlpha = 1;
        bruma(g, q[0], q[0] + 80, q[2], .25);
      });
      if (B > A) { g.fillStyle = vg(g, A, B, "#4a2a78", "#2a1858"); g.fillRect(0, A - 1, L, B - A + 1); }
    },
    pad: function(p) { return p.h > 30 ? [14, 14, 14, 96] : [14, 14, 14, 44]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h;
      g.fillStyle = "rgba(50,20,80,.18)"; g.beginPath(); g.ellipse(w / 2, h + (h > 30 ? 90 : 38), w * .4, 6, 0, 0, TAU); g.fill();
      if (h > 30) { // ringue: rocha flutuante + base de madeira laqueada + areia + cordas de palha
        ilha(g, 0, 0, w, h, 70, { c: "#7a5a6a", seed: 5, pot: 1.1 });
        g.fillStyle = lin(g, 0, 0, 0, h, [[0, "#f0d8a8"], [.2, "#e0c088"], [.2, "#c8323a"], [.75, "#9c2230"], [.75, "#e8b64a"], [.85, "#e8b64a"], [.85, "#5c1c2c"], [1, "#4a1424"]]);
        rr(g, 0, 0, w, h, 6); g.fill(); contorno(g, "#9c2230", 2);
        g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(4, 1, w - 8, 2);
        for (let x = 24; x < w - 10; x += 60) { g.fillStyle = "rgba(60,10,30,.35)"; rr(g, x, 15, 40, 10, 3); g.fill(); g.fillStyle = "#e8b64a"; C(g, x + 20, 20, 2.4); g.fill(); }
        [0, 1].forEach(function(k) { const x = k ? w - 42 : 14; g.fillStyle = "#c9a560"; rr(g, x, -3, 28, 8, 4); g.fill(); g.fillStyle = "#e8cc88"; rr(g, x + 2, -2, 24, 3, 2); g.fill(); g.strokeStyle = "rgba(120,80,30,.6)"; g.lineWidth = 1; for (let q = 0; q < 5; q++) { g.beginPath(); g.moveTo(x + 5 + q * 5, -3); g.lineTo(x + 7 + q * 5, 5); g.stroke(); } });
        return;
      }
      // tábua pequena de madeira laqueada com lanterna pendurada
      rr(g, 0, 0, w, h, 5);
      g.fillStyle = lin(g, 0, 0, 0, h, [[0, "#e8a470"], [.35, "#c0623a"], [1, "#7a3024"]]); g.fill();
      g.save(); rr(g, 0, 0, w, h, 5); g.clip(); g.strokeStyle = "rgba(60,20,20,.3)"; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(0, 4 + k * 4); g.bezierCurveTo(w * .3, 2 + k * 4, w * .6, 7 + k * 4, w, 4 + k * 4); g.stroke(); }
      g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(0, 1, w, 2); g.restore();
      g.fillStyle = "#e8b64a"; rr(g, 0, 0, 14, h, 4); g.fill(); rr(g, w - 14, 0, 14, h, 4); g.fill(); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(2, 1, 10, 2); g.fillRect(w - 12, 1, 10, 2);
      rr(g, 0, 0, w, h, 5); contorno(g, "#9c3a2a", 2);
      halo(g, w / 2, h + 22, 30, "#ffb060", .45);
      g.strokeStyle = "#5c1c2c"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, h + 8); g.stroke();
      g.fillStyle = "#e8363e"; g.beginPath(); g.ellipse(w / 2, h + 20, 10, 12, 0, 0, TAU); g.fill(); g.fillStyle = "#ff8a6a"; g.beginPath(); g.ellipse(w / 2 - 3, h + 17, 3.5, 6, 0, 0, TAU); g.fill();
      g.strokeStyle = "rgba(100,10,30,.5)"; g.lineWidth = 1; for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(w / 2, h + 20, 10 * Math.abs(k) + .01, 12, 0, 0, TAU); g.stroke(); }
      g.fillStyle = "#5c1c2c"; g.fillRect(w / 2 - 7, h + 7, 14, 3); g.fillRect(w / 2 - 7, h + 30, 14, 3); g.strokeStyle = "#e8b64a"; g.beginPath(); g.moveTo(w / 2, h + 33); g.lineTo(w / 2, h + 40); g.stroke();
    },
    fundo: function(g, est, t) {
      const n = [spr("dn0", 320, 110, c => { c.globalAlpha = .6; nuvem(c, 160, 60, 280, "#ffc0a8", "#e8708f", "#9a4a90"); }), spr("dn1", 240, 90, c => { c.globalAlpha = .6; nuvem(c, 120, 50, 200, "#ffc0a8", "#e8708f", "#9a4a90"); })];
      [[0, 90, 100, 5, 0], [1, 400, 60, 4, 500], [0, 700, 190, 6, 100], [1, 980, 120, 3, 700], [0, 900, 250, 5, 300]].forEach(function(q) { g.drawImage(n[q[0]], Math.round(mod(q[1] + q[4] + t * q[3], L + 400) - 320), q[2]); });
      // pétalas de sakura caindo
      const pe = [spr("pt0", 8, 6, c => { c.fillStyle = "#ffc2d8"; c.beginPath(); c.ellipse(4, 3, 3.6, 2.2, .5, 0, TAU); c.fill(); c.fillStyle = "#ff9fc0"; c.beginPath(); c.ellipse(5, 3.4, 2, 1.2, .5, 0, TAU); c.fill(); }), spr("pt1", 10, 8, c => { c.fillStyle = "#ffd6e6"; c.beginPath(); c.ellipse(5, 4, 4.4, 2.8, -.5, 0, TAU); c.fill(); c.fillStyle = "#ff9fc0"; c.beginPath(); c.ellipse(6, 4.2, 2.4, 1.4, -.5, 0, TAU); c.fill(); })];
      for (let k = 0; k < 34; k++) { const v = 22 + (k % 4) * 9, x = mod(k * 79 + t * (14 + (k % 3) * 6) + Math.sin(t * .9 + k) * 30, L + 20) - 10, y = mod(k * 53 + t * v, est.altura + 20) - 10 - est.deslocY; g.drawImage(pe[k % 2], Math.round(x), Math.round(y)); }
      // garças voando
      const a0 = spr("g0", 26, 14, c => { c.strokeStyle = "#6a2a6e"; c.lineWidth = 2.2; c.lineCap = "round"; c.beginPath(); c.moveTo(1, 3); c.quadraticCurveTo(7, 11, 13, 8); c.quadraticCurveTo(19, 11, 25, 3); c.stroke(); }), a1 = spr("g1", 26, 14, c => { c.strokeStyle = "#6a2a6e"; c.lineWidth = 2.2; c.lineCap = "round"; c.beginPath(); c.moveTo(1, 11); c.quadraticCurveTo(7, 3, 13, 8); c.quadraticCurveTo(19, 3, 25, 11); c.stroke(); });
      for (let k = 0; k < 3; k++) g.drawImage(Math.floor(t * 2.5 + k) % 2 ? a0 : a1, Math.round(mod(t * 26 + k * 70 - 60, L + 120) - 40 - k * 20), Math.round(210 + k * 24 + Math.sin(t + k) * 8));
    }
  };

  // =========================
  // 8. CIDADE — metrópole neon à noite, vão entre prédios, carros voadores
  // =========================
  function predios(g, o) { // fileira de prédios (silhuetas com janelas); registra janelas acesas para animar
    const r = rnd(o.seed); let x = o.x0 == null ? -20 : o.x0;
    while (x < (o.x1 || L + 20)) {
      const w = o.wMin + r() * (o.wMax - o.wMin), h = o.hMin + r() * (o.hMax - o.hMin), y = o.y - h;
      g.fillStyle = lin(g, 0, y, 0, o.y, [[0, o.c0], [1, o.c1]]); g.fillRect(x, y, w, o.bot - y);
      if (r() < .45) { g.fillRect(x + w * .2, y - 14, w * .6, 14); }
      if (r() < .35) { g.fillRect(x + w * .48, y - 36, 3, 36); if (o.antena) { g.fillStyle = "#ff4d6a"; C(g, x + w * .48 + 1.5, y - 37, 2.2); g.fill(); } }
      g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(x, y, 2, o.bot - y);       // luz de borda à esquerda
      g.fillStyle = "rgba(10,0,40,.25)"; g.fillRect(x + w - 4, y, 4, o.bot - y);
      const cw = o.jan, ch = o.jan * 1.4;
      for (let jy = y + 10; jy < o.y - 8; jy += ch * 1.9) for (let jx = x + 6; jx < x + w - cw - 4; jx += cw * 2) if (r() < o.dens) {
        const c = o.cores[Math.floor(r() * o.cores.length)]; g.fillStyle = c; g.globalAlpha = o.ja; g.fillRect(Math.round(jx), Math.round(jy), cw, ch); g.globalAlpha = 1;
      }
      x += w + o.gap * r();
    }
  }
  function neon(g, x, y, w, h, cor, vert) { // placa neon: tubo com núcleo claro e brilho
    halo(g, x + w / 2, y + h / 2, Math.max(w, h) * .9, cor, .45);
    g.strokeStyle = cor; g.lineWidth = 5; g.lineCap = "round"; g.strokeRect(x, y, w, h);
    g.strokeStyle = clar(cor, .75); g.lineWidth = 1.8; g.strokeRect(x, y, w, h);
    if (vert) for (let i = 1; i < 4; i++) { g.strokeStyle = cor; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 5, y + h * i / 4); g.lineTo(x + w - 5, y + h * i / 4); g.stroke(); }
    else for (let i = 1; i < 4; i++) { g.strokeStyle = cor; g.lineWidth = 3; g.beginPath(); g.moveTo(x + w * i / 4, y + 5); g.lineTo(x + w * i / 4, y + h - 5); g.stroke(); }
  }
  function carro(k, cor) { return spr("carro" + k, 40, 14, function(g) { g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(0, 6, 14, 2); g.fillStyle = "#14102e"; rr(g, 12, 3, 26, 8, 4); g.fill(); g.fillStyle = cor; g.fillRect(34, 5, 5, 2.5); g.fillStyle = "#ffffff"; g.fillRect(36, 5.4, 3, 1.5); g.fillStyle = "rgba(255,120,200,.35)"; g.fillRect(14, 4, 18, 1.5); }); }
  CEN.cidade = {
    vin: .4,
    pre: function(g) {
      const T = S.top, B = S.bot, r = rnd(81);
      ceu(g, T, 620, [[0, "#07031f"], [.3, "#1a0a4c"], [.58, "#58187e"], [.82, "#c93a96"], [1, "#ff7a9a"]], T, B);
      estrelas(g, 120, 33, T, 330, "#f4e8ff");
      halo(g, 940, 140, 340, "#ff9ad8", .35); g.fillStyle = "#fff0f8"; C(g, 940, 140, 50); g.fill(); g.fillStyle = "rgba(220,150,220,.35)"; C(g, 925, 130, 12); g.fill(); C(g, 955, 156, 8); g.fill(); C(g, 960, 124, 6); g.fill();
      // 3 camadas de skyline com perspectiva atmosférica
      predios(g, { y: 600, hMin: 120, hMax: 250, wMin: 40, wMax: 90, gap: 10, seed: 3, c0: "#7a3a9a", c1: "#a64aa0", bot: 700, jan: 3, dens: .5, cores: ["#ffd0f0", "#ffe6a0"], ja: .5 });
      bruma(g, 400, 620, "#e04aa0", .35);
      predios(g, { y: 640, hMin: 150, hMax: 320, wMin: 50, wMax: 100, gap: 8, seed: 5, c0: "#3c1a74", c1: "#5a2490", bot: 720, jan: 4, dens: .5, cores: ["#ffd070", "#6fe8ff", "#ff6fc8"], ja: .7, antena: 1 });
      bruma(g, 480, 700, "#8a2a9a", .3);
      // torres altas no vão + placas neon
      predios(g, { x0: 280, x1: 440, y: 700, hMin: 300, hMax: 420, wMin: 70, wMax: 90, gap: 0, seed: 9, c0: "#25104f", c1: "#341668", bot: 760, jan: 5, dens: .55, cores: ["#ffd070", "#6fe8ff"], ja: .85 });
      predios(g, { x0: 840, x1: 1000, y: 700, hMin: 300, hMax: 420, wMin: 70, wMax: 90, gap: 0, seed: 12, c0: "#25104f", c1: "#341668", bot: 760, jan: 5, dens: .55, cores: ["#ffd070", "#ff6fc8"], ja: .85 });
      neon(g, 396, 330, 22, 100, "#33e0ff", true); neon(g, 868, 280, 22, 120, "#ff4fd8", true); neon(g, 300, 250, 60, 26, "#ffd23f"); neon(g, 960, 400, 56, 24, "#33e0ff");
      // vão (rua lá embaixo): névoa luminosa e linhas de luz
      g.fillStyle = lin(g, 0, 480, 0, 760, [[0, "rgba(255,70,170,0)"], [1, "rgba(255,70,170,.55)"]]); g.fillRect(420, 480, 440, 300);
      g.strokeStyle = "rgba(255,200,240,.3)"; g.lineWidth = 2; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(640 + (i - 2) * 30, 720); g.lineTo(640 + (i - 2) * 190, 520); g.stroke(); }
      // fachadas dos prédios do chão (esquerda e direita) com janelas, descendo até a base
      [[0, 420], [860, 420]].forEach(function(q, k) {
        g.fillStyle = vg(g, 560, B, "#2c1460", "#1a0a3c"); g.fillRect(q[0], 560, q[1], B - 560);
        g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(k ? 860 : 0, 560, 3, B - 560);
        const jr = rnd(90 + k); for (let y = 660; y < B; y += 24) for (let x = q[0] + 10; x < q[0] + q[1] - 12; x += 22) if (jr() < .6) { g.fillStyle = ["#ffd070", "#6fe8ff", "#ff6fc8", "#ffe9b0"][Math.floor(jr() * 4)]; g.globalAlpha = .75; g.fillRect(x, y, 10, 14); g.globalAlpha = 1; }
      });
      // adereços nos telhados (atrás da plataforma): antena, caixa-d'água, ar-condicionado
      g.fillStyle = "#1a0e3a"; g.fillRect(60, 600, 50, 40); g.fillRect(70, 586, 30, 14); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(60, 600, 3, 40);
      g.fillRect(300, 560, 4, 80); g.fillRect(286, 576, 32, 3); g.fillRect(290, 590, 24, 3); g.fillStyle = "#ff4d6a"; C(g, 302, 557, 3); g.fill();
      g.fillStyle = "#1a0e3a"; rr(g, 940, 566, 60, 50, 6); g.fill(); poli(g, [934, 568, 1006, 568, 970, 546]); g.fill(); g.fillRect(950, 616, 4, 24); g.fillRect(986, 616, 4, 24); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(940, 566, 3, 50);
      g.fillStyle = "#1a0e3a"; g.fillRect(1160, 600, 80, 40); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(1160, 600, 3, 40); g.fillStyle = "#3a2370"; for (let i = 0; i < 4; i++) g.fillRect(1170 + i * 18, 606, 10, 28);
      neon(g, 1186, 520, 40, 70, "#ff4fd8", true);
      S.cars = 0;
    },
    pad: function(p) { return p.h > 40 ? [0, 12, 0, 0] : p.move ? [12, 12, 12, 40] : [12, 12, 12, 24]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h;
      if (h > 40) { // telhado de prédio: concreto roxo, janelas e friso neon
        g.fillStyle = lin(g, 0, 0, 0, h, [[0, "#4a3590"], [.12, "#2c1a66"], [1, "#1c0f48"]]); g.fillRect(-2, 0, w + 4, h + 20);
        g.fillStyle = "#6a54b0"; g.fillRect(-2, 0, w + 4, 5); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-2, 0, w + 4, 1.5);
        const jr = rnd(i + 7); for (let x = 12; x < w - 14; x += 22) for (let y = 24; y < h; y += 24) if (jr() < .65) { g.fillStyle = ["#ffd070", "#6fe8ff", "#ff6fc8", "#ffe9b0"][Math.floor(jr() * 4)]; g.fillRect(x, y, 10, 14); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(x, y, 10, 2); }
        g.fillStyle = "#33e0ff"; g.fillRect(-2, 6, w + 4, 2.5); g.fillStyle = "rgba(51,224,255,.3)"; g.fillRect(-2, 8, w + 4, 6); g.fillStyle = "#e6fcff"; g.fillRect(-2, 6.6, w + 4, 1);
        return;
      }
      if (p.move) { // plataforma antigravidade: casco escuro, faixa neon e propulsores
        g.fillStyle = "rgba(255,70,170,.14)"; g.beginPath(); g.ellipse(w / 2, h + 34, w * .4, 6, 0, 0, TAU); g.fill();
        rr(g, 0, 0, w, h, 8); g.fillStyle = lin(g, 0, 0, 0, h, [[0, "#7a6ac8"], [.2, "#3c2a86"], [1, "#1c1050"]]); g.fill(); contorno(g, "#3c2a86", 2);
        g.fillStyle = "#33e0ff"; rr(g, 14, h - 8, w - 28, 3, 1.5); g.fill(); g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(8, 2, w - 16, 1.5);
        [28, w - 28].forEach(x => { g.fillStyle = "#2a1c68"; poli(g, [x - 10, h - 2, x + 10, h - 2, x + 6, h + 8, x - 6, h + 8]); g.fill(); halo(g, x, h + 18, 20, "#33e0ff", .8); g.fillStyle = "#e6fcff"; C(g, x, h + 9, 3); g.fill(); });
        return;
      }
      // passarela fina: grade escura com tubo neon magenta
      g.fillStyle = "rgba(255,70,170,.1)"; g.beginPath(); g.ellipse(w / 2, h + 20, w * .4, 4, 0, 0, TAU); g.fill();
      rr(g, 0, 3, w, h - 3, 4); g.fillStyle = lin(g, 0, 3, 0, h, [[0, "#6a5ac0"], [.3, "#2c1a70"], [1, "#150a3c"]]); g.fill(); contorno(g, "#3c2a86", 2);
      g.fillStyle = "rgba(20,5,50,.55)"; for (let x = 10; x < w - 8; x += 12) g.fillRect(x, 9, 4, h - 12);
      halo(g, w / 2, 3, w * .5, "#ff4fd8", .35); g.strokeStyle = "#ff4fd8"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(5, 3); g.lineTo(w - 5, 3); g.stroke(); g.strokeStyle = "#ffd6f6"; g.lineWidth = 1.4; g.stroke();
    },
    anim: function(g, p, i, est, t) { if (p.move) { const a = .5 + .3 * Math.sin(t * 20 + i); [28, p.w - 28].forEach(x => glow(g, "#33e0ff", p.x + x, p.y + p.h + 22, 28, a)); } },
    fundo: function(g, est, t) {
      // carros voadores em 3 faixas, zepelim com anúncio e janelas que piscam
      const cs = [carro(0, "#ffd8a0"), carro(1, "#ff8ac8"), carro(2, "#8ae8ff")];
      [[0, 200, 60, 1], [1, 270, 90, -1], [2, 330, 45, 1], [0, 440, 110, -1], [1, 150, 80, 1], [2, 390, 70, -1]].forEach(function(q, k) {
        const x = mod(q[2] * t * q[3] + k * 230, L + 160) - 80; g.save(); g.translate(Math.round(x), q[1]); if (q[3] < 0) g.scale(-1, 1); g.drawImage(cs[q[0]], -20, -7); g.restore();
      });
      const zp = spr("zepelim", 150, 60, function(c) { c.fillStyle = "#3a2a7a"; c.beginPath(); c.ellipse(75, 24, 66, 20, 0, 0, TAU); c.fill(); c.fillStyle = "#6a54b8"; c.beginPath(); c.ellipse(70, 19, 56, 11, 0, 0, TAU); c.fill(); c.fillStyle = "#2a1c68"; poli(c, [10, 22, 0, 8, 22, 18]); c.fill(); poli(c, [10, 28, 0, 40, 22, 30]); c.fill(); c.fillStyle = "#1a1050"; rr(c, 62, 40, 24, 9, 3); c.fill(); neon(c, 40, 14, 70, 14, "#ff4fd8"); });
      g.drawImage(zp, Math.round(mod(t * 10 + 200, L + 300) - 200), 110);
      const jr = rnd(5); for (let k = 0; k < 20; k++) { const x = 20 + jr() * 1240, y = 400 + jr() * 190; if (x > 420 && x < 860) continue; g.fillStyle = k % 3 ? "#ffd070" : "#6fe8ff"; if (Math.sin(t * 1.3 + k * 7) > -.2) g.fillRect(Math.round(x), Math.round(y), 5, 7); }
      [[300, 557, 0], [1186, 520, 1]].forEach(q => { if (Math.sin(t * 3 + q[2] * 2) > 0) glow(g, "#ff4d6a", q[0] + 1, q[1] + 2, 16, .7); });
    }
  };

  // =========================
  // 9. FLIPERAMA — dentro do gabinete de pinball: explosão de raios, anéis neon, trilhos cromados, bumpers
  // =========================
  const NEONS = ["#ff3d8b", "#33d6ff", "#ffd23f", "#7cff5b"];
  function tuboNeon(g, pts, cor, w) { // curva em tubo neon: brilho largo + tubo + núcleo claro
    g.lineCap = "round"; g.lineJoin = "round";
    [[w * 3.2, .12], [w * 1.8, .3], [w, 1]].forEach(function(q, k) { g.beginPath(); pts(g); g.lineWidth = q[0]; g.strokeStyle = k === 2 ? cor : ca(cor, q[1]); g.stroke(); });
    g.beginPath(); pts(g); g.lineWidth = w * .35; g.strokeStyle = clar(cor, .8); g.stroke();
  }
  function bumperSpr(r, cor, aceso) {
    const k = "bump" + r + cor + (aceso ? 1 : 0), s = Math.ceil(r * 2 + 24);
    return spr(k, s, s, function(g) {
      const c = s / 2; g.translate(c, c);
      g.fillStyle = "rgba(10,0,40,.35)"; C(g, 3, 5, r + 3); g.fill();
      g.fillStyle = lin(g, -r, -r, r, r, [[0, "#f4f6ff"], [.45, "#9aa4c8"], [1, "#3a3f6e"]]); C(g, 0, 0, r + 3); g.fill();
      g.strokeStyle = "#1a1040"; g.lineWidth = 2; g.stroke();
      g.fillStyle = "#1a1040"; C(g, 0, 0, r - 4); g.fill();
      g.strokeStyle = cor; g.lineWidth = 3; C(g, 0, 0, r - 8); g.stroke(); g.strokeStyle = clar(cor, .7); g.lineWidth = 1; g.stroke();
      const dom = aceso ? [clar(cor, .85), clar(cor, .35), cor] : [clar(cor, .45), cor, somb(cor, .5)];
      g.fillStyle = rad(g, 0, 0, r * .74, [[0, dom[0]], [.5, dom[1]], [1, dom[2]]], -r * .22, -r * .26, r * .05); C(g, 0, 0, r * .72); g.fill();
      g.fillStyle = aceso ? "#ffffff" : clar(somb(cor, .4), .0); faisca(g, 0, 1, r * .34, aceso ? "#ffffff" : somb(cor, .45));
      g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.ellipse(-r * .26, -r * .3, r * .2, r * .1, -.7, 0, TAU); g.fill();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.fillStyle = aceso ? "#ffffff" : cor; C(g, Math.cos(a) * (r - 1), Math.sin(a) * (r - 1), 2); g.fill(); }
    });
  }
  CEN.fliperama = {
    vin: .4,
    pre: function(g) {
      const T = S.top, B = S.bot, r = rnd(91);
      ceu(g, T, B, [[0, "#0c0524"], [.5, "#1e0b4e"], [1, "#12063a"]], T, B);
      // explosão de raios (alternados) + brilho central
      g.save(); g.translate(640, 330);
      for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; g.fillStyle = i % 2 ? "rgba(255,61,139,.09)" : "rgba(51,214,255,.07)"; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1100, a, a + TAU / 56); g.closePath(); g.fill(); }
      g.restore(); halo(g, 640, 330, 520, "#8a3aff", .45);
      // anéis neon concêntricos
      [[210, "#33d6ff", 2.5], [300, "#ff3d8b", 3], [400, "#8a5aff", 2.5]].forEach(q => tuboNeon(g, gg => { gg.arc(640, 330, q[0], 0, TAU); }, q[1], q[2]));
      // trilhos curvos (órbitas) nas laterais
      tuboNeon(g, gg => { gg.moveTo(60, 700); gg.bezierCurveTo(10, 400, 60, 150, 330, 90); gg.lineTo(950, 90); gg.bezierCurveTo(1220, 150, 1270, 400, 1220, 700); }, "#ffd23f", 3);
      tuboNeon(g, gg => { gg.moveTo(120, 700); gg.bezierCurveTo(90, 440, 130, 240, 330, 170); gg.lineTo(950, 170); gg.bezierCurveTo(1150, 240, 1190, 440, 1160, 700); }, "#7cff5b", 2);
      // pontos (grade de lâmpadas) e setas de luz
      g.fillStyle = "rgba(160,120,255,.22)"; for (let x = 20; x < L; x += 40) for (let y = T + 10; y < B; y += 40) { g.fillRect(x, y, 3, 3); }
      [[640, 470, 0], [520, 520, 1], [760, 520, 1]].forEach(function(q) { for (let i = 0; i < 3; i++) { g.save(); g.translate(q[0], q[1] + i * 18 * -1); g.strokeStyle = NEONS[(i + q[2]) % 4]; g.globalAlpha = .55; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(-22, 8); g.lineTo(0, -4); g.lineTo(22, 8); g.stroke(); g.restore(); } });
      // estrelas de rollover
      [[160, 380], [1120, 380], [640, 120], [220, 200], [1060, 200]].forEach(function(q, k) { halo(g, q[0], q[1], 40, NEONS[k % 4], .5); faisca(g, q[0], q[1], 26, NEONS[k % 4]); faisca(g, q[0], q[1], 13, "#ffffff"); });
      // moldura superior com bulbos e paredes cromadas laterais
      g.fillStyle = vg(g, T, 54, "#1a0c44", "#0c0524"); g.fillRect(0, T, L, 54 - T); g.fillStyle = "#6a5ac8"; g.fillRect(0, 52, L, 3);
      for (let x = 20; x < L; x += 40) { g.fillStyle = "#3a2a80"; C(g, x, 32, 7); g.fill(); g.fillStyle = "#5a4aa8"; C(g, x - 1, 31, 4); g.fill(); }
      [[0, 1], [L - 28, -1]].forEach(function(q) { g.fillStyle = lin(g, q[0], 0, q[0] + 28, 0, q[1] > 0 ? [[0, "#3a3f6e"], [.4, "#dfe6ff"], [.6, "#9aa4c8"], [1, "#2a2e5a"]] : [[0, "#2a2e5a"], [.4, "#9aa4c8"], [.6, "#dfe6ff"], [1, "#3a3f6e"]]); g.fillRect(q[0], T, 28, B - T); for (let y = T + 20; y < B; y += 56) rebite(g, q[0] + 14, y, 4, "#aab4d8"); });
    },
    pad: function(p) { return p.h > 40 ? [0, 12, 0, 0] : [12, 12, 12, 16]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h;
      if (h > 40) { // base do tabuleiro: cromo no topo, tubo neon, lâmpadas e xadrez
        g.fillStyle = lin(g, 0, 0, 0, h + 20, [[0, "#2a1a70"], [.3, "#1a0e50"], [1, "#0e0630"]]); g.fillRect(-4, 0, w + 8, h + 20);
        g.fillStyle = lin(g, 0, 0, 0, 9, [[0, "#f0f4ff"], [.4, "#aab4d8"], [1, "#4a4f86"]]); g.fillRect(-4, 0, w + 8, 9);
        g.fillStyle = "#33d6ff"; g.fillRect(-4, 12, w + 8, 3); g.fillStyle = "rgba(51,214,255,.3)"; g.fillRect(-4, 15, w + 8, 7); g.fillStyle = "#e6fcff"; g.fillRect(-4, 12.6, w + 8, 1);
        for (let x = 30; x < w; x += 60) { const cc = NEONS[Math.round(x / 60) % 4]; halo(g, x, 38, 16, cc, .5); g.fillStyle = "#1a1040"; C(g, x, 38, 8); g.fill(); g.fillStyle = cc; C(g, x, 38, 6); g.fill(); g.fillStyle = "rgba(255,255,255,.7)"; C(g, x - 2, 36, 2); g.fill(); }
        for (let x = 0; x < w; x += 20) { g.fillStyle = (x / 20) % 2 ? "#e6e8ff" : "#2a1a70"; g.fillRect(x, h - 8, 20, 8); }
        return;
      }
      // trilho: barra cromada com bulbos nas pontas e tubo neon em cima
      g.fillStyle = "rgba(10,0,40,.3)"; g.beginPath(); g.ellipse(w / 2, h + 8, w * .45, 4, 0, 0, TAU); g.fill();
      rr(g, 0, 0, w, h, 6); g.fillStyle = lin(g, 0, 0, 0, h, [[0, "#f4f6ff"], [.3, "#aab4d8"], [.7, "#4a4f86"], [1, "#2a2e5a"]]); g.fill(); contorno(g, "#4a4f86", 2);
      g.fillStyle = "#1a1040"; rr(g, 16, 5, w - 32, 6, 3); g.fill();
      for (let x = 22; x < w - 20; x += 18) { const cc = NEONS[Math.round(x / 18 + i) % 4]; g.fillStyle = cc; rr(g, x, 6, 10, 4, 2); g.fill(); }
      [8, w - 8].forEach((x, k) => { halo(g, x, h / 2, 14, NEONS[(i + k) % 4], .7); g.fillStyle = NEONS[(i + k) % 4]; C(g, x, h / 2, 4); g.fill(); g.fillStyle = "#fff"; C(g, x - 1, h / 2 - 1, 1.5); g.fill(); });
    },
    extra: function(g, est, t) { // bumpers (brilham quando batem)
      const bs = est.bumpers; if (!bs) return;
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i], cor = NEONS[i % 4], f = b.flash || 0, base = bumperSpr(b.r, cor, false), s = base.width, x = Math.round(b.x - s / 2), y = Math.round(b.y - s / 2);
        if (f > .02) glow(g, cor, b.x, b.y, b.r * 4.4, Math.min(1, f * .9));       // clarão atrás
        g.drawImage(base, x, y);
        if (f > .02) { g.globalAlpha = Math.min(1, f * 1.3); g.drawImage(bumperSpr(b.r, cor, true), x, y); g.globalAlpha = 1; const a = f * 24; g.strokeStyle = "rgba(255,255,255," + (f * .8).toFixed(2) + ")"; g.lineWidth = 3 * f + .5; g.beginPath(); g.arc(b.x, b.y, b.r + 6 + (1 - f) * a, 0, TAU); g.stroke(); }
      }
    },
    fundo: function(g, est, t) { // lâmpadas da moldura em "perseguição", estrelas de rollover piscando e raios girando
      const lamp = spr("lampF", 20, 20, c => { c.fillStyle = rad(c, 10, 10, 10, [[0, "#ffffff"], [.3, "#ffe38a"], [1, "rgba(255,160,40,0)"]]); c.fillRect(0, 0, 20, 20); });
      for (let x = 20, k = 0; x < L; x += 40, k++) { const on = ((k + Math.floor(t * 8)) % 4) === 0; if (on) g.drawImage(lamp, x - 10, 22); }
      [[160, 380], [1120, 380], [640, 120], [220, 200], [1060, 200]].forEach(function(q, k) { glow(g, NEONS[k % 4], q[0], q[1], 72, .35 + .5 * Math.max(0, Math.sin(t * 3 + k * 1.3))); });
    }
  };

  // =========================
  // 10. FLORESTA — noite encantada: troncos em camadas, cogumelos luminosos, vagalumes, escuridão com luz nas bolinhas
  // =========================
  function tronco(g, x, y0, y1, w, c0, c1, seed) { // tronco com luz à esquerda e raízes
    const r = rnd(seed); g.beginPath(); g.moveTo(x - w / 2 - w * .5, y1); g.quadraticCurveTo(x - w / 2, y1 - 30, x - w / 2 + r() * 3, y1 - 80);
    g.lineTo(x - w * .42, y0); g.lineTo(x + w * .42, y0); g.lineTo(x + w / 2, y1 - 80); g.quadraticCurveTo(x + w / 2, y1 - 30, x + w / 2 + w * .5, y1); g.closePath();
    g.fillStyle = c1; g.fill();
    g.fillStyle = c0; g.fillRect(x - w * .4, y0, w * .22, y1 - y0 - 90);                                    // faixa de luz à esquerda
    g.fillStyle = ca(somb(c1, .55), .45); g.fillRect(x + w * .14, y0, w * .3, y1 - y0 - 90);                 // sombra à direita
    if (w > 40) { g.strokeStyle = ca(somb(c1, .5), .35); g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const px = x - w * .2 + r() * w * .4; g.beginPath(); g.moveTo(px, y0); g.lineTo(px + (r() - .5) * 6, y1 - 90); g.stroke(); } }
  }
  function cogu(g, x, y, s, cor, cor2) { // cogumelo luminoso
    halo(g, x, y - s * .7, s * 2.2, cor, .4);
    g.fillStyle = "#d6e8e0"; rr(g, x - s * .13, y - s * .7, s * .26, s * .72, s * .1); g.fill();
    g.fillStyle = lin(g, x - s, y - s, x + s, y, [[0, clar(cor, .45)], [.5, cor], [1, somb(cor, .45)]]); g.beginPath(); g.moveTo(x - s * .7, y - s * .62); g.quadraticCurveTo(x - s * .65, y - s * 1.35, x, y - s * 1.4); g.quadraticCurveTo(x + s * .65, y - s * 1.35, x + s * .7, y - s * .62); g.quadraticCurveTo(x, y - s * .45, x - s * .7, y - s * .62); g.fill();
    g.fillStyle = cor2; [[-.25, -1.05], [.2, -1.15], [.35, -.85]].forEach(q => { C(g, x + q[0] * s, y + q[1] * s, s * .08); g.fill(); });
  }
  function samambaia(g, x, y, s, c) { g.strokeStyle = c; g.lineWidth = 1.6; g.lineCap = "round"; for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * .32; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * s * .6, y + Math.sin(a) * s * .8, x + Math.cos(a) * s + i * 3, y + Math.sin(a) * s * .75 + Math.abs(i) * 4); g.stroke(); } }
  function folhagem(g, x, y, r, c0, c1) { copa(g, x, y, r, c0, c1, somb(c1, .5)); }
  CEN.floresta = {
    vin: .4,
    pre: function(g) {
      const T = S.top, B = S.bot, r = rnd(101);
      ceu(g, T, B, [[0, "#04101c"], [.45, "#0b2c3a"], [.85, "#11463f"], [1, "#0a2a2c"]], T, B);
      halo(g, 360, 90, 420, "#9ad8ff", .35); g.fillStyle = "#e8f6ff"; C(g, 360, 90, 34); g.fill(); g.fillStyle = "rgba(150,190,220,.4)"; C(g, 350, 84, 9); g.fill(); C(g, 372, 100, 6); g.fill();
      estrelas(g, 60, 8, T, 200, "#dff0ff");
      // camada 1: árvores distantes azuladas (neblina)
      for (let x = -20; x < L + 30; x += 46 + r() * 30) { const w = 18 + r() * 14; tronco(g, x, T - 10, 620, w, "#2a6a78", "#1d5360", 100 + x); }
      for (let i = 0; i < 16; i++) folhagem(g, r() * L, T + 40 + r() * 140, 60 + r() * 60, "#2f7a82", "#1d5560");
      raios(g, 360, 90, 1.1, 2.0, 7, 780, "#bfe8ff", .13, 5); bruma(g, 240, 620, "#3a8a90", .35);
      // camada 2: troncos médios + folhagem + samambaias
      for (let x = 30; x < L; x += 110 + r() * 80) { const w = 26 + r() * 20; tronco(g, x, T - 10, 640, w, "#1a4a58", "#0f3340", 200 + x); }
      for (let i = 0; i < 14; i++) folhagem(g, r() * L, T + 20 + r() * 80, 70 + r() * 70, "#1f5e66", "#0f3840");
      bruma(g, 420, 640, "#2a7a7a", .3);
      // camada 3: moitas e cogumelos luminosos
      const h3 = cume(g, { y: 636, amp: 14, esc: 120, seed: 4, c0: "#0f3a3c", c1: "#082428", bot: 700, rim: "rgba(100,230,200,.35)" });
      for (let x = 20; x < L; x += 70 + r() * 70) { samambaia(g, x, h3(x) + 14, 36 + r() * 24, "#1d6a5a"); }
      [[130, 22, "#4dd0e8", "#e8ffff"], [380, 16, "#ff7ad0", "#ffe0f6"], [860, 20, "#4dd0e8", "#e8ffff"], [1100, 24, "#ff7ad0", "#ffe0f6"], [620, 14, "#9aff9a", "#f0fff0"]].forEach(q => cogu(g, q[0], h3(q[0]) + 18, q[1], q[2], q[3]));
      // troncos gigantes nas bordas, com cipós
      tronco(g, 28, T - 10, 720, 90, "#1a4a50", "#0c2c34", 7); tronco(g, 1256, T - 10, 720, 90, "#1a4a50", "#0c2c34", 8);
      g.strokeStyle = "#1f6a4a"; g.lineWidth = 3; g.lineCap = "round"; [[90, 0, 60, 190], [1190, 0, 50, 230], [180, 0, 24, 140], [1100, 0, 30, 150]].forEach(q => { g.beginPath(); g.moveTo(q[0], T); g.bezierCurveTo(q[0] + 14, q[3] * .4, q[0] - 14, q[3] * .8, q[0] + q[1], q[3]); g.stroke(); for (let k = 1; k < 5; k++) { g.fillStyle = "#2f8a58"; g.beginPath(); g.ellipse(q[0] + (k % 2 ? 4 : -4), q[3] * k / 5, 5, 2.5, .6, 0, TAU); g.fill(); } });
      // topo: copa escura em cima
      for (let i = 0; i < 14; i++) folhagem(g, i * 100 + r() * 60, T + r() * 30 - 14, 60 + r() * 30, "#1d5d5d", "#0d3238");
      if (B > A) { g.fillStyle = vg(g, A, B, "#0a2a2c", "#051a1e"); g.fillRect(0, A - 1, L, B - A + 1); }
    },
    pad: function(p) { return p.h > 40 ? [0, 12, 0, 0] : [20, 14, 20, 30]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h, r = rnd(110 + i);
      if (h > 40) { // chão de musgo e raízes
        g.fillStyle = lin(g, 0, 0, 0, h + 20, [[0, "#2c6a48"], [.2, "#1a4a3a"], [.6, "#10302c"], [1, "#0a2220"]]); g.fillRect(-4, 0, w + 8, h + 20);
        for (let k = 0; k < 34; k++) { g.fillStyle = r() < .5 ? "rgba(120,230,170,.08)" : "rgba(0,10,20,.2)"; g.beginPath(); g.ellipse(r() * w, 10 + r() * (h - 8), 8 + r() * 24, 2 + r() * 4, 0, 0, TAU); g.fill(); }
        g.strokeStyle = "#3a2a2e"; g.lineWidth = 3; g.lineCap = "round"; for (let k = 0; k < 8; k++) { const x = r() * w; g.beginPath(); g.moveTo(x, 6); g.bezierCurveTo(x + 16, 20, x - 12, 34, x + 6, 52); g.stroke(); }
        grama(g, -4, 0, w + 8, "#7fe8a0", "#3f9a64", "#1d5a46", 6, 18);
        g.fillStyle = "rgba(160,255,220,.5)"; for (let k = 0; k < 22; k++) { C(g, r() * w, 3 + r() * 12, 1 + r()); g.fill(); }
        return;
      }
      // galho grosso com casca, musgo e folhas
      g.fillStyle = "rgba(0,10,20,.2)"; g.beginPath(); g.ellipse(w / 2, h + 20, w * .42, 4, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(0, h * .45); g.quadraticCurveTo(0, 2, 14, 2); g.lineTo(w - 22, 2); g.quadraticCurveTo(w, 2, w + 8, h * .3); g.quadraticCurveTo(w - 6, h + 2, w - 24, h); g.lineTo(18, h + 2); g.quadraticCurveTo(-4, h + 2, 0, h * .45); g.closePath();
      g.fillStyle = lin(g, 0, 0, 0, h, [[0, "#8a6a4a"], [.35, "#5e4234"], [1, "#2e2024"]]); g.fill();
      g.save(); g.clip(); g.strokeStyle = "rgba(20,8,16,.45)"; g.lineWidth = 1.3; for (let k = 0; k < Math.round(w / 14); k++) { const x = r() * w; g.beginPath(); g.moveTo(x, 3); g.lineTo(x + 3 + r() * 6, h); g.stroke(); }
      g.fillStyle = "rgba(255,230,200,.2)"; g.fillRect(0, 2, w, 2.5); g.restore();
      g.strokeStyle = "#2e2024"; g.lineWidth = 2; g.stroke();
      grama(g, 4, 1, w - 10, "#7fe8a0", "#3f9a64", "#1d6a50", 50 + i, 10);
      for (let k = 0; k < 5; k++) { const x = 18 + r() * (w - 36); g.fillStyle = "#2f8a58"; g.beginPath(); g.ellipse(x, h + 6 + r() * 6, 7, 3.2, (r() - .5) * 2, 0, TAU); g.fill(); }
      cogu(g, 22 + r() * (w - 44), 4, 8, i % 2 ? "#4dd0e8" : "#ff7ad0", "#fff");
    },
    fundo: function(g, est, t) {
      const f = spr("vaga", 22, 22, c => { c.fillStyle = rad(c, 11, 11, 11, [[0, "rgba(255,255,200,1)"], [.2, "rgba(220,255,120,.8)"], [1, "rgba(160,255,80,0)"]]); c.fillRect(0, 0, 22, 22); });
      for (let k = 0; k < 26; k++) {
        const x = 40 + ((k * 211) % 1200) + Math.sin(t * .7 + k * 1.7) * 40, y = 160 + ((k * 97) % 480) + Math.sin(t * .9 + k * 2.3) * 24;
        g.globalAlpha = .35 + .65 * Math.max(0, Math.sin(t * 1.8 + k * 2.9)); g.drawImage(f, Math.round(x - 11), Math.round(y - 11));
      }
      [[130, 600], [380, 604], [860, 600], [1100, 598]].forEach((q, k) => glow(g, k % 2 ? "#ff7ad0" : "#4dd0e8", q[0], q[1] - 10, 80, .6 + .3 * Math.sin(t * 1.5)));
    },
    frente: function(g, est, t) {
      // Escuridão com buracos de luz, sem escala e sem gradiente grande:
      //  - fora das luzes: retângulos chapados;  - luz isolada: sprite "escuro com buraco" (1 cópia);
      //  - luzes que se sobrepõem: máscara em tamanho real, furada com sprites (destination-out), só na área delas.
      const H = est.altura, dy = est.deslocY, DK = "rgba(4,12,26,.68)", ls = est.luzes || [], n = Math.min(ls.length, 20), bx = [];
      for (let i = 0; i < n; i++) { const l = ls[i], d = Math.round(l.r * 2 / 4) * 4; bx.push({ x0: Math.round(l.x - d / 2), y0: Math.round(l.y - d / 2), x1: Math.round(l.x + d / 2), y1: Math.round(l.y + d / 2), d: d, c: -1 }); }
      // componentes conexos (caixas que se tocam)
      let nc = 0; for (let i = 0; i < n; i++) { if (bx[i].c < 0) { bx[i].c = nc++; } for (let k = i + 1; k < n; k++) if (bx[i].x0 < bx[k].x1 && bx[k].x0 < bx[i].x1 && bx[i].y0 < bx[k].y1 && bx[k].y0 < bx[i].y1) { const o = bx[k].c, c = bx[i].c; if (o < 0) bx[k].c = c; else if (o !== c) for (let m = 0; m < n; m++) if (bx[m].c === o) bx[m].c = c; } }
      const top = -dy, bot = H - dy;
      function faixas(lista, gaps) { // retângulos sem sobreposição que cobrem a união das caixas (e, se pedido, os vazios entre elas)
        const ys = [top, bot]; lista.forEach(b => { if (b.y0 > top && b.y0 < bot) ys.push(b.y0); if (b.y1 > top && b.y1 < bot) ys.push(b.y1); }); ys.sort((a, b) => a - b);
        const cov = [], gap = [];
        for (let k = 0; k < ys.length - 1; k++) {
          const y0 = ys[k], y1 = ys[k + 1]; if (y1 - y0 < .5) continue; const mid = (y0 + y1) / 2, iv = [];
          lista.forEach(b => { if (b.y0 <= mid && b.y1 >= mid) iv.push([Math.max(0, b.x0), Math.min(L, b.x1)]); }); iv.sort((a, b) => a[0] - b[0]);
          let x = 0; const mg = []; iv.forEach(v => { if (v[1] <= v[0]) return; const l = mg[mg.length - 1]; if (l && v[0] <= l[1]) l[1] = Math.max(l[1], v[1]); else mg.push([v[0], v[1]]); });
          mg.forEach(v => { if (v[0] > x) gap.push([x, y0, v[0] - x, y1 - y0]); cov.push([v[0], y0, v[1] - v[0], y1 - y0]); x = v[1]; });
          if (x < L) gap.push([x, y0, L - x, y1 - y0]);
        }
        return gap.length || gaps ? { cov: cov, gap: gap } : { cov: cov, gap: gap };
      }
      const mk = d => spr("luzNeg" + d, d, d, c => { c.fillStyle = rad(c, d / 2, d / 2, d / 2, [[0, "rgba(4,12,26,0)"], [.55, "rgba(4,12,26,.04)"], [.82, "rgba(4,12,26,.38)"], [1, "rgba(4,12,26,.68)"]]); c.fillRect(0, 0, d, d); });
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
      function mk2(d) { return spr("luzFuro" + d, d, d, c => { c.fillStyle = rad(c, d / 2, d / 2, d / 2, [[0, "rgba(0,0,0,1)"], [.55, "rgba(0,0,0,.94)"], [.82, "rgba(0,0,0,.44)"], [1, "rgba(0,0,0,0)"]]); c.fillRect(0, 0, d, d); }); }
      for (let i = 0; i < Math.min(n, 2); i++) { const d = Math.round(ls[i].r * 1.3 / 4) * 4, q = spr("calor" + d, d, d, c => { c.globalAlpha = .12; c.drawImage(glowSpr("#ffe39a", d), 0, 0); }); g.drawImage(q, Math.round(ls[i].x - d / 2), Math.round(ls[i].y - d / 2)); }   // calor suave da luz
      // musgo luminoso na borda de cima de cada plataforma (por cima do escuro): o caminho fica legível no mapa todo
      // (uma faixa pronta por largura: desenhada sem escala)
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

  // =========================
  // 11. DESERTO — dunas com luz e sombra, pirâmides, mesas de arenito, vento de areia
  // =========================
  function duna(g, o) { // duna com face iluminada e face de sombra (degraus translúcidos)
    const h = cume(g, o);
    g.fillStyle = ca(o.sh, o.shA || .18);
    for (let x = -10; x <= L + 10; x += 5) {
      if (h(x + 6) <= h(x - 2)) continue;         // só as encostas que descem para a direita ficam na sombra
      const y = h(x); g.fillRect(x, y + 2, 5, 14); g.globalAlpha = .6; g.fillRect(x, y + 14, 5, 26); g.globalAlpha = .35; g.fillRect(x, y + 38, 5, 40); g.globalAlpha = 1;
    }
    return h;
  }
  function cacto(g, x, y, s, c0, c1) {
    g.fillStyle = c1; rr(g, x - 6 * s, y - 70 * s, 12 * s, 72 * s, 6 * s); g.fill();
    g.fillStyle = c0; rr(g, x - 6 * s, y - 70 * s, 6 * s, 72 * s, 3 * s); g.fill();
    [[-1, 34, 20], [1, 44, 16]].forEach(q => { const bx = x + q[0] * 15 * s, by = y - q[1] * s; g.fillStyle = c1; rr(g, Math.min(x, bx) - 5 * s, by - 2 * s, Math.abs(bx - x) + 10 * s, 9 * s, 4 * s); g.fill(); rr(g, bx - 5 * s, by - q[2] * s, 10 * s, q[2] * s + 7 * s, 5 * s); g.fill(); g.fillStyle = c0; rr(g, bx - 5 * s, by - q[2] * s, 5 * s, q[2] * s + 7 * s, 2.5 * s); g.fill(); });
  }
  function arenito(g, x, y, w, h, seed) { // camadas de arenito
    const cs = ["#e0a468", "#cf8a52", "#e9b078", "#c27a48"], r = rnd(seed); let yy = y;
    for (let i = 0; yy < y + h; i++) { const hh = Math.min(10 + r() * 14, y + h - yy); g.fillStyle = cs[i % 4]; g.fillRect(x, yy, w, hh); yy += hh; }
  }
  CEN.deserto = {
    vin: .3,
    pre: function(g) {
      const T = S.top, B = S.bot, r = rnd(121);
      ceu(g, T, 620, [[0, "#2e86d4"], [.35, "#6fbfe8"], [.7, "#fbe2a6"], [1, "#ffcf86"]], T, B);
      halo(g, 250, 140, 600, "#fff0b0", .8); raios(g, 250, 140, .1, 1.5, 8, 1000, "#fff5c8", .08, 4);
      g.fillStyle = "#fffce8"; C(g, 250, 140, 48); g.fill(); g.fillStyle = "#fff4b8"; C(g, 250, 140, 36); g.fill();
      for (let i = 0; i < 4; i++) { g.globalAlpha = .4; nuvem(g, 380 + i * 250 + r() * 80, 180 + r() * 90, 160 + r() * 80, "#fff8e8", "#ffe6c0", "#f2c890"); } g.globalAlpha = 1;
      // pirâmides distantes
      [[960, 540, 190], [1110, 548, 120]].forEach(function(q) { const x = q[0], y = q[1], s = q[2]; g.fillStyle = "#e8c090"; poli(g, [x - s, y, x, y - s * .75, x + s * .1, y]); g.fill(); g.fillStyle = "#c48a64"; poli(g, [x, y - s * .75, x + s, y, x + s * .1, y]); g.fill(); });
      bruma(g, 420, 560, "#ffe2b0", .5);
      // mesas de rocha e arco de pedra
      [[240, 530, 130, 90], [420, 536, 80, 56]].forEach(function(q) { g.fillStyle = "#d98a5c"; poli(g, [q[0] - q[2] / 2 - 14, q[1], q[0] - q[2] / 2, q[1] - q[3], q[0] + q[2] / 2, q[1] - q[3], q[0] + q[2] / 2 + 14, q[1]]); g.fill(); g.fillStyle = "#b4684a"; poli(g, [q[0] + q[2] * .15, q[1] - q[3], q[0] + q[2] / 2, q[1] - q[3], q[0] + q[2] / 2 + 14, q[1], q[0] + q[2] * .2, q[1]]); g.fill(); g.fillStyle = "#f0b080"; g.fillRect(q[0] - q[2] / 2, q[1] - q[3], q[2], 5); });
      duna(g, { y: 566, amp: 26, esc: 280, seed: 12, c0: "#f4cd88", c1: "#e8b070", bot: 680, sh: "#c47a50", shA: .22, rim: "rgba(255,246,200,.8)" });
      bruma(g, 500, 600, "#ffdca8", .35);
      // ruínas: colunas quebradas
      [[560, 70], [610, 44], [700, 60]].forEach(function(q) { const x = q[0], h = q[1], y = 604; g.fillStyle = "#d89a62"; g.fillRect(x - 9, y - h, 18, h); g.fillStyle = "#b4684a"; g.fillRect(x + 1, y - h, 8, h); g.fillStyle = "#f0c088"; g.fillRect(x - 9, y - h, 5, h); g.fillStyle = "#e9b078"; g.fillRect(x - 12, y - h - 5, 24, 6); poli(g, [x - 9, y - h - 5, x - 3, y - h - 12, x + 9, y - h - 5]); g.fill(); });
      const h2 = duna(g, { y: 614, amp: 22, esc: 220, seed: 5, c0: "#eebb78", c1: "#d9985c", bot: 700, sh: "#b0663f", shA: .26, rim: "rgba(255,240,190,.9)" });
      [[80, 1], [1160, 1.1], [330, .8], [1020, .75]].forEach(q => cacto(g, q[0], h2(q[0]) + 10, q[1], "#6fb86a", "#3f8a52"));
      // pedras e marcas de vento nas dunas da frente
      g.strokeStyle = "rgba(160,90,50,.25)"; g.lineWidth = 1.4; for (let i = 0; i < 26; i++) { const x = r() * L, y = 630 + r() * 26; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 18, y - 3, x + 40, y); g.stroke(); }
      if (B > A) { g.fillStyle = vg(g, A, B, "#c8864c", "#a8683c"); g.fillRect(0, A - 1, L, B - A + 1); }
    },
    pad: function(p) { return p.w > 1000 ? [0, 12, 0, 0] : p.w < 100 ? [12, 22, 12, 0] : [12, 12, 12, 34]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h, r = rnd(130 + i);
      if (w > 1000) { // chão de areia com ondulações
        g.fillStyle = lin(g, 0, 0, 0, h + 20, [[0, "#f6d896"], [.2, "#e8b872"], [.6, "#cf9458"], [1, "#b87c48"]]); g.fillRect(-4, 0, w + 8, h + 20);
        g.strokeStyle = "rgba(170,100,50,.28)"; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); for (let x = -4; x <= w + 4; x += 20) g.lineTo(x, 22 + k * 11 + Math.sin(x / 40 + k * 2) * 4); g.stroke(); }
        seixos(g, 0, 18, w, h - 14, 26, 3, "#d6a066");
        g.fillStyle = lin(g, 0, 0, 0, 10, [[0, "#fff0c0"], [1, "#f6d896"]]); g.beginPath(); g.moveTo(-4, 8); for (let x = -4; x <= w + 4; x += 10) g.lineTo(x, 2 + Math.sin(x / 33) * 2.2 + (x % 20 ? 0 : 1)); g.lineTo(w + 4, 8); g.closePath(); g.fill();
        return;
      }
      if (p.w < 100) { // pilar de arenito: blocos, friso de glifos e capitel
        g.fillStyle = "rgba(120,60,30,.16)"; g.beginPath(); g.ellipse(w / 2, h + 3, w * .7, 4, 0, 0, TAU); g.fill();
        g.save(); rr(g, 0, 8, w, h - 8, 3); g.clip(); arenito(g, 0, 8, w, h - 8, 4);
        g.fillStyle = lin(g, 0, 0, w, 0, [[0, "rgba(255,240,200,.35)"], [.4, "rgba(255,240,200,0)"], [.7, "rgba(90,40,30,0)"], [1, "rgba(90,40,30,.35)"]]); g.fillRect(0, 8, w, h);
        g.fillStyle = "rgba(90,40,30,.5)"; for (let k = 0; k < 4; k++) { g.fillRect(8 + k * 12, 32, 6, 2.5); g.fillRect(10 + k * 12, 40, 3, 8); g.fillRect(8 + k * 12, 56, 8, 2.5); }
        g.fillStyle = "rgba(90,40,30,.3)"; for (let y = 20; y < h; y += 26) g.fillRect(0, y, w, 1.5);
        g.restore(); rr(g, 0, 8, w, h - 8, 3); contorno(g, "#cf8a52", 2);
        g.fillStyle = "#f0c088"; rr(g, -8, 0, w + 16, 12, 3); g.fill(); g.fillStyle = "#cf8a52"; g.fillRect(-8, 8, w + 16, 4); rr(g, -8, 0, w + 16, 12, 3); contorno(g, "#cf8a52", 2); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(-6, 1, w + 12, 2);
        return;
      }
      // laje de arenito flutuante com topo de areia
      g.fillStyle = "rgba(120,60,30,.14)"; g.beginPath(); g.ellipse(w / 2, h + 30, w * .4, 5, 0, 0, TAU); g.fill();
      ilha(g, 0, 0, w, h, 22, { c: "#d49a62", seed: 70 + i, rach: 0, pot: 1.3, extra: function(g) { arenito(g, -2, 4, w + 4, h + 30, 8 + i); g.fillStyle = "rgba(255,240,200,.18)"; g.fillRect(0, 0, 3, h + 30); g.fillStyle = lin(g, 0, h * .4, 0, h + 24, [[0, "rgba(100,40,30,0)"], [1, "rgba(100,40,30,.38)"]]); g.fillRect(0, h * .4, w, h + 30); } });
      g.fillStyle = lin(g, 0, -3, 0, 8, [[0, "#fff0c0"], [1, "#f2cc88"]]); g.beginPath(); g.moveTo(0, 8); g.lineTo(0, 3); for (let x = 0; x <= w; x += 8) g.lineTo(x, 0 + Math.sin(x / 20 + i) * 1.6); g.lineTo(w, 3); g.lineTo(w, 8); g.closePath(); g.fill();
      g.fillStyle = "rgba(90,40,30,.5)"; for (let k = 0; k < Math.round(w / 30); k++) { g.fillRect(14 + k * 28, 13, 5, 2.5); g.fillRect(16 + k * 28, 17, 2.5, 4); }
    },
    fundo: function(g, est, t) {
      const nu = spr("dnv0", 240, 80, c => { c.globalAlpha = .45; nuvem(c, 120, 44, 200, "#fff8e8", "#ffe6c0", "#f2c890"); });
      [[60, 120, 6], [500, 80, 4], [820, 210, 5]].forEach(q => g.drawImage(nu, Math.round(mod(q[0] + t * q[2], L + 300) - 240), q[1]));
      const ab = [spr("ab0", 36, 14, c => { c.strokeStyle = "#5a3a30"; c.lineWidth = 2.4; c.lineCap = "round"; c.beginPath(); c.moveTo(1, 4); c.quadraticCurveTo(10, 12, 18, 7); c.quadraticCurveTo(26, 12, 35, 4); c.stroke(); }), spr("ab1", 36, 14, c => { c.strokeStyle = "#5a3a30"; c.lineWidth = 2.4; c.lineCap = "round"; c.beginPath(); c.moveTo(1, 8); c.quadraticCurveTo(10, 2, 18, 6); c.quadraticCurveTo(26, 2, 35, 8); c.stroke(); })];
      for (let k = 0; k < 3; k++) { const a = t * .3 + k * 2.1; g.drawImage(ab[Math.floor(t * 1.2 + k) % 2], Math.round(520 + Math.cos(a) * 160 + k * 90), Math.round(150 + Math.sin(a * 1.3) * 30 + k * 28)); }
    },
    frente: function(g, est, t) { // linhas de areia correndo no sentido do vento + poeira rasteira
      const v = est.vento || 0, av = Math.abs(v); if (av < .02) return;
      const fs = [48, 80, 112].map(w => spr("faixaAreia" + w, w, 4, c => { c.fillStyle = lin(c, 0, 0, w, 0, [[0, "rgba(255,232,176,0)"], [.5, "rgba(255,232,176,.8)"], [1, "rgba(255,232,176,0)"]]); c.fillRect(0, 1, w, 2); }));
      const dir = v > 0 ? 1 : -1, nn = 10 + Math.round(av * 22);
      for (let k = 0; k < nn; k++) { const sp = 380 + (k % 5) * 90, x = mod(k * 173 + dir * t * sp * av, L + 160) - 80, y = ((k * 89) % 560) + 60 + Math.sin(t * 2 + k) * 6; g.drawImage(fs[k % 3], Math.round(x), Math.round(y)); }
      const pa = spr("poeira", L, 150, c => { c.fillStyle = vg(c, 0, 150, "rgba(235,190,120,0)", "rgba(235,190,120,.22)"); c.fillRect(0, 0, L, 150); });
      g.globalAlpha = Math.min(1, av * 1.6); g.drawImage(pa, 0, Math.round(est.altura - est.deslocY - 150)); g.globalAlpha = 1;
    }
  };

  // =========================
  // 12. FÁBRICA — sala de máquinas: engrenagens, janela com chaminés ao pôr do sol, esteiras animadas
  // =========================
  // engrenagem com dentes, miolo e 6 furos (simetria de 60 graus: dá para pré-renderizar 1/6 de volta e repetir)
  function engrenagem(g, x, y, R, dentes, cor, ang) {
    g.save(); g.translate(x, y); g.rotate(ang || 0);
    g.beginPath(); for (let i = 0; i < dentes; i++) { const a = i / dentes * TAU, w = TAU / dentes * .3; [[a - w * 1.1, R * .84], [a - w * .7, R], [a + w * .7, R], [a + w * 1.1, R * .84]].forEach((q, k) => g[i + k ? "lineTo" : "moveTo"](Math.cos(q[0]) * q[1], Math.sin(q[0]) * q[1])); } g.closePath();
    g.fillStyle = lin(g, -R, -R, R, R, [[0, clar(cor, .22)], [.5, cor], [1, somb(cor, .5)]]); g.fill(); contorno(g, cor, 2);
    g.fillStyle = somb(cor, .45); C(g, 0, 0, R * .62); g.fill(); g.fillStyle = lin(g, -R, -R, R, R, [[0, clar(cor, .1)], [1, somb(cor, .3)]]); C(g, 0, 0, R * .56); g.fill();
    g.fillStyle = somb(cor, .6); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; C(g, Math.cos(a) * R * .36, Math.sin(a) * R * .36, R * .09); g.fill(); }
    g.fillStyle = clar(cor, .25); C(g, 0, 0, R * .17); g.fill(); g.fillStyle = somb(cor, .6); C(g, 0, 0, R * .07); g.fill();
    g.restore();
  }
  // quadros de rotação de uma engrenagem animada (1/6 de volta, 14 quadros) — por quadro só um drawImage
  function engQuadros(k, R, dentes, cor) {
    return S.sp["eq" + k] || (S.sp["eq" + k] = (function() {
      const s = Math.ceil(R * 2 + 8), q = [];
      for (let f = 0; f < 14; f++) { const c = nova(s, s); engrenagem(c.getContext("2d"), s / 2, s / 2, R, dentes, cor, f / 14 * TAU / 6); q.push(c); }
      return q;
    })());
  }
  CEN.fabrica = {
    vin: .4,
    pre: function(g) {
      const T = S.top, B = S.bot, r = rnd(141);
      ceu(g, T, B, [[0, "#222c3a"], [1, "#141a24"]], T, B);
      for (let y = T - (T % 160) - 160; y < B; y += 160) for (let x = 0; x < L; x += 240) {
        g.fillStyle = lin(g, x, y, x + 240, y + 160, [[0, "#2c3848"], [1, "#1d2634"]]); g.fillRect(x + 1, y + 1, 238, 158);
        g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(x + 1, y + 1, 238, 2); g.fillRect(x + 1, y + 1, 2, 158); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x + 1, y + 157, 238, 2);
        [[10, 10], [230, 10], [10, 150], [230, 150]].forEach(q => rebite(g, x + q[0], y + q[1], 2.6, "#4a5a70"));
      }
      // janela grande (pôr do sol enfumaçado com chaminés)
      const wx = 800, wy = 70, ww = 400, wh = 240;
      g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
      g.fillStyle = lin(g, 0, wy, 0, wy + wh, [[0, "#6a3a5a"], [.5, "#e0603a"], [1, "#ffb050"]]); g.fillRect(wx, wy, ww, wh);
      halo(g, wx + 130, wy + 170, 160, "#ffe08a", .8); g.fillStyle = "#fff0b0"; C(g, wx + 130, wy + 170, 30); g.fill();
      for (let i = 0; i < 5; i++) { const x = wx + 20 + i * 82, h = 90 + r() * 90; g.fillStyle = i % 2 ? "#3a2440" : "#2a1a38"; g.fillRect(x, wy + wh - h, 34, h); g.fillRect(x - 3, wy + wh - h, 40, 8); g.globalAlpha = .6; nuvem(g, x + 18, wy + wh - h - 20, 120, "#5a3050", "#3a2040", "#2a1a38"); g.globalAlpha = 1; }
      g.fillStyle = "#1a1224"; g.fillRect(wx, wy + wh - 40, ww, 40); for (let i = 0; i < 14; i++) { g.fillStyle = "#ffcf70"; g.fillRect(wx + 10 + i * 28, wy + wh - 30 + (i % 3) * 8, 5, 6); }
      g.restore();
      g.strokeStyle = "#0e141c"; g.lineWidth = 12; g.strokeRect(wx, wy, ww, wh); g.strokeStyle = "#566a82"; g.lineWidth = 3; g.strokeRect(wx - 5, wy - 5, ww + 10, wh + 10);
      g.fillStyle = "#0e141c"; g.fillRect(wx + ww / 2 - 4, wy, 8, wh); g.fillRect(wx, wy + wh / 2 - 4, ww, 8);
      g.fillStyle = "rgba(255,255,255,.1)"; poli(g, [wx + 20, wy, wx + 140, wy, wx + 80, wy + wh, wx - 40, wy + wh]); g.fill();
      halo(g, wx + ww / 2, wy + wh, 420, "#ff8a3a", .28);
      engrenagem(g, 640, 150, 48, 12, "#2e3b52", .2); engrenagem(g, 30, 470, 70, 12, "#2e3b52", .4); engrenagem(g, 400, 150, 40, 12, "#34425a", 0);
      // vigas verticais e canos
      [60, 520, 760, 1180].forEach(function(x) { g.fillStyle = lin(g, x - 18, 0, x + 18, 0, [[0, "#4a5a70"], [.3, "#2e3a4c"], [1, "#161d28"]]); g.fillRect(x - 18, T, 36, B - T); for (let y = T + 30; y < B; y += 60) { rebite(g, x - 10, y, 2.4, "#6a7a90"); rebite(g, x + 10, y, 2.4, "#6a7a90"); } });
      [[170, "#3a8a8a", 12], [200, "#a0583a", 9]].forEach(function(q) { g.fillStyle = vg(g, q[0] - q[2], q[0] + q[2], clar(q[1], .25), somb(q[1], .45)); g.fillRect(0, q[0] - q[2], 560, q[2] * 2); for (let x = 70; x < 540; x += 120) { g.fillStyle = somb(q[1], .5); g.fillRect(x, q[0] - q[2] - 3, 10, q[2] * 2 + 6); } });
      g.fillStyle = vg(g, 560, 592, "#6a7a90", "#2e3a4c"); g.fillRect(0, 560, 520, 32);
      // vigas do teto e correntes
      g.fillStyle = vg(g, T, 38, "#46566c", "#1a2230"); g.fillRect(0, T, L, 38 - T); for (let x = 0; x < L; x += 90) { g.strokeStyle = "rgba(10,15,25,.7)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 45, 38); g.lineTo(x + 90, 0); g.stroke(); }
      [[300, 120], [680, 90], [1010, 140]].forEach(function(q) { g.strokeStyle = "#5a6a80"; g.lineWidth = 3; for (let y = 38; y < q[1]; y += 9) { g.beginPath(); g.ellipse(q[0], y + 4, 3, 5, 0, 0, TAU); g.stroke(); } g.fillStyle = "#2a3444"; poli(g, [q[0] - 22, q[1] + 18, q[0] + 22, q[1] + 18, q[0] + 10, q[1], q[0] - 10, q[1]]); g.fill(); });
      [[300, 138], [680, 108], [1010, 158]].forEach(q => { g.fillStyle = lin(g, 0, q[1], 0, q[1] + 380, [[0, "rgba(255,226,150,.2)"], [1, "rgba(255,226,150,0)"]]); poli(g, [q[0] - 20, q[1], q[0] + 20, q[1], q[0] + 130, q[1] + 380, q[0] - 130, q[1] + 380]); g.fill(); halo(g, q[0], q[1], 40, "#ffe296", .6); });
      // silhuetas de máquinas ao fundo
      g.fillStyle = "#121923"; g.fillRect(40, 580, 120, 80); g.fillRect(70, 540, 40, 40); g.fillRect(660, 600, 100, 60); g.fillRect(1140, 590, 110, 70); rr(g, 700, 546, 60, 60, 20); g.fill();
      if (B > A) { g.fillStyle = vg(g, A, B, "#161d28", "#0c1018"); g.fillRect(0, A - 1, L, B - A + 1); }
    },
    pad: function(p) { return p.h > 40 ? [0, 8, 0, 0] : p.move ? [10, 10, 10, 50] : [12, 12, 12, 14]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h;
      if (p.esteira) { // esteira: carcaça de aço, correia de borracha (animada em anim), rolos e faixa de alerta
        const big = h > 40;
        g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(w / 2, h + 6, w * .46, 4, 0, 0, TAU); g.fill();
        g.fillStyle = lin(g, 0, 0, 0, h + (big ? 20 : 0), [[0, "#7a8aa0"], [.3, "#46566c"], [1, "#222c3a"]]); rr(g, 0, 0, w, h + (big ? 20 : 0), 8); g.fill(); contorno(g, "#46566c", 2);
        g.fillStyle = "#1a1f28"; rr(g, 6, 3, w - 12, 12, 6); g.fill();               // correia
        g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(10, 4, w - 20, 1.5);
        if (big) { alerta(g, 0, 30, w, 8, "#f2b628", "#26323e", 12); for (let x = 20; x < w - 10; x += 40) { g.fillStyle = "#2e3a4c"; C(g, x, 48, 8); g.fill(); g.strokeStyle = "#6a7a90"; g.lineWidth = 1.5; g.stroke(); g.fillStyle = "#566a82"; C(g, x, 48, 2.6); g.fill(); } }
        else { alerta(g, 12, h - 7, w - 24, 4, "#f2b628", "#26323e", 8); }
        [8, w - 8].forEach(x => { g.fillStyle = "#566a82"; C(g, x, 9, 9); g.fill(); g.strokeStyle = "#2e3a4c"; g.lineWidth = 2; g.stroke(); g.fillStyle = "#8a9ab0"; C(g, x - 1, 8, 3); g.fill(); });
        return;
      }
      if (p.move) { // elevador hidráulico: placa de aço + pistão
        g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(w / 2, h + 48, w * .3, 4, 0, 0, TAU); g.fill();
        g.fillStyle = vg(g, h, h + 44, "#9aa8bc", "#3a465a"); g.fillRect(w / 2 - 12, h, 24, 44); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(w / 2 - 9, h, 4, 44); g.fillStyle = "#2e3a4c"; rr(g, w / 2 - 22, h + 34, 44, 14, 4); g.fill(); contorno(g, "#46566c", 1.5);
      }
      rr(g, 0, 0, w, h, 5); g.fillStyle = lin(g, 0, 0, 0, h, [[0, "#c8d2e0"], [.2, "#8a9ab0"], [1, "#46566c"]]); g.fill();
      g.save(); rr(g, 0, 0, w, h, 5); g.clip();
      if (!p.move) { g.fillStyle = "#161d28"; for (let x = 8; x < w - 8; x += 14) for (let y = 7; y < h - 4; y += 9) { rr(g, x, y, 8, 5, 2); g.fill(); } g.fillStyle = "rgba(255,176,46,.2)"; for (let x = 8; x < w - 8; x += 14) g.fillRect(x, h - 8, 8, 2); }
      else { alerta(g, 0, h - 8, w, 8, "#f2b628", "#26323e", 10); g.fillStyle = "#161d28"; g.fillRect(14, 6, w - 28, 4); }
      g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(0, 1, w, 2); g.restore(); rr(g, 0, 0, w, h, 5); contorno(g, "#46566c", 2);
      [8, w - 8].forEach(x => rebite(g, x, h / 2, 2.4, "#a8b6ca"));
    },
    anim: function(g, p, i, est, t) {
      if (p.esteira) { // correia animada: chevrons e frisos que correm no sentido da esteira (recorte de uma faixa maior)
        const w = p.w, P = 48, k = "belt" + w + (p.esteira > 0 ? 1 : 0);
        const s = spr(k, w + P, 10, function(c) {
          c.fillStyle = "#262c37"; c.fillRect(0, 0, w + P, 10);
          for (let x = 0; x < w + P; x += 12) { c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(x, 0, 2, 10); }
          for (let x = 0; x < w + P; x += P) { c.fillStyle = "#f2b628"; c.beginPath(); if (p.esteira > 0) { c.moveTo(x + 10, 1.5); c.lineTo(x + 22, 5); c.lineTo(x + 10, 8.5); c.lineTo(x + 15, 5); } else { c.moveTo(x + 22, 1.5); c.lineTo(x + 10, 5); c.lineTo(x + 22, 8.5); c.lineTo(x + 17, 5); } c.closePath(); c.fill(); }
          c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(0, 0, w + P, 1.5);
        });
        const off = mod(t * p.esteira * 60, P), sx = p.esteira > 0 ? P - off : off;
        g.save(); g.beginPath(); g.rect(Math.round(p.x + 6), Math.round(p.y + 3), w - 12, 10); g.clip(); g.drawImage(s, sx, 0, w - 12 + 6, 10, Math.round(p.x + 6), Math.round(p.y + 3), w - 12 + 6, 10); g.restore();
      }
    },
    aquecer: function() { CEN.fabrica.gears.forEach((q, k) => engQuadros(k, q[2], q[3], q[4])); },
    gears: [[170, 250, 100, 18, "#34425a", .5], [262, 352, 62, 12, "#2e3b52", -.75], [1090, 570, 76, 18, "#34425a", -.4]],   // x, y, R, dentes, cor, vel (rad/s)
    fundo: function(g, est, t) {
      CEN.fabrica.gears.forEach(function(q, k) {
        const fr = engQuadros(k, q[2], q[3], q[4]), u = mod(t * q[5] / (TAU / 6), 1), s = fr[0].width;
        g.drawImage(fr[Math.floor(u * 14)], Math.round(q[0] - s / 2), Math.round(q[1] - s / 2));
      });
      // vapor saindo dos canos (puffs de 3 tamanhos fixos que sobem e somem)
      const pf = [16, 28, 42].map(d => spr("vapor" + d, d, d, c => { c.fillStyle = rad(c, d / 2, d / 2, d / 2, [[0, "rgba(235,240,250,.5)"], [.6, "rgba(220,230,245,.22)"], [1, "rgba(220,230,245,0)"]]); c.fillRect(0, 0, d, d); }));
      [[90, 640], [1190, 640]].forEach(function(q, kk) { for (let m = 0; m < 5; m++) { const u = mod(t * .45 + m / 5 + kk * .3, 1), sp = pf[u < .33 ? 0 : u < .66 ? 1 : 2]; g.drawImage(sp, Math.round(q[0] - sp.width / 2 + Math.sin(u * 6 + m) * 8), Math.round(q[1] - u * 170 - sp.height / 2)); } });
      // luz de alerta piscando
      const on = (Math.floor(t * 3) % 2) === 0; g.fillStyle = on ? "#ffb02e" : "#6a4a1c"; rr(g, 626, 38, 28, 14, 5); g.fill(); if (on) glow(g, "#ffb02e", 640, 46, 120, .6);
    }
  };

  // =========================
  // 13. OCEANO — fundo do mar: raios de luz, recife de coral, naufrágio, algas, cardumes, bolhas
  // =========================
  function ramoCoral(g, x, y, len, ang, w, c0, c1, prof, r) { // coral ramificado (recursivo, pontas arredondadas e mais claras)
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    g.lineCap = "round"; g.strokeStyle = prof ? c0 : c1; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    if (prof <= 0) return;
    ramoCoral(g, x2, y2, len * .75, ang - .5 - r() * .3, w * .72, c0, c1, prof - 1, r); ramoCoral(g, x2, y2, len * .72, ang + .5 + r() * .3, w * .72, c0, c1, prof - 1, r);
    if (prof > 2 && r() < .6) ramoCoral(g, x2, y2, len * .6, ang + (r() - .5) * .3, w * .65, c0, c1, prof - 2, r);
  }
  function leque(g, x, y, s, c) { // gorgônia (leque do mar)
    g.save(); g.translate(x, y); g.strokeStyle = c; g.lineCap = "round"; g.lineWidth = 2;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(i * s * .08, -s * .6, i * s * .17, -s * (1 - Math.abs(i) * .03)); g.stroke(); }
    g.lineWidth = 1.2; for (let k = 1; k < 4; k++) { g.beginPath(); for (let i = -6; i <= 6; i++) g[i === -6 ? "moveTo" : "lineTo"](i * s * .15 * k / 3.2, -s * (.3 * k) * (1 - Math.abs(i) * .02)); g.stroke(); }
    g.restore();
  }
  function cerebro(g, x, y, r, c) { // coral-cérebro (cúpula com sulcos)
    g.fillStyle = lin(g, x - r, y - r, x + r, y, [[0, clar(c, .3)], [.5, c], [1, somb(c, .45)]]); g.beginPath(); g.ellipse(x, y, r, r * .78, 0, Math.PI, TAU); g.closePath(); g.fill();
    g.strokeStyle = ca(somb(c, .5), .5); g.lineWidth = 1.4; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x - r * .8, y - k * r * .15); for (let i = 1; i <= 8; i++) g.lineTo(x - r * .8 + i * r * .2, y - k * r * .15 - Math.sin(i * 1.7 + k) * r * .06); g.stroke(); }
  }
  function anemona(g, x, y, s, c) { // tentáculos com pontas brilhantes
    for (let i = -4; i <= 4; i++) { g.strokeStyle = c; g.lineWidth = 2.2; g.lineCap = "round"; g.beginPath(); g.moveTo(x + i * 1.4, y); g.quadraticCurveTo(x + i * s * .14, y - s * .6, x + i * s * .24, y - s * (.95 - Math.abs(i) * .05)); g.stroke(); g.fillStyle = clar(c, .6); C(g, x + i * s * .24, y - s * (.95 - Math.abs(i) * .05), 2.1); g.fill(); }
  }
  function peixe(k, cor, cor2, vira) { return spr("peixe" + k, 26, 14, function(g) { if (vira) { g.translate(26, 0); g.scale(-1, 1); } g.fillStyle = cor2; poli(g, [0, 2, 8, 7, 0, 12]); g.fill(); g.fillStyle = lin(g, 0, 0, 0, 14, [[0, clar(cor, .35)], [.5, cor], [1, somb(cor, .4)]]); g.beginPath(); g.ellipse(16, 7, 10, 5.4, 0, 0, TAU); g.fill(); g.fillStyle = cor2; poli(g, [13, 2.5, 18, -.5, 20, 3]); g.fill(); g.fillStyle = "#fff"; C(g, 21, 6, 1.8); g.fill(); g.fillStyle = "#12305a"; C(g, 21.5, 6, 1); g.fill(); }); }
  CEN.oceano = {
    vin: .35,
    pre: function(g) {
      const T = S.top, B = S.bot, r = rnd(151);
      ceu(g, T, B, [[0, "#34c0ec"], [.18, "#1c90d4"], [.5, "#0f62ac"], [.82, "#0a3c7c"], [1, "#071f4c"]], T, B);
      // luz da superfície e raios
      g.fillStyle = vg(g, T, T + 100, "rgba(200,255,255,.5)", "rgba(200,255,255,0)"); g.fillRect(0, T, L, 100);
      g.save(); g.globalCompositeOperation = "lighter"; raios(g, 230, T - 60, 1.0, 1.9, 8, 1000, "#bff4ff", .15, 11); raios(g, 760, T - 60, 1.15, 2.0, 6, 900, "#bff4ff", .09, 12); g.restore();
      // formações distantes: arco de pedra e naufrágio em silhueta azulada
      g.fillStyle = "#1a64a4"; g.beginPath(); g.moveTo(-10, 620); g.lineTo(30, 470); g.quadraticCurveTo(110, 400, 190, 470); g.lineTo(230, 620); g.lineTo(190, 620); g.quadraticCurveTo(150, 500, 110, 500); g.quadraticCurveTo(70, 500, 40, 620); g.fill();
      g.save(); g.translate(1030, 600); g.rotate(-.08); g.fillStyle = "#16589a"; poli(g, [-120, -40, 120, -50, 90, 20, -90, 20]); g.fill(); g.fillRect(-4, -190, 7, 150); g.fillRect(-60, -150, 3, 110); poli(g, [4, -186, 60, -150, 4, -140]); g.fill(); g.fillStyle = "#1a64a4"; for (let i = 0; i < 7; i++) g.fillRect(-100 + i * 32, -42, 5, 40); g.restore();
      bruma(g, 380, 640, "#2a90d0", .45);
      // recife médio (corais em tons dessaturados pelo "azul")
      for (let i = 0; i < 24; i++) { const x = r() * L, y = 640 + r() * 14, c = ["#d86a8e", "#e88a60", "#9a6ad8", "#5ad0b0"][i % 4]; ramoCoral(g, x, y, 22 + r() * 22, -Math.PI / 2 + (r() - .5) * .4, 6 + r() * 3, mix(c, "#2a6ab0", .45), mix(c, "#9fe0ff", .15), 3, r); }
      for (let i = 0; i < 8; i++) { const x = r() * L, y = 666; cerebro(g, x, y, 22 + r() * 18, mix(["#e0907a", "#c0a0e0", "#e8b070"][i % 3], "#2a6ab0", .4)); }
      bruma(g, 560, 700, "#1a78c0", .3);
      // fundo de areia + corais vivos na frente
      cume(g, { y: 690, amp: 10, esc: 120, seed: 8, c0: "#c8b488", c1: "#9a8660", bot: 760, rim: "rgba(255,240,190,.6)" });
      [[110, "#ff6b8a"], [330, "#ffa05a"], [940, "#b07aff"], [1160, "#ff6b8a"], [720, "#ffa05a"]].forEach(function(q, k) { for (let m = 0; m < 3; m++) ramoCoral(g, q[0] + m * 16 - 16, 700, 28 + r() * 18, -Math.PI / 2 + (m - 1) * .35, 8, somb(q[1], .15), clar(q[1], .3), 3, r); });
      leque(g, 250, 700, 70, "#e8508a"); leque(g, 1060, 700, 80, "#ff8a50"); leque(g, 500, 704, 46, "#b07aff");
      anemona(g, 420, 700, 26, "#ff9ac0"); anemona(g, 860, 702, 30, "#7ae8d0");
      if (B > A) { g.fillStyle = vg(g, A, B, "#8a7a56", "#5a4c38"); g.fillRect(0, A - 1, L, B - A + 1); }
    },
    pad: function(p) { return p.h > 40 ? [0, 22, 0, 0] : [14, 26, 14, 36]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h, r = rnd(160 + i);
      if (h > 40) { // fundo de areia com ondulações, conchas e estrelas-do-mar
        g.fillStyle = lin(g, 0, 0, 0, h + 20, [[0, "#f2dca4"], [.2, "#dcc088"], [.7, "#b89a64"], [1, "#9a7e50"]]); g.fillRect(-4, 0, w + 8, h + 20);
        g.strokeStyle = "rgba(120,90,50,.28)"; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); for (let x = -4; x <= w + 4; x += 18) g.lineTo(x, 18 + k * 11 + Math.sin(x / 36 + k * 2) * 3.5); g.stroke(); }
        seixos(g, 0, 16, w, h - 12, 28, 2, "#d0b078");
        g.fillStyle = lin(g, 0, 0, 0, 10, [[0, "#fff4cc"], [1, "#f2dca4"]]); g.beginPath(); g.moveTo(-4, 8); for (let x = -4; x <= w + 4; x += 10) g.lineTo(x, 3 + Math.sin(x / 31) * 2); g.lineTo(w + 4, 8); g.closePath(); g.fill();
        for (let k = 0; k < 5; k++) { const x = 60 + r() * (w - 120), y = 22 + r() * 20, c = k % 2 ? "#ff8a50" : "#ff6b8a"; g.save(); g.translate(x, y); g.rotate(r() * 6); g.fillStyle = c; poli(g, [0, -9, 2.5, -3, 9, -3, 4, 1.5, 6, 8, 0, 4, -6, 8, -4, 1.5, -9, -3, -2.5, -3]); g.fill(); g.fillStyle = clar(c, .4); C(g, 0, 0, 2); g.fill(); g.restore(); }
        for (let k = 0; k < 3; k++) { const x = 150 + r() * (w - 300), y = 4; g.fillStyle = "#ffe6e0"; g.beginPath(); g.moveTo(x - 8, y + 6); g.quadraticCurveTo(x - 10, y - 8, x, y - 8); g.quadraticCurveTo(x + 10, y - 8, x + 8, y + 6); g.closePath(); g.fill(); g.strokeStyle = "#e8a0a8"; g.lineWidth = 1; for (let q = -2; q <= 2; q++) { g.beginPath(); g.moveTo(x + q * 1.5, y + 6); g.lineTo(x + q * 3.4, y - 6); g.stroke(); } }
        return;
      }
      g.fillStyle = "rgba(0,20,60,.2)"; g.beginPath(); g.ellipse(w / 2, h + 34, w * .42, 5, 0, 0, TAU); g.fill();
      ilha(g, 0, 0, w, h, 26, { c: "#5a6a9a", seed: 150 + i, rach: 0, pot: 1.2, extra: function(g) { for (let k = 0; k < Math.round(w / 12); k++) { g.fillStyle = "rgba(220,240,255,.28)"; C(g, r() * w, 8 + r() * (h + 14), 1 + r() * 1.5); g.fill(); } g.fillStyle = "rgba(20,10,60,.25)"; g.fillRect(0, 0, w, 3); } });
      // crosta de coral/alga no topo e decoração
      g.fillStyle = lin(g, 0, -2, 0, 9, [[0, "#ff9fb5"], [1, "#e0587c"]]); g.beginPath(); g.moveTo(1, 9); g.lineTo(1, 3); for (let x = 1; x <= w - 1; x += 7) g.lineTo(x, -1 + r() * 3); g.lineTo(w - 1, 3); g.lineTo(w - 1, 9); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(2, 0, w - 4, 1.5);
      for (let k = 0; k < Math.max(2, Math.round(w / 70)); k++) { const x = 18 + r() * (w - 36), c = ["#ff6b8a", "#ffa05a", "#b07aff", "#5ad0b0"][Math.floor(r() * 4)]; if (k % 2) ramoCoral(g, x, 1, 12 + r() * 6, -Math.PI / 2 + (r() - .5) * .5, 3.5, somb(c, .1), clar(c, .3), 2, r); else anemona(g, x, 1, 14 + r() * 6, c); }
    },
    aquecer: function() { // cria já todos os quadros de alga e água-viva
      const g = nova(4, 4).getContext("2d"), est = { altura: S.H, deslocY: S.dy };
      for (let k = 0; k < 40; k++) CEN.oceano.fundo(g, est, k * .37);
    },
    fundo: function(g, est, t) {
      // algas ondulando (5 quadros pré-renderizados por alga), cardumes (peixes já virados), águas-vivas (3 quadros) e bolhas (4 tamanhos)
      for (let k = 0; k < 7; k++) {
        const x = [40, 300, 560, 700, 990, 1230, 1120][k], h = 150 + (k % 3) * 40, f = Math.max(0, Math.min(4, Math.round((Math.sin(t * .9 + k * 1.3) + 1) * 2)));
        const sp = spr("alga" + k + "_" + f, 90, h + 20, function(c) { c.translate(45, h + 14); c.rotate((f - 2) * .045); c.translate(-45, -(h + 14)); for (let m = 0; m < 3; m++) { c.beginPath(); const bx = 34 + m * 11; c.moveTo(bx, h + 12); c.bezierCurveTo(bx + 14, h * .7, bx - 14, h * .4, bx + 3, 8 + m * 12); c.lineWidth = 8 - m * 1.4; c.lineCap = "round"; c.strokeStyle = [somb("#2fb86a", .2), "#2fb86a", clar("#2fb86a", .25)][m]; c.stroke(); } });
        g.drawImage(sp, x - 45, 706 - h - 14);
      }
      const cores = [["#ffb84a", "#ff7a3a"], ["#7ae0ff", "#2a9ad8"], ["#ff8ab0", "#d84a7a"]];
      [[0, 240, 70, 1, 7], [1, 410, 54, -1, 6], [2, 520, 86, 1, 6], [0, 150, 40, -1, 5]].forEach(function(q, k) {
        const fs = peixe(q[0] * 2 + (q[3] < 0 ? 1 : 0), cores[q[0]][0], cores[q[0]][1], q[3] < 0);
        for (let m = 0; m < q[4]; m++) { const x = mod(q[2] * t * q[3] + k * 330 + m * 28 + Math.sin(t * 2 + m) * 6, L + 120) - 60, y = q[1] + Math.sin(t * 1.1 + m * .9 + k) * 22 + (m % 3) * 12; g.drawImage(fs, Math.round(x - 13), Math.round(y - 7)); }
      });
      [[610, 200, 0], [60, 140, 2]].forEach(q => { const f = Math.floor(mod(t * 2.4 + q[2], 6.2832) / 6.2832 * 3), sp = spr("jelly" + f, 44, 54, function(c) { const sx = 1 + .1 * (f - 1); c.translate(22, 4); c.scale(1 / sx, sx); c.translate(-20, 0); c.fillStyle = rad(c, 20, 18, 18, [[0, "rgba(255,200,240,.9)"], [.6, "rgba(230,130,220,.7)"], [1, "rgba(180,90,220,.5)"]]); c.beginPath(); c.ellipse(20, 16, 16, 13, 0, Math.PI, TAU); c.quadraticCurveTo(36, 24, 20, 22); c.quadraticCurveTo(4, 24, 4, 16); c.fill(); c.strokeStyle = "rgba(240,160,230,.7)"; c.lineWidth = 1.6; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(10 + i * 7, 22); c.quadraticCurveTo(8 + i * 8 + (f - 1) * 3, 34, 12 + i * 7, 46); c.stroke(); } c.fillStyle = "rgba(255,255,255,.5)"; c.beginPath(); c.ellipse(14, 9, 5, 2.5, -.4, 0, TAU); c.fill(); });
        g.drawImage(sp, Math.round(q[0] + Math.sin(t * .4 + q[2]) * 30 - 22), Math.round(q[1] + Math.sin(t * .8 + q[2]) * 24 - 27)); });
      const bo = [6, 9, 12, 15].map(d => spr("bolha" + d, d + 2, d + 2, function(c) { c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 1.3; C(c, d / 2 + 1, d / 2 + 1, d / 2 - .5); c.stroke(); c.fillStyle = "rgba(255,255,255,.16)"; c.fill(); c.fillStyle = "rgba(255,255,255,.9)"; C(c, d * .34 + 1, d * .34 + 1, Math.max(.8, d * .09)); c.fill(); }));
      for (let k = 0; k < 24; k++) { const u = mod(t * (.06 + (k % 4) * .018) + k * .137, 1), x = ((k * 197) % 1240) + 20 + Math.sin(t * 1.4 + k * 2) * 8; g.drawImage(bo[k % 4], Math.round(x), Math.round(est.altura - u * (est.altura + 40) - est.deslocY)); }
    },
    frente: function(g, est, t) { // tom azulado (um retângulo chapado) + cáusticas só no alto da tela
      g.fillStyle = "rgba(40,150,225,.075)"; g.fillRect(0, -est.deslocY, L, est.altura);
      const ca2 = spr("caustica", 256, 96, function(c) { const rr3 = rnd(3); c.strokeStyle = "rgba(220,255,255,.3)"; c.lineWidth = 2; c.lineCap = "round"; for (let i = 0; i < 14; i++) { const x = rr3() * 256, y = rr3() * 96; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 24, y - 14, x + 40, y + 12, x + 62, y - 4); c.stroke(); } });
      for (let k = 0; k < 6; k++) g.drawImage(ca2, Math.round(mod(k * 256 + t * 22, L + 256) - 256), Math.round(-est.deslocY + 6 + (k % 2) * 40));
    }
  };

  // =========================
  // 14. TEMPLO — ruínas ao pôr do sol: pirâmide com glifos, colunas, cipós, portais mágicos
  // =========================
  function piramide(g, cx, base, w0, nTiers, th, c, lado) {
    for (let i = 0; i < nTiers; i++) {
      const w = w0 * (1 - i / (nTiers + .6)), y = base - i * th;
      g.fillStyle = lin(g, cx - w / 2, 0, cx + w / 2, 0, [[0, clar(c, .3)], [.5, c], [1, somb(c, .5)]]); g.fillRect(cx - w / 2, y - th, w, th);
      g.fillStyle = "rgba(255,240,200,.25)"; g.fillRect(cx - w / 2, y - th, w, 3); g.fillStyle = "rgba(10,20,40,.35)"; g.fillRect(cx - w / 2, y - 3, w, 3);
      g.fillStyle = ca(lado, .85); for (let k = 0; k < 6; k++) { g.fillRect(cx - w / 2 + 12 + k * (w - 24) / 6, y - th * .6, (w - 24) / 6 - 8, 3); g.fillRect(cx - w / 2 + 12 + k * (w - 24) / 6 + 4, y - th * .38, 4, 7); }
    }
    const wt = w0 * (1 - nTiers / (nTiers + .6)); // degraus centrais
    g.fillStyle = "rgba(255,235,190,.38)"; poli(g, [cx - 26, base, cx + 26, base, cx + wt * .2, base - nTiers * th, cx - wt * .2, base - nTiers * th]); g.fill();
    g.strokeStyle = "rgba(60,40,60,.3)"; g.lineWidth = 1; for (let k = 1; k < nTiers * 4; k++) { const y = base - k * th / 4, u = k / (nTiers * 4), w = 26 * (1 - u) + wt * .2 * u; g.beginPath(); g.moveTo(cx - w, y); g.lineTo(cx + w, y); g.stroke(); }
  }
  // portal: anel de runas (12 marcas) e espiral (4 braços) pré-renderizados em vários quadros de rotação (sem girar sprite por quadro)
  function portalQuadros(cor, cor2) {
    const k = "portal" + cor; if (S.sp[k]) return S.sp[k];
    const NA = 12, NS = 28, anel = [], esp = [];
    for (let f = 0; f < NA; f++) { const c = nova(100, 100), g = c.getContext("2d"); g.translate(50, 50); g.lineWidth = 5; g.strokeStyle = cor; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.stroke(); g.lineWidth = 1.6; g.strokeStyle = "#ffffff"; g.stroke(); g.rotate(f / NA * TAU / 12); for (let i = 0; i < 12; i++) { g.save(); g.rotate(i / 12 * TAU); g.fillStyle = i % 2 ? "#ffffff" : cor2; g.fillRect(-2, -47, 4, 8); g.restore(); } anel.push(c); }
    for (let f = 0; f < NS; f++) { const c = nova(100, 100), g = c.getContext("2d"); g.translate(50, 50); g.rotate(f / NS * Math.PI / 2); g.lineCap = "round"; for (let q = 0; q < 4; q++) { g.save(); g.rotate(q * Math.PI / 2); g.beginPath(); for (let a2 = 0; a2 < 4.2; a2 += .2) { const rr3 = 4 + a2 * 8; g[a2 ? "lineTo" : "moveTo"](Math.cos(a2 + .4) * rr3, Math.sin(a2 + .4) * rr3); } g.lineWidth = 6; g.strokeStyle = ca(cor, .45); g.stroke(); g.lineWidth = 2; g.strokeStyle = "rgba(255,255,255,.8)"; g.stroke(); g.restore(); } esp.push(c); }
    return S.sp[k] = { anel: anel, esp: esp };
  }
  CEN.templo = {
    vin: .35,
    aquecer: function() { portalQuadros("#4de0c0", "#c8fff0"); portalQuadros("#b58bff", "#e0d0ff"); },
    pre: function(g) {
      const T = S.top, B = S.bot, r = rnd(171);
      ceu(g, T, 640, [[0, "#0d2538"], [.3, "#1d5666"], [.62, "#c9a060"], [.85, "#f4cc7e"], [1, "#ffe0a0"]], T, B);
      halo(g, 640, 360, 640, "#ffd890", .6); raios(g, 640, 360, Math.PI * 1.05, Math.PI * 1.95, 14, 800, "#fff0c0", .1, 7);
      g.fillStyle = lin(g, 0, 240, 0, 480, [[0, "#fff4c8"], [1, "#ffc060"]]); C(g, 640, 360, 118); g.fill();
      estrelas(g, 50, 17, T, 200, "#e8f6ff");
      for (let i = 0; i < 5; i++) { g.globalAlpha = .45; nuvem(g, 100 + i * 260 + r() * 60, 130 + r() * 120, 240 + r() * 100, "#ffeccc", "#e8b888", "#6a6a80"); } g.globalAlpha = 1;
      montanhas(g, { y: 580, alt: 150, passo: 200, seed: 6, c0: "#4a7a82", c1: "#8aa890", sh: "#2a4a5a", shA: .35, luz: "#ffe8b0", luzA: .2, bot: 660 });
      piramide(g, 640, 600, 600, 6, 52, "#5e787e", "rgba(77,224,192,.9)");
      // santuário no topo com porta luminosa
      const ty = 600 - 6 * 52; g.fillStyle = "#5c7474"; g.fillRect(612, ty - 38, 56, 38); g.fillStyle = "#8aa4a0"; g.fillRect(606, ty - 44, 68, 8); g.fillStyle = "#4a6262"; g.fillRect(622, ty - 52, 36, 8);
      halo(g, 640, ty - 16, 60, "#4de0c0", .8); g.fillStyle = "#c8fff0"; rr(g, 632, ty - 30, 16, 30, 6); g.fill();
      bruma(g, 380, 620, "#e8b878", .3);
      // colinas de selva dos lados com árvores
      const h2 = cume(g, { y: 610, amp: 28, esc: 150, seed: 14, c0: "#2f6a5a", c1: "#1d4a44", bot: 700, rim: "rgba(255,230,160,.45)" });
      for (let i = 0; i < 18; i++) { const x = r() * L; if (x > 330 && x < 950) continue; copa(g, x, h2(x) - 6 - r() * 24, 24 + r() * 26, "#4a9a7a", "#2a6a5a", "#17463f"); }
      // colunas quebradas + estátuas de pedra
      [[300, 100], [356, 60], [930, 90], [990, 56]].forEach(function(q) { const x = q[0], h = q[1], y = 624; g.fillStyle = "#6a7e78"; g.fillRect(x - 12, y - h, 24, h); g.fillStyle = "#44584f"; g.fillRect(x + 2, y - h, 10, h); g.fillStyle = "rgba(255,240,200,.3)"; g.fillRect(x - 12, y - h, 4, h); g.fillStyle = "#7e948c"; g.fillRect(x - 16, y - h - 6, 32, 7); g.fillStyle = "#4de0c0"; for (let k = 0; k < 3; k++) g.fillRect(x - 3, y - h + 14 + k * 20, 6, 3); });
      // cipós pendurados
      g.lineCap = "round"; for (let i = 0; i < 16; i++) { const x = 30 + i * 80 + r() * 40, len = 50 + r() * 120; g.strokeStyle = i % 2 ? "#2f7a50" : "#245f48"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, T); g.bezierCurveTo(x + 10, T + len * .4, x - 10, T + len * .7, x + (r() - .5) * 12, T + len); g.stroke(); for (let k = 1; k < 5; k++) { g.fillStyle = "#3f9a60"; g.beginPath(); g.ellipse(x + (k % 2 ? 5 : -5), T + len * k / 5, 5, 2.6, .7, 0, TAU); g.fill(); } }
      // colunas de runas nas bordas laterais (indicam que os lados se conectam)
      [[0, 1], [L - 22, -1]].forEach(function(q) { g.fillStyle = lin(g, q[0], 0, q[0] + 22, 0, q[1] > 0 ? [[0, "rgba(77,224,192,.4)"], [1, "rgba(77,224,192,0)"]] : [[0, "rgba(77,224,192,0)"], [1, "rgba(77,224,192,.4)"]]); g.fillRect(q[0], 100, 22, 560); });
      if (B > A) { g.fillStyle = vg(g, A, B, "#17463f", "#0c2a2a"); g.fillRect(0, A - 1, L, B - A + 1); }
    },
    pad: function(p) { return p.w > 1000 ? [0, 12, 0, 0] : [14, 12, 14, 26]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h, r = rnd(180 + i);
      if (w > 1000) { // piso do templo: blocos grandes com musgo e disco de runas ao centro
        g.fillStyle = lin(g, 0, 0, 0, h + 20, [[0, "#8aa098"], [.2, "#667c78"], [1, "#2c3e42"]]); g.fillRect(-4, 0, w + 8, h + 20);
        for (let y = 0, row = 0; y < h + 20; y += 30, row++) for (let x = -(row % 2) * 64; x < w; x += 128) { g.strokeStyle = "rgba(15,30,40,.5)"; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, 128, 30); g.fillStyle = "rgba(255,240,200,.1)"; g.fillRect(x + 3, y + 3, 124, 3); }
        rachaduras(g, 0, 8, w, h, 10, 17, "#0e1e22", .6);
        g.fillStyle = "rgba(60,150,110,.6)"; for (let x = 0; x < w; x += 7) g.fillRect(x, 0, 7, 3 + (Math.sin(x * .7) + 1) * 3);
        g.fillStyle = lin(g, 0, 0, 0, 8, [[0, "rgba(255,240,200,.5)"], [1, "rgba(255,240,200,0)"]]); g.fillRect(0, 0, w, 8);
        g.strokeStyle = "#4de0c0"; g.lineWidth = 2; g.beginPath(); g.ellipse(640, 12, 90, 5, 0, 0, TAU); g.stroke(); g.strokeStyle = "rgba(77,224,192,.5)"; g.lineWidth = 6; g.stroke();
        return;
      }
      g.fillStyle = "rgba(10,30,30,.2)"; g.beginPath(); g.ellipse(w / 2, h + 22, w * .42, 4, 0, 0, TAU); g.fill();
      // arenito dourado (destaca da pirâmide cinza-azulada atrás) com faixa de jade embaixo
      pedra(g, 0, 0, w, h, { c: "#d2a866", seed: 180 + i, rach: 1, facetas: 3, raio: 5, jag: 2, topo: 5, luzTopo: .7 });
      g.fillStyle = "rgba(40,170,140,.55)"; g.fillRect(4, h - 4, w - 8, 2);
      // friso grego em baixo-relevo + runas luminosas
      g.strokeStyle = "rgba(96,58,24,.55)"; g.lineWidth = 2; g.beginPath(); for (let x = 12; x < w - 20; x += 18) { g.moveTo(x, h - 5); g.lineTo(x, 10); g.lineTo(x + 10, 10); g.lineTo(x + 10, 15); g.lineTo(x + 5, 15); } g.stroke();
      g.fillStyle = "#4de0c0"; for (let k = 0; k < 3; k++) { const x = w * (.22 + k * .28); halo(g, x, h / 2, 12, "#4de0c0", .6); g.fillRect(x - 3, h / 2 - 3, 6, 6); }
      g.fillStyle = "rgba(60,160,110,.85)"; for (let x = 4; x < w - 4; x += 6) g.fillRect(x, -2 + (Math.sin(x * .9 + i) > .2 ? -2 : 0), 6, 4);
      g.strokeStyle = "#2f7a50"; g.lineWidth = 2.4; g.lineCap = "round"; for (let k = 0; k < Math.round(w / 90); k++) { const x = 14 + r() * (w - 28); g.beginPath(); g.moveTo(x, h - 2); g.bezierCurveTo(x + 6, h + 6, x - 6, h + 12, x + 2, h + 18 + r() * 6); g.stroke(); }
    },
    extra: function(g, est, t) { // portais: anel e espiral girando em sentidos contrários + brilho pulsante
      const ps = est.portais; if (!ps) return;
      for (let i = 0; i < ps.length; i++) for (let e = 0; e < 2; e++) {
        const p = ps[i][e], cor = e ? "#b58bff" : "#4de0c0", cor2 = e ? "#e0d0ff" : "#c8fff0", sp = portalQuadros(cor, cor2);
        glow(g, cor, p.x, p.y, 180, .55 + .25 * Math.sin(t * 3 + e));
        g.drawImage(sp.esp[Math.floor(mod(-t * 1.6 / (Math.PI / 2), 1) * sp.esp.length)], Math.round(p.x - 50), Math.round(p.y - 50));
        g.drawImage(sp.anel[Math.floor(mod(t * .5 / (TAU / 12), 1) * sp.anel.length)], Math.round(p.x - 50), Math.round(p.y - 50));
      }
    },
    fundo: function(g, est, t) {
      // cristais de runa flutuando + brilho pulsando nas bordas + partículas subindo pelas bordas
      const cr = spr("cristal", 24, 40, c => { c.fillStyle = "#4de0c0"; poli(c, [12, 1, 22, 20, 12, 39, 2, 20]); c.fill(); c.fillStyle = "#c8fff0"; poli(c, [12, 1, 2, 20, 12, 20]); c.fill(); c.fillStyle = "#1f9a8a"; poli(c, [12, 20, 22, 20, 12, 39]); c.fill(); });
      [[190, 150], [1090, 190], [420, 100], [860, 120]].forEach(function(q, k) { const y = q[1] + Math.sin(t * 1.2 + k * 1.7) * 10; glow(g, "#4de0c0", q[0], y, 60, .5); g.drawImage(cr, q[0] - 12, Math.round(y - 20)); });
      glow(g, "#4de0c0", 0, 390, 200, .35 + .35 * Math.sin(t * 2)); glow(g, "#4de0c0", L, 390, 200, .35 + .35 * Math.sin(t * 2));
      const pt = spr("runaPt", 10, 10, c => { c.fillStyle = "#c8fff0"; c.fillRect(3, 3, 4, 4); c.fillStyle = "rgba(77,224,192,.5)"; c.fillRect(1, 1, 8, 8); });
      for (let k = 0; k < 12; k++) { const u = mod(t * .18 + k / 12, 1); g.globalAlpha = Math.sin(u * 3.14); g.drawImage(pt, k % 2 ? L - 18 : 8, Math.round(640 - u * 520)); } g.globalAlpha = 1;
    }
  };

  // =========================
  // 15. CASTELO — tempestade, relâmpagos, fortaleza na rocha, tochas e meteoros
  // =========================
  function torre(g, x, y, w, h, o) { // torre com ameias, janelas acesas e telhado cônico
    g.fillStyle = lin(g, x, 0, x + w, 0, [[0, o.c0], [.55, o.c1], [1, somb(o.c1, .5)]]); g.fillRect(x, y - h, w, h);
    if (o.ameia) { const n = Math.max(2, Math.round(w / 12)), mw = w / (n * 2 - 1); for (let i = 0; i < n; i++) g.fillRect(x + i * mw * 2, y - h - 9, mw, 10); g.fillStyle = "rgba(10,10,40,.3)"; g.fillRect(x, y - h, w, 3); }
    else { g.fillStyle = o.roof; poli(g, [x - 5, y - h, x + w + 5, y - h, x + w / 2, y - h - w * 1.2]); g.fill(); g.fillStyle = "rgba(10,10,40,.35)"; poli(g, [x + w / 2, y - h - w * 1.2, x + w + 5, y - h, x + w / 2 + 2, y - h]); g.fill(); g.fillStyle = "rgba(180,170,255,.3)"; poli(g, [x - 5, y - h, x + w / 2, y - h - w * 1.2, x + w * .35, y - h]); g.fill(); g.fillStyle = "#c9a45a"; g.fillRect(x + w / 2 - 1, y - h - w * 1.2 - 14, 2, 14); }
    g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(x, y - h, 2, h);
    const r = rnd(o.seed || 1); for (let k = 0; k < Math.floor(h / 40); k++) { const wx = x + w * (.3 + r() * .2), wy = y - h + 18 + k * 40; halo(g, wx + 2.5, wy + 5, 14, "#ffcf70", .5); g.fillStyle = "#ffd98a"; rr(g, wx, wy, 5, 10, 2); g.fill(); }
  }
  function estandarte(g, x, y, c) { g.fillStyle = c; poli(g, [x, y, x + 14, y, x + 14, y + 34, x + 7, y + 28, x, y + 34]); g.fill(); g.fillStyle = "#e8c860"; g.fillRect(x, y, 14, 2.5); faisca(g, x + 7, y + 14, 4, "#e8c860"); }
  function tijolos(g, x, y, w, h, c, seed, bw, bh) { // fileiras de tijolos com juntas alternadas e variação de tom
    const r = rnd(seed); bw = bw || 28; bh = bh || 14;
    for (let yy = y, row = 0; yy < y + h; yy += bh, row++) for (let xx = x - (row % 2) * bw / 2; xx < x + w; xx += bw) {
      g.fillStyle = mix(c, r() < .5 ? "#ffffff" : "#1a1840", r() * .12); g.fillRect(xx + 1, yy + 1, bw - 2, bh - 2); g.fillStyle = "rgba(255,246,225,.12)"; g.fillRect(xx + 1, yy + 1, bw - 2, 1.5);
    }
  }
  CEN.castelo = {
    vin: .45,
    pre: function(g) {
      const T = S.top, B = S.bot, r = rnd(191);
      ceu(g, T, 640, [[0, "#080b18"], [.35, "#1b2142"], [.7, "#3c3260"], [1, "#7a4a5a"]], T, B);
      halo(g, 980, 120, 420, "#a8b4ff", .35); g.fillStyle = "rgba(220,226,255,.8)"; C(g, 980, 120, 36); g.fill();
      // camadas de nuvens de tempestade (bordas iluminadas pela lua)
      for (let k = 0; k < 3; k++) for (let i = 0; i < 9; i++) { g.globalAlpha = .75; nuvem(g, r() * L, T + 40 + k * 90 + r() * 80, 300 + r() * 260, k === 0 ? "#3a4272" : "#2a3058", k === 0 ? "#252b52" : "#1c2144", "#12162e"); } g.globalAlpha = 1;
      montanhas(g, { y: 560, alt: 190, passo: 150, seed: 31, c0: "#2e3358", c1: "#4a4470", sh: "#151833", shA: .45, luz: "#9aa4e0", luzA: .15, bot: 660 });
      bruma(g, 400, 620, "#6a5a90", .3);
      // penhasco e fortaleza
      g.fillStyle = vg(g, 420, 640, "#2a2a4a", "#14142a"); g.beginPath(); g.moveTo(520, 640); g.lineTo(560, 500); g.lineTo(640, 470); g.lineTo(760, 450); g.lineTo(1000, 460); g.lineTo(1100, 500); g.lineTo(1160, 640); g.closePath(); g.fill();
      g.fillStyle = "rgba(160,170,230,.12)"; poli(g, [560, 500, 640, 470, 660, 640, 540, 640]); g.fill();
      const cc = { c0: "#4a4f80", c1: "#363a68", roof: "#2e3a78", seed: 5 };
      g.fillStyle = "#363a68"; g.fillRect(620, 410, 480, 70);                                   // muralha
      for (let i = 0; i < 20; i++) g.fillRect(622 + i * 24, 400, 13, 11);
      torre(g, 640, 410, 56, 150, Object.assign({}, cc, { seed: 3 })); torre(g, 730, 420, 70, 230, Object.assign({}, cc, { seed: 4, ameia: 1 }));
      torre(g, 820, 410, 52, 190, Object.assign({}, cc, { seed: 6 })); torre(g, 910, 420, 80, 160, Object.assign({}, cc, { seed: 8, ameia: 1 })); torre(g, 1030, 420, 50, 130, Object.assign({}, cc, { seed: 9 }));
      torre(g, 748, 190, 34, 80, Object.assign({}, cc, { seed: 12 }));
      estandarte(g, 762, 100, "#a0303e"); estandarte(g, 842, 150, "#a0303e");
      g.fillStyle = "#14142a"; g.beginPath(); g.moveTo(884, 480); g.lineTo(884, 450); g.arc(906, 450, 22, Math.PI, 0); g.lineTo(928, 480); g.fill(); halo(g, 906, 462, 30, "#ffb050", .5);
      // pontes e arcos da muralha
      g.fillStyle = "rgba(10,10,40,.3)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(960 + i * 24, 480); g.lineTo(960 + i * 24, 455); g.arc(972 + i * 24, 455, 12, Math.PI, 0); g.lineTo(984 + i * 24, 480); g.fill(); }
      bruma(g, 500, 650, "#5a4a80", .35);
      // muralha esquerda distante e torres
      g.fillStyle = "#2c3058"; g.fillRect(40, 470, 360, 90); for (let i = 0; i < 14; i++) g.fillRect(42 + i * 26, 458, 14, 13);
      torre(g, 90, 470, 44, 110, { c0: "#3a3f6a", c1: "#2c3058", roof: "#252a60", seed: 21 }); torre(g, 300, 470, 50, 130, { c0: "#3a3f6a", c1: "#2c3058", roof: "#252a60", seed: 22 });
      bruma(g, 540, 660, "#3a3060", .4);
      // chão distante
      cume(g, { y: 640, amp: 14, esc: 140, seed: 3, c0: "#1c1c3c", c1: "#101028", bot: 720, rim: "rgba(150,150,230,.25)" });
      // pilares com tocha (esquerda e direita)
      [60, 1220].forEach(function(x) { g.fillStyle = "#1c1c3c"; g.fillRect(x - 22, 560, 44, 110); tijolos(g, x - 22, 560, 44, 100, "#2c2c52", x, 22, 12); g.fillStyle = "#2c2c52"; g.fillRect(x - 28, 550, 56, 12); g.fillStyle = "#5a4a3a"; g.fillRect(x - 3, 590, 6, 24); g.fillStyle = "#c9a45a"; g.fillRect(x - 7, 586, 14, 6); halo(g, x, 570, 80, "#ff9a40", .55); });
      if (B > A) { g.fillStyle = vg(g, A, B, "#1c1c3c", "#0c0c22"); g.fillRect(0, A - 1, L, B - A + 1); }
    },
    pad: function(p) { return p.w > 1000 ? [0, 14, 0, 0] : [14, 14, 14, 22]; },
    plat: function(g, p, i) {
      const w = p.w, h = p.h;
      if (w > 1000) { // muralha de tijolos com cornija
        g.fillStyle = "#2e3258"; g.fillRect(-4, 0, w + 8, h + 20); tijolos(g, -4, 12, w + 8, h + 20, "#464c7e", 3, 34, 16);
        g.fillStyle = lin(g, 0, 0, 0, 13, [[0, "#9aa0d0"], [1, "#6a70a6"]]); g.fillRect(-4, 0, w + 8, 13); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-4, 0, w + 8, 2); g.fillStyle = "rgba(10,10,40,.5)"; g.fillRect(-4, 13, w + 8, 2.5);
        for (let x = 40; x < w; x += 180) { g.fillStyle = "#12122a"; rr(g, x, 26, 8, 22, 4); g.fill(); }
        g.fillStyle = lin(g, 0, 14, 0, h + 20, [[0, "rgba(10,10,40,0)"], [1, "rgba(10,10,40,.5)"]]); g.fillRect(-4, 14, w + 8, h + 8);
        return;
      }
      g.fillStyle = "rgba(10,10,40,.22)"; g.beginPath(); g.ellipse(w / 2, h + 18, w * .42, 5, 0, 0, TAU); g.fill();
      rr(g, 0, 0, w, h, 5); g.save(); g.clip();
      g.fillStyle = "#2e3258"; g.fillRect(0, 0, w, h); tijolos(g, 0, 11, w, h, "#4a5084", 40 + i, 28, 13);
      g.fillStyle = lin(g, 0, 0, 0, 11, [[0, "#a8aed8"], [1, "#6e74aa"]]); g.fillRect(0, 0, w, 11); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(0, 0, w, 2); g.fillStyle = "rgba(10,10,40,.5)"; g.fillRect(0, 11, w, 2);
      g.fillStyle = lin(g, 0, 12, 0, h, [[0, "rgba(10,10,40,0)"], [1, "rgba(10,10,40,.4)"]]); g.fillRect(0, 12, w, h); g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(0, 0, 2.5, h);
      g.restore(); rr(g, 0, 0, w, h, 5); contorno(g, "#4a5084", 2);
      g.fillStyle = "#c9a45a"; [5, w - 5].forEach(x => { C(g, x, h / 2, 2.2); g.fill(); });
      g.fillStyle = "rgba(90,200,140,.6)"; for (let k = 0; k < 3; k++) { C(g, 20 + ((k * 97 + i * 31) % (w - 40)), h + 1, 3 + k); g.fill(); }
    },
    fundo: function(g, est, t) {
      // chamas das tochas (3 quadros) com brilho oscilante
      const ch = [0, 1, 2].map(k => spr("chama" + k, 24, 34, function(c) { c.fillStyle = "#ff8a30"; c.beginPath(); c.moveTo(12, 33); c.bezierCurveTo(-2 + k * 2, 22, 6, 12, 12 + (k - 1) * 3, 1); c.bezierCurveTo(18, 12, 26 - k * 2, 22, 12, 33); c.fill(); c.fillStyle = "#ffd04a"; c.beginPath(); c.moveTo(12, 32); c.bezierCurveTo(6, 25, 8, 18, 12 + (k - 1) * 2, 10); c.bezierCurveTo(16, 18, 18, 25, 12, 32); c.fill(); c.fillStyle = "#fff6c8"; c.beginPath(); c.ellipse(12, 27, 3, 5, 0, 0, TAU); c.fill(); }));
      [60, 1220].forEach(function(x, k) { glow(g, "#ff9a40", x, 590, 100, .5 + .2 * Math.sin(t * 9 + k)); g.drawImage(ch[Math.floor(t * 9 + k * 2) % 3], x - 12, 556); });
      // meteoros riscando o céu
      const me = spr("meteoroCast", 120, 30, function(c) { c.fillStyle = lin(c, 0, 0, 120, 0, [[0, "rgba(255,120,40,0)"], [.7, "rgba(255,150,60,.55)"], [1, "rgba(255,230,160,.95)"]]); c.beginPath(); c.moveTo(0, 15); c.lineTo(104, 10); c.lineTo(104, 20); c.closePath(); c.fill(); c.fillStyle = rad(c, 108, 15, 11, [[0, "#ffffff"], [.5, "#ffc060"], [1, "rgba(255,120,30,0)"]]); c.fillRect(94, 3, 26, 24); });
      [[0, 7.3], [2.6, 9.1], [5.1, 11.2]].forEach(function(q, k) { const u = mod(t + q[0], q[1]) / 1.6; if (u > 1) return; const x = 150 + k * 370 + u * 360, y = 40 + k * 20 + u * 240; g.save(); g.translate(x, y); g.rotate(.62); g.globalAlpha = Math.sin(u * 3.14); g.drawImage(me, -120, -15); g.restore(); }); g.globalAlpha = 1;
      // relâmpagos: clarão no céu + raio
      const per = 7.4, u = mod(t, per), ev = Math.floor(t / per);
      const f = u < .07 ? 1 : u < .13 ? .15 : u < .22 ? .85 : u < .55 ? (.55 - u) / .33 * .45 : 0;
      if (f > .01) {
        g.fillStyle = "rgba(190,200,255," + (.3 * f).toFixed(3) + ")"; g.fillRect(0, -est.deslocY, L, 480 + est.deslocY);
        if (u < .3) { const rr3 = rnd(ev * 7 + 3), x0 = 80 + rr3() * 1100; g.strokeStyle = "rgba(255,255,255," + f + ")"; g.lineWidth = 3; g.lineJoin = "round"; g.beginPath(); let x = x0, y = -est.deslocY; g.moveTo(x, y); while (y < 380) { x += (rr3() - .5) * 60; y += 30 + rr3() * 30; g.lineTo(x, y); } g.stroke(); g.strokeStyle = "rgba(170,190,255," + f * .5 + ")"; g.lineWidth = 9; g.stroke(); }
      }
    }
  };

  // =========================
  // API pública
  // =========================
  function iniciar(cen, H) {
    if (!S || S.id !== cen.id || S.H !== H) { const dy = (H - A) / 2; S = { id: cen.id, H: H, dy: dy, top: -dy, bot: A + dy, sp: {}, pl: {}, cen: cen }; }
    return S;
  }
  // sprite de uma plataforma (com folga para detalhes que passam da caixa: tufos, estalactites, rebites...)
  function spritePlat(p, i, d) {
    const k = i + "_" + p.w + "_" + p.h; let e = S.pl[k];
    if (!e) {
      const pad = d.pad ? d.pad(p) : [14, 14, 14, 14], c = nova(p.w + pad[0] + pad[2], p.h + pad[1] + pad[3]), g = c.getContext("2d");
      g.translate(pad[0], pad[1]); d.plat(g, p, i); e = S.pl[k] = { c: c, l: pad[0], t: pad[1] };
    }
    return e;
  }
  // "aquece" os sprites animados (cria os quadros pré-renderizados) desenhando num canvas minúsculo, para o 1º quadro de jogo não engasgar
  function aquecer(cen, d, altura) {
    const g = nova(8, 8).getContext("2d");
    const est = { t: 0, largura: L, altura: altura, deslocY: S.dy, lavaY: 650, gravidade: 1, avisoInversao: 1, vento: .6, portais: cen.portais, luzes: [{ x: 300, y: 400, r: 175 }, { x: 900, y: 400, r: 175 }],
      bumpers: (cen.bumpers || []).map(function(b) { return { x: b.x, y: b.y, r: b.r, flash: 1 }; }) };
    for (let k = 0; k < 2; k++) {
      const t = k * .73;
      if (d.fundo) d.fundo(g, est, t);
      if (d.anim) cen.plataformas.forEach(function(p, i) { d.anim(g, p, i, est, t); });
      if (d.extra) d.extra(g, est, t);
      if (d.frente) d.frente(g, est, t);
    }
  }
  function prerender(cen, largura, altura) {
    S = null; iniciar(cen, altura);
    const c = nova(largura, altura), g = c.getContext("2d"), d = CEN[cen.id];
    g.translate(0, S.dy);
    d.pre(g, cen);
    // vinheta suave: 4 faixas com gradiente linear só nas bordas (barato) — concentra o olhar no centro
    const v = d.vin == null ? .32 : d.vin, T = S.top, B = S.bot, cv = "rgba(10,8,30,", E1 = 190, E2 = 120;
    function faixa(x0, y0, x1, y1, rx, ry, rw, rh) { g.fillStyle = lin(g, x0, y0, x1, y1, [[0, cv + v + ")"], [.35, cv + v * .4 + ")"], [1, cv + "0)"]]); g.fillRect(rx, ry, rw, rh); }
    faixa(0, 0, E1, 0, 0, T, E1, B - T); faixa(L, 0, L - E1, 0, L - E1, T, E1, B - T); faixa(0, T, 0, T + E2, 0, T, L, E2); faixa(0, B, 0, B - E2, 0, B - E2, L, E2);
    // já gera os sprites das plataformas (evita engasgo no primeiro quadro)
    cen.plataformas.forEach(function(p, i) { spritePlat(p, i, d); });
    aquecer(cen, d, altura);
    if (d.aquecer) d.aquecer(cen);
    return c;
  }
  function desenharFundoAnimado(ctx, cen, est, t) { iniciar(cen, est.altura); const d = CEN[cen.id]; if (d.fundo) d.fundo(ctx, est, t); }
  function desenharPlataformas(ctx, cen, plataformas, est, t) {
    iniciar(cen, est.altura); const d = CEN[cen.id]; S.plats = plataformas;
    for (let i = 0; i < plataformas.length; i++) {
      const p = plataformas[i], e = spritePlat(p, i, d);
      ctx.drawImage(e.c, Math.round(p.x - e.l), Math.round(p.y - e.t));
      if (d.anim) d.anim(ctx, p, i, est, t);
    }
    if (d.extra) d.extra(ctx, est, t);
  }
  function desenharFrente(ctx, cen, est, t) { iniciar(cen, est.altura); const d = CEN[cen.id]; if (d.frente) d.frente(ctx, est, t); }
  function corDestaque(id) { return DEST[id] || "#ffd43b"; }

  return { prerender: prerender, desenharFundoAnimado: desenharFundoAnimado, desenharPlataformas: desenharPlataformas, desenharFrente: desenharFrente, corDestaque: corDestaque };
})();
