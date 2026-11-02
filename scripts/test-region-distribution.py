import importlib.util
import contextlib
import gzip
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("region_distribution", Path(__file__).with_name("build-region-distribution.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class DistributionContracts(unittest.TestCase):
    def test_resource_add_edit_remove_preserves_unrelated_download_blocks(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            resources = {f'data/national/canonical/activation/{i:04}.json.gz': bytes([i % 251]) * (70_000 + i)
                         for i in range(100)}

            def export(name, values):
                inventory = builder.Resources(root)
                for path, content in values.items():
                    inventory.add(path, 'metro', content=content)
                chunks, files = builder.write_chunks(root / name, inventory)
                return chunks, files

            chunks, files = export('before', resources)
            target = next(iter(resources))
            block_peers = {path for path, chunk in files.items() if chunk == files[target]}
            for name, changed in [('edit', {**resources, target: resources[target] + b'changed' * 1000}),
                                  ('remove', {path: value for path, value in resources.items() if path != target})]:
                after_chunks, after_files = export(name, changed)
                affected = {path for path in after_files if files[path] != after_files[path]}
                self.assertEqual(affected, block_peers & changed.keys())
                self.assertEqual(len(set(chunks) - set(after_chunks)), 1)
            added_path = 'data/national/canonical/activation/0000-new.json.gz'
            _, after_files = export('add', {**resources, added_path: b'new-place'})
            affected_before = {files[path] for path in resources if files[path] != after_files[path]}
            self.assertLessEqual(len(affected_before), 1)

    def test_overture_candidate_is_complete_without_legacy_fallback_and_has_update_metadata(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = (Path(temporary) / 'code').resolve()
            runtime_root = (Path(temporary) / 'received').resolve()

            def write(base, name, value):
                target = base / name
                target.parent.mkdir(parents=True, exist_ok=True)
                raw = builder.json_bytes(value)
                target.write_bytes(gzip.compress(raw, mtime=0) if name.endswith('.gz') else raw)
                return target

            def part(name, value, **fields):
                target = write(runtime_root, 'data/national/' + name, value)
                return {'path': name, 'bytes': target.stat().st_size, 'sha256': builder.digest(target.read_bytes()), **fields}

            new_rows = [{'id': 'new-gers', 'adminNodeId': 'ward-11101', 'regionCode': '11', 'source': {'namespace': 'overture'}},
                        {'id': 'geo:new-area', 'adminNodeId': 'ward-11101', 'regionCode': '11', 'source': {'namespace': 'editorial'}}]
            detail = part('canonical/rows/11101/0.json.gz', {'rows': new_rows}, count=2, regionCodes=['11'])
            light = part('canonical/index/rows/11101/0.json.gz', {'rows': new_rows}, count=2, regionCodes=['11'], detailPath=detail['path'])
            alias = part('canonical/aliases/0.json.gz', {'aliases': {'new-gers': {'id': 'new-gers', 'path': detail['path'], 'regionCode': '11'}}}, bucket=0, count=1)
            activation = part('canonical/activation/6e65.json.gz', {'rows': [{'id': 'new-gers', 'regionCode': '11', 'lookupTerms': ['new']}]}, prefix='ne', count=1)
            living = part('canonical/living-areas/11101.json.gz', {'rows': [new_rows[1]]}, count=1, regionCodes=['11'])
            geographic = part('canonical/geographic/11101.json.gz', {'nodes': [{'id': 'new-gers', 'ref': {'path': light['path'], 'index': 0}}]}, count=1, regionCodes=['11'])
            source_info = {'kind': 'overture', 'release': '2026-10-21.0', 'testOnly': True, 'districtCodes': ['11101']}
            canonical = {'schemaVersion': 1, 'version': 'overture-test-fixture', 'runtimeSource': source_info,
                         'categories': [{'id': 'in.retail', 'name': '店铺'}], 'parts': [detail], 'aliasParts': [alias],
                         'baselineContextPath': 'canonical/baseline-contexts.json',
                         'counts': {'canonicalPlaces': 2, 'sourceIdentities': 1, 'located': 0},
                         'catalogIndex': {'version': 2, 'parts': [light], 'counts': {'rows': 2}},
                         'spatialIndex': {'version': 1, 'parts': [], 'stationParts': [], 'counts': {'rows': 0}},
                         'activationIndex': {'version': 3, 'parts': [activation], 'counts': {'names': 1, 'prefixes': 1}},
                         'livingAreaIndex': {'version': 1, 'parts': [living], 'counts': {'large': 1, 'small': 0}},
                         'geographicIndex': {'version': 1, 'sourceVersion': 'overture-test-fixture', 'parts': [geographic], 'counts': {'nodes': 2}}}
            write(runtime_root, 'data/national/canonical/baseline-contexts.json', {'rows': [], 'aliases': {}})
            regions = []
            for code in [f'{n:02}' for n in range(48)]:
                map_part = part(f'region-{code}.json.gz', {'poi': {'list': []}, 'transport': {'stations': []}}, count=0)
                regions.append({'code': code, 'name': code, 'mapPath': map_part['path'], 'poiCount': 2 if code == '11' else 0})
            metro_map = part('view-metro.json.gz', {'poi': {'list': []}, 'transport': {'stations': []}})
            overlay = 'overlays/map.json.gz'
            write(root, 'data/national/' + overlay, {'railways': [], 'boundaries': []})
            view = {'code': 'metro', 'mapPath': metro_map['path'], 'regionCodes': ['11', '12', '13', '14'], 'poiCount': 2,
                    'overlayParts': [{'path': overlay}], 'overlayCoverage': {'railwaysComplete': True}}
            source = {'schemaVersion': 1, 'runtimeSource': source_info, 'canonicalPlaces': canonical, 'regions': regions, 'views': [view],
                      'navigationRegions': [{'code': code, 'name': code, 'regionCodes': [f'{n:02}' for n in numbers]} for code, numbers in [
                          ('hokkaido', [1]), ('tohoku', range(2, 8)), ('kanto', range(8, 15)), ('chubu', range(15, 24)),
                          ('kinki', range(24, 31)), ('chugoku', range(31, 36)), ('shikoku', range(36, 40)), ('kyushu-okinawa', range(40, 48))]],
                      'landOverviewPath': 'land-overview.json.gz', 'metroRoadsPath': 'roads/manifest.json'}
            write(runtime_root, 'data/national/manifest.json', source)
            write(root, 'data/national/manifest.json', {'old': 'must-not-load'})
            write(root, 'data/national/land-overview.json.gz', {'land': []})
            write(root, 'data/national/roads/manifest.json', {'parts': [{'path': 'roads/one.json.gz'}]})
            write(root, 'data/national/roads/one.json.gz', {'roads': []})
            baseline = {'packages': [], 'places': [], 'runtimeTextManifest': {}, 'editableTextSlots': {'slots': {}},
                        'defaultSettings': {'packages': {}}, 'defaultUIPreferences': {'transitFavoritePlaces': []}}
            write(runtime_root, 'data/runtime/runtime.json', baseline)
            write(root, 'data/runtime/runtime.json', {'old': 'must-not-load'})
            for name in ['src/legacy/transit-data.json', 'data/metro-transit.json']:
                write(runtime_root, name, {'stations': []})
                write(root, name, {'stations': ['old-station']})
            (runtime_root / 'src/metro-name-catalog.js').write_text('export const metroNames = {};', encoding='utf8')
            (root / 'src/metro-name-catalog.js').write_text('export const metroNames = {"old":"old-name"};', encoding='utf8')
            for name in ['index.js', 'style.css', 'ui/desktop.html', 'assets/map-icons/point.svg']:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('', encoding='utf8')
            write(root, 'manifest.json', {'display_name': 'Living Japan', 'version': '0.1.0'})
            changelog_path = write(root, 'release-notes.json', [{'version': '2026.11.02-candidate.1', 'summary': '接入新点与检索目录。', 'details': '仅接入已审收回货，保留底图与空旧站网。'}])

            def export(name, version='2026.11.02-candidate.1', release_date=None):
                output = Path(temporary) / name
                version_arguments = ['--release-date', release_date] if release_date else ['--version', version]
                arguments = ['builder', '--runtime-root', str(runtime_root), '--output', str(output), *version_arguments,
                             '--catalog-url', 'http://127.0.0.1:7143/region-packs/catalog.json', '--notice', '候选资料，尚未发布。', '--changelog', str(changelog_path)]
                with patch.object(builder, 'ROOT', root), patch('sys.argv', arguments), patch.object(builder.subprocess, 'check_output', return_value='fixture-head'), contextlib.redirect_stdout(io.StringIO()):
                    builder.main()
                return output, builder.load_json(output / 'region-packs/manifests/metro.json')

            before_source = {p: p.read_bytes() for base in [root, runtime_root] for p in base.rglob('*') if p.is_file()}
            output, manifest = export('first')
            fragment = manifest['nationalManifestFragment']
            self.assertEqual(fragment['runtimeSource'], source_info)
            self.assertEqual(fragment['canonicalPlaces']['categories'], canonical['categories'])
            self.assertEqual(fragment['canonicalPlaces']['activationIndex'], canonical['activationIndex'])
            self.assertEqual(fragment['canonicalPlaces']['livingAreaIndex'], canonical['livingAreaIndex'])
            for path in [activation['path'], living['path'], geographic['path'], canonical['baselineContextPath'], overlay, 'roads/one.json.gz']:
                self.assertIn('data/national/' + path, manifest['files'])
            self.assertEqual(manifest['version'], '2026.11.02-candidate.1')
            self.assertEqual({k: manifest['coverage'][k] for k in ['adminUnitCount', 'sourcePlaces', 'structurePlaces']},
                             {'adminUnitCount': 1, 'sourcePlaces': 1, 'structurePlaces': 1})
            self.assertEqual(manifest['components']['places']['fileCount'], 1)
            self.assertGreater(manifest['components']['indexes']['fileCount'], 1)
            catalog = builder.load_json(output / 'region-packs/catalog.json')
            entry = next(p for p in catalog['packages'] if p['id'] == 'metro')
            for field in ['notice', 'changelog', 'components', 'contentSha256', 'coverage', 'updatedAt']:
                self.assertEqual(entry[field], manifest[field])
            self.assertEqual(entry['chunks'], [{'sha256': chunk['sha256'], 'bytes': chunk['bytes']} for chunk in manifest['chunks']])
            framework = builder.load_json(output / 'framework/data/region-framework.json')
            self.assertEqual(framework['nationalManifest']['runtimeSource'], {**source_info, 'districtCodes': []})
            self.assertFalse(framework['nationalManifest']['canonicalPlaces'].get('activationIndex', {}).get('parts'))
            self.assertNotIn('version', framework['nationalManifest']['canonicalPlaces'])
            self.assertEqual(builder.load_json(output / 'framework/data/region-pack-source.json')['catalogUrl'], 'http://127.0.0.1:7143/region-packs/catalog.json')
            for path, raw in before_source.items():
                self.assertEqual(path.read_bytes(), raw)
            _, relabelled = export('relabelled', '2026.11.02-candidate.2')
            self.assertEqual(relabelled['contentSha256'], manifest['contentSha256'])
            self.assertEqual(relabelled['components']['indexes']['sha256'], manifest['components']['indexes']['sha256'])
            dated_output, dated = export('dated', release_date='20261102')
            dated_catalog = builder.load_json(dated_output / 'region-packs/catalog.json')
            self.assertEqual(dated_catalog['version'], 'v20261102')
            self.assertEqual(builder.load_json(dated_output / 'framework/manifest.json')['version'], 'v20261102')
            self.assertEqual(builder.load_json(dated_output / 'framework/data/region-framework.json')['version'], 'v20261102')
            expected_versions = {'metro': 'SDQ20261102', 'common': 'GG20261102', 'hokkaido': 'BHD20261102', 'tohoku': 'DB20261102',
                                 'kanto': 'GD20261102', 'chubu': 'ZB20261102', 'kinki': 'JJ20261102', 'chugoku': 'ZG20261102',
                                 'shikoku': 'SG20261102', 'kyushu-okinawa': 'JZCQ20261102'}
            self.assertEqual({entry['id']: entry['version'] for entry in dated_catalog['packages']}, expected_versions)
            for entry in dated_catalog['packages']:
                package = builder.load_json(dated_output / f'region-packs/manifests/{entry["id"]}.json')
                self.assertEqual(package['version'], entry['version'])
                self.assertEqual(package['components']['indexes']['version'], entry['version'])
                self.assertEqual(package['dependencies'], [] if entry['id'] == 'common' else ['common'])
            self.assertEqual(dated_catalog['contentSha256'], catalog['contentSha256'])
            self.assertEqual(dated['chunks'], manifest['chunks'])
            self.assertEqual(dated['contentSha256'], manifest['contentSha256'])
            _, next_date = export('next-date', release_date='20261103')
            self.assertEqual(next_date['version'], 'SDQ20261103')
            self.assertEqual(next_date['contentSha256'], dated['contentSha256'])
            self.assertEqual(next_date['components']['indexes']['sha256'], dated['components']['indexes']['sha256'])
            self.assertEqual(builder.load_json(root / 'manifest.json')['version'], '0.1.0')
            activation_path = runtime_root / 'data/national' / activation['path']
            updated = builder.load_json(activation_path)
            updated['rows'][0]['lookupTerms'].append('new registered alias')
            write(runtime_root, 'data/national/' + activation['path'], updated)
            _, changed = export('index-update', '2026.11.02-candidate.3')
            self.assertNotEqual(changed['components']['indexes']['sha256'], manifest['components']['indexes']['sha256'])
            self.assertEqual(changed['components']['places']['sha256'], manifest['components']['places']['sha256'])
            missing = runtime_root / 'data/national' / detail['path']
            write(root, 'data/national/' + detail['path'], {'rows': [{'id': 'old-place'}]})
            missing.unlink()
            with self.assertRaises(FileNotFoundError):
                export('missing-new-detail')

    def test_geographic_resources_survive_distribution_without_rewriting_cross_region_refs(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            files = {'roads.json': {'parts': []}, 'geo-13.json': {'nodes': [
                {'id': 'parent', 'name': 'Parent', 'regionCode': '13', 'adminNodeId': 'a', 'ref': {'path': 'light-13.json', 'index': 0}, 'parents': []},
                {'id': 'child', 'name': 'Child', 'regionCode': '01', 'adminNodeId': 'b', 'ref': {'path': 'light-01.json', 'index': 0}, 'parents': [{'id': 'parent', 'regionCode': '13'}]},
            ]}}
            for name, value in files.items():
                target = root / 'data/national' / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(json.dumps(value), encoding='utf-8')
            for name in ['data/runtime/runtime.json', 'src/legacy/transit-data.json', 'data/metro-transit.json']:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('{}', encoding='utf-8')
            (root / 'src/metro-name-catalog.js').write_text('export const metroNames = {};', encoding='utf-8')
            part = {'path': 'geo-13.json', 'regionCodes': ['13']}
            canonical = {'parts': [], 'aliasParts': [], 'counts': {'canonicalPlaces': 0}, 'catalogIndex': {'version': 2, 'parts': []}, 'spatialIndex': {'parts': [], 'stationParts': []}, 'geographicIndex': {'version': 1, 'sourceVersion': 'published', 'parts': [part]}}
            source = {'regions': [], 'canonicalPlaces': canonical, 'metroRoadsPath': 'roads.json'}
            prior = builder.ROOT
            builder.ROOT = root
            try:
                inventory, fragments = builder.build_resources(source, {'runtimeTextManifest': {}}, [{'id': 'common'}, {'id': 'metro'}], {'13': 'metro', '01': 'hokkaido'})
            finally:
                builder.ROOT = prior
            self.assertEqual(fragments['metro']['canonicalPlaces']['geographicIndex']['sourceVersion'], 'published')
            self.assertEqual(fragments['metro']['canonicalPlaces']['geographicIndex']['parts'][0]['path'], 'geo-13.json')
            self.assertEqual(json.loads(inventory.read('data/national/geo-13.json')), files['geo-13.json'])
            self.assertEqual(inventory.entries['data/national/geo-13.json']['owners'], {'metro'})

    def test_old_ids_follow_target_region_without_copying_identity(self):
        aliases = {"old:a": {"id": "place:a", "path": "points/13/a.gz", "regionCode": "13"},
                   "old:b": {"id": "place:b", "path": "points/08/b.gz", "regionCode": "08"},
                   "old:c": {"id": "place:c", "path": "points/00/c.gz", "regionCode": "00"}}
        result = builder.split_aliases(aliases, {"13": "metro", "08": "kanto", "00": "common"})
        self.assertEqual({key: list(value) for key, value in result.items()},
                         {"metro": ["old:a"], "kanto": ["old:b"], "common": ["old:c"]})
        self.assertEqual(sum(map(len, result.values())), len(aliases))
        self.assertEqual(result["metro"]["old:a"], aliases["old:a"])


if __name__ == "__main__":
    unittest.main()
