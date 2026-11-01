import { loadCatalogue } from "@/lib/docs/catalogue";
const catalogue = await loadCatalogue();
// These read the docs catalogue the build writes to public/data/datasets.
import { CATALOGUE_DATASET_DEFINITIONS } from "@uk-data-atlas/datasets/data/catalog/registry";
import { datasetSlug } from "@/lib/datasets";
import { GEOGRAPHIES } from "@/lib/docs/content/geographies";
import {
	boundaryEntries,
	datasetEntries,
	datasetsByTopic,
} from "@/lib/reference/entries";

const slugs = CATALOGUE_DATASET_DEFINITIONS.map((d) => datasetSlug(d.type));

describe("dataset guides", () => {
	it("lists every dataset once, with every topic in use", () => {
		const grouped = datasetsByTopic(datasetEntries(catalogue));
		expect(grouped.flatMap((t) => t.datasets).length).toBe(slugs.length);
		expect(grouped.filter((t) => t.datasets.length === 0)).toEqual([]);
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
