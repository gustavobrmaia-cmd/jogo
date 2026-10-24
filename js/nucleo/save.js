"use strict";

// =========================
// SAVE (localStorage)
// Tudo protegido com try/catch: em aba anônima ou com o armazenamento bloqueado o jogo
// funciona igual, só não lembra nada na próxima visita.
// =========================

function saveNovo() {
  return {
    versao: 2,        // v19: 2 (o save da v18 vem com 1 e é convertido em Progresso.preparar)
    idioma: "",       // vazio: segue o navegador
    mudo: false,
    partidas: 0,      // quantas partidas já começou (0 = primeira visita)
    vitorias: 0,      // contra o bot
    derrotas: 0,
    nivelBot: 0.02,   // força do bot (0 a 1), ajustada depois de cada partida (e um pouco a cada rodada) contra ele
    teclas: null,     // teclas trocadas pelo jogador (null = as de fábrica)
    // progresso (js/jogo/progresso/progresso.js)
    moedas: 0,
    skinCorpo: "classico",
    skinAcessorio: "nenhum",
    donos: [],        // skins que a pessoa tem
    stats: {},        // contadores de tudo (vitórias, dano, quedas...)
    missoes: [],      // 3 missões ativas
    semana: null,     // desafios da semana
    conquistas: {},   // id -> "feita" | "resgatada"
    armasVistas: [], cartasVistas: [], cenariosVencidos: [],
    trocaDia: 0,      // dia em que trocou uma missão (1 troca grátis por dia)
    dobrar: 0,        // (antigo, não usado)
    xp: 0, nivel: 1,  // nível do jogador
    diario: null,     // recompensa diária: { ultimo: dia, seq: 1..7 }
    recordeOnda: 0,   // modo sobrevivência
    rival: 0,         // modo rivais: o próximo rival a enfrentar (0 a 9)
    liga: 0,          // modo rivais: 0 Bronze, 1 Prata, 2 Ouro, 3 Diamante, 4+ Mestre
    rivalAjuste: 0,   // modo rivais: o rival atual fica mais fraco a cada derrota (até -0,3); zera ao vencer
    poder: { forca: 0, vida: 0, veloc: 0, sorte: 0 },   // melhorias compradas (js/jogo/progresso/poder.js; sorte desde a v19)
    // v19: personalização completa (ids de js/jogo/dados/skins.js; "" = nada). skinCorpo/skinAcessorio continuam
    // sendo gravados (espelho do corpo e do chapéu/acessório) para um save novo abrir numa versão antiga
    visual: { cor: "cor_rosa", corpo: "classico", olhos: "", boca: "", chapeu: "", acessorio: "", rastro: "", ko: "", emote: "" },
    armas: [],        // v19: armas compradas na loja (ids de ARMAS)
    armaInicial: "",  // v19: arma com que a pessoa começa cada rodada ("" = a da carta / a sorteada)
    qualidade: "auto", // "auto" | "alta" | "leve"
    // v21.1: TESTE A/B (sorteado 1 vez por jogador, como o Smash Room do blog do Poki): "a" = bot atual (v19),
    // "b" = bot simples (sem cobertura, sem sair da linha da mira, sem previsão/fintas/tabela, como o da v18.3).
    // Eventos exp/bot-a|bot-b (visible) e exp/bot-x-1m|3m|5m (reached): quem passa de 3 min em cada grupo
    exp: ""
  };
}

let save = saveNovo();

function carregarSave() {
  try {
    const s = JSON.parse(localStorage.getItem(CONFIG.chaveSave) || "null");
    if (s && typeof s === "object") {
      const base = saveNovo();
      Object.keys(base).forEach(function(k) {
        if (typeof s[k] === typeof base[k]) base[k] = s[k];
      });
      save = base;
    }
  } catch (e) { /* sem armazenamento: segue com o save novo */ }
  if (save.exp !== "a" && save.exp !== "b") { save.exp = Math.random() < 0.5 ? "a" : "b"; salvar(); }
}

function salvar() {
  try { localStorage.setItem(CONFIG.chaveSave, JSON.stringify(save)); } catch (e) { /* cheio ou bloqueado */ }
}
