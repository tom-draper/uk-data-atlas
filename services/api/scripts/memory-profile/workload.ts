import assert from "node:assert/strict";

export type MemoryScenario = {
	name: string;
	path: string;
	method: "GET" | "POST";
	encoding: "identity" | "gzip";
	body?: string;
	requests: number;
	concurrency: number;
	expectedStatuses: number[];
};

export const readMemoryScenarios = (input: unknown): MemoryScenario[] => {
	assert.ok(
		Array.isArray(input) && input.length > 0,
		"Supply a nonempty scenario array",
	);
	const names = new Set<string>();
	return input.map((value: unknown) => {
		assert.ok(
			typeof value === "object" && value !== null,
			"Invalid scenario",
		);
		assert.ok(
			"name" in value &&
				typeof value.name === "string" &&
				value.name.length > 0 &&
				!names.has(value.name),
			"Scenario names must be nonempty and unique",
		);
		names.add(value.name);
		assert.ok(
			"path" in value &&
				typeof value.path === "string" &&
				value.path.startsWith("/v1/") &&
				!/[\r\n#]/.test(value.path),
			"Scenario path must start with /v1/",
		);
		const method = "method" in value ? value.method : "GET";
		assert.ok(method === "GET" || method === "POST", "Use GET or POST");
		const encoding = "encoding" in value ? value.encoding : "identity";
		assert.ok(
			encoding === "identity" || encoding === "gzip",
			"Use identity or gzip encoding",
		);
		const body = "body" in value ? value.body : undefined;
		assert.ok(
			body === undefined ||
				(method === "POST" && typeof body === "string"),
			"Only POST accepts a string body",
		);
		assert.ok(
			"requests" in value &&
				typeof value.requests === "number" &&
				Number.isInteger(value.requests) &&
				value.requests >= 1 &&
				value.requests <= 10000,
			"requests must be 1..10000",
		);
		assert.ok(
			"concurrency" in value &&
				typeof value.concurrency === "number" &&
				Number.isInteger(value.concurrency) &&
				value.concurrency >= 1 &&
				value.concurrency <= 64,
			"concurrency must be 1..64",
		);
		const expectedStatuses =
			"expectedStatuses" in value ? value.expectedStatuses : [200];
		assert.ok(
			Array.isArray(expectedStatuses) &&
				expectedStatuses.length > 0 &&
				expectedStatuses.every(
					(status: unknown) =>
						typeof status === "number" &&
						Number.isInteger(status) &&
						status >= 100 &&
						status <= 599,
				),
			"Supply expected HTTP statuses",
		);
		return {
			name: value.name,
			path: value.path,
			method,
			encoding,
			body,
			requests: value.requests,
			concurrency: value.concurrency,
			expectedStatuses,
		};
	});
};

export const runMemoryWorkload = async (
	base: string,
	scenario: MemoryScenario,
) => {
	let next = 0;
	let bytes = 0;
	const durations: number[] = [];
	const statuses: Record<string, number> = {};
	const transportErrors: Record<string, number> = {};
	const started = performance.now();
	await Promise.all(
		Array.from(
			{ length: Math.min(scenario.concurrency, scenario.requests) },
			async () => {
				while (next < scenario.requests) {
					next += 1;
					const begin = performance.now();
					try {
						const response = await fetch(
							`${base}${scenario.path}`,
							{
								method: scenario.method,
								body: scenario.body,
								headers: {
									"accept-encoding": scenario.encoding,
									...(scenario.body === undefined
										? {}
										: {
												"content-type":
													"application/json",
											}),
								},
								signal: AbortSignal.timeout(30000),
							},
						);
						if (response.body)
							for await (const chunk of response.body)
								bytes += chunk.byteLength;
						statuses[response.status] =
							(statuses[response.status] ?? 0) + 1;
					} catch (error) {
						const message =
							error instanceof Error
								? error.message
								: String(error);
						transportErrors[message] =
							(transportErrors[message] ?? 0) + 1;
					} finally {
						durations.push(performance.now() - begin);
					}
				}
			},
		),
	);
	durations.sort((a, b) => a - b);
	return {
		requests: durations.length,
		statuses,
		transportErrors,
		responseBytes: bytes,
		elapsedMs: performance.now() - started,
		latencyMs: {
			p50: durations[Math.ceil(durations.length * 0.5) - 1]!,
			p95: durations[Math.ceil(durations.length * 0.95) - 1]!,
			max: durations.at(-1)!,
		},
		passed:
			durations.length === scenario.requests &&
			Object.keys(transportErrors).length === 0 &&
			Object.keys(statuses).every((status) =>
				scenario.expectedStatuses.includes(Number(status)),
			),
	};
};
