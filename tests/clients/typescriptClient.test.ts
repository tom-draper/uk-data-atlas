import { describe, expect, it } from "vitest";
import {
	AtlasError,
	createAtlasClient,
} from "../../clients/typescript/src/index";

const json = (body: unknown, status = 200, type = "application/json") =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": type },
	});

const envelope = (data: unknown) => ({
	apiVersion: "v1",
	atlasRelease: "sha256:test",
	data,
	meta: { nextCursor: null },
});

/** A client whose requests are recorded and answered by `respond`. */
const client = (respond: (request: Request) => Response) => {
	const urls: string[] = [];
	const atlas = createAtlasClient({
		baseUrl: "http://atlas.test/v1",
		fetch: async (request) => {
			urls.push(request.url);
			return respond(request);
		},
	});
	return { atlas, urls };
};

describe("TypeScript client", () => {
	it("asks the value route for a measure and a place", async () => {
		const { atlas, urls } = client(() =>
			json(envelope({ answer: { value: 697115 } })),
		);

		const result = await atlas.value("population", "north wales", {
			period: "2024",
		});

		expect(urls).toEqual([
			"http://atlas.test/v1/data/population/value?place=north%20wales&period=2024",
		]);
		expect(result.atlasRelease).toBe("sha256:test");
		expect(result.data).toEqual({ answer: { value: 697115 } });
	});

	it("passes search text to places and measures, and a postcode to its path", async () => {
		const { atlas, urls } = client(() => json(envelope([])));

		await atlas.places("Newport");
		await atlas.measures("house prices");
		await atlas.postcode("SW1A 1AA");

		expect(urls).toEqual([
			"http://atlas.test/v1/places?q=Newport",
			"http://atlas.test/v1/measures?q=house%20prices",
			"http://atlas.test/v1/postcodes/SW1A%201AA",
		]);
	});

	it("throws the problem a refusal carries", async () => {
		const { atlas } = client(() =>
			json(
				{
					type: "https://api.ukdataatlas.com/problems/ambiguous-place",
					title: "Ambiguous Place",
					status: 409,
					detail: "Newport could mean 4 places.",
					code: "ambiguous_place",
				},
				409,
				"application/problem+json",
			),
		);

		const error = await atlas
			.value("population", "Newport")
			.catch((e) => e);

		expect(error).toBeInstanceOf(AtlasError);
		expect(error.code).toBe("ambiguous_place");
		expect(error.response.status).toBe(409);
		expect(error.message).toBe(
			"409 Ambiguous Place: Newport could mean 4 places.",
		);
	});

	it("throws for a failure that is not a problem", async () => {
		const { atlas } = client(
			() => new Response("Bad Gateway", { status: 502 }),
		);

		const error = await atlas.measures().catch((e) => e);

		expect(error).toBeInstanceOf(AtlasError);
		expect(error.problem).toBeUndefined();
		expect(error.response.status).toBe(502);
	});
});
