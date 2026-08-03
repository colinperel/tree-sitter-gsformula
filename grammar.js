/**
 * Google Sheets formula grammar.
 *
 * Scope is syntax highlighting, not evaluation, so the tree only needs to be
 * accurate enough to name things. Two rules earn their keep beyond a plain
 * expression grammar:
 *
 *   - `let_expression` models LET's (name, value) pairs, so a binding site is
 *     a distinct node from a use. That distinction is the reason this exists
 *     rather than a regex syntax file.
 *   - `lambda_expression` models parameters the same way.
 *
 * Function names are case-insensitive in Sheets, so LET/LAMBDA match any
 * casing and carry a lexical precedence that beats the generic identifier.
 */

const PREC = {
  compare: 1,
  concat: 2,
  add: 3,
  mul: 4,
  power: 5,
  unary: 6,
  postfix: 7,
  range: 8,
};

// A1, $A$1, 'my sheet'!A1, stock_data!$AE$3
//
// Ranges are NOT part of this token. A greedy `CELL ':' COL` match eats
// `B6:IND` out of `B6:INDEX(...)`, because `IND` is a perfectly good
// three-letter column. `:` is therefore a binary operator (PREC.range) and a
// range is a binary_expression over two references.
//
// A bare column (`B` in `B6:B`, `A` in `A:A`) is lexically an identifier;
// only `$`-anchored columns are unambiguous. The highlight query colours
// identifiers sitting under a `:` as references so a range reads uniformly.
const SHEET = /(?:[A-Za-z_][A-Za-z0-9_.]*|'(?:[^']|'')*')!/;
const CELL = /\$?[A-Za-z]{1,3}\$?[0-9]+/;
const ABS_COL = /\$[A-Za-z]{1,3}/;

module.exports = grammar({
  name: 'gsformula',

  extras: ($) => [/\s+/],

  rules: {
    source_file: ($) => seq(optional('='), optional($._expression)),

    _expression: ($) =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $.postfix_expression,
        $.parenthesized_expression,
        $.let_expression,
        $.lambda_expression,
        $.call_expression,
        $.array,
        $.table_reference,
        $.reference,
        $.number,
        $.string,
        $.boolean,
        $.error,
        $.identifier,
      ),

    // ── LET ────────────────────────────────────────────────────────────
    // LET(name, value, name, value, ..., result). Whether an identifier
    // opens a binding or the trailing result looks ambiguous, but LR(1)
    // resolves it: the decision defers until the token after the following
    // expression (`,` continues bindings, `)` closes on the result), so no
    // conflict declaration or dynamic precedence is needed — `tree-sitter
    // generate` is the proof, it fails loudly on a real conflict.
    let_expression: ($) =>
      seq(
        field('function', $._let_keyword),
        '(',
        repeat(seq(field('binding', $.let_binding), ',')),
        field('result', $._expression),
        ')',
      ),

    let_binding: ($) =>
      seq(field('name', $.identifier), ',', field('value', $._expression)),

    // ── LAMBDA ─────────────────────────────────────────────────────────
    lambda_expression: ($) =>
      seq(
        field('function', $._lambda_keyword),
        '(',
        repeat(seq(field('parameter', $.identifier), ',')),
        field('body', $._expression),
        ')',
      ),

    // ── calls ──────────────────────────────────────────────────────────
    // `function` accepts a reference token as well as an identifier: a name
    // like LOG10 is lexically indistinguishable from a cell reference
    // (three letters plus digits) and the lexer cannot look ahead for the
    // `(`. Accepting both keeps such calls parsing, and the highlight query
    // colours whatever fills the `function` field as a function.
    call_expression: ($) =>
      seq(
        field('function', choice($.identifier, $.reference)),
        '(',
        optional($.arguments),
        ')',
      ),

    // A blank argument is legal and meaningful: IF(x,,y) is not IF(x,"",y).
    // Split so the rule can never match the empty string: either exactly one
    // argument, or two-plus with at least one comma (any of which may be
    // blank). `NOW()` is handled by the `optional` at the call site.
    arguments: ($) =>
      choice(
        $._expression,
        seq(optional($._expression), repeat1(seq(',', optional($._expression)))),
      ),

    parenthesized_expression: ($) => seq('(', $._expression, ')'),

    // ── table references ───────────────────────────────────────────────
    // Table1[Column 1], Table1[#ALL], Table1[[#HEADERS],[Col A]:[Col C]].
    // Column names may contain spaces, so the column is one token up to the
    // closing bracket; specifiers start with `#`. Chip extraction
    // (`Table1[Col].[field]`) is deliberately not modeled — deferred in
    // docs/proposals/tree-sitter-gsformula.md.
    table_reference: ($) =>
      seq(
        field('table', $.identifier),
        '[',
        choice(
          field('column', $.table_column),
          field('specifier', $.table_specifier),
          seq($._table_part, repeat(seq(',', $._table_part))),
        ),
        ']',
      ),

    // One bracketed selector inside the compound form, optionally a column
    // range: [Column 1]:[Column 3].
    _table_part: ($) =>
      seq($._table_bracketed, optional(seq(':', $._table_bracketed))),

    _table_bracketed: ($) =>
      seq(
        '[',
        choice(
          field('column', $.table_column),
          field('specifier', $.table_specifier),
        ),
        ']',
      ),

    table_specifier: ($) => token(/#[A-Za-z]+/),
    table_column: ($) => token(/[^#\[\]][^\[\]]*/),

    array: ($) =>
      seq('{', optional(seq($._array_row, repeat(seq(';', $._array_row)))), '}'),
    _array_row: ($) => seq($._expression, repeat(seq(',', $._expression))),

    // ── operators ──────────────────────────────────────────────────────
    binary_expression: ($) => {
      const table = [
        [PREC.compare, choice('=', '<', '>', '<=', '>=', '<>')],
        [PREC.concat, '&'],
        [PREC.add, choice('+', '-')],
        [PREC.mul, choice('*', '/')],
        [PREC.range, ':'],
      ];
      return choice(
        ...table.map(([precedence, operator]) =>
          prec.left(
            precedence,
            seq(
              field('left', $._expression),
              field('operator', operator),
              field('right', $._expression),
            ),
          ),
        ),
        // ^ is right-associative
        prec.right(
          PREC.power,
          seq(
            field('left', $._expression),
            field('operator', '^'),
            field('right', $._expression),
          ),
        ),
      );
    },

    unary_expression: ($) =>
      prec(PREC.unary, seq(field('operator', choice('-', '+')), $._expression)),

    postfix_expression: ($) =>
      prec(PREC.postfix, seq($._expression, field('operator', '%'))),

    // ── leaves ─────────────────────────────────────────────────────────
    reference: ($) =>
      token(
        choice(
          // A sheet prefix makes even a bare column unambiguous, because a
          // function is never sheet-qualified: stock_data!P:P
          seq(SHEET, choice(CELL, ABS_COL, /[A-Za-z]{1,3}/)),
          CELL,
          ABS_COL,
        ),
      ),

    // `""` is an escaped quote, not a terminator.
    string: ($) => token(seq('"', repeat(choice(/[^"]/, '""')), '"')),

    number: ($) => token(/[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?|\.[0-9]+/),

    boolean: ($) => token(prec(2, /[Tt][Rr][Uu][Ee]|[Ff][Aa][Ll][Ss][Ee]/)),

    error: ($) =>
      token(
        prec(
          2,
          choice(
            '#REF!',
            '#N/A',
            '#VALUE!',
            '#DIV/0!',
            '#NAME?',
            '#NULL!',
            '#NUM!',
            '#ERROR!',
          ),
        ),
      ),

    _let_keyword: ($) => alias(token(prec(3, /[Ll][Ee][Tt]/)), $.function_name),
    _lambda_keyword: ($) =>
      alias(token(prec(3, /[Ll][Aa][Mm][Bb][Dd][Aa]/)), $.function_name),

    // `\` and `.` stay in the identifier set for parity with gsfmt's lexer
    // (tools/gsfmt/src/lib.rs `is_ident_start`/`is_ident_body`): the two
    // tools must tokenize the same text the same way or a formatted file
    // could highlight differently than it parses.
    identifier: ($) => token(/[A-Za-z_\\][A-Za-z0-9_.\\]*/),
  },
});
