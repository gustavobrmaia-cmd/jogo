"use strict";

// =========================
// "NOVO ROBÔ!": quando sai um nível de robô nunca visto (do 2 em diante), a tela para por um instante e mostra o
// robô grande, girando raios atrás, com o nome, o nível e o prêmio da descoberta. Toque fecha (ou some sozinho).
// Se uma janela/batalha estiver aberta, espera ela fechar. Vários seguidos entram em fila.
// =========================
const Revela = (function() {
  const box = el("revela");
  const fila = [];
  let aberta = false, ate = 0, desde = 0;

  Jogo.ao("descobriu", function(d) { if (d.tipo === "robo" && d.id >= 2) fila.push(d); });

  function pode() { return !Paineis.janelaAberta() && !CenaBatalha.aberta && !Curto.ativo; }
  function mostrar(d) {
    aberta = true; desde = performance.now(); ate = desde + 2800;
    el("revImg").src = Pixel.url(Pixel.robo(d.id));
    el("revNome").textContent = NOMES_ROBOS[d.id - 1];
    el("revNivel").textContent = t("nivel", d.id);
    el("revPremio").innerHTML = "<i class='ico' data-ico='ph'></i>+" + d.ph + "  <i class='ico' data-ico='moeda'></i>+" + Paineis.esc(fmt(d.moedas));
    Paineis.preencherIcones(box);
    box.classList.remove("escondido", "sai"); void box.offsetWidth; box.classList.add("entra");
    Som.som("revela");
    vibrar(40);
  }
  function fechar() {
    if (!aberta) return;
    aberta = false;
    box.classList.remove("entra"); box.classList.add("escondido");
  }
  // toque fecha (depois de um instante, para não fechar sem querer com o mesmo toque que juntou)
  box.addEventListener("pointerdown", function(e) { e.preventDefault(); if (performance.now() - desde > 450) fechar(); });

  function passo() {
    if (aberta) { if (performance.now() > ate || !pode()) fechar(); return; }
    if (fila.length && pode()) mostrar(fila.shift());
  }
  return { passo: passo, get aberta() { return aberta; } };
})();
