import { useState, useEffect } from 'react';
import { tasksApi } from '../services/api';
import type { TaskLog, CreateTaskDto } from '../types';
import { KanbanBoard } from './Kanbanboard';
import { useConfirm } from '../hooks/useConfirm';

const statusColors: Record<string, string> = {
  InProgress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
  OnHold: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const priorityColors: Record<string, string> = {
  High: 'text-red-400',
  Medium: 'text-amber-400',
  Low: 'text-slate-400',
};

const defaultForm: CreateTaskDto = {
  taskTitle: '',
  description: '',
  projectName: '',
  status: 'InProgress',
  timeSpentMinutes: 0,
  priority: 'Medium',
  tags: '',
};

export const TasksPage = () => {
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<TaskLog | null>(null);
  const [form, setForm] = useState<CreateTaskDto>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('All');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const { confirm } = useConfirm();

  const load = async () => {
    try {
      const res = await tasksApi.getToday();
      setTasks(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
    const ok = await confirm('This task will be permanently deleted.', {
      title:       'Delete Task?',
      confirmText: 'Yes, delete',
      danger:      true,
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

  // Update state immediately (optimistic UI)
  setTasks(prev =>
    prev.map(t =>
      t.id === id ? { ...t, status: status as any } : t
    )
  );
};

  const filtered = filter === 'All' ? tasks : tasks.filter(t => t.status === filter);

  const completed = tasks.filter(t => t.status === 'Completed').length;
  const totalTime = tasks.reduce((sum, t) => sum + t.timeSpentMinutes, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Today's Tasks</h1>
          <p className="text-slate-400 text-sm mt-1">
            {completed}/{tasks.length} completed · {Math.floor(totalTime / 60)}h {totalTime % 60}m logged
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditTask(null); setForm(defaultForm); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Task
        </button>
      </div>
      {/*Kanban View Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              view === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            📋 List View
          </button>

          <button
            onClick={() => setView('kanban')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              view === 'kanban'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            🗂 Kanban View
          </button>
        </div>
      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {['All', 'InProgress', 'Completed', 'Blocked', 'OnHold'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {s === 'All' ? `All (${tasks.length})` : `${s} (${tasks.filter(t => t.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-5">
          <h3 className="text-white font-semibold mb-4">{editTask ? 'Edit Task' : 'Add New Task'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Task Title *</label>
                <input
                  required
                  value={form.taskTitle}
                  onChange={e => setForm({ ...form, taskTitle: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What did you work on?"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Project</label>
                <input
                  value={form.projectName}
                  onChange={e => setForm({ ...form, projectName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Project name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Time Spent (minutes)</label>
                <input
                  type="number"
                  min={0}
                  value={form.timeSpentMinutes}
                  onChange={e => setForm({ ...form, timeSpentMinutes: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="InProgress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Blocked">Blocked</option>
                  <option value="OnHold">On Hold</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Brief description..."
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">Tags (comma separated)</label>
                <input
                  value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="bug-fix, api, frontend..."
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {saving ? 'Saving...' : editTask ? 'Update Task' : 'Add Task'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditTask(null); }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task List */}
      {view === 'list' ? (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl">
              <div className="text-3xl mb-3">📋</div>
              <p className="text-slate-400">No tasks yet. Add your first task!</p>
            </div>
          ) : (
            <div className="space-y-2">
                {filtered.map(task => (
                  <div key={task.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition group">
                    <div className="flex items-start gap-3">
                      {/* Quick complete toggle */}
                      <button
                        onClick={() => handleQuickStatus(task, task.status === 'Completed' ? 'InProgress' : 'Completed')}
                        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
                          task.status === 'Completed'
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-slate-600 hover:border-emerald-500'
                        }`}
                      >
                        {task.status === 'Completed' && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium ${task.status === 'Completed' ? 'line-through text-slate-500' : 'text-white'}`}>
                            {task.taskTitle}
                          </p>
                          <span className={`text-xs border px-2 py-0.5 rounded-lg ${statusColors[task.status]}`}>
                            {task.status}
                          </span>
                          <span className={`text-xs font-medium ${priorityColors[task.priority]}`}>
                            {task.priority}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-500 mt-1 truncate">{task.description}</p>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          {task.projectName && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                              {task.projectName}
                            </span>
                          )}
                          <span>⏱ {task.timeSpentMinutes}m</span>
                          {task.tags && task.tags.split(',').map(tag => (
                            <span key={tag} className="bg-slate-800 px-2 py-0.5 rounded">{tag.trim()}</span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleEdit(task)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      ) : (
        <KanbanBoard
          tasks={tasks}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
};