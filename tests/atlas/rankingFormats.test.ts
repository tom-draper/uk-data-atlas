import { describe, expect, it } from "vitest";
import { findAtlasMap } from "@/lib/atlas/pages";
import { formatRankedValue, rankedValueLabel } from "@/lib/atlas/rankings";
import { formatDisplay } from "@/lib/datasets/declared";

const value = (slug: string, number: number) =>
  formatRankedValue(findAtlasMap(slug)!, number);

describe("formatRankedValue", () => {
  it("writes large energy totals in full, not as a legend's 1k", () => {
    expect(value("electricity-consumption", 1155.43)).toBe("1,155 GWh");
    expect(value("electricity-consumption", 1099.54)).toBe("1,100 GWh");
    expect(value("gas-consumption", 981.1)).toBe("981 GWh");
  });

  it("keeps the precision that tells areas apart", () => {
    expect(value("housing-affordability", 7.51)).toBe("7.51×");
    expect(value("air-quality", 6.64)).toBe("6.6 µg/m³");
    expect(value("broadband", 77)).toBe("77.0%");
    expect(value("mobile-coverage", 31.3)).toBe("31.3%");
    expect(value("school-performance", 65.4)).toBe("65.4%");
    expect(value("jobs", 1000)).toBe("1,000");
  });

  it("writes life expectancy in years", () => {
    expect(value("life-expectancy", 84.95)).toBe("85.0 years");
  });

  it("labels a value whose map name does not say what it is", () => {
    expect(rankedValueLabel(findAtlasMap("school-performance")!)).toBe(
      "English and maths at grade 4 or above",
    );
  });
});

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
