"use strict";

// =========================
// BATALHA EM MULTIDÃO ("quantos robôs precisa para derrubar o monstro?")
// Cada robô escolhido vira um BANDO de robozinhos (mais nível = mais robozinhos; a vida e o ataque do robô são
// divididos entre eles). Eles entram correndo pela esquerda, cada um escolhe o monstro mais perto, corre até ele e
// bate pulando (no gigante eles pulam alto, "escalando"). Os monstros entram pela direita.
// Ondas: 1ª e 2ª = bando de monstros normais; 3ª = um MONSTRO GIGANTE (mais 2 normais). O gigante dá PANCADAS no
// chão que machucam todos em volta e arremessam os robozinhos longe (eles voam girando e caem; quem morre vira
// sucata). Os robôs de verdade NÃO se perdem: é só a luta.
// Campo lógico: x = comprimento (0 = lado dos robôs .. L = lado dos monstros), y = largura (0..P), z = altura.
// A cena (cena_batalha.js) passa L e P em pixels da tela de baixa resolução e só desenha.
// Vitória: moedas e, na 1ª vez, os 3 monstros vão para o compêndio e a horda seguinte abre. Derrota ou 90 s: nada.
// =========================
// HABILIDADES do jogador: liberadas pelas hordas vencidas ("libera"); cd em segundos (a árvore "hab_cd" encurta).
// O poder delas vem do ataque somado dos robozinhos vivos.
const HABILIDADES = [
  { id: "missil", cd: 8, libera: 0 },        // explosão no monstro mais forte (e em volta dele)
  { id: "choque", cd: 15, libera: 1 },       // atordoa todos os monstros por 2,5 s e dá um pouco de dano
  { id: "conserto", cd: 18, libera: 2 },     // cura 40% dos vivos e manda REFORÇOS (volta 1/3 dos que caíram)
  { id: "sobrecarga", cd: 22, libera: 3 }    // robozinhos batem 2x mais rápido e correm mais por 6 s
];
const Batalha = (function() {
  let b = null;
  const GRAV = 340, MAX_MINIS = 120;

  function multRobo() { return (1 + 0.25 * nivelUp("blindagem")) * (1 + 0.5 * nivelUp("canhoes")) * (1 + 0.3 * nivelNo("blindagem")); }
  function vagas() { return nivelNo("esquadrao") ? 12 : CONFIG.slotsBatalha; }
  function hordaAberta(z) { return z < 3 || z <= save.hordasVencidas; }
  function minisPorRobo(n) { return 4 + Math.floor(n / 4); }   // nível 1: 4 robozinhos; nível 12: 7; nível 24: 10
  function contarMinis(tiers) {
    const tot = tiers.reduce(function(s, n) { return s + minisPorRobo(n); }, 0);
    return Math.min(MAX_MINIS, tot);
  }
  // "poder" para comparar antes de lutar (vida x ataque somados)
  function poderRobos(tiers) { const m = multRobo(); return tiers.reduce(function(s, n) { return s + Math.sqrt(vidaRobo(n) * ataqueRobo(n)) * m; }, 0); }
  function poderHorda(z) {
    let s = 0;
    for (let o = 0; o < HORDAS[z].ondas; o++) composicao(z, o).forEach(function(u) { s += Math.sqrt(u.vida * u.ataque / ATQ) / 3.2; });
    return s;
  }

  // ---------- quem entra em cada onda ----------
  // na multidão cada golpe de monstro acerta um robozinho só (e o gigante acerta vários): ataque ajustado por simulação
  // (scratchpad/sim/bat.js) para a dificuldade ficar igual à da batalha antiga
  const ATQ = 0.3, GIGANTE = { vida: 5, ataque: 1.2 };
  function composicao(z, o) {
    const h = HORDAS[z], l = [], ultima = o === h.ondas - 1;
    if (ultima) {
      const st = statsMonstro(h, 2, o);
      l.push({ id: h.monstros[2].id, vida: st.vida * GIGANTE.vida, ataque: st.ataque * GIGANTE.ataque * ATQ, gigante: true });
      for (let k = 0; k < 2; k++) { const s2 = statsMonstro(h, k, o); l.push({ id: h.monstros[k].id, vida: s2.vida, ataque: s2.ataque * ATQ }); }
    } else {
      const n = o === 0 ? 4 : 6;
      for (let k = 0; k < n; k++) { const tipo = k % 2, st = statsMonstro(h, tipo, o); l.push({ id: h.monstros[tipo].id, vida: st.vida, ataque: st.ataque * ATQ }); }
    }
    return l;
  }
  function soltarOnda() {
    const l = composicao(b.z, b.onda);
    l.forEach(function(c, k) {
      const gig = !!c.gigante;
      b.monstros.push({
        lado: "m", id: c.id, gigante: gig, vida: c.vida, max: c.vida, ataque: c.ataque,
        x: b.L + (gig ? 45 : 15 + Math.random() * 40 + k * 5), y: gig ? b.P * 0.5 : b.P * (0.1 + Math.random() * 0.8), z: 0, vz: 0, vx: 0, vy: 0,
        raio: gig ? b.raioGigante : 12, vel: gig ? 22 : 30 + Math.random() * 8, alcance: gig ? 16 : 5,
        cd: 1 + Math.random() * 0.8, golpe: 0, preparo: 0, atordoado: 0, alvo: null, pensa: 0, voando: false, acum: 0, acumT: 0
      });
    });
    if (l.some(function(c) { return c.gigante; })) { b.avisoGigante = b.t; if (typeof Som !== "undefined") Som.som("alarme"); }
  }

  // ---------- começar ----------
  // campo: {L, P, raioGigante} em pixels da cena (sem cena: um campo padrão, para simular)
  function iniciar(z, tiers, campo) {
    campo = campo || { L: 400, P: 90, raioGigante: 40 };
    const m = multRobo(), total = contarMinis(tiers), pedidos = tiers.reduce(function(s, n) { return s + minisPorRobo(n); }, 0);
    const corte = total / pedidos;   // passou de 120: cada robô manda menos robozinhos, mais fortes
    b = {
      z: z, onda: 0, t: 0, fim: null, numeros: [], fx: [], pecas: [], agenda: [], sobrecarga: 0, cds: {}, tremor: 0,
      L: campo.L, P: campo.P, raioGigante: campo.raioGigante || 40, robos: [], monstros: [], caidos: [], fila: [], avisoGigante: -9
    };
    tiers.forEach(function(n, i) {
      const k = Math.max(1, Math.round(minisPorRobo(n) * corte)), vida = vidaRobo(n) * m / k, atq = ataqueRobo(n) * m / k;
      for (let j = 0; j < k; j++) b.fila.push({ t: i * 0.1 + j * 0.06 + Math.random() * 0.1, tier: n, vida: vida, ataque: atq });
    });
    b.fila.sort(function(a, c) { return a.t - c.t; });
    b.totalMinis = b.fila.length;
    soltarOnda();
    save.stats.batalhas++;
    Poki.medir("battle", "horde-" + z, "start");
    return b;
  }
  function novoMini(f, vidaFrac) {
    const r = { lado: "r", tier: f.tier, vida: f.vida * (vidaFrac || 1), max: f.vida, ataque: f.ataque,
      x: -8 - Math.random() * 30, y: b.P * (0.05 + Math.random() * 0.9), z: 0, vz: 0, vx: 0, vy: 0,
      raio: 7, vel: 68 + Math.random() * 14, alcance: 2, cd: 0.2 + Math.random() * 0.5, golpe: 0, alvo: null, pensa: 0, voando: false, pulo: 6 + Math.random() * 8, base: f };
    b.robos.push(r);
    return r;
  }

  // ---------- simulação ----------
  function vivos(l) { return l.filter(function(x) { return x.vida > 0; }); }
  function maisPerto(u, l) {
    let m = null, md = 1e9;
    for (let i = 0; i < l.length; i++) { const o = l[i]; if (o.vida <= 0) continue; const d = Math.hypot(o.x - u.x, (o.y - u.y) * 1.3) - o.raio; if (d < md) { md = d; m = o; } }
    return m;
  }
  function arremessar(u, deX, forca) {
    const lado = u.x >= deX ? 1 : -1;
    u.voando = true; u.vz = forca * (0.8 + Math.random() * 0.5); u.vx = lado * forca * (0.2 + Math.random() * 0.3); u.vy = (Math.random() - 0.5) * forca * 0.5;
    u.giro = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 8);
  }
  function dano(alvo, v, de) {
    alvo.vida -= v;
    if (alvo.lado === "m") { alvo.acum += v; }
    if (alvo.vida <= 0 && alvo.lado === "m") morreuMonstro(alvo);
  }
  function sucata(x, y, z, n, cores, forca) {
    for (let i = 0; i < n && b.pecas.length < 260; i++) {
      const a = Math.random() * Math.PI * 2, v = (20 + Math.random() * 60) * (forca || 1);
      b.pecas.push({ x: x, y: y, z: z + 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.4, vz: 60 + Math.random() * 90 * (forca || 1), t: 0, vida: 0.8 + Math.random() * 0.6, cor: cores[Math.floor(Math.random() * cores.length)], tam: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  function morreuMini(r) {
    r.morto = true;
    b.caidos.push(r.base);
    sucata(r.x, r.y, r.z, 5, ["#9aa3c0", "#5d6c8f", "#3d4a66", "#ffcc33"], 1);
    b.fx.push({ tipo: "poeira", x: r.x, y: r.y, t: 0, dur: 0.35 });
  }
  function morreuMonstro(m) {
    if (m.morto) return;
    m.morto = true;
    sucata(m.x, m.y, m.gigante ? 40 : 10, m.gigante ? 40 : 12, ["#3ccf6e", "#7a3fbf", "#ff5d73", "#ffcc33", "#1a1030"], m.gigante ? 2.2 : 1.2);
    b.fx.push({ tipo: "estouro", x: m.x, y: m.y, z: m.gigante ? 40 : 14, t: 0, dur: m.gigante ? 0.8 : 0.45, grande: m.gigante });
    if (m.gigante) b.tremor = 0.6;
    if (typeof Som !== "undefined") Som.som(m.gigante ? "explosao" : "acerto");
  }

  function passo(dt) {
    if (!b || b.fim) return;
    // passos curtos: a física fica estável mesmo com o celular engasgando
    let resta = Math.min(dt, 0.1);
    while (resta > 0) { const d = Math.min(resta, 1 / 60); sub(d); resta -= d; if (!b || b.fim) break; }
  }
  function sub(dt) {
    b.t += dt;
    for (const k in b.cds) b.cds[k] = Math.max(0, b.cds[k] - dt);
    if (b.sobrecarga > 0) b.sobrecarga -= dt;
    if (b.tremor > 0) b.tremor -= dt;
    b.agenda = b.agenda.filter(function(a) { if (b.t < a.t) return true; a.fn(); return false; });
    b.fx.forEach(function(x) { x.t += dt; }); b.fx = b.fx.filter(function(x) { return x.t < (x.dur || 0.6); });
    // robozinhos entrando correndo
    while (b.fila.length && b.fila[0].t <= b.t) novoMini(b.fila.shift());
    const sob = b.sobrecarga > 0;

    // ---- robozinhos ----
    b.robos.forEach(function(r) {
      if (r.morto) return;
      if (r.golpe > 0) r.golpe = Math.max(0, r.golpe - dt * 3.2);
      if (fisica(r, dt)) return;
      if (r.vida <= 0) { morreuMini(r); return; }
      r.pensa -= dt;
      if (!r.alvo || r.alvo.vida <= 0 || r.pensa <= 0) { r.alvo = maisPerto(r, b.monstros); r.pensa = 0.3 + Math.random() * 0.3; }
      const a = r.alvo; if (!a) return;
      const dx = a.x - r.x, dy = a.y - r.y, d = Math.hypot(dx, dy), alcance = r.raio + a.raio + r.alcance;
      r.cd -= dt * (sob ? 2 : 1);
      if (d > alcance) { const v = r.vel * (sob ? 1.5 : 1) * dt; r.x += dx / d * v; r.y += dy / d * v; }
      else if (r.cd <= 0) {
        r.cd = 0.75 + Math.random() * 0.35; r.golpe = 1; r.pulo = a.gigante ? 10 + Math.random() * 40 : 5 + Math.random() * 7;
        dano(a, r.ataque * (0.85 + Math.random() * 0.3), r);
        if (typeof Som !== "undefined" && Math.random() < 0.25) Som.som("tiro", 0.8 + Math.random() * 0.6);
      }
    });
    // ---- monstros ----
    b.monstros.forEach(function(m) {
      if (m.morto) return;
      if (m.vida <= 0) { morreuMonstro(m); return; }
      if (m.golpe > 0) m.golpe = Math.max(0, m.golpe - dt * 3);
      if (m.atordoado > 0) { m.atordoado -= dt; return; }
      m.acumT -= dt;
      if (m.acumT <= 0 && m.acum > 0) { b.numeros.push({ x: m.x, y: m.y, z: m.gigante ? b.raioGigante * 2.6 : 30, v: m.acum, t: 0 }); m.acum = 0; m.acumT = 0.4; }
      if (m.preparo > 0) {   // gigante levantando os braços: a pancada vem já já
        m.preparo -= dt;
        if (m.preparo <= 0) pancada(m);
        return;
      }
      // entrando: anda para dentro da tela até aparecer inteiro, sem atacar
      const linha = b.L - (m.gigante ? m.raio + 20 : 16);
      if (m.x > linha) { m.x -= m.vel * 1.6 * dt; return; }
      m.pensa -= dt;
      if (!m.alvo || m.alvo.vida <= 0 || m.alvo.morto || m.pensa <= 0) { m.alvo = maisPerto(m, b.robos.filter(function(r) { return !r.morto; })); m.pensa = 0.5; }
      const a = m.alvo; if (!a) return;
      const dx = a.x - m.x, dy = a.y - m.y, d = Math.hypot(dx, dy), alcance = m.raio + a.raio + m.alcance;
      m.cd -= dt;
      if (d > alcance) { const v = m.vel * dt; m.x += dx / d * v; m.y += dy / d * v; }
      else if (m.cd <= 0) {
        if (m.gigante) { m.preparo = 0.55; m.cd = 2.8 + Math.random() * 0.6; }
        else {
          m.cd = 1.1 + Math.random() * 0.4; m.golpe = 1;
          a.vida -= m.ataque * (0.85 + Math.random() * 0.3);
          if (!a.voando) arremessar(a, m.x, 70);
          if (typeof Som !== "undefined") Som.som("acerto");
        }
      }
    });
    // ---- empurra-empurra (ninguém fica em cima do outro) ----
    separar(b.robos); separar(b.monstros);
    // robozinhos não saem da tela (esperam os monstros entrarem); monstros podem estar chegando de fora
    b.robos.forEach(function(u) { u.y = Math.max(0, Math.min(b.P, u.y)); u.x = Math.max(-60, Math.min(b.L - 12, u.x)); });
    b.monstros.forEach(function(u) { u.y = Math.max(0, Math.min(b.P, u.y)); u.x = Math.max(-60, Math.min(b.L + 90, u.x)); });
    b.robos = b.robos.filter(function(r) { return !r.morto; });
    b.monstros = b.monstros.filter(function(m) { return !m.morto; });
    // sucata e números
    b.pecas.forEach(function(p) { p.t += dt; p.vz -= GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.3; p.vx *= 0.6; p.vy *= 0.6; } });
    b.pecas = b.pecas.filter(function(p) { return p.t < p.vida; });
    b.numeros.forEach(function(x) { x.t += dt; }); b.numeros = b.numeros.filter(function(x) { return x.t < 0.8; });
    // fim de onda / fim de luta
    if (!b.monstros.length && !b.agenda.some(function(a) { return a.onda; })) {
      if (b.onda + 1 >= HORDAS[b.z].ondas) { terminar(true); return; }
      b.onda++;
      b.agenda.push({ t: b.t + 1, onda: true, fn: soltarOnda });
    }
    if ((!b.robos.length && !b.fila.length) || b.t > 90) terminar(false);
  }
  // voo depois de arremessado: true enquanto está no ar (sem pensar)
  function fisica(u, dt) {
    if (!u.voando) return false;
    u.vz -= GRAV * dt; u.x += u.vx * dt; u.y += u.vy * dt; u.z += u.vz * dt;
    if (u.z <= 0) {
      u.z = 0;
      if (u.vz < -120 && !u.quicou) { u.vz = -u.vz * 0.3; u.vx *= 0.5; u.quicou = true; return true; }
      u.voando = false; u.quicou = false; u.vz = u.vx = u.vy = 0;
      return false;
    }
    return true;
  }
  function pancada(m) {
    m.golpe = 1; b.tremor = 0.35;
    const raio = m.raio + 34;
    b.fx.push({ tipo: "pancada", x: m.x - m.raio * 0.6, y: m.y, t: 0, dur: 0.5, r: raio });
    b.robos.forEach(function(r) {
      if (r.morto) return;
      const d = Math.hypot(r.x - m.x, (r.y - m.y) * 1.3);
      if (d > raio + r.raio) return;
      r.vida -= m.ataque * (0.8 + Math.random() * 0.4);
      arremessar(r, m.x, 95 + Math.random() * 50);
    });
    if (typeof Som !== "undefined") { Som.som("hab_missil"); }
  }
  function separar(l) {
    for (let i = 0; i < l.length; i++) {
      const a = l[i]; if (a.morto || a.voando) continue;
      for (let j = i + 1; j < l.length; j++) {
        const c = l[j]; if (c.morto || c.voando) continue;
        const dx = c.x - a.x, dy = c.y - a.y, min = (a.raio + c.raio) * 0.85, d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), em = (min - d) / 2, nx = dx / d, ny = dy / d;
        const pa = a.gigante ? 0.1 : 1, pc = c.gigante ? 0.1 : 1;
        a.x -= nx * em * pa; a.y -= ny * em * pa; c.x += nx * em * pc; c.y += ny * em * pc;
      }
    }
  }

  // ---------- habilidades ----------
  function liberada(h) { return save.hordasVencidas >= h.libera; }
  function cdDe(h) { return h.cd * Math.pow(0.8, nivelNo("hab_cd")); }
  function poder() {
    const m = (1 + 0.5 * nivelUp("canhoes")) * (1 + 0.5 * nivelNo("hab_dano"));
    return (vivos(b.robos).reduce(function(s, r) { return s + r.ataque; }, 0) + b.fila.reduce(function(s, f) { return s + f.ataque; }, 0)) * m;
  }
  function usar(id) {
    const h = HABILIDADES.filter(function(x) { return x.id === id; })[0];
    if (!b || b.fim || !h || !liberada(h) || (b.cds[id] || 0) > 0) return false;
    const mv = vivos(b.monstros); if (!mv.length && id !== "conserto") return false;
    b.cds[id] = cdDe(h);
    const p = poder();
    if (id === "missil") {
      const alvo = mv.reduce(function(a, m) { return m.vida > a.vida ? m : a; }, mv[0]);
      b.fx.push({ tipo: "missil", alvo: alvo, x0: 0, t: 0, dur: 0.45 });
      b.agenda.push({ t: b.t + 0.43, fn: function() {
        const x = alvo.x, y = alvo.y;
        b.fx.push({ tipo: "explosao", x: x, y: y, z: alvo.gigante ? 50 : 16, t: 0, dur: 0.55 });
        b.tremor = 0.3;
        if (alvo.vida > 0) { dano(alvo, p * 2.5); b.numeros.push({ x: x, y: y, z: alvo.gigante ? 110 : 40, v: p * 2.5, t: 0, grande: true }); }
        vivos(b.monstros).forEach(function(m) { if (m !== alvo && Math.hypot(m.x - x, m.y - y) < 60) dano(m, p * 0.6); });
      } });
    } else if (id === "choque") {
      mv.forEach(function(m) { m.atordoado = 2.5; m.preparo = 0; dano(m, p * 0.4); });
      b.fx.push({ tipo: "choque", t: 0, dur: 0.5 });
    } else if (id === "conserto") {
      vivos(b.robos).forEach(function(r) { r.vida = Math.min(r.max, r.vida + r.max * 0.4); });
      // reforços: um terço dos que caíram volta correndo pela esquerda
      const volta = Math.ceil(b.caidos.length / 3);
      b.caidos.splice(0, volta).forEach(function(f, i) { b.fila.push({ t: b.t + i * 0.04, tier: f.tier, vida: f.vida, ataque: f.ataque }); });
      b.fx.push({ tipo: "conserto", t: 0, dur: 0.9 });
    } else if (id === "sobrecarga") { b.sobrecarga = 6; b.fx.push({ tipo: "sobrecarga", t: 0, dur: 0.6 }); }
    Poki.medir("ability", id, "interact");
    return true;
  }

  function terminar(venceu) {
    const z = b.z;
    b.fim = { venceu: venceu, premio: 0, novos: [] };
    Poki.medir("battle", "horde-" + z, venceu ? "complete" : "fail");
    if (!venceu) return;
    save.stats.vitorias++;
    const premio = Math.round(HORDAS[z].premio * (1 + 0.5 * nivelNo("saque")) * Jogo.multMoedas());
    b.fim.premio = premio;
    save.p.moedas += premio;
    HORDAS[z].monstros.forEach(function(m) { const d = Jogo.descobrirMonstro(m.id); if (d) b.fim.novos.push(d); });
    if (z + 1 > save.hordasVencidas) save.hordasVencidas = z + 1;
    salvar();
  }

  return { iniciar: iniciar, passo: passo, vagas: vagas, hordaAberta: hordaAberta, poderRobos: poderRobos, poderHorda: poderHorda,
    usar: usar, liberada: liberada, cdDe: cdDe, contarMinis: contarMinis,
    get atual() { return b; }, sair: function() { b = null; } };
})();
