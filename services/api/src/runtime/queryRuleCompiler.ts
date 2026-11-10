/**
 * The rules a query parameter's schema states outright: the values an enum
 * allows, the range a whole number lies in, and the default either takes.
 *
 * They are compiled from `openapi.yaml` into `queryRules.ts`, which handlers
 * read their parameters through, so the contract and the server cannot give
 * two answers to what `limit` or `format` accepts. A parameter whose schema
 * states neither, such as a geography or a period, has no rule: what it
 * accepts depends on the catalogue, not on the document.
 */
export type ChoiceRule = {
	readonly values: readonly string[];
	readonly default?: string;
};
export type WholeNumberRule = {
	readonly minimum: number;
	readonly maximum: number;
	readonly default?: number;
};
export type QueryRule = ChoiceRule | WholeNumberRule;
/** Rules by operation, as `GET /areas:near`, then by parameter name. */
export type QueryRules = Record<string, Record<string, QueryRule>>;

type Schema = {
	$ref?: string;
	type?: string;
	enum?: unknown[];
	minimum?: number;
	maximum?: number;
	default?: unknown;
};
type Parameter = { $ref?: string; name?: string; in?: string; schema?: Schema };
type Operation = { parameters?: Parameter[] };
/** The parts of a parsed OpenAPI document that state query rules. */
export type OpenApiQueryRules = {
	paths?: Record<
		string,
		Partial<Record<"get" | "post", Operation>> & {
			parameters?: Parameter[];
		}
	>;
	components?: {
		parameters?: Record<string, Parameter>;
		schemas?: Record<string, Schema>;
	};
};

const ruleFor = (schema: Schema): QueryRule | undefined => {
	if (
		Array.isArray(schema.enum) &&
		schema.enum.every((value) => typeof value === "string")
	)
		return {
			values: schema.enum as string[],
			...(typeof schema.default === "string"
				? { default: schema.default }
				: {}),
		};
	if (
		schema.type === "integer" &&
		typeof schema.minimum === "number" &&
		typeof schema.maximum === "number"
	)
		return {
			minimum: schema.minimum,
			maximum: schema.maximum,
			...(typeof schema.default === "number"
				? { default: schema.default }
				: {}),
		};
	return undefined;
};

/** Every operation's query rules, in document order. */
export const compileQueryRules = (document: OpenApiQueryRules): QueryRules => {
	const referenced = <T>(
		reference: string,
		kind: "parameters" | "schemas",
	): T => {
		const name = new RegExp(`^#/components/${kind}/(.+)$`).exec(
			reference,
		)?.[1];
		const target = name ? document.components?.[kind]?.[name] : undefined;
		if (!target) throw new Error(`Unresolved reference ${reference}`);
		return target as T;
	};
	const parameter = (value: Parameter) =>
		value.$ref ? referenced<Parameter>(value.$ref, "parameters") : value;
	const schema = (value: Schema | undefined) =>
		value?.$ref ? referenced<Schema>(value.$ref, "schemas") : value;

	const rules: QueryRules = {};
	for (const [path, item] of Object.entries(document.paths ?? {})) {
		for (const method of ["get", "post"] as const) {
			const operation = item[method];
			if (!operation) continue;
			const operationRules: Record<string, QueryRule> = {};
			// An operation's own parameter overrides a path-level one by name.
			for (const declared of [
				...(item.parameters ?? []),
				...(operation.parameters ?? []),
			]) {
				const {
					name,
					in: location,
					schema: stated,
				} = parameter(declared);
				if (location !== "query" || !name) continue;
				const rule = ruleFor(schema(stated) ?? {});
				if (rule) operationRules[name] = rule;
				else delete operationRules[name];
			}
			if (Object.keys(operationRules).length > 0)
				rules[`${method.toUpperCase()} ${path}`] = operationRules;
		}
	}
	return rules;
};
