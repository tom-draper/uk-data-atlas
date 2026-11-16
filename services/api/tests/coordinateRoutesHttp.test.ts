import { expect, test } from "vitest";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import { atlasRelease, testContext } from "./routeFixtures";

const context = testContext({ atlasRelease });
const convert = "/v1/coordinates:convert";

test("coordinate conversion keeps its HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const first = await send({ path: `${convert}?lng=-0.1284&lat=51.504` });
	const etag =
		first.headers.find((line) => line.startsWith("etag: "))?.slice(6) ?? "";
	const requests: CharacterizedRequest[] = [
		{ path: `${convert}?lng=-0.1284&lat=51.504` },
		{ path: `${convert}?lng=-0.1284&lat=51.504`, method: "HEAD" },
		{
			path: `${convert}?lng=-0.1284&lat=51.504`,
			headers: { "if-none-match": etag },
		},
		{
			path: `${convert}?lng=-0.1284&lat=51.504`,
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{ path: `${convert}?lon=-0.1284&lat=51.504` },
		{ path: `${convert}?long=-0.1284&lat=51.504` },
		{ path: `${convert}?crs=EPSG:27700&gridref=TQ3000080000` },
		{ path: `${convert}?crs=EPSG:27700&easting=530000&northing=180000` },
		{ path: `${convert}?crs=EPSG:29902&easting=333500&northing=373500` },
		{ path: `${convert}?lng=-0.12835394&lat=51.503990828&to=EPSG:27700` },
		{
			path: `${convert}?lng=-0.12835394&lat=51.503990828&to=EPSG:27700&gridrefDigits=2`,
		},
		{ path: `${convert}?lng=-0.1&lat=51.5&to=EPSG:29902` },
		{ path: `${convert}?lng=-0.1&lat=51.5&accuracy=25` },
		{ path: `${convert}?lng=-0.1&lat=51.5&accuracy=0` },
		{ path: `${convert}?lng=0&lat=0&to=EPSG:27700` },
		{ path: `${convert}?lng=-0.1&lat=51.5&gridrefDigits=2` },
		{ path: `${convert}?lng=-0.1&lat=51.5&to=EPSG:27700&gridrefDigits=99` },
		{ path: `${convert}?lng=0` },
		{ path: `${convert}?crs=EPSG:3857&lng=0&lat=0` },
		{ path: `${convert}?lng=0&lat=0&to=EPSG:3857` },
		{
			path: `${convert}?crs=EPSG:27700&gridref=TQ3000080000&easting=530000&northing=180000`,
		},
		{ path: `${convert}?lng=-0.1&lat=51.5&unexpected=1` },
		{ path: `${convert}?lng=-0.1&lng=-0.2&lat=51.5` },
		{ path: `${convert}?lng=%E0%A4%A&lat=51.5` },
		{ path: `${convert}?lng=-0.1&lat=51.5&crs=` },
		{ path: convert },
		{ path: `${convert}/` },
		{ path: `${convert}?lng=-0.1&lat=51.5#frag` },
		{ path: "/v1/coordinates%3Aconvert?lng=-0.1&lat=51.5" },
		{ path: "/v1/Coordinates:convert?lng=-0.1&lat=51.5" },
		{ path: "/v1/coordinates:convert/extra?lng=-0.1&lat=51.5" },
		{ path: "/v1/coordinates?lng=-0.1&lat=51.5" },
		{ path: `/v1/coordinates:convert${"x".repeat(150)}?lng=-0.1&lat=51.5` },
		{
			path: `${convert}?lng=-0.1&lat=51.5`,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
		...["POST", "PUT", "PATCH", "DELETE"].flatMap((method) => [
			{ path: `${convert}?lng=-0.1&lat=51.5`, method },
			{ path: convert, method },
		]),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});
