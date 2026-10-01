import { CustomDataset, CustomPoint, PointSummary } from "@/lib/types/custom";
import { parseCsv } from "@/lib/helpers/parseCsv";
import type { Gazetteer } from "@/lib/data/gazetteer/gazetteer";

const YEAR = 2025;
const ID = `roadSafety${YEAR}`;
const SOURCE =
	"transport/road-safety/dft-road-casualty-statistics-collision-provisional-2025.csv";

// DfT collision severity: 1 = Fatal, 2 = Serious, 3 = Slight. We invert it into a
// point "value" so the most severe collisions map to the top of the colour scale.
const SEVERITY_WEIGHT: Record<string, number> = { "1": 3, "2": 2, "3": 1 };
const SEVERITY_LABEL: Record<string, string> = {
	"1": "Fatal",
	"2": "Serious",
	"3": "Slight",
};
const ROAD_TYPE: Record<string, string> = {
	"1": "Roundabout",
	"2": "One-way street",
	"3": "Dual carriageway",
	"6": "Single carriageway",
	"7": "Slip road",
	"9": "Unknown",
	"12": "One-way street / slip road",
};
const AREA_TYPE: Record<string, string> = {
	"1": "Urban",
	"2": "Rural",
	"3": "Unallocated",
};

// These values are sampled along the active heatmap theme: Slight at its low
// end, Serious in the middle and Fatal at its high end.
const SEVERITY_STYLE = {
	legend: [
		{ value: 3, label: "Fatal" },
		{ value: 2, label: "Serious" },
		{ value: 1, label: "Slight" },
	],
	tooltip: {
		title: "Road collision",
		fields: [
			"Severity",
			"When",
			"Casualties",
			"Vehicles",
			"Speed limit",
			"Road type",
			"Area",
		],
	},
	radius: { min: 1.5, max: 3.5 },
};

// Coordinates are rounded to 5 dp (~1 m) to keep the precompiled payload compact.
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * DfT assigns collisions at Heathrow to `EHEATHROW` rather than to a local
 * authority. The airport lies wholly within Hillingdon, so for placing those
 * collisions in named locations they are treated as Hillingdon's.
 */
const LOCATION_AREA_CODES: Record<string, string> = {
	EHEATHROW: "E09000017",
};

const COUNTRY_PREFIXES: Record<string, string> = {
	England: "E",
	Scotland: "S",
	Wales: "W",
	"Northern Ireland": "N",
};

type Bounds = [number, number, number, number];

const inBounds = (point: CustomPoint, [west, south, east, north]: Bounds) =>
	point.lng >= west &&
	point.lng <= east &&
	point.lat >= south &&
	point.lat <= north;

/**
 * What the card shows for each named location, counted the same way the client
 * does once the points load. Coded points make up almost every DfT collision,
 * so index locations by their code membership and assign each point once rather
 * than filtering the national point set once per location. Uncoded points and
 * locations with no members retain the client's bounding-box behaviour.
 */
const summariseByLocation = (points: CustomPoint[], gazetteer: Gazetteer) => {
	const locations = gazetteer.namedLocations().flatMap((name) => {
		const bounds = gazetteer.boundsOf(name);
		return bounds
			? [{ name, bounds, members: gazetteer.membersOf(name) }]
			: [];
	});
	const summaries = new Map<string, { count: number; total: number }>(
		locations.map(({ name }) => [name, { count: 0, total: 0 }]),
	);
	const locationsByAreaCode = new Map<string, string[]>();
	const countryLocations = new Map<string, string>();
	const boundsOnlyLocations: Array<{ name: string; bounds: Bounds }> = [];

	for (const { name, bounds, members } of locations) {
		if (name === "United Kingdom") continue;
		const prefix = COUNTRY_PREFIXES[name];
		if (prefix) {
			countryLocations.set(prefix, name);
			continue;
		}
		if (members.length === 0) {
			boundsOnlyLocations.push({ name, bounds });
			continue;
		}
		for (const code of members) {
			const names = locationsByAreaCode.get(code) ?? [];
			names.push(name);
			locationsByAreaCode.set(code, names);
		}
	}

	const add = (name: string, point: CustomPoint) => {
		const summary = summaries.get(name);
		if (!summary) return;
		summary.count += 1;
		summary.total += point.value;
	};

	for (const point of points) {
		if (!point.areaCode) {
			if (summaries.has("United Kingdom")) add("United Kingdom", point);
			for (const { name, bounds } of locations)
				if (name !== "United Kingdom" && inBounds(point, bounds))
					add(name, point);
			continue;
		}

		if (summaries.has("United Kingdom")) add("United Kingdom", point);
		const country = countryLocations.get(point.areaCode[0]!);
		if (country) add(country, point);
		for (const name of locationsByAreaCode.get(point.areaCode) ?? [])
			add(name, point);
		for (const { name, bounds } of boundsOnlyLocations)
			if (inBounds(point, bounds)) add(name, point);
	}

	return Object.fromEntries(
		[...summaries].map(([name, { count, total }]) => [
			name,
			{
				count,
				// Three decimal places is well beyond the one the card renders.
				averageValue:
					count > 0 ? Math.round((total / count) * 1e3) / 1e3 : 0,
			},
		]),
	) as Record<string, PointSummary>;
};

export interface RoadSafetyCompilation {
	/** The card's dataset, small enough to fetch on every page load. */
	datasets: Record<string, CustomDataset>;
	/** The collisions themselves, fetched only once the dataset is selected. */
	points: Record<string, CustomPoint[]>;
}

// Loads the DfT road safety collision dataset as a point dataset. Reuses the
// custom point render path (kind: "points") so it exercises the coordinate map
// layer with real, national-scale data.
export async function loadRoadSafety(
	read: (path: string) => Promise<string>,
	gazetteer: Gazetteer,
): Promise<RoadSafetyCompilation> {
	const { data } = await parseCsv(await read(SOURCE), { header: true });

	const points: CustomPoint[] = [];
	for (const row of data as Record<string, string>[]) {
		const lng = parseFloat(row["longitude"]);
		const lat = parseFloat(row["latitude"]);
		if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

		const severityCode = row["collision_severity"]?.trim() ?? "3";
		const value = SEVERITY_WEIGHT[severityCode] ?? 1;
		const speedLimit = row["speed_limit"]?.trim();
		const assigned = row["local_authority_ons_district"]?.trim();
		const areaCode = assigned
			? (LOCATION_AREA_CODES[assigned] ?? assigned)
			: undefined;
		points.push({
			...(areaCode ? { areaCode } : {}),
			lng: round5(lng),
			lat: round5(lat),
			value,
			details: [
				SEVERITY_LABEL[severityCode] ?? "Slight",
				`${row.date?.trim() || "Not recorded"} at ${row.time?.trim() || "unknown time"}`,
				row["number_of_casualties"]?.trim() || "Not recorded",
				row["number_of_vehicles"]?.trim() || "Not recorded",
				speedLimit && speedLimit !== "-1"
					? `${speedLimit} mph`
					: "Not recorded",
				ROAD_TYPE[row["road_type"]?.trim()] ?? "Not recorded",
				AREA_TYPE[row["urban_or_rural_area"]?.trim()] ?? "Not recorded",
			],
		});
	}

	const dataset: CustomDataset = {
		id: ID,
		type: "custom",
		kind: "points",
		name: `Road Safety Collisions ${YEAR}`,
		dataColumn: `Road Safety Collisions [${YEAR}]`,
		year: YEAR,
		boundaryType: "ward",
		boundaryYear: 0,
		data: {},
		pointSummaries: summariseByLocation(points, gazetteer),
		valueMin: 1,
		valueMax: 3,
		pointStyle: SEVERITY_STYLE,
	};

	return { datasets: { [ID]: dataset }, points: { [ID]: points } };
}
