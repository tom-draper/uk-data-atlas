/**
 * Write the /places pages' data: a profile of every ward, local authority and
 * constituency the API's geography resolver holds, current or abolished, and
 * of every named place, such as Greater Manchester or Kent. Each profile
 * holds the place's outline, what it sits within and contains, its
 * neighbours, its history across boundary releases and the atlas datasets
 * that publish figures for it.
 *
 * Needs the API's build output (pnpm --dir services/api build); the files it
 * writes are committed with the rest of public/data, under
 * public/data/datasets/places.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readApiCatalogues } from "@uk-data-atlas/api/catalogues";
import { simplifyGeometry } from "@uk-data-atlas/api/geometry";
import { ATLAS_LOCATIONS } from "../lib/atlas/pages";
import { BOUNDARY_CATALOG } from "../lib/data/boundaries/catalog";
import {
	PLACE_GEOGRAPHIES,
	encodeOutline,
	placeShard,
	releaseCovers,
	releaseYear,
	type AreaGroup,
	type AreaProfile,
	type AreaRef,
	type BoundingBox,
	type DatasetCoverage,
	type NamedProfile,
	type NamedRef,
	type Outline,
	type PlaceGeography,
	type PlaceIndex,
	type TimelineEvent,
} from "../lib/places/profile";
import { recordResolverProjections } from "./resolver-projections";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATASETS = join(ROOT, "public", "data", "datasets");
const OUTPUT = join(DATASETS, "places");

/** Children listed by name rather than counted, up to this many. */
const LISTED_CHILDREN = 120;
/** The generalisation tier each geography's outline is drawn at. */
const OUTLINE_TIER = {
	ward: "medium",
	localAuthority: "medium",
	constituency: "medium",
} as const;
/** A boundary counts as redrawn when its area moves by more than this. */
const REDRAWN_SHARE = 0.02;
const REDRAWN_KM2 = 0.05;

const catalogues = readApiCatalogues(join(ROOT, "services", "api"));
const { geographyResolver: resolver, atlasRelease } = catalogues;

type Identity = { geography: string; boundaryRelease: string; code: string };
type Relationship = {
	relation: string;
	counterpart: {
		geography: string;
		boundaryRelease: string;
		code: string;
		labels?: string[];
	};
};

const ref = ({ counterpart }: Relationship): AreaRef => ({
	geography: counterpart.geography,
	release: counterpart.boundaryRelease,
	code: counterpart.code,
	name: counterpart.labels?.[0] ?? counterpart.code,
});

/** The area's outline as multipolygon coordinates, generalised to a tier. */
function polygonsOf(
	identity: Identity,
	tier: "high" | "medium" | "low",
): number[][][][] | undefined {
	const resolved = resolver.areaGeometry(identity);
	if (!resolved) return undefined;
	const simplified =
		simplifyGeometry(resolved.geometry, tier) ??
		simplifyGeometry(resolved.geometry, "high");
	const geometry = simplified?.geometry ?? resolved.geometry;
	if (geometry.type === "Polygon")
		return [geometry.coordinates as number[][][]];
	if (geometry.type === "MultiPolygon")
		return geometry.coordinates as number[][][][];
	return undefined;
}

function boundsOf(shapes: number[][][][][]): BoundingBox {
	const box: BoundingBox = [180, 90, -180, -90];
	for (const polygons of shapes)
		for (const polygon of polygons)
			for (const [x, y] of polygon[0]!) {
				box[0] = Math.min(box[0], x!);
				box[1] = Math.min(box[1], y!);
				box[2] = Math.max(box[2], x!);
				box[3] = Math.max(box[3], y!);
			}
	return box.map((value) => Math.round(value * 1e4) / 1e4) as BoundingBox;
}

// Each release's published area for every code, from the atlas's own
// boundary properties, to tell when an area's boundary was redrawn.
function readAreas(geography: PlaceGeography) {
	const areas = new Map<string, Map<string, number>>();
	for (const release of BOUNDARY_CATALOG[geography].releases) {
		if (!release.asset) continue;
		const folder = release.asset.split("/").slice(-3, -1).join("/");
		const path = join(
			ROOT,
			"public",
			"data",
			"boundaries",
			folder,
			"properties.json",
		);
		const { features } = JSON.parse(readFileSync(path, "utf8")) as {
			features: Record<string, unknown>[];
		};
		const byCode = new Map<string, number>();
		for (const feature of features) {
			const code = feature[release.codeKey];
			if (
				typeof code === "string" &&
				typeof feature.areaSqKm === "number"
			)
				byCode.set(code, feature.areaSqKm);
		}
		areas.set(release.id, byCode);
	}
	return areas;
}

// The atlas datasets that publish a figure for each code, and for which
// years. A dataset's years each hold maps from code to figures.
function readDatasetCoverage() {
	const manifest = JSON.parse(
		readFileSync(join(DATASETS, "dataset-manifest.json"), "utf8"),
	) as {
		datasets: { output: string; source: { name: string } }[];
	};
	const coverage = new Map<string, Map<string, Set<number>>>();
	const titles = new Map<string, string>();
	const looksLikeCode = (key: string) => /^[EWSN]\d{8}$/.test(key);
	for (const { output, source } of manifest.datasets) {
		if (titles.has(output)) continue;
		titles.set(output, source.name);
		const file = JSON.parse(
			readFileSync(join(DATASETS, `${output}.json`), "utf8"),
		) as Record<string, unknown>;
		for (const [key, entry] of Object.entries(file)) {
			if (!entry || typeof entry !== "object") continue;
			const year = Number((entry as { year?: unknown }).year ?? key);
			if (!Number.isFinite(year)) continue;
			for (const value of Object.values(entry)) {
				if (!value || typeof value !== "object" || Array.isArray(value))
					continue;
				const codes = Object.keys(value).filter(looksLikeCode);
				if (codes.length < 5) continue;
				for (const code of codes) {
					const byDataset = coverage.get(code) ?? new Map();
					coverage.set(code, byDataset);
					const years = byDataset.get(output) ?? new Set<number>();
					byDataset.set(output, years);
					years.add(year);
				}
			}
		}
	}
	return (code: string): DatasetCoverage[] =>
		[...(coverage.get(code) ?? [])]
			.map(([slug, years]) => ({
				slug,
				title: titles.get(slug) ?? slug,
				years: [...years].sort((a, b) => b - a),
			}))
			.sort((a, b) => a.title.localeCompare(b.title));
}

const datasetsFor = readDatasetCoverage();

/** The datasets that count each geography's residents, one per geography. */
const POPULATION_DATASETS = [
	"population",
	"population-uk",
	"population-constituency",
];

// The latest population each dataset publishes for a code. A total is either
// a count or a count for each single year of age.
function readPopulations() {
	const latest = new Map<
		string,
		{ value: number; year: number; dataset: string }
	>();
	const sum = (total: unknown): number | undefined =>
		typeof total === "number"
			? total
			: total && typeof total === "object"
				? Object.values(total).reduce<number>(
						(count, value) =>
							count + (typeof value === "number" ? value : 0),
						0,
					)
				: undefined;
	for (const dataset of POPULATION_DATASETS) {
		const file = JSON.parse(
			readFileSync(join(DATASETS, `${dataset}.json`), "utf8"),
		) as Record<
			string,
			{ year: number; data: Record<string, { total?: unknown }> }
		>;
		for (const { year, data } of Object.values(file))
			for (const [code, record] of Object.entries(data)) {
				const value = sum(record.total);
				if (value === undefined || value <= 0) continue;
				const known = latest.get(code);
				if (!known || year > known.year)
					latest.set(code, {
						value: Math.round(value),
						year,
						dataset,
					});
			}
	}
	return latest;
}

const populations = readPopulations();

// The atlas's maps pages: one per council, and one per curated named place.
const mapsSlugByCode = new Map<string, string>();
const mapsSlugByName = new Map<string, string>();
for (const location of ATLAS_LOCATIONS) {
	mapsSlugByName.set(location.name, location.slug);
	if (location.kind === "local-authority" && location.members.length === 1)
		mapsSlugByCode.set(location.members[0]!, location.slug);
}

const namedRef = (location: { id: string; label: string; kind: string }) => ({
	id: location.id,
	label: location.label,
	kind: location.kind,
});

/** The newest release of each geography among some relationships. */
function newestPerGeography(relationships: Relationship[]) {
	const newest = new Map<string, string>();
	for (const { counterpart } of relationships) {
		const current = newest.get(counterpart.geography);
		if (!current || counterpart.boundaryRelease > current)
			newest.set(counterpart.geography, counterpart.boundaryRelease);
	}
	return relationships.filter(
		({ counterpart }) =>
			newest.get(counterpart.geography) === counterpart.boundaryRelease,
	);
}

function group(relationships: Relationship[], listed: boolean): AreaGroup[] {
	const groups = new Map<string, Relationship[]>();
	const seen = new Set<string>();
	for (const relationship of newestPerGeography(relationships)) {
		const key = relationship.counterpart.geography;
		// Two crosswalks can link the same pair of areas.
		if (seen.has(`${key}/${relationship.counterpart.code}`)) continue;
		seen.add(`${key}/${relationship.counterpart.code}`);
		groups.set(key, [...(groups.get(key) ?? []), relationship]);
	}
	return [...groups].map(([geography, members]) => ({
		geography,
		release: members[0]!.counterpart.boundaryRelease,
		count: members.length,
		...(listed && members.length <= LISTED_CHILDREN
			? {
					areas: members
						.map(ref)
						.sort((a, b) => a.name.localeCompare(b.name)),
				}
			: {}),
	}));
}

/**
 * The counterpart from a release of about the same time as `release`: the
 * newest at or before it, within a year, or failing that the oldest after it
 * within a year.
 */
function contemporary(
	relationships: Relationship[],
	release: string,
): AreaRef | undefined {
	const year = releaseYear(release);
	const near = relationships
		.map(ref)
		.filter((area) => Math.abs(releaseYear(area.release) - year) <= 1)
		.sort((a, b) => a.release.localeCompare(b.release));
	return (
		near.filter((area) => area.release <= release).at(-1) ??
		near.find((area) => area.release > release)
	);
}

/** The contemporary counterpart, or failing that the nearest in time. */
function nearest(
	relationships: Relationship[],
	release: string,
): AreaRef | undefined {
	const year = releaseYear(release);
	return (
		contemporary(relationships, release) ??
		relationships
			.map(ref)
			.sort(
				(a, b) =>
					Math.abs(releaseYear(a.release) - year) -
					Math.abs(releaseYear(b.release) - year),
			)[0]
	);
}

const uniqueRefs = (refs: AreaRef[]) => [
	...new Map(
		refs.map((area) => [`${area.release}/${area.code}`, area]),
	).values(),
];

function areaProfile(
	geography: PlaceGeography,
	code: string,
	geographyReleases: string[],
	areas: Map<string, Map<string, number>>,
): AreaProfile | undefined {
	const covering = geographyReleases.filter((release) =>
		releaseCovers(release, code),
	);
	const releases = geographyReleases.filter((release) =>
		resolver.area({ geography, boundaryRelease: release, code }),
	);
	if (releases.length === 0) return undefined;
	const first = releases[0]!;
	const last = releases.at(-1)!;
	const identity = (boundaryRelease: string) => ({
		geography,
		boundaryRelease,
		code,
	});
	const nameIn = (release: string) =>
		resolver.area(identity(release))!.name as string;
	const relationshipsIn = (release: string) =>
		resolver.areaRelationshipSummary(identity(release))
			.relationships as Relationship[];
	const lastRelationships = relationshipsIn(last);

	const current = last === covering.at(-1);
	// The first release after it was last published, when it has ended.
	const ending = current ? undefined : covering[covering.indexOf(last) + 1]!;
	const timeline: TimelineEvent[] = [];
	timeline.push({
		kind: "first-published",
		release: first,
		archiveStart: first === covering[0],
	});

	// Links to other codes of the same geography, from every release that
	// holds this one. A crosswalk can link releases years apart, so a link is
	// placed by the counterpart's release, not by the release it was read in.
	const formedFrom = new Map<string, Relationship>();
	const gained: { release: string; relationship: Relationship }[] = [];
	const lost: Relationship[] = [];
	const succeededBy = new Map<string, Relationship>();
	let previousName = nameIn(first);
	let previousArea = areas.get(first)?.get(code);
	let previousCouncil: AreaRef | null = null;
	releases.forEach((release, index) => {
		const relationships = relationshipsIn(release);
		for (const relationship of relationships) {
			const { counterpart } = relationship;
			if (
				counterpart.geography !== geography ||
				counterpart.code === code
			)
				continue;
			if (counterpart.boundaryRelease < first)
				formedFrom.set(counterpart.code, relationship);
			else if (counterpart.boundaryRelease > last)
				succeededBy.set(counterpart.code, relationship);
			else if (counterpart.boundaryRelease < release)
				gained.push({ release, relationship });
			else if (counterpart.boundaryRelease > release)
				lost.push(relationship);
		}

		const name = nameIn(release);
		if (index > 0 && name !== previousName)
			timeline.push({
				kind: "renamed",
				release,
				from: previousName,
				to: name,
			});
		previousName = name;

		const area = areas.get(release)?.get(code);
		if (index > 0 && area !== undefined && previousArea !== undefined) {
			const change = Math.abs(area - previousArea);
			if (change > REDRAWN_KM2 && change / previousArea > REDRAWN_SHARE)
				timeline.push({
					kind: "redrawn",
					release,
					fromKm2: previousArea,
					toKm2: area,
				});
		}
		if (area !== undefined) previousArea = area;

		// The council a ward sat in, read only from a council release of about
		// the same time: a crosswalk to a council release years later says
		// where the ward's ground went, not which council it belonged to.
		if (geography === "ward") {
			const council = contemporary(
				relationships.filter(
					({ relation, counterpart }) =>
						relation === "within" &&
						counterpart.geography === "localAuthority",
				),
				release,
			);
			if (council) {
				if (previousCouncil && council.code !== previousCouncil.code)
					timeline.push({
						kind: "parent-changed",
						release,
						geography: "localAuthority",
						from: previousCouncil,
						to: council,
					});
				previousCouncil = council;
			}
		}
	});
	const byRelation = (relationships: Relationship[]) => {
		const groups = new Map<string, Relationship[]>();
		for (const relationship of relationships)
			groups.set(relationship.relation, [
				...(groups.get(relationship.relation) ?? []),
				relationship,
			]);
		return [...groups];
	};
	// One event for how it was formed. Links of different kinds, as when a
	// constituency takes over one seat and part of another, read as "parts".
	const formedBy = byRelation([...formedFrom.values()]);
	if (formedBy.length > 0)
		timeline.push({
			kind: "formed",
			release: first,
			relation: formedBy.length === 1 ? formedBy[0]![0] : "mixed",
			areas: uniqueRefs([...formedFrom.values()].map(ref)).sort((a, b) =>
				a.name.localeCompare(b.name),
			),
		});
	for (const { release, relationship } of gained)
		timeline.push({
			kind: "gained",
			release,
			relation: relationship.relation,
			areas: [ref(relationship)],
		});
	for (const relationship of lost)
		timeline.push({
			kind: "lost",
			release: relationship.counterpart.boundaryRelease,
			relation: relationship.relation,
			areas: [ref(relationship)],
		});

	// A ward's constituency, as each constituency release places it.
	if (geography === "ward") {
		const constituencies = lastRelationships
			.filter(
				({ relation, counterpart }) =>
					relation === "within" &&
					counterpart.geography === "constituency",
			)
			.map(ref)
			.filter((constituency) => !ending || constituency.release < ending)
			.sort((a, b) => a.release.localeCompare(b.release));
		constituencies.forEach((constituency, index) => {
			const before = constituencies[index - 1];
			if (before && before.code !== constituency.code)
				timeline.push({
					kind: "parent-changed",
					release: constituency.release,
					geography: "constituency",
					from: before,
					to: constituency,
				});
		});
	}

	if (!current) {
		const successors = [...succeededBy.values()].sort((a, b) =>
			a.counterpart.boundaryRelease.localeCompare(
				b.counterpart.boundaryRelease,
			),
		);
		const [{ relation } = { relation: "none" }] = successors;
		timeline.push({
			kind: "ended",
			release: successors[0]?.counterpart.boundaryRelease ?? ending!,
			relation,
			areas: uniqueRefs(
				successors
					.filter((link) => link.relation === relation)
					.map(ref),
			),
		});
	}

	// What it sits within: as the newest release holding it places it, or
	// for an area that has ended, as releases nearest its end place it.
	const within = lastRelationships.filter(
		({ relation, counterpart }) =>
			relation === "within" && counterpart.geography !== geography,
	);
	const parents = current
		? newestPerGeography(within).map(ref)
		: [...new Set(within.map(({ counterpart }) => counterpart.geography))]
				.map((parent) =>
					parent === "localAuthority" && previousCouncil
						? previousCouncil
						: nearest(
								within.filter(
									({ counterpart }) =>
										counterpart.geography === parent,
								),
								last,
							),
				)
				.filter((parent): parent is AreaRef => parent !== undefined);
	const namedPlaces: NamedRef[] | undefined =
		geography === "localAuthority"
			? resolver.namedLocationsForArea(identity(last)).map(namedRef)
			: undefined;

	// When a council joined or left a named place during its own life; a date
	// at its start or end only restates that it was formed or abolished.
	const lifeStart = first.slice(0, 7);
	const lifeEnd = ending?.slice(0, 7) ?? "9999";
	if (geography === "localAuthority")
		for (const location of resolver.namedLocations())
			for (const assertion of location.memberAssertions ?? []) {
				if (assertion.code !== code) continue;
				const place = namedRef(location);
				const { from, to } = assertion.validity;
				if (
					from &&
					from.slice(0, 7) > lifeStart &&
					from.slice(0, 7) < lifeEnd
				)
					timeline.push({ kind: "joined", date: from, place });
				if (
					to &&
					to.slice(0, 7) > lifeStart &&
					to.slice(0, 7) < lifeEnd
				)
					timeline.push({ kind: "left", date: to, place });
			}

	const neighbours = (() => {
		try {
			const answer = resolver.areaNeighbours(identity(last)) as {
				neighbours: {
					code: string;
					sharedBorderM: number;
					area: { name: string };
				}[];
			};
			return answer.neighbours
				.map((neighbour) => ({
					code: neighbour.code,
					name: neighbour.area.name,
					sharedBorderM: Math.round(neighbour.sharedBorderM),
				}))
				.filter((neighbour) => neighbour.sharedBorderM > 0)
				.sort((a, b) => b.sharedBorderM - a.sharedBorderM);
		} catch {
			return [];
		}
	})();

	const polygons = polygonsOf(identity(last), OUTLINE_TIER[geography]);
	const dateOf = (event: TimelineEvent) =>
		"date" in event ? event.date : `${event.release.slice(0, 7)}-01`;
	return {
		type: "area",
		code,
		name: nameIn(last),
		geography,
		releases: releases.map((release) => geographyReleases.indexOf(release)),
		current,
		...(areas.get(last)?.get(code) !== undefined
			? { areaKm2: areas.get(last)!.get(code)! }
			: {}),
		...(populations.has(code)
			? { population: populations.get(code)! }
			: {}),
		bbox: polygons ? boundsOf([polygons]) : [0, 0, 0, 0],
		...(polygons ? { outline: encodeOutline(polygons) } : {}),
		parents,
		...(namedPlaces ? { namedPlaces } : {}),
		children: group(
			lastRelationships.filter(({ relation }) => relation === "contains"),
			true,
		),
		overlaps: group(
			lastRelationships.filter(
				({ relation, counterpart }) =>
					relation === "overlaps" &&
					counterpart.geography !== geography &&
					(PLACE_GEOGRAPHIES as readonly string[]).includes(
						counterpart.geography,
					),
			),
			true,
		),
		neighbours,
		timeline: timeline
			.map((event, order) => ({ event, order }))
			.sort(
				(a, b) =>
					dateOf(b.event).localeCompare(dateOf(a.event)) ||
					b.order - a.order,
			)
			.map(({ event }) => event),
		datasets: datasetsFor(code),
		...(mapsSlugByCode.has(code)
			? { mapsSlug: mapsSlugByCode.get(code) }
			: {}),
	};
}

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(join(OUTPUT, "areas"), { recursive: true });
mkdirSync(join(OUTPUT, "named"), { recursive: true });

const outputs = new Map<string, string>();
const index: Pick<PlaceIndex, "areas" | "named" | "releases"> = {
	areas: [],
	named: [],
	releases: { localAuthority: [], ward: [], constituency: [] },
};
const councilNames = new Map<string, string>();

for (const geography of PLACE_GEOGRAPHIES) {
	const releases = (
		resolver.areaReleases() as {
			geography: string;
			boundaryRelease: string;
		}[]
	)
		.filter((release) => release.geography === geography)
		.map((release) => release.boundaryRelease)
		.sort();
	index.releases[geography] = releases;
	const codes = new Set<string>();
	for (const release of releases)
		for (const code of resolver.areaCodes(geography, release) ?? [])
			codes.add(code);
	const areas = readAreas(geography);
	const shards = new Map<string, Record<string, AreaProfile>>();
	let done = 0;
	for (const code of [...codes].sort()) {
		const profile = areaProfile(geography, code, releases, areas);
		if (++done % 2000 === 0)
			console.log(`${geography}: ${done} of ${codes.size}`);
		if (!profile) continue;
		const shard = shards.get(placeShard(code)) ?? {};
		shards.set(placeShard(code), shard);
		shard[code] = profile;
		if (geography === "localAuthority")
			councilNames.set(code, profile.name);
		index.areas.push([
			code,
			profile.name,
			geography,
			profile.parents.find(
				(parent) => parent.geography === "localAuthority",
			)?.name ?? null,
			releaseYear(releases[profile.releases[0]!]!),
			profile.current
				? null
				: releaseYear(releases[profile.releases.at(-1)!]!),
		]);
	}
	for (const [shard, profiles] of shards) {
		const name = `areas/${shard}.json`;
		if (outputs.has(name))
			Object.assign(profiles, JSON.parse(outputs.get(name)!));
		outputs.set(name, JSON.stringify(profiles));
	}
	console.log(
		`${geography}: ${codes.size} codes in ${releases.length} releases`,
	);
}

const newestCouncilRelease = (
	resolver.areaReleases() as { geography: string; boundaryRelease: string }[]
)
	.filter((release) => release.geography === "localAuthority")
	.map((release) => release.boundaryRelease)
	.sort()
	.at(-1)!;
const currentCouncils =
	resolver.areaCodes("localAuthority", newestCouncilRelease) ?? [];

type NamedLocation = {
	id: string;
	label: string;
	kind: string;
	source: Record<string, string>;
	memberGeography: string;
	memberAssertions: {
		code: string;
		validity: { from: string | null; to: string | null };
	}[];
};
const namedLocations = resolver.namedLocations() as NamedLocation[];
const membersOf = (location: NamedLocation) => location.memberAssertions ?? [];
const COUNTRY_PREFIX: Record<string, string> = {
	england: "E",
	wales: "W",
	scotland: "S",
	"northern-ireland": "N",
	"united-kingdom": "",
};
const sourceText = (location: NamedLocation) => {
	const { source } = location;
	if (location.kind === "editorial-grouping")
		return "A grouping curated by the UK Data Atlas, with no official status.";
	if (location.kind === "country")
		return location.id === "united-kingdom"
			? "Every local authority in England, Wales, Scotland and Northern Ireland."
			: "One of the UK's four nations. Its local authorities are those whose codes start with its letter.";
	if (source.publisher === "Ordnance Survey")
		return `Its boundary comes from Ordnance Survey${source.edition ? `'s ${source.edition} edition of` : ""} Boundary-Line, and each local authority counts as a member of the county holding most of its area. It has no official code.`;
	return `Defined by the ${source.publisher ?? "Office for National Statistics"}${source.code ? `, which gives it the code ${source.code}` : ""}.`;
};

const memberSets = new Map<string, Set<string>>();
for (const location of namedLocations) {
	const prefix = COUNTRY_PREFIX[location.id];
	const members =
		location.kind === "country" && prefix !== undefined
			? currentCouncils.filter((code) => code.startsWith(prefix))
			: membersOf(location)
					.filter((assertion) => assertion.validity.to === null)
					.map((assertion) => assertion.code);
	memberSets.set(location.id, new Set(members));
}
// One named place contains another when every current member of the second
// is a member of the first, and it has more of them.
const containsAll = (outer: string, inner: string) => {
	const a = memberSets.get(outer)!;
	const b = memberSets.get(inner)!;
	return b.size > 1 && a.size > b.size && [...b].every((code) => a.has(code));
};

for (const location of namedLocations) {
	const current = memberSets.get(location.id)!;
	const members =
		location.kind === "country"
			? [...current].map((code) => ({
					code,
					name: councilNames.get(code) ?? code,
					from: null,
					to: null,
					current: true,
				}))
			: membersOf(location).map((assertion) => ({
					code: assertion.code,
					name: councilNames.get(assertion.code) ?? assertion.code,
					from: assertion.validity.from,
					to: assertion.validity.to,
					current: assertion.validity.to === null,
				}));
	const shapes = new Map<string, number[][][][]>();
	for (const code of current) {
		const polygons = polygonsOf(
			{
				geography: "localAuthority",
				boundaryRelease: newestCouncilRelease,
				code,
			},
			current.size > 40 ? "low" : "medium",
		);
		if (polygons) shapes.set(code, polygons);
	}
	const outlines: Record<string, Outline> = Object.fromEntries(
		[...shapes].map(([code, polygons]) => [code, encodeOutline(polygons)]),
	);
	const others = namedLocations.filter((other) => other.id !== location.id);
	const profile: NamedProfile = {
		type: "named",
		id: location.id,
		label: location.label,
		kind: location.kind,
		source: sourceText(location),
		memberGeography: location.memberGeography,
		members: members.sort(
			(a, b) =>
				Number(b.current) - Number(a.current) ||
				a.name.localeCompare(b.name),
		),
		within: others
			.filter((other) => containsAll(other.id, location.id))
			.map(namedRef),
		contains: others
			.filter((other) => containsAll(location.id, other.id))
			.map(namedRef),
		bbox: boundsOf([...shapes.values()]),
		outlines,
		...(mapsSlugByName.has(location.label)
			? { mapsSlug: mapsSlugByName.get(location.label) }
			: {}),
	};
	outputs.set(`named/${location.id}.json`, JSON.stringify(profile));
	// Named places are not dated by release, so the years are left at zero.
	index.named.push([
		location.id,
		location.label,
		location.kind,
		null,
		0,
		null,
	]);
}

const contentHash = createHash("sha256");
for (const name of [...outputs.keys()].sort())
	contentHash.update(name).update(outputs.get(name)!);
const indexJson = JSON.stringify({
	version: 1,
	contentHash: `sha256:${contentHash.digest("hex")}`,
	...index,
} satisfies PlaceIndex);

let bytes = indexJson.length;
for (const [name, contents] of outputs) {
	writeFileSync(join(OUTPUT, name), contents);
	bytes += contents.length;
}
writeFileSync(join(OUTPUT, "index.json"), indexJson);
recordResolverProjections(
	DATASETS,
	atlasRelease.releaseId,
	"pnpm places:build",
	new Map([["places/index.json", indexJson]]),
);
console.log(
	`Wrote ${outputs.size + 1} files, ${(bytes / 1e6).toFixed(1)} MB, to ${OUTPUT}`,
);
