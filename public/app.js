/**
 * AVIRA CareCircle — Client Application Controller
 * PromptWars × Catalyst 2026: Elderly Care & Medication Platform
 * Clean Vanilla JavaScript (Zero External Dependencies)
 */

'use strict';

// Application State
let authToken = '';
let currentUser = null;
let currentRole = 'elder';
let appState = null;

// Utility Selectors
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

// Escape HTML utility to prevent XSS
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Accessible Toast Notification
let toastTimer = null;
function showToast(message, isError = false) {
  const toast = $('#toastNotification');
  if (!toast) return;
  toast.textContent = message;
  toast.style.background = isError ? '#991b1b' : '#1e293b';
  toast.style.display = 'block';

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 3200);
}

// Unified API Client
async function fetchApi(endpoint, method = 'GET', data = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken;
  }

  const response = await fetch('/api/' + endpoint, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || `Request failed with status ${response.status}`);
  }
  return json;
}

// Live UTC Digital Clock
function updateUtcClock() {
  const clockEl = $('#liveUtcClock');
  if (!clockEl) return;
  const now = new Date();
  const timeStr = now.toISOString().slice(11, 19);
  clockEl.textContent = timeStr;
}
setInterval(updateUtcClock, 1000);
updateUtcClock();

// Accessibility Preferences (Senior Text & Contrast Mode)
function initAccessibilityPreferences() {
  const seniorModeActive = localStorage.getItem('avira_senior_mode') === 'true';
  const highContrastActive = localStorage.getItem('avira_high_contrast') === 'true';

  if (seniorModeActive) document.body.classList.add('senior-mode');
  if (highContrastActive) document.body.classList.add('high-contrast');

  const fontBtn = $('#toggleFontSize');
  if (fontBtn) {
    fontBtn.onclick = () => {
      const active = document.body.classList.toggle('senior-mode');
      localStorage.setItem('avira_senior_mode', active);
      showToast(active ? 'Senior Large Text mode enabled' : 'Standard text size restored');
    };
  }

  const contrastBtn = $('#toggleContrast');
  if (contrastBtn) {
    contrastBtn.onclick = () => {
      const active = document.body.classList.toggle('high-contrast');
      localStorage.setItem('avira_high_contrast', active);
      showToast(active ? 'High Contrast mode enabled' : 'Standard contrast restored');
    };
  }
}

// Role Switcher Cards in Login View
const PASSCODE_MAP = {
  elder: '2468',
  carer: '1357',
  family: '9876'
};

function initRoleSelection() {
  const roleCards = $$('.role-card');
  const passInput = $('#passcodeInput');

  roleCards.forEach(card => {
    card.onclick = () => {
      currentRole = card.dataset.user;
      roleCards.forEach(c => {
        const isSelected = c === card;
        c.classList.toggle('selected', isSelected);
        c.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      });

      if (passInput && PASSCODE_MAP[currentRole]) {
        passInput.value = PASSCODE_MAP[currentRole];
      }
      const errEl = $('#loginError');
      if (errEl) errEl.textContent = '';
    };
  });

  // Toggle Password Visibility
  const togglePassBtn = $('#togglePassVisibility');
  if (togglePassBtn && passInput) {
    togglePassBtn.onclick = () => {
      const isPassword = passInput.type === 'password';
      passInput.type = isPassword ? 'text' : 'password';
      togglePassBtn.textContent = isPassword ? '🔒' : '👁';
      passInput.focus();
    };
  }

  // Handle Login Form Submission
  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.onsubmit = async event => {
      event.preventDefault();
      const errEl = $('#loginError');
      if (errEl) errEl.textContent = '';

      const passcode = passInput.value.trim();
      if (!passcode) {
        if (errEl) errEl.textContent = 'Please enter a demo passcode';
        return;
      }

      try {
        const result = await fetchApi('login', 'POST', {
          user: currentRole,
          passcode
        });

        authToken = result.token;
        currentUser = result.user;

        // Transition views
        $('#loginView').hidden = true;
        $('#appView').hidden = false;
        $('#logoutBtn').hidden = false;

        showToast(`Welcome back, ${currentUser.name}!`);
        await refreshDashboardState();
      } catch (err) {
        if (errEl) errEl.textContent = err.message || 'Authentication failed';
      }
    };
  }

  // Handle Logout
  const logoutBtn = $('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      authToken = '';
      currentUser = null;
      appState = null;

      $('#appView').hidden = true;
      $('#loginView').hidden = false;
      $('#logoutBtn').hidden = true;
      showToast('Signed out of care circle');
    };
  }
}

// Fetch State and Refresh All Dashboard Widgets
async function refreshDashboardState() {
  try {
    appState = await fetchApi('state');
    renderDashboard();
    await renderAiSignals();
  } catch (err) {
    showToast('Failed to sync care circle state: ' + err.message, true);
  }
}

// Main Render Function
function renderDashboard() {
  if (!appState) return;
  const s = appState;
  const today = new Date().toISOString().slice(0, 10);
  const isEditable = s.user.role === 'elder' || s.user.role === 'carer';

  // 1. Header & Greetings
  $('#greetingName').textContent = s.user.name.split(' ')[0];
  $('#headerUserName').textContent = s.user.name;

  const roleBadge = $('#roleBadge');
  const roleNote = $('#rolePermissionNote');

  if (s.user.role === 'elder') {
    roleBadge.textContent = 'ELDER ACCESS';
    roleBadge.className = 'status-pill pill-elder';
    roleNote.textContent = 'Primary decision authority: manages own routine and confirms doses.';
  } else if (s.user.role === 'carer') {
    roleBadge.textContent = 'CAREGIVER ACCESS';
    roleBadge.className = 'status-pill pill-carer';
    roleNote.textContent = 'Co-manager authority: schedules routines, appointments, and assists with care.';
  } else {
    roleBadge.textContent = 'FAMILY ACCESS';
    roleBadge.className = 'status-pill pill-family';
    roleNote.textContent = 'Shared visibility for peace of mind. Viewing access only.';
  }

  // 2. Hide/Show Editing Forms based on role
  $('#addMedAccordion').hidden = !isEditable;
  $('#addAptAccordion').hidden = !isEditable;

  // 3. KPIs
  $('#kpiMedCount').textContent = s.summary.medications;
  $('#kpiMedSubtext').textContent = `${s.summary.medications} active routines`;

  const adherenceVal = s.summary.adherence;
  $('#kpiAdherenceRate').textContent = adherenceVal === null ? '—' : `${adherenceVal}%`;
  $('#kpiAdherenceSubtext').textContent = adherenceVal === null
    ? 'No events logged today'
    : `${s.summary.taken} taken, ${s.summary.missed} missed`;

  $('#kpiAptCount').textContent = s.summary.appointments;
  $('#kpiAlertCount').textContent = s.alerts.length;

  // 4. Render Medication Schedule
  const activeMeds = s.medications.filter(m => m.active);
  const medListEl = $('#medicationList');

  if (activeMeds.length === 0) {
    medListEl.innerHTML = `
      <div class="demo-disclaimer-box" role="status">
        No active medication routines scheduled. ${isEditable ? 'Use the form below to add one.' : ''}
      </div>`;
  } else {
    medListEl.innerHTML = activeMeds.map(m => {
      const todayLog = s.logs.find(l => l.medicationId === m.id && l.date === today);
      const isTaken = todayLog && todayLog.status === 'taken';
      const isMissed = todayLog && todayLog.status === 'missed';

      return `
        <article class="routine-item" role="listitem">
          <div class="routine-main">
            <strong>${escapeHtml(m.name)}</strong>
            <div class="routine-meta">
              <span class="routine-meta-item">💊 ${escapeHtml(m.dose || 'As prescribed')}</span>
              ${m.notes ? `<span class="routine-meta-item">📝 ${escapeHtml(m.notes)}</span>` : ''}
              ${todayLog ? `
                <span class="status-pill ${isTaken ? 'pill-taken' : 'pill-missed'}">
                  ${isTaken ? '✓ Taken today' : '✕ Missed today'}
                </span>
              ` : '<span class="status-pill pill-subtle">Pending confirmation</span>'}
            </div>
          </div>

          <div class="routine-actions">
            <span class="routine-time" title="Scheduled time in UTC">${escapeHtml(m.time)} <small>UTC</small></span>
            
            ${isEditable ? `
              <div class="dose-buttons">
                <button type="button" class="btn-dose-taken" data-med-id="${escapeHtml(m.id)}" data-status="taken" ${todayLog ? 'disabled aria-disabled="true"' : ''} title="Confirm dose was taken">
                  ✓ Taken
                </button>
                <button type="button" class="btn-dose-missed" data-med-id="${escapeHtml(m.id)}" data-status="missed" ${todayLog ? 'disabled aria-disabled="true"' : ''} title="Record dose was missed">
                  Missed
                </button>
                <button type="button" class="btn-item-action btn-danger-icon" data-delete-med="${escapeHtml(m.id)}" title="Remove medication from schedule">
                  ✕
                </button>
              </div>
            ` : `
              <span class="status-pill pill-subtle" title="Family accounts are view-only">Viewing Only</span>
            `}
          </div>
        </article>
      `;
    }).join('');
  }

  // 5. Render Appointments
  const aptListEl = $('#appointmentList');
  if (s.appointments.length === 0) {
    aptListEl.innerHTML = `
      <div class="demo-disclaimer-box" role="status">
        No upcoming appointments scheduled.
      </div>`;
  } else {
    aptListEl.innerHTML = s.appointments.map(a => {
      const isToday = a.date === today;
      return `
        <article class="routine-item" role="listitem">
          <div class="routine-main">
            <strong>${escapeHtml(a.title)}</strong>
            <div class="routine-meta">
              <span class="routine-meta-item">📅 ${escapeHtml(a.date)} ${isToday ? '<b>(Today)</b>' : ''}</span>
              ${a.location ? `<span class="routine-meta-item">📍 ${escapeHtml(a.location)}</span>` : ''}
              ${a.notes ? `<span class="routine-meta-item">📝 ${escapeHtml(a.notes)}</span>` : ''}
            </div>
          </div>

          <div class="routine-actions">
            <span class="routine-time">${escapeHtml(a.time)} <small>UTC</small></span>
            ${isEditable ? `
              <button type="button" class="btn-item-action btn-danger-icon" data-delete-apt="${escapeHtml(a.id)}" title="Remove this appointment">
                ✕ Remove
              </button>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  // 6. Render Care Alerts
  const alertsContainer = $('#alertsContainer');
  const alertCount = s.alerts.length;
  if (alertCount === 0) {
    alertsContainer.innerHTML = `
      <div class="demo-disclaimer-box" role="status">
        No alerts triggered yet. Reminders activate automatically within 30 minutes of a scheduled medication or appointment.
      </div>`;
  } else {
    alertsContainer.innerHTML = s.alerts.slice(0, 5).map(alert => `
      <div class="alert-item ${alert.type === 'overdue' ? 'alert-overdue' : ''}" role="listitem">
        <div>
          <strong>${escapeHtml(alert.type.toUpperCase())}: ${escapeHtml(alert.label)}</strong>
          <small>${escapeHtml(alert.date)} &bull; ${escapeHtml(alert.time)} UTC</small>
        </div>
        <span class="status-pill pill-subtle">Recorded</span>
      </div>
    `).join('');
  }

  // 7. Render Adherence Bar & History
  const taken = s.summary.taken;
  const missed = s.summary.missed;
  const total = taken + missed;
  const percent = total > 0 ? Math.round((100 * taken) / total) : 0;

  $('#adherenceBarContainer').innerHTML = `
    <div class="gauge-meta">
      <span><b>${percent}%</b> Human-Confirmed Adherence</span>
      <small>${taken} Taken &bull; ${missed} Missed &bull; ${total} Total Logged</small>
    </div>
    <div class="gauge-bar-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Adherence percentage: ${percent}%">
      <div class="gauge-bar-fill" style="width: ${percent}%;"></div>
    </div>
  `;

  const historyLedger = $('#historyLedger');
  if (s.logs.length === 0) {
    historyLedger.innerHTML = `
      <p class="panel-helper-text" style="margin-top: 10px;">
        No adherence events recorded yet. Confirming medications above will log audit entries.
      </p>`;
  } else {
    historyLedger.innerHTML = s.logs.slice(-6).reverse().map(l => `
      <div class="history-item" role="listitem">
        <div>
          <strong>${escapeHtml(l.medication)}</strong>
          <small>${escapeHtml(l.date)} &bull; Logged by ${escapeHtml(l.by)} &bull; ${new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
        </div>
        <span class="status-pill ${l.status === 'taken' ? 'pill-taken' : 'pill-missed'}">
          ${escapeHtml(l.status)}
        </span>
      </div>
    `).join('');
  }

  // Update Mini Spatial mesh status badge
  const meshMedBadge = $('#meshMedBadge');
  if (meshMedBadge) {
    meshMedBadge.textContent = `${activeMeds.length} Active`;
  }
}

// Render Transparent AI Signals
async function renderAiSignals() {
  const container = $('#aiSignalsContainer');
  if (!container) return;

  try {
    const aiData = await fetchApi('ai-signals');
    const signals = aiData.signals || [];

    if (signals.length === 0) {
      container.innerHTML = `
        <div class="demo-disclaimer-box" role="status">
          No active routines available for AI follow-up scoring.
        </div>`;
      return;
    }

    container.innerHTML = signals.map(sig => {
      const score = sig.riskScore;
      const isHigh = score >= 60;
      const isMed = score >= 35 && score < 60;

      let scoreColor = '#166534';
      if (isHigh) scoreColor = '#991b1b';
      else if (isMed) scoreColor = '#9a3412';

      // Non-clinical helpful caregiver recommendation
      let caregiverTip = 'Routine is consistent and on track.';
      if (isHigh) {
        caregiverTip = 'Caregiver suggestion: Consider sending a friendly reminder before the scheduled evening window.';
      } else if (isMed) {
        caregiverTip = 'Routine check: Verify medicine organizer has this routine pre-staged.';
      }

      return `
        <article class="ai-signal-card" role="region" aria-label="AI signal for ${escapeHtml(sig.name)}">
          <div class="ai-signal-header">
            <span class="ai-med-name">${escapeHtml(sig.name)}</span>
            <span class="ai-score-pill" style="color: ${scoreColor}; border-color: ${scoreColor}44;">
              Synthetic Score: <b>${score}/100</b>
            </span>
          </div>

          <div class="ai-cue-label">
            Signal: <b>${escapeHtml(sig.label)}</b>
          </div>

          <div class="ai-factors">
            <span class="ai-factor-chip">Recorded Miss Rate: ${sig.features.recordedMissRate}%</span>
            <span class="ai-factor-chip">Timing: ${sig.features.eveningTime ? 'Evening Routine (≥19:00)' : 'Daytime Routine'}</span>
            <span class="ai-factor-chip">Recent Miss: ${sig.features.recentMiss ? 'Yes' : 'No'}</span>
          </div>

          <div class="ai-tip-text">
            💡 ${escapeHtml(caregiverTip)}
          </div>
        </article>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="demo-disclaimer-box" role="alert">
        AI Signal service temporarily unavailable: ${escapeHtml(err.message)}
      </div>`;
  }
}

// Interactive Holographic Mesh Inspector
function initMeshInteractions() {
  const infoBox = $('#meshInfoBox');
  if (!infoBox) return;

  const nodeCarer = $('#nodeCarer');
  if (nodeCarer) {
    nodeCarer.onclick = () => {
      infoBox.innerHTML = `
        <strong>Meera Rao (Caregiver):</strong> Synchronized co-manager. 
        Permitted to add/modify medication routines, log dose confirmations, and receive automated notifications.
      `;
      showToast('Inspecting Caregiver Node: Meera');
    };
  }

  const nodeFamily = $('#nodeFamily');
  if (nodeFamily) {
    nodeFamily.onclick = () => {
      infoBox.innerHTML = `
        <strong>Arjun Rao (Family Member):</strong> Shared visibility observer. 
        Provides quiet peace of mind with read-only access. Cannot mutate schedules or clinical doses.
      `;
      showToast('Inspecting Family Node: Arjun');
    };
  }

  const nodeRoutine = $('#nodeRoutine');
  if (nodeRoutine) {
    nodeRoutine.onclick = () => {
      const activeCount = appState ? appState.medications.filter(m => m.active).length : 2;
      infoBox.innerHTML = `
        <strong>Care Routines Node:</strong> ${activeCount} active medications tracked on UTC timeline. 
        Each routine requires explicit confirmation to eliminate guesswork.
      `;
      showToast('Inspecting Daily Care Routines');
    };
  }

  const meshElder = $('#meshElderNode');
  if (meshElder) {
    meshElder.onclick = () => {
      infoBox.innerHTML = `
        <strong>Anita Rao (Elder):</strong> Primary care recipient and decision center. 
        All care circle updates flow transparently to and from Anita.
      `;
      showToast('Inspecting Center Node: Anita (Elder)');
    };
  }
}

// Event Delegation for Interactive Dashboard Controls
function initDashboardActions() {
  // Dose Confirmation Buttons (Taken / Missed)
  const medList = $('#medicationList');
  if (medList) {
    medList.onclick = async event => {
      // 1. Taken / Missed Actions
      const doseBtn = event.target.closest('button[data-med-id]');
      if (doseBtn) {
        const medId = doseBtn.dataset.medId;
        const status = doseBtn.dataset.status;

        doseBtn.disabled = true;
        try {
          await fetchApi('adherence', 'POST', {
            medicationId: medId,
            status
          });
          await refreshDashboardState();
          showToast(status === 'taken' ? '✓ Dose marked as TAKEN today' : '✕ Dose marked as MISSED today');
        } catch (err) {
          doseBtn.disabled = false;
          showToast(err.message, true);
        }
        return;
      }

      // 2. Delete Medication
      const delMedBtn = event.target.closest('button[data-delete-med]');
      if (delMedBtn) {
        const medId = delMedBtn.dataset.deleteMed;
        if (!confirm('Are you sure you want to remove this medication from the schedule?')) return;

        try {
          await fetchApi('medications/' + medId, 'DELETE');
          await refreshDashboardState();
          showToast('Medication routine removed');
        } catch (err) {
          showToast(err.message, true);
        }
      }
    };
  }

  // Delete Appointment Actions
  const aptList = $('#appointmentList');
  if (aptList) {
    aptList.onclick = async event => {
      const delAptBtn = event.target.closest('button[data-delete-apt]');
      if (delAptBtn) {
        const aptId = delAptBtn.dataset.deleteApt;
        if (!confirm('Are you sure you want to remove this appointment?')) return;

        try {
          await fetchApi('appointments/' + aptId, 'DELETE');
          await refreshDashboardState();
          showToast('Appointment removed from shared calendar');
        } catch (err) {
          showToast(err.message, true);
        }
      }
    };
  }

  // Add Medication Form
  const addMedForm = $('#addMedForm');
  if (addMedForm) {
    addMedForm.onsubmit = async event => {
      event.preventDefault();
      const formData = new FormData(addMedForm);
      const payload = {
        name: formData.get('name')?.toString().trim(),
        dose: formData.get('dose')?.toString().trim(),
        time: formData.get('time')?.toString().trim(),
        notes: formData.get('notes')?.toString().trim()
      };

      try {
        await fetchApi('medications', 'POST', payload);
        addMedForm.reset();
        const accordion = $('#addMedAccordion');
        if (accordion) accordion.open = false;
        await refreshDashboardState();
        showToast('New medication scheduled successfully');
      } catch (err) {
        showToast(err.message, true);
      }
    };
  }

  // Add Appointment Form
  const addAptForm = $('#addAptForm');
  if (addAptForm) {
    addAptForm.onsubmit = async event => {
      event.preventDefault();
      const formData = new FormData(addAptForm);
      const payload = {
        title: formData.get('title')?.toString().trim(),
        date: formData.get('date')?.toString().trim(),
        time: formData.get('time')?.toString().trim(),
        location: formData.get('location')?.toString().trim(),
        notes: formData.get('notes')?.toString().trim()
      };

      try {
        await fetchApi('appointments', 'POST', payload);
        addAptForm.reset();
        const accordion = $('#addAptAccordion');
        if (accordion) accordion.open = false;
        await refreshDashboardState();
        showToast('Appointment added to shared calendar');
      } catch (err) {
        showToast(err.message, true);
      }
    };
  }

  // Check Reminders Engine
  const checkAlertsBtn = $('#checkAlertsBtn');
  if (checkAlertsBtn) {
    checkAlertsBtn.onclick = async () => {
      try {
        const result = await fetchApi('reminders', 'POST');
        await refreshDashboardState();
        const count = result.newAlerts || 0;
        showToast(count > 0 ? `Reminder engine evaluated: ${count} new alerts` : 'No new reminders are due at this time');
      } catch (err) {
        showToast(err.message, true);
      }
    };
  }

  // Refresh AI Signals
  const refreshAiBtn = $('#refreshAiBtn');
  if (refreshAiBtn) {
    refreshAiBtn.onclick = async () => {
      await renderAiSignals();
      showToast('AI follow-up signals refreshed');
    };
  }

  // Export Complete Care Audit Report (JSON)
  const exportBtn = $('#exportReportBtn');
  if (exportBtn) {
    exportBtn.onclick = async () => {
      try {
        const report = await fetchApi('report');
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AVIRA_CareCircle_Audit_Report_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Care report downloaded successfully');
      } catch (err) {
        showToast(err.message, true);
      }
    };
  }
}

// Application Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  initAccessibilityPreferences();
  initRoleSelection();
  initDashboardActions();
  initMeshInteractions();
});
