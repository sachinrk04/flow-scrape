import "server-only";
import prisma from "@/lib/prisma";
import {revalidatePath} from "next/cache";
import {WorkflowExecutionStatus} from "@/types/workflow";
import {ExecutionPhase} from "@prisma/client";
import {AppNode} from "@/types/appNode";
import {TaskRegistry} from "./task/registry";
import {waitFor} from "../helper/waitFor";
import {ExecutorRegistry} from "./executor/registry";
import {Environment, ExecutionEnvironment} from "@/types/executor";
import {TaskParamType} from "@/types/task";
import {Browser, Page} from "puppeteer";
import {Edge} from "@xyflow/react";

export async function ExecuteWorkflow(executionId: string) {
    const execution = await prisma.workflowExecution.findUnique({
        where: {
            id: executionId,
        },
        include: {
            workflow: true,
            phases: true,
        },
    });

    if (!execution) {
        throw new Error("Execution not found");
    }

    const edges = JSON.parse(execution.definition).edges as Edge[];

    const environment: Environment = {
        phases: {},
    };

    await initializeWorkflowExecution(executionId, execution.workflowId);

    await initializePhaseStatuses(execution);

    let creditsConsumed = 0;
    let executionFailed = false;
    for (const phase of execution.phases) {
        // TODO: consumed credits
        const phaseExecution = await executionWorkflowPhase(phase, environment, edges);
        if (!phaseExecution.success) {
            executionFailed = true;
            break;
        }
    }

    await finalizeWorkflowExecution(executionId, execution.workflowId, executionFailed, creditsConsumed);

    await cleanupEnvironment(environment);

    revalidatePath("/workflow/runs");
}

async function initializeWorkflowExecution(executionId: string, workflowId: string) {
    await prisma.workflowExecution.update({
        where: {id: executionId},
        data: {
            startedAt: new Date(),
            status: WorkflowExecutionStatus.RUNNING,
        },
    });

    await prisma.workflow.update({
        where: {id: workflowId},
        data: {
            lastRunAt: new Date(),
            lastRunStatus: WorkflowExecutionStatus.RUNNING,
            lastRunId: executionId,
        },
    });
}

async function initializePhaseStatuses(execution: any) {
    await prisma.executionPhase.updateMany({
        where: {
            id: {
                in: execution.phases.map((phase: any) => phase.id),
            },
        },
        data: {
            status: WorkflowExecutionStatus.PENDING,
        },
    });
}

async function finalizeWorkflowExecution(
    executionId: string,
    workflowId: string,
    executionFailed: boolean,
    creditsConsumed: number
) {
    const finalStatus = executionFailed ? WorkflowExecutionStatus.FAILED : WorkflowExecutionStatus.COMPLETED;
    await prisma.workflowExecution.update({
        where: {id: executionId},
        data: {
            status: finalStatus,
            completedAt: new Date(),
            creditsConsumed,
        },
    });

    prisma.workflow
    .update({
        where: {
            id: workflowId,
            lastRunId: executionId,
        },
        data: {
            lastRunStatus: finalStatus,
        },
    })
    .catch((err) => {
        // console.error(e);
    });
}

async function executionWorkflowPhase(phase: ExecutionPhase, environment: Environment, edges: Edge[]) {
    const startedAt = new Date();
    const node = JSON.parse(phase.node) as AppNode;
    setupEnvironmentForPhase(node, environment, edges);

    await prisma.executionPhase.update({
        where: {id: phase.id},
        data: {
            status: WorkflowExecutionStatus.RUNNING,
            startedAt,
            inputs: JSON.stringify(environment.phases[node.id].inputs),
        },
    });

    const creditsRequired = TaskRegistry[node.data.type].credits;

    console.log(`Executing phase ${phase.name} with ${creditsRequired} credits required`);

    // TODO: execute task

    const success = await executePhase(phase, node, environment);

    const outputs = environment.phases[node.id].outputs;
    await finalizePhase(phase.id, success, outputs);
    return {success};
}

async function finalizePhase(phaseId: string, success: boolean, outputs: any) {
    const finalStatus = success ? WorkflowExecutionStatus.COMPLETED : WorkflowExecutionStatus.FAILED;

    await prisma.executionPhase.update({
        where: {id: phaseId},
        data: {
            status: finalStatus,
            completedAt: new Date(),
            outputs: JSON.stringify(outputs),
        },
    });
}

async function executePhase(phase: ExecutionPhase, node: AppNode, environment: Environment): Promise<boolean> {
    const runFn = ExecutorRegistry[node.data.type];
    if (!runFn) {
        return false;
    }

    const executionEnvironment: ExecutionEnvironment<any> = createExecutionEnvironment(node, environment);

    return await runFn(executionEnvironment);
}

function setupEnvironmentForPhase(node: AppNode, environment: Environment, edges: Edge[]) {
    environment.phases[node.id] = {inputs: {}, outputs: {}};
    const inputs = TaskRegistry[node.data.type].inputs;
    for (const input of inputs) {
        if (input.type === TaskParamType.BROWSER_INSTANCE) continue;

        const inputValue = node.data.inputs[input.name];
        if (inputValue) {
            environment.phases[node.id].inputs[input.name] = inputValue;
            continue;
        }

        // Get input value from outputs in the environment
        const connectedEdge = edges.find((edge) => edge.target === node.id && edge.targetHandle === input.name);

        if (!connectedEdge) {
            console.error(`Missing edge fro input ${input.name} node id: ${node.id}`);
            continue;
        }

        const outputValue = environment.phases[connectedEdge.source].outputs[connectedEdge.sourceHandle!];

        environment.phases[node.id].inputs[input.name] = outputValue;
    }
}

function createExecutionEnvironment(node: AppNode, environment: Environment): ExecutionEnvironment<any> {
    return {
        getInput: (name: string) => environment.phases[node.id]?.inputs[name],
        setOutput: (name: string, value: string) => {
            environment.phases[node.id].outputs[name] = value;
        },

        getBrowser: () => environment.browser,
        setBrowser: (browser: Browser) => (environment.browser = browser),

        getPage: () => environment.page,
        setPage: (page: Page) => (environment.page = page),
    };
}

async function cleanupEnvironment(environment: Environment) {
    if (environment.browser) {
        await environment.browser.close().catch((err) => console.error("cannot close browser", err));
    }

    // if (environment.page) {
    //     await environment.page.close();
    // }
}
