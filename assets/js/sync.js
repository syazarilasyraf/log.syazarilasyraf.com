// sync.js - Cloud synchronization using Supabase
// Requires: supabase-js library

// You'll need to create a free Supabase project and add your credentials here
const SUPABASE_URL = localStorage.getItem('supabase_url') || '';
const SUPABASE_KEY = localStorage.getItem('supabase_key') || '';

let supabase = null;
let syncInProgress = false;

// Initialize Supabase client
function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('[Sync] No Supabase credentials configured');
    return null;
  }
  
  if (typeof supabaseJs === 'undefined') {
    console.error('[Sync] Supabase library not loaded');
    return null;
  }
  
  return supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Check if sync is configured
export function isSyncConfigured() {
  return !!(SUPABASE_URL && SUPABASE_KEY);
}

// Configure sync credentials
export function configureSync(url, key) {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
  supabase = initSupabase();
  return !!supabase;
}

// Clear sync configuration
export function clearSyncConfig() {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_key');
  localStorage.removeItem('sync_device_id');
  supabase = null;
}

// Generate or get device ID
function getDeviceId() {
  let deviceId = localStorage.getItem('sync_device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sync_device_id', deviceId);
  }
  return deviceId;
}

// Upload data to cloud
export async function syncToCloud() {
  if (syncInProgress) {
    return { success: false, error: 'Sync already in progress' };
  }
  
  if (!isSyncConfigured()) {
    return { success: false, error: 'Sync not configured' };
  }
  
  if (!supabase) {
    supabase = initSupabase();
  }
  
  syncInProgress = true;
  
  try {
    // Import storage functions
    const { getStoredChats } = await import('./storage.js');
    const { getAllTags } = await import('./tags.js');
    
    const chats = await getStoredChats();
    const tags = await getAllTags();
    const deviceId = getDeviceId();
    
    // Prepare data
    const syncData = {
      device_id: deviceId,
      data: {
        chats: chats,
        tags: tags,
        version: 1,
        synced_at: new Date().toISOString()
      },
      chat_count: chats.length,
      message_count: chats.reduce((sum, c) => sum + (c.messages?.length || 0), 0)
    };
    
    // Upsert to Supabase
    const { data, error } = await supabase
      .from('chat_sync')
      .upsert(syncData, { onConflict: 'device_id' });
    
    if (error) throw error;
    
    // Update last sync time
    localStorage.setItem('last_sync', new Date().toISOString());
    
    return { success: true, chats: chats.length, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('[Sync] Upload failed:', error);
    return { success: false, error: error.message };
  } finally {
    syncInProgress = false;
  }
}

// Download data from cloud
export async function syncFromCloud() {
  if (syncInProgress) {
    return { success: false, error: 'Sync already in progress' };
  }
  
  if (!isSyncConfigured()) {
    return { success: false, error: 'Sync not configured' };
  }
  
  if (!supabase) {
    supabase = initSupabase();
  }
  
  syncInProgress = true;
  
  try {
    const deviceId = getDeviceId();
    
    // Get data from cloud
    const { data, error } = await supabase
      .from('chat_sync')
      .select('*')
      .eq('device_id', deviceId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No data found
        return { success: true, empty: true };
      }
      throw error;
    }
    
    if (!data || !data.data) {
      return { success: true, empty: true };
    }
    
    // Import data
    const { saveChatsToDB } = await import('./storage.js');
    const { saveAllTags } = await import('./tags.js');
    
    if (data.data.chats) {
      await saveChatsToDB(data.data.chats);
    }
    
    if (data.data.tags) {
      await saveAllTags(data.data.tags);
    }
    
    localStorage.setItem('last_sync', new Date().toISOString());
    
    return { 
      success: true, 
      chats: data.data.chats?.length || 0,
      timestamp: data.data.synced_at 
    };
  } catch (error) {
    console.error('[Sync] Download failed:', error);
    return { success: false, error: error.message };
  } finally {
    syncInProgress = false;
  }
}

// Auto-sync if enabled
export async function autoSync() {
  const autoSyncEnabled = localStorage.getItem('auto_sync') === 'true';
  if (!autoSyncEnabled) return;
  
  // Sync every 5 minutes if changes detected (simplified check)
  const lastSync = localStorage.getItem('last_sync');
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  if (!lastSync || lastSync < fiveMinutesAgo) {
    return await syncToCloud();
  }
}

// Get sync status
export function getSyncStatus() {
  return {
    configured: isSyncConfigured(),
    lastSync: localStorage.getItem('last_sync'),
    deviceId: getDeviceId(),
    inProgress: syncInProgress
  };
}

// Setup real-time sync (requires Supabase realtime)
export function setupRealtimeSync(onUpdate) {
  if (!isSyncConfigured() || !supabase) return null;
  
  const subscription = supabase
    .channel('chat_sync_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'chat_sync' },
      (payload) => {
        console.log('[Sync] Realtime update:', payload);
        if (onUpdate) onUpdate(payload);
      }
    )
    .subscribe();
  
  return subscription;
}

// SQL to create table in Supabase:
/*
CREATE TABLE chat_sync (
  device_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  chat_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chat_sync ENABLE ROW LEVEL SECURITY;

-- Create policy for anonymous access (for MVP)
CREATE POLICY "Allow anonymous access" ON chat_sync
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_sync;
*/
