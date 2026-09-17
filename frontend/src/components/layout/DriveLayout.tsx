import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDrive } from '../../context/DriveContext';
import { useAuth } from '../../context/AuthContext';
import {
  HardDrive,
  Clock,
  Star,
  Share2,
  Trash2,
  Database,
  Plus,
  FolderPlus,
  FolderUp,
  Upload,
  Search,
  Sparkles,
  LogOut,
  User as UserIcon,
  LayoutGrid,
  List,
  ChevronDown,
  Code2,
  Settings,
  Camera,
  Menu,
  X,
  WifiOff,
  HardDriveDownload,
  ShieldCheck,
} from 'lucide-react';

interface DriveLayoutProps {
  children: React.ReactNode;
  onOpenAskAI: () => void;
  onNewFolder: () => void;
  onUploadClick: () => void;
  onUploadFolderClick?: () => void;
  onCameraClick?: () => void;
  onOpenVsCode?: () => void;
}

export const DriveLayout: React.FC<DriveLayoutProps> = ({
  children,
  onOpenAskAI,
  onNewFolder,
  onUploadClick,
  onUploadFolderClick,
  onCameraClick,
  onOpenVsCode,
}) => {
  const { user, logout } = useAuth();
  const {
    activeView,
    setActiveView,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    storageInfo,
    isOnline,
    offlineItemIds,
  } = useDrive();

  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'drive', label: 'My Drive', icon: HardDrive },
    { id: 'offline', label: `Offline (${offlineItemIds.size})`, icon: HardDriveDownload },
    { id: 'camera', label: 'Camera App', icon: Camera },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'storage', label: 'Storage', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(user?.displayName || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const { updateProfile } = useAuth();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      await updateProfile({ displayName: profileName, email: profileEmail });
      setProfileMsg('Profile updated successfully!');
      setTimeout(() => {
        setProfileModalOpen(false);
        setProfileMsg('');
      }, 1200);
    } catch (err: any) {
      setProfileMsg(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-16 px-3 sm:px-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 backdrop-blur-md flex-shrink-0 z-30 gap-2">
        {/* Mobile Hamburger + Brand */}
        <div className="flex items-center gap-2 md:w-56 flex-shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-lg shadow-brand-500/20 text-white">
            <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="font-bold text-sm sm:text-base tracking-tight text-white hidden xs:inline">
            TeleDrive
          </span>
        </div>

        {/* Global Search */}
        <div className="flex-1 max-w-xl mx-2 sm:mx-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 sm:top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files and folders..."
              className="w-full pl-10 pr-4 py-1.5 sm:py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {!isOnline && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] font-medium text-amber-400">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Offline Mode</span>
            </div>
          )}

          {/* VS Code Studio Button */}
          {onOpenVsCode && (
            <button
              onClick={onOpenVsCode}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl text-xs font-semibold text-slate-200 transition-all shadow-sm"
              title="Open VS Code Studio"
            >
              <Code2 className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">VS Code Studio</span>
              <span className="sm:hidden">Studio</span>
            </button>
          )}

          {/* Ask AI Button */}
          <button
            onClick={onOpenAskAI}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-brand-600/20 to-indigo-600/20 border border-brand-500/30 hover:border-brand-500/60 rounded-xl text-xs font-semibold text-brand-300 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span className="hidden sm:inline">Ask Files AI</span>
            <span className="sm:hidden">AI</span>
          </button>

          {/* Admin Panel Button */}
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-xs font-semibold text-amber-300 transition-all shadow-sm"
              title="Admin Control Panel"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Admin Panel</span>
              <span className="sm:hidden">Admin</span>
            </Link>
          )}

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-xl hover:bg-slate-800/80 text-slate-300 transition-colors"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-md relative">
                {user?.displayName ? user.displayName[0].toUpperCase() : 'U'}
                {user?.role === 'ADMIN' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 border-2 border-slate-950 rounded-full flex items-center justify-center text-[8px] font-black text-slate-950" title="Admin Account">
                    ★
                  </span>
                )}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden xs:inline" />
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 text-xs text-slate-200 animate-pop-in">
                <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-2">
                  <div className="overflow-hidden">
                    <p className="font-semibold truncate">{user?.displayName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email || user?.phoneNumber}</p>
                  </div>
                  {user?.role === 'ADMIN' && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold rounded-md uppercase tracking-wider flex-shrink-0">
                      ADMIN
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setProfileName(user?.displayName || '');
                    setProfileEmail(user?.email || '');
                    setProfileModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-800 transition-colors mt-1"
                >
                  <UserIcon className="w-4 h-4 text-brand-400" />
                  My Profile
                </button>
                {user?.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    onClick={() => setProfileMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-amber-300 hover:bg-amber-500/10 transition-colors mt-1 font-semibold"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Admin Control Panel
                  </Link>
                )}
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 transition-colors mt-1"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Edit Profile Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setProfileModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
                <UserIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">My Account Profile</h3>
                <p className="text-xs text-slate-400">View and update your personal details</p>
              </div>
            </div>

            {profileMsg && (
              <div className={`mb-4 p-2.5 rounded-lg text-xs font-medium text-center ${
                profileMsg.includes('success') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              }`}>
                {profileMsg}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Mobile Number</label>
                <input
                  type="text"
                  disabled
                  value={user?.phoneNumber || ''}
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-850 rounded-xl text-xs text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Account Role</label>
                <input
                  type="text"
                  disabled
                  value={user?.role || 'USER'}
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-850 rounded-xl text-xs text-slate-500 cursor-not-allowed uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/20 transition-all disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-60 border-r border-slate-800/80 bg-slate-900/40 p-4 flex-col justify-between flex-shrink-0">
          <div className="space-y-4">
            {/* New Button */}
            <div className="relative">
              <button
                onClick={() => setNewMenuOpen(!newMenuOpen)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl font-semibold text-xs text-white shadow-lg shadow-brand-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                New Item
              </button>

              {newMenuOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 text-xs text-slate-200 animate-pop-in">
                  <button
                    onClick={() => {
                      setNewMenuOpen(false);
                      onNewFolder();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 transition-colors"
                  >
                    <FolderPlus className="w-4 h-4 text-brand-400" />
                    New Folder
                  </button>
                  <button
                    onClick={() => {
                      setNewMenuOpen(false);
                      onUploadClick();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    Upload File
                  </button>
                  {onUploadFolderClick && (
                    <button
                      onClick={() => {
                        setNewMenuOpen(false);
                        onUploadFolderClick();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 transition-colors"
                    >
                      <FolderUp className="w-4 h-4 text-amber-400" />
                      Upload Folder
                    </button>
                  )}
                  {onCameraClick && (
                    <button
                      onClick={() => {
                        setNewMenuOpen(false);
                        onCameraClick();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 transition-colors border-t border-slate-800 text-sky-400 font-medium"
                    >
                      <Camera className="w-4 h-4 text-sky-400" />
                      Camera Capture
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Navigation List */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-brand-600/20 text-brand-300 font-semibold border border-brand-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Storage Widget */}
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-xs font-medium mb-1.5">
              <span className="text-slate-300">Storage</span>
              <span className="text-[11px] text-slate-400">
                {storageInfo ? formatSize(storageInfo.totalBytes) : '0 B'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    storageInfo ? (storageInfo.totalBytes / (100 * 1024 * 1024 * 1024)) * 100 : 0
                  )}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-400 block font-medium">Zentro Cloud Engine • By Failed Engineers</span>
          </div>
        </aside>

        {/* Mobile Slide-Over Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop Overlay */}
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide Drawer Panel */}
            <aside className="relative w-64 max-w-[80vw] bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between z-10 shadow-2xl animate-pop-in">
              <div className="space-y-4">
                {/* Mobile Drawer Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 text-white">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-slate-100">Zentro Drive Navigation</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile New Item Button */}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onNewFolder();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-xl font-semibold text-xs shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  New Folder
                </button>

                {/* Mobile Nav List */}
                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveView(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-brand-600/20 text-brand-300 font-semibold border border-brand-500/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Mobile Sidebar Storage Widget */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                  <span className="text-slate-300">Storage</span>
                  <span className="text-[11px] text-slate-400">
                    {storageInfo ? formatSize(storageInfo.totalBytes) : '0 B'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        storageInfo ? (storageInfo.totalBytes / (100 * 1024 * 1024 * 1024)) * 100 : 0
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 block font-medium">Zentro Cloud Engine • By Failed Engineers</span>
              </div>
            </aside>
          </div>
        )}

        {/* Central View Container */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/80 p-3 sm:p-6">
          {/* Offline Banner Indicator */}
          {!isOnline && (
            <div className="mb-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs text-amber-300 font-medium">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-400" />
                <span>You are currently <strong>Offline</strong> — Showing saved offline files & cached content.</span>
              </div>
              <span className="text-[11px] font-mono bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">
                {offlineItemIds.size} Saved
              </span>
            </div>
          )}

          {/* Action Bar Header */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-base sm:text-lg font-bold font-heading text-slate-100 capitalize">
              {activeView === 'drive'
                ? 'My Drive'
                : activeView === 'camera'
                ? 'Camera Studio'
                : activeView === 'offline'
                ? 'Offline Available Files'
                : activeView}
            </h2>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 border border-slate-800 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-slate-800 text-brand-400' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-slate-800 text-brand-400' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Children Views */}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
