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
	earliest?: unknown;
	undated?: string[];
	links?: Record<string, string>;
};

export type ApiResponse = {
	status: number;
	body: Envelope<unknown> | Problem;
	representation?: {
		contentType: string;
		body: string;
		headers?: Record<string, string>;
	};
};

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
