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
const SHEET = /(?:[\p{L}_][\p{L}\p{N}_.]*|'(?:[^']|'')*')!/;
const CELL = /\$?[A-Za-z]{1,3}\$?[0-9]+/;
const ABS_COL = /\$[A-Za-z]{1,3}/;

export default grammar({
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
        $.invocation_expression,
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
        repeat1(seq(field('binding', $.let_binding), ',')),
        field('result', $._expression),
        ')',
      ),

    let_binding: ($) =>
      seq(field('name', $.identifier), ',', field('value', $._expression)),

    // ── LAMBDA ─────────────────────────────────────────────────────────
    // At least one parameter, matching Sheets: LAMBDA(body) alone is a
    // #N/A. `repeat1` (and LET's above) also means LET(1)/LAMBDA(1) parse
    // as errors rather than silently as empty declaration lists.
    lambda_expression: ($) =>
      seq(
        field('function', $._lambda_keyword),
        '(',
        repeat1(seq(field('parameter', $.identifier), ',')),
        field('body', $._expression),
        ')',
      ),

    // ── calls ──────────────────────────────────────────────────────────
    // `function` accepts a reference token as well as an identifier: a name
    // like LOG10 is lexically indistinguishable from a cell reference
    // (three letters plus digits) and the lexer cannot look ahead for the
    // `(`. Accepting both keeps such calls parsing, and the highlight query
    // colours whatever fills the `function` field as a function. `boolean`
    // is accepted for the same reason: TRUE and FALSE are real zero-argument
    // Sheets functions, and the `boolean` token beats `identifier` lexically,
    // so `=TRUE()` only parses if the call site accepts a boolean here.
    call_expression: ($) =>
      seq(
        field('function', choice($.identifier, $.reference, $.boolean)),
        '(',
        optional($.arguments),
        ')',
      ),

    // Immediately-invoked callables: LAMBDA(x, x * 0.3)(1000), a LET that
    // returns a lambda, a call whose result is called again. The base is
    // restricted to expressions that can produce a callable — letting any
    // expression sit there would make every ordinary call ambiguous with an
    // invocation over a bare identifier.
    invocation_expression: ($) =>
      seq(
        field('function', choice(
          $.lambda_expression,
          $.let_expression,
          $.parenthesized_expression,
          $.call_expression,
          $.invocation_expression,
        )),
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
    // closing bracket; specifiers start with `#`. Chip extraction is the
    // optional `.[field]` postfix — Table1[Column 1].[file name] — and only
    // on the plain-column form, always bracketed: the one shape Google
    // documents. A bare `.field`, or a chip on a specifier or compound
    // base, stays an ERROR.
    table_reference: ($) =>
      seq(
        field('table', $.identifier),
        '[',
        choice(
          seq(
            field('column', $.table_column),
            ']',
            optional(
              seq(
                '.',
                '[',
                field('chip', alias($.table_column, $.chip_field)),
                ']',
              ),
            ),
          ),
          seq(field('specifier', $.table_specifier), ']'),
          seq($._table_part, repeat(seq(',', $._table_part)), ']'),
        ),
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
    // A chip field has exactly this shape too (spaces allowed, `#` excluded
    // so a specifier in chip position is an ERROR), so the chip site aliases
    // this rule to `chip_field` rather than declaring a second identical
    // token — tree-sitter collapses duplicate token rules into one nullable
    // auxiliary token, which made `Table1[]` parse with a zero-width column.
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
        // ^ is right-associative in Sheets: =2^3^2 evaluates to 512
        // (verified in the live app, 2026-08-11). Excel documents ^ as
        // left-associative (64) — do not "fix" this to match Excel.
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
          // A sheet prefix makes even a bare column or row unambiguous,
          // because a function is never sheet-qualified: stock_data!P:P,
          // Sheet1!1:2. A bare row (`2` in `Sheet1!1:2`) stays a number,
          // exactly like the bare column that stays an identifier; only
          // `$`-anchored ones are unambiguous tokens.
          seq(SHEET, choice(CELL, ABS_COL, /[A-Za-z]{1,3}/, /\$?[0-9]+/)),
          CELL,
          ABS_COL,
          // `$3` in `Sheet1!$1:$3` — the anchor disambiguates from a number.
          /\$[0-9]+/,
        ),
      ),

    // `""` is an escaped quote, not a terminator.
    string: ($) => token(seq('"', repeat(choice(/[^"]/, '""')), '"')),

    // `1.` (trailing dot, no fraction digits) is accepted: Sheets takes it
    // on entry and normalizes it to `1`, so rejecting it would error a
    // formula mid-edit that Sheets itself accepts. gsfmt's lexer accepts
    // it too. Both alternatives take an exponent — without it on the
    // leading-dot form, the `E3` in `.5E3` misparses as a cell reference.
    number: ($) =>
      token(/[0-9]+(\.[0-9]*)?([eE][+-]?[0-9]+)?|\.[0-9]+([eE][+-]?[0-9]+)?/),

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

    // Letters, digits, `_`, `.` — what Sheets actually permits in names.
    // Letters and digits are Unicode-wide (`\p{L}`/`\p{N}`): Sheets binds
    // named ranges like `Umsätze` or `日本語`, and gsfmt's lexer already
    // accepts them, so an ASCII-only token here would flag as an ERROR what
    // the formatter happily formats. Column letters and the LET/LAMBDA
    // keywords stay ASCII — Sheets spells those in ASCII only.
    // gsfmt's lexer additionally tolerates `\` (a formatter must never
    // crash on garbage, only preserve it); a highlighter has the opposite
    // contract, an ERROR node on invalid input is the feature.
    identifier: ($) => token(/[\p{L}_][\p{L}\p{N}_.]*/),
  },
});
