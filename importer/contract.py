"""Tool-facing shape of exchange core v1; semantic checks remain in schema.py."""

STRING = {"type": "string"}
STRINGS = {"type": "array", "items": STRING}


def obj(properties, required=()):
    return {"type": "object", "properties": properties, "required": list(required)}


def array(items):
    return {"type": "array", "items": items}


ENDPOINT = obj({"instanceId": STRING, "port": STRING}, ("instanceId", "port"))
MODEL = obj({
    "id": STRING,
    "name": STRING,
    "type": {"type": "string", "enum": ["atomic", "coupled"]},
    "language": STRING,
    "framework": STRING,
    "integrationId": STRING,
    "integrationVersion": STRING,
    "description": STRING,
    "code": STRING,
    "codeRef": {"type": "string", "description": "Reference returned by select_source; use instead of code"},
    "ports": array(obj({"name": STRING, "type": {"type": "string", "enum": ["in", "out"]}}, ("name", "type"))),
    "parameters": array(obj({"name": STRING, "type": {"type": "string", "enum": ["int", "float", "bool", "string", "object"]}, "value": {}}, ("name", "type", "value"))),
    "components": array(obj({"instanceId": STRING, "modelId": STRING, "name": STRING, "parameterOverrides": {"type": "object"}}, ("instanceId", "modelId"))),
    "connections": array(obj({"from": ENDPOINT, "to": ENDPOINT}, ("from", "to"))),
    "files": {"type": "object", "additionalProperties": STRING},
    "missing": STRINGS,
    "evidence": STRINGS,
    "dependencies": STRINGS,
}, ("id", "name", "type"))
PACKAGE = obj({"version": {"type": "string", "enum": ["1"]}, "roots": STRINGS, "models": array(MODEL)}, ("version", "roots", "models"))
