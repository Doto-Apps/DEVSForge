"""Generate the internal importer token without printing/replacing credentials."""
from pathlib import Path
import re
import secrets

path = Path(".env")
text = path.read_text(encoding="utf-8") if path.exists() else ""
if not re.search(r"^IMPORT_INTERNAL_TOKEN=.+$", text, re.M):
    text = re.sub(r"^IMPORT_INTERNAL_TOKEN=.*\n?", "", text, flags=re.M)
    path.write_text(text + "\nIMPORT_INTERNAL_TOKEN=" + secrets.token_hex(32) + "\n", encoding="utf-8")
