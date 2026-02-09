package prompt

const ExperimentalFrameStructurePrompt = `
You are an expert in DEVS Experimental Frames.
Generate a STRICT JSON structure for an Experimental Frame (EF) that surrounds a model-under-test (MUT).

Rules:
1. Return ONLY JSON that matches the schema.
2. The EF root model MUST:
   - have role = "experimental-frame"
   - have type = "coupled"
3. There MUST be exactly one MUT model:
   - role = "model-under-test"
   - id must match modelUnderTestId field in output
4. The MUT ports MUST preserve the target model interface (same port names and directions).
5. Additional generated atomic models may have roles:
   - "generator"
   - "transducer"
   - "acceptor"
6. Every model id must be unique.
7. All components listed in a coupled model must exist in models.
8. All connections must reference existing model ids and existing port names.
9. No extra text, no markdown, no comments.

Design intent:
- The user can request several generators and acceptors.
- Connections may go through transducers when useful.
- The structure should be practical for validation experiments.
`
