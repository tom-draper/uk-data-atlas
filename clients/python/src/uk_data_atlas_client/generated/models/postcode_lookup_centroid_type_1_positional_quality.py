from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="PostcodeLookupCentroidType1PositionalQuality")


@_attrs_define
class PostcodeLookupCentroidType1PositionalQuality:
    """
    Attributes:
        accuracy_m (float | None):
        description (str):
        indicator (int): The directory's GRIDIND.
    """

    accuracy_m: float | None
    description: str
    indicator: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        accuracy_m: float | None
        accuracy_m = self.accuracy_m

        description = self.description

        indicator = self.indicator

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "accuracyM": accuracy_m,
                "description": description,
                "indicator": indicator,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)

        def _parse_accuracy_m(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        accuracy_m = _parse_accuracy_m(d.pop("accuracyM"))

        description = d.pop("description")

        indicator = d.pop("indicator")

        postcode_lookup_centroid_type_1_positional_quality = cls(
            accuracy_m=accuracy_m,
            description=description,
            indicator=indicator,
        )

        postcode_lookup_centroid_type_1_positional_quality.additional_properties = d
        return postcode_lookup_centroid_type_1_positional_quality

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
