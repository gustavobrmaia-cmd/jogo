"use strict";

// =========================
// CONFIGURAÇÃO GERAL (o resto do jogo lê daqui)
// =========================
const CONFIG = {
  nome: "Crazy Balls Duel",
  largura: 1280,            // resolução lógica deitado (o canvas escala para caber na tela)
  altura: 720,
  permitirRetrato: true,    // celular em pé: a tela fica mais alta e o jogo usa a largura toda
  passo: 1000 / 60,         // física em passos fixos de 1/60 s (igual em qualquer monitor)
  usarPoki: true,           // false para itch.io / teste local sem o SDK
  chaveSave: "duelo-bolinhas-v1",   // (mantido para não apagar o progresso de quem já jogou)
  debugEventos: false,      // true: mostra no console cada Game Event enviado ao Poki
  pontosParaVencer: 3,      // a partida acaba quando alguém faz 3 pontos (v14; era 5 e "demorava muito" — o dono)
  multDano: 0.85,           // multiplicador geral de dano (rodada de ~20 s bot x bot; bot consertado na v7)
  pontosPrimeira: 3,        // a 1ª partida da vida é mais curta (até 3): a pessoa chega rápido ao fim e à recompensa
  multTreino: 1.8,          // 1ª partida da vida: o tiro do jogador tira mais vida (rodada de ~15 s em vez de ~30 s)
  multSegunda: 1.25,        // 2ª partida no "Contra o bot": um pouco mais (rodada curta enquanto a pessoa aprende)
  // tiro do jogador nos rivais 1–4 da liga Bronze (v17: no v16 o jogador perdia 31–32% das rodadas no rival 2 e só 41%
  // o venciam — era ali que a turma de 1m30–3m saía; o 4 fica no meio para a subida não virar um muro)
  multRivais: [1.25, 1.5, 1.5, 1.25],
  // munição contra a máquina (v18): x do jogador e do bot (o estilingue aparece bem menos)
  municaoJogador: 3,
  municaoBot: 1.5,
  leve: false,              // modo leve (celular/computador fraco): menos partículas e fundo dos menus a 30 qps
  // v19: id do jogo na Poki Networking Library (online) = o id do jogo no Poki (aparece na URL do inspector:
  // ?game=poki-<id>). v19.5: antes era um id inventado e o servidor recusava (a partida rápida voltava na hora).
  idRede: "df3225ad-e8de-440a-8421-14738ee004f5"
};
