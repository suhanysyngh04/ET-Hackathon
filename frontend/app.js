function dismissCover() {
  const cover = document.getElementById("coverSlide");
  if (cover.classList.contains("dismissed")) return;
  cover.classList.add("dismissed");
  setTimeout(() => { cover.style.display = "none"; }, 750);
}
document.getElementById("coverSlide").addEventListener("click", dismissCover);
document.getElementById("coverEnter").addEventListener("click", (e) => { e.stopPropagation(); dismissCover(); });
document.addEventListener("keydown", dismissCover, { once: true });

const BASE = baseline();
let mode = "timeline";
let CURRENT = { result: null, event: null, reserves: null };

const corridorOf = (source) => SOURCES[source].corridor;

const CORRIDOR_META = {
  hormuz: { label: "Strait of Hormuz", baseFreight: CORRIDORS.hormuz.base_freight, days: CORRIDORS.hormuz.transit_days },
  cape_suez: { label: "Cape / Suez", baseFreight: CORRIDORS.cape_suez.base_freight, days: CORRIDORS.cape_suez.transit_days },
  atlantic: { label: "Atlantic Basin", baseFreight: CORRIDORS.atlantic.base_freight, days: CORRIDORS.atlantic.transit_days },
};

function renderCorridorLedger(shocks) {
  const rows = ["hormuz", "cape_suez", "atlantic"].map((c) => {
    const shock = (shocks && shocks[c]) || 0;
    const meta = CORRIDOR_META[c];
    const freight = meta.baseFreight * (1 + shock * 3.5);
    const riskPct = Math.round(shock * 100);
    const riskClass = riskPct > 60 ? "down" : (riskPct > 20 ? "" : "up");
    return `
      <div class="ledger-row">
        <div class="ledger-name">${meta.label}</div>
        <div class="ledger-bar-track"><div class="ledger-bar-fill" style="width:${riskPct}%"></div></div>
        <div class="ledger-val">${riskPct}%</div>
        <div class="ledger-freight">$${freight.toFixed(2)}/bbl</div>
      </div>`;
  }).join("");
  document.getElementById("corridorLedger").innerHTML = rows;
}

function renderRefineryUtil(result) {
  const totals = {};
  for (const r in REFINERIES) totals[r] = 0;
  result.byRoute.forEach((f) => { totals[f.refinery] = (totals[f.refinery] || 0) + f.bpd; });

  const rows = Object.entries(REFINERIES).map(([key, ref]) => {
    const used = totals[key] || 0;
    const pct = Math.min(100, (100 * used) / ref.capacity_bpd);
    const tight = pct > 95;
    return `
      <div class="ledger-row refinery-row">
        <div class="ledger-name">${key.charAt(0).toUpperCase() + key.slice(1)}<span class="refinery-port">${ref.port}</span></div>
        <div class="ledger-bar-track"><div class="ledger-bar-fill refinery-fill${tight ? " tight" : ""}" style="width:${pct}%"></div></div>
        <div class="ledger-val">${pct.toFixed(0)}%</div>
        <div class="ledger-freight">${fmtBpd(used)} bpd</div>
      </div>`;
  }).join("");
  document.getElementById("refineryUtil").innerHTML = rows;
}

function renderCorridorRoutes() {
  const routes = [
    { name: "Strait of Hormuz", days: CORRIDORS.hormuz.transit_days, color: "#8B9DAA", desc: "Saudi Arabia, Iraq, UAE, Kuwait" },
    { name: "Cape / Suez", days: CORRIDORS.cape_suez.transit_days, color: "#C1502E", desc: "Russia" },
    { name: "Atlantic Basin", days: CORRIDORS.atlantic.transit_days, color: "#A6791F", desc: "USA, Venezuela, Nigeria, Brazil" },
  ];
  const maxDays = Math.max(...routes.map((r) => r.days));
  const rows = routes.map((r) => {
    const w = (r.days / maxDays) * 100;
    return `
      <div class="route-row">
        <div class="route-head">
          <span class="route-name">${r.name}</span>
          <span class="route-days">${r.days} days transit</span>
        </div>
        <div class="route-track"><div class="route-fill" style="width:${w}%;background:${r.color}"></div></div>
        <div class="route-desc">${r.desc}</div>
      </div>`;
  }).join("");
  document.getElementById("corridorRoutes").innerHTML = rows;
}
renderCorridorRoutes();

function renderTrajectory() {
  const points = EVENTS.map((e) => solve(e.corridor_shocks).avgCostPerBbl);
  const maxC = Math.max(...points, BASE.avgCostPerBbl);
  const minC = Math.min(...points, BASE.avgCostPerBbl);
  const w = 280, h = 90, pad = 6;
  const range = maxC - minC || 1;
  const xStep = (w - pad * 2) / (points.length - 1);
  const coords = points.map((c, i) => {
    const x = pad + i * xStep;
    const y = h - pad - ((c - minC) / range) * (h - pad * 2);
    return [x, y];
  });
  const pathD = coords.map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`)).join(" ");
  const dots = coords.map(([x, y], i) =>
    `<circle cx="${x}" cy="${y}" r="${i === window.__activeEventIdx ? 4 : 2.4}" fill="${i === window.__activeEventIdx ? "#C1502E" : "#9C8F6E"}"/>`
  ).join("");
  document.getElementById("trajectorySvg").innerHTML = `<path d="${pathD}" fill="none" stroke="#C1502E" stroke-width="1.6"/>${dots}`;
}

function renderNetworkMini(result) {
  const active = new Set(Object.keys(result.bySource).filter((s) => result.bySource[s] > 1000));
  const lines = NETWORK_PINS.map(([name, x, y]) => {
    const key = name.toLowerCase().replace(/ /g, "_");
    const isActive = active.has(key);
    return `<line x1="${x}" y1="${y}" x2="${INDIA_PIN[0]}" y2="${INDIA_PIN[1]}" stroke="${isActive ? "#C1502E" : "#C9BCA0"}" stroke-width="${isActive ? 1.4 : 0.8}" stroke-dasharray="${isActive ? "0" : "2,2"}" opacity="${isActive ? 0.9 : 0.45}"/>`;
  }).join("");
  const dots = NETWORK_PINS.map(([name, x, y]) => {
    const key = name.toLowerCase().replace(/ /g, "_");
    const isActive = active.has(key);
    return `<circle cx="${x}" cy="${y}" r="${isActive ? 4 : 2.6}" fill="${isActive ? "#C1502E" : "#9C8F6E"}"/>`;
  }).join("");
  document.getElementById("networkMiniSvg").innerHTML =
    `<path d="${WORLD_PATH_D}" fill="#1C3144" opacity="0.5" fill-rule="evenodd"/>${lines}${dots}<circle cx="${INDIA_PIN[0]}" cy="${INDIA_PIN[1]}" r="5.5" fill="#1C3144"/>`;
}

function render(result, event) {
  document.getElementById("kpiFulfillment").textContent = result.fulfillmentPct.toFixed(1) + "%";
  const fulfillEl = document.getElementById("kpiFulfillment");
  fulfillEl.className = "kpi-val " + (result.fulfillmentPct < 95 ? "warn" : "ok");

  document.getElementById("kpiCost").textContent = result.avgCostPerBbl ? "$" + result.avgCostPerBbl.toFixed(2) : "—";
  const baseCost = BASE.avgCostPerBbl || 0;
  const costDelta = result.avgCostPerBbl ? result.avgCostPerBbl - baseCost : 0;
  document.getElementById("kpiCostSub").textContent = costDelta > 0.1
    ? `+$${costDelta.toFixed(2)} vs baseline`
    : "at baseline";

  const hormuzSources = ["saudi_arabia", "iraq", "uae", "kuwait"];
  const hormuzBpd = hormuzSources.reduce((a, s) => a + (result.bySource[s] || 0), 0);
  const hormuzPct = (100 * hormuzBpd) / result.totalBpd;
  const baseHormuzBpd = hormuzSources.reduce((a, s) => a + (BASE.bySource[s] || 0), 0);
  const baseHormuzPct = (100 * baseHormuzBpd) / BASE.totalBpd;
  document.getElementById("kpiGap").textContent = hormuzPct.toFixed(1) + "%";
  const gapEl = document.getElementById("kpiGap");
  gapEl.className = "kpi-val " + (hormuzPct < baseHormuzPct * 0.7 ? "warn" : "ok");
  document.getElementById("kpiGapSub").textContent = `vs ${baseHormuzPct.toFixed(1)}% at baseline`;

  const sorted = Object.entries(result.bySource).sort((a, b) => b[1] - a[1]);
  const rowsHtml = sorted.map(([source, bpd]) => {
    const corridor = corridorOf(source);
    const pct = (100 * bpd) / result.totalBpd;
    const base = BASE.bySource[source] || 0;
    const delta = bpd - base;
    const deltaPct = base > 0 ? (100 * delta) / base : (bpd > 0 ? 100 : 0);
    const deltaClass = delta > base * 0.05 ? "up" : (delta < -base * 0.05 ? "down" : "");
    const deltaSign = delta >= 0 ? "+" : "";
    const deltaText = Math.abs(deltaPct) > 1 ? `${deltaSign}${deltaPct.toFixed(0)}%` : "—";
    return `
      <div class="flow-row">
        <div class="name">${source.replace("_", " ")}</div>
        <div class="bar-track"><div class="bar-fill ${corridor}" style="width:${pct}%"></div></div>
        <div>
          <div class="val">${fmtBpd(bpd)}</div>
          <div class="delta ${deltaClass}">${deltaText}</div>
        </div>
      </div>`;
  }).join("");
  document.getElementById("flowRows").innerHTML = rowsHtml;

  const hormuzShockLevel = (event.corridor_shocks && event.corridor_shocks.hormuz) || 0;
  const hormuzBaselineCapacity = ["saudi_arabia", "iraq", "uae", "kuwait"].reduce((a, s) => a + SOURCES[s].max_bpd, 0);
  const lostCapacityIfNoReroute = hormuzBaselineCapacity * hormuzShockLevel;
  const reserves = drawdownPlan(lostCapacityIfNoReroute, 30);
  const reserveFill = document.getElementById("reserveFill");
  const reservePctRemaining = reserves.drawNeeded
    ? Math.max(0, (100 * reserves.sprRemainingDays) / 9.5)
    : 100;
  reserveFill.style.width = reservePctRemaining + "%";
  reserveFill.className = "reserve-bar-fill" + (reservePctRemaining < 40 ? " tight" : "");
  document.getElementById("reserveTrack").classList.toggle("is-empty", reservePctRemaining < 3);
  document.getElementById("reserveDays").textContent = reserves.drawNeeded
    ? `${reserves.sprRemainingDays} of 9.5 days cover remaining`
    : "9.5 days cover, no draw needed";
  document.getElementById("reserveStatus").textContent = reserves.drawNeeded
    ? (reserves.sufficient ? "Reserve sufficient" : "Reserve insufficient alone")
    : "No draw needed";

  const memoBox = document.getElementById("memoBox");
  memoBox.className = "memo-box";
  memoBox.textContent = generateMemo(event, result, BASE, reserves);

  CURRENT.result = result;
  CURRENT.event = event;
  CURRENT.reserves = reserves;
  CURRENT.hormuzPct = hormuzPct;
  CURRENT.baseHormuzPct = baseHormuzPct;
  CURRENT.costDelta = costDelta;

  renderCorridorLedger(event.corridor_shocks);
  renderNetworkMini(result);
  renderTrajectory();
  renderRefineryUtil(result);
}

function renderTimelineEvent(idx) {
  const event = EVENTS[idx];
  window.__activeEventIdx = idx;
  document.getElementById("eventDate").textContent = event.date;
  document.getElementById("eventHeadline").textContent = event.headline;
  document.getElementById("eventSource").textContent = event.source;

  const confBadge = document.getElementById("confBadge");
  confBadge.textContent = `CONF ${Math.round(event.confidence * 100)}%`;
  confBadge.className = "conf-badge" + (event.confidence < 0.5 ? " low" : "");

  const result = solve(event.corridor_shocks);
  render(result, event);
}

function renderCustom(level) {
  window.__activeEventIdx = -1;
  const fakeEvent = {
    headline: `Custom scenario: Hormuz disruption at ${level}%`,
    confidence: 1.0,
    conflict: false,
    source: "User-defined simulation",
    corridor_shocks: { hormuz: level / 100 },
  };
  const result = solve(fakeEvent.corridor_shocks);
  render(result, fakeEvent);
}

function buildTicks() {
  const ticks = document.getElementById("ticks");
  ticks.innerHTML = EVENTS.map((e) => `<span>${e.date.slice(5)}</span>`).join("");
}

document.getElementById("scrubber").addEventListener("input", (e) => {
  renderTimelineEvent(parseInt(e.target.value, 10));
});

document.getElementById("customSlider").addEventListener("input", (e) => {
  const level = parseInt(e.target.value, 10);
  document.getElementById("customVal").textContent = `${level}% disrupted`;
  renderCustom(level);
});

document.getElementById("btnTimeline").addEventListener("click", () => {
  mode = "timeline";
  document.getElementById("btnTimeline").classList.add("active");
  document.getElementById("btnCustom").classList.remove("active");
  document.getElementById("timelinePanel").style.display = "block";
  document.getElementById("customPanel").classList.remove("active");
  renderTimelineEvent(parseInt(document.getElementById("scrubber").value, 10));
});

document.getElementById("btnCustom").addEventListener("click", () => {
  mode = "custom";
  document.getElementById("btnCustom").classList.add("active");
  document.getElementById("btnTimeline").classList.remove("active");
  document.getElementById("timelinePanel").style.display = "none";
  document.getElementById("customPanel").classList.add("active");
  renderCustom(parseInt(document.getElementById("customSlider").value, 10));
});

buildTicks();
renderTimelineEvent(0);

const chatPanel = document.getElementById("chatPanel");
const chatToggle = document.getElementById("chatToggle");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");

function addChatMsg(text, who) {
  const div = document.createElement("div");
  div.className = "chat-msg " + who;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  addChatMsg(text, "user");
  chatInput.value = "";
  setTimeout(() => addChatMsg(chatbotRespond(text), "bot"), 280);
}

chatToggle.addEventListener("click", () => {
  chatPanel.classList.toggle("open");
  if (chatPanel.classList.contains("open")) chatInput.focus();
});
document.getElementById("chatClose").addEventListener("click", () => chatPanel.classList.remove("open"));
document.getElementById("chatSend").addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
