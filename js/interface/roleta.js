"use strict";

// =========================
// ROLETA (v12, gacha). Botão redondo no canto da tela do botão: 1 giro GRÁTIS a cada 10 min (conta também com o
// jogo fechado; o primeiro é na hora). Assistindo um anúncio premiado giram 3 ROLETAS DE UMA VEZ (espera 3 min
// entre um anúncio e outro). 8 gomos do mesmo tamanho na tela, mas cada prêmio tem a sua chance (PESO).
// Prêmios crescem com a sua renda: moedas (4 min / 15 min de renda), turbo, robô de presente, pontos de
// habilidade, peça de equipamento e o JACKPOT (1 h de renda + peça boa).
// =========================
const ROLETA_PREMIOS = [
  { id: "moedas", peso: 26, cor: "#ffcc33", ico: "moeda" },
  { id: "turbo", peso: 16, cor: "#ff8a2e", ico: "raio" },
  { id: "robo", peso: 14, cor: "#4da3ff", ico: "fabrica" },
  { id: "ph", peso: 12, cor: "#3fd6e8", ico: "ph" },
  { id: "peca", peso: 12, cor: "#b06bff", ico: "presente" },
  { id: "moedas2", peso: 10, cor: "#3ccf6e", ico: "cofre" },
  { id: "ph2", peso: 6, cor: "#ff6bd0", ico: "ph" },
  { id: "jackpot", peso: 4, cor: "#ff4d5e", ico: "trofeu" }
];
const Roleta = (function() {
  const GRATIS_MS = 10 * 60 * 1000, ANUNCIO_MS = 3 * 60 * 1000, GOMO = Math.PI * 2 / ROLETA_PREMIOS.length, TAM = 96;
  let btn = null, rodas = [], girando = false, aberta = false, ultimoTxt = "", ui = null, relogio = 0;

  function dados() {
    if (!save.roleta || typeof save.roleta.gratis !== "number") save.roleta = { gratis: 0, anuncio: 0, giros: 0 };
    return save.roleta;
  }
  function liberado() { return save.tutorial >= 4; }
  function gratisPronto() { return Date.now() >= dados().gratis; }
  function anuncioPronto() { return Date.now() >= dados().anuncio; }

  // ---------- sorteio e prêmios ----------
  function sortear() {
    let r = Math.random() * ROLETA_PREMIOS.reduce(function(a, p) { return a + p.peso; }, 0);
    for (let k = 0; k < ROLETA_PREMIOS.length; k++) { r -= ROLETA_PREMIOS[k].peso; if (r < 0) return k; }
    return 0;
  }
  function renda(seg, minCriar) { return Math.round(Math.max(Jogo.custoCriar() * minCriar, Jogo.prodTime() * seg + Jogo.valorToque() * seg / 6)); }
  // aplica o prêmio e devolve o texto curto para a lista de resultados
  function dar(k, x, y) {
    const p = ROLETA_PREMIOS[k];
    switch (p.id) {
      case "moedas": case "moedas2": case "jackpot": {
        const v = p.id === "moedas" ? renda(240, 3) : p.id === "moedas2" ? renda(900, 8) : renda(3600, 20);
        save.p.moedas += v; Fx.moedas(x, y, p.id === "jackpot" ? 30 : 12); Fx.numero(x, y - 20, "+" + fmt(v), "#ffcc33", 34);
        if (p.id === "jackpot") { const it = Equip.ganhar(0.85); return t("rl_jackpot", fmt(v)) + " + " + Equip.nome(it); }
        return "+" + fmt(v);
      }
      case "turbo": { const s = 45; Jogo.ligarTurbo(Jogo.turboRestante() + s); return t("rl_turbo", s); }
      case "robo": {
        const tier = Math.max(1, save.p.maxTier - 1);
        if (Jogo.presente(tier)) return t("rl_robo", tier);
        const v = renda(300, 4); save.p.moedas += v; return t("rl_cheia", fmt(v));   // grade cheia: vira moedas
      }
      case "ph": case "ph2": { const n = p.id === "ph" ? 2 : 6; save.ph += n; Fx.numero(x, y - 20, "+" + n + " PH", "#7cf0ff", 30); return t("rl_ph", n); }
      case "peca": { const it = Equip.ganhar(0.35); return Equip.nome(it); }
    }
    return "";
  }

  // ---------- desenho da roda (pixel: desenha pequeno e amplia sem suavizar) ----------
  let base = null;
  function fazerBase() {
    const c = document.createElement("canvas"); c.width = c.height = TAM;
    const g = c.getContext("2d"), m = TAM / 2, R = m - 4;
    g.fillStyle = "#1a1030"; g.beginPath(); g.arc(m, m, R + 3, 0, Math.PI * 2); g.fill();
    ROLETA_PREMIOS.forEach(function(p, k) {
      const a0 = -Math.PI / 2 + k * GOMO, a1 = a0 + GOMO;
      g.fillStyle = p.cor; g.beginPath(); g.moveTo(m, m); g.arc(m, m, R, a0, a1); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,.22)"; g.beginPath(); g.moveTo(m, m); g.arc(m, m, R, a0, a0 + GOMO * 0.5); g.closePath(); g.fill();   // meio gomo mais claro: dá volume
      g.strokeStyle = "#1a1030"; g.lineWidth = 2; g.beginPath(); g.moveTo(m, m); g.lineTo(m + Math.cos(a0) * R, m + Math.sin(a0) * R); g.stroke();
      const ic = Pixel.icone(p.ico), am = (a0 + a1) / 2, d = R * 0.64;
      g.save(); g.translate(m + Math.cos(am) * d, m + Math.sin(am) * d); g.rotate(am + Math.PI / 2); g.drawImage(ic, -9, -9, 18, 18); g.restore();
    });
    // pinos de luz na borda
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; g.fillStyle = k % 2 ? "#fff6c2" : "#ffcc33"; g.fillRect(Math.round(m + Math.cos(a) * (R + 1.5)) - 1, Math.round(m + Math.sin(a) * (R + 1.5)) - 1, 2, 2); }
    return c;
  }
  function desenhar(r) {
    const g = r.cv.getContext("2d"), m = TAM / 2;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, TAM, TAM);
    g.save(); g.translate(m, m); g.rotate(r.ang); g.drawImage(base, -m, -m); g.restore();
    // miolo: botãozinho vermelho; ponteiro em cima
    g.fillStyle = "#1a1030"; g.beginPath(); g.arc(m, m, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ff4d5e"; g.beginPath(); g.arc(m, m, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffb3bd"; g.fillRect(m - 4, m - 4, 3, 2);
    g.fillStyle = "#1a1030"; g.beginPath(); g.moveTo(m - 8, 0); g.lineTo(m + 8, 0); g.lineTo(m, 14); g.closePath(); g.fill();
    g.fillStyle = r.pisca > 0 && Math.floor(r.pisca * 10) % 2 ? "#ffffff" : "#ffe066"; g.beginPath(); g.moveTo(m - 5, 1); g.lineTo(m + 5, 1); g.lineTo(m, 10); g.closePath(); g.fill();
  }
  function novaRoda(grande) {
    const cv = document.createElement("canvas"); cv.width = cv.height = TAM; cv.className = "roda" + (grande ? " grande" : "");
    const r = { cv: cv, ang: -GOMO * Math.random() * ROLETA_PREMIOS.length, pisca: 0 };
    desenhar(r); return r;
  }
  function gomoNoPonteiro(ang) { const a = ((-ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); return Math.floor(a / GOMO) % ROLETA_PREMIOS.length; }

  // gira as rodas (uma ou três), cada uma para no prêmio sorteado; as três param uma depois da outra
  function girar(lista, pronto) {
    girando = true;
    const ini = performance.now();
    lista.forEach(function(r, i) {
      r.k = sortear(); r.a0 = r.ang; r.dur = 2600 + i * 550; r.ultimo = gomoNoPonteiro(r.ang); r.fim = false;
      const alvo = -(r.k + 0.18 + Math.random() * 0.64) * GOMO;
      let fimAng = alvo; while (fimAng > r.a0 - Math.PI * 2 * (4 + i)) fimAng -= Math.PI * 2;   // pelo menos 4 voltas
      r.a1 = fimAng;
    });
    function quadro(agora) {
      if (!aberta) { girando = false; return; }
      let todas = true;
      lista.forEach(function(r) {
        const q = Math.min(1, (agora - ini) / r.dur), e = 1 - Math.pow(1 - q, 4);
        r.ang = r.a0 + (r.a1 - r.a0) * e;
        const g = gomoNoPonteiro(r.ang); if (g !== r.ultimo) { r.ultimo = g; Som.som("tic", 0.8 + 0.4 * (1 - q)); }
        if (q >= 1 && !r.fim) { r.fim = true; r.pisca = 1.2; Som.som("encaixe"); vibrar(20); }
        if (r.pisca > 0) r.pisca -= 0.016;
        if (!r.fim || r.pisca > 0) todas = false;
        desenhar(r);
      });
      if (todas) { girando = false; pronto(); return; }
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);
  }

  // ---------- janela ----------
  function abrir() {
    if (!liberado()) return;
    if (!base) base = fazerBase();
    aberta = true;
    const cx = Paineis.janela("<h2>" + Paineis.esc(t("rl_titulo")) + "</h2><p class='titulo2'>" + Paineis.esc(t("rl_explica")) + "</p>", []);
    Paineis.aoFecharJanela(function() { aberta = false; });
    const area = Paineis.elem("div", "rodas"), res = Paineis.elem("div", "rlRes"), bts = cx.querySelector(".linhaBtns");
    cx.insertBefore(area, bts); cx.insertBefore(res, bts);
    rodas = [novaRoda(true)]; area.appendChild(rodas[0].cv);
    ui = { bts: bts, area: area, res: res };
    botoes(bts, area, res);
    Poki.medir("event", "roleta", "visible");
  }
  function botoes(bts, area, res) {
    bts.innerHTML = "";
    const r = dados();
    const b1 = Paineis.elem("button", "btn grande" + (gratisPronto() ? "" : " sem"), "");
    b1.appendChild(Paineis.icone("roleta"));
    b1.appendChild(document.createTextNode(gratisPronto() ? t("rl_gratis") : fmtTempo(Math.ceil((r.gratis - Date.now()) / 1000))));
    b1.addEventListener("click", function() {
      if (girando || !gratisPronto()) { Som.som("erro"); return; }
      Som.som("clique"); r.gratis = Date.now() + GRATIS_MS; salvar();
      comecar(1, area, res, bts);
    });
    bts.appendChild(b1);
    if (Poki.premiadoDisponivel()) {
      const b3 = Paineis.elem("button", "btn roxo grande" + (anuncioPronto() ? "" : " sem"), "");
      b3.appendChild(Paineis.icone("video"));
      b3.appendChild(document.createTextNode(anuncioPronto() ? t("rl_x3") : fmtTempo(Math.ceil((r.anuncio - Date.now()) / 1000))));
      b3.addEventListener("click", function() {
        if (girando || !anuncioPronto()) { Som.som("erro"); return; }
        Som.som("clique");
        Poki.premiado("medium").then(function(ok) {
          if (!ok || !aberta) return;
          r.anuncio = Date.now() + ANUNCIO_MS; salvar();
          comecar(3, area, res, bts);
        });
      });
      bts.appendChild(b3);
    }
    const f = Paineis.elem("button", "btn sem", Paineis.esc(t("fechar")));
    f.addEventListener("click", function() { if (girando) return; Som.som("clique"); Paineis.fecharJanela(); });
    bts.appendChild(f);
    Paineis.preencherIcones(bts);
  }
  function comecar(n, area, res, bts) {
    res.innerHTML = "";
    if (rodas.length !== n) { area.innerHTML = ""; rodas = []; for (let k = 0; k < n; k++) { const r = novaRoda(n === 1); rodas.push(r); area.appendChild(r.cv); } }
    area.classList.toggle("tres", n === 3);
    bts.querySelectorAll("button").forEach(function(b) { b.classList.add("sem"); });
    dados().giros++;
    Poki.medir("event", "roleta", n === 3 ? "ad" : "free");
    girar(rodas, function() {
      rodas.forEach(function(r) {
        const b = r.cv.getBoundingClientRect(), p = ROLETA_PREMIOS[r.k];
        const nome = t("rl_" + p.id), txt = dar(r.k, b.left + b.width / 2, b.top + b.height / 2);   // nome com {0} (turbo, robô, PH, jackpot): o texto já diz tudo
        const linha = Paineis.elem("div", "rlItem" + (p.id === "jackpot" ? " jackpot" : ""), (nome.indexOf("{0}") < 0 ? "<b style='color:" + p.cor + "'>" + Paineis.esc(nome) + "</b>" : "") + "<span>" + Paineis.esc(txt) + "</span>");
        linha.prepend(Paineis.icone(p.ico));
        res.appendChild(linha);
        Fx.faiscas(b.left + b.width / 2, b.top + 10, p.cor, 16);
      });
      Som.som(rodas.some(function(r) { return ROLETA_PREMIOS[r.k].id === "jackpot"; }) ? "revela" : "ouro");
      Jogo.avisar("mudou");
      salvar();
      botoes(bts, area, res);
    });
  }

  // ---------- botão na tela (contagem e brilho quando o giro grátis está pronto) ----------
  function passo(dt) {
    relogio -= dt || 0;
    if (aberta && ui && !girando && relogio <= 0) { relogio = 1; if (!gratisPronto() || !anuncioPronto()) botoes(ui.bts, ui.area, ui.res); }   // contagem nos botões da janela
    if (!btn) {
      btn = el("btnRoleta"); if (!btn) return;
      btn.querySelector("i").style.backgroundImage = "url(" + Pixel.url(Pixel.icone("roleta")) + ")";
      btn.addEventListener("click", function() { Som.som("clique"); abrir(); });
    }
    const lib = liberado();
    btn.classList.toggle("escondido", !lib);
    if (!lib) return;
    const pronto = gratisPronto(), txt = pronto ? t("rl_botao") : fmtTempo(Math.ceil((dados().gratis - Date.now()) / 1000));
    btn.classList.toggle("pronto", pronto);
    if (txt !== ultimoTxt) { ultimoTxt = txt; btn.querySelector("b").textContent = txt; }
  }
  return { passo: passo, abrir: abrir, get aberta() { return aberta; } };
})();
