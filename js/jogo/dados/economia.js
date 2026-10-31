"use strict";

// =========================
// ECONOMIA (números ajustados com a simulação scratchpad/sim/eco.js: jogador médio, 3 toques/s)
// 1ª partida: robô 6 em ~40 s, 8 (libera renascer) em ~5 min, 10 em ~15 min, 12 em ~28 min.
// Depois de renascer (árvore), cada partida anda bem mais rápido: é isso que puxa o renascimento sem obrigar.
// =========================
const ECO = {
  razao: 2.3,          // cada nível de robô vale 2,3x o anterior (juntar dois sempre compensa)
  criarBase: 10,       // preço do 1º robô
  criarCresce: 1.085,  // cada robô criado na partida encarece o próximo
  toqueTime: 0.1       // o seu toque também vale 10% do que o time faz por segundo (tocar nunca fica inútil)
};
function valorRobo(n) { return Math.pow(ECO.razao, n - 1); }       // moedas por apertada do botão

// Upgrades comprados com moedas (somem no renascimento). efeito(nivel) é usado pelo jogo e pelo texto da aba
const UPGRADES = [
  { id: "dedo",      base: 40,   cresce: 2.0, max: 40, icone: "dedo" },      // toque: +2 por nível
  { id: "motor",     base: 200,  cresce: 2.3, max: 25, icone: "motor" },     // time aperta 12% mais rápido por nível
  { id: "fabrica",   base: 3000, cresce: 14,  max: 25, icone: "fabrica" },   // robô criado já nasce 1 nível acima
  { id: "esteira",   base: 300,  cresce: 2.6, max: 12, icone: "esteira" },   // robô grátis a cada 15 s (-18% por nível)
  { id: "linha",     base: 600,  cresce: 3.0, max: 12, icone: "linha" },     // criar fica 12% mais barato por nível
  { id: "moedas",    base: 8000, cresce: 4.5, max: 30, icone: "moeda" },     // tudo rende 30% mais por nível
  { id: "blindagem", base: 500,  cresce: 2.2, max: 40, icone: "escudo" }     // robôs 15% mais fortes na batalha
];
const UPGRADE = {};
UPGRADES.forEach(function(u) { UPGRADE[u.id] = u; });
function custoUpgrade(id, nivel) { const u = UPGRADE[id]; return Math.ceil(u.base * Math.pow(u.cresce, nivel)); }
