"use strict";

// =========================
// CENÁRIO QUE EVOLUI (v11), desenhado pelo fundo.js na mesma baixa resolução (1/4 da tela).
// 1) ESTÁGIO da fábrica = quantos upgrades PRINCIPAIS estão completos (nível 5): 0..7. Cada estágio muda as cores da
//    parede e acrescenta coisas, cada vez mais tecnológicas:
//    1 faixa de LED no chão · 2 telas com gráficos · 3 neon nos canos · 4 holograma · 5 núcleo de energia ·
//    6 janelão com estrelas e planeta · 7 drones e chão neon.
// 2) ENFEITES DOS UPGRADES NORMAIS (aparecem com nível >= 1), em volta do botão (é onde o fundo aparece):
//    esteira (esteira com caixas), linha (braço robótico), turbina (ventoinha), prensa (prensa batendo), canhoes
//    (canhões no cano), radar (antena girando), ima (guindaste com ímã), hidraulica (pistões), bancada (bancada),
//    cofrinho (porquinho na bancada), medico (armário de primeiros socorros), laboratorio (prateleira com frascos),
//    plantao (relógio).
// =========================
const Cenario = (function() {
  const PALETAS = [
    ["#171030", "#1a1236", "#181033", "#221a48", "#201844", "#100a24", "#3a2f6e"],
    ["#1a1434", "#1e173c", "#1b1538", "#2a2156", "#251d4e", "#120c28", "#5a4c9e"],
    ["#141a30", "#18203a", "#161d35", "#24305a", "#1f2950", "#0c1124", "#4a5c9a"],
    ["#131a2e", "#172038", "#151d33", "#263460", "#202c54", "#0b1022", "#5a74c0"],
    ["#0f1c26", "#122230", "#10202b", "#1c3644", "#18303c", "#08121a", "#3f7a8c"],
    ["#0d1a24", "#10202e", "#0e1d29", "#1a3848", "#16303e", "#071018", "#46a0b8"],
    ["#0b1024", "#0e142c", "#0c1228", "#18204a", "#141c40", "#060a18", "#3c4a8c"],
    ["#120a24", "#160c2c", "#140b28", "#2a1650", "#24144a", "#0a0518", "#7a4cff"]
  ];
  function estagio() {
    if (typeof UPGRADES === "undefined" || !save || !save.p) return 0;
    return UPGRADES.filter(function(u) { return u.principal && nivelUp(u.id) >= NIVEIS_UPGRADE; }).length;
  }
  function paleta(e) { return PALETAS[Math.min(PALETAS.length - 1, e)]; }

  // ---------- parte parada de cada estágio (vai no "fixo" do fundo) ----------
  function fixo(f, W, H, e) {
    const rt = function(x, y, w, h, c) { f.fillStyle = c; f.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const cy = Math.round(H * 0.08);
    if (e >= 3) {   // neon ciano correndo junto do cano de cima e no rodapé
      rt(0, cy + 8, W, 1, "#7cf0ff"); f.globalAlpha = 0.35; rt(0, cy + 9, W, 2, "#2a8fa8"); f.globalAlpha = 1;
      rt(0, H - 7, W, 1, "#7cf0ff");
    }
    if (e >= 6) {   // estrelas fixas pelo alto (o janelão é desenhado vivo)
      const r = semente(91);
      for (let k = 0; k < 40; k++) rt(Math.floor(r() * W), Math.floor(r() * H * 0.5), 1, 1, r() < 0.3 ? "#ffffff" : "#5a6aa8");
    }
    if (e >= 7) {   // chão em grade neon
      for (let x = 0; x < W; x += 12) rt(x, H - 12, 1, 12, "#3a2470");
      rt(0, H - 12, W, 1, "#b06bff");
    }
  }

  // ---------- parte viva (todo quadro, 30 fps) ----------
  // a: posição do botão em baixa resolução {l, r, t, b, cx, cy}
  function vivo(g, W, H, t, a, e) {
    const rt = function(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const cano = Math.round(H * 0.08), zc = a.zona.cima, zb = a.zona.baixo, nv = function(id) { return nivelUp(id); };
    // ---- estágios que ficam soltos na parede ----
    if (e >= 1) {   // faixa de LED no chão: luz correndo
      for (let x = 0; x < W; x += 4) { const on = Math.floor(x / 4 - t * 10) % 6 === 0; rt(x, H - 3, 2, 1, on ? "#7cf0ff" : "#1d3a4a"); }
    }
    if (e >= 6) {   // janelão com estrelas e planeta, no alto
      const jx = a.cx - 30, jy = cano + 12, jw = 60, jh = 16;
      rt(jx - 2, jy - 2, jw + 4, jh + 4, "#3d4a66"); rt(jx, jy, jw, jh, "#060a1e");
      for (let k = 0; k < 10; k++) rt(jx + (k * 13 + Math.floor(t * 2)) % jw, jy + (k * 7) % jh, 1, 1, k % 3 ? "#5a6aa8" : "#ffffff");
      g.fillStyle = "#b06bff"; g.beginPath(); g.arc(jx + jw - 12, jy + jh - 1, 8, Math.PI, 0); g.fill();
      rt(jx + jw - 21, jy + jh - 3, 18, 1, "#ffcc33"); rt(jx + jw / 2 - 1, jy, 2, jh, "#3d4a66");
    }
    if (e >= 7) {   // drones voando
      for (let k = 0; k < 3; k++) {
        const x = a.cx + Math.sin(t * 0.6 + k * 2.1) * (W * 0.3), y = cano + 28 + Math.sin(t * 1.3 + k) * 8 + k * 6;
        rt(x - 3, y, 7, 2, "#9aa3c0"); rt(x - 4, y - 1, 2, 1, "#c9d0e3"); rt(x + 3, y - 1, 2, 1, "#c9d0e3");
        rt(x, y + 2, 1, 1, Math.sin(t * 8 + k) > 0 ? "#ff4d5e" : "#3ccf6e");
      }
    }
    if (nv("overclock") > 0) {   // Overclock: faíscas correndo pelo cano de cima (mais com o nível)
      for (let k = 0; k < nv("overclock"); k++) { const x = ((t * 40 + k * 97) % (W + 10)) - 5; rt(x, cano + 2, 2, 1, "#fff6c2"); if (Math.random() < 0.3) rt(x + 2, cano + 1 + Math.round(Math.random() * 3), 1, 1, "#ffcc33"); }
    }
    // ---- esteira no rodapé (desenhada antes do resto: as máquinas ficam na frente) ----
    if (nv("esteira") > 0 && zb) {
      const ey = H - 16, vel = 10 + 4 * nv("esteira") + 10 * nv("esteira2"), presente = nv("caixa_premiada");
      rt(0, ey, W, 6, "#1c1b28"); rt(0, ey, W, 1, "#3a3950");
      for (let x = -8 + Math.floor(t * vel) % 8; x < W; x += 8) rt(x, ey + 2, 4, 2, nv("esteira2") ? "#4a6a9a" : "#3a3950");
      if (nv("esteira2")) rt(0, ey + 5, W, 1, "#7cf0ff");   // Esteira Turbo: luz azul na borda
      const n = 3 + Math.min(5, nv("esteira"));
      for (let k = 0; k < n; k++) {
        const x = ((k * (W + 20) / n + t * vel) % (W + 20)) - 10, ouro = presente && k % Math.max(2, 7 - presente) === 0;
        if (ouro) { rt(x, ey - 6, 7, 6, "#ffcc33"); rt(x + 3, ey - 6, 1, 6, "#ff4d5e"); rt(x, ey - 4, 7, 1, "#ff4d5e"); rt(x + 2, ey - 8, 3, 2, "#ff4d5e"); }
        else { rt(x, ey - 6, 7, 6, "#c98a4a"); rt(x, ey - 6, 7, 1, "#e6b47a"); rt(x + 3, ey - 6, 1, 6, "#8a5a2a"); }
      }
    }
    // ---- máquinas: prateleira de cima e chão do rodapé ----
    const cima = [], baixo = [];
    // [id, largura, nível (prioridade)] — estágios primeiro, depois os upgrades com nível maior
    if (e >= 2) cima.push(["tela", 16, 99]);
    if (e >= 4) cima.push(["holo", 12, 98]);
    if (e >= 5) baixo.push(["nucleo", 10, 99]);
    [["laboratorio", "lab", 16], ["turbina", "turbina", 16], ["prensa", "prensa", 14], ["canhoes", "canhao", 10], ["radar", "radar", 12],
     ["ima", "ima", 12], ["ritmo", "som", 12], ["mira", "alvo", 12], ["canhoes", "canhao2", 10]].forEach(function(d) { if (nv(d[0]) > 0) cima.push([d[1], d[2], nv(d[0]), d[0]]); });
    [["bancada", "bancada", 26], ["linha", "braco", 20], ["hidraulica", "pistoes", 14], ["medico", "medico", 13], ["plantao", "relogio", 13],
     ["reciclagem", "lixeira", 10], ["clonagem", "clone", 10], ["capacitor", "tesla", 10], ["producao", "pilha", 12], ["exercito", "bandeira", 9]].forEach(function(d) {
      if (nv(d[0]) > 0 || (d[0] === "bancada" && nv("cofrinho") > 0)) baixo.push([d[1], d[2], Math.max(nv(d[0]), nv("cofrinho")), d[0]]);
    });
    if (zc) viga(g, zc, rt);
    if (zb) piso(g, zb, rt);
    encaixar(cima, zc, baixo).forEach(function(p) { desenhar(g, p, t, cano, rt); });
    encaixar(baixo, zb, null).forEach(function(p) { desenhar(g, p, t, cano, rt); });
  }
  // cabe o que der na zona (prioridade: nível); o que sobra em cima tenta o rodapé
  function encaixar(lista, z, resto) {
    if (!lista.length) return [];
    if (!z) { if (resto) lista.forEach(function(x) { resto.push(x); }); return []; }
    const ord = lista.slice().sort(function(a, b) { return b[2] - a[2]; }), larg = z.r - z.l;
    let soma = 0; const cabe = [];
    ord.forEach(function(it) { if (soma + it[1] + 2 <= larg) { cabe.push(it); soma += it[1] + 2; } else if (resto && resto.indexOf(it) < 0) resto.push(it); });
    const fica = lista.filter(function(it) { return cabe.indexOf(it) >= 0; });   // volta à ordem fixa (cada coisa no seu canto)
    const folga = (larg - fica.reduce(function(s, x) { return s + x[1]; }, 0)) / (fica.length + 1);
    let x = z.l + folga;
    return fica.map(function(it) { const c = x + it[1] / 2; x += it[1] + folga; return { id: it[0], up: it[3], lv: it[2], x: Math.round(c), y: z.b }; });
  }
  // viga de aço (a prateleira de cima) e chapa do chão (rodapé)
  function viga(g, z, rt) {
    rt(z.l - 2, z.b, z.r - z.l + 4, 3, "#3d4a66"); rt(z.l - 2, z.b, z.r - z.l + 4, 1, "#7a88aa"); rt(z.l - 2, z.b + 3, z.r - z.l + 4, 1, "#1a1030");
    for (let x = z.l + 6; x < z.r; x += 26) { rt(x, z.b + 3, 2, 4, "#3d4a66"); rt(x - 2, z.b + 6, 6, 1, "#2b2550"); rt(x, z.b + 1, 1, 1, "#c9d0e3"); }
  }
  function piso(g, z, rt) { rt(z.l - 2, z.b, z.r - z.l + 4, 1, "#4a4960"); }
  // aparece com animação quando o upgrade é comprado (cai no lugar com poeira e o nome sobe)
  const apareceu = {}; let jaViu = false, ultimoAnuncio = 0;
  function desenhar(g, p, t, cano, rt) {
    const chave = p.id;
    if (!(chave in apareceu)) apareceu[chave] = jaViu ? t : -99;   // o que já existia ao abrir o jogo não anima
    const k = Math.min(1, (t - apareceu[chave]) / 0.6);
    if (k < 1) {
      const y0 = p.y - 30 * (1 - k) * (1 - k);
      g.save(); g.translate(0, Math.round(y0 - p.y)); desenharEnfeite(g, p.id, p.x, p.y, t, cano, rt, p.lv || 1); g.restore();
      if (k > 0.85) { g.fillStyle = "#c9b48a"; for (let i = 0; i < 6; i++) g.fillRect(Math.round(p.x - 8 + i * 3 + (k - 0.85) * 40 * (i < 3 ? -1 : 1)), p.y - 2, 2, 2); }
      if (k > 0.9 && p.up && !desenhar[chave] && performance.now() - ultimoAnuncio > 500) {   // um nome por vez
        desenhar[chave] = true; ultimoAnuncio = performance.now();
        const r = document.getElementById("fundo").getBoundingClientRect();
        Fx.numero(r.left + p.x * 4, r.top + (p.y - 16) * 4, window.t("up_" + p.up) + "!", "#7cf0ff", 22);
        Fx.faiscas(r.left + p.x * 4, r.top + p.y * 4, "#ffcc33", 10);
        if (typeof Som !== "undefined") Som.som("encaixe");
      }
      return;
    }
    desenharEnfeite(g, p.id, p.x, p.y, t, cano, rt, p.lv || 1);
  }
  // um enfeite com o pé (centro de baixo) em (x, y); lv = nível do upgrade (anima mais rápido/mais forte)
  function desenharEnfeite(g, id, x, y, t, cano, rt, lv) {
    const v = 0.6 + 0.25 * Math.min(lv, 10);   // velocidade pelo nível
    if (id === "tela") {   // monitor com gráfico andando
      const sx = x - 8, sy = y - 13;
      rt(sx - 1, sy - 1, 18, 12, "#3d4a66"); rt(sx, sy, 16, 10, "#06140e");
      for (let i = 0; i < 16; i++) rt(sx + i, sy + 5 + Math.round(Math.sin((i + t * 12) * 0.5) * 3), 1, 1, "#3ccf6e");
      rt(sx + 1, sy + 1, 3, 1, "#7cf0ff"); rt(x - 1, y - 3, 2, 3, "#3d4a66");
    } else if (id === "holo") {   // holograma de robô girando
      const larg = Math.round(Math.abs(Math.cos(t * 1.5)) * 6) + 2;
      rt(x - 5, y - 2, 10, 2, "#3d4a66"); rt(x - 3, y - 3, 6, 1, "#7cf0ff");
      g.globalAlpha = 0.45 + 0.15 * Math.sin(t * 9);
      rt(x - larg / 2, y - 16, larg, 6, "#7cf0ff"); rt(x - larg / 2 - 1, y - 10, larg + 2, 7, "#7cf0ff");
      for (let yy = y - 16; yy < y - 3; yy += 2) rt(x - larg / 2 - 1, yy, larg + 2, 1, "#0a2a3a");
      g.globalAlpha = 1;
    } else if (id === "nucleo") {   // núcleo de energia pulsando
      const p = 0.5 + 0.5 * Math.sin(t * 3), h = 22;
      rt(x - 5, y - h - 2, 10, h + 2, "#3d4a66"); rt(x - 4, y - h, 8, h - 1, "#0a1a2a");
      g.globalAlpha = 0.6 + 0.4 * p; rt(x - 2, y - h + 1, 4, h - 3, "#7cf0ff"); g.globalAlpha = 1;
      rt(x - 1, y - h + 1 + ((t * 30) % (h - 5)), 2, 3, "#ffffff");
    } else if (id === "lab") {   // prateleira com frascos borbulhando (mais bolhas com o nível)
      [["#3ccf6e", -7], ["#b06bff", -1], ["#7cf0ff", 5]].forEach(function(fr, k) { rt(x + fr[1], y - 7, 3, 7, "#c9d0e3"); rt(x + fr[1], y - 4, 3, 4, fr[0]); if (Math.sin(t * 2 * v + k * 2) > 0.5) rt(x + fr[1] + 1, y - 9 - (t * 6 + k) % 4, 1, 1, fr[0]); });
    } else if (id === "turbina") {   // ventoinha girando (mais rápida com o nível)
      const cy = y - 9, r = 7;
      rt(x - 1, cy, 3, 9, "#3d4a66");
      g.fillStyle = "#2b2550"; g.beginPath(); g.arc(x, cy, r + 2, 0, 7); g.fill();
      for (let k = 0; k < 4; k++) { const an = t * 6 * v + k * Math.PI / 2; linha(g, x, cy, x + Math.cos(an) * r, cy + Math.sin(an) * r, "#9aa3c0", 2); }
      rt(x - 1, cy - 1, 3, 3, "#ffcc33");
    } else if (id === "prensa") {   // prensa batendo numa chapa (mais rápida com o nível)
      const fase = Math.max(0, Math.sin(t * 2 * v)), desce = fase * 6;
      rt(x - 1, cano + 7, 3, Math.max(1, y - cano - 22 + desce), "#9aa3c0");
      rt(x - 6, y - 15 + desce, 13, 5, "#5d6c8f"); rt(x - 6, y - 15 + desce, 13, 1, "#c9d0e3");
      rt(x - 7, y - 3, 15, 3, "#2b2a3d"); rt(x - 4, y - 4, 9, 1, "#ffb02e");
      if (fase > 0.97) { rt(x - 9, y - 5, 2, 1, "#ffe066"); rt(x + 8, y - 5, 2, 1, "#ffe066"); }
    } else if (id === "canhao" || id === "canhao2") {   // canhão na prateleira (dispara de vez em quando)
      const lado = id === "canhao" ? -1 : 1;
      rt(x - 4, y - 4, 8, 4, "#3d4a66"); rt(x - 4, y - 4, 8, 1, "#5d6c8f"); linha(g, x, y - 4, x + lado * 6, y - 10, "#2b2a3d", 3);
      if (Math.sin(t * 1.3 * v + lado) > 0.985) { rt(x + lado * 8, y - 13, 3, 3, "#ffb02e"); rt(x + lado * 9, y - 12, 1, 1, "#fff6c2"); }
    } else if (id === "radar") {   // antena de radar girando
      const ab = Math.cos(t * 1.5 * v) * 5;
      rt(x - 1, y - 9, 2, 9, "#5d6c8f"); rt(x - 4, y - 2, 8, 2, "#3d4a66");
      g.fillStyle = "#c9d0e3"; g.beginPath(); g.ellipse(x, y - 11, Math.max(1, Math.abs(ab)), 3, 0, 0, 7); g.fill();
      if (Math.sin(t * 6) > 0.6) rt(x, y - 15, 1, 1, "#3ccf6e");
    } else if (id === "ima") {   // guindaste com ímã balançando, puxando uma moedinha
      const ix = x + Math.sin(t * 1.1) * 3, iy = y - 12;
      linha(g, x, cano + 7, ix, iy, "#5d6c8f", 1);
      rt(ix - 4, iy, 3, 6, "#ff4d5e"); rt(ix + 2, iy, 3, 6, "#ff4d5e"); rt(ix - 4, iy, 9, 3, "#ff4d5e"); rt(ix - 4, iy + 5, 3, 1, "#c9d0e3"); rt(ix + 2, iy + 5, 3, 1, "#c9d0e3");
      if (Math.sin(t * 2) > 0) rt(ix, iy + 8 + Math.round(Math.sin(t * 6)), 2, 2, "#ffcc33");
    } else if (id === "som") {   // Ritmo: caixas de som pulsando com a batida
      const pulso = Math.abs(Math.sin(t * Math.PI * 2 * 1.9)) > 0.8 ? 1 : 0;
      [-4, 4].forEach(function(dx) { rt(x + dx - 3, y - 11, 6, 11, "#2b2550"); rt(x + dx - 3, y - 11, 6, 1, "#463d82"); g.fillStyle = "#9aa3c0"; g.beginPath(); g.arc(x + dx, y - 4, 2 + pulso, 0, 7); g.fill(); rt(x + dx - 1, y - 9, 2, 2, "#9aa3c0"); });
      if (pulso) { rt(x - 8, y - 15, 1, 2, "#ff9df0"); rt(x + 8, y - 16, 1, 2, "#7cf0ff"); }
    } else if (id === "alvo") {   // Mira: alvo na parede com um dardo
      [[6, "#ff4d5e"], [4, "#e8ecf8"], [2, "#ff4d5e"]].forEach(function(c) { g.fillStyle = c[1]; g.beginPath(); g.arc(x, y - 7, c[0], 0, 7); g.fill(); });
      linha(g, x + 1, y - 8, x + 5, y - 12, "#ffcc33", 1);
    } else if (id === "bancada") {   // bancada com ferramentas (e o porquinho do Cofrinho)
      const by = y - 8;
      rt(x - 12, by, 24, 3, "#8a5a2a"); rt(x - 12, by, 24, 1, "#c98a4a"); rt(x - 10, by + 3, 2, 5, "#5a3a1a"); rt(x + 8, by + 3, 2, 5, "#5a3a1a");
      if (nivelUp("bancada") > 0) { rt(x - 9, by - 3, 6, 3, "#9aa3c0"); rt(x - 1, by - 2, 3, 2, "#ff4d5e"); }
      if (nivelUp("cofrinho") > 0) { rt(x + 3, by - 5, 7, 5, "#ff9ab0"); rt(x + 4, by - 6, 2, 1, "#ff9ab0"); rt(x + 5, by - 4, 1, 1, "#1a1030"); if (Math.sin(t * 1.2) > 0.9) rt(x + 6, by - 9 - Math.round((t * 8) % 3), 2, 2, "#ffcc33"); }
    } else if (id === "braco") {   // braço robótico batendo
      const ang = -1.2 + Math.sin(t * 1.8 * v) * 0.5, bx = x - 5, by = y - 5;
      rt(bx - 3, by, 10, 5, "#3d4a66"); rt(bx - 3, by, 10, 1, "#5d6c8f");
      const x1 = bx + 2 + Math.cos(ang) * 10, y1 = by + Math.sin(ang) * 10, x2 = x1 + Math.cos(ang + 1.3) * 8, y2 = y1 + Math.sin(ang + 1.3) * 8;
      linha(g, bx + 2, by, x1, y1, "#ffb02e", 2); linha(g, x1, y1, x2, y2, "#ffb02e", 2);
      rt(x1 - 1, y1 - 1, 3, 3, "#5d6c8f"); rt(x2 - 2, y2 - 1, 4, 2, "#c9d0e3");
    } else if (id === "pistoes") {   // pistões subindo e descendo
      for (let k = 0; k < 2; k++) { const px = x - 6 + k * 7, off = Math.round(Math.abs(Math.sin(t * 3 * v + k)) * 6); rt(px, y - 11, 5, 11, "#3d4a66"); rt(px + 1, y - 17 + off, 3, 8, "#c9d0e3"); }
    } else if (id === "medico") {   // armário de primeiros socorros
      rt(x - 6, y - 11, 12, 10, "#e8ecf8"); rt(x - 6, y - 11, 12, 1, "#ffffff"); rt(x - 1, y - 9, 2, 6, "#ff4d5e"); rt(x - 3, y - 7, 6, 2, "#ff4d5e");
    } else if (id === "relogio") {   // relógio (os ponteiros andam)
      const cy = y - 8;
      g.fillStyle = "#1a1030"; g.beginPath(); g.arc(x, cy, 6.5, 0, 7); g.fill(); g.fillStyle = "#e8ecf8"; g.beginPath(); g.arc(x, cy, 5.5, 0, 7); g.fill();
      linha(g, x, cy, x + Math.cos(t * 0.5 - 1.57) * 4, cy + Math.sin(t * 0.5 - 1.57) * 4, "#1a1030", 1);
      linha(g, x, cy, x + Math.cos(t * 0.04 - 1.57) * 3, cy + Math.sin(t * 0.04 - 1.57) * 3, "#ff4d5e", 1);
    } else if (id === "lixeira") {   // Reciclagem: lixeira verde com o símbolo
      rt(x - 4, y - 10, 9, 10, "#2f9e5a"); rt(x - 5, y - 11, 11, 2, "#3ccf6e"); rt(x - 1, y - 7, 3, 3, "#b8ffcf");
      if (Math.sin(t * 1.5) > 0.9) rt(x - 1, y - 14, 3, 2, "#9aa3c0");
    } else if (id === "clone") {   // Clonagem: tubo de vidro com robô brilhando
      rt(x - 4, y - 16, 9, 16, "#3d4a66"); rt(x - 3, y - 15, 7, 13, "#0f3a3a");
      g.globalAlpha = 0.6 + 0.3 * Math.sin(t * 4); rt(x - 1, y - 12, 3, 3, "#7cf0ff"); rt(x - 2, y - 9, 5, 5, "#7cf0ff"); g.globalAlpha = 1;
      rt(x - 2, y - 15 + ((t * 10) % 12), 1, 1, "#e6fdff");
    } else if (id === "tesla") {   // Capacitores: bobina de Tesla soltando raios
      rt(x - 2, y - 12, 4, 12, "#b0742a"); for (let yy = y - 11; yy < y; yy += 2) rt(x - 2, yy, 4, 1, "#ffcc33");
      g.fillStyle = "#9aa3c0"; g.beginPath(); g.arc(x, y - 14, 3, 0, 7); g.fill();
      if (Math.random() < 0.25 * v) { let px = x, py = y - 14; g.fillStyle = "#e6fdff"; for (let k = 0; k < 4; k++) { px += (Math.random() - 0.5) * 6; py -= 2; g.fillRect(Math.round(px), Math.round(py), 1, 1); } }
    } else if (id === "pilha") {   // Produção em Massa: pilha de caixas que cresce com o nível
      const n = Math.min(6, lv);
      for (let k = 0; k < n; k++) { const cx = x - 6 + (k % 2) * 6 - (k >= 4 ? -3 : 0), cy = y - 5 - Math.floor(k / 2) * 5; rt(cx, cy, 6, 5, "#c98a4a"); rt(cx, cy, 6, 1, "#e6b47a"); }
    } else if (id === "bandeira") {   // Exército Maior: bandeira tremulando
      rt(x - 3, y - 16, 1, 16, "#c9d0e3");
      for (let k = 0; k < 7; k++) rt(x - 2 + k, y - 15 + Math.round(Math.sin(t * 4 + k * 0.7)), 1, 5, k % 2 ? "#ff4d5e" : "#ffcc33");
    }
  }
  function linha(g, x1, y1, x2, y2, cor, esp) {
    g.fillStyle = cor;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x1 + (x2 - x1) * i / n), Math.round(y1 + (y2 - y1) * i / n), esp, esp);
  }
  return { estagio: estagio, paleta: paleta, fixo: fixo, vivo: function() { vivo.apply(null, arguments); jaViu = true; } };
})();
