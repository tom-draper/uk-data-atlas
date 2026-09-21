import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

type GazetteerCore = {
	version?: unknown;
	namedLocations?: unknown;
};

type GazetteerNamedLocation = {
	definitionRevision?: unknown;
	memberCodes?: unknown;
	memberGeography?: unknown;
	validFrom?: unknown;
	validTo?: unknown;
	bbox?: unknown;
};

export const DEFAULT_NAMED_LOCATION_MEMBER_GEOGRAPHY = "localAuthority";

export type NamedLocation = {
	id: string;
	label: string;
	kind: "editorial-grouping";
	/** Revision of this definition in the curated gazetteer. */
	definitionRevision: number;
	/** The geography whose codes define this editorial grouping. */
	memberGeography: string;
	memberCodes: string[];
	/** Known temporal bounds of the definition; null means the source gives none. */
	validity: { from: string | null; to: string | null };
	bbox: [number, number, number, number];
};

export type NamedLocationInventory = {
	schemaVersion: 1;
	contentHash: string;
	source: {
		artifact: "data/precompiled/gazetteer.core.json";
		gazetteerVersion: number;
	};
	locations: NamedLocation[];
};

export type NamedLocationLookup = Map<string, NamedLocation>;

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const idFor = (label: string) =>
	label
		.trim()
		.toLocaleLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "");

const bbox = (value: unknown): [number, number, number, number] | undefined =>
	Array.isArray(value) &&
	value.length === 4 &&
	value.every((coordinate) => typeof coordinate === "number")
		? (value as [number, number, number, number])
		: undefined;

const memberCodes = (value: unknown): string[] | undefined =>
	Array.isArray(value) &&
	value.every((code) => typeof code === "string" && code.trim().length > 0)
		? [...new Set(value.map((code) => code.trim()))].sort()
		: undefined;

const memberGeography = (value: unknown): string | undefined =>
	value === undefined
		? DEFAULT_NAMED_LOCATION_MEMBER_GEOGRAPHY
		: typeof value === "string" && value.trim().length > 0
			? value.trim()
			: undefined;

const revision = (value: unknown, fallback: number): number | undefined =>
	value === undefined
		? fallback
		: typeof value === "number" && Number.isSafeInteger(value) && value > 0
			? value
			: undefined;

const isoDate = (value: unknown): string | null | undefined => {
	if (value === undefined) return null;
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
		return undefined;
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value
		? undefined
		: value;
};

/**
 * Compile the existing, curated Atlas location definitions into an API artifact.
 * They remain explicitly editorial groupings: this compiler adds no claim that a
 * location is an official administrative geography.
 */
export const compileNamedLocations = (path: string): NamedLocationInventory => {
	const source = JSON.parse(readFileSync(path, "utf8")) as GazetteerCore;
	if (
		typeof source.version !== "number" ||
		typeof source.namedLocations !== "object" ||
		source.namedLocations === null ||
		Array.isArray(source.namedLocations)
	) {
		throw new Error(`Invalid gazetteer named locations at ${path}`);
	}
	const gazetteerVersion = source.version;

	const seenIds = new Set<string>();
	const locations = Object.entries(source.namedLocations)
		.map(([label, value]) => {
			const entry = value as GazetteerNamedLocation;
			const id = idFor(label);
			const definitionRevision = revision(
				entry.definitionRevision,
				gazetteerVersion,
			);
			const members = memberCodes(entry.memberCodes);
			const geography = memberGeography(entry.memberGeography);
			const validFrom = isoDate(entry.validFrom);
			const validTo = isoDate(entry.validTo);
			const bounds = bbox(entry.bbox);
			if (
				!id ||
				!definitionRevision ||
				!members ||
				!geography ||
				validFrom === undefined ||
				validTo === undefined ||
				(validFrom !== null && validTo !== null && validFrom > validTo) ||
				!bounds
			) {
				throw new Error(`${path}: named location ${label} is invalid`);
			}
			if (seenIds.has(id)) {
				throw new Error(
					`${path}: named location id ${id} is not unique`,
				);
			}
			seenIds.add(id);
			return {
				id,
				label,
				kind: "editorial-grouping" as const,
				definitionRevision,
				memberGeography: geography,
				memberCodes: members,
				validity: { from: validFrom, to: validTo },
				bbox: bounds,
			};
		})
		.sort((left, right) => left.label.localeCompare(right.label));

	const content = JSON.stringify({
		schemaVersion: 1,
		source: {
			artifact: "data/precompiled/gazetteer.core.json",
			gazetteerVersion: source.version,
		},
		locations,
	});
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		source: {
			artifact: "data/precompiled/gazetteer.core.json",
			gazetteerVersion: source.version,
		},
		locations,
	};
};

export const createNamedLocationLookup = (
	inventory: NamedLocationInventory,
): NamedLocationLookup =>
	new Map(inventory.locations.map((location) => [location.id, location]));
