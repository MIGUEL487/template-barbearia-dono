"use client";
import {
  Children,
  isValidElement,
  type ReactElement,
  type SelectHTMLAttributes,
  type ChangeEvent,
} from "react";
import {
  CustomSelect,
  type SelectOption,
} from "@/components/admin/custom-select";
function flatten(children: React.ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((n) => {
    if (!isValidElement(n)) return [];
    const el = n as ReactElement<{
      value?: string | number;
      children?: React.ReactNode;
    }>;
    if (el.type === "optgroup") return flatten(el.props.children);
    if (el.type !== "option") return [];
    const label = Children.toArray(el.props.children).join("");
    return [{ value: String(el.props.value ?? label), label }];
  });
}
export function AnimatedSelect({
  children,
  value,
  onChange,
  className,
  id,
  disabled,
  "aria-label": ariaLabel,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={"ui-select-field " + (className || "")}>
      <CustomSelect
        value={String(value ?? "")}
        options={flatten(children)}
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(v) =>
          onChange?.({
            target: { value: v },
            currentTarget: { value: v },
          } as ChangeEvent<HTMLSelectElement>)
        }
      />
      <select
        {...props}
        data-native-select
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: "none" }}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        {children}
      </select>
    </div>
  );
}
