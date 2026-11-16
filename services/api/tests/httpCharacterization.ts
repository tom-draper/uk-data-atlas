import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { TestContext } from "vitest";
import { createApiServer } from "../src/apiServer";
import type { RouteContext } from "../src/runtime/index.ts";
import type { ServerOptions } from "../src/serverOptions";

/** Headers that differ between runs and say nothing about the contract. */
const VOLATILE = new Set([
	"date",
	"connection",
	"keep-alive",
	"x-request-id",
	"transfer-encoding",
]);

/**
 * Headers every response carries unchanged. They are left out of each
 * snapshot to keep it readable, and a response that lacks one is marked with
 * `!name` so the absence is still pinned.
 */
const COMMON = {
	"access-control-allow-origin": "*",
	"access-control-expose-headers":
		"etag, link, content-encoding, content-location, content-range, accept-ranges, atlas-release, x-request-id, ratelimit, ratelimit-policy, retry-after, deprecation, sunset",
	"x-content-type-options": "nosniff",
} as Record<string, string>;

export type CharacterizedRequest = {
	path: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string | Uint8Array;
	/** Tells apart requests that share a method and path; a body names one. */
	label?: string;
};

export type CharacterizedResponse = {
	status: number;
	headers: string[];
	body: string;
	bytes: number;
};

/**
 * Start the production server on a free port and return a function that sends
 * a request and reports every stable part of the response: status, all
 * headers, and the body (text, or a hash for bytes that are not text).
 */
export const startCharacterization = async (
	t: TestContext,
	context: RouteContext,
	options: ServerOptions = {},
) => {
	const server = createApiServer(context, { log: () => {}, ...options });
	await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
	t.onTestFinished(() => {
		server.close();
	});
	const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	return async ({
		path,
		method = "GET",
		headers,
		body,
	}: CharacterizedRequest): Promise<CharacterizedResponse> => {
		const response = await fetch(`${base}${path}`, {
			method,
			redirect: "manual",
			headers: { "accept-encoding": "identity", ...headers },
			body: body as BodyInit | undefined,
		});
		const bytes = Buffer.from(await response.arrayBuffer());
		const text = bytes.toString("utf8");
		const isText = !text.includes("�");
		const seen: string[] = [];
		for (const [name, value] of [...response.headers].sort(([a], [b]) =>
			a < b ? -1 : 1,
		))
			if (
				!VOLATILE.has(name) &&
				name !== "content-length" &&
				COMMON[name] !== value
			)
				seen.push(`${name}: ${value}`);
		for (const name of Object.keys(COMMON))
			if (!response.headers.has(name)) seen.push(`!${name}`);
		return {
			status: response.status,
			headers: seen,
			body: isText
				? text
				: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
			bytes: bytes.length,
		};
	};
};

/** What tells a request apart from another to the same method and path. */
const labelOf = (request: CharacterizedRequest) => {
	if (request.label) return request.label;
	const type = request.headers?.["content-type"];
	if (request.body === undefined && !type) return undefined;
	const text =
		typeof request.body === "string"
			? request.body.slice(0, 60)
			: `${request.body?.length ?? 0} bytes`;
	return `${type ?? "no type"} ${JSON.stringify(text)}`;
};

/** Send each request and key the result by `METHOD path` for a snapshot. */
export const characterize = async (
	send: Awaited<ReturnType<typeof startCharacterization>>,
	requests: CharacterizedRequest[],
) => {
	const out: Record<string, CharacterizedResponse> = {};
	for (const request of requests) {
		const label = labelOf(request);
		out[
			`${request.method ?? "GET"} ${request.path}${label ? ` [${label}]` : ""}`
		] = await send(request);
	}
	return out;
};
