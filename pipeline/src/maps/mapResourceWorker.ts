import { parentPort } from "node:worker_threads";
import { writeFileSync } from "node:fs";
import {
	AreaGeometryCache,
	readGeometrySourceLookup,
} from "@uk-data-atlas/geometry";
import { compileFlatDownloads } from "../atlas/flatDownloads.ts";
import { roundKeepingValidity } from "./compileGeometryValidity.ts";
import {
	compileMapResource,
	type BoundaryReleaseSummary,
} from "./compileMapResource.ts";

if (!parentPort) throw new Error("map resource worker requires a parent");
const port = parentPort;
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
			const cache = new AreaGeometryCache(
				root,
				readGeometrySourceLookup(root),
				1,
				undefined,
				undefined,
				roundKeepingValidity,
			);
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
						geography: release.geography,
						boundaryRelease: release.id,
						reason,
						...(flat ? { features: flat.features } : {}),
					},
				});
				return;
			}
			writeFileSync(path, compiled.archive);
			port.postMessage({ index, descriptor: compiled.descriptor });
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
