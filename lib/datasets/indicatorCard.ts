import type { IndicatorDataset } from "@/lib/types/indicator";
import { defineValueCard, type ValueCardConfig } from "./valueCard";

type IndicatorCardDisplay = Omit<
	ValueCardConfig,
	"source" | "fromRecord" | "fromAggregate" | "fromHover"
> & {
	source?: string;
	/** A fixed note beside the value, such as what it averages. */
	secondary?: string;
};

/** A value card for the consistently shaped published indicators. */
export const indicatorCard = ({
	secondary,
	source = "Source and methodology are available in the data catalogue.",
	...display
}: IndicatorCardDisplay): ValueCardConfig =>
	defineValueCard<IndicatorDataset, { value: number }>({
		...display,
		source,
		value: (record) => record.value,
		...(secondary ? { secondary: () => secondary } : {}),
		hoverRecord: true,
	});
