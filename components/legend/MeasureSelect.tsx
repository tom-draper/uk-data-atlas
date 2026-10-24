"use client";

import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle } from "@/lib/helpers/panelTheme";

export default function MeasureSelect<Value extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: Value;
	options: readonly { value: Value; label: string }[];
	onChange: (value: Value) => void;
}) {
	const isDark = useIsDark();
	return (
		<label
			className={`pointer-events-auto ml-auto flex max-w-full flex-col gap-1 rounded-md p-2 text-xs ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			{label}
			<select
				className="max-w-full rounded bg-transparent p-1"
				value={value}
				onChange={(event) => {
					const option = options.find(
						({ value }) => value === event.target.value,
					);
					if (option) onChange(option.value);
				}}
			>
				{options.map((option) => (
					<option
						className="text-gray-900"
						key={option.value}
						value={option.value}
					>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}
