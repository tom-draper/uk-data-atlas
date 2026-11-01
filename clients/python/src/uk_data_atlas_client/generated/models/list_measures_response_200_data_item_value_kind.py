from enum import StrEnum


class ListMeasuresResponse200DataItemValueKind(StrEnum):
    CATEGORICAL = "categorical"
    COUNT = "count"
    CURRENCY = "currency"
    ORDINAL = "ordinal"
    QUANTITY = "quantity"
    RATIO = "ratio"

    def __str__(self) -> str:
        return str(self.value)
