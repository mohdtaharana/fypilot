// Synapse — AI Intelligence Layer for FYP Management
// Frontend Application

const API_BASE = '/api';

// ===== State Management =====
const state = {
  currentView: 'dashboard',
  currentUser: { id: 'coord-1', name: 'Dr. Admin', role: 'coordinator' },
  proposals: [],
  projects: [],
  users: [],
  dashboardStats: null,
  selectedProposal: null,
  selectedProject: null,
  aiLoading: {},
  aiResults: {},
};

// ===== API Client =====
async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': state.currentUser.id,
    'X-User-Role': state.currentUser.role,
    ...options.headers,
  };
  
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const colors = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500' };
  const toast = document.createElement('div');
  toast.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg mb-2 fade-in text-sm max-w-sm`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ===== Navigation =====
function navigate(view, data = null) {
  state.currentView = view;
  if (data) {
    if (view === 'proposal-detail') state.selectedProposal = data;
    if (view === 'project-detail') state.selectedProject = data;
  }
  render();
}

// ===== Main Render =====
function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderNav()}
    <main class="max-w-7xl mx-auto px-4 py-6">
      ${renderCurrentView()}
    </main>
  `;
  attachEventListeners();
}

function renderNav() {
  const links = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
    { id: 'proposals', label: 'Proposals', icon: 'fa-file-alt' },
    { id: 'projects', label: 'Projects', icon: 'fa-project-diagram' },
    { id: 'supervisors', label: 'Supervisors', icon: 'fa-user-tie' },
  ];
  
  return `
  <nav class="bg-white border-b border-gray-200 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-synapse-600 rounded-lg flex items-center justify-center">
            <i class="fas fa-brain text-white text-sm"></i>
          </div>
          <span class="text-xl font-bold text-gray-900">Synapse</span>
          <span class="text-xs bg-synapse-100 text-synapse-700 px-2 py-0.5 rounded-full font-medium">AI</span>
        </div>
        <div class="flex items-center gap-1">
          ${links.map(l => `
            <button onclick="navigate('${l.id}')" class="px-3 py-2 rounded-lg text-sm font-medium transition-colors ${state.currentView === l.id || state.currentView.startsWith(l.id) ? 'bg-synapse-50 text-synapse-700' : 'text-gray-600 hover:bg-gray-100'}">
              <i class="fas ${l.icon} mr-1.5"></i>${l.label}
            </button>
          `).join('')}
        </div>
        <div class="flex items-center gap-3">
          <select id="role-switcher" class="text-xs border rounded-md px-2 py-1 bg-white" onchange="switchRole(this.value)">
            <option value="coordinator" ${state.currentUser.role === 'coordinator' ? 'selected' : ''}>Coordinator</option>
            <option value="supervisor" ${state.currentUser.role === 'supervisor' ? 'selected' : ''}>Supervisor</option>
            <option value="student" ${state.currentUser.role === 'student' ? 'selected' : ''}>Student</option>
          </select>
          <div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <i class="fas fa-user text-gray-500 text-sm"></i>
          </div>
        </div>
      </div>
    </div>
  </nav>`;
}

function switchRole(role) {
  const users = {
    coordinator: { id: 'coord-1', name: 'Dr. Admin', role: 'coordinator' },
    supervisor: { id: 'sup-1', name: 'Dr. Ahmed Khan', role: 'supervisor' },
    student: { id: 'stu-1', name: 'Ali Hassan', role: 'student' },
  };
  state.currentUser = users[role];
  showToast(`Switched to ${role} view`, 'info');
  render();
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

// ===== Dashboard =====
function renderDashboard() {
  return `
  <div class="fade-in">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-gray-500 text-sm mt-1">Overview of FYP management system</p>
      </div>
    </div>
    <div id="dashboard-stats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      ${renderStatsSkeleton()}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl border p-6">
        <h3 class="font-semibold text-gray-900 mb-4"><i class="fas fa-file-alt mr-2 text-synapse-500"></i>Recent Proposals</h3>
        <div id="recent-proposals" class="space-y-3">Loading...</div>
      </div>
      <div class="bg-white rounded-xl border p-6">
        <h3 class="font-semibold text-gray-900 mb-4"><i class="fas fa-heartbeat mr-2 text-synapse-500"></i>Project Health</h3>
        <div id="project-health" class="space-y-3">Loading...</div>
      </div>
    </div>
  </div>`;
}

function renderStatsSkeleton() {
  return Array(4).fill(0).map(() => `
    <div class="bg-white rounded-xl border p-5">
      <div class="skeleton h-4 w-24 rounded mb-2"></div>
      <div class="skeleton h-8 w-16 rounded"></div>
    </div>
  `).join('');
}

// ===== Proposals List =====
function renderProposals() {
  return `
  <div class="fade-in">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Proposals</h1>
        <p class="text-gray-500 text-sm mt-1">Manage FYP proposal submissions</p>
      </div>
      <button onclick="showNewProposalForm()" class="bg-synapse-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-synapse-700 transition-colors">
        <i class="fas fa-plus mr-1.5"></i>New Proposal
      </button>
    </div>
    <div id="proposals-list" class="space-y-3">Loading...</div>
  </div>`;
}

// ===== Proposal Detail =====
function renderProposalDetail() {
  const p = state.selectedProposal;
  if (!p) return '<p>No proposal selected</p>';
  
  const statusColors = { draft: 'bg-gray-100 text-gray-700', submitted: 'bg-blue-100 text-blue-700', under_review: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', revision_requested: 'bg-orange-100 text-orange-700' };
  
  return `
  <div class="fade-in">
    <button onclick="navigate('proposals')" class="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1">
      <i class="fas fa-arrow-left"></i> Back to Proposals
    </button>
    
    <div class="bg-white rounded-xl border p-6 mb-6">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">${p.title}</h1>
          <p class="text-sm text-gray-500 mt-1">Submitted by ${p.submitter_name || 'Unknown'}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-medium ${statusColors[p.status] || 'bg-gray-100'}">${p.status.replace('_', ' ')}</span>
      </div>
      ${p.abstract ? `<div class="mt-4"><h4 class="text-sm font-medium text-gray-700">Abstract</h4><p class="text-sm text-gray-600 mt-1">${p.abstract}</p></div>` : ''}
      ${p.problem_statement ? `<div class="mt-3"><h4 class="text-sm font-medium text-gray-700">Problem Statement</h4><p class="text-sm text-gray-600 mt-1">${p.problem_statement}</p></div>` : ''}
      ${p.objectives ? `<div class="mt-3"><h4 class="text-sm font-medium text-gray-700">Objectives</h4><p class="text-sm text-gray-600 mt-1">${p.objectives}</p></div>` : ''}
      ${p.methodology ? `<div class="mt-3"><h4 class="text-sm font-medium text-gray-700">Methodology</h4><p class="text-sm text-gray-600 mt-1">${p.methodology}</p></div>` : ''}
      ${p.technologies ? `<div class="mt-3"><h4 class="text-sm font-medium text-gray-700">Technologies</h4><p class="text-sm text-gray-600 mt-1">${p.technologies}</p></div>` : ''}
    </div>

    <!-- AI Analysis Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Proposal Quality Analysis -->
      <div class="bg-white rounded-xl border p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2">
            <i class="fas fa-brain text-synapse-500"></i>
            AI Proposal Analysis
          </h3>
          <button onclick="runProposalAnalysis('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 px-3 py-1.5 rounded-lg hover:bg-synapse-100 transition-colors font-medium" id="btn-analyze">
            <i class="fas fa-play mr-1"></i>Analyze
          </button>
        </div>
        <div id="proposal-analysis-result">
          <p class="text-sm text-gray-400 italic">Click "Analyze" to run AI-assisted proposal quality analysis.</p>
        </div>
        <p class="text-xs text-gray-400 mt-3 italic">This analysis is an AI assisted recommendation and should be reviewed by the assigned supervisor.</p>
      </div>

      <!-- Similarity Analysis -->
      <div class="bg-white rounded-xl border p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2">
            <i class="fas fa-copy text-synapse-500"></i>
            Project Similarity Analysis
          </h3>
          <button onclick="runSimilarityAnalysis('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 px-3 py-1.5 rounded-lg hover:bg-synapse-100 transition-colors font-medium">
            <i class="fas fa-search mr-1"></i>Check
          </button>
        </div>
        <div id="similarity-analysis-result">
          <p class="text-sm text-gray-400 italic">Click "Check" to find potentially similar projects.</p>
        </div>
      </div>
    </div>

    ${state.currentUser.role === 'coordinator' ? `
    <!-- Supervisor Recommendation -->
    <div class="bg-white rounded-xl border p-6 mt-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-gray-900 flex items-center gap-2">
          <i class="fas fa-user-check text-synapse-500"></i>
          AI Supervisor Recommendation
        </h3>
        <button onclick="runSupervisorRecommendation('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 px-3 py-1.5 rounded-lg hover:bg-synapse-100 transition-colors font-medium">
          <i class="fas fa-magic mr-1"></i>Recommend
        </button>
      </div>
      <div id="supervisor-recommendation-result">
        <p class="text-sm text-gray-400 italic">Click "Recommend" to get AI-assisted supervisor matching.</p>
      </div>
    </div>` : ''}

    ${state.currentUser.role === 'supervisor' ? `
    <!-- Feedback Assistant -->
    <div class="bg-white rounded-xl border p-6 mt-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-gray-900 flex items-center gap-2">
          <i class="fas fa-comment-dots text-synapse-500"></i>
          AI Feedback Assistant
        </h3>
        <button onclick="runFeedbackAssistant('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 px-3 py-1.5 rounded-lg hover:bg-synapse-100 transition-colors font-medium">
          <i class="fas fa-lightbulb mr-1"></i>Suggest
        </button>
      </div>
      <div id="feedback-assistant-result">
        <p class="text-sm text-gray-400 italic">Click "Suggest" to get AI-assisted review suggestions.</p>
      </div>
      <p class="text-xs text-gray-400 mt-3 italic">Suggestions must be reviewed before sending to students.</p>
    </div>` : ''}
  </div>`;
}

// ===== Projects List =====
function renderProjects() {
  return `
  <div class="fade-in">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Projects</h1>
        <p class="text-gray-500 text-sm mt-1">Track active FYP projects</p>
      </div>
    </div>
    <div id="projects-list" class="space-y-3">Loading...</div>
  </div>`;
}

// ===== Project Detail =====
function renderProjectDetail() {
  const p = state.selectedProject;
  if (!p) return '<p>No project selected</p>';
  
  const healthColors = { healthy: 'bg-green-100 text-green-700', at_risk: 'bg-yellow-100 text-yellow-700', critical: 'bg-red-100 text-red-700' };
  const healthIcons = { healthy: 'fa-check-circle text-green-500', at_risk: 'fa-exclamation-triangle text-yellow-500', critical: 'fa-times-circle text-red-500' };
  
  return `
  <div class="fade-in">
    <button onclick="navigate('projects')" class="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1">
      <i class="fas fa-arrow-left"></i> Back to Projects
    </button>
    
    <div class="bg-white rounded-xl border p-6 mb-6">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">${p.title}</h1>
          <p class="text-sm text-gray-500 mt-1">Supervisor: ${p.supervisor_name || 'Unassigned'}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full text-xs font-medium ${healthColors[p.health] || 'bg-gray-100'}">
            <i class="fas ${healthIcons[p.health] || ''} mr-1"></i>${(p.health || 'unknown').replace('_', ' ')}
          </span>
        </div>
      </div>
      <div class="mt-4">
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-600">Progress:</span>
          <div class="flex-1 bg-gray-200 rounded-full h-2.5">
            <div class="bg-synapse-500 h-2.5 rounded-full transition-all" style="width: ${p.progress || 0}%"></div>
          </div>
          <span class="text-sm font-medium text-gray-700">${p.progress || 0}%</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Risk Analysis -->
      <div class="bg-white rounded-xl border p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2">
            <i class="fas fa-heartbeat text-synapse-500"></i>
            AI Risk Prediction
          </h3>
          <button onclick="runRiskAnalysis('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 px-3 py-1.5 rounded-lg hover:bg-synapse-100 transition-colors font-medium">
            <i class="fas fa-stethoscope mr-1"></i>Analyze
          </button>
        </div>
        <div id="risk-analysis-result">
          <p class="text-sm text-gray-400 italic">Click "Analyze" to assess project health.</p>
        </div>
      </div>

      <!-- Project Insights -->
      <div class="bg-white rounded-xl border p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2">
            <i class="fas fa-lightbulb text-synapse-500"></i>
            AI Insights
          </h3>
          <button onclick="runProjectInsights('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 px-3 py-1.5 rounded-lg hover:bg-synapse-100 transition-colors font-medium">
            <i class="fas fa-sync mr-1"></i>Generate
          </button>
        </div>
        <div id="project-insights-result">
          <p class="text-sm text-gray-400 italic">Click "Generate" for data-driven insights.</p>
        </div>
      </div>
    </div>

    <!-- Project Summary -->
    <div class="bg-white rounded-xl border p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-gray-900 flex items-center gap-2">
          <i class="fas fa-file-contract text-synapse-500"></i>
          AI Project Summary
        </h3>
        <button onclick="runProjectSummary('${p.id}')" class="text-xs bg-synapse-50 text-synapse-700 px-3 py-1.5 rounded-lg hover:bg-synapse-100 transition-colors font-medium">
          <i class="fas fa-scroll mr-1"></i>Summarize
        </button>
      </div>
      <div id="project-summary-result">
        <p class="text-sm text-gray-400 italic">Click "Summarize" for an executive project summary.</p>
      </div>
    </div>

    <!-- Project Assistant -->
    <div class="bg-white rounded-xl border p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-gray-900 flex items-center gap-2">
          <i class="fas fa-robot text-synapse-500"></i>
          Project Assistant
        </h3>
      </div>
      <div class="flex gap-2">
        <input type="text" id="project-query-input" placeholder="Ask about this project (e.g., 'Which tasks are overdue?')" class="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-synapse-500" onkeydown="if(event.key==='Enter')runProjectQuery('${p.id}')">
        <button onclick="runProjectQuery('${p.id}')" class="bg-synapse-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-synapse-700">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
      <div id="project-query-result" class="mt-3"></div>
    </div>

    <!-- Tasks & Milestones -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl border p-6">
        <h3 class="font-semibold text-gray-900 mb-4"><i class="fas fa-tasks mr-2 text-gray-400"></i>Tasks</h3>
        <div id="project-tasks">${renderProjectTasks(p)}</div>
      </div>
      <div class="bg-white rounded-xl border p-6">
        <h3 class="font-semibold text-gray-900 mb-4"><i class="fas fa-flag mr-2 text-gray-400"></i>Milestones</h3>
        <div id="project-milestones">${renderProjectMilestones(p)}</div>
      </div>
    </div>
  </div>`;
}

function renderProjectTasks(project) {
  if (!project.tasks || project.tasks.length === 0) return '<p class="text-sm text-gray-400">No tasks yet</p>';
  const statusIcons = { todo: 'far fa-circle text-gray-400', in_progress: 'fas fa-spinner text-blue-500', completed: 'fas fa-check-circle text-green-500', overdue: 'fas fa-exclamation-circle text-red-500' };
  return project.tasks.map(t => `
    <div class="flex items-center gap-3 py-2 border-b last:border-0">
      <i class="${statusIcons[t.status] || 'far fa-circle'}"></i>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-gray-800 truncate">${t.title}</p>
        ${t.assignee_name ? `<p class="text-xs text-gray-400">${t.assignee_name}</p>` : ''}
      </div>
      ${t.due_date ? `<span class="text-xs text-gray-400">${new Date(t.due_date).toLocaleDateString()}</span>` : ''}
    </div>
  `).join('');
}

function renderProjectMilestones(project) {
  if (!project.milestones || project.milestones.length === 0) return '<p class="text-sm text-gray-400">No milestones yet</p>';
  const statusColors = { pending: 'border-gray-300', in_progress: 'border-blue-400', completed: 'border-green-400', overdue: 'border-red-400' };
  return project.milestones.map(m => `
    <div class="flex items-center gap-3 py-2 border-b last:border-0">
      <div class="w-3 h-3 rounded-full border-2 ${statusColors[m.status] || 'border-gray-300'} ${m.status === 'completed' ? 'bg-green-400' : ''}"></div>
      <div class="flex-1">
        <p class="text-sm text-gray-800">${m.title}</p>
        <p class="text-xs text-gray-400">${m.status}${m.due_date ? ` — Due: ${new Date(m.due_date).toLocaleDateString()}` : ''}</p>
      </div>
    </div>
  `).join('');
}

// ===== Supervisors =====
function renderSupervisors() {
  return `
  <div class="fade-in">
    <h1 class="text-2xl font-bold text-gray-900 mb-2">Supervisors</h1>
    <p class="text-gray-500 text-sm mb-6">Faculty members available for FYP supervision</p>
    <div id="supervisors-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">Loading...</div>
  </div>`;
}

// ===== AI Feature Functions =====

async function runProposalAnalysis(proposalId) {
  const container = document.getElementById('proposal-analysis-result');
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
  const question = input.value.trim();
  if (!question) return;
  
  const container = document.getElementById('project-query-result');
  container.innerHTML = renderAILoading('Thinking...');
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

// ===== AI Result Renderers =====

function renderAILoading(message) {
  return `
  <div class="flex items-center gap-3 py-3">
    <div class="w-5 h-5 border-2 border-synapse-500 border-t-transparent rounded-full animate-spin"></div>
    <span class="text-sm text-gray-600">${message}</span>
  </div>`;
}

function renderAIError(message) {
  return `
  <div class="bg-red-50 border border-red-200 rounded-lg p-3">
    <p class="text-sm text-red-700"><i class="fas fa-exclamation-circle mr-1"></i>${message || 'AI analysis temporarily unavailable.'}</p>
    <p class="text-xs text-red-500 mt-1">Please try again later.</p>
  </div>`;
}

function renderProposalAnalysisResult(data, cached) {
  const scoreColor = data.overallScore >= 80 ? 'text-green-600' : data.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600';
  const scoreLabel = data.overallScore >= 80 ? 'Strong' : data.overallScore >= 60 ? 'Fair' : 'Needs Work';
  
  return `
  <div class="space-y-4">
    <div class="text-center py-3">
      <div class="text-3xl font-bold ${scoreColor}">${data.overallScore}%</div>
      <div class="text-sm text-gray-500">${scoreLabel}</div>
      ${cached ? '<span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Cached</span>' : ''}
    </div>
    <div class="space-y-2">
      ${renderScoreBar('Problem Clarity', data.problemClarity)}
      ${renderScoreBar('Objectives', data.objectives)}
      ${renderScoreBar('Methodology', data.methodology)}
      ${renderScoreBar('Technical Feasibility', data.technicalFeasibility)}
      ${renderScoreBar('Scope', data.scope)}
    </div>
    ${data.strengths.length ? `<div><h5 class="text-xs font-medium text-green-700 mb-1">Strengths</h5><ul class="text-xs text-gray-600 space-y-0.5">${data.strengths.map(s => `<li class="flex gap-1"><i class="fas fa-check text-green-500 mt-0.5"></i>${s}</li>`).join('')}</ul></div>` : ''}
    ${data.weaknesses.length ? `<div><h5 class="text-xs font-medium text-red-700 mb-1">Weaknesses</h5><ul class="text-xs text-gray-600 space-y-0.5">${data.weaknesses.map(w => `<li class="flex gap-1"><i class="fas fa-times text-red-500 mt-0.5"></i>${w}</li>`).join('')}</ul></div>` : ''}
    ${data.recommendations.length ? `<div><h5 class="text-xs font-medium text-blue-700 mb-1">Recommendations</h5><ul class="text-xs text-gray-600 space-y-0.5">${data.recommendations.map(r => `<li class="flex gap-1"><i class="fas fa-arrow-right text-blue-500 mt-0.5"></i>${r}</li>`).join('')}</ul></div>` : ''}
  </div>`;
}

function renderScoreBar(label, score) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return `
  <div class="flex items-center gap-2">
    <span class="text-xs text-gray-600 w-32 shrink-0">${label}</span>
    <div class="flex-1 bg-gray-200 rounded-full h-2">
      <div class="${color} h-2 rounded-full" style="width: ${score}%"></div>
    </div>
    <span class="text-xs font-medium text-gray-700 w-8">${score}%</span>
  </div>`;
}

function renderSimilarityResult(data) {
  if (!data.matches || data.matches.length === 0) {
    return `<div class="bg-green-50 border border-green-200 rounded-lg p-3"><p class="text-sm text-green-700"><i class="fas fa-check-circle mr-1"></i>No significantly similar projects found.</p></div>`;
  }
  return `
  <div class="space-y-3">
    ${data.matches.map(m => `
      <div class="border rounded-lg p-3 ${m.similarityScore >= 70 ? 'border-red-200 bg-red-50' : m.similarityScore >= 50 ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'}">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-800">${m.projectTitle}</span>
          <span class="text-xs font-bold ${m.similarityScore >= 70 ? 'text-red-600' : m.similarityScore >= 50 ? 'text-yellow-600' : 'text-gray-600'}">${m.similarityScore}%</span>
        </div>
        <div class="flex flex-wrap gap-1 mt-1.5">${m.overlappingConcepts.map(c => `<span class="text-xs bg-white border rounded px-1.5 py-0.5">${c}</span>`).join('')}</div>
        <p class="text-xs text-gray-500 mt-1.5">${m.explanation}</p>
      </div>
    `).join('')}
    <p class="text-xs text-gray-400 italic">Similarity does NOT automatically indicate plagiarism. Manual review recommended.</p>
  </div>`;
}

function renderRiskResult(data) {
  const statusConfig = { healthy: { color: 'green', icon: 'fa-check-circle', label: 'Healthy' }, at_risk: { color: 'yellow', icon: 'fa-exclamation-triangle', label: 'At Risk' }, critical: { color: 'red', icon: 'fa-times-circle', label: 'Critical' } };
  const config = statusConfig[data.healthStatus] || statusConfig.healthy;
  
  return `
  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <i class="fas ${config.icon} text-${config.color}-500 text-lg"></i>
      <div>
        <span class="font-semibold text-gray-900">${config.label}</span>
        <span class="text-sm text-gray-500 ml-2">Score: ${data.riskScore}/100</span>
      </div>
    </div>
    ${data.reasons.length ? `<div><h5 class="text-xs font-medium text-gray-700 mb-1">Reasons</h5><ul class="text-xs text-gray-600 space-y-1">${data.reasons.map(r => `<li class="flex gap-1.5"><i class="fas fa-exclamation text-${config.color}-500 mt-0.5"></i>${r}</li>`).join('')}</ul></div>` : ''}
    ${data.recommendations.length ? `<div><h5 class="text-xs font-medium text-gray-700 mb-1">Recommendations</h5><ul class="text-xs text-gray-600 space-y-1">${data.recommendations.map(r => `<li class="flex gap-1.5"><i class="fas fa-arrow-right text-blue-500 mt-0.5"></i>${r}</li>`).join('')}</ul></div>` : ''}
    ${data.summary ? `<p class="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">${data.summary}</p>` : ''}
  </div>`;
}

function renderSupervisorRecommendationResult(data) {
  return `
  <div class="space-y-3">
    ${data.recommendations.map((rec, i) => `
      <div class="border rounded-lg p-3 ${i === 0 ? 'border-synapse-200 bg-synapse-50' : ''}">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-gray-800">${i + 1}. ${rec.supervisorName}</span>
          <span class="text-xs font-bold text-synapse-600">Match: ${rec.matchScore}%</span>
        </div>
        <ul class="text-xs text-gray-600 mt-1.5 space-y-0.5">${rec.reasons.map(r => `<li><i class="fas fa-check text-synapse-400 mr-1"></i>${r}</li>`).join('')}</ul>
      </div>
    `).join('')}
    ${data.explanation ? `<p class="text-xs text-gray-500 italic">${data.explanation}</p>` : ''}
    <p class="text-xs text-gray-400 italic">Final assignment is at the coordinator's discretion.</p>
  </div>`;
}

function renderInsightsResult(data) {
  const categoryConfig = { positive: { color: 'green', icon: 'fa-check-circle' }, warning: { color: 'yellow', icon: 'fa-exclamation-triangle' }, critical: { color: 'red', icon: 'fa-times-circle' }, recommendation: { color: 'blue', icon: 'fa-lightbulb' } };
  
  return `
  <div class="space-y-2">
    ${data.insights.map(insight => {
      const cfg = categoryConfig[insight.category] || categoryConfig.recommendation;
      return `<div class="flex gap-2 items-start p-2 rounded bg-${cfg.color}-50"><i class="fas ${cfg.icon} text-${cfg.color}-500 mt-0.5 text-xs"></i><span class="text-xs text-gray-700">${insight.message}</span></div>`;
    }).join('')}
  </div>`;
}

function renderSummaryResult(data) {
  return `
  <div class="space-y-3">
    <div class="bg-gray-50 rounded-lg p-3">
      <p class="text-sm text-gray-700">${data.summary}</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${data.majorAchievements.length ? `<div><h5 class="text-xs font-medium text-green-700 mb-1">Achievements</h5><ul class="text-xs text-gray-600 space-y-0.5">${data.majorAchievements.map(a => `<li><i class="fas fa-trophy text-green-400 mr-1"></i>${a}</li>`).join('')}</ul></div>` : ''}
      ${data.majorRisks.length ? `<div><h5 class="text-xs font-medium text-red-700 mb-1">Risks</h5><ul class="text-xs text-gray-600 space-y-0.5">${data.majorRisks.map(r => `<li><i class="fas fa-exclamation text-red-400 mr-1"></i>${r}</li>`).join('')}</ul></div>` : ''}
    </div>
    ${data.nextActions.length ? `<div><h5 class="text-xs font-medium text-blue-700 mb-1">Next Actions</h5><ul class="text-xs text-gray-600 space-y-0.5">${data.nextActions.map(a => `<li><i class="fas fa-arrow-right text-blue-400 mr-1"></i>${a}</li>`).join('')}</ul></div>` : ''}
  </div>`;
}

function renderFeedbackResult(data) {
  const sections = [
    { key: 'reviewPoints', label: 'Review Points', icon: 'fa-clipboard-check' },
    { key: 'missingSections', label: 'Missing Sections', icon: 'fa-file-medical' },
    { key: 'technicalConcerns', label: 'Technical Concerns', icon: 'fa-cog' },
    { key: 'clarityImprovements', label: 'Clarity Improvements', icon: 'fa-pencil-alt' },
    { key: 'questionsForStudents', label: 'Questions for Students', icon: 'fa-question-circle' },
  ];
  
  return `
  <div class="space-y-3">
    ${sections.filter(s => data[s.key] && data[s.key].length > 0).map(s => `
      <div>
        <h5 class="text-xs font-medium text-gray-700 mb-1"><i class="fas ${s.icon} mr-1 text-gray-400"></i>${s.label}</h5>
        <ul class="text-xs text-gray-600 space-y-0.5 pl-4">${data[s.key].map(item => `<li class="list-disc">${item}</li>`).join('')}</ul>
      </div>
    `).join('')}
  </div>`;
}

function renderQueryResult(data, question) {
  const confidenceColors = { high: 'text-green-600', medium: 'text-yellow-600', low: 'text-red-600' };
  return `
  <div class="bg-gray-50 rounded-lg p-3 space-y-2">
    <p class="text-xs text-gray-400">Q: ${question}</p>
    <p class="text-sm text-gray-800">${data.answer}</p>
    <div class="flex items-center gap-2">
      <span class="text-xs ${confidenceColors[data.confidence]}">Confidence: ${data.confidence}</span>
      ${data.dataUsed.length ? `<span class="text-xs text-gray-400">| Based on: ${data.dataUsed.join(', ')}</span>` : ''}
    </div>
  </div>`;
}

// ===== Data Loading =====

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
    
    const statsContainer = document.getElementById('dashboard-stats');
    if (statsContainer && stats.data) {
      const d = stats.data;
      statsContainer.innerHTML = `
        <div class="bg-white rounded-xl border p-5"><div class="text-sm text-gray-500">Total Proposals</div><div class="text-2xl font-bold text-gray-900 mt-1">${d.proposals?.total || 0}</div><div class="text-xs text-gray-400 mt-1">${d.proposals?.submitted || 0} pending review</div></div>
        <div class="bg-white rounded-xl border p-5"><div class="text-sm text-gray-500">Active Projects</div><div class="text-2xl font-bold text-gray-900 mt-1">${d.projects?.active || 0}</div><div class="text-xs text-gray-400 mt-1">${d.projects?.at_risk || 0} at risk</div></div>
        <div class="bg-white rounded-xl border p-5"><div class="text-sm text-gray-500">Students</div><div class="text-2xl font-bold text-gray-900 mt-1">${d.users?.students || 0}</div><div class="text-xs text-gray-400 mt-1">${d.users?.supervisors || 0} supervisors</div></div>
        <div class="bg-white rounded-xl border p-5"><div class="text-sm text-gray-500">Tasks</div><div class="text-2xl font-bold text-gray-900 mt-1">${d.tasks?.total || 0}</div><div class="text-xs text-gray-400 mt-1">${d.tasks?.overdue || 0} overdue</div></div>
      `;
    }
    
    const proposalsContainer = document.getElementById('recent-proposals');
    if (proposalsContainer) {
      proposalsContainer.innerHTML = state.proposals.slice(0, 5).map(p => `
        <div class="flex items-center justify-between py-2 cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2" onclick="loadProposalDetail('${p.id}')">
          <div class="min-w-0 flex-1"><p class="text-sm text-gray-800 truncate">${p.title}</p><p class="text-xs text-gray-400">${p.submitter_name || 'Unknown'}</p></div>
          <span class="text-xs px-2 py-0.5 rounded-full ${p.status === 'approved' ? 'bg-green-100 text-green-700' : p.status === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}">${p.status}</span>
        </div>
      `).join('') || '<p class="text-sm text-gray-400">No proposals yet</p>';
    }
    
    const healthContainer = document.getElementById('project-health');
    if (healthContainer) {
      healthContainer.innerHTML = state.projects.slice(0, 5).map(p => {
        const hc = { healthy: 'text-green-500', at_risk: 'text-yellow-500', critical: 'text-red-500' };
        return `
          <div class="flex items-center justify-between py-2 cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2" onclick="loadProjectDetail('${p.id}')">
            <div class="min-w-0 flex-1"><p class="text-sm text-gray-800 truncate">${p.title}</p><p class="text-xs text-gray-400">${p.supervisor_name || 'Unassigned'}</p></div>
            <div class="flex items-center gap-2">
              <span class="text-xs ${hc[p.health] || ''}">${(p.health || '').replace('_', ' ')}</span>
              <span class="text-xs text-gray-400">${p.progress || 0}%</span>
            </div>
          </div>`;
      }).join('') || '<p class="text-sm text-gray-400">No projects yet</p>';
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
      const statusColors = { draft: 'bg-gray-100 text-gray-700', submitted: 'bg-blue-100 text-blue-700', under_review: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };
      container.innerHTML = state.proposals.map(p => `
        <div class="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow cursor-pointer" onclick="loadProposalDetail('${p.id}')">
          <div class="flex items-center justify-between">
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-medium text-gray-900 truncate">${p.title}</h3>
              <p class="text-xs text-gray-500 mt-0.5">${p.submitter_name || 'Unknown'} — ${new Date(p.created_at).toLocaleDateString()}</p>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || 'bg-gray-100'}">${p.status.replace('_', ' ')}</span>
          </div>
          ${p.abstract ? `<p class="text-xs text-gray-500 mt-2 line-clamp-2">${p.abstract.substring(0, 150)}...</p>` : ''}
        </div>
      `).join('') || '<p class="text-sm text-gray-400">No proposals found. Create one to get started.</p>';
    }
  } catch (e) {
    console.error('Failed to load proposals:', e);
  }
}

async function loadProposalDetail(id) {
  try {
    const res = await api(`/proposals/${id}`);
    state.selectedProposal = res.data;
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
      const healthColors = { healthy: 'border-l-green-500', at_risk: 'border-l-yellow-500', critical: 'border-l-red-500' };
      container.innerHTML = state.projects.map(p => `
        <div class="bg-white rounded-xl border border-l-4 ${healthColors[p.health] || ''} p-4 hover:shadow-sm transition-shadow cursor-pointer" onclick="loadProjectDetail('${p.id}')">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-medium text-gray-900">${p.title}</h3>
              <p class="text-xs text-gray-500 mt-0.5">Supervisor: ${p.supervisor_name || 'Unassigned'}</p>
            </div>
            <div class="text-right">
              <span class="text-sm font-medium text-gray-700">${p.progress || 0}%</span>
              <p class="text-xs text-gray-400">${(p.health || '').replace('_', ' ')}</p>
            </div>
          </div>
          <div class="mt-2 bg-gray-200 rounded-full h-1.5">
            <div class="bg-synapse-500 h-1.5 rounded-full" style="width: ${p.progress || 0}%"></div>
          </div>
        </div>
      `).join('') || '<p class="text-sm text-gray-400">No projects found.</p>';
    }
  } catch (e) {
    console.error('Failed to load projects:', e);
  }
}

async function loadProjectDetail(id) {
  try {
    const res = await api(`/projects/${id}`);
    state.selectedProject = res.data;
    navigate('project-detail', res.data);
  } catch (e) {
    console.error('Failed to load project:', e);
  }
}

async function loadSupervisors() {
  try {
    const res = await api('/users?role=supervisor');
    const container = document.getElementById('supervisors-list');
    if (container) {
      container.innerHTML = (res.data || []).map(s => {
        const expertise = s.expertise ? JSON.parse(s.expertise) : [];
        return `
        <div class="bg-white rounded-xl border p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-synapse-100 rounded-full flex items-center justify-center"><i class="fas fa-user-tie text-synapse-600"></i></div>
            <div><h3 class="text-sm font-medium text-gray-900">${s.name}</h3><p class="text-xs text-gray-500">${s.department || 'Faculty'}</p></div>
          </div>
          <div class="mt-3 flex flex-wrap gap-1">${expertise.slice(0, 4).map(e => `<span class="text-xs bg-gray-100 px-2 py-0.5 rounded">${e}</span>`).join('')}</div>
        </div>`;
      }).join('') || '<p class="text-sm text-gray-400">No supervisors found.</p>';
    }
  } catch (e) {
    console.error('Failed to load supervisors:', e);
  }
}

// ===== New Proposal Form =====
function showNewProposalForm() {
  const container = document.getElementById('proposals-list');
  container.innerHTML = `
  <div class="bg-white rounded-xl border p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Submit New Proposal</h2>
    <form id="new-proposal-form" class="space-y-4">
      <div><label class="text-sm font-medium text-gray-700">Title *</label><input name="title" required class="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Project title"></div>
      <div><label class="text-sm font-medium text-gray-700">Abstract</label><textarea name="abstract" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Brief description of the project"></textarea></div>
      <div><label class="text-sm font-medium text-gray-700">Problem Statement</label><textarea name="problem_statement" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="What problem does this project solve?"></textarea></div>
      <div><label class="text-sm font-medium text-gray-700">Objectives</label><textarea name="objectives" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Key objectives (one per line)"></textarea></div>
      <div><label class="text-sm font-medium text-gray-700">Methodology</label><textarea name="methodology" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="How will you achieve the objectives?"></textarea></div>
      <div><label class="text-sm font-medium text-gray-700">Expected Outcomes</label><textarea name="expected_outcomes" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="What will the project deliver?"></textarea></div>
      <div><label class="text-sm font-medium text-gray-700">Technologies</label><input name="technologies" class="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g., React, Python, TensorFlow"></div>
      <div><label class="text-sm font-medium text-gray-700">Scope</label><textarea name="scope" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Project scope and boundaries"></textarea></div>
      <div class="flex gap-3">
        <button type="submit" class="bg-synapse-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-synapse-700">Submit Proposal</button>
        <button type="button" onclick="navigate('proposals')" class="border px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
      </div>
    </form>
  </div>`;
  
  document.getElementById('new-proposal-form').addEventListener('submit', async (e) => {
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
      // Error handled by api function
    }
  });
}

// ===== Event Listeners & Init =====
function attachEventListeners() {
  // Load data based on current view
  if (state.currentView === 'dashboard') loadDashboard();
  if (state.currentView === 'proposals') loadProposals();
  if (state.currentView === 'projects') loadProjects();
  if (state.currentView === 'supervisors') loadSupervisors();
}

// Make functions globally accessible
window.navigate = navigate;
window.switchRole = switchRole;
window.loadProposalDetail = loadProposalDetail;
window.loadProjectDetail = loadProjectDetail;
window.showNewProposalForm = showNewProposalForm;
window.runProposalAnalysis = runProposalAnalysis;
window.runSimilarityAnalysis = runSimilarityAnalysis;
window.runRiskAnalysis = runRiskAnalysis;
window.runSupervisorRecommendation = runSupervisorRecommendation;
window.runProjectInsights = runProjectInsights;
window.runProjectSummary = runProjectSummary;
window.runFeedbackAssistant = runFeedbackAssistant;
window.runProjectQuery = runProjectQuery;

// Initialize
render();
