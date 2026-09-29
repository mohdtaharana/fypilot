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

const DEPARTMENT_MATRIX = {
  'BS': {
    'Morning': [
      'Business Administration',
      'Accounting Banking & Finance',
      'Computer Science',
      'Software Engineering',
      'Artificial Intelligence & Mathematical Sciences',
      'Cyber Security',
      'Data Science',
      'Media & Communication Studies',
      'English',
      'Environmental Sciences'
    ],
    'Evening': [
      'Computer Science',
      'Software Engineering',
      'Artificial Intelligence & Mathematical Sciences',
      'Business Administration',
      'Accounting Banking & Finance',
      'Media & Communication Studies'
    ]
  },
  'MS': {
    'Morning': [
      'Computer Science',
      'Software Engineering',
      'Business Administration',
      'Media & Communication Studies',
      'English'
    ],
    'Evening': [
      'Computer Science',
      'Software Engineering',
      'Artificial Intelligence & Mathematical Sciences',
      'Business Administration'
    ]
  }
};

const LIFECYCLE_STAGES = [
  'Requirements Gathering',
  'Requirements Analysis',
  'Feasibility Analysis',
  'Planning',
  'System Design',
  'Architecture Design',
  'UI/UX Design',
  'Database Design',
  'Development',
  'Integration',
  'Testing',
  'Debugging',
  'Deployment',
  'Documentation',
  'Maintenance',
  'Research',
  'Presentation Preparation',
  'Other'
];

const EXECUTIVE_ROLES = new Set(['coordinator', 'hod', 'dean']);
function isExecutiveRole(role) {
  return !!role && EXECUTIVE_ROLES.has(role);
}
function isAuditAccessRole(role) {
  return role === 'hod' || role === 'dean';
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
  notifications: [],
  notifUnread: {},
  notifTotal: 0,
  notifOpen: false,
  notifTimer: null,
  notifGlobalTimer: null,
  proposals: [],
  projects: [],
  defenseConfig: null,
  defenseSubmissions: [],
  defenseLoading: false,
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
  // Public Applications state
  applications: [],
  selectedApplication: null,
  applicationsTab: 'all',
  applicationsSearch: '',
  applyStep: 1,
  applyForm: {
    email: '',
    student_id_num: '',
    student_name: '',
    program: 'BS',
    shift: 'Morning',
    department: 'Computer Science',
    group_name: '',
    project_title: '',
    abstract: '',
    problem_statement: '',
    objectives: '',
    methodology: '',
    technologies: '',
    members: [{ name: '', student_id_num: '' }],
    pref_1: '',
    pref_2: '',
    pref_3: '',
    priority: 'Normal',
    internship_certificate_pdf: null,
    pdf_name: '',
    pdf_size: '',
    transcript_certificate_pdf: null,
    transcript_pdf_name: '',
    transcript_pdf_size: ''
  },
  applySubmitted: false,
  applySubmittedData: null,
  supervisorsList: [],
  projectDetailTab: 'overview',
  studentProfileData: null,
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
  chatSending: false,
  chatListGlobalTimer: null,
  chatTyping: false,
  typingTimer: null,
  presenceTimer: null,
  peerPresence: null,
  chatListTimer: null,
  chatMsgTimer: null,
  // External FYP evaluation state
  evalPayload: null,
  evalScores: {},
  evalFormToken: null,
  evalSubmitting: false,
  evalLink: null,
  evalLinkLoading: false,
  evalMaxTotal: null,
  externalEvaluations: null,
  externalEvalSections: [],
  externalEvalMax: null,
  externalEvalLoading: false,
  externalEvalError: null,
  externalEvalProjectId: null,
  projectGroupId: null,
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
    const res = await fetch(`${API_BASE}${path}`, { credentials: 'same-origin', ...options, headers });
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
  toast.className = `${colors[type]} text-white px-4 py-3 rounded-xl shadow-xl mb-2 fade-in text-sm max-w-sm flex items-center gap-2 font-medium pointer-events-auto relative z-[99999]`;
  toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} text-base"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ===== Navigation =====
function navigate(view, data = null) {
  state.currentView = view;
  state.mobileMenuOpen = false;
  state.navMoreOpen = false;
  state.notifOpen = false;
  if (state.notifTimer) { clearInterval(state.notifTimer); state.notifTimer = null; }
  if (data) {
    if (view === 'proposal-detail') state.selectedProposal = data;
    if (view === 'project-detail') state.selectedProject = data;
  }
  if (view !== 'chats') stopChatPolling();
  if (view === 'applications') startApplicationsPolling();
  else stopApplicationsPolling();
  render();
  markViewNotificationsRead(view);
}

async function markViewNotificationsRead(view) {
  const key = view;
  const current = state.notifUnread[key];
  if (!current || current <= 0) return;
  try {
    await api('/notifications/read-all', { method: 'POST', body: JSON.stringify({ link_view: key }), silentError: true });
    state.notifUnread[key] = 0;
    state.notifTotal = Math.max(0, (state.notifTotal || 0) - current);
    refreshNavBubbles();
  } catch (e) {}
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

  if (window.location.pathname === '/apply' || state.currentView === 'apply') {
    app.innerHTML = renderPublicApplicationPage();
    attachApplicationFormListeners();
    return;
  }

  // The external examiner opens this from a scanned QR code, so it renders
  // before any authentication check.
  if (window.location.pathname === '/evaluate' || window.location.pathname.startsWith('/evaluate/')) {
    renderPublicEvaluationPage(app);
    return;
  }

  if (!state.isAuthenticated || !state.currentUser) {
    app.innerHTML = renderLoginScreen();
    attachLoginEventListeners();
    return;
  }

  app.innerHTML = `
    ${renderNav()}
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      ${renderCurrentView()}
    </main>
  `;
  attachEventListeners();
}

// ===== Authentication UI =====
function renderLoginScreen() {
  return `
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-fypilot-900 to-indigo-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
    <!-- Ambient Blur Background Elements -->
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-fypilot-500/20 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

    <div class="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8 fade-in relative z-10">
      
      <!-- Brand Header -->
      <div class="text-center mb-6 pt-8">
        <div class="w-52 h-52 mx-auto mb-3 flex items-center justify-center">
          <img src="/images/fypilotlogo.png" alt="FYPilot" class="w-full h-full object-contain" />
        </div>
        <p class="text-xs text-gray-500 mt-1 font-medium">AI Intelligence Layer for FYP Management</p>
      </div>

      <!-- Public FYP Application Banner -->
      <div class="mb-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3.5 shadow-sm text-center">
        <p class="text-xs font-bold text-emerald-900 mb-1"><i class="fas fa-graduation-cap text-emerald-600 mr-1"></i> New FYP Student?</p>
        <p class="text-[11px] text-emerald-700 mb-2.5">No login required initially! Submit your official FYP application with your internship certificate.</p>
        <button onclick="navigateToApply()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-sm flex items-center justify-center gap-2">
          <i class="fas fa-file-signature"></i> Public Student Application (/apply)
        </button>
      </div>

      <!-- Login / Register Tab Toggle removed: self-registration is disabled -->

      <!-- LOGIN FORM -->
      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Email / Student ID</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <i class="fas fa-envelope text-sm"></i>
            </div>
            <input type="text" id="login-email" required 
                   value="${state.loginPrefillEmail || ''}"
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
                   class="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-fypilot-500 focus:bg-white transition-all" 
                   placeholder="Enter your password" />
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

      <p class="text-center text-[11px] text-gray-400 mt-5"><i class="fas fa-info-circle mr-1"></i>Contact the coordinator if you need access.</p>

    </div>
  </div>`;
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
}

async function reviewPendingUserApplication(userOrId) {
  const user = typeof userOrId === 'object' && userOrId
    ? userOrId
    : (state.pendingUsers || []).find(u => String(u.id) === String(userOrId));

  if (!user) {
    showToast('Pending user details could not be loaded for review.', 'warning');
    return;
  }

  const normalizedEmail = String(user?.email || '').trim().toLowerCase();
  const normalizedId = String(user?.student_id_num || user?.studentId || '').trim();

  const openReview = (apps) => {
    const match = (apps || []).find(app => {
      const appEmail = String(app?.email || '').trim().toLowerCase();
      const appId = String(app?.student_id_num || app?.student_id || '').trim();
      return (normalizedEmail && appEmail && appEmail === normalizedEmail) || (normalizedId && appId && appId === normalizedId);
    });

    navigate('applications');
    setTimeout(() => {
      if (match) {
        showReviewApplicationModal(match.id);
      } else {
        showToast('No matching student application was found for review.', 'warning');
      }
    }, 220);
  };

  try {
    if (!(state.applications && state.applications.length)) {
      const res = await api('/applications');
      state.applications = res.data || [];
    }
    openReview(state.applications);
  } catch (e) {
    console.error('Failed to load pending application for review:', e);
    showToast('Unable to open the review page right now. Please try again.', 'error');
  }
}

async function approveUser(userId) {
  try {
    const user = (state.pendingUsers || []).find(u => String(u.id) === String(userId));
    if (user) {
      await reviewPendingUserApplication(user);
      return;
    }

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
        <button onclick="reviewPendingUserApplication('${u.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"><i class="fas fa-eye"></i> Review</button>
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
  if (!state.currentUser || !isExecutiveRole(state.currentUser.role)) return;
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
  stopChatPolling();
  if (state.notifGlobalTimer) { clearInterval(state.notifGlobalTimer); state.notifGlobalTimer = null; }
  if (state.chatListGlobalTimer) { clearInterval(state.chatListGlobalTimer); state.chatListGlobalTimer = null; }
  if (state.presenceTimer) { clearInterval(state.presenceTimer); state.presenceTimer = null; }
  stopNotificationPolling();
  state.isAuthenticated = false;
  state.currentUser = null;
  state.mobileMenuOpen = false;
  // Clear cached chat user list so it's re-fetched with fresh permissions on next login
  state.chatNewUsers = [];
  state.chats = [];
  state.activeChat = null;
  state.chatMessages = [];
  localStorage.removeItem('fypilot_user');
  // Invalidate the server session cookie (used by direct downloads / new tabs)
  fetch(`${API_BASE}/users/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  showToast('Logged out successfully', 'info');
  render();
}

// ===== Navbar Component =====
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date((dateStr || '').replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function notifIcon(type) {
  const map = {
    approval: 'fa-user-check',
    proposal: 'fa-file-alt',
    project: 'fa-project-diagram',
    group: 'fa-users',
    chat: 'fa-comments',
    feedback: 'fa-comment-dots',
    system: 'fa-info-circle',
  };
  const cls = {
    approval: 'bg-purple-100 text-purple-600',
    proposal: 'bg-blue-100 text-blue-600',
    project: 'bg-emerald-100 text-emerald-600',
    group: 'bg-amber-100 text-amber-600',
    chat: 'bg-fypilot-100 text-fypilot-600',
    feedback: 'bg-rose-100 text-rose-600',
    system: 'bg-gray-100 text-gray-600',
  };
  return `<div class="w-9 h-9 rounded-xl ${cls[type] || cls.system} flex items-center justify-center shrink-0"><i class="fas ${map[type] || map.system} text-sm"></i></div>`;
}

function renderNotificationItem(n) {
  const time = n.created_at ? timeAgo(n.created_at) : '';
  return `
  <button onclick="openNotification('${n.id}')" class="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${n.is_read ? '' : 'bg-fypilot-50/60'}">
    ${notifIcon(n.type)}
    <div class="flex-1 min-w-0">
      <p class="text-xs font-bold text-gray-900 leading-snug">${escapeHtml(n.title)}</p>
      ${n.body ? `<p class="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">${escapeHtml(n.body)}</p>` : ''}
      ${time ? `<p class="text-[10px] text-gray-400 mt-1">${time}</p>` : ''}
    </div>
    ${n.is_read ? '' : '<span class="w-2 h-2 rounded-full bg-fypilot-500 mt-1 shrink-0"></span>'}
  </button>`;
}

function renderNotificationBell(wrapId, mobile) {
  const color = mobile ? 'text-gray-600 hover:bg-gray-100 focus:outline-none' : 'text-gray-500 hover:bg-gray-100 hover:text-fypilot-600 transition-colors';
  const icon = mobile ? 'fa-bell text-lg' : 'fa-bell text-base';
  return `
  <div id="${wrapId}" class="relative">
    <button onclick="toggleNotificationPanel()" title="Notifications" class="relative p-2.5 rounded-xl ${color}">
      <i class="fas ${icon}"></i>
      ${state.notifTotal > 0 ? `<span class="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">${state.notifTotal > 99 ? '99+' : state.notifTotal}</span>` : ''}
    </button>
    ${state.notifOpen ? renderNotificationPanel() : ''}
  </div>`;
}

function renderNotificationPanel() {
  const items = state.notifications;
  return `
  <div class="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full mt-0 sm:mt-2 left-2 sm:left-auto w-auto sm:w-[360px] max-w-[calc(100vw-1rem)] bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-gray-900/20 fade-in z-[1000] overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <h3 class="text-sm font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-bell text-fypilot-600"></i> Notifications</h3>
      ${state.notifTotal ? `<button onclick="markAllNotificationsRead()" class="text-[11px] font-semibold text-fypilot-600 hover:text-fypilot-700 flex items-center gap-1"><i class="fas fa-check-double text-[10px]"></i> Mark all read</button>` : ''}
    </div>
    <div class="max-h-[60vh] overflow-y-auto chat-scroll">
      ${items.length ? items.map(renderNotificationItem).join('') : `<div class="px-4 py-10 text-center text-gray-400 text-sm"><i class="fas fa-bell-slash text-2xl mb-2 block text-gray-300"></i>No notifications yet</div>`}
    </div>
    <div class="border-t border-gray-100 p-2">
      <button onclick="markAllNotificationsRead()" class="w-full text-center text-[11px] font-semibold text-gray-500 hover:text-fypilot-600 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Mark all as read</button>
    </div>
  </div>`;
}

function toggleNotificationPanel() {
  state.notifOpen = !state.notifOpen;
  if (state.notifOpen) {
    loadNotifications();
    state.notifTimer = setInterval(() => { loadNotifications(true); }, 10000);
  } else {
    if (state.notifTimer) { clearInterval(state.notifTimer); state.notifTimer = null; }
  }
  refreshNotificationBells();
}

function refreshNotificationBells() {
  ['notif-bell-wrap', 'notif-bell-wrap-m'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.outerHTML = renderNotificationBell(id, id === 'notif-bell-wrap-m');
  });
}

async function loadNotifications(silent) {
  if (!state.currentUser) return;
  const prevTotal = state.notifTotal;
  try {
    const [listRes, countRes] = await Promise.all([
      api('/notifications?limit=30', { silentError: !!silent }),
      api('/notifications/unread-counts', { silentError: !!silent }),
    ]);
    if (listRes.data) state.notifications = listRes.data;
    if (countRes.data) {
      state.notifUnread = countRes.data.counts || {};
      state.notifTotal = countRes.data.total || 0;
    }

    if (state.currentUser && isExecutiveRole(state.currentUser.role) && state.currentView === 'dashboard') {
      await loadPendingUsers();
    }

    refreshNavBubbles();
    if (state.notifTotal !== prevTotal || state.notifOpen) refreshNotificationBells();
  } catch (e) {}
}

function refreshNavBubbles() {
  document.querySelectorAll('[data-notif-bubble]').forEach(el => {
    const view = el.getAttribute('data-notif-bubble');
    const n = state.notifUnread[view] || 0;
    if (n > 0) {
      el.textContent = n > 99 ? '99+' : n;
      el.classList.remove('hidden');
      el.classList.add('flex');
    } else {
      el.classList.add('hidden');
      el.classList.remove('flex');
    }
  });
}

async function openNotification(id) {
  const n = state.notifications.find(x => x.id === id);
  try { await api(`/notifications/${id}/read`, { method: 'POST', silentError: true }); } catch (e) {}
  const notif = n || {};
  const view = notif.link_view || 'dashboard';
  if (!notif.is_read) {
    state.notifTotal = Math.max(0, (state.notifTotal || 0) - 1);
    const key = view;
    state.notifUnread[key] = Math.max(0, (state.notifUnread[key] || 0) - 1);
  }
  state.notifOpen = false;
  if (state.notifTimer) { clearInterval(state.notifTimer); state.notifTimer = null; }
  if (notif.ref_id && view === 'chats') navigate('chats');
  else navigate(view);
}

async function markAllNotificationsRead() {
  try { await api('/notifications/read-all', { method: 'POST', body: '{}', silentError: true }); } catch (e) {}
  state.notifications = (state.notifications || []).map(n => ({ ...n, is_read: 1 }));
  state.notifUnread = { dashboard: 0, proposals: 0, projects: 0, groups: 0, chats: 0, people: 0, profile: 0 };
  state.notifTotal = 0;
  render();
}

function stopNotificationPolling() {
  if (state.notifTimer) { clearInterval(state.notifTimer); state.notifTimer = null; }
}

function navBadge(view, mobile) {
  const n = state.notifUnread[view] || 0;
  if (!n) return '';
  const cls = mobile
    ? 'ml-auto bg-fypilot-600 text-white text-[10px] font-bold min-w-4 h-4 px-1.5 rounded-full flex items-center justify-center'
    : 'ml-1 bg-fypilot-600 text-white text-[10px] font-bold min-w-4 h-4 px-1.5 rounded-full flex items-center justify-center';
  return `<span data-notif-bubble="${view}" class="${cls}">${n > 99 ? '99+' : n}</span>`;
}

function chatNavBadge(mobile) {
  const total = state.chats.reduce((s, c) => s + (c.unread || 0), 0);
  if (!total) return '';
  const cls = mobile
    ? 'ml-auto bg-fypilot-600 text-white text-[10px] font-bold min-w-4 h-4 px-1.5 rounded-full flex items-center justify-center'
    : 'ml-1 bg-fypilot-600 text-white text-[10px] font-bold min-w-4 h-4 px-1.5 rounded-full flex items-center justify-center';
  const id = mobile ? 'nav-chat-badge-m' : 'nav-chat-badge';
  return `<span id="${id}" class="${cls}">${total > 99 ? '99+' : total}</span>`;
}

function renderNav() {
  const role = state.currentUser ? state.currentUser.role : 'guest';
  const links = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
    { id: 'proposals', label: 'Proposals', icon: 'fa-file-alt' },
    { id: 'projects', label: 'Projects', icon: 'fa-project-diagram' },
    { id: 'defense', label: 'Defense', icon: 'fa-file-export' },
    { id: 'supervisors', label: 'Supervisors', icon: 'fa-user-tie' },
    { id: 'chats', label: 'Chats', icon: 'fa-comments' },
    ...(isAuditAccessRole(role) ? [{ id: 'audit-logs', label: 'Audit Logs', icon: 'fa-shield-alt' }] : []),
    ...(isExecutiveRole(role) ? [
      { id: 'applications', label: 'Applications', icon: 'fa-file-signature' },
      { id: 'people', label: 'People', icon: 'fa-user-friends' }
    ] : []),
    ...(role === 'student' || isExecutiveRole(role) || role === 'supervisor' ? [{ id: 'groups', label: role === 'student' ? 'My Group' : 'Groups', icon: 'fa-users' }] : []),
    { id: 'profile', label: 'Profile', icon: 'fa-id-badge' },
  ];

  const roleBadges = {
    coordinator: 'bg-purple-100 text-purple-700 border-purple-200',
    hod: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    dean: 'bg-violet-100 text-violet-700 border-violet-200',
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
        <div class="flex items-center cursor-pointer shrink-0" onclick="navigate('dashboard')">
          <img src="/images/fypilotlogo.png" alt="FYPilot" class="h-12 w-auto object-contain" />
        </div>

        <!-- Desktop Navigation Links (primary + More dropdown, no overflow) -->
        <div class="hidden md:flex items-center gap-1 flex-1 justify-center min-w-0 px-2">
          ${primary.map(l => `
            <button onclick="navigate('${l.id}')" 
                    title="${l.label}"
                    class="px-2.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-2 whitespace-nowrap shrink-0 ${state.currentView === l.id || state.currentView.startsWith(l.id) ? 'bg-fypilot-50 text-fypilot-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}">
              <i class="fas ${l.icon} text-sm"></i>
              <span class="hidden lg:inline">${l.label}</span>
              ${l.id === 'chats' ? chatNavBadge(false) : navBadge(l.id)}
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
                  ${navBadge(l.id, true)}
                </button>
              `).join('')}
            </div>` : ''}
          </div>` : ''}
        </div>

        <!-- User Controls (Desktop) -->
        <div class="hidden md:flex items-center gap-3 shrink-0">
          <span class="hidden xl:flex px-2.5 py-1 rounded-full text-xs font-semibold border ${roleBadges[currentRole] || 'bg-gray-100'} capitalize items-center gap-1">
            <i class="fas ${isExecutiveRole(currentRole) ? 'fa-crown text-purple-600' : currentRole === 'supervisor' ? 'fa-user-tie text-blue-600' : 'fa-user-graduate text-emerald-600'} text-xs"></i>
            ${currentRole}
          </span>

          ${renderNotificationBell('notif-bell-wrap', false)}

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
          ${renderNotificationBell('notif-bell-wrap-m', true)}
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
            ${l.id === 'chats' ? chatNavBadge(true) : navBadge(l.id, true)}
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
    case 'defense': return renderDefense();
    case 'project-detail': return renderProjectDetail();
    case 'supervisors': return renderSupervisors();
    case 'chats': return renderChats();
    case 'people': return renderPeople();
    case 'groups': return renderGroups();
    case 'group-profile': return renderGroupProfile();
    case 'profile': return renderProfile();
    case 'applications': return renderApplicationsList();
    case 'audit-logs': return renderAuditLogs();
    case 'apply': return renderPublicApplicationPage();
    default: return renderDashboard();
  }
}

// ===== Dashboard (Role-Specific) =====
function renderDashboard() {
  const role = state.currentUser.role;
  if (isExecutiveRole(role)) return renderCoordinatorDashboard();
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

    <!-- Executive Danger Zone & Bulk Deletion -->
    <div class="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <i class="fas fa-exclamation-triangle text-rose-600"></i>
        <h3 class="font-bold text-rose-900 text-sm uppercase tracking-wider">Executive Danger Zone &amp; Data Purge</h3>
      </div>
      <p class="text-xs text-rose-700 mb-4">Bulk operations with confirmation safeguards. Select a data category to wipe:</p>
      <div class="flex flex-wrap gap-2.5">
        <button onclick="bulkDeleteAll('students')" class="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-user-slash"></i> Delete All Students
        </button>
        <button onclick="bulkDeleteAll('groups')" class="bg-rose-700 hover:bg-rose-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-layer-group"></i> Delete All Groups
        </button>
        <button onclick="bulkDeleteAll('proposals')" class="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-file-excel"></i> Delete All Proposals
        </button>
        <button onclick="bulkDeleteAll('projects')" class="bg-rose-700 hover:bg-rose-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-folder-minus"></i> Delete All Projects
        </button>
        <button onclick="bulkDeleteAll('applications')" class="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-id-card"></i> Delete All Applications
        </button>
        ${isAuditAccessRole(state.currentUser?.role) ? `
        <button onclick="bulkDeleteAll('logs')" class="bg-rose-800 hover:bg-rose-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-history"></i> Clear Audit Logs
        </button>` : ''}
        <button onclick="bulkDeleteAll('evaluations')" class="bg-rose-700 hover:bg-rose-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-poll"></i> Delete All Evaluations
        </button>
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

    <!-- Danger Zone -->
    ${isExecutiveRole(state.currentUser?.role) ? `
    <div class="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-4">
        <i class="fas fa-exclamation-triangle text-rose-500"></i>
        <h3 class="font-bold text-rose-800 text-sm uppercase tracking-wider">Danger Zone</h3>
      </div>
      <div class="flex flex-wrap gap-3">
        <button onclick="bulkDeleteAll('students')" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-users-slash"></i> Delete All Students
        </button>
        <button onclick="bulkDeleteAll('groups')" class="bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-layer-group"></i> Delete All Groups
        </button>
      </div>
      <p class="text-xs text-rose-600 mt-3"><i class="fas fa-info-circle mr-1"></i>These actions are irreversible and will cascade to linked proposals and projects.</p>
    </div>` : ''}
  </div>`;
}

function renderAuditLogs() {
  if (!isAuditAccessRole(state.currentUser?.role)) {
    return `
      <div class="fade-in max-w-xl mx-auto bg-white rounded-2xl border border-rose-200 p-6 shadow-sm">
        <div class="flex items-center gap-3 text-rose-600">
          <i class="fas fa-lock text-xl"></i>
          <h1 class="text-xl font-bold">Audit logs unavailable</h1>
        </div>
        <p class="text-sm text-gray-600 mt-3">Only HOD and Dean can access the complete audit trail.</p>
      </div>`;
  }

  return `
    <div class="fade-in space-y-6">
      <div class="bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-900 text-white rounded-2xl p-6 shadow-xl border border-violet-500/20">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="inline-flex items-center gap-1.5 bg-violet-500/20 border border-violet-400/30 text-violet-100 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              <i class="fas fa-shield-alt"></i> Restricted Audit
            </span>
            <h1 class="text-2xl sm:text-3xl font-bold mt-2">Operations Audit Trail</h1>
            <p class="text-violet-100 text-sm mt-1">Review system activity with timestamped records and export access for leadership.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="loadAuditLogs()" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
            <button onclick="exportAuditLogs()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5">
              <i class="fas fa-download"></i> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div id="audit-logs-container" class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div class="animate-pulse space-y-3">
          <div class="h-4 w-28 bg-gray-200 rounded"></div>
          <div class="h-10 bg-gray-100 rounded-xl"></div>
          <div class="h-10 bg-gray-100 rounded-xl"></div>
          <div class="h-10 bg-gray-100 rounded-xl"></div>
        </div>
      </div>

      <!-- Danger Zone (HOD/Dean only) -->
      <div class="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 shadow-sm">
        <div class="flex items-center gap-2 mb-4">
          <i class="fas fa-exclamation-triangle text-rose-500"></i>
          <h3 class="font-bold text-rose-800 text-sm uppercase tracking-wider">Danger Zone</h3>
        </div>
        <div class="flex flex-wrap gap-3">
          <button onclick="bulkDeleteAll('logs')" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
            <i class="fas fa-trash-alt"></i> Clear All Audit Logs
          </button>
        </div>
        <p class="text-xs text-rose-600 mt-3"><i class="fas fa-info-circle mr-1"></i>Permanently deletes every audit log entry. One entry is written after clearing for compliance traceability.</p>
      </div>
    </div>
  `;
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
  if (!state.currentUser || !isExecutiveRole(state.currentUser.role)) return;
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

async function bulkDeleteAll(type) {
  if (!state.currentUser || !isExecutiveRole(state.currentUser.role)) {
    showToast('Unauthorized: Only executive roles can perform bulk deletions', 'error');
    return;
  }

  const configs = {
    students: {
      title: 'Delete All Students',
      prompt: 'Type "DELETE ALL STUDENTS" to permanently delete ALL student accounts and related data:',
      confirmPhrase: 'DELETE ALL STUDENTS',
      url: '/users/bulk',
      onSuccess: async () => {
        if (state.currentView === 'people') await loadPeople();
        else navigate('people');
      }
    },
    groups: {
      title: 'Delete All Groups',
      prompt: 'Type "DELETE ALL GROUPS" to permanently delete ALL FYP groups and member links:',
      confirmPhrase: 'DELETE ALL GROUPS',
      url: '/groups/bulk',
      onSuccess: async () => {
        if (state.currentView === 'people') await loadPeople();
        else navigate('people');
      }
    },
    proposals: {
      title: 'Delete All Proposals',
      prompt: 'Type "DELETE ALL PROPOSALS" to permanently delete ALL FYP project proposals:',
      confirmPhrase: 'DELETE ALL PROPOSALS',
      url: '/proposals/bulk',
      onSuccess: async () => {
        if (state.currentView === 'proposals') await loadProposals();
        else navigate('proposals');
      }
    },
    projects: {
      title: 'Delete All Projects',
      prompt: 'Type "DELETE ALL PROJECTS" to permanently delete ALL active FYP projects:',
      confirmPhrase: 'DELETE ALL PROJECTS',
      url: '/projects/bulk',
      onSuccess: async () => {
        if (state.currentView === 'projects') await loadProjects();
        else navigate('projects');
      }
    },
    applications: {
      title: 'Delete All Applications',
      prompt: 'Type "DELETE ALL APPLICATIONS" to permanently delete ALL student registration applications:',
      confirmPhrase: 'DELETE ALL APPLICATIONS',
      url: '/applications/bulk',
      onSuccess: async () => {
        if (state.currentView === 'applications') await loadApplications();
        else navigate('applications');
      }
    },
    logs: {
      title: 'Clear All Audit Logs',
      prompt: 'Type "DELETE ALL LOGS" to permanently clear ALL system audit logs:',
      confirmPhrase: 'DELETE ALL LOGS',
      url: '/audit/logs/bulk',
      onSuccess: async () => {
        if (state.currentView === 'audit-logs') await loadAuditLogs();
        else navigate('audit-logs');
      }
    },
    evaluations: {
      title: 'Delete All FYP Evaluations',
      prompt: 'Type "DELETE ALL EVALUATIONS" to permanently delete ALL external examiner evaluations and reset group QR tokens:',
      confirmPhrase: 'DELETE ALL EVALUATIONS',
      url: '/evaluations/bulk/all',
      onSuccess: async () => {
        if (state.externalEvalProjectId) await loadExternalEvaluations(state.externalEvalProjectId, true);
        if (state.evalLink?.groupId) await loadEvaluationLink(state.evalLink.groupId, true);
        if (state.currentView === 'dashboard') render();
      }
    }
  };

  const cfg = configs[type];
  if (!cfg) return;

  const input = prompt(`${cfg.title}\n\nWARNING: This action is permanent and CANNOT be undone!\n\n${cfg.prompt}`);
  if (input === null) return;

  if (input.trim() !== cfg.confirmPhrase) {
    showToast(`Confirmation text did not match "${cfg.confirmPhrase}". Deletion cancelled.`, 'error');
    return;
  }

  try {
    const res = await api(cfg.url, {
      method: 'DELETE',
      body: JSON.stringify({ confirm: cfg.confirmPhrase })
    });
    showToast(res.message || `${cfg.title} completed successfully.`, 'success');
    if (cfg.onSuccess) await cfg.onSuccess();
  } catch (e) {
    showToast(e.message || 'Bulk deletion failed', 'error');
  }
}

async function deleteSingleEvaluation(evalId) {
  if (!evalId) return;
  if (!confirm('Are you sure you want to permanently delete this evaluation entry?')) return;

  try {
    const res = await api(`/evaluations/${evalId}`, { method: 'DELETE' });
    showToast(res.message || 'Evaluation deleted successfully', 'success');
    if (state.externalEvalProjectId) {
      await loadExternalEvaluations(state.externalEvalProjectId, true);
    }
    if (state.evalLink?.groupId) {
      await loadEvaluationLink(state.evalLink.groupId, true);
    }
  } catch (e) {
    showToast(e.message || 'Failed to delete evaluation', 'error');
  }
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
          ${!hasProposalForCurrentGroup() ? `
            <button onclick="showNewProposalForm(); navigate('proposals')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-1.5">
              <i class="fas fa-plus-circle"></i> Submit Proposal
            </button>
          ` : ''}
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
        ${!hasProposalForCurrentGroup() ? `<button onclick="navigate('proposals')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"><i class="fas fa-plus"></i> New Proposal</button>` : ''}
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
      ${state.currentUser && state.currentUser.role === 'student' && !hasProposalForCurrentGroup() ? `
      <button onclick="showNewProposalForm()" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-fypilot-500/20 transition-all flex items-center justify-center gap-2 shrink-0">
        <i class="fas fa-plus"></i>
        <span>New Proposal</span>
      </button>
      ` : ''}
    </div>

    ${state.currentUser && state.currentUser.role === 'student' ? '<div id="proposal-group-banner"></div>' : ''}
    <div id="proposals-list" class="space-y-3">Loading...</div>

    <!-- Danger Zone (Executive only) -->
    ${isExecutiveRole(state.currentUser?.role) ? `
    <div class="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-4">
        <i class="fas fa-exclamation-triangle text-rose-500"></i>
        <h3 class="font-bold text-rose-800 text-sm uppercase tracking-wider">Danger Zone</h3>
      </div>
      <div class="flex flex-wrap gap-3">
        <button onclick="bulkDeleteAll('proposals')" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-file-excel"></i> Delete All Proposals
        </button>
      </div>
      <p class="text-xs text-rose-600 mt-3"><i class="fas fa-info-circle mr-1"></i>Permanently deletes all FYP project proposals. This action is irreversible.</p>
    </div>` : ''}
  </div>`;
}

// ===== Proposal Detail =====
function renderProposalDetail() {
  const p = state.selectedProposal;
  if (!p) return '<p class="p-6 text-gray-500">No proposal selected</p>';

  const executiveRole = isExecutiveRole(state.currentUser?.role) || state.currentUser?.role === 'supervisor';
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

    <!-- EXECUTIVE POWER CONTROLS FOR EXECUTIVE USERS & SUPERVISOR -->
    ${(isExecutiveRole(state.currentUser.role) || state.currentUser.role === 'supervisor') ? `
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

      <!-- Supervisor Allocation Control (Executive only) -->
      ${isExecutiveRole(state.currentUser.role) ? `
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

    ${isExecutiveRole(state.currentUser.role) ? `
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

// ===== External FYP Evaluation (QR form + results) =====
// The rubric, its maxima and its field metadata all come from
// GET /api/evaluations/criteria, which is generated from the same server module
// that validates the submission. The form therefore cannot drift from the
// printed document, and the totals shown here are always recomputed from the
// criteria the examiner actually awarded.

/** section key -> fyp_evaluations column holding that section's subtotal. */
const EVAL_SECTION_TOTAL_FIELDS = [
  { key: 'project_content', column: 'content_total' },
  { key: 'technical_proficiency', column: 'technical_total' },
  { key: 'presentation_skills', column: 'presentation_total' },
  { key: 'report_quality', column: 'report_total' },
  { key: 'teamwork', column: 'teamwork_total' },
  { key: 'overall_impact', column: 'impact_total' },
];

function evaluationGradeClass(grade) {
  return {
    'A+': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    A: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    B: 'bg-blue-100 text-blue-800 border-blue-200',
    C: 'bg-amber-100 text-amber-800 border-amber-200',
    D: 'bg-orange-100 text-orange-800 border-orange-200',
    F: 'bg-rose-100 text-rose-800 border-rose-200',
  }[grade] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/** Grade band used by the live footer preview. Mirrors gradeForScore() server-side. */
function gradeForScore(total) {
  if (total >= 90) return 'A+';
  if (total >= 80) return 'A';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  return 'F';
}

function clampScore(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, n));
}

/**
 * Recompute every section subtotal and the grand total from state.evalScores.
 *
 * Section subtotals use the printed maxima of their own criteria. The grand
 * total is the plain sum of what the examiner awarded, shown against
 * `totalMax` (100) — no scaling or weighting, so 77 awarded reads 77/100.
 * Mirrors scoreEvaluation() server-side.
 */
function recomputeEvaluationTotals(sections) {
  const sectionTotals = {};
  let total = 0;
  for (const section of sections) {
    let sum = 0;
    for (const field of section.fields) {
      sum += clampScore(state.evalScores[field.key] ?? 0, field.max);
    }
    sectionTotals[section.key] = sum;
    total += sum;
  }
  return { sectionTotals, total };
}

// ----- Public evaluator form (opened from a scanned QR code) -----

function renderPublicEvaluationPage(app) {
  const parts = window.location.pathname.split('/').filter(Boolean);
  let token = parts[1] || '';
  if (!token) {
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token') || '';
  }

  if (!token) {
    app.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-fypilot-900 to-indigo-950 py-12 px-4 sm:px-6 flex items-center justify-center">
        <div class="max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 text-center fade-in">
          <i class="fas fa-qrcode text-4xl text-fypilot-600 mb-3 block"></i>
          <h2 class="text-lg font-bold text-gray-900">FYP Evaluation Portal</h2>
          <p class="text-xs text-gray-500 mt-1 mb-4">Please enter the 32-character evaluation token from your evaluation QR code or link.</p>
          <div class="flex gap-2">
            <input type="text" id="manual-eval-token" placeholder="Paste 32-char token..." class="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-fypilot-500 focus:outline-none" />
            <button onclick="const t = document.getElementById('manual-eval-token').value.trim(); if(t) { window.location.href = '/evaluate/' + t; }" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">Open</button>
          </div>
          <div class="mt-4 pt-4 border-t border-gray-100">
            <a href="/" class="text-xs text-fypilot-600 hover:underline font-semibold"><i class="fas fa-arrow-left mr-1"></i>Back to FYPilot Home</a>
          </div>
        </div>
      </div>`;
    return;
  }

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-fypilot-900 to-indigo-950 py-6 px-4 sm:px-6">
      <div class="max-w-3xl mx-auto" id="evaluation-form-root">
        <div class="text-center text-white/80 text-sm py-16">
          <i class="fas fa-spinner fa-spin text-2xl mb-3 block"></i>Loading evaluation form&hellip;
        </div>
      </div>
    </div>`;
  loadEvaluationForm(token);
}

async function loadEvaluationForm(token) {
  const root = document.getElementById('evaluation-form-root');
  if (!root) return;
  if (!/^[0-9a-f]{32}$/.test(token)) {
    root.innerHTML = evaluationFormMessage('This evaluation link is not valid', 'fa-link-slash');
    return;
  }

  try {
    const res = await api(`/evaluations/form/${token}`, { silentError: true });
    state.evalFormToken = token;
    state.evalPayload = res.data;
    state.evalScores = {};
    root.innerHTML = renderEvaluationFormMarkup();
    attachEvaluationFormListeners();
  } catch (e) {
    root.innerHTML = evaluationFormMessage(e.message || 'This evaluation link is not valid', 'fa-link-slash');
  }
}

function evaluationFormMessage(message, icon = 'fa-triangle-exclamation') {
  return `
    <div class="bg-white rounded-2xl shadow-xl p-8 text-center fade-in">
      <i class="fas ${icon} text-3xl text-rose-500 mb-3 block"></i>
      <p class="text-sm font-bold text-gray-900">${escapeHtml(message)}</p>
      <p class="text-xs text-gray-500 mt-2">Please ask your coordinator for a fresh evaluation QR code.</p>
    </div>`;
}

function renderEvaluationFormMarkup() {
  const d = state.evalPayload;
  if (!d || !d.criteria) return evaluationFormMessage('Evaluation form unavailable', 'fa-circle-exclamation');
  const { criteria } = d;
  const maxTotal = criteria.totalMax || 100;
  const group = d.group || {};
  const members = d.members || [];
  const project = d.project || {};

  const headerValues = {
    members: members.map((m) => `${m.name} (${m.studentId || 'ID pending'})`).join('\n') || 'No members listed',
    project_title: project.title || 'Untitled Project',
    supervisor: d.supervisor || 'Not assigned',
  };

  const headerInputs = (criteria.headerFields || []).map((f) => {
    const span = f.span === 2 ? 'sm:col-span-2' : '';
    if (f.type === 'readonly') {
      return `
      <div class="${span}">
        <label class="block text-[11px] font-bold text-gray-600 mb-1">${escapeHtml(f.label)}</label>
        <div class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 whitespace-pre-line min-h-[2.5rem]">${escapeHtml(headerValues[f.key] || '\u2014')}</div>
      </div>`;
    }
    if (f.type === 'select') {
      const options = (f.options || []).map((option) =>
        `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`
      ).join('');
      return `
      <div class="${span}">
        <label class="block text-[11px] font-bold text-gray-600 mb-1">${escapeHtml(f.label)}${f.required ? ' <span class="text-rose-500">*</span>' : ''}</label>
        <select data-eval-meta="${escapeHtml(f.key)}" ${f.required ? 'required' : ''}
                class="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none">
          <option value="">Select department</option>
          ${options}
        </select>
      </div>`;
    }
    return `
      <div class="${span}">
        <label class="block text-[11px] font-bold text-gray-600 mb-1">${escapeHtml(f.label)}${f.required ? ' <span class="text-rose-500">*</span>' : ''}</label>
        <input type="${f.type === 'date' ? 'date' : 'text'}"
               data-eval-meta="${escapeHtml(f.key)}"
               ${f.required ? 'required' : ''}
               placeholder="${escapeHtml(f.placeholder || '')}"
               class="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" />
      </div>`;
  }).join('');

  const sections = (criteria.sections || []).map((s, idx) => `
    <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div class="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <h3 class="font-bold text-gray-900 text-sm flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-fypilot-100 text-fypilot-700 flex items-center justify-center text-[11px] font-extrabold">${idx + 1}</span>
          <i class="fas ${escapeHtml(s.icon)} text-fypilot-500 text-xs"></i>${escapeHtml(s.label)}
        </h3>
        <span class="text-[11px] font-bold text-gray-500"><span id="eval-sec-${escapeHtml(s.key)}">0</span>/${s.max}</span>
      </div>
      ${s.fields.map((f) => `
        <div class="flex items-center justify-between gap-4">
          <label class="text-xs text-gray-700 flex-1 min-w-0">${escapeHtml(f.label)}</label>
          <input type="number" inputmode="numeric" min="0" max="${f.max}" step="1" value="0"
                 data-eval-score="${escapeHtml(f.key)}"
                 class="w-20 px-2.5 py-1.5 text-right text-sm font-bold bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-fypilot-500 focus:outline-none" />
          <span class="text-[11px] text-gray-400 font-semibold w-8">/${f.max}</span>
        </div>`).join('')}
    </div>`).join('');

  const footerFields = (criteria.footerFields || []).map((f) => {
    if (f.type === 'textarea') {
      return `
      <div>
        <label class="block text-[11px] font-bold text-gray-600 mb-1">${escapeHtml(f.label)}</label>
        <textarea data-eval-meta="comments" rows="3" placeholder="${escapeHtml(f.placeholder || '')}"
                  class="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none resize-y"></textarea>
      </div>`;
    }
    if (f.type === 'computed') {
      return `
      <div>
        <label class="block text-[11px] font-bold text-gray-600 mb-1">${escapeHtml(f.label)}</label>
        <div class="w-full px-3 py-2 bg-fypilot-50 border border-fypilot-200 rounded-xl text-sm font-extrabold text-fypilot-800">
          <span id="eval-field-${escapeHtml(f.key)}">&mdash;</span>
        </div>
      </div>`;
    }
    if (f.type === 'signature') {
      return `
      <label class="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
        <input type="checkbox" data-eval-meta="signature_confirmed" class="mt-0.5 w-4 h-4 rounded border-gray-300 text-fypilot-600 focus:ring-fypilot-500" />
        <span class="text-xs text-gray-700">${escapeHtml(f.label)} <span class="text-rose-500">*</span><span class="block text-[10px] text-gray-400 mt-0.5">Tick to confirm the paper carries your signature.</span></span>
      </label>`;
    }
    return `
      <div>
        <label class="block text-[11px] font-bold text-gray-600 mb-1">${escapeHtml(f.label)}${f.required ? ' <span class="text-rose-500">*</span>' : ''}</label>
        <input type="text" data-eval-meta="${escapeHtml(f.key)}" ${f.required ? 'required' : ''}
               placeholder="${escapeHtml(f.placeholder || '')}"
               class="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none" />
      </div>`;
  }).join('');

  return `
  <div class="bg-white rounded-2xl shadow-2xl overflow-hidden fade-in">
    <div class="bg-gradient-to-r from-fypilot-900 via-indigo-900 to-slate-900 text-white px-5 sm:px-7 py-5">
      <div class="flex items-center gap-3">
        <img src="/images/fypilotlogo.png" alt="FYPilot" class="w-10 h-10 object-contain bg-white/10 rounded-xl p-1" />
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-fypilot-300">External Evaluation Form</p>
          <h1 class="text-lg sm:text-xl font-bold leading-tight">${escapeHtml(group.name || 'FYP Group')}</h1>
        </div>
      </div>
    </div>

    <div class="p-5 sm:p-7 space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-200">
        ${headerInputs}
      </div>

      <div class="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-fypilot-50 border border-fypilot-200 sticky top-2 z-10">
        <span class="text-xs font-bold text-fypilot-800">Total Marks Obtained</span>
        <span class="text-xl font-extrabold text-fypilot-800">
          <span id="eval-total-live">0</span><span class="text-sm text-fypilot-500">/${maxTotal}</span>
        </span>
      </div>

      <div class="space-y-4">${sections}</div>

      <div class="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-4">
        <h3 class="font-bold text-gray-900 text-sm">Declaration</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${footerFields}</div>
      </div>

      <button id="eval-submit-btn" onclick="submitEvaluationForm()"
              class="w-full bg-gradient-to-r from-fypilot-600 to-indigo-600 hover:from-fypilot-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-fypilot-500/25 transition-all flex items-center justify-center gap-2">
        <i class="fas fa-paper-plane"></i> Submit Evaluation
      </button>
      <p class="text-[10px] text-gray-400 text-center">Scores are validated on the server. The total above is the plain sum of the marks awarded.</p>
    </div>
  </div>`;
}

function attachEvaluationFormListeners() {
  for (const input of document.querySelectorAll('[data-eval-score]')) {
    input.addEventListener('input', () => {
      const max = Number(input.getAttribute('max')) || 0;
      let value = Number(input.value);
      if (!Number.isFinite(value)) value = 0;
      if (value < 0) { value = 0; input.value = 0; }
      if (value > max) { value = max; input.value = max; }
      state.evalScores[input.dataset.evalScore] = value;
      updateEvaluationFormTotals();
    });
  }
  updateEvaluationFormTotals();
}

function updateEvaluationFormTotals() {
  const criteria = state.evalPayload && state.evalPayload.criteria;
  if (!criteria) return;
  const maxTotal = criteria.totalMax || 100;
  const { sectionTotals, total } = recomputeEvaluationTotals(criteria.sections || []);

  const totalEl = document.getElementById('eval-total-live');
  if (totalEl) totalEl.textContent = String(total);

  for (const s of criteria.sections || []) {
    const el = document.getElementById(`eval-sec-${s.key}`);
    if (el) el.textContent = String(sectionTotals[s.key]);
  }

  const totalField = document.getElementById('eval-field-total');
  if (totalField) totalField.textContent = `${total} / ${maxTotal}`;

  const gradeField = document.getElementById('eval-field-grade');
  if (gradeField) {
    const grade = gradeForScore(total);
    gradeField.textContent = grade;
    gradeField.className = `px-2.5 py-0.5 rounded-full text-xs font-bold border ${evaluationGradeClass(grade)}`;
  }
}

async function submitEvaluationForm() {
  const criteria = state.evalPayload && state.evalPayload.criteria;
  if (!criteria || state.evalSubmitting) return;

  const scores = {};
  for (const s of criteria.sections || []) {
    for (const f of s.fields) {
      const value = clampScore(state.evalScores[f.key] ?? 0, f.max);
      if (value <= 0) {
        showToast(`Please award marks for "${f.label}"`, 'warning');
        return;
      }
      scores[f.key] = value;
    }
  }

  const meta = {};
  for (const el of document.querySelectorAll('[data-eval-meta]')) {
    const key = el.dataset.evalMeta;
    meta[key] = el.type === 'checkbox' ? el.checked : String(el.value || '').trim();
  }
  if (meta.signature_confirmed !== true) {
    showToast('Please confirm the examiner signature', 'warning');
    return;
  }

  const btn = document.getElementById('eval-submit-btn');
  state.evalSubmitting = true;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting&hellip;'; }

  try {
    const res = await api('/evaluations/submit', {
      method: 'POST',
      body: JSON.stringify({
        token: state.evalFormToken,
        scores,
        examiner_name: meta.examiner_name,
        examiner_id: meta.examiner_id,
        examiner_designation: meta.examiner_designation,
        examiner_email: meta.examiner_email,
        department: meta.department,
        degree_subject: meta.degree_subject,
        presentation_date: meta.presentation_date,
        signature_confirmed: true,
        comments: meta.comments,
        suggestions: meta.suggestions,
      }),
    });

    const root = document.getElementById('evaluation-form-root');
    const d = res.data || {};
    if (root) {
      root.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl p-8 text-center fade-in">
          <i class="fas fa-circle-check text-4xl text-emerald-500 mb-3 block"></i>
          <h2 class="text-lg font-bold text-gray-900">Evaluation submitted</h2>
          <p class="text-sm text-gray-600 mt-1">
            ${escapeHtml(d.total)}/${escapeHtml(String(d.maxTotal))} &bull; Grade <b>${escapeHtml(d.grade)}</b>
          </p>
          <p class="text-xs text-gray-500 mt-3">You may close this page.</p>
        </div>`;
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Evaluation'; }
    state.evalSubmitting = false;
    showToast(e.message || 'Could not submit the evaluation', 'error');
  }
}

// ----- Shared results: supervisor, staff and students read the same records -----

async function loadExternalEvaluations(projectId, force = false) {
  if (!projectId) return;
  if (!force && state.externalEvalProjectId === projectId && (state.externalEvaluations || state.externalEvalError)) return;

  state.externalEvalProjectId = projectId;
  state.externalEvalLoading = true;
  renderExternalEvaluationsInto('external-evaluations-card');

  try {
    const res = await api(`/evaluations/project/${projectId}`, { silentError: true });
    state.externalEvaluations = res.data.evaluations || [];
    state.externalEvalSections = res.data.sections || [];
    state.externalEvalMax = res.data.maxTotal || 100;
    state.externalEvalError = null;
  } catch (e) {
    state.externalEvaluations = null;
    state.externalEvalError = e.message || 'Could not load evaluation results';
  } finally {
    state.externalEvalLoading = false;
    renderExternalEvaluationsInto('external-evaluations-card');
  }
}

function renderExternalEvaluationsInto(cardId) {
  const host = document.getElementById(cardId);
  if (!host) return;
  const body = host.querySelector('[data-eval-results]');
  if (body) body.innerHTML = renderExternalEvaluationResults();
}

function renderExternalEvaluationResults() {
  if (state.externalEvalLoading) {
    return '<p class="text-xs text-gray-400 italic py-2"><i class="fas fa-spinner fa-spin mr-1.5"></i>Loading evaluation results&hellip;</p>';
  }
  if (state.externalEvalError) {
    return `<p class="text-xs text-amber-600 italic py-2"><i class="fas fa-triangle-exclamation mr-1.5"></i>${escapeHtml(state.externalEvalError)}</p>`;
  }

  const evaluations = state.externalEvaluations || [];
  if (!evaluations.length) {
    return `
    <div class="text-center py-6 px-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50">
      <i class="fas fa-qrcode text-2xl text-gray-300 mb-2 block"></i>
      <p class="text-xs text-gray-500 font-semibold">No external evaluation submitted yet</p>
      <p class="text-[11px] text-gray-400 mt-1">Share the group&rsquo;s evaluation QR with the external examiner &mdash; their score appears here as soon as they submit.</p>
    </div>`;
  }

  const maxTotal = state.externalEvalMax || 100;
  const sectionByKey = {};
  for (const s of state.externalEvalSections || []) sectionByKey[s.key] = s;

  return evaluations.map((ev) => {
    const score = Number(ev.total_score || 0);
    const breakdown = EVAL_SECTION_TOTAL_FIELDS.map(({ key, column }) => {
      const section = sectionByKey[key];
      const value = Number(ev[column] || 0);
      const max = section ? section.max : 0;
      const pct = max > 0 ? Math.round((value / max) * 100) : 0;
      return `
      <div>
        <div class="flex items-center justify-between gap-2 text-[11px]">
          <span class="text-gray-600 font-semibold truncate">${escapeHtml(section ? section.label : key)}</span>
          <span class="text-gray-500 font-bold shrink-0">${value}/${max}</span>
        </div>
        <div class="h-1.5 mt-1 rounded-full bg-gray-200 overflow-hidden">
          <div class="h-full bg-fypilot-500 rounded-full" style="width:${pct}%"></div>
        </div>
      </div>`;
    }).join('');

    return `
    <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-bold text-gray-900 flex items-center gap-2 min-w-0">
            <i class="fas fa-user-tie text-indigo-600"></i>
            <span class="truncate">${escapeHtml(ev.examiner_name || 'External examiner')}</span>
          </p>
          <p class="text-[11px] text-gray-500 mt-0.5">
            ${escapeHtml(ev.department || 'External Examiner')}${ev.degree_subject ? ` &bull; B.Sc. ${escapeHtml(ev.degree_subject)}` : ''}
            ${ev.presentation_date ? ` &bull; ${escapeHtml(ev.presentation_date)}` : ''}
          </p>
          <p class="text-[10px] text-gray-400 font-mono mt-0.5">Submitted ${new Date(ev.created_at || ev.evaluation_date || Date.now()).toLocaleString()}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="px-2.5 py-1 rounded-xl bg-fypilot-50 text-fypilot-700 text-xs font-extrabold border border-fypilot-200">
            ${score}<span class="text-[10px] text-gray-400 font-bold">/${maxTotal}</span>
          </span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold border ${evaluationGradeClass(ev.grade)}">${escapeHtml(ev.grade || '—')}</span>
          ${isExecutiveRole(state.currentUser?.role) ? `
          <button onclick="deleteSingleEvaluation('${ev.id}')" title="Delete this evaluation entry" class="px-2 py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-all text-xs font-bold flex items-center gap-1">
            <i class="fas fa-trash-alt"></i>
          </button>` : ''}
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 pt-1">${breakdown}</div>

      ${ev.comments ? `
      <div class="pt-2 border-t border-gray-100">
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Examiner comments</p>
        <p class="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(ev.comments)}</p>
      </div>` : ''}
      ${ev.suggestions ? `
      <div class="pt-2 border-t border-gray-100">
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Suggestions</p>
        <p class="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(ev.suggestions)}</p>
      </div>` : ''}
    </div>`;
  }).join('');

  const bulkDanger = (isExecutiveRole(state.currentUser?.role) && evaluations.length > 0) ? `
  <div class="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
    <div>
      <div class="text-xs text-rose-800 font-bold flex items-center gap-1.5 uppercase tracking-wider">
        <i class="fas fa-exclamation-triangle text-rose-500"></i> Evaluation Danger Zone
      </div>
      <p class="text-[11px] text-rose-600 mt-0.5">Delete all submitted evaluations for this project and group permanently.</p>
    </div>
    <button onclick="bulkDeleteAll('evaluations')" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0">
      <i class="fas fa-trash-alt"></i> Delete All Evaluations
    </button>
  </div>` : '';

  return cards + bulkDanger;
}

// ----- Group profile: issue and share the evaluator QR code -----

async function loadEvaluationLink(groupId, force = false) {
  if (!groupId) return;
  if (!force && state.evalLink && state.evalLink.groupId === groupId) return;

  state.evalLinkLoading = true;
  renderEvaluationLinkInto('evaluation-qr-panel');
  try {
    const res = await api(`/evaluations/link/${groupId}`, { silentError: true });
    state.evalLink = res.data;
  } catch (e) {
    state.evalLink = null;
  } finally {
    state.evalLinkLoading = false;
    renderEvaluationLinkInto('evaluation-qr-panel');
  }
}

function renderEvaluationLinkInto(panelId) {
  const host = document.getElementById(panelId);
  if (!host) return;
  host.innerHTML = renderEvaluationPanelBody();
  drawEvaluationQr();
}

/**
 * The QR library is bundled from the `qrcode` npm package and served from our
 * own origin, so this works with no internet at all. The shell loads it with
 * `defer`, which can land after app.js, so wait for that tag when it is
 * present and otherwise inject it on demand. The timeout means a stalled or
 * already-finished tag can never leave the panel waiting forever.
 */
const QR_LIB_SRC = '/static/vendor/qrcode.min.js?v=20260929-1';
let qrLibPromise = null;

function qrLibReady() {
  return !!(window.QRCode && typeof window.QRCode.toCanvas === 'function');
}

function loadQrLib() {
  if (qrLibReady()) return Promise.resolve(window.QRCode);
  if (qrLibPromise) return qrLibPromise;

  qrLibPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (qrLibReady()) resolve(window.QRCode);
      else reject(new Error('QR library loaded but toCanvas is missing'));
    };
    const fail = () => reject(new Error('QR library failed to load'));

    // Belt and braces: never leave the caller hanging on a dead tag.
    const timer = setTimeout(fail, 6000);

    const existing = document.querySelector('script[data-qr-lib]');
    const target = existing || (() => {
      const tag = document.createElement('script');
      tag.src = QR_LIB_SRC;
      tag.async = true;
      tag.dataset.qrLib = '1';
      document.head.appendChild(tag);
      return tag;
    })();

    target.addEventListener('load', () => { clearTimeout(timer); finish(); });
    target.addEventListener('error', () => { clearTimeout(timer); fail(); });
  });

  // Let a later attempt retry if the first load failed.
  qrLibPromise.catch(() => { qrLibPromise = null; });
  return qrLibPromise;
}

/** Shared so the on-screen code and the downloaded PNG look identical. */
function qrRenderOptions(size) {
  return {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  };
}

/**
 * Draw the evaluator link as a QR code. The library is local, so this
 * succeeds offline; if it somehow cannot, the copyable link beside it still
 * lets the examiner open the form.
 */
async function drawEvaluationQr() {
  const canvas = document.getElementById('evaluation-qr-canvas');
  const link = state.evalLink;
  if (!canvas || !link) return;
  const qrUrl = link.token ? `${window.location.origin}/evaluate/${link.token}` : link.url;
  if (!qrUrl) return;

  try {
    const lib = await loadQrLib();
    // The panel may have been re-rendered while the library was loading.
    if (!document.body.contains(canvas)) return;
    await lib.toCanvas(canvas, qrUrl, qrRenderOptions(176));
  } catch (e) {
    console.error('QR generation failed:', e);
  }
}

/** Jump from a project straight to the group&rsquo;s QR panel. */
async function openGroupEvaluationQr() {
  const groupId = state.projectGroupId;
  if (!groupId) {
    showToast('This project is not linked to a group yet', 'warning');
    return;
  }
  await loadGroupDetail(groupId);
  setTimeout(() => {
    const panel = document.getElementById('evaluation-qr-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 250);
}

function renderEvaluationPanelBody() {
  if (state.evalLinkLoading) {
    return '<p class="text-xs text-gray-400 italic py-2"><i class="fas fa-spinner fa-spin mr-1.5"></i>Preparing evaluation link&hellip;</p>';
  }

  const link = state.evalLink;
  if (!link) {
    return `
    <div class="text-center py-6 px-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50">
      <i class="fas fa-qrcode text-2xl text-gray-300 mb-2 block"></i>
      <p class="text-xs text-gray-500 font-semibold">Evaluation link unavailable</p>
      <p class="text-[11px] text-gray-400 mt-1">Only coordinators, HODs, Deans and admins can issue an evaluation link.</p>
    </div>`;
  }

  const currentOrigin = window.location.origin;
  const evalUrl = link.token ? `${currentOrigin}/evaluate/${link.token}` : (link.url || '');

  return `
  <div class="flex flex-col sm:flex-row gap-5 sm:items-start">
    <div class="shrink-0 mx-auto sm:mx-0 p-3 bg-white border-2 border-fypilot-200 rounded-2xl">
      <div class="w-44 h-44 flex items-center justify-center">
        <canvas id="evaluation-qr-canvas" width="176" height="176" class="w-44 h-44 block"></canvas>
      </div>
    </div>
    <div class="min-w-0 flex-1 space-y-3">
      <div>
        <p class="text-xs font-bold text-gray-900">External Examiner Evaluation</p>
        <p class="text-[11px] text-gray-500 mt-0.5">${link.evaluationCount || 0} submission${link.evaluationCount === 1 ? '' : 's'} received. Print or share this QR so the examiner can score the group on their phone.</p>
      </div>
      <div class="flex items-center gap-2">
        <input readonly value="${escapeHtml(evalUrl)}" class="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-[11px] font-mono text-gray-700" />
        <button onclick="copyEvaluationLink()" class="shrink-0 bg-fypilot-600 hover:bg-fypilot-700 text-white px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5"><i class="fas fa-copy"></i> Copy</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="openEvaluationLink()" class="bg-fypilot-600 hover:bg-fypilot-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5"><i class="fas fa-external-link-alt"></i> Open Link</button>
        <button onclick="downloadEvaluationQr()" class="border border-fypilot-200 text-fypilot-700 hover:bg-fypilot-50 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5"><i class="fas fa-download"></i> Download PNG</button>
        <button onclick="printEvaluationQr()" class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5"><i class="fas fa-print"></i> Print QR</button>
        ${['coordinator', 'hod', 'dean', 'admin'].includes(state.currentUser && state.currentUser.role) ? `
          <button onclick="regenerateEvaluationLink()" class="border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5"><i class="fas fa-rotate"></i> Rotate link</button>
          <button onclick="bulkDeleteAll('evaluations')" class="border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5"><i class="fas fa-trash-alt"></i> Delete All Evaluations</button>` : ''}
      </div>
    </div>
  </div>`;
}

/** Open the evaluator form itself, to prove the link works before printing it. */
function openEvaluationLink() {
  const link = state.evalLink;
  if (!link) return;
  const url = link.token ? `${window.location.origin}/evaluate/${link.token}` : link.url;
  if (!url) return;
  window.open(url, '_blank', 'noopener');
}

function evaluationQrFileName() {
  const link = state.evalLink;
  const base = String((link && (link.groupName || 'group')) || 'group')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'group';
  const date = new Date().toISOString().slice(0, 10);
  return `fyp-eval-qr-${base}-${date}.png`;
}

/**
 * Save the QR as a PNG. Rendered at 1024px rather than reusing the on-screen
 * canvas so it stays sharp when the coordinator prints or pastes it.
 */
async function downloadEvaluationQr() {
  const link = state.evalLink;
  if (!link || !link.url) return;

  let dataUrl = '';
  try {
    const lib = await loadQrLib();
    dataUrl = await lib.toDataURL(link.url, qrRenderOptions(1024));
  } catch (e) {
    // Fall back to whatever is already on screen rather than failing outright.
    const canvas = document.getElementById('evaluation-qr-canvas');
    if (canvas) dataUrl = canvas.toDataURL('image/png');
  }

  if (!dataUrl) {
    showToast('QR code is still loading, try again in a moment', 'warning');
    return;
  }

  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = evaluationQrFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('QR code downloaded', 'success');
  } catch (e) {
    showToast('Could not download the QR code', 'error');
  }
}

/** Print just the QR card, not the whole dashboard. */
function printEvaluationQr() {
  const link = state.evalLink;
  if (!link) return;
  const panel = document.getElementById('evaluation-qr-panel');
  if (!panel) return;

  const w = window.open('', '_blank', 'width=680,height=820');
  if (!w) {
    showToast('Allow pop-ups to print the QR code', 'warning');
    return;
  }
  w.document.write(`<!DOCTYPE html><html><head><title>Evaluation QR</title>
    <style>
      body{font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:28px;text-align:center;color:#111827}
      h1{font-size:18px;margin:0 0 4px}
      p.sub{font-size:12px;color:#64748b;margin:0 0 18px}
      .card{display:inline-block;padding:18px;border:2px solid #0e7490;border-radius:18px}
      .url{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;color:#475569;margin-top:14px;word-break:break-all}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>${escapeHtml(link.groupName || 'Group')}</h1>
    <p class="sub">External Examiner Evaluation</p>
    <div class="card"><img alt="" id="qr"></div>
    <div class="url">${escapeHtml(link.url || '')}</div>
    <script src="${QR_LIB_SRC}"></script>
    <script>
      QRCode.toDataURL(${JSON.stringify(link.url || '')}, { width: 320, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
        .then(function (d) { document.getElementById('qr').src = d; })
        .catch(function () {});
    </script>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 700);
}

async function copyEvaluationLink() {
  const link = state.evalLink;
  if (!link) return;
  const url = link.token ? `${window.location.origin}/evaluate/${link.token}` : (link.url || '');
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Evaluation link copied', 'success');
  } catch (e) {
    showToast('Could not copy the link', 'error');
  }
}

async function regenerateEvaluationLink() {
  const link = state.evalLink;
  if (!link) return;
  if (!window.confirm('Rotate the evaluation link? Any previously printed QR code will stop working.')) return;
  try {
    const res = await api(`/evaluations/link/${link.groupId}/regenerate`, { method: 'POST' });
    state.evalLink = { ...(state.evalLink || {}), ...res.data, evaluationCount: 0 };
    renderEvaluationLinkInto('evaluation-qr-panel');
    showToast(res.message || 'New evaluation link generated', 'success');
  } catch (e) { /* handled by api helper */ }
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

    <!-- Danger Zone (Executive only) -->
    ${isExecutiveRole(state.currentUser?.role) ? `
    <div class="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-4">
        <i class="fas fa-exclamation-triangle text-rose-500"></i>
        <h3 class="font-bold text-rose-800 text-sm uppercase tracking-wider">Danger Zone</h3>
      </div>
      <div class="flex flex-wrap gap-3">
        <button onclick="bulkDeleteAll('projects')" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-folder-minus"></i> Delete All Projects
        </button>
      </div>
      <p class="text-xs text-rose-600 mt-3"><i class="fas fa-info-circle mr-1"></i>Permanently deletes all active FYP projects, milestones, task logs, and meeting minutes.</p>
    </div>` : ''}
  </div>`;
}

// ===== Project Detail =====
function renderProjectDetail() {
  const p = state.selectedProject;
  if (!p) return '<p class="p-6 text-gray-500">No project selected</p>';

  const healthColors = { healthy: 'bg-emerald-100 text-emerald-700 border-emerald-200', at_risk: 'bg-amber-100 text-amber-700 border-amber-200', critical: 'bg-rose-100 text-rose-700 border-rose-200' };
  const healthIcons = { healthy: 'fa-check-circle text-emerald-500', at_risk: 'fa-exclamation-triangle text-amber-500', critical: 'fa-times-circle text-rose-500' };
  const executiveProjectRole = isExecutiveRole(state.currentUser?.role) || state.currentUser?.role === 'supervisor';
  const isStudentMember = state.currentUser.role === 'student' && (p.members || []).some(m => m.id === state.currentUser.id);

  return `
  <div class="fade-in space-y-6">
    <button onclick="navigate('projects')" class="text-xs font-semibold text-gray-500 hover:text-gray-800 inline-flex items-center gap-1.5 bg-white border px-3 py-1.5 rounded-xl shadow-sm">
      <i class="fas fa-arrow-left text-xs"></i> Back to Projects
    </button>

    <!-- EXECUTIVE POWER CONTROLS FOR EXECUTIVE USERS & SUPERVISOR -->
    ${(isExecutiveRole(state.currentUser.role) || state.currentUser.role === 'supervisor') ? `
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

      <!-- Supervisor Allocation Control (Executive only) -->
      ${isExecutiveRole(state.currentUser.role) ? `
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
      <input type="file" id="gallery-file-input" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" class="hidden" onchange="handleGalleryUpload('${p.id}', event)" />
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
      ${(isExecutiveRole(state.currentUser.role) || state.currentUser.role === 'supervisor') ? `
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

    <!-- Meeting Verification & Meeting Logs -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-calendar-check text-emerald-600"></i> Meeting Verification &amp; Logs</h3>
            <span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">${p.verifiedMeetingsCount || 0} Verified</span>
          </div>
          <p class="text-[11px] text-gray-500 mt-0.5"><i class="fas fa-info-circle text-blue-500 mr-1"></i>Meetings start as 'Pending Verification'. Verified count increments only after supervisor approval.</p>
        </div>
        ${isStudentMember || (state.currentUser && state.currentUser.role === 'student') ? `
          <button onclick="showRecordMeetingModal('${p.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
            <i class="fas fa-plus-circle"></i> Add Meeting Record
          </button>
        ` : ''}
      </div>

      <div class="space-y-3">
        ${(p.meetings || []).length ? p.meetings.map(m => {
          const statusColors = {
            verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            pending: 'bg-amber-100 text-amber-800 border-amber-200',
            revision_requested: 'bg-purple-100 text-purple-800 border-purple-200',
            rejected: 'bg-rose-100 text-rose-800 border-rose-200'
          };
          const statusLabels = {
            verified: '<i class="fas fa-check-circle mr-1"></i>Verified',
            pending: '<i class="fas fa-clock mr-1"></i>Pending Verification',
            revision_requested: '<i class="fas fa-edit mr-1"></i>Changes Requested',
            rejected: '<i class="fas fa-times-circle mr-1"></i>Rejected'
          };
          const st = m.verification_status || 'pending';
          return `
            <div class="p-4 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-2">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-gray-900 text-sm">${escapeHtml(m.title || 'Supervisor Meeting')}</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusColors[st] || 'bg-gray-100'}">${statusLabels[st] || st}</span>
                </div>
                <span class="text-xs font-mono text-gray-500"><i class="far fa-calendar-alt mr-1"></i>${m.meeting_date || m.scheduled_at || 'N/A'}</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
                ${m.discussion ? `<div><span class="font-bold text-gray-700 block">Discussion:</span><span class="text-gray-600">${escapeHtml(m.discussion)}</span></div>` : ''}
                ${m.work_discussed ? `<div><span class="font-bold text-gray-700 block">Work Discussed:</span><span class="text-gray-600">${escapeHtml(m.work_discussed)}</span></div>` : ''}
                ${m.action_items ? `<div><span class="font-bold text-gray-700 block">Action Items:</span><span class="text-gray-600">${escapeHtml(m.action_items)}</span></div>` : ''}
                ${m.next_meeting_plan ? `<div><span class="font-bold text-gray-700 block">Next Meeting Plan:</span><span class="text-gray-600">${escapeHtml(m.next_meeting_plan)}</span></div>` : ''}
              </div>

              ${m.supervisor_feedback ? `
                <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 text-xs text-indigo-900 mt-2">
                  <span class="font-bold block text-indigo-800"><i class="fas fa-comment-dots mr-1"></i>Supervisor Feedback:</span>
                  <span>${escapeHtml(m.supervisor_feedback)}</span>
                </div>
              ` : ''}

              ${(state.currentUser.role === 'supervisor' || isExecutiveRole(state.currentUser.role)) ? `
                <div class="flex justify-end pt-2">
                  <button onclick="showVerifyMeetingModal('${p.id}', '${m.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1">
                    <i class="fas fa-user-check"></i> Review &amp; Verify Meeting
                  </button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('') : '<p class="text-xs text-gray-400">No meeting records added yet. Add a meeting record after meeting your supervisor.</p>'}
      </div>
    </div>

    <!-- External / QR Evaluation results -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4" id="external-evaluations-card">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 class="font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-star text-amber-500"></i> Student Evaluations &amp; Grading</h3>
          <p class="text-[11px] text-gray-500 mt-0.5">Scores submitted by the external examiner through the evaluation QR form.</p>
        </div>
        <div class="flex flex-wrap gap-2 shrink-0 self-start sm:self-auto">
          <button onclick="loadExternalEvaluations('${p.id}', true)" class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
            <i class="fas fa-rotate"></i> Refresh
          </button>
          ${(state.currentUser.role === 'supervisor' || isExecutiveRole(state.currentUser.role)) ? `
            <button onclick="openGroupEvaluationQr()" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5">
              <i class="fas fa-qrcode"></i> External / QR Evaluation
            </button>
          ` : ''}
        </div>
      </div>

      <div data-eval-results class="space-y-3">${renderExternalEvaluationResults()}</div>

      ${(p.evaluations || []).length ? `
      <details class="text-xs text-gray-500 border-t border-gray-100 pt-3">
        <summary class="cursor-pointer font-semibold text-gray-400 hover:text-gray-600">Earlier supervisor feedback (${p.evaluations.length})</summary>
        <div class="space-y-3 mt-3">
          ${p.evaluations.map(ev => `
            <div class="p-4 rounded-2xl border border-amber-200/70 bg-amber-50/30 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-gray-900 text-sm"><i class="fas fa-user-graduate text-indigo-600 mr-1.5"></i>${escapeHtml(ev.student_name || 'Student')}</span>
                  ${ev.grade ? `<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">Grade: ${escapeHtml(ev.grade)}</span>` : ''}
                  ${ev.score !== null && ev.score !== undefined ? `<span class="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">Score: ${ev.score}/100</span>` : ''}
                </div>
                <span class="text-[10px] text-gray-400 font-mono">${new Date(ev.created_at || ev.evaluation_date).toLocaleDateString()}</span>
              </div>
              <p class="text-xs text-gray-700 leading-relaxed">${escapeHtml(ev.comments)}</p>
              <p class="text-[10px] text-gray-400 italic">Evaluated by: ${escapeHtml(ev.supervisor_name || 'Supervisor')}</p>
            </div>
          `).join('')}
        </div>
      </details>` : ''}
    </div>
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
  if (!validateUploadedFile(file, {
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
    maxBytes: 1000 * 1024,
    label: 'project image'
  })) return;
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
  const isExec = isExecutiveRole(state.currentUser.role) || state.currentUser.role === 'supervisor';
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
      ${isExecutiveRole(state.currentUser.role) ? `
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

    ${isExecutiveRole(state.currentUser.role) ? `
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

async function loadAuditLogs() {
  try {
    const res = await api('/audit/logs');
    const logs = res.data || [];
    const container = document.getElementById('audit-logs-container');
    if (!container) return;

    if (!logs.length) {
      container.innerHTML = '<p class="text-sm text-gray-500">No audit events recorded yet.</p>';
      return;
    }

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-xs">
          <thead>
            <tr class="border-b border-gray-200 text-gray-600">
              <th class="py-2 pr-3 font-bold">Time</th>
              <th class="py-2 pr-3 font-bold">Actor</th>
              <th class="py-2 pr-3 font-bold">Action</th>
              <th class="py-2 pr-3 font-bold">Entity</th>
              <th class="py-2 pr-3 font-bold">Details</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => `
              <tr class="border-b border-gray-100 align-top">
                <td class="py-2 pr-3 text-gray-500 whitespace-nowrap">${new Date(log.created_at).toLocaleString()}</td>
                <td class="py-2 pr-3">
                  <div class="font-semibold text-gray-800">${log.actor_role || 'system'}</div>
                  <div class="text-[10px] text-gray-500">${log.actor_id || 'system'}</div>
                </td>
                <td class="py-2 pr-3">
                  <span class="inline-flex items-center rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 font-bold uppercase tracking-wide">${log.action}</span>
                </td>
                <td class="py-2 pr-3 text-gray-600">${log.entity_type || '—'}<div class="text-[10px] text-gray-400">${log.entity_id || '—'}</div></td>
                <td class="py-2 pr-3 text-gray-700 max-w-md">${log.details || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    console.error('Failed to load audit logs:', e);
    const container = document.getElementById('audit-logs-container');
    if (container) container.innerHTML = '<p class="text-sm text-rose-600">Unable to load audit logs.</p>';
  }
}

function exportAuditLogs() {
  if (!isAuditAccessRole(state.currentUser?.role)) return;
  window.open('/api/audit/logs/export?format=csv', '_blank');
}

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

    if (state.currentUser && isExecutiveRole(state.currentUser.role)) {
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
    // The group owning this project, so the QR panel can be opened from here.
    state.projectGroupId = (res.data && res.data.group_id) || null;
    navigate('project-detail', res.data);
    // External examiner results are a separate, slower request; the page is
    // already interactive while they load.
    loadExternalEvaluations(id, true);
  } catch (e) {
    console.error('Failed to load project:', e);
  }
}

async function loadSupervisors() {
  try {
    if (state.currentUser && isExecutiveRole(state.currentUser.role)) {
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
        <h1 class="text-2xl font-bold text-gray-900">${isExecutiveRole(role) ? 'Student Groups' : 'My Group'}</h1>
        <p class="text-gray-500 text-xs sm:text-sm mt-0.5">${isExecutiveRole(role) ? 'Review and approve FYP student teams (max 4 members each)' : 'Your FYP team — get it approved to submit one joint proposal'}</p>
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
  const isExecutive = isExecutiveRole(state.currentUser.role) || state.currentUser.role === 'supervisor';
  const isLeader = state.currentUser.role === 'student' && state.currentUser.id === g.leader_id;
  const canManage = isLeader && g.status === 'pending';
  const canDelete = (isLeader && g.status !== 'approved') || isExecutiveRole(state.currentUser.role);

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

    ${isExecutive ? `
    <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-bold text-gray-900"><i class="fas fa-qrcode text-fypilot-500 mr-2"></i>External Examiner Evaluation</h2>
        <button onclick="loadEvaluationLink('${g.id}', true)" class="text-xs bg-fypilot-50 text-fypilot-700 border border-fypilot-200 px-3 py-1.5 rounded-xl hover:bg-fypilot-100 font-semibold transition-colors flex items-center gap-1.5">
          <i class="fas fa-rotate"></i> Refresh
        </button>
      </div>
      <div id="evaluation-qr-panel" class="mt-4">${renderEvaluationPanelBody()}</div>
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
    <input type="file" id="avatar-file-input" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" class="hidden" onchange="handleAvatarUpload(event)" />
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
  if (!validateUploadedFile(file, {
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
    maxBytes: 2 * 1024 * 1024,
    label: 'profile photo'
  })) return;
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
  const isExecutive = isExecutiveRole(state.currentUser.role) || state.currentUser.role === 'supervisor';
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
    // The evaluation QR is staff-only, so it loads separately from the profile.
    if (isExecutiveRole(state.currentUser.role) || state.currentUser.role === 'supervisor') {
      loadEvaluationLink(id, true);
    }
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

function hasProposalForCurrentGroup() {
  if (!state.currentUser || state.currentUser.role !== 'student') return false;
  const groupId = state.myGroup && state.myGroup.id ? state.myGroup.id : null;
  if (!groupId) return false;
  return (state.proposals || []).some(p => String(p.group_id) === String(groupId));
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
  if (hasProposalForCurrentGroup()) {
    banner.innerHTML = `
      <div class="bg-slate-100 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 flex items-start gap-2">
        <i class="fas fa-lock mt-0.5"></i>
        <span>This group already has a proposal. New proposals are locked, and the submitted details cannot be changed after registration.</span>
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
    const [userRes, groupsRes, proposalsRes, projectsRes, studentProfileRes] = await Promise.all([
      api(`/users/${me.id}`).catch(() => null),
      api('/groups').catch(() => null),
      api('/proposals').catch(() => null),
      api('/projects').catch(() => null),
      me.role === 'student' ? api(`/users/${me.id}/student-profile`).catch(() => null) : Promise.resolve(null)
    ]);
    const user = (userRes && userRes.data) || me;
    const groups = (groupsRes && groupsRes.data) || [];
    const proposals = (proposalsRes && proposalsRes.data) || [];
    const projects = (projectsRes && projectsRes.data) || [];
    const sp = studentProfileRes && studentProfileRes.data ? studentProfileRes.data : null;

    const container = document.getElementById('profile-content');
    if (!container) return;

    let sections = '';

    if (me.role === 'student') {
      const g = (sp && sp.group) || groups[0] || null;
      const verifiedMeetingsCount = sp && sp.meetingStats ? sp.meetingStats.verifiedMeetings : 0;
      const pendingMeetingsCount = sp && sp.meetingStats ? sp.meetingStats.pendingMeetings : 0;

      sections += `
        <!-- Verified Meetings Metric Card -->
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 class="font-bold text-gray-900 text-sm mb-3"><i class="fas fa-handshake text-fypilot-500 mr-2"></i>Verified Supervisor Meetings</h3>
          <div class="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-center">
            <div class="text-3xl font-extrabold text-emerald-700">${verifiedMeetingsCount}</div>
            <div class="text-xs font-bold text-emerald-800 mt-1">Verified Meetings Count</div>
            <p class="text-[10px] text-emerald-600 mt-0.5">${pendingMeetingsCount} pending verification</p>
          </div>
        </div>

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
        <h3 class="font-bold text-gray-900 text-sm mb-3 flex items-center justify-between">
          <span><i class="fas fa-id-card text-fypilot-500 mr-2"></i>Personal Information</span>
          ${me.role === 'student' ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Read-Only Security</span>' : ''}
        </h3>
        <dl class="space-y-2.5">
          <div class="flex justify-between gap-3"><dt class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Full Name</dt><dd class="text-xs font-semibold text-gray-800 text-right">${user.name || me.name}</dd></div>
          <div class="flex flex-col gap-1 pt-1">
            <dt class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>University Email</span>
              ${me.role === 'student' ? '<span class="text-[10px] text-amber-600 font-bold"><i class="fas fa-lock mr-1"></i>Read-Only</span>' : ''}
            </dt>
            <dd>
              <div class="relative">
                <input type="email" value="${user.email || me.email}" ${me.role === 'student' ? 'readonly' : ''} class="w-full ${me.role === 'student' ? 'bg-gray-100 border border-gray-300 text-gray-700 font-mono text-xs cursor-not-allowed select-none' : 'border border-gray-200 text-xs'} rounded-xl px-3 py-2 pr-8" />
                ${me.role === 'student' ? '<i class="fas fa-lock absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>' : ''}
              </div>
              ${me.role === 'student' ? `
                <p class="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-1.5 mt-1 flex items-center gap-1 font-medium">
                  <i class="fas fa-exclamation-circle text-amber-500 shrink-0"></i> University Email is read-only and cannot be changed by the student.
                </p>
              ` : ''}
            </dd>
          </div>
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
  if (hasProposalForCurrentGroup()) {
    showToast('This group already has a proposal. A new proposal cannot be created after registration.', 'error');
    navigate('proposals');
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

  const defaultProposalTitle = (state.proposals || []).find(p => String(p.group_id) === String(g.id))?.title || `${g.name} Project`;

  container.innerHTML = `
  <div class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm fade-in max-w-2xl mx-auto">
    <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs text-emerald-700 flex items-start gap-2">
      <i class="fas fa-users mt-0.5"></i>
      <span>Submitting on behalf of group <b>"${g.name}"</b> — this proposal uses the original registration details for the group and project.</span>
    </div>
    <h2 class="text-lg font-bold text-gray-900 mb-4">Submit New FYP Proposal</h2>
    <form id="new-proposal-form" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Group Name</label>
        <input value="${escapeHtml(g.name)}" readonly class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-1">Project Title</label>
        <input name="title" value="${escapeHtml(defaultProposalTitle)}" required readonly class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700" />
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
  const fromExec = isExecutiveRole(fromRole);
  const toExec = isExecutiveRole(toRole);
  if (fromExec) return true;
  if (fromRole === 'supervisor') return toRole === 'student' || toExec;
  if (fromRole === 'student') return toRole === 'supervisor' || toExec;
  return false;
}

function chatRoleColor(role) {
  return {
    coordinator: 'from-purple-500 to-indigo-600',
    hod: 'from-violet-500 to-indigo-600',
    dean: 'from-fuchsia-500 to-violet-700',
    supervisor: 'from-blue-500 to-fypilot-600',
    student: 'from-emerald-500 to-teal-600'
  }[role] || 'from-gray-500 to-gray-600';
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
    <input type="file" id="chat-image-input" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" class="hidden" onchange="handleChatImagePick(event)" />
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
      <div class="relative shrink-0">
        ${chatAvatar(c.peer)}
        ${c.peer.online ? '<span class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white"></span>' : ''}
      </div>
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
        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider capitalize ${p.role === 'coordinator' ? 'bg-purple-100 text-purple-700' : p.role === 'hod' ? 'bg-violet-100 text-violet-700' : p.role === 'dean' ? 'bg-fuchsia-100 text-fuchsia-700' : p.role === 'supervisor' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}">${p.role}</span>
      </div>
      <p id="chat-header-status" class="text-xs flex items-center gap-1.5">${chatHeaderStatusHtml()}</p>
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
      <img src="${m.media_data}" alt="photo" onclick="openChatImage('${m.id}')" onload="chatScrollToBottom(false)" class="max-h-72 max-w-full rounded-xl cursor-zoom-in border border-black/5" />
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
        <textarea id="chat-input" rows="1" placeholder="Type a message..." class="flex-1 resize-none border border-gray-200 bg-gray-50 focus:bg-white focus:border-fypilot-300 focus:ring-2 focus:ring-fypilot-500/20 rounded-2xl px-4 py-2.5 text-sm outline-none transition-all chat-scroll" oninput="autoGrowChatInput(this); handleChatTyping()" onkeydown="handleChatKeydown(event)"></textarea>
        ${state.chatRecording ? '' : recorderBtn}
        ${state.chatRecording ? '' : `<button onclick="sendChatMessage()" title="Send" ${state.chatSending ? 'disabled' : ''} class="w-11 h-11 rounded-xl bg-gradient-to-br from-fypilot-600 to-indigo-600 hover:scale-105 text-white shadow-lg shadow-fypilot-500/25 flex items-center justify-center transition-all shrink-0 ${state.chatSending ? 'opacity-60 cursor-not-allowed' : ''}"><i class="fas fa-paper-plane text-sm"></i></button>`}
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
  if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
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
  stopTypingIndicator();
  state.activeChat = chat;
  state.peerPresence = {
    online: !!chat.peer.online,
    last_seen: chat.peer.last_seen || null,
    typing: false,
    recording: false,
  };
  state.chatMessages = [];
  state.chatReplyingTo = null;
  state.chatEditing = null;
  state.chatPendingMedia = null;
  render();
  await loadChatMessages(chatId);
  chatScrollToBottom(true);
  requestAnimationFrame(() => chatScrollToBottom(true));
}

async function loadChatMessages(chatId, opts) {
  const silent = opts && opts.silent;
  const after = opts && opts.after;
  const atBottomBefore = state.chatAtBottom;
  try {
    const query = after ? `?after=${after}&mark_read=1` : '?mark_read=1';
    const res = await api(`/chats/${chatId}/messages${query}`, { silentError: !!silent });
    if (res.peer) {
      state.peerPresence = res.peer;
      if (state.activeChat && state.activeChat.id === chatId) updateChatHeaderStatus();
    }
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
  if (!state.activeChat || state.chatSending) return;
  const input = document.getElementById('chat-input');
  const text = input ? input.value.trim() : '';
  const replyToId = state.chatReplyingTo ? state.chatReplyingTo.id : null;
  const pendingMedia = state.chatPendingMedia;
  if (!pendingMedia && !text) return;
  state.chatSending = true;
  const sendBtn = document.querySelector('#chat-composer button[title="Send"]');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.classList.add('opacity-60', 'cursor-not-allowed'); }
  if (input) { input.value = ''; autoGrowChatInput(input); stopTypingIndicator(); }
  try {
    const body = pendingMedia
      ? JSON.stringify({ type: 'image', content: text || null, media_data: pendingMedia.data, media_mime: pendingMedia.mime, reply_to_id: replyToId })
      : JSON.stringify({ type: 'text', content: text, reply_to_id: replyToId });
    await api(`/chats/${state.activeChat.id}/messages`, { method: 'POST', body });
    state.chatPendingMedia = null;
  } catch (e) {
    if (input && text) { input.value = text; autoGrowChatInput(input); handleChatTyping(); }
    if (pendingMedia) state.chatPendingMedia = pendingMedia;
    return;
  } finally {
    state.chatSending = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.classList.remove('opacity-60', 'cursor-not-allowed'); }
  }
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
  if (!validateUploadedFile(file, {
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
    maxBytes: 1.2 * 1024 * 1024,
    label: 'chat image'
  })) return;
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
    stopTypingIndicator();
    sendPresence();
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
  sendPresence();
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
      const res = await api('/users/chattable');
      // Backend already filters to only users this caller can chat with (role verified in DB)
      state.chatNewUsers = (res.data || []).filter(u => u.id !== state.currentUser.id);
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
          <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider capitalize ${u.role === 'coordinator' ? 'bg-purple-100 text-purple-700' : u.role === 'hod' ? 'bg-violet-100 text-violet-700' : u.role === 'dean' ? 'bg-fuchsia-100 text-fuchsia-700' : u.role === 'supervisor' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}">${u.role}</span>
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
  stopTypingIndicator();
  if (state.chatListTimer) { clearInterval(state.chatListTimer); state.chatListTimer = null; }
  if (state.chatMsgTimer) { clearInterval(state.chatMsgTimer); state.chatMsgTimer = null; }
  if (state.chatRecording) stopChatVoice(true);
  if (state.chatVoicePlaying && chatVoiceAudio) {
    chatVoiceAudio.pause();
    chatVoiceAudio.currentTime = 0;
    state.chatVoicePlaying = null;
  }
}

// ===== Presence: online / last seen / typing / recording =====
async function sendPresence() {
  if (!state.currentUser) return;
  try {
    await api('/presence', {
      method: 'POST',
      body: JSON.stringify({
        typing_chat_id: state.chatTyping && state.activeChat ? state.activeChat.id : null,
        recording_chat_id: state.chatRecording && state.activeChat ? state.activeChat.id : null,
      }),
      silentError: true,
    });
  } catch (e) {}
}

function handleChatTyping() {
  if (!state.activeChat) return;
  const input = document.getElementById('chat-input');
  const text = input ? input.value.trim() : '';
  const shouldType = text.length > 0;
  if (shouldType) {
    if (!state.typingTimer) {
      state.chatTyping = true;
      sendPresence();
      state.typingTimer = setInterval(() => sendPresence(), 3000);
    }
  } else if (state.typingTimer || state.chatTyping) {
    stopTypingIndicator();
  }
}

function stopTypingIndicator() {
  if (state.typingTimer) {
    clearInterval(state.typingTimer);
    state.typingTimer = null;
  }
  if (state.chatTyping) {
    state.chatTyping = false;
    sendPresence();
  }
}

function chatHeaderStatusHtml() {
  const p = state.activeChat.peer;
  const pr = state.peerPresence;
  if (pr && pr.typing) {
    return `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span><span class="text-fypilot-600 font-semibold">typing...</span>`;
  }
  if (pr && pr.recording) {
    return `<span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block"></span><span class="text-red-500 font-semibold">recording voice message...</span>`;
  }
  if (pr && pr.online) {
    return `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span><span class="text-emerald-500">Online</span>${p.department ? `<span class="text-gray-300">·</span><span class="text-gray-500">${escapeHtml(p.department)}</span>` : ''}`;
  }
  return `<span class="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span><span class="text-gray-500">${pr && pr.last_seen ? 'Last seen ' + timeAgo(pr.last_seen) : 'Offline'}</span>`;
}

function updateChatHeaderStatus() {
  const el = document.getElementById('chat-header-status');
  if (el) el.innerHTML = chatHeaderStatusHtml();
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
  stopTypingIndicator();
  state.activeChat = null;
  state.peerPresence = null;
  render();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

function validateUploadedFile(file, { allowedMimeTypes = [], allowedExtensions = [], maxBytes = null, label = 'file' } = {}) {
  if (!file) {
    showToast(`${label} is required.`, 'error');
    return false;
  }

  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const allowedMimeSet = allowedMimeTypes.map(type => type.toLowerCase());
  const allowedExtSet = allowedExtensions.map(ext => ext.toLowerCase());
  const mimeAllowed = allowedMimeSet.length === 0 || allowedMimeSet.includes(mime);
  const extAllowed = allowedExtSet.length === 0 || allowedExtSet.includes(extension);

  if (!mimeAllowed && !extAllowed) {
    const allowedText = allowedExtensions.length ? allowedExtensions.join(', ') : (allowedMimeTypes.length ? allowedMimeTypes.join(', ') : 'the required format');
    showToast(`Only ${allowedText} files are allowed for ${label}.`, 'error');
    return false;
  }

  if (maxBytes && file.size > maxBytes) {
    const sizeLabel = maxBytes >= 1024 * 1024 ? `${(maxBytes / (1024 * 1024)).toFixed(1)}MB` : `${Math.round(maxBytes / 1024)}KB`;
    showToast(`${label} is too large (max ${sizeLabel}).`, 'error');
    return false;
  }

  return true;
}

async function loadDefense() {
  if (state.defenseLoading) return;
  state.defenseLoading = true;
  try {
    const res = await api('/defense');
    state.defenseConfig = res.data && res.data.config ? res.data.config : null;
    state.defenseSubmissions = res.data && res.data.submissions ? res.data.submissions : [];
    if (state.currentUser && state.currentUser.role === 'student' && !state.myGroup) {
      await loadMyGroup();
    }
    if (state.currentView === 'defense') render();
  } catch (e) {
    console.error('Failed to load defense data:', e);
  } finally {
    state.defenseLoading = false;
  }
}

async function submitDefenseConfig() {
  const form = document.getElementById('defense-config-form');
  if (!form) return;
  const payload = {
    title: document.getElementById('defense-title')?.value || 'Final Defense',
    submission_deadline: document.getElementById('defense-deadline')?.value || null,
    presentation_start: document.getElementById('defense-start')?.value || '09:00',
    presentation_end: document.getElementById('defense-end')?.value || '17:00',
    default_duration_minutes: Number(document.getElementById('defense-duration')?.value || 15)
  };

  try {
    const res = await api('/defense/config', { method: 'POST', body: JSON.stringify(payload) });
    showToast(res.message || 'Defense deadline saved!', 'success');
    await loadDefense();
  } catch (e) {
    console.error('Failed to save defense config', e);
  }
}

function getDefenseInputByKey(fieldKey) {
  const idCandidates = [
    `defense-${fieldKey}-file`,
    fieldKey === 'pptxPdf' ? 'defense-pptx-pdf-file' : fieldKey === 'docxPdf' ? 'defense-docx-pdf-file' : `defense-${fieldKey}-file`,
    fieldKey === 'pptxPdf' ? 'defense-pptxPdf-file' : fieldKey === 'docxPdf' ? 'defense-docxPdf-file' : `defense-${fieldKey}-file`,
    `data-defense-field="${fieldKey}"`
  ];

  for (const candidate of idCandidates) {
    if (candidate.startsWith('data-defense-field=')) {
      const element = document.querySelector(`[data-defense-field="${fieldKey}"]`);
      if (element) return element;
    } else {
      const element = document.getElementById(candidate);
      if (element) return element;
    }
  }

  return null;
}

function validateDefenseFileInput(file, fieldKey) {
  const rules = {
    pptx: { label: 'PPTX', allowedMimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'], allowedExtensions: ['.pptx', '.ppt'], maxBytes: 100 * 1024 * 1024 },
    pptxPdf: { label: 'PPTX PDF', allowedMimeTypes: ['application/pdf'], allowedExtensions: ['.pdf'], maxBytes: 100 * 1024 * 1024 },
    docx: { label: 'DOCX', allowedMimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'], allowedExtensions: ['.docx', '.doc'], maxBytes: 100 * 1024 * 1024 },
    docxPdf: { label: 'DOCX PDF', allowedMimeTypes: ['application/pdf'], allowedExtensions: ['.pdf'], maxBytes: 100 * 1024 * 1024 },
  };

  const rule = rules[fieldKey];
  if (!rule) return true;
  if (!file) return false;

  const valid = validateUploadedFile(file, rule);
  if (!valid) {
    const input = document.getElementById(`defense-${fieldKey}-file`);
    if (input) input.value = '';
    const matchBadge = document.getElementById(`defense-match-${fieldKey}`);
    if (matchBadge) {
      matchBadge.textContent = 'Invalid format';
      matchBadge.className = 'mt-1 text-[10px] font-semibold text-rose-600 min-h-[14px]';
    }
    return false;
  }

  const matchBadge = document.getElementById(`defense-match-${fieldKey}`);
  if (matchBadge) {
    matchBadge.textContent = 'Format valid ✓';
    matchBadge.className = 'mt-1 text-[10px] font-semibold text-emerald-600 min-h-[14px]';
  }

  return true;
}

async function submitDefenseUpload() {
  const role = state.currentUser && state.currentUser.role;
  if (role !== 'student') {
    showToast('Only students can upload defense files.', 'error');
    return;
  }

  const group = state.myGroup || null;
  if (!group) {
    showToast('Join or create an approved group before uploading defense documents.', 'error');
    return;
  }
  if (String(group.leader_id || '') !== String(state.currentUser.id)) {
    showToast('Only the group leader can upload defense files.', 'error');
    return;
  }

  const inputs = {
    pptx: getDefenseInputByKey('pptx'),
    pptxPdf: getDefenseInputByKey('pptxPdf'),
    docx: getDefenseInputByKey('docx'),
    docxPdf: getDefenseInputByKey('docxPdf')
  };

  const fileChecks = [
    { file: inputs.pptx && inputs.pptx.files && inputs.pptx.files[0], fieldKey: 'pptx', label: 'PPTX', allowedMimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'], allowedExtensions: ['.pptx', '.ppt'], maxBytes: 100 * 1024 * 1024 },
    { file: inputs.pptxPdf && inputs.pptxPdf.files && inputs.pptxPdf.files[0], fieldKey: 'pptxPdf', label: 'PPTX PDF', allowedMimeTypes: ['application/pdf'], allowedExtensions: ['.pdf'], maxBytes: 100 * 1024 * 1024 },
    { file: inputs.docx && inputs.docx.files && inputs.docx.files[0], fieldKey: 'docx', label: 'DOCX', allowedMimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'], allowedExtensions: ['.docx', '.doc'], maxBytes: 100 * 1024 * 1024 },
    { file: inputs.docxPdf && inputs.docxPdf.files && inputs.docxPdf.files[0], fieldKey: 'docxPdf', label: 'DOCX PDF', allowedMimeTypes: ['application/pdf'], allowedExtensions: ['.pdf'], maxBytes: 100 * 1024 * 1024 },
  ];

  const missingFiles = fileChecks.filter(({ file }) => !file);
  if (missingFiles.length) {
    showToast('Please upload all four defense files: PPTX, PPTX PDF, DOCX, DOCX PDF.', 'error');
    return;
  }

  const invalid = fileChecks.find(item => !validateDefenseFileInput(item.file, item.fieldKey));
  if (invalid) return;

  const files = {
    pptx_file: await fileToDataUrl(fileChecks[0].file),
    pptx_pdf_file: await fileToDataUrl(fileChecks[1].file),
    docx_file: await fileToDataUrl(fileChecks[2].file),
    docx_pdf_file: await fileToDataUrl(fileChecks[3].file),
  };

  const names = {
    pptx_name: fileChecks[0].file.name,
    pptx_pdf_name: fileChecks[1].file.name,
    docx_name: fileChecks[2].file.name,
    docx_pdf_name: fileChecks[3].file.name,
  };

  try {
    const res = await api('/defense/upload', {
      method: 'POST',
      body: JSON.stringify({
        group_id: group.id,
        group_name: group.name,
        project_id: group.project_id || null,
        ...files,
        ...names,
        notes: document.getElementById('defense-notes')?.value || ''
      })
    });
    showToast(res.message || 'Defense documents submitted successfully.', 'success');
    await loadDefense();
  } catch (e) {
    console.error('Failed to upload defense files:', e);
    showToast(e && e.message ? e.message : 'Defense upload failed. Please check the selected files and try again.', 'error');
  }
}

function formatDefenseInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDefenseInputTime(value) {
  if (!value) return '09:00';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '09:00';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildDefenseDateTime(dateValue, timeValue, durationMinutes = 15) {
  if (!dateValue || !timeValue) return null;
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const [hours, minutes] = String(timeValue).split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const end = new Date(start.getTime() + (Number(durationMinutes) || 15) * 60000);
  return {
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  };
}

function getDefenseSlotConflict(groupId, dateValue, timeValue, durationMinutes = 15) {
  const slot = buildDefenseDateTime(dateValue, timeValue, durationMinutes);
  if (!slot) return null;

  const candidateStart = new Date(slot.start_time);
  const candidateEnd = new Date(slot.end_time);

  const otherGroups = (state.defenseSubmissions || []).filter(sub => String(sub.group_id) !== String(groupId));
  const conflict = otherGroups.find(sub => {
    if (!sub.slot_start || !sub.slot_end) return false;
    const existingStart = new Date(sub.slot_start);
    const existingEnd = new Date(sub.slot_end);
    return candidateStart < existingEnd && candidateEnd > existingStart;
  });

  if (!conflict) return null;
  return {
    groupName: conflict.group_name || 'Another group',
    start: conflict.slot_start,
    end: conflict.slot_end,
  };
}

function updateDefenseSlotConflictStatus(groupId, durationMinutes = 15) {
  const dateInput = document.getElementById(`defense-date-${groupId}`);
  const timeInput = document.getElementById(`defense-time-${groupId}`);
  const statusEl = document.getElementById(`defense-conflict-${groupId}`);
  if (!dateInput || !timeInput || !statusEl) return;

  const conflict = getDefenseSlotConflict(groupId, dateInput.value, timeInput.value, durationMinutes);
  if (!conflict) {
    statusEl.textContent = 'No overlap with other groups.';
    statusEl.className = 'mt-1 text-[10px] font-semibold text-emerald-600';
    return;
  }

  const label = conflict.start ? new Date(conflict.start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'another time';
  statusEl.textContent = `Conflict: overlaps ${conflict.groupName} at ${label}.`;
  statusEl.className = 'mt-1 text-[10px] font-semibold text-red-600';
}

async function saveDefenseSlotForGroup(groupId, slotId, durationMinutes) {
  const dateValue = document.getElementById(`defense-date-${groupId}`)?.value;
  const timeValue = document.getElementById(`defense-time-${groupId}`)?.value;
  const conflict = getDefenseSlotConflict(groupId, dateValue, timeValue, durationMinutes);

  if (conflict) {
    showToast('Conflict: this time overlaps ' + conflict.groupName + '. Please choose a different slot.', 'error');
    return;
  }

  const slot = buildDefenseDateTime(dateValue, timeValue, durationMinutes);
  if (!slot) {
    showToast('Please choose a valid date and time.', 'error');
    return;
  }

  await updateDefenseSlot(slotId, {
    group_id: groupId,
    status: 'scheduled',
    start_time: slot.start_time,
    end_time: slot.end_time,
    duration_minutes: durationMinutes,
  });
}

async function updateDefenseSlot(slotId, payload) {
  try {
    const res = await api(`/defense/slots/${slotId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    showToast(res.message || 'Defense slot updated successfully.', 'success');
    await loadDefense();
  } catch (e) {
    console.error('Failed to update defense slot:', e);
  }
}

async function ensureZipLibrary() {
  if (window.JSZip) return window.JSZip;

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-defense-zip="true"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    script.async = true;
    script.setAttribute('data-defense-zip', 'true');
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.JSZip;
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function downloadDefenseDocuments(groupId) {
  try {
    const res = await api(`/defense/groups/${groupId}/download`);
    const documents = res.data && res.data.documents ? res.data.documents : [];
    if (!documents.length) {
      showToast('No defense documents available for this group.', 'warning');
      return;
    }

    const groupName = (res.data && res.data.group_name) || 'defense-files';
    const safeName = String(groupName).replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'defense-files';
    const JSZip = await ensureZipLibrary();
    const zip = new JSZip();
    const folder = zip.folder(safeName) || zip;

    documents.forEach((doc) => {
      if (!doc || !doc.data_url || !doc.file_name) return;
      const fileName = String(doc.file_name).replace(/\\/g, '/').split('/').pop();
      folder.file(fileName, dataUrlToUint8Array(doc.data_url), { binary: true });
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}-defense-files.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`${documents.length} defense files downloaded as a single folder bundle.`, 'success');
  } catch (e) {
    console.error('Failed to download defense documents:', e);
    showToast('Defense download failed. Please try again.', 'error');
  }
}

async function downloadAllDefenseDocuments() {
  const submissions = state.defenseSubmissions || [];
  if (!submissions.length) {
    showToast('No defense submissions are available to download yet.', 'warning');
    return;
  }

  try {
    const JSZip = await ensureZipLibrary();
    const zip = new JSZip();
    let totalFiles = 0;

    submissions.forEach((sub) => {
      if (!sub || !sub.group_id) return;
      const groupFolderName = String(sub.group_name || sub.group_id || 'group').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'group';
      const groupFolder = zip.folder(groupFolderName) || zip;
      const documents = [
        { file_name: `${groupFolderName}-pptx.pptx`, data_url: sub.pptx_file },
        { file_name: `${groupFolderName}-pptx.pdf`, data_url: sub.pptx_pdf_file },
        { file_name: `${groupFolderName}-docx.docx`, data_url: sub.docx_file },
        { file_name: `${groupFolderName}-docx.pdf`, data_url: sub.docx_pdf_file },
      ].filter((doc) => doc.data_url);

      documents.forEach((doc) => {
        groupFolder.file(doc.file_name, dataUrlToUint8Array(doc.data_url), { binary: true });
        totalFiles += 1;
      });
    });

    if (!totalFiles) {
      showToast('No defense documents are available to download.', 'warning');
      return;
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'all-defense-submissions.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`${totalFiles} defense files downloaded in one archive.`, 'success');
  } catch (e) {
    console.error('Failed to download all defense documents:', e);
    showToast('Bulk defense download failed. Please try again.', 'error');
  }
}

function renderDefense() {
  const role = state.currentUser ? state.currentUser.role : 'guest';
  const reviewRole = isExecutiveRole(role) || role === 'supervisor';
  const isLeaderOfMyGroup = role === 'student' && state.myGroup && String(state.myGroup.leader_id || '') === String(state.currentUser.id);
  const config = state.defenseConfig || {
    title: 'Final Defense',
    submission_deadline: '',
    presentation_start: '09:00',
    presentation_end: '17:00',
    default_duration_minutes: 15
  };

  const submissions = state.defenseSubmissions || [];
  const myGroupSubmission = role === 'student' && state.myGroup ? submissions.find(s => String(s.group_id) === String(state.myGroup.id)) : null;

  const coordinatorPanel = `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-calendar-check text-purple-600"></i> Defense Configuration</h2>
          <div class="flex flex-wrap gap-2">
            <button onclick="downloadAllDefenseDocuments()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold">Download All Groups</button>
            <button onclick="loadDefense()" class="text-xs font-bold text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">Refresh</button>
          </div>
        </div>
        <form id="defense-config-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="md:col-span-2">
            <label class="block text-xs font-bold text-gray-700 mb-1">Defense Title</label>
            <input id="defense-title" value="${escapeHtml(config.title || 'Final Defense')}" class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Submission Deadline</label>
            <input id="defense-deadline" type="datetime-local" value="${config.submission_deadline ? new Date(config.submission_deadline).toISOString().slice(0, 16) : ''}" class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Duration (Minutes)</label>
            <input id="defense-duration" type="number" min="10" max="60" value="${config.default_duration_minutes || 15}" class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Presentation Start</label>
            <input id="defense-start" type="time" value="${config.presentation_start || '09:00'}" class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Presentation End</label>
            <input id="defense-end" type="time" value="${config.presentation_end || '17:00'}" class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div class="md:col-span-2 flex flex-wrap gap-2">
            <button type="button" onclick="submitDefenseConfig()" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold">Save Deadline</button>
            <button type="button" onclick="api('/defense/auto-schedule', { method: 'POST' }).then(() => loadDefense()).catch(() => {})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold">Auto-Schedule</button>
          </div>
        </form>
      </div>

      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fas fa-list-check text-indigo-600"></i> Submitted Groups</h2>
        <div class="space-y-3">
          ${submissions.length ? submissions.map((sub, index) => `
            <div class="border border-gray-200 rounded-xl p-3.5 bg-gray-50">
              <div class="flex flex-col gap-3">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <div class="font-bold text-gray-900">#${index + 1} • ${escapeHtml(sub.group_name || 'Unknown Group')}</div>
                    <div class="text-[11px] text-gray-500">${sub.slot_start ? `Assigned: ${new Date(sub.slot_start).toLocaleString([], {dateStyle:'medium', timeStyle:'short'})}` : 'Awaiting slot assignment'}</div>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <button onclick="downloadDefenseDocuments('${sub.group_id}')" class="border border-gray-300 px-3 py-2 rounded-xl text-xs font-bold text-gray-700">Download</button>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div>
                    <label class="block text-[10px] font-bold text-gray-600 mb-1">Date</label>
                    <input id="defense-date-${sub.group_id}" type="date" value="${formatDefenseInputDate(sub.slot_start || '')}" oninput="updateDefenseSlotConflictStatus('${sub.group_id}', ${config.default_duration_minutes || 15})" onchange="updateDefenseSlotConflictStatus('${sub.group_id}', ${config.default_duration_minutes || 15})" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-gray-600 mb-1">Start Time</label>
                    <input id="defense-time-${sub.group_id}" type="time" value="${formatDefenseInputTime(sub.slot_start || '2026-01-01T09:00:00')}" oninput="updateDefenseSlotConflictStatus('${sub.group_id}', ${config.default_duration_minutes || 15})" onchange="updateDefenseSlotConflictStatus('${sub.group_id}', ${config.default_duration_minutes || 15})" class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <div id="defense-conflict-${sub.group_id}" class="mt-1 text-[10px] font-semibold text-emerald-600">No overlap with other groups.</div>
                    <button type="button" onclick="saveDefenseSlotForGroup('${sub.group_id}', '${sub.slot_id || sub.id}', ${config.default_duration_minutes || 15})" class="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-xl text-xs font-bold">Save Slot</button>
                  </div>
                </div>
              </div>
            </div>
          `).join('') : `<div class="text-sm text-gray-500">No defense uploads yet.</div>`}
        </div>
      </div>
    </div>
  `;

  const supervisorPanel = `
    <div class="space-y-6">
      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-folder-open text-blue-600"></i> Defense Submissions</h2>
          <button onclick="downloadAllDefenseDocuments()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold">Download All</button>
        </div>
        <div class="space-y-3">
          ${submissions.length ? submissions.map(sub => `
            <div class="border border-gray-200 rounded-xl p-3.5 bg-gray-50">
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div class="font-bold text-gray-900">${escapeHtml(sub.group_name || 'Unknown Group')}</div>
                  <div class="text-[11px] text-gray-500">${sub.slot_start ? `Scheduled: ${new Date(sub.slot_start).toLocaleString([], {dateStyle:'medium', timeStyle:'short'})}` : 'Pending schedule'}</div>
                </div>
                <button onclick="downloadDefenseDocuments('${sub.group_id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold">View & Download</button>
              </div>
            </div>
          `).join('') : `<div class="text-sm text-gray-500">No group has uploaded defense files yet.</div>`}
        </div>
      </div>
    </div>
  `;

  const sharedReviewPanel = reviewRole ? supervisorPanel : '';

  const studentPanel = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-800">
        <div class="flex items-start gap-2">
          <i class="fas fa-clipboard-check mt-1"></i>
          <div>
            <div class="font-bold">Final Defense Submission</div>
            <div>Deadline: ${config.submission_deadline ? new Date(config.submission_deadline).toLocaleString([], {dateStyle:'medium', timeStyle:'short'}) : 'Not set yet'}</div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fas fa-upload text-emerald-600"></i> Upload Defense Files</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${['pptx', 'pptxPdf', 'docx', 'docxPdf'].map(key => {
            const labelMap = {
              pptx: 'PPTX Presentation',
              pptxPdf: 'PPTX PDF',
              docx: 'DOCX Report',
              docxPdf: 'DOCX PDF'
            };
            const acceptMap = {
              pptx: '.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint',
              pptxPdf: '.pdf,application/pdf',
              docx: '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword',
              docxPdf: '.pdf,application/pdf'
            };
            return `
              <label class="block">
                <span class="block text-xs font-bold text-gray-700 mb-1">${labelMap[key]}</span>
                <div class="relative">
                  <input id="defense-${key}-file" data-defense-field="${key}" type="file" accept="${acceptMap[key]}" onchange="if (event.target.files && event.target.files[0]) validateDefenseFileInput(event.target.files[0], '${key}')" class="block w-full text-sm text-gray-500 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white" />
                  <div id="defense-match-${key}" class="mt-1 text-[10px] font-semibold text-gray-500 min-h-[14px]">${key.endsWith('Pdf') ? 'PDF format required' : 'Correct format required'}</div>
                </div>
              </label>
            `;
          }).join('')}
        </div>

        <div class="mt-4">
          <label class="block text-xs font-bold text-gray-700 mb-1">Notes</label>
          <textarea id="defense-notes" rows="3" placeholder="Optional notes for the coordinator or supervisor" class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"></textarea>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <button type="button" onclick="submitDefenseUpload()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold">Submit Defense</button>
          ${myGroupSubmission ? `<button onclick="downloadDefenseDocuments('${myGroupSubmission.group_id}')" class="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-bold">Download My Upload</button>` : ''}
        </div>
      </div>
    </div>
  `;

  return `
    <div class="fade-in space-y-6">
      <div class="bg-gradient-to-r from-slate-900 via-indigo-900 to-fypilot-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-500/20">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-indigo-100 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              <i class="fas fa-file-export"></i> Final Defense Workflow
            </span>
            <h1 class="text-2xl sm:text-3xl font-bold mt-2">Defense Management</h1>
            <p class="text-indigo-200 text-sm mt-1">Students submit required files, supervisors review them, and coordinators manage final scheduling.</p>
          </div>
          <button onclick="loadDefense()" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 self-start">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
      </div>

      ${isExecutiveRole(role) ? `${coordinatorPanel}${sharedReviewPanel}` : role === 'supervisor' ? supervisorPanel : isLeaderOfMyGroup ? studentPanel : ''}
    </div>
  `;
}

// ===== Event Listeners =====
function attachEventListeners() {
  const isCoordinator = state.currentUser && isExecutiveRole(state.currentUser.role);

  attachProjectPaste();

  if (state.pendingRefreshTimer) {
    clearInterval(state.pendingRefreshTimer);
    state.pendingRefreshTimer = null;
  }

  loadNotifications(true);
  if (!state.notifGlobalTimer) {
    state.notifGlobalTimer = setInterval(() => { loadNotifications(true); }, 8000);
  }
  if (!state.chatListGlobalTimer) {
    state.chatListGlobalTimer = setInterval(() => { loadChats(true); }, 6000);
  }
  if (!state.presenceTimer) {
    state.presenceTimer = setInterval(() => sendPresence(), 25000);
    sendPresence();
  }

  if (state.currentView === 'dashboard') {
    loadDashboard();
    if (isCoordinator) {
      state.pendingRefreshTimer = setInterval(() => {
        if (state.currentView === 'dashboard') loadPendingUsers();
      }, 5000);
    }
  } else if (state.currentView === 'audit-logs') {
    loadAuditLogs();
  } else {
    if (state.currentView === 'proposals') { loadProposals(); loadMyGroup(); }
    if (state.currentView === 'projects') loadProjects();
    if (state.currentView === 'defense') {
      if (!state.defenseLoading) {
        loadDefense();
      }
      if (state.currentUser && state.currentUser.role === 'student') {
        loadMyGroup();
      }
    }
    if (state.currentView === 'supervisors') loadSupervisors();
    if (state.currentView === 'people') loadPeople();
    if (state.currentView === 'groups') loadGroups();
    if (state.currentView === 'profile') loadProfile();
    if (state.currentView === 'chats') { loadChats(); startChatPolling(); }
  }
}

window.addEventListener('focus', () => {
  if (state.currentUser) {
    loadNotifications(true);
    sendPresence();
  }
  if (state.currentView === 'dashboard' && state.currentUser && isExecutiveRole(state.currentUser.role)) {
    loadPendingUsers();
  }
});

// Make globally available
window.navigate = navigate;

window.togglePasswordVisibility = togglePasswordVisibility;
window.logout = logout;
window.toggleMobileMenu = toggleMobileMenu;
window.toggleNavMore = toggleNavMore;
window.toggleNotificationPanel = toggleNotificationPanel;
window.openNotification = openNotification;
window.markAllNotificationsRead = markAllNotificationsRead;
window.loadProposalDetail = loadProposalDetail;
window.loadProjectDetail = loadProjectDetail;
window.loadDefense = loadDefense;
window.submitDefenseConfig = submitDefenseConfig;
window.submitDefenseUpload = submitDefenseUpload;
window.updateDefenseSlot = updateDefenseSlot;
window.downloadDefenseDocuments = downloadDefenseDocuments;
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

// ===== Public Student Application & Governance Workflows =====

function navigateToApply() {
  window.history.pushState(null, '', '/apply');
  state.currentView = 'apply';
  render();
}

window.addEventListener('popstate', () => {
  if (window.location.pathname === '/apply') {
    state.currentView = 'apply';
  } else {
    state.currentView = 'dashboard';
  }
  render();
});

async function loadSupervisorsForApply() {
  if (!state.supervisorsList.length) {
    try {
      const res = await api('/users?role=supervisor');
      state.supervisorsList = res.data || [];
    } catch (e) {
      state.supervisorsList = [];
    }
  }
}

function updateApplyDepartmentOptions() {
  const prog = state.applyForm.program || 'BS';
  const shift = state.applyForm.shift || 'Morning';
  const depts = (DEPARTMENT_MATRIX[prog] && DEPARTMENT_MATRIX[prog][shift]) || [];
  
  if (!depts.includes(state.applyForm.department)) {
    state.applyForm.department = depts[0] || '';
  }
  
  const deptSelect = document.getElementById('apply-department');
  if (deptSelect) {
    deptSelect.innerHTML = depts.map(d => `<option value="${d}" ${state.applyForm.department === d ? 'selected' : ''}>${d}</option>`).join('');
  }
}

function setApplyStep(step) {
  if (step > state.applyStep) {
    if (state.applyStep === 1) {
      const email = (state.applyForm.email || '').trim();
      if (!email || !email.toLowerCase().endsWith('@stu.smiu.edu.pk')) {
        showToast('University email is required and MUST end with @stu.smiu.edu.pk', 'error');
        return;
      }
      if (!(state.applyForm.student_id_num || '').trim()) {
        showToast('Student ID is required', 'error');
        return;
      }
      if (!(state.applyForm.student_name || '').trim()) {
        showToast('Student Name is required', 'error');
        return;
      }
    } else if (state.applyStep === 2) {
      if (!(state.applyForm.group_name || '').trim()) {
        showToast('FYP Group Name is required', 'error');
        return;
      }
      if (!(state.applyForm.project_title || '').trim()) {
        showToast('Project Title is required', 'error');
        return;
      }
      if (!state.applyForm.internship_certificate_pdf) {
        showToast('Internship Certificate (PDF ONLY) is required', 'error');
        return;
      }
      if (!state.applyForm.transcript_certificate_pdf) {
        showToast('Academic Transcript (PDF ONLY) is required', 'error');
        return;
      }
    } else if (state.applyStep === 3) {
      if (!state.applyForm.pref_1) {
        showToast('Supervisor Preference 1 is required', 'error');
        return;
      }
    }
  }
  state.applyStep = step;
  render();
}

function addApplyMember() {
  if (state.applyForm.members.length >= 3) {
    showToast('Maximum 3 additional group members allowed (4 total)', 'warning');
    return;
  }
  state.applyForm.members.push({ name: '', student_id_num: '', email: '' });
  render();
}

function removeApplyMember(index) {
  state.applyForm.members.splice(index, 1);
  render();
}

function handleApplicationPdfPick(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!validateUploadedFile(file, {
    allowedMimeTypes: ['application/pdf'],
    allowedExtensions: ['.pdf'],
    maxBytes: 10 * 1024 * 1024,
    label: 'Internship Certificate'
  })) {
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    state.applyForm.internship_certificate_pdf = reader.result;
    state.applyForm.pdf_name = file.name;
    state.applyForm.pdf_size = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    render();
  };
  reader.readAsDataURL(file);
}

function handleTranscriptPdfPick(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!validateUploadedFile(file, {
    allowedMimeTypes: ['application/pdf'],
    allowedExtensions: ['.pdf'],
    maxBytes: 10 * 1024 * 1024,
    label: 'Academic Transcript'
  })) {
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    state.applyForm.transcript_certificate_pdf = reader.result;
    state.applyForm.transcript_pdf_name = file.name;
    state.applyForm.transcript_pdf_size = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    render();
  };
  reader.readAsDataURL(file);
}

function renderPublicApplicationPage() {
  loadSupervisorsForApply();

  if (state.applySubmitted && state.applySubmittedData) {
    const resData = state.applySubmittedData || {};
    const f = state.applyForm || {};
    const d = {
      id: resData.id || 'N/A',
      student_name: resData.student_name || f.student_name || 'N/A',
      email: resData.email || f.email || 'N/A',
      program: resData.program || f.program || '',
      shift: resData.shift || f.shift || '',
      department: resData.department || f.department || '',
      group_name: resData.group_name || f.group_name || 'N/A',
      project_title: resData.project_title || f.project_title || 'N/A',
      status: resData.status || 'submitted'
    };

    return `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-fypilot-900 to-indigo-950 flex items-center justify-center p-4 sm:p-6 fade-in">
      <div class="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-6 sm:p-10 border border-white/20 text-center">
        <div class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20">
          <i class="fas fa-check-circle text-4xl"></i>
        </div>
        <span class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">Application Submitted</span>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3">FYP Portal Registration Successful</h1>
        <p class="text-sm text-gray-600 mt-2 max-w-lg mx-auto">Your FYP application has been received by the FYP Coordinator Committee. Your record will be reviewed and activated shortly.</p>
        
        <div class="bg-gray-50 border border-gray-200 rounded-2xl p-5 my-6 text-left space-y-3">
          <div class="flex justify-between items-center"><span class="text-xs text-gray-500 font-semibold">Application Reference</span><span class="font-mono text-xs font-bold text-fypilot-700">${escapeHtml(d.id)}</span></div>
          <div class="flex justify-between items-center"><span class="text-xs text-gray-500 font-semibold">Student Name</span><span class="text-xs font-bold text-gray-800">${escapeHtml(d.student_name)}</span></div>
          <div class="flex justify-between items-center"><span class="text-xs text-gray-500 font-semibold">University Email</span><span class="text-xs font-bold text-gray-800 font-mono">${escapeHtml(d.email)}</span></div>
          <div class="flex justify-between items-center"><span class="text-xs text-gray-500 font-semibold">Department &amp; Program</span><span class="text-xs font-bold text-gray-800">${escapeHtml(d.program)} ${escapeHtml(d.shift)} - ${escapeHtml(d.department)}</span></div>
          <div class="flex justify-between items-center"><span class="text-xs text-gray-500 font-semibold">FYP Group Name</span><span class="text-xs font-bold text-gray-800">${escapeHtml(d.group_name)}</span></div>
          <div class="flex justify-between items-center"><span class="text-xs text-gray-500 font-semibold">Project Title</span><span class="text-xs font-bold text-gray-800">${escapeHtml(d.project_title)}</span></div>
          <div class="flex justify-between items-center"><span class="text-xs text-gray-500 font-semibold">Status</span><span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 capitalize">Under Coordinator Review</span></div>
        </div>

        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 text-left flex items-start gap-2 mb-6">
          <i class="fas fa-info-circle text-blue-600 mt-0.5 shrink-0"></i>
          <span>Once approved by the coordinator, your login account will be automatically activated. You will be able to log in using your university email (<b>${escapeHtml(d.email)}</b>).</span>
        </div>

        <div class="flex flex-wrap justify-center gap-3">
          <button onclick="state.applySubmitted = false; state.applyStep = 1; window.location.href='/';" class="bg-gradient-to-r from-fypilot-600 to-indigo-600 text-white font-bold px-6 py-3 rounded-xl text-xs shadow-lg hover:scale-105 transition-all">
            Return to Portal Home
          </button>
        </div>
      </div>
    </div>`;
  }

  const f = state.applyForm;
  const currentDepts = (DEPARTMENT_MATRIX[f.program] && DEPARTMENT_MATRIX[f.program][f.shift]) || [];

  return `
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-fypilot-900 to-indigo-950 p-4 sm:p-8 flex items-center justify-center">
    <div class="max-w-3xl w-full bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden fade-in">
      
      <!-- Top Banner Header -->
      <div class="bg-gradient-to-r from-fypilot-700 via-indigo-700 to-purple-800 text-white p-5 sm:p-8 relative">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1.5">
            <div class="flex items-center justify-between sm:justify-start gap-2">
              <span class="inline-flex items-center gap-1.5 bg-white/20 border border-white/30 text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                <i class="fas fa-graduation-cap"></i> SMIU FYP Portal
              </span>
              <button onclick="window.location.href='/'" class="sm:hidden bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1">
                <i class="fas fa-sign-in-alt"></i> Login
              </button>
            </div>
            <h1 class="text-xl sm:text-3xl font-extrabold text-white leading-tight">Public Student Application</h1>
            <p class="text-indigo-200 text-xs sm:text-sm">Submit your FYP proposal details &amp; mandatory internship certificate.</p>
          </div>
          <button onclick="window.location.href='/'" class="hidden sm:flex bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all items-center gap-1.5 shrink-0 self-start sm:self-auto">
            <i class="fas fa-sign-in-alt"></i> Login Screen
          </button>
        </div>

        <!-- Multi-Step Progress Bar -->
        <div class="mt-5 pt-4 border-t border-white/10">
          <div class="grid grid-cols-4 gap-1.5 sm:gap-3">
            ${[
              { step: 1, label: 'Student Info', shortLabel: '1. Info' },
              { step: 2, label: 'Group & Certificate', shortLabel: '2. Group' },
              { step: 3, label: 'Supervisors', shortLabel: '3. Supervisors' },
              { step: 4, label: 'Review & Submit', shortLabel: '4. Submit' }
            ].map(s => `
              <div onclick="setApplyStep(${s.step})" class="cursor-pointer text-center group">
                <div class="h-2 rounded-full ${state.applyStep >= s.step ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-white/20'} transition-all mb-1.5"></div>
                <span class="hidden sm:block text-[11px] font-bold truncate ${state.applyStep === s.step ? 'text-emerald-300 font-extrabold' : 'text-white/70'}">${s.label}</span>
                <span class="block sm:hidden text-[10px] font-bold truncate ${state.applyStep === s.step ? 'text-emerald-300 font-extrabold' : 'text-white/60'}">${s.shortLabel}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Form Body Container -->
      <div class="p-4 sm:p-8">
        
        ${state.applyStep === 1 ? `
        <!-- STEP 1: Student & Academic Info -->
        <div class="space-y-5 fade-in">
          <div class="border-b border-gray-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 min-w-0 flex-1">
              <i class="fas fa-user-graduate text-fypilot-600 shrink-0"></i>
              <span class="truncate sm:whitespace-normal">Step 1: Student &amp; Academic Information</span>
            </h2>
            <span class="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full shrink-0">Step 1 of 4</span>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">University Email Address * <span class="text-rose-500">(Must end with @stu.smiu.edu.pk)</span></label>
            <input id="apply-email" type="email" value="${escapeHtml(f.email)}" oninput="state.applyForm.email = this.value" placeholder="e.g. csc-21f-001@stu.smiu.edu.pk" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none transition-all font-mono" />
            <p class="text-[11px] text-gray-400 mt-1 flex items-center gap-1"><i class="fas fa-shield-alt text-emerald-500"></i> Official SMIU student email required for verification.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Student ID / Roll No *</label>
              <input id="apply-student-id" type="text" value="${escapeHtml(f.student_id_num)}" oninput="state.applyForm.student_id_num = this.value" placeholder="e.g. CSC-21F-001" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none transition-all font-mono" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Full Student Name *</label>
              <input id="apply-name" type="text" value="${escapeHtml(f.student_name)}" oninput="state.applyForm.student_name = this.value" placeholder="e.g. Muhammad Ali" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none transition-all" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Academic Program *</label>
              <select id="apply-program" onchange="state.applyForm.program = this.value; updateApplyDepartmentOptions();" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none bg-white">
                <option value="BS" ${f.program === 'BS' ? 'selected' : ''}>BS (Bachelor of Science)</option>
                <option value="MS" ${f.program === 'MS' ? 'selected' : ''}>MS (Master of Science)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Shift *</label>
              <select id="apply-shift" onchange="state.applyForm.shift = this.value; updateApplyDepartmentOptions();" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none bg-white">
                <option value="Morning" ${f.shift === 'Morning' ? 'selected' : ''}>Morning</option>
                <option value="Evening" ${f.shift === 'Evening' ? 'selected' : ''}>Evening</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Department * <span class="text-xs text-fypilot-600 font-normal">(Filtered dynamically based on Program &amp; Shift)</span></label>
            <select id="apply-department" onchange="state.applyForm.department = this.value" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none bg-white">
              ${currentDepts.map(d => `<option value="${d}" ${f.department === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>

          <div class="flex justify-end pt-5 border-t border-gray-100">
            <button onclick="setApplyStep(2)" class="w-full sm:w-auto bg-gradient-to-r from-fypilot-600 to-indigo-600 hover:from-fypilot-700 hover:to-indigo-700 text-white font-bold px-6 py-3 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap">
              <span>Next: Group &amp; Certificate</span> <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
        ` : ''}

        ${state.applyStep === 2 ? `
        <!-- STEP 2: Group Details & Internship Certificate PDF -->
        <div class="space-y-5 fade-in">
          <div class="border-b border-gray-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 min-w-0 flex-1">
              <i class="fas fa-users text-fypilot-600 shrink-0"></i>
              <span class="truncate sm:whitespace-normal">Step 2: FYP Group, Project &amp; Certificate</span>
            </h2>
            <span class="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full shrink-0">Step 2 of 4</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">FYP Group Name *</label>
              <input id="apply-group-name" type="text" value="${escapeHtml(f.group_name)}" oninput="state.applyForm.group_name = this.value" placeholder="e.g. Visionary Coders" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none transition-all" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Proposed Project Title *</label>
              <input id="apply-project-title" type="text" value="${escapeHtml(f.project_title)}" oninput="state.applyForm.project_title = this.value" placeholder="e.g. AI-Powered Smart Agriculture System" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none transition-all" />
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Abstract</label>
              <textarea id="apply-abstract" rows="3" oninput="state.applyForm.abstract = this.value" placeholder="Brief summary of your project" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none transition-all">${escapeHtml(f.abstract || '')}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Problem Statement</label>
              <textarea id="apply-problem-statement" rows="2" oninput="state.applyForm.problem_statement = this.value" placeholder="What specific problem does this solve?" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none transition-all">${escapeHtml(f.problem_statement || '')}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Objectives</label>
              <textarea id="apply-objectives" rows="2" oninput="state.applyForm.objectives = this.value" placeholder="List key objectives" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none transition-all">${escapeHtml(f.objectives || '')}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Methodology &amp; Tech Stack</label>
              <textarea id="apply-methodology" rows="2" oninput="state.applyForm.methodology = this.value; state.applyForm.technologies = this.value" placeholder="Describe methodology and tech stack" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none transition-all">${escapeHtml(f.methodology || f.technologies || '')}</textarea>
            </div>
          </div>

          <!-- Mandatory Documents Upload (Internship Certificate + Academic Transcript) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Internship Certificate Card -->
            <div class="bg-gray-50 border-2 border-dashed border-fypilot-300 rounded-2xl p-4 text-center flex flex-col justify-between">
              <div>
                <i class="fas fa-file-pdf text-red-500 text-3xl mb-2"></i>
                <h3 class="font-bold text-sm text-gray-900">Internship Certificate *</h3>
                <p class="text-[11px] text-gray-500 mt-1">Upload completion certificate <b>(PDF ONLY)</b></p>
              </div>
              
              <input type="file" id="apply-cert-input" accept="application/pdf,.pdf" class="hidden" onchange="handleApplicationPdfPick(event)" />
              
              ${f.internship_certificate_pdf ? `
                <div class="mt-3 bg-white border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between shadow-sm">
                  <div class="flex items-center gap-2 min-w-0 flex-1">
                    <i class="fas fa-file-pdf text-red-500 text-xl shrink-0"></i>
                    <div class="text-left min-w-0 flex-1">
                      <span class="block text-xs font-bold text-gray-800 truncate">${f.pdf_name}</span>
                      <span class="text-[10px] text-gray-400 block truncate">${f.pdf_size} &bull; PDF Verified</span>
                    </div>
                  </div>
                  <button onclick="document.getElementById('apply-cert-input').click()" class="text-[11px] font-bold text-fypilot-600 hover:text-fypilot-800 border border-fypilot-200 px-2 py-1 rounded-lg shrink-0 ml-1.5">Change</button>
                </div>
              ` : `
                <button onclick="document.getElementById('apply-cert-input').click()" class="mt-3 bg-white border border-gray-300 hover:border-fypilot-500 text-gray-700 font-bold px-3 py-2 rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 mx-auto">
                  <i class="fas fa-upload text-fypilot-600"></i> Select Certificate PDF
                </button>
              `}
            </div>

            <!-- Academic Transcript Card -->
            <div class="bg-gray-50 border-2 border-dashed border-indigo-300 rounded-2xl p-4 text-center flex flex-col justify-between">
              <div>
                <i class="fas fa-file-invoice text-indigo-500 text-3xl mb-2"></i>
                <h3 class="font-bold text-sm text-gray-900">Academic Transcript *</h3>
                <p class="text-[11px] text-gray-500 mt-1">Upload official transcript <b>(PDF ONLY)</b></p>
              </div>
              
              <input type="file" id="apply-transcript-input" accept="application/pdf,.pdf" class="hidden" onchange="handleTranscriptPdfPick(event)" />
              
              ${f.transcript_certificate_pdf ? `
                <div class="mt-3 bg-white border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between shadow-sm">
                  <div class="flex items-center gap-2 min-w-0 flex-1">
                    <i class="fas fa-file-pdf text-red-500 text-xl shrink-0"></i>
                    <div class="text-left min-w-0 flex-1">
                      <span class="block text-xs font-bold text-gray-800 truncate">${f.transcript_pdf_name}</span>
                      <span class="text-[10px] text-gray-400 block truncate">${f.transcript_pdf_size} &bull; PDF Verified</span>
                    </div>
                  </div>
                  <button onclick="document.getElementById('apply-transcript-input').click()" class="text-[11px] font-bold text-fypilot-600 hover:text-fypilot-800 border border-fypilot-200 px-2 py-1 rounded-lg shrink-0 ml-1.5">Change</button>
                </div>
              ` : `
                <button onclick="document.getElementById('apply-transcript-input').click()" class="mt-3 bg-white border border-gray-300 hover:border-indigo-500 text-gray-700 font-bold px-3 py-2 rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 mx-auto">
                  <i class="fas fa-upload text-indigo-600"></i> Select Transcript PDF
                </button>
              `}
            </div>
          </div>

          <!-- Dynamic Group Members -->
          <div>
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label class="block text-xs font-bold text-gray-700">Group Members <span class="text-gray-400 font-normal">(Leader + up to 3 members)</span></label>
              ${f.members.length < 3 ? `
                <button onclick="addApplyMember()" class="text-xs font-bold text-fypilot-700 hover:text-fypilot-900 bg-fypilot-50 hover:bg-fypilot-100 border border-fypilot-200 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 whitespace-nowrap">
                  <i class="fas fa-plus-circle text-fypilot-600"></i> Add Member
                </button>
              ` : ''}
            </div>

            <div class="space-y-2">
              ${f.members.map((m, idx) => `
                <div class="flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2.5">
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="w-6 h-6 rounded-full bg-fypilot-100 text-fypilot-700 font-bold text-[10px] flex items-center justify-center shrink-0">${idx + 1}</span>
                    <input type="text" value="${escapeHtml(m.name)}" oninput="state.applyForm.members[${idx}].name = this.value" placeholder="Member Name *" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-fypilot-500 focus:outline-none" />
                  </div>
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <input type="text" value="${escapeHtml(m.student_id_num)}" oninput="state.applyForm.members[${idx}].student_id_num = this.value" placeholder="Student ID (CSC-21F-xxx) *" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-fypilot-500 focus:outline-none" />
                  </div>
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <input type="email" value="${escapeHtml(m.email || '')}" oninput="state.applyForm.members[${idx}].email = this.value" placeholder="Email (optional, auto-derived)" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-fypilot-500 focus:outline-none" />
                    ${f.members.length > 1 ? `
                      <button onclick="removeApplyMember(${idx})" title="Remove Member" class="p-1.5 text-gray-400 hover:text-rose-600 shrink-0"><i class="fas fa-trash-alt text-xs"></i></button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 pt-5 border-t border-gray-100">
            <button onclick="setApplyStep(1)" class="border border-gray-300 text-gray-700 font-bold px-4 sm:px-6 py-2.5 rounded-xl text-xs hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap">
              <i class="fas fa-arrow-left"></i> <span>Back</span>
            </button>
            <button onclick="setApplyStep(3)" class="bg-gradient-to-r from-fypilot-600 to-indigo-600 hover:from-fypilot-700 hover:to-indigo-700 text-white font-bold px-4 sm:px-6 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none whitespace-nowrap">
              <span>Next: Supervisors</span> <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
        ` : ''}

        ${state.applyStep === 3 ? `
        <!-- STEP 3: Supervisor Preferences & Priority -->
        <div class="space-y-5 fade-in">
          <div class="border-b border-gray-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 min-w-0 flex-1">
              <i class="fas fa-user-tie text-fypilot-600 shrink-0"></i>
              <span class="truncate sm:whitespace-normal">Step 3: Supervisor Preferences &amp; Priority</span>
            </h2>
            <span class="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full shrink-0">Step 3 of 4</span>
          </div>

          <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
            <i class="fas fa-info-circle text-amber-600 mt-0.5 shrink-0"></i>
            <span>Select up to 3 faculty supervisor preferences in order of choice. The coordinator committee will review your selections.</span>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Supervisor Preference 1 * <span class="text-rose-500">(Required)</span></label>
            <select id="apply-pref-1" onchange="state.applyForm.pref_1 = this.value; render();" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none bg-white">
              <option value="">-- Select Preference 1 --</option>
              ${state.supervisorsList.map(s => `<option value="${s.name}" ${f.pref_1 === s.name ? 'selected' : ''}>${s.name} (${s.department || 'CS'})</option>`).join('')}
            </select>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Supervisor Preference 2 <span class="text-gray-400 font-normal">(Optional)</span></label>
              <select id="apply-pref-2" onchange="state.applyForm.pref_2 = this.value; render();" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none bg-white">
                <option value="">-- Select Preference 2 --</option>
                ${state.supervisorsList.map(s => `<option value="${s.name}" ${f.pref_2 === s.name ? 'selected' : ''}>${s.name} (${s.department || 'CS'})</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Supervisor Preference 3 <span class="text-gray-400 font-normal">(Optional)</span></label>
              <select id="apply-pref-3" onchange="state.applyForm.pref_3 = this.value; render();" class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-fypilot-500 focus:outline-none bg-white">
                <option value="">-- Select Preference 3 --</option>
                ${state.supervisorsList.map(s => `<option value="${s.name}" ${f.pref_3 === s.name ? 'selected' : ''}>${s.name} (${s.department || 'CS'})</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Urgent Priority Assignment per Selected Supervisor -->
          <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-1.5">
              <label class="block text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <i class="fas fa-bolt text-amber-500"></i> Urgent Priority Assignment
              </label>
              <span class="text-[10px] bg-amber-200 text-amber-900 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">Select Supervisor Priority</span>
            </div>
            <p class="text-[11px] text-gray-600">You can assign expedited Urgent Priority review to a specific selected supervisor choice.</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label class="flex items-center gap-2.5 p-3 bg-white border ${f.priority === 'Normal' ? 'border-amber-500 ring-2 ring-amber-400/20' : 'border-gray-200'} rounded-xl cursor-pointer hover:border-amber-400 transition-all">
                <input type="radio" name="apply_priority_choice" value="Normal" ${f.priority === 'Normal' ? 'checked' : ''} onchange="state.applyForm.priority = 'Normal'; render();" class="accent-amber-600" />
                <div>
                  <span class="font-bold text-gray-800">Normal Priority</span>
                  <span class="block text-[10px] text-gray-400">Standard evaluation queue for all choice(s)</span>
                </div>
              </label>

              ${f.pref_1 ? `
              <label class="flex items-center gap-2.5 p-3 bg-white border ${f.priority.includes(f.pref_1) ? 'border-amber-500 ring-2 ring-amber-400/20' : 'border-gray-200'} rounded-xl cursor-pointer hover:border-amber-400 transition-all">
                <input type="radio" name="apply_priority_choice" value="Urgent: ${f.pref_1} (Preference 1)" ${f.priority.includes(f.pref_1) ? 'checked' : ''} onchange="state.applyForm.priority = 'Urgent: ${f.pref_1} (Preference 1)'; render();" class="accent-amber-600" />
                <div class="truncate">
                  <span class="font-bold text-amber-700 flex items-center gap-1"><i class="fas fa-bolt text-amber-500"></i> Urgent: Preference 1</span>
                  <span class="block text-[10px] text-gray-600 truncate font-semibold">${f.pref_1}</span>
                </div>
              </label>
              ` : ''}

              ${f.pref_2 ? `
              <label class="flex items-center gap-2.5 p-3 bg-white border ${f.priority.includes(f.pref_2) ? 'border-amber-500 ring-2 ring-amber-400/20' : 'border-gray-200'} rounded-xl cursor-pointer hover:border-amber-400 transition-all">
                <input type="radio" name="apply_priority_choice" value="Urgent: ${f.pref_2} (Preference 2)" ${f.priority.includes(f.pref_2) ? 'checked' : ''} onchange="state.applyForm.priority = 'Urgent: ${f.pref_2} (Preference 2)'; render();" class="accent-amber-600" />
                <div class="truncate">
                  <span class="font-bold text-amber-700 flex items-center gap-1"><i class="fas fa-bolt text-amber-500"></i> Urgent: Preference 2</span>
                  <span class="block text-[10px] text-gray-600 truncate font-semibold">${f.pref_2}</span>
                </div>
              </label>
              ` : ''}

              ${f.pref_3 ? `
              <label class="flex items-center gap-2.5 p-3 bg-white border ${f.priority.includes(f.pref_3) ? 'border-amber-500 ring-2 ring-amber-400/20' : 'border-gray-200'} rounded-xl cursor-pointer hover:border-amber-400 transition-all">
                <input type="radio" name="apply_priority_choice" value="Urgent: ${f.pref_3} (Preference 3)" ${f.priority.includes(f.pref_3) ? 'checked' : ''} onchange="state.applyForm.priority = 'Urgent: ${f.pref_3} (Preference 3)'; render();" class="accent-amber-600" />
                <div class="truncate">
                  <span class="font-bold text-amber-700 flex items-center gap-1"><i class="fas fa-bolt text-amber-500"></i> Urgent: Preference 3</span>
                  <span class="block text-[10px] text-gray-600 truncate font-semibold">${f.pref_3}</span>
                </div>
              </label>
              ` : ''}
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 pt-5 border-t border-gray-100">
            <button onclick="setApplyStep(2)" class="border border-gray-300 text-gray-700 font-bold px-4 sm:px-6 py-2.5 rounded-xl text-xs hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap">
              <i class="fas fa-arrow-left"></i> <span>Back</span>
            </button>
            <button onclick="setApplyStep(4)" class="bg-gradient-to-r from-fypilot-600 to-indigo-600 hover:from-fypilot-700 hover:to-indigo-700 text-white font-bold px-4 sm:px-6 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none whitespace-nowrap">
              <span>Next: Review &amp; Submit</span> <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
        ` : ''}

        ${state.applyStep === 4 ? `
        <!-- STEP 4: Final Review & Confirmation -->
        <div class="space-y-5 fade-in">
          <div class="border-b border-gray-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 min-w-0 flex-1">
              <i class="fas fa-check-double text-fypilot-600 shrink-0"></i>
              <span class="truncate sm:whitespace-normal">Step 4: Final Review &amp; Confirmation</span>
            </h2>
            <span class="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full shrink-0">Step 4 of 4</span>
          </div>

          <div class="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 class="font-bold text-sm text-gray-900 flex items-center justify-between border-b pb-2">
              <span>Application Summary</span>
              <span class="text-xs text-fypilot-600 cursor-pointer hover:underline" onclick="setApplyStep(1)">Edit Information</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div><span class="text-gray-400 font-semibold block">Student Name:</span><span class="font-bold text-gray-800 break-words">${f.student_name}</span></div>
              <div><span class="text-gray-400 font-semibold block">Student ID:</span><span class="font-bold text-gray-800 font-mono">${f.student_id_num}</span></div>
              <div><span class="text-gray-400 font-semibold block">Email:</span><span class="font-bold text-gray-800 font-mono break-all">${f.email}</span></div>
              <div><span class="text-gray-400 font-semibold block">Program &amp; Shift:</span><span class="font-bold text-gray-800">${f.program} (${f.shift})</span></div>
              <div class="sm:col-span-2"><span class="text-gray-400 font-semibold block">Department:</span><span class="font-bold text-gray-800 break-words">${f.department}</span></div>
            </div>

            <div class="border-t pt-3 space-y-2 text-xs">
              <div><span class="text-gray-400 font-semibold block">FYP Group Name:</span><span class="font-bold text-gray-800">${f.group_name}</span></div>
              <div><span class="text-gray-400 font-semibold block">Project Title:</span><span class="font-bold text-gray-800">${f.project_title}</span></div>
              <div><span class="text-gray-400 font-semibold block">Supervisor Preferences:</span><span class="font-bold text-gray-800">1: ${f.pref_1} ${f.pref_2 ? '| 2: ' + f.pref_2 : ''} ${f.pref_3 ? '| 3: ' + f.pref_3 : ''}</span></div>
              <div><span class="text-gray-400 font-semibold block">Priority Designation:</span><span class="font-bold text-amber-700 capitalize">${f.priority}</span></div>
              <div><span class="text-gray-400 font-semibold block">Internship Certificate:</span><span class="font-bold text-emerald-600 flex items-center gap-1"><i class="fas fa-file-pdf text-red-500"></i> ${f.pdf_name} (${f.pdf_size})</span></div>
              <div><span class="text-gray-400 font-semibold block">Academic Transcript:</span><span class="font-bold text-indigo-600 flex items-center gap-1"><i class="fas fa-file-pdf text-red-500"></i> ${f.transcript_pdf_name} (${f.transcript_pdf_size})</span></div>
            </div>
          </div>

          <label class="flex items-start gap-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl cursor-pointer">
            <input type="checkbox" id="apply-confirm-check" class="mt-0.5 accent-emerald-600" />
            <span class="text-xs text-emerald-900 font-medium leading-relaxed">I confirm that all provided academic information, team details, uploaded internship certificate, and academic transcript PDF documents are accurate and authentic.</span>
          </label>

          <div class="flex items-center justify-between gap-3 pt-5 border-t border-gray-100">
            <button onclick="setApplyStep(3)" class="border border-gray-300 text-gray-700 font-bold px-4 sm:px-6 py-2.5 rounded-xl text-xs hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap">
              <i class="fas fa-arrow-left"></i> <span>Back</span>
            </button>
            <button onclick="submitPublicApplication()" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-4 sm:px-8 py-3 rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none whitespace-nowrap">
              <i class="fas fa-paper-plane"></i> <span>Submit FYP Application</span>
            </button>
          </div>
        </div>
        ` : ''}

      </div>
    </div>
  </div>`;
}

function attachApplicationFormListeners() {}

async function submitPublicApplication() {
  const check = document.getElementById('apply-confirm-check');
  if (check && !check.checked) {
    showToast('Please check the confirmation box to submit', 'warning');
    return;
  }

  const f = state.applyForm;

  // Send payload with both parameter keys for complete backend compatibility
  const payload = {
    email: f.email,
    student_id: f.student_id_num,
    student_id_num: f.student_id_num,
    student_name: f.student_name,
    program: f.program,
    shift: f.shift,
    department: f.department,
    group_name: f.group_name,
    project_title: f.project_title,
    abstract: f.abstract,
    problem_statement: f.problem_statement,
    objectives: f.objectives,
    methodology: f.methodology || f.technologies,
    technologies: f.technologies || f.methodology,
    group_members: f.members,
    members: f.members,
    supervisor_preference_1: f.pref_1,
    pref_1: f.pref_1,
    supervisor_preference_2: f.pref_2,
    pref_2: f.pref_2,
    supervisor_preference_3: f.pref_3,
    pref_3: f.pref_3,
    supervisor_priority: f.priority,
    priority: f.priority,
    internship_certificate: f.internship_certificate_pdf,
    internship_certificate_pdf: f.internship_certificate_pdf,
    internship_filename: f.pdf_name,
    pdf_name: f.pdf_name,
    transcript_certificate: f.transcript_certificate_pdf,
    transcript_certificate_pdf: f.transcript_certificate_pdf,
    transcript_filename: f.transcript_pdf_name,
    transcript_pdf_name: f.transcript_pdf_name
  };

  try {
    const res = await api('/applications', { method: 'POST', body: JSON.stringify(payload) });
    if (res.success) {
      state.applySubmitted = true;
      state.applySubmittedData = res.data;
      showToast('Application submitted successfully!', 'success');
      render();
    }
  } catch (e) {}
}

// ===== Admin Governance Panel =====

// Applications polling timer
let _appsPollTimer = null;

function startApplicationsPolling() {
  stopApplicationsPolling();
  _appsPollTimer = setInterval(async () => {
    if (state.currentView !== 'applications') { stopApplicationsPolling(); return; }
    try {
      const res = await api('/applications', { silentError: true });
      const fresh = res.data || [];
      // Only repaint if something actually changed
      if (JSON.stringify(fresh) !== JSON.stringify(state.applications)) {
        state.applications = fresh;
        refreshApplicationsGrid();
      }
    } catch (e) {}
  }, 20000);
}

function stopApplicationsPolling() {
  if (_appsPollTimer) { clearInterval(_appsPollTimer); _appsPollTimer = null; }
}
async function loadApplications() {
  try {
    const res = await api('/applications');
    state.applications = res.data || [];
    refreshApplicationsGrid();
  } catch (e) {
    state.applications = [];
    refreshApplicationsGrid();
  }
}

// Renders only the grid cards — called on search / tab / poll updates without full DOM nuke
function renderApplicationsGrid(filtered) {
  if (!filtered || !filtered.length) {
    return `
      <div class="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
        <i class="fas fa-folder-open text-4xl mb-3 text-gray-300"></i>
        <p class="font-bold text-sm text-gray-600">No applications found</p>
        <p class="text-xs mt-1">Share public application link <b>/apply</b> with students.</p>
      </div>`;
  }
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${filtered.map(a => `
        <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : a.status === 'rejected' ? 'bg-rose-100 text-rose-700' : a.status === 'revision_requested' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}">${a.status.replace('_', ' ')}</span>
              <span class="text-[10px] font-bold font-mono text-gray-400">${a.program} ${a.shift}</span>
            </div>
            <h3 class="font-bold text-gray-900 text-sm truncate">${escapeHtml(a.student_name)}</h3>
            <p class="text-xs text-gray-500 truncate font-mono">${escapeHtml(a.email)}</p>
            <div class="mt-3 pt-3 border-t space-y-1 text-xs">
              <div class="flex justify-between"><span class="text-gray-400">Dept:</span><span class="font-semibold text-gray-700 truncate max-w-[150px]">${a.department}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Group:</span><span class="font-semibold text-gray-700 truncate max-w-[150px]">${a.group_name}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Project:</span><span class="font-semibold text-gray-700 truncate max-w-[150px]">${a.project_title}</span></div>
            </div>
          </div>
          <div class="mt-4 pt-3 border-t flex items-center justify-between">
            <span class="text-[10px] text-gray-400"><i class="fas fa-file-pdf text-red-500 mr-1"></i>PDF Certificate</span>
            <button onclick="showReviewApplicationModal('${a.id}')" class="bg-fypilot-50 hover:bg-fypilot-100 text-fypilot-700 font-bold px-3 py-1.5 rounded-xl text-xs transition-all">Review Application</button>
          </div>
        </div>
      `).join('')}
    </div>`;
}

// Re-paints only the grid container (no full render) — preserves search focus
function refreshApplicationsGrid() {
  const list = state.applications || [];
  const tab = state.applicationsTab || 'all';
  const q = (state.applicationsSearch || '').toLowerCase();

  const filtered = list.filter(a => {
    if (tab !== 'all' && a.status !== tab) return false;
    if (q) {
      const match = (a.student_name || '').toLowerCase().includes(q) ||
                    (a.email || '').toLowerCase().includes(q) ||
                    (a.project_title || '').toLowerCase().includes(q) ||
                    (a.department || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Update tab pills (highlight active)
  const tabs = ['all', 'submitted', 'approved', 'rejected', 'revision_requested'];
  tabs.forEach(t => {
    const el = document.querySelector(`[data-apps-tab="${t}"]`);
    if (!el) return;
    if (t === tab) {
      el.className = 'px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all shrink-0 bg-white text-fypilot-700 shadow-sm';
    } else {
      el.className = 'px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all shrink-0 text-gray-500 hover:text-gray-800';
    }
  });

  // Update grid
  const grid = document.getElementById('apps-grid-container');
  if (grid) grid.innerHTML = renderApplicationsGrid(filtered);
}

function renderApplicationsList() {
  if (!state.applications.length) {
    loadApplications();
  }

  const list = state.applications || [];
  const tab = state.applicationsTab || 'all';

  const filtered = list.filter(a => {
    if (tab !== 'all' && a.status !== tab) return false;
    return true;
  });

  // Attach search listener once rendered
  setTimeout(() => {
    const input = document.getElementById('apps-search-input');
    if (input) {
      input.oninput = (e) => {
        state.applicationsSearch = e.target.value;
        refreshApplicationsGrid();
      };
    }
  }, 100);

  return `
  <div class="fade-in space-y-6">
    <!-- Header Banner -->
    <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-purple-500/20">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 bg-purple-500/30 border border-purple-400/30 text-purple-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <i class="fas fa-file-signature"></i> Application Governance
          </span>
          <h1 class="text-2xl sm:text-3xl font-bold mt-2">Student Public Applications</h1>
          <p class="text-purple-200 text-sm mt-1">Review student applications, verify internship PDF certificates &amp; auto-provision accounts.</p>
        </div>
        <button onclick="loadApplications()" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start">
          <i class="fas fa-sync-alt"></i> Refresh Applications
        </button>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex bg-gray-100 p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar scrollbar-none max-w-full" id="apps-tab-bar">
        ${['all', 'submitted', 'approved', 'rejected', 'revision_requested'].map(t => `
          <button data-apps-tab="${t}" onclick="state.applicationsTab = '${t}'; refreshApplicationsGrid();" class="px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all shrink-0 ${tab === t ? 'bg-white text-fypilot-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}">
            ${t.replace('_', ' ')}
          </button>
        `).join('')}
      </div>

      <div class="relative w-full sm:w-72">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
        <input id="apps-search-input" type="text" value="${escapeHtml(state.applicationsSearch)}" placeholder="Search name, email, project..." class="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-fypilot-500 outline-none" />
      </div>
    </div>

    <!-- Applications Grid (partial-update target) -->
    <div id="apps-grid-container">
      ${renderApplicationsGrid(filtered)}
    </div>

    <!-- Danger Zone -->
    ${isExecutiveRole(state.currentUser?.role) ? `
    <div class="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-4">
        <i class="fas fa-exclamation-triangle text-rose-500"></i>
        <h3 class="font-bold text-rose-800 text-sm uppercase tracking-wider">Danger Zone</h3>
      </div>
      <div class="flex flex-wrap gap-3">
        <button onclick="bulkDeleteAll('applications')" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
          <i class="fas fa-file-excel"></i> Delete All Applications
        </button>
      </div>
      <p class="text-xs text-rose-600 mt-3"><i class="fas fa-info-circle mr-1"></i>Deletes every application record permanently. Approved student accounts are not removed.</p>
    </div>` : ''}
  </div>`;
}

async function showReviewApplicationModal(id) {
  let appItem = (state.applications || []).find(a => a.id === id);
  
  try {
    const res = await api(`/applications/${id}`);
    if (res && res.data) {
      appItem = res.data;
    }
  } catch (e) {
    console.error('Failed to fetch full application detail:', e);
  }

  if (!appItem) {
    showToast('Application details could not be loaded', 'error');
    return;
  }

  const p1 = appItem.supervisor_1_name || appItem.supervisor_preference_1 || appItem.pref_1 || 'None';
  const p2 = appItem.supervisor_2_name || appItem.supervisor_preference_2 || appItem.pref_2 || '';
  const p3 = appItem.supervisor_3_name || appItem.supervisor_preference_3 || appItem.pref_3 || '';
  const priority = appItem.supervisor_priority || appItem.priority || 'Normal';
  const studentId = appItem.student_id_num || appItem.student_id || 'N/A';
  const pdfCert = appItem.internship_certificate || appItem.internship_certificate_pdf;
  const pdfFilename = appItem.internship_filename || appItem.pdf_name || `Internship_Certificate_${studentId}.pdf`;
  const transcriptCert = appItem.transcript_certificate || appItem.transcript_certificate_pdf;
  const transcriptFilename = appItem.transcript_filename || appItem.transcript_pdf_name || `Transcript_${studentId}.pdf`;

  let members = [];
  try {
    const rawMem = appItem.group_members || appItem.members;
    members = typeof rawMem === 'string' ? JSON.parse(rawMem) : (rawMem || []);
  } catch(e) {}

  const overlay = document.createElement('div');
  overlay.id = 'app-modal-overlay';
  overlay.className = 'fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';

  overlay.innerHTML = `
  <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl sm:max-w-3xl max-h-[90vh] overflow-y-auto no-scrollbar scrollbar-none fade-in">
    <div class="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50 rounded-t-3xl">
      <div class="min-w-0 flex-1">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase inline-block ${appItem.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : appItem.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}">${appItem.status.replace('_', ' ')}</span>
        <h3 class="font-bold text-base sm:text-lg text-gray-900 mt-0.5 leading-tight truncate">Review Student FYP Application</h3>
      </div>
      <button onclick="document.getElementById('app-modal-overlay').remove()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-200 flex items-center justify-center shrink-0"><i class="fas fa-times"></i></button>
    </div>
    
    <div class="p-4 sm:p-6 space-y-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-2xl p-4 text-xs">
        <div><span class="text-gray-400 font-semibold block">Student Name:</span><span class="font-bold text-gray-900 break-words">${escapeHtml(appItem.student_name)}</span></div>
        <div><span class="text-gray-400 font-semibold block">University Email:</span><span class="font-bold text-gray-900 font-mono break-all">${escapeHtml(appItem.email)}</span></div>
        <div><span class="text-gray-400 font-semibold block">Student ID:</span><span class="font-bold text-gray-900 font-mono">${escapeHtml(studentId)}</span></div>
        <div><span class="text-gray-400 font-semibold block">Program / Shift:</span><span class="font-bold text-gray-900">${appItem.program} (${appItem.shift})</span></div>
        <div class="sm:col-span-2"><span class="text-gray-400 font-semibold block">Department:</span><span class="font-bold text-gray-900 break-words">${escapeHtml(appItem.department)}</span></div>
      </div>

      <div class="border-t pt-3 space-y-2 text-xs">
        <div><span class="text-gray-400 font-semibold block">FYP Group Name:</span><span class="font-bold text-gray-900 text-sm break-words">${escapeHtml(appItem.group_name)}</span></div>
        <div><span class="text-gray-400 font-semibold block">Project Title:</span><span class="font-bold text-gray-900 text-sm break-words">${escapeHtml(appItem.project_title)}</span></div>
        <div><span class="text-gray-400 font-semibold block">Supervisor Preferences:</span><span class="font-bold text-gray-800 break-words">1: ${escapeHtml(p1)} ${p2 ? '| 2: ' + escapeHtml(p2) : ''} ${p3 ? '| 3: ' + escapeHtml(p3) : ''}</span></div>
        <div><span class="text-gray-400 font-semibold block">Priority Designation:</span><span class="font-bold text-amber-700 capitalize break-words">${escapeHtml(priority)}</span></div>
        ${appItem.admin_notes ? `<div><span class="text-gray-400 font-semibold block">Admin Notes:</span><span class="font-medium text-gray-700 break-words">${escapeHtml(appItem.admin_notes)}</span></div>` : ''}
      </div>

      ${members.length ? `
        <div class="border-t pt-3">
          <h4 class="text-xs font-bold text-gray-700 mb-2">Group Team Members (${members.length})</h4>
          <div class="space-y-1.5">
            ${members.map(m => `<div class="text-xs bg-gray-50 border border-gray-200 p-2.5 rounded-xl flex flex-wrap justify-between items-center gap-1"><span class="font-semibold text-gray-800 break-words">${escapeHtml(m.name || m.student_name)}</span><span class="font-mono text-gray-500">${escapeHtml(m.student_id_num || m.student_id)}</span></div>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Internship PDF Certificate Viewer & Download -->
      <div class="border-t pt-3 space-y-2">
        <h4 class="text-xs font-bold text-gray-700 flex items-center justify-between">
          <span><i class="fas fa-file-pdf text-red-500 mr-1.5"></i> 1. Internship Certificate PDF Document</span>
          ${pdfCert ? `<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">PDF Attached</span>` : '<span class="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">Not Attached</span>'}
        </h4>

        ${pdfCert ? `
          <div class="bg-slate-900 rounded-2xl p-4 text-white space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span class="text-xs font-mono text-gray-300 truncate max-w-full sm:max-w-xs"><i class="fas fa-paperclip text-red-400 mr-1"></i> ${escapeHtml(pdfFilename)}</span>
              <div class="flex flex-wrap items-center gap-2">
                <button onclick="openPdfDataUrlInNewTab('${escapeHtml(pdfCert)}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1">
                  <i class="fas fa-external-link-alt"></i> Open Full Screen
                </button>
                <a href="${pdfCert}" download="${escapeHtml(pdfFilename)}" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1">
                  <i class="fas fa-download"></i> Download PDF
                </a>
              </div>
            </div>

            <!-- Embedded PDF Preview Frame -->
            <div class="rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
              <iframe src="${pdfCert}" class="w-full h-56 sm:h-64 border-0 bg-white" title="Internship Certificate PDF"></iframe>
            </div>
          </div>
        ` : `
          <div class="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-500">
            No PDF internship certificate document attached.
          </div>
        `}
      </div>

      <!-- Academic Transcript PDF Viewer & Download -->
      <div class="border-t pt-3 space-y-2">
        <h4 class="text-xs font-bold text-gray-700 flex items-center justify-between">
          <span><i class="fas fa-file-invoice text-indigo-500 mr-1.5"></i> 2. Academic Transcript PDF Document</span>
          ${transcriptCert ? `<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">PDF Attached</span>` : '<span class="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">Not Attached</span>'}
        </h4>

        ${transcriptCert ? `
          <div class="bg-slate-900 rounded-2xl p-4 text-white space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span class="text-xs font-mono text-gray-300 truncate max-w-full sm:max-w-xs"><i class="fas fa-paperclip text-indigo-400 mr-1"></i> ${escapeHtml(transcriptFilename)}</span>
              <div class="flex flex-wrap items-center gap-2">
                <button onclick="openPdfDataUrlInNewTab('${escapeHtml(transcriptCert)}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1">
                  <i class="fas fa-external-link-alt"></i> Open Full Screen
                </button>
                <a href="${transcriptCert}" download="${escapeHtml(transcriptFilename)}" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1">
                  <i class="fas fa-download"></i> Download PDF
                </a>
              </div>
            </div>

            <!-- Embedded PDF Preview Frame -->
            <div class="rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
              <iframe src="${transcriptCert}" class="w-full h-56 sm:h-64 border-0 bg-white" title="Academic Transcript PDF"></iframe>
            </div>
          </div>
        ` : `
          <div class="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-500">
            No PDF transcript document attached.
          </div>
        `}
      </div>

      ${appItem.status !== 'approved' ? `
        <div class="border-t pt-4 flex flex-wrap gap-2 justify-end">
          <button onclick="updateApplicationStatus('${appItem.id}', 'approved')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5">
            <i class="fas fa-check-circle"></i> Approve &amp; Auto-Provision Account
          </button>
          <button onclick="updateApplicationStatus('${appItem.id}', 'revision_requested')" class="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all">
            Request Changes
          </button>
          <button onclick="updateApplicationStatus('${appItem.id}', 'rejected')" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all">
            Reject Application
          </button>
        </div>
      ` : `
        <div class="border-t pt-3 bg-emerald-50 border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800 font-semibold flex items-center gap-2">
          <i class="fas fa-check-circle text-emerald-600 text-base"></i>
          <span>Application Approved! Student user account, group, proposal &amp; project were automatically provisioned.</span>
        </div>
      `}
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

function openPdfDataUrlInNewTab(dataUrl) {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) {
      window.open(dataUrl, '_blank');
      return;
    }
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  } catch (e) {
    console.error('DataURL blob conversion failed:', e);
    window.open(dataUrl, '_blank');
  }
}
window.openPdfDataUrlInNewTab = openPdfDataUrlInNewTab;

async function updateApplicationStatus(id, status) {
  if (status === 'approved') {
    showApproveWithPasswordDialog(id);
    return;
  }

  // For reject / revision_requested — prompt for notes
  const notes = prompt(`Enter admin notes for "${status.replace('_', ' ')}" (optional):`);
  try {
    const res = await api(`/applications/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_notes: notes || '' })
    });
    if (res.success) {
      showToast(res.message || `Application status updated to ${status}`, 'success');
      const o = document.getElementById('app-modal-overlay');
      if (o) o.remove();
      loadApplications();
    }
  } catch (e) {}
}

function generateRandomStudentPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let result = 'SMIU@';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const input = document.getElementById('approve-pwd-input');
  if (input) {
    input.value = result;
    input.type = 'text';
    const icon = document.getElementById('toggle-approve-pwd-icon');
    if (icon) icon.className = 'fas fa-eye-slash text-xs';
    input.dispatchEvent(new Event('input'));
  }
  showToast('Random password generated!', 'success');
}
window.generateRandomStudentPassword = generateRandomStudentPassword;

function showApproveWithPasswordDialog(appId) {
  // Find the application from state to pre-fill info
  const app = (state.applications || []).find(a => a.id === appId) || {};
  const studentEmail = app.email || '';
  const studentName = app.student_name || 'Student';

  // Remove existing dialog if open
  const existing = document.getElementById('approve-pwd-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'approve-pwd-overlay';
  overlay.className = 'fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4';

  overlay.innerHTML = `
  <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar scrollbar-none fade-in">
    <div class="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-emerald-50 rounded-t-3xl">
      <div class="min-w-0 flex-1">
        <span class="text-xs font-bold text-emerald-700 flex items-center gap-1.5"><i class="fas fa-user-check"></i> Approve &amp; Provision Account</span>
        <h3 class="font-bold text-base text-gray-900 mt-0.5 truncate">Set Student Login Password</h3>
      </div>
      <button onclick="document.getElementById('approve-pwd-overlay').remove()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-200 flex items-center justify-center shrink-0">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="p-4 sm:p-5 space-y-4">
      <div class="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-800 flex items-start gap-2">
        <i class="fas fa-info-circle text-blue-500 mt-0.5 shrink-0"></i>
        <span>Set or generate a login password for <strong>${escapeHtml(studentName)}</strong>. Upon approval, this student account will be activated and ready for login.</span>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Student Email / Login Username</label>
          <div class="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5">
            <i class="fas fa-envelope text-gray-400 text-xs shrink-0"></i>
            <span class="text-xs font-mono text-gray-700 flex-1 break-all truncate">${escapeHtml(studentEmail)}</span>
            <button onclick="navigator.clipboard.writeText('${escapeHtml(studentEmail)}').then(()=>showToast('Email copied!','success'))" class="text-fypilot-600 hover:text-fypilot-800 text-xs shrink-0 p-1" title="Copy">
              <i class="fas fa-copy"></i>
            </button>
          </div>
        </div>

        <div>
          <div class="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
            <label class="block text-xs font-bold text-gray-700 shrink-0">Set Login Password <span class="text-rose-500">*</span></label>
            <button type="button" onclick="generateRandomStudentPassword()" class="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-all shadow-xs shrink-0">
              <i class="fas fa-magic text-[10px]"></i> Auto-Generate Password
            </button>
          </div>
          <div class="relative">
            <input id="approve-pwd-input" type="password" placeholder="Enter password or click Auto-Generate" minlength="6"
              class="w-full pl-3.5 pr-9 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" />
            <button type="button" onclick="
              const i = document.getElementById('approve-pwd-input');
              const ic = document.getElementById('toggle-approve-pwd-icon');
              if(i.type==='password'){i.type='text';ic.className='fas fa-eye-slash text-xs';}
              else{i.type='password';ic.className='fas fa-eye text-xs';}
            " class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
              <i id="toggle-approve-pwd-icon" class="fas fa-eye text-xs"></i>
            </button>
          </div>
          <p class="text-[10px] text-gray-400 mt-1">Minimum 6 characters. Share this password directly with the student.</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Admin Notes <span class="text-gray-400 font-normal">(Optional)</span></label>
          <textarea id="approve-notes-input" rows="2" placeholder="Any internal notes for this approval..."
            class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"></textarea>
        </div>
      </div>

      <!-- Credential Preview Card -->
      <div id="cred-preview-card" class="hidden bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl p-4 text-xs space-y-2">
        <div class="flex items-center gap-2 font-bold text-emerald-300 text-[10px] uppercase tracking-wider"><i class="fas fa-id-card"></i> Student Login Credentials</div>
        <div class="flex justify-between"><span class="text-emerald-300">Name:</span><span class="font-bold">${escapeHtml(studentName)}</span></div>
        <div class="flex justify-between"><span class="text-emerald-300">Email:</span><span class="font-mono font-bold break-all">${escapeHtml(studentEmail)}</span></div>
        <div class="flex justify-between"><span class="text-emerald-300">Password:</span><span id="cred-pwd-display" class="font-mono font-bold tracking-wider">—</span></div>
        <div class="flex justify-between"><span class="text-emerald-300">Portal URL:</span><span class="font-mono break-all">${window.location.origin}</span></div>
      </div>
    </div>

    <div class="px-5 pb-5 flex flex-wrap gap-2 justify-end">
      <button onclick="document.getElementById('approve-pwd-overlay').remove()" class="border border-gray-200 text-gray-600 font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-gray-50 transition-all flex-1 sm:flex-none">
        Cancel
      </button>
      <button onclick="submitApproveWithPassword('${appId}')" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none">
        <i class="fas fa-check-circle"></i> Approve &amp; Create Account
      </button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  // Live-update the credential preview card as user types
  const pwdInput = document.getElementById('approve-pwd-input');
  if (pwdInput) {
    pwdInput.addEventListener('input', () => {
      const val = pwdInput.value;
      const card = document.getElementById('cred-preview-card');
      const display = document.getElementById('cred-pwd-display');
      if (val.length >= 6) {
        if (card) card.classList.remove('hidden');
        if (display) display.textContent = val;
      } else {
        if (card) card.classList.add('hidden');
      }
    });
    setTimeout(() => pwdInput.focus(), 100);
  }
}

async function submitApproveWithPassword(appId) {
  const app = (state.applications || []).find(a => a.id === appId) || {};
  const pwdInput = document.getElementById('approve-pwd-input');
  const notesInput = document.getElementById('approve-notes-input');
  const password = pwdInput ? pwdInput.value.trim() : '';
  const admin_notes = notesInput ? notesInput.value.trim() : '';

  if (!password || password.length < 6) {
    showToast('Password must be at least 6 characters', 'warning');
    if (pwdInput) pwdInput.focus();
    return;
  }

  const btn = document.querySelector('#approve-pwd-overlay button[onclick*="submitApproveWithPassword"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...'; }

  try {
    const res = await api(`/applications/${appId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'approved', password, admin_notes })
    });
    if (res.success) {
      showToast(res.message || 'Application approved and student account created!', 'success');
      
      const pwdOverlay = document.getElementById('approve-pwd-overlay');
      if (pwdOverlay) pwdOverlay.remove();
      const appOverlay = document.getElementById('app-modal-overlay');
      if (appOverlay) appOverlay.remove();

      // Show Credential Summary Pop-Up so Admin can easily copy credentials for the student
      showCreatedCredentialsModal(app.student_name || 'Student', app.email || '', password);

      loadApplications();
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Approve & Create Account'; }
  }
}

function showCreatedCredentialsModal(name, email, password) {
  const credText = `FYPilot Student Account Created Successfully!
Student Name: ${name}
Email / Username: ${email}
Password: ${password}
Portal URL: ${window.location.origin}`;

  const overlay = document.createElement('div');
  overlay.id = 'created-cred-modal';
  overlay.className = 'fixed inset-0 z-[220] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4';

  overlay.innerHTML = `
  <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md fade-in">
    <div class="p-5 border-b border-gray-100 flex items-center justify-between bg-emerald-600 text-white rounded-t-3xl">
      <div>
        <span class="text-xs font-bold text-emerald-200 uppercase tracking-wider"><i class="fas fa-check-circle mr-1"></i> Account Provisioned</span>
        <h3 class="font-bold text-base mt-0.5">Student Login Details</h3>
      </div>
      <button onclick="document.getElementById('created-cred-modal').remove()" class="w-8 h-8 rounded-lg text-emerald-200 hover:bg-white/10 flex items-center justify-center">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="p-5 space-y-4 text-xs">
      <p class="text-gray-600">The application is approved and the account is active. Copy the login credentials below to share with the student:</p>
      
      <div class="bg-slate-900 text-white rounded-2xl p-4 space-y-2 font-mono border border-slate-800">
        <div class="flex justify-between border-b border-slate-800 pb-1.5"><span class="text-emerald-400 font-sans">Name:</span><span class="font-bold">${escapeHtml(name)}</span></div>
        <div class="flex justify-between border-b border-slate-800 pb-1.5"><span class="text-emerald-400 font-sans">Email (Login):</span><span class="font-bold">${escapeHtml(email)}</span></div>
        <div class="flex justify-between border-b border-slate-800 pb-1.5"><span class="text-emerald-400 font-sans">Password:</span><span class="font-bold text-amber-400">${escapeHtml(password)}</span></div>
        <div class="flex justify-between"><span class="text-emerald-400 font-sans">URL:</span><span>${window.location.origin}</span></div>
      </div>
    </div>

    <div class="px-5 pb-5 flex gap-2 justify-end">
      <button onclick="
        navigator.clipboard.writeText(\`${credText}\`).then(() => {
          showToast('Credentials copied to clipboard!', 'success');
        });
      " class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5">
        <i class="fas fa-copy"></i> Copy Credentials
      </button>
      <button onclick="document.getElementById('created-cred-modal').remove()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-all">
        Close
      </button>
    </div>
  </div>`;

  document.body.appendChild(overlay);
}
window.showCreatedCredentialsModal = showCreatedCredentialsModal;


// ===== Weekly Updates & Meeting Verification Workflows =====

async function submitWeeklyUpdate(projectId) {
  const week_number = document.getElementById('wu-week').value;
  const lifecycle_stage = document.getElementById('wu-stage').value;
  const progress_pct = document.getElementById('wu-progress').value;
  const work_done = document.getElementById('wu-work-done').value.trim();
  const description = document.getElementById('wu-desc').value.trim();
  const planned_work = document.getElementById('wu-planned').value.trim();

  if (!work_done || !description || !planned_work) {
    showToast('Please fill all required update fields', 'error');
    return;
  }

  try {
    const res = await api(`/projects/${projectId}/weekly-updates`, {
      method: 'POST',
      body: JSON.stringify({ week_number, lifecycle_stage, progress_pct, work_done, description, planned_work })
    });
    if (res.success) {
      showToast('Weekly progress update submitted!', 'success');
      const o = document.getElementById('wu-modal-overlay');
      if (o) o.remove();
      loadProjectDetail(projectId);
    }
  } catch (e) {}
}

async function submitWeeklyFeedback(projectId, updateId) {
  const feedback = document.getElementById('wf-feedback').value.trim();
  if (!feedback) {
    showToast('Feedback text is required', 'error');
    return;
  }

  try {
    const res = await api(`/projects/${projectId}/weekly-updates/${updateId}/feedback`, {
      method: 'PUT',
      body: JSON.stringify({ feedback })
    });
    if (res.success) {
      showToast('Supervisor feedback saved!', 'success');
      const o = document.getElementById('wf-modal-overlay');
      if (o) o.remove();
      loadProjectDetail(projectId);
    }
  } catch (e) {}
}

function showRecordMeetingModal(projectId) {
  if (state.currentUser && state.currentUser.role !== 'student') {
    showToast('Only students can record meeting logs. Supervisors verify recorded meetings.', 'warning');
    return;
  }

  const existing = document.getElementById('rm-modal-overlay');
  if (existing) existing.remove();

  const today = new Date().toISOString().split('T')[0];
  const overlay = document.createElement('div');
  overlay.id = 'rm-modal-overlay';
  overlay.className = 'fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';

  overlay.innerHTML = `
  <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar scrollbar-none fade-in">
    <div class="p-5 border-b border-gray-100 flex items-center justify-between bg-emerald-50 rounded-t-3xl">
      <div>
        <span class="text-xs font-bold text-emerald-700 flex items-center gap-1.5"><i class="fas fa-calendar-alt"></i> Meeting Verification System</span>
        <h3 class="font-bold text-base text-gray-900 mt-0.5">Record Supervisor Meeting</h3>
      </div>
      <button onclick="document.getElementById('rm-modal-overlay').remove()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-200 flex items-center justify-center">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="p-5 space-y-4">
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800 flex items-start gap-2">
        <i class="fas fa-exclamation-triangle text-amber-500 mt-0.5 shrink-0"></i>
        <span><strong>Verification Rule:</strong> Submitting this meeting record sets status to <strong>Pending Verification</strong>. It will NOT increment your meeting count until your supervisor verifies it.</span>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-bold text-gray-700 mb-1">Meeting Date <span class="text-rose-500">*</span></label>
          <input id="rm-date" type="date" value="${today}" class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>

        <div>
          <label class="block font-bold text-gray-700 mb-1">Meeting Subject / Title <span class="text-rose-500">*</span></label>
          <input id="rm-title" type="text" placeholder="e.g., Module 2 Progress Review & Architecture Discussion" class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>

        <div>
          <label class="block font-bold text-gray-700 mb-1">Key Discussion Points</label>
          <textarea id="rm-discussion" rows="2" placeholder="Topics discussed during the supervisor meeting..." class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"></textarea>
        </div>

        <div>
          <label class="block font-bold text-gray-700 mb-1">Work / Progress Discussed</label>
          <textarea id="rm-work" rows="2" placeholder="Summary of completed features shown to supervisor..." class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"></textarea>
        </div>

        <div>
          <label class="block font-bold text-gray-700 mb-1">Tasks / Action Items Assigned</label>
          <textarea id="rm-action" rows="2" placeholder="Action items given by supervisor for next iteration..." class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"></textarea>
        </div>

        <div>
          <label class="block font-bold text-gray-700 mb-1">Next Meeting Plan</label>
          <input id="rm-next" type="text" placeholder="Target date or focus area for next meeting..." class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>
      </div>
    </div>

    <div class="px-5 pb-5 flex gap-2 justify-end">
      <button onclick="document.getElementById('rm-modal-overlay').remove()" class="border border-gray-200 text-gray-600 font-bold px-4 py-2 rounded-xl text-xs hover:bg-gray-50 transition-all">
        Cancel
      </button>
      <button onclick="submitRecordMeeting('${projectId}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5">
        <i class="fas fa-paper-plane"></i> Submit Record for Verification
      </button>
    </div>
  </div>`;

  document.body.appendChild(overlay);
}

async function submitRecordMeeting(projectId) {
  const dateInput = document.getElementById('rm-date');
  const titleInput = document.getElementById('rm-title');
  const discInput = document.getElementById('rm-discussion');
  const workInput = document.getElementById('rm-work');
  const actionInput = document.getElementById('rm-action');
  const nextInput = document.getElementById('rm-next');

  const meeting_date = dateInput ? dateInput.value : '';
  const title = titleInput ? titleInput.value.trim() : '';
  const discussion = discInput ? discInput.value.trim() : '';
  const work_discussed = workInput ? workInput.value.trim() : '';
  const action_items = actionInput ? actionInput.value.trim() : '';
  const next_meeting = nextInput ? nextInput.value.trim() : '';

  if (!title) {
    showToast('Meeting title is required', 'warning');
    if (titleInput) titleInput.focus();
    return;
  }

  try {
    const res = await api(`/projects/${projectId}/meetings`, {
      method: 'POST',
      body: JSON.stringify({
        meeting_date,
        title,
        discussion,
        work_discussed,
        action_items,
        next_meeting,
        verification_status: 'pending'
      })
    });

    if (res.success) {
      showToast(res.message || 'Meeting record submitted for supervisor verification!', 'success');
      const o = document.getElementById('rm-modal-overlay');
      if (o) o.remove();
      loadProjectDetail(projectId);
    }
  } catch (e) {
    console.error('Error submitting meeting record:', e);
  }
}

function showVerifyMeetingModal(projectId, meetingId) {
  const p = state.selectedProject;
  const meetings = p ? (p.meetings || []) : [];
  const meeting = meetings.find(m => m.id === meetingId) || {};

  const existing = document.getElementById('vm-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'vm-modal-overlay';
  overlay.className = 'fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';

  overlay.innerHTML = `
  <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar scrollbar-none fade-in">
    <div class="p-5 border-b border-gray-100 flex items-center justify-between bg-indigo-50 rounded-t-3xl">
      <div>
        <span class="text-xs font-bold text-indigo-700 flex items-center gap-1.5"><i class="fas fa-user-check"></i> Supervisor Verification</span>
        <h3 class="font-bold text-base text-gray-900 mt-0.5">Verify Student Meeting Record</h3>
      </div>
      <button onclick="document.getElementById('vm-modal-overlay').remove()" class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-200 flex items-center justify-center">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="p-5 space-y-4 text-xs">
      <div class="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-200">
        <div class="flex justify-between items-center"><span class="text-gray-400 font-semibold">Student:</span><span class="font-bold text-gray-900">${escapeHtml(meeting.student_name || 'Student')}</span></div>
        <div class="flex justify-between items-center"><span class="text-gray-400 font-semibold">Meeting Date:</span><span class="font-bold font-mono text-gray-900">${escapeHtml(meeting.meeting_date || meeting.scheduled_at || 'N/A')}</span></div>
        <div class="flex justify-between items-center"><span class="text-gray-400 font-semibold">Title:</span><span class="font-bold text-gray-900">${escapeHtml(meeting.title || 'Supervisor Meeting')}</span></div>
      </div>

      ${meeting.discussion ? `<div><span class="font-bold text-gray-700 block mb-0.5">Discussion Summary:</span><p class="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-gray-800">${escapeHtml(meeting.discussion)}</p></div>` : ''}
      ${meeting.work_discussed ? `<div><span class="font-bold text-gray-700 block mb-0.5">Work Discussed:</span><p class="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-gray-800">${escapeHtml(meeting.work_discussed)}</p></div>` : ''}
      ${meeting.action_items ? `<div><span class="font-bold text-gray-700 block mb-0.5">Tasks / Action Items:</span><p class="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-gray-800">${escapeHtml(meeting.action_items)}</p></div>` : ''}

      <div>
        <label class="block font-bold text-gray-700 mb-1">Supervisor Evaluation & Feedback Notes</label>
        <textarea id="vm-feedback" rows="3" placeholder="Enter supervisor feedback or verification comments..." class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none">${escapeHtml(meeting.supervisor_feedback || '')}</textarea>
      </div>
    </div>

    <div class="px-5 pb-5 flex flex-wrap gap-2 justify-end border-t pt-4">
      <button onclick="submitVerifyMeeting('${projectId}', '${meetingId}', 'reject')" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all">
        Reject Meeting
      </button>
      <button onclick="submitVerifyMeeting('${projectId}', '${meetingId}', 'request_changes')" class="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all">
        Request Changes
      </button>
      <button onclick="submitVerifyMeeting('${projectId}', '${meetingId}', 'verify')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5">
        <i class="fas fa-check-circle"></i> Verify &amp; Increment Count
      </button>
    </div>
  </div>`;

  document.body.appendChild(overlay);
}

async function submitVerifyMeeting(projectId, meetingId, action) {
  const feedbackInput = document.getElementById('vm-feedback');
  const feedback = feedbackInput ? feedbackInput.value.trim() : '';

  try {
    const res = await api(`/projects/${projectId}/meetings/${meetingId}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ action, feedback })
    });
    if (res.success) {
      showToast(res.message || 'Meeting status updated!', 'success');
      const o = document.getElementById('vm-modal-overlay');
      if (o) o.remove();
      loadProjectDetail(projectId);
    }
  } catch (e) {}
}

async function showStudentProfileModal(studentId) {
  try {
    const res = await api(`/users/${studentId}/student-profile`);
    if (!res || !res.data) {
      showToast('Could not load student profile', 'error');
      return;
    }
    const data = res.data;
    const student = data.student || {};
    const project = data.project || {};
    const group = data.group || {};
    const meetings = data.meetings || [];
    const verifiedCount = data.verified_meetings_count || 0;
    const evaluations = data.evaluations || [];
    const updates = data.weekly_updates || [];

    const existing = document.getElementById('student-profile-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'student-profile-overlay';
    overlay.className = 'fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';

    overlay.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar scrollbar-none fade-in">
      <div class="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-t-3xl">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-lg font-bold text-white shadow-md">
            ${(student.name || 'S').charAt(0)}
          </div>
          <div>
            <h3 class="font-bold text-lg text-white">${escapeHtml(student.name)}</h3>
            <p class="text-xs text-indigo-200 font-mono">${escapeHtml(student.email)} &bull; ID: ${escapeHtml(student.student_id_num || 'N/A')}</p>
          </div>
        </div>
        <button onclick="document.getElementById('student-profile-overlay').remove()" class="w-8 h-8 rounded-lg text-indigo-200 hover:bg-white/10 flex items-center justify-center">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="p-6 space-y-6">
        <!-- Prominent Verified Meetings Counter Banner -->
        <div class="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div class="space-y-0.5">
            <span class="text-[10px] uppercase tracking-wider font-bold text-emerald-200">Official Database Record</span>
            <h4 class="text-xl font-extrabold flex items-center gap-2">
              <i class="fas fa-check-circle text-emerald-300"></i> ${verifiedCount} Verified Meetings
            </h4>
            <p class="text-[11px] text-emerald-100">Calculated strictly from database verification status. Students cannot manually edit count.</p>
          </div>
          <div class="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center text-2xl font-bold text-white">
            <i class="fas fa-calendar-check"></i>
          </div>
        </div>

        <!-- Student Academic & Project Info -->
        <div class="grid grid-cols-2 gap-3 bg-gray-50 rounded-2xl p-4 text-xs border border-gray-200">
          <div><span class="text-gray-400 font-semibold block">Program &amp; Shift:</span><span class="font-bold text-gray-900">${student.program || 'BS'} (${student.shift || 'Morning'})</span></div>
          <div><span class="text-gray-400 font-semibold block">Department:</span><span class="font-bold text-gray-900">${escapeHtml(student.department || 'Computer Science')}</span></div>
          <div><span class="text-gray-400 font-semibold block">FYP Group:</span><span class="font-bold text-gray-900">${escapeHtml(group.group_name || 'Unassigned')}</span></div>
          <div><span class="text-gray-400 font-semibold block">Project Title:</span><span class="font-bold text-gray-900 truncate">${escapeHtml(project.title || 'Unassigned')}</span></div>
        </div>

        <!-- Meetings & Verification Logs -->
        <div class="border-t pt-4 space-y-3">
          <h4 class="font-bold text-xs text-gray-800 flex items-center justify-between">
            <span><i class="fas fa-history text-emerald-600 mr-1.5"></i> Meeting History &amp; Status</span>
            <span class="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">${meetings.length} Total Logs</span>
          </h4>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${meetings.length ? meetings.map(m => {
              const statusColors = {
                verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                pending: 'bg-amber-100 text-amber-800 border-amber-200',
                revision_requested: 'bg-purple-100 text-purple-800 border-purple-200',
                rejected: 'bg-rose-100 text-rose-800 border-rose-200'
              };
              const st = m.verification_status || 'pending';
              return `
                <div class="p-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between text-xs">
                  <div>
                    <span class="font-bold text-gray-900 block">${escapeHtml(m.title || 'Supervisor Meeting')}</span>
                    <span class="text-[10px] text-gray-500 font-mono"><i class="far fa-calendar-alt mr-1"></i>${m.meeting_date || m.scheduled_at}</span>
                  </div>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusColors[st] || 'bg-gray-100'}">${st.replace('_', ' ')}</span>
                </div>
              `;
            }).join('') : '<p class="text-xs text-gray-400">No meeting logs found.</p>'}
          </div>
        </div>

        <!-- Supervisor Evaluations -->
        <div class="border-t pt-4 space-y-3">
          <h4 class="font-bold text-xs text-gray-800 flex items-center gap-1.5">
            <i class="fas fa-award text-amber-500"></i> Supervisor Evaluations &amp; Grades
          </h4>
          <div class="space-y-2 max-h-44 overflow-y-auto">
            ${evaluations.length ? evaluations.map(ev => `
              <div class="p-3 rounded-xl border border-amber-200 bg-amber-50/40 text-xs space-y-1">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-amber-900">${ev.grade ? 'Grade: ' + ev.grade : ''} ${ev.score !== null ? '(' + ev.score + '/100)' : ''}</span>
                  <span class="text-[10px] text-gray-400 font-mono">${new Date(ev.created_at).toLocaleDateString()}</span>
                </div>
                <p class="text-gray-700">${escapeHtml(ev.comments)}</p>
                <p class="text-[10px] text-gray-400 italic">By: ${escapeHtml(ev.supervisor_name || 'Supervisor')}</p>
              </div>
            `).join('') : '<p class="text-xs text-gray-400">No evaluations recorded yet.</p>'}
          </div>
        </div>
      </div>
    </div>`;

    document.body.appendChild(overlay);
  } catch (e) {
    showToast('Failed to load profile', 'error');
  }
}

// Register Global Window Handles
window.navigateToApply = navigateToApply;
window.updateApplyDepartmentOptions = updateApplyDepartmentOptions;
window.setApplyStep = setApplyStep;
window.addApplyMember = addApplyMember;
window.removeApplyMember = removeApplyMember;
window.handleApplicationPdfPick = handleApplicationPdfPick;
window.submitPublicApplication = submitPublicApplication;
window.loadApplications = loadApplications;
window.renderApplicationsList = renderApplicationsList;
window.refreshApplicationsGrid = refreshApplicationsGrid;
window.startApplicationsPolling = startApplicationsPolling;
window.stopApplicationsPolling = stopApplicationsPolling;
window.showReviewApplicationModal = showReviewApplicationModal;
window.updateApplicationStatus = updateApplicationStatus;
window.showApproveWithPasswordDialog = showApproveWithPasswordDialog;
window.submitApproveWithPassword = submitApproveWithPassword;
window.submitWeeklyUpdate = submitWeeklyUpdate;
window.submitWeeklyFeedback = submitWeeklyFeedback;
window.submitRecordMeeting = submitRecordMeeting;
window.submitVerifyMeeting = submitVerifyMeeting;
window.showRecordMeetingModal = showRecordMeetingModal;
window.showVerifyMeetingModal = showVerifyMeetingModal;
window.showStudentProfileModal = showStudentProfileModal;

// External FYP evaluation (QR form + shared results)
window.submitEvaluationForm = submitEvaluationForm;
window.loadExternalEvaluations = loadExternalEvaluations;
window.openGroupEvaluationQr = openGroupEvaluationQr;
window.loadEvaluationLink = loadEvaluationLink;
window.copyEvaluationLink = copyEvaluationLink;
window.regenerateEvaluationLink = regenerateEvaluationLink;
window.bulkDeleteAll = bulkDeleteAll;
window.deleteSingleEvaluation = deleteSingleEvaluation;

// Initial Application Render
render();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
