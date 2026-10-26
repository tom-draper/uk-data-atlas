from enum import StrEnum


class UnknownQueryParameterProblemCode(StrEnum):
    UNKNOWN_QUERY_PARAMETER = "unknown_query_parameter"

    def __str__(self) -> str:
        return str(self.value)
