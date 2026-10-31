"use strict";

// =========================
// MISSÕES: uma de cada vez, sempre na tela (cartão #missao), para o jogador saber o que fazer a seguir.
// As primeiras são fixas e ensinam o jogo (botão, criar, juntar, time, upgrades, robô dourado, batalha, monstro,
// renascer); depois vêm missões geradas que não acabam nunca. Completou -> o cartão brilha -> tocar pega o prêmio.
// Tipos de contador (contam a partir do começo da missão): toques, criar, juntar, ouro, monstro.
// Tipos de estado (olham o jogo agora): time, tier, up, uptier, horda, renascer.
// =========================
const MISSOES = [
  { tipo: "toques", alvo: 15 },
  { tipo: "criar", alvo: 3 },
  { tipo: "juntar", alvo: 1 },
  { tipo: "time", alvo: 1 },
  { tipo: "tier", alvo: 4 },
  { tipo: "up", id: "dedo", alvo: 1 },
  { tipo: "time", alvo: 3 },
  { tipo: "tier", alvo: 5 },
  { tipo: "ouro", alvo: 1 },
  { tipo: "horda", alvo: 1, ph: 2 },
  { tipo: "juntar", alvo: 15 },
  { tipo: "tier", alvo: 6 },
  { tipo: "uptier", alvo: 2 },
  { tipo: "monstro", alvo: 1 },
  { tipo: "tier", alvo: 7 },
  { tipo: "horda", alvo: 2, ph: 2 },
  { tipo: "time", alvo: 5 },
  { tipo: "tier", alvo: 8, ph: 2 },
  { tipo: "renascer", alvo: 1, ph: 5 }
];

const Missoes = (function() {
  const CONTADOR = {
    toques: function() { return save.stats.toques; },
    criar: function() { return save.stats.criados || 0; },
    juntar: function() { return save.stats.juncoes; },
    ouro: function() { return save.stats.ouros || 0; },
    monstro: function() { return save.stats.invasores || 0; }
  };
  const ESTADO = {
    time: function() { return save.p.time.filter(Boolean).length; },
    tier: function() { return save.p.maxTier; },
    up: function(m) { return nivelUp(m.id); },
    uptier: function(m) { return Jogo.tierAberto(m.alvo) ? m.alvo : m.alvo - 1; },
    horda: function() { return save.hordasVencidas; },
    renascer: function() { return save.renascimentos; }
  };

  // missão n: fixa ou gerada (as geradas giram entre 6 tipos e crescem devagar)
  function gerar(n) {
    if (n < MISSOES.length) return Object.assign({}, MISSOES[n]);
    const k = n - MISSOES.length, c = Math.min(k, 30);
    switch (k % 6) {
      case 0: return { tipo: "tier", alvo: Math.min(MAX_TIER, save.p.maxTier + 1), ph: 1 };
      case 1: return { tipo: "juntar", alvo: 20 + 5 * c };
      case 2: return save.hordasVencidas < HORDAS.length ? { tipo: "horda", alvo: save.hordasVencidas + 1, ph: 2 } : { tipo: "ouro", alvo: 2 };
      case 3: return { tipo: "criar", alvo: 20 + 5 * c };
      case 4: return k % 12 < 6 ? { tipo: "ouro", alvo: 1 } : { tipo: "monstro", alvo: 1 };
      default: {
        // melhorar o primeiro upgrade que ainda dá (tiers abertos)
        const u = UPGRADES.find(function(u) { return Jogo.tierAberto(u.tier) && nivelUp(u.id) < NIVEIS_UPGRADE; });
        return u ? { tipo: "up", id: u.id, alvo: nivelUp(u.id) + 1 } : { tipo: "tier", alvo: Math.min(MAX_TIER, save.p.maxTier + 1), ph: 1 };
      }
    }
  }
  function comecar(n) {
    const m = gerar(n);
    m.n = n;
    if (CONTADOR[m.tipo]) m.base = CONTADOR[m.tipo]();
    save.missao = m;
  }
  function atual() { if (!save.missao || typeof save.missao.n !== "number") comecar(0); return save.missao; }
  function progresso(m) {
    m = m || atual();
    const v = CONTADOR[m.tipo] ? CONTADOR[m.tipo]() - (m.base || 0) : ESTADO[m.tipo] ? ESTADO[m.tipo](m) : 0;
    return Math.max(0, Math.min(m.alvo, v));
  }
  function completa() { const m = atual(); return progresso(m) >= m.alvo; }
  function premio() {
    const base = Math.max(Jogo.custoCriar() * 3, Jogo.prodTime() * 30 + Jogo.valorToque() * 15);
    return Math.round(base * (1 + 0.1 * Math.min(atual().n, 10)));
  }
  function texto(m) {
    switch (m.tipo) {
      case "toques": return t("m_toques", m.alvo);
      case "criar": return t("m_criar", m.alvo);
      case "juntar": return m.alvo === 1 ? t("m_juntar1") : t("m_juntar", m.alvo);
      case "time": return t("m_time", m.alvo);
      case "tier": return t("m_tier", m.alvo);
      case "up": return t("m_up", t("up_" + m.id), m.alvo);
      case "uptier": return t("m_uptier", m.alvo);
      case "horda": return t("m_horda", t("z_" + (m.alvo - 1)));
      case "renascer": return t("m_renascer");
      case "ouro": return t("m_ouro", m.alvo);
      case "monstro": return t("m_monstro", m.alvo);
    }
    return "";
  }

  // ---------- cartão na tela ----------
  const card = el("missao"), cache = {};
  function escrever(id, v, html) { if (cache[id] !== v) { cache[id] = v; if (html) el(id).innerHTML = v; else el(id).textContent = v; } }
  function atualizar() {
    const m = atual(), p = progresso(m), ok = p >= m.alvo;
    const mostraNum = m.alvo > 1 && m.tipo !== "uptier" && m.tipo !== "horda" && m.tipo !== "renascer";
    escrever("mTitulo", ok ? t("m_pegar") : t("missao") + " " + (m.n + 1));
    escrever("mTexto", texto(m) + (mostraNum && !ok ? "  " + fmt(p) + "/" + fmt(m.alvo) : ""));
    el("mBarra").style.width = Math.round(p / m.alvo * 100) + "%";
    escrever("mPremio", "+" + fmt(premio()) + (m.ph ? " <i class='ico' data-ico='ph'></i>+" + m.ph : ""), true);
    if (cache.ico !== m.ph) { cache.ico = m.ph; Paineis.preencherIcones(card); }
    if (cache.ok !== ok) {
      cache.ok = ok; card.classList.toggle("pronta", ok);
      if (ok) { Som.som("compra"); vibrar(20); }
    }
  }
  function pegar() {
    if (!completa()) { card.classList.remove("cutuca"); void card.offsetWidth; card.classList.add("cutuca"); return; }
    const m = atual(), v = premio();
    save.p.moedas += v;
    if (m.ph) save.ph += m.ph;
    Poki.medir("mission", "m-" + (m.n + 1), "complete");
    const r = card.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    Fx.moedas(x, y, 10); Fx.faiscas(x, y, "#3ccf6e", 14);
    Fx.numero(x, y + 30, "+" + fmt(v), "#ffcc33", 34);
    Som.som("missao");
    vibrar(30);
    card.classList.remove("pegou"); void card.offsetWidth; card.classList.add("pegou");
    comecar(m.n + 1);
    cache.ok = undefined;
    atualizar();
    salvar();
  }
  card.addEventListener("click", pegar);
  return { atual: atual, progresso: progresso, completa: completa, atualizar: atualizar, texto: texto };
})();
