# Significant Figures decimal precision plan — 26 November 2026

## Scope
Test-first precision upgrade for `significant-figures-engine.js` on feature branch `feature/significant-figures-decimal-precision-2026-11-26`, based on migration candidate `migration/verified-source-consolidation-2026-11-24`.

## Observed implementation gaps
- Arithmetic parses source tokens, then converts both operands to JavaScript `Number`, losing decimal source precision and potentially large integer digits.
- Rounding also converts source strings to `Number`, so textbook decimal ties can be affected by binary floating-point representation.
- `normalizeNumeric` removes all commas without validating grouping when used by count/round.
- The page's output is not explicit about an approximation bound for non-terminating division.

## Contract tests added
- Exact source-decimal examples: `0.1 + 0.2`, `100.0 - 99.9`.
- Large integer-significand multiplication.
- Half-up ties away from zero: `2.675`, `1.005`, `±1.25`.
- Carry and exponent output: `9.996` to 3 SF and `1e-200`.
- Measurement precision rules after working precision.
- Repeating division `1.0 / 3.0` with explicit bounded working precision.
- Invalid comma grouping in all entry modes.
- Input magnitude/length guardrails.

## Proposed implementation policy (pending RED confirmation)
- Preserve original validated decimal strings through parsing and counting.
- Use Decimal.js only with string constructor inputs and an isolated clone.
- Do not claim unlimited exact arithmetic. Choose a bounded, documented working precision sufficient for configured input limits, or use exact integer-coefficient arithmetic for finite decimal operations.
- Division by a non-terminating rational is an approximation. State and test its working precision.
- Apply significant-figure/decimal-place rounding once after the operation, with ROUND_HALF_UP (ties away from zero), after confirming existing education policy.
- Bound input token length and exponent; reject overflow/out-of-budget inputs clearly.
- Validate grouping before removing commas.

## Validation gate
1. Observe RED in Foundation Check for the new contract suite.
2. Implement only the engine/helper files required.
3. Re-run contract, existing engine, and Significant Figures browser tests.
4. Re-run Foundation Check to completion.
5. Keep PR draft and unmerged; no production, DNS, Cloudflare, legacy repository, analytics or AdSense changes.

## Current status
- This branch is a separate precision workstream; PR #13 parser patch remains separate and draft.
- The exact arithmetic contract is proposed by tests, not yet implemented.
- No merge/release/production approval is requested or assumed.
