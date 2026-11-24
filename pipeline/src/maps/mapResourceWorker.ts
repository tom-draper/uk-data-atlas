import { parentPort } from "node:worker_threads";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { releaseKey, unpackGeometry } from "@uk-data-atlas/geography";
import {
	AreaGeometryCache,
	compiledGeometryFile,
	readGeometryStore,
	readGeometrySourceLookup,
} from "@uk-data-atlas/geometry";
import { compileFlatDownloads } from "../atlas/flatDownloads.ts";
import {
	compileMapResource,
	type BoundaryReleaseSummary,
	type MapGeometryCache,
} from "./compileMapResource.ts";

if (!parentPort) throw new Error("map resource worker requires a parent");
const port = parentPort;
let sources: ReturnType<typeof readGeometrySourceLookup> | undefined;
let provenance: AreaGeometryCache | undefined;
port.on(
	"message",
	({
		index,
		root,
		release,
		names,
		artifact,
		path,
	}: {
		index: number;
		root: string;
		release: BoundaryReleaseSummary;
		names: [string, string][];
		artifact: string;
		path: string;
	}) => {
		try {
			sources ??= readGeometrySourceLookup(root);
			const { geography, id: boundaryRelease } = release;
			const id = releaseKey(geography, boundaryRelease);
			const source = sources.get(id);
			if (!source)
				throw new Error(`Missing registered geometry for ${id}.`);
			const sourceProvenance = (provenance ??= new AreaGeometryCache(
				root,
				sources,
			)).provenance(geography, boundaryRelease);
			const stored = readGeometryStore(
				join(
					artifactDirectory(root),
					"geometry-store",
					compiledGeometryFile(geography, boundaryRelease),
				),
				source,
			);
			if (!stored)
				throw new Error(
					`Compiled geometry for ${id} does not match the registered source.`,
				);
			const cache: MapGeometryCache = {
				codes: () => stored.codes,
				get: (_geography, _release, code) => {
					const packed = stored.get(code);
					return packed && unpackGeometry(packed);
				},
				packed: (_geography, _release, code) => stored.get(code),
				provenance: () => sourceProvenance,
			};
			try {
				const nameMap = new Map(names);
				let compiled: ReturnType<typeof compileMapResource>;
				try {
					compiled = compileMapResource(
						cache,
						release,
						nameMap,
						artifact,
					);
				} catch (error) {
					const reason =
						error instanceof Error ? error.message : String(error);
					const flat = compileFlatDownloads(
						cache,
						release,
						nameMap,
						reason,
					);
					port.postMessage({
						index,
						unavailable: {
							geography,
							boundaryRelease,
							reason,
							...(flat ? { features: flat.features } : {}),
						},
					});
					return;
				}
				writeFileSync(path, compiled.archive);
				port.postMessage({ index, descriptor: compiled.descriptor });
			} finally {
				stored.close();
			}
		} catch (error) {
			port.postMessage({
				index,
				error:
					error instanceof Error
						? (error.stack ?? error.message)
						: String(error),
			});
		}
	},
);
