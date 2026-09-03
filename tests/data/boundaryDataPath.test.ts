import { describe, expect, it } from "vitest";
import { localDataPath } from "@/lib/data/boundaries/dataPath";

describe("localDataPath", () => {
	it("strips deployment cache keys from same-origin data URLs", () => {
		expect(
			localDataPath("/data/boundaries/wards/example.topojson?v=abc123"),
		).toBe("boundaries/wards/example.topojson");
	});

	it("supports the previous absolute CDN URL form", () => {
		expect(
			localDataPath(
				"https://cdn.jsdelivr.net/gh/example/repo@v1/data/boundaries/lad/example.topojson",
			),
		).toBe("boundaries/lad/example.topojson");
	});
});
