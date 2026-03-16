"use client";

import { useState, useEffect } from "react";
import { User, Lock, CheckCircle, AlertCircle } from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { clientAccess: number };
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  analyst: "Analyst",
  client_manager: "Client Manager",
  client_viewer: "Client Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  analyst: "bg-blue-100 text-blue-700",
  client_manager: "bg-green-100 text-green-700",
  client_viewer: "bg-gray-100 text-gray-700",
};

function Alert({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
      {ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {text}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password form
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d.user);
        setDisplayName(d.user?.displayName ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const d = await res.json();
      if (res.ok) {
        setProfile((p) => p ? { ...p, displayName: d.user.displayName } : p);
        setProfileMsg({ ok: true, text: "Display name updated successfully." });
      } else {
        setProfileMsg({ ok: false, text: d.error ?? "Failed to save." });
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ ok: false, text: "New passwords do not match." });
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwMsg({ ok: false, text: "Password must be at least 8 characters." });
      return;
    }

    setSavingPw(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setPwMsg({ ok: true, text: "Password changed successfully." });
      } else {
        setPwMsg({ ok: false, text: d.error ?? "Failed to change password." });
      }
    } finally {
      setSavingPw(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return <div className="p-8 text-red-600">Failed to load profile.</div>;
  }

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      {/* Account Info */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
          <User className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Account Information</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-white uppercase">
                {(profile.displayName ?? profile.username)[0]}
              </span>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {profile.displayName ?? profile.username}
              </div>
              <div className="text-sm text-gray-500">@{profile.username}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[profile.role] ?? "bg-gray-100 text-gray-700"}`}>
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </span>
                <span className="text-xs text-gray-400">
                  · {profile._count.clientAccess} client{profile._count.clientAccess !== 1 ? "s" : ""} assigned
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Username</div>
              <div className="text-sm font-medium text-gray-800">{profile.username}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Email</div>
              <div className="text-sm font-medium text-gray-800">{profile.email ?? <span className="text-gray-400 italic">Not set</span>}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Member Since</div>
              <div className="text-sm font-medium text-gray-800">
                {new Date(profile.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Account Status</div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${profile.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                {profile.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Display Name */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
          <User className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Edit Display Name</span>
        </div>
        <form onSubmit={saveProfile} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              minLength={2}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your display name"
            />
          </div>
          {profileMsg && <Alert ok={profileMsg.ok} text={profileMsg.text} />}
          <button
            type="submit"
            disabled={savingProfile}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {savingProfile ? "Saving…" : "Save Name"}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
          <Lock className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Change Password</span>
        </div>
        <form onSubmit={savePassword} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter current password"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                required
                minLength={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                required
                minLength={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Repeat new password"
              />
            </div>
          </div>
          {pwMsg && <Alert ok={pwMsg.ok} text={pwMsg.text} />}
          <button
            type="submit"
            disabled={savingPw}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {savingPw ? "Changing…" : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
