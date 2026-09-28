import { describe, expect, it } from "vitest";
import type { NumericMapOptionsKey } from "@/lib/types/mapOptions";

// The shared choropleth path reads `mapOptions[dataset.type].colorRange`, so a
// dataset may only take that path if its option group actually has one. These
// assignments are checked by `pnpm typecheck`, not at runtime.
const numeric: NumericMapOptionsKey[] = [
	"childPoverty",
	"housePrice",
	"unemployment",
	// Categorical datasets keep a colour range alongside their category
	// options, so they stay eligible.
	"localElection",
	"ethnicity",
];

// @ts-expect-error a network layer is map-native and carries no colour range
const network: NumericMapOptionsKey = "network";

// @ts-expect-error not a dataset type at all
const nonsense: NumericMapOptionsKey = "theme";

describe("NumericMapOptionsKey", () => {
	it("admits the dataset types whose options carry a colour range", () => {
		expect(numeric).toContain("childPoverty");
		// The two rejected assignments above are the real assertions; referencing
		// them here keeps the compiler from treating them as unused.
		expect([network, nonsense]).toHaveLength(2);
	});
});
