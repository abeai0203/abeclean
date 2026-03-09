import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { LayoutDashboard, Home, Users, MapPin, Plus, Clock, User, Star, Mop } from 'lucide-react';

const App = () => {
  const [view, setView] = useState('dashboard');
  const [filterArea, setFilterArea] = useState('all');
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties();
    const subscription = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, fetchProperties)
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  async function fetchProperties() {
    const { data, error } = await supabase.from('properties').select('*');
    if (data) setProperties(data);
    setLoading(false);
  }

  const filteredProperties = filterArea === 'all'
    ? properties
    : properties.filter(p => p.area === filterArea);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-10">
          <Mop className="w-8 h-8 text-fuchsia-600" />
          <h1 className="text-xl font-extrabold tracking-tight">OPS AIRBNB</h1>
        </div>

        <nav className="space-y-1 flex-1">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Main</div>
          <button
            onClick={() => setView('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'dashboard' ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-200' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-semibold text-sm">Dashboard</span>
          </button>

          <div className="pt-6 text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Areas</div>
          {['all', 'Shah Alam', 'Puchong'].map(area => (
            <button
              key={area}
              onClick={() => {
                setFilterArea(area);
                setView('dashboard');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${filterArea === area && view === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <MapPin size={20} />
              <span className="font-semibold text-sm">{area === 'all' ? 'All Areas' : area}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              {view === 'dashboard' ? 'Operations Dashboard' : 'Team Hub'}
            </h2>
            <p className="text-slate-500 mt-1 font-medium italic">Viewing focus: {filterArea}</p>
          </div>
          <button className="flex items-center gap-2 bg-fuchsia-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-fuchsia-700 transition-all shadow-lg shadow-fuchsia-100">
            <Plus size={20} />
            <span>New Task</span>
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map(unit => (
              <div key={unit.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:shadow-2xl hover:shadow-slate-200 transition-all group">
                <div className={`h-1.5 w-full ${unit.priority === 'High' ? 'bg-rose-500' : 'bg-fuchsia-500'}`} />
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${unit.area === 'Shah Alam' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-sky-50 text-sky-600 border border-sky-100'}`}>
                      {unit.area}
                    </span>
                    <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-amber-100">
                      {unit.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-4 group-hover:text-fuchsia-600 transition-colors">{unit.name}</h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-slate-500">
                      <Clock size={16} className="text-fuchsia-400" />
                      <span className="text-sm font-medium">Checkout: <strong className="text-slate-700">{unit.checkout_time}</strong></span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500">
                      <User size={16} className="text-fuchsia-400" />
                      <span className="text-sm font-medium">Assignee: <strong className="text-slate-700">Unassigned</strong></span>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center group-hover:bg-fuchsia-50 transition-colors">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority: {unit.priority}</span>
                  <button className="text-xs font-bold text-fuchsia-600 hover:text-fuchsia-800 underline underline-offset-4">Manage Unit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
