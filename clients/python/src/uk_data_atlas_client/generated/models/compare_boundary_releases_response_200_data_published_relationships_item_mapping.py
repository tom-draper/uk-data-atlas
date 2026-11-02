from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_shape import (
    CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingShape,
)

if TYPE_CHECKING:
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamples,
    )
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_from import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingFrom,
    )
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_to import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingTo,
    )


T = TypeVar(
    "T", bound="CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMapping"
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMapping:
    """
    Attributes:
        examples (CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamples):
        from_ (CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingFrom):
        from_code_count (int):
        note (str):
        pair_count (int):
        shape (CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingShape):
        to (CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingTo):
        to_code_count (int):
    """

    examples: (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamples
    )
    from_: CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingFrom
    from_code_count: int
    note: str
    pair_count: int
    shape: CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingShape
    to: CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingTo
    to_code_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        examples = self.examples.to_dict()

        from_ = self.from_.to_dict()

        from_code_count = self.from_code_count

        note = self.note

        pair_count = self.pair_count

        shape = self.shape.value

        to = self.to.to_dict()

        to_code_count = self.to_code_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "examples": examples,
                "from": from_,
                "fromCodeCount": from_code_count,
                "note": note,
                "pairCount": pair_count,
                "shape": shape,
                "to": to,
                "toCodeCount": to_code_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_examples import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamples,
        )
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_from import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingFrom,
        )
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping_to import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingTo,
        )

        d = dict(src_dict)
        examples = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingExamples.from_dict(
            d.pop("examples")
        )

        from_ = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingFrom.from_dict(
            d.pop("from")
        )

        from_code_count = d.pop("fromCodeCount")

        note = d.pop("note")

        pair_count = d.pop("pairCount")

        shape = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingShape(
            d.pop("shape")
        )

        to = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingTo.from_dict(
            d.pop("to")
        )

        to_code_count = d.pop("toCodeCount")

        compare_boundary_releases_response_200_data_published_relationships_item_mapping = cls(
            examples=examples,
            from_=from_,
            from_code_count=from_code_count,
            note=note,
            pair_count=pair_count,
            shape=shape,
            to=to,
            to_code_count=to_code_count,
        )

        compare_boundary_releases_response_200_data_published_relationships_item_mapping.additional_properties = d
        return compare_boundary_releases_response_200_data_published_relationships_item_mapping

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
