import { describe, expect, it } from "vitest";
import { isLocalAuthorityEstimate } from "@/components/LocalAuthorityEstimateIndicator";
import type { SelectedArea } from "@/lib/types";

const ward: SelectedArea = {
	type: "ward",
	code: "E05000001",
	name: "Example ward",
	data: null,
};

describe("isLocalAuthorityEstimate", () => {
	it("marks ward data resolved through a local authority", () => {
		expect(isLocalAuthorityEstimate(ward, true)).toBe(true);
	});

	it("does not mark a ward without a resolved local-authority record", () => {
		expect(isLocalAuthorityEstimate(ward, false)).toBe(false);
	});

	it("does not label an authority's own figure as an estimate", () => {
		expect(
			isLocalAuthorityEstimate(
				{
					type: "localAuthority",
					code: "E08000001",
					name: "Example authority",
					data: null,
				},
				true,
			),
		).toBe(false);
	});
});
