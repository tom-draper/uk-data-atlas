import { describe, expect, it } from "vitest";
import {
	ATLAS_LOCATIONS,
	atlasMapsFor,
	findAtlasLocation,
} from "@/lib/atlas/pages";
import { atlasMapJsonLd } from "@/lib/atlas/structuredData";

type Node = { "@type": string; [key: string]: unknown };

describe("map page structured data", () => {
	it("describes every map page's dataset well enough for Dataset Search", () => {
		for (const location of ATLAS_LOCATIONS.slice(0, 5)) {
			for (const map of atlasMapsFor(location)) {
				const graph = atlasMapJsonLd(location, map)["@graph"] as Node[];
				const dataset = graph.find(
					(node) => node["@type"] === "Dataset",
				)!;
				expect(
					String(dataset.description).length,
				).toBeGreaterThanOrEqual(50);
				expect(dataset.license).toMatch(/^https?:\/\//);
				expect(dataset.temporalCoverage).toMatch(/^\d{4}(\/\d{4})?$/);
			}
		}
	});

	it("names one dataset across every place's page for a map", () => {
		const london = findAtlasLocation("london")!;
		const leeds = findAtlasLocation("leeds")!;
		const datasetOf = (location: typeof london) =>
			(
				atlasMapJsonLd(location, atlasMapsFor(location)[0])[
					"@graph"
				] as Node[]
			).find((node) => node["@type"] === "Dataset")!["@id"];
		expect(datasetOf(london)).toBe(datasetOf(leeds));
	});
});
