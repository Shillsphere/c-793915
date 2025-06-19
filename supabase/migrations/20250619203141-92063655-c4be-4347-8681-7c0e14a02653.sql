-- Create user roles table first
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create enum for waitlist status
CREATE TYPE public.waitlist_status AS ENUM ('pending', 'accepted', 'rejected');

-- Create waitlist applications table
CREATE TABLE public.waitlist_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  linkedin TEXT NOT NULL,
  reason TEXT NOT NULL,
  status public.waitlist_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.waitlist_applications ENABLE ROW LEVEL SECURITY;

-- Create policies for user_roles - only admins can manage roles
CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Create policies for waitlist applications
-- Only allow admins to view all applications
CREATE POLICY "Admins can view all waitlist applications"
ON public.waitlist_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only allow admins to update applications
CREATE POLICY "Admins can update waitlist applications"
ON public.waitlist_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow anyone to insert their own application
CREATE POLICY "Anyone can submit waitlist application"
ON public.waitlist_applications
FOR INSERT
TO anon
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_waitlist_applications_updated_at
BEFORE UPDATE ON public.waitlist_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if user is on accepted waitlist
CREATE OR REPLACE FUNCTION public.is_user_accepted_on_waitlist(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.waitlist_applications
    WHERE email = user_email AND status = 'accepted'
  );
$$;

-- Function to prevent signup for non-accepted users
CREATE OR REPLACE FUNCTION public.handle_auth_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is on accepted waitlist
  IF NOT public.is_user_accepted_on_waitlist(NEW.email) THEN
    RAISE EXCEPTION 'Access denied. You must be accepted on the waitlist to create an account. Please apply at our website first.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate signup against waitlist
CREATE TRIGGER check_waitlist_before_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_signup();