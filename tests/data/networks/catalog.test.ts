import { describe, expect, it } from "vitest";
import {
	OS_OPEN_ROADS_CLASSIFICATION_COLORS,
	OS_OPEN_ROADS_OTHER_ROADS_COLOR,
} from "@/lib/data/networks/catalog";

describe("OS Open Roads catalogue", () => {
	it("defines a distinct palette for the principal road classifications", () => {
		expect(OS_OPEN_ROADS_CLASSIFICATION_COLORS).toEqual({
			Motorway: "#2563eb",
			"A Road": "#dc2626",
			"B Road": "#d97706",
		});
		expect(OS_OPEN_ROADS_OTHER_ROADS_COLOR).toBe("#94a3b8");
	});
});
