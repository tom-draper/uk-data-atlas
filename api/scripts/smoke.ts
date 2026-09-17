import { fileURLToPath } from "node:url";

/**
 * A deployment smoke test: `pnpm smoke https://api.example.org`.
 *
 * It checks that a deployed server is serving the contract, not what any one
 * Atlas release contains, so it passes unchanged from release to release. Every
 * id it needs, a measure, an area or the release itself, it discovers from the
 * server first. It reads nothing large and loads no geometry release, so it is
 * quick enough to gate every deployment and cheap enough to run on a schedule.
 *
 * Exit status is 0 only when every check passes. A check that cannot apply to
 * this deployment, such as rate limit headers where limiting is off, is
 * skipped with its reason rather than passed.
 */
export type SmokeResult = {
	name: string;
	outcome: "pass" | "fail" | "skip";
	detail: string;
};

export type SmokeOptions = {
	/** Sent to `/metrics` when the deployment protects it. */
	metricsToken?: string;
	fetch?: typeof fetch;
};

class Skip extends Error {}

function expect(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

type Envelope<T> = { apiVersion: string; atlasRelease: string; data: T };

export const runSmoke = async (
	baseUrl: string,
	options: SmokeOptions = {},
): Promise<SmokeResult[]> => {
	const base = baseUrl.replace(/\/+$/, "");
	const request = options.fetch ?? fetch;
	const get = (path: string, init?: RequestInit) =>
		request(`${base}${path}`, { redirect: "manual", ...init });
	const json = async <T>(path: string, init?: RequestInit) => {
		const response = await get(path, init);
		expect(
			response.status === 200,
			`${path} answered ${response.status}, not 200`,
		);
		expect(
			response.headers
				.get("content-type")
				?.startsWith("application/json"),
			`${path} is ${response.headers.get("content-type")}, not JSON`,
		);
		return { response, body: (await response.json()) as T };
	};

	// Filled in by the first checks and read by later ones. A later check
	// whose prerequisite failed fails too, saying so.
	let release: string | undefined;
	let links: string[] = [];
	const needRelease = () => {
		expect(release, "the release was not discovered by an earlier check");
		return release;
	};

	const checks: Array<[string, () => Promise<string>]> = [
		[
			"liveness",
			async () => {
				const { body } = await json<{ status: string }>("/healthz");
				expect(body.status === "ok", `status is ${body.status}`);
				return "/healthz is ok";
			},
		],
		[
			"readiness",
			async () => {
				const { body } = await json<{
					status: string;
					atlasRelease: string;
				}>("/readyz");
				expect(body.status === "ready", `status is ${body.status}`);
				release = body.atlasRelease;
				return `ready on ${release}`;
			},
		],
		[
			"discovery",
			async () => {
				const { response, body } =
					await json<Envelope<{ links: string[] }>>("/v1");
				expect(
					body.apiVersion === "v1",
					`apiVersion is ${body.apiVersion}`,
				);
				expect(
					body.atlasRelease === needRelease(),
					`the index answers under ${body.atlasRelease}, readiness under ${release}`,
				);
				expect(
					response.headers.get("atlas-release") === release,
					"the Atlas-Release header does not name the release",
				);
				expect(
					response.headers.get("access-control-allow-origin") === "*",
					"cross-origin reads are not allowed",
				);
				expect(
					/^public, max-age=\d+, must-revalidate$/.test(
						response.headers.get("cache-control") ?? "",
					),
					`Cache-Control is ${response.headers.get("cache-control")}`,
				);
				links = body.data.links;
				expect(links.includes("/v1/openapi.yaml"), "no OpenAPI link");
				return `${links.length} links`;
			},
		],
		[
			"contract description",
			async () => {
				const response = await get("/v1/openapi.yaml");
				expect(response.status === 200, `answered ${response.status}`);
				const text = await response.text();
				expect(
					/^openapi: 3\.1\.\d+$/m.test(text),
					"not an OpenAPI 3.1 document",
				);
				const missing = links.filter(
					(link) =>
						!text.includes(
							`\n  ${link.replace(/^\/v1/, "") || "/"}:\n`,
						),
				);
				expect(
					missing.length === 0,
					`the index links to undocumented ${missing.join(", ")}`,
				);
				return `documents all ${links.length} index links`;
			},
		],
		[
			"request id",
			async () => {
				const id = `smoke-${Date.now()}`;
				const response = await get("/v1", {
					headers: { "x-request-id": id },
				});
				await response.body?.cancel();
				expect(
					response.headers.get("x-request-id") === id,
					"the request id is not echoed",
				);
				return "echoed";
			},
		],
		[
			"conditional request",
			async () => {
				const first = await get("/v1/geographies");
				await first.body?.cancel();
				const etag = first.headers.get("etag");
				expect(etag?.startsWith('"sha256-'), `ETag is ${etag}`);
				const second = await get("/v1/geographies", {
					headers: { "if-none-match": etag! },
				});
				expect(
					second.status === 304,
					`revalidation answered ${second.status}`,
				);
				expect((await second.text()) === "", "a 304 carried a body");
				return "304 on a matching ETag";
			},
		],
		[
			"HEAD",
			async () => {
				const response = await get("/v1/geographies", {
					method: "HEAD",
				});
				expect(response.status === 200, `answered ${response.status}`);
				expect((await response.text()) === "", "HEAD carried a body");
				return "no body";
			},
		],
		[
			"preflight",
			async () => {
				const response = await get("/v1/geographies", {
					method: "OPTIONS",
					headers: {
						origin: "https://example.org",
						"access-control-request-method": "GET",
						"access-control-request-headers": "if-none-match",
					},
				});
				expect(response.status === 204, `answered ${response.status}`);
				expect(
					/if-none-match/.test(
						response.headers.get("access-control-allow-headers") ??
							"",
					),
					"a conditional cross-origin request is not allowed",
				);
				return "allows conditional cross-origin GET";
			},
		],
		[
			"problem details",
			async () => {
				const response = await get("/v1/smoke-test-no-such-resource");
				expect(response.status === 404, `answered ${response.status}`);
				expect(
					response.headers.get("content-type") ===
						"application/problem+json",
					`content type is ${response.headers.get("content-type")}`,
				);
				expect(
					response.headers.get("cache-control") === "no-store",
					"an error may be cached",
				);
				const body = (await response.json()) as { status: number };
				expect(
					body.status === 404,
					"the problem does not state its status",
				);
				const write = await get("/v1", { method: "DELETE" });
				await write.body?.cancel();
				expect(write.status === 405, `DELETE answered ${write.status}`);
				return "404 and 405 as uncached problems";
			},
		],
		[
			"release manifest",
			async () => {
				const { body } =
					await json<Envelope<{ releaseId: string }>>(
						"/v1/atlas-release",
					);
				expect(
					body.data.releaseId === needRelease(),
					`the manifest is ${body.data.releaseId}`,
				);
				const { body: history } =
					await json<
						Envelope<Array<{ releaseId?: string; id?: string }>>
					>("/v1/atlas-releases");
				expect(Array.isArray(history.data), "no release history");
				return "manifest names the served release";
			},
		],
		[
			"release pinning",
			async () => {
				const { body } =
					await json<Envelope<Array<{ href: string }>>>(
						"/v1/map-resources",
					);
				const [resource] = body.data;
				if (!resource) throw new Skip("no map resource is published");
				const pinned = resource.href.replace(
					/^\/v1\//,
					`/v1/atlas-releases/${needRelease()}/`,
				);
				const response = await get(pinned);
				await response.body?.cancel();
				expect(
					response.status === 200,
					`${pinned} answered ${response.status}`,
				);
				expect(
					response.headers.get("cache-control") ===
						"public, max-age=31536000, immutable",
					`a pinned response is ${response.headers.get("cache-control")}`,
				);
				const unknown = await get(
					`/v1/atlas-releases/sha256:${"0".repeat(64)}/geographies`,
				);
				expect(
					[404, 410].includes(unknown.status),
					`an unknown release answered ${unknown.status}`,
				);
				const problem = (await unknown.json()) as {
					links?: { current?: string };
				};
				expect(
					problem.links?.current === `/v1/atlas-releases/${release}`,
					"a refused pin does not link the current release",
				);
				return "immutable under the pin, refused for an unknown release";
			},
		],
		[
			"area identity",
			async () => {
				const { body } =
					await json<Envelope<Array<{ id: string; code: string }>>>(
						"/v1/areas?limit=1",
					);
				const [area] = body.data;
				expect(area, "no area is listed");
				const { body: detail } = await json<Envelope<{ code: string }>>(
					`/v1/areas/${area.id}`,
				);
				expect(
					detail.data.code === area.code,
					"the area resolves to another code",
				);
				return area.id;
			},
		],
		[
			"observations",
			async () => {
				const { body } = await json<
					Envelope<
						Array<{
							id: string;
							sources: Array<{
								periods: string[];
								sourceGeography: {
									type: string;
									boundaryYear: number;
								};
							}>;
						}>
					>
				>("/v1/measures?limit=1");
				const [measure] = body.data;
				const source = measure?.sources[0];
				const period = source?.periods.at(-1);
				expect(
					measure && source && period,
					"no measure has a published period",
				);
				const path = `/v1/data/${measure.id}?period=${period}&geography=${source.sourceGeography.type}&boundaryYear=${source.sourceGeography.boundaryYear}&limit=1`;
				const { body: data } =
					await json<
						Envelope<{ records: Array<{ areaCode: string }> }>
					>(path);
				expect(
					data.data.records.length === 1,
					`${path} returned no record`,
				);
				return `${measure.id} ${period}`;
			},
		],
		[
			"validation",
			async () => {
				const { body } =
					await json<Envelope<{ summary: { checkCount: number } }>>(
						"/v1/validation",
					);
				expect(
					body.data.summary.checkCount > 0,
					"the report has no checks",
				);
				return `${body.data.summary.checkCount} checks`;
			},
		],
		[
			"rate limit headers",
			async () => {
				const response = await get("/v1");
				await response.body?.cancel();
				expect(response.status === 200, `answered ${response.status}`);
				const policy = response.headers.get("ratelimit-policy");
				if (!policy)
					throw new Skip("rate limiting is off on this deployment");
				expect(
					response.headers.get("ratelimit"),
					"a policy is declared but no remaining quota is",
				);
				return policy;
			},
		],
		[
			"metrics",
			async () => {
				const response = await get("/metrics", {
					headers: options.metricsToken
						? { authorization: `Bearer ${options.metricsToken}` }
						: {},
				});
				if (response.status === 401 && !options.metricsToken) {
					await response.body?.cancel();
					throw new Skip(
						"metrics are protected and no token was given",
					);
				}
				expect(response.status === 200, `answered ${response.status}`);
				const text = await response.text();
				expect(
					text.includes(
						`atlas_api_release_info{release="${needRelease()}"`,
					),
					"metrics do not name the served release",
				);
				expect(
					/^atlas_api_requests_total\{/m.test(text),
					"no request has been counted",
				);
				return "exposes the release and request counts";
			},
		],
	];

	const results: SmokeResult[] = [];
	for (const [name, check] of checks) {
		try {
			results.push({ name, outcome: "pass", detail: await check() });
		} catch (error) {
			results.push({
				name,
				outcome: error instanceof Skip ? "skip" : "fail",
				detail: error instanceof Error ? error.message : String(error),
			});
		}
	}
	return results;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const baseUrl = process.argv[2] ?? process.env.ATLAS_SMOKE_URL;
	if (!baseUrl) {
		console.error("Usage: pnpm smoke <base-url>, or set ATLAS_SMOKE_URL.");
		process.exit(2);
	}
	const results = await runSmoke(baseUrl, {
		metricsToken: process.env.ATLAS_METRICS_TOKEN,
	});
	results.forEach((result, index) =>
		console.log(
			`${result.outcome === "fail" ? "not ok" : "ok"} ${index + 1} - ${result.name}${result.outcome === "skip" ? " # SKIP" : ""} ${result.detail}`,
		),
	);
	console.log(`1..${results.length}`);
	process.exit(results.some((result) => result.outcome === "fail") ? 1 : 0);
}
