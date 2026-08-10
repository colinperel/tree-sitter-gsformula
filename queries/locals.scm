; Locals for Google Sheets formulas: raw scope, definition, and reference
; captures for LET names and LAMBDA parameters.
;
; What a consumer gets from these captures is up to the consumer:
; tree-sitter's own highlight crate reads the exact names `local.scope`,
; `local.definition`, and `local.reference` (subcaptures like
; `.definition.var` are opaque to it), while locals-consuming nvim
; plugins (nvim-treesitter-refactor and friends) read the
; `@local.definition.*` subcaptures — nvim-treesitter itself does not
; consume locals. Generic and typed definition captures live in separate
; patterns because legacy nvim-treesitter's collector nests same-pattern
; captures into one object and stops at the generic node, hiding the
; typed child. The goldens under test/query-goldens/ pin these raw
; captures, not any resolution built on them.
;
; Two accepted approximations of Sheets' real binding rules, the same
; trade-offs gsfmt documents:
;
;   - Nearest-enclosing-scope resolution is coarser than Sheets' rule
;     that a LET name is visible only to subsequent values and the
;     result — in the self-shadowing corner (`LET(sum, sum(A1), …)`)
;     the value's `sum` is really the builtin.
;   - Sheets bindings are case-insensitive, but tree-sitter consumers
;     compare definition/reference text exactly, so `foo` does not
;     resolve to a `Foo` binding. Consistently-cased formulas resolve
;     fully.
; ── scopes ──────────────────────────────────────────────────────────────
(let_expression) @local.scope

(lambda_expression) @local.scope

; ── definitions ─────────────────────────────────────────────────────────
(let_binding
  name: (identifier) @local.definition)

(let_binding
  name: (identifier) @local.definition.var)

(lambda_expression
  parameter: (identifier) @local.definition)

(lambda_expression
  parameter: (identifier) @local.definition.parameter)

; ── references ──────────────────────────────────────────────────────────
; Every identifier is a candidate reference, including one in call-head
; position: a bound name invoked as a function (`myTax(1000)`, a LAMBDA
; passed as an argument and called) resolves to its binding. Identifiers
; with no matching definition — builtin function names, named ranges,
; bare range columns — resolve to nothing.
(identifier) @local.reference
