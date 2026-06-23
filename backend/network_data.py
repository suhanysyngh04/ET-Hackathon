SOURCES = {
    "saudi_arabia": {"corridor": "hormuz", "grade": "medium_sour", "base_price": 78.0, "max_bpd": 900000, "freight_basis": "loading"},
    "iraq": {"corridor": "hormuz", "grade": "medium_sour", "base_price": 76.5, "max_bpd": 1000000, "freight_basis": "loading"},
    "uae": {"corridor": "hormuz", "grade": "light_sweet", "base_price": 79.0, "max_bpd": 700000, "freight_basis": "loading"},
    "kuwait": {"corridor": "hormuz", "grade": "medium_sour", "base_price": 77.0, "max_bpd": 400000, "freight_basis": "loading"},
    "russia": {"corridor": "cape_suez", "grade": "medium_sour", "base_price": 73.0, "max_bpd": 2200000, "freight_basis": "delivered"},
    "usa": {"corridor": "atlantic", "grade": "light_sweet", "base_price": 81.0, "max_bpd": 350000, "freight_basis": "delivered"},
    "venezuela": {"corridor": "atlantic", "grade": "heavy_sour", "base_price": 74.5, "max_bpd": 420000, "freight_basis": "delivered"},
    "nigeria": {"corridor": "atlantic", "grade": "light_sweet", "base_price": 80.0, "max_bpd": 300000, "freight_basis": "delivered"},
    "brazil": {"corridor": "atlantic", "grade": "medium_sweet", "base_price": 79.5, "max_bpd": 250000, "freight_basis": "delivered"},
}

CORRIDORS = {
    "hormuz": {"base_transit_days": 9, "base_freight_per_bbl": 1.8, "risk": 0.05},
    "cape_suez": {"base_transit_days": 22, "base_freight_per_bbl": 3.2, "risk": 0.05},
    "atlantic": {"base_transit_days": 26, "base_freight_per_bbl": 3.8, "risk": 0.05},
}

REFINERIES = {
    "jamnagar": {"capacity_bpd": 1240000, "compatible_grades": ["light_sweet", "medium_sour", "medium_sweet"], "port": "sikka"},
    "vadinar": {"capacity_bpd": 410000, "compatible_grades": ["medium_sour", "heavy_sour"], "port": "vadinar"},
    "paradip": {"capacity_bpd": 300000, "compatible_grades": ["medium_sour", "heavy_sour", "medium_sweet"], "port": "paradip"},
    "mangalore": {"capacity_bpd": 300000, "compatible_grades": ["light_sweet", "medium_sweet"], "port": "mangalore"},
    "barauni": {"capacity_bpd": 120000, "compatible_grades": ["medium_sour"], "port": "haldia"},
}

REFINERY_DEMAND_BPD = sum(r["capacity_bpd"] for r in REFINERIES.values())

SPR_CAPACITY_DAYS = 9.5
SPR_TOTAL_BARRELS = 38_000_000

GRADE_COMPAT_PENALTY = {
    ("light_sweet", "light_sweet"): 0, ("medium_sour", "medium_sour"): 0,
    ("heavy_sour", "heavy_sour"): 0, ("medium_sweet", "medium_sweet"): 0,
    ("light_sweet", "medium_sweet"): 1.2, ("medium_sweet", "light_sweet"): 1.2,
    ("medium_sour", "heavy_sour"): 1.5, ("heavy_sour", "medium_sour"): 1.8,
    ("light_sweet", "medium_sour"): 2.5, ("medium_sour", "light_sweet"): 2.5,
}

def grade_penalty(source_grade, refinery_grades):
    if source_grade in refinery_grades:
        return 0.0
    best = min((GRADE_COMPAT_PENALTY.get((source_grade, g), 5.0) for g in refinery_grades), default=5.0)
    return best
