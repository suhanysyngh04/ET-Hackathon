# SENTINEL — AI-Driven Energy Supply Chain Resilience

Problem Statement 2, ET AI Hackathon 2026.

## What this is

A decision-support tool for India's crude oil procurement under geopolitical disruption.
Given a disruption event (a Hormuz closure, a ceasefire, a contested reopening), it re-solves
an optimal sourcing allocation across nine crude-producing countries and five Indian refineries,
then generates a procurement memo explaining the recommended shift, its cost, and what would
invalidate it.

It is built and demoed against the real 2026 Strait of Hormuz crisis: strikes on February 28,
the closure, the ceasefire, the contested reopening as of June 20-22. This is not a hypothetical
scenario. It is happening as this was built.

## Why this is not a chatbot wrapper

The core of the system is a constrained cost-minimization problem (a transportation/min-cost-flow
problem), not an LLM guess. Given a corridor disruption level, it solves for the cheapest feasible
sourcing mix subject to:

- per-source availability (collapses when its corridor is disrupted)
- per-source concentration caps (no single country exceeds 35% of total demand, reflecting real
  diversification limits)
- per-refinery capacity and a minimum utilization floor (refineries can't simply idle)
- grade compatibility penalties (a refinery built for light sweet crude pays a penalty to run
  heavy sour, same as in reality)

The LLM layer sits on top of this and does exactly one thing: turn the optimizer's numeric output
into a memo a procurement lead could act on. It does not decide the allocation.

## Two implementations, same model

- `backend/` — the reference implementation in Python, using PuLP for exact linear programming.
  This is what was used to validate the model's logic and to check it against real June 2026
  import data (see `backend/validate.py`).
- `frontend/` — a self-contained browser port. `engine.js` reimplements the same cost-minimization
  logic as a min-cost-flow allocation (sorted greedy assignment with a utilization-floor correction
  pass), verified against the Python/PuLP output for directional and near-numerical agreement.
  This runs entirely client-side: no backend required for the demo.

## Validation against reality

`backend/validate.py` runs the optimizer against the same Hormuz disruption level that existed
in mid-June 2026 and compares its output ranking against actual Kpler-reported import shifts.
The model correctly ranks Russia and Venezuela as the top beneficiaries of the Hormuz disruption,
matching the real-world pivot. Absolute barrel counts do not match exactly, because the model
is a static single-snapshot solve, not a four-month rolling reoptimization with real contract
lag. The claim is directional, not point-precise, and the demo says so explicitly rather than
overstating precision.

## Running it

Browser demo (no install required beyond a static file server):

```
cd frontend
python3 -m http.server 8731
```

Open `http://localhost:8731/index.html`. Use the timeline scrubber to move through the actual
Feb-June 2026 event sequence, or switch to "Simulate New Shock" to drag an arbitrary Hormuz
disruption level and watch the optimizer re-solve live.

Python reference implementation:

```
cd backend
pip install pulp flask flask-cors --break-system-packages
python3 server.py
```

Exposes `/api/scenario/<index>`, `/api/custom`, `/api/events`, `/api/network` on port 5057.
Memo generation calls the Claude API if `ANTHROPIC_API_KEY` is set in the environment; otherwise
it falls back to the same template-based memo logic used in the browser demo, so the system
degrades gracefully rather than breaking.

## What is deliberately out of scope for this prototype

- Live news scraping or AIS vessel tracking. The event timeline is curated from verified
  reporting, not pulled live, because live scraping infrastructure is a separate and fragile
  engineering problem that would dilute focus from the optimization core.
- A full digital twin of the entire supply network (pipelines, storage depots, product
  distribution). The model stops at the crude procurement layer, which is where the
  highest-leverage decision actually sits during a disruption.
- A standalone strategic-reserve agent. Reserve drawdown math is folded into the same pipeline
  as a supporting calculation rather than a separate agent, because in practice it's a
  consequence of the procurement decision, not an independent lever.

## Dashboard additions: live panels and the chat assistant

Three additional panels were added to the frontend beyond the original sourcing/memo view,
all driven by the same live optimizer state, not separate data:

- **Corridor Risk Ledger** (`app.js: renderCorridorLedger`) — shows the current risk percentage
  and effective freight cost for each of the three shipping corridors, computed directly from
  the same formula the optimizer uses (`base_freight * (1 + shock * 3.5)`), so the cost
  mechanics that are otherwise invisible inside the solver are shown explicitly.
- **Cost Trajectory** (`app.js: renderTrajectory`) — a small inline SVG line chart plotting
  landed cost across all nine timeline events, with the currently active point highlighted,
  giving the full crisis arc at a glance rather than only the current snapshot.
- **Active Network** (`app.js: renderNetworkMini`, `geo_data.js`) — a compact world map (real
  coastline data, not illustrative shapes) showing each sourcing country as a pin connected to
  India; active routes for the current scenario render as solid lines, unused capacity as
  dashed. This reuses the same real-geography path data as the masthead watermark.

### Chat assistant

A floating chat button (bottom-right) opens a panel backed by `chatbot.js`. It is intentionally
**rule-based, not an LLM call** — pattern-matching against a fixed set of intents (Russia's
role, full-closure scenarios, confidence/contested signals, the reserve, cost drivers,
methodology, validation, grade compatibility), each of which reads `CURRENT` (a small global
object `app.js` updates on every render) to answer with the actual live numbers on screen
rather than canned text. This was a deliberate choice over a live Claude API integration for
a hackathon demo context: it has zero dependency on network access or API quota, so it cannot
fail live in front of judges, and its answers still change correctly as the timeline or shock
slider moves. The same `CURRENT` state is also what every other panel reads, so the chatbot is
provably reading the same numbers a judge can see on screen, not a separate model with its own
opinion.

