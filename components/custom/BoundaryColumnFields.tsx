import { AreaMatch } from "@lib/data/areaBank";
import { isSpecialMatchType, type UploadColumn } from "@/lib/data/custom/upload";
import { getMatchColorClass } from "./uploadStyles";
import { ColumnDropdown } from "./ColumnDropdown";
import { LabelledColumn } from "./LabelledColumn";
import { RowBadge } from "./RowBadge";

/** How well the chosen column matched, and the other area sets it could be. */
function BoundaryMatchSummary({
	matches,
	effectiveMatch,
	selectedColumn,
	showOptions,
	onToggleOptions,
	onOverride,
	isDark,
}: {
	matches: AreaMatch[];
	effectiveMatch: AreaMatch | null;
	selectedColumn: string;
	showOptions: boolean;
	onToggleOptions: () => void;
	onOverride: (label: string) => void;
	isDark: boolean;
}) {
	if (!selectedColumn) return null;

	return (
		<div className="mt-2">
			{matches.length === 0 ? (
				<p className={`text-[10px] ${isDark ? "text-orange-400" : "text-orange-500"}`}>
					No boundary type matched. Try a different column.
				</p>
			) : (
				<div>
					<div className={`flex items-center gap-2 text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
						<span className={`font-semibold ${getMatchColorClass(effectiveMatch!.percentage)}`}>
							{effectiveMatch!.percentage.toFixed(0)}%
						</span>
						<span className={`truncate ${isSpecialMatchType(effectiveMatch!.entry.matchType) ? "italic" : ""}`}>
							{effectiveMatch!.entry.label}
						</span>
						{isSpecialMatchType(effectiveMatch!.entry.matchType) && (
							<span className={`text-[9px] shrink-0 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
								coming soon
							</span>
						)}
						{matches.length > 1 && (
							<button
								type="button"
								onClick={() => onToggleOptions()}
								className={`ml-auto shrink-0 underline underline-offset-2 transition-colors ${
									isDark
										? "text-gray-600 hover:text-gray-400"
										: "text-gray-400 hover:text-gray-600"
								}`}
							>
								{showOptions ? "Less" : "Change"}
							</button>
						)}
					</div>

					{showOptions && (
						<div
							className={`mt-1.5 rounded-md border overflow-hidden ${isDark ? "border-white/10" : "border-gray-200"}`}
						>
							{matches.map((m) => {
								const special = isSpecialMatchType(m.entry.matchType);
								return (
									<button
										key={m.entry.label}
										type="button"
										disabled={special}
										onClick={() => onOverride(m.entry.label)}
										className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors ${
											special
												? isDark ? "opacity-40 cursor-default text-gray-500" : "opacity-40 cursor-default text-gray-400"
												: effectiveMatch?.entry.label === m.entry.label
													? isDark ? "bg-indigo-600/25 text-indigo-200" : "bg-indigo-50 text-indigo-700"
													: isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-50"
										}`}
									>
										<span className={`text-[10px] w-8 text-right font-semibold ${getMatchColorClass(m.percentage)}`}>
											{m.percentage.toFixed(0)}%
										</span>
										<span className="truncate">{m.entry.label}</span>
										{special && (
											<span className={`ml-auto text-[9px] shrink-0 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
												coming soon
											</span>
										)}
									</button>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/** Column pickers for a CSV of area codes, drawn as a choropleth. */
export function BoundaryColumnFields({
	columns,
	csvData,
	headerRow,
	onHeaderRowChange,
	selectedColumn,
	onSelectedColumnChange,
	dataColumn,
	onDataColumnChange,
	matches,
	effectiveMatch,
	showBoundaryOptions,
	onToggleBoundaryOptions,
	onOverride,
	isDark,
}: {
	columns: UploadColumn[];
	csvData: string[][];
	headerRow: number;
	onHeaderRowChange: (row: number) => void;
	selectedColumn: string;
	onSelectedColumnChange: (value: string) => void;
	dataColumn: string;
	onDataColumnChange: (value: string) => void;
	matches: AreaMatch[];
	effectiveMatch: AreaMatch | null;
	showBoundaryOptions: boolean;
	onToggleBoundaryOptions: () => void;
	onOverride: (label: string) => void;
	isDark: boolean;
}) {
	return (
		<div className="animate-in fade-in duration-300 space-y-4">
			<div>
				<div className="flex items-center justify-between mb-1.5">
					<label
						className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
					>
						Area codes
					</label>
					<RowBadge
						headerRow={headerRow}
						csvData={csvData}
						onChange={onHeaderRowChange}
						isDark={isDark}
					/>
				</div>
				<ColumnDropdown
					columns={columns}
					value={selectedColumn}
					onChange={onSelectedColumnChange}
					placeholder="Select area code column..."
					isDark={isDark}
				/>

				<BoundaryMatchSummary
					matches={matches}
					effectiveMatch={effectiveMatch}
					selectedColumn={selectedColumn}
					showOptions={showBoundaryOptions}
					onToggleOptions={onToggleBoundaryOptions}
					onOverride={onOverride}
					isDark={isDark}
				/>
			</div>

			<LabelledColumn
				label="Values"
				columns={columns}
				value={dataColumn}
				onChange={onDataColumnChange}
				placeholder="Select data column..."
				isDark={isDark}
			/>
		</div>
	);
}
