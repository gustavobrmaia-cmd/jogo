"use strict";

// =========================
// SDK DO POKI
// Tudo que aprendemos no jogo anterior, num lugar só:
// - init() -> gameLoadingFinished() assim que o jogo está pronto para jogar;
// - gameplayStart() só depois da PRIMEIRA interação do jogador (nunca no carregamento) e
//   gameplayStop() em pausa, menu, fim de jogo, anúncio e aba escondida;
// - commercialBreak() antes de toda volta ao jogo; o Poki decide se mostra (sem timer próprio);
// - rewardedBreak() só quando a pessoa escolhe, com o tamanho do prêmio;
// - durante o anúncio o jogo fica parado e mudo;
// - rede de segurança: se o anúncio não começar em poucos segundos (ou o SDK nunca responder,
//   ou tiver bloqueador), o jogo segue sozinho. Nada fica travado esperando o Poki;
// - Game Events (measure) com fila: eventos de antes do SDK ficar pronto não se perdem.
// Sem o SDK (teste local, itch.io) tudo funciona igual, só sem anúncios.
// =========================

const Poki = (function() {
  const ESPERA_INTERVALO = 4000;    // o anúncio comum tem que começar em até 4 s
  const ESPERA_PREMIADO = 8000;     // o premiado, em até 8 s
  const LIMITE_ANUNCIO = 60000;     // e nenhum anúncio segura o jogo mais que isso

  let sdk = null;               // PokiSDK depois do init (null = sem SDK)
  let premiadoOk = false;       // false com bloqueador de anúncio
  let pronto = false;
  let querJogar = false;        // o jogo diz "estou na gameplay"
  let avisouJogando = false;    // o último aviso mandado ao Poki
  let interagiu = false;        // primeira tecla, clique ou toque
  let anuncio = false;          // anúncio na tela
  const fila = [];              // Game Events de antes do SDK ficar pronto
  const ouvintes = [];          // quem quer saber quando um anúncio abre/fecha (som, jogo)

  function temSdk() { return !!sdk; }

  function iniciar() {
    if (!CONFIG.usarPoki || !window.PokiSDK) { pronto = true; return Promise.resolve(); }
    return window.PokiSDK.init()
      .then(function() { premiadoOk = true; }, function() { premiadoOk = false; })   // bloqueador: segue sem anúncio
      .then(function() {
        sdk = window.PokiSDK;
        pronto = true;
        fila.splice(0).forEach(function(ev) { medir(ev[0], ev[1], ev[2]); });
        atualizar();
      });
  }

  // O jogo terminou de carregar e já dá para jogar
  function carregou() {
    if (sdk) { try { sdk.gameLoadingFinished(); } catch (e) { /* nada */ } }
  }

  // ---- gameplayStart / gameplayStop ----
  function jogando(sim) {
    querJogar = !!sim;
    atualizar();
  }

  function atualizar() {
    const deve = querJogar && interagiu && !anuncio && !document.hidden;
    if (!sdk || deve === avisouJogando) return;
    avisouJogando = deve;
    try { if (deve) sdk.gameplayStart(); else sdk.gameplayStop(); } catch (e) { /* nada */ }
  }

  ["keydown", "pointerdown", "touchstart", "mousedown"].forEach(function(ev) {
    window.addEventListener(ev, function() { if (!interagiu) { interagiu = true; atualizar(); } }, { capture: true, passive: true });
  });
  document.addEventListener("visibilitychange", atualizar);

  // ---- anúncios ----
  function aoAnuncio(fn) { ouvintes.push(fn); }

  function abrir() {
    anuncio = true;
    atualizar();
    ouvintes.forEach(function(fn) { fn(true); });
  }

  function fechar() {
    anuncio = false;
    ouvintes.forEach(function(fn) { fn(false); });
    atualizar();
  }

  // Intervalo comercial: chame antes de toda volta ao jogo (começar, próxima fase, recomeçar).
  // Devolve uma Promise que sempre resolve (com ou sem anúncio).
  function intervalo() {
    if (!sdk) return Promise.resolve();
    return new Promise(function(ok) {
      let acabou = false;
      let comecou = false;
      abrir();
      function seguir() {
        if (acabou) return;
        acabou = true;
        clearTimeout(espera);
        clearTimeout(limite);
        fechar();
        ok();
      }
      const espera = setTimeout(function() { if (!comecou) seguir(); }, ESPERA_INTERVALO);
      const limite = setTimeout(seguir, LIMITE_ANUNCIO);
      let pedido;
      try {
        pedido = sdk.commercialBreak(function() {
          comecou = true;
          if (acabou && !anuncio) abrir();   // começou atrasado: para e cala o jogo até acabar
        });
      } catch (e) { seguir(); return; }
      Promise.resolve(pedido).catch(function() {}).then(function() {
        if (acabou) { if (anuncio) fechar(); return; }
        seguir();
      });
    });
  }

  function premiadoDisponivel() { return !!sdk && premiadoOk && !anuncio; }

  // Anúncio premiado: resolve true só se a pessoa assistiu até o fim.
  // tamanho: "small" | "medium" | "large" (o valor do prêmio)
  function premiado(tamanho) {
    if (!premiadoDisponivel()) return Promise.resolve(false);
    return new Promise(function(ok) {
      let acabou = false;
      let comecou = false;
      abrir();
      function terminar(assistiu) {
        if (acabou) return;
        acabou = true;
        clearTimeout(espera);
        clearTimeout(limite);
        fechar();
        ok(!!assistiu);
      }
      const espera = setTimeout(function() { if (!comecou) terminar(false); }, ESPERA_PREMIADO);
      const limite = setTimeout(function() { terminar(false); }, LIMITE_ANUNCIO + 30000);
      let pedido;
      try {
        pedido = sdk.rewardedBreak({ size: tamanho || "medium", onStart: function() {
          comecou = true;
          if (acabou && !anuncio) abrir();
        } });
      } catch (e) { terminar(false); return; }
      Promise.resolve(pedido).then(function(v) { return !!v; }, function() { return false; }).then(function(v) {
        if (acabou) { if (anuncio) fechar(); return; }
        terminar(v);
      });
    });
  }

  // ---- Game Events ----
  // Os nomes não podem ter "/" nem "^" (o Poki usa nos caminhos e nos funis)
  function limpar(s) { return String(s).replace(/[\/^]/g, "-").slice(0, 60); }

  function medir(categoria, oque, acao) {
    if (!CONFIG.usarPoki) return;
    const ev = [limpar(categoria), limpar(oque), limpar(acao)];
    if (CONFIG.debugEventos) console.log("[evento]", ev.join(" / "));
    if (!pronto) { if (fila.length < 100) fila.push(ev); return; }
    if (!sdk || typeof sdk.measure !== "function") return;
    try { sdk.measure(ev[0], ev[1], ev[2]); } catch (e) { /* estatística nunca trava o jogo */ }
  }

  return {
    iniciar: iniciar, carregou: carregou, jogando: jogando, temSdk: temSdk,
    intervalo: intervalo, premiado: premiado, premiadoDisponivel: premiadoDisponivel,
    medir: medir, aoAnuncio: aoAnuncio,
    get anuncioAberto() { return anuncio; }
  };
})();
