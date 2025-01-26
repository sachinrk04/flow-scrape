"use client";

import React, { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StringParamProps } from "@/types/appNode";

const StringParam = ({
  param,
  value,
  updateNodeParamValue,
}: StringParamProps) => {
  const [internalValue, setInternalValue] = useState(value);
  const id = useId();
  return (
    <div className="space-y-1 p-1 w-full">
      <Label htmlFor={id} className="text-xs flex">
        {param.name}
        {param.required && <span className="text-red-400 px-2">*</span>}
      </Label>
      <Input
        id={id}
        className="text-xs"
        value={internalValue}
        placeholder="Enter value here"
        onChange={(e) => setInternalValue(e.target.value)}
        onBlur={(e) => updateNodeParamValue(e.target.value)}
      />
      {param.helperText && (
        <p className="text-muted-foreground px-2">{param.helperText}</p>
      )}
    </div>
  );
};

export default StringParam;
