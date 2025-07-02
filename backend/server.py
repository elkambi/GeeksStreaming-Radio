from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime, timedelta
import hashlib
import jwt
from passlib.context import CryptContext
from bson import ObjectId
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import subprocess
import psutil
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
ICECAST_HOST = os.environ.get('ICECAST_HOST', 'localhost')
ICECAST_PORT = os.environ.get('ICECAST_PORT', '8000')
ICECAST_ADMIN_PASSWORD = os.environ.get('ICECAST_ADMIN_PASSWORD', 'hackme')
SMTP_HOST = os.environ.get('SMTP_HOST', 'localhost')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', 'noreply@localhost')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

# Database setup
client = MongoClient(MONGO_URL)
db = client.radio_admin
clients_collection = db.clients
streams_collection = db.streams
users_collection = db.users
analytics_collection = db.analytics
billing_collection = db.billing
schedules_collection = db.schedules
server_config_collection = db.server_config

# FastAPI app
app = FastAPI(title="Radio Admin Panel API", version="2.0.0")

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
    permissions: List[str] = ["read", "write", "admin"]

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
    billing_plan: str = "basic"  # basic, premium, enterprise
    monthly_fee: float = 0.0

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
    auto_dj: bool = False
    playlist_id: Optional[str] = None

class StreamStatus(BaseModel):
    stream_id: str
    status: str
    current_listeners: int = 0
    peak_listeners: int = 0
    total_bytes: int = 0
    uptime: int = 0
    current_song: Optional[str] = None

class ServerConfig(BaseModel):
    key: str
    value: Any
    category: str  # system, email, streaming, security
    description: str
    updated_by: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AnalyticsRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    stream_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    listeners: int
    bandwidth_used: float
    song_title: Optional[str] = None
    user_agent: Optional[str] = None

class BillingRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    amount: float
    status: str  # pending, paid, overdue, cancelled
    billing_period: str  # monthly, yearly
    due_date: datetime
    paid_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Schedule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    stream_id: str
    name: str
    start_time: str  # HH:MM format
    end_time: str
    days: List[str]  # ["monday", "tuesday", ...]
    playlist_id: Optional[str] = None
    dj_name: Optional[str] = None
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

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

# Email functions
def send_email(to_email: str, subject: str, body: str):
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        text = msg.as_string()
        server.sendmail(SMTP_USER, to_email, text)
        server.quit()
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False

# Icecast integration functions
def get_icecast_stats():
    try:
        response = requests.get(f"http://{ICECAST_HOST}:{ICECAST_PORT}/admin/stats", 
                              auth=('admin', ICECAST_ADMIN_PASSWORD))
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error(f"Failed to get Icecast stats: {e}")
    return {}

def control_icecast_stream(mount_point: str, action: str):
    try:
        url = f"http://{ICECAST_HOST}:{ICECAST_PORT}/admin/{action}"
        params = {'mount': mount_point}
        response = requests.get(url, params=params, auth=('admin', ICECAST_ADMIN_PASSWORD))
        return response.status_code == 200
    except Exception as e:
        logger.error(f"Failed to control stream: {e}")
        return False

# System monitoring functions
def get_system_stats():
    try:
        return {
            "cpu_percent": psutil.cpu_percent(interval=1),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent,
            "network_io": dict(psutil.net_io_counters()._asdict()),
            "uptime": datetime.now() - datetime.fromtimestamp(psutil.boot_time()),
            "load_average": os.getloadavg() if hasattr(os, 'getloadavg') else [0, 0, 0]
        }
    except Exception as e:
        logger.error(f"Failed to get system stats: {e}")
        return {}

# Initialize default admin user and server config
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
            "permissions": ["read", "write", "admin"],
            "created_at": datetime.utcnow()
        }
        users_collection.insert_one(admin_user)
        logger.info("✅ Default admin user created: admin/admin123")

    # Initialize default server config
    default_configs = [
        {"key": "site_name", "value": "Radio Admin Panel", "category": "system", "description": "Site name displayed in UI"},
        {"key": "site_url", "value": "https://localhost", "category": "system", "description": "Base URL of the site"},
        {"key": "max_clients", "value": 100, "category": "system", "description": "Maximum number of clients allowed"},
        {"key": "max_streams_per_client", "value": 5, "category": "system", "description": "Maximum streams per client"},
        {"key": "smtp_enabled", "value": False, "category": "email", "description": "Enable email notifications"},
        {"key": "icecast_enabled", "value": True, "category": "streaming", "description": "Enable Icecast integration"},
        {"key": "auto_backup", "value": True, "category": "system", "description": "Enable automatic backups"},
        {"key": "backup_retention_days", "value": 30, "category": "system", "description": "Days to keep backups"},
    ]
    
    for config in default_configs:
        existing = server_config_collection.find_one({"key": config["key"]})
        if not existing:
            config.update({
                "updated_by": "system",
                "updated_at": datetime.utcnow()
            })
            server_config_collection.insert_one(config)
    
    logger.info("✅ Server configuration initialized")

# Auth routes
@app.post("/api/auth/login")
async def login(user_login: UserLogin):
    user = users_collection.find_one({"username": user_login.username})
    if not user or not verify_password(user_login.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token_data = {
        "user_id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "permissions": user.get("permissions", ["read"])
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
    # Add stream count and billing info for each client
    for client in clients:
        stream_count = streams_collection.count_documents({"client_id": client["id"]})
        client["stream_count"] = stream_count
        
        # Get latest billing info
        latest_bill = billing_collection.find_one(
            {"client_id": client["id"]}, 
            sort=[("created_at", -1)]
        )
        client["billing_status"] = latest_bill["status"] if latest_bill else "none"
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
    
    # Send welcome email
    if SMTP_HOST and SMTP_USER:
        welcome_email = f"""
        <h2>Welcome to Radio Admin Panel!</h2>
        <p>Dear {client.name},</p>
        <p>Your account has been created successfully.</p>
        <p><strong>Account Details:</strong></p>
        <ul>
            <li>Max Streams: {client.max_streams}</li>
            <li>Max Listeners: {client.max_listeners}</li>
            <li>Bandwidth Limit: {client.bandwidth_limit} kbps</li>
        </ul>
        <p>Best regards,<br>Radio Admin Team</p>
        """
        send_email(client.email, "Welcome to Radio Admin Panel", welcome_email)
    
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
    # Add client info and real-time stats to each stream
    for stream in streams:
        client = clients_collection.find_one({"id": stream["client_id"]}, {"_id": 0})
        stream["client_name"] = client["name"] if client else "Unknown"
        
        # Get real-time stats from Icecast
        icecast_stats = get_icecast_stats()
        if icecast_stats and stream["mount_point"] in icecast_stats:
            stream_stats = icecast_stats[stream["mount_point"]]
            stream["current_listeners"] = stream_stats.get("listeners", 0)
            stream["peak_listeners"] = stream_stats.get("listener_peak", 0)
            stream["current_song"] = stream_stats.get("title", "")
        
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
    stream_dict["stream_url"] = f"http://{ICECAST_HOST}:{stream.port}{stream.mount_point}"
    
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
    
    # Stop stream if running
    if stream["status"] == "running":
        control_icecast_stream(stream["mount_point"], "killsource")
    
    streams_collection.delete_one({"id": stream_id})
    return {"message": "Stream deleted successfully"}

# Stream control routes with real Icecast integration
@app.post("/api/streams/{stream_id}/start")
async def start_stream(stream_id: str, current_user: dict = Depends(get_current_user)):
    stream = streams_collection.find_one({"id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    # Start stream on Icecast
    success = control_icecast_stream(stream["mount_point"], "enable")
    status = "running" if success else "error"
    
    streams_collection.update_one(
        {"id": stream_id}, 
        {"$set": {"status": status, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Stream {'started' if success else 'failed to start'}", "status": status}

@app.post("/api/streams/{stream_id}/stop")
async def stop_stream(stream_id: str, current_user: dict = Depends(get_current_user)):
    stream = streams_collection.find_one({"id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    # Stop stream on Icecast
    success = control_icecast_stream(stream["mount_point"], "killsource")
    
    streams_collection.update_one(
        {"id": stream_id}, 
        {"$set": {"status": "stopped", "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Stream stopped successfully"}

# Analytics routes
@app.get("/api/analytics/dashboard")
async def get_analytics_dashboard(current_user: dict = Depends(get_current_user)):
    # Get analytics for last 24 hours
    yesterday = datetime.utcnow() - timedelta(days=1)
    
    # Total listeners over time
    listener_stats = list(analytics_collection.find(
        {"timestamp": {"$gte": yesterday}},
        {"_id": 0}
    ).sort("timestamp", 1))
    
    # Bandwidth usage
    total_bandwidth = sum(record.get("bandwidth_used", 0) for record in listener_stats)
    
    # Most popular streams
    stream_popularity = {}
    for record in listener_stats:
        stream_id = record["stream_id"]
        if stream_id not in stream_popularity:
            stream_popularity[stream_id] = 0
        stream_popularity[stream_id] += record.get("listeners", 0)
    
    return {
        "listener_history": listener_stats,
        "total_bandwidth_24h": total_bandwidth,
        "popular_streams": sorted(stream_popularity.items(), key=lambda x: x[1], reverse=True)[:5],
        "system_stats": get_system_stats()
    }

@app.get("/api/analytics/stream/{stream_id}")
async def get_stream_analytics(stream_id: str, days: int = 7, current_user: dict = Depends(get_current_user)):
    start_date = datetime.utcnow() - timedelta(days=days)
    
    analytics = list(analytics_collection.find(
        {"stream_id": stream_id, "timestamp": {"$gte": start_date}},
        {"_id": 0}
    ).sort("timestamp", 1))
    
    return {
        "stream_id": stream_id,
        "period_days": days,
        "analytics": analytics,
        "summary": {
            "total_listeners": sum(record.get("listeners", 0) for record in analytics),
            "peak_listeners": max((record.get("listeners", 0) for record in analytics), default=0),
            "total_bandwidth": sum(record.get("bandwidth_used", 0) for record in analytics)
        }
    }

# Billing routes
@app.get("/api/billing/clients")
async def get_billing_overview(current_user: dict = Depends(get_current_user)):
    # Get all clients with their billing status
    clients = list(clients_collection.find({}, {"_id": 0}))
    
    for client in clients:
        # Get latest bill
        latest_bill = billing_collection.find_one(
            {"client_id": client["id"]},
            sort=[("created_at", -1)]
        )
        
        client["billing_info"] = {
            "latest_amount": latest_bill["amount"] if latest_bill else 0,
            "status": latest_bill["status"] if latest_bill else "none",
            "due_date": latest_bill["due_date"] if latest_bill else None,
            "monthly_fee": client.get("monthly_fee", 0)
        }
    
    return clients

@app.post("/api/billing/generate/{client_id}")
async def generate_bill(client_id: str, current_user: dict = Depends(get_current_user)):
    client = clients_collection.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Create new bill
    bill = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "amount": client.get("monthly_fee", 0),
        "status": "pending",
        "billing_period": "monthly",
        "due_date": datetime.utcnow() + timedelta(days=30),
        "created_at": datetime.utcnow()
    }
    
    billing_collection.insert_one(bill)
    
    # Send billing email
    if SMTP_HOST and SMTP_USER:
        bill_email = f"""
        <h2>Invoice from Radio Admin Panel</h2>
        <p>Dear {client['name']},</p>
        <p>Your monthly invoice is ready.</p>
        <p><strong>Amount Due: ${bill['amount']:.2f}</strong></p>
        <p>Due Date: {bill['due_date'].strftime('%Y-%m-%d')}</p>
        <p>Please contact us for payment instructions.</p>
        <p>Best regards,<br>Radio Admin Team</p>
        """
        send_email(client["email"], "Monthly Invoice", bill_email)
    
    return {"message": "Bill generated successfully", "bill": bill}

# Server configuration routes
@app.get("/api/server/config")
async def get_server_config(current_user: dict = Depends(get_current_user)):
    configs = list(server_config_collection.find({}, {"_id": 0}))
    
    # Group by category
    grouped_configs = {}
    for config in configs:
        category = config["category"]
        if category not in grouped_configs:
            grouped_configs[category] = []
        grouped_configs[category].append(config)
    
    return grouped_configs

@app.put("/api/server/config/{key}")
async def update_server_config(key: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    config = server_config_collection.find_one({"key": key})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    server_config_collection.update_one(
        {"key": key},
        {"$set": {
            "value": update_data["value"],
            "updated_by": current_user["username"],
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Configuration updated successfully"}

@app.get("/api/server/stats")
async def get_server_stats(current_user: dict = Depends(get_current_user)):
    return {
        "system": get_system_stats(),
        "icecast": get_icecast_stats(),
        "database": {
            "clients": clients_collection.count_documents({}),
            "streams": streams_collection.count_documents({}),
            "users": users_collection.count_documents({}),
            "analytics_records": analytics_collection.count_documents({})
        }
    }

@app.post("/api/server/backup")
async def create_backup(current_user: dict = Depends(get_current_user)):
    try:
        backup_id = str(uuid.uuid4())[:8]
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        # Run backup script
        result = subprocess.run(
            ["/opt/radio-admin/backup.sh"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            return {"message": "Backup created successfully", "backup_id": f"backup_{timestamp}"}
        else:
            raise HTTPException(status_code=500, detail="Backup failed")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup error: {str(e)}")

# Dashboard stats (enhanced)
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_clients = clients_collection.count_documents({})
    active_clients = clients_collection.count_documents({"status": "active"})
    total_streams = streams_collection.count_documents({})
    running_streams = streams_collection.count_documents({"status": "running"})
    
    # Get system stats
    system_stats = get_system_stats()
    
    # Get billing stats
    total_revenue = sum(
        bill["amount"] for bill in billing_collection.find({"status": "paid"})
    )
    
    pending_bills = billing_collection.count_documents({"status": "pending"})
    
    return {
        "total_clients": total_clients,
        "active_clients": active_clients,
        "total_streams": total_streams,
        "running_streams": running_streams,
        "total_revenue": total_revenue,
        "pending_bills": pending_bills,
        "system_health": {
            "cpu_usage": system_stats.get("cpu_percent", 0),
            "memory_usage": system_stats.get("memory_percent", 0),
            "disk_usage": system_stats.get("disk_percent", 0)
        }
    }

@app.get("/api/dashboard/recent-activity")
async def get_recent_activity(current_user: dict = Depends(get_current_user)):
    # Get recent clients and streams
    recent_clients = list(clients_collection.find({}, {"_id": 0}).sort("created_at", -1).limit(5))
    recent_streams = list(streams_collection.find({}, {"_id": 0}).sort("created_at", -1).limit(5))
    recent_bills = list(billing_collection.find({}, {"_id": 0}).sort("created_at", -1).limit(5))
    
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
    
    for bill in recent_bills:
        client = clients_collection.find_one({"id": bill["client_id"]})
        client_name = client["name"] if client else "Unknown"
        activity.append({
            "type": "bill_generated",
            "message": f"Invoice generated for {client_name} (${bill['amount']:.2f})",
            "timestamp": bill["created_at"],
            "icon": "dollar-sign"
        })
    
    # Sort by timestamp and return recent 10
    activity.sort(key=lambda x: x["timestamp"], reverse=True)
    return activity[:10]

# Help and documentation routes
@app.get("/api/help/topics")
async def get_help_topics():
    return {
        "getting_started": {
            "title": "Getting Started",
            "description": "Learn the basics of using Radio Admin Panel",
            "sections": [
                {"id": "login", "title": "Logging In", "content": "Use your admin credentials to access the panel"},
                {"id": "dashboard", "title": "Dashboard Overview", "content": "Monitor your system status and statistics"},
                {"id": "clients", "title": "Managing Clients", "content": "Add, edit, and manage your radio clients"}
            ]
        },
        "client_management": {
            "title": "Client Management",
            "description": "Complete guide to managing radio clients",
            "sections": [
                {"id": "add_client", "title": "Adding Clients", "content": "Step-by-step guide to add new clients"},
                {"id": "edit_client", "title": "Editing Clients", "content": "How to update client information"},
                {"id": "billing", "title": "Client Billing", "content": "Managing client billing and payments"}
            ]
        },
        "stream_management": {
            "title": "Stream Management",
            "description": "Guide to managing radio streams",
            "sections": [
                {"id": "create_stream", "title": "Creating Streams", "content": "How to set up new radio streams"},
                {"id": "stream_control", "title": "Stream Control", "content": "Starting, stopping, and monitoring streams"},
                {"id": "stream_settings", "title": "Stream Settings", "content": "Configuring bitrate, format, and other settings"}
            ]
        }
    }

@app.get("/api/help/tooltip/{topic}")
async def get_tooltip(topic: str):
    tooltips = {
        "client_max_streams": "Maximum number of streams this client can create",
        "client_max_listeners": "Maximum concurrent listeners across all client streams",
        "client_bandwidth_limit": "Maximum bandwidth in kbps for all client streams",
        "stream_port": "Port number for the stream (must be unique)",
        "stream_mount_point": "URL path for accessing the stream (e.g., /mystream)",
        "stream_bitrate": "Audio quality in kbps (higher = better quality but more bandwidth)",
        "stream_format": "Audio format (MP3 recommended for compatibility)",
        "billing_plan": "Client subscription plan (affects pricing and limits)",
        "auto_dj": "Automatically play music when no live source is connected",
        "server_cpu": "Current CPU usage of the server",
        "server_memory": "Current memory usage of the server",
        "icecast_enabled": "Enable/disable Icecast streaming server integration"
    }
    
    return {"tooltip": tooltips.get(topic, "No help available for this topic")}

# Background tasks for analytics collection
async def collect_analytics():
    """Background task to collect stream analytics"""
    try:
        icecast_stats = get_icecast_stats()
        current_time = datetime.utcnow()
        
        # Get all active streams
        active_streams = list(streams_collection.find({"status": "running"}))
        
        for stream in active_streams:
            mount_point = stream["mount_point"]
            if mount_point in icecast_stats:
                stats = icecast_stats[mount_point]
                
                analytics_record = {
                    "id": str(uuid.uuid4()),
                    "stream_id": stream["id"],
                    "timestamp": current_time,
                    "listeners": stats.get("listeners", 0),
                    "bandwidth_used": stats.get("bitrate", 0) * stats.get("listeners", 0) / 8,  # KB/s
                    "song_title": stats.get("title", ""),
                    "user_agent": ""
                }
                
                analytics_collection.insert_one(analytics_record)
        
        logger.info(f"Analytics collected for {len(active_streams)} streams")
    
    except Exception as e:
        logger.error(f"Failed to collect analytics: {e}")

# Schedule analytics collection every 5 minutes
@app.on_event("startup")
async def schedule_analytics():
    import asyncio
    
    async def analytics_loop():
        while True:
            await collect_analytics()
            await asyncio.sleep(300)  # 5 minutes
    
    asyncio.create_task(analytics_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)