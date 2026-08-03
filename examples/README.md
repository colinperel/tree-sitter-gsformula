# Examples

Real-world Google Sheets formulas the grammar must parse with zero
`ERROR`/`MISSING` nodes. CI validates `queries/highlights.scm` against
these files via `tree-sitter query`.

Copied from `tools/gsfmt/tests/data/` (the formatter's fixtures) so the
grammar directory stays self-contained — if this grammar is ever
extracted to its own repository, nothing here reaches back into the
dotfiles tree. `comma_locale.gsf` is deliberately not copied: this
grammar is dot-locale only (see the scope decision in
`docs/proposals/tree-sitter-gsformula.md`).
