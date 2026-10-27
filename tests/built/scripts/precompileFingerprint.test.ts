import { describe, expect, it } from "vitest";
import { precompileFingerprints } from "@/pipeline/src/precompile/fingerprint.mjs";
import { CATALOGUE_DATASET_DEFINITIONS } from "@/lib/data/catalog";

describe("the catalogue's fingerprints", () => {
	it("cover exactly the registered datasets", async () => {
		const { datasets } = await precompileFingerprints(process.cwd());

		expect(Object.keys(datasets).sort()).toEqual(
			CATALOGUE_DATASET_DEFINITIONS.map(({ type }) => type).sort(),
		);
	});
});
