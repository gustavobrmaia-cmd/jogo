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
// v19: os rivais 6–10 ganharam as personalidades novas (estrategista, provocador, ninja, furioso); 1–5 continuam iguais.
// =========================

const RIVAIS = [
  { id: "bob",    nome: "Bob",    cor: "#4dabf7", corpo: "classico",  acessorio: "bone",          estilo: "agressivo",    casa: "campo" },
  { id: "zippy",  nome: "Zippy",  cor: "#51cf66", corpo: "listras",   acessorio: "oculos",        estilo: "saltitante",   casa: "fabrica" },
  { id: "kiki",   nome: "Kiki",   cor: "#845ef7", corpo: "pintas",    acessorio: "orelhas_gato",  estilo: "agressivo",    casa: "floresta" },
  { id: "rocky",  nome: "Rocky",  cor: "#94d82d", corpo: "camuflado", acessorio: "chifres",       estilo: "saltitante",   casa: "fliperama" },
  { id: "nova",   nome: "Nova",   cor: "#22b8cf", corpo: "xadrez",    acessorio: "fone",          estilo: "atirador",     casa: "templo" },
  { id: "taz",    nome: "Taz",    cor: "#20c997", corpo: "robo",      acessorio: "antena",        estilo: "estrategista", casa: "laboratorio" },
  { id: "ivy",    nome: "Ivy",    cor: "#2f9e44", corpo: "melancia",  acessorio: "tiara_flores",  estilo: "provocador",   casa: "deserto" },
  { id: "frost",  nome: "Frost",  cor: "#a5d8ff", corpo: "gelo",      acessorio: "viking",        estilo: "atirador",     casa: "castelo" },
  { id: "shadow", nome: "Shadow", cor: "#845ef7", corpo: "cromado",   acessorio: "mascara_ninja", estilo: "ninja",        casa: "cidade" },
  { id: "king",   nome: "King",   cor: "#5f3dc4", corpo: "galaxia",   acessorio: "coroa",         estilo: "furioso",      casa: "dojo" }
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
// v20.2: o que vencer este rival libera (a "isca" para jogar o próximo). No PFT da v19.9 metade saía entre os rivais 2
// e 4, sem saber que as cartas de arma, as armas novas e a loja vinham logo depois. null = nada
function desbloqueioRival(i, liga) {
  if (liga) return null;
  if (i === 1) return { icone: "cartas", texto: t("libera_cartas") };
  if (i >= 2 && i <= 4 && !(typeof Progresso !== "undefined" && Progresso.lojaLiberada())) return { icone: "loja", texto: i === 4 ? t("libera_loja") : t("loja_em", 5 - i) };
  return null;
}
function textoPremioRival(i, liga) {
  const ace = RIVAIS[i].acessorio, novo = ace && typeof Progresso !== "undefined" && !Progresso.temSkin(ace);
  // v19: sem emoji (o texto aparece no HTML e no canvas): "Boné + 85 moedas"
  return t("venca_ganhe", (novo ? t("sk_" + ace) + " + " : "") + t("premio_moedas", premioRival(i, liga)));
}
