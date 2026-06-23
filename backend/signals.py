def score_event(event):
    shocks = event["corridor_shocks"]
    confidence = event["confidence"]
    adjusted = {corridor: level * confidence for corridor, level in shocks.items()}
    return adjusted

def aggregate_shocks(events_so_far, decay_per_day=0.0):
    if not events_so_far:
        return {}
    latest = events_so_far[-1]
    return score_event(latest)

def conflicting_signal_flag(event):
    return event.get("conflict", False)
