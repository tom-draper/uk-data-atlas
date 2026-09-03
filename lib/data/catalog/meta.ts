/**
 * Every dataset in `data/` is a folder holding its untouched source files and a
 * `meta.json` describing where they came from. The folder path is the dataset's
 * id — `elections/local-elections/2025-hoc` — so adding a dataset means dropping
 * a folder in, not editing a registry.
 *
 * This module is the schema and its validator. It touches no filesystem, so the
 * precompiler, the tests and a future API can all share it.
 */
import type { BoundaryType } from "../boundaries/catalog";

/** One file inside a dataset folder. */
export interface DatasetMetaFile {
	/** Path relative to the dataset folder. */
	path: string;
	/**
	 * "source" is the file as published — the thing to keep raw. "derived" is
	 * something extracted from it and committed for now (a sheet pulled out of
	 * a workbook, say), which should disappear once the preprocessor can read
	 * the source directly. "lookup" is a table joined to the data, "reference"
	 * a companion kept for provenance but never read.
	 */
	role: "source" | "derived" | "lookup" | "reference";
	/**
	 * Bytes, as published. Worth recording only for files no loader reads —
	 * the build manifest measures the rest.
	 */
	bytes?: number;
	/** For a "derived" file, the source file in this folder it came from. */
	derivedFrom?: string;
	note?: string;
}

export interface DatasetMetaLicence {
	name: string;
	url?: string;
}

/** What the dataset covers, for filtering and for the API. */
export interface DatasetMetaCoverage {
	/** The geography its records are keyed by. */
	geography?: BoundaryType;
	/** Boundary vintage the codes belong to. */
	vintage?: number;
	/** ISO 3166-2 style country subdivisions, e.g. ["GB-ENG", "GB-WLS"]. */
	countries?: string[];
}

export interface DatasetMeta {
	/** Must equal the folder name, so the path and the record cannot disagree. */
	id: string;
	title: string;
	description?: string;
	/** Free grouping, independent of the folder tree. */
	topics?: string[];
	publisher: string;
	sourceUrl: string;
	licence: DatasetMetaLicence;
	/** ISO date the files were downloaded. */
	retrieved?: string;
	/** The period the data describes, e.g. "2025" or "2022-2025". */
	temporalCoverage?: string;
	spatialCoverage?: DatasetMetaCoverage;
	files: DatasetMetaFile[];
}

const FILE_ROLES = new Set(["source", "derived", "lookup", "reference"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class MetaError extends Error {
	constructor(location: string, problem: string) {
		super(`${location}: ${problem}`);
		this.name = "MetaError";
	}
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;

const requireString = (
	record: Record<string, unknown>,
	key: string,
	location: string,
): string => {
	const value = record[key];
	if (typeof value !== "string" || value.trim() === "") {
		throw new MetaError(location, `"${key}" must be a non-empty string`);
	}
	return value;
};

const optionalString = (
	record: Record<string, unknown>,
	key: string,
	location: string,
): string | undefined => {
	const value = record[key];
	if (value === undefined) return undefined;
	if (typeof value !== "string") {
		throw new MetaError(location, `"${key}" must be a string`);
	}
	return value;
};

const optionalStringArray = (
	record: Record<string, unknown>,
	key: string,
	location: string,
): string[] | undefined => {
	const value = record[key];
	if (value === undefined) return undefined;
	if (
		!Array.isArray(value) ||
		value.some((item) => typeof item !== "string")
	) {
		throw new MetaError(location, `"${key}" must be an array of strings`);
	}
	return value as string[];
};

function parseFile(
	value: unknown,
	index: number,
	location: string,
): DatasetMetaFile {
	const record = asRecord(value);
	if (!record)
		throw new MetaError(location, `files[${index}] must be an object`);
	const where = `${location} files[${index}]`;

	const role = requireString(record, "role", where);
	if (!FILE_ROLES.has(role)) {
		throw new MetaError(
			where,
			`"role" must be one of ${[...FILE_ROLES].join(", ")}`,
		);
	}

	const path = requireString(record, "path", where);
	if (path.startsWith("/") || path.includes("..")) {
		throw new MetaError(
			where,
			`"path" must stay inside the dataset folder`,
		);
	}

	const bytes = record.bytes;
	if (bytes !== undefined && (typeof bytes !== "number" || bytes < 0)) {
		throw new MetaError(where, `"bytes" must be a positive number`);
	}

	const derivedFrom = optionalString(record, "derivedFrom", where);
	if (derivedFrom !== undefined && role !== "derived") {
		throw new MetaError(
			where,
			`"derivedFrom" only applies to a derived file`,
		);
	}

	return {
		path,
		role: role as DatasetMetaFile["role"],
		...(derivedFrom !== undefined ? { derivedFrom } : {}),
		...(typeof bytes === "number" ? { bytes } : {}),
		...(optionalString(record, "note", where) !== undefined
			? { note: optionalString(record, "note", where) }
			: {}),
	};
}

/**
 * Validates one `meta.json`. `folder` is the dataset's id from its path, and is
 * checked against the file so a copied folder cannot keep the wrong id.
 */
export function parseDatasetMeta(value: unknown, folder: string): DatasetMeta {
	const location = `${folder}/meta.json`;
	const record = asRecord(value);
	if (!record) throw new MetaError(location, "must be a JSON object");

	const id = requireString(record, "id", location);
	if (id !== folder) {
		throw new MetaError(
			location,
			`"id" is "${id}" but the folder is "${folder}"`,
		);
	}

	const licence = asRecord(record.licence);
	if (!licence) throw new MetaError(location, `"licence" must be an object`);

	const files = record.files;
	if (!Array.isArray(files) || files.length === 0) {
		throw new MetaError(location, `"files" must list at least one file`);
	}
	const parsedFiles = files.map((file, index) =>
		parseFile(file, index, location),
	);
	if (!parsedFiles.some((file) => file.role === "source")) {
		throw new MetaError(
			location,
			`at least one file must have role "source"`,
		);
	}

	const retrieved = optionalString(record, "retrieved", location);
	if (retrieved !== undefined && !ISO_DATE.test(retrieved)) {
		throw new MetaError(
			location,
			`"retrieved" must be an ISO date (YYYY-MM-DD)`,
		);
	}

	const spatial = record.spatialCoverage;
	let spatialCoverage: DatasetMetaCoverage | undefined;
	if (spatial !== undefined) {
		const coverage = asRecord(spatial);
		if (!coverage) {
			throw new MetaError(
				location,
				`"spatialCoverage" must be an object`,
			);
		}
		const vintage = coverage.vintage;
		if (vintage !== undefined && typeof vintage !== "number") {
			throw new MetaError(
				location,
				`"spatialCoverage.vintage" must be a number`,
			);
		}
		spatialCoverage = {
			...(optionalString(coverage, "geography", location) !== undefined
				? {
						geography: optionalString(
							coverage,
							"geography",
							location,
						) as BoundaryType,
					}
				: {}),
			...(typeof vintage === "number" ? { vintage } : {}),
			...(optionalStringArray(coverage, "countries", location) !==
			undefined
				? {
						countries: optionalStringArray(
							coverage,
							"countries",
							location,
						),
					}
				: {}),
		};
	}

	return {
		id,
		title: requireString(record, "title", location),
		...(optionalString(record, "description", location) !== undefined
			? { description: optionalString(record, "description", location) }
			: {}),
		...(optionalStringArray(record, "topics", location) !== undefined
			? { topics: optionalStringArray(record, "topics", location) }
			: {}),
		publisher: requireString(record, "publisher", location),
		sourceUrl: requireString(record, "sourceUrl", location),
		licence: {
			name: requireString(licence, "name", `${location} licence`),
			...(optionalString(licence, "url", `${location} licence`) !==
			undefined
				? { url: optionalString(licence, "url", `${location} licence`) }
				: {}),
		},
		...(retrieved !== undefined ? { retrieved } : {}),
		...(optionalString(record, "temporalCoverage", location) !== undefined
			? {
					temporalCoverage: optionalString(
						record,
						"temporalCoverage",
						location,
					),
				}
			: {}),
		...(spatialCoverage ? { spatialCoverage } : {}),
		files: parsedFiles,
	};
}
