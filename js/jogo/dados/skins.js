"use strict";

// =========================
// PERSONALIZAÇÃO (v19): 9 categorias que se combinam na bolinha do jogador.
//   cor       a cor da bolinha (nos corpos de cor própria — ouro, galáxia... — a cor do corpo manda)
//   corpo     material/estampa da esfera (padrões: listras, raio, vaca...)  -> ArteSkins.corpo
//   olhos     por cima dos olhos (óculos, cílios, máscara...)               -> ArteSkins.acessorio (camada)
//   boca      por cima da boca (bigode, presas, pirulito...)                -> idem
//   chapeu    na cabeça (boné, cartola, hélice...)                          -> idem
//   acessorio no corpo (fone, asas, capa, gravata...)                       -> idem
//   rastro    partículas atrás de quem anda (motor/partida.js, com os Efeitos)
//   ko        efeito extra quando a pessoa derruba o oponente (partida.js)
//   emote     comemoração quando vence a rodada: balão com ícone + jeito de pular (partida.js + ArteSkins)
// raridade: 1 comum, 2 rara, 3 épica, 4 lendária
// como ganhar: preco (moedas) | bau (só em baú) | nivel (chega nesse nível do jogador) | conquista (id em CONQUISTAS)
//              | semanal (prêmio dos desafios da semana) | gratis (já vem com o jogo)
// Ids são únicos entre todas as categorias (save.donos guarda todos juntos; o save antigo continua valendo).
// cor do corpo: "jogador" = usa a cor escolhida; um hex = o corpo tem cor própria.
// =========================

const CATEGORIAS_VISUAL = ["cor", "corpo", "olhos", "boca", "chapeu", "acessorio", "rastro", "ko", "emote"];
// ícone de cada aba (nomes de Icone.NOMES)
const ICONE_CATEGORIA = { cor: "pincel", corpo: "estrela", olhos: "olho", boca: "nota", chapeu: "chapeu", acessorio: "presente",
  rastro: "rastro", ko: "explosao", emote: "coracao" };

const SKINS = [
  // ---- cor ----
  { id: "cor_rosa", tipo: "cor", raridade: 1, gratis: true, cor: "#ff5d73" },
  { id: "cor_azul", tipo: "cor", raridade: 1, gratis: true, cor: "#4dabf7" },
  { id: "cor_amarelo", tipo: "cor", raridade: 1, preco: 60, cor: "#ffd43b" },
  { id: "cor_verde", tipo: "cor", raridade: 1, preco: 60, cor: "#51cf66" },
  { id: "cor_roxo", tipo: "cor", raridade: 1, preco: 80, cor: "#cc5de8" },
  { id: "cor_laranja", tipo: "cor", raridade: 1, preco: 80, cor: "#ff922b" },
  { id: "cor_ciano", tipo: "cor", raridade: 1, preco: 100, cor: "#22b8cf" },
  { id: "cor_pink", tipo: "cor", raridade: 1, preco: 100, cor: "#f06595" },
  { id: "cor_lima", tipo: "cor", raridade: 1, preco: 120, cor: "#94d82d" },
  { id: "cor_violeta", tipo: "cor", raridade: 2, preco: 150, cor: "#845ef7" },
  { id: "cor_salmao", tipo: "cor", raridade: 2, preco: 150, cor: "#ff8787" },
  { id: "cor_menta", tipo: "cor", raridade: 2, preco: 180, cor: "#20c997" },
  { id: "cor_branco", tipo: "cor", raridade: 3, nivel: 6, cor: "#eef1f6" },
  { id: "cor_carvao", tipo: "cor", raridade: 3, nivel: 10, cor: "#5c5f7a" },
  { id: "cor_dourado", tipo: "cor", raridade: 4, bau: true, cor: "#fab005" },

  // ---- corpo (estampa/material) ----
  { id: "classico", tipo: "corpo", raridade: 1, gratis: true, cor: "jogador" },
  { id: "listras", tipo: "corpo", raridade: 1, preco: 150, cor: "jogador" },
  { id: "pintas", tipo: "corpo", raridade: 1, preco: 150, cor: "jogador" },
  { id: "zigue", tipo: "corpo", raridade: 1, preco: 180, cor: "jogador" },
  { id: "xadrez", tipo: "corpo", raridade: 1, preco: 200, cor: "jogador" },
  { id: "bolhas", tipo: "corpo", raridade: 1, preco: 220, cor: "jogador" },
  { id: "coracoes", tipo: "corpo", raridade: 2, preco: 300, cor: "jogador" },
  { id: "raio", tipo: "corpo", raridade: 2, preco: 350, cor: "jogador" },
  { id: "estrelas", tipo: "corpo", raridade: 2, preco: 400, cor: "jogador" },
  { id: "camuflado", tipo: "corpo", raridade: 2, preco: 400, cor: "jogador" },
  { id: "futebol", tipo: "corpo", raridade: 2, preco: 450, cor: "#f1f3f5" },
  { id: "melancia", tipo: "corpo", raridade: 2, preco: 450, cor: "#2f9e44" },
  { id: "queijo", tipo: "corpo", raridade: 2, preco: 500, cor: "#ffd43b" },
  { id: "vaca", tipo: "corpo", raridade: 2, nivel: 4, cor: "#f8f9fa" },
  { id: "robo", tipo: "corpo", raridade: 2, conquista: "vitorias_25", cor: "jogador" },
  { id: "doce", tipo: "corpo", raridade: 2, semanal: true, cor: "#f783ac" },
  { id: "biscoito", tipo: "corpo", raridade: 3, bau: true, cor: "#c98a4b" },
  { id: "tigre", tipo: "corpo", raridade: 3, preco: 800, cor: "#ff922b" },
  { id: "cromado", tipo: "corpo", raridade: 3, preco: 900, cor: "jogador" },
  { id: "gelo", tipo: "corpo", raridade: 3, preco: 900, cor: "#a5d8ff" },
  { id: "neon", tipo: "corpo", raridade: 3, conquista: "cenarios_todos", cor: "jogador" },
  { id: "lava", tipo: "corpo", raridade: 3, semanal: true, cor: "#ff6b1a" },
  { id: "arcoiris", tipo: "corpo", raridade: 4, bau: true, cor: "#ff6b6b" },
  { id: "diamante", tipo: "corpo", raridade: 4, preco: 2000, cor: "#99e9f2" },
  { id: "galaxia", tipo: "corpo", raridade: 4, semanal: true, cor: "#5f3dc4" },
  { id: "ouro", tipo: "corpo", raridade: 4, conquista: "bot_mestre", cor: "#fcc419" },

  // ---- olhos ----
  { id: "sobrancelha", tipo: "olhos", raridade: 1, preco: 120 },
  { id: "oculos", tipo: "olhos", raridade: 1, preco: 150 },
  { id: "cilios", tipo: "olhos", raridade: 1, preco: 150 },
  { id: "oculos_sol", tipo: "olhos", raridade: 1, preco: 200 },
  { id: "tapa_olho", tipo: "olhos", raridade: 2, preco: 300 },
  { id: "mascara_heroi", tipo: "olhos", raridade: 2, preco: 350 },
  { id: "monoculo", tipo: "olhos", raridade: 2, preco: 400 },
  { id: "pintura_guerra", tipo: "olhos", raridade: 2, nivel: 8 },
  { id: "oculos_coracao", tipo: "olhos", raridade: 3, preco: 700 },
  { id: "visor", tipo: "olhos", raridade: 3, preco: 900 },
  { id: "oculos_estrela", tipo: "olhos", raridade: 4, semanal: true },

  // ---- boca ----
  { id: "dentucos", tipo: "boca", raridade: 1, preco: 120 },
  { id: "bigode", tipo: "boca", raridade: 1, preco: 150 },
  { id: "chupeta", tipo: "boca", raridade: 1, preco: 200 },
  { id: "presas", tipo: "boca", raridade: 2, preco: 300 },
  { id: "pirulito", tipo: "boca", raridade: 2, preco: 350 },
  { id: "bigode_fino", tipo: "boca", raridade: 2, preco: 400 },
  { id: "barba", tipo: "boca", raridade: 2, nivel: 5 },
  { id: "bandana", tipo: "boca", raridade: 3, preco: 700 },
  { id: "cachimbo", tipo: "boca", raridade: 3, nivel: 12 },
  { id: "rosa_boca", tipo: "boca", raridade: 3, bau: true },

  // ---- chapéu ----
  { id: "bone", tipo: "chapeu", raridade: 1, preco: 120 },
  { id: "gorro", tipo: "chapeu", raridade: 1, preco: 150 },
  { id: "orelhas_gato", tipo: "chapeu", raridade: 1, preco: 150 },
  { id: "festa", tipo: "chapeu", raridade: 1, preco: 200 },
  { id: "topete", tipo: "chapeu", raridade: 1, preco: 250 },
  { id: "chef", tipo: "chapeu", raridade: 2, preco: 300 },
  { id: "coelho", tipo: "chapeu", raridade: 2, preco: 300 },
  { id: "natal", tipo: "chapeu", raridade: 2, preco: 300 },
  { id: "helice", tipo: "chapeu", raridade: 2, preco: 350 },
  { id: "capacete", tipo: "chapeu", raridade: 2, preco: 350 },
  { id: "cartola", tipo: "chapeu", raridade: 2, preco: 400 },
  { id: "bruxa", tipo: "chapeu", raridade: 2, preco: 500 },
  { id: "sombrero", tipo: "chapeu", raridade: 2, preco: 500 },
  { id: "chifres", tipo: "chapeu", raridade: 2, conquista: "explosivos_50" },
  { id: "tiara_flores", tipo: "chapeu", raridade: 2, semanal: true },
  { id: "moicano", tipo: "chapeu", raridade: 3, preco: 600 },
  { id: "pirata", tipo: "chapeu", raridade: 3, preco: 700 },
  { id: "viking", tipo: "chapeu", raridade: 3, preco: 800 },
  { id: "cowboy", tipo: "chapeu", raridade: 3, semanal: true },
  { id: "antena", tipo: "chapeu", raridade: 3, conquista: "quedas_20" },
  { id: "louros", tipo: "chapeu", raridade: 3, nivel: 15 },
  { id: "barbatana", tipo: "chapeu", raridade: 3, bau: true },
  { id: "tiara_princesa", tipo: "chapeu", raridade: 3, preco: 1200 },
  { id: "aureola", tipo: "chapeu", raridade: 4, conquista: "missoes_50" },
  { id: "coroa", tipo: "chapeu", raridade: 4, preco: 1800 },
  { id: "coroa_gelo", tipo: "chapeu", raridade: 4, bau: true },

  // ---- acessório ----
  { id: "gravata", tipo: "acessorio", raridade: 1, preco: 150 },
  { id: "cachecol", tipo: "acessorio", raridade: 1, preco: 200 },
  { id: "fone", tipo: "acessorio", raridade: 2, preco: 350 },
  { id: "capa", tipo: "acessorio", raridade: 2, preco: 500 },
  { id: "mascara_ninja", tipo: "acessorio", raridade: 3, conquista: "perfeitas_10" },
  { id: "colar_ouro", tipo: "acessorio", raridade: 3, preco: 800 },
  { id: "asas_morcego", tipo: "acessorio", raridade: 3, preco: 1000 },
  { id: "asas_fada", tipo: "acessorio", raridade: 3, bau: true },
  { id: "satelite", tipo: "acessorio", raridade: 4, nivel: 20 },
  { id: "asas_anjo", tipo: "acessorio", raridade: 4, preco: 2200 },

  // ---- rastro (partículas atrás de quem anda) ----
  { id: "r_fumaca", tipo: "rastro", raridade: 1, preco: 200 },
  { id: "r_faiscas", tipo: "rastro", raridade: 1, preco: 300 },
  { id: "r_neon", tipo: "rastro", raridade: 2, preco: 350 },
  { id: "r_bolhas", tipo: "rastro", raridade: 2, preco: 400 },
  { id: "r_gelo", tipo: "rastro", raridade: 2, preco: 450 },
  { id: "r_estrelas", tipo: "rastro", raridade: 2, nivel: 7 },
  { id: "r_fogo", tipo: "rastro", raridade: 3, preco: 700 },
  { id: "r_raio", tipo: "rastro", raridade: 3, bau: true },
  { id: "r_arcoiris", tipo: "rastro", raridade: 4, preco: 1500 },

  // ---- efeito de K.O. ----
  { id: "k_estrelas", tipo: "ko", raridade: 1, preco: 250 },
  { id: "k_fogos", tipo: "ko", raridade: 1, preco: 350 },
  { id: "k_gelo", tipo: "ko", raridade: 2, preco: 500 },
  { id: "k_portal", tipo: "ko", raridade: 2, preco: 550 },
  { id: "k_explosao", tipo: "ko", raridade: 2, nivel: 9 },
  { id: "k_raio", tipo: "ko", raridade: 3, preco: 800 },
  { id: "k_moedas", tipo: "ko", raridade: 3, bau: true },
  { id: "k_supernova", tipo: "ko", raridade: 4, preco: 2000 },

  // ---- emote de vitória (balão com ícone + jeito de comemorar) ----
  { id: "e_nota", tipo: "emote", raridade: 1, preco: 150, icone: "nota", mov: "danca" },
  { id: "e_coracao", tipo: "emote", raridade: 1, preco: 200, icone: "coracao", mov: "pulinhos" },
  { id: "e_estrela", tipo: "emote", raridade: 2, preco: 300, icone: "estrela", mov: "pulinhos" },
  { id: "e_ok", tipo: "emote", raridade: 2, preco: 350, icone: "ok", mov: "danca" },
  { id: "e_fogo", tipo: "emote", raridade: 2, nivel: 3, icone: "fogo", mov: "pulao" },
  { id: "e_raio", tipo: "emote", raridade: 3, preco: 700, icone: "raio", mov: "pulao" },
  { id: "e_coroa", tipo: "emote", raridade: 3, bau: true, icone: "coroa", mov: "danca" },
  { id: "e_trofeu", tipo: "emote", raridade: 4, preco: 1500, icone: "trofeu", mov: "pulao" }
];

const SKIN = {};
const SKINS_POR_TIPO = {};
CATEGORIAS_VISUAL.forEach(function(c) { SKINS_POR_TIPO[c] = []; });
SKINS.forEach(function(s) { SKIN[s.id] = s; SKINS_POR_TIPO[s.tipo].push(s); });

// (compatibilidade com o código antigo) corpos e tudo o que vai por cima da cabeça
const SKINS_CORPO = SKINS_POR_TIPO.corpo;
const SKINS_ACESSORIO = [{ id: "nenhum", tipo: "acessorio", raridade: 1, gratis: true }].concat(
  SKINS_POR_TIPO.chapeu, SKINS_POR_TIPO.acessorio, SKINS_POR_TIPO.olhos, SKINS_POR_TIPO.boca);
SKIN.nenhum = SKINS_ACESSORIO[0];

// o que a bolinha usa quando ninguém escolheu nada
const VISUAL_PADRAO = { cor: "cor_rosa", corpo: "classico", olhos: "", boca: "", chapeu: "", acessorio: "", rastro: "", ko: "", emote: "" };
// categorias que podem ficar vazias (o 1º cartão da aba é "nenhum")
const VISUAL_OPCIONAL = { olhos: 1, boca: 1, chapeu: 1, acessorio: 1, rastro: 1, ko: 1, emote: 1 };

// cor da bolinha com esse visual (corpo de cor própria manda; senão a cor escolhida)
function corDoVisual(v) {
  const c = SKIN[v && v.corpo];
  if (c && c.cor && c.cor !== "jogador") return c.cor;
  const k = SKIN[v && v.cor];
  return k && k.cor ? k.cor : "#ff5d73";
}

// Chave das camadas por cima do corpo, no lugar do "id do acessório" que o desenho da bolinha já passa para
// ArteSkins.acessorio: "v|lado|chapéu|acessório|olhos|boca|emote|rastro" ("nenhum" se não tiver nada).
// O lado (1 ou 2) deixa o desenho saber de quem é a comemoração (emote) e o rastro (b.rastroFx, partida.js).
function chaveCamadas(v, lado) {
  if (!v) return "nenhum";
  if (!v.chapeu && !v.acessorio && !v.olhos && !v.boca && !v.emote && !v.rastro) return "nenhum";
  return "v|" + (lado || 0) + "|" + (v.chapeu || "") + "|" + (v.acessorio || "") + "|" + (v.olhos || "") + "|" + (v.boca || "") + "|" +
    (v.emote || "") + "|" + (v.rastro || "");
}

// visual a partir do jeito antigo (corpo + 1 acessório): rivais e save da v18
function visualDeAntigo(corpo, acessorio, cor) {
  const v = Object.assign({}, VISUAL_PADRAO);
  v.corpo = SKIN[corpo] && SKIN[corpo].tipo === "corpo" ? corpo : "classico";
  const a = SKIN[acessorio];
  if (a && a.id !== "nenhum" && VISUAL_OPCIONAL[a.tipo]) v[a.tipo] = a.id;
  if (cor) { const k = SKINS_POR_TIPO.cor.find(function(s) { return s.cor === cor; }); if (k) v.cor = k.id; }
  return v;
}
