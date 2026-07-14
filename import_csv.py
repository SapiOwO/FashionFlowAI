import os
import sys
import csv
import json
from dotenv import load_dotenv

# Ensure we can import from backend
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
from db import get_connection, is_sqlite, get_mock_embedding

# Load environment configuration
load_dotenv()

CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "historical_products.csv")

def import_csv():
    print("====================================================")
    print("      FashionFlow CSV Database Importer Tool")
    print("====================================================")
    
    if not os.path.exists(CSV_PATH):
        # Look for the example file as fallback
        example_path = CSV_PATH + ".example"
        print(f"[WARN] Target CSV file not found at: {CSV_PATH}")
        print(f"To start, rename or copy the template:")
        print(f"  {example_path} -> {CSV_PATH}")
        print("Then run this script again.")
        sys.exit(1)

    print(f"[INFO] Reading CSV file from: {CSV_PATH}")
    
    records = []
    try:
        with open(CSV_PATH, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            # Validate headers
            required_headers = {"title", "ref", "features", "tooling", "smv", "learnings"}
            headers = set(reader.fieldnames or [])
            missing = required_headers - headers
            if missing:
                print(f"[ERR] Invalid CSV structure. Missing column headers: {missing}")
                print(f"Expected headers are: {list(required_headers)}")
                sys.exit(1)
                
            for row in reader:
                records.append({
                    "title": row["title"].strip(),
                    "ref": row["ref"].strip(),
                    "features": row["features"].strip(),
                    "tooling": row["tooling"].strip(),
                    "smv": row["smv"].strip(),
                    "learnings": row["learnings"].strip(),
                })
    except Exception as e:
        print(f"[ERR] Failed to parse CSV: {str(e)}")
        sys.exit(1)

    if not records:
        print("[WARN] No records found in the CSV file.")
        sys.exit(0)

    print(f"[INFO] Parsed {len(records)} records from CSV.")
    print(f"[INFO] Connecting to database...")

    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        sqlite_mode = is_sqlite()
        
        inserted_count = 0
        for r in records:
            # Generate the vector embedding vector for similarity search
            vector_text = f"{r['title']} {r['features']} {r['tooling']}"
            embedding = get_mock_embedding(vector_text)
            
            if sqlite_mode:
                # SQLite stores embedding as JSON string
                emb_str = json.dumps(embedding)
                cursor.execute("""
                    INSERT INTO historical_products (title, ref, features, tooling, smv, learnings, embedding)
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                """, (r["title"], r["ref"], r["features"], r["tooling"], r["smv"], r["learnings"], emb_str))
            else:
                # PostgreSQL with pgvector
                cursor.execute("""
                    INSERT INTO historical_products (title, ref, features, tooling, smv, learnings, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::vector);
                """, (r["title"], r["ref"], r["features"], r["tooling"], r["smv"], r["learnings"], embedding))
            
            inserted_count += 1
            
        if sqlite_mode:
            conn.commit()
        else:
            conn.autocommit = True
            
        cursor.close()
        conn.close()
        print(f"[SUCCESS] Successfully imported {inserted_count} records into 'historical_products' database table.")
        
    except Exception as e:
        print(f"[ERR] Database insertion failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    import_csv()
