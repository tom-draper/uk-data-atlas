import {
	allOperations,
	buildContract,
	findOperation,
	loadApiContract,
	operationSlug,
	paragraphs,
	resourceGroups,
	schemaFields,
} from "@/lib/docs/openapi";

describe("operationSlug", () => {
	it("drops the get prefix every read route shares", () => {
		expect(operationSlug("getMeasureObservations")).toBe(
			"measure-observations",
		);
		expect(operationSlug("getRoot")).toBe("root");
	});

	it("keeps a word that merely starts with get", () => {
		expect(operationSlug("getaway")).toBe("getaway");
	});
});

describe("paragraphs", () => {
	it("splits on blank lines and rejoins wrapped lines", () => {
		expect(paragraphs("one\ntwo\n\nthree\n")).toEqual(["one two", "three"]);
	});
});

describe("schemaFields", () => {
	const spec = {
		info: { title: "t", version: "1" },
		paths: {},
		components: {
			schemas: {
				Envelope: {
					type: "object",
					required: ["apiVersion"],
					properties: { apiVersion: { const: "v1" } },
				},
				Node: {
					type: "object",
					properties: {
						kind: { enum: ["a", "b"] },
						child: { $ref: "#/components/schemas/Node" },
					},
				},
			},
		},
	};

	it("merges allOf parts and keeps their required members", () => {
		const fields = schemaFields(spec, {
			allOf: [
				{ $ref: "#/components/schemas/Envelope" },
				{
					properties: {
						data: { type: "array", items: { type: "string" } },
					},
				},
			],
		});
		expect(fields.map((f) => [f.name, f.type, f.required])).toEqual([
			["apiVersion", "v1", true],
			["data", "string[]", false],
		]);
	});

	it("stops at a schema that refers to itself", () => {
		const [, child] = schemaFields(spec, {
			$ref: "#/components/schemas/Node",
		});
		expect(child.type).toBe("Node");
		expect(child.children).toEqual([]);
	});

	it("lists enum values", () => {
		const [kind] = schemaFields(spec, {
			$ref: "#/components/schemas/Node",
		});
		expect(kind.values).toEqual(["a", "b"]);
	});
});

describe("buildContract", () => {
	it("refuses an operation whose tag the spec does not declare", () => {
		expect(() =>
			buildContract({
				info: { title: "t", version: "1" },
				tags: [],
				paths: {
					"/x": { get: { operationId: "getX", tags: ["Nope"] } },
				},
			}),
		).toThrow("getX has no tag");
	});
});

describe("the published API contract", () => {
	const contract = loadApiContract();
	const operations = allOperations(contract);

	it("files every operation under a section", () => {
		const specPaths = contract.sections.flatMap((s) =>
			s.operations.map((o) => o.path),
		);
		expect(operations.length).toBeGreaterThan(0);
		expect(new Set(specPaths).size).toBe(operations.length);
	});

	it("gives every operation a unique page", () => {
		const slugs = operations.map((o) => `${o.sectionSlug}/${o.slug}`);
		expect(new Set(slugs).size).toBe(slugs.length);
		for (const operation of operations) {
			expect(operation.slug).toMatch(/^[a-z0-9-]+$/);
			expect(
				findOperation(contract, operation.sectionSlug, operation.slug),
			).toBe(operation);
		}
	});

	it("summarises every operation and its responses", () => {
		for (const operation of operations) {
			expect(operation.summary, operation.id).not.toBe("");
			expect(operation.responses.length, operation.id).toBeGreaterThan(0);
		}
	});

	it("groups every operation under one resource", () => {
		const grouped = resourceGroups(contract).flatMap((g) => g.operations);
		expect(grouped).toHaveLength(operations.length);
	});
});
