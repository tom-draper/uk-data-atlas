from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.lookup_format import LookupFormat


T = TypeVar("T", bound="LookupManifestLookupsItemFormats")


@_attrs_define
class LookupManifestLookupsItemFormats:
    """
    Attributes:
        csv (LookupFormat):
        ndjson (LookupFormat):
    """

    csv: LookupFormat
    ndjson: LookupFormat
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        csv = self.csv.to_dict()

        ndjson = self.ndjson.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "csv": csv,
                "ndjson": ndjson,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_format import LookupFormat

        d = dict(src_dict)
        csv = LookupFormat.from_dict(d.pop("csv"))

        ndjson = LookupFormat.from_dict(d.pop("ndjson"))

        lookup_manifest_lookups_item_formats = cls(
            csv=csv,
            ndjson=ndjson,
        )

        lookup_manifest_lookups_item_formats.additional_properties = d
        return lookup_manifest_lookups_item_formats

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
