"use strict";

// =========================
// GAME EVENTS DO POKI (o que medimos para saber onde as pessoas saem)
// playtime/<marca> reached (só conta tempo jogando, com a aba visível), session/first-visit|returning|mobile|desktop,
// milestone/<passo> (tutorial e afins). Os do jogo ficam onde acontecem (robot/tier-N, battle, rebirth, compendium...).
// =========================
const Eventos = (function() {
  const MARCAS = [30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600];
  let seg = 0, prox = 0, toques = 0;
  function nome(s) { return s < 60 ? s + "s" : (s / 60) + "m"; }
  function passo(dt) {
    if (document.hidden) return;
    seg += dt;
    while (prox < MARCAS.length && seg >= MARCAS[prox]) { Poki.medir("playtime", nome(MARCAS[prox]), "reached"); prox++; }
  }
  function inicio(primeira) {
    const mobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    Poki.medir("session", primeira ? "first-visit" : "returning", "start");
    Poki.medir("session", mobile ? (window.innerHeight > window.innerWidth ? "portrait" : "landscape") : "desktop", "start");
    Poki.medir("session", "lang-" + IDIOMA, "start");
  }
  function toque() { toques++; if (toques === 1 || toques === 10 || toques === 100 || toques === 1000) Poki.medir("button", "taps-" + toques, "reached"); }
  function marco(n) { Poki.medir("milestone", n, "reached"); }
  return { passo: passo, inicio: inicio, toque: toque, marco: marco };
})();
