from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_geometry_type import AreaGeometryType

if TYPE_CHECKING:
    from ..models.area_geometry_properties import AreaGeometryProperties
    from ..models.geo_json_geometry import GeoJsonGeometry


T = TypeVar("T", bound="AreaGeometry")


@_attrs_define
class AreaGeometry:
    """
    Attributes:
        geometry (GeoJsonGeometry): A GeoJSON geometry object as read from the raw cached source, or a
            GeometryCollection when the source represents one area code as more than one feature fragment.
        id (str):
        properties (AreaGeometryProperties):
        type_ (AreaGeometryType):
    """

    geometry: GeoJsonGeometry
    id: str
    properties: AreaGeometryProperties
    type_: AreaGeometryType
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        geometry = self.geometry.to_dict()

        id = self.id

        properties = self.properties.to_dict()

        type_ = self.type_.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "geometry": geometry,
                "id": id,
                "properties": properties,
                "type": type_,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_geometry_properties import AreaGeometryProperties
        from ..models.geo_json_geometry import GeoJsonGeometry

        d = dict(src_dict)
        geometry = GeoJsonGeometry.from_dict(d.pop("geometry"))

        id = d.pop("id")

        properties = AreaGeometryProperties.from_dict(d.pop("properties"))

        type_ = AreaGeometryType(d.pop("type"))

        area_geometry = cls(
            geometry=geometry,
            id=id,
            properties=properties,
            type_=type_,
        )

        area_geometry.additional_properties = d
        return area_geometry

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
