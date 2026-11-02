"""Routing must work when the deployment directory is read-only."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import networkx as nx
from shapely.geometry import Polygon, mapping
import planner
from app import app


class RuntimeCacheTests(unittest.TestCase):
    def setUp(self):
        planner.load_roads.cache_clear()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = patch('planner.gettempdir', return_value=self.tmp.name)
        self.root.start()
        self.addCleanup(self.root.stop)
        self.addCleanup(planner.load_roads.cache_clear)
        # Outside the bundled Udaipur snapshot, so this exercises download/cache.
        self.boundary = Polygon([(75.80, 26.90), (75.802, 26.90),
                                 (75.802, 26.902), (75.80, 26.902)])
        self.graph = nx.MultiDiGraph(crs='EPSG:4326')
        self.graph.add_node(1, x=75.801, y=26.901)
        self.graph.add_node(2, x=75.8015, y=26.901)
        self.graph.add_edge(1, 2, length=50, osmid=123)
        self.fetch = patch('road_data.fetch_graph', return_value=self.graph).start()
        self.addCleanup(patch.stopall)

    def test_cache_is_temporary_and_reusable(self):
        planner.load_roads(self.boundary.wkt)
        cached = list(Path(self.tmp.name).rglob('*.graphml'))
        self.assertEqual(len(cached), 1)
        self.assertFalse(planner.ox.settings.use_cache)
        self.assertFalse(planner.ox.settings.log_file)
        planner.load_roads.cache_clear()
        graph = planner.load_roads(self.boundary.wkt)
        self.assertEqual(graph.number_of_edges(), 1)
        self.assertEqual(self.fetch.call_count, 1)

    def test_read_only_cache_directory_does_not_block_routing(self):
        with patch('planner.Path.mkdir', side_effect=OSError(30, 'Read-only file system')):
            self.assertIs(planner.load_roads(self.boundary.wkt), self.graph)

    def test_failed_cache_save_returns_graph_and_cleans_partial_file(self):
        with patch('planner.ox.save_graphml', side_effect=PermissionError('read-only')):
            self.assertIs(planner.load_roads(self.boundary.wkt), self.graph)
        self.assertEqual(list(Path(self.tmp.name).rglob('*.graphml')), [])

    def test_corrupt_cache_is_redownloaded(self):
        planner.load_roads(self.boundary.wkt)
        cached = next(Path(self.tmp.name).rglob('*.graphml'))
        cached.write_text('interrupted old download')
        planner.load_roads.cache_clear()
        self.assertIs(planner.load_roads(self.boundary.wkt), self.graph)
        self.assertEqual(self.fetch.call_count, 2)

    def test_plan_api_allocates_with_unwritable_cache(self):
        grid = {'type': 'FeatureCollection', 'features': [{'properties': {
            'id': 'test-cell', 'people': 100, 'lat': 26.901, 'lon': 75.801}}]}
        payload = {'boundary': mapping(self.boundary), 'grid': grid,
                   'shelters': [{'id': 'S1', 'lat': 26.901, 'lon': 75.8015, 'capacity': 200}],
                   'floods': [], 'threshold': 25, 'speed': 15, 'interval': 30}
        with patch('planner.Path.mkdir', side_effect=OSError(30, 'Read-only file system')):
            response = app.test_client().post('/api/plan', json=payload)
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()['summary']['assigned'], 100)
        self.assertEqual(len(response.get_json()['routes']), 1)


if __name__ == '__main__':
    unittest.main()
