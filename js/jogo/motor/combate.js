"use strict";

// =========================
// COMBATE: mira, tiros das 60 armas, projéteis, explosões, dano, caixas de arma e cartas.
// Tudo acontece dentro do "mundo" M da rodada (criado em partida.js):
//   M.cen, M.plats, M.t, M.bolinhas[0..1], M.proj, M.feixes, M.avisos, M.caixas, M.cartas, M.bumpers, M.stats
// =========================

const ANG_ASSIST = 0.62;          // a mira ajuda se o oponente estiver até ~35° da direção que a bolinha olha
const PULSO_PERFURA = 18;         // passos até um tiro que atravessa poder acertar a mesma bolinha de novo

function oponente(M, b) { return M.bolinhas[b.lado === 1 ? 1 : 0]; }
function difAng(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function somJogo(M, nome, tomMult) { if (!M.mudo) som(nome, tomMult); }

// Reação do bot (balão acima da cabeça): "!" "?!" ou uma provocação curta (texto do idioma) — dura alguns décimos de segundo
function emote(b, s, dur) {
  if (b.humano) return;
  // v19.6: reações ("?!", "!!") não cobrem outro balão que ainda está na tela (o teste viu 1 balão a cada 1,5 s)
  if ((s === "?!" || s === "!!") && b.emote && b.emote.t > 0.2) return;
  if (b.emote && b.emote.t > 0.4 && b.emote.s === s) return;
  b.emote = { s: s, t: dur || 1.1, d: dur || 1.1 };
}

// ---------- arma ----------
function equipar(b, id) {
  const a = ARMA[id];
  b.arma = id;
  // v18: contra a máquina a munição é multiplicada (b.multMunicao, partida.js iniciarRodada)
  b.municao = a.municao === Infinity ? Infinity : Math.ceil(a.municao * (b.multMunicao || 1));
  b.cad = 0.15;
  b.carga = 0;
  b.golpe = 0;
}

// Ângulo da mira. Base: para onde a bolinha olha; a mira assistida puxa para o oponente se ele estiver
// na frente (igual para o jogador e para o bot). Armas com gravidade calculam o arco para cair nele.
function calcularMira(M, b) {
  const a = ARMA[b.arma];
  // mira livre do jogador: vai exatamente para onde ele aponta (e a bolinha vira para esse lado)
  if (b.miraLivre !== null && b.miraLivre !== undefined) {
    b.dir = Math.cos(b.miraLivre) >= 0 ? 1 : -1;
    if (semMira(a)) return b.dir > 0 ? 0 : Math.PI;
    // "ímã" leve para o jogador: se a mira passa quase em cima do oponente (tiro reto), vai certinho nele
    const o2 = oponente(M, b);
    if (b.humano && o2.viva && !(o2.efeitos.fantasma > 0) && !(a.grav > 0.05)) {
      const alvo = Math.atan2(o2.y - b.y, o2.x - b.x);
      const dist = Math.sqrt((o2.x - b.x) * (o2.x - b.x) + (o2.y - b.y) * (o2.y - b.y)) || 1;
      const ima = Math.min(0.14, Math.atan2(o2.r * 0.9, dist));
      if (Math.abs(difAng(alvo, b.miraLivre)) < ima) return alvo;
    }
    // arma de arco (estilingue, granada...): quem mira "mais ou menos no bot" (reto ou na curva) acerta a parábola.
    // Gente mira reto; o bot calcula a curva — sem isso o jogador perdia toda troca de estilingue.
    if (b.humano && o2.viva && !(o2.efeitos.fantasma > 0) && a.grav > 0.05 && a.tipo === "bala") {
      const sinalG = gravSinal(M.cen, M.t), g = a.grav * gravidadeDe(M.cen);
      const dx = o2.x - b.x, dy = o2.y - b.y;
      const th = anguloBalistico(Math.abs(dx), -dy * sinalG, a.vel * (M.cen.agua ? 0.7 : 1), g);
      if (th !== null) {
        const angCanvas = -th * sinalG, arcoCerto = dx >= 0 ? angCanvas : Math.PI - angCanvas;
        const reto = Math.atan2(dy, dx);
        // vale se a mira está entre a linha reta e a curva certa (com folga)
        const lo = Math.min(0, difAng(arcoCerto, reto)) - 0.22, hi = Math.max(0, difAng(arcoCerto, reto)) + 0.22;
        const d = difAng(b.miraLivre, reto);
        if (d >= lo && d <= hi) return arcoCerto;
      }
    }
    return b.miraLivre;
  }
  const o = oponente(M, b);
  const base = b.dir > 0 ? 0 : Math.PI;
  const sinal = gravSinal(M.cen, M.t);
  const g = (a.grav || 0) * gravidadeDe(M.cen);          // força da gravidade no projétil (sempre >= 0)
  const arco = g > 0.05 && a.tipo === "bala";
  // arremesso sem alvo: um pouco para "cima" (contra a gravidade)
  const inclinado = b.dir > 0 ? -0.35 * sinal : Math.PI + 0.35 * sinal;
  if (semMira(a)) return base;
  const visivel = o.viva && !(o.efeitos.fantasma > 0);
  const dx = o.x - b.x, dy = o.y - b.y;
  if (!visivel || dx * b.dir < -10) return arco ? inclinado : base;
  if (arco) {
    // resolve o ângulo para o arco cair no oponente (com a gravidade para baixo ou invertida)
    const v = a.vel * (M.cen.agua ? 0.7 : 1);
    const th = anguloBalistico(Math.abs(dx), -dy * sinal, v, g);
    if (th === null) return b.dir > 0 ? -0.7 * sinal : Math.PI + 0.7 * sinal;
    const angCanvas = -th * sinal;
    return b.dir > 0 ? angCanvas : Math.PI - angCanvas;
  }
  const alvo = Math.atan2(dy, dx);
  // v20.9: no treino a ajuda é maior para gente (~57°): pega o Bob numa plataforma logo acima
  const lim = ANG_ASSIST * (M.cen.semGravidade ? 1.4 : 1) * (b.humano && typeof jogo !== "undefined" && jogo && jogo.treino ? 1.6 : 1);
  return Math.abs(difAng(alvo, base)) < lim ? alvo : base;
}

// armas que não miram (golpe, mina/banana, torreta, céu): usam só o lado para onde a bolinha olha
function semMira(a) { return a.tipo === "melee" || a.tipo === "mina" || a.tipo === "ceu" || a.tipo === "torreta"; }

// Ângulo de lançamento (acima da horizontal, em radianos) para acertar um ponto a "x" de distância e
// "yCima" de altura com velocidade v e gravidade g. Usa o arco baixo (mais rápido). null = não alcança.
function anguloBalistico(x, yCima, v, g) {
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * x * x + 2 * yCima * v2);
  if (disc < 0) return null;
  return Math.atan((v2 - Math.sqrt(disc)) / (g * Math.max(1, x)));
}

function pontaDoCano(b, ang) {
  if (typeof ArteArmas !== "undefined" && ArteArmas.pontaDoCano) {
    const p = ArteArmas.pontaDoCano(b.arma, b.x, b.y, ang, b.r);
    if (p) return p;
  }
  return { x: b.x + Math.cos(ang) * b.r * 1.7, y: b.y + Math.sin(ang) * b.r * 1.7 };
}

// Chamado a cada passo para cada bolinha viva: segurando = segurando tiro; apertou = apertou agora
function usarArma(M, b, segurando, apertou) {
  if (b.cad > 0) b.cad -= FIS.dt;
  if (b.golpe > 0) b.golpe = Math.max(0, b.golpe - FIS.dt * 4);
  if (b.recuoAnim > 0) b.recuoAnim = Math.max(0, b.recuoAnim - FIS.dt * 6);
  b.feixeLigado = false;
  if (!b.viva || b.efeitos.congelado > 0) { b.carga = 0; return; }
  let a = ARMA[b.arma];
  // v20.9: gente atirando SEM mira livre (segurar o botão de tiro no toque sem arrastar, F/espaço no teclado) vira para
  // o oponente na hora do tiro. Antes o tiro ia para o lado em que a bolinha andou por último: o jogador de teste viu o
  // Bob do treino grudar nas costas da criança e 78–84% do tempo de tiro ir no vazio (uma rodada inteira sem acerto).
  // Andando sem atirar, a bolinha continua virada para onde anda. O bot sempre tem mira livre (não muda nada nele).
  if ((segurando || apertou) && b.humano && (b.miraLivre === null || b.miraLivre === undefined) && a.tipo !== "mina" && a.tipo !== "ceu" && a.tipo !== "torreta") {
    const o = oponente(M, b);
    if (o.viva && !(o.efeitos.fantasma > 0) && Math.abs(o.x - b.x) > 4) b.dir = o.x > b.x ? 1 : -1;
  }
  b.mira = calcularMira(M, b);

  // railgun: carrega um pouquinho antes de disparar
  if (b.carga > 0) {
    b.carga -= FIS.dt;
    if (b.carga <= 0) dispararArma(M, b, a);
    return;
  }
  if (a.tipo === "feixe") {
    if (segurando && b.municao > 0) { b.feixeLigado = true; feixeContinuo(M, b, a); gastar(b, 1); }
    return;
  }
  if (!(segurando || apertou) || b.cad > 0) return;
  if (a.carga) { b.carga = a.carga; b.cad = a.cadencia; somJogo(M, "carga"); return; }
  dispararArma(M, b, a);
}

function gastar(b, n) {
  if (b.municao === Infinity || b.efeitos.municao > 0) return;
  b.municao -= n;
  if (b.municao <= 0) equiparReserva(b);
}
// v21.4: a arma comprada na loja é a arma RESERVA (o dono: "funciona igual o estilingue"): quando a munição acaba vem
// ela, com munição infinita, no lugar do estilingue. Sem arma comprada: estilingue. (jogo.armaInicial: partida.js)
function equiparReserva(b) {
  const j = typeof jogo !== "undefined" ? jogo : null, r = j && j.armaInicial && j.armaInicial[b.lado - 1];
  if (!r || !ARMA[r]) { equipar(b, "estilingue"); return; }
  equipar(b, r);
  b.municao = Infinity;
  if (b.humano && !j.demo && typeof Efeitos !== "undefined") Efeitos.texto(b.x, b.y - b.r - 30, t("pegou_arma", t("a_" + r)), "#8ce99a", 1.2);
}

function dispararArma(M, b, a) {
  b.cad = a.cadencia;
  M.stats.tiros[b.lado - 1]++;
  const vezes = b.efeitos.tiro_duplo > 0 ? 2 : 1;
  const ang = b.mira;
  const boca = pontaDoCano(b, ang);
  if (a.tipo === "bala") {
    for (let v = 0; v < vezes; v++) {
      const desvio = vezes > 1 ? (v === 0 ? -0.07 : 0.07) : 0;
      for (let i = 0; i < (a.qtd || 1); i++) {
        const esp = (a.espalha || 0) * (Math.random() - 0.5) * ((a.qtd || 1) > 1 ? 1.2 : 1);
        criarProjetil(M, b, a, boca.x, boca.y, ang + esp + desvio);
      }
    }
  } else if (a.tipo === "laser") {
    for (let v = 0; v < vezes; v++) laser(M, b, a, boca, ang + (vezes > 1 ? (v ? 0.06 : -0.06) : 0));
  } else if (a.tipo === "raio") {
    for (let v = 0; v < vezes; v++) choque(M, b, a, boca, v);
  } else if (a.tipo === "melee") {
    golpe(M, b, a, vezes);
  } else if (a.tipo === "mina") {
    for (let v = 0; v < vezes; v++) colocarMina(M, b, a, v);
  } else if (a.tipo === "torreta") {
    montarTorreta(M, b, a);
  } else if (a.tipo === "ceu") {
    const o = oponente(M, b);
    for (let i = 0; i < a.qtd * vezes; i++) {
      const espalha = a.qtd > 1 ? (i - (a.qtd - 1) / 2) * 75 : 0;
      avisarCeu(M, b.lado, o.x + o.vx * 22 + espalha + (Math.random() - 0.5) * 30, o.y, a.aviso + i * 0.16, a);
    }
  }
  sensacaoTiro(M, b, a, boca, ang);
  if (a.recuo) { b.vx -= Math.cos(ang) * a.recuo; b.vy -= Math.sin(ang) * a.recuo * 0.5; }
  gastar(b, 1);
}

// v19: cada arma tem a sua sensação: tranco na mão (recuoVis), clarão desenhado na boca do cano, cápsula ou fumaça
// saindo (ArteArmas), tela tremendo proporcional (só no tiro de quem joga; os pesados do bot tremem um pouco) e som próprio
function sensacaoTiro(M, b, a, boca, ang) {
  b.recuoAnim = a.recuoVis === undefined ? 1 : a.recuoVis;
  somJogo(M, a.som || "tiro");
  if (typeof ArteArmas !== "undefined" && ArteArmas.disparo) ArteArmas.disparo(a, boca.x, boca.y, ang, b.dir, M.mudo);
  if (typeof Efeitos === "undefined") return;
  if (a.fumaca && Math.random() < a.fumaca) for (let i = 0; i < Math.max(1, Math.floor(a.fumaca)); i++) Efeitos.fumaca(boca.x + Math.cos(ang) * 6, boca.y + Math.sin(ang) * 6 - i * 3);
  if (!M.mudo && a.tremor) Efeitos.tremer(b.humano ? a.tremor : (a.tremor >= 3 ? a.tremor * 0.35 : 0));
}

// ---------- projéteis ----------
function criarProjetil(M, b, a, x, y, ang) {
  if (M.proj.length > 260) return;
  const lento = M.cen.agua ? 0.7 : 1;
  const v = a.vel * lento * (0.92 + Math.random() * 0.16 * ((a.qtd || 1) > 1 ? 1 : 0.2));
  M.proj.push({
    x: x, y: y, vx: Math.cos(ang) * v + b.vx * 0.25, vy: Math.sin(ang) * v + (a.grav ? b.vy * 0.2 : 0),
    a: a, dono: b.lado, cor: b.cor, visual: a.visual, raio: a.raio || 4,
    passos: 0, t: 0, quicas: a.quica || 0, vivo: true, hit: [0, 0], portalCd: 0, voltas: 0,
    timer01: 0, parado: false, fragmento: false, mult: 1, preso: null
  });
  // o tornado anda quase na horizontal (não afunda no chão nem sobe para o céu)
  if (a.levanta) { const p = M.proj[M.proj.length - 1]; p.vy *= 0.25; }
}

function criarFragmentos(M, p, n) {
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    M.proj.push({
      x: p.x, y: p.y, vx: Math.cos(ang) * 8.5, vy: Math.sin(ang) * 8.5 - 2,
      a: FRAGMENTO, dono: p.dono, cor: p.cor, visual: "fragmento", raio: 3, passos: 0, t: 0, quicas: 0,
      vivo: true, hit: [0, 0], portalCd: 0, voltas: 0, timer01: 0, parado: false, fragmento: true
    });
  }
}
const FRAGMENTO = { id: "fragmento", tipo: "bala", dano: 7, vel: 8.5, grav: 0.6, raio: 3, vida: 36, visual: "fragmento" };

function atualizarProjeteis(M) {
  const cen = M.cen, t = M.t;
  const sinal = gravSinal(cen, t);
  const g = gravidadeDe(cen) * sinal;
  const vento = cen.vento ? ventoEm(cen, t) * cen.vento.forca : 0;
  const lava = lavaY(cen, t);
  for (let i = 0; i < M.proj.length; i++) {
    const p = M.proj[i];
    if (!p.vivo) continue;
    const a = p.a;
    p.passos++;
    p.t = p.passos * FIS.dt;

    // ---- mina: cai até o chão, arma e espera ----
    if (a.tipo === "mina") { atualizarMina(M, p, g); continue; }
    if (a.tipo === "torreta") { atualizarTorreta(M, p, g); continue; }
    // ---- bomba grudada numa bolinha: vai junto com ela até explodir ----
    if (p.preso) {
      let q = p.preso;
      // batata quente: encostou no outro com a bomba grudada, ela passa para ele
      const outro = M.bolinhas[q.lado === 1 ? 1 : 0];
      if (outro.viva && p.passos - (p.passou || -99) > 24) {
        const dx = outro.x - q.x, dy = outro.y - q.y, rr = outro.r + q.r + 6;
        if (dx * dx + dy * dy < rr * rr) {
          q.bombaGrudada = null; outro.bombaGrudada = p; p.preso = q = outro; p.passou = p.passos;
          somJogo(M, "s_gosma", 1.3);
          if (typeof Efeitos !== "undefined") Efeitos.anel(q.x, q.y, "#7bd94f", q.r + 14);
        }
      }
      p.x = q.x + p.ox; p.y = q.y + p.oy;
      p.timer01 = p.passos / a.timer;
      if (p.passos >= a.timer || !q.viva) explodirProjetil(M, p, q.viva ? q : undefined);
      continue;
    }

    const xa = p.x, ya = p.y;
    // comportamento especial
    if (a.teleguia) teleguiar(M, p, a.teleguia);
    if (a.ima) imaPuxa(M, p, a);
    if (a.desvia) sopraTiros(M, p);
    if (a.volta && p.passos > (a.vida || 110) * 0.42) voltarAoDono(M, p);
    if (a.grav && !p.parado) p.vy += g * a.grav;
    if (a.arrasto) { p.vx *= a.arrasto; p.vy *= a.arrasto; }
    if (cen.agua) { p.vx *= 0.992; p.vy *= 0.992; }
    if (vento && (a.grav || a.arrasto || a.visual === "bolha")) p.vx += vento * 0.3;
    if (a.atrai) atrair(M, p, a);
    if (p.parado) { p.vx *= 0.8; }
    p.x += p.vx; p.y += p.vy;

    // timer (granadas)
    if (a.timer) {
      p.timer01 = p.passos / a.timer;
      if (p.passos >= a.timer) { explodirProjetil(M, p); continue; }
    }
    // tempo de vida
    if (a.vida && p.passos >= a.vida && !a.timer) { if (a.explode) explodirProjetil(M, p); else p.vivo = false; continue; }
    if (!a.vida && p.passos > 220 && !a.timer) { p.vivo = false; continue; }

    // portais
    if (cen.portais) projetilPortal(M, p);
    // bumpers rebatem
    if (M.bumpers) for (let k = 0; k < M.bumpers.length; k++) {
      const u = M.bumpers[k];
      const dx = p.x - u.x, dy = p.y - u.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < u.r + p.raio) {
        const nx = dx / d, ny = dy / d, vn = p.vx * nx + p.vy * ny;
        if (vn < 0) { p.vx -= 2 * vn * nx; p.vy -= 2 * vn * ny; }
        p.x = u.x + nx * (u.r + p.raio + 1); p.y = u.y + ny * (u.r + p.raio + 1);
        u.flash = 1;
      }
    }

    // bordas
    if (cen.atravessaLados && p.voltas < 2) {
      if (p.x < -20) { p.x += FIS.largura + 40; p.voltas++; }
      else if (p.x > FIS.largura + 20) { p.x -= FIS.largura + 40; p.voltas++; }
    }
    // v19: o disco ricocheteia também nas paredes e no teto da arena (e fica mais forte)
    if (a.ricocheteia && !cen.atravessaLados) {
      if ((p.x < p.raio && p.vx < 0) || (p.x > FIS.largura - p.raio && p.vx > 0)) { p.vx = -p.vx; quicouDisco(M, p); }
      if (p.y < p.raio && p.vy < 0) { p.vy = -p.vy; quicouDisco(M, p); }
    }
    if (p.x < -60 || p.x > FIS.largura + 60 || p.y > 820 || p.y < -400) { p.vivo = false; continue; }
    if (cen.quicaParede && (p.x < 0 || p.x > FIS.largura) && !a.atravessa) { p.vx = -p.vx; p.x = limitar(p.x, 0, FIS.largura); }
    if (p.y > lava) { if (a.explode) explodirProjetil(M, p); else { p.vivo = false; if (typeof Efeitos !== "undefined") Efeitos.fumaca(p.x, lava); } continue; }

    // plataformas
    if (!a.atravessa && colidirProjetil(M, p, xa, ya, sinal)) continue;

    // bolinhas
    for (let k = 0; k < 2; k++) {
      const b = M.bolinhas[k];
      if (!b.viva || b.lado === p.dono) continue;
      if (p.hit[k] > 0) { p.hit[k]--; continue; }
      const dx = b.x - p.x, dy = b.y - p.y, rr = b.r + p.raio;
      if (dx * dx + dy * dy > rr * rr) continue;
      // v21.2: no dash o tiro atravessa (um anel branco marca o desvio)
      if (b.dashT > 0) { p.hit[k] = 30; if (typeof Efeitos !== "undefined" && !M.mudo) Efeitos.anel(b.x, b.y, "#ffffff", b.r * 1.3); continue; }
      acertouBolinha(M, p, b, k);
      if (!p.vivo) break;
    }
  }
  // remove os mortos (sem criar lista nova)
  let n = 0;
  for (let i = 0; i < M.proj.length; i++) if (M.proj[i].vivo) M.proj[n++] = M.proj[i];
  M.proj.length = n;
}

function acertouBolinha(M, p, b, k) {
  const a = p.a;
  // carta reflexo: o tiro volta para quem atirou
  if (b.efeitos.reflexo > 0) {
    p.vx = -p.vx; p.vy = -p.vy; p.dono = b.lado; p.cor = b.cor;
    p.x += p.vx * 2; p.y += p.vy * 2;
    if (typeof Efeitos !== "undefined") Efeitos.anel(p.x, p.y, "#f783ac", 26);
    somJogo(M, "reflexo");
    return;
  }
  // v19: a bomba grudenta gruda em quem acerta (explode no timer)
  if (a.grudaNele) {
    p.preso = b; p.ox = limitar(p.x - b.x, -b.r * 0.7, b.r * 0.7); p.oy = limitar(p.y - b.y, -b.r * 0.7, b.r * 0.7);
    p.passos = Math.max(p.passos, a.timer - 60);         // 1 s para fugir (ou correr para abraçar o outro)
    b.bombaGrudada = p;
    somJogo(M, "s_gosma");
    if (typeof ArteArmas !== "undefined" && ArteArmas.soltar) ArteArmas.soltar("gosma", p.x, p.y, 5);
    return;
  }
  if (a.explode && !a.perfura) { explodirProjetil(M, p, b); return; }
  const dono = M.bolinhas[p.dono - 1];
  const len = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
  const vidaAntes = b.vida;
  causarDano(M, b, a.dano * (p.mult || 1), dono, p.vx / len, p.vy / len, (a.empurra || 1.2) * (p.mult > 1 ? Math.min(2, p.mult) : 1), p.x, p.y);
  aplicarEfeitosDoTiro(M, a, b, dono, p);
  if (a.vampiro && dono && dono.viva) curar(M, dono, (vidaAntes - Math.max(0, b.vida)) * a.vampiro);
  if (a.perfura) p.hit[k] = PULSO_PERFURA;
  else p.vivo = false;
}

// efeitos que um tiro deixa em quem ele acerta (também usados pela explosão)
function aplicarEfeitosDoTiro(M, a, b, dono, p) {
  if (!b.viva) return;
  const ef = b.efeitos;
  if (a.congela) ef.lento = Math.max(ef.lento || 0, a.congela);
  if (a.fogo) ef.fogo = Math.max(ef.fogo || 0, a.fogo);
  // v19.6: a gosma prendia sem saída (gruda 1,6 s e o bot atirava de novo a cada 0,6 s). Agora não gruda de novo
  // enquanto está grudado nem por 1,2 s depois que solta, e na pessoa contra a máquina gruda por menos tempo
  if (a.gruda && !(ef.grudado > 0) && !(ef.imuneGosma > 0)) ef.grudado = a.gruda * (b.humano && M.contraBot ? 0.7 : 1);
  if (a.infla) { if (!(ef.inflado > 0)) somJogo(M, "s_inflou"); ef.inflado = Math.max(ef.inflado || 0, a.infla); b.vy -= 3; }
  if (a.bolha && !(ef.bolha > 0) && !(ef.imuneBolha > 0)) { ef.bolha = a.bolha; b.bolhaDono = dono ? dono.lado : 0; b.vy = Math.min(b.vy, -1); }
  if (a.levanta && p) {
    b.vy = -a.levanta * (b.humano && M.contraBot ? 0.85 : 1);
    b.vx = b.vx * 0.3 + (p.vx > 0 ? 1 : -1) * 3;
    b.noChao = false; b.lancado = true;
    somJogo(M, "s_tornado");
  }
  if (a.puxa && dono) {
    const dx = dono.x - b.x, dy = dono.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    b.vx = dx / d * a.puxa; b.vy = dy / d * a.puxa * 0.6 - 4;
  }
}

function curar(M, b, n) {
  if (!(n > 0.2) || !b.viva) return;
  b.vida = Math.min(100, b.vida + n);
  b.curou = (b.curou || 0) + n;
  if (b.curou >= 4 && typeof Efeitos !== "undefined") { Efeitos.texto(b.x, b.y - b.r - 12, "+" + Math.round(b.curou), "#69db7c", 0.9); b.curou = 0; }
}

// v19: o disco ganha força a cada quique (som de "ping" subindo de tom)
function quicouDisco(M, p) {
  const a = p.a;
  if (!a.cresce) return;
  p.mult = Math.min(1 + a.cresce * 5, (p.mult || 1) + a.cresce);
  p.vx *= 1.06; p.vy *= 1.06;
  p.hit[0] = p.hit[1] = 0;
  somJogo(M, "s_ping", 0.9 + p.mult * 0.15);
  if (typeof ArteArmas !== "undefined" && ArteArmas.soltar) ArteArmas.soltar("faisca", p.x, p.y, 3);
}

// v19: ímã: os tiros do oponente que passam perto são puxados e engolidos; o oponente perto faz o ímã curvar nele
function imaPuxa(M, p, a) {
  const R = a.ima;
  for (let i = 0; i < M.proj.length; i++) {
    const q = M.proj[i];
    if (q === p || !q.vivo || q.dono === p.dono || q.a.tipo === "mina" || q.a.tipo === "torreta" || q.a.ima) continue;
    const dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
    if (d2 > R * R) continue;
    const d = Math.sqrt(d2) || 1;
    if (d < p.raio + q.raio + 6) {
      q.vivo = false;
      if (typeof ArteArmas !== "undefined" && ArteArmas.soltar) ArteArmas.soltar("faisca", q.x, q.y, 3);
      continue;
    }
    const f = 1.1 * (1 - d / R) + 0.25;
    q.vx += dx / d * f; q.vy += dy / d * f;
  }
  const o = M.bolinhas[p.dono === 1 ? 1 : 0];
  if (o.viva && !(o.efeitos.fantasma > 0)) {
    const dx = o.x - p.x, dy = o.y - p.y;
    if (dx * dx + dy * dy < R * R * 0.6) teleguiar(M, p, 0.16);
  }
}

// v19: o soprador empurra para longe os tiros do oponente que o vento encosta
function sopraTiros(M, p) {
  if ((M.passo & 1) !== 0) return;
  for (let i = 0; i < M.proj.length; i++) {
    const q = M.proj[i];
    if (!q.vivo || q.dono === p.dono || q.a.tipo === "mina" || q.a.tipo === "torreta" || q.a.atrai) continue;
    const dx = q.x - p.x, dy = q.y - p.y;
    if (dx * dx + dy * dy > (p.raio + q.raio + 22) * (p.raio + q.raio + 22)) continue;
    q.vx = q.vx * 0.55 + p.vx * 0.8; q.vy = q.vy * 0.55 + p.vy * 0.8;
  }
}

// O ponto (com o raio do tiro) está dentro de uma plataforma grossa? (usado pela linha da mira)
function dentroDeSolida(M, x, y, raio) {
  const r = raio * 0.5;
  for (let k = 0; k < M.plats.length; k++) {
    const pl = M.plats[k];
    if (!pl.fina && x + r >= pl.x && x - r <= pl.x + pl.w && y + r >= pl.y && y - r <= pl.y + pl.h) return true;
  }
  return false;
}

function colidirProjetil(M, p, xa, ya, sinal) {
  const a = p.a;
  for (let k = 0; k < M.plats.length; k++) {
    const pl = M.plats[k];
    const x = pl.x, y = pl.y;
    if (p.x + p.raio * 0.5 < x || p.x - p.raio * 0.5 > x + pl.w || p.y + p.raio * 0.5 < y || p.y - p.raio * 0.5 > y + pl.h) continue;
    // v19: bola de boliche: pousa em cima e rola; batendo de lado, volta
    if (a.rola) {
      if (sinal > 0 && p.vy >= 0 && ya <= y + 4) {
        if (Math.abs(p.vy) > 4) { somJogo(M, "s_boliche"); if (typeof Efeitos !== "undefined") Efeitos.poeira(p.x, y); }
        p.y = y - p.raio * 0.5; p.vy = 0;
        if (Math.abs(p.vx) < 5) p.vx = (p.vx >= 0 ? 1 : -1) * 5;
        continue;
      }
      if (pl.fina) continue;
      const deLado = xa < x || xa > x + pl.w;
      if (deLado) { p.vx = -p.vx * 0.85; p.x = xa; } else { p.vy = Math.abs(p.vy) * 0.4; p.y = ya; }
      return false;
    }
    // tiro reto atravessa plataforma fina; o que cai (granada) pousa nela
    if (pl.fina) {
      if (!a.grav || sinal < 0 || p.vy < 0 || ya > y + 2) continue;
      p.y = y - p.raio * 0.5;
      if (p.quicas > 0) { p.vy = -Math.abs(p.vy) * 0.6; p.quicas--; }
      else { p.vy = 0; p.parado = true; if (!a.timer) { p.vivo = false; impactoParede(M, p); return true; } }
      continue;
    }
    if (p.quicas > 0) {
      // quica: descobre o lado pelo ponto anterior
      const veioDeLado = xa < x || xa > x + pl.w;
      if (veioDeLado) { p.vx = -p.vx * (a.timer ? 0.6 : 1); p.x = xa; }
      else { p.vy = -p.vy * (a.timer ? 0.55 : 0.95); p.y = ya; if (a.timer) p.vx *= 0.8; }
      p.quicas--;
      if (a.cresce) quicouDisco(M, p);
      else if (a.timer || a.visual === "bola_pula") somJogo(M, "quique");
      return false;
    }
    if (a.grudaNele) { p.x = xa; p.y = ya; p.vx = 0; p.vy = 0; p.parado = true; return false; }
    if (a.timer) { p.x = xa; p.y = ya; p.vx *= -0.2; p.vy = 0; p.parado = true; return false; }
    if (a.explode) { p.x = xa; p.y = ya; explodirProjetil(M, p); return true; }
    if (a.volta) { p.passos = Math.max(p.passos, (a.vida || 110) * 0.42); p.x = xa; p.y = ya; return false; }
    p.vivo = false;
    impactoParede(M, p);
    return true;
  }
  return false;
}

function impactoParede(M, p) {
  // tiro do jogador batendo na parede: som de "tec" para ele perceber que a plataforma está segurando
  if (M.bolinhas[p.dono - 1] && M.bolinhas[p.dono - 1].humano && (M.passo & 3) === 0) somJogo(M, "quique");
  if (typeof Efeitos === "undefined") return;
  if (p.visual === "chama" || p.visual === "vento" || p.visual === "agua" || p.visual === "confete") return;
  Efeitos.impacto(p.x, p.y, Math.atan2(p.vy, p.vx), p.cor);
}

function teleguiar(M, p, k) {
  const o = M.bolinhas[p.dono === 1 ? 1 : 0];
  if (!o.viva || o.efeitos.fantasma > 0) return;
  const alvo = Math.atan2(o.y - p.y, o.x - p.x);
  const atual = Math.atan2(p.vy, p.vx);
  const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  const novo = atual + limitar(difAng(alvo, atual), -k, k);
  p.vx = Math.cos(novo) * v; p.vy = Math.sin(novo) * v;
}

function voltarAoDono(M, p) {
  const d0 = M.bolinhas[p.dono - 1];
  const dx = d0.x - p.x, dy = d0.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
  p.vx += dx / d * 1.1; p.vy += dy / d * 1.1;
  const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (v > 15) { p.vx *= 15 / v; p.vy *= 15 / v; }
  if (d < d0.r + 10) p.vivo = false;
}

function atrair(M, p, a) {
  for (let k = 0; k < 2; k++) {
    const b = M.bolinhas[k];
    if (!b.viva || b.lado === p.dono) continue;
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d < 320) { const f = a.atrai * (1 - d / 320); b.vx += dx / d * f; b.vy += dy / d * f; }
  }
}

function projetilPortal(M, p) {
  if (p.portalCd > 0) { p.portalCd--; return; }
  const portais = M.cen.portais;
  for (let i = 0; i < portais.length; i++) for (let k = 0; k < 2; k++) {
    const a = portais[i][k], o = portais[i][1 - k];
    const dx = p.x - a.x, dy = p.y - a.y;
    if (dx * dx + dy * dy < 30 * 30) { p.x = o.x; p.y = o.y; p.portalCd = 30; return; }
  }
}

// ---------- explosões e dano ----------
function explodirProjetil(M, p, atingido) {
  if (!p.vivo) return;
  p.vivo = false;
  const a = p.a;
  explosao(M, p.x, p.y, a.explode || 40, a.danoExplosao || a.dano, M.bolinhas[p.dono - 1], a, atingido);
  if (p.preso && p.preso.bombaGrudada === p) p.preso.bombaGrudada = null;
  if (a.fragmentos) criarFragmentos(M, p, a.fragmentos);
}

// Explosão: dano cai do centro para a borda (mínimo 35%); quem atirou leva 40% (cuidado com a bazuca!)
function explosao(M, x, y, raio, dano, dono, a, atingidoDireto) {
  if (a && a.gruda) {
    // gosma: espirra verde em vez de explodir em fogo
    if (typeof ArteArmas !== "undefined" && ArteArmas.soltar) ArteArmas.soltar("gosma", x, y, 9);
    somJogo(M, "s_gosma");
  } else {
    if (typeof Efeitos !== "undefined") {
      if (a && a.congela) Efeitos.congelar(x, y);
      Efeitos.explosao(x, y, raio);
    }
    somJogo(M, raio >= 70 ? "explosao" : "explosao_peq");
  }
  for (let k = 0; k < 2; k++) {
    const b = M.bolinhas[k];
    if (!b.viva) continue;
    const dx = b.x - x, dy = b.y - y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d > raio + b.r && b !== atingidoDireto) continue;
    const queda = b === atingidoDireto ? 1 : Math.max(0.35, 1 - Math.max(0, d - b.r) / raio);
    const proprio = dono && b === dono ? 0.4 : 1;
    const nx = dx / d, ny = dy / d - 0.35;
    causarDano(M, b, dano * queda * proprio, dono, nx, ny, (a && a.empurra || (a && a.gruda ? 2 : 9)) * queda, x, y);
    if (a && (a.congela || a.fogo || a.gruda) && !(a.gruda && b === dono)) aplicarEfeitosDoTiro(M, a, b, dono, null);
  }
  // explosão detona minas e granadas por perto (reação em cadeia)
  for (let i = 0; i < M.proj.length; i++) {
    const q = M.proj[i];
    if (!q.vivo || !(q.a.tipo === "mina" || q.a.timer)) continue;
    const dx = q.x - x, dy = q.y - y;
    if (dx * dx + dy * dy < raio * raio * 0.6) { q.passos = 1e6; if (q.a.tipo === "mina") q.detonar = true; }
  }
}

// dano: furia dobra o dano de quem bate; escudo segura até 40
function causarDano(M, b, dano, atacante, nx, ny, empurra, fx, fy) {
  if (b.dashT > 0 && atacante && atacante !== b) return;   // v21.2: no dash, golpe/explosão/laser de quem ataca não pega
  if (!b.viva || dano <= 0 && !empurra) return;
  if (atacante && atacante !== b && atacante.efeitos.furia > 0) dano *= 2;
  if (atacante && atacante !== b && atacante.efeitos.super > 0) dano *= SUPER.mult;
  if (atacante && atacante !== b && M.multDano) dano *= M.multDano;
  if (atacante && atacante.lado === 2 && M.multBot) dano *= M.multBot * tensao(M, b);
  if (atacante && atacante !== b && atacante.lado === 1 && M.multJogador) dano *= M.multJogador;
  // poder (melhorias compradas; rivais também têm): força de quem bate e vida de quem apanha
  if (atacante && atacante !== b && atacante.forca) dano *= atacante.forca;
  if (b.defesa) dano /= b.defesa;
  // contra o bot, a pessoa é empurrada menos nos mapas de empurrão forte (dojô 2,2x -> ~1,5x)
  let mult = (M.cen.empurrao || 1);
  if (b.humano && M.contraBot && mult > 1) mult = 1 + (mult - 1) * 0.4;
  b.vx += nx * empurra * mult;
  b.vy += ny * empurra * mult * 0.8 - (empurra > 3 ? 1.5 : 0);
  if (dano <= 0) return;
  if (b.escudoHP > 0 && b.efeitos.escudo > 0) {
    const absorve = Math.min(b.escudoHP, dano);
    b.escudoHP -= absorve; dano -= absorve;
    if (b.escudoHP <= 0) b.efeitos.escudo = 0;
    if (typeof Efeitos !== "undefined") Efeitos.anel(b.x, b.y, "#4dabf7", b.r + 10);
    if (dano <= 0) return;
  }
  // 1ª partida da vida: a vida de quem joga não passa de um mínimo (a tensão fica, a derrota não)
  if (b.humano && M.vidaMinima && b.vida - dano < M.vidaMinima) {
    dano = Math.max(0, b.vida - M.vidaMinima);
    if (dano <= 0) { b.flash = 0.6; return; }
  }
  b.vida -= dano;
  b.danoRecebido = (b.danoRecebido || 0) + dano;
  if (atacante && atacante !== b) { b.ultimoAtacante = atacante.lado; b.ultimaArmaAtk = atacante.arma; }
  b.flash = 1;
  b.dor = 0.35;
  // a bolinha amassa na direção do golpe e volta sozinha (animarBolinha) — v14
  if (dano >= 3 && b.escalaX !== undefined) {
    const k = Math.min(0.3, 0.08 + dano / 110);
    if (Math.abs(nx || 0) >= Math.abs(ny || 0)) { b.escalaX = 1 - k; b.escalaY = 1 + k * 0.85; }
    else { b.escalaX = 1 + k * 0.85; b.escalaY = 1 - k; }
  }
  if (atacante && atacante !== b) {
    M.stats.dano[atacante.lado - 1] += dano;
    M.stats.acertos[atacante.lado - 1]++;
    carregarSuper(M, atacante, b, dano);
  }
  // ---- sensação de acerto ("juice") ----
  let tomAcerto = 1;
  if (atacante && atacante !== b && atacante.humano && !M.mudo) {
    // combo: acertos seguidos em menos de 1,3 s
    const c = atacante.combo || (atacante.combo = { n: 0, ate: 0, mostra: 0 });
    if (dano >= 3) {
      c.n = M.t < c.ate ? c.n + 1 : 1;
      c.ate = M.t + 1.3;
      if (c.n >= 3) { c.mostra = 1; if (c.n === 3 || c.n % 5 === 0) somJogo(M, "combo", 1 + Math.min(c.n, 10) * 0.04); }
      tomAcerto = 1 + Math.min(c.n - 1, 10) * 0.055;
      atacante.marca = 0.18;                               // marcador de acerto na mira
      // micro-pausa no impacto (no máximo a cada 0,12 s, só em acerto que pesa)
      if (dano >= 6 && M.t - (M.ultimaPausa || -1) > 0.12) { M.pausa = Math.max(M.pausa || 0, dano >= 20 ? 5 : 3); M.ultimaPausa = M.t; }
    }
  }
  if (b.humano && atacante && atacante !== b && !M.mudo && dano >= 3) M.dorTela = Math.min(1, (M.dorTela || 0) + dano / 35);
  // reações do bot
  if (atacante && atacante !== b && !b.humano) {
    if (dano >= 20 || (atacante.combo && atacante.combo.n >= 4)) emote(b, "?!", 0.9);
    else if (b.vida < 30 && b.vida + dano >= 30) emote(b, "!!", 0.9);
  }
  if (typeof Efeitos !== "undefined") {
    Efeitos.acerto(fx === undefined ? b.x : fx, fy === undefined ? b.y : fy, b.cor);
    if (dano >= 4) Efeitos.texto(b.x, b.y - b.r - 8, "-" + Math.round(dano), dano >= 25 ? "#ffd43b" : "#ffffff", dano >= 25 ? 1.35 : undefined);
    if (dano >= 20) Efeitos.tremer(Math.min(10, dano / 5));
  }
  // v20.6: golpe forte vibra no celular (em quem leva ou em quem deu, se for gente)
  if (dano >= 20 && !M.mudo && (b.humano || (atacante && atacante !== b && atacante.humano))) vibrar(18);
  if (atacante && atacante !== b && atacante.humano) somJogo(M, "acerto_meu", tomAcerto);
  else if (b.humano) somJogo(M, "dor");
  else somJogo(M, "acerto");
  if (b.vida <= 0) matar(M, b);
}

// v21.5: medidor de SUPER (o "especial" que enche dos duelos famosos: Basketball Stars, Bowmasters, Supreme Duelist).
// Enche batendo e também apanhando (quem está perdendo chega lá: virada). Cheio, liga sozinho (sem botão novo):
// 5 s com dano x1,5 e aura dourada. Contra o bot a pessoa enche mais rápido que ele.
const SUPER = { dur: 5, mult: 1.5 };
function carregarSuper(M, a, b, dano) {
  const cb = M.contraBot;
  if (!(a.efeitos.super > 0)) ganharSuper(M, a, dano * (cb ? (a.humano ? 1 : 0.6) : 0.8));
  if (!(b.efeitos.super > 0) && b.vida > 0) ganharSuper(M, b, dano * (cb ? (b.humano ? 0.6 : 0.35) : 0.5));
}
function ganharSuper(M, b, n) {
  b.super = Math.min(100, (b.super || 0) + n);
  if (b.super >= 100 && b.viva) ativarSuper(M, b);
}
function ativarSuper(M, b) {
  b.super = 0;
  b.efeitos.super = SUPER.dur;
  M.ultimoSuper = { lado: b.lado, t: M.t };
  if (typeof Efeitos !== "undefined") {
    Efeitos.anel(b.x, b.y, "#ffd43b", 80);
    Efeitos.anel(b.x, b.y, "#fff3a6", 50);
    Efeitos.texto(b.x, b.y - b.r - 40, "SUPER!", "#ffd43b", 1.6);
    if (b.humano) Efeitos.texto(b.x, b.y - b.r - 8, t("super_dica"), "#fff3a6", 0.9);
    Efeitos.tremer(b.humano ? 7 : 4);
  }
  somJogo(M, "super");
  if (b.humano && !M.mudo) vibrar([20, 30, 20]);
}

function matar(M, b) {
  if (!b.viva) return;
  b.vida = 0;
  b.viva = false;
  // v21.3: K.O. "boneco de pano": quem perde sai voando girando e só estoura no fim do voo (desenho.js desenharVoos).
  // Nos duelos famosos do Poki (Rooftop Snipers, série Random) a física engraçada do K.O. é metade da graça
  if (typeof Efeitos !== "undefined") Efeitos.tremer(12);
  const mat = M.bolinhas[b.lado === 1 ? 1 : 0], lado = b.x === mat.x ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(b.x - mat.x);
  (M.voos || (M.voos = [])).push({ lado: b.lado, x: b.x, y: b.y, r: b.r, cor: b.cor, vx: lado * (4.5 + Math.random() * 3), vy: -13 - Math.random() * 3,
    vr: lado * (0.22 + Math.random() * 0.12), t0: typeof jogo !== "undefined" && jogo ? jogo.tempoReal : 0, g: gravSinal(M.cen, M.t), estourou: false });
  somJogo(M, "estouro");
  // golpe final: pausa maior, K.O. e câmera lenta com zoom em quem caiu (desenho.js)
  const matador = M.bolinhas[b.lado === 1 ? 1 : 0];
  if (!M.mudo) {
    // v19.6: o K.O. que FECHA a partida para mais e treme mais que os outros (antes parecia igual a qualquer ponto)
    const final = typeof jogo !== "undefined" && jogo && jogo.modo !== "sobrevivencia" && matador.viva &&
      jogo.pontos[matador.lado - 1] + 1 >= jogo.alvo;
    M.pausa = Math.max(M.pausa || 0, final ? 16 : 9);
    M.ko = { x: b.x, y: b.y, humano: !!matador.humano, perfeito: !(matador.danoRecebido > 0), final: final };
    if (typeof Efeitos !== "undefined") Efeitos.tremer(final ? 30 : 20);
    if (matador.humano || b.humano) vibrar(final ? [30, 40, 60] : 30);   // v20.6 (substitui a do golpe no mesmo passo)
    if (final && matador.humano) somJogo(M, "explosao", 0.7);
    if (matador.humano) somJogo(M, "ko");
  }
  if (matador.viva && typeof provocar === "function") provocar(M, matador, "venceu");
  M.morreu = M.morreu || [];
  M.morreu.push(b.lado);
}

// ---------- tipos especiais ----------
function laser(M, b, a, boca, ang) {
  const pontos = [{ x: boca.x, y: boca.y }];
  let x = boca.x, y = boca.y, dx = Math.cos(ang), dy = Math.sin(ang);
  let quicas = a.quicaParede || 0;
  const o = oponente(M, b);
  let acertou = false;
  for (let seg = 0; seg < 6; seg++) {
    let fim = 1600, nx = 0, ny = 0;
    // parede da arena
    const bx = dx > 0 ? (FIS.largura - x) / dx : dx < 0 ? -x / dx : Infinity;
    const by = dy > 0 ? (FIS.altura - y) / dy : dy < 0 ? -y / dy : Infinity;
    if (bx < fim) { fim = bx; nx = 1; ny = 0; }
    if (by < fim) { fim = by; nx = 0; ny = 1; }
    if (!a.perfuraParede) for (let k = 0; k < M.plats.length; k++) {
      const p = M.plats[k];
      if (p.fina) continue;
      const f = fracaoSegmentoRet(x, y, x + dx * fim, y + dy * fim, p.x, p.y, p.w, p.h);
      if (f >= 0 && f * fim < fim) {
        const d = f * fim;
        // normal do lado atingido
        const hx = x + dx * d, hy = y + dy * d;
        const lado = Math.min(Math.abs(hx - p.x), Math.abs(hx - p.x - p.w)) < Math.min(Math.abs(hy - p.y), Math.abs(hy - p.y - p.h));
        fim = d; nx = lado ? 1 : 0; ny = lado ? 0 : 1;
      }
    }
    const x2 = x + dx * fim, y2 = y + dy * fim;
    // acertou o oponente neste trecho?
    if (o.viva && !acertou && distPontoSegmento(o.x, o.y, x, y, x2, y2) < o.r + 5) {
      if (o.efeitos.reflexo > 0) {
        // o reflexo para o laser na hora
        const k = limitar(((o.x - x) * dx + (o.y - y) * dy), 0, fim) - o.r;
        pontos.push({ x: x + dx * k, y: y + dy * k });
        if (typeof Efeitos !== "undefined") Efeitos.anel(o.x, o.y, "#f783ac", o.r + 12);
        break;
      }
      acertou = true;
      causarDano(M, o, a.dano, b, dx, dy, a.empurra || 3, o.x, o.y);
    }
    pontos.push({ x: x2, y: y2 });
    if (quicas <= 0 || fim >= 1600) break;
    quicas--;
    if (nx) dx = -dx; if (ny) dy = -dy;
    x = x2 + dx * 0.5; y = y2 + dy * 0.5;
  }
  M.feixes.push({ pontos: pontos, visual: a.visual, vida: 1, dur: a.visual === "railgun" ? 0.45 : 0.3, cor: b.cor });
  if (typeof Efeitos !== "undefined") {
    const u = pontos[pontos.length - 1];
    Efeitos.fagulhas(u.x, u.y, b.cor, 6);
  }
}

function feixeContinuo(M, b, a) {
  const boca = pontaDoCano(b, b.mira);
  const dx = Math.cos(b.mira), dy = Math.sin(b.mira);
  let fim = a.alcance;
  for (let k = 0; k < M.plats.length; k++) {
    const p = M.plats[k];
    if (p.fina) continue;
    const f = fracaoSegmentoRet(boca.x, boca.y, boca.x + dx * fim, boca.y + dy * fim, p.x, p.y, p.w, p.h);
    if (f >= 0) fim = f * fim;
  }
  const o = oponente(M, b);
  const x2 = boca.x + dx * fim, y2 = boca.y + dy * fim;
  if (o.viva && distPontoSegmento(o.x, o.y, boca.x, boca.y, x2, y2) < o.r + 6 && !(o.efeitos.reflexo > 0)) {
    causarDano(M, o, a.dano, b, dx, dy, 0.25, o.x, o.y);
  }
  M.feixes.push({ pontos: [{ x: boca.x, y: boca.y }, { x: x2, y: y2 }], visual: "feixe", vida: 1, dur: 2 / 60, cor: b.cor });
  if ((M.passo & 7) === 0) somJogo(M, "feixe");
}

function choque(M, b, a, boca, extra) {
  const o = oponente(M, b);
  const dx = o.x - boca.x, dy = o.y - boca.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  let alvoX, alvoY;
  if (o.viva && d < a.alcance && !(o.efeitos.fantasma > 0) && linhaLivre(boca.x, boca.y, o.x, o.y, M.plats, M.t)) {
    alvoX = o.x; alvoY = o.y;
    if (!(o.efeitos.reflexo > 0)) causarDano(M, o, a.dano * (extra ? 0.6 : 1), b, dx / d, dy / d, 3, o.x, o.y);
    o.efeitos.lento = Math.max(o.efeitos.lento || 0, 0.3);
  } else {
    alvoX = boca.x + Math.cos(b.mira) * a.alcance * 0.55;
    alvoY = boca.y + Math.sin(b.mira) * a.alcance * 0.55 + (Math.random() - 0.5) * 60;
  }
  M.feixes.push({ pontos: [{ x: boca.x, y: boca.y }, { x: alvoX, y: alvoY }], visual: "raio", vida: 1, dur: 0.22, cor: b.cor });
}

function golpe(M, b, a, vezes) {
  b.golpe = 1;
  const o = oponente(M, b);
  const alcance = a.alcance + o.r;
  const dx = o.x - b.x, dy = o.y - b.y;
  if (o.viva && dx * dx + dy * dy < alcance * alcance && dx * b.dir > -14) {
    causarDano(M, o, a.dano * vezes, b, b.dir * 0.85, -0.5, a.empurra, o.x - b.dir * o.r, o.y);
  }
  // o golpe rebate os tiros do oponente que estão perto
  for (let i = 0; i < M.proj.length; i++) {
    const p = M.proj[i];
    if (!p.vivo || p.dono === b.lado || p.a.tipo === "mina") continue;
    const ex = p.x - b.x, ey = p.y - b.y;
    if (ex * ex + ey * ey < (a.alcance + 10) * (a.alcance + 10) && ex * b.dir > -10) {
      p.vx = Math.abs(p.vx) * b.dir; p.dono = b.lado; p.cor = b.cor; p.hit[0] = p.hit[1] = 0;
      if (typeof Efeitos !== "undefined") Efeitos.fagulhas(p.x, p.y, "#ffffff", 5);
    }
  }
}

function colocarMina(M, b, a, extra) {
  // no máximo 3 minas (ou cascas) de cada um: a mais velha some (a mina explode)
  const minhas = M.proj.filter(function(p) { return p.vivo && p.a === a && p.dono === b.lado; });
  if (minhas.length >= 3) { if (a.escorrega) minhas[0].vivo = false; else minhas[0].detonar = true; }
  // a casca de banana é jogada um pouco para a frente; a mina cai no pé
  const joga = a.escorrega ? 1 : 0;
  M.proj.push({ x: b.x + b.dir * b.r * 0.8 * joga, y: b.y + b.r * (joga ? -0.2 : 0.4), vx: b.vx * 0.3 + b.dir * (4.5 + (extra ? 2.5 : 0)) * joga, vy: -4 * joga,
    a: a, dono: b.lado, cor: b.cor, visual: a.visual, ang: 0,
    raio: a.raio, passos: 0, t: 0, quicas: 0, vivo: true, hit: [0, 0], armada: false, parado: false, portalCd: 0, voltas: 0, timer01: 0 });
}

function atualizarMina(M, p, g) {
  const a = p.a;
  if (!p.parado) {
    p.vy += g; p.x += p.vx; p.y += p.vy;
    pousarNoChao(M, p, g);
    if (p.parado) p.vx = 0;
    if (p.y > 800 || p.y < -100 || p.y > lavaY(M.cen, M.t)) { p.vivo = false; return; }
  } else if (p.chao && p.chao.move) {
    // acompanha a plataforma que anda
    posPlat(p.chao, M.t - FIS.dt); const ax = PX, ay = PY; posPlat(p.chao, M.t);
    p.x += PX - ax; p.y += PY - ay;
  }
  if (p.passos > (a.escorrega ? 30 : 48)) p.armada = true;
  const o = M.bolinhas[p.dono === 1 ? 1 : 0];
  if (a.escorrega) {
    // casca de banana: quem pisa sai escorregando sem controle (e gira)
    if (p.armada && o.viva && o.noChao && !(o.efeitos.imuneBanana > 0) && Math.abs(o.x - p.x) < o.r * 0.7 + p.raio && Math.abs(o.y + o.r - p.y) < 24) {
      p.vivo = false;
      const lado = Math.abs(o.vx) > 0.5 ? Math.sign(o.vx) : (o.x >= p.x ? 1 : -1);
      o.efeitos.escorrega = a.escorrega;
      o.vx = lado * 12; o.vy = -5; o.noChao = false;
      causarDano(M, o, a.dano, M.bolinhas[p.dono - 1], lado, -0.4, 0, o.x, o.y + o.r * 0.5);
      somJogo(M, "s_escorregou");
      if (typeof ArteArmas !== "undefined" && ArteArmas.soltar) ArteArmas.soltar("banana", p.x, p.y, 1);
    }
    return;
  }
  if (p.detonar || (p.armada && o.viva && Math.abs(o.x - p.x) < o.r + 46 && Math.abs(o.y - p.y) < o.r + 46)) {
    p.vivo = false;
    explosao(M, p.x, p.y, a.explode, a.dano, M.bolinhas[p.dono - 1], a);
  }
}

// cai até pousar numa plataforma (minas, cascas e torretas)
function pousarNoChao(M, p, g) {
  for (let k = 0; k < M.plats.length; k++) {
    const pl = M.plats[k];
    if (p.x < pl.x || p.x > pl.x + pl.w) continue;
    if (g > 0 && p.y + p.raio >= pl.y && p.y - p.vy + p.raio <= pl.y + 2) { p.y = pl.y - p.raio; p.parado = true; p.chao = pl; }
    if (g < 0 && p.y - p.raio <= pl.y + pl.h && p.y - p.vy - p.raio >= pl.y + pl.h - 2) { p.y = pl.y + pl.h + p.raio; p.parado = true; p.chao = pl; }
  }
  if (!p.parado && !M.cen.queda && !M.cen.lava && g > 0 && p.y > FIS.altura - p.raio) { p.y = FIS.altura - p.raio; p.parado = true; }
}

// ---------- v19: torreta (monta no chão e atira sozinha) ----------
function montarTorreta(M, b, a) {
  // uma por bolinha: a nova substitui a antiga
  for (let i = 0; i < M.proj.length; i++) { const q = M.proj[i]; if (q.vivo && q.a === a && q.dono === b.lado) { q.vivo = false; if (typeof Efeitos !== "undefined") Efeitos.fumaca(q.x, q.y); } }
  M.proj.push({ x: b.x + b.dir * b.r * 1.2, y: b.y, vx: b.dir * 3 + b.vx * 0.3, vy: -3, a: a, dono: b.lado, cor: b.cor, visual: "torreta",
    raio: a.raio, passos: 0, t: 0, quicas: 0, vivo: true, hit: [0, 0], parado: false, portalCd: 0, voltas: 0, timer01: 0,
    tiros: a.tiros, prox: 0.6, mira: b.dir > 0 ? 0 : Math.PI, recuo: 0 });
}

function atualizarTorreta(M, p, g) {
  const a = p.a;
  if (!p.parado) {
    p.vy += g; p.x += p.vx; p.y += p.vy;
    pousarNoChao(M, p, g);
    if (p.parado) { p.vx = 0; p.vy = 0; somJogo(M, "s_torreta"); }
    if (p.y > 800 || p.y < -100 || p.y > lavaY(M.cen, M.t)) { p.vivo = false; return; }
    return;
  }
  if (p.chao && p.chao.move) { posPlat(p.chao, M.t - FIS.dt); const ax = PX, ay = PY; posPlat(p.chao, M.t); p.x += PX - ax; p.y += PY - ay; }
  if (p.recuo > 0) p.recuo = Math.max(0, p.recuo - FIS.dt * 6);
  const o = M.bolinhas[p.dono === 1 ? 1 : 0];
  const cx = p.x, cy = p.y - p.raio * 0.9;
  if (o.viva && !(o.efeitos.fantasma > 0)) {
    const alvo = Math.atan2(o.y - cy, o.x - cx);
    p.mira += limitar(difAng(alvo, p.mira), -0.12, 0.12);
  }
  p.prox -= FIS.dt;
  if (p.prox > 0) return;
  p.prox = a.intervalo;
  const dx = o.x - cx, dy = o.y - cy;
  if (!o.viva || dx * dx + dy * dy > a.alcance * a.alcance || o.efeitos.fantasma > 0 || !linhaLivre(cx, cy, o.x, o.y, M.plats, M.t)) { p.prox = 0.15; return; }
  if (Math.abs(difAng(Math.atan2(dy, dx), p.mira)) > 0.25) { p.prox = 0.05; return; }
  const dono = M.bolinhas[p.dono - 1];
  const bx = cx + Math.cos(p.mira) * 22, by = cy + Math.sin(p.mira) * 22;
  criarProjetil(M, { vx: 0, vy: 0, lado: p.dono, cor: p.cor }, TIRO_TORRETA, bx, by, p.mira + (Math.random() - 0.5) * 0.06);
  p.recuo = 1;
  if (dono) M.stats.tiros[p.dono - 1]++;
  somJogo(M, "s_pistola", 1.25);
  if (typeof ArteArmas !== "undefined" && ArteArmas.disparo) ArteArmas.disparo(TIRO_TORRETA, bx, by, p.mira, 1, M.mudo);
  p.tiros--;
  if (p.tiros <= 0) { p.vivo = false; if (typeof Efeitos !== "undefined") { Efeitos.fumaca(p.x, p.y - 10); Efeitos.fagulhas(p.x, p.y, "#ffd43b", 6); } }
}

// avisa onde vai cair (meteoro/relâmpago) e cai depois de "espera" segundos
function avisarCeu(M, dono, x, y, espera, a) {
  x = limitar(x, 30, FIS.largura - 30);
  M.avisos.push({ x: x, y: y, tempo: espera, total: espera, a: a, dono: dono, visual: a.visual === "relampago" ? "relampago" : "meteoro" });
}

function atualizarAvisos(M) {
  for (let i = M.avisos.length - 1; i >= 0; i--) {
    const v = M.avisos[i];
    v.tempo -= FIS.dt;
    if (v.tempo > 0) continue;
    M.avisos.splice(i, 1);
    const dono = v.dono ? M.bolinhas[v.dono - 1] : null;
    if (v.visual === "relampago") {
      M.feixes.push({ pontos: [{ x: v.x, y: -20 }, { x: v.x, y: v.y }], visual: "relampago", vida: 1, dur: 0.3, cor: "#fff" });
      somJogo(M, "trovao");
    }
    explosao(M, v.x, v.y, v.a.explode, v.a.dano, dono, v.a);
  }
}

// ---------- efeitos das cartas e do tempo ----------
function atualizarEfeitos(M, b) {
  const ef = b.efeitos;
  const bolhaAntes = ef.bolha > 0, grudadoAntes = ef.grudado > 0, escorregaAntes = ef.escorrega > 0;
  for (const k in ef) if (ef[k] > 0) ef[k] -= FIS.dt;
  // v19.6: depois de soltar da gosma ou de escorregar na banana, um tempinho sem pegar de novo (não vira prisão)
  if (grudadoAntes && !(ef.grudado > 0)) ef.imuneGosma = 1.2;
  if (escorregaAntes && !(ef.escorrega > 0)) ef.imuneBanana = 1.2;
  if (ef.fogo > 0 && b.viva) {
    if ((M.passo % 6) === 0) causarDano(M, b, 0.5, null, 0, 0, 0);
    if ((M.passo % 4) === 0 && typeof Efeitos !== "undefined") Efeitos.fogo(b.x + (Math.random() - 0.5) * b.r, b.y - b.r * 0.5);
  }
  // v19: bolha estoura (dano de quem prendeu); gosma pingando; inflado
  if (bolhaAntes && !(ef.bolha > 0) && b.viva) {
    const dono = b.bolhaDono ? M.bolinhas[b.bolhaDono - 1] : null;
    causarDano(M, b, 9, dono, 0, -1, 3, b.x, b.y - b.r);
    b.efeitos.imuneBolha = 1.4;                             // sem prender de novo logo em seguida (não vira prisão)
    somJogo(M, "s_estoura_bolha");
    if (typeof ArteArmas !== "undefined" && ArteArmas.soltar) ArteArmas.soltar("bolha", b.x, b.y, 8);
  }
  if (typeof ArteArmas !== "undefined" && ArteArmas.soltar && b.viva && (M.passo % 7) === 0) {
    if (ef.grudado > 0) ArteArmas.soltar("pingo", b.x + (Math.random() - 0.5) * b.r * 1.4, b.y + b.r * 0.6, 1);
    if (ef.escorrega > 0) ArteArmas.soltar("tonto", b.x, b.y - b.r - 8, 1);
  }
  b.r = ef.mini > 0 ? FIS.raioMini : ef.inflado > 0 ? FIS.raioInflado : FIS.raio;
  if (b.flash > 0) b.flash = Math.max(0, b.flash - FIS.dt * 6);
  if (b.dor > 0) b.dor -= FIS.dt;
}

function pegarCarta(M, b, id) {
  const c = CARTA[id];
  const o = oponente(M, b);
  if (c.duracao) b.efeitos[id] = c.duracao;
  if (id === "escudo") b.escudoHP = 40;
  if (id === "cura") { b.vida = Math.min(100, b.vida + 35); if (typeof Efeitos !== "undefined") Efeitos.texto(b.x, b.y - 40, "+35", "#51cf66"); }
  if (id === "congelar" && o.viva) {
    if (o.efeitos.reflexo > 0) b.efeitos.congelado = 1.6;
    else o.efeitos.congelado = 1.6;
    if (typeof Efeitos !== "undefined") Efeitos.congelar(o.x, o.y);
  }
  if (id === "chuva" && o.viva) {
    const chuva = { id: "chuva", explode: 70, dano: 18, empurra: 9, visual: "meteoro" };
    for (let i = 0; i < 5; i++) avisarCeu(M, b.lado, o.x + (Math.random() - 0.5) * 220, o.y, 0.8 + i * 0.32, chuva);
  }
  if (id === "mini") { b.r = FIS.raioMini; b.efeitos.inflado = 0; }
  M.ultimaCarta = { id: id, lado: b.lado, t: M.t };
  if (typeof Efeitos !== "undefined") Efeitos.anel(b.x, b.y, c.cor, 50);
  somJogo(M, "carta");
}

// ---------- caixas de arma e cartas no mapa ----------
// v19.7: as 10 armas novas da v19 (ficam fora das caixas e do começo da rodada quando M.soClassicas)
const ARMAS_V19 = { banana: 1, boliche: 1, bomba_grude: 1, disco: 1, gosma: 1, ima: 1, inflador: 1, tornado: 1, torreta: 1, vampiro: 1 };
// v19: roleta da 1ª rodada (o dono pediu as raras mais difíceis): comum 75%, rara 22%, lendária 3%.
// v20.5: vale para cada carta de arma da abertura (partida.js sortearArmaCarta)
const PESOS_ROLETA = [0, 75, 22, 3];
function sortearArma(M, inicio, roleta) {
  // pesos por raridade; a "Partida Lendária" só tem raras e lendárias
  // v18: nas 3 primeiras partidas a arma da rodada é mais "maluca" (raras e lendárias)
  // v19: 60 armas: os pesos por arma caem um pouco para a soma por raridade ficar parecida com a da v18.3
  const pesos = (M.lendaria ? [0, 0, 60, 40] : roleta ? PESOS_ROLETA : inicio ? (save.partidas <= 3 ? [0, 55, 35, 10] : [0, 85, 15, 0]) : [0, 66, 29, 5]).slice();
  // v19: SORTE (agente C, sorteJogador() de 0 a 1): contra a máquina, as caixas que caem puxam para raras e lendárias
  // (moderado: no máximo +60% no peso delas). Não vale para a arma do começo da rodada (é igual para os dois).
  if (!inicio && M.contraBot) {
    const sorte = limitar(typeof sorteJogador === "function" ? +sorteJogador() || 0 : 0, 0, 1);
    pesos[2] *= 1 + 0.6 * sorte; pesos[3] *= 1 + 0.6 * sorte;
  }
  const lista = ARMAS.filter(function(a) {
    if (!pesos[a.raridade]) return false;
    // v19.6: no começo (treino, rivais 1–5 da Bronze, 6 primeiras partidas) nada de arma que tira o controle
    if (M.semControle && (a.gruda || a.escorrega || a.bolha || a.infla)) return false;
    if (M.soClassicas && ARMAS_V19[a.id]) return false;
    if (inicio && (a.tipo === "mina" || a.tipo === "ceu" || a.tipo === "torreta")) return false;
    return true;
  });
  // roleta: o peso é do NÍVEL (comum 75%, rara 22%, lendária 3%), não de cada arma; depois uma arma do nível ao acaso
  if (roleta) {
    let sr = 0; for (let k = 1; k <= 3; k++) sr += pesos[k];
    let x = Math.random() * sr, nivel = 1;
    for (let k = 1; k <= 3; k++) { x -= pesos[k]; if (x <= 0) { nivel = k; break; } }
    const doNivel = lista.filter(function(a) { return a.raridade === nivel; });
    if (doNivel.length) return doNivel[Math.floor(Math.random() * doNivel.length)].id;
  }
  let soma = 0;
  lista.forEach(function(a) { soma += pesos[a.raridade]; });
  let r = Math.random() * soma;
  for (let i = 0; i < lista.length; i++) { r -= pesos[lista[i].raridade]; if (r <= 0) return lista[i].id; }
  return lista[0].id;
}

// v18: final apertado sem mudar muito quem vence (contra a máquina, fora da sobrevivência): o bot bate mais quando a pessoa
// está com folga e ele quase morto, e menos quando ela está quase morta (no v17.5 os rivais 1–3 acabavam com 65–82% de vida)
function tensao(M, b) {
  if (!M.contraBot || !b.humano || (jogo && jogo.modo === "sobrevivencia")) return 1;
  // v18.3: no treino (não dá para perder) nada de apertar: quem está com pouca vida quase não apanha
  if (jogo && jogo.treino) return b.vida < 40 ? 0.25 : 1;
  const bot = M.bolinhas[1];
  if (b.vida > 55 && bot.vida < 50) return 1.6;
  if (b.vida < 25) return 0.65;
  return 1;
}
function semArma(M) { const b = M.bolinhas[0]; return M.contraBot && b.humano && b.viva && b.arma === "estilingue"; }
// v18: ponto numa plataforma perto da bolinha (para a caixa de quem ficou sem arma)
function pontoPerto(M, b) {
  let melhor = null, dm = Infinity;
  M.plats.forEach(function(p) {
    if (p.w < 60 || p.y <= 90 || p.move) return;
    const x = limitar(b.x, p.x + 30, p.x + p.w - 30), d = Math.abs(x - b.x) + Math.abs(p.y - b.y) * 1.5;
    if (d < dm) { dm = d; melhor = { x: x, p: p }; }
  });
  if (!melhor) return pontoSobrePlataforma(M, 20);
  const lado = Math.random() < 0.5 ? -1 : 1, p = melhor.p;
  return { x: limitar(melhor.x + lado * (50 + Math.random() * 60), p.x + 30, p.x + p.w - 30), y: p.y - 20, plat: p };
}

// Um ponto em cima de alguma plataforma (onde dá para chegar)
function pontoSobrePlataforma(M, folgaY) {
  const candidatas = M.plats.filter(function(p) { return p.w >= 60 && p.y > 90 && !p.move; });
  const p = candidatas[Math.floor(Math.random() * candidatas.length)] || M.plats[0];
  return { x: p.x + 30 + Math.random() * (p.w - 60), y: p.y - folgaY, plat: p };
}

function atualizarItens(M) {
  // caixas: a primeira aos 1,5 s, depois a cada ~4 s (no máximo 2 no mapa)
  if (M.t >= M.proxCaixa) {
    M.proxCaixa = M.t + (3.2 + Math.random() * 1.5) * (M.multCaixa || 1);   // v21.3: chuva de armas = 0,35
    if (M.caixas.length < 2) {
      // v18: jogador no estilingue contra a máquina: a caixa cai perto dele e de mais baixo
      const perto = semArma(M);
      const p = perto ? pontoPerto(M, M.bolinhas[0]) : pontoSobrePlataforma(M, 20);
      const id = sortearArma(M, false);
      M.caixas.push({ x: p.x, y: perto ? Math.max(-30, p.y - 280) : -30, vy: 1.7, idArma: id, raridade: ARMA[id].raridade, t: 0, paraquedas: true, vida: 11 });
    }
  }
  // v18: ficou no estilingue -> a próxima caixa vem em até 1,2 s (no v17.5 o jogador passava ~70% da luta nele)
  if (semArma(M) && M.proxCaixa !== Infinity && M.proxCaixa > M.t + 1.2 && M.caixas.length < 2) M.proxCaixa = M.t + 1.2;
  for (let i = M.caixas.length - 1; i >= 0; i--) {
    const c = M.caixas[i];
    c.t += FIS.dt;
    if (c.paraquedas) {
      c.y += c.vy * (M.cen.semGravidade ? 0.6 : 1);
      for (let k = 0; k < M.plats.length; k++) {
        const p = M.plats[k];
        if (c.x > p.x && c.x < p.x + p.w && c.y + 20 >= p.y && c.y + 20 <= p.y + 14) { c.y = p.y - 20; c.paraquedas = false; c.plat = p; }
      }
      if (c.y > 760 || c.y + 20 > lavaY(M.cen, M.t)) { M.caixas.splice(i, 1); continue; }
    } else if (c.plat && c.plat.move) {
      posPlat(c.plat, M.t - FIS.dt); const ax = PX, ay = PY; posPlat(c.plat, M.t);
      c.x += PX - ax; c.y += PY - ay;
    }
    if (!c.paraquedas) { c.vida -= FIS.dt; if (c.vida <= 0) { M.caixas.splice(i, 1); continue; } }
    for (let k = 0; k < 2; k++) {
      const b = M.bolinhas[k];
      if (!b.viva) continue;
      const dx = b.x - c.x, dy = b.y - c.y;
      const alc = b.r + (b.humano && M.contraBot ? 46 : 24);   // v18: ímã maior para a pessoa contra a máquina
      if (dx * dx + dy * dy < alc * alc) {
        equipar(b, c.idArma);
        M.caixas.splice(i, 1);
        M.pegou = M.pegou || [];
        M.pegou.push({ lado: b.lado, arma: c.idArma });
        if (typeof Efeitos !== "undefined") { Efeitos.anel(c.x, c.y, ["#ffffff", "#ffffff", "#b197fc", "#ffd43b"][c.raridade], 40); }
        somJogo(M, "pegar");
        break;
      }
    }
  }

  // cartas: a primeira aos ~4 s, depois ~6 s depois que a anterior some ou é pega; somem se ninguém pegar em 6,5 s
  if (M.t >= M.proxCarta && M.cartas.length === 0) {
    M.proxCarta = M.t + 5.5 + Math.random() * 1.5;
    const p = pontoSobrePlataforma(M, 70);
    const id = CARTAS[Math.floor(Math.random() * CARTAS.length)].id;
    M.cartas.push({ x: p.x, y: p.y, id: id, t: 0, vida: 6.5 });
  }
  for (let i = M.cartas.length - 1; i >= 0; i--) {
    const c = M.cartas[i];
    c.t += FIS.dt;
    c.vida -= FIS.dt;
    if (c.vida <= 0) { M.cartas.splice(i, 1); continue; }
    const cy = c.y + Math.sin(c.t * 3) * 6;
    for (let k = 0; k < 2; k++) {
      const b = M.bolinhas[k];
      if (!b.viva) continue;
      const dx = b.x - c.x, dy = b.y - cy;
      if (dx * dx + dy * dy < (b.r + 28) * (b.r + 28)) {
        pegarCarta(M, b, c.id);
        M.cartas.splice(i, 1);
        break;
      }
    }
  }
}

// Meteoros do castelo (de ninguém: acertam os dois)
function atualizarMeteorosDoCenario(M) {
  if (!M.cen.meteoros) return;
  if (M.t < M.proxMeteoro) return;
  M.proxMeteoro = M.t + M.cen.meteoros * (0.8 + Math.random() * 0.4);
  // contra o bot, os meteoros miram mais no bot (70%) e, quando vêm na pessoa, avisam mais cedo
  // (no castelo o jogador perdia 67%: o bot desvia dos círculos vermelhos, gente quase não)
  const humano = M.bolinhas[0].humano && M.contraBot;
  const alvo = M.bolinhas[humano ? (Math.random() < 0.7 ? 1 : 0) : (Math.random() < 0.5 ? 0 : 1)];
  const x = alvo.x + (Math.random() - 0.5) * 260;
  // cai no chão embaixo do ponto
  let y = 660;
  for (let k = 0; k < M.plats.length; k++) {
    const p = M.plats[k];
    if (x > p.x && x < p.x + p.w && p.y >= alvo.y - 30 && p.y < y) y = p.y;
  }
  avisarCeu(M, 0, x, y - 6, alvo.humano && M.contraBot ? 1.8 : 1.25, METEORO_CENARIO);
}
const METEORO_CENARIO = { id: "meteoro_cenario", explode: 72, dano: 22, empurra: 10, visual: "meteoro" };
