import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma client
const prisma = new PrismaClient();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Type for Cloudinary upload response
interface CloudinaryUploadResult {
  public_id: string;
  bytes: number;
  duration: number;
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  try {
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized user" }, { status: 401 });
    }

    if (
      !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        { error: "Cloudinary credentials not found" },
        { status: 500 }
      );
    }

    // 🔄 Step 1: Parse form data
    console.time("FormData Parsing");
    const formData = await request.formData();
    console.timeEnd("FormData Parsing");

    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const originalSize = formData.get("originalSize") as string;

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 400 });
    }

    // 🔄 Step 2: Convert to buffer
    console.time("Buffer Creation");
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.timeEnd("Buffer Creation");

    // 🔄 Step 3: Upload to Cloudinary
    console.time("Cloudinary Upload");
    const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "video-upload-cloudinary-saas",
          eager: [
            {
              quality: "auto",
              fetch_format: "mp4",
            },
          ], eager_async: true
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result as CloudinaryUploadResult);
          }
        }
      );

      uploadStream.end(buffer);
    });
    console.timeEnd("Cloudinary Upload");

    // 🔄 Step 4: Save to DB
    console.time("Database Insert");
    const video = await prisma.video.create({
      data: {
        title,
        description,
        publicId: result.public_id,
        originalSize: Number(originalSize), // Convert to number
        compressedSize: String(result.bytes),
        duration: result.duration || 0,
      },
    });
    console.timeEnd("Database Insert");

    // ✅ Success
    return NextResponse.json(video);
  } catch (error) {
    console.error("Upload video failed:", error);
    return NextResponse.json({ error: "Upload video failed" }, { status: 500 });
  } finally {
    // ✅ Clean disconnect (only in dev)
    if (process.env.NODE_ENV === "development") {
      await prisma.$disconnect();
    }
  }
}
