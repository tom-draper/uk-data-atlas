/** Polling days of the general elections the atlas holds, by year. */
export const GENERAL_POLLING_DAYS: Readonly<Record<string, string>> = {
	2010: "2010-05-06",
	2015: "2015-05-07",
	2017: "2017-06-08",
	2019: "2019-12-12",
	2024: "2024-07-04",
};

/** Polling days of the local elections, by year. */
export const LOCAL_POLLING_DAYS: Readonly<Record<string, string>> = {
	2016: "2016-05-05",
	2017: "2017-05-04",
	2018: "2018-05-03",
	2019: "2019-05-02",
	2021: "2021-05-06",
	2022: "2022-05-05",
	2023: "2023-05-04",
	2024: "2024-05-02",
	2025: "2025-05-01",
};

/** The polling day of an election key, from a table of them. */
export const pollingDay =
	(days: Readonly<Record<string, string>>) => (key: string) => {
		const day = days[key];
		if (!day) throw new Error(`No polling day for election ${key}`);
		return day;
	};
