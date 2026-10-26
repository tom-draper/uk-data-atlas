from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.analysis_geography_validation_envelope_data_supports_item_path_crosswalks_item import (
        AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItem,
    )


T = TypeVar("T", bound="AnalysisGeographyValidationEnvelopeDataSupportsItemPath")


@_attrs_define
class AnalysisGeographyValidationEnvelopeDataSupportsItemPath:
    """Every crosswalk of the reviewed path, for a path-backed support.

    Attributes:
        crosswalks (list[AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItem]):
        id (str):
    """

    crosswalks: list[
        AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItem
    ]
    id: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        crosswalks = []
        for crosswalks_item_data in self.crosswalks:
            crosswalks_item = crosswalks_item_data.to_dict()
            crosswalks.append(crosswalks_item)

        id = self.id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "crosswalks": crosswalks,
                "id": id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.analysis_geography_validation_envelope_data_supports_item_path_crosswalks_item import (
            AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItem,
        )

        d = dict(src_dict)
        crosswalks = []
        _crosswalks = d.pop("crosswalks")
        for crosswalks_item_data in _crosswalks:
            crosswalks_item = AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItem.from_dict(
                crosswalks_item_data
            )

            crosswalks.append(crosswalks_item)

        id = d.pop("id")

        analysis_geography_validation_envelope_data_supports_item_path = cls(
            crosswalks=crosswalks,
            id=id,
        )

        analysis_geography_validation_envelope_data_supports_item_path.additional_properties = d
        return analysis_geography_validation_envelope_data_supports_item_path

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
