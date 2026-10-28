import type {
	DataCatalog,
	Measure,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import type { AreaInventory } from "@uk-data-atlas/atlas-runtime/areas";
import type { EvidenceDocument } from "@uk-data-atlas/atlas-runtime/catalogue";

type EvidenceMeasureDependencies<Context> = {
	measureQuality: (context: Context, measureId: string) => unknown;
	measureCoverage: (context: Context, measureId: string) => unknown;
	measureCompatibility: (context: Context, measureId: string) => unknown;

	reconciliation: (
		context: Context,
		measure: Measure,
		selection: { crosswalk: string } | { path: string },
		period: string,
	) => { status: number; data: unknown };
	coveragePlan: (
		context: Context,
		measure: Measure,
		target: { geography: string; boundaryRelease: string },
	) => { status: number; data: unknown };
	measureCapability: (
		context: Context,
		measure: Measure,
		target: { geography: string; boundaryRelease: string },
	) => unknown;
	availableReconciliations: (
		context: Context,
		measure: Measure,
	) => Array<
		{ periods: string[] } & (
			{ crosswalk: { id: string } } | { path: { id: string } }
		)
	>;
	write: (id: string, data: unknown) => EvidenceDocument;
	compilerHash: string;
	inputsHash: (context: Context) => string;
};

export const buildEvidenceMeasure = <
	Context extends { dataCatalog: DataCatalog; areaInventory: AreaInventory },
>(
	context: Context,
	id: string,
	{
		measureQuality,
		measureCoverage,
		measureCompatibility,
		reconciliation,
		coveragePlan,
		measureCapability,
		availableReconciliations,
		write,
		compilerHash,
		inputsHash,
	}: EvidenceMeasureDependencies<Context>,
) => {
	const measure = context.dataCatalog.measures.find(
		(measure) => measure.id === id,
	);
	if (!measure) throw new Error(`Unknown measure ${id}`);
	const quality = { status: 200, data: measureQuality(context, id) };
	const coverage = { status: 200, data: measureCoverage(context, id) };
	const compatibilityData = measureCompatibility(context, id);
	const compatibility =
		compatibilityData === undefined
			? {
					status: 404,
					data: {
						type: "https://api.ukdataatlas.com/problems/not-found",
						title: "Not Found",
						status: 404,
						detail: "No published measure compatibility record matches that id.",
					},
				}
			: { status: 200, data: compatibilityData };
	// The legacy report requested conversion support without a target release.
	const conversionSupport = {
		status: 400,
		data: {
			type: "https://api.ukdataatlas.com/problems/invalid-query",
			title: "Invalid Query",
			status: 400,
			detail: "measure and to=geography/release are required.",
		},
	};
	const coveragePlans = context.areaInventory.releases.flatMap((release) =>
		release.status === "available"
			? [
					{
						geography: release.geography,
						release: release.id,
						capability: measureCapability(context, measure, {
							geography: release.geography,
							boundaryRelease: release.id,
						}),
						...coveragePlan(context, measure, {
							geography: release.geography,
							boundaryRelease: release.id,
						}),
					},
				]
			: [],
	);
	const available = availableReconciliations(context, measure);
	const reconciliations = available.flatMap((candidate) =>
		candidate.periods.map((period) => {
			const selector =
				"crosswalk" in candidate
					? `crosswalk=${encodeURIComponent(candidate.crosswalk.id)}`
					: `path=${encodeURIComponent(candidate.path.id)}`;
			return {
				selector,
				period,
				...reconciliation(
					context,
					measure,
					"crosswalk" in candidate
						? { crosswalk: candidate.crosswalk.id }
						: { path: candidate.path.id },
					period,
				),
			};
		}),
	);
	return write(`measure-${id}`, {
		measure: id,
		dataCatalogHash: context.dataCatalog.contentHash,
		compilerHash,
		inputsHash: inputsHash(context),
		quality,
		coverage,
		compatibility,
		conversionSupport,
		coveragePlans,
		reconciliations,
	});
};
