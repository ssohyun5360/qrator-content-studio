import {copyFileSync} from 'node:fs';
copyFileSync('node_modules/jszip/dist/jszip.min.js','public/vendor/jszip.min.js');
console.log('Static assets ready. API runs on Vercel.');
