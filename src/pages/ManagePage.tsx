
import React, { useState, useEffect } from 'react';
import { AnimatedTransition } from '@/components/AnimatedTransition';
import { useAnimateIn } from '@/lib/animations';
import LinkdmsTable from '@/components/manage/LinkdmsTable';
import LinkdmsSidebar from '@/components/manage/LinkdmsSidebar';
import ViewSwitcher from '@/components/manage/ViewSwitcher';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, Edit2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Toaster } from 'sonner';

const ManagePage = () => {
  const showContent = useAnimateIn(false, 300);
  const [viewType, setViewType] = useState<'table' | 'grid' | 'list' | 'kanban'>('table');
  const [libraryTitle, setLibraryTitle] = useState('Linkdms Library');
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('private');
  const [selectedItem, setSelectedItem] = useState<string | null>('overview');

  const handleEditClick = () => {
    setTempTitle(libraryTitle);
    setIsEditing(true);
  };

  const handleSaveClick = () => {
    if (tempTitle.trim()) {
      setLibraryTitle(tempTitle);
      setIsEditing(false);
    }
  };

  const handleCancelClick = () => {
    setIsEditing(false);
  };

  const handleDialogOpen = () => {
    setTempTitle(libraryTitle);
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    if (tempTitle.trim()) {
      setLibraryTitle(tempTitle);
      setDialogOpen(false);
    }
  };

  const handleLinkdmsSelect = (categoryId: string, itemId: string | null) => {
    setSelectedCategory(categoryId);
    setSelectedItem(itemId);
  };

  // Handle keyboard events for inline editing
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveClick();
    } else if (e.key === 'Escape') {
      handleCancelClick();
    }
  };

  return (
    <div className="max-w-full mx-auto h-screen pt-24 pb-6">
      <Toaster position="top-right" />
      <AnimatedTransition show={showContent} animation="slide-up">
        <div className="flex h-[calc(100vh-130px)]">
          <LinkdmsSidebar 
            onLinkdmsSelect={handleLinkdmsSelect}
            selectedCategoryId={selectedCategory}
            selectedItemId={selectedItem}
          />
          <div className="flex-1 overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-8 text-xl font-semibold w-64"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" onClick={handleSaveClick}>
                    <Check size={18} className="text-green-500" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={handleCancelClick}>
                    <X size={18} className="text-red-500" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{libraryTitle}</h2>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleEditClick}
                    className="h-8 w-8"
                  >
                    <Edit2 size={14} />
                  </Button>
                </div>
              )}
              <TooltipProvider>
                <ViewSwitcher activeView={viewType} onViewChange={setViewType} />
              </TooltipProvider>
            </div>
            <LinkdmsTable 
              viewType={viewType} 
              categoryId={selectedCategory}
              linkdmsId={selectedItem}
            />
          </div>
        </div>
      </AnimatedTransition>

      {/* Alternative: Dialog for editing title */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Library Title</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              className="w-full"
              placeholder="Enter a title for your library"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDialogSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagePage;
