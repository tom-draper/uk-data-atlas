import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { csvRecords } from "../../../shared/csv";

/**
 * Download a Scottish statistical geography's parents from the Scottish
 * Government's statistics.gov.scot linked data, as a GeoJSON lookup with the
 * meta.json every source under data/ carries. Each area of a collection is
 * written with the code and name of the parent its record declares, ordered
 * by code. The parent is the record's `parentcode`, or, for a source naming a
 * `parentEntity`, its one `within` area of that entity, so a re-download is byte-identical while
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
	/**
	 * The statistical entity of the parent, such as `S12` for council areas,
	 * read from the record's `within` areas. Omitted to read `parentcode`.
	 */
	parentEntity?: string;
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
	{
		collection: "data-zones-2022",
		directory: "data-zone-to-local-authority/2022-sc",
		file: "DZ22_CA_SC_LU.geojson",
		title: "2022 data zone to council area (Scotland)",
		description:
			"The Scottish Government's record of the council area each 2022 data zone lies within. Data zones are built within council areas.",
		temporalCoverage: "2022",
		parentEntity: "S12",
		columns: {
			code: "DZ22CD",
			name: "DZ22NM",
			parentCode: "CACD",
			parentName: "CANM",
		},
	},
	{
		collection: "data-zones-2022",
		directory: "data-zone-to-ward/2022-sc",
		file: "DZ22_MMW_SC_LU.geojson",
		title: "2022 data zone to multi-member ward (Scotland)",
		description:
			"The Scottish Government's record of the multi-member ward each 2022 data zone is assigned to.",
		temporalCoverage: "2022",
		parentEntity: "S13",
		columns: {
			code: "DZ22CD",
			name: "DZ22NM",
			parentCode: "MMWCD",
			parentName: "MMWNM",
		},
	},
	{
		collection: "data-zones-2022",
		directory: "data-zone-to-constituency/2022-sc",
		file: "DZ22_UKPC_SC_LU.geojson",
		title: "2022 data zone to UK Parliament constituency (Scotland)",
		description:
			"The Scottish Government's record of the UK Parliament constituency each 2022 data zone is assigned to.",
		temporalCoverage: "2022",
		parentEntity: "S14",
		columns: {
			code: "DZ22CD",
			name: "DZ22NM",
			parentCode: "UKPCCD",
			parentName: "UKPCNM",
		},
	},
	{
		collection: "data-zones-2022",
		directory: "data-zone-to-scottish-parliamentary-constituency/2022-sc",
		file: "DZ22_SPC_SC_LU.geojson",
		title: "2022 data zone to Scottish Parliament constituency (Scotland)",
		description:
			"The Scottish Government's record of the Scottish Parliament constituency each 2022 data zone is assigned to.",
		temporalCoverage: "2022",
		parentEntity: "S16",
		columns: {
			code: "DZ22CD",
			name: "DZ22NM",
			parentCode: "SPCCD",
			parentName: "SPCNM",
		},
	},
];

const query = ({ collection, parentEntity }: ScottishLookupSource) => `
PREFIX foi: <http://publishmydata.com/def/ontology/foi/>
PREFIX sg: <http://statistics.data.gov.uk/def/statistical-geography#>
PREFIX se: <http://statistics.data.gov.uk/def/statistical-entity#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?code ?name ?parentCode ?parentName WHERE {
  ?area foi:memberOf <http://statistics.gov.scot/def/foi/collection/${collection}> ;
        skos:notation ?code ;
        rdfs:label ?name ;
        ${parentEntity ? "foi:within" : "sg:parentcode"} ?parent .${
			parentEntity
				? `
  ?parent se:code <http://statistics.gov.scot/id/statistical-entity/${parentEntity}> .`
				: ""
		}
  ?parent skos:notation ?parentCode ;
          rdfs:label ?parentName .
}`;

export const fetchScottishLookup = async (
	repositoryRoot: string,
	source: ScottishLookupSource,
	retrieved = new Date().toISOString().slice(0, 10),
) => {
	const text = query(source);
	const sourceUrl = `${ENDPOINT}?query=${encodeURIComponent(text)}`;
	const response = await fetch(sourceUrl);
	if (!response.ok)
		throw new Error(
			`${response.status} ${response.statusText} for ${source.directory}`,
		);
	const [header, ...rows] = csvRecords(await response.text());
	if (header?.join(",") !== "code,name,parentCode,parentName")
		throw new Error(`${source.directory}: unexpected columns ${header}`);
	rows.sort(([left], [right]) => left!.localeCompare(right!));
	const codes = new Set<string>();
	const features = rows.map(([code, name, parentCode, parentName]) => {
		if (!code || !name || !parentCode || !parentName)
			throw new Error(`${source.directory}: incomplete row for ${code}`);
		// One parent per area: a second would mean the record is not a
		// hierarchy, and the build should not have to find that out.
		if (codes.has(code))
			throw new Error(`${source.directory}: ${code} has two parents`);
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
	const directory = join(
		repositoryRoot,
		"data/source",
		"lookups",
		source.directory,
	);
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
						note: `Queried from the statistics.gov.scot SPARQL endpoint as the ${features.length} areas of the ${source.collection} collection with the code and label of each one's ${source.parentEntity ? `${source.parentEntity} within area` : "parentcode"}, ordered by code.`,
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
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	// Directories named on the command line limit the download to those
	// sources, so adding one does not refresh the others' snapshots.
	const only = process.argv.slice(2);
	for (const source of SCOTTISH_LOOKUPS.filter(
		({ directory }) => only.length === 0 || only.includes(directory),
	)) {
		const { path, rows } = await fetchScottishLookup(
			repositoryRoot,
			source,
		);
		console.log(`Wrote ${rows} rows to ${path}`);
	}
}
