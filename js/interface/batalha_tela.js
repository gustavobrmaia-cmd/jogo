"use strict";

// =========================
// ABA BATALHA: lista das hordas -> escolher até 10 robôs (ou "Melhores") -> a luta abre em tela cheia na fábrica
// (cena_batalha.js: os robôs lutam sozinhos e você lança as habilidades) -> resultado. Ao voltar: intervalo comercial.
// =========================
const BatalhaTela = (function() {
  let modo = "lista", horda = 0, marcados = [], caixa = null;
  const E = function() { return Paineis.elem.apply(null, arguments); }, esc = function(s) { return Paineis.esc(s); };

  function montar(c) {
    caixa = c;
    c.innerHTML = "";
    if (modo === "lista") lista();
    else escolha();
  }
  function remontar() { if (Paineis.aba === "batalha" && caixa) montar(caixa); }

  // ---------- lista ----------
  function lista() {
    caixa.appendChild(E("p", "titulo2", esc(t("bat_explica"))));
    HORDAS.forEach(function(h) {
      const aberta = Batalha.hordaAberta(h.id), vencida = h.id < save.hordasVencidas;
      const c = E("div", "card horda" + (aberta ? "" : " fechada"));
      const mini = E("div", "mini");
      h.monstros.forEach(function(m) { const vis = save.monstrosVistos.indexOf(m.id) >= 0; mini.appendChild(Pixel.img(vis ? Pixel.monstro(m.id) : Pixel.sombra(Pixel.monstro(m.id)))); });
      c.appendChild(mini);
      const info = E("div", "info", "<b>" + esc(t("z_" + h.id)) + (vencida ? " ✓" : "") + "</b><span>" +
        esc(aberta ? t("bat_premio", fmt(Math.round(h.premio * (1 + 0.5 * nivelNo("saque")) * Jogo.multMoedas()))) : t("bat_bloq", t("z_" + (h.id - 1)))) + "</span>");
      c.appendChild(info);
      if (aberta) {
        const b = E("button", "btn", esc(t("bat_ir")));
        c.appendChild(b);
        c.addEventListener("click", function() { horda = h.id; marcados = melhores(); modo = "escolha"; Som.som("clique"); remontar(); });
      } else c.appendChild(Paineis.icone("cadeado"));
      caixa.appendChild(c);
    });
  }

  // ---------- escolha ----------
  function todos() {   // robôs da grade e do time, do maior para o menor
    const l = [];
    ["time", "grade"].forEach(function(lista) { save.p[lista].forEach(function(n, i) { if (n) l.push({ lista: lista, i: i, n: n }); }); });
    return l.sort(function(a, b) { return b.n - a.n; });
  }
  function chave(r) { return r.lista + r.i; }
  function melhores() { return todos().slice(0, Batalha.vagas()).map(chave); }
  function escolha() {
    const l = todos(), vagas = Batalha.vagas();
    marcados = marcados.filter(function(k) { return l.some(function(r) { return chave(r) === k; }); });
    const sel = l.filter(function(r) { return marcados.indexOf(chave(r)) >= 0; }).map(function(r) { return r.n; });
    const pr = Batalha.poderRobos(sel), ph = Batalha.poderHorda(horda), forte = pr >= ph;
    caixa.appendChild(E("p", "", "<b>" + esc(t("z_" + horda)) + "</b> · " + esc(t("bat_escolha", marcados.length, vagas))));
    caixa.appendChild(E("p", "titulo2", "<span style='color:" + (forte ? "var(--verde)" : "var(--vermelho)") + "'>" + esc(t("bat_poder", fmt(pr), fmt(ph))) + "</span>"));
    const bts = E("div", "linhaBtns");
    const bm = E("button", "btn sem", esc(t("bat_melhores")));
    bm.addEventListener("click", function() { marcados = melhores(); Som.som("clique"); remontar(); });
    const bl = E("button", "btn grande" + (marcados.length ? "" : " sem"), esc(t("bat_lutar")));
    bl.addEventListener("click", function() { if (!marcados.length) return; lutar(sel); });
    const bv = E("button", "btn sem", esc(t("voltar")));
    bv.addEventListener("click", function() { modo = "lista"; Som.som("clique"); remontar(); });
    bts.appendChild(bv); bts.appendChild(bm); bts.appendChild(bl);
    caixa.appendChild(bts);
    if (!l.length) { caixa.appendChild(E("p", "titulo2", esc(t("bat_sem_robos")))); return; }
    const gal = E("div", "galeria");
    l.forEach(function(r) {
      const k = chave(r), it = E("div", "item" + (marcados.indexOf(k) >= 0 ? " marcado" : ""));
      it.appendChild(Pixel.img(Pixel.robo(r.n)));
      it.appendChild(E("small", "", esc(t("nivel", r.n))));
      it.addEventListener("click", function() {
        const j = marcados.indexOf(k);
        if (j >= 0) marcados.splice(j, 1); else if (marcados.length < vagas) marcados.push(k);
        Som.som("clique"); remontar();
      });
      gal.appendChild(it);
    });
    caixa.appendChild(gal);
  }

  // ---------- luta: abre a cena da fábrica (cena_batalha.js) ----------
  function lutar(tiers) {
    Batalha.iniciar(horda, tiers);
    modo = "lista";
    CenaBatalha.abrir();
  }
  function voltou() { modo = "lista"; remontar(); }
  function sair() { modo = "lista"; }

  return { montar: montar, sair: sair, voltou: voltou, escolhendo: function() { return modo === "escolha"; } };
})();
