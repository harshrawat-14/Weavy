import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadToCloudinary } from '@/lib/cloudinary';

// Configuration constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DATA_URL_LIMIT = 5 * 1024 * 1024; // 5MB - use data URL below this threshold

// POST /api/upload - Handle file uploads
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as string;

        if (file) {
            console.log(`[API/Upload] Received ${type} upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        }

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/avi'];

        if (type === 'image' && !allowedImageTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' }, { status: 400 });
        }

        if (type === 'video' && !allowedVideoTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid video type. Allowed: MP4, MOV, WebM, AVI' }, { status: 400 });
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Determine upload strategy based on file size and Cloudinary availability
        const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET;

        // For small files or when Cloudinary is not configured, use data URL
        if (!useCloudinary || buffer.length <= DATA_URL_LIMIT) {
            const base64 = buffer.toString('base64');
            const dataUrl = `data:${file.type};base64,${base64}`;

            console.log(`[API/Upload] Success (Local Data URL): encoded ${base64.length} chars`);

            return NextResponse.json({
                url: dataUrl,
                fileName: file.name,
                type: file.type,
                size: file.size,
                storage: 'local',
            });
        }

        // Upload to Cloudinary for larger files
        try {
            const result = await uploadToCloudinary(buffer, {
                folder: `weavy/uploads/${userId}`,
                resourceType: type === 'video' ? 'video' : 'image',
            });


            console.log(`[API/Upload] Success (Cloudinary): ${result.url}`);

            return NextResponse.json({
                url: result.url,
                publicId: result.publicId,
                fileName: file.name,
                type: file.type,
                size: file.size,
                width: result.width,
                height: result.height,
                duration: result.duration,
                storage: 'cloudinary',
            });
        } catch (cloudinaryError) {
            console.error('Cloudinary upload failed:', cloudinaryError);
            console.warn(`[API/Upload] Cloudinary failed, attempting local fallback`);

            // Fallback to data URL if Cloudinary fails and file is small enough
            if (buffer.length <= DATA_URL_LIMIT) {
                const base64 = buffer.toString('base64');
                const dataUrl = `data:${file.type};base64,${base64}`;

                return NextResponse.json({
                    url: dataUrl,
                    fileName: file.name,
                    type: file.type,
                    size: file.size,
                    storage: 'local',
                });
            }

            return NextResponse.json(
                { error: 'Upload failed. Please try a smaller file or check your configuration.' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Upload failed:', error);
        return NextResponse.json(
            { error: 'Upload failed' },
            { status: 500 }
        );
    }
}
