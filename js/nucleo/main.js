"use strict";

// =========================
// COMEÇO E LAÇO PRINCIPAL
// Carrega o save e o idioma, monta a tela, avisa o Poki que carregou e roda o jogo (60 qps, o motor a cada quadro).
// Salva a cada 10 s e ao esconder a aba. Ganhos offline aparecem ao voltar.
// =========================
(function() {
  carregarSave();
  const primeira = !save.stats.toques;
  IDIOMA = detectarIdioma(save.idioma);
  Promise.all([carregarIdioma(IDIOMA), Poki.iniciar(), document.fonts && document.fonts.load ? document.fonts.load("20px Pixelify").catch(function() {}) : Promise.resolve()]).then(function() {
    traduzirDom();
    Paineis.preencherIcones();
    Tela.montarVagas();
    Tela.layout();
    Poki.carregou();
    Poki.jogando(true);
    Eventos.inicio(primeira);
    const off = Jogo.ganhoOffline();
    if (off) Paineis.mostrarOffline(off);
    requestAnimationFrame(laco);
  });

  let antes = 0, salvarEm = 10, pontosEm = 0;
  function laco(agora) {
    requestAnimationFrame(laco);
    const dt = Math.min(0.1, antes ? (agora - antes) / 1000 : 0.016);
    antes = agora;
    if (Poki.anuncioAberto) return;
    Jogo.passo(dt);
    Batalha.passo(dt);
    BatalhaTela.passo();
    Eventos.passo(dt);
    Tela.atualizarTopo();
    Tela.desenharBotao();
    Tela.dica();
    Fx.passo(dt);
    Paineis.passoFaixa();
    pontosEm -= dt;
    if (pontosEm <= 0) { pontosEm = 0.25; Paineis.pontos(); Paineis.atualizarUpgrades(); }
    salvarEm -= dt;
    if (salvarEm <= 0) { salvarEm = 10; salvar(); }
  }
  // aba escondida: salva (ganhos offline contam a partir daqui) e para a gameplay do Poki
  document.addEventListener("visibilitychange", function() {
    if (document.hidden) { salvar(); Poki.jogando(false); }
    else {
      Poki.jogando(true);
      const off = Jogo.ganhoOffline();
      if (off && !Paineis.janelaAberta()) Paineis.mostrarOffline(off);
      antes = 0;
    }
  });
  window.addEventListener("pagehide", salvar);
})();
