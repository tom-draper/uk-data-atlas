import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Download a Scottish statistical geography's parents from the Scottish
 * Government's statistics.gov.scot linked data, as a GeoJSON lookup with the
 * meta.json every source under data/ carries. Each area of a collection is
 * written with the code and name of the parent its record declares
 * (`parentcode`), ordered by code, so a re-download is byte-identical while
 * the publisher has not changed the records. The endpoint refuses to order
 * a whole collection itself, so the rows are sorted here.
 */
const ENDPOINT = "https://statistics.gov.scot/sparql.csv";

export type ScottishLookupSource = {
	/** The statistics.gov.scot collection, such as `data-zones-2011`. */
	collection: string;
	/** Directory under data/lookups, such as `data-zone-to-intermediate-zone/2011-sc`. */
	directory: string;
	/** The file written, named for its content since none was published. */
	file: string;
	title: string;
	description: string;
	temporalCoverage: string;
	/** Property names for the area and its parent, such as `DZ11CD`. */
	columns: {
		code: string;
		name: string;
		parentCode: string;
		parentName: string;
	};
};

export const SCOTTISH_LOOKUPS: ScottishLookupSource[] = [
	{
		collection: "data-zones-2011",
		directory: "data-zone-to-intermediate-zone/2011-sc",
		file: "DZ11_IZ11_SC_LU.geojson",
		title: "2011 data zone to 2011 intermediate zone (Scotland)",
		description:
			"The Scottish Government's record of the intermediate zone each 2011 data zone belongs to. Intermediate zones are built from whole data zones.",
		temporalCoverage: "2011",
		columns: {
			code: "DZ11CD",
			name: "DZ11NM",
			parentCode: "IZ11CD",
			parentName: "IZ11NM",
		},
	},
	{
		collection: "intermediate-zones-2011",
		directory: "intermediate-zone-to-local-authority/2011-sc",
		file: "IZ11_CA_SC_LU.geojson",
		title: "2011 intermediate zone to council area (Scotland)",
		description:
			"The Scottish Government's record of the council area each 2011 intermediate zone belongs to, under the council area codes current on statistics.gov.scot.",
		temporalCoverage: "2011",
		columns: {
			code: "IZ11CD",
			name: "IZ11NM",
			parentCode: "CACD",
			parentName: "CANM",
		},
	},
];

const query = (collection: string) => `
PREFIX foi: <http://publishmydata.com/def/ontology/foi/>
PREFIX sg: <http://statistics.data.gov.uk/def/statistical-geography#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?code ?name ?parentCode ?parentName WHERE {
  ?area foi:memberOf <http://statistics.gov.scot/def/foi/collection/${collection}> ;
        skos:notation ?code ;
        rdfs:label ?name ;
        sg:parentcode ?parent .
  ?parent skos:notation ?parentCode ;
          rdfs:label ?parentName .
}`;

/** RFC 4180 rows: fields may be quoted, with doubled quotes inside. */
const parseCsv = (text: string) => {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	for (let at = 0; at < text.length; at += 1) {
		const character = text[at]!;
		if (quoted) {
			if (character === '"' && text[at + 1] === '"') {
				field += '"';
				at += 1;
			} else if (character === '"') quoted = false;
			else field += character;
		} else if (character === '"') quoted = true;
		else if (character === ",") {
			row.push(field);
			field = "";
		} else if (character === "\n" || character === "\r") {
			if (character === "\r" && text[at + 1] === "\n") at += 1;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else field += character;
	}
	if (field.length > 0 || row.length > 0) rows.push([...row, field]);
	return rows;
};

export const fetchScottishLookup = async (
	repositoryRoot: string,
	source: ScottishLookupSource,
	retrieved = new Date().toISOString().slice(0, 10),
) => {
	const text = query(source.collection);
	const sourceUrl = `${ENDPOINT}?query=${encodeURIComponent(text)}`;
	const response = await fetch(sourceUrl);
	if (!response.ok)
		throw new Error(
			`${response.status} ${response.statusText} for ${source.collection}`,
		);
	const [header, ...rows] = parseCsv(await response.text());
	if (header?.join(",") !== "code,name,parentCode,parentName")
		throw new Error(`${source.collection}: unexpected columns ${header}`);
	rows.sort(([left], [right]) => left!.localeCompare(right!));
	const codes = new Set<string>();
	const features = rows.map(([code, name, parentCode, parentName]) => {
		if (!code || !name || !parentCode || !parentName)
			throw new Error(`${source.collection}: incomplete row for ${code}`);
		// One parent per area: a second would mean the record is not a
		// hierarchy, and the build should not have to find that out.
		if (codes.has(code))
			throw new Error(`${source.collection}: ${code} has two parents`);
		codes.add(code);
		const { columns } = source;
		return {
			type: "Feature",
			geometry: null,
			properties: {
				[columns.code]: code,
				[columns.name]: name,
				[columns.parentCode]: parentCode,
				[columns.parentName]: parentName,
			},
		};
	});
	const directory = join(repositoryRoot, "data", "lookups", source.directory);
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, source.file),
		JSON.stringify({ type: "FeatureCollection", features }),
	);
	writeFileSync(
		join(directory, "meta.json"),
		`${JSON.stringify(
			{
				id: source.directory.split("/").at(-1),
				kind: "lookup",
				title: source.title,
				description: source.description,
				publisher: "Scottish Government",
				sourceUrl,
				retrieved,
				temporalCoverage: source.temporalCoverage,
				licence: {
					name: "Open Government Licence v3.0",
					url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
				},
				files: [
					{
						path: source.file,
						role: "source",
						note: `Queried from the statistics.gov.scot SPARQL endpoint as the ${features.length} areas of the ${source.collection} collection with the code and label of each one's parentcode, ordered by code.`,
					},
				],
			},
			null,
			"\t",
		)}\n`,
	);
	return { path: join(directory, source.file), rows: features.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	for (const source of SCOTTISH_LOOKUPS) {
		const { path, rows } = await fetchScottishLookup(
			repositoryRoot,
			source,
		);
		console.log(`Wrote ${rows} rows to ${path}`);
	}
}
