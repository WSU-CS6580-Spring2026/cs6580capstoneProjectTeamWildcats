"use client";

import { Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface SnowToggleProps {
  enabled: boolean;
  onToggle: () => void;
  className?: string;
}

export function SnowToggle({ enabled, onToggle, className }: SnowToggleProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={className}
          >
            <Snowflake
              className={`h-4 w-4 transition-colors ${
                enabled ? "text-blue-500" : "text-muted-foreground"
              }`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {enabled ? "Disable snow" : "Enable snow"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
