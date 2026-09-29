import type { ProblemCode } from "./problemCodes";

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
	choices?: unknown[];
	candidates?: unknown[];
	code?: ProblemCode;
	absence?: string;
	areaCount?: number;
	areaSample?: string[];
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
	representation?: {
		contentType: string;
		/**
		 * A Buffer for a representation that is not text, such as a vector
		 * tile. It travels to the client as it is, and is hashed for the ETag
		 * the same way a string body is.
		 */
		body: string | Buffer | StoredFile;
		headers?: Record<string, string>;
	};
};

/**
 * A published artifact sent from disk rather than held in memory: a whole
 * boundary release can run to hundreds of megabytes. Its validator is the
 * content hash the build recorded, so the file is never read to answer a
 * conditional request.
 */
export type StoredFile = {
	path: string;
	/** The size of the content, once any stored encoding is undone. */
	bytes: number;
	/** `sha256:` followed by the hex digest of the content. */
	contentHash: string;
	/**
	 * Set when the file is stored gzipped: its size on disk. It is sent as it
	 * is to a client that accepts gzip, and decoded for one that does not.
	 */
	gzipBytes?: number;
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
