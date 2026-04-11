#!/usr/bin/env python3
"""
Migrate existing data from /tmp/mri_agent to persistent storage.
Run this after upgrading to the new persistent version.
"""

import os
import shutil
import json
from pathlib import Path
from app.services.persistence_service import PersistenceService

def migrate_data():
    """Migrate existing data to persistent storage."""
    print("🔄 [Migration] Starting data migration...")

    # Initialize persistence service
    persistence_service = PersistenceService()

    # Source directory
    source_dir = Path("/tmp/mri_agent")

    if not source_dir.exists():
        print("ℹ️ [Migration] No source directory found. Nothing to migrate.")
        return

    # Migrate PDF
    pdf_files = list(source_dir.glob("*.pdf"))
    if pdf_files:
        print(f"📁 [Migration] Found {len(pdf_files)} PDF file(s)")
        for pdf_file in pdf_files:
            try:
                dest_path = persistence_service.save_pdf(str(pdf_file), pdf_file.name)
                print(f"✅ [Migration] Migrated PDF: {pdf_file.name} -> {dest_path}")
            except Exception as e:
                print(f"❌ [Migration] Failed to migrate PDF {pdf_file.name}: {e}")

    # Migrate TOC
    toc_file = source_dir / "toc_bilingual.json"
    if toc_file.exists():
        try:
            with open(toc_file, "r", encoding="utf-8") as f:
                toc_data = json.load(f)
            persistence_service.save_cache_file("toc_bilingual.json", toc_data)
            print(f"✅ [Migration] Migrated TOC")
        except Exception as e:
            print(f"❌ [Migration] Failed to migrate TOC: {e}")

    # Migrate other cache files
    cache_files = ["calendar_cache.json"]
    for cache_file in cache_files:
        source_file = source_dir / cache_file
        if source_file.exists():
            try:
                with open(source_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                persistence_service.save_cache_file(cache_file, data)
                print(f"✅ [Migration] Migrated cache: {cache_file}")
            except Exception as e:
                print(f"❌ [Migration] Failed to migrate cache {cache_file}: {e}")

    # Migrate chapter markdown files
    md_files = list(source_dir.glob("web_*_v2.md"))
    for md_file in md_files:
        try:
            # Extract chapter name from filename
            chapter_name = md_file.stem.replace("web_", "").replace("_v2", "")
            with open(md_file, "r", encoding="utf-8") as f:
                content = f.read()

            # Save as cache
            persistence_service.save_cache_file(f"webified_{chapter_name}.md", content)
            print(f"✅ [Migration] Migrated chapter: {chapter_name}")
        except Exception as e:
            print(f"❌ [Migration] Failed to migrate chapter {md_file}: {e}")

    print("✅ [Migration] Data migration complete!")

if __name__ == "__main__":
    migrate_data()