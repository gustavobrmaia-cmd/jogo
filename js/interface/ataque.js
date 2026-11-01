"use strict";

// =========================
// ATAQUE À FÁBRICA (v9): de tempos em tempos (depois da 2ª horda vencida) um CHEFÃO gigante invade a tela principal.
// Enquanto ele está lá a fábrica é sabotada (renda pela metade, fumaça no fundo). Você tem 40 s: cada toque nele tira
// 1 de vida e o time atira sozinho (0,15/s por robô). Vencer: moedas, 2 pontos de habilidade e uma PEÇA garantida.
// Perder: a fábrica fica danificada por 60 s (renda pela metade). Pausa com janela/batalha abertas.
// =========================
const Ataque = (function() {
  const camada = el("surpresas");
  let prox = 240, chefe = null;
  const VIDA = 60, TEMPO = 40;

  function liberado() { return save.tutorial >= 4 && save.hordasVencidas >= 2; }
  function livre() { return !Paineis.janelaAberta() && !CenaBatalha.aberta && !Curto.ativo && !Revela.aberta; }
  function soltar() {
    const z = Math.min(HORDAS.length - 1, Math.max(0, save.hordasVencidas - 1)), id = z * 3 + 2;
    const bt = el("cvBotao").getBoundingClientRect(), tam = Math.round(Math.max(150, Math.min(300, bt.width * 1.05)));
    const box = document.createElement("div"); box.className = "chefao";
    const topo = document.createElement("div"); topo.className = "chefaoTopo";
    topo.innerHTML = "<b></b><div class='vidaChefe'><i></i></div><span></span>";
    const im = document.createElement("img"); im.className = "px"; im.src = Pixel.url(Pixel.monstro(id)); im.draggable = false; im.alt = "";
    im.style.width = im.style.height = tam + "px";
    box.appendChild(topo); box.appendChild(im); camada.appendChild(box);
    topo.querySelector("b").textContent = NOMES_MONSTROS[id];
    chefe = { el: box, im: im, id: id, z: z, vida: VIDA, t: 0, tiro: 1, x: bt.left + bt.width / 2, y: bt.top + bt.height / 2, tam: tam, barra: topo.querySelector("i"), relogio: topo.querySelector("span") };
    box.style.left = Math.round(chefe.x - tam / 2) + "px"; box.style.top = Math.round(chefe.y - tam / 2 - 30) + "px";
    box.addEventListener("pointerdown", function(e) { e.preventDefault(); e.stopPropagation(); bater(1, true, e.clientX, e.clientY); });
    Paineis.faixa(Pixel.monstro(id), t("ataque_titulo"), t("ataque_d", TEMPO));
    Som.som("alarme"); setTimeout(function() { Som.som("alarme"); }, 600);
    vibrar(80);
    Poki.medir("event", "factory-attack", "visible");
  }
  function bater(d, toque, x, y) {
    const c = chefe; if (!c) return;
    c.vida -= d;
    c.im.classList.remove("apanha"); void c.im.offsetWidth; c.im.classList.add("apanha");
    if (toque) { Som.som("acerto"); vibrar(8); Fx.faiscas(x, y, "#ffcc33", 6); }
    if (c.vida <= 0) fim(true);
  }
  function fim(venceu) {
    const c = chefe; chefe = null;
    if (c.el.parentNode) c.el.parentNode.removeChild(c.el);
    Fundo.pane.fumaca = 1; Fundo.pane.luzes = 0;
    prox = 360 + Math.random() * 180;
    if (venceu) {
      const v = Math.round(Math.max(Jogo.custoCriar() * 8, Jogo.prodTime() * 120 + Jogo.valorToque() * 60));
      save.p.moedas += v; save.ph += 2;
      const peca = Equip.ganhar(0.3 + c.z * 0.07);
      Fx.moedas(c.x, c.y, 20); Fx.faiscas(c.x, c.y, "#ff5d73", 30); Fx.numero(c.x, c.y - 40, "+" + fmt(v), "#ffcc33", 44);
      Paineis.faixa(Pixel.monstro(c.id), t("ataque_venceu"), t("ataque_premio", fmt(v), 2) + " · " + Equip.nome(peca));
      Som.som("vitoria"); vibrar(60);
      Poki.medir("event", "factory-attack", "complete");
    } else {
      save.p.sabotagem = Date.now() + 60000;
      Paineis.faixa(Pixel.monstro(c.id), t("ataque_perdeu"), t("ataque_perdeu_d", 60));
      Som.som("derrota");
      Poki.medir("event", "factory-attack", "fail");
    }
    salvar();
  }
  function passo(dt) {
    if (!liberado()) return;
    if (!chefe) {
      if (!livre()) return;
      prox -= dt; if (prox <= 0) soltar();
      return;
    }
    if (!livre()) return;   // pausa
    const c = chefe;
    c.t += dt;
    save.p.sabotagem = Math.max(save.p.sabotagem || 0, Date.now() + 500);   // renda pela metade enquanto ele está aqui
    Fundo.pane.fumaca = 4; Fundo.pane.luzes = 1;
    const nTime = save.p.time.filter(Boolean).length;
    c.tiro -= dt;
    if (c.tiro <= 0 && nTime) { c.tiro = 1; bater(0.15 * nTime, false); if (!chefe) return; Som.som("tiro", 1.3); }
    const pula = Math.round(Math.abs(Math.sin(c.t * 3)) * 8);
    c.im.style.transform = "translateY(" + (-pula) + "px)";
    c.barra.style.width = Math.max(0, c.vida / VIDA * 100) + "%";
    c.relogio.textContent = Math.max(0, Math.ceil(TEMPO - c.t)) + "s";
    if (c.t >= TEMPO) fim(false);
  }
  return { passo: passo, soltar: soltar, get ativo() { return !!chefe; } };
})();
