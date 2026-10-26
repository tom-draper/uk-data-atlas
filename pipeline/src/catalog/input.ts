import { readFileSync } from "node:fs";
import { readAtlasPayload } from "../../../shared/atlasSqlite";

export class AtlasDatasetInput {
	constructor(
		readonly repositoryRoot: string,
		readonly output: string,
	) {}
	read() {
		return readAtlasPayload(
			this.repositoryRoot,
			this.output === "dataset-manifest"
				? this.output
				: `dataset:${this.output}`,
		);
	}
	toString() {
		return `data/build/atlas.sqlite:${this.output}`;
	}
}

export type DatasetInput = string | AtlasDatasetInput;
export const readDatasetInput = (input: DatasetInput): string =>
	typeof input === "string" ? readFileSync(input, "utf8") : input.read();
