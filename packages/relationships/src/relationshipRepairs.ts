/** What the report needs from a resolver: the repairs it has evidence for. */
export type RelationshipRepairSource<Repair extends { action: string }> = {
	relationshipRepairs(): Repair[];
};

export const relationshipRepairsReport = <Repair extends { action: string }>(
	resolver: RelationshipRepairSource<Repair>,
) => {
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
