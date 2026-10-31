"use strict";

// =========================
// CURTO-CIRCUITO DO RENASCER: ao confirmar o renascimento o painel fecha, a máquina entra em pane (tremedeira,
// faíscas, fumaça, alarme), carrega, EXPLODE (bola de fogo + clarão branco) e no auge do clarão o renascimento
// acontece e a árvore de habilidades abre por baixo; o clarão some revelando a árvore.
// 3 variações, uma por vez em rodízio (save.renascimentos % 3):
//   0 "engrenagens" - as engrenagens do fundo disparam (giram a mil, o motor solta fumaça preta) e a dourada estoura;
//   1 "botão"  - o botão vermelho superaquece (brilha, solta faísca e vapor) e estoura;
//   2 "pane"   - pane elétrica geral: as luzes piscam e apagam, raios correm pelo cano, as engrenagens travam e
//                depois disparam, e o estouro é no meio da tela.
// Desenhado num canvas em baixa resolução (1/3) por cima de tudo, que também segura os cliques enquanto dura.
// =========================
const Curto = (function() {
  const ESC = 3;
  const T_PANE = 2.0, T_CARGA = 2.45, T_BOOM = 2.75, T_FIM = 3.6;
  const FAISCA = ["#fff6c2", "#ffe066", "#ffb02e", "#ff7a2e"], FUMACA = ["#2c2640", "#3a3352", "#241f36"];
  const METAL = ["#5d6c8f", "#3d4a66", "#9aa3c0", "#2b2550"];
  const cv = el("curto"), g = cv.getContext("2d");
  let W = 0, H = 0, ativo = false, tempo = 0, variante = 0, ox = 0, oy = 0, raioBotao = 8;
  let explodiu = false, abriu = false, aoExplodir = null, proxAlarme = 0, cano = 0, seguranca = 0, escuro = 0;
  const faiscas = [], fumacas = [], arcos = [], destrocos = [];
  const tremer = [el("app"), el("fundo")];

  function iniciar(quandoExplodir) {
    if (ativo) return;
    ativo = true; tempo = 0; explodiu = false; abriu = false; proxAlarme = 0.15; escuro = 0;
    aoExplodir = quandoExplodir;
    variante = (save.renascimentos || 0) % 3;
    Paineis.fechar();
    W = Math.ceil(window.innerWidth / ESC); H = Math.ceil(window.innerHeight / ESC);
    cv.width = W; cv.height = H;
    cv.classList.add("on");
    const pts = Fundo.pontos();
    cano = Math.round(pts.cano / ESC);
    if (variante === 0) { ox = pts.engrenagem.x / ESC; oy = pts.engrenagem.y / ESC; raioBotao = pts.engrenagem.r / ESC; }
    else if (variante === 1) {
      const r = el("cvBotao").getBoundingClientRect();
      ox = (r.left + r.width / 2) / ESC; oy = (r.top + r.height / 2) / ESC; raioBotao = Math.max(6, r.width * 0.32 / ESC);
    } else { ox = W / 2; oy = H * 0.45; }
    ox = limitar(ox, 10, W - 10); oy = limitar(oy, 10, H - 10);
    Som.abafar(true);
    Som.som("zumbido", T_CARGA);
    vibrar(40);
    Poki.medir("rebirth", "animacao-" + variante, "visible");
    clearTimeout(seguranca);
    seguranca = setTimeout(function() { if (ativo) { if (!abriu) abrir(); terminar(); } }, 7000);   // nunca fica preso
  }

  // ---------- partículas ----------
  function faisca(x, y, forca, cima) {
    if (faiscas.length > 260) return;
    const a = cima ? -Math.PI / 2 + (Math.random() - 0.5) * 2.4 : Math.random() * Math.PI * 2, v = (25 + Math.random() * 80) * forca;
    faiscas.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.35 + Math.random() * 0.5, cor: FAISCA[Math.floor(Math.random() * 4)], tam: Math.random() < 0.3 ? 2 : 1 });
  }
  function fumaca(x, y, grande) {
    if (fumacas.length > 90) return;
    fumacas.push({ x: x + (Math.random() - 0.5) * 4, y: y, r: (grande ? 4 : 2) + Math.random() * 3, vx: (Math.random() - 0.5) * 10, vy: -10 - Math.random() * 12, t: 0, vida: 1.8 + Math.random() * 1.2, cor: FUMACA[Math.floor(Math.random() * 3)] });
  }
  function arco(x1, y1, x2, y2) {   // raio elétrico em zigue-zague
    const pts = [], n = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i <= n; i++) { const k = i / n, j = (i === 0 || i === n) ? 0 : (Math.random() - 0.5) * 10; pts.push({ x: x1 + (x2 - x1) * k + j * 0.4, y: y1 + (y2 - y1) * k + j }); }
    arcos.push({ pts: pts, t: 0, vida: 0.07 + Math.random() * 0.1 });
  }
  function emitir(dt, I) {
    const taxa = function(r) { return Math.random() < r * dt; };
    if (variante === 0) {   // engrenagens: faísca voando dos dentes (atrito) e fumaça saindo do eixo
      for (let k = 0; k < Math.ceil((8 + 90 * I * I) * dt); k++) { const a = Math.random() * Math.PI * 2; faisca(ox + Math.cos(a) * raioBotao, oy + Math.sin(a) * raioBotao, 1 + I, false); }
      if (taxa(4 + 20 * I)) fumaca(ox + (Math.random() - 0.5) * raioBotao, oy - 2, I > 0.5);
      if (I > 0.5 && taxa(6 * I)) { const a = Math.random() * Math.PI * 2; arco(ox, oy, ox + Math.cos(a) * raioBotao * 2.5, oy + Math.sin(a) * raioBotao * 2.5); }
    } else if (variante === 1) {   // botão: faísca saindo da borda e vapor subindo
      for (let k = 0; k < Math.ceil((6 + 80 * I * I) * dt); k++) {
        const a = Math.random() * Math.PI * 2;
        faisca(ox + Math.cos(a) * raioBotao, oy + Math.sin(a) * raioBotao * 0.8, 0.8 + I, false);
      }
      if (taxa(3 + 18 * I)) fumaca(ox + (Math.random() - 0.5) * raioBotao * 1.6, oy - raioBotao * 0.6, I > 0.6);
      if (I > 0.4 && taxa(5 * I)) { const a = Math.random() * Math.PI * 2; arco(ox, oy, ox + Math.cos(a) * raioBotao * 2.2, oy + Math.sin(a) * raioBotao * 2.2); }
    } else {   // pane: raios no cano de cima e faíscas caindo das juntas
      if (taxa(4 + 22 * I)) { const x = Math.random() * W, l = 14 + Math.random() * 40; arco(x, cano, x + l, cano + (Math.random() - 0.5) * 6); }
      if (taxa(1.5 + 6 * I)) arco(Math.random() * W, cano, Math.random() * W, Math.random() * H * 0.8);
      for (let k = 0; k < Math.ceil((6 + 60 * I) * dt); k++) faisca(Math.random() * W, cano + 2, 0.7, false);
      if (taxa(2 + 10 * I)) fumaca(Math.random() * W, cano, I > 0.6);
    }
    // no fim da pane, tudo solta faísca e fumaça (a máquina inteira está pifando)
    if (I > 0.6) {
      if (taxa(14 * (I - 0.6))) fumaca(Math.random() * W, H * (0.3 + Math.random() * 0.7), true);
      for (let k = 0; k < Math.ceil(30 * (I - 0.6) * dt); k++) faisca(Math.random() * W, Math.random() * H, 0.6, true);
    }
    if (Math.random() < dt * (3 + 14 * I)) Som.som("faisca");
  }

  function circ(x, y, r, cor) {   // círculo cheio sem serrilhado (linha a linha)
    g.fillStyle = cor; r = Math.max(0, r);
    for (let dy = -Math.floor(r); dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); g.fillRect(Math.round(x - w), Math.round(y + dy), w * 2 + 1, 1); }
  }
  function linha(x1, y1, x2, y2, cor, esp) {
    g.fillStyle = cor;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(x1 + (x2 - x1) * i / n), Math.round(y1 + (y2 - y1) * i / n), esp, esp);
  }

  function explodir() {
    explodiu = true;
    Som.som("explosao");
    vibrar(250);
    for (let i = 0; i < 32; i++) {
      const a = Math.random() * Math.PI * 2, v = 70 + Math.random() * 190;
      destrocos.push({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, vida: 0.7 + Math.random() * 0.6, cor: METAL[Math.floor(Math.random() * 4)], tam: 2 + Math.floor(Math.random() * 3), giro: Math.random() < 0.5 });
    }
    for (let i = 0; i < 80; i++) faisca(ox, oy, 3, false);
    for (let i = 0; i < 14; i++) fumaca(ox + (Math.random() - 0.5) * 40, oy + (Math.random() - 0.5) * 30, true);
  }
  function abrir() {
    abriu = true;
    restaurar();
    try { if (aoExplodir) aoExplodir(); } catch (e) { console.error(e); }
    Som.abafar(false);
    setTimeout(function() { Som.som("renascer"); }, 120);
  }
  function restaurar() {
    tremer.forEach(function(e) { e.style.transform = ""; });
    el("cvBotao").style.filter = "";
    Fundo.pane.vel = 1; Fundo.pane.fumaca = 1; Fundo.pane.luzes = 0;
  }
  function terminar() {
    ativo = false; clearTimeout(seguranca);
    cv.classList.remove("on");
    faiscas.length = fumacas.length = arcos.length = destrocos.length = 0;
    restaurar();
  }

  // ---------- quadro a quadro ----------
  function passo(dt) {
    if (!ativo) return;
    tempo += dt;
    const I = limitar(tempo / T_PANE, 0, 1);
    if (tempo < T_CARGA) emitir(dt, I);
    if (tempo >= proxAlarme && tempo < T_CARGA) { Som.som("alarme"); proxAlarme += 0.55; }
    if (tempo >= T_PANE && tempo - dt < T_PANE) { Som.som("carga"); vibrar(60); }
    if (tempo >= T_CARGA && !explodiu) explodir();
    if (tempo >= T_BOOM && !abriu) abrir();
    if (tempo >= T_FIM) { terminar(); return; }

    // a máquina reage: tremedeira, engrenagens, pistões, fumaça, luzes, botão brilhando
    if (!abriu) {
      const amp = tempo < T_PANE ? 1 + 6 * I * I : 9;
      const dx = Math.round((Math.random() - 0.5) * amp) * 2, dy = Math.round((Math.random() - 0.5) * amp) * 2;
      tremer.forEach(function(e) { e.style.transform = "translate(" + dx + "px," + dy + "px)"; });
      const P = Fundo.pane;
      if (variante === 2) { P.vel = tempo < 0.9 ? 1 - tempo / 0.9 : tempo < 1.5 ? 0 : 9; P.luzes = 1; P.fumaca = 1 + 4 * I; }
      else { P.vel = 1 + (variante === 0 ? 8 : 3) * I; P.fumaca = 1 + (variante === 0 ? 12 : 3) * I; P.luzes = I > 0.5 ? 1 : 0; }
      if (variante === 1) el("cvBotao").style.filter = "brightness(" + (1 + I * 0.9 + Math.random() * 0.3 * I).toFixed(2) + ") saturate(" + (1 + I).toFixed(2) + ")";
    }

    g.clearRect(0, 0, W, H);
    // pane: as luzes da fábrica piscam e apagam
    if (!abriu) {
      if (variante === 2) {
        if (Math.random() < dt * 9) escuro = Math.random() < 0.35 ? 0.88 : 0.35 + 0.35 * I;
        g.fillStyle = "rgba(4,2,12," + escuro.toFixed(2) + ")"; g.fillRect(0, 0, W, H);
      } else if (I > 0.3 && Math.random() < 0.12) { g.fillStyle = "rgba(4,2,12,0.45)"; g.fillRect(0, 0, W, H); }
      // alarme: borda vermelha pulsando
      const al = (0.12 + 0.3 * I) * (0.5 + 0.5 * Math.sin(tempo * 11.4));
      for (let k = 0; k < 4; k++) {
        g.fillStyle = "rgba(255,40,50," + (al * (1 - k / 4)).toFixed(3) + ")";
        const b = 3 + k * 3;
        g.fillRect(0, 0, W, b); g.fillRect(0, H - b, W, b); g.fillRect(0, 0, b, H); g.fillRect(W - b, 0, b, H);
      }
      // brilho de calor no ponto que vai estourar
      if (variante !== 2 || tempo >= T_PANE) {
        const pulso = 0.5 + 0.5 * Math.sin(tempo * 18);
        const rr = tempo < T_PANE ? 2 + 5 * I + pulso * 1.5 : 6 + (tempo - T_PANE) / (T_CARGA - T_PANE) * 30;
        if (I > 0.3 || tempo >= T_PANE) {
          g.globalAlpha = tempo < T_PANE ? 0.2 + 0.4 * I : 0.85;
          circ(ox, oy, rr * 1.6, "#ff5a2e"); circ(ox, oy, rr * 1.15, "#ffb02e"); circ(ox, oy, rr * 0.6, "#fff6c2");
          g.globalAlpha = 1;
        }
      }
    }
    // fumaça (nuvenzinha de pixel: dois retângulos cruzados + brilho em cima)
    for (let i = fumacas.length - 1; i >= 0; i--) {
      const p = fumacas[i]; p.t += dt; if (p.t >= p.vida) { fumacas.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 4;
      g.globalAlpha = 0.75 * (1 - p.t / p.vida);
      g.fillStyle = p.cor;
      g.fillRect(Math.round(p.x - p.r), Math.round(p.y - p.r * 0.7), Math.round(p.r * 2), Math.round(p.r * 1.4));
      g.fillRect(Math.round(p.x - p.r * 0.7), Math.round(p.y - p.r), Math.round(p.r * 1.4), Math.round(p.r * 2));
      g.fillStyle = "#4e4670"; g.fillRect(Math.round(p.x - p.r * 0.5), Math.round(p.y - p.r), Math.round(p.r * 0.8), 1);
    }
    g.globalAlpha = 1;
    // raios
    for (let i = arcos.length - 1; i >= 0; i--) {
      const a = arcos[i]; a.t += dt; if (a.t >= a.vida) { arcos.splice(i, 1); continue; }
      for (let k = 1; k < a.pts.length; k++) linha(a.pts[k - 1].x, a.pts[k - 1].y + 1, a.pts[k].x, a.pts[k].y + 1, "#2a6cff", 2);
      for (let k = 1; k < a.pts.length; k++) linha(a.pts[k - 1].x, a.pts[k - 1].y, a.pts[k].x, a.pts[k].y, k % 2 ? "#e8f8ff" : "#8fdcff", 1);
    }
    // faíscas (com gravidade)
    for (let i = faiscas.length - 1; i >= 0; i--) {
      const p = faiscas[i]; p.t += dt; if (p.t >= p.vida) { faiscas.splice(i, 1); continue; }
      p.vy += 170 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      g.fillStyle = p.t > p.vida * 0.6 ? "#ff7a2e" : p.cor;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam);
    }
    // estouro: bola de fogo crescendo até cobrir a tela, depois o clarão branco vai sumindo
    if (explodiu) {
      const max = Math.hypot(W, H);
      if (tempo < T_BOOM + 0.05) {
        const k = limitar((tempo - T_CARGA) / (T_BOOM - T_CARGA), 0, 1), r = max * (1 - Math.pow(1 - k, 3));
        circ(ox, oy, r, "#7a1830"); circ(ox, oy, r * 0.86, "#d8342c"); circ(ox, oy, r * 0.7, "#ff8a2e"); circ(ox, oy, r * 0.52, "#ffe066"); circ(ox, oy, r * 0.32, "#ffffff");
        g.fillStyle = "rgba(255,255,255," + (k * k * 0.9).toFixed(2) + ")"; g.fillRect(0, 0, W, H);
      } else {
        const k = limitar((tempo - T_BOOM) / (T_FIM - T_BOOM), 0, 1);
        g.fillStyle = "rgba(255,250,235," + (1 - k).toFixed(3) + ")"; g.fillRect(0, 0, W, H);
        // anel de choque saindo do centro do clarão
        const ra = 10 + k * max * 0.6;
        g.globalAlpha = (1 - k) * 0.8;
        g.fillStyle = "#ffe066";
        for (let a = 0; a < 64; a++) { const an = a / 64 * Math.PI * 2; g.fillRect(Math.round(ox + Math.cos(an) * ra), Math.round(oy + Math.sin(an) * ra), 2, 2); }
        g.globalAlpha = 1;
      }
    }
    // pedaços da máquina voando
    for (let i = destrocos.length - 1; i >= 0; i--) {
      const p = destrocos[i]; p.t += dt; if (p.t >= p.vida) { destrocos.splice(i, 1); continue; }
      p.vy += 220 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = Math.min(1, (p.vida - p.t) * 3);
      g.fillStyle = "#1a1030"; g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, p.tam + 2, (p.giro && Math.floor(p.t * 12) % 2 ? 1 : p.tam) + 2);
      g.fillStyle = p.t < 0.35 ? "#ffb02e" : p.cor;   // sai em brasa e vai esfriando
      g.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.giro && Math.floor(p.t * 12) % 2 ? 1 : p.tam);
    }
    g.globalAlpha = 1;
  }

  return { iniciar: iniciar, passo: passo, get ativo() { return ativo; } };
})();
