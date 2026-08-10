; Locals for Google Sheets formulas: raw scope, definition, and reference
; captures for LET names and LAMBDA parameters.
;
; What a consumer gets from these captures is up to the consumer:
; tree-sitter's own highlight crate reads the exact names `local.scope`,
; `local.definition`, and `local.reference` (subcaptures like
; `.definition.var` are opaque to it), so definitions are captured under
; both the generic and the specific name. nvim-treesitter itself does not
; consume locals queries; plugins that do (nvim-treesitter-refactor and
; friends) read the `@local.definition.*` subcaptures. The goldens under
; test/query-goldens/ pin these raw captures, not any resolution built on
; them.
;
; Resolution by nearest enclosing scope is slightly coarser than Sheets'
; true rule (a LET name is not visible in its own value expression, only
; to subsequent values and the result). The self-shadowing corner
; (`LET(sum, sum(A1), …)` — the value's `sum` is the builtin) is accepted
; as a known approximation, the same trade-off gsfmt documents.
; ── scopes ──────────────────────────────────────────────────────────────
(let_expression) @local.scope

(lambda_expression) @local.scope

; ── definitions ─────────────────────────────────────────────────────────
(let_binding
  name: (identifier) @local.definition @local.definition.var)

(lambda_expression
  parameter: (identifier) @local.definition @local.definition.parameter)

; ── references ──────────────────────────────────────────────────────────
; Every identifier is a candidate reference, including one in call-head
; position: a bound name invoked as a function (`myTax(1000)`, a LAMBDA
; passed as an argument and called) resolves to its binding. Identifiers
; with no matching definition — builtin function names, named ranges,
; bare range columns — simply resolve to nothing, which is correct.
(identifier) @local.reference
