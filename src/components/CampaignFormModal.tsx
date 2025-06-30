import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const campaignSchema = z.object({
  campaign_name: z.string().min(1, "Campaign name is required"),
  keywords: z.string().min(1, "Keywords are required"),
  daily_limit: z.coerce.number().min(1, "Daily limit must be at least 1"),
  weekly_limit: z.coerce.number().min(1, "Weekly limit must be at least 1"),
});

const createCampaign = async (newCampaignData: z.infer<typeof campaignSchema>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
        .from('campaigns')
        .insert([{ ...newCampaignData, user_id: user.id, status: 'draft' }])
        .select();

    if (error) throw error;
    return data;
};

export const CampaignFormModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const queryClient = useQueryClient();

    const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof campaignSchema>>({
        resolver: zodResolver(campaignSchema),
    });

    const mutation = useMutation({
        mutationFn: createCampaign,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            toast.success("Campaign created successfully!");
            onClose();
        },
        onError: (error: Error) => {
            toast.error(`Failed to create campaign: ${error.message}`);
        }
    });

    const onSubmit = (formData: z.infer<typeof campaignSchema>) => {
        mutation.mutate(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
              <DialogDescription>
                Set up your LinkedIn outreach campaign. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="campaign_name" className="text-right">
                    Name
                  </Label>
                  <Input id="campaign_name" {...register("campaign_name")} className="col-span-3" />
                  {errors.campaign_name && <p className="col-span-4 text-red-500 text-sm">{errors.campaign_name.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="keywords" className="text-right">
                    Keywords
                  </Label>
                  <Input id="keywords" {...register("keywords")} className="col-span-3" />
                  {errors.keywords && <p className="col-span-4 text-red-500 text-sm">{errors.keywords.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="daily_limit" className="text-right">
                    Daily Limit
                  </Label>
                  <Input id="daily_limit" type="number" {...register("daily_limit", { valueAsNumber: true })} defaultValue={20} className="col-span-3" />
                  {errors.daily_limit && <p className="col-span-4 text-red-500 text-sm">{errors.daily_limit.message}</p>}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="weekly_limit" className="text-right">
                    Weekly Limit
                  </Label>
                  <Input id="weekly_limit" type="number" {...register("weekly_limit", { valueAsNumber: true })} defaultValue={100} className="col-span-3" />
                  {errors.weekly_limit && <p className="col-span-4 text-red-500 text-sm">{errors.weekly_limit.message}</p>}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : "Save Campaign"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    );
}; 