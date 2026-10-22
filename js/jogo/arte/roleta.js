"use strict";

// =========================
// ROLETAS DA ABERTURA (v19) — só desenho. A regra (o que sai, os tempos, o "tic" e o acelerar) fica em
// motor/partida.js (iniciarRoleta / atualizarRoleta / posRoleta); aqui só lê j.roleta.
//   Roleta.desenhar(ctx, j, M, L, cx, meio)   chamado pelo desenho.js na fase "roleta" (em coordenadas da tela)
// 1º a roleta de ARMA: uma fita vertical por bolinha (a da pessoa à esquerda), com o retrato em cima; a que tem arma
//    inicial aparece travada. Ao parar: o cartão pula, brilha na cor da raridade e a lendária ganha raios girando.
// 2º a roleta de MAPA: fita horizontal com os mapas; ao parar o cartão mostra o mapa de verdade e o fundo escuro
//    some, revelando a arena.
// Estilo v19: contorno escuro grosso (#1a0d33), cartões com borda dupla e sombra dura; nada de blur/sombra por quadro.
// =========================

const Roleta = (function() {
  var PI2 = Math.PI * 2, ESC = "#1a0d33";
  var COR_RAR = ["#ced4da", "#ced4da", "#b197fc", "#ffd43b"];
  var FONTE_R = "px Nunito, system-ui, sans-serif";

  function ret(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // texto grosso com contorno (diminui se não couber em maxW)
  function texto(ctx, s, x, y, tam, cor, maxW) {
    ctx.font = "900 " + tam + FONTE_R;
    var w = ctx.measureText(s).width;
    if (maxW && w > maxW) { tam = Math.max(10, Math.floor(tam * maxW / w)); ctx.font = "900 " + tam + FONTE_R; }
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, tam * 0.2); ctx.strokeStyle = ESC; ctx.strokeText(s, x, y);
    ctx.fillStyle = cor; ctx.fillText(s, x, y);
  }
  // título inclinado com sombra dura (estilo dos letreiros)
  function titulo(ctx, s, x, y, tam, cor, maxW) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.04);
    ctx.font = "900 " + tam + FONTE_R;
    var w = ctx.measureText(s).width;
    if (maxW && w > maxW) tam = Math.max(12, Math.floor(tam * maxW / w));
    texto(ctx, s, 0, tam * 0.1, tam, "#5a2a8a");
    texto(ctx, s, 0, 0, tam, cor);
    ctx.restore();
  }
  // cartão com borda dupla e sombra dura embaixo
  function cartao(ctx, x, y, w, h, fundo, borda, r) {
    r = r || 18;
    ctx.fillStyle = ESC; ret(ctx, x - 5, y - 5 + 8, w + 10, h + 10, r + 4); ctx.fill();
    ctx.fillStyle = ESC; ret(ctx, x - 5, y - 5, w + 10, h + 10, r + 4); ctx.fill();
    ctx.fillStyle = borda; ret(ctx, x - 1, y - 1, w + 2, h + 2, r + 1); ctx.fill();
    ctx.fillStyle = fundo; ret(ctx, x + 5, y + 5, w - 10, h - 10, r - 4); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.10)"; ret(ctx, x + 5, y + 5, w - 10, (h - 10) * 0.42, r - 4); ctx.fill();
  }
  // raios girando atrás do que acabou de sair (só formas chapadas)
  function raios(ctx, x, y, r, cor, t, alfa) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.2); ctx.globalAlpha *= alfa; ctx.fillStyle = cor;
    ctx.beginPath();
    for (var i = 0; i < 12; i++) { var a = i * PI2 / 12; ctx.moveTo(0, 0); ctx.arc(0, 0, r, a, a + PI2 / 30); ctx.closePath(); }
    ctx.fill(); ctx.restore();
  }
  function mola(u) { var c = 1.70158, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; }

  // fundo escuro com vinheta (pré-renderizado por altura)
  var fundoC = null, fundoH = 0;
  function fundo(H) {
    if (fundoC && fundoH === H) return fundoC;
    var c = document.createElement("canvas"); c.width = 320; c.height = Math.ceil(320 * H / 1280);
    var g = c.getContext("2d"), gr = g.createRadialGradient(160, c.height / 2, 10, 160, c.height / 2, Math.max(160, c.height * 0.75));
    gr.addColorStop(0, "rgba(58,30,110,0.94)"); gr.addColorStop(1, "rgba(14,8,34,0.97)");
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "rgba(255,255,255,0.035)";
    for (var i = -10; i < 30; i++) { g.beginPath(); g.moveTo(i * 24, 0); g.lineTo(i * 24 + 12, 0); g.lineTo(i * 24 + 12 - c.height * 0.5, c.height); g.lineTo(i * 24 - c.height * 0.5, c.height); g.fill(); }
    fundoC = c; fundoH = H;
    return c;
  }

  // retrato da bolinha (cor e camadas da partida, sem rastro/emote)
  function retrato(ctx, j, k, x, y, r, t, expr) {
    if (typeof ArteBolinha === "undefined") return;
    var sk = j.skins && j.skins[k] || { corpo: "classico", acessorio: "nenhum" };
    var ac = typeof sk.acessorio === "string" ? sk.acessorio.replace(/^v\|\d\|/, "v|0|") : "nenhum";
    ArteBolinha.desenhar(ctx, { x: x, y: y, r: r, cor: j.cores[k], olharX: k ? -0.5 : 0.5, olharY: 0.1, expressao: expr || "normal", piscar: 0, t: t,
      escalaX: 1, escalaY: 1, flash: 0, fantasma: 0, skin: sk.corpo, acessorio: ac, cache: true });
  }
  function nomeDe(j, k) {
    if (j.modo === "2p") return t("jogador_n", k + 1);
    if (k === 0) return t("voce_curto");
    return j.rival ? j.rival.d.nome : t("bot");
  }

  // ---------- roleta de arma ----------
  function cartaoArma(ctx, id, x, y, w, h, destaque) {
    var rar = ARMA[id] ? ARMA[id].raridade : 1, cor = COR_RAR[rar] || "#ced4da";
    cartao(ctx, x - w / 2, y - h / 2, w, h, destaque ? "#2c1a5e" : "#22164a", cor, 18);
    if (typeof ArteArmas !== "undefined" && ArteArmas.icone) ArteArmas.icone(ctx, id, x, y - h * 0.1, h * 0.56);
    texto(ctx, t("a_" + id), x, y + h * 0.36, Math.round(h * 0.13), destaque ? cor : "#ffffff", w - 18);
  }
  function fitaArma(ctx, j, a, k, x, y, esc, tAgora) {
    var w = 190 * esc, h = 150 * esc, passo = h + 14 * esc, n = a.fita.length;
    var parado = a.fixa || a.parou, idade = parado ? (a.fixa ? 9 : tAgora - a.tParou) : 0;
    // janela
    var jw = w + 46 * esc, jh = passo * 2.1;
    cartao(ctx, x - jw / 2, y - jh / 2, jw, jh, "#120a2e", "#5c3db8", 26 * esc);
    ctx.save(); ret(ctx, x - jw / 2 + 6, y - jh / 2 + 6, jw - 12, jh - 12, 20 * esc); ctx.clip();
    if (parado && !a.fixa) {
      var rar = ARMA[a.id].raridade;
      if (rar >= 2) raios(ctx, x, y, jh * 0.7, COR_RAR[rar], tAgora, Math.min(1, idade * 4) * (rar >= 3 ? 0.4 : 0.22));
    }
    if (parado) {
      var e = a.fixa ? 1 : idade < 0.35 ? 0.8 + 0.35 * mola(Math.min(1, idade / 0.35)) : 1.15 - Math.min(0.15, (idade - 0.35) * 0.6);
      ctx.save(); ctx.translate(x, y); ctx.scale(e, e); cartaoArma(ctx, a.id, 0, 0, w, h, true, tAgora); ctx.restore();
    } else {
      var p = a.pos, i0 = Math.floor(p), fr = p - i0;
      for (var d = -2; d <= 2; d++) {
        var i = i0 + d;
        if (i < 0 || i >= n) continue;
        var yy = y - (d - fr) * passo;          // a fita desce: o próximo vem de cima
        cartaoArma(ctx, a.fita[i], x, yy, w, h, false, tAgora);
      }
    }
    ctx.restore();
    // setas da janela (apontam para o centro)
    for (var s = -1; s <= 1; s += 2) {
      var sx = x + s * (jw / 2 + 4);
      ctx.beginPath(); ctx.moveTo(sx + s * 26 * esc, y - 20 * esc); ctx.lineTo(sx - s * 6 * esc, y); ctx.lineTo(sx + s * 26 * esc, y + 20 * esc); ctx.closePath();
      ctx.fillStyle = "#ffd43b"; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = ESC; ctx.lineJoin = "round"; ctx.stroke();
    }
    // selo embaixo: "INICIAL" (travada) ou a raridade quando para
    if (a.fixa) selo(ctx, x, y + jh / 2 + 6 * esc, t("arma_inicial_selo"), "#69db7c", esc);
    else if (parado) { var rr = ARMA[a.id].raridade; selo(ctx, x, y + jh / 2 + 6 * esc, t("rar_arma_" + rr), COR_RAR[rr], esc * (idade < 0.2 ? 0.6 + idade * 2 : 1)); }
  }
  function selo(ctx, x, y, s, cor, esc) {
    ctx.font = "900 " + Math.round(24 * esc) + FONTE_R;
    var w = ctx.measureText(s).width + 34 * esc, h = 40 * esc;
    cartao(ctx, x - w / 2, y - h / 2, w, h, cor, cor, h / 2);
    texto(ctx, s, x, y + 9 * esc, Math.round(24 * esc), "#ffffff");
  }

  // ---------- roleta de mapa ----------
  function cartaoMapa(ctx, j, id, x, y, w, h, destaque, mostrarMapa) {
    var cor = typeof ArteCenarios !== "undefined" && ArteCenarios.corDestaque ? ArteCenarios.corDestaque(id) : "#ffd43b";
    cartao(ctx, x - w / 2, y - h / 2, w, h, "#22164a", destaque ? "#ffd43b" : cor, 18);
    if (mostrarMapa && j.prerender) {
      ctx.save(); ret(ctx, x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 13); ctx.clip();
      var pr = j.prerender, ph = pr.width * (h - 14) / (w - 14);
      ctx.drawImage(pr, 0, Math.max(0, pr.height - ph) * 0.6, pr.width, Math.min(pr.height, ph), x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14);
      ctx.restore();
    } else {
      ctx.fillStyle = cor; ctx.globalAlpha = 0.35; ret(ctx, x - w / 2 + 12, y - h / 2 + 12, w - 24, h * 0.5, 12); ctx.fill(); ctx.globalAlpha = 1;
      if (typeof Icone !== "undefined") Icone.desenhar(ctx, "mapa", x, y - h * 0.16, h * 0.36);
    }
    ctx.fillStyle = "rgba(20,12,48,0.86)"; ret(ctx, x - w / 2 + 10, y + h * 0.18, w - 20, h * 0.28, 10); ctx.fill();
    texto(ctx, t("c_" + id), x, y + h * 0.39, Math.round(h * 0.17), destaque ? "#ffd43b" : "#ffffff", w - 28);
  }
  function fitaMapa(ctx, j, m, x, y, esc, tAgora, largura) {
    var w = 270 * esc, h = 176 * esc, passo = w + 18 * esc, n = m.fita.length;
    var jw = Math.min(largura - 40, passo * 3.1), jh = h + 40 * esc;
    cartao(ctx, x - jw / 2, y - jh / 2, jw, jh, "#120a2e", "#5c3db8", 26 * esc);
    ctx.save(); ret(ctx, x - jw / 2 + 6, y - jh / 2 + 6, jw - 12, jh - 12, 20 * esc); ctx.clip();
    if (m.parou) {
      var idade = tAgora - m.tParou, e = idade < 0.35 ? 0.85 + 0.25 * mola(Math.min(1, idade / 0.35)) : 1.1;
      raios(ctx, x, y, jw * 0.6, "#ffd43b", tAgora, Math.min(1, idade * 4) * 0.25);
      ctx.save(); ctx.translate(x, y); ctx.scale(e, e); cartaoMapa(ctx, j, m.id, 0, 0, w, h, true, true); ctx.restore();
    } else {
      var p = m.pos, i0 = Math.floor(p), fr = p - i0;
      for (var d = -2; d <= 2; d++) {
        var i = i0 + d;
        if (i < 0 || i >= n) continue;
        cartaoMapa(ctx, j, m.fita[i], x + (d - fr) * passo, y, w, h, false, false);
      }
    }
    ctx.restore();
    for (var s = -1; s <= 1; s += 2) {   // setas em cima e embaixo
      var sy = y + s * (jh / 2 + 4);
      ctx.beginPath(); ctx.moveTo(x - 22 * esc, sy + s * 24 * esc); ctx.lineTo(x, sy - s * 6 * esc); ctx.lineTo(x + 22 * esc, sy + s * 24 * esc); ctx.closePath();
      ctx.fillStyle = "#ffd43b"; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = ESC; ctx.lineJoin = "round"; ctx.stroke();
    }
  }

  // ---------- tudo ----------
  function desenhar(ctx, j, M, L, cx, meio) {
    var ro = j && j.roleta;
    if (!ro) return;
    var H = L && L.H || (typeof alturaTela !== "undefined" ? alturaTela : 720), em = !!(L && L.emPe);
    var esc = em ? 1.7 : 1, tAgora = ro.t, cy = em ? H * 0.47 : H / 2;
    // fundo escuro; no fim da roleta de mapa ele some e revela a arena
    var alfa = 1;
    if (ro.etapa === "mapa" && ro.mapa.parou) alfa = Math.max(0.15, 1 - (tAgora - ro.mapa.tParou) / 0.35 * 0.85);
    if (ro.t < 0.12) alfa *= ro.t / 0.12;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.drawImage(fundo(H), 0, 0, CONFIG.largura, H);
    ctx.globalAlpha = 1;
    var entra = Math.min(1, ro.tEtapa / 0.18);
    if (ro.etapa === "arma") {
      ctx.globalAlpha = Math.min(1, ro.tEtapa / 0.12);
      titulo(ctx, t("roleta_arma"), cx, cy - 245 * esc, Math.round(60 * esc), "#ffd43b", CONFIG.largura - 80);
      var dx = (em ? 250 : 260) * esc * (0.7 + 0.3 * mola(entra));
      for (var k = 0; k < 2; k++) {
        var a = ro.armas[k], x = cx + (k ? dx : -dx), yRet = cy - 160 * esc;
        var expr = a.parou || a.fixa ? (ARMA[a.id].raridade >= 3 ? "feliz" : "normal") : "bravo";
        retrato(ctx, j, k, x - 70 * esc, yRet, 30 * esc, tAgora, expr);
        texto(ctx, nomeDe(j, k), x + 22 * esc, yRet + 12 * esc, Math.round(32 * esc), j.cores[k], 200 * esc);
        fitaArma(ctx, j, a, k, x, cy + 30 * esc, esc, tAgora);
      }
      // VS no meio
      ctx.save(); ctx.translate(cx, cy + 30 * esc); ctx.rotate(-0.08);
      ctx.beginPath(); ctx.arc(0, 0, 38 * esc, 0, PI2); ctx.fillStyle = ESC; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 31 * esc, 0, PI2); ctx.fillStyle = "#ff4d5e"; ctx.fill();
      texto(ctx, "VS", 0, 12 * esc, Math.round(34 * esc), "#ffffff");
      ctx.restore();
    } else if (ro.etapa === "mapa") {
      ctx.globalAlpha = Math.min(1, ro.tEtapa / 0.12);
      var ty = cy - 150 * esc;
      titulo(ctx, t("roleta_mapa"), cx, ty, Math.round(60 * esc), "#74c0fc", CONFIG.largura - 80);
      ctx.save(); ctx.translate(cx, cy + 20 * esc); var em2 = 0.8 + 0.2 * mola(entra); ctx.scale(em2, em2);
      fitaMapa(ctx, j, ro.mapa, 0, 0, esc, tAgora, CONFIG.largura);
      ctx.restore();
      // armas já sorteadas, pequenas, embaixo
      for (var k2 = 0; k2 < 2; k2++) {
        var a2 = ro.armas[k2], x2 = cx + (k2 ? 1 : -1) * 220 * esc, y2 = cy + 200 * esc;
        if (typeof ArteArmas !== "undefined" && ArteArmas.icone) ArteArmas.icone(ctx, a2.id, x2, y2, 64 * esc);
        texto(ctx, t("a_" + a2.id), x2, y2 + 48 * esc, Math.round(22 * esc), COR_RAR[ARMA[a2.id].raridade] || "#fff", 260 * esc);
      }
    }
    // dica: toque acelera
    if (!ro.pulou && ro.t > 0.25) {
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(tAgora * 6);
      var yd = em ? H * 0.47 + 470 : H - 34;
      if (typeof Icone !== "undefined") Icone.desenhar(ctx, "mao", cx - 150 * esc, yd - 9 * esc, 30 * esc);
      texto(ctx, t("roleta_acelera"), cx + 10 * esc, yd, Math.round(22 * esc), "#ffffff", 300 * esc);
    }
    ctx.restore();
  }

  return { desenhar: desenhar };
})();
