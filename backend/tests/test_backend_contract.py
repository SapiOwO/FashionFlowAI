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
            for key in ["step_num", "operation", "machine_type", "recommended_model", "recommended_desc", "recommended_file"]:
                self.assertIn(key, step, f"Step is missing key '{key}'")

    def test_no_tshirt_step_has_zipper_operation(self):
        seq, _, _ = backend_app.build_sewing_sequence("tshirt", "Medium-weight", self.templates)
        for step in seq:
            self.assertNotIn("zipper", step["operation"].lower(), f"T-Shirt step has zipper: {step['operation']}")
            self.assertNotIn("hood", step["operation"].lower(), f"T-Shirt step has hood: {step['operation']}")


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


if __name__ == "__main__":
    unittest.main(verbosity=2)
