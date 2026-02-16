
import { task } from "@trigger.dev/sdk/v3";
import fs, { promises as fsPromises } from "node:fs"; // Using fs.promises for async operations where cleaner
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

// Import static binaries for serverless compatibility
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";

interface ExtractFramePayload {
  videoUrl: string;
  timestamp: string; // e.g., "5.0" (seconds) or "50%" (percentage)
  nodeId: string;
  runId: string;
  outputFormat?: "jpg" | "png";
  quality?: number; // 2-31, lower is better. Default 2.
}

interface ExtractionResult {
  nodeId: string;
  runId: string;
  output: string; // base64 data URL
  extractedAt: string; // timestamp string used
  duration: number; // video duration in seconds
  success: boolean;
  error?: string;
}

// Configuration
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB limit
const DOWNLOAD_TIMEOUT_MS = 60000; // 60s download timeout
const FFPROBE_TIMEOUT_MS = 10000; // 10s probe timeout
const FFMPEG_TIMEOUT_MS = 30000; // 30s extraction timeout

export const extractFrameTask = task({
  id: "extract-frame",
  // Set a reasonable max duration for the entire task (e.g. 3 mins)
  maxDuration: 180,
  run: async (payload: ExtractFramePayload): Promise<ExtractionResult> => {
    const { videoUrl, timestamp, nodeId, runId, outputFormat = "jpg", quality = 2 } = payload;

    // 1. Validation
    if (!videoUrl || !videoUrl.startsWith("http")) {
      throw new Error("Invalid video URL provided.");
    }
    if (!timestamp) {
      throw new Error("Timestamp is required.");
    }

    // 2. Setup Temp Directory
    const uniqueId = Math.random().toString(36).substring(7);
    const tempDir = path.join(os.tmpdir(), `extract-${runId}-${uniqueId}`);
    const videoPath = path.join(tempDir, `input.mp4`); // We'll try to detect ext if possible, but ffmpeg usually handles it
    const framePath = path.join(tempDir, `output.${outputFormat}`);

    try {
      await fsPromises.mkdir(tempDir, { recursive: true });

      // 3. Download Video
      console.log(`Downloading video from ${videoUrl}...`);
      await downloadVideo(videoUrl, videoPath, MAX_VIDEO_SIZE_BYTES);

      // 4. Get Duration (for percentage calculation)
      console.log("Probing video duration...");
      const duration = await getVideoDuration(videoPath);
      console.log(`Video duration: ${duration}s`);

      // 5. Calculate Seek Time
      let seekTime = 0;
      if (timestamp.endsWith("%")) {
        const percent = parseFloat(timestamp.replace("%", ""));
        if (isNaN(percent) || percent < 0 || percent > 100) {
          throw new Error(`Invalid percentage timestamp: ${timestamp}`);
        }
        seekTime = (percent / 100) * duration;
      } else {
        seekTime = parseFloat(timestamp);
        if (isNaN(seekTime) || seekTime < 0) {
          throw new Error(`Invalid timestamp: ${timestamp}`);
        }
        if (seekTime > duration) {
          console.warn(`Timestamp ${seekTime} exceeds duration ${duration}. Clamping to end.`);
          seekTime = duration - 0.1; // Clamp to just before end
        }
      }

      // 6. Extract Frame
      console.log(`Extracting frame at ${seekTime}s...`);
      await extractFrameParams(videoPath, seekTime, framePath, quality);

      // 7. Read Output
      const imageBuffer = await fsPromises.readFile(framePath);
      const base64Image = `data:image/${outputFormat};base64,${imageBuffer.toString("base64")}`;

      console.log("Frame extracted successfully.");

      return {
        nodeId,
        runId,
        output: base64Image,
        extractedAt: seekTime.toFixed(3),
        duration,
        success: true,
      };

    } catch (error) {
      console.error("Extraction task failed:", error);
      // Construct a safe error message
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      // If we want to return a 'failed' result object instead of throwing (so the workflow handles it gracefully):
      // return { nodeId, runId, output: "", extractedAt: "", duration: 0, success: false, error: errorMessage };
      // But typically Trigger.dev tasks throw to retry. 
      // User requested "Return structure... success: boolean". 
      // If we throw, the task fails. If we return success: false, the task succeeds but the result indicates failure.
      // I will return success: false to match requested structure and allow workflow logic to handle the "error node".
      return {
        nodeId,
        runId,
        output: "",
        extractedAt: "",
        duration: 0,
        success: false,
        error: errorMessage
      }

    } finally {
      // 8. Cleanup
      try {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
        console.log("Cleaned up temp files.");
      } catch (cleanupError) {
        console.error("Failed to cleanup temp files:", cleanupError);
      }
    }
  },
});

/**
 * Downloads a video from a URL to a local file stream.
 * Enforces size limits and timeouts.
 */
async function downloadVideo(url: string, destPath: string, maxBytes: number): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }

    // Basic Content-Length check if available
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > maxBytes) {
      throw new Error(`Video size (${contentLength} bytes) exceeds limit of ${maxBytes} bytes.`);
    }

    if (!response.body) throw new Error("No response body");

    // Prepare file stream
    const fileStream = fs.createWriteStream(destPath);

    // Custom stream reader to enforce strict byte limit during download
    const reader = response.body.getReader();
    let downloadedBytes = 0;

    // We can't use simple pipeline() if we want to count bytes manually for stream enforcement
    // But for Node 18+ fetch body is a ReadableStream. 
    // We can loop over chunks.

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        downloadedBytes += value.length;
        if (downloadedBytes > maxBytes) {
          // Abort early
          reader.cancel();
          throw new Error(`Download exceeded max size limit of ${maxBytes} bytes.`);
        }
        // Write chunk to file - handle backpressure if needed (for simple task, writing synchronously or waiting properly)
        // fileStream.write usually returns false if buffer is full. 
        // To be robust, we should wait for drain, but simple write is okay for small chunks if disk is fast.
        // Better: consume stream properly.

        // Converting Web Stream chunk (Ui8Array) to Buffer isn't strictly necessary for fs.write but safer
        const canWrite = fileStream.write(value);
        if (!canWrite) {
          await new Promise<void>((resolve) => fileStream.once('drain', () => resolve()));
        }
      }
    }

    fileStream.end();
    await new Promise<void>((resolve, reject) => {
      fileStream.on("finish", () => resolve());
      fileStream.on("error", reject);
    });

  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Gets video duration using ffprobe.
 * Uses spawn for safety.
 */
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!ffprobePath) {
      return reject(new Error("FFprobe binary not found"));
    }

    const args = [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath
    ];

    const child = spawn(ffprobePath as string, args, {
      timeout: FFPROBE_TIMEOUT_MS
    });

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => { output += data.toString(); });
    child.stderr.on("data", (data) => { errorOutput += data.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${errorOutput}`));
      } else {
        const duration = parseFloat(output.trim());
        if (isNaN(duration)) {
          reject(new Error(`Invalid duration output from ffprobe: ${output}`));
        } else {
          resolve(duration);
        }
      }
    });

    child.on("error", (err) => reject(err));
  });
}

/**
 * Extracts a frame at a specific timestamp using ffmpeg.
 */
function extractFrameParams(
  inputPath: string,
  seekTime: number,
  outputPath: string,
  quality: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      return reject(new Error("FFmpeg binary not found"));
    }

    // Arguments: 
    // -ss before -i for input seeking (fast)
    // -y to overwrite
    // -vframes 1 for single frame
    // -q:v control quality (2-31)
    const args = [
      "-ss", seekTime.toString(),
      "-i", inputPath,
      "-vframes", "1",
      "-q:v", quality.toString(),
      "-y",
      outputPath
    ];

    const child = spawn(ffmpegPath, args, {
      timeout: FFMPEG_TIMEOUT_MS
    });

    let errorOutput = "";
    child.stderr.on("data", (d) => errorOutput += d.toString());

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${errorOutput}`));
      } else {
        resolve();
      }
    });

    child.on("error", (err) => reject(err));
  });
}
