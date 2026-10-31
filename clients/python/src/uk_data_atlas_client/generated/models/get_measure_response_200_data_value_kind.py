from enum import StrEnum


class GetMeasureResponse200DataValueKind(StrEnum):
    CATEGORICAL = "categorical"
    COUNT = "count"
    CURRENCY = "currency"
    ORDINAL = "ordinal"
    QUANTITY = "quantity"
    RATIO = "ratio"

    def __str__(self) -> str:
        return str(self.value)
