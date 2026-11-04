import React from 'react';
import { Calendar, BarChart2, Hourglass, TrendingUp, Users, Settings, FileText, Database, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type TabKey =
  | 'booking_sheet'
  | 'monthly_reports'
  | 'booking_analytics'
  | 'waiting_list'
  | 'booking_graph'
  | 'users'
  | 'settings'
  | 'audit'
  | 'backup';

interface TopTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export const TopTabs: React.FC<TopTabsProps> = ({ activeTab, onTabChange }) => {
  const { user, can } = useAuth();
  const isAdmin = user?.role === 'admin';

  const baseTabs = [
    { key: 'booking_sheet' as TabKey, label: 'Booking Sheet', icon: Calendar },
    { key: 'monthly_reports' as TabKey, label: 'Monthly Patient Reports', icon: FileSpreadsheet },
    { key: 'booking_analytics' as TabKey, label: 'Booking Analytics', icon: BarChart2 },
    { key: 'waiting_list' as TabKey, label: 'Waiting List', icon: Hourglass },
    { key: 'booking_graph' as TabKey, label: 'Booking Graph', icon: TrendingUp },
  ];

  const adminTabs = [
    { key: 'users' as TabKey, label: 'User Management', icon: Users, perm: 'users.manage' as const },
    { key: 'settings' as TabKey, label: 'Settings', icon: Settings, perm: 'settings.manage' as const },
    { key: 'audit' as TabKey, label: 'Audit Log', icon: FileText, perm: 'audit.view' as const },
    { key: 'backup' as TabKey, label: 'Backup & Restore', icon: Database, perm: 'backup.manage' as const },
  ];

  return (
    <div className="bg-white border-b border-slate-200 px-6 pt-2 shadow-xs">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {baseTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? 'text-amber-700 bg-amber-50/60 border-amber-500 font-bold'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}

        {/* Admin Tabs */}
        {isAdmin && (
          <>
            <div className="h-5 w-px bg-slate-200 mx-2 self-center" />
            {adminTabs.map((tab) => {
              if (!can(tab.perm)) return null;
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                    isActive
                      ? 'text-amber-700 bg-amber-50/60 border-amber-500 font-bold'
                      : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
