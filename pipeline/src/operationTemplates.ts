import type { OperationTemplate } from "@uk-data-atlas/atlas-runtime/api";

type OpenApiParameter = { $ref?: string; name?: string; in?: string };
type OpenApiOperation = {
	parameters?: OpenApiParameter[];
	deprecated?: boolean;
	"x-deprecated-since"?: unknown;
	"x-sunset"?: unknown;
	"x-rate-limit-cost"?: unknown;
	"x-refused-query-parameters"?: unknown;
};
/** The parts of a parsed OpenAPI document that name operations. */
export type OpenApiOperations = {
	paths?: Record<
		string,
		Partial<Record<"get" | "post", OpenApiOperation>> & {
			parameters?: OpenApiParameter[];
		}
	>;
	components?: { parameters?: Record<string, OpenApiParameter> };
};

/**
 * Each path's templates from a parsed document: its query parameters, with
 * path-level and referenced ones resolved, and each operation's `deprecated`,
 * `x-deprecated-since`, `x-sunset`, `x-rate-limit-cost` and
 * `x-refused-query-parameters`.
 */
export const compileOperationTemplates = (
	document: OpenApiOperations,
): OperationTemplate[] => {
	const resolved = (parameter: OpenApiParameter) => {
		if (!parameter.$ref) return parameter;
		const reference = /^#\/components\/parameters\/(.+)$/.exec(
			parameter.$ref,
		)?.[1];
		const target = reference
			? document.components?.parameters?.[reference]
			: undefined;
		if (!target) throw new Error(`Unresolved reference ${parameter.$ref}`);
		return target;
	};
	const queryNames = (parameters: OpenApiParameter[] | undefined) =>
		(parameters ?? [])
			.map(resolved)
			.filter((parameter) => parameter.in === "query")
			.map((parameter) => String(parameter.name));
	return Object.entries(document.paths ?? {}).map(([path, item]) => {
		const template: OperationTemplate = { path, queryParameters: {} };
		const shared = queryNames(item.parameters);
		for (const method of ["get", "post"] as const) {
			const operation = item[method];
			if (!operation) continue;
			// An operation's own parameter overrides a path-level one by name.
			template.queryParameters[method] = [
				...new Set([...shared, ...queryNames(operation.parameters)]),
			];
			if (operation.deprecated === true)
				template.deprecation = { ...template.deprecation };
			const since = operation["x-deprecated-since"];
			if (since !== undefined)
				template.deprecation = {
					...template.deprecation,
					since: String(since),
				};
			const sunset = operation["x-sunset"];
			if (sunset !== undefined)
				template.deprecation = {
					...template.deprecation,
					sunset: String(sunset),
				};
			const refused = operation["x-refused-query-parameters"];
			if (Array.isArray(refused))
				template.refusedQueryParameters = {
					...template.refusedQueryParameters,
					[method]: refused.map(String),
				};
			// A path with two operations costs what its dearer one does.
			const cost = operation["x-rate-limit-cost"];
			if (typeof cost === "number")
				template.cost = Math.max(template.cost ?? 1, cost);
		}
		return template;
	});
};
