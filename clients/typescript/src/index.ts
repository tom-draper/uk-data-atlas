import createClient, { type ClientOptions } from "openapi-fetch";
import type { components, paths } from "./generated/schema.js";

export type { components, operations, paths } from "./generated/schema.js";

/** RFC 9457 problem details, the body of every refusal the API sends. */
export type Problem = components["schemas"]["Problem"];

/** Where the hosted API is served. Pass `baseUrl` to use another server. */
export const DEFAULT_BASE_URL = "https://api.ukdataatlas.com/v1";

/** A refusal or failed request. `problem` is set when the API sent one. */
export class AtlasError extends Error {
	readonly problem: Problem | undefined;
	readonly response: Response;

	constructor(body: unknown, response: Response) {
		const problem =
			typeof body === "object" && body !== null && "title" in body
				? (body as Problem)
				: undefined;
		super(
			problem
				? `${response.status} ${problem.title}: ${problem.detail}`
				: `${response.status} ${response.statusText}`,
		);
		this.name = "AtlasError";
		this.problem = problem;
		this.response = response;
	}

	/** The stable machine-readable `code`, where the refusal has one. */
	get code() {
		return this.problem?.code;
	}
}

type Result<T> = { data?: T; error?: unknown; response: Response };

/**
 * Some routes describe their response as the bare `Envelope`, which names no
 * `data`. The `& { data: unknown }` lets a caller read and narrow it, and
 * leaves a route that does type its `data` exactly as typed.
 */
const unwrap = async <T>(
	request: Promise<Result<T>>,
): Promise<T & { data: unknown }> => {
	const { data, error, response } = await request;
	if (data === undefined) throw new AtlasError(error, response);
	return data as T & { data: unknown };
};

export type AtlasClientOptions = Omit<ClientOptions, "baseUrl"> & {
	baseUrl?: string;
};

/**
 * The typed client for every route, as `client.GET(path, init)` and
 * `client.POST(path, init)`, plus a throwing helper for each front-door
 * question. A helper returns the response envelope, `{ data, atlasRelease,
 * meta }`, and throws an `AtlasError` carrying the problem on a refusal.
 */
export const createAtlasClient = (options: AtlasClientOptions = {}) => {
	const client = createClient<paths>({
		...options,
		baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
	});

	type Query<Path extends keyof paths> = paths[Path] extends {
		get: { parameters: { query?: infer Q } };
	}
		? NonNullable<Q>
		: never;

	return {
		client,

		/** Find every place a name, code or postcode could mean. */
		places: (q: string, query?: Omit<Query<"/places">, "q">) =>
			unwrap(
				client.GET("/places", { params: { query: { q, ...query } } }),
			),

		/** Find a measure by id, alias, label or dataset title. */
		measures: (q?: string) =>
			unwrap(client.GET("/measures", { params: { query: { q } } })),

		/** What a postcode sits in. */
		postcode: (postcode: string, query?: Query<"/postcodes/{postcode}">) =>
			unwrap(
				client.GET("/postcodes/{postcode}", {
					params: { path: { postcode }, query },
				}),
			),

		/** One measure for one place: a name, code, postcode or place reference. */
		value: (
			measure: string,
			place: string,
			query?: Omit<Query<"/data/{measure-id}/value">, "place">,
		) =>
			unwrap(
				client.GET("/data/{measure-id}/value", {
					params: {
						path: { "measure-id": measure },
						query: { place, ...query },
					},
				}),
			),

		/** One measure for one place over time. */
		series: (
			measure: string,
			place: string,
			query?: Omit<Query<"/data/{measure-id}/series">, "place">,
		) =>
			unwrap(
				client.GET("/data/{measure-id}/series", {
					params: {
						path: { "measure-id": measure },
						query: { place, ...query },
					},
				}),
			),
	};
};

export type AtlasClient = ReturnType<typeof createAtlasClient>;
