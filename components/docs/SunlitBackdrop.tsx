const MOTE_COUNT = 14;

/** A fixed, repeatable scatter so the server and client render the same motes. */
function scatter(index: number, salt: number): number {
	const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
	return x - Math.floor(x);
}

const MOTES = Array.from({ length: MOTE_COUNT }, (_, i) => ({
	top: `${scatter(i, 1) * 60}%`,
	left: `${scatter(i, 2) * 60}%`,
	size: 1.5 + scatter(i, 3) * 2,
	duration: `${22 + scatter(i, 4) * 24}s`,
	delay: `${-scatter(i, 5) * 46}s`,
}));

/** Daylight on a pale canvas, behind the docs. */
export default function SunlitBackdrop() {
	return (
		<div className="docs-sky" aria-hidden="true">
			<div className="docs-light" />
			<div className="docs-window" />
			<div className="docs-shade" />
			<div className="docs-weave" />
			{MOTES.map((mote, i) => (
				<span
					key={i}
					className="docs-mote"
					style={{
						top: mote.top,
						left: mote.left,
						width: mote.size,
						height: mote.size,
						animationDuration: mote.duration,
						animationDelay: mote.delay,
					}}
				/>
			))}
			<div className="docs-grain" />
		</div>
	);
}

/** The window frame's shadow, falling over the content rather than behind it. */
export function Sunfall() {
	return <div className="docs-sunfall" aria-hidden="true" />;
}
