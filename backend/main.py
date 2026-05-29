import json
import os
from datetime import datetime
from typing import Optional

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, init_db, Project, Task, Session as DBSession

load_dotenv()

app = FastAPI(title="Claude Project Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# --- Schemas ---

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    status: str = "active"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "todo"
    priority: str = "medium"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    session_id: Optional[int] = None
    session_title: Optional[str] = None


class SessionUpdate(BaseModel):
    title: Optional[str] = None


# --- Projects ---

@app.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "status": p.status,
            "created_at": p.created_at.isoformat(),
            "task_count": len(p.tasks),
            "session_count": len(p.sessions),
        }
        for p in projects
    ]


@app.post("/projects", status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(name=data.name, description=data.description, status=data.status)
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"id": project.id, "name": project.name, "description": project.description,
            "status": project.status, "created_at": project.created_at.isoformat()}


@app.get("/projects/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "created_at": project.created_at.isoformat(),
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "status": t.status,
                "priority": t.priority,
                "created_at": t.created_at.isoformat(),
            }
            for t in project.tasks
        ],
        "sessions": [
            {
                "id": s.id,
                "title": s.title,
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat(),
                "message_count": len(json.loads(s.messages)),
            }
            for s in project.sessions
        ],
    }


@app.patch("/projects/{project_id}")
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.status is not None:
        project.status = data.status
    db.commit()
    db.refresh(project)
    return {"id": project.id, "name": project.name, "status": project.status}


@app.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()


# --- Tasks ---

@app.get("/projects/{project_id}/tasks")
def list_tasks(project_id: int, db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.project_id == project_id).order_by(Task.created_at).all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "created_at": t.created_at.isoformat(),
        }
        for t in tasks
    ]


@app.post("/projects/{project_id}/tasks", status_code=201)
def create_task(project_id: int, data: TaskCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    task = Task(project_id=project_id, title=data.title, description=data.description,
                status=data.status, priority=data.priority)
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"id": task.id, "title": task.title, "status": task.status,
            "priority": task.priority, "created_at": task.created_at.isoformat()}


@app.patch("/tasks/{task_id}")
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.status is not None:
        task.status = data.status
    if data.priority is not None:
        task.priority = data.priority
    db.commit()
    db.refresh(task)
    return {"id": task.id, "title": task.title, "status": task.status, "priority": task.priority}


@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()


# --- Sessions / Claude Chat ---

@app.get("/projects/{project_id}/sessions")
def list_sessions(project_id: int, db: Session = Depends(get_db)):
    sessions = db.query(DBSession).filter(DBSession.project_id == project_id)\
                 .order_by(DBSession.updated_at.desc()).all()
    return [
        {
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat(),
            "message_count": len(json.loads(s.messages)),
        }
        for s in sessions
    ]


@app.get("/sessions/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(DBSession).filter(DBSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": session.id,
        "title": session.title,
        "project_id": session.project_id,
        "messages": json.loads(session.messages),
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
    }


@app.patch("/sessions/{session_id}")
def update_session(session_id: int, data: SessionUpdate, db: Session = Depends(get_db)):
    session = db.query(DBSession).filter(DBSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if data.title is not None:
        session.title = data.title
    db.commit()
    return {"id": session.id, "title": session.title}


@app.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(DBSession).filter(DBSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()


@app.post("/projects/{project_id}/chat")
def chat(project_id: int, data: ChatRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = (
        f"You are an AI assistant helping manage the project: \"{project.name}\".\n"
        f"Project description: {project.description or 'No description provided.'}\n\n"
        "Help the user plan tasks, brainstorm ideas, review code, and track progress for this project."
    )

    api_messages = [{"role": m.role, "content": m.content} for m in data.messages]

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=system_prompt,
        messages=api_messages,
    )

    assistant_reply = response.content[0].text
    all_messages = api_messages + [{"role": "assistant", "content": assistant_reply}]

    # Persist or update session
    if data.session_id:
        db_session = db.query(DBSession).filter(DBSession.id == data.session_id).first()
        if db_session:
            db_session.messages = json.dumps(all_messages)
            db_session.updated_at = datetime.utcnow()
            db.commit()
            session_id = db_session.id
        else:
            session_id = data.session_id
    else:
        title = data.session_title or f"Session {datetime.utcnow().strftime('%b %d %H:%M')}"
        db_session = DBSession(
            project_id=project_id,
            title=title,
            messages=json.dumps(all_messages),
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        session_id = db_session.id

    return {"reply": assistant_reply, "session_id": session_id}


@app.get("/health")
def health():
    return {"status": "ok"}
