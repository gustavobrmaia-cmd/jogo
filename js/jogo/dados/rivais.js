"use strict";

// =========================
// MODO RIVAIS (a escada)
// Um modo à parte (o "Contra o bot" normal continua no menu). 10 rivais em sequência, cada um com nome, cor,
// skin, jeito de lutar e um mapa de casa (a 1ª rodada é nele):
//   venceu  -> próximo rival + moedas + o ACESSÓRIO dele (já vem equipado; o 5º também dá um baú de nível, o 10º um lendário);
//   perdeu  -> revanche contra o mesmo, um pouco mais fraco a cada derrota (rivalAjuste) — ninguém fica preso;
//   10º     -> CAMPEÃO da liga e a escada recomeça na liga seguinte (Bronze, Prata, Ouro, Diamante, Mestre, Mestre 2...),
//              com os mesmos rivais mais fortes.
// A 1ª partida da vida é contra o rival 1 (a partida "treino"). O progresso fica no save (rival, liga, rivalAjuste).
// Os mapas mais cruéis (no v10 o jogador perdia 67–85% neles) são a casa dos últimos rivais.
// Cores: só tons que se distinguem bem da bolinha rosa do jogador. Sem o "cauteloso" (foge e a rodada arrasta).
// =========================

const RIVAIS = [
  { id: "bob",    nome: "Bob",    cor: "#4dabf7", corpo: "classico",  acessorio: "bone",          estilo: "agressivo",    casa: "campo" },
  { id: "zippy",  nome: "Zippy",  cor: "#51cf66", corpo: "listras",   acessorio: "oculos",        estilo: "saltitante",   casa: "fabrica" },
  { id: "kiki",   nome: "Kiki",   cor: "#845ef7", corpo: "pintas",    acessorio: "orelhas_gato",  estilo: "agressivo",    casa: "floresta" },
  { id: "rocky",  nome: "Rocky",  cor: "#94d82d", corpo: "camuflado", acessorio: "chifres",       estilo: "saltitante",   casa: "fliperama" },
  { id: "nova",   nome: "Nova",   cor: "#22b8cf", corpo: "xadrez",    acessorio: "fone",          estilo: "atirador",     casa: "templo" },
  { id: "taz",    nome: "Taz",    cor: "#20c997", corpo: "robo",      acessorio: "antena",        estilo: "colecionador", casa: "laboratorio" },
  { id: "ivy",    nome: "Ivy",    cor: "#2f9e44", corpo: "melancia",  acessorio: "tiara_flores",  estilo: "saltitante",   casa: "deserto" },
  { id: "frost",  nome: "Frost",  cor: "#a5d8ff", corpo: "gelo",      acessorio: "viking",        estilo: "atirador",     casa: "castelo" },
  { id: "shadow", nome: "Shadow", cor: "#845ef7", corpo: "cromado",   acessorio: "mascara_ninja", estilo: "agressivo",    casa: "cidade" },
  { id: "king",   nome: "King",   cor: "#5f3dc4", corpo: "galaxia",   acessorio: "coroa",         estilo: "agressivo",    casa: "dojo" }
];

// força do bot: sobe devagar ao longo da escada (rival 1 = nível mais baixo, rival 10 ≈ 0,6) e 0,12 por liga;
// cada derrota contra o mesmo rival tira até 0,3 (save.rivalAjuste).
// v17: na Bronze os rivais 2 e 3 ficam em 0,04 e 0,08 (eram 0,08 e 0,15). Na simulação do novato, junto com o tiro
// x1,5 (CONFIG.multRivais) e sem os mapas difíceis: rival 2 de 25% para 12% das rodadas perdidas, rival 3 de 23% para 9%.
function nivelRival(i, liga, ajuste) {
  const base = !liga && i >= 1 && i <= 2 ? [0.04, 0.08][i - 1] : 0.02 + 0.58 * i / (RIVAIS.length - 1);
  return limitar(base + 0.12 * (liga || 0) + (ajuste || 0), 0.02, 1);
}

// moedas por vencer o rival i (o 5º e o 10º também dão baú)
function premioRival(i, liga) {
  return Math.round((40 + 15 * i) * (1 + 0.5 * (liga || 0)));
}

// "Bronze", "Prata"... e depois "Mestre 2", "Mestre 3"...
function nomeLiga(liga) {
  return liga < 5 ? t("liga_" + liga) : t("liga_4") + " " + (liga - 3);
}

// o que se ganha vencendo o rival i: o acessório dele (se ainda não tiver) ou só as moedas
function textoPremioRival(i, liga) {
  const ace = RIVAIS[i].acessorio, novo = ace && typeof Progresso !== "undefined" && !Progresso.temSkin(ace);
  return t("venca_ganhe", (novo ? "🎁 " + t("sk_" + ace) + " + " : "") + premioRival(i, liga) + " 🪙");
}
