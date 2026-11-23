# ZemTools Historical Consolidation — Inventory & Evidence Ledger

**Project code:** ZT-CORE-2026  
**Started:** 2026-11-24  
**Status:** IN PROGRESS — READ-ONLY SOURCE INVENTORY; ARCHIVE NOT YET COMPLETE  
**Branch:** `docs/zemtools-consolidation-inventory-2026-11-24`  
**Base public-main commit:** `281477e9cc5a0b956a82b397df72c72393a72e2d`

## Purpose

Reconstruct and preserve the project's documented history from its earliest available evidence through the current checkpoint, including repository history, project logs, PRs, branches, research, decisions, testing, release gates, and Superpowers-era work.

This ledger is a public-safe index. Sensitive operational details, internal research, private project memory, credentials, personal billing records, tokens, and private security evidence must remain in the private repository or private backup.

## Verified source inventory (first pass)

### GitHub repositories
- Private canonical repository: [utility-platform](https://github.com/saqibali49005-ship-it/utility-platform)
  - Default branch: `main`
  - Repository ID: `1371855707`
  - Reported size: 17,420 KB (GitHub repository metadata; not a full archive-size measurement)
  - Canonical project log: `docs/ZEMTOOLS_PROJECT_LOG.md`
  - Master Plan fetched and inspected in sections; it is a large document (5,773 lines in the previous verified count).
- Public development repository: [Zemtool-public-](https://github.com/saqibali49005-ship-it/Zemtool-public-)
  - Default branch: `main`
  - Repository ID: `1466863227`
  - Reported size: 891 KB (GitHub repository metadata; not a full archive-size measurement)
  - Public-safe policy: `README.md`
  - Public checkpoint: `docs/PROJECT_SYNC.md`

### Second-pass historical branch/PR evidence

- Private branch pagination returned 168 branches. The names cluster into explicit backup/restore snapshots, shared UI/header/footer and navigation, calculator QA/logic, SEO/indexing, analytics/AdSense/privacy, research/experiments, and project-governance handovers.
- Private PR pagination returned 126 PR records (numbers #1–127 with gaps). Public PR pagination returned 9 records (#1–9).
- Public-safe source ledger PR #10 is open/draft and documentation-only. Private source map PR #128 is open/draft and documentation-only. Neither has been merged; no main branch was changed by these archive documents.
- The private source map is `docs/ARCHIVE_SOURCE_MAP.md` on `docs/historical-source-map-2026-11-24`; it groups historical evidence by period/topic and marks remaining sources requiring inspection. Do not copy the private source map to Public without sanitization.

## Current verified repository checkpoints
- Public `main` head at inventory start: `281477e9cc5a0b956a82b397df72c72393a72e2d`.
- Private `main` recent documented head: `976148067310038788f4bb9803e62a3e9874d0b1` (Nov 23, 2026).
- Private repository API pagination completed for the first inventory pass: **1,414 commits** returned across 15 pages (oldest returned commit: 2026-09-15; newest: 2026-11-23), **168 branches** across two pages, and **126 pull requests** across two pages. These are repository-level GitHub records, not proof that every chat, local file, or external research source is present.
- Public repository API pagination completed for this pass: **31 commits**, **9 branches**, and **9 pull requests**. Public `main` history is much shorter than private history; private Git history must not be pushed wholesale into Public without security and licensing review. Relevant PR states at this checkpoint:
  - PR #1 cost-aware Foundation workflow: merged.
  - PR #2 Wire Size clean transfer: open/draft; do not merge as part of archive work.
  - PR #7 Business Hours validation-only: open/unmerged; retain as validation evidence.
  - PR #8 Time + Business Hours source sync: merged.
  - PR #9 root-relative navigation: closed as redundant after public-main commits; not merged.
- These PR statuses are point-in-time observations and must be rechecked before a later release decision.

### Dropbox
- Dropbox connector is connected and responded to listing/search requests.
- Root folder listing returned no entries at the time checked; search for “ZemTools” returned no files.
- Therefore no Dropbox project backup has yet been found or created. Quota and final archive size remain unmeasured.

## Evidence and completeness rules

- A commit, branch, PR, file, chat summary, screenshot, or research report is evidence only for what it actually shows.
- Preserve raw sources where possible; do not replace original records with a rewritten summary.
- Mark each reconstructed item **Verified**, **Partially verified**, **Inferred**, **Missing source**, or **Not accessible**.
- Do not claim project history begins on the Master Plan initialization date. Older branches and backup branches indicate earlier work exists in repository history.
- Do not claim all prior chat sessions or Superpowers tool traces have been retrieved until those sources are directly inspected.
- Public repo history must be scanned for sensitive data before any private history is transferred or made public. Removing a secret from the latest tree does not remove it from Git history.

## Consolidation work plan

1. Enumerate all public/private branches, tags, commits, PRs, issues, releases, workflows, and project-log/archive files; paginate until complete.
2. Build a source-to-topic chronology with commit/PR/file references and verification status.
3. Reconstruct the pre-Master-Plan period from repository history, backups, project files, and accessible prior conversations.
4. Build an archive manifest with checksums and original source paths; retain immutable source exports.
5. Produce the private canonical Master Plan update and a sanitized public checkpoint.
6. Prepare a mobile-friendly Markdown/PDF export and a cloud-backup folder after calculating archive size and screening sensitive content.
7. Validate backup integrity, file counts, hashes, and source coverage before proposing any repository consolidation or archival.
8. Keep production, Cloudflare project wiring, DNS, live deployments, and repository deletion/archive actions out of scope until separately reviewed and explicitly approved.

## Current blockers / unknowns

- Dropbox root currently has no project files; a backup destination structure has not been created.
- GitHub branch/commit/PR pagination is complete for both repositories in this first pass. Issues, releases/tags, workflow runs/artifacts, repository trees, private branch contents, commit-level sensitive-data scan, and older external/local archives still need inventory.
- Private Git history reaches at least 2026-09-15 in the returned commit list, before the Master Plan initialization date. Full older history beyond this Git repository, historical ChatGPT conversations, and all Superpowers tool traces have not yet been recovered.
- Archive size, storage fit, checksums, and secret-scan results are not yet measured.
- The public/private Master Plan synchronization status must be reconciled after the inventory is complete.

## Safety boundary

This branch contains documentation only. It does not change calculator code, public `main`, private `main`, production, Cloudflare, DNS, AdSense, analytics settings, or locked benchmark pages. Do not merge this inventory branch automatically.
