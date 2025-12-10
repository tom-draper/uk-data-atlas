// lib/utils/mapManager/statsCalculator.ts
import { BoundaryGeojson, PartyVotes, LocalElectionDataset, GeneralElectionDataset, PopulationDataset, WardStats, ConstituencyStats, AgeGroups, WardHousePriceData, AggregatedHousePriceData, PopulationStats, CrimeDataset } from '@lib/types';
import { calculateTotal, polygonAreaSqKm } from '../population';
import { getWinningParty } from '../generalElection';
import { calculateAgeGroups } from '../ageDistribution';
import { PropertyDetector } from './propertyDetector';
import { StatsCache } from './statsCache';
import { IncomeDataset } from '@/lib/types/income';

const PARTY_KEYS = ['LAB', 'CON', 'LD', 'GREEN', 'RUK', 'SNP', 'PC', 'DUP', 'SF', 'OTHER'];

// Pre-computed decay weights for age 90+ distribution
const AGE_90_WEIGHTS = (() => {
    const decayRate = 0.15;
    const weights = Array.from({ length: 10 }, (_, i) => Math.exp(-decayRate * i));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    return weights.map(w => w / totalWeight);
})();

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

        const wardCodeProp = this.propertyDetector.detectWardCode(geojson.features);
        const features = geojson.features;
        const len = features.length;

        const stats: WardStats = {
            partyVotes: {
                LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0,
                DUP: 0, PC: 0, SNP: 0, SF: 0, APNI: 0, SDLP: 0
            },
            electorate: 0,
            totalVotes: 0
        };

        // Single pass aggregation with direct property access
        for (let i = 0; i < len; i++) {
            const ward = wardData[features[i].properties[wardCodeProp]];
            if (!ward) continue;

            const partyVotes = ward.partyVotes;
            stats.partyVotes.LAB += partyVotes.LAB || 0;
            stats.partyVotes.CON += partyVotes.CON || 0;
            stats.partyVotes.LD += partyVotes.LD || 0;
            stats.partyVotes.GREEN += partyVotes.GREEN || 0;
            stats.partyVotes.REF += partyVotes.REF || 0;
            stats.partyVotes.IND += partyVotes.IND || 0;
            stats.partyVotes.DUP += partyVotes.DUP || 0;
            stats.partyVotes.PC += partyVotes.PC || 0;
            stats.partyVotes.SNP += partyVotes.SNP || 0;
            stats.partyVotes.SF += partyVotes.SF || 0;
            stats.partyVotes.APNI += partyVotes.APNI || 0;
            stats.partyVotes.SDLP += partyVotes.SDLP || 0;
            
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

        const constituencyCodeProp = this.propertyDetector.detectConstituencyCode(geojson.features);
        const features = geojson.features;
        const len = features.length;

        const stats: ConstituencyStats = {
            totalSeats: 0,
            electorate: 0,
            validVotes: 0,
            invalidVotes: 0,
            partySeats: {},
            totalVotes: 0,
            partyVotes: {},
        };

        for (let i = 0; i < len; i++) {
            const constituency = constituencyData[features[i].properties[constituencyCodeProp]];
            if (!constituency) continue;

            stats.totalSeats++;
            stats.electorate += constituency.electorate;
            stats.validVotes += constituency.validVotes;
            stats.invalidVotes += constituency.invalidVotes;

            const winningParty = getWinningParty(constituency);
            if (winningParty) {
                stats.partySeats[winningParty] = (stats.partySeats[winningParty] || 0) + 1;
            }

            // Direct key access is faster than loop
            const pv = constituency.partyVotes;
            for (let j = 0; j < PARTY_KEYS.length; j++) {
                const party = PARTY_KEYS[j];
                const votes = pv[party] || 0;
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

        const wardCodeProp = this.propertyDetector.detectWardCode(geojson.features);
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

        const wardCodeProp = this.propertyDetector.detectWardCode(geojson.features);
        const features = geojson.features;
        const len = features.length;

        const yearlyTotals: Record<number, number> = {};
        const yearlyCounts: Record<number, number> = {};
        let totalPrice = 0;
        let wardCount = 0;

        for (let i = 0; i < len; i++) {
            const ward = wardData[features[i].properties[wardCodeProp]];
            if (!ward) continue;

            const prices = ward.prices;
            const price2023 = prices[2023];
            
            if (price2023 !== null && price2023 !== undefined) {
                totalPrice += price2023;
                wardCount++;
            }

            // Use Object.keys for better performance with small objects
            const years = Object.keys(prices);
            for (let j = 0; j < years.length; j++) {
                const yearNum = Number(years[j]);
                const price = prices[yearNum];
                if (price !== null && yearNum <= 2023) {
                    yearlyTotals[yearNum] = (yearlyTotals[yearNum] || 0) + price;
                    yearlyCounts[yearNum] = (yearlyCounts[yearNum] || 0) + 1;
                }
            }
        }

        const averagePrices: Record<number, number> = {};
        const yearKeys = Object.keys(yearlyTotals);
        for (let i = 0; i < yearKeys.length; i++) {
            const yearNum = Number(yearKeys[i]);
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

        const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(geojson.features);
        const features = geojson.features;
        const len = features.length;

        let totalRecordedCrime = 0;
        let wardCount = 0;

        for (let i = 0; i < len; i++) {
            const area = crimeData[features[i].properties[ladCodeProp]];
            if (!area) continue;

            const crime = area.totalRecordedCrime;
            if (crime !== null && crime !== undefined) {
                totalRecordedCrime += crime;
                wardCount++;
            }
        }

        const result = { totalRecordedCrime, wardCount };
        this.cache.set(cacheKey, result);
        return result;
    }

    calculateIncomeStats(
        geojson: BoundaryGeojson,
        incomeData: IncomeDataset['localAuthorityData'],
        location: string | null,
        datasetId: string | null
    ) {
        const cacheKey = `income-${location}-${datasetId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const ladCodeProp = this.propertyDetector.detectLocalAuthorityCode(geojson.features);
        const features = geojson.features;
        const len = features.length;

        let totalMedianIncome = 0;
        let localAuthorityCount = 0;

        for (let i = 0; i < len; i++) {
            const locationIncome = incomeData[features[i].properties[ladCodeProp]];
            if (locationIncome?.annual?.median) {
                totalMedianIncome += locationIncome.annual.median;
                localAuthorityCount++;
            }
        }

        const result = {
            averageIncome: localAuthorityCount > 0 ? totalMedianIncome / localAuthorityCount : 0
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    private aggregatePopulationData(
        geojson: BoundaryGeojson,
        populationData: PopulationDataset['populationData'],
        wardCodeProp: string
    ) {
        const features = geojson.features;
        const len = features.length;

        // Pre-allocate objects
        const ageData: Record<string, number> = {};
        const males: Record<string, number> = {};
        const females: Record<string, number> = {};

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
            ageData,
            males,
            females
        };

        for (let i = 0; i < len; i++) {
            const ward = populationData[features[i].properties[wardCodeProp]];
            if (!ward) continue;

            aggregated.totalPop += calculateTotal(ward.total);
            aggregated.malesPop += calculateTotal(ward.males);
            aggregated.femalesPop += calculateTotal(ward.females);

            const wardAgeGroups = {
                total: calculateAgeGroups(ward.total),
                males: calculateAgeGroups(ward.males),
                females: calculateAgeGroups(ward.females)
            };

            // Direct key access faster than loop
            aggregated.ageGroups.total['0-17'] += wardAgeGroups.total['0-17'];
            aggregated.ageGroups.total['18-29'] += wardAgeGroups.total['18-29'];
            aggregated.ageGroups.total['30-44'] += wardAgeGroups.total['30-44'];
            aggregated.ageGroups.total['45-64'] += wardAgeGroups.total['45-64'];
            aggregated.ageGroups.total['65+'] += wardAgeGroups.total['65+'];

            aggregated.ageGroups.males['0-17'] += wardAgeGroups.males['0-17'];
            aggregated.ageGroups.males['18-29'] += wardAgeGroups.males['18-29'];
            aggregated.ageGroups.males['30-44'] += wardAgeGroups.males['30-44'];
            aggregated.ageGroups.males['45-64'] += wardAgeGroups.males['45-64'];
            aggregated.ageGroups.males['65+'] += wardAgeGroups.males['65+'];

            aggregated.ageGroups.females['0-17'] += wardAgeGroups.females['0-17'];
            aggregated.ageGroups.females['18-29'] += wardAgeGroups.females['18-29'];
            aggregated.ageGroups.females['30-44'] += wardAgeGroups.females['30-44'];
            aggregated.ageGroups.females['45-64'] += wardAgeGroups.females['45-64'];
            aggregated.ageGroups.females['65+'] += wardAgeGroups.females['65+'];

            // Aggregate age data
            const totalEntries = Object.entries(ward.total);
            for (let j = 0; j < totalEntries.length; j++) {
                const [age, count] = totalEntries[j];
                ageData[age] = (ageData[age] || 0) + count;
            }

            const malesEntries = Object.entries(ward.males);
            for (let j = 0; j < malesEntries.length; j++) {
                const [age, count] = malesEntries[j];
                males[age] = (males[age] || 0) + count;
            }

            const femalesEntries = Object.entries(ward.females);
            for (let j = 0; j < femalesEntries.length; j++) {
                const [age, count] = femalesEntries[j];
                females[age] = (females[age] || 0) + count;
            }

            aggregated.totalArea += polygonAreaSqKm(features[i].geometry.coordinates);
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

        // Pre-allocate arrays
        const ages = new Array(100);
        for (let i = 0; i < 100; i++) {
            ages[i] = {
                age: i,
                count: aggregated.ageData[i.toString()] || 0
            };
        }

        // Distribute 90+ age data using pre-computed weights
        const age90Plus = ages[90].count;
        for (let i = 90; i < 100; i++) {
            ages[i] = { 
                age: i, 
                count: age90Plus * AGE_90_WEIGHTS[i - 90]
            };
        }

        // Pre-allocate gender age data
        const genderAgeData = new Array(91);
        for (let age = 0; age < 91; age++) {
            genderAgeData[age] = {
                age,
                males: aggregated.males[age.toString()] || 0,
                females: aggregated.females[age.toString()] || 0
            };
        }

        // Calculate median age
        let medianAge = 0;
        if (aggregated.totalPop > 0) {
            const halfPop = aggregated.totalPop / 2;
            let cumulative = 0;
            for (let i = 0; i < 100; i++) {
                cumulative += ages[i].count;
                if (cumulative >= halfPop) {
                    medianAge = ages[i].age;
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