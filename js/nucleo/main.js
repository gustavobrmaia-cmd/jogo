"use strict";

// =========================
// INÍCIO, TAMANHO DA TELA E LOOP
// - física em passos fixos de 1/60 s (igual em 60, 120 ou 144 Hz) e desenho a cada quadro;
// - deitado: o jogo (1280x720) cabe inteiro no meio da janela;
//   em pé (celular): ocupa a largura toda e fica mais alto (alturaTela), sem pedir para girar;
// - nada roda durante anúncio (o Poki avisa) e a aba escondida pausa o jogo;
// - nos menus, a luta de demonstração (bot contra bot) continua rodando no fundo.
// =========================

const canvas = el("canvas");
// v20.7: opaco (o jogo pinta a tela inteira todo quadro): o navegador não precisa misturar o canvas com a página
const ctx = canvas.getContext("2d", { alpha: false });
let alturaTela = CONFIG.altura;
let modoRetrato = false;
// v20.7: RESOLUÇÃO do canvas. O jogo desenha em 1280 x alturaTela (coordenadas lógicas), mas o canvas por dentro tem
// só os pixels que a tela mostra: largura na tela x densidade (no máx. 2, ou 1,25 quando a qualidade automática
// baixa), nunca mais que 1280. Em pé no celular o canvas era 1280 x ~2840 (4x o deitado) para uma tela de ~400 px:
// com a CPU 4x mais lenta, 12 qps em pé contra 54 deitado. resTela = pixels do canvas por unidade lógica.
let resTela = 1;

function ajustarTela() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const retrato = CONFIG.permitirRetrato && h > w * 1.15;
  const escala = retrato ? w / CONFIG.largura : Math.min(w / CONFIG.largura, h / CONFIG.altura);
  const alt = retrato ? Math.max(CONFIG.altura, Math.floor(h / escala)) : CONFIG.altura;
  modoRetrato = retrato;
  alturaTela = alt;
  const dens = Math.min(window.devicePixelRatio || 1, CONFIG.resBaixa ? 1.25 : 2);
  resTela = Math.max(0.35, Math.min(1, Math.round(escala * dens * 20) / 20));   // em passos de 5%
  const cw = Math.round(CONFIG.largura * resTela), ch = Math.round(alt * resTela);
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;
  const tela = el("tela");
  tela.style.height = alt + "px";
  tela.style.transform = "translate(-50%, -50%) scale(" + escala + ")";
  document.body.classList.toggle("retrato", retrato);
}
window.addEventListener("resize", ajustarTela);
window.addEventListener("orientationchange", function() { setTimeout(ajustarTela, 150); });

// ---------- qualidade ----------
// "auto": leve em aparelho de toque ou com pouca memória/poucos núcleos (a maioria dos celulares).
function aplicarQualidade() {
  const q = save.qualidade;
  const fraco = entrada.toque || (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  CONFIG.leve = q === "leve" || (q !== "alta" && !!fraco);
  document.body.classList.toggle("toque", !!entrada.toque);
}

// v20.7: QUALIDADE AUTOMÁTICA. No "auto" o leve só liga em toque ou aparelho com pouca memória/poucos núcleos; um
// computador com 8 núcleos e vídeo fraco (ou sem aceleração no canvas) ficava de fora. Na partida, a cada 3 s de luta
// mede os quadros por segundo: 2 medidas seguidas abaixo de 45 descem um degrau até o fim da sessão (o save continua
// "auto"): 1º o modo leve, 2º a resolução baixa (densidade 1,25).
const medidaQps = { t: 0, n: 0, ruins: 0 };
function vigiarQualidade(dt) {
  if ((CONFIG.leve && CONFIG.resBaixa) || save.qualidade !== "auto" || estado !== "jogo" || !jogo || jogo.fase !== "luta") return;
  if (dt > 250) return;                    // aba escondida, anúncio, travada isolada: não conta
  medidaQps.t += dt; medidaQps.n++;
  if (medidaQps.t < 3000) return;
  const qps = medidaQps.n * 1000 / medidaQps.t;
  medidaQps.t = 0; medidaQps.n = 0;
  medidaQps.ruins = qps < 45 ? medidaQps.ruins + 1 : 0;
  if (medidaQps.ruins >= 2) {
    medidaQps.ruins = 0;
    if (!CONFIG.leve) {
      CONFIG.leve = true;
      document.body.classList.add("leve");
      Poki.medir("perf", "auto-light", String(Math.round(qps)));
    } else {
      CONFIG.resBaixa = true;
      ajustarTela();
      Poki.medir("perf", "auto-lowres", String(Math.round(qps)));
    }
  }
}

// ---------- loop ----------
let ultimo = performance.now();
let acumulado = 0;

function passo(dt) {
  entrada.atualizar();
  if (estado === "jogo") {
    if (entrada.pausa()) { pausar(); return; }
    atualizarJogo(dt);
    Eventos.passoDeJogo(dt);
    Progresso.atualizarAvisos(dt / 1000, typeof faixaPremio !== "undefined" && !!faixaPremio);
  } else if (estado === "pausa") {
    if (entrada.pausa()) continuar();
    else if (jogo && jogo.modo === "online") atualizarJogo(dt);   // v19: o online não para na pausa (o outro continua)
  } else if (jogo && jogo.demo) {
    atualizarJogo(dt);     // luta de demonstração no fundo dos menus
  }
}

// Um erro inesperado (num desenho, por exemplo) nunca pode travar o jogo: registra 1 vez e segue.
function protegido(fn, arg) {
  try { fn(arg); } catch (e) {
    if (!protegido.avisou) {
      protegido.avisou = true;
      console.error(e);
      Poki.medir("error", "loop", String(e && e.message || e).slice(0, 40));
    }
  }
}

function quadro(agora) {
  let dt = agora - ultimo;
  ultimo = agora;
  vigiarQualidade(dt);
  if (dt > 100) dt = 100;   // voltou de outra aba: não "pula" o tempo
  if (!Poki.anuncioAberto) {
    acumulado += dt;
    let n = 0;
    while (acumulado >= CONFIG.passo && n < 5) {
      protegido(passo, CONFIG.passo);
      acumulado -= CONFIG.passo;
      n++;
    }
    if (n === 5) acumulado = 0;   // computador muito lento: não acumula atraso
  } else {
    acumulado = 0;
  }
  // modo leve: a luta de fundo dos menus é desenhada a 30 qps (metade do trabalho)
  quadro.par = !quadro.par;
  ctx.setTransform(resTela, 0, 0, resTela, 0, 0);   // v20.7: o desenho continua em coordenadas lógicas
  if (!(CONFIG.leve && estado !== "jogo" && jogo && jogo.demo && quadro.par)) protegido(desenharJogo, ctx);
  if (estado === "skins") protegido(desenharPreviaSkin, agora / 1000);
  if (estado === "recompensa") protegido(desenharRecompensa, agora / 1000);
  if (estado === "diaria") protegido(desenharDiaria, agora / 1000);
  requestAnimationFrame(quadro);
}

// v20.7: roda as tarefas uma a uma nas folgas do navegador (requestIdleCallback: o tempo que sobra depois do quadro).
// Sem ele (Safari): uma tarefa a cada 50 ms. Se o navegador nunca folgar, o timeout garante que anda mesmo assim.
function filaAquecer(lista) {
  let i = 0;
  const ocioso = typeof requestIdleCallback === "function";
  function rodar(prazo) {
    const ini = performance.now();
    do { if (i < lista.length) protegido(lista[i++]); }
    while (i < lista.length && (ocioso ? prazo.timeRemaining() > 4 : performance.now() - ini < 4));
    if (i < lista.length) { if (ocioso) requestIdleCallback(rodar, { timeout: 400 }); else setTimeout(rodar, 50); }
  }
  if (ocioso) requestIdleCallback(rodar, { timeout: 400 }); else setTimeout(rodar, 50);
}

// ---------- v20.2: o que não é usado no começo carrega depois que o jogo abriu ----------
// queda de braço (só se a rodada chegar ao fim do tempo), cartas de arma (a partir do rival 3) e online (só pelo menu).
// Em ordem: online.js usa o rede.js. Quem precisa antes espera (telas.js: modoOnline).
const ADIADOS = ["js/jogo/arte/queda.js", "js/jogo/arte/cartas_arma.js", "js/rede/rede.js", "js/rede/online.js"];
let adiados = null;
function carregarAdiados() {
  if (!adiados) adiados = ADIADOS.reduce(function(p, src) {
    return p.then(function() { return carregarScript(src).catch(function(e) { console.warn(e); }); });
  }, Promise.resolve());
  return adiados;
}

// ---------- começo ----------
(function iniciar() {
  carregarSave();
  if (save.teclas && save.teclas[1] && save.teclas[1].pulo && save.teclas[1].pulo[0] === "KeyW" && save.teclas[1].pulo[1] === "Space") {
    save.teclas[1].pulo = ["Space", "KeyW"]; salvar();
  }
  entrada.refazerMapa();
  aplicarQualidade();
  Progresso.preparar();
  ajustarTela();
  montarTelas();
  carregarIdioma(detectarIdioma(save.idioma)).then(function() {
    // 1ª visita: cai direto no modo rivais, contra o rival 1 (sem escolher modo); depois: menu
    // (guardado antes: a 1ª partida já soma em save.partidas antes do SDK ficar pronto)
    const primeiraVisita = save.partidas === 0;
    if (primeiraVisita) comecarPartida("rivais");
    else irParaMenu("");
    requestAnimationFrame(quadro);
    // o SDK carrega em paralelo; o jogo não espera por ele para aparecer
    Poki.iniciar().then(function() {
      Poki.carregou();
      Eventos.inicioDaVisita(primeiraVisita);
      atualizarTextos();   // o botão do anúncio premiado aparece quando o SDK fica pronto
    });
    // prepara os desenhos das armas, cartas e efeitos antes de aparecerem (evita engasgo no 1º uso).
    // v20.7: antes eram 3 blocos e o das armas (60 sprites) travava ~0,2 s logo no começo da 1ª partida; agora são
    // ~65 pedaços pequenos, feitos nas folgas entre os quadros (filaAquecer)
    const aquecer = (typeof ArteArmas !== "undefined" && ArteArmas.tarefasAquecer ? ArteArmas.tarefasAquecer() : []).concat([
      function() { if (typeof ArteCartas !== "undefined" && ArteCartas.aquecer) ArteCartas.aquecer(); },
      function() { if (typeof Efeitos !== "undefined" && Efeitos.preparar) Efeitos.preparar(); }
    ]);
    // v14: espera a fonte do jogo (Nunito, ~0,1–0,3 s) para os desenhos guardados já saírem com ela (no máx. 1,5 s)
    const fonte = document.fonts && document.fonts.load ?
      Promise.race([document.fonts.load("900 20px Nunito"), new Promise(function(r) { setTimeout(r, 1500); })]).catch(function() {}) :
      Promise.resolve();
    if (typeof desenharLogo === "function") protegido(desenharLogo);   // v19: bolinhas do logo do menu
    fonte.then(function() { setTimeout(function() { filaAquecer(aquecer); }, 300); });
    setTimeout(carregarAdiados, 1500);
  });
})();
