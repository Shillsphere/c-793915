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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

// Schema now mirrors DB column names and supports optional nested targeting criteria
const demographicsSchema = z.object({
  min_experience_years: z.coerce.number().optional().nullable(),
  max_experience_years: z.coerce.number().optional().nullable(),
  location: z.string().optional().nullable(),
  gender_keywords: z.array(z.string()).optional().nullable(),
}).partial();

const professionalSchema = z.object({
  industries: z.array(z.string()).optional().nullable(),
  seniority_levels: z.array(z.string()).optional().nullable(),
  company_size: z.string().optional().nullable(),
  required_keywords: z.array(z.string()).optional().nullable(),
  excluded_keywords: z.array(z.string()).optional().nullable(),
  current_job_titles: z.array(z.string()).optional().nullable(),
  target_companies: z.array(z.string()).optional().nullable(),
}).partial();

const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  keywords: z.string().min(1, "Keywords are required"),
  daily_limit: z.coerce.number().min(1, "Daily limit must be at least 1"),
  weekly_limit: z.coerce.number().min(1, "Weekly limit must be at least 1"),
  targeting_criteria: z.object({
    demographics: demographicsSchema.optional().nullable(),
    professional: professionalSchema.optional().nullable(),
  }).optional().nullable(),
});

const createCampaign = async (newCampaignData: z.infer<typeof campaignSchema>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Clean empty strings/arrays -> undefined to avoid clutter in JSONB column
  const cleanCriteria = (obj: any) => {
    if (!obj || typeof obj !== 'object') return undefined;
    const cleaned: Record<string, any> = {};
    Object.entries(obj).forEach(([k, v]) => {
      if (v === "" || v === undefined || v === null) return;
      if (Array.isArray(v)) {
        const filtered = v.filter((s) => s && s.trim());
        if (filtered.length) cleaned[k] = filtered;
      } else if (typeof v === 'object') {
        const nested = cleanCriteria(v);
        if (nested && Object.keys(nested).length) cleaned[k] = nested;
      } else {
        cleaned[k] = v;
      }
    });
    return Object.keys(cleaned).length ? cleaned : undefined;
  };

  const payload = {
    ...newCampaignData,
    targeting_criteria: cleanCriteria(newCampaignData.targeting_criteria) ?? null,
    user_id: user.id,
    status: 'draft',
  } as const;

  const { data, error } = await supabase
    .from('campaigns')
    .insert([payload])
    .select();

  if (error) throw error;
  return data;
};

export const CampaignFormModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const queryClient = useQueryClient();

    const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<z.infer<typeof campaignSchema>>({
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
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input id="name" {...register("name")} className="col-span-3" />
                  {errors.name && <p className="col-span-4 text-red-500 text-sm">{errors.name.message}</p>}
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
                {/* -------- Advanced Targeting Accordion ---------- */}
                <h3 className="text-lg font-semibold border-t pt-4 col-span-4">Advanced Targeting</h3>
                <div className="col-span-4">
                  <Accordion type="multiple" className="w-full">
                    <AccordionItem value="demographics">
                      <AccordionTrigger>Demographics</AccordionTrigger>
                      <AccordionContent className="space-y-4 p-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Minimum Years of Experience</Label>
                            <Input type="number" {...register("targeting_criteria.demographics.min_experience_years", { valueAsNumber: true })} />
                          </div>
                          <div>
                            <Label>Maximum Years of Experience</Label>
                            <Input type="number" {...register("targeting_criteria.demographics.max_experience_years", { valueAsNumber: true })} />
                          </div>
                        </div>
                        <div>
                          <Label>Location (e.g., United States)</Label>
                          <Input {...register("targeting_criteria.demographics.location")} />
                        </div>
                        <div>
                          <Label>Gender Keywords (comma-separated)</Label>
                          <Input placeholder="e.g., women, she/her" {...register("targeting_criteria.demographics.gender_keywords", {
                            setValueAs: (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean)
                          })} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="professional">
                      <AccordionTrigger>Professional</AccordionTrigger>
                      <AccordionContent className="space-y-4 p-2">
                        <div>
                          <Label>Industries (comma-separated)</Label>
                          <Input placeholder="e.g., Technology, Healthcare" {...register("targeting_criteria.professional.industries", {
                            setValueAs: (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean)
                          })} />
                        </div>
                        <div>
                          <Label>Seniority Levels (comma-separated)</Label>
                          <Input placeholder="e.g., Director, VP" {...register("targeting_criteria.professional.seniority_levels", {
                            setValueAs: (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean)
                          })} />
                        </div>
                        <div>
                          <Label>Company Size</Label>
                          <select className="w-full bg-background border rounded-md h-10 px-3" {...register("targeting_criteria.professional.company_size")}> 
                            <option value="">-- Any --</option>
                            <option value="startup">Startup (1-10)</option>
                            <option value="small">Small (11-50)</option>
                            <option value="medium">Medium (51-200)</option>
                            <option value="large">Large (201-500)</option>
                            <option value="enterprise">Enterprise (500+)</option>
                          </select>
                        </div>
                        <div>
                          <Label>Required Keywords (comma-separated)</Label>
                          <Input placeholder="e.g., React, Node" {...register("targeting_criteria.professional.required_keywords", {
                            setValueAs: (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean)
                          })} />
                        </div>
                        <div>
                          <Label>Excluded Keywords (comma-separated)</Label>
                          <Input placeholder="e.g., Internship, Contract" {...register("targeting_criteria.professional.excluded_keywords", {
                            setValueAs: (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean)
                          })} />
                        </div>
                        <div>
                          <Label>Current Job Titles (comma-separated)</Label>
                          <Input placeholder="e.g., CTO, Head of Engineering" {...register("targeting_criteria.professional.current_job_titles", {
                            setValueAs: (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean)
                          })} />
                        </div>
                        <div>
                          <Label>Target Companies (comma-separated)</Label>
                          <Input placeholder="e.g., Google, Amazon" {...register("targeting_criteria.professional.target_companies", {
                            setValueAs: (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean)
                          })} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
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