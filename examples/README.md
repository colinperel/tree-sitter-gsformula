# Examples

Real-shaped Google Sheets formulas the grammar must parse with zero
`ERROR`/`MISSING` nodes. CI validates every `queries/*.scm` against
these files via `tree-sitter query`.

Six of these — `gnarly`, `monthly`, `payperiods` and their `.min`
variants — are formatter fixtures: each is formatted by `gsfmt` (the
formatter this grammar was built alongside) and paired with a `--minify`
variant of the same formula. The content is synthetic but mirrors the
structural complexity of production formulas: deep LET/LAMBDA nesting,
immediately-invoked lambdas, sheet-qualified open ranges, table
references, blank arguments, and percent/exponent literals. Their
canonical copies live in the `gsfmt` repository (`gsfmt/tests/data/`),
where the formatter generates them as goldens; the files here mirror
those byte-for-byte and are not free to edit.

Anything else is a standalone query-coverage example, owned by this
repo alone: it exists so the query goldens exercise captures the
mirrored fixtures never hit — `errors.gsfx` covers error literals,
`queries.gsfx` covers SQL injection into `QUERY` (both its capturing
direct-string form and its non-capturing concatenated form). Standalone
examples have no `.min` pair and no gsfmt counterpart, and can be
edited freely — regenerate the goldens in the same commit. Comma-decimal
locale examples are deliberately absent: this grammar is dot-locale
only — see the scope note in the top-level README.
