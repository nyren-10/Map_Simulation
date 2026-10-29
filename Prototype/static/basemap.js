'use strict';
window.FloodsafeBasemap = {
    attach(map) {
        const control = L.control({position: 'bottomright'});
        let panel, message, retry, layer, timer;
        control.onAdd = () => {
            panel = L.DomUtil.create('div', 'basemap-status');
            panel.style.cssText = 'background:white;padding:10px;border-radius:8px;max-width:260px;box-shadow:0 2px 8px #0003;font:12px/1.4 system-ui;margin-bottom:8px';
            message = document.createElement('span');
            message.setAttribute('role', 'status');
            retry = document.createElement('button');
            retry.textContent = 'Retry map';
            retry.type = 'button';
            retry.style.cssText = 'display:block;margin-top:6px';
            retry.onclick = load;
            panel.append(message, retry);
            L.DomEvent.disableClickPropagation(panel);
            L.DomEvent.disableScrollPropagation(panel);
            return panel;
        };
        control.addTo(map);
        function notice(text, canRetry) {
            panel.hidden = false;
            message.textContent = text;
            retry.hidden = !canRetry;
        }
        function load() {
            clearTimeout(timer);
            if (layer) { map.removeLayer(layer); layer.off(); }
            notice('Loading OpenStreetMap…', false);
            layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            });
            const active = layer;
            function slow() {
                notice('Map tiles are slow or unavailable. Check your connection, then retry. Your scenario is preserved.', true);
            }
            active.on('loading', () => {
                clearTimeout(timer);
                timer = setTimeout(slow, 15000);
            });
            active.on('tileerror', () => notice('Some map tiles could not load. Check your connection and retry. Drawing and routing controls remain available.', true));
            active.on('load', () => {
                clearTimeout(timer);
                const tiles = [...active.getContainer().querySelectorAll('img')];
                if (tiles.length && tiles.every(img => img.complete && img.naturalWidth > 0)) panel.hidden = true;
                else slow();
            });
            try { active.addTo(map); }
            catch (error) {
                clearTimeout(timer);
                console.error('Basemap initialization failed:', error);
                notice('Map background could not start. Retry map. Your scenario is preserved.', true);
            }
        }
        load();
        if (window.ResizeObserver) {
            new ResizeObserver(() => map.invalidateSize({pan: false})).observe(map.getContainer());
        }
    }
};
