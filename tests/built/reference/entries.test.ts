import { loadCatalogue } from "@/lib/docs/catalogue";
const catalogue = await loadCatalogue();
// These read the docs catalogue the build writes to public/data/datasets.
import { REGISTERED_DATASETS } from "@uk-data-atlas/datasets";
import { GEOGRAPHIES } from "@/lib/docs/content/geographies";
import {
	boundaryEntries,
	datasetEntries,
	datasetsByTheme,
} from "@/lib/reference/entries";

const slugs = REGISTERED_DATASETS.map(({ id }) => id);

describe("dataset guides", () => {
	it("lists every dataset once, with every topic in use", () => {
		const topics = datasetsByTheme(datasetEntries(catalogue)).flatMap(
			(t) => t.topics,
		);
		expect(topics.flatMap((t) => t.datasets).length).toBe(slugs.length);
		expect(topics.filter((t) => t.datasets.length === 0)).toEqual([]);
	});

	it("gives every dataset its publisher, from the catalogue when it has no definition", () => {
		expect(
			datasetEntries(catalogue)
				.filter((entry) => !entry.publisher)
				.map((entry) => entry.slug),
		).toEqual([]);
	});

	it("links each dataset to a geography on the geographies page", () => {
		expect(
			datasetEntries(catalogue)
				.filter(
					(entry) =>
						!GEOGRAPHIES[entry.geography] ||
						(entry.publishedOn && !GEOGRAPHIES[entry.publishedOn]),
				)
				.map((entry) => entry.slug),
		).toEqual([]);
	});

	it("lists a dataset under the geography it was published for", () => {
		const partnerships = boundaryEntries(catalogue).find(
			(entry) => entry.id === "communitySafetyPartnership",
		);
		expect(partnerships?.datasets.map((d) => d.slug)).toContain("crime");
	});
});

describe("geography details", () => {
	it("has a release for every geography", () => {
		expect(
			boundaryEntries(catalogue)
				.filter((entry) => !entry.latest)
				.map((entry) => entry.id),
		).toEqual([]);
	});
});
