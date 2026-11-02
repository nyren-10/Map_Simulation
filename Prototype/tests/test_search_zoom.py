"""Place framing and country filtering without requiring the routing stack."""
import unittest
from unittest.mock import patch
import place_search


class SearchZoomTests(unittest.TestCase):
    def test_named_campus_is_close(self):
        self.assertEqual(place_search.find_places('techno njr')[0]['zoom'], 18)

    @patch('place_search._get')
    def test_provider_place_types_and_india_filter(self, get):
        get.return_value = {'features': [
            {'geometry': {'coordinates': [73.71, 24.58]}, 'properties': {
                'name': name, 'countrycode': country, 'osm_key': key, 'osm_value': value}}
            for name, country, key, value in [
                ('Campus', 'IN', 'amenity', 'college'),
                ('Neighbourhood', 'IN', 'place', 'suburb'),
                ('City', 'IN', 'place', 'city'),
                ('Road', 'IN', 'highway', 'residential'),
                ('Foreign campus', 'GB', 'amenity', 'college')]]}
        places = place_search._photon('test')
        self.assertEqual([p['zoom'] for p in places], [18, 16, 15, 17])

    @patch('place_search._get')
    def test_city_fallback_frames_city_centre(self, get):
        get.return_value = {'results': [{'name': 'Udaipur', 'country_code': 'IN',
                                        'latitude': 24.58, 'longitude': 73.71}]}
        self.assertEqual(place_search._cities('udaipur')[0]['zoom'], 15)


if __name__ == '__main__':
    unittest.main()
