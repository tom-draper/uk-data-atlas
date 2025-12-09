// lib/utils/mapManager/statsCalculator.ts
import { BoundaryGeojson, PartyVotes, LocalElectionDataset, GeneralElectionDataset, PopulationDataset, WardStats, ConstituencyStats, AgeGroups, WardHousePriceData, AggregatedHousePriceData, PopulationStats, CrimeDataset } from '@lib/types';
import { calculateTotal, polygonAreaSqKm } from '../population';
import { getWinningParty } from '../generalElection';
import { calculateAgeGroups } from '../ageDistribution';
import { PropertyDetector } from './propertyDetector';
import { StatsCache } from './statsCache';

const PARTY_KEYS = ['LAB', 'CON', 'LD', 'GREEN', 'RUK', 'SNP', 'PC', 'DUP', 'SF', 'OTHER'];

export class StatsCalculator {
    constructor(
        private propertyDetector: PropertyDetector,
        private cache: StatsCache
    ) { }

    calculateLocalElectionStats(
        geojson: BoundaryGeojson,
        wardData: LocalElectionDataset['wardData'],
        location: string | null,
        datasetId: string | null
    ) {
        const cacheKey = `local-election-${location}-${datasetId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const wardCodeProp = this.propertyDetector.detectWardCode(geojson);
        console.log(`calculateLocalElectionStats: [${cacheKey}] Processing ${geojson.features.length} wards`);

        const stats: WardStats = {
            partyVotes: {
                LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0,
                DUP: 0, PC: 0, SNP: 0, SF: 0, APNI: 0, SDLP: 0
            },
            electorate: 0,
            totalVotes: 0
        };

        for (const feature of geojson.features) {
            const ward = wardData[feature.properties[wardCodeProp]];
            if (!ward) continue;

            for (const party in stats.partyVotes) {
                stats.partyVotes[party as keyof PartyVotes] += (ward.partyVotes[party as keyof PartyVotes] as number) || 0;
            }
            stats.electorate += ward.electorate;
            stats.totalVotes += ward.totalVotes;
        }

        this.cache.set(cacheKey, stats);
        return stats;
    }

    calculateGeneralElectionStats(
        geojson: BoundaryGeojson,
        constituencyData: GeneralElectionDataset['constituencyData'],
        location: string | null,
        datasetId: string | null
    ) {
        const cacheKey = `general-election-${location}-${datasetId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const constituencyCodeProp = this.propertyDetector.detectConstituencyCode(geojson);
        console.log(`calculateGeneralElectionStats: [${cacheKey}] Processing ${geojson.features.length} constituencies`);

        const stats: ConstituencyStats = {
            totalSeats: 0,
            electorate: 0,
            validVotes: 0,
            invalidVotes: 0,
            partySeats: {},
            totalVotes: 0,
            partyVotes: {},
        };

        for (const feature of geojson.features) {
            const constituency = constituencyData[feature.properties[constituencyCodeProp]];
            if (!constituency) continue;

            stats.totalSeats += 1;
            stats.electorate += constituency.electorate;
            stats.validVotes += constituency.validVotes;
            stats.invalidVotes += constituency.invalidVotes;

            const winningParty = getWinningParty(constituency);
            if (winningParty) {
                stats.partySeats[winningParty] = (stats.partySeats[winningParty] || 0) + 1;
            }

            for (const party of PARTY_KEYS) {
                const votes = constituency.partyVotes[party] || 0;
                if (votes > 0) {
                    stats.totalVotes += votes;
                    stats.partyVotes[party] = (stats.partyVotes[party] || 0) + votes;
                }
            }
        }

        this.cache.set(cacheKey, stats);
        return stats;
    }

    calculatePopulationStats(
        geojson: BoundaryGeojson,
        populationData: PopulationDataset['populationData'],
        location: string | null,
        datasetId: string | null
    ) {
        const cacheKey = `population-${location}-${datasetId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const wardCodeProp = this.propertyDetector.detectWardCode(geojson);
        console.log(`calculatePopulationStats: [${cacheKey}] Processing ${geojson.features.length} wards`);

        const aggregated = this.aggregatePopulationData(geojson, populationData, wardCodeProp);
        const result = this.buildPopulationStatsResult(aggregated);

        this.cache.set(cacheKey, result);
        return result;
    }

    calculateHousePriceStats(
        geojson: BoundaryGeojson,
        wardData: Record<string, WardHousePriceData>,
        location: string | null,
        datasetId: string | null
    ) {
        const cacheKey = `house-price-${location}-${datasetId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const wardCodeProp = this.propertyDetector.detectWardCode(geojson);
        console.log(`calculateHousePriceStats: [${cacheKey}] Processing ${geojson.features.length} wards`);

        const yearlyTotals: Record<number, number> = {};
        const yearlyCounts: Record<number, number> = {};
        let totalPrice = 0;
        let wardCount = 0;

        for (const feature of geojson.features) {
            const ward = wardData[feature.properties[wardCodeProp]];
            if (!ward) continue;

            for (const [year, price] of Object.entries(ward.prices)) {
                const yearNum = Number(year);
                if (price !== null && yearNum <= 2023) {
                    yearlyTotals[yearNum] = (yearlyTotals[yearNum] || 0) + price;
                    yearlyCounts[yearNum] = (yearlyCounts[yearNum] || 0) + 1;
                }
            }

            if (ward.prices[2023] !== null) {
                totalPrice += ward.prices[2023] ?? 0;
                wardCount += 1;
            }
        }

        const averagePrices: Record<number, number> = {};
        for (const year in yearlyTotals) {
            const yearNum = Number(year);
            averagePrices[yearNum] = yearlyTotals[yearNum] / yearlyCounts[yearNum];
        }

        const result: AggregatedHousePriceData[2023] = {
            averagePrice: wardCount > 0 ? totalPrice / wardCount : 0,
            wardCount,
            averagePrices
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    calculateCrimeStats(
        geojson: BoundaryGeojson,
        crimeData: CrimeDataset['records'],
        location: string | null,
        datasetId: string | null
    ) {
        const cacheKey = `crime-${location}-${datasetId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(geojson);
        console.log(`calculateCrimeStats: [${cacheKey}] Processing ${geojson.features.length} wards`);

        const result = {
            totalRecordedCrime: 0,
            wardCount: 0
        };

        for (const feature of geojson.features) {
            const area = crimeData[feature.properties[ladCodeProp]];
            if (!area) continue;

            if (area.totalRecordedCrime !== null && area.totalRecordedCrime !== undefined) {
                result.totalRecordedCrime += area.totalRecordedCrime;
                result.wardCount += 1;
            }
        }

        this.cache.set(cacheKey, result);
        return result;
    }

    private aggregatePopulationData(
        geojson: BoundaryGeojson,
        populationData: PopulationDataset['populationData'],
        wardCodeProp: string
    ) {
        const aggregated = {
            totalPop: 0,
            malesPop: 0,
            femalesPop: 0,
            totalArea: 0,
            ageGroups: {
                total: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups,
                males: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups,
                females: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups
            },
            ageData: {} as Record<string, number>,
            males: {} as Record<string, number>,
            females: {} as Record<string, number>
        };

        for (const feature of geojson.features) {
            const ward = populationData[feature.properties[wardCodeProp]];
            if (!ward) continue;

            aggregated.totalPop += calculateTotal(ward.total);
            aggregated.malesPop += calculateTotal(ward.males);
            aggregated.femalesPop += calculateTotal(ward.females);

            const wardAgeGroups = {
                total: calculateAgeGroups(ward.total),
                males: calculateAgeGroups(ward.males),
                females: calculateAgeGroups(ward.females)
            };

            for (const ageGroup in aggregated.ageGroups.total) {
                const key = ageGroup as keyof AgeGroups;
                aggregated.ageGroups.total[key] += wardAgeGroups.total[key];
                aggregated.ageGroups.males[key] += wardAgeGroups.males[key];
                aggregated.ageGroups.females[key] += wardAgeGroups.females[key];
            }

            for (const [age, count] of Object.entries(ward.total)) {
                aggregated.ageData[age] = (aggregated.ageData[age] || 0) + count;
            }

            for (const [age, count] of Object.entries(ward.males)) {
                aggregated.males[age] = (aggregated.males[age] || 0) + count;
            }

            for (const [age, count] of Object.entries(ward.females)) {
                aggregated.females[age] = (aggregated.females[age] || 0) + count;
            }

            aggregated.totalArea += polygonAreaSqKm(feature.geometry.coordinates);
        }

        return aggregated;
    }

    private buildPopulationStatsResult(aggregated: any) {
        const populationStats: PopulationStats = {
            total: aggregated.totalPop,
            males: aggregated.malesPop,
            females: aggregated.femalesPop,
            ageGroups: aggregated.ageGroups,
            isWardSpecific: false
        };

        const ages = Array.from({ length: 100 }, (_, i) => ({
            age: i,
            count: aggregated.ageData[i.toString()] || 0
        }));

        // Distribute 90+ age data
        const age90Plus = ages[90].count;
        const decayRate = 0.15;
        const weights = Array.from({ length: 10 }, (_, i) => Math.exp(-decayRate * i));
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);

        for (let i = 90; i < 100; i++) {
            ages[i] = { age: i, count: (age90Plus * weights[i - 90]) / totalWeight };
        }

        const genderAgeData = Array.from({ length: 91 }, (_, age) => ({
            age,
            males: aggregated.males[age.toString()] || 0,
            females: aggregated.females[age.toString()] || 0
        }));

        let medianAge = 0;
        if (aggregated.totalPop > 0) {
            const halfPop = aggregated.totalPop / 2;
            let cumulative = 0;
            for (const { age, count } of ages) {
                cumulative += count;
                if (cumulative >= halfPop) {
                    medianAge = age;
                    break;
                }
            }
        }

        const density = aggregated.totalArea > 0 ? aggregated.totalPop / aggregated.totalArea : 0;

        return {
            populationStats,
            ageData: aggregated.ageData,
            ages,
            genderAgeData,
            medianAge,
            totalArea: aggregated.totalArea,
            density,
        };
    }
}