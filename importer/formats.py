"""Bounded readers and declarative adapters; never import/execute uploaded code."""
import base64
import csv
import io
import json
import pickletools
import re
import sqlite3
import tokenize
from pathlib import PurePosixPath
import xml.etree.ElementTree as ET
import zipfile

from schema import validate

MAX_BYTES = 12 * 1024 * 1024
MAX_FILES = 500


def normalize_python_headers(package):
    """JSON stores Unicode; Python runners write UTF-8. Keep coding cookies consistent.

    Original uploaded bytes remain in assets; only the imported executable copy changes.
    """
    warnings = []
    cookie = re.compile(r"^([ \t\f]*\#.*?coding[:=][ \t]*)([-\w.]+)")
    for model in package["models"]:
        if model.get("language", "").lower() != "python" or not model.get("code"):
            continue
        lines = model["code"].splitlines(keepends=True)
        changed = False
        for i in range(min(2, len(lines))):
            match = cookie.match(lines[i])
            if match and match[2].lower().replace("_", "-") not in ("utf-8", "utf-8-sig", "utf8"):
                lines[i] = lines[i][:match.start(2)] + "utf-8" + lines[i][match.end(2):]
                changed = True
        if changed:
            model["code"] = "".join(lines)
            warnings.append(f"{model['name']}: Python encoding declaration normalized to UTF-8 for storage; original uploaded bytes are retained.")
    return warnings


def inspect_binary(file, codec, table=None, offset=0):
    """Read serialized evidence without deserializing Python objects or running SQL from uploads."""
    raw = base64.b64decode(file["base64"]) if "base64" in file else file["text"].encode()
    offset = max(0, int(offset))
    if codec == "pickle":
        records = []
        for index, (op, arg, pos) in enumerate(pickletools.genops(raw)):
            if index < offset:
                continue
            if len(records) == 200:
                return {"operations": records, "nextOffset": index}
            records.append({"position": pos, "opcode": op.name, "argument": repr(arg)[:2000]})
        return {"operations": records, "nextOffset": None, "note": "Disassembly only. No objects were reconstructed or executed."}
    if codec == "sqlite":
        connection = sqlite3.connect(":memory:")
        try:
            connection.deserialize(raw)
            connection.execute("PRAGMA query_only=ON")
            connection.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 1000000)
            remaining = [1000]

            def budget():
                remaining[0] -= 1
                return remaining[0] <= 0

            connection.set_progress_handler(budget, 1000)
            tables = connection.execute("SELECT name, sql FROM sqlite_master WHERE type='table' LIMIT 100").fetchall()
            if table is None:
                return {"tables": tables}
            if table not in [t[0] for t in tables]:
                raise ValueError("Unknown table")
            quoted = '"' + table.replace('"', '""') + '"'
            cursor = connection.execute(f"SELECT * FROM {quoted} LIMIT 100 OFFSET ?", (offset,))
            rows = [[repr(v)[:2000] if isinstance(v, bytes) else v for v in row] for row in cursor.fetchall()]
            return {"columns": [c[0] for c in cursor.description], "rows": rows, "nextOffset": offset + 100 if len(rows) == 100 else None}
        finally:
            connection.close()
    raise ValueError("Supported binary inspectors: pickle (disassembly), sqlite (read-only)")


def read_uploads(uploads):
    files, size = {}, 0

    def add(name, data):
        nonlocal size
        name = name.replace("\\", "/")
        p = PurePosixPath(name)
        if not name or p.is_absolute() or ".." in p.parts or ":" in name or name in files:
            raise ValueError("Unsafe or duplicate file path")
        size += len(data)
        if size > MAX_BYTES or len(files) >= MAX_FILES:
            raise ValueError("Import exceeds 12 MiB or 500 files")
        # Keep binary evidence without trying pickle.load, importing user modules, etc.
        try:
            encoding = "utf-8-sig"
            if p.suffix.lower() in (".py", ".pyi", ".pyw"):
                # Honor Python's BOM / PEP 263 coding declaration, including Latin-1.
                # Detection only reads bytes; it does not import or run the source.
                encoding, _ = tokenize.detect_encoding(io.BytesIO(data).readline)
            text = data.decode(encoding)
            if "\x00" in text:
                raise UnicodeError()
            files[name] = {"text": text, "size": len(data), "encoding": encoding}
            if encoding.lower().replace("_", "-") not in ("utf-8", "utf-8-sig"):
                files[name]["base64"] = base64.b64encode(data).decode()
        except (UnicodeError, SyntaxError, LookupError) as error:
            files[name] = {"binary": True, "size": len(data), "base64": base64.b64encode(data).decode()}
            if p.suffix.lower() in (".py", ".pyi", ".pyw"):
                files[name]["decodeError"] = str(error)[:300] or "Source contains NUL bytes"

    for upload in uploads:
        raw = base64.b64decode(upload["base64"], validate=True)
        if len(raw) > MAX_BYTES:
            raise ValueError("Uploaded file too large")
        if zipfile.is_zipfile(io.BytesIO(raw)):
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                for info in archive.infolist():
                    if info.is_dir():
                        continue
                    if info.file_size > MAX_BYTES or size + info.file_size > MAX_BYTES:
                        raise ValueError("Expanded archive too large")
                    if (info.external_attr >> 16) & 0o170000 == 0o120000:
                        raise ValueError("Archive symlinks are not supported")
                    add(upload["name"] + "/" + info.filename, archive.read(info))
        else:
            add(upload["name"], raw)
    if not files:
        raise ValueError("No files supplied")
    return files


def decode(text, codec):
    if codec == "json":
        return json.loads(text)
    if codec == "csv":
        return list(csv.DictReader(io.StringIO(text)))
    if codec == "xml":
        if "<!DOCTYPE" in text.upper() or "<!ENTITY" in text.upper():
            raise ValueError("XML entities/DOCTYPE are not supported")

        def node(e):
            return {"tag": e.tag, "attributes": e.attrib, "text": e.text or "", "children": [node(c) for c in e]}

        return node(ET.fromstring(text))
    raise ValueError("Supported codecs: json, csv, xml")


def pointer(value, path):
    if not isinstance(path, list) or len(path) > 32:
        raise ValueError("Path must be an array of at most 32 keys/indices")
    for key in path:
        value = value[key]
    return value


def render(spec, value, depth=0):
    if depth > 32:
        raise ValueError("Adapter nesting too deep")
    if isinstance(spec, dict):
        if "$path" in spec:
            return pointer(value, spec["$path"])
        if "$const" in spec:
            return spec["$const"]
        if "$each" in spec:
            rows = pointer(value, spec["$each"])
            if not isinstance(rows, list) or len(rows) > 1000:
                raise ValueError("$each requires an array of at most 1000 entries")
            return [render(spec["template"], row, depth + 1) for row in rows]
        return {k: render(v, value, depth + 1) for k, v in spec.items()}
    if isinstance(spec, list):
        return [render(v, value, depth + 1) for v in spec]
    return spec


def apply_adapter(adapter, text):
    if '"$path"' not in json.dumps(adapter.get("mapping", {})):
        raise ValueError("Reusable mapping must extract source fields, not hardcode a package")

    def check_code(spec):
        if isinstance(spec, dict):
            if "code" in spec and spec["code"] != "" and not (isinstance(spec["code"], dict) and "$path" in spec["code"]):
                raise ValueError("Reusable adapters must extract source code, not cache generated code")
            for v in spec.values():
                check_code(v)
        elif isinstance(spec, list):
            for v in spec:
                check_code(v)

    check_code(adapter["mapping"])
    data = decode(text, adapter["codec"])
    signature = adapter.get("signature")
    if not isinstance(signature, list) or not signature:
        raise ValueError("A reusable adapter requires source signature checks")
    for check in signature:
        if pointer(data, check["path"]) != check["equals"]:
            raise ValueError("Source does not match adapter signature")
    return validate(render(adapter["mapping"], data))
