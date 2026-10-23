"use strict";

// =========================
// LOJA DE ARMAS (v19): compra armas com moedas e escolhe a ARMA INICIAL (começa toda rodada com ela, contra a
// máquina e no 2 jogadores; quem não tem arma inicial ganha a da roleta na 1ª rodada).
// Só aparece depois que o novato passou pelo começo (Progresso.lojaLiberada: rival 5 vencido ou já viu a tela das
// melhorias — o fluxo direto entre os rivais 1–5 não pode ganhar uma parada nova).
// Preços: Progresso.PRECO_ARMA (por raridade). Abas por raridade; o destaque mostra a bolinha da pessoa segurando a
// arma, com barras de dano, munição e rapidez.
// estado "loja": esta tela anima a prévia com o próprio requestAnimationFrame (o main.js não sabe dela).
// Eventos: shop/open (visible), shop/buy-<id> e shop/start-<id> (interact, progresso.js).
// =========================

let abaLoja = 1;
let armaLoja = null;

// botão "Loja" no menu (criado aqui para não mexer no HTML das telas que já existem)
(function() {
  const poder = document.querySelector('#telaMenu [data-acao="poder"]');
  const linha = poder ? poder.parentNode : document.querySelector("#telaMenu .botoes");
  if (!linha) return;
  const b = document.createElement("button");
  b.id = "btnLoja"; b.dataset.acao = "loja"; b.className = "botaoLoja escondido";
  b.innerHTML = "<span class='ic'>" + Icone.html("arma") + "</span> <span data-t='loja'></span>";
  if (poder && poder.nextSibling) linha.insertBefore(b, poder.nextSibling); else linha.appendChild(b);
})();

function armasDaLoja(r) {
  // v19: só armas que podem abrir a rodada (sem mina, ataque do céu e torreta)
  return ARMAS.filter(function(a) { return a.raridade === r && a.tipo !== "mina" && a.tipo !== "ceu" && a.tipo !== "torreta"; });
}

function abrirLoja() {
  estado = "loja";
  Progresso.preparar();
  if (!armaLoja || !ARMA[armaLoja]) armaLoja = save.armaInicial || armasDaLoja(abaLoja)[0].id;
  abaLoja = ARMA[armaLoja].raridade || 1;
  montarLoja();
  mostrarTela("telaLoja");
  Poki.medir("shop", "open", "visible");
  if (!loopLoja) { loopLoja = true; requestAnimationFrame(animarLoja); }   // v19.9: um loop só (abrir 2x dobrava)
}
let loopLoja = false;

function montarLoja() {
  const abas = el("lojaAbas");
  abas.innerHTML = "";
  [1, 2, 3].forEach(function(r) {
    const b = document.createElement("button");
    b.className = "vAba lAba r" + (r + 1) + (r === abaLoja ? " ativo" : "");
    b.innerHTML = "<span>" + escHtml(t("rar_armas_" + r)) + "</span> " + moedasHtml(Progresso.PRECO_ARMA[r]);
    b.addEventListener("click", function() { som("clique"); abaLoja = r; armaLoja = armasDaLoja(r)[0].id; montarLoja(); });
    abas.appendChild(b);
  });
  const grade = el("lojaGrade");
  grade.innerHTML = "";
  armasDaLoja(abaLoja).forEach(function(a) {
    const tem = Progresso.temArma(a.id), inicial = save.armaInicial === a.id;
    const c = document.createElement("button");
    c.className = "vItem lItem r" + (a.raridade + 1) + (inicial ? " usando" : "") + (tem ? "" : " bloqueado") + (armaLoja === a.id ? " foco" : "");
    const cv = document.createElement("canvas"); cv.width = cv.height = 110;
    if (typeof ArteArmas !== "undefined" && ArteArmas.icone) ArteArmas.icone(cv.getContext("2d"), a.id, 55, 55, 92);
    c.appendChild(cv);
    const nome = document.createElement("div"); nome.className = "vItemNome"; nome.textContent = t("a_" + a.id); c.appendChild(nome);
    const st = document.createElement("div"); st.className = "vItemStatus";
    st.innerHTML = inicial ? Icone.html("ok") + " " + escHtml(t("arma_inicial_selo")) : tem ? escHtml(t("tem")) : moedasHtml(Progresso.precoArma(a.id));
    c.appendChild(st);
    c.addEventListener("click", function() { som("clique"); armaLoja = a.id; montarLoja(); });
    grade.appendChild(c);
  });
  atualizarDestaqueLoja();
  atualizarMenuProgresso();
}

function atualizarDestaqueLoja() {
  const a = ARMA[armaLoja], tem = Progresso.temArma(a.id), inicial = save.armaInicial === a.id, p = Progresso.precoArma(a.id);
  el("lojaNome").innerHTML = "<span class='vRar r" + (a.raridade + 1) + "'>" + escHtml(t("rar_arma_" + a.raridade)) + "</span> " + escHtml(t("a_" + a.id));
  // barras: dano por segundo, munição e rapidez (normalizadas para as 50 armas)
  const dps = (a.dano || 0) * (a.qtd || 1) / Math.max(0.05, a.cadencia || 0.5), mun = a.municao === Infinity ? 200 : a.municao * (a.cadencia || 0.5);
  const barra = function(nome, v) { return "<div class='lBarra'><span>" + escHtml(t(nome)) + "</span><i><b style='width:" + Math.round(Math.max(0.08, Math.min(1, v)) * 100) + "%'></b></i></div>"; };
  el("lojaInfo").innerHTML = barra("st_dano", dps / 60) + barra("st_municao", mun / 12) + barra("st_rapidez", 0.25 / Math.max(0.035, a.cadencia || 0.5));
  const b = el("btnLojaAcao");
  b.className = "vBotao"; b.disabled = false;
  if (inicial) { b.innerHTML = Icone.html("ok") + " " + escHtml(t("arma_inicial_usando")); b.disabled = true; }
  else if (tem) { b.innerHTML = escHtml(t("usar_inicial")); b.classList.add("pronto"); }
  else { b.innerHTML = escHtml(t("comprar")) + " " + moedasHtml(p); b.classList.add(save.moedas >= p ? "pode" : "falta"); }
  const ini = el("lojaInicial");
  ini.innerHTML = "";
  const txt = document.createElement("span");
  txt.innerHTML = save.armaInicial ? Icone.html("arma") + " " + escHtml(t("arma_inicial_e", t("a_" + save.armaInicial))) : Icone.html("roleta") + " " + escHtml(t("sem_arma_inicial"));
  ini.appendChild(txt);
  if (save.armaInicial) {
    const tirar = document.createElement("button"); tirar.className = "pequeno lTirar"; tirar.textContent = t("tirar");
    tirar.addEventListener("click", function() { som("clique"); Progresso.equiparArma(""); montarLoja(); });
    ini.appendChild(tirar);
  }
  if (!tem && save.moedas < p) {
    const f = document.createElement("span"); f.className = "lFalta"; f.textContent = t("faltam_moedas", p - save.moedas); ini.appendChild(f);
  }
}

function acaoLoja() {
  const a = ARMA[armaLoja];
  if (!a) return;
  if (Progresso.temArma(a.id)) { if (save.armaInicial !== a.id && Progresso.equiparArma(a.id)) som("pegar"); }
  else if (Progresso.comprarArma(a.id)) { som("carta"); Progresso.equiparArma(a.id); reanimar(el("lojaPrevia"), "comprou"); }
  else { som("acerto"); reanimar(el("btnLojaAcao"), "sem"); return; }
  montarLoja();
}
el("btnLojaAcao").addEventListener("click", function() { acaoLoja(); this.blur(); });

// prévia: a bolinha da pessoa segurando a arma, mirando de um lado para o outro, num pedestal com luz da raridade
function animarLoja(agora) {
  if (estado !== "loja") { loopLoja = false; return; }
  requestAnimationFrame(animarLoja);
  const cv = el("lojaPrevia"), g = cv.getContext("2d"), tm = agora / 1000, a = ARMA[armaLoja];
  if (!a) return;
  g.clearRect(0, 0, cv.width, cv.height);
  const cx = cv.width / 2, chao = cv.height * 0.84, r = cv.height * 0.17, y = chao - r - Math.abs(Math.sin(tm * 2.4)) * 8;
  const cor = ["#ced4da", "#ced4da", "#b197fc", "#ffd43b"][a.raridade];
  // raios atrás (chapados) e pedestal
  g.save(); g.translate(cx, y); g.rotate(tm * 0.6); g.fillStyle = cor; g.globalAlpha = a.raridade >= 3 ? 0.3 : 0.16; g.beginPath();
  for (let i = 0; i < 10; i++) { const an = i * Math.PI / 5; g.moveTo(0, 0); g.arc(0, 0, cv.width * 0.6, an, an + Math.PI / 14); g.closePath(); }
  g.fill(); g.restore();
  g.fillStyle = "#1a0d33"; g.beginPath(); g.ellipse(cx, chao + 6, r * 2.1, r * 0.42, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = cor; g.beginPath(); g.ellipse(cx, chao, r * 1.9, r * 0.32, 0, 0, Math.PI * 2); g.fill();
  if (typeof ArteBolinha !== "undefined") {
    const ang = -0.25 + Math.sin(tm * 1.3) * 0.35;
    ArteBolinha.desenhar(g, { x: cx, y: y, r: r, cor: corDoVisual(save.visual), olharX: Math.cos(ang), olharY: Math.sin(ang) * 0.5, expressao: "bravo", piscar: 0, t: tm,
      escalaX: 1, escalaY: 1, flash: 0, fantasma: 0, skin: save.visual.corpo, acessorio: chaveCamadas({ chapeu: save.visual.chapeu, acessorio: save.visual.acessorio, olhos: save.visual.olhos, boca: save.visual.boca }, 0), cache: true });
    if (typeof ArteArmas !== "undefined" && ArteArmas.desenharNaMao) ArteArmas.desenharNaMao(g, a.id, cx, y, ang, r, 0, 0);
  }
}
