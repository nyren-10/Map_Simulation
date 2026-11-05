const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '../static/app.js'), 'utf8');

// Extract polygonCentroid, scalePolygonGeometry, geoJsonToLatLngs, updateFloods
const context = vm.createContext({
    Array, Math,
    result: null,
    duration: 10,
    time: 0,
    playing: false,
    state: {
        floods: [
            {
                id: 'flood-1',
                depth: 40,
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[73.716, 24.584], [73.716, 24.587], [73.718, 24.587], [73.716, 24.584]]]
                }
            }
        ]
    },
    editable: {
        layers: [],
        eachLayer(fn) { this.layers.forEach(fn); }
    }
});

// Mock Leaflet layer for flood
let currentLatLngs = null;
const mockFloodLayer = {
    kind: 'flood',
    zoneId: 'flood-1',
    setLatLngs(latlngs) {
        currentLatLngs = latlngs;
    }
};
context.editable.layers.push(mockFloodLayer);

// Extract helper functions
const fnStart = source.indexOf('function polygonCentroid(');
const fnEnd = source.indexOf("map.on('click'");
const helpersCode = source.slice(fnStart, fnEnd);

vm.runInContext(helpersCode, context);

const { polygonCentroid, scalePolygonGeometry, geoJsonToLatLngs, updateFloods } = context;

// 1. Centroid calculation
const ring = [[[73.716, 24.584], [73.716, 24.587], [73.718, 24.587], [73.716, 24.584]]][0];
const centroid = polygonCentroid(ring);
assert(Math.abs(centroid[0] - 73.71667) < 0.001);
assert(Math.abs(centroid[1] - 24.586) < 0.001);

// 2. Scale factor = 1 does not alter geometry
const baseGeom = context.state.floods[0].geometry;
const unscaled = scalePolygonGeometry(baseGeom, 1);
assert.deepEqual(unscaled, baseGeom);

// 3. Scale factor > 1 expands outward around centroid
const scaled = scalePolygonGeometry(baseGeom, 2);
assert.notDeepEqual(scaled, baseGeom);
// Original geometry was not mutated
assert.equal(baseGeom.coordinates[0][0][0], 73.716);

// 4. When simulation is not started (result is null), updateFloods keeps base size
context.result = null;
context.time = 0;
context.updateFloods();
const baseLatLngs = geoJsonToLatLngs(baseGeom);
assert.deepEqual(currentLatLngs, baseLatLngs);

// 5. When simulation starts and advances, flood area expands dynamically
context.result = { routes: [{ arrival_min: 10 }] };
context.duration = 10;
context.time = 5; // 50% into simulation
context.updateFloods();
const halfProgressLatLngs = currentLatLngs;
assert.notDeepEqual(halfProgressLatLngs, baseLatLngs);

// At full progress (time = 10)
context.time = 10;
context.updateFloods();
const fullProgressLatLngs = currentLatLngs;
assert.notDeepEqual(fullProgressLatLngs, halfProgressLatLngs);

// 6. When simulation is paused at time = 5:
context.playing = false;
context.time = 5;
context.updateFloods();
const pausedLatLngs = currentLatLngs;
assert.deepEqual(pausedLatLngs, halfProgressLatLngs);
// Calling updateFloods again without advancing time keeps it static
context.updateFloods();
assert.deepEqual(currentLatLngs, pausedLatLngs);

// 7. When restarting simulation (time = 0)
context.time = 0;
context.updateFloods();
assert.deepEqual(currentLatLngs, baseLatLngs);

console.log('Dynamic flood passed: centroid, scaling, immutability, playback expansion, pause static state, and reset.');

