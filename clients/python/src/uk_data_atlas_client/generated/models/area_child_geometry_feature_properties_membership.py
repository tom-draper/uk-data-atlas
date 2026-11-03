from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.area_child_geometry_feature_properties_membership_weighting import (
        AreaChildGeometryFeaturePropertiesMembershipWeighting,
    )


T = TypeVar("T", bound="AreaChildGeometryFeaturePropertiesMembership")


@_attrs_define
class AreaChildGeometryFeaturePropertiesMembership:
    """The published crosswalk that places this area in the collection.

    Attributes:
        id (str):
        method (str):
        quality (str):
        weighting (AreaChildGeometryFeaturePropertiesMembershipWeighting | Unset):
    """

    id: str
    method: str
    quality: str
    weighting: AreaChildGeometryFeaturePropertiesMembershipWeighting | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        method = self.method

        quality = self.quality

        weighting: dict[str, Any] | Unset = UNSET
        if not isinstance(self.weighting, Unset):
            weighting = self.weighting.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "method": method,
                "quality": quality,
            }
        )
        if weighting is not UNSET:
            field_dict["weighting"] = weighting

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_child_geometry_feature_properties_membership_weighting import (
            AreaChildGeometryFeaturePropertiesMembershipWeighting,
        )

        d = dict(src_dict)
        id = d.pop("id")

        method = d.pop("method")

        quality = d.pop("quality")

        _weighting = d.pop("weighting", UNSET)
        weighting: AreaChildGeometryFeaturePropertiesMembershipWeighting | Unset
        if isinstance(_weighting, Unset):
            weighting = UNSET
        else:
            weighting = AreaChildGeometryFeaturePropertiesMembershipWeighting.from_dict(
                _weighting
            )

        area_child_geometry_feature_properties_membership = cls(
            id=id,
            method=method,
            quality=quality,
            weighting=weighting,
        )

        area_child_geometry_feature_properties_membership.additional_properties = d
        return area_child_geometry_feature_properties_membership

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
