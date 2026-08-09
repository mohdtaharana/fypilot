// FYPilot — AI Intelligence Layer for FYP Management
// Frontend Application with Responsive Design, Authentication, Interactive Charts & Executive Role Powers

const API_BASE = '/api';

// ===== State Management =====
const storedUserJson = localStorage.getItem('fypilot_user');
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
  navMoreOpen: false,
  proposals: [],
  projects: [],
  users: [],
  dashboardStats: null,
  pendingUsers: [],
  pendingRefreshTimer: null,
  selectedProposal: null,
  selectedProject: null,
  groups: [],
  selectedGroup: null,
  myGroup: null,
  students: [],
  people: null,
  peopleView: 'grid',
  peopleTab: 'all',
  peopleSearch: '',
  aiLoading: {},
  aiResults: {},
  // Chat state
  chats: [],
  activeChat: null,
  chatMessages: [],
  chatReplyingTo: null,
  chatEditing: null,
  chatPendingMedia: null,
  chatNewUsers: [],
  chatNewSearch: '',
  chatListSearch: '',
  chatRecording: false,
  chatVoicePlaying: null,
  chatAtBottom: true,
  chatListTimer: null,
  chatMsgTimer: null,
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
    desc: 'Project oversight, proposal approvals & health overrides'
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
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(res.ok ? 'Invalid response from server' : (text || `Server error (${res.status})`));
    }
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
  state.navMoreOpen = false;
  if (data) {
    if (view === 'proposal-detail') state.selectedProposal = data;
    if (view === 'project-detail') state.selectedProject = data;
  }
  if (view !== 'chats') stopChatPolling();
  render();
}

function toggleMobileMenu() {
  state.mobileMenuOpen = !state.mobileMenuOpen;
  state.navMoreOpen = false;
  render();
}

function toggleNavMore() {
  state.navMoreOpen = !state.navMoreOpen;
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
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-fypilot-900 to-indigo-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
    <!-- Ambient Blur Background Elements -->
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-fypilot-500/20 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

    <div class="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8 fade-in relative z-10">
      
      <!-- Brand Header -->
      <div class="text-center mb-6">
        <div class="w-14 h-14 bg-gradient-to-tr from-fypilot-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-fypilot-500/30 mb-3">
          <i class="fas fa-brain text-white text-2xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Welcome to FYPilot</h1>
        <p class="text-xs text-gray-500 mt-1 font-medium">AI Intelligence Layer for FYP Management</p>
      </div>

      <!-- Login / Register Tab Toggle -->
      <div class="flex bg-gray-100 p-1 rounded-xl gap-1 mb-6">
        <button onclick="setLoginMode('login')" class="flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!isRegisterMode ? 'bg-white text-fypilot-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}">
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

      <p class="text-center text-xs text-gray-500 mt-4">Already have an account? <button onclick="setLoginMode('login')" class="text-fypilot-600 font-semibold hover:underline">Sign In</button></p>
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
                   class="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-fypilot-500 focus:bg-white transition-all" 
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
                   class="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-fypilot-500 focus:bg-white transition-all" 
                   placeholder="Enter your account password" />
            <button type="button" onclick="togglePasswordVisibility()" class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
              <i class="fas fa-eye text-sm" id="toggle-pwd-icon"></i>
            </button>
          </div>
        </div>

        <button type="submit" id="btn-login" 
                class="w-full py-3 px-4 bg-gradient-to-r from-fypilot-600 to-indigo-600 hover:from-fypilot-700 hover:to-indigo-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-fypilot-500/25 transition-all duration-200 flex items-center justify-center gap-2">
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
          <button onclick="quickLogin('supervisor')" class="flex flex-col items-center gap-1 p-2 rounded-xl bg-fypilot-50 hover:bg-fypilot-100 border border-fypilot-100 transition-all">
            <i class="fas fa-user-tie text-fypilot-500"></i>
            <span class="font-semibold text-fypilot-700 text-[11px]">Supervisor</span>
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
        localStorage.setItem('fypilot_user', JSON.stringify(res.data.user));
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
  localStorage.removeItem('fypilot_user');
  showToast('Logged out successfully', 'info');
  render();
}

// ===== Navbar Component =====
function renderNav() {
  const role = state.currentUser ? state.currentUser.role : 'guest';
  const links = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
    { id: 'proposals', label: 'Proposals', icon: 'fa-file-alt' },
    { id: 'projects', label: 'Projects', icon: 'fa-project-diagram' },
    { id: 'supervisors', label: 'Supervisors', icon: 'fa-user-tie' },
    { id: 'chats', label: 'Chats', icon: 'fa-comments' },
    ...(role === 'coordinator' ? [{ id: 'people', label: 'People', icon: 'fa-user-friends' }] : []),
    ...(role === 'student' || role === 'coordinator' || role === 'supervisor' ? [{ id: 'groups', label: role === 'student' ? 'My Group' : 'Groups', icon: 'fa-users' }] : []),
    { id: 'profile', label: 'Profile', icon: 'fa-id-badge' },
  ];

  const roleBadges = {
    coordinator: 'bg-purple-100 text-purple-700 border-purple-200',
    supervisor: 'bg-blue-100 text-blue-700 border-blue-200',
    student: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  const currentRole = state.currentUser ? state.currentUser.role : 'guest';

  const primary = links.filter(l => ['dashboard', 'proposals', 'projects', 'chats'].includes(l.id));
  const more = links.filter(l => !primary.includes(l));

  return `
  <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="flex items-center justify-between h-16">
        
        <!-- Brand Logo & Title -->
        <div class="flex items-center gap-2 cursor-pointer shrink-0" onclick="navigate('dashboard')">
          <div class="w-9 h-9 bg-gradient-to-tr from-fypilot-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-fypilot-500/20">
            <i class="fas fa-brain text-white text-base"></i>
          </div>
          <span class="text-xl font-bold text-gray-900 tracking-tight">FYPilot</span>
          <span class="text-[10px] bg-fypilot-100 text-fypilot-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">AI</span>
        </div>

        <!-- Desktop Navigation Links (primary + More dropdown, no overflow) -->
        <div class="hidden md:flex items-center gap-1 flex-1 justify-center min-w-0 px-2">
          ${primary.map(l => `
            <button onclick="navigate('${l.id}')" 
                    title="${l.label}"
                    class="px-2.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-2 whitespace-nowrap shrink-0 ${state.currentView === l.id || state.currentView.startsWith(l.id) ? 'bg-fypilot-50 text-fypilot-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}">
              <i class="fas ${l.icon} text-sm"></i>
              <span class="hidden lg:inline">${l.label}</span>
              ${l.id === 'chats' ? `<span id="nav-chat-badge" class="ml-1 hidden bg-fypilot-600 text-white text-[10px] font-bold min-w-4 h-4 px-1.5 rounded-full items-center justify-center"></span>` : ''}
            </button>
          `).join('')}

          ${more.length ? `
          <div class="relative shrink-0">
            <button onclick="toggleNavMore()" 
                    title="More"
                    class="px-2.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-2 whitespace-nowrap ${more.some(l => state.currentView === l.id || state.currentView.startsWith(l.id)) ? 'bg-fypilot-50 text-fypilot-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}">
              <i class="fas fa-ellipsis text-sm"></i>
              <span class="hidden lg:inline">More</span>
              <i class="fas fa-chevron-down text-[10px] ${state.navMoreOpen ? 'rotate-180' : ''} transition-transform"></i>
            </button>

            ${state.navMoreOpen ? `
            <div class="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/60 py-2 fade-in z-50">
              ${more.map(l => `
                <button onclick="navigate('${l.id}')" 
                        class="w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center gap-3 transition-colors ${state.currentView === l.id || state.currentView.startsWith(l.id) ? 'bg-fypilot-50 text-fypilot-700' : 'text-gray-700 hover:bg-gray-50'}">
                  <i class="fas ${l.icon} w-5 text-center ${state.currentView === l.id || state.currentView.startsWith(l.id) ? 'text-fypilot-600' : 'text-fypilot-500'}"></i>
                  <span>${l.label}</span>
                </button>
              `).join('')}
            </div>` : ''}
          </div>` : ''}
        </div>

        <!-- User Controls (Desktop) -->
        <div class="hidden md:flex items-center gap-3 shrink-0">
          <span class="hidden xl:flex px-2.5 py-1 rounded-full text-xs font-semibold border ${roleBadges[currentRole] || 'bg-gray-100'} capitalize items-center gap-1">
            <i class="fas ${currentRole === 'coordinator' ? 'fa-crown text-purple-600' : currentRole === 'supervisor' ? 'fa-user-tie text-blue-600' : 'fa-user-graduate text-emerald-600'} text-xs"></i>
            ${currentRole}
          </span>
          
          <div class="flex items-center gap-2 bg-gray-50 border rounded-xl px-3 py-1.5">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold overflow-hidden ${state.currentUser.avatar ? '' : 'bg-fypilot-600'}">
              ${state.currentUser.avatar ? `<img src="${state.currentUser.avatar}" alt="" class="w-full h-full object-cover" />` : (state.currentUser.name || 'U').charAt(0)}
            </div>
            <span class="hidden lg:block text-xs font-semibold text-gray-800 truncate max-w-[120px]">${state.currentUser.name || 'User'}</span>
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
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold overflow-hidden ${state.currentUser.avatar ? '' : 'bg-fypilot-600'}">
            ${state.currentUser.avatar ? `<img src="${state.currentUser.avatar}" alt="" class="w-full h-full object-cover" />` : (state.currentUser.name || 'U').charAt(0)}
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
                  class="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${state.currentView === l.id || state.currentView.startsWith(l.id) ? 'bg-fypilot-50 text-fypilot-700' : 'text-gray-700 hover:bg-gray-50'}">
            <i class="fas ${l.icon} w-5 text-center text-fypilot-500"></i>
            <span>${l.label}</span>
            ${l.id === 'chats' ? `<span id="nav-chat-badge-m" class="ml-auto hidden bg-fypilot-600 text-white text-[10px] font-bold min-w-4 h-4 px-1.5 rounded-full items-center justify-center"></span>` : ''}
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
    case 'chats': return renderChats();
    case 'people': return renderPeople();
    case 'groups': return renderGroups();
    case 'group-profile': return renderGroupProfile();
    case 'profile': return renderProfile();
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
          <button onclick="navigate('people')" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5">
            <i class="fas fa-user-friends"></i> Students &amp; Groups
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
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-chart-pie text-purple-500"></i> Proposal Status</h3>
        <div class="h-52"><canvas id="proposalsChart"></canvas></div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-chart-bar text-emerald-500"></i> Project Health</h3>
        <div class="h-52"><canvas id="projectHealthChart"></canvas></div>
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
        <button onclick="navigate('people')" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-user-friends"></i> Manage Students &amp; Groups</button>
        <button onclick="navigate('proposals')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-check-circle"></i> Review Proposals</button>
        <button onclick="navigate('projects')" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-exclamation-triangle"></i> At-Risk Projects</button>
        <button onclick="navigate('supervisors')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-users"></i> Supervisor Workloads</button>
      </div>
    </div>
  </div>`;
}

// ===== Students & Groups Management (Coordinator) =====
function renderPeople() {
  return `
  <div class="fade-in space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-purple-500/20">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 bg-purple-500/30 border border-purple-400/30 text-purple-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <i class="fas fa-user-friends"></i> People Management
          </span>
          <h1 class="text-2xl sm:text-3xl font-bold mt-2">Students &amp; Groups</h1>
          <p class="text-purple-200 text-sm mt-1">View every student and group at a glance — avatars, memberships & full control.</p>
        </div>
        <button onclick="navigate('dashboard')" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 self-start">
          <i class="fas fa-arrow-left"></i> Back to Dashboard
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div id="people-stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${Array.from({ length: 4 }).map(() => `
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm animate-pulse">
          <div class="h-9 w-20 bg-gray-200 rounded-lg"></div>
          <div class="h-3 w-16 bg-gray-100 rounded mt-2"></div>
        </div>`).join('')}
    </div>

    <!-- Controls (static shell — never re-rendered so focus/search stay intact) -->
    <div class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col lg:flex-row items-center gap-3">
      <div class="flex bg-gray-100 p-1 rounded-xl gap-1">
        ${['all', 'groups', 'students'].map(t => `
          <button id="people-tab-${t}" onclick="setPeopleTab('${t}')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${state.peopleTab === t ? 'bg-white text-fypilot-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}">
            ${t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>`).join('')}
      </div>
      <div class="relative flex-1 w-full">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><i class="fas fa-search text-xs"></i></div>
        <input id="people-search" value="${state.peopleSearch}" oninput="setPeopleSearch(this.value)" placeholder="Search name, email, group..." class="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-fypilot-500 focus:bg-white transition-all" />
        ${state.peopleSearch ? `<button onclick="clearPeopleSearch()" title="Clear search" class="absolute inset-y-0 right-0 pr-3 text-gray-400 hover:text-gray-600"><i class="fas fa-times-circle text-xs"></i></button>` : ''}
      </div>
      <div class="flex bg-gray-100 p-1 rounded-xl gap-1">
        <button id="people-view-grid" onclick="setPeopleView('grid')" title="Grid view" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${state.peopleView === 'grid' ? 'bg-white text-fypilot-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}"><i class="fas fa-th-large"></i></button>
        <button id="people-view-table" onclick="setPeopleView('table')" title="Table view" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${state.peopleView === 'table' ? 'bg-white text-fypilot-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}"><i class="fas fa-list"></i></button>
      </div>
    </div>

    <!-- Dynamic results -->
    <div id="people-results" class="space-y-6">Loading...</div>
  </div>`;
}

function renderPeopleStats(data) {
  if (!data) return '';
  return `
    <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><i class="fas fa-user-graduate"></i></div>
        <div>
          <div class="text-2xl font-extrabold text-gray-900">${data.summary.total_students}</div>
          <div class="text-xs font-semibold text-gray-500">Total Students</div>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><i class="fas fa-users"></i></div>
        <div>
          <div class="text-2xl font-extrabold text-gray-900">${data.summary.students_in_groups}</div>
          <div class="text-xs font-semibold text-gray-500">In Groups</div>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-fypilot-100 text-fypilot-600 flex items-center justify-center"><i class="fas fa-people-arrows"></i></div>
        <div>
          <div class="text-2xl font-extrabold text-gray-900">${data.summary.total_groups}</div>
          <div class="text-xs font-semibold text-gray-500">Groups</div>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><i class="fas fa-crown"></i></div>
        <div>
          <div class="text-2xl font-extrabold text-gray-900">${data.students.filter(s => s.is_leader).length}</div>
          <div class="text-xs font-semibold text-gray-500">Group Leaders</div>
        </div>
      </div>
    </div>`;
}

function peopleAvatar(u, cls) {
  const size = cls || 'w-10 h-10 text-xs';
  if (u && u.avatar) {
    return `<div class="${size} rounded-xl overflow-hidden shrink-0 border border-gray-200"><img src="${u.avatar}" class="w-full h-full object-cover" /></div>`;
  }
  const name = (u && u.name) || '?';
  const gradients = ['from-purple-500 to-indigo-500', 'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500', 'from-blue-500 to-cyan-500', 'from-amber-500 to-orange-500'];
  const g = gradients[(name.charCodeAt(0) || 0) % gradients.length];
  return `<div class="${size} rounded-xl shrink-0 bg-gradient-to-br ${g} flex items-center justify-center text-white font-bold">${name.charAt(0)}</div>`;
}

function peopleLeaderBadge() {
  return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wide"><i class="fas fa-crown text-[8px]"></i>Leader</span>`;
}

function peopleStatusBadge(s) {
  const map = {
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  const color = map[s] || 'bg-gray-100 text-gray-600 border-gray-200';
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${color}">${s || 'unknown'}</span>`;
}

function renderPeopleGroupsSection(groups) {
  if (!groups.length) return '';
  const grid = state.peopleView === 'grid';
  return `
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-users text-indigo-500"></i> Groups <span class="text-[11px] font-semibold text-gray-400">(${groups.length})</span></h3>
    </div>
    ${grid ? `
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      ${groups.map(g => `
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><i class="fas fa-people-arrows text-sm"></i></div>
            <div class="min-w-0">
              <p class="text-xs font-bold text-gray-900 truncate">${g.name}</p>
              <p class="text-[10px] text-gray-400">${g.members.length} member${g.members.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button onclick="deletePeopleGroup('${g.id}')" title="Delete group" class="text-gray-300 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-all shrink-0"><i class="fas fa-trash text-sm"></i></button>
        </div>
        ${peopleStatusBadge(g.status)}
        <div class="border-t border-gray-100 pt-3 space-y-2">
          ${g.members.map(m => `
          <div class="flex items-center gap-2.5 ${m.is_leader ? 'bg-amber-50 rounded-xl px-2 py-1.5 -mx-2' : ''}">
            ${peopleAvatar(m, 'w-8 h-8 text-[10px]')}
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-gray-800 truncate">${m.name}</p>
              <p class="text-[10px] text-gray-400 truncate">${m.email}</p>
            </div>
            ${m.is_leader ? peopleLeaderBadge() : ''}
          </div>`).join('')}
        </div>
      </div>`).join('')}
    </div>
    ` : `
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr class="text-[10px] uppercase tracking-wider text-gray-500">
            <th class="px-4 py-3 font-bold">Group</th>
            <th class="px-4 py-3 font-bold">Leader</th>
            <th class="px-4 py-3 font-bold">Members</th>
            <th class="px-4 py-3 font-bold">Status</th>
            <th class="px-4 py-3 font-bold text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${groups.map(g => `
          <tr class="hover:bg-gray-50/60 transition-colors">
            <td class="px-4 py-3">
              <p class="text-xs font-bold text-gray-900">${g.name}</p>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                ${peopleAvatar(g, 'w-7 h-7 text-[10px]')}
                <span class="text-xs font-semibold text-gray-700">${g.leader_name}</span>
                ${peopleLeaderBadge()}
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center -space-x-2">
                ${g.members.slice(0, 4).map(m => m.avatar
                  ? `<div class="w-7 h-7 rounded-full ring-2 ring-white overflow-hidden"><img src="${m.avatar}" class="w-full h-full object-cover" /></div>`
                  : `<div class="w-7 h-7 rounded-full ring-2 ring-white bg-gradient-to-br ${['from-purple-500 to-indigo-500','from-emerald-500 to-teal-500','from-rose-500 to-pink-500','from-blue-500 to-cyan-500'][(m.name.charCodeAt(0) || 0) % 4]} flex items-center justify-center text-white text-[9px] font-bold">${m.name.charAt(0)}</div>`).join('')}
                ${g.members.length > 4 ? `<span class="w-7 h-7 rounded-full ring-2 ring-white bg-gray-200 text-gray-600 text-[9px] font-bold flex items-center justify-center">+${g.members.length - 4}</span>` : ''}
              </div>
              <span class="text-[10px] text-gray-400 ml-2">${g.members.map(m => m.name).join(', ')}</span>
            </td>
            <td class="px-4 py-3">${peopleStatusBadge(g.status)}</td>
            <td class="px-4 py-3 text-right">
              <button onclick="deletePeopleGroup('${g.id}')" title="Delete group" class="text-gray-300 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-all"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    `}
  </div>`;
}

function renderPeopleStudentsSection(students) {
  if (!students.length) return '';
  const grid = state.peopleView === 'grid';
  return `
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-user-graduate text-emerald-500"></i> Students <span class="text-[11px] font-semibold text-gray-400">(${students.length})</span></h3>
    </div>
    ${grid ? `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${students.map(s => `
      <div class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all flex items-start gap-3">
        ${peopleAvatar(s, 'w-12 h-12 text-base')}
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            <p class="text-sm font-bold text-gray-900 truncate">${s.name}</p>
            ${s.is_leader ? peopleLeaderBadge() : ''}
          </div>
          <p class="text-[11px] text-gray-500 truncate">${s.email}</p>
          <p class="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1"><i class="fas fa-building"></i> ${s.department || 'No department'}</p>
          <div class="mt-2">
            ${s.group_name
              ? `<span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100"><i class="fas fa-users"></i>${s.group_name} <span class="text-[9px] font-semibold text-indigo-400">(${s.member_count} members)</span></span>`
              : `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200"><i class="fas fa-user-slash"></i>No group</span>`}
          </div>
        </div>
        <button onclick="deletePeopleStudent('${s.id}','${s.name}')" title="Delete student" class="text-gray-300 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-all shrink-0"><i class="fas fa-trash text-sm"></i></button>
      </div>`).join('')}
    </div>
    ` : `
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr class="text-[10px] uppercase tracking-wider text-gray-500">
            <th class="px-4 py-3 font-bold">Student</th>
            <th class="px-4 py-3 font-bold">Email</th>
            <th class="px-4 py-3 font-bold">Department</th>
            <th class="px-4 py-3 font-bold">Group</th>
            <th class="px-4 py-3 font-bold text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${students.map(s => `
          <tr class="hover:bg-gray-50/60 transition-colors">
            <td class="px-4 py-3">
              <div class="flex items-center gap-2.5">
                ${peopleAvatar(s, 'w-9 h-9 text-xs')}
                <div class="min-w-0">
                  <p class="text-xs font-bold text-gray-900 truncate flex items-center gap-1.5">${s.name} ${s.is_leader ? peopleLeaderBadge() : ''}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-xs text-gray-600">${s.email}</td>
            <td class="px-4 py-3 text-xs text-gray-600">${s.department || '—'}</td>
            <td class="px-4 py-3">
              ${s.group_name
                ? `<span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100"><i class="fas fa-users"></i>${s.group_name}</span>`
                : `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200"><i class="fas fa-user-slash"></i>No group</span>`}
            </td>
            <td class="px-4 py-3 text-right">
              <button onclick="deletePeopleStudent('${s.id}','${s.name}')" title="Delete student" class="text-gray-300 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-all"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    `}
  </div>`;
}

function renderPeopleResults() {
  const data = state.people;
  const container = document.getElementById('people-results');
  if (!container || !data) return;
  if (!data.students.length && !data.groups.length) {
    container.innerHTML = `
      <p class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
        <i class="fas fa-user-friends text-3xl text-gray-300"></i> No students or groups found yet.
      </p>`;
    return;
  }

  const q = (state.peopleSearch || '').trim().toLowerCase();
  const filterGroups = data.groups.filter(g =>
    !q || (g.name || '').toLowerCase().includes(q) || (g.leader_name || '').toLowerCase().includes(q) || g.members.some(m => (m.name || '').toLowerCase().includes(q))
  );
  const filterStudents = data.students.filter(s =>
    !q || (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.group_name || '').toLowerCase().includes(q) || (s.department || '').toLowerCase().includes(q)
  );

  const showAll = state.peopleTab === 'all';
  const showGroups = showAll || state.peopleTab === 'groups';
  const showStudents = showAll || state.peopleTab === 'students';

  const totalShown = (showGroups ? filterGroups.length : 0) + (showStudents ? filterStudents.length : 0);

  container.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2">
      <p class="text-[11px] text-gray-400 font-medium">
        ${q ? `Searching for "<span class="text-fypilot-700 font-bold">${escapeHtml(state.peopleSearch)}</span>" — ` : ''}${totalShown} result${totalShown === 1 ? '' : 's'}
      </p>
    </div>
    ${showGroups ? (filterGroups.length ? renderPeopleGroupsSection(filterGroups) : '<p class="text-xs text-gray-400 bg-white rounded-2xl border border-gray-200 p-6 text-center">No groups match your search.</p>') : ''}
    ${showStudents ? (filterStudents.length ? renderPeopleStudentsSection(filterStudents) : '<p class="text-xs text-gray-400 bg-white rounded-2xl border border-gray-200 p-6 text-center">No students match your search.</p>') : ''}
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadPeople() {
  if (!state.currentUser || state.currentUser.role !== 'coordinator') return;
  try {
    const res = await api('/dashboard/people');
    state.people = res.data;
    const stats = document.getElementById('people-stats');
    if (stats) stats.innerHTML = renderPeopleStats(res.data);
    renderPeopleResults();
  } catch (e) {
    const container = document.getElementById('people-results');
    if (container) container.innerHTML = '<p class="text-sm text-rose-500">Failed to load students & groups.</p>';
  }
}

function setPeopleTab(tab) {
  state.peopleTab = tab;
  const active = 'bg-white text-fypilot-700 shadow-sm';
  const inactive = 'text-gray-500 hover:text-gray-800';
  ['all', 'groups', 'students'].forEach(t => {
    const btn = document.getElementById(`people-tab-${t}`);
    if (btn) btn.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${t === tab ? active : inactive}`;
  });
  renderPeopleResults();
}

function setPeopleView(view) {
  state.peopleView = view;
  const active = 'bg-white text-fypilot-700 shadow-sm';
  const inactive = 'text-gray-500 hover:text-gray-800';
  const gridBtn = document.getElementById('people-view-grid');
  const tableBtn = document.getElementById('people-view-table');
  if (gridBtn) gridBtn.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'grid' ? active : inactive}`;
  if (tableBtn) tableBtn.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'table' ? active : inactive}`;
  renderPeopleResults();
}

function setPeopleSearch(value) {
  state.peopleSearch = value;
  renderPeopleResults();
}

function clearPeopleSearch() {
  state.peopleSearch = '';
  const input = document.getElementById('people-search');
  if (input) input.value = '';
  renderPeopleResults();
  if (input) input.focus();
}

async function deletePeopleStudent(userId, name) {
  if (!confirm(`Delete student "${name}"?\n\nThis permanently removes their account, group memberships, proposals and any linked projects. This cannot be undone.`)) return;
  try {
    const res = await api(`/users/${userId}`, { method: 'DELETE' });
    showToast(res.message || 'Student deleted', 'success');
    await loadPeople();
  } catch (e) { /* handled by api helper */ }
}

async function deletePeopleGroup(groupId) {
  if (!confirm('Delete this group?\n\nAll members will be removed and any linked proposals/projects will be permanently deleted. This cannot be undone.')) return;
  try {
    const res = await api(`/groups/${groupId}`, { method: 'DELETE' });
    showToast(res.message || 'Group deleted', 'success');
    await loadPeople();
  } catch (e) { /* handled by api helper */ }
}

// ===== SUPERVISOR Dashboard =====
function renderSupervisorDashboard() {
  return `
  <div class="fade-in space-y-6">
    <!-- Hero Banner -->
    <div class="bg-gradient-to-r from-blue-900 via-fypilot-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-blue-500/20">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <i class="fas fa-user-tie"></i> Supervisor Portal
          </span>
          <h1 class="text-2xl sm:text-3xl font-bold mt-2">Academic Oversight Hub</h1>
          <p class="text-blue-200 text-sm mt-1">Monitor your assigned projects and approve proposals.</p>
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

    <!-- Chart: Health -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-chart-bar text-emerald-500"></i> Project Health Status</h3>
        <div class="h-56"><canvas id="projectHealthChart"></canvas></div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3"><i class="fas fa-chart-pie text-purple-500"></i> Proposal Status</h3>
        <div class="h-56"><canvas id="proposalsChart"></canvas></div>
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
        <button onclick="navigate('projects')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-stethoscope"></i> Override Project Health</button>
        <button onclick="navigate('proposals')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-check-circle"></i> Approve Proposals</button>
        <button onclick="navigate('supervisors')" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-users"></i> Colleagues</button>
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
          <p class="text-emerald-200 text-sm mt-1">Track your proposal progress and active project health.</p>
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

    <!-- Proposal Status Chart -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <button onclick="navigate('projects')" class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-folder-open"></i> My Project</button>
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
      <button onclick="showNewProposalForm()" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-fypilot-500/20 transition-all flex items-center justify-center gap-2 shrink-0">
        <i class="fas fa-plus"></i>
        <span>New Proposal</span>
      </button>
      ` : ''}
    </div>

    ${state.currentUser && state.currentUser.role === 'student' ? '<div id="proposal-group-banner"></div>' : ''}
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

    <!-- EXECUTIVE POWER CONTROLS FOR COORDINATOR & SUPERVISOR -->
    ${['coordinator', 'supervisor'].includes(state.currentUser.role) ? `
    <div class="bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-indigo-500/30 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div class="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center text-white text-sm shadow-md shrink-0">
            <i class="fas fa-crown"></i>
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-bold text-sm sm:text-base text-white">Approval & Authorization Panel</h3>
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

      <!-- Supervisor Allocation Control (Coordinator only) -->
      ${state.currentUser.role === 'coordinator' ? `
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
      ` : ''}
    </div>
    ` : ''}

    <!-- SUPERVISOR POWER CONTROLS FOR SUPERVISORS -->
    ${state.currentUser.role === 'supervisor' ? `
    <div class="bg-gradient-to-r from-blue-950 to-fypilot-900 text-white rounded-2xl p-5 shadow-xl border border-fypilot-500/30 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-fypilot-500 rounded-xl flex items-center justify-center text-white text-sm shadow-md">
            <i class="fas fa-user-tie"></i>
          </div>
          <div>
            <h3 class="font-bold text-sm text-white">Supervisor Assessment & Review Station</h3>
            <p class="text-[11px] text-fypilot-200">Provide academic endorsement or guidance notes</p>
          </div>
        </div>
        <span class="text-[10px] bg-fypilot-500/30 border border-fypilot-400/40 text-fypilot-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">Supervisor Power</span>
      </div>

      <div class="flex flex-wrap gap-2 pt-2 border-t border-fypilot-800/60">
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
            ${p.group_name ? `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-fypilot-50 text-fypilot-700 border border-fypilot-100"><i class="fas fa-users mr-1"></i>Group: ${p.group_name}</span>` : ''}
          </p>
          ${p.groupMembers && p.groupMembers.length ? `
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider"><i class="fas fa-users text-fypilot-500 mr-1"></i>Team:</span>
            ${p.groupMembers.map(m => `
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${m.is_leader ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-fypilot-50 border border-fypilot-100 text-fypilot-700'}">
                ${m.is_leader ? '<i class="fas fa-crown text-amber-500"></i>' : '<i class="fas fa-user text-fypilot-400"></i>'}${m.name}
              </span>`).join('')}
          </div>` : ''}
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
            <i class="fas fa-brain text-fypilot-500"></i>
            AI Proposal Quality Analysis
          </h3>
          <button onclick="runProposalAnalysis('${p.id}')" class="text-xs bg-fypilot-50 text-fypilot-700 border border-fypilot-200 px-3 py-1.5 rounded-xl hover:bg-fypilot-100 font-semibold transition-colors">
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
            <i class="fas fa-copy text-fypilot-500"></i>
            Project Similarity Analysis
          </h3>
          <button onclick="runSimilarityAnalysis('${p.id}')" class="text-xs bg-fypilot-50 text-fypilot-700 border border-fypilot-200 px-3 py-1.5 rounded-xl hover:bg-fypilot-100 font-semibold transition-colors">
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
          <i class="fas fa-user-check text-fypilot-500"></i>
          AI Supervisor Recommendation
        </h3>
        <button onclick="runSupervisorRecommendation('${p.id}')" class="text-xs bg-fypilot-50 text-fypilot-700 border border-fypilot-200 px-3 py-1.5 rounded-xl hover:bg-fypilot-100 font-semibold transition-colors">
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
          <i class="fas fa-comment-dots text-fypilot-500"></i>
          AI Feedback Assistant
        </h3>
        <button onclick="runFeedbackAssistant('${p.id}')" class="text-xs bg-fypilot-50 text-fypilot-700 border border-fypilot-200 px-3 py-1.5 rounded-xl hover:bg-fypilot-100 font-semibold transition-colors">
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
  const isStudentMember = state.currentUser.role === 'student' && (p.members || []).some(m => m.id === state.currentUser.id);

  return `
  <div class="fade-in space-y-6">
    <button onclick="navigate('projects')" class="text-xs font-semibold text-gray-500 hover:text-gray-800 inline-flex items-center gap-1.5 bg-white border px-3 py-1.5 rounded-xl shadow-sm">
      <i class="fas fa-arrow-left text-xs"></i> Back to Projects
    </button>

    <!-- EXECUTIVE POWER CONTROLS FOR COORDINATOR & SUPERVISOR -->
    ${['coordinator', 'supervisor'].includes(state.currentUser.role) ? `
    <div class="bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-indigo-500/30 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div class="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center text-white text-sm shadow-md shrink-0">
            <i class="fas fa-crown"></i>
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-bold text-sm sm:text-base text-white">Project Governance</h3>
            <p class="text-xs text-indigo-200 leading-snug mt-0.5">Force override health flags</p>
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

      <!-- Supervisor Allocation Control (Coordinator only) -->
      ${state.currentUser.role === 'coordinator' ? `
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
      ` : ''}
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

    </div>

    <!-- Project Progress Tracker -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-chart-line text-fypilot-500"></i> Project Progress Tracker</h3>
        <span class="text-[11px] font-bold px-2.5 py-1 rounded-full ${(p.progress || 0) >= 100 ? 'bg-emerald-100 text-emerald-700' : (p.progress || 0) >= 50 ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}">${p.progress || 0}% Complete</span>
      </div>

      <div class="flex items-center justify-between text-xs font-semibold text-gray-600 mb-1">
        <span>Work Completed</span>
        <span>${100 - (p.progress || 0)}% remaining</span>
      </div>
      <div class="w-full bg-gray-100 rounded-full h-3.5 p-0.5 border">
        <div class="bg-gradient-to-r from-fypilot-500 to-indigo-600 h-full rounded-full transition-all duration-500" style="width: ${p.progress || 0}%"></div>
      </div>

      ${isStudentMember ? `
      <div class="pt-3 border-t border-gray-100">
        <div class="flex items-center justify-between text-xs font-semibold text-gray-700 mb-2">
          <span>Report Your Progress</span>
          <span id="progress-preview" class="text-fypilot-700">${p.progress || 0}% done &bull; ${100 - (p.progress || 0)}% left</span>
        </div>
        <input id="project-progress-slider" type="range" min="0" max="100" step="1" value="${p.progress || 0}"
               oninput="document.getElementById('progress-preview').textContent = this.value + '% done &bull; ' + (100 - parseInt(this.value)) + '% left'"
               class="w-full accent-fypilot-600">
        <button onclick="updateProjectProgress('${p.id}')" class="mt-2 w-full sm:w-auto bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md">
          <i class="fas fa-save"></i> Update Progress
        </button>
      </div>
      ` : ''}
    </div>

    <!-- Project Links -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-link text-fypilot-500"></i> Project Links</h3>
        ${isStudentMember ? `<button onclick="toggleLinkForm()" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"><i class="fas fa-plus"></i> Add Link</button>` : ''}
      </div>
      <div id="link-form" class="hidden space-y-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input id="link-label" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="Label (e.g. GitHub Repo)" />
          <input id="link-url" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="https://..." />
        </div>
        <button onclick="addProjectLink('${p.id}')" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md"><i class="fas fa-save mr-1"></i>Save Link</button>
      </div>
      <div class="space-y-2">
        ${(p.links || []).length ? p.links.map(l => `
          <div class="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
            <a href="${l.url}" target="_blank" rel="noopener" class="text-xs font-semibold text-fypilot-700 hover:underline truncate flex items-center gap-2 min-w-0"><i class="fas fa-external-link-alt text-[10px] shrink-0"></i><span class="truncate">${l.label}</span></a>
            ${isStudentMember ? `<button onclick="deleteProjectLink('${p.id}','${l.id}')" class="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 shrink-0" title="Remove"><i class="fas fa-trash text-xs"></i></button>` : ''}
          </div>
        `).join('') : '<p class="text-xs text-gray-400">No links added yet.</p>'}
      </div>
    </div>

    <!-- Project Gallery -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-images text-fypilot-500"></i> Screenshots & Gallery</h3>
        ${isStudentMember ? `
        <div class="flex flex-wrap gap-2 items-center">
          <span class="text-[11px] text-gray-400 flex items-center gap-1"><i class="fas fa-keyboard"></i> Ctrl+V to paste screenshot</span>
          <button onclick="document.getElementById('gallery-file-input').click()" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"><i class="fas fa-upload"></i> Upload Image</button>
        </div>` : ''}
      </div>
      <input type="file" id="gallery-file-input" accept="image/*" class="hidden" onchange="handleGalleryUpload('${p.id}', event)" />
      ${isStudentMember ? `<input id="gallery-caption" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="Caption for next upload (optional)" />` : ''}
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        ${(p.media || []).length ? p.media.map(m => `
          <div class="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer" onclick="openLightbox('${p.id}', '${m.id}')">
            <img src="${m.data}" alt="${m.caption || 'screenshot'}" class="w-full h-32 object-cover hover:opacity-90 transition-opacity" />
            ${isStudentMember ? `<button onclick="event.stopPropagation(); deleteProjectMedia('${p.id}','${m.id}')" class="absolute top-1.5 right-1.5 w-7 h-7 bg-black/60 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600" title="Delete"><i class="fas fa-trash text-[10px]"></i></button>` : ''}
            ${(m.feedback || []).length ? `<span class="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"><i class="fas fa-comment"></i>${m.feedback.length}</span>` : ''}
            ${m.caption ? `<div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] px-2 py-1.5 truncate pointer-events-none">${m.caption}</div>` : ''}
          </div>
        `).join('') : '<p class="text-xs text-gray-400 col-span-full">No screenshots uploaded yet. Students can upload or paste screenshots with Ctrl+V.</p>'}
      </div>
    </div>

    <!-- Overall Project Feedback -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-comments text-fypilot-500"></i> Overall Project Feedback</h3>
        <span class="text-[11px] text-gray-400">By Coordinator / Supervisor</span>
      </div>
      ${['coordinator', 'supervisor'].includes(state.currentUser.role) ? `
      <div class="flex flex-col sm:flex-row gap-2">
        <input id="overall-feedback-input" class="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="Write feedback for the project team..." />
        <button onclick="addOverallFeedback('${p.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"><i class="fas fa-paper-plane"></i> Post</button>
      </div>` : ''}
      <div class="space-y-3">
        ${(p.overallFeedback || []).length ? p.overallFeedback.map(f => `
          <div class="flex items-start gap-3 p-3 rounded-xl border ${f.author_role === 'coordinator' ? 'bg-purple-50 border-purple-100' : 'bg-blue-50 border-blue-100'}">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${f.author_role === 'coordinator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${(f.author_name || '?').charAt(0)}</div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold text-gray-900">${f.author_name}</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold ${f.author_role === 'coordinator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${f.author_role}</span>
                <span class="text-[10px] text-gray-400">${new Date(f.created_at).toLocaleString()}</span>
              </div>
              <p class="text-xs text-gray-700 mt-1 leading-relaxed">${f.message}</p>
            </div>
          </div>
        `).join('') : '<p class="text-xs text-gray-400">No feedback yet.</p>'}
      </div>
    </div>

    <!-- AI Risk & Insights Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
            <i class="fas fa-heartbeat text-fypilot-500"></i>
            AI Risk Prediction
          </h3>
          <button onclick="runRiskAnalysis('${p.id}')" class="text-xs bg-fypilot-50 text-fypilot-700 border border-fypilot-200 px-3 py-1.5 rounded-xl hover:bg-fypilot-100 font-semibold transition-colors">
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
            <i class="fas fa-lightbulb text-fypilot-500"></i>
            AI Insights
          </h3>
          <button onclick="runProjectInsights('${p.id}')" class="text-xs bg-fypilot-50 text-fypilot-700 border border-fypilot-200 px-3 py-1.5 rounded-xl hover:bg-fypilot-100 font-semibold transition-colors">
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
          <i class="fas fa-file-contract text-fypilot-500"></i>
          AI Project Executive Summary
        </h3>
        <button onclick="runProjectSummary('${p.id}')" class="text-xs bg-fypilot-50 text-fypilot-700 border border-fypilot-200 px-3 py-1.5 rounded-xl hover:bg-fypilot-100 font-semibold transition-colors">
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
        <i class="fas fa-robot text-fypilot-500"></i>
        AI Project Assistant
      </h3>
      <div class="flex flex-col sm:flex-row gap-2">
        <input type="text" id="project-query-input" placeholder="Ask about this project (e.g., 'What is the current health status?')" 
               class="flex-1 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fypilot-500" 
               onkeydown="if(event.key==='Enter')runProjectQuery('${p.id}')">
        <button onclick="runProjectQuery('${p.id}')" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
          <i class="fas fa-paper-plane mr-1"></i> Ask
        </button>
      </div>
      <div id="project-query-result"></div>
    </div>

  </div>`;
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
      await loadProjectDetail(projectId);
    }
  } catch (e) {
    // Handled by api helper
  }
}

async function updateProjectProgress(projectId) {
  const slider = document.getElementById('project-progress-slider');
  if (!slider) return;
  const progress = Math.min(100, Math.max(0, parseInt(slider.value, 10) || 0));
  try {
    const res = await api(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ progress })
    });
    if (res.success) {
      showToast(`Progress updated to ${progress}%!`, 'success');
      await loadProjectDetail(projectId);
    }
  } catch (e) {
    // Handled by api helper
  }
}

// ===== Project Links =====
function toggleLinkForm() {
  const form = document.getElementById('link-form');
  if (form) form.classList.toggle('hidden');
}

async function addProjectLink(projectId) {
  const url = document.getElementById('link-url').value.trim();
  const label = document.getElementById('link-label').value.trim();
  if (!url) { showToast('Link URL is required', 'error'); return; }
  try {
    const res = await api(`/projects/${projectId}/links`, { method: 'POST', body: JSON.stringify({ url, label }) });
    showToast(res.message || 'Link added!', 'success');
    await loadProjectDetail(projectId);
  } catch (e) { /* handled by api helper */ }
}

async function deleteProjectLink(projectId, linkId) {
  if (!confirm('Remove this link?')) return;
  try {
    const res = await api(`/projects/${projectId}/links/${linkId}`, { method: 'DELETE' });
    showToast(res.message || 'Link removed', 'success');
    await loadProjectDetail(projectId);
  } catch (e) { /* handled by api helper */ }
}

// ===== Project Gallery (screenshots) =====
async function handleGalleryUpload(projectId, event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (file) uploadProjectImage(projectId, file);
}

async function uploadProjectImage(projectId, file) {
  if (!file || !file.type.startsWith('image/')) { showToast('Please choose an image file', 'error'); return; }
  if (file.size > 1000 * 1024) { showToast('Image too large (max 1MB)', 'error'); return; }
  const captionEl = document.getElementById('gallery-caption');
  const caption = captionEl ? captionEl.value.trim() : '';
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const res = await api(`/projects/${projectId}/media`, { method: 'POST', body: JSON.stringify({ data: reader.result, caption }) });
      if (captionEl) captionEl.value = '';
      showToast(res.message || 'Screenshot uploaded!', 'success');
      await loadProjectDetail(projectId);
    } catch (e) { /* handled by api helper */ }
  };
  reader.readAsDataURL(file);
}

async function deleteProjectMedia(projectId, mediaId) {
  if (!confirm('Delete this screenshot? Its feedback will also be removed.')) return;
  try {
    const res = await api(`/projects/${projectId}/media/${mediaId}`, { method: 'DELETE' });
    showToast(res.message || 'Screenshot removed', 'success');
    await loadProjectDetail(projectId);
  } catch (e) { /* handled by api helper */ }
}

// Paste screenshots with Ctrl+V
function attachProjectPaste() {
  window.removeEventListener('paste', handleProjectPaste);
  if (state.currentView === 'project-detail') {
    window.addEventListener('paste', handleProjectPaste);
  }
}

async function handleProjectPaste(e) {
  if (state.currentView !== 'project-detail' || !state.selectedProject) return;
  if (!['student'].includes(state.currentUser.role)) return;
  const isMember = (state.selectedProject.members || []).some(m => m.id === state.currentUser.id);
  if (!isMember) return;
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        showToast('Pasted screenshot detected — uploading...', 'info');
        uploadProjectImage(state.selectedProject.id, file);
        return;
      }
    }
  }
}

// ===== Lightbox =====
function openLightbox(projectId, mediaId) {
  const p = state.selectedProject;
  const media = (p.media || []).find(m => m.id === mediaId);
  if (!media) return;
  const isExec = ['coordinator', 'supervisor'].includes(state.currentUser.role);
  const overlay = document.createElement('div');
  overlay.id = 'lightbox-overlay';
  overlay.className = 'fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.innerHTML = `
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto fade-in">
    <div class="p-4 border-b border-gray-100 flex items-center justify-between">
      <h3 class="font-bold text-gray-900 text-sm truncate">${media.caption || 'Screenshot'}</h3>
      <button onclick="closeLightbox()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center shrink-0"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-4">
      <img src="${media.data}" class="w-full rounded-xl border border-gray-200" />
      <p class="text-[11px] text-gray-400 mt-2">Uploaded by ${media.uploader_name || 'Unknown'} &bull; ${new Date(media.created_at).toLocaleString()}</p>
      <div class="mt-4">
        <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fas fa-comments text-fypilot-500"></i> Feedback on this image</h4>
        ${isExec ? `
        <div class="flex flex-col sm:flex-row gap-2 mb-3">
          <input id="media-feedback-input" class="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="Comment on this screenshot..." />
          <button onclick="addMediaFeedback('${projectId}','${mediaId}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"><i class="fas fa-paper-plane"></i> Post</button>
        </div>` : ''}
        <div class="space-y-2">
          ${(media.feedback || []).length ? media.feedback.map(f => `
            <div class="flex items-start gap-2.5 p-2.5 rounded-xl border ${f.author_role === 'coordinator' ? 'bg-purple-50 border-purple-100' : 'bg-blue-50 border-blue-100'}">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${f.author_role === 'coordinator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${(f.author_name || '?').charAt(0)}</div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[11px] font-bold text-gray-900">${f.author_name}</span>
                  <span class="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold ${f.author_role === 'coordinator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${f.author_role}</span>
                  <span class="text-[10px] text-gray-400">${new Date(f.created_at).toLocaleString()}</span>
                </div>
                <p class="text-xs text-gray-700 mt-0.5">${f.message}</p>
              </div>
            </div>
          `).join('') : '<p class="text-xs text-gray-400">No feedback on this image yet.</p>'}
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

function closeLightbox() {
  const el = document.getElementById('lightbox-overlay');
  if (el) el.remove();
}

// ===== Project Feedback =====
async function addOverallFeedback(projectId) {
  const input = document.getElementById('overall-feedback-input');
  const message = input ? input.value.trim() : '';
  if (!message) { showToast('Write a feedback message first', 'error'); return; }
  try {
    const res = await api(`/projects/${projectId}/feedback`, { method: 'POST', body: JSON.stringify({ message }) });
    showToast(res.message || 'Feedback posted!', 'success');
    await loadProjectDetail(projectId);
  } catch (e) { /* handled by api helper */ }
}

async function addMediaFeedback(projectId, mediaId) {
  const input = document.getElementById('media-feedback-input');
  const message = input ? input.value.trim() : '';
  if (!message) { showToast('Write a feedback message first', 'error'); return; }
  try {
    const res = await api(`/projects/${projectId}/feedback`, { method: 'POST', body: JSON.stringify({ message, media_id: mediaId }) });
    showToast(res.message || 'Feedback posted!', 'success');
    closeLightbox();
    await loadProjectDetail(projectId);
  } catch (e) { /* handled by api helper */ }
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
  <div class="flex items-center gap-3 py-3 text-fypilot-700">
    <div class="w-5 h-5 border-2 border-fypilot-500 border-t-transparent rounded-full animate-spin"></div>
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
      <div class="border rounded-xl p-3 ${i === 0 ? 'border-fypilot-300 bg-fypilot-50/60' : 'border-gray-200'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-gray-900">${i + 1}. ${rec.supervisorName}</span>
          <span class="text-xs font-extrabold text-fypilot-700">Match: ${rec.matchScore}%</span>
        </div>
        <ul class="text-xs text-gray-600 mt-1.5 space-y-1">${(rec.reasons || []).map(r => `<li class="flex items-center gap-1.5"><i class="fas fa-check text-fypilot-500 text-[10px]"></i><span>${r}</span></li>`).join('')}</ul>
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
          <i class="fas ${s.icon} text-fypilot-500"></i> ${s.label}
        </h5>
        <ul class="text-xs text-gray-600 space-y-1 pl-2">
          ${data[s.key].map(item => `<li class="flex items-start gap-1.5"><i class="fas fa-chevron-right text-gray-400 text-[10px] mt-1"></i><span>${item}</span></li>`).join('')}
        </ul>
      </div>
    `).join('')}
  </div>`;
}

function renderQueryResult(data, question) {
  const sources = (data.sources && data.sources.length) ? data.sources : (data.dataUsed || []);
  const sourceTags = sources.length ? `<div class="flex flex-wrap gap-1 mt-2 pt-2 border-t border-fypilot-200/60">${sources.map(s => `<span class="text-[10px] bg-fypilot-100/90 text-fypilot-800 px-2 py-0.5 rounded-md font-medium"><i class="fas fa-database mr-1 text-[9px] text-fypilot-600"></i>${s}</span>`).join('')}</div>` : '';
  const formattedAnswer = (data.answer || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  return `
  <div class="bg-fypilot-50/70 border border-fypilot-200 rounded-xl p-4 space-y-2 mt-2 shadow-xs fade-in">
    <p class="text-xs font-bold text-fypilot-900 flex items-center gap-1.5"><i class="fas fa-user-circle text-fypilot-600"></i> ${question}</p>
    <div class="text-xs text-gray-800 leading-relaxed space-y-1">${formattedAnswer}</div>
    ${sourceTags}
  </div>`;
}

// ===== Interactive Chart Initializers =====

function initDashboardCharts(stats) {
  if (!window.Chart || !stats) return;

  // 1. Proposal Breakdown Chart (Doughnut) — built from real DB status counts only
  const propElem = document.getElementById('proposalsChart');
  if (propElem) {
    destroyChart('proposalsChart');
    const p = stats.proposals || {};
    const statusMeta = [
      { key: 'draft', label: 'Draft', color: '#64748b' },
      { key: 'submitted', label: 'Submitted', color: '#0284c7' },
      { key: 'under_review', label: 'Under Review', color: '#f59e0b' },
      { key: 'approved', label: 'Approved', color: '#10b981' },
      { key: 'rejected', label: 'Rejected', color: '#f43f5e' },
      { key: 'revision_requested', label: 'Revision Requested', color: '#8b5cf6' },
    ];
    const present = statusMeta
      .map(s => ({ ...s, count: Number(p[s.key]) || 0 }))
      .filter(s => s.count > 0);
    if (present.length) {
      chartInstances['proposalsChart'] = new Chart(propElem, {
        type: 'doughnut',
        data: {
          labels: present.map(s => s.label),
          datasets: [{
            data: present.map(s => s.count),
            backgroundColor: present.map(s => s.color),
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
    } else {
      propElem.parentElement.innerHTML =
        '<p class="h-full flex items-center justify-center text-xs text-gray-400">No proposals found.</p>';
    }
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
          <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Proposals Approved</div>
          <div class="text-2xl font-extrabold text-gray-900 mt-1">${d.proposals?.approved || 0}</div>
          <div class="text-xs text-emerald-600 mt-1 font-medium">cleared for execution</div>
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
              ${p.group_name ? `<span class="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-fypilot-50 text-fypilot-700 border border-fypilot-100"><i class="fas fa-users"></i>${p.group_name}</span>` : ''}
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
    const proposal = res.data;
    if (proposal.group_id) {
      try {
        const groupRes = await api(`/groups/${proposal.group_id}`);
        proposal.groupMembers = (groupRes.data && groupRes.data.members) || [];
      } catch (e) { proposal.groupMembers = []; }
    }
    state.selectedProposal = proposal;
    state.supervisors = supervisorsRes.data || [];
    navigate('proposal-detail', proposal);
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
              <span class="text-[10px] text-gray-400 capitalize">${(p.health || '').replace('_', ' ')}</span>
            </div>
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
            <div class="w-10 h-10 bg-fypilot-100 text-fypilot-700 rounded-xl flex items-center justify-center font-bold">
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

// ===== Student Groups =====
function renderGroups() {
  const role = state.currentUser.role;
  return `
  <div class="fade-in space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">${role === 'coordinator' ? 'Student Groups' : 'My Group'}</h1>
        <p class="text-gray-500 text-xs sm:text-sm mt-0.5">${role === 'coordinator' ? 'Review and approve FYP student teams (max 4 members each)' : 'Your FYP team — get it approved to submit one joint proposal'}</p>
      </div>
      ${role === 'student' ? `
      <button onclick="showCreateGroupModal()" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-fypilot-500/20 transition-all flex items-center justify-center gap-2">
        <i class="fas fa-plus"></i>
        <span>Create Group</span>
      </button>` : ''}
    </div>
    <div id="groups-list" class="space-y-3">Loading...</div>
  </div>`;
}

function renderGroupProfile() {
  const g = state.selectedGroup;
  if (!g) return '<p class="p-6 text-gray-500">No group selected</p>';

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-100 text-rose-700 border-rose-200'
  };
  const members = g.members || [];
  const isExecutive = ['coordinator', 'supervisor'].includes(state.currentUser.role);
  const isLeader = state.currentUser.role === 'student' && state.currentUser.id === g.leader_id;
  const canManage = isLeader && g.status === 'pending';
  const canDelete = (isLeader && g.status !== 'approved') || state.currentUser.role === 'coordinator';

  return `
  <div class="fade-in space-y-6">
    <button onclick="navigate('groups')" class="text-xs font-semibold text-gray-500 hover:text-gray-800 inline-flex items-center gap-1.5 bg-white border px-3 py-1.5 rounded-xl shadow-sm">
      <i class="fas fa-arrow-left text-xs"></i> Back to Groups
    </button>

    <div class="bg-gradient-to-r from-fypilot-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-fypilot-500/20">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl sm:text-2xl font-bold">${g.name}</h1>
            <span class="px-3 py-0.5 rounded-full text-[11px] font-bold border ${statusColors[g.status] || 'bg-gray-100'} capitalize">${g.status}</span>
          </div>
          <p class="text-sm text-fypilot-200 mt-2"><i class="fas fa-crown text-amber-400 mr-1.5"></i>Group Leader: <span class="font-semibold text-white">${g.leader_name || 'Unknown'}</span></p>
          <p class="text-[11px] text-fypilot-300 mt-1"><i class="fas fa-users mr-1.5"></i>${members.length}/4 members &bull; Max group size: ${g.max_members || 4}</p>
        </div>
        <div class="flex flex-wrap gap-2 shrink-0">
          ${isExecutive && g.status === 'pending' ? `
            <button onclick="approveGroup('${g.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md"><i class="fas fa-check-circle mr-1"></i>Approve</button>
            <button onclick="rejectGroup('${g.id}')" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md"><i class="fas fa-times-circle mr-1"></i>Reject</button>
          ` : ''}
          ${isExecutive ? `<button onclick="showChangeLeaderModal('${g.id}')" class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md"><i class="fas fa-crown mr-1"></i>Change Leader</button>` : ''}
          ${canDelete ? `<button onclick="deleteGroup('${g.id}')" class="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"><i class="fas fa-trash mr-1"></i>Delete</button>` : ''}
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-bold text-gray-900"><i class="fas fa-users text-fypilot-500 mr-2"></i>Group Members</h2>
        ${canManage ? `<button onclick="showAddMemberModal('${g.id}')" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"><i class="fas fa-user-plus"></i> Add Member</button>` : ''}
      </div>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${members.map(m => `
          <div class="flex items-center justify-between p-3 rounded-xl border border-gray-200">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${m.is_leader ? 'bg-amber-100 text-amber-700' : 'bg-fypilot-100 text-fypilot-700'}">${(m.name || '?').charAt(0)}</div>
              <div class="min-w-0">
                <div class="text-xs font-bold text-gray-900 truncate flex items-center gap-1.5">${m.name}${m.is_leader ? '<span class="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold uppercase">Leader</span>' : ''}</div>
                <div class="text-[11px] text-gray-500 truncate">${m.email}${m.department ? ' &bull; ' + m.department : ''}</div>
              </div>
            </div>
            ${canManage && !m.is_leader ? `<button onclick="removeGroupMember('${g.id}','${m.id}')" class="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors" title="Remove member"><i class="fas fa-times"></i></button>` : ''}
          </div>
        `).join('')}
      </div>
    </div>

    ${canManage ? `
    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700 flex items-start gap-2">
      <i class="fas fa-hourglass-half mt-0.5"></i>
      <span><b>Awaiting approval.</b> The coordinator will review this team. Once approved, only you (the leader) can submit the group's joint FYP proposal.</span>
    </div>` : ''}
    ${g.status === 'approved' ? `
    <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-700 flex items-start gap-2">
      <i class="fas fa-check-circle mt-0.5"></i>
      <span><b>Group approved!</b> The group leader can now submit one joint FYP proposal that covers all ${members.length} members.</span>
    </div>` : ''}
  </div>`;
}

// ===== Profile =====
function renderProfile() {
  const u = state.currentUser;
  const roleIcons = { coordinator: 'fa-crown', supervisor: 'fa-user-tie', student: 'fa-user-graduate' };
  const roleColors = { coordinator: 'from-purple-600 to-indigo-700', supervisor: 'from-blue-600 to-fypilot-700', student: 'from-emerald-600 to-teal-700' };
  return `
  <div class="fade-in space-y-6">
    <div class="bg-gradient-to-r ${roleColors[u.role] || 'from-fypilot-600 to-indigo-700'} text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div class="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
      <div class="relative flex flex-col sm:flex-row sm:items-center gap-5">
        <div class="relative shrink-0 w-fit">
          <div class="w-24 h-24 rounded-2xl overflow-hidden bg-white/20 border-2 border-white/30 shadow-lg flex items-center justify-center">
            ${u.avatar ? `<img src="${u.avatar}" alt="${u.name}" class="w-full h-full object-cover" />` : `<i class="fas ${roleIcons[u.role] || 'fa-user'} text-3xl text-white/80"></i>`}
          </div>
          <button onclick="triggerAvatarUpload()" class="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-white text-gray-700 shadow-lg flex items-center justify-center hover:scale-105 transition-all border border-gray-200" title="Change photo">
            <i class="fas fa-camera text-sm"></i>
          </button>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl sm:text-2xl font-bold truncate">${u.name}</h1>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] bg-white/20 border border-white/30 font-bold uppercase tracking-wider capitalize">${u.role}</span>
          </div>
          <p class="text-xs sm:text-sm opacity-85 mt-1 truncate"><i class="fas fa-envelope mr-1.5 opacity-70"></i>${u.email}</p>
          <p class="text-xs sm:text-sm opacity-85 mt-0.5"><i class="fas fa-building mr-1.5 opacity-70"></i>${u.department || 'Computer Science'}</p>
        </div>
        <button onclick="showEditProfileModal()" class="shrink-0 self-start sm:self-center bg-white/15 hover:bg-white/25 border border-white/25 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2">
          <i class="fas fa-pen"></i> Edit Profile
        </button>
      </div>
    </div>
    <input type="file" id="avatar-file-input" accept="image/*" class="hidden" onchange="handleAvatarUpload(event)" />
    <div id="profile-content" class="grid grid-cols-1 lg:grid-cols-2 gap-6">Loading...</div>
  </div>`;
}

function triggerAvatarUpload() {
  const input = document.getElementById('avatar-file-input');
  if (input) input.click();
}

async function handleAvatarUpload(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please choose an image file', 'error'); return; }
  if (file.size > 400 * 1024) { showToast('Image too large (max 400KB)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await api(`/users/${state.currentUser.id}/avatar`, { method: 'PUT', body: JSON.stringify({ avatar: reader.result }) });
      state.currentUser.avatar = reader.result;
      localStorage.setItem('fypilot_user', JSON.stringify(state.currentUser));
      showToast('Profile photo updated!', 'success');
      render();
    } catch (err) { /* handled by api helper */ }
  };
  reader.readAsDataURL(file);
}

function showEditProfileModal() {
  const u = state.currentUser;
  const overlay = document.createElement('div');
  overlay.id = 'group-modal-overlay';
  overlay.className = 'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.innerHTML = `
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto fade-in">
    <div class="p-5 border-b border-gray-100 flex items-center justify-between">
      <h3 class="font-bold text-gray-900">Edit Profile</h3>
      <button onclick="closeGroupModal()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-5 space-y-4">
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
        <input id="edit-name" value="${u.name || ''}" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Email</label>
        <input id="edit-email" type="email" value="${u.email || ''}" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" />
      </div>
      <div class="pt-2 border-t border-gray-100">
        <label class="block text-xs font-semibold text-gray-700 mb-1">New Password <span class="text-gray-400 font-normal">(optional, min 6 chars)</span></label>
        <input id="edit-password" type="password" placeholder="Leave blank to keep current password" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Confirm Password</label>
        <input id="edit-password-confirm" type="password" placeholder="Re-enter new password" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" />
      </div>
      <button onclick="submitEditProfile()" class="w-full bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-fypilot-500/20 transition-all"><i class="fas fa-save mr-1"></i>Save Changes</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitEditProfile() {
  const name = document.getElementById('edit-name').value.trim();
  const email = document.getElementById('edit-email').value.trim();
  const password = document.getElementById('edit-password').value;
  const confirmPwd = document.getElementById('edit-password-confirm').value;

  if (!name) { showToast('Name cannot be empty', 'error'); return; }
  if (!email) { showToast('Email cannot be empty', 'error'); return; }
  if (password && password !== confirmPwd) { showToast('Passwords do not match', 'error'); return; }
  if (password && password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }

  const payload = { name, email };
  if (password) payload.password = password;

  try {
    const res = await api(`/users/${state.currentUser.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    state.currentUser = { ...state.currentUser, ...res.data };
    localStorage.setItem('fypilot_user', JSON.stringify(state.currentUser));
    showToast(res.message || 'Profile updated!', 'success');
    closeGroupModal();
    render();
  } catch (e) { /* handled by api helper */ }
}

// ===== Groups Data & Actions =====
async function loadGroups() {
  try {
    const res = await api('/groups');
    state.groups = res.data || [];
    const container = document.getElementById('groups-list');
    if (!container) return;
    const role = state.currentUser.role;

    if (role === 'student') {
      state.myGroup = state.groups[0] || null;
      if (state.groups.length === 0) {
        container.innerHTML = `
        <div class="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
          <div class="w-16 h-16 bg-fypilot-100 text-fypilot-600 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-3"><i class="fas fa-users"></i></div>
          <h3 class="font-bold text-gray-900">You are not in a group yet</h3>
          <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Form a team of up to 4 students. Once the coordinator approves it, the group leader can submit one joint FYP proposal.</p>
          <button onclick="showCreateGroupModal()" class="mt-4 bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-fypilot-500/20 transition-all flex items-center gap-2 mx-auto">
            <i class="fas fa-plus"></i> Create Group
          </button>
        </div>`;
        return;
      }
      container.innerHTML = state.groups.map(g => renderGroupCard(g)).join('');
    } else {
      container.innerHTML = state.groups.map(g => renderGroupCard(g)).join('') || '<p class="text-xs text-gray-400">No student groups formed yet.</p>';
    }
  } catch (e) {
    console.error('Failed to load groups:', e);
  }
}

function renderGroupCard(g) {
  const statusColors = { pending: 'bg-amber-100 text-amber-700 border-amber-200', approved: 'bg-emerald-100 text-emerald-700 border-emerald-200', rejected: 'bg-rose-100 text-rose-700 border-rose-200' };
  const isExecutive = ['coordinator', 'supervisor'].includes(state.currentUser.role);
  return `
  <div class="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-sm font-bold text-gray-900 truncate">${g.name}</h3>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusColors[g.status] || 'bg-gray-100'} capitalize">${g.status}</span>
        </div>
        <p class="text-[11px] text-gray-500 mt-1">
          <i class="fas fa-crown text-amber-500 mr-1"></i>Leader: <span class="font-semibold text-gray-700">${g.leader_name || 'Unknown'}</span>
          ${isExecutive ? ` &bull; <span class="font-semibold text-gray-700">${g.member_count || 0}</span>/4 members` : ''}
        </p>
      </div>
      <div class="flex gap-2 shrink-0">
        <button onclick="loadGroupDetail('${g.id}')" class="border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          <i class="fas fa-eye mr-1"></i>View Profile
        </button>
        ${isExecutive && g.status === 'pending' ? `
          <button onclick="approveGroup('${g.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors"><i class="fas fa-check-circle mr-1"></i>Approve</button>
          <button onclick="rejectGroup('${g.id}')" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors"><i class="fas fa-times-circle mr-1"></i>Reject</button>
        ` : ''}
      </div>
    </div>
  </div>`;
}

async function loadGroupDetail(id) {
  try {
    const res = await api(`/groups/${id}`);
    state.selectedGroup = res.data;
    navigate('group-profile', res.data);
  } catch (e) {
    console.error('Failed to load group:', e);
  }
}

async function loadMyGroup() {
  try {
    if (state.currentUser.role !== 'student') return;
    const res = await api('/groups');
    state.myGroup = (res.data || [])[0] || null;
    renderProposalGroupBanner();
  } catch (e) {
    console.error('Failed to load my group:', e);
  }
}

function renderProposalGroupBanner() {
  const banner = document.getElementById('proposal-group-banner');
  if (!banner) return;
  const g = state.myGroup;
  if (!g) {
    banner.innerHTML = `
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-700 flex items-start gap-2">
        <i class="fas fa-exclamation-triangle mt-0.5"></i>
        <span>You are not in a group yet. <button onclick="navigate('groups')" class="underline font-bold">Create a group</button> — only the leader of an <b>approved</b> group can submit a proposal.</span>
      </div>`;
    return;
  }
  if (g.status !== 'approved') {
    banner.innerHTML = `
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-700 flex items-start gap-2">
        <i class="fas fa-hourglass-half mt-0.5"></i>
        <span>Your group "<b>${g.name}</b>" is <b>${g.status}</b>. Wait for the coordinator to approve it before submitting your joint proposal.</span>
      </div>`;
    return;
  }
  if (g.leader_id === state.currentUser.id) {
    banner.innerHTML = `
      <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-700 flex items-start gap-2">
        <i class="fas fa-check-circle mt-0.5"></i>
        <span>Your group "<b>${g.name}</b>" is approved. As the leader, you can submit <b>one joint proposal</b> covering all members.</span>
      </div>`;
  } else {
    banner.innerHTML = `
      <div class="bg-fypilot-50 border border-fypilot-200 rounded-2xl p-3.5 text-xs text-fypilot-700 flex items-start gap-2">
        <i class="fas fa-info-circle mt-0.5"></i>
        <span>You are a member of approved group "<b>${g.name}</b>". Only the group leader can submit the proposal.</span>
      </div>`;
  }
}

async function loadProfile() {
  try {
    const me = state.currentUser;
    const [userRes, groupsRes, proposalsRes, projectsRes] = await Promise.all([
      api(`/users/${me.id}`).catch(() => null),
      api('/groups').catch(() => null),
      api('/proposals').catch(() => null),
      api('/projects').catch(() => null),
    ]);
    const user = (userRes && userRes.data) || me;
    const groups = (groupsRes && groupsRes.data) || [];
    const proposals = (proposalsRes && proposalsRes.data) || [];
    const projects = (projectsRes && projectsRes.data) || [];
    const container = document.getElementById('profile-content');
    if (!container) return;

    let sections = '';

    if (me.role === 'student') {
      const g = groups[0] || null;
      sections += `
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 class="font-bold text-gray-900 text-sm mb-3"><i class="fas fa-users text-fypilot-500 mr-2"></i>My Group</h3>
          ${g ? `
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold text-gray-700 truncate">${g.name}</span>
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${g.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : g.status === 'rejected' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200'} capitalize">${g.status}</span>
              </div>
              <p class="text-[11px] text-gray-500">Leader: ${g.leader_name || 'Unknown'} &bull; ${g.member_count || 1}/4 members</p>
              <button onclick="loadGroupDetail('${g.id}')" class="mt-2 w-full border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold text-fypilot-700 hover:bg-fypilot-50 transition-colors">Open Group Profile</button>
            </div>
          ` : `
            <p class="text-xs text-gray-500">You are not in a group yet.</p>
            <button onclick="navigate('groups')" class="mt-2 w-full bg-fypilot-600 hover:bg-fypilot-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all">Create Group</button>
          `}
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 class="font-bold text-gray-900 text-sm mb-3"><i class="fas fa-file-alt text-fypilot-500 mr-2"></i>My Proposals</h3>
          <p class="text-3xl font-bold text-gray-900">${proposals.length}</p>
          <p class="text-[11px] text-gray-500 mt-1">${proposals.filter(p => p.status === 'approved').length} approved &bull; ${proposals.filter(p => p.status === 'submitted').length} submitted</p>
          ${proposals.length ? `
            <div class="mt-3 space-y-2 max-h-44 overflow-y-auto">
              ${proposals.map(p => `
                <button onclick="loadProposalDetail('${p.id}')" class="w-full text-left p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <span class="block text-xs font-semibold text-gray-800 truncate">${p.title}</span>
                  <span class="text-[10px] text-gray-400 capitalize">${p.status.replace('_', ' ')}</span>
                </button>
              `).join('')}
            </div>` : ''}
        </div>

        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 class="font-bold text-gray-900 text-sm mb-3"><i class="fas fa-project-diagram text-fypilot-500 mr-2"></i>My Projects</h3>
          <p class="text-3xl font-bold text-gray-900">${projects.length}</p>
          ${projects.length ? `<div class="mt-3 space-y-2 max-h-44 overflow-y-auto">${projects.map(pr => `<button onclick="loadProjectDetail('${pr.id}')" class="w-full text-left p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"><span class="block text-xs font-semibold text-gray-800 truncate">${pr.title}</span></button>`).join('')}</div>` : '<p class="text-[11px] text-gray-400 mt-1">No projects assigned yet.</p>'}
        </div>
      `;
    } else if (me.role === 'supervisor') {
      sections += `
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 class="font-bold text-gray-900 text-sm mb-3"><i class="fas fa-graduation-cap text-fypilot-500 mr-2"></i>Supervision</h3>
          <p class="text-3xl font-bold text-gray-900">${projects.length}</p>
          <p class="text-[11px] text-gray-500 mt-1">Projects currently supervised</p>
          ${projects.length ? `<div class="mt-3 space-y-2 max-h-44 overflow-y-auto">${projects.map(pr => `<button onclick="loadProjectDetail('${pr.id}')" class="w-full text-left p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"><span class="block text-xs font-semibold text-gray-800 truncate">${pr.title}</span></button>`).join('')}</div>` : ''}
        </div>
      `;
    } else {
      sections += `
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 class="font-bold text-gray-900 text-sm mb-3"><i class="fas fa-chart-bar text-fypilot-500 mr-2"></i>Coordinator Overview</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="p-4 rounded-xl bg-purple-50 border border-purple-100 text-center">
              <div class="text-2xl font-bold text-purple-700">${proposals.length}</div>
              <div class="text-[11px] text-purple-600 font-semibold mt-1">Total Proposals</div>
            </div>
            <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
              <div class="text-2xl font-bold text-emerald-700">${groups.length}</div>
              <div class="text-[11px] text-emerald-600 font-semibold mt-1">Student Groups</div>
            </div>
          </div>
          <button onclick="navigate('groups')" class="mt-3 w-full border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors">Review Student Groups</button>
        </div>
      `;
    }

    const expertise = user.expertise ? (() => { try { return JSON.parse(user.expertise); } catch (e) { return []; } })() : [];
    sections = `
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 class="font-bold text-gray-900 text-sm mb-3"><i class="fas fa-id-card text-fypilot-500 mr-2"></i>Personal Information</h3>
        <dl class="space-y-2.5">
          <div class="flex justify-between gap-3"><dt class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Full Name</dt><dd class="text-xs font-semibold text-gray-800 text-right">${user.name || me.name}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Email</dt><dd class="text-xs text-gray-800 text-right break-all">${user.email || me.email}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Role</dt><dd class="text-xs font-semibold text-gray-800 capitalize text-right">${me.role}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Department</dt><dd class="text-xs text-gray-800 text-right">${user.department || me.department || 'Computer Science'}</dd></div>
          ${expertise.length ? `<div class="flex justify-between gap-3"><dt class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Expertise</dt><dd class="text-xs text-gray-800 text-right flex flex-wrap gap-1 justify-end">${expertise.map(e => `<span class="bg-fypilot-50 text-fypilot-700 px-2 py-0.5 rounded-lg text-[10px] font-medium">${e}</span>`).join('')}</dd></div>` : ''}
        </dl>
      </div>
    ` + sections;

    container.innerHTML = sections;
  } catch (e) {
    console.error('Failed to load profile:', e);
  }
}

// ===== Group Modals & Actions =====
async function loadAllStudents() {
  try {
    const res = await api('/groups/available-students');
    state.students = res.data || [];
    return state.students;
  } catch (e) {
    return [];
  }
}

async function showCreateGroupModal() {
  const students = await loadAllStudents();
  const candidates = students.filter(s => s.id !== state.currentUser.id);
  const overlay = document.createElement('div');
  overlay.id = 'group-modal-overlay';
  overlay.className = 'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.innerHTML = `
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in">
    <div class="p-5 border-b border-gray-100 flex items-center justify-between">
      <h3 class="font-bold text-gray-900">Create Student Group</h3>
      <button onclick="closeGroupModal()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-5 space-y-4">
      <div class="bg-fypilot-50 border border-fypilot-100 rounded-xl p-3 text-[11px] text-fypilot-700">
        You will be the <b>group leader</b> and can invite up to <b>3</b> more students (max 4 total). The coordinator must approve the group before your leader submits the joint proposal.
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Group Name *</label>
        <input id="new-group-name" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="e.g. AI Traffic Vision Team" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Select Members <span class="text-gray-400 font-normal">(up to 3)</span></label>
        <div id="group-member-picker" class="mt-2 max-h-60 overflow-y-auto space-y-2">
          ${candidates.length ? candidates.map(s => `
            <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
              <input type="checkbox" class="member-check accent-fypilot-600" value="${s.id}" onchange="updateMemberPicker()" />
              <span class="w-8 h-8 bg-fypilot-100 text-fypilot-700 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">${s.name.charAt(0)}</span>
              <span class="min-w-0">
                <span class="block text-xs font-semibold text-gray-800 truncate">${s.name}</span>
                <span class="block text-[11px] text-gray-500 truncate">${s.email}</span>
              </span>
            </label>
          `).join('') : '<p class="text-xs text-gray-400">No other students available.</p>'}
        </div>
        <p id="group-member-hint" class="text-[11px] text-gray-400 mt-2"></p>
      </div>
      <button onclick="submitCreateGroup()" class="w-full bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-fypilot-500/20 transition-all"><i class="fas fa-users mr-1"></i>Create Group</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  updateMemberPicker();
}

function closeGroupModal() {
  const el = document.getElementById('group-modal-overlay');
  if (el) el.remove();
}

function updateMemberPicker() {
  const checks = [...document.querySelectorAll('.member-check')];
  const hint = document.getElementById('group-member-hint');
  const selected = checks.filter(c => c.checked);
  if (hint) hint.textContent = `${selected.length}/3 selected. Group will have ${selected.length + 1}/4 members.`;
  checks.forEach(c => {
    if (!c.checked && selected.length >= 3) { c.disabled = true; c.closest('label').classList.add('opacity-40', 'pointer-events-none'); }
    else { c.disabled = false; c.closest('label').classList.remove('opacity-40', 'pointer-events-none'); }
  });
}

async function submitCreateGroup() {
  const name = document.getElementById('new-group-name').value.trim();
  if (!name) { showToast('Enter a group name', 'error'); return; }
  const memberIds = [...document.querySelectorAll('.member-check:checked')].map(c => c.value);
  try {
    const res = await api('/groups', { method: 'POST', body: JSON.stringify({ name, memberIds }) });
    showToast(res.message || 'Group created!', 'success');
    closeGroupModal();
    navigate('groups');
    loadGroups();
  } catch (e) { /* handled by api helper */ }
}

async function showAddMemberModal(groupId) {
  const students = await loadAllStudents();
  const existingIds = ((state.selectedGroup && state.selectedGroup.members) || []).map(m => m.id);
  const candidates = students.filter(s => !existingIds.includes(s.id));
  if (candidates.length === 0) { showToast('No more students available to add.', 'warning'); return; }
  const overlay = document.createElement('div');
  overlay.id = 'group-modal-overlay';
  overlay.className = 'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.innerHTML = `
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto fade-in">
    <div class="p-5 border-b border-gray-100 flex items-center justify-between">
      <h3 class="font-bold text-gray-900">Add Group Member</h3>
      <button onclick="closeGroupModal()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-5 space-y-4">
      <div class="mt-2 max-h-60 overflow-y-auto space-y-2">
        ${candidates.length ? candidates.map(s => `
          <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
            <input type="radio" name="add-member-radio" class="add-member-radio accent-fypilot-600" value="${s.id}" />
            <span class="w-8 h-8 bg-fypilot-100 text-fypilot-700 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">${s.name.charAt(0)}</span>
            <span class="min-w-0">
              <span class="block text-xs font-semibold text-gray-800 truncate">${s.name}</span>
              <span class="block text-[11px] text-gray-500 truncate">${s.email}</span>
            </span>
          </label>
        `).join('') : '<p class="text-xs text-gray-400">No more students available.</p>'}
      </div>
      <button onclick="submitAddMember('${groupId}')" class="w-full bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all"><i class="fas fa-user-plus mr-1"></i>Add Member</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitAddMember(groupId) {
  const radio = document.querySelector('.add-member-radio:checked');
  if (!radio) { showToast('Select a student to add', 'error'); return; }
  try {
    const res = await api(`/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ user_id: radio.value }) });
    showToast(res.message || 'Member added!', 'success');
    closeGroupModal();
    loadGroupDetail(groupId);
  } catch (e) { /* handled by api helper */ }
}

async function showChangeLeaderModal(groupId) {
  const g = state.selectedGroup;
  const members = (g && g.members) || [];
  if (members.length < 2) { showToast('Only one member in this group.', 'warning'); return; }
  const overlay = document.createElement('div');
  overlay.id = 'group-modal-overlay';
  overlay.className = 'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.innerHTML = `
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto fade-in">
    <div class="p-5 border-b border-gray-100 flex items-center justify-between">
      <h3 class="font-bold text-gray-900">Change Group Leader</h3>
      <button onclick="closeGroupModal()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-5 space-y-4">
      <p class="text-xs text-gray-500">Select the new leader from the group members. The current leader (${g.leader_name || 'Unknown'}) will become a regular member.</p>
      <div class="mt-2 max-h-60 overflow-y-auto space-y-2">
        ${members.map(m => `
          <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors ${m.is_leader ? 'opacity-50 pointer-events-none' : ''}">
            <input type="radio" name="leader-radio" class="leader-radio accent-amber-500" value="${m.id}" ${m.is_leader ? 'disabled' : ''} />
            <span class="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">${m.name.charAt(0)}</span>
            <span class="min-w-0">
              <span class="block text-xs font-semibold text-gray-800 truncate">${m.name}${m.is_leader ? ' <span class="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold uppercase">Current Leader</span>' : ''}</span>
              <span class="block text-[11px] text-gray-500 truncate">${m.email}</span>
            </span>
          </label>
        `).join('')}
      </div>
      <button onclick="submitChangeLeader('${groupId}')" class="w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all"><i class="fas fa-crown mr-1"></i>Make Leader</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

async function submitChangeLeader(groupId) {
  const radio = document.querySelector('.leader-radio:checked');
  if (!radio) { showToast('Select a new leader', 'error'); return; }
  try {
    const res = await api(`/groups/${groupId}/leader`, { method: 'PUT', body: JSON.stringify({ leader_id: radio.value }) });
    showToast(res.message || 'Leader updated!', 'success');
    closeGroupModal();
    loadGroupDetail(groupId);
  } catch (e) { /* handled by api helper */ }
}

async function approveGroup(id) {
  try {
    const res = await api(`/groups/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) });
    showToast(res.message || 'Group approved', 'success');
    if (state.currentView === 'group-profile') loadGroupDetail(id); else loadGroups();
  } catch (e) { /* handled by api helper */ }
}

async function rejectGroup(id) {
  try {
    const res = await api(`/groups/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'rejected' }) });
    showToast(res.message || 'Group rejected', 'warning');
    if (state.currentView === 'group-profile') loadGroupDetail(id); else loadGroups();
  } catch (e) { /* handled by api helper */ }
}

async function removeGroupMember(groupId, userId) {
  if (!confirm('Remove this member from the group?')) return;
  try {
    const res = await api(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
    showToast(res.message || 'Member removed', 'success');
    loadGroupDetail(groupId);
  } catch (e) { /* handled by api helper */ }
}

async function deleteGroup(id) {
  if (!confirm('Delete this group? All members will be removed from the group. This cannot be undone.')) return;
  try {
    const res = await api(`/groups/${id}`, { method: 'DELETE' });
    showToast(res.message || 'Group deleted', 'success');
    navigate('groups');
    loadGroups();
  } catch (e) { /* handled by api helper */ }
}

// ===== New Proposal Form =====
function showNewProposalForm() {
  if (!state.currentUser || state.currentUser.role !== 'student') {
    showToast('Only students can submit proposals.', 'error');
    return;
  }

  const g = state.myGroup;
  if (!g) {
    showToast('Create a group first. Only the leader of an approved group can submit a proposal.', 'error');
    navigate('groups');
    return;
  }
  if (g.status !== 'approved') {
    showToast(`Your group "${g.name}" is ${g.status}. Wait for coordinator approval before submitting.`, 'warning');
    return;
  }
  if (g.leader_id !== state.currentUser.id) {
    showToast('Only the group leader can submit the proposal.', 'error');
    return;
  }

  const container = document.getElementById('proposals-list');
  if (!container) return;

  container.innerHTML = `
  <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm fade-in max-w-2xl mx-auto">
    <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs text-emerald-700 flex items-start gap-2">
      <i class="fas fa-users mt-0.5"></i>
      <span>Submitting on behalf of group <b>"${g.name}"</b> — this proposal will cover all group members.</span>
    </div>
    <h2 class="text-lg font-bold text-gray-900 mb-4">Submit New FYP Proposal</h2>
    <form id="new-proposal-form" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Project Title *</label>
        <input name="title" required class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="e.g. AI-Powered Smart Traffic System" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Abstract</label>
        <textarea name="abstract" rows="3" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="Brief summary of your project"></textarea>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Problem Statement</label>
        <textarea name="problem_statement" rows="2" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="What specific problem does this solve?"></textarea>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Objectives</label>
        <textarea name="objectives" rows="2" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="List key objectives"></textarea>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Methodology & Tech Stack</label>
        <input name="technologies" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" placeholder="e.g. Python, PyTorch, React, Node.js" />
      </div>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-fypilot-500/20 transition-all">Submit Proposal</button>
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

// ===== Chat Module (WhatsApp-style 1:1 Messaging) =====
function canChatWith(fromRole, toRole) {
  if (!fromRole || !toRole) return false;
  if (fromRole === 'coordinator') return true;
  if (fromRole === 'supervisor') return toRole === 'student' || toRole === 'coordinator';
  if (fromRole === 'student') return toRole === 'supervisor' || toRole === 'coordinator';
  return false;
}

function chatRoleColor(role) {
  return { coordinator: 'from-purple-500 to-indigo-600', supervisor: 'from-blue-500 to-fypilot-600', student: 'from-emerald-500 to-teal-600' }[role] || 'from-gray-500 to-gray-600';
}

function chatAvatar(p, size = 'w-10 h-10 text-sm') {
  const fallback = escapeHtml((p.name || '?').charAt(0).toUpperCase());
  if (p.avatar) {
    return `<div class="${size} rounded-xl overflow-hidden shrink-0 shadow-sm"><img src="${p.avatar}" alt="" class="w-full h-full object-cover" /></div>`;
  }
  return `<div class="${size} rounded-xl bg-gradient-to-br ${chatRoleColor(p.role)} text-white flex items-center justify-center font-bold shrink-0 shadow-sm">${fallback}</div>`;
}

function chatMessagePreview(lm) {
  if (lm.type === 'image') return '📷 Photo';
  if (lm.type === 'voice') return '🎤 Voice message';
  if (lm.type === 'file') return '📎 File';
  return escapeHtml((lm.content || '').slice(0, 60));
}

function chatReplyPreview(reply) {
  if (!reply) return '';
  if (reply.type === 'image') return '📷 Photo';
  if (reply.type === 'voice') return '🎤 Voice message';
  if (reply.type === 'file') return '📎 File';
  return escapeHtml(reply.content || 'Message');
}

function parseChatDate(ts) {
  return new Date(String(ts || '').replace(' ', 'T') + 'Z');
}

function fmtChatTime(ts) {
  const d = parseChatDate(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtChatDay(ts) {
  const d = parseChatDate(ts);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatChatDuration(sec) {
  sec = Math.max(1, Math.floor(sec || 1));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// ===== Chat View =====
function renderChats() {
  const hasActive = !!state.activeChat;
  return `
  <div class="fade-in">
    <div class="flex bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden h-[calc(100vh-8rem)] min-h-[480px]">
      <!-- Conversation List -->
      <div class="${hasActive ? 'hidden sm:flex' : 'flex'} w-full sm:w-80 lg:w-[22rem] flex-col border-r border-gray-100 bg-gray-50/60">
        <div class="p-4 pb-3 bg-white border-b border-gray-100">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h2 class="text-lg font-bold text-gray-900">Chats</h2>
              <p class="text-xs text-gray-500">Real-time conversations</p>
            </div>
            <button onclick="openNewChatModal()" title="New chat" class="w-10 h-10 rounded-xl bg-gradient-to-br from-fypilot-600 to-indigo-600 text-white shadow-lg shadow-fypilot-500/25 hover:scale-105 transition-all flex items-center justify-center">
              <i class="fas fa-pen-to-square text-sm"></i>
            </button>
          </div>
          <div class="relative">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            <input id="chat-search-input" oninput="setChatSearch(this.value)" value="${escapeHtml(state.chatListSearch)}" placeholder="Search chats..." class="w-full pl-9 pr-8 py-2.5 bg-gray-100 border border-transparent focus:bg-white focus:border-fypilot-300 focus:ring-2 focus:ring-fypilot-500/20 rounded-xl text-sm outline-none transition-all" />
            ${state.chatListSearch ? `<button onclick="setChatSearch('')" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><i class="fas fa-times-circle text-xs"></i></button>` : ''}
          </div>
        </div>
        <div id="chat-list" class="flex-1 overflow-y-auto chat-scroll">
          ${renderChatList()}
        </div>
      </div>
      <!-- Conversation Window -->
      <div class="${hasActive ? 'flex' : 'hidden sm:flex'} flex-1 flex-col min-w-0">
        ${hasActive ? renderChatHeader() + renderChatMessagesArea() + renderChatComposer() : renderChatEmptyState()}
      </div>
    </div>
    <input type="file" id="chat-image-input" accept="image/*" class="hidden" onchange="handleChatImagePick(event)" />
  </div>`;
}

function renderChatList() {
  if (!state.chats.length) {
    return `<div class="p-8 text-center">
      <div class="w-16 h-16 mx-auto rounded-2xl bg-fypilot-50 text-fypilot-500 flex items-center justify-center mb-3"><i class="fas fa-comments text-2xl"></i></div>
      <p class="text-sm font-semibold text-gray-600">No conversations yet</p>
      <p class="text-xs text-gray-400 mt-1">Start a chat with your supervisor or coordinator</p>
      <button onclick="openNewChatModal()" class="mt-4 bg-fypilot-600 hover:bg-fypilot-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-fypilot-500/20">New Chat</button>
    </div>`;
  }
  const q = (state.chatListSearch || '').toLowerCase();
  const list = state.chats.filter(c => !q || (c.peer.name || '').toLowerCase().includes(q));
  if (!list.length) return `<div class="p-8 text-center text-sm text-gray-400">No chats match "${escapeHtml(state.chatListSearch)}"</div>`;
  return list.map(c => {
    const active = state.activeChat && state.activeChat.id === c.id;
    const lm = c.last_message;
    const preview = lm ? chatMessagePreview(lm) : 'Say hello 👋';
    const time = lm ? fmtChatTime(lm.created_at) : '';
    return `
    <button onclick="openChat('${c.id}')" class="w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-white transition-colors border-b border-gray-50 ${active ? 'bg-white shadow-sm' : ''}">
      ${chatAvatar(c.peer)}
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold text-sm text-gray-900 truncate">${escapeHtml(c.peer.name)}</span>
          <span class="text-[10px] text-gray-400 shrink-0">${time}</span>
        </div>
        <div class="flex items-center justify-between gap-2 mt-0.5">
          <span class="text-xs ${lm && lm.is_mine ? 'text-gray-500' : 'text-gray-400'} truncate">${lm && lm.is_mine ? '<i class="fas fa-check-double mr-1 text-[9px] text-fypilot-500"></i>' : ''}${preview}</span>
          <div class="flex items-center gap-1 shrink-0">
            ${c.pinned_count ? '<i class="fas fa-thumbtack text-[10px] text-amber-500"></i>' : ''}
            ${c.unread ? `<span class="min-w-5 h-5 px-1.5 rounded-full bg-fypilot-600 text-white text-[10px] font-bold flex items-center justify-center">${c.unread}</span>` : ''}
          </div>
        </div>
      </div>
    </button>`;
  }).join('');
}

function renderChatEmptyState() {
  return `
  <div class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-slate-50 via-fypilot-50/50 to-indigo-50/50">
    <div class="w-24 h-24 rounded-3xl bg-gradient-to-br from-fypilot-500 to-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-fypilot-500/30 mb-5">
      <i class="fas fa-comments text-4xl"></i>
    </div>
    <h3 class="text-xl font-bold text-gray-900">FYPilot Messenger</h3>
    <p class="text-sm text-gray-500 mt-1 max-w-sm">Chat with your supervisor and coordinator — send messages, photos, voice notes, reply, pin and more.</p>
    <button onclick="openNewChatModal()" class="mt-6 bg-gradient-to-br from-fypilot-600 to-indigo-600 hover:scale-105 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-xl shadow-fypilot-500/25 transition-all">
      <i class="fas fa-pen-to-square mr-2"></i>Start a new chat
    </button>
  </div>`;
}

function renderChatHeader() {
  const p = state.activeChat.peer;
  return `
  <div class="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm z-10">
    <button onclick="closeChatOnMobile()" class="sm:hidden w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 flex items-center justify-center"><i class="fas fa-arrow-left"></i></button>
    ${chatAvatar(p, 'w-11 h-11 text-base')}
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <h3 class="font-bold text-gray-900 truncate">${escapeHtml(p.name)}</h3>
        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider capitalize ${p.role === 'coordinator' ? 'bg-purple-100 text-purple-700' : p.role === 'supervisor' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}">${p.role}</span>
      </div>
      <p class="text-xs text-emerald-500 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Online · ${escapeHtml(p.department || '')}</p>
    </div>
    <button onclick="openPinnedChatMessages()" title="Pinned messages" class="w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 flex items-center justify-center relative">
      <i class="fas fa-thumbtack"></i>
      ${state.activeChat.pinned_count ? `<span class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">${state.activeChat.pinned_count}</span>` : ''}
    </button>
    <button onclick="openNewChatModal()" title="New chat" class="w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 flex items-center justify-center"><i class="fas fa-pen-to-square"></i></button>
  </div>`;
}

function renderChatMessagesArea() {
  return `
  <div id="chat-messages" class="flex-1 overflow-y-auto chat-scroll px-3 sm:px-5 py-4 bg-gradient-to-br from-slate-50 via-fypilot-50/50 to-indigo-50/50" onscroll="onChatScroll()">
    ${renderChatMessages()}
  </div>`;
}

function renderChatMessages() {
  const msgs = state.chatMessages;
  if (!msgs.length) {
    return `<div class="h-full flex flex-col items-center justify-center text-center py-16">
      <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-fypilot-500 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-fypilot-500/25 mb-4"><i class="fas fa-hand-sparkles text-3xl"></i></div>
      <p class="font-bold text-gray-700">Say hello to ${escapeHtml(state.activeChat.peer.name)} 👋</p>
      <p class="text-xs text-gray-400 mt-1 max-w-xs">Send a message to start the conversation.</p>
    </div>`;
  }
  let html = '';
  let lastDay = '';
  const pinned = msgs.filter(m => m.is_pinned);
  if (pinned.length) {
    html += `<div class="mb-2"><button onclick="openPinnedChatMessages()" class="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-amber-800 flex items-center gap-2 transition-colors">
      <i class="fas fa-thumbtack text-amber-500"></i><span class="font-bold">${pinned.length} pinned message${pinned.length > 1 ? 's' : ''}</span><span class="ml-auto text-amber-500 text-[10px] font-semibold">View</span></button></div>`;
  }
  msgs.forEach(m => {
    const day = fmtChatDay(m.created_at);
    if (day !== lastDay) {
      html += `<div class="flex justify-center my-3"><span class="px-3 py-1 rounded-full bg-white/80 border border-gray-200 text-[10px] font-semibold text-gray-500 shadow-sm">${day}</span></div>`;
      lastDay = day;
    }
    html += renderChatMessage(m);
  });
  return html;
}

function renderChatMessage(m) {
  const me = state.currentUser.id;
  const mine = m.sender_id === me;
  const body = chatMessageBody(m);
  const reply = m.reply ? `<div class="border-l-4 ${mine ? 'border-white/50 bg-white/15' : 'border-fypilot-400 bg-fypilot-50'} rounded-lg pl-2 pr-2 py-1 mb-1.5">
    <span class="text-[10px] font-bold ${mine ? 'text-white/90' : 'text-fypilot-600'}">${escapeHtml(m.reply.sender_name)}</span>
    <p class="text-[11px] truncate ${mine ? 'text-white/85' : 'text-gray-500'}">${chatReplyPreview(m.reply)}</p></div>` : '';
  const actions = `
    <div class="opacity-0 group-hover:opacity-100 transition-opacity absolute ${mine ? '-top-4 right-1' : '-top-4 left-1'} flex items-center gap-0.5 bg-white rounded-lg shadow-lg px-1 py-0.5 border border-gray-100 z-20">
      <button onclick="replyToChatMessage('${m.id}')" title="Reply" class="w-7 h-7 rounded-md hover:bg-gray-100 text-gray-600 flex items-center justify-center"><i class="fas fa-reply text-[10px]"></i></button>
      <button onclick="togglePinChatMessage('${m.id}')" title="${m.is_pinned ? 'Unpin' : 'Pin'}" class="w-7 h-7 rounded-md hover:bg-gray-100 ${m.is_pinned ? 'text-amber-500' : 'text-gray-600'} flex items-center justify-center"><i class="fas fa-thumbtack text-[10px]"></i></button>
      ${mine ? `<button onclick="editChatMessage('${m.id}')" title="Edit" class="w-7 h-7 rounded-md hover:bg-gray-100 text-gray-600 flex items-center justify-center"><i class="fas fa-pen text-[10px]"></i></button>
      <button onclick="deleteChatMessage('${m.id}')" title="Delete" class="w-7 h-7 rounded-md hover:bg-red-50 text-red-500 flex items-center justify-center"><i class="fas fa-trash text-[10px]"></i></button>` : ''}
    </div>`;
  const ticks = mine ? (m.read_at ? '<i class="fas fa-check-double text-fypilot-300"></i>' : '<i class="fas fa-check-double text-gray-300"></i>') : '';
  const time = `${fmtChatTime(m.created_at)}${m.is_edited ? ' · edited' : ''}`;
  const pinTag = m.is_pinned ? `<i class="fas fa-thumbtack text-[10px] ${mine ? 'text-white/80' : 'text-amber-500'} ml-1"></i>` : '';

  if (mine) {
    return `
    <div class="flex justify-end mb-1 group relative">
      <div class="relative max-w-[78%] sm:max-w-[62%]">
        ${actions}
        <div class="bg-gradient-to-br from-fypilot-600 to-indigo-600 text-white rounded-2xl rounded-tr-md px-3.5 py-2 shadow-md shadow-fypilot-500/10 relative">
          ${reply}
          ${body}
          <div class="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-white/70">
            ${time}${pinTag}${ticks}
          </div>
        </div>
      </div>
    </div>`;
  }
  return `
  <div class="flex items-end gap-2 mb-1 group relative">
    <div class="shrink-0 self-end mb-1">${chatAvatar({ name: m.sender_name, role: m.sender_role, avatar: m.sender_avatar }, 'w-7 h-7 text-[10px]')}</div>
    <div class="relative max-w-[78%] sm:max-w-[62%]">
      ${actions}
      <div class="bg-white border border-gray-100 rounded-2xl rounded-tl-md px-3.5 py-2 shadow-sm relative">
        ${reply}
        ${body}
        <div class="flex items-center justify-start gap-1 mt-0.5 text-[10px] text-gray-400">
          ${time}${pinTag}
        </div>
      </div>
    </div>
  </div>`;
}

function chatMessageBody(m) {
  if (m.type === 'text') return `<p class="text-sm whitespace-pre-wrap break-words leading-relaxed">${escapeHtml(m.content)}</p>`;
  if (m.type === 'image') {
    return `<div>
      <img src="${m.media_data}" alt="photo" onclick="openChatImage('${m.id}')" class="max-h-72 max-w-full rounded-xl cursor-zoom-in border border-black/5" />
      ${m.content ? `<p class="text-sm mt-1.5 whitespace-pre-wrap break-words">${escapeHtml(m.content)}</p>` : ''}
    </div>`;
  }
  if (m.type === 'voice') return renderVoicePlayer(m);
  return `<div class="flex items-center gap-3 min-w-[220px]">
    <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><i class="fas fa-file text-lg"></i></div>
    <div class="min-w-0"><p class="text-sm font-semibold truncate">${escapeHtml(m.content || 'Attachment')}</p><p class="text-[10px] opacity-75">${escapeHtml(m.media_mime || 'file')}</p></div>
  </div>`;
}

// ===== Voice Player =====
function chatEqBars(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  let bars = '';
  for (let i = 0; i < 24; i++) {
    h = (h * 17 + i * 13 + 5) % 24 + 4;
    bars += `<div class="eq-bar flex-1 rounded-full bg-current opacity-80" style="height:${h * 4}%"></div>`;
  }
  return bars;
}

function renderVoicePlayer(m) {
  const playing = state.chatVoicePlaying === m.id;
  const mine = m.sender_id === state.currentUser.id;
  return `
  <div class="flex items-center gap-3 min-w-[230px] py-0.5">
    <button onclick="toggleVoicePlayer('${m.id}')" class="w-10 h-10 rounded-full ${mine ? 'bg-white/20 hover:bg-white/30' : 'bg-fypilot-50 hover:bg-fypilot-100'} flex items-center justify-center shrink-0 transition-all shadow-inner">
      <i id="vp-icon-${m.id}" class="fas ${playing ? 'fa-pause' : 'fa-play'} text-sm ${mine ? '' : 'text-fypilot-600'} ${playing ? '' : 'ml-0.5'}"></i>
    </button>
    <div class="flex-1 min-w-0">
      <div id="vp-bars-${m.id}" class="flex items-end gap-[2px] h-7 ${playing ? 'chat-voice-playing' : ''}">
        ${chatEqBars(m.id)}
      </div>
      <div class="flex items-center justify-between mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-gray-400'}">
        <span>${formatChatDuration(m.media_duration || 1)}</span>
        <span>${playing ? 'playing' : 'voice message'}</span>
      </div>
    </div>
  </div>`;
}

let chatVoiceAudio = null;

function getChatVoiceAudio() {
  if (!chatVoiceAudio) {
    chatVoiceAudio = new Audio();
    chatVoiceAudio.preload = 'metadata';
    chatVoiceAudio.onended = () => {
      const id = state.chatVoicePlaying;
      state.chatVoicePlaying = null;
      if (id) syncVoiceUI(id, false);
    };
  }
  return chatVoiceAudio;
}

function toggleVoicePlayer(id) {
  const m = state.chatMessages.find(x => x.id === id);
  if (!m || !m.media_data) return;
  const audio = getChatVoiceAudio();
  if (state.chatVoicePlaying === id) {
    audio.pause();
    audio.currentTime = 0;
    state.chatVoicePlaying = null;
    syncVoiceUI(id, false);
    return;
  }
  if (state.chatVoicePlaying) syncVoiceUI(state.chatVoicePlaying, false);
  state.chatVoicePlaying = id;
  audio.src = m.media_data;
  audio.play().catch(() => {
    if (state.chatVoicePlaying === id) {
      state.chatVoicePlaying = null;
      syncVoiceUI(id, false);
    }
  });
  syncVoiceUI(id, true);
}

function syncVoiceUI(id, playing) {
  const icon = document.getElementById('vp-icon-' + id);
  const bars = document.getElementById('vp-bars-' + id);
  if (icon) icon.className = `fas ${playing ? 'fa-pause' : 'fa-play'} text-sm ${playing ? '' : 'ml-0.5'}`;
  if (bars) bars.classList.toggle('chat-voice-playing', playing);
}

// ===== Chat Composer =====
const CHAT_EMOJIS = ['😀', '😂', '😊', '😍', '😎', '🤔', '👍', '👏', '🙏', '🔥', '❤️', '💯', '🎉', '👌', '✌️', '🤝'];

function renderChatComposer() {
  return `<div id="chat-composer" class="border-t border-gray-100 bg-white px-3 py-3">${renderChatComposerInner()}</div>`;
}

function renderChatComposerInner() {
  const replying = state.chatReplyingTo;
  const editing = state.chatEditing;
  const pending = state.chatPendingMedia;
  let bars = '';
  if (state.chatRecording) {
    bars = `
    <div class="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
      <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
      <span class="text-xs font-bold text-red-600">Recording voice message...</span>
      <span id="chat-rec-timer" class="text-xs font-semibold text-red-500">0:00</span>
      <button onclick="stopChatVoice(true)" class="ml-auto text-xs font-semibold text-gray-500 hover:text-gray-700"><i class="fas fa-times mr-1"></i>Cancel</button>
      <button onclick="stopChatVoice(false)" class="text-xs font-bold text-emerald-600"><i class="fas fa-paper-plane mr-1"></i>Send</button>
    </div>`;
  } else if (editing) {
    bars = `
    <div class="flex items-center gap-2 bg-fypilot-50 border border-fypilot-200 rounded-xl px-3 py-2 mb-2">
      <i class="fas fa-pen text-fypilot-500 text-xs"></i>
      <div class="flex-1 min-w-0">
        <span class="text-[10px] font-bold text-fypilot-600">Editing message</span>
        <input id="chat-edit-input" value="${escapeHtml(editing.content)}" class="w-full bg-transparent text-sm outline-none" onkeydown="if(event.key==='Enter'){event.preventDefault();saveChatEdit();}" />
      </div>
      <button onclick="cancelChatEdit()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xs"></i></button>
      <button onclick="saveChatEdit()" class="bg-fypilot-600 hover:bg-fypilot-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg"><i class="fas fa-check mr-1"></i>Save</button>
    </div>`;
  } else if (replying) {
    bars = `
    <div class="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 mb-2">
      <i class="fas fa-reply text-fypilot-500 text-xs"></i>
      <div class="flex-1 min-w-0">
        <span class="text-[10px] font-bold text-fypilot-600">${escapeHtml(replying.sender_name)}</span>
        <p class="text-xs text-gray-600 truncate">${chatReplyPreview({ type: replying.type, content: replying.content })}</p>
      </div>
      <button onclick="cancelChatReply()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xs"></i></button>
    </div>`;
  }
  const mediaBar = pending ? `
    <div class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-2">
      <img src="${pending.data}" class="w-10 h-10 rounded-lg object-cover" alt="preview" />
      <div class="flex-1"><span class="text-xs font-semibold text-gray-700">Photo ready</span><p class="text-[10px] text-gray-400">Add a caption below and send</p></div>
      <button onclick="clearChatPendingMedia()" class="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-200 flex items-center justify-center"><i class="fas fa-times text-xs"></i></button>
    </div>` : '';
  const recorderBtn = state.chatRecording
    ? `<button onclick="stopChatVoice(false)" title="Send voice" class="w-11 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center"><i class="fas fa-paper-plane text-sm"></i></button>`
    : `<button onclick="startChatVoice()" title="Record voice message" class="w-11 h-11 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-fypilot-600 flex items-center justify-center"><i class="fas fa-microphone text-lg"></i></button>`;
  return `
    ${bars}
    ${mediaBar}
    <div class="relative">
      <div id="chat-emoji-picker" class="hidden absolute bottom-full mb-2 left-0 z-30 bg-white border border-gray-100 rounded-2xl shadow-2xl p-3 w-72">
        <div class="grid grid-cols-8 gap-1">
          ${CHAT_EMOJIS.map(e => `<button onclick="insertChatEmoji('${e}')" class="text-xl hover:scale-125 transition-transform">${e}</button>`).join('')}
        </div>
      </div>
      <div class="flex items-end gap-2">
        <button onclick="openChatImagePicker()" title="Send photo" class="w-11 h-11 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-fypilot-600 flex items-center justify-center shrink-0"><i class="fas fa-image text-lg"></i></button>
        <button onclick="toggleChatEmojiPicker()" title="Emoji" class="w-11 h-11 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-fypilot-600 flex items-center justify-center shrink-0"><i class="fas fa-face-smile text-lg"></i></button>
        <textarea id="chat-input" rows="1" placeholder="Type a message..." class="flex-1 resize-none border border-gray-200 bg-gray-50 focus:bg-white focus:border-fypilot-300 focus:ring-2 focus:ring-fypilot-500/20 rounded-2xl px-4 py-2.5 text-sm outline-none transition-all chat-scroll" oninput="autoGrowChatInput(this)" onkeydown="handleChatKeydown(event)"></textarea>
        ${state.chatRecording ? '' : recorderBtn}
        ${state.chatRecording ? '' : `<button onclick="sendChatMessage()" title="Send" class="w-11 h-11 rounded-xl bg-gradient-to-br from-fypilot-600 to-indigo-600 hover:scale-105 text-white shadow-lg shadow-fypilot-500/25 flex items-center justify-center transition-all shrink-0"><i class="fas fa-paper-plane text-sm"></i></button>`}
      </div>
    </div>`;
}

function renderChatComposerOnly() {
  const el = document.getElementById('chat-composer');
  if (el) el.innerHTML = renderChatComposerInner();
}

function autoGrowChatInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (state.chatRecording) { stopChatVoice(false); return; }
    sendChatMessage();
  }
}

function toggleChatEmojiPicker() {
  const p = document.getElementById('chat-emoji-picker');
  if (p) p.classList.toggle('hidden');
}

function hideChatEmojiPicker() {
  const p = document.getElementById('chat-emoji-picker');
  if (p) p.classList.add('hidden');
}

function insertChatEmoji(e) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value += e;
  input.focus();
  autoGrowChatInput(input);
}

function focusChatInput() {
  const el = document.getElementById('chat-input');
  if (el) el.focus();
}

// ===== Chat Actions =====
async function loadChats(silent) {
  try {
    const res = await api('/chats', { silentError: !!silent });
    state.chats = res.data;
    if (state.activeChat) {
      const cur = state.chats.find(c => c.id === state.activeChat.id);
      if (cur) {
        state.activeChat.unread = 0;
        state.activeChat.pinned_count = cur.pinned_count;
      }
    }
    updateNavChatBadge();
    const listEl = document.getElementById('chat-list');
    if (listEl) listEl.innerHTML = renderChatList();
  } catch (e) {}
}

function updateNavChatBadge() {
  const total = state.chats.reduce((s, c) => s + (c.unread || 0), 0);
  ['nav-chat-badge', 'nav-chat-badge-m'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (total > 0) {
      el.textContent = total > 99 ? '99+' : total;
      el.classList.remove('hidden');
      el.classList.add('flex');
    } else {
      el.classList.add('hidden');
      el.classList.remove('flex');
    }
  });
}

async function openChat(chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;
  state.activeChat = chat;
  state.chatMessages = [];
  state.chatReplyingTo = null;
  state.chatEditing = null;
  state.chatPendingMedia = null;
  render();
  await loadChatMessages(chatId);
  chatScrollToBottom(true);
}

async function loadChatMessages(chatId, opts) {
  const silent = opts && opts.silent;
  const after = opts && opts.after;
  const atBottomBefore = state.chatAtBottom;
  try {
    const query = after ? `?after=${after}&mark_read=1` : '?mark_read=1';
    const res = await api(`/chats/${chatId}/messages${query}`, { silentError: !!silent });
    let newCount = 0;
    if (after) {
      const seen = new Set(state.chatMessages.map(m => m.id));
      res.data.forEach(m => { if (!seen.has(m.id)) { state.chatMessages.push(m); newCount++; } });
      state.chatMessages.sort((a, b) => a.seq - b.seq);
    } else {
      const prevKey = msgSyncKey(state.chatMessages);
      const nextKey = msgSyncKey(res.data);
      if (prevKey === nextKey) return;
      state.chatMessages = res.data;
      newCount = res.data.length;
    }
    if (state.activeChat && state.activeChat.id === chatId) {
      const el = document.getElementById('chat-messages');
      if (el && (newCount > 0 || !after)) {
        el.innerHTML = renderChatMessages();
        if (state.chatVoicePlaying) syncVoiceUI(state.chatVoicePlaying, true);
        if (after) chatScrollToBottom(atBottomBefore);
        else chatScrollToBottom(true);
      }
    }
  } catch (e) {}
}

function msgSyncKey(msgs) {
  if (!msgs || !msgs.length) return '';
  return msgs.map(m => `${m.id}:${m.content}:${m.is_pinned ? 1 : 0}:${m.is_edited ? 1 : 0}:${m.read_at || ''}`).join('|');
}

async function sendChatMessage() {
  if (!state.activeChat) return;
  const input = document.getElementById('chat-input');
  const text = input ? input.value.trim() : '';
  const replyToId = state.chatReplyingTo ? state.chatReplyingTo.id : null;
  try {
    if (state.chatPendingMedia) {
      await api(`/chats/${state.activeChat.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ type: 'image', content: text || null, media_data: state.chatPendingMedia.data, media_mime: state.chatPendingMedia.mime, reply_to_id: replyToId })
      });
      state.chatPendingMedia = null;
    } else if (text) {
      await api(`/chats/${state.activeChat.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ type: 'text', content: text, reply_to_id: replyToId })
      });
    } else {
      return;
    }
  } catch (e) { return; }
  if (input) { input.value = ''; autoGrowChatInput(input); }
  state.chatReplyingTo = null;
  state.chatEditing = null;
  hideChatEmojiPicker();
  await loadChatMessages(state.activeChat.id);
  chatScrollToBottom(true);
  loadChats(true);
}

function replyToChatMessage(id) {
  const m = state.chatMessages.find(x => x.id === id);
  if (!m) return;
  state.chatEditing = null;
  state.chatReplyingTo = m;
  renderChatComposerOnly();
  focusChatInput();
}

function cancelChatReply() {
  state.chatReplyingTo = null;
  renderChatComposerOnly();
  focusChatInput();
}

function editChatMessage(id) {
  const m = state.chatMessages.find(x => x.id === id);
  if (!m) return;
  state.chatReplyingTo = null;
  state.chatEditing = m;
  renderChatComposerOnly();
  const input = document.getElementById('chat-edit-input');
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function cancelChatEdit() {
  state.chatEditing = null;
  renderChatComposerOnly();
}

async function saveChatEdit() {
  if (!state.activeChat || !state.chatEditing) return;
  const val = (document.getElementById('chat-edit-input') || {}).value || '';
  const content = val.trim();
  if (!content) { showToast('Message cannot be empty', 'error'); return; }
  try {
    await api(`/chats/${state.activeChat.id}/messages/${state.chatEditing.id}/edit`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    state.chatEditing = null;
    await loadChatMessages(state.activeChat.id);
    showToast('Message updated', 'success');
  } catch (e) {}
}

async function deleteChatMessage(id) {
  if (!state.activeChat) return;
  if (!confirm('Delete this message?')) return;
  try {
    await api(`/chats/${state.activeChat.id}/messages/${id}`, { method: 'DELETE' });
    state.chatMessages = state.chatMessages.filter(m => m.id !== id);
    const el = document.getElementById('chat-messages');
    if (el) el.innerHTML = renderChatMessages();
    loadChats(true);
    showToast('Message deleted', 'success');
  } catch (e) {}
}

async function togglePinChatMessage(id) {
  const m = state.chatMessages.find(x => x.id === id);
  if (!m || !state.activeChat) return;
  const action = m.is_pinned ? 'unpin' : 'pin';
  try {
    await api(`/chats/${state.activeChat.id}/messages/${id}/${action}`, { method: 'POST' });
    showToast(m.is_pinned ? 'Message unpinned' : 'Message pinned', 'success');
    await loadChatMessages(state.activeChat.id);
    loadChats(true);
  } catch (e) {}
}

// ===== Media: Images & Voice =====
function openChatImagePicker() {
  const input = document.getElementById('chat-image-input');
  if (input) input.click();
}

function handleChatImagePick(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please choose an image file', 'error'); return; }
  if (file.size > 1.2 * 1024 * 1024) { showToast('Image too large (max 1.2MB)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    state.chatPendingMedia = { type: 'image', data: reader.result, mime: file.type };
    renderChatComposerOnly();
    focusChatInput();
  };
  reader.readAsDataURL(file);
}

function clearChatPendingMedia() {
  state.chatPendingMedia = null;
  renderChatComposerOnly();
}

function openChatImage(id) {
  const m = state.chatMessages.find(x => x.id === id);
  if (!m) return;
  const overlay = document.createElement('div');
  overlay.id = 'chat-image-overlay';
  overlay.className = 'fixed inset-0 z-[130] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `<div class="max-h-[85vh] max-w-full"><img src="${m.media_data}" class="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain" />${m.content ? `<p class="text-white/80 text-sm mt-3 text-center">${escapeHtml(m.content)}</p>` : ''}</div>`;
  document.body.appendChild(overlay);
}

let chatMediaRecorder = null;
let chatVoiceChunks = [];
let chatVoiceTimer = null;
let chatVoiceSeconds = 0;
let chatVoiceCanceled = false;

async function startChatVoice() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast('Voice recording is not supported in this browser', 'error');
    return;
  }
  if (state.chatRecording) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chatVoiceCanceled = false;
    chatMediaRecorder = new MediaRecorder(stream);
    chatVoiceChunks = [];
    chatMediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) chatVoiceChunks.push(e.data); };
    chatMediaRecorder.onstop = () => handleVoiceStop(stream);
    chatMediaRecorder.start();
    state.chatRecording = true;
    chatVoiceSeconds = 0;
    chatVoiceTimer = setInterval(() => {
      chatVoiceSeconds++;
      const el = document.getElementById('chat-rec-timer');
      if (el) el.textContent = formatChatDuration(chatVoiceSeconds);
    }, 1000);
    renderChatComposerOnly();
  } catch (e) {
    showToast('Microphone access was denied', 'error');
  }
}

function stopChatVoice(cancel) {
  if (cancel) chatVoiceCanceled = true;
  if (chatMediaRecorder && chatMediaRecorder.state !== 'inactive') chatMediaRecorder.stop();
  if (chatVoiceTimer) { clearInterval(chatVoiceTimer); chatVoiceTimer = null; }
  state.chatRecording = false;
  if (cancel) chatVoiceChunks = [];
  renderChatComposerOnly();
}

function releaseChatMic(stream) {
  if (stream) stream.getTracks().forEach(t => t.stop());
}

async function handleVoiceStop(stream) {
  releaseChatMic(stream);
  const canceled = chatVoiceCanceled;
  chatVoiceCanceled = false;
  const blob = new Blob(chatVoiceChunks, { type: 'audio/webm' });
  chatVoiceChunks = [];
  chatMediaRecorder = null;
  if (canceled) return;
  if (!state.activeChat) return;
  if (blob.size === 0) { showToast('Recording was too short', 'error'); return; }
  if (blob.size > 1.2 * 1024 * 1024) { showToast('Voice message is too long (max ~1.2MB)', 'error'); return; }
  const replyToId = state.chatReplyingTo ? state.chatReplyingTo.id : null;
  const duration = Math.max(1, chatVoiceSeconds);
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await api(`/chats/${state.activeChat.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ type: 'voice', media_data: reader.result, media_mime: 'audio/webm', media_duration: duration, reply_to_id: replyToId })
      });
    } catch (e) {}
    state.chatReplyingTo = null;
    await loadChatMessages(state.activeChat.id);
    chatScrollToBottom(true);
    loadChats(true);
  };
  reader.readAsDataURL(blob);
}

// ===== Pinned & New Chat UI =====
function openPinnedChatMessages() {
  const pinned = state.chatMessages.filter(m => m.is_pinned);
  if (!pinned.length) return;
  const overlay = document.createElement('div');
  overlay.id = 'chat-pinned-overlay';
  overlay.className = 'fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.innerHTML = `
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col fade-in">
    <div class="p-5 border-b border-gray-100 flex items-center justify-between">
      <h3 class="font-bold text-gray-900"><i class="fas fa-thumbtack text-amber-500 mr-2"></i>Pinned Messages</h3>
      <button onclick="closeChatModal()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center"><i class="fas fa-times"></i></button>
    </div>
    <div class="flex-1 overflow-y-auto p-3 space-y-3 chat-scroll">
      ${pinned.map(m => `<div class="bg-amber-50/70 border border-amber-200 rounded-xl p-3">${renderChatMessage(m)}</div>`).join('')}
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

async function openNewChatModal() {
  if (!state.chatNewUsers.length) {
    try {
      const res = await api('/users');
      state.chatNewUsers = (res.data || []).filter(u => u.id !== state.currentUser.id && canChatWith(state.currentUser.role, u.role));
    } catch (e) { return; }
  }
  renderNewChatModal();
}

function renderNewChatModal() {
  const existing = new Set(state.chats.map(c => c.peer.id));
  const overlay = document.getElementById('chat-modal-overlay') || document.createElement('div');
  overlay.id = 'chat-modal-overlay';
  overlay.className = 'fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.innerHTML = `
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col fade-in">
    <div class="p-5 border-b border-gray-100 flex items-center justify-between">
      <h3 class="font-bold text-gray-900"><i class="fas fa-pen-to-square text-fypilot-500 mr-2"></i>New Chat</h3>
      <button onclick="closeChatModal()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center"><i class="fas fa-times"></i></button>
    </div>
    <div class="p-4 border-b border-gray-100">
      <div class="relative">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
        <input id="chat-new-search" value="${escapeHtml(state.chatNewSearch)}" oninput="setChatNewSearch(this.value)" placeholder="Search people..." class="w-full pl-9 pr-3 py-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-fypilot-500/20 border border-transparent focus:border-fypilot-300 transition-all" />
      </div>
    </div>
    <div id="chat-new-results" class="flex-1 overflow-y-auto p-2 chat-scroll">
      ${renderNewChatResults()}
    </div>
  </div>`;
  if (!overlay.parentNode) document.body.appendChild(overlay);
}

function renderNewChatResults() {
  const q = (state.chatNewSearch || '').toLowerCase();
  const list = state.chatNewUsers.filter(u => !q || (u.name || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q));
  const existing = new Set(state.chats.map(c => c.peer.id));
  if (!list.length) {
    return `<div class="p-8 text-center text-sm text-gray-400">No people found${q ? ' for "' + escapeHtml(state.chatNewSearch) + '"' : ''}</div>`;
  }
  return list.map(u => `
    <button onclick="startChatWith('${u.id}')" class="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
      ${chatAvatar({ name: u.name, role: u.role, avatar: u.avatar }, 'w-11 h-11 text-base')}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm text-gray-900 truncate">${escapeHtml(u.name)}</span>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider capitalize ${u.role === 'coordinator' ? 'bg-purple-100 text-purple-700' : u.role === 'supervisor' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}">${u.role}</span>
        </div>
        <p class="text-xs text-gray-500 truncate">${escapeHtml(u.email || '')}${existing.has(u.id) ? ' · <span class="text-emerald-500 font-semibold">existing chat</span>' : ''}</p>
      </div>
      <i class="fas fa-chevron-right text-gray-300 text-xs"></i>
    </button>`).join('');
}

function setChatNewSearch(v) {
  state.chatNewSearch = v;
  const results = document.getElementById('chat-new-results');
  if (results) results.innerHTML = renderNewChatResults();
}

function setChatSearch(v) {
  state.chatListSearch = v;
  const listEl = document.getElementById('chat-list');
  if (listEl) listEl.innerHTML = renderChatList();
  const input = document.getElementById('chat-search-input');
  if (input) input.value = v;
}

function closeChatModal() {
  ['chat-modal-overlay', 'chat-pinned-overlay'].forEach(id => {
    const o = document.getElementById(id);
    if (o) o.remove();
  });
}

async function startChatWith(userId) {
  try {
    const res = await api('/chats', { method: 'POST', body: JSON.stringify({ other_user_id: userId }) });
    closeChatModal();
    await loadChats(true);
    await openChat(res.data.id);
  } catch (e) {}
}

// ===== Chat Polling & Scroll =====
let chatPollTick = 0;
function startChatPolling() {
  stopChatPolling();
  chatPollTick = 0;
  state.chatListTimer = setInterval(() => { loadChats(true); }, 5000);
  state.chatMsgTimer = setInterval(() => {
    if (state.activeChat && state.currentView === 'chats') {
      chatPollTick++;
      if (chatPollTick % 4 === 0) {
        loadChatMessages(state.activeChat.id, { silent: true });
      } else {
        const last = state.chatMessages.length ? state.chatMessages[state.chatMessages.length - 1].seq : 0;
        loadChatMessages(state.activeChat.id, { silent: true, after: last });
      }
    }
  }, 4000);
}

function stopChatPolling() {
  if (state.chatListTimer) { clearInterval(state.chatListTimer); state.chatListTimer = null; }
  if (state.chatMsgTimer) { clearInterval(state.chatMsgTimer); state.chatMsgTimer = null; }
  if (state.chatRecording) stopChatVoice(true);
  if (state.chatVoicePlaying && chatVoiceAudio) {
    chatVoiceAudio.pause();
    chatVoiceAudio.currentTime = 0;
    state.chatVoicePlaying = null;
  }
}

function onChatScroll() {
  const el = document.getElementById('chat-messages');
  if (!el) return;
  state.chatAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}

function chatScrollToBottom(force) {
  const el = document.getElementById('chat-messages');
  if (!el) return;
  if (!force && !state.chatAtBottom) return;
  el.scrollTop = el.scrollHeight;
  state.chatAtBottom = true;
}

function closeChatOnMobile() {
  state.activeChat = null;
  render();
}

// ===== Event Listeners =====
function attachEventListeners() {
  const isCoordinator = state.currentUser && state.currentUser.role === 'coordinator';

  attachProjectPaste();

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
    if (state.currentView === 'proposals') { loadProposals(); loadMyGroup(); }
    if (state.currentView === 'projects') loadProjects();
    if (state.currentView === 'supervisors') loadSupervisors();
    if (state.currentView === 'people') loadPeople();
    if (state.currentView === 'groups') loadGroups();
    if (state.currentView === 'profile') loadProfile();
    if (state.currentView === 'chats') { loadChats(); startChatPolling(); }
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
window.toggleNavMore = toggleNavMore;
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
window.updateProjectProgress = updateProjectProgress;
window.assignProposalSupervisor = assignProposalSupervisor;
window.assignProjectSupervisor = assignProjectSupervisor;
window.showQuickAssignModal = showQuickAssignModal;
window.closeAssignModal = closeAssignModal;
window.switchAssignTab = switchAssignTab;
window.submitAssignModal = submitAssignModal;
window.showAddSupervisorModal = showAddSupervisorModal;
window.closeAddSupervisorModal = closeAddSupervisorModal;
window.submitAddSupervisorModal = submitAddSupervisorModal;
window.loadGroups = loadGroups;
window.loadGroupDetail = loadGroupDetail;
window.loadProfile = loadProfile;
window.triggerAvatarUpload = triggerAvatarUpload;
window.handleAvatarUpload = handleAvatarUpload;
window.showEditProfileModal = showEditProfileModal;
window.submitEditProfile = submitEditProfile;
window.showCreateGroupModal = showCreateGroupModal;
window.closeGroupModal = closeGroupModal;
window.updateMemberPicker = updateMemberPicker;
window.submitCreateGroup = submitCreateGroup;
window.showAddMemberModal = showAddMemberModal;
window.submitAddMember = submitAddMember;
window.showChangeLeaderModal = showChangeLeaderModal;
window.submitChangeLeader = submitChangeLeader;
window.approveGroup = approveGroup;
window.rejectGroup = rejectGroup;
window.removeGroupMember = removeGroupMember;
window.deleteGroup = deleteGroup;
window.toggleLinkForm = toggleLinkForm;
window.addProjectLink = addProjectLink;
window.deleteProjectLink = deleteProjectLink;
window.handleGalleryUpload = handleGalleryUpload;
window.deleteProjectMedia = deleteProjectMedia;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.addOverallFeedback = addOverallFeedback;
window.addMediaFeedback = addMediaFeedback;
window.setPeopleTab = setPeopleTab;
window.setPeopleView = setPeopleView;
window.setPeopleSearch = setPeopleSearch;
window.clearPeopleSearch = clearPeopleSearch;
window.deletePeopleStudent = deletePeopleStudent;
window.deletePeopleGroup = deletePeopleGroup;
window.loadChats = loadChats;
window.openChat = openChat;
window.openNewChatModal = openNewChatModal;
window.closeChatModal = closeChatModal;
window.startChatWith = startChatWith;
window.setChatSearch = setChatSearch;
window.setChatNewSearch = setChatNewSearch;
window.sendChatMessage = sendChatMessage;
window.handleChatKeydown = handleChatKeydown;
window.autoGrowChatInput = autoGrowChatInput;
window.toggleChatEmojiPicker = toggleChatEmojiPicker;
window.insertChatEmoji = insertChatEmoji;
window.openChatImagePicker = openChatImagePicker;
window.handleChatImagePick = handleChatImagePick;
window.clearChatPendingMedia = clearChatPendingMedia;
window.startChatVoice = startChatVoice;
window.stopChatVoice = stopChatVoice;
window.replyToChatMessage = replyToChatMessage;
window.cancelChatReply = cancelChatReply;
window.editChatMessage = editChatMessage;
window.cancelChatEdit = cancelChatEdit;
window.saveChatEdit = saveChatEdit;
window.deleteChatMessage = deleteChatMessage;
window.togglePinChatMessage = togglePinChatMessage;
window.toggleVoicePlayer = toggleVoicePlayer;
window.openChatImage = openChatImage;
window.openPinnedChatMessages = openPinnedChatMessages;
window.closeChatOnMobile = closeChatOnMobile;

// Initial Application Render
render();
