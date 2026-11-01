"use strict";

// =========================
// ABA OFICINA (v9): duas abinhas.
//   - ENCOMENDAS: os pedidos ativos (robô, quantidade, tempo, prêmio) com o botão Entregar.
//   - EQUIPAMENTOS: em cima as vagas do time (robô + peça equipada); embaixo as peças guardadas. Toque numa vaga para
//     escolher; toque numa peça para ver e equipar (na vaga escolhida) ou desmontar (vira pontos de habilidade).
// =========================
const OficinaTela = (function() {
  let sub = "encomendas", caixa = null, vaga = 0, item = 0, timer = 0;
  const E = function() { return Paineis.elem.apply(null, arguments); }, esc = function(s) { return Paineis.esc(s); };

  function montar(c) {
    caixa = c; c.innerHTML = "";
    const ab = E("div", "abinhas");
    [["encomendas", t("enc_titulo", Encomendas.lista().length)], ["equip", t("eq_titulo", save.equip.itens.length, Equip.MAX)]].forEach(function(o) {
      const b = E("button", "btn" + (sub === o[0] ? "" : " sem"), esc(o[1]));
      b.addEventListener("click", function() { sub = o[0]; item = 0; Som.som("clique"); montar(caixa); });
      ab.appendChild(b);
    });
    c.appendChild(ab);
    if (sub === "encomendas") encomendas(); else equipamentos();
    clearInterval(timer);
    timer = setInterval(function() { if (Paineis.aba !== "oficina" || !caixa || !caixa.isConnected) { clearInterval(timer); return; } if (sub === "encomendas") montar(caixa); }, 1000);
  }

  // ---------- encomendas ----------
  function encomendas() {
    caixa.appendChild(E("p", "titulo2", esc(t("enc_explica"))));
    const l = Encomendas.lista();
    if (!Encomendas.liberado()) { caixa.appendChild(E("p", "titulo2", esc(t("enc_bloq")))); return; }
    if (!l.length) { caixa.appendChild(E("p", "titulo2", esc(t("enc_vazio")))); return; }
    l.forEach(function(e) {
      const c = E("div", "card encomenda");
      c.appendChild(Pixel.img(Pixel.robo(e.n)));
      const resta = Math.max(0, Math.ceil((e.ate - Date.now()) / 1000)), tem = Encomendas.tenho(e.n);
      const pr = "<span class='premios'><i class='ico' data-ico='moeda'></i>" + esc(fmt(Encomendas.premio(e))) + " <i class='ico' data-ico='ph'></i>" + e.ph + (e.peca ? " <i class='ico' data-ico='presente'></i>" : "") + "</span>";
      c.appendChild(E("div", "info", "<b>" + esc(t("nivel", e.n)) + " × " + e.q + "</b><span>" + esc(t("enc_tem", Math.min(tem, e.q), e.q)) + " · ⏱ " + fmtTempo(resta) + "</span>" + pr));
      const b = E("button", "btn" + (Encomendas.pode(e) ? "" : " sem"), esc(t("enc_entregar")));
      b.addEventListener("click", function() {
        const r = Encomendas.entregar(e.id);
        if (!r) { Som.som("erro"); return; }
        Som.som("missao"); const rr = b.getBoundingClientRect(); Fx.moedas(rr.left + rr.width / 2, rr.top, 12); Fx.numero(rr.left, rr.top, "+" + fmt(r.moedas), "#ffcc33", 30);
        montar(caixa);
      });
      c.appendChild(b);
      caixa.appendChild(c);
    });
    Paineis.preencherIcones(caixa);
  }

  // ---------- equipamentos ----------
  function chip(it) {   // ícone da peça com moldura da cor da raridade
    const d = E("div", "peca r" + it.r);
    d.appendChild(Paineis.icone(EQUIP_TIPOS[it.t].ico));
    return d;
  }
  function equipamentos() {
    caixa.appendChild(E("p", "titulo2", esc(t("eq_explica"))));
    // vagas do time
    const fila = E("div", "vagasEquip");
    save.p.time.forEach(function(n, i) {
      const v = E("div", "vagaEq" + (vaga === i ? " sel" : ""));
      if (n) v.appendChild(Pixel.img(Pixel.robo(n))); else v.appendChild(E("span", "vazia", "+"));
      const id = save.equip.vagas[i], it = id ? Equip.porId(id) : null;
      if (it) { const c = chip(it); c.classList.add("noRobo"); v.appendChild(c); }
      v.addEventListener("click", function() {
        Som.som("clique");
        if (item && vaga !== i) { vaga = i; }
        else if (item) { Equip.equipar(item, i); Som.som("encaixe"); item = 0; }
        else { vaga = i; if (it) item = it.id; }
        montar(caixa);
      });
      fila.appendChild(v);
    });
    caixa.appendChild(fila);
    // detalhe da peça escolhida
    const it = item ? Equip.porId(item) : null;
    if (it) {
      const c = E("div", "card detalhePeca");
      c.appendChild(chip(it));
      const naVaga = save.equip.vagas.indexOf(it.id);
      c.appendChild(E("div", "info", "<b style='color:" + RARIDADE_COR[it.r] + "'>" + esc(Equip.nome(it)) + "</b><span>" + esc(Equip.textoBonus(it)) + (naVaga >= 0 ? " · " + esc(t("eq_na_vaga", naVaga + 1)) : "") + "</span>"));
      const bts = E("div", "linhaBtns");
      if (naVaga === vaga) {
        const b = E("button", "btn sem", esc(t("eq_tirar"))); b.addEventListener("click", function() { Equip.tirar(vaga); item = 0; Som.som("clique"); montar(caixa); }); bts.appendChild(b);
      } else {
        const b = E("button", "btn", esc(t("eq_equipar", vaga + 1))); b.addEventListener("click", function() { Equip.equipar(it.id, vaga); item = 0; Som.som("encaixe"); montar(caixa); }); bts.appendChild(b);
      }
      const d = E("button", "btn vermelho", esc(t("eq_desmontar", Equip.phDesmontar(it))));
      d.addEventListener("click", function() { const ph = Equip.desmontar(it.id); item = 0; Som.som("compra"); const r = d.getBoundingClientRect(); Fx.numero(r.left + r.width / 2, r.top, "+" + ph + " PH", "#7cf0ff", 28); montar(caixa); });
      bts.appendChild(d);
      c.appendChild(bts);
      caixa.appendChild(c);
    }
    // inventário (melhores primeiro)
    const inv = save.equip.itens.slice().sort(function(a, b) { return b.r - a.r || a.t.localeCompare(b.t); });
    if (!inv.length) caixa.appendChild(E("p", "titulo2", esc(t("eq_vazio"))));
    else desenharInventario(inv);
    // legenda dos traços dos robôs
    caixa.appendChild(E("div", "tierTopo", esc(t("tr_titulo"))));
    const leg = E("div", "legendaTr");
    Object.keys(TRACOS).forEach(function(id) {
      const l = E("div", "", "<b style='color:" + TRACOS[id].cor + "'>" + esc(t("tr_" + id)) + "</b> " + esc(t("tr_" + id + "_d")));
      l.prepend(Paineis.icone(TRACOS[id].ico)); leg.appendChild(l);
    });
    caixa.appendChild(leg);
  }
  function desenharInventario(inv) {
    const g = E("div", "inventario");
    inv.forEach(function(x) {
      const c = chip(x);
      if (save.equip.vagas.indexOf(x.id) >= 0) c.classList.add("usada");
      if (item === x.id) c.classList.add("sel");
      c.addEventListener("click", function() { item = item === x.id ? 0 : x.id; Som.som("clique"); montar(caixa); });
      g.appendChild(c);
    });
    caixa.appendChild(g);
  }
  return { montar: montar, sair: function() { clearInterval(timer); } };
})();
