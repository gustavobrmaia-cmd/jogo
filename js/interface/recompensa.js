"use strict";

// =========================
// RECOMPENSAS RÁPIDAS
// 1. Fim da partida: tela com o resultado, a barra de XP enchendo (subir de nível dá um baú especial),
//    o baú da partida para abrir (toque -> treme -> abre com raios e o prêmio), "▶ abrir outro baú" (premiado,
//    1 vez) e REVANCHE direto (sem passar pelo menu).
//    O baú abre sozinho e, contra o bot, "▶ PRÓXIMO RIVAL" conta 3 s e começa a próxima partida sozinho
//    (no Poki v9 ~30% de quem terminava a 1ª partida não começava a 2ª). Clicar em outro botão cancela a contagem.
//    O baú da 1ª partida da vida sempre traz um acessório, que já vem equipado.
//    v16: no modo rivais, vitória sem nada para decidir NÃO abre esta tela (fluxo contínuo, telas.js fluxoDireto).
//    v13: ao lado do baú, o painel de PODER (Força, Vida, Velocidade; interface/poder.js). Dá para comprar ->
//    a contagem espera 5 s (8 s na 1ª vez) e cada compra devolve pelo menos 4 s.
//    Modo rivais: a fileira dos 10 rivais (vencidos com ✓, o próximo em destaque), o nome do próximo e o prêmio;
//    perdeu -> "REVANCHE" contra o mesmo. O 5º rival dá um baú de nível e o 10º um baú lendário.
// 2. Recompensa diária: sequência de 7 dias que cresce (dia 3 tem baú, dia 7 baú lendário). Aparece sozinha
//    no menu uma vez por dia; perder um dia volta para o dia 1.
// =========================

let rec = null;        // estado da tela de recompensa
let diaria = null;     // estado da tela da recompensa diária

// ---------- fim da partida ----------
function abrirRecompensa(j, titulo, sub) {
  const xp = Progresso.ganharXP(Progresso.xpDaPartida(j));
  const baus = ["normal"];
  for (let i = 0; i < xp.subiu; i++) baus.push("nivel");
  const rr = j.resultadoRival || null;
  if (rr && rr.venceu && rr.i === 4) baus.push("nivel");
  if (rr && rr.venceu && rr.i === RIVAIS.length - 1) baus.push("lendario");
  rec = { modo: j.rival ? "rivais" : j.modo, baus: baus, i: 0, fase: "fechado", t0: 0, premio: null, extraUsado: false, xp: xp,
          primeira: !!j.treino && !rr, aberta: performance.now() / 1000, fimBaus: 0, cancelou: false,   // no modo rivais o acessório vem do rival
          rival: rr, venceu: j.vencedorPartida === 1, poder: j.modo !== "2p", espera: 3 };
  estado = "recompensa";
  garantirDemo();          // no fundo, a luta de demonstração (sem o placar da partida que acabou)
  atualizarTextos();
  el("recTitulo").textContent = titulo;
  el("recSub").textContent = sub || "";
  rec.sub = sub || "";
  el("recPremio").textContent = "";
  animarXp(xp);
  // painel de poder (contra máquina): ao lado do baú; comprar não cancela a contagem, só dá mais tempo
  const painel = el("recPoder");
  painel.classList.toggle("escondido", !rec.poder);
  el("telaRecompensa").classList.toggle("comPoder", rec.poder);
  if (rec.poder) {
    // v16: lembra que a pessoa já viu as melhorias e zera a conta das vitórias sem tela (telas.js fluxoDireto)
    save.stats.viuPoder = 1;
    save.stats.semTela = 0;
    if (!painel.firstChild) montarPainelPoder(painel, poderComprouNaRecompensa);
    painel.dataset.perdeu = rec.venceu ? "0" : "1";
    atualizarPainelPoder(painel);
    if (Poder.algumaPossivel()) Eventos.oferta("upgrade", "visible");
  }
  // escada de rivais
  el("canvasEscada").classList.toggle("escondido", !rr);
  el("recProximo").classList.toggle("escondido", !rr);
  el("telaRecompensa").classList.toggle("comEscada", !!rr);
  if (rr) {
    const prox = rr.venceu ? (rr.campeao ? 0 : rr.i + 1) : rr.i, liga = rr.venceu && rr.campeao ? rr.liga + 1 : rr.liga;
    el("recProximo").textContent = rr.campeao ? "🏆 " + t("campeao_liga", nomeLiga(rr.liga)) :
      rr.venceu ? t("proximo", RIVAIS[prox].nome + " ⚡" + Poder.valor(Poder.doRival(prox, liga))) + "   ·   " + textoPremioRival(prox, liga) :
      t("revanche_contra", rr.nome + " ⚡" + Poder.valor(Poder.doRival(rr.i, rr.liga)));
  }
  atualizarBotoesRecompensa();
  mostrarTela("telaRecompensa");
  if (xp.subiu) Eventos.marco("player-level-" + xp.nivel);
}

// barra de XP: enche do valor antigo até o novo (passando por "cheia" em cada nível que subiu)
function animarXp(xp) {
  const barra = el("recXp");
  const pct = function(nivel, valor) { return Math.min(100, 100 * valor / Progresso.xpParaSubir(nivel)) + "%"; };
  barra.style.transition = "none";
  barra.style.width = pct(xp.nivelAntes, xp.xpAntes);
  el("recNivel").textContent = t("nivel_jogador", xp.nivelAntes);
  el("recXpTxt").textContent = "+" + xp.ganho + " XP";
  void barra.offsetWidth;
  let passo = 0;
  function proximo() {
    barra.style.transition = "width 0.6s ease-out";
    if (passo < xp.subiu) {
      barra.style.width = "100%";
      setTimeout(function() {
        passo++;
        som("vitoria_rodada");
        el("recNivel").textContent = t("nivel_jogador", xp.nivelAntes + passo);
        el("recSub").textContent = t("subiu_nivel", xp.nivelAntes + passo) + (rec && rec.sub ? "   ·   " + rec.sub : "");
        barra.style.transition = "none"; barra.style.width = "0%"; void barra.offsetWidth;
        proximo();
      }, 650);
    } else barra.style.width = pct(xp.nivel, xp.xp);
  }
  setTimeout(proximo, 250);
}

function atualizarBotoesRecompensa() {
  const faltam = rec.i < rec.baus.length;
  el("btnAbrirBau").classList.toggle("escondido", !faltam || rec.fase !== "fechado");
  el("btnAbrirBau").textContent = rec.baus[rec.i] === "nivel" ? t("abrir_bau_nivel") : t("abrir_bau");
  const podeExtra = !faltam && rec.fase !== "sacudindo" && !rec.extraUsado && Poki.premiadoDisponivel();
  el("btnOutroBau").classList.toggle("escondido", !podeExtra);
  el("btnOutroBau").textContent = "▶ " + t("outro_bau");
  textoRevanche(rec.cancelou ? 0 : rec.n || 0);
  if (podeExtra && !rec.ofertou) { rec.ofertou = true; Eventos.oferta("extra-chest", "visible"); }
}

function abrirBauDaVez() {
  if (!rec || rec.i >= rec.baus.length || rec.fase !== "fechado") return;
  rec.fase = "sacudindo";
  rec.t0 = performance.now() / 1000;
  som("carga");
  atualizarBotoesRecompensa();
  // se a pessoa sair da tela no meio da animação, fecharRecompensa já entrega o baú: os passos abaixo não rodam
  const r = rec;
  setTimeout(function() {
    if (rec !== r) return;
    rec.premio = Progresso.abrirBau(rec.baus[rec.i], rec.primeira && rec.i === 0);
    rec.fase = "aberto";
    rec.t0 = performance.now() / 1000;
    som("carta");
    mostrarPremio(el("recPremio"), rec.premio);
    rec.i++;
    if (rec.poder) atualizarPainelPoder(el("recPoder"));
    // próximo baú (se subiu de nível) fica pronto depois de um instante
    setTimeout(function() {
      if (rec !== r) return;
      if (rec.i < rec.baus.length) { rec.fase = "fechado"; }
      atualizarBotoesRecompensa();
      atualizarMenuProgresso();
    }, 900);
  }, 700);
}

function mostrarPremio(alvo, premio) {
  let txt = "+" + premio.moedas + " 🪙";
  if (premio.skin) txt += "   ✨ " + t(premio.equipou ? "premio_equipado" : "premio_skin", t("sk_" + premio.skin));
  alvo.textContent = txt;
}

// botão da próxima partida: contra o bot vira "▶ PRÓXIMO RIVAL" com a contagem
function textoRevanche(n) {
  const b = el("btnRevanche");
  if (!b || !rec) return;
  const contra = rec.modo === "bot" || rec.modo === "rivais";
  const nome = contra && rec.venceu ? t("proximo_rival") : t("revanche");
  b.textContent = contra ? "▶ " + nome + (n > 0 ? "  " + n : "") : nome;
}

// chamado a cada quadro com a tela aberta: abre o baú sozinho e conta para a próxima partida
function contagemRecompensa(tempo) {
  if (!rec || ocupado) return;
  if (rec.fase === "fechado" && rec.i < rec.baus.length && tempo - Math.max(rec.aberta, rec.t0) > 0.5) abrirBauDaVez();
  if ((rec.modo !== "bot" && rec.modo !== "rivais") || rec.cancelou || rec.i < rec.baus.length || rec.fase !== "aberto") return;
  if (!rec.fimBaus) {
    rec.fimBaus = tempo;
    // dá para melhorar: mais tempo (bem mais na 1ª vez, quando a pessoa ainda não sabe o que é)
    if (rec.poder && Poder.algumaPossivel()) rec.espera = (save.stats.melhorias || 0) ? 5 : 8;
  }
  const falta = rec.espera - (tempo - rec.fimBaus - 0.4);
  if (falta <= 0) { Eventos.marco("next-rival-auto"); revanche(); return; }
  const n = Math.ceil(Math.min(rec.espera, falta));
  if (n !== rec.n) { rec.n = n; textoRevanche(n); }
}

// comprou uma melhoria na tela de fim: a contagem para a próxima partida volta a ter pelo menos 4 s
function poderComprouNaRecompensa() {
  if (rec) rec.comprou = true;
  if (!rec || !rec.fimBaus) return;
  const agora = performance.now() / 1000;
  if (rec.espera - (agora - rec.fimBaus - 0.4) < 4) { rec.espera = 4; rec.fimBaus = agora - 0.4; rec.n = 4; textoRevanche(rec.cancelou ? 0 : 4); }
  Eventos.oferta("upgrade", "interact");
}

function outroBau() {
  if (ocupado || !rec || rec.extraUsado) return;
  ocupado = true;
  rec.cancelou = true;
  textoRevanche(0);
  Eventos.oferta("extra-chest", "interact");
  Poki.premiado("small").then(function(assistiu) {
    ocupado = false;
    if (!assistiu) { atualizarBotoesRecompensa(); return; }
    rec.extraUsado = true;
    rec.baus.push("normal");
    rec.fase = "fechado";
    atualizarBotoesRecompensa();
    abrirBauDaVez();
  });
}

// baús que ficaram sem abrir quando a pessoa sai: o prêmio vem do mesmo jeito
function fecharRecompensa() {
  if (!rec) return;
  if (rec.poder) { save.stats.comprouUltima = rec.comprou ? 1 : 0; salvar(); }
  while (rec.i < rec.baus.length) { Progresso.abrirBau(rec.baus[rec.i], rec.primeira && rec.i === 0); rec.i++; }
  rec = null;
}

function revanche() {
  if (!rec || ocupado) return;
  const modo = rec.modo;
  fecharRecompensa();
  comecarPartida(modo);
}

function recompensaParaMenu() {
  fecharRecompensa();
  irParaMenu(undefined);
}

// desenho do baú (chamado pelo loop enquanto a tela está aberta)
function desenharRecompensa(tempo) {
  const cv = el("canvasBau"), g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  if (!rec || typeof ArteBau === "undefined") return;
  contagemRecompensa(tempo);
  if (!rec) return;
  if (rec.rival) desenharEscada(tempo);
  const tipo = rec.baus[Math.min(rec.i, rec.baus.length - 1)];
  const tipoVisto = rec.fase === "aberto" ? rec.baus[rec.i - 1] : tipo;
  const dt = tempo - rec.t0;
  let abre = 0, sacode = 0;
  if (rec.fase === "sacudindo") sacode = Math.min(1, dt * 2);
  if (rec.fase === "aberto") abre = Math.min(1, dt * 3);
  const pula = rec.fase === "fechado" ? Math.abs(Math.sin(tempo * 3)) * 6 : 0;
  ArteBau.desenhar(g, cv.width / 2, cv.height * 0.58 - pula, 1, tipoVisto, abre, tempo, sacode);
}

// Fileira dos 10 rivais: vencidos com ✓, o próximo (ou o da revanche) grande e pulsando, os que faltam escondidos.
// Logo depois de uma vitória o rival vencido fica em destaque um instante, ganha o ✓ e o destaque passa adiante.
function desenharEscada(tempo) {
  const cv = el("canvasEscada"), g = cv.getContext("2d"), rr = rec.rival;
  g.clearRect(0, 0, cv.width, cv.height);
  const n = RIVAIS.length, passo = Math.min(92, (cv.width - 80) / (n - 1)), x0 = cv.width / 2 - passo * (n - 1) / 2, y = cv.height * 0.5;
  const dt = tempo - rec.aberta;
  const trocou = rr.venceu && dt > 0.9;
  const vencidos = rr.campeao ? (trocou ? n : n - 1) : rr.i + (trocou ? 1 : 0);
  const destaque = rr.campeao ? (trocou ? -1 : n - 1) : rr.venceu && !trocou ? rr.i : vencidos;
  g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 6;
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + passo * (n - 1), y); g.stroke();
  for (let k = 0; k < n; k++) {
    const r = RIVAIS[k], x = x0 + k * passo, grande = k === destaque;
    const raio = grande ? 34 + 3 * Math.sin(tempo * 6) : 24;
    if (grande) {
      g.fillStyle = "rgba(255,212,59,0.25)"; g.beginPath(); g.arc(x, y, raio + 12, 0, 7); g.fill();
      g.strokeStyle = "#ffd43b"; g.lineWidth = 5; g.beginPath(); g.arc(x, y, raio + 8, 0, 7); g.stroke();
    }
    if (k < vencidos || grande) {
      g.globalAlpha = k < vencidos && !grande ? 0.55 : 1;
      if (typeof ArteSkins !== "undefined") ArteSkins.miniatura(g, r.corpo, r.acessorio, r.cor, x, y, raio, tempo);
      else { g.fillStyle = r.cor; g.beginPath(); g.arc(x, y, raio, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    } else {
      // quem ainda não apareceu: silhueta com "?"
      g.fillStyle = "#2b2f45"; g.beginPath(); g.arc(x, y, raio, 0, 7); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 3; g.stroke();
      g.fillStyle = "rgba(255,255,255,0.5)"; g.font = "900 26px Nunito, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("?", x, y + 1);
    }
    if (k < vencidos) {
      // ✓ verde (com um "pulo" quando acabou de ganhar)
      const novo = rr.venceu && k === vencidos - 1 && dt < 1.3 ? 1 + 0.6 * Math.max(0, 1.3 - dt) : 1;
      g.save(); g.translate(x + 16, y + 16); g.scale(novo, novo);
      g.fillStyle = "#2b8a3e"; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath(); g.moveTo(-6, 0); g.lineTo(-1, 5); g.lineTo(7, -5); g.stroke();
      g.restore();
    }
    g.fillStyle = grande ? "#ffd43b" : "rgba(255,255,255,0.6)"; g.font = "900 " + (grande ? 22 : 16) + "px Nunito, system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillText(grande ? r.nome : String(k + 1), x, y + (grande ? 66 : 48));
  }
}

// ---------- recompensa diária ----------
function abrirDiaria() {
  const dia = Progresso.diaDisponivel();
  if (!dia) return false;
  diaria = { dia: dia, fase: "fechado", t0: 0, premio: null };
  estado = "diaria";
  montarDiaria(dia, false);
  el("diariaPremio").textContent = "";
  el("btnPegarDiaria").classList.remove("escondido");
  el("btnFecharDiaria").classList.add("escondido");
  el("canvasDiaria").classList.add("escondido");
  Eventos.oferta("daily", "visible");
  mostrarTela("telaDiaria");
  return true;
}

function montarDiaria(dia, pego) {
  const g = el("gradeDiaria");
  g.innerHTML = "";
  Progresso.DIARIAS.forEach(function(r, i) {
    const n = i + 1;
    const c = document.createElement("div");
    c.className = "diaCard" + (n < dia || (pego && n === dia) ? " pego" : "") + (n === dia ? " hoje" : "") + (n === 7 ? " grande" : "");
    const h = document.createElement("div"); h.className = "diaNum"; h.textContent = t("dia_n", n); c.appendChild(h);
    // ícone: baú desenhado (dias com baú) ou moeda
    if (r.bau && typeof ArteBau !== "undefined") {
      const cv = document.createElement("canvas"); cv.width = 110; cv.height = 80; cv.className = "diaIcone";
      ArteBau.desenhar(cv.getContext("2d"), 55, 50, 0.42, r.bau, 0, 0, 0);
      c.appendChild(cv);
    } else { const ic = document.createElement("div"); ic.className = "moedaGrande"; c.appendChild(ic); }
    const v = document.createElement("div"); v.className = "diaValor"; v.textContent = r.moedas + (r.bau ? " + " + t(r.bau === "lendario" ? "bau_lendario" : "bau") : ""); c.appendChild(v);
    if (n < dia || (pego && n === dia)) { const ok = document.createElement("div"); ok.className = "diaOk"; ok.textContent = "✓"; c.appendChild(ok); }
    g.appendChild(c);
  });
}

function pegarDiaria() {
  if (!diaria || diaria.fase !== "fechado") return;
  const premio = Progresso.pegarDiaria();
  if (!premio) { fecharDiaria(); return; }
  Eventos.oferta("daily", "interact");   // v15: antes só media "visible" e a tabela mostrava 0% pegando
  diaria.premio = premio;
  montarDiaria(premio.dia, true);
  som("carta");
  let txt = "+" + premio.moedas + " 🪙";
  if (premio.bau) {
    diaria.fase = "aberto"; diaria.t0 = performance.now() / 1000; diaria.tipoBau = premio.bau.tipo;
    el("canvasDiaria").classList.remove("escondido");
    txt += "   🎁 +" + premio.bau.moedas + " 🪙" + (premio.bau.skin ? "   ✨ " + t("premio_skin", t("sk_" + premio.bau.skin)) : "");
  } else diaria.fase = "pego";
  el("diariaPremio").textContent = txt;
  el("btnPegarDiaria").classList.add("escondido");
  el("btnFecharDiaria").classList.remove("escondido");
  atualizarMenuProgresso();
}

function fecharDiaria() {
  diaria = null;
  estado = "menu";
  atualizarTextos();
  mostrarTela("telaMenu");
}

function desenharDiaria(tempo) {
  if (!diaria || diaria.fase !== "aberto" || typeof ArteBau === "undefined") return;
  const cv = el("canvasDiaria"), g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  ArteBau.desenhar(g, cv.width / 2, cv.height * 0.6, 0.8, diaria.tipoBau, Math.min(1, (tempo - diaria.t0) * 3), tempo, 0);
}
