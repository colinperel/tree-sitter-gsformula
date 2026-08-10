; Locals for Google Sheets formulas: scope-aware resolution of LET names
; and LAMBDA parameters, so a binding site and its uses light up together
; and definition-jump works inside a formula.
;
; The model is tree-sitter's nearest-enclosing-scope resolution, which is
; slightly coarser than Sheets' true rule (a LET name is not visible in
; its own value expression, only to subsequent values and the result).
; Ordered resolution gets the common cases right; the self-shadowing
; corner (`LET(sum, sum(A1), …)` — the value's `sum` is the builtin) is
; accepted as a known approximation, the same trade-off gsfmt documents.

; ── scopes ──────────────────────────────────────────────────────────────
(let_expression) @local.scope

(lambda_expression) @local.scope

; ── definitions ─────────────────────────────────────────────────────────
(let_binding
  name: (identifier) @local.definition.var)

(lambda_expression
  parameter: (identifier) @local.definition.parameter)

; ── references ──────────────────────────────────────────────────────────
; Every identifier is a candidate reference, including one in call-head
; position: a bound name invoked as a function (`myTax(1000)`, a LAMBDA
; passed as an argument and called) resolves to its binding. Identifiers
; with no matching definition — builtin function names, named ranges,
; bare range columns — simply resolve to nothing, which is correct.
(identifier) @local.reference
