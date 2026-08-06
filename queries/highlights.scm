; Highlights for Google Sheets formulas (tools/tree-sitter-gsformula).
;
; Ordering matters: Neovim lets a later pattern win, so the broad
; `(identifier)` capture comes first and the specific roles override it.
; ── fallback ────────────────────────────────────────────────────────────
(identifier) @variable

; ── literals ────────────────────────────────────────────────────────────
(string) @string

(number) @number

(boolean) @boolean.builtin

(error) @error

; ── references ──────────────────────────────────────────────────────────
(reference) @variable.builtin

; A bare column is lexically an identifier (`B` in `B6:B`, `A` in `A:A`) and
; a bare row is a number (`2` in `Sheet1!1:2`, both endpoints of `1:2`);
; only `$`-anchored or sheet-qualified ones are unambiguous tokens. Colour
; the operands of a range like references so the whole range reads uniformly.
(binary_expression
  left: (identifier) @variable.builtin
  operator: ":")

(binary_expression
  operator: ":"
  right: (identifier) @variable.builtin)

(binary_expression
  left: (number) @variable.builtin
  operator: ":")

(binary_expression
  operator: ":"
  right: (number) @variable.builtin)

; ── table references ─────────────────────────────────────────────────────
(table_reference
  table: (identifier) @type)

(table_specifier) @constant.builtin

(table_column) @property

; Chip extraction: the `[field]` after the dot reads like a property access.
(chip_field) @property

(table_reference
  "." @punctuation.delimiter)

; ── calls ───────────────────────────────────────────────────────────────
; `function` may hold a reference token: a name like LOG10 is lexically a
; cell reference and the lexer cannot look ahead for the `(`.
(call_expression
  function: (identifier) @function.call)

(call_expression
  function: (reference) @function.call)

; …or a boolean token: TRUE()/FALSE() are zero-argument Sheets functions and
; `boolean` beats `identifier` in the lexer.
(call_expression
  function: (boolean) @function.call)

(let_expression
  function: (function_name) @function.builtin)

(lambda_expression
  function: (function_name) @function.builtin)

; ── binding sites ───────────────────────────────────────────────────────
; The reason this is a grammar rather than a syntax file: a name being bound
; is a different thing from a name being used, and only a parse tree knows.
(let_binding
  name: (identifier) @variable.parameter)

(lambda_expression
  parameter: (identifier) @variable.parameter)

; ── operators and punctuation ───────────────────────────────────────────
(binary_expression
  operator: _ @operator)

(unary_expression
  operator: _ @operator)

(postfix_expression
  operator: _ @operator)

(source_file
  "=" @operator)

[
  "("
  ")"
  "{"
  "}"
  "["
  "]"
] @punctuation.bracket

[
  ","
  ";"
] @punctuation.delimiter
