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
                    result TEXT NOT NULL
                );
            """)
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
    Uses PyTorch visual vector cosine similarity + MD5 image hash + project name matching.
    Returns (highest_similarity_percentage, matched_project_name, matched_id, is_duplicate).
    """
    import hashlib

    def get_img_hash(b64_str: str) -> str:
        clean_b64 = b64_str.split(",")[-1] if "," in b64_str else b64_str
        return hashlib.md5(clean_b64.encode("utf-8")).hexdigest()

    target_hash = get_img_hash(image_b64) if image_b64 else ""

    history = get_analysis_history_from_db()
    max_cosine_sim = 0.0
    best_match_name = ""
    best_match_id = None

    # Count how many DB records actually have a stored vector for diagnostics
    records_with_vector = sum(1 for item in history if item.get("result", {}).get("visual_vector"))
    print(f"[DB-SIMILARITY] Scanning {len(history)} DB records ({records_with_vector} have visual vectors).")

    for item in history:
        res = item.get("result", {})
        prev_img = res.get("preview_image", "")
        prev_name = item.get("fileName", "")
        prev_id = item.get("id")
        prev_vector = res.get("visual_vector", [])

        # 1. Exact image hash match (MD5)
        if target_hash and prev_img:
            prev_hash = get_img_hash(prev_img)
            if target_hash == prev_hash:
                print(f"[DB-SIMILARITY] Exact image match (MD5) found with saved project '{prev_name}' (ID: {prev_id})")
                return 99.8, prev_name, prev_id, True

        # 2. DINOv2 Visual Feature Vector Cosine Similarity
        if query_vector and prev_vector and len(query_vector) == len(prev_vector):
            try:
                dot_val = np.dot(query_vector, prev_vector)
                norm_q = np.linalg.norm(query_vector)
                norm_p = np.linalg.norm(prev_vector)
                if norm_q > 0 and norm_p > 0:
                    cosine_sim = float(dot_val / (norm_q * norm_p))
                    sim_pct = round(cosine_sim * 100.0, 1)
                    print(f"[DB-SIMILARITY] Comparing vs '{prev_name}' (ID #{prev_id}): cosine={sim_pct:.1f}% (vector dims: {len(prev_vector)})")
                    if sim_pct > max_cosine_sim:
                        max_cosine_sim = sim_pct
                        best_match_name = prev_name
                        best_match_id = prev_id
                    if cosine_sim >= 0.90:
                        print(f"[DB-SIMILARITY] ✓ MATCH! 384-dim visual embedding {sim_pct}% ≥ 90% threshold → REJECTED ('{prev_name}', ID: {prev_id})")
                        return sim_pct, prev_name, prev_id, True
            except Exception as e:
                print(f"[VECTOR-SEARCH-ERR] Vector comparison failed: {e}")

        # 3. Same project name match
        if project_name and prev_name and project_name.strip().lower() == prev_name.strip().lower():
            print(f"[DB-SIMILARITY] Duplicate project name match found for '{prev_name}' (ID: {prev_id})")
            return 98.5, prev_name, prev_id, True

    if max_cosine_sim > 0:
        print(f"[DB-SIMILARITY] Best visual match: {max_cosine_sim:.1f}% with project '{best_match_name}' (ID #{best_match_id}) (below 90% threshold → APPROVED)")
    else:
        print(f"[DB-SIMILARITY] No visual vector matches found (0 stored vectors or all below threshold) → APPROVED")

    return max_cosine_sim, best_match_name, best_match_id, False


def get_top_k_similar_history_records(query_vector: list, limit: int = 3) -> list[dict]:
    """
    Retrieve Top-K most similar historical saved projects from analysis_history DB table.
    Returns a list of dicts with: id, title, similarity_pct, garment_type, sewing_sequence, tooling, smv, learnings.
    Conforms to Industrial MVP requirement: 'Retrieve at least three similar historical examples'.
    """
    if not query_vector:
        return []

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
                    candidates.append({
                        "id": prev_id,
                        "title": prev_name,
                        "similarity_pct": sim_pct,
                        "garment_type": res.get("garment_type", "garment"),
                        "sewing_sequence": res.get("sewing_sequence", []),
                        "tooling": res.get("tooling_recommendations", []),
                        "smv": res.get("smv_range", "N/A"),
                        "learnings": f"Historical project ID #{prev_id} ('{prev_name}') baseline with {sim_pct}% visual similarity."
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
    """Save or update an analysis record in database for persistent history logs, preventing duplicate entries."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        result_json_str = json.dumps(result_data, ensure_ascii=False)
        
        # Check if an entry with the exact same project filename already exists
        if is_sqlite():
            cursor.execute("SELECT id FROM analysis_history WHERE filename = ?;", (filename,))
            existing = cursor.fetchone()
            if existing:
                cursor.execute("""
                    UPDATE analysis_history SET timestamp = ?, result = ? WHERE id = ?;
                """, (timestamp, result_json_str, existing[0]))
                conn.commit()
                print(f"[DB] Updated existing analysis for '{filename}' (ID: {existing[0]}) in database.")
            else:
                cursor.execute("""
                    INSERT INTO analysis_history (filename, timestamp, result)
                    VALUES (?, ?, ?);
                """, (filename, timestamp, result_json_str))
                conn.commit()
                print(f"[DB] Saved new analysis for '{filename}' to database.")
        else:
            conn.autocommit = True
            cursor.execute("SELECT id FROM analysis_history WHERE filename = %s;", (filename,))
            existing = cursor.fetchone()
            if existing:
                cursor.execute("""
                    UPDATE analysis_history SET timestamp = %s, result = %s WHERE id = %s;
                """, (timestamp, result_json_str, existing[0]))
                print(f"[DB] Updated existing analysis for '{filename}' (ID: {existing[0]}) in database.")
            else:
                cursor.execute("""
                    INSERT INTO analysis_history (filename, timestamp, result)
                    VALUES (%s, %s, %s);
                """, (filename, timestamp, result_json_str))
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
        print(f"[DB-ERR] Failed to retrieve analysis history: {str(e)}")
        return []

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
