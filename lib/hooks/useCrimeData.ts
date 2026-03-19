// lib/hooks/useCrimeData.ts
import { useState, useEffect } from "react";
import { CrimeDataset, CrimeRecord } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { parseCsv, findHeaderLine } from "../helpers/parseCsv";

const parseNumberStrict = (val: string): number => {
	if (!val || val.trim() === "") return 0;
	const cleaned = val.replace(/,/g, "").trim();
	const parsed = Number(cleaned);
	return isNaN(parsed) ? 0 : parsed;
};

const extractYearFromTitle = (title: string): number => {
	const match = title.match(/(\d{4})/);
	return match ? parseInt(match[1]) : new Date().getFullYear();
};

export const useCrimeData = () => {
	const [datasets, setDatasets] = useState<Record<string, CrimeDataset>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const loadData = async () => {
			try {
				const response = await fetch(
					withCDN("/data/crime/policeforceareatablesyejune25final.csv"),
				);
				if (!response.ok)
					throw new Error(`Failed to fetch crime data: ${response.statusText}`);

				const csvText = await response.text();
				const titleRow = csvText.split("\n")[0] ?? "";
				const year = extractYearFromTitle(titleRow);

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
						totalRecordedCrime: parseNumberStrict(row[6]),
						violenceAgainstPerson: parseNumberStrict(row[7]),
						homicide: parseNumberStrict(row[8]),
						deathSeriesInjuryUnlawfulDriving: parseNumberStrict(row[9]),
						violenceWithInjury: parseNumberStrict(row[10]),
						violenceWithoutInjury: parseNumberStrict(row[11]),
						stalkingHarassment: parseNumberStrict(row[12]),
						sexualOffences: parseNumberStrict(row[13]),
						robbery: parseNumberStrict(row[14]),
						theftOffences: parseNumberStrict(row[15]),
						burglary: parseNumberStrict(row[16]),
						residentialBurglary: parseNumberStrict(row[17]),
						nonResidentialBurglary: parseNumberStrict(row[18]),
						vehicleOffences: parseNumberStrict(row[19]),
						theftFromPerson: parseNumberStrict(row[20]),
						bicycleTheft: parseNumberStrict(row[21]),
						shoplifting: parseNumberStrict(row[22]),
						otherTheftOffences: parseNumberStrict(row[23]),
						criminalDamageArson: parseNumberStrict(row[24]),
						drugOffences: parseNumberStrict(row[25]),
						possessionWeapons: parseNumberStrict(row[26]),
						publicOrderOffences: parseNumberStrict(row[27]),
						miscellaneousCrimes: parseNumberStrict(row[28]),
					};
				}

				setDatasets({
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
				});
				setLoading(false);
			} catch (err: any) {
				setError(err.message || "Error loading crime data");
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};
