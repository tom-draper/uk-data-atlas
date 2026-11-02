from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1_method import (
    AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1Method,
)

if TYPE_CHECKING:
    from ..models.analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1_steps_item import (
        AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItem,
    )


T = TypeVar(
    "T", bound="AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1"
)


@_attrs_define
class AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1:
    """
    Attributes:
        id (str):
        method (AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1Method):
        quality (str):
        steps (list[AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItem]):
    """

    id: str
    method: (
        AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1Method
    )
    quality: str
    steps: list[
        AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItem
    ]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        method = self.method.value

        quality = self.quality

        steps = []
        for steps_item_data in self.steps:
            steps_item = steps_item_data.to_dict()
            steps.append(steps_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "method": method,
                "quality": quality,
                "steps": steps,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1_steps_item import (
            AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItem,
        )

        d = dict(src_dict)
        id = d.pop("id")

        method = AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1Method(
            d.pop("method")
        )

        quality = d.pop("quality")

        steps = []
        _steps = d.pop("steps")
        for steps_item_data in _steps:
            steps_item = AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItem.from_dict(
                steps_item_data
            )

            steps.append(steps_item)

        analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1 = cls(
            id=id,
            method=method,
            quality=quality,
            steps=steps,
        )

        analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1.additional_properties = d
        return analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1

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
