'use client';

interface Dataset {
    name: string;
    source: string;
    sourceUrl: string;
    year: string;
    licence: string;
    licenceUrl: string;
    description: string;
}

const datasets: Dataset[] = [
    {
        name: 'General Election Results',
        source: 'House of Commons Library',
        sourceUrl: 'https://www.electoralcommission.org.uk/',
        year: '2010, 2015, 2017, 2019, 2024',
        licence: 'Open Parliament Licence',
        licenceUrl: 'https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/',
        description: 'Aggregated local election results by ward/year for trend analysis.'
    },
    {
        name: 'Local Election Results',
        source: 'House of Commons Library',
        sourceUrl: 'https://www.electoralcommission.org.uk/',
        year: '2021, 2022, 2023, 2024',
        licence: 'Open Parliament Licence',
        licenceUrl: 'https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/',
        description: 'Aggregated local election results by ward/year for trend analysis.'
    },
    {
        name: 'Population Estimates',
        source: 'Office for National Statistics',
        sourceUrl: 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates',
        year: '2020',
        licence: 'Open Government Licence v3.0',
        licenceUrl: 'http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
        description: 'Ward-level population data estimates including age and gender used for per-capita comparisons.'
    },
    {
        name: 'Westminster Parliamentary Wards (Boundaries)',
        source: 'ONS Open Geography Portal',
        sourceUrl: 'https://geoportal.statistics.gov.uk/',
        year: 'December 2021, 2022, 2023, 2024',
        licence: 'Open Government Licence v3.0',
        licenceUrl: 'http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
        description: 'UK electoral ward boundaries used for map visualisation layers.'
    },
    {
        name: 'Westminster Parliamentary Constituencies (Boundaries)',
        source: 'ONS Open Geography Portal',
        sourceUrl: 'https://geoportal.statistics.gov.uk/',
        year: 'July 2024',
        licence: 'Open Government Licence v3.0',
        licenceUrl: 'http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
        description: 'UK parliamentary constituencies used to match constituency-level election data to spatial boundaries.'
    }
];

export default function DatasetsPage() {
    return (
        <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-8">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Datasets</h1>

                <div className="bg-[rgba(255,255,255,0.7)] rounded-lg backdrop-blur-md shadow-sm border border-white/40 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-white/50 border-b border-white/30">
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Dataset</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Source</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Year</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Licence</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {datasets.map((dataset, idx) => (
                                    <tr
                                        key={idx}
                                        className="border-b border-white/20 hover:bg-white/30 transition-colors duration-150 last:border-b-0"
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{dataset.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">
                                            <a
                                                href={dataset.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-700 underline"
                                            >
                                                {dataset.source}
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{dataset.year}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">
                                            <a
                                                href={dataset.licenceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-700 underline"
                                            >
                                                {dataset.licence}
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{dataset.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}