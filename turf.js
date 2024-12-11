// This file copies over the required functionality from @turf/turf to avoid
// having to install the entire @turf/turf package.

// Constants
const earthRadius = 6371008.8;

const factors = {
    kilometers: earthRadius / 1000,
    metres: earthRadius,
    degrees: earthRadius / 111325,
};

// Helper Functions
function degreesToRadians(degrees) {
    const radians = degrees % 360;
    return (radians * Math.PI) / 180;
}

function radiansToLength(radians, units = 'kilometers') {
    const factor = factors[units];
    if (!factor) {
        throw new Error(units + ' units is invalid');
    }
    return radians * factor;
}

function getCoord(coord) {
    if (!coord) {
        throw new Error('coord is required');
    }
    if (!Array.isArray(coord)) {
        if (
            coord.type === 'Feature' &&
            coord.geometry !== null &&
            coord.geometry.type === 'Point'
        ) {
            return coord.geometry.coordinates;
        }
        if (coord.type === 'Point') {
            return coord.coordinates;
        }
    }
    if (
        Array.isArray(coord) &&
        coord.length >= 2 &&
        !Array.isArray(coord[0]) &&
        !Array.isArray(coord[1])
    ) {
        return coord;
    }
    throw new Error('coord must be GeoJSON Point or an Array of numbers');
}

function feature(geom, properties = {}) {
    return {
        type: 'Feature',
        properties,
        geometry: geom,
    };
}

// Main Functions
function point(coordinates, properties = {}) {
    if (!coordinates) {
        throw new Error('coordinates is required');
    }
    if (!Array.isArray(coordinates)) {
        throw new Error('coordinates must be an Array');
    }
    return feature(
        {
            type: 'Point',
            coordinates: coordinates,
        },
        properties
    );
}

function distance(from, to, options = {}) {
    const coordinates1 = getCoord(from);
    const coordinates2 = getCoord(to);
    const dLat = degreesToRadians(coordinates2[1] - coordinates1[1]);
    const dLon = degreesToRadians(coordinates2[0] - coordinates1[0]);
    const lat1 = degreesToRadians(coordinates1[1]);
    const lat2 = degreesToRadians(coordinates2[1]);
    const a =
        Math.pow(Math.sin(dLat / 2), 2) +
        Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
    return radiansToLength(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)), options.units);
}

function pointToLineDistance(pt, line, options = {}) {
    // Optional parameters
    options.method = options.method || 'geodesic';
    options.units = options.units || 'kilometers';

    // Convert inputs to features
    const point = Array.isArray(pt) ? feature({ type: 'Point', coordinates: pt }) : pt;
    const lineFeature = Array.isArray(line)
        ? feature({ type: 'LineString', coordinates: line })
        : line;

    let minDistance = Infinity;
    const p = point.geometry.coordinates;

    // Check each segment of the line
    for (let i = 0; i < lineFeature.geometry.coordinates.length - 1; i++) {
        const a = lineFeature.geometry.coordinates[i];
        const b = lineFeature.geometry.coordinates[i + 1];
        const d = distanceToSegment(p, a, b);
        if (d < minDistance) {
            minDistance = d;
        }
    }

    return minDistance;
}

function distanceToSegment(p, a, b) {
    const v = [b[0] - a[0], b[1] - a[1]];
    const w = [p[0] - a[0], p[1] - a[1]];
    const c1 = dot(w, v);

    if (c1 <= 0) return distance(p, a);

    const c2 = dot(v, v);
    if (c2 <= c1) return distance(p, b);

    const b2 = c1 / c2;
    const Pb = [a[0] + b2 * v[0], a[1] + b2 * v[1]];
    return distance(p, Pb);
}

function dot(u, v) {
    return u[0] * v[0] + u[1] * v[1];
}

function booleanPointInPolygon(point, polygon) {
    const pt = getCoord(point);
    const polys = polygon.geometry.coordinates;

    // Quick check for point outside polygon bbox
    let inside = false;

    for (let i = 0, len = polys.length; i < len; i++) {
        const ring = polys[i];
        if (inRing(pt, ring)) {
            inside = !inside;
        }
    }

    return inside;
}

function inRing(pt, ring) {
    let inside = false;
    const x = pt[0];
    const y = pt[1];

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];

        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }

    return inside;
}

module.exports = {
    point,
    pointToLineDistance,
    booleanPointInPolygon,
};
