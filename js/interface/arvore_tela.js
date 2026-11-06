"use strict";

// =========================
// ÁRVORE DE HABILIDADES (janela larga): uma rede de nós numa placa de circuito, como no desenho do dono.
// Trilhas de cobre ligam os nós (acesas em dourado quando os dois lados foram comprados), chips com ícone são os
// nós. Tocar num nó mostra embaixo o que ele faz, o nível e o custo. Duas formas:
//   - compra (depois de renascer): gasta os PH e "Começar de novo" inicia a partida nova (com intervalo comercial);
//   - só olhar (botão na aba Upgrades): mostra tudo, mas comprar só ao renascer.
// =========================
const ArvoreTela = (function() {
  let desafio = "", compra = false, sel = "nucleo", rede = null, cv = null, mapa = null, U = 56, px = 0, py = 0, arrastou = false;
  const esc = function(s) { return Paineis.esc(s); };

  function abrir(modoCompra) {
    compra = !!modoCompra;
    const cx = Paineis.janela(
      "<h2>" + esc(t("arvore")) + "</h2><p><i class='ico' data-ico='ph'></i> <b style='color:var(--ciano)' id='arvPh'></b> " + esc(t("ph_nome")) + "</p>" +
      "<p class='titulo2'>" + esc(compra ? t("arvore_compre") : t("arvore_so_ver")) + " " + esc(t("arvore_arraste")) + "</p><div class='rede' id='arvRede'><div class='mapa'><canvas></canvas></div></div><div class='infoNo' id='arvInfo'></div>" +
      (compra ? "<div class='desafios' id='arvDes'></div>" : ""),
      compra ? [{ texto: t("comecar"), classe: "grande", acao: comecar }] : [{ texto: t("fechar"), classe: "sem", acao: Paineis.fecharJanela }]);
    cx.classList.add("larga");
    rede = cx.querySelector("#arvRede"); mapa = rede.querySelector(".mapa"); cv = mapa.querySelector("canvas");
    // v7: MAPA grande (MAPA_L x MAPA_A casas de U px) dentro de uma janela que se arrasta
    U = document.body.classList.contains("empe") ? 46 : 56;
    mapa.style.width = MAPA_L * U + "px"; mapa.style.height = MAPA_A * U + "px";
    ARVORE.forEach(function(no) {
      const b = document.createElement("button"), vis = visualNo(no.id);
      b.className = "no f-" + vis.forma; b.dataset.id = no.id; b.dataset.forma = vis.forma;
      b.style.left = no.x * U + "px"; b.style.top = no.y * U + "px"; b.style.setProperty("--c", vis.cor);
      const anel = document.createElement("span"); anel.className = "anel"; b.appendChild(anel);
      const forma = document.createElement("span"); forma.className = "forma"; b.appendChild(forma);
      b.appendChild(Paineis.icone(no.ico));
      const pips = document.createElement("span"); pips.className = "pipsNo"; b.appendChild(pips);
      const lv = document.createElement("span"); lv.className = "lv"; b.appendChild(lv);
      b.addEventListener("click", function() {
        if (arrastou) return;   // foi arrastar o mapa, não tocar no nó
        Som.som("clique");
        if (sel === no.id && compra) comprar(no.id); else { sel = no.id; atualizar(); }
      });
      mapa.appendChild(b);
    });
    // nomes dos galhos, grandes e apagados, no mapa
    GALHOS_MAPA.forEach(function(gm) { const d = document.createElement("div"); d.className = "galhoNome"; d.textContent = t(gm[0]); d.style.left = gm[1] * U + "px"; d.style.top = gm[2] * U + "px"; mapa.appendChild(d); });
    arrastar();
    if (compra) { desafio = ""; montarDesafios(); }
    requestAnimationFrame(function() { centrar(NO[sel] || NO.nucleo); });
    const aoMudar = function() { limitarPos(); };
    const fim = function() { cx.classList.remove("larga"); window.removeEventListener("resize", aoMudar); };
    Paineis.aoFecharJanela(fim);
    window.addEventListener("resize", aoMudar);
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
      b.className = "no f-" + b.dataset.forma + (est ? " " + est : "") + (podeMais ? " pode" : "") + (sel === no.id ? " sel" : "");
      // nível: bolinhas (até 5 níveis) ou número
      const pips = b.querySelector(".pipsNo");
      if (no.max > 1 && no.max <= 5) { if (pips.childElementCount !== no.max) { pips.innerHTML = ""; for (let k = 0; k < no.max; k++) pips.appendChild(document.createElement("i")); } [].forEach.call(pips.children, function(p, k) { p.className = k < n ? "on" : ""; }); b.lastChild.textContent = ""; }
      else b.lastChild.textContent = no.max > 1 ? n + "/" + no.max : "";
    });
    // informação do nó escolhido
    const no = NO[sel], n = nivelNo(sel), max = n >= no.max, c = custoNo(sel, n), aberto = noAberto(sel);
    const info = el("arvInfo"); info.innerHTML = "";
    info.appendChild(Paineis.icone(no.ico));
    info.appendChild(Paineis.elem("div", "info", "<b>" + esc(nomeNo(sel)) + (no.max > 1 ? " <small>" + n + "/" + no.max + "</small>" : "") + "</b><span>" + esc(descNo(sel)) + "</span>" +
      (!aberto ? "<span>" + esc(t("precisa", no.liga.map(function(l) { return nomeNo(l); }).join(" / "))) + "</span>" : "")));
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
    const E = 3, W = Math.round(MAPA_L * U / E), H = Math.round(MAPA_A * U / E);
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    // placa: pontinhos e trilhas falsas de enfeite
    g.fillStyle = "#0d2522"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#123630"; for (let x = 4; x < W; x += 8) for (let y = 4; y < H; y += 8) g.fillRect(x, y, 1, 1);
    const rnd = semente(7);
    g.fillStyle = "#103029"; for (let k = 0; k < 70; k++) { const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H), l = 10 + Math.floor(rnd() * 30); if (rnd() < 0.5) g.fillRect(x, y, l, 1); else g.fillRect(x, y, 1, l); }
    const pos = function(no) { return { x: Math.round(no.x * U / E), y: Math.round(no.y * U / E) }; };
    ARVORE.forEach(function(no) {
      no.liga.forEach(function(l) {
        const a = pos(NO[l]), b = pos(no), acesa = nivelNo(no.id) > 0 && nivelNo(l) > 0, aberta = nivelNo(l) > 0;
        const cor = acesa ? visualNo(no.id).cor : aberta ? "#b0742a" : "#3d5a40", sombra = acesa ? "#1a1030" : "#0a1c18";   // trilha acesa na cor do galho
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
  // ---------- arrastar o mapa (dedo, mouse e rodinha) ----------
  function limitarPos() {
    const r = rede.getBoundingClientRect(), mw = MAPA_L * U, mh = MAPA_A * U;
    px = mw <= r.width ? (r.width - mw) / 2 : limitar(px, r.width - mw, 0);
    py = mh <= r.height ? (r.height - mh) / 2 : limitar(py, r.height - mh, 0);
    mapa.style.transform = "translate(" + Math.round(px) + "px," + Math.round(py) + "px)";
  }
  function centrar(no) { const r = rede.getBoundingClientRect(); px = r.width / 2 - no.x * U; py = r.height / 2 - no.y * U; limitarPos(); }
  function arrastar() {
    let ini = null;
    rede.addEventListener("pointerdown", function(e) { ini = { x: e.clientX, y: e.clientY, px: px, py: py, id: e.pointerId }; arrastou = false; });
    rede.addEventListener("pointermove", function(e) {
      if (!ini || e.pointerId !== ini.id) return;
      const dx = e.clientX - ini.x, dy = e.clientY - ini.y;
      if (!arrastou && Math.hypot(dx, dy) > 7) { arrastou = true; rede.classList.add("arrastando"); try { rede.setPointerCapture(e.pointerId); } catch (er) {} }
      if (arrastou) { px = ini.px + dx; py = ini.py + dy; limitarPos(); }
    });
    const solta = function() { ini = null; rede.classList.remove("arrastando"); setTimeout(function() { arrastou = false; }, 0); };
    rede.addEventListener("pointerup", solta); rede.addEventListener("pointercancel", solta);
    rede.addEventListener("wheel", function(e) { e.preventDefault(); px -= e.shiftKey ? e.deltaY : e.deltaX; py -= e.shiftKey ? 0 : e.deltaY; limitarPos(); }, { passive: false });
  }
  // desafios da próxima partida (opcional)
  function montarDesafios() {
    const box = el("arvDes"); if (!box) return;
    box.innerHTML = "<b>" + esc(t("des_titulo")) + "</b>";
    const fila = Paineis.elem("div", "linhaBtns");
    [""].concat(DESAFIOS).forEach(function(d) {
      const b = Paineis.elem("button", "btn" + (desafio === d ? (d ? " vermelho" : "") : " sem"), esc(t(d ? "des_" + d : "des_nenhum")));
      b.addEventListener("click", function() { desafio = d; Som.som("clique"); montarDesafios(); });
      fila.appendChild(b);
    });
    box.appendChild(fila);
    box.appendChild(Paineis.elem("span", "", esc(desafio ? t("des_" + desafio + "_d") + " " + t("des_premio") : t("des_explica"))));
  }
  function comecar() {
    Paineis.fecharJanela();
    Paineis.fechar();
    Jogo.novaPartida(desafio);
    if (desafio) Poki.medir("challenge", desafio, "start");
    Tela.montarVagas(); Tela.layout();
    salvar();
    Poki.intervalo();
  }
  return { abrir: abrir };
})();
