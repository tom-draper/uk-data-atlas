import { describe, expect, it } from "vitest";
import { parseDatasetMeta } from "@uk-data-atlas/datasets";

const valid = () => ({
	id: "2025",
	dataset: "local-election",
	title: "Local election results 2025",
	publisher: "House of Commons Library",
	sourceUrl: "https://example.org/dataset",
	licence: { name: "Open Parliament Licence" },
	files: [{ path: "results.csv", role: "source" }],
});

/** The same, for a kind that feeds no dataset. */
const unattached = (kind: string) => {
	const { dataset: _dataset, ...rest } = valid();
	return { ...rest, kind };
};

describe("parseDatasetMeta", () => {
	it("reads a minimal dataset description", () => {
		const meta = parseDatasetMeta(valid(), "2025");

		expect(meta.id).toBe("2025");
		expect(meta.kind).toBe("dataset");
		expect(meta.dataset).toBe("local-election");
		expect(meta.licence).toEqual({ name: "Open Parliament Licence" });
		expect(meta.files).toEqual([{ path: "results.csv", role: "source" }]);
	});

	it("keeps the optional fields when present", () => {
		const meta = parseDatasetMeta(
			{
				...valid(),
				retrieved: "2026-09-03",
				temporalCoverage: "2025",
				spatialCoverage: {
					geography: "ward",
					vintage: 2025,
					countries: ["GB-ENG"],
				},
				publisherRevision: {
					lastEditDate: 1,
					schemaLastEditDate: 2,
					dataLastEditDate: 3,
				},
				attribution: ["Contains public sector information"],
				notes: ["Rounded to the nearest 10"],
			},
			"2025",
		);

		expect(meta.spatialCoverage).toEqual({
			geography: "ward",
			vintage: 2025,
			countries: ["GB-ENG"],
		});
		expect(meta.publisherRevision?.dataLastEditDate).toBe(3);
		expect(meta.attribution).toEqual([
			"Contains public sector information",
		]);
		expect(meta.notes).toEqual(["Rounded to the nearest 10"]);
	});

	it("omits optional fields rather than storing undefined", () => {
		const meta = parseDatasetMeta(valid(), "2025");

		expect("spatialCoverage" in meta).toBe(false);
		expect("retrieved" in meta).toBe(false);
	});

	describe("dataset", () => {
		it("is required of a dataset source", () => {
			const { dataset: _dataset, ...without } = valid();

			expect(() => parseDatasetMeta(without, "2025")).toThrow(
				/2025\/meta\.json: "dataset" is required/,
			);
		});

		it("must be a dataset the registry declares", () => {
			expect(() =>
				parseDatasetMeta(
					{ ...valid(), dataset: "local-elections" },
					"2025",
				),
			).toThrow(
				/"dataset" "local-elections" is not a registered dataset/,
			);
		});

		it("is refused on a source that feeds no dataset", () => {
			for (const kind of [
				"boundary",
				"lookup",
				"postcode-directory",
				"support",
				"staged",
			]) {
				expect(() =>
					parseDatasetMeta(
						{ ...unattached(kind), dataset: "population" },
						"2025",
					),
				).toThrow(/"dataset" must be absent/);
			}
		});

		it("is not asked of a source that feeds no dataset", () => {
			for (const kind of [
				"boundary",
				"lookup",
				"postcode-directory",
				"support",
				"staged",
			])
				expect(parseDatasetMeta(unattached(kind), "2025").kind).toBe(
					kind,
				);
		});
	});

	it("rejects an unknown kind", () => {
		expect(() =>
			parseDatasetMeta({ ...valid(), kind: "table" }, "2025"),
		).toThrow(
			/"kind" must be one of dataset, boundary, lookup, postcode-directory, support, staged/,
		);
	});

	it("rejects a field the schema does not have, such as the old topics", () => {
		expect(() =>
			parseDatasetMeta({ ...valid(), topics: ["politics"] }, "2025"),
		).toThrow(/unknown field "topics"/);
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

	it("types the fields that were free-form", () => {
		expect(() =>
			parseDatasetMeta({ ...valid(), notes: "one string" }, "2025"),
		).toThrow(/"notes" must be an array of strings/);
		expect(() =>
			parseDatasetMeta(
				{ ...valid(), publisherRevision: { lastEditDate: 1 } },
				"2025",
			),
		).toThrow(/"publisherRevision\.schemaLastEditDate" is required/);
		expect(() =>
			parseDatasetMeta(
				{ ...valid(), spatialCoverage: { vintage: "2025" } },
				"2025",
			),
		).toThrow(/"spatialCoverage\.vintage" must be a number/);
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
		).toThrow(/role" must be one of source, derived, lookup, reference/);
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
		).toThrow(/"files\[0\]\.derivedFrom" only applies to a derived file/);
	});
});
