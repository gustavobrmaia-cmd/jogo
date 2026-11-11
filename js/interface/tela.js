"use strict";

// =========================
// TELA PRINCIPAL: grade de robôs (arrastar um no outro igual junta; tocar junta com um igual ou manda para o time),
// time de 5 ao lado do botão vermelho (cada um aperta o botão sozinho), botão "criar robô", contadores e dicas.
// Layout: deitado (abas | grade | botão) ou em pé (body.empe: botão em cima, grade embaixo, abas no rodapé).
// =========================
const Tela = (function() {
  const cvB = el("cvBotao"), gB = cvB.getContext("2d");
  let apertadoAte = 0, tamBotao = 300;
  const vagas = { grade: [], time: [] };

  // ---------- layout ----------
  function layout() {
    const empe = window.innerHeight > window.innerWidth * 1.05;
    // v12: celular deitado (tela baixa): modo compacto (body.baixo) para tudo caber na altura
    const baixo = !empe && window.innerHeight < 540;
    document.body.classList.toggle("empe", empe);
    document.body.classList.toggle("baixo", baixo);
    const esq = el("esq").getBoundingClientRect(), dir = el("dir").getBoundingClientRect();
    const col = 6, lin = Math.ceil(vagasGrade() / col), gap = baixo ? 4 : 6, pad = baixo ? 20 : 30;
    const alturaCriar = baixo ? 66 : empe ? 70 : 84;
    // vaga: o maior quadrado que cabe (grade de 6 colunas + o botão criar embaixo)
    let v = Math.floor(Math.min((esq.width - pad - (col - 1) * gap) / col, (esq.height - alturaCriar - pad - (lin - 1) * gap) / lin));
    v = limitar(v, baixo ? 24 : 34, 110);
    document.documentElement.style.setProperty("--v", v + "px");
    // botão: o time ocupa uma coluna do lado
    const vt = limitar(Math.floor(Math.min(v, (dir.height - 60) / vagasTime() - 8)), 30, 100);
    el("time").style.setProperty("--v", vt + "px");
    tamBotao = Math.floor(Math.min(dir.width - vt - 70, dir.height - (empe ? 20 : 70)));
    tamBotao = limitar(tamBotao, 120, 460);
    const esc = Math.max(1, Math.floor(tamBotao / 64));   // escala inteira: pixels nítidos
    cvB.width = 64 * esc; cvB.height = 64 * esc;
    cvB.style.width = cvB.style.height = tamBotao + "px";
    gB.imageSmoothingEnabled = false;
    desenharBotao(true);
  }
  window.addEventListener("resize", function() { layout(); });

  // ---------- vagas ----------
  function montarVagas() {
    ["grade", "time"].forEach(function(lista) {
      const caixa = el(lista);
      caixa.innerHTML = ""; vagas[lista] = [];
      save.p[lista].forEach(function(_, i) {
        const d = document.createElement("div");
        d.className = "vaga"; d.dataset.lista = lista; d.dataset.i = i;
        const im = document.createElement("img"); im.className = "px robo"; im.draggable = false; im.alt = "";
        im.style.setProperty("--d", (-Math.random() * 1.1).toFixed(2) + "s");   // cada robô respira no seu tempo
        const cx = document.createElement("img"); cx.className = "px caixinha"; cx.draggable = false; cx.alt = ""; cx.style.display = "none";
        const nv = document.createElement("span"); nv.className = "nv";
        const tr = document.createElement("i"); tr.className = "tr"; tr.style.display = "none";
        d.appendChild(im); d.appendChild(cx); d.appendChild(nv); d.appendChild(tr); caixa.appendChild(d);
        d._im = im; d._cx = cx; d._nv = nv; d._tr = tr; d._trId = null;
        d._tier = -1; vagas[lista].push(d);
        d.addEventListener("pointerdown", function(e) { comecarArrasto(e, lista, i); });
      });
    });
    atualizarVagas();
  }
  function atualizarVagas() {
    if (vagas.grade.length !== save.p.grade.length || vagas.time.length !== save.p.time.length) { montarVagas(); layout(); return; }
    ["grade", "time"].forEach(function(lista) {
      save.p[lista].forEach(function(n, i) {
        const d = vagas[lista][i], trId = n ? Jogo.trDe(lista, i) : "";
        if (d._trId !== trId) {   // selo do traço (canto de cima, à esquerda)
          d._trId = trId;
          if (trId) { d._tr.style.display = ""; d._tr.style.backgroundImage = "url(" + Pixel.url(Pixel.icone(TRACOS[trId].ico)) + ")"; d._tr.style.setProperty("--trc", TRACOS[trId].cor); d._tr.title = t("tr_" + trId); }
          else d._tr.style.display = "none";
          d.classList.toggle("lenda", trId === "lenda");   // v14: robô lenda brilha
        }
        if (d._tier === n) return;
        d._tier = n;
        const im = d._im;
        if (n) { im.src = Pixel.url(Pixel.robo(n)); im.style.display = d._abrindo ? "none" : ""; d._nv.textContent = d._abrindo ? "" : n; }
        else { im.style.display = "none"; d._nv.textContent = ""; d._cx.style.display = "none"; d._abrindo = 0; }
        d.classList.toggle("vazia", !n);
        if (n) d.dataset.r = Math.min(6, Math.ceil(n / 5)); else delete d.dataset.r;   // raridade: cor do brilho da vaga
      });
    });
    marcarIguais();
  }
  // contorno dourado nos robôs que têm par (dá para juntar)
  function marcarIguais() {
    const cont = {};
    save.p.grade.concat(save.p.time).forEach(function(n) { if (n) cont[n] = (cont[n] || 0) + 1; });
    ["grade", "time"].forEach(function(l) { vagas[l].forEach(function(d) { d.classList.toggle("igual", d._tier > 0 && cont[d._tier] > 1 && d._tier < MAX_TIER); }); });
  }
  function animarVaga(lista, i, classe) {
    const d = vagas[lista][i]; if (!d) return;
    d.classList.remove(classe); void d.offsetWidth; d.classList.add(classe);
    setTimeout(function() { d.classList.remove(classe); }, 450);
  }
  function centroVaga(lista, i) { const r = vagas[lista][i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  // ---------- arrastar ----------
  let arr = null;
  const fantasma = el("arrasto");
  function comecarArrasto(e, lista, i) {
    if (vagas[lista][i]._abrindo) { abrirCaixa(lista, i); e.preventDefault(); return; }   // tocou na caixinha: abre já
    if (!save.p[lista][i] || Paineis.escolhendo()) return;
    e.preventDefault();
    arr = { lista: lista, i: i, x0: e.clientX, y0: e.clientY, id: e.pointerId, mov: false };
  }
  window.addEventListener("pointermove", function(e) {
    if (!arr || e.pointerId !== arr.id) return;
    if (!arr.mov && Math.hypot(e.clientX - arr.x0, e.clientY - arr.y0) > 8) {
      arr.mov = true;
      fantasma.src = Pixel.url(Pixel.robo(save.p[arr.lista][arr.i]));
      fantasma.classList.remove("escondido");
      vagas[arr.lista][arr.i].classList.add("arrastando");
    }
    if (arr.mov) {
      fantasma.style.left = e.clientX + "px"; fantasma.style.top = e.clientY + "px";
      document.querySelectorAll(".vaga.alvo").forEach(function(d) { d.classList.remove("alvo"); });
      const alvo = vagaEm(e.clientX, e.clientY); if (alvo) alvo.classList.add("alvo");
    }
  });
  function vagaEm(x, y) { const e = document.elementFromPoint(x, y); return e && e.closest ? e.closest(".vaga") : null; }
  function soltar(e) {
    if (!arr || e.pointerId !== arr.id) return;
    const a = arr; arr = null;
    fantasma.classList.add("escondido");
    document.querySelectorAll(".vaga.alvo, .vaga.arrastando").forEach(function(d) { d.classList.remove("alvo", "arrastando"); });
    if (!a.mov) { Jogo.tocarRobo(a.lista, a.i); Som.som("clique"); return; }
    const alvo = vagaEm(e.clientX, e.clientY);
    if (!alvo) return;
    Jogo.mover({ lista: a.lista, i: a.i }, { lista: alvo.dataset.lista, i: +alvo.dataset.i });
    Som.som("encaixe");
  }
  window.addEventListener("pointerup", soltar);
  window.addEventListener("pointercancel", soltar);

  // ---------- botão vermelho ----------
  // reflexo: a cada 4 s uma faixa de luz passa na diagonal pelo botão (só onde tem botão: source-atop)
  function desenharBotao(forcar) {
    const agora = performance.now(), ap = agora < apertadoAte, k = (agora % 4000) / 550, brilho = k < 1;
    if (!forcar && !brilho && ap === desenharBotao.ultimo && !desenharBotao.brilhava) return;
    desenharBotao.ultimo = ap; desenharBotao.brilhava = brilho;
    gB.clearRect(0, 0, cvB.width, cvB.height);
    gB.drawImage(Pixel.botao(ap, save.skin), 0, 0, cvB.width, cvB.height);
    cvB.classList.toggle("arcoiris", save.skin === "arcoiris");
    if (brilho && !ap) {
      const e = cvB.width / 64, x = Math.round((-16 + k * 96) ) * e;
      gB.save(); gB.globalCompositeOperation = "source-atop"; gB.globalAlpha = 0.35; gB.fillStyle = "#ffffff";
      gB.beginPath(); gB.moveTo(x, 0); gB.lineTo(x + 6 * e, 0); gB.lineTo(x - 18 * e, 64 * e); gB.lineTo(x - 24 * e, 64 * e); gB.fill();
      gB.globalAlpha = 0.2; gB.beginPath(); gB.moveTo(x + 9 * e, 0); gB.lineTo(x + 11 * e, 0); gB.lineTo(x - 13 * e, 64 * e); gB.lineTo(x - 15 * e, 64 * e); gB.fill();
      gB.restore();
    }
  }
  function apertarVisual(ms) { apertadoAte = Math.max(apertadoAte, performance.now() + (ms || 90)); }
  cvB.addEventListener("pointerdown", function(e) {
    e.preventDefault();
    Jogo.tocar();
    apertarVisual(90);
    if (Math.random() < 0.6) Fx.moedas(e.clientX, e.clientY, 1);
    Som.som("botao", 0.95 + Math.random() * 0.1);
    vibrar(8);
    Eventos.toque();
  });
  Jogo.ao("toque", function(d) {
    const r = cvB.getBoundingClientRect();
    const x = (Tela.ultimoX !== undefined ? Tela.ultimoX : r.left + r.width / 2), y = r.top + r.height * 0.25;
    Fx.numero(x, y, "+" + fmt(d.valor), d.critico ? "#ff5d73" : "#ffcc33", d.critico ? 40 : 30);
    if (d.critico) Fx.faiscas(x, y, "#ff5d73", 14);
  });
  cvB.addEventListener("pointerdown", function(e) { Tela.ultimoX = e.clientX; }, true);
  Jogo.ao("timeClicou", function(d) {
    const v = vagas.time[d.i]; if (!v) return;
    v.classList.add("bate"); setTimeout(function() { v.classList.remove("bate"); }, 110);
    apertarVisual(70);
    somaTime += d.valor;
    Som.som("time", 1 + d.i * 0.06);
  });
  // o que o time ganha aparece somado, um número a cada 0,7 s (antes era um por apertada e virava bagunça)
  let somaTime = 0;
  setInterval(function() {
    if (somaTime <= 0) return;
    const r = cvB.getBoundingClientRect();
    if (r.width) Fx.numero(r.left + r.width * (0.35 + Math.random() * 0.3), r.top + r.height * 0.2, "+" + fmt(somaTime), "#ffe9a3", 24);
    somaTime = 0;
  }, 700);

  // ---------- criar ----------
  el("btnCriar").addEventListener("click", function() {
    if (Jogo.criar()) Som.som("criar");
    else Som.som("erro");
  });
  // o robô nasce dentro de uma caixinha: ela cai, treme e abre (tocar abre na hora)
  function caixinha(lista, i) {
    const d = vagas[lista][i]; if (!d) return;
    d._abrindo = performance.now();
    d._cx.src = Pixel.url(Pixel.caixa(false)); d._cx.style.display = ""; d._cx.classList.remove("treme");
    d._im.style.display = "none"; d._nv.textContent = "";
    clearTimeout(d._t1); clearTimeout(d._t2);
    d._t1 = setTimeout(function() { d._cx.classList.add("treme"); }, 250);
    d._t2 = setTimeout(function() { abrirCaixa(lista, i); }, 750);
  }
  function abrirCaixa(lista, i) {
    const d = vagas[lista][i]; if (!d || !d._abrindo) return;
    clearTimeout(d._t1); clearTimeout(d._t2);
    d._abrindo = 0;
    d._cx.classList.remove("treme"); d._cx.src = Pixel.url(Pixel.caixa(true));
    setTimeout(function() { if (!d._abrindo) d._cx.style.display = "none"; }, 160);
    d._tier = -1; atualizarVagas();
    animarVaga(lista, i, "juntou");
    const c = centroVaga(lista, i); Fx.faiscas(c.x, c.y, "#ffcc33", 8);
    Som.som("abrir");
  }
  Jogo.ao("criou", function(d) { atualizarVagas(); caixinha("grade", d.i); });
  Jogo.ao("juntou", function(d) {
    atualizarVagas();
    animarVaga(d.lista, d.i, "juntou");
    const c = centroVaga(d.lista, d.i);
    Fx.faiscas(c.x, c.y, "#7cf0ff", 12);
    Som.som("juntar", 1 + Math.min(d.tier, 20) * 0.03);
    if (d.pulou) { Fx.numero(c.x, c.y - 20, "+2!", "#ff9df0", 40); Fx.faiscas(c.x, c.y, "#ff9df0", 20); }   // Fusão Instável
    if (d.clone) { Fx.numero(c.x, c.y + 10, "x2", "#7cf0ff", 34); }   // Clonagem: sobrou uma cópia
    vibrar(15);
  });
  // robô nasceu com traço: nome do traço sobe da vaga
  Jogo.ao("traco", function(d) {
    setTimeout(function() { const v = vagas[d.lista] && vagas[d.lista][d.i]; if (!v) return; const c = centroVaga(d.lista, d.i); Fx.numero(c.x, c.y - 24, t("tr_" + d.tr), TRACOS[d.tr].cor, 20); }, d.lista === "grade" ? 800 : 100);
  });
  Jogo.ao("cheio", function() {
    const g = el("grade"); g.classList.remove("cheio"); void g.offsetWidth; g.classList.add("cheio");
    Paineis.faixa(null, t("grade_cheia"), t("grade_cheia_d"));
  });
  Jogo.ao("mudou", function() { atualizarVagas(); });

  // Fúria e juros (v8)
  Jogo.ao("furia", function() {
    const r = cvB.getBoundingClientRect();
    Fx.numero(r.left + r.width / 2, r.top + r.height * 0.15, t("furia"), "#ff5a2e", 46); Fx.faiscas(r.left + r.width / 2, r.top + r.height / 2, "#ff8a2e", 30);
    Som.som("hab_sobrecarga"); vibrar(60);
  });
  Jogo.ao("juros", function(d) { const r = el("boxMoedas").getBoundingClientRect(); Fx.numero(r.left + r.width / 2, r.bottom + 14, "+" + fmt(d.valor), "#3ccf6e", 22); });
  // medidor de combo / fúria em cima do botão
  function atualizarCombo() {
    const box = el("combo"), f = Jogo.emFuria(), c = Jogo.combo;
    const mostra = f || (nivelUp("ritmo") > 0 && c > 0.02);
    if (!mostra) { if (!box.classList.contains("escondido")) box.classList.add("escondido"); return; }
    box.classList.remove("escondido"); box.classList.toggle("furia", f);
    escrever("comboTxt", f ? t("furia") + " " + Math.ceil(Jogo.furiaRestante()) + "s" : t("combo") + " +" + Math.round(c * 20 * nivelUp("ritmo")) + "%");
    box.querySelector("s").style.width = Math.round((f ? Jogo.furiaRestante() / (4 + 2 * nivelUp("furia")) : c) * 100) + "%";
  }
  // ---------- contadores (todo quadro, só escreve quando muda) ----------
  const cache = {};
  function escrever(id, txt) { if (cache[id] !== txt) { cache[id] = txt; (id === "comboTxt" ? el("combo").firstChild : el(id)).textContent = txt; } }
  function atualizarTopo() {
    escrever("txtMoedas", fmt(save.p.moedas));
    const des = save.p.desafio ? "⚑ " + t("des_" + save.p.desafio) + (save.p.desafioFeito ? " ✓" : "") : "";
    if (cache.des !== des) { cache.des = des; el("chipDes").textContent = des; el("chipDes").classList.toggle("escondido", !des); }
    atualizarCombo();
    const prod = Jogo.prodTime() * Jogo.multTurbo() * Jogo.multSabotagem();
    escrever("txtProd", prod > 0 ? "+" + fmt(prod) + "/s" : "");
    escrever("txtPh", fmt(save.ph));
    const c = Jogo.custoCriar();
    escrever("txtCusto", fmt(c));
    const sem = save.p.moedas < c;
    if (cache.sem !== sem) { cache.sem = sem; el("btnCriar").classList.toggle("sem", sem); }
    el("esteira").firstChild.style.width = Math.min(100, save.p.esteira / Jogo.intervaloEsteira() * 100) + "%";
  }

  // ---------- dicas do começo ----------
  // 0 toque no botão (10 vezes), 1 crie um robô, 2 junte dois iguais, 3 mande um para o time, 4 pronto
  let toquesDica = 0;
  function dica(passo) {
    const d = el("dica");
    if (save.tutorial >= 4) { d.classList.add("escondido"); el("btnCriar").classList.remove("destaque"); return; }
    const p = save.p, n = p.grade.filter(Boolean).length;
    if (save.tutorial === 0 && toquesDica >= 6) save.tutorial = 1;   // v10: 6 toques (era 10)
    if (save.tutorial === 1 && n >= 1) save.tutorial = 2;
    if (save.tutorial === 2 && save.stats.juncoes > 0) save.tutorial = 3;
    if (save.tutorial === 3 && p.time.some(Boolean)) { save.tutorial = 4; Eventos.marco("tutorial-done"); }
    const txt = ["dica_botao", "dica_criar", "dica_juntar", "dica_time"][save.tutorial];
    d.textContent = t(txt);
    // a dica de criar só aparece com moedas para criar; a de juntar só com um par
    const mostra = save.tutorial === 0 || (save.tutorial === 1 && p.moedas >= Jogo.custoCriar()) || save.tutorial >= 2;
    d.classList.toggle("escondido", !mostra);
    el("btnCriar").classList.toggle("destaque", save.tutorial === 1 && p.moedas >= Jogo.custoCriar());
  }
  Jogo.ao("toque", function() { toquesDica++; });

  return {
    layout: layout, montarVagas: montarVagas, atualizarVagas: atualizarVagas, atualizarTopo: atualizarTopo,
    desenharBotao: desenharBotao, dica: dica, centroVaga: centroVaga, ultimoX: undefined
  };
})();
