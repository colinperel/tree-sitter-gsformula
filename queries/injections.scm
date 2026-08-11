; Inject SQL highlighting into QUERY's query-string argument. The Google
; Visualization query language is not SQL, but it is SQL-shaped enough
; (SELECT / WHERE / GROUP BY / ORDER BY / LIMIT) that a SQL parser
; highlights it well; the GViz-only clauses (LABEL, FORMAT, OPTIONS)
; degrade to plain text, not errors, under error-tolerant highlighting.
;
; Only a direct string literal is injected: a query assembled by `&`
; concatenation has no single node to inject into, and per-fragment
; injection would hand the SQL parser mid-clause snippets. The #offset!
; trims the surrounding quotes so the injected parser never sees them.
((call_expression
  function: (identifier) @_head
  (arguments
    .
    (_)
    .
    (string) @injection.content))
  (#match? @_head "^[Qq][Uu][Ee][Rr][Yy]$")
  (#offset! @injection.content 0 1 0 -1)
  (#set! injection.language "sql"))
