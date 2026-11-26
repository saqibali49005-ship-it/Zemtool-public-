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

## Implemented policy (pending CI verification)
- Preserve original validated decimal strings through parsing and counting.
- Finite decimal inputs are parsed into a signed BigInt coefficient plus base-10 scale; add, subtract and multiply use integer arithmetic without binary floating-point conversion.
- Decimal source strings are passed through parsing/count/round operations, not first converted to JavaScript Number.
- Decimal half-up (ties away from zero) is implemented with integer quotient/remainder arithmetic.
- Division is deliberately bounded to 60 significant working digits, then the result is rounded to the operands' significant-figure limit. It is an approximation, not unlimited exact arithmetic.
- Inputs are limited to 256 characters and exponent/scale magnitude 1000; power-of-ten internal operations are separately bounded.
- Thousands separators are checked for valid three-digit grouping before removal.

## Validation gate
1. RED was confirmed in Foundation Check #89: `0.1 + 0.2` returned `0.30000000000000004` instead of `0.3`.
2. BigInt decimal engine implementation committed as `47e5bf47ae21ff334fceabeade2847b18bfb2eba`.
3. Foundation Check #90 exposed a missing exported compatibility adapter (`roundAtDecimalPosition`); restored in commit `a57c75751a2c69431666c8d27cd9f5a041238772`.
4. Latest head CI result has not yet been returned. Do not call implementation green until the existing engine tests, precision suite, Significant Figures browser suite, and full Foundation Check pass.
5. Keep PR draft and unmerged; no production, DNS, Cloudflare, legacy repository, analytics or AdSense changes.

## Current status
- This branch is a separate precision workstream; PR #13 parser patch remains separate and draft.
- Precision contract RED was observed; BigInt engine implementation is committed but remains unverified by a completed CI run at the current head.
- A CI integration regression was fixed by restoring the exported decimal-place rounding adapter.
- No merge/release/production approval is requested or assumed.
