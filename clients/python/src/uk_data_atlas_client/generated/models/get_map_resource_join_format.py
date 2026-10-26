from enum import StrEnum


class GetMapResourceJoinFormat(StrEnum):
    JSON = "json"
    PARQUET = "parquet"

    def __str__(self) -> str:
        return str(self.value)
