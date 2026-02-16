import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
    url: string;
    publicId: string;
    format: string;
    width?: number;
    height?: number;
    duration?: number;
}

/**
 * Upload a file buffer to Cloudinary
 */
export async function uploadToCloudinary(
    buffer: Buffer,
    options: {
        folder?: string;
        resourceType?: 'image' | 'video' | 'raw' | 'auto';
        transformation?: Record<string, unknown>;
    } = {}
): Promise<UploadResult> {
    const { folder = 'weavy', resourceType = 'auto' } = options;

    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: resourceType,
            },
            (error, result) => {
                if (error || !result) {
                    reject(error || new Error('Upload failed'));
                    return;
                }
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                    format: result.format,
                    width: result.width,
                    height: result.height,
                    duration: result.duration,
                });
            }
        ).end(buffer);
    });
}

/**
 * Upload from URL to Cloudinary
 */
export async function uploadFromUrl(
    url: string,
    options: {
        folder?: string;
        resourceType?: 'image' | 'video' | 'raw' | 'auto';
    } = {}
): Promise<UploadResult> {
    const { folder = 'weavy', resourceType = 'auto' } = options;

    const result = await cloudinary.uploader.upload(url, {
        folder,
        resource_type: resourceType,
    });

    return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        duration: result.duration,
    };
}

/**
 * Crop an image using Cloudinary transformations
 */
export function getCroppedImageUrl(
    publicId: string,
    xPercent: number,
    yPercent: number,
    widthPercent: number,
    heightPercent: number
): string {
    return cloudinary.url(publicId, {
        transformation: [
            {
                crop: 'crop',
                x: `${xPercent / 100}`,
                y: `${yPercent / 100}`,
                width: `${widthPercent / 100}`,
                height: `${heightPercent / 100}`,
                flags: 'relative',
            },
        ],
    });
}

/**
 * Extract a frame from a video using Cloudinary
 */
export function getVideoFrameUrl(
    publicId: string,
    timestamp: string
): string {
    // Parse timestamp
    let startOffset: string;
    if (timestamp.endsWith('%')) {
        const percent = parseFloat(timestamp);
        startOffset = `${percent}p`;
    } else {
        startOffset = `${parseFloat(timestamp)}`;
    }

    return cloudinary.url(publicId.replace('.mp4', '.jpg').replace('.mov', '.jpg'), {
        resource_type: 'video',
        transformation: [
            {
                start_offset: startOffset,
                format: 'jpg',
            },
        ],
    });
}

/**
 * Delete a resource from Cloudinary
 */
export async function deleteFromCloudinary(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<void> {
    await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
    });
}

export default cloudinary;
