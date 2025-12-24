'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Zod schema for entity form validation
 * Defines all required and optional fields with validation rules
 */
const entityFormSchema = z.object({
  mode: z.enum(['new', 'existing']).default('new'),
  id: z.string().optional(),
  name: z.string().trim().min(2, {
    message: 'Entity name must be at least 2 characters.',
  }),
  type: z.string({
    required_error: 'Please enter an entity type.',
  }),
  jurisdiction: z.string().trim().min(1, {
    required_error: 'Please enter a jurisdiction.',
  }),
  registrationNumber: z.string().trim().min(1, {
    message: 'Registration/Tax ID number is required.',
  }),
  description: z.string().optional(),
  contactEmail: z.string().email({ message: 'Please enter a valid email address.' }).optional().or(z.literal('')),
  contactPhone: z.string()
    .regex(/^[\d\s\-+()]*$/, { message: 'Phone can only contain digits, spaces, dashes, plus signs, and parentheses.' })
    .optional()
    .or(z.literal('')),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressCountry: z.string().optional(),
}).superRefine((data, ctx) => {
  // When editing an existing entity, ID is required
  if (data.mode === 'existing' && !data.id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Entity ID is required when editing an existing entity.',
      path: ['id'],
    });
  }
});

/** Inferred type from Zod schema for form values */
export type EntityFormValues = z.infer<typeof entityFormSchema>;

/**
 * API response type for entity operations
 * Extends form values with server-generated fields
 */
interface EntityApiResponse extends EntityFormValues {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Props for EntityForm component
 */
interface EntityFormProps {
  /** Form mode: 'new' for creating, 'existing' for editing */
  mode: 'new' | 'existing';
  /** Entity ID required when mode is 'existing' */
  entityId?: string;
  /** Pre-filled form values */
  defaultValues?: Partial<EntityFormValues>;
  /** Callback fired on successful create/fetch operation */
  onSuccess?: (entity: EntityApiResponse) => void;
  /** Custom submit button text */
  submitButtonText?: string;
  /** Path to redirect after successful submission */
  redirectPath?: string;
  /** Whether to show extended fields (address, contact) */
  showAdditionalFields?: boolean;
}

/**
 * Reusable form component for creating and editing legal entities
 *
 * Features:
 * - Zod schema validation with React Hook Form
 * - Create and edit modes with appropriate API calls
 * - Loading states and skeleton placeholders
 * - Toast notifications for user feedback
 * - Optional redirect after submission
 *
 * @example
 * // Create mode
 * <EntityForm mode="new" onSuccess={(entity) => console.log(entity.id)} />
 *
 * // Edit mode
 * <EntityForm mode="existing" entityId="uuid-123" />
 */
export function EntityForm({
  mode,
  entityId,
  defaultValues,
  onSuccess,
  submitButtonText = mode === 'new' ? 'Create Entity' : 'Save Changes',
  redirectPath,
  showAdditionalFields = mode === 'existing',
}: EntityFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(mode === 'existing');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EntityFormValues>({
    resolver: zodResolver(entityFormSchema),
    defaultValues: {
      mode,
      id: entityId,
      ...(defaultValues || {
        name: '',
        type: '',
        jurisdiction: '',
        registrationNumber: '',
        description: '',
        contactEmail: '',
        contactPhone: '',
        addressLine1: '',
        addressLine2: '',
        addressCity: '',
        addressState: '',
        addressPostalCode: '',
        addressCountry: '',
      }),
    }
  });

  /**
   * Fetch existing entity data when in edit mode
   */
  useEffect(() => {
    if (mode !== 'existing' || !entityId) return;

    const fetchEntityDetails = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/issuer/entities/${entityId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch entity details');
        }

        const data: EntityApiResponse = await response.json();

        form.reset({
          mode: 'existing',
          id: entityId,
          name: data.name,
          type: data.type,
          jurisdiction: data.jurisdiction,
          registrationNumber: data.registrationNumber,
          description: data.description || '',
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || '',
          addressLine1: data.addressLine1 || '',
          addressLine2: data.addressLine2 || '',
          addressCity: data.addressCity || '',
          addressState: data.addressState || '',
          addressPostalCode: data.addressPostalCode || '',
          addressCountry: data.addressCountry || '',
        });

        onSuccess?.(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast({
          title: 'Error',
          description: `Failed to load entity details: ${message}`,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntityDetails();
  }, [entityId, mode, onSuccess, form, toast]);

  /**
   * Handle form submission for create/update operations
   */
  const onSubmit = async (data: EntityFormValues) => {
    setIsSubmitting(true);
    try {
      const url = mode === 'new'
        ? '/api/issuer/entities'
        : `/api/issuer/entities/${entityId}`;

      const method = mode === 'new' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${mode === 'new' ? 'create' : 'update'} entity`);
      }

      const responseData: EntityApiResponse = await response.json();

      toast({
        title: 'Success',
        description: `Entity has been ${mode === 'new' ? 'created' : 'updated'} successfully.`,
      });

      if (mode === 'new') {
        onSuccess?.(responseData);
      }

      if (redirectPath) {
        router.push(redirectPath);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entity Details</CardTitle>
        <CardDescription>
          {mode === 'new'
            ? 'Provide information about your legal entity.'
            : 'Update information about your legal entity.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter legal entity name" {...field} />
                    </FormControl>
                    <FormDescription>
                      The official registered name of your entity.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entity Type</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g., Corporation, LLC, Partnership" {...field} />
                      </FormControl>
                      <FormDescription>
                        The legal structure of your entity.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jurisdiction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jurisdiction</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g., Delaware, USA or United Kingdom" {...field} />
                      </FormControl>
                      <FormDescription>
                        The country or region where your entity is registered.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="registrationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration/Tax ID Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter registration or tax ID number" {...field} />
                    </FormControl>
                    <FormDescription>
                      The official registration or tax identification number of your entity.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showAdditionalFields && (
                <>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter a brief description of the entity"
                            className="resize-none"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          A brief description of the entity and its business activities.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <h3 className="text-lg font-medium pt-4">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter contact email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter contact phone number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <h3 className="text-lg font-medium pt-4">Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="addressLine1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input placeholder="Street address, P.O. box, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="addressLine2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Apartment, suite, unit, building, floor, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="addressCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="addressState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input placeholder="State or province" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="addressPostalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Postal or ZIP code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="addressCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="Country" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {mode === 'new' ? 'Creating...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> {submitButtonText}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
