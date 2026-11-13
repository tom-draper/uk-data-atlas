import { CHART_SECTIONS } from "@/lib/datasets/chartSections";
import type { AtlasMap } from "@/lib/atlas/pages";

/** Maps in the chart panel's order, under the chart panel's section titles. */
export function atlasMapSections(maps: readonly AtlasMap[]) {
	return CHART_SECTIONS.flatMap(({ theme, title }) => {
		const inSection = maps.filter((map) => map.theme === theme);
		return inSection.length > 0 ? [{ title, maps: inSection }] : [];
	});
}
