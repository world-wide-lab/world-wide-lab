#!/bin/bash

# This script will update the data of a replication destination.
# Please read the documentation for more information on how to
# configure World-Wide-Lab for replication.

# Stop script when a command fails
set -e

# --- Configuration ---
# Either set the API_KEY and BASE_URL in this script by
# uncommenting them or via environment variables
# The API key you use to authenticate with World-Wide-Lab
# API_KEY="your-api-key-here"
# Base URL where your API is running
# BASE_URL="http://localhost:8787"


# --- Script ---
echo "Updating replication data."
curl -s "$BASE_URL/v1/replication/destination/update" \
  -H "Authorization: Bearer $API_KEY"
echo "Done."
