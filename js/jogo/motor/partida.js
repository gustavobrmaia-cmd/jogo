"use strict";

// =========================
// PARTIDA E RODADAS
// Partida: quem fizer CONFIG.pontosParaVencer pontos primeiro. Cada rodada é num cenário diferente:
//   "cartas"    v20.5, só na 1ª rodada contra a máquina (a partir do rival 3): 3 cartas viradas, a pessoa escolhe uma
//               (sozinha em 3 s). Desenho: arte/cartas_arma.js
//   "intro"     ~1,3 s: nome do cenário, bolinhas aparecem (ninguém atira ainda)
//   "luta"      45 s para derrotar o oponente
//   "queda"     acabou o tempo e os dois estão vivos: queda de braço (quem clicar mais vence).
//               Quem terminou a luta com mais vida já começa um pouco na frente.
//   "fimRodada" câmera lenta, ponto para quem venceu
//   "fimPartida" comemoração e volta para as telas
// Modos: "bot" (jogador 1 contra o bot), "2p" (dois no mesmo aparelho), "demo" (bot contra bot no fundo do menu),
//        "online" (v19: dois aparelhos; js/rede/online.js)
// =========================

// v20.2: pausas entre as lutas ~25% menores (fim 2,1 -> 1,7; sem K.O. 1,5 -> 1,2; abertura das rodadas 2+ 1,0 -> 0,8;
// fim da partida 2,6 -> 2,1): cada pausa é um momento em que a pessoa pode sair
const RODADA = { intro: 0.8, introPrimeira: 1.7, luta: 45, fim: 1.7, semKo: 1.2, quedaIntro: 1.1, quedaMax: 6, quedaFim: 1.6, fimPartida: 2.1, danoDobro: 10 };

let jogo = null;   // a partida atual (de verdade ou a de demonstração)

// Progresso conta só o jogador 1 (o dono do aparelho), e nunca na demonstração
function registrar(j, lado, chave, n, extra) {
  if (j.demo || lado !== 1 || typeof Progresso === "undefined") return;
  Progresso.registrar(chave, n, extra);
}

function embaralhar(lista) {
  const l = lista.slice();
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = l[i]; l[i] = l[j]; l[j] = x; }
  return l;
}

// Skins: o jogador 1 usa o visual que montou (v19: cor, corpo, olhos, boca, chapéu, acessório, rastro, K.O., emote);
// o oponente (bot ou jogador 2) ganha um sorteado. Corpos de cor própria (ouro, galáxia...) trocam a cor da bolinha,
// e a do oponente sempre fica bem diferente.
// j.visuais = os visuais; j.skins = { corpo, acessorio } que o desenho usa (acessorio = chave das camadas, dados/skins.js)
function sortearVisual() {
  const v = Object.assign({}, VISUAL_PADRAO);
  const um = function(tipo) { const l = SKINS_POR_TIPO[tipo]; return l[Math.floor(Math.random() * l.length)].id; };
  v.corpo = um("corpo");
  if (Math.random() < 0.5) v.chapeu = um("chapeu");
  if (Math.random() < 0.15) v.olhos = um("olhos");
  return v;
}
function escolherSkins(j) {
  const v1 = j.demo ? sortearVisual() : Object.assign({}, VISUAL_PADRAO, save.visual || {});
  const v2 = sortearVisual();
  if (!j.demo) j.cores[0] = corDoVisual(v1);
  else if (SKIN[v1.corpo] && SKIN[v1.corpo].cor !== "jogador") j.cores[0] = SKIN[v1.corpo].cor;
  const fixa2 = SKIN[v2.corpo].cor !== "jogador" ? SKIN[v2.corpo].cor : null;
  if (fixa2 && coresDiferentes(fixa2, j.cores[0])) j.cores[1] = fixa2;
  else {
    if (fixa2) v2.corpo = "classico";
    if (!coresDiferentes(j.cores[1], j.cores[0])) j.cores[1] = corDiferente(j.cores[0]);
  }
  j.visuais = [v1, v2];
  atualizarSkins(j);
}
function atualizarSkins(j) {
  j.skins = j.visuais.map(function(v, k) { return { corpo: v.corpo, acessorio: chaveCamadas(v, k + 1) }; });
}

// Contra o bot o jogador tem sempre a mesma cor (a da prévia no menu) e o bot ganha uma bem diferente.
// Antes as duas eram sorteadas e em ~21% das partidas ficavam parecidas (azul x ciano, rosa x rosa).
function sortearCores(modo) {
  // v19: a pessoa escolhe a cor na personalização (também no 2 jogadores: é a bolinha dela)
  const a = modo !== "demo" ? corDoVisual(save.visual) : embaralhar(CORES_BOLINHAS)[0];
  return [a, corDiferente(a)];
}
function corDiferente(a) {
  const alt = CORES_BOLINHAS.filter(function(c) { return coresDiferentes(c, a); });
  return alt[Math.floor(Math.random() * alt.length)] || (coresDiferentes("#4dabf7", a) ? "#4dabf7" : "#ff5d73");
}
// matiz (0-360), saturação e luz (0-1) de "#rrggbb"
function hslDe(c) {
  const n = parseInt(c.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return { h: 0, s: 0, l: l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return { h: h, s: s, l: l };
}
// dá para distinguir de longe? tons bem separados (>= 75°); cor quase branca/cinza só com uma cor forte
function coresDiferentes(a, b) {
  const x = hslDe(a), y = hslDe(b);
  if (x.s < 0.3 || y.s < 0.3) return Math.max(x.s, y.s) >= 0.5 && Math.abs(x.l - y.l) < 0.5 || Math.abs(x.l - y.l) > 0.3;
  let d = Math.abs(x.h - y.h); if (d > 180) d = 360 - d;
  return d >= 75;
}

// opcoes: { lendaria, nivelBot, primeiraVez }
function novaPartida(modo, opcoes) {
  opcoes = opcoes || {};
  let ordem = embaralhar(CENARIOS.map(function(c) { return c.id; }));
  // nas primeiras partidas, os mapas mais cruéis para quem está aprendendo (cair da arena, empurrão forte)
  // ficam por último — no Poki v8 o jogador perdia 58-65% das rodadas neles
  // (e, no v9, espaço/oceano/vulcão também espantavam: sem gravidade, água e lava confundem quem está começando).
  // v11: nas 6 primeiras partidas (no v10 o jogador perdia 67–85% no dojô, cidade, lua e castelo)
  // v18: no "Contra o bot" e na sobrevivência os cruéis ficam sempre por último (no v17.5: oceano 80% de derrota, dojô 63%)
  if (modo === "bot" || modo === "sobrevivencia") {
    const dificeis = ["dojo", "castelo", "cidade", "lua"], medios = ["espaco", "oceano", "vulcao"];
    ordem = ordem.filter(function(id) { return dificeis.indexOf(id) < 0 && medios.indexOf(id) < 0; })
      .concat(embaralhar(medios), embaralhar(dificeis.slice()));
  }
  // 1ª partida da vida ("treino"): campo e depois só mapas simples (sem cair, lava, água ou gravidade esquisita)
  const treino = !!opcoes.primeiraVez && modo === "bot";
  if (treino) {
    const simples = ["fabrica", "fliperama", "templo", "floresta"];
    ordem = ["campo"].concat(embaralhar(simples), ordem.filter(function(id) { return id !== "campo" && simples.indexOf(id) < 0; }));
  }
  // modo rivais: a 1ª rodada é na casa do rival
  const rival = modo === "bot" && opcoes.rival !== undefined && opcoes.rival !== null ? RIVAIS[opcoes.rival] : null;
  // v16: na liga Bronze os mapas cruéis só aparecem como casa de rival (1ª rodada). No v15 quem chegava longe — a turma
  // que mais joga — perdia 86% no vulcão, 83% no espaço, 75% no dojô, 50% na cidade e 44% na lua (nos outros: 8–16%).
  // v18: em todas as ligas (no v17.5, na Prata, o jogador perdia 80% no oceano e 63% no dojô e na cidade — e quem chega
  // na Prata é justamente quem joga 5 min ou mais)
  if (rival && !treino) {
    const crueis = ["dojo", "castelo", "cidade", "lua", "vulcao", "espaco", "oceano"];
    // v17: até o rival 3 também sem deserto (vento), gelo (escorrega) e laboratório (gravidade vira) — no v16 o jogador
    // perdia 41%, 42% e 35% das rodadas neles, contra 16–27% nos outros. Sobram campo, fábrica, floresta, fliperama, templo.
    if (opcoes.rival <= 2 && !(opcoes.liga > 0)) crueis.push("deserto", "gelo", "laboratorio");
    ordem = ordem.filter(function(id) { return crueis.indexOf(id) < 0 || id === rival.casa; });
  }
  if (rival && !treino) ordem = [rival.casa].concat(ordem.filter(function(id) { return id !== rival.casa; }));
  // v18.3: rivais 6–10 da Bronze (casas cruéis): a casa vem na 2ª rodada — a partida não abre com uma morte de 2–3 s
  if (rival && !treino && !(opcoes.liga > 0) && opcoes.rival >= 5 && ordem.length > 1) ordem = [ordem[1], ordem[0]].concat(ordem.slice(2));
  jogo = {
    modo: modo,
    demo: modo === "demo",
    pontos: [0, 0],
    alvo: opcoes.primeiraVez && modo === "bot" ? CONFIG.pontosPrimeira : CONFIG.pontosParaVencer,
    rodada: 0,
    cores: sortearCores(modo),
    ordem: ordem,
    lendaria: !!opcoes.lendaria,
    nivelBot: opcoes.nivelBot === undefined ? 0.5 : opcoes.nivelBot,
    bots: [null, null],
    M: null,
    fase: "intro", tempoFase: 0, relogio: RODADA.luta,
    queda: null,
    total: { dano: [0, 0], tiros: [0, 0], acertos: [0, 0], quedas: 0, rodadas: [] },
    vencedorRodada: 0, vencedorPartida: 0,
    banner: null,
    tempoReal: 0,
    treino: treino,
    rival: rival ? { i: opcoes.rival, liga: opcoes.liga || 0, d: rival } : null,
    // tutorial desenhado da 1ª partida (atirar -> andar -> pular; desenho.js)
    tuto: modo === "bot" && save.partidas <= 1 ? { passo: null, tempo: 0, andou: 0, pulou: false } : null
  };
  // v19: arma inicial (comprada na loja): quem tem começa TODA rodada com ela. Contra a máquina e no online (cada um
  // com a sua). v19.6: no 2 jogadores não vale (só o jogador 1 tinha, e a tela Melhorar diz que lá os dois são iguais)
  const ai = save.armaInicial;
  jogo.armaInicial = [!treino && (modo === "bot" || modo === "sobrevivencia" || modo === "online") && ai && typeof ARMA !== "undefined" && ARMA[ai] && (save.armas || []).indexOf(ai) >= 0 ? ai : null, null];
  escolherSkins(jogo);
  // v19.9: online (anfitrião): visual, cor e arma inicial do outro aparelho já antes da 1ª rodada
  if (modo === "online" && opcoes.outro && typeof Online !== "undefined") Online.configurarOutro(jogo, opcoes.outro);
  // rival: a cara dele (cor, corpo e acessório); se a skin do jogador tiver a mesma cor, o rival troca de cor
  if (rival) {
    const fixa = SKIN[rival.corpo] && SKIN[rival.corpo].cor !== "jogador" ? SKIN[rival.corpo].cor : rival.cor;
    jogo.visuais[1] = visualDeAntigo(rival.corpo, rival.acessorio);
    if (coresDiferentes(fixa, jogo.cores[0])) jogo.cores[1] = fixa;
    else { jogo.visuais[1].corpo = "classico"; jogo.cores[1] = corDiferente(jogo.cores[0]); }
    atualizarSkins(jogo);
  }
  // prepara a cena da queda de braço já no começo da partida (as cores não mudam até o fim)
  if (modo !== "demo" && typeof ArteQueda !== "undefined" && ArteQueda.preparar) {
    const cores = jogo.cores;
    setTimeout(function() { try { ArteQueda.preparar(cores[0], cores[1], CONFIG.largura, alturaTela); } catch (e) { /* sem queda pronta: faz na hora */ } }, 50);
  }
  // personalidade: nas primeiras partidas só as que vêm lutar (o cauteloso, o atirador e o colecionador
  // ficavam longe e a rodada arrastava; na simulação 1 de cada 4 rodadas passava de 40 s)
  if (modo === "bot") jogo.bots[1] = criarBot(2, jogo.nivelBot, rival ? rival.estilo : treino ? "agressivo" : save.partidas <= 3 ? (Math.random() < 0.5 ? "agressivo" : "saltitante") : undefined);
  // Sobrevivência: ondas de bots cada vez mais fortes; a vida do jogador passa de uma onda para a outra
  if (modo === "sobrevivencia") {
    jogo.onda = 1;
    jogo.alvo = 999;
    jogo.vidaJogador = 100;
    jogo.bots[1] = criarBot(2, nivelDaOnda(1));
  }
  if (modo === "demo") { jogo.bots[0] = criarBot(1, 0.75); jogo.bots[1] = criarBot(2, 0.75); jogo.alvo = 99; }
  entrada.solo = modo !== "2p";
  if (typeof Efeitos !== "undefined") Efeitos.limpar();
  iniciarRodada();
}

function iniciarRodada() {
  const j = jogo;
  j.rodada++;
  const cen = CENARIO[j.ordem[(j.rodada - 1) % j.ordem.length]];
  const M = {
    cen: cen, plats: prepararPlataformas(cen), t: 0, passo: 0,
    bumpers: cen.bumpers ? cen.bumpers.map(function(u) { return { x: u.x, y: u.y, r: u.r, flash: 0 }; }) : null,
    proj: [], feixes: [], avisos: [], caixas: [], cartas: [],
    proxCaixa: 1.5, proxCarta: 4 + Math.random() * 1.5, proxMeteoro: 3,
    lendaria: j.lendaria, mudo: j.demo, multDano: 1,
    stats: { dano: [0, 0], tiros: [0, 0], acertos: [0, 0] },
    morreu: null, pegou: null, ultimaCarta: null
  };
  // v19.7: no treino, no rival 2 e nas 2 primeiras partidas só as armas que já existiam na v18.3 (no PFT da v19.6 a
  // rodada 2 do treino, quando as caixas aparecem, perdeu 6 pontos a mais que na v18.3)
  M.soClassicas = !j.demo && (j.treino || save.partidas <= 2 || (j.rival && j.rival.liga === 0 && j.rival.i < 2));
  // v19.7: lutas ~15% mais longas nos rivais 2–5 da Bronze e nas primeiras partidas contra o bot (o testador mediu
  // rodadas de 12,6 s na v19 contra 15,9 s na v18.3: mais trocas de rodada por minuto, e cada troca perde gente)
  M.multInicio = !j.demo && !j.treino && ((j.rival && j.rival.liga === 0 && j.rival.i >= 1 && j.rival.i <= 4) ||
    (j.modo === "bot" && !j.rival && save.partidas <= 6)) ? 0.87 : 1;
  // v19.6: armas que tiram o controle (gosma, banana, bolhas, inflador) ficam fora no começo
  M.semControle = !j.demo && (j.treino || save.partidas <= 6 || (j.rival && j.rival.liga === 0 && j.rival.i < 5));
  // contra bot (pessoa x máquina): os mapas cruéis ficam mais justos para a pessoa (veja combate.js e passoMundo)
  M.contraBot = !j.demo && (j.modo === "bot" || j.modo === "sobrevivencia");
  const b1 = novaBolinha(1, cen.spawn[0][0], cen.spawn[0][1], j.cores[0]);
  const b2 = novaBolinha(2, cen.spawn[1][0], cen.spawn[1][1], j.cores[1]);
  M.bolinhas = [b1, b2];
  // quem é controlado por uma pessoa (ímã da mira, sons e efeitos de acerto, tela vermelha...)
  b1.humano = !j.demo && !j.bots[0];
  b2.humano = !j.demo && !j.bots[1];
  // poder (melhorias, v13): o da pessoa vale contra máquina; o rival da escada tem o dele
  if (M.contraBot && typeof Poder !== "undefined") {
    Poder.aplicar(b1, Poder.doJogador());
    if (j.rival) Poder.aplicar(b2, Poder.doRival(j.rival.i, j.rival.liga));
  }
  // v18: munição maior contra a máquina. No v17.5 o jogador passava ~70% da luta no estilingue (a arma da rodada
  // acabava em 3–5 s de tiro segurado — no celular a pessoa segura o botão) e o bot, que só atira quando acerta, ~40%:
  // as armas malucas, que são a graça do jogo, quase não ficavam na mão de quem joga
  if (M.contraBot) { b1.multMunicao = CONFIG.municaoJogador; b2.multMunicao = CONFIG.municaoBot; }
  // v18.2: da Prata em diante cada rival tem um truque (uma carta que ele já começa a rodada usando, com o dobro do tempo):
  // antes a liga nova era "o mesmo de antes, mais difícil"
  if (j.rival && j.rival.liga > 0) {
    const truque = ["rapidez", "escudo", "tiro_duplo", "super_pulo", "fantasma", "rapidez", "escudo", "furia", "tiro_duplo", "fantasma"][j.rival.i];
    pegarCarta(M, b2, truque);
    if (CARTA[truque].duracao) b2.efeitos[truque] = CARTA[truque].duracao * 2;
  }
  // os dois começam com a mesma arma (justo) e ela muda a cada rodada
  const arma = j.treino && j.rodada === 1 ? "rifle" : sortearArma(M, true);
  equipar(b1, arma); equipar(b2, arma);
  // v19: quem tem arma inicial começa TODA rodada com ela; na 1ª rodada a carta escolhida pode trocar (iniciarCartas)
  if (j.armaInicial) M.bolinhas.forEach(function(b, k) { if (j.armaInicial[k]) equipar(b, j.armaInicial[k]); });
  // v19: rastro escolhido na personalização (o motor guarda os pontos; o desenho fica em arte/skins.js)
  if (j.visuais && !j.demo) M.bolinhas.forEach(function(b, k) { const r = j.visuais[k].rastro; if (r) b.rastroFx = { id: r, vida: 0.42, pts: [], n: 0 }; });
  // 1ª partida da vida: dá para chegar perto de perder, mas não perder; o tiro do jogador pesa mais (rodada curta)
  // e as coisas aparecem aos poucos: rodada 1 só o rifle (sem acabar a munição), 2 entram as caixas de arma,
  // 3 entram as cartas, cada novidade com um "NOVO!" em cima (desenho.js)
  if (j.treino) {
    M.vidaMinima = 8;
    M.multJogador = CONFIG.multTreino;
    if (j.rodada === 1) { b1.municao = Infinity; M.proxCaixa = Infinity; M.proxCarta = Infinity; }
    else if (j.rodada === 2) { M.proxCarta = Infinity; M.novoCaixa = true; }
    else if (j.rodada === 3) { M.novoCarta = true; M.proxCarta = 2.5; }
  } else if (j.modo === "bot" && j.rival && j.rival.liga === 0 && j.rival.i < CONFIG.multRivais.length) M.multJogador = CONFIG.multRivais[j.rival.i];
  else if (j.modo === "bot" && save.partidas === 2) M.multJogador = CONFIG.multSegunda;
  if (j.tuto && j.rodada > 3) j.tuto = null;
  // perdeu a rodada sem acertar nada: a dica desenhada de mirar e atirar volta nesta rodada
  if (j.modo === "bot" && j.dicaRodada === j.rodada && !j.tuto) j.tuto = { passo: null, tempo: 0, andou: 1, pulou: true, so: true };
  if (j.modo === "sobrevivencia") {
    b1.vida = j.vidaJogador;
    // v19.6: as primeiras ondas batem menos (0,6 / 0,75 / 0,9; antes 1 desde a onda 1 e o jogador médio, que vencia os
    // rivais 1–5, morria nas ondas 1–3); depois da onda 12 o bot também bate mais forte
    M.multBot = j.onda <= 3 ? [0.6, 0.75, 0.9][j.onda - 1] : 1 + Math.max(0, j.onda - 12) * 0.1;
  }
  // contra o bot: o bot fraco também bate mais fraco (nível 1 tira ~70% do dano normal)
  if (j.modo === "bot" && j.bots[1]) M.multBot = lerp(0.45, 1, Math.min(1, j.bots[1].nivel / 0.45));
  // primeiras partidas: mede onde a pessoa sai (rodada a rodada)
  if (j.modo === "bot" && save.partidas <= 2) Poki.medir("round", "m" + save.partidas + "-r" + j.rodada, "start");
  b1.mira = 0; b2.mira = Math.PI;
  j.M = M;
  j.fase = "intro";
  j.tempoFase = 0;
  j.relogio = RODADA.luta;
  j.queda = null;
  j.avisouDobro = false;
  j.vencedorRodada = 0;
  j.prerender = null;          // o desenho refaz o fundo
  j.bots.forEach(function(bot) { if (bot) { bot.plano = null; bot.historico = []; } });
  if (!j.demo) {
    if (j.modo === "bot") Poki.medir("arena", cen.id, "start");
    som("rodada");
    if (estado === "jogo") Poki.jogando(true);   // a gameplay volta com a rodada nova
  }
  // v20.5: as cartas de arma abrem a 1ª rodada contra a máquina (o dono tirou as roletas). Como a roleta (v19.7), só a
  // partir do rival 3: no PFT da v19.6 a passagem treino -> rival 2 perdeu 7 pontos quando ganhou a roleta; os rivais
  // 1 e 2 começam direto, e vencer o 2 "libera" as cartas (desbloqueioRival)
  j.depoisCartas = false;
  const semCartas = j.rival && j.rival.liga === 0 && j.rival.i < 2;
  if (j.rodada === 1 && !j.demo && !j.treino && !j.continuou && !semCartas && (j.modo === "bot" || j.modo === "sobrevivencia") &&
      typeof CartasArma !== "undefined") iniciarCartas(j, M);
}

// ---------- um passo (1/60 s) ----------
// v19: online (js/rede/online.js): o convidado não simula (manda os controles e desenha o que chega);
// o anfitrião grava os efeitos do passo e manda o estado
function atualizarJogo(dt) {
  const j = jogo;
  if (!j) return;
  if (j.modo === "online" && typeof Online !== "undefined") {
    if (!Rede.anfitriao) { Online.passoConvidado(dt); return; }
    Online.antesDoPasso();
    try { passoDaPartida(dt); } finally { Online.depoisDoPasso(); }
    return;
  }
  passoDaPartida(dt);
}

function passoDaPartida(dt) {
  const j = jogo;
  if (!j) return;
  const M = j.M;
  j.tempoFase += FIS.dt;
  j.tempoReal += FIS.dt;
  if (typeof Efeitos !== "undefined") Efeitos.atualizar(dt);
  // tempos dos efeitos de tela (balões do bot, marcador de acerto, combo, tela vermelha)
  for (let k = 0; k < 2; k++) {
    const b = M.bolinhas[k];
    if (b.emote) { b.emote.t -= FIS.dt; if (b.emote.t <= 0) b.emote = null; }
    if (b.marca > 0) b.marca -= FIS.dt;
    if (b.combo && b.combo.mostra > 0 && M.t > b.combo.ate) b.combo.mostra -= FIS.dt * 2.5;
  }
  if (M.dorTela > 0) M.dorTela = Math.max(0, M.dorTela - FIS.dt * 1.6);
  if (j.fase === "queda") { atualizarQueda(j); return; }
  if (j.fase === "fimPartida") {
    passoMundo(j, M, false, 0.5);
    festejar(j, M, j.vencedorPartida);
    if (j.tempoFase >= RODADA.fimPartida) terminarPartida();
    return;
  }

  if (j.fase === "cartas" || j.fase === "intro") {
    // v18.3: na abertura nada empurra para os lados (as esteiras da fábrica levavam as duas bolinhas até as paredes)
    const xs = [M.bolinhas[0].x, M.bolinhas[1].x];
    passoMundo(j, M, false, 1);
    M.bolinhas.forEach(function(b, k) { b.x = xs[k]; b.vx = 0; });
  }
  if (j.fase === "cartas") { atualizarCartas(j); return; }
  if (j.fase === "intro") {
    // depois das cartas a abertura é mais curta (o VS do rival fica um pouco mais para dar tempo de ler o prêmio)
    j.durIntro = j.rodada === 1 ? (j.depoisCartas ? (j.rival ? 1.5 : 1.0) : RODADA.introPrimeira) : RODADA.intro;
    if (j.tempoFase >= j.durIntro) {
      j.fase = "luta"; j.tempoFase = 0;
      if (!j.demo) som("lute");
      if (j.bots[1] && typeof emote === "function") emote(M.bolinhas[1], "!", 0.8);
    }
    return;
  }
  if (j.fase === "luta") {
    // últimos segundos: dano em dobro (quase toda rodada acaba em derrota, não em empate)
    M.multDano = CONFIG.multDano * (M.multInicio || 1) * (j.relogio <= RODADA.danoDobro ? 2 : 1);
    if (!j.avisouDobro && j.relogio <= RODADA.danoDobro) { j.avisouDobro = true; if (!j.demo) som("alarme"); }
    passoMundo(j, M, true, 1);
    j.relogio -= FIS.dt;
    if (j.tuto) passoTutorial(j, M);
    if (M.morreu) {
      const vivos = M.bolinhas.filter(function(b) { return b.viva; });
      j.vencedorRodada = vivos.length === 1 ? vivos[0].lado : 0;
      j.fase = "fimRodada"; j.tempoFase = 0;
      // ganhou a rodada contra o bot: moedas saem de onde ele caiu e voam para o placar (desenho.js)
      if (!j.demo && j.modo !== "2p" && j.modo !== "online" && j.vencedorRodada === 1 && M.ko) j.chuva = { x: M.ko.x, y: M.ko.y, n: j.modo === "sobrevivencia" ? 8 : 6, t0: performance.now() };
      // v19: efeito de K.O. escolhido na personalização (de quem derrubou, se for pessoa)
      const vk = j.vencedorRodada && j.visuais ? j.visuais[j.vencedorRodada - 1] : null;
      if (!j.demo && M.ko && M.ko.humano && vk && vk.ko) efeitoKO(vk.ko, M.ko.x, M.ko.y, j.cores[j.vencedorRodada - 1]);
      if (!j.demo) Poki.jogando(false);      // pausa natural: a gameplay para até a próxima rodada
      return;
    }
    if (j.relogio <= 0) comecarQueda(j);
    return;
  }
  if (j.fase === "fimRodada") {
    // câmera lenta no começo do fim da rodada (mais longa e mais lenta num K.O.)
    passoMundo(j, M, true, M.ko ? (j.tempoFase < 1.1 ? 0.25 : 1) : (j.tempoFase < 0.7 ? 0.35 : 1));
    festejar(j, M, j.vencedorRodada);
    if (j.tempoFase >= (j.M.ko ? RODADA.fim : RODADA.semKo)) fecharRodada(j);   // v18.2: sem K.O. (tempo, queda de braço) é mais curto
  }
}

// Tutorial desenhado (1ª partida): uma ação de cada vez, na ordem atirar -> andar -> pular; o que a pessoa já
// fez sozinha é pulado e cada dica some assim que ela faz (o desenho fica em desenho.js)
function passoTutorial(j, M) {
  const tu = j.tuto;
  // v18.3: conta ACERTOS (antes 3 tiros errados já tiravam a dica de quem não estava entendendo)
  const tiros = M.stats.acertos[0] + (tu.so ? 0 : j.total.acertos[0]);   // dica que voltou: conta só os desta rodada
  const passo = tiros < 3 ? "tiro" : tu.andou < 0.5 ? "andar" : !tu.pulou ? "pulo" : null;
  if (tu.so && passo !== "tiro") { j.tuto = null; return; }
  if (!passo) { j.tuto = null; if (!j.demo) Eventos.marco("tutorial-done"); return; }
  if (passo !== tu.passo) { tu.passo = passo; tu.tempo = 0; }
  tu.tempo += FIS.dt;
}

// avança o mundo; "lento" < 1 deixa tudo mais devagar (câmera lenta)
function passoMundo(j, M, controles, lento) {
  // micro-pausa no impacto (hit-stop): o mundo congela alguns quadros e a tela continua tremendo
  if (M.pausa > 0) { M.pausa--; return; }
  j.acumLento = (j.acumLento || 0) + lento;
  if (j.acumLento < 1) return;
  j.acumLento -= 1;
  M.t += FIS.dt;
  M.passo++;
  atualizarPlataformas(M.plats, M.t);
  if (M.bumpers) M.bumpers.forEach(function(u) { if (u.flash > 0) u.flash = Math.max(0, u.flash - FIS.dt * 4); });

  for (let k = 0; k < 2; k++) {
    const b = M.bolinhas[k];
    let ent;
    const bot = j.bots[k];
    if (!controles || !b.viva) ent = PARADO;
    else if (bot) ent = pensarBot(bot, M, b);
    else ent = entradaHumana(b.lado, b);
    b.ent = ent;
    const yAntes = b.vy;
    moverBolinha(b, ent, M.cen, M.plats, M.t, M.bumpers);
    animarBolinha(b, yAntes);
    if (k === 0 && j.tuto && controles) { if (ent.esq || ent.dir) j.tuto.andou += FIS.dt; if (b.evento === "pulo") j.tuto.pulou = true; }
    if (b.evento === "caiu") {
      // contra o bot, a 1ª queda da rodada não mata: a pessoa volta para o ponto de partida com -25 de vida
      // (no Poki v10 o jogador perdia 85% no dojô e 76% na cidade; na simulação, mais da metade era por cair)
      if (b.humano && M.contraBot && !b.resgatado && b.vida > 25) resgatar(M, b);
      else { b.vida = 0; matar(M, b); }
    }
    else if (b.evento === "lava") causarDano(M, b, 18, null, 0, -1, 0);
    else if (b.evento === "pulo") { if (!M.mudo) som("pulo"); if (typeof Efeitos !== "undefined" && b.noChao === false && b.tempoNoAr > 0.2) Efeitos.poeira(b.x, b.y + b.r); }
    else if (b.evento === "aterrissou" && typeof Efeitos !== "undefined" && Math.abs(yAntes) > 6) Efeitos.poeira(b.x, b.y + b.r * gravSinal(M.cen, M.t));
    else if (b.evento === "portal" && typeof Efeitos !== "undefined") Efeitos.teleporte(b.x, b.y, b.cor);
    else if (b.evento === "bumper" && !M.mudo) som("mola");
    else if (b.evento === "preso" && b.humano && !M.mudo) { som("clique", 0.55); if (typeof ArteArmas !== "undefined" && ArteArmas.soltar) ArteArmas.soltar("pingo", b.x, b.y + b.r * 0.6, 3); }
    if (controles) usarArma(M, b, ent.tiro, ent.apertouTiro);
    atualizarEfeitos(M, b);
    if (b.rastroFx) atualizarRastro(M, b);
  }
  separarBolinhas(M.bolinhas[0], M.bolinhas[1]);
  atualizarProjeteis(M);
  atualizarAvisos(M);
  if (controles) { atualizarItens(M); atualizarMeteorosDoCenario(M); }
  for (let i = M.feixes.length - 1; i >= 0; i--) {
    const f = M.feixes[i];
    f.vida -= FIS.dt / f.dur;
    if (f.vida <= 0) M.feixes.splice(i, 1);
  }
  // eventos para o painel do Poki (só o jogador de verdade)
  if (M.pegou) {
    M.pegou.forEach(function(p) {
      const b = M.bolinhas[p.lado - 1];
      const rar = ARMA[p.arma].raridade;
      if (typeof Efeitos !== "undefined") {
        // arma rara/lendária: nome maior, anel extra e um tremidinho (v14)
        Efeitos.texto(b.x, b.y - b.r - 34, t("a_" + p.arma), ["#ffffff", "#ffffff", "#d0bfff", "#ffd43b"][rar], rar >= 2 ? 1.35 : 1.1);
        if (rar >= 2 && b.humano) { Efeitos.anel(b.x, b.y, rar >= 3 ? "#ffd43b" : "#b197fc", 70); Efeitos.tremer(rar >= 3 ? 6 : 3); }
      }
      if (!j.demo && (p.lado === 1 || j.modo === "2p")) Poki.medir("weapon", p.arma, "interact");
      if (p.lado === 1) j.viuCaixa = true;
      registrar(j, p.lado, "caixas", 1, { arma: p.arma });
    });
    M.pegou = null;
  }
  if (!j.demo && M.ultimaCarta && !M.ultimaCarta.medida) {
    M.ultimaCarta.medida = true;
    if (M.ultimaCarta.lado === 1 || j.modo === "2p") Poki.medir("card", M.ultimaCarta.id, "interact");
    if (M.ultimaCarta.lado === 1) j.viuCarta = true;
    registrar(j, M.ultimaCarta.lado, "cartas", 1, { carta: M.ultimaCarta.id });
  }
}
const PARADO = { esq: false, dir: false, pulo: false, segPulo: false, baixo: false, tiro: false, apertouTiro: false };

function entradaHumana(j, b) {
  // v19: no online, a bolinha 2 do anfitrião é a pessoa do outro aparelho
  if (j === 2 && jogo && jogo.modo === "online" && typeof Online !== "undefined") return Online.entradaRemota(b);
  const apertouTiro = entrada.apertou(j, "tiro");
  entrada.apertou(j, "toque");
  // mira livre (mouse, analógico de mira no toque, analógico direito do controle) ou assistida (null)
  const m = entrada.mira(j);
  if (!m) b.miraLivre = null;
  else if (m.ang !== undefined) b.miraLivre = m.ang;
  else {
    // mouse: da tela para o mundo (em pé a câmera aproxima e anda)
    const w = typeof telaParaMundo === "function" ? telaParaMundo(m.x, m.y) : { x: m.x, y: m.y - deslocMundo() };
    b.miraLivre = Math.atan2(w.y - b.y, w.x - b.x);
  }
  return {
    esq: entrada.segurando(j, "esquerda"),
    dir: entrada.segurando(j, "direita"),
    pulo: entrada.apertou(j, "pulo"),
    segPulo: entrada.segurando(j, "pulo"),
    baixo: entrada.segurando(j, "baixo"),
    tiro: entrada.segurando(j, "tiro") || apertouTiro,
    apertouTiro: apertouTiro
  };
}

// volta a pessoa que caiu da arena para o ponto de partida dela (uma vez por rodada)
function resgatar(M, b) {
  const sp = M.cen.spawn[b.lado - 1];
  if (typeof Efeitos !== "undefined") Efeitos.teleporte(b.x, Math.min(b.y, 700), b.cor);
  b.resgatado = true;
  b.x = sp[0]; b.y = sp[1] - 40; b.vx = 0; b.vy = 0;
  b.vida -= 25; b.flash = 1; b.dor = 0.35;
  if (typeof Efeitos !== "undefined") { Efeitos.teleporte(b.x, b.y, b.cor); Efeitos.texto(b.x, b.y - b.r - 30, t("salvo"), "#69db7c", 1.2); }
  somJogo(M, "pegar");
}

// amassa e estica a bolinha (pulo e aterrissagem) e escolhe a expressão
function animarBolinha(b, vyAntes) {
  if (b.escalaX === undefined) { b.escalaX = 1; b.escalaY = 1; b.piscar = 0; b.proxPiscar = 2 + Math.random() * 3; }
  if (b.evento === "pulo") { b.escalaX = 0.82; b.escalaY = 1.2; }
  if (b.evento === "aterrissou" && Math.abs(vyAntes) > 5) { b.escalaX = 1.25; b.escalaY = 0.78; }
  b.escalaX += (1 - b.escalaX) * 0.18;
  b.escalaY += (1 - b.escalaY) * 0.18;
  b.proxPiscar -= FIS.dt;
  if (b.proxPiscar <= 0) { b.piscar = 1; b.proxPiscar = 2 + Math.random() * 4; }
  b.piscar = Math.max(0, b.piscar - FIS.dt * 8);
}

function nivelDaOnda(n) { return Math.min(1, 0.12 + (n - 1) * 0.075); }

function fecharRodada(j) {
  const M = j.M;
  const v = j.vencedorRodada;
  if (v && j.modo !== "sobrevivencia") j.pontos[v - 1]++;
  for (let k = 0; k < 2; k++) {
    j.total.dano[k] += M.stats.dano[k];
    j.total.tiros[k] += M.stats.tiros[k];
    j.total.acertos[k] += M.stats.acertos[k];
  }
  j.total.rodadas.push(v);
  registrar(j, 1, "dano", Math.round(M.stats.dano[0]));
  if (v === 1) {
    const [b1, b2] = M.bolinhas;
    registrar(j, 1, "rodadas", 1, { cenario: M.cen.id });
    if (!(b1.danoRecebido > 0)) registrar(j, 1, "perfeitas", 1);
    if (!b2.viva && b2.ultimoAtacante === 1 && b2.ultimaArmaAtk) {
      const a = ARMA[b2.ultimaArmaAtk];
      if (a.explode || a.tipo === "ceu") registrar(j, 1, "abatesExpl", 1);
      if (a.tipo === "melee") registrar(j, 1, "abatesMelee", 1);
    }
    if (j.queda && j.queda.vencedor === 1) registrar(j, 1, "quedas", 1);
  }
  // maior desvantagem do jogador 1 na partida (para a conquista da virada)
  j.piorDiferenca = Math.max(j.piorDiferenca || 0, j.pontos[1] - j.pontos[0]);
  if (!j.demo && j.modo === "bot") {
    Poki.medir("arena", M.cen.id, v === 1 ? "complete" : "fail");
    if (save.partidas <= 2) {
      Poki.medir("round", "m" + save.partidas + "-r" + j.rodada, v === 1 ? "complete" : "fail");
      // 1ª rodada: o jogador atira? acerta? (separa "não entendeu o controle" de "atira e erra")
      if (j.rodada === 1) {
        const faixa = function(n, lim) { for (let i = 0; i < lim.length; i++) if (n <= lim[i]) return lim[i] === 0 ? "0" : "ate" + lim[i]; return "mais"; };
        Poki.medir("player", "r1-tiros-" + faixa(M.stats.tiros[0], [0, 5, 20]), "complete");
        Poki.medir("player", "r1-acertos-" + faixa(M.stats.acertos[0], [0, 2, 5]), "complete");
      }
    }
    // o bot se ajusta já dentro da partida, devagar (sem "elástico" forte): perdeu a rodada -> bot mais fraco
    // (v14: partida até 3 tem metade das rodadas para o ajuste agir; -0,1 virou -0,15 — na simulação o rival 5/7
    // ficava bem mais difícil para o novato sem isso)
    const bot = j.bots[1];
    if (bot && v) {
      const novo = limitar(bot.nivel + (v === 2 ? -0.15 : 0.03), 0, 1);
      j.bots[1] = criarBot(2, novo, bot.estilo);
    }
    // perdeu sem acertar nada: mostra de novo como mirar e atirar na próxima rodada
    if (v === 2 && M.stats.acertos[0] === 0) j.dicaRodada = j.rodada + 1;
  }
  if (j.modo === "sobrevivencia") {
    if (v === 1) {
      // venceu a onda: recupera um pouco de vida e vem um bot mais forte
      j.onda++;
      j.pontos[0] = j.onda - 1;
      j.vidaJogador = Math.min(100, Math.max(1, M.bolinhas[0].vida) + 35);
      j.bots[1] = criarBot(2, nivelDaOnda(j.onda));
      Poki.medir("survival", "wave-" + j.onda, "start");
      if (j.onda <= 30) Eventos.marco("wave-" + j.onda);
      proximaRodadaComIntervalo(j);
    } else {
      j.vencedorPartida = 2;
      j.fase = "fimPartida"; j.tempoFase = 0;
      som("derrota");
    }
    return;
  }
  if (j.pontos[0] >= j.alvo || j.pontos[1] >= j.alvo) {
    j.vencedorPartida = j.pontos[0] > j.pontos[1] ? 1 : 2;
    j.fase = "fimPartida"; j.tempoFase = 0;
    if (!j.demo) som(j.modo === "bot" && j.vencedorPartida === 2 ? "derrota" : "vitoria");
    return;
  }
  if (j.demo && j.rodada > 40) { novaPartida("demo"); return; }
  if (!j.demo) { proximaRodadaComIntervalo(j); return; }
  iniciarRodada();
}

// Entre as rodadas é uma pausa natural: pede o intervalo comercial ao Poki (ele decide se mostra; na
// maioria das vezes não mostra, por causa do limite de frequência dele). Nas 2 primeiras partidas da pessoa
// não pede nada entre as rodadas (nos testes, quem acabou de chegar saía no 1º anúncio). O jogo fica parado e mudo
// enquanto o anúncio estiver na tela.
function proximaRodadaComIntervalo(j) {
  const novato = save.partidas <= 2;
  // v16: no meio da partida não pede anúncio (rodadas de ~25 s: cortar a luta no meio espanta); o pedido fica antes de
  // cada partida (telas.js). Na sobrevivência a pausa entre ondas é a única: lá continua, mas a cada 3 ondas
  // (v18: antes pedia em toda onda, a cada 6–30 s)
  if (novato || j.esperandoAnuncio || j.modo !== "sobrevivencia" || j.onda % 3 !== 1) { iniciarRodada(); return; }
  j.esperandoAnuncio = true;
  j.fase = "intervalo";
  Poki.jogando(false);
  Poki.intervalo().then(function() {
    j.esperandoAnuncio = false;
    if (jogo !== j) return;               // saiu da partida enquanto isso
    iniciarRodada();
    if (estado === "jogo") Poki.jogando(true);
  });
}

// ---------- queda de braço ----------
function comecarQueda(j) {
  const [b1, b2] = j.M.bolinhas;
  // quem tem mais vida já começa na frente (até 35% do caminho)
  const vantagem = limitar((b2.vida - b1.vida) / 100, -1, 1) * 0.35;
  j.fase = "queda";
  j.tempoFase = 0;
  j.queda = { pos: vantagem, toques1: 0, toques2: 0, t: 0, vencedor: 0, pulso1: 0, pulso2: 0 };
  j.total.quedas++;
  entrada.limparApertos();
  if (!j.demo) { Eventos.marco("arm-wrestling"); som("apito"); }
  j.bots.forEach(function(bot) { if (bot) bot.proxClique = 0.25 + Math.random() * 0.3; });
}

const PASSO_QUEDA = 0.058;
function atualizarQueda(j) {
  const q = j.queda;
  q.pulso1 = Math.max(0, q.pulso1 - FIS.dt * 6);
  q.pulso2 = Math.max(0, q.pulso2 - FIS.dt * 6);
  if (q.vencedor) {
    if (j.tempoFase >= RODADA.quedaFim) { j.vencedorRodada = q.vencedor; fecharRodada(j); }
    return;
  }
  if (j.tempoFase < RODADA.quedaIntro) { entrada.limparApertos(); return; }
  q.t += FIS.dt;
  for (let k = 1; k <= 2; k++) {
    const bot = j.bots[k - 1];
    let clicou;
    if (bot) clicou = botClica(bot, q.t);
    else {
      // um clique/toque pode chegar como "tiro" e "toque" ao mesmo tempo: conta uma vez só
      if (k === 2 && j.modo === "online" && typeof Online !== "undefined") clicou = Online.cliqueRemoto();
      else {
        const a = entrada.apertou(k, "tiro"), b2 = entrada.apertou(k, "toque"), c = entrada.apertou(k, "pulo");
        clicou = a || b2 || c;
      }
    }
    if (!clicou) continue;
    if (k === 1) {
      q.toques1++; q.pos -= PASSO_QUEDA; q.pulso1 = 1;
      // v19.6: no celular cada toque vibra de leve
      if (!j.bots[0]) vibrar(12);
    }
    else { q.toques2++; q.pos += PASSO_QUEDA; q.pulso2 = 1; }
    if (!j.demo) som("clique");
  }
  if (q.pos <= -1 || q.pos >= 1 || q.t >= RODADA.quedaMax) {
    q.pos = limitar(q.pos, -1, 1);
    q.vencedor = q.pos < 0 ? 1 : q.pos > 0 ? 2 : (Math.random() < 0.5 ? 1 : 2);
    j.tempoFase = 0;
    if (!j.demo) Poki.jogando(false);
    if (!j.demo) som("vitoria_rodada");
    if (typeof Efeitos !== "undefined") Efeitos.tremer(8);
  }
}

// ---------- fim ----------
// Desempenho do jogador contra o bot (0 a 1): metade rodadas, metade dano trocado
function desempenhoDoJogador(j) {
  const r = j.total.rodadas;
  const minhas = r.filter(function(v) { return v === 1; }).length;
  const rodadas = r.length ? minhas / r.length : 0.5;
  const d = j.total.dano;
  const dano = d[0] + d[1] > 0 ? d[0] / (d[0] + d[1]) : 0.5;
  return rodadas * 0.55 + dano * 0.45;
}

// O bot da próxima partida: se o jogador foi bem, fica BEM mais forte; se foi mal, mais fraco.
// Mira em ~50% de vitórias. Vai de 0,1 (nível 1) a 1 (nível 10).
// partidas = quantas partidas a pessoa já começou. Nas 3 primeiras o bot sobe no máximo +0,05 por partida
// (Poki v8: depois de vencer a 1ª, a pessoa perdia 66% da 1ª rodada da 2ª partida); depois, no máximo +0,12.
function proximoNivelBot(nivel, desempenho, venceu, partidas) {
  const alvo = nivel + (desempenho - 0.5) * 0.6 + (venceu ? 0.04 : -0.05);
  const teto = nivel + ((partidas || 99) <= 3 ? 0.05 : 0.12);
  return limitar(Math.min(alvo, teto), 0, 1);
}
function nivelBotTexto(nivel) { return Math.round(nivel * 9) + 1; }   // 1 a 10, para mostrar

// ---------- v20.5: CARTAS DE ARMA da abertura (no lugar das roletas da v19) ----------
// 3 cartas viradas; cada uma esconde uma arma (sortearArmaCarta: comum 75%, rara 22%, lendária 3%, mais a Sorte; sem
// repetir). A pessoa escolhe às cegas: toque/clique na carta, teclas 1/2/3, ou ←/→ e pulo/tiro. Sem escolha em 3 s,
// uma ao acaso. A escolhida vira; logo depois as outras se revelam (o "quase" da lendária). Com ARMA INICIAL: se a carta
// for de raridade MAIOR, a pessoa fica com ela nesta rodada ("MELHOR!"); se não, continua com a inicial.
// Só a pessoa escolhe: o bot fica com a arma sorteada da rodada. Eventos (os mesmos da v18.3): choice/weapon (visible),
// choice/weapon-rN[-auto] (interact) e, com arma inicial, choice/weapon-upgrade ou weapon-start.
// Desenho: arte/cartas_arma.js (CartasArma.desenhar), chamado pelo desenho.js na fase "cartas".
const ESCOLHA_CARTA = { guarda: 0.45, auto: 3.0, vira: 0.3, outras: 0.5, fim: 1.45, pula: 0.6 };

// arma de uma carta: sortearArma; a Sorte (melhoria) dá uma 2ª chance e fica a de raridade maior
function sortearArmaCarta(M, b) {
  let id = sortearArma(M, true, true);
  const sorte = b.humano && typeof sorteJogador === "function" ? sorteJogador() : 0;
  if (sorte > 0 && Math.random() < sorte * 0.6) {
    const outra = sortearArma(M, true, true);
    if (ARMA[outra].raridade > ARMA[id].raridade) id = outra;
  }
  return id;
}

function iniciarCartas(j, M) {
  const b = M.bolinhas[0], armas = [];
  for (let n = 0; armas.length < 3 && n < 60; n++) { const id = sortearArmaCarta(M, b); if (armas.indexOf(id) < 0) armas.push(id); }
  while (armas.length < 3) armas.push(armas[armas.length - 1]);
  j.cartas = { t: 0, armas: armas, ini: j.armaInicial && j.armaInicial[0] || null, sel: null, tSel: 0, auto: false,
    foco: 1, melhor: false, final: null, deu: 0, revelou: false, outras: false, rects: null, mx: -1, my: -1 };
  j.fase = "cartas";
  j.tempoFase = 0;
  entrada.limparApertos();
  // a faixa de prêmios da partida anterior espera as cartas (senão briga pela atenção)
  if (typeof faixaPremio !== "undefined" && faixaPremio) { j.faixaVelho = faixaPremio.velho; faixaPremio.velho = j; }
  Poki.medir("choice", "weapon", "visible");
}

function atualizarCartas(j) {
  const c = j.cartas;
  if (!c) { j.fase = "intro"; j.tempoFase = 0; return; }
  c.t += FIS.dt;
  // as cartas chegam uma a uma (o desenho usa o mesmo tempo)
  if (c.deu < 3 && c.t >= 0.12 + c.deu * 0.09) { som("quique", 0.9 + 0.2 * c.deu); c.deu++; }
  // gasta os apertos todo passo (um clique antigo não vale depois)
  const esq = entrada.apertou(1, "esquerda"), dir = entrada.apertou(1, "direita");
  const ok = entrada.apertou(1, "pulo") | entrada.apertou(1, "tiro") | entrada.apertou(1, "toque");
  if (c.sel === null) {
    if (c.t < ESCOLHA_CARTA.guarda) return;
    if (esq && c.foco > 0) { c.foco--; som("quique", 1.3); }
    if (dir && c.foco < 2) { c.foco++; som("quique", 1.3); }
    if (ok) escolherCarta(c.foco);
    else if (c.t >= ESCOLHA_CARTA.auto) escolherCarta(Math.floor(Math.random() * 3), true);
    return;
  }
  const d = c.t - c.tSel;
  if (!c.revelou && d >= ESCOLHA_CARTA.vira / 2) {
    c.revelou = true;
    const rar = ARMA[c.armas[c.sel]].raridade;
    if (rar >= 3) { som("vitoria_rodada"); som("moeda"); }
    else som(rar === 2 ? "moeda" : "pegar");
  }
  if (!c.outras && d >= ESCOLHA_CARTA.outras + ESCOLHA_CARTA.vira / 2) { c.outras = true; som("quique", 0.7); }
  if (ok && d >= ESCOLHA_CARTA.pula) c.t = c.tSel + ESCOLHA_CARTA.fim;
  if (c.t - c.tSel >= ESCOLHA_CARTA.fim) fimCartas(j);
}

// i = 0, 1 ou 2 (toque/clique na carta e teclas 1/2/3: telas.js; ←/→ e pulo/tiro: atualizarCartas)
function escolherCarta(i, auto) {
  const j = jogo, c = j && j.cartas;
  if (!c || j.fase !== "cartas" || c.sel !== null || !(i >= 0 && i <= 2)) return;
  if (!auto && c.t < ESCOLHA_CARTA.guarda) return;
  const id = c.armas[i], rar = ARMA[id].raridade;
  c.sel = i; c.tSel = c.t; c.auto = !!auto; c.foco = i;
  c.melhor = !!c.ini && rar > ARMA[c.ini].raridade;
  c.final = c.ini && !c.melhor ? c.ini : id;
  equipar(j.M.bolinhas[0], c.final);
  som("clique");
  Poki.medir("choice", "weapon-r" + rar + (auto ? "-auto" : ""), "interact");
  if (c.ini) Poki.medir("choice", c.melhor ? "weapon-upgrade" : "weapon-start", "interact");
}

function fimCartas(j) {
  j.fase = "intro";
  j.tempoFase = 0;
  j.depoisCartas = true;
  if (typeof faixaPremio !== "undefined" && faixaPremio && faixaPremio.velho === j) faixaPremio.velho = j.faixaVelho;
}

// ---------- v19: rastro, efeito de K.O. e comemoração (personalização) ----------
// rastro: o motor só guarda por onde a bolinha passou (o desenho é do ArteSkins); menos pontos no modo leve
function atualizarRastro(M, b) {
  const fx = b.rastroFx, pts = fx.pts;
  for (let i = 0; i < pts.length; i++) pts[i].a += FIS.dt;
  while (pts.length && pts[0].a > fx.vida) pts.shift();
  const vel = Math.abs(b.vx) + Math.abs(b.vy);
  if (!b.viva || vel < 1.6 || (M.passo % (CONFIG.leve ? 3 : 2))) return;
  if (pts.length >= (CONFIG.leve ? 9 : 14)) pts.shift();
  pts.push({ x: b.x, y: b.y, a: 0, s: fx.n++ });
}

// efeito extra no K.O. (com as partículas do Efeitos, por cima do estouro normal)
function efeitoKO(id, x, y, cor) {
  if (typeof Efeitos === "undefined") return;
  const E = Efeitos;
  switch (id) {
    case "k_estrelas": E.acerto(x, y, "#ffd43b"); E.acerto(x - 40, y - 30, "#fff3bf"); E.acerto(x + 40, y - 20, "#ffd43b"); E.anel(x, y, "#ffd43b", 90); break;
    case "k_fogos": ["#ff6b9d", "#4dabf7", "#ffd43b", "#51cf66"].forEach(function(c, i) { const a = i * 1.57 + 0.6; E.anel(x + Math.cos(a) * 60, y + Math.sin(a) * 50 - 30, c, 60); E.fagulhas(x + Math.cos(a) * 60, y + Math.sin(a) * 50 - 30, c, 8); }); break;
    case "k_gelo": E.congelar(x, y); E.anel(x, y, "#a5d8ff", 100); E.fagulhas(x, y, "#e7f5ff", 12); break;
    case "k_portal": E.teleporte(x, y, "#b197fc"); E.anel(x, y, "#9775fa", 120); E.anel(x, y, "#e5dbff", 70); break;
    case "k_explosao": E.explosao(x, y, 95); E.tremer(14); break;
    case "k_raio": E.anel(x, y, "#ffe066", 110); E.fagulhas(x, y, "#ffe066", 18); E.fagulhas(x, y, "#ffffff", 10); E.tremer(10); break;
    case "k_moedas": E.fagulhas(x, y, "#fcc419", 22); E.anel(x, y, "#fcc419", 90); E.acerto(x, y - 30, "#fcc419"); break;
    case "k_supernova": E.explosao(x, y, 120); E.anel(x, y, "#ffffff", 170); E.anel(x, y, "#ffd43b", 120); E.fagulhas(x, y, "#74c0fc", 14); E.fagulhas(x, y, "#ff6b9d", 14); E.tremer(18); break;
  }
}

// comemoração de quem venceu (emote da personalização): dancinha, pulinhos ou pulão
function festejar(j, M, lado) {
  if (j.demo || !lado || !j.visuais) return;
  const e = SKIN[j.visuais[lado - 1].emote];
  const b = M.bolinhas[lado - 1];
  if (!e || !b || !b.viva || j.tempoFase < 0.35) return;
  const tf = j.tempoFase, g = typeof gravSinal === "function" ? gravSinal(M.cen, M.t) : 1;
  if (b.festaFase !== j.fase) { b.festaFase = j.fase; b.proxFesta = 0; }
  if (e.mov === "danca") { b.escalaX = 1 + 0.13 * Math.sin(tf * 16); b.escalaY = 2 - b.escalaX; }
  else if (b.noChao && (!b.proxFesta || tf >= b.proxFesta)) {
    b.vy = -(e.mov === "pulao" ? 10 : 6.5) * g;
    b.proxFesta = tf + (e.mov === "pulao" ? 0.75 : 0.42);
  }
}

function terminarPartida() {
  const j = jogo;
  if (j.demo) { novaPartida("demo"); return; }
  // uma vez só por fim de partida. Enquanto a próxima não começa (o pedido de anúncio, ou mais passos no mesmo
  // quadro — o loop faz até 5), o passo continua chamando aqui: no fluxo direto da v16 os prêmios e os eventos
  // rival/... complete vinham 2–3 vezes e a tela de fim chegava a abrir por baixo (v17)
  if (j.terminou) return;
  j.terminou = true;
  aoTerminarPartida(j);   // telas.js
}
