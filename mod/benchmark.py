#!/usr/bin/env python3
"""Rebuild baseline and rejected direction prototype in scratch, then compare the same JVM fixtures."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(ROOT / "mod/build.py"), "--target", "1.7.10", "--test"], check=True)
cache = ROOT / ".cache/srbxpatch"
base_classes = cache / "1.7.10/classes"
work = ROOT / ".cache/lookup-benchmark"
source = Path("mod/src/main/java/jp/hi03/srbxpatch/FreeEndpointHook.java")
for variant in ("baseline", "prototype"):
    directory = work / variant
    (directory / source.parent).mkdir(parents=True, exist_ok=True)
    legacy_source = source.as_posix().replace("srbxpatch", "srbxmod")
    text = subprocess.check_output(["git", "show", "c76801f:" + legacy_source], cwd=ROOT).replace(b"srbxmod", b"srbxpatch").replace(b"SRBXMod", b"SRBXPatch") if variant == "baseline" else (ROOT / source).read_bytes()
    (directory / source).write_bytes(text)
    if variant == "prototype":
        subprocess.run(["patch", "--batch", "-p1", "-i", str(ROOT / "mod/benchmarks/direction-prototype.patch")], cwd=directory, check=True)
    classes = directory / "classes"
    classes.mkdir(exist_ok=True)
    javac = shutil.which("javac")
    if javac:
        version = subprocess.run([javac, "-version"], capture_output=True, text=True, check=True)
        options = ["-source", "8", "-target", "8"] if "javac 1.8." in version.stdout + version.stderr else ["--release", "8"]
        compiler = [javac, *options]
    else:
        compiler = ["java", "-jar", str(cache / "ecj.jar"), "-1.8"]
    subprocess.run([*compiler, "-proc:none", "-cp", str(base_classes), "-d", str(classes), str(directory / source)], check=True)
subprocess.run(["java", "-cp", str(base_classes), "jp.hi03.srbxpatch.LookupBenchmark", str(work / "baseline/classes"), str(work / "prototype/classes")], check=True)
