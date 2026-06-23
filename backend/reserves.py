from network_data import SPR_TOTAL_BARRELS, SPR_CAPACITY_DAYS, REFINERY_DEMAND_BPD

def drawdown_plan(demand_gap_bpd, projected_disruption_days):
    if demand_gap_bpd <= 0:
        return {
            "draw_needed": False,
            "days_of_cover_at_current_gap": None,
            "spr_remaining_after_disruption_days": SPR_CAPACITY_DAYS,
        }

    days_of_cover = SPR_TOTAL_BARRELS / demand_gap_bpd
    barrels_needed_for_full_disruption = demand_gap_bpd * projected_disruption_days
    pct_of_reserve_needed = min(100, round(100 * barrels_needed_for_full_disruption / SPR_TOTAL_BARRELS, 1))

    sustainable_days = min(projected_disruption_days, days_of_cover)
    remaining_cover_days = max(0, SPR_CAPACITY_DAYS - sustainable_days)

    return {
        "draw_needed": True,
        "demand_gap_bpd": round(demand_gap_bpd),
        "days_of_cover_at_current_gap": round(days_of_cover, 1),
        "pct_of_reserve_needed_for_full_disruption": pct_of_reserve_needed,
        "spr_remaining_after_disruption_days": round(remaining_cover_days, 1),
        "recommendation": (
            "Reserve alone cannot cover the full disruption window. Drawdown should be paired with "
            "the procurement reallocation, not used as a substitute for it."
            if sustainable_days < projected_disruption_days else
            "Reserve cover is sufficient for the projected disruption window without procurement changes, "
            "though reallocation still reduces drawdown dependency."
        ),
    }
