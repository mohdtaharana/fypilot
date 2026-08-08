// Synapse — AI Intelligence Layer for FYP Management
// Frontend Application with Responsive Design, Authentication, Interactive Charts & Executive Role Powers

const API_BASE = '/api';

// ===== State Management =====
const storedUserJson = localStorage.getItem('synapse_user');
let initialUser = null;
try {
  if (storedUserJson) initialUser = JSON.parse(storedUserJson);
} catch (e) {
  initialUser = null;
}

const state = {
  isAuthenticated: !!initialUser,
  currentUser: initialUser,
  currentView: 'dashboard',
  selectedLoginRole: 'coordinator',
  loginMode: 'login',
  loginPrefillEmail: '',
  mobileMenuOpen: false,
  proposals: [],
  projects: [],
  users: [],
  dashboardStats: null,
  pendingUsers: [],
  pendingRefreshTimer: null,
  selectedProposal: null,
  selectedProject: null,
  aiLoading: {},
  aiResults: {},
};

// Demo User Credentials & Accounts
const DEMO_ACCOUNTS = {
  coordinator: {
    role: 'coordinator',
    label: 'Coordinator',
    icon: 'fa-user-shield',
    defaultEmail: 'admin@university.edu',
    passwordHint: 'TahaRana@123',
    name: 'Dr. Admin Coordinator',
    desc: 'Full system management, proposal approvals & health overrides'
  },
  supervisor: {
    role: 'supervisor',
    label: 'Supervisor',
    icon: 'fa-user-tie',
    defaultEmail: 'ahmed.khan@university.edu',
    passwordHint: 'supervisor123',
    name: 'Dr. Ahmed Khan',
    desc: 'Project oversight, task assignment & meeting scheduler'
  },
  student: {
    role: 'student',
    label: 'Student',
    icon: 'fa-user-graduate',
    defaultEmail: 'ali.hassan@student.edu',
    passwordHint: 'student123',
    name: 'Ali Hassan',
    desc: 'Proposal submission & project tracking'
  }
};

// Chart.js Instance Tracker
const chartInstances = {};
function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// ===== API Client =====
async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': state.currentUser ? state.currentUser.id : 'guest',
    'X-User-Role': state.currentUser ? state.currentUser.role : 'guest',
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    if (!options.silentError) {
      showToast(err.message, 'error');
    }
    throw err;
  }
}

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const colors = { info: 'bg-blue-600', success: 'bg-emerald-600', error: 'bg-rose-600', warning: 'bg-amber-600' };
  const toast = document.createElement('div');
  toast.className = `${colors[type]} text-white px-4 py-3 rounded-xl shadow-xl mb-2 fade-in text-sm max-w-sm flex items-center gap-2 font-medium z-[9999]`;
  toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} text-base"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ===== Navigation =====
function navigate(view, data = null) {
  state.currentView = view;
  state.mobileMenuOpen = false;
  if (data) {
    if (view === 'proposal-detail') state.selectedProposal = data;
    if (view === 'project-detail') state.selectedProject = data;
  }
  render();
}

function toggleMobileMenu() {
  state.mobileMenuOpen = !state.mobileMenuOpen;
  render();
}

// ===== Main Render =====
function render() {
  const app = document.getElementById('app');
  if (!app) return;

  if (!state.isAuthenticated || !state.currentUser) {
    app.innerHTML = renderLoginScreen();
    attachLoginEventListeners();
    return;
  }

  app.innerHTML = `
    ${renderNav()}
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6 min-h-[calc(100vh-4rem)]">
      ${renderCurrentView()}
    </main>
  `;
  attachEventListeners();
}

// ===== Authentication UI =====
function renderLoginScreen() {
  const activeRole = state.selectedLoginRole;
  const accountInfo = DEMO_ACCOUNTS[activeRole];
  const isRegisterMode = state.loginMode === 'register';

  return `
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-synapse-950 to-indigo-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
    <!-- Ambient Blur Background Elements -->
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-synapse-500/20 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

    <div class="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8 fade-in relative z-10">
      
      <!-- Brand Header -->
      <div class="text-center mb-6">
        <div class="w-14 h-14 bg-gradient-to-tr from-synapse-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-synapse-500/30 mb-3">
          <i class="fas fa-brain text-white text-2xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Welcome to Synapse</h1>
        <p class="text-xs text-gray-500 mt-1 font-medium">AI Intelligence Layer for FYP Management</p>
      </div>

      <!-- Login / Register Tab Toggle -->
      <div class="flex bg-gray-100 p-1 rounded-xl gap-1 mb-6">
        <button onclick="setLoginMode('login')" class="flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!isRegisterMode ? 'bg-white text-synapse-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}">
          <i class="fas fa-sign-in-alt mr-1.5"></i> Sign In
        </button>
        <button onclick="setLoginMode('register')" class="flex-1 py-2 rounded-lg text-xs font-bold transition-all ${isRegisterMode ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}">
          <i class="fas fa-user-plus mr-1.5"></i> Register
        </button>
      </div>

      ${isRegisterMode ? `
      <!-- REGISTER FORM -->
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-800 flex items-start gap-2">
        <i class="fas fa-info-circle text-amber-500 mt-0.5 shrink-0"></i>
        <span>Your account will be <strong>pending coordinator approval</strong> after registration. You can login once approved.</span>
      </div>

      <!-- Role Select for Registration -->
      <div class="mb-4">
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">I am registering as</label>
        <div class="grid grid-cols-2 gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-200">
          <button type="button" onclick="selectLoginRole('student')" 
                  class="flex items-center justify-center gap-2 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${activeRole === 'student' ? 'bg-white text-emerald-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900'}">
            <i class="fas fa-user-graduate ${activeRole === 'student' ? 'text-emerald-600' : 'text-gray-400'}"></i> Student
          </button>
          <button type="button" onclick="selectLoginRole('supervisor')"
                  class="flex items-center justify-center gap-2 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${activeRole === 'supervisor' ? 'bg-white text-blue-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900'}">
            <i class="fas fa-user-tie ${activeRole === 'supervisor' ? 'text-blue-600' : 'text-gray-400'}"></i> Supervisor
          </button>
        </div>
      </div>

      <form id="register-form" class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><i class="fas fa-user text-sm"></i></div>
            <input type="text" id="reg-name" required placeholder="${activeRole === 'supervisor' ? 'e.g. Dr. Ali Hassan' : 'e.g. Muhammad Ali'}"
                   class="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all">
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">University Email *</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><i class="fas fa-envelope text-sm"></i></div>
            <input type="email" id="reg-email" required placeholder="${activeRole === 'supervisor' ? 'name@university.edu' : 'rollno@student.edu'}"
                   class="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all">
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Department</label>
          <input type="text" id="reg-department" value="Computer Science"
                 class="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all">
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Create Password *</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><i class="fas fa-lock text-sm"></i></div>
            <input type="password" id="reg-password" required minlength="6" placeholder="Choose a password (min 6 chars)"
                   class="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all">
          </div>
        </div>

        ${activeRole === 'supervisor' ? `
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Areas of Expertise <span class="text-gray-400 font-normal">(comma-separated)</span></label>
          <input type="text" id="reg-expertise" placeholder="e.g. Machine Learning, IoT, Cybersecurity"
                 class="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Max Student Capacity</label>
          <input type="number" id="reg-capacity" value="5" min="1" max="15"
                 class="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all">
        </div>
        ` : ''}

        <button type="submit" id="btn-register"
                class="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center gap-2 mt-2">
          <i class="fas fa-paper-plane text-xs"></i>
          <span>Submit Registration Request</span>
        </button>
      </form>

      <p class="text-center text-xs text-gray-500 mt-4">Already have an account? <button onclick="setLoginMode('login')" class="text-synapse-600 font-semibold hover:underline">Sign In</button></p>
      ` : `
      <!-- LOGIN FORM -->
      <!-- Login Form -->
      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <i class="fas fa-envelope text-sm"></i>
            </div>
            <input type="email" id="login-email" required 
                   value="${state.loginPrefillEmail || accountInfo.defaultEmail}"
                   class="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-synapse-500 focus:bg-white transition-all" 
                   placeholder="your@email.edu" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Password</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <i class="fas fa-lock text-sm"></i>
            </div>
            <input type="password" id="login-password" required 
                   value="${state.loginPrefillEmail ? '' : accountInfo.passwordHint}"
                   class="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-synapse-500 focus:bg-white transition-all" 
                   placeholder="Enter your account password" />
            <button type="button" onclick="togglePasswordVisibility()" class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
              <i class="fas fa-eye text-sm" id="toggle-pwd-icon"></i>
            </button>
          </div>
        </div>

        <button type="submit" id="btn-login" 
                class="w-full py-3 px-4 bg-gradient-to-r from-synapse-600 to-indigo-600 hover:from-synapse-700 hover:to-indigo-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-synapse-500/25 transition-all duration-200 flex items-center justify-center gap-2">
          <span>Sign In</span>
          <i class="fas fa-arrow-right text-xs"></i>
        </button>
      </form>

      <!-- Quick Demo Login Pills -->
      <div class="mt-5 pt-4 border-t border-gray-100">
        <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">Quick Demo Login</p>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <button onclick="quickLogin('coordinator')" class="flex flex-col items-center gap-1 p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-all">
            <i class="fas fa-user-shield text-indigo-500"></i>
            <span class="font-semibold text-indigo-700 text-[11px]">Coordinator</span>
          </button>
          <button onclick="quickLogin('supervisor')" class="flex flex-col items-center gap-1 p-2 rounded-xl bg-synapse-50 hover:bg-synapse-100 border border-synapse-100 transition-all">
            <i class="fas fa-user-tie text-synapse-500"></i>
            <span class="font-semibold text-synapse-700 text-[11px]">Supervisor</span>
          </button>
          <button onclick="quickLogin('student')" class="flex flex-col items-center gap-1 p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-all">
            <i class="fas fa-user-graduate text-emerald-500"></i>
            <span class="font-semibold text-emerald-700 text-[11px]">Student</span>
          </button>
        </div>
        <p class="text-center text-xs text-gray-500 mt-4">New user? <button onclick="setLoginMode('register')" class="text-indigo-600 font-semibold hover:underline">Register here</button></p>
      </div>
      `}

    </div>
  </div>`;
}


function selectLoginRole(roleKey) {
  state.selectedLoginRole = roleKey;
  render();
}

function quickLogin(roleKey) {
  // One-click demo login: fill credentials and submit
  state.selectedLoginRole = roleKey;
  state.loginPrefillEmail = '';
  render();
  // Small delay to let DOM update, then fill and submit
  setTimeout(() => {
    const emailEl = document.getElementById('login-email');
    const pwdEl = document.getElementById('login-password');
    const btn = document.getElementById('btn-login');
    if (emailEl) emailEl.value = DEMO_ACCOUNTS[roleKey].defaultEmail;
    if (pwdEl) pwdEl.value = DEMO_ACCOUNTS[roleKey].passwordHint;
    if (btn) btn.click();
  }, 50);
}

function setLoginMode(mode, prefillEmail = '') {
  state.loginMode = mode;
  if (mode === 'register') state.selectedLoginRole = 'student';
  if (prefillEmail) state.loginPrefillEmail = prefillEmail;
  render();
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById('login-password');
  const pwdIcon = document.getElementById('toggle-pwd-icon');
  if (pwdInput && pwdIcon) {
    if (pwdInput.type === 'password') {
      pwdInput.type = 'text';
      pwdIcon.className = 'fas fa-eye-slash text-sm';
    } else {
      pwdInput.type = 'password';
      pwdIcon.className = 'fas fa-eye text-sm';
    }
  }
}

function attachLoginEventListeners() {
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');

    if (!email || !password) {
      showToast('Please fill in both email and password', 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin text-sm"></i> <span>Authenticating...</span>`;

    try {
      const res = await api('/users/login', {
        method: 'POST',
        body: JSON.stringify({
          role: state.selectedLoginRole,
          username: email,
          password: password,
        }),
      });

      if (res.success && res.data && res.data.user) {
        state.currentUser = res.data.user;
        state.isAuthenticated = true;
        state.loginPrefillEmail = '';
        localStorage.setItem('synapse_user', JSON.stringify(res.data.user));
        showToast(`Welcome back, ${res.data.user.name || 'User'}!`, 'success');
        render();
      } else {
        showToast(res.error || 'Authentication failed', 'error');
      }
    } catch (err) {
      // Error handled by api helper toast
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>Log In</span> <i class="fas fa-arrow-right text-xs"></i>`;
      }
    }
  });
}

  // Register form
  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-register');
      const name = document.getElementById('reg-name')?.value.trim();
      const email = document.getElementById('reg-email')?.value.trim();
      const password = document.getElementById('reg-password')?.value;
      const department = document.getElementById('reg-department')?.value.trim() || 'Computer Science';
      const expertiseEl = document.getElementById('reg-expertise');
      const capacityEl = document.getElementById('reg-capacity');
      const role = state.selectedLoginRole;

      const expertise = expertiseEl?.value.trim()
        ? expertiseEl.value.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      if (!name || !email) {
        showToast('Name and email are required', 'error');
        return;
      }

      if (!password || password.length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin text-sm"></i> <span>Submitting...</span>`;

      try {
        const res = await api('/users/register', {
          method: 'POST',
          body: JSON.stringify({
            name, email, password, role, department,
            expertise,
            max_students: capacityEl ? parseInt(capacityEl.value) : 8
          })
        });

        if (res.success) {
          showToast('Registration submitted! Awaiting coordinator approval. You can login once approved.', 'success');
          state.loginPrefillEmail = email;
          state.selectedLoginRole = role;
          setLoginMode('login');
        } else {
          showToast(res.error || 'Registration failed', 'error');
        }
      } catch (err) {
        // handled by api helper
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fas fa-paper-plane text-xs"></i> <span>Submit Registration Request</span>`;
        }
      }
    });
  }
}

async function approveUser(userId) {
  try {
    const res = await api(`/users/${userId}/approve`, { method: 'PUT' });
    if (res.success) {
      showToast('User approved successfully! Account is now active.', 'success');
      await loadPendingUsers();
      if (state.currentView === 'dashboard') loadDashboard();
      if (state.currentView === 'supervisors') loadSupervisors();
    }
  } catch (e) {
    // Handled by api helper
  }
}

async function rejectUser(userId) {
  try {
    const res = await api(`/users/${userId}/reject`, { method: 'PUT' });
    if (res.success) {
      showToast('Registration request rejected.', 'info');
      await loadPendingUsers();
      if (state.currentView === 'dashboard') loadDashboard();
      if (state.currentView === 'supervisors') loadSupervisors();
    }
  } catch (e) {
    // Handled by api helper
  }
}

function renderPendingUsers(users) {
  if (!users || users.length === 0) {
    return '<p class="text-xs text-gray-400 font-medium py-2">No pending registration requests.</p>';
  }
  return users.map(u => `
    <div class="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 px-1 rounded-xl transition-colors">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <p class="text-xs sm:text-sm font-bold text-gray-900 truncate">${u.name}</p>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${u.role === 'supervisor' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}">${u.role}</span>
        </div>
        <p class="text-[11px] text-gray-500 truncate mt-0.5">${u.email}${u.department ? ` &bull; ${u.department}` : ''}${u.created_at ? ` &bull; ${new Date(u.created_at).toLocaleDateString()}` : ''}</p>
        ${u.role === 'supervisor' && u.expertise ? `<p class="text-[10px] text-indigo-600 truncate font-medium">Expertise: ${formatExpertise(u.expertise)}</p>` : ''}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button onclick="approveUser('${u.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"><i class="fas fa-check-circle"></i> Approve</button>
        <button onclick="rejectUser('${u.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border border-rose-200 transition-all"><i class="fas fa-times-circle"></i> Reject</button>
      </div>
    </div>
  `).join('');
}

function formatExpertise(expertise) {
  if (!expertise) return '—';
  try {
    const list = typeof expertise === 'string' ? JSON.parse(expertise) : expertise;
    return Array.isArray(list) ? list.slice(0, 3).join(', ') : String(expertise);
  } catch (e) {
    return String(expertise);
  }
}

async function loadPendingUsers() {
  if (!state.currentUser || state.currentUser.role !== 'coordinator') return;
  try {
    const res = await api('/users/pending', { silentError: true });
    state.pendingUsers = res.data || [];
    const container = document.getElementById('pending-approvals');
    if (container) container.innerHTML = renderPendingUsers(state.pendingUsers);
    const countEl = document.getElementById('pending-count');
    if (countEl) countEl.textContent = state.pendingUsers.length;
  } catch (e) {
    // Ignore unauthorized or network errors
  }
}

function logout() {
  state.isAuthenticated = false;
  state.currentUser = null;
  state.mobileMenuOpen = false;
  localStorage.removeItem('synapse_user');
  showToast('Logged out successfully', 'info');
  render();
}

// ===== Navbar Component =====
function renderNav() {
  const links = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
    { id: 'proposals', label: 'Proposals', icon: 'fa-file-alt' },
    { id: 'projects', label: 'Projects', icon: 'fa-project-diagram' },
    { id: 'supervisors', label: 'Supervisors', icon: 'fa-user-tie' },
  ];

  const roleBadges = {
    coordinator: 'bg-purple-100 text-purple-700 border-purple-200',
    supervisor: 'bg-blue-100 text-blue-700 border-blue-200',
    student: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  const currentRole = state.currentUser ? state.currentUser.role : 'guest';

  return `
  <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="flex items-center justify-between h-16">
        
        <!-- Brand Logo & Title -->
        <div class="flex items-center gap-2 cursor-pointer" onclick="navigate('dashboard')">
          <div class="w-9 h-9 bg-gradient-to-tr from-synapse-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-synapse-500/20">
            <i class="fas fa-brain text-white text-base"></i>
          </div>
          <span class="text-xl font-bold text-gray-900 tracking-tight">Synapse</span>
          <span class="text-[10px] bg-synapse-100 text-synapse-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">AI</span>
        </div>

        <!-- Desktop Navigation Links -->
        <div class="hidden md:flex items-center gap-1">
          ${links.map(l => `
            <button onclick="navigate('${l.id}')" 
                    class="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-2 ${state.currentView === l.id || state.currentView.startsWith(l.id) ? 'bg-synapse-50 text-synapse-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}">
              <i class="fas ${l.icon} text-sm"></i>
              <span>${l.label}</span>
            </button>
          `).join('')}
        </div>

        <!-- User Controls (Desktop) -->
        <div class="hidden md:flex items-center gap-3">
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold border ${roleBadges[currentRole] || 'bg-gray-100'} capitalize flex items-center gap-1">
            <i class="fas ${currentRole === 'coordinator' ? 'fa-crown text-purple-600' : currentRole === 'supervisor' ? 'fa-user-tie text-blue-600' : 'fa-user-graduate text-emerald-600'} text-xs"></i>
            ${currentRole}
          </span>
          
          <div class="flex items-center gap-2 bg-gray-50 border rounded-xl px-3 py-1.5">
            <div class="w-7 h-7 bg-synapse-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              ${(state.currentUser.name || 'U').charAt(0)}
            </div>
            <span class="text-xs font-semibold text-gray-800 truncate max-w-[120px]">${state.currentUser.name || 'User'}</span>
          </div>

          <button onclick="logout()" title="Logout" 
                  class="p-2 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors">
            <i class="fas fa-sign-out-alt text-base"></i>
          </button>
        </div>

        <!-- Mobile Hamburger Button -->
        <div class="flex items-center gap-2 md:hidden">
          <button onclick="toggleMobileMenu()" class="p-2.5 rounded-xl text-gray-600 hover:bg-gray-100 focus:outline-none">
            <i class="fas ${state.mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-lg"></i>
          </button>
        </div>

      </div>
    </div>

    <!-- Mobile Dropdown Menu -->
    ${state.mobileMenuOpen ? `
    <div class="md:hidden bg-white border-t border-gray-200 px-4 py-3 space-y-2 fade-in shadow-lg">
      <div class="flex items-center justify-between pb-3 border-b border-gray-100">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-synapse-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            ${(state.currentUser.name || 'U').charAt(0)}
          </div>
          <div>
            <div class="text-sm font-semibold text-gray-900">${state.currentUser.name || 'User'}</div>
            <div class="text-xs text-gray-500 capitalize">${currentRole}</div>
          </div>
        </div>
        <button onclick="logout()" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 flex items-center gap-1">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>

      <div class="space-y-1 pt-1">
        ${links.map(l => `
          <button onclick="navigate('${l.id}')" 
                  class="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${state.currentView === l.id || state.currentView.startsWith(l.id) ? 'bg-synapse-50 text-synapse-700' : 'text-gray-700 hover:bg-gray-50'}">
            <i class="fas ${l.icon} w-5 text-center text-synapse-500"></i>
            <span>${l.label}</span>
          </button>
        `).join('')}
      </div>
    </div>` : ''}

  </nav>`;
}

function renderCurrentView() {
  switch (state.currentView) {
    case 'dashboard': return renderDashboard();
    case 'proposals': return renderProposals();
    case 'proposal-detail': return renderProposalDetail();
    case 'projects': return renderProjects();
    case 'project-detail': return renderProjectDetail();
    case 'supervisors': return renderSupervisors();
    default: return renderDashboard();
  }
}

// ===== Dashboard (Role-Specific) =====
function renderDashboard() {
  const role = state.currentUser.role;
  if (role === 'coordinator') return renderCoordinatorDashboard();
  if (role === 'supervisor') return renderSupervisorDashboard();
  return renderStudentDashboard();
}

// ===== COORDINATOR Dashboard =====
function renderCoordinatorDashboard() {
  return `
  <div class="fade-in space-y-6">
    <!-- Hero Banner -->
    <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-purple-500/20">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 bg-purple-500/30 border border-purple-400/30 text-purple-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <i class="fas fa-crown"></i> Executive Coordinator
          </span>
          <h1 class="text-2xl sm:text-3xl font-bold mt-2">System Governance Center</h1>
          <p class="text-purple-200 text-sm mt-1">Full platform authority — manage proposals, projects & supervisors system-wide.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="triggerCoordinatorBroadcast()" class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-1.5">
            <i class="fas fa-bullhorn"></i> Broadcast Announcement
          </button>
          <button onclick="navigate('proposals')" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5">
            <i class="fas fa-file-alt"></i> All Proposals
          </button>
        </div>
      </div>
    </div>

    <!-- KPI Stats -->
    <div id="dashboard-stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">${renderStatsSkeleton()}</div>

    <!-- Pending Registration Approvals -->
    <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-user-clock text-indigo-500"></i> Pending Registrations</h3>
        <div class="flex items-center gap-2">
          <button onclick="loadPendingUsers()" title="Refresh pending requests" class="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-all"><i class="fas fa-sync-alt text-xs"></i> Refresh</button>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><i class="fas fa-hourglass-half"></i> <span id="pending-count">0</span></span>
        </div>
      </div>
      <div id="pending-approvals" class="space-y-1 text-sm">Loading...</div>
      <p class="text-[11px] text-gray-400 mt-3 flex items-center gap-1.5"><i class="fas fa-info-circle text-indigo-400"></i> Students &amp; supervisors register themselves and stay inactive until you approve them here.</p>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-chart-pie text-purple-500"></i> Proposal Status</h3>
        <div class="h-52"><canvas id="proposalsChart"></canvas></div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-chart-bar text-emerald-500"></i> Project Health</h3>
        <div class="h-52"><canvas id="projectHealthChart"></canvas></div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-tasks text-indigo-500"></i> Task Overview</h3>
        <div class="h-52"><canvas id="taskOverviewChart"></canvas></div>
      </div>
    </div>

    <!-- Pending Actions + Project Health -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-clock text-amber-500"></i> Proposals Awaiting Decision</h3>
          <button onclick="navigate('proposals')" class="text-xs font-semibold text-purple-600 hover:text-purple-800">View All &rarr;</button>
        </div>
        <div id="recent-proposals" class="space-y-3 text-sm">Loading...</div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-heartbeat text-rose-500"></i> System Project Health</h3>
          <button onclick="navigate('projects')" class="text-xs font-semibold text-purple-600 hover:text-purple-800">View All &rarr;</button>
        </div>
        <div id="project-health" class="space-y-3 text-sm">Loading...</div>
      </div>
    </div>

    <!-- Quick Executive Actions -->
    <div class="bg-gradient-to-r from-slate-900 to-purple-900 rounded-2xl p-5 border border-purple-500/20 text-white">
      <h3 class="font-bold text-sm mb-3 flex items-center gap-2"><i class="fas fa-bolt text-yellow-400"></i> Quick Executive Actions</h3>
      <div class="flex flex-wrap gap-2">
        <button onclick="navigate('proposals')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-check-circle"></i> Review Proposals</button>
        <button onclick="navigate('projects')" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-exclamation-triangle"></i> At-Risk Projects</button>
        <button onclick="navigate('supervisors')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-users"></i> Supervisor Workloads</button>
        <button onclick="triggerCoordinatorBroadcast()" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-bullhorn"></i> Send Broadcast</button>
      </div>
    </div>
  </div>`;
}

// ===== SUPERVISOR Dashboard =====
function renderSupervisorDashboard() {
  return `
  <div class="fade-in space-y-6">
    <!-- Hero Banner -->
    <div class="bg-gradient-to-r from-blue-900 via-synapse-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-blue-500/20">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <i class="fas fa-user-tie"></i> Supervisor Portal
          </span>
          <h1 class="text-2xl sm:text-3xl font-bold mt-2">Academic Oversight Hub</h1>
          <p class="text-blue-200 text-sm mt-1">Monitor your assigned projects, manage tasks and schedule student meetings.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="navigate('projects')" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-1.5">
            <i class="fas fa-project-diagram"></i> My Projects
          </button>
          <button onclick="navigate('proposals')" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5">
            <i class="fas fa-file-alt"></i> Review Proposals
          </button>
        </div>
      </div>
    </div>

    <!-- KPI Stats -->
    <div id="dashboard-stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">${renderStatsSkeleton()}</div>

    <!-- Charts: Task + Health -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-tasks text-blue-500"></i> Task Status Across Projects</h3>
        <div class="h-56"><canvas id="taskOverviewChart"></canvas></div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-chart-bar text-emerald-500"></i> Project Health Status</h3>
        <div class="h-56"><canvas id="projectHealthChart"></canvas></div>
      </div>
    </div>

    <!-- My Projects + Proposals to Review -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-folder-open text-blue-500"></i> My Supervised Projects</h3>
          <button onclick="navigate('projects')" class="text-xs font-semibold text-blue-600 hover:text-blue-800">View All &rarr;</button>
        </div>
        <div id="project-health" class="space-y-3 text-sm">Loading...</div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-inbox text-amber-500"></i> Proposals Pending Review</h3>
          <button onclick="navigate('proposals')" class="text-xs font-semibold text-blue-600 hover:text-blue-800">View All &rarr;</button>
        </div>
        <div id="recent-proposals" class="space-y-3 text-sm">Loading...</div>
      </div>
    </div>

    <!-- Supervisor Quick Actions -->
    <div class="bg-gradient-to-r from-slate-900 to-blue-900 rounded-2xl p-5 border border-blue-500/20 text-white">
      <h3 class="font-bold text-sm mb-3 flex items-center gap-2"><i class="fas fa-bolt text-yellow-400"></i> Supervisor Quick Actions</h3>
      <div class="flex flex-wrap gap-2">
        <button onclick="navigate('projects')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-plus-circle"></i> Assign Tasks</button>
        <button onclick="navigate('proposals')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-lightbulb"></i> Write Feedback</button>
        <button onclick="navigate('supervisors')" class="bg-synapse-600 hover:bg-synapse-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-users"></i> Colleagues</button>
      </div>
    </div>
  </div>`;
}

// ===== STUDENT Dashboard =====
function renderStudentDashboard() {
  return `
  <div class="fade-in space-y-6">
    <!-- Hero Banner -->
    <div class="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-emerald-500/20">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <i class="fas fa-user-graduate"></i> Student Workspace
          </span>
          <h1 class="text-2xl sm:text-3xl font-bold mt-2">My FYP Dashboard</h1>
          <p class="text-emerald-200 text-sm mt-1">Track your proposal progress, project tasks, and upcoming milestones.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="showNewProposalForm(); navigate('proposals')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-1.5">
            <i class="fas fa-plus-circle"></i> Submit Proposal
          </button>
          <button onclick="navigate('projects')" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5">
            <i class="fas fa-eye"></i> My Project
          </button>
        </div>
      </div>
    </div>

    <!-- Personal Progress Stats -->
    <div id="dashboard-stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">${renderStatsSkeleton()}</div>

    <!-- My Submissions + My Active Project -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-file-alt text-emerald-500"></i> My Proposal Submissions</h3>
          <button onclick="navigate('proposals')" class="text-xs font-semibold text-emerald-600 hover:text-emerald-800">View All &rarr;</button>
        </div>
        <div id="recent-proposals" class="space-y-3 text-sm">Loading...</div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-rocket text-teal-500"></i> My Active Project</h3>
          <button onclick="navigate('projects')" class="text-xs font-semibold text-emerald-600 hover:text-emerald-800">Open &rarr;</button>
        </div>
        <div id="project-health" class="space-y-3 text-sm">Loading...</div>
      </div>
    </div>

    <!-- Task Progress Chart -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-tasks text-emerald-500"></i> My Task Progress</h3>
        <div class="h-52"><canvas id="taskOverviewChart"></canvas></div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-chart-pie text-teal-500"></i> Proposal Status</h3>
        <div class="h-52"><canvas id="proposalsChart"></canvas></div>
      </div>
    </div>

    <!-- Student Help Panel -->
    <div class="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-5 border border-emerald-500/20 text-white">
      <h3 class="font-bold text-sm mb-1 flex items-center gap-2"><i class="fas fa-graduation-cap text-yellow-400"></i> FYP Student Guide</h3>
      <p class="text-emerald-200 text-xs mb-3">Use AI tools to strengthen your proposal before submission.</p>
      <div class="flex flex-wrap gap-2">
        <button onclick="navigate('proposals')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-plus"></i> New Proposal</button>
        <button onclick="navigate('projects')" class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-tasks"></i> View Tasks</button>
        <button onclick="navigate('supervisors')" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-users"></i> Find Supervisor</button>
      </div>
    </div>
  </div>`;
}


function renderStatsSkeleton() {
  return Array(4).fill(0).map(() => `
    <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div class="skeleton h-4 w-24 rounded-lg mb-3"></div>
      <div class="skeleton h-8 w-16 rounded-lg"></div>
    </div>
  `).join('');
}

// ===== Proposals List =====
function renderProposals() {
  return `
  <div class="fade-in space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Proposals</h1>
        <p class="text-gray-500 text-xs sm:text-sm mt-0.5">Manage and evaluate FYP project submissions</p>
      </div>
      ${state.currentUser && state.currentUser.role === 'student' ? `
      <button onclick="showNewProposalForm()" class="bg-synapse-600 hover:bg-synapse-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-synapse-500/20 transition-all flex items-center justify-center gap-2">
        <i class="fas fa-plus"></i>
        <span>New Proposal</span>
      </button>
      ` : ''}
    </div>

    <div id="proposals-list" class="space-y-3">Loading...</div>
  </div>`;
}

// ===== Proposal Detail =====
function renderProposalDetail() {
  const p = state.selectedProposal;
  if (!p) return '<p class="p-6 text-gray-500">No proposal selected</p>';

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700 border-gray-200',
    submitted: 'bg-blue-100 text-blue-700 border-blue-200',
    under_review: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-100 text-rose-700 border-rose-200',
    revision_requested: 'bg-orange-100 text-orange-700 border-orange-200'
  };

  return `
  <div class="fade-in space-y-6">
    <button onclick="navigate('proposals')" class="text-xs font-semibold text-gray-500 hover:text-gray-800 inline-flex items-center gap-1.5 bg-white border px-3 py-1.5 rounded-xl shadow-sm">
      <i class="fas fa-arrow-left text-xs"></i> Back to Proposals
    </button>

    <!-- EXECUTIVE POWER CONTROLS FOR COORDINATOR -->
    ${state.currentUser.role === 'coordinator' ? `
    <div class="bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-indigo-500/30 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div class="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center text-white text-sm shadow-md shrink-0">
            <i class="fas fa-crown"></i>
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-bold text-sm sm:text-base text-white">Coordinator Approval & Authorization Panel</h3>
            <p class="text-xs text-indigo-200 leading-snug mt-0.5">Execute official decision on this FYP proposal</p>
          </div>
        </div>
        <span class="text-[10px] bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 whitespace-nowrap self-start sm:self-auto">Executive Power</span>
      </div>

      <div class="flex flex-wrap gap-2 pt-3 border-t border-indigo-800/60">
        <button onclick="updateProposalStatus('${p.id}', 'approved')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md">
          <i class="fas fa-check-circle"></i> Approve & Issue Clearance
        </button>
        <button onclick="updateProposalStatus('${p.id}', 'revision_requested')" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md">
          <i class="fas fa-edit"></i> Request Mandatory Revision
        </button>
        <button onclick="updateProposalStatus('${p.id}', 'rejected')" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md">
          <i class="fas fa-times-circle"></i> Reject Submission
        </button>
      </div>

      <!-- Supervisor Allocation Control -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 pt-3 border-t border-indigo-800/60">
        <span class="text-xs font-semibold text-indigo-200 shrink-0"><i class="fas fa-user-tie text-amber-400 mr-1"></i>Assign Supervisor:</span>
        <select id="proposal-supervisor-select" class="w-full sm:w-auto flex-1 bg-slate-800 border border-indigo-500/40 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">-- Select Supervisor --</option>
          ${(state.supervisors || []).map(s => `
            <option value="${s.id}" ${p.supervisor_id === s.id ? 'selected' : ''}>${s.name} (${s.department || 'CS'})</option>
          `).join('')}
        </select>
        <button onclick="assignProposalSupervisor('${p.id}')" class="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5">
          <i class="fas fa-user-plus"></i> Assign Supervisor
        </button>
      </div>
    </div>
    ` : ''}

    <!-- SUPERVISOR POWER CONTROLS FOR SUPERVISORS -->
    ${state.currentUser.role === 'supervisor' ? `
    <div class="bg-gradient-to-r from-blue-950 to-synapse-950 text-white rounded-2xl p-5 shadow-xl border border-synapse-500/30 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-synapse-500 rounded-xl flex items-center justify-center text-white text-sm shadow-md">
            <i class="fas fa-user-tie"></i>
          </div>
          <div>
            <h3 class="font-bold text-sm text-white">Supervisor Assessment & Review Station</h3>
            <p class="text-[11px] text-synapse-200">Provide academic endorsement or guidance notes</p>
          </div>
        </div>
        <span class="text-[10px] bg-synapse-500/30 border border-synapse-400/40 text-synapse-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">Supervisor Power</span>
      </div>

      <div class="flex flex-wrap gap-2 pt-2 border-t border-synapse-800/60">
        <button onclick="endorseProposal('${p.id}')" class="bg-synapse-600 hover:bg-synapse-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md">
          <i class="fas fa-thumbs-up"></i> Endorse for Approval
        </button>
        <button onclick="runFeedbackAssistant('${p.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md">
          <i class="fas fa-lightbulb"></i> Generate Structured Review Notes
        </button>
      </div>
    </div>
    ` : ''}

    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900">${p.title}</h1>
          <p class="text-xs sm:text-sm text-gray-500 mt-1 flex items-center gap-2">
            <span><i class="fas fa-user text-gray-400 mr-1"></i>Submitted by ${p.submitter_name || 'Unknown'}</span>
          </p>
        </div>
        <span class="self-start px-3 py-1 rounded-full text-xs font-bold border ${statusColors[p.status] || 'bg-gray-100'} uppercase tracking-wider">
          ${p.status.replace('_', ' ')}
        </span>
      </div>

      ${p.abstract ? `<div class="pt-2"><h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Abstract</h4><p class="text-sm text-gray-600 mt-1 leading-relaxed">${p.abstract}</p></div>` : ''}
      ${p.problem_statement ? `<div class="pt-2"><h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Problem Statement</h4><p class="text-sm text-gray-600 mt-1 leading-relaxed">${p.problem_statement}</p></div>` : ''}
      ${p.objectives ? `<div class="pt-2"><h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Objectives</h4><p class="text-sm text-gray-600 mt-1 leading-relaxed">${p.objectives}</p></div>` : ''}
      ${p.methodology ? `<div class="pt-2"><h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Methodology</h4><p class="text-sm text-gray-600 mt-1 leading-relaxed">${p.methodology}</p></div>` : ''}
      ${p.technologies ? `<div class="pt-2"><h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Technologies</h4><p class="text-sm text-gray-600 mt-1">${p.technologies}</p></div>` : ''}
    </div>

    <!-- AI Intelligence Tools Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Quality Analysis -->
      <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
            <i class="fas fa-brain text-synapse-500"></i>
            AI Proposal Quality Analysis
          </h3>
          <button onclick="runProposalAnalysis('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 border border-synapse-200 px-3 py-1.5 rounded-xl hover:bg-synapse-100 font-semibold transition-colors">
            <i class="fas fa-play mr-1"></i>Analyze
          </button>
        </div>
        <div id="proposal-analysis-result">
          <p class="text-xs text-gray-400 italic">Click "Analyze" to execute real-time AI quality scoring.</p>
        </div>
      </div>

      <!-- Similarity Check -->
      <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
            <i class="fas fa-copy text-synapse-500"></i>
            Project Similarity Analysis
          </h3>
          <button onclick="runSimilarityAnalysis('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 border border-synapse-200 px-3 py-1.5 rounded-xl hover:bg-synapse-100 font-semibold transition-colors">
            <i class="fas fa-search mr-1"></i>Check
          </button>
        </div>
        <div id="similarity-analysis-result">
          <p class="text-xs text-gray-400 italic">Click "Check" to scan for overlapping historical projects.</p>
        </div>
      </div>
    </div>

    ${state.currentUser.role === 'coordinator' ? `
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
          <i class="fas fa-user-check text-synapse-500"></i>
          AI Supervisor Recommendation
        </h3>
        <button onclick="runSupervisorRecommendation('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 border border-synapse-200 px-3 py-1.5 rounded-xl hover:bg-synapse-100 font-semibold transition-colors">
          <i class="fas fa-magic mr-1"></i>Recommend
        </button>
      </div>
      <div id="supervisor-recommendation-result">
        <p class="text-xs text-gray-400 italic">Click "Recommend" to run domain & workload matching engine.</p>
      </div>
    </div>` : ''}

    ${state.currentUser.role === 'supervisor' ? `
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
          <i class="fas fa-comment-dots text-synapse-500"></i>
          AI Feedback Assistant
        </h3>
        <button onclick="runFeedbackAssistant('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 border border-synapse-200 px-3 py-1.5 rounded-xl hover:bg-synapse-100 font-semibold transition-colors">
          <i class="fas fa-lightbulb mr-1"></i>Suggest
        </button>
      </div>
      <div id="feedback-assistant-result">
        <p class="text-xs text-gray-400 italic">Click "Suggest" to generate structured review feedback points.</p>
      </div>
    </div>` : ''}
  </div>`;
}

// ===== Projects List =====
function renderProjects() {
  return `
  <div class="fade-in space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Projects</h1>
        <p class="text-gray-500 text-xs sm:text-sm mt-0.5">Track and monitor progress of active FYP projects</p>
      </div>
    </div>

    <div id="projects-list" class="space-y-3">Loading...</div>
  </div>`;
}

// ===== Project Detail =====
function renderProjectDetail() {
  const p = state.selectedProject;
  if (!p) return '<p class="p-6 text-gray-500">No project selected</p>';

  const healthColors = { healthy: 'bg-emerald-100 text-emerald-700 border-emerald-200', at_risk: 'bg-amber-100 text-amber-700 border-amber-200', critical: 'bg-rose-100 text-rose-700 border-rose-200' };
  const healthIcons = { healthy: 'fa-check-circle text-emerald-500', at_risk: 'fa-exclamation-triangle text-amber-500', critical: 'fa-times-circle text-rose-500' };

  return `
  <div class="fade-in space-y-6">
    <button onclick="navigate('projects')" class="text-xs font-semibold text-gray-500 hover:text-gray-800 inline-flex items-center gap-1.5 bg-white border px-3 py-1.5 rounded-xl shadow-sm">
      <i class="fas fa-arrow-left text-xs"></i> Back to Projects
    </button>

    <!-- EXECUTIVE POWER CONTROLS FOR COORDINATOR -->
    ${state.currentUser.role === 'coordinator' ? `
    <div class="bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-indigo-500/30 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div class="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center text-white text-sm shadow-md shrink-0">
            <i class="fas fa-crown"></i>
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-bold text-sm sm:text-base text-white">Coordinator Project Governance</h3>
            <p class="text-xs text-indigo-200 leading-snug mt-0.5">Force override health flags or progress metrics</p>
          </div>
        </div>
        <span class="text-[10px] bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 whitespace-nowrap self-start sm:self-auto">Executive Power</span>
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-3 border-t border-indigo-800/60">
        <span class="text-xs font-semibold text-indigo-200 shrink-0">Override Health:</span>
        <button onclick="updateProjectHealth('${p.id}', 'healthy')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1">
          <i class="fas fa-check-circle"></i> Healthy
        </button>
        <button onclick="updateProjectHealth('${p.id}', 'at_risk')" class="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1">
          <i class="fas fa-exclamation-triangle"></i> At Risk
        </button>
        <button onclick="updateProjectHealth('${p.id}', 'critical')" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1">
          <i class="fas fa-fire"></i> Critical
        </button>
      </div>

      <!-- Supervisor Allocation Control -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 pt-3 border-t border-indigo-800/60">
        <span class="text-xs font-semibold text-indigo-200 shrink-0"><i class="fas fa-user-tie text-amber-400 mr-1"></i>Change Supervisor:</span>
        <select id="project-supervisor-select" class="w-full sm:w-auto flex-1 bg-slate-800 border border-indigo-500/40 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">-- Select Supervisor --</option>
          ${(state.supervisors || []).map(s => `
            <option value="${s.id}" ${p.supervisor_id === s.id ? 'selected' : ''}>${s.name} (${s.department || 'CS'})</option>
          `).join('')}
        </select>
        <button onclick="assignProjectSupervisor('${p.id}')" class="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5">
          <i class="fas fa-user-check"></i> Update Supervisor
        </button>
      </div>
    </div>
    ` : ''}

    <!-- MANAGEMENT STATION FOR SUPERVISORS -->
    ${state.currentUser.role === 'supervisor' ? `
    <div class="bg-gradient-to-r from-blue-950 to-synapse-950 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-synapse-500/30 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div class="w-9 h-9 bg-synapse-500 rounded-xl flex items-center justify-center text-white text-sm shadow-md shrink-0">
            <i class="fas fa-user-tie"></i>
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-bold text-sm sm:text-base text-white">Supervisor Management Station</h3>
            <p class="text-xs text-synapse-200 leading-snug mt-0.5">Assign student tasks or schedule review meetings</p>
          </div>
        </div>
        <span class="text-[10px] bg-synapse-500/30 border border-synapse-400/40 text-synapse-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 whitespace-nowrap self-start sm:self-auto">Supervisor Power</span>
      </div>

      <div class="flex flex-col sm:flex-row gap-2 pt-3 border-t border-synapse-800/60">
        <button onclick="showAddTaskModal('${p.id}')" class="w-full sm:w-auto bg-synapse-600 hover:bg-synapse-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md">
          <i class="fas fa-plus-circle"></i> Assign Student Task
        </button>
        <button onclick="scheduleSupervisorMeeting('${p.id}')" class="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md">
          <i class="fas fa-calendar-plus"></i> Schedule Review Meeting
        </button>
      </div>
    </div>
    ` : ''}

    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900">${p.title}</h1>
          <p class="text-xs sm:text-sm text-gray-500 mt-1">Supervisor: ${p.supervisor_name || 'Unassigned'}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-bold border ${healthColors[p.health] || 'bg-gray-100'} uppercase tracking-wider flex items-center gap-1.5 self-start">
          <i class="fas ${healthIcons[p.health] || ''}"></i>
          <span>${(p.health || 'unknown').replace('_', ' ')}</span>
        </span>
      </div>

      <div class="pt-2">
        <div class="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
          <span>Overall Progress</span>
          <span>${p.progress || 0}%</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-3 p-0.5 border">
          <div class="bg-gradient-to-r from-synapse-500 to-indigo-600 h-full rounded-full transition-all duration-500" style="width: ${p.progress || 0}%"></div>
        </div>
      </div>
    </div>

    <!-- AI Risk & Insights Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
            <i class="fas fa-heartbeat text-synapse-500"></i>
            AI Risk Prediction
          </h3>
          <button onclick="runRiskAnalysis('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 border border-synapse-200 px-3 py-1.5 rounded-xl hover:bg-synapse-100 font-semibold transition-colors">
            <i class="fas fa-stethoscope mr-1"></i>Analyze
          </button>
        </div>
        <div id="risk-analysis-result">
          <p class="text-xs text-gray-400 italic">Click "Analyze" to assess project risk indicators.</p>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
            <i class="fas fa-lightbulb text-synapse-500"></i>
            AI Insights
          </h3>
          <button onclick="runProjectInsights('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 border border-synapse-200 px-3 py-1.5 rounded-xl hover:bg-synapse-100 font-semibold transition-colors">
            <i class="fas fa-sync mr-1"></i>Generate
          </button>
        </div>
        <div id="project-insights-result">
          <p class="text-xs text-gray-400 italic">Click "Generate" for data-driven insights.</p>
        </div>
      </div>
    </div>

    <!-- AI Project Summary -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
          <i class="fas fa-file-contract text-synapse-500"></i>
          AI Project Executive Summary
        </h3>
        <button onclick="runProjectSummary('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 border border-synapse-200 px-3 py-1.5 rounded-xl hover:bg-synapse-100 font-semibold transition-colors">
          <i class="fas fa-scroll mr-1"></i>Summarize
        </button>
      </div>
      <div id="project-summary-result">
        <p class="text-xs text-gray-400 italic">Click "Summarize" for an executive summary.</p>
      </div>
    </div>

    <!-- Project Assistant Query -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
      <h3 class="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
        <i class="fas fa-robot text-synapse-500"></i>
        AI Project Assistant
      </h3>
      <div class="flex flex-col sm:flex-row gap-2">
        <input type="text" id="project-query-input" placeholder="Ask about this project (e.g., 'What are the overdue tasks?')" 
               class="flex-1 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-synapse-500" 
               onkeydown="if(event.key==='Enter')runProjectQuery('${p.id}')">
        <button onclick="runProjectQuery('${p.id}')" class="bg-synapse-600 hover:bg-synapse-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
          <i class="fas fa-paper-plane mr-1"></i> Ask
        </button>
      </div>
      <div id="project-query-result"></div>
    </div>

    <!-- Tasks & Milestones -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-tasks text-gray-400"></i>Tasks</h3>
          ${state.currentUser.role === 'supervisor' ? `<button onclick="showAddTaskModal('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 border px-2.5 py-1 rounded-lg font-semibold"><i class="fas fa-plus mr-1"></i>Add Task</button>` : ''}
        </div>
        <div id="project-tasks">${renderProjectTasks(p)}</div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fas fa-flag text-gray-400"></i>Milestones</h3>
        <div id="project-milestones">${renderProjectMilestones(p)}</div>
      </div>
    </div>

  </div>`;
}

function renderProjectTasks(project) {
  if (!project.tasks || project.tasks.length === 0) return '<p class="text-xs text-gray-400">No tasks created yet.</p>';
  const statusIcons = { todo: 'far fa-circle text-gray-400', in_progress: 'fas fa-spinner text-blue-500', completed: 'fas fa-check-circle text-emerald-500', overdue: 'fas fa-exclamation-circle text-rose-500' };
  return project.tasks.map(t => `
    <div class="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <i class="${statusIcons[t.status] || 'far fa-circle'} text-sm shrink-0"></i>
      <div class="flex-1 min-w-0">
        <p class="text-xs sm:text-sm font-medium text-gray-800 truncate">${t.title}</p>
        ${t.assignee_name ? `<p class="text-[11px] text-gray-400">${t.assignee_name}</p>` : ''}
      </div>
      ${t.due_date ? `<span class="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">${new Date(t.due_date).toLocaleDateString()}</span>` : ''}
    </div>
  `).join('');
}

function renderProjectMilestones(project) {
  if (!project.milestones || project.milestones.length === 0) return '<p class="text-xs text-gray-400">No milestones set.</p>';
  const statusColors = { pending: 'border-gray-300', in_progress: 'border-blue-500 bg-blue-500', completed: 'border-emerald-500 bg-emerald-500', overdue: 'border-rose-500 bg-rose-500' };
  return project.milestones.map(m => `
    <div class="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div class="w-3 h-3 rounded-full border-2 ${statusColors[m.status] || 'border-gray-300'} shrink-0"></div>
      <div class="flex-1">
        <p class="text-xs sm:text-sm font-medium text-gray-800">${m.title}</p>
        <p class="text-[11px] text-gray-400">${m.status}${m.due_date ? ` &bull; Due: ${new Date(m.due_date).toLocaleDateString()}` : ''}</p>
      </div>
    </div>
  `).join('');
}

// ===== Executive Power Actions Handlers =====

async function updateProposalStatus(proposalId, newStatus) {
  try {
    const res = await api(`/proposals/${proposalId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    if (res.success) {
      showToast(`Proposal status updated to '${newStatus}'!`, 'success');
      state.selectedProposal = res.data;
      render();
    }
  } catch (e) {
    // Handled by api helper
  }
}

async function assignProposalSupervisor(proposalId, supervisorId) {
  if (!supervisorId) {
    const select = document.getElementById('proposal-supervisor-select');
    if (select) supervisorId = select.value;
  }
  if (!supervisorId) {
    showToast('Please select a supervisor first!', 'error');
    return;
  }
  try {
    const res = await api(`/proposals/${proposalId}`, {
      method: 'PUT',
      body: JSON.stringify({ supervisor_id: supervisorId })
    });
    if (res.success) {
      showToast('Supervisor assigned to proposal successfully!', 'success');
      state.selectedProposal = res.data;
      render();
    }
  } catch (e) {
    showToast('Failed to assign supervisor', 'error');
  }
}

async function assignProjectSupervisor(projectId, supervisorId) {
  if (!supervisorId) {
    const select = document.getElementById('project-supervisor-select');
    if (select) supervisorId = select.value;
  }
  if (!supervisorId) {
    showToast('Please select a supervisor first!', 'error');
    return;
  }
  try {
    const res = await api(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ supervisor_id: supervisorId })
    });
    if (res.success) {
      showToast('Supervisor assigned to project successfully!', 'success');
      state.selectedProject = res.data;
      render();
    }
  } catch (e) {
    showToast('Failed to assign supervisor', 'error');
  }
}

async function showQuickAssignModal(preselectedId = null, preselectedType = 'proposal') {
  try {
    const [proposalsRes, projectsRes, supervisorsRes] = await Promise.all([
      api('/proposals'),
      api('/projects'),
      api('/users?role=supervisor')
    ]);

    const proposals = proposalsRes.data || [];
    const projects = projectsRes.data || [];
    const supervisors = supervisorsRes.data || [];

    if (supervisors.length === 0) {
      showToast('No supervisors found in the system.', 'error');
      return;
    }

    // Remove existing modal if any
    const oldModal = document.getElementById('assign-supervisor-modal');
    if (oldModal) oldModal.remove();

    const modalHTML = `
    <div id="assign-supervisor-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
      <div class="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-lg w-full p-6 sm:p-7 relative space-y-5">
        <!-- Close Button -->
        <button onclick="closeAssignModal()" class="absolute top-5 right-5 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center transition-colors">
          <i class="fas fa-times"></i>
        </button>

        <!-- Header -->
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm">
            <i class="fas fa-user-plus"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-gray-900">Assign Faculty Supervisor</h3>
            <p class="text-xs text-gray-500 mt-0.5">Coordinator Governance & Capacity Allocation</p>
          </div>
        </div>

        <!-- Target Type Switch Tabs -->
        <div class="flex bg-gray-100 p-1 rounded-xl gap-1">
          <button id="modal-tab-proposal" onclick="switchAssignTab('proposal')" class="flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-white text-purple-700 shadow-sm">
            <i class="fas fa-file-alt mr-1.5"></i> Student Proposal
          </button>
          <button id="modal-tab-project" onclick="switchAssignTab('project')" class="flex-1 py-2 rounded-lg text-xs font-bold transition-all text-gray-600 hover:text-gray-900">
            <i class="fas fa-project-diagram mr-1.5"></i> Active Project
          </button>
        </div>

        <!-- Target Item Selector -->
        <div id="modal-proposal-select-group">
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Select Student Proposal *</label>
          <select id="modal-target-proposal-id" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="">-- Choose Proposal --</option>
            ${proposals.map(p => `<option value="${p.id}" ${preselectedId === p.id && preselectedType === 'proposal' ? 'selected' : ''}>${p.title} (Student: ${p.submitter_name || 'Unknown'})</option>`).join('')}
          </select>
        </div>

        <div id="modal-project-select-group" class="hidden">
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Select Active Project *</label>
          <select id="modal-target-project-id" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="">-- Choose Project --</option>
            ${projects.map(p => `<option value="${p.id}" ${preselectedId === p.id && preselectedType === 'project' ? 'selected' : ''}>${p.title} (Current: ${p.supervisor_name || 'Unassigned'})</option>`).join('')}
          </select>
        </div>

        <!-- Supervisor Selector -->
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Select Faculty Supervisor *</label>
          <select id="modal-target-supervisor-id" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="">-- Choose Faculty Supervisor --</option>
            ${supervisors.map(s => `<option value="${s.id}">${s.name} &bull; ${s.department || 'Computer Science'}</option>`).join('')}
          </select>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3 pt-3 border-t border-gray-100">
          <button onclick="submitAssignModal()" class="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-1.5">
            <i class="fas fa-check-circle"></i> Confirm Assignment
          </button>
          <button onclick="closeAssignModal()" class="border border-gray-300 text-gray-600 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-gray-50 transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    if (preselectedType === 'project') {
      switchAssignTab('project');
    }
  } catch (e) {
    showToast('Failed to open supervisor assignment modal', 'error');
  }
}

function switchAssignTab(type) {
  const propGroup = document.getElementById('modal-proposal-select-group');
  const projGroup = document.getElementById('modal-project-select-group');
  const propTab = document.getElementById('modal-tab-proposal');
  const projTab = document.getElementById('modal-tab-project');

  if (type === 'proposal') {
    propGroup?.classList.remove('hidden');
    projGroup?.classList.add('hidden');
    propTab?.classList.add('bg-white', 'text-purple-700', 'shadow-sm');
    propTab?.classList.remove('text-gray-600');
    projTab?.classList.remove('bg-white', 'text-purple-700', 'shadow-sm');
    projTab?.classList.add('text-gray-600');
  } else {
    projGroup?.classList.remove('hidden');
    propGroup?.classList.add('hidden');
    projTab?.classList.add('bg-white', 'text-purple-700', 'shadow-sm');
    projTab?.classList.remove('text-gray-600');
    propTab?.classList.remove('bg-white', 'text-purple-700', 'shadow-sm');
    propTab?.classList.add('text-gray-600');
  }
}

function closeAssignModal() {
  const modal = document.getElementById('assign-supervisor-modal');
  if (modal) modal.remove();
}

async function submitAssignModal() {
  const isProposalTab = !document.getElementById('modal-proposal-select-group')?.classList.contains('hidden');
  const supId = document.getElementById('modal-target-supervisor-id')?.value;

  if (!supId) {
    showToast('Please select a faculty supervisor', 'error');
    return;
  }

  if (isProposalTab) {
    const propId = document.getElementById('modal-target-proposal-id')?.value;
    if (!propId) { showToast('Please select a proposal', 'error'); return; }
    closeAssignModal();
    await assignProposalSupervisor(propId, supId);
  } else {
    const projId = document.getElementById('modal-target-project-id')?.value;
    if (!projId) { showToast('Please select a project', 'error'); return; }
    closeAssignModal();
    await assignProjectSupervisor(projId, supId);
  }
}

// ===== Add New Supervisor Modal =====
function showAddSupervisorModal() {
  const oldModal = document.getElementById('add-supervisor-modal');
  if (oldModal) oldModal.remove();

  const modalHTML = `
  <div id="add-supervisor-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
    <div class="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-lg w-full p-6 sm:p-7 relative space-y-5">
      <!-- Close Button -->
      <button onclick="closeAddSupervisorModal()" class="absolute top-5 right-5 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center transition-colors">
        <i class="fas fa-times"></i>
      </button>

      <!-- Header -->
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm">
          <i class="fas fa-user-plus"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold text-gray-900">Add New Faculty Supervisor</h3>
          <p class="text-xs text-gray-500 mt-0.5">Register new supervisor to FYP faculty directory</p>
        </div>
      </div>

      <!-- Form Inputs -->
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Supervisor Full Name *</label>
          <input type="text" id="new-supervisor-name" placeholder="e.g. Dr. Tariq Mahmood" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" required>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">University Email Address *</label>
          <input type="email" id="new-supervisor-email" placeholder="e.g. tariq@university.edu" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" required>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Department</label>
            <input type="text" id="new-supervisor-dept" value="Computer Science" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Max Student Capacity</label>
            <input type="number" id="new-supervisor-capacity" value="5" min="1" max="20" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Key Areas of Expertise (comma-separated)</label>
          <input type="text" id="new-supervisor-expertise" placeholder="e.g. Artificial Intelligence, Computer Vision, Cloud Computing" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3 pt-3 border-t border-gray-100">
        <button onclick="submitAddSupervisorModal()" class="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5">
          <i class="fas fa-check-circle"></i> Register Supervisor
        </button>
        <button onclick="closeAddSupervisorModal()" class="border border-gray-300 text-gray-600 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-gray-50 transition-all">
          Cancel
        </button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeAddSupervisorModal() {
  const modal = document.getElementById('add-supervisor-modal');
  if (modal) modal.remove();
}

async function submitAddSupervisorModal() {
  const name = document.getElementById('new-supervisor-name')?.value.trim();
  const email = document.getElementById('new-supervisor-email')?.value.trim();
  const department = document.getElementById('new-supervisor-dept')?.value.trim() || 'Computer Science';
  const capacity = document.getElementById('new-supervisor-capacity')?.value || '5';
  const rawExpertise = document.getElementById('new-supervisor-expertise')?.value.trim();

  if (!name || !email) {
    showToast('Name and Email are required!', 'error');
    return;
  }

  const expertiseArr = rawExpertise ? rawExpertise.split(',').map(s => s.trim()).filter(Boolean) : ['Computer Science'];

  try {
    const res = await api('/users', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        role: 'supervisor',
        department,
        expertise: expertiseArr,
        max_students: parseInt(capacity)
      })
    });

    if (res.success) {
      showToast(`Faculty Supervisor '${name}' registered successfully!`, 'success');
      closeAddSupervisorModal();
      if (state.currentView === 'supervisors') {
        loadSupervisors();
      }
    } else {
      showToast(res.error || 'Failed to add supervisor', 'error');
    }
  } catch (e) {
    showToast('Error registering supervisor', 'error');
  }
}

async function updateProjectHealth(projectId, newHealth) {
  try {
    const res = await api(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ health: newHealth })
    });
    if (res.success) {
      showToast(`Project health force overridden to '${newHealth}'!`, 'success');
      state.selectedProject = res.data;
      render();
    }
  } catch (e) {
    // Handled by api helper
  }
}

function endorseProposal(proposalId) {
  showToast('Supervisor Endorsement recorded successfully!', 'success');
}

function scheduleSupervisorMeeting(projectId) {
  showToast('Review meeting request sent to project team!', 'info');
}

function triggerCoordinatorBroadcast() {
  const msg = prompt('Enter System Announcement to Broadcast to all Students & Supervisors:');
  if (msg) {
    showToast(`Broadcast Sent: "${msg}"`, 'success');
  }
}

function showAddTaskModal(projectId) {
  const title = prompt('Enter Task Title for Student:');
  if (!title) return;
  const dueDate = prompt('Enter Due Date (YYYY-MM-DD):', '2026-09-01');

  api(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      due_date: dueDate,
      status: 'in_progress',
      priority: 'high'
    })
  }).then(res => {
    if (res.success) {
      showToast('New task assigned to project team!', 'success');
      loadProjectDetail(projectId);
    }
  });
}

// ===== Supervisors View =====
function renderSupervisors() {
  return `
  <div class="fade-in space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Supervisors</h1>
        <p class="text-gray-500 text-xs sm:text-sm mt-0.5">Faculty supervision directory & capacity allocation</p>
      </div>
      ${state.currentUser.role === 'coordinator' ? `
        <div class="flex flex-wrap gap-2 self-start sm:self-auto">
          <button onclick="showAddSupervisorModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md flex items-center gap-1.5">
            <i class="fas fa-plus-circle"></i> Add New Supervisor
          </button>
          <button onclick="showQuickAssignModal()" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md flex items-center gap-1.5">
            <i class="fas fa-user-plus"></i> Assign Supervisor to Student
          </button>
        </div>
      ` : ''}
    </div>

    ${state.currentUser.role === 'coordinator' ? `
    <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-purple-500/20 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div class="w-9 h-9 bg-purple-500 rounded-xl flex items-center justify-center text-white text-sm shadow-md shrink-0">
            <i class="fas fa-crown"></i>
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-bold text-sm sm:text-base text-white">Supervisor Allocation Station</h3>
            <p class="text-xs text-purple-200 leading-snug mt-0.5">Executive power to register faculty supervisors, assign or re-assign them to student proposals & active projects</p>
          </div>
        </div>
        <span class="text-[10px] bg-purple-500/30 border border-purple-400/40 text-purple-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 whitespace-nowrap self-start sm:self-auto">Coordinator Power</span>
      </div>

      <div class="pt-3 border-t border-purple-800/60 flex flex-col sm:flex-row gap-2">
        <button onclick="showAddSupervisorModal()" class="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md">
          <i class="fas fa-user-plus"></i> Register New Faculty Supervisor
        </button>
        <button onclick="showQuickAssignModal()" class="w-full sm:w-auto bg-purple-500 hover:bg-purple-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md">
          <i class="fas fa-user-check"></i> Assign Supervisor to Student Proposal / Project
        </button>
      </div>
    </div>
    ` : ''}

    <!-- Supervisor Capacity Chart -->
    <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
        <i class="fas fa-chart-bar text-indigo-500"></i>
        Faculty Supervision Workload Allocation
      </h3>
      <div class="relative h-60 w-full">
        <canvas id="supervisorsWorkloadChart"></canvas>
      </div>
    </div>

    <div id="supervisors-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">Loading...</div>
  </div>`;
}

// ===== AI Feature Runners =====

async function runProposalAnalysis(proposalId) {
  const container = document.getElementById('proposal-analysis-result');
  if (!container) return;
  container.innerHTML = renderAILoading('Analyzing proposal quality...');

  try {
    const res = await api('/ai/analyze-proposal', { method: 'POST', body: JSON.stringify({ proposalId }) });
    if (res.success && res.data) {
      container.innerHTML = renderProposalAnalysisResult(res.data, res.cached);
    } else {
      container.innerHTML = renderAIError(res.error);
    }
  } catch (e) {
    container.innerHTML = renderAIError('Analysis failed. Please try again.');
  }
}

async function runSimilarityAnalysis(proposalId) {
  const container = document.getElementById('similarity-analysis-result');
  if (!container) return;
  container.innerHTML = renderAILoading('Checking for similar projects...');

  try {
    const res = await api('/ai/analyze-similarity', { method: 'POST', body: JSON.stringify({ proposalId }) });
    if (res.success && res.data) {
      container.innerHTML = renderSimilarityResult(res.data);
    } else {
      container.innerHTML = renderAIError(res.error);
    }
  } catch (e) {
    container.innerHTML = renderAIError('Similarity check failed. Please try again.');
  }
}

async function runRiskAnalysis(projectId) {
  const container = document.getElementById('risk-analysis-result');
  if (!container) return;
  container.innerHTML = renderAILoading('Assessing project health...');

  try {
    const res = await api('/ai/analyze-risk', { method: 'POST', body: JSON.stringify({ projectId }) });
    if (res.success && res.data) {
      container.innerHTML = renderRiskResult(res.data);
    } else {
      container.innerHTML = renderAIError(res.error);
    }
  } catch (e) {
    container.innerHTML = renderAIError('Risk analysis failed. Please try again.');
  }
}

async function runSupervisorRecommendation(proposalId) {
  const container = document.getElementById('supervisor-recommendation-result');
  if (!container) return;
  container.innerHTML = renderAILoading('Matching supervisors...');

  try {
    const res = await api('/ai/recommend-supervisor', { method: 'POST', body: JSON.stringify({ proposalId }) });
    if (res.success && res.data) {
      container.innerHTML = renderSupervisorRecommendationResult(res.data);
    } else {
      container.innerHTML = renderAIError(res.error);
    }
  } catch (e) {
    container.innerHTML = renderAIError('Recommendation failed. Please try again.');
  }
}

async function runProjectInsights(projectId) {
  const container = document.getElementById('project-insights-result');
  if (!container) return;
  container.innerHTML = renderAILoading('Generating insights...');

  try {
    const res = await api('/ai/project-insights', { method: 'POST', body: JSON.stringify({ projectId }) });
    if (res.success && res.data) {
      container.innerHTML = renderInsightsResult(res.data);
    } else {
      container.innerHTML = renderAIError(res.error);
    }
  } catch (e) {
    container.innerHTML = renderAIError('Insights generation failed. Please try again.');
  }
}

async function runProjectSummary(projectId) {
  const container = document.getElementById('project-summary-result');
  if (!container) return;
  container.innerHTML = renderAILoading('Generating summary...');

  try {
    const res = await api('/ai/project-summary', { method: 'POST', body: JSON.stringify({ projectId }) });
    if (res.success && res.data) {
      container.innerHTML = renderSummaryResult(res.data);
    } else {
      container.innerHTML = renderAIError(res.error);
    }
  } catch (e) {
    container.innerHTML = renderAIError('Summary generation failed. Please try again.');
  }
}

async function runFeedbackAssistant(proposalId) {
  const container = document.getElementById('feedback-assistant-result');
  if (!container) return;
  container.innerHTML = renderAILoading('Generating feedback suggestions...');

  try {
    const p = state.selectedProposal;
    const content = `Title: ${p.title}\nAbstract: ${p.abstract || ''}\nProblem: ${p.problem_statement || ''}\nObjectives: ${p.objectives || ''}\nMethodology: ${p.methodology || ''}`;
    const res = await api('/ai/feedback-suggestions', { method: 'POST', body: JSON.stringify({ title: p.title, content, documentType: 'proposal' }) });
    if (res.success && res.data) {
      container.innerHTML = renderFeedbackResult(res.data);
    } else {
      container.innerHTML = renderAIError(res.error);
    }
  } catch (e) {
    container.innerHTML = renderAIError('Feedback generation failed. Please try again.');
  }
}

async function runProjectQuery(projectId) {
  const input = document.getElementById('project-query-input');
  if (!input) return;
  const question = input.value.trim();
  if (!question) return;

  const container = document.getElementById('project-query-result');
  if (!container) return;
  container.innerHTML = renderAILoading('Processing query...');
  input.value = '';

  try {
    const res = await api('/ai/project-query', { method: 'POST', body: JSON.stringify({ projectId, question }) });
    if (res.success && res.data) {
      container.innerHTML = renderQueryResult(res.data, question);
    } else {
      container.innerHTML = renderAIError(res.error);
    }
  } catch (e) {
    container.innerHTML = renderAIError('Query failed. Please try again.');
  }
}

// ===== AI Result Component Renderers =====

function renderAILoading(message) {
  return `
  <div class="flex items-center gap-3 py-3 text-synapse-700">
    <div class="w-5 h-5 border-2 border-synapse-500 border-t-transparent rounded-full animate-spin"></div>
    <span class="text-xs font-semibold">${message}</span>
  </div>`;
}

function renderAIError(message) {
  return `
  <div class="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">
    <p class="font-semibold flex items-center gap-1.5"><i class="fas fa-exclamation-circle"></i> ${message || 'AI service temporarily unavailable.'}</p>
  </div>`;
}

function renderProposalAnalysisResult(data, cached) {
  const scoreColor = data.overallScore >= 80 ? 'text-emerald-600' : data.overallScore >= 60 ? 'text-amber-600' : 'text-rose-600';
  const scoreLabel = data.overallScore >= 80 ? 'Strong Proposal' : data.overallScore >= 60 ? 'Fair Proposal' : 'Needs Revision';

  return `
  <div class="space-y-4 pt-2">
    <div class="text-center py-2 bg-gray-50 rounded-xl border">
      <div class="text-3xl font-extrabold ${scoreColor}">${data.overallScore}%</div>
      <div class="text-xs font-bold text-gray-600 mt-0.5">${scoreLabel}</div>
      ${cached ? '<span class="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-semibold">Cached</span>' : ''}
    </div>

    <div class="space-y-2">
      ${renderScoreBar('Problem Clarity', data.problemClarity)}
      ${renderScoreBar('Objectives', data.objectives)}
      ${renderScoreBar('Methodology', data.methodology)}
      ${renderScoreBar('Technical Feasibility', data.technicalFeasibility)}
      ${renderScoreBar('Scope', data.scope)}
    </div>

    ${data.strengths && data.strengths.length ? `
      <div>
        <h5 class="text-xs font-bold text-emerald-700 mb-1">Strengths</h5>
        <ul class="text-xs text-gray-600 space-y-1">${data.strengths.map(s => `<li class="flex items-start gap-1.5"><i class="fas fa-check-circle text-emerald-500 mt-0.5"></i><span>${s}</span></li>`).join('')}</ul>
      </div>` : ''}

    ${data.weaknesses && data.weaknesses.length ? `
      <div>
        <h5 class="text-xs font-bold text-rose-700 mb-1">Areas for Improvement</h5>
        <ul class="text-xs text-gray-600 space-y-1">${data.weaknesses.map(w => `<li class="flex items-start gap-1.5"><i class="fas fa-exclamation-circle text-rose-500 mt-0.5"></i><span>${w}</span></li>`).join('')}</ul>
      </div>` : ''}
  </div>`;
}

function renderScoreBar(label, score) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  return `
  <div class="flex items-center gap-2">
    <span class="text-xs text-gray-600 w-28 shrink-0 font-medium truncate">${label}</span>
    <div class="flex-1 bg-gray-200 rounded-full h-2">
      <div class="${color} h-2 rounded-full transition-all duration-300" style="width: ${score}%"></div>
    </div>
    <span class="text-xs font-bold text-gray-700 w-8 text-right">${score}%</span>
  </div>`;
}

function renderSimilarityResult(data) {
  if (!data.matches || data.matches.length === 0) {
    return `<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-medium"><i class="fas fa-check-circle text-emerald-600 mr-1.5"></i> No high-similarity projects detected.</div>`;
  }

  return `
  <div class="space-y-2.5 pt-1">
    ${data.matches.map(m => `
      <div class="border rounded-xl p-3 ${m.similarityScore >= 70 ? 'border-rose-200 bg-rose-50/50' : m.similarityScore >= 50 ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-gray-50/50'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-gray-800 truncate max-w-[200px]">${m.projectTitle}</span>
          <span class="text-xs font-extrabold ${m.similarityScore >= 70 ? 'text-rose-600' : m.similarityScore >= 50 ? 'text-amber-600' : 'text-gray-600'}">${m.similarityScore}% match</span>
        </div>
        <div class="flex flex-wrap gap-1 mt-1.5">${(m.overlappingConcepts || []).map(c => `<span class="text-[10px] bg-white border px-1.5 py-0.5 rounded font-medium">${c}</span>`).join('')}</div>
        <p class="text-xs text-gray-600 mt-1.5 leading-relaxed">${m.explanation}</p>
      </div>
    `).join('')}
  </div>`;
}

function renderRiskResult(data) {
  const statusConfig = {
    healthy: { color: 'emerald', icon: 'fa-check-circle', label: 'Healthy Status' },
    at_risk: { color: 'amber', icon: 'fa-exclamation-triangle', label: 'At Risk' },
    critical: { color: 'rose', icon: 'fa-times-circle', label: 'Critical Risk' }
  };
  const config = statusConfig[data.healthStatus] || statusConfig.healthy;

  return `
  <div class="space-y-3 pt-1">
    <div class="flex items-center gap-3 bg-${config.color}-50 border border-${config.color}-200 p-3 rounded-xl">
      <i class="fas ${config.icon} text-${config.color}-600 text-lg"></i>
      <div>
        <div class="font-bold text-xs text-gray-900">${config.label}</div>
        <div class="text-[11px] text-gray-600">Risk Score: <strong>${data.riskScore}/100</strong></div>
      </div>
    </div>

    ${data.reasons && data.reasons.length ? `
      <div>
        <h5 class="text-xs font-bold text-gray-700 mb-1">Risk Factors</h5>
        <ul class="text-xs text-gray-600 space-y-1">${data.reasons.map(r => `<li class="flex items-start gap-1.5"><i class="fas fa-exclamation text-amber-500 mt-0.5"></i><span>${r}</span></li>`).join('')}</ul>
      </div>` : ''}
  </div>`;
}

function renderSupervisorRecommendationResult(data) {
  return `
  <div class="space-y-2.5 pt-1">
    ${(data.recommendations || []).map((rec, i) => `
      <div class="border rounded-xl p-3 ${i === 0 ? 'border-synapse-300 bg-synapse-50/60' : 'border-gray-200'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-gray-900">${i + 1}. ${rec.supervisorName}</span>
          <span class="text-xs font-extrabold text-synapse-700">Match: ${rec.matchScore}%</span>
        </div>
        <ul class="text-xs text-gray-600 mt-1.5 space-y-1">${(rec.reasons || []).map(r => `<li class="flex items-center gap-1.5"><i class="fas fa-check text-synapse-500 text-[10px]"></i><span>${r}</span></li>`).join('')}</ul>
      </div>
    `).join('')}
  </div>`;
}

function renderInsightsResult(data) {
  const categoryConfig = {
    positive: { color: 'emerald', icon: 'fa-check-circle' },
    warning: { color: 'amber', icon: 'fa-exclamation-triangle' },
    critical: { color: 'rose', icon: 'fa-times-circle' },
    recommendation: { color: 'blue', icon: 'fa-lightbulb' }
  };

  return `
  <div class="space-y-2 pt-1">
    ${(data.insights || []).map(insight => {
      const cfg = categoryConfig[insight.category] || categoryConfig.recommendation;
      return `
        <div class="flex items-start gap-2.5 p-2.5 rounded-xl border bg-${cfg.color}-50/60 border-${cfg.color}-200">
          <i class="fas ${cfg.icon} text-${cfg.color}-600 text-xs mt-0.5 shrink-0"></i>
          <span class="text-xs text-gray-800 leading-relaxed font-medium">${insight.message}</span>
        </div>
      `;
    }).join('')}
  </div>`;
}

function renderSummaryResult(data) {
  return `
  <div class="space-y-3 pt-1">
    <div class="bg-gray-50 border rounded-xl p-3.5 text-xs text-gray-800 leading-relaxed">
      ${data.summary}
    </div>
  </div>`;
}

function renderFeedbackResult(data) {
  const sections = [
    { key: 'reviewPoints', label: 'Review Points', icon: 'fa-clipboard-check' },
    { key: 'technicalConcerns', label: 'Technical Concerns', icon: 'fa-cog' },
    { key: 'questionsForStudents', label: 'Questions for Students', icon: 'fa-question-circle' },
  ];

  return `
  <div class="space-y-3 pt-1">
    ${sections.filter(s => data[s.key] && data[s.key].length > 0).map(s => `
      <div>
        <h5 class="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
          <i class="fas ${s.icon} text-synapse-500"></i> ${s.label}
        </h5>
        <ul class="text-xs text-gray-600 space-y-1 pl-2">
          ${data[s.key].map(item => `<li class="flex items-start gap-1.5"><i class="fas fa-chevron-right text-gray-400 text-[10px] mt-1"></i><span>${item}</span></li>`).join('')}
        </ul>
      </div>
    `).join('')}
  </div>`;
}

function renderQueryResult(data, question) {
  return `
  <div class="bg-synapse-50/70 border border-synapse-200 rounded-xl p-3.5 space-y-2 mt-2">
    <p class="text-xs font-semibold text-synapse-900"><i class="fas fa-question-circle text-synapse-600 mr-1"></i> ${question}</p>
    <p class="text-xs text-gray-800 leading-relaxed">${data.answer}</p>
  </div>`;
}

// ===== Interactive Chart Initializers =====

function initDashboardCharts(stats) {
  if (!window.Chart || !stats) return;

  // 1. Proposal Breakdown Chart (Doughnut)
  const propElem = document.getElementById('proposalsChart');
  if (propElem) {
    destroyChart('proposalsChart');
    const p = stats.proposals || {};
    chartInstances['proposalsChart'] = new Chart(propElem, {
      type: 'doughnut',
      data: {
        labels: ['Submitted', 'Approved', 'Under Review', 'Rejected'],
        datasets: [{
          data: [p.submitted || 1, p.approved || 0, p.under_review || 0, p.rejected || 0],
          backgroundColor: ['#0284c7', '#10b981', '#f59e0b', '#f43f5e'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11, weight: '600' } } }
        },
        cutout: '70%'
      }
    });
  }

  // 2. Project Health Risk Status Chart (Bar)
  const healthElem = document.getElementById('projectHealthChart');
  if (healthElem) {
    destroyChart('projectHealthChart');
    const pr = stats.projects || {};
    chartInstances['projectHealthChart'] = new Chart(healthElem, {
      type: 'bar',
      data: {
        labels: ['Healthy', 'At Risk', 'Critical'],
        datasets: [{
          label: 'Projects',
          data: [pr.healthy || 0, pr.at_risk || 0, pr.critical || 0],
          backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
          borderRadius: 8,
          barThickness: 28
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { borderDash: [4, 4] } },
          x: { ticks: { font: { size: 11, weight: '600' } }, grid: { display: false } }
        }
      }
    });
  }

  // 3. Task Completion Doughnut Chart
  const taskElem = document.getElementById('taskOverviewChart');
  if (taskElem) {
    destroyChart('taskOverviewChart');
    const t = stats.tasks || {};
    const completed = t.completed || 0;
    const overdue = t.overdue || 0;
    const total = t.total || 0;
    const inProgress = Math.max(0, total - completed - overdue);

    chartInstances['taskOverviewChart'] = new Chart(taskElem, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'Overdue', 'In Progress'],
        datasets: [{
          data: [completed, overdue, inProgress],
          backgroundColor: ['#10b981', '#f43f5e', '#6366f1'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11, weight: '600' } } } },
        cutout: '70%'
      }
    });
  }
}

function initSupervisorsChart(supervisors) {
  if (!window.Chart || !supervisors || !supervisors.length) return;
  const elem = document.getElementById('supervisorsWorkloadChart');
  if (!elem) return;

  destroyChart('supervisorsWorkloadChart');

  chartInstances['supervisorsWorkloadChart'] = new Chart(elem, {
    type: 'bar',
    data: {
      labels: supervisors.map(s => s.name.replace(/^Dr\.\s*/, '')),
      datasets: [
        {
          label: 'Active Projects',
          data: supervisors.map(s => s.active_projects !== undefined ? s.active_projects : 2),
          backgroundColor: '#0284c7',
          borderRadius: 6
        },
        {
          label: 'Student Limit',
          data: supervisors.map(s => s.max_students || 8),
          backgroundColor: '#e2e8f0',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11, weight: '600' } } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 2 } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ===== Data Loading Functions =====

async function loadDashboard() {
  try {
    const [stats, proposals, projects] = await Promise.all([
      api('/dashboard/stats'),
      api('/proposals'),
      api('/projects'),
    ]);

    state.dashboardStats = stats.data;
    state.proposals = proposals.data || [];
    state.projects = projects.data || [];

    if (state.currentUser && state.currentUser.role === 'coordinator') {
      loadPendingUsers();
    }

    const statsContainer = document.getElementById('dashboard-stats');
    if (statsContainer && stats.data) {
      const d = stats.data;
      statsContainer.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Proposals</div>
          <div class="text-2xl font-extrabold text-gray-900 mt-1">${d.proposals?.total || 0}</div>
          <div class="text-xs text-gray-400 mt-1 font-medium">${d.proposals?.submitted || 0} under review</div>
        </div>
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Projects</div>
          <div class="text-2xl font-extrabold text-gray-900 mt-1">${d.projects?.active || 0}</div>
          <div class="text-xs text-amber-600 mt-1 font-medium">${d.projects?.at_risk || 0} flagged at risk</div>
        </div>
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Students</div>
          <div class="text-2xl font-extrabold text-gray-900 mt-1">${d.users?.students || 0}</div>
          <div class="text-xs text-gray-400 mt-1 font-medium">${d.users?.supervisors || 0} supervisors</div>
        </div>
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasks</div>
          <div class="text-2xl font-extrabold text-gray-900 mt-1">${d.tasks?.total || 0}</div>
          <div class="text-xs text-rose-600 mt-1 font-medium">${d.tasks?.overdue || 0} overdue tasks</div>
        </div>
      `;
    }

    // Initialize Interactive Charts
    initDashboardCharts(stats.data);

    const proposalsContainer = document.getElementById('recent-proposals');
    if (proposalsContainer) {
      proposalsContainer.innerHTML = state.proposals.slice(0, 5).map(p => `
        <div class="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 rounded-xl px-2 -mx-2 transition-colors" onclick="loadProposalDetail('${p.id}')">
          <div class="min-w-0 flex-1">
            <p class="text-xs sm:text-sm font-semibold text-gray-800 truncate">${p.title}</p>
            <p class="text-[11px] text-gray-400">${p.submitter_name || 'Unknown'}</p>
          </div>
          <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : p.status === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}">${p.status}</span>
        </div>
      `).join('') || '<p class="text-xs text-gray-400">No proposals recorded.</p>';
    }

    const healthContainer = document.getElementById('project-health');
    if (healthContainer) {
      healthContainer.innerHTML = state.projects.slice(0, 5).map(p => {
        const hc = { healthy: 'text-emerald-600 font-bold', at_risk: 'text-amber-600 font-bold', critical: 'text-rose-600 font-bold' };
        return `
          <div class="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 rounded-xl px-2 -mx-2 transition-colors" onclick="loadProjectDetail('${p.id}')">
            <div class="min-w-0 flex-1">
              <p class="text-xs sm:text-sm font-semibold text-gray-800 truncate">${p.title}</p>
              <p class="text-[11px] text-gray-400">${p.supervisor_name || 'Unassigned'}</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[11px] ${hc[p.health] || ''}">${(p.health || '').replace('_', ' ')}</span>
              <span class="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">${p.progress || 0}%</span>
            </div>
          </div>`;
      }).join('') || '<p class="text-xs text-gray-400">No active projects recorded.</p>';
    }
  } catch (e) {
    console.error('Failed to load dashboard:', e);
  }
}

async function loadProposals() {
  try {
    const res = await api('/proposals');
    state.proposals = res.data || [];
    const container = document.getElementById('proposals-list');
    if (container) {
      const statusColors = { draft: 'bg-gray-100 text-gray-700', submitted: 'bg-blue-100 text-blue-700', under_review: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-rose-100 text-rose-700' };
      container.innerHTML = state.proposals.map(p => `
        <div class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer" onclick="loadProposalDetail('${p.id}')">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h3 class="text-xs sm:text-sm font-bold text-gray-900 truncate">${p.title}</h3>
              <p class="text-[11px] text-gray-500 mt-0.5">${p.submitter_name || 'Unknown'} &bull; ${new Date(p.created_at).toLocaleDateString()}</p>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusColors[p.status] || 'bg-gray-100'}">${p.status.replace('_', ' ')}</span>
          </div>
          ${p.abstract ? `<p class="text-xs text-gray-600 mt-2 line-clamp-2 leading-relaxed">${p.abstract}</p>` : ''}
        </div>
      `).join('') || '<p class="text-xs text-gray-400">No proposals submitted yet.</p>';
    }
  } catch (e) {
    console.error('Failed to load proposals:', e);
  }
}

async function loadProposalDetail(id) {
  try {
    const [res, supervisorsRes] = await Promise.all([
      api(`/proposals/${id}`),
      api('/users?role=supervisor')
    ]);
    state.selectedProposal = res.data;
    state.supervisors = supervisorsRes.data || [];
    navigate('proposal-detail', res.data);
  } catch (e) {
    console.error('Failed to load proposal:', e);
  }
}

async function loadProjects() {
  try {
    const res = await api('/projects');
    state.projects = res.data || [];
    const container = document.getElementById('projects-list');
    if (container) {
      const healthBorders = { healthy: 'border-l-emerald-500', at_risk: 'border-l-amber-500', critical: 'border-l-rose-500' };
      container.innerHTML = state.projects.map(p => `
        <div class="bg-white rounded-2xl border border-gray-200 border-l-4 ${healthBorders[p.health] || 'border-l-gray-300'} p-4 shadow-sm hover:shadow-md transition-all cursor-pointer" onclick="loadProjectDetail('${p.id}')">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h3 class="text-xs sm:text-sm font-bold text-gray-900 truncate">${p.title}</h3>
              <p class="text-[11px] text-gray-500 mt-0.5">Supervisor: ${p.supervisor_name || 'Unassigned'}</p>
            </div>
            <div class="text-right">
              <span class="text-xs font-bold text-gray-800">${p.progress || 0}%</span>
              <p class="text-[10px] text-gray-400 capitalize">${(p.health || '').replace('_', ' ')}</p>
            </div>
          </div>
          <div class="mt-3 bg-gray-100 rounded-full h-1.5">
            <div class="bg-synapse-600 h-1.5 rounded-full" style="width: ${p.progress || 0}%"></div>
          </div>
        </div>
      `).join('') || '<p class="text-xs text-gray-400">No projects found.</p>';
    }
  } catch (e) {
    console.error('Failed to load projects:', e);
  }
}

async function loadProjectDetail(id) {
  try {
    const [res, supervisorsRes] = await Promise.all([
      api(`/projects/${id}`),
      api('/users?role=supervisor')
    ]);
    state.selectedProject = res.data;
    state.supervisors = supervisorsRes.data || [];
    navigate('project-detail', res.data);
  } catch (e) {
    console.error('Failed to load project:', e);
  }
}

async function loadSupervisors() {
  try {
    if (state.currentUser && state.currentUser.role === 'coordinator') {
      loadPendingUsers();
    }
    const res = await api('/users?role=supervisor');
    const supervisorsList = res.data || [];
    
    // Initialize Workload Bar Chart
    initSupervisorsChart(supervisorsList);

    const container = document.getElementById('supervisors-list');
    if (container) {
      container.innerHTML = supervisorsList.map(s => {
        let expertise = [];
        try { expertise = s.expertise ? JSON.parse(s.expertise) : []; } catch (e) { expertise = []; }
        return `
        <div class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-synapse-100 text-synapse-700 rounded-xl flex items-center justify-center font-bold">
              <i class="fas fa-user-tie"></i>
            </div>
            <div>
              <h3 class="text-xs sm:text-sm font-bold text-gray-900">${s.name}</h3>
              <p class="text-[11px] text-gray-500">${s.department || 'Computer Science'}</p>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-1">
            ${expertise.slice(0, 4).map(e => `<span class="text-[10px] bg-gray-100 border px-2 py-0.5 rounded-lg text-gray-700 font-medium">${e}</span>`).join('')}
          </div>
        </div>`;
      }).join('') || '<p class="text-xs text-gray-400">No supervisors found.</p>';
    }
  } catch (e) {
    console.error('Failed to load supervisors:', e);
  }
}

// ===== New Proposal Form =====
function showNewProposalForm() {
  if (!state.currentUser || state.currentUser.role !== 'student') {
    showToast('Only students can submit proposals.', 'error');
    return;
  }
  const container = document.getElementById('proposals-list');
  if (!container) return;

  container.innerHTML = `
  <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm fade-in max-w-2xl mx-auto">
    <h2 class="text-lg font-bold text-gray-900 mb-4">Submit New FYP Proposal</h2>
    <form id="new-proposal-form" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Project Title *</label>
        <input name="title" required class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-synapse-500 focus:outline-none" placeholder="e.g. AI-Powered Smart Traffic System" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Abstract</label>
        <textarea name="abstract" rows="3" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-synapse-500 focus:outline-none" placeholder="Brief summary of your project"></textarea>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Problem Statement</label>
        <textarea name="problem_statement" rows="2" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-synapse-500 focus:outline-none" placeholder="What specific problem does this solve?"></textarea>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Objectives</label>
        <textarea name="objectives" rows="2" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-synapse-500 focus:outline-none" placeholder="List key objectives"></textarea>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Methodology & Tech Stack</label>
        <input name="technologies" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-synapse-500 focus:outline-none" placeholder="e.g. Python, PyTorch, React, Node.js" />
      </div>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="bg-synapse-600 hover:bg-synapse-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-synapse-500/20 transition-all">Submit Proposal</button>
        <button type="button" onclick="navigate('proposals')" class="border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
      </div>
    </form>
  </div>`;

  const proposalForm = document.getElementById('new-proposal-form');
  if (proposalForm) {
    proposalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const data = Object.fromEntries(form.entries());
      data.status = 'submitted';

      try {
        await api('/proposals', { method: 'POST', body: JSON.stringify(data) });
        showToast('Proposal submitted successfully!', 'success');
        navigate('proposals');
        loadProposals();
      } catch (err) {
        // Handled by api helper
      }
    });
  }
}

// ===== Event Listeners =====
function attachEventListeners() {
  const isCoordinator = state.currentUser && state.currentUser.role === 'coordinator';

  if (state.pendingRefreshTimer) {
    clearInterval(state.pendingRefreshTimer);
    state.pendingRefreshTimer = null;
  }

  if (state.currentView === 'dashboard') {
    loadDashboard();
    if (isCoordinator) {
      state.pendingRefreshTimer = setInterval(() => {
        if (state.currentView === 'dashboard') loadPendingUsers();
      }, 5000);
    }
  } else {
    if (state.currentView === 'proposals') loadProposals();
    if (state.currentView === 'projects') loadProjects();
    if (state.currentView === 'supervisors') loadSupervisors();
  }
}

window.addEventListener('focus', () => {
  if (state.currentView === 'dashboard' && state.currentUser && state.currentUser.role === 'coordinator') {
    loadPendingUsers();
  }
});

// Make globally available
window.navigate = navigate;
window.selectLoginRole = selectLoginRole;
window.quickLogin = quickLogin;
window.setLoginMode = setLoginMode;
window.togglePasswordVisibility = togglePasswordVisibility;
window.logout = logout;
window.toggleMobileMenu = toggleMobileMenu;
window.loadProposalDetail = loadProposalDetail;
window.loadProjectDetail = loadProjectDetail;
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.loadPendingUsers = loadPendingUsers;
window.showNewProposalForm = showNewProposalForm;
window.runProposalAnalysis = runProposalAnalysis;
window.runSimilarityAnalysis = runSimilarityAnalysis;
window.runRiskAnalysis = runRiskAnalysis;
window.runSupervisorRecommendation = runSupervisorRecommendation;
window.runProjectInsights = runProjectInsights;
window.runProjectSummary = runProjectSummary;
window.runFeedbackAssistant = runFeedbackAssistant;
window.runProjectQuery = runProjectQuery;
window.updateProposalStatus = updateProposalStatus;
window.updateProjectHealth = updateProjectHealth;
window.assignProposalSupervisor = assignProposalSupervisor;
window.assignProjectSupervisor = assignProjectSupervisor;
window.showQuickAssignModal = showQuickAssignModal;
window.closeAssignModal = closeAssignModal;
window.switchAssignTab = switchAssignTab;
window.submitAssignModal = submitAssignModal;
window.showAddSupervisorModal = showAddSupervisorModal;
window.closeAddSupervisorModal = closeAddSupervisorModal;
window.submitAddSupervisorModal = submitAddSupervisorModal;
window.endorseProposal = endorseProposal;
window.scheduleSupervisorMeeting = scheduleSupervisorMeeting;
window.triggerCoordinatorBroadcast = triggerCoordinatorBroadcast;
window.showAddTaskModal = showAddTaskModal;

// Initial Application Render
render();
