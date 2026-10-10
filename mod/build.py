#!/usr/bin/env python3
"""Reproducible patch-only Java 8 JARs; no model pack or bundled dependencies."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import urllib.request
import urllib.error
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEPS = {
    "ecj.jar": ("https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.40.0/ecj-3.40.0.jar", "05cc22a24e7982970f63a405fc6c820bc80b806f27f3c5a6236fc475f8f7152b"),
    "asm-all.jar": ("https://repo.maven.apache.org/maven2/org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar", "09d44e6adddaab9fd89ea3164c439f71c755769fa8d3a940352ab3d2003b98ff"),
    "launchwrapper.jar": ("https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar", "57f402b626d16cc2705bf2a37add7adbb074f0ca3b3102fa6e23aa303dae682f"),
    "forge-1.7.10.jar": ("https://maven.minecraftforge.net/net/minecraftforge/forge/1.7.10-10.13.4.1614-1.7.10/forge-1.7.10-10.13.4.1614-1.7.10-universal.jar", "00d1ca02192c7efb87da95552ebf247021f1e1d642f86d0a03076314def11529"),
    "forge-1.12.2.jar": ("https://maven.minecraftforge.net/net/minecraftforge/forge/1.12.2-14.23.5.2860/forge-1.12.2-14.23.5.2860-universal.jar", "cd3fbf85d7ca744507fd6a37a41b90122d43e616a4f8962332b1b658655e8a64"),
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--core-only", action="store_true", help="compatibility alias; all JARs are patch-only")
    parser.add_argument("--target", choices=("all", "1.7.10", "1.12.2"), default="all")
    parser.add_argument("--test", action="store_true")
    parser.add_argument("--kaizpatch-jar", type=Path, help="verify transformed real KaizPatch bytecode")
    parser.add_argument("--appleextended-jar", type=Path, help="verify transformed real AppleExtended bytecode")
    args = parser.parse_args()
    cache = ROOT / ".cache/srbxpatch"
    cache.mkdir(parents=True, exist_ok=True)
    javac = shutil.which("javac")
    for name, (url, digest) in DEPS.items():
        if name.startswith("forge-") and args.target != "all" and name != "forge-" + args.target + ".jar":
            continue
        if name == "ecj.jar" and javac:
            continue
        path = cache / name
        if not path.exists():
            print("Downloading", name, flush=True)
            candidates = [url]
            if url.startswith("https://repo.maven.apache.org/maven2/"):
                suffix = url.split("/maven2/", 1)[1]
                candidates += ["https://maven.minecraftforge.net/" + suffix, "https://repo1.maven.org/maven2/" + suffix]
            for candidate in candidates:
                try:
                    request = urllib.request.Request(candidate, headers={"User-Agent": "SRBXPatch-build/1.0"})
                    with urllib.request.urlopen(request, timeout=30) as response:
                        path.write_bytes(response.read())
                    break
                except (urllib.error.URLError, TimeoutError) as error:
                    print("Download failed:", candidate, str(error), flush=True)
            if not path.exists():
                raise RuntimeError("Cannot download " + name)
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise RuntimeError("Dependency checksum mismatch: " + name)
    for target in (("1.7.10", "1.12.2") if args.target == "all" else (args.target,)):
        build(target, args, cache, javac)

def build(target, args, cache, javac):
    classes = cache / target / "classes"
    if not classes.resolve().is_relative_to(cache.resolve()):
        raise RuntimeError("Class output must remain within the build cache")
    shutil.rmtree(classes, ignore_errors=True)
    classes.mkdir(parents=True)
    cp = os.pathsep.join(str(cache / name) for name in ("asm-all.jar", "launchwrapper.jar", "forge-" + target + ".jar"))
    if target == "1.7.10":
        sources = sorted((ROOT / "mod/src/main/java").rglob("*.java"))
        tests = ROOT / "mod/src/test/java"
        test_class = "jp.hi03.srbxpatch.PatchTest"
        plugin = "SRBXLoadingPlugin"
        real_jar = args.kaizpatch_jar
    else:
        sources = sorted((ROOT / "mod/src/appleextended/java").rglob("*.java"))
        if not sources:
            raise RuntimeError("AppleExtended patch sources missing")
        sources.append(ROOT / "mod/src/main/java/jp/hi03/srbxpatch/EndpointGeometry.java")
        tests = ROOT / "mod/src/appleextended-test/java"
        test_class = "jp.hi03.srbxpatch.AEPatchTest"
        plugin = "AELoadingPlugin"
        real_jar = args.appleextended_jar
    if args.test:
        sources += sorted(tests.rglob("*.java"))
    if javac:
        version = subprocess.run([javac, "-version"], capture_output=True, text=True, check=True)
        options = ["-source", "8", "-target", "8"] if "javac 1.8." in version.stdout + version.stderr else ["--release", "8"]
        compiler = [javac, *options]
    else:
        compiler = ["java", "-jar", str(cache / "ecj.jar"), "-1.8"]
    subprocess.run([*compiler, "-encoding", "UTF-8", "-proc:none", "-cp", cp, "-d", str(classes), *map(str, sources)], check=True)
    if args.test:
        subprocess.run(["java", "-Xverify:all", "-cp", str(classes) + os.pathsep + cp, test_class, *([str(real_jar)] if real_jar else [])], check=True)
    artifacts = ROOT / "artifacts"
    artifacts.mkdir(exist_ok=True)
    name = "SRBXPatch-v1.0-" + target + ".jar"
    output = artifacts / name
    manifest = "Manifest-Version: 1.0\r\nFMLCorePlugin: jp.hi03.srbxpatch." + plugin + "\r\nFMLCorePluginContainsFMLMod: true\r\n\r\n"
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as jar:
        def put(name, data):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            jar.writestr(info, data)
        put("META-INF/MANIFEST.MF", manifest)
        for path in sorted((classes / "jp/hi03/srbxpatch").glob("*.class")):
            if path.name.startswith(("PatchTest", "AEPatchTest", "LookupBenchmark")):
                continue
            put(path.relative_to(classes).as_posix(), path.read_bytes())
        put("LICENSE-SRBX.txt", (ROOT / "LICENSE").read_bytes())
    with zipfile.ZipFile(output) as jar:
        assert not any(p.startswith(("assets/", "net/", "cpw/", "org/", "jp/ngt/")) for p in jar.namelist())
        assert not any(p.endswith((".json", ".js", ".png", ".mqo", ".obj")) for p in jar.namelist())
        for path in jar.namelist():
            if path.endswith(".class"):
                assert int.from_bytes(jar.read(path)[6:8], "big") == 52, path
    print("Built", output, hashlib.sha256(output.read_bytes()).hexdigest())

if __name__ == "__main__":
    main()
