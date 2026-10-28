import type { StoredFile } from "@uk-data-atlas/artifacts";
import type { ProblemCode } from "./problemCodes";
import type { GeometryProvenance } from "@uk-data-atlas/geography/coordinates";

export type Envelope<T> = {
	apiVersion: "v1";
	atlasRelease: string;
	data: T;
	meta: { nextCursor: string | null };
};

export type Problem = {
	type: string;
	title: string;
	status: number;
	detail: string;
	geometrySource?: GeometryProvenance;
	choices?: unknown[];
	candidates?: unknown[];
	code?: ProblemCode;
	absence?: string;
	areaCount?: number;
	areaSample?: string[];
	rejectedCount?: number;
	rejected?: unknown[];
	/** A query parameter this operation does not declare. */
	parameter?: string;
	/** The closest declared query parameter, when one is unambiguous. */
	suggestion?: string;
	presentIn?: unknown[];
	availableReleases?: unknown[];
	/**
	 * What the caller could have asked for instead. A refusal that cannot say
	 * this leaves them guessing, which is what this API exists to remove.
	 */
	alternatives?: {
		periods?: string[];
		partitions?: Array<{
			geography: string;
			boundaryYear: number;
			periods: string[];
		}>;
		releases?: string[];
	};
	earliest?: unknown;
	undated?: string[];
	links?: Record<string, string>;
	/** Quoted on a failure the server did not expect, to find it in the logs. */
	requestId?: string;
};

export type ApiResponse = {
	status: number;
	body: Envelope<unknown> | Problem;
	/** Headers any representation of this response carries. */
	headers?: Record<string, string>;
	representation?: {
		contentType: string;
		/**
		 * A Buffer for a representation that is not text, such as a vector
		 * tile. It travels to the client as it is, and is hashed for the ETag
		 * the same way a string body is.
		 */
		body: string | Buffer | StoredFile;
		/**
		 * The `sha256:` hash of a Buffer body, when it is already known. It
		 * is the validator, so the body is never hashed per request, and the
		 * body can then be read in byte ranges, as a stored file can.
		 */
		contentHash?: string;
		headers?: Record<string, string>;
	};
};

export const isStoredFile = <T extends object>(
	body: string | Buffer | T | undefined,
): body is T =>
	typeof body === "object" && body !== null && !Buffer.isBuffer(body);

export const envelope = <T>(
	atlasRelease: string,
	data: T,
	nextCursor: string | null = null,
): Envelope<T> => ({
	apiVersion: "v1",
	atlasRelease,
	data,
	meta: { nextCursor },
});

export const problem = (
	status: number,
	title: string,
	detail: string,
	extensions: Omit<Problem, "type" | "title" | "status" | "detail"> = {},
): ApiResponse => ({
	status,
	body: {
		type: `https://api.ukdataatlas.com/problems/${title
			.toLowerCase()
			.replaceAll(" ", "-")}`,
		title,
		status,
		detail,
		...extensions,
	},
});

export const invalidQuery = (
	detail: string,
	extensions?: Parameters<typeof problem>[3],
): ApiResponse => problem(400, "Invalid Query", detail, extensions);

/** Why a requirement was refused, to report a capability as not built. */
export const requirementDetail = (response: ApiResponse | undefined) =>
	response && "detail" in response.body
		? response.body.detail
		: "Catalogue data is unavailable.";

export const requireGeography = (
	resolver: import("../areas/geographyResolver").GeographyResolver,
	requirement: import("../areas/geographyResolver").GeographyRequirement,
) => {
	const detail = resolver.missingRequirement(requirement);
	return detail === undefined
		? undefined
		: problem(503, "Catalogue Unavailable", detail);
};
