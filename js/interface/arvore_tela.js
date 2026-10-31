"use strict";

// =========================
// ÁRVORE DE HABILIDADES (janela). Duas formas:
//   - compra (depois de renascer): gasta os PH e "Começar de novo" inicia a partida nova (com intervalo comercial);
//   - só olhar (botão na aba Upgrades): mostra tudo, mas comprar só ao renascer. Ver o que dá para ter com os
//     pontos guardados é o que puxa o renascimento sem obrigar.
// =========================
const ArvoreTela = (function() {
  let compra = false;
  const esc = function(s) { return Paineis.esc(s); };

  function abrir(modoCompra) {
    compra = !!modoCompra;
    montar();
  }
  function montar() {
    const cx = Paineis.janela(
      "<h2>" + esc(t("arvore")) + "</h2><p><i class='ico' data-ico='ph'></i> <b style='color:var(--ciano)'>" + fmt(save.ph) + "</b> " + esc(t("ph_nome")) + "</p>" +
      "<p class='titulo2'>" + esc(compra ? t("arvore_compre") : t("arvore_so_ver")) + "</p><div class='arvore' id='arvoreGalhos'></div>",
      compra ? [{ texto: t("comecar"), classe: "grande", acao: comecar }] : [{ texto: t("fechar"), classe: "sem", acao: Paineis.fecharJanela }]);
    const raiz = cx.querySelector("#arvoreGalhos");
    [0, 1, 2].forEach(function(gi) {
      const galho = Paineis.elem("div", "galho", "<h3>" + esc(t("galho_" + gi)) + "</h3>");
      ARVORE.filter(function(n) { return n.galho === gi; }).forEach(function(no) {
        const n = nivelNo(no.id), max = n >= no.max, req = !no.req || nivelNo(no.req) > 0, c = custoNo(no.id, n);
        const pode = compra && !max && req && save.ph >= c;
        const b = Paineis.elem("button", "no" + (n ? " tem" : "") + (pode ? " pode" : "") + (!req ? " bloq" : ""),
          "<b>" + esc(t("ar_" + no.id)) + "</b><small>" + esc(t("ar_" + no.id + "_d")) + "</small>" +
          "<span class='custo'>" + (max ? esc(t("max")) : (no.max > 1 ? n + "/" + no.max + " · " : "") + c + " PH") + "</span>" +
          (!req ? "<small>" + esc(t("precisa", t("ar_" + no.req))) + "</small>" : ""));
        b.addEventListener("click", function() {
          if (!compra) { Som.som("erro"); return; }
          if (Jogo.comprarNo(no.id)) { Som.som("compra"); salvar(); montar(); } else Som.som("erro");
        });
        galho.appendChild(b);
      });
      raiz.appendChild(galho);
    });
  }
  function comecar() {
    Paineis.fecharJanela();
    Paineis.fechar();
    Jogo.novaPartida();
    Tela.montarVagas(); Tela.layout();
    salvar();
    Poki.intervalo();
  }
  return { abrir: abrir };
})();
