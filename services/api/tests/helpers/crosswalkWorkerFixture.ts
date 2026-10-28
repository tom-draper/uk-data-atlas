import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	AreaOverlapCrosswalkAdapter,
	PopulationOverlapCrosswalkAdapter,
} from "../../src/crosswalkAdapters";
import { readCompiledAreaLookup } from "../../../../pipeline/src/crosswalk-build-inputs";
import { readGeometrySourceLookup } from "../../src/geometrySources";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";

export const crosswalkWorkerFixture = () => {
	const root = mkdtempSync(join(tmpdir(), "crosswalk-workers-"));
	const outputDirectory = artifactDirectory(root);
	mkdirSync(outputDirectory, { recursive: true });
	mkdirSync(join(root, "data/source"), { recursive: true });
	const endpoints = [
		{ geography: "ward", code: "S" },
		{ geography: "localAuthority", code: "T" },
		{ geography: "lsoa", code: "B" },
	] as const;
	for (const { geography, code } of endpoints) {
		writeFileSync(
			join(root, `data/source/${geography}.geojson`),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						type: "Feature",
						properties: { CD: code },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[0, 0],
									[0.01, 0],
									[0.01, 0.01],
									[0, 0.01],
									[0, 0],
								],
							],
						},
					},
				],
			}),
		);
		writeFileSync(
			join(outputDirectory, `${geography}.json`),
			JSON.stringify({
				schemaVersion: 1,
				contentHash: `sha256:${geography}`,
				geography,
				boundaryRelease: "1",
				codeProperty: "CD",
				nameProperty: "NM",
				areas: [{ code, name: `Area ${code}` }],
			}),
		);
	}
	writeFileSync(join(root, "data/source/people.csv"), "code,people\nB,100\n");
	writeFileSync(
		join(outputDirectory, "area-inventory.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "sha256:areas",
			releases: endpoints.map(({ geography }) => ({
				geography,
				id: "1",
				status: "available",
				artifact: `${geography}.json`,
				contentHash: `sha256:${geography}`,
			})),
		}),
	);
	writeFileSync(
		join(outputDirectory, "geometry-sources.json"),
		JSON.stringify({
			schemaVersion: 1,
			releases: endpoints.map(({ geography }) => ({
				id: `${geography}/1`,
				status: "available",
				input: `${geography}.geojson`,
				crs: "EPSG:4326",
				codeProperty: "CD",
			})),
		}),
	);
	const area: AreaOverlapCrosswalkAdapter = {
		id: "area",
		method: "area-overlap",
		quality: "derived",
		weighting: {
			status: "provided",
			basis: "area",
			normalisation: "per-source",
		},
		from: { geography: "ward", boundaryRelease: "1" },
		to: { geography: "localAuthority", boundaryRelease: "1" },
		sliverWidthM: 100,
		minimumCoverage: 0.99,
	};
	const population: PopulationOverlapCrosswalkAdapter = {
		id: "population",
		method: "population-overlap",
		quality: "derived",
		from: area.from,
		to: area.to,
		pairs: area.id,
		minimumCoverage: 0.99,
		population: {
			input: "people.csv",
			codeColumn: "code",
			valueColumn: "people",
		},
		weighting: {
			status: "provided",
			basis: "population",
			normalisation: "per-source",
			population: "Residents",
			date: "2021-03-21",
			blocks: { geography: "lsoa", boundaryRelease: "1" },
		},
	};
	return {
		root,
		outputDirectory,
		area,
		population,
		areaLookup: readCompiledAreaLookup(outputDirectory).areaLookup,
		geometrySources: readGeometrySourceLookup(join(root, "services/api")),
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	};
};
