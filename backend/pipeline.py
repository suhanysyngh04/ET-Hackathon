from events import EVENTS
from optimizer import solve, baseline
from reserves import drawdown_plan
from agent import generate_memo

def run_for_event_index(idx, with_memo=True):
    event = EVENTS[idx]
    base = baseline()
    shocks = event["corridor_shocks"]
    result = solve(corridor_shocks=shocks)
    reserves = drawdown_plan(result["demand_gap_bpd"], projected_disruption_days=30)

    output = {
        "event": event,
        "optimizer": result,
        "baseline": base,
        "reserves": reserves,
    }
    if with_memo:
        output["memo"] = generate_memo(event, result, reserves, base)
    return output

def run_custom_shock(hormuz_level, with_memo=True):
    fake_event = {
        "date": "custom", "id": "custom_scenario",
        "headline": f"Custom scenario: Hormuz disruption level {hormuz_level}",
        "corridor_shocks": {"hormuz": hormuz_level}, "confidence": 1.0,
        "source": "User-defined simulation",
    }
    base = baseline()
    result = solve(corridor_shocks=fake_event["corridor_shocks"])
    reserves = drawdown_plan(result["demand_gap_bpd"], projected_disruption_days=30)
    output = {"event": fake_event, "optimizer": result, "baseline": base, "reserves": reserves}
    if with_memo:
        output["memo"] = generate_memo(fake_event, result, reserves, base)
    return output
