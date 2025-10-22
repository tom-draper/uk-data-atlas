// components/population/GenderBreakdown.tsx
import { AgeGroups } from '@lib/types';

interface GenderBreakdownProps {
	ageGroups: {
		total: AgeGroups;
		males: AgeGroups;
		females: AgeGroups;
	};
}

export default function GenderBreakdown({ ageGroups }: GenderBreakdownProps) {
	return (
		<div className="px-2">
			<div className="text-xs font-bold text-gray-700 mb-2">Gender by Age Group</div>
			<div className="space-y-1">
				{(Object.entries(ageGroups.total) as [keyof AgeGroups, number][]).map(([ageGroup, totalCount]) => {
					const maleCount = ageGroups.males[ageGroup] || 0;
					const femaleCount = ageGroups.females[ageGroup] || 0;
					const malePercentage = totalCount > 0 ? (maleCount / totalCount) * 100 : 0;

					return (
						<div key={ageGroup}>
							<div className="text-[9px] text-gray-500 mb-0.5">{ageGroup}</div>
							<div className="flex h-3 rounded overflow-hidden bg-gray-200">
								<div
									className="bg-blue-500"
									style={{ width: `${malePercentage}%` }}
									title={`Males: ${maleCount.toLocaleString()}`}
								/>
								<div
									className="bg-pink-500"
									style={{ width: `${100 - malePercentage}%` }}
									title={`Females: ${femaleCount.toLocaleString()}`}
								/>
							</div>
							<div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
								<span>M: {maleCount.toLocaleString()}</span>
								<span>F: {femaleCount.toLocaleString()}</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}