# ZemTools

Public source snapshot for the ZemTools utility website.

- Website: https://zemtools.com/
- This repository contains public-facing website source and automated validation tests.
- Internal planning, competitor research, keyword strategy, project logs, backups, and deployment credentials are maintained separately.
- This repository is not connected to production deployment. Changes here do not publish to the live website.

## Validation

The Foundation Check workflow runs automated contract, unit, and browser regression checks on GitHub-hosted runners.

## Safety

Electrical calculators provide planning estimates only. They do not replace applicable electrical codes, qualified design, or installation verification.

## Repository operating policy

- **Public-first development:** This repository is the default workspace for normal ZemTools source work, tests, PRs, validation, and non-sensitive progress/operational notes.
- Track routine workflow/runtime usage, free-tier/quota/build/preview limitations, and sanitized cost or payment-status observations here when useful. Never commit payment credentials, personal billing documents, account identifiers, secrets, tokens, or private security evidence.
- The private `utility-platform` repository is reserved for the canonical Master Plan and genuinely sensitive/security/confidential records. Do not duplicate ordinary work there.
- Keep public and private work balanced through relevant, approved synchronization—not repeated or pointless parallel effort.
- This public repository is not connected to production deployment. A public merge does not publish the live site; release approval and existing verification gates remain mandatory.


## Paired repository checkpoint policy

ZemTools is managed as one synchronized project across the public development repository and the private canonical Master Plan. Public is the normal execution workspace; private holds the canonical plan and genuinely sensitive records. After every material public milestone, update the private Master Plan and this public-safe checkpoint together. Before new work, reconcile both records. If either update is pending, label the checkpoint **NOT IN SYNC** and close the gap before calling it complete.

The private Master Plan is canonical for decisions and sensitive governance, but it must stay current with public implementation, validation, blockers, Rule Green and next steps. Public records contain only sanitized progress, links, test outcomes, and routine quota/runner/build/preview observations—never credentials, personal billing documents, account identifiers, secrets, or private security evidence. Public merges do not deploy production; release approval remains explicit.
