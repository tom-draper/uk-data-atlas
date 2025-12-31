import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, AlertCircle } from 'lucide-react';
import { BoundaryCodes } from '@/lib/types';

interface BoundaryData {
    [key: string]: {
        [year: string]: {
            features: Array<{
                properties: Record<string, any>;
            }>;
        };
    };
}

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
    codeType: string;
    data: string[][];
}

const BOUNDARY_TYPE_LABELS = {
    ward: 'Ward Boundaries',
    constituency: 'Westminster Parliamentary Constituency Boundaries',
    default: 'Local Authority Boundaries'
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
    return BOUNDARY_TYPE_LABELS[type] || BOUNDARY_TYPE_LABELS.default;
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
    boundaryData: BoundaryData;
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

        onUpload({
            file: file.name,
            headerRow,
            selectedColumn,
            dataColumn,
            codeType: selectedCodeType,
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
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative bg-white/80 backdrop-blur-md border border-white/30 rounded-md shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-2.5 pb-2 shrink-0 bg-white/20">
                    <h2 className="text-sm font-semibold text-gray-900/80">
                        Upload Custom Dataset
                    </h2>
                    <button
                        onClick={handleClose}
                        className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 pb-2 py-4">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* File Upload */}
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
                                {/* Header Row Selection */}
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

                                {/* Column Selection */}
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

                                {/* Data Column Selection */}
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

                                {/* Matching Results */}
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

                                {/* Preview Table */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                                        Data Preview
                                    </label>
                                    <div className="rounded-md overflow-hidden">
                                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <thead className="sticky top-0">
                                                    <tr>
                                                        {headers.map((header, idx) => (
                                                            <th
                                                                key={idx}
                                                                className={`px-4 py-2 text-left font-medium whitespace-nowrap backdrop-blur ${header === selectedColumn
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

                {/* Footer */}
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

export default function CustomSection({ boundaryData, boundaryCodes }: { boundaryData: BoundaryData; boundaryCodes: BoundaryCodes }) {
    const [isOpen, setIsOpen] = useState(false);

    const handleUpload = (data: UploadData) => {
        console.log('Processing upload:', data);
    };

    return (
        <>
            <div className="space-y-2 border-t border-gray-200 pt-4">
                <h3 className="text-xs font-bold text-gray-700">Custom</h3>
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-full p-3 rounded-md transition-all duration-200 border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-500 hover:text-indigo-600 group cursor-pointer"
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
            </div>

            <UploadModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onUpload={handleUpload}
                boundaryData={boundaryData}
                boundaryCodes={boundaryCodes}
            />
        </>
    );
}