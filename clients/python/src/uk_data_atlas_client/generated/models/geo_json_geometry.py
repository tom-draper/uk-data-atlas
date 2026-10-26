from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="GeoJsonGeometry")


@_attrs_define
class GeoJsonGeometry:
    """A GeoJSON geometry object as read from the raw cached source, or a GeometryCollection when the source represents one
    area code as more than one feature fragment.

        Attributes:
            type_ (str):
            coordinates (Any | Unset): Present on every geometry type except GeometryCollection.
            geometries (list[GeoJsonGeometry] | Unset): Present only when type is GeometryCollection.
    """

    type_: str
    coordinates: Any | Unset = UNSET
    geometries: list[GeoJsonGeometry] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        coordinates = self.coordinates

        geometries: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.geometries, Unset):
            geometries = []
            for geometries_item_data in self.geometries:
                geometries_item = geometries_item_data.to_dict()
                geometries.append(geometries_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
            }
        )
        if coordinates is not UNSET:
            field_dict["coordinates"] = coordinates
        if geometries is not UNSET:
            field_dict["geometries"] = geometries

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        type_ = d.pop("type")

        coordinates = d.pop("coordinates", UNSET)

        _geometries = d.pop("geometries", UNSET)
        geometries: list[GeoJsonGeometry] | Unset = UNSET
        if _geometries is not UNSET:
            geometries = []
            for geometries_item_data in _geometries:
                geometries_item = GeoJsonGeometry.from_dict(geometries_item_data)

                geometries.append(geometries_item)

        geo_json_geometry = cls(
            type_=type_,
            coordinates=coordinates,
            geometries=geometries,
        )

        geo_json_geometry.additional_properties = d
        return geo_json_geometry

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
