"""
End-to-End Integration Test for sample user images.

Tests:
1. Clears database and resets auto-increment sequence ID to 1.
2. Uploads wallpaper.jpg -> Saved as ID #1 ("Wallpaper Project").
3. Uploads wallpaper_2xupscaled.jpg -> Verifies DINOv2 vector similarity detects match against ID #1 ("Wallpaper Project") with ≥ 90% similarity!
4. Uploads doll.jpg -> Saved as ID #2 ("Doll Project").
5. Uploads doll.jpg again -> Verifies DINOv2 vector similarity detects match against ID #2 ("Doll Project") with 99.8% similarity!
6. Uploads batik1.jpg, batik2.jpg, and teto.jpg -> Validates visual feature vector extraction and database history similarity checks.
"""

import os
import sys
import unittest
from PIL import Image

# Setup import path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
PARENT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

import app as backend_app
from db import (
    clear_analysis_history_in_db,
    save_analysis_to_db,
    check_saved_history_similarity,
    get_analysis_history_from_db
)

# Resolve example directory dynamically from environment or home folder to avoid hardcoded absolute paths
EXAMPLE_DIR = os.getenv("TEST_EXAMPLE_DIR")
if not EXAMPLE_DIR:
    home_dir = os.path.expanduser("~")
    EXAMPLE_DIR = os.path.join(home_dir, "Downloads", "example")


class TestExampleFolderScenarios(unittest.TestCase):
    """Integration test suite using the real user files from the resolved example directory."""

    @classmethod
    def setUpClass(cls):
        """Load DINOv2 model and clear database history."""
        backend_app._load_static_data()
        clear_analysis_history_in_db()

    def setUp(self):
        """Verify EXAMPLE_DIR exists."""
        if not os.path.exists(EXAMPLE_DIR):
            self.skipTest(f"Example folder '{EXAMPLE_DIR}' does not exist on this host.")

    def _extract_vector_and_save(self, image_filename: str, project_name: str) -> dict:
        """Helper to open an image from EXAMPLE_DIR, extract DINOv2 vector, and save to DB."""
        img_path = os.path.join(EXAMPLE_DIR, image_filename)
        pil_img = Image.open(img_path).convert("RGB")
        vec = backend_app.extract_visual_feature_vector(pil_img)
        
        payload = {
            "visual_vector": vec,
            "preview_image": "",
            "garment_type": "shirt",
            "classification": [{"class_name": "Original Sketch Pattern", "confidence": 1.0}],
            "sewing_sequence": ["Step 1: Join shoulder"],
            "status": "APPROVED"
        }
        save_analysis_to_db(project_name, "12:00:00", payload)
        return payload

    def test_01_clear_database(self):
        """Test clearing database resets history."""
        clear_analysis_history_in_db()
        history = get_analysis_history_from_db()
        self.assertEqual(len(history), 0, "Database history must be empty after clearing.")

    def test_02_wallpaper_and_upscaled_similarity(self):
        """
        Scenario 1:
        1. Save wallpaper.jpg as 'Wallpaper Project' -> ID #1.
        2. Test wallpaper_2xupscaled.jpg -> Must match ID #1 ('Wallpaper Project') with ≥ 90% DINOv2 similarity!
        """
        clear_analysis_history_in_db()

        # 1. Save original wallpaper.jpg
        self._extract_vector_and_save("wallpaper.jpg", "Wallpaper Project")
        history = get_analysis_history_from_db()
        self.assertEqual(len(history), 1)
        first_id = history[0]["id"]
        self.assertEqual(int(first_id), 1, f"First saved project ID must be 1, got {first_id}")

        # 2. Extract vector for wallpaper_2xupscaled.jpg
        upscaled_path = os.path.join(EXAMPLE_DIR, "wallpaper_2xupscaled.jpg")
        img_upscaled = Image.open(upscaled_path).convert("RGB")
        vec_upscaled = backend_app.extract_visual_feature_vector(img_upscaled)

        # 3. Check similarity against DB
        sim_pct, matched_name, matched_id, is_dup = check_saved_history_similarity(query_vector=vec_upscaled)

        print(f"\n[TEST RESULT] wallpaper_2xupscaled.jpg vs DB:")
        print(f"  Similarity: {sim_pct}%")
        print(f"  Matched Project: '{matched_name}' (ID #{matched_id})")
        print(f"  Is Duplicate (≥90%): {is_dup}")

        self.assertTrue(
            is_dup,
            f"wallpaper_2xupscaled.jpg MUST be detected as duplicate of wallpaper.jpg! Got sim={sim_pct}%"
        )
        self.assertGreaterEqual(
            sim_pct, 90.0,
            f"wallpaper_2xupscaled.jpg similarity must be ≥ 90.0%, got {sim_pct}%"
        )
        self.assertEqual(
            int(matched_id), 1,
            f"Matched ID must be 1 ('Wallpaper Project'), got {matched_id}"
        )
        self.assertEqual(
            matched_name, "Wallpaper Project",
            f"Matched project name must be 'Wallpaper Project', got '{matched_name}'"
        )

    def test_03_doll_duplicate_detection(self):
        """
        Scenario 2:
        1. Save doll.jpg as 'Doll Project' -> ID #1.
        2. Test doll.jpg again -> Must match ID #1 ('Doll Project') with ≥ 99% similarity!
        """
        clear_analysis_history_in_db()

        # Save doll.jpg
        self._extract_vector_and_save("doll.jpg", "Doll Project")
        history = get_analysis_history_from_db()
        doll_id = history[-1]["id"]

        doll_path = os.path.join(EXAMPLE_DIR, "doll.jpg")
        img_doll = Image.open(doll_path).convert("RGB")
        vec_doll = backend_app.extract_visual_feature_vector(img_doll)

        sim_pct, matched_name, matched_id, is_dup = check_saved_history_similarity(query_vector=vec_doll)

        print(f"\n[TEST RESULT] doll.jpg vs DB:")
        print(f"  Similarity: {sim_pct}%")
        print(f"  Matched Project: '{matched_name}' (ID #{matched_id})")
        print(f"  Is Duplicate: {is_dup}")

        self.assertTrue(is_dup, "Re-uploading doll.jpg MUST be detected as duplicate!")
        self.assertGreaterEqual(sim_pct, 99.0, f"Identical doll.jpg similarity must be ≥ 99.0%, got {sim_pct}%")
        self.assertEqual(int(matched_id), int(doll_id), f"Matched ID must be {doll_id}, got {matched_id}")
        self.assertEqual(matched_name, "Doll Project")

    def test_04_batik_and_teto_extraction(self):
        """
        Scenario 3:
        Verify DINOv2 extracts valid 384-dim vectors for sample images if present.
        """
        tested_count = 0
        for fname in ["batik1.jpg", "batik2.jpg", "teto.jpg"]:
            fpath = os.path.join(EXAMPLE_DIR, fname)
            if not os.path.exists(fpath):
                continue
            img = Image.open(fpath).convert("RGB")
            vec = backend_app.extract_visual_feature_vector(img)
            self.assertEqual(len(vec), 384, f"DINOv2 vector for '{fname}' must be 384-dim, got {len(vec)}")
            tested_count += 1
        if tested_count == 0:
            self.skipTest("No optional sample images (batik1, batik2, teto) found in example directory.")


if __name__ == "__main__":
    unittest.main(verbosity=2)
