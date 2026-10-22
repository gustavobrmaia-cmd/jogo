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
// v19 (personalização): o "id do acessório" pode ser a chave de camadas "v|lado|chapéu|acessório|olhos|boca|emote|rastro"
//   (dados/skins.js chaveCamadas): chapéu, acessório, olhos e boca uns por cima dos outros, o rastro (pontos que o
//   motor guarda em b.rastroFx, desenhados só fora do corpo) e o balão do emote de quem venceu a rodada.
//   ArteSkins.miniVisual(ctx, visual, x, y, r, t, expr)   ArteSkins.iconeItem(ctx, id, x, y, tam, visual, t)
//   ArteSkins.previa(ctx, w, h, visual, t, aba)            (prévia grande da tela de personalização)
// Depende de ArteBolinha só em tempo de chamada (paleta, desenhar, brilhoEsfera, espQ), então carrega antes dele.
// =========================

const ArteSkins = (function() {
  var PI = Math.PI, PI2 = PI * 2;
  var ESC = [26, 13, 51], AZ = [48, 28, 120], BR = [255, 255, 255];
  var FIXA = { futebol: "#f1f3f5", melancia: "#2f9e44", doce: "#f783ac", gelo: "#a5d8ff", lava: "#ff6b1a", diamante: "#99e9f2", galaxia: "#5f3dc4", ouro: "#fcc419",
    queijo: "#ffd43b", vaca: "#f8f9fa", tigre: "#ff922b", biscoito: "#c98a4b", arcoiris: "#ff6b6b" };

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

  // ---------- v19: estampas novas (cel-shading igual às de cima; o rosto fica mais limpo) ----------
  // lugares das figuras (posição na tela, longe dos olhos, boca e bochechas): x, y, tamanho
  var FIGS = [[0.0, -0.74, 0.17], [0.56, -0.56, 0.14], [-0.56, -0.58, 0.13], [-0.84, 0.08, 0.13], [0.85, 0.04, 0.12],
    [-0.42, 0.78, 0.15], [0.38, 0.78, 0.14], [0.76, 0.52, 0.1], [-0.76, 0.5, 0.1], [0.28, -0.92, 0.08], [-0.26, -0.92, 0.07]];
  // desenha f(g, s) em cada lugar, achatando perto da borda (a esfera vira de lado)
  function figuras(g, R, f, lista) {
    (lista || FIGS).forEach(function(q, i) {
      var x = q[0], y = q[1], d = Math.hypot(x, y), z = Math.sqrt(Math.max(0, 1 - d * d)), k = 0.42 + 0.58 * z, a = Math.atan2(y, x);
      g.save(); g.translate(x * R, y * R); g.rotate(a); g.scale(k, 1); g.rotate(-a);
      f(g, R * q[2], i);
      g.restore();
    });
  }
  function coracao(g, s) {
    g.beginPath(); g.moveTo(0, s * 0.42);
    g.bezierCurveTo(-s * 1.05, -s * 0.2, -s * 0.5, -s * 1.0, 0, -s * 0.42);
    g.bezierCurveTo(s * 0.5, -s * 1.0, s * 1.05, -s * 0.2, 0, s * 0.42); g.closePath();
  }
  function raioForma(g, s) {
    var P = [[-0.2, -1], [0.42, -1], [0.08, -0.22], [0.5, -0.22], [-0.3, 1], [-0.02, 0.12], [-0.42, 0.12]];
    g.beginPath(); P.forEach(function(p, i) { g[i ? "lineTo" : "moveTo"](p[0] * s, p[1] * s); }); g.closePath();
  }
  // figura clara com fio escuro e sombra deslocada (padrão das pintas)
  function figuraClara(g, R, P, desenho, cor) {
    var claro = cor || mx(P.rgb, BR, 0.74), sombra = mx(P.rgb, AZ, 0.42);
    g.lineWidth = Math.max(QS, R * 0.03); g.lineJoin = "round";
    figuras(g, R, function(g, s, i) {
      g.save(); g.translate(R * 0.014, R * 0.02); desenho(g, s, i); g.fillStyle = sombra; g.globalAlpha = 0.45; g.fill(); g.restore();
      desenho(g, s, i); g.fillStyle = typeof claro === "function" ? claro(i) : claro; g.fill();
      g.strokeStyle = sombra; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1;
    });
  }
  function baseLisa(P) { return function(g, R) { g.fillStyle = P.base; g.fillRect(-R, -R, 2 * R, 2 * R); }; }

  MAT.coracoes = function(g, R, P) {
    esfera(g, R, { sh: SOMBRA, lt: LUZ, rim: P.rim, ct: P.contorno, alb: function(g) {
      baseLisa(P)(g, R);
      figuraClara(g, R, P, function(g, s) { coracao(g, s * 1.15); }, function(i) { return i % 3 === 1 ? "#fff0f6" : mx(mxA(P.rgb, [255, 70, 130], 0.5), BR, 0.45); });
    } });
  };
  MAT.estrelas = function(g, R, P) {
    esfera(g, R, { sh: SOMBRA, lt: LUZ, rim: P.rim, ct: P.contorno, alb: function(g) {
      baseLisa(P)(g, R);
      figuraClara(g, R, P, function(g, s, i) { g.rotate(i * 0.7); est5(g, 0, 0, s * 1.2, s * 0.5); }, function(i) { return i % 2 ? "#fff3bf" : "#ffe066"; });
    } });
  };
  MAT.raio = function(g, R, P) {
    var L = [[0.0, -0.74, 0.2], [-0.82, 0.12, 0.17], [0.84, 0.08, 0.16], [-0.38, 0.8, 0.13], [0.42, 0.8, 0.13], [0.6, -0.56, 0.12], [-0.6, -0.56, 0.12]];
    esfera(g, R, { sh: SOMBRA, lt: LUZ, rim: P.rim, ct: P.contorno, alb: function(g) {
      baseLisa(P)(g, R);
      g.lineWidth = Math.max(QS, R * 0.035); g.lineJoin = "round";
      figuras(g, R, function(g, s, i) {
        g.rotate(i % 2 ? 0.35 : -0.25);
        g.save(); g.translate(R * 0.015, R * 0.02); raioForma(g, s); g.fillStyle = mx(P.rgb, AZ, 0.5); g.globalAlpha = 0.5; g.fill(); g.restore();
        raioForma(g, s); g.fillStyle = "#ffe066"; g.fill(); g.strokeStyle = "#a35f00"; g.globalAlpha = 0.8; g.stroke(); g.globalAlpha = 1;
      }, L);
    } });
  };
  MAT.bolhas = function(g, R, P) {
    esfera(g, R, { sh: SOMBRA, lt: LUZ, rim: P.rim, ct: P.contorno, alb: function(g) {
      baseLisa(P)(g, R);
      var claro = mx(P.rgb, BR, 0.55), borda = mx(P.rgb, BR, 0.85), escuro = mx(P.rgb, AZ, 0.35);
      figuras(g, R, function(g, s, i) {
        var rr = s * (i % 3 === 0 ? 1.15 : 0.9);
        g.beginPath(); g.arc(0, 0, rr, 0, PI2); g.fillStyle = claro; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;
        g.lineWidth = Math.max(QS, R * 0.03); g.strokeStyle = escuro; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
        g.beginPath(); g.arc(0, 0, rr * 0.82, PI * 1.1, PI * 1.55); g.strokeStyle = borda; g.lineWidth = Math.max(QS, R * 0.035); g.lineCap = "round"; g.stroke();
        g.beginPath(); g.arc(-rr * 0.38, -rr * 0.38, rr * 0.16, 0, PI2); g.fillStyle = "#fff"; g.fill();
      });
    } });
  };
  // zigue-zague: faixas em dente de serra
  MAT.zigue = function(g, R, P) {
    var claro = mx(P.rgb, BR, 0.72), fio = mx(P.rgb, AZ, 0.36), d = PI / 180;
    function faixa(la0, la1, amp) {
      var pts = [], lo;
      for (lo = -100; lo <= 100; lo += 12.5) pts.push(ll(lo * d, (la0 + ((lo / 12.5) & 1 ? amp : -amp)) * d));
      for (lo = 100; lo >= -100; lo -= 12.5) pts.push(ll(lo * d, (la1 + ((lo / 12.5) & 1 ? amp : -amp)) * d));
      return poli(g, R, pts);
    }
    esfera(g, R, { sh: SOMBRA, lt: LUZ, rim: P.rim, ct: P.contorno, alb: function(g) {
      baseLisa(P)(g, R);
      g.lineWidth = Math.max(QS, R * 0.035); g.lineJoin = "round";
      [[58, 72, 6], [30, 42, 6], [-26, -38, 6], [-54, -68, 6]].forEach(function(b) {
        if (faixa(b[0], b[1], b[2])) { g.fillStyle = claro; g.fill(); g.strokeStyle = fio; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1; }
      });
    } });
  };
  // queijo: amarelo com furos fundos (sombra dentro do furo)
  MAT.queijo = function(g, R, P) {
    var furos = [[-0.62, -0.5, 0.15], [0.12, -0.78, 0.12], [0.66, -0.36, 0.1], [-0.84, 0.32, 0.11], [0.82, 0.4, 0.14], [-0.3, 0.84, 0.12], [0.36, 0.86, 0.09], [-0.1, -0.5, 0.06], [0.52, 0.66, 0.06]];
    esfera(g, R, { sh: "rgba(150,70,20,0.3)", lt: "rgba(255,255,230,0.25)", rim: "rgb(255,246,180)", ct: "#a86b00", alb: function(g) {
      g.fillStyle = "#ffd43b"; g.fillRect(-R, -R, 2 * R, 2 * R);
      figuras(g, R, function(g, s) {
        g.beginPath(); g.ellipse(0, 0, s, s * 0.9, 0, 0, PI2); g.fillStyle = "#e8a400"; g.fill();
        g.save(); g.clip(); g.beginPath(); g.ellipse(s * 0.25, s * 0.3, s, s * 0.9, 0, 0, PI2); g.fillStyle = "#c98200"; g.fill(); g.restore();
        g.beginPath(); g.ellipse(0, 0, s, s * 0.9, 0, 0, PI2); g.lineWidth = Math.max(QS, R * 0.025); g.strokeStyle = "#a86b00"; g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
      }, furos);
    } });
  };
  // biscoito com gotas de chocolate
  MAT.biscoito = function(g, R, P) {
    var gotas = [[-0.58, -0.54, 0.12], [0.18, -0.78, 0.1], [0.66, -0.34, 0.11], [-0.86, 0.22, 0.09], [0.84, 0.36, 0.1], [-0.34, 0.82, 0.11], [0.34, 0.84, 0.1], [-0.12, -0.92, 0.06], [0.6, 0.68, 0.07], [-0.66, 0.62, 0.07]];
    var massa = px(R, function(x, y, z, o) {
      var n = fbm(x * 5 + 2, y * 5, z * 5), q = mxA([214, 150, 84], [174, 112, 54], cl(n * 1.4 - 0.3, 0, 1));
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
    });
    esfera(g, R, { sh: "rgba(90,40,30,0.32)", lt: "rgba(255,240,210,0.2)", rim: "rgb(255,220,170)", ct: "#5a3410", alb: function(g) {
      g.drawImage(massa, -massa.width / 2, -massa.height / 2);
      figuras(g, R, function(g, s, i) {
        g.rotate(i);
        g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(-s * 0.9, -s * 1.1, 0, -s * 0.9); g.quadraticCurveTo(s * 1.2, -s * 0.6, s, s * 0.3); g.quadraticCurveTo(s * 0.4, s * 1.1, -s * 0.5, s * 0.8); g.closePath();
        g.fillStyle = "#4a2810"; g.fill();
        g.beginPath(); g.arc(-s * 0.3, -s * 0.35, s * 0.25, 0, PI2); g.fillStyle = "#8a5a32"; g.fill();
      }, gotas);
    } });
  };
  // vaca: branca com manchas pretas grandes e nítidas
  MAT.vaca = function(g, R, P) {
    var img = px(R, function(x, y, z, o) {
      var f = zonaRosto(x, y), n = fbm2(x * 1.5 + 7, y * 1.5 + 3, z * 1.5 + 1) - f * 0.22, q = [246, 247, 250];
      q = mxA(q, [40, 36, 54], sm(0.56, 0.585, n));
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
    });
    esfera(g, R, { sh: "rgba(48,36,120,0.34)", lt: "rgba(255,255,255,0.2)", rim: "rgb(220,235,255)", ct: "#3a3a4a", alb: function(g) { g.drawImage(img, -img.width / 2, -img.height / 2); } });
  };
  // tigre: laranja com listras pretas que seguem a esfera e focinho claro
  MAT.tigre = function(g, R, P) {
    var img = px(R, function(x, y, z, o) {
      var lon = Math.atan2(x, z + 0.0001), f = zonaRosto(x, y), q = [255, 146, 43];
      q = mxA(q, [255, 214, 150], sm(0.3, -0.1, y) * 0.35);
      q = mxA(q, [255, 244, 224], sm(0.42, 0.3, Math.hypot(x / 0.85, (y - 0.42) / 0.5)));      // focinho claro
      var s = Math.sin(lon * 6.5 + fbm(x * 2, y * 2, z * 2) * 4 + y * 1.5), lim = 0.62 + f * 0.5;
      q = mxA(q, [38, 22, 30], sm(lim, lim + 0.05, s) * (1 - sm(0.55, 0.85, y)));
      var s2 = Math.sin(y * 9 + lon * 1.5 + fbm(x * 3, y * 3, z * 3) * 3);                     // listras do topo
      q = mxA(q, [38, 22, 30], sm(0.7, 0.75, s2) * sm(-0.45, -0.65, y) * (1 - f * 0.6));
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
    });
    esfera(g, R, { sh: "rgba(110,30,60,0.34)", lt: "rgba(255,255,230,0.2)", rim: "rgb(255,220,170)", ct: "#7a3a0a", alb: function(g) { g.drawImage(img, -img.width / 2, -img.height / 2); } });
  };
  // arco-íris: faixas inclinadas com as 6 cores
  var ARCO = [[255, 82, 102], [255, 146, 43], [255, 212, 59], [81, 207, 102], [77, 171, 247], [151, 117, 250]];
  MAT.arcoiris = function(g, R, P) {
    var img = px(R, function(x, y, z, o) {
      var u = (y * 0.95 + x * 0.3 + 1.15) / 2.3 * 6, i = Math.floor(cl(u, 0, 5.999)), fr = u - i, q = ARCO[i];
      if (i < 5) q = mxA(q, ARCO[i + 1], sm(0.82, 1, fr));
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
    });
    esfera(g, R, { sh: "rgba(60,20,120,0.3)", lt: "rgba(255,255,255,0.25)", rim: "rgb(255,240,255)", ct: "#4a1f6a", alb: function(g) { g.drawImage(img, -img.width / 2, -img.height / 2); },
      mid: function(g) { g.fillStyle = "#fff"; estrela4(g, R * 0.6, -R * 0.5, R * 0.15, R * 0.03, 0); g.globalAlpha = 0.8; estrela4(g, -R * 0.66, R * 0.42, R * 0.1, R * 0.022, 0); g.globalAlpha = 1; } });
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
    ouro: { lid: "#fcc419", contorno: "#8a5207", anel: "#8a5207", iris: "#8a5207", bochecha: "rgb(255,120,80)" },
    queijo: { lid: "#ffe066", contorno: "#a86b00", anel: "#a86b00", iris: "#a86b00", bochecha: "rgb(255,140,90)" },
    vaca: { lid: "#ffffff", contorno: "#3a3a4a", anel: "#3a3a4a", iris: "#5a5a7a", bochecha: "rgb(255,150,180)" },
    tigre: { lid: "#ffa94d", contorno: "#7a3a0a", anel: "#7a3a0a", iris: "#9a5a1a", bochecha: "rgb(255,120,90)" },
    biscoito: { lid: "#d9a066", contorno: "#5a3410", anel: "#5a3410", iris: "#7a4a20", bochecha: "rgb(255,120,110)" },
    arcoiris: { lid: "#ffd8e0", contorno: "#6b2a8a", anel: "#6b2a8a", iris: "#6b4fd8", bochecha: "rgb(255,90,150)" }
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

  // ======================= v19: itens novos =======================
  // Mesmo acabamento dos de cima (forma(): base + sombra deslocada + fio de luz + contorno escuro grosso).
  // CARA = acompanha o rosto (olhos e boca); VIRA = espelha quando olha para o outro lado.
  ["sobrancelha", "cilios", "oculos_sol", "tapa_olho", "mascara_heroi", "monoculo", "pintura_guerra", "oculos_coracao", "visor", "oculos_estrela",
   "dentucos", "bigode", "chupeta", "presas", "pirulito", "bigode_fino", "barba", "bandana", "cachimbo", "rosa_boca"].forEach(function(id) { CARA[id] = 1; });
  VIRA.topete = 1; VIRA.natal = 1; VIRA.pirulito = 1; VIRA.cachimbo = 1; VIRA.barbatana = 1;
  var EX = 0.315, EY = -0.05, MY = 0.37;      // centro dos olhos e da boca (mesmas medidas do rosto em bolinhas.js)
  function pal2(cor, sombra, contorno, brilho) { var P = Object.create(pal(cor)); if (sombra) P.sombra = sombra; if (contorno) P.contorno = contorno; if (brilho) P.brilho = brilho; return P; }

  // ----- chapéus -----
  AC.gorro = function(g, w) {
    var A = pal("#4263eb"), B = pal("#364fc7"), C = pal2("#f1f3f5", "#c5cbe0", "#4a4f7a");
    forma(g, w, function(g) { g.moveTo(-0.97, -0.52); g.bezierCurveTo(-1.0, -1.26, -0.5, -1.36, 0, -1.36); g.bezierCurveTo(0.5, -1.36, 1.0, -1.26, 0.97, -0.52); g.quadraticCurveTo(0, -0.34, -0.97, -0.52); g.closePath(); }, A, { d: 0.1, det: function(g) {
      for (var i = -3; i <= 3; i++) tracoCurvo(g, w * 0.6, A.contorno, i * 0.2, -1.32, i * 0.24, -1.0, i * 0.28, -0.6, 0.35);
    } });
    forma(g, w, function(g) { g.moveTo(-1.03, -0.66); g.quadraticCurveTo(0, -0.46, 1.03, -0.66); g.lineTo(1.0, -0.42); g.quadraticCurveTo(0, -0.22, -1.0, -0.42); g.closePath(); }, B, { d: 0.05, det: function(g) {
      for (var i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * 0.22, -0.6 + Math.abs(i) * -0.005 + 0.06 * (1 - i * i / 25)); g.lineTo(i * 0.22, -0.36 + 0.06 * (1 - i * i / 25)); g.strokeStyle = B.contorno; g.lineWidth = w * 0.6; g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1; }
    } });
    forma(g, w, elp(0, -1.44, 0.22, 0.2, 0), C, { d: 0.06, det: function(g) { for (var i = 0; i < 6; i++) { var a = i * 1.05; g.beginPath(); g.arc(Math.cos(a) * 0.1, -1.44 + Math.sin(a) * 0.09, 0.05, 0, PI2); g.fillStyle = "#dde2f0"; g.fill(); } } });
  };
  AC.festa = function(g, w) {
    var C = pal("#f06595"), O = pal("#ffd43b"), Z = pal("#4dabf7");
    forma(g, w, function(g) { g.moveTo(-0.5, -0.8); g.lineTo(0.16, -1.82); g.lineTo(0.52, -0.84); g.quadraticCurveTo(0, -0.66, -0.5, -0.8); g.closePath(); }, C, { d: 0.09, det: function(g) {
      [[-0.18, -1.0, O], [0.22, -1.08, Z], [0.02, -1.36, O], [0.24, -1.55, Z], [-0.3, -0.86, Z], [0.36, -0.86, O]].forEach(function(p) { g.beginPath(); g.arc(p[0], p[1], 0.07, 0, PI2); g.fillStyle = p[2].base; g.fill(); g.strokeStyle = p[2].contorno; g.lineWidth = w * 0.6; g.stroke(); });
    } });
    forma(g, w * 0.8, function(g) { g.moveTo(-0.56, -0.86); g.quadraticCurveTo(0, -0.66, 0.58, -0.88); g.lineTo(0.56, -0.74); g.quadraticCurveTo(0, -0.52, -0.54, -0.72); g.closePath(); }, O, { d: 0.03 });
    forma(g, w, elp(0.17, -1.86, 0.15, 0.14, 0), O, { d: 0.05 });
  };
  AC.topete = function(g, w) {
    var H = pal2("#6b4226", "#4a2b17", "#2a160a", "#a8754e");
    forma(g, w, function(g) {
      g.moveTo(-0.9, -0.52); g.bezierCurveTo(-1.1, -1.3, -0.2, -1.55, 0.5, -1.42); g.bezierCurveTo(1.05, -1.32, 1.2, -0.98, 0.9, -0.74);
      g.quadraticCurveTo(0.95, -1.08, 0.55, -1.1); g.quadraticCurveTo(0.1, -1.1, -0.1, -0.9); g.quadraticCurveTo(-0.45, -0.72, -0.5, -0.56); g.quadraticCurveTo(-0.7, -0.5, -0.9, -0.52); g.closePath();
    }, H, { d: 0.1, det: function(g) {
      tracoCurvo(g, w * 0.8, H.brilho, -0.6, -0.95, -0.2, -1.38, 0.5, -1.3, 0.8);
      tracoCurvo(g, w * 0.7, H.contorno, -0.4, -0.75, 0, -1.15, 0.6, -1.2, 0.5);
    } });
  };
  AC.helice = function(g, w) {
    var cs = ["#ff4d6d", "#ffd43b", "#4dabf7", "#51cf66"];
    for (var i = 0; i < 4; i++) {
      (function(i) {
        var a0 = PI + i * PI / 4, a1 = a0 + PI / 4;
        forma(g, w, function(g) { g.moveTo(0, -0.52); g.arc(0, -0.52, 0.98, a0, a1); g.closePath(); }, pal(cs[i]), { d: 0.06 });
      })(i);
    }
    forma(g, w, function(g) { g.moveTo(-1.0, -0.56); g.quadraticCurveTo(0, -0.36, 1.0, -0.56); g.lineTo(1.0, -0.46); g.quadraticCurveTo(0, -0.26, -1.0, -0.46); g.closePath(); }, pal("#3b4fd0"), { d: 0.03 });
    forma(g, w, rr(-0.05, -1.66, 0.1, 0.18, 0.04), pal("#adb5bd"), { d: 0.02 });
    forma(g, w, elp(0, -1.66, 0.09, 0.06, 0), pal("#ffd43b"), { d: 0.02 });
  };
  DIN.helice = function(ctx, sp, R, t) {
    ctx.drawImage(sp.c, -sp.ox, -sp.oy);
    var a = t * 16, k = Math.cos(a), y = -1.68 * R, lw = Math.max(1.2, R * 0.05);
    ctx.lineJoin = "round";
    for (var i = 0; i < 2; i++) {
      var s = i ? -1 : 1, cx = s * k * 0.36 * R, rx = Math.max(R * 0.05, Math.abs(k) * 0.34 * R);
      ctx.beginPath(); ctx.ellipse(cx, y, rx, R * 0.08, 0, 0, PI2);
      ctx.fillStyle = (i ? k > 0 : k <= 0) ? "#ff4d6d" : "#ff8fa3"; ctx.fill(); ctx.strokeStyle = "#1a0d33"; ctx.lineWidth = lw; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, y, R * 0.06, 0, PI2); ctx.fillStyle = "#ffd43b"; ctx.fill(); ctx.stroke();
  };
  AC.chef = function(g, w) {
    var B = pal2("#f8f9fa", "#d0d6e6", "#4a4f7a", "#ffffff");
    forma(g, w, function(g) {
      g.moveTo(-0.66, -0.7); g.bezierCurveTo(-1.15, -0.95, -1.0, -1.6, -0.5, -1.5); g.bezierCurveTo(-0.45, -1.95, 0.45, -1.95, 0.5, -1.5);
      g.bezierCurveTo(1.0, -1.6, 1.15, -0.95, 0.66, -0.7); g.closePath();
    }, B, { d: 0.1, det: function(g) { tracoCurvo(g, w * 0.7, B.contorno, -0.3, -0.85, -0.36, -1.2, -0.44, -1.42, 0.35); tracoCurvo(g, w * 0.7, B.contorno, 0.3, -0.85, 0.36, -1.2, 0.44, -1.42, 0.35); } });
    forma(g, w, function(g) { g.moveTo(-0.72, -0.82); g.quadraticCurveTo(0, -0.66, 0.72, -0.82); g.lineTo(0.72, -0.56); g.quadraticCurveTo(0, -0.4, -0.72, -0.56); g.closePath(); }, B, { d: 0.05 });
  };
  AC.capacete = function(g, w) {
    var Y = pal("#fcc419");
    forma(g, w, function(g) { g.moveTo(-1.28, -0.6); g.quadraticCurveTo(0, -0.38, 1.28, -0.6); g.quadraticCurveTo(1.3, -0.48, 1.1, -0.44); g.quadraticCurveTo(0, -0.24, -1.1, -0.44); g.quadraticCurveTo(-1.3, -0.48, -1.28, -0.6); g.closePath(); }, Y, { d: 0.05 });
    forma(g, w, function(g) { g.moveTo(-0.92, -0.58); g.bezierCurveTo(-0.95, -1.3, 0.95, -1.3, 0.92, -0.58); g.quadraticCurveTo(0, -0.42, -0.92, -0.58); g.closePath(); }, Y, { d: 0.1, det: function(g) {
      g.beginPath(); g.moveTo(-0.12, -1.14); g.quadraticCurveTo(0, -1.18, 0.12, -1.14); g.lineTo(0.14, -0.5); g.lineTo(-0.14, -0.5); g.closePath(); g.fillStyle = Y.sombra; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;
    } });
    forma(g, w, rr(-0.18, -0.92, 0.36, 0.22, 0.06), pal("#e9ecef"), { d: 0.03, det: function(g) { g.beginPath(); g.arc(0, -0.81, 0.07, 0, PI2); g.fillStyle = "#fff3a8"; g.fill(); } });
  };
  AC.coelho = function(g, w) {
    var P = pal2("#f8f9fa", "#d0d6e6", "#4a4f7a", "#ffffff"), I = pal("#ffa8c5");
    fora(g, function() { par(g, function(g, s) {
      g.save(); g.translate(0.36, -0.86); g.rotate(0.22);
      forma(g, w, function(g) { g.moveTo(-0.17, 0.05); g.bezierCurveTo(-0.32, -0.5, -0.24, -1.0, 0, -1.05); g.bezierCurveTo(0.24, -1.0, 0.32, -0.5, 0.17, 0.05); g.closePath(); }, P, { d: 0.07 });
      forma(g, w, function(g) { g.moveTo(-0.08, -0.05); g.bezierCurveTo(-0.17, -0.45, -0.12, -0.85, 0, -0.9); g.bezierCurveTo(0.12, -0.85, 0.17, -0.45, 0.08, -0.05); g.closePath(); }, I, { d: 0.03, semBorda: 1 });
      g.restore();
    }); });
    forma(g, w, function(g) { g.arc(0, 0, 1.05, PI + 0.42, PI2 - 0.42); g.arc(0, 0, 0.92, PI2 - 0.42, PI + 0.42, true); g.closePath(); }, pal("#ff8fb8"), { d: 0.04 });
  };
  AC.natal = function(g, w) {
    var V = pal("#e03131"), B = pal2("#f8f9fa", "#d0d6e6", "#4a4f7a", "#ffffff");
    forma(g, w, function(g) { g.moveTo(-0.9, -0.62); g.bezierCurveTo(-0.85, -1.45, 0.2, -1.75, 0.9, -1.45); g.quadraticCurveTo(1.2, -1.25, 1.2, -0.95); g.quadraticCurveTo(0.95, -1.15, 0.7, -1.05); g.quadraticCurveTo(0.85, -0.8, 0.9, -0.62); g.quadraticCurveTo(0, -0.4, -0.9, -0.62); g.closePath(); }, V, { d: 0.1 });
    forma(g, w, function(g) { g.moveTo(-1.02, -0.72); g.quadraticCurveTo(0, -0.5, 1.02, -0.72); g.quadraticCurveTo(1.08, -0.56, 1.0, -0.42); g.quadraticCurveTo(0, -0.2, -1.0, -0.42); g.quadraticCurveTo(-1.08, -0.56, -1.02, -0.72); g.closePath(); }, B, { d: 0.05 });
    forma(g, w, elp(1.2, -0.9, 0.19, 0.18, 0), B, { d: 0.05 });
  };
  AC.bruxa = function(g, w) {
    var R1 = pal("#5f3dc4"), O = pal("#ffd43b");
    forma(g, w, elp(0, -0.7, 1.3, 0.24, -0.04), R1, { d: 0.07 });
    forma(g, w, function(g) { g.moveTo(-0.62, -0.74); g.quadraticCurveTo(-0.3, -1.4, 0.1, -1.6); g.quadraticCurveTo(0.45, -1.78, 0.78, -1.62); g.quadraticCurveTo(0.42, -1.5, 0.36, -1.3); g.lineTo(0.62, -0.74); g.quadraticCurveTo(0, -0.56, -0.62, -0.74); g.closePath(); }, R1, { d: 0.1, det: function(g) {
      g.beginPath(); g.moveTo(-0.66, -0.98); g.quadraticCurveTo(0, -0.82, 0.62, -0.98); g.lineTo(0.62, -0.76); g.quadraticCurveTo(0, -0.58, -0.66, -0.76); g.closePath(); g.fillStyle = "#e64980"; g.fill(); g.strokeStyle = R1.contorno; g.lineWidth = w * 0.7; g.stroke();
    } });
    forma(g, w * 0.8, rr(-0.13, -0.98, 0.26, 0.22, 0.04), O, { d: 0.03, det: function(g) { g.fillStyle = "#e64980"; g.fillRect(-0.06, -0.92, 0.12, 0.1); } });
  };
  AC.sombrero = function(g, w) {
    var P = pal("#f2c14e"), V = pal("#e03131"), G = pal("#2f9e44");
    forma(g, w, function(g) { g.moveTo(-1.6, -0.62); g.quadraticCurveTo(-1.2, -0.92, -0.6, -0.86); g.quadraticCurveTo(0, -0.78, 0.6, -0.86); g.quadraticCurveTo(1.2, -0.92, 1.6, -0.62); g.quadraticCurveTo(1.0, -0.44, 0, -0.46); g.quadraticCurveTo(-1.0, -0.44, -1.6, -0.62); g.closePath(); }, P, { d: 0.07 });
    forma(g, w, function(g) { g.moveTo(-0.58, -0.82); g.bezierCurveTo(-0.62, -1.6, 0.62, -1.6, 0.58, -0.82); g.quadraticCurveTo(0, -0.7, -0.58, -0.82); g.closePath(); }, P, { d: 0.1, det: function(g) {
      g.beginPath(); g.moveTo(-0.62, -1.0); g.quadraticCurveTo(0, -0.9, 0.62, -1.0); g.lineTo(0.6, -0.84); g.quadraticCurveTo(0, -0.72, -0.6, -0.84); g.closePath(); g.fillStyle = V.base; g.fill();
      g.beginPath(); for (var i = 0; i <= 10; i++) g.lineTo(-0.6 + i * 0.12, -0.92 + (i & 1 ? -0.05 : 0.04) + 0.06 * (1 - Math.pow((i - 5) / 5, 2))); g.strokeStyle = G.base; g.lineWidth = 0.05; g.stroke();
    } });
  };
  AC.moicano = function(g, w) {
    var P = pal("#f03e8c"), V = pal("#ffd43b");
    fora(g, function() {
      forma(g, w, function(g) {
        g.moveTo(-0.22, -0.9); g.lineTo(-0.3, -1.42); g.lineTo(-0.1, -1.18); g.lineTo(-0.08, -1.72); g.lineTo(0.06, -1.3); g.lineTo(0.18, -1.66); g.lineTo(0.2, -1.22); g.lineTo(0.38, -1.4); g.lineTo(0.24, -0.9); g.closePath();
      }, P, { d: 0.07, det: function(g) { tracoCurvo(g, w * 0.8, V.base, -0.04, -0.98, -0.07, -1.3, -0.08, -1.62, 0.9); } });
    });
  };
  AC.pirata = function(g, w) {
    var P = pal("#2b2d42"), O = pal("#fab005");
    forma(g, w, function(g) { g.moveTo(-1.25, -0.82); g.quadraticCurveTo(-0.9, -1.65, 0, -1.55); g.quadraticCurveTo(0.9, -1.65, 1.25, -0.82); g.quadraticCurveTo(0.6, -0.42, 0, -0.62); g.quadraticCurveTo(-0.6, -0.42, -1.25, -0.82); g.closePath(); }, P, { d: 0.1, det: function(g) {
      g.beginPath(); g.moveTo(-1.18, -0.86); g.quadraticCurveTo(-0.6, -0.5, 0, -0.68); g.quadraticCurveTo(0.6, -0.5, 1.18, -0.86); g.strokeStyle = O.base; g.lineWidth = 0.06; g.stroke();
    } });
    // caveirinha
    var B = pal2("#f8f9fa", "#c5cbe0", "#2b2d42");
    forma(g, w * 0.8, function(g) { g.moveTo(-0.17, -1.1); g.bezierCurveTo(-0.2, -1.38, 0.2, -1.38, 0.17, -1.1); g.lineTo(0.1, -1.02); g.lineTo(-0.1, -1.02); g.closePath(); }, B, { d: 0.02, det: function(g) {
      g.fillStyle = "#2b2d42"; g.beginPath(); g.arc(-0.07, -1.18, 0.045, 0, PI2); g.arc(0.07, -1.18, 0.045, 0, PI2); g.fill();
    } });
    g.strokeStyle = B.base; g.lineWidth = 0.05; g.lineCap = "round";
    g.beginPath(); g.moveTo(-0.26, -0.98); g.lineTo(0.26, -0.86); g.moveTo(0.26, -0.98); g.lineTo(-0.26, -0.86); g.stroke();
  };
  AC.louros = function(g, w) {
    var F = pal("#fab005"), i, a;
    for (i = 0; i < 2; i++) {
      var s = i ? 1 : -1;
      for (var k = 0; k < 6; k++) {
        a = PI * 1.5 + s * (0.25 + k * 0.2); var cx = Math.cos(a) * 1.0, cy = Math.sin(a) * 1.0, rot = a + PI / 2 * s;
        forma(g, w * 0.8, elp(cx + Math.cos(a) * 0.06, cy + Math.sin(a) * 0.06, 0.19, 0.08, rot - s * 0.5), F, { d: 0.03 });
        forma(g, w * 0.8, elp(cx - Math.cos(a) * 0.06, cy - Math.sin(a) * 0.06, 0.17, 0.07, rot + s * 0.5), F, { d: 0.03 });
      }
    }
    g.beginPath(); g.arc(0, 0, 1.0, PI * 1.5 - 1.35, PI * 1.5 + 1.35); g.strokeStyle = F.contorno; g.lineWidth = 0.05; g.stroke();
  };
  AC.barbatana = function(g, w) {
    var P = pal2("#8ca0c8", "#62749e", "#2a3159", "#d6e0f5");
    fora(g, function() {
      forma(g, w, function(g) { g.moveTo(-0.4, -0.9); g.quadraticCurveTo(-0.15, -1.55, 0.5, -1.85); g.quadraticCurveTo(0.3, -1.35, 0.45, -0.9); g.closePath(); }, P, { d: 0.08, det: function(g) {
        tracoCurvo(g, w * 0.7, P.brilho, -0.25, -1.0, -0.05, -1.45, 0.4, -1.7, 0.8);
      } });
    });
  };
  AC.tiara_princesa = function(g, w) {
    var G = pal("#fcc419"), J = pal("#f06595"), Z = pal("#74c0fc");
    forma(g, w, function(g) { g.moveTo(-0.66, -0.76); g.quadraticCurveTo(0, -0.62, 0.66, -0.76); g.lineTo(0.58, -0.92); g.lineTo(0.34, -0.96); g.lineTo(0.2, -1.12); g.lineTo(0, -1.36); g.lineTo(-0.2, -1.12); g.lineTo(-0.34, -0.96); g.lineTo(-0.58, -0.92); g.closePath(); }, G, { d: 0.06 });
    forma(g, w * 0.8, elp(0, -1.06, 0.09, 0.11, 0), J, { d: 0.03 });
    forma(g, w * 0.8, elp(-0.38, -0.84, 0.06, 0.06, 0), Z, { d: 0.02 });
    forma(g, w * 0.8, elp(0.38, -0.84, 0.06, 0.06, 0), Z, { d: 0.02 });
  };
  AC.coroa_gelo = function(g, w) {
    var G = pal2("#a5d8ff", "#5c9ad6", "#1c4f8a", "#f1faff");
    forma(g, w, function(g) {
      g.moveTo(-0.68, -0.72); g.lineTo(-0.8, -1.3); g.lineTo(-0.5, -1.05); g.lineTo(-0.36, -1.62); g.lineTo(-0.16, -1.1); g.lineTo(0, -1.85); g.lineTo(0.16, -1.1); g.lineTo(0.36, -1.62); g.lineTo(0.5, -1.05); g.lineTo(0.8, -1.3); g.lineTo(0.68, -0.72);
      g.quadraticCurveTo(0, -0.56, -0.68, -0.72); g.closePath();
    }, G, { d: 0.09, det: function(g) {
      g.strokeStyle = "#ffffff"; g.lineWidth = 0.035; g.globalAlpha = 0.8; g.lineCap = "round";
      g.beginPath(); g.moveTo(-0.36, -1.5); g.lineTo(-0.3, -1.0); g.moveTo(0, -1.72); g.lineTo(0.02, -1.0); g.moveTo(0.36, -1.5); g.lineTo(0.32, -1.0); g.stroke(); g.globalAlpha = 1;
    } });
    forma(g, w * 0.8, elp(0, -0.8, 0.1, 0.1, 0), pal("#d0bfff"), { d: 0.03 });
  };
  DIN.coroa_gelo = function(ctx, sp, R, t) {
    ctx.drawImage(sp.c, -sp.ox, -sp.oy);
    var k = 0.5 + 0.5 * Math.sin(t * 5), a = R * 0.16 * k, x = 0.42 * R, y = -1.68 * R;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(x, y - a); ctx.lineTo(x + a * 0.22, y - a * 0.22); ctx.lineTo(x + a, y); ctx.lineTo(x + a * 0.22, y + a * 0.22); ctx.lineTo(x, y + a); ctx.lineTo(x - a * 0.22, y + a * 0.22); ctx.lineTo(x - a, y); ctx.lineTo(x - a * 0.22, y - a * 0.22); ctx.closePath(); ctx.fill();
  };

  // ----- olhos -----
  AC.sobrancelha = function(g, w) {
    var C = pal("#4a2b17");
    par(g, function(g) {
      g.beginPath(); g.moveTo(EX - 0.2, EY - 0.36); g.quadraticCurveTo(EX, EY - 0.47, EX + 0.22, EY - 0.4);
      g.strokeStyle = C.contorno; g.lineWidth = 0.13 + w * 1.4; g.lineCap = "round"; g.stroke(); g.strokeStyle = C.base; g.lineWidth = 0.13; g.stroke();
      g.beginPath(); g.moveTo(EX - 0.12, EY - 0.41); g.quadraticCurveTo(EX, EY - 0.46, EX + 0.1, EY - 0.43); g.strokeStyle = "#8a5a32"; g.lineWidth = 0.035; g.stroke();
    });
  };
  AC.cilios = function(g, w) {
    par(g, function(g) {
      g.strokeStyle = "#1b1030"; g.lineCap = "round"; g.lineWidth = 0.055;
      [[-0.45, 0.13], [-0.18, 0.15], [0.12, 0.13]].forEach(function(q) {
        var a = -PI / 2 + q[0] + 0.55, x = EX + Math.cos(a) * 0.215, y = EY + Math.sin(a) * 0.295;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * q[1] * 0.6, y + Math.sin(a) * q[1] * 0.8, x + Math.cos(a + 0.35) * q[1], y + Math.sin(a + 0.35) * q[1] - 0.02); g.stroke();
      });
    });
  };
  function lenteForma(x0, y0, wl, hl) { return function(g) { g.moveTo(x0, y0); g.lineTo(x0 + wl, y0); g.quadraticCurveTo(x0 + wl, y0 + hl, x0 + wl * 0.5, y0 + hl); g.quadraticCurveTo(x0, y0 + hl, x0, y0); g.closePath(); }; }
  AC.oculos_sol = function(g, w) {
    var F = pal("#1b1030");
    [-1, 1].forEach(function(s) {
      var x0 = s > 0 ? 0.04 : -0.6, l = lenteForma(x0, -0.36, 0.56, 0.5);
      g.beginPath(); l(g); g.fillStyle = "#1d1838"; g.fill();
      g.save(); g.beginPath(); l(g); g.clip();
      g.fillStyle = "rgba(120,160,255,0.35)"; g.beginPath(); g.moveTo(x0 + 0.05, -0.08); g.lineTo(x0 + 0.3, -0.38); g.lineTo(x0 + 0.42, -0.38); g.lineTo(x0 + 0.17, -0.02); g.closePath(); g.fill();
      g.restore();
      g.beginPath(); l(g); g.strokeStyle = F.contorno; g.lineWidth = 0.07 + w; g.lineJoin = "round"; g.stroke();
      g.beginPath(); g.moveTo(s * 0.6, -0.3); g.quadraticCurveTo(s * 0.82, -0.32, s * 1.0, -0.2); g.strokeStyle = "#1d1838"; g.lineWidth = 0.08; g.lineCap = "round"; g.stroke();
    });
    g.beginPath(); g.moveTo(-0.06, -0.3); g.quadraticCurveTo(0, -0.36, 0.06, -0.3); g.strokeStyle = "#1d1838"; g.lineWidth = 0.08; g.stroke();
  };
  AC.tapa_olho = function(g, w) {
    var P = pal("#212529");
    dentroCabeca(g, function() {
      g.beginPath(); g.moveTo(-1.0, -0.62); g.lineTo(1.0, 0.18); g.strokeStyle = P.contorno; g.lineWidth = 0.08 + w * 1.4; g.stroke(); g.strokeStyle = "#343a40"; g.lineWidth = 0.08; g.stroke();
    });
    forma(g, w, elp(EX, EY + 0.02, 0.26, 0.3, 0), P, { d: 0.05, det: function(g) { tracoCurvo(g, w * 0.8, "#6c757d", EX - 0.14, EY - 0.12, EX - 0.05, EY - 0.22, EX + 0.08, EY - 0.22, 0.8); } });
  };
  AC.mascara_heroi = function(g, w) {
    var P = pal("#e03131");
    forma(g, w, function(g) {
      g.moveTo(-0.92, -0.3); g.quadraticCurveTo(-0.6, -0.48, 0, -0.36); g.quadraticCurveTo(0.6, -0.48, 0.92, -0.3); g.quadraticCurveTo(0.95, 0.06, 0.62, 0.18);
      g.quadraticCurveTo(0.2, 0.2, 0, 0.06); g.quadraticCurveTo(-0.2, 0.2, -0.62, 0.18); g.quadraticCurveTo(-0.95, 0.06, -0.92, -0.3); g.closePath();
      g.moveTo(EX + 0.2, EY); g.ellipse(EX, EY, 0.2, 0.2, 0, 0, PI2, true);
      g.moveTo(-EX + 0.2, EY); g.ellipse(-EX, EY, 0.2, 0.2, 0, 0, PI2, true);
    }, P, { d: 0.05 });
    fora(g, function() { par(g, function(g) { forma(g, w, function(g) { g.moveTo(0.9, -0.18); g.quadraticCurveTo(1.25, -0.25, 1.4, 0.05); g.quadraticCurveTo(1.2, 0.0, 0.92, 0.0); g.closePath(); }, P, { d: 0.03 }); }); });
  };
  AC.monoculo = function(g, w) {
    var G = pal("#fab005");
    g.beginPath(); g.arc(EX, EY, 0.25, 0, PI2); g.fillStyle = "rgba(190,230,255,0.22)"; g.fill();
    g.beginPath(); g.arc(EX, EY, 0.25, 0, PI2); g.strokeStyle = G.contorno; g.lineWidth = 0.07 + w * 1.4; g.stroke(); g.strokeStyle = G.base; g.lineWidth = 0.07; g.stroke();
    g.beginPath(); g.arc(EX, EY, 0.25, PI * 1.1, PI * 1.4); g.strokeStyle = G.brilho; g.lineWidth = 0.025; g.stroke();
    g.beginPath(); g.moveTo(EX + 0.2, EY + 0.15); g.quadraticCurveTo(EX + 0.35, EY + 0.55, EX + 0.62, EY + 0.62);
    g.setLineDash([0.04, 0.04]); g.strokeStyle = G.base; g.lineWidth = 0.035; g.stroke(); g.setLineDash([]);
  };
  AC.pintura_guerra = function(g, w) {
    dentroCabeca(g, function() {
      par(g, function(g) {
        g.lineCap = "round";
        [[0.2, "#1c7ed6"], [0.3, "#e03131"]].forEach(function(q) {
          g.beginPath(); g.moveTo(EX - 0.13, q[0] + 0.02); g.lineTo(EX + 0.2, q[0] - 0.02);
          g.strokeStyle = "#1a0d33"; g.lineWidth = 0.075 + w; g.stroke(); g.strokeStyle = q[1]; g.lineWidth = 0.075; g.stroke();
        });
      });
    });
  };
  function oculosForma(g, w, lente, cor, tinta) {
    var F = pal(cor);
    [-1, 1].forEach(function(s) {
      g.save(); g.translate(s * EX, EY);
      g.beginPath(); lente(g); g.fillStyle = tinta; g.fill();
      g.beginPath(); lente(g); g.strokeStyle = F.contorno; g.lineWidth = 0.08 + w * 1.4; g.lineJoin = "round"; g.stroke(); g.strokeStyle = F.base; g.lineWidth = 0.08; g.stroke();
      g.restore();
      g.beginPath(); g.moveTo(s * 0.6, -0.12); g.quadraticCurveTo(s * 0.8, -0.18, s * 1.0, -0.08); g.strokeStyle = F.contorno; g.lineWidth = 0.08 + w; g.lineCap = "round"; g.stroke(); g.strokeStyle = F.base; g.lineWidth = 0.08; g.stroke();
    });
    g.beginPath(); g.moveTo(-0.08, -0.12); g.quadraticCurveTo(0, -0.2, 0.08, -0.12); g.strokeStyle = F.contorno; g.lineWidth = 0.08 + w; g.stroke(); g.strokeStyle = F.base; g.lineWidth = 0.08; g.stroke();
  }
  AC.oculos_coracao = function(g, w) { oculosForma(g, w, function(g) { g.moveTo(0, 0.3); g.bezierCurveTo(-0.42, 0.05, -0.36, -0.36, 0, -0.2); g.bezierCurveTo(0.36, -0.36, 0.42, 0.05, 0, 0.3); g.closePath(); }, "#f03e8c", "rgba(255,90,150,0.45)"); };
  AC.oculos_estrela = function(g, w) { oculosForma(g, w, function(g) { for (var i = 0; i < 10; i++) { var a = -PI / 2 + i * PI / 5, q = i % 2 ? 0.14 : 0.32; g.lineTo(Math.cos(a) * q, Math.sin(a) * q + 0.02); } g.closePath(); }, "#fab005", "rgba(255,220,80,0.45)"); };
  AC.visor = function(g, w) {
    var F = pal("#343a5c");
    var v = rr(-0.8, -0.36, 1.6, 0.5, 0.22);
    g.beginPath(); v(g); g.fillStyle = "rgba(60,230,255,0.42)"; g.fill();
    g.save(); g.beginPath(); v(g); g.clip();
    g.strokeStyle = "rgba(200,255,255,0.5)"; g.lineWidth = 0.02;
    for (var y = -0.3; y < 0.14; y += 0.07) { g.beginPath(); g.moveTo(-0.8, y); g.lineTo(0.8, y); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.moveTo(-0.62, 0.1); g.lineTo(-0.36, -0.36); g.lineTo(-0.24, -0.36); g.lineTo(-0.5, 0.1); g.closePath(); g.fill();
    g.restore();
    g.beginPath(); v(g); g.strokeStyle = F.contorno; g.lineWidth = 0.1 + w * 1.4; g.stroke(); g.strokeStyle = F.base; g.lineWidth = 0.1; g.stroke();
    par(g, function(g) { forma(g, w, elp(0.86, -0.11, 0.1, 0.16, 0), F, { d: 0.03, det: function(g) { g.beginPath(); g.arc(0.86, -0.11, 0.04, 0, PI2); g.fillStyle = "#3df2b0"; g.fill(); } }); });
  };

  // ----- boca -----
  AC.dentucos = function(g, w) {
    var D = pal2("#ffffff", "#d0d6e6", "#4a4f7a");
    forma(g, w * 0.8, rr(-0.1, MY - 0.02, 0.095, 0.14, 0.03), D, { d: 0.015 });
    forma(g, w * 0.8, rr(0.005, MY - 0.02, 0.095, 0.14, 0.03), D, { d: 0.015 });
  };
  AC.bigode = function(g, w) {
    var C = pal("#5c3a1e");
    forma(g, w, function(g) {
      g.moveTo(0, MY - 0.2); g.bezierCurveTo(0.12, MY - 0.3, 0.36, MY - 0.28, 0.42, MY - 0.14); g.quadraticCurveTo(0.46, MY - 0.04, 0.38, MY - 0.06);
      g.quadraticCurveTo(0.2, MY - 0.14, 0, MY - 0.1); g.quadraticCurveTo(-0.2, MY - 0.14, -0.38, MY - 0.06); g.quadraticCurveTo(-0.46, MY - 0.04, -0.42, MY - 0.14);
      g.bezierCurveTo(-0.36, MY - 0.28, -0.12, MY - 0.3, 0, MY - 0.2); g.closePath();
    }, C, { d: 0.04 });
  };
  AC.bigode_fino = function(g, w) {
    var C = pal("#1b1030");
    par(g, function(g) {
      g.beginPath(); g.moveTo(0.02, MY - 0.16); g.quadraticCurveTo(0.22, MY - 0.24, 0.36, MY - 0.18); g.quadraticCurveTo(0.5, MY - 0.1, 0.44, MY - 0.3);
      g.strokeStyle = C.base; g.lineWidth = 0.06; g.lineCap = "round"; g.stroke();
    });
  };
  AC.chupeta = function(g, w) {
    var A = pal("#74c0fc"), B = pal("#ffffff"), C = pal("#ff8fb8");
    g.beginPath(); g.arc(0, MY + 0.2, 0.11, 0, PI2); g.strokeStyle = C.contorno; g.lineWidth = 0.07 + w * 1.4; g.stroke(); g.strokeStyle = C.base; g.lineWidth = 0.07; g.stroke();
    forma(g, w, elp(0, MY + 0.02, 0.24, 0.13, 0), A, { d: 0.04 });
    forma(g, w * 0.8, elp(0, MY + 0.03, 0.07, 0.07, 0), B, { d: 0.02 });
  };
  AC.presas = function(g, w) {
    var D = pal2("#ffffff", "#d0d6e6", "#4a4f7a");
    par(g, function(g) { forma(g, w * 0.8, function(g) { g.moveTo(0.05, MY - 0.03); g.lineTo(0.15, MY - 0.03); g.lineTo(0.1, MY + 0.13); g.closePath(); }, D, { d: 0.01 }); });
  };
  AC.pirulito = function(g, w) {
    var P = pal("#ff6b9d");
    g.beginPath(); g.moveTo(0.08, MY + 0.02); g.lineTo(0.52, MY + 0.3); g.strokeStyle = "#4a4f7a"; g.lineWidth = 0.06 + w * 1.4; g.lineCap = "round"; g.stroke(); g.strokeStyle = "#f8f9fa"; g.lineWidth = 0.06; g.stroke();
    forma(g, w, elp(0.62, MY + 0.36, 0.2, 0.2, 0), P, { d: 0.05, det: function(g) {
      g.beginPath(); for (var i = 0; i < 40; i++) { var a = i * 0.45, q = i / 40 * 0.19; g.lineTo(0.62 + Math.cos(a) * q, MY + 0.36 + Math.sin(a) * q); }
      g.strokeStyle = "#fff0f6"; g.lineWidth = 0.04; g.stroke();
    } });
  };
  AC.barba = function(g, w) {
    var C = pal("#6b4226");
    forma(g, w, function(g) {
      g.moveTo(-0.86, 0.22); g.quadraticCurveTo(-0.6, 0.52, -0.3, 0.52); g.quadraticCurveTo(0, 0.6, 0.3, 0.52); g.quadraticCurveTo(0.6, 0.52, 0.86, 0.22);
      g.quadraticCurveTo(0.9, 0.8, 0.5, 1.02); g.quadraticCurveTo(0.25, 1.15, 0, 1.08); g.quadraticCurveTo(-0.25, 1.15, -0.5, 1.02); g.quadraticCurveTo(-0.9, 0.8, -0.86, 0.22); g.closePath();
    }, C, { d: 0.07, det: function(g) { tracoCurvo(g, w * 0.7, C.contorno, -0.3, 0.7, -0.2, 0.9, -0.1, 0.95, 0.4); tracoCurvo(g, w * 0.7, C.contorno, 0.3, 0.7, 0.2, 0.9, 0.1, 0.95, 0.4); } });
    AC.bigode(g, w);
  };
  AC.bandana = function(g, w) {
    var P = pal("#e03131");
    dentroCabeca(g, function() {
      forma(g, w, function(g) { g.moveTo(-1.1, 0.12); g.quadraticCurveTo(0, 0.28, 1.1, 0.12); g.lineTo(1.1, 0.5); g.lineTo(0.05, 1.05); g.lineTo(-1.1, 0.5); g.closePath(); }, P, { d: 0.08, det: function(g) {
        [[-0.5, 0.4], [0.5, 0.4], [0, 0.55], [-0.25, 0.75], [0.25, 0.75], [-0.75, 0.32], [0.75, 0.32]].forEach(function(p) { g.beginPath(); g.arc(p[0], p[1], 0.045, 0, PI2); g.fillStyle = "#fff"; g.fill(); });
      } });
      tracoCurvo(g, w, P.contorno, -1.1, 0.12, 0, 0.28, 1.1, 0.12);
    });
  };
  AC.cachimbo = function(g, w) {
    var M = pal("#8a5a32"), A = pal("#74c0fc");
    g.beginPath(); g.moveTo(0.06, MY + 0.02); g.quadraticCurveTo(0.3, MY + 0.12, 0.5, MY + 0.12); g.strokeStyle = M.contorno; g.lineWidth = 0.07 + w * 1.4; g.lineCap = "round"; g.stroke(); g.strokeStyle = M.base; g.lineWidth = 0.07; g.stroke();
    forma(g, w, function(g) { g.moveTo(0.46, MY - 0.04); g.lineTo(0.72, MY - 0.04); g.quadraticCurveTo(0.74, MY + 0.24, 0.59, MY + 0.24); g.quadraticCurveTo(0.44, MY + 0.24, 0.46, MY - 0.04); g.closePath(); }, M, { d: 0.04 });
    g.beginPath(); g.ellipse(0.59, MY - 0.04, 0.13, 0.04, 0, 0, PI2); g.fillStyle = A.base; g.fill();
  };
  DIN.cachimbo = function(ctx, sp, R, t) {
    ctx.drawImage(sp.c, -sp.ox, -sp.oy);
    ctx.lineWidth = Math.max(1, R * 0.03); ctx.strokeStyle = "rgba(200,240,255,0.9)";
    for (var i = 0; i < 3; i++) {
      var f = (t * 0.7 + i / 3) % 1, x = (0.6 + Math.sin(f * 7 + i) * 0.08) * R, y = (MY - 0.12 - f * 0.9) * R, rr0 = (0.05 + f * 0.07) * R;
      ctx.globalAlpha = 1 - f; ctx.beginPath(); ctx.arc(x, y, rr0, 0, PI2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  AC.rosa_boca = function(g, w) {
    var V = pal("#2f9e44"), R1 = pal("#e03131");
    g.beginPath(); g.moveTo(-0.3, MY + 0.02); g.quadraticCurveTo(0.05, MY + 0.08, 0.38, MY - 0.02); g.strokeStyle = V.contorno; g.lineWidth = 0.05 + w * 1.4; g.lineCap = "round"; g.stroke(); g.strokeStyle = V.base; g.lineWidth = 0.05; g.stroke();
    forma(g, w * 0.8, elp(0.12, MY + 0.12, 0.1, 0.05, 0.5), V, { d: 0.02 });
    forma(g, w, elp(-0.38, MY - 0.02, 0.17, 0.15, 0), R1, { d: 0.05, det: function(g) {
      g.beginPath(); for (var i = 0; i < 24; i++) { var a = i * 0.6, q = 0.02 + i / 24 * 0.12; g.lineTo(-0.38 + Math.cos(a) * q, MY - 0.03 + Math.sin(a) * q * 0.9); }
      g.strokeStyle = R1.contorno; g.lineWidth = 0.025; g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
    } });
  };

  // ----- acessórios (corpo) -----
  AC.gravata = function(g, w) {
    var P = pal("#e03131");
    par(g, function(g) { forma(g, w, function(g) { g.moveTo(0.06, 0.86); g.lineTo(0.42, 0.7); g.quadraticCurveTo(0.48, 0.88, 0.42, 1.06); g.closePath(); }, P, { d: 0.04 }); });
    forma(g, w, rr(-0.09, 0.79, 0.18, 0.16, 0.05), P, { d: 0.02 });
  };
  AC.cachecol = function(g, w) {
    var P = pal("#e03131"), B = "#f8f9fa";
    dentroCabeca(g, function() {
      forma(g, w, function(g) { g.moveTo(-1.1, 0.56); g.quadraticCurveTo(0, 0.86, 1.1, 0.56); g.lineTo(1.1, 0.9); g.quadraticCurveTo(0, 1.2, -1.1, 0.9); g.closePath(); }, P, { d: 0.06, det: function(g) {
        for (var i = -5; i <= 5; i += 2) { g.beginPath(); g.moveTo(i * 0.18, 0.62 + 0.14 * (1 - i * i / 30)); g.lineTo(i * 0.18 + 0.1, 0.96 + 0.14 * (1 - i * i / 30)); g.strokeStyle = B; g.lineWidth = 0.07; g.stroke(); }
      } });
    });
    forma(g, w, function(g) { g.moveTo(0.45, 0.8); g.lineTo(0.72, 0.84); g.lineTo(0.82, 1.08); g.lineTo(0.52, 1.08); g.closePath(); }, P, { d: 0.04 });
  };
  AC.capa = function(g, w) {
    var P = pal("#c92a2a");
    fora(g, function() {
      forma(g, w, function(g) { g.moveTo(-0.7, -0.2); g.quadraticCurveTo(-1.35, 0.4, -1.5, 1.06); g.quadraticCurveTo(-0.75, 0.94, 0, 1.06); g.quadraticCurveTo(0.75, 0.94, 1.5, 1.06); g.quadraticCurveTo(1.35, 0.4, 0.7, -0.2); g.closePath(); }, P, { d: 0.08 });
    });
    par(g, function(g) { forma(g, w * 0.8, elp(0.6, 0.72, 0.08, 0.08, 0), pal("#fcc419"), { d: 0.02 }); });
  };
  AC.colar_ouro = function(g, w) {
    var G = pal("#fcc419");
    dentroCabeca(g, function() {
      g.beginPath(); g.moveTo(-0.98, 0.4); g.quadraticCurveTo(0, 1.0, 0.98, 0.4);
      g.setLineDash([0.07, 0.035]); g.strokeStyle = G.contorno; g.lineWidth = 0.07 + w; g.stroke(); g.strokeStyle = G.base; g.lineWidth = 0.07; g.stroke(); g.setLineDash([]);
    });
    forma(g, w, elp(0, 0.84, 0.17, 0.17, 0), G, { d: 0.05, det: function(g) { g.fillStyle = G.sombra; est5(g, 0, 0.85, 0.1, 0.045); g.fill(); } });
  };
  function asas(g, w, P, pena) {
    fora(g, function() { par(g, function(g) {
      forma(g, w, function(g) { g.moveTo(0.7, -0.32); g.bezierCurveTo(1.0, -0.95, 1.55, -0.9, 1.66, -0.45); g.quadraticCurveTo(1.6, 0.15, 1.25, 0.32); g.quadraticCurveTo(1.0, 0.45, 0.75, 0.28); g.closePath(); }, P, { d: 0.07, det: pena });
    }); });
  }
  AC.asas_anjo = function(g, w) {
    var P = pal2("#f8f9fa", "#c5d0ea", "#4a4f7a", "#ffffff");
    asas(g, w, P, function(g) { for (var i = 0; i < 4; i++) tracoCurvo(g, w * 0.7, P.contorno, 0.95 + i * 0.12, -0.3 + i * 0.02, 1.15 + i * 0.12, 0.0, 1.0 + i * 0.1, 0.3, 0.4); });
  };
  AC.asas_morcego = function(g, w) {
    var P = pal("#5c3d8a");
    fora(g, function() { par(g, function(g) {
      forma(g, w, function(g) { g.moveTo(0.7, -0.3); g.lineTo(1.1, -0.75); g.lineTo(1.66, -0.62); g.quadraticCurveTo(1.5, -0.3, 1.6, 0.02); g.quadraticCurveTo(1.35, -0.1, 1.25, 0.18); g.quadraticCurveTo(1.05, 0.0, 0.95, 0.26); g.quadraticCurveTo(0.85, 0.1, 0.7, 0.2); g.closePath(); }, P, { d: 0.06, det: function(g) {
        g.strokeStyle = P.contorno; g.lineWidth = w * 0.8; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(1.1, -0.72); g.lineTo(1.25, 0.15); g.moveTo(1.1, -0.72); g.lineTo(0.95, 0.24); g.stroke(); g.globalAlpha = 1;
      } });
    }); });
  };
  AC.asas_fada = function(g, w) {
    var A = pal("#99e9f2"), B = pal("#fcc2d7");
    fora(g, function() { par(g, function(g) {
      g.globalAlpha = 0.8;
      forma(g, w, elp(1.15, -0.55, 0.5, 0.3, -0.5), A, { d: 0.05 });
      forma(g, w, elp(1.05, 0.12, 0.36, 0.22, 0.45), B, { d: 0.04 });
      g.globalAlpha = 1;
    }); });
  };
  DIN.asas_anjo = DIN.asas_morcego = DIN.asas_fada = function(ctx, sp, R, t) {
    ctx.save(); ctx.scale(1 + Math.sin(t * 7) * 0.07, 1 - Math.sin(t * 7) * 0.03); ctx.drawImage(sp.c, -sp.ox, -sp.oy); ctx.restore();
  };
  AC.satelite = function(g, w, R, S) {
    var c = cv(R * 0.8, R * 0.8), q = c.getContext("2d");      // o satélite em si (anda em volta da cabeça, ver DIN)
    q.translate(R * 0.4, R * 0.4); q.scale(R, R);
    forma(q, w, elp(0, 0, 0.16, 0.16, 0), pal("#ffa94d"), { d: 0.04 });
    q.beginPath(); q.ellipse(0, 0, 0.3, 0.08, -0.3, 0, PI2); q.strokeStyle = "#1a0d33"; q.lineWidth = 0.05 + w; q.stroke(); q.strokeStyle = "#ffe3a8"; q.lineWidth = 0.05; q.stroke();
    q.beginPath(); q.arc(0, 0, 0.16, PI, PI2); q.fillStyle = "#ffa94d"; q.fill();
    S.lua = c;
    g.globalAlpha = 0.001; g.fillRect(-0.01, -0.01, 0.02, 0.02); g.globalAlpha = 1;   // o sprite principal fica vazio
  };
  DIN.satelite = function(ctx, sp, R, t) {
    var a = t * 2.2, x = Math.cos(a) * 1.32 * R, y = (-0.35 + Math.sin(a) * 0.3) * R, c = sp.lua;
    if (Math.sin(a) < 0) { ctx.save(); ctx.beginPath(); ctx.rect(-3 * R, -3 * R, 6 * R, 6 * R); ctx.arc(0, 0, R * 0.985, 0, PI2, true); ctx.clip("evenodd"); }
    ctx.drawImage(c, x - c.width / 2, y - c.height / 2);
    if (Math.sin(a) < 0) ctx.restore();
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
    if (id && id.charCodeAt(0) === 118 && id.charAt(1) === "|") { camadas(ctx, id, x, y, r, olharX, escX, escY, t, q); return; }
    umItem(ctx, id, x, y, r, olharX, t, q);
  }
  function umItem(ctx, id, x, y, r, olharX, t, q) {
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

  // ---------- v19: camadas do visual ("v|lado|chapéu|acessório|olhos|boca|emote|rastro", dados/skins.js chaveCamadas) ----------
  var chaves = {};
  function lerChave(id) {
    var c = chaves[id];
    if (c) return c;
    var p = id.split("|");
    return (chaves[id] = { lado: +p[1] || 0, chapeu: p[2], acessorio: p[3], olhos: p[4], boca: p[5], emote: p[6], rastro: p[7] });
  }
  function telaPrincipal(ctx) { return ctx.canvas && ctx.canvas.id === "canvas"; }
  function camadas(ctx, id, x, y, r, olharX, escX, escY, t, q) {
    var c = lerChave(id), j = typeof jogo !== "undefined" ? jogo : null, prin = telaPrincipal(ctx);
    var b = prin && j && j.M && c.lado ? j.M.bolinhas[c.lado - 1] : null;
    if (b && b.rastroFx && b.rastroFx.pts.length) rastro(ctx, b, r, escX, escY, t);
    if (c.acessorio) umItem(ctx, c.acessorio, x, y, r, olharX, t, q);
    if (c.boca) umItem(ctx, c.boca, x, y, r, olharX, t, q);
    if (c.olhos) umItem(ctx, c.olhos, x, y, r, olharX, t, q);
    if (c.chapeu) umItem(ctx, c.chapeu, x, y, r, olharX, t, q);
    // comemoração: quem venceu a rodada/partida mostra o balão do emote (só na tela do jogo; o retrato do HUD não)
    if (c.emote && b && SKIN[c.emote]) {
      var fe = (j.fase === "fimRodada" && j.vencedorRodada === c.lado) ? j.tempoFase - 0.3 : (j.fase === "fimPartida" && j.vencedorPartida === c.lado) ? j.tempoFase + 1 : -1;
      if (fe > 0) { ctx.save(); ctx.scale(1 / (escX || 1), 1 / (escY || 1)); balao(ctx, SKIN[c.emote].icone, r, fe, escY < 0); ctx.restore(); }
    }
  }

  // balão do emote acima da cabeça (sprite por ícone; entra com um pulo e balança)
  var baloes = {};
  function spriteBalao(icone, q) {
    var k = icone + "|" + q;
    if (baloes[k]) return baloes[k];
    var W = 64 * q, H = 70 * q, c = cv(W, H), g = c.getContext("2d");
    g.scale(q, q);
    g.lineJoin = "round";
    g.beginPath(); g.moveTo(10, 6); g.arcTo(58, 6, 58, 50, 14); g.arcTo(58, 50, 10, 50, 14); g.lineTo(26, 50); g.lineTo(16, 64); g.lineTo(18, 50);
    g.arcTo(6, 50, 6, 6, 14); g.arcTo(6, 6, 58, 6, 14); g.closePath();
    g.fillStyle = "#ffffff"; g.fill(); g.strokeStyle = "#1a0d33"; g.lineWidth = 5; g.stroke();
    g.fillStyle = "#e7e3ff"; g.beginPath(); g.moveTo(10, 44); g.lineTo(54, 44); g.lineTo(54, 47); g.lineTo(10, 47); g.fill();
    if (typeof Icone !== "undefined") Icone.desenhar(g, icone, 32, 28, 34);
    return (baloes[k] = { c: c, w: 64, h: 70 });
  }
  function balao(ctx, icone, r, tf, inv) {
    var s = spriteBalao(icone, 2), e = tf < 0.18 ? 0.3 + tf / 0.18 * 0.9 : tf < 0.3 ? 1.2 - (tf - 0.18) / 0.12 * 0.2 : 1;
    var bob = Math.sin(tf * 6) * 3, k = r / 28 * e;
    ctx.save();
    ctx.translate(r * 0.7, inv ? r * 1.6 + 30 * k : -r * 1.45 - 30 * k + bob);
    ctx.rotate(Math.sin(tf * 4) * 0.08);
    ctx.drawImage(s.c, -s.w / 2 * k, -s.h / 2 * k, s.w * k, s.h * k);
    ctx.restore();
  }

  // ---------- v19: rastro (pontos guardados pelo motor em b.rastroFx; desenhado só fora do corpo, parece atrás) ----------
  var spr2 = {};
  function spritePart(tipo) {
    if (spr2[tipo]) return spr2[tipo];
    var S = 40, c = cv(S, S), g = c.getContext("2d");
    g.translate(S / 2, S / 2); g.lineJoin = "round";
    if (tipo === "fumaca") {
      g.beginPath(); g.arc(-4, 2, 11, 0, PI2); g.arc(6, -2, 12, 0, PI2); g.arc(2, 6, 10, 0, PI2); g.fillStyle = "#c9c4dd"; g.fill();
      g.beginPath(); g.arc(-6, -2, 6, 0, PI2); g.arc(4, -6, 6, 0, PI2); g.fillStyle = "#efecf8"; g.fill();
    } else if (tipo === "faisca") {
      g.fillStyle = "#1a0d33"; estrela4(g, 0, 0, 17, 6, 0); g.fillStyle = "#ffd43b"; estrela4(g, 0, 0, 13, 3.6, 0); g.fillStyle = "#fff8d0"; estrela4(g, 0, 0, 6, 1.6, 0);
    } else if (tipo === "estrela") {
      est5(g, 0, 0, 16, 7); g.fillStyle = "#ffd43b"; g.fill(); g.strokeStyle = "#1a0d33"; g.lineWidth = 3; g.stroke();
      est5(g, -2, -3, 7, 3); g.fillStyle = "#fff3bf"; g.fill();
    } else if (tipo === "bolha") {
      g.beginPath(); g.arc(0, 0, 13, 0, PI2); g.fillStyle = "rgba(160,220,255,0.35)"; g.fill(); g.strokeStyle = "#1a0d33"; g.lineWidth = 3; g.stroke();
      g.beginPath(); g.arc(0, 0, 10, PI * 1.1, PI * 1.6); g.strokeStyle = "#fff"; g.lineWidth = 2.5; g.lineCap = "round"; g.stroke();
    } else if (tipo === "gelo") {
      g.beginPath(); g.moveTo(0, -15); g.lineTo(8, 0); g.lineTo(0, 15); g.lineTo(-8, 0); g.closePath(); g.fillStyle = "#a5d8ff"; g.fill(); g.strokeStyle = "#1a0d33"; g.lineWidth = 3; g.stroke();
      g.beginPath(); g.moveTo(0, -11); g.lineTo(4, 0); g.lineTo(0, 0); g.closePath(); g.fillStyle = "#f1faff"; g.fill();
    } else if (tipo === "fogo") {
      g.beginPath(); g.moveTo(0, -16); g.bezierCurveTo(10, -4, 13, 6, 0, 14); g.bezierCurveTo(-13, 6, -10, -4, 0, -16); g.fillStyle = "#ff6a1f"; g.fill(); g.strokeStyle = "#8e2418"; g.lineWidth = 3; g.stroke();
      g.beginPath(); g.moveTo(0, -6); g.bezierCurveTo(6, 1, 7, 6, 0, 10); g.bezierCurveTo(-7, 6, -6, 1, 0, -6); g.fillStyle = "#ffd23f"; g.fill();
    }
    return (spr2[tipo] = c);
  }
  var TIPO_RASTRO = { r_fumaca: "fumaca", r_faiscas: "faisca", r_estrelas: "estrela", r_bolhas: "bolha", r_gelo: "gelo", r_fogo: "fogo" };
  function h1(n) { var s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }
  function rastro(ctx, b, r, escX, escY, t) {
    var fx = b.rastroFx, pts = fx.pts, n = pts.length, bx = Math.round(b.x), by = Math.round(b.y), i, p, a, k;
    ctx.save();
    ctx.scale(1 / (escX || 1), 1 / (escY || 1));
    // só fora do corpo (o que passa por cima da bolinha some: o rastro fica "atrás" dela)
    ctx.beginPath(); ctx.rect(-r * 12, -r * 12, r * 24, r * 24); ctx.ellipse(0, 0, r * Math.abs(escX || 1) * 1.02, r * Math.abs(escY || 1) * 1.02, 0, 0, PI2, true); ctx.clip("evenodd");
    var tipo = TIPO_RASTRO[fx.id];
    if (tipo) {
      var sp = spritePart(tipo);
      for (i = 0; i < n; i++) {
        p = pts[i]; a = 1 - p.a / fx.vida; if (a <= 0) continue;
        var j1 = h1(p.s), j2 = h1(p.s + 7), tam = r * (tipo === "fumaca" ? 0.5 + (1 - a) * 0.6 : tipo === "fogo" ? 0.25 + a * 0.45 : 0.3 + a * 0.3) * (0.8 + j1 * 0.4);
        var ox = (j1 - 0.5) * r * 0.7, oy = (j2 - 0.5) * r * 0.7 - (tipo === "fumaca" || tipo === "fogo" || tipo === "bolha" ? p.a * r * 1.2 : 0);
        ctx.globalAlpha = Math.min(1, a * 1.4);
        ctx.save(); ctx.translate(p.x - bx + ox, p.y - by + oy);
        if (tipo === "estrela" || tipo === "faisca") ctx.rotate(p.a * 4 + j1 * 6);
        ctx.drawImage(sp, -tam, -tam, tam * 2, tam * 2);
        ctx.restore();
      }
    } else if (n > 1) {
      // faixas: neon (cor da bolinha), arco-íris (6 cores) e raio (zigue-zague que treme)
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      var faixas = fx.id === "r_arcoiris" ? [[-2.5, "#ff5266"], [-1.5, "#ff922b"], [-0.5, "#ffd43b"], [0.5, "#51cf66"], [1.5, "#4dabf7"], [2.5, "#9775fa"]] :
        fx.id === "r_neon" ? [[0, b.cor]] : [[0, "#ffe066"]];
      var larg = fx.id === "r_arcoiris" ? r * 0.12 : r * 0.28;
      if (fx.id !== "r_arcoiris") {   // contorno escuro por baixo
        ctx.strokeStyle = "#1a0d33"; ctx.globalAlpha = 0.85;
        for (i = 1; i < n; i++) { a = 1 - pts[i].a / fx.vida; if (a <= 0) continue; ctx.lineWidth = larg * a + 5; linhaRastro(ctx, fx.id, pts[i - 1], pts[i], bx, by, 0, r, t, i); }
      }
      faixas.forEach(function(f) {
        ctx.strokeStyle = f[1];
        for (i = 1; i < n; i++) { a = 1 - pts[i].a / fx.vida; if (a <= 0) continue; ctx.globalAlpha = Math.min(1, a * 1.3); ctx.lineWidth = (fx.id === "r_arcoiris" ? larg : larg * a) + (fx.id === "r_arcoiris" ? 1 : 0); linhaRastro(ctx, fx.id, pts[i - 1], pts[i], bx, by, f[0] * larg, r, t, i); }
      });
      if (fx.id !== "r_arcoiris") {   // miolo claro
        ctx.strokeStyle = "#ffffff";
        for (i = 1; i < n; i++) { a = 1 - pts[i].a / fx.vida; if (a <= 0) continue; ctx.globalAlpha = a * 0.9; ctx.lineWidth = larg * a * 0.35; linhaRastro(ctx, fx.id, pts[i - 1], pts[i], bx, by, 0, r, t, i); }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function linhaRastro(ctx, id, p0, p1, bx, by, off, r, t, i) {
    var dx = p1.x - p0.x, dy = p1.y - p0.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * off, ny = dx / l * off, jx = 0, jy = 0;
    if (id === "r_raio") { var s = Math.floor(t * 18); jx = (h1(i + s) - 0.5) * r * 0.5; jy = (h1(i * 3 + s) - 0.5) * r * 0.5; }
    ctx.beginPath(); ctx.moveTo(p0.x - bx + nx, p0.y - by + ny); ctx.lineTo(p1.x - bx + nx + jx, p1.y - by + ny + jy); ctx.stroke();
  }

  // bolinha completa para a loja (corpo + olhos + acessório), no mesmo desenho do jogo
  var mb = { x: 0, y: 0, r: 28, cor: "#4dabf7", olharX: 0.3, olharY: 0, expressao: "normal", piscar: 0, t: 0, cache: true, skin: "classico", acessorio: "nenhum" };
  function miniatura(ctx, idCorpo, idAcessorio, cor, x, y, r, t, expr) {
    t = t || 0;
    if (typeof ArteBolinha === "undefined") { ctx.fillStyle = cor || "#4dabf7"; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill(); return; }
    mb.x = x; mb.y = y; mb.r = r; mb.cor = cor || "#4dabf7"; mb.skin = idCorpo || "classico"; mb.acessorio = idAcessorio || "nenhum";
    mb.t = t; mb.olharX = Math.round((0.25 + Math.sin(t * 1.1) * 0.35) * 10) / 10; mb.piscar = t > 0 && (t % 3.7) < 0.14 ? 1 : 0;
    mb.expressao = expr || "normal"; mb.escalaX = 1; mb.escalaY = 1;
    ArteBolinha.desenhar(ctx, mb);
  }
  // bolinha com um visual inteiro (dados/skins.js) — usada pela personalização
  function miniVisual(ctx, v, x, y, r, t, expr, sx, sy) {
    if (typeof ArteBolinha === "undefined") return;
    mb.x = x; mb.y = y; mb.r = r; mb.cor = corDoVisual(v); mb.skin = v.corpo || "classico"; mb.acessorio = chaveCamadas({ chapeu: v.chapeu, acessorio: v.acessorio, olhos: v.olhos, boca: v.boca }, 0);
    mb.t = t || 0; mb.olharX = Math.round((0.25 + Math.sin((t || 0) * 1.1) * 0.35) * 10) / 10; mb.piscar = t > 0 && (t % 3.7) < 0.14 ? 1 : 0;
    mb.expressao = expr || "normal"; mb.escalaX = sx || 1; mb.escalaY = sy || 1;
    ArteBolinha.desenhar(ctx, mb);
  }

  // ---------- v19: ícone de um item para a grade da personalização (cor, rastro, K.O. e emote não têm "peça") ----------
  function iconeItem(ctx, id, x, y, tam, v, t) {
    var s = SKIN[id], vv = Object.assign({}, VISUAL_PADRAO), r = tam * 0.3;
    if (!s) { miniVisual(ctx, vv, x, y + tam * 0.06, r, t); return; }
    vv.cor = v && v.cor || vv.cor;
    if (s.tipo === "cor") { vv.cor = id; miniVisual(ctx, vv, x, y + tam * 0.06, r, t); return; }
    if (s.tipo === "corpo" || s.tipo === "olhos" || s.tipo === "boca" || s.tipo === "chapeu" || s.tipo === "acessorio") {
      vv[s.tipo] = id; miniVisual(ctx, vv, x, y + (s.tipo === "chapeu" ? tam * 0.14 : tam * 0.06), r * (s.tipo === "acessorio" && /asas|capa/.test(id) ? 0.8 : 1), t); return;
    }
    if (s.tipo === "emote") {
      miniVisual(ctx, vv, x - tam * 0.1, y + tam * 0.18, r * 0.8, t, "feliz");
      var sp = spriteBalao(s.icone, 2), k = tam / 110;
      ctx.drawImage(sp.c, x + tam * 0.12 - 32 * k, y - tam * 0.18 - 35 * k, 64 * k, 70 * k);
      return;
    }
    if (s.tipo === "rastro") { desenharRastroDemo(ctx, id, x, y, tam, t, corDoVisual(vv)); miniVisual(ctx, vv, x + tam * 0.2, y, r * 0.75, t); return; }
    if (s.tipo === "ko") { desenharKODemo(ctx, id, x, y, tam, ((t || 0) % 2) / 2 * 0.7 + 0.25); }
  }
  // rastro parado (cartão e prévia): pontos numa curva atrás da bolinha
  var demoFx = { id: "", vida: 1, pts: [] }, demoB = { x: 0, y: 0, cor: "#fff", rastroFx: demoFx };
  function desenharRastroDemo(ctx, id, x, y, tam, t, cor) {
    demoFx.id = id; demoFx.pts.length = 0;
    for (var i = 0; i < 12; i++) demoFx.pts.push({ x: x + tam * 0.2 - i * tam * 0.065, y: y + Math.sin(i * 0.7 + (t || 0) * 3) * tam * 0.06, a: i / 12, s: i * 3.1 });
    demoB.x = x + tam * 0.2; demoB.y = y; demoB.cor = cor || "#ff5d73";
    ctx.save(); ctx.translate(demoB.x, demoB.y); rastro(ctx, demoB, tam * 0.22, 1, 1, t || 0); ctx.restore();
  }
  // K.O. desenhado (cartão e prévia): u = 0..1 do estouro
  var CORES_KO = { k_estrelas: ["#ffd43b", "#fff3bf"], k_fogos: ["#ff6b9d", "#4dabf7", "#ffd43b", "#51cf66"], k_gelo: ["#a5d8ff", "#f1faff"], k_portal: ["#b197fc", "#e5dbff"],
    k_explosao: ["#ff922b", "#ffd43b", "#e03131"], k_raio: ["#ffe066", "#ffffff"], k_moedas: ["#fcc419", "#fff3bf"], k_supernova: ["#ffffff", "#ffd43b", "#ff6b9d", "#74c0fc"] };
  function desenharKODemo(ctx, id, x, y, tam, u) {
    var cs = CORES_KO[id] || ["#ffffff"], i, a, R = tam * 0.42 * (0.35 + u * 0.75), al = u < 0.85 ? 1 : (1 - u) / 0.15;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = Math.max(0, al); ctx.lineJoin = "round";
    if (id === "k_portal") {
      for (i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, R * (1 - i * 0.25), R * (0.7 - i * 0.18), 0, 0, PI2); ctx.strokeStyle = i ? cs[1] : "#1a0d33"; ctx.lineWidth = i ? 4 : 9; ctx.stroke(); if (!i) { ctx.strokeStyle = cs[0]; ctx.lineWidth = 5; ctx.stroke(); } }
    } else if (id === "k_raio") {
      for (i = 0; i < 6; i++) { a = i * PI / 3 + 0.3; ctx.save(); ctx.rotate(a); ctx.translate(R * 0.55, 0); ctx.rotate(PI / 2); raioForma(ctx, R * 0.3); ctx.fillStyle = cs[0]; ctx.fill(); ctx.strokeStyle = "#1a0d33"; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
    } else if (id === "k_moedas") {
      for (i = 0; i < 7; i++) { a = i * PI2 / 7; ctx.beginPath(); ctx.ellipse(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75, tam * 0.07, tam * 0.07 * (0.5 + 0.5 * Math.abs(Math.cos(a * 3 + u * 9))), 0, 0, PI2); ctx.fillStyle = cs[0]; ctx.fill(); ctx.strokeStyle = "#8a5207"; ctx.lineWidth = 3; ctx.stroke(); }
    } else if (id === "k_gelo") {
      for (i = 0; i < 8; i++) { a = i * PI / 4; ctx.save(); ctx.rotate(a); ctx.translate(R * 0.7, 0); ctx.beginPath(); ctx.moveTo(-tam * 0.08, 0); ctx.lineTo(0, -tam * 0.045); ctx.lineTo(tam * 0.08, 0); ctx.lineTo(0, tam * 0.045); ctx.closePath(); ctx.fillStyle = i % 2 ? cs[1] : cs[0]; ctx.fill(); ctx.strokeStyle = "#1a0d33"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); }
    } else {
      // estouro: anel + raios + pedaços nas cores do efeito
      ctx.beginPath(); ctx.arc(0, 0, R, 0, PI2); ctx.strokeStyle = "#1a0d33"; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = cs[0]; ctx.lineWidth = 5; ctx.stroke();
      var n = id === "k_supernova" ? 12 : 8;
      for (i = 0; i < n; i++) {
        a = i * PI2 / n + 0.2; var c2 = cs[i % cs.length];
        if (id === "k_estrelas" || id === "k_supernova") { est5(ctx, Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, tam * 0.07, tam * 0.03); ctx.fillStyle = c2; ctx.fill(); ctx.strokeStyle = "#1a0d33"; ctx.lineWidth = 2.5; ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, tam * (id === "k_explosao" ? 0.07 : 0.045), 0, PI2); ctx.fillStyle = c2; ctx.fill(); ctx.strokeStyle = "#1a0d33"; ctx.lineWidth = 2.5; ctx.stroke(); }
      }
      if (id === "k_explosao" || id === "k_supernova") { ctx.beginPath(); ctx.arc(0, 0, R * 0.42, 0, PI2); ctx.fillStyle = id === "k_supernova" ? "#fff8d6" : "#ffd43b"; ctx.fill(); ctx.strokeStyle = "#1a0d33"; ctx.lineWidth = 4; ctx.stroke(); }
    }
    ctx.restore();
  }

  // ---------- v19: prévia grande e animada da personalização ----------
  // A bolinha anda de um lado para o outro (com o rastro), pula, pisca e olha; a aba aberta decide a demonstração:
  // K.O. = um boneco estoura ao lado com o efeito; emote = comemora com o balão.
  var prevFx = { id: "", vida: 0.5, pts: [] }, prevB = { x: 0, y: 0, cor: "#fff", rastroFx: prevFx }, prevT = 0, prevS = 0;
  function previa(ctx, w, h, v, t, aba) {
    var r = Math.min(w, h) * 0.2, chao = h * 0.8, ciclo = t % 4;
    var andar = v.rastro || aba === "rastro";
    var x = w / 2 + (andar ? Math.sin(t * 1.3) * w * 0.26 : 0), pulo = Math.max(0, Math.sin(t * 2.6)) * (andar ? r * 0.5 : r * 0.18);
    var y = chao - r - pulo, sx = 1 + Math.sin(t * 5.2) * 0.04, sy = 2 - sx;
    // rastro (pontos guardados aqui mesmo, como no jogo)
    prevFx.id = v.rastro || "";
    var dt = Math.min(0.1, Math.max(0, t - prevT)); prevT = t;
    prevFx.pts.forEach(function(p) { p.a += dt; });
    while (prevFx.pts.length && prevFx.pts[0].a > prevFx.vida) prevFx.pts.shift();
    if (prevFx.id && andar && dt > 0) prevFx.pts.push({ x: x, y: y, a: 0, s: prevS++ });
    if (!prevFx.id) prevFx.pts.length = 0;
    ctx.save();
    if (typeof ArteBolinha !== "undefined") ArteBolinha.sombra(ctx, x, chao, r, pulo);
    if (prevFx.pts.length) { prevB.x = x; prevB.y = y; prevB.cor = corDoVisual(v); ctx.save(); ctx.translate(Math.round(x), Math.round(y)); rastro(ctx, prevB, r, 1, 1, t); ctx.restore(); }
    var festa = (aba === "emote" && v.emote) ? ciclo : -1, expr = festa >= 0 && festa < 2.4 ? "feliz" : "normal";
    if (aba === "ko" && v.ko) {
      // boneco cinza do outro lado que estoura com o efeito
      var u = (t % 2.2) / 2.2, bx = w * 0.78;
      if (u < 0.45) { var vv = Object.assign({}, VISUAL_PADRAO); vv.cor = "cor_carvao"; miniVisual(ctx, vv, bx, chao - r * 0.7, r * 0.7, t, u > 0.3 ? "dor" : "medo"); }
      else desenharKODemo(ctx, v.ko, bx, chao - r * 0.7, r * 3.2, (u - 0.45) / 0.55);
      x = w * 0.32; expr = u > 0.45 ? "feliz" : "bravo";
    }
    miniVisual(ctx, v, x, y, r, t, expr, sx, sy);
    if (festa >= 0 && festa < 2.4) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); balao(ctx, SKIN[v.emote].icone, r, festa, false); ctx.restore(); }
    ctx.restore();
  }

  // pré-aquece (opcional): todos os corpos e acessórios no raio r
  function aquecer(r, cor) {
    r = r || 28;
    for (var id in MAT) corpo(id, cor || "#4dabf7", r);
    for (var a in AC) sprite(a, Math.max(8, Math.round(r)), 1);
  }

  return { corpo: corpo, rosto: rosto, acessorio: acessorio, miniatura: miniatura, miniVisual: miniVisual, iconeItem: iconeItem,
    previa: previa, aquecer: aquecer, desenharKODemo: desenharKODemo };
})();
