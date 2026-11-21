import { sourceDir } from "@uk-data-atlas/datasets";
import { isMainModule } from "../lib/entrypoint.ts";
import { buildLog, formatCount, repoPath } from "@uk-data-atlas/atlas-db";
import { csvRecords } from "@uk-data-atlas/artifacts";
import {
	CODE_HISTORY_CHANGES_FILE as CHANGES_FILE,
	CODE_HISTORY_CODES_FILE as CODES_FILE,
	CODE_HISTORY_DIRECTORY as DIRECTORY,
} from "../storage/legalDates.ts";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fetch the ONS Code History Database and keep the two things the atlas needs
 * from it: the dated predecessor and successor pairs (`Changes.csv`) and the
 * date each code came into and went out of use (`ChangeHistory.csv`). These
 * give the legal effective date of an area change, which the release editions
 * alone cannot. The database is published under the Open Government Licence.
 */
const SOURCE_URL =
	"https://www.arcgis.com/sharing/rest/content/items/e0bc41722b1a4b76a6ecfff14f91cbb4/data";

/**
 * Entity codes the atlas holds areas for. Legacy codes (for example `00G` for
 * a pre-2009 ward) are kept by shape, because their entity is a two digit
 * county code and one letter.
 */
const ENTITIES = new Set([
	"E05",
	"W05",
	"S13",
	"N08",
	"E06",
	"E07",
	"E08",
	"E09",
	"W06",
	"S12",
	"N09",
	"E14",
	"W07",
	"S14",
	"N06",
	"N05",
	"S16",
	"E01",
	"W01",
	"S01",
	"E02",
	"W02",
	"S02",
	"E00",
	"W00",
	"E04",
	"W04",
	"E43",
]);
const LEGACY_ENTITY = /^\d\d[A-Z]$/;

export const keepEntity = (entity: string) =>
	ENTITIES.has(entity) || LEGACY_ENTITY.test(entity);

/** `dd/mm/yyyy hh:mm` to `yyyy-mm-dd`, or an empty string when absent or invalid. */
export const isoDate = (value: string) => {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/.exec(value.trim());
	if (!match) return "";
	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);
	if (month < 1 || month > 12 || day < 1 || day > 31) return "";
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const columnIndex = (header: string[] | undefined, required: string[]) => {
	const columns = Object.fromEntries(
		(header ?? []).map((name, index) => [name.trim(), index]),
	);
	for (const name of required)
		if (columns[name] === undefined)
			throw new Error(`The code history file has no ${name} column.`);
	return columns as Record<string, number>;
};

export type CodeChange = {
	predecessor: string;
	successor: string;
	date: string;
	entity: string;
};

export type CodeDates = {
	code: string;
	introduced: string;
	terminated: string;
	entity: string;
};

/** Dated predecessor and successor pairs from `Changes.csv`, deduplicated and sorted. */
export const parseChanges = (text: string): CodeChange[] => {
	const [header, ...rows] = csvRecords(text);
	const columns = columnIndex(header, [
		"GEOGCD",
		"GEOGCD_P",
		"OPER_DATE",
		"ENTITYCD",
	]);
	const seen = new Map<string, CodeChange>();
	for (const row of rows) {
		const successor = (row[columns.GEOGCD!] ?? "").trim();
		const predecessor = (row[columns.GEOGCD_P!] ?? "").trim();
		const entity = (row[columns.ENTITYCD!] ?? "").trim();
		const date = isoDate(row[columns.OPER_DATE!] ?? "");
		if (!successor || !predecessor || successor === predecessor) continue;
		if (!date || !keepEntity(entity)) continue;
		seen.set(`${predecessor}|${successor}|${date}`, {
			predecessor,
			successor,
			date,
			entity,
		});
	}
	return [...seen.values()].sort(
		(left, right) =>
			left.predecessor.localeCompare(right.predecessor) ||
			left.successor.localeCompare(right.successor) ||
			left.date.localeCompare(right.date),
	);
};

/** When each code came into and went out of use, from `ChangeHistory.csv`. */
export const parseCodes = (text: string): CodeDates[] => {
	const [header, ...rows] = csvRecords(text);
	const columns = columnIndex(header, [
		"GEOGCD",
		"OPER_DATE",
		"TERM_DATE",
		"ENTITYCD",
	]);
	const seen = new Map<string, CodeDates>();
	for (const row of rows) {
		const code = (row[columns.GEOGCD!] ?? "").trim();
		const entity = (row[columns.ENTITYCD!] ?? "").trim();
		if (!code || !keepEntity(entity)) continue;
		const introduced = isoDate(row[columns.OPER_DATE!] ?? "");
		const terminated = isoDate(row[columns.TERM_DATE!] ?? "");
		if (!introduced && !terminated) continue;
		const previous = seen.get(code);
		// A code can have several rows, so keep the earliest introduction and
		// the latest termination, and no termination while any row is open.
		const earliest = [previous?.introduced, introduced]
			.filter(Boolean)
			.sort()[0];
		const open = previous ? !previous.terminated : false;
		const latest = [previous?.terminated, terminated]
			.filter(Boolean)
			.sort()
			.at(-1);
		seen.set(code, {
			code,
			entity,
			introduced: earliest ?? "",
			terminated: open || !terminated ? "" : (latest ?? ""),
		});
	}
	return [...seen.values()].sort((left, right) =>
		left.code.localeCompare(right.code),
	);
};

const csvField = (value: string) =>
	/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export const changesToCsv = (changes: readonly CodeChange[]) =>
	`${[
		"predecessor,successor,date,entity",
		...changes.map((change) =>
			[change.predecessor, change.successor, change.date, change.entity]
				.map(csvField)
				.join(","),
		),
	].join("\n")}\n`;

export const codesToCsv = (codes: readonly CodeDates[]) =>
	`${[
		"code,introduced,terminated,entity",
		...codes.map((code) =>
			[code.code, code.introduced, code.terminated, code.entity]
				.map(csvField)
				.join(","),
		),
	].join("\n")}\n`;

/** The CSVs in the archive are Windows-1252, which `latin1` decodes without loss. */
const archiveFile = (archive: string, name: string) => {
	try {
		return execFileSync("unzip", ["-p", archive, name], {
			encoding: "latin1",
			maxBuffer: 200 * 1024 * 1024,
		});
	} catch (error) {
		// Some confined build runners report an execution error after `unzip`
		// has nevertheless completed successfully and returned its stdout.
		const result = error as { status?: number; stdout?: unknown };
		if (result.status === 0 && typeof result.stdout === "string")
			return result.stdout;
		throw error;
	}
};

export const extractOnsCodeHistory = (
	repositoryRoot: string,
	archive: string,
	retrieved = new Date().toISOString().slice(0, 10),
) => {
	const changes = parseChanges(archiveFile(archive, "Changes.csv"));
	const codes = parseCodes(archiveFile(archive, "ChangeHistory.csv"));
	const directory = join(
		repositoryRoot,
		"data/source",
		sourceDir("lookups", DIRECTORY),
	);
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, CHANGES_FILE), changesToCsv(changes));
	writeFileSync(join(directory, CODES_FILE), codesToCsv(codes));
	writeFileSync(
		join(directory, "meta.json"),
		`${JSON.stringify(
			{
				id: "2026-06-uk",
				kind: "lookup",
				title: "Area code change dates",
				description:
					"Legal operative dates of area code changes and of the first and last use of each code, extracted from the ONS Code History Database for wards, local authorities, constituencies, statistical areas and parishes.",
				publisher: "Office for National Statistics",
				sourceUrl: SOURCE_URL,
				retrieved,
				temporalCoverage: "2009-01-01/2026-06-30",
				licence: {
					name: "Open Government Licence v3.0",
					url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
				},
				files: [
					{
						path: CHANGES_FILE,
						role: "source",
						note: `Predecessor, successor and operative date from Changes.csv; ${changes.length} dated pairs.`,
					},
					{
						path: CODES_FILE,
						role: "source",
						note: `First and last operative date of each code from ChangeHistory.csv; ${codes.length} codes.`,
					},
				],
			},
			null,
			"\t",
		)}\n`,
	);
	return { directory, changes: changes.length, codes: codes.length };
};

const download = async () => {
	const response = await fetch(SOURCE_URL);
	if (!response.ok)
		throw new Error(
			`${response.status} ${response.statusText} for ${SOURCE_URL}`,
		);
	const directory = mkdtempSync(join(tmpdir(), "code-history-"));
	const archive = join(directory, "code-history.zip");
	await writeFile(archive, Buffer.from(await response.arrayBuffer()));
	return { archive, directory };
};

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const [local] = process.argv.slice(2);
	const downloaded = local ? undefined : await download();
	try {
		const result = extractOnsCodeHistory(
			repositoryRoot,
			local ?? downloaded!.archive,
		);
		buildLog.info(
			`Wrote ${formatCount(result.changes)} changes and ${formatCount(result.codes)} codes to ${repoPath(result.directory)}`,
		);
	} finally {
		if (downloaded)
			rmSync(downloaded.directory, { recursive: true, force: true });
	}
}
