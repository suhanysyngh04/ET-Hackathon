from optimizer import solve
from events import GROUND_TRUTH_JUNE

def validate_against_ground_truth():
    result = solve(corridor_shocks={"hormuz": 0.45})
    model = result["by_source"]

    comparisons = []
    pairs = [
        ("russia", "russia_bpd"),
        ("venezuela", "venezuela_bpd"),
        ("usa", "us_bpd"),
        ("saudi_arabia", "saudi_bpd"),
    ]
    for model_key, truth_key in pairs:
        model_val = model.get(model_key, 0)
        truth_val = GROUND_TRUTH_JUNE[truth_key]
        direction_model = "up" if model_val > 0 else "flat"
        comparisons.append({
            "source": model_key,
            "model_bpd": model_val,
            "ground_truth_bpd": truth_val,
            "model_rank": None,
        })

    ranked_model = sorted(model.items(), key=lambda x: -x[1])
    ranked_truth = sorted(GROUND_TRUTH_JUNE.items(), key=lambda x: -x[1])

    return {
        "model_sourcing_mix": model,
        "model_top_sources_ranked": [s for s, _ in ranked_model],
        "ground_truth_top_movers": ["russia", "uae", "saudi_arabia", "venezuela", "usa"],
        "comparisons": comparisons,
        "note": "Model is solved with a single static shock snapshot, not a 4-month rolling reoptimization, so absolute bpd will not match exactly. The validation claim is directional: which corridors the model shifts volume toward under the same disruption that actually occurred.",
    }

if __name__ == "__main__":
    import json
    print(json.dumps(validate_against_ground_truth(), indent=2))
