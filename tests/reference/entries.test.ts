import {
	CATALOGUE_DATASET_DEFINITIONS,
	DATASET_THEMES,
	DATASET_TOPICS,
	REGISTERED_DATASETS,
} from "@uk-data-atlas/datasets";
import { datasetSlug } from "@/lib/datasets";
import { GEOGRAPHIES, GEOGRAPHY_GROUPS } from "@/lib/docs/content/geographies";
import { BOUNDARY_DETAILS } from "@/lib/reference/boundaries";

const slugs = REGISTERED_DATASETS.map(({ id }) => id);

const duplicates = (ids: string[]) =>
	ids.filter((id, i) => ids.indexOf(id) !== i);

describe("dataset guides", () => {
	it("explain every dataset of the registry the catalogue defines", () => {
		const registered = new Set(slugs);
		expect(
			CATALOGUE_DATASET_DEFINITIONS.map((d) =>
				datasetSlug(d.type),
			).filter((slug) => !registered.has(slug)),
		).toEqual([]);
	});

	it("gives every section on the page its own anchor", () => {
		// Map pages' structured data points at /datasets#{slug}.
		expect(
			duplicates([
				...slugs,
				...DATASET_THEMES.map(({ id }) => `theme-${id}`),
				...DATASET_TOPICS.map(({ id }) => `topic-${id}`),
				"about-datasets",
				"all-datasets",
			]),
		).toEqual([]);
	});
});

describe("geography details", () => {
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
				"about-geographies",
				"all-geographies",
			]),
		).toEqual([]);
	});
});
