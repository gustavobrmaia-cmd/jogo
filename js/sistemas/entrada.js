"use strict";

// =========================
// ENTRADA: teclado, mouse, toque e controle (gamepad) viram as mesmas AÇÕES, para 2 jogadores.
// O jogo pergunta: entrada.segurando(1, "esquerda"), entrada.apertou(2, "tiro") (vale 1 vez por toque)
// e entrada.mira(1) -> para onde o jogador está mirando (ou null = mira assistida automática).
// Ações: esquerda, direita, pulo, baixo, tiro. Teclas pela posição física (e.code): WASD funciona igual
// no teclado francês (ZQSD). As teclas podem ser trocadas no menu (save.teclas); estas são as de fábrica:
//   Jogador 1: A D andar, ESPAÇO (ou W) pular, S descer; MOUSE: mira onde aponta, CLIQUE ESQUERDO atira (F também)
//   Jogador 2: setas andar/pular/descer, L / Enter / 0 do teclado numérico atirar (mira assistida)
//   Contra o bot (entrada.solo = true) o jogador 1 usa qualquer um dos dois jeitos.
// Toque (cada jogador tem a sua metade da tela; contra o bot a tela toda é do jogador 1):
//   lado de fora = analógico de andar (puxar para cima pula, para baixo desce);
//   lado de dentro, metade de BAIXO = analógico de MIRA: arrastar mira e atira; só tocar e segurar atira com mira assistida;
//   lado de dentro, metade de CIMA = botão de PULO (tocar pula; segurar pula mais alto).
// Gamepad: 1º controle = jogador 1, 2º = jogador 2. Analógico direito mira e atira; gatilhos atiram.
// =========================

const ACOES = ["esquerda", "direita", "pulo", "baixo", "tiro", "dash"];
// v21.2: dash = Shift/E (jogador 1; também o botão direito do mouse) e Shift direito/K (jogador 2)
const TECLAS_PADRAO = {
  1: { esquerda: ["KeyA"], direita: ["KeyD"], pulo: ["Space", "KeyW"], baixo: ["KeyS"], tiro: ["KeyF", "KeyG"], dash: ["ShiftLeft", "KeyE"] },
  2: { esquerda: ["ArrowLeft"], direita: ["ArrowRight"], pulo: ["ArrowUp"], baixo: ["ArrowDown"], tiro: ["KeyL", "Enter", "Numpad0"], dash: ["ShiftRight", "KeyK"] }
};

// Nome curto de uma tecla para mostrar na tela (ex.: "KeyA" -> "A", "ArrowLeft" -> "←")
function nomeTecla(code) {
  if (!code) return "—";
  const fixos = { Space: t("tecla_espaco"), Enter: "Enter", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
    ShiftLeft: "Shift", ShiftRight: "Shift ►", ControlLeft: "Ctrl", ControlRight: "Ctrl ►", AltLeft: "Alt", Tab: "Tab",
    Backspace: "⌫", NumpadEnter: "Num Enter" };
  if (fixos[code]) return fixos[code];
  if (code.indexOf("Key") === 0) return code.slice(3);
  if (code.indexOf("Digit") === 0) return code.slice(5);
  if (code.indexOf("Numpad") === 0) return "Num " + code.slice(6);
  return code;
}

const entrada = (function() {
  const seg = { 1: {}, 2: {} };            // segurando pelo teclado (por conjunto de teclas)
  const apertos = { 1: new Set(), 2: new Set() };
  let mapa = {};                            // código da tecla -> [conjunto, ação]
  let pausaApertada = false;
  let usouToque = false;
  let ultimoToque = 0;
  let esperandoTecla = null;                // troca de tecla: function(code) que recebe a próxima tecla

  function teclas() {
    if (!(typeof save !== "undefined" && save.teclas && save.teclas[1])) return TECLAS_PADRAO;
    // v21.2: save com teclas trocadas de antes do dash: a ação nova vem com as teclas de fábrica (se estiverem livres)
    [1, 2].forEach(function(j) {
      ACOES.forEach(function(a) {
        if (save.teclas[j][a]) return;
        const usadas = [];
        [1, 2].forEach(function(jj) { Object.keys(save.teclas[jj]).forEach(function(aa) { (save.teclas[jj][aa] || []).forEach(function(c) { if (c) usadas.push(c); }); }); });
        save.teclas[j][a] = TECLAS_PADRAO[j][a].filter(function(c) { return usadas.indexOf(c) < 0; });
      });
    });
    return save.teclas;
  }
  function refazerMapa() {
    mapa = {};
    const tk = teclas();
    [1, 2].forEach(function(j) {
      ACOES.forEach(function(a) { (tk[j][a] || []).forEach(function(c) { if (c) mapa[c] = [j, a]; }); });
    });
  }
  refazerMapa();

  // contra o bot, as teclas do jogador 2 também mandam no jogador 1
  function quem(j) { return api.solo ? 1 : j; }

  // ---- teclado ----
  window.addEventListener("keydown", function(e) {
    if (esperandoTecla) {
      e.preventDefault();
      const fn = esperandoTecla; esperandoTecla = null;
      fn(e.code === "Escape" ? null : e.code);
      return;
    }
    if (!api.ativa) return;                 // nos menus as teclas ficam livres
    if (e.code === "Escape" || e.code === "KeyP") { if (!e.repeat) pausaApertada = true; return; }
    const m = mapa[e.code];
    if (!m) return;
    e.preventDefault();
    if (!seg[m[0]][m[1]] && !e.repeat) apertos[quem(m[0])].add(m[1]);
    seg[m[0]][m[1]] = true;
  });
  window.addEventListener("keyup", function(e) {
    const m = mapa[e.code];
    if (m) seg[m[0]][m[1]] = false;
  });
  window.addEventListener("blur", soltarTudo);

  // ---- mouse (jogador 1): mira livre e clique atira ----
  // depois que o mouse mexe uma vez, o jogador 1 mira SEMPRE com ele (até usar o toque)
  const mouse = { x: 0, y: 0, ultimoUso: 0, segurando: false, usado: false };
  function canvasEl() { return document.getElementById("canvas"); }
  function posCanvas(cx, cy) {
    const r = canvasEl().getBoundingClientRect();
    return { x: (cx - r.left) / r.width * CONFIG.largura, y: (cy - r.top) / r.height * alturaTela };   // v20.7: lógico (o canvas pode ter menos pixels)
  }
  window.addEventListener("mousemove", function(e) {
    if (performance.now() - ultimoToque < 1000) return;
    const p = posCanvas(e.clientX, e.clientY);
    if (Math.abs(p.x - mouse.x) + Math.abs(p.y - mouse.y) > 2) { mouse.ultimoUso = performance.now(); mouse.usado = true; }
    mouse.x = p.x; mouse.y = p.y;
  });
  window.addEventListener("mousedown", function(e) {
    if (!api.ativa || e.target !== canvasEl()) return;
    if (performance.now() - ultimoToque < 1000) return;   // clique "fantasma" que o celular gera depois do toque
    if (e.button === 2) { apertos[1].add("dash"); return; }   // v21.2: botão direito = dash
    if (e.button !== 0) return;
    const p = posCanvas(e.clientX, e.clientY);
    mouse.x = p.x; mouse.y = p.y; mouse.ultimoUso = performance.now(); mouse.usado = true;
    mouse.segurando = true;
    apertos[1].add("tiro");
    apertos[1].add("toque");
  });
  window.addEventListener("mouseup", function() { mouse.segurando = false; });
  window.addEventListener("contextmenu", function(e) { if (api.ativa) e.preventDefault(); });
  function mouseAtivo() { return mouse.usado || mouse.segurando; }

  // ---- toque ----
  // dedos: id -> { jogador, tipo: "stick" | "mira" | "pulo" | "alvo" (v21: tocou na arena, em pé), x0, y0, dx, dy, pulou, escala, fx, fy }
  const dedos = new Map();

  // contra o bot: esquerda = andar, direita = mira/tiro.  2 jogadores: [andar J1 | mira J1 | mira J2 | andar J2]
  function zona(x) {
    if (api.solo) return x < 0.5 ? [1, "stick"] : [1, "mira"];
    if (x < 0.27) return [1, "stick"];
    if (x < 0.5) return [1, "mira"];
    if (x < 0.73) return [2, "mira"];
    return [2, "stick"];
  }

  function tocou(e) {
    usouToque = true;
    ultimoToque = performance.now();
    if (!api.ativa || e.target !== canvasEl()) return;   // toque em botão (pausa) não vira comando
    const r = canvasEl().getBoundingClientRect();
    for (const t2 of e.changedTouches) {
      const fx = (t2.clientX - r.left) / r.width;
      const fy = (t2.clientY - r.top) / r.height;
      const z = zona(fx);
      // lado de dentro: em cima = botão de pulo, embaixo = analógico de mira (em pé: a linha fica logo acima do analógico)
      let tipo = z[1] === "mira" && fy < (typeof limitePuloToque === "function" ? limitePuloToque() : 0.45) ? "pulo" : z[1];
      // v21: em pé com a câmera, tocar na arena (acima dos controles) atira naquele ponto (desenho.js toqueNaArena)
      if (api.solo && typeof toqueNaArena === "function" && toqueNaArena(fy)) tipo = "alvo";
      // v21.2: botão de dash (acima do analógico de andar; desenho.js toqueNoDash)
      if (api.solo && typeof toqueNoDash === "function" && toqueNoDash(fx, fy)) tipo = "dash";
      const d = { jogador: z[0], tipo: tipo, x0: t2.clientX, y0: t2.clientY, dx: 0, dy: 0, pulou: false,
                  escala: r.width / CONFIG.largura, fx: fx, fy: fy };
      dedos.set(t2.identifier, d);
      if (tipo === "mira" || tipo === "alvo") apertos[d.jogador].add("tiro");
      if (tipo === "pulo") apertos[d.jogador].add("pulo");
      if (tipo === "dash") apertos[d.jogador].add("dash");
      apertos[d.jogador].add("toque");
    }
  }
  function moveu(e) {
    for (const t2 of e.changedTouches) {
      const d = dedos.get(t2.identifier);
      if (!d || d.tipo === "pulo" || d.tipo === "dash") continue;
      if (d.tipo === "alvo") {   // o ponto do tiro acompanha o dedo
        const r = canvasEl().getBoundingClientRect();
        d.fx = (t2.clientX - r.left) / r.width; d.fy = (t2.clientY - r.top) / r.height;
        continue;
      }
      d.dx = (t2.clientX - d.x0) / d.escala;
      d.dy = (t2.clientY - d.y0) / d.escala;
      const lim = 90;
      if (d.tipo === "stick") {
        // puxou para cima: pula (de novo só depois de voltar um pouco)
        if (d.dy < -55 && !d.pulou) { d.pulou = true; apertos[d.jogador].add("pulo"); }
        if (d.dy > -25) d.pulou = false;
      }
      // o centro do analógico acompanha o dedo se ele for longe demais
      const dist = Math.sqrt(d.dx * d.dx + d.dy * d.dy);
      if (dist > lim) {
        const k = (dist - lim) / dist;
        d.x0 += d.dx * k * d.escala; d.y0 += d.dy * k * d.escala;
        d.dx *= lim / dist; d.dy *= lim / dist;
      }
    }
  }
  function soltou(e) {
    for (const t2 of e.changedTouches) dedos.delete(t2.identifier);
  }
  window.addEventListener("touchstart", tocou, { passive: true });
  window.addEventListener("touchmove", moveu, { passive: true });
  window.addEventListener("touchend", soltou, { passive: true });
  window.addEventListener("touchcancel", soltou, { passive: true });

  // ---- controle (gamepad) ----
  const padAntes = { 1: {}, 2: {} };
  const pad = { 1: {}, 2: {} };
  const padMira = { 1: null, 2: null };
  let startAntes = false;
  function lerPads() {
    const lista = navigator.getGamepads ? navigator.getGamepads() : [];
    pad[1] = {}; pad[2] = {}; padMira[1] = padMira[2] = null;
    let n = 0, start = false;
    for (let i = 0; i < lista.length && n < 2; i++) {
      const g = lista[i];
      if (!g || !g.connected) continue;
      n++;
      const b = function(k) { return !!(g.buttons[k] && g.buttons[k].pressed); };
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0, rx = g.axes[2] || 0, ry = g.axes[3] || 0;
      const quemJ = quem(n);
      const alvo = pad[quemJ];
      const miraForte = Math.sqrt(rx * rx + ry * ry) > 0.5;
      if (miraForte) padMira[quemJ] = Math.atan2(ry, rx);
      const v = {
        esquerda: ax < -0.35 || b(14), direita: ax > 0.35 || b(15),
        pulo: b(0) || b(12) || b(4), baixo: ay > 0.6 || b(13),
        tiro: b(2) || b(1) || b(5) || b(7) || b(6) || miraForte,
        dash: b(3)   // v21.2: Y / triângulo
      };
      Object.keys(v).forEach(function(a) { alvo[a] = alvo[a] || v[a]; });
      start = start || b(9);
    }
    if (start && !startAntes && api.ativa) pausaApertada = true;
    startAntes = start;
  }

  function atualizar() {
    lerPads();
    [1, 2].forEach(function(j) {
      ACOES.forEach(function(a) { if (pad[j][a] && !padAntes[j][a] && api.ativa) apertos[j].add(a); });
      padAntes[j] = Object.assign({}, pad[j]);
    });
  }

  function soltarTudo() {
    [1, 2].forEach(function(j) {
      Object.keys(seg[j]).forEach(function(a) { seg[j][a] = false; });
      apertos[j].clear();
    });
    dedos.clear();
    mouse.segurando = false;
    pausaApertada = false;
  }

  function segurando(j, a) {
    if (seg[j][a] || pad[j][a]) return true;
    if (api.solo && j === 1 && seg[2][a]) return true;
    if (a === "tiro" && j === 1 && mouse.segurando) return true;
    for (const d of dedos.values()) {
      if (d.jogador !== j) continue;
      if (d.tipo === "mira" || d.tipo === "alvo") { if (a === "tiro") return true; continue; }
      if (d.tipo === "pulo") { if (a === "pulo") return true; continue; }
      if (a === "esquerda" && d.dx < -16) return true;
      if (a === "direita" && d.dx > 16) return true;
      if (a === "baixo" && d.dy > 55) return true;
      if (a === "pulo" && d.dy < -55) return true;
    }
    return false;
  }

  // Para onde o jogador j está mirando. null = mira assistida (o jogo escolhe).
  // { ang } = ângulo pronto (toque/controle)   { x, y } = ponto na tela (mouse, em coordenadas do canvas)
  function mira(j) {
    // v21: dedo na arena (em pé): mira no ponto tocado (coordenadas lógicas da tela, como o mouse)
    for (const d of dedos.values()) if (d.jogador === j && d.tipo === "alvo") return { x: d.fx * CONFIG.largura, y: d.fy * alturaTela };
    for (const d of dedos.values()) {
      if (d.jogador === j && d.tipo === "mira" && d.dx * d.dx + d.dy * d.dy > 22 * 22) return { ang: Math.atan2(d.dy, d.dx) };
    }
    if (padMira[j] !== null) return { ang: padMira[j] };
    if (j === 1 && mouseAtivo() && !usouToqueRecente()) return { x: mouse.x, y: mouse.y };
    return null;
  }
  function usouToqueRecente() { return performance.now() - ultimoToque < 3000; }

  // Analógicos de toque abertos agora (para desenhar)
  function analogicos() {
    const lista = [];
    for (const d of dedos.values()) lista.push(d);
    return lista;
  }

  const api = {
    solo: true,        // contra o bot
    ativa: false,      // true durante a partida (fora dela as teclas não são capturadas)
    atualizar: atualizar,
    soltarTudo: soltarTudo,
    segurando: segurando,
    mira: mira,
    // apertou(j, "tiro") também aceita "toque" (qualquer toque/clique daquele jogador: queda de braço)
    apertou: function(j, a) {
      if (apertos[j].has(a)) { apertos[j].delete(a); return true; }
      return false;
    },
    pausa: function() { const p = pausaApertada; pausaApertada = false; return p; },
    limparApertos: function() { apertos[1].clear(); apertos[2].clear(); pausaApertada = false; },
    analogicos: analogicos,
    refazerMapa: refazerMapa,
    teclas: teclas,
    // troca de tecla: a próxima tecla apertada vai para fn(code) (Esc cancela -> fn(null))
    esperarTecla: function(fn) { esperandoTecla = fn; },
    get esperando() { return !!esperandoTecla; },
    get mouseAtivo() { return mouseAtivo() && !usouToqueRecente(); },
    get mouseX() { return mouse.x; },
    get mouseY() { return mouse.y; },
    get toque() { return usouToque || ("ontouchstart" in window && navigator.maxTouchPoints > 0); }
  };
  return api;
})();
