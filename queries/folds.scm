; Folds for vim.treesitter.foldexpr(). Any construct gsfmt breaks across
; lines is foldable; single-line matches are ignored by the foldexpr.
[
  (call_expression)
  (invocation_expression)
  (let_expression)
  (lambda_expression)
  (parenthesized_expression)
  (array)
] @fold
