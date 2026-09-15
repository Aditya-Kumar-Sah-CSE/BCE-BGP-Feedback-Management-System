'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllBillingPlansAction,
  createBillingPlanAction,
  updateBillingPlanAction,
  toggleBillingPlanAction,
  deleteBillingPlanAction,
} from '@/app/admin/billing/plan-actions';
import type { BillingPlan, BillingInterval } from '@/types/database';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Star,
} from 'lucide-react';

export function PlanManagementSection() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('INR');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY');
  const [durationDays, setDurationDays] = useState('30');
  const [featuresText, setFeaturesText] = useState('');
  const [isRecommended, setIsRecommended] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState('0');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    const res = await getAllBillingPlansAction();
    if (res.success && res.plans) {
      setPlans(res.plans);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  function openCreateModal() {
    setEditingPlan(null);
    setName('');
    setDescription('');
    setPrice('2999');
    setCurrency('INR');
    setBillingInterval('MONTHLY');
    setDurationDays('30');
    setFeaturesText('Google Form generation\nGoogle Sheet integration\nFull analytics access');
    setIsRecommended(false);
    setIsActive(true);
    setDisplayOrder(String((plans.length + 1) * 10));
    setIsModalOpen(true);
  }

  function openEditModal(plan: BillingPlan) {
    setEditingPlan(plan);
    setName(plan.name);
    setDescription(plan.description || '');
    setPrice(String(plan.price));
    setCurrency(plan.currency);
    setBillingInterval(plan.billing_interval);
    setDurationDays(plan.duration_days !== null && plan.duration_days !== undefined ? String(plan.duration_days) : '');
    setFeaturesText(plan.features?.join('\n') || '');
    setIsRecommended(plan.is_recommended || false);
    setIsActive(plan.is_active);
    setDisplayOrder(String(plan.display_order));
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Plan name is required.' });
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setMessage({ type: 'error', text: 'Price must be a non-negative number.' });
      return;
    }

    const durationNum = durationDays.trim() !== '' ? parseInt(durationDays, 10) : null;
    if (durationNum !== null && (isNaN(durationNum) || durationNum < 0)) {
      setMessage({ type: 'error', text: 'Duration must be a valid non-negative number of days, or empty for unlimited.' });
      return;
    }

    const features = featuresText
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);

    setSaving(true);
    setMessage(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: priceNum,
      currency: currency.trim() || 'INR',
      billingInterval,
      durationDays: durationNum,
      features,
      isRecommended,
      isActive,
      displayOrder: parseInt(displayOrder, 10) || 0,
    };

    let res;
    if (editingPlan) {
      res = await updateBillingPlanAction({ id: editingPlan.id, ...payload });
    } else {
      res = await createBillingPlanAction(payload);
    }

    setSaving(false);
    if (res.success) {
      const msg = 'message' in res ? (res as any).message : undefined;
      setMessage({ type: 'success', text: msg || 'Plan saved successfully.' });
      setIsModalOpen(false);
      await loadPlans();
    } else {
      const err = 'error' in res ? (res as any).error : undefined;
      setMessage({ type: 'error', text: err || 'Failed to save plan.' });
    }
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleToggle(plan: BillingPlan) {
    const res = await toggleBillingPlanAction(plan.id, !plan.is_active);
    if (res.success) {
      setMessage({ type: 'success', text: res.message || 'Status updated.' });
      await loadPlans();
    } else {
      setMessage({ type: 'error', text: res.error || 'Failed to toggle status.' });
    }
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleDelete(plan: BillingPlan) {
    if (!confirm(`Are you sure you want to delete "${plan.name}"? This cannot be undone.`)) return;

    const res = await deleteBillingPlanAction(plan.id);
    if (res.success) {
      setMessage({ type: 'success', text: res.message || 'Plan deleted.' });
      await loadPlans();
    } else {
      setMessage({ type: 'error', text: res.error || 'Cannot delete plan.' });
    }
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-bce-cobalt" />
            Billing Plan Management
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Database-driven pricing models & subscription features.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bce-cobalt text-white text-xs font-semibold hover:bg-bce-navy transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add New Plan
        </button>
      </div>

      {message && (
        <div
          className={`rounded-lg p-3 text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="h-32 bg-slate-50 rounded-lg animate-pulse flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          No billing plans configured in database. Click &quot;Add New Plan&quot; to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-4 flex flex-col justify-between transition ${
                plan.is_active
                  ? 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                  : 'border-slate-200 bg-slate-50 opacity-60'
              }`}
            >
              {plan.is_recommended && (
                <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500 text-white shadow-xs flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-current" /> Recommended
                </span>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-slate-900 text-base">{plan.name}</h4>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-semibold">
                    {plan.billing_interval}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{plan.description || 'No description'}</p>

                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-extrabold text-slate-900">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {plan.duration_days ? `/ ${plan.duration_days} days` : '/ unlimited'}
                  </span>
                </div>

                <ul className="space-y-1 text-xs text-slate-600 mb-4">
                  {plan.features?.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggle(plan)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition ${
                    plan.is_active
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {plan.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                  {plan.is_active ? 'Active' : 'Disabled'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(plan)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                    title="Edit Plan"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(plan)}
                    className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition"
                    title="Delete Plan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Modal (Add/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingPlan ? `Edit "${editingPlan.name}"` : 'Create New Billing Plan'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Plan Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., MONTHLY, QUARTERLY, PRO"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20 focus:border-bce-cobalt"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Short tagline or plan benefit"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    min="0"
                    step="1"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Interval *</label>
                  <select
                    value={billingInterval}
                    onChange={e => setBillingInterval(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20"
                  >
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="YEARLY">YEARLY</option>
                    <option value="ONETIME">ONETIME</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Duration (Days) *</label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={e => setDurationDays(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={e => setDisplayOrder(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-bce-cobalt/20 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Features (One per line)
                </label>
                <textarea
                  value={featuresText}
                  onChange={e => setFeaturesText(e.target.value)}
                  placeholder="Google Form generation&#10;Google Sheet integration&#10;Priority Support"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm h-24 resize-none focus:ring-2 focus:ring-bce-cobalt/20 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecommended}
                    onChange={e => setIsRecommended(e.target.checked)}
                    className="rounded text-bce-cobalt focus:ring-bce-cobalt"
                  />
                  <span className="font-semibold text-slate-700">Mark as Recommended</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="rounded text-bce-cobalt focus:ring-bce-cobalt"
                  />
                  <span className="font-semibold text-slate-700">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-bce-cobalt text-white hover:bg-bce-navy transition disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingPlan ? 'Update Plan' : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
