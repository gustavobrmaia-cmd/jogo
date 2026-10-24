"use strict";

// =========================
// FÍSICA DAS BOLINHAS
// Tudo aqui é função do tempo da rodada (t, em segundos), sem sorteio: o bot usa as MESMAS funções
// para simular o futuro ("se eu pular agora, onde caio? o tiro me acerta?").
// Unidades: px e px por passo (60 passos por segundo).
// =========================

const FIS = {
  dt: 1 / 60,
  grav: 0.55,
  velMax: 6.2,
  pulo: 12.8,
  puloDuplo: 10.4,
  quedaMax: 15,
  raio: 28,
  raioMini: 16,
  raioInflado: 40,          // v19: inflado pelo Inflador
  largura: 1280,
  altura: 720
};

// ---- regras do cenário que mudam com o tempo ----
function gravSinal(cen, t) {
  if (!cen.inverte) return 1;
  return Math.floor(t / cen.inverte) % 2 ? -1 : 1;
}
// 0..1 no último segundo antes da gravidade virar (para o aviso)
function avisoInversao(cen, t) {
  if (!cen.inverte) return 0;
  const r = t % cen.inverte;
  return r > cen.inverte - 1.2 ? (r - (cen.inverte - 1.2)) / 1.2 : 0;
}
function lavaY(cen, t) {
  if (!cen.lava) return Infinity;
  const l = cen.lava;
  return l.base - l.sobe * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / l.periodo));
}
function ventoEm(cen, t) {
  if (!cen.vento) return 0;
  return limitar(Math.sin(2 * Math.PI * t / (2 * cen.vento.periodo)) * 2.5, -1, 1);
}
function gravidadeDe(cen) {
  return FIS.grav * (cen.gravidade || 1) * (cen.semGravidade ? 0.22 : 1);
}

// Posição de uma plataforma no tempo t (as que se movem vão e voltam suavemente).
// Escreve em PX/PY para não criar objeto a cada chamada.
let PX = 0, PY = 0;
function posPlat(p, t) {
  if (!p.move) { PX = p.x0; PY = p.y0; return; }
  const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / p.move.periodo);
  PX = p.x0 + p.move.dx * k;
  PY = p.y0 + p.move.dy * k;
}

// Cópia das plataformas do cenário para a rodada (guarda a posição inicial)
function prepararPlataformas(cen) {
  return cen.plataformas.map(function(p) {
    return Object.assign({}, p, { x0: p.x, y0: p.y });
  });
}
function atualizarPlataformas(plats, t) {
  for (let i = 0; i < plats.length; i++) {
    const p = plats[i];
    posPlat(p, t);
    p.x = PX; p.y = PY;
  }
}

// ---- estado de uma bolinha ----
function novaBolinha(lado, x, y, cor) {
  return {
    lado: lado, x: x, y: y, vx: 0, vy: 0, r: FIS.raio, cor: cor,
    dir: lado === 1 ? 1 : -1,          // para onde está virada
    noChao: false, tempoNoAr: 0, pulos: 0, puloCd: 0, ignoraFina: 0, segurouPulo: false,
    chao: null,                        // plataforma embaixo (para esteira / plataforma que anda)
    portalCd: 0, lavaCd: 0,
    vida: 100, viva: true,
    efeitos: {}                        // nome -> segundos restantes (escudo, rapidez, furia...)
  };
}

function copiarBolinha(b) {
  return {
    lado: b.lado, x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.r, dir: b.dir,
    noChao: b.noChao, tempoNoAr: b.tempoNoAr, pulos: b.pulos, puloCd: b.puloCd, ignoraFina: b.ignoraFina,
    segurouPulo: b.segurouPulo, chao: b.chao, portalCd: b.portalCd, lavaCd: 0, vida: b.vida, viva: b.viva,
    multVel: b.multVel, efeitos: b.efeitos, lancado: b.lancado
  };
}

function maxPulos(b, cen) {
  if (cen.semGravidade || cen.agua) return 99;
  return b.efeitos.super_pulo > 0 ? 3 : 2;
}

// v21.2: DASH — arrancada curta para o lado (vale no ar); durante ela os tiros ATRAVESSAM a bolinha (combate.js) e o
// dano de quem ataca não pega. vel em px por passo (andar é 6,2), dur e recarga em segundos.
const DASH = { vel: 17, dur: 0.16, recarga: 1.1 };

// Um passo de física. ent = { esq, dir, pulo (apertou agora), segPulo (segurando), baixo, dash (apertou agora) }
// Devolve eventos simples em b.evento: "pulo", "aterrissou", "lava", "caiu", "portal", "bumper" (ou "")
function moverBolinha(b, ent, cen, plats, t, bumpers) {
  b.evento = "";
  if (!b.viva) return;
  const sinal = gravSinal(cen, t);
  const g = gravidadeDe(cen) * sinal;
  const ef = b.efeitos;
  // v19: preso na bolha ou escorregando na banana também tira o controle; grudado na gosma não pula
  const semControle = ef.congelado > 0 || ef.bolha > 0 || ef.escorrega > 0;
  const congelado = semControle;
  const grudado = ef.grudado > 0;
  const mult = (b.multVel || 1) * (ef.rapidez > 0 ? 1.4 : 1) * (ef.lento > 0 ? 0.5 : 1) * (ef.mini > 0 ? 1.12 : 1) *
    (grudado ? 0.42 : 1) * (ef.inflado > 0 ? 0.82 : 1);
  const esq = !congelado && ent.esq, dir = !congelado && ent.dir;
  const input = (dir ? 1 : 0) - (esq ? 1 : 0);
  if (input) b.dir = input;

  // ---- andar ----
  const alvo = input * FIS.velMax * mult;
  const gelo = b.noChao && b.chao && b.chao.gelo;
  let k;
  if (cen.semGravidade) k = 0.05;
  else if (ef.escorrega > 0) k = 0.006;
  else if (b.noChao) k = gelo ? (input ? 0.03 : 0.008) : (input ? 0.3 : 0.38);
  else k = cen.agua ? 0.08 : 0.13;
  b.vx += (alvo - b.vx) * k;
  if (cen.vento) b.vx += ventoEm(cen, t) * cen.vento.forca * (b.noChao ? 0.55 : 1);

  // ---- pular ----
  if (b.puloCd > 0) b.puloCd -= FIS.dt;
  if (grudado && ent.pulo) b.evento = "preso";   // v19.6: tentou pular grudado: um "tuc" avisa (partida.js)
  if (!congelado && !grudado && ent.pulo && b.puloCd <= 0) {
    const forca = (ef.super_pulo > 0 ? 1.18 : 1) * (ef.rapidez > 0 ? 1.06 : 1);
    if (cen.semGravidade) {
      b.vy = -6.2 * sinal * forca; b.puloCd = 0.16; b.evento = "pulo";
    } else if (cen.agua) {
      b.vy = Math.min(b.vy * sinal, 0) * sinal - 7.2 * sinal * forca; b.puloCd = 0.22; b.evento = "pulo";
    } else if (b.noChao || b.tempoNoAr < 0.1) {
      b.vy = -FIS.pulo * sinal * forca; b.pulos = 1; b.noChao = false; b.tempoNoAr = 1; b.evento = "pulo";
    } else if (b.pulos < maxPulos(b, cen)) {
      b.vy = -FIS.puloDuplo * sinal * forca; b.pulos = Math.max(b.pulos, 1) + 1; b.evento = "pulo";
    }
  }
  // ---- dash ----
  if (b.dashCd > 0) b.dashCd -= FIS.dt;
  if (!congelado && !grudado && ent.dash && !(b.dashCd > 0)) {
    b.dashDir = input || b.dir || 1; b.dashT = DASH.dur; b.dashCd = DASH.recarga; b.evento = "dash";
    if (!cen.semGravidade && !cen.agua && b.vy * sinal > 0) b.vy = 0;   // no ar: para de cair um instante
  }
  if (b.dashT > 0) { b.dashT -= FIS.dt; b.vx = b.dashDir * DASH.vel * (cen.agua ? 0.6 : 1); }
  b.segurouPulo = ent.segPulo;
  // soltou o pulo cedo: pulo mais baixo (dá controle fino)
  // (v19: menos quando foi o tornado que jogou para cima)
  if (b.lancado && b.vy * sinal >= 0) b.lancado = false;
  if (!ent.segPulo && !b.lancado && !cen.semGravidade && !cen.agua && b.vy * sinal < -5) b.vy *= 0.88;

  // ---- descer de plataforma fina / cair mais rápido ----
  if (ent.baixo && !congelado) {
    if (b.noChao && b.chao && b.chao.fina) { b.ignoraFina = 0.25; b.noChao = false; }
    else if (!b.noChao) b.vy += 0.35 * sinal;
  }
  if (b.ignoraFina > 0) b.ignoraFina -= FIS.dt;

  // ---- gravidade e freio ----
  if (ef.bolha > 0) {
    // presa numa bolha: sobe devagar balançando (a gravidade não vale)
    b.vy += (-1.5 * sinal - b.vy) * 0.08;
    b.vx *= 0.94;
  } else b.vy += g * (ef.inflado > 0 ? 0.45 : 1) * (b.dashT > 0 ? 0.15 : 1);
  if (cen.agua) { b.vx *= 0.975; b.vy *= 0.955; }
  if (cen.semGravidade) { b.vx *= 0.99; b.vy *= 0.985; }
  b.vy = limitar(b.vy, -FIS.quedaMax, FIS.quedaMax);

  // ---- carregado pelo chão (esteira e plataforma que anda) ----
  if (b.noChao && b.chao) {
    const p = b.chao;
    if (p.esteira) b.x += p.esteira;
    if (p.move) {
      posPlat(p, t - FIS.dt); const ax = PX, ay = PY;
      posPlat(p, t);
      b.x += PX - ax; b.y += PY - ay;
    }
  }

  const yAntes = b.y;
  b.x += b.vx;
  b.y += b.vy;

  // ---- plataformas ----
  const estavaNoChao = b.noChao;
  b.noChao = false;
  b.chao = null;
  for (let i = 0; i < plats.length; i++) colidirPlataforma(b, plats[i], t, sinal, yAntes);
  if (b.noChao) { b.tempoNoAr = 0; b.pulos = 0; if (!estavaNoChao && !b.evento) b.evento = "aterrissou"; }
  else b.tempoNoAr += FIS.dt;

  // ---- bordas da arena ----
  if (cen.atravessaLados) {
    if (b.x < -b.r) b.x += FIS.largura + 2 * b.r;
    else if (b.x > FIS.largura + b.r) b.x -= FIS.largura + 2 * b.r;
  } else if (b.x < b.r || b.x > FIS.largura - b.r) {
    b.x = limitar(b.x, b.r, FIS.largura - b.r);
    b.vx = cen.quicaParede ? -b.vx * 0.9 : 0;
  }
  if (b.y < b.r) { b.y = b.r; if (b.vy < 0) b.vy = sinal < 0 ? 0 : -b.vy * 0.3; if (sinal < 0) { b.noChao = true; b.tempoNoAr = 0; b.pulos = 0; } }
  if (!cen.queda && !cen.lava && b.y > FIS.altura - b.r) {
    b.y = FIS.altura - b.r; if (b.vy > 0) b.vy = 0;
    if (sinal > 0) { b.noChao = true; b.tempoNoAr = 0; b.pulos = 0; }
  }
  if (cen.queda && b.y > cen.queda) { b.evento = "caiu"; }

  // ---- lava: queima e joga para cima ----
  if (cen.lava) {
    if (b.lavaCd > 0) b.lavaCd -= FIS.dt;
    if (b.y + b.r * 0.6 > lavaY(cen, t)) {
      b.vy = -13;
      if (b.lavaCd <= 0) { b.lavaCd = 0.45; b.evento = "lava"; }
    }
  }

  // ---- bumpers do fliperama ----
  if (bumpers) for (let i = 0; i < bumpers.length; i++) {
    const u = bumpers[i];
    const dx = b.x - u.x, dy = b.y - u.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d < b.r + u.r) {
      const nx = dx / d, ny = dy / d;
      b.x = u.x + nx * (b.r + u.r + 0.5);
      b.y = u.y + ny * (b.r + u.r + 0.5);
      const v = Math.max(13, Math.sqrt(b.vx * b.vx + b.vy * b.vy));
      b.vx = nx * v; b.vy = ny * v;
      u.flash = 1;
      b.evento = "bumper";
    }
  }

  // ---- portais ----
  if (cen.portais) {
    if (b.portalCd > 0) b.portalCd -= FIS.dt;
    else for (let i = 0; i < cen.portais.length; i++) {
      const par = cen.portais[i];
      for (let k2 = 0; k2 < 2; k2++) {
        const a = par[k2], o = par[1 - k2];
        const dx = b.x - a.x, dy = b.y - a.y;
        if (dx * dx + dy * dy < 34 * 34) {
          b.x = o.x; b.y = o.y; b.portalCd = 0.8; b.evento = "portal";
          return;
        }
      }
    }
  }
}

// Círculo contra retângulo. Plataforma fina só segura quem vem de cima caindo.
function colidirPlataforma(b, p, t, sinal, yAntes) {
  posPlat(p, t);
  const px = PX, py = PY;
  if (b.x + b.r < px || b.x - b.r > px + p.w || b.y + b.r < py || b.y - b.r > py + p.h) return;
  if (p.fina) {
    if (sinal < 0 || b.ignoraFina > 0 || b.vy < 0) return;
    if (yAntes + b.r > py + 6) return;      // já estava abaixo do topo: atravessa
    if (b.x < px - b.r * 0.4 || b.x > px + p.w + b.r * 0.4) return;
    b.y = py - b.r; b.vy = 0; b.noChao = true; b.chao = p;
    return;
  }
  const cx = limitar(b.x, px, px + p.w);
  const cy = limitar(b.y, py, py + p.h);
  let dx = b.x - cx, dy = b.y - cy;
  let d2 = dx * dx + dy * dy;
  let nx, ny, pen;
  if (d2 === 0) {
    // centro dentro do retângulo: sai pelo lado mais perto
    const e = b.x - px, di = px + p.w - b.x, c = b.y - py, ba = py + p.h - b.y;
    const m = Math.min(e, di, c, ba);
    if (m === c) { nx = 0; ny = -1; pen = c + b.r; }
    else if (m === ba) { nx = 0; ny = 1; pen = ba + b.r; }
    else if (m === e) { nx = -1; ny = 0; pen = e + b.r; }
    else { nx = 1; ny = 0; pen = di + b.r; }
  } else {
    const d = Math.sqrt(d2);
    if (d >= b.r) return;
    nx = dx / d; ny = dy / d; pen = b.r - d;
  }
  b.x += nx * pen;
  b.y += ny * pen;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= vn * nx; b.vy -= vn * ny; }
  if (ny * sinal < -0.6) { b.noChao = true; b.chao = p; }
}

// Empurra as duas bolinhas para não ficarem uma dentro da outra (com um quiquezinho)
function separarBolinhas(a, b) {
  if (!a.viva || !b.viva) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const min = a.r + b.r;
  if (d >= min) return;
  const nx = dx / d, ny = dy / d, pen = (min - d) / 2;
  a.x -= nx * pen; a.y -= ny * pen;
  b.x += nx * pen; b.y += ny * pen;
  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv < 0) {
    const j = -rv * 0.8;
    a.vx -= nx * j; a.vy -= ny * j;
    b.vx += nx * j; b.vy += ny * j;
  }
}

// Linha livre entre dois pontos? (plataformas finas não bloqueiam tiro)
function linhaLivre(x1, y1, x2, y2, plats, t) {
  for (let i = 0; i < plats.length; i++) {
    const p = plats[i];
    if (p.fina) continue;
    posPlat(p, t);
    if (segmentoCortaRet(x1, y1, x2, y2, PX, PY, p.w, p.h)) return false;
  }
  return true;
}

// Segmento contra retângulo (Liang-Barsky). Devolve a fração 0..1 do primeiro toque, ou -1.
function fracaoSegmentoRet(x1, y1, x2, y2, rx, ry, rw, rh) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - rx, rx + rw - x1, y1 - ry, ry + rh - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return -1; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return -1; if (r > t0) t0 = r; }
    else { if (r < t0) return -1; if (r < t1) t1 = r; }
  }
  return t0;
}
function segmentoCortaRet(x1, y1, x2, y2, rx, ry, rw, rh) {
  return fracaoSegmentoRet(x1, y1, x2, y2, rx, ry, rw, rh) >= 0;
}

// Distância de um ponto a um segmento (para lasers acertarem bolinhas)
function distPontoSegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const k = limitar(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  const qx = x1 + dx * k - px, qy = y1 + dy * k - py;
  return Math.sqrt(qx * qx + qy * qy);
}
