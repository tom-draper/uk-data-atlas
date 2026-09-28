/**
 * Friendly names and introductions for the reference sections, keyed by the
 * slug of the spec tag they present.
 */
export interface SectionContent {
	title: string;
	intro: string;
}

export const SECTIONS: Record<string, SectionContent> = {
	"start-here": {
		title: "Essentials",
		intro: "The handful of calls most people start with: find a place, get a quick answer and see what's available.",
	},
	map: {
		title: "Maps & spatial",
		intro: "Fetch observations and work with shapes: find the areas at a point or in a box, get boundaries, and see which areas border or overlap each other.",
	},
	trend: {
		title: "Analysis",
		intro: "Work with a measure over time and across areas: time series, rankings, change between periods, comparisons, totals and conversions.",
	},
	sync: {
		title: "Bulk data & releases",
		intro: "Download whole datasets and lookup tables, and keep track of the versioned releases they come from.",
	},
	geography: {
		title: "Areas & boundaries",
		intro: "Everything about the areas themselves: codes and names, boundary releases, map tiles, how areas nest and overlap, and how codes change over time.",
	},
	terrain: {
		title: "Terrain",
		intro: "Discover versioned terrain products and sample elevation with its interpolation method, coverage status, coordinate reference, datum and uncertainty.",
	},
	"data-catalogue": {
		title: "Catalogue",
		intro: "Discover what data exists: the source datasets, the measures built from them, and where each one can be used.",
	},
	governance: {
		title: "Trust & citation",
		intro: "Show your working: the checks behind every release, attribution text and citation bundles for anything you publish.",
	},
};
