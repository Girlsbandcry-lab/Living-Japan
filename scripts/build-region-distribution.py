#!/usr/bin/env python3
"""Export independent Living Japan region packs without changing source data.

New builds never overwrite an existing distribution. --refresh-framework is an
explicit, backed-up refresh of program files only; region packs stay immutable.
"""
import argparse
import base64
import collections
import copy
import datetime
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
METRO = {"11", "12", "13", "14"}
CHUNK_BUCKETS = 64
# LJ-RELEASE-VERSION-20261102: public release labels do not enter content fingerprints.
PACKAGE_VERSION_PREFIXES = {
    "common": "GG", "metro": "SDQ", "hokkaido": "BHD", "tohoku": "DB", "kanto": "GD",
    "chubu": "ZB", "kinki": "JJ", "chugoku": "ZG", "shikoku": "SG", "kyushu-okinawa": "JZCQ",
}


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def digest(value):
    return hashlib.sha256(value).hexdigest()


def load_json(path):
    raw = Path(path).read_bytes()
    return json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)


def split_aliases(aliases, region_packages):
    result = collections.defaultdict(dict)
    for old_id, target in aliases.items():
        owner = region_packages[str(target.get("regionCode") or "00").zfill(2)]
        result[owner][old_id] = target
    return dict(result)


def package_download_totals(manifests):
    result = {}
    for identity, manifest in manifests.items():
        visited, chunks, pending = set(), {}, [identity]
        while pending:
            current = pending.pop()
            if current in visited:
                continue
            visited.add(current)
            part = manifests[current]
            chunks.update({chunk["sha256"]: chunk["bytes"] for chunk in part["chunks"]})
            pending.extend(part.get("dependencies", []))
        own = {chunk["sha256"]: chunk["bytes"] for chunk in manifest["chunks"]}
        result[identity] = {"downloadBytes": sum(chunks.values()), "ownDownloadBytes": sum(own.values())}
    return result


def package_definitions(manifest):
    packages = [{"id": "common", "name": "公共基础", "regionCodes": ["00"], "dependencies": []},
                {"id": "metro", "name": "首都圈", "regionCodes": ["11", "12", "13", "14"], "dependencies": ["common"]}]
    for group in manifest["navigationRegions"]:
        packages.append({"id": group["code"], "name": group["name"],
                         "regionCodes": [code for code in group["regionCodes"] if code not in METRO],
                         "dependencies": ["common"]})
    owners = {code: package["id"] for package in packages for code in package["regionCodes"]}
    assert set(owners) == {str(n).zfill(2) for n in range(48)}
    return packages, owners


def canonical_skeleton(source, categories=False):
    keys = ("schemaVersion",) if source.get("runtimeSource", {}).get("kind") == "overture" else ("schemaVersion", "version")
    result = {key: copy.deepcopy(source[key]) for key in keys if key in source}
    if categories:
        result["categories"] = copy.deepcopy(source.get("categories", []))
    result.update(parts=[], aliasParts=[], counts={})
    # Stable geographic references remain unchanged across independent packs.
    result["catalogIndex"] = {"version": source["catalogIndex"].get("version", 1), "parts": [], "counts": {}}
    if source.get("geographicIndex"):
        result["geographicIndex"] = {key: copy.deepcopy(value) for key, value in source["geographicIndex"].items() if key not in ("parts", "counts")}
        result["geographicIndex"].update(parts=[], counts={})
    result["spatialIndex"] = {key: source["spatialIndex"][key] for key in ("version", "tileSize", "maxRows") if key in source["spatialIndex"]}
    result["spatialIndex"].update(parts=[], stationParts=[], counts={})
    for key in ("activationIndex", "livingAreaIndex"):
        if key in source:
            result[key] = {"version": source[key].get("version", 1), "parts": [], "counts": {}}
    if source.get("runtimeSource", {}).get("kind") == "overture":
        result.get("geographicIndex", {}).pop("sourceVersion", None)
    return result


def framework_manifest(source, owners, version):
    national = {key: copy.deepcopy(source[key]) for key in
                ("schemaVersion", "version", "mapVersion", "rootId", "defaultView", "projection", "adminNodes", "navigationRegions") if key in source}
    national.update(regions=[], views=[], canonicalPlaces=canonical_skeleton(source["canonicalPlaces"], True))
    if source.get("runtimeSource"):
        national["runtimeSource"] = dict(source["runtimeSource"], districtCodes=[])
    return {"schemaVersion": 1, "version": version,
            "regionPackageIds": owners,
            "availableRegions": [{**{key: row[key] for key in ("code", "name", "nameJa") if key in row},
                                  "packageId": owners[row["code"]]} for row in source["regions"]],
            "nationalManifest": national, "emptyRuntimePath": "data/empty-runtime.json"}


def empty_runtime(source):
    result = copy.deepcopy(source)
    # LJ-REGION-DISTRIBUTION-20261031: exports and transformed indexes never replace source data.
    for key in ("packages", "places", "bodyRecords", "runtimeContextAnchors", "mapRegions", "adminNodes",
                "placeAdminRelations", "objectAdminEvidence", "walkingInterests", "contentFallbacks"):
        result[key] = []
    for key in ("placeNameAliases", "placePresentation", "placeMetadata", "stationAdministration",
                "namedTriggerAudit", "namedStationParents", "objectAdminEvidence", "corpusAudit", "placeRegistryAudit"):
        if isinstance(result.get(key), dict):
            for field, value in result[key].items():
                if isinstance(value, (dict, list)):
                    result[key][field] = {} if isinstance(value, dict) else []
    result.pop("canonicalPlaceContexts", None)
    for key in ("withinObject", "crossObject"):
        if key in result.get("locationRelations", {}):
            value = result["locationRelations"][key]
            result["locationRelations"][key] = {} if isinstance(value, dict) else []
    for key in ("areas", "objects"):
        if key in result.get("locationBrowse", {}):
            value = result["locationBrowse"][key]
            result["locationBrowse"][key] = {} if isinstance(value, dict) else []
    for key in ("staticCount", "dynamicPackageCount", "dynamicSlotCount", "slotCount"):
        result["editableTextSlots"][key] = 0
    result["editableTextSlots"]["slots"] = {}
    result["runtimeTextManifest"] = {"schemaVersion": 1, "bodies": {}, "summaries": {}}
    result["defaultSettings"]["packages"] = {}
    result["defaultUIPreferences"]["transitFavoritePlaces"] = []
    result["sourceRegistry"] = {"packageCount": 0, "bodyCorpusSha256": digest(b"")}
    return result


class Resources:
    def __init__(self, root, runtime_root=None, fallback_paths=()):
        self.root = Path(root)
        self.runtime_root = Path(runtime_root) if runtime_root else self.root
        self.fallback_paths = set(fallback_paths)
        self.entries = {}
        self.source_hashes = {}

    def source_path(self, path):
        candidate = self.runtime_root / path
        if not candidate.is_file() and path in self.fallback_paths:
            return self.root / path
        return candidate

    def read_source(self, path):
        source_path = self.source_path(path)
        raw = source_path.read_bytes()
        self.source_hashes[str(source_path.resolve())] = digest(raw)
        return raw

    def add(self, path, owner, content=None, source=None):
        source_path = Path(source) if source else self.source_path(path)
        if content is None:
            raw = source_path.read_bytes()
            self.source_hashes[str(source_path.resolve())] = digest(raw)
        else:
            raw = content
        identity = digest(raw)
        if path in self.entries:
            entry = self.entries[path]
            if entry["sha256"] != identity:
                raise ValueError(f"Different bytes for resource path: {path}")
            entry["owners"].add(owner)
        else:
            self.entries[path] = {"bytes": len(raw), "sha256": identity, "owners": {owner},
                                  "content": content, "source": source_path if content is None else None}
        return {"bytes": len(raw), "sha256": identity}

    def read(self, path):
        entry = self.entries[path]
        return entry["content"] if entry["content"] is not None else entry["source"].read_bytes()


def national_path(path):
    return (ROOT / "data/national" / path).resolve().relative_to(ROOT).as_posix()


def build_resources(source, runtime, packages, owners, runtime_root=None):
    # LJ-OVERTURE-DISTRIBUTION-20261102: explicit received assets, complete indexes and stable path buckets.
    fallback = {national_path(part["path"]) for row in [*source["regions"], *source.get("views", [])]
                for part in row.get("overlayParts", [])}
    fallback.update(national_path(source[key]) for key in ("landOverviewPath", "metroRoadsPath") if key in source)
    fallback.add("data/national/sources.json")
    fallback.update(path.relative_to(ROOT).as_posix() for path in (ROOT / "data/national/licenses").rglob("*") if path.is_file())
    inventory = Resources(ROOT, runtime_root, fallback)
    canonical = source["canonicalPlaces"]
    fragments = {p["id"]: {"regions": [], "views": [], "canonicalPlaces": canonical_skeleton(canonical)} for p in packages}

    def add_part(part, owner, content=None, source_path=None):
        result = copy.deepcopy(part)
        meta = inventory.add(national_path(part["path"]), owner, content, source_path)
        result.update(meta)
        if content is not None:
            result["jsonBytes"] = len(gzip.decompress(content))
        return result

    for region in source["regions"]:
        owner = owners[region["code"]]
        row = {key: copy.deepcopy(region[key]) for key in
               ("code", "name", "nameJa", "mapPath", "bytes", "jsonBytes", "sha256", "version", "overlayCoverage",
                "poiCount", "stationCount", "storeCount", "pbfCount") if key in region}
        row.update(inventory.add(national_path(region["mapPath"]), owner))
        row["overlayParts"] = [] if region["code"] == "00" else [add_part(part, owner) for part in region.get("overlayParts", [])]
        fragments[owner]["regions"].append(row)
    for view in source.get("views", []):
        row = copy.deepcopy(view)
        row.update(inventory.add(national_path(row["mapPath"]), "metro"))
        row["overlayParts"] = [add_part(part, "metro") for part in row.get("overlayParts", [])]
        fragments["metro"]["views"].append(row)
    for key, owner in (("landOverviewPath", "common"), ("schematicMetroPath", "metro"),
                       ("mapPresentationPath", "metro"), ("metroRoadsPath", "metro")):
        if key in source:
            fragments[owner][key] = source[key]
            inventory.add(national_path(source[key]), owner)
    roads = json.loads(inventory.read_source(national_path(source["metroRoadsPath"])))
    inventory.fallback_paths.update(national_path(part["path"]) for part in roads["parts"])
    for part in roads["parts"]:
        inventory.add(national_path(part["path"]), "metro")

    for section, field in ((None, "parts"), ("catalogIndex", "parts"), ("spatialIndex", "parts"), ("spatialIndex", "stationParts"), ("geographicIndex", "parts"), ("livingAreaIndex", "parts")):
        for part in (canonical.get(section, {}) if section else canonical).get(field, []):
            codes = part.get("regionCodes") or ["00"]
            owner_set = {owners[code] for code in codes}
            if len(owner_set) != 1:
                raise ValueError(f"Canonical identity block spans independent packages: {part['path']}")
            owner = next(iter(owner_set))
            target = fragments[owner]["canonicalPlaces"]
            if section:
                target = target[section]
            target[field].append(add_part(part, owner))
    for part in canonical.get("activationIndex", {}).get("parts", []):
        raw = inventory.read_source(national_path(part["path"]))
        payload = json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)
        owner_set = {owners[row["regionCode"]] for row in payload["rows"]}
        if len(owner_set) != 1:
            raise ValueError(f"Activation prefix spans independent packages: {part['path']}")
        owner = next(iter(owner_set))
        fragments[owner]["canonicalPlaces"]["activationIndex"]["parts"].append(add_part(part, owner))
    alias_count = 0
    for part in canonical["aliasParts"]:
        raw = inventory.read_source(national_path(part["path"]))
        payload = json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)
        split = split_aliases(payload["aliases"], owners)
        alias_count += len(payload["aliases"])
        for owner, aliases in split.items():
            raw = json_bytes({"aliases": aliases})
            path = f"canonical/aliases/{owner}/{part['bucket']}.json.gz"
            descriptor = {"path": path, "bucket": part["bucket"], "count": len(aliases), "jsonBytes": len(raw)}
            fragments[owner]["canonicalPlaces"]["aliasParts"].append(add_part(descriptor, owner, gzip.compress(raw, compresslevel=6, mtime=0)))
    for owner, fragment in fragments.items():
        c = fragment["canonicalPlaces"]
        c["counts"] = {"canonicalPlaces": sum(p.get("count", 0) for p in c["parts"]),
                       "sourceIdentities": sum(p.get("count", 0) for p in c["aliasParts"]),
                       "located": sum(p.get("count", 0) for p in c["spatialIndex"]["parts"])}
        c["catalogIndex"]["counts"] = {"rows": sum(p.get("count", 0) for p in c["catalogIndex"]["parts"])}
        if "geographicIndex" in c:
            c["geographicIndex"]["counts"] = {"nodeReferences": sum(p.get("count", 0) for p in c["geographicIndex"]["parts"])}
        c["spatialIndex"]["counts"] = {"rows": c["counts"]["located"], "stationRows": sum(p.get("count", 0) for p in c["spatialIndex"]["stationParts"])}

    active_owners = [owner for owner, fragment in fragments.items() if fragment["canonicalPlaces"]["parts"]]
    if source.get("runtimeSource", {}).get("kind") == "overture":
        for owner in active_owners:
            fragment = fragments[owner]
            c = fragment["canonicalPlaces"]
            runtime_source = dict(source["runtimeSource"], districtCodes=[code for code in source["runtimeSource"].get("districtCodes", []) if owners[code[:2]] == owner])
            fragment["runtimeSource"] = runtime_source
            c.update(version=canonical["version"], runtimeSource=copy.deepcopy(runtime_source), categories=copy.deepcopy(canonical.get("categories", [])))
            if canonical.get("baselineContextPath"):
                c["baselineContextPath"] = canonical["baselineContextPath"]
                inventory.add(national_path(c["baselineContextPath"]), owner)
            if len(active_owners) == 1:
                c["counts"] = copy.deepcopy(canonical["counts"])
                for key in ("catalogIndex", "spatialIndex", "geographicIndex", "activationIndex", "livingAreaIndex"):
                    if key in canonical:
                        c[key].update({k: copy.deepcopy(v) for k, v in canonical[key].items() if k not in ("parts", "stationParts")})

    text_manifest = runtime["runtimeTextManifest"]
    metro_files = {"data/runtime/runtime.json", "src/legacy/transit-data.json", "data/metro-transit.json"}
    metro_files.update(text_manifest.get("bodies", {}).values())
    metro_files.update(text_manifest.get("summaries", {}).values())
    metro_files.update(text_manifest[key] for key in ("contextsPath", "allBodiesPath", "allSummariesPath") if text_manifest.get(key))
    for path in sorted(metro_files):
        inventory.add(path, "metro")
    names_text = inventory.read_source("src/metro-name-catalog.js").decode("utf-8")
    marker = re.search(r"export\s+const\s+metroNames\s*=\s*", names_text)
    if not marker:
        raise ValueError("Cannot locate original metroNames data export")
    names, _ = json.JSONDecoder().raw_decode(names_text[marker.end():])
    inventory.add("data/metro-names.json", "metro", json_bytes(names))
    if inventory.source_path("data/national/sources.json").exists():
        inventory.add("data/national/sources.json", "common")
    license_paths = {path.relative_to(base).as_posix() for base in (ROOT, inventory.runtime_root)
                     for path in (base / "data/national/licenses").rglob("*") if path.is_file()}
    for path in sorted(license_paths):
        inventory.add(path, "common")
    assert sum(f["canonicalPlaces"]["counts"]["canonicalPlaces"] for f in fragments.values()) == canonical["counts"]["canonicalPlaces"]
    assert sum(f["canonicalPlaces"]["counts"]["sourceIdentities"] for f in fragments.values()) == alias_count
    return inventory, fragments


def write_chunks(output, inventory):
    groups = collections.defaultdict(list)
    for path, entry in inventory.entries.items():
        bucket = int(digest(path.encode("utf-8"))[:2], 16) % CHUNK_BUCKETS
        groups[(tuple(sorted(entry["owners"])), bucket)].append(path)
    chunks, file_chunks = {}, {}
    folder = output / "region-packs/chunks"
    folder.mkdir(parents=True)
    def flush(paths, owners):
        raw = json_bytes({"schemaVersion": 1, "files": {path: base64.b64encode(inventory.read(path)).decode("ascii") for path in paths}})
        compressed = gzip.compress(raw, compresslevel=6, mtime=0)
        identity = digest(compressed)
        (folder / f"{identity}.json.gz").write_bytes(compressed)
        chunks[identity] = {"id": identity, "url": f"../chunks/{identity}.json.gz", "bytes": len(compressed), "sha256": identity, "owners": list(owners), "decodedBytes": len(raw)}
        for path in paths:
            file_chunks[path] = identity
    for (owners, _bucket), paths in sorted(groups.items()):
        flush(sorted(paths), owners)
    return chunks, file_chunks


def export_framework(output, source, runtime, owners, version, catalog_url=""):
    framework = output / "framework"
    framework.mkdir(parents=True, exist_ok=True)
    files = [ROOT / name for name in ("index.js", "manifest.json", "style.css")]
    files += [path for path in (ROOT / "src").rglob("*")
              if path.is_file() and path.suffix in (".js", ".css") and path.name != "metro-name-catalog.js"]
    files += [path for path in (ROOT / "ui").rglob("*") if path.is_file()]
    files += [path for path in (ROOT / "assets/map-icons").rglob("*") if path.is_file()]
    for source_path in files:
        target = framework / source_path.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target)
    if re.fullmatch(r"v[0-9]{8}(?:\.[0-9]+)?", version):
        extension_manifest = load_json(framework / "manifest.json")
        extension_manifest["version"] = version
        (framework / "manifest.json").write_bytes(json_bytes(extension_manifest))
    (framework / "data").mkdir(exist_ok=True)
    (framework / "data/region-framework.json").write_bytes(json_bytes(framework_manifest(source, owners, version)))
    (framework / "data/empty-runtime.json").write_bytes(json_bytes(empty_runtime(runtime)))
    (framework / "data/region-pack-source.json").write_bytes(json_bytes({"schemaVersion": 1, "catalogUrl": catalog_url}))
    return {path.relative_to(framework).as_posix(): {"bytes": path.stat().st_size, "sha256": digest(path.read_bytes())}
            for path in sorted(framework.rglob("*")) if path.is_file()}


def verify_export(output, inventory, chunks, file_chunks, packages, fragments):
    checked = set()
    for identity, chunk in chunks.items():
        compressed = (output / "region-packs/chunks" / f"{identity}.json.gz").read_bytes()
        assert digest(compressed) == chunk["sha256"]
        payload = json.loads(gzip.decompress(compressed))
        for path, encoded in payload["files"].items():
            raw = base64.b64decode(encoded, validate=True)
            assert path not in checked, f"Resource copied into multiple chunks: {path}"
            assert len(raw) == inventory.entries[path]["bytes"] and digest(raw) == inventory.entries[path]["sha256"]
            assert file_chunks[path] == identity
            checked.add(path)
    assert checked == set(inventory.entries)
    for package in packages:
        manifest = load_json(output / f"region-packs/manifests/{package['id']}.json")
        assert manifest["nationalManifestFragment"] == fragments[package["id"]]
        for path, entry in manifest["files"].items():
            assert entry["chunkId"] == file_chunks[path]
    for path, expected in inventory.source_hashes.items():
        assert digest(Path(path).read_bytes()) == expected, f"Source changed during build: {path}"
    return {"chunksVerified": len(chunks), "uniqueFilesVerified": len(checked), "sourceFilesUnchanged": len(inventory.source_hashes),
            "canonicalPlaces": sum(f["canonicalPlaces"]["counts"]["canonicalPlaces"] for f in fragments.values()),
            "sourceIdentities": sum(f["canonicalPlaces"]["counts"]["sourceIdentities"] for f in fragments.values()),
            "scope": "Export integrity only; not SillyTavern, browser installation, or user acceptance."}


def functional_fragment(fragment):
    result = copy.deepcopy(fragment)
    canonical = result.get("canonicalPlaces", {})
    canonical.pop("version", None)
    canonical.get("geographicIndex", {}).pop("sourceVersion", None)
    return result


def update_metadata(files, fragment, inventory, version, dependencies=()):
    identities = {path: {key: value[key] for key in ("bytes", "sha256")} for path, value in sorted(files.items())}
    places = {path: value for path, value in identities.items() if path.startswith(("data/national/canonical/rows/", "data/national/canonical/points/"))}
    indexes = {path: value for path, value in identities.items() if path.startswith("data/national/canonical/") and path not in places}
    functional = functional_fragment(fragment)
    index_metadata = copy.deepcopy(functional.get("canonicalPlaces", {}))
    index_metadata.pop("parts", None)
    components = {}
    for key, entries, metadata in (("places", places, {}), ("indexes", indexes, index_metadata)):
        components[key] = {"version": version, "sha256": digest(json_bytes({"files": entries, "metadata": metadata})),
                           "bytes": sum(value["bytes"] for value in entries.values()), "fileCount": len(entries)}
    admin_units, source_places, structure_places = set(), 0, 0
    if fragment.get("runtimeSource", {}).get("kind") == "overture":
        for part in fragment["canonicalPlaces"]["parts"]:
            raw = inventory.read(national_path(part["path"]))
            payload = json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)
            for row in payload["rows"]:
                if row.get("adminNodeId"):
                    admin_units.add(row["adminNodeId"])
                if row.get("source", {}).get("namespace") == "overture":
                    source_places += 1
                else:
                    structure_places += 1
    coverage = {"adminUnitCount": len(admin_units), "sourcePlaces": source_places, "structurePlaces": structure_places,
                "description": f"已接收 {len(fragment.get('runtimeSource', {}).get('districtCodes', []))} 个来源行政区，地点涉及 {len(admin_units)} 个行政范围；{source_places:,} 个源地点、{structure_places:,} 个结构对象。" if admin_units else "当前提供底图与公共资料，尚无已审收点位。"}
    return {"contentSha256": digest(json_bytes({"files": identities, "fragment": functional, "dependencies": list(dependencies)})), "components": components, "coverage": coverage}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / ".local/distribution-20261031")
    release = parser.add_mutually_exclusive_group()
    release.add_argument("--version", help="Use one explicit label for a candidate or legacy build")
    release.add_argument("--release-date", help="Release date YYYYMMDD with optional .N revision; use body and region-specific version labels")
    parser.add_argument("--refresh-framework", action="store_true")
    parser.add_argument("--runtime-root", type=Path)
    parser.add_argument("--catalog-url", default="")
    parser.add_argument("--notice", default="")
    parser.add_argument("--changelog", type=Path)
    args = parser.parse_args()
    if args.release_date:
        try:
            if not re.fullmatch(r"[0-9]{8}(?:\.[0-9]+)?", args.release_date):
                raise ValueError()
            datetime.datetime.strptime(args.release_date.split('.', 1)[0], "%Y%m%d")
        except ValueError:
            parser.error("--release-date must be a valid date in YYYYMMDD form with an optional .N revision")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = args.output.resolve()
    runtime_root = args.runtime_root.resolve() if args.runtime_root else ROOT
    source = load_json(runtime_root / "data/national/manifest.json")
    runtime = load_json(runtime_root / "data/runtime/runtime.json")
    changelog = load_json(args.changelog) if args.changelog else []
    if not isinstance(changelog, list) or any(not isinstance(item, dict) or not all(isinstance(item.get(key), str) for key in ("version", "summary", "details")) for item in changelog):
        raise ValueError("Changelog must contain version, summary and details text entries")
    updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    packages, owners = package_definitions(source)
    if args.refresh_framework:
        catalog = load_json(output / "region-packs/catalog.json")
        version = catalog["version"]
        backup = output / f"framework-before-{stamp}"
        shutil.copytree(output / "framework", backup)
        files = export_framework(output, source, runtime, owners, version, args.catalog_url)
        (output / f"framework-refresh-{stamp}.json").write_bytes(json_bytes({"backup": str(backup), "files": files}))
        print(json.dumps({"output": str(output), "mode": "framework-refreshed", "backup": str(backup), "files": len(files)}, ensure_ascii=True))
        return
    if output.exists():
        output = output.parent / f"{output.name}-{stamp}"
    output.mkdir(parents=True, exist_ok=False)
    version = f"v{args.release_date}" if args.release_date else args.version or stamp
    print(json.dumps({"phase": "collect", "output": str(output)}, ensure_ascii=True), flush=True)
    inventory, fragments = build_resources(source, runtime, packages, owners, runtime_root)
    print(json.dumps({"phase": "chunks", "files": len(inventory.entries)}), flush=True)
    chunks, file_chunks = write_chunks(output, inventory)
    manifests = output / "region-packs/manifests"
    manifests.mkdir()
    catalog = {"schemaVersion": 1, "version": version, "updatedAt": updated_at, "notice": args.notice, "changelog": changelog, "packages": []}
    package_manifests = {}
    for package in packages:
        identity = package["id"]
        package_version = f"{PACKAGE_VERSION_PREFIXES[identity]}{args.release_date}" if args.release_date else version
        files = {path: {"chunkId": file_chunks[path], "bytes": entry["bytes"], "sha256": entry["sha256"]}
                 for path, entry in inventory.entries.items() if identity in entry["owners"]}
        chunk_ids = sorted({entry["chunkId"] for entry in files.values()})
        manifest = {"schemaVersion": 1, "id": identity, "version": package_version, "regionCodes": package["regionCodes"],
                    "dependencies": package["dependencies"], "chunks": [{key: chunks[c][key] for key in ("id", "url", "bytes", "sha256")} for c in chunk_ids],
                    "files": files, "nationalManifestFragment": fragments[identity]}
        metadata = update_metadata(files, fragments[identity], inventory, package_version, package["dependencies"])
        metadata.update(updatedAt=updated_at, notice=args.notice, changelog=changelog)
        manifest.update(metadata)
        (manifests / f"{identity}.json").write_bytes(json_bytes(manifest))
        package_manifests[identity] = manifest
        catalog["packages"].append({**package, "version": package_version, "manifestUrl": f"manifests/{identity}.json", **metadata,
                                    "chunks": [{"sha256": chunk["sha256"], "bytes": chunk["bytes"]} for chunk in manifest["chunks"]]})
    totals = package_download_totals(package_manifests)
    for package in catalog["packages"]:
        package.update(totals[package["id"]])
    catalog["contentSha256"] = digest(json_bytes({package["id"]: package["contentSha256"] for package in sorted(catalog["packages"], key=lambda item: item["id"])}))
    (output / "region-packs/catalog.json").write_bytes(json_bytes(catalog))
    framework_files = export_framework(output, source, runtime, owners, version, args.catalog_url)
    verification = verify_export(output, inventory, chunks, file_chunks, packages, fragments)
    report = {"schemaVersion": 1, "version": version, "output": str(output),
              "sourceHead": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
              "frameworkFiles": framework_files, "packages": catalog["packages"], "chunks": list(chunks.values()),
              "uniqueResourceFiles": len(inventory.entries), "uniqueResourceBytes": sum(e["bytes"] for e in inventory.entries.values()),
              "uniqueDownloadBytes": sum(c["bytes"] for c in chunks.values()), "verification": verification,
              "notes": ["Existing data files and personal saves are unchanged.", "Paths in admin page references replace global part ordinals in export only.",
                        "Alias buckets are partitioned by target owner; active manifests must merge multiple files per bucket.",
                        "Catalog downloadBytes includes dependency chunks deduplicated by SHA-256; ownDownloadBytes excludes dependencies. Catalog/manifest transfer is separate.",
                        "Source URL is supplied explicitly; no release is published by this build.", "Received-runtime resources are used without old point, prose, station-name or rail-network fallback.",
                        "Resource paths select fixed buckets; unchanged content blocks keep their SHA-256 identifiers.", "This build does not install or verify SillyTavern."]}
    (output / "build-report.json").write_bytes(json_bytes(report))
    print(json.dumps({"output": str(output), "version": version, "chunks": len(chunks), "uniqueFiles": len(inventory.entries),
                      "downloadBytes": report["uniqueDownloadBytes"], "verification": verification}, ensure_ascii=True), flush=True)


if __name__ == "__main__":
    main()
