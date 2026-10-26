import { createClient, type FetchLike } from "../src/client.ts";

export const BASE = "https://api.test/v1";

export interface Recorded {
	url: URL;
	init?: RequestInit;
}

type Reply = {
	status?: number;
	body?: unknown;
	headers?: Record<string, string>;
};

/** A client whose fetch answers from `reply` and records every request. */
export function mockApi(reply: Reply | ((url: URL) => Reply) = {}) {
	const requests: Recorded[] = [];
	const fetch: FetchLike = async (input, init) => {
		const url = new URL(input);
		requests.push({ url, init });
		const {
			status = 200,
			body = envelope({}),
			headers = {},
		} = typeof reply === "function" ? reply(url) : reply;
		const problem = status >= 400;
		return new Response(
			typeof body === "string" ? body : JSON.stringify(body),
			{
				status,
				headers: {
					"content-type": problem
						? "application/problem+json"
						: "application/json",
					...headers,
				},
			},
		);
	};
	return { client: createClient({ baseUrl: BASE, fetch }), requests };
}

export const envelope = (data: unknown, extra: object = {}) => ({
	apiVersion: "v1",
	atlasRelease: "sha256:abc",
	data,
	meta: { nextCursor: null },
	...extra,
});

export const problem = (status: number, extra: object = {}) => ({
	type: "https://api.ukdataatlas.com/problems/test",
	title: "Problem",
	status,
	detail: "Something to read.",
	...extra,
});

/** Query parameters of a recorded request as a plain object. */
export const params = (request: Recorded) =>
	Object.fromEntries(request.url.searchParams);

/** The text of a tool result, parsed when it is JSON. */
export const textOf = (result: { content: { text: string }[] }) =>
	result.content.map((part) => part.text).join("\n");

export const jsonOf = (result: { content: { text: string }[] }) =>
	JSON.parse(textOf(result)) as Record<string, any>;
