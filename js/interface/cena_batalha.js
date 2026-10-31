"use strict";

// =========================
// CENA DA BATALHA (tela cheia, dentro de uma FÁBRICA): tudo desenhado em baixa resolução (sprites em 1:1) e
// ampliado por um fator inteiro, para os pixels ficarem todos do mesmo tamanho.
// Fundo: parede de tijolos, janelões, canos, lâmpadas penduradas com cone de luz, engrenagem na parede, passarela,
// chão de chapa com faixa de perigo e uma esteira andando. Os robôs (esquerda) e os monstros (entram andando pela
// direita) lutam sozinhos; o jogador lança as HABILIDADES (botões embaixo, com a recarga aparecendo).
// =========================
const CenaBatalha = (function() {
  const cena = el("cena"), cv = el("cvCena"), g = cv.getContext("2d");
  let W = 400, H = 225, ESC = 3, fundoFixo = null, aberta = false, tempo = 0, mostrouFim = false;
  const botoes = {};

  function medir() {
    const vw = window.innerWidth, vh = window.innerHeight, empe = vh > vw;
    ESC = Math.max(2, Math.floor(empe ? vw / 200 : Math.min(vw / 400, vh / 225)));
    W = Math.ceil(vw / ESC); H = Math.ceil(vh / ESC);
    cv.width = W; cv.height = H; cv.style.width = W * ESC + "px"; cv.style.height = H * ESC + "px";
    g.imageSmoothingEnabled = false;
    fundoFixo = montarFundo();
  }
  window.addEventListener("resize", function() { if (aberta) medir(); });
  function chao() { return Math.round(H * 0.8); }

  function montarFundo() {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const f = c.getContext("2d");
    const rt = function(x, y, w, h, cor) { f.fillStyle = cor; f.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const ch = chao();
    // parede de tijolos
    rt(0, 0, W, ch, "#2a1626");
    for (let y = 0; y < ch; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < W; x += 16) {
      rt(x, y, 15, 7, ((x * 7 + y * 3) % 5) ? "#3b1f2e" : "#432436"); rt(x, y, 15, 1, "#4d2a3e"); rt(x, y + 6, 15, 1, "#2a1420");
    }
    // janelões com luz azulada
    for (let k = 0; k < Math.ceil(W / 120); k++) {
      const x = 24 + k * 120, y = Math.round(H * 0.1), w = 60, h = Math.round(H * 0.28);
      rt(x - 3, y - 3, w + 6, h + 6, "#1a1030"); rt(x, y, w, h, "#20385c");
      for (let j = 0; j < h; j += 4) rt(x, y + j, w, 2, "#264470");
      rt(x + w / 2 - 1, y, 2, h, "#1a1030"); rt(x, y + h / 2 - 1, w, 2, "#1a1030");
      rt(x + 4, y + 4, 6, 2, "#5b86b8");
    }
    // cano grosso no alto e passarela
    rt(0, Math.round(H * 0.06), W, 6, "#4b5874"); rt(0, Math.round(H * 0.06), W, 2, "#6c7a99"); rt(0, Math.round(H * 0.06) + 5, W, 1, "#2a3247");
    for (let x = 30; x < W; x += 60) rt(x, Math.round(H * 0.06) - 1, 4, 8, "#5d6c8f");
    const py = Math.round(H * 0.5);
    rt(0, py, W, 4, "#3d3858"); rt(0, py, W, 1, "#5d5880");
    for (let x = 0; x < W; x += 12) rt(x, py - 10, 2, 10, "#3d3858");
    rt(0, py - 11, W, 2, "#5d5880");
    // chão: chapa com faixa de perigo e esteira
    rt(0, ch, W, H - ch, "#2b2a3d");
    for (let x = 0; x < W; x += 24) { rt(x, ch, 1, H - ch, "#22212f"); rt(x + 2, ch + 6, 1, 1, "#4a4960"); }
    for (let x = 0; x < W; x++) for (let y = ch; y < ch + 4; y++) rt(x, y, 1, 1, ((x + y) % 8) < 4 ? "#ffcc33" : "#241a10");
    rt(0, ch + 4, W, 1, "#151420");
    return c;
  }
  function desenharFundoVivo() {
    const ch = chao();
    g.drawImage(fundoFixo, 0, 0);
    // engrenagem na parede
    const per = Math.PI * 2 / 12, q = Math.floor(((tempo * 0.4) % per) / per * 6);
    const e = Pixel.engrenagem(28, 12, q, 6, "escuro"); g.drawImage(e, Math.round(W * 0.5 - e.width / 2), Math.round(H * 0.28 - e.height / 2));
    // lâmpadas penduradas com cone de luz (piscam de leve)
    for (let k = 0; k < 3; k++) {
      const x = Math.round(W * (0.2 + k * 0.3)), y = Math.round(H * 0.06) + 6, on = Math.sin(tempo * 3 + k * 2) > -0.9;
      g.fillStyle = "#1a1030"; g.fillRect(x, y, 1, 10); g.fillStyle = "#5d6c8f"; g.fillRect(x - 5, y + 10, 11, 4);
      g.fillStyle = on ? "#ffe9a3" : "#7a6a40"; g.fillRect(x - 3, y + 14, 7, 2);
      if (on) { g.globalAlpha = 0.07; g.fillStyle = "#ffe9a3"; g.beginPath(); g.moveTo(x - 4, y + 15); g.lineTo(x + 5, y + 15); g.lineTo(x + 40, ch); g.lineTo(x - 39, ch); g.fill(); g.globalAlpha = 1; }
    }
    // esteira andando embaixo
    const ey = ch + 12;
    g.fillStyle = "#1c1b28"; g.fillRect(0, ey, W, 8); g.fillStyle = "#3a3950";
    const off = Math.floor(tempo * 20) % 8; for (let x = -8 + off; x < W; x += 8) g.fillRect(x, ey + 2, 4, 4);
  }

  // posições. Deitado: robôs à esquerda e monstros à direita, em fileiras. Em pé: robôs no chão (embaixo) e
  // monstros na passarela (em cima), lutando na vertical
  function emPe() { return H > W * 1.1; }
  function posicoes(n, lado) {
    const ch = chao(), p = [];
    if (emPe()) {
      const porFila = Math.max(1, Math.floor((W - 8) / 49)), base = lado < 0 ? ch - 46 : Math.round(H * 0.5) - 46;
      for (let i = 0; i < n; i++) {
        const fila = Math.floor(i / porFila), col = i % porFila, naFila = Math.min(porFila, n - fila * porFila);
        const x0 = Math.round((W - naFila * 49) / 2);
        p.push({ x: x0 + col * 49, y: base - fila * 28 });
      }
      return p;
    }
    const porFila = Math.max(1, Math.min(6, Math.floor((W * 0.42) / 30)));
    for (let i = 0; i < n; i++) {
      const fila = Math.floor(i / porFila), col = i % porFila;
      const x = lado < 0 ? Math.round(W * 0.03 + col * 30 + fila * 10) : Math.round(W * 0.97 - 48 - col * 30 - fila * 10);
      p.push({ x: x, y: ch - 46 - fila * 22 });
    }
    return p;
  }

  function abrir() {
    aberta = true; mostrouFim = false; tempo = 0;
    cena.classList.remove("escondido");
    medir();
    el("cenaFim").classList.add("escondido");
    montarBotoes();
    Som.som("lutar");
    Som.musica("batalha");
  }
  function montarBotoes() {
    const caixa = el("cenaHab"); caixa.innerHTML = "";
    HABILIDADES.forEach(function(h) {
      const b = document.createElement("button"); b.className = "hab";
      b.appendChild(Paineis.icone(h.id));
      const nome = document.createElement("span"); nome.textContent = t("hab_" + h.id); b.appendChild(nome);
      const cd = document.createElement("i"); cd.className = "cd"; b.appendChild(cd);
      const seg = document.createElement("span"); seg.className = "seg"; b.appendChild(seg);
      b.addEventListener("pointerdown", function(e) {
        e.preventDefault();
        if (!Batalha.liberada(h)) { Paineis.faixa(null, t("hab_bloq", t("z_" + (h.libera - 1))), ""); Som.som("erro"); return; }
        if (Batalha.usar(h.id)) { Som.som("hab_" + h.id); vibrar(20); } else Som.som("erro");
      });
      caixa.appendChild(b);
      botoes[h.id] = { b: b, cd: cd, seg: seg };
    });
  }
  function atualizarBotoes() {
    const b = Batalha.atual; if (!b) return;
    HABILIDADES.forEach(function(h) {
      const x = botoes[h.id]; if (!x) return;
      const lib = Batalha.liberada(h), resta = b.cds[h.id] || 0, total = Batalha.cdDe(h);
      x.b.classList.toggle("bloq", !lib);
      x.b.classList.toggle("pronta", lib && resta <= 0 && !b.fim);
      x.cd.style.height = (lib ? resta / total * 100 : 100) + "%";
      x.seg.textContent = lib && resta > 0 ? Math.ceil(resta) : "";
    });
  }
  el("cenaSair").addEventListener("click", function() { Som.som("clique"); fechar(); });

  // ---------- desenho ----------
  function passo(dt) {
    if (!aberta) return;
    tempo += dt;
    const b = Batalha.atual;
    if (!b) { fechar(); return; }
    desenharFundoVivo();
    const pr = posicoes(b.robos.length, -1), pm = posicoes(b.monstros.length, 1), ch = chao();
    // sombras no chão
    g.fillStyle = "rgba(0,0,0,.35)";
    pr.concat(pm).forEach(function(p) { g.fillRect(p.x + 10, p.y + 44, 28, 3); });
    // robôs (de trás para frente: fileiras de trás primeiro)
    b.robos.map(function(r, i) { return { r: r, i: i }; }).sort(function(a, c) { return pr[a.i].y - pr[c.i].y; }).forEach(function(o) {
      const r = o.r, p = pr[o.i]; if (r.vida <= 0 && r.morto > 0.5) return;
      const pul = r.vida > 0 ? Math.floor((tempo * 2 + o.i * 0.37) % 2) : 0, ox = Math.round(r.golpe * 5);
      g.globalAlpha = r.vida <= 0 ? Math.max(0, 1 - r.morto * 2) : 1;
      g.drawImage(Pixel.robo(r.tier), p.x + ox, p.y - pul);
      if (b.sobrecarga > 0 && r.vida > 0 && Math.random() < 0.3) { g.fillStyle = "#ff5d73"; g.fillRect(p.x + 8 + Math.random() * 30, p.y + Math.random() * 40, 2, 2); }
      g.globalAlpha = 1;
      barra(p.x + 10, p.y - 4, 28, r.vida / r.max);
    });
    // monstros (entram andando da direita; atordoados tremem)
    b.monstros.map(function(m, i) { return { m: m, i: i }; }).sort(function(a, c) { return pm[a.i].y - pm[c.i].y; }).forEach(function(o) {
      const m = o.m, p = pm[o.i]; if (m.vida <= 0 && m.morto > 0.5) return;
      const s = Pixel.monstro(m.id), esc = m.chefe ? 2 : 1, w = 48 * esc, entra = Math.round((1 - m.entrou) * (W * 0.5));
      const treme = m.atordoado > 0 ? (Math.floor(tempo * 20) % 2 ? 1 : -1) : 0, ox = -Math.round(m.golpe * 5) + entra + treme;
      g.save(); g.globalAlpha = m.vida <= 0 ? Math.max(0, 1 - m.morto * 2) : 1;
      g.translate(p.x + ox + 48 - (esc - 1) * 30 + (esc > 1 ? w - 48 : 0), p.y - (esc - 1) * 48); g.scale(-esc, esc); g.drawImage(s, 0, 0); g.restore();
      g.globalAlpha = 1;
      if (m.atordoado > 0) { g.fillStyle = "#7cf0ff"; for (let k = 0; k < 3; k++) g.fillRect(p.x + ox + 14 + k * 8, p.y - 8 - (esc - 1) * 48 + Math.round(Math.sin(tempo * 10 + k) * 2), 3, 3); }
      barra(p.x + ox + 10 - (esc - 1) * 30, p.y - 4 - (esc - 1) * 48, 28 * esc, m.vida / m.max);
    });
    // tiros: raios de pixel
    b.tiros.forEach(function(tr) {
      const a = tr.de === "r" ? pr[tr.i] : pm[tr.i], d = tr.de === "r" ? pm[tr.para] : pr[tr.para];
      if (!a || !d) return;
      const k = tr.t / 0.3, x = a.x + 24 + (d.x - a.x) * k, y = a.y + 22 + (d.y - a.y) * k;
      g.fillStyle = tr.de === "r" ? "#7cf0ff" : "#ff6b6b"; g.fillRect(Math.round(x) - 3, Math.round(y) - 1, 6, 2);
      g.fillStyle = "#ffffff"; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    });
    // efeitos das habilidades
    b.fx.forEach(function(f) {
      if (f.tipo === "missil") {
        const d = pm[f.i]; if (!d) return;
        const k = f.t / 0.4, x0 = W * 0.2, y0 = ch - 80, x = x0 + (d.x + 20 - x0) * k, y = y0 + (d.y + 20 - y0) * k - Math.sin(k * Math.PI) * 40;
        g.drawImage(Pixel.icone("missil"), Math.round(x), Math.round(y));
        g.fillStyle = "#ffa53d"; g.fillRect(Math.round(x) - 3, Math.round(y) + 10, 3, 3);
      } else if (f.tipo === "explosao") {
        const d = pm[f.i]; if (!d) return;
        const r = 6 + f.t * 60, cx = d.x + 24, cy = d.y + 24;
        g.fillStyle = f.t < 0.15 ? "#ffffff" : "#ffcc33"; g.globalAlpha = 1 - f.t * 2;
        for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(an) * r) - 2, Math.round(cy + Math.sin(an) * r) - 2, 4, 4); }
        g.globalAlpha = 1;
      } else if (f.tipo === "choque") {
        g.fillStyle = "#7cf0ff"; g.globalAlpha = 1 - f.t * 2;
        pm.forEach(function(p) { let x = p.x + 24, y = 0; while (y < p.y + 20) { const nx = x + (Math.random() - 0.5) * 10; g.fillRect(Math.round(Math.min(x, nx)), y, Math.max(2, Math.round(Math.abs(nx - x))), 2); x = nx; y += 6; } });
        g.globalAlpha = f.t < 0.08 ? 0.35 : 0; g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      } else if (f.tipo === "conserto") {
        g.fillStyle = "#3ccf6e"; g.globalAlpha = 1 - f.t / 0.9;
        pr.forEach(function(p, i) { const y = p.y + 20 - f.t * 30 - (i % 3) * 4; g.fillRect(p.x + 20, y, 2, 6); g.fillRect(p.x + 18, y + 2, 6, 2); });
        g.globalAlpha = 1;
      } else if (f.tipo === "sobrecarga") {
        g.globalAlpha = 0.25 * (1 - f.t / 0.6); g.fillStyle = "#ff4d5e"; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      }
    });
    // números de dano
    g.textAlign = "center"; g.font = "8px Pixelify, monospace";
    b.numeros.forEach(function(n) {
      const p = pm[n.i]; if (!p) return;
      const y = Math.round(p.y - 8 - n.t * 20);
      g.globalAlpha = 1 - n.t / 0.8;
      g.fillStyle = "#1a1030"; g.fillText(fmt(n.v), p.x + 25, y + 1); g.fillStyle = n.grande ? "#ffcc33" : "#ffffff"; g.fillText(fmt(n.v), p.x + 24, y);
    });
    g.globalAlpha = 1;
    // topo e botões
    const h = HORDAS[b.z];
    escrever("cenaNome", t("z_" + h.id));
    escrever("cenaOnda", "  " + t("bat_onda", Math.min(b.onda + 1, h.ondas), h.ondas));
    atualizarBotoes();
    if (b.fim && !mostrouFim) { mostrouFim = true; resultado(b.fim); }
  }
  function barra(x, y, w, f) {
    if (f <= 0) return;
    g.fillStyle = "#1a1030"; g.fillRect(x - 1, y - 1, w + 2, 4);
    g.fillStyle = f > 0.35 ? "#3ccf6e" : "#ff4d5e"; g.fillRect(x, y, Math.max(1, Math.round(w * f)), 2);
  }
  const cache = {};
  function escrever(id, txt) { if (cache[id] !== txt) { cache[id] = txt; el(id).textContent = txt; } }

  function resultado(f) {
    const r = el("cenaFim");
    Som.som(f.venceu ? "vitoria" : "derrota");
    r.classList.remove("escondido");
    r.innerHTML = "<b style='font-size:30px;color:" + (f.venceu ? "var(--ouro)" : "var(--vermelho)") + "'>" + Paineis.esc(t(f.venceu ? "bat_vitoria" : "bat_derrota")) + "</b>" +
      (f.venceu ? "<span>+" + fmt(f.premio) + " " + Paineis.esc(t("moedas")) + "</span>" : "<span>" + Paineis.esc(t("bat_dica_derrota")) + "</span>");
    if (f.novos.length) { const m = Paineis.elem("div", "mini"); f.novos.forEach(function(d) { m.appendChild(Pixel.img(Pixel.monstro(d.id))); }); r.appendChild(m); }
    const l = Paineis.elem("div", "linhaBtns");
    const ok = Paineis.elem("button", "btn grande", Paineis.esc(t(f.venceu ? "pegar" : "voltar")));
    ok.addEventListener("click", function() { Som.som("clique"); fechar(true); });
    l.appendChild(ok);
    if (f.venceu && Poki.premiadoDisponivel()) {
      const x2 = Paineis.elem("button", "btn roxo grande", ""); x2.appendChild(Paineis.icone("video")); x2.appendChild(document.createTextNode(t("x2_anuncio")));
      x2.addEventListener("click", function() { Poki.premiado("small").then(function(v) { if (v) save.p.moedas += f.premio; salvar(); fechar(false); }); });
      l.appendChild(x2);
    }
    r.appendChild(l);
  }
  // sair: no meio da luta é desistir (sem prêmio); no fim volta com intervalo comercial
  function fechar(intervalo) {
    aberta = false;
    cena.classList.add("escondido");
    Som.musica("jogo");
    Batalha.sair();
    if (typeof BatalhaTela !== "undefined") BatalhaTela.voltou();
    if (intervalo) Poki.intervalo();
  }
  return { abrir: abrir, passo: passo, get aberta() { return aberta; } };
})();
