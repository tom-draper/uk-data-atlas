from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_neighbours_neighbours_item_touch import (
    AreaNeighboursNeighboursItemTouch,
)
from ..types import UNSET, Unset

T = TypeVar("T", bound="AreaNeighboursNeighboursItem")


@_attrs_define
class AreaNeighboursNeighboursItem:
    """
    Attributes:
        code (str):
        id (str):
        name (str):
        share_of_perimeter (float): The shared border as a fraction of this area's own perimeter.
        shared_border_m (float): Zero for a point touch.
        shared_edges (int):
        shared_vertices (int):
        touch (AreaNeighboursNeighboursItemTouch):
        aliases (list[str] | Unset):
        boundary_release (str | Unset):
        geography (str | Unset):
    """

    code: str
    id: str
    name: str
    share_of_perimeter: float
    shared_border_m: float
    shared_edges: int
    shared_vertices: int
    touch: AreaNeighboursNeighboursItemTouch
    aliases: list[str] | Unset = UNSET
    boundary_release: str | Unset = UNSET
    geography: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        code = self.code

        id = self.id

        name = self.name

        share_of_perimeter = self.share_of_perimeter

        shared_border_m = self.shared_border_m

        shared_edges = self.shared_edges

        shared_vertices = self.shared_vertices

        touch = self.touch.value

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        boundary_release = self.boundary_release

        geography = self.geography

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "code": code,
                "id": id,
                "name": name,
                "shareOfPerimeter": share_of_perimeter,
                "sharedBorderM": shared_border_m,
                "sharedEdges": shared_edges,
                "sharedVertices": shared_vertices,
                "touch": touch,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases
        if boundary_release is not UNSET:
            field_dict["boundaryRelease"] = boundary_release
        if geography is not UNSET:
            field_dict["geography"] = geography

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        code = d.pop("code")

        id = d.pop("id")

        name = d.pop("name")

        share_of_perimeter = d.pop("shareOfPerimeter")

        shared_border_m = d.pop("sharedBorderM")

        shared_edges = d.pop("sharedEdges")

        shared_vertices = d.pop("sharedVertices")

        touch = AreaNeighboursNeighboursItemTouch(d.pop("touch"))

        aliases = cast(list[str], d.pop("aliases", UNSET))

        boundary_release = d.pop("boundaryRelease", UNSET)

        geography = d.pop("geography", UNSET)

        area_neighbours_neighbours_item = cls(
            code=code,
            id=id,
            name=name,
            share_of_perimeter=share_of_perimeter,
            shared_border_m=shared_border_m,
            shared_edges=shared_edges,
            shared_vertices=shared_vertices,
            touch=touch,
            aliases=aliases,
            boundary_release=boundary_release,
            geography=geography,
        )

        area_neighbours_neighbours_item.additional_properties = d
        return area_neighbours_neighbours_item

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
