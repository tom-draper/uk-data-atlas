import { describe, expect, it } from "vitest";
import { FRONT_DOOR } from "@/lib/docs/content/frontDoor";
import { frontDoorExamples } from "@/lib/docs/frontDoor";
import { loadApiContract } from "@/lib/docs/openapi";
import { directionRoutes, shape } from "./directionRoutes";

describe("front door examples", () => {
	const examples = frontDoorExamples(loadApiContract());

	it("reads the routes out of DIRECTION.md", () => {
		expect(directionRoutes()).toContain("/places");
		expect(directionRoutes()).toContain("/areas/{}/{}/{}/neighbours");
	});

	it("covers every route in the front door table of DIRECTION.md", () => {
		const covered = new Set(
			examples.map((example) => shape(example.operation.path)),
		);
		const missing = directionRoutes().filter((path) => !covered.has(path));
		expect(missing, "front-door routes without a curl example").toEqual([]);
	});

	it("gives each operation one example", () => {
		const ids = FRONT_DOOR.map((route) => route.operationId);
		expect(new Set(ids).size).toBe(ids.length);
	});

	describe.each(examples)("$route.operationId", (example) => {
		const { operation, route } = example;
		const [path, query = ""] = route.request.split("?");
		const params = new URLSearchParams(query);

		it("asks the route the spec defines", () => {
			const pattern = operation.path
				.replace(/[.*+?^$()|[\]\\]/g, "\\$&")
				.replace(/\{[^}]+\}/g, "[^/]+");
			expect(path).toMatch(new RegExp(`^${pattern}$`));
		});

		it("sends a body exactly where the spec takes one", () => {
			expect(Boolean(route.body)).toBe(operation.method === "post");
			if (route.body) {
				expect(route.body.contentType).toBe(
					operation.requestBody?.contentType,
				);
				expect(() => JSON.parse(route.body!.example)).not.toThrow();
			}
		});

		it("uses only parameters the operation takes, with every required one", () => {
			const queryParameters = operation.parameters.filter(
				(p) => p.location === "query",
			);
			const known = new Set(queryParameters.map((p) => p.name));
			for (const name of params.keys()) {
				expect(known, `${name} is not a query parameter`).toContain(
					name,
				);
			}
			for (const p of queryParameters.filter((p) => p.required)) {
				expect(params.has(p.name), `${p.name} is required`).toBe(true);
			}
			for (const p of queryParameters.filter(
				(p) => p.values.length > 0,
			)) {
				const value = params.get(p.name);
				if (value !== null && !/[–]/.test(p.values[0])) {
					expect(p.values, `${p.name}=${value}`).toContain(value);
				}
			}
		});

		it("is a curl command that can be pasted", () => {
			expect(example.samples[0].code).toMatch(/^curl /);
			expect(example.curl).not.toContain("\n");
			expect(example.url).not.toMatch(/\s/);
		});
	});

	it("asks about the places the question bank uses", () => {
		const text = FRONT_DOOR.map(
			(route) => route.request + (route.body?.example ?? ""),
		)
			.join("\n")
			.toLowerCase();
		for (const place of ["north%20wales", "manchester", "allerdale"]) {
			expect(text).toContain(place);
		}
	});
});
