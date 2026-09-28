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
 * Compile the newest filtered ONS Postcode Directory under
 * data/postcodes/onspd into api/public/postcode-index.json and one shard per
 * postcode district under api/public/postcodes. The stored source excludes
 * Northern Ireland before it is included in the public data release.
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
			`No permitted ONS Postcode Directory under ${root}. Run pnpm refresh:onspd from api/.`,
		);
	return join(root, editions.at(-1)!);
};

/** Permitted ONSPD rows streamed from the stored, filtered source. */
async function* directoryRows(
	sourcePath: string,
): AsyncGenerator<PostcodeSourceRow> {
	const unzip = spawn("gzip", ["-dc", sourcePath], {
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
		// The selected ONSPD fields contain no embedded commas or quotes.
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

export const buildPostcodeIndex = async (repositoryRoot: string) => {
	const directory = latestDirectory(repositoryRoot);
	const meta = JSON.parse(readFileSync(join(directory, "meta.json"), "utf8"));
	const sourceFile = meta.files.find(
		(file: { role: string }) => file.role === "source",
	);
	if (!sourceFile)
		throw new Error(
			`${directory}: no source file is recorded in meta.json`,
		);
	const source: PostcodeSource = {
		title: meta.title,
		edition: meta.temporalCoverage,
		publisher: meta.publisher,
		sourceUrl: meta.sourceUrl,
		retrieved: meta.retrieved,
		sha256: `sha256:${sourceFile.sha256}`,
		licence: { name: meta.licence.name, url: meta.licence.url },
		attribution: meta.attribution,
	};
	const rows: PostcodeSourceRow[] = [];
	for await (const row of directoryRows(join(directory, sourceFile.path))) {
		if (row.ctry.startsWith("N"))
			throw new Error(
				`${row.pcds}: Northern Ireland rows must not be stored in the public postcode source.`,
			);
		rows.push(row);
	}
	const { artifact, files } = compilePostcodeIndex(rows, source);
	const publicRoot = join(repositoryRoot, "api", "public");
	// Every shard is rewritten, so one for a district no longer compiled, such
	// as BT1 after a build that included Northern Ireland, cannot linger.
	rmSync(join(publicRoot, "postcodes"), { recursive: true, force: true });
	mkdirSync(join(publicRoot, "postcodes"));
	for (const file of files) {
		mkdirSync(dirname(join(publicRoot, file.path)), { recursive: true });
		writeFileSync(join(publicRoot, file.path), file.text);
	}
	const outputPath = join(publicRoot, "postcode-index.json");
	writeFileSync(outputPath, `${JSON.stringify(artifact, null, "\t")}\n`);
	return { outputPath, artifact };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const { outputPath, artifact } = await buildPostcodeIndex(
		resolve(dirname(scriptPath), "../.."),
	);
	console.log(
		`Wrote ${artifact.counts.postcodes} postcodes (${artifact.counts.live} live) in ${artifact.shards.length} districts to ${outputPath}${artifact.excluded.length ? `, leaving out ${artifact.excluded.map((entry) => `${entry.area} (${entry.postcodes})`).join(", ")}` : ""}`,
	);
}
