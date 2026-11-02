from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.analysis_geography_list_envelope_data_analysis_geographies_item import (
        AnalysisGeographyListEnvelopeDataAnalysisGeographiesItem,
    )


T = TypeVar("T", bound="AnalysisGeographyListEnvelopeData")


@_attrs_define
class AnalysisGeographyListEnvelopeData:
    """
    Attributes:
        analysis_geographies (list[AnalysisGeographyListEnvelopeDataAnalysisGeographiesItem]):
    """

    analysis_geographies: list[AnalysisGeographyListEnvelopeDataAnalysisGeographiesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        analysis_geographies = []
        for analysis_geographies_item_data in self.analysis_geographies:
            analysis_geographies_item = analysis_geographies_item_data.to_dict()
            analysis_geographies.append(analysis_geographies_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "analysisGeographies": analysis_geographies,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.analysis_geography_list_envelope_data_analysis_geographies_item import (
            AnalysisGeographyListEnvelopeDataAnalysisGeographiesItem,
        )

        d = dict(src_dict)
        analysis_geographies = []
        _analysis_geographies = d.pop("analysisGeographies")
        for analysis_geographies_item_data in _analysis_geographies:
            analysis_geographies_item = (
                AnalysisGeographyListEnvelopeDataAnalysisGeographiesItem.from_dict(
                    analysis_geographies_item_data
                )
            )

            analysis_geographies.append(analysis_geographies_item)

        analysis_geography_list_envelope_data = cls(
            analysis_geographies=analysis_geographies,
        )

        analysis_geography_list_envelope_data.additional_properties = d
        return analysis_geography_list_envelope_data

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
