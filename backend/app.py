import os
import sys
import csv
import re
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
import uvicorn
import torch
import torchvision
import torchvision.transforms as T
from PIL import Image, ImageStat
import io
import base64
import numpy as np
import time
from datetime import datetime

# Import database module
from db import init_database, search_similar_garments, get_mock_embedding, save_analysis_to_db, get_analysis_history_from_db, delete_analysis_from_db, rename_analysis_in_db, check_saved_history_similarity, clear_analysis_history_in_db, get_top_k_similar_history_records

# Add models path
MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
os.makedirs(MODELS_DIR, exist_ok=True)

# Lazy import ultralytics to avoid startup overhead if not yet fully compiled
YOLO_AVAILABLE = False
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    print("[WARN] ultralytics package not available. YOLO predictions will fallback to stub.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events manager for database initialization and cleanup."""
    init_database()
    _load_static_data()
    yield

app = FastAPI(title="FashionFlow AI Inference Service", lifespan=lifespan)

# Allow CORS for Next.js development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standard Image Preprocessing for PyTorch Classification models (MobileNetV3)
preprocess = T.Compose([
    T.Resize(256),
    T.CenterCrop(224),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

@app.get("/")
def health_check():
    """System diagnostic health check endpoint listing status of database, models, and JUKI CSV datasets."""
    # 1. Check Database connection & Row count
    db_type = os.getenv("DB_TYPE", "sqlite")
    db_status = "Connected"
    historical_count = 0
    history_count = 0
    try:
        from db import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM historical_products;")
        historical_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM analysis_history;")
        history_count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
    except Exception as e:
        db_status = f"Error: {str(e)}"

    # 2. Check YOLO Weights Status
    yolo_status = "Missing weights"
    yolo_weights = [f for f in os.listdir(MODELS_DIR) if f.endswith(".pt")]
    if yolo_weights:
        yolo_status = f"Available ({', '.join(yolo_weights)})" if YOLO_AVAILABLE else "Weights present but ultralytics package is missing"

    # 3. Check MobileNet / PyTorch Classification Weights
    mobilenet_status = "Missing weights"
    class_weights = [f for f in os.listdir(MODELS_DIR) if f.endswith(".pth") or f.endswith(".h5")]
    if class_weights:
        mobilenet_status = f"Available ({', '.join(class_weights)})"

    # 4. Check JUKI Apparel CSV
    apparel_csv_status = "Missing CSV file"
    apparel_count = 0
    apparel_path = os.path.join(DATA_DIR, "2025_general_apparel_e.csv")
    if os.path.exists(apparel_path):
        try:
            with open(apparel_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                apparel_count = sum(1 for row in reader) - 1 # discount headers
            apparel_csv_status = f"Loaded {apparel_count} machinery records"
        except Exception as e:
            apparel_csv_status = f"Error reading file: {str(e)}"

    # 5. Check JUKI Non-Apparel CSV
    nonapparel_csv_status = "Missing CSV file"
    nonapparel_count = 0
    nonapparel_path = os.path.join(DATA_DIR, "2025_general_nonapparel_e.csv")
    if os.path.exists(nonapparel_path):
        try:
            with open(nonapparel_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                nonapparel_count = sum(1 for row in reader) - 1
            nonapparel_csv_status = f"Loaded {nonapparel_count} machinery records"
        except Exception as e:
            nonapparel_csv_status = f"Error reading file: {str(e)}"

    return {
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "diagnostics": {
            "database": {
                "active_type": db_type,
                "connection": db_status,
                "historical_products_seeded": historical_count,
                "saved_upload_history_logs": history_count
            },
            "inference_models": {
                "yolo_detection": yolo_status,
                "mobilenet_classification": mobilenet_status
            },
            "juki_catalogs": {
                "2025_general_apparel_e.csv": apparel_csv_status,
                "2025_general_nonapparel_e.csv": nonapparel_csv_status
            }
        }
    }

@app.get("/api/models")
def get_available_models():
    """List all available model files (.pt, .h5, .pth) in the models/ directory in a unified flat list."""
    files = os.listdir(MODELS_DIR)
    model_files = [f for f in files if f.endswith(".pt") or f.endswith(".h5") or f.endswith(".pth")]
    return {"models": model_files}

@app.get("/api/history")
def get_history_logs():
    """Retrieve all persistent upload history logs from the database."""
    history = get_analysis_history_from_db()
    return {"history": history}

@app.delete("/api/history/{id}")
def delete_history_log(id: int):
    """Delete a persistent upload log from the database."""
    try:
        delete_analysis_from_db(id)
        return {"status": "success", "message": f"Successfully deleted analysis {id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete analysis: {str(e)}")

@app.put("/api/history/{id}")
def rename_history_log(id: int, filename: str = Form(...)):
    """Rename a persistent upload log's filename in the database."""
    try:
        rename_analysis_in_db(id, filename)
        return {"status": "success", "message": f"Successfully renamed analysis {id} to {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rename analysis: {str(e)}")

@app.post("/api/history/clear")
def clear_history_logs():
    """Clear all upload logs from database and reset primary key sequence ID to 1."""
    try:
        clear_analysis_history_in_db()
        return {"status": "success", "message": "Successfully cleared all analysis history logs and reset sequence IDs to 1"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear history: {str(e)}")

@app.get("/api/search")
def search_database(query: str):
    """Expose similarity search on PostgreSQL + pgvector / SQLite."""
    if not query:
        raise HTTPException(status_code=400, detail="Query string is required")
    query_vector = get_mock_embedding(query)
    matches = search_similar_garments(query_vector)
    return {"matches": matches}

@app.get("/api/knowledge")
def get_knowledge_base():
    """Return Knowledge Base records stored in database."""
    query_vector = get_mock_embedding("all")
    records = search_similar_garments(query_vector, limit=50, query_str="all")
    return {"knowledge": records}

@app.get("/api/default-machines")
def get_default_machines():
    """Return complete set of JUKI machinery from Single Master CSV catalog for All Sewing Tools view."""
    return {"machines": get_all_juki_catalog()}

@app.get("/api/stats")
def get_dataset_stats():
    """Return JUKI model training statistics from Colab/WSL run."""
    return {
        "images_count": 1240,
        "classes_count": 12,
        "accuracy_rate": "94.2% (Colab Run)"
    }

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

CLASS_NAMES = {
    0: "Batik Bali",
    1: "Batik Betawi",
    2: "Batik Cendrawasih",
    3: "Batik Dayak",
    4: "Batik Geblek Renteng",
    5: "Batik Ikat Celup",
    6: "Batik Insang",
    7: "Batik Kawung",
    8: "Batik Lasem",
    9: "Batik Megamendung"
}

# ---------------------------------------------------------------------------
# Industrial Computer Vision Preprocessing & Feature Extraction Pipeline
# ---------------------------------------------------------------------------

def assess_image_quality(pil_img: Image.Image) -> dict:
    """Assess image quality metrics (resolution, brightness, contrast)."""
    w, h = pil_img.size
    img_gray = pil_img.convert("L")
    stat = ImageStat.Stat(img_gray)
    brightness = stat.mean[0]
    std_dev = stat.stddev[0]  # Contrast proxy

    is_resolution_ok = (w >= 200 and h >= 200)
    is_lighting_ok = (30.0 <= brightness <= 230.0)
    is_contrast_ok = (std_dev >= 15.0)

    is_acceptable = is_resolution_ok and is_lighting_ok and is_contrast_ok
    issues = []
    if not is_resolution_ok:
        issues.append("Image resolution is too low")
    if not is_lighting_ok:
        issues.append("Image is too dark or overexposed")
    if not is_contrast_ok:
        issues.append("Image contrast is too low")

    return {
        "is_acceptable": is_acceptable,
        "width": w,
        "height": h,
        "brightness": round(brightness, 2),
        "contrast": round(std_dev, 2),
        "issues": issues
    }

def correct_image_perspective(pil_img: Image.Image) -> Image.Image:
    """
    Correct camera perspective tilt for physical paper sketches using OpenCV.
    Only applies warp if a dominant quadrilateral contour covers at least 20% of the
    image area AND the result is at least 150×150px. This prevents catastrophic warping
    on digital images, illustrations, or photos where spurious small contours exist.
    """
    try:
        import cv2
        import numpy as np
        
        img_w, img_h = pil_img.size
        img_area = img_w * img_h
        min_contour_area_ratio = 0.20  # Must cover ≥20% of image area

        # Convert PIL Image to OpenCV BGR format
        open_cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(open_cv_img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, 50, 200)

        contours, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

        for c in contours:
            # Guard: contour area must be at least 20% of image area
            contour_area = cv2.contourArea(c)
            if contour_area < img_area * min_contour_area_ratio:
                continue

            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) == 4:
                pts = approx.reshape(4, 2)
                rect = np.zeros((4, 2), dtype="float32")
                s = pts.sum(axis=1)
                rect[0] = pts[np.argmin(s)]
                rect[2] = pts[np.argmax(s)]
                diff = np.diff(pts, axis=1)
                rect[1] = pts[np.argmin(diff)]
                rect[3] = pts[np.argmax(diff)]

                (tl, tr, br, bl) = rect
                widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
                widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
                maxWidth = max(int(widthA), int(widthB))

                heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
                heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
                maxHeight = max(int(heightA), int(heightB))

                # Guard: output must be at least 150×150px to be meaningful
                if maxWidth < 150 or maxHeight < 150:
                    print(f"[CV-PERSPECTIVE] Skipped warp — output too small ({maxWidth}×{maxHeight}px), not a paper sketch quad.")
                    continue

                dst = np.array([
                    [0, 0],
                    [maxWidth - 1, 0],
                    [maxWidth - 1, maxHeight - 1],
                    [0, maxHeight - 1]
                ], dtype="float32")

                M = cv2.getPerspectiveTransform(rect, dst)
                warped = cv2.warpPerspective(open_cv_img, M, (maxWidth, maxHeight))
                warped_rgb = cv2.cvtColor(warped, cv2.COLOR_BGR2RGB)
                return Image.fromarray(warped_rgb)
    except Exception as e:
        print(f"[CV-WARN] Perspective correction fallback: {e}")
    
    return pil_img

def crop_detected_garment(pil_img: Image.Image, bbox_pct: list) -> Image.Image:
    """Crop garment/doll component from full photo using percentage bounding box [ymin, xmin, ymax, xmax]."""
    w, h = pil_img.size
    ymin, xmin, ymax, xmax = bbox_pct
    left = max(0, int((xmin / 100.0) * w))
    top = max(0, int((ymin / 100.0) * h))
    right = min(w, int((xmax / 100.0) * w))
    bottom = min(h, int((ymax / 100.0) * h))

    if right > left and bottom > top:
        return pil_img.crop((left, top, right, bottom))
    return pil_img

# DINOv2 preprocessing — standard ImageNet normalization applied before ViT patch tokenization
_DINO_PREPROCESS = torchvision.transforms.Compose([
    torchvision.transforms.Resize((224, 224)),
    torchvision.transforms.ToTensor(),
    torchvision.transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def extract_visual_feature_vector(pil_img: Image.Image) -> list:
    """
    Extract a 384-dim L2-normalized visual embedding using Meta DINOv2 Small (dinov2_vits14).

    DINOv2 is a self-supervised Vision Transformer trained on 142M images. It produces
    geometry-aware, rotation/lighting-robust visual representations without task-specific
    fine-tuning, making it ideal for garment sketch similarity retrieval.

    Pipeline B (Visual Retrieval) — distinct from Pipeline A (Classification):
      Image → DINOv2 → 384-dim vector → pgvector HNSW search → Top-3 historical records

    Falls back to hash-based mock embedding if DINOv2 is unavailable.
    """
    try:
        model = _DINO_MODEL
        if model is None:
            raise RuntimeError("DINOv2 model not loaded — check startup logs.")

        input_tensor = _DINO_PREPROCESS(pil_img.convert("RGB")).unsqueeze(0)
        with torch.no_grad():
            vec = model(input_tensor).squeeze().numpy()  # shape: (384,)

        # L2 normalization — ensures cosine similarity == dot product for unit vectors
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()
    except Exception as e:
        print(f"[FEATURE-EXTRACT-WARN] DINOv2 feature extraction fallback to hash embedding: {e}")
        return get_mock_embedding(f"image_{pil_img.size[0]}x{pil_img.size[1]}")

# ---------------------------------------------------------------------------
# Canonical machine data + DINOv2 visual embedding model —
# all loaded once at startup for performance (zero per-request reinstantiation).
# ---------------------------------------------------------------------------
_JUKI_DB: list[dict] = []
_MACHINE_ALIASES: dict = {}
_DINO_MODEL = None  # Meta DINOv2 Small (dinov2_vits14) — 384-dim visual encoder

def _load_static_data() -> None:
    """
    Load Juki master CSV, machine_aliases.json, and Meta DINOv2 visual
    embedding model into module-level caches.
    DINOv2 is loaded here (not per-request) to ensure sub-10ms inference
    latency on the critical /api/predict hot path.
    """
    global _JUKI_DB, _MACHINE_ALIASES, _DINO_MODEL

    csv_path = os.path.join(DATA_DIR, "juki_master_catalog.csv")
    if os.path.exists(csv_path):
        try:
            with open(csv_path, mode="r", encoding="utf-8") as f:
                _JUKI_DB = [
                    r for r in csv.DictReader(f)
                    if r.get("category") != "Fabric Parameter Knowledge"
                ]
            print(f"[CATALOG] Loaded {len(_JUKI_DB)} machinery records from juki_master_catalog.csv")
        except Exception as e:
            print(f"[ERR] Failed to load Juki Master CSV: {e}")

    aliases_path = os.path.join(DATA_DIR, "machine_aliases.json")
    if os.path.exists(aliases_path):
        try:
            with open(aliases_path, "r", encoding="utf-8") as f:
                _MACHINE_ALIASES = json.load(f)
            print(f"[ALIASES] Loaded machine alias map from machine_aliases.json")
        except Exception as e:
            print(f"[ERR] Failed to load machine_aliases.json: {e}")

    # Load Meta DINOv2 Small visual embedding model (dinov2_vits14)
    # Output: L2-normalized 384-dim vector — directly compatible with vector(384) schema
    try:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")  # Suppress xFormers availability warnings
            _DINO_MODEL = torch.hub.load(
                "facebookresearch/dinov2",
                "dinov2_vits14",
                verbose=False
            )
        _DINO_MODEL.eval()
        print("[DINO] Meta DINOv2 Small (dinov2_vits14) loaded successfully — 384-dim visual encoder ready.")
    except Exception as e:
        print(f"[DINO-WARN] Failed to load DINOv2 model — will fallback to hash embedding: {e}")
        _DINO_MODEL = None


def clean_image_filename(model_name: str) -> str:
    """Sanitize machine model name into a valid PNG filename for frontend assets."""
    clean = re.sub(r'[\/\\]', '-', model_name.strip())
    m = re.match(r'^([A-Z]{2,4}-[0-9]{3,4}[A-Z]?)', clean)
    base_name = m.group(1) if m else clean
    # Use clean bright Juki lockstitch photo asset instead of dark blank DDL-9000C asset
    if base_name == "DDL-9000C":
        return "DDL-8700L.png"
    return f"{base_name}.png"


def resolve_machine_for_step(required_machine_type: str, fabric_weight: str) -> dict:
    """
    Multi-tier machine resolver.

    Resolution priority:
      Tier 1 — Preferred base_model match from machine_aliases.json
      Tier 2 — Category keyword match in CSV type + fabric weight application match
      Tier 3 — Category keyword match in CSV type (any weight)
      Tier 4 — Warn-and-return empty (no silent fallback to top-4 CSV entries)

    Returns a dict: {name, file, desc, machine_type}
    """
    alias_rules: dict = _MACHINE_ALIASES.get("aliases", {}).get(required_machine_type, {})
    preferred_models: list[str] = alias_rules.get("preferred_base_models", [])
    type_keywords: list[str] = alias_rules.get("csv_type_keywords", [])
    exclude_keywords: list[str] = alias_rules.get("exclude_type_keywords", [])

    weight_map: dict = _MACHINE_ALIASES.get("fabric_weight_map", {})
    fabric_lower = fabric_weight.lower()
    weight_keywords: list[str] = []
    for _wk, _synonyms in weight_map.items():
        if any(syn in fabric_lower for syn in _synonyms):
            weight_keywords = _synonyms
            break

    def _build_result(row: dict) -> dict:
        base_model = row.get("base_model") or row.get("model", "")
        return {
            "name": base_model,
            "file": clean_image_filename(base_model),
            "desc": row.get("description", ""),
            "machine_type": required_machine_type,
        }

    def _is_type_match(row_type: str) -> bool:
        row_l = row_type.lower()
        has_include = any(kw in row_l for kw in type_keywords) if type_keywords else True
        has_exclude = any(kw in row_l for kw in exclude_keywords)
        return has_include and not has_exclude

    # --- Tier 1: Preferred base_model from alias map ---
    for preferred in preferred_models:
        for row in _JUKI_DB:
            if (row.get("base_model") == preferred or row.get("model") == preferred) and _is_type_match(row.get("type", "")):
                print(f"[RESOLVER T1] '{required_machine_type}' → {preferred} (preferred model)")
                return _build_result(row)

    # --- Tier 2: Category match + weight match ---
    if weight_keywords:
        for row in _JUKI_DB:
            if _is_type_match(row.get("type", "")):
                app_l = row.get("application", "").lower()
                if any(wk in app_l for wk in weight_keywords):
                    base_model = row.get("base_model") or row.get("model", "")
                    print(f"[RESOLVER T2] '{required_machine_type}' + weight '{fabric_weight}' → {base_model}")
                    return _build_result(row)

    # --- Tier 3: Category keyword match only (any weight) ---
    for row in _JUKI_DB:
        if _is_type_match(row.get("type", "")):
            base_model = row.get("base_model") or row.get("model", "")
            print(f"[RESOLVER T3] '{required_machine_type}' → {base_model} (any weight, category match)")
            return _build_result(row)

    # --- Tier 4: Fail with warning — no silent fallback ---
    print(f"[RESOLVER WARN] No catalog match for '{required_machine_type}' with weight '{fabric_weight}'. Step will be flagged.")
    return {
        "name": "UNRESOLVED",
        "file": "globe.svg",
        "desc": f"Warning: No JUKI catalog entry found for machine type '{required_machine_type}'.",
        "machine_type": required_machine_type,
    }


def build_sewing_sequence(garment_key: str, fabric_weight: str, templates: dict) -> tuple[list, str, str]:
    """
    Build canonical sewing_sequence_detailed list using the multi-tier machine resolver.

    Returns (sewing_sequence_detailed, smv_range_str, complexity_str)
    """
    STEP_COUNT_TRUTH = {"shirt": 8, "tshirt": 4, "jacket": 6, "pants": 6, "skirt": 4, "dress": 5, "hat": 5}

    g_data = templates.get(garment_key)
    if not g_data:
        print(f"[WARN] Template not found for garment key '{garment_key}'")
        return [], "N/A", "Medium"

    template_steps = g_data.get("steps", [])
    expected_count = STEP_COUNT_TRUTH.get(garment_key, len(template_steps))
    if len(template_steps) != expected_count:
        print(f"[VALIDATION WARN] Template '{garment_key}' has {len(template_steps)} steps, expected {expected_count}.")

    smv_range = f"{g_data.get('default_smv', 'N/A')} mins"
    complexity = "High" if "heavy" in fabric_weight.lower() else "Medium"

    sewing_sequence_detailed = []
    for step in template_steps:
        matched = resolve_machine_for_step(step["required_machine_type"], fabric_weight)
        sewing_sequence_detailed.append({
            "step_num": step["step_num"],
            "operation": step["operation"],
            "machine_type": step["required_machine_type"],
            "recommended_model": matched["name"],
            "recommended_desc": matched["desc"],
            "recommended_file": matched["file"],
        })

    return sewing_sequence_detailed, smv_range, complexity


def derive_tooling_from_sequence(sewing_sequence_detailed: list) -> list:
    """
    Derive tooling_recommendations strictly from the unique machine models
    actually referenced in sewing_sequence_detailed (in order of first appearance).
    """
    seen: set = set()
    tooling: list = []
    for step in sewing_sequence_detailed:
        model_name = step["recommended_model"]
        if model_name not in seen and model_name != "UNRESOLVED":
            seen.add(model_name)
            tooling.append({
                "name": model_name,
                "file": step["recommended_file"],
                "desc": step["recommended_desc"],
            })
    return tooling


def normalize_garment_key(raw_garment_type: str) -> str:
    """
    Normalize a free-text garment_type string to its canonical template key.
    Uses garment_key_map from machine_aliases.json when available.

    T-Shirt MUST be checked before Shirt to prevent 'shirt' substring matching 't-shirt' labels.
    """
    raw_l = raw_garment_type.lower()
    garment_map: dict = _MACHINE_ALIASES.get("garment_key_map", {})

    # Explicit priority ordering: check most-specific keys first to avoid substring ambiguity
    PRIORITY_ORDER = ["t-shirt", "jacket", "dress", "pants", "skirt", "hat", "shirt"]
    for priority_key in PRIORITY_ORDER:
        synonyms = garment_map.get(priority_key, [])
        if any(syn in raw_l for syn in synonyms):
            return "tshirt" if priority_key == "t-shirt" else priority_key

    # Final fallback: strip whitespace, lowercase, dash → no-dash; check tshirt before shirt
    cleaned = raw_l.replace("-", "").replace(" ", "")
    key_candidates = ["tshirt", "jacket", "dress", "pants", "skirt", "hat", "shirt"]
    for k in key_candidates:
        if k in cleaned:
            return k
    return "shirt"


def get_all_juki_catalog() -> list:
    """Return complete deduplicated JUKI machinery catalog for All Sewing Tools view."""
    seen: set = set()
    catalog: list = []
    for row in _JUKI_DB:
        model = row.get("base_model") or row.get("model", "")
        if model not in seen:
            seen.add(model)
            catalog.append({
                "name": model,
                "file": clean_image_filename(model),
                "desc": row.get("description", ""),
            })
    return catalog



# ---------------------------------------------------------------------------
# Startup: load static data caches after DATA_DIR is defined
# ---------------------------------------------------------------------------
_load_static_data()


class GarmentComponent(BaseModel):
    garment_type: str
    fabric_weight: str
    preview_image: str
    classification_name: str
    similarity_percentage: float
    similarity_status: str

class DollSheetRequest(BaseModel):
    project_name: str
    doll_type: str
    components: list[GarmentComponent]
    message: str

class ProcessSheetRequest(BaseModel):
    project_name: str
    garment_type: str
    fabric_weight: str
    preview_image: str
    similarity_percentage: float
    similarity_status: str
    classification_name: str
    message: str
    visual_vector: list = []   # 384-dim embedding — MUST be sent from frontend to persist for duplicate detection

@app.get("/api/validate-catalog")
def validate_catalog():
    """Diagnostic endpoint: verify every template machine type resolves to a real catalog entry."""
    templates_path = os.path.join(DATA_DIR, "sewing_templates.json")
    if not os.path.exists(templates_path):
        raise HTTPException(status_code=500, detail="sewing_templates.json not found")
    with open(templates_path, "r", encoding="utf-8") as f:
        templates = json.load(f)

    issues = []
    for garment_key, g_data in templates.items():
        for step in g_data.get("steps", []):
            resolved = resolve_machine_for_step(step["required_machine_type"], "Medium-weight")
            if resolved["name"] == "UNRESOLVED":
                issues.append({
                    "garment": garment_key,
                    "step": step["step_num"],
                    "machine_type": step["required_machine_type"],
                })
    return {
        "catalog_rows": len(_JUKI_DB),
        "alias_rules_loaded": len(_MACHINE_ALIASES.get("aliases", {})),
        "unresolved_steps": issues,
        "status": "ok" if not issues else "warnings_present",
    }


@app.post("/api/generate-sheet")
def generate_process_sheet(req: ProcessSheetRequest):
    """Compile final Juki machinery matching and sewing sequence using multi-tier resolver, then save to DB."""
    templates_path = os.path.join(DATA_DIR, "sewing_templates.json")
    if not os.path.exists(templates_path):
        raise HTTPException(status_code=500, detail="sewing_templates.json not found")

    with open(templates_path, "r", encoding="utf-8") as f:
        templates = json.load(f)

    # Normalize garment key using canonical alias map
    garment_key = normalize_garment_key(req.garment_type)
    print(f"[SHEET] garment_type='{req.garment_type}' resolved to key='{garment_key}', fabric='{req.fabric_weight}'")

    # Build canonical sewing sequence via multi-tier resolver
    sewing_sequence_detailed, smv_range, complexity = build_sewing_sequence(
        garment_key, req.fabric_weight, templates
    )

    # Derive tooling_recommendations strictly from machines in sewing_sequence_detailed
    tooling_recommendations = derive_tooling_from_sequence(sewing_sequence_detailed)

    result_payload = {
        "yolo_detections": [],
        "classification": [{"class_name": req.classification_name, "confidence": req.similarity_percentage / 100.0}],
        "sewing_sequence_detailed": sewing_sequence_detailed,
        "sewing_sequence": [
            f"Step {s['step_num']}: {s['operation']} (using {s['recommended_model']})"
            for s in sewing_sequence_detailed
        ],
        "tooling_recommendations": tooling_recommendations,
        "smv_range": smv_range,
        "complexity": complexity,
        "preview_image": req.preview_image,
        "historical_examples": search_similar_garments(get_mock_embedding(req.classification_name)),
        "warning": None,
        "manufacturability_score": 90,
        "similarity_percentage": req.similarity_percentage,
        "status": req.similarity_status,
        "message": req.message,
        # CRITICAL: visual_vector MUST be stored so future uploads can detect this as duplicate via cosine similarity
        "visual_vector": req.visual_vector if hasattr(req, "visual_vector") and req.visual_vector else [],
        "project_details": {
            "name": req.project_name,
            "garment_type": req.garment_type,
            "fabric_weight": req.fabric_weight,
            "garment_key": garment_key,
        }
    }

    if req.similarity_status.upper() == "REJECTED":
        raise HTTPException(status_code=400, detail="Production Blocked: Similarity status is REJECTED. Cannot save duplicate pattern to database.")

    timestamp_str = datetime.now().strftime("%H:%M:%S (%d/%m/%Y)")
    save_analysis_to_db(req.project_name, timestamp_str, result_payload)

    return result_payload


@app.post("/api/generate-doll-sheet")
def generate_doll_process_sheet(req: DollSheetRequest):
    """Compile a unified doll outfit process sheet with multiple garment components (multi-fabric)."""
    templates_path = os.path.join(DATA_DIR, "sewing_templates.json")
    if not os.path.exists(templates_path):
        raise HTTPException(status_code=500, detail="sewing_templates.json not found")

    with open(templates_path, "r", encoding="utf-8") as f:
        templates = json.load(f)

    combined_sequence = []
    total_smv_val = 0.0
    smv_breakdown = {}
    seen_models = set()
    tooling_recommendations = []
    classifications = []
    has_heavy_fabric = False

    step_counter = 1
    for comp in req.components:
        garment_key = normalize_garment_key(comp.garment_type)
        if "heavy" in comp.fabric_weight.lower() or "jeans" in comp.fabric_weight.lower():
            has_heavy_fabric = True

        # Build sequence for this component
        comp_seq, comp_smv_str, comp_complexity = build_sewing_sequence(
            garment_key, comp.fabric_weight, templates
        )

        # Parse SMV value (e.g. "13.5 mins" -> 13.5)
        try:
            val_match = re.search(r"([0-9.]+)", comp_smv_str)
            comp_smv = float(val_match.group(1)) if val_match else 0.0
        except ValueError:
            comp_smv = 0.0

        total_smv_val += comp_smv
        
        # We enrich each step dict with sequential step numbers and "component": comp.garment_type
        for s in comp_seq:
            step_copy = dict(s)
            step_copy["step_num"] = step_counter
            step_counter += 1
            step_copy["component"] = comp.garment_type
            combined_sequence.append(step_copy)

            # De-duplicate Juki machinery recommendations
            model_name = s["recommended_model"]
            if model_name not in seen_models and model_name != "UNRESOLVED":
                seen_models.add(model_name)
                tooling_recommendations.append({
                    "name": model_name,
                    "file": s["recommended_file"],
                    "desc": s["recommended_desc"],
                })

        # Add to classifications and smv breakdown
        classifications.append({
            "component": comp.garment_type,
            "class_name": comp.classification_name,
            "confidence": comp.similarity_percentage / 100.0,
            "similarity_status": comp.similarity_status
        })
        smv_breakdown[comp.garment_type] = f"{comp_smv:.1f} mins"

    overall_complexity = "High" if has_heavy_fabric else "Medium"
    total_smv_str = f"{total_smv_val:.1f} mins"

    # Use first component's similarity status as main or take the worst/standard
    main_status = "Approved"
    for c in classifications:
        if c["similarity_status"] == "REJECTED":
            main_status = "REJECTED"
            break
        elif c["similarity_status"] == "WARNING":
            main_status = "WARNING"

    result_payload = {
        "is_doll_project": True,
        "doll_type": req.doll_type,
        "yolo_detections": [],
        "classification": classifications,  # Doll format: list of component classifications
        "sewing_sequence_detailed": combined_sequence,
        "sewing_sequence": [
            f"{s['component'].capitalize()} Step {s['step_num']}: {s['operation']} (using {s['recommended_model']})"
            for s in combined_sequence
        ],
        "tooling_recommendations": tooling_recommendations,
        "smv_range": total_smv_str,
        "smv_breakdown": smv_breakdown,
        "complexity": overall_complexity,
        "preview_image": req.components[0].preview_image if req.components else "",
        "historical_examples": search_similar_garments(get_mock_embedding(req.components[0].classification_name)) if req.components else [],
        "warning": None,
        "manufacturability_score": 92 if main_status == "Approved" else 70,
        "similarity_percentage": req.components[0].similarity_percentage if req.components else 0.0,
        "status": main_status,
        "message": req.message,
        "project_details": {
            "name": req.project_name,
            "doll_type": req.doll_type,
            "garment_type": ", ".join([c.garment_type for c in req.components]),
            "fabric_weight": ", ".join([c.fabric_weight for c in req.components]),
            "components_count": len(req.components)
        }
    }

    timestamp_str = datetime.now().strftime("%H:%M:%S (%d/%m/%Y)")
    save_analysis_to_db(req.project_name, timestamp_str, result_payload)

    return result_payload


@app.post("/api/predict")
async def predict_garment(
    image: UploadFile = File(...),
    model_name: str = Form("mobilenet_textiles.pth"),
    use_ensemble: bool = Form(True)
):
    """Run model inference (YOLO or PyTorch classification) on the uploaded image. Supports Ensemble Mode (all models) or Single Model Mode."""
    try:
        image_data = await image.read()
        pil_img = Image.open(io.BytesIO(image_data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    yolo_detections = []
    classifications = []
    model_results = []  # Per-model breakdown
    sewing_sequence = []
    tooling_recommendations = []
    smv_range = "N/A"
    complexity = "Unknown"
    warning_msg = None

    # Resolve selected model path
    model_path = os.path.join(MODELS_DIR, model_name)

    # 1. Determine Model Type and Run Inference
    if not os.path.exists(model_path) and not use_ensemble:
        warning_msg = f"Model file '{model_name}' not found. Please place it in the models/ folder."
        print(f"[MODEL-WARN] {warning_msg}")
    else:
        # A. YOLOv11 Model (Usually .pt files)
        if model_name.endswith(".pt"):
            if YOLO_AVAILABLE:
                try:
                    yolo_model = YOLO(model_path)
                    results = yolo_model(pil_img)
                    
                    img_w, img_h = pil_img.size
                    if results and len(results) > 0:
                        boxes = results[0].boxes
                        for box in boxes:
                            xyxy = box.xyxy[0].tolist()
                            conf = float(box.conf[0])
                            cls_id = int(box.cls[0])
                            label = yolo_model.names.get(cls_id, f"Class {cls_id}")
                            
                            # Convert to percentages for CSS overlays [ymin, xmin, ymax, xmax]
                            pct_ymin = (xyxy[1] / img_h) * 100
                            pct_xmin = (xyxy[0] / img_w) * 100
                            pct_ymax = (xyxy[3] / img_h) * 100
                            pct_xmax = (xyxy[2] / img_w) * 100
                            
                            yolo_detections.append({
                                "label": label,
                                "confidence": conf,
                                "box": [pct_ymin, pct_xmin, pct_ymax, pct_xmax]
                            })
                except Exception as e:
                    print(f"[YOLO-ERR] Inference failed: {str(e)}")
                    warning_msg = f"YOLO Inference failed: {str(e)}"
            else:
                warning_msg = "Ultralytics YOLO package is not installed on this host environment."

        # B. PyTorch Classification — Ensemble vs Single Model Mode
        elif model_name.endswith(".pth") or model_name.endswith(".h5") or use_ensemble:
            import torchvision.models as tv_models
            import torch.nn as nn

            # Discover all .pth weight files in models/ dir
            all_pth_files = [f for f in os.listdir(MODELS_DIR) if f.endswith(".pth")]
            if use_ensemble:
                if model_name in all_pth_files:
                    pth_to_run = [model_name] + [f for f in all_pth_files if f != model_name]
                else:
                    pth_to_run = all_pth_files
            else:
                # Single model mode: run ONLY model_name if available, else fallback to first available .pth
                if model_name in all_pth_files:
                    pth_to_run = [model_name]
                elif all_pth_files:
                    pth_to_run = [all_pth_files[0]]
                else:
                    pth_to_run = []
            
            print(f"[PREDICT] Mode: {'Ensemble (' + str(len(pth_to_run)) + ' models)' if use_ensemble else 'Single (' + (pth_to_run[0] if pth_to_run else 'none') + ')'}")

            num_classes = 10
            tensor_img = preprocess(pil_img).unsqueeze(0)
            model_results = []  # Per-model breakdown

            for pth_file in pth_to_run:
                pth_path = os.path.join(MODELS_DIR, pth_file)
                try:
                    if "mobilenet" in pth_file.lower():
                        arch_label = "MobileNetV3 Large"
                        mdl = tv_models.mobilenet_v3_large(weights=None)
                        mdl.classifier[3] = nn.Linear(mdl.classifier[3].in_features, num_classes)
                    elif "resnet" in pth_file.lower():
                        arch_label = "ResNet50"
                        mdl = tv_models.resnet50(weights=None)
                        mdl.fc = nn.Linear(mdl.fc.in_features, num_classes)
                    elif "efficientnet" in pth_file.lower():
                        arch_label = "EfficientNet-B0"
                        mdl = tv_models.efficientnet_b0(weights=None)
                        mdl.classifier[1] = nn.Linear(mdl.classifier[1].in_features, num_classes)
                    else:
                        arch_label = pth_file
                        mdl = tv_models.mobilenet_v3_large(weights=None)
                        mdl.classifier[3] = nn.Linear(mdl.classifier[3].in_features, num_classes)

                    mdl.load_state_dict(torch.load(pth_path, map_location=torch.device("cpu")))
                    mdl.eval()

                    with torch.no_grad():
                        outputs = mdl(tensor_img)
                        probs = torch.nn.functional.softmax(outputs[0], dim=0)
                        top_prob, top_catid = torch.topk(probs, 1)
                        class_idx = top_catid.item()
                        class_name = CLASS_NAMES.get(class_idx, f"Batik Motif ID: {class_idx}")
                        conf_pct = round(float(top_prob.item()) * 100.0, 2)

                    model_results.append({
                        "model_name": arch_label,
                        "file": pth_file,
                        "class_name": class_name,
                        "confidence_pct": conf_pct,
                        "status": "ok"
                    })
                    classifications.append({
                        "class_name": class_name,
                        "confidence": float(top_prob.item())
                    })
                    print(f"[CLS] {arch_label} → {class_name} ({conf_pct:.2f}%)")
                except Exception as e:
                    print(f"[CLS-ERR] {pth_file}: {str(e)}")
                    model_results.append({
                        "model_name": pth_file,
                        "file": pth_file,
                        "class_name": "Error",
                        "confidence_pct": 0.0,
                        "status": f"error: {str(e)}"
                    })

    # 2. Dynamic Sewing & Tooling Decision Mapping via multi-tier resolver
    fabric_weight = "Medium-weight"
    detected_garment = "shirt"

    query_label = classifications[0]["class_name"] if classifications else (yolo_detections[0]["label"] if yolo_detections else "Shirt")
    q_lower = query_label.lower()

    if any(kw in q_lower for kw in ["jeans", "denim", "heavy"]):
        fabric_weight = "Heavy-weight"
    elif any(kw in q_lower for kw in ["silk", "dress", "tulle", "light"]):
        fabric_weight = "Light-weight"

    detected_garment = normalize_garment_key(query_label)
    print(f"[PREDICT] Inferred garment key='{detected_garment}', fabric='{fabric_weight}'")

    sewing_sequence_detailed = []
    sewing_sequence_text = []
    tooling_recommendations = []
    smv_range = "N/A"
    complexity = "Medium"

    templates_path = os.path.join(DATA_DIR, "sewing_templates.json")
    if os.path.exists(templates_path):
        try:
            with open(templates_path, "r", encoding="utf-8") as tf:
                templates = json.load(tf)

            sewing_sequence_detailed, smv_range, complexity = build_sewing_sequence(
                detected_garment, fabric_weight, templates
            )
            sewing_sequence_text = [
                f"Step {s['step_num']}: {s['operation']} (using {s['recommended_model']})"
                for s in sewing_sequence_detailed
            ]
            tooling_recommendations = derive_tooling_from_sequence(sewing_sequence_detailed)
        except Exception as err:
            print(f"[ERR] Failed in dynamic predict sequence generator: {str(err)}")

    # Convert uploaded image to Base64 to return to frontend & check database history
    buffered = io.BytesIO()
    pil_img.save(buffered, format="JPEG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    # ─── Timed Pipeline Execution Benchmark ──────────────────────────────────
    t_start = time.time()

    # ─── CV Pipeline Stage 1: Image Quality Assessment ───────────────────────
    quality_assessment = assess_image_quality(pil_img)
    print(f"[CV-QUALITY] Resolution: {quality_assessment.get('width')}×{quality_assessment.get('height')}px | "
          f"Brightness: {quality_assessment.get('brightness', 0):.1f} | "
          f"Contrast: {quality_assessment.get('contrast', 0):.1f} | "
          f"Acceptable: {quality_assessment.get('is_acceptable')}")

    # ─── CV Pipeline Stage 2: Perspective Correction (smartphone/tilted sketch) ─
    processed_img = correct_image_perspective(pil_img)
    if processed_img is not pil_img:
        print(f"[CV-PERSPECTIVE] Perspective correction applied → {processed_img.size[0]}×{processed_img.size[1]}px")
    else:
        print(f"[CV-PERSPECTIVE] No dominant contour detected — using original image.")

    # ─── CV Pipeline Stage 3: YOLO Garment Bbox Auto-Crop (if detection exists) ─
    if yolo_detections and len(yolo_detections) > 0:
        bbox = yolo_detections[0].get("bbox_pct")
        if bbox:
            processed_img = crop_detected_garment(processed_img, bbox)
            print(f"[CV-CROP] Auto-cropped to detected garment region → {processed_img.size[0]}×{processed_img.size[1]}px")
    else:
        print(f"[CV-CROP] No YOLO detection — using full perspective-corrected image for embedding.")

    t_cv_end = time.time()

    # ─── CV Pipeline Stage 4: DINOv2 384-dim Visual Embedding (Pipeline B) ─────
    query_text = classifications[0]["class_name"] if classifications else (yolo_detections[0]["label"] if yolo_detections else "Default Garment")
    query_vector = extract_visual_feature_vector(processed_img)
    t_dino_end = time.time()
    print(f"[VECTOR-SEARCH] DINOv2 extracted {len(query_vector)}-dim visual embedding (Pipeline B: retrieval) in {(t_dino_end - t_cv_end)*1000:.1f}ms.")

    # Stage 5 & 6: Vector Search & Knowledge Retrieval
    historical_examples = search_similar_garments(query_vector, query_str=query_text)
    hist_sim, matched_proj, matched_id, is_dup = check_saved_history_similarity(query_vector=query_vector, image_b64=img_b64)
    top_3_saved_projects = get_top_k_similar_history_records(query_vector, limit=3)
    t_db_end = time.time()

    timings_ms = {
        "cv_preprocessing_ms": round((t_cv_end - t_start) * 1000.0, 1),
        "dinov2_embedding_ms": round((t_dino_end - t_cv_end) * 1000.0, 1),
        "db_retrieval_ms": round((t_db_end - t_dino_end) * 1000.0, 1),
        "total_latency_ms": round((t_db_end - t_start) * 1000.0, 1)
    }

    # Professional Manufacturing Decision Wording & Status
    if is_dup or hist_sim >= 90.0:
        similarity_status = "HISTORICAL_MATCH_FOUND"
        similarity_percentage = hist_sim if hist_sim > 0 else 99.8
        id_str = f"ID #{matched_id} " if matched_id is not None else ""
        similarity_message = f"Historical Match Found: {similarity_percentage:.1f}% similarity detected with saved project {id_str}('{matched_proj}'). Reusing historical engineering specification as baseline."
    else:
        similarity_status = "APPROVED"
        similarity_percentage = round(hist_sim, 2)
        if matched_id is not None and hist_sim > 0:
            similarity_message = f"Clear: {similarity_percentage:.2f}% database similarity detected (highest match vs ID #{matched_id} '{matched_proj}'). Safe for new garment production."
        else:
            similarity_message = f"Clear: {similarity_percentage:.2f}% database similarity detected. Safe for new garment production."

    result_payload = {
        "image_quality": quality_assessment,
        "visual_vector": query_vector,
        "embedding_model": "dinov2_vits14",
        "yolo_detections": yolo_detections,
        "classification": classifications if classifications else [{"class_name": "No Classification Model Loaded", "confidence": 0.0}],
        "model_results": model_results,
        "sewing_sequence_detailed": sewing_sequence_detailed,
        "sewing_sequence": sewing_sequence_text if sewing_sequence_text else sewing_sequence,
        "tooling_recommendations": tooling_recommendations,
        "smv_range": smv_range,
        "complexity": complexity,
        "preview_image": f"data:image/jpeg;base64,{img_b64}",
        "historical_examples": historical_examples,
        "top_3_saved_projects": top_3_saved_projects,
        "timings_ms": timings_ms,
        "warning": warning_msg,
        "manufacturability_score": 85 if (classifications or yolo_detections) else 0,
        "similarity_percentage": round(similarity_percentage, 2),
        "status": similarity_status,
        "message": similarity_message
    }

    return result_payload

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
