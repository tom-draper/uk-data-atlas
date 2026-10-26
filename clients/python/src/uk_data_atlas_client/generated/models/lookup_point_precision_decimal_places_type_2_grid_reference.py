from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="LookupPointPrecisionDecimalPlacesType2GridReference")


@_attrs_define
class LookupPointPrecisionDecimalPlacesType2GridReference:
    """
    Attributes:
        easting (int):
        northing (int):
    """

    easting: int
    northing: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        easting = self.easting

        northing = self.northing

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "easting": easting,
                "northing": northing,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        easting = d.pop("easting")

        northing = d.pop("northing")

        lookup_point_precision_decimal_places_type_2_grid_reference = cls(
            easting=easting,
            northing=northing,
        )

        lookup_point_precision_decimal_places_type_2_grid_reference.additional_properties = d
        return lookup_point_precision_decimal_places_type_2_grid_reference

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
