"use strict";

// =========================
// O BOT (v19: bem mais esperto e mais "gente"; a força continua no NÍVEL)
// 1. MOVIMENTO: várias vezes por segundo testa ~18 jeitos de se mexer (andar, pular, pulo duplo, descer, nadar...)
//    simulando a MESMA física do jogo ~0,5–0,8 s para frente e dá nota para cada um:
//      - perigo: lê a TRAJETÓRIA dos tiros (gravidade, quiques, granadas, minas, meteoros) e a LINHA DA MIRA do oponente
//        (sai da frente do laser/sniper antes do tiro), lava, cair do mapa, martelo/escopeta de perto, torreta do outro;
//      - distância boa para a arma (martelo quer colar, sniper quer longe; arma de longe não fica colada);
//      - COBERTURA: atrás de parede quando recarrega, quando está fraco (RECUA) ou quando a arma dele é pior;
//      - CAMINHO até caixas/cartas escolhidas pela UTILIDADE (cura vale mais com pouca vida, fúria com arma boa...);
//      - usar o cenário: empurrar o oponente para a beirada e ficar longe dela; subir quando a lava sobe;
//      - FINTA (vai e volta), COMBO (oponente lento/grudado/no ar: parte para cima) e a bomba grudada (abraça o outro).
// 2. MIRA LIVRE: prevê ONDE o oponente vai estar (simula a física dele: cai, pousa, para na parede) e mira lá;
//    granada em arco (alto, por cima da parede, quando o baixo bate), tiro de tabela com o disco, laser de longe,
//    golpe de perto, armadilha no caminho. Só atira quando a simulação do tiro diz que acerta.
// 3. NÍVEL (0 a 1): reação, decisões por segundo, erro de mira, quantos tiros enxerga, hesitação, tática, previsão,
//    leitura da mira, fintas e velocidade na queda de braço. Bot fraco: esperto no jeito, fraco de propósito
//    (erra, demora, tiros de aviso). Muda depois de cada partida pelo desempenho do jogador.
// 4. PERSONALIDADE (estilo, aparece no HUD) e PROVOCAÇÕES em balão (texto curto do idioma, sem emoji).
// =========================

function lerp(a, b, k) { return a + (b - a) * k; }

// Personalidades: cada partida o bot ganha um jeito de jogar (variedade)
//   dist: distância preferida | pressiona: atira "no aperto" | coleta: liga para caixa/carta | tatica: usa o cenário
//   pulo: pula à toa | perigo: medo de levar tiro | finta: vai-e-volta | provoca: balões | recua: foge quando está fraco
//   cobre: usa cobertura | perto: gosta de arma de perto | armadilha: gosta de mina/banana/torreta
const ESTILOS_BOT = {
  agressivo:    { dist: 0.6, pressiona: 1.4, coleta: 0.7, tatica: 0.7, pulo: 0.15, perigo: 0.85, finta: 0.4, provoca: 0.8, recua: 0.3, cobre: 0.4, perto: 1.2, armadilha: 0.6 },
  atirador:     { dist: 1.45, pressiona: 1.0, coleta: 0.9, tatica: 1.3, pulo: 0.05, perigo: 1.0, finta: 0.3, provoca: 0.6, recua: 1.0, cobre: 1.2, perto: 0.6, armadilha: 0.8 },
  saltitante:   { dist: 1.0, pressiona: 1.0, coleta: 1.1, tatica: 0.8, pulo: 0.7, perigo: 1.0, finta: 0.8, provoca: 1.0, recua: 0.6, cobre: 0.5, perto: 1.0, armadilha: 0.7 },
  cauteloso:    { dist: 1.2, pressiona: 0.8, coleta: 1.0, tatica: 1.2, pulo: 0.2, perigo: 1.4, finta: 0.3, provoca: 0.4, recua: 1.4, cobre: 1.5, perto: 0.7, armadilha: 1.0 },
  colecionador: { dist: 1.0, pressiona: 0.9, coleta: 1.7, tatica: 0.9, pulo: 0.25, perigo: 1.0, finta: 0.4, provoca: 0.7, recua: 0.8, cobre: 0.8, perto: 1.0, armadilha: 1.0 },
  // v19: novas
  ninja:        { dist: 0.75, pressiona: 1.2, coleta: 0.9, tatica: 1.0, pulo: 0.55, perigo: 1.2, finta: 1.5, provoca: 0.7, recua: 0.8, cobre: 0.9, perto: 1.6, armadilha: 0.8 },
  provocador:   { dist: 0.9, pressiona: 1.0, coleta: 0.9, tatica: 0.9, pulo: 0.35, perigo: 1.0, finta: 1.1, provoca: 2.6, recua: 0.6, cobre: 0.6, perto: 1.0, armadilha: 0.8, danca: true },
  furioso:      { dist: 0.55, pressiona: 1.5, coleta: 0.6, tatica: 0.6, pulo: 0.2, perigo: 0.75, finta: 0.2, provoca: 1.0, recua: 0, cobre: 0.2, perto: 1.4, armadilha: 0.4, furia: true },
  estrategista: { dist: 1.15, pressiona: 0.9, coleta: 1.3, tatica: 1.5, pulo: 0.15, perigo: 1.25, finta: 0.7, provoca: 0.5, recua: 1.2, cobre: 1.6, perto: 0.8, armadilha: 1.7 }
};

function criarBot(lado, nivel, estilo) {
  const d = limitar(nivel, 0, 1);
  const nomes = Object.keys(ESTILOS_BOT);
  const nomeEstilo = estilo && ESTILOS_BOT[estilo] ? estilo : nomes[Math.floor(Math.random() * nomes.length)];
  const e = ESTILOS_BOT[nomeEstilo];
  // "aprendiz" (1 no nível mais baixo, 0 a partir de 0,35): o bot de quem acabou de chegar.
  // Calibrado com um jogador humano simulado que reproduz os dados do Poki (v8: humano vencia só ~31% da 1ª rodada).
  const ap = 1 - Math.min(1, d / 0.35);
  // v19: "esperteza" — o que é JEITO de lutar (cobertura, finta, previsão, leitura da mira) cresce com o nível,
  // mas começa acima de zero: o bot fraco já parece esperto, só erra e demora mais.
  const esp = limitar((d - 0.1) / 0.6, 0, 1);
  return {
    lado: lado,
    nivel: d,
    estilo: nomeEstilo, e: e,
    reacao: lerp(0.5, 0.08, d),            // atraso para perceber (s)
    intervalo: lerp(0.26, 0.06, d),        // tempo entre decisões (s)
    horizonte: Math.round(lerp(24, 46, d)),// passos simulados
    enxerga: lerp(0.35, 0.95, d) * (1 - 0.5 * ap),   // chance de notar cada tiro vindo (aprendiz quase não desvia)
    hesita: lerp(0.45, 0.03, d),           // chance de não atirar num tiro bom
    chuta: lerp(0.02, 0.003, d),           // chance por passo de atirar "no chute"
    pressiona: lerp(0.05, 0.3, d) * e.pressiona,   // chance por passo de atirar quando está mais ou menos na mira
    tolerancia: lerp(1.5, 1.05, d),        // folga para achar que o tiro acerta
    erroMira: lerp(0.32, 0.035, d) + 0.15 * ap,   // erro de mira (radianos) — muda devagar, como a mão de um humano
    folgaTiro: 0.45 * ap,                  // aprendiz espera um pouco entre um tiro e outro (s)
    coleta: lerp(0.5, 1, d) * e.coleta,    // quanto liga para caixas e cartas
    tatica: lerp(0.2, 0.9, d) * e.tatica,  // quanto usa o cenário (beirada, altura, esconderijo)
    ruido: lerp(10, 1.2, d),               // bagunça na escolha do movimento
    cliques: lerp(4.6, 9.4, d),            // cliques por segundo na queda de braço
    // v19: jeito de lutar
    preve: esp,                            // 0 = mira onde o oponente está indo em linha reta; 1 = simula a física dele
    leMira: lerp(0.1, 0.9, esp) * (1 - 0.7 * ap),    // sai da linha da mira do oponente (laser, sniper...)
    cobre: lerp(0.35, 1, esp) * e.cobre,   // usa cobertura
    finta: lerp(0.25, 1, esp) * e.finta,   // fintas por segundo (aprox.)
    combo: lerp(0.35, 1, esp),             // aproveita o oponente lento/grudado/no ar
    arcoAlto: d >= 0.15,                   // granada por cima da parede
    tabela: d >= 0.3,                      // tiro de tabela (disco, pula-pula, serra)
    // iniciante: os primeiros tiros de cada rodada passam raspando de propósito (aviso, como em BioShock),
    // e o bot fraco não "caça" o jogador (sem relógio de paciência)
    graca: Math.round(lerp(4, 0, Math.min(1, d / 0.5))),
    caca: d >= 0.35,
    historico: [],                          // posições passadas do oponente (para o atraso de reação)
    plano: null, proxDecisao: 0, passosPlano: 0,
    proxClique: 0.3 + Math.random() * 0.3,
    vistos: new WeakMap(),                  // projétil -> notou ou não
    hesitouAte: 0,
    ruidoMira: 0, alvoRuido: 0, trocaRuido: 0,
    grafo: null, grafoM: null, nav: null,
    prev: new Float32Array(2 * 64), prevOk: false
  };
}

// ---------- valor das armas ----------
const VALOR_ARMA = {};
(function() {
  ARMAS.forEach(function(a) {
    let dps;
    if (a.tipo === "feixe") dps = a.dano * 60;
    else dps = a.dano * (a.qtd || 1) * (a.qtd > 3 ? 0.45 : 1) / Math.max(a.cadencia, 0.05);
    if (a.explode) dps *= 1.25;
    if (a.tipo === "ceu") dps = 40;
    if (a.tipo === "mina") dps = a.escorrega ? 22 : 30;
    if (a.tipo === "torreta") dps = 45;
    if (a.ima || a.levanta || a.infla || a.bolha || a.gruda) dps += 12;          // efeitos que abrem combo
    if (a.cresce) dps *= 1.4;
    VALOR_ARMA[a.id] = limitar(dps / 90, 0.1, 1.2) + (a.raridade || 0) * 0.08;
  });
})();

function distanciaBoa(a) {
  if (a.tipo === "melee") return 40;
  if (a.visual === "chama" || a.visual === "vento") return 120;
  if (a.tipo === "raio") return 230;
  if (a.tipo === "mina") return 220;
  if (a.tipo === "torreta") return 380;
  if (a.tipo === "ceu") return 380;
  if (a.rola) return 260;
  if (a.levanta || a.ima) return 260;
  if ((a.qtd || 1) >= 5 || a.vida && a.vida < 40) return 170;
  if (a.tipo === "laser" || a.dano >= 28 && !a.explode) return 440;
  if (a.explode && a.grav) return 300;
  if (a.volta) return 240;
  return 320;
}

// alcance perigoso do oponente de perto (martelo, espada, escopeta, lança-chamas...)
function perigoDePerto(a) {
  if (a.tipo === "melee") return a.alcance + 30;
  if (a.visual === "chama" || a.visual === "vento") return 170;
  if ((a.qtd || 1) >= 5) return 190;
  return 0;
}

// armas de tiro reto e rápido (sair da linha da mira do oponente adianta)
function tiroReto(a) {
  return a.tipo === "laser" || a.tipo === "feixe" || (a.tipo === "bala" && !(a.grav > 0.3) && (a.vel || 0) >= 15 && !a.teleguia);
}

// o oponente está numa situação ruim (lento, grudado, preso, escorregando, inflado, voando depois de um golpe)?
function vulneravel(o) {
  const ef = o.efeitos;
  return ef.congelado > 0 || ef.lento > 0.2 || ef.grudado > 0.2 || ef.bolha > 0.2 || ef.escorrega > 0.1 || ef.inflado > 0.3 ||
    (o.dor > 0 && !o.noChao && Math.abs(o.vx) > 5);
}

// ---------- percepção ----------
function lembrar(bot, o) {
  bot.historico.push({ x: o.x, y: o.y, vx: o.vx, vy: o.vy, chao: o.noChao });
  if (bot.historico.length > 40) bot.historico.shift();
}
// Onde o bot "acha" que o oponente está (com atraso de reação, projetado para frente)
function oponentePercebido(bot, o, M) {
  const atraso = Math.round(bot.reacao / FIS.dt);
  const h = bot.historico;
  const s = h[Math.max(0, h.length - 1 - atraso)] || o;
  const k = Math.min(atraso, h.length);
  let x = s.x + s.vx * k, y = s.y + s.vy * k * 0.5;
  if (o.efeitos.fantasma > 0) { x += Math.sin(M.t * 3.1) * 90; y += Math.cos(M.t * 2.3) * 50; }
  return { x: x, y: y, vx: s.vx, vy: s.vy, r: o.r, noChao: s.chao };
}

// v19: previsão com a física de verdade: o oponente continua andando para o lado que anda (sem pular),
// cai, pousa nas plataformas e para nas paredes. bot.prev[2k], bot.prev[2k+1] = posição daqui a k passos.
function preverOponente(bot, M, o, perc) {
  const P = bot.prev, s = copiarBolinha(o);
  s.x = perc.x; s.y = perc.y; s.vx = perc.vx; s.vy = perc.vy;
  const dir = Math.abs(perc.vx) > 1.2 ? (perc.vx > 0 ? 1 : -1) : 0;
  const ent = { esq: dir < 0, dir: dir > 0, pulo: false, segPulo: !perc.noChao && perc.vy < -2, baixo: false };
  let k = 0;
  for (; k < 64; k++) {
    P[2 * k] = s.x; P[2 * k + 1] = s.y;
    moverBolinha(s, ent, M.cen, M.plats, M.t + (k + 1) * FIS.dt, null);
    if (s.evento === "caiu") break;
  }
  for (; k < 64; k++) { P[2 * k] = s.x; P[2 * k + 1] = s.y; }
  bot.prevOk = true;
}
// posição prevista daqui a "k" passos (mistura a reta com a física pelo nível)
function posPrevista(bot, perc, k, gO) {
  const lx = perc.x + perc.vx * k, ly = perc.y + perc.vy * k + 0.5 * gO * k * k;
  if (!bot.prevOk || bot.preve <= 0) return { x: lx, y: ly };
  const i = Math.min(63, Math.max(0, Math.round(k)));
  const px = bot.prev[2 * i], py = bot.prev[2 * i + 1];
  return { x: lx + (px - lx) * bot.preve, y: ly + (py - ly) * bot.preve };
}

// ---------- mapa de plataformas (navegação) ----------
// Liga a plataforma A à B se dá para ir de A até B com um pulo simples (ou caindo).
function alturaDoPulo(cen) {
  const g = gravidadeDe(cen);
  return (FIS.pulo * FIS.pulo) / (2 * g) * 0.9;
}
function montarGrafo(M) {
  const cen = M.cen;
  if (cen.semGravidade || cen.agua || cen.inverte) return null;   // aí a física já resolve (voar/nadar/virar)
  const ps = M.plats, h = alturaDoPulo(cen);
  const viz = ps.map(function() { return []; });
  for (let a = 0; a < ps.length; a++) for (let c = 0; c < ps.length; c++) {
    if (a === c) continue;
    const A = ps[a], B = ps[c];
    const sobe = A.y0 - B.y0;                       // >0: B mais alta
    const gap = Math.max(0, Math.max(A.x0, B.x0) - Math.min(A.x0 + A.w, B.x0 + B.w));
    const ok = sobe > 0 ? (sobe <= h && gap <= 170) : (gap <= 190 + (-sobe) * 0.6);
    if (ok) viz[a].push(c);
  }
  return viz;
}
function platDe(M, x, y) {
  // plataforma onde um ponto (x, y) "está em cima"
  let melhor = -1, dy = Infinity;
  for (let i = 0; i < M.plats.length; i++) {
    const p = M.plats[i];
    if (x < p.x - 10 || x > p.x + p.w + 10) continue;
    const d = p.y - y;
    if (d >= -6 && d < dy) { dy = d; melhor = i; }
  }
  return melhor;
}
// próximo ponto do caminho até a plataforma alvo (BFS)
function proximoPasso(grafo, de, ate) {
  if (de < 0 || ate < 0 || de === ate) return -1;
  const ant = new Array(grafo.length).fill(-2);
  ant[de] = -1;
  const fila = [de];
  while (fila.length) {
    const u = fila.shift();
    if (u === ate) break;
    for (let i = 0; i < grafo[u].length; i++) { const v = grafo[u][i]; if (ant[v] === -2) { ant[v] = u; fila.push(v); } }
  }
  if (ant[ate] === -2) return -1;
  let v = ate;
  while (ant[v] !== de && ant[v] >= 0) v = ant[v];
  return v;
}

// v19: quanto vale cada carta AGORA (0 a ~60)
function utilidadeCarta(bot, M, b, o, id) {
  const valor = VALOR_ARMA[b.arma] || 0.3, dist = Math.abs(o.x - b.x) + Math.abs(o.y - b.y);
  switch (id) {
    case "cura": return b.vida > 85 ? 6 : 15 + (100 - b.vida) * 0.55;
    case "escudo": return 28 + (b.vida < 50 ? 14 : 0);
    case "rapidez": return 22;
    case "furia": return 18 + valor * 30;
    case "tiro_duplo": return 16 + valor * 26 + (b.municao === Infinity ? -8 : 0);
    case "mini": return 22;
    case "congelar": return o.viva ? (dist < 420 ? 46 : 32) : 0;
    case "fantasma": return 24;
    case "reflexo": { const ao = ARMA[o.arma]; return ao.tipo === "bala" || ao.tipo === "laser" ? 34 : 12; }
    case "super_pulo": return 12;
    case "chuva": return o.viva ? 44 : 0;
    case "municao": return b.municao !== Infinity && b.municao < (ARMA[b.arma].municao || 1) * 0.5 ? 20 + valor * 20 : 12;
  }
  return 25;
}
// v19: quanto vale uma arma de caixa para ESTE bot neste mapa (valor + jeito dele)
function valorCaixa(bot, M, idArma) {
  const a = ARMA[idArma];
  let v = VALOR_ARMA[idArma];
  if (M.cen.queda && (a.empurra || 0) >= 9) v += 0.12 * bot.tatica;
  if (a.tipo === "melee") v *= 0.75 + 0.25 * bot.e.perto;
  if (a.tipo === "mina" || a.tipo === "torreta") v *= 0.7 + 0.3 * bot.e.armadilha;
  return v;
}

// Escolhe para onde ir (caixa boa, carta, abraçar com a bomba grudada) e qual o ponto do próximo passo do caminho
function escolherNavegacao(bot, M, b, valorAtual) {
  bot.nav = null;
  if (bot.grafoM !== M) { bot.grafoM = M; bot.grafo = montarGrafo(M); }
  const grafo = bot.grafo, o = oponente(M, b);
  let alvo = null, melhor = 0;
  // bomba grudada em mim: correr até o outro para passar a bomba (batata quente)
  if (b.bombaGrudada && o.viva && bot.nivel >= 0.1) { alvo = { x: o.x, y: o.y }; melhor = 999; }
  if (!alvo) for (let i = 0; i < M.caixas.length; i++) {
    const c = M.caixas[i];
    if (c.paraquedas && c.y < 80) continue;
    const ganho = valorCaixa(bot, M, c.idArma) - valorAtual;
    const dist = Math.abs(c.x - b.x) + Math.abs(c.y - b.y);
    const nota = ganho * 100 * bot.coleta - dist * 0.04;
    if (ganho > 0.12 && nota > melhor) { melhor = nota; alvo = { x: c.x, y: c.y }; }
  }
  if (melhor < 999) for (let i = 0; i < M.cartas.length; i++) {
    const c = M.cartas[i];
    const dist = Math.abs(c.x - b.x) + Math.abs(c.y - b.y);
    const nota = utilidadeCarta(bot, M, b, o, c.id) * bot.coleta - dist * 0.04;
    if (nota > melhor) { melhor = nota; alvo = { x: c.x, y: c.y + 50 }; }
  }
  if (!alvo) alvo = pontoComVisao(bot, M, b);
  if (!alvo) return;
  bot.nav = { x: alvo.x, y: alvo.y, final: true };
  if (!grafo) return;
  const de = b.noChao && b.chao ? M.plats.indexOf(b.chao) : platDe(M, b.x, b.y);
  const ate = platDe(M, alvo.x, alvo.y);
  const prox = proximoPasso(grafo, de, ate);
  if (prox >= 0) {
    const p = M.plats[prox];
    bot.nav = { x: limitar(b.x, p.x + 24, p.x + p.w - 24), y: p.y - b.r, plat: p, final: false };
  }
}

// Sem linha de tiro (oponente escondido embaixo de plataforma, por exemplo): escolhe um ponto em cima
// de alguma plataforma de onde dá para enxergar o oponente, perto do bot e na distância boa da arma.
function pontoComVisao(bot, M, b) {
  const o = oponente(M, b);
  if (!o.viva) return null;
  if (linhaLivre(b.x, b.y, o.x, o.y, M.plats, M.t) && !bot.impaciente) return null;
  const pref = distanciaBoa(ARMA[b.arma]) * (bot.impaciente ? 0.6 : 1);
  let melhor = null, nota = Infinity;
  for (let i = 0; i < M.plats.length; i++) {
    const p = M.plats[i];
    if (p.y < 80 || p.w < 40) continue;
    for (let k = 0; k < 5; k++) {
      const x = p.x + (k + 0.5) / 5 * p.w, y = p.y - b.r;
      if (y + b.r > lavaY(M.cen, M.t + 1) - 20) continue;
      if (!linhaLivre(x, y, o.x, o.y, M.plats, M.t)) continue;
      const dOp = Math.sqrt((x - o.x) * (x - o.x) + (y - o.y) * (y - o.y));
      const v = Math.abs(x - b.x) + Math.abs(y - b.y) * 1.3 + Math.abs(dOp - pref) * 0.8;
      if (v < nota) { nota = v; melhor = { x: x, y: y + 40 }; }
    }
  }
  return melhor;
}

// ---------- decisão de movimento ----------
const CANDIDATOS_BASE = (function() {
  const lista = [];
  [-1, 0, 1].forEach(function(dx) {
    lista.push({ dx: dx, pulo: 0, baixo: false });
    lista.push({ dx: dx, pulo: 1, baixo: false });     // pulo
    lista.push({ dx: dx, pulo: 2, baixo: false });     // pulo duplo
    lista.push({ dx: dx, pulo: 3, baixo: false });     // pulinho
    lista.push({ dx: dx, pulo: 5, baixo: false });     // anda um pouco e pula (pega a beirada)
    lista.push({ dx: dx, pulo: 0, baixo: true });      // descer da plataforma fina
  });
  lista.push({ dx: -1, pulo: 4, baixo: false }, { dx: 0, pulo: 4, baixo: false }, { dx: 1, pulo: 4, baixo: false }); // nadar/voar
  return lista;
})();

function entradaDoPlano(c, k) {
  let pulo = false, seg = false;
  if (c.pulo === 1) { pulo = k === 0; seg = k < 16; }
  else if (c.pulo === 2) { pulo = k === 0 || k === 14; seg = k < 28; }
  else if (c.pulo === 3) { pulo = k === 0; seg = k < 3; }
  else if (c.pulo === 4) { pulo = k % 12 === 0; seg = true; }
  else if (c.pulo === 5) { pulo = k === 9; seg = k >= 9 && k < 26; }
  return { esq: c.dx < 0, dir: c.dx > 0, pulo: pulo, segPulo: seg, baixo: c.baixo };
}

// Trajetórias das ameaças (calculadas uma vez por decisão). v19: os tiros que quicam quicam também na previsão.
function ameacas(bot, M, b, H) {
  const lista = [];
  const sinal = gravSinal(M.cen, M.t);
  const g = gravidadeDe(M.cen) * sinal;
  for (let i = 0; i < M.proj.length; i++) {
    const p = M.proj[i];
    if (!p.vivo) continue;
    const meu = p.dono === b.lado;
    // meus tiros só preocupam se forem explosivos (dá para se explodir)
    if (meu && !p.a.explode) continue;
    if (p.a.tipo === "torreta") continue;
    let notou = bot.vistos.get(p);
    if (notou === undefined) { notou = Math.random() < bot.enxerga; bot.vistos.set(p, notou); }
    if (!notou || p.t < bot.reacao * 0.6) continue;
    const a = p.a;
    const pos = [];
    let x = p.x, y = p.y, vx = p.vx, vy = p.vy, quicas = p.quicas || 0;
    const explodeEm = a.timer ? a.timer - p.passos : -1;
    for (let k = 0; k < H; k++) {
      if (p.preso) { x = p.preso.x + p.ox; y = p.preso.y + p.oy; pos.push(x, y); continue; }
      if (a.grav && !p.parado) vy += g * a.grav;
      if (a.arrasto) { vx *= a.arrasto; vy *= a.arrasto; }
      if (!p.parado && a.tipo !== "mina") {
        x += vx; y += vy;
        if ((quicas > 0 || a.ricocheteia) && (k & 1) === 0 && !a.atravessa) {
          for (let j = 0; j < M.plats.length; j++) {
            const pl = M.plats[j];
            if (pl.fina || x < pl.x || x > pl.x + pl.w || y < pl.y || y > pl.y + pl.h) continue;
            if (x - vx < pl.x || x - vx > pl.x + pl.w) vx = -vx; else vy = -vy * (a.timer ? 0.55 : 0.95);
            x += vx; y += vy; quicas--; break;
          }
        }
        if (a.ricocheteia && (x < 0 || x > FIS.largura)) vx = -vx;
      }
      pos.push(x, y);
    }
    const preso = p.preso === b;
    lista.push({ pos: pos, raio: p.raio + (a.explode && !a.timer ? 10 : 4), dano: a.dano * (a.qtd > 3 ? 0.5 : 1) * (meu ? 0.4 : 1) * (p.mult || 1),
                 explode: a.explode || 0, explodeEm: explodeEm, mina: a.tipo === "mina", banana: !!a.escorrega, buraco: !!a.atrai || !!a.ima,
                 preso: preso });
  }
  for (let i = 0; i < M.avisos.length; i++) {
    const v = M.avisos[i];
    lista.push({ ceu: true, x: v.x, y: v.y, em: Math.round(v.tempo / FIS.dt), explode: v.a.explode + 10, dano: v.a.dano });
  }
  return lista;
}

function perigoNoPasso(lista, k, x, y, r) {
  let p = 0;
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a.ceu) {
      if (Math.abs(k - a.em) <= 1) { const dx = x - a.x, dy = y - a.y; if (dx * dx + dy * dy < (a.explode + r) * (a.explode + r)) p += a.dano; }
      continue;
    }
    if (a.preso) continue;                                   // bomba grudada em mim: a fuga é outra (abraçar)
    const px = a.pos[k * 2], py = a.pos[k * 2 + 1];
    const dx = x - px, dy = y - py;
    const d2 = dx * dx + dy * dy;
    if (a.banana) { if (d2 < 40 * 40) p += a.dano; continue; }
    if (a.mina) { if (d2 < 80 * 80) p += a.dano * 0.5; continue; }
    if (a.buraco) { if (d2 < 200 * 200) p += 3; continue; }
    if (a.explodeEm >= 0) {
      if (k === a.explodeEm) { if (d2 < (a.explode + r) * (a.explode + r)) p += a.dano; }
      else if (d2 < (r + 14) * (r + 14)) p += a.dano * 0.4;
      continue;
    }
    const rr = r + a.raio;
    if (d2 < rr * rr) { p += a.dano * (a.explode ? 1.3 : 1); a.dano *= 0.3; }   // conta forte só a 1ª vez
  }
  return p;
}

// torretas do oponente (paradas no chão): perigo para quem fica na frente delas
function torretasInimigas(M, b) {
  let l = null;
  for (let i = 0; i < M.proj.length; i++) {
    const p = M.proj[i];
    if (p.vivo && p.a.tipo === "torreta" && p.parado && p.dono !== b.lado) (l || (l = [])).push(p);
  }
  return l;
}

function decidir(bot, M, b, o, perc) {
  const H = bot.horizonte;
  const cen = M.cen;
  const lista = ameacas(bot, M, b, H);
  const danos = lista.map(function(a) { return a.dano; });
  const arma = ARMA[b.arma];
  const armaO = ARMA[o.arma];
  const e = bot.e;
  const aguaOuEspaco = cen.agua || cen.semGravidade;
  const bumpers = M.bumpers ? M.bumpers.map(function(u) { return { x: u.x, y: u.y, r: u.r, flash: 0 }; }) : null;
  const lava = cen.lava ? lavaY(cen, M.t + 1.5) : Infinity;
  const valorAtual = VALOR_ARMA[b.arma] * (b.municao === Infinity ? 0.6 : limitar(b.municao / (arma.municao || 1), 0.25, 1));
  const ameacaO = VALOR_ARMA[o.arma] || 0.3;
  const reto = !(armaO.grav > 0.3) && armaO.tipo !== "ceu" && armaO.tipo !== "mina";
  const alcancePerigo = o.viva ? perigoDePerto(armaO) : 0;
  // v19: situação
  const vul = o.viva && vulneravel(o) && Math.random() < bot.combo + 0.3;          // hora do combo: parte para cima
  const fraco = b.vida < 35 && o.vida > b.vida + 15 && e.recua > 0 && !b.bombaGrudada;   // recua e se cobre
  const furia = e.furia && b.vida < 45;                                             // o furioso fica pior quando apanha
  const recarregando = b.cad > 0.45 && arma.cadencia >= 0.8;                        // arma pesada recarregando
  let pref = distanciaBoa(arma) * (arma.tipo === "melee" ? 1 : e.dist);
  if (vul) pref *= arma.tipo === "melee" ? 1 : 0.7;
  if (fraco) pref *= 1 + 0.35 * e.recua;
  if (furia) pref *= 0.6;
  const longe = pref >= 240 && arma.tipo !== "melee";
  // fraco contra forte (ou recarregando/fugindo): melhor se esconder e buscar arma
  const esconder = (valorAtual < 0.35 && ameacaO > 0.6 && bot.tatica > 0.5) || (fraco && bot.cobre > 0.4) || (recarregando && bot.cobre > 0.6 && !vul);
  const pesoCobre = esconder ? 6 + 6 * bot.cobre : 0;
  // linha da mira do oponente (arma reta e pronta para atirar)
  const leMira = o.viva && tiroReto(armaO) && o.cad < 0.25 && o.mira !== undefined && !(o.efeitos.congelado > 0) ? bot.leMira : 0;
  const mcx = Math.cos(o.mira || 0), mcy = Math.sin(o.mira || 0), danoMira = armaO.dano * (armaO.qtd || 1);
  const torretas = torretasInimigas(M, b);
  escolherNavegacao(bot, M, b, valorAtual);
  const nav = bot.nav;
  const abraca = b.bombaGrudada && o.viva;                                          // batata quente: cola no outro
  const fogeBomba = o.bombaGrudada && o.viva;
  const fintando = bot.fintaAte > M.t ? (M.t < bot.fintaVolta ? bot.fintaDir : -bot.fintaDir) : 0;
  const dancando = bot.dancaAte > M.t;

  let melhor = null, notaMelhor = -Infinity;
  for (let ci = 0; ci < CANDIDATOS_BASE.length; ci++) {
    const c = CANDIDATOS_BASE[ci];
    if (c.pulo === 4 && !aguaOuEspaco) continue;
    if (c.baixo && !(b.noChao && b.chao && b.chao.fina)) continue;
    for (let i = 0; i < lista.length; i++) lista[i].dano = danos[i];
    const s = copiarBolinha(b);
    let perigo = 0, caiu = false, pegaCaixa = 0, pegaCarta = 0, chegou = false;
    for (let k = 0; k < H; k++) {
      moverBolinha(s, entradaDoPlano(c, k), cen, M.plats, M.t + (k + 1) * FIS.dt, bumpers);
      if (s.evento === "caiu") { caiu = true; break; }
      if (s.evento === "lava") perigo += 35;
      perigo += perigoNoPasso(lista, k, s.x, s.y, s.r) * (1 - k / H * 0.4);
      // golpe/escopeta do oponente de perto
      if (alcancePerigo) {
        const ox = perc.x + perc.vx * k * 0.6, oy = perc.y;
        const ddx = s.x - ox, ddy = s.y - oy;
        if (ddx * ddx + ddy * ddy < alcancePerigo * alcancePerigo) perigo += armaO.dano * (armaO.qtd || 1) * 0.012;
      }
      // v19: sair da linha da mira (o oponente está apontando e a arma está pronta)
      if (leMira && k < 22 && (k & 1) === 0) {
        const rx = s.x - o.x, ry = s.y - o.y, proj = rx * mcx + ry * mcy;
        if (proj > 0) { const dl = Math.abs(rx * mcy - ry * mcx); if (dl < s.r + 14) perigo += danoMira * leMira * 0.06 * (1 - dl / (s.r + 14)); }
      }
      if (torretas && (k & 3) === 0) for (let i = 0; i < torretas.length; i++) {
        const tq = torretas[i], tdx = s.x - tq.x, tdy = s.y - tq.y;
        if (tdx * tdx + tdy * tdy < 700 * 700 && linhaLivre(tq.x, tq.y - 12, s.x, s.y, M.plats, M.t)) perigo += 0.35;
      }
      for (let i = 0; i < M.caixas.length; i++) {
        const cx = M.caixas[i];
        if (Math.abs(cx.x - s.x) < s.r + 24 && Math.abs(cx.y - s.y) < s.r + 24) {
          const ganho = valorCaixa(bot, M, cx.idArma) - valorAtual;
          if (ganho > pegaCaixa) pegaCaixa = ganho;
        }
      }
      for (let i = 0; i < M.cartas.length; i++) {
        const ct = M.cartas[i];
        if (Math.abs(ct.x - s.x) < s.r + 26 && Math.abs(ct.y - s.y) < s.r + 30) pegaCarta = Math.max(pegaCarta, utilidadeCarta(bot, M, b, o, ct.id) / 35);
      }
      if (nav && nav.plat && s.noChao && s.chao === nav.plat) chegou = true;
    }
    let nota = 0;
    if (caiu) nota -= 1000;
    nota -= perigo * 3 * e.perigo;
    if (c.pulo > 0 && c.pulo !== 4) {
      const parado = Math.abs(perc.vx) < 0.8 && perc.noChao;
      nota += e.pulo * Math.random() * (parado ? 2 : 8);   // estilo saltitante
      if (!perigo && !nav) nota -= parado ? 4 : 1.5;            // pular gasta: sem motivo, não pula
    }
    // distância boa até o oponente (onde ele vai estar)
    const fx = perc.x + perc.vx * H * 0.5, fy = perc.y;
    const dx = fx - s.x, dy = fy - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    nota -= Math.abs(dist - pref) * 0.045;
    if (longe && dist < 120) nota -= (120 - dist) * 0.3;            // arma de longe: não fica colado
    // linha de tiro / esconderijo
    const livre = linhaLivre(s.x, s.y, fx, fy, M.plats, M.t);
    if (esconder) nota += livre ? -pesoCobre * 0.75 : pesoCobre;
    else if (livre) {
      if (arma.grav > 0.3 || arma.tipo === "ceu") nota += 6;
      else nota += 10;
      if (reto && Math.abs(dy) < s.r + 8) nota -= 6 * ameacaO * (1 - Math.abs(s.vy) / 8);   // não ficar parado na linha dele
    }
    // altura: um pouco melhor estar acima
    nota += limitar(dy, -120, 120) * 0.025 * bot.tatica;
    // caixas e cartas
    if (pegaCaixa > 0) nota += pegaCaixa * 45 * bot.coleta;
    if (pegaCarta) nota += 30 * bot.coleta * pegaCarta;
    // caminho até o alvo (pelo mapa de plataformas)
    if (nav) {
      const peso = (abraca ? 3 : Math.max(bot.coleta, 0.6)) * (bot.impaciente ? 1.6 : 1);
      const nd = Math.abs(nav.x - s.x) + Math.abs(nav.y - s.y) * 1.4;
      nota -= nd * 0.05 * peso;
      if (chegou) nota += 14 * peso;
    }
    // v19: combo (oponente vulnerável), bomba grudada, finta e dança
    if (vul) nota -= Math.max(0, dist - pref) * 0.03 * bot.combo;
    if (abraca) nota -= dist * 0.12;
    if (fogeBomba) nota += Math.min(dist, 380) * 0.09;
    if (fintando && !perigo) nota += c.dx === fintando ? 9 * e.finta : c.dx === -fintando ? -4 : 0;
    if (dancando && !perigo) nota += c.pulo === 3 && c.dx === 0 ? 12 : 0;
    // impaciente: chega mais perto
    if (bot.impaciente) nota -= Math.max(0, dist - pref * 0.6) * 0.03;
    // perigos e truques do cenário
    if (s.y + s.r > lava - 40) nota -= 18;
    if (cen.queda) {
      let chao = null;
      for (let i = 0; i < M.plats.length; i++) { const p = M.plats[i]; if (s.x > p.x - 5 && s.x < p.x + p.w + 5 && p.y >= s.y) { chao = p; break; } }
      if (!chao) nota -= 30;
      else {
        const beira = Math.min(s.x - chao.x, chao.x + chao.w - s.x);
        if (beira < 110) nota -= (110 - beira) * 0.12 * bot.tatica;          // longe da beirada
        // oponente entre mim e a beirada dele: meus tiros/empurrões jogam ele para fora
        const po = platDe(M, perc.x, perc.y);
        if (po >= 0) {
          const P = M.plats[po];
          const ladoBeira = perc.x - P.x < P.x + P.w - perc.x ? -1 : 1;
          if (Math.sign(perc.x - s.x) === ladoBeira) nota += 7 * bot.tatica;
        }
      }
    }
    nota -= Math.abs(s.x - 640) * 0.003;
    if (bot.plano === c) nota += 2.5;                                   // evita tremedeira
    nota += Math.random() * bot.ruido;
    if (nota > notaMelhor) { notaMelhor = nota; melhor = c; }
  }
  return melhor || CANDIDATOS_BASE[0];
}

// ---------- mira ----------
// Onde mirar: posição futura do oponente quando o tiro chegar (e o arco das armas com gravidade)
function mirarBot(bot, M, b, perc) {
  const a = ARMA[b.arma];
  if (semMira(a)) return perc.x >= b.x ? 0 : Math.PI;
  const agua = M.cen.agua ? 0.7 : 1;
  const v = (a.vel || 60) * agua;
  const sinal = gravSinal(M.cen, M.t);
  const gO = perc.noChao ? 0 : gravidadeDe(M.cen) * sinal;
  let tx = perc.x, ty = perc.y;
  if (a.tipo === "bala") {
    for (let i = 0; i < 3; i++) {
      const tt = Math.min(45, Math.sqrt((tx - b.x) * (tx - b.x) + (ty - b.y) * (ty - b.y)) / v);
      const p = posPrevista(bot, perc, tt, gO);
      tx = p.x; ty = p.y;
    }
  }
  bot.alvoX = tx; bot.alvoY = ty;
  let ang;
  const g = (a.grav || 0) * gravidadeDe(M.cen);
  if (a.tipo === "bala" && g > 0.05) {
    const th = anguloBalistico(Math.abs(tx - b.x), -(ty - b.y) * sinal, v, g);
    const angCanvas = th === null ? -0.75 * sinal : -th * sinal;
    ang = tx >= b.x ? angCanvas : Math.PI - angCanvas;
  } else ang = Math.atan2(ty - b.y, tx - b.x);
  // erro de mira que muda devagar (não é tremedeira). Guarda a mira ideal para DECIDIR se atira;
  // o erro só entra no tiro de verdade (antes ele não atirava porque a simulação já contava o erro)
  bot.trocaRuido -= FIS.dt;
  if (bot.trocaRuido <= 0) { bot.trocaRuido = 0.35 + Math.random() * 0.4; bot.alvoRuido = (Math.random() + Math.random() - 1) * bot.erroMira * 1.7; }
  bot.ruidoMira += (bot.alvoRuido - bot.ruidoMira) * 0.08;
  bot.angIdeal = ang;
  return ang + bot.ruidoMira;
}

// arco ALTO (por cima da parede): o outro ângulo da parábola
function anguloBalisticoAlto(x, yCima, v, g) {
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * x * x + 2 * yCima * v2);
  if (disc < 0) return null;
  return Math.atan((v2 + Math.sqrt(disc)) / (g * Math.max(1, x)));
}

// Simula o tiro e diz se acerta onde o bot acha que o oponente vai estar
// (v19: os que quicam quicam na simulação — dá para achar tiro de tabela)
function tiroAcerta(bot, M, b, perc, ang) {
  const a = ARMA[b.arma];
  const dx = perc.x - b.x, dy = perc.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (a.tipo === "melee") return dist < a.alcance + perc.r + 6;
  if (a.tipo === "ceu") return perc.noChao || Math.abs(perc.vy) < 3 || bot.nivel < 0.3;
  if (a.tipo === "mina") return armadilhaBoa(bot, M, b, perc, a);
  if (a.tipo === "torreta") return b.noChao && dist > 140 && dist < a.alcance - 80 && linhaLivre(b.x, b.y - 20, perc.x, perc.y, M.plats, M.t);
  if (a.tipo === "raio") return dist < a.alcance - 10 && linhaLivre(b.x, b.y, perc.x, perc.y, M.plats, M.t);
  const boca = pontaDoCano(b, ang);
  if (a.tipo === "laser" || a.tipo === "feixe") {
    const alc = a.tipo === "feixe" ? a.alcance : 1500;
    const x2 = boca.x + Math.cos(ang) * alc, y2 = boca.y + Math.sin(ang) * alc;
    if (distPontoSegmento(perc.x, perc.y, boca.x, boca.y, x2, y2) > perc.r * bot.tolerancia + 4) return false;
    return a.perfuraParede || linhaLivre(boca.x, boca.y, perc.x, perc.y, M.plats, M.t);
  }
  const g = (a.grav || 0) * gravidadeDe(M.cen) * gravSinal(M.cen, M.t);
  const v = a.vel * (M.cen.agua ? 0.7 : 1);
  let x = boca.x, y = boca.y, vx = Math.cos(ang) * v, vy = Math.sin(ang) * v;
  let ox = perc.x, oy = perc.y;
  const ovx = perc.vx, ovy = perc.noChao ? 0 : perc.vy * 0.6;
  const usaPrev = bot.prevOk && bot.preve > 0.5;
  const alcanceMax = a.vida ? a.vida : 90;
  const raio = a.explode ? Math.max(a.explode * 0.55, perc.r) : perc.r * bot.tolerancia + (a.raio || 4);
  const espalha = (a.qtd || 1) > 2 ? 1.6 : 1;
  let quicas = a.timer ? 0 : (a.quica || 0);
  const N = Math.min(alcanceMax, a.cresce ? 110 : 90);
  for (let k = 0; k < N; k++) {
    if (a.grav) vy += g;
    if (a.arrasto) { vx *= a.arrasto; vy *= a.arrasto; }
    x += vx; y += vy;
    if (usaPrev && k < 64) { ox = bot.prev[2 * k]; oy = bot.prev[2 * k + 1]; } else { ox += ovx; oy += ovy; }
    const ex = x - ox, ey = y - oy;
    if (ex * ex + ey * ey < raio * raio * espalha) {
      // não se explodir junto
      if (a.explode) { const sx = x - b.x, sy = y - b.y; if (sx * sx + sy * sy < (a.explode + b.r) * (a.explode + b.r) * 0.8) return false; }
      return true;
    }
    if (a.ricocheteia) {
      if (x < 0 || x > FIS.largura) { vx = -vx; x += vx; }
      if (y < 0) { vy = -vy; y += vy; }
    }
    if (!a.atravessa && (k & 1) === 0) {
      for (let i = 0; i < M.plats.length; i++) {
        const p = M.plats[i];
        if (p.fina) continue;
        if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) {
          if (a.explode) { const ex2 = x - ox, ey2 = y - oy; return ex2 * ex2 + ey2 * ey2 < a.explode * a.explode * 0.5; }
          if (a.rola) { vy = 0; y = p.y - 1; break; }
          if (quicas <= 0 && !a.volta) return false;
          if (quicas > 0) {
            if (x - vx < p.x || x - vx > p.x + p.w) vx = -vx; else vy = -vy * 0.95;
            x += vx; y += vy; quicas--;
          }
          break;
        }
      }
    }
    if (x < -40 || x > FIS.largura + 40 || y > 760) return false;
  }
  if (a.teleguia || a.volta || a.atrai || a.ima || a.levanta) return dist < 650 && Math.abs(dy) < 160;
  return false;
}

// v19: mina e casca de banana no caminho do oponente (ele vindo na minha direção no mesmo andar, ou indo pegar algo)
function armadilhaBoa(bot, M, b, perc, a) {
  if (!b.noChao) return false;
  const dx = perc.x - b.x, mesmoAndar = Math.abs(perc.y - b.y) < 40;
  const vindo = mesmoAndar && Math.abs(dx) < 380 && Math.abs(dx) > 70 && perc.vx * dx < -0.8;
  // segurando a armadilha faz tempo: coloca mesmo assim (perto do outro ou no caminho das caixas)
  const tempo = M.t - (bot.armaDesde || 0);
  const chance = (vindo ? 0.09 : 0.012 + Math.max(0, tempo - 2) * 0.012) * (0.6 + 0.4 * bot.e.armadilha);
  return Math.random() < chance && Math.abs(dx) < 520;
}

// v19: procura outro ângulo que acerta: arco alto (granada por cima da parede) ou tiro de tabela (quica)
function outroAngulo(bot, M, b, perc) {
  const a = ARMA[b.arma];
  if (a.tipo !== "bala") return null;
  const sinal = gravSinal(M.cen, M.t);
  const g = (a.grav || 0) * gravidadeDe(M.cen);
  if (bot.arcoAlto && g > 0.05) {
    const v = a.vel * (M.cen.agua ? 0.7 : 1), tx = bot.alvoX === undefined ? perc.x : bot.alvoX, ty = bot.alvoY === undefined ? perc.y : bot.alvoY;
    const th = anguloBalisticoAlto(Math.abs(tx - b.x), -(ty - b.y) * sinal, v, g);
    if (th !== null) {
      const angCanvas = -th * sinal, ang = tx >= b.x ? angCanvas : Math.PI - angCanvas;
      if (tiroAcerta(bot, M, b, perc, ang)) return ang;
    }
  }
  if (bot.tabela && (a.quica || a.ricocheteia) && !a.timer) {
    const base = Math.atan2(perc.y - b.y, perc.x - b.x);
    for (let i = 1; i <= 7; i++) for (let sgn = -1; sgn <= 1; sgn += 2) {
      const ang = base + sgn * i * 0.21;
      if (tiroAcerta(bot, M, b, perc, ang)) return ang;
    }
  }
  return null;
}

// Oponente mais ou menos na direção da mira, sem parede no meio
function alinhado(M, b, perc, ang) {
  const dx = perc.x - b.x, dy = perc.y - b.y;
  if (dx * dx + dy * dy > 700 * 700) return false;
  if (Math.abs(difAng(Math.atan2(dy, dx), ang)) > 0.35) return false;
  return linhaLivre(b.x, b.y, perc.x, perc.y, M.plats, M.t);
}

// ---------- provocações (balões) ----------
// tipo: "acertou" (golpe forte), "desviou" (tiro passou raspando), "venceu", "apanhou", "fraco", "combo", "vem"
const PROVOCACOES = { acertou: 3, desviou: 3, venceu: 3, apanhou: 2, fraco: 2, combo: 1, vem: 2 };
const CHANCE_PROV = { acertou: 0.35, desviou: 0.4, venceu: 0.8, apanhou: 0.3, fraco: 0.6, combo: 0.6, vem: 0.5 };
function provocar(M, b, tipo) {
  if (!b || b.humano || M.mudo || !jogo) return;
  const bot = jogo.bots[b.lado - 1];
  if (!bot) return;
  const e = bot.e, agora = M.t;
  // na 1ª partida da vida (treino) o Bob não provoca (só os balões de reação)
  if (jogo.treino && tipo !== "venceu") return;
  const espera = tipo === "venceu" ? 0 : 3.2 / Math.max(0.5, e.provoca);
  if (agora < (bot.provAte || 0) + espera && tipo !== "venceu") return;
  if (Math.random() > CHANCE_PROV[tipo] * Math.min(1.6, e.provoca)) return;
  bot.provAte = agora;
  const n = 1 + Math.floor(Math.random() * PROVOCACOES[tipo]);
  emote(b, t("prov_" + tipo + "_" + n), tipo === "venceu" ? 1.6 : 1.15);
  // o provocador dá uma dancinha quando acerta ou vence
  if (e.danca && (tipo === "acertou" || tipo === "desviou")) bot.dancaAte = agora + 0.7;
}

// tiros que passaram raspando no bot sem acertar: "Errou!"
function conferirDesvios(bot, M, b) {
  if ((M.passo & 3) !== 0) return;
  for (let i = 0; i < M.proj.length; i++) {
    const p = M.proj[i];
    if (!p.vivo || p.dono === b.lado || p.desviado || p.a.tipo === "mina" || p.a.tipo === "torreta") continue;
    const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy, perto = b.r + p.raio + 40;
    if (d2 < perto * perto) p.quaseB = true;
    else if (p.quaseB && dx * p.vx + dy * p.vy > 0 && b.dor <= 0) { p.desviado = true; provocar(M, b, "desviou"); return; }
  }
}

// ---------- o que o bot aperta neste passo ----------
function pensarBot(bot, M, b) {
  const o = oponente(M, b);
  // rodada nova: zera o que era da rodada anterior. Os tempos (hesitouAte...) são do relógio da rodada (M.t),
  // que volta a 0 — sem isso o bot passava vários segundos sem atirar a partir da 2ª rodada.
  if (bot.mRodada !== M) {
    bot.mRodada = M;
    bot.hesitouAte = 0; bot.historico = []; bot.plano = null; bot.passosPlano = 0; bot.proxDecisao = 0;
    bot.nav = null; bot.ultimoDano = 0; bot.semDano = 0; bot.gracaResta = bot.graca;
    bot.ruidoMira = 0; bot.alvoRuido = 0; bot.trocaRuido = 0; bot.avisoAte = 0; b.avisando = 0; bot.proxTiro = 0;
    bot.fintaAte = 0; bot.fintaVolta = 0; bot.dancaAte = 0; bot.provAte = -9; bot.prevOk = false; bot.proxBusca = 0;
    bot.vidaAntes = b.vida; bot.vidaOAntes = o.vida; bot.avisouFraco = false;
  }
  lembrar(bot, o);
  if (bot.armaVista !== b.arma) { bot.armaVista = b.arma; bot.armaDesde = M.t; }
  const ent = { esq: false, dir: false, pulo: false, segPulo: false, baixo: false, tiro: false };
  if (!b.viva) return ent;
  const perc = oponentePercebido(bot, o, M);
  // relógio de paciência: se ninguém causou dano há 3 s, o bot parte para cima / procura ângulo
  const danoAgora = M.stats.dano[0] + M.stats.dano[1];
  if (danoAgora !== bot.ultimoDano) { bot.ultimoDano = danoAgora; bot.semDano = 0; }
  else bot.semDano = (bot.semDano || 0) + FIS.dt;
  bot.impaciente = bot.caca && bot.semDano > 3;
  reagir(bot, M, b, o);

  bot.proxDecisao -= FIS.dt;
  if (bot.proxDecisao <= 0 || !bot.plano) {
    if (o.viva && bot.preve > 0) preverOponente(bot, M, o, perc);
    // finta: de vez em quando vai na direção do outro e volta (ou o contrário)
    if (o.viva && bot.fintaAte < M.t && Math.random() < bot.finta * 0.06 && Math.abs(o.x - b.x) < 520) {
      bot.fintaDir = Math.random() < 0.6 ? Math.sign(o.x - b.x) || 1 : -(Math.sign(o.x - b.x) || 1);
      bot.fintaVolta = M.t + 0.22 + Math.random() * 0.12; bot.fintaAte = bot.fintaVolta + 0.25;
    }
    const novo = decidir(bot, M, b, o, perc);
    if (novo !== bot.plano) bot.passosPlano = 0;
    bot.plano = novo;
    bot.proxDecisao = bot.intervalo * (0.8 + Math.random() * 0.4);
  }
  Object.assign(ent, entradaDoPlano(bot.plano, bot.passosPlano++));

  // mira livre (o motor usa b.miraLivre como a mira do jogador)
  let ang = mirarBot(bot, M, b, perc);
  b.miraLivre = o.viva ? ang : null;
  const a = ARMA[b.arma];
  if (!o.viva || M.t < bot.hesitouAte) return ent;
  const fantasma = o.efeitos.fantasma > 0;
  let bom = !fantasma && tiroAcerta(bot, M, b, perc, bot.angIdeal);
  // v19: sem tiro direto: granada por cima da parede ou tiro de tabela (procura de vez em quando, não todo passo)
  if (!bom && !fantasma && b.cad <= 0 && M.t >= (bot.proxBusca || 0) && (bot.arcoAlto || bot.tabela)) {
    bot.proxBusca = M.t + 0.12;
    const alt = outroAngulo(bot, M, b, perc);
    if (alt !== null) { bot.angIdeal = alt; ang = alt + bot.ruidoMira; b.miraLivre = ang; bom = true; }
  }
  const vul = vulneravel(o) && bot.combo > 0.5;
  const furia = bot.e.furia && b.vida < 45;
  if (bom) {
    if (b.cad <= 0 && !vul && Math.random() < bot.hesita) { bot.hesitouAte = M.t + 0.15; return ent; }
    ent.tiro = true;
    // tiro de aviso: passa raspando (por cima ou por baixo), nunca no meio do jogador
    if (bot.gracaResta > 0 && b.cad <= 0 && !semMira(a)) {
      bot.gracaResta--;
      b.miraLivre = ang + (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.12);
    }
  } else if (!semMira(a) && (b.municao === Infinity || b.municao > (a.municao || 1) * 0.3) && alinhado(M, b, perc, bot.angIdeal)) {
    // na direção certa e com munição sobrando: atira "pressionando" (como um humano faz); impaciente atira mais
    if (Math.random() < bot.pressiona * (fantasma ? 0.4 : 1) * (bot.impaciente ? 2 : 1) * (vul ? 2 : 1) * (furia ? 1.5 : 1)) ent.tiro = true;
  } else if (Math.random() < bot.chuta && a.tipo !== "mina" && a.tipo !== "torreta") ent.tiro = true;
  // v18.3: rodada 1 do treino: o Bob só começa a atirar depois do 1º acerto da pessoa (quem não entendia apanhava 30 s)
  if (jogo && jogo.treino && jogo.rodada === 1 && M.stats.acertos[0] === 0) ent.tiro = false;
  // aprendiz: respira entre um tiro e outro
  if (ent.tiro && b.cad <= 0 && bot.folgaTiro > 0) {
    if (M.t < (bot.proxTiro || 0)) ent.tiro = false;
    else bot.proxTiro = M.t + bot.folgaTiro * (0.7 + Math.random() * 0.6);
  }
  // tiro pesado (bazuca, laser, sniper...): avisa antes com "!" e uma linha vermelha, quando o jogador é humano.
  // Dá tempo de desviar — e desviar de um tiro avisado é das melhores sensações do jogo.
  if (ent.tiro && b.cad <= 0 && o.humano && armaPesada(a)) {
    if (!bot.avisoAte) {
      bot.avisoAte = M.t + lerp(0.55, 0.2, bot.nivel);
      b.avisando = 1;
      emote(b, "!", 0.6);
    }
    if (M.t < bot.avisoAte) { ent.tiro = false; return ent; }
    bot.avisoAte = 0; b.avisando = 0;
  } else if (bot.avisoAte && M.t > bot.avisoAte + 0.6) { bot.avisoAte = 0; b.avisando = 0; }   // desistiu do tiro
  return ent;
}

// reações e provocações (balões) a partir do que aconteceu desde o último passo
function reagir(bot, M, b, o) {
  const perdeu = (bot.vidaAntes || 100) - b.vida, tirou = (bot.vidaOAntes || 100) - o.vida;
  bot.vidaAntes = b.vida; bot.vidaOAntes = o.vida;
  if (tirou >= 18 && o.viva) provocar(M, b, vulneravel(o) ? "combo" : "acertou");
  else if (perdeu >= 22) provocar(M, b, "apanhou");
  if (b.vida < 30 && !bot.avisouFraco && b.viva) { bot.avisouFraco = true; provocar(M, b, "fraco"); }
  conferirDesvios(bot, M, b);
  // o oponente se esconde e o bot está esperando: "Vem!"
  if (bot.semDano > 4.5 && bot.e.provoca >= 1 && (M.passo % 90) === 0) provocar(M, b, "vem");
}

function armaPesada(a) {
  return a.tipo === "laser" || (a.explode || 0) >= 60 || a.dano * (a.qtd || 1) >= 30;
}

// Queda de braço: devolve true quando o bot "clica" neste passo
function botClica(bot, tempo) {
  if (tempo < bot.proxClique) return false;
  bot.proxClique = tempo + (1 / bot.cliques) * (0.7 + Math.random() * 0.6);
  return true;
}
