from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="LookupPointInputTransformation")


@_attrs_define
class LookupPointInputTransformation:
    """
    Attributes:
        accuracy_m (float):
        area_of_use (str):
        epsg (str):
        name (str):
    """

    accuracy_m: float
    area_of_use: str
    epsg: str
    name: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        accuracy_m = self.accuracy_m

        area_of_use = self.area_of_use

        epsg = self.epsg

        name = self.name

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "accuracyM": accuracy_m,
                "areaOfUse": area_of_use,
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

        epsg = d.pop("epsg")

        name = d.pop("name")

        lookup_point_input_transformation = cls(
            accuracy_m=accuracy_m,
            area_of_use=area_of_use,
            epsg=epsg,
            name=name,
        )

        lookup_point_input_transformation.additional_properties = d
        return lookup_point_input_transformation

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
