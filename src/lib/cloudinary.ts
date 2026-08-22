/**
 * Cloudinary Client-Side Upload Utility for LocalEats Menu Items
 * Uses unsigned direct browser uploads with the configured preset.
 */

const CLOUDINARY_CLOUD_NAME = "qar6mljr";
const CLOUDINARY_UPLOAD_PRESET = "menu_items_unsigned";
const CLOUDINARY_UPLOAD_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const CLOUDINARY_FOLDER = "menu-items";

/**
 * Uploads an image file to Cloudinary using an unsigned upload preset.
 * @param file The image file selected by the vendor.
 * @returns The secure HTTPS URL of the uploaded image.
 */
export async function uploadImageToCloudinary(file: File): Promise<string> {
  if (!file) {
    throw new Error("No image file provided for upload.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_FOLDER);

  try {
    const response = await fetch(CLOUDINARY_UPLOAD_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const serverMessage = data?.error?.message || response.statusText || "Upload failed";
      throw new Error(`Cloudinary upload failed: ${serverMessage}`);
    }

    if (!data.secure_url) {
      throw new Error("Cloudinary response did not contain a secure image URL.");
    }

    return data.secure_url as string;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unexpected network error occurred while uploading the image to Cloudinary.");
  }
}

/**
 * Applies responsive image optimization transformations to Cloudinary URLs.
 * Leaves non-Cloudinary and Firebase Storage URLs intact.
 * @param url The image URL to transform.
 * @returns The optimized URL if Cloudinary, otherwise the original URL.
 */
export function getOptimizedCloudinaryUrl(url?: string): string {
  if (!url || typeof url !== "string") return "";

  // Only transform Cloudinary URLs containing /upload/ and avoid double-transforming
  if (url.includes("cloudinary.com") && url.includes("/upload/")) {
    if (!url.includes("/upload/w_") && !url.includes("/upload/q_") && !url.includes("/upload/f_")) {
      return url.replace("/upload/", "/upload/w_400,q_auto,f_auto/");
    }
  }

  return url;
}
