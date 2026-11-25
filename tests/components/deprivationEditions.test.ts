import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EarlierEditions } from "@/components/datasets/society/deprivation/EarlierEditions";
import {
	EDITIONS_NOTE,
	earlierEditionCells,
	earlierEditionRows,
	type EarlierEditionRow,
	type EditionDataset,
} from "@/lib/datasets/deprivationEditions";
import type { SelectedArea } from "@/lib/types/areas";

type EditionsConfig = Parameters<typeof earlierEditionRows>[0]["config"];
type EditionDatasets = Parameters<typeof earlierEditionRows>[0]["datasets"];

const config: EditionsConfig = {
	areaType: "lsoa",
	summaryField: "ladStats",
	decileField: "imdDecile",
	earlierEditions: {
		rankField: "imdRank",
		editions: [{ year: 2015, areaCount: 32844 }],
	},
};

// E01008162 kept its code from 2011 to 2021; E01024027 was split, so its
// 2021 children such as E01034985 are new codes. E06000060 is an authority
// created after 2015.
const latest: EditionDataset = {
	data: {
		E01008162: { imdDecile: 3, imdRank: 9000 },
		E01034985: { imdDecile: 6, imdRank: 20000 },
	},
	ladStats: {
		E06000001: { areaCount: 59, mostDeprivedCount: 20 },
		E06000060: { areaCount: 330, mostDeprivedCount: 4 },
	},
};
const edition2015: EditionDataset = {
	data: {
		E01008162: { imdDecile: 4, imdRank: 12816 },
		E01024027: { imdDecile: 7, imdRank: 22000 },
	},
	ladStats: {
		E06000001: { areaCount: 58, mostDeprivedCount: 19 },
	},
};
const datasets = { "2015": edition2015, "2025": latest };

const area = (type: SelectedArea["type"], code: string) =>
	({ type, code, data: {} }) as unknown as SelectedArea;

const rowsFor = (
	selectedArea: SelectedArea | null,
	sets: EditionDatasets = datasets,
) => earlierEditionRows({ config, latest, datasets: sets, selectedArea });

describe("earlier deprivation editions", () => {
	it("lists an unchanged small area's own 2015 decile and rank", () => {
		expect(rowsFor(area("lsoa", "E01008162"))).toEqual([
			{
				kind: "area",
				year: 2015,
				decile: 4,
				rank: 12816,
				areaCount: 32844,
			},
		]);
	});

	it("says boundaries changed for a split small area, apportioning nothing", () => {
		expect(rowsFor(area("lsoa", "E01034985"))).toEqual([
			{ kind: "noMatch", year: 2015, area: "smallArea" },
		]);
	});

	it("gives an unchanged authority its 2015 share in the most deprived tenth", () => {
		expect(rowsFor(area("localAuthority", "E06000001"))).toEqual([
			{
				kind: "summary",
				year: 2015,
				mostDeprivedCount: 19,
				areaCount: 58,
			},
		]);
	});

	it("says boundaries changed for an authority new since 2015", () => {
		expect(rowsFor(area("localAuthority", "E06000060"))).toEqual([
			{ kind: "noMatch", year: 2015, area: "authority" },
		]);
	});

	it("adds nothing where the latest edition does not cover the area", () => {
		// A Welsh authority or small area has no English IMD summary or record.
		expect(rowsFor(area("localAuthority", "W06000015"))).toEqual([]);
		expect(rowsFor(area("lsoa", "W01001898"))).toEqual([]);
	});

	it("adds nothing for a whole selection, which has no published summary", () => {
		expect(rowsFor(null)).toEqual([]);
	});

	it("skips an edition that is not loaded", () => {
		expect(rowsFor(area("lsoa", "E01008162"), { "2025": latest })).toEqual(
			[],
		);
	});

	it("adds nothing for an index without earlier editions", () => {
		expect(
			earlierEditionRows({
				config: { ...config, earlierEditions: undefined },
				latest,
				datasets,
				selectedArea: area("lsoa", "E01008162"),
			}),
		).toEqual([]);
	});
});

describe("earlier editions are never shown as a change", () => {
	const rows: EarlierEditionRow[] = [
		{ kind: "area", year: 2015, decile: 4, rank: 12816, areaCount: 32844 },
		{ kind: "summary", year: 2015, mostDeprivedCount: 19, areaCount: 58 },
		{ kind: "noMatch", year: 2015, area: "smallArea" },
	];

	it("states each edition's position in its own terms", () => {
		expect(rows.map((row) => earlierEditionCells(row, "LSOAs"))).toEqual([
			["2015", "Decile 4", "Rank 12,816 of 32,844"],
			["2015", "33% in most deprived 10%", "19 of 58 LSOAs"],
			["2015", "Boundaries changed, no direct match", ""],
		]);
	});

	it("carries no difference from another edition", () => {
		const produced = [
			area("lsoa", "E01008162"),
			area("lsoa", "E01034985"),
			area("localAuthority", "E06000001"),
			area("localAuthority", "E06000060"),
		].flatMap((selected) => rowsFor(selected));
		const allowed = [
			"kind",
			"year",
			"decile",
			"rank",
			"areaCount",
			"mostDeprivedCount",
			"area",
		];
		expect(produced).toHaveLength(4);
		for (const row of produced)
			for (const key of Object.keys(row)) expect(allowed).toContain(key);
	});

	it("renders the rows and note with no arrows, signs or chart", () => {
		const markup = renderToStaticMarkup(
			createElement(EarlierEditions, { rows, areaNoun: "LSOAs" }),
		);
		expect(markup).toContain("Earlier editions");
		expect(markup).toContain("Rank 12,816 of 32,844");
		expect(markup).toContain(EDITIONS_NOTE);
		expect(markup).not.toMatch(/[↑↓▲▼←→⬆⬇+]|<svg|<path|<line/);
		expect(markup).not.toMatch(/(^|[\s>])[-−]\d/);
		expect(markup).not.toContain("\u2014");
	});

	it("renders nothing when there are no earlier editions", () => {
		expect(
			renderToStaticMarkup(
				createElement(EarlierEditions, { rows: [], areaNoun: "LSOAs" }),
			),
		).toBe("");
	});
});
