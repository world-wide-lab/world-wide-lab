#!/bin/bash

# This script will export data for all your studies
# in World-Wide-Lab in multiple formats

# Stop script when a command fails
set -e

# --- Configuration ---
# Either set the API_KEY and BASE_URL in this script by
# uncommenting them or via environment variables
# The API key you use to authenticate with World-Wide-Lab
# API_KEY="your-api-key-here"
# Base URL where your API is running
# BASE_URL="http://localhost:8787"

# List of data types to export (this can be left as-is)
datatypes=(
  "sessions-raw"
  "participants-raw"
  "responses-raw"
  "responses-extracted-payload"
)

# --- Script ---

# Get a list of all study ids
study_ids=$(curl -s "$BASE_URL/v1/study/list" | jq -r '.[].studyId')

# Export data for every study
echo "Exporting data for all studies."
mkdir -p data
for study_id in $study_ids
do
  # Export different kinds of data
  for datatype in "${datatypes[@]}"
  do
    echo "Exporting $datatype for study $study_id."
    curl -s "$BASE_URL/v1/study/$study_id/data/$datatype/csv" \
      -H "Authorization: Bearer $API_KEY" \
      -o "data/wwl--$study_id--data--$datatype.csv"
    echo "Done."
  done
done
echo "Export completed successfully."
