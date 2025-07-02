# 🎵 Radio Admin Panel Professional

## Sistema Completo de Administración de Radio Streaming

**Versión 2.0.0** - Sistema profesional estilo Sonic Panel para administrar estaciones de radio por internet con características avanzadas.

---

## 🌟 **Características Principales**

### 🎛️ **Gestión Completa de Radio**
- ✅ **Panel de Administración Profesional** - Interfaz moderna y responsive
- ✅ **Gestión de Clientes** - CRUD completo con límites personalizables
- ✅ **Gestión de Streams** - Configuración avanzada de transmisiones
- ✅ **Control en Tiempo Real** - Start/Stop de streams instantáneo
- ✅ **Integración Icecast/SHOUTcast** - Servidores de streaming reales

### 📊 **Analytics y Reportes**
- ✅ **Dashboard Avanzado** - Estadísticas en tiempo real
- ✅ **Monitoreo de Sistema** - CPU, memoria, disco, red
- ✅ **Analytics de Streams** - Oyentes, ancho de banda, popularidad
- ✅ **Reportes Detallados** - Histórico de uso y tendencias

### 💰 **Sistema de Facturación**
- ✅ **Planes de Suscripción** - Básico, Premium, Empresarial
- ✅ **Facturación Automática** - Generación mensual de facturas
- ✅ **Control de Pagos** - Estado de pagos y vencimientos
- ✅ **Notificaciones por Email** - Avisos automáticos

### ⚙️ **Configuración del Servidor**
- ✅ **Panel de Configuración** - Settings categorizados por función
- ✅ **Gestión de Base de Datos** - Herramientas administrativas MongoDB
- ✅ **Sistema de Backups** - Respaldos automáticos programados
- ✅ **Monitoreo de Servicios** - Estado de Icecast, MongoDB, etc.

### 📧 **Sistema de Correo**
- ✅ **Configuración SMTP** - Integración con proveedores de email
- ✅ **Notificaciones Automáticas** - Bienvenida, facturas, alertas
- ✅ **Templates Personalizables** - Emails con diseño profesional

### 🎵 **Características Avanzadas de Streaming**
- ✅ **Auto DJ** - Reproducción automática cuando no hay fuente
- ✅ **Múltiples Formatos** - MP3, AAC, OGG
- ✅ **Control de Bitrate** - 64kbps hasta 320kbps
- ✅ **Límites de Oyentes** - Control por cliente y stream
- ✅ **Scheduling/Programación** - (Próximamente)

### 🆘 **Sistema de Ayuda**
- ✅ **Centro de Ayuda** - Documentación completa
- ✅ **Tooltips Contextuales** - Ayuda con íconos (?) en toda la interfaz
- ✅ **Guías Step-by-Step** - Tutoriales detallados
- ✅ **FAQ** - Preguntas frecuentes

---

## 🚀 **Instalación Rápida**

### **Opción 1: Instalación Automatizada (Recomendada)**

```bash
# Clonar o descargar los archivos del sistema
# Asegúrate de estar en Ubuntu Server 22.04

# Hacer ejecutable el script de instalación
chmod +x install.sh

# Ejecutar instalación (NO como root)
./install.sh
```

El script instalará automáticamente:
- ✅ Node.js 18 LTS y Yarn
- ✅ Python 3.10+ y dependencias
- ✅ MongoDB 6.0
- ✅ Nginx con SSL (Let's Encrypt)
- ✅ Icecast2 para streaming
- ✅ Supervisor para gestión de servicios
- ✅ Fail2Ban para seguridad
- ✅ UFW Firewall configurado
- ✅ Sistema de backups automáticos

---

## ⚡ **Inicio Rápido**

### **1. Acceder al Sistema**
```
URL: https://tu-dominio.com
Usuario: admin
Contraseña: admin123
```

### **2. Primeros Pasos**
1. **Cambiar contraseña** del administrador
2. **Configurar servidor** en Settings → Servidor
3. **Agregar primer cliente** en Clientes
4. **Crear primer stream** en Streams
5. **Iniciar transmisión** con los controles

---

## 🎯 **Características Implementadas**

### ✅ **Sistema de Autenticación**
- Login/logout seguro con JWT
- Gestión de permisos por rol
- Sesiones persistentes

### ✅ **Dashboard Inteligente**
- Estadísticas en tiempo real del sistema
- Monitoreo de CPU, memoria y disco
- Actividad reciente con timestamps
- Indicadores de salud del sistema

### ✅ **Gestión Avanzada de Clientes**
- CRUD completo con validaciones
- Límites personalizables por cliente
- Planes de facturación (Básico, Premium, Empresarial)
- Estados de cliente (Activo, Suspendido, Inactivo)
- Contador de streams por cliente

### ✅ **Gestión Profesional de Streams**
- Configuración completa de audio (bitrate, formato)
- Control de puertos y mount points
- Auto DJ configurable
- Límites de oyentes por stream
- Control Start/Stop en tiempo real
- Estados visuales (En Vivo, Detenido, Error)

### ✅ **Sistema de Analytics**
- Estadísticas de uso por stream
- Monitoreo de ancho de banda
- Reportes de oyentes y popularidad
- Métricas del sistema en tiempo real

### ✅ **Sistema de Facturación**
- Generación automática de facturas
- Control de estados de pago
- Planes de suscripción flexibles
- Reportes de ingresos

### ✅ **Centro de Configuración del Servidor**
- Panel de configuración categorizado
- Herramientas de base de datos
- Sistema de backups automatizado
- Monitoreo de servicios

### ✅ **Sistema de Ayuda Integrado**
- Centro de ayuda con guías completas
- Tooltips contextuales en toda la interfaz
- FAQ y troubleshooting
- Documentación paso a paso

---

## 🛠️ **Comandos Útiles**

```bash
# Ver estado de servicios
sudo supervisorctl status

# Reiniciar todos los servicios
sudo supervisorctl restart all

# Ver logs del backend
sudo supervisorctl tail -f radio-admin-backend

# Ver logs del frontend  
sudo supervisorctl tail -f radio-admin-frontend

# Crear backup manual
/opt/radio-admin/backup.sh

# Ver logs de Nginx
tail -f /var/log/nginx/error.log
```

---

## 🎯 **Próximas Características**

### **En Desarrollo**
- 🎵 **DJ Scheduling** - Programación de contenido por horarios
- 📱 **Mobile Interface** - Interfaz optimizada para móviles
- 🔐 **2FA Authentication** - Autenticación de dos factores
- 📊 **PDF Reports** - Reportes exportables en PDF

### **Planificado**
- 🎤 **Live Chat** - Chat en vivo para oyentes
- 🌐 **Multi-language** - Soporte para múltiples idiomas
- ☁️ **Cloud Integration** - Integración con servicios cloud
- 🎨 **Custom Themes** - Temas personalizables

---

**🎵 ¡Tu plataforma de radio profesional está lista! 🌍**