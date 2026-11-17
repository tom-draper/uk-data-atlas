import type { Sparkline } from "@/lib/measures/series";

export type SparklineFade = Array<{ offset: string; opacity: number }>;

type Props = {
	sparkline: Sparkline;
	color: string;
	/** Must be unique on the page, as gradients are looked up by id. */
	gradientId: string;
	/** Opacity of the fill from the top of the card down. */
	fade: SparklineFade;
	strokeWidth: number;
	/** Mark where the latest value sits. */
	marker?: boolean;
};

/** A line and soft fill that fill a chart card's background. */
export function SparklineBackground({
	sparkline,
	color,
	gradientId,
	fade,
	strokeWidth,
	marker = false,
}: Props) {
	return (
		<svg
			className="absolute inset-0 size-full"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
		>
			<defs>
				<linearGradient
					id={gradientId}
					x1="0%"
					y1="0%"
					x2="0%"
					y2="100%"
				>
					{fade.map((stop) => (
						<stop
							key={stop.offset}
							offset={stop.offset}
							stopColor={color}
							stopOpacity={stop.opacity}
						/>
					))}
				</linearGradient>
			</defs>
			<path d={sparkline.areaPath} fill={`url(#${gradientId})`} />
			<path
				d={sparkline.linePath}
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				vectorEffect="non-scaling-stroke"
			/>
			{marker && (
				<circle
					cx={sparkline.last.x}
					cy={sparkline.last.y}
					r="2"
					fill={color}
					vectorEffect="non-scaling-stroke"
				/>
			)}
		</svg>
	);
}
