import { ColumnDropdown } from "./ColumnDropdown";
import type { UploadColumn } from "@/lib/data/custom/upload";

/** One labelled column picker, as used by both upload flows. */
export function LabelledColumn({
	label,
	columns,
	value,
	onChange,
	placeholder,
	isDark,
}: {
	label: string;
	columns: UploadColumn[];
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	isDark: boolean;
}) {
	return (
		<div>
			<label
				className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
			>
				{label}
			</label>
			<ColumnDropdown
				columns={columns}
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				isDark={isDark}
			/>
		</div>
	);
}
