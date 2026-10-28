import type { GeographyResolver } from "../areas/geographyResolver";

export const relationshipRepairsReport = (resolver: GeographyResolver) => {
	const repairs = resolver.relationshipRepairs();
	return {
		repairs,
		summary: repairs.reduce<Record<string, number>>(
			(summary, repair) => ({
				...summary,
				[repair.action]: (summary[repair.action] ?? 0) + 1,
			}),
			{},
		),
		note: "Each item is evidence for a reviewed repair. Publishing a crosswalk still requires its own adapter, validation and release build.",
	};
};
