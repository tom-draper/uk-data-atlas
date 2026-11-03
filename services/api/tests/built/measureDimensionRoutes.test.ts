import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { route } from "../../src/routes";
import { readApiCatalogues } from "../../src/server";

/**
 * Measures and their dimension filters against the compiled catalogues: the
 * measure questions from the question bank in DIRECTION.md, and the questions
 * dimension filters exist to answer in one request.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const catalogues = readApiCatalogues(apiRoot);

type Data = Record<string, unknown> & {
	answer?: { value: number; period: string };
	breakdown?: Array<{
		dimensions: Record<string, { member: string; label: string }>;
		data?: { answer: { value: number } };
	}>;
};

const get = (url: string) => {
	const response = route("GET", url, catalogues);
	assert.equal(
		response.status,
		200,
		`${url} answered ${response.status}: ${JSON.stringify(response.body).slice(0, 400)}`,
	);
	return { response, data: (response.body as { data: Data }).data };
};

const ids = (url: string) =>
	(get(url).data as unknown as Array<{ id: string }>).map(({ id }) => id);

test("What's the population of North Wales?", () => {
	const { data } = get("/v1/data/population/value?place=north%20wales");
	assert.equal(data.answer?.value, 697115);
	assert.equal(data.answer?.period, "2024");
});

test("Which measures are about house prices?", () => {
	assert.equal(ids("/v1/measures?q=house%20prices")[0], "house-price-median");
	const { response } = get("/v1/data/house-prices/value?place=E05000026");
	assert.match(
		String(response.headers?.["content-location"]),
		/^\/v1\/data\/house-price-median\/value/,
	);
	const deprivation = ids("/v1/measures?q=deprivation");
	for (const id of ["imd-rank", "nimdm-rank", "simd-rank", "wimd-rank"])
		assert.ok(deprivation.includes(id), `${id} is not listed`);
});

test("Labour's vote share in a constituency, by measure and party", () => {
	const { data } = get(
		"/v1/data/party-vote-share/value?place=constituency/E14001290&party=lab&period=2024",
	);
	assert.deepEqual(data.dimensions, {
		party: { member: "lab", label: "Labour" },
	});
	assert.equal((data.measure as { id: string }).id, "party-vote-share");
	assert.equal(typeof data.answer?.value, "number");
});

test("Searching Labour vote share finds the measure and the member to filter on", () => {
	const [first] = get("/v1/measures?q=Labour%20vote%20share")
		.data as unknown as Array<{
		id: string;
		matchedMembers: Array<{ dimension: string; member: string }>;
	}>;
	assert.equal(first?.id, "party-vote-share");
	assert.deepEqual(first?.matchedMembers[0], {
		dimension: "party",
		member: "lab",
		label: "Labour",
		href: "/v1/data/party-vote-share?party=lab",
	});
});

test("All crime types for a place, in one request", () => {
	const { data } = get(
		"/v1/data/recorded-crimes/value?place=communitySafetyPartnership/E22000101&offence=*",
	);
	const offences = data.breakdown!.map(
		(entry) => entry.dimensions.offence!.member,
	);
	assert.equal(offences.length, 23);
	assert.ok(offences.includes("burglary"));
	const values = new Map(
		data.breakdown!.map((entry) => [
			entry.dimensions.offence!.member,
			entry.data!.answer.value,
		]),
	);
	// Burglary is residential plus non-residential burglary.
	assert.equal(
		values.get("burglary"),
		values.get("residential-burglary")! +
			values.get("non-residential-burglary")!,
	);
	// Without a filter the total is answered, and the response says so.
	const total = get(
		"/v1/data/recorded-crimes/value?place=communitySafetyPartnership/E22000101",
	).data;
	assert.equal(total.answer?.value, values.get("total"));
	assert.deepEqual(total.defaults, { offence: "total" });
});

test("An ethnicity breakdown for an LSOA", () => {
	const { data } = get(
		"/v1/data/usual-residents/value?place=lsoa/E01000001&ethnic-group=*",
	);
	assert.equal(data.breakdown!.length, 19);
	const residents = data.breakdown!.reduce(
		(sum, entry) => sum + entry.data!.answer.value,
		0,
	);
	const total = get(
		"/v1/data/usual-residents/value?place=lsoa/E01000001&residence-type=total",
	).data;
	// Census tables are perturbed separately for disclosure control, so the
	// groups need not add to the published total exactly.
	assert.ok(Math.abs(residents - total.answer!.value) <= 5);
	const african = data.breakdown!.find(
		(entry) => entry.dimensions["ethnic-group"]!.member === "african",
	);
	assert.equal(
		african?.data?.answer.value,
		get(
			"/v1/data/usual-residents/value?place=lsoa/E01000001&ethnic-group=african",
		).data.answer?.value,
	);
});

test("Retired series ids return their canonical measure and members", () => {
	const response = route(
		"GET",
		"/v1/data/crime-burglary/value?place=Manchester",
		catalogues,
	);
	assert.equal(response.status, 404);
	assert.equal(
		(response.body as { code?: string }).code,
		"retired_measure_id",
	);
	assert.deepEqual((response.body as { members?: unknown }).members, {
		offence: "burglary",
	});
});

test("Retired ids do not answer measure definitions", () => {
	const { config } = catalogues.measureDimensions;
	for (const [id, mapping] of Object.entries(config.ids)) {
		if (id === mapping.measure) continue;
		const response = route("GET", `/v1/measures/${id}`, catalogues);
		assert.equal(response.status, 404, id);
	}
});
