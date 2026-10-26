from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="PostcodeBatchSummary")


@_attrs_define
class PostcodeBatchSummary:
    """
    Attributes:
        invalid (int):
        lookups (int):
        matched (int):
        near_boundary (int):
        no_match (int):
        not_found (int):
        not_placed (int):
        not_served (int):
        outside_coverage (int):
        placed (int):
        postcodes (int):
        unresolved (int):
    """

    invalid: int
    lookups: int
    matched: int
    near_boundary: int
    no_match: int
    not_found: int
    not_placed: int
    not_served: int
    outside_coverage: int
    placed: int
    postcodes: int
    unresolved: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        invalid = self.invalid

        lookups = self.lookups

        matched = self.matched

        near_boundary = self.near_boundary

        no_match = self.no_match

        not_found = self.not_found

        not_placed = self.not_placed

        not_served = self.not_served

        outside_coverage = self.outside_coverage

        placed = self.placed

        postcodes = self.postcodes

        unresolved = self.unresolved

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "invalid": invalid,
                "lookups": lookups,
                "matched": matched,
                "nearBoundary": near_boundary,
                "noMatch": no_match,
                "notFound": not_found,
                "notPlaced": not_placed,
                "notServed": not_served,
                "outsideCoverage": outside_coverage,
                "placed": placed,
                "postcodes": postcodes,
                "unresolved": unresolved,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        invalid = d.pop("invalid")

        lookups = d.pop("lookups")

        matched = d.pop("matched")

        near_boundary = d.pop("nearBoundary")

        no_match = d.pop("noMatch")

        not_found = d.pop("notFound")

        not_placed = d.pop("notPlaced")

        not_served = d.pop("notServed")

        outside_coverage = d.pop("outsideCoverage")

        placed = d.pop("placed")

        postcodes = d.pop("postcodes")

        unresolved = d.pop("unresolved")

        postcode_batch_summary = cls(
            invalid=invalid,
            lookups=lookups,
            matched=matched,
            near_boundary=near_boundary,
            no_match=no_match,
            not_found=not_found,
            not_placed=not_placed,
            not_served=not_served,
            outside_coverage=outside_coverage,
            placed=placed,
            postcodes=postcodes,
            unresolved=unresolved,
        )

        postcode_batch_summary.additional_properties = d
        return postcode_batch_summary

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
