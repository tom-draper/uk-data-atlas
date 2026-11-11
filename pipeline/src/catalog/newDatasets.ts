import { type DatasetInput } from "./input.ts";
import { type Indicator, publishIndicators } from "./indicators.ts";
import type { CatalogManifest, CompiledMeasure } from "./manifest.ts";

type NewDataset = {
	datasetId: string;
	path: DatasetInput;
	boundaryYear: number;
	period: string;
	label: string;
	unit: string;
	valueKind: Indicator["valueKind"];
	geography?: "localAuthority" | "localPlanningAuthority";
	aggregation: Indicator["aggregation"];
	note: string;
};

/** Source-exact primary measures for the newly published local-area tables. */
export const compileNewDatasets = (
	manifest: CatalogManifest,
	datasets: readonly NewDataset[],
): CompiledMeasure[] =>
	datasets.flatMap((dataset) =>
		publishIndicators(manifest, {
			datasetId: dataset.datasetId,
			path: dataset.path,
			boundaryYear: dataset.boundaryYear,
			period: dataset.period,
			...(dataset.geography ? { geography: dataset.geography } : {}),
			coverageNote:
				"Values are source-reported for the authorities included in the publisher's release.",
			notes: [dataset.note],
			indicators: [
				{
					id: dataset.datasetId,
					label: dataset.label,
					field: "value",
					valueKind: dataset.valueKind,
					unit: dataset.unit,
					aggregation: dataset.aggregation,
					notes: [],
				},
			],
		}),
	);

export const NEW_DATASET_MEASURES = (
	paths: Partial<Record<string, DatasetInput>>,
): NewDataset[] => [
	{
		datasetId: "business-activity",
		path: paths.businessActivity!,
		boundaryYear: 2025,
		period: "2025",
		label: "VAT and/or PAYE based enterprises",
		unit: "enterprises",
		valueKind: "count",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		note: "The primary value sums the published broad-industry counts for each local authority.",
	},


	{
		datasetId: "waste",
		path: paths.waste!,
		boundaryYear: 2025,
		period: "2024-25",
		label: "Local authority collected waste",
		unit: "tonnes",
		valueKind: "quantity",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		note: "Collection authorities only, avoiding double counting between collection and disposal authorities.",
	},

	{
		datasetId: "adult-social-care-outcomes",
		path: paths.adultSocialCareOutcomes!,
		boundaryYear: 2025,
		period: "2024-25",
		label: "Social care-related quality of life",
		unit: "score out of 24",
		valueKind: "ratio",
		aggregation: {
			kind: "non-aggregatable",
			statistic: "median",
			note: "This is a survey outcome score, not a count that can be summed.",
			available: false,
		},
		note: "The total-population council outcome score from ASCOF table 1a.",
	},
	{
		datasetId: "planning-applications",
		path: paths.planningApplications!,
		boundaryYear: 2025,
		period: "2026-Q1",
		label: "Planning applications received",
		unit: "applications",
		valueKind: "count",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		note: "Planning applications received during 2026 Q1; the publisher labels the areas local planning authorities but supplies local-authority district codes.",
	},
	{
		datasetId: "electric-vehicle-chargers",
		path: paths.electricVehicleChargers!,
		boundaryYear: 2026,
		period: "2026-07-01",
		label: "Public electric vehicle chargers",
		unit: "chargers",
		valueKind: "count",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		note: "Publicly available chargers by local authority at 1 July 2026.",
	},
];
