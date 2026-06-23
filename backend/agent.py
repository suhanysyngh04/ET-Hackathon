import json
import os
import urllib.request

API_URL = "https://api.anthropic.com/v1/messages"

def _call_claude(prompt, max_tokens=800):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
    body = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(API_URL, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read())
    return "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")

def _template_memo(event, optimizer_result, reserve_plan, baseline_result):
    shift = []
    for source, bpd in optimizer_result["by_source"].items():
        base_bpd = baseline_result["by_source"].get(source, 0)
        if bpd > base_bpd * 1.1 or (base_bpd == 0 and bpd > 0):
            shift.append(f"{source} up to {bpd:,} bpd from {base_bpd:,}")
        elif bpd < base_bpd * 0.9:
            shift.append(f"{source} cut to {bpd:,} bpd from {base_bpd:,}")
    shift_text = "; ".join(shift) if shift else "no material change versus baseline"

    conflict_line = ""
    if event.get("conflict"):
        conflict_line = " Signal is contested across sources; treat the shock estimate as low-confidence and recheck within 24 hours."

    gap_line = (
        f"Demand gap stands at {optimizer_result['demand_gap_bpd']:,} bpd."
        if optimizer_result["demand_gap_bpd"] > 0 else "No demand gap at current utilization floor."
    )

    return (
        f"{event['headline']} Confidence on this read is {event['confidence']}.{conflict_line} "
        f"Recommended sourcing shift: {shift_text}. Average landed cost moves to "
        f"${optimizer_result.get('avg_cost_per_bbl')}/bbl. {gap_line} "
        f"Reserve position: {reserve_plan.get('recommendation', 'no reserve action modelled')}. "
        f"This recommendation assumes corridor risk translates linearly into available loading capacity and that "
        f"grade substitution penalties hold at modelled levels; a renewed escalation or a confirmed safe-passage "
        f"guarantee would invalidate it and require re-solving."
    )

def build_memo_prompt(event, optimizer_result, reserve_plan, baseline_result):
    shift = {}
    for source, bpd in optimizer_result["by_source"].items():
        base_bpd = baseline_result["by_source"].get(source, 0)
        if bpd != base_bpd:
            shift[source] = {"from_bpd": base_bpd, "to_bpd": bpd}

    return f"""You are a procurement intelligence analyst at an Indian refining major. Write a short, direct decision memo, under 200 words, in plain text with no markdown headers.

EVENT: {event['headline']}
SOURCE: {event['source']}
CONFIDENCE: {event['confidence']}
CONFLICTING SIGNAL: {event.get('conflict', False)}

OPTIMIZER OUTPUT:
Fulfillment: {optimizer_result['fulfillment_pct']}%, demand gap {optimizer_result['demand_gap_bpd']} bpd
Cost per barrel: {optimizer_result.get('avg_cost_per_bbl')}
Sourcing shifts versus baseline: {json.dumps(shift)}

RESERVE POSITION: {json.dumps(reserve_plan)}

State what changed, what to source where instead, what assumption this rests on, and what would invalidate the recommendation. No greeting, no sign-off."""

def generate_memo(event, optimizer_result, reserve_plan, baseline_result):
    prompt = build_memo_prompt(event, optimizer_result, reserve_plan, baseline_result)
    try:
        text = _call_claude(prompt)
        if text.strip():
            return text
        raise ValueError("empty response")
    except Exception:
        return _template_memo(event, optimizer_result, reserve_plan, baseline_result)
