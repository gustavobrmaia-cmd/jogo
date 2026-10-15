"use strict";

// =========================
// DESENHO DA PARTIDA E HUD
// Junta a arte (ArteCenarios, ArteArmas, ArteCartas, ArteBolinha, Efeitos, ArteQueda) na ordem certa.
// Se algum arquivo de arte faltar, desenha formas simples no lugar (o jogo nunca quebra por causa da arte).
// No celular em pé (contra o bot) a câmera chega perto da luta e segue as bolinhas; o espaço de baixo fica para os dedos.
// =========================

const temArte = {
  get cen() { return typeof ArteCenarios !== "undefined"; },
  get armas() { return typeof ArteArmas !== "undefined"; },
  get cartas() { return typeof ArteCartas !== "undefined"; },
  get bola() { return typeof ArteBolinha !== "undefined"; },
  get fx() { return typeof Efeitos !== "undefined"; },
  get queda() { return typeof ArteQueda !== "undefined"; }
};

function deslocMundo() {
  return alturaTela > FIS.altura ? Math.round((alturaTela - FIS.altura) / 2) : 0;
}

// ---------- onde fica cada coisa na tela ----------
// Deitado/PC: a arena 1280x720 ocupa a tela (no meio, se sobrar altura).
// Em pé (celular) contra o bot: HUD em cima, controles embaixo e, no meio, a arena com CÂMERA: chega mais
// perto (zoom 1,15–1,8) e segue as duas bolinhas, com o chão sempre na mesma altura da tela. Antes a arena
// inteira ocupava 1/3 da tela, as bolinhas ficavam minúsculas e o botão de pulo ficava lá em cima, sobre o HUD
// (45% das sessões do Poki v9 foram com o celular em pé).
function layoutTela(j) {
  const H = alturaTela, dy = deslocMundo();
  const L = layoutTela.L || (layoutTela.L = {});
  L.H = H; L.dy = dy; L.emPe = dy > 150; L.cam = false;
  L.hudTopo = L.emPe ? dy - 200 : 10;
  L.yBaixo = H - (L.emPe ? 330 : 130);                 // analógicos (andar / mirar)
  L.yPulo = H * (L.emPe ? 0.3 : 0.32);                 // botão de pulo (metade de cima do lado de dentro)
  L.limitePulo = 0.45;                                  // toque no lado de dentro acima disso (fração da altura) = pulo
  if (L.emPe && j && !j.demo && j.modo !== "2p") {
    const base = H - 760, topo = 150;
    const zMax = Math.min(1.8, (base - topo - 250) / FIS.altura);
    if (zMax >= 1.1) {
      L.cam = true; L.base = base; L.zMax = zMax; L.zMin = Math.min(1.3, zMax);   // v18: era 1,15 (bolinhas com 16–25 px no celular)
      L.hudTopo = topo;
      L.yPulo = H - 640;
      L.limitePulo = (H - 470) / H;
    }
  }
  // v18.2: 2 jogadores em pé: o pulo descia por cima das barras de vida; agora fica logo acima do analógico de mira
  if (L.emPe && j && j.modo === "2p") { L.yPulo = H - 640; L.limitePulo = (H - 470) / H; }
  return L;
}
// fração da altura da tela acima da qual um toque no lado de dentro é pulo (entrada.js)
function limitePuloToque() { return layoutTela.L ? layoutTela.L.limitePulo : 0.45; }

const camera = { z: 1, x: 0, oy: 0, M: null };
function atualizarCamera(j, M, L) {
  const c = camera;
  if (!L.cam) { c.z = 1; c.x = 0; c.oy = L.dy; c.M = null; return c; }
  let x0 = Infinity, x1 = -Infinity;
  for (let k = 0; k < 2; k++) { const b = M.bolinhas[k]; if (b.viva) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); } }
  if (x0 > x1) { const p = M.ko || { x: CONFIG.largura / 2 }; x0 = x1 = p.x; }
  // perto quando as bolinhas estão perto; mais longe (até ~1100 px de arena) quando se afastam
  const zAlvo = limitar(CONFIG.largura / (x1 - x0 + 420), L.zMin, L.zMax);
  const nova = c.M !== M;
  c.z = nova ? zAlvo : c.z + (zAlvo - c.z) * 0.05;
  const larg = CONFIG.largura / c.z;
  const xAlvo = limitar((x0 + x1) / 2 - larg / 2, 0, CONFIG.largura - larg);
  c.x = nova ? xAlvo : limitar(c.x + (xAlvo - c.x) * 0.1, 0, CONFIG.largura - larg);
  c.oy = L.base - FIS.altura * c.z;
  c.M = M;
  return c;
}
function mundoParaTela(x, y) { return { x: (x - camera.x) * camera.z, y: camera.oy + y * camera.z }; }
function telaParaMundo(x, y) { return { x: x / camera.z + camera.x, y: (y - camera.oy) / camera.z }; }

function desenharJogo(ctx) {
  const j = jogo;
  const H = alturaTela;
  if (!j) { ctx.fillStyle = "#10121c"; ctx.fillRect(0, 0, CONFIG.largura, H); return; }
  const M = j.M, cen = M.cen, t = M.t;
  const dy = deslocMundo();
  const L = layoutTela(j), cam = atualizarCamera(j, M, L);

  // estado que o cenário usa para desenhar
  const est = estadoCenario(j, M, dy);

  ctx.save();
  if (temArte.fx) { const s = Efeitos.deslocamento(); ctx.translate(s.x, s.y); }
  ctx.translate(-cam.x * cam.z, cam.oy);
  if (cam.z !== 1) ctx.scale(cam.z, cam.z);
  // K.O.: zoom rápido em quem caiu durante a câmera lenta
  if (j.fase === "fimRodada" && M.ko && j.tempoFase < 1.4) {
    const tz = j.tempoFase, k = tz < 0.2 ? tz / 0.2 : Math.max(0, 1 - (tz - 0.2) / 1.2);
    const z = 1 + 0.13 * k * k * (3 - 2 * k);
    ctx.translate(M.ko.x, M.ko.y); ctx.scale(z, z); ctx.translate(-M.ko.x, -M.ko.y);
  }

  // 1. fundo fixo (refeito só quando muda o cenário ou o tamanho)
  if (!j.prerender || j.prerenderCen !== cen.id || j.prerenderH !== H) {
    j.prerender = temArte.cen ? ArteCenarios.prerender(cen, CONFIG.largura, H) : null;
    j.prerenderCen = cen.id; j.prerenderH = H;
  }
  if (j.prerender) ctx.drawImage(j.prerender, 0, -dy);
  else { ctx.fillStyle = "#1b2140"; ctx.fillRect(0, -dy, CONFIG.largura, H); }

  // 2-3. fundo animado e plataformas
  if (temArte.cen) {
    ArteCenarios.desenharFundoAnimado(ctx, cen, est, t);
    ArteCenarios.desenharPlataformas(ctx, cen, M.plats, est, t);
  } else plataformasSimples(ctx, M);

  // 4. caixas e cartas
  for (let i = 0; i < M.caixas.length; i++) {
    const c = M.caixas[i];
    const piscando = !c.paraquedas && c.vida < 2.5 && Math.floor(c.vida * 8) % 2 === 0;
    if (piscando) continue;
    if (temArte.armas) ArteArmas.desenharCaixa(ctx, c);
    else { ctx.fillStyle = "#c08a4a"; ctx.fillRect(c.x - 18, c.y - 18, 36, 36); }
  }
  for (let i = 0; i < M.cartas.length; i++) {
    const c = M.cartas[i];
    if (c.vida < 1.5 && Math.floor(c.vida * 8) % 2 === 0) continue;
    const y = c.y + Math.sin(c.t * 3) * 6;
    const esc = Math.min(1, c.t * 4);
    if (temArte.cartas) ArteCartas.desenharCarta(ctx, c.id, c.x, y, esc, t);
    else { ctx.fillStyle = CARTA[c.id].cor; ctx.fillRect(c.x - 23 * esc, y - 32 * esc, 46 * esc, 64 * esc); }
  }

  // 5. projéteis, minas e avisos do céu
  for (let i = 0; i < M.proj.length; i++) {
    const p = M.proj[i];
    if (p.visual === "gancho") { const d = M.bolinhas[p.dono - 1]; p.donoX = d.x; p.donoY = d.y; }
    if (temArte.armas) ArteArmas.desenharProjetil(ctx, p);
    else { ctx.fillStyle = p.cor; ctx.beginPath(); ctx.arc(p.x, p.y, p.raio, 0, 7); ctx.fill(); }
  }
  for (let i = 0; i < M.avisos.length; i++) {
    const v = M.avisos[i];
    const prog = 1 - v.tempo / v.total;
    if (temArte.armas) {
      ArteArmas.desenharAviso(ctx, v.x, v.y, v.a.explode, prog, v.visual);
      if (v.visual === "meteoro" && v.tempo < 0.4) ArteArmas.desenharMeteoro(ctx, v.x, v.y - (v.tempo / 0.4) * (v.y + 60), 1 - v.tempo / 0.4);
    } else { ctx.strokeStyle = "rgba(255,80,80," + prog + ")"; ctx.beginPath(); ctx.arc(v.x, v.y, v.a.explode * prog, 0, 7); ctx.stroke(); }
  }

  // 6. bolinhas e armas
  for (let k = 0; k < 2; k++) desenharBolinhaNoMundo(ctx, j, M, M.bolinhas[k], M.bolinhas[1 - k], M.t);

  // 7. lasers e raios
  for (let i = 0; i < M.feixes.length; i++) {
    const f = M.feixes[i];
    if (temArte.armas) ArteArmas.desenharFeixe(ctx, f.pontos, f.visual, f.vida, f.cor);
    else { ctx.strokeStyle = f.cor; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(f.pontos[0].x, f.pontos[0].y); for (let k = 1; k < f.pontos.length; k++) ctx.lineTo(f.pontos[k].x, f.pontos[k].y); ctx.stroke(); }
  }

  // 8. partículas
  if (temArte.fx) Efeitos.desenhar(ctx);

  // 9. frente do cenário (lava, água, escuridão, vento)
  if (temArte.cen) ArteCenarios.desenharFrente(ctx, cen, est, t);
  // "NOVO!" em cima das caixas/cartas da rodada em que elas aparecem pela 1ª vez (depois da escuridão da floresta)
  if (!j.demo && M.novoCaixa && !j.viuCaixa) M.caixas.forEach(function(c) { etiquetaNovo(ctx, c.x, c.y, t); });
  if (!j.demo && M.novoCarta && !j.viuCarta) M.cartas.forEach(function(c) { etiquetaNovo(ctx, c.x, c.y + Math.sin(c.t * 3) * 6 - 14, t); });
  // reações do bot (balões) e suor quando está com pouca vida
  for (let k = 0; k < 2; k++) desenharReacao(ctx, M, M.bolinhas[k], t);
  ctx.restore();
  if (L.cam && j.fase !== "queda") desenharSetasForaDaTela(ctx, M);

  if (!j.demo) desenharVinheta(ctx, j, M, H);

  // 10. HUD e textos
  if (j.demo) { if (j.fase === "queda") desenharQueda(ctx, j, H); return; }   // fundo dos menus: só a luta
  // na queda de braço o botão de pausa sai da frente da barra de força
  const naQueda = j.fase === "queda";
  if (naQueda !== desenharJogo.naQueda) { desenharJogo.naQueda = naQueda; el("btnPausa").classList.toggle("escondido", naQueda); }
  if (j.fase === "queda") desenharQueda(ctx, j, H);
  else { desenharHud(ctx, j, M, L); desenharSensacoes(ctx, j, M, L); }
  if (!j.demo) desenharControlesToque(ctx, j, H, L);
  if (j.fase !== "queda") desenharTutorial(ctx, j, M, L);
  const cruz = !j.demo && estado === "jogo" && entrada.mouseAtivo && j.fase !== "queda";
  if (cruz) desenharCruzMira(ctx, j);
  if (cruz !== desenharJogo.cruz) { desenharJogo.cruz = cruz; canvas.style.cursor = cruz ? "none" : ""; }
}

function estadoCenario(j, M, dy) {
  const cen = M.cen, t = M.t;
  const est = j.est || (j.est = { luzes: [] });
  est.t = t; est.largura = CONFIG.largura; est.altura = alturaTela; est.deslocY = dy;
  est.lavaY = lavaY(cen, t);
  est.gravidade = gravSinal(cen, t);
  est.avisoInversao = avisoInversao(cen, t);
  est.vento = ventoEm(cen, t);
  est.bumpers = M.bumpers;
  est.portais = cen.portais;
  if (cen.escuro) {
    const l = est.luzes; l.length = 0;
    M.bolinhas.forEach(function(b) { if (b.viva) l.push({ x: b.x, y: b.y, r: 175 }); });
    for (let i = 0; i < M.proj.length && l.length < 24; i++) {
      const p = M.proj[i];
      if (p.visual === "chama" || p.visual === "bola_fogo" || p.visual === "plasma" || p.visual === "foguete" || p.visual === "missil") l.push({ x: p.x, y: p.y, r: 70 });
    }
    for (let i = 0; i < M.feixes.length && l.length < 28; i++) { const f = M.feixes[i]; const u = f.pontos[f.pontos.length - 1]; l.push({ x: u.x, y: u.y, r: 90 }); }
    for (let i = 0; i < M.cartas.length; i++) l.push({ x: M.cartas[i].x, y: M.cartas[i].y, r: 60 });
    for (let i = 0; i < M.caixas.length; i++) l.push({ x: M.caixas[i].x, y: M.caixas[i].y, r: 50 });
  }
  return est;
}

function plataformasSimples(ctx, M) {
  ctx.fillStyle = "#5c6b8a";
  M.plats.forEach(function(p) { ctx.fillRect(p.x, p.y, p.w, p.h); });
  if (M.cen.lava) { ctx.fillStyle = "#ff6a00"; ctx.fillRect(0, lavaY(M.cen, M.t), 1280, 400); }
}

// Descritor que a ArteBolinha desenha
function desenharBolinhaNoMundo(ctx, j, M, b, o, tm) {
  if (!b.viva) return;
  const ef = b.efeitos;
  const fantasma = ef.fantasma > 0 ? 0.82 : 0;
  // expressão
  let expr = "normal";
  if (j.fase === "fimRodada" && j.vencedorRodada === b.lado) expr = "feliz";
  else if (ef.congelado > 0 || ef.lento > 0.5) expr = "tonto";
  else if (b.dor > 0) expr = "dor";
  else if (b.vida < 25) expr = "medo";
  else if (ef.furia > 0 || b.recuoAnim > 0.5 || b.golpe > 0) expr = "bravo";
  const ox = o.x - b.x, oy = o.y - b.y, od = Math.sqrt(ox * ox + oy * oy) || 1;
  const d = b.desc || (b.desc = {});
  d.x = b.x; d.y = b.y; d.r = b.r; d.cor = b.cor; d.vx = b.vx; d.vy = b.vy;
  d.olharX = o.viva ? ox / od : b.dir; d.olharY = o.viva ? oy / od * 0.7 : 0;
  d.expressao = expr; d.piscar = b.piscar || 0;
  d.escalaX = b.escalaX || 1; d.escalaY = (b.escalaY || 1) * (gravSinal(M.cen, tm) < 0 ? -1 : 1);
  d.flash = b.flash || 0; d.escudo = ef.escudo > 0; d.fantasma = fantasma; d.congelado = ef.congelado > 0;
  d.fogo = ef.fogo > 0; d.furia = ef.furia > 0; d.rapidez = ef.rapidez > 0; d.t = tm;
  const sk = j.skins && j.skins[b.lado - 1];
  d.skin = sk ? sk.corpo : "classico"; d.acessorio = sk ? sk.acessorio : "nenhum";
  // rastro de velocidade (v14): quem está rápido (melhoria de Velocidade ou carta Rapidez) deixa "fantasmas" para trás
  if ((b.multVel > 1.001 || ef.rapidez > 0) && Math.abs(b.vx) > 3.5 && fantasma === 0) {
    ctx.save();
    for (let k = 3; k >= 1; k--) {
      ctx.globalAlpha = 0.09 * (4 - k);
      ctx.fillStyle = b.cor;
      ctx.beginPath(); ctx.arc(b.x - b.vx * k * 2.2, b.y - b.vy * k * 1.2, b.r * (1 - k * 0.08), 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  if (temArte.bola) {
    if (!M.cen.semGravidade && !M.cen.inverte) ArteBolinha.sombra(ctx, b.x, chaoEmbaixo(M, b), b.r, chaoEmbaixo(M, b) - b.y - b.r);
    ArteBolinha.desenhar(ctx, d);
  } else {
    ctx.globalAlpha = 1 - fantasma;
    ctx.fillStyle = b.flash > 0.5 ? "#fff" : b.cor;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (fantasma > 0) ctx.globalAlpha = 0.25;
  const a = ARMA[b.arma];
  const ang = a.tipo === "melee" || a.tipo === "mina" || a.tipo === "ceu" ? (b.dir > 0 ? 0 : Math.PI) : (b.mira === undefined ? 0 : b.mira);
  if (temArte.armas) ArteArmas.desenharNaMao(ctx, b.arma, b.x, b.y, ang, b.r, b.recuoAnim || 0, b.golpe > 0 ? 1 - b.golpe : 0);
  ctx.globalAlpha = 1;
  if (!j.demo && b.miraLivre !== null && b.miraLivre !== undefined && j.fase === "luta" && b.humano) desenharGuiaMira(ctx, M, b, ang);
  // bot avisando um tiro pesado: linha vermelha tracejada na direção da mira
  if (b.avisando && j.fase === "luta") {
    const boca = pontaDoCano(b, ang), pis = 0.55 + 0.45 * Math.sin(tm * 30);
    ctx.save();
    ctx.globalAlpha = pis; ctx.strokeStyle = "#ff4d5e"; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -tm * 120;
    ctx.beginPath(); ctx.moveTo(boca.x, boca.y); ctx.lineTo(boca.x + Math.cos(ang) * 420, boca.y + Math.sin(ang) * 420); ctx.stroke();
    ctx.restore();
  }
  // marcador acima da cabeça no modo 2 jogadores (P1 / P2) para ninguém se perder
  if (!j.demo && (j.modo === "2p" || b.lado === 1) && (fantasma === 0 || j.modo === "2p")) {
    // v17.5: etiqueta na cor da bolinha com uma setinha apontando para ela
    const txt = j.modo === "2p" ? "P" + b.lado : t("voce_curto");
    // v18: em pé a tela tem 1280 px lógicos em ~400 px de celular: a etiqueta tinha ~5 px de verdade
    const ke = layoutTela.L && layoutTela.L.emPe ? 1.6 : 1;
    const inv = gravSinal(M.cen, tm) < 0, s = inv ? -1 : 1;
    const yy = inv ? b.y + b.r + 30 * ke : b.y - b.r - 30 * ke;
    ctx.font = "900 " + Math.round(16 * ke) + FONTE;
    const w = ctx.measureText(txt).width + 16 * ke;
    ctx.lineJoin = "round";
    retRedondo(ctx, b.x - w / 2, yy - 11 * ke, w, 22 * ke, 11 * ke);
    ctx.moveTo(b.x - 6 * ke, yy + s * 9 * ke); ctx.lineTo(b.x + 6 * ke, yy + s * 9 * ke); ctx.lineTo(b.x, yy + s * 17 * ke); ctx.closePath();
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(12,8,30,0.85)"; ctx.stroke();
    ctx.fillStyle = b.cor; ctx.fill();
    textoContorno(ctx, txt, b.x, yy + 6 * ke, Math.round(16 * ke), "#fff", "center", 3.5);
  }
}

// Linha pontilhada da mira livre: reta para tiros normais, curva para granadas/flechas (mostra onde cai)
function desenharGuiaMira(ctx, M, b, ang) {
  const a = ARMA[b.arma];
  if (a.tipo === "melee" || a.tipo === "mina" || a.tipo === "ceu") return;
  const boca = pontaDoCano(b, ang);
  const g = (a.grav || 0) * gravidadeDe(M.cen) * gravSinal(M.cen, M.t);
  const v = (a.vel || 18) * (M.cen.agua ? 0.7 : 1);
  const atravessa = a.atravessa || a.perfuraParede;
  let x = boca.x, y = boca.y, vx = Math.cos(ang) * v, vy = Math.sin(ang) * v;
  const passos = g ? 46 : 26, cada = g ? 3 : 2;
  let bateu = !atravessa && dentroDeSolida(M, x, y, a.raio || 4) ? { x: x, y: y } : null;   // cano já dentro da plataforma
  ctx.save();
  ctx.fillStyle = b.cor;
  for (let k = 1; k <= passos && !bateu; k++) {
    if (g) vy += g;
    const nx = x + vx * (g ? 1 : 0.9), ny = y + vy * (g ? 1 : 0.9);
    // o tiro bate numa plataforma grossa? a linha para ali e mostra um X vermelho
    // (mesma conta do tiro de verdade: ponto final e meio do caminho)
    if (!atravessa) {
      const r = a.raio || 4, mx = (x + nx) / 2, my = (y + ny) / 2;
      if (dentroDeSolida(M, mx, my, r)) { bateu = { x: mx, y: my }; break; }
      if (dentroDeSolida(M, nx, ny, r)) { bateu = { x: nx, y: ny }; break; }
    }
    x = nx; y = ny;
    if (k % cada) continue;
    const alfa = 0.75 * (1 - k / passos);
    if (alfa <= 0.05) break;
    ctx.globalAlpha = alfa;
    ctx.beginPath(); ctx.arc(x, y, g ? 3.2 : 2.6, 0, 7); ctx.fill();
  }
  if (bateu) {
    // X que pulsa, com borda escura para aparecer em qualquer cenário
    const r = 10 + Math.sin(M.t * 10) * 2;
    ctx.globalAlpha = 0.95; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bateu.x - r, bateu.y - r); ctx.lineTo(bateu.x + r, bateu.y + r);
    ctx.moveTo(bateu.x + r, bateu.y - r); ctx.lineTo(bateu.x - r, bateu.y + r);
    ctx.strokeStyle = "#3a0a14"; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = "#ff4d5e"; ctx.lineWidth = 4.5; ctx.stroke();
  }
  ctx.restore();
}

// Cruz da mira do mouse (jogador 1)
function desenharCruzMira(ctx, j) {
  const x = entrada.mouseX, y = entrada.mouseY, cor = j.cores[0];
  ctx.save();
  // marcador de acerto: 4 tracinhos brancos em X que abrem e somem
  const b1 = j.M.bolinhas[0];
  if (b1.marca > 0) {
    const m = b1.marca / 0.18, r1 = 15 + (1 - m) * 6, r2 = r1 + 9;
    ctx.globalAlpha = m; ctx.lineCap = "round";
    for (let p = 0; p < 2; p++) {
      ctx.strokeStyle = p ? "#fff" : "rgba(12,8,30,0.8)"; ctx.lineWidth = p ? 3 : 6;
      ctx.beginPath();
      for (let q = 0; q < 4; q++) { const a = Math.PI / 4 + q * Math.PI / 2; ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.lineCap = "round";
  for (let k = 0; k < 2; k++) {
    ctx.strokeStyle = k ? cor : "rgba(12,8,30,0.85)";
    ctx.lineWidth = k ? 2.5 : 5.5;
    ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 21, y); ctx.lineTo(x - 8, y); ctx.moveTo(x + 8, y); ctx.lineTo(x + 21, y);
    ctx.moveTo(x, y - 21); ctx.lineTo(x, y - 8); ctx.moveTo(x, y + 8); ctx.lineTo(x, y + 21);
    ctx.stroke();
  }
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill();
  ctx.restore();
}

// Em pé com a câmera perto: seta na beirada apontando quem saiu da tela (na cor dele)
function desenharSetasForaDaTela(ctx, M) {
  for (let k = 0; k < 2; k++) {
    const b = M.bolinhas[k];
    if (!b.viva) continue;
    const p = mundoParaTela(b.x, b.y), r = b.r * camera.z;
    const lado = p.x < -r * 0.3 ? -1 : p.x > CONFIG.largura + r * 0.3 ? 1 : 0;
    if (!lado) continue;
    const x = lado < 0 ? 46 : CONFIG.largura - 46, y = limitar(p.y, camera.oy + 40, camera.oy + FIS.altura * camera.z - 40);
    const pulso = 1 + 0.08 * Math.sin(M.t * 8);
    ctx.save();
    ctx.translate(x, y); ctx.scale(lado * pulso, pulso);
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-14, -28); ctx.lineTo(-14, 28); ctx.closePath();
    ctx.lineJoin = "round"; ctx.lineWidth = 8; ctx.strokeStyle = "rgba(12,8,30,0.85)"; ctx.stroke();
    ctx.fillStyle = b.cor; ctx.fill();
    ctx.restore();
  }
}

// ---------- tutorial desenhado (1ª partida contra o bot) ----------
// Sem texto (o Poki recomenda imagem/animação; serve para qualquer idioma): mouse e teclas no PC, dedo em cima
// dos controles no toque. Uma ação de cada vez, que some quando a pessoa faz (partida.js: passoTutorial).
function desenharTutorial(ctx, j, M, L) {
  const tu = j.tuto;
  if (!tu || !tu.passo || j.fase !== "luta" || estado !== "jogo") return;
  const b = M.bolinhas[0];
  if (!b.viva) return;
  const tm = performance.now() / 1000;
  ctx.save();
  ctx.globalAlpha = Math.min(1, tu.tempo * 3);
  if (entrada.toque) tutorialToque(ctx, M, L, tu.passo, tm);
  else tutorialTeclado(ctx, M, L, tu.passo, tm);
  if (tu.passo === "pulo") {
    // seta para cima em cima da bolinha
    const p = mundoParaTela(b.x, b.y), sobe = Math.abs(Math.sin(tm * 4)) * 14;
    setaTuto(ctx, p.x, p.y - b.r * camera.z - 46 - sobe, 0, -1, 1);
  }
  ctx.restore();
}

function tutorialTeclado(ctx, M, L, passo, tm) {
  const b = M.bolinhas[0], p = mundoParaTela(b.x, b.y);
  const x = limitar(p.x, 170, CONFIG.largura - 170);
  const y = Math.max(L.emPe ? L.hudTopo + 330 : 150, p.y - b.r * camera.z - (passo === "pulo" ? 150 : 115));
  const tk = entrada.teclas()[1];
  if (passo === "tiro") {
    const clica = tm % 0.8 < 0.25;
    painelTuto(ctx, x - 100, y - 62, 200, 124);
    mouseTuto(ctx, x - 44, y, clica);
    setaTuto(ctx, x + 6, y, 1, 0, 0.7);
    miraTuto(ctx, x + 60, y, clica);
  } else if (passo === "andar") {
    const esq = tm % 1 < 0.5;
    painelTuto(ctx, x - 130, y - 50, 260, 100);
    teclaTuto(ctx, x - 40, y, nomeTecla(tk.esquerda[0]), esq);
    teclaTuto(ctx, x + 40, y, nomeTecla(tk.direita[0]), !esq);
    setaTuto(ctx, x - 104, y, -1, 0, 0.7);
    setaTuto(ctx, x + 104, y, 1, 0, 0.7);
  } else {
    const nome = nomeTecla(tk.pulo[0]);
    ctx.font = "900 26px Nunito, system-ui, sans-serif";
    const w = Math.max(150, ctx.measureText(nome).width + 50);
    painelTuto(ctx, x - w / 2 - 22, y - 50, w + 44, 100);
    teclaTuto(ctx, x, y, nome, tm % 0.9 < 0.3, w);
  }
}

function tutorialToque(ctx, M, L, passo, tm) {
  const W = CONFIG.largura, k = L.emPe ? 1.8 : 1;
  if (passo === "tiro") {
    // segura no analógico de mira e arrasta um pouco para o lado do bot
    const x = 0.86 * W, y = L.yBaixo;
    anelTuto(ctx, x, y, 76 * k, tm);
    const a = M.bolinhas[0], o = M.bolinhas[1], ang = Math.atan2(o.y - a.y, o.x - a.x);
    const f = tm % 1.4 / 1.4, arr = Math.min(1, f * 2.2) * 46 * k;
    dedoTuto(ctx, x + Math.cos(ang) * arr, y + Math.sin(ang) * arr, f < 0.8, k, tm);
  } else if (passo === "andar") {
    const x = 0.14 * W, y = L.yBaixo;
    anelTuto(ctx, x, y, 84 * k, tm);
    setaTuto(ctx, Math.max(40, x - 118 * k), y, -1, 0, k * 0.8);
    setaTuto(ctx, x + 118 * k, y, 1, 0, k * 0.8);
    dedoTuto(ctx, x + Math.sin(tm * 3) * 55 * k, y, true, k, tm);
  } else {
    const x = 0.86 * W, y = L.yPulo, ap = tm % 0.9 < 0.3;
    anelTuto(ctx, x, y, 62 * k, tm);
    dedoTuto(ctx, x, y + (ap ? 0 : 16 * k), ap, k, tm);
  }
}

function painelTuto(ctx, x, y, w, h) {
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.6; ctx.fillStyle = "rgba(12,8,30,0.9)";
  retRedondo(ctx, x, y, w, h, 22); ctx.fill();
  ctx.globalAlpha = a;
}
// seta (triângulo) apontando para (dx, dy)
function setaTuto(ctx, x, y, dx, dy, esc) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx)); ctx.scale(esc, esc);
  ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-12, -22); ctx.lineTo(-12, 22); ctx.closePath();
  ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = "rgba(12,8,30,0.9)"; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.restore();
}
function anelTuto(ctx, x, y, r, tm) {
  ctx.save();
  ctx.lineWidth = 7; ctx.strokeStyle = "#ffd43b";
  ctx.beginPath(); ctx.arc(x, y, r * (1.05 + 0.07 * Math.sin(tm * 6)), 0, 7); ctx.stroke();
  ctx.restore();
}
// mão com o indicador esticado; a ponta do dedo fica em (x, y)
function dedoTuto(ctx, x, y, apertando, k, tm) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  if (apertando) {
    const f = tm % 0.6 / 0.6;
    ctx.save();
    ctx.globalAlpha *= 1 - f;
    ctx.lineWidth = 5; ctx.strokeStyle = "#fff";
    ctx.beginPath(); ctx.arc(0, 0, 14 + f * 34, 0, 7); ctx.stroke();
    ctx.restore();
  }
  const ret = function(x, y, w, h, r) {
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  const forma = function() {
    ret(-12, 0, 24, 74, 12);                             // indicador
    ret(-16, 44, 62, 70, 22);                            // palma
    ctx.moveTo(-4, 80); ctx.ellipse(-16, 80, 12, 19, -0.5, 0, 7);   // polegar
    ctx.moveTo(30, 50); ctx.arc(20, 50, 10, 0, 7);       // dedos dobrados
    ctx.moveTo(42, 56); ctx.arc(32, 56, 10, 0, 7);
  };
  ctx.lineJoin = "round";
  ctx.beginPath(); forma(); ctx.lineWidth = 9; ctx.strokeStyle = "rgba(12,8,30,0.9)"; ctx.stroke();
  ctx.beginPath(); forma(); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.restore();
}
function mouseTuto(ctx, x, y, clicando) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 6; ctx.strokeStyle = "rgba(12,8,30,0.95)";
  retRedondo(ctx, -30, -44, 60, 88, 28);
  ctx.fillStyle = "#f1f3f5"; ctx.fill(); ctx.stroke();
  // botão esquerdo aceso no clique
  ctx.save(); retRedondo(ctx, -30, -44, 60, 88, 28); ctx.clip();
  ctx.fillStyle = clicando ? "#ffd43b" : "#ced4da"; ctx.fillRect(-30, -44, 30, 38);
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(0, -6); ctx.moveTo(-30, -6); ctx.lineTo(30, -6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -44); ctx.quadraticCurveTo(4, -60, 16, -62); ctx.stroke();
  ctx.restore();
}
function miraTuto(ctx, x, y, acende) {
  ctx.save();
  ctx.lineCap = "round";
  for (let p = 0; p < 2; p++) {
    ctx.strokeStyle = p ? (acende ? "#ffd43b" : "#fff") : "rgba(12,8,30,0.9)"; ctx.lineWidth = p ? 3.5 : 8;
    ctx.beginPath(); ctx.arc(x, y, 18, 0, 7);
    ctx.moveTo(x - 30, y); ctx.lineTo(x - 10, y); ctx.moveTo(x + 10, y); ctx.lineTo(x + 30, y);
    ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 10); ctx.moveTo(x, y + 10); ctx.lineTo(x, y + 30);
    ctx.stroke();
  }
  ctx.restore();
}
function teclaTuto(ctx, x, y, nome, apertada, w) {
  w = w || 64;
  const h = 64, desce = apertada ? 5 : 0;
  ctx.save();
  ctx.fillStyle = "rgba(12,8,30,0.95)";
  retRedondo(ctx, x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 9, 14); ctx.fill();
  ctx.fillStyle = "#868e96";
  retRedondo(ctx, x - w / 2, y - h / 2 + 6, w, h, 12); ctx.fill();
  ctx.fillStyle = apertada ? "#ffd43b" : "#f1f3f5";
  retRedondo(ctx, x - w / 2, y - h / 2 + desce, w, h - 4, 12); ctx.fill();
  ctx.fillStyle = "#1b1e28"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "900 " + (nome.length > 2 ? 24 : 30) + "px Nunito, system-ui, sans-serif";
  ctx.fillText(nome, x, y - 2 + desce);
  ctx.restore();
}

// "NOVO!" pulando em cima da 1ª caixa/carta da 1ª partida (some quando a pessoa pega uma)
function etiquetaNovo(ctx, x, y, tm) {
  // v17.5: pílula amarela com setinha (o mesmo jeito da etiqueta "VOCÊ")
  const sobe = Math.abs(Math.sin(tm * 5)) * 8, txt = t("novo"), yy = y - 58 - sobe;
  ctx.font = "900 22" + FONTE;
  const w = ctx.measureText(txt).width + 22;
  ctx.lineJoin = "round";
  retRedondo(ctx, x - w / 2, yy - 15, w, 30, 15);
  ctx.moveTo(x - 8, yy + 13); ctx.lineTo(x + 8, yy + 13); ctx.lineTo(x, yy + 23); ctx.closePath();
  ctx.lineWidth = 5; ctx.strokeStyle = "rgba(12,8,30,0.9)"; ctx.stroke();
  ctx.fillStyle = "#ffd43b"; ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)"; retRedondo(ctx, x - w / 2 + 6, yy - 12, w - 12, 9, 4.5); ctx.fill();
  ctx.fillStyle = "#3a1c00"; ctx.textAlign = "center"; ctx.fillText(txt, x, yy + 8);
}

function chaoEmbaixo(M, b) {
  let y = 720;
  for (let i = 0; i < M.plats.length; i++) {
    const p = M.plats[i];
    if (b.x > p.x && b.x < p.x + p.w && p.y >= b.y && p.y < y) y = p.y;
  }
  return y;
}

// ---------- HUD ----------
function textoContorno(ctx, s, x, y, tam, cor, alinh, contorno) {
  ctx.font = "900 " + tam + "px Nunito, system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textAlign = alinh || "center";
  ctx.lineJoin = "round";
  ctx.lineWidth = contorno || Math.max(4, tam * 0.16);
  ctx.strokeStyle = "rgba(12,8,30,0.9)";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = cor || "#fff";
  ctx.fillText(s, x, y);
}

function retRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function nomeJogador(j, lado) {
  if (j.rival && lado === 2) return j.rival.d.nome.toUpperCase() + " · " + t("rival_n", j.rival.i + 1, RIVAIS.length);
  if (j.modo === "bot" || j.modo === "sobrevivencia") {
    const nivel = j.bots[1] ? j.bots[1].nivel : j.nivelBot;
    const estilo = j.bots[1] ? " · " + t("estilo_" + j.bots[1].estilo) : "";
    return lado === 1 ? t("voce") : t("bot") + " · " + t("nivel_curto", nivelBotTexto(nivel)) + estilo;
  }
  if (j.modo === "demo") return lado === 1 ? "BOT 1" : "BOT 2";
  return t("jogador_n", lado);
}

// v18: no modo rivais quem vence a rodada é o rival pelo nome (antes aparecia "O BOT VENCEU A RODADA")
function textoBotVenceuRodada(j) { return j.rival ? t("rival_venceu_rodada", j.rival.d.nome.toUpperCase()) : t("bot_venceu_rodada"); }

function desenharHud(ctx, j, M, L) {
  // em pé: o HUD fica acima da arena e maior (a tela do celular é estreita)
  const em = L.emPe;
  const k = em ? 1.45 : 1;
  const topo = L.hudTopo;
  const margem = em ? CONFIG.largura / 2 - CONFIG.largura / 2 / k + 12 : 20;
  const cx = CONFIG.largura / 2, cy = topo + 44;
  const tempo = Math.max(0, j.relogio);
  const dobro = j.fase === "luta" && tempo <= RODADA.danoDobro;
  ctx.save();
  if (em) { ctx.translate(cx, topo); ctx.scale(k, k); ctx.translate(-cx, -topo); }
  for (let i = 0; i < 2; i++) painelJogador(ctx, j, M.bolinhas[i], i === 0 ? margem : CONFIG.largura - margem, topo, i === 0 ? 1 : -1);
  desenharRelogio(ctx, j, M, cx, cy, tempo, dobro);
  ctx.restore();
  // fim do HUD na tela (o que aparece embaixo dele começa daqui)
  const hudFim = topo + (dobro ? 156 : 124) * k;

  const meio = mundoParaTela(0, FIS.altura * 0.42).y;
  // abertura da rodada (v17.5): faixa com o mapa; contra rival na 1ª rodada, o "VS" com os retratos
  if (j.fase === "intro") desenharAbertura(ctx, j, M, L, cx, meio);
  // textos do meio (LUTE, K.O., placar): em pé ficam 40% maiores (a tela do celular é estreita)
  const ke = em ? 1.4 : 1, largura = CONFIG.largura / ke - 60;   // largura que cabe (alguns idiomas são longos)
  ctx.save();
  if (em) { ctx.translate(cx, meio); ctx.scale(ke, ke); ctx.translate(-cx, -meio); }
  if (j.fase === "luta" && j.tempoFase < 0.8) {
    // LUTE!: entra grande com um clarão, "bate" no lugar e some subindo um pouco
    const tf = j.tempoFase, pop = tf < 0.12 ? 1.9 - tf / 0.12 * 1.0 : tf < 0.22 ? 0.9 + (tf - 0.12) / 0.1 * 0.1 : 1;
    if (tf < 0.32) {
      ctx.globalAlpha = (1 - tf / 0.32) * 0.5; ctx.fillStyle = "#fff8d6";
      estrelaN(ctx, cx, meio - 18, 110 + tf * 900, 60 + tf * 420, 12, tf * 2); ctx.fill();
    }
    ctx.globalAlpha = tf > 0.55 ? Math.max(0, (0.8 - tf) / 0.25) : 1;
    escalaEm(ctx, cx, meio, pop, function() { letreiro(ctx, t("lute"), cx, meio + 20 - Math.max(0, tf - 0.55) * 60, 104, "#ffd43b", largura); });
    ctx.globalAlpha = 1;
  } else if (j.fase === "fimRodada" && M.ko && M.ko.humano && j.tempoFase <= 1.0) {
    // golpe final do jogador: K.O.! num estouro de HQ (e PERFEITO! se não levou dano)
    const tk = j.tempoFase, pop = tk < 0.18 ? 1.6 - tk / 0.18 * 0.6 : 1 + 0.04 * Math.sin(tk * 18);
    ctx.globalAlpha = tk > 0.8 ? (1 - tk) / 0.2 : 1;
    ctx.save();
    ctx.translate(cx, meio - 30); ctx.rotate(-0.1 + tk * 0.12); ctx.scale(pop, pop);
    estouroHQ(ctx, 0, 0, 188, 13, "#ffd43b");
    estouroHQ(ctx, 0, 0, 150, 13, "#ff4d5e");
    ctx.restore();
    letreiro(ctx, "K.O.!", cx, meio + 10, Math.round(120 * pop), "#ffe066", largura);
    if (M.ko.perfeito) letreiro(ctx, t("perfeito"), cx, meio + 100, Math.round(44 * pop), "#69db7c", largura);
    ctx.globalAlpha = 1;
  } else if (j.fase === "fimRodada" && j.tempoFase > (M.ko && M.ko.humano ? 1.0 : 0.4)) {
    const v = j.vencedorRodada;
    const surv = j.modo === "sobrevivencia";
    const txt = surv ? (v === 1 ? t("onda_concluida", j.onda) : t("bot_venceu_rodada")) :
      !v ? t("empate") : j.modo === "bot" ? (v === 1 ? t("voce_venceu_rodada") : textoBotVenceuRodada(j)) : t("jogador_venceu_rodada", v);
    const tA = j.tempoFase - (M.ko && M.ko.humano ? 1.0 : 0.4);
    const pop = tA < 0.12 ? 0.4 + tA / 0.12 * 0.85 : tA < 0.26 ? 1.25 - (tA - 0.12) / 0.14 * 0.25 : 1;
    // quem joga venceu a rodada: raios girando atrás (contra o bot só quando é a pessoa; 2 jogadores: qualquer um)
    if (v && (v === 1 || j.modo === "2p")) raiosSol(ctx, cx, meio - 16, 260, v ? j.cores[v - 1] : "#ffd43b", performance.now() / 1000, Math.min(1, tA * 4) * 0.4);
    escalaEm(ctx, cx, meio - 16, pop, function() { letreiro(ctx, txt, cx, meio, 58, v ? j.cores[v - 1] : "#ffffff", largura); });
    if (!surv) placarGrande(ctx, j, cx, meio + 88, Math.min(1, tA * 5));
  } else if (j.fase === "fimPartida" && estado !== "continuar") {
    const v = j.vencedorPartida;
    const surv = j.modo === "sobrevivencia";
    const txt = surv ? t("fim_sobrevivencia", j.onda) : j.modo === "bot" ? (v === 1 ? t("voce_venceu") : j.rival ? t("rival_venceu", j.rival.d.nome.toUpperCase()) : t("bot_venceu")) : t("jogador_venceu", v);
    const esc = 1 + 0.06 * Math.sin(j.tempoFase * 6);
    const festa = v && (v === 1 || j.modo === "2p") && !surv;
    // v18.2: venceu o rival e ganha o acessório dele: um 🎁 sai do rival e voa até a bolinha da pessoa
    const ace = j.rival && v === 1 && j.rival.d.acessorio;
    if (ace && typeof Progresso !== "undefined" && !Progresso.temSkin(ace) && j.tempoFase > 0.5) {
      const k = Math.min(1, (j.tempoFase - 0.5) / 1.1), e = 1 - Math.pow(1 - k, 3);
      const a = mundoParaTela(M.bolinhas[1].x, M.bolinhas[1].y), b = mundoParaTela(M.bolinhas[0].x, M.bolinhas[0].y - 60);
      const gx = a.x + (b.x - a.x) * e, gy = a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * 220;
      const tg = (em ? 90 : 60) * (k < 1 ? 1 : 1 + 0.15 * Math.sin(j.tempoFase * 10));
      ctx.save(); ctx.font = tg + "px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🎁", gx, gy); ctx.restore();
    }
    const cor = v ? j.cores[v - 1] : "#ffd43b";
    if (festa) raiosSol(ctx, cx, meio - 20, 330, cor, performance.now() / 1000, Math.min(1, j.tempoFase * 3) * 0.45);
    const tp = j.tempoFase, pop = tp < 0.15 ? 0.5 + tp / 0.15 * 0.75 : tp < 0.3 ? 1.25 - (tp - 0.15) / 0.15 * 0.25 : 1;
    escalaEm(ctx, cx, meio - 20, pop, function() {
      // v17.5: o letreiro da partida vai numa fita na cor de quem venceu
      const tam = Math.round((surv ? 64 : 84) * esc);
      ctx.font = "900 " + tam + FONTE;
      const tw = Math.min(largura - 120, ctx.measureText(txt).width);
      fita(ctx, cx, meio - tam * 0.33, tw + 110, tam * 1.3, cor);
      letreiro(ctx, txt, cx, meio, tam, "#ffffff", largura - 120);
    });
    if (surv) textoContorno(ctx, t("recorde_onda", Math.max(save.recordeOnda, j.onda)), cx, meio + 74, 34, "#fff");
    else placarGrande(ctx, j, cx, meio + 112, Math.min(1, tp * 4));
  }
  ctx.restore();
  // K.O. do jogador: clarão branco bem rápido na tela toda
  if (j.fase === "fimRodada" && M.ko && M.ko.humano && j.tempoFase < 0.1) {
    ctx.globalAlpha = 0.3 * (1 - j.tempoFase / 0.1); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, CONFIG.largura, L.H); ctx.globalAlpha = 1;
  }
  // confete caindo na tela toda quando quem joga vence a partida
  if (j.fase === "fimPartida" && estado !== "continuar" && j.vencedorPartida && (j.vencedorPartida === 1 || j.modo === "2p") && j.modo !== "sobrevivencia") {
    confete(ctx, j.tempoFase, CONFIG.largura, typeof alturaTela !== "undefined" ? alturaTela : CONFIG.altura, [j.cores[j.vencedorPartida - 1], "#ffd43b", "#69db7c", "#4dabf7", "#ff8787", "#ffffff"]);
  }
  // 2 jogadores: lembrete dos controles nos primeiros segundos (contra o bot o tutorial é desenhado, sem texto)
  if (j.modo === "2p" && save.partidas <= 3 && j.rodada <= 2 && (j.fase === "intro" || j.fase === "luta" && j.tempoFase < 7)) {
    const texto = entrada.toque ? t("dica_2p_toque") : dicaTeclas(false);
    const linhas = texto.split("\n");
    const tam = em ? 34 : 24;
    const base = em ? L.dy + FIS.altura + 70 : L.dy + FIS.altura - 30 - (linhas.length - 1) * 30;
    ctx.globalAlpha = j.fase === "luta" ? Math.min(1, (7 - j.tempoFase) / 1.5) : 1;
    linhas.forEach(function(l, i) { textoContorno(ctx, l, cx, base + i * tam * 1.25, tam, "#fff"); });
    ctx.globalAlpha = 1;
  }
  // v16: prêmios da partida anterior (fluxo contínuo, sem a tela de fim): faixa que pula e some em ~4 s
  let topoFaixa = null;   // v17: os avisos de conquista sobem para cima da faixa (antes ficavam por cima dela)
  if (typeof faixaPremio !== "undefined" && faixaPremio && j !== faixaPremio.velho && estado === "jogo" &&
      !(j.escolha && j.fase === "intro" && j.rodada === 1)) {   // v18.2: espera a escolha da arma
    if (!faixaPremio.t0) faixaPremio.t0 = performance.now() / 1000;
    const tf = performance.now() / 1000 - faixaPremio.t0;
    // v17: com a melhoria grátis (destaque) a faixa fica mais tempo
    const ld = faixaPremio.destaque, dur = ld ? 5.5 : 4.2;
    if (tf > dur) faixaPremio = null;
    else {
      // 1ª linha: as moedas, grande; depois a melhoria grátis (v17) e o resto (skin, acessório, nível),
      // diminuindo a letra se não couber
      // v18: em pé o resto vai em 2 linhas e com letra maior (numa linha só ficava com ~6 px de verdade)
      const resto = faixaPremio.linhas.slice(1), metade = em && resto.length > 1 ? Math.ceil(resto.length / 2) : resto.length;
      const l1 = faixaPremio.linhas[0], l2 = resto.slice(0, metade).join("   "), l3 = resto.slice(metade).join("   ");
      const pop = tf < 0.15 ? 0.5 + tf / 0.15 * 0.65 : tf < 0.3 ? 1.15 - (tf - 0.15) / 0.15 * 0.15 : 1;
      ctx.save();
      const caber = function(txt, max) {
        ctx.font = "900 " + max + FONTE;
        return Math.min(max, max * (em ? 760 : 1040) / Math.max(1, ctx.measureText(txt).width));   // folga: emoji mede diferente em cada aparelho
      };
      const largura = function(txt, tam) { ctx.font = "900 " + tam + FONTE; return ctx.measureText(txt).width; };
      const t2 = l2 ? Math.min(caber(l2, em ? 30 : 26), l3 ? caber(l3, em ? 30 : 26) : 99) : 0, td = ld ? caber(ld, 32) : 0;
      const w = Math.max(280, (l2 ? largura(l2, t2) : 0) + 90, (l3 ? largura(l3, t2) : 0) + 90, (ld ? largura(ld, td) : 0) + 80);
      // a parte de baixo fica acima das bolinhas, que começam no chão (v17: a faixa mais alta cobria as duas);
      // em pé a câmera aproxima e as bolinhas ficam maiores: mais folga
      const h = 58 + (ld ? 42 : 0) + (l2 ? 36 : 0) + (l3 ? 36 : 0), esc = em ? 1.35 : 1;
      const yf = mundoParaTela(0, FIS.altura).y - (em ? 205 : 110) - h * (esc + 1) / 2;
      const yd = yf + 86, y2 = yf + (ld ? 122 : 80);
      ctx.globalAlpha = tf > dur - 0.6 ? Math.max(0, (dur - tf) / 0.6) : 1;
      topoFaixa = yf + h / 2 - h / 2 * esc;
      escalaEm(ctx, cx, yf + h / 2, pop * esc, function() {
        painelPremio(ctx, cx - w / 2, yf, w, h, tf);
        letreiro(ctx, l1, cx, yf + 44, 38, "#ffd43b");
        // a melhoria grátis pulsa (entra um pouco depois das moedas)
        if (ld) escalaEm(ctx, cx, yd - td * 0.35, tf < 0.45 ? Math.max(0.01, (tf - 0.15) / 0.3) * 1.2 : 1 + 0.06 * Math.sin(tf * 9), function() {
          letreiro(ctx, ld, cx, yd, Math.round(td), "#ff8787");
        });
        if (l2) textoContorno(ctx, l2, cx, y2, Math.round(t2), "#ffffff");
        if (l3) textoContorno(ctx, l3, cx, y2 + 36, Math.round(t2), "#ffffff");
      });
      ctx.restore();
    }
  }
  // missão / desafio / conquista completada durante a partida (v17.5: numa pílula escura, legível em qualquer mapa)
  // v18: um aviso por vez (antes até 3 empilhados por cima da luta), maior em pé, e só depois que a faixa de prêmios
  // some (a fila espera: Progresso.atualizarAvisos)
  const yAvisos = mundoParaTela(0, FIS.altura).y - (em ? 160 : 70);
  if (typeof Progresso !== "undefined" && topoFaixa === null) Progresso.avisos.slice(0, 1).forEach(function(a) {
    const k = Math.min(1, a.t * 5) * Math.min(1, (2.6 - a.t) * 3);
    if (k <= 0) return;
    const ta = em ? 40 : 26, y = yAvisos;
    ctx.globalAlpha = k;
    ctx.font = "900 " + ta + FONTE;
    const tw = ctx.measureText(a.texto).width;
    ctx.fillStyle = "rgba(12,8,30,0.72)"; retRedondo(ctx, cx - tw / 2 - 20, y - ta * 1.08, tw + 40, ta * 1.46, ta * 0.73); ctx.fill();
    textoContorno(ctx, a.texto, cx, y, ta, a.cor);
    ctx.globalAlpha = 1;
  });
  // carta que alguém acabou de pegar: logo abaixo do HUD (v17.5: antes ficava por cima do "dano em dobro")
  const uc = M.ultimaCarta;
  if (uc && M.t - uc.t < 1.8 && j.fase === "luta") {
    const idade = M.t - uc.t, kk = Math.min(1, idade * 5) * Math.min(1, (1.8 - idade) * 4);
    const kc = em ? 1.3 : 1, y = hudFim + 46 * kc;
    const nome = t("k_" + uc.id), desc = t("kd_" + uc.id), cor = CARTA[uc.id].cor;
    ctx.font = "900 34" + FONTE; const w1 = ctx.measureText(nome).width;
    ctx.font = "900 20" + FONTE; const w2 = ctx.measureText(desc).width;
    const W = 62 + Math.max(w1, w2), x0 = cx - W / 2;
    ctx.save();
    ctx.globalAlpha = kk;
    escalaEm(ctx, cx, y, kc * (idade < 0.12 ? 0.7 + idade / 0.12 * 0.3 : 1), function() {
      ctx.fillStyle = "rgba(12,8,30,0.74)"; retRedondo(ctx, x0 - 22, y - 42, W + 44, 84, 24); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = cor; retRedondo(ctx, x0 - 22, y - 42, W + 44, 84, 24); ctx.stroke();
      if (temArte.cartas) ArteCartas.desenharCarta(ctx, uc.id, x0 + 22, y, 1, M.t);
      textoContorno(ctx, nome, x0 + 62, y - 6, 34, cor, "left");
      textoContorno(ctx, desc, x0 + 62, y + 24, 20, "#fff", "left");
    });
    ctx.restore();
  }
}

// ---------- relógio (v17.5): medalhão com aro dourado, anel do tempo e a rodada numa pílula ----------
function baseRelogio() {
  if (baseRelogio.c) return baseRelogio.c;
  const R = 43, S = R * 2 + 8, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d"), m = S / 2;
  g.fillStyle = "rgba(12,8,30,0.9)"; g.beginPath(); g.arc(m, m + 2, R + 1, 0, 7); g.fill();          // sombra/contorno
  let gr = g.createLinearGradient(0, m - R, 0, m + R);
  gr.addColorStop(0, "#fff3bf"); gr.addColorStop(0.45, "#ffc93c"); gr.addColorStop(1, "#b8700f");
  g.fillStyle = gr; g.beginPath(); g.arc(m, m, R, 0, 7); g.fill();                                     // aro dourado
  gr = g.createLinearGradient(0, m - R, 0, m + R);
  gr.addColorStop(0, "#3a2f73"); gr.addColorStop(1, "#140f2e");
  g.fillStyle = gr; g.beginPath(); g.arc(m, m, R - 5, 0, 7); g.fill();                                 // miolo
  g.strokeStyle = "rgba(255,255,255,0.1)"; g.lineWidth = 7; g.beginPath(); g.arc(m, m, 32, 0, 7); g.stroke();   // trilho do anel
  g.fillStyle = "rgba(255,255,255,0.08)"; g.beginPath(); g.ellipse(m, m - 18, 24, 11, 0, 0, 7); g.fill(); // brilho
  return (baseRelogio.c = c);
}
function desenharRelogio(ctx, j, M, cx, cy, tempo, dobro) {
  const pulso = dobro ? 1 + 0.12 * Math.abs(Math.sin(M.t * 8)) : 1;
  const b = baseRelogio();
  escalaEm(ctx, cx, cy, dobro ? 1 + 0.04 * Math.abs(Math.sin(M.t * 8)) : 1, function() {
    ctx.drawImage(b, cx - b.width / 2, cy - b.height / 2);
    ctx.strokeStyle = dobro ? "#ff4d5e" : "#ffd43b";
    ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx, cy, 32, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (tempo / RODADA.luta)); ctx.stroke();
  });
  textoContorno(ctx, String(Math.ceil(tempo)), cx, cy + 12 * pulso, Math.round(34 * pulso), dobro ? "#ff8787" : "#fff");
  // rodada (ou onda) numa pílula embaixo
  const surv = j.modo === "sobrevivencia", txt = surv ? t("onda_n", j.onda) : t("rodada_n", j.rodada);
  ctx.font = "900 17" + FONTE;
  const tw = ctx.measureText(txt).width;
  ctx.fillStyle = "rgba(12,8,30,0.72)"; retRedondo(ctx, cx - tw / 2 - 14, cy + 50, tw + 28, 27, 13.5); ctx.fill();
  textoContorno(ctx, txt, cx, cy + 69, 17, surv ? "#ffd43b" : "#e9ecef", "center", 4);
  if (dobro) {
    const dd = t("dano_dobro"), ps = 1 + 0.07 * Math.abs(Math.sin(M.t * 8));
    ctx.font = "900 19" + FONTE;
    const wd = ctx.measureText(dd).width;
    escalaEm(ctx, cx, cy + 96, ps, function() {
      ctx.fillStyle = "#c92a3a"; retRedondo(ctx, cx - wd / 2 - 16, cy + 82, wd + 32, 30, 15); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(12,8,30,0.9)"; ctx.stroke();
      textoContorno(ctx, dd, cx, cy + 104, 19, "#fff", "center", 4);
    });
  }
}

// ---------- abertura da rodada (v17.5) ----------
// Faixa inclinada que abre e fecha com o nome do mapa; contra rival na 1ª rodada vira um "VS" com os retratos dos dois
// (com as skins e acessórios). Em pé com câmera vai para o céu vazio entre o HUD e a arena (não cobre a luta).
function desenharAbertura(ctx, j, M, L, cx, meio) {
  const em = L.emPe, esc = em ? 1.4 : 1;
  const dur = j.durIntro || (j.rodada === 1 ? RODADA.introPrimeira : RODADA.intro), tf = j.tempoFase;
  const vs = !!(j.rival && j.rodada === 1);
  const escolha = vs && j.escolha ? j.escolha : null;
  const cima = vs ? 95 : 60, baixo = vs ? (escolha ? 370 : j.lendaria ? 215 : 195) : (j.lendaria ? 145 : 112);   // quanto o bloco ocupa
  let y = meio;
  // (decidido no começo da abertura, para o bloco não pular quando um aviso some)
  if (j.lotadoRodada !== j.rodada) {
    j.lotadoRodada = j.rodada;
    const fp = typeof faixaPremio !== "undefined" ? faixaPremio : null;
    j.lotado = fp ? (fp.destaque ? 62 : 46) : (typeof Progresso !== "undefined" && Progresso.avisos.length ? 46 : 0);
  }
  if (!L.cam) y -= j.lotado * esc;
  if (L.cam) {
    const hudFim = L.hudTopo + 128 * 1.45;
    y = Math.min(meio, Math.max(hudFim + cima * esc + 24, (hudFim + camera.oy) / 2 - (baixo - cima) * esc / 2));
  }
  const abre = tf < 0.22 ? voltaMola(tf / 0.22) : 1, fecha = Math.min(1, Math.max(0, (dur - tf) / 0.2));
  const cor = temArte.cen && ArteCenarios.corDestaque ? ArteCenarios.corDestaque(M.cen.id) : "#ffd43b";
  const W = CONFIG.largura / esc + 120, h = vs ? 130 : 108;
  ctx.save();
  ctx.translate(cx, y); ctx.scale(esc, esc);
  ctx.globalAlpha = fecha;
  // faixa (abre de dentro para fora e fecha achatando)
  ctx.save(); ctx.scale(1, Math.max(0.02, abre * (0.4 + 0.6 * fecha)));
  faixaInclinada(ctx, W, h, j.cores[0], vs ? j.cores[1] : cor);
  ctx.restore();
  const entra = function(atraso) { return voltaMola(Math.min(1, Math.max(0, (tf - atraso) / 0.3))); };
  ctx.globalAlpha = fecha * Math.min(1, tf * 6);
  if (vs) {
    // retratos entrando dos lados
    for (let s = 0; s < 2; s++) {
      const lado = s ? 1 : -1, e = entra(0.03 + s * 0.07), px = lado * (335 + (1 - e) * 420);
      const sk = j.skins && j.skins[s];
      medalhaRetrato(ctx, px, 0, 56, j.cores[s], sk, s ? -1 : 1, s ? "bravo" : "normal");
    }
    textoCaber(ctx, t("rival_n", j.rival.i + 1, RIVAIS.length) + " · " + t("liga_n", nomeLiga(j.rival.liga)), 0, -14, 22, "#e9ecef", 500);
    escalaEm(ctx, 0, 20, 0.6 + 0.4 * entra(0.08), function() { letreiro(ctx, j.rival.d.nome.toUpperCase(), 0, 48, 72, j.cores[1], 500); });
    // medalhão "VS" em cima da faixa
    const ev = entra(0.14);
    if (ev > 0.01) escalaEm(ctx, 0, -h / 2, ev, function() {
      ctx.fillStyle = "rgba(12,8,30,0.95)"; ctx.beginPath(); ctx.arc(0, -h / 2 + 2, 31, 0, 7); ctx.fill();
      ctx.fillStyle = "#ff4d5e"; ctx.beginPath(); ctx.arc(0, -h / 2, 27, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.ellipse(0, -h / 2 - 11, 17, 8, 0, 0, 7); ctx.fill();
      letreiro(ctx, "VS", 0, -h / 2 + 10, 28, "#ffffff");
    });
    // poder dos dois (v13) embaixo de cada retrato (na partida treino os dois são iguais: não mostra)
    const P = typeof Poder !== "undefined" ? Poder : null;
    const pJ = P ? P.valor(P.doJogador()) : 100, pR = P ? P.valor(P.doRival(j.rival.i, j.rival.liga)) : 100;
    if (!j.treino && P && (pJ > 100 || pR > 100)) {   // v16: 100 x 100 não diz nada
      letreiro(ctx, "⚡" + pJ, -335, 98, 30, j.cores[0]);
      letreiro(ctx, "⚡" + pR, 335, 98, 30, j.cores[1]);
    }
    // mapa e o que ele tem de diferente numa linha só; prêmio numa pílula dourada
    linhaMapa(ctx, M.cen.id, cor, 0, 100, 30, 24, 520);
    const pr = textoPremioRival(j.rival.i, j.rival.liga);
    ctx.font = "900 24" + FONTE;
    const wp = Math.min(620, ctx.measureText(pr).width);
    ctx.fillStyle = "rgba(12,8,30,0.78)"; retRedondo(ctx, -wp / 2 - 20, 118, wp + 40, 40, 20); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,212,59,0.8)"; ctx.stroke();
    textoCaber(ctx, pr, 0, 146, 24, "#ffd43b", 620);
    if (j.lendaria) textoContorno(ctx, "✨ " + t("lendaria") + " ✨", 0, 192, 26, "#ffd43b");
    else trilhaRivais(ctx, j, 0, 180, entra(0.2));
    if (escolha) desenharEscolha(ctx, j, escolha, cx, y, esc, entra(0.25), tf);
  } else {
    const surv = j.modo === "sobrevivencia";
    textoContorno(ctx, surv ? t("onda_n", j.onda) : t("rodada_n", j.rodada), 0, -16, 24, surv ? "#ffd43b" : "#e9ecef", "center", 5);
    escalaEm(ctx, 0, 18, 0.6 + 0.4 * entra(0.04), function() { letreiro(ctx, t("c_" + M.cen.id), 0, 40, 60, cor, 760); });
    textoCaber(ctx, t("r_" + M.cen.id), 0, 96, 28, "#fff", W - 200);
    if (j.lendaria) textoContorno(ctx, "✨ " + t("lendaria") + " ✨", 0, 136, 26, "#ffd43b");
  }
  ctx.restore();
  // v18.2: 2 jogadores em pé a arena fica minúscula: sugere deitar o celular (só ícone, sem texto)
  if (j.modo === "2p" && em) {
    const yy = L.hudTopo + 330, gira = Math.sin(tf * 4) * 0.5;
    ctx.save(); ctx.globalAlpha = fecha;
    ctx.fillStyle = "rgba(12,8,30,0.85)"; ctx.beginPath(); ctx.arc(cx, yy, 90, 0, 7); ctx.fill();
    ctx.translate(cx, yy); ctx.rotate(-gira * Math.PI / 2);
    ctx.font = "110px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("📱", 0, 4);
    ctx.restore();
    textoContorno(ctx, "↻", cx + 92, yy - 60, 70, "#ffd43b");
  }
}
// v18.2: trilha dos 10 rivais na abertura VS (vencidos verdes, o atual dourado; 5 e 10 dão baú)
function trilhaRivais(ctx, j, x, y, k) {
  if (k <= 0.01) return;
  const n = RIVAIS.length, p = 34, x0 = x - p * (n - 1) / 2, at = j.rival.i;
  ctx.save(); ctx.globalAlpha *= k;
  ctx.lineWidth = 6; ctx.strokeStyle = "rgba(12,8,30,0.8)"; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + p * (n - 1), y); ctx.stroke();
  ctx.strokeStyle = "#51cf66"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + p * at, y); ctx.stroke();
  for (let i = 0; i < n; i++) {
    const cxx = x0 + p * i, r = i === at ? 12 : (i === 4 || i === 9) ? 9 : 7;
    ctx.fillStyle = "rgba(12,8,30,0.9)"; ctx.beginPath(); ctx.arc(cxx, y, r + 3, 0, 7); ctx.fill();
    ctx.fillStyle = i < at ? "#51cf66" : i === at ? "#ffd43b" : (i === 4 || i === 9) ? "#b197fc" : "#495057";
    ctx.beginPath(); ctx.arc(cxx, y, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}
// v18.2: as 3 armas para escolher (toque/clique ou 1/2/3); guarda os retângulos na tela para o toque (telas.js)
function desenharEscolha(ctx, j, es, cx, y0, esc, k, tf) {
  if (k <= 0.01) return;
  const cores = ["#ced4da", "#b197fc", "#ffd43b"], bw = 150, bh = 128, gap = 172, yb = 300;
  ctx.save(); ctx.globalAlpha *= k;
  if (es.sel === null) {
    letreiro(ctx, t("escolha_arma"), 0, 222, 34, "#ffffff", 600);
    const resta = Math.max(0, 1 - tf / 3.6);   // barrinha do tempo
    ctx.fillStyle = "rgba(12,8,30,0.8)"; retRedondo(ctx, -120, 236, 240, 8, 4); ctx.fill();
    ctx.fillStyle = "#ffd43b"; retRedondo(ctx, -120, 236, 240 * resta, 8, 4); ctx.fill();
  }
  es.rects = [];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * gap, sel = es.sel === i, fora = es.sel !== null && !sel;
    const s = sel ? 1.15 : fora ? 0.85 : 1 + 0.04 * Math.sin(tf * 7 + i);
    es.rects.push({ x: cx + (x - bw / 2) * esc, y: y0 + (yb - bh / 2) * esc, w: bw * esc, h: bh * esc });
    ctx.save(); ctx.translate(x, yb); ctx.scale(s, s); if (fora) ctx.globalAlpha *= 0.35;
    if (i === 2 || sel) { ctx.fillStyle = cores[i]; ctx.globalAlpha *= 0.35; ctx.beginPath(); ctx.arc(0, 0, bw * 0.62, 0, 7); ctx.fill(); ctx.globalAlpha /= 0.35; }
    ctx.fillStyle = "rgba(16,11,42,0.94)"; retRedondo(ctx, -bw / 2, -bh / 2, bw, bh, 18); ctx.fill();
    ctx.lineWidth = sel ? 6 : 4; ctx.strokeStyle = cores[i]; ctx.stroke();
    if (temArte.armas) ArteArmas.icone(ctx, es.armas[i], 0, -12, 78);
    textoCaber(ctx, t("a_" + es.armas[i]), 0, 50, 20, cores[i], bw - 14);
    if (!entrada.toque) textoContorno(ctx, String(i + 1), -bw / 2 + 16, -bh / 2 + 22, 20, "#fff");
    ctx.restore();
  }
  ctx.restore();
}
// texto com contorno que diminui a letra se passar de maxW (idiomas longos)
function textoCaber(ctx, s, x, y, tam, cor, maxW) {
  ctx.font = "900 " + tam + FONTE;
  const w = ctx.measureText(s).width;
  textoContorno(ctx, s, x, y, w > maxW ? Math.max(12, Math.floor(tam * maxW / w)) : tam, cor, "center", 5);
}
// faixa inclinada escura com as cores dos dois nas pontas e filetes dourados
function faixaInclinada(ctx, W, h, corE, corD) {
  const s = h * 0.2;
  const forma = function() {
    ctx.beginPath(); ctx.moveTo(-W / 2 + s, -h / 2); ctx.lineTo(W / 2 + s, -h / 2); ctx.lineTo(W / 2 - s, h / 2); ctx.lineTo(-W / 2 - s, h / 2); ctx.closePath();
  };
  const a = ctx.globalAlpha;
  forma(); ctx.fillStyle = "rgba(16,11,42,0.86)"; ctx.fill();
  const g = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
  g.addColorStop(0, corE); g.addColorStop(0.32, "rgba(16,11,42,0)"); g.addColorStop(0.68, "rgba(16,11,42,0)"); g.addColorStop(1, corD);
  ctx.globalAlpha = a * 0.45; ctx.fillStyle = g; ctx.fill();
  ctx.globalAlpha = a;
  ctx.fillStyle = "#ffd43b";
  ctx.fillRect(-W / 2, -h / 2 - 2, W + s * 2, 4); ctx.fillRect(-W / 2 - s * 2, h / 2 - 2, W + s * 2, 4);
}
// retrato num medalhão (abertura do rival)
function medalhaRetrato(ctx, x, y, R, cor, sk, olha, expr) {
  ctx.fillStyle = "rgba(12,8,30,0.92)"; ctx.beginPath(); ctx.arc(x, y + 3, R + 5, 0, 7); ctx.fill();
  ctx.fillStyle = tom(cor, -0.62); ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.beginPath(); ctx.arc(x, y - R * 0.25, R * 0.8, 0, 7); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = cor; ctx.beginPath(); ctx.arc(x, y, R - 1, 0, 7); ctx.stroke();
  const rt = retrato(cor, sk && sk.corpo, sk && sk.acessorio, expr, Math.round(R * 0.66), olha);
  ctx.drawImage(rt.c, Math.round(x - rt.m), Math.round(y - rt.m - rt.dy + R * 0.08));
}
// "Campo  Clássico: só lutar!": nome do mapa na cor dele e a regra em branco, na mesma linha (diminui se não couber)
function linhaMapa(ctx, id, cor, x, y, t1, t2, maxW) {
  const a = t("c_" + id), b = t("r_" + id);
  ctx.font = "900 " + t1 + FONTE; const w1 = ctx.measureText(a).width;
  ctx.font = "900 " + t2 + FONTE; const w2 = ctx.measureText(b).width;
  const tot = w1 + 18 + w2, e = tot > maxW ? maxW / tot : 1;
  escalaEm(ctx, x, y - 10, e, function() {
    textoContorno(ctx, a, x - tot / 2, y, t1, cor, "left");
    textoContorno(ctx, b, x - tot / 2 + w1 + 18, y, t2, "#fff", "left");
  });
}
// painel da faixa de prêmios: degradê roxo, borda dourada e um reflexo passando
function painelPremio(ctx, x, y, w, h, tf) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "rgba(70,48,140,0.95)"); g.addColorStop(1, "rgba(24,16,58,0.95)");
  retRedondo(ctx, x, y, w, h, 24);
  ctx.lineWidth = 7; ctx.strokeStyle = "rgba(12,8,30,0.9)"; ctx.stroke();
  ctx.fillStyle = g; ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.09)"; ctx.fillRect(x, y, w, h * 0.38);
  const px = x - 120 + ((tf * 520) % (w + 400));
  ctx.globalAlpha *= 0.16; ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + 60, y); ctx.lineTo(px + 10, y + h); ctx.lineTo(px - 50, y + h); ctx.closePath(); ctx.fill();
  ctx.restore();
  retRedondo(ctx, x + 3, y + 3, w - 6, h - 6, 21);
  ctx.lineWidth = 3; ctx.strokeStyle = "#ffd43b"; ctx.stroke();
}

// ---------- ajudantes de "juice" (v14) ----------
// desenha f() com escala em volta de (x, y) (textos que "pulam")
function escalaEm(ctx, x, y, esc, f) {
  if (esc === 1) { f(); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(esc, esc); ctx.translate(-x, -y); f(); ctx.restore();
}
// estrela de 5 pontas
function estrela5(ctx, x, y, r, rIn) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? rIn : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
// estrela de n pontas (clarão do LUTE!)
function estrelaN(ctx, x, y, r, rIn, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + i * Math.PI / n, rr = i % 2 ? rIn : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// ---------- letreiros de arcade (v17.5) ----------
const FONTE = "px Nunito, system-ui, -apple-system, 'Segoe UI', sans-serif";
// tom(cor, q): q > 0 clareia (até o branco), q < 0 escurece (até o roxo-escuro dos contornos); guardado por cor
const cacheTom = {};
function tom(cor, q) {
  const k = cor + q;
  const s = cacheTom[k];
  if (s) return s;
  if (typeof cor !== "string" || cor.charAt(0) !== "#") return cor;
  let h = cor.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const v = parseInt(h, 16), c = [(v >> 16) & 255, (v >> 8) & 255, v & 255], alvo = q > 0 ? [255, 255, 255] : [12, 8, 30], a = Math.abs(q);
  return (cacheTom[k] = "rgb(" + c.map(function(x, i) { return Math.round(x + (alvo[i] - x) * a); }).join(",") + ")");
}
// texto grande (LUTE!, K.O.!, vitória): contorno grosso, "espessura" 3D embaixo e degradê claro em cima.
// maxW: a letra diminui se o texto não couber (alguns idiomas são bem mais longos). Devolve o tamanho usado.
function letreiro(ctx, s, x, y, tam, cor, maxW, alinh) {
  ctx.font = "900 " + tam + FONTE;
  if (maxW) { const w = ctx.measureText(s).width; if (w > maxW) { tam = Math.max(14, Math.floor(tam * maxW / w)); ctx.font = "900 " + tam + FONTE; } }
  ctx.textAlign = alinh || "center"; ctx.lineJoin = "round";
  const d = Math.max(2, Math.round(tam * 0.075));
  ctx.lineWidth = Math.max(5, tam * 0.2); ctx.strokeStyle = "rgba(12,8,30,0.95)";
  ctx.strokeText(s, x, y + d);
  ctx.strokeText(s, x, y);
  ctx.fillStyle = tom(cor, -0.45); ctx.fillText(s, x, y + d);
  const g = ctx.createLinearGradient(0, y - tam * 0.74, 0, y);
  g.addColorStop(0, tom(cor, 0.62)); g.addColorStop(0.5, cor); g.addColorStop(1, tom(cor, -0.12));
  ctx.fillStyle = g; ctx.fillText(s, x, y);
  return tam;
}
// mola (entra passando um pouco do ponto e volta)
function voltaMola(u) { const c = 1.70158, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; }
// estouro de HQ (atrás do K.O.!): estrela de pontas irregulares com contorno escuro
function estouroHQ(ctx, x, y, r, n, cor) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = i * Math.PI / n, rr = i % 2 ? r * 0.7 : r * (0.86 + 0.14 * ((i * 7) % 5) / 4);
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = "rgba(12,8,30,0.95)"; ctx.stroke();
  ctx.fillStyle = cor; ctx.fill();
}
// fita de campeão atrás do letreiro da partida (pontas dobradas para trás)
function fita(ctx, cx, y, w, h, cor) {
  const p = h * 0.62, dobra = h * 0.26, esc = tom(cor, -0.35), dob = tom(cor, -0.6);
  ctx.lineJoin = "round";
  for (let s = -1; s <= 1; s += 2) {
    const xi = cx + s * (w / 2 - p * 0.4), xf = cx + s * (w / 2 + p);
    ctx.beginPath();
    ctx.moveTo(xi, y - h / 2 + dobra); ctx.lineTo(xf, y - h / 2 + dobra); ctx.lineTo(xf - s * p * 0.42, y + dobra * 0.5);
    ctx.lineTo(xf, y + h / 2 + dobra); ctx.lineTo(xi, y + h / 2 + dobra); ctx.closePath();
    ctx.lineWidth = 6; ctx.strokeStyle = "rgba(12,8,30,0.95)"; ctx.stroke();
    ctx.fillStyle = esc; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + s * w / 2, y + h / 2); ctx.lineTo(xi, y + h / 2 + dobra); ctx.lineTo(xi, y + h / 2); ctx.closePath();
    ctx.fillStyle = dob; ctx.fill();
  }
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, tom(cor, 0.3)); g.addColorStop(0.5, cor); g.addColorStop(1, tom(cor, -0.25));
  retRedondo(ctx, cx - w / 2, y - h / 2, w, h, 10);
  ctx.lineWidth = 6; ctx.strokeStyle = "rgba(12,8,30,0.95)"; ctx.stroke();
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(cx - w / 2 + 8, y - h / 2 + 6, w - 16, h * 0.16);
}
// raios girando atrás de um texto de vitória
function raiosSol(ctx, x, y, r, cor, tempo, alfa) {
  if (alfa <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tempo * 0.5);
  ctx.globalAlpha *= alfa;
  const g = ctx.createRadialGradient(0, 0, 20, 0, 0, r);
  g.addColorStop(0, cor); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, -r * 0.14); ctx.lineTo(r, r * 0.14); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// confete caindo (posição calculada pelo tempo: não guarda estado)
function confete(ctx, tempo, largura, altura, cores) {
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const r1 = (Math.sin(i * 12.9898) * 43758.5453) % 1, r2 = (Math.sin(i * 78.233) * 12543.123) % 1, r3 = (Math.sin(i * 39.425) * 24634.633) % 1;
    const a = Math.abs(r1), b = Math.abs(r2), c = Math.abs(r3);
    const atraso = c * 0.6, tt = tempo - atraso;
    if (tt <= 0) continue;
    const y = -30 + tt * (260 + b * 260), x = a * largura + Math.sin(tt * (2 + b * 3) + i) * 30;
    if (y > altura + 30) continue;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tt * (4 + c * 8) + i);
    ctx.scale(1, Math.cos(tt * (6 + a * 6)));
    ctx.fillStyle = cores[i % cores.length];
    ctx.fillRect(-7, -4, 14, 8);
    ctx.restore();
  }
  ctx.restore();
}

// v14: no fim da rodada o placar já mostra o ponto novo (antes só somava depois do letreiro), e ele "pula"
function pontosNaTela(j, lado) {
  const M = j.M, v = j.vencedorRodada;
  const ja = j.fase === "fimRodada" && v === lado && j.modo !== "sobrevivencia" && M && j.tempoFase > (M.ko && M.ko.humano ? 1.0 : 0.4);
  return j.pontos[lado - 1] + (ja ? 1 : 0);
}
// placar grande do fim da rodada/partida: os pontos na cor de cada um, numa pílula escura (v17.5)
function placarGrande(ctx, j, cx, y, alfa) {
  const a = pontosNaTela(j, 1), b = pontosNaTela(j, 2);
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * (alfa === undefined ? 1 : alfa);
  ctx.fillStyle = "rgba(12,8,30,0.72)"; retRedondo(ctx, cx - 104, y - 50, 208, 64, 32); ctx.fill();
  letreiro(ctx, String(a), cx - 52, y, 50, j.cores[0]);
  letreiro(ctx, String(b), cx + 52, y, 50, j.cores[1]);
  textoContorno(ctx, "–", cx, y - 6, 40, "#fff");
  ctx.globalAlpha = ga;
}

// ---------- painel de cada um no HUD (v17.5) ----------
// Retrato da bolinha (com skin e acessório; a cara muda: dor, medo, feliz) num medalhão, nome, barra de vida com
// degradê, brilho e marcas, estrelas do placar e a arma com a munição. Ocupa a mesma largura de antes (380).
const gradBarra = {};
function degradeBarra(ctx, cor, by, bh) {
  const k = cor + "|" + by + "|" + bh;
  let g = gradBarra[k];
  if (!g) {
    g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, tom(cor, 0.42)); g.addColorStop(0.45, cor); g.addColorStop(1, tom(cor, -0.28));
    gradBarra[k] = g;
  }
  return g;
}
function painelJogador(ctx, j, b, x, y, lado) {
  const w = 380, av = 31;
  const x0 = lado > 0 ? x : x - w;
  const agora = performance.now() / 1000;
  // levou dano: o painel treme um pouco (v14)
  const treme = b.dor > 0 ? Math.sin(agora * 90) * 5 * (b.dor / 0.35) : 0;
  const vida = Math.max(0, b.vida) / 100;
  b.vidaLenta = b.vidaLenta === undefined ? vida : Math.max(vida, b.vidaLenta - 0.012);
  const pouca = vida > 0 && vida < 0.25;
  ctx.save();
  ctx.translate(treme, 0);
  // retrato no medalhão
  const ax = lado > 0 ? x0 + av + 3 : x0 + w - av - 3, ay = y + 42;
  let ex = "normal";
  if (!b.viva) ex = "dor";
  else if ((j.fase === "fimRodada" && j.vencedorRodada === b.lado) || (j.fase === "fimPartida" && j.vencedorPartida === b.lado)) ex = "feliz";
  else if (b.dor > 0) ex = "dor";
  else if (b.vida < 25) ex = "medo";
  ctx.fillStyle = "rgba(12,8,30,0.88)"; ctx.beginPath(); ctx.arc(ax, ay + 2, av + 4, 0, 7); ctx.fill();
  ctx.fillStyle = tom(b.cor, -0.6); ctx.beginPath(); ctx.arc(ax, ay, av, 0, 7); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = pouca ? "rgba(255,77,94," + (0.6 + 0.4 * Math.sin(agora * 10)) + ")" : b.cor;
  ctx.beginPath(); ctx.arc(ax, ay, av - 1, 0, 7); ctx.stroke();
  const sk = j.skins && j.skins[b.lado - 1];
  const rt = retrato(b.cor, sk && sk.corpo, sk && sk.acessorio, ex, 22, lado);
  ctx.drawImage(rt.c, Math.round(ax - rt.m), Math.round(ay - rt.m - rt.dy + 3));
  // barra de vida (com a parte perdida sumindo devagar)
  const bw = w - av * 2 - 16, bx = lado > 0 ? x0 + av * 2 + 16 : x0;
  const by = y + 30, bh = 24;
  const nome = nomeJogador(j, b.lado);
  ctx.font = "900 21" + FONTE;
  const tn = Math.max(13, Math.min(21, Math.floor(21 * (bw - 8) / Math.max(1, ctx.measureText(nome).width))));   // nome longo: letra menor
  textoContorno(ctx, nome, lado > 0 ? bx + 4 : bx + bw - 4, y + 22, tn, b.cor, lado > 0 ? "left" : "right", 5);
  ctx.fillStyle = "rgba(12,8,30,0.85)";
  retRedondo(ctx, bx - 4, by - 4, bw + 8, bh + 8, 15); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = pouca ? "rgba(255,77,94," + (0.5 + 0.5 * Math.sin(agora * 10)) + ")" : "rgba(255,255,255,0.24)";
  ctx.stroke();
  const fill = function(f, cor) {
    if (f <= 0) return;
    ctx.fillStyle = cor;
    const ww = Math.max(bh * 0.5, bw * Math.min(1, f));
    retRedondo(ctx, lado > 0 ? bx : bx + bw - ww, by, ww, bh, 11); ctx.fill();
  };
  fill(b.vidaLenta, b.vidaLenta - vida > 0.002 ? "#fff1c1" : "#ffffff");
  fill(vida, degradeBarra(ctx, pouca ? "#ff4d5e" : b.cor, by, bh));
  if (b.escudoHP > 0 && b.efeitos.escudo > 0) fill(b.escudoHP / 100, "rgba(77,171,247,0.75)");
  // acabou de apanhar: a barra pisca branca por um instante
  if (b.dor > 0.24 && vida > 0) { ctx.globalAlpha = Math.min(1, (b.dor - 0.24) / 0.11) * 0.7; fill(vida, "#ffffff"); ctx.globalAlpha = 1; }
  // brilho em cima e marcas a cada 25%
  if (vida > 0) {
    const ww = bw * vida;
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    retRedondo(ctx, (lado > 0 ? bx : bx + bw - ww) + 5, by + 3, Math.max(0, ww - 10), bh * 0.3, 4); ctx.fill();
  }
  ctx.fillStyle = "rgba(12,8,30,0.4)";
  for (let q = 1; q < 4; q++) ctx.fillRect(Math.round(bx + bw * q / 4 - 1), by + 3, 2, bh - 6);
  ctx.restore();
  // pontos da partida: estrelas; a que acabou de ser ganha "pula" (v14)
  const meus = pontosNaTela(j, b.lado);
  const pp = j.popPontos || (j.popPontos = [{ n: 0, t: 0 }, { n: 0, t: 0 }]), reg = pp[b.lado - 1];
  if (meus > reg.n) { reg.n = meus; reg.t = agora; } else if (meus < reg.n) reg.n = meus;
  const sy = by + bh + 20;
  for (let i = 0; i < j.alvo && i < 9 && j.modo !== "sobrevivencia"; i++) {
    const px = lado > 0 ? bx + 12 + i * 29 : bx + bw - 12 - i * 29;
    const cheia = i < meus, nova = cheia && i === meus - 1 && agora - reg.t < 0.6;
    const u = nova ? (agora - reg.t) / 0.6 : 1;
    const esc = nova ? 1 + 0.9 * Math.sin(u * Math.PI) * (1 - u * 0.5) : 1;
    ctx.save();
    ctx.translate(px, sy); ctx.scale(esc, esc); if (nova) ctx.rotate((1 - u) * 1.2);
    estrela5(ctx, 0, 1.5, 12.5, 5.8);
    ctx.fillStyle = "rgba(12,8,30,0.85)"; ctx.fill();                     // sombra embaixo
    estrela5(ctx, 0, 0, 12.5, 5.8);
    ctx.fillStyle = cheia ? "#ffd43b" : "rgba(12,8,30,0.6)";
    ctx.fill();
    ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.strokeStyle = cheia ? "#b35c00" : "rgba(255,255,255,0.45)"; ctx.stroke();
    if (cheia) { estrela5(ctx, -1.5, -2, 6, 2.8); ctx.fillStyle = "#fff3bf"; ctx.fill(); }
    ctx.restore();
  }
  // arma e munição
  const ix = lado > 0 ? bx + bw - 50 : bx + 50, iy = by + bh + 22;
  if (temArte.armas) ArteArmas.icone(ctx, b.arma, ix, iy, 34);
  const mun = b.municao === Infinity || b.efeitos.municao > 0 ? "∞" : String(b.municao);
  textoContorno(ctx, mun, lado > 0 ? ix + 24 : ix - 24, iy + 8, 20, b.municao === 0 ? "#ff8787" : "#fff", lado > 0 ? "left" : "right");
  // cartas ativas
  let n = 0;
  for (const id in b.efeitos) {
    if (!(b.efeitos[id] > 0) || !CARTA[id] || !CARTA[id].duracao) continue;
    const cx2 = lado > 0 ? bx + 12 + (j.alvo * 29) + 10 + n * 30 : bx + bw - 12 - (j.alvo * 29) - 10 - n * 30;
    if (temArte.cartas) ArteCartas.icone(ctx, id, cx2, iy, 24);
    n++;
  }
}

// retrato da bolinha (HUD e abertura do rival): pronto num sprite por cor + skin + acessório + cara + tamanho
const retratos = {};
let nRetratos = 0;
function retrato(cor, corpo, acess, expr, r, olha) {
  const k = cor + "|" + (corpo || "") + "|" + (acess || "") + "|" + expr + "|" + r + "|" + olha;
  let s = retratos[k];
  if (s) return s;
  if (nRetratos > 80) { for (const q in retratos) delete retratos[q]; nRetratos = 0; }
  const S = Math.ceil(r * 3.4), c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d"), dy = Math.round(r * 0.3);
  if (temArte.bola) {
    ArteBolinha.desenhar(g, { x: S / 2, y: S / 2 + dy, r: r, cor: cor, olharX: olha * 0.55, olharY: 0.12, expressao: expr, piscar: 0, t: 0.35,
      escalaX: 1, escalaY: 1, flash: 0, fantasma: 0, skin: corpo || "classico", acessorio: acess || "nenhum" });
  } else { g.fillStyle = cor; g.beginPath(); g.arc(S / 2, S / 2 + dy, r, 0, 7); g.fill(); }
  nRetratos++;
  return (retratos[k] = { c: c, m: S / 2, dy: dy });
}

// ---------- queda de braço ----------
function desenharQueda(ctx, j, H) {
  const q = j.queda;
  const M = j.M;
  const d1 = M.bolinhas[0].desc || {}, d2 = M.bolinhas[1].desc || {};
  [d1, d2].forEach(function(d, i) { const b = M.bolinhas[i]; d.cor = b.cor; d.r = 34; d.expressao = q.vencedor ? (q.vencedor === i + 1 ? "feliz" : "dor") : "esforco"; d.flash = 0; d.escalaX = 1; d.escalaY = 1; d.fantasma = 0; d.t = j.tempoFase; });
  const toque = entrada.toque;
  const q2 = {
    b1: d1, b2: d2, pos: q.pos, t: j.tempoFase, toques1: q.toques1, toques2: q.toques2, vencedor: q.vencedor,
    nome1: nomeJogador(j, 1), nome2: nomeJogador(j, 2),
    dica1: j.modo !== "2p" ? (toque ? t("queda_dica_toque") : t("queda_clique", nomeTecla(entrada.teclas()[1].tiro[0])))
                           : (toque ? t("queda_dica_toque_esq") : t("queda_aperte", nomeTecla(entrada.teclas()[1].tiro[0]))),
    dica2: j.modo !== "2p" ? "" : (toque ? t("queda_dica_toque_dir") : t("queda_aperte", nomeTecla(entrada.teclas()[2].tiro[0])))
  };
  if (temArte.queda) ArteQueda.desenhar(ctx, q2, CONFIG.largura, H);
  else {
    ctx.fillStyle = "rgba(10,8,25,0.85)"; ctx.fillRect(0, 0, CONFIG.largura, H);
    ctx.fillStyle = j.cores[0]; ctx.fillRect(140, H / 2 - 20, (q.pos + 1) / 2 * 1000, 40);
  }
  const cx = CONFIG.largura / 2;
  if (j.tempoFase < RODADA.quedaIntro && !q.vencedor) {
    const k = Math.min(1, j.tempoFase * 3);
    ctx.globalAlpha = k;
    textoContorno(ctx, t("queda"), cx, H * 0.22, 70, "#ffd43b");
    textoContorno(ctx, t("queda_sub"), cx, H * 0.22 + 46, 28, "#fff");
    ctx.globalAlpha = 1;
  } else if (!q.vencedor) {
    textoContorno(ctx, Math.max(0, Math.ceil(RODADA.quedaMax - q.t)).toString(), cx, H * 0.2, 54, "#fff");
  } else {
    const txt = j.modo === "bot" ? (q.vencedor === 1 ? t("voce_venceu_rodada") : textoBotVenceuRodada(j)) : t("jogador_venceu_rodada", q.vencedor);
    textoContorno(ctx, txt, cx, H * 0.2, 54, j.cores[q.vencedor - 1]);
  }
}

// ---------- controles de toque (desenho dos analógicos e da área de tiro) ----------
// v17.5: cada controle tem um ícone (setas, mira, seta para cima) além do nome; o desenho fica pronto num sprite
// (por quadro é só um drawImage por controle). O analógico em uso tem uma bolinha com brilho na cor de quem joga.
function desenharControlesToque(ctx, j, H, L) {
  if (!entrada.toque || j.fase === "queda" || j.fase === "fimPartida") return;
  ctx.save();
  const emPe = L.emPe;
  const k = emPe ? 1.8 : 1;
  const yBaixo = L.yBaixo;          // analógicos (andar / mirar)
  const yCima = L.yPulo;            // botão de pulo (em pé com câmera: logo acima do de mira, perto do polegar)
  const zonas = j.modo === "2p"
    ? [{ x: 0.13, y: yBaixo, tipo: "stick", j: 1 }, { x: 0.39, y: yBaixo, tipo: "mira", j: 1 }, { x: 0.39, y: yCima, tipo: "pulo", j: 1 },
       { x: 0.61, y: yBaixo, tipo: "mira", j: 2 }, { x: 0.61, y: yCima, tipo: "pulo", j: 2 }, { x: 0.87, y: yBaixo, tipo: "stick", j: 2 }]
    : [{ x: 0.14, y: yBaixo, tipo: "stick", j: 1 }, { x: 0.86, y: yBaixo, tipo: "mira", j: 1 }, { x: 0.86, y: yCima, tipo: "pulo", j: 1 }];
  const abertos = entrada.analogicos();
  const nomes = { stick: "toque_mover", mira: "toque_mira", pulo: "toque_pulo" };
  zonas.forEach(function(z) {
    const cor = j.cores[z.j - 1];
    const x = z.x * CONFIG.largura;
    const usando = abertos.some(function(d) { return d.jogador === z.j && d.tipo === z.tipo; });
    const r = Math.round((z.tipo === "stick" ? 84 : z.tipo === "mira" ? 76 : 62) * k);
    const s = spriteToque(z.tipo, cor, r, t(nomes[z.tipo]));
    const aperta = z.tipo === "pulo" && usando;
    ctx.globalAlpha = aperta ? 0.95 : usando ? 0.22 : 0.62;
    const e = aperta ? 0.92 : 1;
    ctx.drawImage(s, x - s.width / 2 * e, z.y - s.height / 2 * e, s.width * e, s.height * e);
    if (aperta) { ctx.globalAlpha = 0.35; ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(x, z.y, r * e - 4, 0, 7); ctx.fill(); }
  });
  // analógicos que estão sendo usados
  abertos.forEach(function(d) {
    if (d.tipo === "pulo") return;
    const cor = j.cores[d.jogador - 1];
    const bx = d.fx * CONFIG.largura, by = d.fy * H;
    ctx.globalAlpha = 0.5;
    const a = anelToque();
    ctx.drawImage(a, bx - a.width / 2, by - a.height / 2);
    ctx.globalAlpha = 0.95;
    const p = puxadorToque(cor);
    ctx.drawImage(p, bx + limitar(d.dx, -80, 80) - p.width / 2, by + limitar(d.dy, -80, 80) - p.height / 2);
  });
  ctx.restore();
}
const spritesToque = {};
// a fonte do jogo já chegou? (o desenho guardado com o nome é refeito quando ela chega; antes sairia com a fonte reserva)
function fonteCarregada() {
  if (fonteCarregada.ok) return true;
  try { fonteCarregada.ok = !document.fonts || document.fonts.check("900 20px Nunito"); } catch (e) { fonteCarregada.ok = true; }
  return fonteCarregada.ok;
}
function spriteToque(tipo, cor, r, rotulo) {
  const chave = tipo + "|" + cor + "|" + r + "|" + rotulo + (fonteCarregada() ? "" : "|reserva");
  if (spritesToque[chave]) return spritesToque[chave];
  const S = r * 2 + 12, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d"), m = S / 2, u = r / (tipo === "stick" ? 84 : tipo === "mira" ? 76 : 62);
  // base: disco escuro translúcido, aro na cor e aro fino claro por dentro
  g.fillStyle = "rgba(12,8,30,0.34)"; g.beginPath(); g.arc(m, m, r, 0, 7); g.fill();
  g.lineWidth = 5 * u; g.strokeStyle = cor; g.beginPath(); g.arc(m, m, r - 2.5 * u, 0, 7); g.stroke();
  g.lineWidth = 2 * u; g.strokeStyle = "rgba(255,255,255,0.3)"; g.beginPath(); g.arc(m, m, r - 11 * u, 0, 7); g.stroke();
  // ícone branco com contorno escuro
  g.lineJoin = "round"; g.lineCap = "round";
  const yi = tipo === "stick" ? m : m - 13 * u;
  const icone = function() {
    g.beginPath();
    if (tipo === "stick") {
      for (let s = -1; s <= 1; s += 2) { g.moveTo(m + s * 44 * u, m - 15 * u); g.lineTo(m + s * 59 * u, m); g.lineTo(m + s * 44 * u, m + 15 * u); }
    } else if (tipo === "mira") {
      g.moveTo(m + 15 * u, yi); g.arc(m, yi, 15 * u, 0, 7);
      g.moveTo(m - 26 * u, yi); g.lineTo(m - 9 * u, yi); g.moveTo(m + 9 * u, yi); g.lineTo(m + 26 * u, yi);
      g.moveTo(m, yi - 26 * u); g.lineTo(m, yi - 9 * u); g.moveTo(m, yi + 9 * u); g.lineTo(m, yi + 26 * u);
    } else {
      g.moveTo(m - 17 * u, yi + 4 * u); g.lineTo(m, yi - 14 * u); g.lineTo(m + 17 * u, yi + 4 * u);
    }
  };
  icone(); g.lineWidth = 10 * u; g.strokeStyle = "rgba(12,8,30,0.75)"; g.stroke();
  icone(); g.lineWidth = 5 * u; g.strokeStyle = "#fff"; g.stroke();
  // nome (em pé o desenho é maior; o nome acompanha)
  const tam = Math.round((tipo === "pulo" ? 17 : 19) * u), yt = tipo === "stick" ? m + 7 * u : m + 30 * u;
  g.font = "900 " + tam + FONTE; g.textAlign = "center"; g.lineJoin = "round";
  g.lineWidth = Math.max(3, tam * 0.22); g.strokeStyle = "rgba(12,8,30,0.85)"; g.strokeText(rotulo, m, yt);
  g.fillStyle = "#fff"; g.fillText(rotulo, m, yt);
  return (spritesToque[chave] = c);
}
function anelToque() {
  if (anelToque.c) return anelToque.c;
  const c = document.createElement("canvas"); c.width = c.height = 176;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(255,255,255,0.22)"; g.beginPath(); g.arc(88, 88, 80, 0, 7); g.fill();
  g.lineWidth = 4; g.strokeStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.arc(88, 88, 78, 0, 7); g.stroke();
  return (anelToque.c = c);
}
const puxadores = {};
function puxadorToque(cor) {
  if (puxadores[cor]) return puxadores[cor];
  const c = document.createElement("canvas"); c.width = c.height = 92;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(12,8,30,0.6)"; g.beginPath(); g.arc(46, 49, 40, 0, 7); g.fill();
  const gr = g.createLinearGradient(0, 8, 0, 84);
  gr.addColorStop(0, tom(cor, 0.4)); gr.addColorStop(0.55, cor); gr.addColorStop(1, tom(cor, -0.3));
  g.fillStyle = gr; g.beginPath(); g.arc(46, 46, 38, 0, 7); g.fill();
  g.lineWidth = 3; g.strokeStyle = "rgba(12,8,30,0.7)"; g.stroke();
  g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.ellipse(36, 30, 15, 9, -0.5, 0, 7); g.fill();
  return (puxadores[cor] = c);
}

// ---------- sensação: reações do bot, combo, tela vermelha, moedas ----------
// Balão com um símbolo acima do bot ("!", "?!", "!!", "♪") + gota de suor com pouca vida
function desenharReacao(ctx, M, b, tm) {
  if (!b.viva || b.humano) return;
  const inv = gravSinal(M.cen, tm) < 0;
  if (b.vida < 30) {
    // gota de suor que escorre
    const f = (tm * 1.6) % 1, sx = b.x + b.r * 0.78, sy = b.y - b.r * 0.55 + f * 10 * (inv ? -1 : 1);
    ctx.globalAlpha = 1 - f * 0.7;
    ctx.fillStyle = "#74c0fc";
    ctx.beginPath(); ctx.moveTo(sx, sy - 7); ctx.quadraticCurveTo(sx + 5, sy + 1, sx, sy + 4); ctx.quadraticCurveTo(sx - 5, sy + 1, sx, sy - 7); ctx.fill();
    ctx.fillStyle = "#e7f5ff"; ctx.fillRect(sx - 1.5, sy - 1, 1.6, 2.4);
    ctx.globalAlpha = 1;
  }
  const e = b.emote;
  if (!e) return;
  const idade = e.d - e.t;
  const esc = idade < 0.15 ? 0.4 + idade / 0.15 * 0.75 : idade < 0.25 ? 1.15 - (idade - 0.15) / 0.1 * 0.15 : 1;
  const alfa = e.t < 0.2 ? e.t / 0.2 : 1;
  const x = b.x + b.r * 0.6, y = inv ? b.y + b.r + 38 : b.y - b.r - 38;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(x, y); ctx.scale(esc, esc);
  ctx.font = "900 24px Nunito, system-ui, sans-serif";
  const w = Math.max(40, ctx.measureText(e.s).width + 20), h = 34;
  ctx.fillStyle = "rgba(12,8,30,0.35)";
  arredondado(ctx, -w / 2 + 2, -h / 2 + 3, w, h, 12); ctx.fill();
  ctx.fillStyle = "#ffffff";
  arredondado(ctx, -w / 2, -h / 2, w, h, 12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-10, h / 2 - 1); ctx.lineTo(-18, h / 2 + 10); ctx.lineTo(-1, h / 2 - 1); ctx.fill();
  ctx.fillStyle = e.s === "♪" ? "#cc5de8" : "#e8590c";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(e.s, 0, 1);
  ctx.restore();
}

function arredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// Vinheta vermelha pronta (desenhada uma vez; por quadro é só um drawImage)
function vinhetaDor(H) {
  if (vinhetaDor.c && vinhetaDor.h === H) return vinhetaDor.c;
  const c = document.createElement("canvas"); c.width = 320; c.height = Math.round(H / 4);
  const g = c.getContext("2d"), w = c.width, h = c.height;
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.62);
  gr.addColorStop(0, "rgba(255,30,60,0)"); gr.addColorStop(1, "rgba(255,30,60,0.85)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  vinhetaDor.c = c; vinhetaDor.h = H;
  return c;
}

// tela vermelha: pulso quando leva dano e batimento com pouca vida (só quem joga contra o bot)
function desenharVinheta(ctx, j, M, H) {
  const b1 = M.bolinhas[0];
  if (j.modo === "2p" || !b1.humano) return;
  let a = (M.dorTela || 0) * 0.55;
  if (b1.viva && b1.vida < 30 && j.fase === "luta") a = Math.max(a, 0.22 + 0.14 * Math.sin(M.t * 7));
  if (a > 0.01) { ctx.globalAlpha = Math.min(0.75, a); ctx.drawImage(vinhetaDor(H), 0, 0, CONFIG.largura, H); ctx.globalAlpha = 1; }
}

function desenharSensacoes(ctx, j, M, L) {
  // contador de combo (a partir de 3 acertos seguidos)
  for (let k = 0; k < 2; k++) {
    const b = M.bolinhas[k], c = b.combo;
    if (!c || c.mostra <= 0 || c.n < 3) continue;
    const novo = Math.max(0, c.ate - M.t - 1.1) / 0.2;           // pulso logo depois de cada acerto
    const tam = Math.round(34 + novo * 12 + Math.min(c.n, 12));
    ctx.globalAlpha = Math.min(1, c.mostra);
    const x = b.lado === 1 ? 250 : CONFIG.largura - 250, y = L.emPe ? mundoParaTela(0, 60).y : 175;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(b.lado === 1 ? -0.07 : 0.07);
    if (L.emPe) ctx.scale(1.4, 1.4);   // em pé, como os outros letreiros (a tela do celular é estreita)
    letreiro(ctx, "COMBO x" + c.n, 0, 0, tam, c.n >= 8 ? "#ff922b" : "#ffd43b");
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // moedas voando de onde o bot caiu até o placar
  const ch = j.chuva;
  if (ch) {
    const idade = (performance.now() - ch.t0) / 1000;
    // v17.5: voam até o retrato do jogador no HUD (o "+N" aparece embaixo dele)
    const em = L.emPe, kh = em ? 1.45 : 1, mg = em ? CONFIG.largura / 2 - CONFIG.largura / 2 / kh + 12 : 20;
    const alvoX = CONFIG.largura / 2 + (mg + 34 - CONFIG.largura / 2) * kh, alvoY = L.hudTopo + 42 * kh;
    const o = mundoParaTela(ch.x, ch.y), z = camera.z;
    let chegaram = 0;
    for (let i = 0; i < ch.n; i++) {
      const ini = 0.25 + i * 0.07, u = (idade - ini) / 0.75;
      if (u <= 0) {
        // espalhando no ar antes de voar
        const a = i / ch.n * Math.PI * 2, r = Math.min(1, idade / 0.25) * 40 * z;
        moedinha(ctx, o.x + Math.cos(a) * r, o.y + Math.sin(a) * r - 10, 1);
        continue;
      }
      if (u >= 1) { chegaram++; continue; }
      const e = u * u * (3 - 2 * u), a = i / ch.n * Math.PI * 2;
      const sx = o.x + Math.cos(a) * 40 * z, sy = o.y + Math.sin(a) * 40 * z - 10;
      const x = sx + (alvoX - sx) * e, y = sy + (alvoY - sy) * e - Math.sin(u * Math.PI) * 120;
      moedinha(ctx, x, y, 1 - u * 0.35);
    }
    if (chegaram > (ch.tocadas || 0)) { ch.tocadas = chegaram; if (!M.mudo) som("moeda", 1 + chegaram * 0.05); }
    if (chegaram >= ch.n) {
      const fim = idade - (0.25 + (ch.n - 1) * 0.07 + 0.75);
      if (fim < 0.9) { ctx.globalAlpha = 1 - fim / 0.9; letreiro(ctx, "+" + ch.n, alvoX + 6, alvoY + 88 * kh - fim * 30, Math.round(30 * kh), "#ffd43b"); ctx.globalAlpha = 1; }
      else j.chuva = null;
    }
  }
}

function moedinha(ctx, x, y, esc) {
  const r = 11 * esc;
  ctx.fillStyle = "#b8860b"; ctx.beginPath(); ctx.arc(x, y + 1.5, r, 0, 7); ctx.fill();
  ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = "#fff3bf"; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, 7); ctx.fill();
  ctx.strokeStyle = "#e8a400"; ctx.lineWidth = 2 * esc; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, 7); ctx.stroke();
}
