from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.analysis_geography_validation_envelope_data_supports_item_crosswalk import (
        AnalysisGeographyValidationEnvelopeDataSupportsItemCrosswalk,
    )
    from ..models.analysis_geography_validation_envelope_data_supports_item_observations import (
        AnalysisGeographyValidationEnvelopeDataSupportsItemObservations,
    )
    from ..models.analysis_geography_validation_envelope_data_supports_item_path import (
        AnalysisGeographyValidationEnvelopeDataSupportsItemPath,
    )
    from ..models.analysis_geography_validation_envelope_data_supports_item_periods_item import (
        AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItem,
    )
    from ..models.analysis_source import AnalysisSource
    from ..models.crosswalk_side import CrosswalkSide


T = TypeVar("T", bound="AnalysisGeographyValidationEnvelopeDataSupportsItem")


@_attrs_define
class AnalysisGeographyValidationEnvelopeDataSupportsItem:
    """
    Attributes:
        analysis_geography (CrosswalkSide):
        measure_id (str):
        observations (AnalysisGeographyValidationEnvelopeDataSupportsItemObservations):
        periods (list[AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItem]):
        source (AnalysisSource):
        crosswalk (AnalysisGeographyValidationEnvelopeDataSupportsItemCrosswalk | Unset): The reviewed crosswalk, for a
            one-crosswalk support.
        path (AnalysisGeographyValidationEnvelopeDataSupportsItemPath | Unset): Every crosswalk of the reviewed path,
            for a path-backed support.
    """

    analysis_geography: CrosswalkSide
    measure_id: str
    observations: AnalysisGeographyValidationEnvelopeDataSupportsItemObservations
    periods: list[AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItem]
    source: AnalysisSource
    crosswalk: AnalysisGeographyValidationEnvelopeDataSupportsItemCrosswalk | Unset = (
        UNSET
    )
    path: AnalysisGeographyValidationEnvelopeDataSupportsItemPath | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        analysis_geography = self.analysis_geography.to_dict()

        measure_id = self.measure_id

        observations = self.observations.to_dict()

        periods = []
        for periods_item_data in self.periods:
            periods_item = periods_item_data.to_dict()
            periods.append(periods_item)

        source = self.source.to_dict()

        crosswalk: dict[str, Any] | Unset = UNSET
        if not isinstance(self.crosswalk, Unset):
            crosswalk = self.crosswalk.to_dict()

        path: dict[str, Any] | Unset = UNSET
        if not isinstance(self.path, Unset):
            path = self.path.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "analysisGeography": analysis_geography,
                "measureId": measure_id,
                "observations": observations,
                "periods": periods,
                "source": source,
            }
        )
        if crosswalk is not UNSET:
            field_dict["crosswalk"] = crosswalk
        if path is not UNSET:
            field_dict["path"] = path

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.analysis_geography_validation_envelope_data_supports_item_crosswalk import (
            AnalysisGeographyValidationEnvelopeDataSupportsItemCrosswalk,
        )
        from ..models.analysis_geography_validation_envelope_data_supports_item_observations import (
            AnalysisGeographyValidationEnvelopeDataSupportsItemObservations,
        )
        from ..models.analysis_geography_validation_envelope_data_supports_item_path import (
            AnalysisGeographyValidationEnvelopeDataSupportsItemPath,
        )
        from ..models.analysis_geography_validation_envelope_data_supports_item_periods_item import (
            AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItem,
        )
        from ..models.analysis_source import AnalysisSource
        from ..models.crosswalk_side import CrosswalkSide

        d = dict(src_dict)
        analysis_geography = CrosswalkSide.from_dict(d.pop("analysisGeography"))

        measure_id = d.pop("measureId")

        observations = (
            AnalysisGeographyValidationEnvelopeDataSupportsItemObservations.from_dict(
                d.pop("observations")
            )
        )

        periods = []
        _periods = d.pop("periods")
        for periods_item_data in _periods:
            periods_item = AnalysisGeographyValidationEnvelopeDataSupportsItemPeriodsItem.from_dict(
                periods_item_data
            )

            periods.append(periods_item)

        source = AnalysisSource.from_dict(d.pop("source"))

        _crosswalk = d.pop("crosswalk", UNSET)
        crosswalk: AnalysisGeographyValidationEnvelopeDataSupportsItemCrosswalk | Unset
        if isinstance(_crosswalk, Unset):
            crosswalk = UNSET
        else:
            crosswalk = (
                AnalysisGeographyValidationEnvelopeDataSupportsItemCrosswalk.from_dict(
                    _crosswalk
                )
            )

        _path = d.pop("path", UNSET)
        path: AnalysisGeographyValidationEnvelopeDataSupportsItemPath | Unset
        if isinstance(_path, Unset):
            path = UNSET
        else:
            path = AnalysisGeographyValidationEnvelopeDataSupportsItemPath.from_dict(
                _path
            )

        analysis_geography_validation_envelope_data_supports_item = cls(
            analysis_geography=analysis_geography,
            measure_id=measure_id,
            observations=observations,
            periods=periods,
            source=source,
            crosswalk=crosswalk,
            path=path,
        )

        analysis_geography_validation_envelope_data_supports_item.additional_properties = d
        return analysis_geography_validation_envelope_data_supports_item

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
