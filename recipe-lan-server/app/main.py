"""
Minimal FastAPI + SQLite service for LAN use.
Extend routes and schema to match your recipe app.
"""

import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

SQLITE_PATH = Path(os.environ.get("SQLITE_PATH", "/data/app.db"))


def init_db() -> None:
    SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(SQLITE_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );
            """
        )
        conn.commit()


def get_db():
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Recipe LAN API",
    version="0.1.0",
    lifespan=lifespan,
)


class NoteCreate(BaseModel):
    content: str


class NoteOut(BaseModel):
    id: int
    content: str
    created_at: str


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/sqlite-version")
def sqlite_version(conn: sqlite3.Connection = Depends(get_db)):
    row = conn.execute("SELECT sqlite_version() AS v").fetchone()
    return {"sqlite_version": row["v"] if row else None}


@app.get("/api/notes", response_model=list[NoteOut])
def list_notes(conn: sqlite3.Connection = Depends(get_db)):
    rows = conn.execute(
        "SELECT id, content, created_at FROM notes ORDER BY id DESC"
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/notes", response_model=NoteOut)
def create_note(body: NoteCreate, conn: sqlite3.Connection = Depends(get_db)):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="content is required")
    cur = conn.execute(
        "INSERT INTO notes (content) VALUES (?)",
        (content,),
    )
    conn.commit()
    rid = cur.lastrowid
    row = conn.execute(
        "SELECT id, content, created_at FROM notes WHERE id = ?",
        (rid,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="insert failed")
    return dict(row)


@app.get("/api/notes/{note_id}", response_model=NoteOut)
def get_note(note_id: int, conn: sqlite3.Connection = Depends(get_db)):
    row = conn.execute(
        "SELECT id, content, created_at FROM notes WHERE id = ?",
        (note_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return dict(row)
