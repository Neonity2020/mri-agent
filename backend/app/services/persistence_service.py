import os
import json
import pickle
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
import hashlib

class PersistenceService:
    """Service to handle persistence of application data across sessions."""

    def __init__(self, base_path: str = "./data"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(exist_ok=True)

        # Create subdirectories
        self.pdfs_dir = self.base_path / "pdfs"
        self.vectors_dir = self.base_path / "vectors"
        self.cache_dir = self.base_path / "cache"
        self.exports_dir = self.base_path / "exports"

        for dir_path in [self.pdfs_dir, self.vectors_dir, self.cache_dir, self.exports_dir]:
            dir_path.mkdir(exist_ok=True)

    def save_pdf(self, pdf_file_path: str, filename: str) -> str:
        """Save uploaded PDF to persistent storage."""
        source_path = Path(pdf_file_path)
        if not source_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_file_path}")

        # Generate unique filename to avoid conflicts
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{filename}"
        dest_path = self.pdfs_dir / unique_filename

        # Copy PDF to persistent storage
        shutil.copy2(source_path, dest_path)

        # Update TOC cache with new filename
        toc_path = "/tmp/mri_agent/toc_bilingual.json"
        if os.path.exists(toc_path):
            with open(toc_path, "r", encoding="utf-8") as f:
                toc_data = json.load(f)

            # Add PDF filename to TOC metadata
            if "pdf_filename" not in toc_data:
                toc_data["pdf_filename"] = unique_filename

            # Save updated TOC
            self.save_cache_file("toc_bilingual.json", toc_data)

        return str(dest_path)

    def get_pdf_path(self) -> Optional[str]:
        """Get the path to the most recently uploaded PDF."""
        if not self.pdfs_dir.exists():
            return None

        pdf_files = list(self.pdfs_dir.glob("*.pdf"))
        if not pdf_files:
            return None

        # Return the most recent PDF (sorted by modification time)
        latest_pdf = max(pdf_files, key=lambda x: x.stat().st_mtime)
        return str(latest_pdf)

    def save_cache_file(self, filename: str, data: Any) -> str:
        """Save cache data to persistent storage."""
        filepath = self.cache_dir / filename

        if filename.endswith('.json'):
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            with open(filepath, "wb") as f:
                pickle.dump(data, f)

        return str(filepath)

    def load_cache_file(self, filename: str) -> Optional[Any]:
        """Load cache data from persistent storage."""
        filepath = self.cache_dir / filename

        if not filepath.exists():
            return None

        try:
            if filename.endswith('.json'):
                with open(filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            else:
                with open(filepath, "rb") as f:
                    return pickle.load(f)
        except Exception as e:
            print(f"Error loading cache file {filename}: {e}")
            return None

    def list_cache_files(self) -> List[str]:
        """List all cache files."""
        if not self.cache_dir.exists():
            return []
        return [f.name for f in self.cache_dir.iterdir() if f.is_file()]

    def export_data(self, data: Dict[str, Any], export_name: str) -> str:
        """Export data for backup or migration."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{export_name}_{timestamp}.json"
        filepath = self.exports_dir / filename

        export_data = {
            "export_timestamp": timestamp,
            "export_name": export_name,
            "data": data
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        return str(filepath)

    def get_storage_stats(self) -> Dict[str, Any]:
        """Get statistics about storage usage."""
        stats = {
            "base_path": str(self.base_path),
            "pdfs": {
                "count": len(list(self.pdfs_dir.glob("*.pdf"))) if self.pdfs_dir.exists() else 0,
                "size_mb": sum(f.stat().st_size for f in self.pdfs_dir.glob("*.pdf")) / 1024 / 1024 if self.pdfs_dir.exists() else 0
            },
            "cache": {
                "count": len(list(self.cache_dir.iterdir())) if self.cache_dir.exists() else 0,
                "size_mb": sum(f.stat().st_size for f in self.cache_dir.iterdir()) / 1024 / 1024 if self.cache_dir.exists() else 0
            },
            "exports": {
                "count": len(list(self.exports_dir.iterdir())) if self.exports_dir.exists() else 0,
                "size_mb": sum(f.stat().st_size for f in self.exports_dir.iterdir()) / 1024 / 1024 if self.exports_dir.exists() else 0
            }
        }
        return stats

    def cleanup_old_files(self, days: int = 30) -> List[str]:
        """Remove cache and export files older than specified days."""
        cutoff_time = datetime.now().timestamp() - (days * 24 * 60 * 60)
        removed_files = []

        for directory in [self.cache_dir, self.exports_dir]:
            if directory.exists():
                for file_path in directory.iterdir():
                    if file_path.is_file() and file_path.stat().st_mtime < cutoff_time:
                        file_path.unlink()
                        removed_files.append(str(file_path))

        return removed_files