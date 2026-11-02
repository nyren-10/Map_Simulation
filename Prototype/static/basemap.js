'use strict';
window.FloodsafeBasemap = {
    attach(map) {
        const select = document.getElementById('mapStyle');
        const control = L.control({position: 'topright'});
        let panel, message, retry, layers = [], timer, generation = 0;
        map.createPane('basemapLabels').style.zIndex = 250;
        map.getPane('basemapLabels').style.pointerEvents = 'none';
        control.onAdd = () => {
            panel = L.DomUtil.create('div', 'basemap-status');
            panel.style.cssText = 'background:white;padding:10px;border-radius:8px;max-width:230px;box-shadow:0 2px 8px #0003;font:12px/1.4 system-ui';
            message = document.createElement('span');
            message.setAttribute('role', 'status');
            retry = document.createElement('button');
            retry.textContent = 'Retry map';
            retry.type = 'button';
            retry.style.cssText = 'display:block;margin-top:6px';
            retry.onclick = () => load(select.value);
            panel.append(message, retry);
            L.DomEvent.disableClickPropagation(panel);
            L.DomEvent.disableScrollPropagation(panel);
            return panel;
        };
        control.addTo(map);
        L.control.scale({position: 'bottomright', imperial: false}).addTo(map);
        function notice(text, canRetry) {
            panel.hidden = false;
            message.textContent = text;
            retry.hidden = !canRetry;
        }
        function load(style, fallback = false) {
            const token = ++generation;
            clearTimeout(timer);
            layers.forEach(layer => {layer.off(); map.removeLayer(layer);});
            layers = [];
            select.value = style;
            notice(fallback ? 'Satellite unavailable. Showing street map instead.' : 'Loading map…', false);
            const options = {minZoom: 3, maxZoom: 19, maxNativeZoom: 19,
                updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 1};
            if (style === 'satellite') {
                layers.push(L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    ...options,
                    attribution: 'Imagery &copy; <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community'
                }));
                layers.push(L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                    ...options, pane: 'basemapLabels', attribution: 'Labels &copy; Esri and contributors'
                }));
            } else {
                layers.push(L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    ...options, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                }));
            }
            let failed = false, baseErrors = 0;
            const pending = new Set();
            const slow = () => {
                if (token !== generation) return;
                notice('Map tiles are slow or unavailable. Retry or switch map view. Your scenario is preserved.', true);
            };
            layers.forEach((layer, index) => {
                layer.on('loading', () => {
                    if (token !== generation) return;
                    pending.add(layer); clearTimeout(timer); timer = setTimeout(slow, 15000);
                });
                layer.on('tileerror', () => {
                    if (token !== generation) return;
                    failed = true;
                    if (style === 'satellite' && index === 0 && ++baseErrors >= 3) {
                        load('streets', true); return;
                    }
                    notice(index === 1 ? 'Some satellite labels could not load. Switch to Streets for place names.' : 'Some map tiles could not load. Retry or switch map view.', true);
                });
                layer.on('load', () => {
                    if (token !== generation) return;
                    pending.delete(layer);
                    if (!pending.size) {clearTimeout(timer); if (!failed) panel.hidden = true;}
                });
                layer.addTo(map);
            });
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
