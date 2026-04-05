"""
Split the MRI textbook PDF into per-chapter files.

Usage:
    python split_chapters.py

Output:
    chapters/01_MRI魅力.pdf
    chapters/02_迷惑.pdf
    ...
"""

import fitz
import os

PDF_PATH = "MRI from Picture to Proton 3rd editon.pdf"
OUTPUT_DIR = "chapters"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    total_pages = len(doc)
    toc = doc.get_toc()

    # Collect L1 chapter entries (skip 版权/目录/词汇表)
    chapters = []
    for item in toc:
        level, title, page = item
        if level != 1:
            continue
        # Skip non-chapter front matter
        if any(skip in title for skip in ["版权", "目录", "词汇表"]):
            continue
        chapters.append((title, page))

    print(f"Found {len(chapters)} chapters in {total_pages}-page PDF\n")

    for i, (title, start_page) in enumerate(chapters):
        # PDF pages are 1-indexed in TOC, fitz uses 0-indexed
        start = start_page - 1

        # End is the start of the next chapter, or end of document
        if i + 1 < len(chapters):
            end = chapters[i + 1][1] - 1  # next chapter start (exclusive)
        else:
            end = total_pages

        # Sanitize title for filename
        safe_title = title.replace("/", "_").replace("\\", "_").replace(" ", "_")
        num = f"{i + 1:02d}"
        filename = f"{num}_{safe_title}.pdf"
        filepath = os.path.join(OUTPUT_DIR, filename)

        # Extract chapter pages into a new PDF
        chapter_doc = fitz.open()
        chapter_doc.insert_pdf(doc, from_page=start, to_page=end - 1)
        chapter_doc.save(filepath)
        chapter_doc.close()

        page_count = end - start
        print(f"  {filename:40s}  pages {start+1}-{end}  ({page_count} pages)")

    doc.close()
    print(f"\nDone. {len(chapters)} chapter PDFs saved to ./{OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
