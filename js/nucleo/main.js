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
const ctx = canvas.getContext("2d");
let alturaTela = CONFIG.altura;
let modoRetrato = false;

function ajustarTela() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const retrato = CONFIG.permitirRetrato && h > w * 1.15;
  const escala = retrato ? w / CONFIG.largura : Math.min(w / CONFIG.largura, h / CONFIG.altura);
  const alt = retrato ? Math.max(CONFIG.altura, Math.floor(h / escala)) : CONFIG.altura;
  modoRetrato = retrato;
  alturaTela = alt;
  if (canvas.width !== CONFIG.largura) canvas.width = CONFIG.largura;
  if (canvas.height !== alt) canvas.height = alt;
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
  if (!(CONFIG.leve && estado !== "jogo" && jogo && jogo.demo && quadro.par)) protegido(desenharJogo, ctx);
  if (estado === "skins") protegido(desenharPreviaSkin, agora / 1000);
  if (estado === "recompensa") protegido(desenharRecompensa, agora / 1000);
  if (estado === "diaria") protegido(desenharDiaria, agora / 1000);
  requestAnimationFrame(quadro);
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
    // prepara os desenhos das armas, cartas e efeitos antes de aparecerem (evita engasgo no 1º uso),
    // em pedaços separados para nenhum quadro travar muito (no celular cada pedaço custa mais)
    const aquecer = [
      function() { if (typeof ArteArmas !== "undefined" && ArteArmas.aquecer) ArteArmas.aquecer(); },
      function() { if (typeof ArteCartas !== "undefined" && ArteCartas.aquecer) ArteCartas.aquecer(); },
      function() { if (typeof Efeitos !== "undefined" && Efeitos.preparar) Efeitos.preparar(); }
    ];
    // v14: espera a fonte do jogo (Nunito, ~0,1–0,3 s) para os desenhos guardados já saírem com ela (no máx. 1,5 s)
    const fonte = document.fonts && document.fonts.load ?
      Promise.race([document.fonts.load("900 20px Nunito"), new Promise(function(r) { setTimeout(r, 1500); })]).catch(function() {}) :
      Promise.resolve();
    if (typeof desenharLogo === "function") protegido(desenharLogo);   // v19: bolinhas do logo do menu
    fonte.then(function() { aquecer.forEach(function(f, i) { setTimeout(function() { protegido(f); }, 300 + i * 250); }); });
  });
})();
