'use client';

import * as React from 'react';
import PhoneInputWithCountrySelect, { type Value } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { cn } from '@/lib/utils';

export type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> & {
  onChange: (value: Value | undefined) => void;
  value?: Value | undefined;
  error?: boolean;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, onChange, value, error, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex h-10 w-full items-center rounded-lg border-2 border-border bg-card px-3 text-sm transition-all focus-within:border-ink focus-within:shadow-[2px_2px_0_hsl(var(--offset))]',
          error && 'border-destructive focus-within:border-destructive shadow-[2px_2px_0_hsl(var(--destructive))]',
          className
        )}
      >
        <PhoneInputWithCountrySelect
          international
          defaultCountry="US"
          value={value}
          onChange={onChange}
          className="flex w-full items-center gap-2.5 [&_.PhoneInputCountry]:flex [&_.PhoneInputCountry]:items-center [&_.PhoneInputCountry]:gap-1.5 [&_.PhoneInputCountryIcon]:h-4 [&_.PhoneInputCountryIcon]:w-6 [&_.PhoneInputCountryIcon]:rounded-sm [&_.PhoneInputCountrySelect]:cursor-pointer [&_.PhoneInputCountrySelectArrow]:opacity-60 [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:text-foreground [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:placeholder:text-muted-foreground"
          numberInputProps={{
            className: 'w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground',
          }}
          countrySelectProps={{
            className: 'cursor-pointer outline-none',
          }}
        />
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
