"use client";

export function renderCategoryLegend(
	items: { id: string; color: string; name: string }[],
	isPercentageMode: boolean,
	selectedId: string | undefined,
	onItemClick: (id: string) => void,
	swatchOpacity: number = 1,
	isDark: boolean = false,
	excluded?: Set<string>,
	onItemRightClick?: (id: string) => void,
) {
	return (
		<div>
			{items.map((item) => {
				const isSelected = isPercentageMode && selectedId === item.id;
				const isExcluded = excluded?.has(item.id) ?? false;
				return (
					<button
						type="button"
						key={item.id}
						onClick={() => onItemClick(item.id)}
						onContextMenu={(e) => {
							e.preventDefault();
							onItemRightClick?.(item.id);
						}}
						className={`flex items-center gap-2 px-1 py-0.75 w-full text-left rounded-sm transition-all cursor-pointer ${isSelected ? "ring-1" : isDark ? "hover:bg-white/10" : "hover:bg-gray-100/30"} ${isExcluded ? "opacity-35" : ""}`}
						style={
							isSelected
								? ({
										backgroundColor: `${item.color}15`,
										"--tw-ring-color": `${item.color}80`,
									} as React.CSSProperties)
								: {}
						}
					>
						<div
							className={`size-3 rounded-xs shrink-0 transition-opacity ${isSelected ? "ring-1" : ""}`}
							style={{
								backgroundColor: item.color,
								opacity: swatchOpacity,
								...(isSelected
									? ({
											"--tw-ring-color": item.color,
										} as React.CSSProperties)
									: {}),
							}}
						/>
						<span
							className={`text-xs ${isExcluded ? "line-through" : ""} ${isSelected ? (isDark ? "text-gray-100" : "text-gray-700") : (isDark ? "text-gray-400" : "text-gray-500")}`}
						>
							{item.name}
						</span>
					</button>
				);
			})}
		</div>
	);
}
