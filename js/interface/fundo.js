"use strict";

// =========================
// FUNDO DA MÁQUINA (atrás de tudo): parede de chapas, canos com válvulas, engrenagens girando, um motor com
// pistões soltando fumaça e luzinhas piscando. Desenhado em baixa resolução (1/4 da tela) e ampliado sem borrar,
// a 30 quadros por segundo (é só enfeite: não pode pesar no celular). A parte parada fica guardada; por quadro só
// engrenagens, pistões, fumaça e luzes.
// =========================
const Fundo = (function() {
  const cv = el("fundo"), g = cv.getContext("2d");
  const ESC = 4, QS = 6;
  let W = 0, H = 0, fixo = null, acum = 0, t = 0, tg = 0;
  // pane: mexido pela animação do renascer (curto.js): velocidade das engrenagens/pistões, quanto de fumaça e se as luzes piram
  const pane = { vel: 1, fumaca: 1, luzes: 0 };
  const fumaca = [];
  function montar() {
    W = Math.ceil(window.innerWidth / ESC); H = Math.ceil(window.innerHeight / ESC);
    cv.width = W; cv.height = H;
    fixo = document.createElement("canvas"); fixo.width = W; fixo.height = H;
    const f = fixo.getContext("2d");
    const rt = function(x, y, w, h, c) { f.fillStyle = c; f.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    // parede: chapas de 48 com junta e rebites
    rt(0, 0, W, H, "#171030");
    for (let x = 0; x < W; x += 48) for (let y = 0; y < H; y += 36) {
      rt(x, y, 48, 36, (x / 48 + y / 36) % 2 ? "#1a1236" : "#181033");
      rt(x, y, 48, 1, "#221a48"); rt(x, y, 1, 36, "#201844"); rt(x, y + 35, 48, 1, "#100a24");
      rt(x + 2, y + 2, 1, 1, "#3a2f6e"); rt(x + 45, y + 2, 1, 1, "#3a2f6e"); rt(x + 2, y + 33, 1, 1, "#3a2f6e"); rt(x + 45, y + 33, 1, 1, "#3a2f6e");
    }
    // canos: um em cima atravessando e um descendo na direita
    const cano = function(x, y, w, h, vert) {
      rt(x, y, w, h, "#3d4a66"); if (vert) { rt(x, y, 2, h, "#5d6c8f"); rt(x + w - 2, y, 2, h, "#26304a"); } else { rt(x, y, w, 2, "#5d6c8f"); rt(x, y + h - 2, w, 2, "#26304a"); }
      for (let k = vert ? y + 20 : x + 20; k < (vert ? y + h : x + w); k += 44) { if (vert) { rt(x - 1, k, w + 2, 4, "#53627f"); rt(x - 1, k + 3, w + 2, 1, "#202940"); } else { rt(k, y - 1, 4, h + 2, "#53627f"); rt(k + 3, y - 1, 1, h + 2, "#202940"); } }
    };
    cano(0, Math.round(H * 0.08), W, 7, false);
    cano(Math.round(W * 0.965), Math.round(H * 0.08), 7, H, true);
    cano(0, Math.round(H * 0.55), Math.round(W * 0.05), 6, false);
    // válvula (roda vermelha) no cano de cima
    const vx = Math.round(W * 0.42), vy = Math.round(H * 0.08) + 3;
    f.fillStyle = "#c2262f"; f.beginPath(); f.arc(vx, vy, 5, 0, 7); f.fill(); f.fillStyle = "#171030"; f.beginPath(); f.arc(vx, vy, 3, 0, 7); f.fill(); rt(vx - 1, vy - 5, 2, 10, "#c2262f"); rt(vx - 5, vy - 1, 10, 2, "#c2262f");
    // faixa de perigo no rodapé
    for (let x = 0; x < W; x++) for (let y = H - 5; y < H - 1; y++) if ((x + y) % 8 < 4) rt(x, y, 1, 1, "#3a2c10"); else rt(x, y, 1, 1, "#1f1708");
    // motor (base) embaixo à direita
    const mx = Math.round(W * 0.7), my = Math.round(H * 0.8);
    rt(mx, my, 46, 24, "#2b2550"); rt(mx, my, 46, 2, "#463d82"); rt(mx, my + 22, 46, 2, "#120c26");
    rt(mx + 4, my + 6, 38, 4, "#1d1840"); for (let k = 0; k < 5; k++) rt(mx + 6 + k * 8, my + 13, 4, 7, "#3b3270");
    rt(mx + 38, my - 22, 6, 22, "#3d4a66"); rt(mx + 38, my - 22, 2, 22, "#5d6c8f"); rt(mx + 36, my - 24, 10, 3, "#53627f");
    montar.motor = { x: mx, y: my };
  }
  window.addEventListener("resize", montar);
  montar();

  const ENG = [
    { fx: 0.05, fy: 0.95, r: 34, d: 16, v: 0.25 },
    { fx: 0.05, fy: 0.95, r: 18, d: 9, v: -0.25 * 16 / 9, liga: 0, ang: -0.9 },
    { fx: 0.95, fy: 0.16, r: 26, d: 14, v: -0.22 },
    { fx: 0.95, fy: 0.16, r: 12, d: 8, v: 0.22 * 14 / 8, liga: 2, ang: 2.4, tom: "ouro" },
    { fx: 0.5, fy: 0.98, r: 16, d: 10, v: 0.3, tom: "escuro" }
  ];
  function passo(dt) {
    acum += dt; if (acum < 1 / 30) return;
    t += acum; const d = acum; acum = 0; tg += d * pane.vel;
    if (!fixo) return;
    g.drawImage(fixo, 0, 0);
    // engrenagens (as pequenas encaixadas nas grandes)
    ENG.forEach(function(e, i) {
      let x = e.fx * W, y = e.fy * H;
      if (e.liga !== undefined) { const p = ENG[e.liga]; x = p.fx * W + Math.cos(e.ang) * (p.r + e.r + 1); y = p.fy * H + Math.sin(e.ang) * (p.r + e.r + 1); }
      const per = Math.PI * 2 / e.d, ang = tg * e.v, q = Math.floor((((ang % per) + per) % per) / per * QS);
      const s = Pixel.engrenagem(e.r, e.d, q, QS, e.tom);
      g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
    });
    // motor: pistões e fumaça
    const m = montar.motor;
    for (let k = 0; k < 2; k++) {
      const off = Math.round(Math.abs(Math.sin(tg * 6 + k * 1.6)) * 5);
      g.fillStyle = "#9aa3c0"; g.fillRect(m.x + 8 + k * 14, m.y - 10 + off, 8, 10 - off + 2); g.fillStyle = "#c9d0e3"; g.fillRect(m.x + 8 + k * 14, m.y - 10 + off, 8, 2);
    }
    if (Math.random() < d * 6 * pane.fumaca) fumaca.push({ x: m.x + 41, y: m.y - 25, r: 2 + Math.random() * 2, t: 0, vx: (Math.random() - 0.3) * 6 });
    for (let i = fumaca.length - 1; i >= 0; i--) {
      const p = fumaca[i]; p.t += d; p.y -= d * 14; p.x += p.vx * d; p.r += d * 3;
      if (p.t > 3) { fumaca.splice(i, 1); continue; }
      g.globalAlpha = 0.45 * (1 - p.t / 3); g.fillStyle = pane.fumaca > 1 ? "#3a3450" : "#6a6290";
      g.fillRect(Math.round(p.x - p.r), Math.round(p.y - p.r * 0.7), Math.round(p.r * 2), Math.round(p.r * 1.4));
      g.fillRect(Math.round(p.x - p.r * 0.7), Math.round(p.y - p.r), Math.round(p.r * 1.4), Math.round(p.r * 2));
    }
    g.globalAlpha = 1;
    // luzinhas no cano
    for (let k = 0; k < 6; k++) { const on = pane.luzes ? Math.random() < 0.5 : Math.sin(t * (1.3 + k * 0.4) + k) > 0.2; g.fillStyle = on ? (k % 2 ? "#3ccf6e" : "#ff4d5e") : "#2a2050"; g.fillRect(Math.round(W * (0.12 + k * 0.15)), Math.round(H * 0.08) + 2, 2, 2); }
  }
  // pontos do fundo em pixels da tela (de onde sai a fumaça do motor e a linha do cano de cima)
  function pontos() {
    const m = montar.motor;
    const e = ENG[3], p = ENG[e.liga];   // a engrenagem dourada (encaixada na grande de cima à direita)
    const engr = { x: (p.fx * W + Math.cos(e.ang) * (p.r + e.r + 1)) * ESC, y: (p.fy * H + Math.sin(e.ang) * (p.r + e.r + 1)) * ESC, r: e.r * ESC };
    return { motor: { x: (m.x + 41) * ESC, y: (m.y - 22) * ESC }, engrenagem: engr, cano: Math.round(H * 0.08 + 3) * ESC, canoDir: Math.round(W * 0.965 + 3) * ESC };
  }
  return { passo: passo, pane: pane, pontos: pontos };
})();
