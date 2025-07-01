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
import { Textarea } from "@/components/ui/textarea";

const nonEmptyStringArray = (s: string): string[] =>
  s
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length && v.toLowerCase() !== 'any');

const campaignSchema = z.object({
  campaign_name: z.string().min(1, "Campaign name is required"),
  keywords: z.string().min(1, "Keywords are required"),
  template: z.string().min(1, "Message template is required"),
  daily_limit: z.coerce.number().min(1, "Daily limit must be at least 1"),
  weekly_limit: z.coerce.number().min(1, "Weekly limit must be at least 1"),
  targeting_criteria: z
    .object({
      demographics: z
        .object({
          min_experience_years: z.coerce.number().optional(),
          max_experience_years: z.coerce.number().optional(),
          location: z.string().optional(),
          gender_keywords: z.union([z.string(), z.array(z.string())]).optional(),
        })
        .partial()
        .optional(),
      professional: z
        .object({
          industries: z.union([z.string(), z.array(z.string())]).optional(),
          seniority_levels: z.union([z.string(), z.array(z.string())]).optional(),
          company_size: z.string().optional(),
          required_keywords: z.union([z.string(), z.array(z.string())]).optional(),
          excluded_keywords: z.union([z.string(), z.array(z.string())]).optional(),
          current_job_titles: z.union([z.string(), z.array(z.string())]).optional(),
          target_companies: z.union([z.string(), z.array(z.string())]).optional(),
        })
        .partial()
        .optional(),
    })
    .partial()
    .optional(),
});

const deepClean = (obj: any) => {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const cleaned = obj.map(deepClean).filter((v) => v !== undefined && v !== 'any');
    return cleaned.length ? cleaned : undefined;
  }
  if (typeof obj === 'object') {
    const cleanedObj: Record<string, any> = {};
    Object.entries(obj).forEach(([k, v]) => {
      const cleaned = deepClean(v as any);
      if (cleaned !== undefined && cleaned !== '') cleanedObj[k] = cleaned;
    });
    return Object.keys(cleanedObj).length ? cleanedObj : undefined;
  }
  if (typeof obj === 'string' && obj.toLowerCase() === 'any') return undefined;
  return obj;
};

const createCampaign = async (newCampaignData: z.infer<typeof campaignSchema>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const payload = {
    ...newCampaignData,
    targeting_criteria: newCampaignData.targeting_criteria ?? null,
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
        // transform comma-separated strings into arrays
        if (formData.targeting_criteria?.demographics?.gender_keywords && typeof (formData.targeting_criteria.demographics.gender_keywords as unknown) === 'string') {
          formData.targeting_criteria.demographics.gender_keywords = nonEmptyStringArray(formData.targeting_criteria.demographics.gender_keywords as unknown as string);
        }

        if (formData.targeting_criteria?.professional?.industries && typeof (formData.targeting_criteria.professional.industries as unknown) === 'string') {
          formData.targeting_criteria.professional.industries = nonEmptyStringArray(formData.targeting_criteria.professional.industries as unknown as string);
        }

        // Additional professional arrays
        const prof = formData.targeting_criteria?.professional;
        if (prof) {
          if (prof.required_keywords && typeof prof.required_keywords === 'string') {
            prof.required_keywords = nonEmptyStringArray(prof.required_keywords as unknown as string);
          }
          if (prof.excluded_keywords && typeof prof.excluded_keywords === 'string') {
            prof.excluded_keywords = nonEmptyStringArray(prof.excluded_keywords as unknown as string);
          }
          if (prof.current_job_titles && typeof prof.current_job_titles === 'string') {
            prof.current_job_titles = nonEmptyStringArray(prof.current_job_titles as unknown as string);
          }
          if (prof.target_companies && typeof prof.target_companies === 'string') {
            prof.target_companies = nonEmptyStringArray(prof.target_companies as unknown as string);
          }
        }

        // remove empty / undefined fields
        const cleaned = {
          ...formData,
          targeting_criteria: deepClean(formData.targeting_criteria)
        } as z.infer<typeof campaignSchema>;

        mutation.mutate(cleaned);
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
              <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                {/* Template */}
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="template">Message Template</Label>
                  <Textarea id="template" {...register("template")} placeholder="Hi {name}, I'd love to connect..." />
                  <p className="text-xs text-muted-foreground mt-1 space-y-1">
                    <span className="block">Tips:</span>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Use <code>{`{name}`}</code> to inject the prospect's first name.</li>
                      <li>Start with <strong>ai:</strong> to let our AI write the note, e.g. <em>ai: Write a friendly 2-sentence invite to {`{name}`}</em>.</li>
                      <li>Keep it under 300 characters for best acceptance rates.</li>
                      <li>Focus on mutual value—why connecting helps them.</li>
                    </ul>
                  </p>
                  {errors.template && <p className="text-red-500 text-sm">{errors.template.message}</p>}
                </div>

                {/* Basic Campaign Details */}
                <div className="space-y-4">
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="campaign_name">Name</Label>
                    <Input id="campaign_name" {...register("campaign_name")} />
                    {errors.campaign_name && <p className="text-red-500 text-sm">{errors.campaign_name.message}</p>}
                  </div>

                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="keywords">Keywords</Label>
                    <Input id="keywords" {...register("keywords")} />
                    {errors.keywords && <p className="text-red-500 text-sm">{errors.keywords.message}</p>}
                  </div>

                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="daily_limit">Daily Limit</Label>
                    <Input id="daily_limit" type="number" {...register("daily_limit", { valueAsNumber: true })} defaultValue={20} />
                    {errors.daily_limit && <p className="text-red-500 text-sm">{errors.daily_limit.message}</p>}
                  </div>

                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="weekly_limit">Weekly Limit</Label>
                    <Input id="weekly_limit" type="number" {...register("weekly_limit", { valueAsNumber: true })} defaultValue={100} />
                    {errors.weekly_limit && <p className="text-red-500 text-sm">{errors.weekly_limit.message}</p>}
                  </div>
                </div>
                {/* -------- Advanced Targeting Accordion ---------- */}
                <h3 className="text-lg font-semibold border-t pt-4">Advanced Targeting</h3>
                <div className="col-span-4">
                  <Accordion type="multiple" className="w-full">
                    <AccordionItem value="demographics">
                      <AccordionTrigger>Demographics</AccordionTrigger>
                      <AccordionContent className="space-y-4 p-2">
                          <div>
                            <Label>Minimum Years of Experience</Label>
                            <Input type="number" {...register("targeting_criteria.demographics.min_experience_years", { valueAsNumber: true })} />
                            <Label className="mt-2">Maximum Years of Experience</Label>
                            <Input type="number" {...register("targeting_criteria.demographics.max_experience_years", { valueAsNumber: true })} />
                        </div>
                        <div>
                          <Label>Location (e.g., United States)</Label>
                          <Input {...register("targeting_criteria.demographics.location")} />
                        </div>
                        <div>
                          <Label>Gender Keywords (comma-separated)</Label>
                          <Input placeholder="e.g., women, she/her" {...register("targeting_criteria.demographics.gender_keywords")} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="professional">
                      <AccordionTrigger>Professional</AccordionTrigger>
                      <AccordionContent className="space-y-4 p-2">
                        <div>
                          <Label>Industries (comma-separated)</Label>
                          <Input placeholder="e.g., Technology, Healthcare" {...register("targeting_criteria.professional.industries")} />
                        </div>
                        <div>
                          <Label>Seniority Levels (comma-separated)</Label>
                          <Input placeholder="e.g., Manager, Director" {...register("targeting_criteria.professional.seniority_levels")} />
                        </div>
                        <div>
                          <Label>Company Size</Label>
                          <Input placeholder="e.g., Startup, Small, Medium, Large, Enterprise" {...register("targeting_criteria.professional.company_size")} />
                        </div>
                        <div>
                          <Label>Required Keywords (comma-separated)</Label>
                          <Input placeholder="e.g., AI, Machine Learning" {...register("targeting_criteria.professional.required_keywords")} />
                        </div>
                        <div>
                          <Label>Excluded Keywords (comma-separated)</Label>
                          <Input placeholder="e.g., Intern, Trainee" {...register("targeting_criteria.professional.excluded_keywords")} />
                        </div>
                        <div>
                          <Label>Current Job Titles (comma-separated)</Label>
                          <Input placeholder="e.g., CEO, Founder" {...register("targeting_criteria.professional.current_job_titles")} />
                        </div>
                        <div>
                          <Label>Target Companies (comma-separated)</Label>
                          <Input placeholder="e.g., Google, Microsoft" {...register("targeting_criteria.professional.target_companies")} />
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