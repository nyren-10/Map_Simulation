const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const select = {value: 'satellite'};
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
assert.equal(layers.size, 2);
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
select.value = 'streets'; select.onchange();
assert.equal(layers.size, 2);
assert(layers.has(scenario));
select.value = 'satellite'; select.onchange();
assert.equal(layers.size, 3);
const satellite = tiles.at(-2);
for (let i = 0; i < 3; i++) satellite.handlers.tileerror();
assert.equal(select.value, 'streets');
assert(layers.has(scenario));
assert.equal(layers.size, 2);
console.log('Basemap passed: resize deduplication, settled tile updates, zoom limits, scenario preservation and failure fallback.');
