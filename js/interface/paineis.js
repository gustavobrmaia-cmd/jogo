"use strict";

// =========================
// PAINÉIS DAS ABAS (cobrem só a grade: o botão vermelho continua apertável enquanto você olha os upgrades)
// Upgrades (+ o card do renascimento), Batalha (batalha_tela.js), Compêndio e Configurações.
// Também: janela (modal), faixa de descoberta e os ganhos offline.
// =========================
const Paineis = (function() {
  let aba = null, sub = "robos";
  const corpo = el("painelCorpo");

  function icone(nome) { const i = document.createElement("i"); i.className = "ico"; i.style.backgroundImage = "url(" + Pixel.url(Pixel.icone(nome)) + ")"; return i; }
  function preencherIcones(raiz) { (raiz || document).querySelectorAll("[data-ico]").forEach(function(e) { e.style.backgroundImage = "url(" + Pixel.url(Pixel.icone(e.dataset.ico)) + ")"; }); }
  function elem(tag, classe, html) { const e = document.createElement(tag); if (classe) e.className = classe; if (html !== undefined) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function(c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- abrir / fechar ----------
  function abrir(qual) {
    if (aba === qual) { fechar(); return; }
    aba = qual;
    document.querySelectorAll(".aba").forEach(function(b) { b.classList.toggle("ativa", b.dataset.aba === qual); });
    el("painel").classList.remove("escondido");
    el("painelTitulo").textContent = t("aba_" + qual);
    montar();
    Som.som("clique");
    Poki.medir("tab", qual, "visible");
  }
  function fechar() {
    if (aba === "batalha" && typeof BatalhaTela !== "undefined") BatalhaTela.sair();
    aba = null;
    document.querySelectorAll(".aba").forEach(function(b) { b.classList.remove("ativa"); });
    el("painel").classList.add("escondido");
  }
  document.querySelectorAll(".aba").forEach(function(b) { b.addEventListener("click", function() { abrir(b.dataset.aba); }); });
  el("btnFechar").addEventListener("click", function() { Som.som("clique"); fechar(); });
  function montar() {
    corpo.innerHTML = "";
    corpo.scrollTop = 0;
    if (aba === "upgrades") montarUpgrades();
    else if (aba === "batalha") BatalhaTela.montar(corpo);
    else if (aba === "compendio") montarCompendio();
    else if (aba === "config") montarConfig();
  }

  // ---------- upgrades ----------
  const linhasUp = {};
  function textoEfeito(id, n) {
    switch (id) {
      case "dedo": return t("up_dedo_d", fmt(1 + 2 * n), fmt(3 + 2 * n));
      case "motor": return t("up_motor_d", Math.round(n * 12), Math.round((n + 1) * 12));
      case "fabrica": return t("up_fabrica_d", 1 + n, 2 + n);
      case "esteira": return t("up_esteira_d", (15 * Math.pow(0.82, n)).toFixed(1), (15 * Math.pow(0.82, n + 1)).toFixed(1));
      case "linha": return t("up_linha_d", Math.round((1 - Math.pow(0.88, n)) * 100), Math.round((1 - Math.pow(0.88, n + 1)) * 100));
      case "moedas": return t("up_moedas_d", fmt(Math.pow(1.3, n)), fmt(Math.pow(1.3, n + 1)));
      case "blindagem": return t("up_blindagem_d", Math.round(n * 15), Math.round((n + 1) * 15));
    }
    return "";
  }
  function montarUpgrades() {
    // renascimento no topo
    const r = elem("div", "card renascer");
    r.appendChild(icone("renascer"));
    const ri = elem("div", "info"); r.appendChild(ri);
    const rb = elem("button", "btn roxo");
    r.appendChild(rb);
    corpo.appendChild(r);
    linhasUp._renascer = { info: ri, btn: rb };
    rb.addEventListener("click", function() { if (Jogo.podeRenascer()) confirmarRenascer(); });
    const ver = elem("button", "btn", "");
    ver.appendChild(icone("ph")); ver.appendChild(document.createTextNode(t("ver_arvore")));
    ver.addEventListener("click", function() { Som.som("clique"); ArvoreTela.abrir(false); });
    const linhaVer = elem("div", "linhaBtns"); linhaVer.appendChild(ver); corpo.appendChild(linhaVer);
    UPGRADES.forEach(function(u) {
      const c = elem("div", "card");
      c.appendChild(icone(u.icone));
      const info = elem("div", "info"); c.appendChild(info);
      const b = elem("button", "btn"); c.appendChild(b);
      b.addEventListener("click", function() {
        if (Jogo.comprarUpgrade(u.id)) { Som.som("compra"); const rr = b.getBoundingClientRect(); Fx.faiscas(rr.left + rr.width / 2, rr.top, "#3ccf6e", 10); salvar(); }
        else Som.som("erro");
        atualizarUpgrades();
      });
      corpo.appendChild(c);
      linhasUp[u.id] = { info: info, btn: b };
    });
    atualizarUpgrades();
  }
  function atualizarUpgrades() {
    if (aba !== "upgrades") return;
    const r = linhasUp._renascer;
    if (r) {
      const pode = Jogo.podeRenascer(), ganho = phRenascer(save.p.maxTier);
      const html = "<b>" + esc(t("renascer")) + "</b><span>" + esc(pode ? t("renascer_d", ganho) : t("renascer_bloq", CONFIG.tierRenascer, NOMES_ROBOS[CONFIG.tierRenascer - 1])) + "</span>" +
        (pode ? "" : "<div class='barraP'><i style='width:" + Math.round(save.p.maxTier / CONFIG.tierRenascer * 100) + "%'></i></div>");
      if (r.info._h !== html) { r.info._h = html; r.info.innerHTML = html; }
      r.btn.textContent = t("renascer"); r.btn.disabled = !pode;
    }
    UPGRADES.forEach(function(u) {
      const l = linhasUp[u.id]; if (!l) return;
      const n = nivelUp(u.id), max = n >= u.max, c = max ? 0 : custoUpgrade(u.id, n);
      const html = "<b>" + esc(t("up_" + u.id)) + " <small>" + esc(t("nivel", n)) + "</small></b><span>" + esc(textoEfeito(u.id, n)) + "</span>";
      if (l.info._h !== html) { l.info._h = html; l.info.innerHTML = html; }
      const bt = max ? t("max") : fmt(c);
      if (l.btn._t !== bt) { l.btn._t = bt; l.btn.innerHTML = ""; if (!max) l.btn.appendChild(icone("moeda")); l.btn.appendChild(document.createTextNode(bt)); }
      const sem = max || save.p.moedas < c;
      l.btn.classList.toggle("sem", sem); l.btn.disabled = max;
    });
  }
  // bolinha vermelha na aba Upgrades: dá para comprar algo (ou renascer)
  function pontos() {
    const pode = UPGRADES.some(function(u) { const n = nivelUp(u.id); return n < u.max && save.p.moedas >= custoUpgrade(u.id, n); });
    el("pontoUp").classList.toggle("on", (pode && save.tutorial >= 4) || (Jogo.podeRenascer() && phRenascer(save.p.maxTier) >= 3));
  }

  // ---------- renascer ----------
  function confirmarRenascer() {
    const ganho = phRenascer(save.p.maxTier);
    janela("<h2>" + esc(t("renascer")) + "?</h2><p>" + esc(t("renascer_conf", ganho)) + "</p><p class='titulo2'>" + esc(t("renascer_mantem")) + "</p>",
      [{ texto: t("renascer"), classe: "roxo grande", acao: function() {
        fecharJanela();
        Jogo.renascer();
        Som.som("renascer");
        ArvoreTela.abrir(true);
      } }, { texto: t("cancelar"), classe: "sem", acao: fecharJanela }]);
  }

  // ---------- compêndio ----------
  function montarCompendio() {
    const ab = elem("div", "abinhas");
    [["robos", t("comp_robos", save.robosVistos.length, MAX_TIER)], ["monstros", t("comp_monstros", save.monstrosVistos.length, N_MONSTROS)]].forEach(function(o) {
      const b = elem("button", "btn" + (sub === o[0] ? "" : " sem"), esc(o[1]));
      b.addEventListener("click", function() { sub = o[0]; Som.som("clique"); montar(); });
      ab.appendChild(b);
    });
    corpo.appendChild(ab);
    corpo.appendChild(elem("p", "titulo2", esc(t("comp_explica"))));
    const gal = elem("div", "galeria");
    if (sub === "robos") for (let n = 1; n <= MAX_TIER; n++) {
      const visto = save.robosVistos.indexOf(n) >= 0, it = elem("div", "item");
      it.appendChild(Pixel.img(visto ? Pixel.robo(n) : Pixel.sombra(Pixel.robo(n))));
      it.appendChild(elem("b", "", visto ? esc(NOMES_ROBOS[n - 1]) : "???"));
      it.appendChild(elem("small", "", esc(t("nivel", n)) + " · +" + phRobo(n) + " PH"));
      gal.appendChild(it);
    } else HORDAS.forEach(function(h) { h.monstros.forEach(function(m) {
      const visto = save.monstrosVistos.indexOf(m.id) >= 0, it = elem("div", "item");
      it.appendChild(Pixel.img(visto ? Pixel.monstro(m.id) : Pixel.sombra(Pixel.monstro(m.id))));
      it.appendChild(elem("b", "", visto ? esc(m.nome) : "???"));
      it.appendChild(elem("small", "", esc(t("z_" + h.id))));
      gal.appendChild(it);
    }); });
    corpo.appendChild(gal);
    el("pontoComp").classList.remove("on");
  }

  // ---------- configurações ----------
  function montarConfig() {
    function chave(rotulo, valor, mudar) {
      const c = elem("div", "card"), info = elem("div", "info", "<b>" + esc(rotulo) + "</b>"), b = elem("button", "btn" + (valor ? "" : " sem"), esc(valor ? t("ligado") : t("desligado")));
      b.addEventListener("click", function() { mudar(); salvar(); Som.som("clique"); montar(); });
      c.appendChild(info); c.appendChild(b); corpo.appendChild(c);
    }
    chave(t("cfg_som"), !save.mudo, function() { save.mudo = !save.mudo; });
    chave(t("cfg_vibrar"), save.vibrar, function() { save.vibrar = !save.vibrar; });
    const ci = elem("div", "card"); ci.appendChild(elem("div", "info", "<b>" + esc(t("cfg_idioma")) + "</b>"));
    const sel = elem("select", "btn");
    IDIOMAS.forEach(function(i) { const o = document.createElement("option"); o.value = i.id; o.textContent = i.nome; if (i.id === IDIOMA) o.selected = true; sel.appendChild(o); });
    sel.addEventListener("change", function() {
      save.idioma = sel.value; salvar();
      carregarIdioma(sel.value).then(function() { traduzirDom(); montar(); el("painelTitulo").textContent = t("aba_config"); });
    });
    ci.appendChild(sel); corpo.appendChild(ci);
    const st = save.stats;
    corpo.appendChild(elem("p", "titulo2", esc(t("cfg_stats", fmt(st.toques), st.juncoes, st.vitorias, save.renascimentos))));
    const ap = elem("button", "btn vermelho", esc(t("cfg_apagar")));
    ap.addEventListener("click", function() {
      janela("<h2>" + esc(t("cfg_apagar")) + "?</h2><p>" + esc(t("cfg_apagar_conf")) + "</p>", [
        { texto: t("cfg_apagar"), classe: "vermelho", acao: function() { try { localStorage.removeItem(CONFIG.chaveSave); } catch (e) {} location.reload(); } },
        { texto: t("cancelar"), classe: "sem", acao: fecharJanela }]);
    });
    const l = elem("div", "linhaBtns"); l.appendChild(ap); corpo.appendChild(l);
  }

  // ---------- janela ----------
  function janela(html, botoes) {
    const cx = el("modalCaixa");
    cx.innerHTML = html;
    const l = elem("div", "linhaBtns");
    (botoes || []).forEach(function(b) {
      const e = elem("button", "btn " + (b.classe || ""), "");
      if (b.icone) e.appendChild(icone(b.icone));
      e.appendChild(document.createTextNode(b.texto));
      e.addEventListener("click", function() { Som.som("clique"); b.acao(); });
      l.appendChild(e);
    });
    cx.appendChild(l);
    preencherIcones(cx);
    el("modal").classList.remove("escondido");
    return cx;
  }
  function fecharJanela() { el("modal").classList.add("escondido"); }
  function janelaAberta() { return !el("modal").classList.contains("escondido"); }

  // ---------- faixa (descobertas e avisos) ----------
  let filaFaixa = [], faixaAte = 0;
  function faixa(sprite, titulo, texto) {
    filaFaixa.push({ sprite: sprite, titulo: titulo, texto: texto });
  }
  function passoFaixa() {
    const f = el("faixa"), agora = performance.now();
    if (agora < faixaAte) return;
    if (!filaFaixa.length) { f.classList.add("escondido"); return; }
    const a = filaFaixa.shift();
    f.innerHTML = "";
    if (a.sprite) f.appendChild(Pixel.img(a.sprite));
    const d = elem("div", "", "<b>" + esc(a.titulo) + "</b><span>" + esc(a.texto || "") + "</span>");
    f.appendChild(d);
    f.classList.remove("escondido"); void f.offsetWidth;
    faixaAte = agora + 2600;
  }
  Jogo.ao("descobriu", function(d) {
    const sprite = d.tipo === "robo" ? Pixel.robo(d.id) : Pixel.monstro(d.id);
    const nome = d.tipo === "robo" ? NOMES_ROBOS[d.id - 1] : NOMES_MONSTROS[d.id];
    faixa(sprite, t(d.tipo === "robo" ? "novo_robo" : "novo_monstro", nome), t("ganhou_ph", d.ph, fmt(d.moedas)));
    Som.som("descobrir");
    if (aba !== "compendio") el("pontoComp").classList.add("on");
    salvar();
  });

  // ---------- ganhos offline ----------
  function mostrarOffline(g) {
    janela("<h2>" + esc(t("off_titulo")) + "</h2><p>" + esc(t("off_tempo", fmtTempo(g.seg))) + "</p><p style='font-size:30px;color:var(--ouro)'>+" + fmt(g.valor) + "</p>", [
      { texto: t("pegar"), classe: "grande", acao: function() { save.p.moedas += g.valor; Som.som("compra"); fecharJanela(); salvar(); } }
    ].concat(Poki.premiadoDisponivel() ? [{ texto: t("x2_anuncio"), icone: "video", classe: "roxo grande", acao: function() {
      Poki.premiado("medium").then(function(ok) { save.p.moedas += g.valor * (ok ? 2 : 1); Som.som("compra"); fecharJanela(); salvar(); });
    } }] : []));
  }

  // escolhendo robôs para a batalha: a grade não arrasta
  function escolhendo() { return aba === "batalha" && BatalhaTela.escolhendo(); }

  return { abrir: abrir, fechar: fechar, atualizarUpgrades: atualizarUpgrades, pontos: pontos, janela: janela, fecharJanela: fecharJanela,
    janelaAberta: janelaAberta, faixa: faixa, passoFaixa: passoFaixa, mostrarOffline: mostrarOffline, preencherIcones: preencherIcones,
    icone: icone, elem: elem, esc: esc, escolhendo: escolhendo, get aba() { return aba; } };
})();
