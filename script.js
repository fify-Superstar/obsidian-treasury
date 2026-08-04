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
  class InsightsStream {
    constructor(container) {
      this.container = container;
      this.countEl = $('#insightCount');
      this.count = 0;
      this.maxItems = 20;
      this.templateIndex = 0;
      this.templates = [];
      this.costCenters = [];
      this.vendors = [];

      setInterval(() => this.addInsight(true), randomBetween(4000, 8000));
    }

    setIndustry(view) {
      this.templates = (view.insights || []).slice();
      this.costCenters = (view.costs || []).slice(0, 3);
      this.vendors = (view.vendors || []).map((v) => v.vendor);
      this.container.innerHTML = '';
      this.count = 0;
      this.templateIndex = 0;
      const seed = Math.min(5, this.templates.length || 5);
      for (let i = 0; i < seed; i++) this.addInsight(false);
    }

    fillTemplate(text) {
      let out = text;
      (this.costCenters || []).forEach((name, i) => {
        out = out.replace(new RegExp(`\\{\\{cost${i}\\}\\}`, 'g'), name);
      });
      (this.vendors || []).forEach((name, i) => {
        out = out.replace(new RegExp(`\\{\\{vendor${i}\\}\\}`, 'g'), name);
      });
      return out;
    }

    addInsight(animate = true) {
      if (!this.templates.length) return;
      const template = this.templates[this.templateIndex % this.templates.length];
      this.templateIndex++;

      const elapsed = Math.floor(randomBetween(1, 59));
      const timeStr = `${elapsed}s ago`;

      const item = document.createElement('article');
      item.className = 'insight-item';
      if (!animate) item.style.animation = 'none';

      item.innerHTML = `
        <div class="insight-item__icon insight-item__icon--${template.type}">${template.icon}</div>
        <div class="insight-item__content">
          <p class="insight-item__text">${this.fillTemplate(template.text)}</p>
          <div class="insight-item__meta">
            <span class="insight-item__time">${timeStr}</span>
            <span class="insight-item__tag insight-item__tag--${template.tag}">${template.tag === 'auto' ? 'Autonomous' : 'Review'}</span>
          </div>
        </div>
      `;

      this.container.insertBefore(item, this.container.firstChild);
      this.count++;
      if (this.countEl) this.countEl.textContent = `${this.count} events`;

      while (this.container.children.length > this.maxItems) {
        this.container.removeChild(this.container.lastChild);
      }
    }
  }

  // ─── Spend Guardrails ────────────────────────────────────
  const GUARDRAIL_POLICIES = [];

  class GuardrailsPanel {
    constructor(container) {
      this.container = container;
      setInterval(() => this.updateMeters(), 5000);
    }

    setPolicies(policies) {
      GUARDRAIL_POLICIES.length = 0;
      (policies || []).forEach((p) => {
        GUARDRAIL_POLICIES.push({
          name: p.name,
          limit: p.limit,
          spent: p.spent,
          cap: p.cap,
          compliance: p.compliance,
          status: p.status,
        });
      });
      this.render();
      this.animateMeters();
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
        if (!policy) return;
        const delta = randomBetween(-800, 1200);
        policy.spent = Math.max(0, Math.min(policy.cap * 0.98, policy.spent + delta));
        policy.compliance = Math.min(100, Math.max(75, policy.compliance + randomBetween(-0.5, 0.3)));

        const pct = (policy.spent / policy.cap) * 100;
        const meterClass = pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'safe';
        const fill = $('.guardrail-meter__fill', card);
        const valueEl = $('.guardrail-meter__value', card);
        const complianceEl = $('.guardrail-card__compliance', card);
        const nameEl = $('.guardrail-card__name', card);

        if (nameEl) nameEl.textContent = policy.name;
        if (fill) {
          fill.style.width = `${pct}%`;
          fill.className = `guardrail-meter__fill guardrail-meter__fill--${meterClass}`;
          fill.dataset.target = pct;
        }
        if (valueEl) valueEl.textContent = `${pct.toFixed(1)}%`;
        if (complianceEl) complianceEl.textContent = `${policy.compliance.toFixed(1)}%`;

        const status = $('.guardrail-card__status', card);
        if (status) {
          status.className = `guardrail-card__status guardrail-card__status--${pct >= 90 ? 'warning' : 'active'}`;
        }
      });
    }
  }

  // ─── Vendor Ledger ───────────────────────────────────────
  function vendorInitials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  function renderVendorLedger(vendors) {
    const body = $('#vendorLedgerBody');
    const count = $('#vendorCount');
    if (!body) return;

    body.innerHTML = (vendors || []).map((v) => `
      <tr>
        <td>
          <div class="vendor-table__identity">
            <span class="vendor-table__logo" aria-hidden="true">${vendorInitials(v.vendor)}</span>
            <div>
              <div class="vendor-table__vendor">${v.vendor}</div>
              <div class="vendor-table__system">${v.system}</div>
            </div>
          </div>
        </td>
        <td><code class="vendor-table__input">${v.input}</code></td>
        <td>${v.costCenter}</td>
        <td class="vendor-table__spend">${v.spend}</td>
        <td><span class="vendor-status vendor-status--${v.statusTone || 'live'}">${v.status}</span></td>
      </tr>
    `).join('');

    if (count) count.textContent = `${(vendors || []).length} systems`;
  }

  function showOpsExposureAlert() {
    const alertEl = $('#opsExposureAlert');
    if (!alertEl) return;
    alertEl.hidden = false;
    requestAnimationFrame(() => alertEl.classList.add('ops-exposure-alert--visible'));
  }

  function hideOpsExposureAlert() {
    const alertEl = $('#opsExposureAlert');
    if (!alertEl) return;
    alertEl.classList.remove('ops-exposure-alert--visible');
    setTimeout(() => { alertEl.hidden = true; }, 250);
  }

  function renderOpsEngine(view) {
    const engine = view.engine || {};
    const toggle = $('#opsEngineToggle');
    const label = $('#opsEngineToggleLabel');
    const hint = $('#opsEngineToggleHint');
    const badge = $('#opsEngineBadge');
    const meterValue = $('#opsEngineMeterValue');
    const meterFill = $('#opsEngineMeterFill');
    const signals = $('#opsEngineSignals');
    const desc = $('#opsEngineDesc');

    if (label) label.textContent = engine.toggle || 'Operational Guardrail';
    if (hint) hint.textContent = engine.hint || 'Autonomous intercept while armed';
    if (badge) badge.textContent = engine.status || 'Active';
    if (desc) desc.textContent = engine.desc || 'Sector-specific capital protection controls';
    if (meterValue) meterValue.textContent = `${engine.meter ?? 90}%`;
    if (meterFill) meterFill.style.width = `${engine.meter ?? 90}%`;
    if (toggle) {
      toggle.checked = true;
      toggle.setAttribute('aria-checked', 'true');
    }
    if (signals) {
      signals.innerHTML = (engine.signals || []).map((s) => `
        <li class="ops-engine__signal">
          <span class="ops-engine__signal-dot" aria-hidden="true"></span>
          <span>${s}</span>
        </li>
      `).join('');
    }

    hideOpsExposureAlert();
    $('#opsEngine')?.classList.remove('panel--ops-engine-disarmed');
  }

  function renderSystemHealth(view) {
    const health = view.health || {};
    const setText = (id, value) => {
      const el = $(id);
      if (el) el.textContent = value;
    };
    setText('#healthVendors', health.vendors ?? (view.vendors || []).length);
    setText('#healthExclusions', health.exclusions ?? 0);
    setText('#healthRunwayDays', health.runwayDaysSaved ?? 0);

    const log = $('#healthLog');
    if (log) {
      log.innerHTML = (health.log || []).map((line) => `
        <div class="health-log__row">
          <span class="health-log__time">${line.time}</span>
          <span class="health-log__text">${line.text}</span>
        </div>
      `).join('');
    }
  }

  function initOpsEngineToggle() {
    const toggle = $('#opsEngineToggle');
    if (!toggle) return;

    toggle.addEventListener('change', () => {
      const armed = toggle.checked;
      toggle.setAttribute('aria-checked', armed ? 'true' : 'false');
      $('#opsEngine')?.classList.toggle('panel--ops-engine-disarmed', !armed);

      const badge = $('#opsEngineBadge');
      const meterFill = $('#opsEngineMeterFill');
      const meterValue = $('#opsEngineMeterValue');

      if (armed) {
        hideOpsExposureAlert();
        if (badge) badge.textContent = badge.dataset.armedStatus || badge.textContent;
        if (meterFill) meterFill.style.width = meterFill.dataset.armedWidth || meterFill.style.width;
        if (meterValue) meterValue.textContent = meterValue.dataset.armedValue || meterValue.textContent;
      } else {
        if (badge) {
          badge.dataset.armedStatus = badge.textContent;
          badge.textContent = 'Disarmed';
        }
        if (meterFill) {
          meterFill.dataset.armedWidth = meterFill.style.width;
          meterFill.style.width = '18%';
        }
        if (meterValue) {
          meterValue.dataset.armedValue = meterValue.textContent;
          meterValue.textContent = '18%';
        }
        showOpsExposureAlert();
      }
    });

    $('#opsExposureAlertClose')?.addEventListener('click', hideOpsExposureAlert);
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

  // ─── Industry View Selector ──────────────────────────────
  const INDUSTRY_VIEWS = {
    logistics: {
      hint: 'Logistics & 3PL',
      badge: 'Fleet Asset Cost Cap: Active',
      costs: ['WMS & Fleet Telematics', 'Route Optimization Tools', 'Cold-Chain Supply Tracking'],
      costEyebrows: ['Fleet systems', 'Network routing', 'Cold-chain'],
      metrics: {
        cash: 'Fleet Working Capital',
        runway: 'Carrier Runway',
        savings: 'Lane Optimization Savings',
        compliance: 'Carrier Control Tower',
        complianceLabel: 'Chain-of-Custody Compliance',
        burnLabel: 'Fleet burn',
        actionsLabel: 'dispatch actions',
        deltas: { cash: '+9.8%', runway: 'On-time', savings: 'YTD', compliance: 'Live' },
      },
      panels: {
        chartTitle: 'Predictive 12-Month Fleet Liquidity',
        chartDesc: 'Carrier payout & fuel cash flow with confidence bands',
        insightsTitle: 'Logistics Ops Insights',
        insightsDesc: 'Telematics, WMS, and cold-chain agent actions',
        guardrailsTitle: 'Logistics Spend Guardrails',
        guardrailsDesc: 'Fleet, carrier, and warehouse expense policies',
        vendorsTitle: 'Connected Logistics Vendors',
        vendorsDesc: 'Live telematics, fleet, and WMS system feeds',
      },
      engine: {
        toggle: 'Fleet Idle-Time Cost Cap',
        status: 'Active',
        hint: 'Blocks idle tractor and deadhead burn automatically',
        desc: 'Fleet telematics capital protection controls',
        meter: 91,
        signals: [
          'Idle-time interceptor scanning 428 assets',
          'Cold-chain variance under 2.1°C threshold',
          'Carrier settlement matched to lane budgets',
        ],
      },
      health: {
        vendors: 4,
        exclusions: 17,
        runwayDaysSaved: 9,
        log: [
          { time: '00:04', text: 'Teletrac Navman sync verified — 428 GPS uplinks' },
          { time: '00:12', text: 'Excluded 6 zombie ELD seats from fleet bill' },
          { time: '00:19', text: 'Manhattan WMS ASN matched · runway +0.3 days' },
        ],
      },
      vendors: [
        { vendor: 'Teletrac Navman', system: 'Fleet Telematics', input: 'GPS ping · 4G uplink', costCenter: 'WMS & Fleet Telematics', spend: '$18.4K', status: 'Synced', statusTone: 'live' },
        { vendor: 'Verizon Connect Fleet', system: 'Fleet OS', input: 'ELD / CAN-bus feed', costCenter: 'Route Optimization Tools', spend: '$24.7K', status: 'Live', statusTone: 'live' },
        { vendor: 'Manhattan Associates WMS', system: 'Warehouse WMS', input: 'ASN / inventory feed', costCenter: 'WMS & Fleet Telematics', spend: '$67.8K', status: 'Synced', statusTone: 'live' },
        { vendor: 'Cold-Chain Temp Trackers', system: 'Reefer Monitoring', input: 'Temp sensor stream', costCenter: 'Cold-Chain Supply Tracking', spend: '$11.2K', status: 'Alert', statusTone: 'warn' },
      ],
      policies: [
        { name: 'WMS & Fleet Telematics', limit: '$75K/mo', spent: 58400, cap: 75000, compliance: 96.4, status: 'active' },
        { name: 'Carrier Spot Rates', limit: '$220K/mo', spent: 198400, cap: 220000, compliance: 88.1, status: 'warning' },
        { name: 'Route Optimization Tools', limit: '$40K/mo', spent: 31200, cap: 40000, compliance: 97.8, status: 'active' },
        { name: 'Owner-Operator Settlements', limit: '$160K/mo', spent: 142800, cap: 160000, compliance: 91.2, status: 'active' },
        { name: 'Cold-Chain Supply Tracking', limit: '$28K/mo', spent: 24600, cap: 28000, compliance: 94.5, status: 'warning' },
        { name: 'Depot & Yard Ops', limit: '$35K/mo', spent: 22100, cap: 35000, compliance: 99.0, status: 'active' },
      ],
      insights: [
        { type: 'save', icon: '💰', text: 'Renegotiated <strong>{{vendor0}}</strong> telematics seats: Saved <strong>$2,400/mo</strong>', tag: 'auto' },
        { type: 'action', icon: '⚡', text: 'Auto-approved <strong>{{vendor1}}</strong> settlement within Fleet Idle-Time Cap', tag: 'auto' },
        { type: 'alert', icon: '⚠️', text: '<strong>{{vendor3}}</strong> cold-chain breach risk — reefer spend +12% WoW', tag: 'review' },
        { type: 'optimize', icon: '📊', text: 'Lane consolidation via <strong>{{cost1}}</strong>: projected <strong>$18K</strong> monthly savings', tag: 'review' },
        { type: 'save', icon: '💰', text: 'Idle tractor detected by <strong>{{vendor1}}</strong> — fuel burn cut <strong>$640</strong>', tag: 'auto' },
        { type: 'action', icon: '⚡', text: 'Matched ASN from <strong>{{vendor2}}</strong> to PO #LFX-8841', tag: 'auto' },
      ],
    },
    healthcare: {
      hint: 'Healthcare & Care Ops',
      badge: 'NDIS Compliance Billing Guardrails: Verified',
      costs: ['NDIS Compliance Software', 'Roster & Care Platforms', 'Patient Data Management'],
      costEyebrows: ['Billing compliance', 'Care workforce', 'Clinical data'],
      metrics: {
        cash: 'Provider Cash Position',
        runway: 'Care Delivery Runway',
        savings: 'Claim Recovery Savings',
        compliance: 'NDIS Control Plane',
        complianceLabel: 'Plan Management Compliance',
        burnLabel: 'Care burn',
        actionsLabel: 'roster actions',
        deltas: { cash: '+6.2%', runway: 'Stable', savings: 'YTD', compliance: 'Verified' },
      },
      panels: {
        chartTitle: 'Predictive 12-Month Provider Liquidity',
        chartDesc: 'NDIS claim cycles & payroll cash flow forecast',
        insightsTitle: 'Care Ops Insights',
        insightsDesc: 'Roster, claims, and clinical systems agent actions',
        guardrailsTitle: 'Healthcare Spend Guardrails',
        guardrailsDesc: 'NDIS, rostering, and clinical data expense policies',
        vendorsTitle: 'Connected Care Vendors',
        vendorsDesc: 'Live practice, roster, and NDIS claim system feeds',
      },
      engine: {
        toggle: 'NDIS Audit-Trail Safeguard',
        status: 'Verified',
        hint: 'Locks claim mutations to immutable audit trail',
        desc: 'NDIS and care-ops capital protection controls',
        meter: 97,
        signals: [
          'PRODA claim batch hash verified',
          'Roster award rules within Fair Work bands',
          'Participant plan budgets reconciled hourly',
        ],
      },
      health: {
        vendors: 4,
        exclusions: 21,
        runwayDaysSaved: 12,
        log: [
          { time: '00:03', text: 'Halaxy practice suite billing sync OK' },
          { time: '00:11', text: 'Excluded 9 duplicate Deputy overtime claims' },
          { time: '00:21', text: 'NDIS Claim Portal Connect · runway +0.4 days' },
        ],
      },
      vendors: [
        { vendor: 'Halaxy Practice Suite', system: 'Practice Management', input: 'Invoice / Medicare feed', costCenter: 'Patient Data Management', spend: '$12.6K', status: 'Live', statusTone: 'live' },
        { vendor: 'Cliniko Care Engine', system: 'Clinical Records', input: 'FHIR R4 events', costCenter: 'Patient Data Management', spend: '$14.8K', status: 'Synced', statusTone: 'live' },
        { vendor: 'Deputy Staff Roster', system: 'Care Rostering', input: 'Award / shift feed', costCenter: 'Roster & Care Platforms', spend: '$9.4K', status: 'Live', statusTone: 'live' },
        { vendor: 'NDIS Claim Portal Connect', system: 'Plan Management', input: 'PRODA claim API', costCenter: 'NDIS Compliance Software', spend: '$31.4K', status: 'Verified', statusTone: 'live' },
      ],
      policies: [
        { name: 'NDIS Compliance Software', limit: '$45K/mo', spent: 33800, cap: 45000, compliance: 98.6, status: 'active' },
        { name: 'Support Worker Payroll', limit: '$280K/mo', spent: 251400, cap: 280000, compliance: 93.2, status: 'warning' },
        { name: 'Roster & Care Platforms', limit: '$35K/mo', spent: 27200, cap: 35000, compliance: 97.1, status: 'active' },
        { name: 'Allied Health Contractors', limit: '$90K/mo', spent: 71400, cap: 90000, compliance: 95.4, status: 'active' },
        { name: 'Patient Data Management', limit: '$25K/mo', spent: 18900, cap: 25000, compliance: 99.2, status: 'active' },
        { name: 'Clinical Consumables', limit: '$18K/mo', spent: 14200, cap: 18000, compliance: 91.8, status: 'warning' },
      ],
      insights: [
        { type: 'action', icon: '⚡', text: 'Validated NDIS claim batch via <strong>{{vendor3}}</strong> — 142 line items cleared', tag: 'auto' },
        { type: 'alert', icon: '⚠️', text: '<strong>{{cost0}}</strong> utilization at <strong>87%</strong> of monthly cap', tag: 'review' },
        { type: 'save', icon: '💰', text: 'Duplicate roster shift blocked in <strong>{{vendor2}}</strong>: Saved <strong>$1,120</strong>', tag: 'auto' },
        { type: 'optimize', icon: '📊', text: 'Care ratio optimization across <strong>{{vendor0}}</strong>: +0.3 mo runway', tag: 'review' },
        { type: 'action', icon: '⚡', text: 'FHIR sync from <strong>{{vendor1}}</strong> matched to participant plan budgets', tag: 'auto' },
        { type: 'save', icon: '💰', text: 'Rejected non-compliant claim before <strong>{{vendor3}}</strong> submission', tag: 'auto' },
      ],
    },
    ecommerce: {
      hint: 'E-commerce & Retail',
      badge: 'Ad Spend Attribution Guardrail: Enforced',
      costs: ['Shopify Plugins & Apps', 'Ad Attribution Software', 'Logistics & Shipping Tech'],
      costEyebrows: ['Storefront apps', 'Growth media', 'Fulfillment'],
      metrics: {
        cash: 'Merchant Cash Position',
        runway: 'Contribution Runway',
        savings: 'CAC Efficiency Savings',
        compliance: 'Channel Control Plane',
        complianceLabel: 'Marketplace Fee Compliance',
        burnLabel: 'Growth burn',
        actionsLabel: 'merch actions',
        deltas: { cash: '+14.1%', runway: 'Scaling', savings: 'YTD', compliance: 'Enforced' },
      },
      panels: {
        chartTitle: 'Predictive 12-Month Merchant Liquidity',
        chartDesc: 'GMV settlement & ad-spend cash flow forecast',
        insightsTitle: 'Retail Growth Insights',
        insightsDesc: 'Shopify, ads, and support agent actions',
        guardrailsTitle: 'Retail Spend Guardrails',
        guardrailsDesc: 'Apps, attribution, and shipping expense policies',
        vendorsTitle: 'Connected Commerce Vendors',
        vendorsDesc: 'Live storefront, attribution, and helpdesk feeds',
      },
      engine: {
        toggle: 'Zombie App Billing Interceptor',
        status: 'Armed',
        hint: 'Kills unused Shopify apps before renewal',
        desc: 'Retail SaaS and media capital protection controls',
        meter: 88,
        signals: [
          '14 zombie apps queued for intercept',
          'TripleWhale ROAS floor enforced at 1.8x',
          'Gorgias ticket macros within SLA budget',
        ],
      },
      health: {
        vendors: 4,
        exclusions: 26,
        runwayDaysSaved: 16,
        log: [
          { time: '00:02', text: 'Shopify Advanced App Stack — 41 apps inventoried' },
          { time: '00:09', text: 'Excluded 11 zombie apps before billing cycle' },
          { time: '00:18', text: 'Klaviyo + Gorgias sync · runway +0.5 days' },
        ],
      },
      vendors: [
        { vendor: 'Shopify Advanced App Stack', system: 'Storefront Commerce', input: 'Order webhooks', costCenter: 'Shopify Plugins & Apps', spend: '$36.5K', status: 'Live', statusTone: 'live' },
        { vendor: 'Klaviyo Marketing Automation', system: 'Lifecycle CRM', input: 'Event stream', costCenter: 'Shopify Plugins & Apps', spend: '$12.8K', status: 'Synced', statusTone: 'live' },
        { vendor: 'TripleWhale Attribution', system: 'Ad Attribution', input: 'Pixel + SKAN', costCenter: 'Ad Attribution Software', spend: '$8.9K', status: 'Armed', statusTone: 'live' },
        { vendor: 'Gorgias Support Helpdesk', system: 'CX Helpdesk', input: 'Ticket / MAC feed', costCenter: 'Logistics & Shipping Tech', spend: '$7.2K', status: 'Live', statusTone: 'live' },
      ],
      policies: [
        { name: 'Shopify Plugins & Apps', limit: '$55K/mo', spent: 42800, cap: 55000, compliance: 96.0, status: 'active' },
        { name: 'Paid Social Media', limit: '$150K/mo', spent: 138400, cap: 150000, compliance: 84.5, status: 'warning' },
        { name: 'Ad Attribution Software', limit: '$20K/mo', spent: 14200, cap: 20000, compliance: 98.1, status: 'active' },
        { name: 'Influencer Affiliates', limit: '$40K/mo', spent: 28600, cap: 40000, compliance: 92.4, status: 'active' },
        { name: 'Logistics & Shipping Tech', limit: '$85K/mo', spent: 76200, cap: 85000, compliance: 89.7, status: 'warning' },
        { name: 'Returns & Reverse Logistics', limit: '$30K/mo', spent: 21400, cap: 30000, compliance: 95.3, status: 'active' },
      ],
      insights: [
        { type: 'alert', icon: '⚠️', text: '<strong>{{vendor2}}</strong> hit attribution floor — ROAS below 1.8x', tag: 'review' },
        { type: 'save', icon: '💰', text: 'Paused duplicate apps via <strong>{{vendor0}}</strong>: Saved <strong>$890/mo</strong>', tag: 'auto' },
        { type: 'action', icon: '⚡', text: 'Auto-triaged spike tickets in <strong>{{vendor3}}</strong> within SLA', tag: 'auto' },
        { type: 'optimize', icon: '📊', text: 'Klaviyo flow consolidation cut <strong>{{cost0}}</strong> seats 14%', tag: 'review' },
        { type: 'save', icon: '💰', text: 'Zombie interceptor blocked renewal on unused <strong>{{vendor0}}</strong> add-on', tag: 'auto' },
        { type: 'action', icon: '⚡', text: 'TripleWhale anomaly cleared for <strong>{{cost1}}</strong> spend spike', tag: 'auto' },
      ],
    },
    tech: {
      hint: 'Tech, AI & Cloud SaaS',
      badge: 'LLMOps Cost Override Protection: Enabled',
      costs: ['AWS/Azure Cloud Compute', 'LLM API Usage (OpenAI/Anthropic)', 'CI/CD & DevOps Stack'],
      costEyebrows: ['Compute & infra', 'Model inference', 'Delivery systems'],
      metrics: {
        cash: 'Cloud Treasury Position',
        runway: 'Inference Runway',
        savings: 'Autonomous FinOps Savings',
        compliance: 'SaaS Control Plane',
        complianceLabel: 'SOC2 Spend Compliance',
        burnLabel: 'Model burn',
        actionsLabel: 'pipeline actions',
        deltas: { cash: '+12.4%', runway: 'Healthy', savings: 'YTD', compliance: 'Live' },
      },
      panels: {
        chartTitle: 'Predictive 12-Month Cloud Liquidity',
        chartDesc: 'Compute, LLM, and SaaS cash flow with confidence bands',
        insightsTitle: 'FinOps & LLMOps Insights',
        insightsDesc: 'Cloud, model, and observability agent actions',
        guardrailsTitle: 'Cloud & LLM Spend Guardrails',
        guardrailsDesc: 'Compute, inference, and DevOps expense policies',
        vendorsTitle: 'Connected System Vendors',
        vendorsDesc: 'Live cloud, LLM, and FinOps vendor feeds',
      },
      engine: {
        toggle: 'LLM API Token Budget Spike Interceptor',
        status: 'Caps Enabled',
        hint: 'Hard-caps token burn across OpenAI & Anthropic pools',
        desc: 'Cloud and LLMOps capital protection controls',
        meter: 94,
        signals: [
          'OpenAI pool under soft cap · 72% utilized',
          'Anthropic staging keys rate-limited',
          'Datadog FinOps suite indexing rightsized',
        ],
      },
      health: {
        vendors: 4,
        exclusions: 22,
        runwayDaysSaved: 14,
        log: [
          { time: '00:01', text: 'AWS EC2 Cluster Compute telemetry healthy' },
          { time: '00:08', text: 'Excluded 3 orphan GPU nodes from invoice' },
          { time: '00:16', text: 'Token spike interceptor armed · runway +0.4 days' },
        ],
      },
      vendors: [
        { vendor: 'AWS EC2 Cluster Compute', system: 'Cloud Compute', input: 'CloudWatch metrics', costCenter: 'AWS/Azure Cloud Compute', spend: '$142.5K', status: 'Synced', statusTone: 'live' },
        { vendor: 'OpenAI API Token Pool', system: 'LLM Inference', input: 'Token usage meter', costCenter: 'LLM API Usage (OpenAI/Anthropic)', spend: '$86.2K', status: 'Live', statusTone: 'live' },
        { vendor: 'Anthropic Claude API', system: 'LLM Inference', input: 'Token usage meter', costCenter: 'LLM API Usage (OpenAI/Anthropic)', spend: '$41.8K', status: 'Protected', statusTone: 'live' },
        { vendor: 'Datadog FinOps Suite', system: 'Observability', input: 'APM / cost ingest', costCenter: 'CI/CD & DevOps Stack', spend: '$27.4K', status: 'Live', statusTone: 'live' },
      ],
      policies: [
        { name: 'AWS/Azure Cloud Compute', limit: '$200K/mo', spent: 178400, cap: 200000, compliance: 89.2, status: 'warning' },
        { name: 'LLM API Usage (OpenAI/Anthropic)', limit: '$120K/mo', spent: 98400, cap: 120000, compliance: 91.5, status: 'warning' },
        { name: 'CI/CD & DevOps Stack', limit: '$45K/mo', spent: 31200, cap: 45000, compliance: 97.4, status: 'active' },
        { name: 'SaaS Collaboration Suite', limit: '$50K/mo', spent: 38400, cap: 50000, compliance: 96.8, status: 'active' },
        { name: 'Security & Compliance Tools', limit: '$35K/mo', spent: 22100, cap: 35000, compliance: 99.1, status: 'active' },
        { name: 'Contractor Engineering', limit: '$80K/mo', spent: 54200, cap: 80000, compliance: 94.0, status: 'active' },
      ],
      insights: [
        { type: 'save', icon: '💰', text: 'Rightsized idle <strong>{{vendor0}}</strong> instances: Saved <strong>$6,200/mo</strong>', tag: 'auto' },
        { type: 'alert', icon: '⚠️', text: '<strong>{{vendor1}}</strong> token burn approaching LLMOps override threshold', tag: 'review' },
        { type: 'action', icon: '⚡', text: 'Enforced rate limit on <strong>{{vendor2}}</strong> staging keys', tag: 'auto' },
        { type: 'optimize', icon: '📊', text: 'Reserved capacity purchase for <strong>{{cost0}}</strong>: −18% unit cost', tag: 'review' },
        { type: 'save', icon: '💰', text: 'Deduplicated <strong>{{vendor3}}</strong> log indexes: Saved <strong>$1,840/mo</strong>', tag: 'auto' },
        { type: 'action', icon: '⚡', text: 'Spike interceptor held <strong>{{vendor1}}</strong> under monthly token budget', tag: 'auto' },
      ],
    },
    nonprofit: {
      hint: 'Non-Profits & Public Policy',
      badge: 'ACNC Grant Distribution Rule: Compliant',
      costs: ['Grant Tracking Portals', 'Advocacy Toolkits', 'Donor Management CRMs'],
      costEyebrows: ['Grant systems', 'Policy advocacy', 'Donor relations'],
      metrics: {
        cash: 'Restricted Funds Position',
        runway: 'Program Runway',
        savings: 'Grant Efficiency Savings',
        compliance: 'ACNC Control Plane',
        complianceLabel: 'Charitable Disbursement Compliance',
        burnLabel: 'Program burn',
        actionsLabel: 'grant actions',
        deltas: { cash: '+4.3%', runway: 'Funded', savings: 'YTD', compliance: 'Compliant' },
      },
      panels: {
        chartTitle: 'Predictive 12-Month Program Liquidity',
        chartDesc: 'Grant drawdowns & program cash flow forecast',
        insightsTitle: 'Mission Finance Insights',
        insightsDesc: 'Grant, advocacy, and donor-system agent actions',
        guardrailsTitle: 'Nonprofit Spend Guardrails',
        guardrailsDesc: 'Grant, advocacy, and donor CRM expense policies',
        vendorsTitle: 'Connected Mission Vendors',
        vendorsDesc: 'Live ACNC, grant, CRM, and donor system feeds',
      },
      engine: {
        toggle: 'ACNC Restricted Grant Allocator',
        status: 'Compliant',
        hint: 'Routes restricted funds only to approved program codes',
        desc: 'Nonprofit and policy capital protection controls',
        meter: 96,
        signals: [
          'Restricted class codes reconciled to ACNC rules',
          'GrantTracker milestones within drawdown schedule',
          'Stripe Donor Connect fees under 2.9% band',
        ],
      },
      health: {
        vendors: 4,
        exclusions: 14,
        runwayDaysSaved: 8,
        log: [
          { time: '00:05', text: 'ACNC Compliance Portal attestation current' },
          { time: '00:13', text: 'Excluded 4 ineligible advocacy line items' },
          { time: '00:22', text: 'GrantTracker + Donor Connect · runway +0.3 days' },
        ],
      },
      vendors: [
        { vendor: 'ACNC Compliance Portal', system: 'Charity Compliance', input: 'AIS / attestation feed', costCenter: 'Grant Tracking Portals', spend: '$2.1K', status: 'Compliant', statusTone: 'live' },
        { vendor: 'Salesforce Non-Profit CRM', system: 'Donor CRM', input: 'Gift / pledge feed', costCenter: 'Donor Management CRMs', spend: '$16.4K', status: 'Live', statusTone: 'live' },
        { vendor: 'GrantTracker Dashboard', system: 'Grant Tracking', input: 'Milestone reports', costCenter: 'Grant Tracking Portals', spend: '$7.8K', status: 'Synced', statusTone: 'live' },
        { vendor: 'Stripe Donor Connect', system: 'Online Giving', input: 'Donation webhooks', costCenter: 'Donor Management CRMs', spend: '$4.6K', status: 'Live', statusTone: 'live' },
      ],
      policies: [
        { name: 'Grant Tracking Portals', limit: '$15K/mo', spent: 11200, cap: 15000, compliance: 99.4, status: 'active' },
        { name: 'Program Disbursements', limit: '$180K/mo', spent: 146800, cap: 180000, compliance: 97.8, status: 'active' },
        { name: 'Advocacy Toolkits', limit: '$12K/mo', spent: 9400, cap: 12000, compliance: 96.2, status: 'active' },
        { name: 'Field Organizing Travel', limit: '$20K/mo', spent: 16800, cap: 20000, compliance: 88.5, status: 'warning' },
        { name: 'Donor Management CRMs', limit: '$22K/mo', spent: 17400, cap: 22000, compliance: 98.7, status: 'active' },
        { name: 'Event & Gala Ops', limit: '$35K/qtr', spent: 28600, cap: 35000, compliance: 94.1, status: 'active' },
      ],
      insights: [
        { type: 'action', icon: '⚡', text: 'ACNC rule check passed for <strong>{{vendor0}}</strong> attestation window', tag: 'auto' },
        { type: 'save', icon: '💰', text: 'Merged duplicate donor records in <strong>{{vendor1}}</strong>: Saved <strong>$420/mo</strong>', tag: 'auto' },
        { type: 'alert', icon: '⚠️', text: 'Restricted fund variance flagged in <strong>{{vendor2}}</strong> milestones', tag: 'review' },
        { type: 'optimize', icon: '📊', text: 'Advocacy channel mix via <strong>{{cost1}}</strong>: +9% petition conversion', tag: 'review' },
        { type: 'action', icon: '⚡', text: 'Matched Stripe gift to campaign budget in <strong>{{vendor3}}</strong>', tag: 'auto' },
        { type: 'save', icon: '💰', text: 'Blocked unbudgeted disbursement under ACNC allocator', tag: 'auto' },
      ],
    },
  };

  function applyIndustryLabels(view) {
    $$('[data-industry-label]').forEach((el) => {
      const index = Number(el.dataset.industryLabel);
      if (!Number.isNaN(index) && view.costs[index]) el.textContent = view.costs[index];
    });

    $$('[data-cost-eyebrow]').forEach((el) => {
      const index = Number(el.dataset.costEyebrow);
      if (!Number.isNaN(index) && view.costEyebrows?.[index]) {
        el.textContent = view.costEyebrows[index];
      }
    });

    const m = view.metrics || {};
    const setText = (sel, value) => {
      const el = $(sel);
      if (el && value != null) el.textContent = value;
    };

    setText('[data-metric-eyebrow="cash"]', m.cash);
    setText('[data-metric-eyebrow="runway"]', m.runway);
    setText('[data-metric-eyebrow="savings"]', m.savings);
    setText('[data-metric-eyebrow="compliance"]', m.compliance);
    setText('[data-metric-compliance-label]', m.complianceLabel);
    setText('[data-metric-burn-label]', m.burnLabel);
    setText('[data-metric-actions-label]', m.actionsLabel);

    if (m.deltas) {
      setText('[data-metric-delta="cash"]', m.deltas.cash);
      setText('[data-metric-delta="runway"]', m.deltas.runway);
      setText('[data-metric-delta="savings"]', m.deltas.savings);
      setText('[data-metric-delta="compliance"]', m.deltas.compliance);
    }

    const p = view.panels || {};
    setText('#chartTitle', p.chartTitle);
    setText('#chartDesc', p.chartDesc);
    setText('#insightsTitle', p.insightsTitle);
    setText('#insightsDesc', p.insightsDesc);
    setText('#guardrailsTitle', p.guardrailsTitle);
    setText('#guardrailsDesc', p.guardrailsDesc);
    setText('#vendorsTitle', p.vendorsTitle);
    setText('#vendorsDesc', p.vendorsDesc);
    setText('#opsGuardrailText', view.badge);
    setText('#industryViewHint', view.hint);
  }

  function initIndustryView(guardrails, insights) {
    const tabs = $$('.industry-tab[data-industry]');
    const swapTargets = () => [
      $('#metricsBlock'),
      $('#costCenters'),
      $('#vendorLedger'),
      $('#simOpsRow'),
      $('#guardrailsGrid'),
      $('#insightsStream'),
      $('#systemHealth'),
    ].filter(Boolean);

    let activeIndustry = 'tech';

    const applyIndustry = (industryId) => {
      const view = INDUSTRY_VIEWS[industryId];
      if (!view) return;
      activeIndustry = industryId;

      tabs.forEach((tab) => {
        const selected = tab.dataset.industry === activeIndustry;
        tab.classList.toggle('industry-tab--active', selected);
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      });

      const targets = swapTargets();
      targets.forEach((el) => el.classList.add('industry-flash'));

      applyIndustryLabels(view);
      renderVendorLedger(view.vendors);
      renderOpsEngine(view);
      renderSystemHealth(view);
      guardrails?.setPolicies(view.policies);
      insights?.setIndustry(view);

      const badge = $('#opsEngineBadge');
      const meterFill = $('#opsEngineMeterFill');
      const meterValue = $('#opsEngineMeterValue');
      if (badge) badge.dataset.armedStatus = view.engine?.status || 'Active';
      if (meterFill) meterFill.dataset.armedWidth = `${view.engine?.meter ?? 90}%`;
      if (meterValue) meterValue.dataset.armedValue = `${view.engine?.meter ?? 90}%`;

      requestAnimationFrame(() => {
        targets.forEach((el) => el.classList.remove('industry-flash'));
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const next = tab.dataset.industry;
        if (!next || next === activeIndustry) return;
        applyIndustry(next);
      });
    });

    // Expose for report modal sync
    window.__applyIndustryView = applyIndustry;

    applyIndustry(activeIndustry);
  }

  // ─── Init ────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const chart = new LiquidityChart($('#liquidityChart'));
    initChartControls(chart);

    drawSparkline($('#sparkCash'));
    const insights = new InsightsStream($('#insightsStream'));

    const guardrails = new GuardrailsPanel($('#guardrailsGrid'));

    new MetricSimulator();
    initMobileNav();
    initViewRouter(chart);
    initIndustryView(guardrails, insights);
    initOpsEngineToggle();
    initReportModal();
    initExportButton();
    initAddPolicyButton(guardrails);

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

  // ─── Toast Notifications ─────────────────────────────────
  function showToast(message, { tone = 'success', duration = 3800 } = {}) {
    const stack = $('#toastStack');
    if (!stack) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${tone}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <span class="toast__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
      </span>
      <span class="toast__message">${message}</span>
      <button type="button" class="toast__dismiss" aria-label="Dismiss notification">×</button>
    `;

    const dismiss = () => {
      toast.classList.add('toast--exit');
      setTimeout(() => toast.remove(), 280);
    };

    toast.querySelector('.toast__dismiss')?.addEventListener('click', dismiss);
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(dismiss, duration);
  }

  // ─── New Report Modal ────────────────────────────────────
  function getActiveIndustryId() {
    const active = $('.industry-tab--active[data-industry]');
    return active?.dataset.industry || 'tech';
  }

  function openAppModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.classList.add('app-modal--visible'));
  }

  function closeAppModal(modal) {
    if (!modal) return;
    modal.classList.remove('app-modal--visible');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { modal.hidden = true; }, 320);
  }

  function formatAudCurrency(amount) {
    const rounded = Math.round(amount * 100) / 100;
    const hasCents = Math.abs(rounded % 1) > 0.001;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    }).format(rounded).replace('A$', '$');
  }

  function showLeakAlert(exposureAmount) {
    const alertEl = $('#leakAlert');
    const messageEl = $('#leakAlertMessage');
    if (!alertEl || !messageEl) return;

    const formatted = formatAudCurrency(exposureAmount);
    messageEl.textContent =
      `⚠️ WARNING: Based on your selected industry parameters, your operations are at high risk of an estimated ${formatted}/month in silent cost leaks and overlapping tool waste. Activate our Scale Plan to freeze this exposure immediately.`;

    alertEl.hidden = false;
    requestAnimationFrame(() => {
      alertEl.classList.add('leak-alert--visible');
      alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function hideLeakAlert() {
    const alertEl = $('#leakAlert');
    if (!alertEl) return;
    alertEl.classList.remove('leak-alert--visible');
    setTimeout(() => { alertEl.hidden = true; }, 280);
  }

  function initReportModal() {
    const modal = $('#reportModal');
    const openBtn = $('#newReportBtn');
    const form = $('#reportForm');
    const compileBtn = $('#reportCompileBtn');
    const industrySelect = $('#reportIndustry');
    const spendInput = $('#monthlySpendInput');
    if (!modal || !openBtn || !form || !compileBtn) return;

    let compiling = false;

    const close = () => {
      if (compiling) return;
      closeAppModal(modal);
    };

    openBtn.addEventListener('click', () => {
      if (industrySelect) industrySelect.value = getActiveIndustryId();
      openAppModal(modal);
      setTimeout(() => spendInput?.focus(), 50);
    });

    $('#reportModalClose')?.addEventListener('click', close);
    $('#reportModalCancel')?.addEventListener('click', close);
    $('#reportModalBackdrop')?.addEventListener('click', close);
    $('#leakAlertClose')?.addEventListener('click', hideLeakAlert);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('app-modal--visible') && !compiling) {
        close();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (compiling) return;

      const industry = industrySelect?.value || 'tech';
      const rawSpend = (spendInput?.value || '').replace(/,/g, '').trim();
      const monthlySpend = Number(rawSpend);

      if (!Number.isFinite(monthlySpend) || monthlySpend <= 0) {
        spendInput?.focus();
        return;
      }

      compiling = true;
      compileBtn.disabled = true;
      compileBtn.classList.add('btn--loading');

      if (typeof window.__applyIndustryView === 'function') {
        window.__applyIndustryView(industry);
      }

      const exposureLeak = monthlySpend * 0.08;

      setTimeout(() => {
        compiling = false;
        compileBtn.disabled = false;
        compileBtn.classList.remove('btn--loading');
        closeAppModal(modal);
        showLeakAlert(exposureLeak);
      }, 1500);
    });
  }

  // ─── Export CSV ──────────────────────────────────────────
  function buildIntelligenceCsv() {
    const industryHint = $('#industryViewHint')?.textContent || 'Tech, AI & Cloud SaaS';
    const industryId = getActiveIndustryId();
    const view = INDUSTRY_VIEWS[industryId];
    const costs = view?.costs || [];
    const vendors = view?.vendors || [];

    const cash = $('#metricCash')?.textContent || '';
    const runway = $('#metricRunway')?.textContent || '';
    const burn = $('#metricBurn')?.textContent || '';
    const savings = $('#metricSavings')?.textContent || '';
    const actions = $('#metricActions')?.textContent || '';
    const compliance = $('#metricCompliance')?.textContent || '';
    const badge = $('#opsGuardrailText')?.textContent || '';

    const rows = [
      ['Obsidian Treasury — Financial Intelligence Report'],
      ['Period', 'Q3 FY2026'],
      ['Generated', new Date().toISOString()],
      ['Industry View', industryHint],
      ['Operational Guardrail', badge],
      [],
      ['Metric', 'Value'],
      ['Cash Position', cash],
      ['Runway', runway],
      ['Burn Rate', burn],
      ['Optimized Savings', savings],
      ['Autonomous Actions', actions],
      ['Policy Compliance', compliance],
      [],
      ['Cost Center Rank', 'Name'],
      ['01', costs[0] || ''],
      ['02', costs[1] || ''],
      ['03', costs[2] || ''],
      [],
      ['System Vendor', 'Input', 'Cost Center', 'Monthly Spend', 'Status'],
      ...vendors.map((v) => [v.vendor, v.input, v.costCenter, v.spend, v.status]),
      [],
      ['Guardrail Policy', 'Limit', 'Compliance'],
      ...GUARDRAIL_POLICIES.map((p) => [p.name, p.limit, `${Number(p.compliance).toFixed(1)}%`]),
    ];

    return rows
      .map((row) => row.map((cell) => {
        const value = String(cell ?? '');
        return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
      }).join(','))
      .join('\n');
  }

  function downloadCsv(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function initExportButton() {
    const btn = $('#exportBtn');
    if (!btn) return;

    let exporting = false;
    const idleLabel = btn.textContent;

    btn.addEventListener('click', () => {
      if (exporting) return;
      exporting = true;
      btn.disabled = true;
      btn.classList.add('btn--loading');
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = `<span class="btn__label">Exporting...</span><span class="btn__spinner" aria-hidden="true"></span>`;

      setTimeout(() => {
        downloadCsv(
          'Obsidian_Treasury_Financial_Intelligence_Q3_2026.csv',
          buildIntelligenceCsv()
        );

        exporting = false;
        btn.disabled = false;
        btn.classList.remove('btn--loading');
        btn.removeAttribute('aria-busy');
        btn.textContent = idleLabel;
        showToast('Financial Intelligence Exported to CSV.');
      }, 1500);
    });
  }

  // ─── Add Policy ──────────────────────────────────────────
  function initAddPolicyButton(guardrails) {
    const btn = $('#addPolicyBtn');
    if (!btn) return;

    let busy = false;
    const idleLabel = btn.textContent;

    btn.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      btn.disabled = true;
      btn.textContent = 'Adding…';

      setTimeout(() => {
        const activeId = getActiveIndustryId();
        const costs = INDUSTRY_VIEWS[activeId]?.costs || INDUSTRY_VIEWS.tech.costs;
        if (GUARDRAIL_POLICIES.length < 8) {
          GUARDRAIL_POLICIES.push({
            name: `${costs[0]} · Draft Policy`,
            limit: '$40K/mo',
            spent: randomBetween(4000, 12000),
            cap: 40000,
            compliance: Number(randomBetween(92, 99).toFixed(1)),
            status: 'active',
          });
          guardrails?.render();
          guardrails?.animateMeters();
          showToast('New spend policy draft added to guardrails.');
        } else {
          showToast('Policy slots full — review existing guardrails first.', { tone: 'success' });
        }

        busy = false;
        btn.disabled = false;
        btn.textContent = idleLabel;
      }, 900);
    });
  }

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
