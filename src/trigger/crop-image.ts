import { task } from "@trigger.dev/sdk/v3";

interface CropImagePayload {
    imageUrl: string;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
    nodeId: string;
    runId: string;
}

export const cropImageTask = task({
    id: "crop-image",
    maxDuration: 60,
    run: async (payload: CropImagePayload) => {
        const { imageUrl, xPercent, yPercent, widthPercent, heightPercent, nodeId, runId } = payload;

        // In production, this would use FFmpeg to crop the image
        // FFmpeg command example:
        // ffmpeg -i input.jpg -vf "crop=iw*0.5:ih*0.5:iw*0.25:ih*0.25" output.jpg

        // For now, we'll simulate the crop operation
        // In a real implementation, you would:
        // 1. Download the image
        // 2. Use sharp or FFmpeg to crop
        // 3. Upload to cloud storage
        // 4. Return the new URL

        // Simulated processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // In production, this would be the actual cropped image URL
        // For demo, we return a placeholder
        const croppedUrl = imageUrl.startsWith('data:')
            ? imageUrl // Keep data URLs as-is for demo
            : `https://picsum.photos/seed/${nodeId}/400/300`; // Placeholder for URLs

        return {
            nodeId,
            runId,
            output: croppedUrl,
            cropParams: {
                xPercent,
                yPercent,
                widthPercent,
                heightPercent,
            },
            success: true,
        };
    },
});

// Real FFmpeg implementation would look like this:
/*
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

async function cropWithFFmpeg(
  imageUrl: string,
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  heightPercent: number
): Promise<string> {
  const tempDir = '/tmp';
  const inputPath = path.join(tempDir, `input_${uuidv4()}.jpg`);
  const outputPath = path.join(tempDir, `output_${uuidv4()}.jpg`);

  // Download image
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(inputPath, Buffer.from(buffer));

  // Build FFmpeg crop filter
  // crop=out_w:out_h:x:y where values are in pixels or expressions
  const cropFilter = `crop=iw*${widthPercent/100}:ih*${heightPercent/100}:iw*${xPercent/100}:ih*${yPercent/100}`;

  // Run FFmpeg
  execSync(`ffmpeg -i ${inputPath} -vf "${cropFilter}" ${outputPath}`);

  // Read output and convert to base64 or upload to cloud storage
  const outputBuffer = fs.readFileSync(outputPath);
  const base64 = outputBuffer.toString('base64');

  // Cleanup
  fs.unlinkSync(inputPath);
  fs.unlinkSync(outputPath);

  return `data:image/jpeg;base64,${base64}`;
}
*/
