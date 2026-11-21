# Contributing to ZemTools

This repository is the public development source for https://zemtools.com/. The live website is not deployed from this repository at present.

## Development safety

- Work on a focused feature branch; do not commit feature work directly to `main`.
- Keep each pull request limited to one coherent task and only the files needed for it.
- Describe the user problem, expected benefit, changed paths, risks, and verification performed.
- Do not add API keys, credentials, private datasets, account identifiers, internal strategy documents, private project logs, or competitor research.
- Do not introduce `pull_request_target` or expose secrets to forked pull requests.
- If a future deployment workflow is added, use least-privilege permissions, protected environments, explicit production approval, and isolated previews. Never deploy production from an ordinary pull-request event.

## Cost-aware validation policy

Use free standard GitHub-hosted runners for public-repository CI. Do not select larger runners, paid external CI, paid APIs, paid SEO products, or paid services without explicit repository-owner approval.

Validation should be proportionate to the change, without weakening safety or correctness:

1. Every pull request runs required static/contract checks and focused tests for the changed tool or shared component.
2. Shared foundations (navigation, catalog, global CSS, routing, common UI, engine contracts, build/deployment configuration) trigger the relevant broad regression suite.
3. Full-site browser regression runs before merge-ready release candidates and on a controlled periodic checkpoint.
4. Lighthouse, multi-profile performance and heavier diagnostics run for release candidates or materially affected pages, not repeatedly for unrelated edits.
5. Preserve critical calculation, electrical-safety, accessibility, privacy, security, and production-release tests. Do not skip them to save runner time.

## Avoid duplicate compute and storage

- Cancel obsolete in-progress PR checks when a newer commit supersedes them; do not cancel or overlap production deployment jobs.
- Avoid duplicate workflows that run the same suite for the same commit.
- Run only the tests required by the changed paths, while retaining a broad regression gate before release.
- Pin Node/browser/tool versions. Add dependency/browser caching only when it demonstrably reduces runtime; keep caches bounded.
- Do not upload routine logs, screenshots, videos, or build folders as artifacts. Upload only diagnostics needed to investigate a failure and keep retention short.
- Do not rerun a failed workflow blindly. First inspect the run, runner assignment, job steps, logs, and failure type; retry only when a transient cause is plausible.

## Release and rollback

- A green CI run is not production approval.
- Review the isolated preview and verify affected workflows before requesting release approval.
- Production remains separate from this public repository until a deliberate, documented deployment design is reviewed and approved.
- Keep the original private operations repository as the source of confidential planning, business strategy, and project history.

## Reporting

For each completed task, record the commit/PR, tests actually run, preview URL if applicable, known gaps, and deployment state. Never describe an unrun test as passing or imply that public GitHub Actions means all GitHub limits are unlimited.
