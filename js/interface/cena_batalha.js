"use strict";

// =========================
// CENA DA BATALHA (tela cheia, dentro de uma FÁBRICA): tudo desenhado em baixa resolução (sprites em 1:1) e
// ampliado por um fator inteiro, para os pixels ficarem todos do mesmo tamanho.
// Fundo: parede de tijolos, janelões, canos, lâmpadas penduradas com cone de luz, engrenagem na parede, passarela,
// chão de chapa com faixa de perigo e uma esteira andando. Os robôs (esquerda) e os monstros (entram andando pela
// direita) lutam sozinhos; o jogador lança as HABILIDADES (botões embaixo, com a recarga aparecendo).
// =========================
const CenaBatalha = (function() {
  const cena = el("cena"), cv = el("cvCena"), g = cv.getContext("2d");
  let W = 400, H = 225, ESC = 3, fundoFixo = null, aberta = false, tempo = 0, mostrouFim = false;
  const botoes = {};

  function medir() {
    const vw = window.innerWidth, vh = window.innerHeight, empe = vh > vw;
    ESC = Math.max(2, Math.floor(empe ? vw / 200 : Math.min(vw / 400, vh / 225)));
    W = Math.ceil(vw / ESC); H = Math.ceil(vh / ESC);
    cv.width = W; cv.height = H; cv.style.width = W * ESC + "px"; cv.style.height = H * ESC + "px";
    g.imageSmoothingEnabled = false;
    fundoFixo = montarFundo();
    campo();
    luzes = montarLuzes();
    const b = Batalha.atual; if (b) { b.L = C.L; b.P = C.P; }
  }
  window.addEventListener("resize", function() { if (aberta) medir(); });
  // altura do chão: a multidão precisa de muito chão (deitado: metade da tela; em pé: quase tudo)
  function chao() { return Math.round(H * (H > W * 1.1 ? 0.24 : 0.5)); }

  function montarFundo() {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const f = c.getContext("2d");
    const rt = function(x, y, w, h, cor) { f.fillStyle = cor; f.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const ch = chao();
    // parede de tijolos
    rt(0, 0, W, ch, "#2a1626");
    for (let y = 0; y < ch; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < W; x += 16) {
      rt(x, y, 15, 7, ((x * 7 + y * 3) % 5) ? "#3b1f2e" : "#432436"); rt(x, y, 15, 1, "#4d2a3e"); rt(x, y + 6, 15, 1, "#2a1420");
    }
    // janelões com luz azulada
    for (let k = 0; k < Math.ceil(W / 120); k++) {
      const x = 24 + k * 120, y = Math.round(ch * 0.2), w = 60, h = Math.round(ch * 0.45);
      rt(x - 3, y - 3, w + 6, h + 6, "#1a1030"); rt(x, y, w, h, "#20385c");
      for (let j = 0; j < h; j += 4) rt(x, y + j, w, 2, "#264470");
      rt(x + w / 2 - 1, y, 2, h, "#1a1030"); rt(x, y + h / 2 - 1, w, 2, "#1a1030");
      rt(x + 4, y + 4, 6, 2, "#5b86b8");
    }
    // cano grosso no alto e passarela
    const cy = Math.round(ch * 0.1);
    rt(0, cy, W, 6, "#4b5874"); rt(0, cy, W, 2, "#6c7a99"); rt(0, cy + 5, W, 1, "#2a3247");
    for (let x = 30; x < W; x += 60) rt(x, cy - 1, 4, 8, "#5d6c8f");
    const py = Math.round(ch * 0.8);
    rt(0, py, W, 4, "#3d3858"); rt(0, py, W, 1, "#5d5880");
    for (let x = 0; x < W; x += 12) rt(x, py - 10, 2, 10, "#3d3858");
    rt(0, py - 11, W, 2, "#5d5880");
    // chão: chapas de aço com rebites, umas mais gastas, e a faixa de perigo encostada na parede
    rt(0, ch, W, H - ch, "#2b2a3d");
    for (let y = ch + 4; y < H; y += 20) for (let x = ((y - ch) / 20) % 2 ? -16 : 0; x < W; x += 32) {
      rt(x, y, 32, 20, ((x * 3 + y * 7) % 7) ? "#2b2a3d" : "#302f45");
      rt(x, y, 32, 1, "#3a394f"); rt(x, y, 1, 20, "#232233"); rt(x + 2, y + 2, 1, 1, "#4a4960"); rt(x + 29, y + 2, 1, 1, "#4a4960");
      if ((x * 5 + y) % 11 === 0) { rt(x + 10, y + 8, 6, 1, "#1f1e2c"); rt(x + 15, y + 9, 4, 1, "#1f1e2c"); }   // risco
    }
    for (let x = 0; x < W; x++) for (let y = ch; y < ch + 4; y++) rt(x, y, 1, 1, ((x + y) % 8) < 4 ? "#ffcc33" : "#241a10");
    rt(0, ch + 4, W, 1, "#151420");
    return c;
  }
  // LUZ da cena (v6), pontilhada em Bayer 4x4: poças de luz quente no chão embaixo das lâmpadas (por baixo da
  // multidão) e vinheta escura nos cantos (por cima de tudo, menos do placar)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  let luzes = null;
  function montarLuzes() {
    const chao_ = chao(), poca = document.createElement("canvas"), vin = document.createElement("canvas");
    poca.width = vin.width = W; poca.height = vin.height = H;
    const p = poca.getContext("2d"), v = vin.getContext("2d"), cx = W / 2, cy = H * 0.55, rmax = Math.hypot(W, H) * 0.6;
    const lamps = [0.2, 0.5, 0.8].map(function(k) { return W * k; });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const lim = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const e = Math.max(0, Math.min(1, (Math.hypot(x - cx, (y - cy) * 1.3) / rmax - 0.5) * 1.8));
      if (e > lim) { v.fillStyle = e - lim > 0.3 ? "rgba(6,3,16,.6)" : "rgba(6,3,16,.32)"; v.fillRect(x, y, 1, 1); }
      if (y > chao_) {
        let k = 0;
        lamps.forEach(function(lx) { const ry = (H - chao_) * 0.5, d = Math.hypot((x - lx) / 46, (y - (chao_ + ry)) / ry); k = Math.max(k, 1 - d); });
        if (k * 0.9 > lim) { p.fillStyle = k * 0.9 - lim > 0.3 ? "rgba(255,226,160,.14)" : "rgba(255,226,160,.07)"; p.fillRect(x, y, 1, 1); }
      }
    }
    return { poca: poca, vin: vin };
  }
  function desenharFundoVivo() {
    const ch = chao();
    g.drawImage(fundoFixo, 0, 0);
    // engrenagem na parede
    const per = Math.PI * 2 / 12, q = Math.floor(((tempo * 0.4) % per) / per * 6);
    const e = Pixel.engrenagem(28, 12, q, 6, "escuro"); g.drawImage(e, Math.round(W * 0.5 - e.width / 2), Math.round(ch * 0.45 - e.height / 2));
    // lâmpadas penduradas com cone de luz (piscam de leve)
    for (let k = 0; k < 3; k++) {
      const x = Math.round(W * (0.2 + k * 0.3)), y = Math.round(ch * 0.1) + 6, on = Math.sin(tempo * 3 + k * 2) > -0.9;
      g.fillStyle = "#1a1030"; g.fillRect(x, y, 1, 10); g.fillStyle = "#5d6c8f"; g.fillRect(x - 5, y + 10, 11, 4);
      g.fillStyle = on ? "#ffe9a3" : "#7a6a40"; g.fillRect(x - 3, y + 14, 7, 2);
      if (on) { g.globalAlpha = 0.06; g.fillStyle = "#ffe9a3"; g.beginPath(); g.moveTo(x - 4, y + 15); g.lineTo(x + 5, y + 15); g.lineTo(x + 70, H); g.lineTo(x - 69, H); g.fill(); g.globalAlpha = 1; }
    }
  }

  // CAMPO: a batalha.js pensa num campo (x = comprimento, y = largura). Deitado: robôs entram pela esquerda e
  // monstros pela direita, no chão (metade de baixo). Em pé: robôs entram por baixo e monstros por cima.
  function emPe() { return H > W * 1.1; }
  let C = null;   // {L, P, x0, y0, emPe, escGig}
  function campo() {
    const ch = chao();
    if (emPe()) { const fundo = H - 50; C = { emPe: true, L: fundo - (ch + 14), P: W - 20, fundo: fundo, escGig: 2 }; }
    else { const topo = ch + 12; C = { emPe: false, L: W - 16, P: H - 38 - topo, topo: topo, escGig: H >= 300 ? 3 : 2 }; }
    C.raioGigante = Math.round(48 * C.escGig * 0.27);
    return C;
  }
  // ponto do campo -> pixel da cena (pé da figura)
  function tela(x, y) { return C.emPe ? { x: 10 + y, y: C.fundo - x } : { x: 8 + x, y: C.topo + y }; }

  // abrir(z, tiers): mede a tela e começa a luta já com o tamanho do campo
  function abrir(z, tiers) {
    aberta = true; mostrouFim = false; tempo = 0;
    cena.classList.remove("escondido");
    medir();
    if (tiers) Batalha.iniciar(z, tiers, C);
    el("cenaFim").classList.add("escondido");
    montarBotoes();
    Som.som("lutar");
    Som.musica("batalha");
  }
  function montarBotoes() {
    const caixa = el("cenaHab"); caixa.innerHTML = "";
    HABILIDADES.forEach(function(h) {
      const b = document.createElement("button"); b.className = "hab";
      b.appendChild(Paineis.icone(h.id));
      const nome = document.createElement("span"); nome.textContent = t("hab_" + h.id); b.appendChild(nome);
      const cd = document.createElement("i"); cd.className = "cd"; b.appendChild(cd);
      const seg = document.createElement("span"); seg.className = "seg"; b.appendChild(seg);
      b.addEventListener("pointerdown", function(e) {
        e.preventDefault();
        if (!Batalha.liberada(h)) { Paineis.faixa(null, t("hab_bloq", t("z_" + (h.libera - 1))), ""); Som.som("erro"); return; }
        if (Batalha.usar(h.id)) { Som.som("hab_" + h.id); vibrar(20); } else Som.som("erro");
      });
      caixa.appendChild(b);
      botoes[h.id] = { b: b, cd: cd, seg: seg };
    });
  }
  function atualizarBotoes() {
    const b = Batalha.atual; if (!b) return;
    HABILIDADES.forEach(function(h) {
      const x = botoes[h.id]; if (!x) return;
      const lib = Batalha.liberada(h), resta = b.cds[h.id] || 0, total = Batalha.cdDe(h);
      x.b.classList.toggle("bloq", !lib);
      x.b.classList.toggle("pronta", lib && resta <= 0 && !b.fim);
      x.cd.style.height = (lib ? resta / total * 100 : 100) + "%";
      x.seg.textContent = lib && resta > 0 ? Math.ceil(resta) : "";
    });
  }
  el("cenaSair").addEventListener("click", function() { Som.som("clique"); fechar(); });

  // ---------- desenho ----------
  const MINI_MONSTRO = {};
  function spriteMini(tier) { return Pixel.mini(Pixel.robo(tier)); }
  function passo(dt) {
    if (!aberta) return;
    tempo += dt;
    const b = Batalha.atual;
    if (!b) { fechar(); return; }
    g.save();
    if (b.tremor > 0) g.translate(Math.round((Math.random() - 0.5) * 6), Math.round((Math.random() - 0.5) * 4));
    desenharFundoVivo();
    if (luzes) g.drawImage(luzes.poca, 0, 0);
    // todo mundo (e a sucata) ordenado pelo pé: quem está mais "na frente" é desenhado por cima
    const lista = [];
    b.robos.forEach(function(r) { lista.push({ u: r, p: tela(r.x, r.y) }); });
    b.monstros.forEach(function(m) { lista.push({ u: m, p: tela(m.x, m.y) }); });
    // sombras primeiro
    g.fillStyle = "rgba(0,0,0,.33)";
    lista.forEach(function(o) {
      const w = o.u.gigante ? 48 * C.escGig * 0.6 : o.u.lado === "m" ? 26 : 12;
      g.fillRect(Math.round(o.p.x - w / 2), Math.round(o.p.y - 1), Math.round(w), 3);
    });
    lista.sort(function(a, c) { return a.p.y - c.p.y; });
    lista.forEach(function(o) { if (o.u.lado === "r") desenharMini(o.u, o.p, b); else desenharMonstro(o.u, o.p, b); });
    // sucata voando
    b.pecas.forEach(function(pc) { const p = tela(pc.x, pc.y); g.fillStyle = pc.cor; g.globalAlpha = Math.min(1, (pc.vida - pc.t) * 4); g.fillRect(Math.round(p.x), Math.round(p.y - pc.z), pc.tam + 1, pc.tam + 1); });
    g.globalAlpha = 1;
    efeitos(b);
    if (luzes) g.drawImage(luzes.vin, 0, 0);
    numeros(b);
    g.restore();
    hud(b);
    const h = b.h;
    escrever("cenaNome", h.id === "torre" ? t("torre_andar", h.andar) : t("z_" + h.id));
    escrever("cenaOnda", "  " + t("bat_onda", Math.min(b.onda + 1, h.ondas), h.ondas));
    atualizarBotoes();
    if (b.fim && !mostrouFim) { mostrouFim = true; resultado(b.fim); }
  }
  function desenharMini(r, p, b) {
    const s = spriteMini(r.tier), andando = !r.voando && r.golpe <= 0 && r.alvo;
    const pulo = r.golpe > 0 ? Math.sin(r.golpe * Math.PI) * r.pulo : 0, bob = andando ? Math.floor(tempo * 8 + r.pulo) % 2 : 0;
    const x = Math.round(p.x - s.width / 2), y = Math.round(p.y - s.height - r.z - pulo - bob);
    if (r.voando) {   // arremessado: gira de 90 em 90 graus (pixel continua pixel)
      const q = Math.floor(tempo * Math.abs(r.giro) / 1.6) % 4;
      g.save(); g.translate(x + s.width / 2, y + s.height / 2); g.rotate((r.giro > 0 ? q : -q) * Math.PI / 2); g.drawImage(s, -s.width / 2, -s.height / 2); g.restore();
    } else g.drawImage(s, x, y);
    if (b.sobrecarga > 0 && Math.random() < 0.15) { g.fillStyle = "#ff5d73"; g.fillRect(x + Math.random() * s.width, y + Math.random() * s.height, 1, 1); }
    if (r.vida < r.max * 0.35) { g.fillStyle = "#ff4d5e"; g.fillRect(x + s.width / 2 - 3, y - 2, 6, 1); }
  }
  function desenharMonstro(m, p, b) {
    const s = Pixel.monstro(m.id), esc = m.gigante ? C.escGig : 1, w = s.width * esc, h = s.height * esc;
    let lev = 0;
    if (m.gigante && m.preparo > 0) lev = Math.round((1 - m.preparo / 0.55) * 16);   // levanta para dar a pancada
    const treme = m.atordoado > 0 ? (Math.floor(tempo * 20) % 2 ? 1 : -1) : 0;
    const bote = Math.round(m.golpe * (m.gigante ? 3 : 6)), bob = m.gigante ? Math.floor(tempo * 3) % 2 : Math.floor(tempo * 5 + m.id) % 2;
    const x = Math.round(p.x - w / 2 + treme - (C.emPe ? 0 : bote)), y = Math.round(p.y - h - lev - bob + (C.emPe ? bote : 0));
    g.save();
    if (!C.emPe) { g.translate(x + w, y); g.scale(-esc, esc); } else { g.translate(x, y); g.scale(esc, esc); }
    g.drawImage(s, 0, 0);
    g.restore();
    if (m.atordoado > 0) { g.fillStyle = "#7cf0ff"; for (let k = 0; k < 3; k++) g.fillRect(Math.round(p.x - 8 + k * 7), Math.round(y - 4 + Math.sin(tempo * 10 + k) * 2), 3, 3); }
    if (!m.gigante) barra(Math.round(p.x - 12), y - 4, 24, m.vida / m.max);
  }
  function efeitos(b) {
    b.fx.forEach(function(f) {
      const k = f.t / f.dur;
      if (f.tipo === "pancada") {   // anel de poeira no chão + rachaduras
        const p = tela(f.x, f.y), r = 8 + k * f.r;
        g.globalAlpha = 1 - k; g.fillStyle = "#c9b48a";
        for (let a = 0; a < 28; a++) { const an = a / 28 * Math.PI * 2; g.fillRect(Math.round(p.x + Math.cos(an) * r) - 2, Math.round(p.y + Math.sin(an) * r * 0.35) - 1, 4, 3); }
        g.fillStyle = "#1a1030"; if (k < 0.6) for (let a = 0; a < 5; a++) { const an = a * 1.3; g.fillRect(Math.round(p.x + Math.cos(an) * 10), Math.round(p.y + Math.sin(an) * 3), Math.round(Math.cos(an) * 14) || 1, 1); }
        g.globalAlpha = 1;
      } else if (f.tipo === "estouro" || f.tipo === "explosao") {
        const p = tela(f.x, f.y), r = (f.grande || f.tipo === "explosao" ? 14 : 6) + k * (f.grande ? 70 : f.tipo === "explosao" ? 50 : 22), cy = p.y - f.z;
        g.globalAlpha = 1 - k;
        if (k < 0.35) { circ(p.x, cy, r * 0.8, "#ffcc33"); circ(p.x, cy, r * 0.5, "#ffffff"); }
        g.fillStyle = k < 0.2 ? "#ffffff" : "#ff8a2e";
        for (let a = 0; a < 18; a++) { const an = a / 18 * Math.PI * 2; g.fillRect(Math.round(p.x + Math.cos(an) * r) - 2, Math.round(cy + Math.sin(an) * r * 0.8) - 2, 4, 4); }
        g.globalAlpha = 1;
      } else if (f.tipo === "faisca") {   // faísca do golpe de um robozinho
        const p = tela(f.x, f.y), y = Math.round(p.y - f.z), x = Math.round(p.x), r = 1 + Math.round(k * 3);
        g.fillStyle = k < 0.5 ? "#fff6c2" : "#ffb02e";
        g.fillRect(x - r, y, 1, 1); g.fillRect(x + r, y, 1, 1); g.fillRect(x, y - r, 1, 1); g.fillRect(x, y + r, 1, 1);
        if (k < 0.4) g.fillRect(x, y, 1, 1);
      } else if (f.tipo === "poeira") {
        const p = tela(f.x, f.y); g.globalAlpha = 1 - k; g.fillStyle = "#8a8aa8";
        g.fillRect(Math.round(p.x - 4 - k * 6), Math.round(p.y - 4 - k * 4), 3, 3); g.fillRect(Math.round(p.x + 2 + k * 6), Math.round(p.y - 5 - k * 5), 3, 3); g.fillRect(Math.round(p.x - 1), Math.round(p.y - 7 - k * 7), 3, 3);
        g.globalAlpha = 1;
      } else if (f.tipo === "missil") {
        const a = f.alvo, d = tela(a.x, a.y), o = tela(-10, b.P / 2), alt = a.gigante ? 60 : 20;
        const x = o.x + (d.x - o.x) * k, y = o.y - 20 + (d.y - alt - o.y + 20) * k - Math.sin(k * Math.PI) * 50;
        g.drawImage(Pixel.icone("missil"), Math.round(x - 12), Math.round(y - 12));
        g.fillStyle = "#ffa53d"; g.fillRect(Math.round(x - 14), Math.round(y + 2), 3, 3); g.fillStyle = "#ffe066"; g.fillRect(Math.round(x - 17), Math.round(y + 3), 2, 2);
      } else if (f.tipo === "choque") {
        g.fillStyle = "#7cf0ff"; g.globalAlpha = 1 - k;
        b.monstros.forEach(function(m) { const p = tela(m.x, m.y); let x = p.x, y = 0; while (y < p.y - 10) { const nx = x + (Math.random() - 0.5) * 10; g.fillRect(Math.round(Math.min(x, nx)), y, Math.max(2, Math.round(Math.abs(nx - x))), 2); x = nx; y += 6; } });
        g.globalAlpha = k < 0.16 ? 0.35 : 0; g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      } else if (f.tipo === "conserto") {
        g.fillStyle = "#3ccf6e"; g.globalAlpha = 1 - k;
        b.robos.forEach(function(r, i) { if (i % 2) return; const p = tela(r.x, r.y), y = p.y - 26 - k * 24 - (i % 5) * 3; g.fillRect(Math.round(p.x), Math.round(y), 2, 6); g.fillRect(Math.round(p.x - 2), Math.round(y + 2), 6, 2); });
        g.globalAlpha = 1;
      } else if (f.tipo === "sobrecarga") {
        g.globalAlpha = 0.25 * (1 - k); g.fillStyle = "#ff4d5e"; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      }
    });
  }
  function circ(x, y, r, cor) { g.fillStyle = cor; for (let dy = -Math.floor(r); dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); g.fillRect(Math.round(x - w), Math.round(y + dy), w * 2 + 1, 1); } }
  function numeros(b) {
    g.textAlign = "center"; g.font = "8px Pixelify, monospace";
    b.numeros.forEach(function(n) {
      const p = tela(n.x, n.y), y = Math.round(p.y - n.z - n.t * 20);
      g.globalAlpha = 1 - n.t / 0.8;
      g.fillStyle = "#1a1030"; g.fillText(fmt(n.v), p.x + 1, y + 1); g.fillStyle = n.grande ? "#ffcc33" : "#ffffff"; g.fillText(fmt(n.v), p.x, y);
    });
    g.globalAlpha = 1;
  }
  // placar "quantos": robozinhos vivos x monstros vivos, e a barra grande do gigante
  function hud(b) {
    const y = C.emPe ? 34 : 24, mini = spriteMini(Math.max(1, b.robos.length ? b.robos[0].tier : 1));
    const nR = b.robos.length + b.fila.length, nM = b.monstros.length;
    g.font = "10px Pixelify, monospace"; g.textBaseline = "middle";
    g.drawImage(mini, 6, y - 13);
    g.textAlign = "left"; contorno("x" + nR, 32, y, "#7cf0ff");
    const ms = Pixel.monstro(b.h.monstros[0].id);
    g.save(); g.translate(W - 6, y - 12); g.scale(-0.5, 0.5); g.drawImage(ms, 0, 0); g.restore();
    g.textAlign = "right"; contorno("x" + nM, W - 34, y, "#ff8a8a");
    const gig = b.monstros.filter(function(m) { return m.gigante; })[0];
    if (gig) {
      const bw = Math.min(W - 80, 160), bx = Math.round((W - bw) / 2), by = y + 12;
      g.fillStyle = "#1a1030"; g.fillRect(bx - 2, by - 2, bw + 4, 8);
      g.fillStyle = "#4a1020"; g.fillRect(bx, by, bw, 4);
      g.fillStyle = "#ff4d5e"; g.fillRect(bx, by, Math.max(0, Math.round(bw * gig.vida / gig.max)), 4); g.fillStyle = "#ff9aa5"; g.fillRect(bx, by, Math.max(0, Math.round(bw * gig.vida / gig.max)), 1);
      g.textAlign = "center"; contorno(NOMES_MONSTROS[gig.id], W / 2, by + 13, "#ffcc33");
    }
    if (tempo - 0 >= 0 && b.t - b.avisoGigante < 2.2 && Math.floor(b.t * 4) % 2 === 0) {
      g.font = "16px Pixelify, monospace"; g.textAlign = "center"; contorno(t("bat_gigante"), W / 2, Math.round(H * 0.42), "#ff4d5e");
    }
    g.textBaseline = "alphabetic";
  }
  function contorno(txt, x, y, cor) {
    g.fillStyle = "#1a1030";
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) g.fillText(txt, x + dx, y + dy);
    g.fillStyle = cor; g.fillText(txt, x, y);
  }
  function barra(x, y, w, f) {
    if (f <= 0) return;
    g.fillStyle = "#1a1030"; g.fillRect(x - 1, y - 1, w + 2, 4);
    g.fillStyle = f > 0.35 ? "#3ccf6e" : "#ff4d5e"; g.fillRect(x, y, Math.max(1, Math.round(w * f)), 2);
  }
  const cache = {};
  function escrever(id, txt) { if (cache[id] !== txt) { cache[id] = txt; el(id).textContent = txt; } }

  function resultado(f) {
    const r = el("cenaFim");
    Som.som(f.venceu ? "vitoria" : "derrota");
    r.classList.remove("escondido");
    r.innerHTML = "<b style='font-size:30px;color:" + (f.venceu ? "var(--ouro)" : "var(--vermelho)") + "'>" + Paineis.esc(t(f.venceu ? "bat_vitoria" : "bat_derrota")) + "</b>" +
      (f.venceu ? "<span>+" + fmt(f.premio) + " " + Paineis.esc(t("moedas")) + "</span>" : "<span>" + Paineis.esc(t("bat_dica_derrota")) + "</span>");
    if (f.novos.length) { const m = Paineis.elem("div", "mini"); f.novos.forEach(function(d) { m.appendChild(Pixel.img(Pixel.monstro(d.id))); }); r.appendChild(m); }
    if (f.venceu && f.torre) r.appendChild(Paineis.elem("span", "", Paineis.esc(t("torre_venceu", f.torre))));
    if (f.peca) { const pc = Paineis.elem("div", "pecaGanha", "<b style='color:" + RARIDADE_COR[f.peca.r] + "'>" + Paineis.esc(Equip.nome(f.peca)) + "</b> <span>" + Paineis.esc(Equip.textoBonus(f.peca)) + "</span>"); pc.prepend(Paineis.icone(EQUIP_TIPOS[f.peca.t].ico)); r.appendChild(pc); }
    const l = Paineis.elem("div", "linhaBtns");
    const ok = Paineis.elem("button", "btn grande", Paineis.esc(t(f.venceu ? "pegar" : "voltar")));
    ok.addEventListener("click", function() { Som.som("clique"); fechar(true); });
    l.appendChild(ok);
    if (f.venceu && Poki.premiadoDisponivel()) {
      const x2 = Paineis.elem("button", "btn roxo grande", ""); x2.appendChild(Paineis.icone("video")); x2.appendChild(document.createTextNode(t("x2_anuncio")));
      x2.addEventListener("click", function() { Poki.premiado("small").then(function(v) { if (v) save.p.moedas += f.premio; salvar(); fechar(false); }); });
      l.appendChild(x2);
    }
    r.appendChild(l);
  }
  // sair: no meio da luta é desistir (sem prêmio); no fim volta com intervalo comercial
  function fechar(intervalo) {
    aberta = false;
    cena.classList.add("escondido");
    Som.musica("jogo");
    Batalha.sair();
    if (typeof BatalhaTela !== "undefined") BatalhaTela.voltou();
    if (intervalo) Poki.intervalo();
  }
  return { abrir: abrir, passo: passo, get aberta() { return aberta; } };
})();
