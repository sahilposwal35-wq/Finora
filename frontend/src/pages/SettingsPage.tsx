import React, { useState } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [monthlyIncome, setMonthlyIncome] = useState(
    user?.monthly_income != null ? String(user.monthly_income) : '',
  );
  const [savingsTarget, setSavingsTarget] = useState(
    user?.savings_target != null ? String(user.savings_target) : '',
  );
  const [threshold, setThreshold] = useState(user?.budget_warning_threshold ?? 80);
  const [currency, setCurrency] = useState(user?.currency ?? 'INR');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        monthly_income: monthlyIncome ? Number(monthlyIncome) : null,
        savings_target: savingsTarget ? Number(savingsTarget) : null,
        budget_warning_threshold: threshold,
        currency,
      });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A2E]">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your profile and financial preferences</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile */}
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#1A1A2E]">Profile</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className="input-field bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Preferences */}
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#1A1A2E]">Financial Preferences</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Income (₹)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="e.g. 85000"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Savings Target (₹)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={savingsTarget}
                onChange={(e) => setSavingsTarget(e.target.value)}
                placeholder="e.g. 20000"
                className="input-field"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">
                Budget Warning Threshold
              </label>
              <span className="text-sm font-semibold text-[#1B4332]">{threshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-[#1B4332]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Receive drift warnings when a category exceeds this % of expected pace.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="input-field"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
