/**
 * Chart components exports
 * Central export point for all chart components
 * 
 * All charts now use Recharts internally for better accessibility and features
 * while maintaining backward-compatible APIs
 */

// Unified charts (use Recharts internally, backward-compatible API)
export { BarChart, type BarChartData, type BarChartProps } from './BarChart';
export { PieChart, type PieChartData, type PieChartProps } from './PieChart';
export { LineChart, type LineChartDataPoint, type LineChartProps } from './LineChart';
export { StatCard, type StatCardProps } from './StatCard';
export { ChartContainer, type ChartContainerProps } from './ChartContainer';

// Re-export layout components for convenience
export { PageHeader, type PageHeaderProps } from '../layout/PageHeader';
export { FilterPanel, type FilterPanelProps } from '../ui/FilterPanel';

