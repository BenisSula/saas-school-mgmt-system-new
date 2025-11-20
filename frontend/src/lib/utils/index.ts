/**
 * Consolidated utility exports
 * Central export point for all utility functions
 */

// Class name utilities
export { cn } from './cn';

// Date utilities
export {
  formatDate,
  formatDateTime,
  formatDateShort,
  deriveDateRange,
  defaultDate
} from './date';

// Status utilities
export { getStatusBadgeClass, formatStatus } from './status';

// Data utilities
export {
  deriveContacts,
  calculatePercentage,
  formatCurrency,
  formatNumber
} from './data';

// Animation utilities
export {
  fadeIn,
  slideIn,
  scale,
  staggerContainer,
  staggerItem,
  pageTransition,
  cardHover,
  buttonPress,
  modalAnimation,
  sidebarAnimation,
  transitions
} from './animations';

// Responsive utilities
export {
  breakpoints,
  spacing,
  typography,
  getResponsiveValue,
  useBreakpoint
} from './responsive';

// Export utilities
export {
  exportToCSV,
  exportToJSON,
  exportToPDF,
  exportToExcel
} from './export';
