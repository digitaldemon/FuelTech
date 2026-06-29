// GET /api/download
// Reads latest.yml from the Vercel Blob update feed and redirects to the current .exe installer.

export const runtime = 'edge';

const LATEST_YML = 'https://www.fueltechaipro.com/updates/console/latest.yml';

// Fallback in case latest.yml is unreachable
const FALLBACK_URL = 'https://wdmydlxkb6x834dc.public.blob.vercel-storage.com/updates/console/FuelTech%20AI%20Console%20Connect%20Setup%201.0.53.exe';

export async function GET() {
  try {
    const res = await fetch(LATEST_YML, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`latest.yml fetch ${res.status}`);

    const text = await res.text();
    // The "path:" line in latest.yml contains the full download URL
    const match = text.match(/^path:\s*(.+)$/m);
    if (!match) throw new Error('No path field in latest.yml');

    const url = match[1].trim();
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('Malformed URL in latest.yml'); }
    const host = parsed.hostname;
    if (
      !parsed.protocol.startsWith('https') ||
      (!host.endsWith('.vercel-storage.com') &&
       !host.endsWith('.public.blob.vercel-storage.com') &&
       !host.endsWith('.vercel-blob.com'))
    ) {
      throw new Error('Untrusted redirect URL in latest.yml');
    }
    return Response.redirect(url, 302);
  } catch {
    return Response.redirect(FALLBACK_URL, 302);
  }
}
