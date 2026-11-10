import { createHash } from "node:crypto";

/**
 * The OpenAPI path templates, used to name the operation a request reached.
 *
 * Metrics and logs label a request by its template, `/v1/areas/{geography}/…`,
 * never by its concrete path: a label per area code would grow without bound.
 * The templates come from the document the server serves, so a route added to
 * the contract is labelled without a second list to keep in step.
 */
export type OperationTemplate = {
	/** The OpenAPI path key, such as `/areas/{geography}/{release}/{code}`. */
	path: string;
	/**
	 * Set when the operation is deprecated. Both dates are required by the
	 * API surface test, so a deprecation always says when it began and when
	 * the operation may be removed.
	 */
	deprecation?: { since?: string; sunset?: string };
	/**
	 * What a request costs from its client's rate-limit bucket, from
	 * `x-rate-limit-cost`, when it is more than one: an operation that reads
	 * many areas' shapes or takes a batch is priced by the work it does.
	 */
	cost?: number;
	/** Query parameters declared for each HTTP operation on this path. */
	queryParameters: Partial<Record<"get" | "post", string[]>>;
	/**
	 * Parameters an operation names in `x-refused-query-parameters`: ones a
	 * caller may reasonably expect it to take, such as `release` on a series,
	 * which its handler refuses with the reason rather than leaving to the
	 * generic unknown-parameter refusal.
	 */
	refusedQueryParameters?: Partial<Record<"get" | "post", string[]>>;
};

/**
 * The operations the server matches requests against, compiled from
 * `openapi.yaml` at build time so the server reads JSON rather than YAML.
 * It records the hash of the document it was compiled from, so a server
 * started after the document changed refuses to run with the old list.
 */
export type OperationsArtifact = {
	schemaVersion: 1;
	inputs: { openapiDocument: string };
	operations: OperationTemplate[];
};

export const openapiDocumentHash = (openapiDocument: string) =>
	`sha256:${createHash("sha256").update(openapiDocument).digest("hex")}`;
