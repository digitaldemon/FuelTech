import { put } from '@vercel/blob';
import { readFileSync } from 'fs';

const TOKEN = 'vercel_blob_rw_wdmydLxKB6x834DC_PcALDGSIETJujmUVuvuIX4I9ho9U3m';
const FILE  = 'C:/Users/Billy/TLSConnect/dist/FuelTech AI Console Connect Setup 1.0.50.exe';
const NAME  = 'updates/console/FuelTech AI Console Connect Setup 1.0.50.exe';

console.log('Reading installer...');
const data = readFileSync(FILE);
console.log(`File size: ${data.length} bytes`);

console.log('Uploading to Vercel Blob...');
const result = await put(NAME, data, {
  access: 'public',
  token: TOKEN,
  contentType: 'application/octet-stream',
  addRandomSuffix: false,
  allowOverwrite: true,
});

console.log('\nUpload complete!');
console.log('URL:', result.url);
