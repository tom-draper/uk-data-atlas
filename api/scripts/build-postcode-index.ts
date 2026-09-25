import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import {
	compilePostcodeIndex,
	type PostcodeSource,
	type PostcodeSourceRow,
} from "../src/postcodes";

/**
 * Compile the newest ONS Postcode Directory under data/postcodes/onspd into
 * api/public/postcode-index.json and one shard per postcode area under
 * api/public/postcodes. `--include-northern-ireland` keeps BT postcodes, for a
 * build that will not be served publicly.
 */

const COLUMNS = [
	"pcds",
	"dointr",
	"doterm",
	"usrtypind",
	"east1m",
	"north1m",
	"gridind",
] as const;

const latestDirectory = (repositoryRoot: string) => {
	const root = join(repositoryRoot, "data", "postcodes", "onspd");
	const editions = existsSync(root)
		? readdirSync(root)
				.filter((name) => existsSync(join(root, name, "meta.json")))
				.sort()
		: [];
	if (editions.length === 0)
		throw new Error(
			`No ONS Postcode Directory under ${root}. Run pnpm fetch:onspd.`,
		);
	return join(root, editions.at(-1)!);
};

/** Directory rows streamed out of the archive, one at a time. */
async function* directoryRows(
	archive: string,
): AsyncGenerator<PostcodeSourceRow> {
	const unzip = spawn("unzip", ["-p", archive, "Data/ONSPD_*_UK.csv"], {
		stdio: ["ignore", "pipe", "inherit"],
	});
	const exited = new Promise<number>((done, fail) => {
		unzip.on("error", fail);
		unzip.on("close", (code) => done(code ?? 1));
	});
	let header: string[] | undefined;
	let positions: number[] = [];
	let country = -1;
	for await (const line of createInterface({ input: unzip.stdout })) {
		// The directory quotes text and never puts a comma or quote inside it,
		// which the column count below would catch.
		const cells = line.split(",").map((cell) => cell.replace(/^"|"$/g, ""));
		if (!header) {
			header = cells;
			positions = COLUMNS.map((column) => header!.indexOf(column));
			country = header.findIndex((column) =>
				/^ctry\d{2}cd$/.test(column),
			);
			const missing = COLUMNS.filter((_, at) => positions[at] === -1);
			if (missing.length > 0 || country === -1)
				throw new Error(
					`The directory has no ${[...missing, "ctry"].join(", ")} column`,
				);
			continue;
		}
		if (cells.length !== header.length)
			throw new Error(
				`A row has ${cells.length} cells, not ${header.length}: ${line}`,
			);
		const row = Object.fromEntries(
			COLUMNS.map((column, at) => [column, cells[positions[at]!]!]),
		) as Omit<PostcodeSourceRow, "ctry">;
		yield { ...row, ctry: cells[country]! };
	}
	const code = await exited;
	if (code !== 0) throw new Error(`unzip exited with ${code}`);
}

export const buildPostcodeIndex = async (
	repositoryRoot: string,
	options: { includeNorthernIreland?: boolean } = {},
) => {
	const directory = latestDirectory(repositoryRoot);
	const meta = JSON.parse(readFileSync(join(directory, "meta.json"), "utf8"));
	const archive = meta.files.find(
		(file: { role: string }) => file.role === "source",
	);
	const source: PostcodeSource = {
		title: meta.title,
		edition: meta.temporalCoverage,
		publisher: meta.publisher,
		sourceUrl: meta.sourceUrl,
		retrieved: meta.retrieved,
		sha256: `sha256:${archive.sha256}`,
		licence: { name: meta.licence.name, url: meta.licence.url },
		attribution: meta.attribution,
	};
	const rows: PostcodeSourceRow[] = [];
	for await (const row of directoryRows(join(directory, archive.path)))
		rows.push(row);
	const { artifact, files } = compilePostcodeIndex(rows, source, options);
	const publicRoot = join(repositoryRoot, "api", "public");
	// Every shard is rewritten, so one for an area no longer compiled, such as
	// BT after a build that included Northern Ireland, cannot linger.
	rmSync(join(publicRoot, "postcodes"), { recursive: true, force: true });
	mkdirSync(join(publicRoot, "postcodes"));
	for (const file of files)
		writeFileSync(join(publicRoot, file.path), file.text);
	const outputPath = join(publicRoot, "postcode-index.json");
	writeFileSync(outputPath, `${JSON.stringify(artifact, null, "\t")}\n`);
	return { outputPath, artifact };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const { outputPath, artifact } = await buildPostcodeIndex(
		resolve(dirname(scriptPath), "../.."),
		{
			includeNorthernIreland: process.argv.includes(
				"--include-northern-ireland",
			),
		},
	);
	console.log(
		`Wrote ${artifact.counts.postcodes} postcodes (${artifact.counts.live} live) in ${artifact.shards.length} areas to ${outputPath}${artifact.excluded.length ? `, leaving out ${artifact.excluded.map((entry) => `${entry.area} (${entry.postcodes})`).join(", ")}` : ""}`,
	);
}
