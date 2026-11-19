import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { createOperationMatcher } from "../src/runtime/index.ts";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import { compileOperations } from "./pipelineFixtures";
import {
	atlasRelease,
	compatibleWardAreaLookup,
	dataCatalog,
	testContext,
} from "./routeFixtures";

const openapiDocument = readFileSync(
	new URL("../openapi.yaml", import.meta.url),
	"utf8",
);
const operationMatcher = createOperationMatcher(
	compileOperations(openapiDocument).operations,
);
const context = testContext({
	atlasRelease,
	openapiDocument,
	operationMatcher,
	dataCatalog,
	areaLookup: compatibleWardAreaLookup,
	documents: new Map([["fixture", { body: "{}", contentHash: "fixture" }]]),
});

// These pin how requests the routers disagree about are answered, whichever
// router answers them: the same status, headers and problem body.
const exact = (path: string, method = "GET"): CharacterizedRequest => ({
	path,
	method,
	raw: true,
});

const long = (length: number) => "x".repeat(length);

test("a parameter at and past 100 characters is routed the same way", async (t) => {
	const send = await startCharacterization(t, context);
	const requests = [
		`/v1/measures/${long(100)}`,
		`/v1/measures/${long(101)}`,
		`/v1/datasets/${long(101)}`,
		`/v1/documents/${long(95)}.json`,
		`/v1/documents/${long(96)}.json`,
		`/v1/atlas-lookups/${long(101)}.json`,
		`/v1/atlas-pages/${long(101)}.json`,
		`/v1/exports/${long(101)}`,
		`/v1/lookups/${long(101)}`,
		`/v1/terrain/${long(101)}`,
		`/v1/crosswalks/${long(101)}`,
		`/v1/crosswalks/${long(101)}/records`,
		`/v1/postcodes/${long(101)}`,
		`/v1/locations/${long(101)}`,
		`/v1/locations/${long(101)}/members`,
		`/v1/data/${long(101)}`,
		`/v1/data/${long(101)}/value`,
		`/v1/data/${long(101)}/export`,
		`/v1/areas/ward/${long(101)}/E05000001`,
		`/v1/areas/ward/2025-01-en-ward/${long(101)}`,
		`/v1/areas/ward/${long(101)}/E05000001/history`,
		`/v1/areas/${long(101)}/2025-01-en-ward/similar`,
		`/v1/boundary-releases/ward/${long(101)}`,
		`/v1/map-resources/ward/${long(101)}`,
		`/v1/map-resources/ward/${long(101)}.pmtiles`,
		`/v1/map-resources/ward/${long(101)}/tiles.json`,
		`/v1/map-resources/ward/2023-05-uk-bgc/join/${long(101)}`,
		`/v1/map-resources/ward/2023-05-uk-bgc/tiles/${long(101)}/0/0.mvt`,
	].map((path) => exact(path));
	requests.push(
		exact(`/v1/crosswalks/${long(101)}:convert`, "POST"),
		exact(`/v1/boundary-releases/ward/${long(101)}:join`, "POST"),
	);
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("dot segments are routed the same way", async (t) => {
	const send = await startCharacterization(t, context);
	const requests = [
		"/v1/measures/.",
		"/v1/measures/..",
		"/v1/measures/%2e",
		"/v1/measures/%2e%2e",
		"/v1/measures/%2E%2E",
		"/v1/datasets/..",
		"/v1/datasets/../measures",
		"/v1/./datasets",
		"/v1/datasets/./population",
		"/v1/datasets/population/..",
		"/v1/themes/..",
		"/v1/exports/..",
		"/v1/lookups/.",
		"/v1/documents/..json",
		"/v1/documents/.json",
		"/v1/documents/../documents/fixture.json",
		"/v1/data/../datasets",
		"/v1/data/./value",
		"/v1/data/population/../value",
		"/v1/areas/ward/../E05000001",
		"/v1/areas/./2025-01-en-ward/E05000001",
		"/v1/areas/ward/2025-01-en-ward/..",
		"/v1/map-resources/ward/..",
		"/v1/map-resources/ward/.",
		"/v1/map-resources/./ward/2023-05-uk-bgc",
		"/v1/%2e%2e/v1/datasets",
		"/./v1/datasets",
		"/../v1/datasets",
	].map((path) => exact(path));
	requests.push(
		exact("/v1/crosswalks/..:convert", "POST"),
		exact("/v1/boundary-releases/ward/..:join", "POST"),
	);
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("malformed percent escapes are routed the same way", async (t) => {
	const send = await startCharacterization(t, context);
	const requests = [
		"/%",
		"/%E0",
		"/v1/%",
		"/v1/%zz",
		"/v1/datasets/%",
		"/v1/datasets/%zz",
		"/v1/datasets/%E0%A4%A",
		"/v1/measures/%E0%A4%A",
		"/v1/measures/%C0%AF",
		"/v1/themes%E0",
		"/v1/documents/%E0%A4%A.json",
		"/v1/atlas-lookups/%E0.json",
		"/v1/data/%E0%A4%A",
		"/v1/data/%E0%A4%A/value",
		"/v1/data/population/%E0",
		"/v1/areas/%E0/2025-01-en-ward/E05000001",
		"/v1/areas/ward/2025-01-en-ward/%E0",
		"/v1/areas/ward/2025-01-en-ward/E05000001/%E0",
		"/v1/postcodes/%E0",
		"/v1/locations/%E0",
		"/v1/map-resources/ward/%E0",
		"/v1/map-resources/%E0/2023-05-uk-bgc/tiles.json",
		"/v1/boundary-releases/ward/%E0",
		"/v1/crosswalks/%E0",
		"/v1/datasets?q=%E0%A4%A",
		"/v1/datasets/population?x=%",
	].map((path) => exact(path));
	requests.push(
		exact("/v1/postcodes:batch?x=%E0", "POST"),
		exact("/v1/areas:validate/%E0", "POST"),
		exact("/v1/crosswalks/%E0:convert", "POST"),
		exact("/v1/boundary-releases/ward/%E0:join", "POST"),
		exact("/%E0", "POST"),
		exact("/v1/%E0", "DELETE"),
	);
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("encoded characters decode the same way in a parameter", async (t) => {
	const send = await startCharacterization(t, context);
	const requests = [
		"/v1/measures/%70opulation",
		"/v1/datasets/%70opulation",
		"/v1/datasets/popu%2Flation",
		"/v1/datasets/popu%5Clation",
		"/v1/documents/fix%74ure.json",
		"/v1/documents/fixture%2Ejson",
		"/v1/documents/a%2Fb.json",
		"/v1/postcodes/EC1A%201AA",
		"/v1/postcodes/EC1A+1AA",
		"/v1/data/popu%2Flation/value",
		"/v1/%64atasets",
		"/%76%31",
		"/%76%31/",
		"/v1%2Fdatasets",
		"/v1/datasets%2Fpopulation",
	].map((path) => exact(path));
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("trailing and repeated slashes are routed the same way", async (t) => {
	const send = await startCharacterization(t, context);
	const requests = [
		"/v1",
		"/v1/",
		"/v1//",
		"/v1///",
		"//v1",
		"//v1/datasets",
		"/v1//datasets",
		"/v1/datasets/",
		"/v1/datasets//",
		"/v1/datasets//population",
		"/v1/datasets/population/",
		"/v1/measures/",
		"/v1/measures/population/",
		"/v1/themes/",
		"/v1/modules/",
		"/v1/boundaries/",
		"/v1/boundary-releases/",
		"/v1/boundary-releases/ward/2023-05-uk-bgc/",
		"/v1/openapi.yaml/",
		"/v1/docs/",
		"/v1/atlas-release/",
		"/v1/documents/fixture.json/",
		"/v1/documents//fixture.json",
		"/v1/atlas-lookups/",
		"/v1/atlas-pages/area-lineage.json/",
		"/v1/exports/",
		"/v1/lookups/",
		"/v1/terrain/",
		"/v1/terrain/elevation/point/",
		"/v1/crosswalks/",
		"/v1/crosswalks/ward-to-local-authority-2025/records/",
		"/v1/places/",
		"/v1/postcodes/EC1A1AA/",
		"/v1/locations/",
		"/v1/locations/greater-manchester/",
		"/v1/locations/alternatives/",
		"/v1/data/population/",
		"/v1/data/population/value/",
		"/v1/data/population//value",
		"/v1/areas/",
		"/v1/areas//",
		"/v1/areas:near/",
		"/v1/areas/ward/2025-01-en-ward/E05000001/",
		"/v1/areas/ward/2025-01-en-ward/E05000001//history",
		"/v1/areas/ward/2025-01-en-ward//E05000001",
		"/v1/areas/ward/2025-01-en-ward/E05000001/similar/",
		"/v1/map-resources/",
		"/v1/map-resources/ward/2023-05-uk-bgc/",
		"/v1/map-resources/ward/2023-05-uk-bgc/tiles.json/",
		"/v1/map-resources/ward/2023-05-uk-bgc.pmtiles/",
		"/v1/translations/",
		"/v1/attribution/",
		"/v1/coordinates:convert/",
	].map((path) => exact(path));
	requests.push(
		exact("/v1/postcodes:batch/", "POST"),
		exact("/v1/areas:validate/", "POST"),
		exact("/v1/areas:containsBatch/", "POST"),
		exact("/v1/crosswalks/ward-to-local-authority-2025:convert/", "POST"),
		exact("/v1/boundary-releases/ward/2023-05-uk-bgc:join/", "POST"),
		exact("/v1/", "POST"),
	);
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("empty names before an extension are routed the same way", async (t) => {
	const send = await startCharacterization(t, context);
	const requests = [
		"/v1/map-resources/ward/.pmtiles",
		"/v1/map-resources/ward/2023-05-uk-bgc.pmtiles",
		"/v1/map-resources/ward/2023-05-uk-bgc.pmtiles.pmtiles",
		"/v1/map-resources/ward/.pmtiles/tiles.json",
		"/v1/map-resources/.pmtiles/2023-05-uk-bgc",
		"/v1/map-resources/ward/2023-05-uk-bgc/tiles/1/0/.mvt",
		"/v1/map-resources/ward/2023-05-uk-bgc/tiles/1/.mvt/0.mvt",
		"/v1/map-resources/ward/2023-05-uk-bgc/tiles/.mvt/0/0.mvt",
		"/v1/map-resources/ward/2023-05-uk-bgc/tiles/1/0/0",
		"/v1/map-resources/ward/2023-05-uk-bgc/tiles/1/0/0.mvt",
		"/v1/map-resources/ward/2023-05-uk-bgc/tiles/1/0/0.mvt/",
		"/v1/map-resources/ward/2023-05-uk-bgc/tiles/1/0/0.pbf",
		"/v1/documents/.json",
		"/v1/atlas-lookups/.json",
		"/v1/atlas-pages/.json",
		"/v1/documents/fixture",
		"/v1/documents/fixture.json.json",
	].map((path) => exact(path));
	requests.push(
		{ ...exact("/v1/map-resources/ward/.pmtiles", "HEAD") },
		{
			...exact(
				"/v1/map-resources/ward/2023-05-uk-bgc/tiles/1/0/.mvt",
				"HEAD",
			),
		},
	);
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("unmatched paths answer one 404 shape for every method", async (t) => {
	const send = await startCharacterization(t, context);
	const paths = [
		"/",
		"/nope",
		"/v1x",
		"/V1",
		"/v1/nope",
		"/v1/NOPE",
		"/v1/DATASETS",
		"/v2/datasets",
		"/v1/datasets/population/extra",
		"/v1/themes/extra",
		"/v1/openapi.yaml/extra",
		"/v1/areas/ward",
		"/v1/areas/ward/2025-01-en-ward",
		"/v1/areas/ward/2025-01-en-ward/E05000001/other",
		"/v1/areas/ward/2025-01-en-ward/E05000001/children/other",
		"/v1/data",
		"/v1/data/population/other",
		"/v1/data/population/export/extra",
		"/v1/map-resources/ward",
		"/v1/map-resources/ward/2023-05-uk-bgc/other",
		"/v1/documents",
		"/v1/documents/fixture/other.json",
		"/v1/terrain/elevation",
		"/v1/crosswalks/ward-to-local-authority-2025/other",
		"/v1/locations/greater-manchester/other",
		"/v1/clients",
		"/healthz/extra",
		"/metrics/extra",
		"/favicon.ico",
		"/robots.txt",
	];
	const requests: CharacterizedRequest[] = [];
	for (const path of paths)
		for (const method of [
			"GET",
			"HEAD",
			"POST",
			"PUT",
			"DELETE",
			"OPTIONS",
		])
			requests.push(exact(path, method));
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("methods a route does not accept answer 405 or 404 as before", async (t) => {
	const send = await startCharacterization(t, context);
	const getRoutes = [
		"/v1",
		"/v1/openapi.yaml",
		"/v1/docs",
		"/v1/atlas-release",
		"/v1/datasets",
		"/v1/datasets/population",
		"/v1/measures",
		"/v1/themes",
		"/v1/modules",
		"/v1/boundaries",
		"/v1/boundary-releases",
		"/v1/boundary-releases/ward/2023-05-uk-bgc",
		"/v1/boundary-releases:resolve",
		"/v1/boundary-releases:compare",
		"/v1/geographies",
		"/v1/documents/fixture.json",
		"/v1/atlas-lookups/area-lineage.json",
		"/v1/atlas-pages/places-index.json",
		"/v1/coordinates:convert",
		"/v1/translations",
		"/v1/attribution",
		"/v1/analysis-geographies",
		"/v1/analysis:plan",
		"/v1/relationships",
		"/v1/exports",
		"/v1/exports/total-jobs-observations",
		"/v1/lookups",
		"/v1/terrain",
		"/v1/terrain/elevation/point",
		"/v1/crosswalks",
		"/v1/crosswalks/ward-to-local-authority-2025",
		"/v1/crosswalks/ward-to-local-authority-2025/records",
		"/v1/places",
		"/v1/postcodes/EC1A1AA",
		"/v1/locations",
		"/v1/locations/alternatives",
		"/v1/locations/greater-manchester",
		"/v1/locations/greater-manchester/members",
		"/v1/data/population",
		"/v1/data/population/value",
		"/v1/data/population/series",
		"/v1/data/population/export",
		"/v1/areas",
		"/v1/areas:contains",
		"/v1/areas:near",
		"/v1/areas:intersects",
		"/v1/areas/ward/2025-01-en-ward/E05000001",
		"/v1/areas/ward/2025-01-en-ward/E05000001/geometry",
		"/v1/areas/ward/2025-01-en-ward/E05000001/similar",
		"/v1/map-resources",
		"/v1/map-resources/ward/2023-05-uk-bgc",
		"/v1/map-resources/ward/2023-05-uk-bgc.pmtiles",
		"/v1/map-resources/ward/2023-05-uk-bgc/tiles/1/0/0.mvt",
		"/v1/map-resources/ward/2023-05-uk-bgc/join/population",
	];
	const postRoutes = [
		"/v1/areas:validate",
		"/v1/areas:containsBatch",
		"/v1/postcodes:batch",
		"/v1/crosswalks/ward-to-local-authority-2025:convert",
		"/v1/boundary-releases/ward/2023-05-uk-bgc:join",
	];
	const requests: CharacterizedRequest[] = [];
	for (const path of getRoutes)
		for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
			requests.push(exact(path, method));
	for (const path of postRoutes)
		for (const method of [
			"GET",
			"HEAD",
			"PUT",
			"PATCH",
			"DELETE",
			"OPTIONS",
		])
			requests.push(exact(path, method));
	for (const path of postRoutes)
		requests.push({
			...exact(path, "POST"),
			headers: { "content-type": "application/json" },
			body: "{}",
		});
	for (const method of ["TRACE", "PROPFIND"])
		requests.push(exact("/v1/datasets", method));
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("the /geographies redirect keeps its target and query", async (t) => {
	const send = await startCharacterization(t, context);
	const requests = [
		"/v1/geographies",
		"/v1/geographies?x=1",
		"/v1/geographies?",
		"/v1/geographies/",
		"/v1/geographies/ward",
		"/v1/geographies/ward/2023-05-uk-bgc",
		"/v1/%67eographies",
		"/v1/geographies?level=ward&q=a%20b",
	].map((path) => exact(path));
	for (const method of ["HEAD", "POST", "PUT", "DELETE", "OPTIONS"])
		requests.push(exact("/v1/geographies", method));
	requests.push({
		...exact("/v1/geographies"),
		headers: { "if-none-match": '"x"', origin: "https://example.test" },
	});
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("a URL past the length limit answers 414 before routing", async (t) => {
	const send = await startCharacterization(t, context, { maxUrlLength: 200 });
	const under = `/v1/datasets?q=${long(150)}`;
	const exactly = `/v1/datasets?q=${long(200 - "/v1/datasets?q=".length)}`;
	const over = `/v1/datasets?q=${long(200 - "/v1/datasets?q=".length + 1)}`;
	const requests = [
		under,
		exactly,
		over,
		`/v1/measures/${long(300)}`,
		`/v1/nope/${long(300)}`,
		`/${long(300)}`,
		`/v1/geographies?q=${long(300)}`,
		`/v1/documents/${long(300)}.json`,
		`/v1/areas/ward/2025-01-en-ward/E05000001?x=${long(300)}`,
		`/v1/map-resources/ward/${long(300)}.pmtiles`,
		`/v1/measures/%E0${long(300)}`,
		`/v1/measures/..?q=${long(300)}`,
		`/v1/datasets?q=${long(300)}&unknown=1`,
	].map((path) => exact(path));
	for (const method of ["HEAD", "POST", "PUT", "OPTIONS"])
		requests.push(exact(`/v1/datasets?q=${long(300)}`, method));
	requests.push(
		{
			...exact(`/v1/areas:validate?q=${long(300)}`, "POST"),
			headers: { "content-type": "application/json" },
			body: "{}",
		},
		{
			...exact(`/v1/postcodes:batch?q=${long(300)}`, "POST"),
			headers: { "content-type": "application/json" },
			body: "{}",
		},
		exact(`/healthz?q=${long(300)}`),
	);
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("the default length limit is the same for every route", async (t) => {
	const send = await startCharacterization(t, context);
	const base = "/v1/datasets?q=";
	const requests = [
		`${base}${long(4096 - base.length)}`,
		`${base}${long(4096 - base.length + 1)}`,
		`/v1/areas:near?q=${long(5000)}`,
	].map((path) => exact(path));
	expect(await characterize(send, requests)).toMatchSnapshot();
});
