"use strict";

// =========================
// GUIA (v13): mãozinha que mostra o que fazer na missão da vez. No PFT da v12 o pessoal travava em pôr robô no
// time (-28%), comprar o 1º upgrade (-41%), pegar o robô dourado (-47%) e ir para a batalha (-52%).
// Aparece depois de uns segundos sem mexer (o robô dourado na hora) e some ao tocar em qualquer lugar.
//   - arrastar: da grade para o time / um robô em cima do outro igual (juntar);
//   - tocar: botão Criar, aba Upgrades/Batalha (que também brilha), o card do upgrade, a horda, Lutar, o dourado.
// =========================
const Guia = (function() {
  const mao = document.createElement("img");
  mao.id = "mao"; mao.className = "px escondido"; mao.alt = ""; mao.draggable = false;
  document.body.appendChild(mao);
  let parado = 0, alvo = null, fase = 0, relogio = 0, abaChama = null;
  ["pointerdown", "keydown"].forEach(function(ev) { window.addEventListener(ev, function() { parado = 0; esconder(); }, true); });

  function centro(e) { if (!e || !e.isConnected) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function vaga(lista, i) { return document.querySelector('.vaga[data-lista="' + lista + '"][data-i="' + i + '"]'); }
  function esconder() { alvo = null; mao.classList.add("escondido"); }

  // ---------- o que mostrar agora ----------
  function parJuntar() {   // dois robôs iguais na grade (o maior par)
    const g = save.p.grade; let melhor = null;
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (g[i] && g[i] === g[j] && g[i] < MAX_TIER && (!melhor || g[i] > melhor[2])) melhor = [i, j, g[i]];
    return melhor ? { tipo: "arrasta", de: vaga("grade", melhor[0]), para: vaga("grade", melhor[1]) } : null;
  }
  function paraTime() {   // melhor robô da grade -> primeira vaga livre do time
    const t = save.p.time.indexOf(0); if (t < 0) return null;
    let i = -1; save.p.grade.forEach(function(n, k) { if (n && (i < 0 || n > save.p.grade[i])) i = k; });
    return i < 0 ? null : { tipo: "arrasta", de: vaga("grade", i), para: vaga("time", t) };
  }
  function aba(nome) { return document.querySelector('.aba[data-aba="' + nome + '"]'); }
  function upgradeAlvo(m) {
    const id = m.tipo === "up" ? m.id : (principalDoTier(m.alvo - 1) || {}).id;
    if (!id) return null;
    if (Paineis.aba !== "upgrades") return { tipo: "toca", e: aba("upgrades"), aba: "upgrades" };
    const c = Paineis.cardUp(id); if (!c || !c.isConnected) return null;
    const r = c.getBoundingClientRect(), p = el("painelCorpo").getBoundingClientRect();
    if (r.top < p.top || r.bottom > p.bottom) c.scrollIntoView({ block: "center", behavior: "smooth" });
    return { tipo: "toca", e: c.querySelector("button") || c, aba: "upgrades" };
  }
  function hordaAlvo(m) {
    if (Paineis.aba !== "batalha") return { tipo: "toca", e: aba("batalha"), aba: "batalha" };
    if (Paineis.escolhendo()) return { tipo: "toca", e: el("btnLutar"), aba: "batalha" };
    return { tipo: "toca", e: document.querySelector('.card.horda[data-h="' + (m.alvo - 1) + '"]'), aba: "batalha" };
  }
  function escolher() {
    if (Paineis.janelaAberta() || CenaBatalha.aberta || Curto.ativo || Revela.aberta || Ataque.ativo) return null;
    const p = save.p;
    if (save.tutorial === 1 && p.moedas >= Jogo.custoCriar()) return { tipo: "toca", e: el("btnCriar") };
    if (save.tutorial === 2) return parJuntar();
    if (save.tutorial === 3) return paraTime();
    if (save.tutorial < 4) return null;
    const m = Missoes.atual(); if (Missoes.completa()) return null;
    switch (m.tipo) {
      case "ouro": return Surpresas.ouroEl ? { tipo: "toca", e: Surpresas.ouroEl, ja: true } : null;
      case "time": return Paineis.aba ? null : paraTime();
      case "juntar": return Paineis.aba ? null : parJuntar();
      case "criar": return !Paineis.aba && p.moedas >= Jogo.custoCriar() ? { tipo: "toca", e: el("btnCriar") } : null;
      case "up": case "uptier": return upgradeAlvo(m);
      case "horda": return hordaAlvo(m);
      case "renascer": return Jogo.podeRenascer() ? upgradeAlvo({ tipo: "up", id: "_renascer" }) : null;   // v14
    }
    return null;
  }

  // ---------- desenho ----------
  function por(x, y, s) { mao.style.transform = "translate(" + Math.round(x - 0.3 * s) + "px," + Math.round(y - 0.04 * s) + "px)"; }
  function passo(dt) {
    parado += dt; relogio -= dt; fase += dt;
    if (relogio <= 0) {
      relogio = 0.25;
      const a = escolher();
      // aba que a missão pede brilha (mesmo antes da mão aparecer)
      const chama = a && a.aba && Paineis.aba !== a.aba ? a.aba : null;
      if (chama !== abaChama) { document.querySelectorAll(".aba.chama").forEach(function(b) { b.classList.remove("chama"); }); if (chama) aba(chama).classList.add("chama"); abaChama = chama; }
      if (!a || (!a.ja && parado < (save.tutorial < 4 ? 2.5 : 3.5))) { esconder(); return; }
      if (!alvo || alvo.e !== a.e || alvo.de !== a.de || alvo.para !== a.para) { alvo = a; fase = 0; }
      if (!mao.src) mao.src = Pixel.url(Pixel.icone("mao"));
    }
    if (!alvo) return;
    const s = Math.round(Math.min(76, Math.max(58, window.innerWidth * 0.045)));
    mao.style.width = mao.style.height = s + "px";
    if (alvo.tipo === "toca") {
      const c = centro(alvo.e); if (!c) { esconder(); return; }
      const bate = Math.abs(Math.sin(fase * 5)) * 12;
      por(c.x + 6, c.y + 6 + bate, s);
      mao.style.opacity = 1;
    } else {
      const a = centro(alvo.de), b = centro(alvo.para); if (!a || !b) { esconder(); return; }
      const ciclo = 1.8, q = (fase % ciclo) / ciclo, k = q < 0.15 ? 0 : q > 0.8 ? 1 : (q - 0.15) / 0.65, e = k * k * (3 - 2 * k);
      por(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, s);
      mao.style.opacity = q > 0.9 ? (1 - q) * 10 : q < 0.06 ? q / 0.06 : 1;
      mao.classList.toggle("aperta", q >= 0.12 && q <= 0.82);
    }
    mao.classList.remove("escondido");
  }
  return { passo: passo };
})();
