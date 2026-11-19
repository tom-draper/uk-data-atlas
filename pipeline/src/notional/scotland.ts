import { readFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { isShareAlikeLocal, type LocalSource, type Votes } from "./inputs.ts";

/**
 * Scottish council results, May 2017, from the Local Elections Archive
 * Project file the atlas already holds for England and Wales. The atlas's
 * local election series leaves out its Scottish rows, which are STV first
 * preferences, so they are read here. Summed over a party's candidates in a
 * ward, first preferences are its share of the ward's voters.
 */

export const SCOTTISH_PERIOD = "2017-05-04";
export const SCOTTISH_FILE =
	"data/source/politics/local-elections/local-election/2017/leap-2017-05-04.csv";
/** Seven 2017 wards were recoded by December 2019 but not by December 2017. */
export const SCOTTISH_RELEASE = "2019-12-uk-bgc";

const PARTIES: Record<string, string> = {
	C: "con",
	Lab: "lab",
	LD: "ld",
	SNP: "snp",
	Grn: "green",
	UKIP: "ukip",
};

/** First preferences by party per Scottish ward, from LEAP's candidate rows. */
export const parseScottishLocal = (text: string) => {
	const wards = new Map<string, Votes>();
	const rows = Papa.parse<string[]>(text, { skipEmptyLines: true }).data;
	for (const [, , , ward, , label, count] of rows) {
		if (!ward?.startsWith("S13")) continue;
		const votes = Number(count);
		if (!Number.isFinite(votes))
			throw new Error(
				`Scottish ward ${ward} has a vote count of ${count}`,
			);
		const party = PARTIES[label?.trim() ?? ""] ?? "other";
		let found = wards.get(ward);
		if (!found) wards.set(ward, (found = {}));
		found[party] = (found[party] ?? 0) + votes;
	}
	return wards;
};

export const readScottishLocal = (root: string): LocalSource => ({
	period: SCOTTISH_PERIOD,
	release: SCOTTISH_RELEASE,
	wards: parseScottishLocal(readFileSync(join(root, SCOTTISH_FILE), "utf8")),
	keys: [`${SCOTTISH_FILE}, Scottish first preferences`],
	shareAlike: isShareAlikeLocal(SCOTTISH_PERIOD),
});
