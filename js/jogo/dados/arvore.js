"use strict";

// =========================
// ÁRVORE DE HABILIDADES (pontos de habilidade = PH; só dá para gastar NA HORA DE RENASCER: é o que puxa o
// renascimento sem obrigar). 3 galhos. "req": nó que precisa ter antes. "max" > 1: dá para comprar de novo,
// cada vez mais caro (custo * 2^nível).
// =========================
const ARVORE = [
  // galho do BOTÃO
  { id: "dedo_aco",   galho: 0, custo: 2,  max: 3, req: null },          // toque x2 por nível
  { id: "turbo",      galho: 0, custo: 3,  max: 3, req: "dedo_aco" },    // time +25% de velocidade por nível
  { id: "critico",    galho: 0, custo: 4,  max: 1, req: "dedo_aco" },    // 10% dos toques valem x10
  { id: "sexto",      galho: 0, custo: 8,  max: 1, req: "turbo" },       // 6º robô no time
  { id: "dobro",      galho: 0, custo: 6,  max: 20, req: "turbo" },      // tudo rende x2 (repetível)
  // galho da FÁBRICA
  { id: "rico",       galho: 1, custo: 1,  max: 1, req: null },          // começa com 2.000 moedas
  { id: "fab_ini",    galho: 1, custo: 3,  max: 5, req: "rico" },        // começa com a fábrica +1 por nível
  { id: "grade",      galho: 1, custo: 4,  max: 1, req: "rico" },        // +6 vagas na grade
  { id: "sorte",      galho: 1, custo: 5,  max: 3, req: "fab_ini" },     // 10% de chance (por nível) do robô nascer 1 acima
  { id: "fusao",      galho: 1, custo: 7,  max: 1, req: "grade" },       // junta sozinho os iguais
  // galho da BATALHA
  { id: "blindagem",  galho: 2, custo: 1,  max: 5, req: null },          // +30% de vida e ataque por nível
  { id: "saque",      galho: 2, custo: 3,  max: 3, req: "blindagem" },   // +50% de prêmio nas hordas por nível
  { id: "esquadrao",  galho: 2, custo: 5,  max: 1, req: "blindagem" },   // 12 robôs na batalha
  { id: "offline",    galho: 2, custo: 3,  max: 2, req: "saque" },       // ganhos offline até +2 h por nível
  { id: "cacador",    galho: 2, custo: 6,  max: 1, req: "esquadrao" }    // monstros descobertos dão o dobro de PH
];
const NO = {};
ARVORE.forEach(function(n) { NO[n.id] = n; });
function custoNo(id, nivel) { return NO[id].custo * Math.pow(2, nivel || 0); }
// PH ganhos ao renascer, pelo maior robô da partida: 8 -> 1, 10 -> 3, 12 -> 7, 14 -> 17...
function phRenascer(maxTier) { return maxTier < CONFIG.tierRenascer ? 0 : Math.floor(Math.pow(1.5, maxTier - 7)); }
