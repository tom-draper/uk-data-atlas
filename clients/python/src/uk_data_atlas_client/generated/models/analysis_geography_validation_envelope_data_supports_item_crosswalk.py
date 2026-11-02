from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AnalysisGeographyValidationEnvelopeDataSupportsItemCrosswalk")


@_attrs_define
class AnalysisGeographyValidationEnvelopeDataSupportsItemCrosswalk:
    """The reviewed crosswalk, for a one-crosswalk support.

    Attributes:
        content_hash (str):
        id (str):
    """

    content_hash: str
    id: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        content_hash = self.content_hash

        id = self.id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "contentHash": content_hash,
                "id": id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        content_hash = d.pop("contentHash")

        id = d.pop("id")

        analysis_geography_validation_envelope_data_supports_item_crosswalk = cls(
            content_hash=content_hash,
            id=id,
        )

        analysis_geography_validation_envelope_data_supports_item_crosswalk.additional_properties = d
        return analysis_geography_validation_envelope_data_supports_item_crosswalk

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
