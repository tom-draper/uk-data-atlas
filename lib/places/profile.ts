/**
 * The format of the /places pages' data: one profile per place, compiled by
 * `pnpm places:build` from the API's geography resolver. A place is anything
 * a person might look up: an area such as a ward, council or constituency,
 * or a named place such as Greater Manchester or Kent.
 *
 * Area profiles are sharded by code so a page reads only a small file; named
 * places get a file each. The index lists every place, for search, the
 * sitemap and the pages built ahead of time.
 */

/** The geographies that have area profiles. */
export const PLACE_GEOGRAPHIES = [
	"localAuthority",
	"ward",
	"constituency",
] as const;

export type PlaceGeography = (typeof PLACE_GEOGRAPHIES)[number];

/**
 * A polygon or multipolygon, compacted: each polygon is a list of rings, and
 * each ring a flat list of longitude and latitude in ten-thousandths of a
 * degree, every point after the first stored as the step from the one before.
 * `decodeOutline` turns it back into GeoJSON coordinates.
 */
export type Outline = number[][][];

export type BoundingBox = [number, number, number, number];

/** Another area, named as the release that holds it names it. */
export type AreaRef = {
	geography: string;
	release: string;
	code: string;
	name: string;
};

/** A named place an area belongs to, such as a region or ceremonial county. */
export type NamedRef = { id: string; label: string; kind: string };

/**
 * One change in an area's history, dated by the boundary release it first
 * shows in. Release dates are when a file was published, not the legal date
 * of the change.
 */
export type TimelineEvent =
	| {
			kind: "first-published";
			release: string;
			/** The earliest release the archive holds, so the area may be older. */
			archiveStart: boolean;
	  }
	| {
			kind: "formed" | "gained";
			release: string;
			relation: string;
			areas: AreaRef[];
	  }
	| { kind: "renamed"; release: string; from: string; to: string }
	| { kind: "redrawn"; release: string; fromKm2: number; toKm2: number }
	| {
			kind: "parent-changed";
			release: string;
			geography: string;
			from: AreaRef | null;
			to: AreaRef | null;
	  }
	| {
			kind: "lost" | "ended";
			release: string;
			relation: string;
			areas: AreaRef[];
	  }
	| {
			kind: "joined" | "left";
			/** `YYYY-MM-DD`. */
			date: string;
			place: NamedRef;
	  };

export type DatasetCoverage = { slug: string; title: string; years: number[] };

export type AreaGroup = {
	geography: string;
	release: string;
	count: number;
	/** Listed only when the group is small enough to show. */
	areas?: AreaRef[];
};

export type AreaProfile = {
	type: "area";
	code: string;
	name: string;
	geography: PlaceGeography;
	/**
	 * The releases that hold this code, oldest first, as positions in the
	 * geography's list of releases (`PlaceIndex.releases`).
	 */
	releases: number[];
	/** Whether the newest release still holds the code. */
	current: boolean;
	areaKm2?: number;
	/** The latest population estimate published for the code itself. */
	population?: { value: number; year: number; dataset: string };
	bbox: BoundingBox;
	/** The outline in the newest release holding the code, generalised. */
	outline?: Outline;
	/** The areas it sits within, newest release of each geography. */
	parents: AreaRef[];
	/** The named places it belongs to; councils only, as a ward's are its council's. */
	namedPlaces?: NamedRef[];
	children: AreaGroup[];
	overlaps: AreaGroup[];
	/** Areas in the same release that share a border, longest border first. */
	neighbours: { code: string; name: string; sharedBorderM: number }[];
	/** Newest first. */
	timeline: TimelineEvent[];
	datasets: DatasetCoverage[];
	/** The atlas's own page of maps for the council, when it has one. */
	mapsSlug?: string;
};

export type NamedMember = {
	code: string;
	name: string;
	/** `YYYY-MM-DD`, or null when open-ended. */
	from: string | null;
	to: string | null;
	current: boolean;
};

export type NamedProfile = {
	type: "named";
	id: string;
	label: string;
	kind: string;
	/** Who defines it, in a sentence. */
	source: string;
	memberGeography: string;
	members: NamedMember[];
	/** Named places it falls within, such as a region's country. */
	within: NamedRef[];
	/** Named places within it, such as a country's regions. */
	contains: NamedRef[];
	bbox: BoundingBox;
	/** Current members' outlines, generalised, keyed by code. */
	outlines: Record<string, Outline>;
	mapsSlug?: string;
};

export type PlaceProfile = AreaProfile | NamedProfile;

/**
 * One row of the index: code or id, name, geography or kind, the council it
 * sits in (wards only), and the first and last years it was published.
 */
export type PlaceIndexEntry = [
	id: string,
	name: string,
	kind: string,
	parent: string | null,
	firstYear: number,
	lastYear: number | null,
];

export type PlaceIndex = {
	version: 1;
	/** A hash of every profile file, so a test can tell they match. */
	contentHash: string;
	/** Every release of each geography, oldest first. */
	releases: Record<PlaceGeography, string[]>;
	areas: PlaceIndexEntry[];
	named: PlaceIndexEntry[];
};

/** The shard an area code's profile is in. */
export const placeShard = (code: string) =>
	code.length > 4 ? code.slice(0, -2) : code.slice(0, 2);

/** Codes are upper case letters and digits; named place ids are slugs. */
export const isAreaCode = (id: string) => /^[A-Z0-9]{4,9}$/.test(id);

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/** `2025-05-uk-bgc-v2` → `May 2025`, as for any id or date led by year and month. */
export function releaseLabel(release: string) {
	const [year, month] = release.split("-");
	const name = MONTHS[Number(month) - 1];
	return name ? `${name} ${year}` : year;
}

export const releaseYear = (release: string) => Number(release.slice(0, 4));

/** The countries a release draws, from the extent in its id. */
const EXTENT_COUNTRIES: Record<string, string> = {
	uk: "EWSN",
	gb: "EWS",
	ew: "EW",
	en: "E",
	w: "W",
	sc: "S",
	ni: "N",
};

/** Whether a release draws the country an area code belongs to. */
export const releaseCovers = (release: string, code: string) =>
	!/^[EWSN]/.test(code) ||
	(EXTENT_COUNTRIES[release.split("-")[2] ?? "uk"] ?? "EWSN").includes(
		code[0]!,
	);

const SCALE = 1e4;

export function encodeOutline(polygons: number[][][][]): Outline {
	return polygons.map((rings) =>
		rings.map((ring) => {
			const flat: number[] = [];
			let [x0, y0] = [0, 0];
			for (const [x, y] of ring) {
				const [xi, yi] = [
					Math.round(x! * SCALE),
					Math.round(y! * SCALE),
				];
				if (flat.length > 0 && xi === x0 && yi === y0) continue;
				flat.push(xi - x0, yi - y0);
				[x0, y0] = [xi, yi];
			}
			return flat;
		}),
	);
}

/** An outline as GeoJSON multipolygon coordinates. */
export function decodeOutline(outline: Outline): number[][][][] {
	return outline.map((rings) =>
		rings.map((flat) => {
			const ring: number[][] = [];
			let [x, y] = [0, 0];
			for (let i = 0; i < flat.length; i += 2) {
				x += flat[i]!;
				y += flat[i + 1]!;
				ring.push([x / SCALE, y / SCALE]);
			}
			const [first, last] = [ring[0], ring.at(-1)];
			if (first && last && (first[0] !== last[0] || first[1] !== last[1]))
				ring.push([...first]);
			return ring;
		}),
	);
}
