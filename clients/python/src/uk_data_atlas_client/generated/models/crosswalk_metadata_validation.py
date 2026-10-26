from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.area_overlap_validation import AreaOverlapValidation
    from ..models.crosswalk_metadata_validation_endpoints import (
        CrosswalkMetadataValidationEndpoints,
    )
    from ..models.crosswalk_metadata_validation_source_name_conflicts_item import (
        CrosswalkMetadataValidationSourceNameConflictsItem,
    )


T = TypeVar("T", bound="CrosswalkMetadataValidation")


@_attrs_define
class CrosswalkMetadataValidation:
    """
    Attributes:
        endpoints (CrosswalkMetadataValidationEndpoints):
        source_name_conflicts (list[CrosswalkMetadataValidationSourceNameConflictsItem]):
        overlap (AreaOverlapValidation | Unset): Present only for `area-overlap` crosswalks. Two independently
            generalised boundaries leave narrow slivers where they disagree. A pair whose widest intersecting piece is
            narrower than `sliverWidthM` (twice its area over its perimeter) is dropped as a sliver. The build fails unless
            every sliver is under half that width and every kept overlap at least twice it, and unless every source and
            target area is at least `minimumCoverage` covered by kept overlaps.
    """

    endpoints: CrosswalkMetadataValidationEndpoints
    source_name_conflicts: list[CrosswalkMetadataValidationSourceNameConflictsItem]
    overlap: AreaOverlapValidation | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        endpoints = self.endpoints.to_dict()

        source_name_conflicts = []
        for source_name_conflicts_item_data in self.source_name_conflicts:
            source_name_conflicts_item = source_name_conflicts_item_data.to_dict()
            source_name_conflicts.append(source_name_conflicts_item)

        overlap: dict[str, Any] | Unset = UNSET
        if not isinstance(self.overlap, Unset):
            overlap = self.overlap.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "endpoints": endpoints,
                "sourceNameConflicts": source_name_conflicts,
            }
        )
        if overlap is not UNSET:
            field_dict["overlap"] = overlap

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_overlap_validation import AreaOverlapValidation
        from ..models.crosswalk_metadata_validation_endpoints import (
            CrosswalkMetadataValidationEndpoints,
        )
        from ..models.crosswalk_metadata_validation_source_name_conflicts_item import (
            CrosswalkMetadataValidationSourceNameConflictsItem,
        )

        d = dict(src_dict)
        endpoints = CrosswalkMetadataValidationEndpoints.from_dict(d.pop("endpoints"))

        source_name_conflicts = []
        _source_name_conflicts = d.pop("sourceNameConflicts")
        for source_name_conflicts_item_data in _source_name_conflicts:
            source_name_conflicts_item = (
                CrosswalkMetadataValidationSourceNameConflictsItem.from_dict(
                    source_name_conflicts_item_data
                )
            )

            source_name_conflicts.append(source_name_conflicts_item)

        _overlap = d.pop("overlap", UNSET)
        overlap: AreaOverlapValidation | Unset
        if isinstance(_overlap, Unset):
            overlap = UNSET
        else:
            overlap = AreaOverlapValidation.from_dict(_overlap)

        crosswalk_metadata_validation = cls(
            endpoints=endpoints,
            source_name_conflicts=source_name_conflicts,
            overlap=overlap,
        )

        crosswalk_metadata_validation.additional_properties = d
        return crosswalk_metadata_validation

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
