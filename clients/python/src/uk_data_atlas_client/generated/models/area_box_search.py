from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_box_search_tier import AreaBoxSearchTier
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.area_box_search_generalisation_method import (
        AreaBoxSearchGeneralisationMethod,
    )
    from ..models.area_box_search_matches_item import AreaBoxSearchMatchesItem


T = TypeVar("T", bound="AreaBoxSearch")


@_attrs_define
class AreaBoxSearch:
    """
    Attributes:
        bbox (list[float]):
        boundary_release (str):
        geography (str):
        limit (int):
        matched (int): Areas meeting the box, before the limit is applied.
        matches (list[AreaBoxSearchMatchesItem]):
        relation_rule (str):
        returned (int):
        truncated (bool): Whether `matched` exceeded `limit`.
        generalisation_method (AreaBoxSearchGeneralisationMethod | Unset):
        geometry (str | Unset): Present only when no `tier` was asked for, saying how to get the coordinates.
        min_effective_area_m2 (float | Unset):
        tier (AreaBoxSearchTier | Unset):
        tolerance_m (float | Unset):
    """

    bbox: list[float]
    boundary_release: str
    geography: str
    limit: int
    matched: int
    matches: list[AreaBoxSearchMatchesItem]
    relation_rule: str
    returned: int
    truncated: bool
    generalisation_method: AreaBoxSearchGeneralisationMethod | Unset = UNSET
    geometry: str | Unset = UNSET
    min_effective_area_m2: float | Unset = UNSET
    tier: AreaBoxSearchTier | Unset = UNSET
    tolerance_m: float | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        bbox = self.bbox

        boundary_release = self.boundary_release

        geography = self.geography

        limit = self.limit

        matched = self.matched

        matches = []
        for matches_item_data in self.matches:
            matches_item = matches_item_data.to_dict()
            matches.append(matches_item)

        relation_rule = self.relation_rule

        returned = self.returned

        truncated = self.truncated

        generalisation_method: dict[str, Any] | Unset = UNSET
        if not isinstance(self.generalisation_method, Unset):
            generalisation_method = self.generalisation_method.to_dict()

        geometry = self.geometry

        min_effective_area_m2 = self.min_effective_area_m2

        tier: str | Unset = UNSET
        if not isinstance(self.tier, Unset):
            tier = self.tier.value

        tolerance_m = self.tolerance_m

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "bbox": bbox,
                "boundaryRelease": boundary_release,
                "geography": geography,
                "limit": limit,
                "matched": matched,
                "matches": matches,
                "relationRule": relation_rule,
                "returned": returned,
                "truncated": truncated,
            }
        )
        if generalisation_method is not UNSET:
            field_dict["generalisationMethod"] = generalisation_method
        if geometry is not UNSET:
            field_dict["geometry"] = geometry
        if min_effective_area_m2 is not UNSET:
            field_dict["minEffectiveAreaM2"] = min_effective_area_m2
        if tier is not UNSET:
            field_dict["tier"] = tier
        if tolerance_m is not UNSET:
            field_dict["toleranceM"] = tolerance_m

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_box_search_generalisation_method import (
            AreaBoxSearchGeneralisationMethod,
        )
        from ..models.area_box_search_matches_item import AreaBoxSearchMatchesItem

        d = dict(src_dict)
        bbox = cast(list[float], d.pop("bbox"))

        boundary_release = d.pop("boundaryRelease")

        geography = d.pop("geography")

        limit = d.pop("limit")

        matched = d.pop("matched")

        matches = []
        _matches = d.pop("matches")
        for matches_item_data in _matches:
            matches_item = AreaBoxSearchMatchesItem.from_dict(matches_item_data)

            matches.append(matches_item)

        relation_rule = d.pop("relationRule")

        returned = d.pop("returned")

        truncated = d.pop("truncated")

        _generalisation_method = d.pop("generalisationMethod", UNSET)
        generalisation_method: AreaBoxSearchGeneralisationMethod | Unset
        if isinstance(_generalisation_method, Unset):
            generalisation_method = UNSET
        else:
            generalisation_method = AreaBoxSearchGeneralisationMethod.from_dict(
                _generalisation_method
            )

        geometry = d.pop("geometry", UNSET)

        min_effective_area_m2 = d.pop("minEffectiveAreaM2", UNSET)

        _tier = d.pop("tier", UNSET)
        tier: AreaBoxSearchTier | Unset
        if isinstance(_tier, Unset):
            tier = UNSET
        else:
            tier = AreaBoxSearchTier(_tier)

        tolerance_m = d.pop("toleranceM", UNSET)

        area_box_search = cls(
            bbox=bbox,
            boundary_release=boundary_release,
            geography=geography,
            limit=limit,
            matched=matched,
            matches=matches,
            relation_rule=relation_rule,
            returned=returned,
            truncated=truncated,
            generalisation_method=generalisation_method,
            geometry=geometry,
            min_effective_area_m2=min_effective_area_m2,
            tier=tier,
            tolerance_m=tolerance_m,
        )

        area_box_search.additional_properties = d
        return area_box_search

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
