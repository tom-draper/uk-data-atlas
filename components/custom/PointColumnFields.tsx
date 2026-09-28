import { RowBadge } from "./RowBadge";
import { LabelledColumn } from "./LabelledColumn";
import type { UploadColumn } from "@/lib/data/custom/upload";

/** Column pickers for a CSV of coordinates, plotted as points. */
export function PointColumnFields({
	columns,
	csvData,
	headerRow,
	onHeaderRowChange,
	latColumn,
	onLatColumnChange,
	lngColumn,
	onLngColumnChange,
	dataColumn,
	onDataColumnChange,
	isDark,
}: {
	columns: UploadColumn[];
	csvData: string[][];
	headerRow: number;
	onHeaderRowChange: (row: number) => void;
	latColumn: string;
	onLatColumnChange: (value: string) => void;
	lngColumn: string;
	onLngColumnChange: (value: string) => void;
	dataColumn: string;
	onDataColumnChange: (value: string) => void;
	isDark: boolean;
}) {
	return (
		<div className="animate-in fade-in duration-300 space-y-4">
			<div className="flex items-center justify-between">
				<span
					className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
				>
					Detected coordinates — plotting as points
				</span>
				<RowBadge
					headerRow={headerRow}
					csvData={csvData}
					onChange={onHeaderRowChange}
					isDark={isDark}
				/>
			</div>
			<LabelledColumn
				label="Latitude"
				columns={columns}
				value={latColumn}
				onChange={onLatColumnChange}
				placeholder="Latitude column..."
				isDark={isDark}
			/>
			<LabelledColumn
				label="Longitude"
				columns={columns}
				value={lngColumn}
				onChange={onLngColumnChange}
				placeholder="Longitude column..."
				isDark={isDark}
			/>
			<LabelledColumn
				label="Value"
				columns={columns}
				value={dataColumn}
				onChange={onDataColumnChange}
				placeholder="Value column..."
				isDark={isDark}
			/>
		</div>
	);
}
