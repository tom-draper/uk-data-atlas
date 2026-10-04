import { CATALOGUE_DATASET_DEFINITIONS } from "@/lib/data/catalog/registry";
import { datasetSlug } from "@/lib/datasets";
import { GEOGRAPHIES, GEOGRAPHY_GROUPS } from "@/lib/docs/content/geographies";
import { BOUNDARY_DETAILS } from "@/lib/reference/boundaries";
import { DATASET_GUIDES, DATASET_TOPICS } from "@/lib/reference/datasets";
import {
	boundaryEntries,
	datasetEntries,
	datasetsByTopic,
} from "@/lib/reference/entries";

const slugs = CATALOGUE_DATASET_DEFINITIONS.map((d) => datasetSlug(d.type));
const topics = new Set(DATASET_TOPICS.map((topic) => topic.id));

const duplicates = (ids: string[]) =>
	ids.filter((id, i) => ids.indexOf(id) !== i);

describe("dataset guides", () => {
	it("explains every registered dataset under a known topic", () => {
		expect(slugs.filter((slug) => !DATASET_GUIDES[slug])).toEqual([]);
		expect(
			Object.entries(DATASET_GUIDES)
				.filter(([, guide]) => !topics.has(guide.topic))
				.map(([slug]) => slug),
		).toEqual([]);
	});

	it("has no guide for a dataset the registry no longer has", () => {
		expect(
			Object.keys(DATASET_GUIDES).filter((slug) => !slugs.includes(slug)),
		).toEqual([]);
	});

	it("lists every dataset once, with every topic in use", () => {
		const grouped = datasetsByTopic(datasetEntries());
		expect(grouped.flatMap((t) => t.datasets).length).toBe(slugs.length);
		expect(grouped.filter((t) => t.datasets.length === 0)).toEqual([]);
	});

	it("gives every section on the page its own anchor", () => {
		// Map pages' structured data points at /datasets#{slug}.
		expect(duplicates([...slugs, ...topics, "all-datasets"])).toEqual([]);
	});

	it("links each dataset to a boundary on the boundaries page", () => {
		expect(
			datasetEntries()
				.filter((entry) => !GEOGRAPHIES[entry.geography])
				.map((entry) => entry.slug),
		).toEqual([]);
	});
});

describe("boundary details", () => {
	it("explains every geography and no other", () => {
		expect(Object.keys(BOUNDARY_DETAILS).sort()).toEqual(
			Object.keys(GEOGRAPHIES).sort(),
		);
	});

	it("gives every section on the page its own anchor", () => {
		expect(
			duplicates([
				...Object.values(GEOGRAPHIES).map((g) => g.slug),
				...GEOGRAPHY_GROUPS.map((g) => g.id),
				"about-boundaries",
				"all-boundaries",
			]),
		).toEqual([]);
	});

	it("has a release for every geography", () => {
		expect(
			boundaryEntries()
				.filter((entry) => !entry.latest)
				.map((entry) => entry.id),
		).toEqual([]);
	});
});
