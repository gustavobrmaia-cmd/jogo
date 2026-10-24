"use strict";

// =========================
// CARTAS DE ARMA DA ABERTURA (v20.5, no lugar das roletas da v19) — só desenho. A regra (o que cada carta esconde,
// os tempos, a escolha e os sons) fica em motor/partida.js (iniciarCartas / atualizarCartas / escolherCarta / ESCOLHA_CARTA);
// aqui só lê j.cartas. Exceções: guarda os retângulos das cartas (c.rects, para o toque em telas.js) e, quando o mouse
// mexe por cima de uma carta, ela vira a carta em foco (c.foco).
//   CartasArma.desenhar(ctx, j, M, L, cx, meio)   chamado pelo desenho.js na fase "cartas" (em coordenadas da tela)
// As 3 cartas chegam de baixo uma a uma e ficam flutuando, com um reflexo passando. A em foco sobe e brilha.
// Escolheu: ela vira (a frente na cor da raridade, raios girando na rara e na lendária) e depois as outras viram, apagadas.
// Estilo v19: contorno escuro grosso (#1a0d33), moldura com sombra dura, cores chapadas. Verso e frentes são desenhados
// uma vez num canvas guardado (por quadro: drawImage + ícone + 2 textos por carta).
// =========================

const CartasArma = (function() {
  var PI2 = Math.PI * 2, ESC = "#1a0d33";
  var FONTE_R = "px Nunito, system-ui, sans-serif";
  var W0 = 214, H0 = 290, R0 = 25;
  // por raridade: moldura clara, moldura escura, fundo, raios do fundo e cor do texto
  var RAR = {
    1: { borda: "#e3e9f7", sombra: "#8e9cc0", fundo: "#2b3a6e", raio: "#33447c", cor: "#eef2ff" },
    2: { borda: "#c9adff", sombra: "#7b4cf0", fundo: "#3c1e8a", raio: "#48279e", cor: "#d6c6ff" },
    3: { borda: "#ffd84a", sombra: "#ee8a00", fundo: "#7a3500", raio: "#944500", cor: "#ffe066" }
  };

  function ret(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function texto(g, s, x, y, tam, cor, maxW) {
    g.font = "900 " + tam + FONTE_R;
    var w = g.measureText(s).width;
    if (maxW && w > maxW) { tam = Math.max(10, Math.floor(tam * maxW / w)); g.font = "900 " + tam + FONTE_R; }
    g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
    g.lineWidth = Math.max(4, tam * 0.22); g.strokeStyle = ESC; g.strokeText(s, x, y);
    g.fillStyle = cor; g.fillText(s, x, y);
  }
  // título inclinado com sombra dura (como os letreiros)
  function titulo(g, s, x, y, tam, cor, maxW) {
    g.save(); g.translate(x, y); g.rotate(-0.04);
    g.font = "900 " + tam + FONTE_R;
    var w = g.measureText(s).width;
    if (maxW && w > maxW) tam = Math.max(12, Math.floor(tam * maxW / w));
    texto(g, s, 0, tam * 0.1, tam, "#5a2a8a");
    texto(g, s, 0, 0, tam, cor);
    g.restore();
  }
  function mola(u) { var c = 1.70158, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; }
  function lim(u) { return u < 0 ? 0 : u > 1 ? 1 : u; }
  // brilhinho de 4 pontas
  function estrela4(g, x, y, r) {
    g.beginPath(); g.moveTo(x, y - r);
    g.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y); g.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
    g.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y); g.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
    g.closePath();
  }
  function estrela5(g, x, y, r) {
    g.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    g.closePath();
  }
  // leque de raios (formas chapadas)
  function raios(g, x, y, r, n, cor, giro) {
    g.save(); g.translate(x, y); g.rotate(giro || 0); g.fillStyle = cor; g.beginPath();
    for (var i = 0; i < n; i++) { var a = i * PI2 / n; g.moveTo(0, 0); g.arc(0, 0, r, a, a + PI2 / n / 2); g.closePath(); }
    g.fill(); g.restore();
  }

  // ---------- canvases guardados ----------
  var guardado = {};
  function novoCanvas(w, h) { var c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  // moldura: contorno, aro com sombra dura (cel) e o filete escuro de dentro. Devolve o retângulo de dentro
  function moldura(g, w, h, r, e, clara, escura) {
    g.fillStyle = ESC; ret(g, 0, 0, w, h, r); g.fill();
    var a = 5 * e;
    g.save(); ret(g, a, a, w - a * 2, h - a * 2, r - a); g.clip();
    g.fillStyle = escura; g.fillRect(0, 0, w, h);
    g.fillStyle = clara; ret(g, a - 3 * e, a - 4 * e, w - a * 2, h - a * 2, r - a); g.fill();
    g.restore();
    var b = 13 * e;
    g.fillStyle = ESC; ret(g, b, b, w - b * 2, h - b * 2, r - b * 0.8); g.fill();
    var c = 16 * e;
    return { x: c, y: c, w: w - c * 2, h: h - c * 2, r: Math.max(4, r - c * 0.8) };
  }
  // brilho em meia-lua no canto de cima da moldura
  function meiaLua(g, x, y, r, e) {
    g.save(); g.lineCap = "round"; g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 5 * e;
    g.beginPath(); g.arc(x, y, r, Math.PI * 1.06, Math.PI * 1.4); g.stroke();
    g.fillStyle = "rgba(255,255,255,0.85)"; g.beginPath(); g.arc(x + Math.cos(Math.PI * 1.5) * r + 6 * e, y + Math.sin(Math.PI * 1.5) * r, 2.6 * e, 0, PI2); g.fill();
    g.restore();
  }

  function verso(e) {
    var k = "v" + e;
    if (guardado[k]) return guardado[k];
    var w = W0 * e, h = H0 * e, c = novoCanvas(w, h), g = c.getContext("2d");
    var d = moldura(g, w, h, R0 * e, e, "#ffd84a", "#ee8a00");
    g.save(); ret(g, d.x, d.y, d.w, d.h, d.r); g.clip();
    g.fillStyle = "#4b25b8"; g.fillRect(0, 0, w, h);
    // metade de baixo mais escura, em diagonal (dois tons, sem degradê)
    g.fillStyle = "#3a1b94"; g.beginPath(); g.moveTo(0, h * 0.64); g.lineTo(w, h * 0.44); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
    // losangos
    g.strokeStyle = "rgba(255,255,255,0.07)"; g.lineWidth = 3 * e;
    for (var i = -12; i < 14; i++) {
      g.beginPath(); g.moveTo(i * 24 * e, 0); g.lineTo(i * 24 * e + h, h); g.stroke();
      g.beginPath(); g.moveTo(i * 24 * e, 0); g.lineTo(i * 24 * e - h, h); g.stroke();
    }
    // reflexo no canto de cima
    g.fillStyle = "rgba(255,255,255,0.08)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.75, 0); g.lineTo(0, h * 0.42); g.closePath(); g.fill();
    // filete dourado de dentro e estrelinhas nos cantos
    g.strokeStyle = "rgba(255,216,74,0.6)"; g.lineWidth = 2.5 * e; ret(g, d.x + 8 * e, d.y + 8 * e, d.w - 16 * e, d.h - 16 * e, Math.max(4, d.r - 6 * e)); g.stroke();
    g.fillStyle = "#ffd84a";
    [[d.x + 22 * e, d.y + 22 * e], [d.x + d.w - 22 * e, d.y + 22 * e], [d.x + 22 * e, d.y + d.h - 22 * e], [d.x + d.w - 22 * e, d.y + d.h - 22 * e]].forEach(function(p) { estrela4(g, p[0], p[1], 8 * e); g.fill(); });
    // medalhão no meio com raios atrás
    var mx = w / 2, my = h * 0.47, R = w * 0.3;
    raios(g, mx, my, R * 1.9, 14, "rgba(255,216,74,0.13)", 0.1);
    g.restore();
    g.fillStyle = ESC; g.beginPath(); g.arc(mx, my + 4 * e, R + 6 * e, 0, PI2); g.fill();
    g.save(); g.beginPath(); g.arc(mx, my, R, 0, PI2); g.clip();
    g.fillStyle = "#ee8a00"; g.fillRect(mx - R, my - R, R * 2, R * 2);
    g.fillStyle = "#ffd84a"; g.beginPath(); g.arc(mx - 3 * e, my - 4 * e, R, 0, PI2); g.fill();
    g.restore();
    g.fillStyle = ESC; g.beginPath(); g.arc(mx, my, R * 0.78, 0, PI2); g.fill();
    g.save(); g.beginPath(); g.arc(mx, my, R * 0.72, 0, PI2); g.clip();
    g.fillStyle = "#5427d1"; g.fillRect(mx - R, my - R, R * 2, R * 2);
    g.fillStyle = "#6f40f2"; g.beginPath(); g.arc(mx - 3 * e, my - 5 * e, R * 0.72, 0, PI2); g.fill();
    g.restore();
    // "?" com sombra dura
    g.save(); g.translate(mx, my + R * 0.42); g.rotate(-0.08);
    texto(g, "?", 2 * e, 5 * e, Math.round(R * 1.25), "#2a1270");
    texto(g, "?", 0, 0, Math.round(R * 1.25), "#ffffff");
    g.restore();
    meiaLua(g, mx, my, R * 0.55, e);
    meiaLua(g, R0 * e + 2 * e, R0 * e + 2 * e, R0 * e * 0.62, e);
    guardado[k] = c;
    return c;
  }

  function frente(e, rar) {
    var k = "f" + e + "_" + rar;
    if (guardado[k]) return guardado[k];
    var p = RAR[rar] || RAR[1];
    var w = W0 * e, h = H0 * e, c = novoCanvas(w, h), g = c.getContext("2d");
    var d = moldura(g, w, h, R0 * e, e, p.borda, p.sombra);
    g.save(); ret(g, d.x, d.y, d.w, d.h, d.r); g.clip();
    g.fillStyle = p.fundo; g.fillRect(0, 0, w, h);
    raios(g, w / 2, h * 0.4, h, 16, p.raio, 0.05);
    if (rar >= 3) { g.fillStyle = "rgba(255,216,74,0.22)"; g.beginPath(); g.arc(w / 2, h * 0.4, w * 0.36, 0, PI2); g.fill(); }
    else if (rar === 2) { g.fillStyle = "rgba(201,173,255,0.14)"; g.beginPath(); g.arc(w / 2, h * 0.4, w * 0.34, 0, PI2); g.fill(); }
    g.fillStyle = "rgba(255,255,255,0.07)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.75, 0); g.lineTo(0, h * 0.42); g.closePath(); g.fill();
    // placa do nome
    var py = h - 70 * e;
    g.fillStyle = ESC; ret(g, d.x + 6 * e, py, d.w - 12 * e, 46 * e, 14 * e); g.fill();
    g.fillStyle = "#22164c"; ret(g, d.x + 10 * e, py + 4 * e, d.w - 20 * e, 38 * e, 11 * e); g.fill();
    g.restore();
    // estrelas da raridade (acesas = raridade)
    for (var i = 0; i < 3; i++) {
      var sx = w / 2 + (i - 1) * 30 * e, sy = h - 88 * e;
      estrela5(g, sx, sy, 13 * e); g.lineWidth = 5 * e; g.strokeStyle = ESC; g.lineJoin = "round"; g.stroke();
      g.fillStyle = i < rar ? "#ffd43b" : "#3b2f63"; g.fill();
    }
    // selo da raridade em cima (o texto é por idioma: vem no desenho de cada quadro)
    var sw = w * 0.64, sh = 30 * e, sx0 = (w - sw) / 2, sy0 = 7 * e;
    g.fillStyle = ESC; ret(g, sx0 - 3 * e, sy0 - 3 * e, sw + 6 * e, sh + 6 * e, sh / 2 + 3 * e); g.fill();
    g.fillStyle = p.sombra; ret(g, sx0, sy0, sw, sh, sh / 2); g.fill();
    g.fillStyle = p.borda; ret(g, sx0, sy0, sw, sh * 0.55, sh * 0.3); g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1;
    meiaLua(g, R0 * e + 2 * e, R0 * e + 2 * e, R0 * e * 0.62, e);
    guardado[k] = c;
    return c;
  }

  // fundo escuro com vinheta (por altura)
  var fundoC = null, fundoH = 0;
  function fundo(H) {
    if (fundoC && fundoH === H) return fundoC;
    var c = novoCanvas(320, Math.ceil(320 * H / 1280)), g = c.getContext("2d");
    var gr = g.createRadialGradient(160, c.height / 2, 10, 160, c.height / 2, Math.max(160, c.height * 0.75));
    gr.addColorStop(0, "rgba(58,30,110,0.93)"); gr.addColorStop(1, "rgba(14,8,34,0.97)");
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "rgba(255,255,255,0.035)";
    for (var i = -10; i < 30; i++) { g.beginPath(); g.moveTo(i * 24, 0); g.lineTo(i * 24 + 12, 0); g.lineTo(i * 24 + 12 - c.height * 0.5, c.height); g.lineTo(i * 24 - c.height * 0.5, c.height); g.fill(); }
    fundoC = c; fundoH = H;
    return c;
  }

  // uma carta: (x, y) = centro; sx = largura da virada (1 = de frente, 0 = de lado); id = arma (null = verso)
  function carta(g, x, y, e, ang, esc, sx, id, tAgora, reflexo) {
    var w = W0 * e, h = H0 * e;
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(esc * Math.max(0.02, sx), esc);
    g.fillStyle = "rgba(10,5,25,0.5)"; ret(g, -w / 2 + 3 * e, -h / 2 + 10 * e, w, h, R0 * e); g.fill();
    if (!id) {
      g.drawImage(verso(e), -w / 2, -h / 2);
      if (reflexo !== null) {
        // reflexo passando (faixa inclinada)
        g.save(); ret(g, -w / 2 + 16 * e, -h / 2 + 16 * e, w - 32 * e, h - 32 * e, 14 * e); g.clip();
        var px = -w + reflexo * w * 2.4;
        g.fillStyle = "rgba(255,255,255,0.16)"; g.beginPath();
        g.moveTo(px, -h / 2); g.lineTo(px + 34 * e, -h / 2); g.lineTo(px - 46 * e, h / 2); g.lineTo(px - 80 * e, h / 2); g.closePath(); g.fill();
        g.restore();
      }
    } else {
      var rar = ARMA[id] ? ARMA[id].raridade : 1, p = RAR[rar] || RAR[1];
      g.drawImage(frente(e, rar), -w / 2, -h / 2);
      if (typeof ArteArmas !== "undefined" && ArteArmas.icone) ArteArmas.icone(g, id, 0, -h * 0.12, h * 0.42);
      texto(g, t("rar_arma_" + rar).toUpperCase(), 0, -h / 2 + 29 * e, Math.round(17 * e), "#ffffff", w * 0.58);
      texto(g, t("a_" + id), 0, h / 2 - 33 * e, Math.round(23 * e), p.cor, w - 48 * e);
    }
    g.restore();
  }

  function selo(g, x, y, s, cor, e, esc) {
    g.save();
    g.font = "900 " + Math.round(24 * e) + FONTE_R;
    var w = Math.min(g.measureText(s).width, 420 * e) + 36 * e, h = 42 * e;
    // não sai da tela (a carta da ponta com um texto longo)
    var meia = (w / 2 + 24 * e) * esc;
    g.translate(Math.min(Math.max(x, meia), CONFIG.largura - meia), y); g.scale(esc, esc);
    g.fillStyle = ESC; ret(g, -w / 2 - 4 * e, -h / 2 - 4 * e + 5 * e, w + 8 * e, h + 8 * e, h / 2 + 4 * e); g.fill();
    g.fillStyle = ESC; ret(g, -w / 2 - 4 * e, -h / 2 - 4 * e, w + 8 * e, h + 8 * e, h / 2 + 4 * e); g.fill();
    g.fillStyle = cor; ret(g, -w / 2, -h / 2, w, h, h / 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.22)"; ret(g, -w / 2 + 6 * e, -h / 2 + 4 * e, w - 12 * e, h * 0.4, h * 0.2); g.fill();
    texto(g, s, 0, 9 * e, Math.round(24 * e), "#ffffff", 420 * e);
    g.restore();
  }

  // ---------- tudo ----------
  function desenhar(ctx, j, M, L, cx, meio) {
    var c = j && j.cartas;
    if (!c) return;
    var H = L && L.H || (typeof alturaTela !== "undefined" ? alturaTela : 720), em = !!(L && L.emPe);
    var e = em ? 1.5 : 1, cy = em ? H * 0.46 : H / 2 + 10;
    var w = W0 * e, h = H0 * e, gap = 254 * e, yBase = cy + 40 * e;
    var tA = c.t, d = c.sel === null ? -1 : tA - c.tSel;
    var vira = ESCOLHA_CARTA.vira, fim = ESCOLHA_CARTA.fim;
    // mouse por cima de uma carta: ela fica em foco (só quando o mouse mexe; as setas também mudam o foco)
    if (c.sel === null && c.rects && typeof entrada !== "undefined" && entrada.mouseAtivo && (entrada.mouseX !== c.mx || entrada.mouseY !== c.my)) {
      c.mx = entrada.mouseX; c.my = entrada.mouseY;
      c.rects.forEach(function(q, i) { if (q && c.mx >= q.x && c.mx <= q.x + q.w && c.my >= q.y && c.my <= q.y + q.h) c.foco = i; });
    }
    // fundo: entra em 0,15 s; no fim some e revela a arena
    var alfa = lim(tA / 0.15);
    if (d >= fim - 0.28) alfa *= lim((fim - d) / 0.28);
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.drawImage(fundo(H), 0, 0, CONFIG.largura, H);
    // título (pula para dentro) e a dica da lendária
    var ent = mola(lim(tA / 0.32));
    ctx.save(); ctx.translate(cx, cy - 214 * e); ctx.scale(0.6 + 0.4 * ent, 0.6 + 0.4 * ent);
    titulo(ctx, t("escolha_arma"), 0, 0, Math.round(58 * e), "#ffd43b", CONFIG.largura / e - 80);
    ctx.restore();
    if (c.sel === null) {
      ctx.globalAlpha = alfa * lim((tA - 0.25) / 0.2);
      texto(ctx, t("carta_lendaria"), cx, cy - 166 * e, Math.round(25 * e), "#ffe8a3", CONFIG.largura - 60);
      // barrinha do tempo (escolhe sozinho no fim)
      var resta = lim(1 - tA / ESCOLHA_CARTA.auto), bw = 300 * e, by = cy - 148 * e;
      ctx.fillStyle = ESC; ret(ctx, cx - bw / 2 - 4 * e, by - 4 * e, bw + 8 * e, 18 * e, 9 * e); ctx.fill();
      ctx.fillStyle = resta > 0.34 ? "#ffd43b" : "#ff6b6b"; ret(ctx, cx - bw / 2, by, Math.max(10 * e, bw * resta), 10 * e, 5 * e); ctx.fill();
      ctx.globalAlpha = alfa;
    }
    // ordem: as outras primeiro, a escolhida (ou a em foco) por cima
    var ordem = [0, 1, 2], topo = c.sel !== null ? c.sel : c.foco;
    ordem.splice(ordem.indexOf(topo), 1); ordem.push(topo);
    var rects = [], outra = 0;
    for (var n = 0; n < 3; n++) {
      var i = ordem[n], xb = cx + (i - 1) * gap;
      var u = lim((tA - 0.06 - i * 0.09) / 0.42);
      if (u <= 0) continue;
      var ee = mola(u), x = xb, y = yBase + (1 - ee) * H * 0.55;
      var ang = (i - 1) * 0.07 + (1 - u) * (i - 1) * 0.6, esc = 0.7 + 0.3 * ee, sx = 1, id = null, a = 1;
      y += Math.sin(tA * 2.2 + i * 1.7) * 4 * e; ang += Math.sin(tA * 1.6 + i) * 0.012;
      if (u >= 1) rects[i] = { x: xb - w / 2, y: yBase - h / 2, w: w, h: h };
      if (c.sel === null) {
        var foco = i === c.foco && tA >= ESCOLHA_CARTA.guarda;
        if (foco) {
          y -= 16 * e; esc *= 1.07;
          // aro amarelo pulsando em volta da carta em foco (contorno escuro por fora)
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(esc, esc);
          var ab = (9 + 3 * Math.sin(tA * 9)) * e;
          ret(ctx, -w / 2 - ab, -h / 2 - ab, w + ab * 2, h + ab * 2, R0 * e + ab);
          ctx.lineWidth = 12 * e; ctx.strokeStyle = ESC; ctx.stroke();
          ctx.lineWidth = 6 * e; ctx.strokeStyle = "#ffd43b"; ctx.stroke();
          ctx.restore();
        }
        var ciclo = (tA * 0.55 + i * 0.27) % 1.25;
        carta(ctx, x, y, e, ang, esc, 1, null, tA, ciclo <= 1 ? ciclo : null);
        // tecla 1/2/3 no canto (teclado)
        if (typeof entrada !== "undefined" && !entrada.toque && u >= 1) {
          var kx = x - w / 2 * esc + 6 * e, ky = y - h / 2 * esc + 6 * e;
          ctx.fillStyle = ESC; ctx.beginPath(); ctx.arc(kx, ky, 19 * e, 0, PI2); ctx.fill();
          ctx.fillStyle = foco ? "#ffd43b" : "#ffffff"; ctx.beginPath(); ctx.arc(kx, ky, 14 * e, 0, PI2); ctx.fill();
          ctx.font = "900 " + Math.round(20 * e) + FONTE_R; ctx.textAlign = "center"; ctx.fillStyle = ESC; ctx.fillText(String(i + 1), kx, ky + 7 * e);
        }
        continue;
      }
      // depois da escolha
      var p;
      if (i === c.sel) {
        p = lim(d / vira);
        var sobe = mola(lim(d / 0.32));
        y = yBase - 24 * e * sobe; ang = 0; esc = 1 + 0.14 * sobe;
        sx = Math.abs(Math.cos(p * Math.PI)); id = p >= 0.5 ? c.armas[i] : null;
        if (id) {
          var rar = ARMA[id].raridade, ida = d - vira / 2;
          // raios girando atrás (rara e lendária) e um anel que se abre na hora que vira
          if (rar >= 2) {
            ctx.globalAlpha = alfa * lim(ida * 4) * (rar >= 3 ? 0.5 : 0.3);
            raios(ctx, x, y, h * 1.05, 12, rar >= 3 ? "#ffd43b" : "#b197fc", tA * 1.1);
            ctx.globalAlpha = alfa;
          }
          if (ida < 0.5) {
            ctx.globalAlpha = alfa * (1 - ida / 0.5);
            ctx.lineWidth = 10 * e; ctx.strokeStyle = (RAR[rar] || RAR[1]).borda;
            ctx.beginPath(); ctx.arc(x, y, w * (0.45 + ida * 1.6), 0, PI2); ctx.stroke();
            ctx.globalAlpha = alfa;
          }
          if (rar >= 3) {   // brilhinhos rodando em volta da lendária
            ctx.fillStyle = "#fff3bf";
            for (var s = 0; s < 6; s++) {
              var as = tA * 1.4 + s * PI2 / 6, rs = w * 0.78 + Math.sin(tA * 3 + s) * 8 * e;
              estrela4(ctx, x + Math.cos(as) * rs, y + Math.sin(as) * rs * 1.25, (8 + 4 * Math.sin(tA * 6 + s)) * e); ctx.fill();
            }
          }
        }
      } else {
        var dd = d - ESCOLHA_CARTA.outras - (outra++) * 0.07;
        p = lim(dd / vira);
        sx = Math.abs(Math.cos(p * Math.PI)); id = p >= 0.5 ? c.armas[i] : null;
        esc *= 1 - 0.12 * lim(d / 0.3);
        if (id) a = 0.55;
      }
      ctx.globalAlpha = alfa * a;
      carta(ctx, x, y, e, ang, esc, sx, id, tA, null);
      if (a < 1) {   // apagada: véu escuro por cima
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(esc * Math.max(0.02, sx), esc);
        ctx.fillStyle = "rgba(14,8,34,0.45)"; ret(ctx, -w / 2, -h / 2, w, h, R0 * e); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = alfa;
    }
    c.rects = rects;
    // embaixo: a arma inicial (antes de escolher) ou o resultado com ela ("MELHOR!" / fica a inicial)
    var yb = yBase + h / 2 + 46 * e;
    if (c.sel === null && c.ini) texto(ctx, t("arma_inicial_e", t("a_" + c.ini)), cx, yb + 8 * e, Math.round(24 * e), "#8ce99a", CONFIG.largura - 60);
    if (c.sel !== null && c.ini && d >= vira) {
      var pop = 0.6 + 0.4 * mola(lim((d - vira) / 0.25)), xs = cx + (c.sel - 1) * gap;
      if (c.melhor) selo(ctx, xs, yb + 14 * e, t("roleta_melhor"), "#f59f00", e, pop);
      else selo(ctx, xs, yb + 14 * e, t("arma_inicial_e", t("a_" + c.ini)), "#2f9e44", e, pop);
    }
    // mãozinha tocando a carta em foco (até a pessoa escolher)
    if (c.sel === null && tA > 1.2 && typeof Icone !== "undefined") {
      var bate = Math.abs(Math.sin(tA * 5)), xm = cx + (c.foco - 1) * gap + w * 0.22, ym = yBase + h * 0.3 - 16 * e + bate * 12 * e;
      Icone.desenhar(ctx, "mao", xm, ym, 74 * e);
    }
    ctx.restore();
  }

  return { desenhar: desenhar };
})();
