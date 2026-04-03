import fitz  # PyMuPDF
from typing import List, Dict, Any
from pathlib import Path
import json

class PDFParser:
    """MVP PDF Parser using PyMuPDF to extract text."""
    
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        
    def extract_text(self) -> str:
        """Extract all text from the PDF."""
        return self.extract_text_range(0, -1)
    
    def extract_text_range(self, start_page: int, end_page: int) -> str:
        """Extract text from a specific range of pages (0-indexed)."""
        text_content = ""
        try:
            doc = fitz.open(self.pdf_path)
            total_pages = len(doc)
            
            actual_end = end_page if end_page != -1 and end_page < total_pages else total_pages
            
            for page_num in range(start_page, actual_end):
                page = doc.load_page(page_num)
                blocks = page.get_text("blocks")
                for b in blocks:
                    if b[4]:
                        text_content += b[4] + "\n"
        except Exception as e:
            print(f"Error parsing PDF range: {e}")
        return text_content
    
    def extract_images_range(self, start_page: int, end_page: int, output_dir: str) -> List[Dict[str, Any]]:
        """Extract images from a range of pages and return metadata."""
        import os
        os.makedirs(output_dir, exist_ok=True)
        images_metadata = []
        
        try:
            doc = fitz.open(self.pdf_path)
            total_pages = len(doc)
            actual_end = end_page if end_page != -1 and end_page < total_pages else total_pages
            
            for page_num in range(start_page, actual_end):
                page = doc.load_page(page_num)
                image_list = page.get_images(full=True)
                
                for img_index, img in enumerate(image_list):
                    xref = img[0]
                    filename = f"pg{page_num+1}_img{img_index}.png"
                    filepath = os.path.join(output_dir, filename)
                    
                    try:
                        pix = fitz.Pixmap(doc, xref)
                        cs_name = pix.colorspace.name if pix.colorspace else ""
                        
                        if pix.colorspace and pix.colorspace.n > 3:
                            # Multi-channel (CMYK etc.) → convert to RGB
                            pix = fitz.Pixmap(fitz.csRGB, pix)
                        elif "Separation" in cs_name:
                            # Separation/CMYK Black: converting to csGRAY automatically correctly 
                            # maps ink density to luminance (fixes negative effect)
                            pix = fitz.Pixmap(fitz.csGRAY, pix)
                        
                        pix.save(filepath)
                    except Exception as img_err:
                        print(f"Image extraction error (xref {xref}): {img_err}")
                        # Fallback: raw bytes
                        try:
                            base_image = doc.extract_image(xref)
                            with open(filepath, "wb") as f:
                                f.write(base_image["image"])
                        except Exception:
                            pass


                    
                    images_metadata.append({
                        "filename": filename,
                        "page": page_num + 1,
                        "index": img_index
                    })
        except Exception as e:
            print(f"Error extracting images: {e}")
            
        return images_metadata


    def extract_chapters(self) -> List[Dict[str, Any]]:
        """
        Heuristic to extract chapters. This is a stub for MVP.
        In reality, we would use Table of Contents (TOC) if available,
        or regex matching for chapter headers.
        """
        return chapters

    def get_structured_toc_string(self) -> str:
        """Extract the exact, structured Table of Contents from the PDF metadata."""
        try:
            doc = fitz.open(self.pdf_path)
            toc = doc.get_toc()
            if not toc:
                return "No structured Table of Contents found in the document metadata."
                
            lines = []
            for item in toc:
                lvl, title, page = item
                indent = "  " * (lvl - 1)
                lines.append(f"{indent}- {title} (Page {page})")
            return "\n".join(lines)
        except Exception as e:
            return f"Error extracting TOC: {e}"

# Example Concept Card data structure
from pydantic import BaseModel, Field

class ConceptCard(BaseModel):
    concept_name: str = Field(description="Name of the core concept")
    definition: str = Field(description="A concise definition in 1-2 sentences")
    key_points: List[str] = Field(description="3-5 bullet points covering the technical details")
    formulas: List[str] = Field(default=[], description="Any relevant physics formulas associated with the concept")
    common_misconceptions: str = Field(default="", description="Common mistakes or misunderstandings")

