import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePrecompiledBoundaryMappings } from "@uk-data-atlas/geography";
import { atlasLookupPath } from "@/scripts/atlas-lookups";

describe("fetched boundary mappings", () => {
	it("uses the ONS 2025 ward-to-2024 constituency lookup where a ward is not split", () => {
		const shipped = JSON.parse(
			readFileSync(
				atlasLookupPath(process.cwd(), "boundary-mappings.json"),
				"utf8",
			),
		);
		const actual = parsePrecompiledBoundaryMappings(shipped);
		// Ainsdale is an unsplit 2025 ward in the ONS lookup.
		expect(actual.constituencyToWards[2025]?.E14001463).toContain(
			"E05000932",
		);
	});
});
