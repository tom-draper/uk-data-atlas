// lib/utils/electionUtils.ts
import Papa from 'papaparse';
import { LocalElectionDataset, WardData } from '@lib/types/index';
import { PARTY_INFO } from '@/lib/data/election/parties';
import { ElectionSourceConfig } from './config';

const KNOWN_PARTIES = ['LAB', 'CON', 'LD', 'GREEN', 'REF', 'IND'];

const detectPartyColumns = (headers: string[]) =>
    headers.filter(h => KNOWN_PARTIES.includes(h.toUpperCase().trim()));

const parseNumber = (val: any) => {
    if (!val) return 0;
    const clean = String(val).replace(/,|%/g, '').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

const findWinner = (votes: Record<string, number>): string => {
    return Object.entries(votes).reduce((winner, [party, count]) =>
        count > (votes[winner] || 0) ? party : winner, 'OTHER');
};

export const fetchAndParseCsv = async (config: ElectionSourceConfig): Promise<LocalElectionDataset> => {
    const res = await fetch(config.url);
    let text = await res.text();

    // Heuristic: Skip metadata lines if they exist (detecting "Local authority name")
    // This replaces the hardcoded line splitting
    if (!text.startsWith(config.fields.ladName) && !text.startsWith('WD24')) {
        const lines = text.split('\n');
        const headerIndex = lines.findIndex(l => l.includes(config.fields.name) || l.includes(config.fields.ladName));
        if (headerIndex > -1) text = lines.slice(headerIndex).join('\n');
    }

    return new Promise((resolve, reject) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const partyCols = detectPartyColumns(results.meta.fields || []);
                const wardWinners: Record<string, string> = {};
                const wardData: Record<string, WardData> = {};
                const unmapped: any[] = [];

                results.data.forEach(row => {
                    // Extract party votes
                    const partyVotes: Record<string, number> = {};
                    partyCols.forEach(p => partyVotes[p] = parseNumber(row[p]));

                    // Normalize core data
                    const laName = row[config.fields.ladName] || row['COUNTYNAME'] || 'Unknown'; // Fallback for 2023
                    const wName = row[config.fields.name];
                    const wCode = row[config.fields.code]?.trim();

                    const entry: WardData = {
                        wardCode: wCode,
                        wardName: wName,
                        localAuthorityName: laName,
                        localAuthorityCode: row[config.fields.ladCode || ''] || 'Unknown',
                        turnoutPercent: parseNumber(row[config.fields.turnout]),
                        electorate: parseNumber(row[config.fields.electorate]),
                        totalVotes: parseNumber(row[config.fields.totalVotes || '']),
                        partyVotes
                    };

                    // Handle mapped vs unmapped (2023 case)
                    if (wCode) {
                        wardWinners[wCode] = findWinner(partyVotes);
                        wardData[wCode] = entry;
                    } else {
                        // Store raw unmapped data for post-processing
                        unmapped.push({ ...entry, winningParty: findWinner(partyVotes) });
                    }
                });

                resolve({
                    id: `localElection${config.year}`,
                    type: 'localElection',
                    year: config.year,
                    boundaryYear: config.year,
                    boundaryType: 'ward',
                    results: wardWinners,
                    data: wardData,
                    partyInfo: PARTY_INFO,
                    // @ts-ignore - attaching temporary unmapped data
                    _unmapped: unmapped.length > 0 ? unmapped : undefined
                });
            },
            error: reject
        });
    });
};

export const reconcile2023Data = (
    dataset2023: LocalElectionDataset,
    referenceSets: LocalElectionDataset[]
): LocalElectionDataset => {
    // @ts-ignore
    if (!dataset2023._unmapped) return dataset2023;

    // Build Lookup Map
    const lookup = new Map<string, string>();
    referenceSets.forEach(ds => {
        Object.entries(ds.data).forEach(([code, data]) => {
            const key = `${data.localAuthorityName}|${data.wardName}`.toLowerCase();
            if (!lookup.has(key)) lookup.set(key, code);
        });
    });

    // Apply lookup
    // @ts-ignore
    dataset2023._unmapped.forEach((item: any) => {
        const key = `${item.localAuthorityName}|${item.wardName}`.toLowerCase();
        const code = lookup.get(key);

        if (code) {
            dataset2023.results[code] = item.winningParty;
            dataset2023.data[code] = {
                ...item,
                localAuthorityCode: code.substring(0, 9) // Infer LA code from Ward Code
            };
        }
    });

    // cleanup
    // @ts-ignore
    delete dataset2023._unmapped;
    return dataset2023;
};