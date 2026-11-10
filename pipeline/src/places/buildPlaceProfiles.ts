import { simplifyGeometry } from "@uk-data-atlas/map-tiles";
import {
	inBox,
	pointInGeom,
} from "@uk-data-atlas/datasets/data/gazetteer/geometry";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readPlaceResolver } from "./placeResolver.ts";
import { boundsOf, centreOf } from "./placeProfileGeometry.ts";
import {
	contemporary,
	namedRef,
	ref,
	type Relationship,
} from "./placeProfileRefs.ts";
import {
	buildAreaTimeline,
	addNamedPlaceEvents,
} from "./placeProfileTimeline.ts";
import { buildNamedPlaceProfiles } from "./namedPlaceProfiles.ts";
import {
	readDatasetCoverage,
	readPopulations,
} from "./placeProfileDatasets.ts";
import {
	PLACE_GEOGRAPHIES,
	encodeOutline,
	placeShard,
	releaseCovers,
	releaseYear,
	type AreaGroup,
	type AreaProfile,
	type AreaRef,
	type NamedRef,
	type PlaceGeography,
	type PlaceIndex,
	type TimelineEvent,
} from "@uk-data-atlas/catalogue/place-profile";
import {
	artifactDirectory,
	buildLog,
	formatCount,
} from "@uk-data-atlas/atlas-db";

export function buildPlaceProfiles(ROOT: string) {
	const readDataset = (output: string) =>
		readFileSync(
			join(ROOT, "data/build/datasets", `${output}.json`),
			"utf8",
		);
	const BOUNDARIES = join(
		artifactDirectory(ROOT),
		"source-data",
		"boundaries",
	);

	/**
	 * Children listed by name rather than counted, up to this many. Parishes are
	 * always listed, as a council's page is the way into its parishes' pages.
	 */
	const LISTED_CHILDREN = 120;
	const ALWAYS_LISTED = new Set(["parish"]);
	/**
	 * Each geography's boundary folder, the prefix of its code field, and the
	 * generalisation tier its outline is drawn at.
	 */
	const GEOGRAPHY_SOURCES: Record<
		PlaceGeography,
		{ folder: string; codeField: string; tier: "high" | "medium" | "low" }
	> = {
		ward: { folder: "ward", codeField: "WD", tier: "medium" },
		localAuthority: {
			folder: "local-authority",
			codeField: "LAD",
			tier: "medium",
		},
		constituency: {
			folder: "constituency",
			codeField: "PCON",
			tier: "medium",
		},
		parish: { folder: "parish", codeField: "PARNCP", tier: "medium" },
		majorTownAndCity: {
			folder: "major-town-and-city",
			codeField: "TCITY",
			tier: "medium",
		},
	};
	const resolver = readPlaceResolver(
		ROOT,
		join(ROOT, "data/build/atlas-base.sqlite"),
	);

	type Identity = {
		geography: string;
		boundaryRelease: string;
		code: string;
	};

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

	/** The newest release of a geography. */
	const newestRelease = (geography: string) =>
		(
			resolver.areaReleases() as {
				geography: string;
				boundaryRelease: string;
			}[]
		)
			.filter((release) => release.geography === geography)
			.map((release) => release.boundaryRelease)
			.sort()
			.at(-1)!;

	/**
	 * The current wards in each major town and city. Towns are drawn from
	 * built-up areas, so no crosswalk places wards in them: a ward counts as in
	 * the town its centre falls inside.
	 */
	function townWards() {
		const townRelease = newestRelease("majorTownAndCity");
		const wardRelease = newestRelease("ward");
		const towns = (
			resolver.areaCodes("majorTownAndCity", townRelease) ?? []
		)
			.map((code) => {
				const identity = {
					geography: "majorTownAndCity",
					boundaryRelease: townRelease,
					code,
				};
				const polygons = polygonsOf(identity, "high");
				return polygons
					? {
							ref: {
								geography: "majorTownAndCity",
								release: townRelease,
								code,
								name: resolver.area(identity)!.name as string,
							},
							geometry: {
								type: "MultiPolygon",
								coordinates: polygons,
							} as GeoJSON.MultiPolygon,
							bbox: boundsOf([polygons]),
						}
					: undefined;
			})
			.filter((town) => town !== undefined);
		const townOf = new Map<string, AreaRef>();
		const wardsOf = new Map<string, AreaRef[]>();
		for (const code of resolver.areaCodes("ward", wardRelease) ?? []) {
			const identity = {
				geography: "ward",
				boundaryRelease: wardRelease,
				code,
			};
			const polygons = polygonsOf(identity, "medium");
			const centre = polygons && centreOf(polygons);
			if (!centre) continue;
			const town = towns.find(
				({ bbox, geometry }) =>
					inBox(centre[0], centre[1], bbox) &&
					pointInGeom(centre[0], centre[1], geometry),
			);
			if (!town) continue;
			townOf.set(code, town.ref);
			wardsOf.set(town.ref.code, [
				...(wardsOf.get(town.ref.code) ?? []),
				{
					geography: "ward",
					release: wardRelease,
					code,
					name: resolver.area(identity)!.name as string,
				},
			]);
		}
		return { wardRelease, townOf, wardsOf };
	}

	// Each release's published area for every code, from the atlas's own
	// boundary properties, to tell when an area's boundary was redrawn.
	function readAreas(geography: PlaceGeography) {
		const areas = new Map<string, Map<string, number>>();
		const { folder, codeField } = GEOGRAPHY_SOURCES[geography];
		for (const release of readdirSync(join(BOUNDARIES, folder))) {
			const path = join(BOUNDARIES, folder, release, "properties.json");
			const { features } = JSON.parse(readFileSync(path, "utf8")) as {
				features: Record<string, unknown>[];
			};
			const byCode = new Map<string, number>();
			for (const feature of features) {
				const code = Object.entries(feature).find(([key]) =>
					new RegExp(`^${codeField}\\d{2}CD$`, "i").test(key),
				)?.[1];
				if (
					typeof code === "string" &&
					typeof feature.areaSqKm === "number"
				)
					byCode.set(code, feature.areaSqKm);
			}
			areas.set(release, byCode);
		}
		return areas;
	}

	const datasetsFor = readDatasetCoverage(readDataset);
	const populations = readPopulations(readDataset);

	// The atlas's maps pages: one per council, and one per curated named place.
	const mapsSlugByCode = new Map<string, string>();
	const mapsSlugByName = new Map<string, string>();
	const core = JSON.parse(
		readFileSync(
			join(artifactDirectory(ROOT), "source-data", "gazetteer.core.json"),
			"utf8",
		),
	) as {
		byCode: Record<string, { name: string; level: string }>;
		namedLocations: Record<string, unknown>;
	};
	const slugify = (name: string) =>
		name
			.toLowerCase()
			.replace(/&/g, " and ")
			.replace(/['’.]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
	for (const name of Object.keys(core.namedLocations))
		mapsSlugByName.set(name, slugify(name));
	for (const [code, area] of Object.entries(core.byCode))
		if (area.level === "localAuthority")
			mapsSlugByCode.set(code, slugify(area.name));

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
				newest.get(counterpart.geography) ===
				counterpart.boundaryRelease,
		);
	}

	function group(
		relationships: Relationship[],
		listed: boolean,
	): AreaGroup[] {
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
			...(listed &&
			(members.length <= LISTED_CHILDREN || ALWAYS_LISTED.has(geography))
				? {
						areas: members
							.map(ref)
							.sort((a, b) => a.name.localeCompare(b.name)),
					}
				: {}),
		}));
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

	const towns = townWards();

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
		const ending = current
			? undefined
			: covering[covering.indexOf(last) + 1]!;
		const { timeline, previousCouncil } = buildAreaTimeline({
			geography,
			code,
			releases,
			covering,
			areas,
			nameIn,
			relationshipsIn,
			lastRelationships,
			current,
			ending,
		});

		// What it sits within: as the newest release holding it places it, or
		// for an area that has ended, as releases nearest its end place it.
		const within = lastRelationships.filter(
			({ relation, counterpart }) =>
				relation === "within" && counterpart.geography !== geography,
		);
		const parents = current
			? newestPerGeography(within).map(ref)
			: [
					...new Set(
						within.map(({ counterpart }) => counterpart.geography),
					),
				]
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
					.filter(
						(parent): parent is AreaRef => parent !== undefined,
					);
		const town = towns.townOf.get(code);
		if (geography === "ward" && last === towns.wardRelease && town)
			parents.push(town);
		const namedPlaces: NamedRef[] | undefined =
			geography === "localAuthority"
				? resolver.namedLocationsForArea(identity(last)).map(namedRef)
				: undefined;

		if (geography === "localAuthority")
			addNamedPlaceEvents(
				timeline,
				resolver.namedLocations(),
				code,
				first,
				ending,
			);

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

		const polygons = polygonsOf(
			identity(last),
			GEOGRAPHY_SOURCES[geography].tier,
		);
		const dateOf = (event: TimelineEvent) =>
			"date" in event ? event.date : `${event.release.slice(0, 7)}-01`;
		return {
			type: "area",
			code,
			name: nameIn(last),
			geography,
			releases: releases.map((release) =>
				geographyReleases.indexOf(release),
			),
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
			children:
				geography === "majorTownAndCity" && towns.wardsOf.has(code)
					? [
							{
								geography: "ward",
								release: towns.wardRelease,
								count: towns.wardsOf.get(code)!.length,
								areas: towns.wardsOf
									.get(code)!
									.sort((a, b) =>
										a.name.localeCompare(b.name),
									),
							},
						]
					: group(
							lastRelationships.filter(
								({ relation }) => relation === "contains",
							),
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

	const outputs = new Map<string, string>();
	const index: Pick<PlaceIndex, "areas" | "named" | "releases"> = {
		areas: [],
		named: [],
		releases: Object.fromEntries(
			PLACE_GEOGRAPHIES.map((geography) => [geography, []]),
		) as unknown as PlaceIndex["releases"],
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
				buildLog.detail(
					`Built ${geography} profiles: ${formatCount(done)} of ${formatCount(codes.size)}`,
				);
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
		buildLog.info(
			`Built ${geography} profiles for ${formatCount(codes.size)} codes in ${formatCount(releases.length)} releases`,
		);
	}

	buildNamedPlaceProfiles({
		resolver,
		newestCouncilRelease: newestRelease("localAuthority"),
		councilNames,
		polygonsOf,
		mapsSlugByName,
		outputs,
		index,
	});

	return { outputs, index };
}
