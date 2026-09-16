const MOTE_COUNT = 22;

/** A fixed, repeatable scatter so the server and client render the same motes. */
function scatter(index: number, salt: number): number {
	const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
	return x - Math.floor(x);
}

const MOTES = Array.from({ length: MOTE_COUNT }, (_, i) => ({
	top: `${scatter(i, 1) * 70}%`,
	left: `${30 + scatter(i, 2) * 70}%`,
	size: 1.5 + scatter(i, 3) * 2.5,
	duration: `${18 + scatter(i, 4) * 22}s`,
	delay: `${-scatter(i, 5) * 40}s`,
}));

const DAPPLES = [
	{ top: "38%", left: "8%", size: "34vmax", delay: "0s" },
	{ top: "62%", left: "54%", size: "28vmax", delay: "-9s" },
	{ top: "12%", left: "36%", size: "20vmax", delay: "-17s" },
];

/** The ethereal, sunlit background the docs' glass panes float over. */
export default function SunlitBackdrop() {
	return (
		<div className="docs-sky" aria-hidden="true">
			<div className="docs-sun" />
			<div className="docs-rays" />
			<div className="docs-pane" />
			<div className="docs-pane" />
			{DAPPLES.map((dapple) => (
				<div
					key={dapple.top}
					className="docs-dapple"
					style={{
						top: dapple.top,
						left: dapple.left,
						width: dapple.size,
						height: dapple.size,
						animationDelay: dapple.delay,
					}}
				/>
			))}
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

/** The same sunlight, falling over the content rather than behind it. */
export function Sunfall() {
	return <div className="docs-sunfall" aria-hidden="true" />;
}
