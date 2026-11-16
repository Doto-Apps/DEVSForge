"""Copy source locally, without asking the LLM to regenerate it or executing it."""
import ast


def extract(file, symbols=None):
    text = file.get("text")
    if text is None:
        raise ValueError("Source is not readable as text")
    if not symbols:
        return text
    if not isinstance(symbols, list) or any(not isinstance(s, str) for s in symbols):
        raise ValueError("symbols must be an array of Python top-level names")
    try:
        tree = ast.parse(text)
    except (SyntaxError, ValueError) as e:
        raise ValueError("Python symbol extraction unavailable; use the full source or report missing support") from e
    definitions = {}
    for node in tree.body:
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            names = [node.name]
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            names = [n.id for target in targets for n in ast.walk(target) if isinstance(n, ast.Name)]
        else:
            names = []
        for name in names:
            if name in definitions:
                raise ValueError("Repeated top-level definitions require full source inspection")
            definitions[name] = node
    missing = set(symbols) - definitions.keys()
    if missing:
        raise ValueError("Unknown source symbols: " + ", ".join(sorted(missing)))
    selected = set()

    def include(name):
        node = definitions.get(name)
        if node is None or node in selected:
            return
        selected.add(node)
        for child in ast.walk(node):
            if isinstance(child, ast.Name) and isinstance(child.ctx, ast.Load):
                include(child.id)

    for symbol in symbols:
        include(symbol)
    # Preserve imports and module docstrings. Dynamic initialization cannot be
    # safely split without understanding its behavior; let the agent report it.
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)) or isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            selected.add(node)
        elif node not in definitions.values():
            raise ValueError("Dynamic top-level statements require full source or explicit conversion")
    lines = text.splitlines(keepends=True)
    prefix = "".join(lines[:tree.body[0].lineno - 1]) if tree.body else ""
    chunks = []
    for node in tree.body:
        if node in selected:
            start = min([node.lineno] + [d.lineno for d in getattr(node, "decorator_list", [])])
            chunks.append("".join(lines[start - 1:node.end_lineno]).rstrip("\r\n"))
    return prefix + "\n\n".join(chunks) + "\n"
