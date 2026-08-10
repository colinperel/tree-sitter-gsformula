# tree-sitter-gsformula

[Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for
[Google Sheets](https://sheets.google.com) formulas.

## Scope

Parses a single formula (the content of one cell), optionally prefixed
with `=`, in the **dot-decimal locale** (`1.5`, arguments separated by
`,`). Covered syntax:

- cell references and ranges, absolute (`$A$1`) and sheet-qualified
  (`'My Sheet'!A1:B2`), including bare row/column ranges (`A:A`, `1:3`)
- function calls, including zero-argument (`NOW()`) and blank arguments
  (`IF(x,,y)` — meaningful in Sheets, distinct from `""`)
- `LET` and `LAMBDA` with field-captured binding sites, plus
  immediately-invoked callables (`LAMBDA(x, x * 0.3)(1000)`)
- [table references](https://support.google.com/docs/answer/15637642)
  (`Table1[Column 1]`, `Table1[#ALL]`,
  `Table1[[#HEADERS],[Col A]:[Col C]]`) and chip extraction
  (`Table1[Col].[file name]`)
- array literals (`{1, 2; 3, 4}`), the operator set (arithmetic,
  comparison, `&` concatenation, `%` postfix, `^` exponentiation, `:`
  range), string/number/boolean/error literals

Comma-decimal locales (`1,5` / `;` separators) are out of scope; the
same formula text is lexically ambiguous between locales, so a variant
grammar rather than runtime detection would be required.

## Queries

`queries/` ships highlights, indents, folds, locals, and textobjects —
written
for Neovim's capture conventions (`@function.builtin`,
`@variable.parameter` on LET/LAMBDA binding sites, `@property` on chip
fields). The indent query handles incomplete input: unclosed delimiters
inside `ERROR` nodes still indent while you type.

## Development

```sh
tree-sitter generate   # grammar.js → src/
tree-sitter test       # corpus tests (test/corpus/)
tree-sitter parse examples/*.gsfx
```

`examples/` holds real-shaped synthetic formulas that must parse with
zero `ERROR`/`MISSING` nodes; CI parses them and diffs every query
file's captures over them against `test/query-goldens/` in applicable
CI runs (branch- and path-filtered pushes, PRs, manual dispatch).

## Provenance

Extracted from my [dotfiles](https://github.com/colinperel) with
history preserved; commit messages referencing PR numbers predate the
extraction. Originally built as the editing companion to `gsfmt`, a
Google Sheets formula formatter.
