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
- Preço de criar robô: o dono mandou deixar como está.
- Regra do dono: o que vier com "sei lá" na mensagem, perguntar ou sugerir em vez de fazer.

## v3.1
- Animação de curto-circuito ao renascer (js/interface/curto.js, canvas #curto por cima de tudo): o painel fecha,
  a máquina pifa (tremedeira, faíscas, fumaça, raios, alarme, música abafada), carrega e explode; no auge do clarão
  chama Jogo.renascer() + ArvoreTela.abrir(true). 3 variações em rodízio (save.renascimentos % 3): engrenagens,
  botão vermelho, pane elétrica geral. O fundo tem Fundo.pane {vel, fumaca, luzes} e Fundo.pontos().

## Economia (scratchpad/sim/eco.js e eco2.js simulam um jogador médio)
- Robô nível n rende 2,3^(n-1) por apertada; criar custa 10·1,085^criados·0,88^linha.
- 1ª partida: nível 6 ~40 s, 8 (libera renascer) ~5 min, 10 ~15 min, 12 ~28 min. Depois de renascer anda bem mais rápido.
- PH: descobrir robô (1 + nível/5), monstro (1, x2 com Caçador), renascer (1,5^(maxTier-7)). Gastos só ao renascer.

## Lições do Poki (do jogo anterior)
- O **Web Fit** pede ~5:46 de média (o PFT aprova com 3 min e ≥25% acima de 3 min — não confundir).
  A conversão para jogar do jogo anterior foi boa (73%); o problema era segurar depois de 5 min.
- Teste de 500 jogadas varia ±20–25 s por sorte; noite (17–18h de Brasília) costuma dar mais que manhã.
- A média parcial sobe até o "Completed" (não parar o teste no meio: perde o resultado).
- Anúncio premiado: botão nunca verde, com ícone de vídeo; a opção normal verde do lado. Nunca travar progresso.
- Nada de anúncio no começo; commercialBreak só em pausas naturais (voltar da batalha, depois do renascimento).
- Medir 5, 10 e 15 min nos Game Events desde o 1º teste.
