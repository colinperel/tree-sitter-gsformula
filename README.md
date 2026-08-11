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

`queries/` ships highlights, indents, folds, locals, textobjects, and
injections — written for Neovim's capture conventions
(`@function.builtin`, `@variable.parameter` on LET/LAMBDA binding
sites, `@property` on chip fields). The indent query handles incomplete
input: unclosed delimiters inside `ERROR` nodes still indent while you
type. The injections query hands `QUERY`'s second argument to a SQL
parser when it is a direct string literal (the GViz query language is
SQL-shaped enough to highlight well); queries assembled by `&`
concatenation are left plain.

## Neovim

The repo doubles as a Neovim plugin: `ftdetect/` registers the `.gsfx`
extension as the `gsformula` filetype (Neovim ignores
`tree-sitter.json`'s `file-types` — that field is CLI-only), and
`queries/gsformula/` exposes the query files on the runtimepath. With
lazy.nvim:

```lua
{ "colinperel/tree-sitter-gsformula" }
```

The plugin does **not** install the parser itself. Either register it
with nvim-treesitter (`master` branch — the `main` rewrite has a
different registration API) and run `:TSInstall gsformula`:

```lua
require("nvim-treesitter.parsers").get_parser_configs().gsformula = {
  install_info = {
    url = "https://github.com/colinperel/tree-sitter-gsformula",
    files = { "src/parser.c" },
    branch = "main",
  },
  filetype = "gsformula",
}
```

or build it yourself (`tree-sitter build`) and drop the library on
`runtimepath` as `parser/gsformula.so`.

Making the parser and queries discoverable is not the same as turning
them on: core Neovim never starts tree-sitter highlighting by itself.
nvim-treesitter's highlight module does it for you when enabled; on the
manual path, start it per buffer:

```lua
vim.api.nvim_create_autocmd("FileType", {
  pattern = "gsformula",
  callback = function()
    vim.treesitter.start()
  end,
})
```

Keep exactly one copy of each query file on the runtimepath: Neovim
uses the first `highlights.scm` (etc.) it finds — later copies are
ignored unless they opt in with `;; extends` — so a stale copy earlier
on the runtimepath silently shadows the one this repo ships.

What each query needs:

| Query | Works with |
| --- | --- |
| `highlights.scm` | core `vim.treesitter` — no plugin |
| `injections.scm` | core, plus the `sql` parser for QUERY strings |
| `folds.scm` | core `vim.treesitter.foldexpr()` |
| `locals.scm` | locals-consuming plugins (nvim-treesitter-refactor and friends) — core Neovim ignores it |
| `indents.scm` | nvim-treesitter's indent module |
| `textobjects.scm` | nvim-treesitter-textobjects (or mini.ai) |

`queries/gsformula/` contains symlinks to the top-level `queries/`. On
Windows, clone with `core.symlinks=true` (or copy the files) — without
it git checks the links out as plain text files and the queries silently
do nothing.

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
