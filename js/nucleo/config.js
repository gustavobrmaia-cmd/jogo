"use strict";

// =========================
// CONFIGURAÇÃO GERAL
// =========================
const CONFIG = {
  usarPoki: true,          // SDK do Poki (anúncios, gameplayStart/Stop, Game Events). Sem o SDK tudo funciona igual
  debugEventos: false,     // mostra os Game Events no console
  chaveSave: "robos-botao-v1",
  slotsGrade: 30,          // vagas na grade (a árvore pode dar mais 6)
  slotsTime: 5,            // robôs que apertam o botão junto com você (a árvore pode dar o 6º)
  slotsBatalha: 10,        // robôs numa batalha (a árvore pode dar 12)
  tierRenascer: 8,         // robô de nível 8 libera o renascimento
  offlineMax: 2 * 3600,    // ganhos offline: até 2 h (a árvore pode dar 6 h)
  offlineFator: 0.5        // longe do jogo, os robôs trabalham pela metade
};
