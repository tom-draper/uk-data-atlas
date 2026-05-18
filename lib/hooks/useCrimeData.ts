import { CrimeDataset, CrimeRecord } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { parseCsv, findHeaderLine } from "../helpers/parseCsv";
import { parseNum } from "../helpers/parseNumber";
import { useDataLoader } from "./useDataLoader";

const extractYearFromTitle = (title: string): number => {
	const match = title.match(/(\d{4})/);
	return match ? parseInt(match[1]) : new Date().getFullYear();
};

export const useCrimeData = () => {
	return useDataLoader<CrimeDataset>(async () => {
		const response = await fetch(
			withCDN("/data/crime/policeforceareatablesyejune25final.csv"),
		);
		if (!response.ok)
			throw new Error(`Failed to fetch crime data: ${response.statusText}`);

		const csvText = await response.text();
		const year = extractYearFromTitle(csvText.split("\n")[0] ?? "");

		// Skip past the header row — data starts on the line after it
		const headerLine = findHeaderLine(csvText, "police force area code");
		const { data } = await parseCsv<string[]>(csvText, {
			header: false,
			skipLines: headerLine + 1,
		});

		const records: Record<string, CrimeRecord> = {};
		for (const row of data as string[][]) {
			if (!row[0] || row[0].trim() === "") continue;

			const areaCode = row[4]?.trim() || "";
			const areaName = row[5]?.trim() || "";
			if (!areaCode || areaCode === "Local Authority code") continue;

			records[areaCode] = {
				localAuthorityCode: areaCode,
				localAuthorityName: areaName,
				policeForceAreaCode: row[0]?.trim() || "",
				policeForceAreaName: row[1]?.trim() || "",
				communitySafetyPartnershipCode: row[2]?.trim() || "",
				communitySafetyPartnershipName: row[3]?.trim() || "",
				totalRecordedCrime: parseNum(row[6]),
				violenceAgainstPerson: parseNum(row[7]),
				homicide: parseNum(row[8]),
				deathSeriesInjuryUnlawfulDriving: parseNum(row[9]),
				violenceWithInjury: parseNum(row[10]),
				violenceWithoutInjury: parseNum(row[11]),
				stalkingHarassment: parseNum(row[12]),
				sexualOffences: parseNum(row[13]),
				robbery: parseNum(row[14]),
				theftOffences: parseNum(row[15]),
				burglary: parseNum(row[16]),
				residentialBurglary: parseNum(row[17]),
				nonResidentialBurglary: parseNum(row[18]),
				vehicleOffences: parseNum(row[19]),
				theftFromPerson: parseNum(row[20]),
				bicycleTheft: parseNum(row[21]),
				shoplifting: parseNum(row[22]),
				otherTheftOffences: parseNum(row[23]),
				criminalDamageArson: parseNum(row[24]),
				drugOffences: parseNum(row[25]),
				possessionWeapons: parseNum(row[26]),
				publicOrderOffences: parseNum(row[27]),
				miscellaneousCrimes: parseNum(row[28]),
			};
		}

		return {
			[year]: {
				id: `crime${year}`,
				year,
				type: "crime",
				boundaryType: "localAuthority",
				boundaryYear: year,
				dataDate: `year ending June ${year}`,
				jurisdiction: "England and Wales",
				data: records,
				metadata: {
					source: "Police recorded crime from the Home Office",
					notes: [
						"Police recorded crime statistics are published as official statistics, not accredited official statistics",
					],
				},
			},
		};
	});
};
