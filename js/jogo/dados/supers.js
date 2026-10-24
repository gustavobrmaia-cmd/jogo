"use strict";

// =========================
// SUPERS (v21.6). O medidor de SUPER (v21.5; combate.js carregarSuper) enche batendo e apanhando. Dois tipos:
//   "poder"  -> cheio, liga SOZINHO na hora: a bolinha fica mais forte por `dur` segundos (aura na cor do super);
//   "ataque" -> cheio, fica PRONTO e sai no próximo tiro (sem botão novo): um ataque enorme no oponente.
// Quem não comprou nenhum na loja (aba Supers) recebe um dos 3 grátis, sorteado a cada rodada.
// Preço em moedas (mesma escala das armas: comum 400, rara 3.000, lendária 9.000). Textos: su_<id> e sd_<id>.
// Campos de "poder": dano (x no dano dado), defesa (divide o dano recebido), vel (x na velocidade), cad (x no tempo
// entre tiros), raio (x no tamanho), cura (fração do dano dado que volta como vida), intocavel (não toma dano).
// =========================

const SUPERS = [
  { id: "dourado",   tipo: "poder",  gratis: true, cor: "#ffd43b", cor2: "#fff3a6", dur: 5, dano: 1.5 },
  { id: "turbo",     tipo: "poder",  gratis: true, cor: "#3bc9db", cor2: "#c5f6fa", dur: 5, vel: 1.45, cad: 0.5 },
  { id: "meteoros",  tipo: "ataque", gratis: true, cor: "#ff922b", cor2: "#ffd8a8" },
  { id: "gigante",   tipo: "poder",  preco: 2500, cor: "#ff6b6b", cor2: "#ffc9c9", dur: 6, raio: 1.55, dano: 1.3, defesa: 2 },
  { id: "raios",     tipo: "ataque", preco: 3000, cor: "#fcc419", cor2: "#fff9db" },
  { id: "vampiro",   tipo: "poder",  preco: 4500, cor: "#be4bdb", cor2: "#eebefa", dur: 6, dano: 1.25, cura: 0.6 },
  { id: "canhao",    tipo: "ataque", preco: 5500, cor: "#868e96", cor2: "#dee2e6" },
  { id: "intocavel", tipo: "poder",  preco: 7000, cor: "#74c0fc", cor2: "#e7f5ff", dur: 4, intocavel: true },
  { id: "misseis",   tipo: "ataque", preco: 8000, cor: "#fa5252", cor2: "#ffc9c9" },
  { id: "buraco",    tipo: "ataque", preco: 10000, cor: "#7048e8", cor2: "#d0bfff" }
];
const SUPER_DE = {};
SUPERS.forEach(function(s) { SUPER_DE[s.id] = s; });
const SUPERS_GRATIS = SUPERS.filter(function(s) { return s.gratis; }).map(function(s) { return s.id; });
