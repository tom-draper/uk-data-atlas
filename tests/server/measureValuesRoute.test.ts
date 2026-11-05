import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-runtime/storage";
import { createMeasureValuesHandler } from "@/lib/measures/handler";
import {
	measureValuesUrl,
	parseMeasureValuesQuery,
} from "@/lib/measures/request";
import { createMeasureValuesService } from "@/lib/measures/server";
import type {
	MeasureValuesErrorBody,
	MeasureValuesPayload,
} from "@/lib/measures/types";
import { createMeasureFixture } from "../helpers/measureFixture";

let fixture: ReturnType<typeof createMeasureFixture>;
let loads = 0;
let generation = 1;
let failing = false;

const handler = () =>
	createMeasureValuesHandler(() =>
		createMeasureValuesService({
			context: () => {
				loads += 1;
				if (failing) throw new Error("not built");
				return fixture.context;
			},
			generation: () => generation,
		}),
	);

beforeAll(() => {
	fixture = createMeasureFixture();
}, 120_000);

beforeEach(() => {
	loads = 0;
	generation = 1;
	failing = false;
});

afterAll(() => closeAllReadOnlyDatabases());

const get = (
	route: (
		request: Request,
		context: { params: Promise<{ measure: string }> },
	) => Promise<Response>,
	measure: string,
	query = "",
	headers: HeadersInit = {},
) =>
	route(
		new Request(`http://localhost/data/measures/${measure}${query}`, {
			headers,
		}),
		{ params: Promise.resolve({ measure }) },
	);

describe("GET /data/measures/{measure}", () => {
	it("answers with columns, the measure's metadata and caching headers", async () => {
		const response = await get(
			handler(),
			"population",
			"?period=2022,2023",
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain(
			"application/json",
		);
		expect(response.headers.get("Cache-Control")).toBe(
			"public, max-age=300, stale-while-revalidate=86400",
		);
		expect(response.headers.get("ETag")).toMatch(/^W\/"[0-9a-f]{32}"$/);
		const body = (await response.json()) as MeasureValuesPayload & {
			schemaVersion: number;
		};
		expect(body.schemaVersion).toBe(1);
		expect(body.areas).toEqual([
			"E06000001",
			"E06000002",
			"E06000003",
			"E06000004",
		]);
		expect(body.periods).toEqual(["2022", "2023"]);
		expect(body.columns.map((column) => column.period)).toEqual([
			"2022",
			"2023",
		]);
		expect(body.measure.valueKind).toBe("count");
		expect(body.source.periods).toEqual(["2022", "2023"]);
	});

	it("passes dimension filters, geography and areas to the query", async () => {
		const response = await get(
			handler(),
			"households",
			"?geography=localAuthority&boundaryYear=2023&dimensions[tenure]=owned&areas=E06000002",
		);
		const body = (await response.json()) as MeasureValuesPayload;
		expect(body.series.dimensions).toEqual({ tenure: "owned" });
		expect(body.areas).toEqual(["E06000002"]);
		expect((body.columns[0] as { values: number[] }).values).toEqual([70]);
	});

	it("answers a repeat request from memory with the same body", async () => {
		const route = handler();
		const first = await get(route, "population");
		const second = await get(route, "population");
		expect(await second.text()).toBe(await first.text());
		expect(second.headers.get("ETag")).toBe(first.headers.get("ETag"));
	});

	it("answers 304 to a matching If-None-Match", async () => {
		const route = handler();
		const first = await get(route, "population");
		const etag = first.headers.get("ETag")!;
		const second = await get(route, "population", "", {
			"If-None-Match": etag,
		});
		expect(second.status).toBe(304);
		expect(await second.text()).toBe("");
		expect(second.headers.get("ETag")).toBe(etag);
		const other = await get(route, "population", "", {
			"If-None-Match": 'W/"not-it"',
		});
		expect(other.status).toBe(200);
	});

	it("recomputes after the database is replaced", async () => {
		const route = createMeasureValuesHandler(() => service);
		const service = createMeasureValuesService({
			context: () => {
				loads += 1;
				return fixture.context;
			},
			generation: () => generation,
		});
		await get(route, "population");
		await get(route, "population");
		expect(loads).toBe(1);
		generation += 1;
		await get(route, "population");
		expect(loads).toBe(2);
	});

	it("refuses what the query layer refuses, uncached", async () => {
		const response = await get(handler(), "nothing");
		expect(response.status).toBe(404);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		const body = (await response.json()) as MeasureValuesErrorBody;
		expect(body.error.code).toBe("unknown_measure");
		const ambiguous = await get(
			handler(),
			"households",
			"?dimensions[tenure]=*",
		);
		expect(ambiguous.status).toBe(409);
		expect(
			((await ambiguous.json()) as MeasureValuesErrorBody).error.choices,
		).toHaveLength(3);
	});

	it("refuses a query it does not understand", async () => {
		for (const query of [
			"?colour=red",
			"?boundaryYear=twenty",
			"?period=2022&period=2023",
			"?areas=",
			"?dimensions[tenure]=",
		]) {
			const response = await get(handler(), "population", query);
			expect(response.status, query).toBe(400);
			expect(
				((await response.json()) as MeasureValuesErrorBody).error.code,
			).toBe("invalid_query");
		}
		expect((await get(handler(), "Not A Measure!")).status).toBe(404);
	});

	it("answers 503 when the build is missing, and tries again next time", async () => {
		failing = true;
		const route = handler();
		const response = await get(route, "population");
		expect(response.status).toBe(503);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(
			((await response.json()) as MeasureValuesErrorBody).error.code,
		).toBe("catalogue_unavailable");
		failing = false;
		expect((await get(route, "population")).status).toBe(200);
	});
});

describe("measure query URLs", () => {
	it("writes a request and reads it back", () => {
		const request = {
			measure: "households",
			geography: "localAuthority",
			boundaryYear: 2023,
			datasetId: "households-fixture",
			periods: ["2021"],
			areas: ["E06000001", "E06000002"],
			dimensions: { tenure: ["owned", "rented"] },
		};
		const url = measureValuesUrl(request);
		expect(url).toBe(
			"/data/measures/households?geography=localAuthority&boundaryYear=2023&datasetId=households-fixture&period=2021&areas=E06000001,E06000002&dimensions[tenure]=owned,rented",
		);
		const parsed = parseMeasureValuesQuery(
			"households",
			new URL(url, "http://localhost").searchParams,
		);
		expect(parsed).toEqual({ ok: true, request });
	});

	it("writes the same URL however the request was built", () => {
		expect(
			measureValuesUrl({
				measure: "m",
				dimensions: { b: ["1"], a: ["2"] },
			}),
		).toBe(
			measureValuesUrl({
				measure: "m",
				dimensions: { a: ["2"], b: ["1"] },
			}),
		);
	});
});
