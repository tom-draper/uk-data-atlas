import { describe, expect, it } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/docs/llms";
import { frontDoorExamples } from "@/lib/docs/frontDoor";
import { readingOrder } from "@/lib/docs/navigation";
import { loadApiContract } from "@/lib/docs/openapi";
import { directionRoutes } from "./directionRoutes";

const SITE = "https://example.test";
const contract = loadApiContract();
const text = buildLlmsTxt(contract, SITE);
const lines = text.split("\n");

describe("llms.txt", () => {
	it("follows the llmstxt.org layout", () => {
		expect(lines[0]).toBe("# UK Data Atlas API");
		expect(lines[2]).toMatch(/^> .+/);
		const sections = lines.filter((line) => line.startsWith("## "));
		expect(sections).toEqual(["## Docs", "## Front door", "## Optional"]);
		for (const line of lines.filter((line) => line.startsWith("- "))) {
			expect(line).toMatch(/^- \[[^\]]+\]\(https?:\/\/[^)\s]+\)/);
		}
		expect(text.endsWith("\n")).toBe(true);
	});

	it("links the spec and the changelog", () => {
		expect(text).toContain("(https://api.ukdataatlas.com/v1/openapi.yaml)");
		expect(text).toContain(`(${SITE}/docs/v1/changelog)`);
	});

	it("only links pages the docs have", () => {
		const pages = new Set(
			readingOrder(contract).map((link) => `${SITE}${link.href}`),
		);
		const links = [...text.matchAll(/\]\((\S+?)\)/g)].map((m) => m[1]);
		for (const link of links.filter((link) => link.startsWith(SITE))) {
			expect(
				pages.has(link) || link === `${SITE}/llms-full.txt`,
				link,
			).toBe(true);
		}
	});

	it("lists every front-door route once, with its curl example", () => {
		const front = lines.slice(
			lines.indexOf("## Front door") + 1,
			lines.indexOf("## Optional"),
		);
		const routes = front.filter((line) => line.startsWith("- "));
		const examples = frontDoorExamples(contract);
		expect(routes).toHaveLength(examples.length);
		for (const example of examples) {
			expect(
				routes.filter((line) => line.includes(example.curl)),
				example.url,
			).toHaveLength(1);
		}
	});

	it("lists every route in the front door table of DIRECTION.md", () => {
		const listed = frontDoorExamples(contract).map((example) =>
			example.operation.path.replace(/\{[^}]+\}/g, "{}"),
		);
		for (const path of directionRoutes()) {
			expect(listed, path).toContain(path);
		}
	});
});

describe("llms-full.txt", () => {
	const full = buildLlmsFullTxt(contract, SITE);

	it("starts with llms.txt and adds each route's parameters", () => {
		expect(full.startsWith(text.trimEnd())).toBe(true);
		for (const example of frontDoorExamples(contract)) {
			expect(full).toContain(example.samples[0].code);
		}
		expect(full).toContain("- `q` (query, required)");
	});
});
