; Indentation for nvim-treesitter's indentexpr. Every bracketed construct
; indents its interior one level; the closing delimiter dedents back
; (@indent.branch). gsfmt re-aligns on save, so this only has to keep
; typing pleasant, not reproduce the formatter's column alignment.

[
  (call_expression)
  (invocation_expression)
  (let_expression)
  (lambda_expression)
  (parenthesized_expression)
  (array)
] @indent.begin

; Mid-typing, an unclosed delimiter has no complete expression node yet —
; the opener sits inside an ERROR node. Indent after it anyway, or Enter
; right after `=SUM(` would snap back to column 0. Both the token and the
; ERROR itself are captured: sibling openers inside one ERROR are not on
; the ancestor walk, so nested unclosed calls would otherwise count once.
; Same-row captures dedupe, so a single opener still indents one level.
(ERROR
  "(" @indent.begin) @indent.begin

(ERROR
  "{" @indent.begin) @indent.begin

; @indent.branch dedents the closer's own line; @indent.end stops the
; indent region at the closer so the *next* line returns to the outer
; level instead of staying inside the closed expression.
[
  ")"
  "}"
] @indent.branch @indent.end
