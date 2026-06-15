from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Response, Header, Query, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt as pyjwt
import hmac
import hashlib
import requests
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
# Defer strict Mongo initialization so missing env vars don't break module import.
mongo_url = os.environ.get('MONGO_URL')
client = None
db = None
if mongo_url:
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'studysync')]
    except Exception:
        # leave db as None; startup() will switch to InMemoryDB if needed
        db = None

# JWT
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRE_DAYS = 30

# Razorpay
RZ_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RZ_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
PREMIUM_PRICE_INR = int(os.environ.get("PREMIUM_PRICE_INR", "99"))

# Object storage
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
APP_NAME = os.environ.get("APP_NAME", "studysync")
storage_key: Optional[str] = None

# Limits
FREE_AI_DAILY = 15
FREE_STORAGE_MB = 25  # cumulative
PREMIUM_STORAGE_MB = 500
MAX_UPLOAD_MB = 50

app = FastAPI(title="StudySync API v2")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)
logger = logging.getLogger("studysync")
logging.basicConfig(level=logging.INFO)

# CORS - allow local frontend dev hosts for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Lightweight in-memory fallback DB for local development when Mongo is unreachable
class InMemoryCollection:
    def __init__(self):
        self._docs = []

    def _matches(self, doc, query):
        if not query:
            return True
        for k, v in query.items():
            # support simple operator queries like {"field": {"$ne": val}} and range ops
            if isinstance(v, dict):
                for op, val in v.items():
                    if op == "$ne":
                        if doc.get(k) == val:
                            return False
                    elif op == "$gte":
                        if doc.get(k) is None or doc.get(k) < val:
                            return False
                    elif op == "$lte":
                        if doc.get(k) is None or doc.get(k) > val:
                            return False
                    elif op == "$gt":
                        if doc.get(k) is None or doc.get(k) <= val:
                            return False
                    elif op == "$lt":
                        if doc.get(k) is None or doc.get(k) >= val:
                            return False
                    else:
                        # unknown operator - skip (treat as non-match to be safe)
                        return False
            else:
                if doc.get(k) != v:
                    return False
        return True

    def _apply_projection(self, doc, projection):
        if not projection:
            return doc.copy()
        # support projection as dict with 0 to exclude fields
        out = doc.copy()
        if isinstance(projection, dict):
            for k, v in projection.items():
                if v == 0 and k in out:
                    out.pop(k, None)
        return out

    async def find_one(self, query=None, projection=None):
        for d in self._docs:
            if self._matches(d, query or {}):
                return self._apply_projection(d, projection)
        return None

    async def insert_one(self, doc):
        d = doc.copy()
        # ensure an id exists
        if "id" not in d:
            d["id"] = str(uuid.uuid4())
        self._docs.append(d)
        class R:
            pass
        r = R()
        r.inserted_id = d.get("id")
        return r

    async def update_one(self, filt, update, upsert=False):
        # support simple operators: $set, $inc, $setOnInsert, $push
        for d in self._docs:
            if self._matches(d, filt or {}):
                if "$set" in update:
                    d.update(update["$set"])
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        d[k] = d.get(k, 0) + v
                if "$push" in update:
                    for k, v in update["$push"].items():
                        if k not in d or not isinstance(d[k], list):
                            d[k] = []
                        d[k].append(v)
                class R:
                    pass
                r = R()
                r.matched_count = 1
                r.modified_count = 1
                r.upserted_id = None
                return r
        # not found - handle upsert
        if upsert:
            # build a new doc from simple equality filters
            new_doc = {}
            for k, v in (filt or {}).items():
                if not isinstance(v, dict):
                    new_doc[k] = v
            # apply setOnInsert then set/inc/push
            if "$setOnInsert" in update:
                new_doc.update(update["$setOnInsert"])
            if "$set" in update:
                new_doc.update(update["$set"])
            if "$inc" in update:
                for k, v in update["$inc"].items():
                    new_doc[k] = new_doc.get(k, 0) + v
            if "$push" in update:
                for k, v in update["$push"].items():
                    if k not in new_doc or not isinstance(new_doc[k], list):
                        new_doc[k] = []
                    new_doc[k].append(v)
            if "id" not in new_doc:
                new_doc["id"] = str(uuid.uuid4())
            self._docs.append(new_doc)
            class R:
                pass
            r = R()
            r.matched_count = 0
            r.modified_count = 0
            r.upserted_id = new_doc.get("id")
            return r
        # if not found and not upsert, return zero counts
        class R:
            pass
        r = R()
        r.matched_count = 0
        r.modified_count = 0
        r.upserted_id = None
        return r

    async def update_many(self, filt, update):
        matched = 0
        for d in self._docs:
            if self._matches(d, filt or {}):
                if "$set" in update:
                    d.update(update["$set"])
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        d[k] = d.get(k, 0) + v
                matched += 1
        class R:
            pass
        r = R()
        r.matched_count = matched
        return r

    async def delete_many(self, filt):
        to_keep = []
        deleted = 0
        for d in self._docs:
            if self._matches(d, filt or {}):
                deleted += 1
            else:
                to_keep.append(d)
        self._docs = to_keep
        class R:
            pass
        r = R()
        r.deleted_count = deleted
        return r

    async def delete_one(self, filt):
        for i, d in enumerate(self._docs):
            if self._matches(d, filt or {}):
                self._docs.pop(i)
                class R:
                    pass
                r = R()
                r.deleted_count = 1
                return r
        class R:
            pass
        r = R()
        r.deleted_count = 0
        return r

    async def count_documents(self, filt=None):
        return sum(1 for d in self._docs if self._matches(d, filt or {}))

    def find(self, filt=None, projection=None):
        # return a simple cursor-like object with sort().to_list()
        items = [self._apply_projection(d, projection) for d in self._docs if self._matches(d, filt or {})]
        class Cursor:
            def __init__(self, items):
                self._items = items
            def sort(self, key, direction=1):
                reverse = direction == -1
                try:
                    self._items.sort(key=lambda x: x.get(key), reverse=reverse)
                except Exception:
                    pass
                return self
            async def to_list(self, n=None):
                if n is None:
                    return [i.copy() for i in self._items]
                return [i.copy() for i in self._items[:n]]
        return Cursor(items)


class InMemoryDB:
    def __init__(self):
        self.users = InMemoryCollection()
        self.tasks = InMemoryCollection()
        self.resources = InMemoryCollection()
        self.study_sessions = InMemoryCollection()
        self.chat_messages = InMemoryCollection()
        self.pomodoro_sessions = InMemoryCollection()
        self.achievements = InMemoryCollection()
        # additional collections used by server

        self.groups = InMemoryCollection()
        self.group_messages = InMemoryCollection()
        self.group_messages = InMemoryCollection()


# ============== Utilities ==============

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def decode_token(token: str) -> Optional[str]:
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload.get("sub")
    except Exception:
        return None

async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Missing token")
    user_id = decode_token(creds.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ============== Object Storage ==============

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_KEY:
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Object storage initialized")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def storage_put(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 403:
        # Re-init once
        globals()["storage_key"] = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()

def storage_get(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    if resp.status_code == 403:
        globals()["storage_key"] = None
        key = init_storage()
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ============== Models ==============

class RegisterReq(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class TaskReq(BaseModel):
    desc: str
    date: Optional[str] = ""

class TaskUpdateReq(BaseModel):
    completed: Optional[bool] = None
    desc: Optional[str] = None
    date: Optional[str] = None

class ResourceReq(BaseModel):
    title: str
    type: str
    link: str
    storage_path: Optional[str] = None
    size: Optional[int] = 0

class GroupReq(BaseModel):
    name: str

class StudyTrackReq(BaseModel):
    seconds: int

class PrefsReq(BaseModel):
    name: Optional[str] = None
    theme: Optional[str] = None
    goal: Optional[int] = None
    notifications: Optional[bool] = None

class ChatReq(BaseModel):
    message: str
    session_id: Optional[str] = None

class GoogleAuthReq(BaseModel):
    session_id: str

class PomodoroReq(BaseModel):
    duration_minutes: int  # 25 typically
    completed: bool = True

class PaymentOrderReq(BaseModel):
    amount: Optional[int] = None  # in INR; default = PREMIUM_PRICE_INR

class PaymentVerifyReq(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class GroupMsgReq(BaseModel):
    text: str

# ============== Startup ==============

@app.on_event("startup")
async def startup():
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@studysync.com")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    admin_name = os.environ.get("ADMIN_NAME", "Admin")
    try:
        existing = await db.users.find_one({"email": admin_email})
    except Exception as e:
        logger.warning(f"MongoDB unavailable, switching to in-memory DB: {e}")
        # fall back to in-memory DB for local development
        globals()["db"] = InMemoryDB()
        existing = await db.users.find_one({"email": admin_email})

    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": admin_name,
            "email": admin_email,
            "password_hash": hash_password(admin_pw),
            "role": "admin",
            "theme": "dark",
            "goal": 4,
            "notifications": False,
            "is_premium": True,
            "created_at": now_iso(),
        })
        logger.info(f"Seeded admin user: {admin_email}")
    else:
        # Ensure existing admin user is premium (idempotent for v2 migration)
        if not existing.get("is_premium"):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"is_premium": True, "role": "admin"}},
            )
            logger.info(f"Upgraded admin to premium: {admin_email}")
    # Init storage
    init_storage()

# ============== Auth ==============

@api.post("/auth/register")
async def register(req: RegisterReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "email": req.email.lower(),
        "password_hash": hash_password(req.password),
        "role": "user",
        "theme": "dark",
        "goal": 4,
        "notifications": False,
        "is_premium": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}

@api.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

# ----- Google Auth (Emergent-managed) -----

@api.post("/auth/google")
async def google_auth(req: GoogleAuthReq):
    """Exchange Emergent session_id for our JWT token. Creates user on first sign-in."""
    try:
        resp = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": req.session_id},
            timeout=15,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google session")
        info = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Auth provider error: {e}")

    email = (info.get("email") or "").lower()
    name = info.get("name") or (email.split("@")[0] if email else "User")
    picture = info.get("picture") or ""
    if not email:
        raise HTTPException(status_code=400, detail="No email returned by provider")

    existing = await db.users.find_one({"email": email})
    if existing:
        await db.users.update_one(
            {"id": existing["id"]},
            {"$set": {"name": name, "picture": picture, "last_login": now_iso()}},
        )
        user_doc = await db.users.find_one({"id": existing["id"]}, {"_id": 0, "password_hash": 0})
    else:
        user_doc = {
            "id": str(uuid.uuid4()),
            "name": name,
            "email": email,
            "picture": picture,
            "password_hash": "",
            "auth_provider": "google",
            "role": "user",
            "theme": "dark",
            "goal": 4,
            "notifications": False,
            "is_premium": False,
            "created_at": now_iso(),
            "last_login": now_iso(),
        }
        await db.users.insert_one(user_doc)
        user_doc.pop("password_hash", None)
        user_doc.pop("_id", None)
    token = create_token(user_doc["id"])
    return {"token": token, "user": user_doc}


# ----- Public Stats (landing page) -----

@api.get("/public/stats")
async def public_stats():
    users = await db.users.count_documents({})
    pomos = await db.pomodoro_sessions.count_documents({"completed": True})
    tasks_done = await db.tasks.count_documents({"completed": True})
    return {"users": users, "pomodoros": pomos, "tasks_completed": tasks_done}



# ============== Tasks ==============

@api.get("/tasks")
async def list_tasks(user=Depends(get_current_user)):
    items = await db.tasks.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/tasks")
async def add_task(req: TaskReq, user=Depends(get_current_user)):
    task = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "desc": req.desc,
        "date": req.date or "",
        "completed": False,
        "created_at": now_iso(),
    }
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task

@api.put("/tasks/{task_id}")
async def update_task(task_id: str, req: TaskUpdateReq, user=Depends(get_current_user)):
    update = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    r = await db.tasks.update_one({"id": task_id, "user_id": user["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return await db.tasks.find_one({"id": task_id}, {"_id": 0})

@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(get_current_user)):
    r = await db.tasks.delete_one({"id": task_id, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}

# ============== Resources ==============

@api.get("/resources")
async def list_resources(user=Depends(get_current_user)):
    return await db.resources.find({"user_id": user["id"], "is_deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/resources")
async def add_resource(req: ResourceReq, user=Depends(get_current_user)):
    res = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": req.title,
        "type": req.type,
        "link": req.link,
        "storage_path": req.storage_path or "",
        "size": req.size or 0,
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.resources.insert_one(res)
    res.pop("_id", None)
    return res

@api.delete("/resources/{rid}")
async def delete_resource(rid: str, user=Depends(get_current_user)):
    # Soft delete
    r = await db.resources.update_one({"id": rid, "user_id": user["id"]}, {"$set": {"is_deleted": True}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {"ok": True}

@api.get("/storage/usage")
async def storage_usage(user=Depends(get_current_user)):
    items = await db.resources.find({"user_id": user["id"], "is_deleted": {"$ne": True}}, {"size": 1, "_id": 0}).to_list(1000)
    used = sum((it.get("size") or 0) for it in items)
    limit = PREMIUM_STORAGE_MB * 1024 * 1024 if user.get("is_premium") else FREE_STORAGE_MB * 1024 * 1024
    return {"used_bytes": used, "limit_bytes": limit, "is_premium": bool(user.get("is_premium"))}

# ============== File Upload via Object Storage ==============

@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    data = await file.read()
    size = len(data)
    if size > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_MB}MB)")

    # Quota check
    items = await db.resources.find({"user_id": user["id"], "is_deleted": {"$ne": True}}, {"size": 1, "_id": 0}).to_list(1000)
    used = sum((it.get("size") or 0) for it in items)
    limit = PREMIUM_STORAGE_MB * 1024 * 1024 if user.get("is_premium") else FREE_STORAGE_MB * 1024 * 1024
    if used + size > limit:
        raise HTTPException(
            status_code=402,
            detail=f"Storage quota exceeded. {'Upgrade to Premium' if not user.get('is_premium') else 'Contact support'} to increase your limit.",
        )

    ext = (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin").lower()
    safe_uid = user["id"]
    path = f"{APP_NAME}/uploads/{safe_uid}/{uuid.uuid4()}.{ext}"
    content_type = file.content_type or "application/octet-stream"
    result = storage_put(path, data, content_type)

    return {
        "storage_path": result.get("path", path),
        "size": result.get("size", size),
        "content_type": content_type,
        "original_filename": file.filename,
    }

@api.get("/files/{path:path}")
async def download_file(path: str, auth: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    elif auth:
        token = auth
    if not token or not decode_token(token):
        raise HTTPException(status_code=401, detail="Auth required")
    data, content_type = storage_get(path)
    return Response(content=data, media_type=content_type)

# ============== Groups ==============

@api.get("/groups")
async def list_groups(user=Depends(get_current_user)):
    # No default seeds — per user request
    return await db.groups.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/groups")
async def create_group(req: GroupReq, user=Depends(get_current_user)):
    grp = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "host": user["name"],
        "host_id": user["id"],
        "members": 1,
        "user_ids": [user["id"]],
        "created_at": now_iso(),
    }
    await db.groups.insert_one(grp)
    grp.pop("_id", None)
    return grp

@api.post("/groups/{gid}/join")
async def join_group(gid: str, user=Depends(get_current_user)):
    grp = await db.groups.find_one({"id": gid}, {"_id": 0})
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found")
    if user["id"] in grp.get("user_ids", []):
        return grp
    await db.groups.update_one({"id": gid}, {"$push": {"user_ids": user["id"]}, "$inc": {"members": 1}})
    return await db.groups.find_one({"id": gid}, {"_id": 0})

@api.delete("/groups/{gid}")
async def delete_group(gid: str, user=Depends(get_current_user)):
    grp = await db.groups.find_one({"id": gid})
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found")
    if grp.get("host_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only host or admin can delete")
    await db.groups.delete_one({"id": gid})
    await db.group_messages.delete_many({"group_id": gid})
    return {"ok": True}

# ----- Group chat messages (REST + WebSocket) -----

@api.get("/groups/{gid}/messages")
async def list_group_messages(gid: str, user=Depends(get_current_user)):
    return await db.group_messages.find({"group_id": gid}, {"_id": 0}).sort("created_at", 1).to_list(200)

@api.post("/groups/{gid}/messages")
async def post_group_message(gid: str, req: GroupMsgReq, user=Depends(get_current_user)):
    grp = await db.groups.find_one({"id": gid}, {"_id": 0})
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found")
    msg = {
        "id": str(uuid.uuid4()),
        "group_id": gid,
        "user_id": user["id"],
        "user_name": user["name"],
        "text": req.text[:2000],
        "created_at": now_iso(),
    }
    await db.group_messages.insert_one(msg)
    msg.pop("_id", None)
    await ws_manager.broadcast(gid, msg)
    return msg

# WebSocket manager
class WSManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, gid: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(gid, []).append(ws)

    def disconnect(self, gid: str, ws: WebSocket):
        if gid in self.rooms and ws in self.rooms[gid]:
            self.rooms[gid].remove(ws)

    async def broadcast(self, gid: str, msg: dict):
        if gid not in self.rooms:
            return
        dead = []
        for s in self.rooms[gid]:
            try:
                await s.send_json(msg)
            except Exception:
                dead.append(s)
        for s in dead:
            self.rooms[gid].remove(s)

ws_manager = WSManager()

@app.websocket("/api/ws/groups/{gid}")
async def group_ws(websocket: WebSocket, gid: str, token: Optional[str] = Query(None)):
    if not token or not decode_token(token):
        await websocket.close(code=1008)
        return
    user_id = decode_token(token)
    user = await db.users.find_one({"id": user_id})
    if not user:
        await websocket.close(code=1008)
        return
    await ws_manager.connect(gid, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            text = (data.get("text") or "").strip()[:2000]
            if not text:
                continue
            msg = {
                "id": str(uuid.uuid4()),
                "group_id": gid,
                "user_id": user_id,
                "user_name": user["name"],
                "text": text,
                "created_at": now_iso(),
            }
            await db.group_messages.insert_one(dict(msg))
            await ws_manager.broadcast(gid, msg)
    except WebSocketDisconnect:
        ws_manager.disconnect(gid, websocket)
    except Exception as e:
        logger.error(f"WS error: {e}")
        ws_manager.disconnect(gid, websocket)

# ============== Study Tracking ==============

@api.get("/study/today")
async def study_today(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    rec = await db.study_sessions.find_one({"user_id": user["id"], "date": today}, {"_id": 0})
    if not rec:
        rec = {"user_id": user["id"], "date": today, "seconds": 0}
    return rec

@api.post("/study/track")
async def study_track(req: StudyTrackReq, user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    await db.study_sessions.update_one(
        {"user_id": user["id"], "date": today},
        {"$inc": {"seconds": max(0, int(req.seconds))}, "$setOnInsert": {"created_at": now_iso()}},
        upsert=True,
    )
    return await db.study_sessions.find_one({"user_id": user["id"], "date": today}, {"_id": 0})

@api.get("/study/history")
async def study_history(user=Depends(get_current_user)):
    return await db.study_sessions.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(30)

# ============== Pomodoro & Achievements ==============

@api.post("/pomodoro/complete")
async def pomodoro_complete(req: PomodoroReq, user=Depends(get_current_user)):
    rec = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "duration_minutes": req.duration_minutes,
        "completed": req.completed,
        "created_at": now_iso(),
    }
    await db.pomodoro_sessions.insert_one(rec)
    # Also add to study seconds
    today = datetime.now(timezone.utc).date().isoformat()
    await db.study_sessions.update_one(
        {"user_id": user["id"], "date": today},
        {"$inc": {"seconds": req.duration_minutes * 60}, "$setOnInsert": {"created_at": now_iso()}},
        upsert=True,
    )
    # Check achievements
    total = await db.pomodoro_sessions.count_documents({"user_id": user["id"], "completed": True})
    achievements = []
    milestones = [
        (1, "First Pomodoro!", "Completed your first focus session."),
        (5, "Focused Five", "5 pomodoros completed."),
        (10, "Double Digits", "10 pomodoros in the bank."),
        (25, "Quarter Century", "25 sessions — you're a machine."),
        (50, "Half Ton", "50 deep focus sessions."),
        (100, "Centurion", "100 pomodoros. Legendary."),
    ]
    for n, title, desc in milestones:
        if total == n:
            ach = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "title": title,
                "desc": desc,
                "created_at": now_iso(),
            }
            await db.achievements.insert_one(ach)
            ach.pop("_id", None)
            achievements.append(ach)
    rec.pop("_id", None)
    return {"session": rec, "total": total, "new_achievements": achievements}

@api.get("/pomodoro/stats")
async def pomodoro_stats(user=Depends(get_current_user)):
    total = await db.pomodoro_sessions.count_documents({"user_id": user["id"], "completed": True})
    today = datetime.now(timezone.utc).date().isoformat()
    today_count = await db.pomodoro_sessions.count_documents({
        "user_id": user["id"], "completed": True, "created_at": {"$gte": today}
    })
    return {"total": total, "today": today_count}

@api.get("/achievements")
async def list_achievements(user=Depends(get_current_user)):
    return await db.achievements.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)

# ============== Preferences ==============

@api.put("/preferences")
async def update_prefs(req: PrefsReq, user=Depends(get_current_user)):
    update = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update:
        return user
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})

# ============== AI Tutor (with rate limit for free users) ==============

@api.post("/ai/chat")
async def ai_chat(req: ChatReq, user=Depends(get_current_user)):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    except ImportError:
        raise HTTPException(status_code=500, detail="AI provider library is not installed")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    # Free tier rate limit
    if not user.get("is_premium"):
        today = datetime.now(timezone.utc).date().isoformat()
        count = await db.chat_messages.count_documents({
            "user_id": user["id"], "role": "user", "created_at": {"$gte": today}
        })
        if count >= FREE_AI_DAILY:
            raise HTTPException(
                status_code=402,
                detail=f"Daily AI limit reached ({FREE_AI_DAILY} free messages/day). Upgrade to Premium for unlimited tutoring.",
            )

    session_id = req.session_id or f"{user['id']}-default"
    # Premium users get priority model
    model_name = "gemini-2.5-pro" if user.get("is_premium") else "gemini-2.5-flash"

    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=(
            "You are StudySync AI Tutor, a friendly and knowledgeable study assistant. "
            "Help students with step-by-step explanations, examples, and motivation. "
            "Use markdown when helpful. Keep answers concise but thorough."
        ),
    ).with_model("gemini", model_name)

    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": session_id,
        "role": "user",
        "text": req.message,
        "created_at": now_iso(),
    })

    async def event_stream():
        full = ""
        try:
            async for event in chat.stream_message(UserMessage(text=req.message)):
                if isinstance(event, TextDelta):
                    full += event.content
                    # JSON-encode to preserve newlines through SSE
                    import json as _json
                    yield f"data: {_json.dumps({'type': 'delta', 'content': event.content})}\n\n"
                elif isinstance(event, StreamDone):
                    break
        except Exception as e:
            import json as _json
            yield f"data: {_json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        await db.chat_messages.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "session_id": session_id,
            "role": "assistant",
            "text": full,
            "created_at": now_iso(),
        })
        import json as _json
        yield f"data: {_json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@api.get("/ai/history")
async def ai_history(user=Depends(get_current_user), session_id: Optional[str] = None):
    q = {"user_id": user["id"]}
    if session_id:
        q["session_id"] = session_id
    return await db.chat_messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)

@api.delete("/ai/history")
async def clear_ai_history(user=Depends(get_current_user)):
    await db.chat_messages.delete_many({"user_id": user["id"]})
    return {"ok": True}

@api.get("/ai/usage")
async def ai_usage(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    count = await db.chat_messages.count_documents({
        "user_id": user["id"], "role": "user", "created_at": {"$gte": today}
    })
    return {"used_today": count, "limit": (-1 if user.get("is_premium") else FREE_AI_DAILY), "is_premium": bool(user.get("is_premium"))}

# ============== Payments (Razorpay) ==============

def get_razorpay_client():
    try:
        import razorpay
        if not RZ_KEY_ID or not RZ_KEY_SECRET or "placeholder" in RZ_KEY_ID.lower():
            return None
        return razorpay.Client(auth=(RZ_KEY_ID, RZ_KEY_SECRET))
    except Exception as e:
        logger.error(f"Razorpay init error: {e}")
        return None

@api.get("/payments/config")
async def payments_config(user=Depends(get_current_user)):
    """Public-ish config (key id only) for frontend checkout."""
    configured = bool(RZ_KEY_ID and "placeholder" not in RZ_KEY_ID.lower())
    return {
        "key_id": RZ_KEY_ID if configured else "",
        "amount_inr": PREMIUM_PRICE_INR,
        "amount_paise": PREMIUM_PRICE_INR * 100,
        "configured": configured,
        "is_premium": bool(user.get("is_premium")),
    }

@api.post("/payments/create-order")
async def create_order(req: PaymentOrderReq, user=Depends(get_current_user)):
    if user.get("is_premium"):
        raise HTTPException(status_code=400, detail="Already premium")
    cli = get_razorpay_client()
    amount_inr = req.amount or PREMIUM_PRICE_INR
    amount_paise = amount_inr * 100
    if cli is None:
        # Demo mode — return a fake order id so frontend can show flow, but mark demo
        order_id = f"order_demo_{uuid.uuid4().hex[:14]}"
        await db.payments.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "order_id": order_id,
            "amount": amount_paise,
            "currency": "INR",
            "status": "demo_created",
            "demo": True,
            "created_at": now_iso(),
        })
        return {"id": order_id, "amount": amount_paise, "currency": "INR", "demo": True}
    try:
        order = cli.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {"user_id": user["id"], "purpose": "studysync_premium"},
        })
        await db.payments.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "order_id": order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "status": "created",
            "demo": False,
            "created_at": now_iso(),
        })
        return order
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay error: {e}")

@api.post("/payments/verify")
async def verify_payment(req: PaymentVerifyReq, user=Depends(get_current_user)):
    cli = get_razorpay_client()
    if cli is None:
        # Demo mode: accept verification automatically
        await db.users.update_one({"id": user["id"]}, {"$set": {"is_premium": True, "premium_since": now_iso()}})
        await db.payments.update_one(
            {"order_id": req.razorpay_order_id},
            {"$set": {"status": "demo_paid", "payment_id": req.razorpay_payment_id}},
        )
        return {"ok": True, "demo": True, "is_premium": True}
    try:
        cli.utility.verify_payment_signature({
            "razorpay_order_id": req.razorpay_order_id,
            "razorpay_payment_id": req.razorpay_payment_id,
            "razorpay_signature": req.razorpay_signature,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_premium": True, "premium_since": now_iso()}})
    await db.payments.update_one(
        {"order_id": req.razorpay_order_id},
        {"$set": {"status": "paid", "payment_id": req.razorpay_payment_id, "paid_at": now_iso()}},
    )
    return {"ok": True, "is_premium": True}

@api.post("/payments/free-upgrade")
async def free_upgrade(user=Depends(get_current_user)):
    """Owner-controlled free unlock — keeps premium grant logic in one place so we can later flip it back to Razorpay-only."""
    if user.get("is_premium"):
        return {"ok": True, "is_premium": True, "already": True}
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_premium": True, "premium_since": now_iso(), "upgrade_method": "free"}},
    )
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "order_id": f"free_{uuid.uuid4().hex[:14]}",
        "amount": 0,
        "currency": "INR",
        "status": "free_granted",
        "demo": True,
        "created_at": now_iso(),
    })
    return {"ok": True, "is_premium": True}

# ============== Dashboard ==============

@api.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    tasks = await db.tasks.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    resources_count = await db.resources.count_documents({"user_id": user["id"], "is_deleted": {"$ne": True}})
    groups_count = await db.groups.count_documents({})
    rec = await db.study_sessions.find_one({"user_id": user["id"], "date": today}, {"_id": 0})
    seconds = rec["seconds"] if rec else 0
    pending = [t for t in tasks if not t.get("completed")]
    completed = [t for t in tasks if t.get("completed")]
    pct = round((len(completed) / len(tasks)) * 100) if tasks else 0
    pomos_today = await db.pomodoro_sessions.count_documents({
        "user_id": user["id"], "completed": True, "created_at": {"$gte": today}
    })
    return {
        "tasks_total": len(tasks),
        "tasks_pending": len(pending),
        "tasks_completed": len(completed),
        "completion_pct": pct,
        "resources_count": resources_count,
        "groups_count": groups_count,
        "study_seconds_today": seconds,
        "goal_hours": user.get("goal", 4),
        "pomodoros_today": pomos_today,
        "is_premium": bool(user.get("is_premium")),
    }

@api.post("/reset")
async def reset_data(user=Depends(get_current_user)):
    await db.tasks.delete_many({"user_id": user["id"]})
    await db.resources.update_many({"user_id": user["id"]}, {"$set": {"is_deleted": True}})
    await db.study_sessions.delete_many({"user_id": user["id"]})
    await db.chat_messages.delete_many({"user_id": user["id"]})
    await db.pomodoro_sessions.delete_many({"user_id": user["id"]})
    await db.achievements.delete_many({"user_id": user["id"]})
    return {"ok": True}

@api.get("/")
async def root():
    return {"app": "StudySync", "version": "2.0", "status": "ok"}

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
