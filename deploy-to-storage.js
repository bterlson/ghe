const utils = require('./dist/shared/utils');
const fs = require('fs');

async function main() {
    const client = await utils.getContainerClient('$web');
    const html = fs.readFileSync("./client/ghe.html", "utf8");
    const js = fs.readFileSync("./dist/index.js", "utf8");
    await client.uploadBlockBlob('ghe.html', html, html.length, {
        blobHTTPHeaders: {
            blobContentType: 'text/html'
        }
    });
    await client.uploadBlockBlob("index.js", js, js.length, {
      blobHTTPHeaders: {
        blobContentType: "application/javascript"
      }
    });
}

main();