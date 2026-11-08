# Application guide

The user-facing documentation is available at `/documentation/:topic`. The old
`/how-it-works#topic` links redirect to the corresponding chapter.

- `chapters.tsx`: ordered chapters, groups, summaries and section contents. Add a
  chapter here to include it in navigation, topic search and previous/next links.
- `../HowItWorks.tsx`: shared documentation layout. The filename is retained to
  limit unrelated renames; its public label is **Documentation**.
- `../GettingStarted.tsx`: six-step tutorial, with the active step in the URL.
- `../LearningExamples.tsx`: local examples reusing `ModelView`, `PortEditor` and
  `ModelParameterEditor`. These examples do not save or run a model. The illustrated
  event walkthrough is explicitly labeled as an explanation, not a real run.

Content is React/TSX so diagrams, examples and editor controls are real components,
without adding a Markdown renderer or another diagramming dependency. Use existing
ShadCN primitives and theme colors. Keep examples separate from API mutation hooks.

`public/guide/simulation-{light,dark}.png` are captures of the actual simulation
panel with synthetic Switch events and configuration. They contain no user data.
Refresh both when simulation controls change. Do not present these demonstration
traces as measurements from a real backend experiment.

The library gallery shares the existing model converter and viewer. It displays
four libraries per page and four definitions per library; only visible canvases
are mounted. Each library uses one React Flow instance, with namespaced copies for
repeated definitions. Hover/focus on a model name fits its preview; Show all resets
the view. Missing/cyclic or excessively large source hierarchies fall back to a
boundary preview, without modifying stored definitions.

Review claims against the implementation. In particular:

- Kafka bridges coordinator and runner; gRPC bridges runner and language wrapper.
- The repository's ISO 21175-2 text is a **working draft**, not certification.
- Grafana is an external JSON import workflow, not a provisioned live connector.
- The simulation panel's Stop control stops event polling, not backend execution.

Validation: `task front:test`, `task front:build`, and browser checks of the gallery,
all six steps and each documentation route at desktop, tablet and mobile widths.
