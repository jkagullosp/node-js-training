const fs = require('fs/promises');
const path = require('path');

async function readFileInfo() {
    // 1. Read filename from process.argv
    // process.argv[0] is 'node', process.argv[1] is the script path
    const filename = process.argv[2];

    // 2. Check if filename is provided
    if (!filename) {
        console.log('Usage: node file-reader.js <filename>');
        process.exit(1); // Exit with a failure code
    }

    try {
        // 3. Use fs/promises to read file and get stats
        // We run these in parallel because they don't depend on each other!
        const [content, stats] = await Promise.all([
            fs.readFile(filename, 'utf8'),
            fs.stat(filename)
        ]);

        // 4. Print results
        console.log(`--- File: ${filename} ---`);
        console.log('Contents:');
        console.log(content);
        
        console.log('---------------------------');
        
        // 5. File size in bytes
        console.log(`Size: ${stats.size} bytes`);

        // 6. Number of lines
        // .trim() removes trailing newlines so we don't count an empty last line
        const lines = content.trim().split('\n').length;
        console.log(`Lines: ${lines}`);

    } catch (error) {
        // 7. Friendly error handling
        if (error.code === 'ENOENT') {
            console.error(`Error: The file "${filename}" does not exist.`);
        } else {
            console.error('An unexpected error occurred:', error.message);
        }
    }
}

readFileInfo();