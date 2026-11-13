import { datasetAliasOf } from "@uk-data-atlas/datasets/registry";
import { envelope, type ApiResponse } from "./runtime/index.ts";

/** What to do with a request that names a retired dataset id. */
export type AliasedRequest =
	| { kind: "unchanged" }
	/** The query named the old id; carry on with this url instead. */
	| { kind: "rewritten"; url: string }
	/** The path named the old id; send the caller to the new address. */
	| { kind: "redirect"; response: ApiResponse };

const DATASET_PATH = /^\/v1\/datasets\/([^/]+)$/;

/**
 * Resolve retired dataset ids in a request.
 *
 * `/v1/datasets/<old>` redirects to the merged dataset. A `datasetId=<old>`
 * query parameter is rewritten to the merged id and, on data routes, narrowed
 * to the geography the old id covered unless the caller chose one. The
 * rewritten address is reported back as `content-location`.
 */
export const resolveDatasetAliases = (
	url: string,
	releaseId: () => string,
): AliasedRequest => {
	const questionMark = url.indexOf("?");
	const pathname = questionMark < 0 ? url : url.slice(0, questionMark);
	const search = questionMark < 0 ? "" : url.slice(questionMark);
	const detail = DATASET_PATH.exec(pathname);
	if (detail) {
		let id: string;
		try {
			id = decodeURIComponent(detail[1]!);
		} catch {
			return { kind: "unchanged" };
		}
		const alias = datasetAliasOf(id);
		if (!alias) return { kind: "unchanged" };
		const location = `/v1/datasets/${encodeURIComponent(alias.dataset)}`;
		return {
			kind: "redirect",
			response: {
				status: 308,
				headers: { location },
				body: envelope(releaseId(), { href: location }),
			},
		};
	}
	if (!search.includes("datasetId")) return { kind: "unchanged" };
	const query = new URLSearchParams(search);
	const old = query.get("datasetId");
	const alias = old === null ? undefined : datasetAliasOf(old);
	if (!alias) return { kind: "unchanged" };
	query.set("datasetId", alias.dataset);
	if (
		alias.geography &&
		pathname.startsWith("/v1/data/") &&
		!query.has("geography")
	)
		query.set("geography", alias.geography);
	return { kind: "rewritten", url: `${pathname}?${query.toString()}` };
};
