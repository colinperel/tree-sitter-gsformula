# Query capture goldens

One golden per `queries/*.scm`: the full `tree-sitter query` capture dump
over every `examples/*.gsfx`. The `Parse examples` CI job regenerates and
diffs them, so a grammar or query edit that silently changes what a
pattern captures — or makes it capture nothing — fails loudly instead of
shipping green. `ts_query_ls` lints syntax; these check behavior.

Regenerate after an intentional grammar, query, or example change:

```sh
tree-sitter build
for q in queries/*.scm; do
  tree-sitter query "$q" examples/*.gsfx > "test/query-goldens/$(basename "$q" .scm).txt"
done
```

Review the diff before committing — the diff *is* the behavior change.
A tree-sitter CLI upgrade can also reformat this dump; if the goldens
diff with no local edits, regenerate with the new CLI in the same commit
that regenerates `src/parser.c`.
