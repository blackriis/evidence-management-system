"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  disabled?: boolean;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, disabled, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState<number[]>(defaultValue || [0]);
    const currentValue = value || internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = [Number(e.target.value)];
      if (!value) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className
        )}
        {...props}
      >
        <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
          <div 
            className="absolute h-full bg-primary transition-all duration-200"
            style={{
              width: `${((currentValue[0] - min) / (max - min)) * 100}%`
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue[0]}
          onChange={handleChange}
          disabled={disabled}
          className="absolute w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <div 
          className="absolute block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          style={{
            left: `calc(${((currentValue[0] - min) / (max - min)) * 100}% - 10px)`
          }}
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };