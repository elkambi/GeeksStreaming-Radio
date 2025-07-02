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

// The rest of the components will be continued in the next part...
// Due to length limitations, I'll need to continue with StreamManagement and other components

export default App;