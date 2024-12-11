const fs = require('fs');
const path = require('path');
const turf = require('./turf');

const GEO_GENERATED_FILE_PATH = path.resolve(__dirname, 'geo.generated.json');

/**
 * Loads the geometry features from disk for reverse geocoding.
 *
 * @returns {Promise<{ convexhulls: Array[Any], zoneToGeometryFeatures: Object, zoneToLines: Object}>}
 */
async function loadGeometryFeatures() {
    if (!_geoFeaturePromise) {
        // NOTE we do this async as the file is huge and will block the main thread
        // for several seconds.
        const tStart = new Date().getTime();
        _geoFeaturePromise = new Promise((resolve, reject) => {
            fs.readFile(GEO_GENERATED_FILE_PATH, (err, data) => {
                if (err) {
                    console.error(
                        `Error loading geo features, please run "yarn generate-geo-file": ${err}`
                    );
                    return reject(err);
                }

                const parsed = JSON.parse(data);
                resolve(parsed);
            });
        });
    }

    return _geoFeaturePromise;
}

/**
 * @returns {{zoneName: string, distance: number} | null}>}
 */
function getNearestZone({ potentialZones, zoneToLines, targetPoint }) {
    let result = null;

    potentialZones.forEach((zoneKey) => {
        const lines = zoneToLines[zoneKey];

        lines.forEach((line) => {
            const distance = turf.pointToLineDistance(targetPoint, line);

            const currentResult = {
                zoneName: zoneKey,
                distance,
            };

            if (!result || currentResult.distance < result.distance) {
                result = currentResult;
            }
        });
    });

    return result;
}

let _geoFeaturePromise = null;

async function reverseGeocode(lon, lat) {
    const tStart = new Date().getTime();

    const { convexhulls, zoneToGeometryFeatures, zoneToLines } = await loadGeometryFeatures();

    const targetPoint = turf.point([lon, lat]);

    // First fast pass using the convex hulls for speed
    const initialFilteringZones = new Set(
        convexhulls
            .filter((feature) => turf.booleanPointInPolygon(targetPoint, feature))
            .map((feature) => feature.properties.zoneName)

            // Second pass using the polygons themselves for a more
            // precise lookup. Note that as the geometries are simplified we might miss the target here
            .filter((zoneKey) =>
                zoneToGeometryFeatures[zoneKey].some((poly) =>
                    turf.booleanPointInPolygon(targetPoint, poly)
                )
            )
    );

    let hit = initialFilteringZones.size == 1 ? [...initialFilteringZones][0] : undefined;

    // In case we didn't get one exact hit from the convex hulls and geometries, we find the nearest zone.
    if (!hit) {
        const potentialZones =
            initialFilteringZones.size == 0 ? Object.keys(zoneToLines) : [...initialFilteringZones];

        const result = getNearestZone({ potentialZones, zoneToLines, targetPoint });
        if (result && result.distance < MAX_NEAREST_ZONE_DISTANCE_KM) {
            hit = result.zoneName;
        }
    }

    return hit;
}

module.exports = { loadGeometryFeatures, getNearestZone, reverseGeocode };
