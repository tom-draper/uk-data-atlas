from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples_many_to_one_item import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesManyToOneItem,
    )
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples_one_to_many_item import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesOneToManyItem,
    )


T = TypeVar(
    "T",
    bound="CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamples",
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamples:
    """
    Attributes:
        many_to_one
            (list[CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesManyToOneItem]):
        one_to_many
            (list[CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesOneToManyItem]):
    """

    many_to_one: list[
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesManyToOneItem
    ]
    one_to_many: list[
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesOneToManyItem
    ]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        many_to_one = []
        for many_to_one_item_data in self.many_to_one:
            many_to_one_item = many_to_one_item_data.to_dict()
            many_to_one.append(many_to_one_item)

        one_to_many = []
        for one_to_many_item_data in self.one_to_many:
            one_to_many_item = one_to_many_item_data.to_dict()
            one_to_many.append(one_to_many_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "manyToOne": many_to_one,
                "oneToMany": one_to_many,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples_many_to_one_item import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesManyToOneItem,
        )
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples_one_to_many_item import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesOneToManyItem,
        )

        d = dict(src_dict)
        many_to_one = []
        _many_to_one = d.pop("manyToOne")
        for many_to_one_item_data in _many_to_one:
            many_to_one_item = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesManyToOneItem.from_dict(
                many_to_one_item_data
            )

            many_to_one.append(many_to_one_item)

        one_to_many = []
        _one_to_many = d.pop("oneToMany")
        for one_to_many_item_data in _one_to_many:
            one_to_many_item = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamplesOneToManyItem.from_dict(
                one_to_many_item_data
            )

            one_to_many.append(one_to_many_item)

        compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples = cls(
            many_to_one=many_to_one,
            one_to_many=one_to_many,
        )

        compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples.additional_properties = d
        return compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples

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
