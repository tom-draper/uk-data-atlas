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

// These are categories rather than a continuous measure, so keep their visual
// treatment consistent regardless of the selected choropleth colour theme.
const SEVERITY_STYLE = {
	colorByValue: { 1: "#facc15", 2: "#f97316", 3: "#991b1b" },
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
 * What the card shows for each named location, counted the same way the client
 * would: every point inside the location's bounding box, as `getPointsInBounds`
 * selects them. Precomputing it is what lets the 6 MB point file stay unfetched
 * until someone selects the dataset.
 */
const summariseByLocation = (
	points: readonly CustomPoint[],
	gazetteer: Gazetteer,
): Record<string, PointSummary> => {
	const locations = gazetteer.namedLocations().flatMap((name) => {
		const bbox = gazetteer.boundsOf(name);
		return bbox ? [{ name, bbox, count: 0, total: 0 }] : [];
	});

	for (const point of points) {
		for (const location of locations) {
			const [west, south, east, north] = location.bbox;
			if (
				point.lng >= west &&
				point.lng <= east &&
				point.lat >= south &&
				point.lat <= north
			) {
				location.count++;
				location.total += point.value;
			}
		}
	}

	return Object.fromEntries(
		locations.map(({ name, count, total }) => [
			name,
			{
				count,
				// Three decimal places is well beyond the one the card renders.
				averageValue:
					count > 0 ? Math.round((total / count) * 1e3) / 1e3 : 0,
			},
		]),
	);
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
		points.push({
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
