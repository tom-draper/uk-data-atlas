from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_children_geometry_type import AreaChildrenGeometryType

if TYPE_CHECKING:
    from ..models.area import Area
    from ..models.area_child_geometry_feature import AreaChildGeometryFeature
    from ..models.area_children_geometry_collection import (
        AreaChildrenGeometryCollection,
    )
    from ..models.area_children_geometry_without_geometry_item import (
        AreaChildrenGeometryWithoutGeometryItem,
    )


T = TypeVar("T", bound="AreaChildrenGeometry")


@_attrs_define
class AreaChildrenGeometry:
    """
    Attributes:
        collection (AreaChildrenGeometryCollection): What the collection holds and on what terms. `generalisationMethod`
            is present only above the `full` tier.
        features (list[AreaChildGeometryFeature]):
        id (str):
        parent (Area):
        type_ (AreaChildrenGeometryType):
        without_geometry (list[AreaChildrenGeometryWithoutGeometryItem]): Members published as a relationship that could
            not be drawn, each with the reason. Empty when the collection is complete.
    """

    collection: AreaChildrenGeometryCollection
    features: list[AreaChildGeometryFeature]
    id: str
    parent: Area
    type_: AreaChildrenGeometryType
    without_geometry: list[AreaChildrenGeometryWithoutGeometryItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        collection = self.collection.to_dict()

        features = []
        for features_item_data in self.features:
            features_item = features_item_data.to_dict()
            features.append(features_item)

        id = self.id

        parent = self.parent.to_dict()

        type_ = self.type_.value

        without_geometry = []
        for without_geometry_item_data in self.without_geometry:
            without_geometry_item = without_geometry_item_data.to_dict()
            without_geometry.append(without_geometry_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "collection": collection,
                "features": features,
                "id": id,
                "parent": parent,
                "type": type_,
                "withoutGeometry": without_geometry,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area import Area
        from ..models.area_child_geometry_feature import AreaChildGeometryFeature
        from ..models.area_children_geometry_collection import (
            AreaChildrenGeometryCollection,
        )
        from ..models.area_children_geometry_without_geometry_item import (
            AreaChildrenGeometryWithoutGeometryItem,
        )

        d = dict(src_dict)
        collection = AreaChildrenGeometryCollection.from_dict(d.pop("collection"))

        features = []
        _features = d.pop("features")
        for features_item_data in _features:
            features_item = AreaChildGeometryFeature.from_dict(features_item_data)

            features.append(features_item)

        id = d.pop("id")

        parent = Area.from_dict(d.pop("parent"))

        type_ = AreaChildrenGeometryType(d.pop("type"))

        without_geometry = []
        _without_geometry = d.pop("withoutGeometry")
        for without_geometry_item_data in _without_geometry:
            without_geometry_item = AreaChildrenGeometryWithoutGeometryItem.from_dict(
                without_geometry_item_data
            )

            without_geometry.append(without_geometry_item)

        area_children_geometry = cls(
            collection=collection,
            features=features,
            id=id,
            parent=parent,
            type_=type_,
            without_geometry=without_geometry,
        )

        area_children_geometry.additional_properties = d
        return area_children_geometry

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
