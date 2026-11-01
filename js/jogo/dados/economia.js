"use strict";

// =========================
// ECONOMIA (números ajustados com a simulação scratchpad/sim/eco2.js: jogador médio, 3 toques/s)
// 1ª partida: robô 6 em ~40 s, 8 (libera renascer) em ~5 min, 10 em ~15 min, 12 em ~26 min; tier 4 de upgrades
// em ~30 min. Depois de renascer (árvore), cada partida anda bem mais rápido: é isso que puxa o renascimento.
// =========================
const ECO = {
  razao: 2.3,          // cada nível de robô vale 2,3x o anterior (juntar dois sempre compensa)
  criarBase: 10,       // preço do 1º robô
  criarCresce: 1.12,  // cada robô criado na partida encarece o próximo
  toqueTime: 0.1       // o seu toque também vale 10% do que o time faz por segundo (tocar nunca fica inútil)
};
function valorRobo(n) { return Math.pow(ECO.razao, n - 1); }       // moedas por apertada do botão

// UPGRADES EM TIERS (somem no renascimento). Cada um tem 5 níveis, cada vez mais caro. O "principal" de um tier
// no nível 3 libera o tier seguinte. O efeito de cada um está em jogo.js (e o texto em paineis.js textoEfeito).
const UPGRADES = [
  { id: "dedo",      tier: 1, principal: true, base: 30,  cresce: 2.4, icone: "dedo" },      // toque +3 por nível
  { id: "motor",     tier: 1, base: 150, cresce: 2.4, icone: "motor" },                      // time +15% de velocidade
  { id: "esteira",   tier: 1, base: 250, cresce: 2.4, icone: "esteira" },                    // robô grátis 15% mais cedo
  { id: "fabrica",   tier: 2, principal: true, base: 4000, cresce: 4.5, icone: "fabrica" },  // robôs nascem 1 nível acima
  { id: "linha",     tier: 2, base: 2500, cresce: 2.6, icone: "linha" },                     // criar 15% mais barato
  { id: "blindagem", tier: 2, base: 1500, cresce: 2.4, icone: "escudo" },                    // batalha +25%
  { id: "cofre",     tier: 3, principal: true, base: 9e4, cresce: 3.2, icone: "cofre" },     // tudo rende x1,5
  { id: "dedo2",     tier: 3, base: 6e4, cresce: 2.8, icone: "dedo" },                       // toque x2
  { id: "turbina",   tier: 3, base: 7e4, cresce: 2.8, icone: "motor" },                      // time +25%
  { id: "fabrica2",  tier: 4, principal: true, base: 6e6, cresce: 4.5, icone: "fabrica" },   // robôs nascem 1 nível acima
  { id: "prensa",    tier: 4, base: 3e6, cresce: 2.8, icone: "prensa" },                     // criar 20% mais barato
  { id: "canhoes",   tier: 4, base: 2e6, cresce: 2.6, icone: "canhao" },                     // batalha +50% e habilidades
  { id: "reator",    tier: 5, principal: true, base: 4e8, cresce: 3.5, icone: "reator" },    // tudo rende x2
  { id: "esteira2",  tier: 5, base: 2e8, cresce: 2.8, icone: "esteira" },                    // robô grátis 20% mais cedo
  { id: "overclock", tier: 5, base: 2.5e8, cresce: 2.8, icone: "raio" },                     // time +40%
  // v6: tiers 6 e 7, com 2 tipos novos (Ímã Dourado e Fusão Instável)
  { id: "estelar",   tier: 6, principal: true, base: 6e10, cresce: 4, icone: "estrela" },   // tudo rende x3
  { id: "ima",       tier: 6, base: 3e10, cresce: 3, icone: "ima" },                        // robô dourado +25% mais vezes e +50% de prêmio
  { id: "hidraulica", tier: 6, base: 4e10, cresce: 3, icone: "pistao" },                    // time +60%
  { id: "fabrica3",  tier: 7, principal: true, base: 3e14, cresce: 5, icone: "fabrica" },   // robôs nascem 1 nível acima
  { id: "fusao_inst", tier: 7, base: 1e14, cresce: 3.2, icone: "atomo" },                   // 6% de chance de juntar pular 1 nível
  { id: "dedo3",     tier: 7, base: 8e13, cresce: 3, icone: "dedo" },                       // toque x3
  // v8: 3 upgrades a mais por tier (6 por tier), quase todos com mecânica nova
  { id: "ritmo",      tier: 1, base: 120,  cresce: 2.4, icone: "nota" },        // combo: tocar rápido dá até +20%/nível
  { id: "mira",       tier: 1, base: 400,  cresce: 2.5, icone: "mira" },        // +3% de chance de toque crítico
  { id: "cofrinho",   tier: 1, base: 600,  cresce: 2.6, icone: "porco" },       // juros: 0,5% das moedas a cada 10 s
  { id: "reciclagem", tier: 2, base: 3000, cresce: 2.6, icone: "reciclar" },    // juntar devolve 5% do preço de criar
  { id: "bancada",    tier: 2, base: 3500, cresce: 2.8, icone: "bancada" },     // robôs da grade rendem 1% do valor
  { id: "caixa_premiada", tier: 2, base: 5000, cresce: 3, icone: "presente" }, // 3% de nascer 2 níveis acima
  { id: "furia",      tier: 3, base: 5e4,  cresce: 2.7, icone: "chama" },       // a cada 100 toques: toque x3 por 4+2n s
  { id: "medico",     tier: 3, base: 4e4,  cresce: 2.5, icone: "conserto" },    // batalha: robozinhos curam 1%/s
  { id: "esteira_dupla", tier: 3, base: 8e4, cresce: 2.8, icone: "esteira" },  // 8% de vir 2 robôs grátis
  { id: "reforco",    tier: 4, base: 3e6,  cresce: 3, icone: "batalha" },       // +1 robozinho por robô na batalha
  { id: "radar",      tier: 4, base: 2.5e6, cresce: 2.7, icone: "radar" },      // invasores +20% vezes e +40% prêmio
  { id: "negociador", tier: 4, base: 4e6,  cresce: 3, icone: "etiqueta" },      // upgrades 6% mais baratos
  { id: "plantao",    tier: 5, base: 1.5e8, cresce: 2.6, icone: "lua" },        // offline +40%
  { id: "gerente",    tier: 5, base: 1.8e8, cresce: 2.6, icone: "prancheta" },  // missões +50%
  { id: "capacitor",  tier: 5, base: 2e8,  cresce: 2.7, icone: "bateria" },     // habilidades recarregam 8% mais rápido
  { id: "clonagem",   tier: 6, base: 5e10, cresce: 3.2, icone: "dna" },         // 3% de sobrar uma cópia ao juntar
  { id: "turbo_forte", tier: 6, base: 3.5e10, cresce: 3, icone: "raio" },       // turbo do robô dourado x3 -> +0,5/nível
  { id: "laboratorio", tier: 6, base: 4.5e10, cresce: 3, icone: "frasco" },     // descobertas +15% de pontos
  { id: "critico_sup", tier: 7, base: 1.2e14, cresce: 3, icone: "mira" },       // críticos +5x
  { id: "exercito",   tier: 7, base: 9e13, cresce: 3.2, icone: "escudo" },      // +1 vaga na batalha
  { id: "producao",   tier: 7, base: 1.5e14, cresce: 3.2, icone: "grafico" }    // cada robô criado: +0,2% de renda (até +200%)
];
// a ordem de exibição: principal primeiro, depois na ordem da lista
UPGRADES.sort(function(a, b) { return a.tier - b.tier || (b.principal ? 1 : 0) - (a.principal ? 1 : 0); });
const NIVEIS_UPGRADE = 5;
const UPGRADE = {};
UPGRADES.forEach(function(u) { UPGRADE[u.id] = u; });
const N_TIERS = Math.max.apply(null, UPGRADES.map(function(u) { return u.tier; }));
function principalDoTier(t) { return UPGRADES.filter(function(u) { return u.tier === t && u.principal; })[0]; }
// v8 (mais difícil): do tier 2 em diante tudo custa o dobro e cada nível sobe +0,3 a mais; Negociador desconta 6%/nível
function custoUpgrade(id, nivel) {
  const u = UPGRADE[id], dif = u.tier >= 2 ? 2 : 1, cresce = u.cresce + (u.tier >= 2 ? 0.3 : 0);
  return Math.ceil(u.base * dif * Math.pow(cresce, nivel) * Math.pow(0.94, nivelUp("negociador")));
}
