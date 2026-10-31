"use strict";

// =========================
// ECONOMIA (números ajustados com a simulação scratchpad/sim/eco2.js: jogador médio, 3 toques/s)
// 1ª partida: robô 6 em ~40 s, 8 (libera renascer) em ~5 min, 10 em ~15 min, 12 em ~26 min; tier 4 de upgrades
// em ~30 min. Depois de renascer (árvore), cada partida anda bem mais rápido: é isso que puxa o renascimento.
// =========================
const ECO = {
  razao: 2.3,          // cada nível de robô vale 2,3x o anterior (juntar dois sempre compensa)
  criarBase: 10,       // preço do 1º robô
  criarCresce: 1.085,  // cada robô criado na partida encarece o próximo
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
  { id: "overclock", tier: 5, base: 2.5e8, cresce: 2.8, icone: "raio" }                      // time +40%
];
const NIVEIS_UPGRADE = 5;
const UPGRADE = {};
UPGRADES.forEach(function(u) { UPGRADE[u.id] = u; });
const N_TIERS = Math.max.apply(null, UPGRADES.map(function(u) { return u.tier; }));
function principalDoTier(t) { return UPGRADES.filter(function(u) { return u.tier === t && u.principal; })[0]; }
function custoUpgrade(id, nivel) { const u = UPGRADE[id]; return Math.ceil(u.base * Math.pow(u.cresce, nivel)); }
