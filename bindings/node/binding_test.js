import assert from "node:assert";
import { test } from "node:test";
import Parser from "tree-sitter";

test("can load grammar", async () => {
  const parser = new Parser();
  // Awaited, unlike the upstream template: unawaited, the rejection lands
  // after the test ends, so the subtest reports pass and only a post-test
  // unhandledRejection check fails the run. Awaiting attributes the
  // failure to this test.
  await assert.doesNotReject(async () => {
    const { default: language } = await import("./index.js");
    parser.setLanguage(language);
  });
});
