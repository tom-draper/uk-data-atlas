import { describe, expect, it } from "vitest";
import {
	compileAreaContainment,
	compileLsoaLadContainment,
	type ContainmentCrosswalk,
} from "@/scripts/area-containment";

const crosswalk = (
	method: string,
	from: string,
	to: [string, string],
	pairs: Array<[string, ...string[]]>,
): ContainmentCrosswalk => ({
	id: `ward-${from}-to-${to.join("-")}-${method}`,
	method,
	from: { geography: "ward", boundaryRelease: from },
	to: { geography: to[0], boundaryRelease: to[1] },
	records: pairs.map(([code, ...targets]) => ({
		source: { code },
		targets: targets.map((target) => ({ code: target })),
	})),
});

const wardReleases = [
	{ year: 2017, release: "2017-12" },
	{ year: 2024, release: "2024-12" },
];

const constituencies = [
	crosswalk(
		"best-fit",
		"2017-12",
		["constituency", "2010"],
		[["W1", "OLD1"]],
	),
	crosswalk(
		"best-fit",
		"2017-12",
		["constituency", "2024"],
		[["W1", "NEW1"]],
	),
	crosswalk(
		"best-fit",
		"2024-12",
		["constituency", "2010"],
		[
			["W1", "OLD1"],
			["W2", "OLD1"],
			["W3", "OLD2"],
		],
	),
	crosswalk(
		"best-fit",
		"2024-12",
		["constituency", "2024"],
		[
			["W1", "NEW1"],
			["W2", "NEW1"],
			["W3", "NEW1"],
		],
	),
];

describe("area containment from the resolver", () => {
	it("takes a release's own authorities, and the newest best fit where it names none", () => {
		const mappings = compileAreaContainment(wardReleases, [
			...constituencies,
			crosswalk(
				"clean-containment",
				"2024-12",
				["localAuthority", "2024-12"],
				[
					["W1", "LAD24A"],
					["W2", "LAD24A"],
					["W3", "LAD24B"],
				],
			),
			crosswalk(
				"best-fit",
				"2017-12",
				["localAuthority", "2026-05"],
				[
					["W1", "LAD26A"],
					["W9", "LAD26B"],
				],
			),
		]);
		// W1 is named by the 2024 release; only W9 needs the best fit.
		expect(mappings.wardToLad).toEqual({
			W1: "LAD24A",
			W2: "LAD24A",
			W3: "LAD24B",
			W9: "LAD26B",
		});
		expect(mappings.ladToWards).toEqual({
			2024: { LAD24A: ["W1", "W2"], LAD24B: ["W3"] },
		});
	});

	it("places each ward in one constituency of every code set", () => {
		const mappings = compileAreaContainment(wardReleases, [
			...constituencies,
			crosswalk(
				"clean-containment",
				"2024-12",
				["localAuthority", "2024-12"],
				[],
			),
			crosswalk("best-fit", "2017-12", ["localAuthority", "2026-05"], []),
		]);
		expect(mappings.constituencyToWards).toEqual({
			2017: { OLD1: ["W1"], NEW1: ["W1"] },
			2024: {
				OLD1: ["W1", "W2"],
				OLD2: ["W3"],
				NEW1: ["W1", "W2", "W3"],
			},
		});
	});

	it("lets an official lookup decide every ward it does not split", () => {
		const mappings = compileAreaContainment(
			[{ year: 2024, release: "2024-12" }],
			[
				...constituencies.slice(2),
				crosswalk(
					"clean-containment",
					"2024-12",
					["localAuthority", "2024-12"],
					[],
				),
				crosswalk(
					"official-lookup",
					"2024-12",
					["constituency", "2024"],
					[
						["W2", "NEW2"],
						// Split: the best fit keeps it.
						["W3", "NEW1", "NEW2"],
					],
				),
			],
		);
		expect(mappings.constituencyToWards[2024]).toEqual({
			OLD1: ["W1", "W2"],
			OLD2: ["W3"],
			NEW1: ["W1", "W3"],
			NEW2: ["W2"],
		});
	});

	it("refuses a ward release the resolver cannot place", () => {
		expect(() =>
			compileAreaContainment(wardReleases, constituencies.slice(2)),
		).toThrow("ward/2017-12 names no local authority");
		expect(() =>
			compileAreaContainment(wardReleases, [
				crosswalk(
					"best-fit",
					"2017-12",
					["localAuthority", "2026-05"],
					[],
				),
				crosswalk(
					"clean-containment",
					"2024-12",
					["localAuthority", "2024-12"],
					[],
				),
				...constituencies.slice(2),
			]),
		).toThrow("places ward/2017-12 in no constituency");
	});
});

const lsoaCrosswalk = (
	method: string,
	from: string,
	to: string,
	pairs: Array<[string, ...string[]]>,
): ContainmentCrosswalk => ({
	...crosswalk(method, from, ["localAuthority", to], pairs),
	from: { geography: "lsoa", boundaryRelease: from },
});

describe("LSOA local authorities from the resolver", () => {
	// LAD23B was abolished by 2026; LAD23A carries on as LAD26A.
	const carryOn = (code: string, release: string) =>
		release === "2023" ? { LAD23A: "LAD26A" }[code] : undefined;

	it("lets a published authority decide where it carries on to the newest release", () => {
		expect(
			compileLsoaLadContainment(
				[
					{ year: 2021, release: "2021-12" },
					{ year: 2011, release: "2011-12" },
				],
				[
					lsoaCrosswalk("best-fit", "2021-12", "2026", [
						["L1", "LAD26B"],
						["L2", "LAD26C"],
						["L3", "LAD26C"],
					]),
					lsoaCrosswalk("clean-containment", "2021-12", "2023", [
						["L1", "LAD23A"],
						// Its authority ended, so the best fit keeps it.
						["L2", "LAD23B"],
					]),
					lsoaCrosswalk("best-fit", "2011-12", "2026", [
						["K1", "LAD26A"],
					]),
				],
				carryOn,
			),
		).toEqual({
			2021: { L1: "LAD26A", L2: "LAD26C", L3: "LAD26C" },
			2011: { K1: "LAD26A" },
		});
	});

	it("refuses an LSOA release the resolver cannot place", () => {
		expect(() =>
			compileLsoaLadContainment(
				[{ year: 2001, release: "2001-12" }],
				[],
				carryOn,
			),
		).toThrow("places lsoa/2001-12 in no local authority");
	});
});
