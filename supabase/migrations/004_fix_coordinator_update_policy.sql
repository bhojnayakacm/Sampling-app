-- Fix the UPDATE policy: ONLY coordinators can update requests (not admins)
-- This allows coordinators to assign makers, approve, and change status

-- Drop the old policy that included admins
DROP POLICY IF EXISTS "Coordinators and Admins can update all requests" ON public.requests;

-- Create new policy for ONLY coordinators
CREATE POLICY "Coordinators can update all requests"
ON public.requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'coordinator'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'coordinator'
  )
);
