# ADR 0003: Oxc quality tooling

- Status: Accepted
- Date: 2026-07-11

## Context

The repository requires strict linting and opinionated, reproducible formatting. The maintainer prefers the Oxc ecosystem.

## Decision

Use `oxlint` for static linting and `oxfmt` for formatting. Keep TypeScript's strict compiler pass as the authoritative type check. Run all three through `pnpm check` before browser acceptance.

Skip type-checking dependency declaration files because the WebGPU-flavored Three.js declaration graph makes the TypeScript 7 project build pathologically slow. Application and test source remains fully strict.

## Consequences

Quality checks have fast native implementations and a small configuration surface. Rules or formatting that are not yet implemented by Oxc are deliberately not supplemented with a second lint/format stack unless a concrete gap is discovered. Dependency declarations are trusted, while any misuse that reaches application code is still checked against their exported types.

## Verification

`pnpm lint`, `pnpm format:check`, and `pnpm typecheck` must all pass.

## Amendment (2026-07-11): pin TypeScript to stable 5.9, cap compiler memory

`typescript: latest` began resolving to the TypeScript 7 native preview
(`@typescript/typescript-linux-x64`, the Go-based compiler). Once the code
imported `three/tsl`, that preview's inference ran away to 12–14 GB of
resident memory and the kernel OOM killer terminated it — repeatedly taking
down unrelated developer-session processes on a 16 GB machine. Being a native
binary, it also ignores `NODE_OPTIONS` heap limits.

Decision: pin `typescript` to `~5.9.3` (stable, JS-based; full clean check of
this repository: ~2.7 s, ~340 MB) and run `tsc` through
`NODE_OPTIONS=--max-old-space-size=4096` in the `typecheck` script so any
future regression fails fast with a heap error instead of an OOM kill.
`build`/`build:pages` route through `pnpm typecheck` for the same guardrail.
In `three/tsl` code, prefer the functional operator forms (`mul(a, b)`) over
the proxy-generated fluent chains (`a.mul(b)`), which are what triggered the
pathological inference. Revisit the TypeScript 7 pin once the native preview
handles the Three.js node-material declaration graph.
