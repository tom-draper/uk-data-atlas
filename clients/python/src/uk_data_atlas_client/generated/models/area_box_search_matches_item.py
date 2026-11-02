from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_box_search_matches_item_relation import (
    AreaBoxSearchMatchesItemRelation,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.area_box_search_matches_item_generalisation import (
        AreaBoxSearchMatchesItemGeneralisation,
    )
    from ..models.geo_json_geometry import GeoJsonGeometry
    from ..models.geometry_source import GeometrySource


T = TypeVar("T", bound="AreaBoxSearchMatchesItem")


@_attrs_define
class AreaBoxSearchMatchesItem:
    """
    Attributes:
        code (str):
        id (str):
        name (str):
        bounding_box (list[float]):
        geometry_source (GeometrySource): Where the served WGS84 geometry came from. `transformation` is present only
            when the source was reprojected. Per-area compiled geometry carries `validity`; release-wide provenance and
            direct source reads omit it.
        relation (AreaBoxSearchMatchesItemRelation):
        aliases (list[str] | Unset):
        boundary_release (str | Unset):
        geography (str | Unset):
        generalisation (AreaBoxSearchMatchesItemGeneralisation | Unset): Present only when a `tier` was asked for.
        geometry (GeoJsonGeometry | Unset): A GeoJSON geometry object as read from the raw cached source, or a
            GeometryCollection when the source represents one area code as more than one feature fragment.
    """

    code: str
    id: str
    name: str
    bounding_box: list[float]
    geometry_source: GeometrySource
    relation: AreaBoxSearchMatchesItemRelation
    aliases: list[str] | Unset = UNSET
    boundary_release: str | Unset = UNSET
    geography: str | Unset = UNSET
    generalisation: AreaBoxSearchMatchesItemGeneralisation | Unset = UNSET
    geometry: GeoJsonGeometry | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        id = self.id

        name = self.name

        bounding_box = self.bounding_box

        geometry_source = self.geometry_source.to_dict()

        relation = self.relation.value

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        boundary_release = self.boundary_release

        geography = self.geography

        generalisation: dict[str, Any] | Unset = UNSET
        if not isinstance(self.generalisation, Unset):
            generalisation = self.generalisation.to_dict()

        geometry: dict[str, Any] | Unset = UNSET
        if not isinstance(self.geometry, Unset):
            geometry = self.geometry.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "id": id,
                "name": name,
                "boundingBox": bounding_box,
                "geometrySource": geometry_source,
                "relation": relation,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases
        if boundary_release is not UNSET:
            field_dict["boundaryRelease"] = boundary_release
        if geography is not UNSET:
            field_dict["geography"] = geography
        if generalisation is not UNSET:
            field_dict["generalisation"] = generalisation
        if geometry is not UNSET:
            field_dict["geometry"] = geometry

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_box_search_matches_item_generalisation import (
            AreaBoxSearchMatchesItemGeneralisation,
        )
        from ..models.geo_json_geometry import GeoJsonGeometry
        from ..models.geometry_source import GeometrySource

        d = dict(src_dict)
        code = d.pop("code")

        id = d.pop("id")

        name = d.pop("name")

        bounding_box = cast(list[float], d.pop("boundingBox"))

        geometry_source = GeometrySource.from_dict(d.pop("geometrySource"))

        relation = AreaBoxSearchMatchesItemRelation(d.pop("relation"))

        aliases = cast(list[str], d.pop("aliases", UNSET))

        boundary_release = d.pop("boundaryRelease", UNSET)

        geography = d.pop("geography", UNSET)

        _generalisation = d.pop("generalisation", UNSET)
        generalisation: AreaBoxSearchMatchesItemGeneralisation | Unset
        if isinstance(_generalisation, Unset):
            generalisation = UNSET
        else:
            generalisation = AreaBoxSearchMatchesItemGeneralisation.from_dict(
                _generalisation
            )

        _geometry = d.pop("geometry", UNSET)
        geometry: GeoJsonGeometry | Unset
        if isinstance(_geometry, Unset):
            geometry = UNSET
        else:
            geometry = GeoJsonGeometry.from_dict(_geometry)

        area_box_search_matches_item = cls(
            code=code,
            id=id,
            name=name,
            bounding_box=bounding_box,
            geometry_source=geometry_source,
            relation=relation,
            aliases=aliases,
            boundary_release=boundary_release,
            geography=geography,
            generalisation=generalisation,
            geometry=geometry,
        )

        area_box_search_matches_item.additional_properties = d
        return area_box_search_matches_item

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
