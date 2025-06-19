
import React, { useState } from 'react';
import { Folder, Share, Users, Lock, Plus, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

type LinkdmsCategory = {
  id: string;
  name: string;
  icon: React.ReactNode;
  items: LinkdmsItem[];
};

type LinkdmsItem = {
  id: string;
  name: string;
};

interface LinkdmsSidebarProps {
  onLinkdmsSelect: (categoryId: string, itemId: string | null) => void;
  selectedCategoryId: string;
  selectedItemId: string | null;
}

const LinkdmsSidebar = ({ 
  onLinkdmsSelect, 
  selectedCategoryId = 'private', 
  selectedItemId = 'overview' 
}: LinkdmsSidebarProps) => {
  const categories: LinkdmsCategory[] = [
    {
      id: 'shared',
      name: 'Shared',
      icon: <Share size={16} className="text-blue-500" />,
      items: [
        { id: 'shared-1', name: 'Second Brain' },
        { id: 'shared-2', name: 'OSS' },
        { id: 'shared-3', name: 'Artificial Intelligence' },
      ]
    },
    {
      id: 'team',
      name: 'Team Space',
      icon: <Users size={16} className="text-green-500" />,
      items: [
        { id: 'team-1', name: 'Brainboard Competitors' },
        { id: 'team-2', name: 'Visualize Terraform' },
        { id: 'team-3', name: 'CI/CD Engine' },
      ]
    },
    {
      id: 'private',
      name: 'Private',
      icon: <Lock size={16} className="text-amber-500" />,
      items: [
        { id: 'overview', name: 'Overview' },
        { id: 'private-1', name: 'UXUI' },
        { id: 'private-2', name: 'Space' },
        { id: 'private-3', name: 'Cloud Computing' },
      ]
    }
  ];

  const handleCategoryClick = (categoryId: string) => {
    onLinkdmsSelect(categoryId, null);
  };

  const handleItemClick = (categoryId: string, itemId: string) => {
    onLinkdmsSelect(categoryId, itemId);
  };

  return (
    <div className="w-60 border-r border-border/50 overflow-y-auto shrink-0">
      {categories.map((category) => (
        <div key={category.id} className="mb-6">
          <div 
            className={cn(
              "flex items-center justify-between px-4 py-2 text-sm font-medium cursor-pointer",
              selectedCategoryId === category.id && !selectedItemId ? "text-primary" : "text-foreground/80"
            )}
            onClick={() => handleCategoryClick(category.id)}
          >
            <div className="flex items-center gap-2">
              {category.icon}
              <span>{category.name}</span>
            </div>
            <button className="p-1 rounded-full hover:bg-muted">
              <Plus size={14} />
            </button>
          </div>
          
          <div className="mt-1">
            {category.items.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "flex items-center px-6 py-2 text-sm cursor-pointer",
                  selectedCategoryId === category.id && selectedItemId === item.id
                    ? "bg-primary/10 text-primary" 
                    : "hover:bg-muted/50 text-foreground/80"
                )}
                onClick={() => handleItemClick(category.id, item.id)}
              >
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LinkdmsSidebar;
