import { createHash } from "node:crypto";
import type { AreaRecord } from "./areaInventory";
import type { CrosswalkArtifact } from "./crosswalkInventory";
import type { NamedLocationInventory } from "./namedLocations";

export type LookupFormat = "csv" | "ndjson";

export const LOOKUP_FORMATS: LookupFormat[] = ["csv", "ndjson"];

type Value = string | number | string[] | null;

export type LookupColumn = {
	name: string;
	/** `string[]` is an array in NDJSON and joined with " | " in CSV. */
	type: "string" | "number" | "string[]";
	/** True when every row has a value, which the build checks; otherwise it may be empty. */
	required: boolean;
	description: string;
};

export type LookupTable = {
	id: string;
	kind: "area-identities" | "crosswalk" | "named-location-members";
	title: string;
	/** The published artifact the rows are read from, with its hash. */
	source: { artifact: string; contentHash: string };
	columns: LookupColumn[];
	rows: Array<Record<string, Value>>;
};

export type LookupManifest = {
	schemaVersion: 1;
	contentHash: string;
	lookups: Array<
		Omit<LookupTable, "rows"> & {
			rowCount: number;
			formats: Record<
				LookupFormat,
				{
					contentType: string;
					bytes: number;
					contentHash: string;
					href: string;
				}
			>;
		}
	>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const column = (
	name: string,
	type: LookupColumn["type"],
	description: string,
	required = true,
): LookupColumn => ({ name, type, required, description });

/** Every identity in one boundary release, with any Welsh or other alias. */
export const areaIdentityTable = (release: {
	geography: string;
	boundaryRelease: string;
	artifact: string;
	contentHash: string;
	areas: Iterable<AreaRecord>;
}): LookupTable => ({
	id: `areas-${release.geography}-${release.boundaryRelease}`,
	kind: "area-identities",
	title: `Area identities, ${release.geography} ${release.boundaryRelease}`,
	source: { artifact: release.artifact, contentHash: release.contentHash },
	columns: [
		column("geography", "string", "The geography the release publishes."),
		column("boundaryRelease", "string", "The boundary release."),
		column("code", "string", "The official area code."),
		column("name", "string", "The area's name in the release."),
		column(
			"aliases",
			"string[]",
			"Other names the release gives the area, such as a Welsh name.",
			false,
		),
	],
	rows: [...release.areas].map((area) => ({
		geography: release.geography,
		boundaryRelease: release.boundaryRelease,
		code: area.code,
		name: area.name,
		aliases: area.aliases ?? [],
	})),
});

/**
 * A crosswalk flattened to one row per source and target pair. Hierarchy is
 * published this way too: a clean-containment crosswalk gives each child its
 * one parent.
 */
export const crosswalkTable = (
	crosswalk: CrosswalkArtifact,
	artifact: string,
): LookupTable => ({
	id: `crosswalk-${crosswalk.id}`,
	kind: "crosswalk",
	title: `Crosswalk, ${crosswalk.id}`,
	source: { artifact, contentHash: crosswalk.contentHash },
	columns: [
		column("crosswalkId", "string", "The crosswalk the row belongs to."),
		column(
			"method",
			"string",
			"How the relationship was established, such as clean-containment or area-overlap.",
		),
		column("fromGeography", "string", "The source side's geography."),
		column("fromBoundaryRelease", "string", "The source side's release."),
		column("sourceCode", "string", "The source area's code."),
		column(
			"sourceLabels",
			"string[]",
			"The source area's names in the input.",
		),
		column("toGeography", "string", "The target side's geography."),
		column("toBoundaryRelease", "string", "The target side's release."),
		column("targetCode", "string", "The target area's code."),
		column(
			"targetLabels",
			"string[]",
			"The target area's names in the input.",
		),
		column(
			"weight",
			"number",
			"The share of the source to apportion to this target, where the crosswalk provides weights.",
			crosswalk.method === "area-overlap",
		),
		column(
			"sourceShare",
			"number",
			"The share of the source area inside the target, for an area overlap.",
			crosswalk.method === "area-overlap",
		),
		column(
			"targetShare",
			"number",
			"The share of the target area inside the source, for an area overlap.",
			crosswalk.method === "area-overlap",
		),
		column(
			"overlapAreaM2",
			"number",
			"The overlapping area in square metres, for an area overlap.",
			crosswalk.method === "area-overlap",
		),
	],
	rows: crosswalk.records.flatMap((record) =>
		record.targets.map((target) => {
			const overlap =
				"weight" in target
					? (target as {
							weight: number;
							sourceShare: number;
							targetShare: number;
							overlapAreaM2: number;
						})
					: undefined;
			return {
				crosswalkId: crosswalk.id,
				method: crosswalk.method,
				fromGeography: crosswalk.from.geography,
				fromBoundaryRelease: crosswalk.from.boundaryRelease,
				sourceCode: record.source.code,
				sourceLabels: record.source.labels,
				toGeography: crosswalk.to.geography,
				toBoundaryRelease: crosswalk.to.boundaryRelease,
				targetCode: target.code,
				targetLabels: target.labels,
				weight: overlap?.weight ?? null,
				sourceShare: overlap?.sourceShare ?? null,
				targetShare: overlap?.targetShare ?? null,
				overlapAreaM2: overlap?.overlapAreaM2 ?? null,
			};
		}),
	),
});

/** Every curated named location, one row per member code. */
export const namedLocationMembersTable = (
	inventory: NamedLocationInventory,
	artifact: string,
): LookupTable => ({
	id: "named-location-members",
	kind: "named-location-members",
	title: "Named location membership",
	source: { artifact, contentHash: inventory.contentHash },
	columns: [
		column("locationId", "string", "The named location's id."),
		column("label", "string", "The named location's label."),
		column(
			"kind",
			"string",
			"How the location is defined; editorial-grouping is a curated grouping, not an official area.",
		),
		column(
			"definitionRevision",
			"number",
			"The curated definition revision for this location.",
		),
		column(
			"memberGeography",
			"string",
			"The geography whose area codes define the location.",
		),
		column("memberCode", "string", "The official code of one member area."),
		column(
			"validFrom",
			"string",
			"The first date this definition is known to apply, when supplied by the curator.",
			false,
		),
		column(
			"validTo",
			"string",
			"The first date this definition is known not to apply, when supplied by the curator.",
			false,
		),
	],
	rows: inventory.locations.flatMap((location) =>
		location.memberCodes.map((memberCode) => ({
			locationId: location.id,
			label: location.label,
			kind: location.kind,
			definitionRevision: location.definitionRevision,
			memberGeography: location.memberGeography,
			memberCode,
			validFrom: location.validity.from,
			validTo: location.validity.to,
		})),
	),
});

const csvCell = (value: Value) => {
	const text =
		value === null
			? ""
			: Array.isArray(value)
				? value.join(" | ")
				: String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Renders a lookup table. The same table always renders the same bytes. */
export const renderLookup = (table: LookupTable, format: LookupFormat) => {
	const names = table.columns.map((entry) => entry.name);
	if (format === "ndjson") {
		return {
			contentType: "application/x-ndjson; charset=utf-8",
			body: table.rows
				.map(
					(row) =>
						`${JSON.stringify(Object.fromEntries(names.map((name) => [name, row[name] ?? null])))}\n`,
				)
				.join(""),
		};
	}
	return {
		contentType: "text/csv; charset=utf-8",
		body: [
			names.join(","),
			...table.rows.map((row) =>
				names.map((name) => csvCell(row[name] ?? null)).join(","),
			),
		]
			.map((line) => `${line}\n`)
			.join(""),
	};
};

export const compileLookupManifest = (
	tables: LookupTable[],
): LookupManifest => {
	const ids = tables.map((table) => table.id);
	if (new Set(ids).size !== ids.length) {
		throw new Error("Each lookup must have a unique id.");
	}
	const lookups = [...tables]
		.sort((left, right) => left.id.localeCompare(right.id))
		.map(({ rows, ...table }) => {
			for (const entry of table.columns) {
				const empty = rows.some((row) => {
					const value = row[entry.name];
					return (
						value === null ||
						value === undefined ||
						value === "" ||
						(Array.isArray(value) && value.length === 0)
					);
				});
				if (entry.required && empty) {
					throw new Error(
						`${table.id}: required column ${entry.name} is empty in some rows.`,
					);
				}
			}
			return {
				...table,
				rowCount: rows.length,
				formats: Object.fromEntries(
					LOOKUP_FORMATS.map((format) => {
						const { contentType, body } = renderLookup(
							{ ...table, rows },
							format,
						);
						return [
							format,
							{
								contentType,
								bytes: Buffer.byteLength(body, "utf8"),
								contentHash: sha256(body),
								href: `/v1/lookups/${table.id}?format=${format}`,
							},
						];
					}),
				) as LookupManifest["lookups"][number]["formats"],
			};
		});
	return {
		schemaVersion: 1,
		contentHash: sha256(JSON.stringify({ schemaVersion: 1, lookups })),
		lookups,
	};
};

export const lookupBodyHash = sha256;
