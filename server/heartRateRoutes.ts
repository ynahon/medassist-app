import { Router, Request, Response } from "express";
import { db } from "./storage";
import { heartRateSamples, healthConnections, HeartRateSource } from "../shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const router = Router();

interface HeartRateSampleInput {
  source: HeartRateSource;
  timestamp: string;
  bpm: number;
  deviceName?: string;
  workoutContext?: string;
  metadata?: string;
}

// POST /api/cardio/heart-rate/bulk - Bulk upload heart rate samples
router.post("/heart-rate/bulk", async (req: Request, res: Response) => {
  try {
    const { userId, samples } = req.body as { userId: string; samples: HeartRateSampleInput[] };

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({ error: "samples array is required" });
    }

    const validSamples: HeartRateSampleInput[] = [];
    const errors: string[] = [];

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      
      // Validate BPM (20-250 is reasonable range)
      if (typeof sample.bpm !== "number" || sample.bpm < 20 || sample.bpm > 250) {
        errors.push(`Sample ${i}: Invalid BPM value ${sample.bpm}`);
        continue;
      }

      // Validate timestamp
      const timestamp = new Date(sample.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push(`Sample ${i}: Invalid timestamp`);
        continue;
      }

      // Don't accept future timestamps (more than 1 hour ahead)
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      if (timestamp > oneHourFromNow) {
        errors.push(`Sample ${i}: Timestamp is in the future`);
        continue;
      }

      // Validate source
      if (sample.source !== "healthkit" && sample.source !== "health_connect") {
        errors.push(`Sample ${i}: Invalid source ${sample.source}`);
        continue;
      }

      validSamples.push(sample);
    }

    if (validSamples.length === 0) {
      return res.status(400).json({ error: "No valid samples", details: errors });
    }

    // Insert samples (duplicates will be handled by unique constraint if added)
    let insertedCount = 0;
    for (const sample of validSamples) {
      try {
        await db.insert(heartRateSamples).values({
          userId,
          timestamp: new Date(sample.timestamp),
          bpm: sample.bpm,
          source: sample.source,
          deviceName: sample.deviceName || null,
          workoutContext: sample.workoutContext || null,
          metadata: sample.metadata || null,
        });
        insertedCount++;
      } catch (err: any) {
        // Likely duplicate, skip
        if (!err.message?.includes("duplicate")) {
          console.error("Error inserting heart rate sample:", err);
        }
      }
    }

    // Update last sync time
    await db
      .insert(healthConnections)
      .values({
        userId,
        source: validSamples[0].source,
        connected: 1,
        lastSyncAt: new Date(),
      })
      .onConflictDoUpdate({
        target: healthConnections.userId,
        set: {
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        },
      });

    res.json({
      success: true,
      inserted: insertedCount,
      skipped: validSamples.length - insertedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Error in bulk heart rate upload:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cardio/heart-rate - Get heart rate samples with date range
router.get("/heart-rate", async (req: Request, res: Response) => {
  try {
    const { userId, from, to, limit = "100" } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    const conditions = [eq(heartRateSamples.userId, userId)];

    if (from && typeof from === "string") {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(heartRateSamples.timestamp, fromDate));
      }
    }

    if (to && typeof to === "string") {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        conditions.push(lte(heartRateSamples.timestamp, toDate));
      }
    }

    const samples = await db
      .select()
      .from(heartRateSamples)
      .where(and(...conditions))
      .orderBy(desc(heartRateSamples.timestamp))
      .limit(Math.min(parseInt(limit as string) || 100, 1000));

    res.json({ samples });
  } catch (error: any) {
    console.error("Error fetching heart rate samples:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cardio/connection - Get health connection status
router.get("/connection", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    const connection = await db
      .select()
      .from(healthConnections)
      .where(eq(healthConnections.userId, userId))
      .limit(1);

    if (connection.length === 0) {
      return res.json({ connected: false, source: null, lastSyncAt: null });
    }

    res.json({
      connected: connection[0].connected === 1,
      source: connection[0].source,
      lastSyncAt: connection[0].lastSyncAt,
    });
  } catch (error: any) {
    console.error("Error fetching health connection:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/cardio/connection - Disconnect health data source
router.delete("/connection", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    await db
      .update(healthConnections)
      .set({ connected: 0, updatedAt: new Date() })
      .where(eq(healthConnections.userId, userId));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error disconnecting health source:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cardio/heart-rate/stats - Get heart rate statistics
router.get("/heart-rate/stats", async (req: Request, res: Response) => {
  try {
    const { userId, days = "7" } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    const daysBack = parseInt(days as string) || 7;
    const fromDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const samples = await db
      .select()
      .from(heartRateSamples)
      .where(
        and(
          eq(heartRateSamples.userId, userId),
          gte(heartRateSamples.timestamp, fromDate)
        )
      )
      .orderBy(desc(heartRateSamples.timestamp));

    if (samples.length === 0) {
      return res.json({
        count: 0,
        average: null,
        min: null,
        max: null,
        latest: null,
      });
    }

    const bpmValues = samples.map((s) => s.bpm);
    const average = Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length);
    const min = Math.min(...bpmValues);
    const max = Math.max(...bpmValues);

    res.json({
      count: samples.length,
      average,
      min,
      max,
      latest: samples[0],
    });
  } catch (error: any) {
    console.error("Error fetching heart rate stats:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
