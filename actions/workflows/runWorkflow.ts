"use server";

import prisma from "@/lib/prisma";
import {ExecuteWorkflow} from "@/lib/workflow/executeWorkflow";
import {FlowToExecutionPlan} from "@/lib/workflow/executionPlan";
import {TaskRegistry} from "@/lib/workflow/task/registry";
import {
    ExecutionPhaseStatus,
    WorkflowExecutionPlan,
    WorkflowExecutionStatus,
    WorkflowExecutionTrigger,
} from "@/types/workflow";
import {auth} from "@clerk/nextjs/server";
import {redirect} from "next/navigation";

export async function RunWorkflow(form: {workflowId: string; flowDefinition?: string}) {
    const {userId} = auth();
    if (!userId) {
        throw new Error("Unauthenticated");
    }

    const {workflowId, flowDefinition} = form;
    if (!workflowId) {
        throw new Error("Workflow ID is required");
    }

    const workflow = await prisma.workflow.findUnique({
        where: {
            userId,
            id: workflowId,
        },
    });

    if (!workflow) {
        throw new Error("Workflow not found");
    }

    let executionPlan: WorkflowExecutionPlan;
    if (!flowDefinition) {
        throw new Error("Flow definition is not defined");
    }

    const flow = JSON.parse(flowDefinition);
    const result = FlowToExecutionPlan(flow.nodes, flow.edges);
    if (result.error) {
        throw new Error("Flow definition is not valid");
    }

    if (!result.executionPlan) {
        throw new Error("No execution plan generated");
    }

    executionPlan = result.executionPlan;

    const execution = await prisma.workflowExecution.create({
        data: {
            workflowId,
            userId,
            status: WorkflowExecutionStatus.PENDING,
            startedAt: new Date(),
            trigger: WorkflowExecutionTrigger.MANUAL,
            definition: flowDefinition,
            phases: {
                create: executionPlan.flatMap((phase) => {
                    return phase.nodes.flatMap((node) => {
                        return {
                            userId,
                            status: ExecutionPhaseStatus.CREATED,
                            number: phase.phase,
                            node: JSON.stringify(node),
                            name: TaskRegistry[node.data.type].label,
                        };
                    });
                }),
            },
        },
        select: {
            id: true,
            phases: true,
        },
    });

    if (!execution) {
        throw new Error("Workflow execution not created");
    }

    ExecuteWorkflow(execution.id);
    redirect(`/workflow/runs/${workflowId}/${execution.id}`);
}
