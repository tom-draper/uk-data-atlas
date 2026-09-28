/**
 * The v1 compatibility guarantee, as data a test can hold the contract to.
 *
 * The surface is what a client of `/v1` can depend on: each operation, the
 * parameters it accepts and their limits, the statuses and media types it
 * answers with, and every property path of each JSON response schema. It is
 * extracted from `openapi.yaml` and locked in `contract/v1-surface.json`.
 *
 * Within `/v1` the surface only grows. A change that would break a client
 * written against the locked surface is refused: removing an operation,
 * parameter, status, media type or response property; making a parameter
 * required; or narrowing what a parameter accepts. An operation may only be
 * removed once it has been deprecated, with `x-deprecated-since` and
 * `x-sunset` dates, and its sunset has passed. Anything else that breaks needs
 * a new major version path.
 */
export type SurfaceParameter = {
	required: boolean;
	enum?: string[];
	minimum?: number;
	maximum?: number;
	maxItems?: number;
};

export type SurfaceOperation = {
	operationId: string;
	deprecated?: { since: string; sunset: string };
	/** Keyed `{in}:{name}`. */
	parameters: Record<string, SurfaceParameter>;
	/** Keyed `{status} {media type}`; JSON media types list property paths. */
	responses: Record<string, string[]>;
};

export type ApiSurface = {
	schemaVersion: 1;
	apiVersion: "v1";
	/** Keyed `{METHOD} {path}`, with the path as OpenAPI writes it. */
	operations: Record<string, SurfaceOperation>;
};

type Schema = Record<string, unknown>;
type Document = {
	paths: Record<string, Record<string, Schema>>;
	components?: Record<string, Record<string, Schema>>;
};

const METHODS = ["get", "head", "post", "put", "patch", "delete"] as const;
// Deep enough for every envelope in the document; a recursive schema stops
// here rather than looping.
const MAX_DEPTH = 12;

const resolveRef = (document: Document, value: Schema): Schema => {
	const ref = value.$ref;
	if (typeof ref !== "string") return value;
	const [, , group, name] = ref.split("/");
	const target = document.components?.[group!]?.[name!];
	if (!target) throw new Error(`Unresolved reference ${ref}`);
	return resolveRef(document, target);
};

const propertyPaths = (
	document: Document,
	schema: Schema | undefined,
	prefix: string,
	depth: number,
	into: Set<string>,
	refs: string[] = [],
) => {
	if (!schema || depth > MAX_DEPTH) return;
	const ref = typeof schema.$ref === "string" ? schema.$ref : undefined;
	if (ref && refs.includes(ref)) return;
	const resolved = resolveRef(document, schema);
	const trail = ref ? [...refs, ref] : refs;
	for (const combinator of ["allOf", "oneOf", "anyOf"] as const)
		for (const part of (resolved[combinator] as Schema[] | undefined) ?? [])
			propertyPaths(document, part, prefix, depth + 1, into, trail);
	const properties = resolved.properties as
		Record<string, Schema> | undefined;
	for (const [name, child] of Object.entries(properties ?? {})) {
		const path = prefix ? `${prefix}.${name}` : name;
		into.add(path);
		propertyPaths(document, child, path, depth + 1, into, trail);
	}
	if (resolved.items && typeof resolved.items === "object")
		propertyPaths(
			document,
			resolved.items as Schema,
			`${prefix}[]`,
			depth + 1,
			into,
			trail,
		);
	if (
		resolved.additionalProperties &&
		typeof resolved.additionalProperties === "object"
	)
		propertyPaths(
			document,
			resolved.additionalProperties as Schema,
			`${prefix}{}`,
			depth + 1,
			into,
			trail,
		);
};

const parameterSurface = (document: Document, parameter: Schema) => {
	const resolved = resolveRef(document, parameter);
	const schema = resolveRef(document, (resolved.schema as Schema) ?? {});
	const items = schema.items
		? resolveRef(document, schema.items as Schema)
		: undefined;
	const values = (schema.enum ?? items?.enum) as unknown[] | undefined;
	const number = (key: string) =>
		typeof schema[key] === "number" ? { [key]: schema[key] as number } : {};
	return {
		key: `${resolved.in}:${resolved.name}`,
		surface: {
			required: resolved.required === true,
			...(values ? { enum: values.map(String).sort() } : {}),
			...number("minimum"),
			...number("maximum"),
			...number("maxItems"),
		} satisfies SurfaceParameter,
	};
};

export const extractSurface = (document: Document): ApiSurface => {
	const operations: Record<string, SurfaceOperation> = {};
	for (const [path, item] of Object.entries(document.paths)) {
		for (const method of METHODS) {
			const operation = item[method];
			if (!operation) continue;
			const parameters: Record<string, SurfaceParameter> = {};
			for (const parameter of [
				...((item.parameters as unknown as Schema[] | undefined) ?? []),
				...((operation.parameters as Schema[] | undefined) ?? []),
			]) {
				const { key, surface } = parameterSurface(document, parameter);
				parameters[key] = surface;
			}
			const responses: Record<string, string[]> = {};
			for (const [status, response] of Object.entries(
				(operation.responses as Record<string, Schema>) ?? {},
			)) {
				const resolved = resolveRef(document, response);
				const content = (resolved.content ?? {}) as Record<
					string,
					Schema
				>;
				for (const [mediaType, media] of Object.entries(content)) {
					const paths = new Set<string>();
					if (/json/.test(mediaType))
						propertyPaths(
							document,
							media.schema as Schema | undefined,
							"",
							0,
							paths,
						);
					responses[`${status} ${mediaType}`] = [...paths].sort();
				}
				if (Object.keys(content).length === 0) responses[status] = [];
			}
			const since = operation["x-deprecated-since"];
			const sunset = operation["x-sunset"];
			operations[`${method.toUpperCase()} ${path}`] = {
				operationId: String(operation.operationId),
				...(operation.deprecated === true
					? {
							deprecated: {
								since: String(since),
								sunset: String(sunset),
							},
						}
					: {}),
				parameters,
				responses,
			};
		}
	}
	return { schemaVersion: 1, apiVersion: "v1", operations };
};

/**
 * Every way `current` would break a client written against `locked`. Empty
 * means the change is compatible; `today` decides whether a sunset has passed.
 */
export const breakingChanges = (
	locked: ApiSurface,
	current: ApiSurface,
	today: string,
): string[] => {
	const breaks: string[] = [];
	for (const [key, before] of Object.entries(locked.operations)) {
		const after = current.operations[key];
		if (!after) {
			if (!before.deprecated)
				breaks.push(
					`${key} was removed without first being deprecated with a sunset date.`,
				);
			else if (before.deprecated.sunset > today)
				breaks.push(
					`${key} was removed before its sunset on ${before.deprecated.sunset}.`,
				);
			continue;
		}
		for (const [name, parameter] of Object.entries(before.parameters)) {
			const now = after.parameters[name];
			if (!now) {
				breaks.push(`${key} no longer accepts ${name}.`);
				continue;
			}
			if (now.required && !parameter.required)
				breaks.push(`${key} now requires ${name}.`);
			// An enum that is lifted accepts everything it did; one that is added
			// or loses a value does not.
			if (now.enum) {
				const dropped = parameter.enum
					? parameter.enum.filter(
							(value) => !now.enum!.includes(value),
						)
					: [];
				if (!parameter.enum)
					breaks.push(
						`${key} now restricts ${name} to listed values.`,
					);
				else if (dropped.length > 0)
					breaks.push(
						`${key} no longer accepts ${name} = ${dropped.join(", ")}.`,
					);
			}
			if (
				now.minimum !== undefined &&
				(parameter.minimum === undefined ||
					now.minimum > parameter.minimum)
			)
				breaks.push(`${key} raised the minimum of ${name}.`);
			if (
				now.maximum !== undefined &&
				(parameter.maximum === undefined ||
					now.maximum < parameter.maximum)
			)
				breaks.push(`${key} lowered the maximum of ${name}.`);
			if (
				now.maxItems !== undefined &&
				(parameter.maxItems === undefined ||
					now.maxItems < parameter.maxItems)
			)
				breaks.push(`${key} accepts fewer ${name} values.`);
		}
		for (const [name, parameter] of Object.entries(after.parameters))
			if (!before.parameters[name] && parameter.required)
				breaks.push(`${key} added the required parameter ${name}.`);
		for (const [response, paths] of Object.entries(before.responses)) {
			const now = after.responses[response];
			if (!now) {
				breaks.push(`${key} no longer answers ${response}.`);
				continue;
			}
			const kept = new Set(now);
			const missing = paths.filter((path) => !kept.has(path));
			if (missing.length > 0)
				breaks.push(
					`${key} ${response} no longer has ${missing.join(", ")}.`,
				);
		}
	}
	for (const [key, operation] of Object.entries(current.operations))
		if (
			operation.deprecated &&
			!(
				/^\d{4}-\d{2}-\d{2}$/.test(operation.deprecated.since) &&
				/^\d{4}-\d{2}-\d{2}$/.test(operation.deprecated.sunset)
			)
		)
			breaks.push(
				`${key} is deprecated without x-deprecated-since and x-sunset dates.`,
			);
	return breaks;
};
