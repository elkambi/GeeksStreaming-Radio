from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from typing import List, Optional
import os
import uuid
from datetime import datetime
import hashlib
import jwt
from passlib.context import CryptContext
from bson import ObjectId
import json

# Custom JSON encoder for MongoDB ObjectId
class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return super().default(o)

# Helper function to convert MongoDB documents
def convert_mongo_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

# Environment variables
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
JWT_SECRET = os.environ.get('JWT_SECRET', 'radio-admin-secret-key-2025')

# Database setup
client = MongoClient(MONGO_URL)
db = client.radio_admin
clients_collection = db.clients
streams_collection = db.streams
users_collection = db.users

# FastAPI app
app = FastAPI(title="Radio Admin Panel API", version="1.0.0")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pydantic models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password: str
    role: str = "admin"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserLogin(BaseModel):
    username: str
    password: str

class RadioClient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    status: str = "active"  # active, suspended, inactive
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    max_streams: int = 1
    max_listeners: int = 100
    bandwidth_limit: int = 128  # kbps

class RadioStream(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    name: str
    description: Optional[str] = None
    port: int
    mount_point: str = "/stream"
    bitrate: int = 128
    max_listeners: int = 100
    format: str = "mp3"  # mp3, aac, ogg
    status: str = "stopped"  # running, stopped, error
    stream_url: Optional[str] = None
    admin_password: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    source_password: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class StreamStatus(BaseModel):
    stream_id: str
    status: str
    current_listeners: int = 0
    peak_listeners: int = 0
    total_bytes: int = 0
    uptime: int = 0
    current_song: Optional[str] = None

# Authentication functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_jwt_token(user_data: dict) -> str:
    return jwt.encode(user_data, JWT_SECRET, algorithm="HS256")

def verify_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    user_data = verify_jwt_token(token)
    return user_data

# Initialize default admin user
@app.on_event("startup")
async def startup_event():
    # Check if admin exists
    admin_exists = users_collection.find_one({"username": "admin"})
    if not admin_exists:
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": "admin@radioserver.com",
            "password": hash_password("admin123"),
            "role": "admin",
            "created_at": datetime.utcnow()
        }
        users_collection.insert_one(admin_user)
        print("✅ Default admin user created: admin/admin123")

# Auth routes
@app.post("/api/auth/login")
async def login(user_login: UserLogin):
    user = users_collection.find_one({"username": user_login.username})
    if not user or not verify_password(user_login.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token_data = {
        "user_id": user["id"],
        "username": user["username"],
        "role": user["role"]
    }
    token = create_jwt_token(token_data)
    return {"access_token": token, "token_type": "bearer", "user": token_data}

@app.get("/api/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return current_user

# Client management routes
@app.get("/api/clients", response_model=List[dict])
async def get_clients(current_user: dict = Depends(get_current_user)):
    clients = list(clients_collection.find({}, {"_id": 0}))
    # Add stream count for each client
    for client in clients:
        stream_count = streams_collection.count_documents({"client_id": client["id"]})
        client["stream_count"] = stream_count
    return clients

@app.post("/api/clients")
async def create_client(client: RadioClient, current_user: dict = Depends(get_current_user)):
    client_dict = client.dict()
    
    # Check if email already exists
    existing_client = clients_collection.find_one({"email": client.email})
    if existing_client:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Insert and get the inserted document
    result = clients_collection.insert_one(client_dict)
    
    # Return the client data without MongoDB ObjectId
    created_client = clients_collection.find_one({"id": client_dict["id"]}, {"_id": 0})
    return {"message": "Client created successfully", "client": created_client}

@app.get("/api/clients/{client_id}")
async def get_client(client_id: str, current_user: dict = Depends(get_current_user)):
    client = clients_collection.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@app.put("/api/clients/{client_id}")
async def update_client(client_id: str, client_update: dict, current_user: dict = Depends(get_current_user)):
    client = clients_collection.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client_update["updated_at"] = datetime.utcnow()
    clients_collection.update_one({"id": client_id}, {"$set": client_update})
    return {"message": "Client updated successfully"}

@app.delete("/api/clients/{client_id}")
async def delete_client(client_id: str, current_user: dict = Depends(get_current_user)):
    client = clients_collection.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Delete all streams for this client
    streams_collection.delete_many({"client_id": client_id})
    clients_collection.delete_one({"id": client_id})
    return {"message": "Client and associated streams deleted successfully"}

# Stream management routes
@app.get("/api/streams", response_model=List[dict])
async def get_streams(current_user: dict = Depends(get_current_user)):
    streams = list(streams_collection.find({}, {"_id": 0}))
    # Add client info to each stream
    for stream in streams:
        client = clients_collection.find_one({"id": stream["client_id"]}, {"_id": 0})
        stream["client_name"] = client["name"] if client else "Unknown"
    return streams

@app.get("/api/clients/{client_id}/streams")
async def get_client_streams(client_id: str, current_user: dict = Depends(get_current_user)):
    streams = list(streams_collection.find({"client_id": client_id}, {"_id": 0}))
    return streams

@app.post("/api/clients/{client_id}/streams")
async def create_stream(client_id: str, stream: RadioStream, current_user: dict = Depends(get_current_user)):
    # Verify client exists
    client = clients_collection.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Check stream limit
    current_streams = streams_collection.count_documents({"client_id": client_id})
    if current_streams >= client["max_streams"]:
        raise HTTPException(status_code=400, detail="Stream limit exceeded for this client")
    
    # Check if port is already used
    existing_stream = streams_collection.find_one({"port": stream.port})
    if existing_stream:
        raise HTTPException(status_code=400, detail="Port already in use")
    
    stream.client_id = client_id
    stream_dict = stream.dict()
    stream_dict["stream_url"] = f"http://radio-server.com:{stream.port}{stream.mount_point}"
    
    # Insert and get the inserted document
    result = streams_collection.insert_one(stream_dict)
    
    # Return the stream data without MongoDB ObjectId
    created_stream = streams_collection.find_one({"id": stream_dict["id"]}, {"_id": 0})
    return {"message": "Stream created successfully", "stream": created_stream}

@app.put("/api/streams/{stream_id}")
async def update_stream(stream_id: str, stream_update: dict, current_user: dict = Depends(get_current_user)):
    stream = streams_collection.find_one({"id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    stream_update["updated_at"] = datetime.utcnow()
    streams_collection.update_one({"id": stream_id}, {"$set": stream_update})
    return {"message": "Stream updated successfully"}

@app.delete("/api/streams/{stream_id}")
async def delete_stream(stream_id: str, current_user: dict = Depends(get_current_user)):
    stream = streams_collection.find_one({"id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    streams_collection.delete_one({"id": stream_id})
    return {"message": "Stream deleted successfully"}

# Stream control routes
@app.post("/api/streams/{stream_id}/start")
async def start_stream(stream_id: str, current_user: dict = Depends(get_current_user)):
    stream = streams_collection.find_one({"id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    # TODO: Implement actual stream server integration (Icecast/SHOUTcast)
    streams_collection.update_one(
        {"id": stream_id}, 
        {"$set": {"status": "running", "updated_at": datetime.utcnow()}}
    )
    return {"message": "Stream started successfully"}

@app.post("/api/streams/{stream_id}/stop")
async def stop_stream(stream_id: str, current_user: dict = Depends(get_current_user)):
    stream = streams_collection.find_one({"id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    # TODO: Implement actual stream server integration
    streams_collection.update_one(
        {"id": stream_id}, 
        {"$set": {"status": "stopped", "updated_at": datetime.utcnow()}}
    )
    return {"message": "Stream stopped successfully"}

# Dashboard stats
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_clients = clients_collection.count_documents({})
    active_clients = clients_collection.count_documents({"status": "active"})
    total_streams = streams_collection.count_documents({})
    running_streams = streams_collection.count_documents({"status": "running"})
    
    return {
        "total_clients": total_clients,
        "active_clients": active_clients,
        "total_streams": total_streams,
        "running_streams": running_streams,
        "bandwidth_usage": "2.5 GB",  # TODO: Implement real bandwidth tracking
        "server_uptime": "5 days, 3 hours"  # TODO: Implement real uptime tracking
    }

@app.get("/api/dashboard/recent-activity")
async def get_recent_activity(current_user: dict = Depends(get_current_user)):
    # Get recent clients and streams
    recent_clients = list(clients_collection.find({}, {"_id": 0}).sort("created_at", -1).limit(5))
    recent_streams = list(streams_collection.find({}, {"_id": 0}).sort("created_at", -1).limit(5))
    
    activity = []
    
    for client in recent_clients:
        activity.append({
            "type": "client_created",
            "message": f"New client '{client['name']}' registered",
            "timestamp": client["created_at"],
            "icon": "user-plus"
        })
    
    for stream in recent_streams:
        client = clients_collection.find_one({"id": stream["client_id"]})
        client_name = client["name"] if client else "Unknown"
        activity.append({
            "type": "stream_created",
            "message": f"New stream '{stream['name']}' created for {client_name}",
            "timestamp": stream["created_at"],
            "icon": "radio"
        })
    
    # Sort by timestamp
    activity.sort(key=lambda x: x["timestamp"], reverse=True)
    return activity[:10]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)