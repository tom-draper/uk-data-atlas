from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.analysis_geography_list_envelope_data_analysis_geographies_item_basis import (
    AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemBasis,
)

if TYPE_CHECKING:
    from ..models.analysis_crosswalk import AnalysisCrosswalk
    from ..models.analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1 import (
        AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1,
    )
    from ..models.analysis_source import AnalysisSource


T = TypeVar("T", bound="AnalysisGeographyListEnvelopeDataAnalysisGeographiesItem")


@_attrs_define
class AnalysisGeographyListEnvelopeDataAnalysisGeographiesItem:
    """
    Attributes:
        basis (AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemBasis):
        boundary_release (str):
        conversion (AnalysisCrosswalk | AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1): The
            reviewed crosswalk, or the published path whose steps the conversion runs through.
        geography (str):
        measure_id (str):
        note (str):
        source (AnalysisSource):
    """

    basis: AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemBasis
    boundary_release: str
    conversion: (
        AnalysisCrosswalk
        | AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1
    )
    geography: str
    measure_id: str
    note: str
    source: AnalysisSource
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.analysis_crosswalk import AnalysisCrosswalk

        basis = self.basis.value

        boundary_release = self.boundary_release

        conversion: dict[str, Any]
        if isinstance(self.conversion, AnalysisCrosswalk):
            conversion = self.conversion.to_dict()
        else:
            conversion = self.conversion.to_dict()

        geography = self.geography

        measure_id = self.measure_id

        note = self.note

        source = self.source.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "basis": basis,
                "boundaryRelease": boundary_release,
                "conversion": conversion,
                "geography": geography,
                "measureId": measure_id,
                "note": note,
                "source": source,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.analysis_crosswalk import AnalysisCrosswalk
        from ..models.analysis_geography_list_envelope_data_analysis_geographies_item_conversion_type_1 import (
            AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1,
        )
        from ..models.analysis_source import AnalysisSource

        d = dict(src_dict)
        basis = AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemBasis(
            d.pop("basis")
        )

        boundary_release = d.pop("boundaryRelease")

        def _parse_conversion(
            data: object,
        ) -> (
            AnalysisCrosswalk
            | AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1
        ):
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                conversion_type_0 = AnalysisCrosswalk.from_dict(data)

                return conversion_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            conversion_type_1 = AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1.from_dict(
                data
            )

            return conversion_type_1

        conversion = _parse_conversion(d.pop("conversion"))

        geography = d.pop("geography")

        measure_id = d.pop("measureId")

        note = d.pop("note")

        source = AnalysisSource.from_dict(d.pop("source"))

        analysis_geography_list_envelope_data_analysis_geographies_item = cls(
            basis=basis,
            boundary_release=boundary_release,
            conversion=conversion,
            geography=geography,
            measure_id=measure_id,
            note=note,
            source=source,
        )

        analysis_geography_list_envelope_data_analysis_geographies_item.additional_properties = d
        return analysis_geography_list_envelope_data_analysis_geographies_item

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
