import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, AlertCircle } from 'lucide-react';

// Types
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
    codeType: string;
    data: string[][];
}

// CSV Parser
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

// Property Detector (simplified version)
class PropertyDetector {
    detectWardCode(features: any[]): string | undefined {
        const codeProps = ['WD23CD', 'WD22CD', 'WD21CD', 'WD20CD', 'wd_code', 'ward_code'];
        return this.findProperty(features, codeProps);
    }

    detectConstituencyCode(features: any[]): string | undefined {
        const codeProps = ['PCON23CD', 'PCON22CD', 'constituency_code', 'pcon_code'];
        return this.findProperty(features, codeProps);
    }

    detectLocalAuthorityCode(features: any[]): string | undefined {
        const codeProps = ['LAD23CD', 'LAD22CD', 'LAD21CD', 'lad_code', 'la_code'];
        return this.findProperty(features, codeProps);
    }

    private findProperty(features: any[], props: string[]): string | undefined {
        if (!features?.[0]?.properties) return undefined;
        return props.find(prop => features[0].properties[prop] !== undefined);
    }
}

// Upload Modal Component
function UploadModal({
    isOpen,
    onClose,
    onUpload,
    boundaryData
}: {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (data: UploadData) => void;
    boundaryData: BoundaryData;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [csvData, setCsvData] = useState<string[][]>([]);
    const [headerRow, setHeaderRow] = useState(0);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [selectedCodeType, setSelectedCodeType] = useState('');
    const [error, setError] = useState('');
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
                    /code|area|ward|constituency|authority/i.test(h)
                );
                if (codeColumn) setSelectedColumn(codeColumn);
            }
        };
        reader.readAsText(selectedFile);
    };

    const calculateMatches = (columnData: string[]): MatchResult[] => {
        if (!boundaryData || columnData.length === 0) return [];

        const uniqueCodes = new Set(columnData.filter(code => code?.trim()));
        const results: MatchResult[] = [];
        const detector = new PropertyDetector();

        for (const [type, data] of Object.entries(boundaryData)) {
            for (const [year, geojson] of Object.entries(data)) {
                if (!geojson) continue;

                let codeProp: string | undefined;
                if (type === 'ward') {
                    codeProp = detector.detectWardCode(geojson.features);
                } else if (type === 'constituency') {
                    codeProp = detector.detectConstituencyCode(geojson.features);
                } else if (type === 'localAuthority') {
                    codeProp = detector.detectLocalAuthorityCode(geojson.features);
                }

                if (!codeProp) continue;

                const geojsonCodes = new Set(
                    geojson.features
                        .map(f => f.properties[codeProp])
                        .filter(Boolean)
                );

                const matchCount = [...uniqueCodes].filter(code =>
                    geojsonCodes.has(code)
                ).length;

                results.push({
                    type: `${type === 'ward' ? 'Ward Boundaries' : type === 'constituency' ? 'Westminister Parlimentary Constituency Boundaries' : 'Local Authority Boundaries'} [${year}]`,
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
            const headers = csvData[headerRow];
            const columnIndex = headers.indexOf(selectedColumn);

            if (columnIndex !== -1) {
                const columnData = csvData
                    .slice(headerRow + 1)
                    .map(row => row[columnIndex])
                    .filter(val => val?.trim());

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
        if (fileInputRef.current) fileInputRef.current.value = '';
        onClose();
    };

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const headers = csvData[headerRow] || [];
    const previewRows = csvData.slice(0, Math.min(headerRow + 11, csvData.length));

    return createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative bg-white/80 backdrop-blur-md border border-white/30 rounded-md shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                {/* Header - Fixed */}
                <div className="flex items-center justify-between px-4 pb-2 pt-2.5 shrink-0 bg-white/20">
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

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
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
                                    className="w-full border-2 border-dashed border-gray-300 rounded-md p-8 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col items-center gap-2"
                                >
                                    <Upload size={32} className="text-gray-400" />
                                    <span className="text-sm text-gray-600">
                                        {file ? file.name : 'Click to select CSV file'}
                                    </span>
                                </button>
                            </div>
                        )}

                        {csvData.length > 0 && (
                            <>
                                {/* Header Row Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Header Row
                                    </label>
                                    <select
                                        value={headerRow}
                                        onChange={(e) => setHeaderRow(Number(e.target.value))}
                                        className="w-full backdrop-blur cursor-pointer rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Area Code Column
                                    </label>
                                    <select
                                        value={selectedColumn}
                                        onChange={(e) => setSelectedColumn(e.target.value)}
                                        className="w-full backdrop-blur cursor-pointer rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Available Boundaries
                                        </label>
                                        <div className="space-y-1 max-h-64 overflow-y-auto">
                                            {matches.filter(match => match.percentage > 0).map((match) => (
                                                <button
                                                    key={match.type}
                                                    onClick={() => setSelectedCodeType(match.type)}
                                                    disabled={match.percentage === 0}
                                                    className={`w-full px-4 py-2 rounded-md transition-all text-left ${selectedCodeType === match.type
                                                        ? 'bg-white backdrop-blur text-gray-900/80 cursor-pointer'
                                                        : match.percentage > 0
                                                            ? 'border-gray-200 opacity-80 backdrop-blur-xs hover:bg-white cursor-pointer'
                                                            : 'border-gray-100 bg-white/20 backdrop-blur opacity-50 cursor-not-allowed'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <div className={`text-sm min-w-12.5 ${match.percentage >= 80 ? 'text-green-600' :
                                                            match.percentage >= 50 ? 'text-yellow-600' :
                                                                match.percentage > 0 ? 'text-orange-600' : 'text-gray-500/80'
                                                            }`}>
                                                            {match.percentage.toFixed(0)}%
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-sm text-gray-700/80">
                                                                {match.type}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Preview Table */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Data Preview
                                    </label>
                                    <div className="border border-gray-200 rounded-md overflow-hidden">
                                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <thead className="bg-white/20 backdrop-blur sticky top-0">
                                                    <tr>
                                                        {headers.map((header, idx) => (
                                                            <th
                                                                key={idx}
                                                                className={`px-4 py-2 text-left font-medium whitespace-nowrap ${header === selectedColumn
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
                                                        <tr key={rowIdx} className="hover:bg-white/20">
                                                            {row.map((cell, cellIdx) => (
                                                                <td
                                                                    key={cellIdx}
                                                                    className={`px-4 py-2 whitespace-nowrap ${headers[cellIdx] === selectedColumn ? 'bg-indigo-50 font-medium' : ''
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

                {/* Footer - Fixed */}
                <div className="flex items-center justify-end gap-3 px-4 py-2 pb-2.5 bg-white/20 shrink-0">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || !selectedColumn}
                        className="px-3 py-1 text-sm cursor-pointer font-medium text-white bg-indigo-400 hover:bg-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Main Component
export default function CustomSection({ boundaryData }: { boundaryData: BoundaryData }) {
    const [isOpen, setIsOpen] = useState(false);

    const handleUpload = (data: UploadData) => {
        console.log('Processing upload:', data);
        // Process your data here
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
                        className="w-6 h-6 mx-auto mb-1"
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
            />
        </>
    );
}