"use client";

import type { PopoverContentProps } from "@radix-ui/react-popover";
import {
  type HexColor,
  hexToHsva,
  type HslaColor,
  hslaToHsva,
  type HsvaColor,
  hsvaToHex,
  hsvaToHsla,
  hsvaToHslString,
  hsvaToRgba,
  type RgbaColor,
  rgbaToHsva,
} from "@uiw/color-convert";
import Hue from "@uiw/react-color-hue";
import Saturation from "@uiw/react-color-saturation";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import React from "react";

import { Badge, type BadgeProps } from "@/components/ui/shadcn/badge";
import { Button } from "@/components/ui/shadcn/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/shadcn/dropdown-menu";
import { Input } from "@/components/ui/shadcn/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { Separator } from "@/components/ui/shadcn/separator";
import { cn } from "@/lib/utils";

// Adapted from the shadcn "color-picker" block. Changes from the original: every change (including the HSL, RGB and
// hex fields) reaches onValueChange with the NEW colour (the original sent the previous one), the value prop updates
// the picker, the popover can be controlled, and a footer slot lets the host add Apply / Remove buttons.

function getColorAsHsva(color: `#${string}` | HsvaColor | HslaColor | RgbaColor): HsvaColor {
  if (typeof color === "string") {
    return hexToHsva(color);
  } else if ("h" in color && "s" in color && "v" in color) {
    return color;
  } else if ("r" in color) {
    return rgbaToHsva(color);
  } else {
    return hslaToHsva(color);
  }
}

type ColorPickerValue = {
  hex: string;
  hsl: HslaColor;
  rgb: RgbaColor;
};

const toValue = (hsva: HsvaColor): ColorPickerValue => ({ hex: hsvaToHex(hsva), hsl: hsvaToHsla(hsva), rgb: hsvaToRgba(hsva) });

type ColorPickerProps = {
  value?: `#${string}` | HsvaColor | HslaColor | RgbaColor;
  type?: "hsl" | "rgb" | "hex";
  swatches?: HexColor[];
  hideContrastRatio?: boolean;
  hideDefaultSwatches?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: ColorPickerValue) => void;
  /** Extra controls under the picker (for example Apply and Remove); gets the current colour and a way to close. */
  footer?: (state: { value: ColorPickerValue; close: () => void }) => React.ReactNode;
  children: React.ReactNode;
} & Pick<PopoverContentProps, "side" | "align" | "sideOffset">;

function ColorPicker({
  value,
  children,
  type = "hsl",
  swatches = [],
  hideContrastRatio,
  hideDefaultSwatches,
  open,
  onOpenChange,
  onValueChange,
  footer,
  className,
  ...contentProps
}: ColorPickerProps) {
  const [colorType, setColorType] = React.useState(type);
  const [colorHsv, setColorHsv] = React.useState<HsvaColor>(value ? getColorAsHsva(value) : { h: 0, s: 0, v: 0, a: 1 });

  // A new value from outside (for example the colour of the selected text) moves the picker to it.
  const valueKey = typeof value === "string" ? value : value ? JSON.stringify(value) : "";
  const [seenKey, setSeenKey] = React.useState(valueKey);
  if (valueKey !== seenKey) {
    setSeenKey(valueKey);
    if (value) setColorHsv(getColorAsHsva(value));
  }

  const handleValueChange = (color: HsvaColor) => {
    setColorHsv(color);
    onValueChange?.(toValue(color));
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className={cn("w-[350px] p-0", className)}
        {...contentProps}
        style={
          {
            "--selected-color": hsvaToHslString(colorHsv),
          } as React.CSSProperties
        }
        // Keep focus in the editor so the text stays selected while a colour is picked.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-2 p-4">
          <Saturation
            hsva={colorHsv}
            onChange={(newColor) => {
              handleValueChange(newColor);
            }}
            style={{
              width: "100%",
              height: "auto",
              aspectRatio: "4/2",
              borderRadius: "0.3rem",
            }}
            className="border border-border"
          />
          <Hue
            hue={colorHsv.h}
            onChange={(newHue) => {
              handleValueChange({ ...colorHsv, ...newHue });
            }}
            className="[&>div:first-child]:overflow-hidden [&>div:first-child]:!rounded"
            style={
              {
                width: "100%",
                height: "0.9rem",
                borderRadius: "0.3rem",
                "--alpha-pointer-background-color": "var(--color-foreground)",
              } as React.CSSProperties
            }
          />

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shrink-0 justify-between uppercase">
                  {colorType}
                  <ChevronDownIcon className="-me-1 ms-2 opacity-60" size={16} strokeWidth={2} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuCheckboxItem checked={colorType === "hex"} onCheckedChange={() => setColorType("hex")}>
                  HEX
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={colorType === "hsl"} onCheckedChange={() => setColorType("hsl")}>
                  HSL
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={colorType === "rgb"} onCheckedChange={() => setColorType("rgb")}>
                  RGB
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex grow">
              {colorType === "hsl" && <ObjectColorInput value={hsvaToHsla(colorHsv)} label="hsl" onValueChange={(v) => handleValueChange(hslaToHsva(v))} />}
              {colorType === "rgb" && <ObjectColorInput value={hsvaToRgba(colorHsv)} label="rgb" onValueChange={(v) => handleValueChange(rgbaToHsva(v))} />}
              {colorType === "hex" && (
                <Input
                  className="flex"
                  value={hsvaToHex(colorHsv)}
                  onChange={(e) => {
                    if (/^#[0-9a-f]{6}$/i.test(e.target.value)) handleValueChange(hexToHsva(e.target.value));
                  }}
                />
              )}
            </div>
          </div>
          {!hideDefaultSwatches && (
            <>
              <Separator />
              <div className="flex flex-wrap justify-start gap-2">
                {["#F8371A", "#F97C1B", "#FAC81C", "#3FD0B6", "#2CADF6", "#6462FC", ...swatches]
                  .sort((a, b) => hexToHsva(a).h - hexToHsva(b).h)
                  .map((color) => (
                    <button
                      type="button"
                      key={`${color}-swatch`}
                      style={{ "--swatch-color": color } as React.CSSProperties}
                      onClick={() => handleValueChange(hexToHsva(color))}
                      aria-label={`Set color to ${color}`}
                      className="size-5 cursor-pointer rounded bg-[var(--swatch-color)] ring-2 ring-transparent ring-offset-1 ring-offset-background transition-all duration-100 hover:ring-[var(--swatch-color)]"
                    />
                  ))}
              </div>
            </>
          )}
          {!hideContrastRatio && (
            <>
              <Separator />
              <ContrastRatio color={colorHsv} />
            </>
          )}
          {footer && (
            <>
              <Separator />
              {footer({ value: toValue(colorHsv), close: () => onOpenChange?.(false) })}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const ValidationBadge = ({
  ratio,
  ratioLimit,
  className,
  children,
  ...props
}: {
  ratio: number;
  ratioLimit: number;
} & Omit<BadgeProps, "variant">) => (
  <Badge
    variant="outline"
    className={cn("gap-2 rounded-full text-muted-foreground", ratio > ratioLimit && "border-transparent bg-emerald-500/20 text-emerald-700 dark:text-emerald-400", className)}
    {...props}
  >
    {ratio > 4.5 ? <CheckIcon size={16} /> : <XIcon size={16} />}
    {children}
  </Badge>
);

type ContrastRatioProps = {
  color: HsvaColor;
};

function ContrastRatio({ color }: ContrastRatioProps) {
  const rgb = hsvaToRgba(color);
  const toSRGB = (c: number) => {
    const channel = c / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * toSRGB(rgb.r) + 0.7152 * toSRGB(rgb.g) + 0.0722 * toSRGB(rgb.b);
  const darkModeContrastRatio = Number(((1.0 + 0.05) / (luminance + 0.05)).toFixed(2));
  const lightModeContrastValue = Number(((luminance + 0.05) / 0.05).toFixed(2));

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex size-10 items-center justify-center rounded bg-[var(--selected-color)]">
          <span className="font-medium text-black dark:text-white">A</span>
        </div>
        <div className="flex flex-col justify-between">
          <span className="whitespace-nowrap text-xs text-muted-foreground">Contrast Ratio</span>
          <span className="hidden text-sm dark:flex">{darkModeContrastRatio}</span>
          <span className="text-sm dark:hidden">{lightModeContrastValue}</span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1">
        <ValidationBadge className="dark:hidden" ratio={lightModeContrastValue} ratioLimit={4.5}>
          AA
        </ValidationBadge>
        <ValidationBadge className="dark:hidden" ratio={lightModeContrastValue} ratioLimit={7}>
          AAA
        </ValidationBadge>
        <ValidationBadge className="hidden dark:flex" ratio={darkModeContrastRatio} ratioLimit={4.5}>
          AA
        </ValidationBadge>
        <ValidationBadge className="hidden dark:flex" ratio={darkModeContrastRatio} ratioLimit={7}>
          AAA
        </ValidationBadge>
      </div>
    </div>
  );
}

type ObjectColorInputProps =
  | {
      label: "hsl";
      value: HslaColor;
      onValueChange?: (value: HslaColor) => void;
    }
  | {
      label: "rgb";
      value: RgbaColor;
      onValueChange?: (value: RgbaColor) => void;
    };

function ObjectColorInput({ value, label, onValueChange }: ObjectColorInputProps) {
  const fields = label === "hsl" ? (["h", "s", "l"] as const) : (["r", "g", "b"] as const);

  function change(key: string, raw: string) {
    const n = Number(raw);
    if (!onValueChange || raw.trim() === "" || !Number.isFinite(n)) return;
    const max = key === "h" ? 360 : label === "hsl" ? 100 : 255;
    const next = { ...value, [key]: Math.min(max, Math.max(0, n)) };
    if (label === "hsl") (onValueChange as (v: HslaColor) => void)(next as HslaColor);
    else (onValueChange as (v: RgbaColor) => void)(next as RgbaColor);
  }

  return (
    <div className="-mt-px flex">
      {fields.map((key, i) => (
        <div key={key} className={cn("relative min-w-0 flex-1 focus-within:z-10", i > 0 && "-ms-px")}>
          <Input
            className={cn("peer shadow-none [direction:inherit]", i === 0 && "rounded-e-none", i === 1 && "rounded-none", i === 2 && "rounded-s-none")}
            inputMode="numeric"
            aria-label={key.toUpperCase()}
            value={Math.round((value as unknown as Record<string, number>)[key])}
            onChange={(e) => change(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

export { ColorPicker };
export type { ColorPickerProps, ColorPickerValue };
