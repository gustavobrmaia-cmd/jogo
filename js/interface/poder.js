"use strict";

// =========================
// PAINEL DE PODER (v13): os 3 cartões de melhoria (Força, Vida, Velocidade) com nível, efeito e preço.
// Aparece na tela de fim de partida (contra máquina, ao lado do baú) e na tela "Melhorar" do menu.
// Comprar: as moedas saem, o nível sobe, o cartão brilha e o PODER pula. O cartão que dá para comprar pulsa.
// Regras e números: js/jogo/progresso/poder.js
// =========================

function montarPainelPoder(alvo, aoComprar) {
  alvo.innerHTML = "";
  const topo = document.createElement("div");
  topo.className = "poderTopo";
  ["poderValor", "poderDica", "poderMoedas"].forEach(function(c) {
    const s = document.createElement("span"); s.className = c; topo.appendChild(s);
  });
  const cartas = document.createElement("div");
  cartas.className = "poderCartas";
  MELHORIAS.forEach(function(m) {
    const b = document.createElement("button");
    b.className = "poderCarta";
    b.dataset.melhoria = m.id;
    ["pcNivel", "pcIcone", "pcNome", "pcEfeito", "pcEstrelas", "pcPreco"].forEach(function(c) {
      const s = document.createElement("span"); s.className = c; b.appendChild(s);
    });
    b.querySelector(".pcIcone").textContent = m.icone;
    b.addEventListener("click", function() {
      b.blur();
      if (!Poder.comprar(m.id)) { som("clique"); reanimar(b, "sem"); return; }
      som("carta");
      reanimar(b, "comprou");
      // "+1" subindo do cartão (v14)
      const mais = document.createElement("span");
      mais.className = "pcMais"; mais.textContent = "+1";
      b.appendChild(mais);
      setTimeout(function() { mais.remove(); }, 850);
      reanimar(topo.querySelector(".poderValor"), "pulou");
      reanimar(topo.querySelector(".poderMoedas"), "gastou");
      atualizarPainelPoder(alvo);
      atualizarMenuProgresso();
      if (aoComprar) aoComprar(m.id);
    });
    cartas.appendChild(b);
  });
  // v15: mão apontando para o 1º cartão enquanto a 1ª melhoria é grátis (igual à mão do tutorial da luta);
  // v17: também na 1ª compra com moedas (classe comMao)
  const mao = document.createElement("span");
  mao.className = "maoPoder"; mao.textContent = "👆";
  cartas.firstChild.appendChild(mao);
  alvo.appendChild(topo);
  alvo.appendChild(cartas);
  atualizarPainelPoder(alvo);
}

// recomeça uma animação de CSS (a mesma classe de novo)
function reanimar(elemento, classe) {
  elemento.classList.remove(classe);
  void elemento.offsetWidth;
  elemento.classList.add(classe);
}

function atualizarPainelPoder(alvo) {
  if (!alvo || !alvo.firstChild) return;
  const pode = Poder.algumaPossivel();
  alvo.classList.toggle("comGratis", Poder.gratis());
  // v17: a grátis vem sozinha depois do rival 2; a mão continua apontando até a pessoa comprar a 1ª com moedas
  alvo.classList.toggle("comMao", !Poder.gratis() && (save.stats.melhorias || 0) < 2 && Poder.podeComprar("forca"));
  alvo.querySelector(".poderValor").textContent = t("poder_n", Poder.valor(Poder.doJogador()));
  alvo.querySelector(".poderMoedas").textContent = "🪙 " + save.moedas;
  // dica curta: depois de perder ("melhore e volte mais forte") ou para quem ainda não comprou quase nada
  alvo.querySelector(".poderDica").textContent = Poder.gratis() ? t("escolha_gratis") : !pode ? "" : alvo.dataset.perdeu === "1" ? t("poder_dica") :
    (save.stats.melhorias || 0) < 3 ? t("poder_gaste") : "";
  alvo.querySelectorAll(".poderCarta").forEach(function(b) {
    const id = b.dataset.melhoria, n = Poder.nivel(id), max = Poder.noMax(id);
    b.querySelector(".pcNome").textContent = t("mel_" + id);
    b.querySelector(".pcNivel").textContent = t("mel_nivel", n);
    // v14: sem porcentagem (cara de arcade): uma frase curta e 5 estrelas por faixa —
    // bronze (níveis 1–5), prata (6–10), ouro (11–15), diamante (16–20), mestre (21–25)
    b.querySelector(".pcEfeito").textContent = t("mel_d_" + id);
    const est = b.querySelector(".pcEstrelas");
    const faixa = n ? Math.min(4, Math.floor((n - 1) / 5)) : 0, cheias = n ? n - faixa * 5 : 0;
    est.dataset.faixa = faixa;
    est.innerHTML = '<span class="cheia">' + "★".repeat(cheias) + '</span><span class="vazia">' + "★".repeat(5 - cheias) + "</span>";
    const custo = Poder.custo(id);
    b.querySelector(".pcPreco").textContent = max ? t("mel_max") : custo ? "🪙 " + custo : t("gratis");
    b.classList.toggle("gratis", !max && !custo);
    b.classList.toggle("pode", Poder.podeComprar(id));
    b.classList.toggle("max", max);
  });
}

// tela "Melhorar" do menu
function abrirTelaPoder() {
  estado = "poder";
  const alvo = el("menuPoder");
  if (!alvo.firstChild) montarPainelPoder(alvo, null);
  alvo.dataset.perdeu = "0";
  atualizarPainelPoder(alvo);
  Eventos.botao("upgrades");
  mostrarTela("telaPoder");
}
