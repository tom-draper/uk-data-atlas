import type { DatasetReader } from "../catalog/types.ts";
import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";

export const ROAD_COLLISION_SOURCES = [
	sourceDir(
		"road-collisions",
		"dft-road-casualty-statistics-collision-2024.csv",
	),
	sourceDir(
		"road-collisions",
		"dft-road-casualty-statistics-collision-2025.csv",
	),
] as const;

const SEVERITY: Record<string, "fatal" | "serious" | "slight"> = {
	"1": "fatal",
	"2": "serious",
	"3": "slight",
};

type Counts = {
	collisions: number;
	fatal: number;
	serious: number;
	slight: number;
};

const count = (
	counts: Map<string, Counts>,
	code: string,
	severity: "fatal" | "serious" | "slight",
) => {
	let entry = counts.get(code);
	if (!entry)
		counts.set(
			code,
			(entry = { collisions: 0, fatal: 0, serious: 0, slight: 0 }),
		);
	entry.collisions += 1;
	entry[severity] += 1;
};

const records = (counts: Map<string, Counts>): DirectRecord[] =>
	[...counts].map(([code, entry]) => ({
		code,
		values: (["collisions", "fatal", "serious", "slight"] as const).map(
			(severity) => ({
				measure: "road-collisions",
				members: { "collision-severity": severity },
				value: entry[severity],
			}),
		),
	}));

/**
 * One final annual DfT edition as a part keyed by its year. Collisions are
 * counted by the authority DfT assigns each to, `local_authority_ons_district`,
 * and by the LSOA of the collision where it has one. A collision whose
 * authority is not a code, such as `EHEATHROW` for the airport, or that has
 * no LSOA, has no area to sit on and is left out of that set.
 */
async function readEdition(
	read: DatasetReader["csvRows"],
	source: string,
): Promise<DirectPart> {
	const authorities = new Map<string, Counts>();
	const lsoas = new Map<string, Counts>();
	const months = new Set<string>();
	let year: number | undefined;
	await read(source, {}, (row) => {
		const code = row["local_authority_ons_district"]?.trim() ?? "";
		const severity = SEVERITY[row["collision_severity"]?.trim() ?? ""];
		const [, , month, rowYear] =
			/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row["date"]?.trim() ?? "") ?? [];
		if (!severity || !month || !rowYear)
			throw new Error(
				`${source}: collision ${row["collision_index"]} has no recognised severity or date`,
			);
		if (year !== undefined && Number(rowYear) !== year)
			throw new Error(`${source}: collisions span more than one year`);
		year = Number(rowYear);
		months.add(month);
		const lsoaCode = row["lsoa_of_accident_location"]?.trim() ?? "";
		if (/^[EW]01\d{6}$/.test(lsoaCode)) count(lsoas, lsoaCode, severity);
		if (/^[EWS]\d{8}$/.test(code)) count(authorities, code, severity);
	});
	if (year === undefined) throw new Error(`${source}: no collisions`);
	const covered = [...months].map(Number).sort((left, right) => left - right);
	const first = covered[0];
	const last = covered.at(-1);
	if (!first || !last || covered.length !== last - first + 1)
		throw new Error(`${source}: the months covered are not consecutive`);
	return {
		key: String(year),
		records: records(authorities),
		recordSets: { lsoas: records(lsoas) },
	};
}

/**
 * Reads each final annual DfT edition separately. A year is kept in its own
 * part so a later revision cannot be mistaken for an earlier observation or
 * merged into a provisional half-year. Each annual file retains its own
 * local-authority code vintage; its LSOA codes resolve against the December
 * 2021 release.
 */
export async function roadCollisionsStatisticsParts(
	read: DatasetReader["csvRows"],
): Promise<DirectPart[]> {
	const parts: DirectPart[] = [];
	for (const source of ROAD_COLLISION_SOURCES) {
		const part = await readEdition(read, source);
		if (parts.some(({ key }) => key === part.key))
			throw new Error(
				`Road collision sources contain duplicate years: ${part.key}.`,
			);
		parts.push(part);
	}
	return parts;
}
