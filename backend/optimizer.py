import pulp
from network_data import SOURCES, CORRIDORS, REFINERIES, REFINERY_DEMAND_BPD, grade_penalty

def effective_freight(corridor_name, shock_level):
    corridor = CORRIDORS[corridor_name]
    base = corridor["base_freight_per_bbl"]
    surge_multiplier = 1 + (shock_level * 3.5)
    return base * surge_multiplier

def effective_availability(source_name, shock_level):
    source = SOURCES[source_name]
    if source["corridor"] == "hormuz":
        return source["max_bpd"] * max(0.0, 1 - shock_level)
    return source["max_bpd"]

def _build_and_solve(corridor_shocks, target_utilization, concentration_cap):
    prob = pulp.LpProblem("crude_sourcing", pulp.LpMinimize)
    flow = {}
    for s_name in SOURCES:
        for r_name in REFINERIES:
            flow[(s_name, r_name)] = pulp.LpVariable(f"flow_{s_name}_{r_name}", lowBound=0)

    cost_terms = []
    for s_name, source in SOURCES.items():
        shock = corridor_shocks.get(source["corridor"], 0.0)
        freight = effective_freight(source["corridor"], shock)
        for r_name, refinery in REFINERIES.items():
            penalty = grade_penalty(source["grade"], refinery["compatible_grades"])
            unit_cost = source["base_price"] + freight + penalty
            cost_terms.append(unit_cost * flow[(s_name, r_name)])
    prob += pulp.lpSum(cost_terms)

    for s_name, source in SOURCES.items():
        shock = corridor_shocks.get(source["corridor"], 0.0)
        avail = effective_availability(s_name, shock)
        prob += pulp.lpSum(flow[(s_name, r_name)] for r_name in REFINERIES) <= avail
        prob += pulp.lpSum(flow[(s_name, r_name)] for r_name in REFINERIES) <= REFINERY_DEMAND_BPD * concentration_cap

    for r_name, refinery in REFINERIES.items():
        r_flow = pulp.lpSum(flow[(s_name, r_name)] for s_name in SOURCES)
        prob += r_flow <= refinery["capacity_bpd"]
        prob += r_flow >= refinery["capacity_bpd"] * target_utilization

    prob.solve(pulp.PULP_CBC_CMD(msg=0))
    return prob, flow

def solve(corridor_shocks=None, demand_override=None, concentration_cap=0.35):
    corridor_shocks = corridor_shocks or {}
    demand = demand_override or REFINERY_DEMAND_BPD

    target_utilization = 0.92
    prob, flow = _build_and_solve(corridor_shocks, target_utilization, concentration_cap)
    while pulp.LpStatus[prob.status] != "Optimal" and target_utilization > 0.1:
        target_utilization -= 0.05
        prob, flow = _build_and_solve(corridor_shocks, target_utilization, concentration_cap)

    result = {
        "status": pulp.LpStatus[prob.status],
        "achieved_utilization_floor": round(target_utilization, 2),
        "total_cost_per_day": pulp.value(prob.objective),
        "total_bpd_sourced": sum(v.value() or 0 for v in flow.values()),
        "by_source": {},
        "by_route": [],
    }
    for s_name in SOURCES:
        total = sum(flow[(s_name, r_name)].value() or 0 for r_name in REFINERIES)
        if total > 1:
            result["by_source"][s_name] = round(total)
    for (s_name, r_name), var in flow.items():
        v = var.value() or 0
        if v > 1:
            result["by_route"].append({"source": s_name, "refinery": r_name, "bpd": round(v)})

    demand_gap = demand - result["total_bpd_sourced"]
    result["demand_gap_bpd"] = round(max(0, demand_gap))
    result["fulfillment_pct"] = round(100 * result["total_bpd_sourced"] / demand, 1)
    result["avg_cost_per_bbl"] = round(result["total_cost_per_day"] / result["total_bpd_sourced"], 2) if result["total_bpd_sourced"] else None
    return result

def baseline():
    return solve(corridor_shocks={})
