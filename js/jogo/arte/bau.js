"use strict";

// =========================
// ARTE DO BAÚ (tela de recompensa e recompensa diária)
// ArteBau.desenhar(ctx, cx, cy, escala, tipo, abre, t, sacode)
//   tipo: "normal" (madeira + metal azul), "nivel" (roxo + ouro), "lendario" (ouro + pedras)
//   abre: 0 = fechado .. 1 = tampa toda aberta (com raios de luz)   sacode: 0..1 (tremendo antes de abrir)
// ArteBau.luz(ctx, cx, cy, raio, tipo, t, abre): brilho redondo atrás do baú (pulsa fechado, acende quando abre)
// ArteBau.moedas(ctx, cx, cy, escala, dt): moedas pulando do baú aberto (dt = segundos desde que abriu)
// Estilo igual ao resto da arte: cel-shading (base + sombra + luz), contorno na cor escura do material, sem preto.
// Só aparece em menus, então pode desenhar com caminhos a cada quadro.
// =========================

const ArteBau = (function() {
  const CORES = {
    normal:   { corpo: "#b9773e", sombra: "#8a5228", luz: "#dc9a5c", borda: "#5c3418", metal: "#7fa6c9", metalS: "#4f7396", metalL: "#c4dcf0", brilho: "#ffe8a3" },
    nivel:    { corpo: "#7b5cd6", sombra: "#563cab", luz: "#a088ec", borda: "#33216f", metal: "#f2c33b", metalS: "#c4901a", metalL: "#ffe68a", brilho: "#fff1b8" },
    lendario: { corpo: "#f2b51e", sombra: "#c2850e", luz: "#ffd866", borda: "#7a4e05", metal: "#fff1c4", metalS: "#d9b45b", metalL: "#ffffff", brilho: "#fffbe0" }
  };

  function retR(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // raios de luz girando atrás do baú aberto
  function raios(g, cx, cy, raio, cor, t, forca) {
    g.save();
    g.globalAlpha = 0.35 * forca;
    g.fillStyle = cor;
    g.translate(cx, cy);
    g.rotate(t * 0.4);
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(raio, -raio * 0.12); g.lineTo(raio, raio * 0.12); g.closePath(); g.fill();
    }
    g.restore();
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, raio * 0.7);
    gr.addColorStop(0, "rgba(255,248,214," + (0.85 * forca) + ")");
    gr.addColorStop(1, "rgba(255,248,214,0)");
    g.fillStyle = gr;
    g.beginPath(); g.arc(cx, cy, raio * 0.7, 0, Math.PI * 2); g.fill();
  }

  function brilhos(g, cx, cy, s, t, cor, forca) {
    g.save();
    g.fillStyle = cor;
    for (let i = 0; i < 9; i++) {
      const a = i * 2.3 + t * 0.7, d = (60 + (i * 37) % 70) * s;
      const x = cx + Math.cos(a) * d, y = cy - 30 * s + Math.sin(a) * d * 0.6;
      const k = (0.5 + 0.5 * Math.sin(t * 4 + i)) * forca * 7 * s;
      g.globalAlpha = forca;
      g.beginPath();
      g.moveTo(x, y - k); g.lineTo(x + k * 0.3, y - k * 0.3); g.lineTo(x + k, y); g.lineTo(x + k * 0.3, y + k * 0.3);
      g.lineTo(x, y + k); g.lineTo(x - k * 0.3, y + k * 0.3); g.lineTo(x - k, y); g.lineTo(x - k * 0.3, y - k * 0.3);
      g.closePath(); g.fill();
    }
    g.restore();
  }

  // faixa de metal vertical (ferragem)
  function ferragem(g, x, y, w, h, c) {
    g.fillStyle = c.metal; g.fillRect(x, y, w, h);
    g.fillStyle = c.metalS; g.fillRect(x + w * 0.62, y, w * 0.38, h);
    g.fillStyle = c.metalL; g.fillRect(x + w * 0.12, y, w * 0.18, h);
  }

  function desenhar(g, cx, cy, s, tipo, abre, t, sacode) {
    const c = CORES[tipo] || CORES.normal;
    abre = Math.max(0, Math.min(1, abre || 0));
    g.save();
    // tremida antes de abrir
    if (sacode) g.translate(Math.sin(t * 60) * 4 * sacode * s, Math.cos(t * 47) * 2 * sacode * s);
    if (abre > 0) raios(g, cx, cy - 40 * s, 190 * s, c.brilho, t, Math.min(1, abre * 1.6));

    const W = 170 * s, H = 92 * s, x = cx - W / 2, yBase = cy - H / 2 + 22 * s;
    // sombra no chão
    g.fillStyle = "rgba(10,6,30,0.35)";
    g.beginPath(); g.ellipse(cx, yBase + H + 6 * s, W * 0.55, 12 * s, 0, 0, Math.PI * 2); g.fill();

    // ---- caixa de baixo ----
    retR(g, x, yBase, W, H, 12 * s);
    g.fillStyle = c.borda; g.fill();
    retR(g, x + 4 * s, yBase + 4 * s, W - 8 * s, H - 8 * s, 9 * s);
    g.fillStyle = c.corpo; g.fill();
    g.save(); g.clip();
    g.fillStyle = c.sombra; g.fillRect(x, yBase + H * 0.62, W, H);           // sombra embaixo
    g.fillStyle = c.luz; g.fillRect(x, yBase, W, 10 * s);                     // luz em cima
    // tábuas
    g.fillStyle = c.sombra;
    for (let i = 1; i < 3; i++) g.fillRect(x, yBase + H * i / 3 - 1.5 * s, W, 3 * s);
    g.restore();
    ferragem(g, x + 14 * s, yBase + 4 * s, 18 * s, H - 8 * s, c);
    ferragem(g, x + W - 32 * s, yBase + 4 * s, 18 * s, H - 8 * s, c);

    // ---- interior aceso (aparece quando abre) ----
    if (abre > 0) {
      g.save();
      g.globalAlpha = Math.min(1, abre * 2);
      g.fillStyle = c.brilho;
      retR(g, x + 10 * s, yBase - 8 * s, W - 20 * s, 18 * s, 8 * s); g.fill();
      g.restore();
    }

    // ---- tampa (gira para trás pela dobradiça) ----
    const hTampa = 58 * s;
    g.save();
    g.translate(cx, yBase + 2 * s);
    const ang = -abre * 1.9;
    g.scale(1, Math.cos(ang * 0.9) * 0.75 + 0.25 * (1 - abre));
    g.translate(0, -abre * 26 * s);
    const tx = -W / 2 - 4 * s, ty = -hTampa;
    g.beginPath();
    g.moveTo(tx, 0); g.lineTo(tx, ty + 22 * s);
    g.quadraticCurveTo(tx, ty, tx + 26 * s, ty);
    g.lineTo(-tx - 26 * s, ty); g.quadraticCurveTo(-tx, ty, -tx, ty + 22 * s);
    g.lineTo(-tx, 0); g.closePath();
    g.fillStyle = c.borda; g.fill();
    g.save(); g.clip();
    g.fillStyle = c.corpo; g.fillRect(tx + 4 * s, ty + 4 * s, W, hTampa);
    g.fillStyle = c.luz; g.fillRect(tx + 4 * s, ty + 4 * s, W, 16 * s);
    g.fillStyle = c.sombra; g.fillRect(tx, -12 * s, W + 8 * s, 12 * s);
    g.restore();
    ferragem(g, tx + 18 * s, ty + 2 * s, 18 * s, hTampa - 4 * s, c);
    ferragem(g, -tx - 36 * s, ty + 2 * s, 18 * s, hTampa - 4 * s, c);
    g.restore();

    // ---- fechadura ----
    if (abre < 0.5) {
      const fy = yBase + 6 * s;
      g.globalAlpha = 1 - abre * 2;
      retR(g, cx - 16 * s, fy - 14 * s, 32 * s, 34 * s, 8 * s); g.fillStyle = c.metalS; g.fill();
      retR(g, cx - 13 * s, fy - 11 * s, 26 * s, 28 * s, 6 * s); g.fillStyle = c.metal; g.fill();
      g.fillStyle = c.borda;
      g.beginPath(); g.arc(cx, fy + 1 * s, 4.5 * s, 0, Math.PI * 2); g.fill();
      g.fillRect(cx - 2 * s, fy + 2 * s, 4 * s, 9 * s);
      g.globalAlpha = 1;
    }
    // pedras do lendário
    if (tipo === "lendario") {
      [["#4dabf7", -52], ["#ff6b6b", 0], ["#51cf66", 52]].forEach(function(p) {
        if (p[1] === 0 && abre < 0.5) return;
        g.fillStyle = p[0];
        g.beginPath(); g.arc(cx + p[1] * s, yBase + H * 0.62, 7 * s, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(255,255,255,0.7)";
        g.beginPath(); g.arc(cx + p[1] * s - 2 * s, yBase + H * 0.62 - 2 * s, 2.4 * s, 0, Math.PI * 2); g.fill();
      });
    }
    if (abre > 0.2 || tipo !== "normal") brilhos(g, cx, cy, s, t, c.brilho, abre > 0.2 ? Math.min(1, abre * 1.5) : 0.5);
    g.restore();
  }

  // brilho redondo atrás do baú (v17.5): da cor do baú; pulsa fechado e acende quando abre
  const LUZ = { normal: "255,214,140", nivel: "190,150,255", lendario: "255,220,90" };
  function luz(g, cx, cy, raio, tipo, t, abre) {
    const c = LUZ[tipo] || LUZ.normal;
    const forca = 0.32 + 0.08 * Math.sin(t * 3) + 0.35 * Math.max(0, Math.min(1, abre || 0));
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, raio);
    gr.addColorStop(0, "rgba(" + c + "," + forca.toFixed(3) + ")");
    gr.addColorStop(0.55, "rgba(" + c + "," + (forca * 0.35).toFixed(3) + ")");
    gr.addColorStop(1, "rgba(" + c + ",0)");
    g.fillStyle = gr;
    g.beginPath(); g.arc(cx, cy, raio, 0, Math.PI * 2); g.fill();
  }

  // moedas pulando do baú aberto (v17.5): saem em leque, giram, caem e somem em ~1,6 s (sem estado guardado)
  function moedas(g, cx, cy, s, dt) {
    if (dt <= 0 || dt > 1.7) return;
    const some = Math.max(0, Math.min(1, (1.7 - dt) / 0.6));
    for (let k = 0; k < 12; k++) {
      const a = -Math.PI / 2 + (k / 11 - 0.5) * 2.4, v = (230 + (k * 53) % 110) * s;
      const x = cx + Math.cos(a) * v * dt * 0.9, y = cy + Math.sin(a) * v * dt + 620 * s * dt * dt;
      const r = (9 + (k % 3) * 2) * s, gira = Math.abs(Math.cos(dt * 9 + k));
      g.save();
      g.globalAlpha = some;
      g.translate(x, y); g.scale(Math.max(0.15, gira), 1);
      g.fillStyle = "#c2850e"; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffd43b"; g.beginPath(); g.arc(0, -r * 0.08, r * 0.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.arc(-r * 0.3, -r * 0.35, r * 0.25, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }

  return { desenhar: desenhar, luz: luz, moedas: moedas };
})();
