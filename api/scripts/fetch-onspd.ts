import { createHash } from "node:crypto";
import {
	createReadStream,
	existsSync,
	mkdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Download the latest ONS Postcode Directory into
 * data/postcodes/onspd/{YYYY-MM}-uk, with the meta.json every source under
 * data/ carries. The archive is kept as ONS publishes it, so its hash can be
 * checked against the portal; the build streams the one CSV it needs out of it.
 */
const SEARCH = "https://www.arcgis.com/sharing/rest/search";
const ITEMS = "https://www.arcgis.com/sharing/rest/content/items";
const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
const TITLE = /^ONS Postcode Directory \((\w+) (\d{4})\)(?: for the UK)?$/;

type Item = { id: string; title: string; name: string; size: number };

const fetchJson = async (url: string) => {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`${response.status} ${response.statusText} for ${url}`);
	return (await response.json()) as Record<string, any>;
};

const latestEdition = async () => {
	const query = new URLSearchParams({
		q: 'owner:ONSGeography_data type:"CSV Collection" title:"ONS Postcode Directory"',
		num: "50",
		sortField: "modified",
		sortOrder: "desc",
		f: "json",
	});
	const { results } = await fetchJson(`${SEARCH}?${query}`);
	const editions = (results as Array<Record<string, any>>).flatMap((item) => {
		const match = TITLE.exec(String(item.title));
		const monthIndex = match ? MONTHS.indexOf(match[1]!) : -1;
		return match && monthIndex !== -1
			? [
					{
						edition: `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}`,
						id: String(item.id),
					},
				]
			: [];
	});
	const latest = editions.sort((left, right) =>
		right.edition.localeCompare(left.edition),
	)[0];
	if (!latest) throw new Error("No ONS Postcode Directory CSV found");
	const item = (await fetchJson(`${ITEMS}/${latest.id}?f=json`)) as Item;
	return { edition: latest.edition, item };
};

const fileSha256 = (path: string) =>
	new Promise<string>((done, fail) => {
		const hash = createHash("sha256");
		createReadStream(path)
			.on("data", (chunk) => hash.update(chunk))
			.on("end", () => done(hash.digest("hex")))
			.on("error", fail);
	});

export const fetchOnspd = async (
	repositoryRoot: string,
	retrieved = new Date().toISOString().slice(0, 10),
) => {
	const { edition, item } = await latestEdition();
	const directory = join(
		repositoryRoot,
		"data",
		"postcodes",
		"onspd",
		`${edition}-uk`,
	);
	mkdirSync(directory, { recursive: true });
	const archive = join(directory, item.name);
	const sourceUrl = `${ITEMS}/${item.id}/data`;
	if (!existsSync(archive) || statSync(archive).size !== item.size) {
		const response = await fetch(sourceUrl);
		if (!response.ok)
			throw new Error(
				`${response.status} ${response.statusText} for ${sourceUrl}`,
			);
		await writeFile(archive, Buffer.from(await response.arrayBuffer()));
		if (statSync(archive).size !== item.size)
			throw new Error(`${item.name}: expected ${item.size} bytes`);
	}
	const meta = {
		id: `${edition}-uk`,
		kind: "postcode-directory",
		title: item.title,
		description:
			"Every current and terminated postcode in the United Kingdom, the Channel Islands and the Isle of Man, with the grid reference of its centroid and the areas ONS assigns it to.",
		publisher: "Office for National Statistics",
		sourceUrl,
		retrieved,
		temporalCoverage: edition,
		licence: {
			name: "Open Government Licence v3.0",
			url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			note: "Northern Ireland postcodes (BT) are licensed by Land and Property Services for internal business use only.",
		},
		attribution: [
			"Contains OS data © Crown copyright and database right",
			"Contains Royal Mail data © Royal Mail copyright and database right",
			"Source: Office for National Statistics licensed under the Open Government Licence v.3.0",
		],
		files: [
			{
				path: item.name,
				role: "source",
				sha256: await fileSha256(archive),
				note: "The archive as published on the ONS Open Geography Portal.",
			},
		],
	};
	writeFileSync(
		join(directory, "meta.json"),
		`${JSON.stringify(meta, null, "\t")}\n`,
	);
	return { directory, edition };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const { directory, edition } = await fetchOnspd(
		resolve(dirname(scriptPath), "../.."),
	);
	console.log(`ONS Postcode Directory ${edition} is in ${directory}`);
}
