# ZemTools paired repository checkpoint

Updated: 2026-11-23

This is a **public-safe synchronization marker**, not a copy of the private Master Plan.

## Operating model
- Public repository `Zemtool-public-` is the active workspace for ordinary implementation, tests, PRs, validation, and safe operational notes.
- Private repository `utility-platform` keeps the canonical `docs/ZEMTOOLS_PROJECT_LOG.md` and sensitive/security/confidential records.
- Treat both as one project timeline. Each material public milestone must be reflected in the private Master Plan during the same work session/checkpoint; this public marker is also refreshed with safe status.
- Reconcile both records before starting a new task. If either side is stale, mark **NOT IN SYNC** and resolve it before closing the checkpoint.
- Do not duplicate the full private plan or publish secrets, personal billing records, account identifiers, credentials, tokens, or private security evidence.
- Public commits/merges are not production deployments. Existing tests, preview/review and explicit release approval remain mandatory.

## Latest verified checkpoint — 2026-11-23
- Public PR #8 merged; public-main Foundation Check #54 passed **53/53**.
- Six approved Time Calculator / Business Hours source and test files were verified as exact Git blob matches with the private source snapshot.
- Overall Rule Green / production-release readiness remains **NOT GREEN**: private GitHub Actions runs were unable to start hosted runners due to an account billing/spending-limit restriction (runner ID 0; no test steps executed). No deployment occurred.
- AdSense recovery remains open. Confirmed site-level rejection wording: **“Low-value content.”** This is not a confirmed page-specific diagnosis. Continue original user-value, structure, curation, sitewide quality and policy work; do not resubmit until the established evidence/QA gate is green.
- Website/policy/competitor review notes belong in the private Master Plan as dated source-linked observations. Public may contain only sanitized, actionable takeaways. Do not invent or assume visit findings where the source notes need revalidation.

## Next reconciliation
1. Check the latest public PR/commit and CI outcome.
2. Compare against the newest private Master Plan checkpoint.
3. Update both after any material work, including outcome, Rule Green status, blockers and next step.
4. Keep production untouched unless separately approved.


## Professional optimization toolchain — 2026-11-23

For SEO gaps, calculator accuracy, UX/functionality defects, research and user-journey improvements, use a task-appropriate combination of:

- **OpenSEO:** search intent, SERPs, keyword/competitor gaps, GSC/GA4 context and technical audits.
- **Firecrawl:** source-linked public web research and structured competitor/site inspection.
- **TinyFish:** reproducible browser inspection of public user journeys and interactive behaviours.
- **Mixpanel:** event, funnel, retention and replay evidence when valid instrumentation/data is available.
- **Windsor.ai:** cross-channel marketing/analytics data when the relevant sources are connected and authorized.
- **Wolfram:** independent formula, numerical, scientific and unit validation for calculators.
- **Context7:** current official library/framework/API documentation before coding.
- **Superpowers:** structured engineering workflow support when available in the active working session; otherwise follow the same scoped-plan/test/review discipline manually.
- **GitHub:** source implementation, PR review, tests, CI and release evidence.

Select the smallest useful tool combination for each task; do not run every tool indiscriminately or waste credits/quotas. Verify external data connections before relying on results. Record actual sources, baseline, findings, changed files, tests, outcomes and remaining gaps. Never treat competitor observations as permission to copy. No paid credits, auto-reload, plan upgrades, production changes or destructive external actions without explicit approval.

The detailed workflow, task-to-tool matrix and governance rules are maintained in the private canonical Master Plan. This public note is only a safe operational summary.


## Post-release SEO snapshot — latest three calculators (2026-11-23)

- The latest three production releases were Wire Size, Time Calculator and Business Hours Calculator. Their Cloudflare Pages production deployments all completed successfully on 2026-11-22.
- Google Search Console re-crawled all three live canonical URLs on 2026-11-22/23. Each remains indexed, page fetch successful, and Google canonical matches declared canonical.
- Latest complete GSC window available ends 2026-11-20, before the three releases. Therefore **post-release ranking impact is pending data**.
- Pre-release GSC baseline (2026-10-24–2026-11-20):
  - Time Calculator: 1,479 all-country impressions, 4 clicks, avg position 12.3; US 710 impressions, avg position 12.7.
  - Business Hours Calculator: 181 all-country impressions, 0 clicks, avg position 9.0; US 6 impressions, avg position 32.2.
  - Wire Size Calculator: 563 all-country impressions, 0 clicks, avg position 70.7; US 260 impressions, avg position 70.3.
- Sitewide GSC page totals: 819 impressions / 3 clicks in 2026-09-26–2026-10-23 vs 3,335 / 12 in 2026-10-24–2026-11-20. Visibility expanded; average CTR remained about 0.36%, and this is not proof that all page positions improved.
- GA4 all-channel page views for the canonical host (2026-10-26–2026-11-22): Business Hours 30 views/14 users; Time 24/7; Wire Size 13/5. The canonical-host organic landing report has no entries for these three pages; preview-host rows are excluded from production counts. Measurement reconciliation remains open.
- Next: hold recently optimized pages steady and measure post-release GSC data once a complete reporting window is available. Do not claim Top-3, ranking uplift or causal effect until the post-release data supports it.
- This is a public-safe summary. The private canonical Master Plan contains source references, exact query findings and fuller analysis.


## Immediate next priority — 2026-11-24 (verified live-link issue)
- Read-only 50-page production audit found repeated nested 404/internal-link findings; its crawl hit the page cap, so counts are partial.
- Fresh live rendered extraction confirmed the shared header/footer emits relative links (for example `tools/`, `about/`, `privacy/`) from calculator routes, producing incorrect nested URLs such as `/aspect-ratio-calculator/tools/` and `/business-hours-calculator/about/`. This is a real URL-resolution defect, not just a crawler false positive.
- **Next P0:** inspect and fix the shared header/footer or URL helper in Public repo; audit for other relative root links; add/execute route/link regression checks; verify preview and fresh live link extraction. Production remains untouched until explicit approval. Do not mark Rule Green before tests and required gates pass.
- After P0, investigate Deck Joist Blocking Calculator's near-top-three opportunity (recent GSC+GA4 join: 100 impressions, 3 clicks, avg position 6.33) with query/country evidence before any targeted change.
- Keep latest three calculator releases steady until complete post-release GSC data; do not repeat indexing requests without a specific need.
- Private canonical Master Plan updated with exact audit IDs, evidence, scope, acceptance criteria and sequence. Implementation not yet committed; this checkpoint is not Rule Green.


## Navigation-link regression fix — 2026-11-24
- Source inspection found legacy relative navigation hrefs in calculator HTML; the shared runtime rebuilt header/footer with root paths but did not normalize breadcrumb links.
- Public draft PR #9: https://github.com/saqibali49005-ship-it/Zemtool-public-/pull/9
- Branch fix/root-relative-navigation-links contains a shared navigation normalization, Playwright coverage on four calculator routes, and a Foundation Check workflow entry.
- Foundation Check run #61 is queued; results and preview validation are pending. No merge or production deployment. Production untouched; Rule Green remains NOT GREEN.
- Next: check CI, validate preview rendered destinations, then reconcile both project records. User approval remains required before merge and separately before production.


## Navigation-link regression fix — CI result update (2026-11-24)
- Foundation Check run #61 (45267525409) completed SUCCESS: validate job 54/54 steps, no failed steps. Root-relative navigation regression and configured browser/unit suite passed.
- PR #9 remains draft/open/unmerged: https://github.com/saqibali49005-ship-it/Zemtool-public-/pull/9
- No preview deployment URL or preview test evidence surfaced in available PR/check metadata. CI pass alone does not satisfy preview acceptance.
- Production untouched; no merge or deployment. Rule Green remains NOT GREEN pending preview validation and explicit approval.
