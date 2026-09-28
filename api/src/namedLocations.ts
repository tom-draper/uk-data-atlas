import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { NamedLocationGeometry } from "./namedLocationGeometry";

type GazetteerCore = {
	version?: unknown;
	namedLocations?: unknown;
};

type GazetteerNamedLocation = {
	kind?: unknown;
	source?: unknown;
	definitionRevision?: unknown;
	memberCodes?: unknown;
	memberAssertions?: unknown;
	memberGeography?: unknown;
	validFrom?: unknown;
	validTo?: unknown;
	bbox?: unknown;
};

export const DEFAULT_NAMED_LOCATION_MEMBER_GEOGRAPHY = "localAuthority";

/**
 * What a named location is. An official kind is an area ONS defines, with its
 * members taken from the ONS lookup in `source`; `editorial-grouping` is a
 * curated set that claims no official status.
 */
export type NamedLocationKind =
	| "editorial-grouping"
	| "country"
	| "region"
	| "combined-authority"
	| "county";

export type NamedLocation = {
	id: string;
	label: string;
	kind: NamedLocationKind;
	/** For an official kind, the ONS lookup its current members come from. */
	source?: {
		publisher: "Office for National Statistics";
		/** Directory under data/lookups in the Atlas repository. */
		lookup: string;
		code: string;
	};
	/** Revision of this definition in the curated gazetteer. */
	definitionRevision: number;
	/** The geography whose codes define this editorial grouping. */
	memberGeography: string;
	/** Every source-area assertion, with its own known effective interval. */
	memberAssertions?: Array<{
		code: string;
		validity: { from: string | null; to: string | null };
	}>;
	/** All codes in the definition. Use `membersAt` to select a date. */
	memberCodes: string[];
	/** Known temporal bounds of the definition; null means the source gives none. */
	validity: { from: string | null; to: string | null };
	bbox: [number, number, number, number];
	/** A build-time union of members from one fully resolved boundary release. */
	geometry?: NamedLocationGeometry;
};

export type NamedLocationInventory = {
	schemaVersion: 1;
	contentHash: string;
	source: {
		artifact: "data/datasets/gazetteer.core.json";
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

type MemberAssertion = NonNullable<NamedLocation["memberAssertions"]>[number];

const memberAssertions = (
	value: unknown,
	legacyCodes: string[] | undefined,
	validFrom: string | null | undefined,
	validTo: string | null | undefined,
): MemberAssertion[] | undefined => {
	if (value === undefined) {
		return legacyCodes?.map((code) => ({
			code,
			validity: { from: validFrom ?? null, to: validTo ?? null },
		}));
	}
	if (!Array.isArray(value)) return undefined;
	const assertions = value.map((item) => {
		const entry = (item ?? {}) as Record<string, unknown>;
		const code = typeof entry.code === "string" ? entry.code.trim() : "";
		const from = isoDate(entry.validFrom);
		const to = isoDate(entry.validTo);
		return code &&
			from !== undefined &&
			to !== undefined &&
			(from === null || to === null || from < to)
			? { code, validity: { from, to } }
			: undefined;
	});
	if (assertions.some((assertion) => !assertion)) return undefined;
	const resolved = assertions as MemberAssertion[];
	if (new Set(resolved.map(({ code }) => code)).size !== resolved.length)
		return undefined;
	return resolved.sort((left, right) => left.code.localeCompare(right.code));
};

const memberGeography = (value: unknown): string | undefined =>
	value === undefined
		? DEFAULT_NAMED_LOCATION_MEMBER_GEOGRAPHY
		: typeof value === "string" && value.trim().length > 0
			? value.trim()
			: undefined;

const OFFICIAL_KINDS = new Set<NamedLocationKind>([
	"country",
	"region",
	"combined-authority",
	"county",
]);

// The gazetteer calls a curated grouping `editorial`; older cores omit it.
const kind = (value: unknown): NamedLocationKind | undefined =>
	value === undefined || value === "editorial"
		? "editorial-grouping"
		: OFFICIAL_KINDS.has(value as NamedLocationKind)
			? (value as NamedLocationKind)
			: undefined;

const placeSource = (
	value: unknown,
): NamedLocation["source"] | null | undefined => {
	if (value === undefined) return null;
	const { lookup, code } = (value ?? {}) as Record<string, unknown>;
	return typeof lookup === "string" &&
		lookup.length > 0 &&
		typeof code === "string" &&
		code.length > 0
		? { publisher: "Office for National Statistics", lookup, code }
		: undefined;
};

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
	return Number.isNaN(date.valueOf()) ||
		date.toISOString().slice(0, 10) !== value
		? undefined
		: value;
};

/**
 * Compile the Atlas location definitions into an API artifact. A location is
 * official only where the gazetteer sourced it from an ONS lookup and says
 * so; everything else stays an explicit editorial grouping.
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
			const validFrom = isoDate(entry.validFrom);
			const validTo = isoDate(entry.validTo);
			const legacyMembers = memberCodes(entry.memberCodes);
			const assertions = memberAssertions(
				entry.memberAssertions,
				legacyMembers,
				validFrom,
				validTo,
			);
			const geography = memberGeography(entry.memberGeography);
			const bounds = bbox(entry.bbox);
			const locationKind = kind(entry.kind);
			const locationSource = placeSource(entry.source);
			if (
				!locationKind ||
				locationSource === undefined ||
				// An official area must say where it comes from; a country is
				// defined by its code prefix and needs no lookup.
				(locationKind !== "editorial-grouping" &&
					locationKind !== "country" &&
					!locationSource)
			)
				throw new Error(`${path}: named location ${label} is invalid`);
			if (
				!id ||
				!definitionRevision ||
				!assertions ||
				(legacyMembers !== undefined &&
					legacyMembers.join(",") !==
						assertions.map(({ code }) => code).join(",")) ||
				!geography ||
				validFrom === undefined ||
				validTo === undefined ||
				(validFrom !== null &&
					validTo !== null &&
					validFrom >= validTo) ||
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
				kind: locationKind,
				...(locationSource && { source: locationSource }),
				definitionRevision,
				memberGeography: geography,
				memberAssertions: assertions,
				memberCodes: assertions.map(({ code }) => code),
				validity: { from: validFrom, to: validTo },
				bbox: bounds,
			};
		})
		.sort((left, right) => left.label.localeCompare(right.label));

	const content = JSON.stringify({
		schemaVersion: 1,
		source: {
			artifact: "data/datasets/gazetteer.core.json",
			gazetteerVersion: source.version,
		},
		locations,
	});
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		source: {
			artifact: "data/datasets/gazetteer.core.json",
			gazetteerVersion: source.version,
		},
		locations,
	};
};

export const createNamedLocationLookup = (
	inventory: NamedLocationInventory,
): NamedLocationLookup =>
	new Map(inventory.locations.map((location) => [location.id, location]));

/** Select the codes whose half-open membership interval includes `asOf`. */
export const membersAt = (location: NamedLocation, asOf?: string) =>
	(
		location.memberAssertions ??
		location.memberCodes.map((code) => ({
			code,
			validity: location.validity,
		}))
	)
		.filter(
			({ validity }) =>
				asOf === undefined ||
				((validity.from === null || validity.from <= asOf) &&
					(validity.to === null || asOf < validity.to)),
		)
		.map(({ code }) => code);

/** A dated view leaves the full membership audit trail attached to the location. */
export const selectNamedLocationAt = (
	location: NamedLocation,
	asOf?: string,
): NamedLocation =>
	asOf === undefined
		? location
		: { ...location, memberCodes: membersAt(location, asOf) };
