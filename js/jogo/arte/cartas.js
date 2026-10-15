"use strict";

// =========================
// ARTE DAS CARTAS DE HABILIDADE (v2): carta com moldura na cor da habilidade + pictograma limpo
// (cel-shading, contorno fino na versão escura da cor). Tudo pré-renderizado por id; por quadro só
// drawImage (leve balanço, brilho que passeia e faísca).
// =========================
const ArteCartas = (function() {
  const TAU = Math.PI * 2, E = 2;

  // ---------- cor ----------
  const cc = {};
  function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return "#" + [0, 1, 2].map(function(i) { return ("0" + Math.round(A[i] + (B[i] - A[i]) * t).toString(16)).slice(-2); }).join("");
  }
  function pal(c) { return cc[c] || (cc[c] = { b: c, s: mix(c, "#2a2166", 0.42), l: mix(c, "#ffffff", 0.62), o: mix(c, "#150e33", 0.6) }); }
  function cv(w, h) { const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  let G = null;
  // e = pixels do canvas por unidade; d = tamanho de exibição por unidade (d = e deixa o sprite 1:1, mais barato)
  function spr(x0, y0, x1, y1, fn, e, d) {
    e = e || E; d = d || 1;
    const c = cv((x1 - x0) * e, (y1 - y0) * e), g = c.getContext("2d");
    g.scale(e, e); g.translate(-x0, -y0);
    const ant = G; G = g; fn(g); G = ant;
    return { c: c, x: x0 * d, y: y0 * d, w: (x1 - x0) * d, h: (y1 - y0) * d };
  }
  const cache = {};
  function sp(k, x0, y0, x1, y1, fn, e, d) { return cache[k] || (cache[k] = spr(x0, y0, x1, y1, fn, e, d)); }
  function brilho(cor) {
    return cache["gl" + cor] || (cache["gl" + cor] = (function() {
      const c = cv(64, 64), g = c.getContext("2d"), r = rgb(cor), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(" + r + ",0.9)"); gr.addColorStop(0.45, "rgba(" + r + ",0.35)"); gr.addColorStop(1, "rgba(" + r + ",0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
    })());
  }

  // ---------- caminhos e peças com cel-shading ----------
  function pR(x, y, w, h, r) {
    return function(g) {
      const q = Math.min(r, w / 2, h / 2);
      g.beginPath(); g.moveTo(x + q, y); g.arcTo(x + w, y, x + w, y + h, q); g.arcTo(x + w, y + h, x, y + h, q); g.arcTo(x, y + h, x, y, q); g.arcTo(x, y, x + w, y, q); g.closePath();
    };
  }
  function pC(x, y, r) { return function(g) { g.beginPath(); g.arc(x, y, r, 0, TAU); }; }
  function pP(a) { return function(g) { g.beginPath(); g.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) g.lineTo(a[i], a[i + 1]); g.closePath(); }; }
  function cel(path, col, k, inner) {
    const g = G, p = pal(col); k = k == null ? 1.6 : k;
    g.save(); path(g); g.fillStyle = p.s; g.fill(); g.clip();
    g.save(); g.translate(-k * 0.7, -k); path(g); g.fillStyle = p.b; g.fill(); g.restore();
    g.save(); g.translate(0.8, 0.8); path(g); g.lineWidth = 1.5; g.strokeStyle = p.l; g.stroke(); g.restore();
    if (inner) inner(g);
    g.restore();
    path(g); g.lineWidth = 1.4; g.lineJoin = "round"; g.strokeStyle = p.o; g.stroke();
  }
  function fl(path, col, al) { path(G); G.globalAlpha = al === undefined ? 1 : al; G.fillStyle = col; G.fill(); G.globalAlpha = 1; }
  function trc(fn, w, col, al) { const g = G; fn(g); g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = w; g.strokeStyle = col; g.globalAlpha = al === undefined ? 1 : al; g.stroke(); g.globalAlpha = 1; }
  // traço grosso com volume: contorno, sombra e luz (pictogramas de linha)
  function tubo(fn, w, col) {
    const p = pal(col);
    trc(fn, w + 3, p.o); trc(fn, w, p.s); G.save(); G.translate(-w * 0.1, -w * 0.18); trc(fn, w * 0.72, p.b); G.restore();
  }
  function est(cx, cy, Ro, Ri, n, rot) { const a = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? Ri : Ro, t = rot + i * Math.PI / n; a.push(cx + Math.cos(t) * r, cy + Math.sin(t) * r); } return a; }

  // =========================================================
  // PICTOGRAMAS (caixa 40x40 centrada na origem). c = cor da carta, l = cor clara do símbolo
  // =========================================================
  const GL = {
    escudo: function(c, l) {
      const f = function(k) { return function(g) { g.beginPath(); g.moveTo(0, -16 * k); g.lineTo(13 * k, -11 * k); g.lineTo(13 * k, 1 * k); g.bezierCurveTo(13 * k, 9 * k, 7 * k, 14 * k, 0, 17 * k); g.bezierCurveTo(-7 * k, 14 * k, -13 * k, 9 * k, -13 * k, 1 * k); g.lineTo(-13 * k, -11 * k); g.closePath(); }; };
      cel(f(1), l, 2); cel(f(0.62), c, 1.2, function() { trc(function(g) { g.beginPath(); g.moveTo(0, -8); g.lineTo(0, 10); }, 1.6, "#ffffff", 0.45); });
    },
    rapidez: function(c, l) { cel(pP([6, -18, -10, 3, -2, 3, -6, 18, 10, -4, 2, -4]), l, 1.8); },
    cura: function(c, l) {
      cel(pP([-5, -15, 5, -15, 5, -5, 15, -5, 15, 5, 5, 5, 5, 15, -5, 15, -5, 5, -15, 5, -15, -5, -5, -5]), l, 2, function() { fl(pC(0, 0, 3.6), c, 0.9); });
    },
    furia: function(c, l) {
      const f = function(k, y) {
        return function(g) {
          g.save(); g.translate(0, y); g.scale(k, k);
          g.beginPath(); g.moveTo(0, 17); g.bezierCurveTo(-8, 17, -13, 11, -12, 3); g.bezierCurveTo(-11, -2, -9, -5, -9, -12); g.bezierCurveTo(-6, -9, -5, -7, -4, -4);
          g.bezierCurveTo(-3, -10, -1, -15, 2, -20); g.bezierCurveTo(3, -13, 9, -10, 11, -1); g.bezierCurveTo(13, 9, 8, 17, 0, 17); g.closePath(); g.restore();
        };
      };
      cel(f(1, 0), l, 2); cel(f(0.52, 7), mix(c, "#ffffff", 0.15), 1);
    },
    tiro_duplo: function(c, l) {
      for (const x of [-7, 7]) {
        cel(function(g) { g.beginPath(); g.moveTo(x - 5, 15); g.lineTo(x - 5, -4); g.quadraticCurveTo(x - 5, -13, x, -17); g.quadraticCurveTo(x + 5, -13, x + 5, -4); g.lineTo(x + 5, 15); g.closePath(); }, l, 1.6,
          function() { fl(pR(x - 6, 5, 12, 12, 0), c, 0.9); });
      }
    },
    mini: function(c, l) {
      trc(function(g) { g.beginPath(); g.arc(0, 1, 15, 0, TAU); g.setLineDash([3, 4]); }, 1.8, l, 0.8); G.setLineDash([]);
      cel(pC(0, 1, 5.5), l, 1.4);
      for (let i = 0; i < 4; i++) { G.save(); G.translate(0, 1); G.rotate(i * Math.PI / 2); cel(pP([10, 0, 16, -4, 16, 4]), l, 0.6); G.restore(); }
    },
    congelar: function(c, l) {
      const f = function(g) {
        g.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = i * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
          g.moveTo(-ca * 16, -sa * 16); g.lineTo(ca * 16, sa * 16);
          for (const s of [-1, 1]) { const bx = ca * 10 * s, by = sa * 10 * s; g.moveTo(bx, by); g.lineTo(bx - ca * 4.6 * s + sa * 4.6, by - sa * 4.6 * s - ca * 4.6); g.moveTo(bx, by); g.lineTo(bx - ca * 4.6 * s - sa * 4.6, by - sa * 4.6 * s + ca * 4.6); }
        }
      };
      tubo(f, 2.8, l); cel(pP(est(0, 0, 4.4, 4.4, 3, 0.52)), l, 0.8);
    },
    fantasma: function(c, l) {
      cel(function(g) { g.beginPath(); g.moveTo(-12, 15); g.lineTo(-12, -3); g.bezierCurveTo(-12, -19, 12, -19, 12, -3); g.lineTo(12, 15); g.quadraticCurveTo(9, 9, 6, 15); g.quadraticCurveTo(3, 9, 0, 15); g.quadraticCurveTo(-3, 9, -6, 15); g.quadraticCurveTo(-9, 9, -12, 15); g.closePath(); }, l, 2);
      const esc = mix(c, "#150e33", 0.78);
      for (const x of [-4.6, 4.6]) { G.beginPath(); G.ellipse(x, -3.5, 2.3, 3.4, 0, 0, TAU); G.fillStyle = esc; G.fill(); }
      G.beginPath(); G.ellipse(0, 3.4, 2, 1.5, 0, 0, TAU); G.fillStyle = esc; G.fill();
    },
    reflexo: function(c, l) {
      tubo(function(g) { g.beginPath(); g.moveTo(-10, 14); g.lineTo(-10, -1); g.bezierCurveTo(-10, -14, 10, -14, 10, -1); g.lineTo(10, 3); }, 5.2, l);
      cel(pP([10, 16, 18, 4, 2, 4]), l, 1);
    },
    super_pulo: function(c, l) {
      tubo(function(g) { g.beginPath(); g.moveTo(-8, 14); g.lineTo(8, 10); g.lineTo(-8, 6); g.lineTo(8, 2); g.lineTo(-8, -2); g.lineTo(0, -4); }, 3.8, l);
      cel(pR(-12, 15, 24, 4.4, 2.2), l, 0.8); cel(pP([0, -19, 9, -9, 3.4, -9, 3.4, -4, -3.4, -4, -3.4, -9, -9, -9]), l, 1.2);
    },
    chuva: function(c, l) {
      const met = function(x, y, r) {
        const d = 0.707;
        cel(pP([x - d * r, y + d * r, x + d * r, y - d * r, x - d * r * 3.6, y - d * r * 3.6]), mix(c, "#ffffff", 0.35), 0.8);
        cel(pC(x, y, r), l, 1.2);
      };
      met(-3, -3, 6); met(9, 8, 4.4); met(-10, 9, 3.6);
    },
    municao: function(c, l) {
      tubo(function(g) { g.beginPath(); for (let i = 0; i <= 48; i++) { const t = i / 48 * TAU, d = 1 + Math.sin(t) * Math.sin(t), x = 17 * Math.cos(t) / d, y = 25 * Math.sin(t) * Math.cos(t) / d; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); }, 5.4, l);
    }
  };

  // =========================================================
  // CARTA: moldura elegante + painel escuro + pictograma
  // =========================================================
  function cartaSpr(id) {
    const cor = CARTA[id].cor, clara = mix(cor, "#ffffff", 0.7);
    return sp("cd" + id, -26, -35, 26, 35, function() {
      // borda branca grossa com contorno escuro (cara de carta colecionável; destaca em qualquer mapa)
      const borda = pR(-25.2, -34.2, 50.4, 68.4, 9);
      trc(borda, 2.6, "#1a1238"); fl(borda, "#ffffff"); fl(pR(-25.2, 10, 50.4, 24.2, 9), mix(cor, "#c9d2ee", 0.75), 0.6);
      cel(pR(-23, -32, 46, 64, 7), cor, 2.4, function() { fl(pR(-23, -32, 46, 18, 0), mix(cor, "#ffffff", 0.2), 0.5); });
      const painel = pR(-18.5, -27.5, 37, 55, 4.5);
      fl(painel, mix(cor, "#14102e", 0.82));
      G.save(); painel(G); G.clip(); fl(pR(-20, -29, 40, 24, 0), mix(cor, "#14102e", 0.7), 0.7); G.restore();
      trc(painel, 1, mix(cor, "#ffffff", 0.35), 0.8);
      G.drawImage(brilho(cor), -20, -23, 40, 40);
      G.save(); G.translate(0, -3); G.scale(1.08, 1.08); GL[id](cor, clara); G.restore();
      // ornamentos: losango embaixo e pontinhos nos cantos
      cel(pP([0, 19.5, 4, 23, 0, 26.5, -4, 23]), mix(cor, "#ffffff", 0.55), 0.6);
      for (const sx of [-1, 1]) { fl(pC(sx * 12.5, 23, 1.5), mix(cor, "#ffffff", 0.5), 0.9); fl(pC(sx * 14.5, -24, 1.6), mix(cor, "#ffffff", 0.6), 0.9); }
    }, 1.5, 1);
  }
  // faixas de brilho que passeiam (frames compartilhados entre as cartas)
  function brilhoFrame(i) {
    return sp("sh" + i, -26, -35, 26, 35, function() {
      G.save(); pR(-23, -32, 46, 64, 7)(G); G.clip(); G.translate(-30 + i * 12, 0); G.rotate(0.5);
      fl(pR(0, -60, 7, 120, 0), "#ffffff", 0.5); fl(pR(10, -60, 3, 120, 0), "#ffffff", 0.35); G.restore();
    });
  }

  function glow(cor) { return sp("g" + cor, -44, -50, 44, 50, function() { G.drawImage(brilho(cor), -44, -50, 88, 100); }, 1, 1); }

  function desenharCarta(ctx, id, x, y, escala, t) {
    if (!GL[id]) return;
    const s = cartaSpr(id), e = escala === undefined ? 1 : escala;
    if (e <= 0.01) return;
    const giro = Math.cos(t * 2.2);
    ctx.save(); ctx.translate(x, y);
    const g = glow(CARTA[id].cor); ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 4); ctx.drawImage(g.c, g.x * e, g.y * e, g.w * e, g.h * e); ctx.globalAlpha = 1;
    ctx.scale(e * (0.93 + 0.07 * giro), e);
    ctx.drawImage(s.c, s.x, s.y, s.w, s.h);
    const ph = (t * 0.7) % 2.2;                      // faixa de brilho a cada ~3 s
    if (ph < 0.8) { const f = brilhoFrame(Math.min(5, (ph / 0.8 * 6) | 0)); ctx.drawImage(f.c, f.x, f.y, f.w, f.h); }
    const k = Math.abs(Math.sin(t * 3.1)), st = sp("cst", -6, -6, 6, 6, function() { fl(pP(est(0, 0, 5.8, 1.3, 4, 0)), "#ffffff"); });
    ctx.translate(18, -26); ctx.scale(0.4 + k, 0.4 + k); ctx.drawImage(st.c, st.x, st.y, st.w, st.h);
    ctx.restore();
  }

  // ícone para o HUD: medalhão na cor da carta com o pictograma
  function icone(ctx, id, x, y, tam) {
    if (!GL[id]) return;
    const cor = CARTA[id].cor, s = sp("ic" + id, -22, -22, 22, 22, function() {
      cel(pC(0, 0, 20.5), cor, 2.6); trc(pC(0, 0, 16.6), 1.2, mix(cor, "#ffffff", 0.5), 0.7);
      G.scale(0.78, 0.78); GL[id](cor, "#ffffff");
    });
    ctx.drawImage(s.c, x - tam / 2, y - tam / 2, tam, tam);
  }

  function aquecer() {
    const g = cv(2, 2).getContext("2d");
    CARTAS.forEach(function(c) { cartaSpr(c.id); icone(g, c.id, 0, 0, 2); brilho(c.cor); });
    for (let i = 0; i < 6; i++) brilhoFrame(i);
  }

  return { desenharCarta: desenharCarta, icone: icone, aquecer: aquecer };
})();
