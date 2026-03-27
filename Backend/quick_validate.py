#!/usr/bin/env python
"""Direct pytest validation."""
import subprocess
import sys
import os

os.chdir(r"c:\Users\ijdar\Desktop\coding\1. College Projects\parkandgo-v2\Backend")

# Run pytest
proc = subprocess.Popen(
    [sys.executable, "-m", "pytest", 
     "tests/test_services/test_recommendation_engine.py", 
     "-q"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True
)

stdout, _ = proc.communicate()

# Get last 500 chars to see result
print(stdout[-500:])
print(f"\nReturn code: {proc.returncode}")

if proc.returncode == 0:
    print("TESTS PASSED")
else:
    print("TESTS FAILED")
