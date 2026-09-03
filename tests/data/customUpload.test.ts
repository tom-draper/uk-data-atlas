import { describe, expect, it } from "vitest";
import type { AreaBank, AreaEntry, AreaMatch } from "@/lib/data/areaBank";
import {
	buildUpload,
	canVisualise,
	chooseMatch,
	guessCodeColumn,
	guessValueColumn,
	isPointMode,
	isSpecialMatchType,
	matchColumn,
	uploadColumns,
} from "@/lib/data/custom/upload";

const entry = (
	label: string,
	matchType: AreaEntry["matchType"],
	codes: string[] = [],
): AreaEntry => ({
	label,
	boundaryType: "localAuthority",
	year: 2024,
	matchType,
	codes: new Set(codes),
	nameToCode: new Map(),
});

const match = (
	label: string,
	matchType: AreaEntry["matchType"],
	percentage: number,
): AreaMatch => ({ entry: entry(label, matchType), percentage, matchCount: 1 });

const csv = [
	["Notes about this file"],
	["LAD24CD", "Value", "Latitude", "Longitude"],
	["E06000001", "10", "54.68", "-1.23"],
	["E06000002", "20", "54.55", "-1.30"],
];

describe("uploadColumns", () => {
	it("pairs each header with a taste of the first data row", () => {
		expect(uploadColumns(csv, 1)).toEqual([
			{ name: "LAD24CD", preview: "E06000001", index: 0 },
			{ name: "Value", preview: "10", index: 1 },
			{ name: "Latitude", preview: "54.68", index: 2 },
			{ name: "Longitude", preview: "-1.23", index: 3 },
		]);
	});

	it("truncates a long preview", () => {
		const long = [["Header"], ["x".repeat(40)]];
		expect(uploadColumns(long, 0)[0].preview).toHaveLength(25);
	});

	it("returns nothing for a header row past the end of the file", () => {
		expect(uploadColumns(csv, 99)).toEqual([]);
	});
});

describe("guessCodeColumn", () => {
	it("picks the header that reads like an area code", () => {
		expect(guessCodeColumn(["Value", "Ward Code", "Total"])).toBe(
			"Ward Code",
		);
		expect(guessCodeColumn(["Constituency", "Votes"])).toBe("Constituency");
	});

	it("returns nothing when no header looks like one", () => {
		expect(guessCodeColumn(["Value", "Total"])).toBeUndefined();
	});
});

describe("matchColumn", () => {
	const areaBank: AreaBank = [
		entry("LADs 2024", "code", ["E06000001", "E06000002"]),
	];

	it("matches the selected column's values against the bank", () => {
		const matches = matchColumn(csv, 1, "LAD24CD", areaBank);
		expect(matches[0].entry.label).toBe("LADs 2024");
		expect(matches[0].percentage).toBe(100);
	});

	it("returns nothing when the column is absent or unselected", () => {
		expect(matchColumn(csv, 1, "", areaBank)).toEqual([]);
		expect(matchColumn(csv, 1, "Missing", areaBank)).toEqual([]);
		expect(matchColumn([], 0, "LAD24CD", areaBank)).toEqual([]);
	});
});

describe("chooseMatch", () => {
	const matches = [
		match("LADs 2024", "code", 90),
		match("Wards 2024", "code", 40),
	];

	it("takes the strongest match by default", () => {
		expect(chooseMatch(matches, "")?.entry.label).toBe("LADs 2024");
	});

	it("honours the reader's override", () => {
		expect(chooseMatch(matches, "Wards 2024")?.entry.label).toBe(
			"Wards 2024",
		);
	});

	it("falls back to the strongest when the override names nothing", () => {
		expect(chooseMatch(matches, "Nonexistent")?.entry.label).toBe(
			"LADs 2024",
		);
	});

	it("returns null with no matches at all", () => {
		expect(chooseMatch([], "")).toBeNull();
	});
});

describe("canVisualise", () => {
	it("accepts code and name matches", () => {
		expect(canVisualise(match("LADs", "code", 90))).toBe(true);
		expect(canVisualise(match("LADs", "name", 90))).toBe(true);
	});

	it("rejects the match types with no boundaries to colour", () => {
		expect(canVisualise(match("Postcodes", "postcode-full", 90))).toBe(
			false,
		);
		expect(canVisualise(match("Districts", "postcode-district", 90))).toBe(
			false,
		);
		expect(canVisualise(match("Points", "coordinate", 90))).toBe(false);
		expect(canVisualise(null)).toBe(false);
	});

	it("agrees with isSpecialMatchType", () => {
		expect(isSpecialMatchType("postcode-full")).toBe(true);
		expect(isSpecialMatchType("code")).toBe(false);
	});
});

describe("isPointMode", () => {
	const coord = { latIdx: 2, lngIdx: 3 } as never;

	it("plots points when nothing else matches a boundary set", () => {
		expect(isPointMode(coord, [])).toBe(true);
		expect(isPointMode(coord, [match("LADs", "code", 59)])).toBe(true);
	});

	it("prefers boundaries when the codes match one strongly", () => {
		expect(isPointMode(coord, [match("LADs", "code", 60)])).toBe(false);
		expect(isPointMode(coord, [match("LADs", "name", 95)])).toBe(false);
	});

	it("ignores a strong match of a type that isn't a boundary set", () => {
		expect(
			isPointMode(coord, [match("Postcodes", "postcode-full", 99)]),
		).toBe(true);
	});

	it("stays off without coordinate columns", () => {
		expect(isPointMode(null, [])).toBe(false);
	});
});

describe("guessValueColumn", () => {
	it("takes the first numeric column that isn't a coordinate", () => {
		expect(
			guessValueColumn(csv, 1, { latIdx: 2, lngIdx: 3 } as never),
		).toBe("Value");
	});

	it("returns nothing when every other column is text", () => {
		const text = [
			["Name", "Latitude", "Longitude"],
			["Durham", "54.68", "-1.23"],
		];
		expect(
			guessValueColumn(text, 0, { latIdx: 1, lngIdx: 2 } as never),
		).toBeUndefined();
	});
});

describe("buildUpload", () => {
	const draft = {
		file: "areas.csv",
		csvData: csv,
		headerRow: 1,
		selectedColumn: "LAD24CD",
		dataColumn: "Value",
		latColumn: "Latitude",
		lngColumn: "Longitude",
	};

	it("describes a choropleth upload from the chosen match", () => {
		const result = buildUpload(
			draft,
			false,
			match("LADs 2024", "code", 90),
		);

		expect(result).toEqual({
			upload: {
				file: "areas.csv",
				headerRow: 1,
				mode: "choropleth",
				selectedColumn: "LAD24CD",
				dataColumn: "Value",
				boundaryType: "localAuthority",
				boundaryYear: 2024,
				selectedEntry: expect.objectContaining({ label: "LADs 2024" }),
				data: csv,
			},
		});
	});

	it("describes a point upload from the coordinate columns", () => {
		const result = buildUpload(draft, true, null);

		expect(result).toEqual({
			upload: {
				file: "areas.csv",
				headerRow: 1,
				data: csv,
				mode: "points",
				latColumn: "Latitude",
				lngColumn: "Longitude",
				dataColumn: "Value",
			},
		});
	});

	it("reports a yearless area set as having no boundary year", () => {
		const undated = match("Postcodes areas", "code", 90);
		undated.entry.year = 0;
		const result = buildUpload(draft, false, undated);

		expect(result).toHaveProperty("upload.boundaryYear", null);
	});

	it("asks for the missing point columns", () => {
		expect(buildUpload({ ...draft, lngColumn: "" }, true, null)).toEqual({
			error: "Please select latitude, longitude, and value columns",
		});
	});

	it("asks for the missing choropleth selections", () => {
		expect(buildUpload({ ...draft, dataColumn: "" }, false, null)).toEqual({
			error: "Please select a file, area code column, data column, and matching area type",
		});
	});

	it("refuses a match the atlas cannot draw", () => {
		expect(
			buildUpload(draft, false, match("Postcodes", "postcode-full", 90)),
		).toEqual({ error: "Postcode visualisation is coming soon." });
	});
});
