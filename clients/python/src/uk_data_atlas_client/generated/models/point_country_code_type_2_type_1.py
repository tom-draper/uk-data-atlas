from enum import StrEnum


class PointCountryCodeType2Type1(StrEnum):
    GB_ENG = "GB-ENG"
    GB_NIR = "GB-NIR"
    GB_SCT = "GB-SCT"
    GB_WLS = "GB-WLS"

    def __str__(self) -> str:
        return str(self.value)
