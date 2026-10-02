import { type Indicator, publishIndicators } from "./indicators";
import type { CatalogManifest, CompiledMeasure } from "./manifest";

/** Ofcom broadband availability by local authority, as shares of premises. */
export const compileBroadband = (
	manifest: CatalogManifest,
	broadbandPath: string,
	populationCodes: Set<string>,
): CompiledMeasure[] => {
	const premisesShare = (
		id: string,
		label: string,
		field: string,
		note: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "ratio",
		unit: "% of premises",
		aggregation: {
			kind: "intensive",
			operation: "weighted-mean",
			weight: {
				description:
					"The authority's count of all premises, which the published availability percentages are computed against.",
				datasetField: "All Premises",
			},
			available: false,
		},
		notes: [note],
	});
	return publishIndicators(manifest, {
		datasetId: "broadband",
		path: broadbandPath,
		boundaryYear: 2024,
		period: "2025-07",
		expectedCodes: [...populationCodes],
		coverageNote:
			"Published source records cover every authority in all four UK nations.",
		notes: [
			"Availability, not take-up: a premises counts where the service can be ordered, whether or not anyone there has it.",
			"This is a share of premises, so it does not add over areas. Combining authorities needs a mean weighted by premises, which the source publishes but this measure does not serve; averaging the percentages flat would weigh a small authority as heavily as a city.",
			"Ofcom's July 2025 Connected Nations snapshot, on local authority codes shared by every release from May 2023 to December 2024.",
		],
		indicators: [
			premisesShare(
				"broadband-superfast-availability",
				"Superfast broadband availability",
				"pctSuperfast",
				"Premises able to receive download speeds of at least 30 Mbit/s.",
			),
			premisesShare(
				"broadband-ultrafast-availability",
				"Ultrafast broadband availability",
				"pctUltrafast",
				"Premises able to receive download speeds of at least 100 Mbit/s.",
			),
			premisesShare(
				"broadband-full-fibre-availability",
				"Full fibre availability",
				"pctFullFibre",
				"Premises where a full fibre connection, fibre all the way to the premises, is available.",
			),
			premisesShare(
				"broadband-gigabit-availability",
				"Gigabit broadband availability",
				"pctGigabit",
				"Premises able to receive download speeds of at least 1 Gbit/s, by any technology.",
			),
		],
	});
};
