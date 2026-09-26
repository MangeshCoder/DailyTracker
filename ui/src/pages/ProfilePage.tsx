// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/ProfilePage.tsx
//  My Profile - Modern Design System Upgrade
//
//  Logic unchanged from previous version:
//  ✅ View / edit profile (name, phone, department, designation, join date, bio)
//  ✅ Photo upload with preview + confirm
//  ✅ Exports UserAvatar + RoleBadge (also used by Directorypage.tsx)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '../services/api';
import type { UserProfile, UpdateProfileDto } from '../types';
import { DatePicker } from '../components/DatePicker';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import {
  Pencil,
  Camera,
  Mail,
  Phone,
  Building2,
  Briefcase,
  CalendarDays,
  UserRound,
  FileText,
  Save,
  X,
  Loader2,
  Upload,
  ShieldCheck,
  Clock,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

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
        src={photoUrl.startsWith('http') || photoUrl.startsWith('blob:') ? photoUrl : `${BACKEND_ORIGIN}${photoUrl}`}
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
  Manager:   'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',
  TeamLead:  'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  Developer: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
};

export const RoleBadge = ({ role }: { role: string }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border
      ${ROLE_STYLE[role] ?? 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30'}`}
  >
    {role}
  </span>
);

// ─── Field row (view mode) ─────────────────────────────────────────────────────
const Field = ({ label, value, icon: Icon }: { label: string; value?: string | null; icon: React.ElementType }) => (
  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-sm mt-0.5 truncate ${value ? 'font-semibold text-slate-900 dark:text-white' : 'italic text-slate-400 dark:text-slate-500'}`}>
        {value || 'Not set'}
      </p>
    </div>
  </div>
);

// ─── Shared input styles ──────────────────────────────────────────────────────
const INPUT_CLS =
  'w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-3.5 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';
const LABEL_CLS = 'block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5';

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
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 bg-slate-100 dark:bg-slate-800/60 rounded-3xl animate-pulse" />
          <div className="lg:col-span-2 h-80 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
        </div>
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="My Profile"
        description="Manage your personal information and how teammates see you."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Account' },
          { label: 'My Profile' },
        ]}
        badge={{ label: profile.role, variant: 'purple', icon: <ShieldCheck className="w-3 h-3" /> }}
        actions={
          !editing ? (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
              Edit Profile
            </button>
          ) : undefined
        }
        className="!mb-0"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: identity card ── */}
        <div className="space-y-6">
          <Card className="overflow-hidden !rounded-3xl">
            <div className="h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
            <div className="px-6 pb-6 -mt-12 text-center">
              <div className="relative inline-block">
                <div className="ring-4 ring-white dark:ring-slate-900 rounded-full shadow-lg">
                  <UserAvatar
                    photoUrl={photoPreview ?? profile.profilePhotoUrl}
                    name={profile.fullName}
                    size="xl"
                  />
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md transition"
                  title="Change photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-3 truncate">{profile.fullName}</h2>
              {profile.designation && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{profile.designation}</p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <RoleBadge role={profile.role} />
                {profile.department && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-500/5 text-slate-600 dark:text-slate-300 border-slate-500/20">
                    <Building2 className="w-3 h-3" /> {profile.department}
                  </span>
                )}
              </div>
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-3">
                <Clock className="w-3.5 h-3.5" /> Member since {memberSince}
              </p>

              {/* Pending photo upload */}
              {photoFile && (
                <div className="mt-5 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-left">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 truncate">
                    New photo: {photoFile.name}
                  </p>
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => photoMutation.mutate(photoFile)}
                      disabled={photoMutation.isPending}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {photoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {photoMutation.isPending ? 'Uploading…' : 'Upload'}
                    </button>
                    <button
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Account info */}
          <Card>
            <CardContent>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                Account Info
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-400">Account created</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{memberSince}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-400">Role</span>
                  <RoleBadge role={profile.role} />
                </div>
                {profile.managerName && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 dark:text-slate-400">Reports to</span>
                    <span className="font-semibold text-slate-900 dark:text-white truncate">{profile.managerName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-400">Status</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    profile.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {profile.isActive ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {profile.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                To change your email, role, or password — contact your manager or use Security settings.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: details / edit form ── */}
        <Card className="lg:col-span-2 h-fit">
          <CardContent>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {editing ? <Pencil className="w-4 h-4" /> : <UserRound className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editing ? 'Edit Personal Details' : 'Personal Details'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editing ? 'Update your information and save' : 'Visible to your team in the directory'}
                </p>
              </div>
            </div>

            {!editing ? (
              // ── View mode ───────────────────────────────────────────────────
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field icon={Mail}         label="Email"       value={profile.email} />
                  <Field icon={Phone}        label="Phone"       value={profile.phone} />
                  <Field icon={Building2}    label="Department"  value={profile.department} />
                  <Field icon={Briefcase}    label="Designation" value={profile.designation} />
                  <Field icon={CalendarDays} label="Join Date"   value={joinedStr} />
                  <Field icon={UserRound}    label="Reports to"  value={profile.managerName} />
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    <FileText className="w-3.5 h-3.5" /> About
                  </p>
                  {profile.bio ? (
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                  ) : (
                    <p className="text-sm italic text-slate-400 dark:text-slate-500">No bio yet — click Edit Profile to add one.</p>
                  )}
                </div>
              </div>
            ) : (
              // ── Edit mode ───────────────────────────────────────────────────
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Full Name</label>
                    <input
                      value={form.fullName ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Phone</label>
                    <input
                      value={form.phone ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Department</label>
                    <input
                      value={form.department ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      placeholder="e.g. Engineering"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Designation</label>
                    <input
                      value={form.designation ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                      placeholder="e.g. Senior Developer"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Join Date</label>
                    <DatePicker
                      value={form.joinDate ?? ''}
                      onChange={v => setForm(f => ({ ...f, joinDate: v || undefined }))}
                    />
                  </div>
                </div>

                <div>
                  <label className={LABEL_CLS}>About / Bio</label>
                  <textarea
                    value={form.bio ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    placeholder="A few words about yourself…"
                    rows={4}
                    className={`${INPUT_CLS} resize-none`}
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                  >
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};