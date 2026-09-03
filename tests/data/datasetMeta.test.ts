import { describe, expect, it } from "vitest";
import { parseDatasetMeta } from "@/lib/data/catalog/meta";

const valid = () => ({
	id: "2025",
	title: "Local election results 2025",
	publisher: "House of Commons Library",
	sourceUrl: "https://example.org/dataset",
	licence: { name: "Open Parliament Licence" },
	files: [{ path: "results.csv", role: "source" }],
});

describe("parseDatasetMeta", () => {
	it("reads a minimal dataset description", () => {
		const meta = parseDatasetMeta(valid(), "2025");

		expect(meta.id).toBe("2025");
		expect(meta.licence).toEqual({ name: "Open Parliament Licence" });
		expect(meta.files).toEqual([{ path: "results.csv", role: "source" }]);
	});

	it("keeps the optional coverage fields when present", () => {
		const meta = parseDatasetMeta(
			{
				...valid(),
				topics: ["politics"],
				retrieved: "2026-09-03",
				temporalCoverage: "2025",
				spatialCoverage: {
					geography: "ward",
					vintage: 2025,
					countries: ["GB-ENG"],
				},
			},
			"2025",
		);

		expect(meta.topics).toEqual(["politics"]);
		expect(meta.spatialCoverage).toEqual({
			geography: "ward",
			vintage: 2025,
			countries: ["GB-ENG"],
		});
	});

	it("omits optional fields rather than storing undefined", () => {
		const meta = parseDatasetMeta(valid(), "2025");

		expect("topics" in meta).toBe(false);
		expect("spatialCoverage" in meta).toBe(false);
	});

	it("refuses an id that disagrees with the folder", () => {
		expect(() => parseDatasetMeta(valid(), "2024")).toThrow(
			/"id" is "2025" but the folder is "2024"/,
		);
	});

	it("names the offending field and folder in the message", () => {
		expect(() =>
			parseDatasetMeta({ ...valid(), publisher: "" }, "2025"),
		).toThrow(/2025\/meta\.json: "publisher" must be a non-empty string/);
	});

	it("requires a licence object", () => {
		expect(() =>
			parseDatasetMeta(
				{ ...valid(), licence: "Open Government" },
				"2025",
			),
		).toThrow(/"licence" must be an object/);
	});

	it("requires at least one file, and one of them to be the source", () => {
		expect(() =>
			parseDatasetMeta({ ...valid(), files: [] }, "2025"),
		).toThrow(/"files" must list at least one file/);
		expect(() =>
			parseDatasetMeta(
				{
					...valid(),
					files: [{ path: "notes.txt", role: "reference" }],
				},
				"2025",
			),
		).toThrow(/at least one file must have role "source"/);
	});

	it("rejects an unknown file role", () => {
		expect(() =>
			parseDatasetMeta(
				{ ...valid(), files: [{ path: "a.csv", role: "raw" }] },
				"2025",
			),
		).toThrow(/"role" must be one of source, derived, lookup, reference/);
	});

	it("keeps file paths inside the dataset folder", () => {
		for (const path of ["../secrets.csv", "/etc/passwd"]) {
			expect(() =>
				parseDatasetMeta(
					{ ...valid(), files: [{ path, role: "source" }] },
					"2025",
				),
			).toThrow(/must stay inside the dataset folder/);
		}
	});

	it("requires a retrieved date to be an ISO date", () => {
		expect(() =>
			parseDatasetMeta({ ...valid(), retrieved: "3 Sept 2026" }, "2025"),
		).toThrow(/must be an ISO date/);
	});

	it("rejects anything that is not an object", () => {
		expect(() => parseDatasetMeta("not a dataset", "2025")).toThrow(
			/must be a JSON object/,
		);
		expect(() => parseDatasetMeta([valid()], "2025")).toThrow(
			/must be a JSON object/,
		);
	});

	it("records what a derived file was extracted from", () => {
		const meta = parseDatasetMeta(
			{
				...valid(),
				files: [
					{ path: "results.xlsx", role: "source" },
					{
						path: "results.csv",
						role: "derived",
						derivedFrom: "results.xlsx",
					},
				],
			},
			"2025",
		);

		expect(meta.files[1]).toEqual({
			path: "results.csv",
			role: "derived",
			derivedFrom: "results.xlsx",
		});
	});

	it("refuses derivedFrom on a file that is not derived", () => {
		expect(() =>
			parseDatasetMeta(
				{
					...valid(),
					files: [
						{
							path: "results.csv",
							role: "source",
							derivedFrom: "results.xlsx",
						},
					],
				},
				"2025",
			),
		).toThrow(/"derivedFrom" only applies to a derived file/);
	});
});
