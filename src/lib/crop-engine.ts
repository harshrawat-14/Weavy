/**
 * Client-side image cropping using Canvas API.
 * No server round-trip — operates on cached base64 images.
 */

export interface CropParams {
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
}

export interface AspectRatio {
    label: string;
    value: string;
    ratio: number | null; // null = free
}

export const ASPECT_RATIOS: AspectRatio[] = [
    { label: 'Free', value: 'free', ratio: null },
    { label: '1:1', value: '1:1', ratio: 1 },
    { label: '4:3', value: '4:3', ratio: 4 / 3 },
    { label: '16:9', value: '16:9', ratio: 16 / 9 },
    { label: '3:4', value: '3:4', ratio: 3 / 4 },
    { label: '9:16', value: '9:16', ratio: 9 / 16 },
];

/**
 * Crop an image client-side using Canvas API.
 * Accepts a data URL or HTTP URL, returns a cropped data URL.
 */
export async function cropImageClient(
    imageSource: string,
    params: CropParams
): Promise<string> {
    const img = await loadImage(imageSource);
    const { xPercent, yPercent, widthPercent, heightPercent } = params;

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    // Convert percentages to pixels
    let left = Math.round((xPercent / 100) * imgW);
    let top = Math.round((yPercent / 100) * imgH);
    let cropW = Math.round((widthPercent / 100) * imgW);
    let cropH = Math.round((heightPercent / 100) * imgH);

    // Clamp offsets
    left = Math.min(left, Math.max(imgW - 1, 0));
    top = Math.min(top, Math.max(imgH - 1, 0));

    // Clamp dimensions
    cropW = Math.min(cropW, imgW - left);
    cropH = Math.min(cropH, imgH - top);
    cropW = Math.max(cropW, 1);
    cropH = Math.max(cropH, 1);

    // Draw to canvas
    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    ctx.drawImage(img, left, top, cropW, cropH, 0, 0, cropW, cropH);

    return canvas.toDataURL('image/png');
}

/**
 * Adjust crop dimensions to maintain a locked aspect ratio.
 * When width changes → adjust height. When height changes → adjust width.
 */
export function enforceAspectRatio(
    params: CropParams,
    ratio: number,
    changed: 'width' | 'height'
): CropParams {
    if (changed === 'width') {
        return { ...params, heightPercent: Math.min(100, params.widthPercent / ratio) };
    } else {
        return { ...params, widthPercent: Math.min(100, params.heightPercent * ratio) };
    }
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
        img.src = src;
    });
}
