/**
 * Frontend Performance Metrics
 *
 * Collects and reports frontend performance metrics to backend
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 100;
  private readonly flushInterval = 30000; // 30 seconds
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.startMonitoring();
    this.startFlushTimer();
  }

  /**
   * Start monitoring performance
   */
  private startMonitoring(): void {
    // Monitor page load performance
    if (typeof window !== 'undefined' && window.performance) {
      window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        this.recordMetric('page_load_time', pageLoadTime, {
          page: window.location.pathname,
        });

        // Resource timing
        const resources = window.performance.getEntriesByType(
          'resource'
        ) as PerformanceResourceTiming[];
        resources.forEach((resource) => {
          this.recordMetric('resource_load_time', resource.duration, {
            type: resource.initiatorType,
            name: resource.name,
          });
        });
      });
    }

    // Monitor long tasks (blocking main thread)
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'longtask') {
              this.recordMetric('long_task_duration', entry.duration, {
                page: window.location.pathname,
              });
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Long task observer not supported
      }
    }

    // Monitor Web Vitals
    this.monitorWebVitals();
  }

  /**
   * Monitor Core Web Vitals
   */
  private monitorWebVitals(): void {
    if (typeof window === 'undefined') return;

    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
            renderTime?: number;
            loadTime?: number;
          };
          const lcp = lastEntry.renderTime || lastEntry.loadTime || 0;
          this.recordMetric('lcp', lcp, {
            page: window.location.pathname,
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // LCP observer not supported
      }
    }

    // First Input Delay (FID)
    if ('PerformanceObserver' in window) {
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const fidEntry = entry as PerformanceEntry & {
              processingStart?: number;
              startTime?: number;
            };
            if (fidEntry.processingStart && fidEntry.startTime) {
              this.recordMetric('fid', fidEntry.processingStart - fidEntry.startTime, {
                page: window.location.pathname,
              });
            }
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        // FID observer not supported
      }
    }

    // Cumulative Layout Shift (CLS)
    if ('PerformanceObserver' in window) {
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShiftEntry = entry as PerformanceEntry & {
              hadRecentInput?: boolean;
              value?: number;
            };
            if (!layoutShiftEntry.hadRecentInput && layoutShiftEntry.value !== undefined) {
              clsValue += layoutShiftEntry.value;
            }
          }
          this.recordMetric('cls', clsValue, {
            page: window.location.pathname,
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // CLS observer not supported
      }
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });

    // Limit metrics array size
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Start flush timer to send metrics periodically
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);
  }

  /**
   * Flush metrics to backend
   */
  private async flushMetrics(): Promise<void> {
    if (this.metrics.length === 0) return;

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    try {
      // Send to backend metrics endpoint
      await fetch('/api/metrics/frontend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metrics: metricsToSend }),
      });
    } catch (error) {
      // Silently fail - don't block user experience
      console.warn('[PerformanceMonitor] Failed to send metrics:', error);
      // Re-add metrics if send failed
      this.metrics.unshift(...metricsToSend);
    }
  }

  /**
   * Get current metrics (for debugging)
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushMetrics();
  }
}

// Create singleton instance
export const performanceMonitor = typeof window !== 'undefined' ? new PerformanceMonitor() : null;

// Export for manual metric recording
export function recordPerformanceMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
): void {
  performanceMonitor?.recordMetric(name, value, tags);
}
