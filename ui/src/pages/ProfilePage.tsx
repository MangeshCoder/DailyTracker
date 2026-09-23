import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '../services/api';
import { UserProfile, UpdateProfileDto } from '../types';
import { DatePicker } from '../components/DatePicker';

const BACKEND_ORIGIN = 'https://localhost:7096';

// ─── Avatar component — used here and in DirectoryPage ──────────────────────
export const UserAvatar = ({
  photoUrl,
  name,
  size = 'md',
}: {
  photoUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) => {
  const sizes = {
    sm: 'w-8  h-8  text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl',
  };
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

    if (photoUrl) {
    return (
        <img
        src={photoUrl.startsWith('http') ? photoUrl : `${BACKEND_ORIGIN}${photoUrl}`}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover flex-shrink-0`}
        />
    );
    }

  return (
    <div
      className={`${sizes[size]} rounded-full bg-gradient-to-br from-blue-500 to-violet-600
        flex items-center justify-center font-bold text-white flex-shrink-0`}
    >
      {initials}
    </div>
  );
};

// ─── Role badge ───────────────────────────────────────────────────────────────
const ROLE_STYLE: Record<string, string> = {
  Manager:   'bg-violet-500/15 text-violet-400 border-violet-500/30',
  TeamLead:  'bg-blue-500/15   text-blue-400   border-blue-500/30',
  Developer: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

export const RoleBadge = ({ role }: { role: string }) => (
  <span
    className={`px-2.5 py-0.5 rounded-lg text-xs font-medium border
      ${ROLE_STYLE[role] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}
  >
    {role}
  </span>
);

// ─── Field row (view mode) ─────────────────────────────────────────────────────
const Field = ({ label, value, icon }: { label: string; value?: string | null; icon: string }) => (
  <div className="flex items-start gap-3 py-3 border-b border-slate-800/60 last:border-0">
    <span className="text-lg w-6 shrink-0 mt-0.5">{icon}</span>
    <div className="min-w-0">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm ${value ? 'text-white' : 'text-slate-600 italic'}`}>
        {value ?? 'Not set'}
      </p>
    </div>
  </div>
);

// ─── Main ProfilePage ─────────────────────────────────────────────────────────
export const ProfilePage = () => {
  const qc = useQueryClient();
  const [editing, setEditing]     = useState(false);
  const [form, setForm]           = useState<UpdateProfileDto>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['myProfile'],
    queryFn:  () => profileApi.getMe().then((r: { data: UserProfile }) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateProfileDto) => profileApi.updateMe(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myProfile'] });
      setEditing(false);
      setForm({});
    },
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => profileApi.uploadPhoto(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myProfile'] });
      setPhotoPreview(null);
      setPhotoFile(null);
    },
  });

  const startEditing = () => {
    if (!profile) return;
    setForm({
      fullName:    profile.fullName,
      department:  profile.department  ?? '',
      designation: profile.designation ?? '',
      phone:       profile.phone       ?? '',
      bio:         profile.bio         ?? '',
      joinDate:    profile.joinDate     ? profile.joinDate.slice(0, 10) : '',
    });
    setEditing(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = () => {
    const payload: UpdateProfileDto = {};
    if (form.fullName?.trim())    payload.fullName    = form.fullName.trim();
    if (form.department !== undefined) payload.department  = form.department?.trim() || '';
    if (form.designation !== undefined) payload.designation = form.designation?.trim() || '';
    if (form.phone !== undefined)  payload.phone       = form.phone?.trim() || '';
    if (form.bio !== undefined)    payload.bio         = form.bio?.trim() || '';
    if (form.joinDate)             payload.joinDate    = form.joinDate || undefined;
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-900 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!profile) return null;

  const joinedStr = profile.joinDate
    ? new Date(profile.joinDate).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your personal information</p>
        </div>
        {!editing && (
          <button
            onClick={startEditing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm
              font-medium px-4 py-2 rounded-xl transition-colors"
          >
            ✏️ Edit Profile
          </button>
        )}
      </div>

      {/* Profile card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-5">

        {/* Photo + identity banner */}
        <div className="bg-gradient-to-r from-blue-600/20 to-violet-600/20 border-b border-slate-800 p-6">
          <div className="flex items-center gap-5">
            {/* Avatar / photo uploader */}
            <div className="relative">
              <UserAvatar
                photoUrl={photoPreview ?? profile.profilePhotoUrl}
                name={profile.fullName}
                size="xl"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full
                  flex items-center justify-center text-xs hover:bg-blue-500 transition-colors
                  border-2 border-slate-900"
                title="Change photo"
              >
                📷
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{profile.fullName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <RoleBadge role={profile.role} />
                {profile.designation && (
                  <span className="text-slate-400 text-sm">{profile.designation}</span>
                )}
              </div>
              {profile.department && (
                <p className="text-slate-500 text-xs mt-1">🏢 {profile.department}</p>
              )}
              <p className="text-slate-600 text-xs mt-1">Member since {memberSince}</p>
            </div>
          </div>

          {/* Pending photo upload banner */}
          {photoFile && (
            <div className="mt-4 flex items-center gap-3 bg-blue-500/10 border border-blue-500/30
              rounded-xl px-4 py-2.5">
              <span className="text-blue-400 text-sm flex-1">
                New photo selected: {photoFile.name}
              </span>
              <button
                onClick={() => photoMutation.mutate(photoFile)}
                disabled={photoMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5
                  rounded-lg transition-colors disabled:opacity-50"
              >
                {photoMutation.isPending ? 'Uploading…' : 'Upload'}
              </button>
              <button
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                className="text-slate-400 hover:text-white text-xs px-2 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Info fields */}
        <div className="p-5">
          {!editing ? (
            // ── View mode ─────────────────────────────────────────────────────
            <>
              <Field icon="📧" label="Email"       value={profile.email} />
              <Field icon="📞" label="Phone"       value={profile.phone} />
              <Field icon="🏢" label="Department"  value={profile.department} />
              <Field icon="💼" label="Designation" value={profile.designation} />
              <Field icon="📅" label="Join Date"   value={joinedStr} />
              <Field icon="👤" label="Reports to"  value={profile.managerName} />
              {profile.bio && (
                <div className="pt-3">
                  <p className="text-xs text-slate-500 mb-1.5">📝 About</p>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                </div>
              )}
            </>
          ) : (
            // ── Edit mode ─────────────────────────────────────────────────────
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1.5 block">Full Name</label>
                  <input
                    value={form.fullName ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl
                      px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {/* Phone */}
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1.5 block">Phone</label>
                  <input
                    value={form.phone ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl
                      px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                      placeholder-slate-600"
                  />
                </div>
                {/* Department */}
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1.5 block">Department</label>
                  <input
                    value={form.department ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    placeholder="e.g. Engineering"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl
                      px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                      placeholder-slate-600"
                  />
                </div>
                {/* Designation */}
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1.5 block">Designation</label>
                  <input
                    value={form.designation ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                    placeholder="e.g. Senior Developer"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl
                      px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                      placeholder-slate-600"
                  />
                </div>
                {/* Join Date */}
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1.5 block">Join Date</label>
                  {/* <input
                    type="date"
                    value={form.joinDate ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value || undefined }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl
                      px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  /> */}
                  <DatePicker value={form.joinDate ?? ''}
                    onChange={v => setForm(f => ({ ...f, joinDate: v || undefined }))} />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1.5 block">
                  About / Bio
                </label>
                <textarea
                  value={form.bio ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="A few words about yourself…"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl
                    px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                    placeholder-slate-600 resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400
                    hover:text-white hover:border-slate-600 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white
                    text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving…' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account info — read-only box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Account Info
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Account created</span>
            <span className="text-white">{memberSince}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Role</span>
            <RoleBadge role={profile.role} />
          </div>
          {profile.managerName && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Reports to</span>
              <span className="text-white">{profile.managerName}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status</span>
            <span className={profile.isActive ? 'text-emerald-400' : 'text-red-400'}>
              {profile.isActive ? '✅ Active' : '❌ Inactive'}
            </span>
          </div>
        </div>
        <p className="text-slate-600 text-xs mt-4">
          To change your email, role, or password — contact your manager or use Security settings.
        </p>
      </div>
    </div>
  );
};