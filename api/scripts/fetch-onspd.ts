import { createHash } from "node:crypto";
import {
	createReadStream,
	createWriteStream,
	mkdirSync,
	mkdtempSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

/**
 * Download the latest ONS Postcode Directory, remove Northern Ireland rows
 * before anything enters data/, and retain only the fields the API compiles.
 * The resulting permitted source can be included in the public data release.
 */
const SEARCH = "https://www.arcgis.com/sharing/rest/search";
const ITEMS = "https://www.arcgis.com/sharing/rest/content/items";
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
const TITLE = /^ONS Postcode Directory \((\w+) (\d{4})\)(?: for the UK)?$/;
const COLUMNS = [
	"pcds",
	"dointr",
	"doterm",
	"usrtypind",
	"east1m",
	"north1m",
	"gridind",
] as const;

type Item = { id: string; title: string; name: string; size: number };

const fetchJson = async (url: string) => {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`${response.status} ${response.statusText} for ${url}`);
	return (await response.json()) as Record<string, any>;
};

const latestEdition = async () => {
	const query = new URLSearchParams({
		q: 'owner:ONSGeography_data type:"CSV Collection" title:"ONS Postcode Directory"',
		num: "50",
		sortField: "modified",
		sortOrder: "desc",
		f: "json",
	});
	const { results } = await fetchJson(`${SEARCH}?${query}`);
	const editions = (results as Array<Record<string, any>>).flatMap((item) => {
		const match = TITLE.exec(String(item.title));
		const monthIndex = match ? MONTHS.indexOf(match[1]!) : -1;
		return match && monthIndex !== -1
			? [
					{
						edition: `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}`,
						id: String(item.id),
					},
				]
			: [];
	});
	const latest = editions.sort((left, right) =>
		right.edition.localeCompare(left.edition),
	)[0];
	if (!latest) throw new Error("No ONS Postcode Directory CSV found");
	const item = (await fetchJson(`${ITEMS}/${latest.id}?f=json`)) as Item;
	return { edition: latest.edition, item };
};

const fileSha256 = (path: string) =>
	new Promise<string>((done, fail) => {
		const hash = createHash("sha256");
		createReadStream(path)
			.on("data", (chunk) => hash.update(chunk))
			.on("end", () => done(hash.digest("hex")))
			.on("error", fail);
	});

const quoteCsv = (value: string) =>
	/[\",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

async function writePermittedSource(archivePath: string, outputPath: string) {
	const unzip = spawn("unzip", ["-p", archivePath, "Data/ONSPD_*_UK.csv"], {
		stdio: ["ignore", "pipe", "inherit"],
	});
	const exited = new Promise<number>((done, fail) => {
		unzip.on("error", fail);
		unzip.on("close", (code) => done(code ?? 1));
	});
	let header: string[] | undefined;
	let positions: number[] = [];
	let country = -1;
	let countryColumn = "";
	let kept = 0;
	const rows = async function* () {
		for await (const line of createInterface({ input: unzip.stdout })) {
			const cells = line
				.split(",")
				.map((cell) => cell.replace(/^"|"$/g, ""));
			if (!header) {
				header = cells;
				positions = COLUMNS.map((column) => header!.indexOf(column));
				country = header.findIndex((column) =>
					/^ctry\d{2}cd$/.test(column),
				);
				countryColumn = header[country] ?? "";
				const missing = COLUMNS.filter((_, at) => positions[at] === -1);
				if (missing.length > 0 || country === -1)
					throw new Error(
						`The directory has no ${[...missing, "ctry"].join(", ")} column`,
					);
				yield `${[...COLUMNS, countryColumn].join(",")}\n`;
				continue;
			}
			if (cells.length !== header.length)
				throw new Error(
					`Unexpected ONSPD row width: ${cells.length}, expected ${header.length}`,
				);
			if (cells[country]?.startsWith("N")) continue;
			const selected = [
				...positions.map((at) => cells[at]!),
				cells[country]!,
			];
			kept += 1;
			yield `${selected.map(quoteCsv).join(",")}\n`;
		}
	};
	const temporaryPath = `${outputPath}.${process.pid}.tmp`;
	try {
		await pipeline(
			Readable.from(rows()),
			createGzip(),
			createWriteStream(temporaryPath),
		);
		const code = await exited;
		if (code !== 0) throw new Error(`unzip exited with ${code}`);
		if (kept === 0)
			throw new Error("The ONSPD source contained no permitted rows.");
		renameSync(temporaryPath, outputPath);
	} finally {
		rmSync(temporaryPath, { force: true });
	}
	return kept;
}

export const fetchOnspd = async (
	repositoryRoot: string,
	retrieved = new Date().toISOString().slice(0, 10),
) => {
	const { edition, item } = await latestEdition();
	const directory = join(
		repositoryRoot,
		"data",
		"postcodes",
		"onspd",
		`${edition}-uk`,
	);
	mkdirSync(directory, { recursive: true });
	const archive = join(
		mkdtempSync(join(tmpdir(), "atlas-onspd-")),
		item.name,
	);
	const sourceUrl = `${ITEMS}/${item.id}/data`;
	const sourcePath = join(directory, "onspd-permitted.csv.gz");
	const pendingSourcePath = `${sourcePath}.${process.pid}.tmp`;
	try {
		const response = await fetch(sourceUrl);
		if (!response.ok)
			throw new Error(
				`${response.status} ${response.statusText} for ${sourceUrl}`,
			);
		await writeFile(archive, Buffer.from(await response.arrayBuffer()));
		if (statSync(archive).size !== item.size)
			throw new Error(`${item.name}: expected ${item.size} bytes`);
		const includedRows = await writePermittedSource(
			archive,
			pendingSourcePath,
		);
		const sourceHash = await fileSha256(pendingSourcePath);
		const meta = {
			id: `${edition}-uk`,
			kind: "postcode-directory",
			title: item.title,
			description:
				"Current and terminated postcodes from the ONS Postcode Directory, with Northern Ireland rows removed before storage, and the grid reference of each postcode centroid.",
			publisher: "Office for National Statistics",
			sourceUrl,
			retrieved,
			temporalCoverage: edition,
			licence: {
				name: "Open Government Licence v3.0",
				url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
				note: "Northern Ireland (BT) postcode rows are excluded because Land and Property Services licenses them for internal business use only.",
			},
			attribution: [
				"Contains OS data © Crown copyright and database right",
				"Contains Royal Mail data © Royal Mail copyright and database right",
				"Source: Office for National Statistics licensed under the Open Government Licence v.3.0",
			],
			files: [
				{
					path: "onspd-permitted.csv.gz",
					role: "source",
					sha256: sourceHash,
					note: `Only permitted non-Northern Ireland rows and fields required by the API; ${includedRows} rows.`,
				},
			],
		};
		renameSync(pendingSourcePath, sourcePath);
		writeFileSync(
			join(directory, `meta.json.${process.pid}.tmp`),
			`${JSON.stringify(meta, null, "\t")}\n`,
		);
		renameSync(
			join(directory, `meta.json.${process.pid}.tmp`),
			join(directory, "meta.json"),
		);
		return { directory, edition };
	} finally {
		rmSync(pendingSourcePath, { force: true });
		rmSync(join(directory, `meta.json.${process.pid}.tmp`), {
			force: true,
		});
		rmSync(dirname(archive), { recursive: true, force: true });
	}
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const { directory, edition } = await fetchOnspd(
		resolve(dirname(scriptPath), "../.."),
	);
	console.log(`ONS Postcode Directory ${edition} is in ${directory}`);
}
