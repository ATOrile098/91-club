/**
 * 97 NULL - Main Application Logic & API Integration
 */

const app = {
  currentTab: 'phone', // 'phone' or 'email'
  activeAuthAction: null, // 'login' or 'register'
  otpTimer: null,
  otpCountdown: 0,
  currentUser: null,

  init() {
    this.checkSession();
    this.initWinningFeed();
  },

  // Switch between views: 'login-view', 'register-view', 'dashboard-view'
  switchView(viewId) {
    document.querySelectorAll('.view-screen').forEach(screen => {
      screen.classList.remove('active');
    });
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
    }
  },

  showDashboard() {
    this.switchView('dashboard-view');
  },

  // Switch between Phone and Email login tabs
  setLoginTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.auth-tabs .auth-tab').forEach(el => el.classList.remove('active'));
    
    const activeBtn = document.querySelector(`.auth-tab[data-type="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const phoneGroup = document.getElementById('login-phone-group');
    const emailGroup = document.getElementById('login-email-group');

    if (tab === 'phone') {
      phoneGroup.classList.remove('hidden');
      emailGroup.classList.add('hidden');
    } else {
      phoneGroup.classList.add('hidden');
      emailGroup.classList.remove('hidden');
    }
  },

  // Toggle Password Visibility
  togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fa-regular fa-eye';
    } else {
      input.type = 'password';
      icon.className = 'fa-regular fa-eye-slash';
    }
  },

  // Send OTP with 60-second countdown
  sendOtp() {
    const phone = document.getElementById('reg-phone-input').value.trim();
    if (!phone || phone.length < 10) {
      this.showToast('Please enter a valid 10-digit phone number first.', 'error');
      return;
    }

    const btn = document.getElementById('btn-send-otp');
    btn.disabled = true;
    this.otpCountdown = 60;
    btn.innerText = `${this.otpCountdown}s`;

    // Simulated generated OTP
    const mockOtp = Math.floor(100000 + Math.random() * 900000);
    this.showToast(`Verification code sent! (Demo OTP: ${mockOtp})`, 'info');
    document.getElementById('reg-otp-input').value = mockOtp;

    clearInterval(this.otpTimer);
    this.otpTimer = setInterval(() => {
      this.otpCountdown--;
      if (this.otpCountdown <= 0) {
        clearInterval(this.otpTimer);
        btn.disabled = false;
        btn.innerText = 'Send';
      } else {
        btn.innerText = `${this.otpCountdown}s`;
      }
    }, 1000);
  },

  // Trigger CAPTCHA before submitting form
  triggerCaptcha(action) {
    if (action === 'login') {
      const isPhone = this.currentTab === 'phone';
      const phone = document.getElementById('login-phone-input').value.trim();
      const email = document.getElementById('login-email-input').value.trim();
      const password = document.getElementById('login-password-input').value;

      if (isPhone && (!phone || phone.length < 10)) {
        this.showToast('Please enter a valid 10-digit phone number', 'error');
        return;
      }
      if (!isPhone && (!email || !email.includes('@'))) {
        this.showToast('Please enter a valid email address', 'error');
        return;
      }
      if (!password) {
        this.showToast('Please enter your password', 'error');
        return;
      }
    } else if (action === 'register') {
      const phone = document.getElementById('reg-phone-input').value.trim();
      const otp = document.getElementById('reg-otp-input').value.trim();
      const pwd = document.getElementById('reg-password-input').value;
      const confirmPwd = document.getElementById('reg-confirm-password-input').value;
      const agree = document.getElementById('reg-agree').checked;

      if (!phone || phone.length < 10) {
        this.showToast('Please enter a 10-digit phone number', 'error');
        return;
      }
      if (!otp) {
        this.showToast('Please enter the verification code', 'error');
        return;
      }
      if (!pwd || pwd.length < 6) {
        this.showToast('Password must be at least 6 characters', 'error');
        return;
      }
      if (pwd !== confirmPwd) {
        this.showToast('Passwords do not match', 'error');
        return;
      }
      if (!agree) {
        this.showToast('Please accept the Privacy Agreement', 'error');
        return;
      }
    }

    this.activeAuthAction = action;
    window.sliderCaptcha.show(() => {
      if (this.activeAuthAction === 'login') {
        this.submitLogin();
      } else if (this.activeAuthAction === 'register') {
        this.submitRegister();
      }
    });
  },

  // Submit Login to Backend API
  async submitLogin() {
    const isPhone = this.currentTab === 'phone';
    const payload = {
      accountType: this.currentTab,
      countryCode: document.getElementById('login-country-code').value,
      phone: document.getElementById('login-phone-input').value.trim(),
      email: document.getElementById('login-email-input').value.trim(),
      password: document.getElementById('login-password-input').value
    };

    try {
      this.showToast('Logging in...', 'info');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        localStorage.setItem('97null_token', data.token);
        localStorage.setItem('97null_user', JSON.stringify(data.user));
        this.updateDashboardUI(data.user);
        this.showToast('Welcome back to 97 NULL!', 'success');
        this.switchView('dashboard-view');
      } else {
        this.showToast(data.message || 'Login failed', 'error');
      }
    } catch (err) {
      console.error(err);
      this.showToast('Server connection error', 'error');
    }
  },

  // Submit Register to Backend API
  async submitRegister() {
    const payload = {
      accountType: 'phone',
      countryCode: document.getElementById('reg-country-code').value,
      phone: document.getElementById('reg-phone-input').value.trim(),
      password: document.getElementById('reg-password-input').value,
      inviteCode: document.getElementById('reg-invite-input').value.trim()
    };

    try {
      this.showToast('Creating account...', 'info');
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        localStorage.setItem('97null_token', data.token);
        localStorage.setItem('97null_user', JSON.stringify(data.user));

        // Sync user to Firebase
        if (typeof window.syncUserToFirebase === 'function') {
          window.syncUserToFirebase(data.user);
        }

        this.updateDashboardUI(data.user);
        this.showToast(data.message, 'success');
        this.switchView('dashboard-view');
      } else {
        this.showToast(data.message || 'Registration failed', 'error');
      }
    } catch (err) {
      console.error(err);
      this.showToast('Server connection error', 'error');
    }
  },

  // Update UI Elements with current user
  updateDashboardUI(user) {
    if (!user) return;
    const uidEl = document.getElementById('dash-user-uid');
    const balanceEl = document.getElementById('dash-wallet-amount');
    
    if (uidEl) uidEl.innerText = `UID: ${user.id || '9700842'}`;
    if (balanceEl) balanceEl.innerText = Number(user.balance || 1072.00).toFixed(2);
  },

  refreshBalance() {
    const balanceEl = document.getElementById('dash-wallet-amount');
    const cur = parseFloat(balanceEl.innerText) || 100.00;
    const newBal = (cur + (Math.random() * 5)).toFixed(2);
    balanceEl.innerText = newBal;
    this.showToast('Balance updated successfully', 'success');
  },

  // Check persisted session
  checkSession() {
    const storedUser = localStorage.getItem('97null_user');
    if (storedUser) {
      try {
        this.currentUser = JSON.parse(storedUser);
        this.updateDashboardUI(this.currentUser);
      } catch (e) {}
    }
  },

  logout() {
    localStorage.removeItem('97null_token');
    localStorage.removeItem('97null_user');
    this.currentUser = null;
    this.showToast('Logged out successfully', 'info');
    this.switchView('login-view');
  },

  // Winning Stars Live Stream Simulation
  initWinningFeed() {
    const container = document.getElementById('winning-stars-feed');
    if (!container) return;

    const mockGames = ['Win Go 1Min', 'TRX WinGo', '5D Lottery', 'Slots Mega', 'Roulette'];
    const mockUsers = ['Mem***781', 'Mem***204', 'Mem***912', 'Mem***451', 'Mem***630', 'Mem***189'];

    const renderList = () => {
      container.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const u = mockUsers[Math.floor(Math.random() * mockUsers.length)];
        const g = mockGames[Math.floor(Math.random() * mockGames.length)];
        const prize = (100 + Math.random() * 8500).toFixed(2);

        const row = document.createElement('div');
        row.className = 'winner-row';
        row.innerHTML = `
          <div class="winner-user">
            <div class="winner-avatar-icon"><i class="fa-solid fa-trophy"></i></div>
            <span>${u}</span>
          </div>
          <span class="winner-game">${g}</span>
          <span class="winner-prize">+₹${prize}</span>
        `;
        container.appendChild(row);
      }
    };

    renderList();
    // Rotate winners every 4 seconds
    setInterval(renderList, 4000);
  },

  // Toast Notification Message
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

window.app = app;
