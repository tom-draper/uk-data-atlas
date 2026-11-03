from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.get_measure_response_200_data_value_kind import (
    GetMeasureResponse200DataValueKind,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.get_measure_response_200_data_aggregation import (
        GetMeasureResponse200DataAggregation,
    )
    from ..models.get_measure_response_200_data_availability import (
        GetMeasureResponse200DataAvailability,
    )
    from ..models.get_measure_response_200_data_defaults import (
        GetMeasureResponse200DataDefaults,
    )
    from ..models.get_measure_response_200_data_derived_from import (
        GetMeasureResponse200DataDerivedFrom,
    )
    from ..models.get_measure_response_200_data_dimensions_item import (
        GetMeasureResponse200DataDimensionsItem,
    )
    from ..models.get_measure_response_200_data_documents import (
        GetMeasureResponse200DataDocuments,
    )
    from ..models.get_measure_response_200_data_elsewhere_item import (
        GetMeasureResponse200DataElsewhereItem,
    )
    from ..models.get_measure_response_200_data_links import (
        GetMeasureResponse200DataLinks,
    )
    from ..models.get_measure_response_200_data_matched_members_item import (
        GetMeasureResponse200DataMatchedMembersItem,
    )
    from ..models.get_measure_response_200_data_series_item import (
        GetMeasureResponse200DataSeriesItem,
    )
    from ..models.get_measure_response_200_data_sources_item import (
        GetMeasureResponse200DataSourcesItem,
    )
    from ..models.get_measure_response_200_data_uncertainty import (
        GetMeasureResponse200DataUncertainty,
    )
    from ..models.get_measure_response_200_data_unit_definition import (
        GetMeasureResponse200DataUnitDefinition,
    )


T = TypeVar("T", bound="GetMeasureResponse200Data")


@_attrs_define
class GetMeasureResponse200Data:
    """
    Attributes:
        aggregation (GetMeasureResponse200DataAggregation):
        availability (GetMeasureResponse200DataAvailability):
        description (str):
        dimensions (list[GetMeasureResponse200DataDimensionsItem]):
        id (str):
        label (str):
        links (GetMeasureResponse200DataLinks):
        series (list[GetMeasureResponse200DataSeriesItem]):
        sources (list[GetMeasureResponse200DataSourcesItem]):
        unit (str):
        value_kind (GetMeasureResponse200DataValueKind):
        aliases (list[str] | Unset):
        concept (str | Unset):
        defaults (GetMeasureResponse200DataDefaults | Unset):
        derived_from (GetMeasureResponse200DataDerivedFrom | Unset):
        documents (GetMeasureResponse200DataDocuments | Unset):
        elsewhere (list[GetMeasureResponse200DataElsewhereItem] | Unset):
        matched_members (list[GetMeasureResponse200DataMatchedMembersItem] | Unset):
        notes (list[str] | Unset):
        uncertainty (GetMeasureResponse200DataUncertainty | Unset):
        unit_definition (GetMeasureResponse200DataUnitDefinition | Unset):
    """

    aggregation: GetMeasureResponse200DataAggregation
    availability: GetMeasureResponse200DataAvailability
    description: str
    dimensions: list[GetMeasureResponse200DataDimensionsItem]
    id: str
    label: str
    links: GetMeasureResponse200DataLinks
    series: list[GetMeasureResponse200DataSeriesItem]
    sources: list[GetMeasureResponse200DataSourcesItem]
    unit: str
    value_kind: GetMeasureResponse200DataValueKind
    aliases: list[str] | Unset = UNSET
    concept: str | Unset = UNSET
    defaults: GetMeasureResponse200DataDefaults | Unset = UNSET
    derived_from: GetMeasureResponse200DataDerivedFrom | Unset = UNSET
    documents: GetMeasureResponse200DataDocuments | Unset = UNSET
    elsewhere: list[GetMeasureResponse200DataElsewhereItem] | Unset = UNSET
    matched_members: list[GetMeasureResponse200DataMatchedMembersItem] | Unset = UNSET
    notes: list[str] | Unset = UNSET
    uncertainty: GetMeasureResponse200DataUncertainty | Unset = UNSET
    unit_definition: GetMeasureResponse200DataUnitDefinition | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        aggregation = self.aggregation.to_dict()

        availability = self.availability.to_dict()

        description = self.description

        dimensions = []
        for dimensions_item_data in self.dimensions:
            dimensions_item = dimensions_item_data.to_dict()
            dimensions.append(dimensions_item)

        id = self.id

        label = self.label

        links = self.links.to_dict()

        series = []
        for series_item_data in self.series:
            series_item = series_item_data.to_dict()
            series.append(series_item)

        sources = []
        for sources_item_data in self.sources:
            sources_item = sources_item_data.to_dict()
            sources.append(sources_item)

        unit = self.unit

        value_kind = self.value_kind.value

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        concept = self.concept

        defaults: dict[str, Any] | Unset = UNSET
        if not isinstance(self.defaults, Unset):
            defaults = self.defaults.to_dict()

        derived_from: dict[str, Any] | Unset = UNSET
        if not isinstance(self.derived_from, Unset):
            derived_from = self.derived_from.to_dict()

        documents: dict[str, Any] | Unset = UNSET
        if not isinstance(self.documents, Unset):
            documents = self.documents.to_dict()

        elsewhere: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.elsewhere, Unset):
            elsewhere = []
            for elsewhere_item_data in self.elsewhere:
                elsewhere_item = elsewhere_item_data.to_dict()
                elsewhere.append(elsewhere_item)

        matched_members: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.matched_members, Unset):
            matched_members = []
            for matched_members_item_data in self.matched_members:
                matched_members_item = matched_members_item_data.to_dict()
                matched_members.append(matched_members_item)

        notes: list[str] | Unset = UNSET
        if not isinstance(self.notes, Unset):
            notes = self.notes

        uncertainty: dict[str, Any] | Unset = UNSET
        if not isinstance(self.uncertainty, Unset):
            uncertainty = self.uncertainty.to_dict()

        unit_definition: dict[str, Any] | Unset = UNSET
        if not isinstance(self.unit_definition, Unset):
            unit_definition = self.unit_definition.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "aggregation": aggregation,
                "availability": availability,
                "description": description,
                "dimensions": dimensions,
                "id": id,
                "label": label,
                "links": links,
                "series": series,
                "sources": sources,
                "unit": unit,
                "valueKind": value_kind,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases
        if concept is not UNSET:
            field_dict["concept"] = concept
        if defaults is not UNSET:
            field_dict["defaults"] = defaults
        if derived_from is not UNSET:
            field_dict["derivedFrom"] = derived_from
        if documents is not UNSET:
            field_dict["documents"] = documents
        if elsewhere is not UNSET:
            field_dict["elsewhere"] = elsewhere
        if matched_members is not UNSET:
            field_dict["matchedMembers"] = matched_members
        if notes is not UNSET:
            field_dict["notes"] = notes
        if uncertainty is not UNSET:
            field_dict["uncertainty"] = uncertainty
        if unit_definition is not UNSET:
            field_dict["unitDefinition"] = unit_definition

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_measure_response_200_data_aggregation import (
            GetMeasureResponse200DataAggregation,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_availability import (
            GetMeasureResponse200DataAvailability,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_defaults import (
            GetMeasureResponse200DataDefaults,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_derived_from import (
            GetMeasureResponse200DataDerivedFrom,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_dimensions_item import (
            GetMeasureResponse200DataDimensionsItem,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_documents import (
            GetMeasureResponse200DataDocuments,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_elsewhere_item import (
            GetMeasureResponse200DataElsewhereItem,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_links import (
            GetMeasureResponse200DataLinks,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_matched_members_item import (
            GetMeasureResponse200DataMatchedMembersItem,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_series_item import (
            GetMeasureResponse200DataSeriesItem,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_sources_item import (
            GetMeasureResponse200DataSourcesItem,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_uncertainty import (
            GetMeasureResponse200DataUncertainty,  # noqa: PLC0415
        )
        from ..models.get_measure_response_200_data_unit_definition import (
            GetMeasureResponse200DataUnitDefinition,  # noqa: PLC0415
        )

        d = dict(src_dict)
        aggregation = GetMeasureResponse200DataAggregation.from_dict(
            d.pop("aggregation")
        )

        availability = GetMeasureResponse200DataAvailability.from_dict(
            d.pop("availability")
        )

        description = d.pop("description")

        dimensions = []
        _dimensions = d.pop("dimensions")
        for dimensions_item_data in _dimensions:
            dimensions_item = GetMeasureResponse200DataDimensionsItem.from_dict(
                dimensions_item_data
            )

            dimensions.append(dimensions_item)

        id = d.pop("id")

        label = d.pop("label")

        links = GetMeasureResponse200DataLinks.from_dict(d.pop("links"))

        series = []
        _series = d.pop("series")
        for series_item_data in _series:
            series_item = GetMeasureResponse200DataSeriesItem.from_dict(
                series_item_data
            )

            series.append(series_item)

        sources = []
        _sources = d.pop("sources")
        for sources_item_data in _sources:
            sources_item = GetMeasureResponse200DataSourcesItem.from_dict(
                sources_item_data
            )

            sources.append(sources_item)

        unit = d.pop("unit")

        value_kind = GetMeasureResponse200DataValueKind(d.pop("valueKind"))

        aliases = cast(list[str], d.pop("aliases", UNSET))

        concept = d.pop("concept", UNSET)

        _defaults = d.pop("defaults", UNSET)
        defaults: GetMeasureResponse200DataDefaults | Unset
        if isinstance(_defaults, Unset):
            defaults = UNSET
        else:
            defaults = GetMeasureResponse200DataDefaults.from_dict(_defaults)

        _derived_from = d.pop("derivedFrom", UNSET)
        derived_from: GetMeasureResponse200DataDerivedFrom | Unset
        if isinstance(_derived_from, Unset):
            derived_from = UNSET
        else:
            derived_from = GetMeasureResponse200DataDerivedFrom.from_dict(_derived_from)

        _documents = d.pop("documents", UNSET)
        documents: GetMeasureResponse200DataDocuments | Unset
        if isinstance(_documents, Unset):
            documents = UNSET
        else:
            documents = GetMeasureResponse200DataDocuments.from_dict(_documents)

        _elsewhere = d.pop("elsewhere", UNSET)
        elsewhere: list[GetMeasureResponse200DataElsewhereItem] | Unset = UNSET
        if _elsewhere is not UNSET:
            elsewhere = []
            for elsewhere_item_data in _elsewhere:
                elsewhere_item = GetMeasureResponse200DataElsewhereItem.from_dict(
                    elsewhere_item_data
                )

                elsewhere.append(elsewhere_item)

        _matched_members = d.pop("matchedMembers", UNSET)
        matched_members: list[GetMeasureResponse200DataMatchedMembersItem] | Unset = (
            UNSET
        )
        if _matched_members is not UNSET:
            matched_members = []
            for matched_members_item_data in _matched_members:
                matched_members_item = (
                    GetMeasureResponse200DataMatchedMembersItem.from_dict(
                        matched_members_item_data
                    )
                )

                matched_members.append(matched_members_item)

        notes = cast(list[str], d.pop("notes", UNSET))

        _uncertainty = d.pop("uncertainty", UNSET)
        uncertainty: GetMeasureResponse200DataUncertainty | Unset
        if isinstance(_uncertainty, Unset):
            uncertainty = UNSET
        else:
            uncertainty = GetMeasureResponse200DataUncertainty.from_dict(_uncertainty)

        _unit_definition = d.pop("unitDefinition", UNSET)
        unit_definition: GetMeasureResponse200DataUnitDefinition | Unset
        if isinstance(_unit_definition, Unset):
            unit_definition = UNSET
        else:
            unit_definition = GetMeasureResponse200DataUnitDefinition.from_dict(
                _unit_definition
            )

        get_measure_response_200_data = cls(
            aggregation=aggregation,
            availability=availability,
            description=description,
            dimensions=dimensions,
            id=id,
            label=label,
            links=links,
            series=series,
            sources=sources,
            unit=unit,
            value_kind=value_kind,
            aliases=aliases,
            concept=concept,
            defaults=defaults,
            derived_from=derived_from,
            documents=documents,
            elsewhere=elsewhere,
            matched_members=matched_members,
            notes=notes,
            uncertainty=uncertainty,
            unit_definition=unit_definition,
        )

        get_measure_response_200_data.additional_properties = d
        return get_measure_response_200_data

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
