import { createHash } from "node:crypto";
import {
	queryMeasureValues,
	type MeasureValuesContext,
} from "@uk-data-atlas/atlas-runtime/measures";
import { readMeasureValuesContext } from "@uk-data-atlas/atlas-runtime/loader";
import { atlasDatabasePath, databaseGeneration } from "@uk-data-atlas/atlas-db";
import { measureValuesUrl } from "./request";
import type {
	MeasureValuesErrorBody,
	MeasureValuesPayload,
	MeasureValuesRequest,
} from "./types";

/**
 * The website's measure query, run in the Next.js server process. It calls the
 * shared `queryMeasureValues` over the same statistics rows the API serves,
 * and keeps recent answers as ready-to-send text. Server only: it reads the
 * build from disk.
 */

export type MeasureValuesAnswer = {
	status: number;
	body: string;
	/** Present on a successful answer; names the body, not the encoding. */
	etag?: string;
};

export type MeasureValuesService = {
	answer(request: MeasureValuesRequest): MeasureValuesAnswer;
};

/** Answers kept at once, and the most text they may hold between them. */
const MAX_ENTRIES = 256;
const MAX_BYTES = 32 * 1024 * 1024;

const problemBody = (
	code: string,
	detail: string,
	choices?: MeasureValuesErrorBody["error"]["choices"],
): string =>
	JSON.stringify({
		error: { code, detail, ...(choices ? { choices } : {}) },
	} satisfies MeasureValuesErrorBody);

export const createMeasureValuesService = ({
	context,
	generation,
}: {
	/** The data to read; may throw if the build is not on disk. */
	context: () => MeasureValuesContext;
	/** Changes whenever the database file is replaced. */
	generation: () => unknown;
}): MeasureValuesService => {
	const memo = new Map<string, MeasureValuesAnswer>();
	let bytes = 0;
	let held: unknown;
	return {
		answer(request) {
			const current = generation();
			if (current !== held) {
				memo.clear();
				bytes = 0;
				held = current;
			}
			const key = measureValuesUrl(request);
			const known = memo.get(key);
			if (known) {
				memo.delete(key);
				memo.set(key, known);
				return known;
			}
			let result;
			try {
				result = queryMeasureValues(context(), request);
			} catch (error) {
				return {
					status: 503,
					body: problemBody(
						"catalogue_unavailable",
						error instanceof Error
							? "The measure data is not available: build it with pnpm data:build."
							: "The measure data is not available.",
					),
				};
			}
			if (!result.ok)
				return {
					status: result.status,
					body: problemBody(
						result.code,
						result.detail,
						result.choices,
					),
				};
			const { ok: _ok, ...payload } = result;
			const body = JSON.stringify({
				schemaVersion: 1,
				...payload,
			} satisfies MeasureValuesPayload & { schemaVersion: 1 });
			const answer = {
				status: 200,
				body,
				etag: `W/"${createHash("sha256").update(body).digest("hex").slice(0, 32)}"`,
			};
			const size = Buffer.byteLength(body);
			if (size <= MAX_BYTES) {
				memo.set(key, answer);
				bytes += size;
				while (memo.size > MAX_ENTRIES || bytes > MAX_BYTES) {
					const oldest = memo.keys().next().value!;
					bytes -= Buffer.byteLength(memo.get(oldest)!.body);
					memo.delete(oldest);
				}
			}
			return answer;
		},
	};
};

let service: MeasureValuesService | undefined;

/** The service over this process's build, created on first use. */
export const defaultMeasureValuesService = (): MeasureValuesService => {
	if (service) return service;
	const root = process.cwd();
	let loaded: MeasureValuesContext | undefined;
	service = createMeasureValuesService({
		// A failed load is tried again on the next request.
		context: () => (loaded ??= readMeasureValuesContext(root)),
		generation: () => databaseGeneration(atlasDatabasePath(root)),
	});
	return service;
};
