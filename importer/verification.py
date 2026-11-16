"""Only the trusted backend resolves integrations and launches the real simulator."""
import json
import os
import urllib.error
import urllib.request


def simulate(package, max_time, root_id, user):
    url = os.environ.get("IMPORT_BACKEND_ADDR", "http://backend:3000").rstrip("/")
    data = {"package": package, "maxTime": max_time, "rootId": root_id}
    req = urllib.request.Request(url + "/internal/imports/verify", data=json.dumps(data).encode(), headers={
        "Authorization": "Bearer " + os.environ.get("IMPORT_INTERNAL_TOKEN", ""),
        "X-Import-User": user, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=115) as response:
            return json.loads(response.read(128 * 1024))
    except urllib.error.HTTPError as error:
        if error.code == 422:
            return json.loads(error.read(128 * 1024))
        return {"status": "unavailable", "error": f"Verification service returned HTTP {error.code}."}
    except (OSError, ValueError):
        return {"status": "unavailable", "error": "Verification service unavailable or timed out. Execution has not been verified."}
