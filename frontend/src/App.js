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
  const [helpTooltip, setHelpTooltip] = useState({ visible: false, content: '', x: 0, y: 0 });

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

  // Help tooltip functions
  const showTooltip = async (topic, event) => {
    try {
      const response = await fetchWithAuth(`/api/help/tooltip/${topic}`);
      if (response.ok) {
        const data = await response.json();
        const rect = event.target.getBoundingClientRect();
        setHelpTooltip({
          visible: true,
          content: data.tooltip,
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        });
      }
    } catch (error) {
      console.error('Error fetching tooltip:', error);
    }
  };

  const hideTooltip = () => {
    setHelpTooltip({ ...helpTooltip, visible: false });
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
        fetchClients(); // Also fetch clients for stream creation
      }
    }
  }, [user, currentPage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Radio Admin Panel...</p>
        </div>
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
            <Dashboard 
              stats={dashboardStats} 
              activity={recentActivity} 
              onShowTooltip={showTooltip}
              onHideTooltip={hideTooltip}
            />
          )}
          {currentPage === 'clients' && (
            <ClientManagement 
              clients={clients} 
              onRefresh={fetchClients}
              fetchWithAuth={fetchWithAuth}
              onShowTooltip={showTooltip}
              onHideTooltip={hideTooltip}
            />
          )}
          {currentPage === 'streams' && (
            <StreamManagement 
              streams={streams} 
              clients={clients}
              onRefresh={fetchStreams}
              fetchWithAuth={fetchWithAuth}
              onShowTooltip={showTooltip}
              onHideTooltip={hideTooltip}
            />
          )}
          {currentPage === 'analytics' && (
            <Analytics fetchWithAuth={fetchWithAuth} />
          )}
          {currentPage === 'billing' && (
            <Billing fetchWithAuth={fetchWithAuth} />
          )}
          {currentPage === 'server' && (
            <ServerConfig 
              fetchWithAuth={fetchWithAuth}
              onShowTooltip={showTooltip}
              onHideTooltip={hideTooltip}
            />
          )}
          {currentPage === 'help' && (
            <HelpCenter fetchWithAuth={fetchWithAuth} />
          )}
        </main>
      </div>
      
      {/* Help Tooltip */}
      {helpTooltip.visible && (
        <div 
          className="fixed z-50 bg-gray-800 text-white p-3 rounded-lg shadow-lg border border-gray-600 max-w-xs"
          style={{
            left: helpTooltip.x - 100,
            top: helpTooltip.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="text-sm">{helpTooltip.content}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
}

// Help Icon Component
function HelpIcon({ topic, onShow, onHide, className = "" }) {
  return (
    <span 
      className={`inline-flex items-center justify-center w-4 h-4 bg-blue-600 text-white rounded-full text-xs cursor-help ml-2 ${className}`}
      onMouseEnter={(e) => onShow(topic, e)}
      onMouseLeave={onHide}
    >
      ?
    </span>
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
      setError('Credenciales inválidas');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Radio Admin Panel</h1>
          <p className="text-gray-400">Sistema Profesional de Administración de Radio</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
              placeholder="Ingresa tu usuario"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
              placeholder="Ingresa tu contraseña"
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
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-gray-400">
          Credenciales por defecto: admin / admin123
        </div>
      </div>
    </div>
  );
}

// Enhanced Sidebar Component
function Sidebar({ currentPage, setCurrentPage, user, onLogout }) {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: 'chart-bar', description: 'Panel principal' },
    { id: 'clients', name: 'Clientes', icon: 'users', description: 'Gestionar clientes' },
    { id: 'streams', name: 'Streams', icon: 'radio', description: 'Gestionar transmisiones' },
    { id: 'analytics', name: 'Analytics', icon: 'chart-line', description: 'Estadísticas avanzadas' },
    { id: 'billing', name: 'Facturación', icon: 'dollar-sign', description: 'Sistema de cobros' },
    { id: 'server', name: 'Servidor', icon: 'server', description: 'Configuración del servidor' },
    { id: 'help', name: 'Ayuda', icon: 'help-circle', description: 'Centro de ayuda' },
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
      ),
      'chart-line': (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      ),
      'dollar-sign': (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      ),
      'server': (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
      ),
      'help-circle': (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      )
    };
    return icons[iconName] || icons['chart-bar'];
  };

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-gray-800 border-r border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Radio Panel</h1>
            <p className="text-sm text-gray-400">Admin Professional</p>
          </div>
        </div>
      </div>
      
      <nav className="mt-6 px-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition duration-200 group ${
              currentPage === item.id
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            title={item.description}
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
            <div>
              <span className="text-sm text-gray-300">{user.username}</span>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-gray-400 hover:text-white transition duration-200"
            title="Cerrar sesión"
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

// Enhanced Header Component
function Header({ user }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold text-white">¡Bienvenido, {user.username}!</h2>
        <p className="text-gray-400 mt-1">Administra tu infraestructura de radio streaming</p>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <div className="text-sm text-gray-400">
            {currentTime.toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
          <div className="text-lg font-mono text-white">
            {currentTime.toLocaleTimeString('es-ES')}
          </div>
        </div>
        <div className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium">
          <span className="inline-block w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
          Sistema Online
        </div>
      </div>
    </div>
  );
}

// Enhanced Dashboard Component
function Dashboard({ stats, activity, onShowTooltip, onHideTooltip }) {
  const statCards = [
    { 
      name: 'Total Clientes', 
      value: stats.total_clients || 0, 
      icon: 'users', 
      color: 'blue',
      tooltip: 'client_max_streams'
    },
    { 
      name: 'Clientes Activos', 
      value: stats.active_clients || 0, 
      icon: 'user-check', 
      color: 'green',
      change: '+5%'
    },
    { 
      name: 'Total Streams', 
      value: stats.total_streams || 0, 
      icon: 'radio', 
      color: 'purple',
      tooltip: 'stream_port'
    },
    { 
      name: 'Streams Activos', 
      value: stats.running_streams || 0, 
      icon: 'play', 
      color: 'red',
      change: '+12%'
    },
    { 
      name: 'Ingresos Totales', 
      value: `$${(stats.total_revenue || 0).toFixed(2)}`, 
      icon: 'dollar-sign', 
      color: 'yellow',
      change: '+8%'
    },
    { 
      name: 'Facturas Pendientes', 
      value: stats.pending_bills || 0, 
      icon: 'alert-circle', 
      color: 'orange',
      tooltip: 'billing_plan'
    },
  ];

  const systemHealth = stats.system_health || {};

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:shadow-lg transition duration-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center">
                  <p className="text-gray-400 text-sm font-medium">{stat.name}</p>
                  {stat.tooltip && (
                    <HelpIcon 
                      topic={stat.tooltip} 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  )}
                </div>
                <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                {stat.change && (
                  <p className="text-green-400 text-sm mt-1">{stat.change} desde el mes pasado</p>
                )}
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

      {/* System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Estado del Sistema</h3>
            <HelpIcon 
              topic="server_cpu" 
              onShow={onShowTooltip} 
              onHide={onHideTooltip} 
            />
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">CPU</span>
                <span className="text-white">{(systemHealth.cpu_usage || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${systemHealth.cpu_usage > 80 ? 'bg-red-500' : systemHealth.cpu_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${systemHealth.cpu_usage || 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Memoria</span>
                <span className="text-white">{(systemHealth.memory_usage || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${systemHealth.memory_usage > 80 ? 'bg-red-500' : systemHealth.memory_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${systemHealth.memory_usage || 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Disco</span>
                <span className="text-white">{(systemHealth.disk_usage || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${systemHealth.disk_usage > 80 ? 'bg-red-500' : systemHealth.disk_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${systemHealth.disk_usage || 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-xl font-bold text-white mb-6">Actividad Reciente</h3>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {activity && activity.length > 0 ? (
              activity.map((item, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 bg-gray-700 rounded-lg">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{item.message}</p>
                    <p className="text-gray-400 text-sm">{new Date(item.timestamp).toLocaleString('es-ES')}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">No hay actividad reciente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Client Management Component
function ClientManagement({ clients, onRefresh, fetchWithAuth, onShowTooltip, onHideTooltip }) {
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    max_streams: 1,
    max_listeners: 100,
    bandwidth_limit: 128,
    billing_plan: 'basic',
    monthly_fee: 0
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients';
      const method = editingClient ? 'PUT' : 'POST';
      
      console.log('Submitting client:', { url, method, formData });
      
      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('Client creation response:', responseData);
        setShowModal(false);
        setEditingClient(null);
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          max_streams: 1,
          max_listeners: 100,
          bandwidth_limit: 128,
          billing_plan: 'basic',
          monthly_fee: 0
        });
        onRefresh();
      } else {
        const errorData = await response.json();
        console.error('Client creation failed:', errorData);
        alert(`Error: ${errorData.detail || 'Failed to create client'}`);
      }
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Network error occurred while saving client');
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData(client);
    setShowModal(true);
  };

  const handleDelete = async (clientId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
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
        <div>
          <h2 className="text-2xl font-bold text-white">Gestión de Clientes</h2>
          <p className="text-gray-400 mt-1">Administra tus clientes de radio streaming</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200 flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Agregar Cliente</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Cliente</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Email</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Estado</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                  <div className="flex items-center">
                    Streams
                    <HelpIcon 
                      topic="client_max_streams" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                  <div className="flex items-center">
                    Oyentes Max
                    <HelpIcon 
                      topic="client_max_listeners" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Plan</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-750 transition duration-200">
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
                        : client.status === 'suspended'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}>
                      {client.status === 'active' ? 'Activo' : client.status === 'suspended' ? 'Suspendido' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{client.stream_count || 0}/{client.max_streams}</td>
                  <td className="px-6 py-4 text-gray-300">{client.max_listeners}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-sm ${
                      client.billing_plan === 'enterprise' ? 'bg-purple-600 text-white' :
                      client.billing_plan === 'premium' ? 'bg-blue-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {client.billing_plan === 'basic' ? 'Básico' : 
                       client.billing_plan === 'premium' ? 'Premium' : 'Empresarial'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-blue-400 hover:text-blue-300 transition duration-200"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="text-red-400 hover:text-red-300 transition duration-200"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clients.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No hay clientes registrados. Agrega tu primer cliente para comenzar.
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Client Modal */}
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
              bandwidth_limit: 128,
              billing_plan: 'basic',
              monthly_fee: 0
            });
          }}
          onShowTooltip={onShowTooltip}
          onHideTooltip={onHideTooltip}
        />
      )}
    </div>
  );
}

// Enhanced Client Modal Component
function ClientModal({ client, formData, setFormData, onSubmit, onClose, onShowTooltip, onHideTooltip }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-3xl border border-gray-700 max-h-screen overflow-y-auto">
        <h3 className="text-xl font-bold text-white mb-6">
          {client ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}
        </h3>
        
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="text-lg font-medium text-white mb-4">Información Básica</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Empresa
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                />
              </div>
            </div>
          </div>

          {/* Technical Limits */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="text-lg font-medium text-white mb-4">Límites Técnicos</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center">
                    Máximo Streams
                    <HelpIcon 
                      topic="client_max_streams" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </label>
                <input
                  type="number"
                  value={formData.max_streams}
                  onChange={(e) => setFormData({...formData, max_streams: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center">
                    Máximo Oyentes
                    <HelpIcon 
                      topic="client_max_listeners" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </label>
                <input
                  type="number"
                  value={formData.max_listeners}
                  onChange={(e) => setFormData({...formData, max_listeners: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center">
                    Límite Ancho de Banda (kbps)
                    <HelpIcon 
                      topic="client_bandwidth_limit" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </label>
                <select
                  value={formData.bandwidth_limit}
                  onChange={(e) => setFormData({...formData, bandwidth_limit: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                >
                  <option value={64}>64 kbps</option>
                  <option value={128}>128 kbps</option>
                  <option value={192}>192 kbps</option>
                  <option value={256}>256 kbps</option>
                  <option value={320}>320 kbps</option>
                </select>
              </div>
            </div>
          </div>

          {/* Billing Information */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="text-lg font-medium text-white mb-4">Información de Facturación</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center">
                    Plan de Facturación
                    <HelpIcon 
                      topic="billing_plan" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </label>
                <select
                  value={formData.billing_plan}
                  onChange={(e) => setFormData({...formData, billing_plan: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                >
                  <option value="basic">Básico</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Empresarial</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tarifa Mensual ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monthly_fee}
                  onChange={(e) => setFormData({...formData, monthly_fee: parseFloat(e.target.value)})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                  min="0"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-300 hover:text-white transition duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200"
            >
              {client ? 'Actualizar Cliente' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Enhanced Stream Management Component
function StreamManagement({ streams, clients, onRefresh, fetchWithAuth, onShowTooltip, onHideTooltip }) {
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
    format: 'mp3',
    auto_dj: false
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingStream 
        ? `/api/streams/${editingStream.id}` 
        : `/api/clients/${formData.client_id}/streams`;
      const method = editingStream ? 'PUT' : 'POST';
      
      console.log('Submitting stream:', { url, method, formData });
      
      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('Stream creation response:', responseData);
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
          format: 'mp3',
          auto_dj: false
        });
        onRefresh();
      } else {
        const errorData = await response.json();
        console.error('Stream creation failed:', errorData);
        alert(`Error: ${errorData.detail || 'Failed to create stream'}`);
      }
    } catch (error) {
      console.error('Error saving stream:', error);
      alert('Network error occurred while saving stream');
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
    if (window.confirm('¿Estás seguro de que quieres eliminar este stream?')) {
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
        <div>
          <h2 className="text-2xl font-bold text-white">Gestión de Streams</h2>
          <p className="text-gray-400 mt-1">Administra las transmisiones de audio en tiempo real</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200 flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          <span>Agregar Stream</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Stream</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Cliente</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                  <div className="flex items-center">
                    Puerto
                    <HelpIcon 
                      topic="stream_port" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                  <div className="flex items-center">
                    Formato/Bitrate
                    <HelpIcon 
                      topic="stream_bitrate" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Estado</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Oyentes</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {streams.map((stream) => (
                <tr key={stream.id} className="hover:bg-gray-750 transition duration-200">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-white font-medium flex items-center">
                        {stream.name}
                        {stream.auto_dj && (
                          <span className="ml-2 px-2 py-1 bg-purple-600 text-white text-xs rounded">
                            Auto DJ
                          </span>
                        )}
                      </div>
                      <div className="text-gray-400 text-sm">{stream.mount_point}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{stream.client_name}</td>
                  <td className="px-6 py-4 text-gray-300">{stream.port}</td>
                  <td className="px-6 py-4 text-gray-300">
                    {stream.format.toUpperCase()} / {stream.bitrate} kbps
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className={`w-3 h-3 rounded-full ${
                        stream.status === 'running' 
                          ? 'bg-green-500 animate-pulse'
                          : stream.status === 'stopped'
                          ? 'bg-gray-500'
                          : 'bg-red-500'
                      }`}></span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        stream.status === 'running' 
                          ? 'bg-green-600 text-white'
                          : stream.status === 'stopped'
                          ? 'bg-gray-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}>
                        {stream.status === 'running' ? 'En Vivo' : 
                         stream.status === 'stopped' ? 'Detenido' : 'Error'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {stream.current_listeners || 0} / {stream.max_listeners}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      {stream.status === 'stopped' ? (
                        <button
                          onClick={() => handleStreamControl(stream.id, 'start')}
                          className="flex items-center space-x-1 text-green-400 hover:text-green-300 transition duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-6-4V8a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                          <span>Iniciar</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStreamControl(stream.id, 'stop')}
                          className="flex items-center space-x-1 text-red-400 hover:text-red-300 transition duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Detener</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(stream.id)}
                        className="text-red-400 hover:text-red-300 transition duration-200"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {streams.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No hay streams configurados. Agrega tu primer stream para comenzar a transmitir.
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
              format: 'mp3',
              auto_dj: false
            });
          }}
          onShowTooltip={onShowTooltip}
          onHideTooltip={onHideTooltip}
        />
      )}
    </div>
  );
}

// Enhanced Stream Modal Component
function StreamModal({ stream, clients, formData, setFormData, onSubmit, onClose, onShowTooltip, onHideTooltip }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-4xl border border-gray-700 max-h-screen overflow-y-auto">
        <h3 className="text-xl font-bold text-white mb-6">
          {stream ? 'Editar Stream' : 'Agregar Nuevo Stream'}
        </h3>
        
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="text-lg font-medium text-white mb-4">Información Básica</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Cliente *</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
                  required
                  disabled={!!stream}
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del Stream *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="Mi Radio Stream"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center">
                    Puerto *
                    <HelpIcon 
                      topic="stream_port" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({...formData, port: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
                  min="1024"
                  max="65535"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center">
                    Mount Point
                    <HelpIcon 
                      topic="stream_mount_point" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </label>
                <input
                  type="text"
                  value={formData.mount_point}
                  onChange={(e) => setFormData({...formData, mount_point: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="/mystream"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
                  rows="3"
                  placeholder="Descripción del stream de radio..."
                />
              </div>
            </div>
          </div>

          {/* Audio Settings */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="text-lg font-medium text-white mb-4">Configuración de Audio</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center">
                    Bitrate (kbps)
                    <HelpIcon 
                      topic="stream_bitrate" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </label>
                <select
                  value={formData.bitrate}
                  onChange={(e) => setFormData({...formData, bitrate: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
                >
                  <option value={64}>64 kbps - Calidad Básica</option>
                  <option value={96}>96 kbps - Calidad Media</option>
                  <option value={128}>128 kbps - Calidad Estándar</option>
                  <option value={192}>192 kbps - Calidad Alta</option>
                  <option value={256}>256 kbps - Calidad Premium</option>
                  <option value={320}>320 kbps - Calidad Máxima</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center">
                    Formato
                    <HelpIcon 
                      topic="stream_format" 
                      onShow={onShowTooltip} 
                      onHide={onHideTooltip} 
                    />
                  </div>
                </label>
                <select
                  value={formData.format}
                  onChange={(e) => setFormData({...formData, format: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
                >
                  <option value="mp3">MP3 - Compatibilidad máxima</option>
                  <option value="aac">AAC - Mejor calidad</option>
                  <option value="ogg">OGG - Código abierto</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Máximo Oyentes</label>
                <input
                  type="number"
                  value={formData.max_listeners}
                  onChange={(e) => setFormData({...formData, max_listeners: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 text-white"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="text-lg font-medium text-white mb-4">Configuración Avanzada</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="auto_dj"
                  checked={formData.auto_dj}
                  onChange={(e) => setFormData({...formData, auto_dj: e.target.checked})}
                  className="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500"
                />
                <label htmlFor="auto_dj" className="text-gray-300 flex items-center">
                  <span>Habilitar Auto DJ</span>
                  <HelpIcon 
                    topic="auto_dj" 
                    onShow={onShowTooltip} 
                    onHide={onHideTooltip} 
                  />
                </label>
              </div>
              
              {formData.auto_dj && (
                <div className="ml-7 p-3 bg-gray-600 rounded-lg">
                  <p className="text-sm text-gray-300">
                    El Auto DJ reproducirá automáticamente música cuando no haya una fuente en vivo conectada.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-300 hover:text-white transition duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200"
            >
              {stream ? 'Actualizar Stream' : 'Crear Stream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Analytics Component
function Analytics({ fetchWithAuth }) {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(7);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/analytics/dashboard');
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Analytics</h2>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Analytics Avanzados</h2>
          <p className="text-gray-400 mt-1">Estadísticas detalladas de tu plataforma de radio</p>
        </div>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
          className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600"
        >
          <option value={1}>Último día</option>
          <option value={7}>Última semana</option>
          <option value={30}>Último mes</option>
          <option value={90}>Últimos 3 meses</option>
        </select>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Estado del Sistema</h3>
          {analyticsData?.system_stats && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Uso de CPU</span>
                <span className="text-white font-mono">{analyticsData.system_stats.cpu_percent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Uso de Memoria</span>
                <span className="text-white font-mono">{analyticsData.system_stats.memory_percent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Uso de Disco</span>
                <span className="text-white font-mono">{analyticsData.system_stats.disk_percent.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Ancho de Banda</h3>
          <div className="text-3xl font-bold text-purple-400 mb-2">
            {((analyticsData?.total_bandwidth_24h || 0) / 1024).toFixed(2)} GB
          </div>
          <p className="text-gray-400">Transferido en las últimas 24 horas</p>
        </div>
      </div>

      {/* Popular Streams */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Streams Más Populares</h3>
        <div className="space-y-3">
          {analyticsData?.popular_streams?.map(([streamId, listeners], index) => (
            <div key={streamId} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-gray-600'
                }`}>
                  {index + 1}
                </div>
                <span className="text-white">Stream {streamId.slice(0, 8)}</span>
              </div>
              <div className="text-purple-400 font-semibold">{listeners} oyentes</div>
            </div>
          )) || (
            <p className="text-gray-400 text-center py-4">No hay datos de streams disponibles</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Billing Component
function Billing({ fetchWithAuth }) {
  const [billingData, setBillingData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/billing/clients');
      if (response.ok) {
        const data = await response.json();
        setBillingData(data);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    }
    setLoading(false);
  };

  const generateBill = async (clientId) => {
    try {
      const response = await fetchWithAuth(`/api/billing/generate/${clientId}`, {
        method: 'POST'
      });
      if (response.ok) {
        alert('Factura generada exitosamente');
        fetchBillingData();
      }
    } catch (error) {
      console.error('Error generating bill:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Sistema de Facturación</h2>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Cargando información de facturación...</p>
        </div>
      </div>
    );
  }

  const totalRevenue = billingData.reduce((sum, client) => sum + (client.billing_info?.latest_amount || 0), 0);
  const pendingBills = billingData.filter(client => client.billing_info?.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Sistema de Facturación</h2>
          <p className="text-gray-400 mt-1">Gestiona cobros y suscripciones de clientes</p>
        </div>
      </div>

      {/* Billing Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Ingresos Totales</p>
              <p className="text-3xl font-bold text-green-400 mt-2">${totalRevenue.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Facturas Pendientes</p>
              <p className="text-3xl font-bold text-yellow-400 mt-2">{pendingBills}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Clientes Activos</p>
              <p className="text-3xl font-bold text-blue-400 mt-2">{billingData.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Client Billing Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Estado de Facturación por Cliente</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Cliente</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Plan</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Tarifa Mensual</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Último Pago</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Estado</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {billingData.map((client) => (
                <tr key={client.id} className="hover:bg-gray-750 transition duration-200">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-white font-medium">{client.name}</div>
                      <div className="text-gray-400 text-sm">{client.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-sm ${
                      client.billing_plan === 'enterprise' ? 'bg-purple-600 text-white' :
                      client.billing_plan === 'premium' ? 'bg-blue-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {client.billing_plan === 'basic' ? 'Básico' : 
                       client.billing_plan === 'premium' ? 'Premium' : 'Empresarial'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">${(client.monthly_fee || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-gray-300">
                    ${(client.billing_info?.latest_amount || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      client.billing_info?.status === 'paid' ? 'bg-green-600 text-white' :
                      client.billing_info?.status === 'pending' ? 'bg-yellow-600 text-white' :
                      client.billing_info?.status === 'overdue' ? 'bg-red-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {client.billing_info?.status === 'paid' ? 'Pagado' :
                       client.billing_info?.status === 'pending' ? 'Pendiente' :
                       client.billing_info?.status === 'overdue' ? 'Vencido' : 'Sin facturas'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => generateBill(client.id)}
                      className="text-green-400 hover:text-green-300 transition duration-200"
                    >
                      Generar Factura
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Server Configuration Component
function ServerConfig({ fetchWithAuth, onShowTooltip, onHideTooltip }) {
  const [configs, setConfigs] = useState({});
  const [serverStats, setServerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('system');

  useEffect(() => {
    fetchServerConfig();
    fetchServerStats();
  }, []);

  const fetchServerConfig = async () => {
    try {
      const response = await fetchWithAuth('/api/server/config');
      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      }
    } catch (error) {
      console.error('Error fetching server config:', error);
    }
  };

  const fetchServerStats = async () => {
    try {
      const response = await fetchWithAuth('/api/server/stats');
      if (response.ok) {
        const data = await response.json();
        setServerStats(data);
      }
    } catch (error) {
      console.error('Error fetching server stats:', error);
    }
    setLoading(false);
  };

  const updateConfig = async (key, value) => {
    try {
      const response = await fetchWithAuth(`/api/server/config/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value })
      });
      if (response.ok) {
        fetchServerConfig();
      }
    } catch (error) {
      console.error('Error updating config:', error);
    }
  };

  const createBackup = async () => {
    try {
      const response = await fetchWithAuth('/api/server/backup', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Backup creado exitosamente: ${data.backup_id}`);
      }
    } catch (error) {
      console.error('Error creating backup:', error);
    }
  };

  const tabs = [
    { id: 'system', name: 'Sistema', icon: 'server' },
    { id: 'email', name: 'Correo', icon: 'mail' },
    { id: 'streaming', name: 'Streaming', icon: 'radio' },
    { id: 'security', name: 'Seguridad', icon: 'shield' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Configuración del Servidor</h2>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Configuración del Servidor</h2>
          <p className="text-gray-400 mt-1">Administra la configuración y herramientas del sistema</p>
        </div>
        <button
          onClick={createBackup}
          className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200 flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          <span>Crear Backup</span>
        </button>
      </div>

      {/* Server Stats Overview */}
      {serverStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">CPU</p>
                <p className="text-2xl font-bold text-blue-400 mt-2">
                  {serverStats.system?.cpu_percent?.toFixed(1) || 0}%
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Memoria</p>
                <p className="text-2xl font-bold text-green-400 mt-2">
                  {serverStats.system?.memory_percent?.toFixed(1) || 0}%
                </p>
              </div>
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Clientes BD</p>
                <p className="text-2xl font-bold text-purple-400 mt-2">
                  {serverStats.database?.clients || 0}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Streams BD</p>
                <p className="text-2xl font-bold text-orange-400 mt-2">
                  {serverStats.database?.streams || 0}
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Tabs */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="border-b border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition duration-200 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {configs[activeTab] && (
            <div className="space-y-6">
              {configs[activeTab].map((config) => (
                <div key={config.key} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-white font-medium">{config.key.replace(/_/g, ' ').toUpperCase()}</h4>
                      <HelpIcon 
                        topic={config.key} 
                        onShow={onShowTooltip} 
                        onHide={onHideTooltip} 
                      />
                    </div>
                    <p className="text-gray-400 text-sm mt-1">{config.description}</p>
                  </div>
                  <div className="ml-4">
                    {typeof config.value === 'boolean' ? (
                      <button
                        onClick={() => updateConfig(config.key, !config.value)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          config.value ? 'bg-blue-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            config.value ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    ) : typeof config.value === 'number' ? (
                      <input
                        type="number"
                        value={config.value}
                        onChange={(e) => updateConfig(config.key, parseInt(e.target.value))}
                        className="w-24 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                      />
                    ) : (
                      <input
                        type="text"
                        value={config.value}
                        onChange={(e) => updateConfig(config.key, e.target.value)}
                        className="w-48 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Help Center Component
function HelpCenter({ fetchWithAuth }) {
  const [helpTopics, setHelpTopics] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHelpTopics();
  }, []);

  const fetchHelpTopics = async () => {
    try {
      const response = await fetchWithAuth('/api/help/topics');
      if (response.ok) {
        const data = await response.json();
        setHelpTopics(data);
        setSelectedTopic(Object.keys(data)[0]);
      }
    } catch (error) {
      console.error('Error fetching help topics:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Centro de Ayuda</h2>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Cargando ayuda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Centro de Ayuda</h2>
          <p className="text-gray-400 mt-1">Guías y tutoriales para usar el sistema</p>
        </div>
        <div className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <span className="inline-block w-2 h-2 bg-white rounded-full mr-2"></span>
          Ayuda en Línea
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Topics Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Temas de Ayuda</h3>
            <div className="space-y-2">
              {helpTopics && Object.entries(helpTopics).map(([key, topic]) => (
                <button
                  key={key}
                  onClick={() => setSelectedTopic(key)}
                  className={`w-full text-left p-3 rounded-lg transition duration-200 ${
                    selectedTopic === key
                      ? 'bg-yellow-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <div className="font-medium">{topic.title}</div>
                  <div className="text-sm opacity-75">{topic.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            {helpTopics && selectedTopic && (
              <div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {helpTopics[selectedTopic].title}
                </h3>
                <p className="text-gray-400 mb-6">
                  {helpTopics[selectedTopic].description}
                </p>
                
                <div className="space-y-6">
                  {helpTopics[selectedTopic].sections.map((section) => (
                    <div key={section.id} className="bg-gray-700 p-4 rounded-lg">
                      <h4 className="text-lg font-semibold text-white mb-2">
                        {section.title}
                      </h4>
                      <p className="text-gray-300">{section.content}</p>
                    </div>
                  ))}
                </div>

                {/* Quick Tips */}
                <div className="mt-8 p-4 bg-yellow-600/10 border border-yellow-600/20 rounded-lg">
                  <div className="flex items-center mb-2">
                    <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h5 className="text-yellow-500 font-semibold">Consejo Rápido</h5>
                  </div>
                  <p className="text-gray-300">
                    Recuerda que puedes usar los íconos de interrogación (?) en todo el sistema 
                    para obtener ayuda contextual sobre cualquier función específica.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Preguntas Frecuentes</h3>
        <div className="space-y-4">
          <div className="border-b border-gray-700 pb-4">
            <h4 className="text-white font-medium mb-2">¿Cómo reinicio el servidor de streaming?</h4>
            <p className="text-gray-400">
              Ve a la sección "Servidor" y usa los controles de servicios para reiniciar Icecast.
            </p>
          </div>
          <div className="border-b border-gray-700 pb-4">
            <h4 className="text-white font-medium mb-2">¿Por qué no puedo crear más streams?</h4>
            <p className="text-gray-400">
              Verifica que el cliente no haya alcanzado su límite máximo de streams configurado.
            </p>
          </div>
          <div className="border-b border-gray-700 pb-4">
            <h4 className="text-white font-medium mb-2">¿Cómo configuro el Auto DJ?</h4>
            <p className="text-gray-400">
              En la configuración del stream, habilita la opción "Auto DJ" para reproducir música automáticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;