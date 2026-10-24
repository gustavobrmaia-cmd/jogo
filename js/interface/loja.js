"use strict";

// =========================
// LOJA DE ARMAS (v19): compra armas com moedas e escolhe uma delas. v21.4: ela é a ARMA RESERVA (vem com munição
// infinita quando a munição acaba, no lugar do estilingue; combate.js equiparReserva), contra a máquina e no online.
// (No save continua save.armaInicial e as chaves de texto arma_inicial_*, só os textos mudaram.)
// Só aparece depois que o novato passou pelo começo (Progresso.lojaLiberada: rival 5 vencido ou já viu a tela das
// melhorias — o fluxo direto entre os rivais 1–5 não pode ganhar uma parada nova).
// Preços: Progresso.PRECO_ARMA (por raridade). Abas por raridade; o destaque mostra a bolinha da pessoa segurando a
// arma, com barras de dano, munição e rapidez.
// estado "loja": esta tela anima a prévia com o próprio requestAnimationFrame (o main.js não sabe dela).
// Eventos: shop/open (visible), shop/buy-<id> e shop/start-<id> (interact, progresso.js).
// =========================

let abaLoja = 1;
let armaLoja = null;
// v21.6: aba 4 = SUPERS (dados/supers.js): compra e escolhe o super; sem nenhum, a rodada sorteia 1 dos 3 grátis
const ABA_SUPERS = 4;
let superLoja = null;

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
  const bs = document.createElement("button");
  bs.className = "vAba lAba lAbaSuper" + (abaLoja === ABA_SUPERS ? " ativo" : "");
  bs.innerHTML = Icone.html("s_dourado") + " <span>" + escHtml(t("aba_supers")) + "</span>";
  bs.addEventListener("click", function() { som("clique"); abaLoja = ABA_SUPERS; montarLoja(); });
  abas.appendChild(bs);
  const grade = el("lojaGrade");
  grade.innerHTML = "";
  const tit = document.querySelector("#telaLoja .vTitulo");
  if (tit) tit.textContent = t(abaLoja === ABA_SUPERS ? "aba_supers" : "loja_armas");
  if (abaLoja === ABA_SUPERS) { montarSupers(grade); return; }
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
  txt.innerHTML = save.armaInicial ? Icone.html("arma") + " " + escHtml(t("arma_inicial_e", t("a_" + save.armaInicial))) : Icone.html("cartas") + " " + escHtml(t("sem_arma_inicial"));
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

// ---------- aba Supers (v21.6) ----------
function montarSupers(grade) {
  if (!superLoja || !SUPER_DE[superLoja]) superLoja = save.superEquip || SUPERS[0].id;
  SUPERS.forEach(function(S) {
    const tem = Progresso.temSuper(S.id), usando = save.superEquip === S.id;
    const c = document.createElement("button");
    c.className = "vItem lItem lSuper" + (usando ? " usando" : "") + (tem || S.gratis ? "" : " bloqueado") + (superLoja === S.id ? " foco" : "");
    c.style.setProperty("--cs", S.cor);
    const cv = document.createElement("canvas"); cv.width = cv.height = 110;
    Icone.desenhar(cv.getContext("2d"), "s_" + S.id, 55, 55, 84);
    c.appendChild(cv);
    const nome = document.createElement("div"); nome.className = "vItemNome"; nome.textContent = t("su_" + S.id); c.appendChild(nome);
    const st = document.createElement("div"); st.className = "vItemStatus";
    st.innerHTML = usando ? Icone.html("ok") + " " + escHtml(t("su_em_uso")) : S.gratis ? escHtml(t("su_gratis")) : tem ? escHtml(t("tem")) : moedasHtml(S.preco);
    c.appendChild(st);
    c.addEventListener("click", function() { som("clique"); superLoja = S.id; montarLoja(); });
    grade.appendChild(c);
  });
  atualizarDestaqueSuper();
  atualizarMenuProgresso();
}

function atualizarDestaqueSuper() {
  const S = SUPER_DE[superLoja], tem = Progresso.temSuper(S.id), usando = save.superEquip === S.id, p = S.preco || 0;
  el("lojaNome").innerHTML = "<span class='vRar lTipoSuper' style='--cs:" + S.cor + "'>" + escHtml(t("su_tipo_" + S.tipo)) + "</span> " + escHtml(t("su_" + S.id));
  el("lojaInfo").innerHTML = "<p class='lDescSuper'>" + escHtml(t("sd_" + S.id)) + "</p><p class='lDescSuper lComo'>" + escHtml(t("su_como_" + S.tipo)) + "</p>";
  const b = el("btnLojaAcao");
  b.className = "vBotao"; b.disabled = false;
  if (S.gratis) { b.innerHTML = escHtml(t("su_gratis_sorteado")); b.disabled = true; }
  else if (usando) { b.innerHTML = Icone.html("ok") + " " + escHtml(t("su_usando")); b.disabled = true; }
  else if (tem) { b.innerHTML = escHtml(t("su_usar")); b.classList.add("pronto"); }
  else { b.innerHTML = escHtml(t("comprar")) + " " + moedasHtml(p); b.classList.add(save.moedas >= p ? "pode" : "falta"); }
  const ini = el("lojaInicial");
  ini.innerHTML = "";
  const txt = document.createElement("span");
  txt.innerHTML = save.superEquip ? Icone.html("s_" + save.superEquip) + " " + escHtml(t("su_escolhido", t("su_" + save.superEquip))) : Icone.html("roleta") + " " + escHtml(t("su_sem"));
  ini.appendChild(txt);
  if (save.superEquip) {
    const tirar = document.createElement("button"); tirar.className = "pequeno lTirar"; tirar.textContent = t("tirar");
    tirar.addEventListener("click", function() { som("clique"); Progresso.equiparSuper(""); montarLoja(); });
    ini.appendChild(tirar);
  }
  if (!S.gratis && !tem && save.moedas < p) {
    const f = document.createElement("span"); f.className = "lFalta"; f.textContent = t("faltam_moedas", p - save.moedas); ini.appendChild(f);
  }
}

function acaoLoja() {
  if (abaLoja === ABA_SUPERS) {
    const S = SUPER_DE[superLoja];
    if (!S || S.gratis) return;
    if (Progresso.temSuper(S.id)) { if (save.superEquip !== S.id && Progresso.equiparSuper(S.id)) som("pegar"); }
    else if (Progresso.comprarSuper(S.id)) { som("super"); reanimar(el("lojaPrevia"), "comprou"); }
    else { som("acerto"); reanimar(el("btnLojaAcao"), "sem"); return; }
    montarLoja();
    return;
  }
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
  if (abaLoja === ABA_SUPERS) { previaSuper(cv, g, tm); return; }
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

// v21.6: prévia do super: a bolinha da pessoa com a aura (poder) ou o ataque em cima dela, raios na cor do super
function previaSuper(cv, g, tm) {
  const S = SUPER_DE[superLoja];
  if (!S) return;
  g.clearRect(0, 0, cv.width, cv.height);
  const cx = cv.width / 2, chao = cv.height * 0.84, r = cv.height * 0.15, y = chao - r - Math.abs(Math.sin(tm * 2.4)) * 8;
  g.save(); g.translate(cx, y); g.rotate(tm * 0.6); g.fillStyle = S.cor; g.globalAlpha = 0.25; g.beginPath();
  for (let i = 0; i < 10; i++) { const an = i * Math.PI / 5; g.moveTo(0, 0); g.arc(0, 0, cv.width * 0.6, an, an + Math.PI / 14); g.closePath(); }
  g.fill(); g.restore();
  g.fillStyle = "#1a0d33"; g.beginPath(); g.ellipse(cx, chao + 6, r * 2.1, r * 0.42, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = S.cor; g.beginPath(); g.ellipse(cx, chao, r * 1.9, r * 0.32, 0, 0, Math.PI * 2); g.fill();
  const rr = S.raio ? r * (1.15 + 0.15 * Math.sin(tm * 3)) : r;
  if (typeof ArteBolinha !== "undefined") {
    ArteBolinha.desenhar(g, { x: cx, y: y - (rr - r), r: rr, cor: corDoVisual(save.visual), olharX: Math.cos(tm), olharY: 0.2, expressao: "bravo", piscar: 0, t: tm,
      escalaX: 1, escalaY: 1, flash: 0, fantasma: 0, skin: save.visual.corpo, superAtivo: S.tipo === "poder" ? S : null,
      acessorio: chaveCamadas({ chapeu: save.visual.chapeu, acessorio: save.visual.acessorio, olhos: save.visual.olhos, boca: save.visual.boca }, 0), cache: true });
  }
  // ataque: o ícone dele caindo/girando em cima; poder: o ícone pequeno flutuando ao lado
  if (S.tipo === "ataque") {
    const u = (tm * 0.8) % 1;
    g.save(); g.translate(cx + Math.sin(tm * 2) * 30, 40 + u * (y - 60)); g.rotate(Math.sin(tm * 3) * 0.3);
    Icone.desenhar(g, "s_" + S.id, 0, 0, 70 + 20 * u); g.restore();
  } else Icone.desenhar(g, "s_" + S.id, cx + r * 2.2, y - r * 1.2 + Math.sin(tm * 3) * 6, 56);
}
