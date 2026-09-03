"use client";
import type { ActiveViz, Dataset, EthnicityCode } from "@lib/types";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { ColorRangeDatasetKey, PartyDisplayData } from "./LegendPanel";
import { RangeControl } from "./controls/RangeControl";
import { renderCategoryLegend } from "./legendUtils";
import { getChartDatasetDefinition } from "@/lib/datasets";

interface LegendContentProps {
  activeDataset: Dataset | null;
  activeViz: ActiveViz;
  displayOptions: MapOptions;
  verticalThemeGradient: string;
  overlayOpacity: number;
  isDark: boolean;
  parties: PartyDisplayData[];
  ethnicities: { id: EthnicityCode; color: string; name: string }[];
  onRangeInput: (key: ColorRangeDatasetKey, min: number, max: number) => void;
  onRangeChangeEnd: (key: ColorRangeDatasetKey) => void;
  onPartyClick: (id: string) => void;
  onPartyRightClick: (id: string) => void;
  onEthnicityClick: (id: string) => void;
  onEthnicityRightClick: (id: string) => void;
  onPointLegendClick: (value: string) => void;
  onPointLegendRightClick: (value: string) => void;
  onNetworkClick: (id: string) => void;
  onNetworkRightClick: (id: string) => void;
}

const defaultFormatLabel = (v: number) => v.toFixed(0);

export default function LegendContent({
  activeDataset,
  activeViz,
  displayOptions,
  verticalThemeGradient,
  overlayOpacity,
  isDark,
  parties,
  ethnicities,
  onRangeInput,
  onRangeChangeEnd,
  onPartyClick,
  onPartyRightClick,
  onEthnicityClick,
  onEthnicityRightClick,
  onPointLegendClick,
  onPointLegendRightClick,
  onNetworkClick,
  onNetworkRightClick,
}: LegendContentProps) {
  if (!activeDataset) return null;

  const renderDynamicLegend = (
    datasetKey: ColorRangeDatasetKey,
    absMin: number,
    absMax: number,
    defaultMin: number,
    defaultMax: number,
    formatLabel: (v: number) => string = defaultFormatLabel,
  ) => {
    const currentMin = displayOptions[datasetKey].colorRange?.min ?? defaultMin;
    const currentMax = displayOptions[datasetKey].colorRange?.max ?? defaultMax;

    const labels = [
      formatLabel(currentMax),
      formatLabel((currentMax - currentMin) * 0.75 + currentMin),
      formatLabel((currentMax - currentMin) * 0.5 + currentMin),
      formatLabel((currentMax - currentMin) * 0.25 + currentMin),
      formatLabel(currentMin),
    ];

    return (
      <RangeControl
        min={absMin}
        max={absMax}
        currentMin={currentMin}
        currentMax={currentMax}
        gradient={verticalThemeGradient}
        labels={labels}
        opacity={overlayOpacity}
        onRangeInput={(min, max) => onRangeInput(datasetKey, min, max)}
        onRangeChangeEnd={() => onRangeChangeEnd(datasetKey)}
      />
    );
  };

  const chartDefinition = getChartDatasetDefinition(activeDataset.type);
  if (chartDefinition?.map) {
    const { colorRange, legend, getColorRange } = chartDefinition.map;
    const dynamicRange = getColorRange?.(activeDataset as never);
    return renderDynamicLegend(
      activeDataset.type as ColorRangeDatasetKey,
      dynamicRange?.min ?? legend.min,
      dynamicRange?.max ?? legend.max,
      dynamicRange?.min ?? colorRange.min,
      dynamicRange?.max ?? colorRange.max,
      legend.format,
    );
  }

  switch (chartDefinition?.legendKind) {
    case "population":
      if (activeViz.view === "age") {
        return renderDynamicLegend("ageDistribution", 18, 80, 25, 55);
      }
      if (activeViz.view === "gender") {
        const currentMin = displayOptions.gender?.colorRange?.min ?? -0.1;
        const currentMax = displayOptions.gender?.colorRange?.max ?? 0.1;
        return (
          <RangeControl
            min={-0.5}
            max={0.5}
            currentMin={currentMin}
            currentMax={currentMax}
            gradient="linear-gradient(to top, rgba(255,105,180,0.8), rgba(240,240,240,0.8), rgba(70,130,180,0.8))"
            labels={[
              `M ${(currentMax * 100).toFixed(0)}%`,
              "0%",
              `F ${(Math.abs(currentMin) * 100).toFixed(0)}%`,
            ]}
            opacity={overlayOpacity}
            onRangeInput={(min, max) => onRangeInput("gender", min, max)}
            onRangeChangeEnd={() => onRangeChangeEnd("gender")}
          />
        );
      }
      // A link that names no view gets the dataset's primary chart, density.
      return renderDynamicLegend("populationDensity", 0, 15000, 500, 8000);

    case "ethnicity": {
      const opts = displayOptions.ethnicity;
      return renderCategoryLegend(
        ethnicities,
        opts?.mode === "percentage",
        opts?.selected,
        onEthnicityClick,
        overlayOpacity,
        isDark,
        new Set(opts?.excluded ?? []),
        onEthnicityRightClick,
      );
    }

    case "party": {
      if (
        activeDataset.type !== "generalElection" &&
        activeDataset.type !== "localElection"
      ) {
        return null;
      }
      const opts = displayOptions[activeDataset.type];
      return renderCategoryLegend(
        parties,
        opts?.mode === "percentage",
        opts?.selected,
        onPartyClick,
        overlayOpacity,
        isDark,
        new Set(opts?.excluded ?? []),
        onPartyRightClick,
      );
    }

    case "brexit": {
      if (
        activeDataset.type !== "brexit" &&
        activeDataset.type !== "brexitConstituency"
      ) {
        return null;
      }
      const key = activeDataset.type;
      const currentMin = displayOptions[key].colorRange?.min ?? 30;
      const currentMax = displayOptions[key].colorRange?.max ?? 70;
      return (
        <RangeControl
          min={0}
          max={100}
          currentMin={currentMin}
          currentMax={currentMax}
          gradient="linear-gradient(to top, rgb(30, 60, 180), rgb(240, 240, 240), rgb(180, 20, 20))"
          labels={[
            `${currentMax.toFixed(0)}% Leave`,
            `${(100 - currentMin).toFixed(0)}% Remain`,
          ]}
          opacity={overlayOpacity}
          onRangeInput={(min, max) => onRangeInput(key, min, max)}
          onRangeChangeEnd={() => onRangeChangeEnd(key)}
        />
      );
    }
  }

  switch (activeDataset.type) {
    case "network": {
      if (!activeDataset.legend) return null;
      const networkOpts = displayOptions.network;
      return renderCategoryLegend(
        activeDataset.legend.map((item) => ({
          id: item.id,
          color: item.color,
          name: item.label,
        })),
        true,
        networkOpts?.selected,
        onNetworkClick,
        overlayOpacity,
        isDark,
        new Set(networkOpts?.excluded ?? []),
        onNetworkRightClick,
      );
    }

    case "custom":
      if (activeDataset.kind === "points" && activeDataset.pointStyle?.legend) {
        const { colorByValue, legend } = activeDataset.pointStyle;
        return renderCategoryLegend(
          legend.map(({ value, label }) => ({
            id: String(value),
            color: colorByValue?.[value] ?? "#999",
            name: label,
          })),
          displayOptions.custom.selectedPointValue !== undefined,
          String(displayOptions.custom.selectedPointValue),
          onPointLegendClick,
          overlayOpacity,
          isDark,
          new Set(
            (displayOptions.custom.excludedPointValues ?? []).map(String),
          ),
          onPointLegendRightClick,
        );
      }
      return renderDynamicLegend("custom", 0, 100, 0, 100);

    default:
      return null;
  }
}
