'use strict';
window.FloodsafeBasemap = {
    attach(map) {
        const select = document.getElementById('mapStyle');
        const control = L.control({position: 'topright'});
        let panel, message, retry, active = null, pending = null, timer;
        map.createPane('basemapLabels').style.zIndex = 250;
        map.getPane('basemapLabels').style.pointerEvents = 'none';
        control.onAdd = () => {
            panel = L.DomUtil.create('div', 'basemap-status');
            panel.style.cssText = 'background:white;padding:10px;border-radius:8px;max-width:230px;box-shadow:0 2px 8px #0003;font:12px/1.4 system-ui';
            message = document.createElement('span');
            message.setAttribute('role', 'status');
            retry = document.createElement('button');
            retry.textContent = 'Retry selected map'; retry.type = 'button';
            retry.style.cssText = 'display:block;margin-top:6px';
            retry.onclick = () => load(select.value, true);
            panel.append(message, retry);
            L.DomEvent.disableClickPropagation(panel);
            L.DomEvent.disableScrollPropagation(panel);
            return panel;
        };
        control.addTo(map);
        L.control.scale({position: 'bottomright', imperial: false}).addTo(map);
        function notice(text, canRetry = true) {
            panel.hidden = false; message.textContent = text; retry.hidden = !canRetry;
        }
        function remove(record) {
            if (!record) return;
            // Preserve Leaflet's own remove listeners (including attribution cleanup).
            map.removeLayer(record.base);
            if (record.labels) map.removeLayer(record.labels);
        }
        function load(style, force = false) {
            clearTimeout(timer);
            remove(pending); pending = null;
            if (active?.style === style && !force) {panel.hidden = true; return;}
            const options = {minZoom: 3, maxZoom: 19, maxNativeZoom: 19,
                updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 2,
                opacity: 0, zIndex: 2};
            const satellite = style === 'satellite';
            const record = {style, loaded: 0, errors: 0};
            record.base = L.tileLayer(satellite
                ? 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                ...options, attribution: satellite
                    ? 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            });
            if (satellite) {
                record.labels = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                    ...options, opacity: 1, pane: 'basemapLabels', attribution: 'Labels &copy; Esri and contributors'
                });
                record.labels.on('tileerror', () => {
                    if (active === record) notice('Satellite is available, but some place labels could not load. Retry or choose Streets.');
                });
            }
            const slow = () => {
                if (pending !== record) return;
                notice('The selected map is slow or unavailable.' + (active ? ' Keeping the previous map visible.' : '') + ' Retry or choose another view.');
            };
            record.base.on('loading', () => {
                if (pending !== record && active !== record) return;
                record.loaded = 0; record.errors = 0;
                if (pending === record) {clearTimeout(timer); timer = setTimeout(slow, 15000);}
            });
            record.base.on('tileload', () => record.loaded++);
            record.base.on('tileerror', () => record.errors++);
            record.base.on('load', () => {
                if (pending !== record && active !== record) return;
                if (record.errors || !record.loaded) {
                    if (pending === record) {clearTimeout(timer); slow();}
                    else notice('Some map tiles could not load. Retry or choose another view.');
                    return;
                }
                if (pending === record) {
                    clearTimeout(timer);
                    const previous = active;
                    active = record; pending = null;
                    record.base.setOpacity(1).setZIndex(1);
                    remove(previous);
                    if (record.labels) record.labels.addTo(map);
                }
                panel.hidden = true;
            });
            pending = record;
            notice('Loading ' + (satellite ? 'satellite' : 'streets') + '…' + (active ? ' Keeping the current map visible.' : ''), false);
            record.base.addTo(map);
            timer = setTimeout(slow, 15000);
        }
        select.onchange = () => load(select.value);
        load(select.value);
        if (window.ResizeObserver) {
            let width = 0, height = 0, resizeFrame;
            const observer = new ResizeObserver(entries => {
                const box = entries[0].contentRect;
                if (!box.width || !box.height || (box.width === width && box.height === height)) return;
                width = box.width; height = box.height;
                cancelAnimationFrame(resizeFrame);
                resizeFrame = requestAnimationFrame(() => map.invalidateSize({pan: false, animate: false, debounceMoveend: true}));
            });
            observer.observe(map.getContainer());
            map.on('unload', () => {observer.disconnect(); cancelAnimationFrame(resizeFrame); clearTimeout(timer);});
        }
    }
};
