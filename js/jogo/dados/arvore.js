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
  { id: "ph_bonus",  x: 50, y: 70, custo: 4,  max: 3,  liga: ["nucleo"],                ico: "ph" }          // v7: descobertas dão +25% PH
];
// v7: a árvore cresceu MUITO (23 -> 73 nós) e virou um MAPA grande que se arrasta. x/y agora em "casas" do mapa
// (MAPA_L x MAPA_A); os 23 nós antigos ficaram no meio (convertidos de 0..100). Os nós novos são de TIPOS genéricos
// (renda, time, toque...) somados por arv(tipo), mais 5 nós-chave únicos (sétimo robô, grade maior, criador
// automático, começo milionário, fábrica avançada inicial). Galhos novos: Ouro (esquerda) e Conhecimento (direita).
const MAPA_L = 26, MAPA_A = 20;
ARVORE.forEach(function(n) { n.x = 7 + n.x * 0.12; n.y = 6 + n.y * 0.09; });
// tipo: [ícone, efeito por nível (texto e conta em jogo.js/batalha.js/surpresas.js/missoes.js)]
const TIPOS_NO = {
  renda: "moeda", time: "motor", toque: "dedo", criar: "prensa", esteira: "esteira", batalha: "batalha", hab: "missil",
  invasor: "canhao", ouro: "ima", missao: "trofeu", turboouro: "raio", ph: "ph", offline: "reator"
};
// [id, tipo (ou null = nó-chave), x, y, custo, max, liga, ícone do nó-chave]
[
  // BOTÃO (em cima)
  ["g_t1", "renda", 13, 5.2, 3, 3, ["dobro"]], ["g_t2", "toque", 10.4, 5.8, 3, 3, ["critico2"]], ["g_t3", "time", 15.6, 5.8, 3, 3, ["sexto"]],
  ["g_t4", "renda", 13, 3.8, 5, 3, ["g_t1"]], ["g_t5", "toque", 10, 4.2, 5, 3, ["g_t2"]], ["g_t6", "time", 16, 4.2, 5, 3, ["g_t3"]],
  ["setimo", null, 17.9, 3, 20, 1, ["g_t6"], "upgrades"],
  ["g_t8", "renda", 13, 2.4, 8, 3, ["g_t4"]], ["g_t9", "toque", 10.6, 2.6, 8, 3, ["g_t5", "g_t8"]], ["g_t10", "time", 15.4, 2.6, 8, 3, ["g_t6", "g_t8"]],
  ["g_t11", "renda", 13, 1.1, 12, 3, ["g_t8"]], ["auto_criar", null, 8.3, 1.5, 20, 1, ["g_t9"], "engrenagem"],
  // FÁBRICA (embaixo, esquerda)
  ["g_f1", "criar", 6.4, 12.6, 3, 3, ["grade"]], ["g_f2", "esteira", 11.6, 15.4, 3, 3, ["esteira_r"]], ["grade2", null, 5, 11.1, 20, 1, ["g_f1"], "fabrica"],
  ["g_f4", "criar", 6.6, 15.2, 5, 3, ["fusao"]], ["g_f5", "esteira", 9.8, 16.4, 5, 3, ["g_f2", "g_f4"]], ["g_f6", "renda", 4.6, 14, 5, 3, ["g_f1", "g_f4"]],
  ["rico2", null, 3, 12.3, 20, 1, ["g_f6"], "cofre"], ["g_f8", "criar", 5.4, 17.2, 8, 3, ["g_f4"]], ["g_f9", "esteira", 8, 18.2, 8, 3, ["g_f5", "g_f8"]],
  ["g_f10", "renda", 3.1, 16, 12, 3, ["g_f6", "g_f8"]], ["fab_ini2", null, 11.6, 18.4, 20, 1, ["g_f5"], "fabrica"],
  // BATALHA (embaixo, direita)
  ["g_b1", "batalha", 19.4, 11.6, 3, 3, ["esquadrao"]], ["g_b2", "hab", 17.8, 15.6, 3, 3, ["cacador"]], ["g_b3", "offline", 14.4, 15.4, 3, 2, ["offline"]],
  ["g_b4", "batalha", 21, 12.8, 5, 3, ["g_b1"]], ["g_b5", "invasor", 19.8, 14.4, 5, 3, ["cacador", "g_b4"]], ["g_b6", "hab", 19.4, 16.8, 5, 3, ["g_b2", "g_b5"]],
  ["g_b7", "offline", 15.8, 16.8, 5, 2, ["g_b3", "g_b2"]], ["g_b8", "batalha", 22.6, 14.4, 8, 3, ["g_b4"]], ["g_b9", "invasor", 21.4, 16.2, 8, 3, ["g_b5", "g_b8"]],
  ["g_b10", "hab", 20.6, 18.3, 12, 3, ["g_b6", "g_b9"]], ["g_b11", "renda", 17.4, 18.4, 12, 3, ["g_b7", "g_b6"]],
  // OURO (esquerda): robô dourado, turbo e missões
  ["g_o1", "ouro", 8, 8.4, 3, 3, ["critico2", "fab_ini"]], ["g_o2", "missao", 6.4, 9.6, 3, 3, ["g_o1"]], ["g_o3", "ouro", 6.2, 7.2, 5, 3, ["g_o1"]],
  ["g_o4", "missao", 4.6, 8.6, 5, 3, ["g_o2", "g_o3"]], ["g_o5", "turboouro", 4.4, 6.2, 8, 3, ["g_o3"]], ["g_o6", "ouro", 2.8, 7.4, 8, 3, ["g_o4", "g_o5"]],
  ["g_o7", "missao", 2.8, 9.8, 8, 3, ["g_o4"]], ["g_o8", "renda", 1.4, 8.6, 12, 3, ["g_o6", "g_o7"]],
  // CONHECIMENTO (direita): pontos de habilidade das descobertas e time
  ["g_c1", "ph", 18, 8.4, 3, 3, ["sexto", "saque"]], ["g_c2", "ph", 19.6, 9.6, 5, 3, ["g_c1"]], ["g_c3", "time", 19.8, 7.2, 5, 3, ["g_c1"]],
  ["g_c4", "ph", 21.4, 8.6, 8, 3, ["g_c2", "g_c3"]], ["g_c5", "renda", 21.6, 6.2, 8, 3, ["g_c3"]], ["g_c6", "ph", 23.2, 7.4, 12, 3, ["g_c4", "g_c5"]],
  ["g_c7", "time", 23.2, 9.8, 12, 3, ["g_c4"]], ["g_c8", "renda", 24.6, 8.6, 16, 3, ["g_c6", "g_c7"]]
].forEach(function(d) {
  ARVORE.push({ id: d[0], tipo: d[1] || undefined, x: d[2], y: d[3], custo: d[4], max: d[5], liga: d[6], ico: d[1] ? TIPOS_NO[d[1]] : d[7] });
});
const NO = {};
ARVORE.forEach(function(n) { NO[n.id] = n; });
// v3: tudo custa 3x (os PH ficaram bem maiores)
function custoNo(id, nivel) { return NO[id].custo * 3 * Math.pow(2, nivel || 0); }
function noAberto(id) { const n = NO[id]; return !n.liga.length || n.liga.some(function(l) { return (save.arvore[l] || 0) > 0; }); }
// v7: renascer NÃO dá pontos (o dono: "você vai gastar o que conseguiu"); os pontos vêm das descobertas.
// Renascer continua multiplicando a renda por 1,25 para sempre (jogo.js).
function phRenascer() { return 0; }
// soma dos níveis comprados nos nós genéricos de um tipo
const NOS_TIPO = {};
ARVORE.forEach(function(n) { if (n.tipo) (NOS_TIPO[n.tipo] || (NOS_TIPO[n.tipo] = [])).push(n.id); });
function arv(tipo) { const l = NOS_TIPO[tipo]; if (!l) return 0; let s = 0; for (let i = 0; i < l.length; i++) s += save.arvore[l[i]] || 0; return s; }
// pontos de habilidade das descobertas: +10% por nível de "ph" e +25% por nível do Bônus de Descoberta (antigo ph_bonus)
function fatorPh() { return 1 + 0.1 * arv("ph") + 0.25 * (save.arvore.ph_bonus || 0); }
// nome dos nós genéricos: nome do tipo + número romano (ordem no mapa)
const ROMANO = ["I", "II", "III", "IV", "V", "VI"];
function nomeNo(id) { const n = NO[id]; if (id === "ph_bonus") return t("ar_ph_bonus2"); if (!n.tipo) return t("ar_" + id); return t("art_" + n.tipo) + " " + ROMANO[NOS_TIPO[n.tipo].indexOf(id)]; }
function descNo(id) { const n = NO[id]; if (id === "ph_bonus") return t("ar_ph_bonus_d2"); return n.tipo ? t("art_" + n.tipo + "_d") : t("ar_" + id + "_d"); }
const BONUS_RENASCER = 1.25;
