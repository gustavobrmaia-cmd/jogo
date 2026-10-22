"use strict";

// =========================
// ÍCONES (v19): substituem os emojis em todo o jogo (canvas e HTML).
// Contrato (não mudar os nomes nem as funções; a arte de cada ícone pode mudar à vontade):
//   Icone.desenhar(ctx, nome, x, y, tam)  -> desenha centrado em (x, y), com tam px de altura
//   Icone.html(nome, classe)              -> string "<i class='ico ...'>" com o desenho (usar em innerHTML)
//   Icone.NOMES                           -> lista dos nomes que existem
// Extras: Icone.preencher(raiz) põe o desenho em todo <i data-ico="nome"> (o index.html usa) e Icone.url(nome).
// Nome desconhecido: desenha um círculo neutro (nunca quebra).
//
// Estilo (direção de arte v19): cartoon arcade, contorno escuro e grosso (#1a0d33), 2–3 tons duros (cel-shading:
// a sombra é a forma deslocada para baixo/direita), brilho em meia-lua no canto de cima e cores saturadas.
// Cada ícone é desenhado num quadrado de 100 x 100 unidades com o centro em (0, 0).
// Desempenho: no canvas cada ícone vira um sprite guardado por tamanho na tela (por quadro: 1 drawImage).
// =========================

const Icone = (function() {
  var NOMES = ["moeda", "brilho", "raio", "ok", "trofeu", "presente", "nota", "som", "mudo", "estrela", "explosao",
    "coracao", "repetir", "robo", "casa", "mao", "celular", "alvo", "pincel", "engrenagem", "globo", "controle",
    "dupla", "fogo", "bau", "cadeado", "trevo", "arma", "mapa", "loja", "roleta", "coroa", "escudo", "relogio",
    "seta", "voltar", "play", "fechar", "copiar", "wifi", "usuario", "chapeu", "olho", "rastro", "caveira"];
  var PI = Math.PI, TAU = PI * 2;
  var TINTA = "#1a0d33", LW = 8;

  // ---------- ajudantes de desenho (espaço de 100 unidades) ----------
  function C(g, x, y, r) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function poli(g, p) { g.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); }
  function estrelaP(g, x, y, R, r, n, rot) {
    for (var i = 0; i < n * 2; i++) {
      var a = (rot === undefined ? -PI / 2 : rot) + i * PI / n, q = i % 2 ? r : R;
      if (i) g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); else g.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    g.closePath();
  }
  // forma com cel-shading: base, sombra dura embaixo à direita (a própria forma deslocada) e contorno grosso.
  // f(g) monta o caminho (sem beginPath). o.dx/o.dy = deslocamento da sombra; o.luz = cor clara em cima (opcional)
  function cel(g, f, base, sombra, o) {
    o = o || {};
    var dx = o.dx === undefined ? 5 : o.dx, dy = o.dy === undefined ? 7 : o.dy;
    g.save();
    g.beginPath(); f(g); g.fillStyle = sombra; g.fill(); g.clip();
    g.translate(-dx, -dy); g.beginPath(); f(g); g.fillStyle = base; g.fill();
    if (o.luz) { g.translate(-dx * 1.4, -dy * 1.4); g.globalAlpha = 0.55; g.beginPath(); f(g); g.fillStyle = o.luz; g.fill(); }
    g.restore();
    if (o.semContorno) return;
    g.beginPath(); f(g);
    g.lineWidth = o.lw || LW; g.strokeStyle = TINTA; g.lineJoin = "round"; g.lineCap = "round"; g.stroke();
  }
  // brilho em meia-lua (traço curvo branco com ponta redonda) + pontinho
  function meiaLua(g, x, y, r, a0, a1, larg, ponto) {
    g.save();
    g.lineCap = "round"; g.strokeStyle = "rgba(255,255,255,0.88)"; g.lineWidth = larg || 6;
    g.beginPath(); g.arc(x, y, r, a0 === undefined ? PI * 1.08 : a0, a1 === undefined ? PI * 1.42 : a1); g.stroke();
    if (ponto !== false) {
      var a = (a1 === undefined ? PI * 1.42 : a1) + 0.32;
      g.fillStyle = "rgba(255,255,255,0.88)"; g.beginPath(); C(g, x + Math.cos(a) * r, y + Math.sin(a) * r, (larg || 6) * 0.45); g.fill();
    }
    g.restore();
  }
  function linha(g, pts, cor, larg) {
    g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = TINTA; g.lineWidth = larg + LW; g.stroke();
    g.strokeStyle = cor; g.lineWidth = larg; g.stroke();
  }

  // ---------- os desenhos ----------
  var D = {};
  D.moeda = function(g) {
    cel(g, function(g) { g.ellipse(0, 2, 40, 41, 0, 0, TAU); }, "#ffd23f", "#f08c00", { dx: 5, dy: 6 });
    g.beginPath(); g.ellipse(-1, 0, 25, 26, 0, 0, TAU); g.lineWidth = 5; g.strokeStyle = "#d9730d"; g.stroke();
    g.beginPath(); estrelaP(g, -1, 1, 15, 7, 5); g.fillStyle = "#fff3b0"; g.fill(); g.lineWidth = 4; g.strokeStyle = "#d9730d"; g.lineJoin = "round"; g.stroke();
    meiaLua(g, 0, 2, 32, PI * 1.05, PI * 1.38, 6);
  };
  D.brilho = function(g) {
    cel(g, function(g) { estrelaP(g, -6, 4, 40, 11, 4, -PI / 2); }, "#ffe45c", "#f5a524", { dx: 3, dy: 4 });
    cel(g, function(g) { estrelaP(g, 28, -26, 17, 5, 4, -PI / 2); }, "#ffffff", "#c8d6ff", { dx: 2, dy: 2, lw: 6 });
    g.fillStyle = "#fff"; g.beginPath(); C(g, -12, -4, 4); g.fill();
  };
  D.raio = function(g) {
    cel(g, function(g) { poli(g, [8, -44, -30, 6, -4, 6, -14, 44, 30, -8, 4, -8, 18, -44]); }, "#ffd23f", "#f08c00", { dx: 4, dy: 5 });
    g.save(); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(6, -34); g.lineTo(-16, -2); g.stroke(); g.restore();
  };
  D.ok = function(g) {
    cel(g, function(g) { C(g, 0, 0, 40); }, "#4fe07a", "#1f9e4d", { dx: 4, dy: 6 });
    meiaLua(g, 0, 0, 30, PI * 1.05, PI * 1.38, 6);
    g.beginPath(); g.moveTo(-18, 2); g.lineTo(-5, 15); g.lineTo(19, -12);
    g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = TINTA; g.lineWidth = 19; g.stroke();
    g.strokeStyle = "#ffffff"; g.lineWidth = 10; g.stroke();
  };
  D.trofeu = function(g) {
    // alças
    g.beginPath(); g.arc(-27, -16, 13, PI * 0.5, PI * 1.5); g.moveTo(27, -29); g.arc(27, -16, 13, -PI * 0.5, PI * 0.5);
    g.lineCap = "round"; g.strokeStyle = TINTA; g.lineWidth = 15; g.stroke(); g.strokeStyle = "#f5b82e"; g.lineWidth = 6; g.stroke();
    cel(g, function(g) { rr(g, -22, 34, 44, 10, 4); }, "#9a5cff", "#5b2fb8", { dx: 3, dy: 4 });
    cel(g, function(g) { poli(g, [-8, 14, 8, 14, 12, 34, -12, 34]); }, "#ffd23f", "#e07b00", { dx: 3, dy: 3 });
    cel(g, function(g) { g.moveTo(-30, -38); g.lineTo(30, -38); g.quadraticCurveTo(32, 16, 0, 18); g.quadraticCurveTo(-32, 16, -30, -38); g.closePath(); }, "#ffd23f", "#e07b00", { dx: 6, dy: 6 });
    g.beginPath(); estrelaP(g, 0, -12, 11, 5, 5); g.fillStyle = "#fff3b0"; g.fill();
    g.save(); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(-20, -28); g.quadraticCurveTo(-21, -8, -12, 4); g.stroke(); g.restore();
  };
  D.presente = function(g) {
    // laço
    cel(g, function(g) { g.ellipse(-14, -30, 15, 10, -0.5, 0, TAU); }, "#ffd23f", "#e07b00", { dx: 2, dy: 3, lw: 7 });
    cel(g, function(g) { g.ellipse(14, -30, 15, 10, 0.5, 0, TAU); }, "#ffd23f", "#e07b00", { dx: 2, dy: 3, lw: 7 });
    cel(g, function(g) { rr(g, -36, -4, 72, 46, 7); }, "#ff4f6d", "#c41e4a", { dx: 6, dy: 6 });
    cel(g, function(g) { rr(g, -42, -24, 84, 22, 7); }, "#ff6d85", "#d42a55", { dx: 4, dy: 4 });
    g.fillStyle = "#ffd23f"; g.fillRect(-8, -21, 16, 60);
    g.strokeStyle = TINTA; g.lineWidth = 4; g.strokeRect(-8, -20, 16, 18); g.strokeRect(-8, -2, 16, 40);
    cel(g, function(g) { C(g, 0, -27, 8); }, "#ffe45c", "#e07b00", { dx: 1, dy: 2, lw: 6 });
    g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(-34, -20, 18, 5);
  };
  D.nota = function(g) {
    g.beginPath(); g.moveTo(-14, 26); g.lineTo(-14, -30); g.lineTo(26, -40); g.lineTo(26, 16);
    g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = TINTA; g.lineWidth = 16; g.stroke(); g.strokeStyle = "#c06bff"; g.lineWidth = 7; g.stroke();
    cel(g, function(g) { poli(g, [-14, -30, 26, -40, 26, -26, -14, -16]); }, "#c06bff", "#7a2fd0", { dx: 1, dy: 2, lw: 6 });
    cel(g, function(g) { g.ellipse(-24, 28, 14, 11, -0.4, 0, TAU); }, "#c06bff", "#7a2fd0", { dx: 3, dy: 3 });
    cel(g, function(g) { g.ellipse(16, 18, 14, 11, -0.4, 0, TAU); }, "#c06bff", "#7a2fd0", { dx: 3, dy: 3 });
    g.fillStyle = "rgba(255,255,255,0.85)"; g.beginPath(); g.ellipse(-28, 24, 5, 3, -0.4, 0, TAU); g.ellipse(12, 14, 5, 3, -0.4, 0, TAU); g.fill();
  };
  function altoFalante(g) {
    cel(g, function(g) { poli(g, [-38, -14, -20, -14, 4, -34, 4, 34, -20, 14, -38, 14]); }, "#e9ecff", "#9aa3d8", { dx: 4, dy: 5 });
    g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(-26, -6, 5, 3, 0, 0, TAU); g.fill();
  }
  D.som = function(g) {
    altoFalante(g);
    g.lineCap = "round";
    [[18, 14], [32, 26]].forEach(function(q) {
      g.beginPath(); g.arc(4, 0, q[0] + 2, -0.75, 0.75); g.strokeStyle = TINTA; g.lineWidth = 15; g.stroke();
      g.beginPath(); g.arc(4, 0, q[0] + 2, -0.75, 0.75); g.strokeStyle = "#35d6ff"; g.lineWidth = 6; g.stroke();
    });
  };
  D.mudo = function(g) {
    altoFalante(g);
    linha(g, [18, -14, 40, 12], "#ff4057", 9); linha(g, [40, -14, 18, 12], "#ff4057", 9);
  };
  D.estrela = function(g) {
    cel(g, function(g) { estrelaP(g, 0, 3, 44, 20, 5); }, "#ffd23f", "#f08c00", { dx: 4, dy: 6 });
    g.save(); g.strokeStyle = "rgba(255,255,255,0.88)"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(-14, -6); g.lineTo(-4, -22); g.stroke(); g.restore();
  };
  D.explosao = function(g) {
    cel(g, function(g) { var p = [0, 46, 7, 40, 10, 44, 6, 38, 12, 46, 4, 38, 8, 42, 5, 40, 10, 44, 6, 38, 9, 42, 5]; for (var i = 0; i < 22; i++) { var a = -PI / 2 + i * PI / 11, q = i % 2 ? 24 : 44 - (i % 4) * 3; if (i) g.lineTo(Math.cos(a) * q, Math.sin(a) * q + 2); else g.moveTo(Math.cos(a) * q, Math.sin(a) * q + 2); } g.closePath(); }, "#ff6a2b", "#c9301f", { dx: 4, dy: 5 });
    cel(g, function(g) { for (var i = 0; i < 16; i++) { var a = -PI / 2 + i * PI / 8 + 0.1, q = i % 2 ? 13 : 26; if (i) g.lineTo(Math.cos(a) * q, Math.sin(a) * q + 2); else g.moveTo(Math.cos(a) * q, Math.sin(a) * q + 2); } g.closePath(); }, "#ffd23f", "#ff9a1f", { dx: 2, dy: 3, lw: 6 });
    g.fillStyle = "#fff8d0"; g.beginPath(); C(g, -2, 0, 7); g.fill();
  };
  function coracaoF(g) { g.moveTo(0, 38); g.bezierCurveTo(-30, 18, -46, 0, -42, -18); g.bezierCurveTo(-38, -40, -10, -42, 0, -20); g.bezierCurveTo(10, -42, 38, -40, 42, -18); g.bezierCurveTo(46, 0, 30, 18, 0, 38); g.closePath(); }
  D.coracao = function(g) {
    cel(g, coracaoF, "#ff4057", "#c4123a", { dx: 6, dy: 6 });
    g.save(); g.strokeStyle = "rgba(255,255,255,0.88)"; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.arc(-22, -16, 11, PI * 1.05, PI * 1.6); g.stroke(); g.restore();
  };
  function setaCurva(g, cor) {
    g.lineCap = "round";
    g.beginPath(); g.arc(0, 2, 28, -PI * 0.35, PI * 1.25); g.strokeStyle = TINTA; g.lineWidth = 22; g.stroke();
    cel(g, function(g) { poli(g, [8, -42, 40, -22, 6, -2]); }, cor, "#1f9e4d", { dx: 2, dy: 3, lw: 7 });
    g.beginPath(); g.arc(0, 2, 28, -PI * 0.3, PI * 1.25); g.strokeStyle = cor; g.lineWidth = 11; g.stroke();
    g.beginPath(); g.arc(0, 2, 28, PI * 0.9, PI * 1.2); g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 4; g.stroke();
  }
  D.repetir = function(g) { setaCurva(g, "#4fe07a"); };
  D.robo = function(g) {
    g.beginPath(); g.moveTo(0, -26); g.lineTo(0, -38); g.strokeStyle = TINTA; g.lineWidth = 12; g.lineCap = "round"; g.stroke(); g.strokeStyle = "#9aa3d8"; g.lineWidth = 4; g.stroke();
    cel(g, function(g) { C(g, 0, -40, 7); }, "#ff4057", "#b81a3a", { dx: 1, dy: 2, lw: 6 });
    cel(g, function(g) { rr(g, -44, -8, 10, 22, 4); rr(g, 34, -8, 10, 22, 4); }, "#9aa3d8", "#5c6499", { dx: 2, dy: 2, lw: 6 });
    cel(g, function(g) { rr(g, -36, -28, 72, 64, 16); }, "#b8c4ff", "#6f7cc8", { dx: 6, dy: 7 });
    cel(g, function(g) { rr(g, -26, -16, 52, 30, 10); }, "#1f2f6b", "#14204d", { dx: 0, dy: 0, lw: 5 });
    g.fillStyle = "#35d6ff"; g.beginPath(); C(g, -12, -2, 7); C(g, 12, -2, 7); g.fill();
    g.fillStyle = "#ffffff"; g.beginPath(); C(g, -14, -4, 2.5); C(g, 10, -4, 2.5); g.fill();
    g.fillStyle = TINTA; g.fillRect(-12, 22, 24, 5);
    meiaLua(g, -8, -10, 24, PI * 1.1, PI * 1.35, 5, false);
  };
  D.casa = function(g) {
    cel(g, function(g) { rr(g, 16, -40, 12, 22, 3); }, "#c96b3c", "#8a3f22", { dx: 2, dy: 2, lw: 6 });
    cel(g, function(g) { rr(g, -32, -8, 64, 48, 6); }, "#fff1d6", "#e0b98a", { dx: 6, dy: 5 });
    cel(g, function(g) { poli(g, [-46, -2, 0, -42, 46, -2, 38, 6, 0, -28, -38, 6]); }, "#ff4f6d", "#c41e4a", { dx: 3, dy: 4 });
    cel(g, function(g) { rr(g, -10, 12, 20, 28, 8); }, "#9a5cff", "#5b2fb8", { dx: 2, dy: 2, lw: 6 });
    cel(g, function(g) { rr(g, 16, 2, 12, 12, 3); }, "#35d6ff", "#1a8fc4", { dx: 1, dy: 1, lw: 5 });
  };
  D.mao = function(g) {
    // mão apontando para cima: indicador esticado à esquerda, dedos dobrados à direita e o polegar na frente
    cel(g, function(g) { rr(g, -20, -46, 20, 54, 10); }, "#ffffff", "#c8cdf0", { dx: 3, dy: 3, lw: 7 });
    cel(g, function(g) { rr(g, -24, -6, 56, 50, 16); }, "#ffffff", "#c8cdf0", { dx: 4, dy: 5, lw: 7 });
    cel(g, function(g) { rr(g, -2, -14, 15, 26, 7); rr(g, 11, -10, 15, 24, 7); rr(g, 22, -4, 13, 22, 6); }, "#ffffff", "#c8cdf0", { dx: 2, dy: 3, lw: 6 });
    cel(g, function(g) { g.ellipse(-12, 22, 20, 10, -0.5, 0, TAU); }, "#ffffff", "#c8cdf0", { dx: 2, dy: 3, lw: 6 });
    g.fillStyle = "rgba(255,170,200,0.75)"; g.beginPath(); g.ellipse(-10, -38, 5, 3.5, 0, 0, TAU); g.fill();
  };
  D.celular = function(g) {
    cel(g, function(g) { rr(g, -24, -44, 48, 88, 12); }, "#5c63c8", "#33389a", { dx: 4, dy: 5 });
    cel(g, function(g) { rr(g, -16, -32, 32, 58, 5); }, "#35d6ff", "#1a8fc4", { dx: 0, dy: 0, lw: 5 });
    g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); poli(g, [-12, -28, -2, -28, -12, -12]); g.fill();
    g.fillStyle = TINTA; g.beginPath(); C(g, 0, 35, 4); g.fill();
  };
  D.alvo = function(g) {
    cel(g, function(g) { C(g, -4, 4, 38); }, "#ff4057", "#c4123a", { dx: 4, dy: 5 });
    g.beginPath(); C(g, -5, 3, 25); g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 5; g.strokeStyle = TINTA; g.stroke();
    g.beginPath(); C(g, -5, 3, 12); g.fillStyle = "#ff4057"; g.fill(); g.stroke();
    linha(g, [-4, 2, 30, -32], "#ffd23f", 6);
    cel(g, function(g) { poli(g, [26, -36, 44, -40, 40, -22, 32, -28]); }, "#4fe07a", "#1f9e4d", { dx: 1, dy: 1, lw: 5 });
  };
  D.pincel = function(g) {
    g.save(); g.rotate(-0.75);
    cel(g, function(g) { rr(g, -8, -4, 16, 50, 7); }, "#c96b3c", "#8a3f22", { dx: 3, dy: 2 });
    cel(g, function(g) { rr(g, -10, -14, 20, 14, 3); }, "#d6dcf5", "#8b93c4", { dx: 2, dy: 2, lw: 6 });
    cel(g, function(g) { g.moveTo(-10, -14); g.quadraticCurveTo(-14, -34, 0, -48); g.quadraticCurveTo(14, -34, 10, -14); g.closePath(); }, "#ff4f9a", "#c41e6a", { dx: 3, dy: 2 });
    g.restore();
    g.fillStyle = "#35d6ff"; g.beginPath(); C(g, 28, 30, 8); g.fill(); g.lineWidth = 5; g.strokeStyle = TINTA; g.stroke();
    g.fillStyle = "#ffd23f"; g.beginPath(); C(g, 34, 10, 6); g.fill(); g.stroke();
  };
  function engrenagemF(g, R, r, n, furo) {
    for (var i = 0; i < n * 4; i++) {
      var a = i / (n * 4) * TAU - 0.18, q = (i % 4 < 2) ? R : r;
      if (i) g.lineTo(Math.cos(a) * q, Math.sin(a) * q); else g.moveTo(Math.cos(a) * q, Math.sin(a) * q);
    }
    g.closePath();
    if (furo) { g.moveTo(furo, 0); g.arc(0, 0, furo, 0, TAU, true); }
  }
  D.engrenagem = function(g) {
    cel(g, function(g) { engrenagemF(g, 44, 33, 8, 12); }, "#a9b4e8", "#5c6499", { dx: 4, dy: 5 });
    g.beginPath(); C(g, -1, -1, 22); g.lineWidth = 5; g.strokeStyle = "rgba(26,13,51,0.45)"; g.stroke();
    meiaLua(g, 0, 0, 28, PI * 1.1, PI * 1.4, 5, false);
  };
  D.globo = function(g) {
    cel(g, function(g) { C(g, 0, 0, 40); }, "#35a8ff", "#1a5fc4", { dx: 5, dy: 6 });
    g.save(); g.beginPath(); C(g, 0, 0, 37); g.clip();
    g.fillStyle = "#4fe07a"; g.beginPath(); g.moveTo(-30, -24); g.quadraticCurveTo(-6, -36, -2, -16); g.quadraticCurveTo(-14, -8, -8, 6); g.quadraticCurveTo(-20, 12, -30, 0); g.closePath();
    g.moveTo(8, 4); g.quadraticCurveTo(30, -6, 34, 12); g.quadraticCurveTo(24, 30, 12, 30); g.quadraticCurveTo(14, 16, 8, 4); g.closePath(); g.fill();
    g.strokeStyle = "rgba(26,13,51,0.5)"; g.lineWidth = 4; g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, 0, 16, 40, 0, 0, TAU); g.moveTo(-40, 0); g.lineTo(40, 0); g.stroke();
    g.restore();
    meiaLua(g, 0, 0, 30, PI * 1.08, PI * 1.38, 6);
  };
  D.controle = function(g) {
    cel(g, function(g) { g.moveTo(-30, -20); g.lineTo(30, -20); g.quadraticCurveTo(46, -20, 48, 4); g.quadraticCurveTo(50, 32, 36, 32); g.quadraticCurveTo(26, 32, 18, 18); g.lineTo(-18, 18); g.quadraticCurveTo(-26, 32, -36, 32); g.quadraticCurveTo(-50, 32, -48, 4); g.quadraticCurveTo(-46, -20, -30, -20); g.closePath(); }, "#7a6bff", "#4532c4", { dx: 4, dy: 5 });
    g.fillStyle = TINTA; g.fillRect(-32, -6, 20, 7); g.fillRect(-25.5, -12.5, 7, 20);
    g.fillStyle = "#ffffff"; g.fillRect(-30, -4, 16, 3); g.fillRect(-23.5, -10.5, 3, 16);
    [[24, -10, "#ff4057"], [34, 0, "#ffd23f"], [14, 0, "#4fe07a"], [24, 10, "#35d6ff"]].forEach(function(q) { g.beginPath(); C(g, q[0], q[1], 5.5); g.fillStyle = q[2]; g.fill(); g.lineWidth = 3.5; g.strokeStyle = TINTA; g.stroke(); });
    g.save(); g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(-28, -14); g.lineTo(-6, -14); g.stroke(); g.restore();
  };
  function bolinhaMini(g, x, y, r, cor, sombra) {
    cel(g, function(g) { C(g, x, y, r); }, cor, sombra, { dx: r * 0.14, dy: r * 0.18, lw: 7 });
    meiaLua(g, x, y, r * 0.72, PI * 1.08, PI * 1.4, r * 0.16, false);
    g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.05, r * 0.2, r * 0.27, 0, 0, TAU); g.ellipse(x + r * 0.22, y - r * 0.05, r * 0.2, r * 0.27, 0, 0, TAU); g.fill();
    g.lineWidth = 3; g.strokeStyle = TINTA; g.stroke();
    g.fillStyle = TINTA; g.beginPath(); C(g, x - r * 0.24, y - r * 0.02, r * 0.1); C(g, x + r * 0.28, y - r * 0.02, r * 0.1); g.fill();
    g.beginPath(); g.arc(x - r * 0.02, y + r * 0.3, r * 0.18, 0.2, PI - 0.2); g.lineWidth = 3.5; g.lineCap = "round"; g.stroke();
  }
  D.dupla = function(g) {
    bolinhaMini(g, 16, -6, 26, "#35d6ff", "#1a7fc4");
    bolinhaMini(g, -14, 12, 28, "#ff4f9a", "#c41e6a");
  };
  function chamaF(g, s) {
    g.moveTo(0, 44 * s); g.bezierCurveTo(-38 * s, 40 * s, -40 * s, 2 * s, -18 * s, -18 * s); g.bezierCurveTo(-16 * s, -6 * s, -8 * s, -2 * s, -6 * s, -6 * s);
    g.bezierCurveTo(-12 * s, -26 * s, 0, -40 * s, 8 * s, -46 * s); g.bezierCurveTo(10 * s, -26 * s, 40 * s, -14 * s, 34 * s, 16 * s); g.bezierCurveTo(32 * s, 34 * s, 16 * s, 44 * s, 0, 44 * s); g.closePath();
  }
  D.fogo = function(g) {
    cel(g, function(g) { chamaF(g, 1); }, "#ff6a2b", "#c9301f", { dx: 5, dy: 4 });
    g.save(); g.translate(2, 12); cel(g, function(g) { chamaF(g, 0.58); }, "#ffd23f", "#ff9a1f", { dx: 2, dy: 2, lw: 0, semContorno: true }); g.restore();
    g.save(); g.translate(3, 24); g.beginPath(); chamaF(g, 0.26); g.fillStyle = "#fff8d0"; g.fill(); g.restore();
  };
  D.bau = function(g) {
    cel(g, function(g) { rr(g, -42, -2, 84, 42, 7); }, "#c96b3c", "#8a3f22", { dx: 5, dy: 5 });
    cel(g, function(g) { g.moveTo(-42, -2); g.lineTo(-42, -16); g.quadraticCurveTo(-40, -40, 0, -40); g.quadraticCurveTo(40, -40, 42, -16); g.lineTo(42, -2); g.closePath(); }, "#e0874d", "#a5512a", { dx: 4, dy: 4 });
    g.fillStyle = "#ffd23f"; g.strokeStyle = TINTA; g.lineWidth = 4;
    [-30, 22].forEach(function(x) { g.beginPath(); rr(g, x, -38, 8, 76, 2); g.fill(); g.stroke(); });
    cel(g, function(g) { rr(g, -9, -10, 18, 20, 4); }, "#ffd23f", "#e07b00", { dx: 1, dy: 2, lw: 5 });
    g.fillStyle = TINTA; g.beginPath(); C(g, 0, -2, 3); g.fill(); g.fillRect(-1.5, -2, 3, 7);
    g.save(); g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(-18, -30); g.quadraticCurveTo(-6, -34, 8, -33); g.stroke(); g.restore();
  };
  D.cadeado = function(g) {
    g.beginPath(); g.moveTo(-20, -4); g.lineTo(-20, -18); g.arc(0, -18, 20, PI, 0); g.lineTo(20, -4);
    g.lineCap = "round"; g.strokeStyle = TINTA; g.lineWidth = 20; g.stroke(); g.strokeStyle = "#b8c4ff"; g.lineWidth = 9; g.stroke();
    cel(g, function(g) { rr(g, -34, -8, 68, 52, 10); }, "#ffd23f", "#e07b00", { dx: 5, dy: 5 });
    g.fillStyle = TINTA; g.beginPath(); C(g, 0, 12, 7); g.fill(); g.beginPath(); poli(g, [-4, 14, 4, 14, 6, 28, -6, 28]); g.fill();
    g.fillStyle = "rgba(255,255,255,0.75)"; g.fillRect(-26, -2, 22, 5);
  };
  D.trevo = function(g) {
    g.beginPath(); g.moveTo(2, 8); g.quadraticCurveTo(8, 30, 22, 44); g.lineCap = "round"; g.strokeStyle = TINTA; g.lineWidth = 13; g.stroke(); g.strokeStyle = "#2fb85a"; g.lineWidth = 5; g.stroke();
    for (var i = 0; i < 4; i++) {
      g.save(); g.rotate(i * PI / 2 + PI / 4);
      cel(g, function(g) { g.moveTo(0, 0); g.bezierCurveTo(-26, -6, -26, -34, -8, -36); g.bezierCurveTo(-2, -36, 0, -30, 0, -28); g.bezierCurveTo(0, -30, 2, -36, 8, -36); g.bezierCurveTo(26, -34, 26, -6, 0, 0); g.closePath(); }, "#4fe07a", "#1f9e4d", { dx: 0, dy: 4, lw: 7 });
      g.restore();
    }
    g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.ellipse(-16, -24, 6, 3.5, -0.8, 0, TAU); g.fill();
  };
  D.arma = function(g) {
    cel(g, function(g) { rr(g, -26, 0, 22, 40, 7); }, "#5c63c8", "#33389a", { dx: 3, dy: 3 });
    cel(g, function(g) { rr(g, 16, -18, 30, 16, 5); }, "#a9b4e8", "#5c6499", { dx: 2, dy: 3 });
    cel(g, function(g) { rr(g, -40, -26, 62, 32, 12); }, "#ff4f9a", "#c41e6a", { dx: 4, dy: 5 });
    g.fillStyle = "#35d6ff"; g.beginPath(); C(g, -18, -10, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = TINTA; g.stroke();
    g.fillStyle = "#ffd23f"; g.beginPath(); C(g, 46, -10, 4); g.fill(); g.stroke();
    g.save(); g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(-30, -18); g.lineTo(-4, -18); g.stroke(); g.restore();
  };
  D.mapa = function(g) {
    cel(g, function(g) { poli(g, [-44, -30, -16, -40, 14, -30, 44, -40, 44, 32, 14, 42, -16, 32, -44, 42]); }, "#ffe9b0", "#e0b56a", { dx: 3, dy: 4 });
    g.fillStyle = "rgba(160,110,40,0.35)"; g.beginPath(); poli(g, [-16, -40, 14, -30, 14, 42, -16, 32]); g.fill();
    g.setLineDash([6, 6]); g.lineWidth = 4; g.strokeStyle = "#ff4057"; g.beginPath(); g.moveTo(-34, 22); g.quadraticCurveTo(-20, -10, 2, 8); g.quadraticCurveTo(18, 20, 26, -12); g.stroke(); g.setLineDash([]);
    linha(g, [20, -22, 32, -10], "#ff4057", 5); linha(g, [32, -22, 20, -10], "#ff4057", 5);
    g.beginPath(); poli(g, [-44, -30, -16, -40, 14, -30, 44, -40, 44, 32, 14, 42, -16, 32, -44, 42]); g.lineWidth = LW; g.strokeStyle = TINTA; g.lineJoin = "round"; g.stroke();
  };
  D.loja = function(g) {
    cel(g, function(g) { rr(g, -36, -8, 72, 48, 5); }, "#fff1d6", "#e0b98a", { dx: 5, dy: 5 });
    cel(g, function(g) { rr(g, -12, 10, 24, 30, 4); }, "#35d6ff", "#1a8fc4", { dx: 2, dy: 2, lw: 6 });
    // toldo listrado
    g.save(); g.beginPath(); g.moveTo(-44, -40); g.lineTo(44, -40); g.lineTo(46, -12); for (var i = 0; i < 6; i++) { var x = 46 - (i + 0.5) * 92 / 6; g.arc(x, -12, 92 / 12, 0, PI); } g.closePath();
    g.fillStyle = "#ffffff"; g.fill(); g.clip();
    g.fillStyle = "#ff4057"; for (i = 0; i < 6; i += 2) g.fillRect(-46 + i * 92 / 6, -42, 92 / 6, 50);
    g.restore();
    g.beginPath(); g.moveTo(-44, -40); g.lineTo(44, -40); g.lineTo(46, -12); for (i = 0; i < 6; i++) { x = 46 - (i + 0.5) * 92 / 6; g.arc(x, -12, 92 / 12, 0, PI); } g.closePath();
    g.lineWidth = 7; g.strokeStyle = TINTA; g.lineJoin = "round"; g.stroke();
  };
  D.roleta = function(g) {
    cel(g, function(g) { C(g, 0, 2, 42); }, "#ffd23f", "#e07b00", { dx: 3, dy: 4 });
    var cores = ["#ff4057", "#35d6ff", "#4fe07a", "#9a5cff", "#ff8a2b", "#ff4f9a"];
    for (var i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 32, i * TAU / 6 - PI / 2, (i + 1) * TAU / 6 - PI / 2); g.closePath(); g.fillStyle = cores[i]; g.fill(); g.lineWidth = 3; g.strokeStyle = TINTA; g.stroke(); }
    g.beginPath(); C(g, 0, 0, 32); g.lineWidth = 4; g.stroke();
    cel(g, function(g) { C(g, 0, 0, 9); }, "#ffffff", "#c8cdf0", { dx: 1, dy: 2, lw: 5 });
    cel(g, function(g) { poli(g, [-9, -46, 9, -46, 0, -30]); }, "#ff4057", "#b81a3a", { dx: 1, dy: 2, lw: 5 });
    meiaLua(g, 0, 0, 25, PI * 1.1, PI * 1.36, 4, false);
  };
  D.coroa = function(g) {
    cel(g, function(g) { poli(g, [-42, -22, -22, 0, 0, -34, 22, 0, 42, -22, 36, 30, -36, 30]); }, "#ffd23f", "#e07b00", { dx: 5, dy: 6 });
    g.fillStyle = "#e07b00"; g.fillRect(-36, 18, 72, 4);
    [[-24, 8, "#ff4057"], [0, 8, "#35d6ff"], [24, 8, "#4fe07a"]].forEach(function(q) { g.beginPath(); C(g, q[0], q[1], 6); g.fillStyle = q[2]; g.fill(); g.lineWidth = 4; g.strokeStyle = TINTA; g.stroke(); });
    [[-42, -22], [0, -34], [42, -22]].forEach(function(q) { g.beginPath(); C(g, q[0], q[1] - 4, 6); g.fillStyle = "#fff3b0"; g.fill(); g.lineWidth = 5; g.strokeStyle = TINTA; g.stroke(); });
    g.save(); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(-30, -4); g.lineTo(-24, 12); g.stroke(); g.restore();
  };
  function escudoF(g) { g.moveTo(0, -44); g.quadraticCurveTo(22, -32, 38, -34); g.quadraticCurveTo(42, 18, 0, 44); g.quadraticCurveTo(-42, 18, -38, -34); g.quadraticCurveTo(-22, -32, 0, -44); g.closePath(); }
  D.escudo = function(g) {
    cel(g, escudoF, "#35a8ff", "#1a5fc4", { dx: 5, dy: 6 });
    g.save(); g.scale(0.62, 0.62); g.translate(0, -2); g.beginPath(); escudoF(g); g.fillStyle = "#7ad3ff"; g.fill(); g.restore();
    g.beginPath(); estrelaP(g, 0, 0, 13, 6, 5); g.fillStyle = "#ffd23f"; g.fill(); g.lineWidth = 4; g.strokeStyle = TINTA; g.lineJoin = "round"; g.stroke();
    g.save(); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(-28, -26); g.quadraticCurveTo(-28, 2, -16, 18); g.stroke(); g.restore();
  };
  D.relogio = function(g) {
    cel(g, function(g) { rr(g, -8, -46, 16, 12, 3); }, "#ff4057", "#b81a3a", { dx: 1, dy: 2, lw: 6 });
    cel(g, function(g) { C(g, 0, 4, 38); }, "#ffd23f", "#e07b00", { dx: 4, dy: 5 });
    g.beginPath(); C(g, -1, 2, 28); g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 5; g.strokeStyle = TINTA; g.stroke();
    g.fillStyle = TINTA; for (var i = 0; i < 4; i++) { var a = i * PI / 2; g.beginPath(); C(g, -1 + Math.cos(a) * 21, 2 + Math.sin(a) * 21, 2.6); g.fill(); }
    linha(g, [-1, 2, -1, -14], TINTA, 1); linha(g, [-1, 2, 11, 9], TINTA, 1);
    g.beginPath(); C(g, -1, 2, 4); g.fillStyle = "#ff4057"; g.fill();
  };
  D.seta = function(g) { cel(g, function(g) { poli(g, [-40, -12, 6, -12, 6, -32, 42, 0, 6, 32, 6, 12, -40, 12]); }, "#ffd23f", "#e07b00", { dx: 3, dy: 5 }); g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(-32, -7, 30, 4); };
  D.voltar = function(g) { cel(g, function(g) { poli(g, [40, -12, -6, -12, -6, -32, -42, 0, -6, 32, -6, 12, 40, 12]); }, "#b8c4ff", "#6f7cc8", { dx: 3, dy: 5 }); g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(2, -7, 30, 4); };
  D.play = function(g) {
    cel(g, function(g) { g.moveTo(-26, -36); g.quadraticCurveTo(-30, -44, -20, -40); g.lineTo(38, -6); g.quadraticCurveTo(44, 0, 38, 6); g.lineTo(-20, 40); g.quadraticCurveTo(-30, 44, -26, 36); g.closePath(); }, "#4fe07a", "#1f9e4d", { dx: 4, dy: 6 });
    g.save(); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(-16, -26); g.lineTo(-16, 0); g.stroke(); g.restore();
  };
  D.fechar = function(g) {
    linha(g, [-26, -26, 26, 26], "#ff4057", 16); linha(g, [26, -26, -26, 26], "#ff4057", 16);
    g.save(); g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(-24, -20); g.lineTo(-12, -8); g.moveTo(20, -24); g.lineTo(10, -14); g.stroke(); g.restore();
  };
  D.copiar = function(g) {
    cel(g, function(g) { rr(g, -12, -40, 50, 60, 8); }, "#b8c4ff", "#6f7cc8", { dx: 3, dy: 4 });
    cel(g, function(g) { rr(g, -38, -18, 50, 60, 8); }, "#ffffff", "#c8cdf0", { dx: 3, dy: 4 });
    g.fillStyle = "#9aa3d8"; g.fillRect(-28, -4, 30, 5); g.fillRect(-28, 8, 30, 5); g.fillRect(-28, 20, 20, 5);
  };
  D.wifi = function(g) {
    g.lineCap = "round";
    [[40, -2.3, -0.84], [26, -2.25, -0.89], [12, -2.2, -0.94]].forEach(function(q) {
      g.beginPath(); g.arc(0, 26, q[0], q[1], q[2]); g.strokeStyle = TINTA; g.lineWidth = 17; g.stroke();
      g.beginPath(); g.arc(0, 26, q[0], q[1], q[2]); g.strokeStyle = "#35d6ff"; g.lineWidth = 8; g.stroke();
    });
    cel(g, function(g) { C(g, 0, 28, 8); }, "#35d6ff", "#1a8fc4", { dx: 1, dy: 2, lw: 6 });
  };
  D.usuario = function(g) {
    cel(g, function(g) { g.moveTo(-36, 42); g.quadraticCurveTo(-38, 6, 0, 6); g.quadraticCurveTo(38, 6, 36, 42); g.closePath(); }, "#9a5cff", "#5b2fb8", { dx: 4, dy: 4 });
    cel(g, function(g) { C(g, 0, -18, 22); }, "#ffd2a8", "#e09a6a", { dx: 4, dy: 5 });
    meiaLua(g, 0, -18, 15, PI * 1.1, PI * 1.4, 5, false);
  };
  D.chapeu = function(g) {
    cel(g, function(g) { g.ellipse(0, 28, 46, 13, 0, 0, TAU); }, "#5c63c8", "#33389a", { dx: 3, dy: 3 });
    cel(g, function(g) { g.moveTo(-26, 26); g.lineTo(-24, -34); g.quadraticCurveTo(0, -44, 24, -34); g.lineTo(26, 26); g.quadraticCurveTo(0, 32, -26, 26); g.closePath(); }, "#5c63c8", "#33389a", { dx: 5, dy: 3 });
    g.fillStyle = "#ff4057"; g.beginPath(); g.moveTo(-25.5, 6); g.quadraticCurveTo(0, 12, 25.5, 6); g.lineTo(25.8, 18); g.quadraticCurveTo(0, 24, -25.8, 18); g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = TINTA; g.stroke();
    g.save(); g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(-16, -28); g.lineTo(-16, -2); g.stroke(); g.restore();
  };
  D.olho = function(g) {
    cel(g, function(g) { g.moveTo(-46, 0); g.quadraticCurveTo(0, -46, 46, 0); g.quadraticCurveTo(0, 46, -46, 0); g.closePath(); }, "#ffffff", "#c8cdf0", { dx: 3, dy: 4 });
    g.beginPath(); C(g, 0, 0, 18); g.fillStyle = "#35a8ff"; g.fill(); g.lineWidth = 4; g.strokeStyle = TINTA; g.stroke();
    g.beginPath(); C(g, 0, 0, 9); g.fillStyle = TINTA; g.fill();
    g.fillStyle = "#ffffff"; g.beginPath(); C(g, -6, -6, 5); g.fill();
  };
  D.rastro = function(g) {
    g.lineCap = "round";
    [[-44, -18, -6, -18, "#ff4f9a", 10], [-40, 2, -2, 2, "#ffd23f", 12], [-44, 22, -6, 22, "#35d6ff", 10]].forEach(function(q) {
      g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[2], q[3]); g.strokeStyle = TINTA; g.lineWidth = q[5] + 8; g.stroke(); g.strokeStyle = q[4]; g.lineWidth = q[5]; g.stroke();
    });
    bolinhaMini(g, 18, 2, 26, "#ff8a2b", "#c9501f");
  };
  D.caveira = function(g) {
    cel(g, function(g) { g.moveTo(-36, -4); g.quadraticCurveTo(-38, -42, 0, -42); g.quadraticCurveTo(38, -42, 36, -4); g.quadraticCurveTo(34, 12, 22, 16); g.lineTo(22, 34); g.quadraticCurveTo(0, 42, -22, 34); g.lineTo(-22, 16); g.quadraticCurveTo(-34, 12, -36, -4); g.closePath(); }, "#f1f0ff", "#b6b2dc", { dx: 4, dy: 5 });
    g.fillStyle = TINTA; g.beginPath(); g.ellipse(-15, -8, 11, 12, 0.2, 0, TAU); g.ellipse(15, -8, 11, 12, -0.2, 0, TAU); g.fill();
    g.beginPath(); poli(g, [0, 6, -5, 16, 5, 16]); g.fill();
    g.fillStyle = "#ff4f9a"; g.beginPath(); C(g, -13, -10, 3.5); C(g, 17, -10, 3.5); g.fill();
    g.strokeStyle = TINTA; g.lineWidth = 4; g.beginPath(); g.moveTo(-8, 24); g.lineTo(-8, 34); g.moveTo(0, 25); g.lineTo(0, 36); g.moveTo(8, 24); g.lineTo(8, 34); g.stroke();
    meiaLua(g, 0, -10, 26, PI * 1.08, PI * 1.38, 5, false);
  };
  // desconhecido: círculo neutro
  function neutro(g) { cel(g, function(g) { C(g, 0, 0, 38); }, "#b8c4ff", "#6f7cc8", { dx: 4, dy: 5 }); meiaLua(g, 0, 0, 28, PI * 1.1, PI * 1.4, 5, false); }

  // ---------- API ----------
  function desenharVetor(ctx, nome, x, y, tam) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(tam / 100, tam / 100);
    try { (D[nome] || neutro)(ctx); } catch (e) { /* nunca quebra o jogo */ }
    ctx.restore();
  }
  // no canvas: sprite por (nome, tamanho real na tela); por quadro só um drawImage
  var sprites = {}, nSprites = 0;
  function sprite(nome, px) {
    var k = nome + "|" + px, s = sprites[k];
    if (s) return s;
    if (nSprites > 400) { sprites = {}; nSprites = 0; }
    var c = document.createElement("canvas");
    c.width = c.height = px + 4;
    desenharVetor(c.getContext("2d"), nome, (px + 4) / 2, (px + 4) / 2, px);
    nSprites++;
    return (sprites[k] = c);
  }
  function desenhar(ctx, nome, x, y, tam) {
    if (!(tam > 0)) return;
    var esc = 1;
    if (ctx.getTransform) { var m = ctx.getTransform(); esc = Math.sqrt(m.a * m.a + m.b * m.b) || 1; }
    var px = Math.round(tam * esc);
    if (px < 6 || px > 512) { desenharVetor(ctx, nome, x, y, tam); return; }
    px = px <= 48 ? px : px <= 128 ? Math.round(px / 4) * 4 : Math.round(px / 8) * 8;   // menos tamanhos guardados
    var c = sprite(nome, px), k = tam / px;
    ctx.drawImage(c, x - c.width * k / 2, y - c.height * k / 2, c.width * k, c.height * k);
  }

  var urls = {};
  function url(nome) {
    if (urls[nome]) return urls[nome];
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    desenharVetor(c.getContext("2d"), nome, 64, 64, 120);
    return (urls[nome] = c.toDataURL());
  }
  function html(nome, classe) {
    return "<i class='ico" + (classe ? " " + classe : "") + "' style=\"background-image:url(" + url(nome) + ")\"></i>";
  }
  // <i data-ico="nome"></i> no HTML fixo ganha o desenho
  function preencher(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    var l = raiz.querySelectorAll("[data-ico]");
    for (var i = 0; i < l.length; i++) {
      var e = l[i], n = e.getAttribute("data-ico");
      if (e.__ico === n) continue;
      e.__ico = n;
      e.classList.add("ico");
      e.style.backgroundImage = "url(" + url(n) + ")";
    }
  }
  if (typeof document !== "undefined" && document.body) preencher(document);

  return { NOMES: NOMES, desenhar: desenhar, html: html, url: url, preencher: preencher };
})();
