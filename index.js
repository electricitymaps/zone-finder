#!/usr/bin/env node

const fs = require('fs');
const { loadGeometryFeatures, getNearestZone, reverseGeocode } = require('./utils');

async function main() {
    const fileContent = fs.readFileSync('data.csv', 'utf-8');
    const lines = fileContent.trim().split('\n');
    const header = lines[0];
    const rows = lines.slice(1);

    const results = [header];
    for (const row of rows) {
        const [lon, lat] = row.split(',');

        const zone = await reverseGeocode(parseFloat(lon), parseFloat(lat));
        results.push(`${lon},${lat},${zone}`);
    }

    fs.writeFileSync('data.csv', results.join('\n') + '\n');

    console.log(`Processed ${rows.length} coordinates`);
}

main().catch(console.error);
