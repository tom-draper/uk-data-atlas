import { DuckDBInstance } from "@duckdb/node-api";
import { decodeCompactPayload } from "@uk-data-atlas/catalogue/compactPayload";
import type { DatasetCoverage } from "@uk-data-atlas/catalogue/place-profile";

export async function readDatasetCoverage(
	readDataset: (output: string) => string,
) {
	const manifest = JSON.parse(readDataset("dataset-manifest")) as {
		datasets: { output: string; source: { name: string } }[];
	};
	const titles = new Map<string, string>();
	const order = new Map<string, number>();
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	try {
		await connection.run(
			"CREATE TEMP TABLE coverage (code VARCHAR, slug VARCHAR, year DOUBLE)",
		);
		const appender = await connection.createAppender("coverage");
		try {
			for (const { output, source } of manifest.datasets) {
				if (titles.has(output)) continue;
				order.set(output, order.size);
				titles.set(output, source.name);
				const file = decodeCompactPayload(
					JSON.parse(readDataset(output)),
				) as Record<string, unknown>;
				for (const [key, entry] of Object.entries(file)) {
					if (!entry || typeof entry !== "object") continue;
					const year = Number(
						(entry as { year?: unknown }).year ?? key,
					);
					if (!Number.isFinite(year)) continue;
					for (const value of Object.values(entry)) {
						if (
							!value ||
							typeof value !== "object" ||
							Array.isArray(value)
						)
							continue;
						const codes = Object.keys(value).filter((code) =>
							/^[EWSN]\d{8}$/.test(code),
						);
						if (codes.length < 5) continue;
						for (const code of codes) {
							appender.appendVarchar(code);
							appender.appendVarchar(output);
							appender.appendDouble(year);
							appender.endRow();
						}
					}
				}
			}
		} finally {
			appender.closeSync();
		}
		const result = await connection.stream(
			"SELECT DISTINCT code, slug, year FROM coverage ORDER BY code, slug, year DESC",
		);
		const coverage = new Map<string, DatasetCoverage[]>();
		for (;;) {
			const chunk = await result.fetchChunk();
			if (!chunk || chunk.rowCount === 0) break;
			for (const [codeValue, slugValue, year] of chunk.getRows()) {
				const code = String(codeValue);
				const slug = String(slugValue);
				const datasets = coverage.get(code) ?? [];
				if (!coverage.has(code)) coverage.set(code, datasets);
				let dataset = datasets.at(-1);
				if (dataset?.slug !== slug) {
					dataset = {
						slug,
						title: titles.get(slug) ?? slug,
						years: [],
					};
					datasets.push(dataset);
				}
				dataset.years.push(Number(year));
			}
		}
		for (const datasets of coverage.values())
			datasets.sort(
				(a, b) =>
					a.title.localeCompare(b.title) ||
					order.get(a.slug)! - order.get(b.slug)!,
			);
		return (code: string): DatasetCoverage[] => coverage.get(code) ?? [];
	} finally {
		connection.closeSync();
		instance.closeSync();
	}
}
