'use client';

import { useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { submitContact } from '@/actions/contact/submit-contact';
import { Send, Check, Loader2 } from 'lucide-react';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phoneNumber: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type FormErrors = Partial<Record<keyof z.infer<typeof contactSchema>, string>>;

type FormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  message: string;
};

const initialState: FormState = {
  fullName: '',
  email: '',
  phoneNumber: '',
  message: '',
};

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const validation = contactSchema.safeParse({
      ...form,
      phoneNumber: form.phoneNumber || undefined,
    });

    if (!validation.success) {
      const fieldErrors: FormErrors = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormErrors;
        if (field) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const result = await submitContact({
        ...validation.data,
        phoneNumber: form.phoneNumber || undefined,
      });

      if ('error' in result) {
        toast.error(result.error);
        return;
      }

      setSubmitted(true);
      toast.success('Message sent successfully!');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="contact-form-sheet contact-success-box">
        <div className="contact-success-icon" aria-hidden="true">
          <Check className="h-8 w-8 stroke-[3]" />
        </div>
        <h3 className="contact-form-title font-display font-extrabold tracking-tight text-2xl sm:text-3xl">
          Message Sent!
        </h3>
        <p className="sk-hand text-xl text-muted-foreground max-w-md">
          Thank you for reaching out! We&apos;ve received your message and will get back to you within 24 hours.
        </p>
        <button
          type="button"
          className="sk-btn sk-btn-main mt-4"
          onClick={() => {
            setSubmitted(false);
            setForm(initialState);
          }}
        >
          Send another message ✍ →
        </button>
      </div>
    );
  }

  return (
    <div className="contact-form-sheet">
      <span className="contact-sheet-badge sk-hand" aria-hidden="true">
        ✍ Direct to our team
      </span>
      <h2 className="contact-form-title font-display font-extrabold tracking-tight">
        Send us a message
      </h2>
      <p className="contact-form-desc">
        Fill out the form below and we&apos;ll get back to you within 24 hours.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sk-field">
            <label htmlFor="fullName" className="sk-label">
              Full Name <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="John Doe"
              className="sk-input"
              value={form.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              disabled={isLoading}
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? 'fullName-error' : undefined}
            />
            {errors.fullName && (
              <p id="fullName-error" className="sk-error">
                {errors.fullName}
              </p>
            )}
          </div>

          <div className="sk-field">
            <label htmlFor="email" className="sk-label">
              Email Address <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              className="sk-input"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              disabled={isLoading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="sk-error">
                {errors.email}
              </p>
            )}
          </div>
        </div>

        <div className="sk-field">
          <label htmlFor="phoneNumber" className="sk-label">
            Phone Number <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            placeholder="+1 (555) 123-4567"
            className="sk-input"
            value={form.phoneNumber}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="sk-field">
          <label htmlFor="message" className="sk-label">
            Message <span className="text-destructive" aria-hidden="true">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            placeholder="Tell us about your project, questions, or ideas..."
            rows={5}
            className="sk-textarea"
            value={form.message}
            onChange={(e) => handleChange('message', e.target.value)}
            disabled={isLoading}
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? 'message-error' : undefined}
          />
          {errors.message && (
            <p id="message-error" className="sk-error">
              {errors.message}
            </p>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="sk-btn sk-btn-main contact-submit-btn"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending message...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Send Message ✍ →</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
