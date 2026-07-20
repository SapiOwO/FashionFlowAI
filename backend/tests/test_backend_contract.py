"""
Regression tests for FashionFlow AI backend data contracts.

Validates that:
- Each garment template produces the correct number of steps.
- No T-Shirt step contains zipper or hood operations.
- tooling_recommendations is a unique, ordered subset of machines from sewing_sequence_detailed.
- All template machine types resolve to a real catalog entry (no UNRESOLVED).
- Garment type normalization maps correctly.
"""

import json
import os
import sys
import unittest

# Ensure backend/ directory is on the import path regardless of CWD
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
# tests/ is inside backend/, so the project root is two levels up
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, "..", ".."))
# Keep ROOT_DIR as project root for data/ access
ROOT_DIR = PROJECT_ROOT
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
# Also add parent of tests/ (i.e. backend/) explicitly for app module discovery
PARENT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

# Load app module (triggers _load_static_data at import time)
import app as backend_app


class TestGarmentTemplateStepCounts(unittest.TestCase):
    """Verify each garment template produces exactly the expected step count."""

    EXPECTED_STEPS = {
        "shirt": 8,
        "tshirt": 4,
        "jacket": 6,
        "pants": 6,
        "skirt": 4,
        "dress": 5,
    }

    @classmethod
    def setUpClass(cls):
        templates_path = os.path.join(ROOT_DIR, "data", "sewing_templates.json")
        with open(templates_path, "r", encoding="utf-8") as f:
            cls.templates = json.load(f)

    def test_tshirt_step_count(self):
        steps = self.templates.get("tshirt", {}).get("steps", [])
        self.assertEqual(len(steps), 4, f"T-Shirt must have exactly 4 steps, got {len(steps)}")

    def test_shirt_step_count(self):
        steps = self.templates.get("shirt", {}).get("steps", [])
        self.assertEqual(len(steps), 8, f"Shirt must have exactly 8 steps, got {len(steps)}")

    def test_jacket_step_count(self):
        steps = self.templates.get("jacket", {}).get("steps", [])
        self.assertEqual(len(steps), 6, f"Jacket must have exactly 6 steps, got {len(steps)}")

    def test_pants_step_count(self):
        steps = self.templates.get("pants", {}).get("steps", [])
        self.assertEqual(len(steps), 6, f"Pants must have exactly 6 steps, got {len(steps)}")

    def test_skirt_step_count(self):
        steps = self.templates.get("skirt", {}).get("steps", [])
        self.assertEqual(len(steps), 4, f"Skirt must have exactly 4 steps, got {len(steps)}")

    def test_dress_step_count(self):
        steps = self.templates.get("dress", {}).get("steps", [])
        self.assertEqual(len(steps), 5, f"Dress must have exactly 5 steps, got {len(steps)}")


class TestTShirtTemplateContent(unittest.TestCase):
    """Verify T-Shirt steps contain no jacket-specific operations."""

    FORBIDDEN_KEYWORDS = ["zipper", "zip", "hood", "lining", "outerwear", "bartack", "flap"]

    @classmethod
    def setUpClass(cls):
        templates_path = os.path.join(ROOT_DIR, "data", "sewing_templates.json")
        with open(templates_path, "r", encoding="utf-8") as f:
            cls.templates = json.load(f)

    def test_no_jacket_operations_in_tshirt(self):
        steps = self.templates.get("tshirt", {}).get("steps", [])
        for step in steps:
            op_lower = step["operation"].lower()
            for kw in self.FORBIDDEN_KEYWORDS:
                self.assertNotIn(
                    kw,
                    op_lower,
                    f"T-Shirt step {step['step_num']} contains forbidden keyword '{kw}': '{step['operation']}'"
                )


class TestMachineResolver(unittest.TestCase):
    """Verify multi-tier machine resolver produces valid results for all template types."""

    MACHINE_TYPES = [
        "1-needle Lockstitch",
        "Overlock / Safety Stitch",
        "Coverstitch / Interlock",
        "Bartacking / Button Sewing",
    ]
    FABRIC_WEIGHTS = ["Light-weight", "Medium-weight", "Heavy-weight"]

    def test_all_template_machine_types_resolve(self):
        """Every machine type used in any template must resolve to a non-UNRESOLVED match."""
        for machine_type in self.MACHINE_TYPES:
            for weight in self.FABRIC_WEIGHTS:
                with self.subTest(machine_type=machine_type, weight=weight):
                    result = backend_app.resolve_machine_for_step(machine_type, weight)
                    self.assertNotEqual(
                        result["name"],
                        "UNRESOLVED",
                        f"Machine type '{machine_type}' with weight '{weight}' returned UNRESOLVED"
                    )
                    self.assertNotEqual(result["name"], "", "Resolved machine name must not be empty")

    def test_resolver_preferred_model_takes_tier1(self):
        """Lockstitch resolver Tier 1 should prefer DDL-9000C."""
        result = backend_app.resolve_machine_for_step("1-needle Lockstitch", "Medium-weight")
        # Tier 1 preferred models for Lockstitch: DDL-9000C, LH-4500C, DDL-8000C
        preferred = ["DDL-9000C", "LH-4500C", "DDL-8000C"]
        self.assertIn(result["name"], preferred, f"Expected Tier 1 preferred model, got {result['name']}")

    def test_resolver_overlock_type(self):
        """Overlock resolver must not return a Lockstitch machine."""
        result = backend_app.resolve_machine_for_step("Overlock / Safety Stitch", "Medium-weight")
        self.assertNotIn("Lockstitch", result.get("desc", ""), "Overlock resolver should not match Lockstitch machines")

    def test_resolver_includes_needle_and_speed_attributes(self):
        """Resolver must return needle, speed, and application attributes."""
        result = backend_app.resolve_machine_for_step("1-needle Lockstitch", "Medium-weight")
        self.assertIn("needle", result, "Resolved machine must include needle attribute")
        self.assertIn("speed", result, "Resolved machine must include speed attribute")
        self.assertIn("application", result, "Resolved machine must include application attribute")
        self.assertNotEqual(result["needle"], "", "Needle attribute must not be empty")


class TestBuildSewingSequence(unittest.TestCase):
    """Validate build_sewing_sequence produces correct canonical outputs."""

    @classmethod
    def setUpClass(cls):
        templates_path = os.path.join(ROOT_DIR, "data", "sewing_templates.json")
        with open(templates_path, "r", encoding="utf-8") as f:
            cls.templates = json.load(f)

    def test_tshirt_sequence_has_4_steps(self):
        seq, smv, _ = backend_app.build_sewing_sequence("tshirt", "Medium-weight", self.templates)
        self.assertEqual(len(seq), 4, f"T-Shirt sequence must have 4 steps, got {len(seq)}")

    def test_shirt_sequence_has_8_steps(self):
        seq, smv, _ = backend_app.build_sewing_sequence("shirt", "Medium-weight", self.templates)
        self.assertEqual(len(seq), 8, f"Shirt sequence must have 8 steps, got {len(seq)}")

    def test_sequence_fields_present(self):
        seq, _, _ = backend_app.build_sewing_sequence("tshirt", "Medium-weight", self.templates)
        for step in seq:
            for key in ["step_num", "operation", "machine_type", "recommended_model", "recommended_desc", "recommended_file", "presser_foot", "stitch_spec"]:
                self.assertIn(key, step, f"Step is missing key '{key}'")

    def test_no_tshirt_step_has_zipper_operation(self):
        seq, _, _ = backend_app.build_sewing_sequence("tshirt", "Medium-weight", self.templates)
        for step in seq:
            self.assertNotIn("zipper", step["operation"].lower(), f"T-Shirt step has zipper: {step['operation']}")
            self.assertNotIn("hood", step["operation"].lower(), f"T-Shirt step has hood: {step['operation']}")

    def test_sewing_sequence_operation_details(self):
        """Verify presser_foot and stitch_spec are correctly derived."""
        seq, _, _ = backend_app.build_sewing_sequence("jacket", "Denim (Heavy-weight)", self.templates)
        for step in seq:
            self.assertIsNotNone(step.get("presser_foot"))
            self.assertIn("SPI", step.get("stitch_spec", ""))
            self.assertEqual(step.get("stitch_spec"), "3.5 mm (7 SPI)")


class TestDerivToolingFromSequence(unittest.TestCase):
    """Validate that tooling_recommendations is correctly derived from sewing_sequence_detailed."""

    @classmethod
    def setUpClass(cls):
        templates_path = os.path.join(ROOT_DIR, "data", "sewing_templates.json")
        with open(templates_path, "r", encoding="utf-8") as f:
            cls.templates = json.load(f)

    def test_tooling_is_subset_of_sequence_models(self):
        """Every tooling card model must appear in sewing_sequence_detailed."""
        seq, _, _ = backend_app.build_sewing_sequence("shirt", "Medium-weight", self.templates)
        tooling = backend_app.derive_tooling_from_sequence(seq)
        seq_models = {s["recommended_model"] for s in seq}
        for card in tooling:
            self.assertIn(card["name"], seq_models, f"Tooling card '{card['name']}' not in sewing sequence models")

    def test_tooling_is_unique(self):
        """No duplicate model names in tooling_recommendations."""
        seq, _, _ = backend_app.build_sewing_sequence("jacket", "Heavy-weight", self.templates)
        tooling = backend_app.derive_tooling_from_sequence(seq)
        names = [t["name"] for t in tooling]
        self.assertEqual(len(names), len(set(names)), f"Duplicate model names in tooling_recommendations: {names}")

    def test_tooling_matches_unique_sequence_machines(self):
        """Tooling count must equal number of unique machines in the sewing sequence."""
        seq, _, _ = backend_app.build_sewing_sequence("pants", "Medium-weight", self.templates)
        tooling = backend_app.derive_tooling_from_sequence(seq)
        unique_seq_models = list(dict.fromkeys(s["recommended_model"] for s in seq if s["recommended_model"] != "UNRESOLVED"))
        self.assertEqual(
            len(tooling), len(unique_seq_models),
            f"Tooling count ({len(tooling)}) must equal unique sequence machines ({len(unique_seq_models)})"
        )

    def test_no_unresolved_in_tooling(self):
        """UNRESOLVED machines must not appear as tooling recommendation cards."""
        seq, _, _ = backend_app.build_sewing_sequence("shirt", "Medium-weight", self.templates)
        tooling = backend_app.derive_tooling_from_sequence(seq)
        for card in tooling:
            self.assertNotEqual(card["name"], "UNRESOLVED", "UNRESOLVED machine appeared in tooling cards")


class TestNormalizeGarmentKey(unittest.TestCase):
    """Verify garment key normalization covers all label variants."""

    CASES = [
        ("Shirt", "shirt"),
        ("T-Shirt", "tshirt"),
        ("T-shirt", "tshirt"),
        ("Kaos (T-Shirt)", "tshirt"),
        ("Jacket", "jacket"),
        ("Jaket / Outerwear", "jacket"),
        ("Pants", "pants"),
        ("Celana Panjang (Pants)", "pants"),
        ("Skirt", "skirt"),
        ("Rok (Skirt)", "skirt"),
        ("Dress", "dress"),
        ("Gaun / Dress", "dress"),
    ]

    def test_all_garment_label_variants(self):
        for raw_label, expected_key in self.CASES:
            with self.subTest(raw_label=raw_label):
                result = backend_app.normalize_garment_key(raw_label)
                self.assertEqual(result, expected_key, f"'{raw_label}' expected key '{expected_key}', got '{result}'")


class TestDollProjectSetup(unittest.TestCase):
    """Validate doll-oriented multi-fabric API calculations and output formatting."""

    def test_hat_normalization(self):
        self.assertEqual(backend_app.normalize_garment_key("hat"), "hat")
        self.assertEqual(backend_app.normalize_garment_key("cap"), "hat")
        self.assertEqual(backend_app.normalize_garment_key("topi"), "hat")

    def test_doll_process_sheet_math_and_dedup(self):
        # We can directly instantiate and call backend_app.generate_doll_sheet
        # or use FastAPI test client, but a direct function/dictionary call is cleaner for core validation.
        payload = {
            "project_name": "Test Teddy Outset",
            "doll_type": "Classic Teddy Bear",
            "message": "Consolidated doll clothing process sheet for Classic Teddy Bear.",
            "components": [
                {
                    "garment_type": "jacket",
                    "fabric_weight": "Denim (Heavy-weight)",
                    "preview_image": "test_jacket.png",
                    "classification_name": "Batik Parang",
                    "similarity_percentage": 15.5,
                    "similarity_status": "Approved"
                },
                {
                    "garment_type": "pants",
                    "fabric_weight": "Cotton (Medium-weight)",
                    "preview_image": "test_pants.png",
                    "classification_name": "Batik Kawung",
                    "similarity_percentage": 22.0,
                    "similarity_status": "Approved"
                },
                {
                    "garment_type": "hat",
                    "fabric_weight": "Silk (Light-weight)",
                    "preview_image": "test_hat.png",
                    "classification_name": "Batik Bali",
                    "similarity_percentage": 10.5,
                    "similarity_status": "Approved"
                }
            ]
        }

        # Directly call backend_app.generate_doll_process_sheet with DollSheetRequest schema object
        request_obj = backend_app.DollSheetRequest(**payload)
        data = backend_app.generate_doll_process_sheet(request_obj)

        self.assertTrue(data["is_doll_project"])
        self.assertEqual(data["doll_type"], "Classic Teddy Bear")
        self.assertEqual(data["project_details"]["name"], "Test Teddy Outset")

        # Total steps count must be jacket (6) + pants (6) + hat (5) = 17 steps
        sewing_seq = data["sewing_sequence_detailed"]
        self.assertEqual(len(sewing_seq), 17)

        # Confirm step_num order from 1 to 17
        for idx, step in enumerate(sewing_seq):
            self.assertEqual(step["step_num"], idx + 1)
            self.assertIn("component", step)

        # De-duplication check: recommended machinery count should be unique models
        tooling = data["tooling_recommendations"]
        tooling_names = [t["name"] for t in tooling]
        self.assertEqual(len(tooling_names), len(set(tooling_names)), "Machinery recommendations must be unique")

        # Check total SMV range sums up correctly
        # Jacket: 22.5, Pants: 15.8, Hat: 7.2 -> 22.5 + 15.8 + 7.2 = 45.5 mins
        self.assertEqual(data["smv_range"], "45.5 mins")
        self.assertEqual(data["smv_breakdown"]["jacket"], "22.5 mins")
        self.assertEqual(data["smv_breakdown"]["pants"], "15.8 mins")
        self.assertEqual(data["smv_breakdown"]["hat"], "7.2 mins")



class TestDINOv2FeatureExtractor(unittest.TestCase):
    """
    Validate Meta DINOv2 Small (dinov2_vits14) visual embedding extractor.

    These tests verify Pipeline B (Visual Retrieval) data contract:
    - Output dimension matches vector(384) database schema.
    - Output vector is L2-normalized (unit norm).
    - Identical images produce cosine similarity == 1.0.
    - Visually unrelated images produce cosine similarity < 0.92 (below rejection threshold).
    """

    @classmethod
    def setUpClass(cls):
        """Pre-load DINOv2 model once for the test class via app startup cache."""
        from PIL import Image
        import numpy as np
        # Ensure DINOv2 is loaded (mirrors production startup via _load_static_data)
        backend_app._load_static_data()
        cls.PIL_Image = Image
        cls.np = np

    def _make_solid_image(self, color: tuple, size: tuple = (224, 224)):
        """Helper: create a solid-color RGB PIL image for deterministic testing."""
        img = self.PIL_Image.new("RGB", size, color)
        return img

    def test_output_shape_is_384(self):
        """DINOv2 extractor must return a list of exactly 384 floats."""
        img = self._make_solid_image((120, 80, 200))
        vec = backend_app.extract_visual_feature_vector(img)
        self.assertEqual(
            len(vec), 384,
            f"DINOv2 output must be 384-dim, got {len(vec)}"
        )

    def test_output_is_l2_normalized(self):
        """DINOv2 output vector must have unit L2 norm (normalized for cosine similarity)."""
        img = self._make_solid_image((50, 150, 250))
        vec = backend_app.extract_visual_feature_vector(img)
        norm = self.np.linalg.norm(vec)
        self.assertAlmostEqual(
            norm, 1.0, places=5,
            msg=f"DINOv2 vector must be L2-normalized, got norm={norm:.6f}"
        )

    def test_identical_images_produce_max_similarity(self):
        """Two extractions from the exact same image must produce cosine similarity == 1.0."""
        img = self._make_solid_image((200, 100, 50))
        vec_a = self.np.array(backend_app.extract_visual_feature_vector(img))
        vec_b = self.np.array(backend_app.extract_visual_feature_vector(img))
        cosine_sim = float(self.np.dot(vec_a, vec_b))  # Both unit vectors, so dot == cosine
        self.assertAlmostEqual(
            cosine_sim, 1.0, places=5,
            msg=f"Identical images must produce cosine=1.0, got {cosine_sim:.6f}"
        )

    def test_dissimilar_images_below_rejection_threshold(self):
        """
        Visually dissimilar images (solid black vs solid white) must produce
        cosine similarity below the 0.92 rejection threshold.
        This validates that DINOv2 does not collapse all images into the same region.
        """
        img_black = self._make_solid_image((0, 0, 0))
        img_white = self._make_solid_image((255, 255, 255))
        vec_black = self.np.array(backend_app.extract_visual_feature_vector(img_black))
        vec_white = self.np.array(backend_app.extract_visual_feature_vector(img_white))
        cosine_sim = float(self.np.dot(vec_black, vec_white))
        self.assertLess(
            cosine_sim, 0.92,
            f"Dissimilar images must not trigger rejection threshold (0.92), got cosine={cosine_sim:.4f}"
        )

    def test_output_contains_only_floats(self):
        """DINOv2 output vector elements must all be Python float type."""
        img = self._make_solid_image((100, 200, 150))
        vec = backend_app.extract_visual_feature_vector(img)
        for i, val in enumerate(vec):
            self.assertIsInstance(
                val, float,
                f"Vector element at index {i} must be float, got {type(val)}"
            )




class TestDINOv2RealRetrievalRobustness(unittest.TestCase):
    """
    Real End-to-End Visual Retrieval Robustness tests for Meta DINOv2 Small.

    As recommended by enterprise MVP verification standards, these tests prove that
    DINOv2 embeddings preserve high visual similarity across scale/brightness/rotation variations. (2x upscaling, +20% brightness shift, 10° tilt/rotation)
    while remaining below threshold for completely different pattern images.
    """

    @classmethod
    def setUpClass(cls):
        """Build a realistic synthetic pattern image with geometric elements."""
        from PIL import Image, ImageDraw, ImageEnhance
        import numpy as np

        backend_app._load_static_data()

        cls.PIL_Image = Image
        cls.ImageEnhance = ImageEnhance
        cls.np = np

        # Base pattern image: white canvas with blue rectangle and red circle
        base_img = Image.new("RGB", (300, 300), (255, 255, 255))
        draw = ImageDraw.Draw(base_img)
        draw.rectangle([50, 50, 250, 250], fill=(50, 100, 200))
        draw.ellipse([100, 100, 200, 200], fill=(200, 50, 50))

        cls.base_img = base_img
        cls.base_vector = np.array(backend_app.extract_visual_feature_vector(base_img))

    def test_upscaled_image_retrieval(self):
        """2x upscaled image must achieve high similarity (≥ 0.95) with original embedding."""
        img_scaled = self.base_img.resize((600, 600))
        vec_scaled = self.np.array(backend_app.extract_visual_feature_vector(img_scaled))
        sim = float(self.np.dot(self.base_vector, vec_scaled))
        self.assertGreaterEqual(
            sim, 0.95,
            f"2x upscaled image must have cosine similarity ≥ 0.95, got {sim:.4f}"
        )

    def test_brightness_shifted_image_retrieval(self):
        """+20% brightness-shifted image must achieve high similarity (≥ 0.95) with original embedding."""
        img_bright = self.ImageEnhance.Brightness(self.base_img).enhance(1.2)
        vec_bright = self.np.array(backend_app.extract_visual_feature_vector(img_bright))
        sim = float(self.np.dot(self.base_vector, vec_bright))
        self.assertGreaterEqual(
            sim, 0.95,
            f"Brightness-shifted image must have cosine similarity ≥ 0.95, got {sim:.4f}"
        )

    def test_rotated_image_retrieval(self):
        """10° rotated image must achieve high similarity (≥ 0.88) with original embedding."""
        img_rotated = self.base_img.rotate(10, expand=False, fillcolor=(255, 255, 255))
        vec_rotated = self.np.array(backend_app.extract_visual_feature_vector(img_rotated))
        sim = float(self.np.dot(self.base_vector, vec_rotated))
        self.assertGreaterEqual(
            sim, 0.88,
            f"10° rotated image must have cosine similarity ≥ 0.88, got {sim:.4f}"
        )

    def test_completely_different_pattern_no_false_match(self):
        """A completely different pattern image must produce cosine similarity below 0.85."""
        from PIL import ImageDraw
        diff_img = self.PIL_Image.new("RGB", (300, 300), (30, 200, 50))
        draw = ImageDraw.Draw(diff_img)
        draw.line([(0, 0), (300, 300)], fill=(255, 255, 0), width=15)
        vec_diff = self.np.array(backend_app.extract_visual_feature_vector(diff_img))
        sim = float(self.np.dot(self.base_vector, vec_diff))
        self.assertLess(
            sim, 0.85,
            f"Completely different pattern image must have similarity < 0.85, got {sim:.4f}"
        )


class TestBatchSMVScaling(unittest.TestCase):
    """Validate batch production SMV scaling calculations in generate-sheet endpoints."""

    def test_single_garment_batch_smv_scaling(self):
        """Single garment batch_quantity = 500 must correctly multiply SMV mins and hours."""
        req = backend_app.ProcessSheetRequest(
            project_name="Test Batch Shirt",
            garment_type="Shirt",
            fabric_weight="Medium-weight",
            preview_image="globe.svg",
            similarity_percentage=100.0,
            similarity_status="APPROVED",
            classification_name="Shirt",
            message="Test batch run",
            batch_quantity=500,
        )
        res = backend_app.generate_process_sheet(req)
        self.assertIn("batch_production", res, "Result payload must contain batch_production object")
        b = res["batch_production"]
        self.assertEqual(b["batch_quantity"], 500)
        self.assertGreater(b["single_unit_smv_mins"], 0)
        self.assertEqual(b["batch_total_smv_mins"], round(b["single_unit_smv_mins"] * 500, 2))
        self.assertEqual(b["batch_total_hours"], round((b["single_unit_smv_mins"] * 500) / 60.0, 2))

    def test_doll_sheet_batch_smv_scaling(self):
        """Doll outfit set batch_quantity = 200 must sum component SMVs and scale batch hours."""
        req = backend_app.DollSheetRequest(
            project_name="Test Batch Doll Set",
            doll_type="Teddy Bear",
            components=[
                backend_app.GarmentComponent(
                    garment_type="Jacket",
                    fabric_weight="Heavy-weight",
                    preview_image="globe.svg",
                    classification_name="Jacket",
                    similarity_percentage=100.0,
                    similarity_status="APPROVED",
                ),
                backend_app.GarmentComponent(
                    garment_type="Pants",
                    fabric_weight="Medium-weight",
                    preview_image="globe.svg",
                    classification_name="Pants",
                    similarity_percentage=100.0,
                    similarity_status="APPROVED",
                ),
            ],
            message="Test doll batch",
            batch_quantity=200,
        )
        res = backend_app.generate_doll_process_sheet(req)
        self.assertIn("batch_production", res)
        b = res["batch_production"]
        self.assertEqual(b["batch_quantity"], 200)
        self.assertGreater(b["single_unit_smv_mins"], 0)
        self.assertEqual(b["batch_total_smv_mins"], round(b["single_unit_smv_mins"] * 200, 2))


class TestFastAPICaching(unittest.TestCase):
    """Benchmark in-memory catalog response times and verify sub-10ms performance."""

    def test_juki_catalog_in_memory_caching_performance(self):
        """Repeated calls to get_all_juki_catalog() must return identical list within sub-10ms latency."""
        import time
        # Warmup cache
        cat1 = backend_app.get_all_juki_catalog()
        self.assertGreater(len(cat1), 0, "Catalog must not be empty")

        start = time.perf_counter()
        for _ in range(50):
            cat2 = backend_app.get_all_juki_catalog()
        elapsed_ms = (time.perf_counter() - start) * 1000.0 / 50.0

        self.assertEqual(id(cat1), id(cat2), "Cached catalog must return identical object reference")
        self.assertLess(elapsed_ms, 10.0, f"Average cached query latency must be < 10ms, got {elapsed_ms:.3f}ms")


if __name__ == "__main__":
    unittest.main(verbosity=2)
