# tree-sitter-gsformula — Repo Guide (hand-maintained)

Tree-sitter grammar for Google Sheets formulas, plus Neovim queries. `README.md`
covers scope, supported syntax, and the query set — read it first and don't
duplicate it here. This file holds what isn't obvious from the code: the release
sequence, the cross-repo coupling, and the traps that have already cost a
force-moved tag.

## Scope constraint (constrains what to build)

**Highlighting-only.** The grammar exists to make one cell's formula legible in
an editor, not to evaluate it or prove it valid. So:

- Accepting a formula Sheets would reject is fine. Rejecting one Sheets accepts
  is a bug — queries still capture inside an `ERROR` node, but the node
  structure they match against is gone, so highlighting degrades to noise
  around the misparse.
- Don't add semantic validation (arity checks, type rules, name resolution).
  That belongs in `gsfmt`, if anywhere.
- Dot-decimal locale only (`1.5`, `,` separators). `;`-separated input is
  `gsfmt`'s problem to normalize, not the grammar's to parse.

## Commands

```sh
tree-sitter generate              # grammar.js → src/ (parser.c, grammar.json, node-types.json)
tree-sitter test                  # corpus tests, test/corpus/*.txt — 81 parses
tree-sitter parse examples/*.gsfx # must be zero ERROR/MISSING nodes
tree-sitter build                 # build the shared object
npm test                          # Node binding test (needs npm install first)
ts_query_ls check -f queries/     # query lint — CI installs it; not on PATH locally
```

`tree-sitter test --update` rewrites expected sexps in the corpus. Read the diff
before keeping it — it will happily bless a regression.

## Release procedure

Order matters. The tag is the expensive thing to move, so it goes last.

```sh
tree-sitter version 0.3.1         # rewrites six manifests, NOT src/parser.c
tree-sitter generate              # regenerate so parser.c metadata matches
tree-sitter test                  # 81/81
tree-sitter parse -q examples/*.gsfx   # no CI job parses these — see below
git add -A && git commit -m "chore: release v0.3.1"
git push                          # let CI speak BEFORE tagging
gh run watch "$(gh run list -w CI -c "$(git rev-parse HEAD)" --limit 1 \
  --json databaseId --jq '.[0].databaseId')" --exit-status
git tag -m "v0.3.1 — <summary>" v0.3.1
git push --tags
gh release create v0.3.1 --verify-tag --title v0.3.1 --notes "…"
```

Two details in that block are load-bearing. The `gh run list` call is filtered by
workflow **and** commit because this repo also has a `Copilot` workflow — an
unfiltered `--limit 1` will happily hand you a green Copilot run and let you tag
a red CI head. And `tree-sitter parse` on the examples is a **local-only** gate:
no CI job parses `examples/*.gsfx`. The corpus job reads `test/corpus/`,
`ts_query_ls` checks `queries/` against the parser, and `examples/**` appears in
the workflow only as a `paths` trigger. If you skip that command, nothing checks
them.

Then bump the consumer pin: `REF="v0.3.1"` in the dotfiles hook
`.chezmoiscripts/run_onchange_after_treesitter-gsformula.sh.tmpl`, and
`chezmoi apply`. The hook does `git clone --branch <tag>`, so the tag must be on
GitHub first or the apply fails.

### Why the generate step is not optional

`tree-sitter version` bumps `tree-sitter.json`, `Cargo.toml`, `package.json`,
`pyproject.toml`, `CMakeLists.txt`, and `Makefile` — and stops there. It does
**not** regenerate `src/parser.c`, whose embedded `TSLanguage` metadata carries
its own `major/minor/patch`. Skip `tree-sitter generate` and you ship a parser
that reports the previous version.

`tree-sitter test` passes 81/81 in that state — the corpus doesn't check
generated-file freshness. Only CI catches it, via
`tree-sitter/parser-test-action`'s `git diff --exit-code -- src/parser.c`. This
happened on v0.3.0: manifests weren't in the CI `paths` filter, so the release
commit triggered no CI at all, the stale `parser.c` got tagged, and the tag had
to be force-moved after an amend. The filter now includes those six manifests
(`f851ff3`), so CI runs — but it can only fail a commit that already exists,
which is why you push and wait before tagging.

## Cross-repo coupling

`examples/*.gsfx` are **not** free to edit. `gsfmt`'s CI has a `Fixture sync`
job that diffs six files — `gnarly`, `monthly`, `payperiods` and their `.min`
variants — against `gsfmt`'s `tests/data/`, which is **canonical**. It checks out
this repo's default branch *unpinned*, so drift here fails `gsfmt`'s next CI run
— not at the moment you push, but on its next push, PR, or manual run, which
makes it look like an unrelated break. Change `tests/data/` in `gsfmt` first,
then mirror it here.

That fixture diff is the whole contract. `gsfmt` does **not** depend on this
grammar: its `[dependencies]` is empty and it has its own lexer and parser, so
node renames and tree-shape changes cannot break it. They break query files and
any real Tree-sitter consumer (the Neovim install), which is where to look.

## Traps

- **`Cargo.lock` is gitignored.** Use plain `cargo test` — never `--locked`, it
  fails with no lockfile to honor.
- **Tags are SSH-signed annotated objects** (`tag.gpgsign=true`,
  `gpg.format=ssh`). A bare `git tag v0.3.1` dies with
  `fatal: no tag message?` in a non-interactive shell. Always pass `-m`. And
  `git ls-remote --tags` returns the *tag object* sha — peel with
  `git ls-remote origin 'refs/tags/v0.3.1^{}'` to compare against a commit.
- **This repo root has a `pyproject.toml`** (the Python binding). `uv run --with
  <pkg> …` therefore treats it as the enclosing project and writes a stray
  `uv.lock`. Use `uv run --no-project` for throwaway scripts.
- **CI `paths` filters gate both automatic triggers.** Adding a top-level file
  that should gate CI means adding it to *both* the `push` and `pull_request`
  lists in `.github/workflows/ci.yml`. `workflow_dispatch` is unfiltered — it is
  the escape hatch for verifying a head the filters skipped, not a substitute
  for listing the path.
- **The `Fuzz scanner` job runs on every CI trigger, but its fuzzer step is
  conditional** on `src/scanner.c` having changed. There is no scanner in this
  grammar today, so that step never fires; don't read the job's green as
  coverage.

## Conventions

- Conventional commits, imperative subject: `feat(grammar):`, `fix(grammar):`,
  `test(corpus):`, `docs:`, `ci:`, `chore:`.
- Linear history — PRs are rebase-merged, no merge bubbles.
- Corpus tests are the specification. A grammar change without a corpus case
  pinning it is incomplete; a claim in `README.md` without a corpus case
  backing it is a liability — v0.3.0 dropped the documented "range
  intersection/union" operators, which the grammar never implemented and
  Sheets doesn't accept (`0397c0b`).
- Commit `src/` output alongside `grammar.js` in the same commit. CI enforces
  that the checked-in parser matches the grammar.
