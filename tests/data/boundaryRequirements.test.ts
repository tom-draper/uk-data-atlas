import { describe, expect, it } from "vitest";
import { DEFAULT_VISIBILITY } from "@/lib/context/ChartVisibilityContext";
import {
	requiredBoundaryKey,
	requiredBoundaryTypes,
} from "@/lib/datasets/boundaryRequirements";

describe("requiredBoundaryKey", () => {
	it("is unchanged when the active geography is already required", () => {
		const required = requiredBoundaryTypes(DEFAULT_VISIBILITY);
		expect(required.has("ward")).toBe(true);
		expect(required.has("constituency")).toBe(true);

		expect(requiredBoundaryKey(DEFAULT_VISIBILITY, ["ward"])).toBe(
			requiredBoundaryKey(DEFAULT_VISIBILITY, ["constituency"]),
		);
	});

	it("changes when the active geography is newly required", () => {
		const hidden = Object.fromEntries(
			Object.keys(DEFAULT_VISIBILITY).map((key) => [key, false]),
		);

		expect(requiredBoundaryKey(hidden, ["ward"])).toBe("ward");
		expect(requiredBoundaryKey(hidden, ["constituency"])).toBe(
			"constituency",
		);
		expect(requiredBoundaryKey(hidden)).toBe("");
	});
});
