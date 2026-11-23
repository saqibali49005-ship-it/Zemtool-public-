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


## PR #9 preview wiring finding — 2026-11-24
- Cloudflare Pages test preview project `zemtools-pages-test` is connected to private `utility-platform`, while PR #9's source is public `Zemtool-public-`.
- Existing preview deployment entries belong to other private-repo branches, not PR #9's head commit. They are not valid visual evidence for this fix.
- Preview gate is therefore blocked by repository wiring; no code was deployed. Keep PR #9 draft/open/unmerged and production untouched until a safe preview route is approved/available.


## Pages test deployment clarification — 2026-11-24
- Canonical private-log sync caused Cloudflare Pages test project `zemtools-pages-test` to deploy private `utility-platform/main` commit `07340f363f1805bbcd6f93f50380085bccbcea64`; deployment `12e76074-8673-4a68-a2c8-6fdaeb169e3d` completed successfully at https://12e76074.zemtools-pages-test.pages.dev.
- This is the isolated `pages.dev` test project (configured with robots disallow and X-Robots noindex/nofollow), not public `zemtools.com` production and not a deployment of PR #9.
- PR #9 remains draft/unmerged; public production untouched. Preview-source mismatch still needs an approved solution before visual validation.

## AdSense low-value / whole-site audit evidence — 2026-11-24
- Screenshot rejection reason: Low-value content; ownership verification passed. No AdSense review submitted.
- Official AdSense Help says all site pages may be reviewed and identifies insufficient original/rich content and navigation issues (including broken links): https://support.google.com/adsense/answer/81904 ; readiness guidance: https://support.google.com/adsense/answer/7299563.
- OpenSEO audit 0493d698-2ade-435a-8fc8-9693a02e71ea crawled 50/50 but stopped at limit with 233 discovered URLs uncrawled. Reported 14 critical broken internal links + 14 nested 404 targets, two long descriptions (/home-construction/ 163 chars, /sourdough-calculator/ 165 chars), and no broad missing-title/description/H1/alt cluster. Lighthouse 0/20 succeeded due insufficient credits; no CWV conclusion.
- Existing crawl contained 36 readable public content pages. Task-specific pages include Wire Size (~3290 extracted words), Business Hours (~1876), Spreader Calibration (~1871), Deck Joist (~1484), Gravel (~1407). Word count is not an approval threshold. /math-science/ is the clearest weak hub (~158 words) and has 170 GSC impressions, 0 clicks, avg position 19.6 in pre-release window. Review other hubs for repeated boilerplate, not automatic expansion.
- GSC through 2026-11-20 (pre-Nov-22 releases): Time 1479 impressions/4 clicks/CTR .27%/avg pos 12.3; query “time calculator” 1068 impressions/2 clicks/avg pos 7.4. Business Hours 181/0/9.0; Wire Size 563/0/70.7. Do not attribute these to Nov 22 releases. Deck Joist: 184 impressions/3 clicks/avg pos 6.7/CTR 1.63% in joined report.
- GSC shows legacy .html variants alongside slash URLs; audit redirects/canonicals/sitemap. GA4 organic report includes pages.dev preview hosts, contaminating production-only analysis; filter host/stop preview event sending and define useful calculator-completion events.
- Priority: (1) PR #9 preview/render validation then explicit merge approval; (2) URL/canonical/sitemap consistency; (3) useful original content for Math & Science/category hubs; (4) real value for common utilities, no filler; (5) GA4 host/event measurement; (6) trim 2 meta descriptions; (7) broader crawl and Lighthouse when budget permits.
- Hold AdSense review until navigation live/verified, URL consistency confirmed, low-differentiation pages improved, trust pages/sitemap verified, and fresh crawl has no critical internal broken links. Approval not guaranteed. Production and review untouched.



## Audit follow-up verification (2026-11-24)
- Live sitemap.xml has 36 canonical slash-form content URLs and no legacy .html variants; robots.txt permits crawling and references sitemap.
- Live fetches of five sampled legacy .html URLs resolved to the canonical slash pages with final status 200. No duplicate-content issue is confirmed; GSC legacy rows are likely historical redirect-source data. Monitor rather than change redirects unnecessarily.
- /math-science/ is short (~158 extracted words) but currently has unique summaries for five tools and a category conclusion. Improve with a concise, helpful selection workflow/example—not filler. Pre-release GSC: 170 impressions, 0 clicks, avg position 19.6.
- Digital & Developer, Energy & Electrical, and Home & Construction live hubs include differentiated workflows/measurement guidance; do not classify them as thin just from length.
- UUID tool offers browser-local secure generation, v4/v7, batch, validation, timestamp inspection and download; Aspect Ratio offers ratio, missing dimension, resize, preview and presets. Common utility pages should be assessed by actual functionality, not word-count alone.
- Cloudflare review and production projects are connected to private utility-platform; PR #9 is in public repo. Public/private main master-ui.js SHA currently matches. Review project supports all branch previews. A private-repo draft PR would provide the connected preview route; not created in this audit. No deployment or repo wiring changed.


# PINPOINT RESUME CHECKPOINT — 2026-11-24
User explicitly asked to save the full audit conclusion at this point and continue from this exact checkpoint; do not repeat completed audit.

- AdSense ownership verified; screenshot rejection is Low-value content. Review not submitted; approval not guaranteed.
- Crawl audit 0493d698-2ade-435a-8fc8-9693a02e71ea: 50-page sample, 233 discovered URLs uncrawled; 14 critical broken internal links + 14 nested 404s. PR #9 addresses shared navigation but remains draft/open/unmerged and not live.
- PR #9 https://github.com/saqibali49005-ship-it/Zemtool-public-/pull/9. Foundation and browser regression passed at last checkpoint; preview gates incomplete. Do not claim Rule Green/merge/deploy.
- Sitemap has 36 canonical slash URLs and robots references it. Five sampled .html legacy URLs resolve to slash canonical; no duplicate defect confirmed. Do not edit redirects unnecessarily.
- /math-science/ (~158 extracted words) is main hub improvement candidate: add concise useful tool-selection/workflow/example, not padding. Other reviewed hubs/trust pages have differentiated content. Specialist calculators and UUID/Aspect Ratio utilities have real user-value features; assess functionality, not length.
- GSC through Nov 20 predates Nov 22 releases: Time 1479/4/.27%/12.3; “time calculator” 1068/2/7.4; Business Hours 181/0/9.0; Wire Size 563/0/70.7; Deck Joist 184/3/6.7/1.63%. Hold three recent pages for post-release data.
- GA4 organic report contains pages.dev preview hosts; filter production hostname/prevent preview events and define meaningful calculator events.
- Two long descriptions: /home-construction/ 163 chars; /sourdough-calculator/ 165 chars. Lighthouse 0/20 due insufficient credits; no CWV conclusion.
- Cloudflare production/review projects connect to private utility-platform; review supports branch previews. Public PR #9 is not directly connected. Matching private draft PR/branch is proposed but not created. No production, AdSense, or repo-wiring change.

Resume: (1) inspect private branch/current file and safely mirror only PR #9 patch into private draft PR/branch; (2) verify connected preview commit/deployment and rendered nav on home/nested pages, breadcrumbs, no nested relative URLs/404s, regression tests; (3) document evidence in both records and ask explicit merge approval if passed; production deploy separately approved; (4) after release, broader crawl and verify critical links; (5) improve Math & Science and GA4 measurement separately; (6) reassess AdSense review only after gates, never submit automatically.

Guardrails: production/live and AdSense untouched; no merge/deploy, Cloudflare wiring change, paid audit or broad rewrite without approval. Continue from this checkpoint.


## Public-main operating switch — 2026-11-24
- User explicitly directed: private repo Actions spending/billing limit is exhausted; from this checkpoint manage the project on the public repository `Zemtool-public-`, branch `main`, as the primary working source. Do not depend on private PR #127 or its runner for routine development/validation.
- Screenshot of Foundation Check #1726 confirms the job never started: GitHub annotation says recent account payments failed or spending limit must be increased (Billing & plans). This is an account billing gate, not evidence of a code/test failure. Do not characterize it as a regression failure; avoid triggering unnecessary Actions runs while the account limit remains.
- Applied the root-relative shared navigation fix directly to public `main` in three scoped commits:
  1. `e7866512cd1ea1e8995dbc7d69077cbedd34f12b` — add normalization after shared header/footer initialization in `master-ui.js`.
  2. `8e4af754eff01a770309f64c54d755a0dd971950` — add `tests/root-relative-navigation.browser.mjs` for Aspect Ratio, Business Hours, Deck Joist Blocking and Wire Size.
  3. `1a3c98230232ee1ecf6fe4a241fc7a6a7ab5a75e` — register that browser regression in `foundation-check.yml`.
- Public PR #9 is now redundant because its scoped code/test/workflow patch has been landed on public main; close it to prevent duplicate/unclear review path. Do not merge unrelated open PRs (#1/#2/#7) as part of this switch; retain their existing review states.
- Main code is updated, but **CI verification is pending/unavailable due billing**. Do not declare Rule Green until the account billing issue is resolved and Foundation Check passes or the same suite is run by a reliable non-billing local validation route. Do not claim the browser regression ran merely because it was committed.
- Production/live site, Cloudflare production settings, DNS, AdSense, analytics, and locked calculator benchmark pages remain unchanged. Public main is now the source of truth for code management, not an automatic production deploy authorization.
- Next: verify the three commits/files on public main; inspect public PR states and keep unrelated drafts untouched; continue scoped improvements directly on public main with manual/static checks while Actions is blocked; re-enable CI only after account owner resolves billing. Record every commit and verification level here.
