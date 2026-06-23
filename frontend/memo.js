function fmtBpd(n) {
  return Math.round(n).toLocaleString("en-IN");
}

function generateMemo(event, result, baselineResult, reserves) {
  const shifts = [];
  const allSources = new Set([...Object.keys(result.bySource), ...Object.keys(baselineResult.bySource)]);
  allSources.forEach((s) => {
    const cur = result.bySource[s] || 0;
    const base = baselineResult.bySource[s] || 0;
    if (cur > base * 1.1 || (base === 0 && cur > 1000)) {
      shifts.push(`${s.replace("_", " ")} up to ${fmtBpd(cur)} bpd from ${fmtBpd(base)}`);
    } else if (cur < base * 0.9) {
      shifts.push(`${s.replace("_", " ")} cut to ${fmtBpd(cur)} bpd from ${fmtBpd(base)}`);
    }
  });
  const shiftText = shifts.length ? shifts.join("; ") : "no material change versus baseline";

  let conflictLine = "";
  if (event.conflict) {
    conflictLine = " Signal is contested across sources; treat the shock estimate as low-confidence and recheck within 24 hours.";
  }

  const hormuzSources = ["saudi_arabia", "iraq", "uae", "kuwait"];
  const hormuzPct = (100 * hormuzSources.reduce((a, s) => a + (result.bySource[s] || 0), 0)) / result.totalBpd;
  const baseHormuzPct = (100 * hormuzSources.reduce((a, s) => a + (baselineResult.bySource[s] || 0), 0)) / baselineResult.totalBpd;
  const exposureLine = `Hormuz-linked sourcing moves to ${hormuzPct.toFixed(1)} percent of total, versus ${baseHormuzPct.toFixed(1)} percent at baseline.`;

  const reserveLine = reserves.drawNeeded
    ? (reserves.sufficient
        ? `If this volume were not rerouted, the reserve could cover the gap for ${reserves.daysOfCover} days, longer than the 30-day disruption window modelled, leaving ${reserves.sprRemainingDays} days of normal cover intact.`
        : `If this volume were not rerouted, the reserve would cover only ${reserves.daysOfCover} of the 30 modelled disruption days before depleting normal cover. Reroute, not drawdown, is the primary lever here.`)
    : "No Hormuz-linked reserve exposure at this shock level.";

  return `${event.headline} Confidence on this read is ${event.confidence}.${conflictLine} `
    + `Recommended sourcing shift: ${shiftText}. Average landed cost moves to $${result.avgCostPerBbl ? result.avgCostPerBbl.toFixed(2) : "—"}/bbl. `
    + `${exposureLine} ${reserveLine} `
    + `This assumes corridor risk maps linearly to loading capacity and that grade substitution penalties hold at modelled levels. `
    + `A confirmed safe-passage guarantee or a renewed strike would invalidate this and require re-solving.`;
}
