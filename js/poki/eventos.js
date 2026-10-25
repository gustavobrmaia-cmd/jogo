"use strict";

// =========================
// GAME EVENTS (o que o jogador faz, para o painel do Poki)
// Use estes atalhos no jogo em vez de chamar Poki.medir direto, para os nomes saírem sempre iguais:
//
//   Eventos.nivel("1", "start")         Eventos.nivel("1", "complete")      Eventos.nivel("1", "fail")
//     -> tabela "Progress Events": quantos começam, terminam, perdem e saem (Left) em cada nível
//   Eventos.oferta("reviver", "visible") / Eventos.oferta("reviver", "interact")
//     -> quantos veem e quantos aceitam cada anúncio premiado
//   Eventos.botao("loja")               -> cliques em botões importantes
//   Eventos.marco("primeiro-chefe")     -> momentos importantes da partida
//
// Automáticos (não precisa fazer nada):
//   - tempo de jogo: "playtime / 30s, 1m, 2m, 3m, 5m, 10m, 15m, 20m, 30m" (só conta gameplay de
//     verdade). Mostra direto quantos passam de 3 minutos, a régua do Player Fit Test;
//   - idioma e aparelho de cada partida (desktop/mobile, em pé/deitado);
//   - primeira interação (quantos chegam a tocar no jogo);
//   - erros de JavaScript (no máximo 5 por visita), para achar bugs que só acontecem com jogadores.
// =========================

const Eventos = (function() {
  const MARCAS = [30, 60, 120, 180, 300, 600, 900, 1200, 1800];   // segundos de gameplay
  let segundos = 0;
  let proximaMarca = 0;
  let erros = 0;

  function nomeTempo(s) { return s < 60 ? s + "s" : (s / 60) + "m"; }

  // Chamado pelo loop a cada passo de gameplay (não conta menu, pausa nem anúncio)
  function passoDeJogo(dt) {
    segundos += dt / 1000;
    while (proximaMarca < MARCAS.length && segundos >= MARCAS[proximaMarca]) {
      Poki.medir("playtime", nomeTempo(MARCAS[proximaMarca]), "reached");
      // v15: 3 e 5 min por idioma (qual público joga mais? os testes da noite, com mais espanhol, iam melhor)
      if (MARCAS[proximaMarca] === 180 || MARCAS[proximaMarca] === 300) Poki.medir("engaged", nomeTempo(MARCAS[proximaMarca]) + "-" + IDIOMA, "reached");
      proximaMarca++;
    }
  }

  // primeira: a visita começou sem nenhuma partida no save (até a v12 era lido depois, e quase tudo virava "returning")
  function inicioDaVisita(primeira) {
    const mobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    Poki.medir("session", "lang-" + IDIOMA, "start");
    Poki.medir("session", mobile ? "mobile" : "desktop", "start");
    if (mobile) Poki.medir("session", window.innerHeight > window.innerWidth ? "portrait" : "landscape", "start");
    Poki.medir("session", primeira ? "first-visit" : "returning", "start");
  }

  let primeira = false;
  ["keydown", "pointerdown"].forEach(function(ev) {
    window.addEventListener(ev, function() {
      if (primeira) return;
      primeira = true;
      Poki.medir("session", "first-input", "reached");
    }, { capture: true, passive: true });
  });

  window.addEventListener("error", function(e) {
    if (erros >= 5) return;
    erros++;
    const onde = (e.filename || "").split("/").pop() + ":" + (e.lineno || 0);
    Poki.medir("error", onde, String(e.message || "erro").slice(0, 40));
  });

  return {
    nivel: function(id, acao) { Poki.medir("level", id, acao); },
    oferta: function(nome, acao) { Poki.medir("reward", nome, acao); },
    botao: function(nome) { Poki.medir("button", nome, "interact"); },
    marco: function(nome) { Poki.medir("milestone", nome, "reached"); },
    passoDeJogo: passoDeJogo,
    inicioDaVisita: inicioDaVisita,
    get segundosJogados() { return segundos; }
  };
})();
