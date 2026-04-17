import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import { Plus, Trash, CaretRight } from '@phosphor-icons/react';

export default function Categories() {
  const [categories, setCategories] = useState(() => getCached('categories') || []);
  const [loading, setLoading] = useState(!getCached('categories'));
  const [activeTab, setActiveTab] = useState('expense');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', parent_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    api.get('/api/categories').then(data => { setCategories(data); setCache('categories', data); }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const parentCats = categories.filter(c => !c.parent_id && c.category_type === activeTab);
  const getSubcats = (parentId) => categories.filter(c => c.parent_id === parentId);
  const selectedParent = form.parent_id ? categories.find(c => c.category_id === form.parent_id) : null;

  const openAddSubcategory = (parent) => {
    // Make sure we're on the right tab so the parent shows in the dropdown options
    if (parent.category_type && parent.category_type !== activeTab) setActiveTab(parent.category_type);
    setForm({ name: '', parent_id: parent.category_id });
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm({ name: '', parent_id: '' });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      await api.post('/api/categories', {
        name: form.name.trim(),
        category_type: activeTab,
        parent_id: form.parent_id || null,
      });
      closeForm();
      load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.del(`/api/categories/${id}`);
      load();
    } catch (err) { alert(err.message); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)' };

  return (
    <div data-testid="categories-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Categories</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Manage income and expense categories</p>
        </div>
        <button data-testid="add-category-btn" onClick={() => { if (showForm) closeForm(); else { setForm({ name: '', parent_id: '' }); setShowForm(true); } }} style={{
          background: 'var(--brand-primary)', color: '#fff', border: 'none',
          padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Plus size={14} weight="bold" /> Add Category
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
        {['expense', 'income'].map(tab => (
          <button key={tab} data-testid={`tab-${tab}`} onClick={() => {
            setActiveTab(tab);
            // If the form is open with a parent that doesn't belong to the new tab, clear the preselected parent
            if (selectedParent && selectedParent.category_type !== tab) setForm(f => ({ ...f, parent_id: '' }));
          }}
            style={{
              padding: '10px 24px', border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent-1)' : '2px solid transparent',
              background: 'transparent', cursor: 'pointer', fontSize: 14,
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)', textTransform: 'capitalize', transition: 'all 0.15s'
            }}>
            {tab} Categories
          </button>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div data-testid="add-category-form" style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 24, marginBottom: 24
        }}>
          {selectedParent && (
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Adding sub-category under <span style={{ color: 'var(--text-primary)' }}>{selectedParent.name}</span>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Name *</label>
                <input data-testid="category-name-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  style={inputStyle} placeholder="Category name" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Parent Category (leave empty for top-level)</label>
                <select data-testid="category-parent-select" value={form.parent_id} onChange={e => setForm(f => ({...f, parent_id: e.target.value}))}
                  style={inputStyle}>
                  <option value="">None (Top-level)</option>
                  {parentCats.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button data-testid="save-category-btn" type="submit" disabled={saving} style={{
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
                padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)'
              }}>{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={closeForm} style={{
                background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                padding: '10px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)'
              }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Categories Tree */}
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      ) : parentCats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No categories yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {parentCats.map(cat => {
            const subcats = getSubcats(cat.category_id);
            return (
              <div key={cat.category_id} style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                <div data-testid={`category-${cat.category_id}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 20px', background: subcats.length ? 'var(--bg-secondary)' : '#fff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {subcats.length > 0 && <CaretRight size={14} style={{ color: 'var(--text-muted)' }} />}
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{cat.name}</span>
                    {subcats.length > 0 && (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>({subcats.length})</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button data-testid={`add-subcategory-${cat.category_id}`} onClick={() => openAddSubcategory(cat)}
                      title="Add sub-category"
                      style={{
                        background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                        padding: '4px 10px', borderRadius: 2, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'var(--font-body)', display: 'inline-flex', alignItems: 'center', gap: 4
                      }}>
                      <Plus size={11} weight="bold" /> Sub
                    </button>
                    <button data-testid={`delete-category-${cat.category_id}`} data-guard onClick={() => handleDelete(cat.category_id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
                {subcats.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    {subcats.map(sub => (
                      <div key={sub.category_id} data-testid={`subcategory-${sub.category_id}`} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 20px 10px 44px', borderBottom: '1px solid var(--border-subtle)'
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{sub.name}</span>
                        <button data-testid={`delete-subcategory-${sub.category_id}`} data-guard onClick={() => handleDelete(sub.category_id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <Trash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
