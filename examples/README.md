# Examples

Real-world Google Sheets formulas the grammar must parse with zero
`ERROR`/`MISSING` nodes. CI validates every `queries/*.scm` against
these files via `tree-sitter query`.

Originally the test fixtures of `gsfmt` (the formatter this grammar was
built alongside). Comma-decimal locale examples are deliberately absent:
this grammar is dot-locale only — see the scope note in the top-level
README.
