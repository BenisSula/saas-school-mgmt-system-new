import React, { useState } from 'react';
import { TicketList } from '../../components/support/TicketList';
import { MessageCenter } from '../../components/support/MessageCenter';
import { KnowledgeBase } from '../../components/support/KnowledgeBase';
import { StatusPage } from '../../components/support/StatusPage';

export const SuperuserSupportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'messages' | 'kb' | 'status'>('tickets');

  const tabs = [
    { id: 'tickets' as const, label: 'Support Tickets' },
    { id: 'messages' as const, label: 'Messages' },
    { id: 'kb' as const, label: 'Knowledge Base' },
    { id: 'status' as const, label: 'Status Page' }
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Support & Communication Center</h1>
      <div className="border-b mb-4">
        <nav className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-4 border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-4">
        {activeTab === 'tickets' && <TicketList />}
        {activeTab === 'messages' && <MessageCenter />}
        {activeTab === 'kb' && <KnowledgeBase />}
        {activeTab === 'status' && <StatusPage />}
      </div>
    </div>
  );
};

