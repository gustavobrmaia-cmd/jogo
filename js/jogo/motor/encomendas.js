"use strict";

// =========================
// ENCOMENDAS (v9): até 3 pedidos ao mesmo tempo, tipo "entregue 2 robôs nível 7 em 5 min". Entregar GASTA os robôs
// (da grade primeiro, depois do time) e paga bem: moedas (uns 4 min do que esses robôs fariam), pontos de habilidade
// e às vezes uma peça. Se o tempo acaba o pedido some. Um pedido novo chega a cada ~1,5 min (da partida atual).
// save.p.encomendas = [{id, n, q, ate (Date.now), ph, peca}]
// =========================
const Encomendas = (function() {
  let prox = 30;   // segundos até o próximo pedido
  function lista() { return save.p.encomendas || (save.p.encomendas = []); }
  function liberado() { return save.tutorial >= 4 && save.p.maxTier >= 4; }
  function novo() {
    const max = save.p.maxTier, n = limitar(max - 1 - Math.floor(Math.random() * 3), 2, MAX_TIER - 1);
    const q = 1 + (Math.random() < 0.4 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0);
    const min = 3 + Math.floor(Math.random() * 5);
    lista().push({ id: Date.now() + Math.floor(Math.random() * 1000), n: n, q: q, ate: Date.now() + min * 60000,
      ph: q >= 2 ? 2 : 1, peca: Math.random() < 0.35 });
    Jogo.avisar("encomenda");
  }
  function premio(e) { return Math.round(valorRobo(e.n) * e.q * 250 * Jogo.multMoedas()); }
  function tenho(n) {
    let c = 0;
    save.p.grade.forEach(function(x) { if (x === n) c++; }); save.p.time.forEach(function(x) { if (x === n) c++; });
    return c;
  }
  function pode(e) { return tenho(e.n) >= e.q; }
  function entregar(id) {
    const l = lista(), e = l.filter(function(x) { return x.id === id; })[0];
    if (!e || !pode(e) || Date.now() > e.ate) return null;
    let falta = e.q;
    ["grade", "time"].forEach(function(nome) {
      save.p[nome].forEach(function(x, i) { if (falta > 0 && x === e.n) { save.p[nome][i] = 0; Jogo.poeTr(nome, i, ""); falta--; } });
    });
    const r = { moedas: premio(e), ph: e.ph, peca: null };
    save.p.moedas += r.moedas; save.ph += r.ph;
    if (e.peca) r.peca = Equip.ganhar(e.n / 30);
    save.p.encomendas = l.filter(function(x) { return x !== e; });
    save.encomendasFeitas = (save.encomendasFeitas || 0) + 1;
    Poki.medir("order", "n" + e.n + "-q" + e.q, "complete");
    Jogo.avisar("mudou");
    salvar();
    return r;
  }
  function passo(dt) {
    if (!liberado()) return;
    const agora = Date.now(), antes = lista().length;
    save.p.encomendas = lista().filter(function(e) { return e.ate > agora; });
    if (save.p.encomendas.length !== antes) Jogo.avisar("encomenda");
    if (lista().length < 3) { prox -= dt; if (prox <= 0) { prox = 75 + Math.random() * 45; novo(); } }
  }
  function prontas() { return lista().some(pode); }
  return { lista: lista, passo: passo, entregar: entregar, pode: pode, tenho: tenho, premio: premio, prontas: prontas, liberado: liberado };
})();
