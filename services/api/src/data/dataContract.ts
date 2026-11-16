import { z } from "zod";
import type { ApiResponse } from "../runtime/index.ts";
import { dataChangeMetadata } from "./dataChangeMetadata";
import { dataCompareMetadata } from "./dataCompareMetadata";
import { dataConvertMetadata } from "./dataConvertMetadata";
import { dataObservationsMetadata } from "./dataObservationsMetadata";
import { dataRankingsMetadata } from "./dataRankingsMetadata";
import { dataSeriesMetadata } from "./dataSeriesMetadata";
import { dataValueMetadata } from "./dataValueMetadata";

/**
 * A measure answers as JSON, CSV, NDJSON or Parquet and can run to many rows,
 * so the body is not parsed per request to check it.
 */
const servedAsBuilt = (answer: ApiResponse) => answer;

const route = <
	Path extends string,
	Metadata extends {
		operationId: string;
		tags: readonly string[];
		summary: string;
		"x-likely-refusal": unknown;
		responses: { "200": { description: string } };
	},
>(
	path: Path,
	metadata: Metadata & { description?: string },
) =>
	({
		method: "get",
		path,
		operationId: metadata.operationId,
		tags: metadata.tags,
		summary: metadata.summary,
		description: metadata.description,
		"x-likely-refusal": metadata["x-likely-refusal"],
		responses: {
			200: {
				description: metadata.responses["200"].description,
				content: { "application/json": { schema: z.looseObject({}) } },
			},
		},
		validate: servedAsBuilt,
	}) as const;

export const dataObservationsContract = route(
	"/data/:measureId",
	dataObservationsMetadata,
);
export const dataConvertContract = route(
	"/data/:measureId/convert",
	dataConvertMetadata,
);
export const dataSeriesContract = route(
	"/data/:measureId/series",
	dataSeriesMetadata,
);
export const dataRankingsContract = route(
	"/data/:measureId/rankings",
	dataRankingsMetadata,
);
export const dataValueContract = route(
	"/data/:measureId/value",
	dataValueMetadata,
);
export const dataChangeContract = route(
	"/data/:measureId/change",
	dataChangeMetadata,
);
export const dataCompareContract = route(
	"/data/:measureId/compare",
	dataCompareMetadata,
);
