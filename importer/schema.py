"""Versioned exchange core. No DEVSForge persistence or ISO-specific fields here."""
import math
import json

VERSION = "1"
MAX_MODELS = 1000


def validate_target(package, target):
    """Keep target mismatches inside the agent's repair loop, before completion."""
    if not target:
        return package
    expected = target["id"] + "@" + target["version"]
    for model in package["models"]:
        if model["type"] != "atomic":
            continue
        if model.get("integrationId") != target["id"] or model.get("integrationVersion") != target["version"]:
            raise ValueError(f"{model['name']}: conversion must produce integration {expected}; set the exact integrationId and integrationVersion after adapting its source to the target contract")
        if target.get("language") and model.get("language") != target["language"]:
            raise ValueError(f"{model['name']}: conversion language must be {target['language']}")
        if not model.get("code", "").strip():
            raise ValueError(f"{model['name']}: conversion requires executable source code, not only a target integration identifier")
    return package


def validate(package):
    if not isinstance(package, dict) or package.get("version") != VERSION:
        raise ValueError("Expected exchange core version 1")
    models = package.get("models")
    if not isinstance(models, list) or not 1 <= len(models) <= MAX_MODELS:
        raise ValueError("A package needs 1–1000 models")
    by_id = {}
    for m in models:
        if not isinstance(m, dict):
            raise ValueError("Model must be an object")
        mid = m.get("id")
        if not isinstance(mid, str) or not mid or mid in by_id:
            raise ValueError("Missing or duplicate model id")
        by_id[mid] = m
        if not isinstance(m.get("name"), str) or not m["name"].strip():
            raise ValueError(f"{mid}: name required")
        if m.get("type") not in ("atomic", "coupled"):
            raise ValueError(f"{mid}: invalid model type")
        for field in ("code", "language", "framework", "integrationId", "integrationVersion", "description"):
            if field in m and not isinstance(m[field], str):
                raise ValueError(f"{mid}: {field} must be text")
        for field in ("ports", "parameters", "components", "connections", "missing", "evidence", "dependencies"):
            m.setdefault(field, [])
            if not isinstance(m[field], list):
                raise ValueError(f"{mid}: {field} must be an array")
        for field in ("missing", "evidence", "dependencies"):
            if any(not isinstance(x, str) for x in m[field]):
                raise ValueError(f"{mid}: {field} entries must be text")
        files = m.setdefault("files", {})
        if not isinstance(files, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in files.items()):
            raise ValueError(f"{mid}: files must map paths to text")
        ports = set()
        for p in m["ports"]:
            if not isinstance(p, dict) or not isinstance(p.get("name"), str) or not p["name"] or p["name"] in ports or p.get("type") not in ("in", "out"):
                raise ValueError(f"{mid}: invalid or duplicate port")
            ports.add(p["name"])
        names = set()
        for p in m["parameters"]:
            if not isinstance(p, dict) or not isinstance(p.get("name"), str) or not p["name"] or p["name"] in names or p.get("type") not in ("int", "float", "bool", "string", "object"):
                raise ValueError(f"{mid}: invalid parameter")
            names.add(p["name"])
            value = p.get("value")
            kind = p["type"]
            good = {"int": lambda: type(value) is int, "float": lambda: type(value) in (int, float) and math.isfinite(value), "bool": lambda: type(value) is bool, "string": lambda: isinstance(value, str), "object": lambda: isinstance(value, (dict, list))}[kind]()
            if not good:
                raise ValueError(f"{mid}: parameter value does not match {kind}")
        if m["type"] == "atomic" and (m["components"] or m["connections"]):
            raise ValueError(f"{mid}: atomic model cannot contain a composition")
    for m in models:
        children = {"root": m}
        for c in m["components"]:
            if not isinstance(c, dict) or not isinstance(c.get("instanceId"), str) or not c["instanceId"] or c["instanceId"] in children or c.get("modelId") not in by_id:
                raise ValueError(f"{m['id']}: invalid component reference")
            children[c["instanceId"]] = by_id[c["modelId"]]
            overrides = c.get("parameterOverrides", {})
            if not isinstance(overrides, dict):
                raise ValueError("parameterOverrides must be an object")
            params = {p["name"]: p for p in children[c["instanceId"]]["parameters"]}
            for name, value in overrides.items():
                if name not in params:
                    raise ValueError(f"Unknown overridden parameter {name}")
                probe = {"version": VERSION, "roots": ["p"], "models": [{"id": "p", "name": "p", "type": "atomic", "parameters": [{**params[name], "value": value}]}]}
                validate(probe)
        for c in m["connections"]:
            if not isinstance(c, dict):
                raise ValueError("Connection must be an object")
            for end in ("from", "to"):
                e = c.get(end, {})
                if not isinstance(e, dict) or e.get("instanceId") not in children:
                    raise ValueError(f"{m['id']}: unresolved endpoint")
                direction = ("in" if end == "from" else "out") if e["instanceId"] == "root" else ("out" if end == "from" else "in")
                if not any(p["name"] == e.get("port") and p["type"] == direction for p in children[e["instanceId"]]["ports"]):
                    raise ValueError(f"{m['id']}: unknown port or invalid connection direction")
    done, active = set(), set()

    def visit(mid):
        if len(active) > 64:
            raise ValueError("Composition nesting exceeds 64 levels")
        if mid in active:
            raise ValueError("Cyclic composition")
        if mid in done:
            return
        active.add(mid)
        for c in by_id[mid]["components"]:
            visit(c["modelId"])
        active.remove(mid)
        done.add(mid)

    for mid in by_id:
        visit(mid)
    roots = package.get("roots")
    if not isinstance(roots, list) or not roots or len(set(roots)) != len(roots) or any(r not in by_id for r in roots):
        raise ValueError("Missing or unresolved roots")
    reachable = set()

    def collect(mid):
        if mid in reachable:
            return
        reachable.add(mid)
        for c in by_id[mid]["components"]:
            collect(c["modelId"])

    for root in roots:
        collect(root)
    if reachable != set(by_id):
        raise ValueError("Package contains definitions unreachable from its roots")
    counts = {}

    def occurrences(mid):
        if mid not in counts:
            counts[mid] = 1 + sum(occurrences(c["modelId"]) for c in by_id[mid]["components"])
            if counts[mid] > 10000:
                raise ValueError("Expanded hierarchy exceeds 10000 occurrences")
        return counts[mid]

    if sum(occurrences(root) for root in roots) > 10000:
        raise ValueError("Expanded hierarchy exceeds 10000 occurrences")
    json.dumps(package, allow_nan=False)
    return package
