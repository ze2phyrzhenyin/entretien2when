"use client";

import type { ComponentProps } from "react";

type ConfirmFormProps = ComponentProps<"form"> & {
  confirmMessage: string;
};

/**
 * Use for destructive Server Action forms. Keeping confirmation at the form
 * boundary also covers keyboard submission, rather than only button clicks.
 */
export function ConfirmForm({ confirmMessage, onSubmit, ...props }: ConfirmFormProps) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        onSubmit?.(event);
      }}
    />
  );
}
