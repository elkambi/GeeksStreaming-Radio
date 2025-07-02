import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [clients, setClients] = useState([]);
  const [streams, setStreams] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);

  // Auth functions
  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        setUser(data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCurrentPage('dashboard');
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      localStorage.removeItem('token');
    }
    setLoading(false);
  };

  // Data fetching functions
  const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    return fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });
  };

  const fetchClients = async () => {
    try {
      const response = await fetchWithAuth('/api/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchStreams = async () => {
    try {
      const response = await fetchWithAuth('/api/streams');
      if (response.ok) {
        const data = await response.json();
        setStreams(data);
      }
    } catch (error) {
      console.error('Error fetching streams:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, activityResponse] = await Promise.all([
        fetchWithAuth('/api/dashboard/stats'),
        fetchWithAuth('/api/dashboard/recent-activity')
      ]);
      
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setDashboardStats(stats);
      }
      
      if (activityResponse.ok) {
        const activity = await activityResponse.json();
        setRecentActivity(activity);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      if (currentPage === 'dashboard') {
        fetchDashboardData();
      } else if (currentPage === 'clients') {
        fetchClients();
      } else if (currentPage === 'streams') {
        fetchStreams();
      }
    }
  }, [user, currentPage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} user={user} onLogout={logout} />
      <div className="ml-64 p-8">
        <Header user={user} />
        <main className="mt-8">
          {currentPage === 'dashboard' && (
            <Dashboard stats={dashboardStats} activity={recentActivity} />
          )}
          {currentPage === 'clients' && (
            <ClientManagement 
              clients={clients} 
              onRefresh={fetchClients}
              fetchWithAuth={fetchWithAuth}
            />
          )}
          {currentPage === 'streams' && (
            <StreamManagement 
              streams={streams} 
              clients={clients}
              onRefresh={fetchStreams}
              fetchWithAuth={fetchWithAuth}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// Login Screen Component
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const success = await onLogin(username, password);
    if (!success) {
      setError('Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Radio Admin Panel</h1>
          <p className="text-gray-400">Manage your radio streams and clients</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
              placeholder="Enter your username"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
              placeholder="Enter your password"
              required
            />
          </div>
          
          {error && (
            <div className="bg-red-600 text-white p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-gray-400">
          Default credentials: admin / admin123
        </div>
      </div>
    </div>
  );
}

// Sidebar Component
function Sidebar({ currentPage, setCurrentPage, user, onLogout }) {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: 'chart-bar' },
    { id: 'clients', name: 'Clients', icon: 'users' },
    { id: 'streams', name: 'Streams', icon: 'radio' },
  ];

  const getIconSVG = (iconName) => {
    const icons = {
      'chart-bar': (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      ),
      'users': (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      ),
      'radio': (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      )
    };
    return icons[iconName] || icons['chart-bar'];
  };

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-gray-800 border-r border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Radio Panel</h1>
            <p className="text-sm text-gray-400">Admin Dashboard</p>
          </div>
        </div>
      </div>
      
      <nav className="mt-6 px-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition duration-200 ${
              currentPage === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {getIconSVG(item.icon)}
            </svg>
            <span className="font-medium">{item.name}</span>
          </button>
        ))}
      </nav>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">{user.username[0].toUpperCase()}</span>
            </div>
            <span className="text-sm text-gray-300">{user.username}</span>
          </div>
          <button
            onClick={onLogout}
            className="text-gray-400 hover:text-white transition duration-200"
            title="Logout"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Header Component
function Header({ user }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold text-white">Welcome back, {user.username}!</h2>
        <p className="text-gray-400 mt-1">Manage your radio streaming infrastructure</p>
      </div>
      <div className="flex items-center space-x-4">
        <div className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium">
          <span className="inline-block w-2 h-2 bg-white rounded-full mr-2"></span>
          System Online
        </div>
      </div>
    </div>
  );
}

// Dashboard Component
function Dashboard({ stats, activity }) {
  const statCards = [
    { name: 'Total Clients', value: stats.total_clients || 0, icon: 'users', color: 'blue' },
    { name: 'Active Clients', value: stats.active_clients || 0, icon: 'user-check', color: 'green' },
    { name: 'Total Streams', value: stats.total_streams || 0, icon: 'radio', color: 'purple' },
    { name: 'Running Streams', value: stats.running_streams || 0, icon: 'play', color: 'red' },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">{stat.name}</p>
                <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 bg-${stat.color}-600 rounded-lg flex items-center justify-center`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-xl font-bold text-white mb-6">Recent Activity</h3>
        <div className="space-y-4">
          {activity && activity.length > 0 ? (
            activity.map((item, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 bg-gray-700 rounded-lg">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{item.message}</p>
                  <p className="text-gray-400 text-sm">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-center py-8">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Client Management Component
function ClientManagement({ clients, onRefresh, fetchWithAuth }) {
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    max_streams: 1,
    max_listeners: 100,
    bandwidth_limit: 128
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients';
      const method = editingClient ? 'PUT' : 'POST';
      
      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setShowModal(false);
        setEditingClient(null);
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          max_streams: 1,
          max_listeners: 100,
          bandwidth_limit: 128
        });
        onRefresh();
      }
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData(client);
    setShowModal(true);
  };

  const handleDelete = async (clientId) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        const response = await fetchWithAuth(`/api/clients/${clientId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          onRefresh();
        }
      } catch (error) {
        console.error('Error deleting client:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Client Management</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200"
        >
          Add Client
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Name</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Email</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Streams</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Max Listeners</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-white font-medium">{client.name}</div>
                      {client.company && <div className="text-gray-400 text-sm">{client.company}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{client.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      client.status === 'active' 
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{client.stream_count || 0}/{client.max_streams}</td>
                  <td className="px-6 py-4 text-gray-300">{client.max_listeners}</td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-blue-400 hover:text-blue-300 transition duration-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="text-red-400 hover:text-red-300 transition duration-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clients.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No clients found. Add your first client to get started.
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <ClientModal
          client={editingClient}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowModal(false);
            setEditingClient(null);
            setFormData({
              name: '',
              email: '',
              phone: '',
              company: '',
              max_streams: 1,
              max_listeners: 100,
              bandwidth_limit: 128
            });
          }}
        />
      )}
    </div>
  );
}

// Client Modal Component
function ClientModal({ client, formData, setFormData, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-6">
          {client ? 'Edit Client' : 'Add New Client'}
        </h3>
        
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Streams</label>
              <input
                type="number"
                value={formData.max_streams}
                onChange={(e) => setFormData({...formData, max_streams: parseInt(e.target.value)})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                min="1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Listeners</label>
              <input
                type="number"
                value={formData.max_listeners}
                onChange={(e) => setFormData({...formData, max_listeners: parseInt(e.target.value)})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                min="1"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-300 hover:text-white transition duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200"
            >
              {client ? 'Update Client' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Stream Management Component
function StreamManagement({ streams, clients, onRefresh, fetchWithAuth }) {
  const [showModal, setShowModal] = useState(false);
  const [editingStream, setEditingStream] = useState(null);
  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    description: '',
    port: 8000,
    mount_point: '/stream',
    bitrate: 128,
    max_listeners: 100,
    format: 'mp3'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingStream 
        ? `/api/streams/${editingStream.id}` 
        : `/api/clients/${formData.client_id}/streams`;
      const method = editingStream ? 'PUT' : 'POST';
      
      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setShowModal(false);
        setEditingStream(null);
        setFormData({
          client_id: '',
          name: '',
          description: '',
          port: 8000,
          mount_point: '/stream',
          bitrate: 128,
          max_listeners: 100,
          format: 'mp3'
        });
        onRefresh();
      }
    } catch (error) {
      console.error('Error saving stream:', error);
    }
  };

  const handleStreamControl = async (streamId, action) => {
    try {
      const response = await fetchWithAuth(`/api/streams/${streamId}/${action}`, {
        method: 'POST'
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error(`Error ${action} stream:`, error);
    }
  };

  const handleDelete = async (streamId) => {
    if (window.confirm('Are you sure you want to delete this stream?')) {
      try {
        const response = await fetchWithAuth(`/api/streams/${streamId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          onRefresh();
        }
      } catch (error) {
        console.error('Error deleting stream:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Stream Management</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200"
        >
          Add Stream
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Stream Name</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Client</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Port</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Format</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {streams.map((stream) => (
                <tr key={stream.id} className="hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-white font-medium">{stream.name}</div>
                      <div className="text-gray-400 text-sm">{stream.bitrate} kbps</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{stream.client_name}</td>
                  <td className="px-6 py-4 text-gray-300">{stream.port}</td>
                  <td className="px-6 py-4 text-gray-300 uppercase">{stream.format}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      stream.status === 'running' 
                        ? 'bg-green-600 text-white'
                        : stream.status === 'stopped'
                        ? 'bg-gray-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}>
                      {stream.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      {stream.status === 'stopped' ? (
                        <button
                          onClick={() => handleStreamControl(stream.id, 'start')}
                          className="text-green-400 hover:text-green-300 transition duration-200"
                        >
                          Start
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStreamControl(stream.id, 'stop')}
                          className="text-red-400 hover:text-red-300 transition duration-200"
                        >
                          Stop
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(stream.id)}
                        className="text-red-400 hover:text-red-300 transition duration-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {streams.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No streams found. Add your first stream to get started.
            </div>
          )}
        </div>
      </div>

      {/* Stream Modal */}
      {showModal && (
        <StreamModal
          stream={editingStream}
          clients={clients}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowModal(false);
            setEditingStream(null);
            setFormData({
              client_id: '',
              name: '',
              description: '',
              port: 8000,
              mount_point: '/stream',
              bitrate: 128,
              max_listeners: 100,
              format: 'mp3'
            });
          }}
        />
      )}
    </div>
  );
}

// Stream Modal Component
function StreamModal({ stream, clients, formData, setFormData, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-6">
          {stream ? 'Edit Stream' : 'Add New Stream'}
        </h3>
        
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Client *</label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                required
                disabled={!!stream}
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Stream Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Port *</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({...formData, port: parseInt(e.target.value)})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                min="1024"
                max="65535"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mount Point</label>
              <input
                type="text"
                value={formData.mount_point}
                onChange={(e) => setFormData({...formData, mount_point: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Bitrate (kbps)</label>
              <select
                value={formData.bitrate}
                onChange={(e) => setFormData({...formData, bitrate: parseInt(e.target.value)})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              >
                <option value={64}>64 kbps</option>
                <option value={96}>96 kbps</option>
                <option value={128}>128 kbps</option>
                <option value={192}>192 kbps</option>
                <option value={256}>256 kbps</option>
                <option value={320}>320 kbps</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Format</label>
              <select
                value={formData.format}
                onChange={(e) => setFormData({...formData, format: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              >
                <option value="mp3">MP3</option>
                <option value="aac">AAC</option>
                <option value="ogg">OGG</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Listeners</label>
              <input
                type="number"
                value={formData.max_listeners}
                onChange={(e) => setFormData({...formData, max_listeners: parseInt(e.target.value)})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                min="1"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                rows="3"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-300 hover:text-white transition duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200"
            >
              {stream ? 'Update Stream' : 'Create Stream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;