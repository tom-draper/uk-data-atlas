import type {
	RoadCollisionCounts,
	RoadCollisionsDataset,
	RoadCollisionsLADData,
	RoadCollisionsLSOAData,
} from "@/lib/types/roadCollisions";
import { parseCsv } from "@/lib/helpers/parseCsv";

const SOURCES = [
	"transport/road-safety/dft-road-casualty-statistics-collision-2024.csv",
	"transport/road-safety/dft-road-casualty-statistics-collision-2025.csv",
] as const;
// Each annual file retains its own local-authority code vintage; its LSOA
// codes resolve against the December 2021 release.
const LSOA_BOUNDARY_YEAR = 2021;
const NATIONS: Record<string, string> = {
	E: "GB-ENG",
	W: "GB-WLS",
	S: "GB-SCT",
};

const count = (
	record: RoadCollisionCounts,
	severity: "fatal" | "serious" | "slight",
) => {
	record.collisions += 1;
	record[severity] += 1;
};
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
const compileRoadCollisions = async (
	read: (path: string) => Promise<string>,
	source: string,
): Promise<RoadCollisionsDataset> => {
	const { data } = await parseCsv(await read(source), { header: true });
	const records: Record<string, RoadCollisionsLADData> = {};
	const lsoas: Record<string, RoadCollisionsLSOAData> = {};
	const withoutLsoa: Record<string, number> = {};
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
				`${source}: collision ${row["collision_index"]} has no recognised severity or date`,
			);
		}
		if (year !== undefined && Number(rowYear) !== year) {
			throw new Error(`${source}: collisions span more than one year`);
		}
		year = Number(rowYear);
		months.add(month);
		const lsoaCode = row["lsoa_of_accident_location"]?.trim() ?? "";
		if (/^[EW]01\d{6}$/.test(lsoaCode)) {
			count(
				(lsoas[lsoaCode] ??= {
					lsoaCode,
					collisions: 0,
					fatal: 0,
					serious: 0,
					slight: 0,
				}),
				severity,
			);
		} else {
			const nation = NATIONS[code[0] ?? ""] ?? "unknown";
			withoutLsoa[nation] = (withoutLsoa[nation] ?? 0) + 1;
		}
		if (!/^[EWS]\d{8}$/.test(code)) {
			excluded.set(code, (excluded.get(code) ?? 0) + 1);
			continue;
		}
		count(
			(records[code] ??= {
				ladCode: code,
				collisions: 0,
				fatal: 0,
				serious: 0,
				slight: 0,
			}),
			severity,
		);
	}
	if (year === undefined) throw new Error(`${source}: no collisions`);
	const covered = [...months].map(Number).sort((left, right) => left - right);
	const first = covered[0];
	const last = covered.at(-1);
	if (!first || !last || covered.length !== last - first + 1) {
		throw new Error(`${source}: the months covered are not consecutive`);
	}
	return {
		id: `roadCollisions${year}`,
		type: "roadCollisions",
		year,
		period: `${MONTHS[first - 1]} to ${MONTHS[last - 1]} ${year}`,
		boundaryType: "localAuthority",
		boundaryYear: year,
		data: records,
		excluded: [...excluded]
			.map(([code, collisions]) => ({ code, collisions }))
			.sort((left, right) => left.code.localeCompare(right.code)),
		lsoaBoundaryYear: LSOA_BOUNDARY_YEAR,
		lsoas,
		withoutLsoa,
	};
};

/**
 * Compiles each final annual DfT edition separately. A year is kept in its
 * own source partition so a later revision cannot be mistaken for an earlier
 * observation or merged into a provisional half-year.
 */
export async function loadRoadCollisionsByAuthority(
	read: (path: string) => Promise<string>,
): Promise<Record<string, RoadCollisionsDataset>> {
	const datasets = await Promise.all(
		SOURCES.map((source) => compileRoadCollisions(read, source)),
	);
	const duplicateYears = datasets.filter(
		(dataset, index) =>
			datasets.findIndex(
				(candidate) => candidate.year === dataset.year,
			) !== index,
	);
	if (duplicateYears.length > 0)
		throw new Error(
			`Road collision sources contain duplicate years: ${[...new Set(duplicateYears.map((dataset) => dataset.year))].join(", ")}.`,
		);
	return Object.fromEntries(
		datasets.map((dataset) => [String(dataset.year), dataset]),
	);
}
