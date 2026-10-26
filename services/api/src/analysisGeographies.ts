import type { AnalysisGeographySupport } from "../../../shared/analysisGeographies";
export type * from "../../../shared/analysisGeographies";

/** How a reviewed support converts: one crosswalk, or a published path. */
export const analysisConversion = (support: AnalysisGeographySupport) =>
	support.path
		? {
				id: support.path.id,
				method: "relationship-path",
				quality: support.path.quality,
				steps: support.path.steps,
			}
		: support.crosswalk!;
