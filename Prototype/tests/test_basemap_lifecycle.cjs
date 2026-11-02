const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const select = {value: 'streets'};
const element = () => ({style: {}, setAttribute() {}, append() {}});
const layers = new Set(), tiles = [];
let resize, nextFrame = 0, invalidations = 0;
const frames = new Map();
const map = {
    createPane() {return element();}, getPane() {return element();},
    removeLayer(layer) {layers.delete(layer);}, getContainer() {return {};},
    invalidateSize(options) {assert.equal(options.pan, false); invalidations++;}, on() {}
};
const control = () => ({addTo() {this.onAdd?.();}});
control.scale = control;
const context = {
    window: {}, document: {getElementById: () => select, createElement: element},
    L: {control, DomUtil: {create: element}, DomEvent: {disableClickPropagation() {}, disableScrollPropagation() {}},
        tileLayer(url, options) {
            const layer = {url, options, handlers: {},
                on(event, fn) {this.handlers[event] = fn;}, off() {this.handlers = {};},
                setOpacity(value) {this.opacity = value; return this;},
                setZIndex(value) {this.zIndex = value; return this;},
                addTo() {layers.add(this); return this;}};
            tiles.push(layer); return layer;
        }},
    ResizeObserver: class {constructor(fn) {resize = fn;} observe() {} disconnect() {}},
    requestAnimationFrame(fn) {frames.set(++nextFrame, fn); return nextFrame;},
    cancelAnimationFrame(id) {frames.delete(id);}, setTimeout, clearTimeout
};
context.window.ResizeObserver = context.ResizeObserver;
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../static/basemap.js'), 'utf8'), context);
context.window.FloodsafeBasemap.attach(map);
assert.equal(layers.size, 1);
const street = tiles[0];
street.handlers.tileload(); street.handlers.load();
for (const tile of tiles) {
    assert.equal(tile.options.updateWhenZooming, false);
    assert.equal(tile.options.minZoom, 3);
    assert.equal(tile.options.maxZoom, 19);
}
resize([{contentRect: {width: 900, height: 700}}]);
resize([{contentRect: {width: 900, height: 700}}]);
assert.equal(frames.size, 1);
for (const fn of frames.values()) fn();
assert.equal(invalidations, 1);
// Basemap changes must never touch independent scenario geometry.
const scenario = {};
layers.add(scenario);
select.value = 'satellite'; select.onchange();
assert.equal(layers.size, 3);
const satellite = tiles.at(-2);
assert(layers.has(street), 'Keep previous view during loading');
for (let i = 0; i < 3; i++) satellite.handlers.tileerror();
satellite.handlers.load();
assert.equal(select.value, 'satellite', 'Never silently change requested view');
assert(layers.has(street), 'Keep previous view on failed load');
select.value = 'streets'; select.onchange();
assert(!layers.has(satellite), 'Cancel obsolete candidate');
satellite.handlers.tileload(); satellite.handlers.load();
assert(!layers.has(satellite), 'Ignore late callbacks');
select.value = 'satellite'; select.onchange();
const newSatellite = tiles.at(-2);
newSatellite.handlers.tileload(); newSatellite.handlers.load();
assert(!layers.has(street), 'Replace old view only after successful load');
assert.equal(newSatellite.opacity, 1);
assert(layers.has(scenario));
assert.equal(layers.size, 3);
console.log('Basemap passed: resize deduplication, transactional switching, failed loads, late callbacks, labels and scenario preservation.');
