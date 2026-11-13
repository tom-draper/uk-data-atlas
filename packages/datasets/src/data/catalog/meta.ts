/**
 * Every source in `data/source/` is a folder holding its untouched source files
 * and a `meta.json` describing where they came from. The folder path is the
 * source's place in the tree, `politics/local-elections/local-election/2025`,
 * so adding a source means dropping a folder in, not editing a registry.
 *
 * This module is the schema and its validator. It touches no filesystem, so the
 * precompiler, the tests and a future API can all share it.
 *
 * A `meta.json` that feeds a dataset names it in `dataset`, which must be an id
 * the registry declares. The dataset's theme and topic come from that
 * declaration (docs/data-organisation.md), so they are not repeated here.
 */
import { z } from "zod";
import { datasetAliasOf } from "../../declaration/datasetAliases.ts";
import { DATASET_GUIDES } from "../../declaration/guides.ts";

/** What a `meta.json` describes, which decides whether it names a dataset. */
export const DATASET_META_KINDS = [
	/** Raw files a dataset in the registry is built from. The default. */
	"dataset",
	/** A published set of areas to draw and join to, under `boundaries/`. */
	"boundary",
	/** A published mapping table that relates geographies, under `core/lookups/`. */
	"lookup",
	/** The postcode directory, under `postcodes/`. */
	"postcode-directory",
	/**
	 * Input to a build that is not a dataset, such as a crosswalk weight
	 * source. Lives in `core/`.
	 */
	"support",
	/** Downloaded, but nothing reads it yet. Lives in `_staging/`. */
	"staged",
] as const;

/** How a file in the folder is used. */
export const DATASET_META_FILE_ROLES = [
	"source",
	"derived",
	"lookup",
	"reference",
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const OBJECT = "must be an object";

const text = z
	.string("must be a string")
	.regex(/\S/, "must be a non-empty string");

const textList = z.array(text, "must be an array of strings");

const file = z
	.strictObject({
		/** Path relative to the source folder. */
		path: text.refine(
			(path) => !path.startsWith("/") && !path.includes(".."),
			"must stay inside the dataset folder",
		),
		/**
		 * "source" is the file as published, the thing to keep raw. "derived" is
		 * something extracted from it and committed for now (a sheet pulled out
		 * of a workbook, say), which should disappear once the preprocessor can
		 * read the source directly. "lookup" is a table joined to the data,
		 * "reference" a companion kept for provenance but never read.
		 */
		role: z.enum(DATASET_META_FILE_ROLES, {
			error: `must be one of ${DATASET_META_FILE_ROLES.join(", ")}`,
		}),
		/**
		 * Bytes, as published. Worth recording only for files no loader reads,
		 * the build manifest measures the rest.
		 */
		bytes: z
			.number("must be a number")
			.nonnegative("must not be negative")
			.optional(),
		/** SHA-256 of the file as published, where the publisher gives one. */
		sha256: text.optional(),
		/** For a "derived" file, the source file in this folder it came from. */
		derivedFrom: text.optional(),
		note: z.string("must be a string").optional(),
	})
	.superRefine((value, context) => {
		if (value.derivedFrom !== undefined && value.role !== "derived")
			context.addIssue({
				code: "custom",
				path: ["derivedFrom"],
				message: "only applies to a derived file",
			});
	});

const licence = z.strictObject(
	{
		name: text,
		url: z.string("must be a string").optional(),
		note: z.string("must be a string").optional(),
	},
	OBJECT,
);

/** What the source covers, for filtering and for the API. */
const spatialCoverage = z.strictObject(
	{
		/**
		 * The geography its records are keyed by: a `BoundaryType` where the data
		 * is keyed by an atlas geography, otherwise a description of the areas.
		 */
		geography: z.string("must be a string").optional(),
		/** Boundary vintage the codes belong to. */
		vintage: z.number("must be a number").optional(),
		/** ISO 3166-2 style country subdivisions, e.g. ["GB-ENG", "GB-WLS"]. */
		countries: textList.optional(),
	},
	OBJECT,
);

/**
 * When the publisher last edited the service this was downloaded from, as
 * epoch milliseconds. Kept for the ArcGIS-hosted boundary releases, which
 * report it.
 */
const publisherRevision = z.strictObject(
	{
		lastEditDate: z.number("must be a number"),
		schemaLastEditDate: z.number("must be a number"),
		dataLastEditDate: z.number("must be a number"),
	},
	OBJECT,
);

export const DatasetMetaSchema = z
	.strictObject({
		/** Must equal the folder name, so the path and the record cannot disagree. */
		id: text,
		/** Absent means "dataset". */
		kind: z
			.enum(DATASET_META_KINDS, {
				error: `must be one of ${DATASET_META_KINDS.join(", ")}`,
			})
			.default("dataset"),
		/**
		 * The id of the registered dataset this folder feeds, required for a
		 * `dataset` source and absent for every other kind. A folder that feeds
		 * several datasets names the one it is named for, the others are
		 * recorded in packages/datasets/src/declaration/sourceDatasets.ts. An id
		 * retired by a merge reads as the dataset that replaced it, so a source
		 * folder downloaded before the merge keeps working until it is refreshed.
		 */
		dataset: text
			.transform((id) => datasetAliasOf(id)?.dataset ?? id)
			.optional(),
		title: text,
		description: z.string("must be a string").optional(),
		publisher: text,
		sourceUrl: text,
		licence,
		/** ISO date the files were downloaded. */
		retrieved: z
			.string("must be a string")
			.regex(ISO_DATE, "must be an ISO date (YYYY-MM-DD)")
			.optional(),
		/** The period the data describes, e.g. "2025" or "2022-2025". */
		temporalCoverage: z.string("must be a string").optional(),
		spatialCoverage: spatialCoverage.optional(),
		publisherRevision: publisherRevision.optional(),
		/** The credit line the publisher asks for, one or several. */
		attribution: z.union([text, textList.min(1)]).optional(),
		/** Anything worth knowing about the files that fits no other field. */
		notes: textList.optional(),
		files: z
			.array(file, "must be an array")
			.min(1, "must list at least one file"),
		/**
		 * Corrections the boundary compiler applies to this release's geometry,
		 * each the id of a definition in data/source/boundaries/. See the README
		 * there.
		 */
		corrections: textList.optional(),
	})
	.superRefine((meta, context) => {
		if (!meta.files.some(({ role }) => role === "source"))
			context.addIssue({
				code: "custom",
				path: ["files"],
				message: `at least one file must have role "source"`,
			});
		if (meta.kind === "dataset") {
			if (meta.dataset === undefined)
				context.addIssue({
					code: "custom",
					path: ["dataset"],
					message: `is required, name the registered dataset this folder feeds (node scripts/migrate-source-meta.mjs adds it to an older download)`,
				});
			else if (!Object.hasOwn(DATASET_GUIDES, meta.dataset))
				context.addIssue({
					code: "custom",
					path: ["dataset"],
					message: `"${meta.dataset}" is not a registered dataset`,
				});
		} else if (meta.dataset !== undefined)
			context.addIssue({
				code: "custom",
				path: ["dataset"],
				message: `must be absent, a "${meta.kind}" source feeds no dataset`,
			});
	});

export type DatasetMeta = z.output<typeof DatasetMetaSchema>;
export type DatasetMetaKind = DatasetMeta["kind"];
export type DatasetMetaFile = DatasetMeta["files"][number];
export type DatasetMetaLicence = DatasetMeta["licence"];
export type DatasetMetaCoverage = NonNullable<DatasetMeta["spatialCoverage"]>;

export class MetaError extends Error {
	constructor(location: string, problem: string) {
		super(`${location}: ${problem}`);
		this.name = "MetaError";
	}
}

/** The value at `path` in `input`, undefined when any step is missing. */
const valueAt = (input: unknown, path: readonly PropertyKey[]): unknown =>
	path.reduce<unknown>(
		(value, part) =>
			typeof value === "object" && value !== null
				? (value as Record<PropertyKey, unknown>)[part]
				: undefined,
		input,
	);

const describeIssue = (issue: z.core.$ZodIssue, input: unknown): string => {
	const where = issue.path
		.map((part, index) =>
			typeof part === "number"
				? `[${part}]`
				: `${index ? "." : ""}${String(part)}`,
		)
		.join("");
	if (issue.code === "unrecognized_keys")
		return `${where ? `${where}: ` : ""}unknown field ${issue.keys.map((key) => `"${key}"`).join(", ")}`;
	const message =
		issue.code === "invalid_type" &&
		valueAt(input, issue.path) === undefined
			? "is required"
			: issue.message;
	return where ? `"${where}" ${message}` : message;
};

/**
 * Validates one `meta.json`. `folder` is the source's id from its path, and is
 * checked against the file so a copied folder cannot keep the wrong id.
 */
export function parseDatasetMeta(value: unknown, folder: string): DatasetMeta {
	const location = `${folder}/meta.json`;
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new MetaError(location, "must be a JSON object");

	const result = DatasetMetaSchema.safeParse(value);
	if (!result.success)
		throw new MetaError(
			location,
			result.error.issues
				.map((issue) => describeIssue(issue, value))
				.join("; "),
		);
	const meta = result.data;
	if (meta.id !== folder)
		throw new MetaError(
			location,
			`"id" is "${meta.id}" but the folder is "${folder}"`,
		);
	return meta;
}
