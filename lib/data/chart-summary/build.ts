import type { Dataset } from "@/lib/types/datasets";
import type { BoundaryGeojson } from "@/lib/types/geometry";
import type { BoundaryType } from "@/lib/types/boundaries";
import { LOCATIONS } from "@/lib/data/locations";
import {
  GEOJSON_PATHS,
  PROPERTY_KEYS,
  getProp,
} from "@/lib/data/boundaries/boundaries";
import { localDataPath } from "@/lib/data/boundaries/dataPath";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";
import { PropertyDetector } from "@/lib/helpers/mapManager/propertyDetector";
import { StatsCache } from "@/lib/helpers/mapManager/statsCache";
import { StatsCalculator } from "@/lib/helpers/mapManager/statsCalculator";
import type { ChartAggregateKey, ChartSummaryIndex } from "./types";

type ReadFile = (path: string) => Promise<string>;
type DatasetRecord = Record<string, Dataset>;

type SummaryDefinition = {
  file: string;
  type: Dataset["type"];
  boundaryType: BoundaryType;
  keyBy?: ChartAggregateKey;
  calculate: (
    calculator: StatsCalculator,
    boundary: BoundaryGeojson,
    dataset: Dataset,
    location: string,
    datasetId: string,
  ) => unknown;
};

// Each definition maps the existing runtime aggregate to its precompiled
// source. Keeping this list close to the build step makes additions explicit
// and allows aggregateDataset() to retain its normal live-data fallback.
const SUMMARY_DEFINITIONS: SummaryDefinition[] = [
  {
    file: "local-election",
    type: "localElection",
    boundaryType: "ward",
    calculate: (c, g, d, l, id) =>
      c.calculateLocalElectionStats(g, d.data as never, l, id),
  },
  {
    file: "general-election",
    type: "generalElection",
    boundaryType: "constituency",
    calculate: (c, g, d, l, id) =>
      c.calculateGeneralElectionStats(g, d.data as never, l, id),
  },
  {
    file: "population",
    type: "population",
    boundaryType: "ward",
    calculate: (c, g, d, l, id) =>
      c.calculatePopulationStats(g, d.data as never, l, id),
  },
  {
    file: "ethnicity",
    type: "ethnicity",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateEthnicityStats(g, d.data as never, l, id),
  },
  {
    file: "house-price",
    type: "housePrice",
    boundaryType: "ward",
    calculate: (c, g, d, l, id) =>
      c.calculateHousePriceStats(g, d.data as never, l, id),
  },
  {
    file: "crime",
    type: "crime",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateCrimeStats(g, d.data as never, l, id),
  },
  {
    file: "income",
    type: "income",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateIncomeStats(g, d.data as never, l, id),
  },
  {
    file: "brexit",
    type: "brexit",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateBrexitStats(g, d.data as never, l, id),
  },
  {
    file: "brexit-constituency",
    type: "brexitConstituency",
    boundaryType: "constituency",
    calculate: (c, g, d, l, id) =>
      c.calculateBrexitConstituencyStats(g, d.data as never, l, id),
  },
  {
    file: "imd",
    type: "imd",
    boundaryType: "lsoa",
    calculate: (c, g, d, l, id) =>
      c.calculateIMDStats(g, d.data as never, l, id),
  },
  {
    file: "simd",
    type: "simd",
    boundaryType: "dataZone",
    calculate: (c, g, d, l, id) =>
      c.calculateSIMDStats(g, d.data as never, l, id),
  },
  {
    file: "wimd",
    type: "wimd",
    boundaryType: "lsoa",
    calculate: (c, g, d, l, id) =>
      c.calculateWIMDStats(g, d.data as never, l, id),
  },
  {
    file: "nimdm",
    type: "nimdm",
    boundaryType: "superOutputArea",
    calculate: (c, g, d, l, id) =>
      c.calculateNIMDMStats(g, d.data as never, l, id),
  },
  {
    file: "life-expectancy",
    type: "lifeExpectancy",
    boundaryType: "localAuthority",
    keyBy: "id",
    calculate: (c, g, d, l, id) =>
      c.calculateLifeExpectancyStats(g, d.data as never, l, id),
  },
  {
    file: "qualification",
    type: "qualification",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateQualificationStats(g, d.data as never, l, id),
  },
  {
    file: "broadband",
    type: "broadband",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateBroadbandStats(g, d.data as never, l, id),
  },
  {
    file: "air-quality",
    type: "airQuality",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateAirQualityStats(g, d.data as never, l, id),
  },
  {
    file: "claimant-count",
    type: "claimantCount",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateClaimantCountStats(g, d.data as never, l, id),
  },
  {
    file: "school-performance",
    type: "schoolPerformance",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateSchoolPerformanceStats(g, d.data as never, l, id),
  },
  {
    file: "nhs-waiting",
    type: "nhsWaiting",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateNHSWaitingStats(g, d as never, l, id),
  },
  {
    file: "unemployment",
    type: "unemployment",
    boundaryType: "localAuthority",
    keyBy: "id",
    calculate: (c, g, d, l, id) =>
      c.calculateUnemploymentStats(g, d as never, l, id),
  },
  {
    file: "child-poverty",
    type: "childPoverty",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateChildPovertyStats(g, d.data as never, l, id),
  },
  {
    file: "homelessness",
    type: "homelessness",
    boundaryType: "localAuthority",
    calculate: (c, g, d, l, id) =>
      c.calculateHomelessnessStats(g, d.data as never, l, id),
  },
  {
    file: "fuel-poverty",
    type: "fuelPoverty",
    boundaryType: "lsoa",
    calculate: (c, g, d, l, id) =>
      c.calculateFuelPovertyStats(g, d.data as never, l, id),
  },
];

const COUNTRY_PREFIXES: Record<string, string> = {
  England: "E",
  Scotland: "S",
  Wales: "W",
  "Northern Ireland": "N",
};

const featureBounds = (feature: BoundaryGeojson["features"][number]) => {
  const geometry = feature.geometry as unknown as {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  const flat =
    geometry.type === "MultiPolygon"
      ? geometry.coordinates.flat(2)
      : geometry.coordinates.flat(1);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of flat as number[][]) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY] as const;
};

const intersects = (
  feature: BoundaryGeojson["features"][number],
  bounds: readonly [number, number, number, number],
) => {
  const [west, south, east, north] = bounds;
  const [minX, minY, maxX, maxY] = featureBounds(feature);
  return minX <= east && maxX >= west && minY <= north && maxY >= south;
};

const filterBoundary = (
  boundary: BoundaryGeojson,
  type: BoundaryType,
  location: string,
  wardToLad: Record<string, string>,
): BoundaryGeojson => {
  if (location === "United Kingdom") return boundary;
  const locationConfig = LOCATIONS[location];
  if (!locationConfig) return boundary;

  const propertyKeys =
    type === "ward"
      ? PROPERTY_KEYS.wardCode
      : type === "constituency"
        ? PROPERTY_KEYS.constituencyCode
        : type === "localAuthority"
          ? PROPERTY_KEYS.ladCode
          : type === "lsoa"
            ? PROPERTY_KEYS.lsoaCode
            : type === "dataZone"
              ? PROPERTY_KEYS.dataZoneCode
              : PROPERTY_KEYS.soaCode;

  const prefix = COUNTRY_PREFIXES[location];
  if (prefix) {
    return {
      ...boundary,
      features: boundary.features.filter((feature) =>
        getProp(feature.properties, propertyKeys)?.startsWith(prefix),
      ),
    };
  }

  if (type === "ward" && locationConfig.lad_codes.length > 0) {
    const ladCodes = new Set(locationConfig.lad_codes);
    return {
      ...boundary,
      features: boundary.features.filter((feature) => {
        const wardCode = getProp(feature.properties, PROPERTY_KEYS.wardCode);
        const ladCode =
          getProp(feature.properties, PROPERTY_KEYS.ladCode) ??
          (wardCode ? wardToLad[wardCode] : undefined);
        return !!ladCode && ladCodes.has(ladCode);
      }),
    };
  }

  if (type === "localAuthority" && locationConfig.lad_codes.length > 0) {
    const ladCodes = new Set(locationConfig.lad_codes);
    return {
      ...boundary,
      features: boundary.features.filter((feature) => {
        const code = getProp(feature.properties, PROPERTY_KEYS.ladCode);
        return !!code && ladCodes.has(code);
      }),
    };
  }

  return {
    ...boundary,
    features: boundary.features.filter((feature) =>
      intersects(feature, locationConfig.bounds),
    ),
  };
};

export async function buildChartSummaryIndex(
  read: ReadFile,
  readPrecompiled: (name: string) => Promise<DatasetRecord>,
  wardToLad: Record<string, string>,
): Promise<ChartSummaryIndex> {
  const locations: ChartSummaryIndex["locations"] = Object.fromEntries(
    Object.keys(LOCATIONS).map((location) => [location, {}]),
  );
  const calculator = new StatsCalculator(
    new PropertyDetector(),
    new StatsCache(),
  );

  for (const definition of SUMMARY_DEFINITIONS) {
    const collection = await readPrecompiled(definition.file);
    for (const [datasetId, dataset] of Object.entries(collection)) {
      if (dataset.type !== definition.type) continue;
      const path =
        GEOJSON_PATHS[definition.boundaryType][dataset.boundaryYear as never];
      if (!path) continue;
      const boundary = decodeBoundaryData(
        JSON.parse(await read(localDataPath(path))),
      );
      const keyBy = definition.keyBy ?? "year";
      const resultKey = keyBy === "id" ? datasetId : String(dataset.year);

      for (const location of Object.keys(LOCATIONS)) {
        const filtered = filterBoundary(
          boundary,
          definition.boundaryType,
          location,
          wardToLad,
        );
        const byType = (locations[location][definition.type] ??= {});
        const byKey = (byType[keyBy] ??= {});
        byKey[resultKey] = definition.calculate(
          calculator,
          filtered,
          dataset,
          location,
          datasetId,
        );
      }
    }
  }

  return { version: 1, locations };
}
