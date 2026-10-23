"use strict";

// =========================
// PERSONALIZAÇÃO (v19): tela nova com prévia grande animada, abas por categoria e EQUIPAR/COMPRAR.
// Tocar num item PROVA na prévia (mesmo sem ter); o botão grande diz o que fazer: equipar, comprar, ou como ganhar
// (baú, nível, conquista, desafio da semana). Sair da tela volta a prévia para o que está equipado.
// Dados: js/jogo/dados/skins.js; regras (ter, comprar, equipar): js/jogo/progresso/progresso.js; desenho: ArteSkins.
// estado "skins" (o loop do main.js chama desenharPreviaSkin enquanto a tela está aberta).
// =========================

let abaVisual = "chapeu";        // abre no chapéu: é o que mais aparece na luta
let itemVisual = null;           // item em foco (provando)

function abrirVisual(aba) {
  estado = "skins";
  if (aba) abaVisual = aba;
  itemVisual = null;
  Progresso.preparar();
  montarAbasVisual();
  montarVisual();
  mostrarTela("telaVisual");
  Eventos.botao("customize");
}
// compatibilidade (o resto do código chamava abrirSkins)
function abrirSkins() { abrirVisual(); }

// visual que a prévia mostra: o equipado com o item em foco por cima
function visualProva() {
  const v = Object.assign({}, VISUAL_PADRAO, save.visual);
  if (itemVisual !== null) {
    if (itemVisual === "") v[abaVisual] = "";
    else if (SKIN[itemVisual]) v[SKIN[itemVisual].tipo] = itemVisual;
  }
  return v;
}

function montarAbasVisual() {
  const abas = el("visualAbas");
  abas.innerHTML = "";
  CATEGORIAS_VISUAL.forEach(function(c) {
    const b = document.createElement("button");
    b.className = "vAba" + (c === abaVisual ? " ativo" : "");
    b.innerHTML = Icone.html(ICONE_CATEGORIA[c]) + "<span>" + escHtml(t("cat_" + c)) + "</span>";
    b.addEventListener("click", function() { som("clique"); abaVisual = c; itemVisual = null; montarAbasVisual(); montarVisual(); });
    abas.appendChild(b);
  });
}

// como se ganha um item que a pessoa ainda não tem (texto curto + ícone)
function comoGanhar(s) {
  if (s.preco) return { icone: "moeda", texto: String(s.preco) };
  if (s.bau) return { icone: "bau", texto: t("so_bau") };
  if (s.nivel) return { icone: "estrela", texto: t("nivel_n_curto", s.nivel) };
  if (s.conquista) return { icone: "trofeu", texto: t("co_" + s.conquista) };
  if (s.semanal) return { icone: "estrela", texto: t("so_semanal") };
  return { icone: "cadeado", texto: "" };
}

function montarVisual() {
  const grade = el("visualGrade");
  grade.innerHTML = "";
  const lista = (VISUAL_OPCIONAL[abaVisual] ? [null] : []).concat(SKINS_POR_TIPO[abaVisual]);
  const v = save.visual;
  lista.forEach(function(s) {
    const id = s ? s.id : "";
    const tem = Progresso.temSkin(id), usando = (v[abaVisual] || "") === id;
    const c = document.createElement("button");
    c.className = "vItem r" + (s ? s.raridade : 1) + (usando ? " usando" : "") + (tem ? "" : " bloqueado") + (itemVisual === id ? " foco" : "");
    const cv = document.createElement("canvas"); cv.width = cv.height = 120;
    const g = cv.getContext("2d");
    if (s) ArteSkins.iconeItem(g, id, 60, 60, 120, v, 0);
    else if (typeof Icone !== "undefined") { g.globalAlpha = 0.6; Icone.desenhar(g, "fechar", 60, 60, 54); g.globalAlpha = 1; }
    c.appendChild(cv);
    const nome = document.createElement("div"); nome.className = "vItemNome"; nome.textContent = s ? t("sk_" + id) : t("sk_nenhum"); c.appendChild(nome);
    const st = document.createElement("div"); st.className = "vItemStatus";
    if (usando) st.innerHTML = Icone.html("ok") + " " + escHtml(t("equipado"));
    else if (tem) st.textContent = "";
    else { const cg = comoGanhar(s); st.innerHTML = Icone.html(cg.icone) + " " + escHtml(cg.texto); }
    c.appendChild(st);
    c.addEventListener("click", function() {
      som("clique");
      // tocar de novo no que já está em foco e já é seu: equipa
      if (itemVisual === id && tem && !usando) { acaoVisual(); return; }
      itemVisual = id;
      if (tem && !usando) acaoVisual();    // o que já é seu equipa na hora (um toque só)
      else montarVisual();
    });
    grade.appendChild(c);
  });
  atualizarAcaoVisual();
  atualizarMenuProgresso();
}

// botão grande embaixo da prévia: equipar / equipado / comprar / como ganhar
function atualizarAcaoVisual() {
  const b = el("btnVisualAcao"), nome = el("visualNome"), como = el("visualComo");
  const id = itemVisual === null ? (save.visual[abaVisual] || "") : itemVisual;
  const s = id ? SKIN[id] : null;
  nome.innerHTML = s ? "<span class='vRar r" + s.raridade + "'>" + escHtml(t("rar_" + s.raridade)) + "</span> " + escHtml(t("sk_" + id)) : escHtml(t("sk_nenhum"));
  como.textContent = "";
  b.className = "vBotao";
  b.disabled = false;
  if (Progresso.temSkin(id)) {
    const usando = (save.visual[abaVisual] || "") === id;
    b.innerHTML = usando ? Icone.html("ok") + " " + escHtml(t("equipado")) : escHtml(t("equipar"));
    b.disabled = usando;
    b.classList.toggle("pronto", !usando);
  } else if (s && s.preco) {
    b.innerHTML = escHtml(t("comprar")) + " " + moedasHtml(s.preco);
    b.classList.add(save.moedas >= s.preco ? "pode" : "falta");
    if (save.moedas < s.preco) como.textContent = t("faltam_moedas", s.preco - save.moedas);
  } else if (s) {
    const cg = comoGanhar(s);
    b.innerHTML = Icone.html("cadeado") + " " + escHtml(s.bau ? t("so_bau_longo") : s.nivel ? t("nivel_libera", s.nivel) : s.conquista ? t("conquista_libera") : t("so_semanal"));
    b.disabled = true;
    if (s.conquista) como.textContent = t("co_" + s.conquista) + ": " + t("cod_" + s.conquista, (CONQUISTAS.find(function(c) { return c.id === s.conquista; }) || {}).meta);
    else if (!s.bau && !s.nivel) como.textContent = cg.texto;
  }
}

function acaoVisual() {
  const id = itemVisual === null ? (save.visual[abaVisual] || "") : itemVisual;
  const s = id ? SKIN[id] : null;
  if (Progresso.temSkin(id)) {
    if (Progresso.equipar(id, abaVisual)) { som("pegar"); Poki.medir("skin", id || ("none-" + abaVisual), "equip"); }
  } else if (s && s.preco) {
    if (save.moedas >= s.preco && Progresso.comprarSkin(id)) { Progresso.equipar(id); som("carta"); reanimar(el("previaVisual"), "comprou"); }
    else { som("acerto"); reanimar(el("btnVisualAcao"), "sem"); return; }
  } else return;
  itemVisual = null;
  montarVisual();
}

// prévia grande (chamada pelo loop do main.js enquanto estado === "skins")
function desenharPreviaSkin(tempo) {
  const cv = el("previaVisual");
  if (!cv || !el("telaVisual").classList.contains("aberta")) return;
  const g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  ArteSkins.previa(g, cv.width, cv.height, visualProva(), tempo, abaVisual);
}

// prêmio da semana (missões): miniatura do item
function desenharMiniSkin(cv, id) {
  const g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  if (typeof ArteSkins !== "undefined" && SKIN[id]) ArteSkins.iconeItem(g, id, cv.width / 2, cv.height / 2, cv.width, save.visual, 0);
}

el("btnVisualAcao").addEventListener("click", function() { acaoVisual(); this.blur(); });
