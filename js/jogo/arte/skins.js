"use strict";

// =========================
// ARTE DAS SKINS (v3, v18: mesmo acabamento "bala de goma" do corpo clássico e sprites em 2x com a câmera em pé)
// CORPO: material/estampa da esfera (sprite em cache por skin + cor + raio, mesma âncora do corpo clássico do ArteBolinha).
// ACESSÓRIO: sprite em cache (um por id + raio) desenhado por cima do rosto, com leve balanço por quadro.
// Tudo é pré-renderizado; por quadro só drawImage + poucos traços. Luz sempre de cima-esquerda.
//   ArteSkins.corpo(id, cor, r, q)         -> { c: canvas, m: âncora }   (mesmo tamanho do corpo clássico; q = resolução, opcional)
//   ArteSkins.rosto(id, cor)               -> paleta do rosto (pálpebra, anel do olho, tinta da boca) para essa skin
//   ArteSkins.acessorio(ctx, id, x, y, r, olharX, escalaX, escalaY, t, q)   (q = resolução do sprite, opcional)
//   ArteSkins.miniatura(ctx, idCorpo, idAcessorio, cor, x, y, r, t)
// Depende de ArteBolinha só em tempo de chamada (paleta, desenhar, brilhoEsfera, espQ), então carrega antes dele.
// =========================

const ArteSkins = (function() {
  var PI = Math.PI, PI2 = PI * 2;
  var ESC = [26, 13, 51], AZ = [48, 28, 120], BR = [255, 255, 255];
  var FIXA = { futebol: "#f1f3f5", melancia: "#2f9e44", doce: "#f783ac", gelo: "#a5d8ff", lava: "#ff6b1a", diamante: "#99e9f2", galaxia: "#5f3dc4", ouro: "#fcc419" };

  // ---------- utilidades ----------
  function mxA(a, b, q) { return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q]; }
  function css(a, al) { return (al === undefined ? "rgb(" : "rgba(") + Math.round(a[0]) + "," + Math.round(a[1]) + "," + Math.round(a[2]) + (al === undefined ? ")" : "," + al + ")"); }
  function mx(a, b, q, al) { return css(mxA(a, b, q), al); }
  function hexA(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function cv(w, h) { var c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sm(a, b, x) { var t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rng(s) { return function() { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function h3(i, j, k) { var n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); }
  function vn(x, y, z) {   // ruído de valor 3D (a esfera inteira sem emenda)
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    function l(a, b, t) { return a + (b - a) * t; }
    return l(l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), fx), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), fx), fy),
             l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), fx), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), fx), fy), fz);
  }
  function fbm(x, y, z) { return vn(x, y, z) * 0.56 + vn(x * 2.1, y * 2.1, z * 2.1) * 0.29 + vn(x * 4.3, y * 4.3, z * 4.3) * 0.15; }
  function zonaRosto(x, y) { return 1 - sm(0.5, 0.95, Math.hypot(x / 0.78, (y - 0.06) / 0.62)); }   // 1 no rosto, 0 fora (padrões se acalmam aqui)
  function pal(cor) { return ArteBolinha.paleta(cor); }
  var QS = 1;   // resolução do sprite sendo criado (1 ou 2): o traço fica igual na tela em qualquer resolução
  function lw(R) { return ArteBolinha.espQ(R, QS); }

  // pixel a pixel numa esfera: fn(x, y, z, o) preenche o = [r,g,b,a]; x,y,z = normal (y para baixo)
  function px(R, fn) {
    var S = (R + Math.ceil(4 * QS)) * 2, c = cv(S, S), g = c.getContext("2d"), im = g.createImageData(S, S), d = im.data, m = S / 2, o = [0, 0, 0, 255], n = 0, i, j, x, y, q, z, l;
    for (j = 0; j < S; j++) for (i = 0; i < S; i++, n += 4) {
      x = (i + 0.5 - m) / R; y = (j + 0.5 - m) / R; q = x * x + y * y;
      if (q > 1.1) continue;
      if (q > 1) { l = 1 / Math.sqrt(q); x *= l; y *= l; z = 0; } else z = Math.sqrt(1 - q);
      o[3] = 255; fn(x, y, z, o);
      d[n] = o[0]; d[n + 1] = o[1]; d[n + 2] = o[2]; d[n + 3] = o[3];
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  // ---------- projeção numa esfera com leve inclinação (a gente vê um pouco por cima) ----------
  var TILT = 0.3, CT = Math.cos(TILT), ST = Math.sin(TILT);
  function vw(X, Y, Z) { return [X, Z * ST - Y * CT, Z * CT + Y * ST]; }          // mundo (Y para cima) -> tela (y para baixo, z = profundidade)
  function ll(lon, lat) { return vw(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)); }
  function ponto(g, R, p, i) {                                                   // pontos atrás da esfera vão para a borda
    var x = p[0], y = p[1];
    if (p[2] < 0) { var l = Math.hypot(x, y) || 1; x /= l; y /= l; }
    if (i) g.lineTo(x * R, y * R); else g.moveTo(x * R, y * R);
  }
  function visivel(pts) { for (var i = 0; i < pts.length; i++) if (pts[i][2] > -0.02) return true; return false; }
  function poli(g, R, pts) { if (!visivel(pts)) return false; g.beginPath(); for (var i = 0; i < pts.length; i++) ponto(g, R, pts[i], i); g.closePath(); return true; }
  // retalho entre longitudes/latitudes (graus)
  function retalho(g, R, lo0, lo1, la0, la1, n, onda) {
    var pts = [], i, d = PI / 180, f = onda || function() { return 0; };
    for (i = 0; i <= n; i++) pts.push(ll((lo0 + (lo1 - lo0) * i / n + f(la0)) * d, la0 * d));
    for (i = 1; i <= 4; i++) pts.push(ll((lo1 + f(la0 + (la1 - la0) * i / 4)) * d, (la0 + (la1 - la0) * i / 4) * d));
    for (i = n - 1; i >= 0; i--) pts.push(ll((lo0 + (lo1 - lo0) * i / n + f(la1)) * d, la1 * d));
    for (i = 3; i >= 1; i--) pts.push(ll((lo0 + f(la0 + (la1 - la0) * i / 4)) * d, (la0 + (la1 - la0) * i / 4) * d));
    return poli(g, R, pts);
  }
  function linha(g, R, pts) { if (!visivel(pts)) return; g.beginPath(); for (var i = 0; i < pts.length; i++) ponto(g, R, pts[i], i); g.stroke(); }
  function paralelo(g, R, lat, n) { var p = [], d = PI / 180; for (var i = -n; i <= n; i++) p.push(ll(i / n * 90 * d, lat * d)); linha(g, R, p); }
  function meridiano(g, R, lon, n) { var p = [], d = PI / 180; for (var i = -n; i <= n; i++) p.push(ll(lon * d, i / n * 90 * d)); linha(g, R, p); }

  // ---------- esfera: albedo (padrão) + sombra em meia-lua + luz + brilho + luz de borda + contorno ----------
  // o: alb(g) padrão (dentro do recorte), mid(g) emissivo (por cima da sombra), sh/lt (cores da sombra e da luz),
  //    rim, ct (contorno), sp (força do brilho especular, 0 = sem), sp2 (ponto), cx (contorno da sombra pontos)
  function esfera(g, R, o) {
    var w = lw(R);
    g.save(); g.beginPath(); g.arc(0, 0, R, 0, PI2); g.clip();
    if (o.alb) o.alb(g);
    if (o.sh) {   // meio-tom (crescente larga, metade da força) + sombra
      g.beginPath(); g.rect(-R - 2, -R - 2, 2 * R + 4, 2 * R + 4); g.moveTo(-R * 0.07 + R * 0.97, -R * 0.09); g.arc(-R * 0.07, -R * 0.09, R * 0.97, 0, PI2);
      g.fillStyle = o.sh; g.globalAlpha = 0.5; g.fill("evenodd"); g.globalAlpha = 1;
      g.beginPath(); g.rect(-R - 2, -R - 2, 2 * R + 4, 2 * R + 4); g.moveTo(-R * 0.11 + R * 0.93, -R * 0.13); g.arc(-R * 0.11, -R * 0.13, R * 0.93, 0, PI2);
      g.fillStyle = o.sh; g.fill("evenodd");
    }
    if (o.lt) {   // luz suave em degradê (em cima à esquerda)
      var gl = g.createRadialGradient(-R * 0.32, -R * 0.38, 0, -R * 0.26, -R * 0.3, R * 0.78);
      gl.addColorStop(0, o.lt); gl.addColorStop(0.45, o.lt); gl.addColorStop(1, "rgba(255,255,255,0)");
      g.beginPath(); g.arc(0, 0, R, 0, PI2); g.fillStyle = gl; g.fill();
    }
    var gb = g.createLinearGradient(0, R * 0.64, 0, R * 1.02);                       // luz rebatida do chão
    gb.addColorStop(0, "rgba(255,255,255,0)"); gb.addColorStop(1, o.rim);
    g.globalAlpha = 0.45; g.beginPath(); g.ellipse(R * 0.1, R * 0.98, R * 0.78, R * 0.34, 0, 0, PI2); g.fillStyle = gb; g.fill(); g.globalAlpha = 1;
    if (o.mid) o.mid(g);
    g.restore();
    g.lineCap = "round";
    g.beginPath(); g.arc(0, 0, R - w - R * 0.04, PI * 0.08, PI * 0.46);
    g.strokeStyle = o.rim; g.lineWidth = Math.max(1.2 * QS, R * 0.06); g.globalAlpha = 0.95; g.stroke();
    g.beginPath(); g.arc(0, 0, R - w - R * 0.04, PI * 0.5, PI * 0.62); g.lineWidth = Math.max(QS, R * 0.04); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
    var sp = o.sp === undefined ? 0.9 : o.sp;
    if (sp > 0) ArteBolinha.brilhoEsfera(g, R, sp);
    g.beginPath(); g.arc(0, 0, R - w / 2, 0, PI2); g.strokeStyle = o.ct; g.lineWidth = w; g.stroke();
  }
  var SOMBRA = "rgba(48,28,120,0.40)", LUZ = "rgba(255,255,255,0.3)";
  function estrela4(g, x, y, a, b, rot) {   // brilho de 4 pontas
    g.beginPath();
    for (var i = 0; i < 8; i++) { var an = rot + i * PI / 4, rr = i % 2 ? b : a; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    g.closePath(); g.fill();
  }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ---------- corpos ----------
  var MAT = {};

  // listras: 4 faixas claras bem marcadas (fio escuro na borda), o rosto fica liso
  MAT.listras = function(g, R, P) {
    var c = P.rgb, claro = mx(c, BR, 0.74), fio = mx(c, AZ, 0.32);
    esfera(g, R, { sh: SOMBRA, lt: LUZ, rim: P.rim, ct: P.contorno, alb: function(g) {
      g.fillStyle = P.base; g.fillRect(-R, -R, 2 * R, 2 * R);
      g.lineWidth = Math.max(QS, R * 0.035); g.lineJoin = "round";
      [[62, 79], [33, 49], [-22, -38], [-51, -67]].forEach(function(b) {
        if (retalho(g, R, -100, 100, b[0], b[1], 18)) { g.fillStyle = claro; g.fill(); g.strokeStyle = fio; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1; }
      });
    } });
  };

  // pintas: bolinhas claras com fio escuro na testa, nos lados e embaixo (posição na tela, longe dos olhos, boca e bochechas)
  var PINTAS = [[0.06, -0.68, 0.14], [0.5, -0.56, 0.13], [-0.8, 0.06, 0.12], [0.84, -0.02, 0.11], [-0.38, 0.74, 0.14], [0.3, 0.76, 0.13],
    [0.72, 0.56, 0.1], [-0.76, 0.5, 0.1], [-0.24, -0.9, 0.08]];
  MAT.pintas = function(g, R, P) {
    var c = P.rgb, claro = mx(c, BR, 0.72), sombra = mx(c, AZ, 0.42);
    esfera(g, R, { sh: SOMBRA, lt: LUZ, rim: P.rim, ct: P.contorno, alb: function(g) {
      g.fillStyle = P.base; g.fillRect(-R, -R, 2 * R, 2 * R);
      g.lineWidth = Math.max(QS, R * 0.03);
      PINTAS.forEach(function(q) {
        var x = q[0], y = q[1], d = Math.hypot(x, y), z = Math.sqrt(Math.max(0, 1 - d * d)), rd = q[2], k = 0.4 + 0.6 * z;   // achata perto da borda
        g.save(); g.translate(x * R, y * R); g.rotate(Math.atan2(y, x));
        g.beginPath(); g.ellipse(R * 0.012, R * 0.018, R * rd * k, R * rd, 0, 0, PI2); g.fillStyle = sombra; g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1;
        g.beginPath(); g.ellipse(0, 0, R * rd * k, R * rd, 0, 0, PI2); g.fillStyle = claro; g.fill();
        g.strokeStyle = sombra; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
        g.restore();
      });
    } });
  };

  MAT.xadrez = function(g, R, P) {
    var c = P.rgb, claro = mx(c, BR, 0.7), escuro = mx(c, AZ, 0.08);
    esfera(g, R, { sh: SOMBRA, lt: LUZ, rim: P.rim, ct: P.contorno, alb: function(g) {
      g.fillStyle = P.base; g.fillRect(-R, -R, 2 * R, 2 * R);
      for (var i = -4; i < 4; i++) for (var j = -3; j < 3; j++) {
        if (retalho(g, R, i * 30 + 15, i * 30 + 45, j * 30, j * 30 + 30, 6)) { g.fillStyle = (i + j) & 1 ? claro : escuro; g.fill(); }
      }
    } });
  };

  // camuflado: manchas grandes e nítidas em 3 tons (verde escuro, marrom, cáqui); o rosto fica mais limpo
  function fbm2(x, y, z) { return vn(x, y, z) * 0.72 + vn(x * 2.3, y * 2.3, z * 2.3) * 0.28; }
  MAT.camuflado = function(g, R, P) {
    var c = P.rgb, A = mxA(c, ESC, 0.06), B = mxA(mxA(c, [28, 72, 26], 0.62), ESC, 0.12), C = mxA(c, [112, 76, 38], 0.62), D = mxA(c, [236, 226, 166], 0.5);
    var img = px(R, function(x, y, z, o) {
      var f = zonaRosto(x, y), q = A;
      q = mxA(q, B, sm(0.5, 0.53, fbm2(x * 1.8 + 3, y * 1.8 + 1, z * 1.8 + 5) - f * 0.12));
      q = mxA(q, C, sm(0.57, 0.6, fbm2(x * 2 + 9, y * 2 + 2, z * 2 + 7) - f * 0.14));
      q = mxA(q, D, sm(0.66, 0.69, fbm2(x * 2.4 + 4, y * 2.4 + 6, z * 2.4 + 1) - f * 0.2));
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
    });
    esfera(g, R, { sh: SOMBRA, lt: LUZ, rim: P.rim, ct: P.contorno, alb: function(g) { g.drawImage(img, -img.width / 2, -img.height / 2); } });
  };

  // bola de futebol: icosaedro truncado de verdade (12 pentágonos + 20 hexágonos)
  var FUT = null;
  function futGeo() {
    if (FUT) return FUT;
    var f = (1 + Math.sqrt(5)) / 2, base = [[0, 1, 3 * f], [1, 2 + f, 2 * f], [f, 2, 2 * f + 1]], v = [], i, j, k;
    base.forEach(function(b) {
      for (var s = 0; s < 8; s++) {
        var t = [b[0] * (s & 1 ? -1 : 1), b[1] * (s & 2 ? -1 : 1), b[2] * (s & 4 ? -1 : 1)];
        [[t[0], t[1], t[2]], [t[1], t[2], t[0]], [t[2], t[0], t[1]]].forEach(function(q) {
          for (var m = 0; m < v.length; m++) if (Math.abs(v[m][0] - q[0]) + Math.abs(v[m][1] - q[1]) + Math.abs(v[m][2] - q[2]) < 1e-6) return;
          v.push(q);
        });
      }
    });
    var L = Math.sqrt(1 + 9 * f * f), edges = [], pent = [];
    for (i = 0; i < v.length; i++) for (j = i + 1; j < v.length; j++)
      if (Math.abs(Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]) - 2) < 1e-6) edges.push([i, j]);
    var ic = [];   // 12 vértices do icosaedro: (0,±1,±f) e permutações cíclicas
    [-1, 1].forEach(function(s1) { [-1, 1].forEach(function(s2) { ic.push([0, s1, s2 * f], [s1, s2 * f, 0], [s2 * f, 0, s1]); }); });
    ic.forEach(function(u) {
      var un = Math.hypot(u[0], u[1], u[2]), cand = [];
      for (var q = 0; q < v.length; q++) cand.push({ q: q, d: (v[q][0] * u[0] + v[q][1] * u[1] + v[q][2] * u[2]) / (L * un) });
      cand.sort(function(a, b) { return b.d - a.d; });
      var five = cand.slice(0, 5).map(function(e) { return e.q; });
      // ordena em volta do eixo u
      var nu = [u[0] / un, u[1] / un, u[2] / un], ref = Math.abs(nu[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      var e1 = [nu[1] * ref[2] - nu[2] * ref[1], nu[2] * ref[0] - nu[0] * ref[2], nu[0] * ref[1] - nu[1] * ref[0]], e1n = Math.hypot(e1[0], e1[1], e1[2]);
      e1 = [e1[0] / e1n, e1[1] / e1n, e1[2] / e1n];
      var e2 = [nu[1] * e1[2] - nu[2] * e1[1], nu[2] * e1[0] - nu[0] * e1[2], nu[0] * e1[1] - nu[1] * e1[0]];
      five.sort(function(a, b) {
        function ang(k) { return Math.atan2(v[k][0] * e2[0] + v[k][1] * e2[1] + v[k][2] * e2[2], v[k][0] * e1[0] + v[k][1] * e1[1] + v[k][2] * e1[2]); }
        return ang(a) - ang(b);
      });
      pent.push(five);
    });
    for (i = 0; i < v.length; i++) v[i] = [v[i][0] / L, v[i][1] / L, v[i][2] / L];
    return (FUT = { v: v, edges: edges, pent: pent });
  }
  function rot3(p, a, b, c) {   // gira em Y, X e Z
    var x = p[0], y = p[1], z = p[2], t;
    t = x * Math.cos(a) + z * Math.sin(a); z = -x * Math.sin(a) + z * Math.cos(a); x = t;
    t = y * Math.cos(b) - z * Math.sin(b); z = y * Math.sin(b) + z * Math.cos(b); y = t;
    t = x * Math.cos(c) - y * Math.sin(c); y = x * Math.sin(c) + y * Math.cos(c); x = t;
    return [x, y, z];
  }
  function arcoEsf(a, b, n) {   // pontos entre dois vetores unitários, na esfera
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t, l = Math.hypot(x, y, z);
      out.push([x / l, y / l, z / l]);
    }
    return out;
  }
  var FUT_ROT = [3.15, 2.1, 3.3];
  MAT.futebol = function(g, R, P) {
    var G = futGeo(), r = FUT_ROT;
    var V = G.v.map(function(p) { var q = rot3(p, r[0], r[1], r[2]); return q; });
    function T(q) { return vw(q[0], -q[1], q[2]); }
    esfera(g, R, { sh: "rgba(52,48,120,0.36)", lt: "rgba(255,255,255,0.1)", rim: "rgb(190,215,245)", ct: "rgb(62,66,92)", alb: function(g) {
      g.fillStyle = "#f4f5f8"; g.fillRect(-R, -R, 2 * R, 2 * R);
      g.strokeStyle = "#aeb5c7"; g.lineWidth = Math.max(1, R * 0.035); g.lineJoin = "round"; g.lineCap = "round";
      G.edges.forEach(function(e) { linha(g, R, arcoEsf(V[e[0]], V[e[1]], 4).map(T)); });
      G.pent.forEach(function(f) {
        var pts = [];
        for (var i = 0; i < 5; i++) pts = pts.concat(arcoEsf(V[f[i]], V[f[(i + 1) % 5]], 4).slice(0, 4).map(T));
        if (poli(g, R, pts)) { g.fillStyle = "#1f2237"; g.fill(); g.strokeStyle = "#1f2237"; g.stroke(); }
      });
    } });
  };

  MAT.melancia = function(g, R, P) {
    var claro = "#58bf5b", escuro = "#1c6b35";
    esfera(g, R, { sh: "rgba(20,50,110,0.36)", lt: "rgba(255,255,255,0.18)", rim: "rgb(170,240,200)", ct: "#154a27", alb: function(g) {
      g.fillStyle = claro; g.fillRect(-R, -R, 2 * R, 2 * R); g.fillStyle = escuro;
      for (var i = 0; i < 12; i++) {
        var lo = i * 30 - 165;
        var onda = function(la) { return Math.sin(la * 0.07 + i * 1.7) * 6 + Math.sin(la * 0.19 + i) * 2.5; };
        // listra: larga no equador, fina nos polos
        var pts = [], d = PI / 180, n = 16, k;
        for (k = 0; k <= n; k++) { var la = -88 + 176 * k / n, w = 6.5 * Math.cos(la * d) + 0.8; pts.push(ll((lo + onda(la) - w) * d, la * d)); }
        for (k = n; k >= 0; k--) { var la2 = -88 + 176 * k / n, w2 = 6.5 * Math.cos(la2 * d) + 0.8; pts.push(ll((lo + onda(la2) + w2) * d, la2 * d)); }
        if (poli(g, R, pts)) g.fill();
      }
    } });
  };

  MAT.robo = function(g, R, P) {
    var c = P.rgb, aco = mxA(mxA(c, [170, 180, 200], 0.42), BR, 0.06), linhaC = mx(aco, ESC, 0.55), luzC = mx(aco, BR, 0.55);
    esfera(g, R, { sh: "rgba(34,28,110,0.42)", lt: "rgba(255,255,255,0.24)", rim: "rgb(190,230,255)", ct: mx(aco, ESC, 0.72), alb: function(g) {
      g.fillStyle = css(aco); g.fillRect(-R, -R, 2 * R, 2 * R);
      g.lineWidth = Math.max(1, R * 0.04); g.lineCap = "round";
      function costura(f) { g.strokeStyle = luzC; g.save(); g.translate(R * 0.012, R * 0.02); f(); g.restore(); g.strokeStyle = linhaC; f(); }
      costura(function() { paralelo(g, R, 56, 18); paralelo(g, R, -48, 18); meridiano(g, R, -66, 12); meridiano(g, R, 66, 12); });
      // painel do visor (tela escura onde ficam os olhos)
      rrect(g, -R * 0.76, -R * 0.52, R * 1.52, R * 0.8, R * 0.3); g.fillStyle = "#1a2240"; g.fill();
      g.lineWidth = Math.max(1.4, R * 0.05); g.strokeStyle = linhaC; g.stroke();
      g.save(); rrect(g, -R * 0.76, -R * 0.52, R * 1.52, R * 0.8, R * 0.3); g.clip();
      g.fillStyle = "rgba(120,170,255,0.16)"; g.beginPath(); g.moveTo(-R * 0.8, R * 0.3); g.lineTo(-R * 0.1, -R * 0.6); g.lineTo(R * 0.1, -R * 0.6); g.lineTo(-R * 0.6, R * 0.3); g.fill();
      g.restore();
      // rebites
      [[-66, 56], [66, 56], [-66, -48], [66, -48], [0, 74]].forEach(function(q) {
        var p = ll(q[0] * PI / 180, q[1] * PI / 180);
        if (p[2] < 0.15) return;
        g.beginPath(); g.arc(p[0] * R, p[1] * R + R * 0.012, R * 0.052, 0, PI2); g.fillStyle = linhaC; g.fill();
        g.beginPath(); g.arc(p[0] * R - R * 0.008, p[1] * R - R * 0.008, R * 0.04, 0, PI2); g.fillStyle = luzC; g.fill();
      });
      [-1, 1].forEach(function(sd) {   // placas laterais (orelhas)
        g.beginPath(); g.arc(sd * R * 0.9, R * 0.02, R * 0.13, 0, PI2); g.fillStyle = linhaC; g.fill();
        g.beginPath(); g.arc(sd * R * 0.9, R * 0.02, R * 0.07, 0, PI2); g.fillStyle = luzC; g.fill();
      });
    }, mid: function(g) {   // luzinha de status
      var x = R * 0.5, y = -R * 0.74;
      g.beginPath(); g.arc(x, y, R * 0.13, 0, PI2); g.fillStyle = "rgba(90,255,200,0.28)"; g.fill();
      g.beginPath(); g.arc(x, y, R * 0.075, 0, PI2); g.fillStyle = "#3df2b0"; g.fill();
      g.beginPath(); g.arc(x - R * 0.02, y - R * 0.025, R * 0.03, 0, PI2); g.fillStyle = "#e8fff6"; g.fill();
    } });
  };

  MAT.doce = function(g, R, P) {
    var rosa = "#f783ac", creme = "#fff0f6", esc = "#e8589a";
    var eixo = (function() { var a = [0.34, 0.5, 0.8], l = Math.hypot(a[0], a[1], a[2]); a = [a[0] / l, a[1] / l, a[2] / l];
      var b = [0, 1, 0], d = a[1]; b = [-a[0] * d, 1 - a[1] * d, -a[2] * d]; l = Math.hypot(b[0], b[1], b[2]); b = [b[0] / l, b[1] / l, b[2] / l];
      var c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; return [a, b, c]; })();
    function sp(psi, al) {   // ponto da espiral: ângulo polar psi do eixo, azimute al
      var a = eixo[0], b = eixo[1], c = eixo[2], s = Math.sin(psi), co = Math.cos(psi), ca = Math.cos(al), sa = Math.sin(al);
      return [co * a[0] + s * (ca * b[0] + sa * c[0]), co * a[1] + s * (ca * b[1] + sa * c[1]), co * a[2] + s * (ca * b[2] + sa * c[2])];
    }
    esfera(g, R, { sh: "rgba(150,30,110,0.34)", lt: "rgba(255,255,255,0.18)", rim: "rgb(255,214,232)", ct: "#a62d66", sp: 1, alb: function(g) {
      g.fillStyle = rosa; g.fillRect(-R, -R, 2 * R, 2 * R);
      var N = 5, n = 22, k, i;
      for (k = 0; k < N; k++) {
        var pts = [], base = k * PI2 / N;
        for (i = 0; i <= n; i++) { var ps = 0.02 + i / n * 2.4; pts.push(sp(ps, base + ps * 1.6)); }
        for (i = n; i >= 0; i--) { var ps2 = 0.02 + i / n * 2.4; pts.push(sp(ps2, base + ps2 * 1.6 + PI / N * 0.9)); }
        pts = pts.map(function(p) { return [p[0], p[1], p[2]]; });
        g.beginPath(); for (i = 0; i < pts.length; i++) ponto(g, R, pts[i], i); g.closePath(); g.fillStyle = creme; g.fill();
      }
    } });
  };

  // metal espelhado (estilizado): céu com gradiente, linha de horizonte curva e inclinada, chão escuro com luz rebatida embaixo
  function metal(R, E) {
    return px(R, function(x, y, z, o) {
      var yh = E.h - 0.3 * x * x + 0.1 * x, t = (yh - y) / (yh + 1), q;
      if (y < yh) {
        q = mxA(E.hor, E.mid, sm(0, 0.4, t)); q = mxA(q, E.top, sm(0.35, 1, t));
        q = mxA(q, BR, (1 - sm(0, 0.05, yh - y)) * 0.55);                      // fio de luz no horizonte
      } else {
        q = mxA(E.gnd, E.bnc, sm(0.08, 0.5, (y - yh) / (1 - yh)));
        q = mxA(q, E.hor, (1 - sm(0, 0.04, y - yh)) * 0.35);
      }
      var j = (x + 0.62) * 0.9 + (y + 0.15) * 1.3;                              // faixa de reflexo diagonal (janela)
      if (j > 0.1 && j < 0.34 && y < yh - 0.1) q = mxA(q, BR, 0.2 * sm(0.1, 0.16, j) * (1 - sm(0.28, 0.34, j)));
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
    });
  }
  MAT.cromado = function(g, R, P) {
    var c = P.rgb;
    var img = metal(R, { h: 0.55, top: mxA(c, ESC, 0.62), mid: mxA(mxA(c, [190, 200, 220], 0.4), BR, 0.12), hor: mxA(c, BR, 0.94), gnd: mxA(c, ESC, 0.82), bnc: mxA(mxA(c, [255, 210, 170], 0.4), BR, 0.15) });
    esfera(g, R, { sh: "rgba(30,22,110,0.22)", lt: "rgba(255,255,255,0.1)", rim: "rgb(210,240,255)", ct: mx(c, ESC, 0.74), sp: 0.95, alb: function(g) { g.drawImage(img, -img.width / 2, -img.height / 2); } });
  };
  MAT.ouro = function(g, R, P) {
    var img = metal(R, { h: 0.55, top: [168, 100, 6], mid: [252, 196, 25], hor: [255, 244, 186], gnd: [96, 50, 6], bnc: [226, 150, 22] });
    esfera(g, R, { sh: "rgba(90,30,40,0.3)", lt: "rgba(255,255,230,0.12)", rim: "rgb(255,236,150)", ct: "#8a5207", sp: 0.95, alb: function(g) { g.drawImage(img, -img.width / 2, -img.height / 2); },
      mid: function(g) { g.fillStyle = "rgba(255,255,255,0.95)"; estrela4(g, -R * 0.58, -R * 0.4, R * 0.2, R * 0.04, 0); } });
  };

  MAT.gelo = function(g, R, P) {
    function poly(pts, fill) { g.beginPath(); pts.forEach(function(q, i) { g[i ? "lineTo" : "moveTo"](q[0] * R, q[1] * R); }); g.closePath(); g.fillStyle = fill; g.fill(); }
    esfera(g, R, { sh: "rgba(30,70,170,0.34)", lt: "rgba(255,255,255,0.22)", rim: "rgb(235,250,255)", ct: "#3a78b5", sp: 0.95, alb: function(g) {
      var gr = g.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.1, 0, 0, R * 1.05);
      gr.addColorStop(0, "rgba(226,246,255,0.8)"); gr.addColorStop(0.65, "rgba(150,208,248,0.88)"); gr.addColorStop(1, "rgba(104,176,236,0.97)");
      g.fillStyle = gr; g.fillRect(-R, -R, 2 * R, 2 * R);
      poly([[-0.95, -0.12], [-0.4, -0.9], [-0.12, -0.6], [-0.66, 0.02]], "rgba(255,255,255,0.3)");     // facetas internas
      poly([[0.2, 0.95], [0.85, 0.42], [0.95, 0.72], [0.5, 1.05]], "rgba(255,255,255,0.26)");
      poly([[0.62, -0.7], [0.95, -0.28], [0.74, -0.14]], "rgba(255,255,255,0.18)");
      poly([[-0.9, 0.5], [-0.5, 0.95], [-0.8, 0.9]], "rgba(70,130,210,0.22)");
      g.lineCap = "round"; g.lineJoin = "round";
      var rach = [[[0.5, 0.55], [0.7, 0.36], [0.76, 0.12], [0.98, -0.08]], [[0.5, 0.55], [0.26, 0.7], [0.12, 0.98]], [[0.5, 0.55], [0.62, 0.8], [0.7, 1.02]],
        [[0.7, 0.36], [0.9, 0.44], [1.02, 0.4]], [[-0.78, 0.4], [-0.62, 0.24], [-0.7, 0.04]], [[-0.78, 0.4], [-0.92, 0.5]], [[0.26, 0.7], [0.1, 0.62]]];
      [["rgba(50,110,190,0.6)", 1.2, 0.012], ["rgba(255,255,255,0.95)", 0.75, -0.004]].forEach(function(e) {
        g.strokeStyle = e[0]; g.lineWidth = Math.max(0.8, R * 0.03 * e[1]);
        rach.forEach(function(ln) { g.beginPath(); ln.forEach(function(q, i) { g[i ? "lineTo" : "moveTo"](q[0] * R, (q[1] + e[2]) * R); }); g.stroke(); });
      });
      g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = Math.max(1, R * 0.03);       // bolhas presas no gelo
      [[-0.42, 0.66, 0.075], [-0.58, 0.82, 0.04], [-0.3, 0.84, 0.035]].forEach(function(q) { g.beginPath(); g.arc(q[0] * R, q[1] * R, q[2] * R, 0, PI2); g.stroke(); });
    }, mid: function(g) { g.fillStyle = "#fff"; estrela4(g, R * 0.6, -R * 0.52, R * 0.15, R * 0.03, 0); } });
  };

  MAT.neon = function(g, R, P) {
    var c = P.rgb, N = mxA(c, BR, 0.1), nucleo = mx(c, BR, 0.7), casca = mx(c, ESC, 0.88);
    function luzLinha(f) {
      g.lineCap = "round";
      [[R * 0.17, 0.14, css(N)], [R * 0.085, 0.38, css(N)], [Math.max(1.4, R * 0.04), 1, nucleo]].forEach(function(e) { g.globalAlpha = e[1]; g.strokeStyle = e[2]; g.lineWidth = e[0]; f(); });
      g.globalAlpha = 1;
    }
    esfera(g, R, { sh: "rgba(0,0,20,0.4)", lt: "rgba(255,255,255,0.13)", rim: css(N), ct: mx(c, ESC, 0.5), sp: 0.5, alb: function(g) { g.fillStyle = casca; g.fillRect(-R, -R, 2 * R, 2 * R); },
      mid: function(g) {
        luzLinha(function() { paralelo(g, R, 52, 18); paralelo(g, R, -24, 18); meridiano(g, R, -58, 12); meridiano(g, R, 58, 12); });
        [[-58, 52], [58, 52], [-58, -24], [58, -24]].forEach(function(q) {   // nós
          var p = ll(q[0] * PI / 180, q[1] * PI / 180);
          if (p[2] < 0.2) return;
          g.beginPath(); g.arc(p[0] * R, p[1] * R, R * 0.085, 0, PI2); g.fillStyle = css(N, 0.35); g.fill();
          g.beginPath(); g.arc(p[0] * R, p[1] * R, R * 0.045, 0, PI2); g.fillStyle = nucleo; g.fill();
        });
      } });
  };

  MAT.lava = function(g, R, P) {
    var sem = [], r = rng(11), n = 20, i;
    for (i = 0; i < n; i++) { var y = 1 - (i + 0.5) * 2 / n, ra = Math.sqrt(1 - y * y), th = i * 2.39996 + r() * 0.7; sem.push([Math.cos(th) * ra, y + (r() - 0.5) * 0.1, Math.sin(th) * ra, r()]); }
    function campo(x, y, z) {     // plaquinhas da crosta: distância até a borda entre as duas sementes mais próximas
      var d1 = 9, d2 = 9, k = 0, j, d;
      for (j = 0; j < n; j++) { var s = sem[j]; d = Math.sqrt(Math.max(0, 2 - 2 * (x * s[0] + y * s[1] + z * s[2]))); if (d < d1) { d2 = d1; d1 = d; k = j; } else if (d < d2) d2 = d; }
      return [d2 - d1, k];
    }
    var rocha = px(R, function(x, y, z, o) {
      var f = campo(x, y, z), tone = sem[f[1]][3], ruido = fbm(x * 4, y * 4, z * 4);
      var q = mxA([46, 28, 42], [72, 46, 58], tone * 0.8 + ruido * 0.3 - 0.15);
      q = mxA(q, [150, 52, 22], (1 - sm(0.03, 0.2, f[0])) * 0.55);
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
    });
    var brasa = px(R, function(x, y, z, o) {
      var f = campo(x, y, z), e = f[0] + (fbm(x * 6, y * 6, z * 6) - 0.5) * 0.05, face = zonaRosto(x, y), a = (1 - sm(0.055, 0.115, e)) * (1 - face * 0.92), q;
      var calor = 1 - sm(0.0, 0.05, e);
      q = mxA([255, 96, 20], [255, 224, 110], calor);
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2]; o[3] = a * 255;
    });
    esfera(g, R, { sh: "rgba(20,5,30,0.45)", lt: "rgba(255,255,255,0.1)", rim: "rgb(255,150,80)", ct: "#1a0b10", sp: 0.55, alb: function(g) { g.drawImage(rocha, -rocha.width / 2, -rocha.height / 2); },
      mid: function(g) { g.drawImage(brasa, -brasa.width / 2, -brasa.height / 2); } });
  };

  MAT.diamante = function(g, R, P) {
    var L = [-0.45, -0.55, 0.7], ln = Math.hypot(L[0], L[1], L[2]), d = PI / 180, i;
    function pol(r, a) { return [Math.cos(a * d) * r, Math.sin(a * d) * r]; }
    var T = [], S = [], G = [];
    for (i = 0; i < 8; i++) { T.push(pol(0.46, 22.5 + 45 * i)); S.push(pol(0.64, 45 * i)); G.push(pol(1.2, 22.5 + 45 * i)); }
    var F = [T];
    for (i = 0; i < 8; i++) {
      F.push([T[(i + 7) % 8], T[i], S[i]]);                         // estrelas
      F.push([S[i], T[i], S[(i + 1) % 8], G[i]]);                   // losangos
      F.push([S[i], G[(i + 7) % 8], G[i]]);                         // borda
    }
    esfera(g, R, { sh: "rgba(20,60,150,0.26)", lt: "rgba(255,255,255,0.1)", rim: "rgb(230,252,255)", ct: "#2a8aa0", sp: 0.7, alb: function(g) {
      g.fillStyle = "#99e9f2"; g.fillRect(-R, -R, 2 * R, 2 * R);
      F.forEach(function(f, k) {
        var cx = 0, cy = 0; f.forEach(function(q) { cx += q[0]; cy += q[1]; }); cx /= f.length; cy /= f.length;
        var rr = Math.min(0.97, Math.hypot(cx, cy)), nz = Math.sqrt(1 - rr * rr), b = (cx * L[0] + cy * L[1] + nz * L[2]) / ln;
        b = cl(b * 1.1 + ((k * 7) % 5 - 2) * 0.035, 0, 1);
        var col = b < 0.55 ? mxA([74, 176, 214], [153, 233, 242], b / 0.55) : mxA([153, 233, 242], [244, 253, 255], (b - 0.55) / 0.45);
        g.beginPath(); f.forEach(function(q, j) { g[j ? "lineTo" : "moveTo"](q[0] * R, q[1] * R); }); g.closePath();
        g.fillStyle = css(col); g.fill(); g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = Math.max(0.9, R * 0.022); g.lineJoin = "round"; g.stroke();
      });
    }, mid: function(g) { g.fillStyle = "#fff"; estrela4(g, -R * 0.55, -R * 0.55, R * 0.2, R * 0.04, 0); g.globalAlpha = 0.9; estrela4(g, R * 0.62, R * 0.3, R * 0.11, R * 0.025, 0); g.globalAlpha = 1; } });
  };

  MAT.galaxia = function(g, R, P) {
    var C0 = [20, 8, 62], C1 = [95, 61, 196], MG = [226, 78, 214], CY = [60, 160, 255], Nn = [0.55, 0.75, 0.3], nl = Math.hypot(Nn[0], Nn[1], Nn[2]);
    var img = px(R, function(x, y, z, o) {
      var f = zonaRosto(x, y), b = (x * Nn[0] + y * Nn[1] + z * Nn[2]) / nl, n1 = fbm(x * 2.2 + 5, y * 2.2, z * 2.2 + 3), n2 = fbm(x * 3 + 1, y * 3 + 7, z * 3);
      var q = mxA(C0, C1, cl(fbm(x * 1.4, y * 1.4 + 2, z * 1.4) * 1.1 - 0.15, 0, 1) * 0.8);
      var neb = Math.exp(-b * b / 0.2) * sm(0.28, 0.75, n1) * (1 - f * 0.65);
      q = mxA(q, mxA(MG, CY, sm(0.35, 0.65, n2)), Math.min(1, neb * 1.25));
      q = mxA(q, BR, sm(0.5, 0.95, neb * n2) * 0.25);
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
    });
    esfera(g, R, { sh: "rgba(5,0,40,0.4)", lt: "rgba(200,180,255,0.1)", rim: "rgb(160,190,255)", ct: "#120830", sp: 0.55, alb: function(g) { g.drawImage(img, -img.width / 2, -img.height / 2); },
      mid: function(g) {
        var r = rng(5), k, x, y, s;
        for (k = 0; k < 46; k++) {
          var a = r() * PI2, rr = Math.sqrt(r()) * 0.94; x = Math.cos(a) * rr; y = Math.sin(a) * rr; s = 0.012 + r() * r() * 0.03;
          if (Math.abs(x) < 0.62 && y > -0.5 && y < 0.46) { if (s > 0.02) continue; }
          g.globalAlpha = 0.55 + r() * 0.45; g.fillStyle = "#fff";
          if (s > 0.032) estrela4(g, x * R, y * R, s * R * 3.4, s * R * 0.6, 0); else { g.beginPath(); g.arc(x * R, y * R, Math.max(0.6, s * R), 0, PI2); g.fill(); }
        }
        g.globalAlpha = 1;
        // planetinha com anel
        g.save(); g.translate(R * 0.56, R * 0.6); g.rotate(-0.35);
        g.beginPath(); g.arc(0, 0, R * 0.13, 0, PI2); g.fillStyle = "#ffa94d"; g.fill();
        g.beginPath(); g.arc(R * 0.015, R * 0.02, R * 0.115, -0.4, PI * 1.1); g.strokeStyle = "rgba(190,70,40,0.5)"; g.lineWidth = R * 0.05; g.stroke();
        g.beginPath(); g.ellipse(0, 0, R * 0.25, R * 0.065, 0, 0, PI2); g.strokeStyle = "#ffe3a8"; g.lineWidth = Math.max(1.2, R * 0.032); g.stroke();
        g.beginPath(); g.arc(0, 0, R * 0.13, PI, PI2); g.fillStyle = "#ffa94d"; g.fill();
        g.restore();
      } });
  };

  var cache = {};
  function criar(id, cor, R, q) {
    var pd = Math.ceil(4 * q), S = (R + pd) * 2, c = cv(S, S), g = c.getContext("2d");
    g.translate(S / 2, S / 2);
    QS = q; MAT[id](g, R, pal(cor)); QS = 1;
    return { c: c, m: S / 2 };
  }
  // r = raio do sprite em pixels (já multiplicado por q)
  function corpo(id, cor, r, q) {
    var R = Math.max(8, Math.round(r)), fx = FIXA[id], k;
    q = q || 1;
    if (id === "classico" || !MAT[id]) return ArteBolinha.corpoBase(cor || "#4dabf7", R, q);
    cor = fx || cor || "#4dabf7"; k = id + "|" + cor + "|" + R + "|" + q;
    return cache[k] || (cache[k] = criar(id, cor, R, q));
  }

  // paleta do rosto por skin: lid = cor da pálpebra (igual ao corpo ali), contorno = linha da pálpebra, anel = contorno fino do olho, tinta = boca
  // iris = reflexo colorido na pupila; bochecha = cor do rubor (null = sem)
  var ROSTOS = {
    futebol: { lid: "#e9ebf1", contorno: "#585d7e", anel: "#585d7e", iris: "#4a5378", bochecha: "rgb(255,122,150)" },
    melancia: { lid: "#4fb552", contorno: "#154a27", anel: "#154a27", iris: "#2f7a3d", bochecha: "rgb(255,96,120)" },
    robo: { lid: "#232c52", contorno: "#0d1228", anel: "#0d1228", iris: "#2a8f9a", bochecha: null },
    doce: { lid: "#f98fb7", contorno: "#a62d66", anel: "#a62d66", iris: "#a62d66", bochecha: "rgb(232,40,110)" },
    gelo: { lid: "#cfeaff", contorno: "#3f7fb8", anel: "#3f7fb8", iris: "#3a6fb0", bochecha: "rgb(255,140,190)" },
    lava: { lid: "#3a2230", contorno: "#14090f", anel: "#14090f", tinta: "#ffd9a0", iris: "#a8401c", bochecha: "rgb(255,110,40)" },
    diamante: { lid: "#c8f5fa", contorno: "#2b8da0", anel: "#2b8da0", iris: "#2b8da0", bochecha: "rgb(255,140,190)" },
    galaxia: { lid: "#3b238a", contorno: "#150a38", anel: "#150a38", tinta: "#f1e9ff", iris: "#6b4fd8", bochecha: "rgb(240,90,200)" },
    ouro: { lid: "#fcc419", contorno: "#8a5207", anel: "#8a5207", iris: "#8a5207", bochecha: "rgb(255,120,80)" }
  };
  var rostos = {};
  function rosto(id, cor) {
    var k = id + "|" + cor, r = rostos[k];
    if (r) return r;
    var P = pal(cor || "#4dabf7"), c = P.rgb;
    r = ROSTOS[id];
    if (!r) {
      if (id === "cromado") r = { lid: mx(c, BR, 0.5), contorno: mx(c, ESC, 0.74), anel: mx(c, ESC, 0.74), iris: P.iris };
      else if (id === "neon") r = { lid: mx(c, ESC, 0.86), contorno: mx(c, BR, 0.2), anel: mx(c, ESC, 0.7), tinta: mx(c, BR, 0.62), iris: P.iris, bochecha: mx(c, BR, 0.25) };
      else if (id === "camuflado") r = { lid: mx(c, ESC, 0.16), contorno: P.contorno, anel: P.contorno, iris: P.iris };
      else r = { lid: P.lid, contorno: P.contorno, anel: P.contorno, iris: P.iris };
    }
    return (rostos[k] = r);
  }

  // ---------- acessórios ----------
  // Cada um é desenhado UMA vez num sprite (id + raio), em unidades de R (g já escalado), origem = centro da cabeça, y para baixo.
  // Mesmo cel-shading dos corpos: base + sombra azulada (cópia deslocada) + fio de luz + contorno escuro da própria cor.
  var AC = {}, DIN = {}, CARA = { oculos: 1, mascara_ninja: 1 }, VIRA = { bone: 1 };
  function elp(cx, cy, rx, ry, rot) { rot = rot || 0; return function(g) { g.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); g.ellipse(cx, cy, rx, ry, rot, 0, PI2); }; }
  function rr(x, y, w, h, r) { return function(g) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }; }
  function par(g, f) { f(g, 1); g.save(); g.scale(-1, 1); f(g, -1); g.restore(); }       // desenha o lado direito e o espelho
  function forma(g, w, pth, P, o) {
    o = o || {};
    var d = o.d === undefined ? 0.075 : o.d;
    g.beginPath(); pth(g); g.fillStyle = o.fill || P.base; g.fill();
    g.save(); g.beginPath(); pth(g); g.clip();
    if (d) {
      g.beginPath(); g.rect(-3, -3, 6, 6); g.save(); g.translate(-d, -d * 1.2); pth(g); g.restore(); g.fillStyle = P.sombra; g.fill("evenodd");
      g.beginPath(); g.save(); g.translate(d * 0.6, d * 0.75); pth(g); g.restore();
      g.strokeStyle = P.brilho; g.lineWidth = w * 0.8; g.globalAlpha = 0.85; g.stroke(); g.globalAlpha = 1;
    }
    if (o.det) o.det(g);
    g.restore();
    if (!o.semBorda) { g.beginPath(); pth(g); g.strokeStyle = P.contorno; g.lineWidth = w; g.lineJoin = "round"; g.lineCap = "round"; g.stroke(); }
  }
  function est5(g, cx, cy, ro, ri) { g.beginPath(); for (var i = 0; i < 10; i++) { var a = -PI / 2 + i * PI / 5, q = i % 2 ? ri : ro; g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } g.closePath(); }
  function tracoCurvo(g, w, cor, x0, y0, cx, cy, x1, y1, al) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.strokeStyle = cor; g.lineWidth = w; g.lineCap = "round"; g.globalAlpha = al || 1; g.stroke(); g.globalAlpha = 1; }
  function fora(g, f) { g.save(); g.beginPath(); g.rect(-3, -3, 6, 6); g.arc(0, 0, 0.985, 0, PI2, true); g.clip("evenodd"); f(); g.restore(); }   // só o que sai da cabeça (parece nascer por trás dela)
  function dentroCabeca(g, f) { g.save(); g.beginPath(); g.arc(0, 0, 1, 0, PI2); g.clip(); f(); g.restore(); }

  // boné: cúpula + aba virada para o lado do olhar
  AC.bone = function(g, w) {
    var A = pal("#3b4fd0"), B = pal("#2a39a0");
    forma(g, w, function(g) { g.moveTo(-0.95, -0.55); g.bezierCurveTo(-1.0, -1.1, -0.55, -1.3, 0, -1.3); g.bezierCurveTo(0.55, -1.3, 1.0, -1.1, 0.95, -0.55); g.quadraticCurveTo(0, -0.33, -0.95, -0.55); g.closePath(); }, A, { d: 0.11, det: function(g) {
      tracoCurvo(g, w * 0.7, A.contorno, 0, -1.3, -0.4, -0.95, -0.34, -0.4, 0.5);
      tracoCurvo(g, w * 0.7, A.contorno, 0, -1.3, 0.4, -0.95, 0.34, -0.4, 0.5);
    } });
    forma(g, w, function(g) { g.moveTo(-0.22, -0.55); g.bezierCurveTo(0.4, -0.68, 1.05, -0.64, 1.38, -0.42); g.bezierCurveTo(1.05, -0.3, 0.4, -0.34, -0.22, -0.42); g.closePath(); }, B, { d: 0.05 });
    g.fillStyle = "#fff"; est5(g, 0, -0.9, 0.17, 0.075); g.fill(); g.strokeStyle = A.contorno; g.lineWidth = w * 0.7; g.lineJoin = "round"; g.stroke();
    forma(g, w, elp(0, -1.3, 0.08, 0.06), B, { d: 0.02 });
  };

  // óculos: armação escura, lentes claras com reflexo (os olhos aparecem através)
  AC.oculos = function(g, w) {
    var F = pal("#2c2358");
    [-1, 1].forEach(function(s) {
      var x0 = s > 0 ? 0.045 : -0.555, wl = 0.51, y0 = -0.4, hl = 0.72, rc = 0.2, l = rr(x0, y0, wl, hl, rc);
      g.beginPath(); l(g); g.fillStyle = "rgba(170,225,255,0.14)"; g.fill();
      g.save(); g.beginPath(); l(g); g.clip();
      g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 0.06; g.lineCap = "round";
      g.beginPath(); g.moveTo(x0 + 0.1, y0 + 0.3); g.lineTo(x0 + 0.26, y0 + 0.08); g.stroke();
      g.lineWidth = 0.028; g.beginPath(); g.moveTo(x0 + 0.2, y0 + 0.37); g.lineTo(x0 + 0.29, y0 + 0.24); g.stroke();
      g.restore();
      g.beginPath(); g.moveTo(s * 0.58, -0.14); g.quadraticCurveTo(s * 0.8, -0.2, s * 1.0, -0.1);                              // haste
      g.strokeStyle = F.contorno; g.lineWidth = 0.085 + w; g.lineCap = "round"; g.stroke(); g.strokeStyle = F.base; g.lineWidth = 0.085; g.stroke();
      g.beginPath(); l(g); g.strokeStyle = F.contorno; g.lineWidth = 0.08 + w * 1.4; g.lineJoin = "round"; g.stroke(); g.strokeStyle = F.base; g.lineWidth = 0.08; g.stroke();
      g.beginPath(); g.moveTo(x0 + rc, y0 - 0.005); g.lineTo(x0 + wl - rc, y0 - 0.005); g.strokeStyle = F.brilho; g.lineWidth = 0.022; g.lineCap = "round"; g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
    });
    g.beginPath(); g.moveTo(-0.06, -0.2); g.quadraticCurveTo(0, -0.27, 0.06, -0.2); g.strokeStyle = F.contorno; g.lineWidth = 0.09 + w; g.stroke(); g.strokeStyle = F.base; g.lineWidth = 0.09; g.stroke();
  };

  // orelhas de gato numa tiara
  AC.orelhas_gato = function(g, w) {
    var P = pal("#3a2d66"), I = pal("#ff8fb8");
    fora(g, function() { par(g, function(g) {
      forma(g, w, function(g) { g.moveTo(0.16, -0.9); g.quadraticCurveTo(0.3, -1.38, 0.74, -1.56); g.quadraticCurveTo(1.04, -1.0, 1.0, -0.36); g.closePath(); }, P, { d: 0.08 });
      forma(g, w, function(g) { g.moveTo(0.36, -0.98); g.quadraticCurveTo(0.46, -1.26, 0.72, -1.38); g.quadraticCurveTo(0.9, -1.0, 0.9, -0.6); g.closePath(); }, I, { d: 0.05, semBorda: 1 });
    }); });
    forma(g, w, function(g) { g.arc(0, 0, 1.06, PI + 0.38, PI2 - 0.38); g.arc(0, 0, 0.9, PI2 - 0.38, PI + 0.38, true); g.closePath(); }, P, { d: 0.05 });
  };

  // fone de ouvido: arco + conchas
  AC.fone = function(g, w) {
    var A = pal("#3b3f78"), C = pal("#ff4f8b");
    forma(g, w, function(g) { g.arc(0, 0, 1.2, PI + 0.06, PI2 - 0.06); g.arc(0, 0, 1.04, PI2 - 0.06, PI + 0.06, true); g.closePath(); }, A, { d: 0.05 });
    par(g, function(g) {
      forma(g, w, rr(0.84, -0.3, 0.4, 0.74, 0.18), C, { d: 0.09 });
      forma(g, w, rr(0.9, -0.2, 0.18, 0.54, 0.09), pal("#ffc2d9"), { d: 0.03, semBorda: 1 });
    });
  };

  // cartola com fita
  AC.cartola = function(g, w) {
    var H = pal("#2d2b55"), F = pal("#e64980"), O = pal("#ffd43b");
    forma(g, w, elp(0, -0.7, 0.98, 0.21, 0), H, { d: 0.07 });
    forma(g, w, function(g) { g.moveTo(-0.6, -0.72); g.lineTo(-0.54, -1.56); g.quadraticCurveTo(0, -1.74, 0.54, -1.56); g.lineTo(0.6, -0.72); g.quadraticCurveTo(0, -0.52, -0.6, -0.72); g.closePath(); }, H, { d: 0.1, det: function(g) {
      g.beginPath(); g.moveTo(-0.7, -0.98); g.quadraticCurveTo(0, -0.78, 0.7, -0.98); g.lineTo(0.7, -0.7); g.quadraticCurveTo(0, -0.48, -0.7, -0.7); g.closePath();
      g.fillStyle = F.base; g.fill(); g.strokeStyle = F.contorno; g.lineWidth = w * 0.8; g.stroke();
    } });
    forma(g, w, function(g) { g.moveTo(-0.54, -1.56); g.quadraticCurveTo(0, -1.4, 0.54, -1.56); g.quadraticCurveTo(0, -1.74, -0.54, -1.56); g.closePath(); }, pal("#4a4784"), { d: 0 });
    forma(g, w, rr(-0.11, -0.9, 0.22, 0.2, 0.04), O, { d: 0.04, det: function(g) { g.fillStyle = F.base; g.fillRect(-0.05, -0.85, 0.1, 0.1); } });
  };

  function osso() { var P = Object.create(pal("#ecd8a6")); P.sombra = "rgb(206,166,108)"; P.contorno = "#6e4a2b"; P.brilho = "#fff6dc"; return P; }
  // chifre: curva de Bézier cúbica com espessura que afina até a ponta; devolve {pth, ponto(s, lado)}
  function corno(P, w0) {
    var n = 16, L = [], Rr = [], i, s, m, x, y, dx, dy, l, nx, ny, e;
    function bz(s, k) { m = 1 - s; return m * m * m * P[0][k] + 3 * m * m * s * P[1][k] + 3 * m * s * s * P[2][k] + s * s * s * P[3][k]; }
    for (i = 0; i <= n; i++) {
      s = i / n; x = bz(s, 0); y = bz(s, 1);
      dx = bz(Math.min(1, s + 0.02), 0) - bz(Math.max(0, s - 0.02), 0); dy = bz(Math.min(1, s + 0.02), 1) - bz(Math.max(0, s - 0.02), 1); l = Math.hypot(dx, dy) || 1;
      nx = -dy / l; ny = dx / l; e = w0 * Math.pow(1 - s, 0.85);
      L.push([x + nx * e, y + ny * e]); Rr.push([x - nx * e, y - ny * e]);
    }
    return { pth: function(g) { g.moveTo(L[0][0], L[0][1]); for (var i = 1; i <= n; i++) g.lineTo(L[i][0], L[i][1]); for (i = n; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]); g.closePath(); },
      anel: function(g, k, w) { g.beginPath(); g.moveTo(L[k][0], L[k][1]); g.lineTo(Rr[k][0], Rr[k][1]); g.stroke(); } };
  }
  function aneisCorno(g, w, c, P) { return function(g) { g.strokeStyle = P.contorno; g.lineWidth = w * 0.8; g.globalAlpha = 0.5; g.lineCap = "round"; c.anel(g, 4); c.anel(g, 7); c.anel(g, 10); g.globalAlpha = 1; }; }
  // chifres de marfim
  AC.chifres = function(g, w) {
    var P = osso();
    var c = corno([[0.4, -0.8], [1.0, -0.95], [1.2, -1.35], [0.98, -1.8]], 0.23);
    fora(g, function() { par(g, function(g) { forma(g, w, c.pth, P, { d: 0.09, det: aneisCorno(g, w, c, P) }); }); });
  };

  // coroa de flores
  function flor(g, w, cx, cy, fr, cor, miolo) {
    var P = pal(cor), i, a;
    g.save(); g.translate(cx, cy);
    g.beginPath(); for (i = 0; i < 5; i++) { a = -PI / 2 + i * PI2 / 5; g.moveTo(Math.cos(a) * fr * 0.58 + fr * 0.5, Math.sin(a) * fr * 0.58); g.arc(Math.cos(a) * fr * 0.58, Math.sin(a) * fr * 0.58, fr * 0.5, 0, PI2); }
    g.strokeStyle = P.contorno; g.lineWidth = w * 1.9; g.lineJoin = "round"; g.stroke();
    g.fillStyle = P.base; g.fill();
    g.beginPath(); for (i = 0; i < 5; i++) { a = -PI / 2 + i * PI2 / 5; g.moveTo(Math.cos(a) * fr * 0.7 + fr * 0.3, Math.sin(a) * fr * 0.7 + fr * 0.05); g.arc(Math.cos(a) * fr * 0.7, Math.sin(a) * fr * 0.7 + fr * 0.05, fr * 0.3, 0, PI2); }
    g.globalAlpha = 0.5; g.fillStyle = P.sombra; g.fill(); g.globalAlpha = 1;
    g.beginPath(); for (i = 0; i < 5; i++) { a = -PI / 2 + i * PI2 / 5; g.moveTo(Math.cos(a) * fr * 0.6 - fr * 0.14 + fr * 0.14, Math.sin(a) * fr * 0.6 - fr * 0.16); g.arc(Math.cos(a) * fr * 0.6 - fr * 0.14, Math.sin(a) * fr * 0.6 - fr * 0.16, fr * 0.14, 0, PI2); }
    g.fillStyle = P.brilho; g.globalAlpha = 0.6; g.fill(); g.globalAlpha = 1;
    forma(g, w * 0.8, elp(0, 0, fr * 0.3, fr * 0.3), pal(miolo), { d: fr * 0.08 });
    g.restore();
  }
  AC.tiara_flores = function(g, w) {
    var verde = pal("#4cae4f"), n, a, i;
    var an = [-168, -143, -118, -90, -62, -37, -12], cs = ["#ff8fb8", "#ffffff", "#ffd43b", "#ff6b9d", "#c8a2ff", "#ffffff", "#74c0fc"], fr = [0.15, 0.15, 0.16, 0.2, 0.16, 0.15, 0.15];
    g.beginPath(); g.arc(0, 0, 1.0, PI + 0.2, PI2 - 0.2); g.strokeStyle = verde.contorno; g.lineWidth = 0.12 + w * 1.6; g.lineCap = "round"; g.stroke();
    g.strokeStyle = verde.base; g.lineWidth = 0.12; g.stroke();
    for (i = 0; i < 6; i++) {            // folhas entre as flores
      a = (an[i] + an[i + 1]) / 2 * PI / 180;
      [-1, 1].forEach(function(o) {
        var cx = Math.cos(a) * 1.03, cy = Math.sin(a) * 1.03, rot = a + PI / 2 + o * 0.9;
        forma(g, w * 0.8, elp(cx + Math.cos(rot) * 0.1, cy + Math.sin(rot) * 0.1, 0.17, 0.075, rot), verde, { d: 0.03 });
      });
    }
    for (i = 0; i < 7; i++) { a = an[i] * PI / 180; flor(g, w, Math.cos(a) * 1.0, Math.sin(a) * 1.0, fr[i], cs[i], i === 3 ? "#ff922b" : "#ffd43b"); }
  };

  // máscara ninja: pano no rosto + faixa na testa com plaqueta (as pontas balançam, ver DIN)
  AC.mascara_ninja = function(g, w, R, S) {
    var P = pal("#2a3159"), M = pal("#b9c2dc");
    dentroCabeca(g, function() {
      forma(g, w, function(g) { g.moveTo(-1.2, 0.52); g.quadraticCurveTo(-0.6, 0.33, -0.22, 0.29); g.quadraticCurveTo(0, 0.17, 0.22, 0.29); g.quadraticCurveTo(0.6, 0.33, 1.2, 0.52); g.lineTo(1.2, 1.3); g.lineTo(-1.2, 1.3); g.closePath(); }, P, { d: 0.12, semBorda: 1, det: function(g) { g.beginPath(); g.arc(0, 0, 1 - w / 2, 0, PI2); g.strokeStyle = P.contorno; g.lineWidth = w; g.stroke(); g.beginPath(); g.arc(0, 0, 1 - w * 1.6, PI * 0.08, PI * 0.42); g.strokeStyle = P.rim; g.lineWidth = w * 1.4; g.lineCap = "round"; g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1; } });
      tracoCurvo(g, w, P.contorno, -1.2, 0.52, -0.6, 0.33, -0.22, 0.29); tracoCurvo(g, w, P.contorno, -0.22, 0.29, 0, 0.17, 0.22, 0.29); tracoCurvo(g, w, P.contorno, 0.22, 0.29, 0.6, 0.33, 1.2, 0.52);
      forma(g, w, function(g) { g.moveTo(-1.2, -0.72); g.quadraticCurveTo(0, -0.52, 1.2, -0.72); g.lineTo(1.2, -0.52); g.quadraticCurveTo(0, -0.32, -1.2, -0.52); g.closePath(); }, P, { d: 0.05 });
    });
    forma(g, w, rr(-0.25, -0.65, 0.5, 0.25, 0.06), M, { d: 0.05, det: function(g) {
      g.strokeStyle = M.contorno; g.lineWidth = w * 0.8; g.lineCap = "round"; g.beginPath(); g.moveTo(-0.1, -0.5); g.lineTo(0.1, -0.5); g.moveTo(0, -0.58); g.lineTo(0, -0.42); g.stroke();
    } });
    forma(g, w, elp(0.99, -0.56, 0.1, 0.13, 0.3), P, { d: 0.03 });
    S.cauda = (function() {      // ponta da faixa (sprite pequeno para balançar)
      var c = cv(R * 0.8, R * 0.5), q = c.getContext("2d");
      q.translate(R * 0.04, R * 0.25); q.scale(R, R);
      forma(q, w, function(q) { q.moveTo(0, -0.1); q.quadraticCurveTo(0.3, -0.2, 0.66, -0.05); q.lineTo(0.56, 0.06); q.lineTo(0.64, 0.17); q.quadraticCurveTo(0.3, 0.08, 0, 0.1); q.closePath(); }, P, { d: 0.04 });
      return c;
    })();
  };
  DIN.mascara_ninja = function(ctx, sp, R, t) {
    var c = sp.cauda;
    [[-0.4, 0.0], [0.15, 0.1]].forEach(function(q, i) {
      ctx.save(); ctx.translate(1.04 * R, -0.58 * R); ctx.rotate(q[0] + q[1] + Math.sin(t * 7 + i * 2) * 0.16 + 0.1);
      ctx.drawImage(c, 0, -c.height / 2 - 0.04 * R); ctx.restore();
    });
    ctx.drawImage(sp.c, -sp.ox, -sp.oy);
  };

  // viking: capacete de aço com chifres e tranças
  AC.viking = function(g, w) {
    var S = pal("#8a9cc2"), G = pal("#f5b83d"), H = osso(), T = pal("#f08c2e");
    var c = corno([[0.75, -0.72], [1.5, -0.7], [1.6, -1.1], [1.52, -1.7]], 0.2);
    fora(g, function() { par(g, function(g) { forma(g, w, c.pth, H, { d: 0.08, det: aneisCorno(g, w, c, H) }); }); });
    par(g, function(g) {
      for (var i = 0; i < 3; i++) forma(g, w, elp(1.0, 0.04 + i * 0.2, 0.1, 0.11, 0), T, { d: 0.03 });
    });
    forma(g, w, function(g) { g.arc(0, 0, 1.06, PI + 0.5, PI2 - 0.5); g.quadraticCurveTo(0, -0.38, -0.93, -0.51); g.closePath(); }, S, { d: 0.1, det: function(g) {
      tracoCurvo(g, w * 0.7, S.contorno, 0, -1.1, 0, -0.9, 0, -0.5, 0.45);
    } });
    forma(g, w, function(g) { g.moveTo(-1.0, -0.66); g.quadraticCurveTo(0, -0.4, 1.0, -0.66); g.lineTo(1.0, -0.46); g.quadraticCurveTo(0, -0.2, -1.0, -0.46); g.closePath(); }, G, { d: 0.05 });
    [-0.66, -0.33, 0, 0.33, 0.66].forEach(function(x) { var y = -0.54 + 0.075 * (1 - (x * x) / 0.55) * 1.4 + 0.02; g.beginPath(); g.arc(x, y, 0.036, 0, PI2); g.fillStyle = G.contorno; g.fill(); g.beginPath(); g.arc(x - 0.008, y - 0.01, 0.018, 0, PI2); g.fillStyle = G.brilho; g.fill(); });
  };

  // chapéu de cowboy
  AC.cowboy = function(g, w) {
    var C = pal("#c98a4b"), B = pal("#6b3f1f");
    forma(g, w, function(g) { g.moveTo(-0.6, -0.8); g.bezierCurveTo(-0.7, -1.3, -0.5, -1.62, -0.2, -1.6); g.quadraticCurveTo(0, -1.34, 0.2, -1.6); g.bezierCurveTo(0.5, -1.62, 0.7, -1.3, 0.6, -0.8); g.closePath(); }, C, { d: 0.1, det: function(g) {
      g.beginPath(); g.moveTo(-0.8, -1.02); g.quadraticCurveTo(0, -0.84, 0.8, -1.02); g.lineTo(0.8, -0.74); g.quadraticCurveTo(0, -0.56, -0.8, -0.74); g.closePath(); g.fillStyle = B.base; g.fill();
      g.strokeStyle = B.contorno; g.lineWidth = w * 0.8; g.stroke();
    } });
    forma(g, w, function(g) { g.moveTo(-1.34, -1.12); g.quadraticCurveTo(-1.1, -0.9, -0.62, -0.78); g.quadraticCurveTo(0, -0.5, 0.62, -0.78); g.quadraticCurveTo(1.1, -0.9, 1.34, -1.12); g.quadraticCurveTo(1.2, -0.6, 0.6, -0.5); g.quadraticCurveTo(0, -0.28, -0.6, -0.5); g.quadraticCurveTo(-1.2, -0.6, -1.34, -1.12); g.closePath(); }, C, { d: 0.08 });
    g.fillStyle = pal("#ffd43b").base; est5(g, 0, -0.78, 0.1, 0.045); g.fill(); g.strokeStyle = B.contorno; g.lineWidth = w * 0.7; g.lineJoin = "round"; g.stroke();
  };

  // antena com bulbo que pisca (balança em DIN)
  AC.antena = function(g, w, R, S) {
    var M = pal("#c9d1e6"), R1 = pal("#ff4d6d");
    g.beginPath(); g.moveTo(0, -0.96); g.quadraticCurveTo(-0.12, -1.3, 0.12, -1.52);
    g.strokeStyle = M.contorno; g.lineWidth = 0.1 + w * 1.5; g.lineCap = "round"; g.stroke(); g.strokeStyle = M.base; g.lineWidth = 0.1; g.stroke();
    g.strokeStyle = M.brilho; g.lineWidth = 0.025; g.globalAlpha = 0.8; g.beginPath(); g.moveTo(-0.025, -1.0); g.quadraticCurveTo(-0.14, -1.3, 0.09, -1.5); g.stroke(); g.globalAlpha = 1;
    forma(g, w, elp(0, -0.97, 0.2, 0.075, 0), pal("#6c7ba8"), { d: 0.03 });
    forma(g, w, elp(0.12, -1.66, 0.22, 0.22, 0), R1, { d: 0.07 });
    g.fillStyle = "#fff"; g.globalAlpha = 0.9; g.beginPath(); g.ellipse(0.05, -1.74, 0.07, 0.04, -0.6, 0, PI2); g.fill(); g.globalAlpha = 1;
    var gl = cv(R * 0.9, R * 0.9), q = gl.getContext("2d"); q.translate(R * 0.45, R * 0.45);
    q.fillStyle = "rgba(255,90,120,0.25)"; q.beginPath(); q.arc(0, 0, R * 0.42, 0, PI2); q.fill(); q.fillStyle = "rgba(255,120,140,0.3)"; q.beginPath(); q.arc(0, 0, R * 0.31, 0, PI2); q.fill();
    S.glow = gl;
  };
  DIN.antena = function(ctx, sp, R, t) {
    ctx.save(); ctx.translate(0, -0.97 * R); ctx.rotate(Math.sin(t * 3.1) * 0.06); ctx.translate(0, 0.97 * R);
    ctx.drawImage(sp.c, -sp.ox, -sp.oy);
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6); ctx.drawImage(sp.glow, 0.12 * R - sp.glow.width / 2, -1.66 * R - sp.glow.height / 2); ctx.globalAlpha = 1;
    ctx.restore();
  };

  // auréola flutuante
  AC.aureola = function(g, w) {
    var G = pal("#ffd43b");
    function anel() { g.beginPath(); g.ellipse(0, -1.34, 0.62, 0.17, 0, 0, PI2); }
    anel(); g.strokeStyle = "rgba(255,230,120,0.28)"; g.lineWidth = 0.24; g.stroke();
    anel(); g.strokeStyle = G.contorno; g.lineWidth = 0.15 + w * 1.6; g.stroke();
    anel(); g.strokeStyle = G.base; g.lineWidth = 0.15; g.stroke();
    g.beginPath(); g.ellipse(0, -1.34, 0.62, 0.17, 0, PI * 0.1, PI * 0.9); g.strokeStyle = G.sombra; g.lineWidth = 0.05; g.stroke();
    g.beginPath(); g.ellipse(0, -1.34 - 0.012, 0.62, 0.17, 0, PI * 1.08, PI * 1.62); g.strokeStyle = "#fff8d0"; g.lineWidth = 0.04; g.lineCap = "round"; g.stroke();
  };
  DIN.aureola = function(ctx, sp, R, t) {
    ctx.save(); ctx.translate(0, Math.sin(t * 2.4) * 0.05 * R); ctx.drawImage(sp.c, -sp.ox, -sp.oy);
    var k = 0.6 + 0.4 * Math.sin(t * 4), a = R * 0.2 * k, x = 0.5 * R, y = -1.5 * R;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(x, y - a); ctx.lineTo(x + a * 0.22, y - a * 0.22); ctx.lineTo(x + a, y); ctx.lineTo(x + a * 0.22, y + a * 0.22); ctx.lineTo(x, y + a); ctx.lineTo(x - a * 0.22, y + a * 0.22); ctx.lineTo(x - a, y); ctx.lineTo(x - a * 0.22, y - a * 0.22); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  // coroa de ouro com joias
  AC.coroa = function(g, w) {
    var G = pal("#fcc419");
    forma(g, w, function(g) {
      g.moveTo(-0.62, -0.74); g.lineTo(-0.68, -1.4); g.lineTo(-0.45, -1.08); g.lineTo(-0.32, -1.56); g.lineTo(-0.16, -1.14); g.lineTo(0, -1.66); g.lineTo(0.16, -1.14); g.lineTo(0.32, -1.56);
      g.lineTo(0.45, -1.08); g.lineTo(0.68, -1.4); g.lineTo(0.62, -0.74); g.quadraticCurveTo(0, -0.58, -0.62, -0.74); g.closePath();
    }, G, { d: 0.09, det: function(g) {
      g.beginPath(); g.moveTo(-0.7, -0.98); g.quadraticCurveTo(0, -0.82, 0.7, -0.98); g.lineTo(0.7, -0.74); g.quadraticCurveTo(0, -0.54, -0.7, -0.74); g.closePath();
      g.fillStyle = G.sombra; g.globalAlpha = 0.5; g.fill(); g.globalAlpha = 1; g.strokeStyle = G.contorno; g.lineWidth = w * 0.7; g.stroke();
    } });
    [[-0.68, -1.4], [-0.32, -1.56], [0, -1.66], [0.32, -1.56], [0.68, -1.4]].forEach(function(p) { forma(g, w * 0.8, elp(p[0], p[1], 0.075, 0.075, 0), pal("#fff3bf"), { d: 0.02 }); });
    [[-0.34, -0.8, "#ff4d6d", 0.075], [0, -0.74, "#4dabf7", 0.095], [0.34, -0.8, "#51cf66", 0.075]].forEach(function(j) { forma(g, w * 0.8, elp(j[0], j[1], j[3], j[3] * 1.15, 0), pal(j[2]), { d: 0.03 }); });
  };

  var spr = {};
  function sprite(id, R, q) {
    var k = id + "|" + R + "|" + q, s = spr[k];
    if (s) return s;
    var W = 2 * Math.ceil(1.7 * R + 4), top = Math.ceil(2.0 * R + 4), bot = Math.ceil(1.1 * R + 4);
    var c = cv(W, top + bot), g = c.getContext("2d", { willReadFrequently: true });
    s = { c: c, ox: W / 2, oy: top };
    g.translate(W / 2, top); g.scale(R, R);
    QS = q; AC[id](g, lw(R) / R, R, s); QS = 1;
    // recorta para a caixa do desenho (menos pixels por quadro)
    var d = g.getImageData(0, 0, W, top + bot).data, x0 = W, x1 = -1, y0 = top + bot, y1 = -1, i, j, w2 = W, h2 = top + bot;
    for (j = 0; j < h2; j++) for (i = 0; i < w2; i++) if (d[(j * w2 + i) * 4 + 3] > 3) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    if (x1 >= 0) {
      var c2 = cv(x1 - x0 + 1, y1 - y0 + 1); c2.getContext("2d").drawImage(c, -x0, -y0);
      s.c = c2; s.ox = W / 2 - x0; s.oy = top - y0;
    }
    return (spr[k] = s);
  }
  function acessorio(ctx, id, x, y, r, olharX, escX, escY, t, q) {
    if (!AC[id]) return;
    q = q || 1;
    var R = Math.max(8, Math.round(r * q)), s = sprite(id, R, q), sc = r / R, ox = olharX || 0;
    ox = ox > 1.5 ? 1.5 : ox < -1.5 ? -1.5 : ox;
    ctx.save();
    ctx.translate(x + ox * r * (CARA[id] ? 0.07 : 0.045), y);
    ctx.scale(VIRA[id] && ox < -0.2 ? -sc : sc, sc);
    if (DIN[id]) DIN[id](ctx, s, R, t || 0); else ctx.drawImage(s.c, -s.ox, -s.oy);
    ctx.restore();
  }

  // bolinha completa para a loja (corpo + olhos + acessório), no mesmo desenho do jogo
  var mb = { x: 0, y: 0, r: 28, cor: "#4dabf7", olharX: 0.3, olharY: 0, expressao: "normal", piscar: 0, t: 0, cache: true, skin: "classico", acessorio: "nenhum" };
  function miniatura(ctx, idCorpo, idAcessorio, cor, x, y, r, t) {
    t = t || 0;
    if (typeof ArteBolinha === "undefined") { ctx.fillStyle = cor || "#4dabf7"; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill(); return; }
    mb.x = x; mb.y = y; mb.r = r; mb.cor = cor || "#4dabf7"; mb.skin = idCorpo || "classico"; mb.acessorio = idAcessorio || "nenhum";
    mb.t = t; mb.olharX = Math.round((0.25 + Math.sin(t * 1.1) * 0.35) * 10) / 10; mb.piscar = t > 0 && (t % 3.7) < 0.14 ? 1 : 0;
    ArteBolinha.desenhar(ctx, mb);
  }
  // pré-aquece (opcional): todos os corpos e acessórios no raio r
  function aquecer(r, cor) {
    r = r || 28;
    for (var id in MAT) corpo(id, cor || "#4dabf7", r);
    for (var a in AC) sprite(a, Math.max(8, Math.round(r)), 1);
  }

  return { corpo: corpo, rosto: rosto, acessorio: acessorio, miniatura: miniatura, aquecer: aquecer };
})();
