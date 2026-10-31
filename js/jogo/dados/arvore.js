"use strict";

// =========================
// ÁRVORE DE HABILIDADES (rede de nós como uma placa de circuito; pontos de habilidade = PH)
// Os PH só são gastos NA HORA DE RENASCER (dá para olhar a qualquer momento): ver o que dá para ter com os pontos
// guardados é o que puxa o renascimento sem obrigar. Um nó abre quando QUALQUER nó ligado a ele ("liga") já foi
// comprado. x/y em 0..100 (posição no desenho). max > 1: compra de novo, cada vez mais cara (custo * 2^nível).
// Três galhos saindo do núcleo: Botão (para cima), Fábrica (embaixo à esquerda), Batalha (embaixo à direita).
// =========================
const ARVORE = [
  { id: "nucleo",    x: 50, y: 52, custo: 1,  max: 1,  liga: [],                        ico: "reator" },     // +10% em tudo
  // BOTÃO
  { id: "dedo_aco",  x: 50, y: 39, custo: 2,  max: 3,  liga: ["nucleo"],                ico: "dedo" },       // toque x2
  { id: "critico",   x: 37, y: 30, custo: 4,  max: 1,  liga: ["dedo_aco"],              ico: "raio" },       // 10% dos toques x10
  { id: "turbo",     x: 63, y: 30, custo: 3,  max: 3,  liga: ["dedo_aco"],              ico: "motor" },      // time +25%
  { id: "critico2",  x: 28, y: 17, custo: 10, max: 1,  liga: ["critico"],               ico: "raio" },       // crítico x25
  { id: "ganancia",  x: 50, y: 22, custo: 5,  max: 3,  liga: ["critico", "turbo"],      ico: "moeda" },      // tudo +50%
  { id: "sexto",     x: 72, y: 17, custo: 8,  max: 1,  liga: ["turbo"],                 ico: "upgrades" },   // 6º robô no time
  { id: "dobro",     x: 50, y: 7,  custo: 6,  max: 20, liga: ["ganancia"],              ico: "cofre" },      // tudo x2
  // FÁBRICA
  { id: "rico",      x: 37, y: 61, custo: 1,  max: 1,  liga: ["nucleo"],                ico: "moeda" },      // começa com 2.000
  { id: "fab_ini",   x: 24, y: 57, custo: 3,  max: 3,  liga: ["rico"],                  ico: "fabrica" },    // Fábrica +1 no começo
  { id: "desconto",  x: 33, y: 74, custo: 3,  max: 3,  liga: ["rico"],                  ico: "prensa" },     // criar 15% mais barato
  { id: "grade",     x: 12, y: 66, custo: 4,  max: 1,  liga: ["fab_ini"],               ico: "fabrica" },    // +6 vagas
  { id: "sorte",     x: 21, y: 80, custo: 5,  max: 3,  liga: ["fab_ini", "desconto"],   ico: "engrenagem" }, // 10% nasce 1 acima
  { id: "esteira_r", x: 40, y: 88, custo: 4,  max: 2,  liga: ["desconto"],              ico: "esteira" },    // robô grátis 20% mais cedo
  { id: "fusao",     x: 9,  y: 89, custo: 7,  max: 1,  liga: ["grade", "sorte"],        ico: "linha" },      // junta sozinho
  // BATALHA
  { id: "blindagem", x: 63, y: 61, custo: 1,  max: 5,  liga: ["nucleo"],                ico: "escudo" },     // +30% vida e ataque
  { id: "saque",     x: 76, y: 57, custo: 3,  max: 3,  liga: ["blindagem"],             ico: "trofeu" },     // +50% de prêmio
  { id: "hab_dano",  x: 67, y: 74, custo: 3,  max: 3,  liga: ["blindagem"],             ico: "missil" },     // habilidades +50%
  { id: "esquadrao", x: 88, y: 66, custo: 5,  max: 1,  liga: ["saque"],                 ico: "batalha" },    // 12 robôs na batalha
  { id: "hab_cd",    x: 79, y: 80, custo: 4,  max: 2,  liga: ["saque", "hab_dano"],     ico: "choque" },     // habilidades recarregam 20% mais rápido
  { id: "offline",   x: 60, y: 88, custo: 3,  max: 2,  liga: ["hab_dano"],              ico: "reator" },     // ganhos offline +2 h
  { id: "cacador",   x: 91, y: 89, custo: 6,  max: 1,  liga: ["esquadrao", "hab_cd"],   ico: "compendio" },  // monstros dão o dobro de PH
  // no meio, embaixo do núcleo
  { id: "ph_bonus",  x: 50, y: 70, custo: 4,  max: 3,  liga: ["nucleo"],                ico: "ph" }          // renascer dá +25% PH
];
const NO = {};
ARVORE.forEach(function(n) { NO[n.id] = n; });
// v3: tudo custa 3x (os PH ficaram bem maiores)
function custoNo(id, nivel) { return NO[id].custo * 3 * Math.pow(2, nivel || 0); }
function noAberto(id) { const n = NO[id]; return !n.liga.length || n.liga.some(function(l) { return (save.arvore[l] || 0) > 0; }); }
// PH ganhos ao renascer, pelo maior robô da partida (v3, bem mais): 8 -> 4, 9 -> 7, 10 -> 12, 11 -> 19, 12 -> 31,
// 14 -> 80... (+25% por nível de ph_bonus). E cada renascimento multiplica a renda por 1,25 para sempre (jogo.js)
function phRenascer(maxTier) { return maxTier < CONFIG.tierRenascer ? 0 : Math.floor(3 * Math.pow(1.6, maxTier - 7) * (1 + 0.25 * (save.arvore.ph_bonus || 0))); }
const BONUS_RENASCER = 1.25;
