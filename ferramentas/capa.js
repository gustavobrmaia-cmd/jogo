// capa do Robot Button: desenhada em 256x256 com os sprites do jogo e ampliada 4x (pixel nítido); título em cima
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[3];
(async () => { const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 720 } }); const erros = [];
  pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(process.argv[2]); await pg.waitForTimeout(1500);
  const res = await pg.evaluate(async () => {
    await document.fonts.load('80px Pixelify'); await document.fonts.ready;
    const L = 256, c = document.createElement('canvas'); c.width = c.height = L; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const rt = (x, y, w, h, cor) => { g.fillStyle = cor; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    // fundo: parede de chapas da fábrica
    rt(0, 0, L, L, '#171030');
    for (let x = 0; x < L; x += 32) for (let y = 0; y < L; y += 24) { rt(x, y, 32, 24, ((x + y) / 8) % 2 ? '#1c1440' : '#1a1238'); rt(x, y, 32, 1, '#2a2058'); rt(x + 2, y + 2, 1, 1, '#3a2f6e'); rt(x + 29, y + 2, 1, 1, '#3a2f6e'); }
    // raios de luz saindo do botão (pontilhados)
    const cx = 128, cy = 168;
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      const a = Math.atan2(y - cy, x - cx), raio = (Math.floor((a + Math.PI) / (Math.PI / 10)) % 2 === 0), d = Math.hypot(x - cx, y - cy);
      const lim = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16, k = Math.max(0, 1 - d / 190);
      if (raio && k * 0.8 > lim) rt(x, y, 1, 1, 'rgba(255,200,120,0.10)');
      const brilho = Math.max(0, 1 - d / 110);
      if (brilho > lim) rt(x, y, 1, 1, brilho - lim > 0.35 ? 'rgba(255,70,80,0.28)' : 'rgba(255,110,90,0.14)');
    }
    // engrenagens grandes atrás
    g.drawImage(Pixel.engrenagem(34, 16, 1, 6, 'ouro'), 0 - 22, 30);
    g.drawImage(Pixel.engrenagem(26, 14, 3, 6, 'escuro'), 196, 40);
    g.drawImage(Pixel.engrenagem(16, 10, 2, 6), 214, 6);
    // cano no alto
    rt(0, 12, L, 6, '#3d4a66'); rt(0, 12, L, 2, '#5d6c8f'); rt(0, 17, L, 1, '#26304a'); for (let x = 20; x < L; x += 44) rt(x, 11, 4, 8, '#53627f');
    // chão com faixa de perigo
    rt(0, 214, L, 42, '#2b2a3d'); for (let x = 0; x < L; x++) for (let y = 214; y < 218; y++) if ((x + y) % 8 < 4) rt(x, y, 1, 1, '#ffcc33'); else rt(x, y, 1, 1, '#241a10');
    for (let x = 0; x < L; x += 24) rt(x, 218, 1, 38, '#22212f');
    // sombra do botão e o botão (64 -> 128)
    g.globalAlpha = 0.45; rt(cx - 58, 222, 116, 8, '#000'); g.globalAlpha = 1;
    g.drawImage(Pixel.botao(false), cx - 64, 104, 128, 128);
    // robôs em volta (sprites 48x48) com sombra
    const robo = (n, x, y, esp) => { g.globalAlpha = 0.4; rt(x + 10, y + 46, 28, 3, '#000'); g.globalAlpha = 1; const s = Pixel.robo(n); if (esp) { g.save(); g.translate(x + 48, y); g.scale(-1, 1); g.drawImage(s, 0, 0); g.restore(); } else g.drawImage(s, x, y); };
    robo(9, 6, 170); robo(14, 46, 178); robo(5, 162, 178, true); robo(18, 204, 168, true);
    // robozão pulando para apertar o botão (24, com asas) — em cima, 2x
    // robô (nível 24, com asas) pisando no botão: linhas de impacto e estrelinhas
    g.drawImage(Pixel.robo(24), cx - 24, 92);
    [[-40, 136, -54, 132], [-38, 144, -56, 146], [40, 136, 54, 132], [38, 144, 56, 146]].forEach(([x1, y1, x2, y2]) => { g.strokeStyle = '#fff6c2'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + x1, y1); g.lineTo(cx + x2, y2); g.stroke(); });
    [[cx - 46, 120], [cx + 46, 118]].forEach(([x, y]) => { rt(x, y - 3, 1, 7, '#ffe066'); rt(x - 3, y, 7, 1, '#ffe066'); });
    rt(cx - 4, 82, 2, 6, '#c9d0e3'); rt(cx + 3, 80, 2, 8, '#c9d0e3'); rt(cx - 10, 84, 2, 4, '#c9d0e3');   // linhas de movimento (desceu agora)
    // robô dourado voando
    g.save(); g.filter = 'sepia(1) saturate(4) hue-rotate(-8deg) brightness(1.18)'; g.drawImage(Pixel.robo(22), 196, 84); g.restore();
    // moedas voando e brilhos
    const moeda = Pixel.icone('moeda');
    [[34, 96], [66, 130], [190, 140], [214, 132], [78, 80], [166, 74], [20, 140], [236, 200], [60, 52]].forEach(([x, y], i) => g.drawImage(moeda, x, y, i % 3 ? 16 : 24, i % 3 ? 16 : 24));
    [[48, 60], [210, 70], [140, 40], [80, 110], [176, 112], [28, 120]].forEach(([x, y]) => { rt(x, y - 2, 1, 5, '#fff6c2'); rt(x - 2, y, 5, 1, '#fff6c2'); });
    // vinheta pontilhada nas bordas
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      const lim = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16, e = Math.max(0, Math.min(1, (Math.hypot(x - 128, (y - 140) * 1.1) / 182 - 0.62) * 2.4));
      if (e > lim) rt(x, y, 1, 1, 'rgba(6,3,16,0.5)');
    }
    // amplia 4x
    const S = 1024, big = document.createElement('canvas'); big.width = big.height = S; const B = big.getContext('2d'); B.imageSmoothingEnabled = false;
    B.drawImage(c, 0, 0, S, S);
    const semTexto = big.toDataURL('image/png');
    // título: ROBOT (dourado) BUTTON (vermelho), contorno grosso e sombra
    const titulo = (txt, y, tam, c1, c2) => {
      B.font = tam + 'px Pixelify'; B.textAlign = 'center'; B.textBaseline = 'middle';
      B.lineJoin = 'round';
      B.fillStyle = '#0e0820'; B.fillText(txt, S / 2 + 10, y + 12);
      B.lineWidth = 26; B.strokeStyle = '#0e0820'; B.strokeText(txt, S / 2, y);
      const gr = B.createLinearGradient(0, y - tam / 2, 0, y + tam / 2); gr.addColorStop(0, c1); gr.addColorStop(0.55, c1); gr.addColorStop(0.56, c2); gr.addColorStop(1, c2);
      B.fillStyle = gr; B.fillText(txt, S / 2, y);
      B.globalAlpha = 0.5; B.fillStyle = '#ffffff'; B.fillRect(0, 0, 0, 0); B.globalAlpha = 1;
    };
    titulo('ROBOT', 104, 150, '#ffe066', '#ffb02e');
    titulo('BUTTON', 228, 132, '#ff6b78', '#d8243a');
    const comTexto = big.toDataURL('image/png');
    // 628x628 (suave)
    const m = document.createElement('canvas'); m.width = m.height = 628; const M = m.getContext('2d'); M.imageSmoothingQuality = 'high'; M.drawImage(big, 0, 0, 628, 628);
    const c628 = m.toDataURL('image/png');
    const m2 = document.createElement('canvas'); m2.width = m2.height = 628; const M2 = m2.getContext('2d'); M2.imageSmoothingQuality = 'high';
    const im = new Image(); im.src = semTexto; await im.decode(); M2.drawImage(im, 0, 0, 628, 628);
    return { semTexto, comTexto, c628, s628: m2.toDataURL('image/png') };
  });
  const salvar = (nome, url) => fs.writeFileSync(OUT + '/' + nome, Buffer.from(url.split(',')[1], 'base64'));
  salvar('capa-1024.png', res.comTexto); salvar('capa-628.png', res.c628); salvar('capa-sem-texto-1024.png', res.semTexto); salvar('capa-sem-texto-628.png', res.s628);
  console.log('erros', erros); await br.close(); })();
