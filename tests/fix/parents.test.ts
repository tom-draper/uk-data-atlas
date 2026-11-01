import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parentChoices, readParentLookup } from "@/lib/fix/parents";
import type { BulkLookup, Crosswalk } from "@/lib/fix/types";
import { fixture, LATEST, releases } from "./sample";

/** `/crosswalks` and `/lookups`, trimmed to the entries for recent wards. */
const crosswalks = fixture<Crosswalk[]>("crosswalks");
const lookups = fixture<{ lookups: BulkLookup[] }>("lookups").lookups;
const csv = (name: string) =>
	readFileSync(`tests/fixtures/fix/${name}.csv`, "utf8");

describe("parentChoices", () => {
	const choices = parentChoices(LATEST, crosswalks, lookups, releases);

	it("offers the larger areas the latest wards sit in", () => {
		expect(choices.map((choice) => choice.id)).toEqual([
			"ward-2026-05-uk-bgc-to-constituency-2024-07-uk-bgc-best-fit",
			"ward-2026-05-uk-bgc-to-constituency-2022-12-uk-bgc-best-fit",
			"ward-2026-05-uk-bgc-to-local-authority-2026-05-uk-bgc-clean-containment",
		]);
	});

	it("names columns by geography, with the release when two share one", () => {
		expect(choices.map((choice) => choice.header)).toEqual([
			"constituency_2024_07",
			"constituency_2022_12",
			"local_authority",
		]);
	});

	it("links each choice to its lookup's CSV", () => {
		expect(choices[2].href).toBe(
			"/v1/lookups/crosswalk-ward-2026-05-uk-bgc-to-local-authority-2026-05-uk-bgc-clean-containment?format=csv",
		);
	});

	it("leaves out crosswalks to the same geography", () => {
		const older = parentChoices(
			{ geography: "ward", boundaryRelease: "2025-12-uk-bgc" },
			crosswalks,
			lookups,
			releases,
		);
		expect(older.every((choice) => choice.to.geography !== "ward")).toBe(
			true,
		);
		expect(older).toHaveLength(2);
	});
});

describe("readParentLookup", () => {
	it("reads each ward's local authority", () => {
		const lookup = readParentLookup(csv("lookup-ward-to-local-authority"));
		expect(lookup.get("E05016249")).toEqual([
			{ code: "E06000054", name: "Wiltshire" },
		]);
	});

	it("reads a best-fit constituency, quoted labels included", () => {
		const lookup = readParentLookup(csv("lookup-ward-to-constituency"));
		expect(lookup.size).toBe(36);
		for (const parents of lookup.values()) expect(parents).toHaveLength(1);
		expect(lookup.get("E05016249")?.[0].name).toBeTruthy();
	});

	it("takes the first of several labels as the name", () => {
		const lookup = readParentLookup(
			"sourceCode,targetCode,targetLabels\nW05000001,W06000001,Isle of Anglesey | Ynys Môn\n",
		);
		expect(lookup.get("W05000001")?.[0].name).toBe("Isle of Anglesey");
	});
});
