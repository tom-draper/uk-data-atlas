import { describe, expect, it } from "vitest";
import { localAuthorityStats } from "@/lib/helpers/localAuthorityStats";

type SourceRecord = { value: number; ignored: string };

const dataset: { year: number; data: Record<string, SourceRecord> } = {
	year: 2024,
	data: {
		E06000001: { value: 10, ignored: "source metadata" },
	},
};

const aggregate = { value: 100 };
const project = (record: SourceRecord) => ({
	value: record.value,
});

describe("localAuthorityStats", () => {
	it("uses the whole-location aggregate when no area is selected", () => {
		expect(
			localAuthorityStats(
				dataset,
				{ 2024: aggregate },
				null,
				undefined,
				project,
			),
		).toEqual(aggregate);
	});

	it("projects the selected local authority's record", () => {
		expect(
			localAuthorityStats(
				dataset,
				null,
				{
					type: "localAuthority",
					code: "E06000001",
					name: "Hartlepool",
					data: null,
				},
				undefined,
				project,
			),
		).toEqual({ value: 10 });
	});

	it("resolves a ward through the supplied local-authority mapping", () => {
		expect(
			localAuthorityStats(
				dataset,
				null,
				{ type: "ward", code: "E05000001", name: "Ward", data: null },
				{ getLadForWard: () => "E06000001" },
				project,
			),
		).toEqual({ value: 10 });
	});

	it("returns null when the selected authority has no record", () => {
		expect(
			localAuthorityStats(
				dataset,
				null,
				{
					type: "localAuthority",
					code: "E06000002",
					name: "Middlesbrough",
					data: null,
				},
				undefined,
				project,
			),
		).toBeNull();
	});
});
