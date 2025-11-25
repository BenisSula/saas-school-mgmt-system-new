/**
 * Shared chart utilities for consistent data transformation
 * DRY principle - reusable chart data processing functions
 */

import type { PieChartData } from '../../components/charts/PieChart';
import type { BarChartData } from '../../components/charts/BarChart';
import type { LineChartDataPoint } from '../../components/charts/LineChart';

/**
 * Generate colors for chart segments
 */
export function generateChartColors(count: number, saturation = 70, lightness = 50): string[] {
  return Array.from({ length: count }, (_, i) => {
    const hue = (i * 360) / count;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  });
}

/**
 * Transform data into pie chart format
 */
export function toPieChartData<T>(
  data: T[],
  getLabel: (item: T) => string,
  getValue: (item: T) => number,
  colors?: string[]
): PieChartData[] {
  const chartData = data.map((item, index) => ({
    label: getLabel(item),
    value: getValue(item),
    color: colors?.[index],
  }));

  const generatedColors = generateChartColors(chartData.length);
  return chartData.map((item, index) => ({
    ...item,
    color: item.color || generatedColors[index],
  }));
}

/**
 * Transform data into bar chart format
 */
export function toBarChartData<T>(
  data: T[],
  getLabel: (item: T) => string,
  getValue: (item: T) => number,
  color?: string
): BarChartData[] {
  return data.map((item) => ({
    label: getLabel(item),
    value: getValue(item),
    color,
  }));
}

/**
 * Transform time-series data into line chart format
 */
export function toLineChartData<T>(
  data: T[],
  getLabel: (item: T) => string,
  getValue: (item: T) => number
): LineChartDataPoint[] {
  return data.map((item) => ({
    label: getLabel(item),
    value: getValue(item),
  }));
}

/**
 * Group data by a key and aggregate values
 */
export function groupAndAggregate<T>(
  data: T[],
  getKey: (item: T) => string,
  getValue: (item: T) => number,
  aggregateFn: (values: number[]) => number = (vals) => vals.reduce((a, b) => a + b, 0)
): Record<string, number> {
  const grouped = new Map<string, number[]>();

  data.forEach((item) => {
    const key = getKey(item);
    const value = getValue(item);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(value);
  });

  const result: Record<string, number> = {};
  grouped.forEach((values, key) => {
    result[key] = aggregateFn(values);
  });

  return result;
}

/**
 * Calculate percentage distribution
 */
export function calculatePercentages(values: Record<string, number>): Record<string, number> {
  const total = Object.values(values).reduce((sum, val) => sum + val, 0);
  if (total === 0) return values;

  const percentages: Record<string, number> = {};
  Object.entries(values).forEach(([key, value]) => {
    percentages[key] = (value / total) * 100;
  });

  return percentages;
}

/**
 * Sort chart data by value (descending)
 */
export function sortChartData<T extends { value: number }>(data: T[], ascending = false): T[] {
  return [...data].sort((a, b) => (ascending ? a.value - b.value : b.value - a.value));
}

/**
 * Format device type for display
 */
export function formatDeviceType(deviceType?: 'mobile' | 'tablet' | 'desktop' | string): string {
  if (!deviceType) return 'Unknown';
  return deviceType.charAt(0).toUpperCase() + deviceType.slice(1);
}

/**
 * Format tenant name for display
 */
export function formatTenantName(name: string | null | undefined): string {
  if (!name) return 'Unknown Tenant';
  return name.length > 30 ? `${name.slice(0, 30)}...` : name;
}
