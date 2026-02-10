package prompt

const KeywordExtractionPrompt = `
You extract concise retrieval keywords from a modeling request.

Rules:
- Return only domain-relevant keywords useful for model reuse retrieval.
- Keep 4 to 12 keywords.
- Use lowercase, short forms, no sentence fragments.
- Avoid generic words (e.g., model, code, system, user, create).
- Prefer behavior terms, protocol terms, ports/message concepts, and domain entities.
- Output strict JSON with: { "keywords": ["k1", "k2", ...] }.
`
