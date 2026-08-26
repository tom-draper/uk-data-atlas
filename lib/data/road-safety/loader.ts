import { CustomDataset, CustomPoint } from "@/lib/types/custom";
import { parseCsv } from "@/lib/helpers/parseCsv";

const YEAR = 2025;
const ID = `roadSafety${YEAR}`;
const SOURCE =
	"transport/road-safety/dft-road-casualty-statistics-collision-provisional-2025.csv";

// DfT collision severity: 1 = Fatal, 2 = Serious, 3 = Slight. We invert it into a
// point "value" so the most severe collisions map to the top of the colour scale.
const SEVERITY_WEIGHT: Record<string, number> = { "1": 3, "2": 2, "3": 1 };

// These are categories rather than a continuous measure, so keep their visual
// treatment consistent regardless of the selected choropleth colour theme.
const SEVERITY_STYLE = {
	colorByValue: { 1: "#facc15", 2: "#f97316", 3: "#991b1b" },
	legend: [
		{ value: 3, label: "Fatal" },
		{ value: 2, label: "Serious" },
		{ value: 1, label: "Slight" },
	],
	radius: { min: 1.5, max: 3.5 },
};

// Coordinates are rounded to 5 dp (~1 m) to keep the precompiled payload compact.
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

// Loads the DfT road safety collision dataset as a point dataset. Reuses the
// custom point render path (kind: "points") so it exercises the coordinate map
// layer with real, national-scale data.
export async function loadRoadSafety(
	read: (path: string) => Promise<string>,
): Promise<Record<string, CustomDataset>> {
	const { data } = await parseCsv(await read(SOURCE), { header: true });

	const points: CustomPoint[] = [];
	for (const row of data as Record<string, string>[]) {
		const lng = parseFloat(row["longitude"]);
		const lat = parseFloat(row["latitude"]);
		if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

		const value = SEVERITY_WEIGHT[row["collision_severity"]?.trim()] ?? 1;
		points.push({ lng: round5(lng), lat: round5(lat), value });
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
		points,
		valueMin: 1,
		valueMax: 3,
		pointStyle: SEVERITY_STYLE,
	};

	return { [ID]: dataset };
}
