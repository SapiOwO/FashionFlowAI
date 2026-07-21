import os
import sqlite3
import psycopg2
import csv
from psycopg2.extras import execute_values
import numpy as np
import json
from dotenv import load_dotenv

# Load .env file from the root directory
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DB_TYPE = os.getenv("DB_TYPE", "sqlite")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "")
DB_NAME = os.getenv("DB_NAME", "fashionflow_db")

def is_sqlite() -> bool:
    """Check if the configured database is SQLite."""
    return DB_TYPE.lower() == "sqlite"

def get_connection():
    """Establish connection to PostgreSQL or SQLite. Auto-creates PostgreSQL database if it does not exist."""
    if is_sqlite():
        # Resolve database file path relative to the project root
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "fashionflow.db"))
        return sqlite3.connect(db_path)
    else:
        # Build PostgreSQL connection string
        conn_str = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        try:
            return psycopg2.connect(conn_str)
        except psycopg2.OperationalError as e:
            err_msg = str(e)
            if "does not exist" in err_msg:
                print(f"[DB] Database '{DB_NAME}' not found. Connecting to default 'postgres' database to create it...")
                try:
                    sys_conn_str = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/postgres"
                    sys_conn = psycopg2.connect(sys_conn_str)
                    sys_conn.autocommit = True
                    sys_cursor = sys_conn.cursor()
                    sys_cursor.execute(f'CREATE DATABASE "{DB_NAME}";')
                    sys_cursor.close()
                    sys_conn.close()
                    print(f"[DB] Database '{DB_NAME}' created successfully.")
                    return psycopg2.connect(conn_str)
                except Exception as create_err:
                    print(f"[DB-ERR] Failed to automatically create PostgreSQL database: {str(create_err)}")
                    raise e
            else:
                raise e

def init_database():
    """Create schemas and tables for both SQLite and PostgreSQL (Historical search + Analysis history)."""
    print(f"[DB] Initializing database using type: {DB_TYPE}")
    try:
        conn = get_connection()
        
        if is_sqlite():
            cursor = conn.cursor()
            # Historical reference products
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS historical_products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    ref TEXT NOT NULL,
                    features TEXT NOT NULL,
                    tooling TEXT NOT NULL,
                    smv TEXT NOT NULL,
                    learnings TEXT NOT NULL,
                    embedding TEXT NOT NULL
                );
            """)
            
            # Persistent Upload/Analysis History Log
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS analysis_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    result TEXT NOT NULL
                );
            """)
            cursor.close()
        else:
            conn.autocommit = True
            cursor = conn.cursor()
            # Enable pgvector extension
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            
            # Create pgvector table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS historical_products (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    ref VARCHAR(50) NOT NULL,
                    features TEXT NOT NULL,
                    tooling TEXT NOT NULL,
                    smv VARCHAR(50) NOT NULL,
                    learnings TEXT NOT NULL,
                    embedding vector(384) NOT NULL
                );
            """)
            
            # Create HNSW index
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_hnsw_cosine ON historical_products USING hnsw (embedding vector_cosine_ops);")
            
            # Create persistent upload history in PostgreSQL
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS analysis_history (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(255) NOT NULL,
                    timestamp VARCHAR(100) NOT NULL,
                    result TEXT NOT NULL,
                    visual_vector vector(384),
                    image_md5 TEXT
                );
            """)
            # Ensure native columns exist on older DB instances (safe idempotent migration)
            cursor.execute("ALTER TABLE analysis_history ADD COLUMN IF NOT EXISTS visual_vector vector(384);")
            cursor.execute("ALTER TABLE analysis_history ADD COLUMN IF NOT EXISTS image_md5 TEXT;")
            # HNSW index on analysis_history for O(log n) cosine search
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_hnsw_analysis_cosine "
                "ON analysis_history USING hnsw (visual_vector vector_cosine_ops);"
            )
            # Seed Knowledge Base dynamically from juki_master_catalog.csv if empty
            cursor.execute("SELECT COUNT(*) FROM historical_products;")
            count = cursor.fetchone()[0]
            if count == 0:
                print("[DB] Seeding Knowledge Base from data/juki_master_catalog.csv...")
                csv_param_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "juki_master_catalog.csv"))
                if os.path.exists(csv_param_path):
                    with open(csv_param_path, "r", encoding="utf-8") as pf:
                        reader = csv.DictReader(pf)
                        idx = 1
                        for row in reader:
                            if row.get("category") == "Fabric Parameter Knowledge":
                                f_name = row["application"]
                                ref_id = f"REF-{idx:02d}"
                                features = row["description"]
                                tooling = f"Recommended Needle {row['needle']}"
                                smv = "12.5 mins"
                                learnings = "Ensure appropriate needle size, presser foot pressure, and thread tension according to fabric weight."
                                
                                query_val = f"{f_name} {features} {tooling}"
                                emb = json.dumps(get_mock_embedding(query_val)) if is_sqlite() else get_mock_embedding(query_val)
                                
                                if is_sqlite():
                                    cursor.execute("""
                                        INSERT INTO historical_products (title, ref, features, tooling, smv, learnings, embedding)
                                        VALUES (?, ?, ?, ?, ?, ?, ?);
                                    """, (f_name, ref_id, features, tooling, smv, learnings, emb))
                                else:
                                    cursor.execute("""
                                        INSERT INTO historical_products (title, ref, features, tooling, smv, learnings, embedding)
                                        VALUES (%s, %s, %s, %s, %s, %s, %s::vector);
                                    """, (f_name, ref_id, features, tooling, smv, learnings, emb))
                                idx += 1
                conn.commit()

            cursor.close()
        conn.close()
        print("[DB] Database initialization complete.")
    except Exception as e:
        print(f"[DB-ERR] Failed to initialize database: {str(e)}")

def check_saved_history_similarity(query_vector: list = None, image_b64: str = "", project_name: str = "") -> tuple[float, str, int | None, bool]:
    """
    Check if an uploaded sketch image or project name already exists in analysis_history DB table.

    PostgreSQL path: Uses native pgvector HNSW index (O log n) for cosine similarity, plus MD5
    column for exact-match fast-path. No Python-side iteration.

    SQLite fallback: Python-loop cosine math (preserves dev/test compatibility).

    Returns (highest_similarity_percentage, matched_project_name, matched_id, is_duplicate).
    """
    import hashlib

    def get_img_hash(b64_str: str) -> str:
        """Return MD5 hex digest of the raw base64 payload (without data URI prefix)."""
        clean_b64 = b64_str.split(",")[-1] if "," in b64_str else b64_str
        return hashlib.md5(clean_b64.encode("utf-8")).hexdigest()

    target_hash = get_img_hash(image_b64) if image_b64 else ""

    # ── PostgreSQL path: native pgvector queries ────────────────────────────────
    if not is_sqlite():
        try:
            conn = get_connection()
            cursor = conn.cursor()

            # 1. Exact MD5 hash match (O(1) index scan)
            if target_hash:
                cursor.execute(
                    "SELECT id, filename FROM analysis_history WHERE image_md5 = %s LIMIT 1;",
                    (target_hash,)
                )
                row = cursor.fetchone()
                if row:
                    matched_id, matched_name = row
                    print(f"[DB-SIMILARITY] Exact image match (MD5) found with saved project '{matched_name}' (ID: {matched_id})")
                    cursor.close(); conn.close()
                    return 99.8, matched_name, matched_id, True

            # 2. Same project name match
            if project_name:
                cursor.execute(
                    "SELECT id, filename FROM analysis_history WHERE LOWER(filename) = LOWER(%s) LIMIT 1;",
                    (project_name.strip(),)
                )
                row = cursor.fetchone()
                if row:
                    matched_id, matched_name = row
                    print(f"[DB-SIMILARITY] Duplicate project name match found for '{matched_name}' (ID: {matched_id})")
                    cursor.close(); conn.close()
                    return 98.5, matched_name, matched_id, True

            # 3. pgvector HNSW cosine similarity — O(log n) via HNSW index
            if query_vector:
                vec_pg = "[" + ",".join(str(round(v, 8)) for v in query_vector) + "]"
                # Fetch Top-1 closest neighbour (highest cosine similarity)
                cursor.execute(
                    """
                    SELECT id, filename,
                           ROUND(CAST((1 - (visual_vector <=> %s::vector)) * 100 AS numeric), 1) AS cosine_pct
                    FROM analysis_history
                    WHERE visual_vector IS NOT NULL
                    ORDER BY visual_vector <=> %s::vector
                    LIMIT 1;
                    """,
                    (vec_pg, vec_pg)
                )
                row = cursor.fetchone()
                if row:
                    matched_id, matched_name, sim_pct = row
                    sim_pct = max(0.0, float(sim_pct))
                    if sim_pct >= 90.0:
                        print(f"[DB-SIMILARITY] pgvector HNSW → Top-1: '{matched_name}' (ID #{matched_id}) cosine={sim_pct:.1f}%")
                        print(f"[DB-SIMILARITY] ✓ MATCH! {sim_pct:.1f}% ≥ 90% threshold → REJECTED ('{matched_name}', ID: {matched_id})")
                        cursor.close(); conn.close()
                        return sim_pct, matched_name, matched_id, True
                    else:
                        print(f"[DB-SIMILARITY] pgvector HNSW → Top-1: '{matched_name}' (ID #{matched_id}) cosine={sim_pct:.1f}% (below 90% → APPROVED)")
                        cursor.close(); conn.close()
                        return sim_pct, matched_name, matched_id, False

            cursor.close(); conn.close()
            print("[DB-SIMILARITY] No query vector provided — APPROVED")
            return 0.0, "", None, False

        except Exception as e:
            print(f"[DB-SIMILARITY-ERR] pgvector query failed, falling back to Python loop: {e}")
            # Fall through to SQLite-compatible Python fallback below

    # ── SQLite / fallback path: Python-loop cosine math ────────────────────────
    history = get_analysis_history_from_db()
    max_cosine_sim = 0.0
    best_match_name = ""
    best_match_id = None

    records_with_vector = sum(1 for item in history if item.get("result", {}).get("visual_vector"))
    print(f"[DB-SIMILARITY] SQLite scan: {len(history)} records ({records_with_vector} have visual vectors).")

    for item in history:
        res = item.get("result", {})
        prev_img = res.get("preview_image", "")
        prev_name = item.get("fileName", "")
        prev_id = item.get("id")
        prev_vector = res.get("visual_vector", [])

        # MD5 exact match
        if target_hash and prev_img:
            prev_hash = get_img_hash(prev_img)
            if target_hash == prev_hash:
                print(f"[DB-SIMILARITY] Exact image match (MD5) found with saved project '{prev_name}' (ID: {prev_id})")
                return 99.8, prev_name, prev_id, True

        # Cosine similarity
        if query_vector and prev_vector and len(query_vector) == len(prev_vector):
            try:
                dot_val = np.dot(query_vector, prev_vector)
                norm_q = np.linalg.norm(query_vector)
                norm_p = np.linalg.norm(prev_vector)
                if norm_q > 0 and norm_p > 0:
                    cosine_sim = float(dot_val / (norm_q * norm_p))
                    sim_pct = round(max(0.0, cosine_sim) * 100.0, 1)
                    print(f"[DB-SIMILARITY] Comparing vs '{prev_name}' (ID #{prev_id}): cosine={sim_pct:.1f}%")
                    if sim_pct > max_cosine_sim:
                        max_cosine_sim = sim_pct
                        best_match_name = prev_name
                        best_match_id = prev_id
                    if cosine_sim >= 0.90:
                        print(f"[DB-SIMILARITY] ✓ MATCH! {sim_pct:.1f}% ≥ 90% → REJECTED ('{prev_name}', ID: {prev_id})")
                        return sim_pct, prev_name, prev_id, True
            except Exception as e:
                print(f"[VECTOR-SEARCH-ERR] Vector comparison failed: {e}")

        # Project name match
        if project_name and prev_name and project_name.strip().lower() == prev_name.strip().lower():
            print(f"[DB-SIMILARITY] Duplicate project name match found for '{prev_name}' (ID: {prev_id})")
            return 98.5, prev_name, prev_id, True

    if max_cosine_sim > 0:
        print(f"[DB-SIMILARITY] Best visual match: {max_cosine_sim:.1f}% with '{best_match_name}' (ID #{best_match_id}) (below 90% → APPROVED)")
    else:
        print("[DB-SIMILARITY] No visual vector matches found → APPROVED")

    return max(0.0, max_cosine_sim), best_match_name, best_match_id, False


def get_top_k_similar_history_records(query_vector: list, limit: int = 3) -> list[dict]:
    """
    Retrieve Top-K most similar historical saved projects from analysis_history.

    PostgreSQL path: Uses native pgvector HNSW ORDER BY <=> LIMIT query — O(log n).
    SQLite fallback: Python-loop cosine math for dev/test environments.

    Returns a list of dicts per enterprise MVP spec: id, title, similarity_pct, garment_type,
    sewing_sequence, tooling, smv, learnings.
    """
    if not query_vector:
        return []

    # ── PostgreSQL path: native pgvector Top-K ──────────────────────────────────
    if not is_sqlite():
        try:
            conn = get_connection()
            cursor = conn.cursor()
            vec_pg = "[" + ",".join(str(round(v, 8)) for v in query_vector) + "]"
            cursor.execute(
                """
                SELECT id, filename,
                       ROUND(CAST((1 - (visual_vector <=> %s::vector)) * 100 AS numeric), 1) AS cosine_pct,
                       result
                FROM analysis_history
                WHERE visual_vector IS NOT NULL
                ORDER BY visual_vector <=> %s::vector
                LIMIT %s;
                """,
                (vec_pg, vec_pg, limit)
            )
            rows = cursor.fetchall()
            cursor.close(); conn.close()
            candidates = []
            for row in rows:
                rid, rname, sim_pct, result_json = row
                sim_pct = float(sim_pct)
                try:
                    res = json.loads(result_json) if isinstance(result_json, str) else result_json
                except Exception:
                    res = {}
                # garment_type may be at root level OR nested under project_details
                project_details = res.get("project_details", {})
                garment_type_val = (
                    res.get("garment_type")
                    or project_details.get("garment_type")
                    or project_details.get("garment_key")
                    or ""
                ).strip()
                candidates.append({
                    "id": rid,
                    "title": rname,
                    "similarity_pct": sim_pct,
                    "garment_type": garment_type_val if garment_type_val else "Garment",
                    "preview_image": res.get("preview_image", ""),
                    "sewing_sequence": res.get("sewing_sequence", []),
                    "tooling": res.get("tooling_recommendations", []),
                    "smv": res.get("smv_range", "N/A"),
                    "learnings": f"Historical project ID #{rid} ('{rname}') baseline with {sim_pct:.1f}% visual similarity."
                })
            return candidates
        except Exception as e:
            print(f"[TOP-K-ERR] pgvector Top-K query failed, falling back to Python loop: {e}")

    # ── SQLite / fallback path: Python-loop cosine math ────────────────────────
    history = get_analysis_history_from_db()
    candidates = []
    for item in history:
        res = item.get("result", {})
        prev_vector = res.get("visual_vector", [])
        prev_id = item.get("id")
        prev_name = item.get("fileName", "")
        if prev_vector and len(query_vector) == len(prev_vector):
            try:
                dot_val = np.dot(query_vector, prev_vector)
                norm_q = np.linalg.norm(query_vector)
                norm_p = np.linalg.norm(prev_vector)
                if norm_q > 0 and norm_p > 0:
                    cosine_sim = float(dot_val / (norm_q * norm_p))
                    sim_pct = round(cosine_sim * 100.0, 1)
                    # garment_type may be at root level OR nested under project_details
                    project_details_fb = res.get("project_details", {})
                    garment_type_fb = (
                        res.get("garment_type")
                        or project_details_fb.get("garment_type")
                        or project_details_fb.get("garment_key")
                        or ""
                    ).strip()
                    candidates.append({
                        "id": prev_id,
                        "title": prev_name,
                        "similarity_pct": sim_pct,
                        "garment_type": garment_type_fb if garment_type_fb else "Garment",
                        "preview_image": res.get("preview_image", ""),
                        "sewing_sequence": res.get("sewing_sequence", []),
                        "tooling": res.get("tooling_recommendations", []),
                        "smv": res.get("smv_range", "N/A"),
                        "learnings": f"Historical project ID #{prev_id} ('{prev_name}') baseline with {sim_pct:.1f}% visual similarity."
                    })
            except Exception as e:
                print(f"[TOP-K-ERR] Failed candidate comparison for ID #{prev_id}: {e}")
    candidates.sort(key=lambda x: x["similarity_pct"], reverse=True)
    return candidates[:limit]


def clear_analysis_history_in_db() -> bool:
    """Clear all records from analysis_history and reset auto-increment primary key ID sequence to 1."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        if is_sqlite():
            cursor.execute("DELETE FROM analysis_history;")
            cursor.execute("DELETE FROM sqlite_sequence WHERE name = 'analysis_history';")
        else:
            cursor.execute("TRUNCATE TABLE analysis_history RESTART IDENTITY;")
        conn.commit()
        cursor.close()
        conn.close()
        print("[DB] Cleared all analysis history records and reset ID sequence to 1.")
        return True
    except Exception as e:
        print(f"[DB-ERR] Failed to clear analysis history: {str(e)}")
        return False


def save_analysis_to_db(filename: str, timestamp: str, result_data: dict):
    """
    Save or update an analysis record in the database for persistent history logs.

    PostgreSQL path: Extracts visual_vector and image_md5 from result_data and stores them
    in native columns so pgvector HNSW index can accelerate future similarity queries.

    SQLite path: Stores only the JSON blob (no native vector column support).
    """
    import hashlib

    try:
        conn = get_connection()
        cursor = conn.cursor()
        result_json_str = json.dumps(result_data, ensure_ascii=False)

        if is_sqlite():
            # SQLite: plain JSON blob only
            cursor.execute("SELECT id FROM analysis_history WHERE filename = ?;", (filename,))
            existing = cursor.fetchone()
            if existing:
                cursor.execute(
                    "UPDATE analysis_history SET timestamp = ?, result = ? WHERE id = ?;",
                    (timestamp, result_json_str, existing[0])
                )
                conn.commit()
                print(f"[DB] Updated existing analysis for '{filename}' (ID: {existing[0]}) in database.")
            else:
                cursor.execute(
                    "INSERT INTO analysis_history (filename, timestamp, result) VALUES (?, ?, ?);",
                    (filename, timestamp, result_json_str)
                )
                conn.commit()
                print(f"[DB] Saved new analysis for '{filename}' to database.")
        else:
            # PostgreSQL: store native visual_vector and image_md5 alongside JSON blob
            conn.autocommit = True

            # Extract visual vector for native column storage
            raw_vec = result_data.get("visual_vector", [])
            vec_pg = None
            if raw_vec and len(raw_vec) == 384:
                vec_pg = "[" + ",".join(str(round(v, 8)) for v in raw_vec) + "]"

            # Extract MD5 of preview image for fast exact-match lookup
            preview_b64 = result_data.get("preview_image", "")
            md5_hash = None
            if preview_b64:
                clean_b64 = preview_b64.split(",")[-1] if "," in preview_b64 else preview_b64
                md5_hash = hashlib.md5(clean_b64.encode("utf-8")).hexdigest()

            cursor.execute("SELECT id FROM analysis_history WHERE filename = %s;", (filename,))
            existing = cursor.fetchone()
            if existing:
                cursor.execute(
                    """
                    UPDATE analysis_history
                    SET timestamp = %s, result = %s,
                        visual_vector = %s::vector,
                        image_md5 = %s
                    WHERE id = %s;
                    """,
                    (timestamp, result_json_str, vec_pg, md5_hash, existing[0])
                )
                print(f"[DB] Updated existing analysis for '{filename}' (ID: {existing[0]}) in database.")
            else:
                cursor.execute(
                    """
                    INSERT INTO analysis_history (filename, timestamp, result, visual_vector, image_md5)
                    VALUES (%s, %s, %s, %s::vector, %s);
                    """,
                    (filename, timestamp, result_json_str, vec_pg, md5_hash)
                )
                print(f"[DB] Saved new analysis for '{filename}' to database.")

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[DB-ERR] Failed to save analysis log: {str(e)}")

def get_analysis_history_from_db():
    """Retrieve all persistent upload history logs from the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        if is_sqlite():
            cursor.execute("SELECT id, filename, timestamp, result FROM analysis_history ORDER BY id DESC;")
        else:
            cursor.execute("SELECT id, filename, timestamp, result FROM analysis_history ORDER BY id DESC;")
            
        rows = cursor.fetchall()
        history = []
        for r in rows:
            history.append({
                "id": str(r[0]),
                "fileName": r[1],
                "timestamp": r[2],
                "result": json.loads(r[3])
            })
            
        cursor.close()
        conn.close()
        return history
    except Exception as e:
        print(f"[DB-ERR] Failed to load analysis history: {str(e)}")
        return []

def get_all_unique_tags() -> list[str]:
    """Retrieve all unique project tag strings across analysis_history database records."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT result FROM analysis_history;")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        tags_set = set()
        for r in rows:
            try:
                data = json.loads(r[0]) if isinstance(r[0], str) else r[0]
                for t in data.get("tags", []):
                    if t and isinstance(t, str) and t.strip():
                        tags_set.add(t.strip())
            except Exception:
                continue
        return sorted(list(tags_set))
    except Exception as e:
        print(f"[DB-ERR] Failed to fetch unique tags: {str(e)}")
        return []

def reset_analysis_history():
    """Wipe all analysis history database records and reset ID sequence back to 1."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        if is_sqlite():
            cursor.execute("DELETE FROM analysis_history;")
            try:
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='analysis_history';")
            except Exception:
                pass
        else:
            cursor.execute("TRUNCATE TABLE analysis_history RESTART IDENTITY;")
        conn.commit()
        cursor.close()
        conn.close()
        print("[DB] Analysis history wiped and sequence reset to ID 1.")
        return True
    except Exception as e:
        print(f"[DB-ERR] Failed to reset analysis history: {str(e)}")
        return False

def get_mock_embedding(text: str) -> list:
    """Generate a deterministic mock 384-dimensional vector embedding based on text hash."""
    seed = sum(ord(c) for c in text)
    np.random.seed(seed)
    vector = np.random.randn(384)
    vector = vector / np.linalg.norm(vector)
    return vector.tolist()

def search_similar_garments(query_vector: list, limit: int = 3, query_str: str = None):
    """Find similar garments using pgvector cosine distance (Postgres) or numpy cosine math (SQLite) with keyword boosting."""
    try:
        conn = get_connection()
        cursor = conn.cursor()

        if is_sqlite():
            cursor.execute("SELECT title, ref, features, tooling, smv, learnings, embedding FROM historical_products;")
            rows = cursor.fetchall()
            
            if not rows:
                return []
                
            import json
            candidates = []
            for r in rows:
                emb = json.loads(r[6])
                dot_val = np.dot(query_vector, emb)
                norm_query = np.linalg.norm(query_vector)
                norm_emb = np.linalg.norm(emb)
                distance = 1.0 - (dot_val / (norm_query * norm_emb))
                
                # Apply keyword match boost to bypass deterministic hash limits
                if query_str and query_str.lower() != "all":
                    q_words = query_str.lower().split()
                    title_lower = r[0].lower()
                    features_lower = r[2].lower()
                    matches = sum(1 for w in q_words if w in title_lower or w in features_lower)
                    if matches > 0:
                        distance -= 0.8 * matches  # Strong boost for keyword matches

                candidates.append((distance, r[0], r[1], r[2], r[3], r[4], r[5]))
            
            candidates.sort(key=lambda x: x[0])
            results = []
            for c in candidates[:limit]:
                results.append({
                    "title": c[1], "ref": c[2], "features": c[3], "tooling": c[4], "smv": c[5], "learnings": c[6]
                })
        else:
            select_query = """
                SELECT title, ref, features, tooling, smv, learnings 
                FROM historical_products 
                ORDER BY embedding <=> %s::vector
                LIMIT %s;
            """
            cursor.execute(select_query, (query_vector, limit))
            rows = cursor.fetchall()
            results = []
            for r in rows:
                results.append({
                    "title": r[0], "ref": r[1], "features": r[2], "tooling": r[3], "smv": r[4], "learnings": r[5]
                })

        cursor.close()
        conn.close()
        return results
    except Exception as e:
        print(f"[DB-ERR] Search failed: {str(e)}")
        return []

def delete_analysis_from_db(record_id: int) -> bool:
    """Delete an analysis record from database by ID."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        if is_sqlite():
            cursor.execute("DELETE FROM analysis_history WHERE id = ?;", (record_id,))
        else:
            cursor.execute("DELETE FROM analysis_history WHERE id = %s;", (record_id,))
        conn.commit()
        affected = cursor.rowcount
        cursor.close()
        conn.close()
        return affected > 0
    except Exception as e:
        print(f"[DB-ERR] Failed to delete analysis record {record_id}: {str(e)}")
        return False

def rename_analysis_in_db(record_id: int, new_filename: str) -> bool:
    """Rename an analysis record in database by ID."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        if is_sqlite():
            cursor.execute("UPDATE analysis_history SET file_name = ? WHERE id = ?;", (new_filename, record_id))
        else:
            cursor.execute("UPDATE analysis_history SET file_name = %s WHERE id = %s;", (new_filename, record_id))
        conn.commit()
        affected = cursor.rowcount
        cursor.close()
        conn.close()
        return affected > 0
    except Exception as e:
        print(f"[DB-ERR] Failed to rename analysis record {record_id}: {str(e)}")
        return False

if __name__ == "__main__":
    init_database()
