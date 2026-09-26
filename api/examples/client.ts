/**
 * The little the three golden-path examples need: a GET, the envelope, and a
 * refusal a caller can branch on. Everything else in these files is the
 * published contract, so an example breaks when the API does.
 */
export type Problem = {
	title: string;
	status: number;
	detail: string;
	code?: string;
};

export type Step = { title: string; detail: string };

export const createClient = (baseUrl: string) => {
	const call = async (path: string, headers: Record<string, string> = {}) => {
		const response = await fetch(`${baseUrl}${path}`, { headers });
		const text = await response.text();
		return {
			status: response.status,
			headers: response.headers,
			body: text.length > 0 ? JSON.parse(text) : undefined,
		};
	};
	return {
		call,
		/** A successful response's `data`, or a thrown problem. */
		async get<T>(path: string): Promise<{ data: T; atlasRelease: string }> {
			const { status, body } = await call(path);
			if (status !== 200) {
				const problem = body as Problem;
				throw new Error(
					`GET ${path} answered ${status} ${problem.title}: ${problem.detail}`,
				);
			}
			return body as { data: T; atlasRelease: string };
		},
		/** The refusal a request is expected to produce, for a worked example. */
		async refusal(path: string): Promise<Problem> {
			const { status, body } = await call(path);
			if (status === 200)
				throw new Error(
					`GET ${path} was served, but should be refused`,
				);
			return body as Problem;
		},
	};
};

export type AtlasClient = ReturnType<typeof createClient>;
