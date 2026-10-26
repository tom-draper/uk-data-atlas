from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.generalisation import Generalisation
    from ..models.geometry_source import GeometrySource


T = TypeVar("T", bound="AreaGeometryProperties")


@_attrs_define
class AreaGeometryProperties:
    """
    Attributes:
        boundary_release (str):
        code (str):
        geography (str):
        id (str):
        name (str):
        generalisation (Generalisation): What was done to the geometry before it was served, and at what cost. `method`
            is present only above the `full` tier, where something was actually done; it includes the caveat that neighbours
            generalised separately may disagree along a shared border.
        geometry_source (GeometrySource): Where the served WGS84 geometry came from. `transformation` is present only
            when the source was reprojected. Per-area compiled geometry carries `validity`; release-wide provenance and
            direct source reads omit it.
        aliases (list[str] | Unset):
    """

    boundary_release: str
    code: str
    geography: str
    id: str
    name: str
    generalisation: Generalisation
    geometry_source: GeometrySource
    aliases: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_release = self.boundary_release

        code = self.code

        geography = self.geography

        id = self.id

        name = self.name

        generalisation = self.generalisation.to_dict()

        geometry_source = self.geometry_source.to_dict()

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRelease": boundary_release,
                "code": code,
                "geography": geography,
                "id": id,
                "name": name,
                "generalisation": generalisation,
                "geometrySource": geometry_source,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.generalisation import Generalisation
        from ..models.geometry_source import GeometrySource

        d = dict(src_dict)
        boundary_release = d.pop("boundaryRelease")

        code = d.pop("code")

        geography = d.pop("geography")

        id = d.pop("id")

        name = d.pop("name")

        generalisation = Generalisation.from_dict(d.pop("generalisation"))

        geometry_source = GeometrySource.from_dict(d.pop("geometrySource"))

        aliases = cast(list[str], d.pop("aliases", UNSET))

        area_geometry_properties = cls(
            boundary_release=boundary_release,
            code=code,
            geography=geography,
            id=id,
            name=name,
            generalisation=generalisation,
            geometry_source=geometry_source,
            aliases=aliases,
        )

        area_geometry_properties.additional_properties = d
        return area_geometry_properties

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
