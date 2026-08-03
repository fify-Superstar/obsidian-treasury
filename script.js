/**
 * Obsidian Treasury — Executive Dashboard
 * Interactive simulations & real-time widget updates
 */

(function () {
  'use strict';

  // ─── Utilities ───────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const formatCurrency = (n) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const randomBetween = (min, max) => min + Math.random() * (max - min);

  // ─── Liquidity Chart ─────────────────────────────────────
  class LiquidityChart {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.tooltip = $('#chartTooltip');
      this.container = canvas.parentElement;
      this.range = 12;
      this.hoveredIndex = -1;
      this.animationProgress = 0;
      this.data = this.generateData(12);

      this.colors = {
        mint: '#00F5A0',
        violet: '#7000FF',
        muted: '#52525B',
        grid: 'rgba(255,255,255,0.04)',
        text: '#71717A',
      };

      this.resize();
      window.addEventListener('resize', () => this.resize());
      canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
      canvas.addEventListener('mouseleave', () => this.onMouseLeave());
      this.animate();
    }

    generateData(months) {
      const months_labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date().getMonth();
      const data = [];
      let balance = 22e6;

      for (let i = 0; i < months; i++) {
        const monthIdx = (now - (4 - Math.min(i, 4)) + 12) % 12;
        const isHistorical = i < 4;
        const growth = isHistorical ? randomBetween(-0.8e6, 1.2e6) : randomBetween(-0.3e6, 0.9e6);
        balance = Math.max(15e6, balance + growth);

        data.push({
          label: months_labels[monthIdx],
          balance,
          lower: balance - randomBetween(0.8e6, 1.5e6),
          upper: balance + randomBetween(0.5e6, 1.2e6),
          historical: isHistorical,
        });
      }
      return data;
    }

    setRange(months) {
      this.range = months;
      this.data = this.generateData(months);
      this.animationProgress = 0;
    }

    resize() {
      const rect = this.container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.width = rect.width;
      this.height = rect.height;
      this.draw();
    }

    getPadding() {
      return { top: 24, right: 24, bottom: 40, left: 56 };
    }

    getChartArea() {
      const p = this.getPadding();
      return {
        x: p.left,
        y: p.top,
        w: this.width - p.left - p.right,
        h: this.height - p.top - p.bottom,
      };
    }

    getPointPositions() {
      const area = this.getChartArea();
      const minVal = Math.min(...this.data.map((d) => d.lower)) * 0.95;
      const maxVal = Math.max(...this.data.map((d) => d.upper)) * 1.02;
      const range = maxVal - minVal;

      return this.data.map((d, i) => ({
        x: area.x + (i / (this.data.length - 1)) * area.w,
        y: area.y + area.h - ((d.balance - minVal) / range) * area.h,
        yLower: area.y + area.h - ((d.lower - minVal) / range) * area.h,
        yUpper: area.y + area.h - ((d.upper - minVal) / range) * area.h,
        data: d,
        minVal,
        maxVal,
        area,
      }));
    }

    draw() {
      const { ctx, width, height } = this;
      const progress = Math.min(1, this.animationProgress);
      ctx.clearRect(0, 0, width, height);

      const points = this.getPointPositions();
      const { area, minVal, maxVal } = points[0];
      const range = maxVal - minVal;

      // Grid lines
      ctx.strokeStyle = this.colors.grid;
      ctx.lineWidth = 1;
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillStyle = this.colors.text;
      ctx.textAlign = 'right';

      for (let i = 0; i <= 4; i++) {
        const y = area.y + (i / 4) * area.h;
        const val = maxVal - (i / 4) * range;
        ctx.beginPath();
        ctx.moveTo(area.x, y);
        ctx.lineTo(area.x + area.w, y);
        ctx.stroke();
        ctx.fillText(formatCurrency(val), area.x - 10, y + 4);
      }

      // X-axis labels
      ctx.textAlign = 'center';
      points.forEach((p, i) => {
        if (i % Math.ceil(points.length / 6) === 0 || i === points.length - 1) {
          ctx.fillText(p.data.label, p.x, area.y + area.h + 24);
        }
      });

      const visibleCount = Math.ceil(points.length * progress);

      // Confidence band
      ctx.beginPath();
      for (let i = 0; i < visibleCount; i++) {
        const p = points[i];
        if (i === 0) ctx.moveTo(p.x, p.yUpper);
        else ctx.lineTo(p.x, p.yUpper);
      }
      for (let i = visibleCount - 1; i >= 0; i--) {
        ctx.lineTo(points[i].x, points[i].yLower);
      }
      ctx.closePath();
      const bandGrad = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
      bandGrad.addColorStop(0, 'rgba(112, 0, 255, 0.15)');
      bandGrad.addColorStop(1, 'rgba(112, 0, 255, 0.02)');
      ctx.fillStyle = bandGrad;
      ctx.fill();

      // Historical vs projected line
      const histEnd = points.findIndex((p) => !p.data.historical);
      const splitIdx = histEnd === -1 ? points.length : histEnd;

      // Historical (muted)
      if (splitIdx > 1) {
        ctx.beginPath();
        ctx.strokeStyle = this.colors.muted;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        for (let i = 0; i < Math.min(splitIdx, visibleCount); i++) {
          const p = points[i];
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Projected line with glow
      ctx.shadowColor = 'rgba(0, 245, 160, 0.4)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.strokeStyle = this.colors.mint;
      ctx.lineWidth = 2.5;
      const startIdx = Math.max(0, splitIdx - 1);
      for (let i = startIdx; i < visibleCount; i++) {
        const p = points[i];
        if (i === startIdx) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Area fill under projected
      ctx.beginPath();
      for (let i = startIdx; i < visibleCount; i++) {
        const p = points[i];
        if (i === startIdx) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      if (visibleCount > startIdx) {
        ctx.lineTo(points[visibleCount - 1].x, area.y + area.h);
        ctx.lineTo(points[startIdx].x, area.y + area.h);
        ctx.closePath();
        const fillGrad = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
        fillGrad.addColorStop(0, 'rgba(0, 245, 160, 0.12)');
        fillGrad.addColorStop(1, 'rgba(0, 245, 160, 0)');
        ctx.fillStyle = fillGrad;
        ctx.fill();
      }

      // Data points
      for (let i = 0; i < visibleCount; i++) {
        const p = points[i];
        const isHovered = i === this.hoveredIndex;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isHovered ? 6 : 3, 0, Math.PI * 2);
        ctx.fillStyle = p.data.historical ? this.colors.muted : this.colors.mint;
        ctx.fill();
        if (isHovered) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Hover crosshair
      if (this.hoveredIndex >= 0 && this.hoveredIndex < visibleCount) {
        const p = points[this.hoveredIndex];
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(p.x, area.y);
        ctx.lineTo(p.x, area.y + area.h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    animate() {
      if (this.animationProgress < 1) {
        this.animationProgress += 0.025;
        this.draw();
        requestAnimationFrame(() => this.animate());
      }
    }

    onMouseMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const points = this.getPointPositions();

      let closest = -1;
      let minDist = Infinity;
      points.forEach((p, i) => {
        const dist = Math.abs(p.x - x);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });

      if (minDist < 40) {
        this.hoveredIndex = closest;
        const p = points[closest];
        this.tooltip.hidden = false;
        this.tooltip.style.left = `${p.x}px`;
        this.tooltip.style.top = `${p.y}px`;
        $('.chart-tooltip__month', this.tooltip).textContent = p.data.label + ' 2026';
        $('.chart-tooltip__value', this.tooltip).textContent = formatCurrency(p.data.balance);
        $('.chart-tooltip__confidence', this.tooltip).textContent =
          `${formatCurrency(p.data.lower)} – ${formatCurrency(p.data.upper)}`;
      } else {
        this.onMouseLeave();
      }
      this.draw();
    }

    onMouseLeave() {
      this.hoveredIndex = -1;
      this.tooltip.hidden = true;
      this.draw();
    }
  }

  // ─── Sparkline ───────────────────────────────────────────
  function drawSparkline(canvas, color = '#00F5A0') {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const points = Array.from({ length: 20 }, () => randomBetween(0.3, 0.9));
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - p * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0, 245, 160, 0.15)');
    grad.addColorStop(1, 'rgba(0, 245, 160, 0)');
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // ─── AI Insights Stream ──────────────────────────────────
  const INSIGHT_TEMPLATES = [
    { type: 'save', icon: '💰', text: 'AI agent renegotiated <strong>SaaS bill</strong>: Saved <strong>$420/mo</strong>', tag: 'auto' },
    { type: 'save', icon: '💰', text: 'Duplicate subscription detected & cancelled: <strong>$1,840/yr</strong> recovered', tag: 'auto' },
    { type: 'action', icon: '⚡', text: 'Auto-approved vendor payment to <strong>Acme Corp</strong> within policy limits', tag: 'auto' },
    { type: 'alert', icon: '⚠️', text: 'Marketing spend approaching <strong>85%</strong> of Q3 budget cap', tag: 'review' },
    { type: 'optimize', icon: '📊', text: 'FX hedging opportunity identified: potential <strong>$12K</strong> savings', tag: 'review' },
    { type: 'save', icon: '💰', text: 'Bulk license consolidation for <strong>Slack + Zoom</strong>: Saved <strong>$2,100/mo</strong>', tag: 'auto' },
    { type: 'action', icon: '⚡', text: 'Triggered early payment discount on <strong>AWS invoice</strong>: 2% saved', tag: 'auto' },
    { type: 'alert', icon: '⚠️', text: 'Unusual expense pattern flagged in <strong>Engineering</strong> dept', tag: 'review' },
    { type: 'optimize', icon: '📊', text: 'Cash sweep executed: <strong>$3.2M</strong> moved to high-yield account', tag: 'auto' },
    { type: 'save', icon: '💰', text: 'Travel policy violation blocked: <strong>$890</strong> non-compliant booking', tag: 'auto' },
    { type: 'action', icon: '⚡', text: 'Invoice matched & scheduled: <strong>Datadog</strong> $47,200 due Aug 1', tag: 'auto' },
    { type: 'optimize', icon: '📊', text: 'Runway extended by <strong>0.4 months</strong> via burn optimization', tag: 'auto' },
  ];

  class InsightsStream {
    constructor(container) {
      this.container = container;
      this.countEl = $('#insightCount');
      this.count = 0;
      this.maxItems = 20;
      this.templateIndex = 0;

      // Seed initial items
      for (let i = 0; i < 5; i++) {
        this.addInsight(false);
      }

      // Stream new insights periodically
      setInterval(() => this.addInsight(true), randomBetween(4000, 8000));
    }

    addInsight(animate = true) {
      const template = INSIGHT_TEMPLATES[this.templateIndex % INSIGHT_TEMPLATES.length];
      this.templateIndex++;

      const elapsed = Math.floor(randomBetween(1, 59));
      const timeStr = elapsed < 1 ? 'Just now' : `${elapsed}s ago`;

      const item = document.createElement('article');
      item.className = 'insight-item';
      if (!animate) item.style.animation = 'none';

      item.innerHTML = `
        <div class="insight-item__icon insight-item__icon--${template.type}">${template.icon}</div>
        <div class="insight-item__content">
          <p class="insight-item__text">${template.text}</p>
          <div class="insight-item__meta">
            <span class="insight-item__time">${timeStr}</span>
            <span class="insight-item__tag insight-item__tag--${template.tag}">${template.tag === 'auto' ? 'Autonomous' : 'Review'}</span>
          </div>
        </div>
      `;

      this.container.insertBefore(item, this.container.firstChild);
      this.count++;
      this.countEl.textContent = `${this.count} events`;

      while (this.container.children.length > this.maxItems) {
        this.container.removeChild(this.container.lastChild);
      }
    }
  }

  // ─── Spend Guardrails ────────────────────────────────────
  const GUARDRAIL_POLICIES = [
    { name: 'SaaS & Software', limit: '$50K/mo', spent: 38400, cap: 50000, compliance: 97.2, status: 'active' },
    { name: 'Travel & Expenses', limit: '$25K/mo', spent: 21200, cap: 25000, compliance: 84.8, status: 'warning' },
    { name: 'Marketing Spend', limit: '$120K/qtr', spent: 98400, cap: 120000, compliance: 82.0, status: 'warning' },
    { name: 'Contractor Payments', limit: '$80K/mo', spent: 45200, cap: 80000, compliance: 99.1, status: 'active' },
    { name: 'Cloud Infrastructure', limit: '$200K/mo', spent: 178400, cap: 200000, compliance: 89.2, status: 'active' },
    { name: 'Office & Facilities', limit: '$15K/mo', spent: 12800, cap: 15000, compliance: 100, status: 'active' },
  ];

  class GuardrailsPanel {
    constructor(container) {
      this.container = container;
      this.render();

      // Simulate meter updates
      setInterval(() => this.updateMeters(), 5000);
    }

    render() {
      this.container.innerHTML = GUARDRAIL_POLICIES.map((p) => this.createCard(p)).join('');
    }

    createCard(policy) {
      const pct = (policy.spent / policy.cap) * 100;
      const meterClass = pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'safe';

      return `
        <article class="guardrail-card" data-policy="${policy.name}">
          <div class="guardrail-card__header">
            <span class="guardrail-card__name">${policy.name}</span>
            <span class="guardrail-card__status guardrail-card__status--${policy.status}"></span>
          </div>
          <div class="guardrail-card__limit">Limit: <span>${policy.limit}</span></div>
          <div class="guardrail-meter">
            <div class="guardrail-meter__label">
              <span>Utilization</span>
              <span class="guardrail-meter__value">${pct.toFixed(1)}%</span>
            </div>
            <div class="guardrail-meter__track">
              <div class="guardrail-meter__fill guardrail-meter__fill--${meterClass}" style="width: 0%" data-target="${pct}"></div>
            </div>
          </div>
          <div class="guardrail-card__footer">
            <div>
              <div class="guardrail-card__compliance">${policy.compliance}%</div>
              <div class="guardrail-card__compliance-label">Compliance</div>
            </div>
          </div>
        </article>
      `;
    }

    animateMeters() {
      $$('.guardrail-meter__fill', this.container).forEach((fill) => {
        const target = fill.dataset.target;
        requestAnimationFrame(() => {
          fill.style.width = `${target}%`;
        });
      });
    }

    updateMeters() {
      $$('.guardrail-card', this.container).forEach((card, i) => {
        const policy = GUARDRAIL_POLICIES[i];
        const delta = randomBetween(-800, 1200);
        policy.spent = Math.max(0, Math.min(policy.cap * 0.98, policy.spent + delta));
        policy.compliance = Math.min(100, Math.max(75, policy.compliance + randomBetween(-0.5, 0.3)));

        const pct = (policy.spent / policy.cap) * 100;
        const meterClass = pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'safe';
        const fill = $('.guardrail-meter__fill', card);
        const valueEl = $('.guardrail-meter__value', card);
        const complianceEl = $('.guardrail-card__compliance', card);

        fill.style.width = `${pct}%`;
        fill.className = `guardrail-meter__fill guardrail-meter__fill--${meterClass}`;
        fill.dataset.target = pct;
        valueEl.textContent = `${pct.toFixed(1)}%`;
        complianceEl.textContent = `${policy.compliance.toFixed(1)}%`;

        const status = $('.guardrail-card__status', card);
        status.className = `guardrail-card__status guardrail-card__status--${pct >= 90 ? 'warning' : 'active'}`;
      });
    }
  }

  // ─── Live Metric Updates ─────────────────────────────────
  class MetricSimulator {
    constructor() {
      this.cash = 24.8e6;
      this.savings = 847e3;
      this.actions = 142;
      this.compliance = 96.8;

      setInterval(() => this.tick(), 3000);
    }

    tick() {
      this.cash += randomBetween(-50000, 80000);
      this.savings += randomBetween(200, 800);
      if (Math.random() > 0.7) this.actions++;

      $('#metricCash').textContent = formatCurrency(this.cash);
      $('#metricSavings').textContent = formatCurrency(this.savings);
      $('#metricActions').textContent = this.actions;

      this.compliance = Math.min(99.9, Math.max(94, this.compliance + randomBetween(-0.2, 0.15)));
      $('#metricCompliance').textContent = `${this.compliance.toFixed(1)}%`;
      $('#complianceBar').style.width = `${this.compliance}%`;
    }
  }

  // ─── Mobile Navigation ───────────────────────────────────
  function closeMobileSidebar() {
    $('.sidebar')?.classList.remove('sidebar--open');
    $('#sidebarOverlay')?.classList.remove('sidebar-overlay--visible');
  }

  function initMobileNav() {
    const sidebar = $('.sidebar');
    const overlay = $('#sidebarOverlay');
    const toggle = $('#menuToggle');

    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar--open');
      overlay.classList.toggle('sidebar-overlay--visible');
    });

    overlay.addEventListener('click', closeMobileSidebar);
  }

  // ─── View Router (hash-based SPA navigation) ──────────────
  const VIEW_META = {
    'command-center': {
      title: 'Executive Command Center',
      subtitle: 'Real-time financial intelligence · Q3 FY2026',
      showActions: true,
    },
    analytics: {
      title: 'Analytics',
      subtitle: 'Cohort trends, variance & board reporting',
      showActions: false,
    },
    teams: {
      title: 'Teams',
      subtitle: 'Access control & department ownership',
      showActions: false,
    },
    settings: {
      title: 'Settings',
      subtitle: 'Workspace, billing & integrations',
      showActions: false,
    },
  };

  function getViewFromHash() {
    const hash = (window.location.hash || '').replace(/^#/, '');
    return VIEW_META[hash] ? hash : 'command-center';
  }

  function setActiveView(viewId, { syncHash = true, chart } = {}) {
    if (!VIEW_META[viewId]) viewId = 'command-center';
    const meta = VIEW_META[viewId];

    $$('[data-view-panel]').forEach((panel) => {
      const active = panel.dataset.viewPanel === viewId;
      panel.hidden = !active;
      panel.classList.toggle('view-panel--active', active);
    });

    $$('.nav-item[data-view]').forEach((link) => {
      const active = link.dataset.view === viewId;
      link.classList.toggle('nav-item--active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    const title = $('#headerTitle');
    const subtitle = $('#headerSubtitle');
    const actions = $('#headerActions');
    if (title) title.textContent = meta.title;
    if (subtitle) subtitle.textContent = meta.subtitle;
    if (actions) actions.hidden = !meta.showActions;

    if (syncHash) {
      const nextHash = `#${viewId}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
      }
    }

    if (viewId === 'command-center' && chart) {
      requestAnimationFrame(() => {
        chart.resize();
        chart.animationProgress = 0;
        chart.animate();
      });
    }

    closeMobileSidebar();
  }

  function initViewRouter(chart) {
    $$('.nav-item[data-view]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = link.dataset.view;
        setActiveView(viewId, { chart });
      });
    });

    window.addEventListener('hashchange', () => {
      setActiveView(getViewFromHash(), { syncHash: false, chart });
    });

    setActiveView(getViewFromHash(), { syncHash: true, chart });
  }

  // ─── Chart Range Controls ────────────────────────────────
  function initChartControls(chart) {
    $$('.segmented__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.segmented__btn').forEach((b) => b.classList.remove('segmented__btn--active'));
        btn.classList.add('segmented__btn--active');
        chart.setRange(parseInt(btn.dataset.range, 10));
        chart.animationProgress = 0;
        chart.animate();
      });
    });
  }

  // ─── Init ────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const chart = new LiquidityChart($('#liquidityChart'));
    initChartControls(chart);

    drawSparkline($('#sparkCash'));
    new InsightsStream($('#insightsStream'));

    const guardrails = new GuardrailsPanel($('#guardrailsGrid'));
    guardrails.animateMeters();

    new MetricSimulator();
    initMobileNav();
    initViewRouter(chart);

    $('#exportBtn').addEventListener('click', () => {
      alert('Export queued — report will be delivered to your inbox.');
    });

    $('#addPolicyBtn').addEventListener('click', () => {
      alert('Policy builder coming soon.');
    });

    const waitlistForm = $('#foundersWaitlist');
    if (waitlistForm) {
      waitlistForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const input = $('#foundersEmail');
        const submitBtn = waitlistForm.querySelector('.founders-cta__submit');
        if (!input?.value || !submitBtn || submitBtn.disabled) return;

        const FORMSPREE_ENDPOINT = 'https://formspree.io/f/maqrbkrz';
        const originalLabel = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Joining…';

        try {
          const response = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            body: new FormData(waitlistForm),
            headers: { Accept: 'application/json' },
          });

          if (!response.ok) {
            throw new Error(`Formspree error (${response.status})`);
          }

          input.value = '';
          submitBtn.textContent = 'Joined!';
          openFounderModal();

          setTimeout(() => {
            submitBtn.textContent = originalLabel;
            submitBtn.disabled = false;
          }, 2000);
        } catch (err) {
          console.error('Waitlist submission failed:', err);
          submitBtn.textContent = 'Try again';
          submitBtn.disabled = false;
          setTimeout(() => {
            submitBtn.textContent = originalLabel;
          }, 2500);
        }
      });
    }

    initFounderModal();
  });

  // ─── Founder's Circle Success Modal ───────────────────────
  function initFounderModal() {
    const modal = $('#founderModal');
    if (!modal) return;

    const close = () => closeFounderModal();
    $('#founderModalClose')?.addEventListener('click', close);
    $('#founderModalDismiss')?.addEventListener('click', close);
    $('#founderModalBackdrop')?.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('founder-modal--visible')) {
        closeFounderModal();
      }
    });

    // Show after Stripe redirect: set Success URL to https://obsidian-treasury.netlify.app/?checkout=success
    if (new URLSearchParams(window.location.search).get('checkout') === 'success') {
      openFounderModal();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  function openFounderModal() {
    const modal = $('#founderModal');
    if (!modal) return;

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.classList.add('founder-modal--visible'));
  }

  function closeFounderModal() {
    const modal = $('#founderModal');
    if (!modal) return;

    modal.classList.remove('founder-modal--visible');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { modal.hidden = true; }, 350);
  }
})();
