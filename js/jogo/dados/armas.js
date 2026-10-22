"use strict";

// =========================
// AS 60 ARMAS (v19: +10 novas com mecânicas próprias e sensação própria em cada uma)
// Unidades: velocidade em px por passo (60 passos/s), cadência e tempos em segundos,
// dano em pontos de vida (cada bolinha tem 100).
//
// tipo:
//   "bala"    projétil comum (com os extras abaixo)
//   "laser"   acerta na hora em linha reta (perfuraParede, quicaParede)
//   "feixe"   raio contínuo enquanto segura o tiro (dano por passo)
//   "raio"    choque elétrico que pula até o oponente se ele estiver perto
//   "melee"   golpe de perto (alcance em px)
//   "mina"    fica no chão e explode quando o oponente chega perto (escorrega: casca de banana, não explode)
//   "ceu"     cai do céu em cima do oponente depois de um aviso (meteoro, relâmpago)
//   "torreta" (v19) monta uma torreta no chão que atira sozinha no oponente (tiros, intervalo, alcance)
//
// extras da "bala": qtd (por tiro), espalha (radianos), grav (fração da gravidade), quica (vezes),
//   explode (raio da explosão), danoExplosao, perfura, teleguia (curva por passo), volta (bumerangue),
//   congela (s de lentidão), fogo (s queimando), empurra (força no alvo), recuo (força em quem atira),
//   vida (passos até sumir), raio (tamanho do projétil), timer (passos até explodir sozinho),
//   fragmentos (quantos estilhaços na explosão), puxa (gancho), atrai (buraco negro), arrasto (freio no ar)
// v19: ricocheteia (quica também nas paredes da arena e fica mais forte: cresce = +dano por quique),
//   gruda (s grudado no chão: sem pulo e lento), grudaNele (a bomba gruda em quem acerta), levanta (joga para cima),
//   infla (s inflado: maior e flutuando), bolha (s preso numa bolha subindo), rola (rola no chão),
//   vampiro (fração do dano que volta como vida), ima (raio do ímã: puxa tiros do oponente e curva no alvo),
//   desvia (sopra para longe os tiros do oponente)
//
// SENSAÇÃO (v19, cada arma tem a sua): som (nome em sistemas/audio.js), tremor (tela tremendo no tiro de quem joga),
//   recuoVis (quanto a arma dá o tranco na mão), capsula ("bala" | "cartucho" | "grande" | "energia"), fumaca (puffs na boca)
// visual: como o projétil é desenhado (ArteArmas.desenharProjetil)
// raridade: 1 comum, 2 rara, 3 lendária (as raras aparecem menos nas caixas; o estilingue é 0)
// =========================

const ARMAS = [
  // ---- a de começo (munição infinita) ----
  { id: "estilingue", tipo: "bala", raridade: 0, municao: Infinity, cadencia: 0.32, dano: 7, vel: 13, grav: 0.15, raio: 5, visual: "pedra",
    som: "s_estilingue", tremor: 0, recuoVis: 0.5 },

  // ---- tiro ----
  { id: "pistola", tipo: "bala", raridade: 1, municao: 14, cadencia: 0.26, dano: 10, vel: 17, raio: 4, visual: "bala",
    som: "s_pistola", tremor: 1.2, recuoVis: 0.8, capsula: "bala" },
  { id: "revolver", tipo: "bala", raridade: 1, municao: 6, cadencia: 0.6, dano: 22, vel: 20, raio: 5, empurra: 6, recuo: 2, visual: "bala_grande",
    som: "s_revolver", tremor: 3.5, recuoVis: 1.4, fumaca: 1 },
  { id: "submetralhadora", tipo: "bala", raridade: 1, municao: 45, cadencia: 0.08, dano: 5, vel: 17, espalha: 0.08, raio: 3, visual: "bala",
    som: "s_smg", tremor: 0.8, recuoVis: 0.55, capsula: "bala" },
  { id: "minigun", tipo: "bala", raridade: 3, municao: 90, cadencia: 0.05, dano: 4, vel: 18, espalha: 0.12, raio: 3, recuo: 0.35, visual: "bala",
    som: "s_minigun", tremor: 1.6, recuoVis: 0.45, capsula: "bala", fumaca: 0.25 },
  { id: "escopeta", tipo: "bala", raridade: 1, municao: 6, cadencia: 0.8, dano: 6, qtd: 7, espalha: 0.35, vel: 15, vida: 30, raio: 3, empurra: 3, recuo: 4, visual: "chumbo",
    som: "s_escopeta", tremor: 5, recuoVis: 1.6, capsula: "cartucho", fumaca: 2 },
  { id: "escopeta_dupla", tipo: "bala", raridade: 2, municao: 4, cadencia: 1.1, dano: 6, qtd: 12, espalha: 0.5, vel: 15, vida: 28, raio: 3, empurra: 4, recuo: 7, visual: "chumbo",
    som: "s_escopeta2", tremor: 7, recuoVis: 2, capsula: "cartucho", fumaca: 3 },
  { id: "rifle", tipo: "bala", raridade: 1, municao: 20, cadencia: 0.18, dano: 13, vel: 24, raio: 4, visual: "bala",
    som: "s_rifle", tremor: 1.6, recuoVis: 0.9, capsula: "bala" },
  { id: "sniper", tipo: "bala", raridade: 2, municao: 4, cadencia: 1.3, dano: 45, vel: 40, raio: 4, empurra: 8, recuo: 4, visual: "bala_rastro",
    som: "s_sniper", tremor: 6, recuoVis: 1.8, capsula: "grande", fumaca: 2 },
  { id: "plasma", tipo: "bala", raridade: 1, municao: 12, cadencia: 0.3, dano: 14, vel: 15, raio: 9, explode: 30, visual: "plasma",
    som: "s_plasma", tremor: 1.5, recuoVis: 0.9, capsula: "energia" },
  { id: "pula_pula", tipo: "bala", raridade: 1, municao: 10, cadencia: 0.45, dano: 12, vel: 14, grav: 0.6, quica: 6, raio: 8, vida: 240, visual: "bola_pula",
    som: "s_boing", tremor: 0.8, recuoVis: 0.8 },
  // v19: confete era fraco demais (3 de dano) e ninguém sentia: mais dano e empurrão de festa
  { id: "confete", tipo: "bala", raridade: 1, municao: 10, cadencia: 0.5, dano: 4.5, qtd: 8, espalha: 0.6, vel: 13, vida: 34, raio: 4, empurra: 1.6, visual: "confete",
    som: "s_confete", tremor: 2, recuoVis: 1.1 },
  { id: "arma_agua", tipo: "bala", raridade: 1, municao: 100, cadencia: 0.04, dano: 2.2, vel: 15, grav: 0.3, raio: 4, empurra: 3.2, vida: 50, visual: "agua",
    som: "s_agua", tremor: 0, recuoVis: 0.25 },
  { id: "zarabatana", tipo: "bala", raridade: 1, municao: 10, cadencia: 0.45, dano: 8, vel: 22, raio: 3, congela: 0.7, visual: "dardo",
    som: "s_dardo", tremor: 0.4, recuoVis: 0.5 },
  { id: "onda_sonora", tipo: "bala", raridade: 2, municao: 6, cadencia: 0.8, dano: 15, vel: 9, raio: 24, perfura: true, atravessa: true, empurra: 12, vida: 120, visual: "onda",
    som: "s_sonar", tremor: 3, recuoVis: 1.2 },

  // ---- arremesso e flechas ----
  { id: "shuriken", tipo: "bala", raridade: 1, municao: 10, cadencia: 0.4, dano: 9, qtd: 3, espalha: 0.25, vel: 18, raio: 6, visual: "shuriken",
    som: "s_arremesso", tremor: 0.4, recuoVis: 0.6 },
  { id: "bumerangue", tipo: "bala", raridade: 1, municao: 6, cadencia: 0.6, dano: 18, vel: 14, raio: 10, perfura: true, volta: true, vida: 110, visual: "bumerangue",
    som: "s_arremesso", tremor: 0.5, recuoVis: 0.7 },
  { id: "arco", tipo: "bala", raridade: 1, municao: 8, cadencia: 0.7, dano: 28, vel: 20, grav: 0.35, raio: 4, visual: "flecha",
    som: "s_arco", tremor: 1, recuoVis: 0.6 },
  { id: "arco_triplo", tipo: "bala", raridade: 2, municao: 6, cadencia: 0.8, dano: 18, qtd: 3, espalha: 0.15, vel: 20, grav: 0.3, raio: 4, visual: "flecha",
    som: "s_arco", tremor: 1.5, recuoVis: 0.7 },
  { id: "besta", tipo: "bala", raridade: 2, municao: 5, cadencia: 0.9, dano: 34, vel: 26, grav: 0.15, raio: 4, perfura: true, visual: "virote",
    som: "s_besta", tremor: 2.5, recuoVis: 1.1 },
  { id: "serra", tipo: "bala", raridade: 2, municao: 4, cadencia: 0.7, dano: 14, vel: 12, raio: 14, quica: 4, perfura: true, vida: 200, visual: "serra",
    som: "s_serra", tremor: 1.5, recuoVis: 0.9 },
  { id: "bola_neve", tipo: "bala", raridade: 1, municao: 10, cadencia: 0.4, dano: 10, vel: 15, grav: 0.5, raio: 8, congela: 0.5, visual: "bola_neve",
    som: "s_arremesso", tremor: 0.4, recuoVis: 0.6 },
  { id: "gancho", tipo: "bala", raridade: 2, municao: 5, cadencia: 0.9, dano: 10, vel: 20, raio: 6, puxa: 16, vida: 45, visual: "gancho",
    som: "s_gancho", tremor: 1.5, recuoVis: 1 },

  // ---- explosivos ----
  { id: "bazuca", tipo: "bala", raridade: 2, municao: 4, cadencia: 1.2, dano: 30, vel: 11, raio: 8, explode: 85, recuo: 5, visual: "foguete",
    som: "s_bazuca", tremor: 6, recuoVis: 1.8, fumaca: 3 },
  { id: "lanca_granadas", tipo: "bala", raridade: 1, municao: 6, cadencia: 0.9, dano: 25, vel: 13, grav: 1, quica: 3, explode: 70, timer: 80, raio: 7, visual: "granada",
    som: "s_lanca", tremor: 3, recuoVis: 1.3, capsula: "grande", fumaca: 1 },
  { id: "granada", tipo: "bala", raridade: 1, municao: 3, cadencia: 0.7, dano: 35, vel: 11, grav: 1, quica: 5, explode: 95, timer: 95, raio: 8, visual: "granada",
    som: "s_arremesso", tremor: 0.5, recuoVis: 0.8 },
  { id: "dinamite", tipo: "bala", raridade: 2, municao: 2, cadencia: 0.9, dano: 45, vel: 10, grav: 1, quica: 4, explode: 130, timer: 120, raio: 8, visual: "dinamite",
    som: "s_arremesso", tremor: 0.5, recuoVis: 0.8 },
  { id: "fragmentacao", tipo: "bala", raridade: 2, municao: 3, cadencia: 0.9, dano: 20, vel: 11, grav: 1, quica: 4, explode: 60, timer: 85, fragmentos: 8, raio: 8, visual: "granada_frag",
    som: "s_arremesso", tremor: 0.5, recuoVis: 0.8 },
  { id: "canhao", tipo: "bala", raridade: 2, municao: 3, cadencia: 1.4, dano: 40, vel: 14, grav: 0.45, raio: 14, explode: 60, empurra: 14, recuo: 8, visual: "bala_canhao",
    som: "s_canhao", tremor: 8, recuoVis: 2.2, fumaca: 4 },
  { id: "mini_misseis", tipo: "bala", raridade: 2, municao: 16, cadencia: 0.15, dano: 9, vel: 13, espalha: 0.15, raio: 5, explode: 34, visual: "mini_missil",
    som: "s_missil", tremor: 1.5, recuoVis: 0.7, fumaca: 0.5 },
  { id: "missil", tipo: "bala", raridade: 2, municao: 4, cadencia: 1.1, dano: 26, vel: 8, raio: 8, explode: 60, teleguia: 0.07, vida: 260, visual: "missil",
    som: "s_missil", tremor: 3, recuoVis: 1.3, fumaca: 2 },
  { id: "abelhas", tipo: "bala", raridade: 2, municao: 4, cadencia: 1, dano: 5, qtd: 5, espalha: 0.9, vel: 7, raio: 5, teleguia: 0.1, vida: 160, visual: "abelha",
    som: "s_zumbido", tremor: 0.8, recuoVis: 0.7 },
  { id: "bola_fogo", tipo: "bala", raridade: 1, municao: 6, cadencia: 0.7, dano: 18, vel: 12, raio: 11, explode: 40, fogo: 3, visual: "bola_fogo",
    som: "s_fogo", tremor: 1.5, recuoVis: 0.9 },
  { id: "granada_gelo", tipo: "bala", raridade: 1, municao: 3, cadencia: 0.8, dano: 12, vel: 11, grav: 1, quica: 3, explode: 90, congela: 1.6, timer: 85, raio: 8, visual: "granada_gelo",
    som: "s_arremesso", tremor: 0.5, recuoVis: 0.8 },
  { id: "mina", tipo: "mina", raridade: 1, municao: 3, cadencia: 0.6, dano: 40, explode: 80, raio: 10, visual: "mina",
    som: "clique", tremor: 0, recuoVis: 0.3 },

  // ---- energia ----
  { id: "laser", tipo: "laser", raridade: 1, municao: 10, cadencia: 0.5, dano: 18, visual: "laser",
    som: "laser", tremor: 1.5, recuoVis: 0.8, capsula: "energia" },
  { id: "railgun", tipo: "laser", raridade: 3, municao: 3, cadencia: 1.6, dano: 50, perfuraParede: true, carga: 0.35, empurra: 10, visual: "railgun",
    som: "s_railgun", tremor: 7, recuoVis: 2, capsula: "energia", fumaca: 2 },
  { id: "arco_iris", tipo: "laser", raridade: 3, municao: 6, cadencia: 0.7, dano: 26, quicaParede: 3, visual: "arco_iris",
    som: "s_arcoiris", tremor: 2.5, recuoVis: 1 },
  { id: "feixe", tipo: "feixe", raridade: 2, municao: 180, cadencia: 0, dano: 1.3, alcance: 520, visual: "feixe",
    som: "feixe", tremor: 0, recuoVis: 0 },
  { id: "tesla", tipo: "raio", raridade: 2, municao: 10, cadencia: 0.45, dano: 14, alcance: 380, visual: "raio",
    som: "choque", tremor: 1.5, recuoVis: 0.7 },
  { id: "raio_gelo", tipo: "bala", raridade: 1, municao: 10, cadencia: 0.4, dano: 8, vel: 16, raio: 6, congela: 1.2, visual: "gelo",
    som: "s_gelo", tremor: 0.6, recuoVis: 0.6 },
  // v19: as bolhas prendem (o alvo sobe preso numa bolha e leva dano quando ela estoura) — antes só deixavam lento
  { id: "bolhas", tipo: "bala", raridade: 1, municao: 12, cadencia: 0.35, dano: 4, vel: 6, grav: -0.05, raio: 14, bolha: 1.0, vida: 200, visual: "bolha",
    som: "s_bolha", tremor: 0, recuoVis: 0.5 },
  // v19: o buraco negro implode no fim (antes só puxava e tirava ~4 de vida por segundo)
  { id: "buraco_negro", tipo: "bala", raridade: 3, municao: 2, cadencia: 1.5, dano: 2.5, vel: 4, raio: 18, atrai: 0.55, perfura: true, atravessa: true, vida: 200,
    explode: 80, danoExplosao: 22, visual: "buraco_negro",
    som: "s_buraco", tremor: 3, recuoVis: 1.4 },

  // ---- fogo e vento (muitas partículas curtas) ----
  { id: "lanca_chamas", tipo: "bala", raridade: 3, municao: 120, cadencia: 0.035, dano: 1.6, vel: 9, espalha: 0.25, vida: 26, raio: 10, perfura: true, fogo: 2, arrasto: 0.96, visual: "chama",
    som: "s_chamas", tremor: 0.6, recuoVis: 0.3 },
  // v19: o soprador quase não tirava vida (0,2) e era chato: empurra mais e sopra para longe os tiros do oponente
  { id: "soprador", tipo: "bala", raridade: 1, municao: 150, cadencia: 0.035, dano: 0.35, vel: 11, espalha: 0.3, vida: 30, raio: 12, perfura: true, atravessa: true, empurra: 3, arrasto: 0.95, desvia: true, visual: "vento",
    som: "sopro", tremor: 0.3, recuoVis: 0.25 },

  // ---- corpo a corpo ----
  { id: "martelo", tipo: "melee", raridade: 1, municao: 12, cadencia: 0.55, dano: 30, alcance: 75, empurra: 18, visual: "martelo",
    som: "s_martelo", tremor: 4, recuoVis: 0 },
  { id: "espada", tipo: "melee", raridade: 1, municao: 16, cadencia: 0.35, dano: 22, alcance: 82, empurra: 9, visual: "espada",
    som: "s_espada", tremor: 2, recuoVis: 0 },
  { id: "luva_boxe", tipo: "melee", raridade: 1, municao: 12, cadencia: 0.5, dano: 15, alcance: 70, empurra: 26, visual: "luva",
    som: "s_luva", tremor: 3, recuoVis: 0 },

  // ---- do céu ----
  { id: "meteoro", tipo: "ceu", raridade: 3, municao: 2, cadencia: 2, dano: 28, explode: 75, qtd: 3, aviso: 0.9, visual: "meteoro",
    som: "alarme", tremor: 1, recuoVis: 0.6 },
  { id: "relampago", tipo: "ceu", raridade: 2, municao: 3, cadencia: 1.2, dano: 30, explode: 40, qtd: 1, aviso: 0.55, visual: "relampago",
    som: "alarme", tremor: 1, recuoVis: 0.6 },

  // ---- v19: as novas ----
  // disco que ricocheteia nas paredes e plataformas e fica mais forte a cada quique (tiro de tabela)
  { id: "disco", tipo: "bala", raridade: 1, municao: 8, cadencia: 0.45, dano: 9, vel: 15, raio: 8, quica: 5, ricocheteia: true, cresce: 0.35, vida: 200, empurra: 3, visual: "disco",
    som: "s_disco", tremor: 1, recuoVis: 0.8 },
  // gosma verde: espirra no chão e gruda quem estiver perto (sem pulo e lento por 1,6 s)
  { id: "gosma", tipo: "bala", raridade: 1, municao: 8, cadencia: 0.6, dano: 9, vel: 13, grav: 0.5, raio: 9, explode: 46, gruda: 1.6, visual: "gosma",
    som: "s_gosma", tremor: 1, recuoVis: 0.9 },
  // bola de boliche: cai e ROLA pelo chão; derruba quem estiver no caminho
  { id: "boliche", tipo: "bala", raridade: 1, municao: 4, cadencia: 0.9, dano: 22, vel: 9, grav: 1, raio: 13, rola: true, perfura: true, empurra: 15, vida: 240, visual: "boliche",
    som: "s_boliche", tremor: 2.5, recuoVis: 1.2 },
  // casca de banana: arma no chão; quem pisa escorrega sem controle
  { id: "banana", tipo: "mina", raridade: 1, municao: 4, cadencia: 0.5, dano: 10, raio: 9, escorrega: 1.0, visual: "banana",
    som: "s_arremesso", tremor: 0, recuoVis: 0.6 },
  // ímã: bola lenta que puxa e engole os tiros do oponente e curva no alvo quando passa perto
  { id: "ima", tipo: "bala", raridade: 2, municao: 5, cadencia: 0.8, dano: 16, vel: 8, raio: 11, ima: 230, vida: 170, empurra: 4, visual: "ima",
    som: "s_ima", tremor: 1.5, recuoVis: 1 },
  // bomba grudenta: gruda em quem acerta (ou na parede) e explode logo depois
  { id: "bomba_grude", tipo: "bala", raridade: 2, municao: 3, cadencia: 0.9, dano: 34, vel: 12, grav: 0.8, raio: 9, explode: 80, timer: 100, grudaNele: true, visual: "bomba_grude",
    som: "s_arremesso", tremor: 0.6, recuoVis: 0.8 },
  // inflador: dardo de ar que deixa o oponente inflado (maior e flutuando) por 3,5 s
  { id: "inflador", tipo: "bala", raridade: 2, municao: 8, cadencia: 0.5, dano: 7, vel: 18, raio: 5, infla: 3.5, visual: "dardo_ar",
    som: "s_inflador", tremor: 0.8, recuoVis: 0.8 },
  // morcegos vampiros: curvam um pouco no alvo e devolvem 60% do dano como vida
  { id: "vampiro", tipo: "bala", raridade: 2, municao: 10, cadencia: 0.45, dano: 8, vel: 13, raio: 7, teleguia: 0.035, vida: 130, vampiro: 0.6, visual: "morcego",
    som: "s_vampiro", tremor: 0.8, recuoVis: 0.7 },
  // tornado: anda devagar, puxa para dentro e joga o oponente para o alto
  { id: "tornado", tipo: "bala", raridade: 3, municao: 3, cadencia: 1.2, dano: 10, vel: 4.5, raio: 26, perfura: true, atravessa: true, levanta: 12, vida: 200, empurra: 2, visual: "tornado",
    som: "s_tornado", tremor: 3, recuoVis: 1.2 },
  // torreta: monta no chão e atira sozinha (8 tiros) no oponente
  { id: "torreta", tipo: "torreta", raridade: 3, municao: 2, cadencia: 1.2, dano: 7, tiros: 8, intervalo: 0.5, alcance: 760, raio: 14, visual: "torreta",
    som: "s_torreta", tremor: 1, recuoVis: 0.6 }
];

const ARMA = {};
ARMAS.forEach(function(a) { ARMA[a.id] = a; });
// o tiro que a torreta dispara
const TIRO_TORRETA = { id: "tiro_torreta", tipo: "bala", raridade: 0, dano: 7, vel: 16, raio: 4, visual: "bala", empurra: 1.5 };
