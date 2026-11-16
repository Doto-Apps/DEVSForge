"""ISO 21175-3 draft 0.7, including the explicitly provisional empty-payload profile."""
from schema import validate

def convert(document):
    """21175-3 draft 0.7 adapter. Keep provisional choices confined to this module."""
    version = "21175-3-draft-0.7"
    if document.get("schemaVersion") != version:
        raise ValueError("Unsupported ISO draft version; expected " + version)
    kind = document.get("kind")
    if kind == "ModelPackage":
        specs = document.get("models", [])
        roots = [document.get("rootModelId")]
        matches = [s for s in specs if s.get("modelId") == roots[0]]
        if len(matches) != 1 or matches[0].get("type") != "composite":
            raise ValueError("ISO package must have exactly one composite root")
    elif kind == "ModelSpecification":
        specs, roots = [document], [document.get("modelId")]
    else:
        raise ValueError("Expected ModelSpecification or ModelPackage")
    models = []
    for s in specs:
        if s.get("kind") != "ModelSpecification" or s.get("schemaVersion") != version or s.get("type") not in ("leaf", "composite") or not isinstance(s.get("ports"), list):
            raise ValueError("Invalid ISO ModelSpecification")
        leaf = s["type"] == "leaf"
        if (leaf and "composition" in s) or (not leaf and "implementation" in s):
            raise ValueError("Invalid ISO implementation/composition")
        comp = {} if leaf else s.get("composition")
        if not isinstance(comp, dict) or (not leaf and not all(isinstance(comp.get(k), list) for k in ("components", "connections"))):
            raise ValueError("ISO composite requires components and connections")
        impl = s.get("implementation", {})
        if "implementation" in s and (not isinstance(impl, dict) or not isinstance(impl.get("language"), str) or not impl["language"] or not isinstance(impl.get("code"), str)):
            raise ValueError("Invalid implementation")
        execution = s.get("execution", {})
        if not isinstance(execution, dict) or ("execution" in s and not execution):
            raise ValueError("Invalid execution declaration")
        for mode, declaration in execution.items():
            if not isinstance(declaration, dict):
                raise ValueError("Execution mode must be an object")
            if mode == "local":
                dist = declaration.get("distribution", {})
                if not declaration.get("runnerId") or dist.get("type") != "oci-image" or not dist.get("reference"):
                    raise ValueError("Invalid local execution declaration")
            elif mode == "remote":
                from urllib.parse import urlparse
                if not urlparse(declaration.get("endpoint", "")).scheme:
                    raise ValueError("Remote execution needs an absolute URI")
            elif not mode.startswith("custom-") or len(mode) == 7:
                raise ValueError("Unknown standard execution mode")
        params = []
        types = {"int32": "int", "int64": "int", "float32": "float", "float64": "float", "boolean": "bool", "string": "string"}
        missing = []
        for p in s.get("parameters", []):
            if p.get("type") not in types:
                raise ValueError("Unsupported ISO parameter type: " + str(p.get("type")))
            if "defaultValue" not in p:
                missing.append("Parameter has no default: " + p["name"])
            else:
                params.append({"name": p["name"], "type": types[p["type"]], "value": p["defaultValue"], "description": p.get("description", "")})
        for p in s["ports"]:
            payload = p.get("payload")
            # Provisional empty payload requested by the author; do not invent field types.
            if payload != {} and (not isinstance(payload, dict) or payload.get("kind") != "object" or not isinstance(payload.get("fields"), dict) or any(v not in (*types, "bytes") for v in payload["fields"].values())):
                raise ValueError("Invalid port payload (use {} for unspecified payloads)")
        models.append({"id": s.get("modelId"), "name": s.get("name"), "type": "atomic" if leaf else "coupled", "description": s.get("description", ""), "language": impl.get("language", ""), "code": impl.get("code", ""), "framework": "", "runnerId": execution.get("local", {}).get("runnerId", ""), "ports": s["ports"], "parameters": params, "components": comp.get("components", []), "connections": comp.get("connections", []), "missing": missing, "original": s})
    return validate({"version": "1", "roots": roots, "models": models})
