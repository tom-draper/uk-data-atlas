from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.analysis_geography_validation_envelope_data_supports_item_path_crosswalks_item_direction import (
    AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItemDirection,
)

T = TypeVar(
    "T", bound="AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItem"
)


@_attrs_define
class AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItem:
    """
    Attributes:
        content_hash (str):
        direction (AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItemDirection):
        id (str):
    """

    content_hash: str
    direction: (
        AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItemDirection
    )
    id: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        content_hash = self.content_hash

        direction = self.direction.value

        id = self.id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "contentHash": content_hash,
                "direction": direction,
                "id": id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        content_hash = d.pop("contentHash")

        direction = AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItemDirection(
            d.pop("direction")
        )

        id = d.pop("id")

        analysis_geography_validation_envelope_data_supports_item_path_crosswalks_item = cls(
            content_hash=content_hash,
            direction=direction,
            id=id,
        )

        analysis_geography_validation_envelope_data_supports_item_path_crosswalks_item.additional_properties = d
        return analysis_geography_validation_envelope_data_supports_item_path_crosswalks_item

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
