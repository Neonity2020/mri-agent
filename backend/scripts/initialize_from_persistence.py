#!/usr/bin/env python3
"""
Initialize the application from persistent storage.
This script should be run on startup to restore data from persistent storage.
"""

import os
import json
import shutil
from pathlib import Path

def initialize_from_persistence():
    """Restore data from persistent storage."""
    print("🚀 [Init] Starting initialization from persistent storage...")

    # Path to persistent storage
    data_dir = Path("./data")

    if not data_dir.exists():
        print("ℹ️ [Init] No persistent storage found. Starting fresh.")
        return

    # Create temporary directories if they don't exist
    os.makedirs("/tmp/mri_agent", exist_ok=True)
    os.makedirs("/tmp/mri_agent/images", exist_ok=True)
    os.makedirs("/tmp/mri_agent/exports", exist_ok=True)

    # Restore PDF file
    pdfs_dir = data_dir / "pdfs"
    if pdfs_dir.exists():
        pdf_files = list(pdfs_dir.glob("*.pdf"))
        if pdf_files:
            latest_pdf = max(pdf_files, key=lambda x: x.stat().st_mtime)
            temp_pdf_path = "/tmp/mri_agent" / latest_pdf.name

            if not temp_pdf_path.exists():
                print(f"📁 [Init] Restoring PDF: {latest_pdf.name}")
                shutil.copy2(latest_pdf, temp_pdf_path)

            # Restore TOC if it exists
            toc_cache_file = data_dir / "cache" / "toc_bilingual.json"
            if toc_cache_file.exists():
                temp_toc_path = "/tmp/mri_agent/toc_bilingual.json"
                print(f"📁 [Init] Restoring TOC: {toc_cache_file}")
                shutil.copy2(toc_cache_file, temp_toc_path)
                print(f"✅ [Init] TOC restored from {toc_cache_file}")

    # Restore other cache files
    cache_dir = data_dir / "cache"
    if cache_dir.exists():
        cache_files = [
            "calendar_cache.json",
        ]

        for cache_file in cache_files:
            source = cache_dir / cache_file
            target = f"/tmp/mri_agent/{cache_file}"

            if source.exists() and not os.path.exists(target):
                print(f"📁 [Init] Restoring cache: {cache_file}")
                shutil.copy2(source, target)

    print("✅ [Init] Initialization from persistent storage complete!")

if __name__ == "__main__":
    initialize_from_persistence()