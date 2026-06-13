import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const maxDuration = 60;

// Handles two phases of the Vercel Blob client-upload flow:
// 1. "blob.generate-client-token" — validates admin secret from clientPayload, returns signed token
// 2. "blob.upload-completed"      — no-op; processing is triggered by the client via /api/upload/process
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let secret = "";
        try {
          ({ secret } = JSON.parse(clientPayload ?? "{}"));
        } catch { /* ignore bad payload */ }
        if (!secret || secret !== process.env.ADMIN_SECRET) {
          throw new Error("Unauthorized");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 150 * 1024 * 1024,
          tokenPayload: clientPayload ?? "{}",
        };
      },
      onUploadCompleted: async () => {
        // Client calls /api/upload/process explicitly after upload
      },
    });
    return Response.json(jsonResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload error";
    return Response.json(
      { error: msg },
      { status: msg === "Unauthorized" ? 401 : 400 }
    );
  }
}
