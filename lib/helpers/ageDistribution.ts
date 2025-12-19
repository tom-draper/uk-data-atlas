import { AgeGroups } from "../types";

export const calculateAgeGroups = (ageData: {
	[age: string]: number;
}): AgeGroups => {
	const groups: AgeGroups = {
		"0-17": 0,
		"18-29": 0,
		"30-44": 0,
		"45-64": 0,
		"65+": 0,
	};

	Object.entries(ageData).forEach(([age, count]) => {
		const ageNum = parseInt(age);
		if (ageNum <= 17) groups["0-17"] += count;
		else if (ageNum <= 29) groups["18-29"] += count;
		else if (ageNum <= 44) groups["30-44"] += count;
		else if (ageNum <= 64) groups["45-64"] += count;
		else groups["65+"] += count;
	});

	return groups;
};

export const getAgeColor = (age: number): string => {
	if (age <= 17) return "#10b981";
	if (age <= 29) return "#3b82f6";
	if (age <= 44) return "#8b5cf6";
	if (age <= 64) return "#f59e0b";
	return "#ef4444";
};
