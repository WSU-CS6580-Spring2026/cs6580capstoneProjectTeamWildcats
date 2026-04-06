"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col",
        month: "space-y-3",
        month_caption: "flex justify-center items-center h-8 px-8",
        caption_label: "text-sm font-semibold text-white",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between h-8 px-1",
        button_previous: cn(
          "inline-flex items-center justify-center rounded-md h-7 w-7 text-white/60",
          "hover:bg-white/10 hover:text-white transition-colors",
          "disabled:opacity-50 disabled:pointer-events-none"
        ),
        button_next: cn(
          "inline-flex items-center justify-center rounded-md h-7 w-7 text-white/60",
          "hover:bg-white/10 hover:text-white transition-colors",
          "disabled:opacity-50 disabled:pointer-events-none"
        ),
        month_grid: "w-full border-collapse mt-1",
        weekdays: "flex",
        weekday: "text-white/40 w-9 h-9 flex items-center justify-center text-[0.8rem] font-normal",
        weeks: "flex flex-col gap-1",
        week: "flex",
        day: "relative p-0 flex items-center justify-center",
        day_button: cn(
          "h-9 w-9 text-sm rounded-md font-normal text-white/80 transition-colors",
          "hover:bg-white/10 hover:text-white",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/30"
        ),
        selected: "[&>button]:bg-blue-500 [&>button]:text-white [&>button]:hover:bg-blue-600",
        today: "[&>button]:border [&>button]:border-blue-400/50 [&>button]:font-semibold [&>button]:text-white",
        outside: "[&>button]:text-white/50 [&>button]:opacity-60",
        disabled: "[&>button]:opacity-50 [&>button]:pointer-events-none",
        hidden: "invisible",
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left"
            ? <ChevronLeft className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";
export { Calendar };
