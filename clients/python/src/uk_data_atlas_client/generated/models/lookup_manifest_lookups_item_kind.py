from enum import StrEnum


class LookupManifestLookupsItemKind(StrEnum):
    AREA_IDENTITIES = "area-identities"
    CROSSWALK = "crosswalk"
    NAMED_LOCATION_MEMBERS = "named-location-members"

    def __str__(self) -> str:
        return str(self.value)
