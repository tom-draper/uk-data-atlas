from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_neighbours_touches import AreaNeighboursTouches
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.area_neighbours_border import AreaNeighboursBorder
    from ..models.area_neighbours_method import AreaNeighboursMethod
    from ..models.area_neighbours_neighbours_item import AreaNeighboursNeighboursItem


T = TypeVar("T", bound="AreaNeighbours")


@_attrs_define
class AreaNeighbours:
    """
    Attributes:
        boundary_release (str):
        code (str):
        geography (str):
        id (str):
        name (str):
        border (AreaNeighboursBorder):
        method (AreaNeighboursMethod):
        neighbours (list[AreaNeighboursNeighboursItem]):
        touches (AreaNeighboursTouches):
        aliases (list[str] | Unset):
    """

    boundary_release: str
    code: str
    geography: str
    id: str
    name: str
    border: AreaNeighboursBorder
    method: AreaNeighboursMethod
    neighbours: list[AreaNeighboursNeighboursItem]
    touches: AreaNeighboursTouches
    aliases: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_release = self.boundary_release

        code = self.code

        geography = self.geography

        id = self.id

        name = self.name

        border = self.border.to_dict()

        method = self.method.to_dict()

        neighbours = []
        for neighbours_item_data in self.neighbours:
            neighbours_item = neighbours_item_data.to_dict()
            neighbours.append(neighbours_item)

        touches = self.touches.value

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
                "border": border,
                "method": method,
                "neighbours": neighbours,
                "touches": touches,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_neighbours_border import AreaNeighboursBorder
        from ..models.area_neighbours_method import AreaNeighboursMethod
        from ..models.area_neighbours_neighbours_item import (
            AreaNeighboursNeighboursItem,
        )

        d = dict(src_dict)
        boundary_release = d.pop("boundaryRelease")

        code = d.pop("code")

        geography = d.pop("geography")

        id = d.pop("id")

        name = d.pop("name")

        border = AreaNeighboursBorder.from_dict(d.pop("border"))

        method = AreaNeighboursMethod.from_dict(d.pop("method"))

        neighbours = []
        _neighbours = d.pop("neighbours")
        for neighbours_item_data in _neighbours:
            neighbours_item = AreaNeighboursNeighboursItem.from_dict(
                neighbours_item_data
            )

            neighbours.append(neighbours_item)

        touches = AreaNeighboursTouches(d.pop("touches"))

        aliases = cast(list[str], d.pop("aliases", UNSET))

        area_neighbours = cls(
            boundary_release=boundary_release,
            code=code,
            geography=geography,
            id=id,
            name=name,
            border=border,
            method=method,
            neighbours=neighbours,
            touches=touches,
            aliases=aliases,
        )

        area_neighbours.additional_properties = d
        return area_neighbours

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
