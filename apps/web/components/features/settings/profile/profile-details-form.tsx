"use client";

import { useFormContext, Controller } from "react-hook-form";
import { useSession } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";

export function ProfileDetailsForm() {
  const { data: session } = useSession();
  const { control, formState } = useFormContext();

  const focusClass = "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5 focus-visible:ring-emerald-500";

  return (
    <div className="flex-1 space-y-5">
      <div className="flex flex-col gap-6 w-full max-w-md">
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Full Name</FieldLabel>
              <Input
                 {...field}
                 id={field.name}
                 placeholder="John Doe"
                 aria-invalid={fieldState.invalid}
                 disabled={formState.isSubmitting}
                 autoComplete="off"
                className={fieldState.isDirty ? focusClass : ""}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <div className="space-y-2">
          <FieldLabel>Email Address</FieldLabel>
          <Input
             value={session?.user?.email || ""}
             placeholder="user@company.com"
             disabled
             className="bg-muted/50 text-muted-foreground cursor-not-allowed"
           />
          <p className="text-[11px] text-muted-foreground">Email changes require administrator approval.</p>
        </div>
      </div>
    </div>
  );
}
