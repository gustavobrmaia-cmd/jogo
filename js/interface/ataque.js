"use strict";

// =========================
// RAID (v11; antes era o "Ataque à Fábrica" na tela principal). De tempos em tempos (depois da 2ª horda vencida)
// toca a sirene: de 1 a 5 CHEFÕES GIGANTES estão invadindo a fábrica. Aparece o aviso com os chefões e uma contagem
// de 5 s (ou o botão DEFENDER! para ir na hora) e a luta abre na cena de batalha com os seus melhores robôs.
// A força dos chefões é ajustada à dos seus robôs (batalha.js prepararRaid). Vencer: moedas, 2 PH e 1 peça por
// chefão. Perder (ou fugir): a fábrica fica danificada e rende a metade por 60 s.
// Mais chefões aparecem quanto mais longe você está (hordas vencidas e renascimentos).
// =========================
const Ataque = (function() {
  const box = el("raidAviso");
  let prox = 240, aviso = null;

  function liberado() { return save.tutorial >= 4 && save.hordasVencidas >= 2; }
  function livre() { return !Paineis.janelaAberta() && !CenaBatalha.aberta && !Curto.ativo && !Revela.aberta; }
  function defensores() {
    const l = [];
    ["time", "grade"].forEach(function(lista) { save.p[lista].forEach(function(n, i) { if (n) l.push({ n: n, f: dadosTraco(Jogo.trDe(lista, i)).bat || 1 }); }); });
    return l.sort(function(a, b) { return b.n - a.n || b.f - a.f; }).slice(0, Batalha.vagas());
  }
  function soltar(forcarN) {
    if (!defensores().length) { prox = 120; return; }
    const maxN = Math.min(5, 1 + Math.floor(save.hordasVencidas / 2) + Math.min(2, save.renascimentos || 0));
    const n = forcarN || 1 + Math.floor(Math.pow(Math.random(), 1.4) * maxN);
    const z = Math.min(HORDAS.length - 1, Math.max(0, save.hordasVencidas - 1));
    aviso = { n: n, t: 5, sirene: 0 };
    box.innerHTML = "";
    box.appendChild(Paineis.elem("b", "raidTitulo", Paineis.esc(t("raid_titulo"))));
    box.appendChild(Paineis.elem("span", "", Paineis.esc(t("raid_d", n))));
    const fila = Paineis.elem("div", "raidChefes");
    for (let k = 0; k < n; k++) fila.appendChild(Pixel.img(Pixel.monstro(HORDAS[Math.min(HORDAS.length - 1, z + (k % 2))].monstros[(k * 2 + 2) % 3].id)));
    box.appendChild(fila);
    const b = Paineis.elem("button", "btn vermelho grande", "");
    b.addEventListener("click", function() { Som.som("clique"); comecar(); });
    box.appendChild(b);
    aviso.btn = b;
    box.classList.remove("escondido");
    Paineis.fechar();
    Fundo.pane.luzes = 1; Fundo.pane.fumaca = 4;
    vibrar(120);
    Poki.medir("event", "raid-" + n, "visible");
  }
  function comecar() {
    if (!aviso) return;
    const n = aviso.n; aviso = null;
    box.classList.add("escondido");
    Fundo.pane.luzes = 0; Fundo.pane.fumaca = 1;
    const tiers = defensores();
    if (!tiers.length) return;
    Paineis.fechar();
    Batalha.prepararRaid(n, tiers);
    CenaBatalha.abrir("raid", tiers);
    prox = 360 + Math.random() * 180;
  }
  function passo(dt) {
    if (!liberado()) return;
    if (aviso) {
      if (Paineis.janelaAberta() || CenaBatalha.aberta) return;
      aviso.t -= dt; aviso.sirene -= dt;
      if (aviso.sirene <= 0) { aviso.sirene = 0.7; Som.som("alarme"); }
      aviso.btn.textContent = t("raid_defender") + " (" + Math.max(0, Math.ceil(aviso.t)) + ")";
      if (aviso.t <= 0) comecar();
      return;
    }
    if (!livre()) return;
    prox -= dt; if (prox <= 0) soltar();
  }
  return { passo: passo, soltar: soltar, get ativo() { return !!aviso; } };
})();
