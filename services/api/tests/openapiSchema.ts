/**
 * Checks a value against an OpenAPI 3.1 schema, for the JSON Schema keywords
 * `openapi.yaml` uses. Annotations such as `format`, `description` and
 * `default` are not assertions and are ignored. A keyword this does not know
 * is reported, so a schema never passes because its constraint was skipped.
 */
export type Schema = Record<string, unknown>;
export type SchemaDocument = {
	components?: Record<string, Record<string, Schema>>;
};

const ANNOTATIONS = new Set([
	"$comment",
	"default",
	"deprecated",
	"description",
	"example",
	"examples",
	"format",
	"readOnly",
	"title",
	"writeOnly",
]);
const ASSERTIONS = new Set([
	"$ref",
	"additionalProperties",
	"allOf",
	"anyOf",
	"const",
	"enum",
	"exclusiveMinimum",
	"items",
	"maxItems",
	"maximum",
	"minItems",
	"minimum",
	"oneOf",
	"pattern",
	"properties",
	"required",
	"type",
]);

export const resolveRef = (document: SchemaDocument, ref: string) => {
	const [hash, group, kind, name, ...rest] = ref.split("/");
	const target =
		hash === "#" && group === "components" && rest.length === 0
			? document.components?.[kind!]?.[name!]
			: undefined;
	if (!target) throw new Error(`Unresolved reference ${ref}`);
	return target;
};

const typeOf = (value: unknown) =>
	value === null
		? "null"
		: Array.isArray(value)
			? "array"
			: typeof value === "number" && Number.isInteger(value)
				? "integer"
				: typeof value;

const hasType = (value: unknown, type: string) => {
	const actual = typeOf(value);
	return actual === type || (type === "number" && actual === "integer");
};

const describe = (value: unknown) =>
	JSON.stringify(value)?.slice(0, 60) ?? String(value);

/** Where `value` departs from `schema`, one line per departure. */
export const schemaViolations = (
	document: SchemaDocument,
	schema: Schema | boolean,
	value: unknown,
	at = "",
): string[] => {
	const here = at || "(root)";
	if (schema === true) return [];
	if (schema === false) return [`${here}: no value is allowed`];
	const violations: string[] = [];
	for (const keyword of Object.keys(schema))
		if (
			!ANNOTATIONS.has(keyword) &&
			!ASSERTIONS.has(keyword) &&
			!keyword.startsWith("x-")
		)
			violations.push(`${here}: unchecked keyword ${keyword}`);
	if (typeof schema.$ref === "string")
		violations.push(
			...schemaViolations(
				document,
				resolveRef(document, schema.$ref),
				value,
				at,
			),
		);
	if (schema.type !== undefined) {
		const types = [schema.type].flat() as string[];
		if (!types.some((type) => hasType(value, type)))
			return [
				...violations,
				`${here}: expected ${types.join(" or ")}, got ${typeOf(value)} ${describe(value)}`,
			];
	}
	if ("const" in schema && describe(schema.const) !== describe(value))
		violations.push(
			`${here}: expected ${describe(schema.const)}, got ${describe(value)}`,
		);
	if (
		Array.isArray(schema.enum) &&
		!schema.enum.some((option) => describe(option) === describe(value))
	)
		violations.push(
			`${here}: ${describe(value)} is not one of ${describe(schema.enum)}`,
		);
	if (typeof value === "number") {
		if (typeof schema.minimum === "number" && value < schema.minimum)
			violations.push(`${here}: ${value} is below ${schema.minimum}`);
		if (typeof schema.maximum === "number" && value > schema.maximum)
			violations.push(`${here}: ${value} is above ${schema.maximum}`);
		if (
			typeof schema.exclusiveMinimum === "number" &&
			value <= schema.exclusiveMinimum
		)
			violations.push(
				`${here}: ${value} is not above ${schema.exclusiveMinimum}`,
			);
	}
	if (
		typeof value === "string" &&
		typeof schema.pattern === "string" &&
		!new RegExp(schema.pattern, "u").test(value)
	)
		violations.push(
			`${here}: ${describe(value)} does not match ${schema.pattern}`,
		);
	if (Array.isArray(value)) {
		if (
			typeof schema.minItems === "number" &&
			value.length < schema.minItems
		)
			violations.push(
				`${here}: ${value.length} items, fewer than ${schema.minItems}`,
			);
		if (
			typeof schema.maxItems === "number" &&
			value.length > schema.maxItems
		)
			violations.push(
				`${here}: ${value.length} items, more than ${schema.maxItems}`,
			);
		if (schema.items !== undefined)
			value.forEach((item, index) =>
				violations.push(
					...schemaViolations(
						document,
						schema.items as Schema,
						item,
						`${at}[${index}]`,
					),
				),
			);
	}
	if (typeOf(value) === "object") {
		const object = value as Record<string, unknown>;
		const properties = (schema.properties ?? {}) as Record<string, Schema>;
		for (const name of (schema.required as string[] | undefined) ?? [])
			if (!(name in object))
				violations.push(`${at}.${name}: required but absent`);
		for (const [name, member] of Object.entries(object)) {
			const declared = properties[name];
			if (declared)
				violations.push(
					...schemaViolations(
						document,
						declared,
						member,
						`${at}.${name}`,
					),
				);
			else if (schema.additionalProperties !== undefined)
				violations.push(
					...schemaViolations(
						document,
						schema.additionalProperties as Schema | boolean,
						member,
						`${at}.${name}`,
					),
				);
		}
	}
	for (const part of (schema.allOf as Schema[] | undefined) ?? [])
		violations.push(...schemaViolations(document, part, value, at));
	for (const keyword of ["anyOf", "oneOf"] as const) {
		const branches = schema[keyword] as Schema[] | undefined;
		if (!branches) continue;
		const results = branches.map((branch) =>
			schemaViolations(document, branch, value, at),
		);
		const matched = results.filter((result) => result.length === 0).length;
		if (keyword === "oneOf" && matched > 1)
			violations.push(`${here}: matches ${matched} oneOf branches`);
		if (matched === 0)
			violations.push(
				`${here}: matches no ${keyword} branch; the closest departs at`,
				...results.sort(
					(left, right) => left.length - right.length,
				)[0]!,
			);
	}
	return violations;
};
