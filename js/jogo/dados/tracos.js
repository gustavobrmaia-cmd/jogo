"use strict";

// =========================
// TRAÇOS DOS ROBÔS (v9): todo robô que nasce (criado, da esteira ou de uma junção) pode vir com um traço sorteado.
// Ficam guardados por vaga em save.p.tr {grade: [], time: []} (mesmo tamanho das listas de robôs).
//   vel: velocidade de apertar no time · valor: quanto rende cada apertada · sorte: chance da apertada valer x10
//   bat: força na batalha. "chance" em % (somadas dá ~30%: 7 em cada 10 robôs vêm sem traço).
// =========================
const TRACOS = {
  veloz:      { chance: 7,   vel: 1.4,  ico: "raio",    cor: "#7cf0ff" },
  forte:      { chance: 6,   valor: 1.5, bat: 1.3, ico: "escudo", cor: "#ffa53d" },
  sortudo:    { chance: 5,   sorte: 0.08, ico: "trevo", cor: "#3ccf6e" },
  guerreiro:  { chance: 5,   bat: 2, valor: 0.8, ico: "batalha", cor: "#ff5d73" },
  preguicoso: { chance: 6,   vel: 0.6,  ico: "lua",     cor: "#8a8aa8" },
  dourado:    { chance: 1.5, valor: 3,  ico: "moeda",   cor: "#ffcc33" }
};
function rolarTraco() {
  let r = Math.random() * 100;
  for (const id in TRACOS) { r -= TRACOS[id].chance; if (r < 0) return id; }
  return "";
}
function dadosTraco(id) { return (id && TRACOS[id]) || {}; }
