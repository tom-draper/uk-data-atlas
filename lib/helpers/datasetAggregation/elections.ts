import type {
	AggregatedBrexitData,
	BrexitConstituencyDataset,
	BrexitLADDataset,
	ConstituencyStats,
	Features,
	GeneralElectionDataset,
	LocalElectionDataset,
	PropertyKeys,
	WardStats,
} from "@/lib/types";
import { getFeatureProp } from "@/lib/types";
import { getWinningParty } from "../generalElection";

const PARTY_KEYS = [
	"LAB", "CON", "LD", "GREEN", "RUK", "UKIP", "BRX", "SNP", "PC",
	"DUP", "SF", "SDLP", "UUP", "APNI", "OTHER",
];

export function aggregateLocalElection(
	features: Features,
	codeProperty: PropertyKeys,
	data: LocalElectionDataset["data"],
): WardStats {
	const stats: WardStats = {
		partyVotes: { LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0, DUP: 0, PC: 0, SNP: 0, SF: 0, APNI: 0, SDLP: 0 },
		electorate: 0,
		totalVotes: 0,
	};
	for (const feature of features) {
		const ward = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!ward) continue;
		const source = ward.partyVotes;
		const target = stats.partyVotes;
		target.LAB = (target.LAB ?? 0) + (source.LAB ?? 0);
		target.CON = (target.CON ?? 0) + (source.CON ?? 0);
		target.LD = (target.LD ?? 0) + (source.LD ?? 0);
		target.GREEN = (target.GREEN ?? 0) + (source.GREEN ?? 0);
		target.REF = (target.REF ?? 0) + (source.REF ?? 0);
		target.IND = (target.IND ?? 0) + (source.IND ?? 0);
		target.DUP = (target.DUP ?? 0) + (source.DUP ?? 0);
		target.PC = (target.PC ?? 0) + (source.PC ?? 0);
		target.SNP = (target.SNP ?? 0) + (source.SNP ?? 0);
		target.SF = (target.SF ?? 0) + (source.SF ?? 0);
		target.APNI = (target.APNI ?? 0) + (source.APNI ?? 0);
		target.SDLP = (target.SDLP ?? 0) + (source.SDLP ?? 0);
		stats.electorate += ward.electorate;
		stats.totalVotes += ward.totalVotes;
	}
	return stats;
}

export function aggregateGeneralElection(
	features: Features,
	codeProperty: PropertyKeys,
	data: GeneralElectionDataset["data"],
): ConstituencyStats {
	const stats: ConstituencyStats = {
		totalSeats: 0, electorate: 0, validVotes: 0, invalidVotes: 0,
		partySeats: {}, totalVotes: 0, partyVotes: {},
	};
	for (const feature of features) {
		const constituency = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!constituency) continue;
		stats.totalSeats++;
		stats.electorate += constituency.electorate;
		stats.validVotes += constituency.validVotes;
		stats.invalidVotes += constituency.invalidVotes;
		const winner = getWinningParty(constituency);
		if (winner) stats.partySeats[winner] = (stats.partySeats[winner] || 0) + 1;
		for (const party of PARTY_KEYS) {
			const votes = constituency.partyVotes[party] ?? 0;
			if (votes > 0) {
				stats.totalVotes += votes;
				stats.partyVotes[party] = (stats.partyVotes[party] ?? 0) + votes;
			}
		}
	}
	return stats;
}

export function aggregateBrexit(
	features: Features,
	codeProperty: PropertyKeys,
	data: BrexitLADDataset["data"],
): AggregatedBrexitData {
	let totalLeave = 0, totalRemain = 0, totalVotes = 0, electorate = 0;
	for (const feature of features) {
		const area = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!area) continue;
		totalLeave += area.leave;
		totalRemain += area.remain;
		totalVotes += area.validVotes;
		electorate += area.electorate;
	}
	return {
		totalLeave, totalRemain, totalVotes, electorate,
		pctLeave: totalVotes > 0 ? totalLeave / totalVotes * 100 : 0,
		pctRemain: totalVotes > 0 ? totalRemain / totalVotes * 100 : 0,
	};
}

export function aggregateBrexitConstituencies(
	features: Features,
	codeProperty: PropertyKeys,
	data: BrexitConstituencyDataset["data"],
): AggregatedBrexitData {
	let totalLeave = 0, totalRemain = 0, count = 0;
	for (const feature of features) {
		const area = data[getFeatureProp(feature.properties, codeProperty) ?? ""];
		if (!area) continue;
		totalLeave += area.pctLeave;
		totalRemain += 100 - area.pctLeave;
		count++;
	}
	return {
		totalLeave, totalRemain, totalVotes: count, electorate: 0,
		pctLeave: count > 0 ? totalLeave / count : 0,
		pctRemain: count > 0 ? totalRemain / count : 0,
	};
}
