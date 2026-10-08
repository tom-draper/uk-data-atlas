import { execSync, spawn } from "child_process";
import { stat } from "fs/promises";
import { join } from "path";
import {
	odsTableRow,
	type OdsTableOptions,
} from "../../../lib/data/spreadsheet/ods";
import { SOURCE_DATA } from "../paths.mts";

// ODS source files are never exposed by the application. The child-poverty
// loader only needs its worksheet XML, which is then reduced to compact JSON.
export const readOdsContent = (path: string): Promise<string> => {
	const fullPath = join(SOURCE_DATA, path);
	return stat(fullPath).then(() =>
		execSync(`unzip -p "${fullPath}" content.xml`, {
			maxBuffer: 100 * 1024 * 1024,
		}).toString("utf8"),
	);
};

export const visitOdsTableRows = async (
	path: string,
	{ table, label, maxColumns }: OdsTableOptions,
	visit: (row: readonly string[]) => void,
) => {
	const fullPath = join(SOURCE_DATA, path);
	await stat(fullPath);
	return new Promise<void>((resolve, reject) => {
		const unzip = spawn("unzip", ["-p", fullPath, "content.xml"]);
		if (!unzip.stdout) {
			reject(new Error(`Could not stream ${label} source.`));
			return;
		}
		const tableStart = `<table:table table:name="${table}"`;
		const tableEnd = "</table:table>";
		const rowStart = "<table:table-row";
		const rowEnd = "</table:table-row>";
		let pending = "";
		let foundTable = false;
		let finishedTable = false;
		let failed = false;
		const fail = (error: unknown) => {
			if (failed) return;
			failed = true;
			unzip.kill();
			reject(error);
		};
		const retainTail = () => {
			pending = pending.slice(
				-Math.max(tableStart.length, tableEnd.length),
			);
		};
		const consume = () => {
			if (finishedTable) return;
			if (!foundTable) {
				const start = pending.indexOf(tableStart);
				if (start === -1) {
					retainTail();
					return;
				}
				foundTable = true;
				pending = pending.slice(start);
			}
			while (true) {
				const nextRow = pending.indexOf(rowStart);
				const end = pending.indexOf(tableEnd);
				if (end !== -1 && (nextRow === -1 || end < nextRow)) {
					finishedTable = true;
					pending = "";
					return;
				}
				if (nextRow === -1) {
					retainTail();
					return;
				}
				if (nextRow > 0) pending = pending.slice(nextRow);
				const closing = pending.indexOf(rowEnd);
				if (closing === -1) return;
				const rowXml = pending.slice(0, closing + rowEnd.length);
				pending = pending.slice(rowXml.length);
				visit(odsTableRow(rowXml, maxColumns));
			}
		};
		unzip.stdout.setEncoding("utf8");
		unzip.stdout.on("data", (chunk: string) => {
			try {
				pending += chunk;
				consume();
			} catch (error) {
				fail(error);
			}
		});
		unzip.on("error", fail);
		unzip.on("close", (code) => {
			if (failed) return;
			try {
				consume();
				if (code !== 0)
					throw new Error(`Could not stream ${label} source.`);
				if (!foundTable)
					throw new Error(
						`Could not find ${table} in ${label} source`,
					);
				if (!finishedTable)
					throw new Error(
						`Could not read ${table} in ${label} source`,
					);
				resolve();
			} catch (error) {
				fail(error);
			}
		});
	});
};
