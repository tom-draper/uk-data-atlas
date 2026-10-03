import { CHART_GROUPS } from "@/lib/datasets/chartGroups";
import type { AtlasMap } from "@/lib/atlas/pages";

const ELECTION_GROUPS = new Set([
	"General Election",
	"Local Election",
	"Brexit",
]);

/** Maps in the chart panel's order, under browse-page section titles. */
export function atlasMapSections(maps: readonly AtlasMap[]) {
	const sections = new Map<string, AtlasMap[]>();
	for (const { group } of CHART_GROUPS) {
		const title = ELECTION_GROUPS.has(group) ? "Elections" : group;
		const inGroup = maps.filter((map) => map.group === group);
		if (inGroup.length === 0) continue;
		sections.set(title, [...(sections.get(title) ?? []), ...inGroup]);
	}
	return [...sections].map(([title, sectionMaps]) => ({
		title,
		maps: sectionMaps,
	}));
}
