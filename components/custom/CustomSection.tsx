import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, AlertCircle } from 'lucide-react';
import { ActiveViz, BoundaryType, CustomDataset, AggregatedCustomData, BoundaryCodes } from '@/lib/types';

interface MatchResult {
    type: string;
    percentage: number;
    matchCount: number;
    totalCodes: number;
}

interface UploadData {
    file: string;
    headerRow: number;
    selectedColumn: string;
    dataColumn: string;
    boundaryType: string;
    boundaryYear: number | null;
    year: number | null;
    data: string[][];
}

interface SelectedArea {
    code: string;
    name: string;
    type: BoundaryType;
}

const BOUNDARY_TYPE_LABELS: Record<string, string> = {
    ward: 'Ward Boundaries',
    constituency: 'Westminster Parliamentary Constituency Boundaries',
    localAuthority: 'Local Authority Boundaries'
};

function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell.trim());
                if (currentRow.some(cell => cell)) rows.push(currentRow);
                currentRow = [];
                currentCell = '';
            }
        } else {
            currentCell += char;
        }
    }

    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell)) rows.push(currentRow);
    }

    return rows;
}

function getBoundaryLabel(type: string): string {
    return BOUNDARY_TYPE_LABELS[type] || BOUNDARY_TYPE_LABELS.localAuthority;
}

function getMatchColorClass(percentage: number): string {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    if (percentage > 0) return 'text-orange-600';
    return 'text-gray-500/80';
}

function getMatchButtonClass(isSelected: boolean, hasMatches: boolean): string {
    if (isSelected) return 'bg-white backdrop-blur text-gray-700 cursor-pointer';
    if (hasMatches) return 'border-gray-200 opacity-80 backdrop-blur-xs hover:bg-white cursor-pointer';
    return 'border-gray-100 bg-white/20 backdrop-blur opacity-50 cursor-not-allowed';
}

function UploadModal({
    isOpen,
    onClose,
    onUpload,
    boundaryCodes,
}: {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (data: UploadData) => void;
    boundaryCodes: BoundaryCodes;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [csvData, setCsvData] = useState<string[][]>([]);
    const [headerRow, setHeaderRow] = useState(0);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [dataColumn, setDataColumn] = useState('');
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [selectedCodeType, setSelectedCodeType] = useState('');
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const headers = csvData[headerRow] || [];
    const previewRows = csvData.slice(0, Math.min(headerRow + 21, csvData.length));
    const validMatches = matches.filter(match => match.percentage > 0);

    const resetForm = () => {
        setFile(null);
        setCsvData([]);
        setHeaderRow(0);
        setSelectedColumn('');
        setDataColumn('');
        setMatches([]);
        setSelectedCodeType('');
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        if (!selectedFile.name.endsWith('.csv')) {
            setError('Please select a CSV file');
            return;
        }

        setFile(selectedFile);
        setError('');

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const rows = parseCSV(text);
            setCsvData(rows);
            setHeaderRow(0);

            if (rows.length > 0) {
                const codeColumn = rows[0].find(h =>
                    /code|area|ward|constituency|authority/i.test(h)
                );
                if (codeColumn) setSelectedColumn(codeColumn);
            }
        };
        reader.readAsText(selectedFile);
    };

    const calculateMatches = (columnData: string[]): MatchResult[] => {
        if (!boundaryCodes || columnData.length === 0) return [];

        const uniqueCodes = new Set(columnData.filter(code => code?.trim()));
        const results: MatchResult[] = [];

        for (const [type, yearData] of Object.entries(boundaryCodes)) {
            for (const [year, codeSet] of Object.entries(yearData)) {
                const matchCount = [...uniqueCodes].filter(code => codeSet.has(code)).length;

                results.push({
                    type: `${getBoundaryLabel(type)} [${year}]`,
                    percentage: (matchCount / uniqueCodes.size) * 100,
                    matchCount,
                    totalCodes: uniqueCodes.size
                });
            }
        }

        return results.sort((a, b) => b.percentage - a.percentage);
    };

    useEffect(() => {
        if (csvData.length > headerRow && selectedColumn) {
            const columnIndex = headers.indexOf(selectedColumn);

            if (columnIndex !== -1) {
                const columnData = csvData
                    .slice(headerRow + 1)
                    .map(row => row[columnIndex])
                    .filter(val => val?.trim());

                const matchResults = calculateMatches(columnData);
                setMatches(matchResults);
                setSelectedCodeType(matchResults[0]?.percentage > 0 ? matchResults[0].type : '');
            }
        }
    }, [csvData, headerRow, selectedColumn]);

    const handleUpload = () => {
        if (!file || !selectedColumn || !dataColumn || !selectedCodeType) {
            setError('Please select a file, area code column, data column, and matching area type');
            return;
        }

        let boundaryType: string = 'localAuthority';
        if (selectedCodeType.includes('Ward')) {
            boundaryType = 'ward';
        } else if (selectedCodeType.includes('Westminster')) {
            boundaryType = 'constituency';
        }

        const match = selectedCodeType.match(/\[(\d{4})\]/);
        const boundaryYear = match ? parseInt(match[1]) : null;

        onUpload({
            file: file.name,
            headerRow,
            selectedColumn,
            dataColumn,
            year: boundaryYear,
            boundaryType,
            boundaryYear,
            data: csvData
        });

        handleClose();
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative bg-white/80 backdrop-blur-md border border-white/30 rounded-md shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-4 pt-2.5 pb-2 shrink-0 bg-white/20">
                    <h2 className="text-sm font-semibold text-gray-900/80">
                        Upload Custom Dataset
                    </h2>
                    <button onClick={handleClose} className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {!file && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">
                                    Select CSV File
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full border-2 border-dashed cursor-pointer border-gray-300 rounded-md p-8 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col items-center gap-2"
                                >
                                    <Upload size={28} className="text-gray-400" />
                                    <span className="text-xs text-gray-500 font-medium">
                                        Click to select CSV file
                                    </span>
                                </button>
                            </div>
                        )}

                        {csvData.length > 0 && (
                            <>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                                        Header Row
                                    </label>
                                    <select
                                        value={headerRow}
                                        onChange={(e) => setHeaderRow(Number(e.target.value))}
                                        className="w-full backdrop-blur cursor-pointer rounded-md px-3 py-2 pr-8 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        {csvData.slice(0, 10).map((row, idx) => (
                                            <option key={idx} value={idx}>
                                                Row {idx + 1}: {row.join(', ').slice(0, 100)}...
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                                        Select Area Code Column
                                    </label>
                                    <select
                                        value={selectedColumn}
                                        onChange={(e) => setSelectedColumn(e.target.value)}
                                        className="w-full backdrop-blur cursor-pointer rounded-md px-3 py-2 pr-8 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">Select column</option>
                                        {headers.map((header, idx) => (
                                            <option key={idx} value={header}>
                                                {header || `Column ${idx + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {matches.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                                            Available Boundaries
                                        </label>
                                        {validMatches.length === 0 ? (
                                            <div className="px-3 py-2 rounded-md bg-gray-50 text-center">
                                                <p className="text-xs text-gray-400">No boundaries matched</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                                {validMatches.map((match) => (
                                                    <button
                                                        key={match.type}
                                                        onClick={() => setSelectedCodeType(match.type)}
                                                        className={`w-full px-4 py-2 rounded-md transition-all text-left ${getMatchButtonClass(
                                                            selectedCodeType === match.type,
                                                            match.percentage > 0
                                                        )}`}
                                                    >
                                                        <div className="flex items-center justify-between gap-1">
                                                            <div className={`text-xs min-w-12.5 ${getMatchColorClass(match.percentage)}`}>
                                                                {match.percentage.toFixed(0)}%
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="text-xs text-gray-700">
                                                                    {match.type}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                                        Select Data Column
                                    </label>
                                    <select
                                        value={dataColumn}
                                        onChange={(e) => setDataColumn(e.target.value)}
                                        className="w-full backdrop-blur cursor-pointer rounded-md px-3 py-2 pr-8 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">Select column</option>
                                        {headers.map((header, idx) => (
                                            <option key={idx} value={header}>
                                                {header || `Column ${idx + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                                        Data Preview
                                    </label>
                                    <div className="rounded-md overflow-hidden">
                                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <thead className="sticky top-0 backdrop-blur">
                                                    <tr>
                                                        {headers.map((header, idx) => (
                                                            <th
                                                                key={idx}
                                                                className={`px-4 py-2 text-left font-medium whitespace-nowrap ${header === selectedColumn
                                                                    ? 'bg-indigo-100/70 text-indigo-900'
                                                                    : header === dataColumn
                                                                        ? 'bg-green-100/70 text-green-900'
                                                                        : 'text-gray-700'
                                                                    }`}
                                                            >
                                                                {header || `Col ${idx + 1}`}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {previewRows.slice(headerRow + 1).map((row, rowIdx) => (
                                                        <tr key={rowIdx} className={`hover:bg-white/40 ${rowIdx % 2 === 1 ? 'bg-white/20' : ''}`}>
                                                            {row.map((cell, cellIdx) => (
                                                                <td
                                                                    key={cellIdx}
                                                                    className={`px-4 py-2 whitespace-nowrap ${headers[cellIdx] === selectedColumn
                                                                        ? 'bg-indigo-50'
                                                                        : headers[cellIdx] === dataColumn
                                                                            ? 'bg-green-50'
                                                                            : ''
                                                                        }`}
                                                                >
                                                                    {cell}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-3 py-2 pb-2.5 bg-white/20 shrink-0">
                    <button
                        onClick={handleClose}
                        className="cursor-pointer rounded-sm px-3 py-1 text-xs hover:bg-white/20 transition-all duration-200 text-gray-500 hover:text-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        className="cursor-pointer border border-white/20 rounded-sm px-3 py-1 text-xs bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 shadow-sm text-gray-500 hover:text-gray-600"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

function CustomDatasetCard({
    customDataset,
    aggregatedData,
    selectedArea,
    isActive,
    setActiveViz,
    codeMapper,
}: {
    customDataset: CustomDataset;
    aggregatedData: {[year: number]: AggregatedCustomData} | null;
    selectedArea: SelectedArea | null;
    isActive: boolean;
    setActiveViz: (value: ActiveViz) => void;
    codeMapper: {
        getCodeForYear: (
            type: BoundaryType,
            code: string,
            targetYear: number,
        ) => string | undefined;
        getWardsForLad: (ladCode: string, year: number) => string[];
    }
}) {
    const displayValue = useMemo(() => {
        if (!customDataset || !customDataset.data) return null;

        if (selectedArea) {
            const value = customDataset.data[selectedArea.code];

            if (value !== undefined) {
                return { value, count: 1 };
            }

            // Try to make the code to a different year
            if (codeMapper && customDataset.boundaryYear) {
                const mappedCode = codeMapper.getCodeForYear(
                    selectedArea.type,
                    selectedArea.code,
                    customDataset.boundaryYear
                );
                if (mappedCode) {
                    const mappedValue = customDataset.data[mappedCode];
                    if (mappedValue !== undefined) {
                        return { value: mappedValue, count: 1 };
                    }
                }
            }

            // Aggregate wards for local authority
            if (selectedArea.type === 'localAuthority' && codeMapper && customDataset.boundaryYear) {
                const wardCodes = codeMapper.getWardsForLad(selectedArea.code, customDataset.boundaryYear);

                if (wardCodes.length > 0) {
                    let sum = 0;
                    let count = 0;

                    for (const wardCode of wardCodes) {
                        let value = customDataset.data[wardCode];

                        // Try to map ward code to dataset year if not found
                        if (value === undefined) {
                            const mappedCode = codeMapper.getCodeForYear('ward', wardCode, customDataset.boundaryYear);
                            if (mappedCode) {
                                value = customDataset.data[mappedCode];
                            }
                        }

                        if (value !== undefined) {
                            sum += value;
                            count++;
                        }
                    }

                    if (count > 0) {
                        return { value: sum, count };
                    }
                }
            }
        }

        if (aggregatedData && aggregatedData[customDataset.year]) {
            const average = aggregatedData[customDataset.year].average;
            const count = aggregatedData[customDataset.year].count;
            return { value: average, count };
        }

        return null;
    }, [customDataset, selectedArea, codeMapper]);

    const handleClick = () => {
        setActiveViz({
            vizId: 'custom',
            datasetType: 'custom',
            datasetYear: customDataset.boundaryYear,
        });
    };

    if (!customDataset) return null;

    return (
        <button
            onClick={handleClick}
            className={`w-full rounded-md transition-all border-2 duration-200 text-left border-gray-200 ${isActive
                ? 'bg-white/90 border-indigo-300 cursor-pointer'
                : 'bg-white/40 hover:bg-white/60 hover:border-indigo-300 cursor-pointer'
                }`}
        >
            <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-bold text-gray-700">
                        {customDataset.dataColumn} [{customDataset.boundaryYear}]
                    </div>
                </div>

                {/* Fixed height container */}
                <div className="h-6 flex items-center">
                    {displayValue ? (
                        <div className="text-sm font-semibold text-gray-900">
                            {displayValue.value.toLocaleString('en-GB', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2
                            })}
                            {displayValue.count > 1 && (
                                <span className="text-xs text-gray-500 ml-1">
                                    (aggregated from {displayValue.count} wards)
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400">
                            {selectedArea ? 'No data available' : 'Hover over an area'}
                        </div>
                    )}
                </div>

                <div className="text-xs text-gray-500 mt-1">
                    {customDataset.name}
                </div>
            </div>
        </button>
    );
}

export default function CustomSection({
    customDataset,
    setCustomDataset,
    aggregatedData,
    selectedArea,
    boundaryCodes,
    activeViz,
    setActiveViz,
    codeMapper,
}: {
    customDataset: CustomDataset | null;
    setCustomDataset: (dataset: CustomDataset | null) => void;
    aggregatedData: Record<number, AggregatedCustomData> | null;
    selectedArea: SelectedArea | null;
    boundaryCodes: BoundaryCodes;
    activeViz: ActiveViz;
    setActiveViz: (value: ActiveViz) => void;
    codeMapper?: {
        getCodeForYear: (type: BoundaryType, code: string, targetYear: number) => string | undefined;
        getWardsForLad: (ladCode: string, year: number) => string[];
    };
}) {
    const [isOpen, setIsOpen] = useState(false);

    const handleCustomDatasetApply = (data: UploadData) => {
        if (data.boundaryYear === null || data.boundaryType === null) {
            return;
        }

        const columnIndex = data.data[data.headerRow].indexOf(data.selectedColumn);
        const dataIndex = data.data[data.headerRow].indexOf(data.dataColumn);

        const newDataset: CustomDataset = {
            type: 'custom',
            name: data.file,
            year: data.boundaryYear,
            boundaryType: data.boundaryType as BoundaryType,
            boundaryYear: data.boundaryYear,
            dataColumn: data.dataColumn,
            data: {},
        };

        data.data.slice(data.headerRow + 1).forEach(row => {
            const code = row[columnIndex]?.trim();
            const value = parseFloat(row[dataIndex]);

            if (code && !isNaN(value)) {
                newDataset.data[code] = value;
            }
        });

        setCustomDataset(newDataset);
        setActiveViz({
            vizId: 'custom',
            datasetType: 'custom',
            datasetYear: data.boundaryYear,
        });

        setIsOpen(false);
    };

    return (
        <>
            <div className="space-y-2 border-t border-gray-200 pt-4">
                <h3 className="text-xs font-bold text-gray-700">Custom Dataset</h3>

                {customDataset && codeMapper ? (
                    <CustomDatasetCard
                        customDataset={customDataset}
                        aggregatedData={aggregatedData}
                        selectedArea={selectedArea}
                        isActive={activeViz.datasetType === 'custom'}
                        setActiveViz={setActiveViz}
                        codeMapper={codeMapper}
                    />
                ) : customDataset ? (
                    <div className="text-xs text-gray-500">Loading...</div>
                ) : (
                    <button
                        onClick={() => setIsOpen(true)}
                        className="w-full p-3 rounded-md transition-all duration-200 border-2 border-dashed border-gray-300/80 hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-400/80 hover:text-indigo-600 group cursor-pointer"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                            stroke="currentColor"
                            className="w-6 h-6 mx-auto mb-0.5"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span className="text-xs font-medium">
                            Upload Dataset
                        </span>
                    </button>
                )}
            </div>

            <UploadModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onUpload={handleCustomDatasetApply}
                boundaryCodes={boundaryCodes}
            />
        </>
    );
}