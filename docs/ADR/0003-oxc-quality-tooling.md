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
