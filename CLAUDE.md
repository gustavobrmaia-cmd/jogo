# CLAUDE.md — Robot Button

Jogo idle/clicker para o Poki (dono: brasileiro, fala português; responder em português). JavaScript puro + canvas,
sem framework. O jogo anterior (Crazy Balls Duel, duelo) está na branch `backup-crazy-balls-duel-v23`.

## Estrutura
- `index.html` (ordem dos scripts importa: são globais), `estilo.css` (pixel art: bordas em degraus, fonte Pixelify).
- `js/nucleo/`: `config.js` (constantes), `util.js` (fmt de números grandes, carregarScript, semente), `save.js`
  (`save.p` = partida, some no renascimento; o resto é permanente), `main.js` (começo e laço).
- `js/idiomas/`: `idiomas.js` (t("chave", ...), traduzirDom) e `textos/xx.js` — 15 idiomas, mesmas 117 chaves.
  Os textos foram gerados de `scratchpad/textos/*.py` (conferindo {0}/{1}); ao criar chave nova, pôr nos 15.
- `js/poki/`: `poki.js` (SDK: gameplayStart só depois da 1ª interação, commercialBreak/rewardedBreak com rede de
  segurança, Game Events com fila) e `eventos.js` (playtime/30s..60m, session/*, milestone/*).
- `js/sistemas/audio.js`: sons sintetizados (Web Audio), sem arquivos.
- `js/jogo/dados/`: `economia.js` (fórmulas e UPGRADES), `robos.js` (30 nomes; vida/ataque/PH por nível),
  `monstros.js` (9 hordas x 3 monstros), `arvore.js` (15 nós em 3 galhos; phRenascer).
- `js/jogo/arte/pixel.js`: TODA a arte (robôs por peças escolhidas pelo nível, monstros por forma, botão, ícones),
  com sombreado e contorno automáticos. Exibida com `image-rendering: pixelated`.
- `js/jogo/motor/`: `jogo.js` (regras: toque, time, criar, juntar, esteira, fusão, compêndio, offline, upgrades,
  renascer; avisa a interface por Jogo.ao(evento)), `batalha.js` (simulação das hordas).
- `js/interface/`: `tela.js` (grade, time, botão, arrastar/tocar, dicas do começo), `paineis.js` (abas, janelas,
  faixa de descoberta, offline), `batalha_tela.js`, `arvore_tela.js`, `fx.js` (números e partículas).
- `ferramentas/construir.js`: gera `dist/` (scripts num arquivo minificado; idiomas minificados à parte).

## v2 (pedidos do dono depois da v1)
- Arte: robôs e monstros em 48x48 com sombreado por peça (5 tons, bisel, dithering, contorno interno), engrenagens,
  caixinha de nascimento, texturas da interface (chapas com rebite, faixa de perigo, encaixes) — tudo em pixel.js.
- Fundo da máquina (`interface/fundo.js`, 1/4 da resolução, 30 qps): parede, canos, engrenagens girando, motor com
  pistões e fumaça, luzinhas.
- Robôs na grade respiram (idle em 2 quadros, cada um no seu tempo) e nascem DENTRO de uma caixinha (cai, treme e
  abre; tocar abre na hora).
- Abas escondidas: só a ponta aparece; mouse por cima (ou 1º toque) puxa as abas; 2º toque escolhe.
- Upgrades em TIERS (economia.js): 5 tiers x 3, cada um com 5 níveis; o principal de um tier no nível 3 libera o
  próximo. Simulação: scratchpad/sim/eco2.js.
- Árvore em REDE (arvore.js: 23 nós com x/y e ligações; abre quando qualquer nó ligado foi comprado), desenhada como
  placa de circuito (arvore_tela.js).
- Batalha em tela cheia numa FÁBRICA (`interface/cena_batalha.js`, baixa resolução com escala inteira); os robôs lutam
  sozinhos e o jogador lança 4 habilidades (Míssil, Choque, Conserto, Sobrecarga; batalha.js HABILIDADES), liberadas
  pelas hordas vencidas. Em pé: robôs no chão e monstros na passarela (luta na vertical).
## v3
- Ícones refeitos em 24x24 com o sombreado dos robôs (pixel.js icone). O de "dedo" é um dedo apertando o botão
  vermelho (a 1ª versão parecia um gesto ofensivo: cuidado com mãos).
- Som v2 (audio.js): efeitos com envelope, desafinação, filtros e eco; MÚSICA chiptune gerada na hora (trilha "jogo"
  e "batalha", Som.musica); opção Música separada (save.semMusica).
- Balanceamento (o dono: "parece que nem precisa renascer" e "poucos pontos"): PH de robô 2 + nível/2, de monstro 3,
  de renascer 3·1,6^(maxTier−7); cada renascimento dá renda x1,25 para sempre (BONUS_RENASCER); árvore custa 3x.
- Preço de criar robô: v5.3 sobe 12% por robô criado (era 8,5%). O piso pela renda da v5.2 ficou caro demais e
  saiu ("não precisa inventar a roda"). Simulado (sim/eco4.js): robô 8 na 1ª partida em ~6,4 min (era 5,3).
- Regra do dono: o que vier com "sei lá" na mensagem, perguntar ou sugerir em vez de fazer.

## v3.1
- Animação de curto-circuito ao renascer (js/interface/curto.js, canvas #curto por cima de tudo): o painel fecha,
  a máquina pifa (tremedeira, faíscas, fumaça, raios, alarme, música abafada), carrega e explode; no auge do clarão
  chama Jogo.renascer() + ArvoreTela.abrir(true). 3 variações em rodízio (save.renascimentos % 3): engrenagens,
  botão vermelho, pane elétrica geral. O fundo tem Fundo.pane {vel, fumaca, luzes} e Fundo.pontos().

## v4 (pesquisa: idle segura mais tempo que duelo, mas precisa de objetivo claro, recompensa e quebra de rotina)
- Missões (js/interface/missoes.js): cartão #missao sempre na tela; 19 fixas que ensinam o jogo (até renascer) e
  depois geradas sem fim. save.missao {n, tipo, alvo, base}. Completa -> verde pulando -> tocar pega o prêmio.
- "NOVO ROBÔ!" (revela.js): robô nunca visto (nível 2+) ganha tela cheia com raios; a faixa fica só para monstros.
- Surpresas (surpresas.js): robô dourado voando (moedas, turbo x3 por 20 s ou robô de presente) e monstro invasor
  (toque + o time atiram; derrotar dá moedas e entra no compêndio). Turbo: Jogo.multTurbo (fora do multMoedas).
- Abas sempre visíveis (a que tem bolinha vermelha pisca). Eventos Poki: mission, event golden/invader.

## v5: batalha em multidão (pedido: "estilo How Many Dudes"; a pixel art fica como está)
- Cada robô escolhido vira um bando de robozinhos (4 + nível/4, máx. 120 no total; vida/ataque divididos).
  Sprites pequenos: Pixel.mini (reduz 2x e refaz o contorno). Física simples: correm, pulam batendo, são arremessados.
- Ondas: 4 e 6 monstros; a 3ª tem um MONSTRO GIGANTE (vida x5) que dá pancadas em área e arremessa todo mundo.
- Conserto agora também manda reforços (1/3 dos que caíram). Placar "xN robozinhos / xN monstros" e barra do gigante.
- Ataque dos monstros x0,3 (ATQ) e números do gigante acertados por simulação (scratchpad/sim/bat.js compara com a
  batalha antiga: mesmo nível mínimo para vencer cada horda). Deitado: esquerda x direita; em pé: baixo x cima.

## v5.1: pontos dos robôs a cada partida
- save.p.pegos: níveis que já deram PH/moedas nesta partida. Renasceu -> zera -> chegar de novo em cada nível dá os
  pontos de novo (só faixa; a tela "NOVO ROBÔ!" e o ponto do compêndio só no inédito). Save antigo: pegos = 1..maxTier.

## v6: tiers 6 e 7, gráfico
- Tier 6: Reator Estelar (P, tudo x3), Ímã Dourado (NOVO tipo: robô dourado +25% mais vezes e +50% de prêmio),
  Pistões Hidráulicos (time +60%). Tier 7: Megafábrica (P, nasce +1), Fusão Instável (NOVO tipo: 6%/nível de a junção
  pular 1 nível, mostra "+2!"), Dedo Cósmico (toque x3). Ícones novos: estrela, ima, pistao, atomo. sim/eco5.js: tier 7
  abre depois de ~3 renascimentos.
- Gráfico: luz pontilhada (Bayer) no fundo e na batalha (vinheta, brilho atrás do botão, poças de luz), poeira no ar,
  reflexo passando no botão, vagas com brilho pela raridade do robô (data-r 1..6), números do time somados (0,7 s),
  faíscas nos golpes da multidão, volume nos cartões/botões.

## v7
- Renascer NÃO dá pontos (o dono: "você vai gastar o que conseguiu"); só renda x1,25 para sempre. phRenascer() = 0.
- Árvore: 23 -> 73 nós, mapa 26x20 casas que se arrasta (arvore_tela.js). Nós genéricos por tipo (arv(tipo) soma os
  níveis): renda, time, toque, criar, esteira, batalha, hab, invasor, ouro, missao, turboouro, ph, offline. Nós-chave:
  setimo, grade2, auto_criar, rico2, fab_ini2. ph_bonus virou "Bônus de Descoberta" (+25% PH das descobertas).
- Batalha mais difícil: ATQ 0,6, vida dos monstros x1,7, gigante x9 -> ~2 níveis de robô a mais (sim/bat.js).
  poderHorda x8 calibrado (sim/poder.js): antes mostrava verde e perdia.
- Música: 8 músicas (5 do jogo, 3 de batalha) compostas na hora (audio.js MUSICAS + compor): intro/A/B/A'/fim, 28
  compassos (~1 min), melodia por gerador com semente, contramelodia, pad, baixo, bateria com viradas e prato; troca
  de música sorteando outra. Volume da música 0,9. Para ouvir fora do jogo: verif/gravar.js grava um WAV.
- Sprites: contorno seletivo (tom escuro da cor em cima/esquerda, tinta embaixo/direita: mat() tem 6º tom), luz
  pontilhada no topo das peças, brilho maior; robôs com rebites, ventilação, reflexo, propulsores (13+), emblema
  (21-27); monstros com pintas, barriga clara e dentes. Folha de comparação: verif/sprites.js.

## v8: 42 upgrades (6 por tier) e jogo mais difícil
- Novos: Ritmo (combo de toques, medidor #combo), Mira Laser (crítico x5 sem a árvore), Cofrinho (juros a cada 10 s,
  teto de 30 s de produção), Reciclagem, Bancada (grade rende), Caixa Premiada (+2 níveis), Fúria (a cada 100 toques,
  x3), Médicos, Esteira Dupla, Reforços, Radar, Negociador, Turno da Noite, Gerente, Capacitores, Clonagem (sobra
  cópia ao juntar), Turbo Turbinado, Laboratório, Crítico Supremo, Exército Maior, Produção em Massa (teto +200%).
- Mais difícil: tier 2+ custa 2x e cada nível sobe +0,3 a mais (custoUpgrade); moedas de descoberta pela metade.
  sim/eco6.js: começo igual (robô 8 ~7 min), meio/fim ~30% mais lento.

## v9: mais coisas para fazer, variável e ~2x mais lento (o dono escolheu na pergunta)
- Traços (dados/tracos.js, save.p.tr paralelo a grade/time): Veloz, Forte, Sortudo, Guerreiro, Preguiçoso, Dourado;
  ~30% dos robôs nascem com um (criado, esteira ou junção). Valem no time (Jogo.fatorVaga) e na batalha ({n, f}).
- Equipamentos (motor/equip.js, save.equip permanente): Engrenagem (vel), Chip (valor), Trevo (x10), 5 raridades;
  1 por vaga do time; desmontar dá PH. Caem de hordas, Torre, Ataque e encomendas.
- Encomendas (motor/encomendas.js, save.p.encomendas): até 3, prazo 3-7 min, gastam robôs, pagam moedas/PH/peça.
- Aba nova OFICINA (interface/oficina_tela.js): Encomendas + Equipamentos + legenda dos traços.
- Torre Infinita (batalha.js andarTorre, save.torre): z="torre"; andar +0,9 nível; gigante a cada 5; peça a cada 5.
- Ataque à Fábrica (interface/ataque.js): chefão a cada 6-9 min (depois da 2ª horda), 60 de vida, 40 s; sabotagem
  (Jogo.multSabotagem 0,5) enquanto ele está lá e por 60 s se perder.
- Desafios ao renascer (escolhe na árvore): semesteira, caro, time3, furioso; descobertas +50% PH e +10 no robô 8.
- Dificuldade: razão 2,05 (era 2,3), upgrades tier 2+ custam 4x e +0,6 no crescimento (sim/eco7.js).

## PFT do Robot Button (v9, 2/nov, de dia): PASSOU de primeira — 3m10s, 26% engajados
- 43% saíram no 1º minuto; 17% passaram de 5 min (quem passa do começo fica). Só ~1/3 pegou o prêmio da missão 1
  (não percebiam que tinha que tocar no cartão). Horda Fácil perdia 57%, Média 74%, Difícil 70%.
## v10 (corrige o PFT)
- Missão se pega sozinha 1,1 s depois de completar (tocar ainda pega na hora). Missão 1: 10 toques.
- Hordas 0-2 com vida/ataque x0,3 / x0,3 / x0,2 (sim/novato2.js com times fracos); Torre andares 1-3 x0,5.
  poderHorda x3 (verde ~ dá para ganhar com time misturado).
- 1º minuto: dica do botão em 6 toques; esteira só anda depois do 1º robô criado e o 1º grátis cai em ~4 s
  (forma o 1º par para juntar). Teste: verif/v10.js simula um jogador novo.

## v11: raids, visuais do botão e fábrica que evolui
- RAID (interface/ataque.js no lugar do Ataque à Fábrica): sirene + aviso com contagem de 5 s, depois cena de batalha
  z="raid" com 1-5 gigantes de uma vez (Batalha.prepararRaid: força = poder dos defensores x 0,75-1,1 x RAID_K[n],
  calibrado em sim/raid.js: sem habilidades ~20-70%, usando bem ~100%). Vitória: moedas, 2 PH e 1 peça por chefão.
  Derrota ou fugir: sabotagem 60 s. Mais chefões com hordas vencidas e renascimentos.
- Visuais do botão (dados/skins.js, Pixel.botao(apertado, skin)): 11, por conquistas; Oficina > Botão.
- Cenário (interface/cenario.js): estágio = principais no nível 5 (0-7), paletas e coisas novas; 13 upgrades normais
  viram enfeites, espalhados nas zonas visíveis (fundo.js zonas: entre a grade e o time, em cima do botão e rodapé).
  Cuidado: dentro do fundo.js "t" é o relógio; tradução lá é window.t.
- v11.1 integração: viga (prateleira) em cima do botão e chão no rodapé; enfeites animam pelo nível do upgrade;
  ao comprar, a máquina cai no lugar com poeira e o nome; engrenagens giram com Jogo.velocidadeTime; telas,
  holograma e núcleo viram itens da prateleira; +10 enfeites (som, alvo, lixeira, tesla, clone, pilha, bandeira,
  presentes na esteira, Esteira Turbo, faíscas do Overclock). Sem espaço, aparecem os de nível maior.
  Celular: zona de cima entre a missão e o botão. Teste: verif/cenario.js.

## v12: roleta, árvore mais visual e celular deitado
- ROLETA (interface/roleta.js, save.roleta {gratis, anuncio, giros} em ms): botão no canto de cima à esquerda da
  tela do botão (libera no tutorial 4). 1 giro grátis a cada 10 min (conta offline); anúncio premiado gira 3 rodas
  de uma vez (espera 3 min entre anúncios; sem SDK o botão some). 8 gomos iguais, chance por peso (ROLETA_PREMIOS):
  moedas 4 min de renda, turbo +45 s, robô maxTier-1 (grade cheia: moedas), +2 PH, peça, cofre 15 min, +6 PH,
  jackpot 1 h + peça boa. Roda desenhada em 96 px e ampliada (pixel). Teste: verif/v12.js.
- Árvore: cada nó tem forma e cor pelo tipo (arvore.js visualNo: octógono = núcleo, círculo = nó comum na cor
  do efeito, hexágono = começo de galho, losango = especial), anel dourado no escolhido, quadradinhos de nível e
  nomes grandes dos 5 galhos (GALHOS_MAPA) no fundo do mapa.
- Celular deitado (altura < 540): body.baixo deixa tudo compacto (tela.js layout + bloco body.baixo no CSS);
  colunas do #app com minmax(0, 1fr). Teste: verif/deitado.js (915x412, 844x390, 667x375).

## Economia (scratchpad/sim/eco.js e eco2.js simulam um jogador médio)
- Robô nível n rende 2,3^(n-1) por apertada; criar custa 10·1,085^criados·0,88^linha.
- 1ª partida: nível 6 ~40 s, 8 (libera renascer) ~5 min, 10 ~15 min, 12 ~28 min. Depois de renascer anda bem mais rápido.
- PH: descobrir robô (1 + nível/5), monstro (1, x2 com Caçador), renascer (1,5^(maxTier-7)). Gastos só ao renascer.

## Lições do Poki (do jogo anterior)
- No Web Fit, o ~5:46 do Crazy Balls era a média do GÊNERO dele (duelo), não uma meta fixa: cada gênero tem a sua
  (a do idle/clicker vem no e-mail do Web Fit deste jogo). O PFT aprova com 3 min e ≥25% acima de 3 min.
  A conversão para jogar do jogo anterior foi boa (73%); o problema era segurar depois de 5 min.
- Teste de 500 jogadas varia ±20–25 s por sorte; noite (17–18h de Brasília) costuma dar mais que manhã.
- A média parcial sobe até o "Completed" (não parar o teste no meio: perde o resultado).
- Anúncio premiado: botão nunca verde, com ícone de vídeo; a opção normal verde do lado. Nunca travar progresso.
- Nada de anúncio no começo; commercialBreak só em pausas naturais (voltar da batalha, depois do renascimento).
- Medir 5, 10 e 15 min nos Game Events desde o 1º teste.
