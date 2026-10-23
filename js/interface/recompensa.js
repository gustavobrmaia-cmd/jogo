"use strict";

// =========================
// RECOMPENSAS RÁPIDAS
// 1. Fim da partida: tela com o resultado, a barra de XP enchendo (subir de nível dá um baú especial),
//    o baú da partida para abrir (toque -> treme -> abre com raios e o prêmio), "abrir outro baú" (premiado,
//    1 vez) e REVANCHE direto (sem passar pelo menu).
//    O baú abre sozinho e, contra o bot, "PRÓXIMO RIVAL" conta 3 s e começa a próxima partida sozinho
//    (no Poki v9 ~30% de quem terminava a 1ª partida não começava a 2ª). Clicar em outro botão cancela a contagem.
//    O baú da 1ª partida da vida sempre traz um acessório, que já vem equipado.
//    v16: no modo rivais, vitória sem nada para decidir NÃO abre esta tela (fluxo contínuo, telas.js fluxoDireto).
//    v17: a melhoria grátis vem sozinha depois do rival 2; a 1ª vez que esta tela aparece vencendo é depois do rival 3.
//    v13: ao lado do baú, o painel de PODER (Força, Vida, Velocidade; interface/poder.js). Dá para comprar ->
//    a contagem espera 5 s (8 s na 1ª vez) e cada compra devolve pelo menos 4 s.
//    Modo rivais: a fileira dos 10 rivais (vencidos com um "ok", o próximo em destaque), o nome do próximo e o prêmio;
//    perdeu -> "REVANCHE" contra o mesmo. O 5º rival dá um baú de nível e o 10º um baú lendário.
// 2. Recompensa diária: sequência de 7 dias que cresce (dia 3 tem baú, dia 7 baú lendário). Aparece sozinha
//    no menu uma vez por dia; perder um dia volta para o dia 1.
// =========================

let rec = null;        // estado da tela de recompensa
let diaria = null;     // estado da tela da recompensa diária

// ---------- fim da partida ----------
// sub (v19): lista de fichas { icone, texto, classe } (sem emoji; o ícone é do módulo Icone)
function abrirRecompensa(j, titulo, sub) {
  const xp = Progresso.ganharXP(Progresso.xpDaPartida(j));
  const baus = ["normal"];
  for (let i = 0; i < xp.subiu; i++) baus.push("nivel");
  const rr = j.resultadoRival || null;
  if (rr && rr.venceu && rr.i === 4) baus.push("nivel");
  if (rr && rr.venceu && rr.i === RIVAIS.length - 1) baus.push("lendario");
  rec = { modo: j.rival ? "rivais" : j.modo, baus: baus, i: 0, fase: "fechado", t0: 0, premio: null, extraUsado: false, xp: xp,
          primeira: !!j.treino && !rr, aberta: performance.now() / 1000, fimBaus: 0, cancelou: false,   // no modo rivais o acessório vem do rival
          rival: rr, venceu: j.vencedorPartida === 1, poder: j.modo !== "2p", espera: 3 };
  estado = "recompensa";
  garantirDemo();          // no fundo, a luta de demonstração (sem o placar da partida que acabou)
  atualizarTextos();
  el("recTitulo").textContent = titulo;
  rec.sub = (sub || []).concat((xp.liberados || []).map(function(id) { return { icone: "brilho", texto: t("item_liberado", t("sk_" + id)), classe: "skin" }; }));
  mostrarSub(rec.sub);
  el("recPremio").textContent = "";
  // v17.5: vitória (título dourado com raios) ou derrota (tons frios)
  el("telaRecompensa").classList.toggle("venceu", rec.venceu || j.modo === "2p");
  el("telaRecompensa").classList.toggle("perdeu", !rec.venceu && j.modo !== "2p");
  animarXp(xp);
  // painel de poder (contra máquina): ao lado do baú; comprar não cancela a contagem, só dá mais tempo
  const painel = el("recPoder");
  painel.classList.toggle("escondido", !rec.poder);
  el("telaRecompensa").classList.toggle("comPoder", rec.poder);
  if (rec.poder) {
    // v16: lembra que a pessoa já viu as melhorias e zera a conta das vitórias sem tela (telas.js fluxoDireto)
    save.stats.viuPoder = 1;
    save.stats.semTela = 0;
    if (!painel.firstChild) montarPainelPoder(painel, poderComprouNaRecompensa);
    painel.dataset.perdeu = rec.venceu ? "0" : "1";
    atualizarPainelPoder(painel);
    if (Poder.algumaPossivel()) Eventos.oferta("upgrade", "visible");
  }
  // escada de rivais
  el("canvasEscada").classList.toggle("escondido", !rr);
  el("recProximo").classList.toggle("escondido", !rr);
  el("telaRecompensa").classList.toggle("comEscada", !!rr);
  if (rr) {
    const prox = rr.venceu ? (rr.campeao ? 0 : rr.i + 1) : rr.i, liga = rr.venceu && rr.campeao ? rr.liga + 1 : rr.liga;
    // v18.2: campeão ganha a Partida Lendária de presente (a próxima: só armas raras e lendárias) e a tela vira festa
    if (rr.campeao) lendariaPronta = true;
    const poderHtml = function(i, lg) { return Icone.html("raio") + Poder.valor(Poder.doRival(i, lg)); };
    el("recProximo").innerHTML = rr.campeao ? Icone.html("trofeu") + " " + escHtml(t("campeao_liga", nomeLiga(rr.liga))) + "   " + Icone.html("brilho") + " " + escHtml(t("lendaria")) :
      rr.venceu ? escHtml(t("proximo", "@@")).replace("@@", escHtml(RIVAIS[prox].nome) + " " + poderHtml(prox, liga)) + "   ·   " + premioRivalHtml(prox, liga) :
      escHtml(t("revanche_contra", "@@")).replace("@@", escHtml(rr.nome) + " " + poderHtml(rr.i, rr.liga));
  }
  el("telaRecompensa").classList.toggle("campeao", !!(rr && rr.campeao));
  atualizarBotoesRecompensa();
  mostrarTela("telaRecompensa");
  if (xp.subiu) Eventos.marco("player-level-" + xp.nivel);
}

// barra de XP: enche do valor antigo até o novo (passando por "cheia" em cada nível que subiu)
function animarXp(xp) {
  const barra = el("recXp");
  const pct = function(nivel, valor) { return Math.min(100, 100 * valor / Progresso.xpParaSubir(nivel)) + "%"; };
  barra.style.transition = "none";
  barra.style.width = pct(xp.nivelAntes, xp.xpAntes);
  el("recNivel").textContent = t("nivel_jogador", xp.nivelAntes);
  el("recXpTxt").textContent = "+" + xp.ganho + " XP";
  void barra.offsetWidth;
  let passo = 0;
  function proximo() {
    barra.style.transition = "width 0.6s ease-out";
    if (passo < xp.subiu) {
      barra.style.width = "100%";
      setTimeout(function() {
        passo++;
        som("vitoria_rodada");
        el("recNivel").textContent = t("nivel_jogador", xp.nivelAntes + passo);
        reanimar(el("recNivel"), "pop");
        mostrarSub(rec ? rec.sub : [], { icone: "estrela", texto: t("subiu_nivel", xp.nivelAntes + passo), classe: "nivel" });
        barra.style.transition = "none"; barra.style.width = "0%"; void barra.offsetWidth;
        proximo();
      }, 650);
    } else barra.style.width = pct(xp.nivel, xp.xp);
  }
  setTimeout(proximo, 250);
}

// v17.5: o subtítulo vira "fichas" (moedas, troféu, skin, nível) em vez de uma linha comprida só
// v19: cada ficha é { icone, texto, classe } (ícone desenhado, sem emoji)
function mostrarSub(lista, nivel) {
  const alvo = el("recSub");
  alvo.innerHTML = "";
  const partes = (lista || []).slice();
  if (nivel) partes.unshift(nivel);
  partes.forEach(function(p) {
    if (!p || !p.texto) return;
    const s = document.createElement("span");
    s.className = "chip" + (p.classe ? " " + p.classe : "");
    s.innerHTML = (p.icone ? Icone.html(p.icone) + " " : "") + escHtml(p.texto);
    alvo.appendChild(s);
  });
}

function atualizarBotoesRecompensa() {
  const faltam = rec.i < rec.baus.length;
  el("btnAbrirBau").classList.toggle("escondido", !faltam || rec.fase !== "fechado");
  el("btnAbrirBau").textContent = rec.baus[rec.i] === "nivel" ? t("abrir_bau_nivel") : t("abrir_bau");
  const podeExtra = !faltam && rec.fase !== "sacudindo" && !rec.extraUsado && Poki.premiadoDisponivel();
  el("btnOutroBau").classList.toggle("escondido", !podeExtra);
  el("btnOutroBau").innerHTML = Icone.html("play") + " " + escHtml(t("outro_bau"));
  el("telaRecompensa").classList.toggle("comExtra", podeExtra);   // v17.5: o baú sobe para o botão caber no cartão
  textoRevanche(rec.cancelou ? 0 : rec.n || 0);
  if (podeExtra && !rec.ofertou) { rec.ofertou = true; Eventos.oferta("extra-chest", "visible"); }
}

function abrirBauDaVez() {
  if (!rec || rec.i >= rec.baus.length || rec.fase !== "fechado") return;
  rec.fase = "sacudindo";
  rec.t0 = performance.now() / 1000;
  som("carga");
  atualizarBotoesRecompensa();
  // se a pessoa sair da tela no meio da animação, fecharRecompensa já entrega o baú: os passos abaixo não rodam
  const r = rec;
  setTimeout(function() {
    if (rec !== r) return;
    rec.premio = Progresso.abrirBau(rec.baus[rec.i], rec.primeira && rec.i === 0);
    rec.fase = "aberto";
    rec.t0 = performance.now() / 1000;
    som("carta");
    mostrarPremio(el("recPremio"), rec.premio);
    rec.i++;
    if (rec.poder) atualizarPainelPoder(el("recPoder"));
    // próximo baú (se subiu de nível) fica pronto depois de um instante
    setTimeout(function() {
      if (rec !== r) return;
      if (rec.i < rec.baus.length) { rec.fase = "fechado"; }
      atualizarBotoesRecompensa();
      atualizarMenuProgresso();
    }, 900);
  }, 700);
}

function mostrarPremio(alvo, premio) {
  let txt = Icone.html("moeda") + " " + escHtml(t("n_moedas", premio.moedas));
  if (premio.skin) txt += "   " + Icone.html("presente") + " " + escHtml(t(premio.equipou ? "premio_equipado" : "premio_skin", t("sk_" + premio.skin)));
  alvo.innerHTML = txt;
  reanimar(alvo, "pop");
}

// botão da próxima partida: contra o bot vira "PRÓXIMO RIVAL" com a contagem
function textoRevanche(n) {
  const b = el("btnRevanche");
  if (!b || !rec) return;
  const contra = rec.modo === "bot" || rec.modo === "rivais";
  // v19.6: "PRÓXIMO RIVAL" só quando há rival (no "Contra o bot" é "PRÓXIMA PARTIDA")
  const nome = contra && rec.venceu ? (rec.rival ? t("proximo_rival") : t("proxima_partida")) : t("revanche");
  if (!contra) { b.textContent = nome; return; }
  // v17.5: o número da contagem num selo redondo e uma barra que esvazia embaixo do botão
  b.innerHTML = "";
  const tx = document.createElement("span"); tx.innerHTML = Icone.html("play") + " " + escHtml(nome); b.appendChild(tx);
  if (n > 0) {
    const num = document.createElement("span"); num.className = "rvNum"; num.textContent = n; b.appendChild(num);
    const barra = document.createElement("span"); barra.className = "rvBarra"; b.appendChild(barra);
  }
}

// chamado a cada quadro com a tela aberta: abre o baú sozinho e conta para a próxima partida
function contagemRecompensa(tempo) {
  if (!rec || ocupado) return;
  if (rec.fase === "fechado" && rec.i < rec.baus.length && tempo - Math.max(rec.aberta, rec.t0) > 0.5) abrirBauDaVez();
  if ((rec.modo !== "bot" && rec.modo !== "rivais") || rec.cancelou || rec.i < rec.baus.length || rec.fase !== "aberto") return;
  if (!rec.fimBaus) {
    rec.fimBaus = tempo;
    // dá para melhorar: mais tempo (bem mais na 1ª vez, quando a pessoa ainda não sabe o que é;
    // v17: a grátis automática não conta, então a 1ª compra com moedas também tem 8 s)
    if (rec.poder && Poder.algumaPossivel()) rec.espera = (save.stats.melhorias || 0) >= 2 ? 5 : 8;
  }
  const falta = rec.espera - (tempo - rec.fimBaus - 0.4);
  if (falta <= 0) { Eventos.marco("next-rival-auto"); revanche(); return; }
  const n = Math.ceil(Math.min(rec.espera, falta));
  if (n !== rec.n) {
    rec.n = n; textoRevanche(n);
    if (n > 0 && n <= 3 && !rec.cancelou) som("clique", 1.25 + (3 - n) * 0.15);   // v19.6: tic nos 3 últimos segundos
  }
}

// comprou uma melhoria na tela de fim: a contagem para a próxima partida volta a ter pelo menos 4 s
function poderComprouNaRecompensa() {
  if (rec) rec.comprou = true;
  if (!rec || !rec.fimBaus) return;
  const agora = performance.now() / 1000;
  if (rec.espera - (agora - rec.fimBaus - 0.4) < 4) { rec.espera = 4; rec.fimBaus = agora - 0.4; rec.n = 4; textoRevanche(rec.cancelou ? 0 : 4); }
  Eventos.oferta("upgrade", "interact");
}

function outroBau() {
  if (ocupado || !rec || rec.extraUsado) return;
  ocupado = true;
  rec.cancelou = true;
  textoRevanche(0);
  Eventos.oferta("extra-chest", "interact");
  Poki.premiado("small").then(function(assistiu) {
    ocupado = false;
    if (!assistiu) { atualizarBotoesRecompensa(); return; }
    rec.extraUsado = true;
    rec.baus.push("normal");
    rec.fase = "fechado";
    atualizarBotoesRecompensa();
    abrirBauDaVez();
  });
}

// baús que ficaram sem abrir quando a pessoa sai: o prêmio vem do mesmo jeito
function fecharRecompensa() {
  if (!rec) return;
  if (rec.poder) { save.stats.comprouUltima = rec.comprou ? 1 : 0; salvar(); }
  while (rec.i < rec.baus.length) { Progresso.abrirBau(rec.baus[rec.i], rec.primeira && rec.i === 0); rec.i++; }
  rec = null;
}

function revanche() {
  if (!rec || ocupado) return;
  const modo = rec.modo;
  fecharRecompensa();
  comecarPartida(modo);
}

function recompensaParaMenu() {
  fecharRecompensa();
  irParaMenu(undefined);
}

// desenho do baú (chamado pelo loop enquanto a tela está aberta)
function desenharRecompensa(tempo) {
  const cv = el("canvasBau"), g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  if (!rec || typeof ArteBau === "undefined") return;
  contagemRecompensa(tempo);
  if (!rec) return;
  if (rec.rival) desenharEscada(tempo);
  const tipo = rec.baus[Math.min(rec.i, rec.baus.length - 1)];
  const tipoVisto = rec.fase === "aberto" ? rec.baus[rec.i - 1] : tipo;
  const dt = tempo - rec.t0;
  let abre = 0, sacode = 0;
  if (rec.fase === "sacudindo") sacode = Math.min(1, dt * 2);
  if (rec.fase === "aberto") abre = Math.min(1, dt * 3);
  const pula = rec.fase === "fechado" ? Math.abs(Math.sin(tempo * 3)) * 6 : 0;
  const cx = cv.width / 2, cy = cv.height * 0.54;
  ArteBau.luz(g, cx, cy - 10, 150, tipoVisto, tempo, abre);
  ArteBau.desenhar(g, cx, cy - pula, 1.05, tipoVisto, abre, tempo, sacode);
  if (rec.fase === "aberto") ArteBau.moedas(g, cx, cy - 40, 1, dt);
  // barra da contagem do PRÓXIMO RIVAL (só o desenho; a conta é a de contagemRecompensa)
  const barra = el("btnRevanche").querySelector(".rvBarra");
  if (barra && rec.fimBaus) barra.style.transform = "scaleX(" + Math.max(0, Math.min(1, (rec.espera - (tempo - rec.fimBaus - 0.4)) / rec.espera)).toFixed(3) + ")";
}

// Fileira dos 10 rivais: vencidos com o "ok" verde, o próximo (ou o da revanche) grande e pulsando, os que faltam escondidos.
// Logo depois de uma vitória o rival vencido fica em destaque um instante, ganha o "ok" e o destaque passa adiante.
// v17.5: trilho que enche (verde -> dourado) até o próximo, nome do próximo numa plaquinha e baú em cima do 5º e do 10º.
function desenharEscada(tempo) {
  const cv = el("canvasEscada"), g = cv.getContext("2d"), rr = rec.rival;
  g.clearRect(0, 0, cv.width, cv.height);
  const n = RIVAIS.length, passo = Math.min(94, (cv.width - 90) / (n - 1)), x0 = cv.width / 2 - passo * (n - 1) / 2, y = cv.height * 0.47;
  const dt = tempo - rec.aberta;
  const trocou = rr.venceu && dt > 0.9;
  const vencidos = rr.campeao ? (trocou ? n : n - 1) : rr.i + (trocou ? 1 : 0);
  const destaque = rr.campeao ? (trocou ? -1 : n - 1) : rr.venceu && !trocou ? rr.i : vencidos;
  const fonte = "px Nunito, system-ui, sans-serif";
  // trilho: fundo escuro + parte já andada (enche até o próximo quando o "ok" entra)
  const ate = rr.campeao ? n - 1 : rr.venceu ? rr.i + Math.max(0, Math.min(1, (dt - 0.9) / 0.4)) : rr.i;
  g.lineCap = "round";
  g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 14;
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + passo * (n - 1), y); g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 8;
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + passo * (n - 1), y); g.stroke();
  if (ate > 0) {
    const gr = g.createLinearGradient(x0, 0, x0 + passo * ate, 0);
    gr.addColorStop(0, "#51cf66"); gr.addColorStop(1, "#ffd43b");
    g.strokeStyle = gr; g.lineWidth = 8;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + passo * ate, y); g.stroke();
  }
  for (let k = 0; k < n; k++) {
    const r = RIVAIS[k], x = x0 + k * passo, grande = k === destaque;
    const raio = grande ? 34 + 3 * Math.sin(tempo * 6) : 24;
    // baú do 5º (de nível) e do 10º (lendário) em cima, enquanto não foi vencido
    // (no rival em destaque o baú vai para o canto de cima, fora do anel)
    if ((k === 4 || k === n - 1) && k >= vencidos && typeof ArteBau !== "undefined")
      ArteBau.desenhar(g, x + (grande ? 40 : 0), y - (grande ? 40 : 46) + Math.sin(tempo * 3 + k) * 2, grande ? 0.2 : 0.22, k === n - 1 ? "lendario" : "nivel", 0, tempo, 0);
    if (grande) {
      const halo = g.createRadialGradient(x, y, raio * 0.6, x, y, raio + 22);
      halo.addColorStop(0, "rgba(255,212,59,0.55)"); halo.addColorStop(1, "rgba(255,212,59,0)");
      g.fillStyle = halo; g.beginPath(); g.arc(x, y, raio + 22, 0, 7); g.fill();
      g.strokeStyle = "#ffd43b"; g.lineWidth = 5; g.beginPath(); g.arc(x, y, raio + 7, 0, 7); g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, raio + 11 + 3 * Math.sin(tempo * 6), -2.4, -0.7); g.stroke();
    }
    if (k < vencidos || grande) {
      if (!grande) { g.fillStyle = "#2b8a3e"; g.beginPath(); g.arc(x, y, raio + 4, 0, 7); g.fill(); }
      g.globalAlpha = k < vencidos && !grande ? 0.85 : 1;
      if (typeof ArteSkins !== "undefined") ArteSkins.miniatura(g, r.corpo, r.acessorio, r.cor, x, y, raio, tempo);
      else { g.fillStyle = r.cor; g.beginPath(); g.arc(x, y, raio, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    } else {
      // quem ainda não apareceu: silhueta com "?"
      g.fillStyle = "#1d1f36"; g.beginPath(); g.arc(x, y, raio + 3, 0, 7); g.fill();
      const fundo = g.createLinearGradient(0, y - raio, 0, y + raio);
      fundo.addColorStop(0, "#3a3f63"); fundo.addColorStop(1, "#262a46");
      g.fillStyle = fundo; g.beginPath(); g.arc(x, y, raio, 0, 7); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, raio - 3, 3.6, 5.8); g.stroke();
      g.fillStyle = "rgba(255,255,255,0.55)"; g.font = "900 26" + fonte; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("?", x, y + 1);
    }
    if (k < vencidos) {
      // "ok" verde desenhado (com um "pulo" quando acabou de ganhar)
      const novo = rr.venceu && k === vencidos - 1 && dt < 1.3 ? 1 + 0.6 * Math.max(0, 1.3 - dt) : 1;
      g.save(); g.translate(x + 17, y + 15); g.scale(novo, novo);
      g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill();
      g.fillStyle = "#2f9e44"; g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 3.5; g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath(); g.moveTo(-5, 0); g.lineTo(-1, 4); g.lineTo(6, -4); g.stroke();
      g.restore();
    }
    g.textAlign = "center"; g.textBaseline = "middle";
    if (grande) {
      // nome numa plaquinha dourada
      g.font = "900 21" + fonte;
      const w = g.measureText(r.nome).width + 26, py = y + raio + 24;
      g.fillStyle = "#8a4b00"; retArredondado(g, x - w / 2, py - 13, w, 30, 15); g.fill();
      g.fillStyle = "#ffd43b"; retArredondado(g, x - w / 2, py - 15, w, 28, 14); g.fill();
      g.fillStyle = "#3b1d00"; g.fillText(r.nome, x, py);
    } else {
      g.font = "900 16" + fonte;
      g.fillStyle = k < vencidos ? "rgba(140,233,154,0.9)" : "rgba(255,255,255,0.5)";
      g.fillText(String(k + 1), x, y + raio + 16);
    }
  }
}

function retArredondado(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------- recompensa diária ----------
function abrirDiaria() {
  const dia = Progresso.diaDisponivel();
  if (!dia) return false;
  diaria = { dia: dia, fase: "fechado", t0: 0, premio: null };
  estado = "diaria";
  montarDiaria(dia, false);
  el("diariaPremio").textContent = "";
  el("btnPegarDiaria").classList.remove("escondido");
  el("btnFecharDiaria").classList.add("escondido");
  el("canvasDiaria").classList.add("escondido");
  Eventos.oferta("daily", "visible");
  mostrarTela("telaDiaria");
  return true;
}

function montarDiaria(dia, pego) {
  const g = el("gradeDiaria");
  g.innerHTML = "";
  Progresso.DIARIAS.forEach(function(r, i) {
    const n = i + 1;
    const c = document.createElement("div");
    c.className = "diaCard" + (n < dia || (pego && n === dia) ? " pego" : "") + (n === dia ? " hoje" : "") + (n === 7 ? " grande" : "");
    const h = document.createElement("div"); h.className = "diaNum"; h.textContent = t("dia_n", n); c.appendChild(h);
    // ícone: baú desenhado (dias com baú) ou moeda
    if (r.bau && typeof ArteBau !== "undefined") {
      const cv = document.createElement("canvas"); cv.width = 110; cv.height = 80; cv.className = "diaIcone";
      ArteBau.desenhar(cv.getContext("2d"), 55, 50, 0.42, r.bau, 0, 0, 0);
      c.appendChild(cv);
    } else { const ic = document.createElement("div"); ic.className = "moedaGrande"; c.appendChild(ic); }
    const v = document.createElement("div"); v.className = "diaValor"; v.textContent = r.moedas + (r.bau ? " + " + t(r.bau === "lendario" ? "bau_lendario" : "bau") : ""); c.appendChild(v);
    if (n < dia || (pego && n === dia)) { const ok = document.createElement("div"); ok.className = "diaOk"; ok.innerHTML = Icone.html("ok"); c.appendChild(ok); }
    g.appendChild(c);
  });
}

function pegarDiaria() {
  if (!diaria || diaria.fase !== "fechado") return;
  const premio = Progresso.pegarDiaria();
  if (!premio) { fecharDiaria(); return; }
  Eventos.oferta("daily", "interact");   // v15: antes só media "visible" e a tabela mostrava 0% pegando
  diaria.premio = premio;
  montarDiaria(premio.dia, true);
  som("carta");
  let txt = Icone.html("moeda") + " " + escHtml(t("n_moedas", premio.moedas));
  if (premio.bau) {
    diaria.fase = "aberto"; diaria.t0 = performance.now() / 1000; diaria.tipoBau = premio.bau.tipo;
    el("canvasDiaria").classList.remove("escondido");
    txt += "   " + Icone.html("bau") + " " + escHtml(t("n_moedas", premio.bau.moedas)) + (premio.bau.skin ? "   " + Icone.html("presente") + " " + escHtml(t("premio_skin", t("sk_" + premio.bau.skin))) : "");
  } else diaria.fase = "pego";
  el("diariaPremio").innerHTML = txt;
  el("btnPegarDiaria").classList.add("escondido");
  el("btnFecharDiaria").classList.remove("escondido");
  atualizarMenuProgresso();
}

function fecharDiaria() {
  diaria = null;
  estado = "menu";
  atualizarTextos();
  mostrarTela("telaMenu");
}

function desenharDiaria(tempo) {
  if (!diaria || diaria.fase !== "aberto" || typeof ArteBau === "undefined") return;
  const cv = el("canvasDiaria"), g = cv.getContext("2d"), dt = tempo - diaria.t0;
  g.clearRect(0, 0, cv.width, cv.height);
  ArteBau.luz(g, cv.width / 2, cv.height * 0.6 - 10, 110, diaria.tipoBau, tempo, 1);
  ArteBau.desenhar(g, cv.width / 2, cv.height * 0.6, 0.8, diaria.tipoBau, Math.min(1, dt * 3), tempo, 0);
  ArteBau.moedas(g, cv.width / 2, cv.height * 0.6 - 30, 0.7, dt);
}
