"""Pick 50 reproducible trips inside the loaded corridor graph for the k6 benchmark.

Trips join two points of the largest connected part of the network 0.4 to
4 km apart (straight line), seeded so the set is stable: infra/k6/trips.json.
Trips into disconnected islands are covered by the no_route tests instead.
"""

import json
import os
import random
from pathlib import Path

import networkx as nx

from pathable_api.db import Database
from pathable_api.routing import EvidenceGraph, metres

url = os.environ.get("DATABASE_URL", "postgresql://pathable:pathable@localhost:5432/pathable")
db = Database(url)
graph = EvidenceGraph(db.pieces(db.latest_version()["id"]))
largest = max(nx.connected_components(graph.g), key=len)
pts = sorted((round(x, 6), round(y, 6)) for x, y in largest)
rng = random.Random(20261103)
trips = []
while len(trips) < 50:
    a, b = rng.sample(pts, 2)
    if 400 <= metres(a, b) <= 4000:
        trips.append({"origin": list(a), "destination": list(b), "straightLineM": round(metres(a, b))})
out = Path(__file__).resolve().parents[3] / "infra/k6/trips.json"
out.write_text(json.dumps(trips, indent=1) + "\n")
print(f"wrote {len(trips)} trips; median straight line {sorted(t['straightLineM'] for t in trips)[25]} m")
