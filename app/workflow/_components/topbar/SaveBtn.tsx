"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { UpdateWorkflow } from "@/actions/workflows/updateWorkflow";

const SaveBtn = ({ workflowId }: { workflowId: string }) => {
  const { toObject } = useReactFlow();

  const saveMutation = useMutation({
    mutationFn: UpdateWorkflow,
    onSuccess: () => {
      toast.success("Flow saved successfully", { id: "save-workflow" });
    },
    onError: (error) => {
      toast.error("Something went wrong", { id: "save-workflow" });
    },
  });

  return (
    <div>
      <Button
        disabled={saveMutation.isPending}
        variant={"outline"}
        className="flex items-center gap-2"
        onClick={() => {
          const workflowDefiniton = JSON.stringify(toObject());
          toast.loading("Saving workflow...", { id: "save-workflow" });
          saveMutation.mutate({
            id: workflowId,
            definition: workflowDefiniton,
          });
        }}
      >
        <CheckIcon size={16} className="stroke-green-400" />
        Save
      </Button>
    </div>
  );
};

export default SaveBtn;
