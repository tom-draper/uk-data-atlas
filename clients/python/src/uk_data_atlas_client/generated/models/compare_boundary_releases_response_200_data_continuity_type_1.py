from __future__ import annotations

from collections.abc import Mapping
from typing import (
    TYPE_CHECKING,
    Any,
    Literal,
    Self,
    TypeVar,
    cast,
)

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.compare_boundary_releases_response_200_data_continuity_type_1_changed_extent_item import (
        CompareBoundaryReleasesResponse200DataContinuityType1ChangedExtentItem,
    )
    from ..models.compare_boundary_releases_response_200_data_continuity_type_1_recoded_item import (
        CompareBoundaryReleasesResponse200DataContinuityType1RecodedItem,
    )
    from ..models.compare_boundary_releases_response_200_data_continuity_type_1_unmeasured_item import (
        CompareBoundaryReleasesResponse200DataContinuityType1UnmeasuredItem,
    )


T = TypeVar("T", bound="CompareBoundaryReleasesResponse200DataContinuityType1")


@_attrs_define
class CompareBoundaryReleasesResponse200DataContinuityType1:
    """
    Attributes:
        changed_extent (list[CompareBoundaryReleasesResponse200DataContinuityType1ChangedExtentItem]):
        crosswalks (list[str]):
        recoded (list[CompareBoundaryReleasesResponse200DataContinuityType1RecodedItem]):
        status (Literal['available']):
        unassessed_shared_codes (list[str]):
        unmeasured (list[CompareBoundaryReleasesResponse200DataContinuityType1UnmeasuredItem]):
    """

    changed_extent: list[
        CompareBoundaryReleasesResponse200DataContinuityType1ChangedExtentItem
    ]
    crosswalks: list[str]
    recoded: list[CompareBoundaryReleasesResponse200DataContinuityType1RecodedItem]
    status: Literal["available"]
    unassessed_shared_codes: list[str]
    unmeasured: list[
        CompareBoundaryReleasesResponse200DataContinuityType1UnmeasuredItem
    ]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        changed_extent = []
        for changed_extent_item_data in self.changed_extent:
            changed_extent_item = changed_extent_item_data.to_dict()
            changed_extent.append(changed_extent_item)

        crosswalks = self.crosswalks

        recoded = []
        for recoded_item_data in self.recoded:
            recoded_item = recoded_item_data.to_dict()
            recoded.append(recoded_item)

        status = self.status

        unassessed_shared_codes = self.unassessed_shared_codes

        unmeasured = []
        for unmeasured_item_data in self.unmeasured:
            unmeasured_item = unmeasured_item_data.to_dict()
            unmeasured.append(unmeasured_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "changedExtent": changed_extent,
                "crosswalks": crosswalks,
                "recoded": recoded,
                "status": status,
                "unassessedSharedCodes": unassessed_shared_codes,
                "unmeasured": unmeasured,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.compare_boundary_releases_response_200_data_continuity_type_1_changed_extent_item import (
            CompareBoundaryReleasesResponse200DataContinuityType1ChangedExtentItem,
        )
        from ..models.compare_boundary_releases_response_200_data_continuity_type_1_recoded_item import (
            CompareBoundaryReleasesResponse200DataContinuityType1RecodedItem,
        )
        from ..models.compare_boundary_releases_response_200_data_continuity_type_1_unmeasured_item import (
            CompareBoundaryReleasesResponse200DataContinuityType1UnmeasuredItem,
        )

        d = dict(src_dict)
        changed_extent = []
        _changed_extent = d.pop("changedExtent")
        for changed_extent_item_data in _changed_extent:
            changed_extent_item = CompareBoundaryReleasesResponse200DataContinuityType1ChangedExtentItem.from_dict(
                changed_extent_item_data
            )

            changed_extent.append(changed_extent_item)

        crosswalks = cast(list[str], d.pop("crosswalks"))

        recoded = []
        _recoded = d.pop("recoded")
        for recoded_item_data in _recoded:
            recoded_item = CompareBoundaryReleasesResponse200DataContinuityType1RecodedItem.from_dict(
                recoded_item_data
            )

            recoded.append(recoded_item)

        status = cast(Literal["available"], d.pop("status"))
        if status != "available":
            raise ValueError(f"status must match const 'available', got '{status}'")

        unassessed_shared_codes = cast(list[str], d.pop("unassessedSharedCodes"))

        unmeasured = []
        _unmeasured = d.pop("unmeasured")
        for unmeasured_item_data in _unmeasured:
            unmeasured_item = CompareBoundaryReleasesResponse200DataContinuityType1UnmeasuredItem.from_dict(
                unmeasured_item_data
            )

            unmeasured.append(unmeasured_item)

        compare_boundary_releases_response_200_data_continuity_type_1 = cls(
            changed_extent=changed_extent,
            crosswalks=crosswalks,
            recoded=recoded,
            status=status,
            unassessed_shared_codes=unassessed_shared_codes,
            unmeasured=unmeasured,
        )

        compare_boundary_releases_response_200_data_continuity_type_1.additional_properties = d
        return compare_boundary_releases_response_200_data_continuity_type_1

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
