from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="CompareBoundaryReleasesResponse200DataSummary")


@_attrs_define
class CompareBoundaryReleasesResponse200DataSummary:
    """
    Attributes:
        changed_extent_count (int):
        codes_only_in_from_count (int):
        codes_only_in_to_count (int):
        continuous_code_count (int):
        from_area_count (int):
        indeterminate_extent_count (int):
        published_relationship_count (int):
        recoded_code_count (int):
        shared_code_count (int):
        to_area_count (int):
        unassessed_shared_code_count (int):
        unmeasured_code_count (int):
    """

    changed_extent_count: int
    codes_only_in_from_count: int
    codes_only_in_to_count: int
    continuous_code_count: int
    from_area_count: int
    indeterminate_extent_count: int
    published_relationship_count: int
    recoded_code_count: int
    shared_code_count: int
    to_area_count: int
    unassessed_shared_code_count: int
    unmeasured_code_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        changed_extent_count = self.changed_extent_count

        codes_only_in_from_count = self.codes_only_in_from_count

        codes_only_in_to_count = self.codes_only_in_to_count

        continuous_code_count = self.continuous_code_count

        from_area_count = self.from_area_count

        indeterminate_extent_count = self.indeterminate_extent_count

        published_relationship_count = self.published_relationship_count

        recoded_code_count = self.recoded_code_count

        shared_code_count = self.shared_code_count

        to_area_count = self.to_area_count

        unassessed_shared_code_count = self.unassessed_shared_code_count

        unmeasured_code_count = self.unmeasured_code_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "changedExtentCount": changed_extent_count,
                "codesOnlyInFromCount": codes_only_in_from_count,
                "codesOnlyInToCount": codes_only_in_to_count,
                "continuousCodeCount": continuous_code_count,
                "fromAreaCount": from_area_count,
                "indeterminateExtentCount": indeterminate_extent_count,
                "publishedRelationshipCount": published_relationship_count,
                "recodedCodeCount": recoded_code_count,
                "sharedCodeCount": shared_code_count,
                "toAreaCount": to_area_count,
                "unassessedSharedCodeCount": unassessed_shared_code_count,
                "unmeasuredCodeCount": unmeasured_code_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        changed_extent_count = d.pop("changedExtentCount")

        codes_only_in_from_count = d.pop("codesOnlyInFromCount")

        codes_only_in_to_count = d.pop("codesOnlyInToCount")

        continuous_code_count = d.pop("continuousCodeCount")

        from_area_count = d.pop("fromAreaCount")

        indeterminate_extent_count = d.pop("indeterminateExtentCount")

        published_relationship_count = d.pop("publishedRelationshipCount")

        recoded_code_count = d.pop("recodedCodeCount")

        shared_code_count = d.pop("sharedCodeCount")

        to_area_count = d.pop("toAreaCount")

        unassessed_shared_code_count = d.pop("unassessedSharedCodeCount")

        unmeasured_code_count = d.pop("unmeasuredCodeCount")

        compare_boundary_releases_response_200_data_summary = cls(
            changed_extent_count=changed_extent_count,
            codes_only_in_from_count=codes_only_in_from_count,
            codes_only_in_to_count=codes_only_in_to_count,
            continuous_code_count=continuous_code_count,
            from_area_count=from_area_count,
            indeterminate_extent_count=indeterminate_extent_count,
            published_relationship_count=published_relationship_count,
            recoded_code_count=recoded_code_count,
            shared_code_count=shared_code_count,
            to_area_count=to_area_count,
            unassessed_shared_code_count=unassessed_shared_code_count,
            unmeasured_code_count=unmeasured_code_count,
        )

        compare_boundary_releases_response_200_data_summary.additional_properties = d
        return compare_boundary_releases_response_200_data_summary

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
