const fs = require('fs/promises');
const path = require('path');

async function main() {
    try {
        const filePath = path.join(__dirname, 'sample.txt');
        const content = await fs.readFile(filePath, 'utf-8');
        console.log('File contents: ');
        console.log(content);
    } catch (error) {
        console.error('Error reading file: ', error.message);
    }
}

main();