import { type Indicator, publishIndicators } from "./indicators";
import type { CatalogManifest, CompiledMeasure } from "./manifest";

type NewDataset = {
	datasetId: string;
	path: string;
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
	paths: Partial<Record<string, string>>,
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
		datasetId: "net-additional-dwellings",
		path: paths.netAdditionalDwellings!,
		boundaryYear: 2025,
		period: "2024-25",
		label: "Net additional dwellings",
		unit: "dwellings",
		valueKind: "count",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		note: "Annual net additional dwellings in English local authority districts.",
	},
	{
		datasetId: "local-government-finance",
		path: paths.localGovernmentFinance!,
		boundaryYear: 2026,
		period: "2026-27",
		label: "Education services revenue budget",
		unit: "£ thousand",
		valueKind: "quantity",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		note: "The Atlas primary measure is the published total education-services budget line.",
	},
	{
		datasetId: "council-tax",
		path: paths.councilTax!,
		boundaryYear: 2026,
		period: "2026-27",
		label: "Average Band D council tax",
		unit: "£",
		valueKind: "currency",
		aggregation: {
			kind: "intensive",
			operation: "weighted-mean",
			weight: {
				description: "The billing authority's council-tax base.",
				datasetField: "tax base",
			},
			available: false,
		},
		note: "A published billing-authority average; it must not be summed or averaged flat.",
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
		datasetId: "adult-social-care-activity",
		path: paths.adultSocialCareActivity!,
		boundaryYear: 2025,
		period: "2024-25",
		label: "Clients receiving long-term support",
		unit: "clients",
		valueKind: "count",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		note: "Clients receiving long-term support during the year, across both published age bands.",
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
