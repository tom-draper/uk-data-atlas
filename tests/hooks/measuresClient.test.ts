import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-db";
import {
	areaSeries,
	columnFor,
	fetchMeasureValues,
	measureRows,
	MeasureQueryError,
	valuesByCode,
} from "@/lib/measures/client";
import { createMeasureValuesHandler } from "@/lib/measures/handler";
import { createMeasureValuesService } from "@/lib/measures/server";
import { createMeasureFixture } from "../helpers/measureFixture";

let calls: string[];
let fetchFromRoute: (input: string, init?: RequestInit) => Promise<Response>;

beforeAll(() => {
	const fixture = createMeasureFixture();
	const route = createMeasureValuesHandler(() =>
		createMeasureValuesService({
			context: () => fixture.context,
			generation: () => 1,
		}),
	);
	// The client talks to the real route handler, so what it decodes is what
	// the route sends.
	fetchFromRoute = async (input, init) => {
		calls.push(input);
		const url = new URL(input, "http://localhost");
		const measure = decodeURIComponent(url.pathname.split("/").pop()!);
		return route(new Request(url, init), {
			params: Promise.resolve({ measure }),
		});
	};
}, 120_000);

beforeEach(() => {
	calls = [];
});

afterAll(() => closeAllReadOnlyDatabases());

describe("measure client", () => {
	it("asks for the URL the request writes and decodes the response", async () => {
		const payload = await fetchMeasureValues(
			{
				measure: "population",
				geography: "localAuthority",
				periods: ["2022", "2023"],
			},
			{ fetch: fetchFromRoute },
		);
		expect(calls).toEqual([
			"/data/measures/population?geography=localAuthority&period=2022,2023",
		]);
		expect(payload.periods).toEqual(["2022", "2023"]);
		expect(columnFor(payload, "2022")).toBeDefined();
		expect(columnFor(payload, "1999")).toBeUndefined();
	});

	it("reads rows, values by code and one area's history", async () => {
		const payload = await fetchMeasureValues(
			{ measure: "population", periods: ["2022", "2023"] },
			{ fetch: fetchFromRoute },
		);
		expect(measureRows(payload, "2023")).toEqual([
			{ code: "E06000001", value: 110, status: "observed" },
			{ code: "E06000002", value: 290, status: "observed" },
			{ code: "E06000003", value: 620, status: "observed" },
			{ code: "E06000004", value: 50, status: "derived" },
		]);
		expect(measureRows(payload, "2022")[3]).toEqual({
			code: "E06000004",
			value: null,
			status: "missing",
		});
		expect([...valuesByCode(payload, "2022")]).toEqual([
			["E06000001", 100],
			["E06000002", 300],
			["E06000003", 600],
		]);
		expect(areaSeries(payload, "E06000001")).toEqual([
			{ period: "2022", value: 100 },
			{ period: "2023", value: 110 },
		]);
		expect(areaSeries(payload, "E99")).toEqual([]);
		expect(measureRows(payload, "1999")).toEqual([]);
	});

	it("carries the publisher's interval into a row", async () => {
		const payload = await fetchMeasureValues(
			{ measure: "claim-rate" },
			{ fetch: fetchFromRoute },
		);
		expect(measureRows(payload, "2023")[0]).toEqual({
			code: "E06000001",
			value: 4.2,
			status: "observed",
			lower: 3.9,
			upper: 4.5,
		});
	});

	it("throws a typed error with the route's code and choices", async () => {
		const error = await fetchMeasureValues(
			{ measure: "households", dimensions: { tenure: ["*"] } },
			{ fetch: fetchFromRoute },
		).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(MeasureQueryError);
		expect(error).toMatchObject({
			status: 409,
			code: "ambiguous_series",
		});
		expect((error as MeasureQueryError).choices).toHaveLength(3);
	});

	it("reports a failure that is not a refusal", async () => {
		const error = await fetchMeasureValues(
			{ measure: "population" },
			{ fetch: async () => new Response("<html>", { status: 502 }) },
		).catch((caught: unknown) => caught);
		expect(error).toMatchObject({
			status: 502,
			code: "request_failed",
			message: "HTTP 502",
		});
	});
});
