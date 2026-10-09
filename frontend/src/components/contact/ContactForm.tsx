"use client";

import { Send } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Recaptcha, type RecaptchaHandle } from "@/components/ui/Recaptcha";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ApiError } from "@/lib/api";
import { submitContact } from "@/lib/api/contact";
import { CONTACT_SUBJECT_OPTIONS } from "@/lib/constants/contact-content";
import type { ContactSubject } from "@/lib/types/contact";

const CAPTCHA_ERROR_CODES = new Set(["AUTH_CAPTCHA_FAILED", "AUTH_CAPTCHA_REQUIRED", "CAPTCHA_UNAVAILABLE"]);

const EMPTY_FORM = {
  fullName: "",
  email: "",
  phone: "",
  subject: "" as ContactSubject | "",
  message: "",
  acceptedTerms: false,
  website: "", // honeypot
};

export function ContactForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaHandle>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!form.subject) {
      setError("Please select a subject.");
      return;
    }

    if (!captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitContact({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        subject: form.subject,
        message: form.message,
        acceptedTerms: form.acceptedTerms,
        captchaToken,
        website: form.website,
      });
      setForm(EMPTY_FORM);
      setCaptchaToken(null);
      setSuccessMessage("Thanks for reaching out! We'll get back to you as soon as possible.");
    } catch (err) {
      if (err instanceof ApiError && CAPTCHA_ERROR_CODES.has(err.code ?? "")) {
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
        setError(
          err.code === "CAPTCHA_UNAVAILABLE"
            ? "CAPTCHA verification is temporarily unavailable. Please try again."
            : "CAPTCHA verification failed. Please complete the checkbox again."
        );
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm md:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">Send Us a Message</p>
      <h2 className="mt-1 font-serif text-2xl font-semibold text-text md:text-3xl">
        We&apos;d Love to Hear From You
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Fill out the form below and we&apos;ll get back to you as soon as possible.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {error ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}
        {successMessage ? (
          <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            {successMessage}
          </p>
        ) : null}

        {/* Honeypot: hidden from sighted and screen-reader users; bots that fill
            it get a fake success instead of a real submission. */}
        <input
          type="text"
          name="website"
          value={form.website}
          onChange={(e) => update("website", e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Full Name" htmlFor="fullName" required>
            <Input
              id="fullName"
              required
              minLength={2}
              maxLength={100}
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="Enter your full name"
            />
          </FormField>
          <FormField label="Email Address" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
            />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Phone Number" htmlFor="phone">
            <Input
              id="phone"
              type="tel"
              maxLength={30}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+92 300 1234567"
            />
          </FormField>
          <FormField label="Subject" htmlFor="subject" required>
            <Select
              id="subject"
              required
              value={form.subject}
              onChange={(e) => update("subject", e.target.value as ContactSubject)}
              options={[{ label: "Select a subject", value: "" }, ...CONTACT_SUBJECT_OPTIONS]}
            />
          </FormField>
        </div>

        <FormField label="Your Message" htmlFor="message" required>
          <Textarea
            id="message"
            required
            minLength={10}
            maxLength={2000}
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            placeholder="Type your message here..."
          />
        </FormField>

        <Checkbox
          id="acceptedTerms"
          required
          checked={form.acceptedTerms}
          onChange={(e) => update("acceptedTerms", e.target.checked)}
          label="I agree to the Terms & Conditions and Privacy Policy"
        />

        <Recaptcha ref={recaptchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

        <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting} className="w-full">
          <Send className="h-4 w-4" aria-hidden />
          Send Message
        </Button>
      </form>
    </div>
  );
}
