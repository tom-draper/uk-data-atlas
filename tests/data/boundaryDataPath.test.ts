import { describe, expect, it } from "vitest";
import { localDataPath } from "@/lib/data/boundaries/dataPath";

describe("localDataPath", () => {
	it("strips deployment cache keys from same-origin data URLs", () => {
		expect(
			localDataPath(
				"/data/boundaries/ward/2023-12-uk-bgc/boundaries.topojson?v=abc123",
			),
		).toBe("boundaries/ward/2023-12-uk-bgc/boundaries.topojson");
	});

	it("supports the previous absolute CDN URL form", () => {
		expect(
			localDataPath(
				"https://cdn.jsdelivr.net/gh/example/repo@v1/data/boundaries/local-authority/2025-05-uk-bgc-v2/boundaries.topojson",
			),
		).toBe(
			"boundaries/local-authority/2025-05-uk-bgc-v2/boundaries.topojson",
		);
	});
});
