from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.coordinate_conversion_target_transformation_direction import (
    CoordinateConversionTargetTransformationDirection,
)

T = TypeVar("T", bound="CoordinateConversionTargetTransformation")


@_attrs_define
class CoordinateConversionTargetTransformation:
    """
    Attributes:
        accuracy_m (float):
        area_of_use (str):
        direction (CoordinateConversionTargetTransformationDirection):
        epsg (str):
        name (str):
    """

    accuracy_m: float
    area_of_use: str
    direction: CoordinateConversionTargetTransformationDirection
    epsg: str
    name: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        accuracy_m = self.accuracy_m

        area_of_use = self.area_of_use

        direction = self.direction.value

        epsg = self.epsg

        name = self.name

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "accuracyM": accuracy_m,
                "areaOfUse": area_of_use,
                "direction": direction,
                "epsg": epsg,
                "name": name,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        accuracy_m = d.pop("accuracyM")

        area_of_use = d.pop("areaOfUse")

        direction = CoordinateConversionTargetTransformationDirection(
            d.pop("direction")
        )

        epsg = d.pop("epsg")

        name = d.pop("name")

        coordinate_conversion_target_transformation = cls(
            accuracy_m=accuracy_m,
            area_of_use=area_of_use,
            direction=direction,
            epsg=epsg,
            name=name,
        )

        coordinate_conversion_target_transformation.additional_properties = d
        return coordinate_conversion_target_transformation

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
