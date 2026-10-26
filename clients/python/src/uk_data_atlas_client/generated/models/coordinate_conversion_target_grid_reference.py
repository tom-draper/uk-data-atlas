from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.coordinate_conversion_target_grid_reference_position import (
    CoordinateConversionTargetGridReferencePosition,
)

T = TypeVar("T", bound="CoordinateConversionTargetGridReference")


@_attrs_define
class CoordinateConversionTargetGridReference:
    """A British National Grid cell containing the target coordinate, present only for an encodable EPSG:27700 target. Its
    cell is no finer than the target uncertainty permits.

        Attributes:
            cell_size_m (float):
            digits (int):
            position (CoordinateConversionTargetGridReferencePosition):
            value (str):  Example: TQ 3000 8000.
    """

    cell_size_m: float
    digits: int
    position: CoordinateConversionTargetGridReferencePosition
    value: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cell_size_m = self.cell_size_m

        digits = self.digits

        position = self.position.value

        value = self.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "cellSizeM": cell_size_m,
                "digits": digits,
                "position": position,
                "value": value,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        cell_size_m = d.pop("cellSizeM")

        digits = d.pop("digits")

        position = CoordinateConversionTargetGridReferencePosition(d.pop("position"))

        value = d.pop("value")

        coordinate_conversion_target_grid_reference = cls(
            cell_size_m=cell_size_m,
            digits=digits,
            position=position,
            value=value,
        )

        coordinate_conversion_target_grid_reference.additional_properties = d
        return coordinate_conversion_target_grid_reference

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
