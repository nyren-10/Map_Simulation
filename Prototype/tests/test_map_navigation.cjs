// Exercise the production navigation function with scenario/map spies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../static/app.js'), 'utf8');
const fn = source.slice(source.indexOf('function navigateTo('), source.indexOf("$('searchForm').onsubmit"));
const elements = {searchResults: {replaceChildren() {}}, searchStatus: {textContent: ''}};
let resets = 0, scenario = false, consent = false, view;
const marker = {bindTooltip() {return this;}, addTo() {return this;}};
const map = {stop() {return this;}, setView(point, zoom) {view = {point, zoom};}, removeLayer() {}};
const context = vm.createContext({busy: false, searchMarker: null, map,
    Number, Math, L: {circleMarker() {return marker;}},
    $: id => elements[id], esc: x => x, status() {},
    hasScenario: () => scenario, confirm: () => consent,
    resetScenario() {resets++; scenario = false;}});
vm.runInContext(fn, context);
const go = context.navigateTo;
assert.equal(go(24.5179096, 73.7518783, 'Campus', 18), true);
assert.equal(view.zoom, 18);
assert.equal(view.point[0], 24.5179096);
assert.equal(context.searchMarker, marker);
scenario = true;
const before = resets;
assert.equal(go(9.49, 76.33, 'Other place', 15), false);
assert.equal(resets, before);
assert.equal(view.zoom, 18);
consent = true;
assert.equal(go(9.49, 76.33, 'Other place', 15), true);
assert.equal(resets, before + 1);
assert.equal(view.zoom, 15);
go(24.58, 73.71, 'Missing metadata');
assert.equal(view.zoom, 17);
go(24.58, 73.71, 'Malformed zoom', NaN);
assert.equal(view.zoom, 17);
assert.equal(go(NaN, 73.71, 'Invalid'), false);
context.busy = true;
assert.equal(go(24.58, 73.71, 'Busy'), false);
console.log('Navigation passed: close zoom, marker, cancel/confirm, missing metadata, invalid input, busy state.');
