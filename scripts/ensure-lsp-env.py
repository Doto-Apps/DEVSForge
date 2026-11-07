"""Create the internal LSP token without printing or replacing existing credentials."""
from pathlib import Path
import re
import secrets

path = Path(".env")
text = path.read_text() if path.exists() else ""
if not re.search(r"^LSP_INTERNAL_TOKEN=.+$", text, re.M):
    text = re.sub(r"^LSP_INTERNAL_TOKEN=.*\n?", "", text, flags=re.M)
    path.write_text(text + "\nLSP_INTERNAL_TOKEN=" + secrets.token_hex(32) + "\n")
