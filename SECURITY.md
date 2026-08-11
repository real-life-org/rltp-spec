# Security Policy

## What this repository is

This repository holds a **protocol specification** — documents, JSON
Schemas, JSON-LD contexts, test vectors, and a static browser simulator.
It is **not a deployed service**, and it operates no infrastructure. There
is no server here to compromise and no user data here to expose.

## Reporting a weakness in the specification

Weaknesses in the *design* are the most valuable thing anyone can send us,
and they are not sensitive: this is an early-stage public draft whose
Security and Privacy Considerations sections already enumerate the attacks
we know about, together with what the protocol does **not** prevent.

Please open a **public issue** describing:

- the document and section,
- the concrete attacker capability you assume,
- the sequence of steps, and
- what the attacker gains.

Public disclosure is appropriate here because no deployment depends on the
weakness staying secret — the drafts explicitly carry no stability
guarantee, and correcting the specification before implementations exist is
the entire purpose of publishing it early.

If you would nevertheless prefer private contact, write to
`mail@antontranelis.de`.

## Weaknesses in a deployed application

If your report concerns the deployed
[Web of Trust app](https://web-of-trust.de/) rather than this
specification — a running instance, a service, stored user data — please
report it privately to `mail@antontranelis.de` and do not open a public
issue.

## Scope

Out of scope for this repository: findings about hosting infrastructure
(GitHub Pages), the identifier site at `real-life.org`, or third-party
dependencies of the simulator. Findings about the *specified protocol* —
signature binding, canonicalization, key rotation, revocation semantics,
replay, partition behaviour, privacy leakage toward services — are exactly
in scope.
