import assert from "node:assert/strict";
import test from "node:test";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "../src/routing";
import {
	registry,
	dataCatalog,
	measureObservations,
	populationObservations,
	populationLocalAuthorityObservations,
} from "./routeFixtures";

test("ranks change between two periods of one source partition", () => {
	const context: RouteContext = {
		boundaryRegistry: registry,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
	const ask = (measureId: string, query: string) =>
		routeRequest("GET", `/v1/data/${measureId}/change?${query}`, context);
	const partition = "geography=localAuthority&boundaryYear=2023";
	type Record = {
		areaCode: string;
		rank: number;
		tieCount: number;
		start: { period: string; value: number };
		end: { period: string; value: number };
		absoluteChange: number;
		relativeChange: number | null;
	};
	const data = (response: ReturnType<typeof ask>) =>
		(
			response.body as {
				data: {
					change: { direction: string; basis: string; unit: string };
					coverage: { areasRanked: number; onlyAtStart: string[] };
					records: Record[];
				};
			}
		).data;

	// Both authorities grow by 20 people between 2022 and 2024, so absolute
	// change ties them at rank 1, and the next rank would account for both.
	const absolute = ask(
		"population-estimate",
		`${partition}&startPeriod=2022&endPeriod=2024`,
	);
	assert.equal(
		absolute.status,
		200,
		JSON.stringify(absolute.body).slice(0, 300),
	);
	assert.equal(data(absolute).change.direction, "end-minus-start");
	assert.equal(data(absolute).change.unit, "people");
	assert.deepEqual(
		data(absolute).records.map((record) => [record.rank, record.tieCount]),
		[
			[1, 2],
			[1, 2],
		],
	);
	const first = data(absolute).records.find(
		(record) => record.areaCode === "E06000001",
	)!;
	assert.deepEqual(first.start, {
		period: "2022",
		areaCode: "E06000001",
		value: 280,
		status: "observed",
	});
	assert.equal(first.end.value, 300);
	assert.equal(first.absoluteChange, 20);

	// Relative change separates them: 20 on 280 is more than 20 on 380.
	const relative = ask(
		"population-estimate",
		`${partition}&startPeriod=2022&endPeriod=2024&by=relative`,
	);
	assert.equal(data(relative).change.unit, "proportion");
	assert.deepEqual(
		data(relative).records.map((record) => record.areaCode),
		["E06000001", "N09000001"],
	);
	assert.ok(
		Math.abs(data(relative).records[0]!.relativeChange! - 20 / 280) < 1e-12,
	);

	// One area, keeping its place among all of them.
	const one = ask(
		"population-estimate",
		`${partition}&startPeriod=2022&endPeriod=2024&by=relative&areaCode=N09000001`,
	);
	assert.equal(data(one).records.length, 1);
	assert.equal(data(one).records[0]!.rank, 2);
	assert.equal(data(one).coverage.areasRanked, 2);

	// Refusals, each saying how to recover.
	const refusals: [string, string, number, RegExp][] = [
		// The partition's periods are listed, not guessed at.
		[
			"population-estimate",
			`${partition}&startPeriod=2019&endPeriod=2024`,
			400,
			/2022, 2023, 2024/,
		],
		[
			"population-estimate",
			`${partition}&startPeriod=2024&endPeriod=2022`,
			400,
			/before/,
		],
		// Naming no partition lists the partitions that exist.
		[
			"population-estimate",
			"startPeriod=2022&endPeriod=2024",
			400,
			/boundaryYear=2023 \(3 periods\)/,
		],
		// A partition of one period has nothing to change between.
		[
			"ghg-emissions",
			"geography=localAuthority&boundaryYear=2025&startPeriod=2024&endPeriod=2024",
			422,
			/single period/,
		],
		// A single-period partition is refused before the basis is looked at,
		// so a ratio asked for relatively is told there is nothing to change
		// between. The ratio rule itself is covered where it is decided.
		[
			"mobile-5g-coverage",
			"geography=localAuthority&boundaryYear=2024&startPeriod=2025&endPeriod=2025&by=relative",
			422,
			/single period/,
		],
		[
			"population-estimate",
			`${partition}&startPeriod=2022&endPeriod=2024&release=2023-05-uk-bgc-v2`,
			422,
			/one source partition/,
		],
		[
			"population-estimate",
			`${partition}&startPeriod=2022&endPeriod=2024&areaCode=E99999999`,
			404,
			/not in this partition/,
		],
	];
	for (const [measureId, query, status, detail] of refusals) {
		const response = ask(measureId, query);
		assert.equal(response.status, status, `${measureId}?${query}`);
		assert.match((response.body as { detail: string }).detail, detail);
	}
});
