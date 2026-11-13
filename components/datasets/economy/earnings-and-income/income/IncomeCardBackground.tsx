"use client";

// Green shades for the pound signs
const particleColors = [
	"text-green-300",
	"text-green-400",
	"text-emerald-300",
	"text-emerald-400",
	"text-teal-300",
];

function seededRandom(seed: number) {
	let s = seed;
	return () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
}

function computeParticles(medianIncome: number | null) {
	if (!medianIncome) return [];

	const minIncome = 25000;
	const maxIncome = 45000;
	const clampedIncome = Math.max(
		minIncome,
		Math.min(medianIncome, maxIncome),
	);

	const minParticles = 4;
	const maxParticles = 100;
	const percentage = (clampedIncome - minIncome) / (maxIncome - minIncome);
	const count = Math.round(
		minParticles + percentage * (maxParticles - minParticles),
	);

	const rand = seededRandom(Math.round(medianIncome));

	return Array.from({ length: count }).map((_, i) => ({
		id: i,
		top: `${rand() * 100}%`,
		left: `${rand() * 100}%`,
		rotation: rand() * 360,
		size: rand() * 1.5 + 0.8,
		opacity: rand() * 0.3 + 0.05,
		blur:
			rand() < 0.4
				? "blur-[1px]"
				: rand() < 0.2
					? "blur-[2px]"
					: "blur-none",
		color: particleColors[Math.floor(rand() * particleColors.length)],
	}));
}

export function IncomeCardBackground({ income }: { income: number | null }) {
	const particles = computeParticles(income);
	return (
		<div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
			{particles.map((p) => (
				<span
					key={p.id}
					className={`absolute font-bold ${p.color} ${p.blur}`}
					style={{
						top: p.top,
						left: p.left,
						fontSize: `${p.size}rem`,
						opacity: p.opacity,
						transform: `rotate(${p.rotation}deg)`,
					}}
				>
					£
				</span>
			))}
		</div>
	);
}
