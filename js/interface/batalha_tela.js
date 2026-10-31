"use strict";

// =========================
// ABA BATALHA: lista das hordas -> escolher até 10 robôs (ou "Melhores") -> arena (pixel art, a luta acontece
// sozinha) -> resultado (moedas; na 1ª vitória os monstros entram no compêndio). Ao voltar: intervalo comercial.
// =========================
const BatalhaTela = (function() {
  let modo = "lista", horda = 0, marcados = [], caixa = null, cv = null, g = null;
  const E = function() { return Paineis.elem.apply(null, arguments); }, esc = function(s) { return Paineis.esc(s); };

  function montar(c) {
    caixa = c;
    c.innerHTML = "";
    if (modo === "lista") lista();
    else if (modo === "escolha") escolha();
    else arena();
  }
  function remontar() { if (Paineis.aba === "batalha" && caixa) montar(caixa); }

  // ---------- lista ----------
  function lista() {
    caixa.appendChild(E("p", "titulo2", esc(t("bat_explica"))));
    HORDAS.forEach(function(h) {
      const aberta = Batalha.hordaAberta(h.id), vencida = h.id < save.hordasVencidas;
      const c = E("div", "card horda" + (aberta ? "" : " fechada"));
      const mini = E("div", "mini");
      h.monstros.forEach(function(m) { const vis = save.monstrosVistos.indexOf(m.id) >= 0; mini.appendChild(Pixel.img(vis ? Pixel.monstro(m.id) : Pixel.sombra(Pixel.monstro(m.id)))); });
      c.appendChild(mini);
      const info = E("div", "info", "<b>" + esc(t("z_" + h.id)) + (vencida ? " ✓" : "") + "</b><span>" +
        esc(aberta ? t("bat_premio", fmt(Math.round(h.premio * (1 + 0.5 * nivelNo("saque")) * Jogo.multMoedas()))) : t("bat_bloq", t("z_" + (h.id - 1)))) + "</span>");
      c.appendChild(info);
      if (aberta) {
        const b = E("button", "btn", esc(t("bat_ir")));
        c.appendChild(b);
        c.addEventListener("click", function() { horda = h.id; marcados = melhores(); modo = "escolha"; Som.som("clique"); remontar(); });
      } else c.appendChild(Paineis.icone("cadeado"));
      caixa.appendChild(c);
    });
  }

  // ---------- escolha ----------
  function todos() {   // robôs da grade e do time, do maior para o menor
    const l = [];
    ["time", "grade"].forEach(function(lista) { save.p[lista].forEach(function(n, i) { if (n) l.push({ lista: lista, i: i, n: n }); }); });
    return l.sort(function(a, b) { return b.n - a.n; });
  }
  function chave(r) { return r.lista + r.i; }
  function melhores() { return todos().slice(0, Batalha.vagas()).map(chave); }
  function escolha() {
    const l = todos(), vagas = Batalha.vagas();
    marcados = marcados.filter(function(k) { return l.some(function(r) { return chave(r) === k; }); });
    const sel = l.filter(function(r) { return marcados.indexOf(chave(r)) >= 0; }).map(function(r) { return r.n; });
    const pr = Batalha.poderRobos(sel), ph = Batalha.poderHorda(horda), forte = pr >= ph;
    caixa.appendChild(E("p", "", "<b>" + esc(t("z_" + horda)) + "</b> · " + esc(t("bat_escolha", marcados.length, vagas))));
    caixa.appendChild(E("p", "titulo2", "<span style='color:" + (forte ? "var(--verde)" : "var(--vermelho)") + "'>" + esc(t("bat_poder", fmt(pr), fmt(ph))) + "</span>"));
    const bts = E("div", "linhaBtns");
    const bm = E("button", "btn sem", esc(t("bat_melhores")));
    bm.addEventListener("click", function() { marcados = melhores(); Som.som("clique"); remontar(); });
    const bl = E("button", "btn grande" + (marcados.length ? "" : " sem"), esc(t("bat_lutar")));
    bl.addEventListener("click", function() { if (!marcados.length) return; lutar(sel); });
    const bv = E("button", "btn sem", esc(t("voltar")));
    bv.addEventListener("click", function() { modo = "lista"; Som.som("clique"); remontar(); });
    bts.appendChild(bv); bts.appendChild(bm); bts.appendChild(bl);
    caixa.appendChild(bts);
    if (!l.length) { caixa.appendChild(E("p", "titulo2", esc(t("bat_sem_robos")))); return; }
    const gal = E("div", "galeria");
    l.forEach(function(r) {
      const k = chave(r), it = E("div", "item" + (marcados.indexOf(k) >= 0 ? " marcado" : ""));
      it.appendChild(Pixel.img(Pixel.robo(r.n)));
      it.appendChild(E("small", "", esc(t("nivel", r.n))));
      it.addEventListener("click", function() {
        const j = marcados.indexOf(k);
        if (j >= 0) marcados.splice(j, 1); else if (marcados.length < vagas) marcados.push(k);
        Som.som("clique"); remontar();
      });
      gal.appendChild(it);
    });
    caixa.appendChild(gal);
  }

  // ---------- arena ----------
  function lutar(tiers) {
    Batalha.iniciar(horda, tiers);
    modo = "luta";
    Som.som("lutar");
    remontar();
  }
  function arena() {
    cv = document.createElement("canvas"); cv.id = "arena";
    caixa.appendChild(cv);
    g = cv.getContext("2d");
    const r = E("div", "", ""); r.id = "batResultado"; caixa.appendChild(r);
  }
  function posicoes(n, lado, w, h, tam) {
    // até 6 por coluna; robôs na esquerda, monstros na direita
    const p = [], porCol = Math.min(n, 5);
    for (let i = 0; i < n; i++) {
      const col = Math.floor(i / porCol), lin = i % porCol;
      const x = lado < 0 ? w * 0.08 + col * tam * 1.05 : w * 0.92 - tam - col * tam * 1.05;
      const y = h * 0.12 + lin * (h * 0.78 / porCol);
      p.push({ x: x, y: y });
    }
    return p;
  }
  function desenhar() {
    const b = Batalha.atual;
    if (!cv || !b || !cv.isConnected) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const w = r.width, h = r.height;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = "#241a4a"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#2c2158"; for (let x = 0; x < w; x += 32) for (let y = (x / 32) % 2 * 16; y < h; y += 32) g.fillRect(x, y, 16, 16);
    const tam = Math.max(28, Math.min(h / 6, w / 9));
    const pr = posicoes(b.robos.length, -1, w, h, tam), pm = posicoes(b.monstros.length, 1, w, h, tam);
    function sprite(img, p, x, alvoVivo, golpe, dir, morto, grande) {
      if (morto > 0.5) return;
      const s = tam * (grande ? 1.5 : 1), ox = golpe * 10 * dir;
      g.globalAlpha = morto > 0 ? 1 - morto * 2 : 1;
      g.drawImage(img, Math.round(p.x + ox - (grande ? tam * 0.25 : 0)), Math.round(p.y - (grande ? tam * 0.25 : 0)), s, s);
      g.globalAlpha = 1;
    }
    function barra(p, x, max, grande) {
      if (x <= 0) return;
      const s = tam * (grande ? 1.5 : 1), y = p.y - 8 - (grande ? tam * 0.25 : 0), bx = p.x - (grande ? tam * 0.25 : 0);
      g.fillStyle = "#120b26"; g.fillRect(bx, y, s, 6);
      g.fillStyle = x / max > 0.35 ? "#3ccf6e" : "#ff4d5e"; g.fillRect(bx + 1, y + 1, (s - 2) * Math.max(0, x / max), 4);
    }
    b.robos.forEach(function(x, i) { sprite(Pixel.robo(x.tier), pr[i], 0, true, x.golpe, 1, x.vida <= 0 ? x.morto : 0, false); barra(pr[i], x.vida, x.max, false); });
    b.monstros.forEach(function(x, i) {
      // monstros olham para a esquerda (espelhados)
      if (x.vida <= 0 && x.morto > 0.5) return;
      const s = tam * (x.chefe ? 1.5 : 1), p = pm[i], ox = -x.golpe * 10;
      g.save(); g.globalAlpha = x.vida <= 0 ? Math.max(0, 1 - x.morto * 2) : 1;
      g.translate(Math.round(p.x + ox + s - (x.chefe ? tam * 0.25 : 0)), Math.round(p.y - (x.chefe ? tam * 0.25 : 0))); g.scale(-1, 1);
      g.drawImage(Pixel.monstro(x.id), 0, 0, s, s); g.restore();
      barra(p, x.vida, x.max, x.chefe);
    });
    // tiros (risco de pixel)
    b.tiros.forEach(function(tr) {
      const a = tr.de === "r" ? pr[tr.i] : pm[tr.i], d = tr.de === "r" ? pm[tr.para] : pr[tr.para];
      if (!a || !d) return;
      const k = tr.t / 0.3, x = a.x + tam / 2 + (d.x - a.x) * k, y = a.y + tam / 2 + (d.y - a.y) * k;
      g.fillStyle = tr.de === "r" ? "#7cf0ff" : "#ff6b6b"; g.fillRect(Math.round(x) - 4, Math.round(y) - 2, 8, 4);
    });
    g.textAlign = "center"; g.font = "18px Pixelify, sans-serif"; g.lineWidth = 4; g.strokeStyle = "#120b26";
    b.numeros.forEach(function(n) { const p = pm[n.i]; if (!p) return; g.globalAlpha = 1 - n.t / 0.8; g.strokeText(fmt(n.v), p.x + tam / 2, p.y - 12 - n.t * 30); g.fillStyle = "#fff"; g.fillText(fmt(n.v), p.x + tam / 2, p.y - 12 - n.t * 30); });
    g.globalAlpha = 1;
    g.font = "22px Pixelify, sans-serif"; g.fillStyle = "#ffcc33";
    const txt = t("bat_onda", Math.min(b.onda + 1, HORDAS[b.z].ondas), HORDAS[b.z].ondas);
    g.strokeText(txt, w / 2, 26); g.fillText(txt, w / 2, 26);
  }
  let mostrouFim = false;
  function passo() {
    const b = Batalha.atual;
    if (!b || modo !== "luta") return;
    desenhar();
    if (b.fim && !mostrouFim) { mostrouFim = true; resultado(b.fim); }
  }
  function resultado(f) {
    const r = el("batResultado"); if (!r) return;
    Som.som(f.venceu ? "vitoria" : "derrota");
    r.className = "card"; r.style.flexDirection = "column";
    r.innerHTML = "<b style='font-size:26px;color:" + (f.venceu ? "var(--ouro)" : "var(--vermelho)") + "'>" + esc(t(f.venceu ? "bat_vitoria" : "bat_derrota")) + "</b>" +
      (f.venceu ? "<span>+" + fmt(f.premio) + " " + esc(t("moedas")) + "</span>" : "<span>" + esc(t("bat_dica_derrota")) + "</span>");
    if (f.novos.length) { const m = E("div", "mini"); f.novos.forEach(function(d) { m.appendChild(Pixel.img(Pixel.monstro(d.id))); }); r.appendChild(m); }
    const l = E("div", "linhaBtns");
    const voltar = E("button", "btn grande", esc(t(f.venceu ? "pegar" : "voltar")));
    voltar.addEventListener("click", function() { sairComIntervalo(); });
    l.appendChild(voltar);
    if (f.venceu && Poki.premiadoDisponivel()) {
      const x2 = E("button", "btn roxo grande", ""); x2.appendChild(Paineis.icone("video")); x2.appendChild(document.createTextNode(t("x2_anuncio")));
      x2.addEventListener("click", function() { Poki.premiado("small").then(function(ok) { if (ok) save.p.moedas += f.premio; salvar(); sairSemIntervalo(); }); });
      l.appendChild(x2);
    }
    r.appendChild(l);
  }
  function sairSemIntervalo() { Batalha.sair(); mostrouFim = false; modo = "lista"; remontar(); }
  function sairComIntervalo() { Batalha.sair(); mostrouFim = false; modo = "lista"; Poki.intervalo().then(remontar); }
  function sair() { if (modo === "luta" && Batalha.atual && !Batalha.atual.fim) return; Batalha.sair(); mostrouFim = false; modo = "lista"; }

  return { montar: montar, passo: passo, sair: sair, escolhendo: function() { return modo === "escolha"; } };
})();
