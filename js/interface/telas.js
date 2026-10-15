"use strict";

// =========================
// TELAS e o "estado" do jogo
// estado: "menu" | "modo" | "idiomas" | "opcoes" | "controles" | "missoes" | "skins" | "poder" | "jogo" | "pausa" | "continuar"
// Fluxo:
//   1ª visita: escolhe o modo (bot / 2 jogadores) e a luta começa na hora (sem anúncio).
//   Fim da partida: volta para o MENU (com o placar). Jogar -> escolhe o modo -> anúncio comum -> luta.
// Anúncios:
//   comum    (Poki.intervalo): antes de cada partida, menos a primeira e menos logo depois de um premiado;
//   premiado (Poki.premiado):  só quando o jogador escolhe:
//     - "Partida Lendária": só armas raras e lendárias, para OS DOIS jogadores (justo no modo 2 jogadores);
//     - "Continuar": perdeu para o bot -> continua a partida (o bot volta um ponto). Uma vez por partida;
//     - "Dobrar moedas": no menu, depois de uma partida (uma vez por partida).
// Enquanto está nos menus, uma luta de demonstração (bot contra bot) roda no fundo.
// =========================

let estado = "menu";
let ocupado = false;            // esperando anúncio: ignora cliques repetidos
let lendariaPronta = false;     // assistiu o anúncio da Partida Lendária
let pendente = null;            // partida que acabou e espera a resposta do "continuar"

const TELAS = ["telaMenu", "telaModo", "telaIdiomas", "telaPausa", "telaContinuar",
  "telaOpcoes", "telaControles", "telaMissoes", "telaSkins", "telaRecompensa", "telaDiaria", "telaPoder"];
let diariaVista = false;     // a recompensa diária abre sozinha uma vez por visita

function mostrarTela(id) {
  TELAS.forEach(function(t2) { el(t2).classList.toggle("aberta", t2 === id); });
  el("hud").classList.toggle("escondido", estado !== "jogo");
}

function atualizarTextos() {
  traduzirDom();
  const somTxt = save.mudo ? t("som_off") : t("som_on");
  el("btnSom").textContent = somTxt;
  el("btnSomPausa").textContent = somTxt;
  el("btnQualidade").textContent = t("qualidade_" + save.qualidade);
  document.querySelectorAll('[data-acao="som"] .ic').forEach(function(e) { e.textContent = save.mudo ? "🔇" : "🔊"; });
  document.body.classList.toggle("toque", !!entrada.toque);
  document.body.classList.toggle("leve", !!CONFIG.leve);   // v17.5: modo leve sem as animações de fundo das telas
  el("listaIdiomas").querySelectorAll("button").forEach(function(b) {
    b.classList.toggle("ativo", b.dataset.idioma === IDIOMA);
  });
  const toque = entrada.toque;
  el("dicaBot").textContent = t("nivel_bot", nivelBotTexto(save.nivelBot)) + "\n" + (toque ? t("dica_bot_toque") : dicaTeclas(true));
  el("dica2p").textContent = toque ? t("dica_2p_toque") : dicaTeclas(false);
  el("dicaRivais").textContent = t("rival_n", save.rival + 1, RIVAIS.length) + ": " + RIVAIS[save.rival].nome + "\n" + t("liga_n", nomeLiga(save.liga)) + "\n" + textoPremioRival(save.rival, save.liga);
  atualizarBotaoLendaria();
  atualizarMenuProgresso();
}

function atualizarBotaoLendaria() {
  const b = el("btnLendaria");
  if (lendariaPronta) { b.textContent = "✨ " + t("lendaria_ativada"); b.disabled = true; b.classList.remove("escondido"); return; }
  b.disabled = false;
  b.textContent = "▶ " + t("lendaria_anuncio");
  b.classList.toggle("escondido", !Poki.premiadoDisponivel());
}

// ---------- menus ----------
// Dica dos controles com as teclas que a pessoa escolheu
function dicaTeclas(solo) {
  const tk = entrada.teclas();
  const n = function(j, a) { return nomeTecla(tk[j][a][0]); };
  const n2 = function(j, a) { return tk[j][a][1] ? " / " + nomeTecla(tk[j][a][1]) : ""; };
  if (solo) return t("dica_bot_v3", n(1, "esquerda") + " " + n(1, "direita"), n(1, "pulo") + n2(1, "pulo"), n(1, "tiro"));
  return t("dica_2p_v3", n(1, "esquerda") + " " + n(1, "direita") + " " + n(1, "pulo") + " + " + n(1, "tiro"),
    n(2, "esquerda") + " " + n(2, "direita") + " " + n(2, "pulo") + " + " + n(2, "tiro"));
}

function irParaMenu(textoResultado) {
  estado = "menu";
  entrada.ativa = false;
  Poki.jogando(false);
  if (textoResultado !== undefined) el("menuResultado").textContent = textoResultado;
  garantirDemo();
  atualizarTextos();
  mostrarTela("telaMenu");
  // recompensa diária (depois da 1ª partida, uma vez por visita)
  if (!diariaVista && save.partidas > 0 && Progresso.diaDisponivel()) { diariaVista = true; abrirDiaria(); }
}

function abrirModo() {
  estado = "modo";
  garantirDemo();
  atualizarTextos();
  // na 1ª visita não tem "voltar": a pessoa entrou para jogar
  el("btnVoltarModo").classList.toggle("escondido", save.partidas === 0);
  if (Poki.premiadoDisponivel() && !lendariaPronta) Eventos.oferta("legendary", "visible");
  mostrarTela("telaModo");
}

function garantirDemo() {
  if (!jogo || !jogo.demo) novaPartida("demo");
}

// ---------- começar a partida ----------
function comecarPartida(modo) {
  if (ocupado) return;
  ocupado = true;
  const primeira = save.partidas === 0;
  const lendaria = lendariaPronta;
  if (!primeira) Eventos.botao("mode-" + (modo === "2p" ? "2p" : modo === "sobrevivencia" ? "survival" : modo === "rivais" ? "rivals" : "bot"));
  mostrarTela(null);
  // sem anúncio comum na 1ª partida, na 2ª (v15) e logo depois de um premiado
  // v15: também sem pedir anúncio antes da 2ª partida — a passagem 1ª->2ª é onde mais gente sai (perdia 24–35%)
  const segunda = save.partidas === 1;
  (primeira || segunda || lendaria ? Promise.resolve() : Poki.intervalo()).then(function() {
    ocupado = false;
    lendariaPronta = false;
    save.dobrar = 0;
    save.partidas++;
    salvar();
    // modo rivais = partida contra o bot (mesmas regras) contra o rival atual da escada
    const escada = modo === "rivais";
    const nivel = escada ? nivelRival(save.rival, save.liga, save.rivalAjuste) : save.nivelBot;
    novaPartida(escada ? "bot" : modo, { lendaria: lendaria, nivelBot: nivel, primeiraVez: primeira,
      rival: escada ? save.rival : null, liga: save.liga });
    estado = "jogo";
    entrada.ativa = true;
    entrada.limparApertos();
    mostrarTela(null);
    Poki.jogando(true);
    Poki.medir("match", modo === "sobrevivencia" ? "survival" : escada ? "rivals" : modo, "start");
    if (modo === "bot") Poki.medir("bot", "level-" + Math.round(save.nivelBot * 10), "start");
    if (escada) Poki.medir("rival", idEventoRival(save.rival, save.liga), "start");
    if (save.partidas <= 10) Eventos.marco("match-" + save.partidas);
  });
}

// evento do Poki por rival: rival/r1 ... rival/r10 (liga Bronze); nas ligas seguintes rival/l2-r1...
function idEventoRival(i, liga) { return (liga ? "l" + (liga + 1) + "-" : "") + "r" + (i + 1); }

// ---------- fim da partida (chamado por partida.js) ----------
function aoTerminarPartida(j) {
  entrada.ativa = false;
  Poki.jogando(false);
  if ((j.modo === "bot" || j.modo === "sobrevivencia") && j.vencedorPartida === 2 && !j.continuou && Poki.premiadoDisponivel()) {
    // perdeu para o bot: oferece continuar (opcional)
    pendente = j;
    estado = "continuar";
    const surv = j.modo === "sobrevivencia";
    el("contPlacar").textContent = surv ? t("onda_n", j.onda) : j.pontos[0] + " – " + j.pontos[1];
    el("contExplica").textContent = surv ? t("continuar_vida") : t("continuar_explica");
    el("contAviso").textContent = "";
    Eventos.oferta("continue", "visible");
    atualizarTextos();
    mostrarTela("telaContinuar");
    return;
  }
  finalizarPartida(j);
}

function finalizarPartida(j) {
  pendente = null;
  let texto, extra = "";
  // progresso: moedas da partida e contadores das missões/conquistas
  const ganho = Progresso.moedasDaPartida(j);
  Progresso.ganharMoedas(ganho);
  save.dobrar = 0;
  let novoRecorde = false;
  if (j.modo === "sobrevivencia" && j.onda > save.recordeOnda) { save.recordeOnda = j.onda; novoRecorde = true; }
  Progresso.registrar("partidas", 1);
  if (j.modo === "2p") Progresso.registrar("partidas2p", 1);
  if (j.lendaria) Progresso.registrar("lendarias", 1);
  if (j.modo === "bot" && j.vencedorPartida === 1) {
    Progresso.registrar("vitorias", 1);
    // (o id ficou "5x0"; desde a v14 é 3 – 0; v15: a partida treino não conta — no v14 243 pessoas ganharam de graça)
    if (j.pontos[1] === 0 && j.alvo >= 3 && !j.treino) Progresso.registrar("placar5x0", 1);
    if (save.nivelBot >= 0.85) Progresso.registrar("botMestre", 1);
    if ((j.piorDiferenca || 0) >= 2) Progresso.registrar("virada", 1);   // partida até 3: virar de 0 – 2
  }
  if (j.rival) {
    // modo rivais: venceu -> próximo rival (+ moedas e, no 5º/10º, baú); perdeu -> revanche, rival mais fraco
    const venceu = j.vencedorPartida === 1, r = j.rival;
    Poki.medir("rival", idEventoRival(r.i, r.liga), venceu ? "complete" : "fail");
    if (venceu) save.vitorias++; else save.derrotas++;
    j.resultadoRival = { venceu: venceu, i: r.i, liga: r.liga, nome: r.d.nome, moedas: 0, campeao: false };
    if (venceu) {
      const premio = premioRival(r.i, r.liga);
      Progresso.ganharMoedas(premio);
      j.resultadoRival.moedas = premio;
      // o acessório do rival vencido vira seu (e já vem equipado na próxima partida)
      const ace = r.d.acessorio;
      if (ace && !Progresso.temSkin(ace)) { Progresso.ganharSkin(ace); save.skinAcessorio = ace; j.resultadoRival.acessorio = ace; }
      save.rivalAjuste = 0;
      if (r.i + 1 >= RIVAIS.length) { save.rival = 0; save.liga = r.liga + 1; j.resultadoRival.campeao = true; Eventos.marco("champion-" + r.liga); }
      else save.rival = r.i + 1;
    } else save.rivalAjuste = Math.max(-0.3, (save.rivalAjuste || 0) - 0.07);
    salvar();
    texto = (venceu ? t("rival_derrotado", r.d.nome) : t("rival_venceu", r.d.nome)) + "  " + j.pontos[0] + " – " + j.pontos[1];
    if (venceu) extra = "🏆 +" + j.resultadoRival.moedas + " 🪙" + (j.resultadoRival.acessorio ? "   ✨ " + t("premio_equipado", t("sk_" + j.resultadoRival.acessorio)) : "");
  } else if (j.modo === "bot") {
    const venceu = j.vencedorPartida === 1;
    const antes = save.nivelBot;
    // base: entre o nível do começo e o do fim da partida (o bot já se ajustou a cada rodada)
    const base = j.bots[1] ? (save.nivelBot + j.bots[1].nivel) / 2 : save.nivelBot;
    save.nivelBot = proximoNivelBot(base, desempenhoDoJogador(j), venceu, save.partidas);
    if (venceu) save.vitorias++; else save.derrotas++;
    salvar();
    Poki.medir("match", "bot", venceu ? "complete" : "fail");
    Poki.medir("bot", save.nivelBot > antes ? "harder" : "easier", "interact");
    texto = (venceu ? t("voce_venceu") : t("bot_venceu")) + "  " + j.pontos[0] + " – " + j.pontos[1];
    const n0 = nivelBotTexto(antes), n1 = nivelBotTexto(save.nivelBot);
    if (n1 > n0) extra = t("bot_subiu", n1);
    else if (n1 < n0) extra = t("bot_desceu", n1);
  } else if (j.modo === "sobrevivencia") {
    salvar();
    Poki.medir("match", "survival", "complete");
    Poki.medir("survival", "best-" + j.onda, "reached");
    texto = t("fim_sobrevivencia", j.onda);
    extra = novoRecorde ? t("novo_recorde") : t("recorde_onda", save.recordeOnda);
  } else {
    Poki.medir("match", "2p", "complete");
    texto = t("jogador_venceu", j.vencedorPartida) + "  " + j.pontos[0] + " – " + j.pontos[1];
  }
  el("menuResultado").textContent = texto;
  if (fluxoDireto(j)) { entregarSemTela(j, ganho); return; }
  abrirRecompensa(j, texto, "+" + ganho + " 🪙" + (extra ? "   ·   " + extra : ""));
}

// ---------- v16: FLUXO CONTÍNUO entre partidas do modo rivais ----------
// Nos testes, as passagens entre partidas perdiam bem mais gente que as rodadas (1ª->2ª: 25–35%; depois de cada
// vitória ~20%; rodada->rodada ~13%): a tela de fim é uma "parada" onde a pessoa decide sair. Então, quando venceu e
// não há nada para decidir, os prêmios são entregues sem a tela e o próximo rival começa direto; eles aparecem numa
// faixa na abertura (faixaPremio, desenho.js). A tela continua em: derrota (revanche), rival 5 e 10 (baú especial),
// campeão, sempre para quem comprou melhoria na última tela e, para quem não compra, a cada 3 vitórias.
// v17: a 1ª tela das melhorias (depois do rival 2) perdia 32% de quem vencia (nas outras passagens seguiam 86–96%).
// Agora a melhoria grátis (Força +1) vem sozinha na faixa e a 1ª tela fica para depois do rival 3, com moedas para
// gastar antes do rival 4 (o 1º mais duro da escada).
let faixaPremio = null;   // { linhas: [...], destaque, t0 } mostrada no começo da próxima partida

function fluxoDireto(j) {
  const rr = j.resultadoRival;
  if (!rr || !rr.venceu || rr.campeao || rr.i === 4) return false;
  if (j.treino) return true;                         // 1ª partida da vida: direto para o rival 2
  if (save.stats.comprouUltima) return false;        // quem compra melhoria sempre vê a tela
  return (save.stats.semTela || 0) < 2;              // quem não compra: tela a cada 3 vitórias (1ª: depois do rival 3)
}

function entregarSemTela(j, ganho) {
  const rr = j.resultadoRival;
  const xp = Progresso.ganharXP(Progresso.xpDaPartida(j));
  let moedas = ganho + (rr.moedas || 0);
  const linhas = [];
  const baus = ["normal"];
  for (let i = 0; i < xp.subiu; i++) baus.push("nivel");
  baus.forEach(function(tipo) {
    const p = Progresso.abrirBau(tipo, false);
    moedas += p.moedas;
    if (p.skin) linhas.push("✨ " + t("premio_skin", t("sk_" + p.skin)));
  });
  linhas.unshift("+" + moedas + " 🪙");
  if (rr.acessorio) linhas.push("✨ " + t("premio_equipado", t("sk_" + rr.acessorio)));
  if (xp.subiu) { linhas.push("⭐ " + t("subiu_nivel", xp.nivel)); Eventos.marco("player-level-" + xp.nivel); }
  // v17: a melhoria grátis vem sozinha (Força: a rodada fica mais curta e a abertura mostra "⚡110 VS ⚡100")
  let destaque = null;
  if (!j.treino && Poder.gratis() && Poder.comprar("forca", true)) destaque = "💥 " + t("mel_forca") + " +1   " + t("gratis");
  save.stats.semTela = (save.stats.semTela || 0) + 1;
  salvar();
  faixaPremio = { linhas: linhas, destaque: destaque, t0: 0, velho: j };   // o relógio da faixa começa quando a próxima partida aparece
  Eventos.marco("next-rival-direct");
  atualizarMenuProgresso();
  comecarPartida("rivais");
}

function continuarPartida() {
  if (ocupado || !pendente) return;
  ocupado = true;
  const j = pendente;
  Eventos.oferta("continue", "interact");
  Poki.premiado("medium").then(function(assistiu) {
    ocupado = false;
    if (!assistiu) { el("contAviso").textContent = t("anuncio_falhou"); return; }
    // o bot perde o último ponto e a partida continua (na sobrevivência: volta na mesma onda com vida cheia)
    pendente = null;
    j.continuou = true;
    j.terminou = false;   // a partida volta: o próximo fim conta de novo (partida.js terminarPartida)
    if (j.modo === "sobrevivencia") j.vidaJogador = 100;
    else j.pontos[1] = j.alvo - 1;
    j.vencedorPartida = 0;
    if (typeof Efeitos !== "undefined") Efeitos.limpar();
    iniciarRodada();
    estado = "jogo";
    entrada.ativa = true;
    entrada.limparApertos();
    mostrarTela(null);
    Poki.jogando(true);
  });
}

function naoContinuar() {
  if (ocupado || !pendente) return;
  finalizarPartida(pendente);
}

function ativarLendaria() {
  if (ocupado || lendariaPronta) return;
  ocupado = true;
  Eventos.oferta("legendary", "interact");
  Poki.premiado("medium").then(function(assistiu) {
    ocupado = false;
    if (assistiu) lendariaPronta = true;
    atualizarTextos();
  });
}

// ---------- pausa ----------
function pausar() {
  if (estado !== "jogo") return;
  estado = "pausa";
  entrada.ativa = false;
  Poki.jogando(false);
  entrada.soltarTudo();
  atualizarTextos();
  mostrarTela("telaPausa");
}

function continuar() {
  if (estado !== "pausa") return;
  estado = "jogo";
  entrada.ativa = true;
  entrada.soltarTudo();
  mostrarTela(null);
  Poki.jogando(true);
}

function sairDaPartida() {
  if (jogo && !jogo.demo) Poki.medir("match", jogo.modo, "quit");
  irParaMenu("");
}

// moedas no topo, selo de prêmios esperando e o botão de dobrar
function atualizarMenuProgresso() {
  const txt = "🪙 " + save.moedas;
  el("menuMoedas").textContent = txt;
  el("missoesMoedas").textContent = txt;
  el("skinsMoedas").textContent = txt;
  const n = Progresso.pendentes();
  el("seloMissoes").textContent = n;
  el("seloMissoes").classList.toggle("escondido", n === 0);
  el("seloPoder").classList.toggle("escondido", !Poder.algumaPossivel());
  el("menuNivelNum").textContent = t("nivel_jogador", save.nivel);
  el("menuXp").style.width = Math.min(100, 100 * save.xp / Progresso.xpParaSubir(save.nivel)) + "%";
  el("dicaSurv").textContent = t("sobrevivencia_dica") + (save.recordeOnda ? "\n" + t("recorde_onda", save.recordeOnda) : "");
}

// ---------- opções ----------
function trocarSom() {
  save.mudo = !save.mudo;
  salvar();
  Eventos.botao(save.mudo ? "sound-off" : "sound-on");
  atualizarTextos();
}

function escolherIdioma(id) {
  if (!idiomaValido(id)) return;
  save.idioma = id;
  salvar();
  Poki.medir("settings", "lang-" + id, "interact");
  carregarIdioma(id).then(function() {
    atualizarTextos();
    abrirOpcoes();
  });
}

function montarTelas() {
  IDIOMAS.forEach(function(i) {
    const b = document.createElement("button");
    b.textContent = i.nome;
    b.dataset.idioma = i.id;
    b.addEventListener("click", function() { som("clique"); escolherIdioma(i.id); });
    el("listaIdiomas").appendChild(b);
  });

  const acoes = {
    jogar: abrirModo,
    modoBot: function() { comecarPartida("bot"); },
    modoRivais: function() { comecarPartida("rivais"); },
    modo2p: function() { comecarPartida("2p"); },
    lendaria: ativarLendaria,
    idiomas: function() { estado = "idiomas"; mostrarTela("telaIdiomas"); },
    voltar: function() { estado = "menu"; atualizarTextos(); mostrarTela("telaMenu"); },
    voltarOpcoes: abrirOpcoes,
    opcoes: abrirOpcoes,
    controles: abrirControles,
    teclasPadrao: teclasDeFabrica,
    missoes: function() { abrirMissoes("missoes"); },
    skins: function() { abrirSkins("corpo"); },
    poder: abrirTelaPoder,
    modoSurv: function() { comecarPartida("sobrevivencia"); },
    abrirBau: abrirBauDaVez,
    outroBau: outroBau,
    revanche: revanche,
    recMenu: recompensaParaMenu,
    pegarDiaria: pegarDiaria,
    fecharDiaria: fecharDiaria,
    som: trocarSom,
    qualidade: function() {
      const ordem = ["auto", "alta", "leve"];
      save.qualidade = ordem[(ordem.indexOf(save.qualidade) + 1) % ordem.length];
      salvar();
      aplicarQualidade();
      atualizarTextos();
      Poki.medir("button", "quality", save.qualidade);
    },
    pausar: pausar,
    continuar: continuar,
    sair: sairDaPartida,
    continuarPartida: continuarPartida,
    naoContinuar: naoContinuar
  };
  document.querySelectorAll("[data-acao]").forEach(function(b) {
    b.addEventListener("click", function() {
      som("clique");
      const fn = acoes[b.dataset.acao];
      if (fn) fn();
      b.blur();
    });
  });

  // atalhos de teclado nos menus
  window.addEventListener("keydown", function(e) {
    if (e.repeat) return;
    if (estado === "pausa" && (e.code === "Escape" || e.code === "KeyP")) continuar();
    else if (estado === "menu" && e.code === "Enter") abrirModo();
  });

  // aba escondida no meio da partida: pausa sozinho
  document.addEventListener("visibilitychange", function() { if (document.hidden) pausar(); });
}
