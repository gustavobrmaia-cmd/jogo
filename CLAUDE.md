# Estrutura obrigatória (vale para todo jogo novo deste repositório)

Combinado com o dono do jogo. Qualquer versão nova TEM que manter isto:

## 1. Idiomas: 12
- pt + en + os 10 mais fortes no Poki: es, fr, de, it, nl, pl, tr, ru, ro, id.
- Um arquivo por idioma em `js/idiomas/textos/xx.js` (`TEXTOS.xx = { chave: "texto" }`). Só baixa o escolhido + inglês (reserva).
- Ordem: escolha salva > idioma do navegador > inglês. Troca na hora, sem recarregar.
- Nunca escrever texto direto no código: `t("chave", valores)` no JS e `data-t="chave"` no HTML.
- Texto novo = adicionar a chave nos 12 arquivos.

## 2. Game Events (o que o jogador faz)
- Sempre pelos atalhos de `js/eventos.js`, nunca `PokiSDK.measure` direto:
  - `Eventos.nivel(id, "start" | "complete" | "fail")`: tabela de progresso e funil (Started, Completed, Failed, Left).
  - `Eventos.oferta(nome, "visible" | "interact")`: anúncio premiado oferecido e aceito.
  - `Eventos.botao(nome)` e `Eventos.marco(nome)`: cliques importantes e momentos-chave.
- Automáticos, não remover:
  - playtime (30s, 1m, 2m, 3m, 5m, 10m, 15m, 20m, 30m de gameplay real);
  - idioma, desktop/mobile, em pé/deitado, primeira visita/voltou;
  - primeira interação;
  - erros de JS (máx. 5 por visita).
- Nomes sem "/" nem "^". Eventos de antes do SDK ficam numa fila e não se perdem.

## 3. SDK do Poki (`js/poki.js`), com tudo que aprendemos
- Script do SDK no `<head>`. Ordem: `init()` e depois `gameLoadingFinished()`.
- `gameplayStart`: só depois da 1ª interação. `gameplayStop`: em pausa, menu, fim, anúncio e aba escondida.
- `commercialBreak` (`Poki.intervalo()`) antes de TODA volta ao jogo: começar, próxima fase, recomeçar.
  - O Poki decide se mostra. Sem timer, sorteio ou limite nosso.
  - Exceção: a primeira partida de quem acabou de chegar (e, entre as rodadas, as 2 primeiras partidas).
- `rewardedBreak` (`Poki.premiado(tamanho)`) só quando o jogador escolhe. Nunca soltar comercial comum logo depois de um premiado.
- Durante anúncio: jogo parado e mudo.
- Rede de segurança: o anúncio tem que começar em 4 s (comercial) ou 8 s (premiado), com limite de 60 s.
- Com bloqueador ou sem SDK, o jogo funciona igual, só sem anúncios.

## 4. Leve e otimizado
- JS puro, sem biblioteca, sem build.
- Som sintetizado (WebAudio), sem arquivos de áudio.
- Arte desenhada no canvas ou pixel art pequena.
- Fonte única embutida (v14): Nunito variável em `fonte/` (latin 39 KB; latin-ext e cirílico só baixam se a língua usar),
  licença OFL em `fonte/OFL.txt`. Canvas e HTML usam "Nunito, system-ui". O main.js espera a fonte (máx. 1,5 s) antes de
  preparar os desenhos guardados.
- Loop de passo fixo (1/60 s). Resolução lógica 1280x720 escalada.
- Celular em pé suportado (tela mais alta, sem pedir para girar). Contra o bot, em pé, a arena tem CÂMERA (desenho.js:
  `layoutTela`, `atualizarCamera`, `mundoParaTela`/`telaParaMundo`): zoom 1,15–1,8 seguindo as duas bolinhas, chão fixo
  em H-760, HUD em cima (y 150), pulo embaixo à direita logo acima do analógico de mira (toque na metade direita acima de
  H-470 = pulo) e seta na beirada para quem sai da tela. Tablet/tela pouco alta: sem câmera (layout antigo).
- Modo leve (`CONFIG.leve`; Opções > Gráficos: automático/altos/leves, `save.qualidade`): automático em aparelho de toque
  ou com pouca memória/poucos núcleos. Menos partículas (300) e a luta do fundo dos menus desenhada a 30 qps.
- Sprites de armas, cartas e efeitos são preparados logo no começo, em pedaços (evita engasgo no 1º uso).
- Teclado, toque e controle viram as mesmas ações (`js/entrada.js`).
- Save em localStorage dentro de try/catch.
- Meta: abrir em ~1 s.

## Pastas (manter organizado: cada arquivo na pasta do que ele faz)
```
index.html, estilo.css, fonte/ (Nunito em woff2 + OFL.txt)
js/
  nucleo/     config.js (ajustes), util.js (ferramentas), save.js (localStorage), main.js (tela e loop; carrega por último)
  poki/       poki.js (SDK e anúncios), eventos.js (Game Events)
  rede/       netlib.js (Poki Networking Library, v19), rede.js (conexão e salas), online.js (partida online)
  idiomas/    idiomas.js (t(), detecção, troca)  +  textos/xx.js (15 idiomas; v20.7: + vi, uk, ja — texto novo vai em TODOS)
  sistemas/   audio.js (som sintetizado), entrada.js (teclado, toque, controle; 2 jogadores)
  interface/  telas.js (menu, escolha do modo, pausa, continuar; anúncios), menus.js, recompensa.js (fim da partida),
              poder.js (painel das melhorias: tela de fim e tela Melhorar)
  jogo/
    dados/    armas.js (50 armas), cenarios.js (15 cenários), cartas.js (12 cartas + cores), skins.js (corpos e acessórios)
    progresso/ dados.js (missões, desafios, conquistas), progresso.js (moedas, contadores, prêmios),
              poder.js (melhorias Força/Vida/Velocidade e o poder dos rivais)
    motor/    fisica.js, combate.js (tiros, explosões, itens), bot.js (IA), partida.js (rodadas, queda de braço)
    arte/     efeitos.js, skins.js, bolinhas.js, armas.js, cartas.js, cenarios.js, queda.js, bau.js (só desenho, canvas)
    desenho.js (junta a arte na ordem certa + HUD)
```
Ordem dos scripts no index.html: nucleo/config, nucleo/util, idiomas/idiomas, nucleo/save, poki/poki, poki/eventos,
sistemas/audio, sistemas/entrada, jogo/dados/*, jogo/arte/*, jogo/motor/* (fisica, combate, bot, partida),
jogo/progresso/* (dados, progresso, poder), jogo/desenho, interface/* (telas, menus, recompensa, poder), nucleo/main.
Arquivo novo: colocar na pasta certa. Arte nunca mexe em regra de jogo; motor nunca desenha.

## O jogo atual: Crazy Balls Duel
- Duas bolinhas. Contra o bot o jogador é sempre rosa (CORES_BOLINHAS[0], a mesma da prévia no menu) e o bot ganha uma cor
  de tom bem diferente (`coresDiferentes`: matiz >= 75°). Antes as duas eram sorteadas e 21% das partidas ficavam parecidas. Modos: contra o bot, 2 jogadores no mesmo aparelho, e a demo (bot x bot no fundo dos menus).
- Partida até 3 pontos desde a v14 (`CONFIG.pontosParaVencer`; era 5 e o dono achou que demorava muito: na simulação a
  partida caiu ~40%, rival 1 de ~2 min para ~1 min). Como há menos rodadas para o bot se ajustar dentro da partida, cada
  rodada perdida enfraquece o bot em 0,15 (era 0,1). Conquista/desafio "5 – 0" agora é 3 – 0 e a "virada" é de 0 – 2. Rodada de 45 s num cenário diferente; últimos 10 s com dano em dobro.
  Se ninguém morrer: queda de braço (quem clicar mais vence; quem tem mais vida começa na frente).
- Os dois começam a rodada com a mesma arma sorteada; caixas de arma caem (1ª aos 1,5 s, depois a cada ~4 s);
  cartas de habilidade aparecem (1ª aos ~4 s).
- 1ª visita: cai direto no modo Rivais, contra o rival 1 (sem tela de modo). "2 jogadores" tem o selo "mesmo aparelho · não é
  online" (no playtest acharam que era online) e, no celular, fica por último e menor.
- Plataformas finas (`fina: true`) deixam o tiro passar; nas grossas a linha da mira para e mostra um X vermelho,
  e o tiro que bate na parede faz som (só para o humano). Muitos mapas usam plataformas finas no meio.
- Mira assistida igual para jogador e bot. Sem sangue (acerto = faíscas; derrota = estouro em confete).
- Bot: simula a física para frente e escolhe o melhor movimento; só atira quando a simulação diz que acerta.
  O nível (save.nivelBot, começa em 0,02 = "nível 1") muda depois de cada partida pelo desempenho do jogador e, um pouco,
  a cada rodada (perdeu a rodada: bot -0,07; ganhou: +0,03). Bot fraco: bate mais fraco (M.multBot 0,7 no nível mais baixo),
  erra de propósito os primeiros tiros de cada rodada (tiros de aviso, como em BioShock) e não "caça" o jogador.
  Playtest v6: 70% perdiam a 1ª rodada e 76% saíam no meio da 1ª partida — o começo tem que ser vencível.
- Bot "aprendiz" (nível < 0,35): quase não desvia, erra mais, espera entre os tiros, bate 45% do dano no nível 0,
  4 tiros de aviso por rodada. Perdeu a rodada: bot -0,1 na hora. Nas 3 primeiras partidas o nível sobe no máximo
  +0,05 por partida (depois +0,12), e Dojo/Castelo/Cidade/Lua ficam por último na ordem dos mapas.
  Calibrado com scratchpad/sim/humanosim.js (jogador humano simulado: mira com erro, segura o tiro, não desvia),
  que reproduz o Poki v8 (humano vencia ~31% da 1ª rodada; Dojo 19%). Meta: ~70% de vitórias nas 1ªs rodadas.
- Poki v8 (500 jogadas, desktop): média 3m39 inflada por uma sessão de ~15 h; real ~1m51; Engaged players 16%.
- Poki v9 (500 jogadas, PC+celular: 73% celular, 45% das sessões em pé): média 2m03, Engaged 18%. 77% não terminavam a
  1ª partida (40% saíam NO MEIO da 1ª rodada); quem chegava na 2ª partida ficava (~90% terminavam cada rodada).
- v10 = 1ª partida da vida "treino" (`jogo.treino`): campo + mapas simples (fábrica, fliperama, templo, floresta), bot
  "agressivo" (vem lutar), tiro do jogador x`CONFIG.multTreino` (1,8), vida do jogador não passa de 8 (`M.vidaMinima`),
  rodada 1 só rifle com munição infinita, caixas entram na rodada 2 e cartas na 3 com "NOVO!" em cima. Simulação:
  1ª partida ~45 s (3x0, luta de ~12 s). 2ª partida: tiro x`CONFIG.multSegunda` (1,25), luta ~22 s, jogador vence 65–80%.
  Nas 3 primeiras partidas só personalidades agressivo/saltitante e espaço/oceano/vulcão vão para o fim junto dos difíceis.
- Tutorial desenhado (sem texto) na 1ª partida: atirar -> andar -> pular, uma ação por vez, some quando a pessoa faz
  (partida.js `passoTutorial`, desenho.js `desenharTutorial`): mouse+mira e teclas no PC, mão em cima dos controles no
  toque. Perdeu a rodada sem acertar nada: a dica de atirar volta. Texto de controles só no modo 2 jogadores.
- Estado do bot que usa o relógio da rodada (M.t) é zerado a cada rodada nova (pensarBot); antes o bot ficava
  sem atirar no começo das rodadas seguintes.
- Bot avisa tiro pesado (bazuca, laser, sniper): balão "!" + linha vermelha tracejada por 0,2–0,55 s antes de atirar
  (só contra humano). Balões de reação: "!" no começo, "?!" quando apanha forte, "!!" com pouca vida, "♪" quando vence;
  gota de suor com pouca vida.
- Sensação de acerto (só para quem joga): micro-pausa no impacto (M.pausa, quadros), marcador de acerto na mira,
  COMBO xN (acertos em menos de 1,3 s) com som subindo de tom, tela vermelha ao levar dano e com pouca vida,
  K.O.! (e PERFEITO!) com câmera lenta e zoom, moedas voando do bot até o placar. b.humano marca quem é pessoa.
- Ajuda de mira para armas de arco (estilingue, granada...): se a pessoa mira entre a linha reta e a curva certa,
  o tiro sai na curva certa (o bot calcula a parábola; gente mira reto).
- Duração: luta de ~20 s por rodada bot x bot (CONFIG.multDano 0,85). Medir com a simulação ao mexer em dano.
- Game Events de diagnóstico nas 2 primeiras partidas: round/m1-r1... (start/complete/fail) e
  player/r1-tiros-* e r1-acertos-* (o jogador atira? acerta?).
- Anúncio comum: antes de cada partida a partir da 3ª (nunca antes da 1ª e da 2ª, nem logo depois de um premiado; o Poki
  decide se mostra). Desde a v16 NÃO pede entre as rodadas (rodadas de ~25 s: cortar a luta espanta); só na
  sobrevivência, entre as ondas (a única pausa de lá). Premiados (opcionais): "Partida Lendária"
  (só armas raras para os dois), "Continuar" (perdeu para o bot: o bot perde o último ponto) e "Dobrar moedas" (menu).
- Plataformas: andares a cada <= 120 px (o pulo normal alcança ~143 px). Conferir com a simulação de alcance ao mudar mapa.
- Controles (PC): ESPAÇO pula (W também), mouse mira o tempo todo, CLIQUE ESQUERDO atira (F também); teclas trocáveis
  (save.teclas) e todos os textos mostram as teclas escolhidas. Toque: esquerda = analógico de andar; direita em cima = PULO,
  direita embaixo = analógico de mira/tiro. Controle: analógico direito mira. Bot também mira livre.
- Bot: decide atirar pela mira ideal (sem o ruído), tem "paciência" (3 s sem dano → fica impaciente: procura um ponto com
  linha de visão até o jogador, chega mais perto e atira mais), quase não pula à toa quando está parado.
- Bot: 5 personalidades sorteadas por partida (agressivo, atirador, saltitante, cauteloso, colecionador), aparece no HUD.
- gameplayStop no fim de cada rodada e gameplayStart quando a próxima começa (além de pausa, menus e anúncios).
- Progresso (js/jogo/progresso): moedas, 3 missões, 4 desafios da semana (skin exclusiva), 27 conquistas, 30 skins,
  XP/nível do jogador, baús (normal no fim da partida, de nível ao subir, lendário no 7º dia) e recompensa diária (7 dias).
- Fim da partida: tela de recompensa (interface/recompensa.js): XP, baú que abre sozinho, "▶ abrir outro baú" (premiado) e,
  contra o bot, "▶ PRÓXIMO RIVAL" com contagem de 4 s que começa a próxima partida sozinha (outro botão cancela).
  O baú da 1ª partida sempre dá um acessório, que já vem equipado (`Progresso.abrirBau(tipo, garantir)`).
- MODO RIVAIS (v11, `js/jogo/dados/rivais.js`): escada de 10 rivais (Bob, Zippy, Kiki, Rocky, Nova, Taz, Ivy, Frost,
  Shadow, King), cada um com cor, corpo, acessório, personalidade e mapa de casa (1ª rodada). Por dentro é uma partida
  "bot" com `jogo.rival`. Venceu -> próximo (+moedas `premioRival`; o 5º dá baú de nível, o 10º baú lendário); perdeu ->
  revanche, rival 0,07 mais fraco a cada derrota (`save.rivalAjuste`, até -0,3). Depois do 10º: CAMPEÃO e a escada
  recomeça na liga seguinte (Bronze, Prata, Ouro, Diamante, Mestre, Mestre 2...; +0,12 de nível por liga).
  Força: `nivelRival` (rival 1 = 0,02 ... rival 10 = 0,6). A 1ª visita cai direto aqui (rival 1 = partida treino).
  O "Contra o bot" normal continua no menu (nível adaptativo save.nivelBot). Tela de fim: fileira dos 10 rivais
  (vencidos com ✓, próximo pulsando, os que faltam com "?"), "Próximo: X · 🏆 moedas" e PRÓXIMO RIVAL / REVANCHE com
  contagem. Eventos: rival/r1..r10 (ligas seguintes: rival/l2-r1...) start/complete/fail; match/rivals; champion-N.
- v12: vencer um rival dá o ACESSÓRIO dele (se ainda não tiver; já vem equipado) além das moedas; a abertura da
  partida e o menu mostram "Vença e ganhe: 🎁 X + moedas". Sem rival "cauteloso" na escada (rodada arrastava).
  Rivais 2 e 3 da liga Bronze com tiro x`multSegunda` (v17: x1,5 em `multRivais`). Baú abre em 0,5 s e PRÓXIMO RIVAL conta 3 s.
  Contra bot (`M.contraBot`): a 1ª queda da rodada não mata (volta ao ponto de partida com -25, "SALVO!"), a pessoa
  leva 40% do empurrão extra do mapa e os meteoros do castelo miram o bot 70% das vezes (e avisam a pessoa com 1,8 s).
  Simulação (bot 0,3): dojô 8% -> 27% de vitória do jogador, castelo 23% -> 30%, campo ~45%.
- PODER (v13, `js/jogo/progresso/poder.js` + `js/interface/poder.js`): melhorias compradas com moedas — Força (dano
  x1+0,10/nível), Vida (dano recebido ÷1+0,10/nível; a barra continua 0–100) e Velocidade (andar x1+0,03/nível, máx. 10).
  Custo 40, 50, 65, 85, 105... (x1,28). PODER = 100 + 10 por nível. Vale contra máquina (rivais, bot, sobrevivência),
  nunca no 2 jogadores. Rivais têm poder: +1 nível por degrau e +12 por liga (King da Bronze = 190, Prata começa em 220).
  Painel ao lado do baú na tela de fim (dá para comprar -> a contagem espera 5 s, 8 s na 1ª vez; comprar devolve 4 s),
  botão "⚡ Melhorar" no menu (selo "!" quando dá para comprar) e "⚡130 VS ⚡110" na abertura do rival.
  Visual dos cartões no estilo dos botões de modo (o 1º ficou "muito feio" para o dono): cartão colorido com degradê
  (Força vermelho, Vida verde, Velocidade azul) e borda grossa, ícone num círculo claro, nome em maiúsculas,
  "+10% → +20%" (agora -> próximo nível), selo "Nv N" no canto e o preço num botão amarelo que pulsa quando dá.
  Simulação (scratchpad/sim/poder.js, novato simulado): rival 5 — sem comprar 26% das rodadas (v12 50%), com 12 níveis 56%
  e 80% das partidas; King com 20 níveis 44% das rodadas (v12 22%). Quem compra sobe mais fácil que na v12; quem não
  compra trava no meio da escada (por isso o painel pulsa e espera).
  Eventos: upgrade/forca|vida|veloc (interact), power/level-N, reward/upgrade (visible/interact).
  Por quê: v10 de novo e v12 deram 2m25 e 23% (os 2m47 da v10 foram sorte); quem joga 5 min+ (~10%) soma quase metade
  do tempo e enfeite não segurou essa turma.
- v15 (dados v13/v14): na v14 só 28% de quem via as melhorias comprava (13% de todos). Então:
  rival SEM poder na Bronze (quem não compra fica igual à v12; poder só da Prata em diante, 8 níveis por liga);
  a 1ª melhoria da vida é GRÁTIS (preço verde "GRÁTIS!", frase "Escolha 1 de graça!" e mão 👆 pulando no 1º cartão);
  conquista 3 – 0 não conta a partida treino (no v14 243 pessoas ganharam de graça); a diária mede quem pega
  (reward/daily interact); sem pedir anúncio antes da 2ª partida (a passagem 1ª->2ª perdia 24–35%);
  evento engaged/3m-xx e engaged/5m-xx (xx = idioma) para saber qual público joga mais.
- v16 — FLUXO CONTÍNUO (telas.js `fluxoDireto`/`entregarSemTela`): nos testes as passagens entre partidas perdiam bem
  mais gente que as rodadas (1ª->2ª 25–35%, depois de vencer ~20%, rodada->rodada ~13%). Venceu no modo rivais e não há
  nada para decidir: os prêmios (moedas, baús, acessório do rival, nível) são entregues sem a tela de fim e o próximo
  rival começa direto, com uma faixa "+N 🪙 / ✨ ... / ⭐ nível" na abertura (`faixaPremio`, desenho.js). A tela de fim
  continua: na derrota, rival 5 e 10, campeão, na 1ª vez que as melhorias aparecem (com a grátis), sempre para quem
  comprou melhoria na última tela (save.stats.comprouUltima) e, para quem não compra, a cada 3 vitórias (stats.semTela).
  A 1ª partida (treino) vai sempre direto para o rival 2. Evento milestone/next-rival-direct.
  Liga Bronze: mapas cruéis (dojô, castelo, cidade, lua, vulcão, espaço, oceano) só como casa de rival; no v15 quem
  chegava longe perdia 86% no vulcão, 83% no espaço, 75% no dojô. "⚡ VS ⚡" na abertura só quando alguém passa de 100.
- Poki v17.5 (15 out 12:50, meio-dia): 2m26, Engaged 24% (v16 no mesmo horário 2m29–2m30/23%). A v17 mexeu no caminho,
  não no tempo: chegam ao rival 3 23% (v16 12%), ao 4 10% (6,9%); rodadas 2/3 do rival 2 com 13%/22% de derrota (v16
  32%/31%); ~100% de quem vence o rival 2 começa o 3 (melhoria grátis automática). Mas as partidas ficaram mais curtas e as
  pessoas saem ~17–20% por rodada MESMO GANHANDO (rival 2: 1,7% perdem a partida, 54% não terminam). A 1ª partida (sem
  como perder) ainda perde 47%; a tela depois do rival 3 perde 31%.
- JOGADOR DE TESTE (agente, v17.5, ~55 min de jogo real com toque/mouse; relatório em scratchpad/v18/jogador/relatorio.md):
  a saída é por TEMPO (~30–38% por minuto do 1º ao 10º), não por rodada nem dificuldade. Achados: (1) o jogador passava
  ~70% da luta no ESTILINGUE (a arma da rodada acaba em 3–5 s de tiro segurado; o bot, que só atira quando acerta, ~40%);
  (2) em pé o canvas tem 1280 px lógicos em ~400 px de tela: textos de 16–26 px viravam 4–8 px de verdade; (3) nenhuma
  decisão até o 3º minuto; (4) rivais 1–3 sem tensão; (5) na Prata os mapas cruéis voltavam (oceano 80%, dojô 63%).
- v18:
  - Munição contra a máquina: jogador x3, bot x1,5 (`CONFIG.municaoJogador`/`municaoBot`, `b.multMunicao` em equipar).
    Simulação (scratchpad/sim/estilingue.js): estilingue do jogador 70%/60%/80% -> 19%/9%/39% da luta nos rivais 2/3/5,
    bot ~40% -> 20–29%; derrotas iguais (rival 2 9->11%, rival 5 51->49%), partidas ~10% mais curtas.
  - Em pé: etiqueta "VOCÊ" x1,6; avisos de conquista/missão 40 px, UM POR VEZ (fila em Progresso.atualizarAvisos) e só
    depois que a faixa de prêmios some; faixa com o resto em 2 linhas e letra maior; PODER com mais espaço das moedas.
  - Modo rivais: "{RIVAL} VENCEU A RODADA" (chave nova rival_venceu_rodada) e "{RIVAL} venceu!" no lugar do "bot".
  - Mapas cruéis só como casa de rival em TODAS as ligas; deserto/gelo/laboratório fora só nos rivais 1–3 da Bronze.
  - Sobrevivência: anúncio a cada 3 ondas (pedia em toda onda).
  - SPRITES (2 agentes): bolinhas com volume, bochechas, olhos com brilho, dor "> <", feliz com língua; sprites 2x em pé
    (antes borravam com o zoom da câmera); listras/pintas/camuflado bem marcados (bolinhas.js, skins.js; criar o 2x de
    camuflado/galáxia/lava custa ~25 ms uma vez, na abertura). Armas com contorno, fio de luz e brilho de raridade, rifle
    redesenhado, balas com traçante, feixes com brilho, caixa com visor aceso, cartas com borda de carta colecionável,
    floresta mais clara com musgo luminoso nas plataformas, templo com plataformas douradas (armas.js, cartas.js,
    cenarios.js; `pontaDoCano` idêntica, conferida em 51 armas x 11 ângulos x 3 raios).
- v18.1 (resto do relatório do jogador de teste):
  - Jogador no estilingue contra a máquina: a próxima caixa vem em até 1,2 s e cai perto dele (`semArma`, `pontoPerto`,
    combate.js); ímã de caixa maior para a pessoa (raio +46 em vez de +24); nas 3 primeiras partidas a arma da rodada
    sorteia mais raras/lendárias ([0,55,35,10]).
  - Final apertado (`tensao`, combate.js; não vale na sobrevivência): o bot bate x1,6 quando a pessoa tem >55 de vida e
    ele <50, e x0,65 quando ela tem <25. Simulação: vida ao vencer 61 -> 54 no rival 2, derrotas iguais (10%, rival 5 50%);
    estilingue do jogador 18%/10%/28% nos rivais 2/3/5.
  - Abertura da rodada 1,3 -> 1,0 s. Em pé, zoom mínimo da câmera 1,15 -> 1,3.
  - Quem nunca abriu Missões (`save.stats.viuMissoes`) recebe missões, desafios e conquistas sem skin na hora, com aviso
    "+N 🪙" (antes esperavam num menu que o novato não conhecia).
  - "Contra o bot" e sobrevivência: mapas cruéis sempre por último (não só nas 6 primeiras partidas).
  - Ficou para depois: escolha 1 de 3 na abertura (textos novos), tela de campeão, truques na Prata, 2 jogadores em pé.
- v18.2 (o resto do relatório):
  - ESCOLHA 1 DE 3: contra rival (menos treino e Partida Lendária), na abertura VS da 1ª rodada aparecem 3 armas (comum,
    rara, lendária; sem minas/céu). Toque/clique no cartão ou teclas 1/2/3 (telas.js, `j.escolha.rects`); sem escolha em
    ~3,6 s fica a rara. Só a pessoa troca de arma (o bot fica com a sorteada). A abertura dura até 4,2 s (`j.durIntro`) e a
    faixa de prêmios espera a escolha. Eventos choice/weapon (visible) e choice/weapon-rN[-auto] (interact). Chave nova
    escolha_arma (12 idiomas).
  - Trilha dos 10 rivais na abertura VS (`trilhaRivais`). Vencer o rival e ganhar o acessório: 🎁 voa do rival para a pessoa.
  - Campeão da liga: frase grande dourada pulsando (`#telaRecompensa.campeao`) e a próxima partida é Lendária de presente.
  - Prata em diante: cada rival começa a rodada com um truque (carta com o dobro do tempo: rapidez, escudo, tiro duplo...).
  - Fim de rodada sem K.O. 2,1 -> 1,5 s.
  - 2 jogadores em pé: pulo logo acima do analógico (não mais sobre as barras de vida) e ícone 📱↻ na abertura.
- Poki v18.2 (15 out 17:17): **2m57, Engaged 29%** (faltaram 3 s). 5 min+ 58 -> 76; chegam ao rival 4 15% e ao 5 10%.
  Treinador (agente, relatório em scratchpad/v182/jogador/relatorio.md): a 1ª tela de fim perde 23–34% onde estiver
  (108 vencem o rival 3, 83 começam o 4; sem tela ~0%); o final apertado não mudou as derrotas, mas no treino deixava a
  criança no vermelho; esteira da fábrica arrastava as bolinhas na abertura; faixa cobria a luta em pé.
- v18.3:
  - Escolha de arma ÀS CEGAS: 3 cartas "?" (cada uma comum 55% / rara 35% / lendária 10%); depois de escolher todas se
    revelam. Automática (carta aleatória) em 2,4 s; abertura no máximo 3,3 s.
  - 1ª tela de melhorias só depois do rival 5 (`fluxoDireto`: sem `viuPoder` e rr.i < 4 -> direto); nas passagens dos
    rivais 3 e 4 o jogo compra sozinho +1 Força e +1 Vida se der (faixa "💥 Força +1 ❤️ Vida +1").
  - Abertura sem empurrão: o x das bolinhas fica parado na `intro` (esteiras). Em pé com câmera, a faixa de prêmios fica
    no céu logo abaixo do HUD.
  - Treino sem sufoco: `tensao` no treino = x0,25 com <40 de vida (sem x1,6); na rodada 1 o Bob só atira depois do 1º
    acerto da pessoa; a dica de tiro conta ACERTOS (3).
  - Rivais 6–10 da Bronze: a casa cruel vem na 2ª rodada; revanche -0,10 por derrota (era -0,07).
- Poki v16 (4 testes): 11 out 10:18 2m29/23%, 13 out 11:14 2m30 (manhã); 12 out 18:51 2m40, 13 out 19:59 2m39/26% (noite).
  Repetiu igual no mesmo horário (ruído menor que se achava). À noite passa no Engaged, falta ~20 s na média.
  O vazamento ficou no rival 2: rodadas 2 e 3 da 2ª partida com 31–32% de derrota (1ª partida 7–8%), só 41% venciam
  o rival 2 e, dos que venciam, só 66% começavam o rival 3 (a 1ª tela das melhorias; depois dos rivais 3 e 4 seguiam
  86% e 96%). Mapas comuns duros: deserto 41%, gelo 42%, laboratório 35% de derrota (outros 16–27%).
- v17 (dados v16):
  - Rivais 2 e 3 da Bronze mais fracos: nível 0,04 e 0,08 (eram 0,08 e 0,15) e tiro do jogador x1,5
    (`CONFIG.multRivais` [1,25; 1,5; 1,5; 1,25] para os rivais 1–4; o 4 ganhou x1,25 para a subida não virar muro).
    multSegunda (1,25) ficou só para a 2ª partida do "Contra o bot".
  - Até o rival 3 sem deserto, gelo e laboratório (sobram campo, fábrica, floresta, fliperama, templo).
    Simulação do novato (scratchpad/sim/rival2.js, que reproduziu o v16: r1 13%, r2 37%, r3 29% x real 13/32/31):
    rival 2 de 25% para 13% das rodadas perdidas (partida 106 s -> 82 s), rival 3 de 23% para 10% (80 s -> 62 s),
    rival 4 de 49% para 35%.
  - Melhoria grátis AUTOMÁTICA: venceu o rival 2 sem ter usado a grátis -> Força +1 sozinha, mostrada na faixa
    ("💥 Força +1  GRÁTIS!", faixa fica 5,5 s) e o rival 3 começa direto. A 1ª tela de fim vencendo passa a ser depois do
    rival 3 (regra das 3 vitórias), antes do rival 4, com moedas para gastar: mão 👆 no cartão de Força até a 1ª compra
    com moedas (classe comMao) e contagem de 8 s. Evento upgrade/auto-free-forca (reached).
  - BUG (vinha da v16): no fluxo direto o fim da partida rodava 2–3 vezes (o loop faz até 5 passos por quadro e,
    esperando o anúncio, a partida velha seguia em "fimPartida"): prêmios em dobro, eventos rival/... complete
    contados 2–3 vezes (os números de vitória por rival da v16 podem estar inflados) e às vezes a tela de fim abria
    por baixo. Agora `j.terminou` (partida.js terminarPartida) deixa uma vez só; o "Continuar" zera.
  - Faixa de prêmios: a parte de baixo fica acima das bolinhas (110 px deitado, 185 em pé) e os avisos de
    conquista sobem para cima dela (antes ficavam por cima da faixa).
- Poki v15 (11 out 08:24, manhã): 2m22, Engaged 22% (v14 de manhã 2m12/20%). Escada: chegam ao rival 4 8,1% e ao 5
  4,8% (v13 à noite 5,6% e 2,3%).
- HORÁRIO DO TESTE pesa ~20 s: a mesma v10 fez 2m47 às 20:46 e 2m25 às 16:56. Noite (20–22h de Brasília) = Américas
  depois da escola (muito espanhol); manhã/tarde = Europa e horário de aula nos EUA (sessões curtas). Comparar versões
  só no mesmo horário; para passar, começar o teste à noite.
- Poki v13 (21:46): 2m42, Engaged 26% (passou no Engaged). v14 (09:08, manhã): 2m12, 20%, mas subiu mais na escada
  (partida até 3: rival 2 terminado 52% x 32%).
- Evento session/first-visit corrigido na v13: até a v12 era lido depois que a 1ª partida já tinha somado em
  save.partidas, e quase tudo saía como "returning".
- Poki v12 e v10 de novo (9 out 2026, 500 jogadas cada): os dois 2m25 e 23% (reprovou). Histograma v10 x v12: começo igual,
  diferença no 5m+ (67 x 52). Um teste de 500 varia uns ±20–25 s na média só de sorte.
- Poki v11 (teste parado em ~260 jogadas, 2m13; público bem diferente: espanhol 9% x 34% na v10): começo igual à v10
  (terminam a 1ª rodada 79%, começam a 2ª partida 39%) e a passagem 1ª->2ª melhorou (~83% x ~73%).
- Poki v10 (500 jogadas, 89% celular): média 2m47, Engaged 27%. Terminavam a 1ª partida ~55% (v9 23%), começavam a
  2ª ~40% (v9 15%); passar de 3 min ≈ chegar na 3ª rodada da 2ª partida. A passagem 1ª->2ª ainda perdia ~27%.
  Mapas difíceis: o jogador perdia 85% no dojô, 76% cidade, 72% lua, 67% castelo -> agora no fim da ordem nas 6
  primeiras partidas e como casa dos rivais 8–10.
- Modos: RIVAIS, contra o bot, 2 jogadores, SOBREVIVÊNCIA (ondas de bots cada vez mais fortes; vida passa de uma onda para outra,
  +35 entre ondas; recorde em save.recordeOnda; "Continuar" premiado volta na mesma onda com vida cheia).
- VISUAL v14 ("tudo mais polido, com mais dopamina" — o dono): camada no fim do estilo.css. Botões com degradê, brilho em
  cima, borda grossa e sombra; o amarelo principal tem um reflexo passando. Itens das telas entram pulando um depois do
  outro; cartões de modo com ícone num medalhão (Rivais brilhando), abas em pílula, missões com barra listrada andando e
  brilho verde quando dá para resgatar, skins com moldura por raridade, diária com o dia de hoje pulando.
  Na luta: barra de vida com brilho, marcas a cada 25%, treme ao levar dano e moldura vermelha piscando com pouca vida;
  placar em estrelas que pulam quando o ponto entra (o letreiro do fim da rodada já mostra o placar novo); "LUTE!" entra
  grande e bate no lugar; vencer rodada/partida tem raios girando atrás e a partida tem confete; a bolinha amassa na
  direção do golpe; quem está rápido (Velocidade/Rapidez) deixa rastro; arma rara/lendária pegada tem nome maior e anel.
- VISUAL v17.5 (feito por 2 agentes em paralelo, luta e telas, depois juntado):
  - Luta (desenho.js, arte/efeitos.js):
    - HUD com retrato da bolinha num medalhão (cara muda: dor, medo, feliz; sprite em cache `retrato()`).
    - Barra de vida com degradê, pedaço creme que some e piscada branca; relógio em medalhão dourado; "Rodada N" e
      "dano em dobro" em pílulas.
    - Abertura do rival: faixa VS com os dois retratos. Letreiros de arcade (`letreiro()`: contorno, 3D, degradê,
      diminui em idioma longo). K.O. em estouro de HQ, vitória numa fita na cor de quem venceu.
    - Números de dano saltando em arco (vermelhos no jogador). Carta pega abaixo do HUD.
    - Controles de toque com ícones e mais visíveis (opacidade 0,28 -> 0,62). Mesmo tempo de desenho por quadro.
  - Telas (estilo.css, index.html, interface/*, arte/bau.js):
    - Em pé o conteúdo das telas cresce com `zoom` (1,3 em 16:9, 1,42 em celular mais alto): antes, no celular, quase
      todo texto ficava com 8–12 px. Corrigidos skins cortando a 3ª coluna, abas de missões vazando e botões de 520 px.
    - Tela de fim: título dourado com raios (vitória) ou frio (derrota), prêmios em fichas (`mostrarSub`), XP numa
      pílula, escada num painel com trilho que enche e baú em cima dos rivais 5 e 10, baú num cartão com luz e moedas
      (`ArteBau.luz`/`ArteBau.moedas`), contagem do PRÓXIMO RIVAL num selo com barra que esvazia (só desenho).
    - Pausa, Opções e Continuar em caixas com placa de título; menu com ícone e cor por botão; "Voltar"/"Menu"
      secundários; `body.leve` desliga os raios girando.
- PODER v14: cartões sem porcentagem — frase curta ("Bate mais forte", "Aguenta mais", "Corre mais") e 5 estrelas por
  faixa (bronze 1–5, prata 6–10, ouro 11–15, diamante 16–20, mestre 21–25); "+1" sobe do cartão ao comprar. Na tela de fim
  deitado só as estrelas (para caber); a frase aparece em pé e na tela Melhorar.
- Equilíbrio: `node` + simulação bot x bot (script fora do repositório) — medir % de rodadas na queda de braço (~10–35%)
  e duração da partida (2–3,5 min). `CONFIG.multDano` é o ajuste geral.

- v18.3 PASSOU no Player Fit Test (16/10, começou 17:11): 500 jogadas, 3m15 (de manhã a mesma versão fez 2m58). Foi
  para o Web Fit em 19/10 (7 dias de teste + revisão manual, ~2 semanas; o painel não mostra números no meio).
  A v18.3 continua sendo a do Web Fit: não trocar a versão de lá.
- v19 (reformulação pedida pelo dono; feita por 3 agentes em paralelo + online, juntados na branch v19):
  - **Visual (agente A):**
    - estilo cartoon: contorno #1a0d33 grosso, cel-shading em 2–3 tons, meia-lua de brilho (sem gradiente por quadro);
    - ícones desenhados (`js/jogo/arte/icones.js`, `Icone.desenhar/html/preencher`, `<i data-ico>` no HTML): sem emoji
      em lugar nenhum. `textoRico` (desenho.js) troca emoji que ainda chegar em texto pelo ícone;
    - os 15 mapas refeitos com 3 variações de horário/clima sorteadas por rodada;
    - bolinhas com expressões e squash & stretch; efeitos, HUD, baú, cartas e queda de braço refeitos;
    - telas com botões gordos que afundam e painéis de borda dupla.
  - **Combate (agente B):**
    - 60 armas, 10 novas: disco, gosma, boliche, banana, ímã, bomba grudenta, inflador, vampiro, tornado, torreta;
    - cada arma com som, tranco, clarão e cápsula; arte de todas no estilo novo;
    - bot com cobertura, desvio por trajetória, previsão e uso certo de cada arma;
    - 4 personalidades novas (só nos rivais 6–10) e provocações em texto (12 idiomas);
    - simulação contra a v18.3: os rivais 1–5 não ficaram mais difíceis.
  - **Meta (agente C):**
    - personalização com 123 itens em 9 categorias (`save.visual`, tela `#telaVisual`); o save antigo é convertido;
    - loja de armas (`#telaLoja`; comum 350, rara 900, lendária 2600) com arma inicial (`save.armas`,
      `save.armaInicial`); a loja só aparece depois do rival 5 ou de `viuPoder`;
    - roletas na 1ª rodada (arma, DEPOIS mapa; ~3 s; o toque acelera), no lugar das 3 cartas "?". Só mostram o que as
      regras de sempre sortearam;
    - melhoria Sorte (`sorteJogador()`, 0–1; vale 0 no 2 jogadores e no online). CSS das telas dela: `estilo-v19c.css`.
    - v19.1: roleta com chance por NÍVEL (o dono pediu as raras mais difíceis): comum 75%, rara 22%, lendária 3%
      (`PESOS_ROLETA` em combate.js; antes o peso era por arma e dava 82/17/0,8). Com a Sorte no máximo: 63/32/5.
  - v19.2: em pé com câmera, acima da arena o céu continua (cor da 1ª linha do fundo pronto, 6 faixas escurecendo
    para cima, estrelas se for escuro; `ceuAcima` em arte/cenarios.js). Antes era uma faixa lisa.
  - v19.3 (bugs que o dono achou):
    - o óculos antigo ("oculos") e o novo ("oculos_sol") tinham o mesmo nome; o antigo virou "Óculos redondos";
    - a aba Boca usava o ícone de nota musical; agora tem o ícone `boca`;
    - deserto: as mesas e as pirâmides acabavam antes das dunas e pareciam flutuar (base agora em 580);
    - ventania: a areia andava `t × força` e dava saltos quando a força mudava; agora a fase é acumulada
      quadro a quadro e mais devagar;
    - roletas mais lentas (`ROLETA` em partida.js): ~3,3 s nas 5 primeiras partidas e ~3,8 s depois. O toque acelera.
  - v19.4: `<meta name="color-scheme" content="dark">` e `color-scheme: dark` no :root. O modo escuro automático de
    alguns navegadores (Night mode do Brave, Samsung Internet, flag do Chrome) escurecia a parte clara dos botões
    (o canvas não muda). Páginas que se declaram escuras costumam ficar de fora. Nos testes com o escurecimento
    FORÇADO do Chromium não adiantou (nem "only light"); esse modo não vem ligado por padrão.
  - v19.6 (relatório do testador, ~100 min jogando a v19.5; nenhum erro de console):
    - **Gosma:** prendia sem saída (gruda 1,6 s, o bot atirava a cada 0,6 s). Agora não gruda de novo enquanto está
      grudado, tem 1,2 s de imunidade depois que solta e, na pessoa contra a máquina, gruda 30% menos.
    - **Banana:** também tem 1,2 s de imunidade.
    - **Armas que tiram o controle** (gruda, escorrega, bolha, infla): ficam fora das caixas e da roleta no treino,
      nas 6 primeiras partidas e nos rivais 1–5 da Bronze (`M.semControle`).
    - **Pular grudado:** dá um "tuc" e solta pingos.
    - **Arma inicial:** só contra a máquina e no online (no 2 jogadores só o jogador 1 tinha).
    - **Online:** o anfitrião também tem tempo-limite (6 s sem os controles do convidado; 40 s se a aba dele
      estiver escondida).
    - **Sobrevivência:** as ondas 1–3 batem 0,6 / 0,75 / 0,9 (antes 1; o jogador médio morria nas 3 primeiras).
    - **Roleta:**
      - toque, clique, pulo ou tiro PARA a roleta ("Toque para PARAR!", amarelo e pulsando);
      - nos primeiros 0,4 s nada conta (toques que sobravam do botão pulavam a roleta);
      - as teclas de andar não param.
    - **Abertura do rival:**
      - a faixa de prêmios espera a roleta e o VS (aparece quando a luta começa);
      - o VS não repete o nome do mapa depois da roleta de mapa e dura 1,4 s (era 0,95).
    - **Provocações:** nenhuma nos rivais 1–5 da Bronze (só a do fim); nos outros, 7 s no mínimo entre uma e outra e
      metade da chance. "?!"/"!!" não cobrem outro balão.
    - **Textos:**
      - "PRÓXIMA PARTIDA" no "Contra o bot" (era "PRÓXIMO RIVAL");
      - "IVY VENCEU!" todo em maiúsculas;
      - online com VOCÊ/RIVAL nos letreiros;
      - "БЕСПЛАТНО!" cabe (`.pcPreco.longo`);
      - em pé, os textos das telas da v19 com 23–27 px lógicos (~11–12 px no aparelho), a grade com 3 colunas e o
        status dos itens em 2 linhas (não corta mais com "...").
    - **ESC:** volta nos menus.
    - **K.O. que fecha a partida:** pausa 16 quadros e treme mais.
    - **Queda de braço no celular em pé:** "TOQUE NA TELA!" grande com a mão e vibração a cada toque.
    - **Tela de fim:** tic nos 3 últimos segundos da contagem.
  - **PFT v19.6** (23/10, 15:24): 2m40, 27% engajados, FPS 57. Reprovou na média, passou nos engajados.
    - Passagem por passagem contra a v18.3 (os dois testes de 16/10 somados), a v19.6 perde um pouco em quase tudo.
    - Os mapas não explicam: a taxa de "Failed" no treino é igual (fábrica 17 x 19%, floresta 27 x 28%...).
    - As maiores perdas extras:
      - treino rodada 2 -> 3 (quando as caixas aparecem): 80% x 86%;
      - fim do treino -> rival 2 (onde a roleta aparecia pela 1ª vez): 75% x 82%;
      - rival 2 -> 3: 52% x 58%.
  - v19.7 (o dono pediu as 3):
    - **A)** roleta só a partir do rival 3: os rivais 1–2 da Bronze começam direto, com o VS de 1,7 s e a faixa de
      prêmios, como na v18.3;
    - **B)** no treino, no rival 2 e nas 2 primeiras partidas só as armas da v18.3 (`M.soClassicas`, `ARMAS_V19` em
      combate.js);
    - **C)** dano x0,87 nos rivais 2–5 da Bronze e nas 6 primeiras partidas do "Contra o bot" (`M.multInicio`).
      Simulação bot x bot nos rivais 2–4: luta média 9,5 s -> 13,2 s.
  - v19.8:
    - **Arma inicial na roleta:** quem tem arma inicial também gira na roleta da 1ª rodada. Se sair raridade MAIOR que
      a inicial, a pessoa fica com ela nesta rodada (selo "MELHOR!", `roleta_melhor`, evento `roulette/weapon-upgrade`);
      se não, a roleta para na inicial (selo "INICIAL"). Enquanto gira mostra "Arma inicial: X". Com uma inicial comum:
      28% "MELHOR!". Antes a inicial travava a roleta e a pessoa perdia a chance de rara ou lendária.
    - **Partida rápida do online:** o botão "Jogar contra o bot" aparece aos 12 s (`BOT_DEPOIS`) e a busca continua por
      trás (evento `online/quick-bot`).
  - v19.9 (revisão do Gemini, feita na v19.6; as 2 sugestões de jogabilidade dele já estavam na v19.8):
    - **Online, outro jogador:** visual, cor e arma inicial do outro entram em `novaPartida("online", { outro })`
      (`Online.configurarOutro`) ANTES da 1ª rodada. Antes eram aplicados depois e a roleta nascia sem a arma dele.
    - **Online, roleta:** o toque do convidado para a roleta (`Online.cliqueRemoto` em `atualizarRoleta`). No convidado,
      a tecla não mexe na roleta local.
    - **Online, contadores de toque:** só zeram numa conexão nova. Na revanche o anfitrião acompanha a conta (antes o
      convidado zerava e os toques dele sumiam).
    - **Online, telas:** sala com código = tela "sala"; "Voltar" na digitação do código volta para os botões do online;
      ESC cancela a busca.
    - **Tela antiga:** `#telaSkins` saiu do HTML e do TELAS.
    - **Loja:** um loop de animação só (`loopLoja`).
  - **PFT v19.9** (23/10, 18:16, categoria Action Games): **PASSOU com 3m01**, 27% de engajados, FPS 58.
    - Treino rodada 2 -> 3: 90% (v19.6: 80%; v18.3: 86%).
    - Fim do treino -> rival 2: 79% (v19.6: 75%; v18.3: 82%).
  - **META DO DONO para trocar a versão no Poki** (se a v18.3 do Web Fit for aprovada): média >= 3m30 e > 30% de
    engajados num PFT.
  - v20 (online não funcionou com amigos da faculdade, nem no PC nem no celular):
    - **Etapas da conexão:** a rede emite a etapa "conectando" e o erro "p2p"/"rtc"; antes a tela ficava em
      "Conectando..." para sempre.
    - **Eventos:** `online/p2p` (start/complete/fail) e `online/reliable` (reached) mostram no painel onde a conexão para.
    - **Tempo-limite da conexão com o outro:** 15 s. Na partida rápida procura outra pessoa; com código, quem criou a
      sala continua nela.
    - **Sinal de vida:** "vivo" de 1 em 1 s pelo canal confiável, com a contagem de pacotes de jogo recebidos. Se menos
      de 40% chega pelo canal rápido, os pacotes de jogo passam a ir pelo confiável (`canalJogo`). Testado com
      `?rede=teste&perda=100`: a partida funciona.
    - **Tempo-limite de queda:** 8 s (era 6), contando qualquer mensagem.
  - v20.1 (online com amigos: "sala não encontrada" no código e a partida rápida não achava ninguém):
    - **Código da sala:** o servidor da netlib (github.com/poki/netlib, `internal/util/identifiers.go`) gera os códigos
      curtos em MAIÚSCULAS (2-9 e A-Z sem I, L, O, Q, U) e diferencia maiúsculas. O jogo passava o código para minúsculas
      no `join`, e toda entrada por código falhava. Agora usa `toUpperCase()`. O erro "lobby-not-found" mostra "Sala
      não encontrada".
    - **Sala velha:** salas de quem fechou o jogo ficam um tempo na lista. Entrou numa sala e ninguém respondeu em
      12 s: a sala vai para `Rede.evitar` e a partida rápida procura outra (antes ficava esperando para sempre).
  - v20.2 (para buscar 3m30: no PFT da v19.9 só 55% passavam do rival 2 para o 3 e 51% do 3 para o 4):
    - **1) Isca do próximo desbloqueio:** `desbloqueioRival(i, liga)` em dados/rivais.js. Aparece em verde no VS, entre
      o prêmio e a trilha:
      - rival 2: "Vença e libere: ROLETA + 10 ARMAS NOVAS!";
      - rivais 3–5: "Loja de armas em N vitórias" / "Vença e libere: LOJA DE ARMAS!".

      Ao vencer, comemora na faixa (fluxo direto) ou numa ficha da tela de fim: `novo_roleta` / `novo_loja`.
    - **2) Pausas ~25% menores:** `RODADA.fim` 2,1 -> 1,7; sem K.O. 1,5 -> 1,2 (`RODADA.semKo`); abertura das rodadas
      2+ 1,0 -> 0,8; fim da partida 2,6 -> 2,1.
    - **3) Carregamento adiado:** queda.js, roleta.js (v20.5: cartas_arma.js), rede.js e online.js saíram do index.html e carregam 1,5 s depois
      de abrir (`carregarAdiados` no main.js). "Online" no menu espera o carregamento. Loja e personalização continuam
      no começo: a loja cria o botão do menu quando carrega.
  - v20.3 (partida rápida: "Oponente encontrado" piscava e a partida não começava; a sala com código já funcionava):
    - **Vigia** (procura sala mais antiga a cada 3 s):
      - antes continuava rodando com alguém entrando na sala e largava a sala no meio da conexão;
      - agora para no evento "connecting" (`entrando`) e quando a sala tem 2 pessoas;
      - só troca para salas até 75 s mais velhas que a sua (mais velha que isso é de quem já saiu).
    - **Sala velha:** quando a vigia entra na sala de outro, também espera resposta por 12 s.
    - **Tela:** o relógio da busca mostra "Oponente encontrado!" enquanto conecta.
  - v20.4 (modo escuro automático do navegador: Night mode do Brave, "dark mode" do Chrome/Samsung):
    - o navegador escurece cores e degradês CLAROS do CSS (topo de botões e cartões ficava marrom) e inverte imagens
      escuras; `js/interface/fundos.js` troca só os degradês/cores CLAROS de fundo por uma imagem SVG de faixas lisas
      com as mesmas cores (um `<linearGradient>` no SVG ele também escurece). O brilho dos botões (`button::before` no
      estilo.css) virou imagem pelo mesmo motivo. No modo normal nada muda;
    - texto escuro (marrom dos botões amarelos) o navegador ainda clareia: tentei texto "pintado" com imagem e ele
      inverte também. Testar com Playwright + CDP `Emulation.setAutoDarkModeOverride`.
  - v20.5 (o dono: "tira a roleta totalmente e coloca as cartas de novo, muito mais bonitas e refinadas; se escolher uma
    arma melhor do que a que comprou, vai automaticamente"). AS ROLETAS (arma e mapa) SAÍRAM; `arte/roleta.js` apagado:
    - **Cartas de arma** (fase "cartas", `iniciarCartas`/`atualizarCartas`/`escolherCarta`/`ESCOLHA_CARTA` em partida.js;
      desenho em `arte/cartas_arma.js`, carregado com os adiados): na 1ª rodada contra a máquina ("bot" e 1ª onda da
      sobrevivência; não no 2 jogadores nem no online), a partir do rival 3 como a roleta (vencer o rival 2 "libera":
      `libera_cartas` / `novo_cartas`, ícone `cartas`);
    - 3 cartas viradas com "?"; cada uma esconde uma arma (`sortearArmaCarta`: 75/22/3 + Sorte, sem repetir). Toque ou
      clique na carta, teclas 1/2/3, ou ←/→ e pulo/tiro (a em foco tem aro amarelo; o mouse por cima muda o foco).
      Sozinha em 3 s (barrinha). A escolhida vira; 0,5 s depois as outras viram, apagadas (o "quase"). Rara/lendária:
      raios girando, lendária com brilhinhos. Um toque depois de 0,6 s pula para o VS (que agora volta a mostrar o mapa);
    - **Arma inicial:** a carta de raridade MAIOR que a inicial fica nesta rodada (selo "MELHOR!"); se não, fica a
      inicial (selo verde "Arma inicial: X"). Só a pessoa escolhe; o bot fica com a arma da rodada;
    - verso e frentes desenhados uma vez num canvas guardado; em pé as cartas são x1,5;
    - eventos iguais aos da v18.3: choice/weapon (visible), choice/weapon-rN[-auto], choice/weapon-upgrade|weapon-start.
  - v20.6 (plano revisado pelo Gemini e pelo Claude; o dono pediu para fazer o melhor dele):
    - **Bot lê a MIRA com atraso** (`oponentePercebido`: mira, recarga e origem da linha com no mínimo 0,18 s). No
      nível máximo a reação é 0,08 s e ele saía da linha do sniper no mesmo quadro do flick. Só muda do nível ~0,76
      para cima (rivais fortes); os rivais 1–5 já tinham reação maior que 0,18 s;
    - **Bot não atira no reflexo** quando `preve >= 0,3` (nível ~0,28+); o fraco às vezes atira e o tiro volta.
      Teste: nível 0,95 com reflexo 0 tiros em 2,5 s (148 sem); nível 0,1 atira igual;
    - **Vibração** (`vibrar(ms)` em util.js, só com toque): golpe >= 20 de/em gente 18 ms, K.O. 30 ms, K.O. final
      [30, 40, 60]; a queda de braço usa a mesma função. Na demo do menu nada vibra (`M.mudo`);
    - **Parte 3 do plano (sobrevivência em blocos de 3 ondas, chefe a cada 6) NÃO foi feita:** mexe muito num modo fora
      do funil que o PFT mede (a queda é entre os rivais 2 e 4) e mudaria os números de onda. Fica para depois do PFT,
      se os eventos mostrarem gente jogando a sobrevivência.
  - v20.7 (o dono: "a maior otimização possível" + 3 línguas). Medido com Playwright, CPU 4x mais lenta:
    - **Resolução do canvas** (`resTela`, main.js `ajustarTela`): o desenho continua em 1280 x alturaTela lógicos, mas o
      canvas tem só os pixels que a tela mostra (largura na tela x densidade, máx. 2; nunca acima de 1280). Em pé no
      celular era 1280 x ~2840: 14 qps -> 27 qps (832 x 1847). `ctx.setTransform(resTela...)` no começo de cada quadro;
      o toque/mouse usa `alturaTela` (não `canvas.height`). Na tela do aparelho a nitidez ficou igual;
    - **Qualidade automática** (`vigiarQualidade`): no "auto", na luta, 2 medidas seguidas de 3 s abaixo de 45 qps descem
      um degrau: 1º modo leve, 2º `CONFIG.resBaixa` (densidade 1,25; em pé 55 qps com a CPU 4x). Eventos perf/auto-light
      e perf/auto-lowres;
    - **Aquecimento em pedaços** (`ArteArmas.tarefasAquecer` + `filaAquecer` em main.js, requestIdleCallback): os 60
      sprites de arma eram 1 bloco de ~0,65 s (CPU 4x) no começo da 1ª partida; agora ~65 pedaços nas folgas, rifle e
      caixas primeiro. `caixaJusta` (armas.js) acha o recorte lendo 4 bytes por vez e parando nas bordas. Sprites iguais
      pixel a pixel (comparado com a v20.6). Pior travada no começo: ~650 -> ~330 ms;
    - **fundos.js** (modo escuro) trata a tela aberta na hora e o resto em lotes nas folgas;
    - canvas `alpha: false`;
    - **Versão para o Poki** (`ferramentas/construir.js`, `npm install` uma vez e `npm run construir` -> `dist/`): os 37
      scripts do index viram `jogo.min.js` (esbuild; nomes globais mantidos), os carregados depois são minificados no
      mesmo caminho (netlib com a licença), CSS num só. Abertura 273 -> 179 KB gzip, 42 -> 5 pedidos; no 4G lento a
      partida aparece em 3,15 s (era 4,0). **O zip do Poki sai de `dist/`** (o repositório continua com o código legível);
    - **Línguas novas: vietnamita (vi), ucraniano (uk) e japonês (ja)** (15 no total). Vietnamita com
      `fonte/nunito-vietnamese.woff2` (13 KB, só baixa quem usa); japonês usa a fonte do sistema (a Nunito não tem kana).
  - **PFT v20.7** (sáb 24/10, 13:32): **2m56**, 27% engajados, FPS 59 (v18.3 de manhã 2m58; v19.9 às 18:16 3m01).
    Histograma igual ao da v19.9 (0-1m ~172, 5m+ ~76): as mudanças da v20.x não mudaram o comportamento. Eventos:
    - passagens quase 100% (terminou treino 347 -> rival 2 350; rival 2 ~168 -> rival 3 171; rival 3 ~109 -> rival 4 106);
    - o vazamento é DURANTE a partida: ~16–17% saem a cada rodada desde a 1ª do treino (treino 630 -> 347; rival 2 só
      2% perdem a partida). Saída por TEMPO, não por dificuldade (como o jogador de teste viu na v17.5);
    - 34% saem antes de 1 minuto; 6% nem começam a partida depois de carregar;
    - saem DURANTE o mapa: templo 14%, fliperama 11%, floresta 8,7%, fábrica 6,1%, campo 5,4%;
    - 87% celular, 54% em pé; línguas novas: 11 pessoas (vi 5, uk 4, ja 2); online: 2 tentaram e falharam (p2p).
  - v20.8: treino e rivais 2–3 sem templo e fliperama (sobram campo, fábrica e floresta); eles voltam como casa do
    Rocky (rival 4) e da Nova (rival 5) e no resto da ordem do treino depois da 3ª rodada.
  - v20.9 (agente jogador de teste, 1º minuto, 10 sessões; relatório em scratchpad/agente1min/relatorio/relatorio.md):
    - **Mira assistida virava para o lado errado:** no toque, segurar o botão de tiro sem arrastar não dá mira livre e o
      tiro ia para o lado em que a bolinha andou por último; o Bob do treino gruda nas costas e 78–84% do tempo de tiro
      ia no vazio (uma rodada de 45 s sem acerto). Agora (combate.js `usarArma`) gente atirando sem mira livre vira
      para o oponente na hora do tiro. Teste "andou um pouco e segurou o tiro": antes 5 s com o Bob em 100; agora 100 ->
      20 em 1 s. No treino a mira assistida de gente pega até ~57° (Bob numa plataforma acima);
    - no treino o Bob bate 40% menos (`M.multBot *= 0.6`; a vida caía de 100 para 48 em 2,5 s depois do 1º acerto);
    - o analógico de tiro diz "ATIRAR"/"SHOOT" (`toque_tiro`; era "MIRAR"/"AIM");
    - ficou para depois (do relatório): em pé a bolinha fica na beirada e ~40% da tela é céu vazio (câmera); recompensa
      do treino passa batida em 2–3 s; parado 45 s sem nada acontecer na rodada 1 do treino; tocar no rival faz pular.
  - v21 (o dono pediu tudo para chegar em 3m30; 54% jogam EM PÉ no celular):
    - **Câmera em pé mais perto** (desenho.js `layoutTela`/`atualizarCamera`): zoom 1,75–2,2 (era 1,3–1,8); bolinha de
      ~32 -> ~40 px de diâmetro num celular de 412 px. A sua bolinha (índice 0) fica sempre a >= 24% da largura da
      beirada; o outro, fora da tela, vira uma seta na cor dele (`desenharSetasForaDaTela`, agora 2x maior);
    - **Tocar na arena = atirar ali** (em pé com câmera; `toqueNaArena` em desenho.js, tipo "alvo" em entrada.js): a mira
      vai no ponto tocado (como o mouse) e atira enquanto o dedo está lá; anel na cor de quem joga no ponto. Os botões de
      baixo (andar, pular, atirar) continuam iguais; deitado e 2 jogadores não mudam. Teste "tocar no Bob e segurar 1,5 s":
      v20.9 a bolinha pulava e o Bob ficava em 100; v21 o Bob vai a 0.
  - v21.1 (pesquisa sobre o Poki e os duelos que fazem sucesso; o acesso direto ao poki.com é bloqueado neste ambiente,
    então veio da busca):
    - Critério oficial do PFT: média > 3 min E >= 25% das 500 jogadas passando de 3 min (a v19.9 já passou). O Poki
      sugere 5+ min e 65%+ de "conversion to play" antes de pedir revisão. A meta 3m30 / 30% é do dono;
    - **Regra do anúncio premiado (revisão manual do Poki):** o botão do anúncio NUNCA verde e com o ícone de vídeo 🎬;
      a opção normal é que é verde, do mesmo tamanho, ao lado ou acima; sempre existe a opção sem anúncio; anúncio
      nunca obrigatório para avançar. O jogo estava ao contrário (anúncio verde com "play"). Agora: `button.anuncio`
      (roxo) com `Icone "video"` (claquete) em Continuar, Partida Lendária e Abrir outro baú; na tela Continuar o
      "Não, obrigado" é `.grande.padraoVerde` ao lado/acima (ESC também aperta ele). A v18.3 do Web Fit tem o jeito antigo;
    - **TESTE A/B dentro do PFT** (como o Smash Room no blog de Game Events do Poki): `save.exp` sorteado 1 vez por jogador:
      "a" = bot atual, "b" = bot simples (preve/leMira/cobre/combo 0, finta 0,1, sem arco alto e tabela; nível, mira e
      reação iguais: o jeito de lutar da v18.3). Eventos: exp/bot-a|bot-b (visible, quantos em cada grupo) e
      exp/bot-x-1m|3m|5m (reached). Comparar a fração que passa de 3 min em cada grupo (com ~250 por grupo só uma
      diferença de ~8 pontos é confiável);
    - duelos de sucesso no Poki (Rooftop Snipers, Getaway Shootout, Stickman Battle): 2 botões, física engraçada, rodadas
      de segundos, revanche instantânea; celular em pé obrigatório (pedir para girar faz sair).
  - v21.2 — **DASH** (pedido do dono): arrancada curta (`DASH` em fisica.js: vel 17 px/passo, 0,16 s, recarga 1,1 s;
    vale no ar, quase sem gravidade durante). Durante o dash os tiros ATRAVESSAM (combate.js, anel branco) e golpe/
    explosão/laser de quem ataca não pega (`causarDano`). Controles: Shift/E (jogador 1) e Shift direito/K (jogador 2)
    — ação nova "dash" em ACOES/TECLAS_PADRAO, save antigo com teclas trocadas ganha as de fábrica livres —, botão
    direito do mouse, Y no controle e botão DASH no toque acima do analógico de andar (`posDash`/`toqueNoDash` em
    desenho.js; escurece enquanto recarrega). Bot: `botDash` (bot.js) dá dash num tiro do outro que VAI acertar
    (menor distância da reta): chance 57% no nível 0,95, 36% no 0,6, 17% no 0,3, 0 abaixo de 0,25 e no grupo "b" do
    A/B. Online: contador `dc`. Rastro de fantasmas (`dashFant`), poeira e som. Dica "Shift / E: DASH (desvia dos
    tiros!)" (`dica_dash`, `acao_dash`, `toque_dash` nos 15 idiomas);
  - v21.3 — o que os duelos famosos do Poki têm e faltava aqui (pesquisa: série Random da RHM, Rooftop Snipers):
    - **RODADA MALUCA** (partida.js `TWISTS`/`escolherTwist`/`aplicarTwist`): da 2ª rodada do rival 2 em diante
      (no "Contra o bot" depois da 2ª partida; no 2 jogadores sempre; nunca no treino/online/sobrevivência), 50% das
      rodadas têm uma surpresa, nunca a mesma seguida: bolinhas gigantes (r x1,35), mini (x0,75; só do rival 4 em
      diante), turbo (vel x1,35), chuva de armas (caixas x0,35 do intervalo) e super pulo (a rodada toda). Letreiro
      embaixo da faixa da abertura (`desenharTwist`; a abertura fica 0,7 s mais longa). Evento twist/<id>;
    - **K.O. "boneco de pano"**: quem perde sai voando e girando com cara de dor (~0,8 s de jogo; `M.voos`,
      `desenharVoos`) e só então estoura em confete.
  - v21.4 (dono): **a arma da loja virou ARMA RESERVA** ("funciona igual o estilingue"): ninguém começa a rodada com ela;
    quando a munição acaba vem ela com munição INFINITA no lugar do estilingue (combate.js `equiparReserva`, com o nome
    dela em verde em cima da bolinha). Sem arma comprada: estilingue. Vale contra a máquina e no online (cada um a sua).
    As cartas da 1ª rodada valem sempre (sem a comparação "MELHOR!" com a inicial: `j.cartas.ini` = null). Textos da
    loja: "Usar como reserva", "Reserva: X (vem quando a munição acaba)" (chaves arma_inicial_* nos 15 idiomas; o save
    continua `save.armaInicial`). **Preços: comum 400, rara 3.000, lendária 9.000** (eram 350/900/2.600; o dono quer as
    boas muito caras para não ficar apelão). **Rodada Maluca também no online** (o anfitrião sorteia; tudo vai no estado).
  - v21.5 — **medidor de SUPER** (o "especial" que enche dos duelos famosos: Basketball Stars, Bowmasters, Supreme
    Duelist). `combate.js` `carregarSuper`/`ativarSuper`: enche com o dano dado e também com o recebido (virada);
    contra o bot a pessoa ganha 1x o dano dado e 0,6x o recebido, o bot 0,6x/0,35x; 2p/online 0,8x/0,5x. Cheio, liga
    SOZINHO (sem botão novo): `efeitos.super` 5 s com dano x1,5 (`SUPER.mult`), aura dourada (a da fúria, `aura(R,q,ouro)`),
    "SUPER!" + "DANO x1,5!" (`super_dica` nos 15 idiomas), som `super` e vibração. HUD: anel dourado em volta do retrato
    (`desenho.js anelSuper`). `b.super` e `efeitos.super` vão no estado do online sem mudar nada. Zera a cada rodada.
  - v21.6 — **SUPERS DIFERENTES + Rodada Maluca no mapa** (pedido do dono):
    - `dados/supers.js`: 10 supers. "poder" (liga sozinho quando o medidor enche): Dourado (dano x1,5), Turbo (vel x1,45,
      tiro 2x), Gigante (raio x1,55, dano x1,3, leva metade), Vampiro (dano x1,25, cura 60% do dano dado), Intocável
      (nada pega por 4 s). "ataque" (fica PRONTO, ícone pulando em cima da cabeça, e sai no PRÓXIMO TIRO, sem botão
      novo; `usarArma`): Chuva de Meteoros (7 que seguem o rival), Raios (4), Canhão Gigante (bala x3 que atravessa
      tudo, explosão 150), Mísseis (4 teleguiados), Buraco Negro (puxa 2,2 s e explode; `M.buracos`).
      Grátis: Dourado, Turbo, Meteoros — **sem super comprado, cada rodada sorteia 1 dos 3**. Preços 2.500–10.000.
    - Ataques têm `superAtaque`: o dash não atravessa e o bot só "vê" o aviso do céu depois de 0,3 s (sem isso o bot
      do rival 7 desviava de tudo: 0 de dano nos testes; agora 15–45).
    - Quem tem qual (`partida.js escolherSuper`): a pessoa = `save.superEquip` (contra a máquina e online); rival da
      Bronze 1–3 = os grátis; rivais depois = um fixo por rival; treino/demo = Dourado; 2p = grátis sorteados.
      Online: o convidado manda o dele no "ola" (`sup`), vai em `jogo.superEquip`.
    - Loja: 4ª aba "Supers" (`loja.js montarSupers/atualizarDestaqueSuper/previaSuper`), `save.supers`/`save.superEquip`,
      `Progresso.temSuper/comprarSuper/equiparSuper`, eventos shop/buy-super-<id> e shop/super-<id>.
    - HUD: anel na cor do super + ícone dele no canto do retrato. Aura da fúria na cor do super (`aura(R,q,cores)`).
    - Ícones novos em icones.js: s_<id> dos supers, bola, lua, vento.
    - Rodada Maluca: chance 50% -> 60% e 5 eventos NO MAPA: meteoros (reusa os do castelo, a cada ~1,7 s), tempestade
      (raios perto dos dois), bolas (bolas de praia gigantes caindo e quicando, de ninguém; `a.rebate`), lua (gravidade
      x0,55; `fisica.js gravidadeDe` lê `jogo.M.twist`), vento (ventania que vira a cada 4 s; `ventoTwist`, riscos na tela).
    - Corrigido: a Rodada Maluca "gigantes"/"mini" não funcionava (atualizarEfeitos voltava o raio ao normal no passo
      seguinte). Agora existe `b.raioBase`.
  - **PFT v21.6 (25/10 09:21, manhã): 3m11s, 30% — PASSOU** (melhor desde a v18.3). Funil: 1ª partida 634, 30 s 513,
    2ª partida 432, 1 min 371, 3ª partida 241 (a 2ª partida perde 44%: ~16% por rodada, por tempo), 3 min 169, 5 min 108.
    Rodada Maluca: 0–3% saem durante (mapas: 0,3–15%). ~30% dos jogadores caem no modo de resolução baixa (perf-auto-lowres).
  - **Teste A/B do bot: EMPATE** (a: 338 -> 1m 56%, 3m 25%, 5m 16%; b: 341 -> 54%, 25%, 16%).
  - v21.7 — fim do A/B (fica o bot atual; saíram `save.exp`, o bot simples e os eventos exp/*); deserto, gelo e
    laboratório fora da Bronze inteira (só como casa do rival); Rodada Maluca sem "mini".
  - PFT v21.7 (dom 25/10 17:00): ~3m05–3m10 (perto da v21.6; a v21.7 não mudou o patamar — ruído de ±20 s).
  - v21.8 — **Rodada Maluca em TODA rodada (da 2ª em diante) nos rivais 2 e 3** (só gigantes, pulo, chuva, bolas, lua,
    meteoros: as de menos saída) e 75% nas outras (era 60%). Motivo: a 2ª partida perde ~15% por rodada por tédio.
  - v21.9 — a pendência do agente de teste (rodada 1 do treino com 45 s de tela parada para quem não entende): o relógio
    dessa rodada caiu para 25 s e, sem acerto da pessoa por 5 s, o Bob vira alvo parado na frente dela (`bobAlvo`).
  - v22 — **treino e rival 2 até 2 pontos** (eram 3; `CONFIG.pontosPrimeira`, `CONFIG.pontosRival2`). PFT v21.6: quem
    TERMINA uma partida começa a próxima (~100%: treino 418 -> 422, rival 2 231 -> 241); no meio dela saem ~15% por
    rodada. Menos rodadas até a vitória = ~20% mais gente chegando no "gancho" (vitória, prêmio, próximo rival).
  - **Online (js/rede/):**
    - `netlib.js` é a Poki Networking Library (WebRTC P2P; servidor de salas e TURN de graça do Poki; licença ISC no
      topo do arquivo). Só é baixada quando a pessoa abre o online;
    - `rede.js` faz a conexão. Com `?rede=teste` na URL usa um "cabo" local (BroadcastChannel entre duas abas) para
      testar sem internet. `CONFIG.idRede` é o id do jogo na netlib (pode trocar pelo id do Poki);
    - `online.js`: o anfitrião roda a partida (modo "online", igual ao 2p com a bolinha 2 vinda da rede). Ele manda o
      estado 30x/s, só o que mudou, e um pacote cheio a cada 1 s (~540 bytes em média), mais os efeitos e sons
      gravados no passo;
    - o convidado não simula: manda os controles e vê tudo ESPELHADO (a bolinha dele é a 1), então o HUD, o "VOCÊ",
      a mira e a câmera funcionam sem mexer no desenho;
    - partida rápida (salas públicas; quem espera procura outra sala a cada 3 s para duas pessoas não ficarem
      esperando em salas separadas), sala com código e revanche;
    - anúncio comum antes de procurar e antes da revanche, nunca no meio. Vitória dá 40 moedas, derrota 15;
    - v19.1: a variação do cenário vai no estado (`varCen`) e o convidado usa a mesma; aba escondida avisa o outro
      ("oculto": o anfitrião solta os controles do convidado; o convidado espera até 40 s em vez de 6 s);
    - v19.5: `CONFIG.idRede` = id do jogo no Poki (df3225ad-…; antes um id inventado, e a partida rápida voltava na
      hora). A partida rápida espera até 1 min (`ESPERA_RAPIDA`; tempo na tela, globo girando, Cancelar). Erro de
      rede tenta de novo a cada 3 s. Sem ninguém: "Tentar de novo" ou "Jogar contra o bot". O motivo do erro aparece
      entre parênteses no texto (ex.: "servidor-socket-error"). Se a netlib falhar, a próxima tentativa recria a conexão;
    - não testado com a rede de verdade aqui (o ambiente bloqueia netlib.poki.io); testar no site.

## Entrega para o Poki
- Zip com número de versão (ex.: `jogo-v1.zip`):
  `git archive --format=zip -o jogo-vX.zip HEAD index.html estilo.css estilo-v19c.css js fonte`
- Player Fit Test: média ≥ 3 min e ≥ 25% dos jogadores com mais de 3 min.
  - Meta do dono antes do Web Fit: 4m30–5m de média e ≥ 35% acima de 3 min.
