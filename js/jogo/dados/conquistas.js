"use strict";

// =========================
// CONQUISTAS (v14): metas longas. 12 conquistas x 5 medalhas (bronze, prata, ouro, platina, diamante); cada medalha
// pegada dá pontos de habilidade (CQ_PH). Ficam no Compêndio > Conquistas; save.conquistas[id] = medalhas já pegas.
// O texto reaproveita as condições dos visuais do botão (sk_c_*) e cq_c_* para as novas.
// =========================
const CONQUISTAS = [
  { id: "criados",    txt: "sk_c_criados",   ico: "fabrica",  alvos: [25, 150, 600, 2500, 10000] },
  { id: "toques",     txt: "sk_c_toques",    ico: "dedo",     alvos: [300, 2000, 10000, 50000, 200000] },
  { id: "juntar",     txt: "cq_c_juntar",    ico: "upgrades", alvos: [20, 120, 500, 2000, 8000] },
  { id: "tier",       txt: "sk_c_tier",      ico: "estrela",  alvos: [6, 10, 14, 19, 25] },
  { id: "hordas",     txt: "sk_c_hordas",    ico: "batalha",  alvos: [1, 3, 5, 7, 9] },
  { id: "renasc",     txt: "sk_c_renasc",    ico: "renascer", alvos: [1, 3, 6, 12, 25] },
  { id: "ouros",      txt: "sk_c_ouros",     ico: "moeda",    alvos: [3, 12, 40, 120, 400] },
  { id: "invasores",  txt: "sk_c_invasores", ico: "escudo",   alvos: [3, 12, 40, 120, 400] },
  { id: "torre",      txt: "sk_c_torre",     ico: "trofeu",   alvos: [3, 10, 20, 35, 60] },
  { id: "raids",      txt: "sk_c_raids",     ico: "missil",   alvos: [1, 4, 12, 30, 75] },
  { id: "encomendas", txt: "cq_c_encomendas", ico: "prancheta", alvos: [2, 10, 30, 100, 300] },
  { id: "roleta",     txt: "cq_c_roleta",    ico: "roleta",   alvos: [1, 6, 25, 80, 250] }
];
const CQ_PH = [1, 2, 3, 5, 8];
const CQ_COR = ["#d08a4a", "#cfd6ea", "#ffcc33", "#7cf0ff", "#ff6bd0"];
function valorConquista(c) {
  const st = save.stats;
  switch (c.id) {
    case "criados": return st.criados || 0;
    case "toques": return st.toques || 0;
    case "juntar": return st.juncoes || 0;
    case "tier": return Math.max.apply(null, save.robosVistos.concat([0]));
    case "hordas": return save.hordasVencidas;
    case "renasc": return save.renascimentos;
    case "ouros": return st.ouros || 0;
    case "invasores": return st.invasores || 0;
    case "torre": return save.torre.recorde;
    case "raids": return st.raids || 0;
    case "encomendas": return save.encomendasFeitas || 0;
    case "roleta": return (save.roleta && save.roleta.giros) || 0;
  }
  return 0;
}
// bônus permanente da coleção (compêndio): +3% por robô descoberto e +2% por monstro, em tudo que rende moedas
function bonusColecao() { return 0.03 * save.robosVistos.length + 0.02 * save.monstrosVistos.length; }
