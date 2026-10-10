#!/usr/bin/env python3
"""Reproducible Java-8 coremod build. Uses ECJ; no ForgeGradle or local JDK paths."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEPS = {
    "ecj.jar": ("https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.40.0/ecj-3.40.0.jar", "05cc22a24e7982970f63a405fc6c820bc80b806f27f3c5a6236fc475f8f7152b"),
    "asm-all.jar": ("https://repo.maven.apache.org/maven2/org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar", "09d44e6adddaab9fd89ea3164c439f71c755769fa8d3a940352ab3d2003b98ff"),
    "launchwrapper.jar": ("https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar", "57f402b626d16cc2705bf2a37add7adbb074f0ca3b3102fa6e23aa303dae682f"),
    "forge.jar": ("https://maven.minecraftforge.net/net/minecraftforge/forge/1.7.10-10.13.4.1614-1.7.10/forge-1.7.10-10.13.4.1614-1.7.10-universal.jar", "00d1ca02192c7efb87da95552ebf247021f1e1d642f86d0a03076314def11529"),
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--core-only", action="store_true", help="test artifact without model pack")
    parser.add_argument("--test", action="store_true")
    args = parser.parse_args()
    cache = ROOT / ".cache/srbxmod"
    cache.mkdir(parents=True, exist_ok=True)
    for name, (url, digest) in DEPS.items():
        path = cache / name
        if not path.exists():
            with urllib.request.urlopen(url, timeout=60) as response:
                path.write_bytes(response.read())
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise RuntimeError("Dependency checksum mismatch: " + name)
    classes = ROOT / ".cache/srbxmod/classes"
    shutil.rmtree(classes, ignore_errors=True)
    classes.mkdir()
    cp = os.pathsep.join(str(cache / name) for name in DEPS if name != "ecj.jar")
    sources = sorted((ROOT / "mod/src/main/java").rglob("*.java"))
    if args.test:
        sources += sorted((ROOT / "mod/src/test/java").rglob("*.java"))
    subprocess.run(["java", "-jar", str(cache / "ecj.jar"), "-1.8", "-encoding", "UTF-8", "-proc:none", "-cp", cp, "-d", str(classes), *map(str, sources)], check=True)
    if args.test:
        subprocess.run(["java", "-Xverify:all", "-cp", str(classes) + os.pathsep + cp, "jp.hi03.srbxmod.PatchTest"], check=True)
    dist = ROOT / "dist"
    if not args.core_only and not (dist / "assets/minecraft/scripts/superrailbuilderx/render_builder1.js").is_file():
        raise RuntimeError("Generated SRBX is missing. Run pnpm gen && pnpm build first (or --core-only for tests).")
    artifacts = ROOT / "artifacts"
    artifacts.mkdir(exist_ok=True)
    name = "SRBXMod-0.1.0-experimental" + ("-core-only" if args.core_only else "") + ".jar"
    output = artifacts / name
    manifest = "Manifest-Version: 1.0\r\nFMLCorePlugin: jp.hi03.srbxmod.SRBXLoadingPlugin\r\nFMLCorePluginContainsFMLMod: true\r\n\r\n"
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as jar:
        jar.writestr("META-INF/MANIFEST.MF", manifest)
        for path in sorted((classes / "jp/hi03/srbxmod").glob("*.class")):
            if path.name.startswith("PatchTest"):
                continue
            jar.write(path, path.relative_to(classes).as_posix())
        jar.write(ROOT / "LICENSE", "LICENSE-SRBX.txt")
        if not args.core_only:
            for path in sorted(dist.rglob("*")):
                if path.is_file():
                    jar.write(path, path.relative_to(dist).as_posix())
    with zipfile.ZipFile(output) as jar:
        assert not any(p.startswith(("net/minecraft/", "cpw/", "org/objectweb/", "jp/ngt/")) for p in jar.namelist())
        for path in jar.namelist():
            if path.endswith(".class"):
                assert int.from_bytes(jar.read(path)[6:8], "big") == 52, path
    print("Built", output, hashlib.sha256(output.read_bytes()).hexdigest())

if __name__ == "__main__":
    main()
