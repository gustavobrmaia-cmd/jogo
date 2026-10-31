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
    // texturas da interface (chapas, faixa de perigo, encaixes) em variáveis do CSS
    [["placa", "placa"], ["escura", "placaEscura"], ["clara", "placaClara"], ["aco", "placaAco"], ["perigo", "perigo"], ["vaga", "vaga"]].forEach(function(p) {
      document.documentElement.style.setProperty("--tex-" + p[0], "url(" + Pixel.url(Pixel.textura(p[1])) + ")");
    });
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
    CenaBatalha.passo(dt);
    Fundo.passo(dt);
    Eventos.passo(dt);
    Tela.atualizarTopo();
    Tela.desenharBotao();
    Tela.dica();
    Fx.passo(dt);
    Curto.passo(dt);
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
