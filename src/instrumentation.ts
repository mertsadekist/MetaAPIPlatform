/**
 * Next.js Instrumentation
 * Runs once at server startup (both dev and production).
 * Used to seed global background jobs in the DB.
 */

export async function register() {
  // Only run on the server side (not Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { seedGlobalJobs } = await import("@/workers/scheduler");
      await seedGlobalJobs();
    } catch (err) {
      // Non-fatal — log and continue startup
      console.warn("[instrumentation] Failed to seed global jobs:", err);
    }
  }
}
