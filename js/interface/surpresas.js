"use strict";

// =========================
// SURPRESAS (quebram a rotina do idle):
// - ROBÔ DOURADO: de tempos em tempos passa voando pela tela por ~8 s. Tocar dá um prêmio sorteado:
//   saco de moedas, TURBO (renda x3 por 20 s) ou um robô de presente na grade.
// - MONSTRO INVASOR: de vez em quando um monstro das hordas entra andando na fábrica. Tocar nele dá dano e o time
//   também atira sozinho (então quem só deixa rodando também ganha). Derrotou: moedas e, se for monstro novo,
//   entra no compêndio (pontos de habilidade). Sem time e sem toque ele foge depois de 25 s.
// Só contam o tempo com a tela principal livre (sem janela, batalha ou curto-circuito). A missão atual adianta
// a surpresa que ela pede.
// =========================
const Surpresas = (function() {
  const camada = el("surpresas");
  let proxOuro = 35, proxMonstro = 100, ouro = null, monstro = null;

  function livre() { return !Paineis.janelaAberta() && !CenaBatalha.aberta && !Curto.ativo; }
  function sumir(o) { if (o && o.el.parentNode) o.el.parentNode.removeChild(o.el); }

  // ---------- robô dourado ----------
  function soltarOuro() {
    const W = window.innerWidth, H = window.innerHeight, tam = Math.round(Math.min(110, Math.max(72, W * 0.09)));
    const daEsq = Math.random() < 0.5;
    const im = document.createElement("img");
    im.className = "px ouro"; im.src = Pixel.url(Pixel.robo(22)); im.draggable = false; im.alt = "";
    im.style.width = im.style.height = tam + "px";
    camada.appendChild(im);
    ouro = { el: im, t: 0, dur: 8, tam: tam, x0: daEsq ? -tam : W + tam, x1: daEsq ? W + tam : -tam, y: H * (0.22 + Math.random() * 0.45), fase: Math.random() * 6, rastro: 0 };
    if (!daEsq) im.style.setProperty("--vira", "-1");
    im.addEventListener("pointerdown", function(e) { e.preventDefault(); e.stopPropagation(); pegarOuro(); });
    Som.som("ouro_aparece");
    Poki.medir("event", "golden", "visible");
  }
  function pegarOuro() {
    if (!ouro) return;
    const r = ouro.el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    sumir(ouro); ouro = null;
    save.stats.ouros = (save.stats.ouros || 0) + 1;
    const sorte = Math.random(), sprite = Pixel.robo(22);
    let texto;
    if (sorte < 0.4 && save.p.maxTier >= 3 && save.p.grade.indexOf(0) >= 0) {
      const tier = Math.max(1, save.p.maxTier - 2);
      Jogo.presente(tier);
      texto = t("ouro_robo", tier);
    } else if (sorte < 0.75) {
      Jogo.ligarTurbo(20);
      texto = t("ouro_turbo", 20);
    } else {
      const v = Math.round(Math.max(Jogo.custoCriar() * 4, Jogo.prodTime() * 60 + Jogo.valorToque() * 40));
      save.p.moedas += v;
      Fx.numero(x, y, "+" + fmt(v), "#ffcc33", 40);
      texto = t("ouro_moedas", fmt(v));
    }
    Fx.moedas(x, y, 12); Fx.faiscas(x, y, "#ffe066", 20);
    Paineis.faixa(sprite, t("ouro_titulo"), texto);
    Som.som("ouro");
    vibrar(30);
    Poki.medir("event", "golden", "interact");
    proxOuro = 60 + Math.random() * 60;
  }
  function passoOuro(dt) {
    const o = ouro; o.t += dt;
    if (o.t >= o.dur) { sumir(o); ouro = null; proxOuro = 45 + Math.random() * 45; return; }
    const k = o.t / o.dur, x = o.x0 + (o.x1 - o.x0) * k, y = o.y + Math.sin(o.t * 2.6 + o.fase) * 40;
    o.el.style.transform = "translate(" + Math.round(x - o.tam / 2) + "px," + Math.round(y - o.tam / 2) + "px) scaleX(var(--vira, 1))";
    o.rastro -= dt;
    if (o.rastro <= 0) { o.rastro = 0.12; Fx.faiscas(x - (o.x1 > o.x0 ? 1 : -1) * o.tam * 0.35, y, Math.random() < 0.5 ? "#ffe066" : "#fff6c2", 2); }
  }

  // ---------- monstro invasor ----------
  function soltarMonstro() {
    const zMax = Math.min(HORDAS.length - 1, Math.max(0, save.hordasVencidas));
    const z = Math.floor(Math.random() * (zMax + 1)), id = z * 3 + Math.floor(Math.random() * 3);
    const bt = el("cvBotao").getBoundingClientRect(), tam = Math.round(Math.min(140, Math.max(84, bt.width * 0.4)));
    const box = document.createElement("div"); box.className = "invasor";
    box.style.width = tam + "px";
    const im = document.createElement("img"); im.className = "px"; im.src = Pixel.url(Pixel.monstro(id)); im.draggable = false; im.alt = "";
    im.style.width = im.style.height = tam + "px";
    const barra = document.createElement("div"); barra.className = "vidaInv"; barra.appendChild(document.createElement("i"));
    box.appendChild(barra); box.appendChild(im); camada.appendChild(box);
    const vida = 12;
    monstro = { el: box, im: im, barra: barra.firstChild, id: id, vida: vida, max: vida, t: 0, tam: tam, fugindo: false,
      x: window.innerWidth + tam, alvoX: bt.left + bt.width * (0.7 + Math.random() * 0.12), y: bt.bottom - tam * 0.95, tiro: 0.6 };   // para na frente do botão
    box.addEventListener("pointerdown", function(e) { e.preventDefault(); e.stopPropagation(); bater(1.2, true); });
    Paineis.faixa(Pixel.monstro(id), t("inv_titulo"), t("inv_d"));
    Som.som("alarme");
    Poki.medir("event", "invader", "visible");
  }
  function bater(dano, toque) {
    const m = monstro; if (!m || m.fugindo) return;
    m.vida -= dano;
    const r = m.im.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * 0.4;
    m.im.classList.remove("apanha"); void m.im.offsetWidth; m.im.classList.add("apanha");
    Fx.faiscas(x, y, toque ? "#ffcc33" : "#7cf0ff", toque ? 8 : 4);
    if (toque) { Som.som("acerto"); vibrar(10); }
    if (m.vida <= 0) venceuMonstro(x, y);
  }
  function venceuMonstro(x, y) {
    const m = monstro; sumir(m); monstro = null;
    save.stats.invasores = (save.stats.invasores || 0) + 1;
    const v = Math.round(Math.max(Jogo.custoCriar() * 5, Jogo.prodTime() * 90 + Jogo.valorToque() * 50));
    save.p.moedas += v;
    Fx.moedas(x, y, 14); Fx.faiscas(x, y, "#ff5d73", 18);
    Fx.numero(x, y - 20, "+" + fmt(v), "#ffcc33", 40);
    Paineis.faixa(Pixel.monstro(m.id), t("inv_venceu"), t("ouro_moedas", fmt(v)));
    Jogo.descobrirMonstro(m.id);   // monstro novo: entra no compêndio (pontos de habilidade)
    Som.som("vitoria");
    vibrar(40);
    Poki.medir("event", "invader", "complete");
    proxMonstro = 150 + Math.random() * 90;
  }
  function passoMonstro(dt) {
    const m = monstro; m.t += dt;
    if (m.fugindo) {
      m.x += 260 * dt;
      if (m.x > window.innerWidth + m.tam) { sumir(m); monstro = null; proxMonstro = 120 + Math.random() * 60; return; }
    } else {
      if (m.x > m.alvoX) m.x = Math.max(m.alvoX, m.x - 140 * dt);
      // o time atira sozinho: cada robô do time tira um pouco por segundo
      const nTime = save.p.time.filter(Boolean).length;
      if (nTime && m.x <= m.alvoX + 4) {
        m.tiro -= dt;
        if (m.tiro <= 0) { m.tiro = 1.1; bater(0.25 * nTime, false); if (!monstro) return; Som.som("tiro", 1.2); }
      }
      if (m.t > 25) { m.fugindo = true; m.el.classList.add("foge"); Paineis.faixa(Pixel.monstro(m.id), t("inv_fugiu"), ""); }
    }
    const pula = Math.abs(Math.sin(m.t * 7)) * 6;
    m.el.style.transform = "translate(" + Math.round(m.x - m.tam / 2) + "px," + Math.round(m.y - pula) + "px)";
    m.barra.style.width = Math.max(0, m.vida / m.max * 100) + "%";
  }

  // ---------- relógio ----------
  function passo(dt) {
    if (Revela.aberta) return;   // "NOVO ROBÔ!" na tela: tudo espera
    if (!livre()) {   // abriu janela/batalha: as surpresas na tela somem sem prêmio (e voltam depois)
      if (ouro) { sumir(ouro); ouro = null; proxOuro = Math.max(proxOuro, 20); }
      if (monstro) { sumir(monstro); monstro = null; proxMonstro = Math.max(proxMonstro, 40); }
      return;
    }
    if (save.tutorial < 2) return;   // primeiro aprende o básico
    const m = Missoes.atual().tipo;
    if (ouro) passoOuro(dt);
    else { proxOuro -= dt * (m === "ouro" ? 4 : 1); if (proxOuro <= 0) soltarOuro(); }
    const monstroLiberado = save.hordasVencidas >= 1 || m === "monstro";
    if (monstro) passoMonstro(dt);
    else if (monstroLiberado) { proxMonstro -= dt * (m === "monstro" ? 6 : 1); if (proxMonstro <= 0) soltarMonstro(); }
    // selo do turbo no topo
    const tr = Jogo.turboRestante(), box = el("boxTurbo");
    if (tr > 0) { box.classList.remove("escondido"); el("txtTurbo").textContent = Math.ceil(tr) + "s"; }
    else if (!box.classList.contains("escondido")) box.classList.add("escondido");
  }

  return { passo: passo, soltarOuro: soltarOuro, soltarMonstro: soltarMonstro };
})();
