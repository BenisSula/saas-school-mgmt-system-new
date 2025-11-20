/**
 * Background Job Service
 * Handles async background tasks like tenant preparation
 * 
 * Note: In production, consider using a proper job queue (Bull, BullMQ, etc.)
 * For now, we use simple Promise-based background execution
 */

type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

interface Job {
  id: string;
  type: string;
  status: JobStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

const activeJobs = new Map<string, Job>();

/**
 * Execute a job in the background
 * Returns immediately with job ID
 */
export function executeBackgroundJob<T>(
  jobType: string,
  jobFn: () => Promise<T>
): string {
  const jobId = `${jobType}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const job: Job = {
    id: jobId,
    type: jobType,
    status: 'pending'
  };

  activeJobs.set(jobId, job);

  // Execute job asynchronously
  Promise.resolve()
    .then(() => {
      job.status = 'running';
      job.startedAt = new Date();
      return jobFn();
    })
    .then(() => {
      job.status = 'completed';
      job.completedAt = new Date();
      // Keep job for 1 hour, then remove
      setTimeout(() => {
        activeJobs.delete(jobId);
      }, 60 * 60 * 1000);
    })
    .catch((error) => {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error instanceof Error ? error.message : String(error);
      console.error(`[backgroundJob] Job ${jobId} failed:`, job.error);
      // Keep failed jobs for 24 hours for debugging
      setTimeout(() => {
        activeJobs.delete(jobId);
      }, 24 * 60 * 60 * 1000);
    });

  return jobId;
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): Job | null {
  return activeJobs.get(jobId) || null;
}

/**
 * Get all active jobs
 */
export function getActiveJobs(): Job[] {
  return Array.from(activeJobs.values());
}

/**
 * Clean up old completed jobs
 */
export function cleanupOldJobs(maxAge: number = 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [jobId, job] of activeJobs.entries()) {
    if (job.status === 'completed' && job.completedAt) {
      const age = now - job.completedAt.getTime();
      if (age > maxAge) {
        activeJobs.delete(jobId);
      }
    }
  }
}

