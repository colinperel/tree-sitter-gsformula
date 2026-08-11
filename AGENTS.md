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
tree-sitter test                  # corpus tests, test/corpus/*.txt — must be all green
tree-sitter parse examples/*.gsfx # must be zero ERROR/MISSING nodes
tree-sitter build                 # build the shared object
npm test                          # Node binding test (needs npm install first)
ts_query_ls check -f queries/     # query lint — CI installs it; not on PATH locally
```

`tree-sitter test --update` rewrites expected sexps in the corpus. Read the diff
before keeping it — it will happily bless a regression.

## Release procedure

Order matters. The tag is the expensive thing to move, so it goes last.

Run it as a **fail-fast subshell**, not as lines pasted one at a time. Half this
block is checks, and a check whose non-zero exit doesn't stop the sequence is
decoration.

```sh
( set -eu

V=0.3.1                           # ← the release you are cutting, not the last one

R=colinperel/tree-sitter-gsformula # pin `gh`; don't let it infer from remotes

# Preflight. Every check assigns first and tests second: `set -e` cannot see a
# command failing *inside* `$(…)` used as a test argument, so `test -z "$(git
# status --porcelain)"` would read a broken `git` as a clean tree and release
# anyway. Assignment failure aborts.
branch=$(git rev-parse --abbrev-ref HEAD)
test "$branch" = main || { echo "on $branch, not main"; exit 1; }
git fetch origin main
head_sha=$(git rev-parse HEAD)
# FETCH_HEAD, not origin/main: the fetch above always writes FETCH_HEAD, but it
# only updates the remote-tracking ref when remote.origin.fetch maps that
# branch. Against a narrowed refspec, origin/main can be stale — and comparing
# against a stale ref would wave through a push that resurrects rewound commits.
main_sha=$(git rev-parse FETCH_HEAD)
test "$head_sha" = "$main_sha" || { echo "main not in sync with origin"; exit 1; }
dirty=$(git status --porcelain)
test -z "$dirty" || { echo "dirty worktree"; exit 1; }
# Signing preflight. The config checks assert the signature *kind*; they cannot
# prove the key is usable (wrong path, absent agent, locked key). So actually
# sign something. This matters for ordering: the real `git tag -s` happens after
# the release commit is already pushed, so without a probe here a signing
# failure would strand a published commit. `|| true` on the lookups because
# "unset" is a normal answer there.
fmt=$(git config --get gpg.format || true)
test "$fmt" = ssh || { echo "gpg.format is '$fmt', not ssh"; exit 1; }
key=$(git config --get user.signingkey || true)
test -n "$key" || { echo "no signing key configured"; exit 1; }
# Ref-free: signs a dangling commit object rather than a throwaway tag, so it
# can't collide with or delete a tag you own. The object is unreachable and gets
# garbage-collected. Same signing path as `git tag -s`.
git commit-tree -S -m probe "$(git rev-parse 'HEAD^{tree}')" >/dev/null

tree-sitter version "$V"          # rewrites six manifests, NOT src/parser.c
tree-sitter generate              # regenerate so parser.c metadata matches
tree-sitter test                  # must pass
tree-sitter parse -q examples/*.gsfx   # no CI job parses these — see below

# Stage exactly the release surface; never `git add -A` here.
git add tree-sitter.json Cargo.toml package.json pyproject.toml \
        CMakeLists.txt Makefile src/
# Conditional so a re-run after fixing forward doesn't die here: if the version
# and generated files are already correct, nothing is staged and `git commit`
# would exit 1.
if git diff --cached --quiet; then
  echo "nothing staged — re-verifying the existing head"
else
  git commit -m "chore: release v$V"
fi
git push origin HEAD:main         # explicit src:dst; ignores push.default et al

# Poll: the run is not registered the instant the push returns.
sha=$(git rev-parse HEAD)
id=""
for _ in $(seq 1 30); do
  id=$(gh run list -R "$R" -w CI -c "$sha" --limit 1 --json databaseId --jq '.[0].databaseId')
  [ -n "$id" ] && break
  sleep 5
done
[ -n "$id" ] || { echo "no CI run for $sha — do not tag"; exit 1; }
gh run watch -R "$R" "$id" --exit-status

git tag -s -m "v$V — <summary>" "v$V"   # -s: don't rely on global tag.gpgsign
git push origin "v$V"                    # not --tags: pushes only this tag
gh release create "v$V" -R "$R" --verify-tag --title "v$V" --notes "…"
)
```

### If it aborts partway

The block publishes the release commit before it tags, so an abort after the
`git push origin HEAD:main` step leaves a commit on `main` with no tag. That is
a recoverable state, not a broken one, and it does not need an amend or a force
push:

- **Red CI.** Commit the fix **and push it** before re-running — the preflight
  refuses a dirty tree, and refuses a local commit that isn't on the remote, so
  a half-finished fix cannot get through. Then re-run the whole block, setting
  `V` to the same version you were cutting. The
  commit step is conditional precisely so this works: on the re-run the version
  and generated files are already correct, nothing stages, and the block falls
  through to re-verifying and tagging the fixed head.
- **Signing failed at the tag step** (the probe should have caught it — if it
  didn't, say why in a commit so the probe can be tightened). Repair signing,
  then tag and push that same SHA directly; nothing else needs redoing.
- **Anything before the push.** Nothing was published, so you can discard local
  work — but do it against a *freshly fetched* ref, not `origin/main`, which may
  be stale for exactly the reason the preflight fetches to `FETCH_HEAD`:

  ```sh
  git fetch origin main
  git reset --hard FETCH_HEAD   # DESTRUCTIVE: discards local commits and
                                # uncommitted changes. Check `git status` first.
  ```

- **After the tag was created.** Re-running the whole block does *not* recover
  these — it would abort on the existing tag — so retry the failed step alone.
  Write the values out literally: `$V` and `$R` died with the subshell, and in a
  fresh shell they expand to nothing (under `set -u` they abort instead).

  | Failed at | State | Retry |
  | --- | --- | --- |
  | `git push origin vX.Y.Z` | tag exists locally only | `git push origin vX.Y.Z` |
  | `gh release create` | tag is on GitHub, no release | `gh release create vX.Y.Z -R colinperel/tree-sitter-gsformula --verify-tag …` |

  Only delete and re-cut a tag if it points at the wrong commit, and only if
  nothing has consumed it yet — the dotfiles hook clones by tag, so a moved tag
  silently changes what an already-applied machine would fetch next.

Six things in that block are load-bearing, and all six are about not trusting
ambient state — the shell's, git's config, or GitHub's timing:

- **`set -eu` and the subshell.** Without fail-fast, a red `gh run watch
  --exit-status`, a failed test, a rejected push, or a signing failure just
  scrolls past and the next command tags anyway — the block would check
  everything and enforce nothing. The subshell keeps `set -e` out of your
  interactive shell.
- **It releases from `main` only.** The run lookup matches any CI run for the
  SHA, including a `pull_request` run, so without the branch and upstream
  assertions a green PR check could license a tag on a commit that never merged.
- **`git add` names the release surface.** `git add -A` would sweep in whatever
  else is lying around — a stray `uv.lock`, a build artifact, an unrelated edit.
- **`git tag -s`, not bare `git tag -m`.** Signing here comes from a *global*
  `tag.gpgsign=true`; on any machine without it, `-m` alone silently produces an
  unsigned tag that looks fine locally. `-s` fails loudly instead.
- **`git push origin "v$V"`, not `--tags`.** The latter publishes every local
  tag, including experiments you never meant to release.
- **The run lookup polls and aborts.** A single `gh run list` immediately after
  `git push` can return empty because the run isn't registered yet — and an
  empty id means the watch is skipped and the red head gets tagged anyway. It is
  also filtered by workflow *and* commit: this repo has a second active `Copilot`
  workflow, so an unfiltered `--limit 1` can hand back a green run for something
  else entirely.

`tree-sitter parse` on the examples is also enforced in CI: the `Parse
examples` job runs `tree-sitter parse -q examples/*.gsfx` and diffs every
`queries/*.scm`'s captures over them against `test/query-goldens/`
(regeneration recipe in that directory's README), and the `Fixture sync` job
diffs the six mirrored goldens against `gsfmt`'s canonical `tests/data/`.
Running the parse locally before pushing still saves a CI round-trip.

Then bump the consumer pin to the tag you just pushed, written out as a literal
(`REF="v1.2.3"`, not `REF="v$V"` — `$V` lived only in the subshell above, and
the hook is a separate `set -u` script that would abort on it), in the
dotfiles hook
`.chezmoiscripts/run_onchange_after_treesitter-gsformula.sh.tmpl`, and
`chezmoi apply`. The hook does `git clone --branch <tag>`, so the tag must be on
GitHub first or the apply fails.

### Why the generate step is not optional

`tree-sitter version` bumps `tree-sitter.json`, `Cargo.toml`, `package.json`,
`pyproject.toml`, `CMakeLists.txt`, and `Makefile` — and stops there. It does
**not** regenerate `src/parser.c`, whose embedded `TSLanguage` metadata carries
its own `major/minor/patch`. Skip `tree-sitter generate` and you ship a parser
that reports the previous version.

`tree-sitter test` passes clean in that state — the corpus doesn't check
generated-file freshness. Only CI catches it, via
`tree-sitter/parser-test-action`'s `git diff --exit-code -- src/parser.c`. This
happened on v0.3.0: manifests weren't in the CI `paths` filter, so the release
commit triggered no CI at all, the stale `parser.c` got tagged, and the tag had
to be force-moved after an amend. The filter now includes those six manifests
(`f851ff3`), so CI runs — but it can only fail a commit that already exists,
which is why you push and wait before tagging.

## Cross-repo coupling

Six of the `examples/*.gsfx` are **not** free to edit. `gsfmt`'s CI has a
`Fixture sync` job that diffs those six — `gnarly`, `monthly`, `payperiods`
and their `.min` variants — against `gsfmt`'s `tests/data/`, which is
**canonical**. Every other example is a standalone query-coverage file owned
by this repo alone (see `examples/README.md` for the current set); edit
freely, regenerating the query goldens in the same commit. It checks out this
repo at a **pinned release tag** (bumped with each synced release pair), so
day-to-day drift is caught by *this* repo's `Fixture sync` job instead, at the
moment you push. Change `tests/data/` in `gsfmt` first, then mirror it here.

That fixture diff is the whole contract. `gsfmt` does **not** depend on this
grammar: its `[dependencies]` is empty and it has its own lexer and parser, so
node renames and tree-shape changes cannot break it. They break query files and
any real Tree-sitter consumer (the Neovim install), which is where to look.

## Traps

- **`Cargo.lock` is gitignored.** Use plain `cargo test` — never `--locked`, it
  fails with no lockfile to honor.
- **Tags are SSH-signed annotated objects** (`tag.gpgsign=true`,
  `gpg.format=ssh`). A bare `git tag vX.Y.Z` dies with
  `fatal: no tag message?` in a non-interactive shell — pass `-m`, and prefer
  `-s` so signing doesn't depend on that global being set. And
  `git ls-remote --tags` returns the *tag object* sha — peel with
  `git ls-remote origin 'refs/tags/vX.Y.Z^{}'` to compare against a commit.
- **This repo root has a `pyproject.toml`** (the Python binding). `uv run --with
  <pkg> …` therefore treats it as the enclosing project and writes a stray
  `uv.lock`. Use `uv run --no-project` for throwaway scripts.
- **CI `paths` filters gate both automatic triggers.** Adding a top-level file
  that should gate CI means adding it to *both* the `push` and `pull_request`
  lists in `.github/workflows/ci.yml`. `workflow_dispatch` is unfiltered — it is
  the escape hatch for verifying a head the filters skipped, not a substitute
  for listing the path.

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
