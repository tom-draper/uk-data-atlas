from enum import StrEnum


class GetMeasureObservationsGeography(StrEnum):
    CONSTITUENCY = "constituency"
    DATAZONE = "dataZone"
    LOCALAUTHORITY = "localAuthority"
    LSOA = "lsoa"
    MSOA = "msoa"
    SUPEROUTPUTAREA = "superOutputArea"
    WARD = "ward"

    def __str__(self) -> str:
        return str(self.value)
