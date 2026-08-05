# Examples

Real-shaped Google Sheets formulas the grammar must parse with zero
`ERROR`/`MISSING` nodes. CI validates every `queries/*.scm` against
these files via `tree-sitter query`.

Each `.gsf` is formatted by `gsfmt` (the formatter this grammar was
built alongside) and paired with a `--minify` variant of the same
formula. The content is synthetic but mirrors the structural complexity
of production formulas: deep LET/LAMBDA nesting, immediately-invoked
lambdas, sheet-qualified open ranges, table references, blank arguments,
and percent/exponent literals. Comma-decimal locale examples are
deliberately absent: this grammar is dot-locale only — see the scope
note in the top-level README.
