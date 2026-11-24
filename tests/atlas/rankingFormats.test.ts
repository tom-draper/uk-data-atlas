import { describe, expect, it } from "vitest";
import { formatDisplay } from "@/lib/datasets/declared";

describe("formatDisplay", () => {
  it("puts a negative sum's sign before its currency", () => {
    expect(
      formatDisplay(
        { kind: "count", locale: "en-GB", prefix: "£" },
        -2_584_000,
      ),
    ).toBe("-£2,584,000");
    expect(
      formatDisplay({ kind: "decimal", digits: 1, prefix: "£" }, -2.5),
    ).toBe("-£2.5");
  });
});
