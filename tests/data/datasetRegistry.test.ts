import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHART_COMPONENTS } from "@/lib/datasets/generatedCharts";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { validatePrecompiledDataset } from "@/lib/data/catalog";
import { getChartDefinitions } from "@/lib/datasets/types";

const PRECOMPILED = join(process.cwd(), "data", "precompiled");

type ManifestEntry = {
  type: string;
  output: string;
  source: {
    name: string;
    sourceUrl: string;
    licence: string;
    licenceUrl: string;
  };
  summary: {
    datasetCount: number;
    dataRecordCount: number;
    boundaryYears: number[];
  };
  compiled: { sha256: string };
};

const manifest = JSON.parse(
  readFileSync(join(PRECOMPILED, "dataset-manifest.json"), "utf8"),
) as { datasets: ManifestEntry[] };
const manifestByType = new Map(
  manifest.datasets.map((entry) => [entry.type, entry]),
);

const readCompiled = (file: string) => {
  const content = readFileSync(join(PRECOMPILED, `${file}.json`), "utf8");
  return {
    data: JSON.parse(content) as Record<string, never>,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
};

describe("chart dataset registry contract", () => {
  it("has one provenance manifest entry for every registered dataset", () => {
    expect(manifest.datasets.map((entry) => entry.type).sort()).toEqual(
      CHART_DATASET_DEFINITIONS.map((definition) => definition.type).sort(),
    );
  });

  it("registers every dataset that contributes a categorical legend", () => {
    const definitions = CHART_DATASET_DEFINITIONS.filter(
      (definition) => definition.legendAggregation,
    );
    expect(definitions.map((definition) => definition.type)).toEqual([
      "ethnicity",
      "generalElection",
      "localElection",
    ]);
    for (const definition of definitions) {
      expect(definition.legendAggregation?.calculateStats).toBeTypeOf(
        "function",
      );
    }
  });

  it("registers every bespoke legend kind", () => {
    expect(
      CHART_DATASET_DEFINITIONS.filter(
        (definition) => definition.legendKind,
      ).map((definition) => [definition.type, definition.legendKind]),
    ).toEqual([
      ["brexit", "brexit"],
      ["brexitConstituency", "brexit"],
      ["ethnicity", "ethnicity"],
      ["generalElection", "party"],
      ["localElection", "party"],
      ["population", "population"],
    ]);
  });

  for (const definition of CHART_DATASET_DEFINITIONS) {
    describe(definition.type, () => {
      it("has complete provenance and registered chart cards", () => {
        expect(definition.source.name).not.toBe("");
        expect(definition.source.source).not.toBe("");
        expect(definition.source.licence).not.toBe("");
        expect(() => new URL(definition.source.sourceUrl)).not.toThrow();
        expect(() => new URL(definition.source.licenceUrl)).not.toThrow();

        const chartKeys = getChartDefinitions(definition).map(
          (chart) => chart.key,
        );
        expect(new Set(chartKeys).size).toBe(chartKeys.length);
        for (const key of chartKeys) {
          expect(CHART_COMPONENTS[key]).toBeTypeOf("function");
        }
      });

      it("has a validated, provenance-matched compiled artifact", () => {
        const entry = manifestByType.get(definition.type);
        expect(entry).toBeDefined();
        expect(entry?.output).toBe(definition.precompiledFile);
        expect(entry?.source).toMatchObject(definition.source);

        const compiled = readCompiled(definition.precompiledFile);
        expect(compiled.sha256).toBe(entry?.compiled.sha256);
        const summary = validatePrecompiledDataset(
          definition,
          compiled.data as never,
        );
        expect(summary).toEqual(entry?.summary);
      });

      if (definition.map) {
        it("has a valid choropleth encoding", () => {
          const { colorRange, legend, valueFor, valueKey } = definition.map!;
          expect(valueKey || valueFor).toBeTruthy();
          expect(colorRange.min).toBeLessThanOrEqual(colorRange.max);
          expect(legend.min).toBeLessThanOrEqual(legend.max);
          expect(legend.format(legend.min)).not.toBe("");
        });
      } else {
        it("registers a bespoke map renderer", () => {
          expect(definition.mapRenderer?.getOptions).toBeTypeOf("function");
          expect(definition.mapRenderer?.render).toBeTypeOf("function");
        });
      }
    });
  }
});
