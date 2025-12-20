#!/bin/bash
# Wrapper script for save_to_database.py to be used with cron
# This ensures proper environment setup

# Get the directory where this script is located
CRON_SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(dirname "$CRON_SCRIPTS_DIR")"
BACKEND_DIR="$(dirname "$SCRIPTS_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

# Change to backend directory (where .env file is located)
cd "$BACKEND_DIR" || exit 1

# Use Python from virtual environment
PYTHON_BIN="$BACKEND_DIR/.venv/bin/python3"

# Verify venv Python exists
if [ ! -f "$PYTHON_BIN" ]; then
    echo "Error: Virtual environment Python not found at $PYTHON_BIN" >> "$BACKEND_DIR/logs/cron_save_to_database.log" 2>&1
    exit 1
fi

# Set Python path to include backend directory
export PYTHONPATH="$BACKEND_DIR:$PYTHONPATH"

# Run the script using venv Python (Python script is in parent scripts directory)
"$PYTHON_BIN" "$SCRIPTS_DIR/save_to_database.py" >> "$BACKEND_DIR/logs/cron_save_to_database.log" 2>&1
