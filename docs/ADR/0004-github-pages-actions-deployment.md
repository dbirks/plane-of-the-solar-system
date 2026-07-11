# ADR 0004: Artifact-based GitHub Pages deployment

- Status: Accepted
- Date: 2026-07-11

## Context

The application needs to deploy from this repository to GitHub Pages without committing generated output to a separate branch. Current GitHub documentation recommends a custom Actions workflow that configures Pages, uploads a Pages artifact, and deploys it from a dedicated job.

## Decision

On pushes to `main` and manual dispatch, build and test with pnpm in GitHub Actions, generate Vite output with the repository base path `/plane-of-the-solar-system/`, upload `dist/` using `actions/upload-pages-artifact@v4`, and deploy using `actions/deploy-pages@v4` to the `github-pages` environment.

Use `actions/configure-pages@v5`; do not create or push a `gh-pages` branch. Grant only `contents: read`, `pages: write`, and `id-token: write` as required by the build and deployment jobs.

## Consequences

Deployment history lives in Actions and the `github-pages` environment. Local development remains rooted at `/`, while the Pages build emits repository-prefixed asset URLs. Repository Pages settings must use “GitHub Actions” as the publishing source; the workflow can create the environment but cannot override an incompatible publishing-source setting without repository administration.

## Verification

Run `pnpm build:pages` locally, inspect emitted asset URLs, validate the workflow syntax, push to `main`, and confirm both the workflow run and deployed URL.
