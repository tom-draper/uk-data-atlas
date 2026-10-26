from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaNeighboursBorder")


@_attrs_define
class AreaNeighboursBorder:
    """
    Attributes:
        perimeter_m (float):
        point_only_touches (int): Areas meeting only at a point, counted whether or not `touches` returned them.
        shared_border_m (float): Border shared with the neighbours returned.
        unshared_border_m (float): The remainder: coastline, a national boundary, or a border with an area outside this
            release. Nothing for a landlocked area.
    """

    perimeter_m: float
    point_only_touches: int
    shared_border_m: float
    unshared_border_m: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        perimeter_m = self.perimeter_m

        point_only_touches = self.point_only_touches

        shared_border_m = self.shared_border_m

        unshared_border_m = self.unshared_border_m

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "perimeterM": perimeter_m,
                "pointOnlyTouches": point_only_touches,
                "sharedBorderM": shared_border_m,
                "unsharedBorderM": unshared_border_m,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        perimeter_m = d.pop("perimeterM")

        point_only_touches = d.pop("pointOnlyTouches")

        shared_border_m = d.pop("sharedBorderM")

        unshared_border_m = d.pop("unsharedBorderM")

        area_neighbours_border = cls(
            perimeter_m=perimeter_m,
            point_only_touches=point_only_touches,
            shared_border_m=shared_border_m,
            unshared_border_m=unshared_border_m,
        )

        area_neighbours_border.additional_properties = d
        return area_neighbours_border

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
