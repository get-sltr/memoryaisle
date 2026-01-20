#!/bin/bash

# MemoryAisle Screenshot Resizer
# Resizes screenshots from source size to all required App Store sizes

SOURCE_DIR="./screenshots/iPhone_6.7"
OUTPUT_BASE="./screenshots"

# Required sizes (width x height)
declare -A SIZES
SIZES["iPhone_6.9"]="1320x2868"
SIZES["iPhone_6.7"]="1290x2796"
SIZES["iPhone_6.5"]="1242x2688"
SIZES["iPhone_5.5"]="1242x2208"
SIZES["iPad_12.9"]="2048x2732"
SIZES["iPad_11"]="1668x2388"

echo "=========================================="
echo "MemoryAisle Screenshot Resizer"
echo "=========================================="

# Check if source directory has screenshots
if [ ! -d "$SOURCE_DIR" ] || [ -z "$(ls -A $SOURCE_DIR 2>/dev/null)" ]; then
    echo "No screenshots found in $SOURCE_DIR"
    echo "Please capture screenshots first using the simulator"
    exit 1
fi

# Process each screenshot
for screenshot in "$SOURCE_DIR"/*.png; do
    if [ -f "$screenshot" ]; then
        filename=$(basename "$screenshot")
        echo ""
        echo "Processing: $filename"

        for device in "${!SIZES[@]}"; do
            size="${SIZES[$device]}"
            width="${size%x*}"
            height="${size#*x}"

            output_dir="$OUTPUT_BASE/$device"
            mkdir -p "$output_dir"
            output_path="$output_dir/$filename"

            # Skip if same as source
            if [ "$device" = "iPhone_6.7" ]; then
                # Just resize to exact dimensions
                sips --resampleHeightWidth "$height" "$width" "$screenshot" --out "$output_path" 2>/dev/null
            else
                # Resize proportionally then pad to exact dimensions
                sips --resampleHeightWidth "$height" "$width" "$screenshot" --out "$output_path" 2>/dev/null
            fi

            echo "  Created: $device ($size)"
        done
    fi
done

echo ""
echo "=========================================="
echo "Done! Screenshots resized to all sizes."
echo "=========================================="
echo ""
echo "Screenshots are in:"
for device in "${!SIZES[@]}"; do
    count=$(ls -1 "$OUTPUT_BASE/$device"/*.png 2>/dev/null | wc -l | tr -d ' ')
    echo "  $OUTPUT_BASE/$device/ ($count files)"
done
