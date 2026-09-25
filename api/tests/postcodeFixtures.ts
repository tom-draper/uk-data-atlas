import {
	compilePostcodeIndex,
	PostcodeIndex,
	type PostcodeSource,
	type PostcodeSourceRow,
} from "../src/postcodes";

export const postcodeSource: PostcodeSource = {
	title: "ONS Postcode Directory (August 2026)",
	edition: "2026-08",
	publisher: "Office for National Statistics",
	sourceUrl: "https://example.com/onspd.zip",
	retrieved: "2026-09-25",
	sha256: "sha256:onspd",
	licence: {
		name: "Open Government Licence v3.0",
		url: "https://example.com/ogl",
	},
	attribution: ["Contains OS data © Crown copyright and database right"],
};

export const postcodeRow = (
	pcds: string,
	overrides: Partial<PostcodeSourceRow> = {},
): PostcodeSourceRow => ({
	pcds,
	dointr: "198001",
	doterm: "",
	usrtypind: "0",
	east1m: "530000",
	north1m: "180000",
	gridind: "1",
	ctry: "E92000001",
	...overrides,
});

/** An index over these rows, reading its shards from memory. */
export const postcodeIndexFor = (
	rows: PostcodeSourceRow[],
	options: { includeNorthernIreland?: boolean; capacity?: number } = {},
) => {
	const { artifact, files } = compilePostcodeIndex(
		rows,
		postcodeSource,
		options,
	);
	const texts = new Map(files.map((file) => [file.path, file.text]));
	const reads: string[] = [];
	const index = new PostcodeIndex(
		artifact,
		(path) => {
			reads.push(path);
			return texts.get(path)!;
		},
		options.capacity,
	);
	return { index, artifact, files, texts, reads };
};
