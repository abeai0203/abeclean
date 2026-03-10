import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { LayoutDashboard, Home, Users, MapPin, Plus, Clock, User, Star, Sparkles, Menu, RotateCw, Calendar, CheckCircle, Trash2, ShieldCheck, ChevronDown, MessageCircle, Bell, Camera } from 'lucide-react';

const App = () => {
  const [view, setView] = useState('dashboard');
  const [filterArea, setFilterArea] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [properties, setProperties] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [cleaningTasks, setCleaningTasks] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState('admin');
  const [currentCleanerId, setCurrentCleanerId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showCleanerModal, setShowCleanerModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState('list'); // 'list' or 'grid'

  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingCleaner, setEditingCleaner] = useState(null);
  const [activePopoverDate, setActivePopoverDate] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  const [activeCleanerTask, setActiveCleanerTask] = useState(null);
  const [showChecklistSettings, setShowChecklistSettings] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [reviewTask, setReviewTask] = useState(null);
  const [loadingCleanerTask, setLoadingCleanerTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [newUnit, setNewUnit] = useState({
    name: '',
    area: 'Shah Alam',
    status: 'Ready',
    priority: 'Normal',
    checkout_time: '12:00 PM',
    ical_url: '',
    bookings: []
  });

  const [newCleaner, setNewCleaner] = useState({
    name: '',
    phone: '',
    role: 'cleaner',
    head_cleaner_id: '',
    avatar_url: ''
  });

  useEffect(() => {
    fetchData();
    const subscription = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, fetchProperties)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_tasks' }, fetchCleaningTasks)
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  // Persistent Progress for Cleaner View
  useEffect(() => {
    if (activeCleanerTask?.id) {
      const saved = localStorage.getItem(`task_${activeCleanerTask.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setActiveCleanerTask(prev => ({
            ...prev,
            checklist_responses: parsed.checklist_responses || prev.checklist_responses,
            proof_images: parsed.proof_images || prev.proof_images
          }));
        } catch (e) {
          console.error('Error loading saved task progress:', e);
        }
      }
    }
  }, [activeCleanerTask?.id]);

  useEffect(() => {
    if (activeCleanerTask?.id && activeCleanerTask.status !== 'completed') {
      const dataToSave = {
        checklist_responses: activeCleanerTask.checklist_responses,
        proof_images: activeCleanerTask.proof_images
      };
      localStorage.setItem(`task_${activeCleanerTask.id}`, JSON.stringify(dataToSave));
    }
  }, [activeCleanerTask?.checklist_responses, activeCleanerTask?.proof_images]);
  // Check for task_id in URL for cleaner mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('task_id');
    if (taskId) {
      setLoadingCleanerTask(true);
      loadCleanerTask(taskId).finally(() => setLoadingCleanerTask(false));
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.calendar-day-cell')) {
        setActivePopoverDate(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProperties(),
        fetchCleaners(),
        fetchCleaningTasks(),
        fetchChecklistItems()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('priority', { ascending: false });

    if (error) console.error('Error fetching properties:', error);
    else setProperties(data || []);
  };

  const fetchCleaners = async () => {
    const { data, error } = await supabase
      .from('cleaners')
      .select('*')
      .order('name');

    if (error) console.error('Error fetching cleaners:', error);
    else setCleaners(data || []);
  };

  const fetchCleaningTasks = async () => {
    const { data, error } = await supabase
      .from('cleaning_tasks')
      .select('*, cleaners(name, avatar_url, phone)');

    if (error) console.error('Error fetching tasks:', error);
    else {
      setCleaningTasks(data || []);
      // Update notifications: tasks completed but not viewed
      const unviewed = (data || []).filter(t => t.completed_at && !t.viewed_at);
      setNotifications(unviewed);
    }
  };

  const compressImage = async (file) => {
    // Wait longer for browser/OS to recover after camera-to-browser transition
    // Especially important for high-spec phones with heavy camera apps like Honor
    await new Promise(r => setTimeout(r, 1500));

    try {
      const MAX_SIZE = 512;

      // Attempt modern createImageBitmap resize
      let bitmap;
      try {
        bitmap = await createImageBitmap(file, {
          resizeWidth: MAX_SIZE,
          resizeQuality: 'low'
        });
      } catch (e) {
        // Fallback to legacy Image decoding
        return new Promise((resolve) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.src = url;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height, 1);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
              resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
            }, 'image/jpeg', 0.5);
          };
          img.onerror = () => resolve(file);
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          canvas.width = 0;
          canvas.height = 0;
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', 0.5);
      });
    } catch (e) {
      console.warn('Compression failed, using original', e);
      return file;
    }
  };

  const fetchChecklistItems = async () => {
    const { data, error } = await supabase
      .from('checklist_items')
      .select('*')
      .order('category', { ascending: false });

    if (error || !data || data.length === 0) {
      console.warn('Using fallback checklist items');
      setChecklistItems([
        { id: 101, category: 'Ruang Tamu', item_text: 'Vakum/Mop lantai' },
        { id: 102, category: 'Ruang Tamu', item_text: 'Lap meja & kabinet' },
        { id: 103, category: 'Bilik', item_text: 'Tukar cadar & sarung bantal' },
        { id: 104, category: 'Tandas', item_text: 'Cuci mangkuk tandas' }
      ]);
    } else {
      setChecklistItems(data);
    }
  };

  const loadCleanerTask = async (taskId) => {
    try {
      // First get the task
      const { data: task, error: taskError } = await supabase
        .from('cleaning_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;

      // Then get cleaner and property details separately for maximum reliability
      const [cleanerRes, propertyRes] = await Promise.all([
        supabase.from('cleaners').select('name, phone').eq('id', task.cleaner_id).single(),
        supabase.from('properties').select('*').eq('id', task.property_id).single()
      ]);

      setActiveCleanerTask({
        ...task,
        cleaners: cleanerRes.data,
        properties: propertyRes.data
      });
    } catch (err) {
      console.error('Error loading cleaner task:', err.message);
      // Even if details fail, show the task frame
    }
  };

  async function handleAddUnit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('properties').insert([newUnit]);
      if (error) throw error;

      setShowNewTaskModal(false);
      setNewUnit({ name: '', area: 'Shah Alam', status: 'Ready', priority: 'Normal', checkout_time: '12:00 PM', ical_url: '', bookings: [] });
      fetchProperties();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateUnit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('properties')
        .update({
          name: selectedUnit.name,
          area: selectedUnit.area,
          priority: selectedUnit.priority,
          status: selectedUnit.status,
          checkout_time: selectedUnit.checkout_time,
          ical_url: selectedUnit.ical_url
        })
        .eq('id', selectedUnit.id);
      if (error) throw error;
      setShowManageModal(false);
      fetchProperties();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUnit() {
    if (!confirm('Are you sure you want to delete this property?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('properties').delete().eq('id', selectedUnit.id);
      if (error) throw error;
      setShowManageModal(false);
      fetchProperties();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCleanerSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanerData = editingCleaner ? {
        name: editingCleaner.name,
        phone: editingCleaner.phone,
        role: editingCleaner.role,
        head_cleaner_id: editingCleaner.head_cleaner_id || null,
        avatar_url: editingCleaner.avatar_url || null
      } : {
        name: newCleaner.name,
        phone: newCleaner.phone,
        role: newCleaner.role,
        head_cleaner_id: newCleaner.head_cleaner_id || null,
        avatar_url: newCleaner.avatar_url || null
      };

      if (editingCleaner) {
        const { error } = await supabase.from('cleaners').update(cleanerData).eq('id', editingCleaner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cleaners').insert([cleanerData]);
        if (error) throw error;
      }

      setShowCleanerModal(false);
      setNewCleaner({ name: '', phone: '', role: 'cleaner', head_cleaner_id: '', avatar_url: '' });
      setEditingCleaner(null);
      fetchCleaners();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAvatarUpload(e, isEditing = false) {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (isEditing) {
        setEditingCleaner({ ...editingCleaner, avatar_url: publicUrl });
      } else {
        setNewCleaner({ ...newCleaner, avatar_url: publicUrl });
      }
    } catch (err) {
      alert('Upload failed: ' + err.message + '\nNote: Please ensure you have created a public bucket named "avatars" in Supabase Storage.');
    } finally {
      setLoading(false);
    }
  }

  const openAssignModal = (booking) => {
    console.log('Opening assign modal for:', booking);
    const unit = properties.find(p => String(p.id) === String(booking.propertyId));
    setSelectedUnit(unit);
    setSelectedBooking(booking);
    setShowAssignModal(true);
  };

  async function handleAssignCleaner(cleanerId) {
    if (!selectedBooking) {
      alert('Error: No booking selected');
      return;
    }
    setLoading(true);
    try {
      const end = new Date(selectedBooking.end);
      const checkoutDate = end.toISOString().split('T')[0];
      const propertyId = selectedBooking.propertyId;

      if (!propertyId || !cleanerId) {
        throw new Error(`Technical Error: Missing ${!propertyId ? 'Property ID' : 'Cleaner ID'}. Please refresh and try again.`);
      }

      console.log('Assigning/Updating task:', { propertyId, checkoutDate, cleanerId });

      // Check if task already exists for this property and date
      const { data: existingTask, error: fetchError } = await supabase
        .from('cleaning_tasks')
        .select('id')
        .eq('property_id', propertyId)
        .eq('checkout_date', checkoutDate)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingTask) {
        // Update existing task
        const { error: updateError } = await supabase
          .from('cleaning_tasks')
          .update({ cleaner_id: cleanerId })
          .eq('id', existingTask.id);

        if (updateError) throw updateError;
      } else {
        // Insert new task
        const { error: insertError } = await supabase.from('cleaning_tasks').insert([{
          property_id: propertyId,
          checkout_date: checkoutDate,
          cleaner_id: cleanerId,
          status: 'pending',
          checklist: [
            { task: 'Change bedsheet & pillow covers', done: false },
            { task: 'Clean bathroom & refill toiletries', done: false },
            { task: 'Vacuum & mop floors', done: false },
            { task: 'Check for damages/left items', done: false }
          ]
        }]);

        if (insertError) throw insertError;
      }

      setShowAssignModal(false);
      await fetchCleaningTasks();
      alert(existingTask ? 'Cleaner updated successfully!' : 'Cleaner assigned successfully!');
    } catch (err) {
      console.error('Assignment/Update error:', err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleImageUpload = async (file) => {
    if (!file || !activeCleanerTask) return;

    // Non-blocking UI update (don't use setLoading which re-renders everything immediately)
    // Just show a simple native alert if it starts taking too long
    try {
      const compressedFile = await compressImage(file);
      const fileExt = compressedFile.type.split('/')[1] || 'jpg';
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `proofs/${activeCleanerTask.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, compressedFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      setActiveCleanerTask(prev => {
        const newImgs = [...(prev.proof_images || []), publicUrl];
        return { ...prev, proof_images: newImgs };
      });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Gagal hantar gambar. Sila pastikan internet okey dan cuba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const syncAirbnb = async (unit) => {
    if (!unit.ical_url) {
      alert('Please add an Airbnb iCal link first.');
      return;
    }
    setLoading(true);
    try {
      const proxyUrl = `/fetch-ical?url=${encodeURIComponent(unit.ical_url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
      const data = await response.text();
      const events = data.split('BEGIN:VEVENT');
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      let bookings = [];
      let latestCheckout = null;

      events.forEach(event => {
        const dtStartMatch = event.match(/DTSTART;VALUE=DATE:(\d{8})/);
        const dtEndMatch = event.match(/DTEND;VALUE=DATE:(\d{8})/);
        const summaryMatch = event.match(/SUMMARY:(.*)/);

        if (dtStartMatch && dtEndMatch) {
          const startStr = dtStartMatch[1];
          const endStr = dtEndMatch[1];
          const startDate = new Date(parseInt(startStr.substring(0, 4)), parseInt(startStr.substring(4, 6)) - 1, parseInt(startStr.substring(6, 8)));
          const endDate = new Date(parseInt(endStr.substring(0, 4)), parseInt(endStr.substring(4, 6)) - 1, parseInt(endStr.substring(6, 8)));
          const summary = summaryMatch ? summaryMatch[1].trim() : 'Reserved';

          if (summary === 'Reserved' && endDate >= now) {
            bookings.push({ start: startDate.toISOString(), end: endDate.toISOString(), summary: 'Guest Booking' });
            if (!latestCheckout || (endDate > now && endDate < latestCheckout)) latestCheckout = endDate;
          }
        }
      });

      bookings.sort((a, b) => new Date(a.start) - new Date(b.start));
      const updateData = { bookings };

      await supabase.from('properties').update(updateData).eq('id', unit.id);
      alert(`Synced successfully! ${bookings.length} bookings found.`);
      fetchProperties();
    } catch (err) {
      alert(`Sync Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Isolation for Cleaner View to save maximum memory on mobile devices
  if (activeCleanerTask || loadingCleanerTask) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto">
          <div className="max-w-xl mx-auto min-h-screen bg-white shadow-2xl flex flex-col">
            {loadingCleanerTask ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-airbnb rounded-full animate-spin" />
                <p className="font-bold text-slate-400">Memuatkan tugasan...</p>
              </div>
            ) : activeCleanerTask ? (
              <>
                <header className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Sahkan Tugasan</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeCleanerTask.properties?.name}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-airbnb">
                    <Sparkles size={20} />
                  </div>
                </header>

                <main className="flex-1 p-6 space-y-8">
                  {activeCleanerTask.status === 'completed' ? (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                        <CheckCircle size={40} />
                      </div>
                      <h2 className="text-2xl font-black text-slate-900">Tugasan Selesai!</h2>
                      <p className="text-slate-500 font-medium">Terima kasih atas kerjasama anda. Laporan telah dihantar kepada admin.</p>
                      <button onClick={() => window.location.href = '/'} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold">Kembali</button>
                    </div>
                  ) : (
                    <>
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Senarai Semak</h3>
                          <button
                            onClick={() => {
                              const allIds = checklistItems.reduce((acc, item) => ({ ...acc, [item.id]: true }), {});
                              setActiveCleanerTask({ ...activeCleanerTask, checklist_responses: allIds });
                            }}
                            className="text-xs font-black text-airbnb uppercase tracking-widest"
                          >
                            Tanda Semua
                          </button>
                        </div>
                        <div className="space-y-6">
                          {Array.from(new Set(checklistItems.map(i => i.category))).map(cat => (
                            <div key={cat} className="space-y-3">
                              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{cat}</h4>
                              <div className="space-y-2">
                                {checklistItems.filter(i => i.category === cat).map(item => (
                                  <label key={item.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 cursor-pointer active:bg-slate-100 transition-colors">
                                    <input
                                      type="checkbox"
                                      className="w-6 h-6 rounded-lg border-2 border-slate-200 text-airbnb focus:ring-airbnb"
                                      checked={activeCleanerTask.checklist_responses?.[item.id] || false}
                                      onChange={(e) => {
                                        const responses = { ...activeCleanerTask.checklist_responses, [item.id]: e.target.checked };
                                        setActiveCleanerTask({ ...activeCleanerTask, checklist_responses: responses });
                                      }}
                                    />
                                    <span className="font-bold text-slate-700">{item.item_text}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Bukti Gambar (Min 4)</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {(activeCleanerTask.proof_images || []).map((img, idx) => (
                            <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-slate-100 relative group">
                              <img src={img} className="w-full h-full object-cover" />
                              <button
                                onClick={() => {
                                  const newImgs = activeCleanerTask.proof_images.filter((_, i) => i !== idx);
                                  setActiveCleanerTask({ ...activeCleanerTask, proof_images: newImgs });
                                }}
                                className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          {(activeCleanerTask.proof_images || []).length < 8 && (
                            <label className={`aspect-square rounded-2xl border-2 border-dashed ${loading ? 'border-slate-100 bg-slate-50' : 'border-slate-200'} flex flex-col items-center justify-center text-slate-300 hover:border-airbnb hover:text-airbnb transition-all cursor-pointer`}>
                              {loading ? (
                                <div className="w-8 h-8 border-2 border-slate-200 border-t-airbnb rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Camera size={32} />
                                  <span className="text-[10px] font-black uppercase mt-2">Ambil Gambar</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                disabled={loading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </section>

                      <button
                        disabled={loading || (activeCleanerTask.proof_images || []).length < 4}
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const { error } = await supabase
                              .from('cleaning_tasks')
                              .update({
                                status: 'completed',
                                checklist_responses: activeCleanerTask.checklist_responses,
                                proof_images: activeCleanerTask.proof_images,
                                completed_at: new Date().toISOString()
                              })
                              .eq('id', activeCleanerTask.id);
                            if (error) throw error;
                            setActiveCleanerTask({ ...activeCleanerTask, status: 'completed' });
                          } catch (err) { alert(err.message); } finally { setLoading(false); }
                        }}
                        className="w-full py-5 bg-airbnb text-white rounded-[2rem] font-black text-lg shadow-xl shadow-airbnb/20 disabled:grayscale disabled:opacity-50"
                      >
                        HANTAR LAPORAN
                      </button>
                    </>
                  )}
                </main>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4">
                  <Plus size={32} className="rotate-45" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Tugasan Tidak Dijumpai</h2>
                <p className="text-slate-500 font-medium">Link ini tidak sah atau tugasan telah dipadam.</p>
                <button onClick={() => window.location.href = '/'} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold">Ke Dashboard</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">

      {/* Checklist Review Modal */}
      {reviewTask && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Review Tugasan</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{reviewTask.properties?.name} • {reviewTask.cleaners?.name}</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await supabase.from('cleaning_tasks').update({ viewed_at: new Date().toISOString() }).eq('id', reviewTask.id);
                    fetchCleaningTasks();
                    setReviewTask(null);
                  } catch (err) { setReviewTask(null); }
                }}
                className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-2 gap-8 text-sm">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Completed At</p>
                  <p className="font-bold text-slate-700">{new Date(reviewTask.completed_at).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Status</p>
                  <p className="font-bold text-emerald-500 flex items-center gap-2"><CheckCircle size={16} /> Verified</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Checklist Result</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {checklistItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      {reviewTask.checklist_responses?.[item.id] ? <CheckCircle size={14} className="text-emerald-500" /> : <Plus size={14} className="text-rose-400 rotate-45" />}
                      <span className={`font-bold ${reviewTask.checklist_responses?.[item.id] ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{item.item_text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Proof Photos</p>
                <div className="grid grid-cols-2 gap-4">
                  {(reviewTask.proof_images || []).map((img, i) => (
                    <div key={i} className="aspect-square rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                      <img src={img} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <footer className="p-8 bg-slate-50 flex gap-4">
              <button
                onClick={async () => {
                  await supabase.from('cleaning_tasks').update({ viewed_at: new Date().toISOString() }).eq('id', reviewTask.id);
                  fetchCleaningTasks();
                  setReviewTask(null);
                }}
                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20"
              >
                Mark as Reviewed
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Checklist Settings Modal */}
      {showChecklistSettings && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Checklist Settings</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Manage task categories & items</p>
              </div>
              <button onClick={() => setShowChecklistSettings(false)} className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Plus size={24} className="rotate-45" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {['Ruang Tamu', 'Bilik', 'Tandas'].map(cat => (
                <div key={cat} className="space-y-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">{cat}</h4>
                  <div className="space-y-2">
                    {checklistItems.filter(i => i.category === cat).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group">
                        <span className="font-bold text-slate-700">{item.item_text}</span>
                        <button
                          onClick={async () => {
                            await supabase.from('checklist_items').delete().eq('id', item.id);
                            fetchChecklistItems();
                          }}
                          className="p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={`Add item to ${cat}...`}
                        className="flex-1 p-4 rounded-2xl border border-slate-100 bg-white font-bold"
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && e.target.value) {
                            await supabase.from('checklist_items').insert([{ category: cat, item_text: e.target.value }]);
                            e.target.value = '';
                            fetchChecklistItems();
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Mobile Sidebar */}
      <div className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <aside className={`absolute inset-y-0 left-0 w-64 bg-white shadow-2xl p-6 flex flex-col transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-airbnb" />
              <h1 className="text-xl font-extrabold tracking-tight">OPS AIRBNB</h1>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-slate-400"><Plus className="rotate-45" size={24} /></button>
          </div>
          <nav className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Main</div>
            <button onClick={() => { setView('dashboard'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'dashboard' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
              <LayoutDashboard size={20} /> <span className="font-semibold text-sm">Dashboard</span>
            </button>
            <button onClick={() => { setView('calendar'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'calendar' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Calendar size={20} /> <span className="font-semibold text-sm">Calendar</span>
            </button>
            <button
              onClick={() => { setView('settings'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 font-bold group ${view === 'settings' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ${view === 'settings' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-airbnb shadow-sm'}`}><Sparkles size={18} /></div>
              Settings
            </button>
            <button
              onClick={() => { setShowChecklistSettings(true); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 font-bold group text-slate-500 hover:bg-slate-50`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-airbnb shadow-sm`}><CheckCircle size={18} /></div>
              Checklist
            </button>
            <button onClick={() => { setView('cleaners'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'cleaners' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Users size={20} /> <span className="font-semibold text-sm">Cleaners</span>
            </button>
            <div className="pt-6 text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Areas</div>
            {['all', 'Shah Alam', 'Puchong'].map(area => (
              <button key={area} onClick={() => { setFilterArea(area); setView('dashboard'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${filterArea === area && view === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                <MapPin size={20} /> <span className="font-semibold text-sm">{area === 'all' ? 'All Areas' : area}</span>
              </button>
            ))}
          </nav>
        </aside>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 p-6 flex-col">
        <div className="flex items-center gap-3 mb-10">
          <Sparkles className="w-8 h-8 text-airbnb" />
          <h1 className="text-xl font-extrabold tracking-tight">OPS AIRBNB</h1>
        </div>
        <nav className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Main</div>
          <button onClick={() => { setView('dashboard'); setFilterArea('all'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'dashboard' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <LayoutDashboard size={20} /> <span className="font-semibold text-sm">Dashboard</span>
          </button>
          <button onClick={() => { setView('calendar'); setFilterArea('all'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'calendar' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Calendar size={20} /> <span className="font-semibold text-sm">Calendar</span>
          </button>
          <button onClick={() => { setView('cleaners'); setFilterArea('all'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'cleaners' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Users size={20} /> <span className="font-semibold text-sm">Cleaners</span>
          </button>
          <div className="pt-6 text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Areas</div>
          {['all', 'Shah Alam', 'Puchong'].map(area => (
            <button key={area} onClick={() => { setFilterArea(area); setView('dashboard'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${filterArea === area && view === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <MapPin size={20} /> <span className="font-semibold text-sm">{area === 'all' ? 'All Areas' : area}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 min-h-screen">
        <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
          {view === 'dashboard' && (
            <>
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-white rounded-lg"><Menu size={24} /></button>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard</h2>
                </div>

                {/* Stats Section */}
                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                  {(() => {
                    const now = new Date();
                    const currentMonth = now.getMonth();
                    const currentYear = now.getFullYear();

                    const thisMonthBookings = properties.flatMap(p => (p.bookings || []).filter(b => {
                      const end = new Date(b.end);
                      return end.getMonth() === currentMonth && end.getFullYear() === currentYear;
                    }));

                    const doneThisMonth = (cleaningTasks || []).filter(t => {
                      const date = new Date(t.checkout_date);
                      return t.status === 'completed' && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
                    }).length;

                    return (
                      <div className="flex items-center gap-4 bg-white/50 backdrop-blur-sm p-2 rounded-3xl border border-white/50 shadow-sm">
                        <div className="flex items-center gap-4 px-4 py-2 border-r border-slate-100 last:border-0 translate-y-[-1px]">
                          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Total</p><p className="text-lg font-black text-slate-900 leading-tight">{properties.length}</p></div>
                        </div>
                        <div className="flex items-center gap-4 px-4 py-2 border-r border-slate-100 last:border-0 translate-y-[-1px]">
                          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight text-airbnb">This Month</p><p className="text-lg font-black text-slate-900 leading-tight">{thisMonthBookings.length}</p></div>
                        </div>
                        <div className="flex items-center gap-4 px-4 py-2 border-r border-slate-100 last:border-0 translate-y-[-1px]">
                          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight text-emerald-500">Done</p><p className="text-lg font-black text-slate-900 leading-tight">{doneThisMonth}</p></div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="relative">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${notifications.length > 0 ? 'bg-amber-50 text-amber-500 animate-pulse' : 'bg-white border border-slate-100 text-slate-400'}`}
                    >
                      <Bell size={20} />
                      {notifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                          {notifications.length}
                        </span>
                      )}
                    </button>

                    {showNotifications && (
                      <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notifications</h4>
                          <span className="text-[10px] font-black text-airbnb bg-white px-2 py-1 rounded-lg shadow-sm">{notifications.length} New</span>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-10 text-center space-y-2">
                              <p className="font-bold text-slate-300">Tiada notifikasi baru</p>
                            </div>
                          ) : (
                            notifications.map(n => (
                              <button
                                key={n.id}
                                onClick={() => {
                                  setReviewTask(n);
                                  setShowNotifications(false);
                                }}
                                className="w-full p-4 text-left border-b border-slate-50 hover:bg-slate-50 transition-colors flex items-center gap-4 group"
                              >
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                                  <CheckCircle size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-black text-slate-900 truncate">Selesai: {properties.find(p => String(p.id) === String(n.property_id))?.name || 'Unit'}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">{n.cleaners?.name} • {new Date(n.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setShowNewTaskModal(true)} className="w-full md:w-auto bg-airbnb text-white px-8 py-4 rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-airbnb/20 transition-all hover:scale-105 active:scale-95 leading-none">
                    <Plus size={20} strokeWidth={3} /> Add Unit
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-10">
                {properties
                  .filter(p => filterArea === 'all' || p.area === filterArea)
                  .map(p => {
                    const next = (p.bookings || [])
                      .filter(b => new Date(b.end) >= new Date())
                      .sort((a, b) => new Date(a.end) - new Date(b.end))[0];
                    return { ...p, nextCheckout: next ? new Date(next.end) : new Date('2099-01-01') };
                  })
                  .sort((a, b) => a.nextCheckout - b.nextCheckout)
                  .map((property) => {
                    const nextBooking = (property.bookings || [])
                      .filter(b => new Date(b.end) >= new Date())
                      .sort((a, b) => new Date(a.end) - new Date(b.end))[0];

                    const task = nextBooking ? cleaningTasks.find(t =>
                      String(t.property_id) === String(property.id) &&
                      t.checkout_date === new Date(nextBooking.end).toISOString().split('T')[0]
                    ) : null;

                    return (
                      <div key={property.id} className="group bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 p-8 flex flex-col h-full transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
                        {/* Top Tags */}
                        <div className="flex justify-between items-center mb-8">
                          <span className="px-4 py-1.5 bg-sky-50 text-sky-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-sky-100">{property.area}</span>
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${property.status === 'Ready' ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                            {property.status === 'Ready' ? 'READY' : property.status.toUpperCase()}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-3xl font-black text-slate-900 mb-6 group-hover:text-airbnb transition-colors">{property.name}</h3>

                        {/* Details Row */}
                        <div className="space-y-4 mb-6">
                          <div className="flex items-center gap-4 text-slate-500">
                            <div className="w-10 h-10 rounded-2xl bg-pink-50 flex items-center justify-center text-airbnb group-hover:scale-110 transition-transform">
                              <Clock size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next Checkout</p>
                              <p className="text-sm font-black text-slate-700">
                                {nextBooking
                                  ? `${property.checkout_time || '12:00 PM'} (${new Date(nextBooking.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`
                                  : 'No upcoming checkout'}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`flex items-center gap-4 text-slate-500 cursor-pointer p-2 -m-2 rounded-2xl transition-all hover:bg-slate-50 ${!task ? 'animate-pulse' : ''}`}
                            onClick={() => nextBooking && openAssignModal({ ...nextBooking, propertyId: property.id })}
                          >
                            <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-airbnb group-hover:scale-110 transition-all overflow-hidden border border-pink-100 shadow-sm">
                              {task?.cleaners?.avatar_url ? (
                                <img src={task.cleaners.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                <User size={20} />
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next Assignee</p>
                              <p className="text-sm font-black text-slate-700 flex items-center gap-2">
                                {task ? task.cleaners?.name : <span className="text-slate-300 italic">Unassigned</span>}
                                <Plus size={12} className="text-slate-300" />
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* All Bookings Section */}
                        <div className="flex-grow mb-8 overflow-hidden flex flex-col">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">Booking History & Schedule</p>
                          <div className="space-y-2 overflow-y-auto pr-2 max-h-[140px] custom-scrollbar">
                            {(property.bookings || [])
                              .sort((a, b) => new Date(b.start) - new Date(b.start))
                              .map((b, idx) => {
                                const end = new Date(b.end);
                                const isPast = end < new Date();
                                const dateString = end.toISOString().split('T')[0];
                                const bookingTask = cleaningTasks.find(t =>
                                  String(t.property_id) === String(property.id) &&
                                  t.checkout_date === dateString
                                );
                                const isAssigned = !!bookingTask;

                                return (
                                  <div
                                    key={idx}
                                    onClick={() => !isPast && openAssignModal({ ...b, propertyId: property.id })}
                                    className={`flex justify-between items-center px-4 py-2.5 rounded-xl border transition-all ${isPast ? 'bg-slate-50/50 border-slate-100 text-slate-400 opacity-60' : 'bg-white border-slate-100 text-slate-600 shadow-sm cursor-pointer hover:border-airbnb hover:scale-[1.02] active:scale-95'}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-1.5 h-1.5 rounded-full ${isPast ? 'bg-slate-300' :
                                        isAssigned ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                          'bg-airbnb animate-pulse'
                                        }`}></div>
                                      <span className="text-[11px] font-bold">
                                        {new Date(b.start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[9px] font-black uppercase tracking-tighter ${isAssigned && !isPast ? 'text-emerald-600' : ''}`}>
                                        {isPast ? 'Past' : isAssigned ? 'Assigned' : 'Upcoming'}
                                      </span>
                                      {!isPast && <RotateCw size={10} className="text-slate-300 group-hover:text-airbnb" />}
                                    </div>
                                  </div>
                                );
                              })}
                            {(property.bookings || []).length === 0 && <p className="text-xs text-slate-300 italic py-4">No data synchronized yet.</p>}
                          </div>
                        </div>

                        {/* Footer (Interactive items show on hover) */}
                        <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover:text-slate-400 transition-colors">PRIORITY: {property.priority || 'NORMAL'}</span>
                          <div className="flex gap-6 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                            <button
                              onClick={() => syncAirbnb(property)}
                              disabled={loading}
                              className="flex items-center gap-2 text-xs font-black text-airbnb hover:opacity-70 transition-all uppercase tracking-widest"
                            >
                              <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
                              SYNC
                            </button>
                            <button
                              onClick={() => { setSelectedUnit(property); setShowManageModal(true); }}
                              className="text-xs font-black text-airbnb hover:opacity-70 transition-all uppercase tracking-widest"
                            >
                              Manage Unit
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {view === 'calendar' && (
            <>
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-white rounded-lg"><Menu size={24} /></button>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Cleaning Schedule</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <button onClick={() => setCalendarMode('list')} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${calendarMode === 'list' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}>List View</button>
                      <button onClick={() => setCalendarMode('grid')} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${calendarMode === 'grid' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}>Grid View</button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  {calendarMode === 'grid' && (
                    <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm ml-auto">
                      <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))} className="p-1 hover:text-airbnb transition-colors"><ChevronDown className="rotate-90" size={18} /></button>
                      <span className="text-xs font-black uppercase tracking-widest min-w-[120px] text-center">{calendarDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
                      <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))} className="p-1 hover:text-airbnb transition-colors"><ChevronDown className="-rotate-90" size={18} /></button>
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      setLoading(true);
                      for (const p of properties) if (p.ical_url) await syncAirbnb(p);
                      setLoading(false);
                    }}
                    className="w-full md:w-auto border-2 border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:border-airbnb hover:text-airbnb transition-all group"
                  >
                    <RotateCw size={18} className={`${loading ? 'animate-spin text-airbnb' : 'text-slate-400 group-hover:text-airbnb transition-colors'}`} />
                    <span className="text-sm">Sync All</span>
                  </button>
                </div>
              </header>

              {calendarMode === 'list' ? (
                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                  {(() => {
                    const allBookings = properties.flatMap(p => (p.bookings || []).map(b => ({ ...b, propertyName: p.name, propertyArea: p.area, propertyId: p.id })))
                      .sort((a, b) => new Date(a.end) - new Date(b.end));

                    if (allBookings.length === 0) return (
                      <div className="bg-white rounded-[2.5rem] p-20 text-center border border-slate-100">
                        <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-6"><RotateCw size={32} /></div>
                        <h3 className="text-xl font-bold text-slate-400">No upcoming tasks found</h3>
                        <p className="text-slate-400 text-sm mt-2 font-medium">Click "Sync All" to fetch checkout dates.</p>
                      </div>
                    );

                    return allBookings.map((booking, idx) => {
                      const end = new Date(booking.end);
                      const isToday = new Date().toDateString() === end.toDateString();
                      const task = cleaningTasks.find(t =>
                        String(t.property_id) === String(booking.propertyId) &&
                        t.checkout_date === end.toISOString().split('T')[0]
                      );

                      return (
                        <div key={idx} className={`p-6 bg-white rounded-3xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group transition-all duration-300 hover:shadow-xl hover:-translate-x-1 ${isToday ? 'border-l-4 border-l-airbnb shadow-lg shadow-airbnb/5' : ''}`}>
                          <div className="flex items-start gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all duration-500 ${isToday ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20 group-hover:scale-105' : 'bg-slate-50 text-slate-400 border border-slate-100 group-hover:bg-pink-50 group-hover:text-airbnb'}`}>
                              <span className="text-[10px] font-black uppercase tracking-widest">{end.toLocaleDateString('en-GB', { month: 'short' })}</span>
                              <span className="text-xl font-black">{end.getDate()}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-black text-slate-900 text-lg">{booking.propertyName}</h4>
                                <span className="px-2 py-0.5 bg-slate-100 text-[8px] font-black uppercase text-slate-400 rounded-lg tracking-[0.15em] border border-slate-200">{booking.propertyArea}</span>
                              </div>
                              <div className="flex items-center gap-4 mt-1">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5"><Clock size={12} className="text-airbnb" /> {new Date(booking.start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {task ? (
                              <>
                                <button onClick={() => openAssignModal(booking)} className="flex items-center gap-3 px-5 py-3 bg-white border border-slate-200 rounded-2xl hover:border-airbnb hover:shadow-lg transition-all relative overflow-hidden group/btn">
                                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-airbnb origin-left scale-x-0 group-hover/btn:scale-x-100 transition-transform duration-500"></div>
                                  <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center text-airbnb overflow-hidden border border-pink-100 shadow-sm">
                                    {task.cleaners?.avatar_url ? (
                                      <img src={task.cleaners.avatar_url} className="w-full h-full object-cover" />
                                    ) : (
                                      <User size={16} />
                                    )}
                                  </div>
                                  <div className="text-left">
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">Assignee</p>
                                    <p className="text-sm font-black text-slate-700">{task.cleaners?.name}</p>
                                  </div>
                                  {task.status === 'completed' ? <CheckCircle size={18} className="text-emerald-500 ml-2" /> : <div className={`w-2.5 h-2.5 rounded-full ml-2 animate-pulse ${task.cleaner_id ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-400'}`} />}
                                </button>
                                {task.cleaners?.phone && (
                                  <a
                                    href={`https://wa.me/${task.cleaners.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`*TUGASAN BARU*\n\nUnit: ${booking.propertyName}\nCheckout: ${properties.find(p => String(p.id) === String(task.property_id))?.checkout_time?.split(' (')[0] || '12:00 PM'} (${new Date(booking.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})\n\nSahkan Selesai: ${window.location.origin}/?task_id=${task.id}`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:shadow-emerald-200 transition-all active:scale-95"
                                    title="WhatsApp Cleaner"
                                  >
                                    <MessageCircle size={20} fill="currentColor" fillOpacity={0.2} />
                                  </a>
                                )}
                              </>
                            ) : (
                              <button onClick={() => openAssignModal(booking)} className="bg-airbnb/5 text-airbnb hover:bg-airbnb hover:text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm hover:shadow-airbnb/20 active:scale-95">
                                Assign Cleaner
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-10 animate-in fade-in duration-700">
                  <div className="grid grid-cols-7 gap-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="h-10 text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] text-center flex items-center justify-center">{d}</div>)}
                    {(() => {
                      const days = [];
                      const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
                      const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();

                      const allBookings = properties.flatMap(p => (p.bookings || []).map(b => ({ ...b, propertyName: p.name, propertyId: p.id })));

                      for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="aspect-square bg-slate-50/30 rounded-2xl m-1"></div>);

                      for (let d = 1; d <= daysInMonth; d++) {
                        const dateString = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), d).toISOString().split('T')[0];
                        const checkouts = allBookings.filter(b => b.end.split('T')[0] === dateString);
                        const isToday = new Date().toDateString() === new Date(calendarDate.getFullYear(), calendarDate.getMonth(), d).toDateString();

                        days.push(
                          <div
                            key={d}
                            onClick={(e) => {
                              // On mobile/tablet, we want to toggle the popover
                              setActivePopoverDate(activePopoverDate === dateString ? null : dateString);
                            }}
                            className={`calendar-day-cell group aspect-square p-2 border border-slate-50 m-1 rounded-2xl relative transition-all duration-300 hover:border-airbnb hover:shadow-lg ${isToday ? 'bg-airbnb/5 border-airbnb/50' : 'bg-slate-50/50 hover:bg-white'} ${activePopoverDate === dateString ? 'border-airbnb shadow-lg z-40' : ''}`}
                          >
                            <span className={`text-xs font-black ${isToday ? 'text-airbnb' : 'text-slate-400 group-hover:text-slate-900'} transition-colors`}>{d}</span>
                            <div className="mt-1 space-y-1">
                              {checkouts.slice(0, 3).map((b, i) => {
                                const task = cleaningTasks.find(t => String(t.property_id) === String(b.propertyId) && t.checkout_date === dateString);
                                return (
                                  <div
                                    key={i}
                                    title={`${b.propertyName}${task ? ` (${task.cleaners?.name})` : ''}`}
                                    className={`h-1.5 w-full rounded-full transition-all duration-500 ${task?.status === 'completed' || (task && task.cleaner_id) ? 'bg-emerald-400' : 'bg-pink-400'} group-hover:scale-y-125`}
                                  />
                                );
                              })}
                              {checkouts.length > 3 && <div className="text-[7px] font-black text-slate-300 text-center">+{checkouts.length - 3} MORE</div>}
                            </div>

                            {/* Hover/Click Details Popover */}
                            {checkouts.length > 0 && (
                              <div
                                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-slate-900 text-white rounded-xl p-3 text-[10px] font-bold transition-all duration-300 scale-90 z-50 shadow-2xl ${activePopoverDate === dateString ? 'opacity-100 visible scale-100' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible group-hover:scale-100'}`}
                                onClick={(e) => e.stopPropagation()} // Prevent clicking popover content from closing it
                              >
                                <div className="text-slate-400 mb-2 font-black uppercase tracking-[0.1em] border-b border-white/10 pb-1 flex justify-between">
                                  <span>Tasks: {checkouts.length}</span>
                                  <span className="text-[8px] text-airbnb">Click to Edit</span>
                                </div>
                                {checkouts.map((b, i) => {
                                  const task = cleaningTasks.find(t => String(t.property_id) === String(b.propertyId) && t.checkout_date === dateString);
                                  return (
                                    <div
                                      key={i}
                                      onClick={(e) => { e.stopPropagation(); openAssignModal(b); }}
                                      className="flex items-center justify-between gap-2 mb-1.5 last:mb-0 p-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group/row"
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <div className={`w-1.5 h-1.5 rounded-full ${task && task.cleaner_id ? 'bg-emerald-400' : 'bg-airbnb'}`}></div>
                                        <span className="truncate">{b.propertyName}</span>
                                        {task?.cleaner_id && <span className="text-[8px] text-slate-400 truncate ml-1 opacity-70">({task.cleaners?.name})</span>}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {task?.cleaners?.phone && (
                                          <a
                                            href={`https://wa.me/${task.cleaners.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`*TUGASAN BARU*\n\nUnit: ${b.propertyName}\nCheckout: ${properties.find(p => String(p.id) === String(task.property_id))?.checkout_time?.split(' (')[0] || '12:00 PM'} (${new Date(b.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})\n\nSahkan Selesai: ${window.location.origin}/?task_id=${task.id}`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                                            title="WhatsApp Cleaner"
                                          >
                                            <MessageCircle size={10} fill="currentColor" fillOpacity={0.2} />
                                          </a>
                                        )}
                                        <RotateCw size={10} className="text-white/30" />
                                      </div>
                                    </div>
                                  );
                                })}
                                <div className="absolute inset-x-0 -bottom-1 h-2 bg-slate-900 clip-path-triangle rotate-180 mx-auto w-2"></div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return days;
                    })()}
                  </div>
                  <div className="mt-8 flex items-center justify-center gap-6 border-t border-slate-50 pt-8">
                    <div className="flex items-center gap-2 group"><div className="w-3 h-3 rounded-full bg-pink-400 group-hover:scale-150 transition-transform"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unassigned</span></div>
                    <div className="flex items-center gap-2 group"><div className="w-3 h-3 rounded-full bg-amber-400 group-hover:scale-150 transition-transform"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">In Progress</span></div>
                    <div className="flex items-center gap-2 group"><div className="w-3 h-3 rounded-full bg-emerald-400 group-hover:scale-150 transition-transform"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Completed</span></div>
                  </div>
                </div>
              )}
            </>
          )}

          {view === 'cleaners' && (
            <>
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-white rounded-lg"><Menu size={24} /></button>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Cleaners</h2>
                </div>
                <button onClick={() => { setEditingCleaner(null); setShowCleanerModal(true); }} className="w-full md:w-auto bg-airbnb text-white px-6 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-airbnb/20 transition-all">
                  <Plus size={20} strokeWidth={3} /> Add Cleaner
                </button>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cleaners.map(cleaner => (
                  <div key={cleaner.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl overflow-hidden border-2 ${cleaner.avatar_url ? 'border-white' : (cleaner.role === 'head_cleaner' ? 'bg-slate-900 border-slate-200' : 'bg-airbnb border-pink-100')}`}>
                        {cleaner.avatar_url ? (
                          <img src={cleaner.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          cleaner.role === 'head_cleaner' ? <ShieldCheck size={28} /> : <User size={28} />
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 leading-tight">{cleaner.name}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cleaner.role.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="space-y-2 pt-4 border-t border-slate-50 text-sm">
                      <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[10px]">Phone</span><span className="text-slate-900 font-black">{cleaner.phone || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[10px]">Supervisor</span><span className="text-slate-900 font-black">{cleaner.head_cleaner_id ? cleaners.find(c => c.id === cleaner.head_cleaner_id)?.name : 'Admin'}</span></div>
                    </div>
                    <div className="mt-6 flex gap-2">
                      <button onClick={() => { setEditingCleaner(cleaner); setShowCleanerModal(true); }} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase hover:bg-slate-200">Edit</button>
                      <button onClick={async () => { if (confirm('Delete cleaner?')) { await supabase.from('cleaners').delete().eq('id', cleaner.id); fetchCleaners(); } }} className="w-12 h-10 flex items-center justify-center border border-rose-100 text-rose-500 rounded-xl hover:bg-rose-50"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main >

      {/* Modals */}
      {
        showNewTaskModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
              <h3 className="text-2xl font-bold mb-6">New Property</h3>
              <form onSubmit={handleAddUnit} className="space-y-4">
                <input type="text" required placeholder="Unit Name" className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={newUnit.name} onChange={e => setNewUnit({ ...newUnit, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={newUnit.area} onChange={e => setNewUnit({ ...newUnit, area: e.target.value })}><option>Shah Alam</option><option>Puchong</option></select>
                  <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={newUnit.priority} onChange={e => setNewUnit({ ...newUnit, priority: e.target.value })}><option>Normal</option><option>High</option></select>
                </div>
                <input type="text" placeholder="iCal URL" className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={newUnit.ical_url} onChange={e => setNewUnit({ ...newUnit, ical_url: e.target.value })} />
                <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowNewTaskModal(false)} className="flex-1 bg-slate-100 py-4 rounded-xl font-bold">Cancel</button><button type="submit" disabled={loading} className="flex-1 bg-airbnb text-white py-4 rounded-xl font-bold">Add Unit</button></div>
              </form>
            </div>
          </div>
        )
      }

      {
        showManageModal && selectedUnit && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
              <h3 className="text-2xl font-bold mb-6">Manage Unit</h3>
              <form onSubmit={handleUpdateUnit} className="space-y-4">
                <input type="text" required className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={selectedUnit.name} onChange={e => setSelectedUnit({ ...selectedUnit, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={selectedUnit.area} onChange={e => setSelectedUnit({ ...selectedUnit, area: e.target.value })}><option>Shah Alam</option><option>Puchong</option></select>
                  <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={selectedUnit.priority} onChange={e => setSelectedUnit({ ...selectedUnit, priority: e.target.value })}><option>Normal</option><option>High</option></select>
                </div>
                <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={selectedUnit.status} onChange={e => setSelectedUnit({ ...selectedUnit, status: e.target.value })}><option>Ready</option><option>Cleaning</option><option>Maintenance</option></select>
                <input type="text" placeholder="iCal URL" className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={selectedUnit.ical_url || ''} onChange={e => setSelectedUnit({ ...selectedUnit, ical_url: e.target.value })} />
                <div className="flex gap-3 pt-4"><button type="button" onClick={handleDeleteUnit} className="flex-1 bg-rose-50 text-rose-500 py-4 rounded-xl font-bold">Delete</button><button type="submit" className="flex-1 bg-airbnb text-white py-4 rounded-xl font-bold">Save</button></div>
                <button type="button" onClick={() => setShowManageModal(false)} className="w-full text-slate-400 font-bold py-2">Close</button>
              </form>
            </div>
          </div>
        )
      }

      {
        showCleanerModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
              <h3 className="text-2xl font-bold mb-6">{editingCleaner ? 'Edit Cleaner' : 'New Cleaner'}</h3>
              <form onSubmit={handleCleanerSubmit} className="space-y-4">
                <div className="flex justify-center mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center text-slate-300">
                      {(editingCleaner?.avatar_url || newCleaner.avatar_url) ? (
                        <img src={editingCleaner?.avatar_url || newCleaner.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} />
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-airbnb text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
                      <Plus size={16} strokeWidth={3} />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAvatarUpload(e, !!editingCleaner)} />
                    </label>
                  </div>
                </div>
                <input type="text" required placeholder="Name" className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={editingCleaner ? editingCleaner.name : newCleaner.name} onChange={e => editingCleaner ? setEditingCleaner({ ...editingCleaner, name: e.target.value }) : setNewCleaner({ ...newCleaner, name: e.target.value })} />
                <input type="text" placeholder="Phone" className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={editingCleaner ? editingCleaner.phone : newCleaner.phone} onChange={e => editingCleaner ? setEditingCleaner({ ...editingCleaner, phone: e.target.value }) : setNewCleaner({ ...newCleaner, phone: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={editingCleaner ? editingCleaner.role : newCleaner.role} onChange={e => editingCleaner ? setEditingCleaner({ ...editingCleaner, role: e.target.value }) : setNewCleaner({ ...newCleaner, role: e.target.value })}><option value="cleaner">Cleaner</option><option value="head_cleaner">Head Cleaner</option></select>
                  <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={editingCleaner ? (editingCleaner.head_cleaner_id || '') : newCleaner.head_cleaner_id} onChange={e => editingCleaner ? setEditingCleaner({ ...editingCleaner, head_cleaner_id: e.target.value }) : setNewCleaner({ ...newCleaner, head_cleaner_id: e.target.value })}><option value="">None (Admin)</option>{cleaners.filter(c => c.role === 'head_cleaner' && c.id !== editingCleaner?.id).map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select>
                </div>
                <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowCleanerModal(false)} className="flex-1 bg-slate-100 py-4 rounded-xl font-bold">Cancel</button><button type="submit" className="flex-1 bg-airbnb text-white py-4 rounded-xl font-bold">Save</button></div>
              </form>
            </div>
          </div>
        )
      }

      {
        showAssignModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAssignModal(false)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative flex flex-col" onClick={e => e.stopPropagation()}>
              <h3 className="text-2xl font-bold mb-2">Assign Cleaner</h3>
              <p className="text-sm text-slate-500 mb-6">
                {selectedUnit?.name || 'Unit'} - {selectedBooking?.end ? new Date(selectedBooking.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Date'}
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {cleaners.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleAssignCleaner(c.id)}
                    className="w-full flex items-center gap-4 p-4 border rounded-3xl hover:bg-airbnb/5 hover:border-airbnb transition-all text-left group/row"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 overflow-hidden border-2 border-white shadow-sm transition-transform group-hover/row:scale-110">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="block font-black text-slate-700 text-base">{c.name}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-[0.1em]">{c.role.replace('_', ' ')}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 group-hover/row:bg-airbnb group-hover/row:text-white transition-all">
                      <Plus size={16} />
                    </div>
                  </button>
                ))}
                {cleaners.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-500 italic mb-4">No cleaners available.</p>
                    <button onClick={() => { setView('cleaners'); setShowAssignModal(false); }} className="text-airbnb font-bold text-sm underline">Add Team Member</button>
                  </div>
                )}
              </div>
              <button onClick={() => setShowAssignModal(false)} className="w-full mt-6 py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors">Cancel</button>
            </div>
          </div>
        )
      }

    </div >
  );
};

export default App;
// Trigger rebuild 2
// Update WhatsApp icon styling
// Final touch for WhatsApp and Mobile Grid
