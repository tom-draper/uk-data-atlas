import type { DataCatalog, Measure } from "../../../shared/dataCatalog";
import type { AreaInventory } from "../../../shared/areaInventory";
import type { EvidenceDocument } from "../../../shared/evidenceDocuments";

type EvidenceMeasureDependencies<Context> = {
	report: (
		context: Context,
		url: string,
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
		report,
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
	const base = `/v1/measures/${id}`;
	const quality = report(context, `${base}/quality`);
	const coverage = report(context, `${base}/coverage`);
	const compatibility = report(context, `${base}/compatibility`);
	const conversionSupport = report(context, `${base}/conversion-support`);
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
						...report(
							context,
							`${base}/coverage-plan?geography=${release.geography}&release=${release.id}`,
						),
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
				...report(
					context,
					`${base}/reconciliation?${selector}&period=${encodeURIComponent(period)}`,
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
