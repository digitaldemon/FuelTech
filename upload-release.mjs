import { put } from '@vercel/blob';
import { readFileSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';

const token = process.env.BLOB_READ_WRITE_TOKEN;
const filePath = process.argv[2];

if (!filePath) { console.error('Usage: node upload-release.mjs <path-to-exe>'); process.exit(1); }

const data   = readFileSync(filePath);
const size   = statSync(filePath).size;
const sha512 = createHash('sha512').update(data).digest('base64');
const name   = filePath.replace(/\\/g, '/').split('/').pop();

console.log(`Uploading ${name} (${(size/1024/1024).toFixed(1)} MB)…`);

const blob = await put(`updates/console/${name}`, data, {
  access: 'public',
  contentType: 'application/octet-stream',
  token,
});

console.log('URL:', blob.url);
console.log('sha512:', sha512);
console.log('size:', size);

writeFileSync('upload-result.json', JSON.stringify({ url: blob.url, sha512, size }, null, 2));
