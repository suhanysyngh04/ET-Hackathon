from flask import Flask, jsonify, request
from flask_cors import CORS
from events import EVENTS
from pipeline import run_for_event_index, run_custom_shock
from network_data import SOURCES, REFINERIES, CORRIDORS

app = Flask(__name__)
CORS(app)

@app.route("/api/events")
def get_events():
    return jsonify(EVENTS)

@app.route("/api/network")
def get_network():
    return jsonify({"sources": SOURCES, "refineries": REFINERIES, "corridors": CORRIDORS})

@app.route("/api/scenario/<int:idx>")
def get_scenario(idx):
    if idx < 0 or idx >= len(EVENTS):
        return jsonify({"error": "index out of range"}), 400
    with_memo = request.args.get("memo", "1") == "1"
    return jsonify(run_for_event_index(idx, with_memo=with_memo))

@app.route("/api/custom", methods=["POST"])
def post_custom():
    payload = request.get_json(force=True)
    level = float(payload.get("hormuz_level", 0))
    level = max(0.0, min(1.0, level))
    return jsonify(run_custom_shock(level, with_memo=True))

if __name__ == "__main__":
    app.run(port=5057, debug=False)
