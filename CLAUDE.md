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

## Economia (scratchpad/sim/eco.js simula um jogador médio)
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
