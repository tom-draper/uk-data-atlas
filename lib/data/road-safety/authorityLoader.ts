import type {
	RoadCollisionsDataset,
	RoadCollisionsLADData,
} from "@/lib/types/roadCollisions";
import { parseCsv } from "@/lib/helpers/parseCsv";

const SOURCE =
	"transport/road-safety/dft-road-casualty-statistics-collision-provisional-2025.csv";
// The authority codes in the file resolve against the 2024 releases.
const BOUNDARY_YEAR = 2024;
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
const SEVERITY: Record<string, "fatal" | "serious" | "slight"> = {
	"1": "fatal",
	"2": "serious",
	"3": "slight",
};

/**
 * Counts reported collisions in each local authority by the authority DfT
 * assigns each collision to, `local_authority_ons_district`, rather than by
 * placing coordinates in boundaries. A value that is not an authority code,
 * such as `EHEATHROW` for the airport, is counted in `excluded`.
 */
export async function loadRoadCollisionsByAuthority(
	read: (path: string) => Promise<string>,
): Promise<Record<string, RoadCollisionsDataset>> {
	const { data } = await parseCsv(await read(SOURCE), { header: true });
	const records: Record<string, RoadCollisionsLADData> = {};
	const excluded = new Map<string, number>();
	const months = new Set<string>();
	let year: number | undefined;
	for (const row of data as Record<string, string>[]) {
		const code = row["local_authority_ons_district"]?.trim() ?? "";
		const severity = SEVERITY[row["collision_severity"]?.trim() ?? ""];
		const [, , month, rowYear] =
			/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row["date"]?.trim() ?? "") ?? [];
		if (!severity || !month || !rowYear) {
			throw new Error(
				`${SOURCE}: collision ${row["collision_index"]} has no recognised severity or date`,
			);
		}
		if (year !== undefined && Number(rowYear) !== year) {
			throw new Error(`${SOURCE}: collisions span more than one year`);
		}
		year = Number(rowYear);
		months.add(month);
		if (!/^[EWS]\d{8}$/.test(code)) {
			excluded.set(code, (excluded.get(code) ?? 0) + 1);
			continue;
		}
		const record = (records[code] ??= {
			ladCode: code,
			collisions: 0,
			fatal: 0,
			serious: 0,
			slight: 0,
		});
		record.collisions += 1;
		record[severity] += 1;
	}
	if (year === undefined) throw new Error(`${SOURCE}: no collisions`);
	const covered = [...months].map(Number).sort((left, right) => left - right);
	const first = covered[0];
	const last = covered.at(-1);
	if (!first || !last || covered.length !== last - first + 1) {
		throw new Error(`${SOURCE}: the months covered are not consecutive`);
	}
	return {
		[year]: {
			id: `roadCollisions${year}`,
			type: "roadCollisions",
			year,
			period: `${MONTHS[first - 1]} to ${MONTHS[last - 1]} ${year}`,
			boundaryType: "localAuthority",
			boundaryYear: BOUNDARY_YEAR,
			data: records,
			excluded: [...excluded]
				.map(([code, collisions]) => ({ code, collisions }))
				.sort((left, right) => left.code.localeCompare(right.code)),
		},
	};
}
