from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1_steps_item_direction import (
    AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItemDirection,
)

if TYPE_CHECKING:
    from ..models.analysis_crosswalk import AnalysisCrosswalk


T = TypeVar(
    "T",
    bound="AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItem",
)


@_attrs_define
class AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItem:
    """
    Attributes:
        crosswalk (AnalysisCrosswalk):
        direction (AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItemDirection):
    """

    crosswalk: AnalysisCrosswalk
    direction: AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItemDirection
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        crosswalk = self.crosswalk.to_dict()

        direction = self.direction.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "crosswalk": crosswalk,
                "direction": direction,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.analysis_crosswalk import AnalysisCrosswalk

        d = dict(src_dict)
        crosswalk = AnalysisCrosswalk.from_dict(d.pop("crosswalk"))

        direction = AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItemDirection(
            d.pop("direction")
        )

        analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1_steps_item = cls(
            crosswalk=crosswalk,
            direction=direction,
        )

        analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1_steps_item.additional_properties = d
        return analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1_steps_item

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
