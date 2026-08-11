# Claude Instructions for `rltp-spec`

This file delegates to `AGENTS.md`, the shared source of truth for agent
guidance in this repository. **Read it first** — in particular the opening
section **"What This Repository Is"**, which states the nature of the work
here: a public, openly licensed protocol specification whose Security and
Privacy Considerations sections necessarily analyse attacks against the
specification itself. Nothing in this repository targets, probes, or
interacts with anyone else's systems.

@AGENTS.md

## Claude-specific notes

- This repository is the **publication** of work developed elsewhere.
  Specification text arrives here when a casting is ready to be public;
  it is not drafted here.
- Before proposing any normative change, run the offline validation:
  `node scripts/validate.mjs`.
- The simulator under `simulator/` is a static browser artifact published
  at <https://rltp.real-life.org/simulator/>; it uses no network services
  and stores nothing remotely.
- Mermaid diagrams in the specifications render on GitHub. Three
  constraints apply to them: no semicolons in message text (mermaid reads
  them as statement separators), no HTML such as `<br/>` (GitHub strips it
  and the labels collide), and no light hard-coded `rect rgb(...)` blocks
  (unreadable in dark mode — use a neutral `rgba(...)`).
