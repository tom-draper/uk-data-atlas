import type { ApiContract } from "./openapi";

/**
 * The rules every route shares, as the spec's introduction states them, with
 * a heading each. A concept is found by the words its paragraph opens with,
 * so rewording the spec cannot silently drop one: the docs tests fail instead.
 * The introduction's opening paragraph describes the repository, not the API,
 * and is left out.
 */
const CONCEPTS = [
	{
		id: "envelope",
		title: "The response envelope",
		opens: "Every successful response",
	},
	{
		id: "identities",
		title: "Four separate identities",
		opens: "A data response carries four identities",
	},
	{
		id: "formats",
		title: "Formats and paging",
		opens: "Representations and paging",
	},
	{ id: "errors", title: "Errors", opens: "An error is always" },
	{
		id: "caching",
		title: "Caching",
		opens: "Caching and conditional requests",
	},
] as const;

export interface Concept {
	id: string;
	title: string;
	text: string;
}

export function apiConcepts(contract: ApiContract): Concept[] {
	return CONCEPTS.map(({ id, title, opens }) => {
		const text = contract.introduction.find((p) => p.startsWith(opens));
		if (!text) {
			throw new Error(
				`The API introduction no longer has a paragraph opening "${opens}"`,
			);
		}
		return { id, title, text };
	});
}
