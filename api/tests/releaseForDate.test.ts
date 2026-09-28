import assert from "node:assert/strict";
import test from "node:test";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import { releaseMonth, selectReleaseForDate } from "../src/releaseForDate";

const release = (geography: string, id: string, countries: string[]) => ({
	id,
	geography,
	title: `${geography} ${id}`,
	coverage: { countries },
	source: {
		publisher: "ONS",
		url: "https://example.com",
		licence: { name: "Open Government Licence" },
	},
	metadataHash: `sha256:${id}`,
});

const UK = ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"];
const GB = ["GB-ENG", "GB-SCT", "GB-WLS"];

const registry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [
		release("ward", "2018-12-uk-bgc", UK),
		release("ward", "2019-12-gb-bgc", GB),
		release("ward", "2023-05-uk-bgc", UK),
		release("ward", "2023-12-uk-bgc", UK),
		release("lsoa", "2011-12-ew-bgc-v3", ["GB-ENG", "GB-WLS"]),
		release("lsoa", "2011-12-w-bgc", ["GB-WLS"]),
		release("dataZone", "2011-12-sc-bfc", ["GB-SCT"]),
		release("dataZone", "2011-12-sc-nc", ["GB-SCT"]),
		release("superOutputArea", "2011-ni", ["GB-NIR"]),
	],
};

const derivedFrom = new Map([["lsoa/2011-12-w-bgc", "lsoa/2011-12-ew-bgc-v3"]]);

const select = (geography: string, month: string, country?: string) =>
	selectReleaseForDate(registry, geography, month, country, derivedFrom);

test("reads a release's month from its id, and none from a year alone", () => {
	assert.equal(releaseMonth("2025-05-uk-bgc-v2"), "2025-05");
	assert.equal(releaseMonth("2011-ni"), undefined);
	assert.equal(releaseMonth("2011-13-uk"), undefined);
});

test("selects the latest release dated on or before the month", () => {
	const selection = select("ward", "2023-09");
	assert.equal(selection.status, "selected");
	if (selection.status !== "selected") return;
	assert.equal(selection.selected.id, "2023-05-uk-bgc");
	assert.equal(selection.sameMonth, false);
	assert.equal(selection.previous?.id, "2019-12-gb-bgc");
	assert.equal(selection.next?.id, "2023-12-uk-bgc");

	const inItsMonth = select("ward", "2023-05");
	assert.equal(
		inItsMonth.status === "selected" && inItsMonth.sameMonth,
		true,
	);
});

test("passes over a later release that does not cover the country", () => {
	const selection = select("ward", "2021-06", "GB-NIR");
	assert.equal(selection.status, "selected");
	if (selection.status !== "selected") return;
	assert.equal(selection.selected.id, "2018-12-uk-bgc");
	assert.deepEqual(
		selection.notCovering.map((candidate) => candidate.id),
		["2019-12-gb-bgc"],
	);
	assert.equal(selection.next?.id, "2023-05-uk-bgc");
});

test("prefers a source over the subset derived from it in the same month", () => {
	for (const country of [undefined, "GB-WLS"]) {
		const selection = select("lsoa", "2015-01", country);
		assert.equal(selection.status, "selected");
		if (selection.status !== "selected") return;
		assert.equal(selection.selected.id, "2011-12-ew-bgc-v3");
		assert.deepEqual(
			selection.setAside.map((candidate) => candidate.id),
			["2011-12-w-bgc"],
		);
	}
});

test("returns same-month variants that differ otherwise as an ambiguity", () => {
	const selection = select("dataZone", "2020-01");
	assert.equal(selection.status, "ambiguous");
	assert.deepEqual(
		selection.status === "ambiguous" &&
			selection.choices.map((choice) => choice.id),
		["2011-12-sc-bfc", "2011-12-sc-nc"],
	);
});

test("says why no release can be selected", () => {
	const absence = (geography: string, month: string, country?: string) => {
		const selection = select(geography, month, country);
		return selection.status === "none"
			? selection.absence
			: selection.status;
	};
	assert.equal(absence("parish", "2020-01"), "unknown-geography");
	assert.equal(absence("superOutputArea", "2020-01"), "no-dated-release");
	assert.equal(absence("lsoa", "2020-01", "GB-SCT"), "country-not-covered");
	const early = select("ward", "2010-01");
	assert.equal(
		early.status === "none" && early.absence,
		"before-first-release",
	);
	assert.equal(
		early.status === "none" && early.earliest?.id,
		"2018-12-uk-bgc",
	);
});
