/**
 * Next.js Instrumentation
 * Runs once at server startup (both dev and production).
 * Seeds global background jobs and starts the scheduler polling loop.
 */

export async function register() {
  // Only run on the server side (not Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { seedGlobalJobs, processNextJob } = await import("@/workers/scheduler");
      await seedGlobalJobs();

      // Start the scheduler polling loop — checks for due jobs every 30 seconds
      const runLoop = async () => {
        try {
          await processNextJob();
        } catch (err) {
          console.error("[scheduler] processNextJob error:", err);
        }
      };

      // Run immediately on startup, then every 30 seconds
      void runLoop();
      setInterval(runLoop, 30_000);

      console.info("[instrumentation] Scheduler polling loop started (30s interval)");
    } catch (err) {
      // Non-fatal — log and continue startup
      console.warn("[instrumentation] Failed to start scheduler:", err);
    }
  }
}
