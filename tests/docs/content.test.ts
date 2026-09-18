import { ENDPOINTS } from "@/lib/docs/content/endpoints";
import { ERROR_CODES } from "@/lib/docs/content/errors";
import { SECTIONS } from "@/lib/docs/content/sections";
import {
	docsNavigation,
	neighbours,
	readingOrder,
} from "@/lib/docs/navigation";
import { allOperations, loadApiContract } from "@/lib/docs/openapi";

const contract = loadApiContract();
const operations = allOperations(contract);
const hrefs = new Set(readingOrder(contract).map((link) => link.href));

/** Every `[text](/docs/v1/...)` link written into the content. */
function docsLinks(text: string): string[] {
	return [...text.matchAll(/\]\((\/docs[^)#]*)/g)].map((match) => match[1]);
}

describe("endpoint content", () => {
	it("introduces every endpoint in the spec", () => {
		const missing = operations
			.map((op) => op.id)
			.filter((id) => !ENDPOINTS[id]);
		expect(missing).toEqual([]);
	});

	it("has no entry for an endpoint the spec no longer has", () => {
		const ids = new Set(operations.map((op) => op.id));
		expect(Object.keys(ENDPOINTS).filter((id) => !ids.has(id))).toEqual([]);
	});

	it("keeps titles short enough for the sidebar", () => {
		for (const [id, content] of Object.entries(ENDPOINTS)) {
			expect(content.title.length, id).toBeLessThanOrEqual(34);
		}
	});

	it("gives every endpoint a distinct title", () => {
		const titles = Object.values(ENDPOINTS).map((c) => c.title);
		expect(new Set(titles).size).toBe(titles.length);
	});
});

describe("section content", () => {
	it("names every section and nothing else", () => {
		expect(Object.keys(SECTIONS).sort()).toEqual(
			contract.sections.map((s) => s.slug).sort(),
		);
	});
});

describe("error code content", () => {
	it("explains every code a refusal can carry, and nothing else", () => {
		expect(contract.problemCodes.length).toBeGreaterThan(0);
		expect(Object.keys(ERROR_CODES).sort()).toEqual(
			[...contract.problemCodes].sort(),
		);
	});
});

describe("links written into the content", () => {
	it("all lead to pages that exist", () => {
		const texts = [
			...Object.values(ENDPOINTS).flatMap((c) => [
				c.intro,
				...(c.tips ?? []),
			]),
			...Object.values(ERROR_CODES).map((c) => c.fix),
		];
		const broken = texts
			.flatMap(docsLinks)
			.filter((href) => !hrefs.has(href));
		expect(broken).toEqual([]);
	});
});

describe("docsNavigation", () => {
	it("lists every endpoint exactly once", () => {
		const links = readingOrder(contract);
		const endpointLinks = links.filter((link) => link.method);
		expect(endpointLinks).toHaveLength(operations.length);
		expect(new Set(links.map((l) => l.href)).size).toBe(links.length);
	});

	it("nests each reference section's endpoints beneath it", () => {
		const reference = docsNavigation(contract).at(-1);
		const sections = reference?.links.filter((link) => link.children);
		expect(sections).toHaveLength(contract.sections.length);
	});

	it("links each page to the ones either side of it", () => {
		expect(neighbours(contract, "/docs/v1")).toEqual({
			previous: undefined,
			next: { href: "/docs/v1/quickstart", title: "Quickstart" },
		});
		expect(neighbours(contract, "/docs/v1/nowhere")).toEqual({});
	});
});
