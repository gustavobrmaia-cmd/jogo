"use strict";

// =========================
// ÁRVORE DE HABILIDADES (janela larga): uma rede de nós numa placa de circuito, como no desenho do dono.
// Trilhas de cobre ligam os nós (acesas em dourado quando os dois lados foram comprados), chips com ícone são os
// nós. Tocar num nó mostra embaixo o que ele faz, o nível e o custo. Duas formas:
//   - compra (depois de renascer): gasta os PH e "Começar de novo" inicia a partida nova (com intervalo comercial);
//   - só olhar (botão na aba Upgrades): mostra tudo, mas comprar só ao renascer.
// =========================
const ArvoreTela = (function() {
  let compra = false, sel = "nucleo", rede = null, cv = null;
  const esc = function(s) { return Paineis.esc(s); };

  function abrir(modoCompra) {
    compra = !!modoCompra;
    const cx = Paineis.janela(
      "<h2>" + esc(t("arvore")) + "</h2><p><i class='ico' data-ico='ph'></i> <b style='color:var(--ciano)' id='arvPh'></b> " + esc(t("ph_nome")) + "</p>" +
      "<p class='titulo2'>" + esc(compra ? t("arvore_compre") : t("arvore_so_ver")) + "</p><div class='rede' id='arvRede'><canvas></canvas></div><div class='infoNo' id='arvInfo'></div>",
      compra ? [{ texto: t("comecar"), classe: "grande", acao: comecar }] : [{ texto: t("fechar"), classe: "sem", acao: Paineis.fecharJanela }]);
    cx.classList.add("larga");
    rede = cx.querySelector("#arvRede"); cv = rede.querySelector("canvas");
    ARVORE.forEach(function(no) {
      const b = document.createElement("button");
      b.className = "no"; b.dataset.id = no.id;
      b.style.left = no.x + "%"; b.style.top = no.y + "%";
      b.appendChild(Paineis.icone(no.ico));
      const lv = document.createElement("span"); lv.className = "lv"; b.appendChild(lv);
      b.addEventListener("click", function() {
        Som.som("clique");
        if (sel === no.id && compra) comprar(no.id); else { sel = no.id; atualizar(); }
      });
      rede.appendChild(b);
    });
    const fim = function() { cx.classList.remove("larga"); window.removeEventListener("resize", trilhas); };
    Paineis.aoFecharJanela(fim);
    window.addEventListener("resize", trilhas);
    atualizar();
    requestAnimationFrame(trilhas);
  }
  function comprar(id) {
    if (Jogo.comprarNo(id)) { Som.som("compra"); salvar(); const b = rede.querySelector("[data-id='" + id + "']").getBoundingClientRect(); Fx.faiscas(b.left + b.width / 2, b.top + b.height / 2, "#7cf0ff", 14); }
    else Som.som("erro");
    atualizar();
  }
  function estado(no) {
    const n = nivelNo(no.id);
    if (n) return "tem";
    if (!noAberto(no.id)) return "bloq";
    return compra && save.ph >= custoNo(no.id, 0) ? "pode" : "";
  }
  function atualizar() {
    if (!rede) return;
    el("arvPh").textContent = fmt(save.ph);
    rede.querySelectorAll(".no").forEach(function(b) {
      const no = NO[b.dataset.id], n = nivelNo(no.id), est = estado(no);
      const podeMais = compra && n > 0 && n < no.max && save.ph >= custoNo(no.id, n);
      b.className = "no" + (est ? " " + est : "") + (podeMais ? " pode" : "") + (sel === no.id ? " sel" : "");
      b.lastChild.textContent = no.max > 1 ? n + "/" + no.max : "";
    });
    // informação do nó escolhido
    const no = NO[sel], n = nivelNo(sel), max = n >= no.max, c = custoNo(sel, n), aberto = noAberto(sel);
    const info = el("arvInfo"); info.innerHTML = "";
    info.appendChild(Paineis.icone(no.ico));
    info.appendChild(Paineis.elem("div", "info", "<b>" + esc(t("ar_" + sel)) + (no.max > 1 ? " <small>" + n + "/" + no.max + "</small>" : "") + "</b><span>" + esc(t("ar_" + sel + "_d")) + "</span>" +
      (!aberto ? "<span>" + esc(t("precisa", no.liga.map(function(l) { return t("ar_" + l); }).join(" / "))) + "</span>" : "")));
    const b = Paineis.elem("button", "btn" + (compra && !max && aberto && save.ph >= c ? "" : " sem"), "");
    if (max) b.textContent = t("max");
    else { b.appendChild(Paineis.icone("ph")); b.appendChild(document.createTextNode(c + (compra ? "" : " · " + t("so_ao_renascer")))); }
    b.addEventListener("click", function() { if (compra && !max) comprar(sel); else Som.som("erro"); });
    info.appendChild(b);
    trilhas();
  }
  // trilhas de cobre em pixel (canvas em baixa resolução, ampliado sem borrar): em L, com soldas nas pontas
  function trilhas() {
    if (!cv || !cv.isConnected) return;
    const r = rede.getBoundingClientRect(), E = 3, W = Math.max(1, Math.round(r.width / E)), H = Math.max(1, Math.round(r.height / E));
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    // placa: pontinhos e trilhas falsas de enfeite
    g.fillStyle = "#0d2522"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#123630"; for (let x = 4; x < W; x += 8) for (let y = 4; y < H; y += 8) g.fillRect(x, y, 1, 1);
    const rnd = semente(7);
    g.fillStyle = "#103029"; for (let k = 0; k < 18; k++) { const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H), l = 10 + Math.floor(rnd() * 30); if (rnd() < 0.5) g.fillRect(x, y, l, 1); else g.fillRect(x, y, 1, l); }
    const pos = function(no) { return { x: Math.round(no.x / 100 * W), y: Math.round(no.y / 100 * H) }; };
    ARVORE.forEach(function(no) {
      no.liga.forEach(function(l) {
        const a = pos(NO[l]), b = pos(no), acesa = nivelNo(no.id) > 0 && nivelNo(l) > 0, aberta = nivelNo(l) > 0;
        const cor = acesa ? "#ffcc33" : aberta ? "#b0742a" : "#3d5a40", sombra = acesa ? "#8a5a10" : "#0a1c18";
        const linha = function(dx, dy) {
          // em L: anda na horizontal até o x do destino e depois na vertical
          g.fillStyle = sombra; g.fillRect(Math.min(a.x, b.x) + dx, a.y + 1 + dy, Math.abs(b.x - a.x) + 2, 2); g.fillRect(b.x + 1 + dx, Math.min(a.y, b.y) + dy, 2, Math.abs(b.y - a.y) + 2);
          g.fillStyle = cor; g.fillRect(Math.min(a.x, b.x) + dx, a.y + dy, Math.abs(b.x - a.x) + 2, 2); g.fillRect(b.x + dx, Math.min(a.y, b.y) + dy, 2, Math.abs(b.y - a.y) + 2);
        };
        linha(0, 0);
        g.fillStyle = cor; g.fillRect(b.x - 1, a.y - 1, 4, 4);   // solda na curva
      });
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
