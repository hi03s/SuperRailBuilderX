#!/usr/bin/env python3
"""Rebuild baseline and rejected direction prototype in scratch, then compare the same JVM fixtures."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
subprocess.run(["python3", str(ROOT / "mod/build.py"), "--core-only", "--test"], check=True)
cache = ROOT / ".cache/srbxmod"
work = ROOT / ".cache/lookup-benchmark"
source = Path("mod/src/main/java/jp/hi03/srbxmod/FreeEndpointHook.java")
for variant in ("baseline", "prototype"):
    directory = work / variant
    (directory / source.parent).mkdir(parents=True, exist_ok=True)
    text = subprocess.check_output(["git", "show", "c76801f:" + source.as_posix()], cwd=ROOT) if variant == "baseline" else (ROOT / source).read_bytes()
    (directory / source).write_bytes(text)
    if variant == "prototype":
        subprocess.run(["patch", "--batch", "-p1", "-i", str(ROOT / "mod/benchmarks/direction-prototype.patch")], cwd=directory, check=True)
    classes = directory / "classes"
    classes.mkdir(exist_ok=True)
    javac = shutil.which("javac")
    compiler = [javac, "--release", "8"] if javac else ["java", "-jar", str(cache / "ecj.jar"), "-1.8"]
    subprocess.run([*compiler, "-proc:none", "-cp", str(cache / "classes"), "-d", str(classes), str(directory / source)], check=True)
subprocess.run(["java", "-cp", str(cache / "classes"), "jp.hi03.srbxmod.LookupBenchmark", str(work / "baseline/classes"), str(work / "prototype/classes")], check=True)
