; Textobjects for mini.ai's gen_spec.treesitter (af/if via @function.*).
; A formula has no named function definitions, so "function" maps to the
; call-shaped constructs: af selects the whole call, if its interior.
(call_expression) @function.outer

(call_expression
  (arguments) @function.inner)

(invocation_expression) @function.outer

(invocation_expression
  (arguments) @function.inner)

(lambda_expression) @function.outer

(lambda_expression
  body: (_) @function.inner)

(let_expression) @function.outer

(let_expression
  result: (_) @function.inner)
