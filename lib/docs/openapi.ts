import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

/**
 * The API reference as the docs pages need it, read from `api/openapi.yaml`
 * when the site builds. The spec is the single source: nothing here restates
 * an endpoint, so the docs cannot drift from the contract the API is tested
 * against.
 */

export const API_ORIGIN = "https://api.ukdataatlas.com";
export const API_BASE_URL = `${API_ORIGIN}/v1`;

const SPEC_PATH = path.join(process.cwd(), "api", "openapi.yaml");
const MAX_SCHEMA_DEPTH = 4;

export type HttpMethod = "get" | "head" | "post" | "put" | "patch" | "delete";

export interface DocsParameter {
	name: string;
	location: "path" | "query" | "header";
	required: boolean;
	type: string;
	description: string;
	values: string[];
	defaultValue: string | null;
}

export interface DocsField {
	name: string;
	type: string;
	required: boolean;
	description: string;
	values: string[];
	children: DocsField[];
}

export interface DocsHeader {
	name: string;
	description: string;
}

export interface DocsResponse {
	status: string;
	description: string;
	contentTypes: string[];
	schemaName: string | null;
	fields: DocsField[];
	headers: DocsHeader[];
	exampleRequest: string | null;
	example: string | null;
}

export interface DocsOperation {
	id: string;
	slug: string;
	method: HttpMethod;
	path: string;
	summary: string;
	description: string;
	sectionSlug: string;
	parameters: DocsParameter[];
	responses: DocsResponse[];
}

export interface DocsSection {
	name: string;
	slug: string;
	description: string;
	operations: DocsOperation[];
}

export interface ApiContract {
	title: string;
	version: string;
	introduction: string[];
	sections: DocsSection[];
	/** The stable `code` values a refusal can carry, from `Problem`. */
	problemCodes: string[];
}

type Schema = Record<string, unknown>;
type Spec = {
	info: { title: string; version: string; description?: string };
	tags?: { name: string; description?: string }[];
	paths: Record<string, Record<string, Schema>>;
	components?: Record<string, Record<string, Schema>>;
};

const METHODS: HttpMethod[] = ["get", "head", "post", "put", "patch", "delete"];

export function slugify(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/[^A-Za-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase();
}

/** `getMeasureObservations` → `measure-observations`: every route is a read. */
export function operationSlug(operationId: string): string {
	return slugify(operationId.replace(/^get(?=[A-Z])/, ""));
}

/** Blank-line separated paragraphs, with wrapped lines joined back up. */
export function paragraphs(text: string | undefined): string[] {
	return (text ?? "")
		.split(/\n\s*\n/)
		.map((block) => block.replace(/\s*\n\s*/g, " ").trim())
		.filter(Boolean);
}

function refName(ref: string): string {
	return ref.slice(ref.lastIndexOf("/") + 1);
}

function resolveRef(spec: Spec, ref: string): Schema {
	const parts = ref.replace(/^#\//, "").split("/");
	let node: unknown = spec;
	for (const part of parts) {
		node = (node as Record<string, unknown> | undefined)?.[part];
	}
	if (node == null) throw new Error(`Unresolved $ref ${ref}`);
	return node as Schema;
}

function deref(spec: Spec, schema: Schema): Schema {
	return typeof schema.$ref === "string"
		? deref(spec, resolveRef(spec, schema.$ref))
		: schema;
}

function asText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function literal(value: unknown): string {
	return typeof value === "string" ? value : JSON.stringify(value);
}

function typeLabel(spec: Spec, schema: Schema): string {
	if (typeof schema.$ref === "string") return refName(schema.$ref);
	if ("const" in schema) return literal(schema.const);
	const variants = (schema.oneOf ?? schema.anyOf) as Schema[] | undefined;
	if (variants) {
		return [...new Set(variants.map((v) => typeLabel(spec, v)))].join(
			" | ",
		);
	}
	if (Array.isArray(schema.allOf)) {
		const named = (schema.allOf as Schema[]).find(
			(part) => typeof part.$ref === "string",
		);
		return named ? typeLabel(spec, named) : "object";
	}
	const type = schema.type;
	if (Array.isArray(type)) return type.join(" | ");
	if (type === "array") {
		const items = schema.items as Schema | undefined;
		return `${items ? typeLabel(spec, items) : "any"}[]`;
	}
	if (typeof type === "string") return type;
	if (Array.isArray(schema.enum)) return "enum";
	if (schema.properties) return "object";
	return "any";
}

function enumValues(spec: Spec, schema: Schema): string[] {
	const resolved = deref(spec, schema);
	if (Array.isArray(resolved.enum)) return resolved.enum.map(literal);
	if (resolved.type === "array" && resolved.items) {
		return enumValues(spec, resolved.items as Schema);
	}
	return [];
}

/** Merge `allOf` parts into one object shape: properties and required. */
function objectShape(
	spec: Spec,
	schema: Schema,
): { properties: Record<string, Schema>; required: Set<string> } {
	const resolved = deref(spec, schema);
	const properties: Record<string, Schema> = {};
	const required = new Set<string>();
	for (const part of [
		resolved,
		...((resolved.allOf as Schema[] | undefined) ?? []),
	]) {
		const shape =
			part === resolved
				? {
						properties:
							(part.properties as Record<string, Schema>) ?? {},
						required: new Set((part.required as string[]) ?? []),
					}
				: objectShape(spec, part);
		Object.assign(properties, shape.properties);
		shape.required.forEach((name) => required.add(name));
	}
	return { properties, required };
}

/** The object a field's children come from: itself, or its array's items. */
function nestedObject(spec: Spec, schema: Schema): Schema | null {
	const resolved = deref(spec, schema);
	if (resolved.type === "array" && resolved.items) {
		return nestedObject(spec, resolved.items as Schema);
	}
	return resolved.properties || resolved.allOf ? schema : null;
}

export function schemaFields(
	spec: Spec,
	schema: Schema,
	depth = 0,
	seen: string[] = [],
): DocsField[] {
	if (depth >= MAX_SCHEMA_DEPTH) return [];
	const ref = typeof schema.$ref === "string" ? schema.$ref : null;
	if (ref && seen.includes(ref)) return [];
	const trail = ref ? [...seen, ref] : seen;
	const { properties, required } = objectShape(spec, schema);

	return Object.entries(properties).map(([name, property]) => {
		const resolved = deref(spec, property);
		const nested = nestedObject(spec, property);
		return {
			name,
			type: typeLabel(spec, property),
			required: required.has(name),
			description: asText(property.description ?? resolved.description),
			values: enumValues(spec, property),
			children: nested
				? schemaFields(spec, nested, depth + 1, trail)
				: [],
		};
	});
}

function parameterType(spec: Spec, schema: Schema | undefined): string {
	if (!schema) return "string";
	const resolved = deref(spec, schema);
	const label = typeLabel(spec, schema);
	const range = [resolved.minimum, resolved.maximum].every(
		(bound) => typeof bound === "number",
	)
		? ` ${resolved.minimum}–${resolved.maximum}`
		: "";
	return label === "enum" ? "string" : `${label}${range}`;
}

function readParameter(spec: Spec, raw: Schema): DocsParameter {
	const parameter = deref(spec, raw);
	const schema = parameter.schema as Schema | undefined;
	const resolved = schema ? deref(spec, schema) : undefined;
	return {
		name: String(parameter.name),
		location: parameter.in as DocsParameter["location"],
		required: parameter.required === true,
		type: parameterType(spec, schema),
		description: asText(parameter.description),
		values: schema ? enumValues(spec, schema) : [],
		defaultValue:
			resolved && "default" in resolved
				? literal(resolved.default)
				: null,
	};
}

function readResponse(spec: Spec, status: string, raw: Schema): DocsResponse {
	const response = deref(spec, raw);
	const content = (response.content ?? {}) as Record<string, Schema>;
	const media = Object.values(content);
	const schema = media.find((m) => m.schema)?.schema as Schema | undefined;
	const exampleMedia = media.find((m) => m.example !== undefined);
	const headers = (response.headers ?? {}) as Record<string, Schema>;

	return {
		status,
		description: asText(response.description),
		contentTypes: Object.keys(content),
		schemaName: schema ? typeLabel(spec, schema) : null,
		fields: schema ? schemaFields(spec, schema) : [],
		headers: Object.entries(headers).map(([name, header]) => ({
			name,
			description: asText(deref(spec, header).description),
		})),
		exampleRequest:
			asText(
				media.find((m) => m["x-example-request"])?.[
					"x-example-request"
				],
			) || null,
		example: exampleMedia
			? typeof exampleMedia.example === "string"
				? exampleMedia.example
				: JSON.stringify(exampleMedia.example, null, 2)
			: null,
	};
}

export function buildContract(spec: Spec): ApiContract {
	const sections: DocsSection[] = (spec.tags ?? []).map((tag) => ({
		name: tag.name,
		slug: slugify(tag.name),
		description: asText(tag.description),
		operations: [],
	}));
	const sectionByName = new Map(sections.map((s) => [s.name, s]));

	for (const [route, item] of Object.entries(spec.paths)) {
		const shared = (item.parameters as unknown as Schema[]) ?? [];
		for (const method of METHODS) {
			const op = item[method];
			if (!op) continue;
			const id = String(op.operationId);
			const tag = (op.tags as string[] | undefined)?.[0];
			const section = tag ? sectionByName.get(tag) : undefined;
			if (!section) {
				throw new Error(`${id} has no tag declared in the spec`);
			}
			const responses = (op.responses ?? {}) as Record<string, Schema>;
			section.operations.push({
				id,
				slug: operationSlug(id),
				method,
				path: route,
				summary: asText(op.summary),
				description: asText(op.description),
				sectionSlug: section.slug,
				parameters: [
					...shared,
					...((op.parameters as Schema[]) ?? []),
				].map((p) => readParameter(spec, p)),
				responses: Object.entries(responses).map(([status, r]) =>
					readResponse(spec, status, r),
				),
			});
		}
	}

	const problem = spec.components?.schemas?.Problem as Schema | undefined;
	const code = (problem?.properties as Record<string, Schema> | undefined)
		?.code;

	return {
		title: spec.info.title,
		version: spec.info.version,
		introduction: paragraphs(spec.info.description),
		sections,
		problemCodes: Array.isArray(code?.enum) ? code.enum.map(String) : [],
	};
}

let cached: ApiContract | null = null;

export function loadApiContract(): ApiContract {
	cached ??= buildContract(parse(fs.readFileSync(SPEC_PATH, "utf8")));
	return cached;
}

export function allOperations(contract: ApiContract): DocsOperation[] {
	return contract.sections.flatMap((section) => section.operations);
}

export function findOperationById(
	contract: ApiContract,
	id: string,
): DocsOperation {
	const operation = allOperations(contract).find((op) => op.id === id);
	if (!operation) throw new Error(`The spec has no operation ${id}`);
	return operation;
}

export function operationHref(operation: DocsOperation): string {
	return `/docs/v1/reference/${operation.sectionSlug}/${operation.slug}`;
}

export function findSection(
	contract: ApiContract,
	slug: string,
): DocsSection | undefined {
	return contract.sections.find((section) => section.slug === slug);
}

export function findOperation(
	contract: ApiContract,
	sectionSlug: string,
	slug: string,
): DocsOperation | undefined {
	return findSection(contract, sectionSlug)?.operations.find(
		(operation) => operation.slug === slug,
	);
}

/**
 * The top-level resources the routes hang from, e.g. `/areas` for
 * `/areas/{geography}/{release}/{code}/parents` and `/areas:contains`, so the
 * shape of the API can be read at a glance.
 */
export function resourceGroups(
	contract: ApiContract,
): { resource: string; operations: DocsOperation[] }[] {
	const groups = new Map<string, DocsOperation[]>();
	for (const operation of allOperations(contract)) {
		const root = `/${operation.path.split("/")[1].split(":")[0]}`;
		groups.set(root, [...(groups.get(root) ?? []), operation]);
	}
	return [...groups]
		.map(([resource, operations]) => ({
			resource,
			operations: operations.sort((a, b) => a.path.localeCompare(b.path)),
		}))
		.sort((a, b) => a.resource.localeCompare(b.resource));
}
