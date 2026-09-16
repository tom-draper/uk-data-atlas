import { apiConcepts } from "@/lib/docs/concepts";
import { loadApiContract } from "@/lib/docs/openapi";

describe("apiConcepts", () => {
	it("finds every concept in the published introduction", () => {
		const concepts = apiConcepts(loadApiContract());
		expect(concepts.map((c) => c.id)).toEqual([
			"envelope",
			"identities",
			"formats",
			"errors",
			"caching",
		]);
		for (const concept of concepts) expect(concept.text).not.toBe("");
	});

	it("fails loudly when a concept's paragraph is reworded away", () => {
		expect(() =>
			apiConcepts({
				title: "t",
				version: "1",
				introduction: [],
				sections: [],
			}),
		).toThrow("no longer has a paragraph");
	});
});
