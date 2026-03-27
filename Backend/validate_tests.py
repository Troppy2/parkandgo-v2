#!/usr/bin/env python
"""Quick test validation - just tells us pass/fail."""
import subprocess
import sys

# Run pytest
result = subprocess.run(
    [sys.executable, "-m", "pytest", 
     "tests/test_services/test_recommendation_engine.py", 
     "-v", "--tb=no"],
    capture_output=True,
    text=True
)

# Print result
if result.returncode == 0:
    print("[SUCCESS] All tests PASSED!")
    print(result.stdout[-1000:])  # Last 1000 chars
    sys.exit(0)
else:
    print("[FAILED] Tests failed with return code:", result.returncode)
    print(result.stdout[-2000:])  # Last 2000 chars to see failure
    sys.exit(1)
