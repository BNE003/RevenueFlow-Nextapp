"use client";

import * as React from "react";
import { Tooltip as RechartsTooltip } from "recharts";
import { cn } from "@/libs/utils";

export const ChartTooltipContent = ({
  label,
  payload,
  hideLabel = false,
  indicator = "dot",
  className,
}) => {
  if (!payload?.length) return null;

  return (
    <div
      className={cn(
        "min-w-[160px] rounded-xl border border-base-300 bg-base-100/95 p-3 text-xs shadow-xl backdrop-blur",
        className
      )}
    >
      {!hideLabel && (
        <div className="mb-2 text-sm font-semibold text-base-content">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((item) => (
          <div
            key={item.dataKey}
            className="flex items-center justify-between gap-4 text-base-content/80"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  indicator === "dot" ? "h-2 w-2 rounded-full" : "h-1 w-6"
                )}
                style={{ backgroundColor: item.color || "var(--chart-color)" }}
              />
              <span className="font-medium text-xs">{item.name}</span>
            </div>
            <span className="font-semibold text-xs text-base-content">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartTooltip = ({ content, cursor = false, ...props }) => {
  return (
    <RechartsTooltip
      cursor={cursor}
      content={content ?? <ChartTooltipContent />}
      wrapperClassName="chart-tooltip-wrapper"
      {...props}
    />
  );
};

export const ChartContainer = React.forwardRef(
  ({ className, children, config, ...props }, ref) => {
    const style = React.useMemo(() => {
      if (!config) return {};
      return Object.entries(config).reduce((acc, [key, value]) => {
        acc[`--chart-${key}`] = value;
        return acc;
      }, {});
    }, [config]);

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/30 p-4",
          className
        )}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ChartContainer.displayName = "ChartContainer";
