import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, AlertCircle } from 'lucide-react';
import { BoundaryData } from '@/lib/types';

// Simple CSV parser that handles quotes and newlines within cells
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
                // Escaped quote
                currentCell += '"';
                i++;
            } else {
                // Toggle quote state
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            // End of cell
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            // End of row
            if (char === '\r' && nextChar === '\n') {
                i++; // Skip \n in \r\n
            }
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell.trim());
                if (currentRow.some(cell => cell)) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = '';
            }
        } else {
            currentCell += char;
        }
    }

    // Add final cell and row
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell)) {
            rows.push(currentRow);
        }
    }

    return rows;
}

interface CustomSectionProps {
    activeDataset: any;
    availableDatasets: Record<string, any>;
    aggregatedData: any;
    selectedArea: any;
    codeMapper?: {
        getCodeForYear: (
            type: "localAuthority",
            code: string,
            targetYear: number,
        ) => string | undefined;
    };
    setActiveViz: (value: any) => void;
    boundaryData: BoundaryData;
}

function UploadModal({ isOpen, onClose, onUpload, boundaryData }: {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (data: any) => void;
    boundaryData: BoundaryData;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [csvData, setCsvData] = useState<string[][]>([]);
    const [headerRow, setHeaderRow] = useState(0);
    const [selectedColumn, setSelectedColumn] = useState<string>('');
    const [matches, setMatches] = useState<Array<{ type: string; percentage: number }>>([]);
    const [selectedCodeType, setSelectedCodeType] = useState<string>('');
    const [error, setError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                const headers = rows[0];
                const codeColumn = headers.find(h =>
                    h.toLowerCase().includes('code') ||
                    h.toLowerCase().includes('area') ||
                    h.toLowerCase().includes('ward') ||
                    h.toLowerCase().includes('constituency') ||
                    h.toLowerCase().includes('authority')
                );
                if (codeColumn) {
                    setSelectedColumn(codeColumn);
                }
            }
        };
        reader.readAsText(selectedFile);
    };

    const calculateMatches = (columnData: string[]) => {
        if (!boundaryData || columnData.length === 0) {
            return [];
        }

        const uniqueCodes = new Set(columnData.filter(code => code && code.trim()));
        const results: Array<{ type: string; percentage: number; matchCount: number; totalCodes: number }> = [];

        for (const [type, data] of Object.entries(boundaryData)) {
            for (const [year, geojson] of Object.entries(data)) {
                if (!geojson) continue;

                console.log('first feature', geojson.features[0])

                const geojsonCodes = new Set(Object.keys(geojson));
                let matchCount = 0;

                for (const code of uniqueCodes) {
                    if (geojsonCodes.has(code)) {
                        matchCount++;
                    }
                }

                const percentage = (matchCount / uniqueCodes.size) * 100;
                results.push({
                    type: `${type} (${year})`,
                    percentage,
                    matchCount,
                    totalCodes: uniqueCodes.size
                });
            }
        }

        results.sort((a, b) => b.percentage - a.percentage);
        return results;
    };

    useEffect(() => {
        if (csvData.length > headerRow && selectedColumn) {
            const headers = csvData[headerRow];
            const columnIndex = headers.indexOf(selectedColumn);

            if (columnIndex !== -1) {
                const columnData = csvData
                    .slice(headerRow + 1)
                    .map(row => row[columnIndex])
                    .filter(val => val && val.trim());

                const matchResults = calculateMatches(columnData);
                setMatches(matchResults);

                if (matchResults.length > 0 && matchResults[0].percentage > 0) {
                    setSelectedCodeType(matchResults[0].type);
                } else {
                    setSelectedCodeType('');
                }
            }
        }
    }, [csvData, headerRow, selectedColumn, boundaryData]);

    const handleUpload = () => {
        if (!file || !selectedColumn || !selectedCodeType) {
            setError('Please select a file, column, and matching area type');
            return;
        }

        onUpload({
            file: file.name,
            headerRow,
            selectedColumn,
            codeType: selectedCodeType,
            data: csvData
        });

        handleClose();
    };

    const handleClose = () => {
        setFile(null);
        setCsvData([]);
        setHeaderRow(0);
        setSelectedColumn('');
        setMatches([]);
        setSelectedCodeType('');
        setError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClose();
    };

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const headers = csvData[headerRow] || [];
    const previewRows = csvData.slice(0, Math.min(headerRow + 11, csvData.length));

    const modalContent = (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            <div className="relative bg-white rounded-lg shadow-xl max-w-[85vh] w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Upload Custom Dataset
                    </h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-indigo-400 transition-colors flex flex-col items-center gap-2 cursor-pointer"
                            >
                                <Upload size={32} className="text-gray-400" />
                                <span className="text-sm text-gray-600">
                                    {file ? file.name : 'Click to select CSV file'}
                                </span>
                            </button>
                        </div>

                        {csvData.length > 0 && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Header Row
                                    </label>
                                    <select
                                        value={headerRow}
                                        onChange={(e) => setHeaderRow(Number(e.target.value))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    >
                                        {csvData.slice(0, 10).map((_, idx) => (
                                            <option key={idx} value={idx}>
                                                Row {idx + 1}: {csvData[idx].join(', ').slice(0, 50)}...
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Code Column
                                    </label>
                                    <select
                                        value={selectedColumn}
                                        onChange={(e) => setSelectedColumn(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="">-- Select Column --</option>
                                        {headers.map((header, idx) => (
                                            <option key={idx} value={header}>
                                                {header || `Column ${idx + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {matches.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Matching Area Types
                                        </label>
                                        <div className="space-y-2">
                                            {matches.map((match) => (
                                                <button
                                                    key={match.type}
                                                    onClick={() => setSelectedCodeType(match.type)}
                                                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${selectedCodeType === match.type
                                                        ? 'border-indigo-500 bg-indigo-50'
                                                        : match.percentage > 0
                                                            ? 'border-gray-200 hover:border-indigo-300'
                                                            : 'border-gray-100 opacity-50 cursor-not-allowed'
                                                        }`}
                                                    disabled={match.percentage === 0}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {match.type}
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-0.5">
                                                                {match.matchCount} of {match.totalCodes} codes matched
                                                            </div>
                                                        </div>
                                                        <div className={`text-lg font-bold ${match.percentage >= 80
                                                            ? 'text-green-600'
                                                            : match.percentage >= 50
                                                                ? 'text-yellow-600'
                                                                : match.percentage > 0
                                                                    ? 'text-orange-600'
                                                                    : 'text-gray-400'
                                                            }`}>
                                                            {match.percentage.toFixed(0)}%
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Preview
                                    </label>
                                    <div className="border border-gray-200 rounded-lg overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    {headers.map((header, idx) => (
                                                        <th
                                                            key={idx}
                                                            className={`px-3 py-2 text-left font-medium ${header === selectedColumn
                                                                ? 'bg-indigo-100 text-indigo-900'
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
                                                    <tr key={rowIdx} className="border-t border-gray-100">
                                                        {row.map((cell, cellIdx) => (
                                                            <td
                                                                key={cellIdx}
                                                                className={`px-3 py-2 ${headers[cellIdx] === selectedColumn
                                                                    ? 'bg-indigo-50'
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
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || !selectedColumn}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                        Upload
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

export default function CustomSection({
    activeDataset,
    availableDatasets,
    aggregatedData,
    selectedArea,
    codeMapper,
    setActiveViz,
    boundaryData,
}: CustomSectionProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleUpload = (data: any) => {
        console.log('Processing upload:', data);
        // Process your data here
    };

    return (
        <>
            <div className="space-y-2 border-t border-gray-200/80">
                <h3 className="text-xs font-bold pt-2">Custom</h3>
                <button
                    onClick={() => setIsOpen(true)}
                    className='w-full p-2 rounded transition-all duration-300 ease-in-out cursor-pointer border-2 border-gray-200/80 hover:border-indigo-300'
                >
                    <div className="flex items-center justify-center my-1.5">
                        <span className="text-xs text-gray-500">
                            Upload dataset
                        </span>
                    </div>
                </button>
            </div>

            <UploadModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onUpload={handleUpload}
                boundaryData={boundaryData}
            />
        </>
    );
}