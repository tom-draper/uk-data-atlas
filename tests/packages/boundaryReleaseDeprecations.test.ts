import { describe, expect, it } from "vitest";
import { boundaryReleaseDeprecations } from "@uk-data-atlas/catalogue";

describe("boundary release deprecations", () => {
	it("names a different release of the same geography as each replacement", () => {
		for (const [key, deprecation] of Object.entries(
			boundaryReleaseDeprecations,
		)) {
			const [geography, release] = key.split("/");
			expect(geography && release, key).toBeTruthy();
			expect(deprecation.replacedBy).not.toBe(release);
			expect(deprecation.replacedBy).not.toContain("/");
			expect(
				`${geography}/${deprecation.replacedBy}` in
					boundaryReleaseDeprecations,
				`${key} is replaced by a deprecated release`,
			).toBe(false);
			expect(deprecation.deprecated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(deprecation.reason.length).toBeGreaterThan(0);
			if (deprecation.sunset !== undefined) {
				expect(deprecation.sunset).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				expect(deprecation.sunset > deprecation.deprecated).toBe(true);
			}
		}
	});

	it("retires the thinned 2001 LSOA release in favour of its unthinned import", () => {
		expect(
			boundaryReleaseDeprecations["lsoa/2001-12-ew-bgc"]?.replacedBy,
		).toBe("2001-12-ew-bgc-v2");
	});
});
