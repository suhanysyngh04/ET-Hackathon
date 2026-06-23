const SOURCES = {
  saudi_arabia: { corridor: "hormuz", grade: "medium_sour", base_price: 78.0, max_bpd: 900000 },
  iraq: { corridor: "hormuz", grade: "medium_sour", base_price: 76.5, max_bpd: 1000000 },
  uae: { corridor: "hormuz", grade: "light_sweet", base_price: 79.0, max_bpd: 700000 },
  kuwait: { corridor: "hormuz", grade: "medium_sour", base_price: 77.0, max_bpd: 400000 },
  russia: { corridor: "cape_suez", grade: "medium_sour", base_price: 73.0, max_bpd: 2200000 },
  usa: { corridor: "atlantic", grade: "light_sweet", base_price: 81.0, max_bpd: 350000 },
  venezuela: { corridor: "atlantic", grade: "heavy_sour", base_price: 74.5, max_bpd: 420000 },
  nigeria: { corridor: "atlantic", grade: "light_sweet", base_price: 80.0, max_bpd: 300000 },
  brazil: { corridor: "atlantic", grade: "medium_sweet", base_price: 79.5, max_bpd: 250000 },
};

const CORRIDORS = {
  hormuz: { base_freight: 1.8, transit_days: 9 },
  cape_suez: { base_freight: 3.2, transit_days: 22 },
  atlantic: { base_freight: 3.8, transit_days: 26 },
};

const REFINERIES = {
  jamnagar: { capacity_bpd: 1240000, grades: ["light_sweet", "medium_sour", "medium_sweet"], port: "Sikka" },
  vadinar: { capacity_bpd: 410000, grades: ["medium_sour", "heavy_sour"], port: "Vadinar" },
  paradip: { capacity_bpd: 300000, grades: ["medium_sour", "heavy_sour", "medium_sweet"], port: "Paradip" },
  mangalore: { capacity_bpd: 300000, grades: ["light_sweet", "medium_sweet"], port: "Mangalore" },
  barauni: { capacity_bpd: 120000, grades: ["medium_sour"], port: "Haldia" },
};

const TOTAL_DEMAND_BPD = Object.values(REFINERIES).reduce((a, r) => a + r.capacity_bpd, 0);
const SPR_TOTAL_BARRELS = 38000000;
const SPR_DAYS_COVER = 9.5;
const CONCENTRATION_CAP = 0.35;
const UTILIZATION_FLOOR = 0.92;

const GRADE_PENALTY = {
  "light_sweet|light_sweet": 0, "medium_sour|medium_sour": 0,
  "heavy_sour|heavy_sour": 0, "medium_sweet|medium_sweet": 0,
  "light_sweet|medium_sweet": 1.2, "medium_sweet|light_sweet": 1.2,
  "medium_sour|heavy_sour": 1.5, "heavy_sour|medium_sour": 1.8,
  "light_sweet|medium_sour": 2.5, "medium_sour|light_sweet": 2.5,
};

function gradePenalty(sourceGrade, refineryGrades) {
  if (refineryGrades.includes(sourceGrade)) return 0;
  let best = 5.0;
  for (const g of refineryGrades) {
    const key = sourceGrade + "|" + g;
    if (GRADE_PENALTY[key] !== undefined) best = Math.min(best, GRADE_PENALTY[key]);
  }
  return best;
}

function effectiveFreight(corridorName, shock) {
  const c = CORRIDORS[corridorName];
  return c.base_freight * (1 + shock * 3.5);
}

function effectiveAvailability(sourceName, shock) {
  const s = SOURCES[sourceName];
  if (s.corridor === "hormuz") return s.max_bpd * Math.max(0, 1 - shock);
  return s.max_bpd;
}

function buildCostGraph(corridorShocks) {
  const sourceNames = Object.keys(SOURCES);
  const refineryNames = Object.keys(REFINERIES);
  const edges = [];
  for (const s of sourceNames) {
    const src = SOURCES[s];
    const shock = corridorShocks[src.corridor] || 0;
    const freight = effectiveFreight(src.corridor, shock);
    const avail = Math.min(effectiveAvailability(s, shock), TOTAL_DEMAND_BPD * CONCENTRATION_CAP);
    for (const r of refineryNames) {
      const ref = REFINERIES[r];
      const penalty = gradePenalty(src.grade, ref.grades);
      const cost = src.base_price + freight + penalty;
      edges.push({ source: s, refinery: r, cost, sourceCap: avail });
    }
  }
  return edges;
}

function minCostAllocate(corridorShocks, targetUtilization) {
  const edges = buildCostGraph(corridorShocks);
  edges.sort((a, b) => a.cost - b.cost);

  const sourceRemaining = {};
  for (const s in SOURCES) {
    const src = SOURCES[s];
    const shock = corridorShocks[src.corridor] || 0;
    sourceRemaining[s] = Math.min(effectiveAvailability(s, shock), TOTAL_DEMAND_BPD * CONCENTRATION_CAP);
  }
  const refineryRemaining = {};
  for (const r in REFINERIES) refineryRemaining[r] = REFINERIES[r].capacity_bpd;

  const flows = [];
  for (const e of edges) {
    const amt = Math.min(sourceRemaining[e.source], refineryRemaining[e.refinery]);
    if (amt > 0.5) {
      flows.push({ source: e.source, refinery: e.refinery, bpd: amt, costPerBbl: e.cost });
      sourceRemaining[e.source] -= amt;
      refineryRemaining[e.refinery] -= amt;
    }
  }

  let total = flows.reduce((a, f) => a + f.bpd, 0);
  const targetTotal = TOTAL_DEMAND_BPD * targetUtilization;

  if (total > targetTotal) {
    flows.sort((a, b) => b.costPerBbl - a.costPerBbl);
    let excess = total - targetTotal;
    for (const f of flows) {
      if (excess <= 0) break;
      const cut = Math.min(f.bpd, excess);
      f.bpd -= cut;
      excess -= cut;
    }
    flows.sort((a, b) => a.costPerBbl - b.costPerBbl);
  }

  return flows.filter((f) => f.bpd > 0.5);
}

function solve(corridorShocks) {
  let targetUtilization = UTILIZATION_FLOOR;
  let flows = minCostAllocate(corridorShocks, targetUtilization);
  let total = flows.reduce((a, f) => a + f.bpd, 0);

  while (total < TOTAL_DEMAND_BPD * targetUtilization * 0.97 && targetUtilization > 0.1) {
    targetUtilization -= 0.05;
    flows = minCostAllocate(corridorShocks, targetUtilization);
    total = flows.reduce((a, f) => a + f.bpd, 0);
  }

  const bySource = {};
  for (const f of flows) bySource[f.source] = (bySource[f.source] || 0) + f.bpd;

  const totalCost = flows.reduce((a, f) => a + f.bpd * f.costPerBbl, 0);
  const demandGap = Math.max(0, TOTAL_DEMAND_BPD - total);

  return {
    byRoute: flows,
    bySource,
    totalBpd: total,
    totalCostPerDay: totalCost,
    avgCostPerBbl: total > 0 ? totalCost / total : null,
    demandGapBpd: demandGap,
    fulfillmentPct: (100 * total) / TOTAL_DEMAND_BPD,
    utilizationFloor: targetUtilization,
  };
}

function baseline() {
  return solve({});
}

function drawdownPlan(demandGapBpd, projectedDisruptionDays) {
  if (demandGapBpd <= 0) {
    return { drawNeeded: false, daysOfCover: null, sprRemainingDays: SPR_DAYS_COVER, sufficient: true };
  }
  const daysOfCoverForGapAlone = SPR_TOTAL_BARRELS / demandGapBpd;
  const sufficient = daysOfCoverForGapAlone >= projectedDisruptionDays;

  const barrelsDrawnOverWindow = demandGapBpd * Math.min(projectedDisruptionDays, daysOfCoverForGapAlone);
  const pctNeeded = Math.min(100, (100 * barrelsDrawnOverWindow) / SPR_TOTAL_BARRELS);
  const barrelsRemaining = Math.max(0, SPR_TOTAL_BARRELS - barrelsDrawnOverWindow);
  const remainingCoverDaysAtNormalDemand = (barrelsRemaining / SPR_TOTAL_BARRELS) * SPR_DAYS_COVER;

  return {
    drawNeeded: true,
    demandGapBpd: Math.round(demandGapBpd),
    daysOfCover: Math.round(daysOfCoverForGapAlone * 10) / 10,
    pctOfReserveNeeded: Math.round(pctNeeded * 10) / 10,
    sprRemainingDays: Math.round(remainingCoverDaysAtNormalDemand * 10) / 10,
    sufficient,
  };
}
