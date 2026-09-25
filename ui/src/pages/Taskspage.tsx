import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus,
  Clock,
  CheckCircle2,
  Folder,
  Tag,
  Pencil,
  Trash2,
  Check,
  X,
  PlayCircle,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { tasksApi } from '../services/api';
import type { TaskLog, CreateTaskDto } from '../types';
import { KanbanBoard } from './Kanbanboard';
import { useConfirm } from '../hooks/useConfirm';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  FilterBar,
  ViewMode
} from '../components/ui';

const defaultForm: CreateTaskDto = {
  taskTitle: '',
  description: '',
  projectName: '',
  status: 'InProgress',
  timeSpentMinutes: 0,
  priority: 'Medium',
  tags: '',
};

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<TaskLog | null>(null);
  const [form, setForm] = useState<CreateTaskDto>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const { confirm } = useConfirm();

  const load = async () => {
    try {
      const res = await tasksApi.getToday();
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (location.state?.openAddModal || location.state?.action === 'open_add_modal') {
      setShowForm(true);
      setEditTask(null);
      setForm(defaultForm);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTask) {
        await tasksApi.update(editTask.id, form);
      } else {
        await tasksApi.create(form);
      }
      setForm(defaultForm);
      setShowForm(false);
      setEditTask(null);
      await load();
    } catch (err) {
      console.error('Failed to save task', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (task: TaskLog) => {
    setEditTask(task);
    setForm({
      taskTitle: task.taskTitle,
      description: task.description ?? '',
      projectName: task.projectName ?? '',
      status: task.status,
      timeSpentMinutes: task.timeSpentMinutes,
      priority: task.priority,
      tags: task.tags ?? '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm('This task log will be permanently deleted.', {
      title: 'Delete Task?',
      confirmText: 'Yes, delete',
      danger: true,
    });
    if (!ok) return;
    await tasksApi.delete(id);
    await load();
  };

  const handleQuickStatus = async (task: TaskLog, status: string) => {
    await tasksApi.update(task.id, { status });
    await load();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await tasksApi.update(id, { status });
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, status: status as any } : t))
    );
  };

  const completedCount = tasks.filter(t => t.status === 'Completed').length;
  const inProgressCount = tasks.filter(t => t.status === 'InProgress').length;
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.timeSpentMinutes || 0), 0);
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesFilter = filter === 'All' || task.status === filter;
      if (!matchesFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        task.taskTitle.toLowerCase().includes(q) ||
        (task.projectName && task.projectName.toLowerCase().includes(q)) ||
        (task.tags && task.tags.toLowerCase().includes(q)) ||
        (task.description && task.description.toLowerCase().includes(q))
      );
    });
  }, [tasks, filter, search]);

  const filterOptions = [
    { key: 'All', label: 'All Tasks', count: tasks.length },
    { key: 'InProgress', label: 'In Progress', count: inProgressCount },
    { key: 'Completed', label: 'Completed', count: completedCount },
    { key: 'Blocked', label: 'Blocked', count: tasks.filter(t => t.status === 'Blocked').length },
    { key: 'OnHold', label: 'On Hold', count: tasks.filter(t => t.status === 'OnHold').length },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Today's Tasks"
        description="Plan, log, and track your daily work allocations and sprint accomplishments."
        badge={{
          label: `${completionRate}% Done Today`,
          variant: completionRate === 100 ? 'emerald' : 'blue',
          icon: <Sparkles className="w-3.5 h-3.5" />,
        }}
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Tasks' },
        ]}
        actions={
          <button
            onClick={() => {
              setEditTask(null);
              setForm(defaultForm);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Tasks"
          value={tasks.length}
          subtitle="Assigned for today"
          icon={BarChart3}
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Completed"
          value={completedCount}
          subtitle={`${completionRate}% completion rate`}
          icon={CheckCircle2}
          color="emerald"
          trend={{
            value: `${completionRate}%`,
            isPositive: completionRate >= 50,
            label: 'velocity',
          }}
          loading={loading}
        />
        <StatCard
          title="In Progress"
          value={inProgressCount}
          subtitle="Currently active"
          icon={PlayCircle}
          color="indigo"
          loading={loading}
        />
        <StatCard
          title="Time Logged"
          value={`${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`}
          subtitle="Productive hours"
          icon={Clock}
          color="purple"
          loading={loading}
        />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title, project, or tags..."
        filters={filterOptions}
        activeFilter={filter}
        onFilterChange={setFilter}
        viewMode={view}
        onViewModeChange={setView}
        supportedViewModes={['list', 'kanban']}
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-7 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editTask ? 'Edit Task Log' : 'Create New Task'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {editTask ? 'Modify task details and logged minutes' : 'Log a new task assignment for today'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditTask(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={form.taskTitle}
                  onChange={e => setForm({ ...form, taskTitle: e.target.value })}
                  placeholder="e.g., Integrate OAuth provider / Refactor API responses"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Project / Module
                  </label>
                  <input
                    type="text"
                    value={form.projectName}
                    onChange={e => setForm({ ...form, projectName: e.target.value })}
                    placeholder="e.g., DailyTracker v2"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Time Spent (Minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.timeSpentMinutes}
                    onChange={e => setForm({ ...form, timeSpentMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  >
                    <option value="InProgress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Blocked">Blocked</option>
                    <option value="OnHold">On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Description / Deliverables
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Key outputs, challenges faced, pull request links..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  placeholder="backend, bug-fix, sprint-12"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditTask(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition shadow-md shadow-blue-500/20"
                >
                  {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? 'Saving...' : editTask ? 'Update Task' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === 'list' ? (
        <>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading daily tasks...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-3">
                <Folder className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No tasks found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {search ? 'Try clearing your search terms or filters.' : 'Get started by creating your first task log for today.'}
              </p>
              {!search && (
                <button
                  onClick={() => {
                    setEditTask(null);
                    setForm(defaultForm);
                    setShowForm(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 border border-blue-500/20 transition"
                >
                  <Plus className="w-4 h-4" />
                  Add First Task
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const isCompleted = task.status === 'Completed';

                return (
                  <div
                    key={task.id}
                    className={`group relative rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
                      isCompleted
                        ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 opacity-90'
                        : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickStatus(task, isCompleted ? 'InProgress' : 'Completed')
                        }
                        title={isCompleted ? 'Mark as In Progress' : 'Mark as Completed'}
                        className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          isCompleted
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                            : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500 text-transparent hover:text-emerald-500'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4
                            className={`text-sm sm:text-base font-semibold leading-snug break-words ${
                              isCompleted
                                ? 'line-through text-slate-500 dark:text-slate-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {task.taskTitle}
                          </h4>
                          <StatusBadge status={task.status} size="xs" />
                          <StatusBadge
                            status={task.priority}
                            label={`Priority: ${task.priority}`}
                            size="xs"
                            showDot={false}
                          />
                        </div>

                        {task.description && (
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 sm:gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          {task.projectName && (
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                              <Folder className="w-3.5 h-3.5 text-blue-500" />
                              {task.projectName}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-purple-500" />
                            {task.timeSpentMinutes} mins logged
                          </span>

                          {task.tags &&
                            task.tags.split(',').map((tag, idx) => {
                              const trimmed = tag.trim();
                              if (!trimmed) return null;
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60"
                                >
                                  <Tag className="w-3 h-3 text-slate-400" />
                                  {trimmed}
                                </span>
                              );
                            })}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleEdit(task)}
                          title="Edit Task"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          title="Delete Task"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
          <KanbanBoard
            tasks={tasks}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        </div>
      )}
    </div>
  );
};
export default TasksPage;