from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.lookup_point_precision_decimal_places_type_2_grid_reference import (
        LookupPointPrecisionDecimalPlacesType2GridReference,
    )


T = TypeVar("T", bound="LookupPointPrecisionDecimalPlacesType2")


@_attrs_define
class LookupPointPrecisionDecimalPlacesType2:
    """
    Attributes:
        grid_reference (LookupPointPrecisionDecimalPlacesType2GridReference):
    """

    grid_reference: LookupPointPrecisionDecimalPlacesType2GridReference
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        grid_reference = self.grid_reference.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "gridReference": grid_reference,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_point_precision_decimal_places_type_2_grid_reference import (
            LookupPointPrecisionDecimalPlacesType2GridReference,
        )

        d = dict(src_dict)
        grid_reference = LookupPointPrecisionDecimalPlacesType2GridReference.from_dict(
            d.pop("gridReference")
        )

        lookup_point_precision_decimal_places_type_2 = cls(
            grid_reference=grid_reference,
        )

        lookup_point_precision_decimal_places_type_2.additional_properties = d
        return lookup_point_precision_decimal_places_type_2

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
