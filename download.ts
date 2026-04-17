import fs from 'fs';
import https from 'https';

const url = 'https://i.imgur.com/iLEmYXC.png';
const file = fs.createWriteStream('./public/logo.png');

https.get(url, (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download Completed');
  });
}).on('error', (err) => {
  fs.unlink('./public/logo.png', () => {});
  console.error('Error downloading:', err.message);
});