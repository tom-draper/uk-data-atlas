import { DuckDBInstance } from "@duckdb/node-api";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "../../shared/contentHash";
import type {
	PostcodeIndexArtifact,
	PostcodeSource,
} from "@uk-data-atlas/geography/postcode-index-types";
import { compilePostcodeIndex, type PostcodeSourceRow } from "./postcodeIndex";
import { storePostcodeIndex } from "./storePostcodeIndex";

const columns = [
	"pcds",
	"dointr",
	"doterm",
	"usrtypind",
	"east1m",
	"north1m",
	"gridind",
] as const;

export async function buildDuckdbPostcodeIndex(
	root: string,
	path: string,
	source: PostcodeSource,
) {
	const directory = mkdtempSync(join(root, "data/build/.postcode-index-"));
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	try {
		const input = `read_csv('${path.replaceAll("'", "''")}', header=true, all_varchar=true, nullstr='')`;
		const description = await connection.runAndReadAll(
			`DESCRIBE SELECT * FROM ${input}`,
		);
		const names = description.getRows().map((row) => String(row[0]));
		const country = names.find((name) => /^ctry\d{2}cd$/.test(name));
		const missing = columns.filter((name) => !names.includes(name));
		if (missing.length || !country)
			throw new Error(
				`The directory has no ${[...missing, ...(country ? [] : ["ctry"])].join(", ")} column`,
			);
		const projection = [...columns, country]
			.map((name) => `coalesce("${name.replaceAll('"', '""')}", '')`)
			.join(", ");
		const result = await connection.stream(
			`SELECT ${projection} FROM ${input} ORDER BY left(replace(pcds, ' ', ''), length(replace(pcds, ' ', '')) - 3), replace(pcds, ' ', '')`,
		);
		const counts = {
			postcodes: 0,
			live: 0,
			terminated: 0,
			withoutGridReference: 0,
		};
		const shards: PostcodeIndexArtifact["shards"] = [];
		let rows: PostcodeSourceRow[] = [];
		let district: string | undefined;
		const flush = () => {
			if (!rows.length) return;
			const compiled = compilePostcodeIndex(rows, source);
			for (const file of compiled.files)
				writeFileSync(
					join(directory, String(shards.length)),
					file.text,
				);
			shards.push(...compiled.artifact.shards);
			counts.postcodes += compiled.artifact.counts.postcodes;
			counts.live += compiled.artifact.counts.live;
			counts.terminated += compiled.artifact.counts.terminated;
			counts.withoutGridReference +=
				compiled.artifact.counts.withoutGridReference;
			rows = [];
		};
		for (;;) {
			const chunk = await result.fetchChunk();
			if (!chunk || chunk.rowCount === 0) break;
			for (const values of chunk.getRows()) {
				const [
					pcds,
					dointr,
					doterm,
					usrtypind,
					east1m,
					north1m,
					gridind,
					ctry,
				] = values.map(String);
				const compact = pcds!.replaceAll(" ", "");
				const next = compact.slice(0, -3);
				if (district !== undefined && district !== next) flush();
				district = next;
				if (ctry!.startsWith("N"))
					throw new Error(
						`${pcds}: Northern Ireland rows must not be stored in the public postcode source.`,
					);
				rows.push({
					pcds: pcds!,
					dointr: dointr!,
					doterm: doterm!,
					usrtypind: usrtypind!,
					east1m: east1m!,
					north1m: north1m!,
					gridind: gridind!,
					ctry: ctry!,
				});
			}
		}
		flush();
		const body = {
			schemaVersion: 1 as const,
			source,
			excluded: [] as PostcodeIndexArtifact["excluded"],
			counts,
			shards,
		};
		const artifact = { ...body, contentHash: sha256(JSON.stringify(body)) };
		const paths = new Map(
			shards.map((shard, i) => [shard.path, join(directory, String(i))]),
		);
		const outputPath = storePostcodeIndex(root, artifact, (path) => {
			const shard = paths.get(path);
			if (!shard)
				throw new Error(`Missing compiled postcode shard ${path}`);
			return readFileSync(shard, "utf8");
		});
		return { outputPath, artifact };
	} finally {
		connection.closeSync();
		instance.closeSync();
		rmSync(directory, { recursive: true, force: true });
	}
}
