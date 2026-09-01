const state = { data: null, spotWindow: "1", period: "core", expanded: null };
const $ = (selector) => document.querySelector(selector);
const all = (selector) => [...document.querySelectorAll(selector)];
const num = (value, digits = 1) => Number(value || 0).toLocaleString("zh-TW", { maximumFractionDigits: digits });
const signed = (value, unit = "張") => `${Number(value) > 0 ? "+" : Number(value) < 0 ? "−" : ""}${num(Math.abs(Number(value)), 2)} ${unit}`;
const money = (value) => {
  const amount = Math.abs(Number(value || 0));
  const sign = Number(value) > 0 ? "+" : Number(value) < 0 ? "−" : "";
  if (amount >= 1e8) return `${sign}${num(amount / 1e8, 2)} 億`;
  if (amount >= 1e4) return `${sign}${num(amount / 1e4, 1)} 萬`;
  return `${sign}${num(amount, 0)}`;
};
const date = (value = "") => value.length === 8 ? `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6)}` : value;
const trendClass = (value) => Number(value) >= 0 ? "up" : "down";

function renderSpotlight() {
  const spot = state.data.spotlight_broker;
  if (!spot) {
    $("#spot-name").textContent = "本期沒有 9359 成交資料";
    return;
  }
  const windowData = spot.windows?.[state.spotWindow] || {};
  $("#spot-name").textContent = spot.broker_name || "分點 9359";
  $("#spot-state").textContent = spot.status_label || "觀察";
  $("#spot-rank").textContent = `#${spot.rank}`;
  $("#spot-core").textContent = spot.is_core ? "目前進入核心前 20，仍僅代表行為排名。" : "目前未進核心前 20，維持獨立觀察。";
  $("#spot-net").textContent = signed(windowData.net_lots);
  $("#spot-net").className = trendClass(windowData.net_lots);
  $("#spot-buy").textContent = `${num(windowData.buy_lots, 2)} 張`;
  $("#spot-sell").textContent = `${num(windowData.sell_lots, 2)} 張`;
  const total = Math.abs(Number(windowData.buy_lots || 0)) + Math.abs(Number(windowData.sell_lots || 0));
  $("#spot-bar").style.width = `${total ? Math.max(4, Number(windowData.buy_lots || 0) / total * 100) : 0}%`;
  $("#spot-capital").textContent = money(spot.cumulative_net_amount);
  $("#spot-capital").className = trendClass(spot.cumulative_net_amount);
  $("#spot-inventory").textContent = `${num(spot.inventory_lots, 2)} 張`;
  $("#spot-retention").textContent = `留存率 ${num(Number(spot.inventory_retention || 0) * 100, 1)}%`;
  $("#spot-cost").textContent = spot.inventory_cost ? `${num(spot.inventory_cost, 2)} 元` : "樣本不足";
  $("#spot-cost-gap").textContent = spot.unrealized_pct == null ? "無法估算現價差" : `現價較成本 ${signed(spot.unrealized_pct, "%")}`;
  $("#spot-active").textContent = `${spot.active_sessions} / ${spot.history_sessions} 日`;
  $("#spot-confidence").textContent = `證據成熟度 ${num(Number(spot.evidence_maturity || 0) * 100, 0)}%`;
}

function brokerCard(broker, index) {
  const open = state.expanded === broker.broker_id;
  const isSpot = broker.broker_id === "9359";
  return `<button class="broker-card ${isSpot ? "spot" : ""}" data-broker="${broker.broker_id}">
    <span class="rank">${String(index + 1).padStart(2, "0")}</span>
    <span class="name"><b>${broker.broker_name}${isSpot ? " · 9359" : ""}</b><small>${broker.broker_id}</small></span>
    <span class="cell"><small>期間淨額</small><b class="${trendClass(broker.net_amount)}">${money(broker.net_amount)}</b></span>
    <span class="cell"><small>期間淨張數</small><b class="${trendClass(broker.net_lots)}">${signed(broker.net_lots)}</b></span>
    <span class="cell"><small>推估成本</small><b>${broker.inventory_cost ? num(broker.inventory_cost, 2) : "—"}</b></span>
    <span class="arrow">${open ? "−" : "+"}</span>
    ${open ? `<span class="broker-detail"><span>累積淨投入<b>${money(broker.cumulative_net_amount)}</b></span><span>推估庫存<b>${num(broker.inventory_lots, 2)} 張</b></span><span>活躍交易日<b>${broker.active_sessions}/${broker.history_sessions}</b></span><span>方向命中率<b>${broker.win_rate_qualified ? `${num(broker.win_rate)}%` : "樣本累積中"}</b></span></span>` : ""}
  </button>`;
}

function renderBrokers() {
  const windowData = state.data.flow_windows?.[state.period] || { brokers: [] };
  let brokers = [...(windowData.brokers || [])];
  if (state.period !== "core") brokers.sort((a, b) => Number(b.net_amount) - Number(a.net_amount));
  $("#broker-list").innerHTML = brokers.length ? brokers.map(brokerCard).join("") : `<div class="empty">這段期間沒有可顯示的核心分點資料。</div>`;
  all(".broker-card").forEach((button) => button.addEventListener("click", () => {
    state.expanded = state.expanded === button.dataset.broker ? null : button.dataset.broker;
    renderBrokers();
  }));
}

function renderImpact() {
  const rows = state.data.impact_ranking || [];
  $("#impact-list").innerHTML = rows.length ? rows.map((row, index) => `<article>
    <span>${String(index + 1).padStart(2, "0")}</span>
    <div class="impact-main"><b>${row.broker_name}</b><small>${row.broker_id} · ${row.samples} 個樣本 · 隔日方向命中 ${Math.round(Number(row.direction_accuracy || 0) * 100)}%</small>
      <div class="today-flow"><span>今日買進 <b>${num(row.today_buy_lots, 3)} 張</b></span><span>今日賣出 <b>${num(row.today_sell_lots, 3)} 張</b></span><span>今日淨額 <b class="${trendClass(row.today_net_lots)}">${signed(row.today_net_lots)}</b></span></div>
    </div>
    <div class="impact-score"><small>影響分數</small><strong>${num(row.impact_score)}</strong></div>
  </article>`).join("") : `<div class="empty">影響力樣本尚未達標。</div>`;
}

function render(data) {
  state.data = data;
  const market = data.market || {};
  const change = market.weighted_avg_change;
  $("#data-status").textContent = `資料日 ${date(data.as_of)}`;
  $("#as-of").textContent = date(data.as_of);
  $("#price").textContent = market.weighted_avg_price == null ? "—" : num(market.weighted_avg_price, 2);
  $("#change").textContent = change == null ? "興櫃加權均價" : `${Number(change) >= 0 ? "▲" : "▼"} ${num(Math.abs(change), 2)} · ${num(Math.abs(market.weighted_avg_change_pct), 2)}%`;
  $("#change").className = `change ${trendClass(change)}`;
  $("#score").textContent = data.signal?.score ?? "—";
  $("#signal").textContent = data.signal?.label || "資料不足";
  $("#volume").textContent = `${num(market.volume_lots, 0)} 張`;
  $("#concentration").textContent = `${signed(market.concentration_lots)}`;
  $("#concentration").className = trendClass(market.concentration_lots);
  $("#quality").textContent = data.data_mode === "live" ? "行情 / 分點齊全" : "非即時資料";
  renderSpotlight(); renderBrokers(); renderImpact();
}

all("[data-window]").forEach((button) => button.addEventListener("click", () => {
  state.spotWindow = button.dataset.window;
  all("[data-window]").forEach((item) => item.classList.toggle("active", item === button));
  renderSpotlight();
}));
all("[data-period]").forEach((button) => button.addEventListener("click", () => {
  state.period = button.dataset.period; state.expanded = null;
  all("[data-period]").forEach((item) => item.classList.toggle("active", item === button));
  renderBrokers();
}));

fetch("./data/snapshot.json", { cache: "no-store" })
  .then((response) => { if (!response.ok) throw new Error("snapshot unavailable"); return response.json(); })
  .then(render)
  .catch(() => {
    $("#data-status").textContent = "資料載入失敗";
    $("#signal").textContent = "請確認 data/snapshot.json";
    $("#spot-name").textContent = "無法讀取 9359 快照";
  });
