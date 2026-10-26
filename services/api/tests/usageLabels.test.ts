import assert from "node:assert/strict";
import test from "node:test";
import {
	classifyUsage,
	usageVocabulary,
	type UsageRequest,
} from "../src/usageLabels";
import { dataCatalog, registry } from "./routeFixtures";

const vocabulary = usageVocabulary(dataCatalog, registry);
const measure = dataCatalog.measures[0]!.id;
const release = registry.releases[0]!;

const classify = (request: Partial<UsageRequest> & { pathname: string }) =>
	classifyUsage(vocabulary, {
		route: request.template ? `/v1${request.template}` : "unmatched",
		status: 200,
		...request,
	});

test("keeps measure, geography and release ids that the catalogue holds", () => {
	const event = classify({
		template: "/areas/{geography}/{release}/{code}",
		pathname: `/v1/areas/${release.geography}/${release.id}/E05000001`,
	});
	assert.equal(event.geography, release.geography);
	assert.equal(event.release, release.id);
	assert.equal(event.measure, "");
	assert.equal(event.outcome, "2xx");
	assert.equal(event.notFound, "");

	assert.equal(
		classify({
			template: "/data/{measure-id}/value",
			pathname: `/v1/data/${measure}/value`,
		}).measure,
		measure,
	);
});

test("buckets ids the catalogue does not hold as unknown", () => {
	const event = classify({
		template: "/areas/{geography}/{release}/{code}",
		pathname: "/v1/areas/my-street/1999-01-made-up/E05000001",
		status: 404,
	});
	assert.equal(event.geography, "unknown");
	assert.equal(event.release, "unknown");

	// A release id is only known for the geography that publishes it.
	assert.equal(
		classify({
			template: "/areas/{geography}/{release}/{code}",
			pathname: `/v1/areas/district/${release.id}/E05000001`,
		}).release,
		"unknown",
	);
	assert.equal(
		classify({
			template: "/data/{measure-id}",
			pathname: "/v1/data/SW1A%201AA",
			status: 404,
		}).measure,
		"unknown",
	);
});

test("reads geography and release from the query, only as ids", () => {
	const event = classify({
		template: "/data/{measure-id}/value",
		pathname: `/v1/data/${measure}/value`,
		searchParams: new URLSearchParams({
			geography: release.geography,
			release: release.id,
			place: "10 Downing Street",
		}),
	});
	assert.equal(event.geography, release.geography);
	assert.equal(event.release, release.id);
	assert.doesNotMatch(JSON.stringify(event), /Downing/);

	const guessed = classify({
		template: "/data/{measure-id}/value",
		pathname: `/v1/data/${measure}/value`,
		searchParams: new URLSearchParams({ geography: "Birmingham" }),
	});
	assert.equal(guessed.geography, "unknown");
});

test("classes outcomes and names the problem behind a refusal", () => {
	const base = { template: "/places", pathname: "/v1/places" } as const;
	assert.equal(classify({ ...base, status: 302 }).outcome, "3xx");
	const refused = classify({
		...base,
		status: 400,
		problem: {
			type: "https://api.ukdataatlas.com/problems/invalid-query",
		},
	});
	assert.equal(refused.outcome, "4xx");
	assert.equal(refused.problem, "invalid-query");
	// A declared code wins over the type's slug.
	assert.equal(
		classify({
			...base,
			status: 400,
			problem: {
				type: "x/invalid-query",
				code: "unknown_query_parameter",
			},
		}).problem,
		"unknown_query_parameter",
	);
	assert.equal(classify({ ...base, status: 503 }).outcome, "5xx");
	assert.equal(classify(base).problem, "");
});

test("never stores a problem name that is not slug-shaped", () => {
	const event = classify({
		template: "/places",
		pathname: "/v1/places",
		status: 400,
		problem: { code: "SW1A 1AA, London" },
	});
	assert.equal(event.problem, "other");
});

test("tells the kinds of not found apart", () => {
	const kind = (request: Parameters<typeof classify>[0]) =>
		classify({ status: 404, ...request }).notFound;
	assert.equal(
		kind({
			template: "/data/{measure-id}",
			pathname: "/v1/data/nothing-like-it",
		}),
		"unknown-measure",
	);
	assert.equal(
		kind({
			template: "/areas/{geography}/{release}/{code}",
			pathname: `/v1/areas/${release.geography}/1999-12-uk-bgc/E05000001`,
			problem: { code: "unknown_release" },
		}),
		"unknown-release",
	);
	assert.equal(
		kind({
			template: "/areas/{geography}/{release}/{code}",
			pathname: "/v1/areas/nowhere/2024-12-uk-bgc/E05000001",
			problem: { code: "unsupported_geography" },
		}),
		"unknown-geography",
	);
	assert.equal(
		kind({
			template: "/areas/{geography}/{release}/{code}",
			pathname: `/v1/areas/${release.geography}/${release.id}/E05999999`,
			problem: { code: "area_not_in_release" },
		}),
		"unknown-area",
	);
	assert.equal(
		kind({
			template: "/postcodes/{postcode}",
			pathname: "/v1/postcodes/SW1A1AA",
			problem: { type: "x/postcode-not-found" },
		}),
		"unresolved-postcode",
	);
	assert.equal(
		kind({
			template: "/data/{measure-id}/value",
			pathname: `/v1/data/${measure}/value`,
			problem: { type: "x/unknown-place" },
		}),
		"unresolved-place",
	);
	assert.equal(kind({ pathname: "/v1/no/such/route" }), "unmatched-route");
	// A 422 only counts when the problem says something was not found.
	assert.equal(
		classify({
			template: "/data/{measure-id}/value",
			pathname: `/v1/data/${measure}/value`,
			status: 422,
			problem: { code: "partial_coverage" },
		}).notFound,
		"",
	);
	assert.equal(
		classify({
			template: "/data/{measure-id}/value",
			pathname: `/v1/data/${measure}/value`,
			status: 422,
			problem: { type: "x/not-found" },
		}).notFound,
		"not-found",
	);
});

test("an event holds nothing from the path beyond catalogue ids", () => {
	const event = classify({
		template: "/postcodes/{postcode}",
		pathname: "/v1/postcodes/SW1A%201AA",
		status: 404,
		searchParams: new URLSearchParams({
			q: "10 Downing Street",
			lat: "51.5",
		}),
		problem: { type: "x/postcode-not-found" },
	});
	assert.doesNotMatch(JSON.stringify(event), /SW1A|Downing|51\.5/i);
});
